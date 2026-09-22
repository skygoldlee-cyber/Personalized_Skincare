// tests/dom/study-flashcard.dom.test.js — 플래시카드 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 3)
// 검증: 카드 로드·렌더(H), 빈 과목(E), 뒤집기(H), 이전/다음 이동·순환(H),
//       외움/헷갈림 표시→localStorage 영속(P), 기출/난이도 필터(B)

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
    loadIndexHtml, el, isVisible, flushAsync,
    seedStudyData, seedProgress, resetStudyState, storedJson,
} from './helpers.js';
import { state } from '../../src/state.js';
import { loadFlashcards, renderFlashcard } from '../../src/views/flashcard.js';
import { setupEventListeners } from '../../src/views/event-listeners.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

const CARDS = [
    { id: 'subj1_card_1', term: '화장품법', definition: '화장품의 안전성 확보를 목적으로 하는 법률', category: '법령', cardType: 'definition', isKey: true, difficulty: 'easy', importance: 5 },
    { id: 'subj1_card_2', term: '조제관리사', definition: '맞춤형화장품 조제를 담당하는 국가자격', category: '자격', cardType: 'requirement', isKey: false, difficulty: 'medium', importance: 3 },
    { id: 'subj1_card_3', term: '안전용기', definition: '5세 미만 어린이가 쉽게 개봉할 수 없는 용기', category: '안전', cardType: 'number', isKey: false, difficulty: 'hard', importance: 4 },
];

function setupCards() {
    seedStudyData('subj1', { name: '과목1', cards: CARDS, quizzes: [] });
    state.flashcards.subject = 'subj1';
    setupEventListeners(() => {});
}

describe('플래시카드 — 로드·뒤집기·진도 표시', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
    });

    it('카드 로드 → 중요도순 정렬·용어·배지·인덱스 렌더', () => {
        setupCards();
        loadFlashcards();

        // importance 내림차순: card_1(5) → card_3(4) → card_2(3)
        expect(el('card-front-term').textContent).toBe('화장품법');
        expect(el('card-front-category').textContent).toBe('법령');
        expect(el('card-front-type').textContent).toBe('개념');
        expect(el('card-back-definition').textContent).toContain('안전성 확보');
        expect(el('fc-current-index').textContent).toBe('1');
        expect(el('fc-total-count').textContent).toBe('3');
        // isKey 카드 → 기출 별 표시
        expect(el('card-front-star').classList.contains('active')).toBe(true);
    });

    it('카드 클릭 → 뒤집기 토글 + aria 상태', () => {
        setupCards();
        loadFlashcards();
        const card = el('flashcard-item');

        card.click();
        expect(card.classList.contains('flipped')).toBe(true);
        expect(card.getAttribute('aria-expanded')).toBe('true');

        card.click();
        expect(card.classList.contains('flipped')).toBe(false);
    });

    it('다음/이전 버튼 → 카드 이동과 순환', () => {
        setupCards();
        loadFlashcards();

        el('fc-next-btn').click();
        expect(el('card-front-term').textContent).toBe('안전용기');
        expect(el('fc-current-index').textContent).toBe('2');
        // 다음 이동 시 뒤집힘 해제
        expect(el('flashcard-item').classList.contains('flipped')).toBe(false);

        el('fc-next-btn').click();
        el('fc-next-btn').click(); // 끝 → 처음으로 순환
        expect(el('card-front-term').textContent).toBe('화장품법');

        el('fc-prev-btn').click(); // 처음 → 끝으로 순환
        expect(el('card-front-term').textContent).toBe('조제관리사');
    });

    it('빈 과목 → 안내 문구 + 카운터 0', () => {
        seedStudyData('subj_empty', { name: '빈과목', cards: [], quizzes: [] });
        state.flashcards.subject = 'subj_empty';
        loadFlashcards();

        expect(el('card-front-term').textContent).toBe('조건에 맞는 카드가 없습니다.');
        expect(el('fc-current-index').textContent).toBe('0');
        expect(el('fc-total-count').textContent).toBe('0');
    });

    it('기출만 필터 → isKey 카드만, 난이도 필터 → 일치 카드만', () => {
        setupCards();
        state.flashcards.keyOnly = true;
        loadFlashcards();
        expect(el('fc-total-count').textContent).toBe('1');
        expect(el('card-front-term').textContent).toBe('화장품법');

        state.flashcards.keyOnly = false;
        state.flashcards.difficultyFilter = 'hard';
        loadFlashcards();
        expect(el('fc-total-count').textContent).toBe('1');
        expect(el('card-front-term').textContent).toBe('안전용기');
    });

    it('외움 표시 → memorizedCards + localStorage 영속 + 배지', async () => {
        setupCards();
        loadFlashcards();

        el('fc-easy-btn').click();
        expect(state.memorizedCards.has('subj1_card_1')).toBe(true);
        expect(storedJson(STORAGE_KEYS.FC_MEMORIZED)).toContain('subj1_card_1');

        await flushAsync(200); // 시각 피드백 후 다음 카드 이동
        expect(el('card-front-term').textContent).toBe('안전용기');
        expect(el('fc-memorized-badge').classList.contains('is-hidden')).toBe(false);
        expect(el('fc-memorized-count').textContent).toBe('1');
    });

    it('헷갈림 표시 → weakCards + localStorage 영속', async () => {
        setupCards();
        loadFlashcards();

        el('fc-hard-btn').click();
        expect(state.weakCards.has('subj1_card_1')).toBe(true);
        expect(state.memorizedCards.has('subj1_card_1')).toBe(false);
        expect(storedJson(STORAGE_KEYS.FC_WEAK)).toContain('subj1_card_1');

        await flushAsync(200);
        expect(el('fc-weak-count').textContent).toBe('1');
    });

    it('진도 시딩 → 재진입 시 외움/헷갈림 배지 복원', () => {
        seedProgress({ memorized: ['subj1_card_1'], weak: ['subj1_card_3'] });
        setupCards();
        loadFlashcards();

        expect(state.memorizedCards.has('subj1_card_1')).toBe(true);
        expect(el('fc-memorized-count').textContent).toBe('1');
        expect(el('fc-weak-count').textContent).toBe('1');
    });
});
