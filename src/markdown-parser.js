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
                fenceLines[i] = fenceLines[i]
                    .replace(/\*/g, 'STAR_TOKEN')
                    .replace(/`/g, 'BTICK_TOKEN')
                    .replace(/\[/g, 'SBR_O_TOKEN')
                    .replace(/\]/g, 'SBR_C_TOKEN')
                    .replace(/\(/g, 'PAR_O_TOKEN')
                    .replace(/\)/g, 'PAR_C_TOKEN')
                    .replace(/&lt;/g, 'LT_TOKEN')
                    .replace(/&gt;/g, 'GT_TOKEN')
                    .replace(/&quot;/g, 'QUOT_TOKEN')
                    .replace(/&#39;/g, 'SQUOT_TOKEN')
                    .replace(/<br>/g, 'BR_IN_FENCE');
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

    // 5-1. 마크다운 이미지 ![alt](url) → <img src="url" alt="alt">
    // (링크 파싱 전에 처리하여 ![alt](url)가 [text](url)로 변환되지 않도록 함)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="reader-img" loading="lazy">');

    // 5-2. 마크다운 링크 [text](url) → <a href="url">text</a>
    // (escapeHTML 통과 후이므로 &amp; 등은 이미 인코딩됨 — href에 그대로 사용)
    // (펜스 블록 내부의 []()는 토큰화되어 있으므로 변환되지 않음)
    // URL에 괄호가 포함된 경우(예: 화장품법(법률)(제20901호).pdf)를 처리하기 위해
    // 마지막 ) 까지 greedy 매칭 (URL 인코딩된 %28 %29는 영향 없음)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // 5-2. 펜스 블록 내부 토큰 복원 (링크 파싱 후)
    // []() 리터럴 복원 + HTML 엔티티를 엔티티 형태로 복원
    // (&lt; &gt; &quot; 그대로 유지 → 브라우저 textContent에서 < > " 로 디코딩됨)
    // 이렇게 하면 < 가 HTML 태그 시작으로 해석되는 것을 방지
    html = html.replace(/SBR_O_TOKEN/g, '[').replace(/SBR_C_TOKEN/g, ']')
               .replace(/PAR_O_TOKEN/g, '(').replace(/PAR_C_TOKEN/g, ')')
               .replace(/LT_TOKEN/g, '&lt;').replace(/GT_TOKEN/g, '&gt;')
               .replace(/QUOT_TOKEN/g, '&quot;').replace(/SQUOT_TOKEN/g, '&#39;')
               .replace(/BR_IN_FENCE/g, '&lt;br/&gt;');

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
        // thead: 첫 행을 헤더로 처리
        const headerCells = splitTableCells(dataRows[0]);
        tableHTML += '<thead><tr>' + headerCells.map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
        // tbody: 나머지 행을 본문으로 처리
        tableHTML += '<tbody>';
        for (let idx = 1; idx < dataRows.length; idx++) {
            const cells = splitTableCells(dataRows[idx]);
            // 첫 번째 셀에 내용이 있으면 group-start 클래스 부여 (대분류 변경 지점)
            const isGroupStart = cells[0] && cells[0].trim() !== '';
            const rowClass = isGroupStart ? ' class="group-start"' : '';
            tableHTML += `<tr${rowClass}>`;
            tableHTML += cells.map(c => {
                const isEmpty = c.trim() === '';
                // — 기호를 span으로 감싸서 스타일링 가능하게 함
                const styled = c.replace(/—/g, '<span class="md-dash">—</span>');
                const cellClass = isEmpty ? ' class="cell-empty"' : '';
                return `<td${cellClass}>${styled}</td>`;
            }).join('');
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody>';
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
                output.push(`<h4 class="md-h4">${line.replace(/^####\s+/, '')}</h4>`);
                return;
            }
            if (trimmed.startsWith('### ')) {
                output.push(`<h3 class="md-h3">${line.replace(/^###\s+/, '')}</h3>`);
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
