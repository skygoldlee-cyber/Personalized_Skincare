// tests/dom/study-quiz.dom.test.js — 기출 퀴즈·오답 복습 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.2 (Phase 3)
// 검증: 출제→렌더(H), 빈 과목(E), 단답/객관식/OX 채점(H), 완주→결과(H),
//       오답 영속(P), 재시작 초기화(R), 복습 목록·약점 퀴즈(H/P)

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
    loadIndexHtml, el, isVisible,
    seedStudyData, seedProgress, resetStudyState, storedJson,
} from './helpers.js';
import { state } from '../../src/state.js';
import {
    startQuiz, renderQuizQuestion, submitQuizAnswer, nextQuizQuestion,
    renderReviewList, removeWeakCard, setReviewFilter, startWeakFocusQuiz,
} from '../../src/views/quiz.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

const QUIZZES = [
    { id: 'subj1_quiz_1', type: 'short', category: '법령', context: '화장품법', question: '맞춤형화장품 [빈칸]를 두어야 한다.', answer: '조제관리사' },
    { id: 'subj1_quiz_2', type: 'choice', category: '성분', context: '보존제', question: '파라벤의 사용한도는?', options: ['0.4%', '1.0%', '2.0%', '5.0%'], answer: '②' },
    { id: 'subj1_quiz_3', type: 'ox', category: '안전', context: '어린이 용기', question: '5세 미만 어린이용 제품은 안전용기를 사용한다.', answer: 'O' },
];

function setupQuiz() {
    seedStudyData('subj1', {
        name: '과목1',
        cards: [{ id: 'subj1_card_1', term: '조제관리사', definition: '맞춤형화장품 조제 담당 자격', category: '자격' }],
        quizzes: QUIZZES,
    });
    state.quiz.subject = 'subj1';
}

/** startQuiz 후 덱을 결정적으로 고정 — shuffle 우연에 의존하지 않게 함 */
function startWithDeck(deck) {
    startQuiz();
    state.quiz.data = deck.slice();
    state.quiz.currentIndex = 0;
    renderQuizQuestion();
}

