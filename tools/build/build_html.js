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
 * 편집 규칙: 뷰 마크업은 html/views/*.html을 편집하고
 * `npm run build:html`로 index.html을 재생성한다. index.html 직접 편집 금지.
 *
 * --check: index.html을 재생성 결과와 바이트 비교 (조립 누락/드리프트 탐지)
 * @spec S-01
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATE = path.join(ROOT, 'index.template.html');
const OUTPUT = path.join(ROOT, 'index.html');
const PARTIAL_DIR = path.join(ROOT, 'html', 'views');

const MARKER_RE = /^([ \t]*)<!--\s*@include\s+(\S+)\s*-->[ \t]*(\r?\n)/gm;

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
  return out;
}

const isCheck = process.argv.includes('--check');
const generated = build();

if (isCheck) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : null;
  if (current === generated) {
    console.log('✅ index.html이 최신 조립 상태입니다');
  } else {
    console.error('❌ index.html이 파셜/템플릿과 불일치 — npm run build:html 실행 필요');
    process.exit(1);
  }
} else {
  fs.writeFileSync(OUTPUT, generated);
  console.log(`✅ index.html 생성 — ${generated.split('\n').length}줄`);
}
