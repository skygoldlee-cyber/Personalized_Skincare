#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'content');

const updates = [
  // 과목1
  { file: '과목1_문제은행_교재인용.md', qnum: 31, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'), line: 638 },
  { file: '과목1_문제은행_교재인용.md', qnum: 43, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'), line: 828 },
  { file: '과목1_문제은행_교재인용.md', qnum: 46, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'), line: 521 },
  { file: '과목1_문제은행_교재인용.md', qnum: 47, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'), line: 811 },
  { file: '과목1_문제은행_교재인용.md', qnum: 54, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'), line: 753 },
  { file: '과목1_문제은행_교재인용.md', qnum: 59, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'), line: 509 },
  { file: '과목1_문제은행_교재인용.md', qnum: 75, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'), line: 576 },
  { file: '과목1_문제은행_교재인용.md', qnum: 87, txFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'), line: 521 },
  // 과목2
  { file: '과목2_문제은행_교재인용.md', qnum: 154, txFile: path.join(baseDir, '교재', 'manufacturing', '2과목_제조및품질관리_표준형.md'), line: 2106 },
  // 과목3
  { file: '과목3_문제은행_교재인용.md', qnum: 8, txFile: path.join(baseDir, '교재', 'safety', '3과목_유통화장품안전관리_표준형.md'), line: 1328 },
  { file: '과목3_문제은행_교재인용.md', qnum: 68, txFile: path.join(baseDir, '교재', 'safety', '3과목_유통화장품안전관리_표준형.md'), line: 1328 },
  { file: '과목3_문제은행_교재인용.md', qnum: 233, txFile: path.join(baseDir, '교재', 'safety', '3과목_유통화장품안전관리_표준형.md'), line: 1328 },
];

// Group by file
const byFile = {};
for (const u of updates) {
  if (!byFile[u.file]) byFile[u.file] = [];
  byFile[u.file].push(u);
}

for (const [fname, items] of Object.entries(byFile)) {
  const fpath = path.join(baseDir, '문제은행', fname);
  let content = fs.readFileSync(fpath, 'utf8');
  
  for (const item of items) {
    const txContent = fs.readFileSync(item.txFile, 'utf8');
    const txLines = txContent.split('\n');
    const txLine = txLines[item.line - 1].trim();
    
    // Find answer block
    const aMarker = `**Q${item.qnum}.**`;
    const aStart = content.indexOf(aMarker);
    if (aStart === -1) { console.log(`${fname} Q${item.qnum}: not found`); continue; }
    
    // Find the next answer block or end
    const nextA = content.indexOf('\n**Q', aStart + 10);
    const aEnd = nextA === -1 ? content.length : nextA;
    let section = content.substring(aStart, aEnd);
    
    // Replace the evidence text line (the line after "📖 교재 근거")
    // Find the evidence line pattern: "> | old text |" or "> old text"
    const evidenceStart = section.indexOf('> **📖 교재 근거');
    if (evidenceStart === -1) { console.log(`${fname} Q${item.qnum}: no evidence section`); continue; }
    
    // Find the end of the evidence header line
    const evidenceHeaderEnd = section.indexOf('\n', evidenceStart);
    // The next line(s) starting with "> " contain the evidence text
    const afterHeader = section.substring(evidenceHeaderEnd + 1);
    
    // Find the first content line after the header (starts with "> ")
    const lineMatch = afterHeader.match(/^> (.+)$/m);
    if (!lineMatch) { console.log(`${fname} Q${item.qnum}: no evidence text found`); continue; }
    
    const oldEvidenceLine = lineMatch[0];
    const newEvidenceLine = '> ' + txLine;
    
    section = section.replace(oldEvidenceLine, newEvidenceLine);
    content = content.substring(0, aStart) + section + content.substring(aEnd);
    
    console.log(`${fname} Q${item.qnum}: evidence updated to L${item.line} => ${txLine.substring(0, 80)}`);
  }
  
  fs.writeFileSync(fpath, content, 'utf8');
}

console.log('Evidence text update complete.');
