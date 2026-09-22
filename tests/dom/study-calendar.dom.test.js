// tests/dom/study-calendar.dom.test.js — 학습 캘린더·목표 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 캘린더 렌더(H) · 활동 기록→학습일 반영·목표 달성률(H/P) · 월 이동(H)
//       · 목표 설정 저장→달성률 재계산(B/P) · 빈 달력(E)

import { describe, it, beforeEach, expect, vi } from 'vitest';

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
import {
    renderStudyCalendar, prevCalendarMonth, nextCalendarMonth,
    openGoalSettings, saveGoalSettings, closeGoalSettings,
} from '../../src/views/study-calendar.js';
import { recordStudyActivity, getTodayStr } from '../../src/study-tracker.js';
import { safeSetItem } from '../../src/state.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

describe('학습 캘린더 — 렌더·기록·목표', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    it('기본 렌더 → 목표 카드 3개 + 이번 달 캘린더 + 오늘 셀', () => {
        renderStudyCalendar();

        const wrap = el('study-calendar-content');
        expect(wrap.querySelectorAll('.goal-card').length).toBe(3);
        expect(wrap.querySelectorAll('.calendar-weekday').length).toBe(7);
        expect(wrap.querySelector('.calendar-title').textContent).toContain('년');
        // 오늘 셀에 today 클래스
        expect(wrap.querySelector('.calendar-day.today')).not.toBeNull();
        // 기본 목표: 카드 0/50, 퀴즈 0/10, 주간 0/5일
        expect(wrap.textContent).toContain('0 / 50');
        expect(wrap.textContent).toContain('0 / 10');
        expect(wrap.textContent).toContain('0 / 5일');
    });

    it('활동 기록 → 오늘 셀 학습 표시 + 목표 달성률 반영 (P)', () => {
        recordStudyActivity({ cards: 10, quizzes: 5, correct: 4 });
        renderStudyCalendar();

        const wrap = el('study-calendar-content');
        const todayCell = wrap.querySelector('.calendar-day.today');
        expect(todayCell.classList.contains('studied')).toBe(true);
        expect(todayCell.getAttribute('title')).toContain('카드 10');
        // 카드 10/50 = 20%, 퀴즈 5/10 = 50% → 평균 35%
        expect(wrap.textContent).toContain('10 / 50');
        expect(wrap.textContent).toContain('5 / 10');
        expect(wrap.querySelector('.goal-percent').textContent).toBe('35%');
        // localStorage 실기록 확인
        expect(storedJson(STORAGE_KEYS.STUDY_CALENDAR)[getTodayStr()].cards).toBe(10);
    });

    it('지난 학습일 시딩 → 해당 일자 studied 마킹, 미학습일 없음 표시', () => {
        const cal = {};
        cal[getTodayStr().slice(0, 8) + '01'] = { cards: 3, quizzes: 0, correct: 0 }; // 이번 달 1일
        safeSetItem(STORAGE_KEYS.STUDY_CALENDAR, JSON.stringify(cal));
        renderStudyCalendar();

        const studied = el('study-calendar-content').querySelectorAll('.calendar-day.studied');
        expect(studied.length).toBe(1);
        expect(studied[0].querySelector('.day-num').textContent).toBe('1');
    });

    it('월 이동 → 이전/다음 달 타이틀 전환 후 복귀', () => {
        renderStudyCalendar();
        const thisTitle = el('study-calendar-content').querySelector('.calendar-title').textContent;

        prevCalendarMonth();
        const prevTitle = el('study-calendar-content').querySelector('.calendar-title').textContent;
        expect(prevTitle).not.toBe(thisTitle);

        nextCalendarMonth();
        expect(el('study-calendar-content').querySelector('.calendar-title').textContent).toBe(thisTitle);
    });

    it('목표 설정 → 모달 열기·기본값·저장 시 영속 + 재렌더', () => {
        renderStudyCalendar();
        openGoalSettings();

        const modal = el('goal-settings-modal');
        expect(modal).not.toBeNull();
        expect(el('goal-daily-cards').value).toBe('50');
        expect(el('goal-daily-quizzes').value).toBe('10');
        expect(el('goal-weekly-days').value).toBe('5');

        el('goal-daily-cards').value = '100';
        saveGoalSettings();

        expect(el('goal-settings-modal')).toBeNull();
        expect(storedJson(STORAGE_KEYS.STUDY_GOALS).dailyCards).toBe(100);
        expect(storedJson(STORAGE_KEYS.STUDY_GOALS).dailyQuizzes).toBe(10);
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('저장'), 'success');
        // 재렌더에 새 목표 반영
        expect(el('study-calendar-content').textContent).toContain('0 / 100');
    });

    it('목표 설정 취소 → 모달만 닫히고 목표 불변', () => {
        openGoalSettings();
        el('goal-daily-cards').value = '999';
        closeGoalSettings();

        expect(el('goal-settings-modal')).toBeNull();
        expect(storedJson(STORAGE_KEYS.STUDY_GOALS)).toBeNull();
    });
});
