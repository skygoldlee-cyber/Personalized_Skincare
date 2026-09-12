// views/trainer-ingredients.js — 화장품 원료 안전성 챌린지 (trainer.js에서 추출)
import { state } from '../state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';
import { shuffle } from '../utils.js';
import { showToast, vibrate, HAPTIC } from '../ui-utils.js';

/* =======================================================
   🧪 화장품 원료 안전성 챌린지 훈련 로직 (Ingredients Safety Trainer)
   ======================================================= */
export function startIngredientsChallenge() {
    state.trainer.activeSubView = 'ingredients';
    state.trainer.ingredients.currentIndex = 0;
    state.trainer.ingredients.correctCount = 0;
    state.trainer.ingredients.solvedList = [];
    state.trainer.ingredients.shuffledQuestions = generateIngredientsQuestions();
    
    const menuPanel = document.getElementById('trainer-menu-panel');
    const ingPanel = document.getElementById('trainer-ingredients-panel');
    if (menuPanel) menuPanel.classList.add('is-hidden');
    if (ingPanel) ingPanel.classList.remove('is-hidden');
    
    renderIngQuestion();
}

export function generateIngredientsQuestions() {
    const list = [];
    const db = typeof window.INGREDIENTS_DATA !== 'undefined' ? window.INGREDIENTS_DATA : [];
    if (db.length === 0) return [];
    
    const shuffledDb = shuffle(db);
    
    for (let i = 0; i < Math.min(10, shuffledDb.length); i++) {
        const ing = shuffledDb[i];
        
        let qType = 0; // 0: 안전성 구분, 1: 배합 한도 주관식, 2: 조제 적합성, 3: 알레르기 유발 물질
        
        if (ing.type === 'restricted' && ing.limit && Math.random() > 0.5) {
            qType = 1;
        } else if ((ing.category && (ing.category.includes('알레르기') || ing.category.includes('향료'))) && Math.random() > 0.5) {
            qType = 3;
        } else if (Math.random() > 0.6) {
            qType = 2;
        }
        
        if (qType === 0) {
            let correctText = '';
            if (ing.type === 'approved') correctText = '🟢 사용 가능 원료';
            else if (ing.type === 'restricted') correctText = '🟡 사용상의 제한이 필요한 원료 (보존제/자외선차단제 등)';
            else correctText = '🔴 사용할 수 없는 원료 (배합 금지)';
            
            list.push({
                type: 'choice',
                qTypeLabel: '안전성 판별',
                question: `화장품 안전 기준 고시상, 성분명 <strong>"${esc(ing.name)}"</strong> (${esc(ing.engName || '영문명 없음')}) 은(는) 어디에 해당합니까?`,
                correct: correctText,
                options: [
                    '🟢 사용 가능 원료',
                    '🟡 사용상의 제한이 필요한 원료 (보존제/자외선차단제 등)',
                    '🔴 사용할 수 없는 원료 (배합 금지)'
                ],
                explanation: `성분명 "${ing.name}"은(는) ${correctText}에 해당합니다.\n• 카테고리: ${ing.category}\n• 특징: ${ing.description || '법적 허용 기준 준수 대상'}\n• 고득점 TIP: ${ing.tip || '안전 기준 규격을 반드시 암기하세요.'}`
            });
        } else if (qType === 1) {
            list.push({
                type: 'short',
                qTypeLabel: '배합 한도 주관식',
                question: `사용상의 제한이 필요한 보존제/자외선 차단 성분인 <strong>"${esc(ing.name)}"</strong>의 법정 최대 배합 한도(%)는 얼마입니까?<br>(※ 성분 데이터에 명시된 수치와 % 기호 및 세부 조건을 정확히 입력하세요. 예: 1.0%, 0.5% 등)`,
                correct: ing.limit,
                explanation: `성분명 "${ing.name}"의 법정 사용 한도는 "${ing.limit}" 입니다.\n• 특징: ${ing.description || ''}\n• 비고/TIP: ${ing.tip || ''}`
            });
        } else if (qType === 2) {
            let questionText = '';
            let correctText = '';
            let options = [];
            
            if (ing.type === 'restricted') {
                questionText = `맞춤형화장품 조제관리사가 매장에서 혼합/소분 조제 시, 보존제/자외선차단 원료인 <strong>"${esc(ing.name)}"</strong>을(를) 직접 저울에 계량하여 배합할 수 있습니까?`;
                correctText = '🔴 직접 배합 불가 (벌크 내용물에 이미 포함된 형태만 허용)';
                options = [
                    '🟢 직접 배합 가능 (법적 배합 한도 내라면 직접 혼합 가능)',
                    '🔴 직접 배합 불가 (벌크 내용물에 이미 포함된 형태만 허용)'
                ];
            } else if (ing.type === 'banned') {
                questionText = `맞춤형화장품 조제관리사가 매장에서 조제 시, 배합 금지 원료인 <strong>"${esc(ing.name)}"</strong>을(를) 혼합하여 조제할 수 있습니까?`;
                correctText = '🔴 절대 배합 불가';
                options = [
                    '🟢 배합 가능',
                    '🔴 절대 배합 불가'
                ];
            } else {
                questionText = `맞춤형화장품 조제관리사가 매장에서 조제 시, 사용 가능 원료인 <strong>"${esc(ing.name)}"</strong>을(를) 직접 계량하여 배합할 수 있습니까?`;
                correctText = '🟢 직접 배합 가능';
                options = [
                    '🟢 직접 배합 가능',
                    '🔴 직접 배합 불가'
                ];
            }
            
            list.push({
                type: 'choice',
                qTypeLabel: '조제 적합성 판정',
                question: questionText,
                correct: correctText,
                options: options,
                explanation: ing.type === 'restricted' 
                    ? `별표 2 사용상의 제한이 필요한 원료는 <strong>조제관리사가 직접 매장에서 계량하여 배합하는 것이 법적으로 전면 금지</strong>됩니다. 책임판매업자가 공급한 벌크(내용물)에 이미 배합된 형태로만 유통이 가능합니다.` 
                    : (ing.type === 'banned' ? `<strong>"${esc(ing.name)}"</strong>은(는) 사용할 수 없는 원료(별표 1)에 해당하므로 화장품 제조 및 조제에 절대 사용이 불가합니다.` : `일반 사용 가능 원료(approved)인 <strong>"${esc(ing.name)}"</strong>은(는) 조제관리사가 매장에서 직접 계량하여 혼합(조제)할 수 있는 성분입니다.`)
            });
        } else {
            const isRinseOff = Math.random() > 0.5;
            const productType = isRinseOff ? '사용 후 씻어내는 제품' : '사용 후 씻어내지 않는 제품';
            
            let conc = 0;
            if (isRinseOff) {
                conc = Math.random() > 0.5 
                    ? parseFloat((0.01 + Math.random() * 0.02).toFixed(4))
                    : parseFloat((0.001 + Math.random() * 0.008).toFixed(4));
            } else {
                conc = Math.random() > 0.5 
                    ? parseFloat((0.001 + Math.random() * 0.005).toFixed(4))
                    : parseFloat((0.0001 + Math.random() * 0.0008).toFixed(4));
            }
            
            const limitVal = isRinseOff ? 0.01 : 0.001;
            const isRequired = conc > limitVal;
            const correctText = isRequired ? '🟢 의무 고지 대상' : '🔴 고지 의무 없음';
            
            list.push({
                type: 'choice',
                qTypeLabel: '알레르기 성분 표시 의무',
                question: `알레르기 유발 향료 성분인 <strong>"${esc(ing.name)}"</strong>을(를) <strong>[${esc(productType)}]</strong>에 <strong>${conc}%</strong> 배합했습니다. 화장품 포장 용기 전성분 표에 이 성분명을 별도로 기재(고지)해야 합니까?`,
                correct: correctText,
                options: [
                    '🟢 의무 고지 대상',
                    '🔴 고지 의무 없음'
                ],
                explanation: `알레르기 유발 성분 25종 기재 기준:\n• 씻어내는 제품: 0.01% 초과 시 기재 의무\n• 씻어내지 않는 제품: 0.001% 초과 시 기재 의무\n현재 배합량 ${conc}%는 기준치 ${limitVal}%에 대해 ${isRequired ? '초과' : '이하'}이므로, ${correctText}이(가) 맞습니다.`
            });
        }
    }
    
    return list;
}

