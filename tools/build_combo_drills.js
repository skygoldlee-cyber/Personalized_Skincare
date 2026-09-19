#!/usr/bin/env node
/* ============================================================
 * tools/build_combo_drills.js
 * ------------------------------------------------------------
 * data/exams/subjectN.*.js (choice 문항)를 합답형(combo) 드릴 문항으로 변환한다.
 * 합답형 학습전략 §2-①: single 문항의 각 보기를 진술 원자로 펼치고
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

const ROOT = path.resolve(__dirname, '..');
const EXAMS_DIR = path.join(ROOT, 'data', 'exams');
const OUT_DIR = path.join(ROOT, 'data', 'drills');
const DRY_RUN = process.argv.includes('--dry-run');

const AUTOGEN_HEADER = '// 자동 생성된 합답형 드릴 데이터입니다. 수정하지 마십시오. (tools/build_combo_drills.js)';

/* ---------- 발문 분류 (build_ox_drills.js와 동일 기준) ---------- */

const NEG_DESC_RE = /옳지 ?않은|맞지 않는|틀린|잘못된|올바르지 않은|적합하지 않은|바람직하지 않은|부적절한|적절하지 않은|맞는 것이 아닌|일치하지 않는|거리가 먼|다른 것은|다른 하나는|해당하지 않는|해당되지 않는/;
const DESC_RE = /설명|내용|사항|방법|특징|작용|관한|대한|서술|순서|나열/;
const COMBO_STEM_RE = /모두 고른|조합|ㄱ|ㄴ/;
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

function buildComboItems(examKey, exam, genOpts) {
  const items = [];
  const stats = {
    choice: 0, fact: 0, answer: 0,
    skipComboStem: 0, skipStem: 0, skipNoTruth: 0, skipFew: 0,
    allOfAbove: 0, errors: [],
  };
  const subject = SUBJECT_NUM[examKey];
  const subjKey = SUBJECT_KEY[examKey] || examKey;

  for (const q of exam.questions) {
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
        text: String(optText).trim(),
        truth,
        explain: q.explanation || '',
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
    });

    items.push({
      id: `combo-${String(subject).padStart(2, '0')}-${String(items.length + 1).padStart(4, '0')}`,
      subject,
      type: 'combo',
      points: 4,
      citation: buildCitation(q, examKey, q.explanation),
      stem,
      statements,
      options,
      tags: ['자동변환', mode === 'fact' ? '명제판정' : '정답판정'],
      derivedFrom: q.id,
      explain: q.explanation || '',
      source: exam.title || examKey,
    });
    if (mode === 'fact') stats.fact++; else stats.answer++;
  }
  return { items, stats };
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

  let totalItems = 0;
  let totalErrors = 0;

  for (const file of files) {
    const { key, data } = loadExamFile(path.join(EXAMS_DIR, file));
    const { items, stats } = buildComboItems(key, data, generateComboOptions);

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
    }

    totalItems += valid.length;
    console.log(`[combo-drills] ${key}: choice ${stats.choice} → combo ${valid.length} (fact ${stats.fact}/answer ${stats.answer}, 조합발문 스킵 ${stats.skipComboStem}, '모두'복구 ${stats.allOfAbove})`);
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
