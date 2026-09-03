// src/views/quiz.js - 기출 퀴즈 및 오답 복습 뷰 로직 (데일리 챌린지는 daily-challenge.js로 분리)
import { state, saveProgress, safeGetItem, safeSetItem } from '../state.js';
import { safeTextWithBreaks, esc } from '../sanitize.js';
import { DataLoader } from '../data-loader.js';
import { switchView } from './navigation.js';
import { examIdToSubjectId } from './exam-simulator.js';
import { checkShortAnswer } from './trainer.js';
import { updateGlobalStats } from './dashboard.js';
import { shuffle } from '../utils.js';
import {
    dailyState,
    updateStreakAndDailyUI,
    startDailyChallenge,
    closeDailyModal,
    renderDailyStep,
    submitDailyCardAnswer,
    submitDailyChoiceAnswer,
    submitDailyShortAnswer,
    showDailyFeedback,
    nextDailyStep,
    finishDailyChallenge
} from './daily-challenge.js';

// 데일리 챌린지 함수 재수출 (app.js 호환성 유지)
export {
    dailyState,
    updateStreakAndDailyUI,
    startDailyChallenge,
    closeDailyModal,
    renderDailyStep,
    submitDailyCardAnswer,
    submitDailyChoiceAnswer,
    submitDailyShortAnswer,
    showDailyFeedback,
    nextDailyStep,
    finishDailyChallenge
};

/**
 * 퀴즈 시작 로직
 */
export function startQuiz() {
    const subjId = state.quiz.subject;
    const subjData = (window.STUDY_DATA && window.STUDY_DATA[subjId]);
    if (!subjData || subjData.quizzes.length === 0) {
        alert("이 과목에는 출제 가능한 퀴즈가 없습니다.");
        return;
    }
    
    // 퀴즈 문제 목록 섞기 (Fisher-Yates Shuffle)
    const shuffled = shuffle(subjData.quizzes);
    
    // 최대 10문제만 출제
    state.quiz.data = shuffled.slice(0, 10);
    state.quiz.currentIndex = 0;
    state.quiz.correctCount = 0;
    state.quiz.solvedList = [];
    
    // UI 세팅
    const emptyStateEl = document.getElementById('quiz-empty-state');
    const resultPanelEl = document.getElementById('quiz-result-panel');
    const arenaPanelEl = document.getElementById('quiz-arena-panel');
    const progressHeaderEl = document.querySelector('.quiz-progress-header');

    if (emptyStateEl) emptyStateEl.style.display = 'none';
    if (resultPanelEl) resultPanelEl.style.display = 'none';
    if (arenaPanelEl) arenaPanelEl.style.display = 'block';
    if (progressHeaderEl) progressHeaderEl.style.display = 'flex';
    
    renderQuizQuestion();
}

/**
 * 현재 퀴즈 문제 렌더링 (단답형 / 객관식 / OX 지원)
 */
