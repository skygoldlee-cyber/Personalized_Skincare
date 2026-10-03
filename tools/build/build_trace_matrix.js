#!/usr/bin/env node
/**
 * build_trace_matrix.js — TRACE MATRIX 자동 생성
 *
 * SPEC.md의 요구사양 ID를 축으로, 4계층 추적 링크를 수집해
 * docs/dev/TRACE_MATRIX.md를 생성한다 (생성물 — 직접 편집 금지).
 *
 *   요구사항 (SPEC.md) ─┬─ 문서   : 각 .md 헤더의 "관련 SPEC ID" 행
 *                     ├─ 소스   : src/·css/·tools/·ref-pipeline/ 의 @spec 태그
 *                     ├─ 테스트 : tests/ 의 @spec 태그
 *                     └─ 보고서 : docs/report_archive/ 의 관련 SPEC ID
 *
 * 사용법:
 *   npm.cmd run build:trace                    # TRACE_MATRIX.md 재생성
 *   npm.cmd run check:trace                    # 신선도 검증 — 입력 해시가 다르면 exit 1
 *   node tools/build/build_trace_matrix.js --check   # 직접 검증
 *
 * 신선도: 생성 시 입력(SPEC + @spec 태그 + 문서 헤더)의 해시를 파일에 스탬프.
 * --check는 재해시해 비교 — SPEC·@spec·문서 헤더가 바뀌면 재생성을 강제한다.
 * 해시 입력은 CRLF/LF 개행을 정규화한다 — 작업트리 개행 상태(autocrlf 등)에
 * 해시가 종속되면 Windows↔Linux 간 오탐이 발생한다.
 */

// @spec none (추적 매트릭스 생성 도구)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const T = require('../lib/trace_scan');

const OUT_FILE = path.join(T.ROOT, 'docs', 'dev', 'TRACE_MATRIX.md');
const HASH_RE = /> 입력 해시: ([0-9a-f]+)/;

const normEol = (s) => s.replace(/\r\n/g, '\n');

/** 입력 해시 — SPEC 전문 + 각 파일의 추적 관련 행(@spec·관련 SPEC ID·문서 ID) */
function inputsHash(specIds) {
  const h = crypto.createHash('sha256');
  h.update(normEol(fs.readFileSync(T.SPEC_FILE, 'utf8')));
  const files = new Set();
  for (const f of T.SCAN_FILES.map(f => path.join(T.ROOT, f))) if (fs.existsSync(f)) files.add(f);
  for (const d of T.SCAN_DIRS) for (const f of T.walk(path.join(T.ROOT, d), T.SCAN_EXTS)) files.add(f);
  for (const d of T.DOC_DIRS) for (const f of T.walk(path.join(T.ROOT, d), new Set(['.md']))) files.add(f);
  for (const f of T.DOC_FILES.map(f => path.join(T.ROOT, f))) if (fs.existsSync(f)) files.add(f);
  for (const file of [...files].sort()) {
    const rel = path.relative(T.ROOT, file).replace(/\\/g, '/');
    h.update('\n@@ ' + rel);
    if (file === OUT_FILE) continue; // 자기 자신의 해시 행은 제외
    for (const l of normEol(fs.readFileSync(file, 'utf8')).split('\n')) {
      if (/@spec|관련 SPEC ID|문서 ID/.test(l)) h.update('\n' + l);
    }
  }
  void specIds;
  return h.digest('hex').slice(0, 16);
}

/** 검증 수단 파생 — 연결된 산출물 유형으로 분류 (29148의 검증 방법 식별에 대응).
 *  tests/e2e/ 참조가 있으면 'E2E 테스트'로 분리 표기 — 기하·시각 계열 UI/UX
 *  요구사양(UX-VFY-02/03)의 실제 검증 수위를 구분하기 위함. */
function verMeans(id, src, tst, docs) {
  const s = src.get(id);
  const t = tst.get(id);
  if (t?.size) return [...t].some(f => f.startsWith('tests/e2e/')) ? 'E2E 테스트' : '테스트';
  if (s?.size && [...s].every(f => f.startsWith('tools/') || f.startsWith('ref-pipeline/'))) return '도구 검증';
  if (s?.size) return '구현 (테스트 갭)';
  if (docs.has(id)) return '문서 검토';
  return '—';
}

