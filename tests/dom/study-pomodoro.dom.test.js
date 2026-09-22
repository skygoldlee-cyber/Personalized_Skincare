// tests/dom/study-pomodoro.dom.test.js — 뽀모도로 타이머 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 시작/일시정지/재개(H) · tick 경과→잔여시간 표시(H) · 25분 완주→휴식 전이+
//       누적/세션 영속(P) · 리셋(H) · 날짜 경계 리셋(P/B)
// vi.useFakeTimers — Date.now·setInterval을 가짜 시계로 제어

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { showToast } from '../../src/ui-utils.js';
import {
    loadIndexHtml, el, resetStudyState, storedJson,
} from './helpers.js';
import { state, loadProgress, safeSetItem } from '../../src/state.js';
import { togglePomodoro, resetPomodoro, updatePomodoroUI } from '../../src/views/pomodoro.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';
import { TIMING } from '../../src/config/timing.js';

describe('뽀모도로 — 시작·경과·완주·리셋·날짜 경계', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    afterEach(() => {
        const p = state.trainer.pomodoro;
        if (p && p.timerId) clearInterval(p.timerId);
        vi.useRealTimers();
    });

    it('시작 → work 전이·라벨/버튼 갱신·25:00 표시', () => {
        togglePomodoro();

        const p = state.trainer.pomodoro;
        expect(p.isRunning).toBe(true);
        expect(p.status).toBe('work');
        expect(p.timeLeft).toBe(TIMING.POMODORO_WORK_SEC);
        expect(el('pomo-status').textContent).toBe('집중 중');
        expect(el('pomo-start-btn').innerHTML).toContain('일시 정지');
        expect(el('pomo-time').textContent).toBe('25:00');
    });

    it('60초 경과 → 잔여 시간 24:00 표시', () => {
        togglePomodoro();
        vi.advanceTimersByTime(60 * 1000); // tick이 Date.now 기반으로 갱신

        expect(state.trainer.pomodoro.timeLeft).toBe(TIMING.POMODORO_WORK_SEC - 60);
        expect(el('pomo-time').textContent).toBe('24:00');
    });

    it('일시정지 → 라벨/버튼 갱신, 시간 진행 정지', () => {
        togglePomodoro();
        vi.advanceTimersByTime(10 * 1000);
        togglePomodoro(); // 일시정지

        const p = state.trainer.pomodoro;
        expect(p.isRunning).toBe(false);
        expect(el('pomo-status').textContent).toBe('집중 일시정지');
        expect(el('pomo-start-btn').innerHTML).toContain('계속 하기');

        const frozen = p.timeLeft;
        vi.advanceTimersByTime(30 * 1000); // 정지 상태에서는 경과 무시
        expect(p.timeLeft).toBe(frozen);

        togglePomodoro(); // 재개
        expect(p.isRunning).toBe(true);
        expect(el('pomo-status').textContent).toBe('집중 중');
    });

    it('25분 완주 → 휴식 전이 + 누적 25분·세션 1 localStorage 영속', () => {
        togglePomodoro();
        vi.advanceTimersByTime(TIMING.POMODORO_WORK_SEC * 1000 + 500);

        const p = state.trainer.pomodoro;
        expect(p.status).toBe('break');
        expect(p.timeLeft).toBe(TIMING.POMODORO_BREAK_SEC);
        expect(p.totalTimeToday).toBe(25);
        expect(p.sessionCount).toBe(1);
        expect(el('pomo-status').textContent).toBe('휴식 대기');
        expect(el('pomo-total-time').textContent).toBe('25분');
        expect(el('pomo-session-count').textContent).toBe('1');
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('휴식'), 'success');
        expect(storedJson(STORAGE_KEYS.POMO_TOTAL_TIME)).toBe(25);
        expect(storedJson(STORAGE_KEYS.POMO_SESSION_COUNT)).toBe(1);
    });

    it('리셋 → idle·25:00·라벨 복귀', () => {
        togglePomodoro();
        vi.advanceTimersByTime(5 * 60 * 1000);
        resetPomodoro();

        const p = state.trainer.pomodoro;
        expect(p.isRunning).toBe(false);
        expect(p.status).toBe('idle');
        expect(el('pomo-status').textContent).toBe('대기 중');
        expect(el('pomo-time').textContent).toBe('25:00');
        expect(el('pomo-start-btn').innerHTML).toContain('집중 시작');
    });

    it('날짜 경계 → 어제 누적은 loadProgress에서 리셋', () => {
        // 어제 날짜로 누적 50분이 저장된 상태
        safeSetItem(STORAGE_KEYS.POMO_TOTAL_TIME, '50');
        safeSetItem(STORAGE_KEYS.POMO_TOTAL_TIME_DATE, '2000-01-01');
        safeSetItem(STORAGE_KEYS.POMO_SESSION_COUNT, '3');
        safeSetItem(STORAGE_KEYS.POMO_SESSION_DATE, '2000-01-01');

        loadProgress();

        const p = state.trainer.pomodoro;
        expect(p.totalTimeToday).toBe(0);
        expect(p.sessionCount).toBe(0);
        // 오늘 날짜로 다시 기록됨
        expect(storedJson(STORAGE_KEYS.POMO_TOTAL_TIME)).toBe(0);
    });

    it('당일 누적 → loadProgress가 복원', () => {
        const today = new Date().toISOString().split('T')[0];
        safeSetItem(STORAGE_KEYS.POMO_TOTAL_TIME, '75');
        safeSetItem(STORAGE_KEYS.POMO_TOTAL_TIME_DATE, today);
        safeSetItem(STORAGE_KEYS.POMO_SESSION_COUNT, '3');
        safeSetItem(STORAGE_KEYS.POMO_SESSION_DATE, today);

        loadProgress();
        updatePomodoroUI();

        expect(state.trainer.pomodoro.totalTimeToday).toBe(75);
        expect(state.trainer.pomodoro.sessionCount).toBe(3);
        expect(el('pomo-total-time').textContent).toBe('75분');
        expect(el('pomo-session-count').textContent).toBe('3');
    });
});
