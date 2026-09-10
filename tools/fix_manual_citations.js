#!/usr/bin/env node
/**
 * 수동으로 찾은 15개 미발견 인용 링크의 새 라인 번호를 적용
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Manual mappings: { examFile, relPath, oldLineNum, newLineNum }
const manualMappings = [
    // 2과목
    { examFile: 'content/문제은행/과목2_문제.md', relPath: '../교재/manufacturing/2과목_제조및품질관리_표준형.md', oldLineNum: 2415, newLineNum: 2475 },
    { examFile: 'content/문제은행/과목2_문제.md', relPath: '../교재/manufacturing/2과목_제조및품질관리_표준형.md', oldLineNum: 3672, newLineNum: 3785 },
    { examFile: 'content/문제은행/과목2_문제.md', relPath: '../교재/manufacturing/2과목_제조및품질관리_표준형.md', oldLineNum: 3002, newLineNum: 3079 },
    { examFile: 'content/문제은행/과목2_문제.md', relPath: '../교재/manufacturing/2과목_제조및품질관리_표준형.md', oldLineNum: 2323, newLineNum: 83 },
    { examFile: 'content/문제은행/과목2_문제.md', relPath: '../교재/manufacturing/2과목_제조및품질관리_표준형.md', oldLineNum: 3556, newLineNum: 3378 },
    // 3과목
    { examFile: 'content/문제은행/과목3_문제.md', relPath: '../교재/safety/3과목_유통화장품안전관리_표준형.md', oldLineNum: 1791, newLineNum: 1837 },
    { examFile: 'content/문제은행/과목3_문제.md', relPath: '../교재/safety/3과목_유통화장품안전관리_표준형.md', oldLineNum: 1997, newLineNum: 2071 },
    { examFile: 'content/문제은행/과목3_문제.md', relPath: '../교재/safety/3과목_유통화장품안전관리_표준형.md', oldLineNum: 1990, newLineNum: 2064 },
    { examFile: 'content/문제은행/과목3_문제.md', relPath: '../교재/safety/3과목_유통화장품안전관리_표준형.md', oldLineNum: 1988, newLineNum: 2062 },
    { examFile: 'content/문제은행/과목3_문제.md', relPath: '../교재/safety/3과목_유통화장품안전관리_표준형.md', oldLineNum: 1797, newLineNum: 1843 },
    { examFile: 'content/문제은행/과목3_문제.md', relPath: '../교재/safety/3과목_유통화장품안전관리_표준형.md', oldLineNum: 1863, newLineNum: 1909 },
    // 4과목
    { examFile: 'content/문제은행/과목4_문제.md', relPath: '../교재/understanding/4과목_맞춤형화장품의이해_표준형.md', oldLineNum: 1208, newLineNum: 1237 },
    { examFile: 'content/문제은행/과목4_문제.md', relPath: '../교재/understanding/4과목_맞춤형화장품의이해_표준형.md', oldLineNum: 2338, newLineNum: 2428 },
    { examFile: 'content/문제은행/과목4_문제.md', relPath: '../교재/understanding/4과목_맞춤형화장품의이해_표준형.md', oldLineNum: 3719, newLineNum: 3903 },
    { examFile: 'content/문제은행/과목4_문제.md', relPath: '../교재/understanding/4과목_맞춤형화장품의이해_표준형.md', oldLineNum: 2957, newLineNum: 3109 },
];

// Group by exam file
const byExamFile = {};
for (const m of manualMappings) {
    if (!byExamFile[m.examFile]) byExamFile[m.examFile] = [];
    byExamFile[m.examFile].push(m);
}

const CITATION_RE = /\[([^\]]+?):\s*L(\d+)\]\(<([^>]+\.md)#L(\d+)>\)/g;
const EVIDENCE_RE = /📖\s*[^\[]*?\[L(\d+)\]\(<([^>]+\.md)#L(\d+)>\)/g;

let totalUpdated = 0;

for (const [examFile, mappings] of Object.entries(byExamFile)) {
    const examPath = path.resolve(ROOT, examFile);
    let content = fs.readFileSync(examPath, 'utf-8');

    // Build line number mapping for this exam file
    const lineMap = new Map();
    for (const m of mappings) {
        lineMap.set(`${m.relPath}#${m.oldLineNum}`, m.newLineNum);
    }

    // Collect all links
    const allLinks = [];
    CITATION_RE.lastIndex = 0;
    let match;
    while ((match = CITATION_RE.exec(content)) !== null) {
        allLinks.push({
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            fullMatch: match[0],
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
            urlLineNum: parseInt(match[3]),
            relPath: match[2],
        });
    }

    // Apply updates
    const updates = [];
    for (const link of allLinks) {
        const key = `${link.relPath}#${link.urlLineNum}`;
        if (lineMap.has(key)) {
            updates.push({
                matchStart: link.matchStart,
                matchEnd: link.matchEnd,
                fullMatch: link.fullMatch,
                oldLineNum: link.urlLineNum,
                newLineNum: lineMap.get(key),
            });
        }
    }

    if (updates.length > 0) {
        updates.sort((a, b) => b.matchStart - a.matchStart);
        for (const upd of updates) {
            const newMatch = upd.fullMatch
                .replace(`L${upd.oldLineNum}](`, `L${upd.newLineNum}](`)
                .replace(`#L${upd.oldLineNum}>`, `#L${upd.newLineNum}>`);
            content = content.substring(0, upd.matchStart) + newMatch + content.substring(upd.matchEnd);
        }
        fs.writeFileSync(examPath, content, 'utf-8');
        totalUpdated += updates.length;
        console.log(`${examFile}: ${updates.length}개 링크 수동 갱신`);
    }
}

console.log(`\n총 ${totalUpdated}개 링크 수동 갱신 완료`);
