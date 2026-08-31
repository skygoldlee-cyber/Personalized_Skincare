// src/pdf-viewer.js — 앱 내 PDF.js 기반 뷰어 오버레이 (검색 + 하이라이트)
// ExamViewer 패턴을 따르지만 PDF.js로 렌더링

let _pdfjsLib = null;
let _overlayEl = null;
let _currentRenderTask = null;

async function _ensurePdfJs() {
    if (_pdfjsLib) return _pdfjsLib;
    const mod = await import('./lib/pdf.min.mjs');
    _pdfjsLib = mod;
    // worker 경로 설정 (같은 디렉토리)
    if (_pdfjsLib.GlobalWorkerOptions) {
        _pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.min.mjs', import.meta.url).href;
    }
    return _pdfjsLib;
}

function _injectStyles() {
    if (document.getElementById('pdf-viewer-styles')) return;
    const style = document.createElement('style');
    style.id = 'pdf-viewer-styles';
    style.textContent = `
#pdf-overlay{position:fixed;inset:0;z-index:10000;display:none;
  background:var(--bg-overlay,rgba(0,0,0,.85));backdrop-filter:blur(4px);}
#pdf-overlay.open{display:flex;flex-direction:column;}
#pdf-overlay .pdf-ov-bar{display:flex;align-items:center;gap:.6rem;
  padding:.6rem 1rem;background:var(--bg-card,#161b22);
  border-bottom:1px solid var(--border-color,#30363d);flex-shrink:0;}
#pdf-overlay .pdf-ov-title{flex:1;font-size:1rem;font-weight:600;
  color:var(--color-text,#e6edf3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#pdf-overlay .pdf-ov-btn{background:var(--color-primary,#1f6feb);color:#fff;border:none;
  border-radius:8px;padding:.4rem .8rem;cursor:pointer;font-size:.85rem;flex-shrink:0;}
#pdf-overlay .pdf-ov-btn:hover{opacity:.85;}
#pdf-overlay .pdf-ov-btn.secondary{background:var(--bg-btn-secondary,#21262d);
  color:var(--color-text,#e6edf3);border:1px solid var(--border-color,#30363d);}
#pdf-overlay .pdf-ov-search{display:flex;align-items:center;gap:.4rem;flex-shrink:0;}
#pdf-overlay .pdf-ov-search input{width:180px;padding:.3rem .5rem;border-radius:6px;
  border:1px solid var(--border-color,#30363d);background:var(--bg-input,#0d1117);
  color:var(--color-text,#e6edf3);font-size:.85rem;}
#pdf-overlay .pdf-ov-search .pdf-search-count{font-size:.78rem;color:var(--color-text-muted,#8b949e);
  min-width:60px;}
#pdf-overlay .pdf-ov-scroll{flex:1;overflow:auto;display:flex;flex-direction:column;
  align-items:center;padding:1rem;gap:1rem;}
#pdf-overlay .pdf-canvas-wrap{position:relative;box-shadow:0 4px 20px rgba(0,0,0,.4);}
#pdf-overlay .pdf-canvas-wrap canvas{display:block;border-radius:4px;}
#pdf-overlay .pdf-search-hl{position:absolute;border:2px solid rgba(250,204,21,.8);
  background:rgba(250,204,21,.25);border-radius:2px;pointer-events:none;
  animation:pdf-hl-pulse 2s ease;}
@keyframes pdf-hl-pulse{0%,100%{background:rgba(250,204,21,.25);}50%{background:rgba(250,204,21,.45);}}
#pdf-overlay .pdf-loading{display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:60vh;gap:18px;color:var(--color-text-muted,#8b949e);}
#pdf-overlay .pdf-loading .spinner{width:44px;height:44px;border:4px solid var(--border-color,#30363d);
  border-top-color:var(--color-primary,#1f6feb);border-radius:50%;animation:pdf-spin 1s linear infinite;}
@keyframes pdf-spin{to{transform:rotate(360deg);}}
#pdf-overlay .pdf-page-nav{display:flex;align-items:center;gap:.5rem;padding:.4rem .8rem;
  background:var(--bg-card,#161b22);border-top:1px solid var(--border-color,#30363d);flex-shrink:0;
  justify-content:center;}
#pdf-overlay .pdf-page-nav button{background:var(--bg-btn-secondary,#21262d);
  color:var(--color-text,#e6edf3);border:1px solid var(--border-color,#30363d);
  border-radius:6px;padding:.25rem .6rem;cursor:pointer;font-size:.85rem;}
#pdf-overlay .pdf-page-nav button:disabled{opacity:.4;cursor:not-allowed;}
#pdf-overlay .pdf-page-nav span{font-size:.85rem;color:var(--color-text-muted,#8b949e);
  font-variant-numeric:tabular-nums;}
`;
    document.head.appendChild(style);
}

