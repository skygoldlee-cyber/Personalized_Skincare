// recommendations.js — "오늘의 합격 전략" 추천 엔진 (FEATURE_PROPOSALS §4.1)
//
// 학습 데이터(SM-2 복습 대기·과락 과목·정답률·헷갈린 카드·미학습)를 종합해
// 우선순위가 정해진 추천 항목을 생성한다.
// DOM 비의존 순수 로직 — 렌더링은 dashboard.js가 담당.

import { safeGetItem, safeSetItem, getSimResultsHistory } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { getDueCards } from './spaced-repetition.js';
import { getCurrentExamId, getExamRules, resolveLegacySubjectKey } from './exam-context.js';

/**
 * 모의고사 성적 이력 로드 (charts.js getSimResults와 같은 저장 키)
 * @returns {Array<{date:string, examId:string, rate:number, subjectRates:Object|null}>}
 */
export function getSimHistory() {
    return getSimResultsHistory(); // 캐싱 로더 공용 (state.js)
}

import { subjectKeyFromItemId } from './weak-items.js';
const subjectKeyOf = subjectKeyFromItemId;

/**
 * 우선순위 추천 목록 생성.
 * @param {Array<{key:string,name:string,stats?:Object}>} subjects 과목 메타 목록
 * @param {Object<string,{mem:number,weak:number,quizSolved:number,quizCorrect:number}>} counts 과목별 학습 카운트
 * @returns {Array<{icon:string, color:string, title:string, reason:string,
 *   actions:Array<{click:string, arg:string, label:string, icon:string, cls:string}>}>}
 */
