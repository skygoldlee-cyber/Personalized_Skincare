#!/usr/bin/env node
/* ============================================================
 * tools/build_combo_drills.js
 * ------------------------------------------------------------
 * data/exams/subjectN.*.js (choice 문항)를 복수정답형(combo) 드릴 문항으로 변환한다.
 * docs/dev/COMBO_STUDY_STRATEGY.md §2-①: single 문항의 각 보기를 진술 원자로 펼치고
 * truth(명제 참/거짓 또는 정답 여부)로 정답 조합을 도출한다.
 *
 * 변환 규칙
 *   mode 'fact'   — 명제형 선지(문장형): 진술 truth = 내용의 참/거짓
 *                   부정형 발문(옳지 않은 것은?)이면 정답 보기가 거짓 진술
 *                   → 발문은 "…으로 옳은 것을 모두 고른 것은?"으로 긍정 정규화
 *   mode 'answer' — 회상형·분류형 선지(고유명사·수치): truth = 정답 여부
 *                   → 발문 꼬리를 "…모두 고른 것은?"으로 변환 (극성 보존)
 *   '위 ①②③ 모두'류 메타 선지가 정답이면 원형 숫자 개수만큼 실질 선지를 참으로 처리
 *
 *   개념 재조합 — fact 모드 진술을 같은 교재 구간(conceptId = 첫 L####)끼리 모아
 *                 참 2~3개 + 거짓 진술로 진짜 복수정답 복수정답형을 추가 생성한다.
 *                 (단일정답 문항이 대부분인 구조적 한계 보완.
 *                  챕터 단위는 입자가 커서 이질 진술이 섞이므로 L#### 단위로 한정)
 *
 *   진술 explain은 중복 저장하지 않음(문항 explain으로 폴백) — 번들 크기 절감
 *   conceptId = explanation의 첫 교재 L#### (같은 구간 진술 = 개념 클러스터)
 *   id = stableId(문항 id) — 재생성 순서와 무관하게 안정
 *
 * 제외: ㄱㄴㄷ 조합형 발문, 참 진술 0개 그룹, 진술 2개 미만, 단답형(blank)
 *       — 빈칸은 정답이 하나뿐이라 복수정답형이 되어도 100% 단일정답이 되어
 *         "참 진술 하나 찾기"로 공략 가능 → 복수정답형 풀에서 제외하고
 *         원본 문제은행의 단답형으로만 출제한다.
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
const { getExamTargets, getSubjectMaps, getDefaultExamRoots } = require('./build/exam-targets.js');
const { extractRefAtoms } = require('./build/ref-statements.js');

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// [멀티시험] 시험별 {dataRoot}/exams → {dataRoot}/drills + {contentRoot}/문제은행 순회.
// 과목 매핑은 시험별 manifest에서 파생된다 (main 루프에서 설정).
let SUBJECT_NUM = {};
let SUBJECT_KEY = {};
let SUBJECT_TITLE = {};
const _defRoots = getDefaultExamRoots(ROOT);
let OUT_DIR = path.join(ROOT, _defRoots.dataRoot, 'drills');
let MD_DIR = path.join(ROOT, _defRoots.contentRoot, '문제은행');

const AUTOGEN_HEADER = '// 자동 생성된 복수정답형 드릴 데이터입니다. 수정하지 마십시오. (tools/build_combo_drills.js)';

/* ---------- 발문 분류 (build_ox_drills.js와 동일 기준) ---------- */

const NEG_DESC_RE = /옳지 ?않은|맞지 않는|틀린|잘못된|올바르지 않은|적합하지 않은|바람직하지 않은|부적절한|적절하지 않은|맞는 것이 아닌|아닌|일치하지 않는|거리가 먼|다른 것은|다른 하나는|해당하지 않는|해당되지 않는/;
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
    // 판정 절 앞의 조사(으로/이/가/은/는/에 등)는 절 문법의 일부 — 함께 제거.
    // 안 떼면 "특징이 아닌 것은?" → "특징이" + "으로 옳은" = "특징이으로"
    .replace(/(으로|로|중|이|가|은|는|에|에서)?\s*(가장\s*)?(옳지 ?않은|옳은|맞지 않는|틀린|적절하지 않은|바람직하지 않은|부적절한|올바르지 않은|적합하지 않은|해당하지 않는|해당되지 않는|잘못된|맞는|해당하는|해당되는|아닌|다른|거리가 먼|일치하지 않는|맞도록 나열된|바르게 나열된)\s*것은\?.*$/u, '')
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

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const STMT_LABELS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ'];

