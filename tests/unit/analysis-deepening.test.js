// tests/unit/analysis-deepening.test.js — 맞춤학습 심화 기능 검증
// @spec AN-05,AN-06,AN-07,AN-08,AN-09
// 복합 예상 점수·개인 보정·추천 효과 추적·오답 원인 분류 확장·
// 학습 패턴·주간 리포트의 순수 로직을 직접 실행해 검증한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    estimateCompositeScore, computeCalibrationBias, saveActualResult,
    getActualResult, clearActualResult, snapshotRecommendations,
    evaluateRecommendationEffect, getWrongCauseTaxonomy, getWrongCauseLabels
} from '../../src/recommendations.js';
import { computeStudyPattern, buildWeeklyReportText, estimateUntaggedCauses } from '../../src/analysis-engine.js';
import { recordStudyActivity, getStudyCalendar } from '../../src/study-tracker.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

// --- localStorage·window.DATA_REGISTRY 모킹 (learning-pro.test.js와 동일 패턴) ---

function createMockStorage() {
    const store = {};
    return {
        getItem(key) { return key in store ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { for (const k of Object.keys(store)) delete store[k]; },
        _store: store
    };
}

let mockStorage;
let originalLocalStorage;
let originalWindow;

beforeEach(() => {
    mockStorage = createMockStorage();
    originalLocalStorage = global.localStorage;
    Object.defineProperty(global, 'localStorage', { value: mockStorage, writable: true, configurable: true });
    originalWindow = global.window;
    Object.defineProperty(global, 'window', { value: {}, writable: true, configurable: true });
});

afterEach(() => {
    Object.defineProperty(global, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    if (originalWindow !== undefined) {
        Object.defineProperty(global, 'window', { value: originalWindow, writable: true, configurable: true });
    } else {
        delete global.window;
    }
});

const dayStr = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- AN-05: 복합 예상 점수 ----------

test('AN-05: 이력·보조 지표 모두 없으면 null', () => {
    assert.equal(estimateCompositeScore([], {}), null);
    assert.equal(estimateCompositeScore(null, null), null);
});

test('AN-05: 이력 없이 보조 지표만 있으면 aux 추정 (넓은 범위)', () => {
    const e = estimateCompositeScore([], { masteryPercent: 60, quizRate: 70, quizSolved: 30 });
    assert.equal(e.source, 'aux');
    assert.equal(e.expected, Math.round((60 * 0.6 + 70 * 0.6) / 1.2));
    assert.equal(e.hi - e.lo, 20);
});

test('AN-05: 퀴즈 표본 5문 미만이면 정답률은 보조 추정에서 제외', () => {
    const e = estimateCompositeScore([], { quizRate: 90, quizSolved: 3 });
    assert.equal(e, null); // mastery 없이 표본 부족 → 추정 불가
});

test('AN-05: 이력 1~2회는 blend, 3회부터는 sim', () => {
    const b = estimateCompositeScore([{ rate: 50 }], { masteryPercent: 80 });
    assert.equal(b.source, 'blend');
    assert.ok(b.expected > 50 && b.expected < 80, `blend 기대값 범위 이탈: ${b.expected}`);
    const s = estimateCompositeScore([{ rate: 50 }, { rate: 55 }, { rate: 60 }], { masteryPercent: 80 });
    assert.equal(s.source, 'sim');
    assert.equal(s.expected, 55);
});

test('AN-05: 보정치는 ±15로 절단되고 점수에 적용된다', () => {
    const e = estimateCompositeScore([{ rate: 60 }, { rate: 60 }, { rate: 60 }], {}, 30);
    assert.equal(e.biasApplied, 15);
    assert.equal(e.expected, 75);
    const neg = estimateCompositeScore([{ rate: 60 }, { rate: 60 }, { rate: 60 }], {}, -30);
    assert.equal(neg.expected, 45);
});

// ---------- AN-05: 개인 보정 (실제 결과 → 편향) ----------

test('AN-05: 보고 시점 예상과 실제 점수의 차이가 보정치가 된다', () => {
    assert.equal(computeCalibrationBias(null), 0);
    assert.equal(computeCalibrationBias({ score: 70 }), 0); // expectedAtReport 없음
    assert.equal(computeCalibrationBias({ score: 72, expectedAtReport: 65 }), 7);
    assert.equal(computeCalibrationBias({ score: 30, expectedAtReport: 70 }), -15); // ±15 절단
});

test('AN-05: saveActualResult가 보고 시점 예상을 함께 저장한다', () => {
    saveActualResult(true, 72, 65);
    const r = getActualResult();
    assert.equal(r.score, 72);
    assert.equal(r.expectedAtReport, 65);
    clearActualResult();
    assert.equal(getActualResult(), null);
});

// ---------- AN-06: 추천 효과 추적 ----------

const COUNTS = { law: { mem: 10, weak: 2, quizSolved: 20, quizCorrect: 10 } };
const RECS = [{ actions: [{ click: 'startSubjectQuiz', arg: 'law' }] }];

test('AN-06: 추천 발행 시 기준선 스냅샷을 저장한다', () => {
    snapshotRecommendations(RECS, COUNTS);
    const snap = JSON.parse(mockStorage._store['cosmetic:' + STORAGE_KEYS.REC_SNAPSHOT] || mockStorage._store[STORAGE_KEYS.REC_SNAPSHOT]);
    assert.ok(snap.targets.includes('law'));
    assert.equal(snap.baseline.law.solved, 20);
});

test('AN-06: 12시간 경과 + 신규 표본 5문 이상이면 개선 평가를 반환한다', () => {
    snapshotRecommendations(RECS, COUNTS);
    const key = 'cosmetic:' + STORAGE_KEYS.REC_SNAPSHOT;
    const snap = JSON.parse(mockStorage._store[key]);
    snap.ts = Date.now() - 13 * 3600000; // 13시간 전으로 이동
    mockStorage._store[key] = JSON.stringify(snap);
    const now = { law: { mem: 10, weak: 2, quizSolved: 30, quizCorrect: 24 } }; // 50% → 80%
    const eff = evaluateRecommendationEffect(now, (k) => k);
    assert.ok(eff);
    assert.equal(eff.items[0].delta, 30);
});

test('AN-06: 신규 표본 부족·관찰 시간 미만·시험 불일치 시 판정 보류', () => {
    snapshotRecommendations(RECS, COUNTS);
    // 관찰 시간 미만
    assert.equal(evaluateRecommendationEffect(COUNTS), null);
    const key = 'cosmetic:' + STORAGE_KEYS.REC_SNAPSHOT;
    const snap = JSON.parse(mockStorage._store[key]);
    snap.ts = Date.now() - 13 * 3600000;
    mockStorage._store[key] = JSON.stringify(snap);
    // 신규 표본 5문 미만
    assert.equal(evaluateRecommendationEffect({ law: { ...COUNTS.law, quizSolved: 22, quizCorrect: 12 } }), null);
});

// ---------- AN-07: 오답 원인 분류 manifest-driven 확장 ----------

test('AN-07: 기본 분류 3종 + registry 선언이 병합된다', () => {
    assert.deepEqual(Object.keys(getWrongCauseLabels()), ['memorize', 'concept', 'calc']);
    window.DATA_REGISTRY = { analysis: { wrongCauses: [
        { key: 'lawConfusion', label: '법령·조문 혼동', advice: '조문 대조' },
        { key: 'numeric', label: '수치·조건 착각' }
    ] } };
    const tax = getWrongCauseTaxonomy();
    assert.equal(tax.length, 5);
    assert.equal(tax.find(c => c.key === 'lawConfusion').advice, '조문 대조');
    assert.equal(getWrongCauseLabels().numeric, '수치·조건 착각');
});

test('AN-07: 자동 추정이 확장 분류(lawConfusion·numeric)를 사용한다', () => {
    window.DATA_REGISTRY = { analysis: { wrongCauses: [
        { key: 'lawConfusion', label: '법령·조문 혼동' },
        { key: 'numeric', label: '수치·조건 착각' }
    ] } };
    const resolveQuiz = (id) => ({
        law_q1: { quiz: { question: '화장품법 제3조에 따른 것은?', answer: '제조판매업자' }, subjectId: 'law' },
        law_q2: { quiz: { question: '안전기준 한도는?', answer: '3%' }, subjectId: 'law' },
        law_q3: { quiz: { question: '부피를 계산하시오', answer: '12' }, subjectId: 'law' }
    }[id] || null);
    const res = estimateUntaggedCauses({
        quizResults: { law_q1: { correct: false }, law_q2: { correct: false }, law_q3: { correct: false } },
        wrongCauses: {},
        resolveQuiz
    });
    assert.equal(res.counts.lawConfusion, 1);
    assert.equal(res.counts.numeric, 1);
    assert.equal(res.counts.calc, 1);
    assert.equal(res.estimated, 3);
});

// ---------- AN-08: 학습 패턴 분석 ----------

test('AN-08: 시간대·요일 버킷으로 최다 패턴을 집계한다', () => {
    const cal = {};
    for (let i = 0; i < 5; i++) {
        // 5일 × 저녁 2회씩 = 10 이벤트
        cal[dayStr(i)] = { cards: 2, quizzes: 0, correct: 0, h: { 20: 2 } };
    }
    const p = computeStudyPattern(cal);
    assert.ok(p);
    assert.equal(p.topBand.key, 'evening');
    assert.ok(p.topDow && p.topDow.dow >= 0 && p.topDow.dow <= 6);
    assert.equal(typeof p.weekendShare, 'number');
});

test('AN-08: 표본 부족(활동 4일·8회 미만)이면 null', () => {
    assert.equal(computeStudyPattern({ [dayStr(0)]: { cards: 1, quizzes: 0, h: { 10: 1 } } }), null);
    assert.equal(computeStudyPattern({}), null);
});

test('AN-08: recordStudyActivity가 시간대 버킷을 기록한다', () => {
    recordStudyActivity({ quizzes: 1 });
    const cal = getStudyCalendar();
    const today = dayStr(0);
    assert.ok(cal[today].h && typeof cal[today].h === 'object', '시간대 버킷 없음');
    assert.equal(Object.values(cal[today].h).reduce((a, b) => a + b, 0), 1);
});

// ---------- AN-09: 주간 리포트 ----------

test('AN-09: 리포트에 주간 학습량·예상 점수·취약 단원이 포함된다', () => {
    const text = buildWeeklyReportText({
        appName: '테스트앱',
        growth: { thisWeek: { quizzes: 20, correct: 15, cards: 30, days: 4, rate: 75 }, rateDelta: 5 },
        estimate: { lo: 60, hi: 70, source: 'sim', n: 3 },
        gap: { gap: 0, passLine: 60, weakest: { name: '화장품법', rate: 45 } },
        weakChapters: [{ subject: '화장품법', totalWrongs: 8, chapters: [{ chapter: '2단원', wrongs: 5 }] }],
        pattern: { topBand: { label: '저녁 (18~22시)' }, topDow: { label: '화요일' }, weekendShare: 30 },
        ddayLabel: 'D-30'
    });
    assert.ok(text.includes('테스트앱') && text.includes('주간 학습 리포트'));
    assert.ok(text.includes('정답률 75%'));
    assert.ok(text.includes('60~70점'));
    assert.ok(text.includes('화장품법 > 2단원'));
    assert.ok(text.includes('저녁 (18~22시)'));
    assert.ok(text.includes('D-30'));
});

test('AN-09: 빈 데이터로도 리포트가 생성된다 (방어)', () => {
    const text = buildWeeklyReportText({});
    assert.ok(text.includes('주간 학습 리포트'));
});
