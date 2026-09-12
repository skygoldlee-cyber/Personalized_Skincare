// src/views/dashboard.js - 대시보드 뷰 로직 및 전역 통계 관리
import { state, saveProgress } from '../state.js';
import { esc } from '../sanitize.js';
import { DataLoader } from '../data-loader.js';
import { renderPerformanceChart, renderPassFailDiagnosis, renderRadarChart } from '../charts.js';
import { switchView } from './navigation.js';
import { updateStreakAndDailyUI } from './daily-challenge.js';
import { updatePomodoroUI } from './pomodoro.js';
import { getDueCount } from '../spaced-repetition.js';

/**
 * @type {boolean}
 */
let _dashboardStatsRefreshed = false;

let _subjCountCache = null;
let _subjCountCacheKey = '';

function _getSubjCounts() {
    const memKey = state.memorizedCards.size + ':' + state.weakCards.size + ':' + Object.keys(state.quizResults).length;
    if (_subjCountCache && _subjCountCacheKey === memKey) return _subjCountCache;
    _subjCountCacheKey = memKey;
    const counts = {};
    state.memorizedCards.forEach(id => {
        const m = id.match(/^([a-z]+)_card_/);
        if (m) counts[m[1]] = counts[m[1]] || { mem: 0, weak: 0, quizSolved: 0, quizCorrect: 0 };
    });
    state.weakCards.forEach(id => {
        const m = id.match(/^([a-z]+)_card_/);
        if (m) { counts[m[1]] = counts[m[1]] || { mem: 0, weak: 0, quizSolved: 0, quizCorrect: 0 }; counts[m[1]].weak++; }
    });
    Object.keys(state.quizResults).forEach(id => {
        const m = id.match(/^([a-z]+)_quiz_/);
        if (m) {
            counts[m[1]] = counts[m[1]] || { mem: 0, weak: 0, quizSolved: 0, quizCorrect: 0 };
            counts[m[1]].quizSolved++;
            if (state.quizResults[id].correct) counts[m[1]].quizCorrect++;
        }
    });
    state.memorizedCards.forEach(id => {
        const m = id.match(/^([a-z]+)_card_/);
        if (m) counts[m[1]].mem++;
    });
    _subjCountCache = counts;
    return counts;
}

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
    
    // 2. 간격 반복 — 오늘 복습 대기 카드 수
    const dueReviewEl = document.getElementById('due-review-count');
    if (dueReviewEl) dueReviewEl.textContent = getDueCount();
    
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
        
        // 과목별 완료된 카드 수 (캐시된 카운트 맵 사용)
        const subjCounts = _getSubjCounts();
        const sc = subjCounts[subjId] || { mem: 0, weak: 0, quizSolved: 0, quizCorrect: 0 };
        const memorizedSubjCards = sc.mem;
        const progressPercent = totalSubjCards > 0 ? Math.round((memorizedSubjCards / totalSubjCards) * 100) : 0;
        
        // 과목별 퀴즈 정답률 (캐시된 카운트 맵 사용)
        const solvedSubjCount = sc.quizSolved;
        const correctSubjCount = sc.quizCorrect;
        const quizRate = solvedSubjCount > 0 ? Math.round((correctSubjCount / solvedSubjCount) * 100) : 0;
        
        // 과목별 헷갈린 카드 수
        const weakSubjCards = sc.weak;
        
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
                        <span>헷갈린 카드</span>
                        <strong style="${weakSubjCards > 0 ? 'color:var(--color-danger);' : ''}">${weakSubjCards}</strong>
                    </div>
                    <div class="subj-stat-item">
                        <span>퀴즈 정답률</span>
                        <strong>${solvedSubjCount > 0 ? quizRate + '%' : '-'}${solvedSubjCount > 0 ? ' <span style=\"font-size:0.75rem; color:var(--color-text-muted);\">(' + solvedSubjCount + '문)</span>' : ''}</strong>
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
                    <button class="btn btn-secondary" data-click="startSubjectStudy" data-arg="${subjId}">
                        <i class="fa-solid fa-layer-group"></i> 카드 학습
                     </button>
                    <button class="btn btn-primary" data-click="startSubjectQuiz" data-arg="${subjId}">
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
    
    // 4. 학습 통계/분석 강화 — 과목별 정답률 히트맵 + 약점 과목 추천
    _renderSubjectHeatmap(subjects);
    _renderWeakSubjectRecommendation(subjects);
}

