// tests/dom/study-challenge.dom.test.js — 데일리 챌린지·스트릭 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 오늘 문항 생성(H) · 모달 진행·피드백(H) · 완료 후 재진입 시 완료 상태(R/P)
//       · 스트릭 갱신·경과일 리셋(B) · 나가기 confirm(X)
// DataLoader는 stubRegistry로 fetch 없이 주입 (DataLoader._loaded 선체크 활용)

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { showToast, showConfirm } from '../../src/ui-utils.js';
import {
    loadIndexHtml, el, isVisible, flushAsync,
    seedStudyData, stubRegistry, resetStudyState, storedJson,
} from './helpers.js';
import { state, safeSetItem } from '../../src/state.js';
import {
    updateStreakAndDailyUI, startDailyChallenge, submitDailyCardAnswer,
    submitDailyShortAnswer, nextDailyStep, closeDailyModal,
} from '../../src/views/daily-challenge.js';
import { STORAGE_KEYS, dailyCompletedKey } from '../../src/storage-keys.js';

const todayStr = () => new Date().toISOString().split('T')[0];

function setupDailyData() {
    const subject = {
        key: 'subja',
        name: '과목1',
        cards: [
            { id: 'subja_card_1', term: '용어A', definition: '설명A' },
            { id: 'subja_card_2', term: '용어B', definition: '설명B' },
            { id: 'subja_card_3', term: '용어C', definition: '설명C' },
        ],
        quizzes: [
            { id: 'subja_quiz_1', type: 'short', question: '질문1', answer: '정답1' },
            { id: 'subja_quiz_2', type: 'short', question: '질문2', answer: '정답2' },
            { id: 'subja_quiz_3', type: 'short', question: '질문3', answer: '정답3' },
        ],
    };
    stubRegistry([subject]);
    window.INGREDIENTS_DATA = [{ name: '페녹시에탄올', type: 'restricted', limit: '1%' }];
}

describe('데일리 챌린지 — 생성·진행·완료·스트릭', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    it('기본 상태 → 스트릭 0·미완료 배지·시작 버튼 활성', () => {
        updateStreakAndDailyUI();

        expect(el('streak-days').textContent).toBe('0');
        expect(el('daily-challenge-status').textContent).toBe('오늘 미션 미완료');
        expect(el('start-daily-btn').disabled).toBe(false);
    });

    it('오늘 완료 키 존재 → 완료 배지 + 시작 버튼 비활성', () => {
        safeSetItem(dailyCompletedKey(todayStr()), 'true');
        updateStreakAndDailyUI();

        expect(el('daily-challenge-status').textContent).toBe('🟢 오늘 미션 완료!');
        expect(el('start-daily-btn').disabled).toBe(true);
    });

    it('스트릭 경과일 초과 → 0으로 리셋 (경계)', () => {
        safeSetItem(STORAGE_KEYS.STUDY_STREAK, '5');
        safeSetItem(STORAGE_KEYS.STUDY_STREAK_LAST_DATE, '2000-01-01'); // 3일+ 경과
        updateStreakAndDailyUI();

        expect(el('streak-days').textContent).toBe('0');
        expect(storedJson(STORAGE_KEYS.STUDY_STREAK)).toBe(0);
    });

    it('스트릭 어제까지 유효 → 유지 표시 (경계)', () => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        safeSetItem(STORAGE_KEYS.STUDY_STREAK, '4');
        safeSetItem(STORAGE_KEYS.STUDY_STREAK_LAST_DATE, yesterday);
        updateStreakAndDailyUI();

        expect(el('streak-days').textContent).toBe('4');
    });

    it('챌린지 시작 → 모달 생성 + 8문항 + 진행 표시', async () => {
        setupDailyData();
        startDailyChallenge();
        await flushAsync();

        expect(el('daily-challenge-modal')).not.toBeNull();
        expect(el('daily-modal-progress').textContent).toBe('진행: 1 / 8');
        // 첫 문항은 카드형 — 뒤집기 카드 + 외움/헷갈림 버튼
        expect(el('daily-card-container')).not.toBeNull();
        expect(el('daily-modal-answer-area').textContent).toContain('완벽히 외움');
    });

    it('카드 문항 외움 표시 → memorizedCards + 피드백 + 다음 버튼', async () => {
        setupDailyData();
        startDailyChallenge();
        await flushAsync();

        submitDailyCardAnswer(true);

        expect(state.memorizedCards.size).toBe(1);
        expect(isVisible('daily-modal-feedback')).toBe(true);
        expect(el('daily-modal-feedback-title').textContent).toContain('완벽히 외운 카드');
        expect(isVisible('daily-modal-next-btn')).toBe(true);
    });

    it('카드 문항 헷갈림 → weakCards 추가', async () => {
        setupDailyData();
        startDailyChallenge();
        await flushAsync();

        submitDailyCardAnswer(false);

        expect(state.weakCards.size).toBe(1);
        expect(el('daily-modal-feedback-title').textContent).toContain('헷갈린 복습 카드');
    });

    it('다음 단계 → 진행 인덱스 이동', async () => {
        setupDailyData();
        startDailyChallenge();
        await flushAsync();

        nextDailyStep();
        expect(el('daily-modal-progress').textContent).toBe('진행: 2 / 8');
    });

    it('단답형 문항 제출 → 채점 피드백', async () => {
        setupDailyData();
        startDailyChallenge();
        await flushAsync();

        // 카드 3문 이후 첫 퀴즈(인덱스 3)로 이동 — short 타입
        nextDailyStep(); nextDailyStep(); nextDailyStep();
        const input = el('daily-answer-input');
        expect(input).not.toBeNull();

        input.value = '정답1';
        submitDailyShortAnswer();

        expect(isVisible('daily-modal-feedback')).toBe(true);
        expect(input.disabled).toBe(true);
    });

    it('전 문항 완주 → 모달 닫힘 + 완료 키 + 스트릭 1 영속', async () => {
        setupDailyData();
        startDailyChallenge();
        await flushAsync();

        for (let i = 0; i < 8; i++) nextDailyStep();

        expect(el('daily-challenge-modal')).toBeNull();
        expect(storedJson(dailyCompletedKey(todayStr()))).toBe(true); // 'true' → JSON 파싱된 boolean
        expect(storedJson(STORAGE_KEYS.STUDY_STREAK)).toBe(1);
        expect(storedJson(STORAGE_KEYS.STUDY_STREAK_LAST_DATE)).toBe(todayStr());
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('완수'), 'success', 4000);
    });

    it('완료 후 재시작 → 안내 토스트 + 모달 미생성', async () => {
        setupDailyData();
        safeSetItem(dailyCompletedKey(todayStr()), 'true');
        startDailyChallenge();
        await flushAsync();

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('이미 달성'), 'info');
        expect(el('daily-challenge-modal')).toBeNull();
    });

    it('나가기 → confirm 승인 시 모달 제거', async () => {
        setupDailyData();
        startDailyChallenge();
        await flushAsync();
        expect(el('daily-challenge-modal')).not.toBeNull();

        await closeDailyModal();
        expect(showConfirm).toHaveBeenCalled();
        expect(el('daily-challenge-modal')).toBeNull();
    });
});