export function renderQuizQuestion() {
    const quizState = state.quiz;
    const currentQuiz = quizState.data[quizState.currentIndex];
    
    // 진도 바
    const progressPercent = Math.round((quizState.currentIndex / quizState.data.length) * 100);
    const runProgressEl = document.getElementById('quiz-run-progress');
    const currIdxEl = document.getElementById('quiz-curr-idx');
    const totalIdxEl = document.getElementById('quiz-total-idx');
    const correctCountEl = document.getElementById('quiz-correct-count');
    const categoryEl = document.getElementById('quiz-category');
    const contextTitleEl = document.getElementById('quiz-context-title');
    const questionEl = document.getElementById('quiz-question');
    const inputEl = document.getElementById('quiz-answer-input');
    const submitBtn = document.getElementById('submit-quiz-btn');
    const nextBtn = document.getElementById('next-quiz-btn');
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    const optionsContainer = document.getElementById('quiz-options-container');
    const oxContainer = document.getElementById('quiz-ox-container');
    const inputGroup = document.getElementById('quiz-input-group');

    if (runProgressEl) runProgressEl.style.width = `${progressPercent}%`;
    if (currIdxEl) currIdxEl.textContent = quizState.currentIndex + 1;
    if (totalIdxEl) totalIdxEl.textContent = quizState.data.length;
    if (correctCountEl) correctCountEl.textContent = quizState.correctCount;
    
    // 카드 정보 바인딩
    if (categoryEl) categoryEl.textContent = currentQuiz.category;
    if (contextTitleEl) contextTitleEl.textContent = currentQuiz.context;
    
    // 질문 빈칸 파싱
    let qText = currentQuiz.question;
    qText = safeTextWithBreaks(qText).replace(/\[\s*빈칸\s*\]/g, '<strong>[ 빈칸 ]</strong>');
    if (questionEl) questionEl.innerHTML = qText;
    
    // 타입별 UI 분기
    const quizType = currentQuiz.type || 'short';
    
    // 모든 입력 영역 초기화
    if (optionsContainer) { optionsContainer.innerHTML = ''; optionsContainer.style.display = 'none'; }
    if (oxContainer) { oxContainer.style.display = 'none'; }
    if (inputGroup) inputGroup.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (feedbackPanel) feedbackPanel.style.display = 'none';

    if (quizType === 'choice' && currentQuiz.options && currentQuiz.options.length > 0) {
        // 객관식
        if (optionsContainer) {
            optionsContainer.style.display = 'block';
            const optionIndicators = ['①', '②', '③', '④', '⑤'];
            currentQuiz.options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'limits-opt-btn';
                btn.style.width = '100%';
                btn.style.marginBottom = '0.75rem';
                btn.innerHTML = `<span class="limits-opt-num">${esc(optionIndicators[idx] || String(idx + 1))}</span> <span class="limits-opt-text">${esc(opt)}</span>`;
                btn.addEventListener('click', () => {
                    submitQuizChoiceAnswer(btn, opt, currentQuiz.answer);
                });
                optionsContainer.appendChild(btn);
            });
        }
    } else if (quizType === 'ox') {
        // OX 진위형
        if (oxContainer) {
            oxContainer.style.display = 'flex';
            oxContainer.querySelectorAll('.quiz-ox-btn').forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('correct', 'incorrect');
                btn.addEventListener('click', function handler() {
                    btn.removeEventListener('click', handler);
                    submitQuizChoiceAnswer(btn, btn.dataset.ox, currentQuiz.answer);
                }, { once: true });
            });
        }
    } else {
        // 단답형 (기존 로직)
        if (inputGroup) inputGroup.style.display = 'flex';
        if (submitBtn) submitBtn.style.display = 'block';
        if (inputEl) {
            inputEl.value = '';
            inputEl.disabled = false;
            inputEl.focus();
        }
    }
}

/**
 * 퀴즈 정답 제출 (단답형)
 */
