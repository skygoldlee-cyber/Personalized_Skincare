// src/views/daily-challenge.js - 일일 5분 데일리 챌린지 & Streak 로직 (quiz.js에서 분리)
import { state, saveProgress, safeGetItem, safeSetItem } from '../state.js';
import { safeTextWithBreaks, esc } from '../sanitize.js';
import { DataLoader } from '../data-loader.js';
import { checkShortAnswer } from './trainer.js';
import { shuffle } from '../utils.js';

/* =======================================================
   🧩 일일 5분 데일리 챌린지 (Daily 5-Min Challenge) & Streak
   ======================================================= */
export const dailyState = {
    currentIndex: 0,
    correctCount: 0,
    questions: []
};

/**
 * 연속 학습일 Streak 정보 및 데일리 챌린지 미션 상태 UI 업데이트
 */
export function updateStreakAndDailyUI() {
    const streakDaysEl = document.getElementById('streak-days');
    const challengeStatusEl = document.getElementById('daily-challenge-status');
    const startBtn = document.getElementById('start-daily-btn');
    
    if (!streakDaysEl) return;
    
    let streak = parseInt(safeGetItem('study_streak')) || 0;
    const lastDate = safeGetItem('study_streak_last_date');
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (lastDate) {
        const last = new Date(lastDate);
        const today = new Date(todayStr);
        const diffTime = Math.abs(today - last);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
            streak = 0;
            safeSetItem('study_streak', 0);
        }
    } else {
        streak = 0;
    }
    
    streakDaysEl.textContent = streak;
    
    const todayCompleted = safeGetItem(`daily_completed_${todayStr}`);
    if (todayCompleted) {
        if (challengeStatusEl) {
            challengeStatusEl.textContent = '🟢 오늘 미션 완료!';
            challengeStatusEl.style.color = 'var(--color-success)';
        }
        if (startBtn) {
            startBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> 오늘 완료됨';
            startBtn.disabled = true;
        }
    } else {
        if (challengeStatusEl) {
            challengeStatusEl.textContent = '오늘 미션 미완료';
            challengeStatusEl.style.color = 'var(--color-text-muted)';
        }
        if (startBtn) {
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 챌린지 시작';
            startBtn.disabled = false;
        }
    }
}

/**
 * 데일리 챌린지 시작
 */
export function startDailyChallenge() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCompleted = safeGetItem(`daily_completed_${todayStr}`);
    if (todayCompleted) {
        alert('오늘의 데일리 챌린지를 이미 달성하셨습니다! 내일 다시 도전해 주세요.');
        return;
    }
    
    const loaderPromises = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key));
    Promise.all(loaderPromises).then(() => {
        _startDailyChallengeImpl();
    }).catch(err => {
        console.error(err);
        alert("챌린지 데이터를 로드하지 못했습니다.");
    });
}

