// src/analysis-engine.js — 맞춤학습(analysis-view) 심층 분석 순수 로직
// @spec AN-01,AN-02
//
// 모든 함수는 DOM 비의존·과목 무관 — 데이터를 주입받아 계산만 한다.
// 과목 키/단원명은 manifest·question_chapters·statement_stats에서 동적으로 해석하므로
// 과목 구성이 바뀌어도 코드 수정이 필요 없다.
//
// 데이터 소스:
//   quizResults      { quizId: {solved, correct} }
//   wrongCauses      { itemId: {cause, ts, subjectId} }  (사용자 태깅)
//   statementStats   { sid: {j,w,lw,t,truth,cid,last,streak} }  (드릴 판정 누적)
//   weakCards        Set<itemId>  (weak_sim_<exam>_qN / weak_quiz_<id> / <subj>_card_N)
//   questionChapters { "subjectN_qM": "단원명" }  (question_chapters.js)
//   chapterRanges    { subjKey: [[라인, "단원명"], ...] }  (CHAPTER_RANGES)

import { parseWeakSimId, subjectKeyFromItemId, WEAK_QUIZ_PREFIX } from './weak-items.js';
import { resolveLegacySubjectKey } from './exam-context.js';

/**
 * sid("law_st_ab12cd") → 과목 키 ("law").
 * 진술 sid는 `${subjKey}_st_${hash}` 형식 (build_combo_drills.js stableId).
 * @param {string} sid
 * @returns {string|null}
 */
export function subjectFromSid(sid) {
    const m = String(sid || '').match(/^(.+?)_st_[0-9a-f]+$/);
    return m ? m[1] : null;
}

/**
 * 진술 cid("L328") → 과목의 chapterRanges로 단원명 해석.
 * "q:..." 폴백 cid는 교재 라인이 아니므로 null.
 * @param {string|null} cid
 * @param {string|null} subjKey
 * @param {Object<string,Array<[number,string]>>} chapterRanges
 * @returns {string|null}
 */
export function chapterFromCid(cid, subjKey, chapterRanges) {
    const m = String(cid || '').match(/^L(\d+)$/);
    if (!m || !subjKey) return null;
    const ranges = chapterRanges && chapterRanges[subjKey];
    if (!Array.isArray(ranges) || !ranges.length) return null;
    const line = parseInt(m[1], 10);
    let cur = null;
    for (const [ln, title] of ranges) {
        if (line >= ln) cur = title; else break;
    }
    return cur;
}

/* =======================================================
   1) 단원별 취약 집계
   ======================================================= */

/**
 * 오답/오판 항목을 교재 단원별로 집계한다 (내부 버킷).
 * 해석 경로 (모두 실패 시 '기타' 묶음 없이 버림):
 *   - weak_sim_<exam>_q<N>  → questionChapters["<exam>_q<N>"]
 *   - weak_quiz_<id>·일반 퀴즈 id → resolveQuiz(id).quiz.category (로드된 과목만)
 *   - 진술 sid → cid(L####) → chapterRanges[과목] → 단원명
 */
function _aggregateChapterWrongs(p) {
    const buckets = new Map(); // `${subj}|${chapter}` → {subject, chapter, wrongs}
    const bump = (subj, chapter) => {
        if (!chapter) return;
        const key = `${subj || ''}|${chapter}`;
        const cur = buckets.get(key) || { subject: subj || '', chapter, wrongs: 0 };
        cur.wrongs++;
        buckets.set(key, cur);
    };

    // (a) 퀴즈 오답 → quiz.category
    const results = p.quizResults || {};
    Object.keys(results).forEach(id => {
        if (!results[id] || results[id].correct) return;
        const resolved = p.resolveQuiz ? p.resolveQuiz(id) : null;
        const subj = (resolved && resolved.subjectId) || subjectKeyFromItemId(id) || '';
        const chapter = (resolved && resolved.quiz && resolved.quiz.category)
            || (p.questionChapters && p.questionChapters[id]);
        bump(subj, chapter);
    });

    // (b) 약점 카드 — weak_sim_* 은 문제은행 문항 → questionChapters
    (p.weakCards ? [...p.weakCards] : []).forEach(id => {
        const sim = parseWeakSimId(id);
        if (!sim) return;
        const chapter = p.questionChapters && p.questionChapters[`${sim.examId}_q${sim.qNum}`];
        bump(subjectKeyFromItemId(id) || '', chapter);
    });

    // (c) 진술 오판 → cid → chapterRanges
    Object.entries(p.statementStats || {}).forEach(([sid, v]) => {
        if (!v || !(v.w > 0) || (v.streak || 0) >= 3) return; // 졸업 진술 제외 (WEAK_GRADUATE_STREAK)
        const subj = subjectFromSid(sid);
        bump(subj, chapterFromCid(v.cid, subj, p.chapterRanges));
    });
    return buckets;
}

