// pwa-install-capture.js - beforeinstallprompt 조기 캡처 + SW 조기 등록
// app.js는 type="module"(deferred)이라 실행이 늦어:
//   1) beforeinstallprompt 이벤트를 놓칠 수 있음
//   2) SW 등록이 늦어져 Chrome이 PWA 설치 가능 판정을 내리지 못할 수 있음
// 이 스크립트는 <head>에서 즉시 실행되어 두 문제를 해결.
(function () {
  'use strict';
  window.__deferredPrompt = null;
  window.__pwaInstallReady = false;
  window.__swRegistered = false;

  // 1) SW 조기 등록 — Chrome이 PWA 설치 가능 여부를 판단하려면
  //    활성 SW(activate + clients.claim)가 필요. module 스크립트 대기 없이 즉시 등록.
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js')
      .then(function (reg) {
        window.__swRegistered = true;
        console.log('[PWA] SW 조기 등록 성공:', reg.scope);
        // controllerchange: 기존 SW가 있던 상태에서 교체된 경우(=업데이트)만 리로드.
        // 최초 등록(controller가 null → 새 SW)이나 hardReset 후 재등록 시에는 리로드하지 않음.
        var refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (refreshing) return;
          if (!hadController) return;  // 최초 등록이면 리로드 불필요
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(function (err) {
        console.error('[PWA] SW 조기 등록 실패:', err);
      });
  }

  // 2) beforeinstallprompt 이벤트 캡처
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__deferredPrompt = e;
    window.__pwaInstallReady = true;
    console.log('[PWA] beforeinstallprompt 캡처 성공');
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  });

  // 3) 설치 완료 감지
  window.addEventListener('appinstalled', function () {
    window.__deferredPrompt = null;
    window.__pwaInstallReady = false;
    console.log('[PWA] 앱 설치 완료');
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
})();
