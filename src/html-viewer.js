// src/html-viewer.js — 앱 내 HTML 참조자료 뷰어 오버레이 (검색 + 하이라이트)
// html_output의 HTML/MD 변환본을 fetch로 로드하여 DOM에 직접 주입 (iframe 없음)
import { parseMarkdown } from './markdown-parser.js';

let _overlayEl = null;
let _contentEl = null;
let _searchResults = [];
let _searchIdx = -1;
const _FETCH_CACHE_PREFIX = 'ref_doc_v1_';
const _FETCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

function _injectStyles() {
    if (document.getElementById('html-viewer-styles')) return;
    const style = document.createElement('style');
    style.id = 'html-viewer-styles';
    style.textContent = `
#html-ref-overlay{position:fixed;inset:0;z-index:10000;display:none;
  background:var(--bg-overlay,rgba(0,0,0,.85));backdrop-filter:blur(4px);}
#html-ref-overlay.open{display:flex;flex-direction:column;}
#html-ref-overlay .hr-ov-bar{display:flex;align-items:center;gap:.6rem;
  padding:.6rem 1rem;background:var(--bg-card,#161b22);
  border-bottom:1px solid var(--border-color,#30363d);flex-shrink:0;}
#html-ref-overlay .hr-ov-title{flex:1;font-size:1rem;font-weight:600;
  color:var(--color-text,#e6edf3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#html-ref-overlay .hr-ov-btn{background:var(--color-primary,#1f6feb);color:#fff;border:none;
  border-radius:8px;padding:.4rem .8rem;cursor:pointer;font-size:.85rem;flex-shrink:0;}
#html-ref-overlay .hr-ov-btn:hover{opacity:.85;}
#html-ref-overlay .hr-ov-btn.secondary{background:var(--bg-btn-secondary,#21262d);
  color:var(--color-text,#e6edf3);border:1px solid var(--border-color,#30363d);}
#html-ref-overlay .hr-ov-search{display:flex;align-items:center;gap:.4rem;flex-shrink:0;}
#html-ref-overlay .hr-ov-search input{width:180px;padding:.3rem .5rem;border-radius:6px;
  border:1px solid var(--border-color,#30363d);background:var(--bg-input,#0d1117);
  color:var(--color-text,#e6edf3);font-size:.85rem;}
#html-ref-overlay .hr-ov-search .hr-search-count{font-size:.78rem;color:var(--color-text-muted,#8b949e);
  min-width:60px;}
#html-ref-overlay .hr-ov-scroll{flex:1;overflow:auto;position:relative;background:#fff;min-height:0;}
#html-ref-overlay .hr-ov-content{padding:24px;color:#1a1a1a;font-family:'Malgun Gothic','Noto Sans KR',sans-serif;line-height:1.6;}
#html-ref-overlay .hr-ov-content h1.doc-title{border-bottom:2px solid #333;padding-bottom:8px;font-size:20px;}
#html-ref-overlay .hr-ov-content .page{border:1px solid #ddd;margin:18px 0;padding:16px;background:#fff;page-break-after:always;}
#html-ref-overlay .hr-ov-content .page-header{color:#888;font-size:12px;margin-bottom:8px;border-bottom:1px dashed #ccc;padding-bottom:4px;}
#html-ref-overlay .hr-ov-content .text-layer{position:relative;}
#html-ref-overlay .hr-ov-content .text-layer p{position:absolute;margin:0;white-space:pre-wrap;}
#html-ref-overlay .hr-ov-content table.pdf-table{border-collapse:collapse;margin:10px 0;font-size:13px;width:auto;}
#html-ref-overlay .hr-ov-content table.pdf-table th,
#html-ref-overlay .hr-ov-content table.pdf-table td{border:1px solid #999;padding:4px 8px;vertical-align:top;}
#html-ref-overlay .hr-ov-content table.pdf-table tr:nth-child(even){background:#f7f7f7;}
#html-ref-overlay .hr-ov-content .images{margin-top:10px;}
#html-ref-overlay .hr-ov-content .images img{max-width:100%;border:1px solid #eee;margin:4px 0;display:block;}
#html-ref-overlay .hr-ov-content .section-label{font-weight:bold;color:#0a5;font-size:12px;margin-top:10px;}
#html-ref-overlay .hr-ov-content .empty{color:#aaa;font-style:italic;font-size:12px;}
/* MD 변환 콘텐츠 스타일 (parseMarkdown 출력) */
#html-ref-overlay .hr-ov-content h1{border-bottom:2px solid #333;padding-bottom:8px;font-size:20px;margin:1em 0 .5em;}
#html-ref-overlay .hr-ov-content h2{font-size:17px;margin:1.2em 0 .4em;border-bottom:1px solid #ddd;padding-bottom:4px;}
#html-ref-overlay .hr-ov-content h3{font-size:15px;margin:1em 0 .3em;}
#html-ref-overlay .hr-ov-content p{margin:.4em 0;}
#html-ref-overlay .hr-ov-content ul,#html-ref-overlay .hr-ov-content ol{margin:.4em 0;padding-left:1.8em;}
#html-ref-overlay .hr-ov-content li{margin:.2em 0;}
#html-ref-overlay .hr-ov-content .reader-table-wrapper{overflow-x:auto;margin:10px 0;}
#html-ref-overlay .hr-ov-content table.reader-table{border-collapse:collapse;margin:10px 0;font-size:13px;width:auto;}
#html-ref-overlay .hr-ov-content table.reader-table th,
#html-ref-overlay .hr-ov-content table.reader-table td{border:1px solid #999;padding:4px 8px;vertical-align:top;}
#html-ref-overlay .hr-ov-content table.reader-table tr:nth-child(even){background:#f7f7f7;}
#html-ref-overlay .hr-ov-content pre.reader-code-block{background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto;font-size:13px;margin:10px 0;}
#html-ref-overlay .hr-ov-content blockquote{border-left:3px solid #ccc;margin:10px 0;padding:6px 14px;color:#555;}
#html-ref-overlay .hr-ov-content img{max-width:100%;border:1px solid #eee;margin:4px 0;display:block;}
#html-ref-overlay .hr-ov-content hr{border:none;border-top:1px solid #ddd;margin:20px 0;}
#html-ref-overlay .hr-loading{display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:60vh;gap:18px;color:var(--color-text-muted,#8b949e);}
#html-ref-overlay .hr-loading .spinner{width:44px;height:44px;border:4px solid var(--border-color,#30363d);
  border-top-color:var(--color-primary,#1f6feb);border-radius:50%;animation:hr-spin 1s linear infinite;}
@keyframes hr-spin{to{transform:rotate(360deg);}}
#html-ref-overlay mark.hr-highlight{background:rgba(250,204,21,.4);border-radius:2px;
  padding:1px 2px;animation:hr-hl-pulse 2s ease;}
#html-ref-overlay mark.hr-highlight.current{background:rgba(250,204,21,.7);outline:2px solid rgba(250,204,21,.9);}
@keyframes hr-hl-pulse{0%,100%{background:rgba(250,204,21,.4);}50%{background:rgba(250,204,21,.6);}}
`;
    document.head.appendChild(style);
}

