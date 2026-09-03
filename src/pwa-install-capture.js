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

        // --- SW 업데이트 진행 팝업 ---
        // updatefound: 브라우저가 새 SW를 다운로드하기 시작하면 발생.
        // installing → installed → activating → activated 상태 변화를 추적하여
        // 사용자에게 비침습적 토스트 팝업으로 진행 상황을 표시한다.
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (!newWorker) return;
          showSWUpdateToast('새 버전 확인 중...');
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed') {
              showSWUpdateToast('새 버전 다운로드 완료 — 적용 준비 중...');
            } else if (newWorker.state === 'activating') {
              showSWUpdateToast('새 버전 적용 중...');
            }
          });
        });

        // controllerchange: 기존 SW가 있던 상태에서 교체된 경우(=업데이트)만 리로드.
        // 최초 등록(controller가 null → 새 SW)이나 hardReset 후 재등록 시에는 리로드하지 않음.
        var refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (refreshing) return;
          if (!hadController) return;  // 최초 등록이면 리로드 불필요
          refreshing = true;
          showSWUpdateToast('새 버전 적용 완료 — 페이지를 새로고침합니다.', true);
          setTimeout(function () { window.location.reload(); }, 600);
        });
      })
      .catch(function (err) {
        console.error('[PWA] SW 조기 등록 실패:', err);
      });
  }

  // --- SW 업데이트 토스트 팝업 (자체完結型 — 모듈 로드 전 독립 동작) ---
  var swToastTimer = null;
  function showSWUpdateToast(message, isFinal) {
    var toast = document.getElementById('sw-update-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sw-update-toast';
      toast.style.cssText = [
        'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(11,15,25,0.92)', 'color:#fff', 'padding:12px 24px',
        'border-radius:12px', 'font-size:14px', 'font-weight:500',
        'z-index:2147483647', 'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
        'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
        'display:flex', 'align-items:center', 'gap:10px',
        'opacity:0', 'transition:opacity 0.3s ease',
        'max-width:90vw', 'text-align:center',
        'font-family:system-ui,-apple-system,sans-serif'
      ].join(';');
      document.body.appendChild(toast);
    }
    toast.innerHTML = '<span style="display:inline-block;width:16px;height:16px;'
      + 'border:2px solid rgba(255,255,255,0.2);border-top-color:#4ade80;'
      + 'border-radius:50%;animation:sw-spin 0.8s linear infinite;'
      + (isFinal ? 'animation:none;border-color:#4ade80;' : '')
      + '"></span><span>' + message + '</span>';
    toast.style.opacity = '1';
    if (swToastTimer) clearTimeout(swToastTimer);
    if (!isFinal) {
      swToastTimer = setTimeout(function () {
        toast.style.opacity = '0';
      }, 5000);
    }
  }
  // 토스트용 스피너 애니메이션 CSS 주입 (중복 방지)
  if (!document.getElementById('sw-toast-spin-style')) {
    var s = document.createElement('style');
    s.id = 'sw-toast-spin-style';
    s.textContent = '@keyframes sw-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
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
