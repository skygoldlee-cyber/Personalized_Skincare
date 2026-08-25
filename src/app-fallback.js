// app-fallback.js - ESM 로드 실패 시 자동 복구 (모바일 PWA 대응)
// app.js가 type="module"로 로드되는데, 의존성 모듈 중 하나라도 네트워크/SW 캐시 실패로
// 로드되지 않으면 app.js 전체가 실행되지 않음 (ESM 정적 import는 실패 시 모듈 단위로 드랍).
// 이 스크립트는 클래식 <script>로 로드되어 app.js와 무관하게 동작하며,
// 초기화 미감지 시 SW 강제 갱신 + 페이지 리로드로 복구한다.
(function () {
  'use strict';
  // NOTE: app.js (ESM, document order상 먼저 실행)가 initApp() 끝에서
  // window.__APP_INITIALIZED = true 로 설정한다. 이 스크립트는 그 후에 실행되므로
  // 값을 덮어쓰지 않아야 한다. undefined도 falsy하므로 초기화 불필요.

  var RELOAD_KEY = '__app_fallback_reloads';
  var MAX_RELOADS = 3;
  var TIMEOUT_MS = 8000;

  function getReloadCount() {
    try { return parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10); }
    catch (e) { return 0; }
  }
  function bumpReloadCount() {
    try { sessionStorage.setItem(RELOAD_KEY, String(getReloadCount() + 1)); }
    catch (e) {}
  }
  function resetReloadCount() {
    try { sessionStorage.removeItem(RELOAD_KEY); }
    catch (e) {}
  }

  // 앱 초기화 성공 시 카운터 리셋 (app.js에서 window.__APP_INITIALIZED = true 설정)
  // 지연 체크: 10초 후에도 true면 정상으로 판단하고 카운터 정리
  setTimeout(function () {
    if (window.__APP_INITIALIZED) resetReloadCount();
  }, 12000);

  setTimeout(function () {
    if (window.__APP_INITIALIZED) return;

    var count = getReloadCount();
    if (count >= MAX_RELOADS) {
      // 최대 리로드 횟수 초과 — 수동 안내 메시지 표시
      showManualRecovery();
      return;
    }

    bumpReloadCount();

    // SW 강제 갱신 시도 후 리로드
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg) {
          reg.update().then(function () {
            window.location.reload();
          }).catch(function () {
            window.location.reload();
          });
        } else {
          // SW 등록이 없으면 직접 등록 후 리로드
          navigator.serviceWorker.register('./sw.js').then(function () {
            window.location.reload();
          }).catch(function () {
            window.location.reload();
          });
        }
      }).catch(function () {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }, TIMEOUT_MS);

  function showManualRecovery() {
    var overlay = document.createElement('div');
    overlay.id = 'app-fallback-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;' +
      'background:var(--bg-main,#0b0f19);color:var(--color-text-main,#e0e0e0);' +
      'font-family:inherit;text-align:center;padding:2rem;gap:1rem;';

    var icon = document.createElement('i');
    icon.className = 'fa-solid fa-triangle-exclamation';
    icon.style.cssText = 'font-size:3rem;color:var(--color-primary,#4f9eff);';

    var title = document.createElement('h2');
    title.textContent = '앱을 불러오지 못했습니다';
    title.style.cssText = 'margin:0;font-size:1.25rem;';

    var desc = document.createElement('p');
    desc.textContent = '네트워크 연결을 확인하고 아래 버튼을 눌러 다시 시도해주세요.';
    desc.style.cssText = 'margin:0;opacity:0.7;max-width:300px;line-height:1.5;';

    var btn = document.createElement('button');
    btn.textContent = '다시 시도';
    btn.style.cssText =
      'margin-top:0.5rem;padding:0.75rem 2rem;font-size:1rem;font-weight:600;' +
      'border:none;border-radius:8px;cursor:pointer;' +
      'background:var(--color-primary,#4f9eff);color:#fff;';
    btn.onclick = function () {
      resetReloadCount();
      window.location.reload();
    };

    overlay.appendChild(icon);
    overlay.appendChild(title);
    overlay.appendChild(desc);
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
  }
})();
