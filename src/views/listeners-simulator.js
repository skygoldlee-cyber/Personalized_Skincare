// src/views/listeners-simulator.js — 모의고사 시뮬레이터 이벤트 바인딩 (event-listeners.js §5에서 분리)
// @spec E-01
import { simState, renderSimQuestion, submitExam } from './exam-simulator.js';
import { showConfirm } from '../ui-utils.js';

export function bindSimulatorListeners() {
    document.getElementById('sim-prev-btn')?.addEventListener('click', () => {
        if (simState.currentIndex > 0) {
            simState.currentIndex--;
            renderSimQuestion();
        }
    });

    document.getElementById('sim-next-btn')?.addEventListener('click', () => {
        if (simState.currentIndex < simState.data.questions.length - 1) {
            simState.currentIndex++;
            renderSimQuestion();
        }
    });

    document.getElementById('sim-submit-exam-btn')?.addEventListener('click', async () => {
        const questions = (simState.data && simState.data.questions) || [];
        const answered = questions.filter(q => String(simState.userAnswers[q.id] || '').trim() !== '').length;
        const unanswered = questions.length - answered;
        const msg = unanswered > 0
            ? `아직 풀지 않은 문항이 ${unanswered}개 있습니다. 그래도 답안지를 제출하고 시험을 종료하시겠습니까?`
            : "정말로 답안지를 제출하고 시험을 종료하시겠습니까?";
        const ok = await showConfirm(msg, "시험 제출");
        if (ok) submitExam();
    });

    // 모의고사 키보드 단축키 — 아레나 표시 중에만 동작.
    // 입력 필드·버튼·확인 모달에 포커스가 있을 때는 비활성(단답형 입력·Enter 기본동작 보호)
    document.addEventListener('keydown', (e) => {
        const arena = document.getElementById('sim-arena-panel');
        if (!arena || arena.classList.contains('is-hidden')) return;
        if (document.getElementById('app-confirm-overlay')) return;
        const target = /** @type {HTMLElement|null} */ (e.target);
        if (target && typeof target.closest === 'function' &&
            target.closest('input, textarea, select, button, a[href], [role="button"], [contenteditable]')) return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            document.getElementById('sim-prev-btn')?.click();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('sim-next-btn')?.click();
        } else if (/^[1-5]$/.test(e.key)) {
            const opt = document.querySelectorAll('#sim-options-container .sim-option-item')[parseInt(e.key, 10) - 1];
            if (opt) {
                e.preventDefault();
                /** @type {HTMLElement} */ (opt).click();
            }
        }
    });
}
