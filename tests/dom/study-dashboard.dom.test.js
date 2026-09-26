// tests/dom/study-dashboard.dom.test.js — 대시보드 통계·추천 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.2 (Phase 3)
// 검증: 진도 0건 렌더(E), 시딩 진도→통계 반영(H/P), 과목 카드·히트맵(H),
//       약점 과목 추천(H — 최소 3문 응시 조건·헷갈림 카드最多)

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import {
    loadIndexHtml, el,
    seedStudyData, seedProgress, resetStudyState,
} from './helpers.js';
import { updateGlobalStats, renderDashboard, renderAnalysisView } from '../../src/views/dashboard.js';
import { state } from '../../src/state.js';

function seedTwoSubjects() {
    seedStudyData('subja', {
        name: '과목1',
        cards: [
            { id: 'subja_card_1', term: 't1', definition: 'd' },
            { id: 'subja_card_2', term: 't2', definition: 'd' },
        ],
        quizzes: [],
    });
    seedStudyData('subjb', {
        name: '과목2',
        cards: [
            { id: 'subjb_card_1', term: 't3', definition: 'd' },
            { id: 'subjb_card_2', term: 't4', definition: 'd' },
        ],
        quizzes: [],
    });
}

describe('대시보드 — 통계·과목 카드·약점 추천', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
    });

    it('진도 0건 → 전체 통계 0 + 빈 추천 안내', () => {
        seedTwoSubjects();
        updateGlobalStats();
        renderDashboard();

        expect(el('total-cards-count').textContent).toBe('4');
        expect(el('memorized-cards-count').textContent).toBe('0');
        expect(el('weak-cards-count').textContent).toBe('0');
        expect(el('total-progress-val').textContent).toBe('0%');
        expect(el('solved-quizzes-count').textContent).toBe('0');
        expect(el('quiz-success-rate').textContent).toBe('0%');
        expect(el('weak-subject-recommendation').textContent).toContain('충분한 학습 데이터가 없습니다');
    });

    it('시딩 진도 → 암기율·정답률·복습 대기 반영', () => {
        seedTwoSubjects();
        seedProgress({
            memorized: ['subja_card_1', 'subja_card_2'],
            weak: ['subjb_card_1'],
            quizResults: {
                subja_quiz_1: { solved: true, correct: true },
                subja_quiz_2: { solved: true, correct: true },
                subjb_quiz_1: { solved: true, correct: false },
            },
        });
        updateGlobalStats();

        expect(el('memorized-cards-count').textContent).toBe('2');
        expect(el('weak-cards-count').textContent).toBe('1');
        expect(el('review-card-count').textContent).toBe('1');
        expect(el('total-progress-val').textContent).toBe('50%'); // 2/4
        expect(el('solved-quizzes-count').textContent).toBe('3');
        expect(el('quiz-success-rate').textContent).toBe('67%'); // 2/3
    });

    it('과목 카드 → 과목별 암기 수·퀴즈 정답률·진도율 렌더', () => {
        seedTwoSubjects();
        seedProgress({
            memorized: ['subja_card_1'],
            quizResults: {
                subja_quiz_1: { solved: true, correct: true },
                subja_quiz_2: { solved: true, correct: false },
            },
        });
        renderDashboard();

        const cards = el('subject-cards-container').querySelectorAll('.subject-card');
        expect(cards.length).toBe(2);

        const subjaCard = cards[0].textContent;
        expect(subjaCard).toContain('과목1');
        expect(subjaCard).toContain('1 / 2');   // 암기 1/2
        expect(subjaCard).toContain('50%');      // 정답률 1/2, 진도율 1/2
        expect(subjaCard).toContain('2문');

        const subjbCard = cards[1].textContent;
        expect(subjbCard).toContain('과목2');
        expect(subjbCard).toContain('0 / 2');
    });

    it('히트맵 → 미응시·정답률 구간 셀 렌더', () => {
        seedTwoSubjects();
        seedProgress({
            quizResults: {
                subja_quiz_1: { solved: true, correct: true },
                subja_quiz_2: { solved: true, correct: true },
            },
        });
        renderDashboard();

        const cells = el('subject-heatmap').querySelectorAll('.heatmap-cell');
        expect(cells.length).toBe(2);
        expect(cells[0].querySelector('.heatmap-value').textContent).toBe('100%');
        expect(cells[1].querySelector('.heatmap-value').textContent).toBe('미응시');
    });

    it('약점 과목 추천 → 3문 이상 응시 과목 중 최저 정답률 + 헷갈림 最多', () => {
        seedTwoSubjects();
        seedProgress({
            weak: ['subja_card_1'],
            quizResults: {
                // 과목1: 3문 全正 (100%) — 추천 대상 아님
                subja_quiz_1: { solved: true, correct: true },
                subja_quiz_2: { solved: true, correct: true },
                subja_quiz_3: { solved: true, correct: true },
                // 과목2: 3문 중 1正 (33%) — 최저 정답률 추천
                subjb_quiz_1: { solved: true, correct: false },
                subjb_quiz_2: { solved: true, correct: false },
                subjb_quiz_3: { solved: true, correct: true },
            },
        });
        renderDashboard();

        const rec = el('weak-subject-recommendation').textContent;
        expect(rec).toContain('정답률 최저');
        expect(rec).toContain('과목2');
        expect(rec).toContain('33%');
        expect(rec).toContain('헷갈린 카드');
        expect(rec).toContain('과목1');
        expect(rec).toContain('1장');
    });

    it('응시 3문 미만 → 정답률 추천 제외 (헷갈림 추천만)', () => {
        seedTwoSubjects();
        seedProgress({
            weak: ['subjb_card_1'],
            quizResults: {
                subja_quiz_1: { solved: true, correct: false }, // 2문만 응시 → 제외
                subja_quiz_2: { solved: true, correct: false },
            },
        });
        renderDashboard();

        const rec = el('weak-subject-recommendation').textContent;
        expect(rec).not.toContain('정답률 최저');
        expect(rec).toContain('과목2'); // 헷갈린 카드最多 추천은 유지
    });
});

describe('내 맞춤 분석 뷰 — 진단 요약 카드', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        state.wrongCauses = {};
        loadIndexHtml();
    });

    it('빈 데이터 → 분석 뷰 렌더 + 안내 카드 3종', () => {
        seedTwoSubjects();
        renderAnalysisView();

        // 과목 카드·히트맵은 analysis-view로 이동해도 ID 기반 렌더 유지
        expect(el('subject-cards-container').querySelectorAll('.subject-card').length).toBe(2);
        expect(el('subject-heatmap').querySelectorAll('.heatmap-cell').length).toBe(2);

        expect(el('analysis-wrong-cause').textContent).toContain('오답 패턴');
        expect(el('analysis-weak-statements').textContent).toContain('취약 진술');
        expect(el('analysis-study-rhythm').textContent).toContain('학습 리듬');
    });

    it('오답 원인 태그 → 분포와 권장 학습법 표시', () => {
        seedTwoSubjects();
        state.wrongCauses = {
            subja_quiz_1: { cause: 'memorize', ts: Date.now(), subjectId: 'subja' },
            subja_quiz_2: { cause: 'memorize', ts: Date.now(), subjectId: 'subja' },
            subjb_quiz_1: { cause: 'calc', ts: Date.now(), subjectId: 'subjb' },
        };
        renderAnalysisView();

        const card = el('analysis-wrong-cause').textContent;
        expect(card).toContain('암기 부족');
        expect(card).toContain('3건');
        expect(card).toContain('플래시카드');
    });
});
