#!/usr/bin/env node
/**
 * check_src_inventory.js — AGENTS.md 디렉토리 구조 src/ 인벤토리 ↔ 실제 파일 정합성
 *
 * AGENTS.md "디렉토리 구조" 트리에서 `src/` 서브트리에 나열된 파일 목록을
 * 들여쓰기 기반으로 파싱해 양방향 검증한다:
 *   - 문서에 나열됐지만 실제 없음 (스테일 항목)
 *   - 실제 있지만 문서에 미기재 (인벤토리 누락)
 *   - 디렉토리 주석의 `(N개)` 개수 표기 ↔ 직속 자식 파일 수 불일치
 *
 * 사용법:
 *   npm.cmd run check:srcinv               # 단독 실행
 *   npm.cmd run check:docs                 # 경로·ID 검증과 연쇄 (본 검사 포함)
 */

// @spec none (문서 인벤토리 검증)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC = path.join(ROOT, 'AGENTS.md');
const SRC = 'src/';

const text = fs.readFileSync(DOC, 'utf8');
const lines = text.split(/\r?\n/);

// src/ 서브트리 파싱 — 컬럼 0의 `src/` 라인 이후 들여쓰기 구간
const start = lines.findIndex(l => /^src\/(?:\s|$)/.test(l));
if (start < 0) {
  console.log('✗ AGENTS.md에서 `src/` 디렉토리 트리를 찾지 못했습니다');
  process.exit(1);
}

const listed = [];            // { file, line }
const countClaims = [];       // { dir, claim, line }
const stack = [{ indent: 0, dir: SRC }]; // 들여쓰기 → 디렉토리 경로 스택

for (let i = start + 1; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim() === '') continue;
  if (!/^\s/.test(line)) break;              // 컬럼 0 = src/ 서브트리 종료
  const indent = line.match(/^ */)[0].length;
  const token = line.trim().split(/\s+/)[0];
  if (!token || token.startsWith('#')) continue;

  while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();

  if (token.endsWith('/')) {
    const dir = stack[stack.length - 1].dir + token;
    stack.push({ indent, dir });
    const m = line.match(/\((\d+)개\)/);      // `views/  # 뷰 컨트롤러 (35개)`
    if (m) countClaims.push({ dir, claim: Number(m[1]), line: i + 1 });
  } else {
    listed.push({ file: stack[stack.length - 1].dir + token, line: i + 1 });
  }
}

// 실제 src/ 재귀 수집
const actual = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = dir + e.name;
    if (e.isDirectory()) walk(p + '/');
    else actual.push(p);
  }
})(SRC);

const listedSet = new Set(listed.map(l => l.file));
const actualSet = new Set(actual);
const issues = [];

for (const l of listed) {
  if (!actualSet.has(l.file)) {
    issues.push(`AGENTS.md:${l.line} — 나열됐지만 실제 없음: ${l.file}`);
  }
}
for (const f of actual) {
  if (!listedSet.has(f)) {
    issues.push(`실제 파일 미기재: ${f} — AGENTS.md 디렉토리 구조에 추가 필요`);
  }
}
for (const c of countClaims) {
  const n = actual.filter(f => path.posix.dirname(f) + '/' === c.dir).length;
  if (n !== c.claim) {
    issues.push(`AGENTS.md:${c.line} — ${c.dir} 개수 표기 (${c.claim}개) ≠ 실제 파일 수 (${n}개)`);
  }
}

if (!issues.length) {
  console.log(`✅ src/ 인벤토리 정합 — AGENTS.md 나열 ${listed.length}개 ↔ 실제 ${actual.length}개`);
  process.exit(0);
}

console.log(`⚠ src/ 인벤토리 불일치 ${issues.length}건:\n`);
for (const i of issues) console.log(`  ✗ ${i}`);
process.exit(1);
