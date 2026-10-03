// src/manual-viewer.js - 사용자 매뉴얼 런타임 MD→HTML 변환 뷰어
// @spec MV-01~04
// 외부 의존성: escapeHTML (src/sanitize.js — index.html에서 가장 먼저 로드됨)
//
// [설계] 예상문제집 뷰어(src/exam-viewer.js)와 동일한 패턴을 사용하여
//   docs/user_manual.md 를 런타임에 fetch → MD→HTML 변환 → 전체화면 오버레이로 표시합니다.
//   - 별도 HTML 파일 생성이 불필요하여 user_manual.md 업데이트 시 자동 동기화
//   - file:// 프로토콜에서는 fetch가 차단되므로 번들 방식 폰트 폴로백
//   - 전역 테마(--bg-app, --color-text-main 등)를 자동으로 따라감
//   - 오버레이 셸·캐시·TOC·번들 주입은 src/doc-overlay.js 공용 베이스 사용
//
import { escapeHTML } from './sanitize.js';
import { renderMermaidIn } from './mermaid-render.js';
import { parseMarkdown } from './markdown-parser.js';
import { openSubjectChapter } from './views/textbook-reader.js';
import { PATHS } from './paths.js';
import { dataPath } from './exam-context.js';
import { CACHE } from './config/cache.js';
import { makeSessionCache, injectBundleScript, fetchMd, buildTocHtml, mountToc, createDocOverlay } from './doc-overlay.js';

