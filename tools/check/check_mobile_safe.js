#!/usr/bin/env node
/**
 * check_mobile_safe.js — 모바일 잘림 안전 규약 정적 검사 (UX-VFY-06)
 *
 * E2E 오버플로 스윕(mobile-overflow.spec.js)이 런타임 실측을 담당한다면,
 * 이 검사는 커밋 전 정적 패턴으로 신규 위반을 조기 차단한다:
 *
 *   ① .dialog-card 계약 — css/base.css에 규약 클래스가 max-height+overflow와
 *      함께 정의돼 있는지. role="dialog"/"alertdialog" 카드 마크업(html·JS
 *      템플릿)이 .dialog-card(또는 자체 스크롤 계약이 있는 예외 목록)를 갖는지.
 *   ② 버튼 행 줄바꿈 — 컨테이너 div가 flex-row/flex-center로 버튼 2개 이상을
 *      나열하면서 flex-wrap/btn-row 계열이 없으면 위반. 의도된 nowrap은
 *      data-msafe-ok 속성으로 명시적 면제한다.
 *
 * 허용 목록 — 자체 뷰포트 상한+스크롤 계약이 이미 있는 대화상자 구조:
 *   - .more-sheet-panel        (72vh 상한 + .more-sheet-scroll 본문)
 *   - .reader-table-modal-content (85vh + overflow:auto — .dialog-card 병기됨)
 *   - #exam-overlay / doc-overlay 셸 (flex column + 전용 스크롤 영역)
 *   - #html-ref-overlay        (hr-ov-scroll 전용 스크롤 영역)
 *   - #app-fallback-overlay    (인라인 스타일 부트 스트랩, 단문 내용)
 *
 * 사용법:
 *   npm.cmd run check:mobilesafe   # 단독 실행
 */

// @spec UX-VFY-06
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/* role="dialog" 요소 자체·카드에 붙지 않아도 되는 예외 — 자체 스크롤 계약 보유 */
const DIALOG_EXEMPT_CLASSES = new Set([
  'more-sheet', 'more-sheet-panel', 'reader-table-modal',
  'exam-overlay', 'doc-overlay', 'html-ref-overlay', 'app-fallback-overlay',
  'f-weigh-overlay', // 오버레이(배경) 측 — 카드 .f-weigh-card가 dialog-card 보유
]);

/* ②에서 버튼 2+ 나열을 허용하는 행 클래스 — 자체 줄바꿈/분할 규칙 보유 */
const ROW_EXEMPT_CLASSES = [
  'flex-wrap', 'btn-row', 'dict-search-row', 'flex-btns', 'grid-btns',
  'more-sheet-grid', 'flex-col', 'flex-between', 'formula-biz-bar',
  'auth-pw-row', 'f-weigh-foot', 'cing-foot', 'app-confirm-actions',
  'calc-scratchpad-header', 'review-item-header',
];

const issues = [];

/* ── ① .dialog-card 규약 클래스 존재 ─────────────────────────── */
const baseCss = fs.readFileSync(path.join(ROOT, 'css/base.css'), 'utf8');
const cardRule = baseCss.match(/\.dialog-card\s*\{([^}]*)\}/);
if (!cardRule) {
  issues.push('css/base.css — .dialog-card 규약 클래스가 없습니다');
} else if (!/max-height/.test(cardRule[1]) || !/overflow/.test(cardRule[1])) {
  issues.push('css/base.css — .dialog-card에 max-height + overflow가 필요합니다 (UX-FB-06)');
}

/* ── role="dialog" 카드의 .dialog-card 클래스 ─────────────────── */
function* walk(dir, exts) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, exts);
    else if (exts.includes(path.extname(e.name))) yield p;
  }
}

// 실제 열린 태그 안의 role="dialog"만 매칭 — 셀렉터 문자열('[role="dialog"]')·
// 주석 텍스트는 <tag 형태가 아니라 자동 배제된다
const DIALOG_RE = /<[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?role="(?:alert)?dialog"[^<>]*>/g;
let dialogScanned = 0;

function scanDialogs(file, rel) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(DIALOG_RE)) {
    dialogScanned++;
    const tag = m[0];
    const cls = tag.match(/class="([^"]*)"/)?.[1] || '';
    const lookahead = src.slice(m.index, m.index + 600);
    if (cls.split(/\s+/).some(c => DIALOG_EXEMPT_CLASSES.has(c))) continue;
    if (cls.includes('dialog-card') || lookahead.includes('dialog-card')) continue;
    issues.push(`${rel} — role="dialog" 카드에 .dialog-card 클래스가 없습니다 (line ~${src.slice(0, m.index).split('\n').length})`);
  }
}

for (const entry of [path.join(ROOT, 'src'), path.join(ROOT, 'html')]) {
  for (const file of walk(entry, ['.js', '.html'])) {
    scanDialogs(file, path.relative(ROOT, file).replace(/\\/g, '/'));
  }
}
// index.template.html은 html/ 밖에 있으므로 별도 스캔
if (fs.existsSync(path.join(ROOT, 'index.template.html'))) {
  scanDialogs(path.join(ROOT, 'index.template.html'), 'index.template.html');
}

/* ── ② 버튼 2+ nowrap 행 ─────────────────────────────────────── */
// <div|nav|section|header|footer|span ... class="...flex-row|flex-center...">
// 태그부터 같은 깊이의 첫 </div> 계열 닫힘까지(최대 20줄) <button 개수 집계
const ROW_RE = /<(div|nav|section|header|footer|span)[^>]*class="([^"]*)"/g;
let rowScanned = 0;

for (const file of walk(path.join(ROOT, 'html'), ['.html'])) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(ROW_RE)) {
      const cls = m[2];
      if (!/\b(flex-row|flex-center)\b/.test(cls)) continue;
      if (ROW_EXEMPT_CLASSES.some(c => cls.includes(c))) continue;
      if (/data-msafe-ok/.test(line)) continue;
      // 태그 안에 data-msafe-ok가 다음 속성으로 올 수 있으니 태그 끝까지 확인
      const tagRest = line.slice(m.index);
      if (/data-msafe-ok/.test(tagRest.split('>')[0] || '')) continue;
      // 태그 위치부터 같은 깊이의 닫힘까지(최대 20줄) <button 개수 집계
      let buttons = 0, depth = 0, j = i;
      for (; j < Math.min(i + 20, lines.length); j++) {
        const seg = j === i ? lines[j].slice(m.index) : lines[j];
        const opens = (seg.match(/<div\b/g) || []).length;
        const closes = (seg.match(/<\/div>/g) || []).length;
        buttons += (seg.match(/<button\b/g) || []).length;
        depth += opens - closes;
        if (j > i && depth <= 0) break;
        if (j === i && depth <= 0 && opens === 0) break;
      }
      rowScanned++;
      if (buttons >= 2) {
        issues.push(`${rel}:${i + 1} — 버튼 ${buttons}개를 나열한 nowrap 행 (.${cls.split(' ')[0]}) — flex-wrap·btn-row 또는 data-msafe-ok 필요`);
      }
    }
  }
}

if (issues.length) {
  console.error('✗ 모바일 안전 규약 위반:');
  for (const s of issues) console.error('  - ' + s);
  process.exit(1);
}
console.log(`✅ 모바일 안전 규약 통과 — 다이얼로그 ${dialogScanned}곳·버튼 행 ${rowScanned}곳 검사, 위반 0건`);
