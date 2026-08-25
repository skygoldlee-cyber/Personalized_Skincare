// src/views/dashboard.js - 대시보드 뷰 로직 및 전역 통계 관리
import { state, saveProgress } from '../state.js';
import { esc } from '../sanitize.js';
import { DataLoader } from '../data-loader.js';
import { renderPerformanceChart, renderPassFailDiagnosis, renderRadarChart } from '../charts.js';
import { switchView } from './navigation.js';
import { updateStreakAndDailyUI } from './quiz.js';
import { updatePomodoroUI } from './trainer.js';

/**
 * @type {boolean}
 */
let _dashboardStatsRefreshed = false;

/**
 * 전역 학습 통계 데이터를 집계하고 UI 요소를 업데이트합니다.
 */
export function updateGlobalStats() {
    // 1. 전체 카드 통계
    let totalCards = 0;
    if (typeof DataLoader !== 'undefined' && DataLoader.registry) {
        DataLoader.getSubjectList().forEach(subj => {
            totalCards += (subj.stats && subj.stats.cards) || 0;
        });
    } else if (typeof window.STUDY_DATA !== 'undefined' && window.STUDY_DATA) {
        Object.keys(window.STUDY_DATA).forEach(subj => {
            totalCards += window.STUDY_DATA[subj].cards.length;
        });
    }
    
    const totalCardsEl = document.getElementById('total-cards-count');
    const memorizedCardsEl = document.getElementById('memorized-cards-count');
    const weakCardsEl = document.getElementById('weak-cards-count');
    const reviewCardEl = document.getElementById('review-card-count');
    const totalProgressValEl = document.getElementById('total-progress-val');
    const totalProgressBarEl = document.getElementById('total-progress-bar');
    const solvedQuizzesEl = document.getElementById('solved-quizzes-count');
    const successRateEl = document.getElementById('quiz-success-rate');

    if (totalCardsEl) totalCardsEl.textContent = totalCards;
    if (memorizedCardsEl) memorizedCardsEl.textContent = state.memorizedCards.size;
    if (weakCardsEl) weakCardsEl.textContent = state.weakCards.size;
    if (reviewCardEl) reviewCardEl.textContent = state.weakCards.size;
    
    // 전체 진척도 퍼센트 계산
    const totalProgress = totalCards > 0 ? Math.round((state.memorizedCards.size / totalCards) * 100) : 0;
    if (totalProgressValEl) totalProgressValEl.textContent = `${totalProgress}%`;
    if (totalProgressBarEl) totalProgressBarEl.style.width = `${totalProgress}%`;
    
    // 2. 퀴즈 통계
    const quizKeys = Object.keys(state.quizResults);
    const solvedCount = quizKeys.length;
    const correctCount = quizKeys.filter(k => state.quizResults[k].correct).length;
    const successRate = solvedCount > 0 ? Math.round((correctCount / solvedCount) * 100) : 0;
    
    if (solvedQuizzesEl) solvedQuizzesEl.textContent = solvedCount;
    if (successRateEl) successRateEl.textContent = `${successRate}%`;
}

/**
 * 백그라운드에서 과목 데이터를 로드해 상세 통계를 갱신합니다.
 */
export function refreshDashboardStatsInBackground() {
    if (_dashboardStatsRefreshed) return;
    if (typeof DataLoader === 'undefined' || !DataLoader.registry) return;
    _dashboardStatsRefreshed = true;
    const loads = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key).catch(() => null));
    Promise.all(loads).then(() => {
        updateGlobalStats();
        if (state.currentView === 'dashboard-view') renderDashboard();
    });
}

/**
 * 대시보드 화면을 렌더링하고 차트 및 진단을 활성화합니다.
 */
export function renderDashboard() {
    const container = document.getElementById('subject-cards-container');
    if (!container) return;
    container.innerHTML = '';
    
    const subjects = (typeof DataLoader !== 'undefined' && DataLoader.registry)
        ? DataLoader.getSubjectList()
        : Object.keys(window.STUDY_DATA || {}).map(key => ({ key, name: window.STUDY_DATA[key].name, stats: { cards: window.STUDY_DATA[key].cards.length, quizzes: window.STUDY_DATA[key].quizzes.length } }));
    
    subjects.forEach(subjMeta => {
        const subjId = subjMeta.key;
        const totalSubjCards = (subjMeta.stats && subjMeta.stats.cards) || 0;
        const totalSubjQuizzes = (subjMeta.stats && subjMeta.stats.quizzes) || 0;
        
        // 과목별 완료된 카드 수 (ID prefix 기반)
        const memorizedSubjCards = [...state.memorizedCards].filter(id => id.startsWith(subjId + '_card_')).length;
        const progressPercent = totalSubjCards > 0 ? Math.round((memorizedSubjCards / totalSubjCards) * 100) : 0;
        
        // 과목별 퀴즈 정답률 (ID prefix 기반)
        const solvedSubjQuizzes = Object.keys(state.quizResults).filter(id => id.startsWith(subjId + '_quiz_'));
        const correctSubjQuizzes = solvedSubjQuizzes.filter(id => state.quizResults[id].correct);
        const quizRate = solvedSubjQuizzes.length > 0 ? Math.round((correctSubjQuizzes.length / solvedSubjQuizzes.length) * 100) : 0;
        
        const cardHTML = `
            <div class="subject-card">
                <div class="subj-header">
                    <h4>${esc(subjMeta.name)}</h4>
                    <span>카드 ${totalSubjCards}개 / 퀴즈 ${totalSubjQuizzes}개</span>
                </div>
                <div class="subj-stats-summary">
                    <div class="subj-stat-item">
                        <span>암기 카드</span>
                        <strong>${memorizedSubjCards} / ${totalSubjCards}</strong>
                    </div>
                    <div class="subj-stat-item">
                        <span>퀴즈 정답률</span>
                        <strong>${solvedSubjQuizzes.length > 0 ? quizRate + '%' : '-'}</strong>
                    </div>
                </div>
                <div class="subj-progress-group">
                    <div class="subj-progress-label">
                        <span>학습 진도율</span>
                        <span>${progressPercent}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
                <div class="subj-actions">
                    <button class="btn btn-secondary" onclick="startSubjectStudy('${subjId}')">
                        <i class="fa-solid fa-layer-group"></i> 카드 학습
                     </button>
                    <button class="btn btn-primary" onclick="startSubjectQuiz('${subjId}')">
                        <i class="fa-solid fa-play"></i> 퀴즈 풀기
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
    
    renderPerformanceChart();
    renderPassFailDiagnosis();
    renderRadarChart();
    updateStreakAndDailyUI();
    updatePomodoroUI();
}

/**
 * 특정 과목의 카드 학습을 시작합니다.
 * @param {string} subjId 
 */
export function startSubjectStudy(subjId) {
    state.flashcards.subject = subjId;
    state.flashcards.currentIndex = 0;
    const select = document.getElementById('fc-subject-select');
    if (select) select.value = subjId;
    switchView('flashcard-view');
}

/**
 * 특정 과목의 퀴즈 풀기를 시작합니다.
 * @param {string} subjId 
 */
export function startSubjectQuiz(subjId) {
    state.quiz.subject = subjId;
    const select = document.getElementById('quiz-subject-select');
    if (select) select.value = subjId;
    switchView('quiz-view');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    if (startQuizBtn) startQuizBtn.click();
}
