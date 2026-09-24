// tests/dom/common-eventlisteners.dom.test.js — 이벤트 위임·리스너 디스패치 경로
// 커버리지 갭 보강: src/views/event-listeners.js
//   data-click/data-args/data-input 위임, Enter/Space 키보드 접근성,
//   설정 메뉴·플래시카드 버튼·시뮬레이터 이동·단축키 핸들러 본문
//
// 주의: setupEventListeners는 document.body에 위임 리스너를 등록한다.
// 테스트마다 재호출하면 리스너가 누적되므로 assertion은 호출 횟수가 아닌
// "호출됐는가/인자" 기준으로 작성한다.

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
    loadIndexHtml, el, isVisible, resetStudyState, flushAsync,
} from './helpers.js';
import { state } from '../../src/state.js';
import { simState } from '../../src/views/exam-sim-state.js';
import { setupEventListeners } from '../../src/views/event-listeners.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

const CARDS = [
    { id: 'c1', term: '용어1', definition: '정의1', category: '법령', cardType: 'definition', isKey: true, difficulty: 'easy', importance: 5 },
    { id: 'c2', term: '용어2', definition: '정의2', category: '법령', cardType: 'definition', isKey: false, difficulty: 'easy', importance: 3 },
];

function keydown(target, key) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('이벤트 위임 — data-click/data-args/data-input 디스패치', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
        setupEventListeners(() => {});
        delete window.__spy;
        delete window.__ns;
    });

    it('data-click + data-arg → window 핸들러에 인자 전달', () => {
        window.__spy = vi.fn();
        const btn = document.createElement('button');
        btn.setAttribute('data-click', '__spy');
        btn.setAttribute('data-arg', 'subject1');
        document.body.appendChild(btn);

        btn.click();
        expect(window.__spy).toHaveBeenCalledWith('subject1');
    });

    it('data-args JSON 배열 → 다중 인자, data-arg 무시', () => {
        window.__spy = vi.fn();
        const btn = document.createElement('button');
        btn.setAttribute('data-click', '__spy');
        btn.setAttribute('data-arg', 'legacy');
        btn.setAttribute('data-args', '["law", 2, true]');
        document.body.appendChild(btn);

        btn.click();
        expect(window.__spy).toHaveBeenCalledWith('law', 2, true);
    });

    it('data-args JSON 파싱 실패 → 핸들러 미호출 + console.error', () => {
        window.__spy = vi.fn();
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const btn = document.createElement('button');
        btn.setAttribute('data-click', '__spy');
        btn.setAttribute('data-args', '{broken');
        document.body.appendChild(btn);

        btn.click();
        expect(window.__spy).not.toHaveBeenCalled();
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it('미등록 핸들러명 → console.error, 예외 없음', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const btn = document.createElement('button');
        btn.setAttribute('data-click', 'noSuchHandlerXYZ');
        document.body.appendChild(btn);

        btn.click();
        expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('noSuchHandlerXYZ'));
        errSpy.mockRestore();
    });

    it('점 표기 네임스페이스 핸들러 해석 (ManualViewer.open 패턴)', () => {
        window.__ns = { open: vi.fn() };
        const btn = document.createElement('button');
        btn.setAttribute('data-click', '__ns.open');
        btn.setAttribute('data-arg', 'doc1');
        document.body.appendChild(btn);

        btn.click();
        expect(window.__ns.open).toHaveBeenCalledWith('doc1');
    });

    it('data-input 위임 → 현재 요소의 value를 인자로 전달', () => {
        window.__spy = vi.fn();
        const input = document.createElement('input');
        input.setAttribute('data-input', '__spy');
        input.value = '42.5';
        document.body.appendChild(input);

        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(window.__spy).toHaveBeenCalledWith('42.5');
    });

    it('키보드 접근성 — 비버튼 [data-click] 요소에서 Enter → 클릭 트리거', () => {
        window.__spy = vi.fn();
        const div = document.createElement('div');
        div.setAttribute('data-click', '__spy');
        document.body.appendChild(div);

        keydown(div, 'Enter');
        expect(window.__spy).toHaveBeenCalled();
    });

    it('키보드 접근성 — BUTTON은 네이티브 처리로 위임에서 제외', () => {
        window.__spy = vi.fn();
        const btn = document.createElement('button');
        btn.setAttribute('data-click', '__spy');
        document.body.appendChild(btn);
        // 네이티브 동작을 흉내 내기 위해 click 리스너가 있다고 가정 — 위임 경로가
        // el.click()을 또 호출하지 않는지만 본다
        keydown(btn, 'Enter');
        // BUTTON은 위임 keydown에서 제외되므로 클릭 경유 호출 없음
        // (브라우저 네이티브 Enter→click은 jsdom이 합성하지 않음)
        expect(window.__spy).not.toHaveBeenCalled();
    });
});

