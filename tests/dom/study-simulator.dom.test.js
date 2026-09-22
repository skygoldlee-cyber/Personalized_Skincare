// tests/dom/study-simulator.dom.test.js — 실전 모의고사 시뮬레이터 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 세션 시작→아레나·OMR 렌더(H) · 답안 선택·문항 이동(H) · 제출→채점·
//       오답 카드 등록(P) · 미응답 오답 처리(B) · 임시저장→배너→이어하기(R/P)
//       · 제한시간 만료 자동 제출(B — fake timers)

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
    loadIndexHtml, el, isVisible, resetStudyState, storedJson,
} from './helpers.js';
import { state } from '../../src/state.js';
import { simState } from '../../src/views/exam-sim-state.js';
import {
    startSimSession, saveSimAnswer, jumpToSimQuestion, renderSimQuestion,
    submitExam, exitSimArena, checkExamDraft, resumeSimDraft, clearSimDraft,
} from '../../src/views/exam-simulator.js';
import { showSimAnswerReview } from '../../src/views/exam-sim-review.js';
import { setupEventListeners } from '../../src/views/event-listeners.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

const EXAM = {
    id: 'simt1',
    title: '테스트 모의고사',
    questions: [
        { id: 'simt1_q1', num: 1, type: 'choice', question: '문제1 질문', options: ['보기1', '보기2', '보기3', '보기4', '보기5'], answer: '②', explanation: '해설1' },
        { id: 'simt1_q2', num: 2, type: 'ox', question: '문제2 진위', options: ['O', 'X'], answer: 'O', explanation: '해설2' },
        { id: 'simt1_q3', num: 3, type: 'short', question: '문제3 단답', answer: '정답3', explanation: '해설3' },
    ],
};

function resetSim() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    simState.examId = '';
    simState.data = null;
    simState.currentIndex = 0;
    simState.userAnswers = {};
    simState.timeLeft = 0;
    simState.timerInterval = null;
    simState.wrongQuestions = [];
}

