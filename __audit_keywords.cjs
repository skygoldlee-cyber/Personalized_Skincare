// __audit_keywords.cjs — 마인드맵 키워드 전수조사: 참조문서 존재 여부 확인 후 제거
const fs = require('fs');
const path = require('path');

const REF_BASE = 'content/참조자료/html_output';

const REF_DIRS = {
    '법령원문': [
        '화장품법(법률)(제20901호)(20260402).pdf',
        '화장품법 시행규칙(총리령)(제02109호)(20260402).pdf',
        '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf',
        '우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).pdf',
        '기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf',
        '기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf',
        '화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).pdf',
        '화장품의 색소 종류 및 기준(식품의약품안전처고시)(제2023-61호)(20230921).pdf'
    ],
    '공통': [
        '화장품법(법률)(제20901호)(20260402).pdf', '색소종류및기준_전체.pdf',
        '시행규칙_별표3_사용시주의사항.pdf', '시행규칙_별표4_포장표시기준및방법.pdf',
        '시행규칙_별표5_표시광고범위및준수사항.pdf', '시행규칙_별표6_위해화장품공표문.pdf',
        '시행규칙_별표7_행정처분기준.pdf', '시행규칙_별표9_수수료.pdf',
        '안전기준_별표1_사용불가원료.pdf', '안전기준_별표2_사용제한원료.pdf',
        '안전기준_별표3_인체세포조직배양액안전기준.pdf', '안전기준_별표4_유통안전관리시험방법.pdf',
        '주의사항_별표1_유형별주의사항표시문구.pdf', '주의사항_별표2_알레르기유발성분25종.pdf',
        'CGMP_별표1_공정별분류.pdf', 'CGMP_별표2_실시상황평가표.pdf', 'CGMP_별표3_적합업소로고.pdf'
    ],
    '과목1': ['시행규칙_별표1_품질관리기준.pdf', '시행규칙_별표2_책임판매안전관리기준.pdf'],
    '과목2': [
        'KFCC_별표1_통칙.pdf', 'KFCC_별표2_미백_나이아신아마이드.pdf', 'KFCC_별표3_주름개선_레티놀.pdf',
        'KFCC_별표4_자외선보호.pdf', 'KFCC_별표5_미백주름복합.pdf', 'KFCC_별표6_모발색상변화.pdf',
        'KFCC_별표7_체모제거_치오글리콜산.pdf', 'KFCC_별표8_여드름완화_살리실릭애씨드.pdf',
        'KFCC_별표9_탈모완화_덱스판테놀.pdf', 'KFCC_별표10_일반시험법.pdf', '안전기준_별표1_색소_구.pdf'
    ],
    '과목3': [],
    '과목4': []
};

const _DIR_PRIORITY = ['과목4', '과목3', '과목2', '과목1', '공통', '법령원문'];
const REF_FILE_TO_PATH = {};
for (const dir of _DIR_PRIORITY) {
    for (const f of REF_DIRS[dir] || []) {
        const base = f.replace(/\.pdf$/, '');
        if (!REF_FILE_TO_PATH[f]) REF_FILE_TO_PATH[f] = `content/참조자료/html_output/${base}/${base}.md`;
    }
}

function resolveRefPath(fileName) {
    if (!fileName) return '';
    if (fileName.startsWith('content/')) return fileName;
    return REF_FILE_TO_PATH[fileName] || '';
}

const refTextCache = {};
function getRefTextClean(refPath) {
    if (refTextCache[refPath] !== undefined) return refTextCache[refPath];
    try {
        const text = fs.readFileSync(refPath, 'utf-8');
        refTextCache[refPath] = text.replace(/\s+/g, '');
        return refTextCache[refPath];
    } catch {
        refTextCache[refPath] = null;
        return null;
    }
}

function keywordExistsInRef(keyword, refPath) {
    const text = getRefTextClean(refPath);
    if (!text) return false;
    return text.includes(keyword.replace(/\s+/g, ''));
}

function extractKeywordFromCell(cellText) {
    let c = cellText;
    c = c.replace(/\(L\d+\\?\|.+?\.pdf\)/g, '');
    c = c.replace(/\(L\d+\)/g, '');
    c = c.replace(/\(L\?\|.+?\.pdf\)/g, '');
    c = c.replace(/\(L\?\)/g, '');
    c = c.replace(/\*\*/g, '').replace(/\*/g, '');
    c = c.replace(/<br\s*\/?>/gi, ' ');
    c = c.replace(/\s+/g, ' ').trim();
    const firstPart = c.split(/[,.·—–]/)[0].trim();
    return firstPart || c;
}

const textbookDir = 'content/교재';
const subjects = fs.readdirSync(textbookDir).filter(d => {
    try { return fs.readdirSync(path.join(textbookDir, d)).some(f => f.endsWith('.md')); } catch { return false; }
});

