// spaced-repetition.js — SM-2 알고리즘 기반 간격 반복 학습 시스템
//
// 각 카드의 복습 스케줄을 관리:
// - repetition: 연속 정답 횟수 (0부터 시작)
// - easiness: 난이도 인자 (1.3~2.5, 기본 2.5)
// - nextReview: 다음 복습 날짜 (ISO 날짜 문자열)
// - lastReview: 마지막 복습 날짜

import { safeGetItem, safeSetItem } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';

const SR_KEY = STORAGE_KEYS.FC_SPACED_REPETITION;

/**
 * SM-2 알고리즘 — 품질 점수(0-5)에 따라 다음 복습 간격 계산
 * @param {number} repetition - 현재 연속 정답 횟수
 * @param {number} easiness - 현재 난이도 인자
 * @param {number} quality - 품질 점수 (0=완전히 틀림, 5=완벽)
 * @returns {{interval: number, repetition: number, easiness: number}}
 */
function sm2(repetition, easiness, quality) {
    let newEF = easiness;
    let newRep = repetition;

    if (quality >= 3) {
        // 정답 — 간격 확장
        if (newRep === 0) {
            return { interval: 1, repetition: 1, easiness: newEF };
        } else if (newRep === 1) {
            return { interval: 3, repetition: 2, easiness: newEF };
        } else {
            const interval = Math.round(newEF * (newRep >= 2 ? _intervalForRep(newRep - 1, easiness) : 3));
            return { interval: Math.max(interval, 1), repetition: newRep + 1, easiness: newEF };
        }
    } else {
        // 오답 — 간격 리셋
        newRep = 0;
        newEF = Math.max(1.3, easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        return { interval: 1, repetition: 0, easiness: newEF };
    }
}

// 누적 간격 계산 (재귀 대신 반복문으로 구현)
function _intervalForRep(rep, easiness) {
    if (rep <= 0) return 1;
    if (rep === 1) return 3;
    let prev = 3;
    for (let i = 2; i <= rep; i++) {
        prev = Math.round(prev * easiness);
    }
    return Math.max(prev, 1);
}

/**
 * 카드의 복습 스케줄 업데이트
 * @param {string} cardId - 카드 ID
 * @param {boolean} knew - 외웠는지 여부 (true=쉬움, false=헷갈림)
 */
export function updateCardSchedule(cardId, knew) {
    const schedules = loadSchedules();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const current = schedules[cardId] || { repetition: 0, easiness: 2.5, nextReview: todayStr, lastReview: null };

    // 품질 점수: 외움=5, 헷갈림=2
    const quality = knew ? 5 : 2;

    const result = sm2(current.repetition, current.easiness, quality);

    // 다음 복습 날짜 계산
    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + result.interval);
    const nextReview = nextDate.toISOString().split('T')[0];

    schedules[cardId] = {
        repetition: result.repetition,
        easiness: result.easiness,
        nextReview: nextReview,
        lastReview: todayStr
    };

    saveSchedules(schedules);
    return schedules[cardId];
}

/**
 * 오늘 복습해야 할 카드 ID 목록 반환
 * @returns {string[]} 오늘 복습할 카드 ID 목록
 */
function getDueCards() {
    const schedules = loadSchedules();
    const todayStr = new Date().toISOString().split('T')[0];
    return Object.keys(schedules).filter(id => schedules[id].nextReview <= todayStr);
}

/**
 * 특정 카드의 복습 정보 반환
 * @param {string} cardId
 * @returns {{repetition: number, easiness: number, nextReview: string, lastReview: string|null}|null}
 */
function getCardSchedule(cardId) {
    const schedules = loadSchedules();
    return schedules[cardId] || null;
}

/**
 * 오늘 복습 대기 카드 수
 * @returns {number}
 */
export function getDueCount() {
    return getDueCards().length;
}

/**
 * 복습 스케줄 전체 로드
 * @returns {Object} { cardId: { repetition, easiness, nextReview, lastReview } }
 */
function loadSchedules() {
    try {
        const raw = safeGetItem(SR_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

/**
 * 복습 스케줄 전체 저장
 * @param {Object} schedules
 */
function saveSchedules(schedules) {
    safeSetItem(SR_KEY, JSON.stringify(schedules));
}

/**
 * 특정 카드의 복습 스케줄 삭제
 * @param {string} cardId
 */
function removeCardSchedule(cardId) {
    const schedules = loadSchedules();
    delete schedules[cardId];
    saveSchedules(schedules);
}

/**
 * 모든 복습 스케줄 초기화
 */
function clearAllSchedules() {
    saveSchedules({});
}
