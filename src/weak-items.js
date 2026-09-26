// src/weak-items.js — 약점(오답) 항목 ID 문법과 해석 (DOM 비의존)
//
// weakCards / wrongCauses에 들어가는 항목 ID는 세 종류다:
//   - 플래시카드 ID 그대로:  <subj>_card_<n>
//   - 기출 퀴즈 오답:        weak_quiz_<quizId>
//   - 모의고사 오답:         weak_sim_<examId>_q<num>
//   - 모의고사 복수정답 오답: weak_sim_<subj>_combo_<hash>
// 접두사 규칙을 이 파일에 모아 quiz.js / exam-simulator.js / recommendations.js /
// state.js가 같은 문법을 공유한다.

import { examIdToSubjectId } from './exam-context.js';

export const WEAK_QUIZ_PREFIX = 'weak_quiz_';
export const WEAK_SIM_PREFIX = 'weak_sim_';

/**
 * 퀴즈 항목 ID → weakCards/wrongCauses에서 쓰는 약점 항목 키
 * (weak_* 접두사 또는 카드 ID는 그대로, 일반 퀴즈 ID는 weak_quiz_ 접두사)
 */
export function weakItemKey(quizId) {
    if (quizId.startsWith('weak_') || quizId.includes('_card_')) return quizId;
    return WEAK_QUIZ_PREFIX + quizId;
}

/* ---------- 콘텐츠 인덱스 캐시 ----------
   STUDY_DATA는 DataLoader.loadSubject로 과목이 점진 추가되므로,
   과목 객체의 참조 비교로 증분 무효화한다 (새 과목 로드·번들 교체 감지).
   호출마다 전 과목 선형 탐색하지 않도록 퀴즈·카드 ID 인덱스를 지연 구축. */
const _subjectRef = new Map();   // subjId → 마지막으로 색인한 과목 객체
let _quizIdx = null;             // quizId → { quiz, subjectId }
let _cardIdx = null;             // cardId → subjectId

function _studyData() {
    return (typeof window !== 'undefined' && window.STUDY_DATA) || null;
}

function _ensureIndexes() {
    const data = _studyData();
    if (!data) {
        _quizIdx = _cardIdx = null;
        _subjectRef.clear();
        return;
    }
    if (!_quizIdx) { _quizIdx = new Map(); _cardIdx = new Map(); }
    // 교체·제거된 과목의 인덱스 항목 정리
    for (const subjId of [..._subjectRef.keys()]) {
        if (data[subjId] === _subjectRef.get(subjId)) continue;
        for (const [id, v] of _quizIdx) { if (v.subjectId === subjId) _quizIdx.delete(id); }
        for (const [id, v] of _cardIdx) { if (v.subjectId === subjId) _cardIdx.delete(id); }
        _subjectRef.delete(subjId);
    }
    // 신규·교체 과목 색인
    for (const subjId of Object.keys(data)) {
        if (_subjectRef.get(subjId) === data[subjId]) continue;
        _subjectRef.set(subjId, data[subjId]);
        (data[subjId].quizzes || []).forEach(q => _quizIdx.set(q.id, { quiz: q, subjectId: subjId }));
        (data[subjId].cards || []).forEach(c => _cardIdx.set(c.id, { card: c, subjectId: subjId }));
    }
}

/**
 * weak_quiz_<origId> 또는 일반 퀴즈 ID로 원본 퀴즈 객체를 찾는다.
 * @returns {{quiz: object, subjectId: string}|null}
 */
export function resolveWrongQuiz(quizId) {
    const origId = quizId.startsWith(WEAK_QUIZ_PREFIX)
        ? quizId.substring(WEAK_QUIZ_PREFIX.length)
        : quizId;
    _ensureIndexes();
    return (_quizIdx && _quizIdx.get(origId)) || null;
}

/**
 * 카드 ID → 원본 카드 객체·과목 ID (인덱스 조회)
 * @returns {{card: object, subjectId: string}|null}
 */
export function resolveCard(cardId) {
    _ensureIndexes();
    return (_cardIdx && _cardIdx.get(cardId)) || null;
}

/** 카드 ID → 과목 ID (인덱스 조회, 없으면 null) */
export function cardSubjectOf(cardId) {
    const r = resolveCard(cardId);
    return r ? r.subjectId : null;
}

/**
 * weak_sim_<examId>_q<num> ID 파싱 — 복수정답형(combo) 등 다른 꼬리는 null.
 * @returns {{examId:string, qNum:number}|null}
 */
export function parseWeakSimId(itemId) {
    if (!itemId || !itemId.startsWith(WEAK_SIM_PREFIX)) return null;
    const parts = itemId.substring(WEAK_SIM_PREFIX.length).split('_q');
    if (parts.length !== 2) return null;
    const qNum = parseInt(parts[1], 10);
    return isNaN(qNum) ? null : { examId: parts[0], qNum };
}

/**
 * 약점 항목 ID → 해당 항목의 과목 ID (약점 집중 퀴즈는 과목이 섞일 수 있음)
 * @param {string} itemId
 * @param {string|null} fallbackSubj 해석 실패 시 대체 과목 (보통 현재 퀴즈 과목)
 */
export function subjectForWeakItem(itemId, fallbackSubj = null) {
    const sim = parseWeakSimId(itemId);
    if (sim) return examIdToSubjectId(sim.examId);
    const resolved = resolveWrongQuiz(itemId);
    if (resolved) return resolved.subjectId;
    return cardSubjectOf(itemId) || fallbackSubj;
}

/**
 * 카드/퀴즈 ID → 과목 키 추출.
 * weak_quiz_/weak_sim_ 접두사를 먼저 벗기고, 과목 키가 숫자·밑줄을 포함해도
 * 동작하도록 '<subj>_(card|quiz)_' 꼬리 패턴 기준으로 분리한다 (콘텐츠 교체에도 유효).
 */
export function subjectKeyFromItemId(id) {
    const clean = id.replace(/^weak_(quiz|sim)_/, '');
    const m = clean.match(/^(.+)_(?:card|quiz)_/);
    return m ? m[1] : null;
}