export function computeRecommendations(subjects, counts) {
    const recs = [];
    const subjName = (key) => {
        const s = subjects.find(x => x.key === key);
        return s ? s.name : key;
    };

    // 1순위: 오늘 복습 대기 카드 (SM-2 간격 반복)
    const due = getDueCards();
    if (due.length > 0) {
        const bySubj = {};
        due.forEach(id => {
            const k = subjectKeyOf(id);
            if (k) bySubj[k] = (bySubj[k] || 0) + 1;
        });
        const top = Object.entries(bySubj).sort((a, b) => b[1] - a[1])[0];
        const target = top ? top[0] : (subjects[0] && subjects[0].key);
        recs.push({
            icon: 'fa-clock', color: 'var(--color-primary)',
            title: `오늘 복습할 카드 ${due.length}장`,
            reason: top ? `SM-2 복습 시간 도래 — ${subjName(top[0])} ${top[1]}장 포함` : 'SM-2 복습 시간 도래',
            actions: [
                { click: 'startSubjectStudy', arg: target, label: '복습 시작', icon: 'fa-layer-group', cls: 'btn-primary' }
            ]
        });
    }

    // 2순위: 최근 모의고사 과락 과목 (매니페스트 subjectFailBelow 미만)
    const failBelow = getExamRules().subjectFailBelow;
    const history = getSimHistory();
    if (history.length > 0) {
        const last = history[history.length - 1];
        if (last && last.subjectRates) {
            Object.entries(last.subjectRates).forEach(([subj, rate]) => {
                if (rate === null || rate === undefined || rate >= failBelow) return;
                const key = subj.startsWith('subject') ? resolveLegacySubjectKey(subj) : subj;
                if (!subjects.some(s => s.key === key)) return;
                recs.push({
                    icon: 'fa-triangle-exclamation', color: 'var(--color-danger)',
                    title: `${subjName(key)} 과락 위험`,
                    reason: `최근 모의고사 ${rate}% — ${failBelow}점 미만 과락 기준`,
                    actions: [
                        { click: 'startSubjectQuiz', arg: key, label: '지금 풀기', icon: 'fa-play', cls: 'btn-primary' },
                        { click: 'startSubjectReader', arg: key, label: '교재 보기', icon: 'fa-book-open', cls: 'btn-secondary' }
                    ]
                });
            });
        }
    }

    // 3순위: 정답률 최저 과목 (최소 3문 이상 푼 과목만)
    let weakest = null;
    let weakestRate = 101;
    subjects.forEach(subj => {
        const sc = counts[subj.key];
        if (sc && sc.quizSolved >= 3) {
            const rate = sc.quizCorrect / sc.quizSolved;
            if (rate < weakestRate) { weakestRate = rate; weakest = subj; }
        }
    });
    if (weakest) {
        const rate = Math.round(weakestRate * 100);
        const alreadyRec = recs.some(r => r.actions.some(a => a.arg === weakest.key));
        if (!alreadyRec) {
            recs.push({
                icon: 'fa-bullseye', color: 'var(--color-danger)',
                title: `정답률 최저: ${weakest.name} (${rate}%)`,
                reason: '푼 문제 중 정답률이 가장 낮은 과목',
                actions: [
                    { click: 'startSubjectQuiz', arg: weakest.key, label: '퀴즈 풀기', icon: 'fa-play', cls: 'btn-primary' },
                    { click: 'startSubjectReader', arg: weakest.key, label: '교재 보기', icon: 'fa-book-open', cls: 'btn-secondary' }
                ]
            });
        }
    }

    // 4순위: 헷갈린 카드가 가장 많은 과목
    let mostWeak = null;
    let mostWeakCount = 0;
    subjects.forEach(subj => {
        const sc = counts[subj.key];
        if (sc && sc.weak > mostWeakCount) { mostWeakCount = sc.weak; mostWeak = subj; }
    });
    if (mostWeak && mostWeakCount > 0 && mostWeak !== weakest) {
        recs.push({
            icon: 'fa-note-sticky', color: 'var(--color-warning)',
            title: `헷갈린 카드 집중: ${mostWeak.name} (${mostWeakCount}장)`,
            reason: '복습 노트에 쌓인 카드가 가장 많은 과목',
            actions: [
                { click: 'startSubjectStudy', arg: mostWeak.key, label: '카드 복습', icon: 'fa-layer-group', cls: 'btn-primary' },
                { click: 'startSubjectReader', arg: mostWeak.key, label: '교재 보기', icon: 'fa-book-open', cls: 'btn-secondary' }
            ]
        });
    }

    // 5순위: 미학습 과목 (암기 카드 0장 — 학습이 시작된 뒤에만 표시)
    const hasAnyProgress = subjects.some(s => {
        const sc = counts[s.key];
        return sc && (sc.mem > 0 || sc.quizSolved > 0);
    });
    if (hasAnyProgress) {
        subjects.forEach(subj => {
            const sc = counts[subj.key];
            const totalCards = (subj.stats && subj.stats.cards) || 0;
            if (totalCards > 0 && (!sc || sc.mem === 0) && recs.length < 5) {
                recs.push({
                    icon: 'fa-seedling', color: 'var(--color-success)',
                    title: `미학습: ${subj.name}`,
                    reason: '아직 카드 학습을 시작하지 않은 과목',
                    actions: [
                        { click: 'startSubjectStudy', arg: subj.key, label: '학습 시작', icon: 'fa-seedling', cls: 'btn-secondary' }
                    ]
                });
            }
        });
    }

    return recs;
}



/* =======================================================
   📈 오답 패턴 분석 (원인 자가 태깅 집계 — FEATURE_PROPOSALS §4.2)
   ======================================================= */

export const WRONG_CAUSE_LABELS = {
    memorize: '암기 부족',
    concept: '개념 오해',
    calc: '계산 실수'
};

const WRONG_CAUSE_ADVICE = {
    memorize: '플래시카드 반복 암기가 효과적입니다 — 복습 노트의 카드를 우선 순회하세요.',
    concept: '교재 재학습 후 유사 문제로 확인하는 흐름을 권장합니다.',
    calc: '같은 유형의 문제를 반복해서 풀어 실수 패턴을 줄이세요.'
};

