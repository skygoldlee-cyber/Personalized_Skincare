// tests/dom/review-drills-formula.dom.test.js — 복습 뷰·숫자 드릴·배합 계산기 UI
// @spec RV-01,ND-01,FO-10,FO-11,DI-04,DI-05
// 오답/헷갈림 통합 복습 목록, number-drills JSON 기반 수치 암기표,
// 계산기 상하 고정바·카드형 행, 성분 사전 연동을 고정한다.

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    trapFocus: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { loadIndexHtml, el, resetStudyState } from './helpers.js';
import { state } from '../../src/state.js';
import { renderReviewList } from '../../src/views/quiz.js';
import { renderStudyAids, loadNumberDrills } from '../../src/study-aids.js';
import { formulaAddIngredient } from '../../src/exams/cosmetic/views/formula.js';
import { renderDictionary } from '../../src/views/dictionary.js';
import { DataLoader } from '../../src/data-loader.js';

/* ---------------- RV-01: 복습 뷰 ---------------- */

function mountReviewDom() {
    document.body.innerHTML = `
        <div id="review-cards-list-container"></div>
        <div id="review-empty-state" class="is-hidden"><h3></h3><p></p></div>
        <button id="print-review-btn" class="is-hidden"></button>
        <button id="start-weak-exam-btn" class="is-hidden"></button>
        <button id="start-weak-quiz-btn" class="is-hidden"></button>`;
}

function seedStudyData() {
    window.STUDY_DATA = {
        subja: {
            name: '과목A',
            cards: [{ id: 'card1', term: '화장품 정의', definition: '인체를 청결·미화', subjectId: 'subja' }],
            quizzes: [{ id: 'q1', question: '화장품법상 화장품의 정의는?', answer: '3번', category: '단일정답' }],
        },
    };
}

describe('RV-01: 오답·헷갈림 통합 복습 뷰', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        mountReviewDom();
        seedStudyData();
    });

    it('약점 카드 없으면 빈 상태 + 액션 버튼 숨김', () => {
        renderReviewList();
        expect(el('review-empty-state').classList.contains('is-hidden')).toBe(false);
        expect(el('start-weak-exam-btn').classList.contains('is-hidden')).toBe(true);
        expect(el('print-review-btn').classList.contains('is-hidden')).toBe(true);
    });

    it('헷갈림 카드·퀴즈 오답이 통합 목록으로 렌더된다', () => {
        state.weakCards.add('card1');
        state.weakCards.add('weak_quiz_q1');
        renderReviewList();
        const items = document.querySelectorAll('.review-card-item');
        expect(items.length).toBe(2);
        const html = el('review-cards-list-container').innerHTML;
        expect(html).toContain('화장품 정의');
        expect(html).toContain('[기출 퀴즈 오답]');
        expect(el('start-weak-exam-btn').classList.contains('is-hidden')).toBe(false);
        expect(el('print-review-btn').classList.contains('is-hidden')).toBe(false);
    });

    it('과목 필터 적용 시 해당 과목 카드만 표시된다', () => {
        state.weakCards.add('card1');
        state.weakCards.add('weak_quiz_q1');
        state.reviewFilter = 'subja';
        renderReviewList();
        expect(document.querySelectorAll('.review-card-item').length).toBe(2);

        state.reviewFilter = 'subjb';
        renderReviewList();
        expect(document.querySelectorAll('.review-card-item').length).toBe(0);
        expect(el('review-empty-state').classList.contains('is-hidden')).toBe(false);
    });
});

/* ---------------- ND-01: 숫자 암기 드릴 ---------------- */

const DRILL_FIXTURE = [
    {
        numbers: [{ number: '15', unit: '일' }],
        context: '중대 유해사례 신속보고',
        isKey: true,
        category: '📅 기한·기간',
    },
    {
        numbers: [{ number: '0.5', unit: '%' }],
        context: '살리실산 사용제한 농도',
        isKey: false,
        category: '💧 농도·함량',
    },
];

describe('ND-01: 숫자 암기 드릴 (number-drills JSON)', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (String(url).includes('number-drills/subja.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(DRILL_FIXTURE) });
            }
            return Promise.resolve({ ok: false, status: 404 });
        }));
    });

    it('과목별 JSON을 fetch하고 결과를 캐시한다', async () => {
        const data = await loadNumberDrills('subja');
        expect(data.length).toBe(2);
        await loadNumberDrills('subja');
        const calls = fetch.mock.calls.filter(c => String(c[0]).includes('subja'));
        expect(calls.length).toBe(1); // 두 번째 호출은 캐시 히트
    });

    it('없는 과목은 빈 배열로 폴백한다', async () => {
        const data = await loadNumberDrills('nonexistent');
        expect(data).toEqual([]);
    });

    it('renderStudyAids가 기출 우선 섹션 + 수치·단위·맥락을 렌더한다', async () => {
        const html = await renderStudyAids({ sections: [] }, 'subja');
        expect(html).toContain('number-drill-card');
        expect(html).toContain('기출·중요 숫자');
        expect(html).toContain('15');
        expect(html).toContain('일');
        expect(html).toContain('유해사례');
    });
});

