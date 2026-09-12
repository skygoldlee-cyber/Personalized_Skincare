// src/views/offline-detection.js — 오프라인 감지 및 배너 표시 (app.js에서 분리)
//
// 설치형(standalone)에서는 온라인인데도 navigator.onLine이 false로
// 보고되는 사례가 있어(특히 iOS) 판정을 더 보수적으로 한다.

import { TIMING } from '../config/timing.js';

/**
 * 오프라인 감지 초기화.
 * @param {object} state - 앱 상태 객체 (state.trainer.pomodoro 참조용)
 * @param {function} togglePomodoro - 뽀모도로 토글 함수
 */
export function setupOfflineDetection(state, togglePomodoro) {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    // 설치형(standalone)에서는 온라인인데도 navigator.onLine이 false로
    // 보고되는 사례가 있어(특히 iOS) 판정을 더 보수적으로 한다.
    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    let probeInFlight = false;
    let failStreak = 0;
    const FAIL_THRESHOLD = isStandalone ? 4 : 3; // 오탐 억제: 임계치 상향
    const PROBE_TIMEOUT = TIMING.PWA_PROBE_TIMEOUT_MS;
    const WAKE_GRACE_MS = TIMING.PWA_WAKE_GRACE_MS;                  // 콜드스타트/절전복귀 유예 확대
    let checkIntervalId = null;
    let isOfflineMode = false;
    let lastWakeTime = Date.now();

    function showBanner() {
        if (isOfflineMode) return;
        banner.classList.add('show');
        isOfflineMode = true;
        resetCheckInterval(5000);
    }
    function hideBanner() {
        banner.classList.remove('show');
        failStreak = 0;
        isOfflineMode = false;
        resetCheckInterval(30000);
    }

    /**
     * 실제 네트워크 도달 여부 확인.
     *  1) navigator.onLine === true  → 온라인으로 신뢰, 배너 억제 (설치본 onLine=false 오탐 방향만 무시)
     *  2) navigator.onLine === false → 곧바로 단정하지 않고 ping.txt 프로브로 최종 확인
     * (cache 옵션은 일부 웹뷰와 충돌하므로 쿼리스트링으로만 캐시 우회)
     */
    async function checkReachable() {
        if (location.protocol === 'file:') return true;
        if (navigator.onLine === true) return true;
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
            const res = await fetch(`./ping.txt?_probe=${Date.now()}`, { signal: controller.signal });
            clearTimeout(t);
            return !!(res && res.ok);
        } catch (e) {
            console.warn("Offline detection probe failed:", e);
            return false;
        }
    }

    async function probeConnectivity() {
        if (probeInFlight) return;
        probeInFlight = true;
        try {
            const ok = await checkReachable();
            if (ok) { hideBanner(); return; }

            // 콜드스타트/절전복귀 직후에는 통신칩/Wi-Fi 재연결 중일 수 있어
            // isOfflineMode 여부와 무관하게 유예 동안 실패를 누적하지 않고 재시도.
            const sinceWake = Date.now() - lastWakeTime;
            if (sinceWake < WAKE_GRACE_MS) {
                setTimeout(probeConnectivity, 3000);
                return;
            }
            failStreak++;
            if (failStreak >= FAIL_THRESHOLD) {
                showBanner();
            } else {
                setTimeout(probeConnectivity, 2500);
            }
        } finally {
            probeInFlight = false;
        }
    }

    function resetCheckInterval(ms) {
        if (checkIntervalId) clearInterval(checkIntervalId);
        checkIntervalId = setInterval(probeConnectivity, ms);
    }

    // online/offline 이벤트는 실제 프로브로 재확인
    window.addEventListener('online', () => { failStreak = 0; hideBanner(); });
    window.addEventListener('offline', () => { lastWakeTime = Date.now(); probeConnectivity(); });

    // 화면 활성화(슬립 복귀) 시 유예 리셋 후 즉시 프로브
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            lastWakeTime = Date.now();
            failStreak = 0;
            probeConnectivity();
        } else {
            // 페이지가 보이지 않을 때 뽀모도로 타이머 자동 일시정지
            const pomo = state.trainer.pomodoro;
            if (pomo.isRunning) {
                togglePomodoro();
            }
        }
    });

    // 초기 상태
    hideBanner();
    setTimeout(probeConnectivity, 5000); // 콜드스타트 유예: 첫 확인을 넉넉히 지연
}
