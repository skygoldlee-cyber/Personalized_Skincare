#!/usr/bin/env node
/**
 * 미발견 인용 링크의 새 라인 번호를 찾아 갱신 (v5)
 *
 * 전략: git history에서 이전 교재 내용을 가져와 정확히 검색
 * 1. git show HEAD~1:교재파일 로 이전 버전의 교재 내용 가져오기
 * 2. 이전 버전에서 oldLineNum에 해당하는 라인 내용 추출
 * 3. 현재 교재에서 해당 내용 검색 → 새 라인 번호 확인
 * 4. 검색 안 되면(재작성된 경우) 증거 텍스트에서 구문 추출해 검색
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EXAM_FILES = [
    'content/문제은행/과목1_문제.md',
    'content/문제은행/과목2_문제.md',
    'content/문제은행/과목3_문제.md',
    'content/문제은행/과목4_문제.md',
];

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

// Cache for old textbook versions from git
const oldFileCache = {};
function getOldFileLines(relPath) {
    if (oldFileCache[relPath]) return oldFileCache[relPath];
    try {
        // Get the previous version (before our rewrite commit)
        const gitPath = relPath.replace(/\\/g, '/');
        const content = execSync(`git show HEAD~1:"${gitPath}"`, {
            cwd: ROOT,
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
        });
        const lines = content.replace(/\r\n/g, '\n').split('\n');
        oldFileCache[relPath] = lines;
        return lines;
    } catch (e) {
        console.error(`Failed to get old version of ${relPath}: ${e.message}`);
        oldFileCache[relPath] = [];
        return [];
    }
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
        if (extractFingerprint(lines[originalLineNum - 1]) === fingerprint) return originalLineNum;
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
            if (normalize(lines[i]).includes(fpNormalized)) return i + 1;
        }
    }
    return null;
}

/**
 * 이전 버전의 라인 내용에서 검색용 구문 추출
 */
function extractPhrasesFromOldLine(oldLine) {
    const phrases = [];

    // Clean the line
    let clean = oldLine
        .replace(/^>\s*/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\|/g, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[([^\]]*?)\]\([^)]*\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

    if (clean.length < 3) return phrases;

    // Add the full cleaned line
    if (clean.length >= 5) phrases.push(clean);

    // Split by delimiters and add chunks
    const chunks = clean.split(/[·,;:()/]/).map(c => c.trim()).filter(c => c.length >= 4);
    for (const chunk of chunks) {
        if (!phrases.includes(chunk)) phrases.push(chunk);
    }

    // Sort by length descending (longest = most specific first)
    phrases.sort((a, b) => b.length - a.length);
    return phrases;
}

/**
 * 교재에서 구문이 포함된 라인 검색
 * 가장 긴 구문부터 시도하여 정확도 향상
 */
function findLineByPhrases(lines, phrases, oldLineNum) {
    if (phrases.length === 0) return null;

    for (const phrase of phrases) {
        if (phrase.length < 4) continue;

        const phraseNorm = normalize(phrase);
        if (phraseNorm.length < 4) continue;

        const matches = [];
        for (let i = 0; i < lines.length; i++) {
            const lineNorm = normalize(lines[i]);
            if (lineNorm.includes(phraseNorm)) {
                matches.push({ line: i + 1, distance: Math.abs(i + 1 - oldLineNum) });
            }
        }

        if (matches.length === 1) {
            return matches[0].line;
        }

        if (matches.length > 1) {
            // Multiple matches - prefer closest to old line number
            matches.sort((a, b) => a.distance - b.distance);
            return matches[0].line;
        }
    }

    return null;
}

let totalUpdated = 0;
let totalNotFound = 0;
let totalUnchanged = 0;
const stillNotFound = [];

