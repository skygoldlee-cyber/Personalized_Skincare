// tests/unit/analysis-engine.test.js — 맞춤학습 분석 엔진 순수 로직
// @spec AN-01,AN-02,D-16
// 과목 무관 데이터 주입형 — 임의 과목 키로 검증 (모듈화 요구: 과목 변경 시 코드 수정 불필요)

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ENGINE = '../../src/analysis-engine.js';

test('subjectFromSid: sid에서 과목 키 추출', async () => {
    const { subjectFromSid } = await import(ENGINE);
    assert.equal(subjectFromSid('law_st_5fd43a'), 'law');
    assert.equal(subjectFromSid('chem_st_ab12cd'), 'chem');
    assert.equal(subjectFromSid('invalid'), null);
    assert.equal(subjectFromSid(''), null);
});

test('chapterFromCid: L#### → chapterRanges로 단원명 해석', async () => {
    const { chapterFromCid } = await import(ENGINE);
    const ranges = { subjA: [[100, 'Chapter 01. 개요'], [200, '1. 정의'], [300, '2. 분류']] };
    assert.equal(chapterFromCid('L150', 'subjA', ranges), 'Chapter 01. 개요');
    assert.equal(chapterFromCid('L250', 'subjA', ranges), '1. 정의');
    assert.equal(chapterFromCid('L999', 'subjA', ranges), '2. 분류');
    assert.equal(chapterFromCid('q:x1', 'subjA', ranges), null);   // 폴백 cid는 해석 불가
    assert.equal(chapterFromCid('L100', '없는과목', ranges), null);
    assert.equal(chapterFromCid(null, 'subjA', ranges), null);
});

test('computeChapterWeakness: 퀴즈 오답 + 진술 오판을 단원별로 집계', async () => {
    const { computeChapterWeakness } = await import(ENGINE);
    const quizResults = {
        'subjA_quiz_01': { solved: true, correct: false },
        'subjA_quiz_02': { solved: true, correct: true },
        'subjA_quiz_03': { solved: true, correct: false },
    };
    const resolveQuiz = (id) => ({
        'subjA_quiz_01': { quiz: { category: '2. 분류' }, subjectId: 'subjA' },
        'subjA_quiz_03': { quiz: { category: '2. 분류' }, subjectId: 'subjA' },
    })[id] || null;
    const statementStats = {
        'subjA_st_aaa111': { j: 5, w: 3, cid: 'L210', t: '텍스트', truth: true, streak: 0 },
        'subjB_st_bbb222': { j: 2, w: 1, cid: 'L050', t: '다른 텍스트', truth: false, streak: 0 },
    };
    const ranges = {
        subjA: [[200, '2. 분류']],
        subjB: [[1, '1. 개요']],
    };
    const out = computeChapterWeakness({
        quizResults, weakCards: new Set(), statementStats,
        questionChapters: {}, chapterRanges: ranges,
        resolveQuiz, limit: 10
    });
    // '2. 분류': 퀴즈 오답 2 + 진술 오판 1 = 3건 / '1. 개요': 진술 오판 1건
    assert.equal(out[0].chapter, '2. 분류');
    assert.equal(out[0].wrongs, 3);
    assert.equal(out[1].chapter, '1. 개요');
    assert.equal(out[1].wrongs, 1);
});

test('computeSubjectWeakChapters: 과목별 그룹화 — 과락 평가 단위와 일치', async () => {
    const { computeSubjectWeakChapters } = await import(ENGINE);
    const quizResults = {
        'subjA_quiz_01': { solved: true, correct: false },
        'subjB_quiz_01': { solved: true, correct: false },
        'subjB_quiz_02': { solved: true, correct: false },
    };
    const resolveQuiz = (id) => ({
        'subjA_quiz_01': { quiz: { category: '2. 분류' }, subjectId: 'subjA' },
        'subjB_quiz_01': { quiz: { category: '1. 개요' }, subjectId: 'subjB' },
        'subjB_quiz_02': { quiz: { category: '3. 절차' }, subjectId: 'subjB' },
    })[id] || null;
    const statementStats = {
        'subjB_st_bbb222': { j: 3, w: 2, cid: 'L050', t: '텍스트', truth: false, streak: 0 },
    };
    const ranges = { subjB: [[1, '1. 개요']] };
    const out = computeSubjectWeakChapters({
        quizResults, weakCards: new Set(), statementStats,
        questionChapters: {}, chapterRanges: ranges,
        resolveQuiz, subjectName: (k) => ({ subjA: '과목A', subjB: '과목B' })[k] || k,
        chaptersPerSubject: 2
    });
    // subjB: 퀴즈 2건 + 진술 1건(L050→1.개요) → '1. 개요' 2건 + '3. 절차' 1건 = 총 3건
    assert.equal(out.length, 2);
    assert.equal(out[0].subjectKey, 'subjB');
    assert.equal(out[0].subject, '과목B');
    assert.equal(out[0].totalWrongs, 3);
    assert.equal(out[0].chapters[0].chapter, '1. 개요');
    assert.equal(out[0].chapters[0].wrongs, 2);
    assert.equal(out[0].chapters[1].chapter, '3. 절차');
    assert.equal(out[1].subjectKey, 'subjA');
    assert.equal(out[1].totalWrongs, 1);
});

