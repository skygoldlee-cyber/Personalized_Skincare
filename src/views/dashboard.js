// src/views/dashboard.js - 대시보드 뷰 로직 및 전역 통계 관리
// @spec D-01~16,AN-01~04,PF-07,SC-04
import { state } from '../state.js';
import { esc } from '../sanitize.js';
import { DataLoader } from '../data-loader.js';
import { renderPerformanceChart, renderPassFailDiagnosis, renderRadarChart } from '../charts.js';
import { switchView } from './navigation.js';
import { updateStreakAndDailyUI } from './daily-challenge.js';
import { updatePomodoroUI } from './pomodoro.js';
import { getDueCount } from '../spaced-repetition.js';
import {
    computeRecommendations, estimateExpectedScore, getActualResult,
    saveActualResult, clearActualResult, getSimHistory,
    computeWrongCauseSummary, WRONG_CAUSE_LABELS
} from '../recommendations.js';
import { getDDay, getSuggestedDailyCount, getTodayGoalProgress, getWeeklyGoalProgress, getStudyCalendar } from '../study-tracker.js';
import { getWeakStatements, getDueStatementSids, getAnomalousStatements, getAllStatementStats } from '../statement-tracker.js';
import {
    computeSubjectWeakChapters, computeWeeklyGrowth, computePassGap,
    computeWeakConceptClusters, computePaceProjection, estimateUntaggedCauses,
    computeMasteryLevels
} from '../analysis-engine.js';
import { resolveWrongQuiz } from '../weak-items.js';
import { showToast, showGlobalLoading, hideGlobalLoading } from '../ui-utils.js';
import { getExamRules } from '../exam-context.js';

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
/** 문제은행 출제 비중 목표치(targetCards/targetQuizzes)가 있으면 표시 수치를 상한 적용 */
function _displayCounts(subjMeta) {
    const stats = (subjMeta && subjMeta.stats) || {};
    const cards = (stats.targetCards > 0) ? Math.min(stats.cards || 0, stats.targetCards) : (stats.cards || 0);
    const quizzes = (stats.targetQuizzes > 0) ? Math.min(stats.quizzes || 0, stats.targetQuizzes) : (stats.quizzes || 0);
    return { cards, quizzes };
}

