import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { scopedKey } from '../../src/exam-context.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';
import { getExamDate, setExamDate, getDDay, getSuggestedDailyCount } from '../../src/study-tracker.js';
import { getDueCards } from '../../src/spaced-repetition.js';
import { computeRecommendations, computeWrongCauseSummary, getSimHistory } from '../../src/recommendations.js';

// --- localStorage 모킹 (state.test.js와 동일 패턴) ---

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

beforeEach(() => {
    mockStorage = createMockStorage();
    originalLocalStorage = global.localStorage;
    Object.defineProperty(global, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    if (originalLocalStorage !== undefined) {
        Object.defineProperty(global, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
            configurable: true
        });
    } else {
        delete global.localStorage;
    }
});

const SUBJECTS = [
    { key: 'law', name: '1과목 화장품법', stats: { cards: 100 } },
    { key: 'manufacturing', name: '2과목 제조', stats: { cards: 80 } }
];

const todayPlus = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- 시험일 / D-day ---

test('시험일 미설정 → getExamDate/getDDay는 null', () => {
    assert.equal(getExamDate(), null);
    assert.equal(getDDay(), null);
});

test('시험일 설정 → getDDay 계산', () => {
    setExamDate(todayPlus(10));
    assert.equal(getDDay(), 10);
    setExamDate(todayPlus(-3));
    assert.equal(getDDay(), -3);
});

test('잘못된 형식 시험일 → 미설정으로 제거', () => {
    setExamDate('2026-13-99');
    assert.equal(getExamDate(), null);
    setExamDate('not-a-date');
    assert.equal(getExamDate(), null);
});

test('D-day 역산 권장량 — 남은 항목 / 남은 일수 올림', () => {
    setExamDate(todayPlus(10));
    assert.equal(getSuggestedDailyCount(95), 10);
    assert.equal(getSuggestedDailyCount(0), null);
    mockStorage.clear();
    assert.equal(getSuggestedDailyCount(95), null); // 시험일 미설정
});

// --- SM-2 복습 대기 ---

test('getDueCards — nextReview가 오늘 이전인 카드만 반환', () => {
    const schedules = {
        'law_card_a': { nextReview: todayPlus(-1) },
        'law_card_b': { nextReview: todayPlus(3) }
    };
    mockStorage.setItem(scopedKey(STORAGE_KEYS.FC_SPACED_REPETITION), JSON.stringify(schedules));
    const due = getDueCards();
    assert.deepEqual(due, ['law_card_a']);
});

// --- 추천 엔진 ---

test('추천 없음 — 데이터 없으면 빈 배열', () => {
    const recs = computeRecommendations(SUBJECTS, {});
    assert.equal(recs.length, 0);
});

test('복습 대기 카드가 최우선 추천', () => {
    mockStorage.setItem(scopedKey(STORAGE_KEYS.FC_SPACED_REPETITION), JSON.stringify({
        'law_card_a': { nextReview: todayPlus(-1) }
    }));
    const recs = computeRecommendations(SUBJECTS, { law: { mem: 5, weak: 0, quizSolved: 10, quizCorrect: 8 } });
    assert.equal(recs.length > 0, true);
    assert.ok(recs[0].title.includes('복습할 카드'));
    assert.equal(recs[0].actions[0].click, 'startSubjectStudy');
});

test('모의고사 과락 과목 추천 — 40점 미만', () => {
    mockStorage.setItem(scopedKey(STORAGE_KEYS.SIM_RESULTS_HISTORY), JSON.stringify([
        { date: todayPlus(-1), examId: 'mock1', rate: 55, subjectRates: { law: 35, manufacturing: 75 } }
    ]));
    const recs = computeRecommendations(SUBJECTS, {});
    const fail = recs.find(r => r.title.includes('과락'));
    assert.ok(fail);
    assert.ok(fail.title.includes('1과목 화장품법'));
    assert.equal(fail.actions[0].click, 'startSubjectQuiz');
});

test('정답률 최저 과목 추천 — 최소 3문 기준', () => {
    const counts = {
        law: { mem: 10, weak: 0, quizSolved: 5, quizCorrect: 2 },
        manufacturing: { mem: 20, weak: 0, quizSolved: 5, quizCorrect: 4 }
    };
    const recs = computeRecommendations(SUBJECTS, counts);
    const weak = recs.find(r => r.title.includes('정답률 최저'));
    assert.ok(weak);
    assert.ok(weak.title.includes('1과목 화장품법'));
});

test('미학습 과목 추천 — 진도가 시작된 뒤에만', () => {
    const counts = { law: { mem: 5, weak: 0, quizSolved: 0, quizCorrect: 0 } };
    const recs = computeRecommendations(SUBJECTS, counts);
    const unlearned = recs.find(r => r.title.includes('미학습'));
    assert.ok(unlearned);
    assert.ok(unlearned.title.includes('제조'));

    // 아무 진도도 없으면 미학습 추천 없음
    const recs2 = computeRecommendations(SUBJECTS, {});
    assert.equal(recs2.find(r => r.title.includes('미학습')), undefined);
});

// --- 오답 패턴 분석 ---

test('computeWrongCauseSummary — 원인 분포·최다 원인·과목 집계', () => {
    const now = Date.now();
    const causes = {
        'weak_quiz_law_quiz_1': { cause: 'memorize', ts: now, subjectId: 'law' },
        'weak_quiz_law_quiz_2': { cause: 'memorize', ts: now, subjectId: 'law' },
        'weak_quiz_manufacturing_quiz_3': { cause: 'concept', ts: now, subjectId: 'manufacturing' },
        'weak_quiz_law_quiz_4': { cause: 'calc', ts: now - 10 * 86400000, subjectId: 'law' } // 10일 전 → 7일 필터 밖
    };
    const sum = computeWrongCauseSummary(causes, { now });
    assert.equal(sum.total, 3);
    assert.equal(sum.counts.memorize, 2);
    assert.equal(sum.counts.concept, 1);
    assert.equal(sum.counts.calc, 0);
    assert.equal(sum.topCause, 'memorize');
    assert.equal(sum.topSubject, 'law');
    assert.ok(sum.advice.length > 0);
});

test('computeWrongCauseSummary — 태그 없으면 빈 결과', () => {
    const sum = computeWrongCauseSummary({});
    assert.equal(sum.total, 0);
    assert.equal(sum.topCause, null);
    assert.equal(sum.advice, '');
});

// --- 모의고사 이력 ---

test('getSimHistory — 저장된 이력 파싱/비정상 값 방어', () => {
    mockStorage.setItem(scopedKey(STORAGE_KEYS.SIM_RESULTS_HISTORY), JSON.stringify([
        { date: todayPlus(-1), examId: 'mock1', rate: 62, subjectRates: { law: 55 } }
    ]));
    const h = getSimHistory();
    assert.equal(h.length, 1);
    assert.equal(h[0].rate, 62);

    mockStorage.setItem(scopedKey(STORAGE_KEYS.SIM_RESULTS_HISTORY), 'not-json');
    assert.deepEqual(getSimHistory(), []);
});
