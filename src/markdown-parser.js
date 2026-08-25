// src/markdown-parser.js - 공통 마크다운 런타임 파서 (브라우저 ESM)
import { escapeHTML } from './sanitize.js';

/**
 * 마크다운 텍스트를 HTML로 변환하는 공통 함수.
 * @param {string} mdText - 변환할 마크다운 원문
 * @param {object} options - 파싱 옵션
 * @param {boolean} [options.allowMermaid=false] - Mermaid 코드블록 처리 활성화 여부
 * @param {boolean} [options.useCustomListDiv=false] - <ul>/<li> 대신 <div class="md-list-item"> 목록 렌더링 여부
 * @param {boolean} [options.useReaderStyles=false] - 교재 리더용 특화 태그/클래스 적용 여부
 * @param {boolean} [options.customSpacing=false] - 빈 줄 발생 시 <div style="height: 0.5rem;"></div> 추가 여부
 * @param {boolean} [options.allowItalics=true] - 이탤릭체(*) 지원 여부
 * @param {boolean} [options.allowInlineCode=true] - 인라인 코드(`) 지원 여부
 * @returns {string} 변환된 HTML 문자열
 */
export function parseMarkdown(mdText, options = {}) {
    const {
        allowMermaid = false,
        useCustomListDiv = false,
        useReaderStyles = false,
        customSpacing = false,
        allowItalics = true,
        allowInlineCode = true
    } = options;

    let html = String(mdText);

    // 1. 안전한 인라인 태그/특수 토큰 치환 (이스케이프 전에 처리)
    html = html.replace(/<br\s*\/?>/gi, 'BR_TOKEN');
    html = html.replace(/<sup>/gi, 'SUP_O');
    html = html.replace(/<\/sup>/gi, 'SUP_C');
    html = html.replace(/&nbsp;/gi, 'NBSP_TOKEN');

    // 2. HTML 이스케이프
    html = escapeHTML(html);

    // 3. 토큰 복원
    html = html.replace(/BR_TOKEN/gi, '<br>');
    html = html.replace(/SUP_O/gi, '<sup>');
    html = html.replace(/SUP_C/gi, '</sup>');
    html = html.replace(/NBSP_TOKEN/gi, '&nbsp;');

    // 4. 펜스 라인 토큰 치환 (```언어)
    html = html.replace(/^```(\w*).*$/gm, (m, lang) => 'FENCE_TOKEN' + (lang || ''));

    // 4-1. 펜스 코드/머메이드 블록 "내부" 라인의 인라인 트리거 문자(* `)를 임시 보호.
    //      (인라인 서식(5)이 문서 전체에 적용되므로, 보호하지 않으면 코드블록 안의
    //       `백틱`이나 **별표**가 <code>/<strong>으로 변형되어 원문이 깨진다.)
    //      복원은 인라인 서식 직후(블록 파싱 전)에 수행한다. lookbehind 미사용(구형 웹뷰 호환).
    {
        const fenceLines = html.split(/\r?\n/);
        let inFence = false;
        for (let i = 0; i < fenceLines.length; i++) {
            if (/^FENCE_TOKEN/.test(fenceLines[i].trim())) { inFence = !inFence; continue; }
            if (inFence) {
                fenceLines[i] = fenceLines[i].replace(/\*/g, 'STAR_TOKEN').replace(/`/g, 'BTICK_TOKEN');
            }
        }
        html = fenceLines.join('\n');
    }

    // 5. 인라인 서식
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    if (allowItalics) {
        html = html.replace(/\*([^\s*][^*\n]*?)\*/g, '<em>$1</em>');
    }
    if (allowInlineCode) {
        html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    }

    // 복원 (펜스 마커 + 코드블록 내부 보호 토큰)
    html = html.replace(/FENCE_TOKEN(\w*)/g, '```$1');
    html = html.replace(/STAR_TOKEN/g, '*').replace(/BTICK_TOKEN/g, '`');

    // 6. 줄 단위 블록 파싱
    const lines = html.split(/\r?\n/);
    const output = [];

    let tableRows = [];
    let quoteLines = [];
    let codeLines = [];
    let inCodeBlock = false;
    let codeLang = '';
    let listItems = [];
    let listType = null;

    // 마크다운 표 셀 분리: 양끝 파이프 1개씩만 제거하고 내부 빈 셀은 보존한다.
    // (기존 .filter(c => c !== '')는 빈 셀까지 제거해 열이 밀리는 버그가 있었음)
    // 이스케이프된 파이프(\|)는 임시 토큰으로 보호 후 리터럴로 복원한다.
    const splitTableCells = (row) => {
        let s = row.trim();
        if (s.startsWith('|')) s = s.slice(1);
        if (s.endsWith('|')) s = s.slice(0, -1);
        return s
            .replace(/\\\|/g, 'PIPE_ESC_TOKEN')
            .split('|')
            .map(c => c.trim().replace(/PIPE_ESC_TOKEN/g, '|'));
    };

    const flushTable = () => {
        if (tableRows.length === 0) return;
        const dataRows = tableRows.filter(row => {
            const cells = splitTableCells(row);
            // 구분선 행(|---|:--:|)은 데이터에서 제외
            return !(cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c)));
        });
        if (dataRows.length === 0) { tableRows = []; return; }
        let tableHTML = '<div class="reader-table-wrapper"><table class="reader-table">';
        dataRows.forEach((row, idx) => {
            const cells = splitTableCells(row);
            const tag = idx === 0 ? 'th' : 'td';
            tableHTML += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
        });
        tableHTML += '</table></div>';
        output.push(tableHTML);
        tableRows = [];
    };

    const flushQuote = () => {
        if (quoteLines.length === 0) return;
        if (useReaderStyles) {
            output.push(`<div class="md-quote">${quoteLines.join('<br>')}</div>`);
        } else {
            output.push(`<blockquote><p>${quoteLines.join('<br>')}</p></blockquote>`);
        }
        quoteLines = [];
    };

    const flushCode = () => {
        if (codeLines.length === 0) { codeLang = ''; return; }
        if (allowMermaid && codeLang === 'mermaid') {
            output.push(`<pre class="mermaid">${codeLines.join('\n')}</pre>`);
        } else if (useReaderStyles) {
            output.push(`<pre class="reader-code-block">${codeLines.join('\n')}</pre>`);
        } else {
            output.push(`<pre class="reader-code-block"><code>${codeLines.join('\n')}</code></pre>`);
        }
        codeLines = [];
        codeLang = '';
    };

    const flushList = () => {
        if (listItems.length === 0) return;
        const tag = listType === 'ol' ? 'ol' : 'ul';
        output.push(`<${tag}>${listItems.map(li => `<li>${li}</li>`).join('')}</${tag}>`);
        listItems = [];
        listType = null;
    };

    lines.forEach(line => {
        const trimmed = line.trim();

        // 6-1. 코드블록 시작/끝 감지
        if (trimmed.startsWith('```')) {
            if (inCodeBlock) {
                flushCode();
                inCodeBlock = false;
            } else {
                flushTable(); flushQuote(); flushList();
                inCodeBlock = true;
                codeLang = trimmed.slice(3).trim().toLowerCase();
            }
            return;
        }
        if (inCodeBlock) {
            codeLines.push(line);
            return;
        }

        // 6-2. 테이블 파싱
        if (trimmed.startsWith('|')) {
            flushQuote(); flushList();
            tableRows.push(line);
            return;
        } else {
            flushTable();
        }

        // 6-3. 인용문 파싱
        const GT_ENTITY = '&' + 'gt;';
        if (trimmed.startsWith(GT_ENTITY) || trimmed.startsWith('>')) {
            flushList();
            let qText = trimmed;
            if (qText.startsWith(GT_ENTITY)) qText = qText.slice(4);
            else qText = qText.slice(1);
            qText = qText.trim();
            if (qText) quoteLines.push(qText);
            return;
        } else {
            flushQuote();
        }

        // 6-4. 목록 파싱 (ul / ol)
        if (useCustomListDiv) {
            const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
            if (listMatch) {
                const indentLevel = Math.floor(listMatch[1].length / 2);
                output.push(`<div class="md-list-item" style="padding-left: ${0.5 + indentLevel * 1.25}rem;"><span class="md-bullet">•</span> <span>${listMatch[2]}</span></div>`);
                return;
            }
        } else {
            const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
            const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
            if (ulMatch) {
                if (listType !== 'ul') { flushList(); listType = 'ul'; }
                listItems.push(ulMatch[1]);
                return;
            } else if (olMatch) {
                if (listType !== 'ol') { flushList(); listType = 'ol'; }
                listItems.push(olMatch[1]);
                return;
            } else {
                flushList();
            }
        }

        // 6-5. 헤더 파싱
        if (useReaderStyles) {
            if (trimmed.startsWith('#### ')) {
                output.push(`<h6 class="md-h4">${line.replace(/^####\s+/, '')}</h6>`);
                return;
            }
            if (trimmed.startsWith('### ')) {
                output.push(`<h5 class="md-h3">${line.replace(/^###\s+/, '')}</h5>`);
                return;
            }
        } else {
            if (trimmed.startsWith('### ')) { output.push(`<h3>${trimmed.slice(4)}</h3>`); return; }
            if (trimmed.startsWith('## ')) { output.push(`<h2>${trimmed.slice(3)}</h2>`); return; }
            if (trimmed.startsWith('# ')) { output.push(`<h1>${trimmed.slice(2)}</h1>`); return; }
        }

        // 6-6. 구분선 파싱
        if (useReaderStyles) {
            if (trimmed === '---') {
                output.push('<hr class="reader-hr">');
                return;
            }
        } else {
            if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) { output.push('<hr>'); return; }
        }

        // 6-7. 빈 줄 파싱
        if (trimmed === '') {
            if (customSpacing) {
                output.push('<div style="height: 0.5rem;"></div>');
            }
            return;
        }

        // 6-8. 일반 문단 파싱
        if (useReaderStyles) {
            output.push(`<p class="md-para">${line}</p>`);
        } else {
            output.push(`<p>${line}</p>`);
        }
    });

    // 최종 블록 플러시
    flushTable();
    flushQuote();
    flushCode();
    flushList();

    return output.join('\n');
}
