// tests/fixtures/analysis-seed.js — 맞춤학습(analysis-view) E2E 시드 팩토리 (SPEC ROAD-Q8)
// @spec AN-01,AN-02,AN-03,AN-04,AN-05,AN-08
//
// E2E는 빈 localStorage에서 시작하므로 진단 카드가 의미 있게 렌더되려면
// 학습 이력이 필요하다. 아래 레코드 형태는 실제 저장 경로와 동일해야 한다:
//   state.js loadProgress              — quiz_results·fc_weak·fc_memorized·quiz_wrong_causes
//   exam-simulator.js saveExamResultToHistory — sim_results_history {date,examId,rate,subjectRates}
//   statement-tracker.js               — statement_stats {j,w,lw,t,truth,cid,last,streak}
//   spaced-repetition.js               — fc_spaced_repetition {nextReview:'YYYY-MM-DD'}
//   study-tracker.js                   — study_calendar {cards,quizzes,correct,h}·study_goals·exam_date
//   recommendations.js                 — actual_exam_result {passed,score,expectedAtReport}
//   pro-upgrade.js                     — pro_notice_seen (Pro 기능 1회 안내 스킵용)
// 진도 키는 모두 시험 네임스페이스(`${examId}:` 접두사 — exam-context.js scopedKey).
// 날짜는 모두 호출 시점 기준 상대일 — 주간 비교·D-day·최근 7일 집계가
// "오늘"을 기준으로 계산되므로 고정 날짜를 박으면 시간이 지날수록 깨진다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DAY_MS = 86400000;
// Playwright가 픽스처를 CJS로 로드해 import.meta 사용 불가 — 저장소 루트가 cwd다.
const _ROOT = process.cwd();

