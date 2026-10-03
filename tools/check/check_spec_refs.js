#!/usr/bin/env node
/**
 * check_spec_refs.js — SPEC 요구사양 ID ↔ 소스코드 `@spec` 태그 양방향 검증
 *
 * docs/dev/SPEC.md에 선언된 요구사양 ID(FB-01, UX-NAV-07, AO-03 등)를 추출하고,
 * src/, tests/, tools/, css/, sw.js, index.html 에 기록된 `@spec` 주석 태그를
 * 수집해 양방향 정합성을 검사한다.
 *
 * 스캔 범위·토큰 규격·정규식은 tools/lib/trace_scan.js(공용)를 사용한다 —
 * 이 파일만 따로 파서를 두지 않는다 (drift 방지).
 *
 * 사용법:
 *   npm.cmd run check:specrefs      # 전체 검증 (스테일 참조 시 exit 1)
 *   node tools/check/check_spec_refs.js   # 직접 실행
 *
 * 태그 형식 (모듈 헤더 또는 함수 직상단 주석):
 *   // @spec FB-01~08          ← 범위 (FB-01..FB-08로 확장)
 *   // @spec Q-04,Q-05         ← 나열 (구분자 , · / 모두 허용 — FO-24/RR-19 형태 가능)
 *   // @spec none (인프라)     ← 의도적 미커버 표기
 *   // @spec FB-06 — 이유      ← ID 뒤 공백·한글 이후 텍스트는 파서가 절단 (설명 부기 허용)
 *   <!-- @spec S-02 -->        ← HTML도 동일 규격
 *   ※ 대문자/숫자로 시작하는 비-ID 토큰은 파싱 오류로 실패 — 설명은 공백·한글 뒤에 둘 것
 *
 * 검증 결과:
 *   - 코드가 참조하지만 SPEC에 없는 ID → 스테일 참조 (exit 1)
 *   - src/css/html/tests/tools/ 파일에 @spec 태그가 아예 없음 → 누락 (exit 1)
 *     ※ tools/_archive·ref-pipeline 제외, `@spec none`으로 의도적 미커버 명시 가능
 *   - SPEC에 있지만 어떤 코드도 참조하지 않는 ID → 커버리지 공백 (경고)
 *     ※ SPEC 상태가 '미구현'/'보류'인 ID는 로드맵 항목으로 공백에서 제외 —
 *        구현 시작 시 상태를 바꾸면 자동으로 커버리지 추적 대상이 된다
 */
const fs = require('fs');
const path = require('path');
const T = require('../lib/trace_scan');

const ROOT = T.ROOT;

// 테스트 갭 기준선 — 소스 참조는 있으나 tests/ @spec이 없는 요구사항의 허용 상한.
// 기존 백로그(정책형·문서형 포함)를 승계하되, 신규 요구사항이 갭을 늘리면 실패한다.
// 테스트 @spec을 추가해 갭을 줄였다면 이 수치를 함께 낮춘다.
const TEST_GAP_BASELINE = 0;

// UI/UX E2E 갭 기준선 (UX-VFY-03) — 기하 계열 요구사항은 브라우저 실측만이 유효 검증.
// 소스 참조는 있으나 tests/e2e/ @spec이 없는 UI/UX 계열 ID의 허용 상한.
// 기존 백로그(규약·리뷰형 다수)를 승계하되, 신규 UI/UX 요구사항이 갭을 늘리면 실패한다.
// e2e @spec을 추가해 갭을 줄였다면 이 수치를 함께 낮춘다.
const UIUX_PREFIX_RE = /^(?:UX-|TR-|R-|TH-|A-)/;
const UIUX_E2E_GAP_BASELINE = 15; // +UX-VFY-06 (정적 체커 규약형 — e2e 실측 대상 아님)

// @spec 태그 강제 디렉터리 — 이 아래 모든 스캔 대상 파일에 최소 1개 @spec 태그 필요
// (`@spec none`으로 의도적 미커버 명시 가능). tools/_archive·ref-pipeline은
// 일회성·보조 스크립트라 강제 제외.
const SPEC_TAG_REQUIRED_PREFIXES = ['src/', 'css/', 'html/', 'tests/', 'tools/'];
const SPEC_TAG_EXEMPT_PREFIXES = ['tools/_archive/'];

