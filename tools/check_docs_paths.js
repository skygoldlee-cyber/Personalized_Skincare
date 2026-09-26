#!/usr/bin/env node
/**
 * check_docs_paths.js — 문서 내 경로 참조의 실존 검증
 *
 * docs/, AGENTS.md, README.md, ref-pipeline/ 의 마크다운 문서에 백틱(`) 또는
 * 마크다운 링크로 인용된 저장소 경로가 실제로 존재하는지 검사한다.
 * 디렉터리 이동/파일 삭제 후 문서에 남는 스테일 참조를 자동 탐지한다.
 *
 * 사용법:
 *   npm.cmd run check:docs          # 전체 검증 (실패 시 exit 1)
 *   node tools/check_docs_paths.js  # 직접 실행
 *
 * 범위/예외:
 *   - 인라인 코드 `path/to/x` 토큰 (저장소 루트 접두사로 시작하는 것만)
 *   - 마크다운 링크 [x](상대경로) — 문서 파일 기준 상대경로 해석
 *   - docs/report_archive/·docs/dev/CHANGES.md = 이력 영역이라 검사 제외
 *   - 플레이스홀더(<id>, {과목}, *, xxx, ... 등)는 구체 접두사까지만 검증
 *   - 의도된 미래 파일 등 예외는 tools/docs_paths_allowlist.json에 등록
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 검사 대상 문서
const DOC_DIRS = ['docs', 'ref-pipeline'];
const DOC_FILES = ['AGENTS.md', 'README.md'];
const EXCLUDE_DIRS = [path.join('docs', 'report_archive')];
const EXCLUDE_FILES = [path.join('docs', 'dev', 'CHANGES.md')];

// 저장소 루트 기준 경로로 보이는 토큰의 접두사
const ROOT_PREFIXES = [
  'src/', 'tools/', 'content/', 'data/', 'ref-pipeline/',
  'docs/', 'tests/', 'vendor/',
];
const ROOT_FILES = new Set([
  'sw.js', 'index.html', 'serve.js', 'package.json', 'package-lock.json',
  'manifest.webmanifest', 'vercel.json', '.vercelignore', '.gitignore',
  'AGENTS.md', 'README.md', 'style.css', 'pdf_hashes.json', 'vitest.config.js',
]);

// 플레이스홀더 → 구체 경로 대체
const SUBSTITUTIONS = [
  [/EXAM_CONTENT_ROOT|\{EXAM_CONTENT_ROOT\}|\{EXAM\}|\{contentRoot\}|<root>|\{root\}/g, 'content/exams/cosmetic'],
  [/\{dataRoot\}|<dataRoot>/g, 'data/exams/cosmetic'],
  [/<examId>|<id>|\{id\}|\{examId\}/g, 'cosmetic'],
  [/<과목키>|\{과목키\}|\{과목\}|\{key\}|<key>/g, '*'],
  [/과목N|과목\d|subjectN|subject\d|\{문서\}|\{파일명\}|\{doc\}|\{stem\}|NNNN|\{hash\}|\{version\}|\{과목N\}/g, '*'],
];

const WILDCARD_RE = /[*<>{}…]|\.{3}|xxx/i;
const CODE_SPAN_RE = /`([^`\n]+)`/g;
const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;
const LINE_REF_RE = /:\d[\d,\-]*$/;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

function docFiles() {
  const files = DOC_FILES.filter(f => fs.existsSync(path.join(ROOT, f)))
    .map(f => path.join(ROOT, f));
  for (const d of DOC_DIRS) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    files.push(...walk(abs));
  }
  return files.filter(f => {
    const rel = path.relative(ROOT, f);
    return !EXCLUDE_DIRS.some(ex => rel.startsWith(ex + path.sep)) &&
      !EXCLUDE_FILES.includes(rel);
  });
}

function looksLikePath(tok) {
  if (ROOT_FILES.has(tok)) return true;
  return ROOT_PREFIXES.some(p => tok.startsWith(p));
}

function normalize(tok) {
  tok = tok.replace(/\\/g, '/').replace(/^\.?\//, '');
  tok = tok.replace(/[#?].*$/, '');
  tok = tok.replace(/["'()\[\],;:!]+$/g, '').replace(/^["'()\[\],;:!]+/g, '');
  tok = tok.replace(LINE_REF_RE, '');   // file.js:123 / file.js:10-20 / file.js:1,2
  return tok;
}

function resolveRef(raw) {
  let p = normalize(raw);
  for (const [re, rep] of SUBSTITUTIONS) p = p.replace(re, rep);
  return p;
}

/** 존재 여부: 와일드카드/플레이스홀더가 있으면 구체 접두사 디렉터리만 확인 */
function exists(ref) {
  if (!WILDCARD_RE.test(ref)) return fs.existsSync(path.join(ROOT, ref));
  const parts = ref.split('/');
  let concrete = [];
  for (const part of parts) {
    if (WILDCARD_RE.test(part) || part === '*') break;
    concrete.push(part);
  }
  const prefix = concrete.join('/');
  if (!prefix) return true; // 전부 와일드카드면 검사 불가 — 통과
  const abs = path.join(ROOT, prefix);
  return fs.existsSync(abs);
}

