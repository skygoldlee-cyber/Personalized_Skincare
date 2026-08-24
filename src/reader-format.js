// src/reader-format.js - 교재 리더 본문 포맷터 (순수 함수, ESM)
import { escapeHTML } from './sanitize.js';

export function formatSectionContentForReader(rawContent) {
    // 1. 안전한 인라인 태그를 플레이스홀더 토큰으로 치환 (이스케이프 전에 처리)
    //    이렇게 하면 escapeHTML이 태그를 엔티티로 변환하는 것을 방지할 수 있음
    let html = String(rawContent);
    html = html.replace(/<br\s*\/?>/gi, 'BR_TOKEN');
    html = html.replace(/<sup>/gi, 'SUP_O');
    html = html.replace(/<\/sup>/gi, 'SUP_C');
    html = html.replace(/&nbsp;/gi, 'NBSP_TOKEN');

    // 2. HTML 이스케이프 (나머지 위험 문자만 엔티티로 변환)
    html = escapeHTML(html);

    // 3. 토큰을 실제 안전한 태그로 복원
    html = html.replace(/BR_TOKEN/gi, '<br>');
    html = html.replace(/SUP_O/gi, '<sup>');
    html = html.replace(/SUP_C/gi, '</sup>');
    html = html.replace(/NBSP_TOKEN/gi, '&nbsp;');
    
    // 3. 마크다운 볼드 처리
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 4. 줄 단위 처리 (마크다운 테이블을 실제 HTML 테이블로 변환)
    const lines = html.split(/\r?\n/);
    const output = [];
    let tableRows = [];
    let quoteLines = [];
    let codeLines = [];
    let inCodeBlock = false;
    
    const flushTable = () => {
        if (tableRows.length === 0) return;
        
        // 구분 행(|---|)을 제외한 데이터 행만 추출
        const dataRows = tableRows.filter(row => {
            const cells = row.split('|').map(c => c.trim()).filter(c => c !== '');
            return !cells.every(c => /^:?-+:?$/.test(c));
        });
        
        if (dataRows.length === 0) {
            tableRows = [];
            return;
        }
        
        let tableHTML = '<div class="reader-table-wrapper"><table class="reader-table">';
        dataRows.forEach((row, idx) => {
            const cells = row.split('|').map(c => c.trim()).filter(c => c !== '');
            const tag = idx === 0 ? 'th' : 'td';
            tableHTML += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
        });
        tableHTML += '</table></div>';
        output.push(tableHTML);
        tableRows = [];
    };
    
    const flushQuote = () => {
        if (quoteLines.length === 0) return;
        output.push(`<div class="md-quote">${quoteLines.join('<br>')}</div>`);
        quoteLines = [];
    };
    
    const flushCode = () => {
        if (codeLines.length === 0) return;
        output.push(`<pre class="reader-code-block">${codeLines.join('\n')}</pre>`);
        codeLines = [];
    };
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // 코드블록(```) 처리 - 테이블/인용구 처리보다 우선
        if (trimmed.startsWith('```')) {
            if (inCodeBlock) {
                flushCode();
                inCodeBlock = false;
            } else {
                flushTable();
                flushQuote();
                inCodeBlock = true;
            }
            return;
        }
        if (inCodeBlock) {
            codeLines.push(line);
            return;
        }
        
        // 테이블 행 (| 로 시작)
        if (trimmed.startsWith('|')) {
            flushQuote();
            tableRows.push(line);
            return;
        } else {
            flushTable();
        }
        
        // 인용구 (> 로 시작)
        if (trimmed.startsWith('>')) {
            quoteLines.push(line.replace(/^>\s*/, ''));
            return;
        } else {
            flushQuote();
        }
        
        // 빈 줄
        if (trimmed === '') {
            output.push('<div style="height: 0.5rem;"></div>');
            return;
        }
        
        // 헤더 (#### 를 ### 보다 먼저 체크)
        if (trimmed.startsWith('#### ')) {
            output.push(`<h6 class="md-h4">${line.replace(/^####\s+/, '')}</h6>`);
            return;
        }
        if (trimmed.startsWith('### ')) {
            output.push(`<h5 class="md-h3">${line.replace(/^###\s+/, '')}</h5>`);
            return;
        }
        
        // 구분선
        if (trimmed === '---') {
            output.push('<hr class="reader-hr">');
            return;
        }
        
        // 리스트 항목 (들여쓰기 레벨 반영)
        const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
        if (listMatch) {
            const indentLevel = Math.floor(listMatch[1].length / 2);
            output.push(`<div class="md-list-item" style="padding-left: ${0.5 + indentLevel * 1.25}rem;"><span class="md-bullet">•</span> <span>${listMatch[2]}</span></div>`);
            return;
        }
        
        // 번호 리스트 (①② 등 유지, 일반 문단으로)
        // 일반 문단
        output.push(`<p class="md-para">${line}</p>`);
    });
    
    // 남은 블록 플러시
    flushTable();
    flushQuote();
    flushCode();
    
    return output.join('');
}