/** 라인 번호가 필요해 직접 순회 — ID 확장·오류 규격은 lib/expandIds 공용 */
function collectCodeRefs(specIds) {
  const refs = new Map();     // id → [{file, line}] (전체)
  const testRefs = new Set(); // tests/ 하위 파일에서 참조된 ID
  const e2eRefs = new Set();  // tests/e2e/ 하위 파일에서 참조된 ID (UX-VFY-03)
  const srcRefs = new Set();  // tests/ 외부(소스·도구)에서 참조된 ID
  const errors = [];
  const files = [...T.SCAN_FILES.map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f))];
  for (const d of T.SCAN_DIRS) {
    for (const f of T.walk(path.join(ROOT, d), T.SCAN_EXTS)) files.push(f);
  }

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const isTest = rel.startsWith('tests/');
    let tagged = false;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      for (const m of text.matchAll(T.SPEC_TAG_RE)) {
        tagged = true;
        for (const id of T.expandIds(m[1], specIds, errors, `${rel}:${i + 1}`)) {
          if (!refs.has(id)) refs.set(id, []);
          refs.get(id).push({ file: rel, line: i + 1 });
          (isTest ? testRefs : srcRefs).add(id);
          if (rel.startsWith('tests/e2e/')) e2eRefs.add(id);
        }
      }
    });
    const required = SPEC_TAG_REQUIRED_PREFIXES.some((p) => rel.startsWith(p))
      || T.SCAN_FILES.includes(rel);
    if (!tagged && required && !SPEC_TAG_EXEMPT_PREFIXES.some((p) => rel.startsWith(p))) {
      errors.push(`${rel} — @spec 태그 없음 (모듈 헤더에 \`// @spec XX-NN\` 또는 \`// @spec none\` 추가 필요)`);
    }
  }
  return { refs, testRefs, e2eRefs, srcRefs, errors };
}

/** 문서 헤더 "관련 SPEC ID" 수집 → id → [{file}] (docId는 meta로 파일명에 환원) */
function collectDocRefs(specIds) {
  const { docs, reports, meta, missingRef: missing, docErrors } = T.collectDocRefs(specIds);
  const refs = new Map();
  for (const [id, docIds] of [...docs, ...reports]) {
    if (!refs.has(id)) refs.set(id, []);
    for (const docId of docIds) refs.get(id).push({ file: meta.get(docId)?.file || docId });
  }
  return { refs, errors: docErrors, missing };
}

