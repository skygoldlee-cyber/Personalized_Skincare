// views/trainer-calc-practice.js — 원료 배합 계산 연습기 (trainer.js에서 추출)
import { state, safeGetItem, safeSetItem } from '../state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';
import { buildCalcQuestion } from '../trainer-calc.js';
import { clearScratchpad } from '../scratchpad.js';
import { showToast, vibrate, HAPTIC } from '../ui-utils.js';
import { STORAGE_KEYS } from '../storage-keys.js';

/* =======================================================
   🧪 원료 배합 계산 연습기 (Calculation Trainer)
   ======================================================= */
export function startCalcPractice() {
    state.trainer.activeSubView = 'calc';
    state.trainer.calc.correctCount = 0;
    state.trainer.calc.totalSolved = 0;
    
    const menuPanel = document.getElementById('trainer-menu-panel');
    const calcPanel = document.getElementById('trainer-calc-panel');
    if (menuPanel) menuPanel.classList.add('is-hidden');
    if (calcPanel) calcPanel.classList.remove('is-hidden');
    
    const scratchpadContainer = document.getElementById('calc-scratchpad-container');
    const toggleBtn = document.getElementById('calc-scratchpad-toggle');
    if (scratchpadContainer) scratchpadContainer.classList.add('is-hidden');
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-pencil"></i> ✏️ 계산 연습장 열기';
    
    renderCalcHistory();
    generateCalcQuestion();
}

export function generateCalcQuestion() {
    const qData = buildCalcQuestion();
    state.trainer.calc.currentQuestion = qData;
    
    const typeBadge = document.getElementById('calc-type-badge');
    const questionText = document.getElementById('calc-question-text');
    const unitText = document.getElementById('calc-unit-text');
    const input = document.getElementById('calc-answer-input');
    const submitBtn = document.getElementById('submit-calc-btn');
    const feedbackPanel = document.getElementById('calc-feedback-panel');
    const solutionPanel = document.getElementById('calc-solution-panel');
    const nextBtn = document.getElementById('next-calc-btn');

    if (typeBadge) typeBadge.textContent = qData.type;
    if (questionText) questionText.innerHTML = qData.question;
    if (unitText) unitText.textContent = qData.unit;
    
    if (input) {
        input.value = '';
        input.disabled = false;
        input.focus();
    }
    
    if (submitBtn) submitBtn.disabled = false;
    if (feedbackPanel) feedbackPanel.classList.add('is-hidden');
    if (solutionPanel) solutionPanel.classList.add('is-hidden');
    if (nextBtn) nextBtn.classList.add('is-hidden');
    
    const header = document.querySelector('.solution-header');
    if (header) {
        header.classList.remove('active');
        const body = document.getElementById('calc-solution-body');
        if (body) body.classList.add('is-hidden');
    }
    
    if (typeof clearScratchpad === 'function') {
        clearScratchpad();
    }
}

