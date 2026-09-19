// views/exam-sim-review.js — 시뮬레이터 결과 리뷰/요약 (exam-simulator.js에서 추출)
import { simState } from './exam-sim-state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';

const OPTION_INDICATORS = ['①', '②', '③', '④', '⑤'];

/**
 * 합답형 진술 정오표 — 실제 O/X vs 내 선택 선지의 포함 여부로 오판 진술을 표시
 * (선택 선지의 members = 사용자가 "참"이라 판정한 집합으로 해석)
 */
function comboTruthTableHTML(q) {
    if (!Array.isArray(q.statements) || !Array.isArray(q.comboOptions)) return '';
    const idx = OPTION_INDICATORS.indexOf(q.userAnswer);
    const chosen = idx >= 0 ? new Set(q.comboOptions[idx].members || []) : null;
    const rows = q.statements.map(s => {
        const inChoice = chosen ? chosen.has(s.id) : null;
        const misjudged = inChoice !== null && inChoice !== !!s.truth;
        return `<div class="combo-truth-row${misjudged ? ' is-misjudged' : ''}">
            <span class="combo-truth-id">${esc(s.id)}</span>
            <span class="combo-truth-actual ${s.truth ? 'is-o' : 'is-x'}">실제 ${s.truth ? 'O' : 'X'}</span>
            <span class="combo-truth-mine">${inChoice === null ? '미응답' : (inChoice ? '참으로 판정' : '거짓으로 판정')}${misjudged ? ' ✗' : ''}</span>
            <span class="combo-truth-text">${safeTextWithBreaks(s.text)}</span>
        </div>`;
    }).join('');
    return `<div class="combo-truth-table"><div class="combo-truth-head">진술 판정 정오표</div>${rows}</div>`;
}

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
        if (q.type === 'combo') optionsHTML += comboTruthTableHTML(q);
        
        const itemHTML = `
            <div class="sim-review-item">
                <div class="review-item-header">
                    <span class="badge badge-quiz-cat">Q ${q.num}</span>
                    <span class="badge badge-quiz-type">${q.type === 'choice' ? '객관식' : q.type === 'ox' ? '진위형' : q.type === 'combo' ? '합답형' : '단답형'}</span>
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
