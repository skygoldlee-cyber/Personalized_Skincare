// pwa-install-capture.js - beforeinstallprompt 이벤트를 최대한 빨리 캡처
// app.js는 type="module"(deferred)이라 실행이 늦어 beforeinstallprompt 이벤트를
// 놓칠 수 있음. 이 클래식 스크립트는 <head>에서 즉시 실행되어 이벤트를 window에 저장.
(function () {
  'use strict';
  window.__deferredPrompt = null;
  window.__pwaInstallReady = false;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__deferredPrompt = e;
    window.__pwaInstallReady = true;
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  });

  window.addEventListener('appinstalled', function () {
    window.__deferredPrompt = null;
    window.__pwaInstallReady = false;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
})();
