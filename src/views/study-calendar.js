// src/views/study-calendar.js — 학습 캘린더/목표 뷰
import { getStudyCalendar, getStudyGoals, setStudyGoals, getTodayGoalProgress, getWeeklyGoalProgress, getMonthlyStudyDays, isStudiedOn, getTodayStr } from '../study-tracker.js';
import { showToast } from '../ui-utils.js';
import { STORAGE_KEYS } from '../storage-keys.js';
import { safeGetItem } from '../state.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

let _currentYear = new Date().getFullYear();
let _currentMonth = new Date().getMonth();

/**
 * 학습 캘린더 뷰 렌더링
 */
export function renderStudyCalendar() {
    const container = document.getElementById('study-calendar-content');
    if (!container) return;

    const today = getTodayStr();
    const todayProgress = getTodayGoalProgress();
    const weeklyProgress = getWeeklyGoalProgress();
    const monthlyDays = getMonthlyStudyDays(_currentYear, _currentMonth);

    container.innerHTML = `
        <div class="study-calendar-wrapper">
            <!-- 오늘/이번 주 목표 달성률 -->
            <div class="study-goals-summary">
                <div class="goal-card">
                    <div class="goal-card-header">
                        <i class="fa-solid fa-bullseye" aria-hidden="true"></i>
                        <span>오늘 목표</span>
                    </div>
                    <div class="goal-progress-ring" data-percent="${todayProgress.overallPercent}">
                        <span class="goal-percent">${todayProgress.overallPercent}%</span>
                    </div>
                    <div class="goal-detail">
                        <div class="goal-detail-row">
                            <span>카드</span>
                            <strong>${todayProgress.cardsDone} / ${todayProgress.cardsGoal}</strong>
                        </div>
                        <div class="goal-detail-row">
                            <span>퀴즈</span>
                            <strong>${todayProgress.quizzesDone} / ${todayProgress.quizzesGoal}</strong>
                        </div>
                    </div>
                </div>
                <div class="goal-card">
                    <div class="goal-card-header">
                        <i class="fa-solid fa-calendar-week" aria-hidden="true"></i>
                        <span>이번 주 목표</span>
                    </div>
                    <div class="goal-progress-ring" data-percent="${weeklyProgress.percent}">
                        <span class="goal-percent">${weeklyProgress.percent}%</span>
                    </div>
                    <div class="goal-detail">
                        <div class="goal-detail-row">
                            <span>학습 일수</span>
                            <strong>${weeklyProgress.studyDays} / ${weeklyProgress.goalDays}일</strong>
                        </div>
                    </div>
                </div>
                <div class="goal-card">
                    <div class="goal-card-header">
                        <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
                        <span>이번 달</span>
                    </div>
                    <div class="goal-progress-ring" data-percent="${Math.min(100, Math.round(monthlyDays / 30 * 100))}">
                        <span class="goal-percent">${monthlyDays}일</span>
                    </div>
                    <div class="goal-detail">
                        <div class="goal-detail-row">
                            <span>연속 학습</span>
                            <strong>${safeGetItem(STORAGE_KEYS.STUDY_STREAK) || 0}일</strong>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 목표 설정 버튼 -->
            <div class="goal-settings-row">
                <button class="btn btn-secondary btn-sm" data-click="openGoalSettings">
                    <i class="fa-solid fa-sliders" aria-hidden="true"></i> 목표 설정
                </button>
            </div>

            <!-- 월별 캘린더 -->
            <div class="calendar-nav">
                <button class="btn btn-secondary btn-sm" data-click="prevCalendarMonth">
                    <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                </button>
                <h3 class="calendar-title">${_currentYear}년 ${MONTH_NAMES[_currentMonth]}</h3>
                <button class="btn btn-secondary btn-sm" data-click="nextCalendarMonth">
                    <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
            </div>

            <div class="calendar-grid">
                ${WEEKDAYS.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
                ${_renderCalendarDays()}
            </div>

            <!-- 범례 -->
            <div class="calendar-legend">
                <div class="legend-item">
                    <span class="legend-dot legend-studied"></span> 학습함
                </div>
                <div class="legend-item">
                    <span class="legend-dot legend-today"></span> 오늘
                </div>
                <div class="legend-item">
                    <span class="legend-dot legend-empty"></span> 미학습
                </div>
            </div>
        </div>
    `;
}