export function renderIngQuestion() {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    
    const progressEl = document.getElementById('ing-progress-indicator');
    const labelEl = document.getElementById('ing-q-type-label');
    const textEl = document.getElementById('ing-question-text');

    if (progressEl) progressEl.textContent = `문제 ${ingState.currentIndex + 1} / ${ingState.shuffledQuestions.length}`;
    if (labelEl) labelEl.textContent = currentQ.qTypeLabel;
    if (textEl) textEl.innerHTML = currentQ.question;
    
    // 진행률 바
    const ingProgressBar = document.getElementById('ing-progress-bar');
    if (ingProgressBar) {
        const pct = Math.round(((ingState.currentIndex) / ingState.shuffledQuestions.length) * 100);
        ingProgressBar.style.width = `${pct}%`;
    }
    
    const optionsContainer = document.getElementById('ing-options-container');
    const inputContainer = document.getElementById('ing-input-container');
    const answerInput = document.getElementById('ing-answer-input');
    
    if (optionsContainer) optionsContainer.innerHTML = '';
    if (answerInput) answerInput.value = '';
    
    if (currentQ.type === 'choice') {
        if (optionsContainer) optionsContainer.classList.remove('is-hidden');
        if (inputContainer) inputContainer.classList.add('is-hidden');
        
        const optionIndicators = ['A', 'B', 'C', 'D'];
        currentQ.options.forEach((optValue, idx) => {
            const btn = document.createElement('button');
            btn.className = 'limits-opt-btn';
            btn.innerHTML = `<span class="limits-opt-num">${optionIndicators[idx]}</span> <span class="limits-opt-text">${esc(optValue)}</span>`;
            btn.addEventListener('click', () => {
                submitIngChoiceAnswer(btn, optValue, currentQ.correct);
            });
            if (optionsContainer) optionsContainer.appendChild(btn);
        });
    } else {
        if (optionsContainer) optionsContainer.classList.add('is-hidden');
        if (inputContainer) inputContainer.classList.remove('is-hidden');
    }
    
    const feedbackPanel = document.getElementById('ing-feedback-panel');
    const nextBtn = document.getElementById('next-ing-btn');
    if (feedbackPanel) feedbackPanel.classList.add('is-hidden');
    if (nextBtn) nextBtn.classList.add('is-hidden');
}

