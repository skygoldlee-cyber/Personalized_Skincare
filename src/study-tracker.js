// src/study-tracker.js — 학습 캘린더/목표 추적 헬퍼
// 학습 활동을 날짜별로 기록하고, 목표 달성률을 계산합니다.
import { safeGetItem, safeSetItem } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';

/* =======================================================
   📅 학습 캘린더 (날짜별 학습 기록)
   ======================================================= */

/**
 * 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
export function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 학습 캘린더 전체 데이터 조회
 * @returns {Object} { "2026-09-12": { cards: 5, quizzes: 3, correct: 2 }, ... }
 */
export function getStudyCalendar() {
    try {
        return JSON.parse(safeGetItem(STORAGE_KEYS.STUDY_CALENDAR) || '{}');
    } catch (e) {
        return {};
    }
}

/**
 * 오늘 학습 활동 기록 (누적)
 * @param {Object} activity - { cards: 증가할 카드 수, quizzes: 증가할 퀴즈 수, correct: 정답 수 }
 */
export function recordStudyActivity(activity = {}) {
    const today = getTodayStr();
    const cal = getStudyCalendar();
    const entry = cal[today] || { cards: 0, quizzes: 0, correct: 0 };
    if (activity.cards) entry.cards += activity.cards;
    if (activity.quizzes) entry.quizzes += activity.quizzes;
    if (activity.correct) entry.correct += activity.correct;
    cal[today] = entry;
    safeSetItem(STORAGE_KEYS.STUDY_CALENDAR, JSON.stringify(cal));
}

/**
 * 특정 날짜의 학습 여부 확인
 */
export function isStudiedOn(dateStr) {
    const cal = getStudyCalendar();
    const entry = cal[dateStr];
    return !!(entry && (entry.cards > 0 || entry.quizzes > 0));
}

/**
 * 이번 달 학습 일수
 */
export function getMonthlyStudyDays(year, month) {
    const cal = getStudyCalendar();
    let count = 0;
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    Object.keys(cal).forEach(date => {
        if (date.startsWith(prefix)) {
            const e = cal[date];
            if (e.cards > 0 || e.quizzes > 0) count++;
        }
    });
    return count;
}

/**
 * 최근 N일 학습 기록 (오늘 기준)
 * @returns {Array} [{ date: "2026-09-12", cards: 5, quizzes: 3, correct: 2 }, ...]
 */
export function getRecentStudyDays(n = 30) {
    const cal = getStudyCalendar();
    const result = [];
    const today = new Date();
    for (let i = 0; i < n; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const entry = cal[dateStr] || { cards: 0, quizzes: 0, correct: 0 };
        result.push({ date: dateStr, ...entry });
    }
    return result.reverse();
}

/* =======================================================
   🎯 학습 목표 (일일/주간)
   ======================================================= */

const DEFAULT_GOALS = {
    dailyCards: 50,
    dailyQuizzes: 10,
    weeklyStudyDays: 5
};

/**
 * 학습 목표 조회
 */
export function getStudyGoals() {
    try {
        const stored = JSON.parse(safeGetItem(STORAGE_KEYS.STUDY_GOALS) || '{}');
        return { ...DEFAULT_GOALS, ...stored };
    } catch (e) {
        return { ...DEFAULT_GOALS };
    }
}

/**
 * 학습 목표 저장
 */
export function setStudyGoals(goals) {
    const current = getStudyGoals();
    const merged = { ...current, ...goals };
    safeSetItem(STORAGE_KEYS.STUDY_GOALS, JSON.stringify(merged));
    return merged;
}

/**
 * 오늘 목표 달성률 계산
 * @returns {Object} { cardsDone, cardsGoal, quizzesDone, quizzesGoal, overallPercent }
 */
export function getTodayGoalProgress() {
    const goals = getStudyGoals();
    const today = getTodayStr();
    const cal = getStudyCalendar();
    const entry = cal[today] || { cards: 0, quizzes: 0, correct: 0 };
    const cardsDone = entry.cards || 0;
    const quizzesDone = entry.quizzes || 0;
    const cardsPercent = goals.dailyCards > 0 ? Math.min(100, Math.round((cardsDone / goals.dailyCards) * 100)) : 0;
    const quizzesPercent = goals.dailyQuizzes > 0 ? Math.min(100, Math.round((quizzesDone / goals.dailyQuizzes) * 100)) : 0;
    const overallPercent = Math.round((cardsPercent + quizzesPercent) / 2);
    return {
        cardsDone,
        cardsGoal: goals.dailyCards,
        quizzesDone,
        quizzesGoal: goals.dailyQuizzes,
        cardsPercent,
        quizzesPercent,
        overallPercent
    };
}

/**
 * 이번 주 목표 달성률 계산 (학습 일수)
 */
export function getWeeklyGoalProgress() {
    const goals = getStudyGoals();
    const cal = getStudyCalendar();
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일, 1=월, ...
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    let studyDays = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        if (d > today) break;
        const dateStr = d.toISOString().split('T')[0];
        if (isStudiedOn(dateStr)) studyDays++;
    }
    const percent = goals.weeklyStudyDays > 0 ? Math.min(100, Math.round((studyDays / goals.weeklyStudyDays) * 100)) : 0;
    return {
        studyDays,
        goalDays: goals.weeklyStudyDays,
        percent
    };
}
