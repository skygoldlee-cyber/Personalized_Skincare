#!/usr/bin/env node
/**
 * check_npm_commands.js — 문서의 npm 명령 인용 ↔ package.json scripts 정합성
 *
 * 양방향 검증:
 *   - 문서(AGENTS.md·README.md·docs/·ref-pipeline/)가 `npm run <x>`로 인용하는
 *     스크립트가 package.json에 실제 존재하는가 (명령어 스테일 탐지)
 *   - package.json의 모든 스크립트가 문서 어딘가에 이름으로 기재됐는가
 *     (npm 호출 형태 또는 백틱·본문 언급 모두 허용)
 *
 * 사용법:
 *   npm.cmd run check:commands         # 단독 실행
 *   npm.cmd run check:docs             # 경로·ID·인벤토리 검증과 연쇄 (본 검사 포함)
 */

// @spec none (문서 명령어 검증)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DOC_FILES = ['AGENTS.md', 'README.md'];
const DOC_DIRS = ['docs', 'ref-pipeline'];

// 스크립트가 아닌 npm 내장 서브커맨드 — 문서에 `npm install` 등이 나와도 스크립트 검증 대상 아님
const NPM_BUILTINS = new Set([
  'install', 'i', 'ci', 'run', 'exec', 'init', 'start', 'stop', 'restart',
  'publish', 'version', 'help', 'audit', 'update', 'uninstall', 'link', 'cache',
]);

// 문서 기재를 요구하지 않는 스크립트:
//   postbuild:data          — npm 라이프사이클 훅 (사용자가 직접 호출하는 명령 아님)
//   build:question-chapters — build:data 내부 단계 (산출물 question_chapters.js로만 문서화)
const UNDOCUMENTED_OK = new Set(['postbuild:data', 'build:question-chapters']);

const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      yield* walk(p);
    } else if (e.name.endsWith('.md')) yield p;
  }
}

const corpus = [];
for (const f of DOC_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)))) corpus.push(path.join(ROOT, f));
for (const d of DOC_DIRS) {
  const abs = path.join(ROOT, d);
  if (fs.existsSync(abs)) corpus.push(...walk(abs));
}

const issues = [];
const corpusText = [];

// ① 문서 → package.json: 인용된 npm 명령이 실제 스크립트인가
const CMD_RE = /npm(?:\.cmd)?\s+(?:run\s+)?([a-zA-Z][\w:-]*)/g;
for (const file of corpus) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  corpusText.push(lines.join('\n'));
  lines.forEach((text, i) => {
    for (const m of text.matchAll(CMD_RE)) {
      const name = m[1];
      if (NPM_BUILTINS.has(name)) continue;
      if (!scripts.includes(name)) {
        issues.push(`${rel}:${i + 1} — package.json에 없는 스크립트 인용: npm run ${name}`);
      }
    }
  });
}
const allText = corpusText.join('\n');

// ② package.json → 문서: 모든 스크립트가 문서 어딘가에 기재됐는가
for (const name of scripts) {
  if (UNDOCUMENTED_OK.has(name)) continue;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(esc + '(?![\\w:-])').test(allText)) {
    issues.push(`package.json — 문서 미기재 스크립트: ${name} (AGENTS.md 명령어 표 등에 기재 필요)`);
  }
}

if (!issues.length) {
  console.log(`✅ npm 명령 정합 — 스크립트 ${scripts.length}개 ↔ 문서 ${corpus.length}개 인용 일치`);
  process.exit(0);
}

console.log(`⚠ npm 명령 불일치 ${issues.length}건:\n`);
for (const i of issues) console.log(`  ✗ ${i}`);
process.exit(1);
