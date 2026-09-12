// views/exam-sim-review.js — 시뮬레이터 결과 리뷰/요약 (exam-simulator.js에서 추출)
import { simState } from './exam-sim-state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';

export function showSimAnswerReview() {
    document.getElementById('sim-result-panel').classList.add('is-hidden');
    document.getElementById('sim-review-panel').classList.remove('is-hidden');
    
    const container = document.getElementById('sim-review-list-container');
    container.innerHTML = '';
    
    if (simState.wrongQuestions.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--color-success);"><i class="fa-solid fa-circle-check"></i> 만점입니다! 틀린 문제가 하나도 없습니다.</p>';
        return;
    }
    
    simState.wrongQuestions.forEach((q, idx) => {
        let optionsHTML = '';
        if (q.options && q.options.length > 0) {
            optionsHTML = `<ul class="review-q-options">
                ${q.options.map(opt => `<li>${esc(opt)}</li>`).join('')}
            </ul>`;
        }
        
        const itemHTML = `
            <div class="sim-review-item">
                <div class="review-item-header">
                    <span class="badge badge-quiz-cat">Q ${q.num}</span>
                    <span class="badge badge-quiz-type">${q.type === 'choice' ? '객관식' : q.type === 'ox' ? '진위형' : '단답형'}</span>
                </div>
                <p class="review-item-q-text">${safeTextWithBreaks(q.question)}</p>
                ${optionsHTML}
                <div class="review-answer-panel">
                    <p>❌ 내가 쓴 답: <strong class="color-danger">${esc(q.userAnswer || '(공란)')}</strong></p>
                    <p>✅ 올바른 정답: <strong class="color-success">${esc(q.answer)}</strong></p>
                </div>
                <div class="review-explanation-panel">
                    <h5>정답 해설 및 분석</h5>
                    <p>${safeTextWithBreaks(q.explanation)}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

export function showSimResultsSummary() {
    document.getElementById('sim-review-panel').classList.add('is-hidden');
    document.getElementById('sim-result-panel').classList.remove('is-hidden');
}