/** 로컬 YYYY-MM-DD — utils.js localDateKey와 동일 규칙. offset은 과거 방향(양수=과거) */
function _day(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 분석 뷰 진입 공통 부트 키 — 첫 방문 분기(시험 선택·온보딩)와
 * Pro 안내 모달(personal_analysis — feature-plan.json 'pro')을 스킵한다.
 * @param {string} [examId]
 * @returns {Object<string,string>} localStorage 키→값 (addInitScript 주입용)
 */
export function analysisBootKeys(examId = 'cosmetic') {
    return {
        'current_exam': examId,
        'onboarding_seen_v1': '1',
        [`${examId}:onboarding_seen_v1`]: '1',
        [`${examId}:pro_notice_seen`]: JSON.stringify({ personal_analysis: '2026-01-01T00:00:00.000Z' })
    };
}

/**
 * 맞춤학습 진단이 활성화되는 "충분한 이력" 시드.
 * 의도된 분석 결과(결정론적):
 *   - 퀴즈 25문 — 표본 충족(AN-04), manufacturing 3/8=38% 최저
 *   - 오답 원인 3건(최근 7일 내) — 암기·계산·법령혼동 각 1건
 *   - 취약 진술 4건 — 법령 cid L350 클러스터 2개(개념 구간 경고), 졸업 진술 1개 제외
 *   - 복습 대기 진술 2개 (nextReview ≤ 오늘)
 *   - 모의고사 4회 52→68 상승 — 예상 점수·레이더·성적 추이·합격 진단 활성화
 *   - 실제 결과 보고(65점, 보고 시 추정 55점) → 보정 +10점 → 예상 64~76점
 *   - 학습 캘린더 7일 — 저녁 시간대 집중·전주 대비 정답률 상승
 *   - 시험일 D-30, 일일 목표 카드 20/퀴즈 10
 * @param {string} [examId]
 * @returns {Object<string,string>} localStorage 키→값
 */
export function buildAnalysisSeed(examId = 'cosmetic') {
    const P = (k) => `${examId}:${k}`;
    const ts = Date.now();
    const seed = {};

    // 퀴즈 이력 — id 문법 `${subj}_quiz_<hash>` (textbook-parser.js stableId와 동형)
    const quiz = {};
    let qn = 0;
    const answer = (subj, total, correct) => {
        for (let i = 0; i < total; i++) {
            quiz[`${subj}_quiz_e2e${String(++qn).padStart(3, '0')}`] = { solved: true, correct: i < correct };
        }
    };
    answer('law', 8, 6);            // 75%
    answer('manufacturing', 8, 3);  // 38% — 퀴즈 정답률 최저 과목
    answer('safety', 5, 4);         // 80%
    answer('understanding', 4, 3);  // 75%
    seed[P('quiz_results')] = JSON.stringify(quiz);   // 총 25문 — 퀴즈 표본 충족

    // 헷갈린 카드/오답 — `weak_quiz_*`·`<subj>_card_N` ID 문법 (weak-items.js)
    seed[P('fc_weak')] = JSON.stringify([
        'law_card_5', 'law_card_9', 'manufacturing_card_12',
        'weak_quiz_manufacturing_quiz_e2e010'
    ]);
    seed[P('fc_memorized')] = JSON.stringify([
        'law_card_1', 'law_card_2', 'law_card_3', 'understanding_card_4'
    ]);

    // 오답 원인 자가 태깅 — 최근 7일 안의 ts (computeWrongCauseSummary 윈도우)
    seed[P('quiz_wrong_causes')] = JSON.stringify({
        'weak_quiz_manufacturing_quiz_e2e010': { cause: 'calc',         ts: ts - DAY_MS,     subjectId: 'manufacturing' },
        'weak_quiz_law_quiz_e2e007':           { cause: 'memorize',     ts: ts - 2 * DAY_MS, subjectId: 'law' },
        'weak_quiz_law_quiz_e2e008':           { cause: 'lawConfusion', ts: ts - 3 * DAY_MS, subjectId: 'law' }
    });

    // 진술 오판 — law의 같은 cid(L350) 2건은 "개념 구간 반복 오판" 클러스터를 만든다.
    // cid는 CHAPTER_RANGES 라인 → L350: law '2. 화장품의 정의', L2209: manufacturing
    // '1. 사용제한 원료의 종류', L422: safety '1. 위생 기준 및 상태'.
    seed[P('statement_stats')] = JSON.stringify({
        'law_st_e2e01':            { j: 5, w: 4, lw: _day(1), t: '맞춤형화장품 조제관리사는 교육을 이수해야 한다', truth: true,  cid: 'L350',  last: false, streak: 0 },
        'law_st_e2e02':            { j: 3, w: 2, lw: _day(0), t: '화장품은 피부·모발을 청결·미화하기 위한 물품이다', truth: true,  cid: 'L350',  last: true,  streak: 0 },
        'law_st_e2e03':            { j: 6, w: 1, lw: null,    t: '졸업된 진술 — 취약 목록에 나타나면 안 된다',     truth: false, cid: 'L1200', last: true,  streak: 3 },
        'manufacturing_st_e2e01':  { j: 4, w: 3, lw: _day(0), t: '사용제한 원료는 함량 기준을 초과할 수 없다',      truth: true,  cid: 'L2209', last: false, streak: 0 },
        'safety_st_e2e01':         { j: 2, w: 1, lw: _day(2), t: '작업장은 청결한 위생 상태를 유지해야 한다',      truth: false, cid: 'L422',  last: false, streak: 0 }
    });

    // SM-2 스케줄 — nextReview ≤ 오늘인 진술 2개 → '오늘 복습 대기 2개'
    seed[P('fc_spaced_repetition')] = JSON.stringify({
        'law_st_e2e01':           { repetition: 1, easiness: 2.3, nextReview: _day(1), lastReview: _day(2) },
        'manufacturing_st_e2e01': { repetition: 2, easiness: 2.5, nextReview: _day(0), lastReview: _day(3) },
        'law_card_5':             { repetition: 1, easiness: 2.5, nextReview: _day(1), lastReview: _day(4) }
    });

    // 모의고사 이력 — 상승 추세 4회 (52→68). 최근 회차 subjectRates의 최저는
    // manufacturing 50% → '최근 모의고사 최저 과목' 보강 추천.
    seed[P('sim_results_history')] = JSON.stringify([
        { date: _day(21), examId: 'integrated', rate: 52, subjectRates: { law: 60, manufacturing: 40, safety: 55, understanding: 50 } },
        { date: _day(14), examId: 'integrated', rate: 58, subjectRates: { law: 65, manufacturing: 45, safety: 60, understanding: 55 } },
        { date: _day(7),  examId: 'integrated', rate: 63, subjectRates: { law: 70, manufacturing: 48, safety: 65, understanding: 60 } },
        { date: _day(1),  examId: 'integrated', rate: 68, subjectRates: { law: 75, manufacturing: 50, safety: 70, understanding: 65 } }
    ]);

    // 실제 시험 결과 자가 보고 — 예상치 대비 +10점 편향 → 복합 추정에 보정 적용
    seed[P('actual_exam_result')] = JSON.stringify({
        passed: true, score: 65, expectedAtReport: 55,
        reportedAt: new Date(ts - 5 * DAY_MS).toISOString(), examId
    });

    // 학습 캘린더 — 이번 주 4일(정답률 78%)·지난 주 3일(47%) → +31%p 상승.
    // 활동 일수≥4·이벤트≥8 요건 충족 + h 버킷 전부 저녁대 → '저녁 (18~22시)' 집중 패턴.
    seed[P('study_calendar')] = JSON.stringify({
        [_day(0)]:  { cards: 12, quizzes: 8, correct: 6, h: { '21': 3 } },
        [_day(1)]:  { cards: 8,  quizzes: 5, correct: 4, h: { '21': 2 } },
        [_day(2)]:  { cards: 10, quizzes: 6, correct: 5, h: { '22': 2 } },
        [_day(4)]:  { cards: 6,  quizzes: 4, correct: 3, h: { '20': 1 } },
        [_day(8)]:  { cards: 5,  quizzes: 6, correct: 3, h: { '19': 1 } },
        [_day(10)]: { cards: 4,  quizzes: 4, correct: 2 },
        [_day(12)]: { cards: 3,  quizzes: 5, correct: 2 }
    });

    // 오늘 목표 — 카드 12/20·퀴즈 8/10 → 달성률 70%
    seed[P('study_goals')] = JSON.stringify({ dailyCards: 20, dailyQuizzes: 10, weeklyStudyDays: 5 });

    // 시험일 — 오늘+30일 → 'D-30'
    seed[P('exam_date')] = _day(-30);

    // 지식DB 갱신 알림 억제 — 시드 이력(quiz_results 등)이 app-shell.js
    // RETURNING_USER_KEYS를 채우면 "원료 DB 갱신" 모달이 떠서 클릭을 가로막는다.
    // 확인 마커를 현재 레지스트리의 version:contentHash로 맞춘다 (빌드마다 해시가
    // 바뀌므로 파일에서 동적 추출 — 하드코딩하면 콘텐츠 갱신 시 깨진다).
    const knowledge = _knowledgeNoticeKey(examId);
    if (knowledge) {
        seed[P('ingredients_db_notified')] = knowledge.notifyKey;
        seed[P('ingredients_hash')] = knowledge.hash;
    }

    return seed;
}

/**
 * data/exams/<examId>/registry.js에서 지식DB(ingredients) version·contentHash 추출.
 * @returns {{notifyKey:string, hash:string}|null}
 */
function _knowledgeNoticeKey(examId) {
    try {
        const reg = readFileSync(join(_ROOT, 'data', 'exams', examId, 'registry.js'), 'utf8');
        const block = reg.match(/"ingredients"\s*:\s*\{[\s\S]*?"contentHash"\s*:\s*"([0-9a-f]+)"[\s\S]*?"version"\s*:\s*"([^"]+)"/);
        if (!block) return null;
        const hash = block[1], ver = block[2];
        return { notifyKey: `${ver || 'data'}:${hash}`, hash };
    } catch (e) {
        return null; // 지식DB 없는 시험 — 알림 경로 자체가 미발화
    }
}