/* ---------- 진술 유틸 ---------- */

/** 정규화 비교키 — 진술 중복 제거·모호성 검사용 (공백·대소문자·괄호 무시) */
function normKey(s) {
  return String(s).toLowerCase().replace(/[\s()[\]{}]/g, '');
}

/** seeded 셔플 (Fisher-Yates) */
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 해설 정제 — 원본 해설에 박힌 '정답: ② …' 라인을 제거한다.
 * 복수정답형은 도출 정답이 원본 선지 번호와 다르므로 그대로 두면 혼동을 유발한다.
 * (번들 explain에 저장되기 때문에 생성 단계에서 정제 — MD 출력 필터는 이중 안전장치)
 */
function sanitizeExplain(explanation) {
  return String(explanation || '').split('\n')
    .filter(l => !/^\s*정답\s*[:：]/.test(l.trim()))
    .join('\n')
    .trim();
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

/** 근접 중복 — 정규화 키의 부분문자열·공통 접두사(≥60%) 검출 */
function nearDup(a, b) {
  const x = normKey(a), y = normKey(b);
  if (x.includes(y) || y.includes(x)) return true;
  const min = Math.min(x.length, y.length);
  let i = 0;
  while (i < min && x[i] === y[i]) i++;
  return i >= Math.max(8, Math.floor(min * 0.6));
}

function buildComboItems(examKey, exam, genOpts, refAtoms) {
  const items = [];
  const stats = {
    choice: 0, fact: 0, answer: 0, cluster: 0, ref: 0,
    skipComboStem: 0, skipStem: 0, skipNoTruth: 0, skipFew: 0, skipBlank: 0,
    allOfAbove: 0, errors: [],
  };
  const subject = SUBJECT_NUM[examKey];
  const subjKey = SUBJECT_KEY[examKey] || examKey;
  // conceptId(교재 L####)별 fact 진술 풀 — 같은 교재 구간의 참/거짓 명제를 재조합.
  // 챕터 단위는 입자가 너무 커서 이질 진술이 섞여 발문과 내용이 어긋나므로 L#### 단위로 한정한다.
  const conceptPool = {};

  for (const q of exam.questions) {
    // 단답형은 복수정답형 풀에서 제외 — 빈칸 정답은 하나뿐이라 복수정답형이 돼도 100% 단일정답.
    // 원본 문제은행의 단답형으로 출제된다.
    if (q.type === 'blank') { stats.skipBlank++; continue; }
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

    // fact 모드 진술은 명제이므로 conceptId 풀에 적립 — 재조합 문항의 재료.
    // (문항 자체가 스킵돼도 진술의 참/거짓은 유효하므로 스킵 판정 전에 적립)
    // 'q:' 폴백 conceptId는 단일 문항끼리만 묶이므로 재조합 재료로 쓰지 않는다.
    if (mode === 'fact' && !conceptId.startsWith('q:')) {
      const bucket = conceptPool[conceptId] || (conceptPool[conceptId] = { true: new Map(), false: new Map() });
      for (const s of statements) {
        const map = s.truth ? bucket.true : bucket.false;
        const k = normKey(s.text);
        if (!map.has(k)) map.set(k, { ...s, srcQid: q.id });
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
      explain: sanitizeExplain(q.explanation),
      source: exam.title || examKey,
    });
    if (mode === 'fact') stats.fact++; else stats.answer++;
  }

  // 개념 재조합 문항 추가 — 같은 교재 구간(L####)의 참 2~3 + 거짓 진술로 구성한
  // 진짜 복수정답 복수정답형. 챕터 단위보다 입자가 가늘어 이질 진술 혼입 위험이 낮다.
  items.push(...buildClusterCombos(conceptPool, examKey, subject, subjKey, genOpts, stats));

  // 참조자료 원문(ref_md) 콤보 — 법령 정의조항·열거 목록에서 추출한 검증 원자.
  items.push(...buildRefCombos(refAtoms, examKey, subject, subjKey, genOpts, stats));

  return { items, stats };
}

/**
 * 같은 교재 구간(conceptId = 첫 L####)의 fact 진술을 재조합한 복수정답 복수정답형 생성.
 * 단일 MCQ 변환은 구조상 정답이 1개 — 같은 구간의 참 명제 여러 개를 모아야
 * "옳은 것을 모두 고르시오"가 실제로 복수정답이 된다.
 *
 * - 진술의 sid는 원본 것을 재사용 — 진술 단위 오답 통계·SM-2 이력이 이어진다.
 * - 진술별 explain에 원본 문항 출처를 실어 오답 리뷰가 dead-end가 되지 않게 한다.
 * - 근접 중복 방어: 정규화 키가 부분문자열 관계인 진술 쌍은 같은 문항에 넣지 않는다
 *   (진위가 같으면 중복, 다르면 모순 위험).
 * - 한계: 다른 문항에서 온 진술끼리 의미 모순은 기계 검출 불가 — 소수 문항이므로
 *   출제 검수 시 확인 권장 (derivedFrom `cluster:…`으로 식별 가능).
 */
function buildClusterCombos(conceptPool, examKey, subject, subjKey, genOpts, stats) {
  const out = [];
  for (const [cid, pool] of Object.entries(conceptPool)) {
    const trues = [...pool.true.values()];
    const falses = [...pool.false.values()];
    if (trues.length < 2 || falses.length < 2) continue;

    const rng = seededRng(`${examKey}|cluster|${cid}`);
    const nTrue = Math.min(trues.length, 2 + Math.floor(rng() * 2)); // 2~3개
    const nFalse = Math.min(falses.length, 5 - nTrue);

    // 근접 중복 쌍이 섞이지 않게 하나씩 선별
    const picked = [];
    for (const s of shuffle([...trues], rng).slice(0, nTrue * 2)) {
      if (picked.length >= nTrue) break;
      if (!picked.some(p => nearDup(p.text, s.text))) picked.push(s);
    }
    for (const s of shuffle([...falses], rng).slice(0, nFalse * 2)) {
      if (picked.length >= nTrue + nFalse) break;
      if (!picked.some(p => nearDup(p.text, s.text))) picked.push(s);
    }
    if (picked.filter(s => s.truth).length < 2 || picked.length < 4) continue;
    shuffle(picked, rng);

    const statements = picked.map((s, i) => ({
      id: STMT_LABELS[i],
      sid: s.sid,
      conceptId: s.conceptId,
      text: s.text,
      truth: s.truth,
      explain: `원본: 과목${subject} 문제은행 ${s.srcQid.replace(/.*_q/, 'Q')} · 교재 ${s.conceptId}`,
    }));
    const allIds = statements.map(s => s.id);
    const truthIds = statements.filter(s => s.truth).map(s => s.id);

    // 발문은 제네릭 고정 — 챕터 라벨은 L#### 클러스터보다 입자가 커서
    // "정의 및 규정" 발문에 저울 사용법 진술이 붙는 식의 부조화를 낳는다.
    const stem = '다음 설명 중 옳은 것을 모두 고른 것은?';
    out.push({
      id: stableId(subjKey, 'bank', 'combo-cluster', `${subject}|${cid}`),
      subject,
      type: 'combo',
      points: 4,
      citation: `📖 교재: ${cid} (출처: 과목${subject} 문제은행 진술 재조합)`,
      stem,
      statements,
      options: genOpts(allIds, truthIds, {
        count: 5, rng: seededRng(`${examKey}|clusterOpt|${cid}`),
        banFull: truthIds.length !== allIds.length,
      }),
      tags: ['자동변환', '명제판정', '개념재조합',
        ...inferTags(stem, ...statements.map(s => s.text))],
      derivedFrom: `cluster:${subject}|${cid}`,
      explain: statements.map(s => `${s.id}. ${s.explain}`).join('\n'),
      source: `과목${subject} 개념 재조합`,
    });
    stats.cluster++;
  }
  return out;
}

/**
 * ref_md(법령·고시 원문) 추출 원자로 복수정답형 생성 — 검증된 신규 진술 재료.
 *
 * - def: 같은 조의 용어 정의 교차 결합. 참 = 원문 그대로, 거짓 = 타 용어의
 *   정의 본문을 결합 (정의는 용어별 유일 → 교차 결합은 확실히 거짓).
 * - enum: '다음 각 호/목' 유한집합 멤버십. 참 = 목록 멤버, 거짓 = 다른 목록 멤버.
 *   주제가 인용 용어("X")에서 온 경우만 주제형 발문, 나머지는 제네릭 발문.
 *
 * - citation은 '문서약칭 제N조'의 실 법령 근거 — L####보다 정확하다.
 * - derivedFrom `ref:…`·태그 '참조자료'로 식별 가능 → 검수 큐 추출 용이.
 * - 과목별 cap(REF_COMBO_CAP)까지 채운다.
 */
const REF_COMBO_CAP = { 1: 35, 2: 92, 3: 40, 4: 150 };

function buildRefCombos(refPool, examKey, subject, subjKey, genOpts, stats) {
  const out = [];
  const cap = REF_COMBO_CAP[subject] || 0;
  const bucket = refPool && refPool.bucket;
  if (!bucket || !cap) return out;
  const rng = seededRng(`${examKey}|ref`);
  const concept = a => `${a.docShort}:${a.article}`;

  const pushCombo = (stem, picked, citeKey, derived, kindTag) => {
    const statements = picked.map((s, i) => ({
      id: STMT_LABELS[i], sid: s.sid, conceptId: s.conceptId,
      text: s.text, truth: s.truth, explain: s.explain,
    }));
    if (statements.filter(s => s.truth).length < 2 || statements.length < 4) return false;
    const allIds = statements.map(s => s.id);
    const truthIds = statements.filter(s => s.truth).map(s => s.id);
    out.push({
      id: stableId(subjKey, 'bank', 'combo-ref', derived),
      subject, type: 'combo', points: 4,
      citation: `📖 ${citeKey} (참조자료 원문)`,
      stem, statements,
      options: genOpts(allIds, truthIds, {
        count: 5, rng: seededRng(`${examKey}|refOpt|${derived}`),
        banFull: truthIds.length !== allIds.length,
      }),
      tags: ['자동생성', '참조자료', kindTag,
        ...inferTags(stem, ...statements.map(s => s.text))],
      derivedFrom: `ref:${derived}`,
      explain: statements.map(s => `${s.id}. ${s.explain}`).join('\n'),
      source: `참조자료 원문 (${kindTag === '용어정의' ? '정의조항' : '열거 목록'})`,
    });
    stats.ref++;
    return true;
  };
  const stmtOf = (text, truth, atom, key) => ({
    text, truth, conceptId: concept(atom),
    sid: stableId(subjKey, 'bank', 'refst', key),
    explain: `출처: ${atom.docShort} ${atom.article}${atom.ho ? atom.ho : ''}`,
  });

  // ── 정의조항 콤보: 조별 그룹의 용어 정의를 교차 결합 ──
  const defGroups = {};
  for (const d of bucket.defs) {
    if (d.text.length > 170) continue;
    const k = `${d.docShort}|${d.article}`;
    (defGroups[k] = defGroups[k] || []).push(d);
  }
  for (const [k, defs] of Object.entries(defGroups)) {
    if (out.length >= cap) break;
    const usable = defs.filter(d => d.text.length <= 170);
    if (usable.length < 4) continue;
    const gRng = seededRng(`${examKey}|refDef|${k}`);
    const nCombos = Math.min(3, Math.floor(usable.length / 4));
    const shuffled = shuffle([...usable], gRng);
    for (let c = 0; c < nCombos && out.length < cap; c++) {
      const trues = shuffled.slice(c * 5, c * 5 + 3)
        .map(d => stmtOf(d.text, true, d, `def|${k}|${d.term}`));
      const falses = [];
      for (const d of shuffled.slice(c * 5 + 3)) {
        if (falses.length >= 2) break;
        // 다른 용어의 정의 본문 결합 → 거짓 보장
        const mis = shuffled.find(o => o.term !== d.term && o !== shuffled[c * 5 + falses.length]);
        if (!mis) continue;
        // 조사(을/를/은/는…)로 시작하는 종결구는 무공백 결합
        const joiner = /^[을를은는이가의에로와과도만및]/.test(mis.endPhrase) ? '' : ' ';
        const text = `"${d.term}"이란 ${mis.defBody}${joiner}${mis.endPhrase}.`;
        if (text.length <= 170) falses.push(stmtOf(text, false, d, `defx|${k}|${d.term}|${mis.term}`));
      }
      if (trues.length < 2 || falses.length < 2) continue;
      const picked = shuffle([...trues, ...falses], gRng);
      pushCombo('다음 중 용어와 그 정의가 바르게 짝지어진 것을 모두 고른 것은?',
        picked, k.replace('|', ' '), `def|${k}|${c}`, '용어정의');
    }
  }

  // ── 열거 멤버십 콤보: '다음 각 호/목' 유한집합 ──
  // 큐레이션 원료 DB(원료/*.md)를 먼저 처리 — ref_md의 같은 표 중복본이
  // 60% 겹침 규칙으로 자동 탈락해 큐레이션본의 발문·멤버가 채택된다.
  // 처리 순서: 큐레이션(권위) → ref_md 원문 → 노트(보조). cap이 있는 과목에서
  // 노트가 원문 문항 슬롯을 잡아먹지 않게 노트는 항상 마지막에 둔다.
  const lists = [
    ...bucket.enums.filter(e => e.curated),
    ...shuffle(bucket.enums.filter(e => !e.curated && !e.note), rng),
    ...shuffle(bucket.enums.filter(e => e.note), rng),
  ];
  // 오답 풀은 "다른 조"의 목록에서만 추첨 — 같은 조의 다른 목록 멤버는
  // 발문이 조문 단위 멤버십을 물을 때 실제로 해당할 수 있어 모호하다.
  // 과목 내 후보가 부족하면 전 과목 풀까지 확장 (알레르기 성분 ↔ 색소 등
  // 화학명 간의 교차 사용은 오히려 그럴듯한 오답이 된다).
  const allEnums = (refPool && refPool.allEnums) || bucket.enums;
  const otherMembers = (e, memberKeys) => {
    // 이 목록과 멤버가 실질적으로 겹치는 목록(같은 표의 다른 문서본 등)은
    // 오답 풀에서 배제 — 그 멤버는 실제로도 해당 목록의 멤버일 수 있다.
    // 큐레이션 원료 목록은 같은 파일의 형제 섹션도 배제 — 별표1의 다른
    // 카테고리 원료를 별표1 문항의 오답으로 쓰면 "사용불가 원료를 아닌 것으로
    // 표기"하는 학습상 모순이 된다.
    const curPrefix = e.curated ? e.listId.split('|').slice(0, 2).join('|') : null;
    const banned = new Set();
    for (const o of allEnums) {
      if (o.listId === e.listId) continue;
      if (curPrefix && o.listId.startsWith(curPrefix)) {
        o.members.forEach(m => banned.add(normKey(m)));
        continue;
      }
      const overlap = o.members.filter(m => memberKeys.has(normKey(m))).length;
      if (overlap >= 3) o.members.forEach(m => banned.add(normKey(m)));
    }
    // 이름형 멤버(화학명 등)와 문장형 멤버(절차·규정 문장)는 오답 풀을
    // 분리한다 — 이름↔문장을 섞으면 길이만으로 정답이 들통난다.
    // 목록 안에 혼합돼 있을 수 있으므로 멤버 단위로 판정한다.
    // 연결어미(하여·하고·때·거나 등)나 의문·의존 종료(는가?·는지 등)로
    // 끝나는 절단 절도 문장형으로 본다.
    const isSentence = m =>
      m.length > 60 || /(다|음|함|임|까|요|고|며|서|여|때|거나|는가|는지|한가|한지)\.?[?]?$/.test(m.trim());
    const sameKind = isSentence(e.members[0] || '')
      || e.members.filter(isSentence).length >= e.members.length / 2
      ? 'sentence' : 'name';
    const kindMatch = m => isSentence(m) === (sameKind === 'sentence');
    // memberOk는 아래에 선언되지만 호출 시점에는 이미 초기화돼 있다 —
    // 오답 풀에도 동일한 조각 필터를 적용해 헤더 잔재·절단 셀이 새지 않게 한다.
    // 같은 문서+조문의 형제 목록은 모든 풀에서 배제 — 문서/조문 수준 발문
    // ("「별표1」에 해당하는 것")에서 형제 목록 멤버는 실제로 정답일 수 있다.
    const isSib = o => o.docShort === e.docShort && o.article === e.article;
    const same = bucket.enums
      .filter(o => !isSib(o))
      .flatMap(o => o.members)
      .filter(m => !banned.has(normKey(m)) && kindMatch(m) && memberOk(m));
    if (same.length >= 8) return same;
    const wide = allEnums
      .filter(o => o.listId !== e.listId && !isSib(o))
      .flatMap(o => o.members)
      .filter(m => !banned.has(normKey(m)) && kindMatch(m) && memberOk(m));
    if (wide.length >= 8) return [...same, ...wide];
    const anyPool = allEnums.filter(o => o.listId !== e.listId && !isSib(o))
      .flatMap(o => o.members)
      .filter(m => !banned.has(normKey(m)) && kindMatch(m) && memberOk(m));
    return [...same, ...wide, ...anyPool];
  };
  // 포괄 조항·지나치게 짧은 멤버는 진술로 부적합 — 어느 목록에도 우연히
  // 해당할 수 있어 정답 모호성을 만든다.
  const VAGUE_MEMBER_RE = /^(그\s*밖에|그\s*밖의|기타|그\s*외|이\s*외)/;
  // 셀 절단 잔재(불균형 괄호, 연속 공백, 특수 기호, 조각 종료)는 멤버에서 제외
  const memberOk = m => !/[◎◦▪※★→←↑↓⇔↔]/.test(m) && !/\s{2,}/.test(m)
    && (m.match(/[(「"'“]/g) || []).length === (m.match(/[)」"'”]/g) || []).length
    && (m.match(/\[/g) || []).length === (m.match(/\]/g) || []).length
    && !/[,·\-\/'´]$/.test(m) && !VAGUE_MEMBER_RE.test(m)
    && !/^[을를은는이가의에로와과도만및]/.test(m)
    && !/^[가-하]\.\s|^제\d+조|^[\d①-⑩]+\s*호?\.?\s/.test(m)
    && !/^[-–—·•]/.test(m) && !/(및|와|과|또는|에서|으로|으로서)$/.test(m)
    && !/(?:^|\s)[가-힣]\s[가-힣]\s[가-힣](?:\s|$)/.test(m)
    && !/^[가-힣]\s/.test(m)              // "어 지정된 …" 같은 단자 접두 조각
    && !/[?？]/.test(m)                  // 의문문 조각은 이름형 멤버가 아님
    && !/법제처|국가법령정보센터/.test(m)   // PDF 푸터 워터마크 잔재
    && !/^(구분|현황|항목|비고|내용|제조관리현황|관리현황|점검항목|평가항목|분류|번호|연번|성분명|원료명|품목명|품목|구비서류|기준|요건)$/.test(m)
    && !/[을를은는이가의에로고며서여]$/.test(m);   // 절단 종료(조사·연결어미) 조각
  const processedKeySets = [];   // 동일 목록의 중복 문서본 방지
  // 큐레이션 원료 문항은 cap의 60% + 파일별 상한 — 전부 원료 멤버십으로
  // 채워지는 단조로움을 막고 법령 조문·기능성 문항에 슬롯을 남긴다.
  const curatedCap = Math.ceil(cap * 0.6);
  const curatedCount = {};   // 파일별 생성 수
  for (const e of lists) {
    if (out.length >= cap) break;
    const seen = new Set();
    const members = e.members.filter(m => {
      const k = normKey(m);
      return m.length >= 4 && m.length <= 140 && memberOk(m)
        && !seen.has(k) && seen.add(k);
    });
    if (members.length < 4) continue;
    const memberKeys = new Set(members.map(normKey));
    // 이미 처리한 목록과 60% 이상 겹치면 같은 표의 다른 문서본 — 스킵.
    // (중복 등록은 문항 생성 여부와 무관하게 수행 — 캡으로 건너뛴 큐레이션
    //  목록도 등록해야 ref_md 중복본이 대신 생성되는 것을 막을 수 있다)
    if (processedKeySets.some(prev =>
      [...memberKeys].filter(k => prev.has(k)).length / memberKeys.size >= 0.6)) continue;
    processedKeySets.push(memberKeys);
    // 주제도 조문도 없는 표 덤프 목록은 발문이 "「문서」의 규정에 해당"으로
    // 의미가 없어 제외 — 멤버십이 무엇에 대한 것인지 묻지 못한다.
    if (!e.topic && !e.article) continue;
    const curFile = e.curated && e.listId.split('|')[1];
    if (e.curated
      && ((curatedCount._total || 0) >= curatedCap
        || (curatedCount[curFile] || 0) >= (e.curCap || curatedCap))) continue;
    const lRng = seededRng(`${examKey}|refEnum|${e.listId}`);
    // 멤버가 넉넉하면 다른 부분집합으로 복수 문항 (멤버 3개당 1문;
    // 목록 규모별 상한: ≥12 → 7문, ≥24 → 10문, ≥60 → 18문)
    const nQ = Math.min(
      members.length >= 60 ? 20 : members.length >= 24 ? 10 : members.length >= 12 ? 7 : 5,
      Math.floor(members.length / 3));
    const usedSubsets = new Set();
    for (let q = 0; q < nQ && out.length < cap; q++) {
      if (e.curated
        && ((curatedCount._total || 0) >= curatedCap
          || (curatedCount[curFile] || 0) >= (e.curCap || curatedCap))) break;
      const trues = [];
      for (const m of shuffle([...members], lRng)) {
        if (trues.length >= 3) break;
        if (!trues.some(t => nearDup(t, m))) trues.push(m);
      }
      if (trues.length < 2) break;
      const subsetKey = trues.map(normKey).sort().join('|');
      if (usedSubsets.has(subsetKey)) continue;
      usedSubsets.add(subsetKey);
      const falses = [];
      for (const m of shuffle([...otherMembers(e, memberKeys)], lRng)) {
        if (falses.length >= 2) break;
        if (memberKeys.has(normKey(m)) || m.length > 140 || m.length < 4
          || !memberOk(m)) continue;
        if (falses.some(f => nearDup(f, m)) || trues.some(t => nearDup(t, m))) continue;
        falses.push(m);
      }
      if (falses.length < 2) continue;
      const picked = shuffle([
        ...trues.map(m => stmtOf(m, true, e, `enum|${e.listId}|${normKey(m)}`)),
        ...falses.map(m => stmtOf(m, false, e, `enumx|${e.listId}|${normKey(m)}`)),
      ], lRng);
      // 멤버십 발문 필수 — '옳은 것' 발문이면 다른 목록의 참인 사실을
      // 거짓으로 표기하는 모순이 된다. 인용 주제가 없으면 조문을 직접 인용.
      const stem = e.topicSrc === 'quote'
        ? `다음 중 ${e.topic}에 해당하는 것을 모두 고른 것은?`
        : `다음 중 「${e.docShort}」${e.article ? `${e.article}의 규정` : ''}에 해당하는 것을 모두 고른 것은?`;
      if (pushCombo(stem, picked,
        `${e.docShort}${e.article ? ' ' + e.article : ''}`, `enum|${e.listId}|${q}`, '열거목록')
        && e.curated) {
        curatedCount._total = (curatedCount._total || 0) + 1;
        curatedCount[curFile] = (curatedCount[curFile] || 0) + 1;
      }
    }
  }
  return out;
}

/* ---------- Markdown 내보내기 (content/문제은행/ 형식과 동일) ---------- */

const OPT_INDICATORS = ['①', '②', '③', '④', '⑤', '⑥'];

/**
 * 과목별 combo 문항을 문제은행 MD 형식으로 직렬화.
 * 문제부: ### Qn. 발문 / citation / ㄱ~ㅁ 진술 / ①~⑤ 조합 선지
 * 정답부: **Qn.** / 정답 조합 / 진술별 O·X 판정표 / 해설(교재 근거)
 */
function toSubjectMd(subject, questions) {
  const lines = [
    `# ${subject ? `제${subject}과목: ` : ''}${SUBJECT_TITLE[subject] || '복수정답형'} 복수정답형 (ㄱㄴㄷㄹ 조합)`,
    '',
    '> **화장품조제관리사 필기시험 대비** (복수정답형)',
    '> 문제에 집중할 수 있도록 정답과 교재 근거는 파일 끝에 모아 제공합니다.',
    `> ⚠ 자동 생성 파일 (tools/build_combo_drills.js) — 직접 수정하지 마십시오.`,
    '',
    `총 ${questions.length}제`,
    '',
    '---',
    '',
    `## 📝 [복수정답형: 옳은 것을 모두 고르시오]`,
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
    // 멤버는 라벨(ㄱㄴㄷ…) 순으로 표기 — generateComboOptions가 이미 정렬하지만
    // 파일럿(cb-*)처럼 수작업 members도 동일한 관례로 보여주기 위해 출력 단계에서 재정렬
    const labelOrder = m => STMT_LABELS.indexOf(m);
    q.options.forEach((o, idx) => lines.push(
      `${OPT_INDICATORS[idx]} ${[...o.members].sort((a, b) => labelOrder(a) - labelOrder(b)).join(', ')}`));
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
    // 원본 해설에 박힌 '정답: ② …' 라인이 그대로 새어나가면 복수정답형 정답과 혼동 → 필터
    if (exp) exp.split('\n')
      .filter(l => !/^\s*정답\s*[:：]/.test(l.trim()))
      .forEach(l => lines.push(`> ${l.trim()}`));
    lines.push('');
  }
  return lines.join('\n');
}

/* ---------- 메인 ---------- */

async function buildForExam(target) {
  const EXAMS_DIR = path.join(ROOT, target.dataRoot, 'exams');
  OUT_DIR = path.join(ROOT, target.dataRoot, 'drills');
  MD_DIR = path.join(ROOT, target.contentRoot, '문제은행');
  if (!target.manifest) {
    console.warn(`[combo-drills] ${target.id}: manifest 없음 — 건너뜀`);
    return;
  }
  ({ SUBJECT_NUM, SUBJECT_KEY, SUBJECT_TITLE } = getSubjectMaps(target.manifest));
  if (!fs.existsSync(EXAMS_DIR)) {
    console.warn(`[combo-drills] ${target.id}: 입력 폴더 없음(${EXAMS_DIR}) — 건너뜀`);
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(EXAMS_DIR).filter(f => f.endsWith('.js')).sort();
  if (!files.length) {
    console.warn(`[combo-drills] ${target.id}: ${target.dataRoot}/exams에 번들이 없습니다 — 건너뜀`);
    return;
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
  let totalItems = 0;
  let totalErrors = 0;
  const comboCounts = {};

  // 참조자료 원문 추출 (참조자료/ref_md — 법령·고시 마크다운)
  const refAtomsBySubject = extractRefAtoms(
    path.join(ROOT, target.contentRoot, '참조자료', 'ref_md'));
  const refAllEnums = Object.values(refAtomsBySubject).flatMap(b => b.enums);

  for (const [key, { data, file }] of Object.entries(examDataMap)) {
    const { items, stats } = buildComboItems(key, data, generateComboOptions,
      { bucket: refAtomsBySubject[SUBJECT_NUM[key]], allEnums: refAllEnums });

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
        `// 원본: ${target.dataRoot}/exams/${file} — mode: fact(명제 조합) ${stats.fact}문 / answer(정답 조합) ${stats.answer}문\n` +
        `var COMBO_DRILLS_${key} = ` + JSON.stringify(valid, null, 1) + ';\n';
      fs.writeFileSync(path.join(OUT_DIR, `combo_${key}.js`), body, 'utf8');

      // 문제은행 MD 형식 산출물 — 자동 변환분만 (과목당 100/250/250/400 구성)
      const subjectNum = SUBJECT_NUM[key];
      if (subjectNum && fs.existsSync(MD_DIR)) {
        const mdPath = path.join(MD_DIR, `과목${subjectNum}_복수정답형.md`);
        fs.writeFileSync(mdPath, toSubjectMd(subjectNum, valid), 'utf8');
      }
    }

    comboCounts[key] = valid.length;
    totalItems += valid.length;
    console.log(`[combo-drills] ${key}: choice ${stats.choice} → combo ${valid.length} (fact ${stats.fact}/answer ${stats.answer}/재조합 ${stats.cluster}/참조자료 ${stats.ref}, blank 제외 ${stats.skipBlank}, 조합발문 스킵 ${stats.skipComboStem}, '모두'복구 ${stats.allOfAbove})`);
    const allErrs = [...stats.errors, ...errs];
    if (allErrs.length) {
      console.log(`  ⚠ 오류 ${allErrs.length}건:`);
      allErrs.slice(0, 8).forEach(e => console.log('   -', e));
      if (allErrs.length > 8) console.log(`   … 외 ${allErrs.length - 8}건`);
    }
  }

  // 과목별 복수정답형 문항 수 인덱스 — 모의고사 카드의 "전체 N문" 라벨용.
  // 수작업 파일럿(combo_pilot.js) 문항도 과목별로 합산해 실제 응시 풀과 일치시킨다.
  if (!DRY_RUN) {
    const pilotPath = path.join(OUT_DIR, 'combo_pilot.js');
    if (fs.existsSync(pilotPath)) {
      try {
        const sandbox = { window: {} };
        require('vm').runInNewContext(fs.readFileSync(pilotPath, 'utf8'), sandbox);
        const pilotQs = (sandbox.window.COMBO_PILOT && sandbox.window.COMBO_PILOT.questions) || [];
        for (const q of pilotQs) {
          const pKey = Object.keys(SUBJECT_NUM).find(k => SUBJECT_NUM[k] === q.subject);
          if (pKey && comboCounts[pKey] != null) comboCounts[pKey]++;
        }
      } catch (e) {
        console.warn(`[combo-drills] ${target.id}: combo_pilot.js 집계 실패 — 자동 변환분만 인덱싱`, e.message);
      }
    }
    const idxBody = '// 자동 생성된 복수정답형 문항 수 인덱스입니다. 수정하지 마십시오. (tools/build_combo_drills.js)\n' +
      `var COMBO_INDEX = ${JSON.stringify(comboCounts)};\n` +
      'window.COMBO_INDEX = COMBO_INDEX;\n';
    fs.writeFileSync(path.join(OUT_DIR, 'combo_index.js'), idxBody, 'utf8');
  }

  console.log(`[combo-drills] ${target.id}: 총 ${totalItems}개 복수정답형 문항 생성${DRY_RUN ? ' (dry-run)' : ''}, 오류 ${totalErrors}건 → ${path.relative(ROOT, OUT_DIR)}/`);
}

async function main() {
  for (const target of getExamTargets(ROOT)) {
    await buildForExam(target);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
