#!/usr/bin/env node
/* ============================================================
 * tools/build_ox_drills.js
 * ------------------------------------------------------------
 * data/exams/subjectN.*.js (choice 문항)를 O/X 진위형 드릴 문항으로 펼친다.
 * docs/dev/COMBO_STUDY_STRATEGY.md §4-①: combo의 진술·single의 보기를 참/거짓 원자로 변환해
 * 진술 정확도(p)를 직접 훈련하는 문항을 자동 생성한다.
 *
 * 출력 형식 (src/questions.js 스키마, type:'ox'):
 *   mode 'fact'   — "이 보기의 내용이 옳은가?"  명제형 선지(문장형)
 *                   truth = 설명형 부정 발문이면 !isAnswer, 아니면 isAnswer
 *   mode 'answer' — "이 보기가 발문의 정답인가?" 회상형·분류형(고유명사·수치 선지)
 *                   truth = isAnswer (발문 극성 무관 — 정답성 자체가 판정 대상)
 *
 * 제외: ㄱㄴㄷ 조합형 발문, ①~⑤ 자기참조 선지
 *
 * 입력 : data/exams/*.js (EXAM_DATA_subjectN)
 * 출력 : data/drills/ox_subjectN.js  →  var OX_DRILLS_subjectN = [...]
 *
 * 사용 : node tools/build_ox_drills.js
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { stableId } = require('./build/id-factory.js');
const { inferTags } = require('./drill-utils.js');

const ROOT = path.resolve(__dirname, '..');
const EXAMS_DIR = path.join(ROOT, 'data', 'exams');
const OUT_DIR = path.join(ROOT, 'data', 'drills');

const AUTOGEN_HEADER = '// 자동 생성된 O/X 드릴 데이터입니다. 수정하지 마십시오. (tools/build_ox_drills.js)';

/* ---------- 발문 분류 ---------- */

// 명제를 뒤집는 설명형 부정 (옳지 않은 설명을 고르는 발문)
const NEG_DESC_RE = /옳지 ?않은|맞지 않는|틀린|잘못된|올바르지 않은|적합하지 않은|바람직하지 않은|부적절한|맞는 것이 아닌|일치하지 않는|거리가 먼|다른 것은|다른 하나는/;
// 설명형 긍정/판정 발문 (내용의 옳음을 묻는 발문)
const DESC_RE = /설명|내용|사항|방법|특징|작용|관한|대한|서술|순서|나열/;
// 조합형(ㄱㄴㄷ) 발문 — members 판정 불가, 제외
const COMBO_STEM_RE = /모두 고른|조합|ㄱ|ㄴ/;
// 자기참조 선지 (①②③④⑤ 언급) — 독립 명제가 아님
const SELF_REF_RE = /[①②③④⑤⑥⑦⑧⑨⑩]/;
// 문장형(명제) 선지: 서술 종결 어미로 끝나는지
const SENT_END_RE = /(다|음|함|임|됨|까|나|요)\.?$/;

function isPropositional(optText) {
  const t = String(optText || '').trim();
  return t.length >= 8 && SENT_END_RE.test(t);
}

function isComboStem(stem) {
  return COMBO_STEM_RE.test(stem);
}

/**
 * fact 모드용 맥락 정제: 발문에서 판정 절(옳은/옳지 않은 것은?)을 떼고 주제만 남긴다.
 * "다음 중 맞춤형화장품의 정의에 관한 설명으로 옳지 않은 것은?" → "맞춤형화장품의 정의에 관한 설명"
 */
function topicContext(stem) {
  const t = String(stem || '')
    .replace(/\s+/g, ' ')
    .replace(/^다음( 중)?\s*/, '')
    .replace(/(으로|로|중)?\s*(가장\s*)?(옳지 ?않은|옳은|맞지 않는|틀린|적절하지 않은|바람직하지 않은|부적절한|올바르지 않은|잘못된|맞는|해당하는|해당하지 않는|아닌|다른|거리가 먼|일치하지 않는|맞도록 나열된|바르게 나열된)\s*것은\?.*$/u, '')
    .trim();
  return t.length >= 4 ? t : stem;
}

/* ---------- 변환 ---------- */

function loadExamFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  // var EXAM_DATA_subjectN = { ... };
  const m = src.match(/var\s+EXAM_DATA_(\w+)\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!m) throw new Error(`EXAM_DATA 형식 아님: ${filePath}`);
  return { key: m[1], data: JSON.parse(m[2]) };
}

