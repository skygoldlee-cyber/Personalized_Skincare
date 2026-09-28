#!/usr/bin/env node
/**
 * check_doc_ids.js — 문서 ID 부여·유일성 검증
 *
 * docs/, ref-pipeline/, 루트 문서(AGENTS.md·README.md)의 모든 마크다운에
 * `> **문서 ID**: DOC-XX-NN` 헤더가 존재하고, ID가 전체 문서에서 유일한지 검사한다.
 * 새 문서 추가 시 ID 누락·중복을 자동 탐지한다.
 *
 * 사용법:
 *   npm.cmd run check:docs          # 경로 검증 + 문서 ID 검증 (연쇄 실행)
 *   node tools/check/check_doc_ids.js     # 문서 ID만 검증
 */

// @spec none (문서 ID 검증)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const DOC_DIRS = ['docs', 'ref-pipeline'];
const DOC_FILES = ['AGENTS.md', 'README.md'];

const ID_RE = /^\s*>\s*\*\*문서 ID\*\*:\s*(DOC-[A-Z]+-\d+)\s*$/m;
const ID_FIND_RE = /\*\*문서 ID\*\*:\s*(DOC-[A-Z]+-\d+)/g;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue; // .pytest_cache·node_modules 등 제외
      yield* walk(p);
    } else if (e.name.endsWith('.md')) yield p;
  }
}

function docFiles() {
  const files = DOC_FILES
    .filter(f => fs.existsSync(path.join(ROOT, f)))
    .map(f => path.join(ROOT, f));
  for (const d of DOC_DIRS) {
    const abs = path.join(ROOT, d);
    if (fs.existsSync(abs)) files.push(...walk(abs));
  }
  return files;
}

const files = docFiles();
const seen = new Map(); // id → file
const issues = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  const ids = [...text.matchAll(ID_FIND_RE)].map(m => m[1]);
  if (ids.length === 0) {
    issues.push({ file: rel, msg: '문서 ID 헤더 없음 — 상단에 `> **문서 ID**: DOC-XX-NN` 추가 필요' });
    continue;
  }
  if (ids.length > 1) {
    issues.push({ file: rel, msg: `문서 ID 다수 선언 (${ids.join(', ')}) — 1개만 허용` });
  }
  if (!ID_RE.test(text)) {
    issues.push({ file: rel, msg: '문서 ID 형식 오류 — `> **문서 ID**: DOC-XX-NN` 블록 인용 형태여야 함' });
  }
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push({ file: rel, msg: `문서 ID 중복: ${id} (이미 ${seen.get(id)}에서 사용)` });
    } else {
      seen.set(id, rel);
    }
  }
}

if (!issues.length) {
  console.log(`✅ 문서 ID 검증 통과 — ${files.length}개 문서, ${seen.size}개 고유 ID`);
  process.exit(0);
}

console.log(`⚠ 문서 ID 문제 ${issues.length}건 발견:\n`);
for (const i of issues) console.log(` ${i.file}\n   ✗ ${i.msg}`);
console.log(`\nID 규약: DOC-{영역}-{NN} — 영역 접두사는 docs/README.md "문서 ID 레지스트리" 참조`);
process.exit(1);
