// tools/build/supplements.js — 문제은행 출제 비중에 맞춘 학습 카드/퀴즈 목표 산출 + 보충 번들 생성
//
// [배경] 카드/퀴즈는 교재(용어 표·확인문제)에서 파생되어 과목별 수량이 교재 분량에 좌우된다.
//        문제은행 문항 수(100/250/250/400 = 시험 출제 비중)와 괴리가 있으므로,
//        문제은행 비율로 카드·퀴즈 목표치를 배분하고,
//        - 부족 과목: 문제은행 문항을 카드/퀴즈로 변환한 보충 번들(data/supplements/)을 생성해 채우고
//        - 초과 과목: 대시보드 표시 수치를 목표치로 상한 적용한다(실제 카드는 전량 학습 가능).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseExamFile } = require('./plugins/exams.plugin');

const OPTION_INDICATORS = ['①', '②', '③', '④', '⑤'];

function sha6(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex').substring(0, 6);
}

/** 최대잔여 방식 비례 배분 — 합계가 total과 정확히 일치하도록 보정 */
function apportion(total, weights) {
  const sumW = weights.reduce((a, w) => a + w, 0);
  const exact = weights.map(w => (sumW > 0 ? (total * w) / sumW : 0));
  const base = exact.map(x => Math.floor(x));
  let rem = total - base.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - base[i] })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rem && k < order.length; k++) base[order[k].i]++;
  return base;
}

/** 0..n-1 중 need개를 균등 간격으로 선택 (결정적) */
function pickSpreadIndices(n, need) {
  const out = new Set();
  if (need <= 0 || n <= 0) return out;
  for (let i = 0; i < need; i++) out.add(Math.floor((i * n) / need));
  return out;
}

/** exclude를 피해 균등 간격 선택 — 부족하면 제외분에서 보충 */
function pickSpreadExcluding(n, need, exclude) {
  const allowed = [];
  for (let i = 0; i < n; i++) if (!exclude.has(i)) allowed.push(i);
  const picked = new Set();
  const m = Math.min(need, allowed.length);
  for (let i = 0; i < m; i++) picked.add(allowed[Math.floor((i * allowed.length) / m)]);
  if (picked.size < need) {
    const rest = [];
    for (let i = 0; i < n; i++) if (!picked.has(i)) rest.push(i);
    for (let i = 0; i < rest.length && picked.size < need; i++) picked.add(rest[i]);
  }
  return picked;
}

function toSupplementQuiz(subjectKey, q) {
  return {
    id: `${subjectKey}_quiz_${sha6(`${subjectKey}|bank|q${q.num}|${q.answer}`)}`,
    category: '문제은행 보충',
    context: `문제은행 Q${q.num}`,
    question: q.question,
    answer: q.answer,
    type: q.type === 'ox' ? 'ox' : (q.type === 'choice' ? 'choice' : 'blank'),
    options: q.options && q.options.length ? q.options : null
  };
}

function toSupplementCard(subjectKey, q) {
  const stem = String(q.question || '').replace(/\s+/g, ' ').trim();
  let answerText = q.answer;
  if (q.type === 'choice') {
    const idx = OPTION_INDICATORS.indexOf(q.answer);
    if (idx >= 0 && q.options[idx]) answerText = `${q.answer} ${q.options[idx]}`;
  }
  const shortStem = stem.length > 30 ? stem.slice(0, 30) + '…' : stem;
  return {
    id: `${subjectKey}_card_${sha6(`${subjectKey}|bank|card|q${q.num}`)}`,
    category: '문제은행 보충',
    term: `[문제은행 Q${q.num}] ${shortStem}`,
    definition: `문제: ${stem}\n정답: ${answerText}\n해설: ${q.explanation || '별도의 상세 해설이 제공되지 않습니다.'}`,
    isKey: false,
    cardType: 'bank',
    importance: 45,
    difficulty: 'medium'
  };
}

