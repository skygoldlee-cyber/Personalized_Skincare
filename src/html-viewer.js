// src/html-viewer.js — 앱 내 HTML 참조자료 뷰어 오버레이 (검색 + 하이라이트)
// html_output의 HTML 변환본을 fetch로 로드하여 DOM에 직접 주입 (iframe 없음)

let _overlayEl = null;
let _contentEl = null;
let _searchResults = [];
let _searchIdx = -1;

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
#html-ref-overlay .hr-ov-scroll{flex:1;overflow:auto;position:relative;background:#fff;}
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
    el.innerHTML = `
        <div class="hr-ov-bar">
            <button class="hr-ov-btn secondary" id="hr-close-btn"><i class="fa-solid fa-xmark"></i> 닫기</button>
            <span class="hr-ov-title" id="hr-title"></span>
            <div class="hr-ov-search">
                <input type="text" id="hr-search-input" placeholder="검색어..." />
                <span class="hr-search-count" id="hr-search-count"></span>
                <button class="hr-ov-btn secondary" id="hr-search-btn"><i class="fa-solid fa-magnifying-glass"></i></button>
                <button class="hr-ov-btn secondary" id="hr-prev-btn" title="이전 (Shift+Enter)"><i class="fa-solid fa-chevron-up"></i></button>
                <button class="hr-ov-btn secondary" id="hr-next-btn" title="다음 (Enter)"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <button class="hr-ov-btn secondary" id="hr-print-btn"><i class="fa-solid fa-print"></i></button>
        </div>
        <div class="hr-ov-scroll" id="hr-scroll">
            <div class="hr-loading" id="hr-loading">
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

async function openHtmlViewer(htmlPath, searchKeyword) {
    const el = _ensureOverlay();
    const titleEl = el.querySelector('#hr-title');
    const scroll = el.querySelector('#hr-scroll');

    const fileName = decodeURIComponent(htmlPath.split('/').pop().replace(/\.html$/, ''));
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
        const htmlUrl = new URL(htmlPath, window.location.href).href;
        const resp = await fetch(htmlUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const htmlText = await resp.text();

        // HTML 파싱하여 body 내용 추출
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // 이미지 경로를 절대 경로로 변환
        const baseUrl = htmlUrl.substring(0, htmlUrl.lastIndexOf('/') + 1);
        doc.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                img.src = new URL(src, baseUrl).href;
            }
        });

        loading.remove();

        // 콘텐츠 컨테이너 생성
        const content = document.createElement('div');
        content.className = 'hr-ov-content';
        content.innerHTML = doc.body.innerHTML;
        scroll.appendChild(content);
        _contentEl = content;

        // 검색어가 있으면 자동 검색
        if (searchKeyword && searchKeyword.length >= 2) {
            await _doSearch(searchKeyword);
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

async function _doSearch(keyword) {
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

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    for (const textNode of textNodes) {
        _highlightInTextNode(textNode, lowerKw, kw);
    }

    countEl.textContent = _searchResults.length > 0 ? `${_searchResults.length}개` : '없음';

    if (_searchResults.length > 0) {
        _searchIdx = 0;
        _scrollToResult(0);
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
