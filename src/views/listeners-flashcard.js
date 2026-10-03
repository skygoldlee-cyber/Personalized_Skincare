// src/views/listeners-flashcard.js — 플래시카드 이벤트 바인딩 (event-listeners.js §2에서 분리)
// 카드 플립·스와이프·필터·외움 분류·키보드 단축키.
// @spec F-03,F-04
import { state, saveProgress } from '../state.js';
import { DataLoader } from '../data-loader.js';
import { updateCardSchedule } from '../spaced-repetition.js';
import { TIMING } from '../config/timing.js';
import { loadFlashcards, renderFlashcard } from './flashcard.js';

export function bindFlashcardListeners() {
    const cardEl = /** @type {HTMLElement & {_swipeHandled?: boolean} | null} */ (document.getElementById('flashcard-item'));
    if (cardEl) {
        cardEl.setAttribute('role', 'button');
        cardEl.setAttribute('tabindex', '0');
        cardEl.setAttribute('aria-label', '플래시카드 — 클릭하여 뒷면 보기');
        const flipCard = () => {
            const isFlipped = cardEl.classList.toggle('flipped');
            cardEl.setAttribute('aria-expanded', String(isFlipped));
            cardEl.setAttribute('aria-label', isFlipped ? '플래시카드 — 클릭하여 앞면 보기' : '플래시카드 — 클릭하여 뒷면 보기');
        };
        cardEl.addEventListener('click', (e) => {
            // 터치 스와이프 후 합성 click 이벤트 중복 방지
            if (cardEl._swipeHandled) {
                cardEl._swipeHandled = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            flipCard();
        });
        cardEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(); }
        });

        // U2: 모바일 좌우 스와이프 제스처 — 좌우 카드 전환, 위로 스와이프 시 뒤집기
        let _swipeStartX = 0, _swipeStartY = 0, _swipeStartT = 0, _swipeMoved = false;
        const SWIPE_THRESHOLD = TIMING.SWIPE_THRESHOLD_PX; // px — 이 거리 이상 이동 시 스와이프로 간주
        const SWIPE_TIME_MAX = TIMING.SWIPE_TIME_MAX_MS; // ms — 이 시간 내에 끝나야 스와이프
        cardEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            _swipeStartX = t.clientX;
            _swipeStartY = t.clientY;
            _swipeStartT = Date.now();
            _swipeMoved = false;
            cardEl._swipeHandled = false;
        }, { passive: true });
        cardEl.addEventListener('touchmove', () => { _swipeMoved = true; }, { passive: true });
        cardEl.addEventListener('touchend', (e) => {
            if (e.changedTouches.length !== 1) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - _swipeStartX;
            const dy = t.clientY - _swipeStartY;
            const dt = Date.now() - _swipeStartT;
            // 가로 이동이 세로 이동보다 크고 임계값 초과 시 좌우 스와이프
            if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < SWIPE_TIME_MAX) {
                e.preventDefault();
                cardEl._swipeHandled = true; // 합성 click 중복 방지
                const prevBtn = document.getElementById('fc-prev-btn');
                const nextBtn = document.getElementById('fc-next-btn');
                if (dx > 0 && prevBtn) prevBtn.click(); // 오른쪽 스와이프 → 이전
                else if (dx < 0 && nextBtn) nextBtn.click(); // 왼쪽 스와이프 → 다음
            }
            // 가로 이동이 작고 세로 이동이 위쪽이며 임계값 초과 시 뒤집기 (click과 중복 방지 위해 _swipeMoved 체크)
            else if (_swipeMoved && dy < -SWIPE_THRESHOLD && Math.abs(dx) < SWIPE_THRESHOLD * 0.5) {
                e.preventDefault();
                cardEl._swipeHandled = true; // 합성 click 중복 방지
                flipCard();
            }
            // 스와이프가 아닌 단순 탭은 click 이벤트가 자동 발생하므로 뒤집기 처리 위임
        }, { passive: false });
    }

    document.getElementById('fc-subject-select')?.addEventListener('change', (e) => {
        const subj = (/** @type {HTMLSelectElement|null} */ (e.target) || { value: '' }).value;
        state.flashcards.subject = subj;
        state.flashcards.currentIndex = 0;
        DataLoader.loadSubject(subj).then(() => {
            loadFlashcards();
        }).catch(() => loadFlashcards());
    });

    document.getElementById('fc-key-only')?.addEventListener('change', (e) => {
        state.flashcards.keyOnly = (/** @type {HTMLInputElement} */ (e.target)).checked;
        state.flashcards.currentIndex = 0;
        loadFlashcards();
    });

    const fcShuffleCheckbox = document.getElementById('fc-shuffle');
    if (fcShuffleCheckbox) {
        fcShuffleCheckbox.addEventListener('change', (e) => {
            state.flashcards.shuffle = (/** @type {HTMLInputElement} */ (e.target)).checked;
            state.flashcards.currentIndex = 0;
            loadFlashcards();
        });
    }

    const fcDifficultySelect = document.getElementById('fc-difficulty-select');
    if (fcDifficultySelect) {
        fcDifficultySelect.addEventListener('change', (e) => {
            state.flashcards.difficultyFilter = (/** @type {HTMLSelectElement} */ (e.target)).value;
            state.flashcards.currentIndex = 0;
            loadFlashcards();
        });
    }

    document.getElementById('fc-prev-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.flashcards.data.length === 0) return;
        state.flashcards.currentIndex--;
        if (state.flashcards.currentIndex < 0) {
            state.flashcards.currentIndex = state.flashcards.data.length - 1;
        }
        renderFlashcard();
    });

    document.getElementById('fc-next-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.flashcards.data.length === 0) return;
        state.flashcards.currentIndex++;
        if (state.flashcards.currentIndex >= state.flashcards.data.length) {
            state.flashcards.currentIndex = 0;
        }
        renderFlashcard();
    });

    document.getElementById('fc-easy-btn')?.addEventListener('click', () => {
        const fc = state.flashcards;
        if (fc.data.length === 0) return;
        const currentCard = fc.data[fc.currentIndex];

        state.memorizedCards.add(currentCard.id);
        state.weakCards.delete(currentCard.id);
        updateCardSchedule(currentCard.id, true); // 2. 간격 반복 (SM-2)
        saveProgress();

        // 시각 효과 피드백 후 다음 카드로
        /** @type {HTMLElement} */ (document.getElementById('fc-easy-btn')).style.transform = 'scale(1.05)';
        setTimeout(() => {
            /** @type {HTMLElement} */ (document.getElementById('fc-easy-btn')).style.transform = 'scale(1)';
            /** @type {HTMLElement} */ (document.getElementById('fc-next-btn')).click();
        }, 150);
    });

    document.getElementById('fc-hard-btn')?.addEventListener('click', () => {
        const fc = state.flashcards;
        if (fc.data.length === 0) return;
        const currentCard = fc.data[fc.currentIndex];

        state.weakCards.add(currentCard.id);
        state.memorizedCards.delete(currentCard.id);
        updateCardSchedule(currentCard.id, false); // 2. 간격 반복 (SM-2)
        saveProgress();

        // 시각 효과 피드백 후 다음 카드로
        /** @type {HTMLElement} */ (document.getElementById('fc-hard-btn')).style.transform = 'scale(1.05)';
        setTimeout(() => {
            /** @type {HTMLElement} */ (document.getElementById('fc-hard-btn')).style.transform = 'scale(1)';
            /** @type {HTMLElement} */ (document.getElementById('fc-next-btn')).click();
        }, 150);
    });

    // 플래시카드 키보드 단축키 (flashcard-view 활성 시에만 동작)
    document.addEventListener('keydown', (e) => {
        if (state.currentView !== 'flashcard-view') return;
        const tgt = /** @type {HTMLElement|null} */ (e.target);
        if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT' || tgt.tagName === 'TEXTAREA')) return;

        const cardEl = document.getElementById('flashcard-item');
        if (!cardEl || state.flashcards.data.length === 0) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                /** @type {HTMLElement} */ (document.getElementById('fc-prev-btn')).click();
                break;
            case 'ArrowRight':
                e.preventDefault();
                /** @type {HTMLElement} */ (document.getElementById('fc-next-btn')).click();
                break;
            case ' ':
            case 'Spacebar':
                e.preventDefault();
                cardEl.classList.toggle('flipped');
                break;
            case 'e':
            case 'E':
                e.preventDefault();
                /** @type {HTMLElement} */ (document.getElementById('fc-easy-btn')).click();
                break;
            case 'h':
            case 'H':
                e.preventDefault();
                /** @type {HTMLElement} */ (document.getElementById('fc-hard-btn')).click();
                break;
        }
    });
}