/** 공통 파라미터 — computeChapterWeakness/computeSubjectWeakChapters 공용
 * @param {Object} p
 * @param {Object} p.quizResults state.quizResults (오답만 집계)
 * @param {Set<string>} p.weakCards state.weakCards
 * @param {Object} p.statementStats getAllStatementStats() 결과
 * @param {Object} p.questionChapters QUESTION_CHAPTERS 맵
 * @param {Object} p.chapterRanges CHAPTER_RANGES 맵
 * @param {(id:string)=>{quiz:object,subjectId:string}|null} p.resolveQuiz weak-items.resolveWrongQuiz
 * @param {(key:string)=>string} [p.subjectName] 과목키→표시명 (없으면 키 그대로)
 */

/**
 * 오답 집계를 단원별 단일 랭킹으로 반환 (전 과목 혼합).
 * @param {Object} p 공통 파라미터 + p.limit
 * @returns {Array<{subject:string, chapter:string, wrongs:number}>} 오답 건수 내림차순
 */
export function computeChapterWeakness(p) {
    const name = p.subjectName || ((k) => k);
    const out = [..._aggregateChapterWrongs(p).values()].sort((a, b) => b.wrongs - a.wrongs);
    out.forEach(b => { b.subject = name(b.subject); });
    return typeof p.limit === 'number' ? out.slice(0, p.limit) : out;
}

/**
 * 오답 집계를 **과목별로 그룹화**해 반환 — 과락 평가가 과목 단위이므로
 * 각 과목의 최약 단원을 과목별로 보여준다 (어떤 과목이든 같은 구조).
 * @param {Object} p 공통 파라미터 + p.chaptersPerSubject(기본 2)
 * @returns {Array<{subject:string, subjectKey:string, totalWrongs:number,
 *   chapters:Array<{chapter:string, wrongs:number}>}>} 과목 총 오답 내림차순
 */
export function computeSubjectWeakChapters(p) {
    const name = p.subjectName || ((k) => k);
    const perSubj = p.chaptersPerSubject || 2;
    const bySubj = new Map(); // subjKey → {subject, subjectKey, totalWrongs, chapters}
    for (const b of _aggregateChapterWrongs(p).values()) {
        const cur = bySubj.get(b.subject) || { subject: name(b.subject), subjectKey: b.subject, totalWrongs: 0, chapters: [] };
        cur.totalWrongs += b.wrongs;
        cur.chapters.push({ chapter: b.chapter, wrongs: b.wrongs });
        bySubj.set(b.subject, cur);
    }
    const out = [...bySubj.values()];
    out.forEach(g => g.chapters.sort((a, b) => b.wrongs - a.wrongs).length = Math.min(g.chapters.length, perSubj));
    return out.sort((a, b) => b.totalWrongs - a.totalWrongs);
}

/* =======================================================
   2) 주간 성장 지표
   ======================================================= */

function _rangeStats(calendar, fromOffset, toOffset) {
    let quizzes = 0, correct = 0, cards = 0, days = 0;
    for (let i = fromOffset; i <= toOffset; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const e = calendar[key];
        if (!e) continue;
        if (e.cards > 0 || e.quizzes > 0) days++;
        quizzes += e.quizzes || 0;
        correct += e.correct || 0;
        cards += e.cards || 0;
    }
    return { quizzes, correct, cards, days, rate: quizzes > 0 ? Math.round((correct / quizzes) * 100) : null };
}

/**
 * 최근 7일 vs 그 이전 7일 학습량·정답률 비교.
 * @param {Object} calendar getStudyCalendar() 결과
 * @returns {{thisWeek:object, lastWeek:object, rateDelta:number|null, cardDelta:number}}
 *   rateDelta는 양쪽 모두 표본 있을 때만 (없으면 null)
 */
export function computeWeeklyGrowth(calendar) {
    const thisWeek = _rangeStats(calendar || {}, 0, 6);
    const lastWeek = _rangeStats(calendar || {}, 7, 13);
    return {
        thisWeek,
        lastWeek,
        rateDelta: (thisWeek.rate !== null && lastWeek.rate !== null) ? thisWeek.rate - lastWeek.rate : null,
        cardDelta: thisWeek.cards - lastWeek.cards
    };
}