export function submitQuizAnswer() {
    const quizState = state.quiz;
    const currentQuiz = quizState.data[quizState.currentIndex];
    const input = document.getElementById('quiz-answer-input');
    if (!input) return;
    const userAnswer = input.value.trim();
    
    if (!userAnswer) {
        alert("답변을 입력해 주세요!");
        return;
    }
    
    input.disabled = true;
    const submitBtn = document.getElementById('submit-quiz-btn');
    if (submitBtn) submitBtn.style.display = 'none';
    
    // 정답 체크 (주관식 유사어 매칭 엔진 적용)
    const isCorrect = checkShortAnswer(userAnswer, currentQuiz.answer);
    
    // 점수 및 상태 누적
    if (isCorrect) {
        quizState.correctCount++;
    }
    
    // solvedList에 기록
    quizState.solvedList.push({
        quizId: currentQuiz.id,
        question: currentQuiz.question,
        selected: userAnswer,
        correctAnswer: currentQuiz.answer,
        correct: isCorrect
    });
    
    // 퀴즈 결과 글로벌 상태에 저장
    state.quizResults[currentQuiz.id] = {
        solved: true,
        correct: isCorrect
    };
    
    // UI 피드백 렌더링
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    const feedbackTitle = document.getElementById('feedback-result-title');
    const feedbackAnswer = document.getElementById('feedback-correct-answer');
    
    if (feedbackPanel) feedbackPanel.style.display = 'flex';
    if (feedbackAnswer) feedbackAnswer.textContent = currentQuiz.answer;
    
    if (isCorrect) {
        if (feedbackPanel) feedbackPanel.classList.remove('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = "정답입니다!";
    } else {
        if (feedbackPanel) feedbackPanel.classList.add('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = `틀렸습니다! (내가 쓴 답: ${userAnswer})`;
    }
    
    // 진행 완료 시 저장
    saveProgress();
    
    // 다음 버튼 활성화
    const nextBtn = document.getElementById('next-quiz-btn');
    if (nextBtn) nextBtn.style.display = 'block';
}

/**
 * 퀴즈 정답 제출 (객관식 / OX)
 */
export function submitQuizChoiceAnswer(selectedBtn, selectedValue, correctValue) {
    const quizState = state.quiz;
    const currentQuiz = quizState.data[quizState.currentIndex];
    const isCorrect = (selectedValue === correctValue);
    
    // 모든 옵션 버튼 비활성화
    const optionsContainer = document.getElementById('quiz-options-container');
    const oxContainer = document.getElementById('quiz-ox-container');
    if (optionsContainer) {
        optionsContainer.querySelectorAll('button').forEach(btn => {
            btn.disabled = true;
            const textSpan = btn.querySelector('.limits-opt-text');
            if (textSpan && textSpan.textContent === correctValue) {
                btn.classList.add('correct');
            }
        });
    }
    if (oxContainer) {
        oxContainer.querySelectorAll('.quiz-ox-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.ox === correctValue) btn.classList.add('correct');
        });
    }
    if (!isCorrect) {
        selectedBtn.classList.add('incorrect');
    } else {
        quizState.correctCount++;
    }
    
    // solvedList에 기록
    quizState.solvedList.push({
        quizId: currentQuiz.id,
        question: currentQuiz.question,
        selected: selectedValue,
        correctAnswer: correctValue,
        correct: isCorrect
    });
    
    // 퀴즈 결과 글로벌 상태에 저장
    state.quizResults[currentQuiz.id] = {
        solved: true,
        correct: isCorrect
    };
    
    // UI 피드백 렌더링
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    const feedbackTitle = document.getElementById('feedback-result-title');
    const feedbackAnswer = document.getElementById('feedback-correct-answer');
    
    if (feedbackPanel) feedbackPanel.style.display = 'flex';
    if (feedbackAnswer) feedbackAnswer.textContent = correctValue;
    
    if (isCorrect) {
        if (feedbackPanel) feedbackPanel.classList.remove('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = "정답입니다!";
    } else {
        if (feedbackPanel) feedbackPanel.classList.add('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = `틀렸습니다! (선택: ${selectedValue})`;
    }
    
    saveProgress();
    
    const nextBtn = document.getElementById('next-quiz-btn');
    if (nextBtn) nextBtn.style.display = 'block';
}

/**
 * 다음 퀴즈 문제로 이동
 */
export function nextQuizQuestion() {
    const quizState = state.quiz;
    quizState.currentIndex++;
    
    if (quizState.currentIndex >= quizState.data.length) {
        // 퀴즈 완전히 종료됨
        renderQuizResult();
    } else {
        renderQuizQuestion();
    }
}

/**
 * 퀴즈 결과 화면 렌더링 (오답 리뷰 포함)
 */
export function renderQuizResult() {
    const quizState = state.quiz;
    
    // UI 전환
    const arenaPanelEl = document.getElementById('quiz-arena-panel');
    const progressHeaderEl = document.querySelector('.quiz-progress-header');
    const resultPanelEl = document.getElementById('quiz-result-panel');

    if (arenaPanelEl) arenaPanelEl.style.display = 'none';
    if (progressHeaderEl) progressHeaderEl.style.display = 'none';
    if (resultPanelEl) resultPanelEl.style.display = 'block';
    
    // 점수 채우기
    const correctNumEl = document.getElementById('result-correct-num');
    const totalNumEl = document.getElementById('result-total-num');
    const percentEl = document.getElementById('result-percent');

    if (correctNumEl) correctNumEl.textContent = quizState.correctCount;
    if (totalNumEl) totalNumEl.textContent = quizState.data.length;
    
    const rate = Math.round((quizState.correctCount / quizState.data.length) * 100);
    if (percentEl) percentEl.textContent = `${rate}%`;
    
    // 오답 리뷰 목록 렌더링
    const reviewListEl = document.getElementById('quiz-review-list');
    if (reviewListEl) {
        const wrongAnswers = quizState.solvedList.filter(s => !s.correct);
        if (wrongAnswers.length === 0) {
            reviewListEl.innerHTML = '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 문제를 맞혔습니다!</p>';
        } else {
            reviewListEl.innerHTML = `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오답 리뷰 (${wrongAnswers.length}문제)</h3>`;
            wrongAnswers.forEach((s, idx) => {
                const item = document.createElement('div');
                item.style.cssText = 'padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);';
                item.innerHTML = `
                    <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:0.3rem;">Q${idx + 1}</div>
                    <p style="font-size:0.9rem; margin-bottom:0.4rem;">${safeTextWithBreaks(s.question)}</p>
                    <p style="font-size:0.85rem; color:var(--color-danger);">내 답: ${esc(s.selected)}</p>
                    <p style="font-size:0.85rem; color:var(--color-success);">정답: <strong>${esc(s.correctAnswer)}</strong></p>
                `;
                reviewListEl.appendChild(item);
            });
        }
    }
}

/**
 * 헷갈린 카드 목록을 반환
 */
export function getWeakCardsList() {
    const list = [];
    
    // 1. 일반 카드 복구
    if (window.STUDY_DATA) {
        Object.keys(window.STUDY_DATA).forEach(subjId => {
            window.STUDY_DATA[subjId].cards.forEach(card => {
                if (state.weakCards.has(card.id)) {
                    list.push({ ...card, subjectId: subjId, subjectName: window.STUDY_DATA[subjId].name });
                }
            });
        });
    }
    
    // 2. 모의고사 오답 카드 복구
    state.weakCards.forEach(cardId => {
        if (cardId.startsWith('weak_sim_')) {
            const parts = cardId.replace('weak_sim_', '').split('_q');
            if (parts.length === 2) {
                const examId = parts[0];
                const qNum = parseInt(parts[1]);
                if (window.EXAM_DATA && window.EXAM_DATA[examId]) {
                    const exam = window.EXAM_DATA[examId];
                    const q = exam.questions.find(quest => quest.num === qNum);
                    if (q) {
                        const targetSubject = examIdToSubjectId(examId);
                        const subjectName = (window.STUDY_DATA && window.STUDY_DATA[targetSubject]) ? window.STUDY_DATA[targetSubject].name : '모의고사';
                        list.push({
                            id: cardId,
                            subjectId: targetSubject,
                            category: exam.title.split('(')[0].trim() || '모의고사 오답',
                            term: `[모의고사 오답] ${q.question.substring(0, 30)}...`,
                            definition: `문제: ${q.question}\n정답: ${q.answer}\n해설: ${q.explanation}`,
                            subjectName: subjectName
                        });
                    }
                }
            }
        }
    });
    
    return list;
}

/**
 * 복습 노트 렌더링
 */
export function renderReviewList() {
    const container = document.getElementById('review-cards-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    const printBtn = document.getElementById('print-review-btn');
    const examBtn = document.getElementById('start-weak-exam-btn');
    const emptyStateEl = document.getElementById('review-empty-state');
    const focusQuizBtn = document.getElementById('start-weak-quiz-btn');
    
    if (state.weakCards.size === 0) {
        if (emptyStateEl) emptyStateEl.style.display = 'flex';
        if (focusQuizBtn) focusQuizBtn.style.display = 'none';
        if (examBtn) examBtn.style.display = 'none';
        if (printBtn) printBtn.style.display = 'none';
        return;
    }
    
    let allCards = getWeakCardsList();
    
    // 필터링 적용
    if (state.reviewFilter && state.reviewFilter !== 'all') {
        allCards = allCards.filter(c => c.subjectId === state.reviewFilter);
    }
    
    if (allCards.length === 0) {
        if (emptyStateEl) {
            emptyStateEl.style.display = 'flex';
            const h3 = emptyStateEl.querySelector('h3');
            const p = emptyStateEl.querySelector('p');
            if (h3) h3.textContent = '이 과목에 해당하는 복습 카드가 없습니다!';
            if (p) p.textContent = '다른 과목 필터를 선택하거나 전체 보기를 누르세요.';
        }
        if (focusQuizBtn) focusQuizBtn.style.display = 'none';
        if (examBtn) examBtn.style.display = 'none';
        if (printBtn) printBtn.style.display = 'none';
        return;
    }
    
    if (emptyStateEl) {
        emptyStateEl.style.display = 'none';
        const h3 = emptyStateEl.querySelector('h3');
        const p = emptyStateEl.querySelector('p');
        if (h3) h3.textContent = '복습할 카드가 없습니다!';
        if (p) p.textContent = '플래시카드 학습 중에 "아직 헷갈림"으로 분류한 카드가 여기에 수집됩니다.';
    }
    
    if (focusQuizBtn) focusQuizBtn.style.display = 'inline-flex';
    if (examBtn) examBtn.style.display = 'inline-flex';
    if (printBtn) printBtn.style.display = 'inline-flex';
    
    allCards.forEach(card => {
        const itemHTML = `
            <div class="review-card-item" id="rev-${card.id}">
                <div class="review-card-item-header">
                    <span class="card-badge">${esc(card.subjectName)}</span>
                    <button class="review-remove-btn" data-click="removeWeakCard" data-arg="${esc(card.id)}">
                        <i class="fa-solid fa-trash-can"></i> 제외
                    </button>
                </div>
                <h5>${esc(card.term)}</h5>
                <p>${safeTextWithBreaks(card.definition)}</p>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

/**
 * 복습 카드 제외
 * @param {string} cardId 
 */
export function removeWeakCard(cardId) {
    state.weakCards.delete(cardId);
    saveProgress();
    
    const cardEl = document.getElementById(`rev-${cardId}`);
    if (cardEl) {
        cardEl.style.transform = 'scale(0.9)';
        cardEl.style.opacity = '0';
        setTimeout(() => {
            renderReviewList();
            updateGlobalStats();
        }, 200);
    }
}

/**
 * 복습 카드 과목 필터 선택
 * @param {string} filterType 
 */
export function setReviewFilter(filterType) {
    state.reviewFilter = filterType;
    
    const buttons = document.querySelectorAll('#review-filter-group .filter-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('data-filter') === filterType) {
            btn.classList.add('active');
            btn.style.background = 'var(--color-primary)';
            btn.style.borderColor = 'var(--color-primary)';
            btn.style.color = '#fff';
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    });
    
    renderReviewList();
}

/**
 * 헷갈린 카드로 즉시 기출 퀴즈를 출제하는 퀴즈 모드
 */
export function startWeakFocusQuiz() {
    let weakCards = getWeakCardsList();
    if (weakCards.length === 0) return;
    
    if (state.reviewFilter && state.reviewFilter !== 'all') {
        weakCards = weakCards.filter(c => c.subjectId === state.reviewFilter);
    }
    
    if (weakCards.length === 0) return;
    
    const weakList = weakCards.map(card => {
        if (card.id.startsWith('weak_sim_')) {
            const parts = card.id.replace('weak_sim_', '').split('_q');
            const examId = parts[0];
            const qNum = parseInt(parts[1]);
            const q = window.EXAM_DATA[examId].questions.find(quest => quest.num === qNum);
            
            let qText = q.question;
            if (q.options && q.options.length) {
                const optionIndicators = ['①', '②', '③', '④', '⑤'];
                qText += '\n' + q.options.map((o, idx) => optionIndicators[idx] + ' ' + o).join('\n');
            }
            
            return {
                id: card.id,
                category: card.category,
                context: `[모의고사 오답 퀴즈]`,
                question: q.question,
                answer: q.answer,
                type: q.type,
                options: q.options || null
            };
        } else {
            return {
                id: card.id,
                category: card.category,
                context: `[오답 집중 학습] 정의에 해당하는 용어를 입력하세요.`,
                question: card.definition,
                answer: card.term,
                type: 'term'
            };
        }
    });
    
    state.quiz.data = shuffle(weakList).slice(0, 10);
    state.quiz.currentIndex = 0;
    state.quiz.correctCount = 0;
    state.quiz.solvedList = [];
    
    switchView('quiz-view');
    
    const emptyStateEl = document.getElementById('quiz-empty-state');
    const resultPanelEl = document.getElementById('quiz-result-panel');
    const arenaPanelEl = document.getElementById('quiz-arena-panel');
    const progressHeaderEl = document.querySelector('.quiz-progress-header');

    if (emptyStateEl) emptyStateEl.style.display = 'none';
    if (resultPanelEl) resultPanelEl.style.display = 'none';
    if (arenaPanelEl) arenaPanelEl.style.display = 'block';
    if (progressHeaderEl) progressHeaderEl.style.display = 'flex';
    
    renderQuizQuestion();
}