test('computeChapterWeakness: 졸업 진술(streak>=3)은 집계 제외', async () => {
    const { computeChapterWeakness } = await import(ENGINE);
    const statementStats = {
        'subjA_st_aaa111': { j: 5, w: 4, cid: 'L210', streak: 3 }, // 졸업
    };
    const out = computeChapterWeakness({
        quizResults: {}, weakCards: new Set(), statementStats,
        questionChapters: {}, chapterRanges: { subjA: [[200, '2. 분류']] },
        resolveQuiz: () => null, limit: 10
    });
    assert.equal(out.length, 0);
});

test('computeWeeklyGrowth: 최근 7일 vs 이전 7일 정답률 델타', async () => {
    const { computeWeeklyGrowth } = await import(ENGINE);
    const d = (offset) => {
        const dt = new Date(); dt.setDate(dt.getDate() - offset);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const calendar = {
        [d(1)]: { cards: 10, quizzes: 10, correct: 8 },   // 이번 주 80%
        [d(3)]: { cards: 5, quizzes: 0, correct: 0 },
        [d(8)]: { cards: 8, quizzes: 10, correct: 5 },    // 지난주 50%
    };
    const g = computeWeeklyGrowth(calendar);
    assert.equal(g.thisWeek.rate, 80);
    assert.equal(g.lastWeek.rate, 50);
    assert.equal(g.rateDelta, 30);
    assert.equal(g.cardDelta, 7); // (10+5) - 8
});

test('computeWeeklyGrowth: 데이터 없으면 rate null', async () => {
    const { computeWeeklyGrowth } = await import(ENGINE);
    const g = computeWeeklyGrowth({});
    assert.equal(g.thisWeek.rate, null);
    assert.equal(g.rateDelta, null);
});

test('computePassGap: 예상 점수 → 합격선 갭 + 최저 과목', async () => {
    const { computePassGap } = await import(ENGINE);
    const out = computePassGap({
        estimate: { expected: 52 },
        simHistory: [{ rate: 52, subjectRates: { law: 45, chem: 60 } }],
        subjects: [{ key: 'law', name: '법령' }, { key: 'chem', name: '화학' }],
        counts: {},
        rules: { passAverage: 60, subjectFailBelow: 40 }
    });
    assert.equal(out.gap, 8);
    assert.equal(out.weakest.key, 'law');
    assert.equal(out.weakest.rate, 45);
});

test('computePassGap: 모의고사 없으면 퀴즈 정답률 폴백', async () => {
    const { computePassGap } = await import(ENGINE);
    const out = computePassGap({
        estimate: null, simHistory: [],
        subjects: [{ key: 'law', name: '법령' }, { key: 'chem', name: '화학' }],
        counts: {
            law: { quizSolved: 10, quizCorrect: 5 },
            chem: { quizSolved: 10, quizCorrect: 8 },
        },
        rules: { passAverage: 60, subjectFailBelow: 40 }
    });
    assert.equal(out.gap, null);
    assert.equal(out.weakest.key, 'law');
    assert.equal(out.weakest.rate, 50);
});

test('computeWeakConceptClusters: 같은 cid 반복 오판 묶음', async () => {
    const { computeWeakConceptClusters } = await import(ENGINE);
    const stats = {
        'subjA_st_1': { j: 3, w: 2, cid: 'L100', t: '진술A', streak: 0 },
        'subjA_st_2': { j: 3, w: 1, cid: 'L100', t: '진술B', streak: 0 },
        'subjA_st_3': { j: 2, w: 1, cid: 'L100', t: '진술C', streak: 0 },
        'subjA_st_4': { j: 2, w: 1, cid: 'L200', t: '다른 구간', streak: 0 }, // 단독 → 클러스터 아님
    };
    const ranges = { subjA: [[100, '1. 정의'], [200, '2. 분류']] };
    const out = computeWeakConceptClusters(stats, ranges);
    assert.equal(out.length, 1);
    assert.equal(out[0].cid, 'L100');
    assert.equal(out[0].count, 3);
    assert.equal(out[0].wrongs, 4);
    assert.equal(out[0].chapter, '1. 정의');
});

test('computePaceProjection: 페이스 부족 → behind + 필요량', async () => {
    const { computePaceProjection } = await import(ENGINE);
    const calendar = {}; // 최근 14일 학습 없음 → pace 0
    const out = computePaceProjection({ calendar, totalCards: 1000, memorized: 100, dday: 30 });
    assert.equal(out.verdict, 'behind');
    assert.equal(out.neededPerDay, 30); // 900/30
    assert.ok(out.projectedCoverage < 100);
});

test('computePaceProjection: 충분한 페이스 → ahead/ontrack', async () => {
    const { computePaceProjection } = await import(ENGINE);
    const d = (offset) => {
        const dt = new Date(); dt.setDate(dt.getDate() - offset);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    // 매일 50장씩 14일 → pace 50/일, 남은 500장, D-30 → 1500 커버
    const calendar = {};
    for (let i = 0; i < 14; i++) calendar[d(i)] = { cards: 50, quizzes: 0, correct: 0 };
    const out = computePaceProjection({ calendar, totalCards: 1000, memorized: 500, dday: 30 });
    assert.equal(out.verdict, 'ahead');
    assert.equal(out.projectedCoverage, 100);
});

test('estimateUntaggedCauses: 숫자 정답→calc, 부정형 문항→concept, 나머지→memorize', async () => {
    const { estimateUntaggedCauses } = await import(ENGINE);
    const quizResults = {
        'q1': { solved: true, correct: false },
        'q2': { solved: true, correct: false },
        'q3': { solved: true, correct: false },
        'q4': { solved: true, correct: true },  // 정답은 제외
    };
    const resolveQuiz = (id) => ({
        q1: { quiz: { answer: '30일', question: '변경 신고 기한은?' }, subjectId: 's' },
        q2: { quiz: { answer: '가', question: '옳지 않은 것은?' }, subjectId: 's' },
        q3: { quiz: { answer: '영업', question: '제조업의 구분은?' }, subjectId: 's' },
    })[id] || null;
    const out = estimateUntaggedCauses({ quizResults, wrongCauses: {}, resolveQuiz });
    assert.equal(out.estimated, 3);
    assert.equal(out.counts.calc, 1);
    assert.equal(out.counts.concept, 1);
    assert.equal(out.counts.memorize, 1);
});

test('estimateUntaggedCauses: 태깅된 항목은 추정에서 제외', async () => {
    const { estimateUntaggedCauses } = await import(ENGINE);
    const quizResults = { q1: { solved: true, correct: false } };
    const wrongCauses = { 'weak_quiz_q1': { cause: 'concept', ts: Date.now() } };
    const out = estimateUntaggedCauses({ quizResults, wrongCauses, resolveQuiz: () => null });
    assert.equal(out.estimated, 0);
});

test('D-16 computeMasteryLevels: 과목별 졸업 비율 → Lv 환산', async () => {
    const { computeMasteryLevels } = await import(ENGINE);
    const stats = {
        'law_st_aaa111': { j: 4, w: 0, streak: 5 },   // 졸업 (streak>=3)
        'law_st_bbb222': { j: 3, w: 1, streak: 3 },   // 졸업
        'law_st_ccc333': { j: 2, w: 1, streak: 0 },   // 미졸업
        'law_st_ddd444': { j: 0, w: 0, streak: 0 },   // j=0 → 집계 제외
        'chem_st_eee555': { j: 2, w: 0, streak: 4 },  // 졸업
        'chem_st_fff666': { j: 5, w: 2, streak: 0 },
        'chem_st_ccc777': { j: 1, w: 0, streak: 0 },
        'chem_st_ddd888': { j: 2, w: 1, streak: 0 },
        'chem_st_eaa999': { j: 3, w: 0, streak: 1 },
        'broken_sid': { j: 9, w: 0, streak: 9 },      // 과목 해석 불가 → 제외
    };
    const out = computeMasteryLevels(stats);
    // law: 3개 중 2개 졸업 = 67% → Lv.4
    assert.equal(out.law.total, 3);
    assert.equal(out.law.graduated, 2);
    assert.equal(out.law.percent, 67);
    assert.equal(out.law.level, 4);
    // chem: 5개 중 1개 졸업 = 20% → Lv.2
    assert.equal(out.chem.total, 5);
    assert.equal(out.chem.graduated, 1);
    assert.equal(out.chem.percent, 20);
    assert.equal(out.chem.level, 2);
    // 데이터 없음 → 빈 맵
    assert.deepEqual(computeMasteryLevels({}), {});
    assert.deepEqual(computeMasteryLevels(null), {});
});
