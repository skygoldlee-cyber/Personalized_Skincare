#!/usr/bin/env node
/**
 * replace_pdf_links.js
 *
 * 교재 파일의 "참조 PDF" 링크를 대응하는 .md 파일 링크로 일괄 수정합니다.
 * 라벨도 "참조 PDF" → "참조 자료"로 변경합니다.
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

// PDF basename → MD relative path (from 교재 파일 기준: ../참조자료/ref_md/{base}/{base}.md)
const refMdDir = path.join(ROOT, 'content/참조자료/ref_md');
const pdfDir = path.join(ROOT, 'content/참조자료/법령원문');

// Build PDF filename → MD path mapping
const pdfToMd = {};
const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
for (const pdf of pdfFiles) {
    const base = pdf.replace(/\.pdf$/, '');
    const mdDir = path.join(refMdDir, base);
    if (fs.existsSync(mdDir)) {
        const mdFiles = fs.readdirSync(mdDir).filter(f => f.endsWith('.md'));
        if (mdFiles.length > 0) {
            // Relative path from 교재/ subfolder: ../참조자료/ref_md/{base}/{base}.md
            pdfToMd[pdf] = `../참조자료/ref_md/${base}/${mdFiles[0]}`;
        }
    }
}

console.log('=== PDF → MD 매핑 ===');
for (const [pdf, md] of Object.entries(pdfToMd)) {
    console.log(`  ${pdf} → ${md}`);
}
console.log(`총 ${Object.keys(pdfToMd).length}개 매핑\n`);

// Also build a mapping for URL-encoded PDF filenames
// The links in markdown use URL-encoded paths like: 화장품법%28법률%29%28제20901호%29%2820260402%29.pdf
const encodedPdfToMd = {};
for (const [pdf, md] of Object.entries(pdfToMd)) {
    // Encode parentheses and spaces
    const encoded = pdf
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/ /g, '%20');
    encodedPdfToMd[encoded] = md;
}

let totalReplaced = 0;
const results = [];

for (const textbookFile of TEXTBOOK_FILES) {
    const filePath = path.resolve(ROOT, textbookFile);
    if (!fs.existsSync(filePath)) {
        console.log(`[건너뜀] ${textbookFile}`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    let replaced = 0;

    // Pattern 1: **참조 PDF**: [filename.pdf](../참조자료/법령원문/url_encoded.pdf)
    // → **참조 자료**: [filename.md](../참조자료/ref_md/base/base.md)
    content = content.replace(
        /\*\*참조 PDF\*\*:\s*\[([^\]]+\.pdf)\]\(([^)]+\.pdf)\)/g,
        (match, linkText, urlPath) => {
            // Extract PDF filename from URL path
            const urlDecoded = decodeURIComponent(urlPath);
            const pdfFileName = urlDecoded.split('/').pop();

            if (pdfToMd[pdfFileName]) {
                const mdPath = pdfToMd[pdfFileName];
                const mdFileName = mdPath.split('/').pop();
                replaced++;
                return `**참조 자료**: [${mdFileName}](${mdPath})`;
            }
            // Try matching by encoded name
            const encodedName = urlPath.split('/').pop();
            if (encodedPdfToMd[encodedName]) {
                const mdPath = encodedPdfToMd[encodedName];
                const mdFileName = mdPath.split('/').pop();
                replaced++;
                return `**참조 자료**: [${mdFileName}](${mdPath})`;
            }
            console.log(`  [매핑 실패] ${textbookFile}: ${pdfFileName}`);
            return match; // Keep original if no mapping
        }
    );

    if (replaced > 0) {
        fs.writeFileSync(filePath, content, 'utf-8');
        totalReplaced += replaced;
        results.push({ file: textbookFile, replaced });
        console.log(`${textbookFile}: ${replaced}개 교체`);
    } else {
        console.log(`${textbookFile}: 변경 없음`);
    }
}

console.log(`\n=== 총 교체: ${totalReplaced}개 ===`);
results.forEach(r => console.log(`  ${r.file.split('/').pop()}: ${r.replaced}개`));
