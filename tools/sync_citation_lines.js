#!/usr/bin/env node
/**
 * sync_citation_lines.js
 *
 * 교재 본문이 수정되어 라인 번호가 변경된 경우, 문제은행의 인용 링크 라인 번호를 자동으로 동기화합니다.
 *
 * 원리:
 * 1. 문제은행에서 모든 인용 링크 추출 (라인 번호 + 타겟 파일)
 * 2. 타겟 파일의 해당 라인에서 텍스트 지문(fingerprint) 수집
 * 3. 지문을 타겟 파일에서 재검색 → 현재 라인 번호 확인
 * 4. 라인 번호가 변경된 경우 문제은행 파일 자동 수정
 *
 * 사용법:
 *   node tools/sync_citation_lines.js          # 동기화 실행
 *   node tools/sync_citation_links.js --check   # 변경사항 확인만 (수정 안 함)
 *   node tools/sync_citation_links.js --fingerprint  # 지문 파일 생성/갱신
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
const FINGERPRINT_FILE = path.join(ROOT, 'tools', 'citation_fingerprints.json');

// Match all citation link patterns: [label: L####](<path#L####>)
const CITATION_RE = /\[([^\]]+?):\s*L(\d+)\]\(<([^>]+\.md)#L(\d+)>\)/g;
// Also match 근거 lines: **📖 ... 근거 ([L####](<path#L####>))**
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

/**
 * 라인 텍스트에서 검색용 지문을 추출합니다.
 * 짧은 라인은 전체를, 긴 라인은 앞부분 80자를 사용합니다.
 */
function extractFingerprint(lineText) {
    const normalized = normalize(lineText);
    if (normalized.length <= 80) return normalized;
    return normalized.substring(0, 80);
}

/**
 * 타겟 파일에서 지문이 포함된 라인을 검색합니다.
 * @returns {number|null} 새 라인 번호 (1-indexed), 미발견 시 null
 */
function findLineByFingerprint(lines, fingerprint, originalLineNum) {
    if (!fingerprint) return null;

    // 1. 원래 라인 번호에서 정확히 일치하는지 확인 (가장 빠름)
    if (originalLineNum <= lines.length) {
        const currentText = extractFingerprint(lines[originalLineNum - 1]);
        if (currentText === fingerprint) return originalLineNum;
    }

    // 2. ±5 라인 범위에서 검색 (작은 변경 대응)
    const searchStart = Math.max(0, originalLineNum - 6);
    const searchEnd = Math.min(lines.length, originalLineNum + 5);
    for (let i = searchStart; i < searchEnd; i++) {
        if (extractFingerprint(lines[i]) === fingerprint) return i + 1;
    }

    // 3. 전체 파일에서 검색 (큰 변경 대응)
    // 정확 매칭
    for (let i = 0; i < lines.length; i++) {
        if (extractFingerprint(lines[i]) === fingerprint) return i + 1;
    }

    // 4. 부분 매칭 (지문이 라인의 일부인 경우)
    const fpNormalized = normalize(fingerprint);
    if (fpNormalized.length >= 10) {
        for (let i = 0; i < lines.length; i++) {
            const lineNormalized = normalize(lines[i]);
            if (lineNormalized.includes(fpNormalized)) return i + 1;
        }
    }

    return null;
}

/**
 * 인용 링크에서 추출한 정보
 * { examFile, matchStart, matchEnd, label, textLineNum, relPath, urlLineNum, fingerprint }
 */
function extractCitations(examFile, content) {
    const citations = [];
    const examDir = path.dirname(examFile);
    const seenUrls = new Set();

    // Pass 1: Main citation links
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

        citations.push({
            type: 'main',
            examFile,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            fullMatch: match[0],
            label,
            textLineNum,
            urlLineNum,
            relPath,
            fingerprint,
        });

        seenUrls.add(`${relPath}#L${urlLineNum}`);
    }

    // Pass 2: Evidence/근거 links
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

        citations.push({
            type: 'evidence',
            examFile,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            fullMatch: match[0],
            label: '근거',
            textLineNum,
            urlLineNum,
            relPath,
            fingerprint,
        });
    }

    return citations;
}

/**
 * 문제은행 파일에서 인용 링크의 라인 번호를 갱신합니다.
 */