// 4. 과목별 정답률 히트맵 렌더링
function _renderSubjectHeatmap(subjects) {
    const heatmapEl = document.getElementById('subject-heatmap');
    if (!heatmapEl) return;
    const subjCounts = _getSubjCounts();
    
    // 색상 (CSS 변수에서 읽기)
    const _style = getComputedStyle(document.documentElement);
    const _c = (v) => _style.getPropertyValue(v).trim();
    const colors = {
        none: _c('--color-text-muted'),
        high: _c('--color-success'),
        mid: _c('--color-warning'),
        low: _c('--color-danger'),
        vlow: _c('--color-danger-darkest')
    };

    let html = '<div class="heatmap-grid">';
    subjects.forEach(subj => {
        const sc = subjCounts[subj.key] || { mem: 0, weak: 0, quizSolved: 0, quizCorrect: 0 };
        const rate = sc.quizSolved > 0 ? Math.round((sc.quizCorrect / sc.quizSolved) * 100) : -1;
        let color, label;
        if (rate < 0) { color = colors.none; label = '미응시'; }
        else if (rate >= 80) { color = colors.high; label = rate + '%'; }
        else if (rate >= 60) { color = colors.mid; label = rate + '%'; }
        else if (rate >= 40) { color = colors.low; label = rate + '%'; }
        else { color = colors.vlow; label = rate + '%'; }
        
        html += `
            <div class="heatmap-cell" title="${esc(subj.name)}: ${rate < 0 ? '미응시' : rate + '% 정답률 (' + sc.quizSolved + '문)'}" style="background:${color};">
                <span class="heatmap-label">${esc(subj.name.substring(0, 6))}</span>
                <span class="heatmap-value">${label}</span>
            </div>
        `;
    });
    html += '</div>';
    heatmapEl.innerHTML = html;
}

// 4. 약점 과목 자동 추천
function _renderWeakSubjectRecommendation(subjects) {
    const recEl = document.getElementById('weak-subject-recommendation');
    if (!recEl) return;
    const subjCounts = _getSubjCounts();
    
    // 정답률이 가장 낮은 과목 (최소 3문 이상 푼 과목만)
    let weakest = null;
    let weakestRate = 101;
    subjects.forEach(subj => {
        const sc = subjCounts[subj.key] || { quizSolved: 0, quizCorrect: 0 };
        if (sc.quizSolved >= 3) {
            const rate = sc.quizCorrect / sc.quizSolved;
            if (rate < weakestRate) {
                weakestRate = rate;
                weakest = subj;
            }
        }
    });
    
    // 헷갈린 카드가 가장 많은 과목
    let mostWeak = null;
    let mostWeakCount = 0;
    subjects.forEach(subj => {
        const sc = subjCounts[subj.key] || { weak: 0 };
        if (sc.weak > mostWeakCount) {
            mostWeakCount = sc.weak;
            mostWeak = subj;
        }
    });
    
    if (!weakest && !mostWeak) {
        recEl.innerHTML = '<p class="rec-empty">아직 충분한 학습 데이터가 없습니다. 퀴즈를 풀어보세요!</p>';
        return;
    }
    
    let html = '<div class="rec-list">';
    if (weakest) {
        const rate = Math.round(weakestRate * 100);
        html += `
            <div class="rec-item">
                <i class="fa-solid fa-bullseye" style="color:var(--color-danger);"></i>
                <span>정답률 최저: <strong>${esc(weakest.name)}</strong> (${rate}%)</span>
                <button class="btn btn-sm btn-primary" data-click="startSubjectQuiz" data-arg="${weakest.key}">풀기</button>
            </div>
        `;
    }
    if (mostWeak && mostWeakCount > 0) {
        html += `
            <div class="rec-item">
                <i class="fa-solid fa-triangle-exclamation" style="color:var(--color-warning);"></i>
                <span>헷갈린 카드最多: <strong>${esc(mostWeak.name)}</strong> (${mostWeakCount}장)</span>
                <button class="btn btn-sm btn-secondary" data-click="startSubjectStudy" data-arg="${mostWeak.key}">학습</button>
            </div>
        `;
    }
    html += '</div>';
    recEl.innerHTML = html;
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
