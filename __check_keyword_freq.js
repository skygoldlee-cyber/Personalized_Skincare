const fs = require('fs');
const path = require('path');

// Replicate mapping logic (same as before)
const MD_CONVERSION_TARGETS = new Set([
    '기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf',
    'KFCC_별표10_일반시험법.pdf',
    '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf',
]);
const REF_DIRS = {
    '법령원문': ['화장품법(법률)(제20901호)(20260402).pdf','화장품법 시행규칙(총리령)(제02109호)(20260402).pdf',
        '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf',
        '우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).pdf',
        '기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf',
        '기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf',
        '화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).pdf',
        '화장품의 색소 종류 및 기준(식품의약품안전처고시)(제2023-61호)(20230921).pdf'],
    '공통': ['화장품법(법률)(제20901호)(20260402).pdf','색소종류및기준_전체.pdf',
        '시행규칙_별표3_사용시주의사항.pdf','시행규칙_별표4_포장표시기준및방법.pdf',
        '시행규칙_별표5_표시광고범위및준수사항.pdf','시행규칙_별표6_위해화장품공표문.pdf',
        '시행규칙_별표7_행정처분기준.pdf','시행규칙_별표9_수수료.pdf',
        '안전기준_별표1_사용불가원료.pdf','안전기준_별표2_사용제한원료.pdf',
        '안전기준_별표3_인체세포조직배양액안전기준.pdf','안전기준_별표4_유통안전관리시험방법.pdf',
        '주의사항_별표1_유형별주의사항표시문구.pdf','주의사항_별표2_알레르기유발성분25종.pdf',
        'CGMP_별표1_공정별분류.pdf','CGMP_별표2_실시상황평가표.pdf','CGMP_별표3_적합업소로고.pdf'],
    '과목1': ['시행규칙_별표1_품질관리기준.pdf','시행규칙_별표2_책임판매안전관리기준.pdf'],
    '과목2': ['KFCC_별표1_통칙.pdf','KFCC_별표2_미백_나이아신아마이드.pdf','KFCC_별표3_주름개선_레티놀.pdf',
        'KFCC_별표4_자외선보호.pdf','KFCC_별표5_미백주름복합.pdf','KFCC_별표6_모발색상변화.pdf',
        'KFCC_별표7_체모제거_치오글리콜산.pdf','KFCC_별표8_여드름완화_살리실릭애씨드.pdf',
        'KFCC_별표9_탈로완화_덱스판테놀.pdf','KFCC_별표10_일반시험법.pdf','안전기준_별표1_색소_구.pdf'],
    '과목3': [],'과목4': []
};
const _DIR_PRIORITY = ['과목4','과목3','과목2','과목1','공통','법령원문'];
const REF_FILE_TO_PATH = {};
for (const dir of _DIR_PRIORITY) {
    for (const f of REF_DIRS[dir] || []) {
        if (!REF_FILE_TO_PATH[f]) {
            const base = f.replace(/\.pdf$/, '');
            const ext = MD_CONVERSION_TARGETS.has(f) ? '.md' : '.html';
            REF_FILE_TO_PATH[f] = `content/참조자료/html_output/${base}/${base}${ext}`;
        }
    }
}
function resolveRefPath(fileName) { return REF_FILE_TO_PATH[fileName] || ''; }

