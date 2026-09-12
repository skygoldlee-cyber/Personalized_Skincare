// tools/build/build_keyword_index.js
// GLOSSARY_INDEX 자동 생성: 교재 MD 테이블에서 (LNN|file.pdf) / (LNN) 패턴 추출
// 참조문서에서 키워드를 찾아 주변 문맥을 설명으로 추출
// **참조문서에서 키워드가 검색되는 경우만 등록** (검색 불가 → 미등록 → 런타임에 L? 처리)
// 실행: node tools/build/build_keyword_index.js

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TEXTBOOK_DIR = path.join(ROOT, 'content/교재');
const OUTPUT = path.join(ROOT, 'src/keyword-index.js');

// content/references.json에서 참조자료 설정 로드 (pdf-registry.js와 중복 제거)
const refsJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/references.json'), 'utf-8'));
const SUBJECT_DIR_TO_ID = refsJson.subjectDirMap;
const REF_DIRS = refsJson.refDirs;

const _DIR_PRIORITY = ['과목4', '과목3', '과목2', '과목1', '공통', '법령원문'];
const REF_FILE_TO_PATH = {};
for (const dir of _DIR_PRIORITY) {
    for (const f of REF_DIRS[dir] || []) {
        const base = f.replace(/\.pdf$/, '');
        if (!REF_FILE_TO_PATH[f]) {
            REF_FILE_TO_PATH[f] = `content/참조자료/ref_md/${base}/${base}.md`;
        }
    }
}

function resolveRefPath(fileName) {
    if (!fileName) return '';
    if (fileName.startsWith('content/')) return fileName;
    return REF_FILE_TO_PATH[fileName] || '';
}

// --- 참조문서 텍스트 캐시 ---
const refTextCache = {};
const refLinesCache = {};
function getRefText(refPath) {
    if (refTextCache[refPath] !== undefined) return refTextCache[refPath];
    const abs = path.join(ROOT, refPath);
    try {
        const text = fs.readFileSync(abs, 'utf-8');
        refTextCache[refPath] = text;
        refLinesCache[refPath] = text.split('\n');
        return text;
    } catch {
        refTextCache[refPath] = null;
        return null;
    }
}

function getRefLines(refPath) {
    if (refLinesCache[refPath] === undefined) getRefText(refPath);
    return refLinesCache[refPath] || [];
}

function keywordExistsInRef(keyword, refPath) {
    const text = getRefText(refPath);
    if (!text) return false;
    return text.replace(/\s+/g, '').includes(keyword.replace(/\s+/g, ''));
}

// --- 참조문서에서 키워드 주변 문맥 추출 ---
function extractContext(keyword, refPath) {
    const lines = getRefLines(refPath);
    if (!lines.length) return '';

    const kwClean = keyword.replace(/\s+/g, '');

    // 라인들을 블록(공백 라인으로 구분된 연속된 비공백 라인 그룹)으로 분할
    const blocks = [];
    let currentBlock = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '') {
            if (currentBlock.length > 0) {
                blocks.push({ startLine: i - currentBlock.length, lines: currentBlock });
                currentBlock = [];
            }
        } else {
            currentBlock.push(lines[i]);
        }
    }
    if (currentBlock.length > 0) {
        blocks.push({ startLine: lines.length - currentBlock.length, lines: currentBlock });
    }

    // 키워드가 포함된 블록 찾기
    for (let bi = 0; bi < blocks.length; bi++) {
        const blockText = blocks[bi].lines.join('').replace(/\s+/g, '');
        if (blockText.includes(kwClean)) {
            const contextParts = [];
            // 이전 블록 (heading/context)
            if (bi > 0) {
                const prevText = blocks[bi - 1].lines.join(' ').trim();
                if (prevText.length <= 100) contextParts.push(prevText);
            }
            // 현재 블록
            contextParts.push(blocks[bi].lines.join(' ').trim());
            // 다음 블록
            if (bi + 1 < blocks.length) {
                const nextText = blocks[bi + 1].lines.join(' ').trim();
                if (nextText.length <= 200) contextParts.push(nextText);
            }
            let result = contextParts.join(' ').replace(/\s+/g, ' ').trim();
            // 너무 길면 키워드 중심으로 잘라내기
            if (result.length > 300) {
                const cleanResult = result.replace(/\s+/g, '');
                const kwPos = cleanResult.indexOf(kwClean);
                if (kwPos >= 0) {
                    const start = Math.max(0, kwPos - 100);
                    const end = Math.min(cleanResult.length, kwPos + kwClean.length + 150);
                    result = (start > 0 ? '...' : '') + cleanResult.substring(start, end) + (end < cleanResult.length ? '...' : '');
                } else {
                    result = result.substring(0, 300) + '...';
                }
            }
            return result;
        }
    }
    return '';
}

