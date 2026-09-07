#!/usr/bin/env node
/**
 * Fix missing blank lines between answer blocks in all 4 exam files.
 */
const fs = require('fs');
const path = require('path');

const files = [
  '과목1_문제은행_교재인용.md',
  '과목2_문제은행_교재인용.md',
  '과목3_문제은행_교재인용.md',
  '과목4_문제은행_교재인용.md',
];

const baseDir = path.join(__dirname, '..', 'content', '문제은행');

for (const fname of files) {
  const fpath = path.join(baseDir, fname);
  let content = fs.readFileSync(fpath, 'utf8');
  const lines = content.split('\n');
  const fixes = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\*\*Q\d/)) {
      const prev = lines[i - 1] ? lines[i - 1].trim() : '';
      if (prev !== '' && prev !== '---') {
        fixes.push({ line: i, question: lines[i].substring(0, 30) });
      }
    }
  }

  if (fixes.length === 0) {
    console.log(`${fname}: no answer fixes needed`);
    continue;
  }

  // Apply fixes in reverse order
  for (let j = fixes.length - 1; j >= 0; j--) {
    const { line } = fixes[j];
    lines.splice(line, 0, '');
  }

  content = lines.join('\n');
  fs.writeFileSync(fpath, content, 'utf8');
  console.log(`${fname}: fixed ${fixes.length} answer separators`);
  fixes.forEach(f => console.log(`  L${f.line + 1}: ${f.question}`));
}

console.log('Answer separator fix complete.');