function _ensureOverlay() {
    _injectStyles();
    if (_overlayEl) return _overlayEl;
    const el = document.createElement('div');
    el.id = 'html-ref-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '참조자료 뷰어');
    el.innerHTML = `
        <div class="hr-ov-bar">
            <button class="hr-ov-btn secondary" id="hr-close-btn" aria-label="닫기"><i class="fa-solid fa-xmark"></i> 닫기</button>
            <span class="hr-ov-title" id="hr-title" role="heading" aria-level="1"></span>
            <div class="hr-ov-search">
                <input type="text" id="hr-search-input" placeholder="검색어..." aria-label="검색어 입력" />
                <span class="hr-search-count" id="hr-search-count" aria-live="polite"></span>
                <button class="hr-ov-btn secondary" id="hr-search-btn" aria-label="검색"><i class="fa-solid fa-magnifying-glass"></i></button>
                <button class="hr-ov-btn secondary" id="hr-prev-btn" title="이전 (Shift+Enter)" aria-label="이전 검색 결과"><i class="fa-solid fa-chevron-up"></i></button>
                <button class="hr-ov-btn secondary" id="hr-next-btn" title="다음 (Enter)" aria-label="다음 검색 결과"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <button class="hr-ov-btn secondary" id="hr-print-btn" aria-label="인쇄"><i class="fa-solid fa-print"></i></button>
        </div>
        <div class="hr-ov-scroll" id="hr-scroll" role="document" tabindex="0">
            <div class="hr-loading" id="hr-loading" role="status" aria-live="polite">
                <div class="spinner"></div>
                <div>문서 로딩 중...</div>
            </div>
        </div>
    `;
    document.body.appendChild(el);
    _overlayEl = el;

    el.querySelector('#hr-close-btn').addEventListener('click', close);
    el.querySelector('#hr-print-btn').addEventListener('click', () => {
        const content = el.querySelector('.hr-ov-content');
        if (!content) return;
        const printWin = window.open('', '_blank');
        if (printWin) {
            const styles = document.getElementById('html-viewer-styles');
            printWin.document.write('<html><head><title>인쇄</title>');
            if (styles) printWin.document.write('<style>' + styles.textContent + '</style>');
            printWin.document.write('<style>#html-ref-overlay{position:static!important;display:block!important;background:#fff!important;}#html-ref-overlay .hr-ov-scroll{overflow:visible!important;}</style>');
            printWin.document.write('</head><body><div id="html-ref-overlay" class="open"><div class="hr-ov-scroll">' + content.outerHTML + '</div></div></body></html>');
            printWin.document.close();
            printWin.print();
        }
    });
    el.querySelector('#hr-search-btn').addEventListener('click', () => _doSearch());
    el.querySelector('#hr-prev-btn').addEventListener('click', () => _navigateSearch(-1));
    el.querySelector('#hr-next-btn').addEventListener('click', () => _navigateSearch(1));
    el.querySelector('#hr-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) _navigateSearch(-1);
            else if (_searchResults.length > 0) _navigateSearch(1);
            else _doSearch();
        }
    });

    el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });

    return el;
}

