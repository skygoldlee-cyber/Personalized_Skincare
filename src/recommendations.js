// recommendations.js — "오늘의 합격 전략" 추천 엔진 (docs/report_archive/FEATURE_PROPOSALS.md §4.1)
// @spec D-11,D-13,AN-05,AN-06,AN-07
//
// 학습 데이터(SM-2 복습 대기·과락 과목·정답률·헷갈린 카드·미학습)를 종합해
// 우선순위가 정해진 추천 항목을 생성한다.
// DOM 비의존 순수 로직 — 렌더링은 dashboard.js가 담당.

import { safeGetItem, safeSetItem, getSimResultsHistory } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { getDueCards } from './spaced-repetition.js';
import { getCurrentExamId, getExamRules, resolveLegacySubjectKey } from './exam-context.js';
import { trackAction } from './usage-stats.js';

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
                const key = resolveLegacySubjectKey(subj);
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
    /** @type {{key:string,name:string,stats?:Object}|null} */
    let weakest = null;
    let weakestRate = 101;
    for (const subj of subjects) {
        const sc = counts[subj.key];
        if (sc && sc.quizSolved >= 3) {
            const rate = sc.quizCorrect / sc.quizSolved;
            if (rate < weakestRate) { weakestRate = rate; weakest = subj; }
        }
    }
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
    /** @type {{key:string,name:string,stats?:Object}|null} */
    let mostWeak = null;
    let mostWeakCount = 0;
    for (const subj of subjects) {
        const sc = counts[subj.key];
        if (sc && sc.weak > mostWeakCount) { mostWeakCount = sc.weak; mostWeak = subj; }
    }
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
   📈 오답 패턴 분석 (원인 자가 태깅 집계 — docs/report_archive/FEATURE_PROPOSALS.md §4.2)
   ======================================================= */

/**
 * 기본 오답 원인 분류 — 시험별 확장은 manifest `analysis.wrongCauses`가 담당한다
 * (예: {"key":"lawConfusion","label":"법령·조문 혼동","advice":"..."}).
 * 레지스트리(registry.analysis)를 통해 런타임에 병합되므로 도메인 원인이
 * 플랫폼 코드에 하드코딩되지 않는다.
 */
const BASE_WRONG_CAUSES = [
    { key: 'memorize', label: '암기 부족', advice: '플래시카드 반복 암기가 효과적입니다 — 복습 노트의 카드를 우선 순회하세요.' },
    { key: 'concept', label: '개념 오해', advice: '교재 재학습 후 유사 문제로 확인하는 흐름을 권장합니다.' },
    { key: 'calc', label: '계산 실수', advice: '같은 유형의 문제를 반복해서 풀어 실수 패턴을 줄이세요.' }
];

/**
 * 활성 시험의 오답 원인 분류표 — 기본 3종 + manifest analysis.wrongCauses 병합.
 * @returns {Array<{key:string, label:string, advice:string}>}
 */
export function getWrongCauseTaxonomy() {
    const merged = new Map(BASE_WRONG_CAUSES.map(c => [c.key, { ...c }]));
    const extra = (typeof window !== 'undefined' && window.DATA_REGISTRY
        && window.DATA_REGISTRY.analysis && window.DATA_REGISTRY.analysis.wrongCauses) || [];
    extra.forEach(e => {
        if (e && typeof e.key === 'string' && typeof e.label === 'string') {
            const base = merged.get(e.key) || { key: e.key, label: e.label, advice: '' };
            merged.set(e.key, { key: e.key, label: e.label, advice: e.advice || base.advice });
        }
    });
    return [...merged.values()];
}

/** 분류표의 key→label 맵 (태깅 버튼·집계 표 렌더용) */
export function getWrongCauseLabels() {
    const m = {};
    getWrongCauseTaxonomy().forEach(c => { m[c.key] = c.label; });
    return m;
}

/** 원인 키의 권장 학습법 (미등록 키면 빈 문자열) */
export function getWrongCauseAdvice(key) {
    const t = getWrongCauseTaxonomy().find(c => c.key === key);
    return t ? t.advice : '';
}

/**
 * 오답 원인 태그 집계 — 최근 N일 분포 + 최다 원인/과목 + 권장 학습법.
 * @param {Object<string,{cause:string,ts:number,subjectId:string|null}>} wrongCauses
 * @param {{days?:number, now?:number}} opts
 * @returns {{counts:Object, total:number, topCause:string|null, topSubject:string|null, advice:string}}
 */