describe('모의고사 시뮬레이터 — 세션·답안·제출·이어하기', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        resetSim();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (simState.timerInterval) clearInterval(simState.timerInterval);
    });

    it('세션 시작 → 아레나 표시·타이틀·OMR 버블·첫 문항 렌더', () => {
        startSimSession(EXAM);

        expect(isVisible('sim-arena-panel')).toBe(true);
        expect(el('exam-list-panel').classList.contains('is-hidden')).toBe(true);
        expect(el('sim-exam-title').textContent).toBe('테스트 모의고사');
        expect(el('omr-total-count').textContent).toBe('3');
        expect(el('omr-grid').querySelectorAll('.omr-bubble').length).toBe(3);
        expect(el('sim-q-num').textContent).toBe('Q 1 / 3');
        expect(el('sim-q-type').textContent).toBe('객관식 5지선다');
        expect(el('sim-options-container').querySelectorAll('.sim-option-item').length).toBe(5);
        expect(el('sim-time-left').textContent).toMatch(/\d{2}:\d{2}/);
        expect(el('sim-prev-btn').classList.contains('is-hidden')).toBe(true);
    });

    it('선지 클릭 → 답안 저장 + OMR 버블 solved + 진행 카운트', () => {
        startSimSession(EXAM);

        const opts = el('sim-options-container').querySelectorAll('.sim-option-item');
        opts[1].click(); // ② 선택

        expect(simState.userAnswers['simt1_q1']).toBe('②');
        expect(el('omr-b-0').classList.contains('solved')).toBe(true);
        expect(el('omr-solved-count').textContent).toBe('1');
        // 재렌더 후 선택 상태 유지
        expect(el('sim-options-container').querySelectorAll('.sim-option-item')[1].classList.contains('active')).toBe(true);
    });

    it('다음 버튼·OMR 점프 → 문항 이동, 마지막 문항에서 제출 버튼', () => {
        setupEventListeners(() => {}); // sim-next/prev 버튼은 이벤트 리스너 경유
        startSimSession(EXAM);

        el('sim-next-btn').click();
        expect(el('sim-q-num').textContent).toBe('Q 2 / 3');
        expect(el('sim-q-type').textContent).toBe('진위형 OX');
        expect(isVisible('sim-prev-btn')).toBe(true);

        el('omr-b-2').click(); // OMR 버블로 3번 점프
        expect(el('sim-q-num').textContent).toBe('Q 3 / 3');
        expect(el('sim-q-type').textContent).toBe('단답형');
        expect(el('sim-next-btn').classList.contains('is-hidden')).toBe(true);
        expect(isVisible('sim-submit-exam-btn')).toBe(true);
        // 단답형 입력란
        expect(el('sim-text-input')).not.toBeNull();
    });

    it('제출 → 채점·결과 패널·오답 카드 자동 등록·드래프트 제거', () => {
        startSimSession(EXAM);

        // 1번 정답(②), 2번 오답(X), 3번 미응답
        saveSimAnswer('simt1_q1', '②');
        saveSimAnswer('simt1_q2', 'X', false);
        submitExam();

        expect(el('sim-arena-panel').classList.contains('is-hidden')).toBe(true);
        expect(isVisible('sim-result-panel')).toBe(true);
        expect(el('sim-result-score').textContent).toBe('1 / 3 개');
        expect(el('sim-result-rate').textContent).toBe('33%');
        // 오답 2개(2번 오답 + 3번 미응답) → 약점 카드 등록·영속
        expect(state.weakCards.has('weak_sim_simt1_q2')).toBe(true);
        expect(state.weakCards.has('weak_sim_simt1_q3')).toBe(true);
        expect(storedJson(STORAGE_KEYS.FC_WEAK)).toContain('weak_sim_simt1_q2');
        // 제출 시 임시 세션 제거
        expect(storedJson(STORAGE_KEYS.SIM_DRAFT_SESSION)).toBeNull();
    });

    it('결과 리뷰 → 오답 문항 목록·내 답·정답 표시', () => {
        startSimSession(EXAM);
        saveSimAnswer('simt1_q1', '①'); // 오답
        submitExam();
        showSimAnswerReview();

        expect(isVisible('sim-review-panel')).toBe(true);
        const list = el('sim-review-list-container');
        expect(list.querySelectorAll('.sim-review-item').length).toBe(3); // 1번 오답 + 2·3번 미응답
        expect(list.textContent).toContain('(공란)');
        expect(list.textContent).toContain('해설1');
    });

    it('답안 입력 → 임시 세션 저장, 배너→이어하기로 복원', () => {
        startSimSession(EXAM);
        jumpToSimQuestion(1);            // 드래프트는 답안 저장 시점의 인덱스를 기록
        saveSimAnswer('simt1_q2', 'O', false);
        exitSimArena();

        // 임시 세션이 저장되어 배너 표시
        expect(storedJson(STORAGE_KEYS.SIM_DRAFT_SESSION)).not.toBeNull();
        checkExamDraft();
        expect(isVisible('draft-resume-banner')).toBe(true);
        expect(el('draft-banner-title').textContent).toContain('테스트 모의고사');
        expect(el('draft-banner-desc').textContent).toContain('풀이한 문항: 1/3');

        // 이어하기 → 답안·인덱스 복원
        resumeSimDraft();
        expect(simState.userAnswers['simt1_q2']).toBe('O');
        expect(simState.currentIndex).toBe(1);
        expect(isVisible('sim-arena-panel')).toBe(true);
        expect(el('draft-resume-banner').classList.contains('is-hidden')).toBe(true);
    });

    it('드래프트 없음 → 배너 숨김 유지', () => {
        checkExamDraft();
        expect(el('draft-resume-banner').classList.contains('is-hidden')).toBe(true);
    });

    it('제한시간 만료 → 자동 제출 + 결과 패널 (fake timers)', () => {
        vi.useFakeTimers();
        try {
            startSimSession(EXAM);
            saveSimAnswer('simt1_q1', '②', false);
            // 남은 시간 전부 경과
            vi.advanceTimersByTime(simState.timeLeft * 1000 + 1000);

            expect(showToast).toHaveBeenCalledWith(expect.stringContaining('제한 시간이 만료'), 'warning', 4000);
            expect(isVisible('sim-result-panel')).toBe(true);
            expect(el('sim-result-score').textContent).toContain('1 / 3');
        } finally {
            vi.useRealTimers();
        }
    });
});
