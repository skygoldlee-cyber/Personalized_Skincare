// src/questions.js
// 맞춤형화장품 조제관리사 문항 스키마 + 채점 유틸 (순수 로직, 렌더링 없음)
// 유형: 'single' 단일정답 5지선다 | 'combo' 합답형(ㄱㄴㄷ 조합) | 'short' 단답형(81~100번)
//
// 설계 원칙
//  - combo는 "정답 옵션"을 직접 신뢰하지 않고 진술(statement)의 truth로 도출/검증한다.
//    → 데이터 무결성(정답 오타 방지) + "어느 진술에서 틀렸는지" 진술 단위 피드백을 동시에 얻는다.
//  - 채점은 과목(1~4)별 집계까지 지원 → 총점 60% + 과목별 40% 과락 규칙을 그대로 반영.

/**
 * @typedef {Object} Statement           // combo 전용: ㄱ/ㄴ/ㄷ… 진술
 * @property {string} id                 // 'ㄱ','ㄴ',… (안정적 라벨)
 * @property {string} text
 * @property {boolean} truth             // 이 진술이 옳은가
 * @property {string} [explain]          // 왜 옳은/틀린지 (근거 조문·수치)
 *
 * @typedef {Object} Option              // 선택지
 * @property {string} id                 // '1'~'5'
 * @property {string} [text]             // single/short 없음. combo는 members로 대체
 * @property {string[]} [members]        // combo: 이 선지가 주장하는 옳은 진술 id 집합
 * @property {boolean} [correct]         // single 전용: 정답 여부
 *
 * @typedef {Object} Question
 * @property {string} id                 // 전역 유니크 (예: 'q-04-137')
 * @property {1|2|3|4} subject           // 과목 번호
 * @property {'single'|'combo'|'short'} type
 * @property {string} stem               // 문제 발문
 * @property {number} points             // 배점(과목 합이 100/250/250/400 되도록 배분)
 * @property {Statement[]} [statements]  // combo 전용
 * @property {Option[]} [options]        // single/combo
 * @property {string} [answer]           // single/combo 정답 옵션 id (combo는 도출값과 일치해야 함)
 * @property {string[]} [accept]         // short: 허용 정답 표기들
 * @property {string} [explain]          // 전체 해설(선택)
 * @property {number} [difficulty]       // 1~5
 * @property {string[]} [tags]
 * @property {string} [source]           // '제10회 기출 변형' 등
 */

const SUBJECT_MAX = { 1: 100, 2: 250, 3: 250, 4: 400 }; // 과목별 만점
const PASS_TOTAL = 0.60;  // 총점 60%
const PASS_SUBJECT = 0.40; // 과목별 40% (미만이면 과락)

/** 문자열 정규화(단답형 비교용): 공백 축약·대소문자·괄호주석 제거 */
function normalizeText(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')      // 모든 공백 제거
    .replace(/[()[\]{}]/g, ''); // 괄호류 제거
}

/** combo: 진술 truth로부터 정답 옵션 id를 도출. 정확히 하나면 그 id, 아니면 null */
function deriveComboAnswer(q) {
  const trueSet = new Set(q.statements.filter(s => s.truth).map(s => s.id));
  const eq = (arr) =>
    arr.length === trueSet.size && arr.every(id => trueSet.has(id));
  const hits = q.options.filter(o => eq(o.members || []));
  return hits.length === 1 ? hits[0].id : null;
}

/**
 * 문항 데이터 무결성 검사. 문제 없으면 [], 있으면 사유 문자열 배열 반환.
 * 출제/임포트 시점에 돌려서 정답 오타·조합 불일치를 잡는 용도.
 */
function validateQuestion(q) {
  const errs = [];
  if (!q.id) errs.push('id 없음');
  if (!SUBJECT_MAX[q.subject]) errs.push(`subject 값 이상: ${q.subject}`);
  if (typeof q.points !== 'number') errs.push('points 없음/비수치');

  if (q.type === 'single') {
    const correct = (q.options || []).filter(o => o.correct);
    if (correct.length !== 1) errs.push(`single 정답 개수 ${correct.length} (1이어야 함)`);
    if (q.answer && q.answer !== (correct[0] && correct[0].id))
      errs.push('single answer와 correct 옵션 불일치');
  } else if (q.type === 'combo') {
    if (!q.statements || q.statements.length < 2) errs.push('combo 진술 부족');
    const ids = new Set();
    (q.statements || []).forEach(s => {
      if (ids.has(s.id)) errs.push(`진술 id 중복: ${s.id}`);
      ids.add(s.id);
      (['truth'].every(k => k in s)) || errs.push(`진술 ${s.id} truth 누락`);
    });
    (q.options || []).forEach(o => (o.members || []).forEach(m => {
      if (!ids.has(m)) errs.push(`옵션 ${o.id}가 없는 진술 ${m} 참조`);
    }));
    const derived = deriveComboAnswer(q);
    if (!derived) errs.push('combo 정답 조합이 유일하지 않음 (진술 truth ↔ 옵션 members 재검토)');
    else if (q.answer && q.answer !== derived)
      errs.push(`combo answer(${q.answer}) ≠ 도출값(${derived})`);
  } else if (q.type === 'short') {
    if (!q.accept || !q.accept.length) errs.push('short accept 없음');
  } else {
    errs.push(`알 수 없는 type: ${q.type}`);
  }
  return errs;
}

