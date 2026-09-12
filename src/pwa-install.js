// src/pwa-install.js — PWA 설치 프롬프트 및 설치 안내 모달 로직 (app.js에서 추출)
import { STORAGE_KEYS } from './storage-keys.js';
import { trapFocus } from './ui-utils.js';

/**
 * PWA 설치 버튼, beforeinstallprompt 캡처, 설치 안내 모달을 초기화합니다.
 */
export function setupPWAInstall() {
    let deferredPrompt = window.__deferredPrompt || null;
    const installBtn = document.getElementById('pwa-install-btn');

    console.debug('[PWA] 설치 버튼 초기화:', installBtn ? '발견됨' : '발견되지 않음');
    console.debug('[PWA] 조기 캡처된 deferredPrompt:', deferredPrompt ? '있음' : '없음');

    // 이미 설치된 경우 버튼 숨기기 (즉시 실행)
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        console.debug('[PWA] 이미 설치된 상태입니다.');
        if (installBtn) {
            installBtn.classList.add('is-hidden');
        }
        return;
    }

    // 이미 조기 캡처된 이벤트가 있으면 버튼 즉시 표시
    if (deferredPrompt && installBtn) {
        installBtn.classList.remove('is-hidden');
    }

    // beforeinstallprompt 이벤트 추가 캡처 (조기 캡처가 놓친 경우 대비)
    window.addEventListener('beforeinstallprompt', (e) => {
        console.debug('[PWA] beforeinstallprompt 이벤트 발생');
        e.preventDefault();
        deferredPrompt = e;
        window.__deferredPrompt = e;
        if (installBtn) {
            installBtn.classList.remove('is-hidden');
            installBtn.innerHTML = '<i class="fa-solid fa-download"></i> <span class="btn-text">앱 설치</span>';
            console.debug('[PWA] 설치 버튼 표시됨');
        }
    });

    // 조기 캡처 이벤트가 나중에 도착하는 경우 대비
    window.addEventListener('pwa-install-available', () => {
        deferredPrompt = window.__deferredPrompt;
        if (installBtn && deferredPrompt) {
            installBtn.classList.remove('is-hidden');
            console.debug('[PWA] 조기 캡처 이벤트 감지 — 설치 버튼 표시');
        }
    });

    // 설치 안내 모달 제어 (iOS/Android 분기)
    const installModal = document.getElementById('pwa-install-modal');
    const guideAndroid = document.getElementById('pwa-guide-android');
    const guideIos = document.getElementById('pwa-guide-ios');
    const guideGeneric = document.getElementById('pwa-guide-generic');
    const modalCloseBtn = document.getElementById('pwa-modal-close');
    const modalBackdrop = document.getElementById('pwa-modal-backdrop');

    function detectPlatform() {
        const ua = navigator.userAgent || '';
        // 인앱 브라우저(WebView) 감지 — wv 플래그, Kakao, Instagram, Facebook, LINE, Twitter 등
        if (/;\s*wv\)/.test(ua) || /KAKAOTALK|KakaoTalk/i.test(ua) || /Instagram/i.test(ua) || /FBAN|FBAV/i.test(ua) || /Line\//i.test(ua) || /Twitter/i.test(ua) || /Snapchat/i.test(ua)) {
            return 'inapp';
        }
        if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
            return 'ios';
        }
        if (/android/i.test(ua)) {
            return 'android';
        }
        return 'generic';
    }

    async function openInstallModal() {
        if (!installModal) return;
        const platform = detectPlatform();
        console.debug('[PWA] 설치 안내 모달 표시 - 플랫폼:', platform);
        const guideInapp = document.getElementById('pwa-guide-inapp');
        if (guideAndroid) guideAndroid.classList.toggle('is-hidden', platform !== 'android');
        if (guideIos) guideIos.classList.toggle('is-hidden', platform !== 'ios');
        if (guideGeneric) guideGeneric.classList.toggle('is-hidden', platform !== 'generic');
        if (guideInapp) guideInapp.classList.toggle('is-hidden', platform !== 'inapp');

        // 진단 정보 수집 및 표시
        const diagEl = document.getElementById('pwa-diagnostics');
        const diagContent = document.getElementById('pwa-diag-content');
        if (diagEl && diagContent) {
            const lines = [];
            const secure = (typeof isSecureContext !== 'undefined') ? isSecureContext : (location.protocol === 'https:');
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            const hasPrompt = !!window.__deferredPrompt;

            // SW 상태(비동기) 수집
            let swState = '미확인';
            if ('serviceWorker' in navigator) {
                try {
                    const reg = await navigator.serviceWorker.getRegistration();
                    swState = reg ? (reg.active ? reg.active.state : '비활성') : '없음';
                } catch (e) { swState = '조회실패'; }
            } else {
                swState = 'API미지원';
            }

            // 이미 설치된 관련/동일 앱 확인
            let relatedInstalled = false;
            if (navigator.getInstalledRelatedApps) {
                try {
                    const apps = await navigator.getInstalledRelatedApps();
                    relatedInstalled = apps.length > 0;
                } catch (e) { /* 무시 */ }
            }

            // "any" 용도 아이콘 존재 여부 (Chrome 설치 요건)
            let anyIcon = null;
            const manifestLink = document.querySelector('link[rel="manifest"]');
            let manifestStatus = '';
            if (manifestLink) {
                try {
                    const resp = await fetch(manifestLink.getAttribute('href'), { cache: 'no-cache' });
                    manifestStatus = resp.status + ' ' + resp.statusText;
                    if (resp.ok) {
                        const json = await resp.json();
                        anyIcon = (json.icons || []).some(ic => !ic.purpose || /(^|\s)any(\s|$)/.test(ic.purpose));
                    }
                } catch (e) { manifestStatus = '실패: ' + e.message; }
            } else {
                manifestStatus = 'manifest link 없음';
            }

            // ---- 판정 ----
            let verdict;
            if (isStandalone || relatedInstalled) {
                verdict = '✅ 이미 설치됨 — 홈 화면 아이콘으로 실행하세요. (재설치하려면 먼저 삭제)';
            } else if (platform === 'inapp') {
                verdict = '⚠️ 인앱 브라우저(카카오톡 등)에서는 설치 불가.\n  → 우측 상단 ⋮ → "다른 브라우저로 열기 / Chrome으로 열기" 후 다시 시도.';
            } else if (!secure) {
                verdict = '❌ HTTPS(보안 컨텍스트)가 아니어서 설치 불가.';
            } else if (swState === '없음' || swState === 'API미지원' || swState === '조회실패') {
                verdict = '❌ 서비스 워커가 활성 상태가 아님 — 새로고침 후 다시 시도.';
            } else if (anyIcon === false) {
                verdict = '❌ manifest에 "any" 용도 아이콘이 없어 설치가 차단됨.';
            } else if (hasPrompt) {
                verdict = '✅ 설치 가능 — 아래 "지금 설치" 버튼을 누르세요.';
            } else {
                verdict = 'ℹ️ 설치 요건은 충족. 다만 자동 설치 이벤트가 아직 없음.\n  → Chrome 메뉴(⋮) → "앱 설치"로 직접 설치, 또는\n  → 이전에 설치를 취소/삭제했다면: 설정→사이트 설정→(이 사이트) 데이터 삭제 후 재시도, 또는\n  → chrome://apps 에서 기존 설치 여부 확인.';
            }

            lines.push('▶ 판정: ' + verdict);
            lines.push('────────────');
            lines.push('• beforeinstallprompt: ' + (hasPrompt ? '캡처됨(설치 가능)' : '없음'));
            lines.push('• 보안 컨텍스트(HTTPS): ' + secure);
            lines.push('• 이미 설치(standalone): ' + isStandalone);
            lines.push('• 관련 앱 설치됨: ' + relatedInstalled);
            lines.push('• SW 조기 등록: ' + (window.__swRegistered ? '성공' : '미확인'));
            lines.push('• SW 상태: ' + swState);
            lines.push('• "any" 용도 아이콘: ' + (anyIcon === null ? '확인불가' : (anyIcon ? '있음' : '없음')));
            lines.push('• manifest fetch: ' + manifestStatus);
            lines.push('• navigator.standalone: ' + window.navigator.standalone);
            lines.push('• 플랫폼 감지: ' + platform);
            lines.push('• UA: ' + (navigator.userAgent || '').substring(0, 90));

            diagContent.textContent = lines.join('\n');
            diagEl.classList.remove('is-hidden');

            // 프롬프트가 실제로 잡혀 있으면 모달 안에서 바로 설치할 수 있는 버튼 제공
            const directBtnId = 'pwa-direct-install-btn';
            let directBtn = document.getElementById(directBtnId);
            if (hasPrompt) {
                if (!directBtn) {
                    directBtn = document.createElement('button');
                    directBtn.id = directBtnId;
                    directBtn.className = 'btn btn-primary install-direct-btn';
                    directBtn.innerHTML = '<i class="fa-solid fa-download"></i> 지금 설치';
                    directBtn.addEventListener('click', async () => {
                        const pr = window.__deferredPrompt;
                        if (!pr) return;
                        try { pr.prompt(); await pr.userChoice; } catch (e) { /* 무시 */ }
                        window.__deferredPrompt = null;
                        closeInstallModal();
                    });
                    if (diagEl.parentNode) diagEl.parentNode.insertBefore(directBtn, diagEl);
                }
                directBtn.classList.remove('is-hidden');
            } else if (directBtn) {
                directBtn.classList.add('is-hidden');
            }
        }

        installModal.classList.remove('is-hidden');
        document.body.classList.add('no-scroll');
        // 포커스 트랩 적용
        if (installModal._untrapFocus) installModal._untrapFocus();
        installModal._untrapFocus = trapFocus(installModal);
    }

    function closeInstallModal() {
        if (!installModal) return;
        installModal.classList.add('is-hidden');
        document.body.classList.remove('no-scroll');
        if (installModal._untrapFocus) {
            installModal._untrapFocus();
            installModal._untrapFocus = null;
        }
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeInstallModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeInstallModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && installModal && !installModal.classList.contains('is-hidden')) {
            closeInstallModal();
        }
    });

    // 설치 버튼 클릭 핸들러
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            console.debug('[PWA] 설치 버튼 클릭됨');
            // window.__deferredPrompt에서 최신 값 동기화
            if (!deferredPrompt && window.__deferredPrompt) {
                deferredPrompt = window.__deferredPrompt;
                console.debug('[PWA] window.__deferredPrompt에서 복구');
            }
            if (!deferredPrompt) {
                // 진단 정보 출력
                console.debug('[PWA] beforeinstallprompt 미발생 — 진단:');
                console.debug('[PWA]   SW 등록:', window.__swRegistered ? '성공' : '실패/미등록');
                console.debug('[PWA]   display-mode standalone:', window.matchMedia('(display-mode: standalone)').matches);
                console.debug('[PWA]   navigator.standalone:', window.navigator.standalone);
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistration().then(reg => {
                        console.debug('[PWA]   SW 활성 상태:', reg ? reg.active?.state : '등록 없음');
                    }).catch(e => console.debug('[PWA]   SW 조회 실패:', e));
                }
                // 플랫폼별 설치 안내 모달 표시
                openInstallModal();
                return;
            }
            // 설치 프롬프트 표시
            deferredPrompt.prompt();
            // 사용자 선택 대기
            try {
                const { outcome } = await deferredPrompt.userChoice;
                console.debug('[PWA] 설치 프롬프트 결과:', outcome);
            } catch (err) {
                console.debug('[PWA] 설치 프롬프트 대기 중 오류:', err);
            }
            // 프롬프트 사용 후 초기화
            deferredPrompt = null;
            // 버튼 숨기기
            installBtn.classList.add('is-hidden');
        });
    }

    // 앱 설치 완료 감지
    window.addEventListener('appinstalled', () => {
        console.debug('[PWA] 앱이 설치되었습니다.');
        deferredPrompt = null;
        window.__deferredPrompt = null;
        if (installBtn) {
            installBtn.classList.add('is-hidden');
        }
    });

    // 서비스 워커 등록은 pwa-install-capture.js(<head>)에서 조기 실행됨.
    // 여기서 중복 등록하지 않음 (navigator.serviceWorker.register는 동일 scope면 재등록 무해하지만 불필요).

    // 인앱 브라우저 자동 감지 — Chrome으로 열기 안내 모달 자동 표시 (최초 1회)
    const platform = detectPlatform();
    if (platform === 'inapp') {
        console.debug('[PWA] 인앱 브라우저 감지 — Chrome으로 열기 안내');
        // 페이지 로드 완료 후 자동 표시
        const showInappGuide = () => {
            try {
                const seen = sessionStorage.getItem(STORAGE_KEYS.INAPP_GUIDE_SHOWN);
                if (seen) return;
                sessionStorage.setItem(STORAGE_KEYS.INAPP_GUIDE_SHOWN, '1');
                openInstallModal();
            } catch (e) {
                openInstallModal();
            }
        };
        if (document.readyState === 'complete') {
            setTimeout(showInappGuide, 800);
        } else {
            window.addEventListener('load', () => setTimeout(showInappGuide, 800));
        }
    }
}
