#!/usr/bin/env node
/**
 * sync_citation_lines.js
 *
 * 교재 본문이 수정되어 라인 번호가 변경된 경우, 문제은행의 인용 링크 라인 번호를 자동으로 동기화합니다.
 *
 * 원리:
 * 1. 문제은행에서 모든 인용 링크 추출 (라인 번호 + 타겟 파일 + 뒤따르는 인용문)
 * 2. 타겟 파일의 해당 라인에서 텍스트 지문(fingerprint) 수집
 * 3. 지문을 타겟 파일에서 재검색 → 현재 라인 번호 확인
 *    - 구 라인이 파일 범위를 벗어난 경우: 인용문 자체를 지문으로 사용해 재탐색
 * 4. 라인 번호가 변경된 경우 문제은행 파일 자동 수정
 *
 * 사용법:
 *   node tools/sync_citation_lines.js          # 동기화 실행
 *   node tools/sync_citation_lines.js --check   # 변경사항 확인만 (수정 안 함)
 *   node tools/sync_citation_lines.js --fingerprint  # 지문 파일 생성/갱신
 */
const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./build/exam-targets');

const ROOT = path.resolve(__dirname, '..');

// [멀티시험] 각 시험의 {contentRoot}/문제은행/ 아래 manifest 등록 파일을 대상으로 한다.
function collectExamFiles() {
    const files = [];
    for (const target of getExamTargets(ROOT)) {
        if (!target.manifest) continue;
        for (const exam of target.manifest.exams || []) {
            const rel = `${target.contentRoot}/문제은행/${exam.file}`;
            if (!files.includes(rel)) files.push(rel);
        }
    }
    return files;
}

const EXAM_FILES = collectExamFiles();
const FINGERPRINT_FILE = path.join(ROOT, 'tools', 'config', 'citation_fingerprints.json');

