#!/usr/bin/env node
/**
 * 미발견 인용 링크를 상세히 추출하여 JSON으로 저장
 * 각 항목: examFile, relPath, oldLineNum, fingerprint, label, evidenceText(문제은행의 근거 텍스트)
 */
const fs = require('fs');
const path = require('path');

const EXAM_FILES = [
    'content/문제은행/과목1_문제.md',
    'content/문제은행/과목2_문제.md',
    'content/문제은행/과목3_문제.md',
    'content/문제은행/과목4_문제.md',
];

const ROOT = path.resolve(__dirname, '..');
const CITATION_RE = /\[([^\]]+?):\s*L(\d+)\]\(<([^>]+\.md)#L(\d+)>\)/g;
const EVIDENCE_RE = /📖\s*[^\[]*?\[L(\d+)\]\(<([^>]+\.md)#L(\d+)>\)/g;

const fileCache = {};
function getFileLines(filePath) {
    const abs = path.resolve(ROOT, filePath);
    if (fileCache[abs]) return fileCache[abs];
    const content = fs.readFileSync(abs, 'utf-8');
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    fileCache[abs] = lines;
    return lines;
}

function normalize(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[*_`#>|]/g, ' ')
        .replace(/\[([^\]]*?)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .trim()
        .toLowerCase();
}

function extractFingerprint(lineText) {
    const normalized = normalize(lineText);
    if (normalized.length <= 80) return normalized;
    return normalized.substring(0, 80);
}

function findLineByFingerprint(lines, fingerprint, originalLineNum) {
    if (!fingerprint) return null;
    if (originalLineNum <= lines.length) {
        const currentText = extractFingerprint(lines[originalLineNum - 1]);
        if (currentText === fingerprint) return originalLineNum;
    }
    const searchStart = Math.max(0, originalLineNum - 6);
    const searchEnd = Math.min(lines.length, originalLineNum + 5);
    for (let i = searchStart; i < searchEnd; i++) {
        if (extractFingerprint(lines[i]) === fingerprint) return i + 1;
    }
    for (let i = 0; i < lines.length; i++) {
        if (extractFingerprint(lines[i]) === fingerprint) return i + 1;
    }
    const fpNormalized = normalize(fingerprint);
    if (fpNormalized.length >= 10) {
        for (let i = 0; i < lines.length; i++) {
            const lineNormalized = normalize(lines[i]);
            if (lineNormalized.includes(fpNormalized)) return i + 1;
        }
    }
    return null;
}

const notFound = [];

for (const examFile of EXAM_FILES) {
    const examPath = path.resolve(ROOT, examFile);
    if (!fs.existsSync(examPath)) continue;
    const content = fs.readFileSync(examPath, 'utf-8');
    const examDir = path.dirname(examFile);
    const examLines = content.replace(/\r\n/g, '\n').split('\n');
    const seenUrls = new Set();

    // Main citations
    CITATION_RE.lastIndex = 0;
    let match;
    while ((match = CITATION_RE.exec(content)) !== null) {
        const label = match[1].trim();
        const textLineNum = parseInt(match[2]);
        const relPath = match[3];
        const urlLineNum = parseInt(match[4]);

        const resolved = path.resolve(ROOT, examDir, relPath);
        if (!fs.existsSync(resolved)) continue;
        const lines = getFileLines(resolved);
        if (urlLineNum < 1 || urlLineNum > lines.length) continue;

        const targetLine = lines[urlLineNum - 1];
        const fingerprint = extractFingerprint(targetLine);
        const newLineNum = findLineByFingerprint(lines, fingerprint, urlLineNum);

        if (newLineNum === null) {
            // Find the line number in the exam file where this citation appears
            const matchPos = match.index;
            // Find exam line number
            let examLineNum = 1;
            let pos = 0;
            for (let i = 0; i < examLines.length; i++) {
                if (pos + examLines[i].length + 1 > matchPos) {
                    examLineNum = i + 1;
                    break;
                }
                pos += examLines[i].length + 1;
            }
            // Get surrounding context from exam file (the evidence text)
            let evidenceText = '';
            for (let i = examLineNum; i < Math.min(examLineNum + 3, examLines.length); i++) {
                evidenceText += examLines[i] + '\n';
            }
            notFound.push({
                examFile,
                examLineNum,
                relPath,
                oldLineNum: urlLineNum,
                label,
                fingerprint: fingerprint.substring(0, 100),
                oldText: targetLine.substring(0, 200),
                evidenceText: evidenceText.substring(0, 500),
            });
            seenUrls.add(`${relPath}#L${urlLineNum}`);
        }
    }

    // Evidence citations
    EVIDENCE_RE.lastIndex = 0;
    while ((match = EVIDENCE_RE.exec(content)) !== null) {
        const textLineNum = parseInt(match[1]);
        const relPath = match[2];
        const urlLineNum = parseInt(match[3]);
        const urlKey = `${relPath}#L${urlLineNum}`;
        if (seenUrls.has(urlKey)) continue;

        const resolved = path.resolve(ROOT, examDir, relPath);
        if (!fs.existsSync(resolved)) continue;
        const lines = getFileLines(resolved);
        if (urlLineNum < 1 || urlLineNum > lines.length) continue;

        const targetLine = lines[urlLineNum - 1];
        const fingerprint = extractFingerprint(targetLine);
        const newLineNum = findLineByFingerprint(lines, fingerprint, urlLineNum);

        if (newLineNum === null) {
            const matchPos = match.index;
            let examLineNum = 1;
            let pos = 0;
            for (let i = 0; i < examLines.length; i++) {
                if (pos + examLines[i].length + 1 > matchPos) {
                    examLineNum = i + 1;
                    break;
                }
                pos += examLines[i].length + 1;
            }
            let evidenceText = '';
            for (let i = examLineNum; i < Math.min(examLineNum + 3, examLines.length); i++) {
                evidenceText += examLines[i] + '\n';
            }
            notFound.push({
                examFile,
                examLineNum,
                relPath,
                oldLineNum: urlLineNum,
                label: '근거',
                fingerprint: fingerprint.substring(0, 100),
                oldText: targetLine.substring(0, 200),
                evidenceText: evidenceText.substring(0, 500),
            });
        }
    }
}

const outFile = path.join(ROOT, 'tools', 'notfound_citations.json');
fs.writeFileSync(outFile, JSON.stringify(notFound, null, 2), 'utf-8');
console.log(`미발견 항목: ${notFound.length}개`);
console.log(`저장: ${outFile}`);

// Group by textbook file
const byFile = {};
for (const n of notFound) {
    const key = path.basename(n.relPath);
    if (!byFile[key]) byFile[key] = [];
    byFile[key].push(n);
}
console.log('\n과목별 미발견:');
for (const [k, v] of Object.entries(byFile)) {
    console.log(`  ${k}: ${v.length}개`);
}
