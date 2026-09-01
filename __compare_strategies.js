const fs = require('fs');
const path = require('path');

// Same mapping logic as before (compressed)
const MD_CONVERSION_TARGETS = new Set(['기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf','KFCC_별표10_일반시험법.pdf','화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf']);
const REF_DIRS = {
    '법령원문': ['화장품법(법률)(제20901호)(20260402).pdf','화장품법 시행규칙(총리령)(제02109호)(20260402).pdf','화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf','우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).pdf','기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf','기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf','화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).pdf','화장품의 색소 종류 및 기준(식품의약품안전처고시)(제2023-61호)(20230921).pdf'],
    '공통': ['화장품법(법률)(제20901호)(20260402).pdf','색소종류및기준_전체.pdf','시행규칙_별표3_사용시주의사항.pdf','시행규칙_별표4_포장표시기준및방법.pdf','시행규칙_별표5_표시광고범위및준수사항.pdf','시행규칙_별표6_위해화장품공표문.pdf','시행규칙_별표7_행정처분기준.pdf','시행규칙_별표9_수수료.pdf','안전기준_별표1_사용불가원료.pdf','안전기준_별표2_사용제한원료.pdf','안전기준_별표3_인체세포조직배양액안전기준.pdf','안전기준_별표4_유통안전관리시험방법.pdf','주의사항_별표1_유형별주의사항표시문구.pdf','주의사항_별표2_알레르기유발성분25종.pdf','CGMP_별표1_공정별분류.pdf','CGMP_별표2_실시상황평가표.pdf','CGMP_별표3_적합업소로고.pdf'],
    '과목1': ['시행규칙_별표1_품질관리기준.pdf','시행규칙_별표2_책임판매안전관리기준.pdf'],
    '과목2': ['KFCC_별표1_통칙.pdf','KFCC_별표2_미백_나이아신아마이드.pdf','KFCC_별표3_주름개선_레티놀.pdf','KFCC_별표4_자외선보호.pdf','KFCC_별표5_미백주름복합.pdf','KFCC_별표6_모발색상변화.pdf','KFCC_별표7_체모제거_치오글리콜산.pdf','KFCC_별표8_여드름완화_살리실릭애씨드.pdf','KFCC_별표9_탈로완화_덱스판테놀.pdf','KFCC_별표10_일반시험법.pdf','안전기준_별표1_색소_구.pdf'],
    '과목3': [],'과목4': []
};
const _DIR_PRIORITY = ['과목4','과목3','과목2','과목1','공통','법령원문'];
const REF_FILE_TO_PATH = {};
for (const dir of _DIR_PRIORITY) { for (const f of REF_DIRS[dir] || []) { if (!REF_FILE_TO_PATH[f]) { const base = f.replace(/\.pdf$/, ''); const ext = MD_CONVERSION_TARGETS.has(f) ? '.md' : '.html'; REF_FILE_TO_PATH[f] = `content/참조자료/html_output/${base}/${base}${ext}`; } } }
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
function mapSourceToRef(s) { if (!s) return ''; s = s.trim(); for (const e of SOURCE_REF_MAP) { if (e.exclude) { if (e.test.test(s) && !e.exclude.test(s)) return resolveRefPath(e.file); } else { if (e.test.test(s)) return resolveRefPath(e.file); } } return ''; }

function decodeHtmlText(t) { return t.replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(parseInt(n,10))).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&nbsp;/g,' '); }
function parseSections(md) { const lines = md.split('\n'); const secs = []; let cur = null; let chap = ''; for (let i=0;i<lines.length;i++) { const l = lines[i]; const cm = l.match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n|$)/); if (cm && !chap) chap = cm[1].trim(); if (/^##\s/.test(l)) { if (cur) secs.push(cur); cur = { lines: [], source: '' }; } else if (cur) { cur.lines.push(l); const sm = l.match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n|$)/); if (sm && !cur.source) cur.source = sm[1].trim(); } } if (cur) secs.push(cur); return { sections: secs, chapterSource: chap }; }

function extractCellText(line, matchPos, matchLen) {
    const before = line.substring(0, matchPos);
    const after = line.substring(matchPos + matchLen);
    const pipeBefore = before.lastIndexOf('|');
    const pipeAfter = after.indexOf('|');
    let cellBefore = pipeBefore >= 0 ? before.substring(pipeBefore + 1) : before;
    let cellAfter = pipeAfter >= 0 ? after.substring(0, pipeAfter) : after;
    return (cellBefore + cellAfter).replace(/\(L\d+(?:\\?\|)[^)]+?\.pdf\)/g, '').replace(/\(L\d+\)/g, '').replace(/\(L\?\)/g, '').trim();
}

