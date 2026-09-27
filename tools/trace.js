#!/usr/bin/env node
/**
 * trace.js — 요구사양 도시어(dossier) 조회
 *
 * SPEC ID 하나를 주면 해당 요구사항의 정의 위치·구현·테스트·보고서·문서를
 * TRACE MATRIX와 동일한 스캔으로 즉시 출력한다.
 *
 * 사용법:
 *   node tools/trace.js Q-05            # 단일 요구사항
 *   node tools/trace.js FO-01 FO-02     # 복수
 *   node tools/trace.js DOC-DSN-03      # 문서 ID → 해당 문서의 관련 요구사항
 */

// @spec none (추적 조회 도구)
const T = require('./lib/trace_scan');

function showSpec(id, data) {
  const { specIds, src, tst, docs, reports, meta } = data;
  console.log(`\n━━ ${id} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (!specIds.has(id)) {
    console.log('  ⚠ SPEC.md에 없는 ID입니다 (오타·삭제된 요구사항 가능)');
  } else {
    console.log(`  절: ${specIds.get(id) || '—'}`);
  }
  const list = (m, label) => {
    const s = m.get(id);
    if (!s || !s.size) { console.log(`  ${label}: —`); return; }
    console.log(`  ${label}: ${[...s].sort().join('\n' + ' '.repeat(label.length + 4))}`);
  };
  list(docs, '문서');
  list(src, '소스');
  list(tst, '테스트');
  list(reports, '보고서');
}

function showDoc(docId, data) {
  const { docs, reports, meta } = data;
  const info = meta.get(docId);
  console.log(`\n━━ ${docId} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (!info) { console.log('  ⚠ 등록되지 않은 문서 ID'); return; }
  console.log(`  파일: ${info.file}`);
  console.log(`  제목: ${info.title}`);
  const ids = new Set();
  for (const [id, set] of [...docs, ...reports]) if (set.has(docId)) ids.add(id);
  console.log(`  관련 SPEC ID: ${ids.size ? [...ids].sort().join(', ') : '—'}`);
}

function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!args.length) {
    console.log('사용법: node tools/trace.js <SPEC-ID|DOC-ID>...');
    console.log('예: node tools/trace.js Q-05  |  node tools/trace.js DOC-DSN-03');
    process.exit(1);
  }
  const data = T.scanAll();
  for (const a of args) {
    if (a.startsWith('DOC-')) showDoc(a, data);
    else showSpec(a.toUpperCase(), data);
  }
}

main();