function _startDailyChallengeImpl() {
    const qPack = [];
    
    // 1. 플래시카드 복습 3개
    let allCards = [];
    if (window.STUDY_DATA) {
        Object.keys(window.STUDY_DATA).forEach(subjId => {
            allCards = allCards.concat(window.STUDY_DATA[subjId].cards.map(c => ({...c, subject: subjId})));
        });
    }
    const selectedCards = shuffle(allCards).slice(0, 3);
    selectedCards.forEach(c => {
        qPack.push({
            type: 'card',
            cardObj: c,
            question: `다음 개념의 정답을 아십니까?\n\n[설명]\n${c.definition}`,
            correct: c.term
        });
    });
    
    // 2. 퀴즈 풀이 3개
    let allQuizzes = [];
    if (window.STUDY_DATA) {
        Object.keys(window.STUDY_DATA).forEach(subjId => {
            allQuizzes = allQuizzes.concat(window.STUDY_DATA[subjId].quizzes.map(q => ({...q, subject: subjId})));
        });
    }
    const selectedQuizzes = shuffle(allQuizzes).slice(0, 3);
    selectedQuizzes.forEach(q => {
        qPack.push({
            type: q.type === 'choice' ? 'choice' : 'short',
            question: `[기출 퀴즈] ${q.question}`,
            correct: q.answer,
            options: q.options || null,
            explanation: `과목: ${q.subject}`
        });
    });
    
    // 3. 배합 계산 문제 1개
    const w = [100, 200, 300][Math.floor(Math.random() * 3)];
    const cVal = [1, 2, 3, 5][Math.floor(Math.random() * 4)];
    const formulaWeight = (w * cVal) / 100;
    qPack.push({
        type: 'short',
        question: `[실전 계산] 베이스 오일 ${w}g에 보존 성분 ${cVal}%를 배합하여 제품을 조제하려고 합니다. 첨가해야 할 성분의 중량은 몇 g인가요? (소수점 둘째자리까지 정답 인정)`,
        correct: String(formulaWeight.toFixed(2)),
        explanation: `계산 공식: 중량 = (전체 중량 * 배합 %) / 100 = (${w} * ${cVal}) / 100 = ${formulaWeight}g`
    });
    
    // 4. 원료 안전성 판별 1개
    const db = typeof window.INGREDIENTS_DATA !== 'undefined' ? window.INGREDIENTS_DATA : [];
    if (db.length > 0) {
        const ing = db[Math.floor(Math.random() * db.length)];
        let correctText = '';
        if (ing.type === 'approved') correctText = '🟢 사용 가능 원료';
        else if (ing.type === 'restricted') correctText = '🟡 사용상의 제한이 필요한 원료 (보존제/자외선차단제 등)';
        else correctText = '🔴 사용할 수 없는 원료 (배합 금지)';
        
        qPack.push({
            type: 'choice',
            question: `[원료 안전성] 다음 성분명 "${ing.name}"은(는) 화장품 원료 고시 기준상 어느 그룹에 속하나요?`,
            correct: correctText,
            options: [
                '🟢 사용 가능 원료',
                '🟡 사용상의 제한이 필요한 원료 (보존제/자외선차단제 등)',
                '🔴 사용할 수 없는 원료 (배합 금지)'
            ],
            explanation: `성분 "${ing.name}"은(는) ${correctText} 입니다. 한도: ${ing.limit || '제한 없음'}`
        });
    }
    
    dailyState.currentIndex = 0;
    dailyState.correctCount = 0;
    dailyState.questions = qPack;
    
    showDailyModal();
}

