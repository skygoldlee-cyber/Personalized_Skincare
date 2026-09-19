#!/usr/bin/env node
/* ============================================================
 * tools/build_combo_drills.js
 * ------------------------------------------------------------
 * data/exams/subjectN.*.js (choice 문항)를 합답형(combo) 드릴 문항으로 변환한다.
 * docs/dev/COMBO_STUDY_STRATEGY.md §2-①: single 문항의 각 보기를 진술 원자로 펼치고
 * truth(명제 참/거짓 또는 정답 여부)로 정답 조합을 도출한다.
 *
 * 변환 규칙
 *   mode 'fact'   — 명제형 선지(문장형): 진술 truth = 내용의 참/거짓
 *                   부정형 발문(옳지 않은 것은?)이면 정답 보기가 거짓 진술
 *                   → 발문은 "…으로 옳은 것을 모두 고른 것은?"으로 긍정 정규화
 *   mode 'answer' — 회상형·분류형 선지(고유명사·수치): truth = 정답 여부
 *                   → 발문 꼬리를 "…모두 고른 것은?"으로 변환 (극성 보존)
 *   mode 'blank'  — 단답형: 정답 + 과목 정답 풀 오답 추첨으로 진술 구성
 *                   다중 빈칸은 (A)만 1문항 생성 — 총량 1,000문(100/250/250/400) 유지
 *   '위 ①②③ 모두'류 메타 선지가 정답이면 원형 숫자 개수만큼 실질 선지를 참으로 처리
 *
 *   진술 explain은 중복 저장하지 않음(문항 explain으로 폴백) — 번들 크기 절감
 *   conceptId = explanation의 첫 교재 L#### (같은 구간 진술 = 개념 클러스터)
 *   id = stableId(문항 id) — 재생성 순서와 무관하게 안정
 *
 * 제외: ㄱㄴㄷ 조합형 발문, 참 진술 0개 그룹, 진술 2개 미만
 *
 * 입력 : data/exams/*.js (EXAM_DATA_subjectN)
 * 출력 : data/drills/combo_subjectN.js  →  var COMBO_DRILLS_subjectN = [...]
 *
 * 사용 : node tools/build_combo_drills.js [--dry-run]
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { stableId } = require('./build/id-factory.js');
const { inferTags } = require('./drill-utils.js');

const ROOT = path.resolve(__dirname, '..');
const EXAMS_DIR = path.join(ROOT, 'data', 'exams');
const OUT_DIR = path.join(ROOT, 'data', 'drills');
const MD_DIR = path.join(ROOT, 'content', '문제은행');
const DRY_RUN = process.argv.includes('--dry-run');

const AUTOGEN_HEADER = '// 자동 생성된 합답형 드릴 데이터입니다. 수정하지 마십시오. (tools/build_combo_drills.js)';

/* ---------- 발문 분류 (build_ox_drills.js와 동일 기준) ---------- */

const NEG_DESC_RE = /옳지 ?않은|맞지 않는|틀린|잘못된|올바르지 않은|적합하지 않은|바람직하지 않은|부적절한|적절하지 않은|맞는 것이 아닌|일치하지 않는|거리가 먼|다른 것은|다른 하나는|해당하지 않는|해당되지 않는/;
const DESC_RE = /설명|내용|사항|방법|특징|작용|관한|대한|서술|순서|나열/;
// 진짜 ㄱㄴㄷ 조합 발문만 제외 ("조합 향료", "성분과 함량의 조합" 등은 일반 객관식)
const COMBO_STEM_RE = /모두 고른|ㄱ\s*[.)]/;
const SELF_REF_RE = /[①②③④⑤⑥⑦⑧⑨⑩]/;
const ALL_OF_ABOVE_RE = /모두|전부/;
const SENT_END_RE = /(다|음|함|임|됨|까|나|요)\.?$/;
// 상호배타 메타 선지 — '모두' 정답 시 참에서 제외 (예: "개정은 없었다", "별도 조치 불필요")
const META_NEG_RE = /없었다|없음|불필요|해당 ?없|모르겠|알 수 없/;