const SOURCE_REF_MAP = [
    { test: /화장품법\s*제?\d+조/, exclude: /시행령|시행규칙|고시/, file: '화장품법(법률)(제20901호)(20260402).pdf' },
    { test: /시행규칙/, file: '화장품법 시행규칙(총리령)(제02109호)(20260402).pdf' },
    { test: /안전기준/, file: '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf' },
    { test: /CGMP|품질관리|우수화장품/, file: '우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).pdf' },
    { test: /기능성화장품\s*기준|시험\s*방법/, file: '기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf' },
    { test: /기능성화장품\s*심사/, file: '기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf' },
    { test: /주의사항|알레르기/, file: '화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).pdf' },
    { test: /색소/, file: '화장품의 색소 종류 및 기준(식품의약품안전처고시)(제2023-61호)(20230921).pdf' },
    { test: /개인정보\s*보호법/, file: '화장품법(법률)(제20901호)(20260402).pdf' },
    { test: /화장품법/, file: '화장품법(법률)(제20901호)(20260402).pdf' },
];
function mapSourceToRef(sourceText) {
    if (!sourceText) return '';
    const s = sourceText.trim();
    for (const entry of SOURCE_REF_MAP) {
        if (entry.exclude) {
            if (entry.test.test(s) && !entry.exclude.test(s)) return resolveRefPath(entry.file);
        } else {
            if (entry.test.test(s)) return resolveRefPath(entry.file);
        }
    }
    return '';
}

function decodeHtmlText(text) {
    return text.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}

function parseSections(mdContent) {
    const lines = mdContent.split('\n');
    const sections = [];
    let currentSection = null;
    let chapterSource = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const chapMatch = line.match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n|$)/);
        if (chapMatch && !chapterSource) chapterSource = chapMatch[1].trim();
        if (/^##\s/.test(line)) {
            if (currentSection) sections.push(currentSection);
            currentSection = { lines: [], source: '' };
        } else if (currentSection) {
            currentSection.lines.push(line);
            const secMatch = line.match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n|$)/);
            if (secMatch && !currentSection.source) currentSection.source = secMatch[1].trim();
        }
    }
    if (currentSection) sections.push(currentSection);
    return { sections, chapterSource };
}

function extractKeywordFromCell(line, matchPos, matchLen) {
    const before = line.substring(0, matchPos);
    const after = line.substring(matchPos + matchLen);
    const pipeBefore = before.lastIndexOf('|');
    const pipeAfter = after.indexOf('|');
    let cellBefore = pipeBefore >= 0 ? before.substring(pipeBefore + 1) : before;
    let cellAfter = pipeAfter >= 0 ? after.substring(0, pipeAfter) : after;
    const cellText = (cellBefore + cellAfter)
        .replace(/\(L\d+(?:\\?\|)[^)]+?\.pdf\)/g, '').replace(/\(L\d+\)/g, '').replace(/\(L\?\)/g, '').trim();
    const words = cellText.split(/\s+/).filter(w => w.length >= 2);
    return words.slice(0, 4).join(' ').substring(0, 20);
}

// For each L### keyword, count how many times it appears in the reference file
const refRawCache = {};
function getRefRaw(refPath) {
    if (refRawCache[refPath] !== undefined) return refRawCache[refPath];
    try { refRawCache[refPath] = fs.readFileSync(refPath, 'utf8'); } catch (e) { refRawCache[refPath] = null; }
    return refRawCache[refPath];
}

function countKeywordInFile(keyword, refPath) {
    const raw = getRefRaw(refPath);
    if (!raw) return -1;
    
    if (refPath.endsWith('.md')) {
        // For MD files, count in raw text
        const lines = raw.split('\n');
        let count = 0;
        for (const line of lines) {
            if (line.includes(keyword)) count++;
        }
        return count;
    } else {
        // For HTML files, decode entities and count
        const decoded = decodeHtmlText(raw.replace(/<[^>]+>/g, ''));
        let count = 0;
        let pos = 0;
        while ((pos = decoded.indexOf(keyword, pos)) >= 0) {
            count++;
            pos += keyword.length;
        }
        return count;
    }
}

// --- Main ---
const textbookDir = path.join('content', '교재');
const subjects = ['law', 'manufacturing', 'safety', 'understanding'];

const results = [];