// --- 셀에서 키워드 추출 ---
function extractKeywordFromCell(cellText) {
    let c = cellText;
    c = c.replace(/\(L\d+\\?\|.+?\.pdf\)/g, '');
    c = c.replace(/\(L\d+\)/g, '');
    c = c.replace(/\(L\?\\?\|.+?\.pdf\)/g, '');
    c = c.replace(/\(L\?\)/g, '');
    c = c.replace(/\*\*/g, '').replace(/\*/g, '');
    c = c.replace(/<br\s*\/?>/gi, ' ');
    c = c.replace(/\s+/g, ' ').trim();
    const firstPart = c.split(/[,.·—–]/)[0].trim();
    return firstPart || c;
}

// --- 메인 로직 ---
const subjects = fs.readdirSync(TEXTBOOK_DIR).filter(d => {
    try { return fs.readdirSync(path.join(TEXTBOOK_DIR, d)).some(f => f.endsWith('.md')); } catch { return false; }
});

const GLOSSARY_INDEX = {};
let totalChecked = 0, totalRegistered = 0, totalSkipped = 0;
const skipped = [];

for (const subj of subjects) {
    const files = fs.readdirSync(path.join(TEXTBOOK_DIR, subj)).filter(f => f.endsWith('.md'));
    for (const f of files) {
        const filePath = path.join(TEXTBOOK_DIR, subj, f);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        let currentRefPath = '';

        for (let i = 0; i < lines.length; i++) {
            const srcMatch = lines[i].match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n|$)/);
            if (srcMatch) currentRefPath = resolveRefPath(srcMatch[1].trim()) || '';
            const srcMatch2 = lines[i].match(/참조\s*PDF[:：]\s*`?([^`\n|]+\.pdf)/);
            if (srcMatch2) currentRefPath = resolveRefPath(srcMatch2[1].trim()) || '';

            if (!lines[i].trim().startsWith('|')) continue;
            if (/^\|[-\s|]+\|/.test(lines[i].trim())) continue;

            // (LNN|file.pdf) 패턴
            let m;
            const re1 = /\(L(\d+)\\?\|(.+?\.pdf)\)/g;
            const matches1 = [];
            while ((m = re1.exec(lines[i])) !== null) {
                matches1.push({ lineNum: m[1], pdfFile: m[2], full: m[0] });
            }

            for (const link of matches1) {
                const refPath = resolveRefPath(link.pdfFile);
                if (!refPath) continue;
                totalChecked++;

                const safeLine = lines[i].replace(/\\\|/g, '\x00');
                const cells = safeLine.split('|').slice(1, -1).map(c => c.replace(/\x00/g, '|').trim());
                const linkNorm = link.full.replace(/\\\|/g, '|');
                let keyword = '';
                for (const cell of cells) {
                    if (cell.includes(linkNorm)) { keyword = extractKeywordFromCell(cell); break; }
                }

                if (keyword.length >= 2 && keywordExistsInRef(keyword, refPath)) {
                    const idxKey = `${refPath.split('/').pop()}|L${link.lineNum}`;
                    const explanation = extractContext(keyword, refPath);
                    GLOSSARY_INDEX[idxKey] = { keyword, explanation, refDoc: refPath.split('/').pop().replace(/\.md$/, ''), subjectId: SUBJECT_DIR_TO_ID[subj] || subj };
                    totalRegistered++;
                } else {
                    totalSkipped++;
                    if (skipped.length < 20) skipped.push(`${subj}/${f}:${i+1} kw:"${keyword}" → ${refPath.split('/').pop()}`);
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
                const linkNorm = link.full.replace(/\\\|/g, '|');
                let keyword = '';
                for (const cell of cells) {
                    if (cell.includes(linkNorm)) { keyword = extractKeywordFromCell(cell); break; }
                }

                if (keyword.length >= 2 && keywordExistsInRef(keyword, currentRefPath)) {
                    const idxKey = `${currentRefPath.split('/').pop()}|L${link.lineNum}`;
                    const explanation = extractContext(keyword, currentRefPath);
                    GLOSSARY_INDEX[idxKey] = { keyword, explanation, refDoc: currentRefPath.split('/').pop().replace(/\.md$/, ''), subjectId: SUBJECT_DIR_TO_ID[subj] || subj };
                    totalRegistered++;
                } else {
                    totalSkipped++;
                    if (skipped.length < 20) skipped.push(`${subj}/${f}:${i+1} kw:"${keyword}" → ${currentRefPath.split('/').pop()} (same)`);
                }
            }
        }
    }
}