export function submitIngChoiceAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
    vibrate(isCorrect ? HAPTIC.correct : HAPTIC.wrong);
    const container = document.getElementById('ing-options-container');
    if (!container) return;
    const buttons = container.querySelectorAll('.limits-opt-btn');
    
    buttons.forEach(btn => {
        btn.disabled = true;
        const textSpan = btn.querySelector('.limits-opt-text');
        if (textSpan && textSpan.textContent === correctValue) {
            btn.classList.add('correct');
        }
    });
    
    if (!isCorrect) {
        selectedBtn.classList.add('incorrect');
    } else {
        state.trainer.ingredients.correctCount++;
    }
    
    // solvedList에 기록
    const currentQ = state.trainer.ingredients.shuffledQuestions[state.trainer.ingredients.currentIndex];
    state.trainer.ingredients.solvedList.push({
        question: currentQ.question.replace(/<[^>]*>/g, ''),
        selected: selectedValue,
        correctAnswer: correctValue,
        correct: isCorrect
    });
    
    showIngFeedback(isCorrect, correctValue);
}

export function submitIngAnswer() {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    const input = document.getElementById('ing-answer-input');
    if (!input) return;
    const userInput = input.value.trim();
    
    if (!userInput) {
        showToast('정답을 입력하세요!', 'warning');
        return;
    }
    
    const isCorrect = checkShortAnswer(userInput, currentQ.correct);
    vibrate(isCorrect ? HAPTIC.correct : HAPTIC.wrong);
    if (isCorrect) {
        ingState.correctCount++;
    }
    
    // solvedList에 기록
    ingState.solvedList.push({
        question: currentQ.question.replace(/<[^>]*>/g, ''),
        selected: userInput,
        correctAnswer: currentQ.correct,
        correct: isCorrect
    });
    
    showIngFeedback(isCorrect, currentQ.correct);
}