export function updateGlobalStats() {
    // 1. 전체 카드 통계
    let totalCards = 0;
    if (typeof DataLoader !== 'undefined' && DataLoader.registry) {
        DataLoader.getSubjectList().forEach(subj => {
            totalCards += _displayCounts(subj).cards;
        });
    } else if (typeof window.STUDY_DATA !== 'undefined' && window.STUDY_DATA) {
        const sd = window.STUDY_DATA;
        Object.keys(sd).forEach(subj => {
            totalCards += sd[subj].cards.length;
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

    if (totalCardsEl) totalCardsEl.textContent = String(totalCards);
    if (memorizedCardsEl) memorizedCardsEl.textContent = String(state.memorizedCards.size);
    if (weakCardsEl) weakCardsEl.textContent = String(state.weakCards.size);
    if (reviewCardEl) reviewCardEl.textContent = String(state.weakCards.size);

    // 2. 간격 반복 — 오늘 복습 대기 카드 수 + 대기 중일 때 '지금 복습' CTA
    const dueCount = getDueCount();
    const dueReviewEl = document.getElementById('due-review-count');
    if (dueReviewEl) dueReviewEl.textContent = String(dueCount);
    document.getElementById('due-review-cta')?.classList.toggle('is-hidden', dueCount === 0);

    // 2-b. 시험일 D-day + 역산 권장량 표시
    const ddayEl = document.getElementById('exam-dday-count');
    if (ddayEl) {
        const dday = getDDay();
        if (dday === null) {
            ddayEl.textContent = '미설정';
        } else if (dday < 0) {
            ddayEl.textContent = `D+${-dday}`;
        } else {
            ddayEl.textContent = dday === 0 ? 'D-Day' : `D-${dday}`;
        }
        const descEl = ddayEl.closest('.stat-info')?.querySelector('.stat-desc');
        if (descEl) {
            const remaining = Math.max(0, totalCards - state.memorizedCards.size);
            const suggested = getSuggestedDailyCount(remaining);
            descEl.innerHTML = suggested !== null
                ? `역산 권장: 하루 카드 ${suggested}장 · <button type="button" class="dday-set-btn" data-click="openGoalSettings"><i class="fa-solid fa-gear"></i> 설정</button>`
                : `<button type="button" class="dday-set-btn" data-click="openGoalSettings"><i class="fa-solid fa-gear"></i> 시험일·목표 설정</button>`;
        }
    }

    // 전체 진척도 퍼센트 계산
    const totalProgress = totalCards > 0 ? Math.round((state.memorizedCards.size / totalCards) * 100) : 0;
    if (totalProgressValEl) totalProgressValEl.textContent = `${totalProgress}%`;
    if (totalProgressBarEl) totalProgressBarEl.style.width = `${totalProgress}%`;

    // 2. 퀴즈 통계
    const quizKeys = Object.keys(state.quizResults);
    const solvedCount = quizKeys.length;
    const correctCount = quizKeys.filter(k => state.quizResults[k].correct).length;
    const successRate = solvedCount > 0 ? Math.round((correctCount / solvedCount) * 100) : 0;

    if (solvedQuizzesEl) solvedQuizzesEl.textContent = String(solvedCount);
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
        if (state.currentView === 'analysis-view') _renderChapterWeakness();
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
        : Object.keys(window.STUDY_DATA || {}).map(key => { const d = (window.STUDY_DATA || {})[key]; return { key, name: d.name, stats: { cards: d.cards.length, quizzes: d.quizzes.length } }; });

    // D-16 과목별 마스터리 — 진술 졸업 비율을 카드 표시 전 한 번만 집계
    const masteryMap = computeMasteryLevels(getAllStatementStats());

    subjects.forEach(subjMeta => {
        const subjId = subjMeta.key;
        const disp = _displayCounts(subjMeta);
        const totalSubjCards = disp.cards;
        const totalSubjQuizzes = disp.quizzes;

        // 과목별 완료된 카드 수 (캐시된 카운트 맵 사용, 표시 목표치 상한)
        const subjCounts = _getSubjCounts();
        const sc = subjCounts[subjId] || { mem: 0, weak: 0, quizSolved: 0, quizCorrect: 0 };
        const memorizedSubjCards = Math.min(sc.mem, totalSubjCards);
        const progressPercent = totalSubjCards > 0 ? Math.min(100, Math.round((memorizedSubjCards / totalSubjCards) * 100)) : 0;

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
                    ${masteryMap[subjId] ? `
                    <div class="subj-stat-item">
                        <span>마스터리</span>
                        <strong>Lv.${masteryMap[subjId].level} <span style="font-size:0.75rem; color:var(--color-text-muted);">(졸업 ${masteryMap[subjId].graduated}/${masteryMap[subjId].total})</span></strong>
                    </div>` : ''}
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
    renderExpectedScore();
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
        vlow: _c('--color-danger-dark')
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

// 4. 약점 과목 자동 추천 — "오늘의 합격 전략" (recommendations.js 엔진)
function _renderWeakSubjectRecommendation(subjects) {
    const recEl = document.getElementById('weak-subject-recommendation');
    if (!recEl) return;

    const recs = computeRecommendations(subjects, _getSubjCounts());

    if (recs.length === 0) {
        recEl.innerHTML = '<p class="rec-empty">아직 충분한 학습 데이터가 없습니다. 퀴즈를 풀어보세요!</p>';
        return;
    }

    let html = '<div class="rec-list">';
    recs.forEach(rec => {
        const actions = rec.actions.map(a =>
            `<button class="btn btn-sm ${a.cls}" data-click="${a.click}" data-arg="${esc(a.arg)}"><i class="fa-solid ${a.icon}"></i> ${esc(a.label)}</button>`
        ).join('');
        html += `
            <div class="rec-item">
                <i class="fa-solid ${rec.icon}" style="color:${rec.color};"></i>
                <span class="rec-text"><strong>${esc(rec.title)}</strong><span class="rec-reason">${esc(rec.reason)}</span></span>
                <div class="rec-actions">${actions}</div>
            </div>
        `;
    });
    html += '</div>';
    recEl.innerHTML = html;
}

/* =======================================================
   🎯 맞춤학습 뷰 — 개인화 학습 허브
   과목 카드·히트맵·모의고사 차트의 DOM 요소는 이 뷰에 있다
   (renderDashboard가 ID 기준으로 채우므로 그대로 재사용).
   ======================================================= */

/**
 * 맞춤학습 뷰 렌더링 — renderDashboard()가 과목 카드·히트맵·차트를
 * 채운 뒤, 이 뷰 전용 진단 요약 카드 3종을 추가로 렌더링한다.
 */
export function renderAnalysisView() {
    renderDashboard();
    _renderAnalysisOnboarding();
    _renderWrongCauseInsight();
    _renderWeakStatementInsight();
    _renderStudyRhythmInsight();
    _renderChapterWeakness();
    _renderPassGapInsight();
}

/**
 * 진단 온보딩 — 데이터가 최소 표본에 못 미칠 때 진행률 카드를 최상단에 표시.
 * 의미 있는 진단에는 최소 퀴즈 10문 또는 모의고사 1회가 필요하다.
 * 표본이 충분해지면 카드는 자동으로 사라진다.
 */
const ANALYSIS_MIN_QUIZ = 10;
const ANALYSIS_MIN_SIM = 1;
function _renderAnalysisOnboarding() {
    const grid = document.querySelector('#analysis-view .analysis-insight-grid');
    if (!grid) return;
    let hint = document.getElementById('analysis-onboarding-hint');
    const counts = _getSubjCounts();
    const quizSolved = Object.values(counts).reduce((s, c) => s + (c ? c.quizSolved || 0 : 0), 0);
    const simDone = getSimHistory().length;
    const ready = quizSolved >= ANALYSIS_MIN_QUIZ || simDone >= ANALYSIS_MIN_SIM;
    if (ready) {
        if (hint) hint.remove();
        return;
    }
    const quizPct = Math.min(100, Math.round((quizSolved / ANALYSIS_MIN_QUIZ) * 100));
    const simPct = Math.min(100, Math.round((simDone / ANALYSIS_MIN_SIM) * 100));
    const meter = (label, cur, min, pct) =>
        `<div class="wc-subrow"><span>${label}</span><strong>${cur}/${min}</strong></div>
         <div class="analysis-meter"><div class="analysis-meter-fill" style="width:${pct}%"></div></div>`;
    const html = `<h4>🌱 진단 준비 중</h4>
        <p class="analysis-empty">맞춤학습은 푼 문제가 쌓일수록 정확해집니다 — 아래 중 하나만 채우면 진단이 시작됩니다.</p>
        ${meter(`퀴즈 풀이 (최소 ${ANALYSIS_MIN_QUIZ}문)`, quizSolved, ANALYSIS_MIN_QUIZ, quizPct)}
        ${meter(`모의고사 (최소 ${ANALYSIS_MIN_SIM}회)`, simDone, ANALYSIS_MIN_SIM, simPct)}
        <button class="btn btn-primary btn-sm analysis-card-btn" data-click="startSubjectQuiz"><i class="fa-solid fa-play" aria-hidden="true"></i> 지금 퀴즈 풀기</button>
        <button class="btn btn-secondary btn-sm analysis-card-btn" data-click="startIntegratedMockExam"><i class="fa-solid fa-clock" aria-hidden="true"></i> 모의고사 시작</button>`;
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'analysis-onboarding-hint';
        hint.className = 'analytics-card';
        grid.prepend(hint);
    }
    hint.innerHTML = html;
}

/** 오답 패턴 분석 카드 — 최근 7일 원인 분포 + 권장 학습법 */
function _renderWrongCauseInsight() {
    const el = document.getElementById('analysis-wrong-cause');
    if (!el) return;
    const sum = computeWrongCauseSummary(state.wrongCauses);
    const goBtn = `<button class="btn btn-secondary btn-sm analysis-card-btn" data-click="switchView" data-arg="review-view"><i class="fa-solid fa-star" aria-hidden="true"></i> 오답 복습으로</button>`;
    if (sum.total === 0) {
        el.innerHTML = `<h4>🧩 오답 패턴 분석</h4>
            <p class="analysis-empty">오답 복습에서 "틀린 이유"를 태그하면 최근 7일의 실수 패턴을 분석합니다.</p>${goBtn}`;
        return;
    }
    const rows = Object.entries(WRONG_CAUSE_LABELS)
        .map(([k, label]) => `<div class="wc-row"><span>${label}</span><strong>${sum.counts[k] || 0}건</strong></div>`).join('');

    // 미태깅 오답 자동 추정 (태깅 데이터가 희소할 때 보완)
    const est = estimateUntaggedCauses({
        quizResults: state.quizResults,
        wrongCauses: state.wrongCauses,
        resolveQuiz: resolveWrongQuiz
    });
    const estRows = est.estimated > 0
        ? `<p class="analysis-advice">추정 (미태깅 오답 ${est.estimated}건): 암기 부족 ${est.counts.memorize} · 개념 오해 ${est.counts.concept} · 계산 ${est.counts.calc}</p>`
        : '';

    el.innerHTML = `<h4>🧩 오답 패턴 분석 <span class="analysis-meta">최근 7일 · ${sum.total}건</span></h4>
        ${rows}
        <p class="analysis-advice">${esc(sum.advice)}</p>${estRows}${goBtn}`;
}

/** 취약 진술 카드 — 반복 오판 진술 수 + 오늘 복습 대기 + 리뷰 딥링크 */
function _renderWeakStatementInsight() {
    const el = document.getElementById('analysis-weak-statements');
    if (!el) return;
    const weak = getWeakStatements(5);
    const dueCount = getDueStatementSids().length;
    const anomalous = getAnomalousStatements();
    if (weak.length === 0) {
        el.innerHTML = `<h4>🎯 취약 진술 추적</h4>
            <p class="analysis-empty">O/X·ㄱㄴㄷ 조합 드릴을 풀면 반복 오판 진술을 추적해 보여줍니다.</p>
            <button class="btn btn-secondary btn-sm analysis-card-btn" data-click="switchView" data-arg="trainer-view"><i class="fa-solid fa-dumbbell" aria-hidden="true"></i> 훈련소로</button>`;
        return;
    }
    const qc = (DataLoader._questionChapters) || { questions: {}, ranges: {} };
    const rows = weak.slice(0, 3).map(w => {
        const label = w.t ? w.t : w.sid;
        const truthTag = w.truth === true ? ' <span class="analysis-truth">참</span>'
            : w.truth === false ? ' <span class="analysis-truth">거짓</span>' : '';
        return `<div class="wc-row"><span class="analysis-sid">${esc(label)}${truthTag}</span><strong>${w.w}회 오판</strong></div>`;
    }).join('');
    const clusters = computeWeakConceptClusters(getAllStatementStats(), qc.ranges);
    const clusterNote = clusters.length > 0
        ? `<p class="analysis-advice">🔗 같은 개념 구간에서 반복 오판: ${esc(clusters[0].chapter || clusters[0].cid)} (${clusters[0].count}개 진술)</p>` : '';
    const anomalousNote = anomalous.length > 0
        ? `<p class="analysis-advice">⚠️ 반복 오판 진술 ${anomalous.length}개 — 표현 검수가 필요할 수 있습니다.</p>` : '';
    el.innerHTML = `<h4>🎯 취약 진술 추적 <span class="analysis-meta">오늘 복습 대기 ${dueCount}개</span></h4>
        ${rows}${clusterNote}${anomalousNote}
        <button class="btn btn-secondary btn-sm analysis-card-btn" data-click="gotoWeakReview"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i> 취약 리뷰 열기</button>`;
}

/** 학습 리듬 카드 — 오늘 목표·주간 학습일·D-day 요약 + 캘린더 링크 */
function _renderStudyRhythmInsight() {
    const el = document.getElementById('analysis-study-rhythm');
    if (!el) return;
    const today = getTodayGoalProgress();
    const week = getWeeklyGoalProgress();
    const dday = getDDay();
    const ddayLabel = dday === null ? '미설정' : (dday < 0 ? `D+${-dday}` : (dday === 0 ? 'D-Day' : `D-${dday}`));

    // 주간 성장 — 최근 7일 vs 이전 7일
    const growth = computeWeeklyGrowth(getStudyCalendar());
    const growthRow = growth.thisWeek.rate !== null
        ? `<div class="wc-row"><span>주간 정답률</span><strong>${growth.thisWeek.rate}%${growth.rateDelta !== null ? ` <span class="growth-delta ${growth.rateDelta >= 0 ? 'growth-up' : 'growth-down'}">${growth.rateDelta >= 0 ? '▲' : '▼'}${Math.abs(growth.rateDelta)}%p</span>` : ''}</strong></div>`
        : '';

    // D-day 페이스 판정 — 현재 속도로 커버 가능한지
    const subjectsMeta = (typeof DataLoader !== 'undefined' && DataLoader.registry)
        ? DataLoader.getSubjectList() : [];
    const totalCards = subjectsMeta.reduce((s, m) => s + _displayCounts(m).cards, 0);
    const pace = computePaceProjection({
        calendar: getStudyCalendar(), totalCards,
        memorized: state.memorizedCards.size, dday
    });
    const paceNote = pace
        ? `<p class="analysis-advice">${pace.verdict === 'ahead'
            ? `✅ 현재 페이스면 시험일까지 전체 커버 가능합니다.`
            : pace.verdict === 'ontrack'
                ? `📈 현재 페이스(하루 ${pace.pacePerDay}장)로 약 ${pace.projectedCoverage}% 커버 예상 — 하루 ${pace.neededPerDay}장 목표로 조금만 더.`
                : `⚠️ 현재 페이스로는 ${pace.projectedCoverage}% 커버에 그칩니다 — 하루 ${pace.neededPerDay}장 필요합니다.`}</p>`
        : '';

    el.innerHTML = `<h4>📅 학습 리듬</h4>
        <div class="wc-row"><span>오늘 목표 달성</span><strong>${today.overallPercent}%</strong></div>
        <div class="wc-row"><span>이번 주 학습일</span><strong>${week.studyDays}/${week.goalDays}일</strong></div>
        <div class="wc-row"><span>시험일</span><strong>${ddayLabel}</strong></div>
        ${growthRow}${paceNote}
        <button class="btn btn-secondary btn-sm analysis-card-btn" data-click="switchView" data-arg="calendar-view"><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> 캘린더 보기</button>`;
}

/** 단원별 취약 분석 카드 — 과목별 그룹화 (과락이 과목 단위 평가이므로) */
function _renderChapterWeakness() {
    const el = document.getElementById('analysis-chapter-weak');
    if (!el) return;
    const qc = (DataLoader._questionChapters) || { questions: {}, ranges: {} };
    const subjectsMeta = (typeof DataLoader !== 'undefined' && DataLoader.registry)
        ? DataLoader.getSubjectList() : [];
    const nameOf = (key) => { const s = subjectsMeta.find(x => x.key === key); return s ? s.name : key; };
    const groups = computeSubjectWeakChapters({
        quizResults: state.quizResults,
        weakCards: state.weakCards,
        statementStats: getAllStatementStats(),
        questionChapters: qc.questions,
        chapterRanges: qc.ranges,
        resolveQuiz: resolveWrongQuiz,
        subjectName: nameOf,
        chaptersPerSubject: 2
    });
    if (groups.length === 0) {
        el.innerHTML = `<h4>📖 단원별 취약 분석</h4>
            <p class="analysis-empty">퀴즈·모의고사·드릴에서 오답이 쌓이면 과목별로 어떤 단원이 약한지 보여줍니다.</p>`;
        return;
    }
    const html = groups.slice(0, 4).map(g => {
        const chRows = g.chapters.map(c =>
            `<div class="wc-subrow" role="button" tabindex="0" style="cursor:pointer" title="교재에서 이 단원 보기" data-click="openSubjectSection" data-args='${esc(JSON.stringify([g.subjectKey, c.chapter]))}'><span class="analysis-sid">${esc(c.chapter)}</span><span>${c.wrongs}건 <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></div>`
        ).join('');
        return `<div class="wc-row wc-subj-row"><span>${esc(g.subject)}</span><strong>${g.totalWrongs}건</strong></div>${chRows}`;
    }).join('');
    el.innerHTML = `<h4>📖 단원별 취약 분석 <span class="analysis-meta">과목별 오답 집중 단원 — 클릭 시 해당 교재 단원으로 이동</span></h4>
        ${html}
        <p class="analysis-advice">과락은 과목 단위 평가 — 각 과목의 최약 단원부터 재학습하면 과락 방어에 효과적입니다.</p>`;
}

/** 합격 갭 분석 카드 — 합격선까지 점수 갭 + 최우선 보강 과목 */
function _renderPassGapInsight() {
    const el = document.getElementById('analysis-pass-gap');
    if (!el) return;
    const subjects = (typeof DataLoader !== 'undefined' && DataLoader.registry)
        ? DataLoader.getSubjectList() : [];
    const gap = computePassGap({
        estimate: estimateExpectedScore(getSimHistory()),
        simHistory: getSimHistory(),
        subjects,
        counts: _getSubjCounts(),
        rules: getExamRules()
    });
    if (!gap || (!gap.weakest && gap.gap === null)) {
        el.innerHTML = `<h4>🎓 합격 갭 분석</h4>
            <p class="analysis-empty">모의고사나 퀴즈를 풀면 합격선까지의 거리와 보강 우선순위를 진단합니다.</p>
            <button class="btn btn-secondary btn-sm analysis-card-btn" data-click="startIntegratedMockExam"><i class="fa-solid fa-clock" aria-hidden="true"></i> 모의고사 시작</button>`;
        return;
    }
    const gapRow = gap.gap !== null
        ? `<div class="wc-row"><span>합격선(평균 ${gap.passLine}점)까지</span><strong>${gap.gap === 0 ? '도달 ✅' : `+${gap.gap}점`}</strong></div>`
        : '';
    const weakRow = gap.weakest
        ? `<div class="wc-row"><span>최우선 보강</span><strong class="gap-weakest">${esc(gap.weakest.name)} ${gap.weakest.rate}%</strong></div>`
        : '';
    const weakBtn = gap.weakest
        ? `<button class="btn btn-primary btn-sm analysis-card-btn" data-click="startSubjectQuiz" data-arg="${esc(gap.weakest.key)}"><i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(gap.weakest.name)} 퀴즈</button>`
        : '';
    el.innerHTML = `<h4>🎓 합격 갭 분석</h4>
        ${gapRow}${weakRow}
        ${gap.weakest ? `<p class="analysis-advice">${esc(gap.weakest.reason)} — 이 과목이 점수 상승 여력이 가장 큽니다.</p>` : ''}
        ${weakBtn}`;
}

/**
 * 오늘 복습 대상(SM-2 due) 카드만 모아 전 과목 합산 플래시카드 세션을 시작합니다.
 * 대시보드 '오늘 복습' 카드의 '지금 복습' 버튼에서 호출.
 */
export function startDueReview() {
    const n = getDueCount();
    if (n === 0) {
        showToast('오늘 복습할 카드가 없습니다.', 'info');
        return;
    }
    showGlobalLoading('복습 대상 카드를 불러오는 중입니다...');
    Promise.all(DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key)))
        .catch(() => {})
        .finally(() => {
            hideGlobalLoading();
            state.flashcards.dueOnly = true;
            state.flashcards.currentIndex = 0;
            switchView('flashcard-view', { scrollTop: true });
            showToast(`오늘 복습 대상 ${n}장 — 간격 반복 세션을 시작합니다`, 'success');
        });
}

/**
 * 특정 과목의 카드 학습을 시작합니다.
 * @param {string} [subjId] 생략 시 활성 시험의 첫 과목
 */
export function startSubjectStudy(subjId) {
    if (!subjId) {
        const subs = DataLoader.getSubjectList();
        subjId = (subs[0] && subs[0].key) || '';
    }
    state.flashcards.subject = subjId;
    state.flashcards.currentIndex = 0;
    const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('fc-subject-select'));
    if (select) select.value = subjId;
    switchView('flashcard-view', { scrollTop: true });
}

/**
 * 특정 과목의 퀴즈 풀기를 시작합니다.
 * @param {string} subjId
 */
export function startSubjectQuiz(subjId) {
    if (!subjId) {
        const subs = DataLoader.getSubjectList();
        subjId = (subs[0] && subs[0].key) || '';
    }
    state.quiz.subject = subjId;
    const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('quiz-subject-select'));
    if (select) select.value = subjId;
    switchView('quiz-view', { scrollTop: true });
    const startQuizBtn = /** @type {HTMLElement|null} */ (document.getElementById('start-quiz-btn'));
    if (startQuizBtn) startQuizBtn.click();
}

/**
 * 특정 과목의 교재 읽기를 시작합니다. (약점 → 교재 딥링크)
 * @param {string} subjId
 */
export function startSubjectReader(subjId) {
    const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('reader-subject-select'));
    if (select) select.value = subjId;
    switchView('textbook-reader-view', { scrollTop: true });
}