/**
 * 과목별 목표치 산출 + 보충 번들 생성.
 * @param {object} manifest content/manifest.json
 * @param {object} rawCounts {subjectKey: {cards, quizzes}} 교재 파생 원본 수량
 * @param {object} ctx {workspaceDir}
 * @returns {{targets: Object<string,{cards:number,quizzes:number}>, files: Object<string,string>}}
 *   targets: 과목별 표시 목표치, files: 생성된 보충 번들 경로(과목키 → './data/supplements/…')
 */
function buildSupplements(manifest, rawCounts, ctx) {
  const outDir = path.join(ctx.workspaceDir, 'data', 'supplements');
  fs.mkdirSync(outDir, { recursive: true });

  // 과목키 → 문제은행 문항 수 / 문항 목록 (manifest.exams[].subject 기준 병합)
  const bankCount = {};
  const bankQuestions = {};
  manifest.exams.forEach(exam => {
    const filePath = path.join(ctx.workspaceDir, 'content', '문제은행', exam.file);
    const parsed = parseExamFile(filePath, exam.key, exam.title);
    bankCount[exam.subject] = (bankCount[exam.subject] || 0) + parsed.questions.length;
    bankQuestions[exam.subject] = (bankQuestions[exam.subject] || []).concat(parsed.questions);
  });

  const keys = manifest.subjects.map(s => s.key);
  const totalCards = keys.reduce((a, k) => a + (rawCounts[k] ? rawCounts[k].cards : 0), 0);
  const totalQuizzes = keys.reduce((a, k) => a + (rawCounts[k] ? rawCounts[k].quizzes : 0), 0);
  const weights = keys.map(k => bankCount[k] || 0);
  const cardTargets = apportion(totalCards, weights);
  const quizTargets = apportion(totalQuizzes, weights);

  const targets = {};
  const files = {};
  const generated = {};
  keys.forEach((key, i) => {
    const raw = rawCounts[key] || { cards: 0, quizzes: 0 };
    const tCards = cardTargets[i];
    const tQuizzes = quizTargets[i];
    targets[key] = { cards: tCards, quizzes: tQuizzes };
    generated[key] = { cards: 0, quizzes: 0 };

    const cardNeed = Math.max(0, tCards - raw.cards);
    const quizNeed = Math.max(0, tQuizzes - raw.quizzes);
    if (cardNeed === 0 && quizNeed === 0) return;

    const questions = (bankQuestions[key] || []).slice().sort((a, b) => a.num - b.num);
    const quizIdx = pickSpreadIndices(questions.length, quizNeed);
    const cardIdx = pickSpreadExcluding(questions.length, cardNeed, quizIdx);
    const quizzes = [...quizIdx].sort((a, b) => a - b).map(idx => toSupplementQuiz(key, questions[idx]));
    const cards = [...cardIdx].sort((a, b) => a - b).map(idx => toSupplementCard(key, questions[idx]));

    const filename = `${key}.js`;
    const jsContent =
      `// 자동 생성된 문제은행 보충 학습 데이터입니다. 수정하지 마십시오. (tools/build/supplements.js)\n` +
      `var STUDY_SUPPLEMENT_${key} = ${JSON.stringify({ cards, quizzes }, null, 2)};\n`;
    fs.writeFileSync(path.join(outDir, filename), jsContent, 'utf-8');
    files[key] = `./data/supplements/${filename}`;
    generated[key] = { cards: cards.length, quizzes: quizzes.length };
    console.log(`- Supplement ${key}: cards +${cards.length}, quizzes +${quizzes.length} (목표 ${tCards}/${tQuizzes})`);
  });

  // 목표를 채우지 못하게 된 과목은 없는지 로그 (문제은행 풀 부족 등)
  keys.forEach((key, i) => {
    const raw = rawCounts[key] || { cards: 0, quizzes: 0 };
    const pool = (bankQuestions[key] || []).length;
    if (raw.cards < cardTargets[i] && raw.cards + pool < cardTargets[i]) {
      console.warn(`Warning: ${key} 카드 목표 ${cardTargets[i]} 미달 가능 (원본 ${raw.cards} + 문제은행 풀 ${pool})`);
    }
  });

  return { targets, files, generated };
}

module.exports = { buildSupplements, apportion };
