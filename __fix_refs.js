const fs = require('fs');
const path = require('path');

// --- 1. Replicate pdf-registry mapping ---
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
const ALL_REF_FILES = [];
for (const dir of _DIR_PRIORITY) {
    for (const f of REF_DIRS[dir] || []) {
        if (!REF_FILE_TO_PATH[f]) {
            const base = f.replace(/\.pdf$/, '');
            const ext = MD_CONVERSION_TARGETS.has(f) ? '.md' : '.html';
            const p = `content/참조자료/html_output/${base}/${base}${ext}`;
            REF_FILE_TO_PATH[f] = p;
            ALL_REF_FILES.push({ file: f, path: p });
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

// --- 2. Helpers ---
const refCache = {};
function getRefContent(refPath) {
    if (refCache[refPath] !== undefined) return refCache[refPath];
    try { refCache[refPath] = fs.readFileSync(refPath, 'utf8'); } catch (e) { refCache[refPath] = null; }
    return refCache[refPath];
}
function decodeHtmlText(text) {
    return text.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}
function getRefTexts(refPath) {
    const content = getRefContent(refPath);
    if (!content) return null;
    if (refPath.endsWith('.md')) return content.split('\n');
    const texts = [];
    const re = /<p(?:\s+[^>]*)?>(.*?)<\/p>/gs;
    let m;
    while ((m = re.exec(content)) !== null) {
        texts.push(decodeHtmlText(m[1].replace(/<[^>]+>/g, '')).trim());
    }
    return texts;
}

// Search for keyword in refTexts, return 1-based line number or 0
function findLineNumber(refTexts, keyword) {
    if (!refTexts || !keyword || keyword.length < 2) return 0;
    
    // Strategy 1: Full keyword
    for (let i = 0; i < refTexts.length; i++) {
        if (refTexts[i].includes(keyword)) return i + 1;
    }
    
    // Strategy 2: First word
    if (keyword.includes(' ')) {
        const firstWord = keyword.split(' ')[0];
        if (firstWord.length >= 2) {
            for (let i = 0; i < refTexts.length; i++) {
                if (refTexts[i].includes(firstWord)) return i + 1;
            }
        }
    }
    
    // Strategy 3: No-space match
    const noSpaceKeyword = keyword.replace(/\s/g, '');
    if (noSpaceKeyword.length >= 2) {
        for (let i = 0; i < refTexts.length; i++) {
            if (refTexts[i].replace(/\s/g, '').includes(noSpaceKeyword)) return i + 1;
        }
    }
    
    return 0;
}

// --- 3. Parse sections ---
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

// --- 4. Main: Fix L### numbers ---
const textbookDir = path.join('content', '교재');
const subjects = ['law', 'manufacturing', 'safety', 'understanding'];

let stats = { total: 0, fixed: 0, notFound: 0, alreadyCorrect: 0, crossFile: 0 };
const changeLog = [];

for (const subject of subjects) {
    const subjDir = path.join(textbookDir, subject);
    if (!fs.existsSync(subjDir)) continue;
    const allFiles = fs.readdirSync(subjDir).filter(f => f.endsWith('.md'));

    for (const mdFile of allFiles) {
        const mdPath = path.join(subjDir, mdFile);
        let mdContent = fs.readFileSync(mdPath, 'utf8');
        const { sections, chapterSource } = parseSections(mdContent);
        const chapterRefPath = mapSourceToRef(chapterSource);
        
        let fileChanged = false;
        const fileChanges = [];

        for (const section of sections) {
            const secRefPath = section.source ? mapSourceToRef(section.source) : null;
            const refPath = secRefPath || chapterRefPath;

            for (const line of section.lines) {
                if (!line.trim().startsWith('|')) continue;
                if (/^\|[\s-]+\|/.test(line.trim())) continue;

                // Process (LNN|file.pdf) patterns — handle both | and \| (escaped pipe in MD tables)
                let newLine = line;
                const reLFile = /\(L(\d+)(?:\\?\|)([^)]+?\.pdf)\)/g;
                let m;
                while ((m = reLFile.exec(line)) !== null) {
                    const oldLineNum = parseInt(m[1]);
                    const pdfFile = m[2];
                    const resolvedPath = resolveRefPath(pdfFile);
                    const usePath = resolvedPath || refPath;
                    const keyword = extractKeywordFromCell(line, m.index, m[0].length);
                    
                    stats.total++;
                    
                    if (!keyword || keyword.length < 2) {
                        // No keyword, mark as L?
                        const oldStr = m[0];
                        const newStr = `(L?\\|${pdfFile})`;
                        newLine = newLine.replace(oldStr, newStr);
                        stats.notFound++;
                        fileChanges.push({ old: oldStr, new: newStr, keyword, reason: 'no keyword' });
                        continue;
                    }

                    let refTexts = usePath ? getRefTexts(usePath) : null;
                    let newLineNum = refTexts ? findLineNumber(refTexts, keyword) : 0;
                    let foundPath = usePath;

                    // If not found in mapped file, try all reference files
                    if (newLineNum === 0) {
                        for (const ref of ALL_REF_FILES) {
                            const texts = getRefTexts(ref.path);
                            const ln = findLineNumber(texts, keyword);
                            if (ln > 0) {
                                newLineNum = ln;
                                foundPath = ref.path;
                                stats.crossFile++;
                                break;
                            }
                        }
                    }

                    if (newLineNum > 0) {
                        const oldStr = m[0];
                        const baseFile = path.basename(foundPath, foundPath.endsWith('.md') ? '.md' : '.html');
                        // Check if found in a different file than specified
                        if (foundPath !== usePath && foundPath !== resolveRefPath(pdfFile)) {
                            // Cross-file: update file reference too
                            const newPdfFile = ALL_REF_FILES.find(r => r.path === foundPath)?.file || pdfFile;
                            const newStr = `(L${newLineNum}\\|${newPdfFile})`;
                            newLine = newLine.replace(oldStr, newStr);
                            fileChanges.push({ old: oldStr, new: newStr, keyword, reason: `cross-file: ${path.basename(foundPath)}` });
                        } else {
                            const newStr = `(L${newLineNum}\\|${pdfFile})`;
                            newLine = newLine.replace(oldStr, newStr);
                            if (newLineNum === oldLineNum) {
                                stats.alreadyCorrect++;
                                fileChanges.push({ old: oldStr, new: newStr, keyword, reason: 'already correct' });
                            } else {
                                fileChanges.push({ old: oldStr, new: newStr, keyword, reason: `L${oldLineNum}→L${newLineNum}` });
                            }
                        }
                        if (newLineNum !== oldLineNum) stats.fixed++;
                    } else {
                        const oldStr = m[0];
                        const newStr = `(L?\\|${pdfFile})`;
                        newLine = newLine.replace(oldStr, newStr);
                        stats.notFound++;
                        fileChanges.push({ old: oldStr, new: newStr, keyword, reason: 'keyword not found in any file' });
                    }
                }

                // Process (LNN) patterns (without file) — not followed by | or \|
                const reLSame = /\(L(\d+)\)(?![\\|])/g;
                while ((m = reLSame.exec(line)) !== null) {
                    const oldLineNum = parseInt(m[1]);
                    const keyword = extractKeywordFromCell(line, m.index, m[0].length);
                    
                    stats.total++;
                    
                    if (!keyword || keyword.length < 2) {
                        const oldStr = m[0];
                        const newStr = `(L?)`;
                        newLine = newLine.replace(oldStr, newStr);
                        stats.notFound++;
                        fileChanges.push({ old: oldStr, new: newStr, keyword, reason: 'no keyword' });
                        continue;
                    }

                    let refTexts = refPath ? getRefTexts(refPath) : null;
                    let newLineNum = refTexts ? findLineNumber(refTexts, keyword) : 0;
                    let foundPath = refPath;

                    // If not found in mapped file, try all reference files
                    if (newLineNum === 0) {
                        for (const ref of ALL_REF_FILES) {
                            const texts = getRefTexts(ref.path);
                            const ln = findLineNumber(texts, keyword);
                            if (ln > 0) {
                                newLineNum = ln;
                                foundPath = ref.path;
                                stats.crossFile++;
                                break;
                            }
                        }
                    }

                    if (newLineNum > 0) {
                        const oldStr = m[0];
                        if (foundPath && foundPath !== refPath) {
                            // Found in different file - add file reference
                            const newPdfFile = ALL_REF_FILES.find(r => r.path === foundPath)?.file;
                            if (newPdfFile) {
                                const newStr = `(L${newLineNum}\\|${newPdfFile})`;
                                newLine = newLine.replace(oldStr, newStr);
                                fileChanges.push({ old: oldStr, new: newStr, keyword, reason: `cross-file: ${path.basename(foundPath)}` });
                            } else {
                                const newStr = `(L${newLineNum})`;
                                newLine = newLine.replace(oldStr, newStr);
                                fileChanges.push({ old: oldStr, new: newStr, keyword, reason: `L${oldLineNum}→L${newLineNum}` });
                            }
                        } else {
                            const newStr = `(L${newLineNum})`;
                            newLine = newLine.replace(oldStr, newStr);
                            if (newLineNum === oldLineNum) {
                                stats.alreadyCorrect++;
                            } else {
                                fileChanges.push({ old: oldStr, new: newStr, keyword, reason: `L${oldLineNum}→L${newLineNum}` });
                            }
                        }
                        if (newLineNum !== oldLineNum) stats.fixed++;
                    } else {
                        const oldStr = m[0];
                        const newStr = `(L?)`;
                        newLine = newLine.replace(oldStr, newStr);
                        stats.notFound++;
                        fileChanges.push({ old: oldStr, new: newStr, keyword, reason: 'keyword not found in any file' });
                    }
                }

                if (newLine !== line) {
                    mdContent = mdContent.replace(line, newLine);
                    fileChanged = true;
                }
            }
        }

        if (fileChanged) {
            fs.writeFileSync(mdPath, mdContent, 'utf8');
            changeLog.push({ file: mdFile, subject, changes: fileChanges });
        }
    }
}

// --- 5. Report ---
console.log('=== L### 자동 수정 결과 ===\n');
console.log(`총 참조: ${stats.total}`);
console.log(`수정됨: ${stats.fixed} (${(stats.fixed/stats.total*100).toFixed(1)}%)`);
console.log(`이미 정확: ${stats.alreadyCorrect} (${(stats.alreadyCorrect/stats.total*100).toFixed(1)}%)`);
console.log(`크로스파일 매칭: ${stats.crossFile}`);
console.log(`매칭 실패 (L?): ${stats.notFound} (${(stats.notFound/stats.total*100).toFixed(1)}%)`);
console.log(`\n수정된 파일: ${changeLog.length}개`);

// Write change log
const logLines = ['=== L### 자동 수정 변경 로그 ===\n'];
logLines.push(`총 참조: ${stats.total}, 수정됨: ${stats.fixed}, 이미 정확: ${stats.alreadyCorrect}, 실패: ${stats.notFound}\n`);
for (const entry of changeLog) {
    logLines.push(`\n--- [${entry.subject}] ${entry.file} (${entry.changes.length}건) ---`);
    for (const c of entry.changes) {
        logLines.push(`  ${c.old} → ${c.new}`);
        logLines.push(`    키워드: "${c.keyword}" | 사유: ${c.reason}`);
    }
}
fs.writeFileSync('__fix_log.txt', logLines.join('\n'), 'utf8');
console.log('\n변경 로그: __fix_log.txt');