const refCache = {};
function getRefRaw(p) { if (refCache[p] !== undefined) return refCache[p]; try { refCache[p] = fs.readFileSync(p, 'utf8'); } catch (e) { refCache[p] = null; } return refCache[p]; }
function countInFile(kw, refPath) {
    const raw = getRefRaw(refPath); if (!raw) return -1;
    const decoded = refPath.endsWith('.md') ? raw : decodeHtmlText(raw.replace(/<[^>]+>/g, ''));
    let c = 0, pos = 0; while ((pos = decoded.indexOf(kw, pos)) >= 0) { c++; pos += kw.length; } return c;
}

// Collect all entries
const textbookDir = path.join('content', '교재');
const subjects = ['law', 'manufacturing', 'safety', 'understanding'];
const entries = [];

for (const subject of subjects) {
    const subjDir = path.join(textbookDir, subject);
    if (!fs.existsSync(subjDir)) continue;
    for (const mdFile of fs.readdirSync(subjDir).filter(f => f.endsWith('.md'))) {
        const mdContent = fs.readFileSync(path.join(subjDir, mdFile), 'utf8');
        const { sections, chapterSource } = parseSections(mdContent);
        const chapterRefPath = mapSourceToRef(chapterSource);
        for (const section of sections) {
            const secRefPath = section.source ? mapSourceToRef(section.source) : null;
            const refPath = secRefPath || chapterRefPath;
            for (const line of section.lines) {
                if (!line.trim().startsWith('|')) continue;
                if (/^\|[\s-]+\|/.test(line.trim())) continue;
                for (const { re, hasFile } of [{ re: /\(L(\d+)(?:\\?\|)([^)]+?\.pdf)\)/g, hasFile: true }, { re: /\(L(\d+)\)(?![\\|])/g, hasFile: false }]) {
                    let m; re.lastIndex = 0;
                    while ((m = re.exec(line)) !== null) {
                        const pdfFile = hasFile ? m[2] : null;
                        const usePath = hasFile ? (resolveRefPath(pdfFile) || refPath) : refPath;
                        const cellText = extractCellText(line, m.index, m[0].length);
                        if (!cellText || !usePath) continue;
                        const words = cellText.split(/\s+/).filter(w => w.length >= 2);
                        entries.push({ words, refPath: usePath, cellText });
                    }
                }
            }
        }
    }
}

// Test different keyword strategies
const strategies = [
    { name: '현재 (4단어/20자)', fn: w => w.slice(0, 4).join(' ').substring(0, 20) },
    { name: '3단어', fn: w => w.slice(0, 3).join(' ') },
    { name: '2단어', fn: w => w.slice(0, 2).join(' ') },
    { name: '1단어', fn: w => w[0] || '' },
    { name: '2단어+fallback 1단어', fn: w => w.slice(0, 2).join(' '), fallback: w => w[0] || '' },
    { name: '3단어+fallback 2단어+fallback 1단어', fn: w => w.slice(0, 3).join(' '), fallback2: w => w.slice(0, 2).join(' '), fallback: w => w[0] || '' },
];

console.log('=== 키워드 선정 전략별 매칭률 비교 ===\n');
console.log(`총 엔트리: ${entries.length}\n`);

for (const strat of strategies) {
    let zero = 0, one = 0, twoPlus = 0, total = 0;
    const zeroExamples = [];
    
    for (const e of entries) {
        const kw = strat.fn(e.words);
        if (!kw || kw.length < 2) continue;
        total++;
        let count = countInFile(kw, e.refPath);
        
        // Apply fallback if count is 0
        if (count === 0 && strat.fallback) {
            const fb = strat.fallback(e.words);
            if (fb && fb.length >= 2 && fb !== kw) {
                count = countInFile(fb, e.refPath);
            }
        }
        if (count === 0 && strat.fallback2) {
            const fb2 = strat.fallback2(e.words);
            if (fb2 && fb2.length >= 2 && fb2 !== kw) {
                count = countInFile(fb2, e.refPath);
            }
        }
        
        if (count < 0) continue; // file missing
        if (count === 0) { zero++; if (zeroExamples.length < 5) zeroExamples.push({ kw, cell: e.cellText.substring(0, 40) }); }
        else if (count === 1) one++;
        else twoPlus++;
    }
    
    console.log(`[${strat.name}]`);
    console.log(`  0건: ${zero} (${(zero/total*100).toFixed(1)}%)  |  1건: ${one} (${(one/total*100).toFixed(1)}%)  |  2건+: ${twoPlus} (${(twoPlus/total*100).toFixed(1)}%)`);
    if (zeroExamples.length) zeroExamples.forEach(ex => console.log(`    0건 예: "${ex.kw}" (셀: ${ex.cell})`));
    console.log();
}