// --- 과목별 큐레이션 용어집 JSON 병합 ---
// content/교재/glossary/subject{N}.json 에서 큐레이션 정의를 읽어와
// GLOSSARY_INDEX의 explanation을 definition으로 덮어쓰기
const GLOSSARY_DIR = path.join(ROOT, 'content/교재/glossary');
// 큐레이션 맵: keyword → [{ definition, subjectId? }] (동일 키워드 과목별 정의 지원)
const curatedMap = new Map();
let curatedCount = 0;

if (fs.existsSync(GLOSSARY_DIR)) {
    const glossaryFiles = fs.readdirSync(GLOSSARY_DIR).filter(f => f.endsWith('.json'));
    for (const gf of glossaryFiles) {
        // 파일명에서 과목 ID 추출: subject1.json → 과목1, subject2.json → 과목2, ...
        const subjMatch = gf.match(/subject(\d+)/i);
        const fileSubjectId = subjMatch ? `과목${subjMatch[1]}` : null;
        try {
            const items = JSON.parse(fs.readFileSync(path.join(GLOSSARY_DIR, gf), 'utf-8'));
            for (const item of items) {
                if (item.keyword && item.definition) {
                    // item.subject가 있으면 해당 과목만 매칭, 없으면 파일명 기반 또는 전역
                    const subjectId = item.subject ? `과목${item.subject}` : fileSubjectId;
                    if (!curatedMap.has(item.keyword)) curatedMap.set(item.keyword, []);
                    curatedMap.get(item.keyword).push({ definition: item.definition, subjectId });
                    curatedCount++;
                }
            }
        } catch (e) {
            console.warn(`[경고] glossary JSON 파싱 실패: ${gf} — ${e.message}`);
        }
    }
}

// GLOSSARY_INDEX에 큐레이션 정의 병합 (subjectId 범위 매칭)
let mergedCount = 0;
for (const [idxKey, entry] of Object.entries(GLOSSARY_INDEX)) {
    const candidates = curatedMap.get(entry.keyword);
    if (!candidates) continue;
    // 1순위: entry.subjectId와 일치하는 큐레이션 정의
    let match = candidates.find(c => c.subjectId && c.subjectId === entry.subjectId);
    // 2순위: subjectId가 없는 전역 큐레이션 정의
    if (!match) match = candidates.find(c => !c.subjectId);
    if (match) {
        entry.explanation = match.definition;
        entry.curated = true;
        mergedCount++;
    }
}