function _open() {
    const el = _ensureOverlay();
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function close() {
    if (_overlayEl) {
        _overlayEl.classList.remove('open');
        document.body.style.overflow = '';
    }
    _searchResults = [];
    _searchIdx = -1;
    _contentEl = null;
}

async function openHtmlViewer(htmlPath, searchKeyword, anchorId, lineNum) {
    const el = _ensureOverlay();
    const titleEl = el.querySelector('#hr-title');
    const scroll = el.querySelector('#hr-scroll');

    const fileName = decodeURIComponent(htmlPath.split('/').pop().replace(/\.(html|md)$/, ''));
    titleEl.textContent = fileName;

    // 기존 콘텐츠 제거
    const oldContent = scroll.querySelector('.hr-ov-content');
    if (oldContent) oldContent.remove();

    // 로딩 표시
    let loading = el.querySelector('#hr-loading');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'hr-loading';
        loading.className = 'hr-loading';
        loading.innerHTML = '<div class="spinner"></div><div>문서 로딩 중...</div>';
    }
    loading.style.display = 'flex';
    scroll.innerHTML = '';
    scroll.appendChild(loading);
    scroll.scrollTop = 0;

    _searchResults = [];
    _searchIdx = -1;
    el.querySelector('#hr-search-input').value = searchKeyword || '';
    el.querySelector('#hr-search-count').textContent = '';

    _open();

    try {
        const fileUrl = new URL(htmlPath, window.location.href).href;
        const isMarkdown = htmlPath.endsWith('.md');
        const baseUrl = fileUrl.substring(0, fileUrl.lastIndexOf('/') + 1);

        // sessionStorage 캐싱: 재방문 시 fetch 0회로 즉시 렌더링
        const cacheKey = _FETCH_CACHE_PREFIX + fileUrl;
        let innerHTML = null;
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.ts < _FETCH_CACHE_TTL) {
                    innerHTML = parsed.html;
                }
            }
        } catch {}

        if (innerHTML === null) {
            const resp = await fetch(fileUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const rawText = await resp.text();

            if (isMarkdown) {
                innerHTML = parseMarkdown(rawText, { allowInlineCode: false });
            } else {
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawText, 'text/html');
                doc.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                        img.src = new URL(src, baseUrl).href;
                    }
                });
                innerHTML = doc.body.innerHTML;
            }

            // 캐시 저장 (실패 시 무시)
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), html: innerHTML }));
            } catch {}
        }

        loading.remove();

        // 콘텐츠 컨테이너 생성
        const content = document.createElement('div');
        content.className = 'hr-ov-content';
        content.innerHTML = innerHTML;
        scroll.appendChild(content);
        _contentEl = content;

        // PDF→HTML 변환시 폰트별 <span> 분할 제거 (한글 키워드 검색을 위해)
        // 예: <span>알</span><span>코올</span> → 알코올 (단일 텍스트 노드)
        // 최적화: span 목록을 먼저 수집한 후 일괄 처리, normalize는 부모별 1회만 호출
        if (!isMarkdown) {
            const spans = content.querySelectorAll('span');
            const parentsToNormalize = new Set();
            for (const span of spans) {
                const parent = span.parentNode;
                while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                }
                parent.removeChild(span);
                parentsToNormalize.add(parent);
            }
            for (const p of parentsToNormalize) {
                p.normalize();
            }
        }

        // MD의 경우 이미지 경로를 절대 경로로 변환
        if (isMarkdown) {
            content.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                    img.src = new URL(src, baseUrl).href;
                }
            });
        }

        // 검색어 결정: searchKeyword(셀 텍스트에서 추출)를 우선 사용
        // L### 번호는 스크롤 위치 힌트로만 사용 (검색어 덮어쓰지 않음)
        let effectiveSearch = searchKeyword;
        if (effectiveSearch && effectiveSearch.length >= 2) {
            await _doSearch(effectiveSearch, true);
            // 검색 결과가 없고 키워드에 공백이 있으면 첫 단어로 재검색
            if (_searchResults.length === 0 && effectiveSearch.includes(' ')) {
                const firstWord = effectiveSearch.split(' ')[0];
                if (firstWord.length >= 2) {
                    await _doSearch(firstWord, true);
                }
            }
        }

        // 스크롤 타겟 찾기
        // 우선순위: 첫 번째 검색 결과(하이라이트된 키워드) > 앵커 ID > heading 텍스트
        // L###은 원본 HTML <p> 인덱스이나 parseMarkdown <p>와 불일치하므로 스크롤에 사용하지 않음
        if (anchorId || lineNum || effectiveSearch) {
            let target = null;

            // 1. 검색 결과가 있으면: 첫 번째 하이라이트로 스크롤
            if (_searchResults.length > 0) {
                target = _searchResults[0];
            }

            // 2. lineNum이 없고 anchorId가 있으면 ID로 직접 찾기 (출처 라인 제N조용)
            if (!target && !lineNum && anchorId) {
                target = content.querySelector(`#${CSS.escape(anchorId)}`);
            }

            // 3. heading 텍스트에 앵커 문자열이 포함된 요소 찾기
            if (!target && !lineNum && anchorId) {
                const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6, .section-label, .page-header');
                for (const h of headings) {
                    if (h.textContent.includes(anchorId)) {
                        target = h;
                        break;
                    }
                }
            }

            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                target.style.transition = 'background 0.5s ease';
                const origBg = target.style.background;
                target.style.background = 'rgba(250,204,21,0.25)';
                setTimeout(() => { target.style.background = origBg; }, 1500);
            }
        }
    } catch (err) {
        console.error('HTML viewer load failed:', err);
        loading.innerHTML = `<div style="color:var(--color-danger,#f85149);">문서 로딩 실패: ${err && err.message ? err.message : String(err)}</div>`;
        loading.style.display = 'flex';
    }
}