function updateExamFile(examFile, updates) {
    if (updates.length === 0) return;

    const examPath = path.resolve(ROOT, examFile);
    let content = fs.readFileSync(examPath, 'utf-8');

    // 뒤에서부터 수정 (offset 유지를 위해)
    updates.sort((a, b) => b.matchStart - a.matchStart);

    for (const upd of updates) {
        const oldMatch = upd.fullMatch;
        const newMatch = oldMatch
            .replace(`L${upd.oldLineNum}](`, `L${upd.newLineNum}](`)
            .replace(`#L${upd.oldLineNum}>`, `#L${upd.newLineNum}>`);
        content = content.substring(0, upd.matchStart) + newMatch + content.substring(upd.matchEnd);
    }

    fs.writeFileSync(examPath, content, 'utf-8');
}

// --- Main ---

const args = process.argv.slice(2);
const isCheckOnly = args.includes('--check');
const isFingerprint = args.includes('--fingerprint');

console.log('=== 인용 링크 라인 번호 동기화 ===\n');

if (isFingerprint) {
    // 지문 파일 생성/갱신
    const fingerprints = [];
    for (const examFile of EXAM_FILES) {
        const examPath = path.resolve(ROOT, examFile);
        if (!fs.existsSync(examPath)) continue;
        const content = fs.readFileSync(examPath, 'utf-8');
        const citations = extractCitations(examFile, content);
        for (const c of citations) {
            fingerprints.push({
                examFile,
                relPath: c.relPath,
                oldLineNum: c.urlLineNum,
                fingerprint: c.fingerprint,
            });
        }
    }
    fs.writeFileSync(FINGERPRINT_FILE, JSON.stringify(fingerprints, null, 2), 'utf-8');
    console.log(`지문 파일 생성: ${FINGERPRINT_FILE} (${fingerprints.length}개)`);
    process.exit(0);
}

let totalCitations = 0;
let totalUpdated = 0;
let totalNotFound = 0;
let totalUnchanged = 0;
const allUpdates = [];
const notFoundList = [];

for (const examFile of EXAM_FILES) {
    const examPath = path.resolve(ROOT, examFile);
    if (!fs.existsSync(examPath)) {
        console.log(`[건너뜀] ${examFile} - 파일 없음`);
        continue;
    }

    const content = fs.readFileSync(examPath, 'utf-8');
    const citations = extractCitations(examFile, content);
    const examDir = path.dirname(examFile);

    const updates = [];
    let unchanged = 0;
    let notFound = 0;

    for (const c of citations) {
        totalCitations++;
        const resolved = path.resolve(ROOT, examDir, c.relPath);
        const lines = getFileLines(resolved);

        const newLineNum = findLineByFingerprint(lines, c.fingerprint, c.urlLineNum);

        if (newLineNum === null) {
            notFound++;
            totalNotFound++;
            notFoundList.push({
                examFile,
                relPath: c.relPath,
                oldLineNum: c.urlLineNum,
                fingerprint: c.fingerprint.substring(0, 60),
                label: c.label,
            });
        } else if (newLineNum !== c.urlLineNum) {
            updates.push({
                matchStart: c.matchStart,
                matchEnd: c.matchEnd,
                fullMatch: c.fullMatch,
                oldLineNum: c.urlLineNum,
                newLineNum,
            });
            totalUpdated++;
            allUpdates.push({
                examFile,
                relPath: c.relPath,
                oldLineNum: c.urlLineNum,
                newLineNum,
                label: c.label,
            });
        } else {
            unchanged++;
            totalUnchanged++;
        }
    }

    console.log(`${examFile}: ${citations.length}개 링크, ${unchanged}개 동일, ${updates.length}개 갱신, ${notFound}개 미발견`);

    if (updates.length > 0 && !isCheckOnly) {
        updateExamFile(examFile, updates);
    }
}

console.log('\n=== 동기화 결과 ===');
console.log(`총 링크: ${totalCitations}`);
console.log(`동일 (변경 없음): ${totalUnchanged}`);
console.log(`갱신: ${totalUpdated}`);
console.log(`미발견: ${totalNotFound}`);

if (isCheckOnly) {
    console.log('\n[--check 모드] 파일 수정 없이 확인만 수행했습니다.');
}

if (allUpdates.length > 0) {
    console.log('\n=== 갱신 내역 ===');
    for (const u of allUpdates) {
        const fileName = path.basename(u.relPath);
        console.log(`  ${u.examFile.split('/').pop()} [${u.label}] ${fileName} L${u.oldLineNum} → L${u.newLineNum}`);
    }
}

if (notFoundList.length > 0) {
    console.log('\n=== ⚠️ 미발견 항목 (수동 확인 필요) ===');
    for (const n of notFoundList) {
        const fileName = path.basename(n.relPath);
        console.log(`  ${n.examFile.split('/').pop()} [${n.label}] ${fileName} L${n.oldLineNum}: "${n.fingerprint}..."`);
    }
}

if (totalNotFound > 0) {
    process.exit(1);
}
