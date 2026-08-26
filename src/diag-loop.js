/* ============================================================
 * src/diag-loop.js  —  리로드 루프/리셋 진단 오버레이 (임시 도구)
 * ------------------------------------------------------------
 * 케이블/원격 디버깅 없이 폰 화면에서 바로 "주기적 리셋"의 정체를 본다.
 *
 * 넣는 법:
 *   index.html <head> 안, pwa-install-capture.js 뒤·app.js(module) 앞에
 *   아래 한 줄을 추가한다(인라인 금지 — CSP script-src 'self' 때문에 외부 파일만 허용):
 *     <script src="./src/diag-loop.js"></script>
 *   (CACHE_VERSION 을 새로 스탬프하거나, 확인 중에는 DevTools 없이도 보이도록
 *    배포만 하면 된다. SHELL_ASSETS 에 넣을 필요는 없다 — 온라인에서 fetch 됨.)
 *
 * 읽는 법(우하단 박스):
 *   PL   = 이 세션에서 페이지가 로드된 횟수 (sessionStorage 누적)
 *   Δt   = 직전 로드로부터 경과 초 — 이 값이 몇 초마다 리셋되며 PL 이 계속
 *          오르면 "리로드 루프" 확정. Δt 가 곧 루프 주기.
 *   CC   = 이 로드 이후 발생한 controllerchange 횟수
 *   init = __APP_INITIALIZED 까지 걸린 ms (또는 pending)
 *   nav  = .nav-item / .mobile-tab-item 개수 (0 이면 메뉴 노드 자체가 없음)
 *   SW   = controller/waiting/active 상태
 *   from = 이번 로드를 유발한 것으로 추정되는 출처(아래 판정)
 *
 * 판정 가이드:
 *   - PL 이 몇 초마다 증가 + CC>=1 매 사이클  → controllerchange 리로드 루프
 *     (pwa-install-capture.js). 예전 코드엔 없던 회귀일 가능성 큼.
 *   - PL 증가 + 콘솔에 [fallback] 데드라인…    → app-fallback watchdog 리로드
 *     (init 이 15s 넘게 pending 인 로드에서 발생).
 *   - PL 이 안 오르는데 메뉴만 무반응 + nav>0  → 리로드 아님. 오버레이/포인터
 *     이벤트 가림 등 별개 원인.
 *
 * 확인 끝나면 index.html 에서 <script> 한 줄만 지우면 완전히 제거된다.
 * 순수 관찰용(읽기 전용): 리로드/등록을 유발하지 않는다.
 * 의존성 없음.
 * ============================================================ */
(function () {
  'use strict';

  var NAV_START = (performance && performance.now) ? performance.now() : Date.now();
  var LS = 'diag_loop_v1';
  var prev = null;
  try { prev = JSON.parse(sessionStorage.getItem(LS) || 'null'); } catch (e) {}

  var now = Date.now();
  var loadCount = (prev && prev.loadCount ? prev.loadCount : 0) + 1;
  var deltaSincePrev = prev && prev.lastLoadAt ? Math.round((now - prev.lastLoadAt) / 100) / 10 : null;

  try {
    sessionStorage.setItem(LS, JSON.stringify({ loadCount: loadCount, lastLoadAt: now }));
  } catch (e) {}

  var ccCount = 0;
  var initMs = null;
  var reg = null;

  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        ccCount++;
        render();
      });
      navigator.serviceWorker.getRegistration().then(function (r) { reg = r || null; render(); }).catch(function () {});
    } catch (e) {}
  }

  function guessFrom() {
    if (deltaSincePrev === null) return '최초 로드';
    if (deltaSincePrev <= 40 && loadCount >= 2) {
      if (ccCount >= 1) return '루프 의심: controllerchange';
      return '루프 의심: watchdog/기타 (콘솔 [fallback] 확인)';
    }
    return '수동/정상';
  }

  function swState() {
    var c = (navigator.serviceWorker && navigator.serviceWorker.controller) ? 'ctrl✓' : 'ctrl✗';
    var w = reg && reg.waiting ? ' waiting✓' : '';
    var a = reg && reg.active ? ' active✓' : '';
    return c + w + a;
  }

  function navCounts() {
    try {
      var side = document.querySelectorAll('.nav-item').length;
      var tab = document.querySelectorAll('.mobile-tab-item').length;
      return side + '/' + tab;
    } catch (e) { return '?/?'; }
  }

  var box;
  function ensureBox() {
    if (box) return box;
    box = document.createElement('div');
    box.id = 'diag-loop-box';
    box.style.cssText = [
      'position:fixed', 'right:6px', 'bottom:6px', 'z-index:2147483647',
      'background:rgba(17,24,39,0.92)', 'color:#e5e7eb', 'font:11px/1.5 monospace',
      'padding:8px 10px', 'border:1px solid #f59e0b', 'border-radius:8px',
      'max-width:78vw', 'white-space:pre', 'pointer-events:auto', 'box-shadow:0 2px 10px rgba(0,0,0,.4)'
    ].join(';');
    box.title = '탭하면 카운터 리셋 · 두 번 탭 숨김';
    var taps = 0, tapTimer = null;
    box.addEventListener('click', function () {
      taps++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function () {
        if (taps >= 2) { box.style.display = 'none'; }
        else { try { sessionStorage.removeItem(LS); } catch (e) {} location.reload(); }
        taps = 0;
      }, 250);
    });
    if (document.body) document.body.appendChild(box);
    else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(box); });
    return box;
  }

  function render() {
    if (initMs === null && window.__APP_INITIALIZED) {
      initMs = Math.round(((performance && performance.now) ? performance.now() : Date.now()) - NAV_START);
    }
    var b = ensureBox();
    b.textContent =
      'DIAG  PL=' + loadCount +
      '  Δt=' + (deltaSincePrev === null ? '-' : deltaSincePrev + 's') +
      '  CC=' + ccCount + '\n' +
      'init=' + (initMs === null ? 'pending' : initMs + 'ms') +
      '  nav=' + navCounts() + '\n' +
      'SW=' + swState() + '\n' +
      'from=' + guessFrom();
  }

  // __APP_INITIALIZED 도달 폴링(관찰만)
  var polls = 0;
  var t = setInterval(function () {
    polls++;
    render();
    if (window.__APP_INITIALIZED || polls > 120) clearInterval(t); // 최대 ~60s
  }, 500);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
