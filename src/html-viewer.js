// src/html-viewer.js — 앱 내 HTML 참조자료 뷰어 오버레이 (검색 + 하이라이트)
// PDF.js 기반 pdf-viewer.js를 대체: html_output의 HTML을 iframe으로 표시
// 동일 출처(same-origin)이므로 iframe.contentDocument에 직접 접근하여 검색·하이라이트

let _overlayEl = null;
let _currentIframe = null;
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
#html-ref-overlay .hr-ov-scroll{flex:1;overflow:hidden;position:relative;}
#html-ref-overlay .hr-ov-iframe{width:100%;height:100%;border:none;background:#fff;}
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
        if (_currentIframe && _currentIframe.contentWindow) {
            _currentIframe.contentWindow.print();
        }
    });
    el.querySelector('#hr-search-btn').addEventListener('click', () => _doSearch());
    el.querySelector('#hr-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _doSearch();
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
}

async function openHtmlViewer(htmlPath, searchKeyword) {
    const el = _ensureOverlay();
    const titleEl = el.querySelector('#hr-title');
    const scroll = el.querySelector('#hr-scroll');

    const fileName = decodeURIComponent(htmlPath.split('/').pop().replace(/\.html$/, ''));
    titleEl.textContent = fileName;

    // 기존 iframe 제거
    const oldIframe = scroll.querySelector('.hr-ov-iframe');
    if (oldIframe) oldIframe.remove();

    // 로딩 표시
    let loading = el.querySelector('#hr-loading');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'hr-loading';
        loading.className = 'hr-loading';
        loading.innerHTML = '<div class="spinner"></div><div>문서 로딩 중...</div>';
    }
    loading.style.display = 'flex';
    scroll.appendChild(loading);

    _searchResults = [];
    _searchIdx = -1;
    el.querySelector('#hr-search-input').value = searchKeyword || '';
    el.querySelector('#hr-search-count').textContent = '';

    _open();

    try {
        const htmlUrl = new URL(htmlPath, window.location.href).href;

        const iframe = document.createElement('iframe');
        iframe.className = 'hr-ov-iframe';
        iframe.style.display = 'none';
        scroll.appendChild(iframe);
        _currentIframe = iframe;

        await new Promise((resolve, reject) => {
            iframe.onload = resolve;
            iframe.onerror = reject;
            iframe.src = htmlUrl;
            setTimeout(() => reject(new Error('로딩 시간 초과')), 30000);
        });

        loading.style.display = 'none';
        iframe.style.display = 'block';

        // iframe 문서에 테마 적용 (배경색만)
        try {
            const doc = iframe.contentDocument;
            if (doc) {
                const bgStyle = doc.createElement('style');
                bgStyle.textContent = `body{background:#fff !important; color:#1a1a1a !important;}`;
                doc.head.appendChild(bgStyle);
            }
        } catch (e) {
            // cross-origin 제한 시 무시
        }

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

function _clearHighlights(doc) {
    if (!doc) return;
    const marks = doc.querySelectorAll('mark.hr-highlight');
    marks.forEach(m => {
        const parent = m.parentNode;
        parent.replaceChild(doc.createTextNode(m.textContent), m);
        parent.normalize();
    });
}

async function _doSearch(keyword) {
    const input = _overlayEl.querySelector('#hr-search-input');
    const kw = keyword || input.value.trim();
    if (!kw || kw.length < 2) return;
    if (!_currentIframe || !_currentIframe.contentDocument) return;

    input.value = kw;
    const countEl = _overlayEl.querySelector('#hr-search-count');
    countEl.textContent = '검색 중...';

    const doc = _currentIframe.contentDocument;
    _clearHighlights(doc);
    _searchResults = [];

    // DOM 텍스트 노드 순회하며 검색어 하이라이트
    const lowerKw = kw.toLowerCase();
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
            // 스크립트/스타일 태그 내부 제외
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
        const text = textNode.textContent;
        const lowerText = text.toLowerCase();
        let idx = 0;
        let pos = lowerText.indexOf(lowerKw, idx);
        while (pos >= 0) {
            const range = doc.createRange();
            range.setStart(textNode, pos);
            range.setEnd(textNode, pos + kw.length);
            const mark = doc.createElement('mark');
            mark.className = 'hr-highlight';
            range.surroundContents(mark);
            _searchResults.push(mark);
            // surroundContents 후 텍스트 노드가 분할되므로 다음 검색은 mark 이후부터
            const nextNode = mark.nextSibling;
            if (!nextNode || nextNode.nodeType !== Node.TEXT_NODE) break;
            idx = 0;
            pos = nextNode.textContent.toLowerCase().indexOf(lowerKw, idx);
            break; // 다음 텍스트 노드로 이동
        }
    }

    countEl.textContent = _searchResults.length > 0 ? `${_searchResults.length}개` : '없음';

    if (_searchResults.length > 0) {
        _searchIdx = 0;
        _scrollToResult(0);
    }
}

function _scrollToResult(idx) {
    if (!_searchResults[idx]) return;
    // 이전 current 해제
    _searchResults.forEach(m => m.classList.remove('current'));
    _searchResults[idx].classList.add('current');
    _searchResults[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Public API
window.HtmlViewer = {
    openHtmlViewer,
    close
};

export { openHtmlViewer, close };