// Match citation link patterns: [라벨 ... L####](<path#L####>)
// 라벨은 "교재: L123", "교재: 2과목 L1091", "참조: L289" 등 다양한 형태 허용
const CITATION_RE = /\[([^\]]*?)\bL(\d+)\]\(<([^>]+\.md)#L(\d+)>\)/g;
// 근거 헤더: **📖 ... 근거 ([라벨 L####](<path#L####>))**
const EVIDENCE_RE = /📖\s*[^\n]*?\(\[([^\]]*?)\bL(\d+)\]\(<([^>]+\.md)#L(\d+)>\)\)/g;

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

// 인용문 매칭용 강한 정규화 (태그·공백·마크업·표 기호 전부 제거)
function normalizeStrict(text) {
    return text
        .replace(/<[^>]*>/g, '')
        .replace(/[\s*_`#>|★🎯⚠️📖🧠📌🔍\[\]()（）「」-]+/g, '');
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
 * 인용문에서 검색용 조각(frags)을 추출합니다.
 * - 각 인용 라인을 강하게 정규화해 10자 이상 조각을 반환
 */
// ±3 검증에는 4자 이상 조각을 사용하고, 전체 파일 재탐색에는 10자 이상만 사용
// (짧은 조각은 인용 라인 근처 검증에는 안전하지만 전체 탐색에서는 오탐 위험)
function extractQuoteFrags(quoteLines, minLen = 4) {
    return quoteLines
        .map(q => normalizeStrict(q.replace(/\[[^\]]*\]\(<[^>]*>\)/g, ' ')))
        .filter(f => f.length >= minLen);
}

/**
 * 인용문의 굵은 글씨/제목 키프레이즈 추출 (정확 매칭 실패 시 폴백)
 */
function extractKeyPhrases(quoteLines) {
    const keys = [];
    for (const q of quoteLines) {
        for (const m of q.matchAll(/\*\*([^*]{3,40})\*\*/g)) {
            const k = normalizeStrict(m[1]).replace(/기출|근거|참고|주의|정답|해설/g, '');
            if (k.length >= 4) keys.push(k);
        }
        const h = q.match(/^#+\s*(.+)/);
        if (h) keys.push(normalizeStrict(h[1]));
        const pn = q.match(/\((\d+)\)\s*([^|·•,]{4,40})/);
        if (pn) keys.push(normalizeStrict(pn[2]));
    }
    return keys.filter((v, i, a) => a.indexOf(v) === i && v.length >= 4);
}

/**
 * 인용문 쉥글(10자 연속 부분문자열) 생성
 */
function makeShingles(text, k = 10, step = 5) {
    const out = [];
    for (let i = 0; i + k <= text.length; i += step) out.push(text.slice(i, i + k));
    return out;
}

/**
 * 인용문 지문으로 타겟 파일에서 위치를 재탐색합니다.
 * 정확 포함 → 쉥글(2개 이상) → 키프레이즈 순으로 시도합니다.
 * @returns {{line:number, confidence:'exact'|'shingle'|'key'}|null}
 */
function findLineByQuote(lines, quoteFrags, keyPhrases, nearLine) {
    // 1. 정확 포함: 10자 이상 조각만 전체 탐색에 사용 (짧은 조각 오탐 방지)
    for (const frag of quoteFrags) {
        if (frag.length < 10) continue;
        for (let i = 0; i < lines.length; i++) {
            if (normalizeStrict(lines[i]).includes(frag)) return { line: i + 1, confidence: 'exact' };
        }
    }
    // 2. 쉥글 매칭: 인용문 전체의 10자 쉥글이 한 라인에 2개 이상
    const sh = makeShingles(quoteFrags.join(''));
    if (sh.length >= 2) {
        let best = null;
        for (let i = 0; i < lines.length; i++) {
            const n = normalizeStrict(lines[i]);
            if (n.length < 10) continue;
            let cnt = 0;
            for (const s of sh) if (n.includes(s)) cnt++;
            if (cnt >= 2) {
                const d = Math.abs(i + 1 - (nearLine || 0));
                if (!best || d < best.d) best = { line: i + 1, d, cnt };
            }
        }
        if (best) return { line: best.line, confidence: 'shingle' };
    }
    // 3. 키프레이즈 매칭: 굵은 제목/항목명이 포함된 라인 (낮은 신뢰도)
    for (const key of keyPhrases) {
        let best = null;
        for (let i = 0; i < lines.length; i++) {
            if (normalizeStrict(lines[i]).includes(key)) {
                const d = Math.abs(i + 1 - (nearLine || 0));
                if (!best || d < best.d) best = { line: i + 1, d };
            }
        }
        if (best) return { line: best.line, confidence: 'key' };
    }
    return null;
}

/**
 * 타겟 파일에서 지문이 포함된 라인을 검색합니다.
 * @returns {number|null} 새 라인 번호 (1-indexed), 미발견 시 null
 */
function findLineByFingerprint(lines, fingerprint, originalLineNum) {
    // 0. 빈 fingerprint: 주변 ±10 라인에서 가장 가까운 의미 있는 라인 반환
    if (!fingerprint) {
        const searchStart = Math.max(0, originalLineNum - 11);
        const searchEnd = Math.min(lines.length, originalLineNum + 10);
        for (let i = Math.min(originalLineNum, lines.length - 1); i < searchEnd; i++) {
            if (extractFingerprint(lines[i] || '')) return i + 1;
        }
        for (let i = Math.min(originalLineNum - 2, lines.length - 1); i >= searchStart; i--) {
            if (extractFingerprint(lines[i] || '')) return i + 1;
        }
        return null;
    }

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
 * { examFile, matchStart, matchEnd, label, textLineNum, relPath, urlLineNum,
 *   fingerprint, quoteLines, outOfRange }
 */
function extractCitations(examFile, content) {
    const citations = [];
    const examDir = path.dirname(examFile);
    const seenUrls = new Set();
    const contentLines = content.split('\n');
    // 각 라인의 시작 오프셋
    const offsets = [];
    let off = 0;
    for (const l of contentLines) { offsets.push(off); off += l.length + 1; }
    const lineIndexOf = (pos) => {
        let lo = 0, hi = offsets.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= pos) lo = mid; else hi = mid - 1; }
        return lo;
    };
    // 매치 이후 최대 8줄에서 `> 인용문` 수집
    // 근거 헤더(📖 ... 근거)/해설/허용정답 등 메타 라인은 인용문 지문에서 제외
    const isMetaQuoteLine = (t) => {
        const s = t.replace(/^>\s*/, '');
        // JS \b는 한글에 작동하지 않으므로 키워드 뒤 ** 또는 : 를 요구
        return /📖|(해설|허용\s*정답|보충|고득점\s*TIP|학습\s*TIP)\s*[*:：]/.test(s);
    };
    const collectQuote = (pos) => {
        const start = lineIndexOf(pos) + 1;
        const quote = [];
        for (let j = start; j < Math.min(start + 8, contentLines.length); j++) {
            const q = contentLines[j].match(/^>\s?(.*)/);
            if (!contentLines[j].startsWith('>')) break;
            const t = q ? q[1].trim() : '';
            if (t && !isMetaQuoteLine(t)) quote.push(t);
        }
        return quote;
    };

    const pushCitation = (match, type) => {
        const label = match[1].trim();
        const textLineNum = parseInt(match[2]);
        const relPath = match[3];
        const urlLineNum = parseInt(match[4]);

        const urlKey = `${relPath}#L${urlLineNum}`;
        if (seenUrls.has(urlKey)) return;
        seenUrls.add(urlKey);

        const resolved = path.resolve(ROOT, examDir, relPath);
        if (!fs.existsSync(resolved)) return;

        const lines = getFileLines(resolved);
        const outOfRange = urlLineNum < 1 || urlLineNum > lines.length;
        const fingerprint = outOfRange ? null : extractFingerprint(lines[urlLineNum - 1]);
        const quoteLines = collectQuote(match.index + match[0].length);

        citations.push({
            type,
            examFile,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            fullMatch: match[0],
            label,
            textLineNum,
            urlLineNum,
            relPath,
            fingerprint,
            quoteLines,
            outOfRange,
        });
    };

    // 근거 헤더([📖 근거]...범위)를 먼저 수집 — 안쪽 링크가 CITATION_RE에도
    // 매칭돼 중첩 span이 두 번 갱신 대상에 오르는 것을 막는다
    const evidenceSpans = [];
    EVIDENCE_RE.lastIndex = 0;
    let match;
    while ((match = EVIDENCE_RE.exec(content)) !== null) {
        evidenceSpans.push([match.index, match.index + match[0].length]);
        pushCitation(match, 'evidence');
    }

    CITATION_RE.lastIndex = 0;
    while ((match = CITATION_RE.exec(content)) !== null) {
        if (evidenceSpans.some(([s, e]) => match.index >= s && match.index < e)) continue;
        pushCitation(match, 'main');
    }

    return citations;
}

/**
 * 문제은행 파일에서 인용 링크의 라인 번호를 갱신합니다.
 * 라벨과 URL fragment 모두 갱신합니다.
 */
function updateExamFile(examFile, updates) {
    if (updates.length === 0) return;

    const examPath = path.resolve(ROOT, examFile);
    let content = fs.readFileSync(examPath, 'utf-8');

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
                quote: c.quoteLines.join(' | ').substring(0, 200),
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
let totalOutOfRange = 0;
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
    let outOfRangeFixed = 0;

    for (const c of citations) {
        totalCitations++;
        const resolved = path.resolve(ROOT, examDir, c.relPath);
        const lines = getFileLines(resolved);

        const quoteFrags = extractQuoteFrags(c.quoteLines);
        const keyPhrases = extractKeyPhrases(c.quoteLines);

        let newLineNum = null;

        if (!c.outOfRange) {
            if (quoteFrags.length) {
                // 인용문이 있으면 인용 라인 ±3에 인용문 조각이 있는지 검증
                const ln = c.urlLineNum;
                const ok = [ln - 3, ln - 2, ln - 1, ln, ln + 1, ln + 2, ln + 3].some(x => {
                    if (x < 1 || x > lines.length) return false;
                    const n = normalizeStrict(lines[x - 1]);
                    return quoteFrags.some(f => n.includes(f));
                });
                if (ok) newLineNum = ln;
            } else {
                // 인용문 없음 → 라인 지문 방식 (근처 이동만 감지 가능)
                newLineNum = findLineByFingerprint(lines, c.fingerprint, c.urlLineNum);
            }
        }

        // 인용 라인 검증 실패 또는 범위초과 → 인용문 지문으로 전체 재탐색
        if (newLineNum === null && (quoteFrags.length || keyPhrases.length)) {
            const hit = findLineByQuote(lines, quoteFrags, keyPhrases, c.urlLineNum);
            // 키프레이즈만 일치(낮은 신뢰도)하면 자동 갱신하지 않고 미발견으로 보고
            if (hit && hit.confidence !== 'key') newLineNum = hit.line;
        }

        if (newLineNum === null) {
            notFound++;
            totalNotFound++;
            notFoundList.push({
                examFile,
                relPath: c.relPath,
                oldLineNum: c.urlLineNum,
                fingerprint: (c.fingerprint || c.quoteLines.join(' ')).substring(0, 60),
                label: c.label,
                outOfRange: c.outOfRange,
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
            if (c.outOfRange) { outOfRangeFixed++; totalOutOfRange++; }
            allUpdates.push({
                examFile,
                relPath: c.relPath,
                oldLineNum: c.urlLineNum,
                newLineNum,
                label: c.label,
                outOfRange: c.outOfRange,
            });
        } else {
            unchanged++;
            totalUnchanged++;
        }
    }

    console.log(`${examFile}: ${citations.length}개 링크, ${unchanged}개 동일, ${updates.length}개 갱신(범위초과 복구 ${outOfRangeFixed}건), ${notFound}개 미발견`);

    if (updates.length > 0 && !isCheckOnly) {
        updateExamFile(examFile, updates);
    }
}

console.log('\n=== 동기화 결과 ===');
console.log(`총 링크: ${totalCitations}`);
console.log(`동일 (변경 없음): ${totalUnchanged}`);
console.log(`갱신: ${totalUpdated} (범위초과 복구: ${totalOutOfRange})`);
console.log(`미발견: ${totalNotFound}`);

if (isCheckOnly) {
    console.log('\n[--check 모드] 파일 수정 없이 확인만 수행했습니다.');
}

if (allUpdates.length > 0) {
    console.log('\n=== 갱신 내역 ===');
    for (const u of allUpdates) {
        const fileName = path.basename(u.relPath);
        const tag = u.outOfRange ? ' [범위초과 복구]' : '';
        console.log(`  ${u.examFile.split('/').pop()} [${u.label}] ${fileName} L${u.oldLineNum} → L${u.newLineNum}${tag}`);
    }
}

if (notFoundList.length > 0) {
    console.log('\n=== ⚠️ 미발견 항목 (수동 확인 필요) ===');
    for (const n of notFoundList) {
        const fileName = path.basename(n.relPath);
        const tag = n.outOfRange ? ' [범위초과]' : '';
        console.log(`  ${n.examFile.split('/').pop()} [${n.label}] ${fileName} L${n.oldLineNum}${tag}: "${n.fingerprint}..."`);
    }
}

if (totalNotFound > 0) {
    process.exit(1);
}