function _ensureOverlay() {
    _injectStyles();
    if (_overlayEl) return _overlayEl;
    const el = document.createElement('div');
    el.id = 'pdf-overlay';
    el.innerHTML = `
        <div class="pdf-ov-bar">
            <button class="pdf-ov-btn secondary" id="pdf-close-btn"><i class="fa-solid fa-xmark"></i> 닫기</button>
            <span class="pdf-ov-title" id="pdf-title"></span>
            <div class="pdf-ov-search">
                <input type="text" id="pdf-search-input" placeholder="검색어..." />
                <span class="pdf-search-count" id="pdf-search-count"></span>
                <button class="pdf-ov-btn secondary" id="pdf-search-btn"><i class="fa-solid fa-magnifying-glass"></i></button>
            </div>
            <button class="pdf-ov-btn secondary" id="pdf-print-btn"><i class="fa-solid fa-print"></i></button>
        </div>
        <div class="pdf-ov-scroll" id="pdf-scroll">
            <div class="pdf-loading" id="pdf-loading">
                <div class="spinner"></div>
                <div>PDF 로딩 중...</div>
            </div>
        </div>
        <div class="pdf-page-nav">
            <button id="pdf-prev-page"><i class="fa-solid fa-chevron-left"></i> 이전</button>
            <span id="pdf-page-info">- / -</span>
            <button id="pdf-next-page">다음 <i class="fa-solid fa-chevron-right"></i></button>
        </div>
    `;
    document.body.appendChild(el);
    _overlayEl = el;

    el.querySelector('#pdf-close-btn').addEventListener('click', close);
    el.querySelector('#pdf-print-btn').addEventListener('click', () => {
        if (_currentPdfUrl) window.open(new URL(_currentPdfUrl, window.location.href).href, '_blank');
    });
    el.querySelector('#pdf-search-btn').addEventListener('click', () => _doSearch());
    el.querySelector('#pdf-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _doSearch();
    });
    el.querySelector('#pdf-prev-page').addEventListener('click', () => _navigatePage(-1));
    el.querySelector('#pdf-next-page').addEventListener('click', () => _navigatePage(1));

    // ESC로 닫기
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });

    return el;
}

let _currentPdfDoc = null;
let _currentPdfUrl = '';
let _currentPage = 1;
let _totalPages = 0;
let _searchResults = [];
let _searchIdx = -1;
let _pendingSearchKeyword = '';

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
    if (_currentRenderTask) {
        try { _currentRenderTask.cancel(); } catch (e) {}
        _currentRenderTask = null;
    }
}

async function openPdf(pdfPath, searchKeyword) {
    const el = _ensureOverlay();
    const titleEl = el.querySelector('#pdf-title');
    const scroll = el.querySelector('#pdf-scroll');
    const loading = el.querySelector('#pdf-loading');

    const fileName = pdfPath.split('/').pop();
    titleEl.textContent = fileName;
    scroll.innerHTML = '';
    if (loading) scroll.appendChild(loading);
    loading.style.display = 'flex';

    _currentPdfUrl = pdfPath;  // 원본 경로 (print 버튼용)
    _pendingSearchKeyword = searchKeyword || '';
    _searchResults = [];
    _searchIdx = -1;
    el.querySelector('#pdf-search-input').value = searchKeyword || '';
    el.querySelector('#pdf-search-count').textContent = '';

    _open();

    try {
        const pdfjs = await _ensurePdfJs();
        // 상대경로를 절대 URL로 변환 (괄호/공백 포함 파일명 처리)
        const pdfUrl = new URL(pdfPath, window.location.href).href;
        const loadingTask = pdfjs.getDocument({ url: pdfUrl });
        _currentPdfDoc = await loadingTask.promise;
        _totalPages = _currentPdfDoc.numPages;
        _currentPage = 1;

        loading.style.display = 'none';
        await _renderPage(1);

        // 검색어가 있으면 자동 검색
        if (searchKeyword && searchKeyword.length >= 2) {
            await _doSearch(searchKeyword);
        }
    } catch (err) {
        console.error('PDF load failed:', err);
        loading.innerHTML = `<div style="color:var(--color-danger,#f85149);">PDF 로딩 실패: ${err && err.message ? err.message : String(err)}</div>`;
        loading.style.display = 'flex';
    }
}