for (const examFile of EXAM_FILES) {
    const examPath = path.resolve(ROOT, examFile);
    if (!fs.existsSync(examPath)) continue;

    const content = fs.readFileSync(examPath, 'utf-8');
    const examDir = path.dirname(examFile);

    // Collect ALL links (both main and evidence) WITHOUT deduplication
    const allLinks = [];

    CITATION_RE.lastIndex = 0;
    let match;
    while ((match = CITATION_RE.exec(content)) !== null) {
        allLinks.push({
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            fullMatch: match[0],
            label: match[1].trim(),
            urlLineNum: parseInt(match[4]),
            relPath: match[3],
        });
    }

    EVIDENCE_RE.lastIndex = 0;
    while ((match = EVIDENCE_RE.exec(content)) !== null) {
        allLinks.push({
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            fullMatch: match[0],
            label: '근거',
            urlLineNum: parseInt(match[3]),
            relPath: match[2],
        });
    }

    // Step 1: Find new line numbers for each unique (relPath, urlLineNum)
    const lineMapping = new Map();
    const processedKeys = new Set();

    for (const link of allLinks) {
        const key = `${link.relPath}#${link.urlLineNum}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const resolved = path.resolve(ROOT, examDir, link.relPath);
        if (!fs.existsSync(resolved)) continue;
        const lines = getFileLines(resolved);
        if (link.urlLineNum < 1 || link.urlLineNum > lines.length) continue;

        const targetLine = lines[link.urlLineNum - 1];
        const fingerprint = extractFingerprint(targetLine);
        const newLineNum = findLineByFingerprint(lines, fingerprint, link.urlLineNum);

        if (newLineNum !== null) {
            if (newLineNum !== link.urlLineNum) {
                lineMapping.set(key, newLineNum);
            } else {
                totalUnchanged++;
            }
        } else {
            // Fingerprint failed - get old textbook content from git
            // Convert relPath to git path
            const gitRelPath = link.relPath.replace(/^\.\.\//, '').replace(/\//g, '/');

            // Resolve relative to exam file directory
            const textbookAbsPath = path.resolve(ROOT, examDir, link.relPath);
            const textbookRelPath = path.relative(ROOT, textbookAbsPath).replace(/\\/g, '/');

            const oldLines = getOldFileLines(textbookRelPath);

            if (link.urlLineNum >= 1 && link.urlLineNum <= oldLines.length) {
                const oldLineContent = oldLines[link.urlLineNum - 1];
                const phrases = extractPhrasesFromOldLine(oldLineContent);
                const bestMatch = findLineByPhrases(lines, phrases, link.urlLineNum);

                if (bestMatch !== null) {
                    lineMapping.set(key, bestMatch);
                } else {
                    totalNotFound++;
                    stillNotFound.push({
                        examFile,
                        relPath: link.relPath,
                        oldLineNum: link.urlLineNum,
                        oldLineContent: oldLineContent.substring(0, 150),
                        phrases: phrases.slice(0, 3),
                    });
                }
            } else {
                totalNotFound++;
                stillNotFound.push({
                    examFile,
                    relPath: link.relPath,
                    oldLineNum: link.urlLineNum,
                    oldLineContent: '(out of range)',
                    phrases: [],
                });
            }
        }
    }

    // Step 2: Apply updates to ALL links
    const updates = [];
    for (const link of allLinks) {
        const key = `${link.relPath}#${link.urlLineNum}`;
        if (lineMapping.has(key)) {
            updates.push({
                matchStart: link.matchStart,
                matchEnd: link.matchEnd,
                fullMatch: link.fullMatch,
                oldLineNum: link.urlLineNum,
                newLineNum: lineMapping.get(key),
            });
        }
    }

    if (updates.length > 0) {
        let newContent = content;
        updates.sort((a, b) => b.matchStart - a.matchStart);
        for (const upd of updates) {
            const newMatch = upd.fullMatch
                .replace(`L${upd.oldLineNum}](`, `L${upd.newLineNum}](`)
                .replace(`#L${upd.oldLineNum}>`, `#L${upd.newLineNum}>`);
            newContent = newContent.substring(0, upd.matchStart) + newMatch + newContent.substring(upd.matchEnd);
        }
        fs.writeFileSync(examPath, newContent, 'utf-8');
    }

    totalUpdated += updates.length;
    console.log(`${examFile}: ${allLinks.length}개 링크, ${updates.length}개 갱신, ${lineMapping.size}개 매핑`);
}

console.log('\n=== 결과 ===');
console.log(`갱신: ${totalUpdated}, 동일: ${totalUnchanged}, 미발견: ${totalNotFound}`);

if (stillNotFound.length > 0) {
    console.log(`\n=== ⚠️ 미발견: ${stillNotFound.length}개 ===`);
    for (const n of stillNotFound) {
        console.log(`  ${path.basename(n.examFile)} ${path.basename(n.relPath)} L${n.oldLineNum}`);
        console.log(`    이전내용: ${n.oldLineContent.substring(0, 100)}`);
        if (n.phrases.length > 0) {
            console.log(`    구문: ${n.phrases.join(' | ')}`);
        }
    }
    fs.writeFileSync(
        path.join(ROOT, 'tools', 'still_notfound.json'),
        JSON.stringify(stillNotFound, null, 2), 'utf-8'
    );
}
