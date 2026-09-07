#!/usr/bin/env node
/**
 * Verify ALL citation line numbers in exam files against actual textbook files.
 * Checks:
 * 1. Citation link target file exists
 * 2. Target line number is within file range
 * 3. Target line is not empty or separator
 * 4. Link line number (L#### in text) matches target line number (#L#### in URL)
 */
const fs = require('fs');
const path = require('path');

const EXAM_FILES = [
    'content/문제은행/과목1_문제은행_교재인용.md',
    'content/문제은행/과목2_문제은행_교재인용.md',
    'content/문제은행/과목3_문제은행_교재인용.md',
    'content/문제은행/과목4_문제은행_교재인용.md',
];

const ROOT = path.resolve(__dirname, '..');

// Extract all citation links: [교재: L####](<../교재/.../*.md#L####>)
const CITATION_RE = /\[교재:\s*L(\d+)\]\(<([^>]+\.md)#L(\d+)>\)/g;

let totalChecked = 0;
let totalErrors = 0;
let totalLinks = 0;
const errors = [];
const fileCache = {};

function getFileLines(filePath) {
    const abs = path.resolve(ROOT, filePath);
    if (fileCache[abs]) return fileCache[abs];
    const content = fs.readFileSync(abs, 'utf-8');
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    fileCache[abs] = lines;
    return lines;
}

for (const examFile of EXAM_FILES) {
    const examPath = path.resolve(ROOT, examFile);
    if (!fs.existsSync(examPath)) {
        console.log(`\n!! 파일 없음: ${examFile}`);
        continue;
    }
    const content = fs.readFileSync(examPath, 'utf-8');
    const examDir = path.dirname(examFile);
    let fileLinks = 0;
    let fileErrors = 0;

    let match;
    while ((match = CITATION_RE.exec(content)) !== null) {
        const linkLineNum = parseInt(match[1]);
        const relPath = match[2];
        const targetLineNum = parseInt(match[3]);

        totalLinks++;
        fileLinks++;

        // Resolve relative path
        const resolved = path.resolve(ROOT, examDir, relPath).replace(/\\/g, '/');
        const relResolved = path.relative(ROOT, resolved).replace(/\\/g, '/');

        // Check 1: file exists
        if (!fs.existsSync(resolved)) {
            errors.push(`[${examFile}] 파일 없음: ${relResolved} (L${linkLineNum} → L${targetLineNum})`);
            totalErrors++;
            fileErrors++;
            continue;
        }

        // Check 2: line number within range
        const lines = getFileLines(resolved);
        if (targetLineNum < 1 || targetLineNum > lines.length) {
            errors.push(`[${examFile}] 라인 범위 초과: ${relResolved} L${targetLineNum} (총 ${lines.length}줄, 링크 L${linkLineNum})`);
            totalErrors++;
            fileErrors++;
            continue;
        }

        // Check 3: target line not empty
        const targetLine = lines[targetLineNum - 1].trim();
        if (targetLine === '' || targetLine === '---') {
            errors.push(`[${examFile}] 빈 라인: ${relResolved} L${targetLineNum} (링크 L${linkLineNum}) → "${targetLine}"`);
            totalErrors++;
            fileErrors++;
            continue;
        }

        // Check 4: link line number matches URL line number
        if (linkLineNum !== targetLineNum) {
            errors.push(`[${examFile}] 라인번호 불일치: 텍스트 L${linkLineNum} vs URL L${targetLineNum} (${relResolved})`);
            totalErrors++;
            fileErrors++;
        }

        totalChecked++;
    }

    console.log(`${examFile}: ${fileLinks}개 링크, ${fileErrors}개 오류`);
}

console.log(`\n=== 전수검증 결과 ===`);
console.log(`총 링크: ${totalLinks}`);
console.log(`검증 완료: ${totalChecked}`);
console.log(`오류: ${totalErrors}`);

if (errors.length > 0) {
    console.log(`\n=== 오류 목록 ===`);
    errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
} else {
    console.log('\n✅ 모든 인용 라인 번호가 유효합니다.');
}