export const ManualViewer = (() => {
    // 지원하는 마크다운 소스 정의
    const MD_SOURCES = {
        'user_manual': { path: PATHS.USER_MANUAL, title: '학습 매뉴얼' },
        'formula_manual': { path: PATHS.FORMULA_MANUAL, title: '실무 매뉴얼 (Formula OS)' },
        'study_summary': { path: PATHS.STUDY_GUIDE, title: '학습 안내서' },
        'mnemonic_guide': { path: PATHS.MNEMONIC_GUIDE, title: '두음법·숫자 암기 총정리' }
    };
    const _cache = makeSessionCache('manual_md_cache_v3_', CACHE.MANUAL_CACHE_TTL_MS); // 24시간
    let _currentTitle = '';
    let _currentBodyHtml = '';

    /* =========================================================
       마크다운 → HTML 변환 (exam-viewer.js와 동일한 로직)
       ========================================================= */
    function _mdToHtml(mdText) {
        return parseMarkdown(mdText, { allowMermaid: true });
    }

    /* =========================================================
       앱 남부 전체화면 오버레이 (팝업/새창 미사용)
       ========================================================= */
    // 앱의 실제 테마 토큰(--bg-app / --bg-card / --color-text-main / --color-text-muted)을
    // 사용해 글로벌 다크/라이트 테마를 자동으로 따라갑니다.
    const OVERLAY_CSS = `
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

    const _overlay = createDocOverlay({
        id: 'manual-overlay',
        styleId: 'manual-overlay-style',
        css: OVERLAY_CSS,
        bodyClass: 'manual-open',
        historyMarker: 'manualOverlay',
        popstateGuardMs: 300,
        innerHTML: `
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
            </div>`,
        wire(el) {
            el.querySelector('[data-manual-close]')?.addEventListener('click', close);
            el.querySelector('[data-manual-print]')?.addEventListener('click', () => window.print());
        },
        onClose() {
            _currentTitle = '';
            _currentBodyHtml = '';
        }
    });
    const _ensureOverlay = _overlay.ensure;
    const _open = _overlay.open;
    const close = _overlay.close;
    const isOpen = _overlay.isOpen;

    // mermaid(3.3MB)는 index.html 에서 즉시 로드하지 않고, 매뉴얼에 실제 다이어그램이
    // 있을 때만 mermaid-render.js에서 온디맨드로 1회 주입한다.
    function _renderMermaid() {
        renderMermaidIn(document.getElementById('manual-article'), '[manual]');
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
        mountToc(scroll, article, buildTocHtml(article, {
            idPrefix: 'manual-h-', jumpAttr: 'manual-jump', tocClass: 'manual-ov-toc'
        }), { tocClass: 'manual-ov-toc', jumpAttr: 'manual-jump' });
        scroll.scrollTop = 0;

        // 외부 링크(http, /docs 등) 클릭 시 새 창으로 열기
        article.addEventListener('click', function onLinkClick(e) {
            const a = e.target.closest('a');
            if (!a) return;
            const href = a.getAttribute('href');
            if (!href || href.startsWith('#')) return; // 내부 앵커는 무시
            e.preventDefault();
            // 매뉴얼 간 이동 (doc:키) — 같은 오버레이에서 다른 문서로 전환
            const docMatch = href.match(/^doc:([a-z_]+)$/);
            if (docMatch && MD_SOURCES[docMatch[1]]) {
                openDocument(docMatch[1]);
                return;
            }
            // 교재 바로가기 (subj:과목#chNN) → 오버레이 닫고 교재 리더 해당 과목·챕터로 이동
            const subjMatch = href.match(/^subj:([a-z]+)(?:#(ch\d+))?$/);
            if (subjMatch) {
                close();
                const navItem = document.querySelector('.nav-item[data-target="textbook-reader-view"]');
                if (navItem) /** @type {HTMLElement} */ (navItem).click();
                openSubjectChapter(subjMatch[1], subjMatch[2] || '');
                return;
            }
            window.open(href, '_blank', 'noopener,noreferrer');
        });

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

    /* =========================================================
       마크다운 로드 (프로토콜별)
       ========================================================= */

    /* ---------------------------------------------------------
       file:// 지원용 번들 로더 (tools/build/build_doc_bundles.js 가 구은
       data/docs_md/<stem>.js 를 클래식 <script>로 주입 — file:// 에서도 동작)
       --------------------------------------------------------- */

    // 'content/exams/<id>/docs/학습안내서.md' → '{dataRoot}/docs_md/학습안내서.js' (시험별 문서)
    // 'docs/<stem>.md' → 'data/docs_md/<stem>.js' (앱 공용 문서 — 현재 미사용 슬롯)
    function _bundlePathFor(sourceKey) {
        const src = MD_SOURCES[sourceKey];
        if (!src) return null;
        const stem = src.path.split('/').pop().replace(/\.md$/i, '');
        const base = src.path.startsWith('docs/') ? 'data' : null;
        return (base ? `${base}/docs_md/` : dataPath('docs_md/')) + stem + '.js';
    }

    // 번들(전역 __DOC_MD__)에서 마크다운 조회 — 없으면 해당 번들 스크립트를 주입 후 재조회
    async function _loadFromBundle(sourceKey) {
        const src = MD_SOURCES[sourceKey];
        if (!src) throw new Error('알 수 없는 문서 소스: ' + sourceKey);
        if (window.__DOC_MD__ && typeof window.__DOC_MD__[src.path] === 'string') {
            return window.__DOC_MD__[src.path];
        }
        try {
            await injectBundleScript(/** @type {string} */ (_bundlePathFor(sourceKey)), 'data-doc-bundle');
        } catch (e) {
            throw new Error('문서 번들을 찾을 수 없습니다. 터미널에서 `node tools/build/build_doc_bundles.js` 를 실행해 번들을 생성하세요.');
        }
        if (window.__DOC_MD__ && typeof window.__DOC_MD__[src.path] === 'string') {
            return window.__DOC_MD__[src.path];
        }
        throw new Error('문서 번들에 해당 문서가 없습니다. `node tools/build/build_doc_bundles.js` 로 다시 빌드하세요.');
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
            return await fetchMd(src.path);
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

        const cached = _cache.get(src.path);
        if (cached) { _renderBody(title, cached.html); _open(); return; }

        _showLoading(title);

        try {
            const mdText = await _loadMd(sourceKey);
            const bodyHtml = _mdToHtml(mdText);
            _cache.set(src.path, { html: bodyHtml });
            _renderBody(title, bodyHtml);
        } catch (err) {
            console.error('Document load failed:', err);
            _showError(title, err && err.message ? err.message : String(err));
        }
    }

    // 편의 메서드
    function openManual() { return openDocument('user_manual'); }
    function openFormulaManual() { return openDocument('formula_manual'); }
    function openSummary() { return openDocument('study_summary'); }
    function openMnemonicGuide() { return openDocument('mnemonic_guide'); }

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
        openFormulaManual,
        openSummary,
        openMnemonicGuide,
        close,
        isOpen,
        _mdToHtml,  // 테스트용 노출
        _clearCache: _cache.clear
    };
})();

// 전역 노출은 app.js에서 일괄 수행합니다.
