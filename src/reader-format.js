// src/reader-format.js - 교재 리더 본문 포맷터 (순수 함수, ESM)
import { parseMarkdown } from './markdown-parser.js';
import { escapeHTML } from './sanitize.js';

export function formatSectionContentForReader(rawContent, filePath, chapterRefPath) {
    let html = parseMarkdown(rawContent, {
        useCustomListDiv: true,
        useReaderStyles: true,
        customSpacing: true,
        allowItalics: false,
        allowInlineCode: false,
        allowMermaid: true
    });

    // 출처 파일 경로를 하이퍼링크로 변환
    // 패턴1: "출처: `../참조자료/...md`" (기본모드)
    // 패턴2: "출처: `1과목_참조자료/...md`" (이야기모드 — ../ 없음)
    // → 사이트 루트 기준 절대경로로 변환
    html = html.replace(
        /출처:\s*`?(\.{1,2}\/[^\s`<]+\.md|[^\s`<.]+_참조자료\/[^\s`<]+\.md)`?/g,
        (match, path) => {
            const absPath = path.replace(/^\.\.\/참조자료\//, './content/참조자료/')
                                .replace(/^(\d+)과목_참조자료\//, './content/참조자료/과목$1/')
                                .replace(/^\.\//, './');
            return `출처: <a href="${escapeHTML(absPath)}" target="_blank" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(path)}</a>`;
        }
    );

    // 페이지 참조 제거: "본문 p.22", "본문 p.26~p.27" 등
    html = html.replace(/\*?\*?참고[^:]*:\s*본문\s*p\.\d+[^\n<]*/gi, '');
    html = html.replace(/본문\s*p\.\d+(?:\s*[~-]\s*p?\.\d+)?/gi, '');

    // 마인드맵 노드 상세 매핑: (LNN) → 출처(참조자료) MD 파일 라인 하이퍼링크
    // 1순위: 섹션 자체의 출처 파일 경로, 2순위: 챕터에서 추출한 참조자료 경로
    const srcMatch = rawContent.match(/출처:\s*`?(\.{1,2}\/[^\s`]+\.md|[^\s`.]+_참조자료\/[^\s`]+\.md)`?/);
    const refPath = srcMatch
        ? srcMatch[1]
            .replace(/^\.\.\/참조자료\//, './content/참조자료/')
            .replace(/^(\d+)과목_참조자료\//, './content/참조자료/과목$1/')
            .replace(/^\.\//, './')
        : chapterRefPath;
    if (refPath) {
        html = html.replace(/\(L(\d+)\)/g, (match, lineNum) => {
            return `(<a href="${escapeHTML(refPath)}#L${lineNum}" target="_blank" class="source-link">L${lineNum}</a>)`;
        });
    }

    return html;
}