export function showDailyModal() {
    const oldModal = document.getElementById('daily-challenge-modal');
    if (oldModal) oldModal.remove();
    
    const modalHTML = `
        <div id="daily-challenge-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(11, 15, 25, 0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
            <div class="glass-card" style="width: 90%; max-width: 600px; padding: 2.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); position: relative; box-shadow: var(--shadow-lg);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="font-weight: 700; color: var(--color-primary); margin: 0; font-size: 1.4rem;"><i class="fa-solid fa-fire"></i> 데일리 챌린지</h3>
                    <span id="daily-modal-progress" style="font-size: 0.9rem; color: var(--color-text-muted);">진행: 1 / 8</span>
                </div>
                
                <div class="progress-bar-container" style="height: 6px; margin-bottom: 2rem;">
                    <div id="daily-modal-bar" class="progress-bar" style="width: 12.5%; background: var(--color-primary);"></div>
                </div>
                
                <div id="daily-modal-q-body" style="min-height: 200px; margin-bottom: 2rem;">
                    질문 로딩 중...
                </div>
                
                <div id="daily-modal-answer-area" style="margin-bottom: 2rem;">
                </div>
                
                <div class="quiz-feedback" id="daily-modal-feedback" style="display: none; margin-bottom: 2rem; padding: 1.25rem;">
                    <div class="feedback-icon" id="daily-modal-feedback-icon"><i class="fa-solid fa-check"></i></div>
                    <div class="feedback-content">
                        <h4 id="daily-modal-feedback-title">정답입니다!</h4>
                        <p id="daily-modal-feedback-desc" style="font-size: 0.9rem;">설명</p>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="btn btn-secondary" data-click="closeDailyModal"><i class="fa-solid fa-xmark"></i> 나가기</button>
                    <button id="daily-modal-next-btn" class="btn btn-success" style="display: none;" data-click="nextDailyStep">다음 단계 <i class="fa-solid fa-arrow-right"></i></button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    renderDailyStep();
}

export function closeDailyModal() {
    if (confirm('도중에 나가시면 데일리 미션 진도가 저장되지 않습니다. 정말 나가시겠습니까?')) {
        const modal = document.getElementById('daily-challenge-modal');
        if (modal) modal.remove();
    }
}

export function renderDailyStep() {
    const q = dailyState.questions[dailyState.currentIndex];
    
    document.getElementById('daily-modal-progress').textContent = `진행: ${dailyState.currentIndex + 1} / ${dailyState.questions.length}`;
    document.getElementById('daily-modal-bar').style.width = `${((dailyState.currentIndex + 1) / dailyState.questions.length) * 100}%`;
    document.getElementById('daily-modal-feedback').style.display = 'none';
    document.getElementById('daily-modal-next-btn').style.display = 'none';
    
    const qBody = document.getElementById('daily-modal-q-body');
    qBody.innerHTML = `<h4 style="font-size: 1.15rem; line-height: 1.8; font-weight: 500;">${safeTextWithBreaks(q.question)}</h4>`;
    
    const answerArea = document.getElementById('daily-modal-answer-area');
    answerArea.innerHTML = '';
    
    if (q.type === 'card') {
        qBody.innerHTML = `
            <div id="daily-card-container" style="perspective: 1000px; margin: 1rem 0; width: 100%; height: 180px; cursor: pointer;">
                <div id="daily-card-inner" style="width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform 0.6s;">
                    <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(31, 41, 55, 0.95);">
                        <p style="text-align: center; font-size: 1rem; line-height: 1.6;">${safeTextWithBreaks(q.cardObj.definition)}</p>
                        <span style="color: var(--color-primary); font-size: 0.8rem; margin-top: 1rem;"><i class="fa-solid fa-rotate"></i> 카드를 클릭해 뒤집기</span>
                    </div>
                    <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(17, 24, 39, 0.95); transform: rotateY(180deg);">
                        <h2 style="font-size: 1.6rem; color: var(--color-primary); font-weight: 800;">${esc(q.cardObj.term)}</h2>
                    </div>
                </div>
            </div>
        `;
        
        const cardContainer = document.getElementById('daily-card-container');
        cardContainer.addEventListener('click', () => {
            const inner = document.getElementById('daily-card-inner');
            inner.style.transform = inner.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
        });
        
        answerArea.innerHTML = `
            <div style="display: flex; gap: 1rem; width: 100%;">
                <button class="btn btn-warning" data-click="submitDailyCardAnswer" data-args="[false]" style="flex: 1; justify-content: center;"><i class="fa-solid fa-question"></i> 아직 헷갈림</button>
                <button class="btn btn-success" data-click="submitDailyCardAnswer" data-args="[true]" style="flex: 1; justify-content: center;"><i class="fa-solid fa-check"></i> 완벽히 외움</button>
            </div>
        `;
    } else if (q.type === 'choice') {
        const optionIndicators = ['A', 'B', 'C', 'D'];
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'limits-opt-btn';
            btn.style.width = '100%';
            btn.style.marginBottom = '0.75rem';
            btn.innerHTML = `<span class="limits-opt-num">${esc(optionIndicators[idx])}</span> <span class="limits-opt-text">${esc(opt)}</span>`;
            btn.addEventListener('click', () => {
                submitDailyChoiceAnswer(btn, opt, q.correct);
            });
            answerArea.appendChild(btn);
        });
    } else {
        answerArea.innerHTML = `
            <div style="display: flex; gap: 1rem; align-items: center; width: 100%;">
                <input type="text" id="daily-answer-input" class="form-input" placeholder="정답을 기재하세요" style="flex: 1; height: 50px;" autocomplete="off">
                <button class="btn btn-primary" data-click="submitDailyShortAnswer" style="height: 50px;"><i class="fa-solid fa-circle-check"></i> 제출</button>
            </div>
        `;
    }
}

export function submitDailyCardAnswer(isMemorized) {
    if (isMemorized) {
        dailyState.correctCount++;
    }
    
    const feedback = document.getElementById('daily-modal-feedback');
    const title = document.getElementById('daily-modal-feedback-title');
    const desc = document.getElementById('daily-modal-feedback-desc');
    
    if (feedback) feedback.style.display = 'flex';
    if (feedback) feedback.classList.remove('incorrect');
    if (title) title.textContent = isMemorized ? '완벽히 외운 카드로 분류했습니다.' : '헷갈린 복습 카드로 분류했습니다.';
    if (desc) desc.textContent = `용어: ${dailyState.questions[dailyState.currentIndex].correct}`;
    
    const q = dailyState.questions[dailyState.currentIndex];
    if (isMemorized) {
        state.memorizedCards.add(q.cardObj.id);
        state.weakCards.delete(q.cardObj.id);
    } else {
        state.weakCards.add(q.cardObj.id);
    }
    saveProgress();
    
    const nextBtn = document.getElementById('daily-modal-next-btn');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
}

export function submitDailyChoiceAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
    const answerArea = document.getElementById('daily-modal-answer-area');
    const buttons = answerArea.querySelectorAll('.limits-opt-btn');
    
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
        dailyState.correctCount++;
    }
    
    showDailyFeedback(isCorrect, correctValue);
}

export function submitDailyShortAnswer() {
    const input = document.getElementById('daily-answer-input');
    if (!input) return;
    const userInput = input.value.trim();
    if (!userInput) {
        alert('정답을 입력하세요!');
        return;
    }
    
    const q = dailyState.questions[dailyState.currentIndex];
    const isCorrect = checkShortAnswer(userInput, q.correct);
    
    if (isCorrect) {
        dailyState.correctCount++;
    }
    
    input.disabled = true;
    const btn = document.querySelector('#daily-modal-answer-area button');
    if (btn) btn.disabled = true;
    
    showDailyFeedback(isCorrect, q.correct);
}

export function showDailyFeedback(isCorrect, correctValue) {
    const q = dailyState.questions[dailyState.currentIndex];
    const feedback = document.getElementById('daily-modal-feedback');
    const title = document.getElementById('daily-modal-feedback-title');
    const desc = document.getElementById('daily-modal-feedback-desc');
    
    if (feedback) feedback.style.display = 'flex';
    if (title) {
        if (isCorrect) {
            feedback.classList.remove('incorrect');
            title.innerHTML = '🟢 정답입니다!';
        } else {
            feedback.classList.add('incorrect');
            title.innerHTML = `🔴 오답입니다! (정답: <strong>${esc(correctValue)}</strong>)`;
        }
    }
    if (desc) desc.innerHTML = safeTextWithBreaks(q.explanation || '안전 기준 고시 해설을 확인하세요.');
    
    const nextBtn = document.getElementById('daily-modal-next-btn');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
}

export function nextDailyStep() {
    dailyState.currentIndex++;
    if (dailyState.currentIndex >= dailyState.questions.length) {
        finishDailyChallenge();
    } else {
        renderDailyStep();
    }
}

export function finishDailyChallenge() {
    const modal = document.getElementById('daily-challenge-modal');
    if (modal) modal.remove();
    
    alert(`🎉 일일 데일리 챌린지를 완수하셨습니다!\n획득 점수: ${dailyState.correctCount} / ${dailyState.questions.length} 개`);
    
    const todayStr = new Date().toISOString().split('T')[0];
    safeSetItem(`daily_completed_${todayStr}`, "true");
    
    let streak = parseInt(safeGetItem('study_streak')) || 0;
    const lastDate = safeGetItem('study_streak_last_date');
    
    if (lastDate !== todayStr) {
        streak++;
        safeSetItem('study_streak', streak);
        safeSetItem('study_streak_last_date', todayStr);
    }
    
    updateStreakAndDailyUI();
}