for (const subject of subjects) {
    const subjDir = path.join(textbookDir, subject);
    if (!fs.existsSync(subjDir)) continue;
    const allFiles = fs.readdirSync(subjDir).filter(f => f.endsWith('.md'));

    for (const mdFile of allFiles) {
        const mdContent = fs.readFileSync(path.join(subjDir, mdFile), 'utf8');
        const { sections, chapterSource } = parseSections(mdContent);
        const chapterRefPath = mapSourceToRef(chapterSource);

        for (const section of sections) {
            const secRefPath = section.source ? mapSourceToRef(section.source) : null;
            const refPath = secRefPath || chapterRefPath;

            for (const line of section.lines) {
                if (!line.trim().startsWith('|')) continue;
                if (/^\|[\s-]+\|/.test(line.trim())) continue;

                const patterns = [
                    { re: /\(L(\d+)(?:\\?\|)([^)]+?\.pdf)\)/g, hasFile: true },
                    { re: /\(L(\d+)\)(?![\\|])/g, hasFile: false }
                ];

                for (const { re, hasFile } of patterns) {
                    let m;
                    re.lastIndex = 0;
                    while ((m = re.exec(line)) !== null) {
                        const pdfFile = hasFile ? m[2] : null;
                        const usePath = hasFile ? (resolveRefPath(pdfFile) || refPath) : refPath;
                        const keyword = extractKeywordFromCell(line, m.index, m[0].length);
                        
                        if (!keyword || keyword.length < 2) continue;
                        if (!usePath) continue;
                        
                        const count = countKeywordInFile(keyword, usePath);
                        results.push({
                            subject, mdFile, keyword, refPath: path.basename(usePath),
                            count, lineNum: m[1],
                            cell: line.trim().substring(0, 80)
                        });
                    }
                }
            }
        }
    }
}

// Sort by count ascending (problematic ones first)
results.sort((a, b) => a.count - b.count);

// Summary
const stats = {
    total: results.length,
    zero: results.filter(r => r.count === 0).length,
    one: results.filter(r => r.count === 1).length,
    twoTo5: results.filter(r => r.count >= 2 && r.count <= 5).length,
    sixPlus: results.filter(r => r.count >= 6).length,
};

console.log('=== 키워드 출현 빈도 분석 ===\n');
console.log(`총 참조: ${stats.total}`);
console.log(`0건 (찾을 수 없음): ${stats.zero} (${(stats.zero/stats.total*100).toFixed(1)}%)`);
console.log(`1건 (단일 출현): ${stats.one} (${(stats.one/stats.total*100).toFixed(1)}%)`);
console.log(`2-5건: ${stats.twoTo5} (${(stats.twoTo5/stats.total*100).toFixed(1)}%)`);
console.log(`6건 이상: ${stats.sixPlus} (${(stats.sixPlus/stats.total*100).toFixed(1)}%)`);

// Show 1-hit keywords (unique only)
const oneHitKeywords = {};
for (const r of results.filter(r => r.count === 1)) {
    const key = `${r.keyword}|${r.refPath}`;
    if (!oneHitKeywords[key]) oneHitKeywords[key] = { ...r, occurrences: 0 };
    oneHitKeywords[key].occurrences++;
}

console.log(`\n=== 1건 출현 키워드 (고유: ${Object.keys(oneHitKeywords).length}개) ===`);
for (const [key, info] of Object.entries(oneHitKeywords).sort((a, b) => a[1].keyword.localeCompare(b[1].keyword))) {
    console.log(`  "${info.keyword}" → ${info.refPath} (참조 ${info.occurrences}회)`);
    console.log(`    예: ${info.cell}`);
}

// Show 0-hit keywords (unique only)
const zeroHitKeywords = {};
for (const r of results.filter(r => r.count === 0)) {
    const key = `${r.keyword}|${r.refPath}`;
    if (!zeroHitKeywords[key]) zeroHitKeywords[key] = { ...r, occurrences: 0 };
    zeroHitKeywords[key].occurrences++;
}

console.log(`\n=== 0건 출현 키워드 (고유: ${Object.keys(zeroHitKeywords).length}개) ===`);
for (const [key, info] of Object.entries(zeroHitKeywords).sort((a, b) => a[1].keyword.localeCompare(b[1].keyword))) {
    console.log(`  "${info.keyword}" → ${info.refPath} (참조 ${info.occurrences}회)`);
    console.log(`    예: ${info.cell}`);
}
