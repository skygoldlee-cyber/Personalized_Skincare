#!/usr/bin/env node
/* ============================================================
 * tools/build/build_html.js
 * ------------------------------------------------------------
 * index.template.html + html/views/*.html 파셜 → index.html 조립.
 *
 * 마커 규약 (템플릿의 한 라인 전체):
 *   <!-- @include html/views/<name>.html -->
 * 해당 라인이 파셜 파일 내용으로 통째로 치환된다 (들여쓰기는 파셜이 보유).
 *
 * 토큰 규약:
 *   __EXAM_DATA_ROOT__ — content/exams.json의 default(또는 첫) 시험의
 *   dataRoot로 치환된다 (기본 시험 프리로드 번들 경로용).
 *
 * 편집 규칙: 뷰 마크업은 html/views/*.html을 편집하고
 * `npm run build:html`로 index.html을 재생성한다. index.html 직접 편집 금지.
 *
 * --check: index.html을 재생성 결과와 비교 — 개행(CRLF/LF) 정규화 후 내용 비교
 *   (Windows autocrlf 등에서 작업트리 개행 혼용으로 인한 드리프트 오탐 방지)
 * @spec S-01
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATE = path.join(ROOT, 'index.template.html');
const OUTPUT = path.join(ROOT, 'index.html');
const PARTIAL_DIR = path.join(ROOT, 'html', 'views');
const EXAMS_JSON = path.join(ROOT, 'content', 'exams.json');

const MARKER_RE = /^([ \t]*)<!--\s*@include\s+(\S+)\s*-->[ \t]*(\r?\n)/gm;

/** content/exams.json의 기본 시험 dataRoot (default 플래그 → 첫 항목) */
function defaultExamDataRoot() {
  const exams = (JSON.parse(fs.readFileSync(EXAMS_JSON, 'utf-8')).exams) || [];
  const def = exams.find(e => e.default) || exams[0];
  if (!def || !def.dataRoot) {
    console.error('❌ exams.json에서 기본 시험 dataRoot를 해석할 수 없습니다');
    process.exit(1);
  }
  return def.dataRoot;
}

function build() {
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  const missing = [];
  const referenced = new Set();
  const out = tpl.replace(MARKER_RE, (m, _indent, rel) => {
    referenced.add(path.normalize(rel));
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) {
      missing.push(rel);
      return m;
    }
    return fs.readFileSync(file, 'utf8');
  });
  let resolved = out;
  if (resolved.includes('__EXAM_DATA_ROOT__')) {
    resolved = resolved.split('__EXAM_DATA_ROOT__').join(defaultExamDataRoot());
  }
  if (missing.length) {
    console.error(`❌ include 대상 없음: ${missing.join(', ')}`);
    process.exit(1);
  }
  // 파셜이 있는데 템플릿에 include되지 않은 경우 경고 (고아 파셜)
  if (fs.existsSync(PARTIAL_DIR)) {
    const orphans = fs.readdirSync(PARTIAL_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => path.normalize(path.join('html', 'views', f)))
      .filter(f => !referenced.has(f));
    if (orphans.length) {
      console.warn(`⚠️  템플릿에 include되지 않은 파셜: ${orphans.join(', ')}`);
    }
  }
  return resolved;
}

const isCheck = process.argv.includes('--check');
const generated = build();

if (isCheck) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : null;
  const normEol = (s) => s.replace(/\r\n/g, '\n');
  if (current !== null && normEol(current) === normEol(generated)) {
    console.log('✅ index.html이 최신 조립 상태입니다');
  } else {
    console.error('❌ index.html이 파셜/템플릿과 불일치 — npm run build:html 실행 필요');
    process.exit(1);
  }
} else {
  fs.writeFileSync(OUTPUT, generated);
  console.log(`✅ index.html 생성 — ${generated.split('\n').length}줄`);
}
