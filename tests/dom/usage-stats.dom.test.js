// tests/dom/usage-stats.dom.test.js — 로컬 기능 사용 카운터 (ROAD-L5)
// @spec ROAD-L5
// 뷰 전환·기능 액션 카운트가 시험 스코프 localStorage 키에 누적되고,
// 설정의 '내 사용 통계' 모달이 라벨·합계를 렌더링함을 고정한다.

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    trapFocus: vi.fn(() => vi.fn()),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { loadIndexHtml } from './helpers.js';
import {
    trackView, trackAction, getUsageStats, resetUsageStats, showUsageStats,
    isValueThresholdMet, PRO_VALUE_THRESHOLD,
} from '../../src/usage-stats.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';
import { scopedKey } from '../../src/exam-context.js';

function overlay() { return document.getElementById('usage-stats-overlay'); }

beforeEach(() => {
    localStorage.clear();
    loadIndexHtml();
    overlay()?.remove();
});

describe('사용 카운터 (trackView/trackAction)', () => {
    it('뷰·액션 카운트가 scoped usage_stats 키에 누적된다', () => {
        trackView('quiz-view');
        trackView('quiz-view');
        trackView('flashcard-view');
        trackAction('weak_to_textbook');

        const raw = localStorage.getItem(scopedKey(STORAGE_KEYS.USAGE_STATS));
        expect(raw).toBeTruthy();
        const d = JSON.parse(raw);
        expect(d.views['quiz-view']).toBe(2);
        expect(d.views['flashcard-view']).toBe(1);
        expect(d.actions.weak_to_textbook).toBe(1);
        expect(d.firstUse).toBeTruthy();
        expect(Object.keys(d.days)).toHaveLength(1);
    });

    it('resetUsageStats가 카운터를 비운다', () => {
        trackView('quiz-view');
        trackAction('diagnostic_quiz');
        resetUsageStats();
        const d = getUsageStats();
        expect(Object.keys(d.views)).toHaveLength(0);
        expect(Object.keys(d.actions)).toHaveLength(0);
        expect(d.firstUse).toBeNull();
    });

    it('손상된 데이터는 초기값으로 복구한다', () => {
        localStorage.setItem(scopedKey(STORAGE_KEYS.USAGE_STATS), '{broken');
        trackView('quiz-view');
        expect(getUsageStats().views['quiz-view']).toBe(1);
    });
});

describe('내 사용 통계 모달 (showUsageStats)', () => {
    it('뷰 라벨과 액션 라벨·합계를 렌더링한다', async () => {
        trackView('quiz-view');
        trackView('quiz-view');
        trackAction('weak_to_textbook');
        trackAction('weak_to_textbook');
        trackAction('diagnostic_quiz');

        await showUsageStats();
        const el = overlay();
        expect(el).not.toBeNull();
        expect(el.textContent).toContain('기출 및 핵심 퀴즈');
        expect(el.textContent).toContain('오답 → 교재 근거 보기');
        expect(el.textContent).toContain('진단 평가');
        expect(el.textContent).toContain('기능 사용 합계');
        // 프라이버시 고지 — 로컬 전용
        expect(el.textContent).toContain('이 기기에만 저장');
    });

    it('유료가치 판정 기준(20회) 표시와 충족 판정을 반영한다', async () => {
        await showUsageStats();
        expect(overlay().textContent).toContain(`기준 ${PRO_VALUE_THRESHOLD}회 중`);
        expect(overlay().textContent).not.toContain('충족');
        overlay().querySelector('.app-confirm-ok').click();

        for (let i = 0; i < PRO_VALUE_THRESHOLD; i++) trackAction('weak_to_textbook');
        expect(isValueThresholdMet()).toBe(true);
        await showUsageStats();
        expect(overlay().textContent).toContain('충족');
    });

    it('사용 기록이 없으면 빈 상태 문구를 표시한다', async () => {
        await showUsageStats();
        expect(overlay().textContent).toContain('기록된 사용 데이터가 없습니다');
    });

    it('초기화 버튼이 카운터를 비우고 모달을 다시 그린다', async () => {
        trackAction('plan_compare');
        await showUsageStats();
        overlay().querySelector('[data-reset-usage]').click();
        await new Promise(r => setTimeout(r, 0));
        const d = getUsageStats();
        expect(Object.keys(d.actions)).toHaveLength(0);
    });

    it('설정 메뉴에 사용 통계 진입점이 있다', () => {
        const btn = document.querySelector('[data-click="showUsageStats"]');
        expect(btn).not.toBeNull();
        expect(btn.textContent).toContain('내 사용 통계');
    });
});
