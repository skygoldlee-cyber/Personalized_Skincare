// tests/dom/study-trainer-drills.dom.test.js — O/X·복수정답형 드릴 + 취약 리뷰 시나리오
// 커버리지 갭 보강: trainer-drills.js (setup→arena→result 파이프라인,
// 진술 판정 토글·소거 표시·키보드 단축키·취약 리뷰 렌더링)

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    trapFocus: vi.fn(() => () => {}),
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
    loadIndexHtml, el, isVisible, resetStudyState, flushAsync,
} from './helpers.js';
import { state } from '../../src/state.js';
import { DataLoader } from '../../src/data-loader.js';
import {
    setDrillCount, updateDueBadges,
    openOxDrillSetup, startOxDrill, nextOxDrill,
    openComboDrillSetup, startComboDrill, submitComboJudgments, nextComboDrill,
    openWeakReview, setWeakFilter,
} from '../../src/views/trainer-drills.js';
import { recordStatementJudgments } from '../../src/statement-tracker.js';
import { safeSetItem } from '../../src/state.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

const OX_ITEMS = [
    { type: 'ox', sid: 'law_1', context: '법규·제3조', stem: '판정하세요', statement: '진술A는 옳다', truth: true, explain: 'A 해설', tags: ['수치'] },
    { type: 'ox', sid: 'law_2', context: '법규·제4조', stem: '', statement: '진술B는 틀리다', truth: false, explain: 'B 해설' },
];

const COMBO_ITEM = {
    type: 'combo', subject: 1, citation: '화장품법 제3조',
    stem: '다음 중 옳은 것을 모두 고르면?',
    statements: [
        { id: 'ㄱ', sid: 'law_3', text: '진술 ㄱ은 참', truth: true, explain: 'ㄱ 해설' },
        { id: 'ㄴ', sid: 'law_4', text: '진술 ㄴ은 거짓', truth: false, explain: 'ㄴ 해설' },
    ],
    options: [
        { id: '1', members: ['ㄱ'] },
        { id: '2', members: ['ㄴ'] },
        { id: '3', members: ['ㄱ', 'ㄴ'] },
        { id: '4', members: [] },
    ],
    explain: '콤보 해설',
};

function stubDrillData() {
    DataLoader.registry = {
        subjects: [
            { key: 'law', name: '화장품법규', shortName: '법규', order: 1 },
            { key: 'manu', name: '화장품제조', shortName: '제조', order: 2 },
        ],
        exams: [],
    };
    // _examKeyForOrder(1|2) → 'subjectN' (exams 엔트리 없으므로 폴백)
    DataLoader._loadedDrills.subject1 = OX_ITEMS;
    DataLoader._loadedDrills.subject2 = [];
    DataLoader._loadedDrills.combo_subject1 = [COMBO_ITEM];
    DataLoader._loadedDrills.combo_subject2 = [];
}

function oxButtons() {
    return [...el('oxdrill-ox-container').querySelectorAll('.oxdrill-ox-btn')];
}