/**
 * 한 문항 채점.
 * @param {Question} q
 * @param {string} response  single/combo=옵션 id, short=입력 문자열
 * @returns {{correct:boolean, earned:number, max:number, correctAnswer:string,
 *            perStatement?:{id:string,truth:boolean,explain?:string}[]}}
 */
function gradeAnswer(q, response) {
  const max = q.points || 0;
  let correct = false;
  let correctAnswer = q.answer || '';
  let perStatement;

  if (q.type === 'single') {
    const key = (q.options.find(o => o.correct) || {}).id;
    correctAnswer = key;
    correct = response === key;
  } else if (q.type === 'combo') {
    correctAnswer = deriveComboAnswer(q) || q.answer || '';
    correct = response === correctAnswer;
    // 정오답과 무관하게 진술 단위 피드백 제공(오답노트/해설용)
    perStatement = q.statements.map(s => ({ id: s.id, truth: s.truth, explain: s.explain }));
  } else if (q.type === 'short') {
    const target = new Set(q.accept.map(normalizeText));
    correct = target.has(normalizeText(response));
    correctAnswer = q.accept[0];
  }
  return { correct, earned: correct ? max : 0, max, correctAnswer, perStatement };
}

/**
 * 모의고사 채점: 과목별 집계 + 합격 판정.
 * @param {Question[]} questions
 * @param {Record<string,string>} responses  { [questionId]: response }
 */
function scoreExam(questions, responses) {
  const bySubject = { 1: { earned: 0, max: 0 }, 2: { earned: 0, max: 0 },
                      3: { earned: 0, max: 0 }, 4: { earned: 0, max: 0 } };
  let totalEarned = 0, totalMax = 0;
  const details = [];

  for (const q of questions) {
    const r = gradeAnswer(q, responses[q.id]);
    bySubject[q.subject].earned += r.earned;
    bySubject[q.subject].max += r.max;
    totalEarned += r.earned;
    totalMax += r.max;
    details.push({ id: q.id, subject: q.subject, ...r });
  }

  let subjectPass = true;
  for (const s of [1, 2, 3, 4]) {
    const sub = bySubject[s];
    sub.pct = sub.max ? sub.earned / sub.max : 0;
    sub.pass = sub.pct >= PASS_SUBJECT;      // 과목별 40%
    if (!sub.pass) subjectPass = false;      // 하나라도 미달 → 과락
  }
  const totalPct = totalMax ? totalEarned / totalMax : 0;
  const passed = totalPct >= PASS_TOTAL && subjectPass; // 총점 60% + 과락 없음

  return { totalEarned, totalMax, totalPct, bySubject, subjectPass, passed, details };
}

// ── 예시 데이터 (구조 참고용 — 내용/수치는 식약처 가이드로 반드시 검증) ─────────────
const SAMPLE_QUESTIONS = [
  {
    id: 'q-01-001', subject: 1, type: 'single', points: 4,
    stem: '화장품법상 영업의 종류에 해당하지 않는 것은?',
    options: [
      { id: '1', text: '화장품제조업' },
      { id: '2', text: '화장품책임판매업' },
      { id: '3', text: '맞춤형화장품판매업' },
      { id: '4', text: '화장품수출대행업', correct: true },
      { id: '5', text: '(정답 아님, 예시용 보기)' },
    ],
    answer: '4',
    explain: '화장품법상 영업은 제조업·책임판매업·맞춤형화장품판매업 3종. (예시)',
  },
  {
    id: 'q-04-137', subject: 4, type: 'combo', points: 8,
    stem: '맞춤형화장품 혼합·소분에 관한 설명으로 옳은 것을 모두 고른 것은?',
    statements: [
      { id: 'ㄱ', text: '(옳은 진술 예시)', truth: true,  explain: '근거: … (예시)' },
      { id: 'ㄴ', text: '(틀린 진술 예시)', truth: false, explain: '실제로는 … (예시)' },
      { id: 'ㄷ', text: '(옳은 진술 예시)', truth: true,  explain: '근거: … (예시)' },
      { id: 'ㄹ', text: '(틀린 진술 예시)', truth: false, explain: '실제로는 … (예시)' },
    ],
    options: [
      { id: '1', members: ['ㄱ', 'ㄴ'] },
      { id: '2', members: ['ㄱ', 'ㄷ'] },       // ← 도출 정답
      { id: '3', members: ['ㄴ', 'ㄷ', 'ㄹ'] },
      { id: '4', members: ['ㄱ', 'ㄷ', 'ㄹ'] },
      { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] },
    ],
    // answer는 생략 가능(도출됨). 넣으면 validateQuestion이 일치 검증.
    answer: '2',
  },
  {
    id: 'q-04-201', subject: 4, type: 'short', points: 12.5,
    stem: '천연보습인자(NMF)의 구성 성분 중 가장 큰 비중을 차지하는 물질은?',
    accept: ['아미노산', 'amino acid', 'aminoacid'],
    explain: 'NMF의 약 40%가 아미노산. (예시 — 수치 검증 필요)',
  },
];

export {
  SUBJECT_MAX, PASS_TOTAL, PASS_SUBJECT,
  normalizeText, deriveComboAnswer, validateQuestion,
  gradeAnswer, scoreExam, SAMPLE_QUESTIONS,
};