function isPropositional(optText) {
  const t = String(optText || '').trim();
  return t.length >= 8 && SENT_END_RE.test(t);
}

/** fact 모드 맥락 정제: 판정 절을 떼고 주제만 남김 (build_ox_drills.js와 동일) */
function topicContext(stem) {
  const t = String(stem || '')
    .replace(/\s+/g, ' ')
    .replace(/^다음( 중)?\s*/, '')
    .replace(/(으로|로|중)?\s*(가장\s*)?(옳지 ?않은|옳은|맞지 않는|틀린|적절하지 않은|바람직하지 않은|부적절한|올바르지 않은|적합하지 않은|해당하지 않는|해당되지 않는|잘못된|맞는|해당하는|해당되는|아닌|다른|거리가 먼|일치하지 않는|맞도록 나열된|바르게 나열된)\s*것은\?.*$/u, '')
    .trim();
  return t.length >= 4 ? t : '';
}

/* ---------- 발문 변환 ---------- */

const STEM_RESULT = '것을 모두 고른 것은?';
const STEM_MATCH = '에 해당하는 것을 모두 고른 것은?';

/**
 * combo 발문 생성.
 * fact:   "{주제}으로 옳은 것을 모두 고른 것은?" (극성은 truth에 이미 반영 → 발문은 항상 긍정)
 * answer: 원 발문의 꼬리만 "모두 고른" 형태로 교체 (극성 보존 — 정답 집합과 일치).
 *         교체가 문법적으로 불확실한 꼬리(~하는가? 등)는 원 발문 유지 + 지시문 부기.
 *         발문 끝의 "(단, …)" 조건 주석은 떼어냈다가 변환 후 다시 붙인다.
 * 변환 실패 시 '' 반환 → 호출부에서 스킵·집계
 */
function comboStem(stem, mode) {
  const t = String(stem || '').replace(/\s+/g, ' ').trim();

  if (mode === 'fact') {
    const topic = topicContext(t);
    if (topic) return `다음 중 ${topic}으로 옳은 ${STEM_RESULT}`;
    return '';
  }

  // 꼬리 조건 주석 분리: "…것은? (단, 중량 기준)" → core + note
  let note = '';
  const noteM = t.match(/\s*\((?:단|주|참고)[^)]*\)\s*$/);
  let core = t;
  if (noteM) { note = noteM[0]; core = t.slice(0, t.length - noteM[0].length).trim(); }

  // answer 모드 — 꼬리 패턴별 교체 (긴 것부터)
  const rules = [
    [/가장\s+(옳은|적절한|적합한|올바른|바람직한|맞는)\s+것은\s*\?*\s*$/, `옳은 ${STEM_RESULT}`],
    [/(옳지 ?않은|맞지 않는|틀린|잘못된|올바르지 않은|적합하지 않은|적절하지 않은|바람직하지 않은|부적절한|해당하지 않는|해당되지 않는|아닌)\s+것은\s*\?*\s*$/, (m, p1) => `${p1.replace(/\s+/g, ' ')} ${STEM_RESULT}`],
    [/(옳은|적절한|적합한|올바른|바람직한|맞는|해당하는|해당되는|맞도록 나열된|바르게 나열된)\s+것은\s*\?*\s*$/, (m, p1) => `${p1} ${STEM_RESULT}`],
    [/것은\s*\?+\s*$/, STEM_RESULT],
    [/(무엇인가|어떤 것인가|어느 것인가|누구인가|어디인가|얼마인가|며칠인가|몇\s*\S*인가|몇\s*\S*인지)\s*\?*\s*$/, STEM_MATCH],
    [/(은|는)\s*\?+\s*$/, STEM_MATCH],
    [/고르시오[.?\s]*$/, `모두 고르시오.`],
  ];
  for (const [re, rep] of rules) {
    if (re.test(core)) {
      const out = core.replace(re, typeof rep === 'function' ? rep : rep);
      return out === core ? '' : out + note;
    }
  }
  // 폴백: 꼬리 교체가 어색한 발문(~하는가?, ~까?, 콜론 종결 등)은 원형 유지 + 지시문 부기
  return `${core}${note} — 해당하는 것을 모두 고르시오.`;
}