export function computeWrongCauseSummary(wrongCauses, { days = 7, now = Date.now() } = {}) {
    const cutoff = now - days * 86400000;
    const labels = getWrongCauseLabels();
    const counts = {};
    Object.keys(labels).forEach(k => { counts[k] = 0; });
    const bySubj = {};
    let total = 0;

    Object.entries(wrongCauses || {}).forEach(([id, info]) => {
        if (!info || !info.cause || !(info.cause in counts)) return;
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
        advice: topCause ? getWrongCauseAdvice(topCause) : ''
    };
}

// ===== C1 — 예상 점수 추정 + 실제 결과 자가 보고 =====
// "합격 확률"이 아니라 모의고사 이력 기반의 점수 추정치만 제시한다.
// 보정된 합격 확률은 실제 결과 데이터가 축적된 후에야 의미가 있다.

// @spec ROAD-L1 — 부분 구현 (복합 추정 + 개인 편향 보정 완료; 통계적 합격 확률 격상은 다수 사용자 데이터 축적 후)
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
 * @param {number|null} [expectedAtReport] 보고 시점의 무 보정 예상 점수 — 개인 편향 산출용
 */
export function saveActualResult(passed, score, expectedAtReport) {
    if (score !== null && (typeof score !== 'number' || score < 0 || score > 100)) return false;
    const examId = getCurrentExamId();
    trackAction('actual_exam_report');
    safeSetItem(STORAGE_KEYS.ACTUAL_EXAM_RESULT, JSON.stringify({
        passed: !!passed,
        score,
        expectedAtReport: typeof expectedAtReport === 'number' ? expectedAtReport : null,
        reportedAt: new Date().toISOString(),
        examId
    }));
    return true;
}

export function clearActualResult() {
    safeSetItem(STORAGE_KEYS.ACTUAL_EXAM_RESULT, 'null');
}

/**
 * 개인 보정 편향 — 실제 점수와 보고 시점 예상 점수의 차이 (±15점 절단).
 * 모의고사보다 실제 시험에서 체계적으로 높게/낮게 나오는 사용자 경향을 흡수한다.
 * @param {Object|null} actual getActualResult() 결과
 * @returns {number} 보정치 (없으면 0)
 */
export function computeCalibrationBias(actual) {
    if (!actual || typeof actual.score !== 'number' || typeof actual.expectedAtReport !== 'number') return 0;
    return Math.max(-15, Math.min(15, Math.round(actual.score - actual.expectedAtReport)));
}

/**
 * 복합 예상 점수 — 모의고사 이력이 주 지표이고, 표본 부족(cold start) 시
 * 마스터리 졸업률·퀴즈 정답률을 가중 병합한다. 이력 3회부터 이력 100%.
 * @param {Array<{rate:number}>} history sim_results_history 레코드
 * @param {{masteryPercent?:number, quizRate?:number, quizSolved?:number}} [aux] 보조 지표
 * @param {number} [bias] 개인 보정치 (computeCalibrationBias)
 * @returns {{n:number, expected:number, lo:number, hi:number,
 *   trend:string, slope:number, source:'sim'|'blend'|'aux', biasApplied?:number}|null}
 */
export function estimateCompositeScore(history, aux = {}, bias = 0) {
    aux = aux || {};
    const base = estimateExpectedScore(history);

    // 보조 추정 — 마스터리(고정 가중 0.6) + 퀴즈 정답률(표본 가중, 50문에서 만점)
    const parts = [];
    if (typeof aux.masteryPercent === 'number') parts.push({ v: aux.masteryPercent, w: 0.6 });
    const solved = aux.quizSolved || 0;
    if (typeof aux.quizRate === 'number' && solved >= 5) {
        parts.push({ v: aux.quizRate, w: Math.min(1, solved / 50) });
    }
    const wSum = parts.reduce((s, p) => s + p.w, 0);
    const auxEst = wSum > 0 ? parts.reduce((s, p) => s + p.v * p.w, 0) / wSum : null;

    /** @type {{n:number, expected:number, lo:number, hi:number, trend:string, slope:number, source:'sim'|'blend'|'aux', biasApplied?:number}} */
    let out;
    if (!base && auxEst === null) return null;
    if (!base) {
        const e = Math.round(/** @type {number} */ (auxEst));
        out = { n: 0, expected: e, lo: Math.max(0, e - 10), hi: Math.min(100, e + 10), trend: 'flat', slope: 0, source: 'aux' };
    } else if (auxEst === null || base.n >= 3) {
        out = { ...base, source: 'sim' };
    } else {
        const w = base.n / 3;
        const e = Math.round(base.expected * w + auxEst * (1 - w));
        const width = Math.round((base.expected - base.lo) * w + 10 * (1 - w));
        out = { n: base.n, expected: e, lo: Math.max(0, e - width), hi: Math.min(100, e + width), trend: base.trend, slope: base.slope, source: 'blend' };
    }

    const b = Math.max(-15, Math.min(15, bias || 0));
    if (b) {
        out.expected = Math.max(0, Math.min(100, out.expected + b));
        out.lo = Math.max(0, out.lo + b);
        out.hi = Math.min(100, out.hi + b);
        out.biasApplied = b;
    }
    return out;
}

/* =======================================================
   추천 효과 추적 — 추천 발행 시점의 과목별 정답률을 스냅샷하고
   다음 방문에서 개선 여부를 비교한다 (피드백 루프).
   ======================================================= */

const REC_SNAPSHOT_MIN_AGE = 6 * 3600000;   // 동일 추천 재기록 방지 (6시간)
const REC_EFFECT_MIN_AGE = 12 * 3600000;    // 효과 판정 최소 관찰 시간
const REC_EFFECT_MIN_SOLVED = 5;            // 효과 판정에 필요한 신규 표본

function _loadRecSnapshot() {
    try {
        const v = JSON.parse(safeGetItem(STORAGE_KEYS.REC_SNAPSHOT) || 'null');
        return v && typeof v === 'object' ? v : null;
    } catch (e) {
        return null;
    }
}

/**
 * 추천 발행 스냅샷 저장 — 대상 과목의 현재 정답률을 기준선으로 기록한다.
 * 동일 대상 추천이 6시간 내 재발행되면 기준선을 보존한다(관찰 창 유지).
 * @param {Array<{actions:Array<{arg:string}>}>} recs computeRecommendations 결과
 * @param {Object} counts 과목별 학습 카운트
 */
export function snapshotRecommendations(recs, counts) {
    const targets = [...new Set((recs || [])
        .flatMap(r => r.actions.map(a => a.arg))
        .filter(a => typeof a === 'string' && counts && counts[a]))];
    if (!targets.length) return;
    const prev = _loadRecSnapshot();
    const sameTargets = prev && JSON.stringify([...prev.targets].sort()) === JSON.stringify([...targets].sort());
    if (prev && sameTargets && Date.now() - prev.ts < REC_SNAPSHOT_MIN_AGE) return;
    const baseline = {};
    targets.forEach(k => {
        const c = counts[k];
        baseline[k] = { solved: c.quizSolved || 0, correct: c.quizCorrect || 0 };
    });
    safeSetItem(STORAGE_KEYS.REC_SNAPSHOT, JSON.stringify({
        ts: Date.now(), examId: getCurrentExamId(), targets, baseline
    }));
}

/**
 * 추천 효과 평가 — 기준선 대비 대상 과목의 정답률 변화.
 * 관찰 12시간 미만이거나 과목당 신규 표본 5문 미만이면 null (판정 보류).
 * @param {Object} counts 과목별 학습 카운트
 * @param {(key:string)=>string} [subjectName] 표시명 해석기
 * @returns {{sinceTs:number, items:Array<{key:string,name:string,fromRate:number,toRate:number,delta:number,added:number}>}|null}
 */
export function evaluateRecommendationEffect(counts, subjectName) {
    const snap = _loadRecSnapshot();
    if (!snap || !snap.baseline || snap.examId !== getCurrentExamId()) return null;
    if (Date.now() - snap.ts < REC_EFFECT_MIN_AGE) return null;
    const name = subjectName || (k => k);
    const items = [];
    (snap.targets || []).forEach(k => {
        const b = snap.baseline[k];
        const c = counts && counts[k];
        if (!b || !c) return;
        const added = (c.quizSolved || 0) - b.solved;
        if (added < REC_EFFECT_MIN_SOLVED) return;
        const fromRate = b.solved > 0 ? Math.round((b.correct / b.solved) * 100) : null;
        const toRate = c.quizSolved > 0 ? Math.round((c.quizCorrect / c.quizSolved) * 100) : null;
        if (fromRate === null || toRate === null) return;
        items.push({ key: k, name: name(k), fromRate, toRate, delta: toRate - fromRate, added });
    });
    return items.length ? { sinceTs: snap.ts, items } : null;
}
