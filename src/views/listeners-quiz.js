// src/views/listeners-quiz.js — 퀴즈·훈련소 이벤트 바인딩 (event-listeners.js §3~4 + 숫자/OX 단축키에서 분리)
// @spec Q-02,Q-04
import { state } from '../state.js';
import { DataLoader } from '../data-loader.js';
import { startQuiz, submitQuizAnswer, nextQuizQuestion, startWeakFocusQuiz } from './quiz.js';
import { showGlobalLoading, hideGlobalLoading, showToast } from '../ui-utils.js';
import { switchView } from './navigation.js';

export function bindQuizListeners() {
    document.getElementById('quiz-subject-select')?.addEventListener('change', (e) => {
        state.quiz.subject = (/** @type {HTMLSelectElement} */ (e.target)).value;
    });

    document.getElementById('start-quiz-btn')?.addEventListener('click', () => {
        showGlobalLoading('퀴즈 데이터를 불러오는 중입니다...');
        DataLoader.loadSubject(state.quiz.subject).then(() => {
            hideGlobalLoading();
            startQuiz();
        }).catch(() => {
            hideGlobalLoading();
            showToast('퀴즈 데이터를 불러오지 못했습니다.', 'error');
            startQuiz();
        });
    });

    document.getElementById('submit-quiz-btn')?.addEventListener('click', () => {
        submitQuizAnswer();
    });

    // 엔터키 정답 제출 대응
    document.getElementById('quiz-answer-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const submitBtn = document.getElementById('submit-quiz-btn');
            const nextBtn = document.getElementById('next-quiz-btn');

            if (submitBtn && !submitBtn.classList.contains('is-hidden')) {
                submitQuizAnswer();
            } else if (nextBtn && !nextBtn.classList.contains('is-hidden')) {
                nextQuizQuestion();
            }
        }
    });

    document.getElementById('next-quiz-btn')?.addEventListener('click', () => {
        nextQuizQuestion();
    });

    document.getElementById('retry-quiz-btn')?.addEventListener('click', () => {
        startQuiz();
    });

    // 계산 연습기 엔터키 제출 — 도메인 모듈은 지연 로딩이므로 window 브리지 경유
    const calcInput = document.getElementById('calc-answer-input');
    if (calcInput) {
        calcInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const submitBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('submit-calc-btn'));
                if (submitBtn && !submitBtn.disabled) {
                    /** @type {any} */ (window).submitCalcAnswer?.();
                }
            }
        });
    }

    // 지식DB 챌린지 주관식 엔터키 제출 — 동일하게 지연 브리지 경유
    const ingInput = document.getElementById('ing-answer-input');
    if (ingInput) {
        ingInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const submitBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('submit-ing-btn'));
                if (submitBtn && !submitBtn.disabled) {
                    /** @type {any} */ (window).submitIngAnswer?.();
                }
            }
        });
    }

    document.getElementById('back-to-dashboard-btn')?.addEventListener('click', () => {
        switchView('dashboard-view');
    });

    // 오답 퀴즈 이벤트 바인딩
    document.getElementById('start-weak-quiz-btn')?.addEventListener('click', () => {
        startWeakFocusQuiz();
    });

    // 퀴즈/훈련소 객관식 숫자키 1-5 / OX O,P 단축키
    document.addEventListener('keydown', (e) => {
        if (state.currentView !== 'quiz-view' && state.currentView !== 'trainer-view') return;
        const tgt = /** @type {HTMLElement|null} */ (e.target);
        if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT' || tgt.tagName === 'TEXTAREA')) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // 객관식: 1-5
        const numMatch = /^([1-5])$/.exec(e.key);
        if (numMatch) {
            const idx = parseInt(numMatch[1], 10) - 1;
            const containers = [
                document.getElementById('quiz-options-container'),
                document.getElementById('limits-options-container'),
                document.getElementById('ing-options-container')
            ].filter(Boolean);
            for (const c of /** @type {HTMLElement[]} */ (containers)) {
                if (c.classList.contains('is-hidden')) continue;
                const btns = /** @type {NodeListOf<HTMLButtonElement>} */ (c.querySelectorAll('.limits-opt-btn'));
                if (btns[idx] && !btns[idx].disabled) {
                    e.preventDefault();
                    btns[idx].click();
                    return;
                }
            }
        }

        // OX: o/p
        if (e.key === 'o' || e.key === 'O') {
            const oxBtns = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.quiz-ox-btn'));
            if (oxBtns.length && !oxBtns[0].disabled) {
                e.preventDefault();
                oxBtns[0].click();
            }
        } else if (e.key === 'p' || e.key === 'P') {
            const oxBtns = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.quiz-ox-btn'));
            if (oxBtns.length > 1 && !oxBtns[1].disabled) {
                e.preventDefault();
                oxBtns[1].click();
            }
        }
    });
}