function _clearHighlights(container) {
    if (!container) return;
    const marks = container.querySelectorAll('mark.hr-highlight');
    marks.forEach(m => {
        const parent = m.parentNode;
        parent.replaceChild(document.createTextNode(m.textContent), m);
        parent.normalize();
    });
}

function _highlightInTextNode(textNode, lowerKw, kw) {
    let current = textNode;
    while (current && current.nodeType === Node.TEXT_NODE) {
        const lt = current.textContent.toLowerCase();
        const pos = lt.indexOf(lowerKw);
        if (pos < 0) break;
        const range = document.createRange();
        range.setStart(current, pos);
        range.setEnd(current, pos + kw.length);
        const mark = document.createElement('mark');
        mark.className = 'hr-highlight';
        range.surroundContents(mark);
        _searchResults.push(mark);
        current = mark.nextSibling;
    }
}

async function _doSearch(keyword, skipScroll) {
    const input = _overlayEl.querySelector('#hr-search-input');
    const kw = keyword || input.value.trim();
    if (!kw || kw.length < 2) return;
    if (!_contentEl) return;

    input.value = kw;
    const countEl = _overlayEl.querySelector('#hr-search-count');
    countEl.textContent = '검색 중...';

    _clearHighlights(_contentEl);
    _searchResults = [];

    const lowerKw = kw.toLowerCase();
    const walker = document.createTreeWalker(_contentEl, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            const tag = node.parentNode.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    // 1단계: 첫 매치를 빠르게 찾아 스크롤 (나머지는 idle에서 처리)
    let firstMatch = null;
    let remainingNodes = [];
    let node;
    while (node = walker.nextNode()) {
        if (firstMatch === null) {
            _highlightInTextNode(node, lowerKw, kw);
            if (_searchResults.length > 0) {
                firstMatch = _searchResults[0];
            }
        } else {
            remainingNodes.push(node);
        }
    }

    // 2단계: 나머지 하이라이트는 requestIdleCallback으로 지연 처리
    if (remainingNodes.length > 0) {
        const highlightRest = (startIdx) => {
            const endIdx = Math.min(startIdx + 50, remainingNodes.length);
            for (let i = startIdx; i < endIdx; i++) {
                _highlightInTextNode(remainingNodes[i], lowerKw, kw);
            }
            countEl.textContent = _searchResults.length > 0 ? `${_searchResults.length}개` : '없음';
            if (endIdx < remainingNodes.length) {
                (window.requestIdleCallback || window.setTimeout)(() => highlightRest(endIdx));
            }
        };
        (window.requestIdleCallback || window.setTimeout)(() => highlightRest(0));
    }

    countEl.textContent = _searchResults.length > 0 ? `${_searchResults.length}개` : '없음';

    if (_searchResults.length > 0) {
        _searchIdx = 0;
        if (!skipScroll) _scrollToResult(0);
    }
}

function _scrollToResult(idx) {
    if (!_searchResults[idx]) return;
    _searchResults.forEach(m => m.classList.remove('current'));
    _searchResults[idx].classList.add('current');
    _searchResults[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function _navigateSearch(dir) {
    if (_searchResults.length === 0) return;
    _searchIdx = (_searchIdx + dir + _searchResults.length) % _searchResults.length;
    _scrollToResult(_searchIdx);
    const countEl = _overlayEl.querySelector('#hr-search-count');
    countEl.textContent = `${_searchIdx + 1}/${_searchResults.length}`;
}

// Public API
window.HtmlViewer = {
    openHtmlViewer,
    close
};

export { openHtmlViewer, close };