describe('기출 퀴즈 — 출제·채점·결과·복습', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    it('퀴즈 시작 → 아레나 표시·진행률·문제 렌더', () => {
        setupQuiz();
        startQuiz();

        expect(isVisible('quiz-arena-panel')).toBe(true);
        expect(el('quiz-empty-state').classList.contains('is-hidden')).toBe(true);
        expect(state.quiz.data.length).toBe(3); // 최대 10문제 슬라이스
        expect(el('quiz-curr-idx').textContent).toBe('1');
        expect(el('quiz-total-idx').textContent).toBe('3');
        expect(el('quiz-question').innerHTML).not.toBe('');
    });

    it('퀴즈 없는 과목 → 경고 토스트 + 아레나 미표시', () => {
        seedStudyData('subj_empty', { name: '빈과목', cards: [], quizzes: [] });
        state.quiz.subject = 'subj_empty';
        startQuiz();

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('퀴즈가 없습니다'), 'warning');
        expect(el('quiz-arena-panel').classList.contains('is-hidden')).toBe(true);
    });

    it('단답형 정답 → 채점·피드백·결과 영속', () => {
        setupQuiz();
        startWithDeck([QUIZZES[0]]);

        el('quiz-answer-input').value = '조제관리사';
        submitQuizAnswer();

        expect(state.quiz.correctCount).toBe(1);
        expect(el('feedback-result-title').textContent).toBe('정답입니다!');
        expect(isVisible('quiz-feedback-panel')).toBe(true);
        expect(isVisible('next-quiz-btn')).toBe(true);
        expect(el('quiz-answer-input').disabled).toBe(true);
        expect(state.quizResults['subj1_quiz_1']).toEqual({ solved: true, correct: true });
        expect(storedJson(STORAGE_KEYS.QUIZ_RESULTS)['subj1_quiz_1'].correct).toBe(true);
    });

    it('단답형 오답 → incorrect 피드백 + 오답 영속', () => {
        setupQuiz();
        startWithDeck([QUIZZES[0]]);

        el('quiz-answer-input').value = '판매관리사';
        submitQuizAnswer();

        expect(state.quiz.correctCount).toBe(0);
        expect(el('quiz-feedback-panel').classList.contains('incorrect')).toBe(true);
        expect(el('feedback-result-title').textContent).toContain('틀렸습니다');
        expect(storedJson(STORAGE_KEYS.QUIZ_RESULTS)['subj1_quiz_1'].correct).toBe(false);
    });

    it('빈 답안 → 경고 토스트, 채점 미진행', () => {
        setupQuiz();
        startWithDeck([QUIZZES[0]]);

        submitQuizAnswer();
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('답변을 입력'), 'warning');
        expect(state.quiz.solvedList.length).toBe(0);
    });

    it('객관식 → 옵션 버튼 렌더, 오답 클릭 시 정답 하이라이트', () => {
        setupQuiz();
        startWithDeck([QUIZZES[1]]);

        const opts = el('quiz-options-container').querySelectorAll('button');
        expect(opts.length).toBe(4);
        expect(isVisible('quiz-options-container')).toBe(true);
        expect(el('quiz-input-group').classList.contains('is-hidden')).toBe(true);

        opts[0].click(); // ① 오답 (정답 ②)
        expect(opts[0].classList.contains('incorrect')).toBe(true);
        expect(opts[1].classList.contains('correct')).toBe(true);
        expect(state.quizResults['subj1_quiz_2'].correct).toBe(false);
        opts.forEach(b => expect(b.disabled).toBe(true));
    });

    it('OX → O/X 버튼 채점', () => {
        setupQuiz();
        startWithDeck([QUIZZES[2]]);

        const oxBtns = el('quiz-ox-container').querySelectorAll('.quiz-ox-btn');
        oxBtns[0].click(); // O = 정답

        expect(state.quiz.correctCount).toBe(1);
        expect(oxBtns[0].classList.contains('correct')).toBe(true);
        expect(state.quizResults['subj1_quiz_3'].correct).toBe(true);
    });

    it('완주 → 결과 화면(점수·오답 리뷰) + 아레나 숨김', () => {
        setupQuiz();
        startWithDeck([QUIZZES[0]]);

        el('quiz-answer-input').value = '오답';
        submitQuizAnswer();
        nextQuizQuestion(); // 마지막 → 결과 화면

        expect(el('quiz-arena-panel').classList.contains('is-hidden')).toBe(true);
        expect(isVisible('quiz-result-panel')).toBe(true);
        expect(el('result-correct-num').textContent).toBe('0');
        expect(el('result-total-num').textContent).toBe('1');
        expect(el('result-percent').textContent).toBe('0%');
        expect(el('quiz-review-list').textContent).toContain('오답 리뷰');
    });

    it('전부 정답 → "모든 문제를 맞혔습니다" 리뷰', () => {
        setupQuiz();
        startWithDeck([QUIZZES[0]]);
        el('quiz-answer-input').value = '조제관리사';
        submitQuizAnswer();
        nextQuizQuestion();

        expect(el('quiz-review-list').textContent).toContain('모든 문제를 맞혔습니다');
        expect(el('result-percent').textContent).toBe('100%');
    });

    it('중도 재시작 → 진행 상태 초기화', () => {
        setupQuiz();
        startWithDeck([QUIZZES[0]]);
        el('quiz-answer-input').value = 'x';
        submitQuizAnswer();
        expect(state.quiz.solvedList.length).toBe(1);

        // 다시 시작 → 초기화
        startQuiz();
        expect(state.quiz.currentIndex).toBe(0);
        expect(state.quiz.correctCount).toBe(0);
        expect(state.quiz.solvedList.length).toBe(0);
    });

    it('약점 카드 없음 → 복습 빈 상태 + 버튼 숨김', () => {
        renderReviewList();
        expect(isVisible('review-empty-state')).toBe(true);
        expect(el('start-weak-quiz-btn').classList.contains('is-hidden')).toBe(true);
    });

    it('약점 카드 → 복습 목록 렌더 + 제외 시 영속 반영', () => {
        seedProgress({ weak: ['subj1_card_1'] });
        setupQuiz();
        renderReviewList();

        const container = el('review-cards-list-container');
        expect(container.textContent).toContain('조제관리사');
        expect(el('review-empty-state').classList.contains('is-hidden')).toBe(true);
        expect(isVisible('start-weak-quiz-btn')).toBe(true);

        removeWeakCard('subj1_card_1');
        expect(state.weakCards.size).toBe(0);
        expect(storedJson(STORAGE_KEYS.FC_WEAK)).toEqual([]);
    });

    it('약점 집중 퀴즈 → 약점 카드로 출제, 정답 시 약점 해제·영속', () => {
        seedProgress({ weak: ['subj1_card_1'] });
        setupQuiz();
        startWeakFocusQuiz();

        // 약점 카드 → 단답형(term) 문제로 변환
        expect(state.quiz.data.length).toBe(1);
        expect(state.quiz.data[0].answer).toBe('조제관리사');
        expect(isVisible('quiz-arena-panel')).toBe(true);

        el('quiz-answer-input').value = '조제관리사';
        submitQuizAnswer();

        // 정답 → 약점 목록에서 해제되어 localStorage에도 반영
        expect(state.weakCards.has('subj1_card_1')).toBe(false);
        expect(storedJson(STORAGE_KEYS.FC_WEAK)).toEqual([]);
    });

    it('복습 과목 필터 → 해당 과목 카드만 표시', () => {
        seedStudyData('subj2', { name: '과목2', cards: [{ id: 'subj2_card_1', term: '다른과목카드', definition: 'd', category: 'c' }], quizzes: [] });
        seedProgress({ weak: ['subj1_card_1', 'subj2_card_1'] });
        setupQuiz();

        setReviewFilter('subj2');
        const container = el('review-cards-list-container');
        expect(container.textContent).toContain('다른과목카드');
        expect(container.textContent).not.toContain('조제관리사');
    });
});
