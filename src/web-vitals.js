// src/web-vitals.js — Core Web Vitals 모니터링 (Zero-dependency, PerformanceObserver API)
// LCP, CLS, INP를 측정하여 console.debug에 출력. Zero-backend이므로 외부 전송 없음.

let _lcpValue = 0;
let _clsValue = 0;
let _inpValue = 0;
let _initialized = false;

export function initWebVitals() {
    if (_initialized || typeof PerformanceObserver === 'undefined') return;
    _initialized = true;

    // LCP (Largest Contentful Paint)
    try {
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            if (entries.length > 0) {
                _lcpValue = entries[entries.length - 1].startTime;
            }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) { /* LCP 미지원 브라우저 */ }

    // CLS (Cumulative Layout Shift)
    try {
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                    _clsValue += entry.value;
                }
            }
        }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) { /* CLS 미지원 브라우저 */ }

    // INP (Interaction to Next Paint) — Event Timing API의 'event' 엔트리로 최대 duration 추적
    // ('interaction'은 표준 엔트리 타입이 아니므로 지원 여부 확인 후 관찰 — 콘솔 경고 방지)
    if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes('event')) {
        try {
            new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    const duration = entry.duration;
                    if (duration > _inpValue) {
                        _inpValue = duration;
                    }
                }
            }).observe({ type: 'event', buffered: true, durationThreshold: 40 });
        } catch (e) { /* Event Timing 미지원 브라우저 */ }
    }

    // 페이지 언로드 시 최종 값 출력
    window.addEventListener('pagehide', () => {
        console.debug('[Web Vitals] LCP:', _lcpValue.toFixed(0), 'ms | CLS:', _clsValue.toFixed(3), '| INP:', _inpValue.toFixed(0), 'ms');
    });
}

function getWebVitals() {
    return { lcp: _lcpValue, cls: _clsValue, inp: _inpValue };
}
