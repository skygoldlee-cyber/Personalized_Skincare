// tests/dom/common-offline.dom.test.js — 오프라인 감지 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.3 (Phase 5)
// 검증: offline 이벤트→프로브 실패 누적→배너 표시(H/B) · online 복귀→배너 해제(H)
//       · visibilitychange hidden → 뽀모도로 자동 일시정지(H)
// 참고: 콜드스타트 유예(PWA_WAKE_GRACE_MS) 경과 후부터 실패가 누적됨 — fake timers

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { loadIndexHtml, el } from './helpers.js';
import { state } from '../../src/state.js';
import { setupOfflineDetection } from '../../src/views/offline-detection.js';
import { TIMING } from '../../src/config/timing.js';

function stubOfflineEnv(online) {
    Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), addListener: vi.fn() }));
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
}

describe('오프라인 감지 — 배너·복귀·뽀모도로 연동', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        vi.useFakeTimers();
        stubOfflineEnv(true);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    });

    it('온라인 → 배너 숨김 유지', async () => {
        setupOfflineDetection(state, vi.fn());
        window.dispatchEvent(new Event('offline'));
        await vi.advanceTimersByTimeAsync(TIMING.PWA_WAKE_GRACE_MS + 20000);
        // navigator.onLine=true → 프로브가 즉시 온라인 반환 → 배너 미표시
        expect(el('offline-banner').classList.contains('show')).toBe(false);
    });

    it('오프라인 지속 → 프로브 실패 누적 후 배너 표시', async () => {
        stubOfflineEnv(false);
        setupOfflineDetection(state, vi.fn());

        window.dispatchEvent(new Event('offline'));
        // 유예 15초 경과 → 이후 재시도마다 실패 누적. 초기 5초 프로브와 이벤트 프로브가
        // 병렬 재시도 체인을 이루므로 임계 도달 시점은 정확히 예측하지 않고 충분히 진행.
        await vi.advanceTimersByTimeAsync(TIMING.PWA_WAKE_GRACE_MS + 30000);
        expect(el('offline-banner').classList.contains('show')).toBe(true);
    });

    it('online 이벤트 → 배너 즉시 해제·실패 카운터 리셋', async () => {
        stubOfflineEnv(false);
        setupOfflineDetection(state, vi.fn());
        window.dispatchEvent(new Event('offline'));
        await vi.advanceTimersByTimeAsync(TIMING.PWA_WAKE_GRACE_MS + 1000 + 2500 * 3);
        expect(el('offline-banner').classList.contains('show')).toBe(true);

        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
        window.dispatchEvent(new Event('online'));
        expect(el('offline-banner').classList.contains('show')).toBe(false);
    });

    it('화면 숨김 → 실행 중 뽀모도로 자동 일시정지', () => {
        const togglePomodoro = vi.fn();
        setupOfflineDetection(state, togglePomodoro);

        state.trainer.pomodoro.isRunning = true;
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(togglePomodoro).toHaveBeenCalledTimes(1);

        // 다시 보임 → 뽀모도로 추가 호출 없이 프로브만 재실행
        state.trainer.pomodoro.isRunning = false;
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(togglePomodoro).toHaveBeenCalledTimes(1);
    });
});
