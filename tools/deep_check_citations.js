#!/usr/bin/env node
/**
 * Deep check ⚠️ cases: search ±10 lines for 🎯 기출 marker
 */
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'content');

const warnings = [
  { subj: '과목1', qnum: 31, line: 691, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md') },
  { subj: '과목1', qnum: 43, line: 868, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md') },
  { subj: '과목1', qnum: 46, line: 1178, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md') },
  { subj: '과목1', qnum: 47, line: 998, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md') },
  { subj: '과목1', qnum: 54, line: 1275, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md') },
  { subj: '과목1', qnum: 59, line: 1304, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md') },
  { subj: '과목1', qnum: 75, line: 1317, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md') },
  { subj: '과목1', qnum: 87, line: 1557, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md') },
  { subj: '과목2', qnum: 154, line: 2126, txFile: path.join(baseDir, '교재', 'manufacturing', '2과목_제조및품질관리_표준형.md') },
  { subj: '과목3', qnum: 8, line: 1346, txFile: path.join(baseDir, '교재', 'safety', '3과목_유통화장품안전관리_표준형.md') },
  { subj: '과목3', qnum: 68, line: 1359, txFile: path.join(baseDir, '교재', 'safety', '3과목_유통화장품안전관리_표준형.md') },
  { subj: '과목3', qnum: 233, line: 1359, txFile: path.join(baseDir, '교재', 'safety', '3과목_유통화장품안전관리_표준형.md') },
];

for (const w of warnings) {
  const txContent = fs.readFileSync(w.txFile, 'utf8');
  const txLines = txContent.split('\n');
  
  console.log(`\n--- ${w.subj} Q${w.qnum} (L${w.line}) ---`);
  console.log(`  Current line: ${txLines[w.line - 1].substring(0, 100)}`);
  
  // Search ±10 for 🎯 기출
  let found = null;
  for (let d = -10; d <= 10; d++) {
    const idx = w.line - 1 + d;
    if (idx >= 0 && idx < txLines.length) {
      if (txLines[idx].includes('🎯') && txLines[idx].includes('기출')) {
        found = { offset: d, line: idx + 1, content: txLines[idx].substring(0, 100) };
        break;
      }
    }
  }
  
  if (found) {
    console.log(`  ✅ Found 🎯 기출 at L${found.line} (offset ${found.offset > 0 ? '+' : ''}${found.offset}): ${found.content}`);
  } else {
    console.log(`  ⚠️ No 🎯 기출 within ±10 lines. Searching wider...`);
    // Search ±30
    for (let d = -30; d <= 30; d++) {
      const idx = w.line - 1 + d;
      if (idx >= 0 && idx < txLines.length) {
        if (txLines[idx].includes('🎯') && txLines[idx].includes('기출')) {
          found = { offset: d, line: idx + 1, content: txLines[idx].substring(0, 100) };
          break;
        }
      }
    }
    if (found) {
      console.log(`  ✅ Found 🎯 기출 at L${found.line} (offset ${found.offset > 0 ? '+' : ''}${found.offset}): ${found.content}`);
    } else {
      console.log(`  ❌ No 🎯 기출 within ±30 lines!`);
    }
  }
}
