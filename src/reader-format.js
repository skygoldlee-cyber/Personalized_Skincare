// src/reader-format.js - 교재 리더 본문 포맷터 (순수 함수, ESM)
import { parseMarkdown } from './markdown-parser.js';
import { escapeHTML } from './sanitize.js';

export function formatSectionContentForReader(rawContent) {
    let html = parseMarkdown(rawContent, {
        useCustomListDiv: true,
        useReaderStyles: true,
        customSpacing: true,
        allowItalics: false,
        allowInlineCode: false,
        allowMermaid: true
    });

    // 출처 파일 경로를 하이퍼링크로 변환
    // 패턴: "출처: `../참조자료/...md`" (backticks are literal in HTML output)
    html = html.replace(
        /출처:\s*`?(\.{1,2}\/[^\s`<]+\.md)`?/g,
        (match, path) => {
            return `출처: <a href="${escapeHTML(path)}" target="_blank" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(path)}</a>`;
        }
    );

    return html;
}