/**
 * 오답 원인 태그 집계 — 최근 N일 분포 + 최다 원인/과목 + 권장 학습법.
 * @param {Object<string,{cause:string,ts:number,subjectId:string}>} wrongCauses
 * @param {{days?:number, now?:number}} opts
 * @returns {{counts:Object, total:number, topCause:string|null, topSubject:string|null, advice:string}}
 */
export function computeWrongCauseSummary(wrongCauses, { days = 7, now = Date.now() } = {}) {
    const cutoff = now - days * 86400000;
    const counts = { memorize: 0, concept: 0, calc: 0 };
    const bySubj = {};
    let total = 0;

    Object.entries(wrongCauses || {}).forEach(([id, info]) => {
        if (!info || !(info.cause in counts)) return;
        if (info.ts && info.ts < cutoff) return;
        counts[info.cause]++;
        total++;
        const subj = info.subjectId || (id.match(/^([a-z]+)_/) || [])[1];
        if (subj) bySubj[subj] = (bySubj[subj] || 0) + 1;
    });

    const topCause = total > 0
        ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    const topSubject = Object.entries(bySubj).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
        counts,
        total,
        topCause,
        topSubject,
        advice: topCause ? WRONG_CAUSE_ADVICE[topCause] : ''
    };
}

// ===== C1 — 예상 점수 추정 + 실제 결과 자가 보고 =====
// "합격 확률"이 아니라 모의고사 이력 기반의 점수 추정치만 제시한다.
// 보정된 합격 확률은 실제 결과 데이터가 축적된 후에야 의미가 있다.

/**
 * 모의고사 이력에서 예상 점수 대·추세를 추정한다.
 * @param {Array<{rate:number}>} history sim_results_history 레코드
 * @returns {{n:number, expected:number, lo:number, hi:number,
 *   trend:'up'|'flat'|'down', slope:number}|null} 이력 없으면 null
 */
export function estimateExpectedScore(history) {
    const rates = (history || []).map(h => h.rate).filter(r => typeof r === 'number');
    if (!rates.length) return null;
    const recent = rates.slice(-5);
    const expected = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);

    // ±1σ 범위 (2회 미만이면 ±5 고정)
    let lo, hi;
    if (recent.length >= 2) {
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const sd = Math.sqrt(recent.reduce((s, r) => s + (r - mean) ** 2, 0) / recent.length);
        lo = Math.max(0, Math.round(expected - sd));
        hi = Math.min(100, Math.round(expected + sd));
    } else {
        lo = Math.max(0, expected - 5);
        hi = Math.min(100, expected + 5);
    }

    // 추세: 전체 이력의 선형 회귀 기울기 (회당 점수 변화)
    let slope = 0;
    const ys = rates.slice(-8);
    if (ys.length >= 3) {
        const n = ys.length;
        const xm = (n - 1) / 2;
        const ym = ys.reduce((a, b) => a + b, 0) / n;
        let num = 0, den = 0;
        ys.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
        slope = den ? num / den : 0;
    }
    const trend = slope > 1.5 ? 'up' : slope < -1.5 ? 'down' : 'flat';

    return { n: rates.length, expected, lo, hi, trend, slope };
}

/** 실제 시험 결과 자가 보고 로드 */
export function getActualResult() {
    try {
        const parsed = JSON.parse(safeGetItem(STORAGE_KEYS.ACTUAL_EXAM_RESULT) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

/**
 * 실제 시험 결과 저장 — 예측 정확도 보정 데이터 축적용.
 * @param {boolean} passed
 * @param {number|null} score 0~100 또는 null(미기입)
 */
export function saveActualResult(passed, score) {
    if (score !== null && (typeof score !== 'number' || score < 0 || score > 100)) return false;
    const examId = getCurrentExamId();
    safeSetItem(STORAGE_KEYS.ACTUAL_EXAM_RESULT, JSON.stringify({
        passed: !!passed,
        score,
        reportedAt: new Date().toISOString(),
        examId
    }));
    return true;
}

export function clearActualResult() {
    safeSetItem(STORAGE_KEYS.ACTUAL_EXAM_RESULT, 'null');
}