function main() {
  const specIds = new Set(T.extractSpec().keys());
  const { refs, testRefs, e2eRefs, srcRefs, errors } = collectCodeRefs(specIds);
  const { refs: docRefs, errors: docErrors, missing: missingHeaders } = collectDocRefs(specIds);
  errors.push(...docErrors);

  const stale = [];   // 코드·문서 → SPEC에 없는 ID
  for (const [id, locs] of refs) {
    if (!specIds.has(id)) for (const l of locs) stale.push(`${l.file}:${l.line} — SPEC에 없는 ID: ${id}`);
  }
  for (const [id, locs] of docRefs) {
    if (!specIds.has(id)) for (const l of locs) stale.push(`${l.file} — 헤더 "관련 SPEC ID"가 SPEC에 없는 ID: ${id}`);
  }

  // 로드맵 항목(SPEC 상태 미구현·보류)은 코드 참조가 없는 것이 정상 — 공백에서 제외
  const specStatus = T.extractSpecStatus();
  const PLANNED_RE = /미구현|보류/;
  const unreferenced = [...specIds].filter((id) => !refs.has(id));
  const planned = unreferenced.filter((id) => PLANNED_RE.test(specStatus.get(id) || '')).sort();
  const uncovered = unreferenced.filter((id) => !PLANNED_RE.test(specStatus.get(id) || '')).sort();

  console.log('SPEC ID 추적 검증');
  console.log(`  SPEC.md 선언 ID: ${specIds.size}개`);
  console.log(`  코드 @spec 참조: ${refs.size}개 ID, ${[...refs.values()].flat().length}개 위치`);
  console.log(`  문서 헤더 참조: ${docRefs.size}개 ID (TRACE_MATRIX 재생성은 npm run build:trace)`);

  if (errors.length) {
    console.log('\n태그 파싱 오류:');
    for (const e of errors) console.log(`  - ${e}`);
  }
  if (stale.length) {
    console.log('\n스테일 참조 (SPEC에 없는 ID):');
    for (const s of stale) console.log(`  - ${s}`);
  }
  if (missingHeaders.length) {
    console.log(`\n"관련 SPEC ID" 헤더 누락 문서 ${missingHeaders.length}개 (경고):`);
    for (const f of missingHeaders.slice(0, 15)) console.log(`  - ${f}`);
    if (missingHeaders.length > 15) console.log(`  …외 ${missingHeaders.length - 15}개`);
  }
  if (planned.length) {
    console.log(`\n로드맵 항목 (미구현·보류 — 공백 제외, ${planned.length}개): ${planned.join(', ')}`);
  }
  if (uncovered.length) {
    console.log(`\n커버리지 공백 (코드 미참조 ID ${uncovered.length}개):`);
    const byPrefix = {};
    for (const id of uncovered) {
      const p = id.replace(/-\d+$/, '');
      (byPrefix[p] ??= []).push(id);
    }
    for (const [p, ids] of Object.entries(byPrefix)) console.log(`  ${p}: ${ids.join(', ')}`);
  }

  // 테스트 갭 — 소스 @spec은 있으나 tests/ @spec이 없는 요구사항 (TRACE_MATRIX 부록 B와 동일 집계)
  const testGap = [...srcRefs].filter((id) => !testRefs.has(id) && specIds.has(id)).sort();
  if (testGap.length) {
    console.log(`\n테스트 미연결 (소스 참조 있으나 tests/ @spec 없음 — ${testGap.length}개):`);
    const byPrefix = {};
    for (const id of testGap) {
      const p = id.replace(/-\d+$/, '');
      (byPrefix[p] ??= []).push(id);
    }
    for (const [p, ids] of Object.entries(byPrefix)) console.log(`  ${p}: ${ids.join(', ')}`);
    console.log('  ※ 신규 요구사항은 테스트 @spec 추가 원칙 (정책형·문서형 요구사항은 예외 가능)');
  }
  const gapExceeded = testGap.length > TEST_GAP_BASELINE;

  // UI/UX E2E 갭 (UX-VFY-03) — UI/UX 계열 중 소스 참조 있으나 tests/e2e/ 미연결
  const uxE2eGap = [...srcRefs]
    .filter((id) => specIds.has(id) && UIUX_PREFIX_RE.test(id) && !e2eRefs.has(id))
    .sort();
  console.log(`  UI/UX E2E 갭: ${uxE2eGap.length}개 (기준선 ${UIUX_E2E_GAP_BASELINE}개 — 기하 계열 신규 요구사항은 e2e 실측 필수)`);
  const uxGapExceeded = uxE2eGap.length > UIUX_E2E_GAP_BASELINE;

  const fail = stale.length > 0 || errors.length > 0 || gapExceeded || uxGapExceeded;
  console.log(fail ? '\n실패 — 스테일 참조·파싱 오류·테스트 갭 증가를 수정하세요.' : '\n통과 — 스테일 참조 없음.');
  if (gapExceeded) {
    console.log(`  테스트 갭 ${testGap.length}개 > 기준선 ${TEST_GAP_BASELINE}개 — 신규 요구사항에 tests/ @spec을 추가하거나,`);
    console.log(`  테스트 없이 유지할 정책형 요구사항이라면 TEST_GAP_BASELINE을 갱신하세요 (tools/check/check_spec_refs.js).`);
  }
  if (uxGapExceeded) {
    console.log(`  UI/UX E2E 갭 ${uxE2eGap.length}개 > 기준선 ${UIUX_E2E_GAP_BASELINE}개 — 신규 UI/UX 요구사항에 tests/e2e/ @spec을 추가하거나,`);
    console.log(`  규약·리뷰형 요구사항으로 유지할 경우 UIUX_E2E_GAP_BASELINE을 갱신하세요 (tools/check/check_spec_refs.js).`);
    console.log(`  현재 갭: ${uxE2eGap.join(', ')}`);
  }
  if (!fail && uncovered.length) console.log('  (커버리지 공백은 경고 — 문서/정책형 요구사항은 코드 참조 없음이 정상일 수 있음)');
  process.exit(fail ? 1 : 0);
}

main();