// ===== C1 — 예상 점수 추정 + 실제 결과 자가 보고 =====
// 점수 "추정치"만 제시한다 — 보정된 합격 확률은 실제 결과 데이터 축적 후 가능.

const TREND_META = {
    up:   { icon: 'fa-arrow-trend-up',   label: '상승 추세', cls: 'est-up' },
    flat: { icon: 'fa-minus',            label: '보합',     cls: 'est-flat' },
    down: { icon: 'fa-arrow-trend-down', label: '하락 추세', cls: 'est-down' }
};

/** 예상 점수 대·추세·실제 결과 블록을 합격 진단 카드 하단에 렌더링한다 */
function renderExpectedScore() {
    const area = document.getElementById('prediction-estimate-area');
    if (!area) return;
    const history = getSimHistory();
    const est = estimateExpectedScore(history);
    const actual = getActualResult();
    const dday = getDDay();

    let html = '';
    if (est && est.n >= 2) {
        const t = TREND_META[est.trend];
        html += `
            <div class="estimate-row">
                <span class="estimate-label">예상 점수</span>
                <strong class="estimate-score">${est.lo}~${est.hi}점</strong>
                <span class="estimate-trend ${t.cls}">
                    <i class="fa-solid ${t.icon}" aria-hidden="true"></i> ${t.label}
                </span>
            </div>
            <div class="estimate-note">최근 모의고사 ${est.n}회 기준 (합격선 평균 ${getExamRules().passAverage}점) — 실제 합격 여부가 아닌 점수 추정치입니다.</div>`;
    }

    // 실제 결과: 기록됨 → 요약 표시 / 시험일 경과 → 입력 폼
    if (actual) {
        const delta = (actual.score !== null && est) ? actual.score - est.expected : null;
        html += `
            <div class="actual-result">
                <span class="actual-badge ${actual.passed ? 'actual-pass' : 'actual-fail'}">
                    ${actual.passed ? '합격' : '불합격'}</span>
                <span>${actual.score !== null ? esc(String(actual.score)) + '점' : '점수 미기입'}
                    ${delta !== null ? ` (예상 대비 ${delta >= 0 ? '+' : ''}${delta}점)` : ''}</span>
                <button type="button" class="btn btn-secondary actual-edit-btn"
                    data-click="editActualExamResult">수정</button>
            </div>`;
    } else if (dday !== null && dday <= 0) {
        html += `
            <div class="actual-form">
                <div class="actual-form-title">실제 시험 결과를 기록하면 예측 정확도가 개선됩니다</div>
                <div class="actual-form-row">
                    <select id="actual-passed-select" class="form-select">
                        <option value="pass">합격</option>
                        <option value="fail">불합격</option>
                    </select>
                    <input id="actual-score-input" type="number" class="form-select"
                        min="0" max="100" placeholder="점수(선택)" aria-label="실제 시험 점수">
                    <button type="button" class="btn btn-primary"
                        data-click="saveActualExamResult">기록</button>
                </div>
            </div>`;
    }
    area.innerHTML = html;
}

/** 실제 시험 결과 저장 (합격/불합격 + 선택 점수) */
export function saveActualExamResult() {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('actual-passed-select'));
    const inp = /** @type {HTMLInputElement|null} */ (document.getElementById('actual-score-input'));
    if (!sel || !inp) return;
    const raw = inp.value.trim();
    const score = raw === '' ? null : parseInt(raw, 10);
    if (score !== null && (isNaN(score) || score < 0 || score > 100)) {
        showToast('점수는 0~100 사이로 입력해주세요.', 'error');
        return;
    }
    saveActualResult(sel.value === 'pass', score);
    renderExpectedScore();
}

/** 기록된 실제 결과를 지우고 입력 폼으로 되돌린다 */
export function editActualExamResult() {
    clearActualResult();
    renderExpectedScore();
}