export function showIngFeedback(isCorrect, correctValue) {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    
    const feedbackPanel = document.getElementById('ing-feedback-panel');
    const feedbackTitle = document.getElementById('ing-feedback-title');
    const feedbackDesc = document.getElementById('ing-feedback-desc');
    
    if (feedbackPanel) feedbackPanel.classList.remove('is-hidden');
    if (feedbackTitle) {
        if (isCorrect) {
            feedbackPanel.classList.remove('incorrect');
            feedbackTitle.innerHTML = '🟢 정답입니다!';
        } else {
            feedbackPanel.classList.add('incorrect');
            feedbackTitle.innerHTML = `🔴 오답입니다! (정답: <strong>${esc(correctValue)}</strong>)`;
        }
    }
    if (feedbackDesc) feedbackDesc.innerHTML = safeTextWithBreaks(currentQ.explanation);
    
    const nextBtn = document.getElementById('next-ing-btn');
    if (nextBtn) nextBtn.classList.remove('is-hidden');
    
    const submitBtn = document.getElementById('submit-ing-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    const answerInput = document.getElementById('ing-answer-input');
    if (answerInput) {
        answerInput.disabled = true;
    }
}

export function nextIngQuestion() {
    const submitBtn = document.getElementById('submit-ing-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
    }
    const answerInput = document.getElementById('ing-answer-input');
    if (answerInput) {
        answerInput.disabled = false;
    }

    const ingState = state.trainer.ingredients;
    ingState.currentIndex++;
    
    if (ingState.currentIndex >= ingState.shuffledQuestions.length) {
        renderIngredientsResult();
    } else {
        renderIngQuestion();
    }
}

function renderIngredientsResult() {
    const ingState = state.trainer.ingredients;
    const panel = document.getElementById('trainer-ingredients-panel');
    if (!panel) return;

    const total = ingState.shuffledQuestions.length;
    const correct = ingState.correctCount;
    const rate = Math.round((correct / total) * 100);
    const wrongAnswers = ingState.solvedList.filter(s => !s.correct);

    let reviewHTML = '';
    if (wrongAnswers.length === 0) {
        reviewHTML = '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 문제를 맞혔습니다!</p>';
    } else {
        reviewHTML = `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오답 리뷰 (${wrongAnswers.length}문제)</h3>`;
        wrongAnswers.forEach((s, idx) => {
            reviewHTML += `
                <div style="padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
                    <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:0.3rem;">Q${idx + 1}</div>
                    <p style="font-size:0.9rem; margin-bottom:0.4rem;">${safeTextWithBreaks(s.question)}</p>
                    <p style="font-size:0.85rem; color:var(--color-danger);">내 답: ${esc(s.selected)}</p>
                    <p style="font-size:0.85rem; color:var(--color-success);">정답: <strong>${esc(s.correctAnswer)}</strong></p>
                </div>`;
        });
    }

    panel.innerHTML = `
        <div class="sim-arena-header" style="margin-bottom: 2rem;">
            <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
            <div class="sim-title-group">
                <h4>원료 안전성 챌린지 결과</h4>
                <span class="badge badge-quiz-cat">원료 규격 & 안전성</span>
            </div>
        </div>
        <div class="trainer-arena" style="text-align:center;">
            <i class="fa-solid fa-trophy trophy-icon"></i>
            <h2>챌린지 완료!</h2>
            <p class="result-score-summary">정답수: <strong>${correct}</strong> / ${total} (${rate}%)</p>
            <div style="text-align:left; margin:1.5rem 0; max-width:600px; margin-left:auto; margin-right:auto;">${reviewHTML}</div>
            <div class="result-actions" style="display:flex; gap:1rem; justify-content:center;">
                <button class="btn btn-primary" data-click="startIngredientsChallenge"><i class="fa-solid fa-rotate-left"></i> 다시 도전</button>
                <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-house"></i> 메뉴로</button>
            </div>
        </div>`;
}
