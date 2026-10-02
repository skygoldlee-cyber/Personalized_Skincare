#!/usr/bin/env node
/**
 * check_inventory.js — AGENTS.md 디렉토리 구조 트리 ↔ 실제 파일시스템 정합성
 *
 * AGENTS.md "디렉토리 구조" 코드블록을 들여쓰기 기반으로 파싱해 검증한다:
 *   - 나열된 파일·디렉토리가 실제 존재 (스테일 항목 탐지, 전 트리)
 *   - 전수 목록 디렉토리(FULL_DIRS)는 역방향 검증 — 실제 파일 미기재 탐지
 *   - 디렉토리 주석의 인라인 파일 목록 `(a.css, b.css)` ↔ 해당 디렉토리 실제 파일
 *   - 디렉토리 주석의 `N개` 개수 표기 ↔ 직속 자식 파일 수
 *   - `<id>`·`{…}`·`*` 등 플레이스홀더 토큰은 존재 검증에서 제외
 *
 * ARCHITECTURE.md의 box-drawing 트리(`├──`/`└──`)도 별도 문법으로 파싱해
 * 나열 항목의 실존성을 검증한다 (큐레이션 목록이라 순방향 존재 검증만).
 *
 * 사용법:
 *   npm.cmd run check:inventory          # 단독 실행
 *   npm.cmd run check:docs               # 경로·ID 검증과 연쇄 (본 검사 포함)
 */

// @spec none (문서 인벤토리 검증)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC = path.join(ROOT, 'AGENTS.md');

// 전수 양방향 검증 디렉토리 — 이 아래 모든 실제 파일이 트리에 나열돼야 한다
const FULL_DIRS = ['src/'];
// 인라인 목록 `(파일, 파일, …)`을 실제 디렉토리와 집합 비교하는 디렉토리
const INLINE_DIRS = ['css/'];

const PLACEHOLDER_RE = /[<{}*]|…/;
const FILE_TOKEN_RE = /^[\w가-힣.-]+\.[a-z0-9]+$/i;

// box-drawing 트리를 추가로 검증할 문서 (루트 `name/` 앵커가 있는 fenced 블록)
const BOX_TREE_DOCS = ['docs/dev/ARCHITECTURE.md'];

const lines = fs.readFileSync(DOC, 'utf8').split(/\r?\n/);

// "디렉토리 구조" 코드블록 추출 — index.template.html을 포함하는 fenced 블록
let inBlock = false;
let block = null;
for (let i = 0; i < lines.length; i++) {
  if (/^```/.test(lines[i])) {
    if (!inBlock) {
      inBlock = true;
      block = { start: i, lines: [] };
    } else {
      inBlock = false;
      // 디렉토리 트리는 index.template.html이 행 첫 토큰 — 명령어 블록의 주석 인용과 구분
      if (block.lines.some((l) => /^index\.template\.html\s/.test(l.text))) break;
      block = null;
    }
    continue;
  }
  if (inBlock && block) block.lines.push({ text: lines[i], line: i + 1 });
}
if (!block) {
  console.log('✗ AGENTS.md에서 디렉토리 구조 코드블록(index.template.html 포함)을 찾지 못했습니다');
  process.exit(1);
}

// 트리 파싱 — 들여쓰기 스택으로 부모 디렉토리 추적
const listedFiles = [];   // { path, line }
const listedDirs = [];    // { path, line, inlineList: string[]|null, countClaim: number|null }
const stack = [{ indent: -1, dir: '' }];

for (const { text, line } of block.lines) {
  if (text.trim() === '' || /^\s*#/.test(text)) continue;
  const indent = text.match(/^ */)[0].length;
  const token = text.trim().split(/\s+/)[0];
  if (!token) continue;

  while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
  const parent = stack[stack.length - 1].dir;

  const comment = text.slice(text.indexOf(token) + token.length);
  if (token.endsWith('/')) {
    const dir = parent + token;
    stack.push({ indent, dir });
    const inline = comment.match(/\(([^)]*)\)/);
    // `…, html-viewer.css — @import 순서가 캐스케이드, style.css 참조` 같은 꼬리 설명은
    // 첫 `—`에서 절단하고 각 항목의 첫 토큰만 취한다
    const inlineList = inline
      ? inline[1].split('—')[0].split(/[,·]/).map((s) => s.trim().split(/\s+/)[0]).filter((s) => FILE_TOKEN_RE.test(s))
      : null;
    const cnt = comment.match(/(\d+)개/);
    listedDirs.push({
      path: dir, line, comment,
      inlineList: inlineList && inlineList.length ? inlineList : null,
      countClaim: cnt ? Number(cnt[1]) : null,
    });
  } else {
    listedFiles.push({ path: parent + token, line, comment });
  }
}

const issues = [];
const exists = (p) => fs.existsSync(path.join(ROOT, p));

// ① 전 트리 존재성 — 나열된 항목이 실제 있어야 함 (플레이스홀더·"비어 있음" 명시 슬롯 제외)
for (const e of [...listedFiles, ...listedDirs]) {
  if (PLACEHOLDER_RE.test(e.path) || (e.comment && /비어 있음|없을 수 있음/.test(e.comment))) continue;
  if (!exists(e.path.replace(/\/$/, ''))) {
    issues.push(`AGENTS.md:${e.line} — 나열됐지만 실제 없음: ${e.path}`);
  }
}

// ② 전수 디렉토리 역방향 — 실제 파일이 모두 나열됐는지
const listedSet = new Set(listedFiles.map((l) => l.path));
for (const dir of FULL_DIRS) {
  (function walk(d) {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const p = d + e.name;
      if (e.isDirectory()) walk(p + '/');
      else if (!listedSet.has(p)) issues.push(`실제 파일 미기재: ${p} — AGENTS.md 디렉토리 구조에 추가 필요`);
    }
  })(dir);
}

// ③ 인라인 목록 디렉토리 — 주석의 파일 목록 ↔ 실제 직속 파일 집합
for (const d of listedDirs.filter((d) => INLINE_DIRS.includes(d.path))) {
  if (!d.inlineList || !exists(d.path)) continue;
  const actual = fs.readdirSync(path.join(ROOT, d.path)).filter((f) => FILE_TOKEN_RE.test(f));
  const want = new Set(d.inlineList);
  for (const f of actual) if (!want.has(f)) issues.push(`${d.path} 미기재 파일: ${f} — AGENTS.md 인라인 목록에 추가 필요`);
  for (const f of d.inlineList) if (!actual.includes(f)) issues.push(`AGENTS.md:${d.line} — ${d.path} 목록에 있으나 실제 없음: ${f}`);
}

// ④ 개수 표기 — `N개` ↔ 직속 자식 파일 수
for (const d of listedDirs.filter((d) => d.countClaim !== null && exists(d.path))) {
  const n = fs.readdirSync(path.join(ROOT, d.path), { withFileTypes: true }).filter((e) => e.isFile()).length;
  if (n !== d.countClaim) {
    issues.push(`AGENTS.md:${d.line} — ${d.path} 개수 표기 ${d.countClaim}개 ≠ 실제 파일 ${n}개`);
  }
}

// ── box-drawing 트리 검증 (ARCHITECTURE.md 등 — ├──/└── 문법, 존재성만) ──
function* fencedBlocks(docLines) {
  let cur = null;
  for (let i = 0; i < docLines.length; i++) {
    if (/^```/.test(docLines[i])) {
      if (cur) { yield cur; cur = null; } else cur = [];
      continue;
    }
    if (cur) cur.push({ text: docLines[i], line: i + 1 });
  }
}