/* =======================================================
   3) 합격 갭 분석
   ======================================================= */

/**
 * 예상 점수 → 합격선까지의 갭 + 최우선 보강 과목.
 * 우선순위: 최근 모의고사 subjectRates (과락선 미만 → 최저순) → 퀴즈 정답률 최저 과목.
 * @param {Object} p
 * @param {{expected:number}|null} p.estimate estimateExpectedScore 결과 (없으면 갭 계산 생략)
 * @param {Array} p.simHistory 모의고사 이력 (subjectRates 보유)
 * @param {Array<{key:string,name:string}>} p.subjects 과목 메타
 * @param {Object} p.counts 과목별 학습 카운트 (_getSubjCounts 결과)
 * @param {{passAverage:number,subjectFailBelow:number}} p.rules getExamRules()
 * @returns {{gap:number|null, passLine:number, weakest:{key:string,name:string,rate:number,reason:string}|null}|null}
 */
export function computePassGap(p) {
    const rules = p.rules || { passAverage: 60, subjectFailBelow: 40 };
    /** @type {{gap:number|null, passLine:number, weakest:{key:string,name:string,rate:number,reason:string}|null}} */
    const result = { gap: null, passLine: rules.passAverage, weakest: null };
    if (p.estimate && typeof p.estimate.expected === 'number') {
        result.gap = Math.max(0, rules.passAverage - p.estimate.expected);
    }

    // 최근 모의고사 과락·최저 과목 (레거시 subjectN 키는 현재 과목 키로 환산)
    const hist = Array.isArray(p.simHistory) ? p.simHistory : [];
    const last = hist.length ? hist[hist.length - 1] : null;
    if (last && last.subjectRates) {
        /** @type {{key:string, name:string, rate:number}|null} */
        let worst = null;
        for (const [k, rate] of Object.entries(last.subjectRates)) {
            if (rate === null || rate === undefined) continue;
            const key = k.startsWith('subject') ? resolveLegacySubjectKey(k) : k;
            const subj = (p.subjects || []).find(s => s.key === key);
            const name = subj ? subj.name : key;
            if (!worst || rate < worst.rate) worst = { key, name, rate };
        }
        if (worst) {
            result.weakest = {
                key: worst.key, name: worst.name, rate: worst.rate,
                reason: worst.rate < rules.subjectFailBelow
                    ? `과락선 ${rules.subjectFailBelow}점 미만`
                    : '최근 모의고사 최저 과목'
            };
        }
        return result;
    }

    // 모의고사 없음 → 퀴즈 정답률 최저 과목 (3문 이상)
    /** @type {{key:string, name:string, rate:number}|null} */
    let weakest = null;
    let weakestRate = 101;
    for (const s of (p.subjects || [])) {
        const sc = (p.counts || {})[s.key];
        if (sc && sc.quizSolved >= 3) {
            const rate = Math.round((sc.quizCorrect / sc.quizSolved) * 100);
            if (rate < weakestRate) { weakestRate = rate; weakest = { key: s.key, name: s.name, rate }; }
        }
    }
    if (weakest) result.weakest = { key: weakest.key, name: weakest.name, rate: weakest.rate, reason: '퀴즈 정답률 최저 과목' };
    return result;
}

/* =======================================================
   4) 개념 클러스터 — 같은 교재 구간의 반복 오판
   ======================================================= */

/**
 * 취약 진술을 cid(교재 구간)로 묶어 "같은 개념 구간" 오판 집중을 찾는다.
 * @param {Object} statementStats getAllStatementStats() 결과
 * @param {Object} chapterRanges CHAPTER_RANGES 맵 (단원명 표시용)
 * @param {number} [minSize] 클러스터로 볼 최소 오판 진술 수 (기본 2)
 * @returns {Array<{cid:string, subj:string, chapter:string|null, count:number, wrongs:number, sample:string}>}
 */