let totalChecked = 0, totalValid = 0, totalInvalid = 0;
const invalidLinks = [];

for (const subj of subjects) {
    const files = fs.readdirSync(path.join(textbookDir, subj)).filter(f => f.endsWith('.md'));
    for (const f of files) {
        const filePath = path.join(textbookDir, subj, f);
        let content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        let currentRefPath = '';
        let modified = false;

        for (let i = 0; i < lines.length; i++) {
            // 섹션 refPath 업데이트
            const srcMatch = lines[i].match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n|$)/);
            if (srcMatch) currentRefPath = resolveRefPath(srcMatch[1].trim()) || '';
            const srcMatch2 = lines[i].match(/참조\s*PDF[:：]\s*`?([^`\n|]+\.pdf)/);
            if (srcMatch2) currentRefPath = resolveRefPath(srcMatch2[1].trim()) || '';

            if (!lines[i].trim().startsWith('|')) continue;
            if (/^\|[-\s|]+\|/.test(lines[i].trim())) continue;

            // (LNN|file.pdf) 패턴 (마크다운에서 |는 \|로 이스케이프됨)
            let m;
            const re1 = /\(L(\d+)\\?\|(.+?\.pdf)\)/g;
            const matches1 = [];
            while ((m = re1.exec(lines[i])) !== null) {
                matches1.push({ lineNum: m[1], pdfFile: m[2], full: m[0] });
            }

            for (const link of matches1) {
                const refPath = resolveRefPath(link.pdfFile);
                totalChecked++;
                if (!refPath) {
                    totalInvalid++;
                    invalidLinks.push({ file: `${subj}/${f}`, line: i + 1, link: link.full, reason: 'refPath not found' });
                    lines[i] = lines[i].replace(link.full, '(L?)');
                    modified = true;
                    continue;
                }
                // 셀 키워드 추출
                const safeLine = lines[i].replace(/\\\|/g, '\x00');
                const cells = safeLine.split('|').slice(1, -1).map(c => c.replace(/\x00/g, '|').trim());
                let keyword = '';
                const linkNorm = link.full.replace(/\\\|/g, '|');
                for (const cell of cells) {
                    if (cell.includes(linkNorm)) { keyword = extractKeywordFromCell(cell); break; }
                }
                if (keyword.length >= 2 && keywordExistsInRef(keyword, refPath)) {
                    totalValid++;
                } else {
                    totalInvalid++;
                    invalidLinks.push({ file: `${subj}/${f}`, line: i + 1, link: link.full, keyword, refFile: refPath.split('/').pop(), reason: 'keyword not in ref' });
                    lines[i] = lines[i].replace(link.full, '(L?)');
                    modified = true;
                }
            }

            // (LNN) 패턴 (same ref)
            const tempLine = lines[i].replace(/\(L\d+\\?\|.+?\.pdf\)/g, '___SKIP___');
            const re2 = /\(L(\d+)\)(?!\|)/g;
            const matches2 = [];
            while ((m = re2.exec(tempLine)) !== null) {
                matches2.push({ lineNum: m[1], full: m[0] });
            }
            for (const link of matches2) {
                if (!currentRefPath) continue;
                totalChecked++;
                const safeLine = lines[i].replace(/\\\|/g, '\x00');
                const cells = safeLine.split('|').slice(1, -1).map(c => c.replace(/\x00/g, '|').trim());
                let keyword = '';
                const linkNorm = link.full.replace(/\\\|/g, '|');
                for (const cell of cells) {
                    if (cell.includes(linkNorm)) { keyword = extractKeywordFromCell(cell); break; }
                }
                if (keyword.length >= 2 && keywordExistsInRef(keyword, currentRefPath)) {
                    totalValid++;
                } else {
                    totalInvalid++;
                    invalidLinks.push({ file: `${subj}/${f}`, line: i + 1, link: link.full, keyword, refFile: currentRefPath.split('/').pop(), reason: 'keyword not in ref (same)' });
                    lines[i] = lines[i].replace(link.full, '(L?)');
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
            console.log(`[MODIFIED] ${subj}/${f}`);
        }
    }
}

console.log('\n' + '='.repeat(60));
console.log(`총 확인: ${totalChecked}`);
console.log(`유효 (참조문서에 키워드 존재): ${totalValid}`);
console.log(`무효 (참조문서에 키워드 없음 → L?로 변경): ${totalInvalid}`);
console.log(`유효률: ${totalChecked > 0 ? Math.round(totalValid / totalChecked * 100) : 0}%`);
console.log('\n무효 링크 목록:');
for (const l of invalidLinks) {
    console.log(`  ${l.file}:${l.line} ${l.link} [${l.reason}] kw:"${l.keyword || '?'}" ref:${l.refFile || '?'}`);
}
