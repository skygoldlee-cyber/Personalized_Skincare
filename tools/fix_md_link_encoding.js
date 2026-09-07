#!/usr/bin/env node
/**
 * fix_md_link_encoding.js
 *
 * 교재 파일의 ref_md MD 링크 URL에서 괄호를 URL 인코딩(%28/%29)으로 변환합니다.
 * 마크다운 파서의 [text](url) 정규식이 url에서 ')'를 만나면 종료되기 때문에
 * 리터럴 괄호를 %28/%29로 인코딩해야 정상 파싱됩니다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TEXTBOOK_FILES = [
    'content/교재/law/1과목_화장품법의이해_이야기형.md',
    'content/교재/law/1과목_화장품법의이해_표준형.md',
    'content/교재/manufacturing/2과목_제조및품질관리_이야기형.md',
    'content/교재/manufacturing/2과목_제조및품질관리_표준형.md',
    'content/교재/safety/3과목_유통화장품안전관리_이야기형.md',
    'content/교재/safety/3과목_유통화장품안전관리_표준형.md',
    'content/교재/understanding/4과목_맞춤형화장품의이해_이야기형.md',
    'content/교재/understanding/4과목_맞춤형화장품의이해_표준형.md',
];

let totalFixed = 0;

for (const file of TEXTBOOK_FILES) {
    const filePath = path.resolve(ROOT, file);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    let fixed = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Find pattern: ](../참조자료/ref_md/.../....md)
        // The URL contains literal () which breaks markdown parsing
        // Strategy: find ]( and then the last ).md) on the line
        const idx = line.indexOf('](../참조자료/ref_md/');
        if (idx === -1) continue;

        // Find the last ".md)" on the line - the ) is markdown syntax, not part of URL
        const mdEnd = line.lastIndexOf('.md)');
        if (mdEnd === -1 || mdEnd < idx) continue;

        const urlStart = idx + 2; // skip "]("
        const urlEnd = mdEnd + 3; // ".md" only, exclude the closing ")"
        const url = line.substring(urlStart, urlEnd);

        if (!/[()]/.test(url)) continue;

        const encoded = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
        lines[i] = line.substring(0, urlStart) + encoded + ')' + line.substring(urlEnd + 1);
        fixed++;
    }

    if (fixed > 0) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        totalFixed += fixed;
        console.log(`${file}: ${fixed}개 수정`);
    } else {
        console.log(`${file}: 변경 없음`);
    }
}

console.log(`\n총 수정: ${totalFixed}개`);
