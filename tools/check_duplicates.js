#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'content', '문제은행');
const files = [
  '과목1_문제은행_교재인용.md',
  '과목2_문제은행_교재인용.md',
  '과목3_문제은행_교재인용.md',
  '과목4_문제은행_교재인용.md',
];

for (const fname of files) {
  const fpath = path.join(baseDir, fname);
  const content = fs.readFileSync(fpath, 'utf8');
  const lines = content.split('\n');

  // Extract question text from "### Q<num>. <text>" lines
  const questions = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^### Q(\d+)\.\s+(.+)/);
    if (m) {
      questions.push({ qnum: parseInt(m[1]), text: m[2].trim(), line: i + 1 });
    }
  }

  console.log(`\n=== ${fname} === (${questions.length}문항)`);

  // Check for duplicate question text
  const byText = new Map();
  for (const q of questions) {
    const key = q.text.replace(/\s+/g, ' ').trim();
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(q);
  }

  let dupCount = 0;
  for (const [text, qs] of byText) {
    if (qs.length > 1) {
      dupCount++;
      console.log(`  중복: Q${qs.map(q => q.qnum).join(', Q')} (L${qs.map(q => q.line).join(', L')})`);
      console.log(`    "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
    }
  }

  // Also check for duplicate answer+question pairs (same question text AND same answer)
  const byFullBlock = new Map();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // Get the full question block (question + choices)
    const qStart = lines.findIndex((l, idx) => idx >= q.line - 1 && l.match(/^### Q/));
    let qEnd = q.line - 1;
    for (let j = q.line; j < lines.length; j++) {
      if (lines[j].match(/^---/) || lines[j].match(/^### Q/)) { qEnd = j; break; }
      qEnd = j;
    }
    const block = lines.slice(q.line - 1, qEnd).join(' ').replace(/\s+/g, ' ').trim();
    const key = block;
    if (!byFullBlock.has(key)) byFullBlock.set(key, []);
    byFullBlock.get(key).push(q);
  }

  let fullDupCount = 0;
  for (const [block, qs] of byFullBlock) {
    if (qs.length > 1) {
      fullDupCount++;
      console.log(`  완전중복(문항+선택지): Q${qs.map(q => q.qnum).join(', Q')}`);
    }
  }

  // Check for duplicate question numbers
  const byNum = new Map();
  for (const q of questions) {
    if (!byNum.has(q.qnum)) byNum.set(q.qnum, []);
    byNum.get(q.qnum).push(q);
  }
  for (const [num, qs] of byNum) {
    if (qs.length > 1) {
      console.log(`  번호중복: Q${num} (L${qs.map(q => q.line).join(', L')})`);
    }
  }

  if (dupCount === 0 && fullDupCount === 0) {
    console.log('  중복 없음 ✅');
  } else {
    console.log(`  요약: 질문 텍스트 중복 ${dupCount}건, 완전 중복 ${fullDupCount}건`);
  }
}

console.log('\n검사 완료.');