const SUBJECT_NUM = { subject1: 1, subject2: 2, subject3: 3, subject4: 4 };
const SUBJECT_KEY = { subject1: 'law', subject2: 'manufacturing', subject3: 'safety', subject4: 'understanding' };
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function buildOxItems(examKey, exam) {
  const items = [];
  const stats = { choice: 0, fact: 0, answer: 0, skipCombo: 0, skipSelfRef: 0, skipOther: 0, dup: 0 };
  const seen = new Set();
  const subject = SUBJECT_NUM[examKey];
  const subjKey = SUBJECT_KEY[examKey] || examKey;

  for (const q of exam.questions) {
    if (q.type !== 'choice') continue;
    stats.choice++;

    if (isComboStem(q.question)) { stats.skipCombo++; continue; }

    const answerIdx = CIRCLED.indexOf(q.answer);
    // 명제형 판정: 전체 선지의 60% 이상이 문장형이면 설명형 문항으로 간주
    const propCount = q.options.filter(isPropositional).length;
    const descriptive = propCount >= Math.ceil(q.options.length * 0.6);
    const negDesc = descriptive && NEG_DESC_RE.test(q.question);
    const mode = descriptive && (DESC_RE.test(q.question) || NEG_DESC_RE.test(q.question)) ? 'fact' : 'answer';
    const context = mode === 'fact' ? topicContext(q.question) : q.question;
    if (mode === 'fact') stats.fact++; else stats.answer++;

    q.options.forEach((optText, idx) => {
      if (SELF_REF_RE.test(optText)) { stats.skipSelfRef++; return; }
      const isAnswer = idx === answerIdx;
      // fact 모드에서 설명형 부정 발문이면 정답 보기가 거짓 명제
      const truth = negDesc ? !isAnswer : isAnswer;
      const dedupKey = `${context.replace(/\s+/g, '')}|${String(optText).replace(/\s+/g, '')}`;
      if (seen.has(dedupKey)) { stats.dup++; return; }
      seen.add(dedupKey);

      const statement = optText.trim();
      items.push({
        id: `ox-${String(subject).padStart(2, '0')}-${String(items.length + 1).padStart(4, '0')}`,
        subject,
        type: 'ox',
        points: 2,
        stem: mode === 'fact' ? '다음 보기의 내용이 옳은가? (O/X)' : '다음 보기가 발문의 정답인가? (O/X)',
        context,
        statement,
        truth,
        mode,
        sid: stableId(subjKey, 'bank', 'st', `${q.id}|${idx}|${statement}`),
        derivedFrom: `${q.id}#${idx + 1}`,
        explain: q.explanation || '',
        tags: [mode === 'fact' ? '명제판정' : '정답판정',
          ...inferTags(context || '', statement)],
        source: exam.title || examKey,
      });
    });
  }
  return { items, stats };
}

/* ---------- 메인 ---------- */

async function main() {
  if (!fs.existsSync(EXAMS_DIR)) {
    console.error(`[ox-drills] 입력 폴더 없음: ${EXAMS_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(EXAMS_DIR).filter(f => f.endsWith('.js')).sort();
  if (!files.length) {
    console.error('[ox-drills] data/exams에 번들이 없습니다. npm run build:data 먼저 실행하세요.');
    process.exit(1);
  }

  // 스키마 검증용 (ESM 모듈을 CJS에서 동적 import — Windows 절대경로는 file:// URL 필요)
  const { pathToFileURL } = require('url');
  const { validateQuestion } = await import(pathToFileURL(path.join(ROOT, 'src', 'questions.js')).href);

  let totalItems = 0;
  let totalErrors = 0;

  for (const file of files) {
    const { key, data } = loadExamFile(path.join(EXAMS_DIR, file));
    const { items, stats } = buildOxItems(key, data);

    // validateQuestion은 Question 객체를 요구 — ox 필드 채워서 검증
    const errs = [];
    for (const it of items) {
      const problems = validateQuestion(it);
      if (problems.length) errs.push(`${it.id}: ${problems.join(', ')}`);
    }
    totalErrors += errs.length;

    const body = AUTOGEN_HEADER + '\n' +
      `// 원본: data/exams/${file} — mode: fact(명제 판정) ${stats.fact}문 / answer(정답 판정) ${stats.answer}문\n` +
      `var OX_DRILLS_${key} = ` + JSON.stringify(items, null, 1) + ';\n';
    const outPath = path.join(OUT_DIR, `ox_${key}.js`);
    fs.writeFileSync(outPath, body, 'utf8');

    totalItems += items.length;
    console.log(`[ox-drills] ${key}: choice ${stats.choice} → ox ${items.length} (fact ${stats.fact}/answer ${stats.answer}, 조합형 스킵 ${stats.skipCombo}, 자기참조 ${stats.skipSelfRef})`);
    if (errs.length) {
      console.log(`  ⚠ 검증 오류 ${errs.length}건:`);
      errs.slice(0, 5).forEach(e => console.log('   -', e));
    }
  }

  console.log(`[ox-drills] 총 ${totalItems}개 O/X 문항 생성, 검증 오류 ${totalErrors}건 → ${path.relative(ROOT, OUT_DIR)}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
