// src/views/quiz.js - 기출 퀴즈, 오답 복습 및 데일리 챌린지 뷰 로직
import { state, saveProgress, safeGetItem, safeSetItem } from '../state.js';
import { safeTextWithBreaks, esc } from '../sanitize.js';
import { DataLoader } from '../data-loader.js';
import { switchView } from './navigation.js';
import { examIdToSubjectId } from './exam-simulator.js';
import { checkShortAnswer } from './trainer.js';
import { updateGlobalStats } from './dashboard.js';

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
    const shuffled = [...subjData.quizzes].sort(() => 0.5 - Math.random());
    
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
    
    state.quiz.data = weakList.sort(() => 0.5 - Math.random()).slice(0, 10);
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
    const selectedCards = allCards.sort(() => 0.5 - Math.random()).slice(0, 3);
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
    const selectedQuizzes = allQuizzes.sort(() => 0.5 - Math.random()).slice(0, 3);
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