/* ---------------- FO-10/11: 배합 계산기 UI + 사전 연동 ---------------- */

describe('FO-10/11: 배합 계산기 UI·성분 사전 연동', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
    });

    it('FO-10: 상단 고정 요약바에 총량·합계·검증 슬롯이 있다', () => {
        const topBar = document.querySelector('#formula-calc-panel .fcb-top');
        expect(topBar).not.toBeNull();
        expect(topBar.querySelector('#formula-target-volume')).not.toBeNull();
        expect(topBar.querySelector('#formula-sum-conc')).not.toBeNull();
        expect(topBar.querySelector('#formula-check-summary')).not.toBeNull();
    });

    it('FO-10: 하단 고정 액션바에 이름·저장·인쇄·JSON 버튼이 있다', () => {
        const bottomBar = document.querySelector('#formula-calc-panel .fcb-bottom');
        expect(bottomBar).not.toBeNull();
        expect(bottomBar.querySelector('#formula-name-input')).not.toBeNull();
        const clicks = [...bottomBar.querySelectorAll('[data-click]')].map(b => b.dataset.click);
        for (const h of ['formulaCalcSave', 'formulaPrint', 'formulaExportJson']) {
            expect(clicks).toContain(h);
        }
    });

    it('FO-10: 카드형 원료 행 컨테이너·빈 상태·접이식 섹션이 있다', () => {
        expect(el('formula-calc-rows').classList.contains('formula-rows')).toBe(true);
        expect(el('formula-empty-state')).not.toBeNull();
        expect(document.querySelectorAll('#formula-calc-panel details.formula-fold').length).toBeGreaterThan(0);
    });

    it('FO-11: 사전 "포뮬러에 추가"가 계산기 드래프트에 원료 행을 추가한다', async () => {
        const { showToast } = await import('../../src/ui-utils.js');
        formulaAddIngredient('히알루론산나트륨');
        // 계산기 행 영역에 원료명이 렌더된다
        const rowsHtml = el('formula-calc-rows').innerHTML;
        expect(rowsHtml).toContain('히알루론산나트륨');
        expect(showToast).toHaveBeenCalled();
    });

    it('FO-11: 원료 DB 버전 배지가 registry 메타를 표시한다', () => {
        document.body.innerHTML += '<div id="dict-results-container"></div>';
        window.INGREDIENTS_DATA = [{ name: '테스트원료', eng: 'test', category: '보습제' }];
        // dictionary.js는 DataLoader.registry.knowledge(스키마) + registry.ingredients(메타)를 읽는다
        DataLoader.registry = {
            knowledge: { registryKey: 'ingredients', global: 'INGREDIENTS_DATA', entityUnit: '원료' },
            ingredients: { version: '1.2.3', stats: { count: 1402 } }
        };
        renderDictionary();
        expect(el('dict-db-version').textContent).toBe('원료 DB v1.2.3 · 1,402종');
    });

    it('DI-05: 사전 뷰에 네거티브 리스트 판정 원칙 안내가 표시된다', () => {
        // 안내 문구는 manifest knowledge.header.note 선언으로 주입된다 (화장품 도메인 콘텐츠)
        document.body.innerHTML += '<div id="dict-results-container"></div>';
        window.INGREDIENTS_DATA = [{ name: '테스트원료', eng: 'test', category: '보습제' }];
        DataLoader.registry = {
            knowledge: {
                registryKey: 'ingredients', global: 'INGREDIENTS_DATA', entityUnit: '원료',
                header: { note: '판정은 <strong>네거티브 리스트</strong> 방식입니다 — banned·restricted·approved' }
            }
        };
        renderDictionary();
        const note = document.querySelector('#dictionary-view .dict-neglist-note');
        expect(note).toBeTruthy();
        expect(note.classList.contains('is-hidden')).toBe(false);
        expect(note.textContent).toContain('네거티브 리스트');
        expect(note.textContent).toContain('banned');
        expect(note.textContent).toContain('restricted');
        expect(note.textContent).toContain('approved');
    });
});
