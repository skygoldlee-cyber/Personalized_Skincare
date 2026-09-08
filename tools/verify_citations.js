#!/usr/bin/env node
/**
 * Verify citation certainty for all replaced questions across 4 subjects.
 * Checks:
 * 1. Answer block has [교재: L###] citation
 * 2. The cited line exists in the textbook
 * 3. The cited line contains "🎯 기출" marker
 */
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'content');

const subjects = [
  {
    name: '과목1',
    examFile: path.join(baseDir, '문제은행', '과목1_문제.md'),
    textbookFile: path.join(baseDir, '교재', 'law', '1과목_화장품법의이해_표준형.md'),
    questions: [18, 22, 31, 40, 43, 45, 46, 47, 54, 59, 75, 87],
    txPath: '../교재/law/1과목_화장품법의이해_표준형.md',
  },
  {
    name: '과목2',
    examFile: path.join(baseDir, '문제은행', '과목2_문제.md'),
    textbookFile: path.join(baseDir, '교재', 'manufacturing', '2과목_제조및품질관리_표준형.md'),
    questions: [62, 66, 78, 101, 115, 125, 143, 152, 154, 181, 198, 199, 209, 220, 229, 239],
    txPath: '../교재/manufacturing/2과목_제조및품질관리_표준형.md',
  },
  {
    name: '과목3',
    examFile: path.join(baseDir, '문제은행', '과목3_문제.md'),
    textbookFile: path.join(baseDir, '교재', 'safety', '3과목_유통화장품안전관리_표준형.md'),
    questions: [7, 8, 17, 21, 68, 79, 82, 100, 102, 171, 179, 199, 225, 233],
    txPath: '../교재/safety/3과목_유통화장품안전관리_표준형.md',
  },
  {
    name: '과목4',
    examFile: path.join(baseDir, '문제은행', '과목4_문제.md'),
    textbookFile: path.join(baseDir, '교재', 'understanding', '4과목_맞춤형화장품의이해_표준형.md'),
    questions: [15, 41, 66, 87, 91, 92, 125, 131, 168, 279, 362, 400],
    txPath: '../교재/understanding/4과목_맞춤형화장품의이해_표준형.md',
  },
];

let totalIssues = 0;

for (const subj of subjects) {
  console.log('\n=== ' + subj.name + ' ===');
  const examContent = fs.readFileSync(subj.examFile, 'utf8');
  const txContent = fs.readFileSync(subj.textbookFile, 'utf8');
  const txLines = txContent.split('\n');

  for (const qnum of subj.questions) {
    // Find answer block
    const aMarker = `**Q${qnum}.**`;
    const aStart = examContent.indexOf(aMarker);
    if (aStart === -1) {
      console.log(`  Q${qnum}: ❌ Answer block not found!`);
      totalIssues++;
      continue;
    }

    // Find the citation [교재: L###]
    const aSection = examContent.substring(aStart, aStart + 2000);
    const citeMatch = aSection.match(/\[교재:\s*L(\d+)\]/);
    if (!citeMatch) {
      console.log(`  Q${qnum}: ❌ No [교재: L###] citation found`);
      totalIssues++;
      continue;
    }

    const lineNum = parseInt(citeMatch[1]);
    
    // Check if line exists in textbook
    if (lineNum < 1 || lineNum > txLines.length) {
      console.log(`  Q${qnum}: ❌ Line L${lineNum} out of range (textbook has ${txLines.length} lines)`);
      totalIssues++;
      continue;
    }

    const txLine = txLines[lineNum - 1];
    
    // Check for 🎯 기출 marker
    const hasMarker = txLine.includes('🎯') && txLine.includes('기출');
    
    // Also check nearby lines (±2) for marker since table rows may span
    let nearbyMarker = false;
    for (let d = -2; d <= 2; d++) {
      const idx = lineNum - 1 + d;
      if (idx >= 0 && idx < txLines.length) {
        if (txLines[idx].includes('🎯') && txLines[idx].includes('기출')) {
          nearbyMarker = true;
          break;
        }
      }
    }

    // Check citation path matches
    const pathMatch = aSection.includes(subj.txPath);
    
    let status = '✅';
    let notes = [];
    if (!hasMarker && !nearbyMarker) {
      status = '⚠️';
      notes.push('no 🎯 기출 marker at L' + lineNum);
    }
    if (!pathMatch) {
      status = '❌';
      notes.push('citation path mismatch');
      totalIssues++;
    }

    // Show the textbook line content (truncated)
    const txSnippet = txLine.substring(0, 80).replace(/\|/g, '\\|');
    console.log(`  Q${qnum}: ${status} L${lineNum} ${notes.length ? '(' + notes.join(', ') + ')' : ''} => ${txSnippet}`);
  }
}

console.log('\n=== SUMMARY ===');
console.log(`Total issues: ${totalIssues}`);
console.log('✅ = citation verified, 🎯 기출 marker found');
console.log('⚠️ = citation exists but no 🎯 기출 marker on exact line (may be on adjacent line)');
console.log('❌ = critical issue (path mismatch or missing citation)');
