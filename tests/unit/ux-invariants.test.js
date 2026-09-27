// tests/unit/ux-invariants.test.js — UI/UX 설계 요구사항 (정적 검증)
// @spec UX-FB-01~04,UX-FORM-01~02,UX-PWA-01~05,UX-SCR-01~03,UX-SET-01~05
// CSS 규칙·마크업 구조·JS 구현 패턴이 설계 요구사항을 유지하는지 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf-8');
const indexHtml = read('index.html');
const baseCss = read('css/base.css');
const overlayCss = read('css/ui-overlay.css');
const allCss = readdirSync(join(ROOT, 'css'))
  .filter(f => f.endsWith('.css'))
  .map(f => read(`css/${f}`)).join('\n');
const appJs = read('src/app.js');
const uiUtils = read('src/ui-utils.js');
const pwaInstall = read('src/pwa-install.js');
const capture = read('src/pwa-install-capture.js');
const readerJs = read('src/views/textbook-reader.js');
const listeners = read('src/views/event-listeners.js');

// ---------- UX-SCR: 스크롤바 전략 ----------

test('UX-SCR-01: 터치/모바일 환경에서 스크롤바를 완전히 숨긴다 (pointer+폭 병기)', () => {
  assert.ok(/@media\s*\(pointer:\s*coarse\)\s*,\s*\(max-width:\s*900px\)/.test(baseCss),
    'pointer:coarse와 max-width:900px 병기 필수 (단독 pointer 감지 실패 대응)');
  const block = baseCss.match(/@media\s*\(pointer:\s*coarse\)[\s\S]{0,400}/);
  assert.ok(block[0].includes('scrollbar-width: none'), 'Firefox 스크롤바 숨김');
  assert.ok(block[0].includes('::-webkit-scrollbar'), 'WebKit 스크롤바 숨김');
});

test('UX-SCR-02: scrollbar-width가 html이 아닌 전체/컨테이너 선택자에 적용된다', () => {
  // 모바일 숨김 블록이 * 선택자에 적용돼야 내부 스크롤 컨테이너까지 커버
  const block = baseCss.match(/@media\s*\(pointer:\s*coarse\)[\s\S]{0,300}/);
  assert.ok(/\*\s*\{[^}]*scrollbar-width/.test(block[0]), '* 선택자에 scrollbar-width 지정');
});

test('UX-SCR-03: 커스텀 스크롤바 색상이 CSS 변수를 사용한다', () => {
  assert.ok(/::-webkit-scrollbar-thumb\s*\{[^}]*var\(--scrollbar-thumb\)/.test(baseCss),
    'thumb에 var(--scrollbar-thumb) 사용');
  assert.ok(baseCss.includes('--scrollbar-thumb:'), '테마 변수 정의');
  assert.ok(baseCss.includes('--bg-subtle'), '트랙 변수 정의');
});

// ---------- UX-SET: 설정 메뉴 패턴 ----------

test('UX-SET-01: 설정 패널이 그룹 라벨(계정/데이터/보기·도구/앱)로 조직된다', () => {
  for (const label of ['계정', '데이터', '보기', '앱']) {
    assert.ok(indexHtml.includes(`settings-group-label">${label}`) ||
      new RegExp(`settings-group-label[^>]*>${label}`).test(indexHtml),
      `그룹 라벨 '${label}' 없음`);
  }
  assert.ok(indexHtml.includes('id="settings-panel"'), '설정 패널 존재');
  assert.ok(indexHtml.includes('settings-divider') || indexHtml.includes('settings-group-label'),
    '구분선/그룹 구조');
});

test('UX-SET-02: 설정 패널이 max-height + 내부 스크롤을 갖는다', () => {
  const panel = baseCss.match(/\.settings-panel\s*\{[\s\S]*?\}/);
  assert.ok(panel, '.settings-panel 규칙');
  assert.ok(/max-height:\s*calc\(100dvh\s*-\s*5rem\)/.test(panel[0]), 'max-height 뷰포트 제한');
  assert.ok(/overflow-y:\s*auto/.test(panel[0]), '내부 스크롤');
});

test('UX-SET-03: 설정 항목의 최소 터치 타겟이 44px이다', () => {
  const item = baseCss.match(/\.settings-item\s*\{[\s\S]*?\}/);
  assert.ok(item, '.settings-item 규칙');
  assert.ok(/min-height:\s*44px/.test(item[0]), 'min-height 44px');
});

test('UX-SET-04: 버전 표기가 설정 패널 하단에 있다', () => {
  assert.ok(indexHtml.includes('id="settings-version"'), '설정 패널 버전 스팬');
  assert.ok(appJs.includes('settings-version'), '버전 값 주입 코드');
});

test('UX-SET-05: 항목 선택·외부 클릭·Escape로 설정 패널이 닫힌다', () => {
  assert.ok(/settings-item.*closeSettings|closeSettings\(\)/.test(listeners), '항목 클릭 시 닫힘');
  assert.ok(/Escape/.test(listeners), 'Escape 닫힘');
  assert.ok(/settings-menu/.test(listeners) && /closeSettings/.test(listeners), '외부 클릭 닫힘');
});

// ---------- UX-FB: 피드백·알림 ----------