function _renderCalendarDays() {
    const firstDay = new Date(_currentYear, _currentMonth, 1).getDay();
    const daysInMonth = new Date(_currentYear, _currentMonth + 1, 0).getDate();
    const today = getTodayStr();
    const cal = getStudyCalendar();
    let html = '';

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    // 날짜
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${_currentYear}-${String(_currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const entry = cal[dateStr] || {};
        const studied = (entry.cards > 0 || entry.quizzes > 0);
        const isToday = dateStr === today;
        const classes = ['calendar-day'];
        if (studied) classes.push('studied');
        if (isToday) classes.push('today');

        const tooltip = studied
            ? `카드 ${entry.cards || 0} · 퀴즈 ${entry.quizzes || 0} · 정답 ${entry.correct || 0}`
            : '';

        html += `
            <div class="${classes.join(' ')}" title="${tooltip}">
                <span class="day-num">${d}</span>
                ${studied ? '<i class="fa-solid fa-check stamp" aria-hidden="true"></i>' : ''}
            </div>
        `;
    }

    return html;
}

/**
 * 이전 달
 */
export function prevCalendarMonth() {
    _currentMonth--;
    if (_currentMonth < 0) { _currentMonth = 11; _currentYear--; }
    renderStudyCalendar();
}

/**
 * 다음 달
 */
export function nextCalendarMonth() {
    _currentMonth++;
    if (_currentMonth > 11) { _currentMonth = 0; _currentYear++; }
    renderStudyCalendar();
}

/**
 * 목표 설정 모달
 */
export function openGoalSettings() {
    const goals = getStudyGoals();
    const oldModal = document.getElementById('goal-settings-modal');
    if (oldModal) oldModal.remove();

    const modalHTML = `
        <div id="goal-settings-modal" class="modal-overlay" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(11,15,25,0.85);backdrop-filter:blur(10px);">
            <div class="glass-card" style="width:90%;max-width:480px;padding:2rem;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <h3 style="font-weight:700;color:var(--color-primary);margin:0;">
                        <i class="fa-solid fa-bullseye" aria-hidden="true"></i> 학습 목표 설정
                    </h3>
                    <button class="btn btn-secondary btn-sm" data-click="closeGoalSettings">
                        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>
                <div style="display:flex;flex-direction:column;gap:1.25rem;">
                    <div>
                        <label style="display:block;margin-bottom:0.5rem;font-weight:600;">일일 카드 목표 (장)</label>
                        <input type="number" id="goal-daily-cards" class="form-input" value="${goals.dailyCards}" min="1" max="500" style="width:100%;height:48px;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:0.5rem;font-weight:600;">일일 퀴즈 목표 (문제)</label>
                        <input type="number" id="goal-daily-quizzes" class="form-input" value="${goals.dailyQuizzes}" min="1" max="200" style="width:100%;height:48px;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:0.5rem;font-weight:600;">주간 학습 일수 (일)</label>
                        <input type="number" id="goal-weekly-days" class="form-input" value="${goals.weeklyStudyDays}" min="1" max="7" style="width:100%;height:48px;">
                    </div>
                </div>
                <div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
                    <button class="btn btn-secondary" style="flex:1;" data-click="closeGoalSettings">취소</button>
                    <button class="btn btn-primary" style="flex:1;" data-click="saveGoalSettings">저장</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

export function closeGoalSettings() {
    const modal = document.getElementById('goal-settings-modal');
    if (modal) modal.remove();
}

export function saveGoalSettings() {
    const cards = parseInt(document.getElementById('goal-daily-cards')?.value) || 50;
    const quizzes = parseInt(document.getElementById('goal-daily-quizzes')?.value) || 10;
    const weeklyDays = parseInt(document.getElementById('goal-weekly-days')?.value) || 5;
    setStudyGoals({ dailyCards: cards, dailyQuizzes: quizzes, weeklyStudyDays: weeklyDays });
    closeGoalSettings();
    showToast('학습 목표가 저장되었습니다.', 'success');
    renderStudyCalendar();
}