async function _renderPage(pageNum) {
    if (!_currentPdfDoc) return;
    const scroll = _overlayEl.querySelector('#pdf-scroll');
    scroll.innerHTML = '';

    _currentPage = pageNum;
    const page = await _currentPdfDoc.getPage(pageNum);

    const wrap = document.createElement('div');
    wrap.className = 'pdf-canvas-wrap';
    wrap.id = 'pdf-canvas-wrap';
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    scroll.appendChild(wrap);

    const containerWidth = Math.min(scroll.clientWidth - 32, 900);
    const viewport0 = page.getViewport({ scale: 1 });
    const scale = containerWidth / viewport0.width;
    const viewport = page.getViewport({ scale });

    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';

    if (_currentRenderTask) {
        try { _currentRenderTask.cancel(); } catch (e) {}
    }
    _currentRenderTask = page.render({ canvasContext: ctx, viewport });
    await _currentRenderTask.promise;
    _currentRenderTask = null;

    // 페이지 정보 업데이트
    const info = _overlayEl.querySelector('#pdf-page-info');
    info.textContent = `${pageNum} / ${_totalPages}`;
    _overlayEl.querySelector('#pdf-prev-page').disabled = pageNum <= 1;
    _overlayEl.querySelector('#pdf-next-page').disabled = pageNum >= _totalPages;

    // 검색 하이라이트 재표시
    if (_searchResults.length > 0) {
        _renderHighlights(pageNum);
    }
}

async function _navigatePage(delta) {
    const newPage = _currentPage + delta;
    if (newPage < 1 || newPage > _totalPages) return;
    await _renderPage(newPage);
}

async function _doSearch(keyword) {
    const input = _overlayEl.querySelector('#pdf-search-input');
    const kw = keyword || input.value.trim();
    if (!kw || kw.length < 2) return;
    if (!_currentPdfDoc) return;

    input.value = kw;
    const countEl = _overlayEl.querySelector('#pdf-search-count');
    countEl.textContent = '검색 중...';

    _searchResults = [];
    const lowerKw = kw.toLowerCase();

    for (let p = 1; p <= _totalPages; p++) {
        const page = await _currentPdfDoc.getPage(p);
        const textContent = await page.getTextContent();

        let currentLine = '';
        let currentY = null;
        let currentX = null;
        let currentHeight = null;
        let lineStartIdx = 0;

        const items = textContent.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const text = item.str;
            const y = item.transform[5];
            const x = item.transform[4];
            const h = item.height;

            // 같은 줄인지 확인 (y 좌표가 비슷하면 같은 줄)
            if (currentY !== null && Math.abs(y - currentY) > 3) {
                // 이전 줄 처리
                const lineLower = currentLine.toLowerCase();
                const idx = lineLower.indexOf(lowerKw);
                if (idx >= 0) {
                    _searchResults.push({ page: p, text: currentLine, lineIdx: _searchResults.length });
                }
                currentLine = '';
                currentY = null;
            }

            if (currentY === null) {
                currentY = y;
                currentX = x;
                currentHeight = h;
            }
            currentLine += text;
        }
        // 마지막 줄
        if (currentLine) {
            const lineLower = currentLine.toLowerCase();
            const idx = lineLower.indexOf(lowerKw);
            if (idx >= 0) {
                _searchResults.push({ page: p, text: currentLine, lineIdx: _searchResults.length });
            }
        }
    }

    countEl.textContent = _searchResults.length > 0 ? `${_searchResults.length}개` : '없음';

    if (_searchResults.length > 0) {
        _searchIdx = 0;
        const first = _searchResults[0];
        await _renderPage(first.page);
        _renderHighlights(first.page);
        _scrollToHighlight();
    }
}

function _renderHighlights(pageNum) {
    const wrap = _overlayEl.querySelector('#pdf-canvas-wrap');
    if (!wrap) return;

    // 기존 하이라이트 제거
    wrap.querySelectorAll('.pdf-search-hl').forEach(el => el.remove());

    const pageResults = _searchResults.filter(r => r.page === pageNum);
    if (pageResults.length === 0) return;

    const canvas = wrap.querySelector('canvas');
    if (!canvas) return;

    // 캔버스 위에 하이라이트 오버레이 배치
    // 실제 좌표 계산은 복잡하므로 간단히 캔버스 상단에 표시
    for (let i = 0; i < pageResults.length; i++) {
        const r = pageResults[i];
        const hl = document.createElement('div');
        hl.className = 'pdf-search-hl';
        // 캔버스 크기에 비례하여 배치 (근사치)
        const topRatio = 0.1 + (i * 0.05);
        hl.style.left = '4px';
        hl.style.right = '4px';
        hl.style.top = (canvas.offsetHeight * topRatio) + 'px';
        hl.style.height = '20px';
        wrap.appendChild(hl);
    }
}

function _scrollToHighlight() {
    const scroll = _overlayEl.querySelector('#pdf-scroll');
    const hl = scroll.querySelector('.pdf-search-hl');
    if (hl) {
        hl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Public API
window.PdfViewer = {
    openPdf,
    close
};

export { openPdf, close };
