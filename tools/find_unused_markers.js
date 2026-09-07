#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'content');

// 과목2 cited lines
const s2content = fs.readFileSync(path.join(baseDir, '문제은행', '과목2_문제은행_교재인용.md'), 'utf8');
const s2cited = new Set();
const s2matches = [...s2content.matchAll(/\[교재: L(\d+)\]/g)];
s2matches.forEach(m => s2cited.add(parseInt(m[1])));
console.log('과목2 cited lines:', [...s2cited].sort((a, b) => a - b).join(', '));

// 과목3 cited lines
const s3content = fs.readFileSync(path.join(baseDir, '문제은행', '과목3_문제은행_교재인용.md'), 'utf8');
const s3cited = new Set();
const s3matches = [...s3content.matchAll(/\[교재: L(\d+)\]/g)];
s3matches.forEach(m => s3cited.add(parseInt(m[1])));
console.log('과목3 cited lines:', [...s3cited].sort((a, b) => a - b).join(', '));

// Find unused 🎯 기출 lines
const s2tx = fs.readFileSync(path.join(baseDir, '교재', 'manufacturing', '2과목_제조및품질관리_표준형.md'), 'utf8').split('\n');
console.log('\n과목2 unused 🎯 기출 lines:');
for (let i = 0; i < s2tx.length; i++) {
  if (s2tx[i].includes('🎯') && s2tx[i].includes('기출') && !s2cited.has(i + 1)) {
    console.log('  L' + (i + 1) + ': ' + s2tx[i].trim().substring(0, 120));
  }
}

const s3tx = fs.readFileSync(path.join(baseDir, '교재', 'safety', '3과목_유통화장품안전관리_표준형.md'), 'utf8').split('\n');
console.log('\n과목3 unused 🎯 기출 lines:');
for (let i = 0; i < s3tx.length; i++) {
  if (s3tx[i].includes('🎯') && s3tx[i].includes('기출') && !s3cited.has(i + 1)) {
    console.log('  L' + (i + 1) + ': ' + s3tx[i].trim().substring(0, 120));
  }
}
