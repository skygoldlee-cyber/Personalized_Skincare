// statement-tracker.js — 합답형/OX 진술 단위 오판 추적 (docs/dev/COMBO_STUDY_STRATEGY.md §4-②)
//
// gradeAnswer()의 perStatement 결과를 두 저장소로 연결한다:
// - fc_spaced_repetition: sid를 카드 ID로 사용해 SM-2 스케줄 갱신 (복습 시점 관리)
// - statement_stats: 진술별 판정 누적 통계 { sid: { j, w, lw, t, truth, cid, last } } (약점 리스트용)
//   t=진술 텍스트, truth=정답 O/X, cid=conceptId(개념 그룹), last=최근 판정 정오 — 취약 진술 리뷰 화면용 메타
//
// sid(진술 전역 안정 ID)가 없는 진술은 문항 안에서만 유효하므로 추적하지 않는다.

import { safeGetItem, safeSetItem } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { updateCardSchedule } from './spaced-repetition.js';

const STATS_KEY = STORAGE_KEYS.STATEMENT_STATS;

// 연속 정답 N회면 취약 목록에서 졸업 (SM-2 스케줄은 계속 유지 — 복습 주기는 별개)
export const WEAK_GRADUATE_STREAK = 3;

/**
 * gradeAnswer()의 perStatement 결과를 기록한다.
 * @param {Array<{sid?: string, judgedCorrect?: boolean}>} perStatement
 * @returns {number} 기록된 진술 수
 */
export function recordStatementJudgments(perStatement) {
    if (!Array.isArray(perStatement)) return 0;
    const stats = loadStats();
    const today = new Date().toISOString().split('T')[0];
    let recorded = 0;
    for (const s of perStatement) {
        if (!s || !s.sid || typeof s.judgedCorrect !== 'boolean') continue;
        updateCardSchedule(s.sid, s.judgedCorrect);
        const cur = stats[s.sid] || { j: 0, w: 0, lw: null, t: '', truth: null, cid: null, last: null, streak: 0 };
        cur.j += 1;
        cur.last = s.judgedCorrect;
        cur.streak = s.judgedCorrect ? (cur.streak || 0) + 1 : 0;
        if (s.text) cur.t = s.text;
        if (typeof s.truth === 'boolean') cur.truth = s.truth;
        if (s.conceptId) cur.cid = s.conceptId;
        if (!s.judgedCorrect) {
            cur.w += 1;
            cur.lw = today;
        }
        stats[s.sid] = cur;
        recorded++;
    }
    if (recorded > 0) saveStats(stats);
    return recorded;
}

/**
 * 진술별 누적 통계 반환
 * @param {string} sid
 * @returns {{j: number, w: number, lw: string|null}|null} { j: 판정 횟수, w: 오판 횟수, lw: 마지막 오판일 }
 */
export function getStatementStat(sid) {
    return loadStats()[sid] || null;
}

/**
 * 약한 진술 목록 — 오판 횟수 내림차순, 동률이면 최근 오판일 우선
 * 연속 정답 WEAK_GRADUATE_STREAK회 도달 진술은 졸업 처리(기본 제외)
 * @param {number} [limit]
 * @param {boolean} [includeGraduated] 졸업 진술도 포함할지
 * @returns {Array<{sid: string, j: number, w: number, lw: string|null}>}
 */
export function getWeakStatements(limit, includeGraduated = false) {
    const stats = loadStats();
    const weak = Object.entries(stats)
        .filter(([, v]) => v.w > 0 && (includeGraduated || (v.streak || 0) < WEAK_GRADUATE_STREAK))
        .map(([sid, v]) => ({ sid, ...v }))
        .sort((a, b) => (b.w - a.w) || String(b.lw).localeCompare(String(a.lw)));
    return typeof limit === 'number' ? weak.slice(0, limit) : weak;
}

/**
 * 오늘 복습 대기 중인 진술 sid 목록 (SM-2 스케줄의 nextReview 기준)
 * @returns {string[]}
 */
export function getDueStatementSids() {
    const stats = loadStats();
    const schedules = loadSrSchedules();
    const todayStr = new Date().toISOString().split('T')[0];
    return Object.keys(stats).filter(sid =>
        schedules[sid] && schedules[sid].nextReview <= todayStr);
}

function loadStats() {
    try {
        const raw = safeGetItem(STATS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveStats(stats) {
    safeSetItem(STATS_KEY, JSON.stringify(stats));
}

// spaced-repetition.js와 동일 저장소 — sid 스케줄만 조회 (SM-2 갱신은 updateCardSchedule에 위임)
function loadSrSchedules() {
    try {
        const raw = safeGetItem(STORAGE_KEYS.FC_SPACED_REPETITION);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}
