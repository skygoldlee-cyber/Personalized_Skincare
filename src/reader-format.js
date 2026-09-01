// src/reader-format.js - 교재 리더 본문 포맷터 (순수 함수, ESM)
import { parseMarkdown } from './markdown-parser.js';
import { escapeHTML } from './sanitize.js';
import { resolveRefPath } from './pdf-registry.js';

export function formatSectionContentForReader(rawContent, filePath, refPath, refFiles, refDir) {
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

    // 출처: `xxx.pdf` 패턴 → HTML 뷰어 링크로 변환
    // allowInlineCode=false이므로 백틱이 그대로 남음
    html = html.replace(
        /출처:\s*`([^`<]+\.pdf)`/g,
        (match, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            if (resolved) {
                return `출처: <a href="#" data-ref-html="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(pdfFile)}</a>`;
            }
            return match;
        }
    );

    // **참조 PDF**: `xxx.pdf` 패턴 → HTML 뷰어 링크로 변환
    // 마크다운 파서 거친 후: <strong>참조 PDF</strong>: `xxx.pdf` (백틱 그대로)
    html = html.replace(
        /<strong>참조 PDF<\/strong>:\s*`([^`<]+\.pdf)`/g,
        (match, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            if (resolved) {
                return `<a href="#" data-ref-html="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(pdfFile)}</a>`;
            }
            return match;
        }
    );

    // 페이지 참조 제거: "본문 p.22", "본문 p.26~p.27" 등
    html = html.replace(/\*?\*?참고[^:]*:\s*본문\s*p\.\d+[^\n<]*/gi, '');
    html = html.replace(/본문\s*p\.\d+(?:\s*[~-]\s*p?\.\d+)?/gi, '');

    // 출처/참고 라인에 참조자료 하이퍼링크 추가 (앱 내 HTML 뷰어 사용)
    // 단, 이미 참조 링크가 있는 경우 중복 추가하지 않음
    if (refPath) {
        const refFileName = refPath.split('/').pop().replace(/\.html$/, '');
        const refIcon = `<a href="#" data-ref-html="${escapeHTML(refPath)}" class="source-link" style="margin-left:0.5em;"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(refFileName)}</a>`;
        // blockquote 내 출처 라인 끝에 참조 링크 추가 (data-ref-html이 없는 경우만)
        html = html.replace(/(📌\s*\*\*출처\*\*(?:(?!data-ref-html)[^<])*?)(<br>|<\/p>|\n)/g, `$1 ${refIcon}$2`);
    }

    // 과목별 참조자료 파일 목록을 출처 라인 아래에 표시
    if (refFiles && refFiles.length > 0 && refDir) {
        const refLinks = refFiles.map(f => {
            const icon = f.type === 'pdf' ? 'fa-file-lines' : 'fa-file-lines';
            if (f.type === 'md') {
                const path = `content/참조자료/${refDir}/${f.file}`;
                return `<a class="ref-link-item" data-ref-md="${escapeHTML(path)}" style="display:inline-block;margin-right:0.8em;font-size:0.85em;"><i class="fa-solid ${icon}"></i> ${escapeHTML(f.name)}</a>`;
            }
            // PDF 타입 → HTML 변환본 경로로 변환
            const base = f.file.replace(/\.pdf$/, '');
            const path = `content/참조자료/html_output/${base}/${base}.html`;
            return `<a href="#" data-ref-html="${escapeHTML(path)}" class="ref-link-item" style="display:inline-block;margin-right:0.8em;font-size:0.85em;"><i class="fa-solid ${icon}"></i> ${escapeHTML(f.name)}</a>`;
        }).join('');
        const refBlock = `<div class="reader-ref-inline" style="margin:0.4em 0;padding:0.4em 0.6em;border:1px solid var(--border-color,#30363d);border-radius:6px;font-size:0.82em;"><span style="opacity:0.7;">📚 과목별 참조자료:</span> ${refLinks}</div>`;
        // 첫 번째 blockquote 종료 후 참조자료 블록 삽입
        html = html.replace(/(<\/blockquote>)/, `$1${refBlock}`);
    }

    // 마인드맵 노드 상세 매핑: (LNN) → HTML 뷰어에서 키워드 검색
    // 같은 td 셀 내의 텍스트를 키워드로 추출하여 HTML 본문 검색에 사용
    // 지원 형식: (L42) 동일 참조자료, (L42|file.pdf) 타 참조자료, (L?) 미발견
    if (refPath) {
        // (L?) 패턴 → 링크 없이 일반 텍스트로 렌더
        html = html.replace(/<td>([^<]*?)\(L\?\)([^<]*?)<\/td>/g,
            (match, before, after) => `<td>${before}(L?)${after}</td>`
        );
        // (LNN|file.pdf) 패턴 → 타 참조자료 링크 (파일명에 괄호가 있을 수 있으므로 .+? 사용)
        html = html.replace(/<td>([^<]*?)\(L(\d+)\|(.+?\.pdf)\)([^<]*?)<\/td>/g,
            (match, before, lineNum, pdfFile, after) => {
                const cellText = (before + after).replace(/\(L\d+\|.+?\.pdf\)/g, '').replace(/\(L\?\)/g, '').trim();
                let keyword = cellText.split(/\s+/)[0] || cellText;
                if (keyword.length < 2) keyword = cellText;
                const resolved = resolveRefPath(pdfFile);
                const usePath = resolved || refPath;
                return `<td>${before}(<a href="#" data-ref-html="${escapeHTML(usePath)}" data-ref-search="${escapeHTML(keyword)}" class="source-link">L${lineNum}</a>)${after}</td>`;
            }
        );
        // (LNN) 패턴 → 동일 참조자료 링크
        html = html.replace(/<td>([^<]*?)\(L(\d+)\)([^<]*?)<\/td>/g,
            (match, before, lineNum, after) => {
                const cellText = (before + after).replace(/\(L\d+\)/g, '').replace(/\(L\?\)/g, '').trim();
                let keyword = cellText.split(/\s+/)[0] || cellText;
                if (keyword.length < 2) keyword = cellText;
                return `<td>${before}(<a href="#" data-ref-html="${escapeHTML(refPath)}" data-ref-search="${escapeHTML(keyword)}" class="source-link">L${lineNum}</a>)${after}</td>`;
            }
        );
        // td 외부에 남은 (LNN|file.pdf) 패턴도 처리 (fallback)
        html = html.replace(/\(L(\d+)\|(.+?\.pdf)\)/g, (match, lineNum, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            const usePath = resolved || refPath;
            return `(<a href="#" data-ref-html="${escapeHTML(usePath)}" data-ref-search="" class="source-link">L${lineNum}</a>)`;
        });
        // td 외부에 남은 (LNN) 패턴도 처리 (fallback)
        html = html.replace(/\(L(\d+)\)/g, (match, lineNum) => {
            return `(<a href="#" data-ref-html="${escapeHTML(refPath)}" data-ref-search="" class="source-link">L${lineNum}</a>)`;
        });
    }

    // 출처 라인의 제N조를 추출하여 참조 링크에 data-ref-search 자동 추가
    // 클릭 시 HTML 뷰어에서 해당 조문을 자동 검색 (방안 C)
    html = html.split('\n').map(line => {
        if (!line.includes('data-ref-html')) return line;
        if (line.includes('data-ref-search=')) return line;
        if (!line.includes('출처') && !line.includes('참고')) return line;

        // 제N조의M 패턴 추출 (첫 번째 매칭 사용)
        const articleMatch = line.match(/제(\d+)조(?:의(\d+))?/);
        if (!articleMatch) return line;

        const search = `제${articleMatch[1]}조${articleMatch[2] ? '의' + articleMatch[2] : ''}`;

        // 첫 번째 data-ref-html 링크에 data-ref-search 추가
        return line.replace(
            /(data-ref-html="[^"]*")(?!\s*data-ref-search)/,
            `$1 data-ref-search="${escapeHTML(search)}"`
        );
    }).join('\n');

    return html;
}
