// src/markdown-parser.js - 공통 마크다운 런타임 파서 (브라우저 ESM)
import { escapeHTML } from './sanitize.js';

/* ============================================================
   joinWraps — PDF 고정폭 wrap 연속줄 복원 (ref_md 전용)

   배경: tools/pdf2md.py는 `#L####` 인용 라인번호 보존을 위해
   segment=False(시각적 줄 그대로)로 ref_md를 생성한다. 그 결과 법령
   원문이 ~63자 고정폭에서 단어 중간("…화장품을 말\n한다.")까지 잘린다.
   파서가 줄 단위로 <p>를 만들면 이 절단이 문단 경계로 보이므로,
   joinWraps=true일 때 "이전 평문이 문장부호 없이 끝나고 다음 줄이
   구조 마커로 시작하지 않는" 연속줄을 이전 <p>/<li>에 병합한다.

   경계 공백은 PDF 추출 단계에서 소실되므로 구분자는 휴리스틱으로 추정:
   - 다음 줄이 조사·어미 꼬리로 시작("…에|서", "…말|한다") → 무공백
   - 이전 줄이 조사·어미 음절로 종료("…또는|증진", "…활동을|지원") → 공백
   - 그 외(한글+한글 등) → 단어 중간 절단이 지배적이므로 무공백
   ============================================================ */

