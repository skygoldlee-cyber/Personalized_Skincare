// src/reader-format.js - 교재 리더 본문 포맷터 (순수 함수, ESM)
import { parseMarkdown } from './markdown-parser.js';
import { escapeHTML } from './sanitize.js';
import { resolveRefPath, KEYWORD_REF_MAP } from './pdf-registry.js';
import { GLOSSARY_INDEX } from './keyword-index.js';

export function formatSectionContentForReader(rawContent, filePath, refPath, refFiles, refDir, glossaryKeywords) {
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
    // → 앱 내 MD 뷰어(data-ref-md)로 열기
    html = html.replace(
        /출처:\s*`?(\.{1,2}\/[^\s`<]+\.md|[^\s`<.]+_참조자료\/[^\s`<]+\.md)`?/g,
        (match, path) => {
            const absPath = path.replace(/^\.\.\/참조자료\//, 'content/참조자료/')
                                .replace(/^(\d+)과목_참조자료\//, 'content/참조자료/과목$1/');
            const displayName = path.split('/').pop().replace(/\.md$/, '');
            return `출처: <a href="#" data-ref-md="${escapeHTML(absPath)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(displayName)}</a>`;
        }
    );

    // 출처: `xxx.pdf` 패턴 → HTML 뷰어 링크로 변환 (표시 텍스트에서 .pdf 확장자 제거)
    // allowInlineCode=false이므로 백틱이 그대로 남음
    html = html.replace(
        /출처:\s*`([^`<]+\.pdf)`/g,
        (match, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            if (resolved) {
                const displayName = pdfFile.replace(/\.pdf$/, '');
                return `출처: <a href="#" data-ref-html="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(displayName)}</a>`;
            }
            return match;
        }
    );

    // **참조 PDF**: `xxx.pdf` 패턴 → HTML 뷰어 링크로 변환 (라벨을 '참조 자료'로 변경, .pdf 확장자 제거)
    // 마크다운 파서 거친 후: <strong>참조 PDF</strong>: `xxx.pdf` (백틱 그대로)
    html = html.replace(
        /<strong>참조 PDF<\/strong>:\s*`([^`<]+\.pdf)`/g,
        (match, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            if (resolved) {
                const displayName = pdfFile.replace(/\.pdf$/, '');
                return `<strong>참조 자료</strong>: <a href="#" data-ref-html="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(displayName)}</a>`;
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
        const refFileName = refPath.split('/').pop().replace(/\.(html|md)$/, '');
        const refIcon = `<a href="#" data-ref-html="${escapeHTML(refPath)}" class="source-link" style="margin-left:0.5em;"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(refFileName)}</a>`;
        // blockquote 내 출처 라인 끝에 참조 링크 추가 (data-ref-html이 없는 경우만)
        html = html.replace(/(📌\s*\*\*출처\*\*(?:(?!data-ref-html)[^<])*?)(<br>|<\/p>|\n)/g, `$1 ${refIcon}$2`);
    }

    // 과목별 참조자료 파일 목록을 출처 라인 아래에 표시
    if (refFiles && refFiles.length > 0 && refDir) {
        const refLinks = refFiles.map(f => {
            const icon = 'fa-file-lines';
            if (f.type === 'md') {
                const path = `content/참조자료/${refDir}/${f.file}`;
                return `<a class="ref-link-item" data-ref-md="${escapeHTML(path)}" style="display:inline-block;margin-right:0.8em;font-size:0.85em;"><i class="fa-solid ${icon}"></i> ${escapeHTML(f.name)}</a>`;
            }
            // PDF 타입 → resolveRefPath로 HTML 경로 변환
            const path = resolveRefPath(f.file);
            return `<a href="#" data-ref-html="${escapeHTML(path)}" class="ref-link-item" style="display:inline-block;margin-right:0.8em;font-size:0.85em;"><i class="fa-solid ${icon}"></i> ${escapeHTML(f.name)}</a>`;
        }).join('');
        const refBlock = `<div class="reader-ref-inline" style="margin:0.4em 0;padding:0.4em 0.6em;border:1px solid var(--border-color,#30363d);border-radius:6px;font-size:0.82em;"><span style="opacity:0.7;">📚 과목별 참조자료:</span> ${refLinks}</div>`;
        // 첫 번째 blockquote 종료 후 참조자료 블록 삽입 (단, 이미 reader-ref-inline이 있는 경우 중복 방지)
        if (!html.includes('reader-ref-inline')) {
            html = html.replace(/(<\/blockquote>)/, `$1${refBlock}`);
        }
    }

    // 본문 키워드 자동 하이퍼링크: 법령명/별표명을 클릭 가능한 링크로 변환
    // <p>와 <li> 내 텍스트 노드만 처리 (기존 <a> 태그, <td>, 출처 라인 제외)
    html = html.replace(/<(p|li)>([^<]*)<\/\1>/g, (match, tag, text) => {
        let result = text;
        for (const entry of KEYWORD_REF_MAP) {
            const re = new RegExp(entry.pattern.source, entry.pattern.flags.replace(/g$/, ''));
            if (re.test(result) && !result.includes('data-ref-html')) {
                const path = resolveRefPath(entry.file);
                if (path) {
                    const search = entry.search || '';
                    result = result.replace(re, (kw) =>
                        `<a href="#" data-ref-html="${escapeHTML(path)}" data-ref-search="${escapeHTML(search)}" class="keyword-ref-link" style="color:var(--color-primary,#1f6feb);text-decoration:underline dotted;">${escapeHTML(kw)}</a>`
                    );
                }
            }
        }
        return `<${tag}>${result}</${tag}>`;
    });

    // 마인드맵 노드 상세 매핑: (LNN) → 같은 페이지 하단 용어집 테이블로 스크롤
    // 같은 td 셀 내의 텍스트를 키워드로 추출하여 용어집 앵커로 사용
    // 지원 형식: (L42) 동일 참조자료, (L42|file.pdf) 타 참조자료, (L?) 미발견
    if (refPath) {
        // (L?) 패턴 → 링크 없이 일반 텍스트로 렌더
        html = html.replace(/<td>([^<]*?)\(L\?\)([^<]*?)<\/td>/g,
            (match, before, after) => `<td>${before}(L?)${after}</td>`
        );
        // (LNN|file.pdf) 패턴 → 용어집 앵커 링크 (GLOSSARY_INDEX에 키워드가 있는 경우만)
        html = html.replace(/<td>([^<]*?)\(L(\d+)\|(.+?\.pdf)\)([^<]*?)<\/td>/g,
            (match, before, lineNum, pdfFile, after) => {
                const resolved = resolveRefPath(pdfFile);
                const usePath = resolved || refPath;
                const idxKey = `${usePath.split('/').pop()}|L${lineNum}`;
                const entry = GLOSSARY_INDEX[idxKey];
                if (!entry) return `<td>${before}(L?)${after}</td>`;
                return `<td>${before}(<a href="#glossary-${escapeHTML(idxKey)}" data-glossary="${escapeHTML(idxKey)}" class="glossary-link">L${lineNum}</a>)${after}</td>`;
            }
        );
        // (LNN) 패턴 → 용어집 앵커 링크 (GLOSSARY_INDEX에 키워드가 있는 경우만)
        html = html.replace(/<td>([^<]*?)\(L(\d+)\)([^<]*?)<\/td>/g,
            (match, before, lineNum, after) => {
                const idxKey = `${refPath.split('/').pop()}|L${lineNum}`;
                const entry = GLOSSARY_INDEX[idxKey];
                if (!entry) return `<td>${before}(L?)${after}</td>`;
                return `<td>${before}(<a href="#glossary-${escapeHTML(idxKey)}" data-glossary="${escapeHTML(idxKey)}" class="glossary-link">L${lineNum}</a>)${after}</td>`;
            }
        );
        // td 외부에 남은 (LNN|file.pdf) 패턴도 처리
        html = html.replace(/\(L(\d+)\|(.+?\.pdf)\)/g, (match, lineNum, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            const usePath = resolved || refPath;
            const idxKey = `${usePath.split('/').pop()}|L${lineNum}`;
            const entry = GLOSSARY_INDEX[idxKey];
            if (!entry) return '(L?)';
            return `(<a href="#glossary-${escapeHTML(idxKey)}" data-glossary="${escapeHTML(idxKey)}" class="glossary-link">L${lineNum}</a>)`;
        });
        // td 외부에 남은 (LNN) 패턴도 처리
        html = html.replace(/\(L(\d+)\)/g, (match, lineNum) => {
            const idxKey = `${refPath.split('/').pop()}|L${lineNum}`;
            const entry = GLOSSARY_INDEX[idxKey];
            if (!entry) return '(L?)';
            return `(<a href="#glossary-${escapeHTML(idxKey)}" data-glossary="${escapeHTML(idxKey)}" class="glossary-link">L${lineNum}</a>)`;
        });
    }

    // 출처 라인의 제N조를 추출하여 참조 링크에 data-ref-search + data-ref-anchor 자동 추가
    // 클릭 시 HTML 뷰어에서 해당 조문을 자동 검색 및 앵커 스크롤 (Deep Linking)
    html = html.split('\n').map(line => {
        if (!line.includes('data-ref-html')) return line;
        if (!line.includes('출처') && !line.includes('참고')) return line;

        // 제N조의M 패턴 추출 (첫 번째 매칭 사용)
        const articleMatch = line.match(/제(\d+)조(?:의(\d+))?/);
        if (!articleMatch) return line;

        const search = `제${articleMatch[1]}조${articleMatch[2] ? '의' + articleMatch[2] : ''}`;

        // 첫 번째 data-ref-html 링크에 data-ref-search + data-ref-anchor 추가
        return line.replace(
            /(data-ref-html="[^"]*")(?!\s*data-ref-search)/,
            `$1 data-ref-search="${escapeHTML(search)}" data-ref-anchor="${escapeHTML(search)}"`
        );
    }).join('\n');

    // --- 본문 중 용어집 키워드 자동 링크 ---
    // 용어집에 등록된 키워드가 본문에 나오면 해당 용어집 앵커로 링크
    if (glossaryKeywords && glossaryKeywords.length > 0) {
        // 키워드 길이 내림차순 정렬 (긴 키워드 먼저 매칭하여 부분 매칭 방지)
        const sorted = [...glossaryKeywords]
            .filter(k => k.keyword && k.keyword.length >= 2)
            .sort((a, b) => b.keyword.length - a.keyword.length);
        if (sorted.length > 0) {
            // HTML 태그와 기존 <a> 링크를 안전한 플레이스홀더로 보호
            const phs = [];
            let processed = html.replace(/<a\s[^>]*>[\s\S]*?<\/a>|<[^>]+>/g, (m) => {
                const i = phs.length;
                phs.push(m);
                return `\uE000P${i}\uE001`;
            });
            // 단일 패스 교대 정규식으로 모든 키워드 동시 매칭
            const pattern = sorted.map(k => k.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            const re = new RegExp(`(${pattern})`, 'g');
            processed = processed.replace(re, (match) => {
                const item = sorted.find(k => k.keyword === match);
                if (!item) return match;
                return `<a href="#glossary-${escapeHTML(item.idxKey)}" data-glossary="${escapeHTML(item.idxKey)}" class="glossary-term-link">${escapeHTML(match)}</a>`;
            });
            // 플레이스홀더 복원
            html = processed.replace(/\uE000P(\d+)\uE001/g, (m, i) => phs[parseInt(i)]);
        }
    }

    return html;
}