/* ---------- 결정론적 RNG (mulberry32) ---------- */

function seededRng(seedStr) {
  let h = 2166136261 >>> 0;
  for (const c of String(seedStr)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return function () {
    h |= 0; h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 변환 ---------- */

function loadExamFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const m = src.match(/var\s+EXAM_DATA_(\w+)\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!m) throw new Error(`EXAM_DATA 형식 아님: ${filePath}`);
  return { key: m[1], data: JSON.parse(m[2]) };
}

const SUBJECT_NUM = { subject1: 1, subject2: 2, subject3: 3, subject4: 4 };
const SUBJECT_KEY = { subject1: 'law', subject2: 'manufacturing', subject3: 'safety', subject4: 'understanding' };
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const STMT_LABELS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ'];

/* ---------- 단답형 → 합답형 변환 (정답 풀링) ---------- */

const BLANK_MARKER_RE = /\*+\[\s*\((A|B)\)\s*\]\s*\*+/g;

/** 빈칸 마커 `**[ (A) ]**` → `(A)` 평문화 */
function cleanBlankStem(stem) {
  return String(stem || '').replace(/\s+/g, ' ').replace(BLANK_MARKER_RE, '($1)').trim();
}

/** 정답 유형 분류: 숫자 포함 → 'num' (수치끼리 풀링), 아니면 'term' */
function answerType(text) {
  return /\d/.test(text) ? 'num' : 'term';
}

/** 정규화 비교키 — 모호성 검사용 (공백·대소문자·괄호 무시) */
function normKey(s) {
  return String(s).toLowerCase().replace(/[\s()[\]{}]/g, '');
}

/**
 * 단답형 정답 풀 구축: 과목별 + 전체 백업 풀.
 * 각 문항의 허용 정답 첫 번째를 대표 정답으로 등록.
 */
function buildAnswerPools(examDataMap) {
  const bySubject = {};
  const global = { num: new Map(), term: new Map() };
  for (const [key, { data: exam }] of Object.entries(examDataMap)) {
    const pool = { num: new Map(), term: new Map() };
    for (const q of exam.questions) {
      if (q.type !== 'blank') continue;
      const parts = String(q.answer || '').split(',').map(s => s.trim()).filter(Boolean);
      // 다중 빈칸은 (A)=parts[0], (B)=parts[1]을 각각 풀에 등록 — 나머지는 허용 답안 변형
      const blanks = /\(\s*B\s*\)|\*\*\[\s*\(B\)/.test(q.question) ? parts.slice(0, 2) : parts.slice(0, 1);
      for (const canonical of blanks) {
        const entry = { text: canonical, qid: q.id };
        pool[answerType(canonical)].set(normKey(canonical), entry);
        global[answerType(canonical)].set(normKey(canonical), entry);
      }
    }
    bySubject[key] = pool;
  }
  return { bySubject, global };
}

/**
 * 오답 선지 선정: 같은 유형(수치/용어) 풀에서 추첨하되,
 * 정답(허용 답안 전부)과 정규화 후 부분문자열 관계면 모호하므로 제외.
 */
function pickDistractors(q, pool, count, rng, acceptsRaw) {
  const accepts = (acceptsRaw || String(q.answer || '').split(','))
    .map(s => normKey(s)).filter(Boolean);
  const canonical = accepts[0];
  const ambiguous = (cand) =>
    accepts.some(a => a.includes(cand) || cand.includes(a));

  const sameType = pool[answerType(canonical)] || new Map();
  const others = [...sameType.values()]
    .filter(e => e.qid !== q.id && !ambiguous(normKey(e.text)));

  // 섞어서 count개 추첨
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return others.slice(0, count).map(e => e.text);
}

/**
 * 단답형 → combo 문항 변환
 * @param {string} blankLabel 항상 'A' — seed/sid/id 안정성을 위해 라벨 형식 유지 (1,000문 총량 정책으로 (B) 생성 중단)
 */
function buildBlankCombo(q, blankLabel, examKey, exam, pools, globalPool, genOpts) {
  const subject = SUBJECT_NUM[examKey];
  const subjKey = SUBJECT_KEY[examKey] || examKey;
  const parts = String(q.answer || '').split(',').map(s => s.trim()).filter(Boolean);
  const canonical = blankLabel === 'B' ? parts[1] : parts[0];
  if (!canonical) return null;
  const accepts = blankLabel === 'B' ? [canonical] : parts;

  const rng = seededRng(q.id + '|blank' + blankLabel);
  let distractors = pickDistractors(q, pools[examKey], 4, rng, accepts);
  // 과목 내 풀이 부족하면 전체 풀로 보충 (과목3 blank 1문 등)
  if (distractors.length < 4) {
    const extra = pickDistractors(q, globalPool, 4 - distractors.length, rng, accepts)
      .filter(t => !distractors.includes(t) && normKey(t) !== normKey(canonical));
    distractors = [...distractors, ...extra];
  }
  if (distractors.length < 2) return null; // 진술 3개 미만이면 합답형 성립 불가

  // 정답 + 오답을 seeded 셔플 → ㄱㄴㄷㄹㅁ 라벨
  const stmts = [
    { text: canonical, truth: true },
    ...distractors.map(t => ({ text: t, truth: false })),
  ];
  for (let i = stmts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [stmts[i], stmts[j]] = [stmts[j], stmts[i]];
  }
  const conceptId = extractConceptId(q.explanation, q.id);
  const statements = stmts.map((s, i) => ({
    id: STMT_LABELS[i],
    sid: stableId(subjKey, 'bank', 'st', `${q.id}|blank${blankLabel}${i}|${s.text}`),
    conceptId,
    text: s.text,
    truth: s.truth,
  }));

  const stem = `${cleanBlankStem(q.question)} — (${blankLabel})에 해당하는 것을 모두 고르시오.`;
  const allIds = statements.map(s => s.id);
  const truthIds = statements.filter(s => s.truth).map(s => s.id);

  return {
    id: stableId(subjKey, 'bank', 'combo', `${q.id}|${blankLabel}`),
    subject,
    type: 'combo',
    points: 4,
    citation: buildCitation(q, examKey, q.explanation),
    stem,
    statements,
    options: genOpts(allIds, truthIds, {
      count: 5, rng: seededRng(q.id + '|' + blankLabel),
      banFull: truthIds.length !== allIds.length,
    }),
    tags: ['자동변환', '정답판정', ...inferTags(stem, ...statements.map(s => s.text))],
    derivedFrom: q.id,
    explain: q.explanation || '',
    source: exam.title || examKey,
  };
}

/**
 * conceptId 도출: explanation의 첫 교재 라인(L####) — 같은 교재 구간의 진술을
 * "개념 클러스터"로 묶어 혼동쌍 대조 학습(전략 §2-⑤)과 취약 진술 그룹핑에 사용.
 * 교재 근거가 없으면 원문 id로 폴백 (같은 문항의 진술끼리라도 묶임).
 */
function extractConceptId(explanation, qid) {
  const m = String(explanation || '').match(/L\d{3,5}/);
  return m ? m[0] : `q:${qid}`;
}

/** explanation에서 '교재: Lxxxx'·법령 근거를 추출해 citation 생성 */
function buildCitation(q, examKey, explanation) {
  const qNum = (q.id.match(/_q(\d+)/) || [])[1] || q.id;
  const srcLabel = `과목${SUBJECT_NUM[examKey]} 문제은행 Q${qNum}`;
  const exp = String(explanation || '');
  const refs = [...exp.matchAll(/교재:\s*L[\d,~\- ]+/g)].map(m => m[0].replace(/\s+/g, ' ').trim());
  const lawRefs = [...exp.matchAll(/화장품법\s*제[\d조의]+[\d항호]*/g)].map(m => m[0]);
  const uniq = [...new Set([...refs, ...lawRefs])].slice(0, 3);
  return uniq.length
    ? `📖 ${uniq.join(' · ')} (출처: ${srcLabel})`
    : `📖 출처: ${srcLabel}`;
}

function buildComboItems(examKey, exam, genOpts, pools, globalPool) {
  const items = [];
  const stats = {
    choice: 0, fact: 0, answer: 0, blank: 0,
    skipComboStem: 0, skipStem: 0, skipNoTruth: 0, skipFew: 0, skipBlank: 0,
    allOfAbove: 0, errors: [],
  };
  const subject = SUBJECT_NUM[examKey];
  const subjKey = SUBJECT_KEY[examKey] || examKey;

  for (const q of exam.questions) {
    if (q.type === 'blank') {
      const it = buildBlankCombo(q, 'A', examKey, exam, pools, globalPool, genOpts);
      if (it) { items.push(it); stats.blank++; }
      else { stats.skipBlank++; stats.errors.push(`${q.id}: 단답형 변환 실패 (오답 풀 부족)`); }
      continue;
    }
    if (q.type !== 'choice') continue;
    stats.choice++;

    const stemSrc = String(q.question || '');
    if (COMBO_STEM_RE.test(stemSrc)) { stats.skipComboStem++; continue; }

    const answerIdx = CIRCLED.indexOf(q.answer);
    const propCount = q.options.filter(isPropositional).length;
    const descriptive = propCount >= Math.ceil(q.options.length * 0.6);
    const negDesc = descriptive && NEG_DESC_RE.test(stemSrc);
    const mode = descriptive && (DESC_RE.test(stemSrc) || NEG_DESC_RE.test(stemSrc)) ? 'fact' : 'answer';

    // '위 ①②③ 모두'류 메타 선지가 정답인지 — 원형 숫자 개수만큼 실질 선지를 참으로
    const answerOpt = q.options[answerIdx] || '';
    const answerIsAllOfAbove = SELF_REF_RE.test(answerOpt) && ALL_OF_ABOVE_RE.test(answerOpt);
    let allOfAboveCount = 0;
    if (answerIsAllOfAbove) {
      allOfAboveCount = (answerOpt.match(/[①②③④⑤⑥⑦⑧⑨⑩]/g) || []).length;
      stats.allOfAbove++;
    }

    // 진술 구성: 자기참조 선지 제외, 라벨 ㄱㄴㄷㄹㅁ 부여
    const conceptId = extractConceptId(q.explanation, q.id);
    const statements = [];
    q.options.forEach((optText, idx) => {
      if (SELF_REF_RE.test(optText)) return;
      const isAnswer = idx === answerIdx;
      let truth;
      if (answerIsAllOfAbove) {
        // '모두' 정답 — 상호배타 메타 선지가 아닌 실질 선지는 참
        truth = !META_NEG_RE.test(optText);
      } else {
        truth = negDesc ? !isAnswer : isAnswer;
      }
      statements.push({
        id: STMT_LABELS[statements.length],
        sid: stableId(subjKey, 'bank', 'st', `${q.id}|${idx}|${String(optText).trim()}`),
        conceptId,
        text: String(optText).trim(),
        truth,
      });
    });

    // '모두' 정답일 때 원형 숫자 개수와 실질 참 진술 수가 다르면 신뢰 불가 → 스킵
    if (answerIsAllOfAbove) {
      const trueCount = statements.filter(s => s.truth).length;
      if (trueCount !== allOfAboveCount) {
        stats.errors.push(`${q.id}: '모두' 정답 개수(${allOfAboveCount}) ≠ 실질 참 진술(${trueCount})`);
        continue;
      }
    }

    if (statements.length < 2) { stats.skipFew++; continue; }
    if (!statements.some(s => s.truth)) { stats.skipNoTruth++; continue; }

    const stem = comboStem(stemSrc, mode);
    if (!stem) { stats.skipStem++; stats.errors.push(`${q.id}: 발문 변환 실패 — ${stemSrc}`); continue; }

    const allIds = statements.map(s => s.id);
    const truthIds = statements.filter(s => s.truth).map(s => s.id);
    const options = genOpts(allIds, truthIds, {
      count: 5,
      rng: seededRng(q.id),
      banFull: truthIds.length !== allIds.length,
    });

    items.push({
      id: stableId(subjKey, 'bank', 'combo', q.id),
      subject,
      type: 'combo',
      points: 4,
      citation: buildCitation(q, examKey, q.explanation),
      stem,
      statements,
      options,
      tags: ['자동변환', mode === 'fact' ? '명제판정' : '정답판정',
        ...inferTags(stem, ...statements.map(s => s.text))],
      derivedFrom: q.id,
      explain: q.explanation || '',
      source: exam.title || examKey,
    });
    if (mode === 'fact') stats.fact++; else stats.answer++;
  }
  return { items, stats };
}

/* ---------- Markdown 내보내기 (content/문제은행/ 형식과 동일) ---------- */

const OPT_INDICATORS = ['①', '②', '③', '④', '⑤', '⑥'];
const SUBJECT_TITLE = {
  1: '화장품법의 이해', 2: '화장품 제조 및 품질관리',
  3: '화장품 안전성 및 안전관리', 4: '맞춤형화장품의 이해',
};

/**
 * 과목별 combo 문항을 문제은행 MD 형식으로 직렬화.
 * 문제부: ### Qn. 발문 / citation / ㄱ~ㅁ 진술 / ①~⑤ 조합 선지
 * 정답부: **Qn.** / 정답 조합 / 진술별 O·X 판정표 / 해설(교재 근거)
 */
function toSubjectMd(subject, questions) {
  const lines = [
    `# 제${subject}과목: ${SUBJECT_TITLE[subject] || ''} 합답형 (ㄱㄴㄷㄹ 조합)`,
    '',
    '> **화장품조제관리사 필기시험 대비** (합답형)',
    '> 문제에 집중할 수 있도록 정답과 교재 근거는 파일 끝에 모아 제공합니다.',
    `> ⚠ 자동 생성 파일 (tools/build_combo_drills.js) — 직접 수정하지 마십시오.`,
    '',
    `총 ${questions.length}제`,
    '',
    '---',
    '',
    `## 📝 [합답형: 옳은 것을 모두 고르시오]`,
    '',
  ];

  const answers = [];
  questions.forEach((q, i) => {
    const num = i + 1;
    const isPilot = String(q.id).startsWith('cb-');
    lines.push(`### Q${num}. ${q.stem}${isPilot ? ' *(수작업 파일럿)*' : ''}`);
    lines.push(`${q.citation}`);
    lines.push('');
    q.statements.forEach(s => lines.push(`${s.id}. ${s.text}`));
    lines.push('');
    q.options.forEach((o, idx) => lines.push(`${OPT_INDICATORS[idx]} ${o.members.join(', ')}`));
    lines.push('', '---', '');
    answers.push({ num, q });
  });

  lines.push('## 🔑 정답 및 교재 근거', '');
  for (const { num, q } of answers) {
    const trueIds = q.statements.filter(s => s.truth).map(s => s.id);
    // 파일럿은 answer 미보유 — truth 집합과 일치하는 옵션으로 도출
    const trueSet = new Set(trueIds);
    const eq = o => (o.members || []).length === trueSet.size && o.members.every(m => trueSet.has(m));
    const ansIdx = q.options.findIndex(o => (q.answer && o.id === q.answer) || (!q.answer && eq(o)));
    const ansLabel = OPT_INDICATORS[ansIdx] || q.answer || '?';
    lines.push(`**Q${num}.**`);
    lines.push(`> **정답: ${ansLabel} (${trueIds.join(', ')})**`);
    lines.push(`> 진술 판정: ${q.statements.map(s => `${s.id} ${s.truth ? 'O' : 'X'}`).join(' · ')}`);
    lines.push(`> ${q.citation.replace(/^📖\s*/, '📖 ')}`);
    const exp = String(q.explain || '').trim();
    if (exp) exp.split('\n').forEach(l => lines.push(`> ${l.trim()}`));
    lines.push('');
  }
  return lines.join('\n');
}

/* ---------- 메인 ---------- */

async function main() {
  if (!fs.existsSync(EXAMS_DIR)) {
    console.error(`[combo-drills] 입력 폴더 없음: ${EXAMS_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(EXAMS_DIR).filter(f => f.endsWith('.js')).sort();
  if (!files.length) {
    console.error('[combo-drills] data/exams에 번들이 없습니다. npm run build:data 먼저 실행하세요.');
    process.exit(1);
  }

  // 스키마 검증·옵션 생성 (ESM 모듈을 CJS에서 동적 import — Windows 절대경로는 file:// URL 필요)
  const { pathToFileURL } = require('url');
  const { validateQuestion, deriveComboAnswer, generateComboOptions } =
    await import(pathToFileURL(path.join(ROOT, 'src', 'questions.js')).href);

  // 단답형 오답 선지 풀: 전체 번들을 먼저 로드해 과목별+전체 풀 구축
  const examDataMap = {};
  for (const file of files) {
    const { key, data } = loadExamFile(path.join(EXAMS_DIR, file));
    examDataMap[key] = { data, file };
  }
  const { bySubject: pools, global: globalPool } = buildAnswerPools(examDataMap);

  let totalItems = 0;
  let totalErrors = 0;

  for (const [key, { data, file }] of Object.entries(examDataMap)) {
    const { items, stats } = buildComboItems(key, data, generateComboOptions, pools, globalPool);

    // 검증: 스키마 무결성 + 도출 정답을 answer로 고정
    const errs = [];
    const valid = [];
    for (const it of items) {
      it.answer = deriveComboAnswer(it);
      const problems = validateQuestion(it);
      if (problems.length) errs.push(`${it.id}(${it.derivedFrom}): ${problems.join(', ')}`);
      else valid.push(it);
    }
    totalErrors += errs.length + stats.errors.length;

    if (!DRY_RUN) {
      const body = AUTOGEN_HEADER + '\n' +
        `// 원본: data/exams/${file} — mode: fact(명제 조합) ${stats.fact}문 / answer(정답 조합) ${stats.answer}문\n` +
        `var COMBO_DRILLS_${key} = ` + JSON.stringify(valid, null, 1) + ';\n';
      fs.writeFileSync(path.join(OUT_DIR, `combo_${key}.js`), body, 'utf8');

      // 문제은행 MD 형식 산출물 — 자동 변환분만 (과목당 100/250/250/400 구성)
      const subjectNum = SUBJECT_NUM[key];
      const mdPath = path.join(MD_DIR, `과목${subjectNum}_합답형.md`);
      fs.writeFileSync(mdPath, toSubjectMd(subjectNum, valid), 'utf8');
    }

    totalItems += valid.length;
    console.log(`[combo-drills] ${key}: choice ${stats.choice} + blank → combo ${valid.length} (fact ${stats.fact}/answer ${stats.answer}/blank ${stats.blank}, 조합발문 스킵 ${stats.skipComboStem}, '모두'복구 ${stats.allOfAbove})`);
    const allErrs = [...stats.errors, ...errs];
    if (allErrs.length) {
      console.log(`  ⚠ 오류 ${allErrs.length}건:`);
      allErrs.slice(0, 8).forEach(e => console.log('   -', e));
      if (allErrs.length > 8) console.log(`   … 외 ${allErrs.length - 8}건`);
    }
  }

  console.log(`[combo-drills] 총 ${totalItems}개 합답형 문항 생성${DRY_RUN ? ' (dry-run)' : ''}, 오류 ${totalErrors}건 → ${path.relative(ROOT, OUT_DIR)}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