export function submitCalcAnswer() {
    const calcState = state.trainer.calc;
    const currentQ = calcState.currentQuestion;
    const input = document.getElementById('calc-answer-input');
    if (!input) return;
    const userVal = parseFloat(input.value);
    
    if (isNaN(userVal)) {
        showToast("올바른 숫자를 입력해 주세요!", "warning");
        return;
    }
    
    input.disabled = true;
    const submitBtn = document.getElementById('submit-calc-btn');
    if (submitBtn) submitBtn.disabled = true;
    
    calcState.totalSolved++;
    
    const correctVal = parseFloat(currentQ.answer);
    const isCorrect = Math.abs(userVal - correctVal) <= 0.02;
    vibrate(isCorrect ? HAPTIC.correct : HAPTIC.wrong);
    
    if (isCorrect) {
        calcState.correctCount++;
    }
    
    addCalcHistoryItem(currentQ.question, currentQ.type, userVal, currentQ.answer, isCorrect, currentQ.unit);
    
    const feedbackPanel = document.getElementById('calc-feedback-panel');
    const feedbackTitle = document.getElementById('calc-feedback-title');
    const feedbackDesc = document.getElementById('calc-feedback-desc');
    const solutionBody = document.getElementById('calc-solution-body');
    const solutionPanel = document.getElementById('calc-solution-panel');
    const nextBtn = document.getElementById('next-calc-btn');

    if (feedbackPanel) feedbackPanel.classList.remove('is-hidden');
    if (isCorrect) {
        if (feedbackPanel) feedbackPanel.classList.remove('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = '정답입니다!';
        if (feedbackDesc) feedbackDesc.textContent = `훌륭합니다! 올바른 배합 계산 결과입니다.`;
    } else {
        if (feedbackPanel) feedbackPanel.classList.add('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = `오답입니다! (내가 쓴 답: ${userVal}${currentQ.unit})`;
        if (feedbackDesc) feedbackDesc.textContent = `정답은 약 ${currentQ.answer}${currentQ.unit} 입니다. 아래의 공식을 활용하여 풀이법을 다시 체크해 보세요.`;
    }
    
    if (solutionBody) solutionBody.innerHTML = currentQ.solution;
    if (solutionPanel) solutionPanel.classList.remove('is-hidden');
    if (nextBtn) nextBtn.classList.remove('is-hidden');
}

export function toggleSolutionAccordion() {
    const header = document.querySelector('.solution-header');
    const body = document.getElementById('calc-solution-body');
    if (!body) return;
    const isVisible = !body.classList.contains('is-hidden');
    
    if (isVisible) {
        if (header) header.classList.remove('active');
        body.classList.add('is-hidden');
    } else {
        if (header) header.classList.add('active');
        body.classList.remove('is-hidden');
    }
}

export function renderCalcHistory() {
    const listContainer = document.getElementById('calc-history-list');
    if (!listContainer) return;
    
    const historyJSON = safeGetItem(STORAGE_KEYS.CALC_HISTORY);
    let history = [];
    if (historyJSON) {
        try {
            history = JSON.parse(historyJSON);
        } catch(e) {
            console.error(e);
        }
    }
    
    if (history.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--color-text-muted); font-size: 0.8rem; padding: 1rem;">이전 풀이 기록이 없습니다.</div>`;
        return;
    }
    
    listContainer.innerHTML = '';
    history.forEach(item => {
        const badgeColor = item.isCorrect ? 'var(--color-success)' : 'var(--color-danger)';
        const badgeBg = item.isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        const dateStr = item.date ? item.date.substring(5, 16).replace('T', ' ') : '';
        
        const cardHTML = `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.8rem; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-weight: bold; background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">
                        ${item.isCorrect ? '🟢 정답' : '🔴 오답'} [${item.type}]
                    </span>
                    <span style="color: var(--color-text-muted); font-size: 0.75rem;">${dateStr}</span>
                </div>
                <div style="color: var(--color-text-muted); line-height: 1.4; margin-bottom: 0.25rem;">${safeTextWithBreaks(item.question)}</div>
                <div style="display: flex; gap: 1rem; margin-top: 0.25rem; font-size: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 0.25rem;">
                    <span style="color: #9ca3af;">내가 입력한 값: <strong style="color: #fff;">${esc(item.userVal)}${esc(item.unit)}</strong></span>
                    <span style="color: #9ca3af;">실제 정답: <strong style="color: var(--color-success);">${esc(item.correctAns)}${esc(item.unit)}</strong></span>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
}

export function addCalcHistoryItem(questionText, type, userVal, correctAns, isCorrect, unit) {
    const historyJSON = safeGetItem(STORAGE_KEYS.CALC_HISTORY);
    let history = [];
    if (historyJSON) {
        try {
            history = JSON.parse(historyJSON);
        } catch(e) {
            console.error(e);
        }
    }
    
    const newItem = {
        date: new Date().toISOString(),
        question: questionText.replace(/<[^>]*>/g, '').substring(0, 80) + (questionText.length > 80 ? '...' : ''),
        type: type,
        userVal: userVal,
        correctAns: correctAns,
        isCorrect: isCorrect,
        unit: unit
    };
    
    history.unshift(newItem);
    
    if (history.length > 5) {
        history = history.slice(0, 5);
    }
    
    safeSetItem(STORAGE_KEYS.CALC_HISTORY, JSON.stringify(history));
    renderCalcHistory();
}
