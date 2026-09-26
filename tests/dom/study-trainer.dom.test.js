// tests/dom/study-trainer.dom.test.js — 스마트 훈련소 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 메뉴/서브뷰 전이(R) · 수치 훈련 채점(H) · 계산 연습 정답/오답/비수치(X)
//       · 원료 챌린지 객관식(H/B) · 취약 진술 집계·리뷰(H)
// 스크래치패드는 jsdom canvas 미지원으로 모킹

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));
vi.mock('../../src/scratchpad.js', () => ({
    clearScratchpad: vi.fn(),
    initScratchpad: vi.fn(),
    toggleCalcScratchpad: vi.fn(),
    toggleScratchpadEraser: vi.fn(),
    scratchpadUndo: vi.fn(),
}));

import { showToast } from '../../src/ui-utils.js';
import {
    loadIndexHtml, el, isVisible, resetStudyState, storedJson,
} from './helpers.js';
import { state } from '../../src/state.js';
import {
    initTrainer, exitTrainerSubView,
    startLimitsTrainer, renderLimitsQuestion, submitLimitsAnswer, nextLimitsQuestion,
    startCalcPractice, generateCalcQuestion, submitCalcAnswer,
    startIngredientsChallenge, renderIngQuestion,
} from '../../src/views/trainer.js';
import { openWeakReview, setWeakFilter } from '../../src/views/trainer-drills.js';
import { recordStatementJudgments } from '../../src/statement-tracker.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