// --- glossary JSON의 미등록 항목을 GLOSSARY_INDEX에 추가 등록 ---
// 교재 본문에 (LNN|file.pdf) 링크가 없어서 GLOSSARY_INDEX에 등록되지 않은
// 큐레이션 정의를 과목별 대표 참조문서를 refDoc으로 하여 추가 등록.
// 이를 통해 "중요 용어 해설" 섹션에서 glossary JSON의 모든 정의가 표시됨.
const SUBJECT_DEFAULT_REFDOC = refsJson.subjectDefaultRefdoc || {};
let addedCount = 0;
for (const [keyword, candidates] of curatedMap) {
    for (const cand of candidates) {
        const subjectId = cand.subjectId;
        if (!subjectId) continue;
        // 이미 해당 과목에 같은 키워드가 GLOSSARY_INDEX에 있는지 확인
        const alreadyExists = Object.entries(GLOSSARY_INDEX).some(
            ([, entry]) => entry.keyword === keyword && entry.subjectId === subjectId
        );
        if (alreadyExists) continue;
        // 과목별 대표 refDoc
        const refDoc = SUBJECT_DEFAULT_REFDOC[subjectId] || '';
        if (!refDoc) continue;
        // 가상 idxKey: "glossary:과목N:키워드"
        const idxKey = `glossary:${subjectId}:${keyword}`;
        GLOSSARY_INDEX[idxKey] = {
            keyword,
            explanation: cand.definition,
            refDoc,
            subjectId,
            curated: true,
        };
        addedCount++;
    }
}

// --- 출력 파일 작성 ---
const jsonStr = JSON.stringify(GLOSSARY_INDEX);
const output = `// src/keyword-index.js — 용어집 인덱스 (참조문서에서 추출한 키워드 + 설명)
// 자동 생성됨: node tools/build/build_keyword_index.js
// 키: "파일명.md|L라인번호" 또는 "glossary:과목N:키워드" (큐레이션 전용)
// → 값: { keyword, explanation, refDoc, subjectId, curated? }
// **참조문서에서 키워드가 검색되는 경우만 자동 등록** (검색 불가 → 미등록 → 런타임에 L? 처리)
// **큐레이션 정의**: content/교재/glossary/subject{N}.json에서 정의가 있으면
//   1) 기존 자동 등록 항목의 explanation을 덮어쓰고 curated=true 설정
//   2) 미등록 키워드는 과목별 대표 참조문서를 refDoc으로 하여 추가 등록
export const GLOSSARY_INDEX = ${jsonStr};
`;

fs.writeFileSync(OUTPUT, output, 'utf-8');

console.log('='.repeat(60));
console.log(`총 확인: ${totalChecked}`);
console.log(`등록 (참조문서에 키워드 존재): ${totalRegistered}`);
console.log(`미등록 (참조문서에 키워드 없음): ${totalSkipped}`);
console.log(`등록률: ${totalChecked > 0 ? Math.round(totalRegistered / totalChecked * 100) : 0}%`);
console.log(`GLOSSARY_INDEX 항목 수: ${Object.keys(GLOSSARY_INDEX).length}`);
console.log(`큐레이션 정의: ${curatedCount}개 로드, ${mergedCount}개 병합, ${addedCount}개 추가 등록`);
console.log(`출력: ${path.relative(ROOT, OUTPUT)}`);
if (skipped.length > 0) {
    console.log('\n미등록 샘플 (최대 20개):');
    for (const s of skipped) console.log(`  ${s}`);
}
const sampleKeys = Object.keys(GLOSSARY_INDEX).slice(0, 5);
if (sampleKeys.length > 0) {
    console.log('\n설명 추출 샘플:');
    for (const k of sampleKeys) {
        const v = GLOSSARY_INDEX[k];
        console.log(`  ${k}: kw="${v.keyword}" ref="${v.refDoc}"`);
        console.log(`    설명: ${v.explanation.substring(0, 120)}${v.explanation.length > 120 ? '...' : ''}`);
    }
}
