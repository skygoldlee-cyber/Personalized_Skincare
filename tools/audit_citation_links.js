#!/usr/bin/env node
/**
 * Comprehensive citation link audit for all exam files.
 * 
 * Checks:
 * 1. All citation link patterns captured (교재, 법령, 규정, 별표, etc.)
 * 2. Target file exists
 * 3. Target line number within file range
 * 4. Target line not empty/separator
 * 5. Text L### matches URL #L###
 * 6. Citation context (근거 text) similarity to actual target line content
 * 
 * Output: Detailed report with severity levels (ERROR, WARN, INFO)
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

// Match ALL citation link patterns: [any label: L####] or [any label: L####] with URL
// Pattern 1: [label: L####](<path#L####>)
// Pattern 2: [label: L####](<path#L####>) with following 근거 text
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
    let result = text
        // Strip markdown link URLs: [label](url) → label
        .replace(/\[([^\]]*?)\]\([^)]*\)/g, '$1')
        // Strip mermaid syntax: root((...)), A --> B, etc.
        .replace(/\b(root|mindmap|flowchart|subgraph|end)\b/gi, ' ')
        .replace(/(--?>|---|==>)/g, ' ')
        // Strip HTML tags: <br/>, <br>, etc.
        .replace(/<[^>]+>/g, ' ')
        // Strip markdown emphasis markers
        .replace(/[*_`#>|]/g, ' ')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .replace(/[·∙•・]/g, '·')
        .replace(/[「」『』]/g, '')
        .replace(/[()（）\[\]]/g, '')
        .replace(/[<>]/g, '')
        .replace(/[""'']/g, "'")
        .replace(/[~∼]/g, '~')
        .replace(/[…]/g, '...')
        .trim()
        .toLowerCase();
    
    // Korean no-space normalization: insert spaces between Korean syllables
    // when the text has no spaces (common in 법령/별표 원문)
    if (!/\s/.test(result.replace(/[·,.;:|]/g, '')) && /[\uac00-\ud7a3]/.test(result)) {
        result = result.replace(/([\uac00-\ud7a3])(?=[\uac00-\ud7a3])/g, '$1 ');
    }
    
    return result;
}

function extractKeywords(text, minLen = 3) {
    // Extract meaningful Korean/English keywords from text
    const normalized = normalize(text);
    const tokens = normalized.split(/[\s,·:;|]+/)
        .filter(t => t.length >= minLen)
        .filter(t => !/^(the|and|for|with|from|this|that|are|was|were|is|be|to|of|in|on|at|by|an|or|it|as|if|no|not|but|so|do|has|had|can|may|will|shall|must|should|would|could|their|there|here|which|what|when|where|who|how|why|all|any|each|such|than|then|them|these|those|been|being|have|having|does|did|done|made|make|makes|making|used|uses|using)$/.test(t));
    return tokens;
}

// Character-level n-gram extraction for short texts (headers, table rows)
function extractNgrams(text, n) {
    const normalized = normalize(text);
    const chars = normalized.replace(/\s+/g, '');
    const ngrams = [];
    for (let i = 0; i <= chars.length - n; i++) {
        ngrams.push(chars.substring(i, i + n));
    }
    return ngrams;
}

function extractBigrams(text) {
    return extractNgrams(text, 2);
}

// Check if this is a short-answer question (단답형)
function isShortAnswer(contextText) {
    const normalized = normalize(contextText);
    // Detect patterns like "허용 정답:" with very short content after
    if (/허용\s*정답/.test(normalized)) {
        const afterAnswer = normalized.split(/허용\s*정답/)[1] || '';
        // If the answer portion is very short (< 30 chars), it's short-answer
        if (afterAnswer.trim().length < 30) return true;
    }
    return false;
}

function similarityScore(citationText, targetLineText) {
    const citeKeywords = new Set(extractKeywords(citationText));
    const targetKeywords = new Set(extractKeywords(targetLineText));
    
    // Strategy 1: Keyword matching (original)
    let keywordScore = 0;
    if (citeKeywords.size > 0 && targetKeywords.size > 0) {
        let common = 0;
        for (const kw of citeKeywords) {
            if (targetKeywords.has(kw)) common++;
        }
        keywordScore = common / Math.max(citeKeywords.size, targetKeywords.size);
    }
    
    // Strategy 2: Bigram matching (for short texts like headers, table rows)
    const citeBigrams = new Set(extractBigrams(citationText));
    const targetBigrams = new Set(extractBigrams(targetLineText));
    let bigramScore = 0;
    if (citeBigrams.size > 0 && targetBigrams.size > 0) {
        let common = 0;
        for (const bg of citeBigrams) {
            if (targetBigrams.has(bg)) common++;
        }
        bigramScore = common / Math.max(citeBigrams.size, targetBigrams.size);
    }
    
    // Strategy 3: Trigram matching (even more selective for short headers)
    const citeTrigrams = new Set(extractNgrams(citationText, 3));
    const targetTrigrams = new Set(extractNgrams(targetLineText, 3));
    let trigramScore = 0;
    if (citeTrigrams.size > 0 && targetTrigrams.size > 0) {
        let common = 0;
        for (const tg of citeTrigrams) {
            if (targetTrigrams.has(tg)) common++;
        }
        trigramScore = common / Math.max(citeTrigrams.size, targetTrigrams.size);
    }
    
    // Use the best score among all strategies
    return Math.max(keywordScore, bigramScore, trigramScore);
}

const results = {
    total: 0,
    errors: [],
    warnings: [],
    info: [],
    perFile: {}
};

function resolvePath(examDir, relPath) {
    const resolved = path.resolve(ROOT, examDir, relPath).replace(/\\/g, '/');
    return resolved;
}

for (const examFile of EXAM_FILES) {
    const examPath = path.resolve(ROOT, examFile);
    if (!fs.existsSync(examPath)) {
        results.errors.push(`[${examFile}] 파일 없음`);
        continue;
    }

    const content = fs.readFileSync(examPath, 'utf-8');
    const examDir = path.dirname(examFile);
    const fileStats = { links: 0, errors: 0, warnings: 0, info: 0 };
    const seenUrls = new Set();

    // --- Pass 1: Main citation links [label: L###](<path#L###>) ---
    let match;
    CITATION_RE.lastIndex = 0;
    while ((match = CITATION_RE.exec(content)) !== null) {
        const label = match[1].trim();
        const linkLineNum = parseInt(match[2]);
        const relPath = match[3];
        const targetLineNum = parseInt(match[4]);
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        // Get surrounding context (next ~5 lines for 근거 text)
        const beforeContent = content.substring(Math.max(0, matchStart - 500), matchStart);
        const afterContent = content.substring(matchEnd, Math.min(content.length, matchEnd + 1000));
        // Strip 근거 박스 meta lines (📌 출처, 🎯 한 줄 핵심, 시행일, 최종 확인, 참조 PDF, etc.)
        const contextText = (beforeContent + ' ' + afterContent)
            .replace(/[#>*|`]/g, ' ')
            .replace(/📌[^\n]*?(출처|시행일|최종\s*확인|참조\s*PDF)[^\n]*/gi, ' ')
            .replace(/🎯\s*한\s*줄\s*핵심[^\n]*/gi, ' ')
            .replace(/📖\s*[^\n]*/g, ' ');

        results.total++;
        fileStats.links++;
        const urlKey = `${relPath}#L${targetLineNum}`;
        seenUrls.add(urlKey);

        const resolved = resolvePath(examDir, relPath);
        const relResolved = path.relative(ROOT, resolved).replace(/\\/g, '/');

        // Check 1: file exists
        if (!fs.existsSync(resolved)) {
            results.errors.push(`[${examFile}] 파일 없음: ${relResolved} (라벨: ${label}, L${linkLineNum})`);
            fileStats.errors++;
            continue;
        }

        // Check 2: line range
        const lines = getFileLines(resolved);
        if (targetLineNum < 1 || targetLineNum > lines.length) {
            results.errors.push(`[${examFile}] 라인 범위 초과: ${relResolved} L${targetLineNum} (총 ${lines.length}줄, 라벨: ${label})`);
            fileStats.errors++;
            continue;
        }

        // Check 3: empty line
        const targetLine = lines[targetLineNum - 1].trim();
        if (targetLine === '' || targetLine === '---') {
            results.errors.push(`[${examFile}] 빈/구분 라인: ${relResolved} L${targetLineNum} → "${targetLine}"`);
            fileStats.errors++;
            continue;
        }

        // Check 4: L### mismatch between text and URL
        if (linkLineNum !== targetLineNum) {
            results.errors.push(`[${examFile}] 라인번호 불일치: 텍스트 L${linkLineNum} vs URL L${targetLineNum} (${relResolved}, 라벨: ${label})`);
            fileStats.errors++;
        }

        // Check 5: content similarity (근거 text vs target line)
        // Skip similarity check for short-answer questions (단답형)
        const isShort = isShortAnswer(contextText);
        
        if (!isShort) {
            // Get a window of ±2 lines around target for better matching
            const targetWindow = lines.slice(Math.max(0, targetLineNum - 3), Math.min(lines.length, targetLineNum + 3)).join(' ');
            const score = similarityScore(contextText, targetWindow);
            
            if (score < 0.03) {
                results.warnings.push(`[${examFile}] 내용 불일치 의심: ${relResolved} L${targetLineNum} (유사도 ${(score * 100).toFixed(1)}%, 라벨: ${label})`);
                fileStats.warnings++;
            } else if (score < 0.10) {
                results.info.push(`[${examFile}] 낮은 유사도: ${relResolved} L${targetLineNum} (유사도 ${(score * 100).toFixed(1)}%, 라벨: ${label})`);
                fileStats.info++;
            }
        }
    }

    // --- Pass 2: Evidence/근거 links [L###](<path#L###>) inside 📖 lines ---
    EVIDENCE_RE.lastIndex = 0;
    while ((match = EVIDENCE_RE.exec(content)) !== null) {
        const linkLineNum = parseInt(match[1]);
        const relPath = match[2];
        const targetLineNum = parseInt(match[3]);

        const urlKey = `${relPath}#L${targetLineNum}`;
        // Skip if already checked in Pass 1
        if (seenUrls.has(urlKey)) continue;

        results.total++;
        fileStats.links++;

        const resolved = resolvePath(examDir, relPath);
        const relResolved = path.relative(ROOT, resolved).replace(/\\/g, '/');

        // Check 1: file exists
        if (!fs.existsSync(resolved)) {
            results.errors.push(`[${examFile}] (근거) 파일 없음: ${relResolved} L${linkLineNum}`);
            fileStats.errors++;
            continue;
        }

        // Check 2: line range
        const lines = getFileLines(resolved);
        if (targetLineNum < 1 || targetLineNum > lines.length) {
            results.errors.push(`[${examFile}] (근거) 라인 범위 초과: ${relResolved} L${targetLineNum} (총 ${lines.length}줄)`);
            fileStats.errors++;
            continue;
        }

        // Check 3: empty line
        const targetLine = lines[targetLineNum - 1].trim();
        if (targetLine === '' || targetLine === '---') {
            results.errors.push(`[${examFile}] (근거) 빈/구분 라인: ${relResolved} L${targetLineNum} → "${targetLine}"`);
            fileStats.errors++;
            continue;
        }

        // Check 4: L### mismatch
        if (linkLineNum !== targetLineNum) {
            results.errors.push(`[${examFile}] (근거) 라인번호 불일치: 텍스트 L${linkLineNum} vs URL L${targetLineNum} (${relResolved})`);
            fileStats.errors++;
        }
    }

    results.perFile[examFile] = fileStats;
    console.log(`${examFile}: ${fileStats.links}개 링크, ${fileStats.errors}개 오류, ${fileStats.warnings}개 경고, ${fileStats.info}개 정보`);
}

// --- Summary ---
console.log('\n=== 전수조사 결과 ===');
console.log(`총 링크: ${results.total}`);
console.log(`오류(ERROR): ${results.errors.length}`);
console.log(`경고(WARN): ${results.warnings.length}`);
console.log(`정보(INFO): ${results.info.length}`);

if (results.errors.length > 0) {
    console.log('\n=== ❌ 오류 목록 ===');
    results.errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
}

if (results.warnings.length > 0) {
    console.log('\n=== ⚠️ 경고 목록 (내용 불일치 의심) ===');
    results.warnings.forEach((e, i) => console.log(`${i + 1}. ${e}`));
}

if (results.info.length > 0) {
    console.log('\n=== ℹ️ 정보 목록 (낮은 유사도) ===');
    results.info.forEach((e, i) => console.log(`${i + 1}. ${e}`));
}

if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log('\n✅ 모든 인용 라인 번호가 유효하며 내용 일치합니다.');
} else if (results.errors.length === 0) {
    console.log('\n✅ 라인 번호 오류 없음. 경고 항목은 내용 일치성 재검토 권장.');
}