describe('스마트 훈련소 — 수치·계산·원료·취약 리뷰', () => {
    // 선택지 버튼의 표시 문자열("<값><단위> 이하/이상")에서 원본 수치만 추출 —
    // '5'가 '50'·'0.5'에 부분문자열로 매칭되는 오선택을 방지 (flaky 원인)
    function limitsOptValue(btn, unit) {
        const t = btn.querySelector('.limits-opt-text').textContent.trim();
        return t.replace(/\s*(이하|이상)\s*$/, '').split(unit).join('').trim();
    }

    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    it('initTrainer → 메뉴 표시 + 서브 패널 전부 숨김 (재진입 초기화)', () => {
        // 먼저 서브뷰를 연 뒤 초기화
        startLimitsTrainer();
        expect(isVisible('trainer-limits-panel')).toBe(true);

        initTrainer();
        expect(isVisible('trainer-menu-panel')).toBe(true);
        ['trainer-limits-panel', 'trainer-calc-panel', 'trainer-ingredients-panel',
            'trainer-oxdrill-panel', 'trainer-combo-panel', 'trainer-weak-panel']
            .forEach(id => expect(el(id).classList.contains('is-hidden')).toBe(true));
    });

    it('수치 훈련 → 문제·4지선다 렌더, 정답 클릭 → 정답 피드백', () => {
        startLimitsTrainer();

        const cur = state.trainer.limits.shuffledData[0];
        expect(el('limits-progress-indicator').textContent).toContain('1 /');
        expect(el('limits-q-category').textContent).toBe(cur.category);
        expect(el('limits-question-text').innerHTML).toContain(cur.key);

        const opts = el('limits-options-container').querySelectorAll('.limits-opt-btn');
        expect(opts.length).toBe(4);

        // 정답 수치와 정확히 일치하는 버튼을 찾아 클릭
        const correctBtn = [...opts].find(b => limitsOptValue(b, cur.unit) === cur.value);
        correctBtn.click();

        expect(state.trainer.limits.correctCount).toBe(1);
        expect(el('limits-feedback-title').textContent).toBe('정답입니다!');
        expect(isVisible('limits-feedback-panel')).toBe(true);
        expect(isVisible('next-limits-btn')).toBe(true);
        opts.forEach(b => expect(b.disabled).toBe(true));
    });

    it('수치 훈련 오답 → incorrect 표시 + 정답 하이라이트 + solvedList 기록', () => {
        startLimitsTrainer();
        const cur = state.trainer.limits.shuffledData[0];
        const opts = el('limits-options-container').querySelectorAll('.limits-opt-btn');
        const wrongBtn = [...opts].find(b => limitsOptValue(b, cur.unit) !== cur.value);
        wrongBtn.click();

        expect(state.trainer.limits.correctCount).toBe(0);
        expect(el('limits-feedback-panel').classList.contains('incorrect')).toBe(true);
        expect(el('limits-feedback-title').textContent).toContain('오답입니다');
        expect(el('limits-feedback-desc').textContent).toBe(cur.explanation);
        expect(state.trainer.limits.solvedList.length).toBe(1);
        expect(state.trainer.limits.solvedList[0].correct).toBe(false);
    });

    it('수치 훈련 완주 → 결과 화면(훈련 완료·정답률)', () => {
        startLimitsTrainer();
        const total = state.trainer.limits.shuffledData.length;
        for (let i = 0; i < total; i++) nextLimitsQuestion();

        expect(el('trainer-limits-panel').textContent).toContain('훈련 완료');
        expect(el('trainer-limits-panel').textContent).toContain(`0 / ${total}`);
    });

    it('계산 연습 → 문제 렌더 + 정답 제출 → 피드백·이력 영속', () => {
        startCalcPractice();

        expect(isVisible('trainer-calc-panel')).toBe(true);
        const q = state.trainer.calc.currentQuestion;
        expect(q).not.toBeNull();
        expect(el('calc-question-text').innerHTML).not.toBe('');

        el('calc-answer-input').value = q.answer;
        submitCalcAnswer();

        expect(state.trainer.calc.correctCount).toBe(1);
        expect(el('calc-feedback-title').textContent).toBe('정답입니다!');
        expect(isVisible('calc-solution-panel')).toBe(true);
        expect(el('calc-answer-input').disabled).toBe(true);
        // 이력 저장
        const hist = storedJson(STORAGE_KEYS.CALC_HISTORY);
        expect(hist.length).toBe(1);
        expect(hist[0].isCorrect).toBe(true);
        expect(el('calc-history-list').textContent).toContain('정답');
    });

    it('계산 연습 오답 → 오답 피드백 + 이력에 오답 기록', () => {
        startCalcPractice();
        const q = state.trainer.calc.currentQuestion;

        el('calc-answer-input').value = String(parseFloat(q.answer) + 50);
        submitCalcAnswer();

        expect(state.trainer.calc.correctCount).toBe(0);
        expect(el('calc-feedback-panel').classList.contains('incorrect')).toBe(true);
        expect(el('calc-feedback-title').textContent).toContain('오답입니다');
        expect(storedJson(STORAGE_KEYS.CALC_HISTORY)[0].isCorrect).toBe(false);
    });

    it('계산 연습 비수치 입력 → 경고 토스트, 채점 미진행 (X)', () => {
        startCalcPractice();
        el('calc-answer-input').value = 'abc';
        submitCalcAnswer();

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('숫자'), 'warning');
        expect(state.trainer.calc.totalSolved).toBe(0);
    });

    it('원료 챌린지 → 안전성 판별 객관식 렌더 + 정답 채점 (approved/banned만 시딩해 choice 확정)', () => {
        window.INGREDIENTS_DATA = [
            { name: '글리세린', engName: 'Glycerin', type: 'approved', category: '보습제' },
            { name: '금지원료X', engName: 'Banned X', type: 'banned', category: '금지' },
        ];
        startIngredientsChallenge();

        expect(isVisible('trainer-ingredients-panel')).toBe(true);
        const qs = state.trainer.ingredients.shuffledQuestions;
        expect(qs.length).toBe(2);
        // approved/banned 원료는 모두 choice 문항으로 생성됨
        qs.forEach(q => expect(q.type).toBe('choice'));

        const cur = qs[0];
        const opts = el('ing-options-container').querySelectorAll('.limits-opt-btn');
        const correctBtn = [...opts].find(b => b.querySelector('.limits-opt-text').textContent === cur.correct);
        correctBtn.click();

        expect(state.trainer.ingredients.correctCount).toBe(1);
        expect(el('ing-feedback-title').textContent).toContain('정답');
    });

    it('원료 DB 없음 → 경고 토스트 + 메뉴 유지, 크래시 없음 (E/X)', () => {
        startIngredientsChallenge();
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('원료 데이터'), 'warning');
        expect(state.trainer.ingredients.shuffledQuestions.length).toBe(0);
        expect(el('trainer-menu-panel').classList.contains('is-hidden')).toBe(false);
    });

    it('취약 리뷰 → 오판 시딩 시 취약 진술 목록·요약 렌더', () => {
        recordStatementJudgments([
            { sid: 'subja_s1', judgedCorrect: false },
            { sid: 'subja_s1', judgedCorrect: false },
            { sid: 'subja_s2', judgedCorrect: true },
        ]);
        openWeakReview();

        expect(isVisible('trainer-weak-panel')).toBe(true);
        expect(el('weak-summary').textContent).toContain('취약 진술');
        expect(el('weak-list').textContent).toContain('오판');
        expect(el('weak-list').querySelectorAll('.weak-row').length).toBe(1);
    });

    it('취약 리뷰 비어있음 → 안내 문구 (E)', () => {
        openWeakReview();
        expect(el('weak-summary').textContent).toContain('오판 이력이 없습니다');
    });

    it('exitTrainerSubView → 메뉴 복귀', () => {
        openWeakReview();
        expect(isVisible('trainer-weak-panel')).toBe(true);
        exitTrainerSubView();
        expect(isVisible('trainer-menu-panel')).toBe(true);
        expect(el('trainer-weak-panel').classList.contains('is-hidden')).toBe(true);
    });
});