function checkBoxTree(docRel) {
  const abs = path.join(ROOT, docRel);
  if (!fs.existsSync(abs)) return;
  const docLines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  for (const blockLines of fencedBlocks(docLines)) {
    // 루트 앵커: 코드블록 첫 실질 라인이 `name/` 단독 토큰인 블록만 트리로 간주
    const first = blockLines.find((l) => l.text.trim() !== '');
    if (!first || !/^[\w가-힣.-]+\/\s*(#.*)?$/.test(first.text.trim())) continue;
    if (!blockLines.some((l) => /[├└]──/.test(l.text))) continue;

    const stack = [{ depth: -1, dir: '' }]; // depth = ── 기호 컬럼 / 4
    for (const { text, line } of blockLines) {
      const m = text.match(/[├└]──\s+/);
      if (!m) continue;
      const depth = m.index / 4;
      let name = text.slice(m.index + m[0].length);
      const cut = name.search(/\s{2,}|#/);      // 이름 뒤 공백 2+ 또는 # 주석
      const comment = cut >= 0 ? name.slice(cut) : '';
      name = (cut >= 0 ? name.slice(0, cut) : name).trim();
      if (!name) continue;

      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
      const parent = stack[stack.length - 1].dir;

      for (const tok of name.split(/\s+\/\s+|·/)) { // `.gitignore / .vercelignore`, `a.py · b.py` 병기
        const t = tok.trim();
        if (!t) continue;
        const p = parent + t;
        // 확장자 없는 비디렉토리 토큰(`charts` 등 축약 표기)은 검증 불가 — 플레이스홀더 취급
        if (!t.endsWith('/') && !FILE_TOKEN_RE.test(t)) continue;
        if (t.endsWith('/')) {
          stack.push({ depth, dir: p });
          if (!PLACEHOLDER_RE.test(p) && !/비어 있음|gitignore|없을 수 있음/.test(comment) && !exists(p.slice(0, -1))) {
            issues.push(`${docRel}:${line} — 나열됐지만 실제 없음: ${p}`);
          }
        } else if (!PLACEHOLDER_RE.test(p) && !/비어 있음|gitignore|없을 수 있음/.test(comment) && !exists(p)) {
          issues.push(`${docRel}:${line} — 나열됐지만 실제 없음: ${p}`);
        }
      }
    }
  }
}

for (const d of BOX_TREE_DOCS) checkBoxTree(d);

if (!issues.length) {
  console.log(`✅ 디렉토리 구조 정합 — 나열 ${listedFiles.length}개 파일·${listedDirs.length}개 디렉토리 ↔ 실제 일치`);
  process.exit(0);
}

console.log(`⚠ 디렉토리 구조 불일치 ${issues.length}건:\n`);
for (const i of issues) console.log(`  ✗ ${i}`);
process.exit(1);