describe('트레이너 드릴 — O/X·복수정답형·취약 리뷰', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
        stubDrillData();
    });

    it('openOxDrillSetup → 패널 표시 + 과목 버튼 생성', () => {
        openOxDrillSetup();
        expect(isVisible('trainer-oxdrill-panel')).toBe(true);
        expect(el('trainer-menu-panel').classList.contains('is-hidden')).toBe(true);
        expect(isVisible('oxdrill-setup')).toBe(true);
        const btns = el('oxdrill-subject-grid').querySelectorAll('button');
        expect(btns.length).toBe(2);
        expect(btns[0].dataset.arg).toBe('1');
        expect(btns[0].textContent).toContain('법규');
    });

    it('startOxDrill → 문항 렌더 → O 클릭 → 피드백 → next → 결과 화면', async () => {
        startOxDrill(1);
        await flushAsync();

        expect(isVisible('oxdrill-arena')).toBe(true);
        expect(el('oxdrill-progress-indicator').textContent).toBe('문제 1 / 2');
        const btns = oxButtons();
        expect(btns.length).toBe(2);
        expect(btns[0].dataset.ox).toBe('O');

        // O 버튼 클릭 → 정오 판정 + 피드백 + 다음 버튼 노출
        btns[0].click();
        expect(isVisible('oxdrill-feedback-panel')).toBe(true);
        expect(isVisible('next-oxdrill-btn')).toBe(true);
        expect(oxButtons().every(b => b.disabled)).toBe(true);
        expect(el('oxdrill-feedback-title').textContent).toContain(
            el('oxdrill-statement').textContent.includes('진술A') ? '정답' : '오답');

        // 마지막 문항까지 진행 → 결과 화면
        nextOxDrill();
        oxButtons()[0].click();
        nextOxDrill();
        expect(isVisible('oxdrill-result')).toBe(true);
        expect(el('oxdrill-arena').classList.contains('is-hidden')).toBe(true);
        expect(el('oxdrill-result').textContent).toContain('O/X 드릴 완료');
        expect(el('oxdrill-result').textContent).toContain('정답수');
    });

    it('startOxDrill: 유효하지 않은 과목은 무시, 빈 과목은 토스트', async () => {
        startOxDrill(99);
        await flushAsync();
        expect(state.trainer.activeSubView).not.toBe('oxdrill');

        startOxDrill(2); // subject2 = 빈 배열
        await flushAsync();
        expect(showToast).toHaveBeenCalledWith(
            expect.stringContaining('출제 가능한'), 'warning');
    });

    it('startOxDrill 특수 모드 — sid: 단건, num 태그 필터', async () => {
        startOxDrill('sid:law_2');
        await flushAsync();
        expect(state.trainer.oxdrill.data.length).toBe(1);
        expect(state.trainer.oxdrill.data[0].sid).toBe('law_2');
        expect(el('oxdrill-statement').textContent).toContain('진술B');

        // 'num' 모드는 NUM_FOCUS_TAGS(수치 등) 태그 문항만 — 진술A만 해당
        startOxDrill('num');
        await flushAsync();
        expect(state.trainer.oxdrill.data.every(q => (q.tags || []).some(t => t === '수치'))).toBe(true);
    });

    it('setDrillCount → 두 setup의 칩이 동기화된다', () => {
        // index.html 실제 칩: ox/combo setup 각각 10/20/all
        setDrillCount('all');
        document.querySelectorAll('.drill-count-chip').forEach(chip => {
            expect(chip.classList.contains('active'))
                .toBe(chip.dataset.arg === 'all');
        });
        setDrillCount('10');
        document.querySelectorAll('.drill-count-chip').forEach(chip => {
            expect(chip.classList.contains('active'))
                .toBe(chip.dataset.arg === '10');
        });
    });

    it('updateDueBadges → 복습 대상/취약 수 표시', () => {
        recordStatementJudgments([{ sid: 'law_9', judgedCorrect: false, text: 't', truth: true }]);
        // SR 스케줄이 과거면 "복습 대상" 라벨
        safeSetItem(STORAGE_KEYS.FC_SPACED_REPETITION,
            JSON.stringify({ law_9: { nextReview: '2000-01-01' } }));
        updateDueBadges();
        expect(el('oxdrill-due-badge').textContent).toContain('복습 대상 1개');
        expect(el('oxdrill-due-count').textContent).toContain('복습 기한 도래');

        localStorage.clear();
        updateDueBadges();
        expect(el('oxdrill-due-badge').classList.contains('is-hidden')).toBe(true);
    });

    it('O/X 드릴 키보드 단축키 — o/x 키 판정, Enter로 다음 문항', async () => {
        startOxDrill(1);
        await flushAsync();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', bubbles: true }));
        expect(isVisible('oxdrill-feedback-panel')).toBe(true);

        // data-click 위임은 app.js 바인딩이라 테스트에서는 수동 연결 —
        // Enter → 버튼 click() 디스패치까지만 검증한다
        el('next-oxdrill-btn').addEventListener('click', () => nextOxDrill());
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(el('oxdrill-progress-indicator').textContent).toBe('문제 2 / 2');
    });

    it('복수정답형 — 진술 판정 토글 → 소거 표시 → 제출 → 결과', async () => {
        openComboDrillSetup();
        expect(isVisible('trainer-combo-panel')).toBe(true);

        startComboDrill(1);
        await flushAsync();
        expect(isVisible('combo-arena')).toBe(true);
        expect(el('combo-citation').textContent).toBe('화장품법 제3조');
        expect(el('combo-statements').querySelectorAll('.combo-stmt').length).toBe(2);
        // 전부 판정 전에는 제출 버튼 비활성
        expect(el('combo-judge-submit').disabled).toBe(true);

        // ㄱ=O 판정 → ㄱ 미포함 선지(②,④) 소거 표시
        const row1 = el('combo-statements').querySelector('[data-stmt-id="ㄱ"]');
        row1.querySelector('[data-v="true"]').click();
        expect(state.trainer.combo.judgments['ㄱ']).toBe(true);
        const optBtns = el('combo-options-container').querySelectorAll('.limits-opt-btn');
        expect(optBtns[1].classList.contains('eliminated')).toBe(true); // ②(ㄴ)
        expect(optBtns[3].classList.contains('eliminated')).toBe(true); // ④(없음)
        expect(el('combo-judge-hint').textContent).toContain('1/2');

        // 같은 버튼 재클릭 → 판정 해제
        row1.querySelector('[data-v="true"]').click();
        expect('ㄱ' in state.trainer.combo.judgments).toBe(false);

        // ㄱ=O, ㄴ=X 판정 → 조합 'ㄱ' → 선지 ①와 일치 힌트 + 제출 활성
        row1.querySelector('[data-v="true"]').click();
        el('combo-statements').querySelector('[data-stmt-id="ㄴ"]')
            .querySelector('[data-v="false"]').click();
        expect(el('combo-judge-hint').textContent).toContain('일치합니다');
        expect(el('combo-judge-submit').disabled).toBe(false);

        submitComboJudgments();
        expect(isVisible('combo-feedback-panel')).toBe(true);
        expect(el('combo-feedback-title').textContent).toContain('정답');
        expect(state.trainer.combo.correctCount).toBe(1);
        // 진술별 피드백 렌더
        expect(el('combo-feedback-statements').querySelectorAll('.combo-fb-stmt').length).toBe(2);

        nextComboDrill(); // 마지막 문항 → 결과 화면
        expect(isVisible('combo-result')).toBe(true);
        expect(el('combo-result').textContent).toContain('복수정답형 드릴 완료');
    });

    it('복수정답형 — 선지 직접 선택 경로 + 오답 피드백', async () => {
        startComboDrill(1);
        await flushAsync();
        // 정답은 ①(ㄱ). ③(ㄱㄴ)을 고르면 오답 + 진술 판정 자동 유도
        el('combo-options-container').querySelectorAll('.limits-opt-btn')[2].click();
        expect(el('combo-feedback-title').textContent).toContain('오답');
        expect(state.trainer.combo.correctCount).toBe(0);
        // ㄴ을 참으로 판정한 셈 → 오판 표시(misjudged)
        expect(el('combo-feedback-statements').innerHTML).toContain('misjudged');
    });

    it('복수정답형 키보드 단축키 — 숫자키로 선지 선택', async () => {
        startComboDrill(1);
        await flushAsync();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
        expect(isVisible('combo-feedback-panel')).toBe(true);
        expect(state.trainer.combo.correctCount).toBe(1);
    });

    it('취약 리뷰 — 오판 진술 렌더 + 과목 배지 + 필터 전환', () => {
        recordStatementJudgments([
            { sid: 'law_1', judgedCorrect: false, text: '취약 진술 본문', truth: true },
            { sid: 'law_1', judgedCorrect: false },
            { sid: 'law_2', judgedCorrect: false, text: '다른 진술', truth: false },
        ]);
        safeSetItem(STORAGE_KEYS.FC_SPACED_REPETITION,
            JSON.stringify({ law_1: { nextReview: '2000-01-01' } }));

        openWeakReview();
        expect(isVisible('trainer-weak-panel')).toBe(true);
        expect(el('weak-summary').textContent).toContain('취약 진술 2개');
        expect(el('weak-summary').textContent).toContain('복습 대상 1개');

        const rows = el('weak-list').querySelectorAll('.weak-row');
        expect(rows.length).toBe(2);
        expect(rows[0].innerHTML).toContain('오판 2회'); // w 내림차순
        expect(rows[0].innerHTML).toContain('과목1'); // sid 'law_' → 과목 키 해석
        expect(rows[0].innerHTML).toContain('복습 대상');
        expect(rows[0].innerHTML).toContain('취약 진술 본문');

        // 'due' 필터 → 복습 대상만
        setWeakFilter('due');
        expect(el('weak-list').querySelectorAll('.weak-row').length).toBe(1);
        setWeakFilter('all');
        expect(el('weak-list').querySelectorAll('.weak-row').length).toBe(2);
    });

    it('취약 리뷰 — 기록 없으면 빈 상태 안내', () => {
        openWeakReview();
        expect(el('weak-summary').textContent).toContain('오판 이력이 없습니다');
        expect(el('weak-list').textContent).toContain('취약 진술이 없습니다');
    });
});