function build(specIds, src, tst, docs, reports, meta, missingRef, status, sources) {
  const bySection = new Map();
  for (const [id, sec] of specIds) {
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec).push(id);
  }

  const out = [];
  out.push('# 🔗 TRACE MATRIX — 요구사양 추적 매트릭스', '');
  out.push('> **문서 ID**: DOC-DEV-04');
  out.push('> **관련 SPEC ID**: 해당 없음 (본 문서가 추적 산출물)');
  out.push('> ⚠️ 자동 생성 파일 — `npm run build:trace`로 재생성. 직접 편집 금지.');
  out.push(`> 입력 해시: ${inputsHash(specIds)}`);
  out.push(`> 생성: ${new Date().toISOString().slice(0, 10)} · 원천: SPEC.md(${specIds.size}개 ID) + @spec 태그 + 문서 헤더`, '');
  out.push('| 열 | 의미 | 원천 |');
  out.push('|----|------|------|');
  out.push('| 상태 | SPEC의 구현 상태 (✅·🟡·미구현 등) | SPEC.md 표 마지막 셀 |');
  out.push('| 검증 수단 | 파생 분류 — E2E 테스트(tests/e2e 참조)/테스트/도구 검증/구현(테스트 갭)/문서 검토 | 연결된 산출물 유형 |');
  out.push('| 문서 | 해당 요구사항을 다루는 문서 (DOC-ID) | 각 문서 헤더 "관련 SPEC ID" |');
  out.push('| 소스 | 구현 코드 파일 | `// @spec` 태그 |');
  out.push('| 테스트 | 검증 테스트 파일 | `// @spec` 태그 (tests/) |');
  out.push('| 보고서 | 분석·결과 보고서 | report_archive 헤더 |');
  out.push('| 출처 | 요구사항의 기원 (법령·시험 규정·사업 문서) | SPEC 부록 "요구사항 출처" 표 |');
  out.push('');

  let nDoc = 0, nSrc = 0, nTst = 0, nRpt = 0;
  const testGap = []; // 소스 연결 있으나 테스트 미연결
  for (const id of specIds.keys()) {
    if (docs.has(id)) nDoc++;
    if (src.has(id)) nSrc++;
    if (tst.has(id)) nTst++;
    if (reports.has(id)) nRpt++;
    if (src.has(id) && !tst.has(id)) testGap.push(id);
  }
  out.push(`**커버리지 요약**: 요구사항 ${specIds.size}개 — 문서 연결 ${nDoc} · 소스 연결 ${nSrc} · 테스트 연결 ${nTst} · 보고서 연결 ${nRpt}`, '');
  out.push('---', '');

  for (const [sec, ids] of bySection) {
    out.push(`## ${sec || '기타 (SPEC 헤더·본문 언급)'}`, '');
    out.push('| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |');
    out.push('|----|------|-----------|------|------|--------|--------|------|');
    for (const id of ids.sort()) {
      const cell = (m) => {
        const s = m.get(id);
        if (!s) return '—';
        const arr = [...s].sort();
        return arr.length > 4 ? arr.slice(0, 4).join('<br>') + `<br>…외 ${arr.length - 4}개` : arr.join('<br>');
      };
      out.push(`| ${id} | ${status.get(id) || '—'} | ${verMeans(id, src, tst, docs)} | ${cell(docs)} | ${cell(src)} | ${cell(tst)} | ${cell(reports)} | ${sources.get(id) || '—'} |`);
    }
    out.push('');
  }

  out.push('---', '', '## 부록 A — 문서 → 요구사양 역방향 매핑', '');
  out.push('| 문서 ID | 파일 | 관련 SPEC ID |');
  out.push('|---------|------|--------------|');
  const docToSpec = new Map();
  for (const [id, set] of [...docs, ...reports]) {
    for (const d of set) {
      if (!docToSpec.has(d)) docToSpec.set(d, new Set());
      docToSpec.get(d).add(id);
    }
  }
  for (const [docId, info] of [...meta].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ids = docToSpec.get(docId);
    out.push(`| ${docId} | ${info.file} | ${ids ? [...ids].sort().join(', ') : '—'} |`);
  }

  out.push('', '## 부록 B — 테스트 갭 (소스 연결 있으나 테스트 @spec 미연결)', '');
  if (testGap.length) {
    out.push(`소스에 @spec이 있지만 tests/에서 참조가 없는 요구사항 ${testGap.length}개 — 테스트 백로그 후보.`, '');
    out.push('| ID | 절 | 구현 소스 |');
    out.push('|----|-----|-----------|');
    for (const id of testGap.sort()) {
      const files = [...(src.get(id) || [])].sort().slice(0, 3).join('<br>');
      out.push(`| ${id} | ${specIds.get(id) || '—'} | ${files} |`);
    }
  } else {
    out.push('없음 — 소스 연결된 모든 요구사항에 테스트 참조가 있음.');
  }

  if (missingRef.length) {
    out.push('', '## 부록 C — 관련 SPEC ID 헤더 누락 문서', '');
    for (const f of missingRef) out.push(`- ${f}`);
  }
  out.push('');
  return out.join('\n');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { specIds, src, tst, docs, reports, meta, missingRef, docErrors } = T.scanAll();
  const status = T.extractSpecStatus();
  const sources = T.extractSpecSources(specIds);

  if (checkOnly) {
    const want = inputsHash(specIds);
    const got = fs.existsSync(OUT_FILE) ? (fs.readFileSync(OUT_FILE, 'utf8').match(HASH_RE) || [])[1] : null;
    if (got === want) {
      console.log(`✅ TRACE_MATRIX 신선도 통과 — 입력 해시 ${want}`);
      process.exit(0);
    }
    console.log(`⚠ TRACE_MATRIX.md가 입력과 다릅니다 (${got || '없음'} → ${want})`);
    console.log(`  SPEC·@spec·문서 헤더 변경 후 재생성이 필요합니다: npm run build:trace`);
    process.exit(1);
  }

  if (docErrors?.length) {
    console.log(`⚠ "관련 SPEC ID" 헤더 파싱 경고 ${docErrors.length}건:`);
    for (const e of docErrors) console.log(`  - ${e}`);
  }

  fs.writeFileSync(OUT_FILE, build(specIds, src, tst, docs, reports, meta, missingRef, status, sources));
  let nDoc = 0, nSrc = 0, nTst = 0, nRpt = 0, nGap = 0;
  for (const id of specIds.keys()) {
    if (docs.has(id)) nDoc++;
    if (src.has(id)) nSrc++;
    if (tst.has(id)) nTst++;
    if (reports.has(id)) nRpt++;
    if (src.has(id) && !tst.has(id)) nGap++;
  }
  console.log(`✅ TRACE_MATRIX.md 생성 — 요구사항 ${specIds.size}개 · 문서 ${nDoc} · 소스 ${nSrc} · 테스트 ${nTst} · 보고서 ${nRpt} 연결`);
  console.log(`   테스트 갭: ${nGap}개 요구사항 (부록 B)${missingRef.length ? ` · 헤더 누락 문서 ${missingRef.length}개` : ''}`);
}

main();