test('UX-FB-01: 토스트가 모바일에서 하단(탭 바 위)에 배치된다', () => {
  const block = overlayCss.match(/@media\s*\(max-width:\s*768px\)[\s\S]{0,500}#app-toast\s*\{[^}]+\}/);
  assert.ok(block, '모바일 토스트 규칙');
  assert.ok(/top:\s*auto/.test(block[0]), '중앙 해제');
  assert.ok(/bottom:\s*calc\(80px/.test(block[0]), '하단 탭 바 위 배치');
});

test('UX-FB-02: 네이티브 alert/confirm 대신 커스텀 모달 API가 존재한다', () => {
  assert.ok(/export function showConfirm/.test(uiUtils), 'showConfirm');
  assert.ok(/export function showAlert/.test(uiUtils), 'showAlert');
  assert.ok(/export function showToast/.test(uiUtils), 'showToast');
});

test('UX-FB-02: 소스에 네이티브 alert()/confirm() 호출이 없다', () => {
  const srcDir = join(ROOT, 'src');
  const files = [srcDir, join(srcDir, 'views'), join(srcDir, 'config')]
    .flatMap(d => readdirSync(d).filter(f => f.endsWith('.js')).map(f => join(d, f)));
  for (const f of files) {
    const src = readFileSync(f, 'utf-8');
    const bad = src.match(/(?<![\w.])alert\s*\(|(?<![\w.])confirm\s*\(/g) || [];
    assert.deepEqual(bad, [], `${f}: 네이티브 alert/confirm 호출`);
  }
});

test('UX-FB-03: 숨겨진 기능의 최초 펄스가 1회 플래그 + animationend 해제를 사용한다', () => {
  assert.ok(/is-attention/.test(readerJs), '펄스 클래스');
  assert.ok(/animationend/.test(readerJs), 'animationend 해제');
  assert.ok(/ui_toc_hint_seen|_seen/.test(readerJs), 'localStorage 1회 플래그');
});

test('UX-FB-04: 전역 로딩 오버레이가 있다', () => {
  assert.ok(/export function showGlobalLoading/.test(uiUtils), 'showGlobalLoading');
  assert.ok(/export function hideGlobalLoading/.test(uiUtils), 'hideGlobalLoading');
});

// ---------- UX-PWA: PWA 고유 UX ----------

test('UX-PWA-01: 앱 종료가 close() → back() → 안내 화면 2단 구조다', () => {
  assert.ok(/window\.close\(\)/.test(appJs), 'window.close() 시도');
  assert.ok(/history\.back\(\)/.test(appJs), 'history.back() 폴백');
  assert.ok(/app-exit-screen/.test(appJs), '종료 안내 화면');
  assert.ok(/pointer:\s*coarse|maxTouchPoints/.test(appJs), '터치 환경에서만 모바일 안내');
});

test('UX-PWA-02: standalone 감지가 matchMedia + navigator.standalone 병용이다', () => {
  assert.ok(/display-mode:\s*standalone/.test(pwaInstall), 'matchMedia standalone');
  assert.ok(/navigator\.standalone/.test(pwaInstall), 'iOS navigator.standalone');
});

test('UX-PWA-03: SW 업데이트 사용자 안내(토스트)가 존재한다', () => {
  assert.ok(/sw-update-toast/.test(capture), '업데이트 토스트');
  assert.ok(/업데이트|새 버전/.test(capture), '안내 문구');
});

test('UX-PWA-04: 설치 버튼 표시가 beforeinstallprompt 캡처 여부로 게이트된다', () => {
  assert.ok(capture.includes('beforeinstallprompt'), '프롬프트 캡처');
  // deferredPrompt 존재 시에만 표시(remove is-hidden), standalone/미캡처는 숨김
  assert.ok(/deferredPrompt\s*&&\s*installBtn[\s\S]{0,80}remove\('is-hidden'\)/.test(pwaInstall),
    '캡처 후에만 표시');
  assert.ok(/installBtn\.classList\.add\('is-hidden'\)/.test(pwaInstall), '비대상 상태 숨김');
  // 설치 완료(appinstalled) 후 자동 숨김
  assert.ok(/appinstalled|is-hidden/.test(capture) || /appinstalled/.test(pwaInstall), '설치 후 숨김 처리');
});

test('UX-PWA-05: 앱 셸 높이가 JS 실측 --app-height를 사용한다', () => {
  assert.ok(/--app-height/.test(appJs), 'JS 측정 변수 설정');
  assert.ok(/innerHeight|visualViewport/.test(appJs), '실측 소스');
  assert.ok(/var\(--app-height,\s*100dvh\)/.test(allCss), 'CSS 폴백 var(--app-height, 100dvh)');
});

// ---------- UX-FORM: 폼·입력 ----------

test('UX-FORM-01: 표준 입력 클래스(.form-input)의 font-size가 16px 이상이다 (iOS 줌 방지)', () => {
  const rules = allCss.match(/\.form-input\s*\{[^}]+\}/g) || [];
  assert.ok(rules.length > 0, '.form-input 규칙 존재');
  const withFs = rules.filter(r => /font-size:/.test(r));
  assert.ok(withFs.length > 0, '.form-input font-size 명시 (상속이 16px 미만일 수 있음)');
  for (const rule of withFs) {
    const val = rule.match(/font-size:\s*([^;]+)/)[1].trim();
    assert.ok(
      /16px|1rem|--text-1rem|--text-md\b/.test(val),
      `.form-input font-size 16px 미만: ${val}`
    );
  }
});

test('UX-FORM-02: 터치 피드백(:active scale)이 인터랙티브 요소에 적용된다', () => {
  const scales = allCss.match(/:active[^}]*transform:\s*scale\(0\.9[2-8]/g) || [];
  assert.ok(scales.length >= 2, `:active scale 규칙 부족 (${scales.length})`);
});