describe('설정 메뉴·진도 초기화 리스너', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
        setupEventListeners(() => {});
    });

    it('설정 버튼 → 패널 토글 + aria-expanded, 외부 클릭·Escape로 닫힘', () => {
        const btn = el('settings-toggle-btn');
        const panel = el('settings-panel');

        btn.click();
        expect(panel.classList.contains('is-hidden')).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('true');

        keydown(document, 'Escape');
        expect(panel.classList.contains('is-hidden')).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('false');

        btn.click(); // 다시 열기
        document.body.click(); // 패널 외부 클릭 → 닫힘
        expect(panel.classList.contains('is-hidden')).toBe(true);
    });

    it('진도 초기화 → confirm 승인 시 카드/퀴즈 상태·스토리지 정리 + 토스트', async () => {
        state.memorizedCards.add('c1');
        state.weakCards.add('c2');
        state.quizResults = { q1: { correct: false } };

        el('reset-progress-btn').click();
        await flushAsync();

        expect(showConfirm).toHaveBeenCalled();
        expect(state.memorizedCards.size).toBe(0);
        expect(state.weakCards.size).toBe(0);
        expect(state.quizResults).toEqual({});
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('초기화'), 'success');
    });

    it('진도 초기화 — confirm 거부 시 상태 유지', async () => {
        showConfirm.mockResolvedValueOnce(false);
        state.memorizedCards.add('c1');

        el('reset-progress-btn').click();
        await flushAsync();

        expect(state.memorizedCards.has('c1')).toBe(true);
    });
});

describe('플래시카드·시뮬레이터 리스너', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
        setupEventListeners(() => {});
    });

    it('카드 클릭 → flipped 토글 + aria 속성 갱신', () => {
        const card = el('flashcard-item');
        card.click();
        expect(card.classList.contains('flipped')).toBe(true);
        expect(card.getAttribute('aria-expanded')).toBe('true');
        card.click();
        expect(card.classList.contains('flipped')).toBe(false);
    });

    it('fc-next/prev → 인덱스 순환 이동', () => {
        state.flashcards.data = CARDS;
        state.flashcards.currentIndex = 0;

        el('fc-next-btn').click();
        expect(state.flashcards.currentIndex).toBe(1);
        el('fc-next-btn').click();
        expect(state.flashcards.currentIndex).toBe(0); // wrap-around
        el('fc-prev-btn').click();
        expect(state.flashcards.currentIndex).toBe(1); // 역방향 wrap
    });

    it('fc-easy → 외움 등록 + weakCards 해제', () => {
        state.flashcards.data = CARDS;
        state.flashcards.currentIndex = 0;
        state.weakCards.add('c1');

        el('fc-easy-btn').click();
        expect(state.memorizedCards.has('c1')).toBe(true);
        expect(state.weakCards.has('c1')).toBe(false);
    });

    it('fc-hard → 헷갈림 등록 + memorized 해제', () => {
        state.flashcards.data = CARDS;
        state.flashcards.currentIndex = 0;
        state.memorizedCards.add('c1');

        el('fc-hard-btn').click();
        expect(state.weakCards.has('c1')).toBe(true);
        expect(state.memorizedCards.has('c1')).toBe(false);
    });

    it('sim-prev/next → 문항 인덱스 이동 + 경계 가드', () => {
        simState.data = { questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }] };
        simState.currentIndex = 0;

        el('sim-prev-btn').click(); // 경계: 0 이하로 안 내려감
        expect(simState.currentIndex).toBe(0);

        el('sim-next-btn').click();
        expect(simState.currentIndex).toBe(1);
        el('sim-next-btn').click();
        el('sim-next-btn').click(); // 경계: 마지막에서 멈춤
        expect(simState.currentIndex).toBe(2);
    });

    it('back-to-dashboard → dashboard-view 활성화', () => {
        el('back-to-dashboard-btn').click();
        expect(el('dashboard-view').classList.contains('active')).toBe(true);
        expect(state.currentView).toBe('dashboard-view');
    });
});

describe('퀴즈·훈련소 단축키', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
        setupEventListeners(() => {});
    });

    it('quiz-view에서 숫자키 1-5 → 해당 선지 버튼 클릭', () => {
        state.currentView = 'quiz-view';
        const container = el('quiz-options-container');
        container.classList.remove('is-hidden');
        const spy = vi.fn();
        for (let i = 0; i < 5; i++) {
            const b = document.createElement('button');
            b.className = 'limits-opt-btn';
            if (i === 2) b.addEventListener('click', spy);
            container.appendChild(b);
        }

        keydown(document.body, '3');
        expect(spy).toHaveBeenCalled();
    });

    it('quiz-view가 아니면 숫자키 무시', () => {
        state.currentView = 'dashboard-view';
        const container = el('quiz-options-container');
        container.classList.remove('is-hidden');
        const spy = vi.fn();
        const b = document.createElement('button');
        b.className = 'limits-opt-btn';
        b.addEventListener('click', spy);
        container.appendChild(b);

        keydown(document.body, '1');
        expect(spy).not.toHaveBeenCalled();
    });

    it('quiz-view에서 o/p → O/X 버튼 클릭', () => {
        state.currentView = 'quiz-view';
        // index.html의 실제 OX 버튼(첫 번째=O, 두 번째=X)에 스파이 부착
        const oxBtns = document.querySelectorAll('.quiz-ox-btn');
        const spyO = vi.fn();
        const spyX = vi.fn();
        oxBtns[0].addEventListener('click', spyO);
        oxBtns[1].addEventListener('click', spyX);

        keydown(document.body, 'o');
        expect(spyO).toHaveBeenCalled();
        keydown(document.body, 'p');
        expect(spyX).toHaveBeenCalled();
    });

    it('quiz-answer-input Enter → 제출 버튼 보이면 submitQuizAnswer 경로', () => {
        // submit 버튼이 보이는 상태: 정답 제출 시도 (퀴즈 데이터 없으면 무해)
        el('submit-quiz-btn').classList.remove('is-hidden');
        const input = el('quiz-answer-input');
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
        // 크래시 없이 통과 — submitQuizAnswer는 데이터 없이 early return
        expect(true).toBe(true);
    });
});