export function computeWeakConceptClusters(statementStats, chapterRanges, minSize = 2) {
    const groups = new Map(); // `${subj}|${cid}` → agg
    Object.entries(statementStats || {}).forEach(([sid, v]) => {
        if (!v || !(v.w > 0) || (v.streak || 0) >= 3) return;
        if (!v.cid || String(v.cid).startsWith('q:')) return; // 교재 라인 cid만 의미 있음
        const subj = subjectFromSid(sid) || '';
        const key = `${subj}|${v.cid}`;
        const cur = groups.get(key) || { cid: v.cid, subj, count: 0, wrongs: 0, sample: '' };
        cur.count++;
        cur.wrongs += v.w;
        if (!cur.sample && v.t) cur.sample = v.t;
        groups.set(key, cur);
    });
    return [...groups.values()]
        .filter(g => g.count >= minSize)
        .map(g => ({ ...g, chapter: chapterFromCid(g.cid, g.subj, chapterRanges) }))
        .sort((a, b) => (b.wrongs - a.wrongs) || (b.count - a.count));
}

/* =======================================================
   5) D-day 페이스 판정
   ======================================================= */

/**
 * 최근 학습 페이스로 시험일까지 예상 커버율을 계산한다.
 * @param {Object} p
 * @param {Object} p.calendar getStudyCalendar() 결과
 * @param {number} p.totalCards 전체 카드 수
 * @param {number} p.memorized 암기 완료 카드 수
 * @param {number|null} p.dday 시험까지 남은 일수
 * @param {number} [p.paceDays] 페이스 산정 기간 (기본 최근 14일)
 * @returns {{pacePerDay:number, projectedCoverage:number, neededPerDay:number|null, verdict:'ahead'|'behind'|'ontrack'}|null}
 */
export function computePaceProjection(p) {
    const { calendar, totalCards, memorized, dday } = p;
    if (dday === null || dday === undefined || dday <= 0 || !(totalCards > 0)) return null;
    const remaining = Math.max(0, totalCards - memorized);
    if (remaining === 0) {
        return { pacePerDay: 0, projectedCoverage: 100, neededPerDay: 0, verdict: 'ahead' };
    }
    const days = p.paceDays || 14;
    const stats = _rangeStats(calendar || {}, 0, days - 1);
    const pacePerDay = stats.cards / days;
    const projected = memorized + pacePerDay * dday;
    const projectedCoverage = Math.min(100, Math.round((projected / totalCards) * 100));
    const neededPerDay = Math.ceil(remaining / dday);
    const verdict = projectedCoverage >= 100 ? 'ahead'
        : (pacePerDay >= neededPerDay * 0.7 ? 'ontrack' : 'behind');
    return { pacePerDay: Math.round(pacePerDay * 10) / 10, projectedCoverage, neededPerDay, verdict };
}

/* =======================================================
   6) 오답 원인 자동 추정 (미태깅 오답 휴리스틱)
   ======================================================= */

/**
 * 태깅되지 않은 오답에 원인 추정값을 부여한다 (자가 태깅 보완용, 확정값 아님).
 * 휴리스틱:
 *   - 정답이 숫자/단위 → 'calc' (수치 문제)
 *   - 문항이 '아닌/않는/잘못된' 부정형 → 'concept' (개념 구별 요구)
 *   - 그 외 → 'memorize' (단순 기억)
 * @param {Object} p
 * @param {Object} p.quizResults state.quizResults
 * @param {Object} p.wrongCauses state.wrongCauses (태깅된 항목 제외용)
 * @param {(id:string)=>{quiz:object,subjectId:string}|null} p.resolveQuiz
 * @returns {{counts:Object, estimated:number}} 추정 건수 (WRONG_CAUSE_LABELS 키 기준)
 */
export function estimateUntaggedCauses(p) {
    const counts = { memorize: 0, concept: 0, calc: 0 };
    let estimated = 0;
    const tagged = new Set(Object.keys(p.wrongCauses || {}));
    Object.entries(p.quizResults || {}).forEach(([id, r]) => {
        if (!r || r.correct) return;
        const weakKey = id.startsWith(WEAK_QUIZ_PREFIX) || id.includes('_card_') ? id : WEAK_QUIZ_PREFIX + id;
        if (tagged.has(id) || tagged.has(weakKey)) return; // 사용자 태깅 존중
        const resolved = p.resolveQuiz ? p.resolveQuiz(id) : null;
        const q = resolved && resolved.quiz;
        if (!q) return;
        estimated++;
        const ans = String(q.answer ?? '');
        const text = String(q.question || '') + String(q.context || '');
        if (/^\d+(\.\d+)?\s*(%|ml|g|mg|배|회|일|개월|년|도|만원|원)?$/.test(ans.trim())) counts.calc++;
        else if (/(아닌|않는|틀린|잘못된|옳지)\s*(것|항목|설명)?/.test(text)) counts.concept++;
        else counts.memorize++;
    });
    return { counts, estimated };
}
