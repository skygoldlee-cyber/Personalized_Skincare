#!/usr/bin/env node
/**
 * check_spec_refs.js — SPEC 요구사양 ID ↔ 소스코드 `@spec` 태그 양방향 검증
 *
 * docs/dev/SPEC.md에 선언된 요구사양 ID(FB-01, UX-NAV-07, AO-03 등)를 추출하고,
 * src/, tests/, tools/, css/, sw.js, index.html 에 기록된 `@spec` 주석 태그를
 * 수집해 양방향 정합성을 검사한다.
 *
 * 사용법:
 *   npm.cmd run check:specrefs      # 전체 검증 (스테일 참조 시 exit 1)
 *   node tools/check_spec_refs.js   # 직접 실행
 *
 * 태그 형식 (모듈 헤더 또는 함수 직상단 주석):
 *   // @spec FB-01~08          ← 범위 (FB-01..FB-08로 확장)
 *   // @spec Q-04,Q-05         ← 나열
 *   // @spec none (인프라)     ← 의도적 미커버 표기
 *   <!-- @spec S-02 -->        ← HTML도 동일 규격
 *
 * 검증 결과:
 *   - 코드가 참조하지만 SPEC에 없는 ID → 스테일 참조 (exit 1)
 *   - SPEC에 있지만 어떤 코드도 참조하지 않는 ID → 커버리지 공백 (경고)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPEC_FILE = path.join(ROOT, 'docs', 'dev', 'SPEC.md');

// @spec 태그 스캔 대상
const SCAN_DIRS = ['src', 'tests', 'tools', 'css', 'ref-pipeline'];
const SCAN_FILES = ['sw.js', 'index.html', 'serve.js'];
const SCAN_EXTS = new Set(['.js', '.css', '.html', '.ts', '.py']);
const EXCLUDE_DIRS = [path.join('tools', '_archive'), path.join('tools', '__pycache__'), 'node_modules'];
// 자기 스캔 제외 — 이 파일의 독스트링이 @spec 예시를 포함
const EXCLUDE_FILES = [path.join('tools', 'check_spec_refs.js')];

// ID 패턴: AA-NN, AA-BB-NN (예: UX-NAV-07), AA-PN (예: ROAD-P0 로드맵)
const ID_RE = /\b([A-Z]{1,4}(?:-[A-Z]{1,4})?-(?:\d{2}|P\d))\b/g;
const SPEC_TAG_RE = /@spec\s+([^\n]*)/g;
const RANGE_RE = /^([A-Z]{1,4}(?:-[A-Z]{1,4})?-)(\d{2})~(\d{2})$/;
const PURE_ID_RE = /^[A-Z]{1,4}(?:-[A-Z]{1,4})?-(?:\d{2}|P\d)$/;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const rel = path.relative(ROOT, p);
      if (!EXCLUDE_DIRS.some((x) => rel === x || rel.startsWith(x + path.sep))) yield* walk(p);
    } else if (SCAN_EXTS.has(path.extname(e.name))) {
      const rel = path.relative(ROOT, p);
      if (!EXCLUDE_FILES.some((x) => rel === x)) yield p;
    }
  }
}

/** SPEC.md에서 ID 전수 추출 — 테이블 셀·굵은 글씨·본문 언급 모두 포함 */
function extractSpecIds() {
  const text = fs.readFileSync(SPEC_FILE, 'utf8');
  const ids = new Set();
  for (const m of text.matchAll(ID_RE)) ids.add(m[1]);
  return ids;
}

/** @spec 토큰 문자열 → ID 집합 확장 (범위·나열 지원) */
function parseSpecTag(tagText, file, line, errors) {
  const ids = new Set();
  for (const raw of tagText.split(',')) {
    const token = raw.trim()
      .replace(/\*\/\s*$/, '')       // 블록 주석 종결자 */ 제거
      .replace(/-->\s*$/, '')        // HTML 주석 종결자 --> 제거
      .replace(/[)）].*$/, '').trim(); // 뒤 주석 제거
    if (!token) continue;
    if (/^none\b/i.test(token)) return ids; // 의도적 미커버 표기
    const range = token.match(RANGE_RE);
    if (range) {
      const [, prefix, from, to] = range;
      for (let i = +from; i <= +to; i++) ids.add(prefix + String(i).padStart(2, '0'));
      continue;
    }
    if (PURE_ID_RE.test(token)) { ids.add(token); continue; }
    // 대문자 시작 토큰만 ID 의도로 간주 — 문장 중 "@spec 태그" 같은 언급은 무시
    if (/^[A-Z0-9]/.test(token)) errors.push(`${path.relative(ROOT, file)}:${line} — @spec 토큰 해석 불가: "${token}"`);
  }
  return ids;
}

function collectCodeRefs() {
  const refs = new Map(); // id → [{file, line}]
  const errors = [];
  const files = [...SCAN_FILES.map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f))];
  for (const d of SCAN_DIRS) {
    const abs = path.join(ROOT, d);
    if (fs.existsSync(abs)) for (const f of walk(abs)) files.push(f);
  }

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      for (const m of text.matchAll(SPEC_TAG_RE)) {
        for (const id of parseSpecTag(m[1], file, i + 1, errors)) {
          if (!refs.has(id)) refs.set(id, []);
          refs.get(id).push({ file: path.relative(ROOT, file), line: i + 1 });
        }
      }
    });
  }
  return { refs, errors };
}

function main() {
  const specIds = extractSpecIds();
  const { refs, errors } = collectCodeRefs();

  const stale = [];   // 코드 → SPEC에 없는 ID
  for (const [id, locs] of refs) {
    if (!specIds.has(id)) for (const l of locs) stale.push(`${l.file}:${l.line} — SPEC에 없는 ID: ${id}`);
  }

  const uncovered = [...specIds].filter((id) => !refs.has(id)).sort();

  console.log('SPEC ID 추적 검증');
  console.log(`  SPEC.md 선언 ID: ${specIds.size}개`);
  console.log(`  코드 @spec 참조: ${refs.size}개 ID, ${[...refs.values()].flat().length}개 위치`);

  if (errors.length) {
    console.log('\n태그 파싱 오류:');
    for (const e of errors) console.log(`  - ${e}`);
  }
  if (stale.length) {
    console.log('\n스테일 참조 (SPEC에 없는 ID):');
    for (const s of stale) console.log(`  - ${s}`);
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

  const fail = stale.length > 0 || errors.length > 0;
  console.log(fail ? '\n실패 — 스테일 참조·파싱 오류를 수정하세요.' : '\n통과 — 스테일 참조 없음.');
  if (!fail && uncovered.length) console.log('  (커버리지 공백은 경고 — 문서/정책형 요구사항은 코드 참조 없음이 정상일 수 있음)');
  process.exit(fail ? 1 : 0);
}

main();
