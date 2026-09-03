// src/manual-viewer.js - 사용자 매뉴얼 런타임 MD→HTML 변환 뷰어
// 외부 의존성: escapeHTML (src/sanitize.js — index.html에서 가장 먼저 로드됨)
//
// [설계] 예상문제집 뷰어(src/exam-viewer.js)와 동일한 패턴을 사용하여
//   docs/user_manual.md 를 런타임에 fetch → MD→HTML 변환 → 전체화면 오버레이로 표시합니다.
//   - 별도 HTML 파일 생성이 불필요하여 user_manual.md 업데이트 시 자동 동기화
//   - file:// 프로토콜에서는 fetch가 차단되므로 번들 방식 폰트 폴로백
//   - 전역 테마(--bg-app, --color-text-main 등)를 자동으로 따라감

import { escapeHTML } from './sanitize.js';
import { detectMermaidType, getMermaidClassName, getMermaidInitOptions } from './mermaid-utils.js';
import { parseMarkdown } from './markdown-parser.js';

export const ManualViewer = (() => {
    // 지원하는 마크다운 소스 정의
    const MD_SOURCES = {
        'user_manual': { path: 'docs/user/user_manual.md', title: '사용자 매뉴얼' },
        'study_summary': { path: 'content/학습안내서.md', title: '학습 안내서' }
    };
    const CACHE_PREFIX = 'manual_md_cache_v3_';
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간
    let _currentTitle = '';
    let _currentBodyHtml = '';

    /* =========================================================
       캐시 (sessionStorage, TTL 24h) — 본문 HTML만 저장
       ========================================================= */
    function _cacheKey(sourceKey) {
        const src = MD_SOURCES[sourceKey];
        if (!src) return null;
        return CACHE_PREFIX + src.path.replace(/[^a-zA-Z0-9]/g, '_');
    }

    function _getCached(sourceKey) {
        const key = _cacheKey(sourceKey);
        if (!key) return null;
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (Date.now() - entry.timestamp > CACHE_TTL) {
                sessionStorage.removeItem(key);
                return null;
            }
            return entry.html;
        } catch (e) {
            return null;
        }
    }

    function _setCached(sourceKey, html) {
        const key = _cacheKey(sourceKey);
        if (!key) return;
        try {
            sessionStorage.setItem(key, JSON.stringify({
                timestamp: Date.now(),
                html: html
            }));
        } catch (e) {
            // QuotaExceededError 등은 무시 (다음에 재변환)
        }
    }

    /* =========================================================
       마크다운 → HTML 변환 (exam-viewer.js와 동일한 로직)
       ========================================================= */
    function _mdToHtml(mdText) {
        return parseMarkdown(mdText, { allowMermaid: true });
    }

    /* =========================================================
       앱 남부 전체화면 오버레이 (팝업/새창 미사용)
       ========================================================= */
    let _overlayEl = null;
    let _historyPushed = false;
    let _openTimestamp = 0;

    function _injectStylesOnce() {
        if (document.getElementById('manual-overlay-style')) return;
        const style = document.createElement('style');
        style.id = 'manual-overlay-style';
        // 앱의 실제 테마 토큰(--bg-app / --bg-card / --color-text-main / --color-text-muted)을
        // 사용해 글로벌 다크/라이트 테마를 자동으로 따라갑니다.
        style.textContent = `
#manual-overlay{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;
  background:var(--bg-app);color:var(--color-text-main);}
#manual-overlay.open{display:flex;}
#manual-overlay .manual-ov-bar{display:flex;align-items:center;gap:12px;flex:0 0 auto;
  padding:10px 16px;border-bottom:1px solid var(--border-color);
  background:var(--bg-card);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
#manual-overlay .manual-ov-title{flex:1 1 auto;min-width:0;font-weight:700;font-size:.98rem;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#manual-overlay .manual-ov-btn{flex:0 0 auto;cursor:pointer;border:1px solid var(--border-color);
  background:var(--bg-card);color:inherit;border-radius:10px;padding:8px 14px;font-size:.9rem;
  display:inline-flex;align-items:center;gap:6px;font-family:inherit;
  transition:all .15s ease;}
#manual-overlay .manual-ov-btn:hover{border-color:var(--border-color-active);color:var(--color-primary);}
#manual-overlay .manual-ov-btn.primary{background:linear-gradient(135deg,var(--color-primary),#0891b2);
  border-color:transparent;color:#fff;}
#manual-overlay .manual-ov-btn.primary:hover{color:#fff;filter:brightness(1.1);
  box-shadow:var(--glow-primary);}
#manual-overlay .manual-ov-btn:active{transform:translateY(1px);}
#manual-overlay .manual-ov-scroll{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:20px clamp(16px,4vw,48px) 80px;}
#manual-overlay #manual-article{max-width:900px;margin:0 auto;line-height:1.8;
  font-size:1rem;color:inherit;}
/* ---- 변환된 마크다운 본문 타이포그래피 (다크/라이트 모두 대응) ---- */
#manual-overlay #manual-article h1{font-size:1.8rem;font-weight:800;margin:0 0 1rem;
  padding-bottom:.6rem;border-bottom:2px solid var(--color-primary);
  background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
#manual-overlay #manual-article h2{font-size:1.35rem;font-weight:700;margin:2rem 0 1rem;
  padding-left:.7rem;border-left:4px solid var(--color-primary);
  display:flex;align-items:center;gap:.5rem;}
#manual-overlay #manual-article h3{font-size:1.15rem;font-weight:600;margin:1.6rem 0 .8rem;
  color:var(--color-primary);}
#manual-overlay #manual-article p{margin:0 0 1rem;}
#manual-overlay #manual-article strong{color:var(--color-text-main);font-weight:700;}
#manual-overlay #manual-article em{font-style:italic;}
#manual-overlay #manual-article code{font-family:ui-monospace,Consolas,monospace;font-size:.9em;
  background:rgba(127,127,127,.18);border-radius:4px;padding:.1em .35em;
  color:var(--color-secondary);}
#manual-overlay #manual-article blockquote{margin:1rem 0;padding:.8rem 1rem;
  border-left:4px solid var(--color-secondary);
  background:rgba(139,92,246,.08);border-radius:0 8px 8px 0;}
#manual-overlay #manual-article blockquote p{margin:0;}
#manual-overlay #manual-article ul,#manual-overlay #manual-article ol{margin:0 0 1.25rem;padding-left:1.5rem;}
#manual-overlay #manual-article li{margin:.35rem 0;}
#manual-overlay #manual-article hr{border:none;border-top:1px solid var(--border-color);
  margin:2rem 0;}
#manual-overlay #manual-article sup{color:var(--color-warning);}
#manual-overlay #manual-article .reader-table-wrapper{margin:1.25rem 0;overflow-x:auto;}
#manual-overlay #manual-article .reader-table{width:100%;border-collapse:collapse;
  border:1px solid var(--border-color);border-radius:8px;overflow:hidden;}
#manual-overlay #manual-article .reader-table th,
#manual-overlay #manual-article .reader-table td{padding:.75rem 1rem;text-align:left;
  border-bottom:1px solid var(--border-color);}
#manual-overlay #manual-article .reader-table th{
  background:rgba(6,182,212,.12);color:var(--color-primary);font-weight:700;
  border-bottom:2px solid var(--color-primary);}
#manual-overlay #manual-article .reader-table tr:last-child td{border-bottom:none;}
#manual-overlay #manual-article .reader-table tr:hover td{background:rgba(255,255,255,.02);}
html.light-theme #manual-overlay #manual-article .reader-table tr:hover td{background:rgba(0,0,0,.02);}
#manual-overlay #manual-article pre.reader-code-block{margin:1.25rem 0;padding:1.25rem;overflow-x:auto;
  border-radius:8px;background:rgba(0,0,0,.3);border:1px solid var(--border-color);
  font-family:'Outfit',ui-monospace,Consolas,monospace;font-size:.9rem;line-height:1.5;}
html.light-theme #manual-overlay #manual-article pre.reader-code-block{
  background:rgba(0,0,0,.06);color:#334155;}
#manual-overlay #manual-article pre.reader-code-block code{background:none;padding:0;color:inherit;}
#manual-overlay .manual-ov-toc{max-width:900px;margin:0 auto 20px;}
#manual-overlay .manual-ov-toc summary{cursor:pointer;font-weight:600;padding:10px 0;
  display:flex;align-items:center;gap:.5rem;color:var(--color-text-main);}
#manual-overlay .manual-ov-toc a{display:block;padding:5px 0;color:var(--color-primary);
  text-decoration:none;font-size:.92rem;}
#manual-overlay .manual-ov-toc a:hover{text-decoration:underline;}
#manual-overlay .manual-ov-toc a.depth-3{padding-left:18px;font-size:.88rem;opacity:.85;}
#manual-overlay .manual-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:60vh;gap:18px;color:var(--color-text-muted);}
#manual-overlay .manual-loading .spinner{width:44px;height:44px;border:4px solid var(--border-color);
  border-top-color:var(--color-primary);border-radius:50%;animation:manual-spin 1s linear infinite;}
@keyframes manual-spin{to{transform:rotate(360deg);}}
body.manual-open{overflow:hidden;}
@media print{
  body.manual-open>*:not(#manual-overlay){display:none !important;}
  #manual-overlay{position:static !important;display:block !important;}
  #manual-overlay .manual-ov-bar,#manual-overlay .manual-ov-toc{display:none !important;}
  #manual-overlay .manual-ov-scroll{overflow:visible !important;padding:0 !important;}
}`;
        document.head.appendChild(style);
    }

    function _ensureOverlay() {
        if (_overlayEl) return _overlayEl;
        _injectStylesOnce();
        const el = document.createElement('div');
        el.id = 'manual-overlay';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.innerHTML = `
            <div class="manual-ov-bar">
                <button type="button" class="manual-ov-btn" data-manual-close>
                    <i class="fa-solid fa-arrow-left"></i> 닫기
                </button>
                <div class="manual-ov-title" id="manual-ov-title">사용자 매뉴얼</div>
                <button type="button" class="manual-ov-btn primary" data-manual-print>
                    <i class="fa-solid fa-print"></i> 인쇄 / PDF
                </button>
            </div>
            <div class="manual-ov-scroll">
                <article id="manual-article" class="study-section"></article>
            </div>`;
        document.body.appendChild(el);

        el.querySelector('[data-manual-close]').addEventListener('click', close);
        el.querySelector('[data-manual-print]').addEventListener('click', () => window.print());
        _overlayEl = el;
        return el;
    }

    function _buildToc(article) {
        const headings = article.querySelectorAll('h2, h3');
        if (headings.length === 0) return '';
        let items = '';
        headings.forEach((h, idx) => {
            if (!h.id) h.id = 'manual-h-' + idx;
            const depth = h.tagName === 'H3' ? 'depth-3' : 'depth-2';
            const label = h.textContent.replace(/🔖기출|📌중요/g, '').trim();
            items += `<a href="#${h.id}" class="${depth}" data-manual-jump="${h.id}">${escapeHTML(label)}</a>`;
        });
        return `<details class="manual-ov-toc"><summary><i class="fa-solid fa-list"></i> 목차</summary>${items}</details>`;
    }

    // mermaid(3.3MB)는 index.html 에서 즉시 로드하지 않고, 매뉴얼에 실제 다이어그램이
    // 있을 때만 여기서 온디맨드로 1회 주입한다. 중복 주입/경쟁은 모듈 스코프 Promise 로 방지.
    let _mermaidLoadPromise = null;
    function _ensureMermaid() {
        if (window.mermaid) return Promise.resolve(window.mermaid);
        if (_mermaidLoadPromise) return _mermaidLoadPromise;
        _mermaidLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './vendor/mermaid/mermaid.min.js';
            script.async = true;
            const nonce = crypto.getRandomValues(new Uint8Array(16));
            script.nonce = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
            script.onload = () => {
                if (window.mermaid) resolve(window.mermaid);
                else reject(new Error('mermaid loaded but window.mermaid is undefined'));
            };
            script.onerror = (e) => { _mermaidLoadPromise = null; reject(e); };
            document.head.appendChild(script);
        });
        return _mermaidLoadPromise;
    }

    function _renderMermaid() {
        // 다이어그램이 없으면 mermaid 를 아예 로드하지 않는다(대다수 세션).
        const nodes = document.querySelectorAll('#manual-article pre.mermaid');
        if (nodes.length === 0) return;

        _ensureMermaid()
            .then((mermaid) => {
                try {
                    const isLight = document.documentElement.classList.contains('light-theme');
                    const nodeArr = Array.from(nodes);
                    const nodeTypes = [];
                    nodeArr.forEach(node => {
                        const type = detectMermaidType(node.textContent);
                        nodeTypes.push(type);
                        node.classList.add(getMermaidClassName(type));
                    });
                    const renderNext = (i) => {
                        if (i >= nodeArr.length) return;
                        const node = nodeArr[i];
                        const type = nodeTypes[i];
                        mermaid.initialize(getMermaidInitOptions(type, isLight));
                        mermaid.run({ nodes: [node] })
                            .then(() => renderNext(i + 1))
                            .catch((e) => {
                                console.warn(`[manual] mermaid node ${i} failed:`, e?.message || e);
                                nodeArr[i].innerHTML = '<span style="color:var(--color-text-muted);font-size:0.8rem;">[다이어그램 렌더링 실패]</span>';
                                renderNext(i + 1);
                            });
                    };
                    renderNext(0);
                } catch (e) {
                    console.warn('[manual] mermaid render failed:', e);
                }
            })
            .catch((e) => console.warn('[manual] mermaid load failed:', e));
    }

    function _renderBody(title, bodyHtml) {
        _currentTitle = title;
        _currentBodyHtml = bodyHtml;
        const el = _ensureOverlay();
        el.querySelector('#manual-ov-title').textContent = title;
        const article = el.querySelector('#manual-article');
        article.innerHTML = bodyHtml;

        // 목차를 본문 앞에 삽입 (오버레이 스크롤 컨테이너 안쪽 상단)
        const scroll = el.querySelector('.manual-ov-scroll');
        const oldToc = scroll.querySelector('.manual-ov-toc');
        if (oldToc) oldToc.remove();
        const tocHtml = _buildToc(article);
        if (tocHtml) {
            const wrap = document.createElement('div');
            wrap.innerHTML = tocHtml;
            const toc = wrap.firstElementChild;
            scroll.insertBefore(toc, article);
            toc.addEventListener('click', (e) => {
                const a = e.target.closest('[data-manual-jump]');
                if (!a) return;
                e.preventDefault();
                const target = document.getElementById(a.getAttribute('data-manual-jump'));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        scroll.scrollTop = 0;

        // Mermaid 렌더링 실행
        _renderMermaid();
    }

    function _showLoading(title) {
        const el = _ensureOverlay();
        el.querySelector('#manual-ov-title').textContent = title || '문서';
        const scroll = el.querySelector('.manual-ov-scroll');
        const oldToc = scroll.querySelector('.manual-ov-toc');
        if (oldToc) oldToc.remove();
        el.querySelector('#manual-article').innerHTML =
            '<div class="manual-loading"><div class="spinner"></div><p>문서를 불러오는 중...</p></div>';
        _open();
    }

    function _showError(title, message) {
        const el = _ensureOverlay();
        el.querySelector('#manual-ov-title').textContent = title;
        el.querySelector('#manual-article').innerHTML =
            `<div class="study-section"><h2>매뉴얼을 불러올 수 없습니다</h2>
             <p>${escapeHTML(message)}</p>
             <p><button type="button" class="manual-ov-btn" data-manual-close>홈으로 돌아가기</button></p></div>`;
        el.querySelector('#manual-article [data-manual-close]').addEventListener('click', close);
        _open();
    }

    function _onKeydown(e) { if (e.key === 'Escape') close(); }
    function _onPopstate() {
        if (!isOpen()) return;
        // _open() 직후 발생하는 popstate(잔류 해시 변경 등) 무시
        if (Date.now() - _openTimestamp < 300) return;
        close(true);
    }

    function _open() {
        const el = _ensureOverlay();
        if (!el.classList.contains('open')) {
            el.classList.add('open');
            document.body.classList.add('manual-open');
            document.addEventListener('keydown', _onKeydown);
            window.addEventListener('popstate', _onPopstate);
            _openTimestamp = Date.now();
            // 안드로이드 뒤로가기 / 스와이프로 닫히도록 히스토리 상태 추가
            try { history.pushState({ manualOverlay: true }, ''); _historyPushed = true; }
            catch (e) { _historyPushed = false; }
        }
    }

    function isOpen() {
        return !!(_overlayEl && _overlayEl.classList.contains('open'));
    }

    function close(fromPopstate) {
        if (!_overlayEl) return;
        _overlayEl.classList.remove('open');
        document.body.classList.remove('manual-open');
        document.removeEventListener('keydown', _onKeydown);
        window.removeEventListener('popstate', _onPopstate);
        _currentTitle = '';
        _currentBodyHtml = '';
        if (_historyPushed && !fromPopstate) {
            _historyPushed = false;
            try { history.back(); } catch (e) { /* noop */ }
        } else {
            _historyPushed = false;
        }
    }

    /* =========================================================
       마크다운 로드 (프로토콜별)
       ========================================================= */

    // http(s) 라이브 fetch
    async function _fetchMd(sourceKey) {
        const src = MD_SOURCES[sourceKey];
        if (!src) throw new Error('알 수 없는 문서 소스: ' + sourceKey);
        const res = await fetch(src.path, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.text();
    }

    /* ---------------------------------------------------------
       file:// 지원용 번들 로더 (tools/build_doc_bundles.js 가 구은
       data/docs_md/<stem>.js 를 클래식 <script>로 주입 — file:// 에서도 동작)
       --------------------------------------------------------- */

    // 'docs/user_manual.md' → 'data/docs_md/user_manual.js'
    function _bundlePathFor(sourceKey) {
        const src = MD_SOURCES[sourceKey];
        if (!src) return null;
        const stem = src.path.split('/').pop().replace(/\.md$/i, '');
        return 'data/docs_md/' + stem + '.js';
    }

    // 클래식 <script> 동적 주입 (file:// 에서도 동작). 재사용/캐시 처리 포함.
    function _injectScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-doc-bundle="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === 'true') { resolve(); return; }
                if (existing.dataset.loaded === 'error') { reject(new Error('bundle load error: ' + src)); return; }
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('bundle load error: ' + src)));
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.dataset.docBundle = src;
            s.dataset.loaded = 'false';
            s.addEventListener('load', () => { s.dataset.loaded = 'true'; resolve(); });
            s.addEventListener('error', () => { s.dataset.loaded = 'error'; reject(new Error('bundle load error: ' + src)); });
            document.head.appendChild(s);
        });
    }

    // 번들(전역 __DOC_MD__)에서 마크다운 조회 — 없으면 해당 번들 스크립트를 주입 후 재조회
    async function _loadFromBundle(sourceKey) {
        const src = MD_SOURCES[sourceKey];
        if (!src) throw new Error('알 수 없는 문서 소스: ' + sourceKey);
        if (window.__DOC_MD__ && typeof window.__DOC_MD__[src.path] === 'string') {
            return window.__DOC_MD__[src.path];
        }
        try {
            await _injectScript(_bundlePathFor(sourceKey));
        } catch (e) {
            throw new Error('문서 번들을 찾을 수 없습니다. 터미널에서 `node tools/build_doc_bundles.js` 를 실행해 번들을 생성하세요.');
        }
        if (window.__DOC_MD__ && typeof window.__DOC_MD__[src.path] === 'string') {
            return window.__DOC_MD__[src.path];
        }
        throw new Error('문서 번들에 해당 문서가 없습니다. `node tools/build_doc_bundles.js` 로 다시 빌드하세요.');
    }

    // 프로토콜에 맞춰 마크다운 원문 확보
    async function _loadMd(sourceKey) {
        const src = MD_SOURCES[sourceKey];
        if (!src) throw new Error('알 수 없는 문서 소스: ' + sourceKey);
        // file:// 은 fetch가 원천 차단되므로 곧장 번들 사용
        if (location.protocol === 'file:') {
            return _loadFromBundle(sourceKey);
        }
        // http(s): 라이브 .md 우선(항상 최신), 실패하면 번들로 폰트 폴로백
        try {
            return await _fetchMd(sourceKey);
        } catch (err) {
            try {
                return await _loadFromBundle(sourceKey);
            } catch (bundleErr) {
                throw err; // 원래의 네트워크 오류를 그대로 노출
            }
        }
    }

    /* =========================================================
       메인 엔트리
       ========================================================= */
    async function openDocument(sourceKey) {
        const src = MD_SOURCES[sourceKey];
        if (!src) {
            _showError('문서 오류', '알 수 없는 문서 소스입니다: ' + sourceKey);
            return;
        }
        const title = src.title;

        const cached = _getCached(sourceKey);
        if (cached) { _renderBody(title, cached); _open(); return; }

        _showLoading(title);

        try {
            const mdText = await _loadMd(sourceKey);
            const bodyHtml = _mdToHtml(mdText);
            _setCached(sourceKey, bodyHtml);
            _renderBody(title, bodyHtml);
        } catch (err) {
            console.error('Document load failed:', err);
            _showError(title, err && err.message ? err.message : String(err));
        }
    }

    // 편의 메서드
    function openManual() { return openDocument('user_manual'); }
    function openSummary() { return openDocument('study_summary'); }

    // 테마 변경 이벤트 발생 시 머메이드 다이어그램 다시 렌더링
    document.addEventListener('themechange', () => {
        if (isOpen() && _currentBodyHtml) {
            const el = _ensureOverlay();
            const article = el.querySelector('#manual-article');
            article.innerHTML = _currentBodyHtml;
            _renderMermaid();
        }
    });

    return {
        openDocument,
        openManual,
        openSummary,
        close,
        isOpen,
        _mdToHtml,  // 테스트용 노출
        _clearCache: () => {
            const keys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
            }
            keys.forEach(k => sessionStorage.removeItem(k));
        }
    };
})();

// 전역 노출은 app.js에서 일괄 수행합니다.