// 단위 종결 — 문장부호/종결어미로 끝나면 다음 줄은 새 단위
// (escapeHTML 통과 후이므로 > " ' 는 엔티티 형태로 온다)
const _JW_CLOSED = /(?:[.。:!?\)\]〉》」』】]|다|음|함|요|죠|까|네|세|오|됨|임)(?:["'」』\)\]\}〉》】\s]|&gt;|&quot;|&#39;|<\/[a-zA-Z]+>|&nbsp;)*$/;

// 새 단위 시작 마커 — 법령 계층·항호·괄호·기호
// (헤더/표/인용/리스트/구분선/코드는 블록 파서가 먼저 걸러낸다)
const _JW_STRUCT = /^(?:제\s*\d+\s*(?:조|장|편|절|관|항|호|목)|\d+의\d+|[가-힣][.)]\s|\([가-힣\d]+\)|[①-⑳㉑-㉟]|[IVXivx]+[.)]\s|부칙|별[표지첨]|【|※|◆|[○●▷▶◇■□☞]|〈|「|『|\[|<|&lt;|·)/;

// 이음 시작 — 조사·어미 꼬리로 시작하면 이전 토큰의 연속 (무공백)
// 1군: 단어 초성으로 거의 안 쓰이는 음절 (을/를/은/는/습/니/…)
// 2군: 하·되·있·없·같·않 계열 어미 ("한다/되어/있는/없는/같은/않는")
// 3군: 고아 조사 — 조사+공백 ("의 발전에", "에 관한", "로 정한다")
//      ※ 이/가는 지시어·단어 시작이 흔해 제외 ("이 액", "가열")
const _JW_CONT = /^(?:[을를은는습니런던느았였했람려러둠]|[하되있없같않](?=[는여고기지서던었함이어으다])|[의에로지도만여고며요우으서터게](?=\s)|다(?=[.。,，、!?]|$))/;

// 다음 줄이 지시어/단어 시작("이 액", "가 열"과 달리 독립 어절) → 공백 강제
const _JW_LEADSPACE = /^[이가]\s/;

// 이전 줄 끝이 조사/어미 음절 → 어절 경계로 보고 공백 결합
const _JW_ENDSYL = /[은는을를이가의에로과와도만한된할있없같않힌고게요여]$/;

// 끝 태그/공백을 걷어낸 마지막 문자 (엔티티 1개 복원)
function _jwLastChar(t) {
    const s = t.replace(/(?:<\/[a-zA-Z]+>|<br\s*\/?>|&nbsp;|\s)+$/g, '')
        .replace(/&gt;$/, '>').replace(/&quot;$/, '"')
        .replace(/&#39;$/, "'").replace(/&lt;$/, '<').replace(/&amp;$/, '&');
    return s.charAt(s.length - 1);
}

// 결합 구분자 — 경계 공백 추정 (위 휴리스틱 주석 참조)
function _jwSep(prev, cur) {
    if (_JW_CONT.test(cur)) return '';
    if (_JW_LEADSPACE.test(cur)) return ' ';
    const p = _jwLastChar(prev);
    if (p === '') return ' ';
    if (_JW_ENDSYL.test(p)) return ' ';
    if (/[,，、;；]/.test(p)) return ' ';
    if (/[-–—\/·ㆍ([{〈「『]/.test(p)) return '';
    const n = cur.charAt(0);
    if (/[A-Za-z]/.test(p) || /[A-Za-z]/.test(n)) return ' ';
    if (/\d/.test(n) && /[가-힣]/.test(p)) return ' ';
    // 매우 짧은 prev 줄(<16자)은 고정폭 wrap이 아닌 독립 라벨/필드일 가능성이
    // 높다 (서식의 "전화번호"+"지방식품…" 류) — 기본은 공백이 안전한 실패 모드.
    // 단, cur이 짧은 문장부호 종료 꼬리("한다.", "니다.")면 어형 절단이므로 무공백.
    if (prev.length < 16) {
        const tail = cur.replace(/&gt;$/, '>').replace(/<[^>]+>/g, '').trim();
        if (tail.length <= 8 && /[.。,，、!?)\]〉》」』】>]$/.test(tail)) return '';
        return ' ';
    }
    return '';
}

// output 마지막 요소가 <p>…</p> 또는 …</li></ol|ul>이면 연속줄을 병합한다.
// 연속줄은 <span data-md-line>으로 감싸 L#### 인용이 원줄 위치에 도착하게 한다.
function _jwMerge(output, line, sep, lineNo) {
    const frag = sep + `<span data-md-line="${lineNo}">` + line + '</span>';
    const last = output[output.length - 1];
    if (!last) return false;
    if (last.endsWith('</p>')) {
        output[output.length - 1] = last.slice(0, -4) + frag + '</p>';
        return true;
    }
    const m = last.match(/<\/li>(<\/[ou]l>)$/);
    if (m) {
        output[output.length - 1] = last.slice(0, -m[0].length) + frag + m[0];
        return true;
    }
    return false;
}

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
 * @param {boolean} [options.addLineNumbers=false] - 원문 라인 번호 주석 추가 여부
 * @param {boolean} [options.joinWraps=false] - PDF 고정폭 wrap의 문장 중간 절단 줄을 병합 여부 (ref_md 전용)
 * @returns {string} 변환된 HTML 문자열
 */
export function parseMarkdown(mdText, options = {}) {
    const {
        allowMermaid = false,
        useCustomListDiv = false,
        useReaderStyles = false,
        customSpacing = false,
        allowItalics = true,
        allowInlineCode = true,
        addLineNumbers = false,
        joinWraps = false
    } = options;

    let html = String(mdText);

    // 1. 안전한 인라인 태그/특수 토큰 치환 (이스케이프 전에 처리)
    html = html.replace(/<br\s*\/?>/gi, 'BR_TOKEN');
    html = html.replace(/<sup>/gi, 'SUP_O');
    html = html.replace(/<\/sup>/gi, 'SUP_C');
    html = html.replace(/&nbsp;/gi, 'NBSP_TOKEN');

    // 1-1. $$...$$ 수식 블록을 플레이스홀더로 보호 (HTML 이스케이프 전)
    const _mathBlocks = [];
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (m, formula) => {
        const i = _mathBlocks.length;
        _mathBlocks.push(formula.trim());
        return `MATHBLOCK_TOKEN${i}END_TOKEN`;
    });

    // 2. HTML 이스케이프
    html = escapeHTML(html);

    // 3. 토큰 복원
    html = html.replace(/BR_TOKEN/gi, '<br>');
    html = html.replace(/SUP_O/gi, '<sup>');
    html = html.replace(/SUP_C/gi, '</sup>');
    html = html.replace(/NBSP_TOKEN/gi, '&nbsp;');

    // 3-1. $$...$$ 수식 블록을 HTML 분수로 변환
    html = html.replace(/MATHBLOCK_TOKEN(\d+)END_TOKEN/g, (m, i) => {
        const formula = _mathBlocks[parseInt(i)];
        return convertMathToHtml(formula);
    });

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
    // 마크다운 <url> 문법(angle bracket URL)의 &lt; &gt; 를 제거하여 유효한 href 생성
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, rawUrl) => {
        let url = rawUrl;
        if (/^&lt;.+&gt;$/.test(url)) {
            url = url.replace(/^&lt;/, '').replace(/&gt;$/, '');
        }
        return '<a href="' + url + '">' + text + '</a>';
    });

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
    /** @type {'ul'|'ol'|null} */
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

    let _lastTableLine = 0;
    const flushTable = () => {
        if (tableRows.length === 0) return;
        const dataRows = tableRows.filter(row => {
            const cells = splitTableCells(row);
            // 구분선 행(|---|:--:|)은 데이터에서 제외
            return !(cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c)));
        });
        if (dataRows.length === 0) { tableRows = []; return; }
        const tableLineNo = _lastTableLine - tableRows.length + 1;
        const lineAttr = addLineNumbers ? ` data-md-line="${tableLineNo}"` : '';
        let tableHTML = '<div class="reader-table-wrapper"' + lineAttr + '><table class="reader-table">';
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

    let _quoteStartLine = 0;
    const flushQuote = () => {
        if (quoteLines.length === 0) return;
        const lineAttr = addLineNumbers ? ` data-md-line="${_quoteStartLine}"` : '';
        if (useReaderStyles) {
            output.push(`<div class="md-quote"${lineAttr}>${quoteLines.join('<br>')}</div>`);
        } else {
            output.push(`<blockquote${lineAttr}><p>${quoteLines.join('<br>')}</p></blockquote>`);
        }
        quoteLines = [];
    };

    let _codeStartLine = 0;
    const flushCode = () => {
        if (codeLines.length === 0) { codeLang = ''; return; }
        const lineAttr = addLineNumbers ? ` data-md-line="${_codeStartLine}"` : '';
        if (allowMermaid && codeLang === 'mermaid') {
            output.push(`<pre class="mermaid"${lineAttr}>${codeLines.join('\n')}</pre>`);
        } else if (useReaderStyles) {
            output.push(`<pre class="reader-code-block"${lineAttr}>${codeLines.join('\n')}</pre>`);
        } else {
            output.push(`<pre class="reader-code-block"${lineAttr}><code>${codeLines.join('\n')}</code></pre>`);
        }
        codeLines = [];
        codeLang = '';
    };

    let _listStartLine = 0;
    const flushList = () => {
        if (listItems.length === 0) return;
        const tag = listType === 'ol' ? 'ol' : 'ul';
        const lineAttr = addLineNumbers ? ` data-md-line="${_listStartLine}"` : '';
        output.push(`<${tag}${lineAttr}>${listItems.map(li => `<li>${li}</li>`).join('')}</${tag}>`);
        listItems = [];
        listType = null;
    };

    let _lineNo = 0;
    function _wrapWithLine(html, lineNo) {
        if (!addLineNumbers) return html;
        return html.replace(/^(<\w+)/, `$1 data-md-line="${lineNo}"`);
    }

    // 병합 판정용 직전 평문/리스트 항목 텍스트 (joinWraps 모드에서만 사용)
    let _jwPrev = null;

    // joinWraps 전용: 페이지 러닝헤더 감지 — H1 제목의 '(' 앞부분과 정확히
    // 일치하는 반복 단독줄(예: "화장품법 시행규칙"×35)을 투명하게 건너뛴다.
    // _jwPrev를 리셋하지 않아 페이지 경계로 끊긴 문장 병합이 이어진다.
    // (소스 라인은 유지되므로 L#### 인용 라인번호에 영향 없음)
    let _jwTitle = null, _jwTitleSeen = false;
    if (joinWraps) {
        const h1 = lines.map(l => l.trim()).find(t => /^#\s/.test(t));
        if (h1) {
            const t = h1.replace(/^#\s+/, '').split(/[(<]/)[0].trim();
            if (t.length >= 4 && t.length <= 45) _jwTitle = t;
        }
    }

    lines.forEach(line => {
        _lineNo++;
        const trimmed = line.trim();

        // joinWraps: olMatch(`N.`/`N)`)에 걸리지만 실제로는 연속줄인 패턴 판정
        //  - 날짜 꼬리: "2018. 3. 13.>" (<개정|<신설이 줄넘김된 개정일 나열)
        //  - 화학식 꼬리: "113)", "1000)" (Freon 113, 1→1000 희석배수 절단)
        //  - 연속부호 종료 prev + 3자리 이상 숫자 시작
        //  - 미닫힘 꺾쇠 prev: "…<개정" (&lt;개정)
        const _jwForce = joinWraps && _jwPrev != null
            && /^\d+[.)]\s/.test(trimmed)
            && !_JW_CLOSED.test(_jwPrev)
            && (/^\d{4}\.\s*\d{1,2}\./.test(trimmed)
                || /^\d{3,}\)\s/.test(trimmed)
                || (/^\d{3,}[.)]/.test(trimmed)
                    && /[,，、ㆍ·(〈「『(\-–—→\/=＝]\s*$/.test(_jwPrev))
                || /&lt;[가-힣\s:]*$/.test(_jwPrev));

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
            _jwPrev = null;
            return;
        }
        if (inCodeBlock) {
            if (codeLines.length === 0) _codeStartLine = _lineNo;
            codeLines.push(line);
            _jwPrev = null;
            return;
        }

        // joinWraps: 러닝헤더 스킵 — 문서 제목과 동일한 반복 단독줄.
        // 첫 등장(문서 표제)은 유지하고 이후 반복만 투명하게 건너뛴다.
        if (_jwTitle && trimmed === _jwTitle) {
            if (_jwTitleSeen) return;
            _jwTitleSeen = true;
        }

        // 6-2. 테이블 파싱
        if (trimmed.startsWith('|')) {
            flushQuote(); flushList();
            tableRows.push(line);
            _lastTableLine = _lineNo;
            _jwPrev = null;
            return;
        } else {
            flushTable();
        }

        // 6-3. 인용문 파싱
        const GT_ENTITY = '&' + 'gt;';
        if (trimmed.startsWith(GT_ENTITY) || trimmed.startsWith('>')) {
            flushList();
            if (quoteLines.length === 0) _quoteStartLine = _lineNo;
            let qText = trimmed;
            if (qText.startsWith(GT_ENTITY)) qText = qText.slice(4);
            else qText = qText.slice(1);
            qText = qText.trim();
            if (qText) quoteLines.push(qText);
            _jwPrev = null;
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
                _jwPrev = null;
                return;
            }
        } else {
            const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
            const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
            if (ulMatch) {
                if (listType !== 'ul') { flushList(); listType = 'ul'; _listStartLine = _lineNo; }
                listItems.push(ulMatch[1]);
                _jwPrev = ulMatch[1];
                return;
            } else if (olMatch && !_jwForce) {
                if (listType !== 'ol') { flushList(); listType = 'ol'; _listStartLine = _lineNo; }
                listItems.push(olMatch[1]);
                _jwPrev = olMatch[1];
                return;
            } else {
                flushList();
            }
        }

        // 6-5. 헤더 파싱
        if (useReaderStyles) {
            if (trimmed.startsWith('##### ')) {
                output.push(_wrapWithLine(`<h5 class="md-h5">${line.replace(/^#####\s+/, '')}</h5>`, _lineNo));
                _jwPrev = null;
                return;
            }
            if (trimmed.startsWith('#### ')) {
                output.push(_wrapWithLine(`<h4 class="md-h4">${line.replace(/^####\s+/, '')}</h4>`, _lineNo));
                _jwPrev = null;
                return;
            }
            if (trimmed.startsWith('### ')) {
                output.push(_wrapWithLine(`<h3 class="md-h3">${line.replace(/^###\s+/, '')}</h3>`, _lineNo));
                _jwPrev = null;
                return;
            }
        } else {
            if (trimmed.startsWith('### ')) { output.push(_wrapWithLine(`<h3>${trimmed.slice(4)}</h3>`, _lineNo)); _jwPrev = null; return; }
            if (trimmed.startsWith('## ')) { output.push(_wrapWithLine(`<h2>${trimmed.slice(3)}</h2>`, _lineNo)); _jwPrev = null; return; }
            if (trimmed.startsWith('# ')) { output.push(_wrapWithLine(`<h1>${trimmed.slice(2)}</h1>`, _lineNo)); _jwPrev = null; return; }
        }

        // 6-6. 구분선 파싱
        if (useReaderStyles) {
            if (trimmed === '---') {
                output.push('<hr class="reader-hr">');
                _jwPrev = null;
                return;
            }
        } else {
            if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) { output.push('<hr>'); _jwPrev = null; return; }
        }

        // 6-7. 빈 줄 파싱
        if (trimmed === '') {
            if (customSpacing) {
                output.push('<div style="height: 0.5rem;"></div>');
            }
            _jwPrev = null;
            return;
        }

        // 6-8. 일반 문단 파싱
        // joinWraps: 이전 평문/항목이 미종결 + 현재 줄이 구조 마커가 아니면 병합
        if (joinWraps && _jwPrev != null
            && !_JW_CLOSED.test(_jwPrev)
            && (_jwForce || !_JW_STRUCT.test(trimmed))) {
            if (_jwMerge(output, line, _jwSep(_jwPrev, trimmed), _lineNo)) {
                _jwPrev = line;
                return;
            }
        }
        if (useReaderStyles) {
            output.push(_wrapWithLine(`<p class="md-para">${line}</p>`, _lineNo));
        } else {
            output.push(_wrapWithLine(`<p>${line}</p>`, _lineNo));
        }
        // 이미지 단독 줄은 연속 대상이 아님 (다음 텍스트가 사진 캡션으로 붙는 것 방지)
        _jwPrev = /^<img/.test(trimmed) ? null : line;
    });

    // 최종 블록 플러시
    flushTable();
    flushQuote();
    flushCode();
    flushList();

    return output.join('\n');
}

/**
 * 간단한 LaTeX 수식을 HTML로 변환 (KaTeX 없이 \frac 분수만 지원)
 * @param {string} formula - $$ ... $$ 내부의 LaTeX 수식 문자열
 * @returns {string} HTML 문자열
 */
function convertMathToHtml(formula) {
    // 이미 HTML 이스케이프된 상태이므로 < > 등 복원 불필요
    // \frac{분자}{분모} → HTML 분수 구조로 변환
    let html = formula;
    // \times → × 기호
    html = html.replace(/\\times/g, '&times;');
    // \frac{A}{B} → <span class="math-frac"><span class="math-num">A</span><span class="math-den">B</span></span>
    // 중첩 분수 지원 (최대 3단계)
    for (let depth = 0; depth < 3; depth++) {
        const prev = html;
        html = html.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
            '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
        if (html === prev) break;
    }
    // 남은 역슬래시 제거 (미지원 명령)
    html = html.replace(/\\([a-zA-Z]+)/g, '$1');
    // 남은 $ 기호 제거
    html = html.replace(/\$/g, '');
    // 공백 정리
    html = html.replace(/\\\s/g, ' ').replace(/\s+/g, ' ').trim();
    return `<div class="math-block">${html}</div>`;
}
