// src/questions.js
// 맞춤형화장품 조제관리사 문항 스키마 + 채점 유틸 (순수 로직, 렌더링 없음)
// 유형: 'single' 단일정답 5지선다 | 'combo' 합답형(ㄱㄴㄷ 조합) | 'short' 단답형(81~100번) | 'ox' 진위형
//
// 설계 원칙
//  - combo는 "정답 옵션"을 직접 신뢰하지 않고 진술(statement)의 truth로 도출/검증한다.
//    → 데이터 무결성(정답 오타 방지) + "어느 진술에서 틀렸는지" 진술 단위 피드백을 동시에 얻는다.
//  - 진술은 문항 내부 데이터가 아니라 독립 추적 가능한 학습 원자다 (docs/dev/COMBO_STUDY_STRATEGY.md §2-①③).
//    sid(전역 안정 ID)로 오답 통계·SM-2 큐를 진술 단위로 누적하고,
//    conceptId로 "신고 vs 등록" 같은 혼동쌍을 묶어 대조 학습에 쓴다.
//  - single 옵션의 truth는 "발문의 정답 여부"(correct)와 무관한 명제 자체의 참/거짓.
//    → "옳지 않은 것은?" 문항도 보기를 그대로 O/X 드릴로 펼칠 수 있다 (전략 §4-①).
//  - 채점은 과목(1~4)별 집계까지 지원 → 총점 60% + 과목별 40% 과락 규칙을 그대로 반영.

/**
 * @typedef {Object} Statement           // combo 전용: ㄱ/ㄴ/ㄷ… 진술
 * @property {string} id                 // 'ㄱ','ㄴ',… (문항 내 라벨)
 * @property {string} [sid]              // 전역 안정 ID — 오답 통계·간격반복 큐의 키
 * @property {string} [conceptId]        // 혼동쌍·관련 진술 그룹 (예: '신고주체', '배합한도')
 * @property {string} text
 * @property {boolean} truth             // 이 진술이 옳은가
 * @property {string} [explain]          // 왜 옳은/틀린지 (근거 조문·수치)
 *
 * @typedef {Object} Option              // 선택지
 * @property {string} id                 // '1'~'5'
 * @property {string} [text]             // single 전용. combo는 members로 대체
 * @property {string[]} [members]        // combo: 이 선지가 주장하는 옳은 진술 id 집합
 * @property {boolean} [correct]         // single 전용: 발문의 정답 여부
 * @property {boolean} [truth]           // single 전용: 명제 자체의 참/거짓 — O/X 드릴 펼치기용
 *                                       //   ("옳지 않은 것은?"의 오답 보기들은 truth:true가 됨)
 * @property {string} [explain]          // 선지별 해설
 *
 * @typedef {Object} Question
 * @property {string} id                 // 전역 유니크 (예: 'q-04-137')
 * @property {1|2|3|4} subject           // 과목 번호
 * @property {'single'|'combo'|'short'|'ox'} type
 * @property {string} stem               // 문제 발문
 * @property {string} [citation]         // combo 필수: 출처·인용 — 문제 서두(stem 앞)에 표기
 * @property {number} points             // 배점(과목 합이 100/250/250/400 되도록 배분)
 * @property {Statement[]} [statements]  // combo 전용
 * @property {Option[]} [options]        // single/combo
 * @property {string} [answer]           // single/combo 정답 옵션 id (combo는 도출값과 일치해야 함)
 * @property {string[]} [accept]         // short: 허용 정답 표기들
 * @property {string} [statement]        // ox 전용: 판정 대상 진술(선지 텍스트)
 * @property {boolean} [truth]           // ox 전용: 진술의 참/거짓
 * @property {string} [context]          // ox 전용: 발문 맥락 (fact=정제된 주제, answer=원 발문)
 * @property {'fact'|'answer'} [mode]    // ox 전용: 'fact'=내용 진위 판정 / 'answer'=정답 여부 판정
 * @property {string} [sid]              // ox/공통: 진술 안정 ID — 오답·SM-2 큐 키
 * @property {string} [derivedFrom]      // ox 전용: 원본 문항·선지 역추적 (예: 'subject4_q1#4')
 * @property {string} [explain]          // 전체 해설(선택)
 * @property {number} [difficulty]       // 1~5
 * @property {string[]} [tags]           // STANDARD_TAGS 어휘 권장
 * @property {string} [source]           // '제10회 기출 변형' 등
 */