// 의도적 참조(미래 파일·설명용 예시) 허용 목록
const allowlistPath = path.join(ROOT, 'tools', 'docs_paths_allowlist.json');
const ALLOWLIST = fs.existsSync(allowlistPath)
  ? JSON.parse(fs.readFileSync(allowlistPath, 'utf8'))
  : [];
function isAllowed(file, ref) {
  return ALLOWLIST.some(a => {
    if (a.file && a.ref) return file === a.file && ref === a.ref;
    if (a.file) return file === a.file;
    return ref === a.ref;
  });
}

function findIssues(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  const issues = [];

  // ① 인라인 코드 토큰 — 저장소 루트 접두사로 시작하는 것
  for (const m of text.matchAll(CODE_SPAN_RE)) {
    for (const tok of m[1].split(/\s+/)) {
      const ref = resolveRef(tok);
      if (looksLikePath(ref) && !exists(ref) && !isAllowed(rel, tok)) {
        issues.push({ kind: 'code', ref: tok, resolved: ref });
      }
    }
  }

  // ② 마크다운 링크 — 상대경로, 경로처럼 보이는 것만 (http/mailto/#/플레이스홀더 제외)
  for (const m of text.matchAll(MD_LINK_RE)) {
    const link = m[1];
    if (/^([a-z]+:|#|mailto)/i.test(link)) continue;
    if (WILDCARD_RE.test(link)) continue;
    const target = link.split('#')[0].split('?')[0];
    if (!target) continue;
    if (!target.includes('/') && !/\.(md|html?|json|js|py|css)$/i.test(target)) continue;
    // `/docs/...` 등 슬래시 시작 = 저장소 루트 기준 (앱 URL 스타일 경로)
    const abs = target.startsWith('/')
      ? path.join(ROOT, decodeURIComponent(target))
      : path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!fs.existsSync(abs) && !isAllowed(rel, link)) {
      issues.push({ kind: 'link', ref: link });
    }
  }

  return issues.map(i => ({ file: rel, ...i }));
}

const files = docFiles();
const allIssues = files.flatMap(findIssues);

if (!allIssues.length) {
  console.log(`✅ 문서 경로 검증 통과 — ${files.length}개 문서, 스테일 참조 없음`);
  process.exit(0);
}

console.log(`⚠ 스테일 경로 참조 ${allIssues.length}건 발견:\n`);
const byFile = {};
for (const i of allIssues) (byFile[i.file] ??= []).push(i);
for (const [file, issues] of Object.entries(byFile)) {
  console.log(` ${file}`);
  for (const i of issues) {
    console.log(`   ✗ ${i.kind === 'link' ? '링크' : '코드'}: ${i.ref}` +
      (i.resolved && i.resolved !== i.ref ? `  (→ ${i.resolved})` : ''));
  }
}
console.log(`\n${Object.keys(byFile).length}개 문서에서 ${allIssues.length}건 — 파일 이동/삭제 후 문서 갱신이 필요합니다.`);
console.log(`의도된 참조라면 tools/docs_paths_allowlist.json에 등록하세요.`);
process.exit(1);
