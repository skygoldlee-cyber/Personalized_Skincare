// app-fallback.js - ESM 로드 실패 시 자동 복구 (모바일 PWA 대응)
//
// app.js는 type="module"(deferred)로 로드되며, 의존성 모듈 중 하나라도
// 네트워크/SW 캐시 실패로 로드되지 않으면(ESM 정적 import는 실패 시 그래프 전체가 드랍)
// app.js가 아예 실행되지 않아 화면이 비거나 "앱을 불러오지 못했습니다"가 된다.
//
// 이 스크립트는 클래식 <script>로 로드되어 app.js와 독립 실행되며:
//   1) 정상 초기화(window.__APP_INITIALIZED)를 폴링으로 감지 → 되면 즉시 종료(오탐 방지)
//   2) 데드라인까지 초기화가 없으면 단계적 복구:
//        - 1차: SW update + reload (일시적 네트워크 문제 대응)
//        - 2차 이후: 캐시 전체 삭제 + SW 해제 후 reload
//          (구버전 모듈이 캐시에 남아 새 index.html과 섞이는 "캐시 스큐"를 확실히 해소)
//   3) 반복 실패 시: 수동 복구 화면(캐시 삭제 후 재시도 버튼) 표시
(function () {
  'use strict';

  var RELOAD_KEY = '__app_fallback_reloads';
  var MAX_RELOADS = 3;
  var DEADLINE_MS = 15000;   // 느린 모바일 네트워크에서 대용량 모듈 로드 여유 (오탐 방지)
  var POLL_MS = 400;         // 초기화 감지 폴링 간격
  var SUCCESS_RESET_MS = 16000;

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

  // 앱이 한참 뒤에라도 정상 초기화되면 리로드 카운터 정리.
  setTimeout(function () {
    if (window.__APP_INITIALIZED) resetReloadCount();
  }, SUCCESS_RESET_MS);

  /**
   * 캐시 스큐/구 SW를 확실히 제거하는 하드 리셋.
   * 모든 캐시 삭제 + SW 전부 해제 후 콜백(리로드). best-effort, 실패해도 리로드는 수행.
   */
  function hardReset(done) {
    var tasks = [];
    try {
      if (window.caches && caches.keys) {
        tasks.push(
          caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          }).catch(function () {})
        );
      }
    } catch (e) {}
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
        tasks.push(
          navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister(); }));
          }).catch(function () {})
        );
      }
    } catch (e) {}

    var finished = false;
    function finish() { if (finished) return; finished = true; done(); }
    // 안전장치: 정리가 오래 걸려도 4초 후엔 무조건 리로드
    setTimeout(finish, 4000);
    Promise.all(tasks).then(finish).catch(finish);
  }

  function softUpdateThenReload() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration()
        .then(function (reg) {
          if (reg) return reg.update();
          return navigator.serviceWorker.register('./sw.js');
        })
        .then(function () { window.location.reload(); })
        .catch(function () { window.location.reload(); });
    } else {
      window.location.reload();
    }
  }

  function attemptRecovery() {
    var count = getReloadCount();

    if (count >= MAX_RELOADS) {
      showManualRecovery();
      return;
    }

    bumpReloadCount();

    if (count === 0) {
      // 1차: 가벼운 갱신 후 리로드 (일시적 네트워크 문제일 수 있음)
      softUpdateThenReload();
    } else {
      // 2차 이후: 캐시/SW 완전 초기화 후 리로드 (캐시 스큐 확실히 해소)
      hardReset(function () { window.location.reload(); });
    }
  }

  // ── 폴링 감지: 정상 초기화되면 즉시 종료, 아니면 데드라인에 복구 ──
  console.log('[fallback] 폴링 시작 — __APP_INITIALIZED 대기 (15s 데드라인)');
  var elapsed = 0;
  var timer = setInterval(function () {
    if (window.__APP_INITIALIZED) {
      clearInterval(timer);
      resetReloadCount();
      console.log('[fallback] 앱 정상 초기화 확인 — 폴링 종료');
      return;
    }
    elapsed += POLL_MS;
    if (elapsed >= DEADLINE_MS) {
      clearInterval(timer);
      console.log('[fallback] 데드라인 도달 — 복구 시도 (reload count: ' + getReloadCount() + ')');
      attemptRecovery();
    }
  }, POLL_MS);

  function showManualRecovery() {
    if (document.getElementById('app-fallback-overlay')) return;

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
    desc.textContent = '저장된 캐시가 손상되었을 수 있습니다. 아래 버튼을 누르면 캐시를 정리하고 새로 불러옵니다. (네트워크 연결을 확인해주세요)';
    desc.style.cssText = 'margin:0;opacity:0.75;max-width:320px;line-height:1.6;';

    var btn = document.createElement('button');
    btn.textContent = '캐시 정리 후 다시 시도';
    btn.style.cssText =
      'margin-top:0.5rem;padding:0.85rem 2rem;font-size:1rem;font-weight:600;' +
      'border:none;border-radius:8px;cursor:pointer;' +
      'background:var(--color-primary,#4f9eff);color:#fff;';
    var busy = false;
    btn.onclick = function () {
      if (busy) return;
      busy = true;
      btn.textContent = '정리 중…';
      resetReloadCount();
      hardReset(function () { window.location.reload(); });
    };

    overlay.appendChild(icon);
    overlay.appendChild(title);
    overlay.appendChild(desc);
    overlay.appendChild(btn);

    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      window.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(overlay);
      });
    }
  }
})();