const SUBJECT_MAX = { 1: 100, 2: 250, 3: 250, 4: 400 }; // 과목별 만점
const PASS_TOTAL = 0.60;  // 총점 60%
const PASS_SUBJECT = 0.40; // 과목별 40% (미만이면 과락)

/** 태그 표준 어휘 — "숫자·기준 카드 덱" 등 주제별 자동 필터용 (학습전략 §2-④) */
const STANDARD_TAGS = ['수치', '한도', '기한', '금지원료', '처분기준', '구성비', '절차', '정의'];

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
 * combo 오답 조합 자동 생성: truthIds 집합과 다른 무작위 부분집합으로 count개 옵션 구성.
 * 반환값을 q.options에 넣기 전 validateQuestion으로 정답 유일성을 재확인할 것.
 * (진술이 적어 조합이 부족하면 count 미만으로 반환될 수 있음)
 */
function generateComboOptions(allIds, truthIds, { count = 5, rng = Math.random, banFull = false } = {}) {
  const truthSet = new Set(truthIds);
  const eq = (arr) => arr.length === truthSet.size && arr.every(id => truthSet.has(id));
  const seen = new Set([[...truthIds].sort().join(',')]);
  // 진술 라벨(ㄱㄴㄷㄹ…)은 유니코드 연속 코드포인트 — 오름차순 정렬이 곧 가나다순.
  // 실제 시험 관례상 옵션 멤버는 항상 라벨 순서로 표기한다.
  const byLabel = (a, b) => allIds.indexOf(a) - allIds.indexOf(b);
  const options = [{ id: '1', members: [...truthIds].sort(byLabel) }];

  let guard = 0;
  while (options.length < count && guard++ < 500) {
    const size = 1 + Math.floor(rng() * allIds.length);
    // banFull: 정답이 전체 집합이 아닐 때 "모두 고르기" 오지를 제한 (패턴 단조로움 방지)
    if (banFull && size === allIds.length) continue;
    const members = [...allIds].sort(() => rng() - 0.5).slice(0, size).sort(byLabel);
    const key = members.join(',');
    if (seen.has(key) || eq(members)) continue;
    seen.add(key);
    options.push({ id: String(options.length + 1), members });
  }
  // 정답 옵션 위치를 섞고 id를 1~count로 재부여
  return options
    .map(o => ({ o, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((x, i) => ({ id: String(i + 1), members: x.o.members }));
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
    // 저작 규칙: 합답형은 출처·인용을 문제 서두에 명기해야 한다
    if (!q.citation || !String(q.citation).trim()) errs.push('combo citation 없음 — 문제 서두 출처·인용 명기 필수');
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
  } else if (q.type === 'ox') {
    if (typeof q.statement !== 'string' || !q.statement) errs.push('ox statement 없음');
    if (typeof q.truth !== 'boolean') errs.push('ox truth 없음/비불리언');
  } else {
    errs.push(`알 수 없는 type: ${q.type}`);
  }
  return errs;
}

/**
 * 한 문항 채점.
 * @param {Question} q
 * @param {string|{optionId:string, judgments?:Object<string,boolean>}} response
 *   single/combo = 옵션 id (또는 2단계 응시용 {optionId, judgments}),
 *   short = 입력 문자열, ox = 'O'|'X'|boolean
 * @returns {{correct:boolean, earned:number, max:number, correctAnswer:string,
 *            perStatement?:{id:string,sid?:string,truth:boolean,
 *                           userJudged:boolean|null,judgedCorrect:boolean|null,
 *                           explain?:string}[]}}
 */
function gradeAnswer(q, response) {
  const max = q.points || 0;
  let correct = false;
  let correctAnswer = q.answer || '';
  let perStatement;

  // 2단계 응시 모드: response가 객체이면 optionId + 진술별 판정(judgments)을 함께 받는다
  const isObj = response !== null && typeof response === 'object';
  const optId = isObj ? response.optionId : response;
  const judgments = isObj ? (response.judgments || null) : null;

  if (q.type === 'single') {
    const key = (q.options.find(o => o.correct) || {}).id;
    correctAnswer = key;
    correct = optId === key;
  } else if (q.type === 'combo') {
    correctAnswer = deriveComboAnswer(q) || q.answer || '';
    correct = optId === correctAnswer;
    // 정오답과 무관하게 진술 단위 피드백 제공(오답노트/해설용).
    // 사용자가 고른 옵션의 members = "사용자가 참이라 판정한 진술 집합"이므로
    // 명시 판정(judgments)이 없어도 진술별 오판을 자동 유도할 수 있다.
    const selected = new Set(
      ((q.options || []).find(o => o.id === optId) || {}).members || []
    );
    const hasJudgmentSource = (optId != null && optId !== '') || judgments;
    perStatement = q.statements.map(s => {
      const userJudged = !hasJudgmentSource ? null
        : (judgments && s.id in judgments) ? !!judgments[s.id]
        : selected.has(s.id);
      return {
        id: s.id,
        sid: s.sid,
        conceptId: s.conceptId,
        text: s.text,
        truth: s.truth,
        userJudged,
        judgedCorrect: userJudged === null ? null : userJudged === s.truth,
        explain: s.explain,
      };
    });
  } else if (q.type === 'ox') {
    correctAnswer = q.truth ? 'O' : 'X';
    const r = typeof response === 'boolean' ? (response ? 'O' : 'X')
      : String(response || '').trim().toUpperCase();
    correct = r === correctAnswer;
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
 * @param {Record<string,string|Object>} responses  { [questionId]: response }
 */
function scoreExam(questions, responses) {
  const bySubject = {};
  let totalEarned = 0, totalMax = 0;
  const details = [];

  for (const q of questions) {
    const r = gradeAnswer(q, responses[q.id]);
    const bucket = bySubject[q.subject] || (bySubject[q.subject] = { earned: 0, max: 0 });
    bucket.earned += r.earned;
    bucket.max += r.max;
    totalEarned += r.earned;
    totalMax += r.max;
    details.push({ id: q.id, subject: q.subject, ...r });
  }

  let subjectPass = true;
  for (const s of Object.keys(bySubject)) {
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
      // "옳지 않은 것은?"형 — correct 보기(4번)만 거짓 명제, 나머지는 참 명제.
      // truth가 있으면 이 문항의 보기 5개를 그대로 O/X 드릴로 펼칠 수 있다.
      { id: '1', text: '화장품제조업', truth: true },
      { id: '2', text: '화장품책임판매업', truth: true },
      { id: '3', text: '맞춤형화장품판매업', truth: true },
      { id: '4', text: '화장품수출대행업', correct: true, truth: false,
        explain: '법정 영업 3종에 없음' },
      { id: '5', text: '화장품판매업', truth: false,
        explain: "'판매업'이라는 명칭의 영업은 없음" },
    ],
    answer: '4',
    tags: ['정의'],
    explain: '화장품법상 영업은 제조업·책임판매업·맞춤형화장품판매업 3종. (예시)',
  },
  {
    id: 'q-04-137', subject: 4, type: 'combo', points: 8,
    citation: '📖 화장품법 제3조의2 (예시 출처)',
    stem: '맞춤형화장품 혼합·소분에 관한 설명으로 옳은 것을 모두 고른 것은?',
    statements: [
      { id: 'ㄱ', sid: 'st-04-0001', conceptId: '혼합소분범위',
        text: '(옳은 진술 예시)', truth: true,  explain: '근거: … (예시)' },
      { id: 'ㄴ', sid: 'st-04-0002', conceptId: '신고주체',
        text: '(틀린 진술 예시)', truth: false, explain: '실제로는 … (예시)' },
      { id: 'ㄷ', sid: 'st-04-0003', conceptId: '혼합소분범위',
        text: '(옳은 진술 예시)', truth: true,  explain: '근거: … (예시)' },
      { id: 'ㄹ', sid: 'st-04-0004', conceptId: '신고주체',
        text: '(틀린 진술 예시)', truth: false, explain: '실제로는 … (예시)' },
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
    tags: ['절차'],
  },
  {
    id: 'q-04-137-ox2', subject: 4, type: 'ox', points: 2,
    stem: '다음 진술의 참/거짓을 판정하시오.',
    statement: '(q-04-137의 ㄴ 진술과 동일한 텍스트 — O/X 드릴 자동 생성 산출물)',
    truth: false,
    derivedFrom: 'q-04-137#ㄴ',
    explain: '실제로는 … (예시)',
    tags: ['절차'],
  },
  {
    id: 'q-04-201', subject: 4, type: 'short', points: 12.5,
    stem: '천연보습인자(NMF)의 구성 성분 중 가장 큰 비중을 차지하는 물질은?',
    accept: ['아미노산', 'amino acid', 'aminoacid'],
    explain: 'NMF의 약 40%가 아미노산. (예시 — 수치 검증 필요)',
    tags: ['구성비'],
  },
];

export {
  normalizeText, deriveComboAnswer, generateComboOptions, validateQuestion,
  gradeAnswer, scoreExam, SAMPLE_QUESTIONS,
};
