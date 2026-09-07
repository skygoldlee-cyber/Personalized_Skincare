#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const fixes = [
  // 과목1: change citation lines to 🎯 기출 lines
  { file: '과목1_문제은행_교재인용.md', qnum: 31, oldLine: 691, newLine: 638 },
  { file: '과목1_문제은행_교재인용.md', qnum: 43, oldLine: 868, newLine: 828 },
  { file: '과목1_문제은행_교재인용.md', qnum: 46, oldLine: 1178, newLine: 521 },
  { file: '과목1_문제은행_교재인용.md', qnum: 47, oldLine: 998, newLine: 811 },
  { file: '과목1_문제은행_교재인용.md', qnum: 54, oldLine: 1275, newLine: 753 },
  { file: '과목1_문제은행_교재인용.md', qnum: 59, oldLine: 1304, newLine: 509 },
  { file: '과목1_문제은행_교재인용.md', qnum: 75, oldLine: 1317, newLine: 576 },
  { file: '과목1_문제은행_교재인용.md', qnum: 87, oldLine: 1557, newLine: 521 },
  // 과목2: Q154 change to L2106
  { file: '과목2_문제은행_교재인용.md', qnum: 154, oldLine: 2126, newLine: 2106 },
  // 과목3: Q8, Q68, Q233 change to L1328
  { file: '과목3_문제은행_교재인용.md', qnum: 8, oldLine: 1346, newLine: 1328 },
  { file: '과목3_문제은행_교재인용.md', qnum: 68, oldLine: 1359, newLine: 1328 },
  { file: '과목3_문제은행_교재인용.md', qnum: 233, oldLine: 1359, newLine: 1328 },
];

const baseDir = path.join(__dirname, '..', 'content', '문제은행');

// Group by file
const byFile = {};
for (const f of fixes) {
  if (!byFile[f.file]) byFile[f.file] = [];
  byFile[f.file].push(f);
}

for (const [fname, items] of Object.entries(byFile)) {
  const fpath = path.join(baseDir, fname);
  let content = fs.readFileSync(fpath, 'utf8');
  
  for (const item of items) {
    const oldStr = `L${item.oldLine}`;
    const newStr = `L${item.newLine}`;
    // Replace in the answer block area - find Q{qnum} answer block
    const aMarker = `**Q${item.qnum}.**`;
    const aStart = content.indexOf(aMarker);
    if (aStart === -1) { console.log(`${fname} Q${item.qnum}: answer not found`); continue; }
    const aEnd = content.indexOf('\n**Q', aStart + 10);
    const section = aEnd === -1 ? content.substring(aStart) : content.substring(aStart, aEnd);
    
    const updated = section.split(oldStr).join(newStr);
    content = content.substring(0, aStart) + updated + (aEnd === -1 ? '' : content.substring(aEnd));
    console.log(`${fname} Q${item.qnum}: L${item.oldLine} -> L${item.newLine}`);
  }
  
  fs.writeFileSync(fpath, content, 'utf8');
}

console.log('Citation line fix complete.');
