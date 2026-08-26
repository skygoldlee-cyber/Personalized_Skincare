// src/exam-viewer.js - 실전 예상문제집 런타임 MD→HTML 변환 뷰어
// 외부 의존성: escapeHTML (src/sanitize.js — index.html에서 가장 먼저 로드됨)
//
// [변경 요약] 새 창(window.open + about:blank + document.write) 방식을
//   앱 내부 전체화면 오버레이 렌더링으로 교체했습니다.
//   - about:blank 문서에는 <base>가 없어 exam-style.css / ../vendor / ../index.html
//     등 모든 상대경로가 404 → 스피너조차 안 뜨고 본문은 무스타일로 표시되던 문제 해결.
//   - 설치형 iOS PWA(standalone) / 팝업 차단 환경에서 window.open이 null 을 반환해
//     "문제집 불러오기 안됨"이 되던 문제 해결(팝업 자체를 사용하지 않음).
//   - 오버레이는 같은 출처의 현재 문서이므로 strict CSP(default-src 'self')를 그대로 만족하고,
//     변환 결과가 쓰는 클래스(.reader-table / .reader-code-block / .study-section / blockquote)는
//     이미 style.css에 정의돼 있어 자동으로 스타일이 적용됩니다.
//
// [file:// 지원] 브라우저는 file:// 에서 fetch()를 차단합니다(=Failed to fetch).
//   그래서 로드 소스를 프로토콜에 따라 고릅니다.
//     - http(s) : 라이브 fetch 우선 → 실패 시 번들 폴백 (재빌드 없이 항상 최신 .md)
//     - file:// : tools/build_exam_bundles.js 가 구운 data/exams_md/<stem>.js 번들 사용
//                 (클래식 <script> 는 file:// 에서도 로드되므로 동작)
//   번들이 없으면 `node tools/build_exam_bundles.js` 를 실행하라는 안내를 띄웁니다.

import { escapeHTML } from './sanitize.js';
import { parseMarkdown } from './markdown-parser.js';

export const ExamViewer = (() => {
    // 캐시 포맷 변경(전체 문서 → 본문 HTML)으로 v2 로 bump
    const CACHE_PREFIX = 'exam_md_cache_v2_';
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

    /* =========================================================
       캐시 (sessionStorage, TTL 24h) — 본문 HTML만 저장
       ========================================================= */
    function _cacheKey(mdPath) {
        return CACHE_PREFIX + mdPath.replace(/[^a-zA-Z0-9]/g, '_');
    }

    function _getCached(mdPath) {
        try {
            const raw = sessionStorage.getItem(_cacheKey(mdPath));
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (Date.now() - entry.timestamp > CACHE_TTL) {
                sessionStorage.removeItem(_cacheKey(mdPath));
                return null;
            }
            return entry.html;
        } catch (e) {
            return null;
        }
    }

    function _setCached(mdPath, html) {
        try {
            sessionStorage.setItem(_cacheKey(mdPath), JSON.stringify({
                timestamp: Date.now(),
                html: html
            }));
        } catch (e) {
            // QuotaExceededError 등은 무시 (다음에 재변환)
        }
    }

    /* =========================================================
       마크다운 → HTML 변환 (기존 로직 그대로 — 정상 동작 확인됨)
       ========================================================= */
    function _mdToHtml(mdText) {
        return parseMarkdown(mdText, { allowMermaid: false });
    }

    /* =========================================================
       파일 경로 → 제목
       ========================================================= */
    function _titleFromPath(mdPath) {
        const filename = mdPath.split('/').pop().replace('.md', '');
        const map = {
            'subject1_100_questions': '제1과목: 화장품법의 이해 실전 예상 100제',
            'subject2_100_questions': '제2과목: 화장품 제조 및 품질관리 실전 예상 100제 (1부)',
            'subject2_part2_100': '제2과목: 화장품 제조 및 품질관리 실전 예상 100제 (2부)',
            'subject2_part3_100': '제2과목: 화장품 제조 및 품질관리 실전 예상 100제 (3부)',
            'subject3_100_questions': '제3과목: 유통화장품 안전관리 실전 예상 100제 (1부)',
            'subject3_part2_100': '제3과목: 유통화장품 안전관리 실전 예상 100제 (2부)',
            'subject4_100_questions': '제4과목: 맞춤형화장품의 이해 실전 예상 100제 (1부)',
            'subject4_part2_100': '제4과목: 맞춤형화장품의 이해 실전 예상 100제 (2부)',
            'subject4_part3_100': '제4과목: 맞춤형화장품의 이해 실전 예상 100제 (3부)'
        };
        return map[filename] || filename.replace(/_/g, ' ');
    }

    /* =========================================================
       앱 내부 전체화면 오버레이 (팝업/새창 미사용)
       ========================================================= */
    let _overlayEl = null;
    let _historyPushed = false;

    function _injectStylesOnce() {
        if (document.getElementById('exam-overlay-style')) return;
        const style = document.createElement('style');
        style.id = 'exam-overlay-style';
        // 앱의 실제 테마 토큰(--bg-app / --bg-card / --color-text-main / --color-text-muted)을
        // 사용해 글로벌 다크/라이트 테마를 자동으로 따라갑니다.
        // (이전에는 존재하지 않는 --bg-color/--text-color/--card-bg/--text-muted 를 참조해
        //  항상 라이트 폰트 기본값으로 떨어져 전역 테마가 적용되지 않던 문제 수정)
        style.textContent = `
#exam-overlay{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;
  background:var(--bg-app);color:var(--color-text-main);}
#exam-overlay.open{display:flex;}
#exam-overlay .exam-ov-bar{display:flex;align-items:center;gap:12px;flex:0 0 auto;
  padding:10px 16px;border-bottom:1px solid var(--border-color);
  background:var(--bg-card);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
#exam-overlay .exam-ov-title{flex:1 1 auto;min-width:0;font-weight:700;font-size:.98rem;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#exam-overlay .exam-ov-btn{flex:0 0 auto;cursor:pointer;border:1px solid var(--border-color);
  background:var(--bg-card);color:inherit;border-radius:10px;padding:8px 14px;font-size:.9rem;
  display:inline-flex;align-items:center;gap:6px;font-family:inherit;
  transition:all .15s ease;}
#exam-overlay .exam-ov-btn:hover{border-color:var(--border-color-active);color:var(--color-primary);}
#exam-overlay .exam-ov-btn.primary{background:linear-gradient(135deg,var(--color-primary),#0891b2);
  border-color:transparent;color:#fff;}
#exam-overlay .exam-ov-btn.primary:hover{color:#fff;filter:brightness(1.1);
  box-shadow:var(--glow-primary);}
#exam-overlay .exam-ov-btn:active{transform:translateY(1px);}
#exam-overlay .exam-ov-scroll{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:20px clamp(16px,4vw,48px) 80px;}
#exam-overlay #exam-article{max-width:900px;margin:0 auto;line-height:1.8;
  font-size:1rem;color:inherit;}
/* ---- 변환된 마크다운 본문 타이포그래피 (style.css 비의존, 다크/라이트 모두 대응) ---- */
#exam-overlay #exam-article h1{font-size:1.6rem;font-weight:800;margin:0 0 1rem;
  padding-bottom:.6rem;border-bottom:2px solid var(--color-primary);
  background:linear-gradient(135deg,var(--color-primary),var(--color-secondary));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
#exam-overlay #exam-article h2{font-size:1.25rem;font-weight:700;margin:1.8rem 0 .8rem;
  padding-left:.7rem;border-left:4px solid var(--color-primary);}
#exam-overlay #exam-article h3{font-size:1.08rem;font-weight:600;margin:1.4rem 0 .6rem;
  color:var(--color-primary);}
#exam-overlay #exam-article p{margin:0 0 .9rem;}
#exam-overlay #exam-article strong{color:var(--color-warning);font-weight:700;}
#exam-overlay #exam-article em{font-style:italic;}
#exam-overlay #exam-article code{font-family:ui-monospace,Consolas,monospace;font-size:.9em;
  background:rgba(127,127,127,.18);border-radius:4px;padding:.1em .35em;}
#exam-overlay #exam-article blockquote{margin:1rem 0;padding:.8rem 1rem;
  border-left:4px solid var(--color-secondary);
  background:rgba(139,92,246,.08);border-radius:0 8px 8px 0;}
#exam-overlay #exam-article blockquote p{margin:0;}
#exam-overlay #exam-article ul,#exam-overlay #exam-article ol{margin:0 0 1rem;padding-left:1.4rem;}
#exam-overlay #exam-article li{margin:.25rem 0;}
#exam-overlay #exam-article hr{border:none;border-top:1px solid var(--border-color);
  margin:1.6rem 0;}
#exam-overlay #exam-article sup{color:var(--color-warning);}
#exam-overlay #exam-article .reader-table-wrapper{margin:1rem 0;}
#exam-overlay #exam-article pre.reader-code-block{margin:1rem 0;padding:1rem;overflow-x:auto;
  border-radius:8px;background:rgba(0,0,0,.3);border:1px solid var(--border-color);}
html.light-theme #exam-overlay #exam-article pre.reader-code-block{background:rgba(0,0,0,.06);}
#exam-overlay #exam-article pre.reader-code-block code{background:none;padding:0;}
#exam-overlay .exam-ov-toc{max-width:900px;margin:0 auto 18px;}
#exam-overlay .exam-ov-toc summary{cursor:pointer;font-weight:600;padding:8px 0;}
#exam-overlay .exam-ov-toc a{display:block;padding:4px 0;color:var(--color-primary);
  text-decoration:none;font-size:.9rem;}
#exam-overlay .exam-ov-toc a:hover{text-decoration:underline;}
#exam-overlay .exam-ov-toc a.depth-3{padding-left:16px;font-size:.85rem;opacity:.85;}
#exam-overlay .exam-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:60vh;gap:18px;color:var(--color-text-muted);}
#exam-overlay .exam-loading .spinner{width:44px;height:44px;border:4px solid var(--border-color);
  border-top-color:var(--color-primary);border-radius:50%;animation:exam-spin 1s linear infinite;}
@keyframes exam-spin{to{transform:rotate(360deg);}}
body.exam-open{overflow:hidden;}
@media print{
  body.exam-open>*:not(#exam-overlay){display:none !important;}
  #exam-overlay{position:static !important;display:block !important;}
  #exam-overlay .exam-ov-bar,#exam-overlay .exam-ov-toc{display:none !important;}
  #exam-overlay .exam-ov-scroll{overflow:visible !important;padding:0 !important;}
}`;
        document.head.appendChild(style);
    }

    function _ensureOverlay() {
        if (_overlayEl) return _overlayEl;
        _injectStylesOnce();
        const el = document.createElement('div');
        el.id = 'exam-overlay';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.innerHTML = `
            <div class="exam-ov-bar">
                <button type="button" class="exam-ov-btn" data-exam-close>
                    <i class="fa-solid fa-arrow-left"></i> 닫기
                </button>
                <div class="exam-ov-title" id="exam-ov-title"></div>
                <button type="button" class="exam-ov-btn primary" data-exam-print>
                    <i class="fa-solid fa-print"></i> 인쇄 / PDF
                </button>
            </div>
            <div class="exam-ov-scroll">
                <article id="exam-article" class="study-section"></article>
            </div>`;
        document.body.appendChild(el);

        el.querySelector('[data-exam-close]').addEventListener('click', close);
        el.querySelector('[data-exam-print]').addEventListener('click', () => window.print());
        _overlayEl = el;
        return el;
    }

    function _buildToc(article) {
        const headings = article.querySelectorAll('h2, h3');
        if (headings.length === 0) return '';
        let items = '';
        headings.forEach((h, idx) => {
            if (!h.id) h.id = 'exam-h-' + idx;
            const depth = h.tagName === 'H3' ? 'depth-3' : 'depth-2';
            const label = h.textContent.replace(/🔖기출|📌중요/g, '').trim();
            items += `<a href="#${h.id}" class="${depth}" data-exam-jump="${h.id}">${escapeHTML(label)}</a>`;
        });
        return `<details class="exam-ov-toc"><summary><i class="fa-solid fa-list"></i> 목차</summary>${items}</details>`;
    }

    function _renderBody(title, bodyHtml) {
        const el = _ensureOverlay();
        el.querySelector('#exam-ov-title').textContent = title;
        const article = el.querySelector('#exam-article');
        article.innerHTML = bodyHtml;

        // 목차를 본문 앞에 삽입 (오버레이 스크롤 컨테이너 안쪽 상단)
        const scroll = el.querySelector('.exam-ov-scroll');
        const oldToc = scroll.querySelector('.exam-ov-toc');
        if (oldToc) oldToc.remove();
        const tocHtml = _buildToc(article);
        if (tocHtml) {
            const wrap = document.createElement('div');
            wrap.innerHTML = tocHtml;
            const toc = wrap.firstElementChild;
            scroll.insertBefore(toc, article);
            toc.addEventListener('click', (e) => {
                const a = e.target.closest('[data-exam-jump]');
                if (!a) return;
                e.preventDefault();
                const target = document.getElementById(a.getAttribute('data-exam-jump'));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        scroll.scrollTop = 0;
    }

    function _showLoading(title) {
        const el = _ensureOverlay();
        el.querySelector('#exam-ov-title').textContent = title;
        const scroll = el.querySelector('.exam-ov-scroll');
        const oldToc = scroll.querySelector('.exam-ov-toc');
        if (oldToc) oldToc.remove();
        el.querySelector('#exam-article').innerHTML =
            '<div class="exam-loading"><div class="spinner"></div><p>문제집을 불러오는 중...</p></div>';
        _open();
    }

    function _showError(title, message) {
        const el = _ensureOverlay();
        el.querySelector('#exam-ov-title').textContent = title;
        el.querySelector('#exam-article').innerHTML =
            `<div class="study-section"><h2>문제집을 불러올 수 없습니다</h2>
             <p>${escapeHTML(message)}</p>
             <p><button type="button" class="exam-ov-btn" data-exam-close>홈으로 돌아가기</button></p></div>`;
        el.querySelector('#exam-article [data-exam-close]').addEventListener('click', close);
        _open();
    }

    function _onKeydown(e) { if (e.key === 'Escape') close(); }
    function _onPopstate() { if (isOpen()) close(true); }

    function _open() {
        const el = _ensureOverlay();
        if (!el.classList.contains('open')) {
            el.classList.add('open');
            document.body.classList.add('exam-open');
            document.addEventListener('keydown', _onKeydown);
            window.addEventListener('popstate', _onPopstate);
            // 안드로이드 뒤로가기 / 스와이프로 닫히도록 히스토리 상태 추가
            try { history.pushState({ examOverlay: true }, ''); _historyPushed = true; }
            catch (e) { _historyPushed = false; }
        }
    }

    function isOpen() {
        return !!(_overlayEl && _overlayEl.classList.contains('open'));
    }

    function close(fromPopstate) {
        if (!_overlayEl) return;
        _overlayEl.classList.remove('open');
        document.body.classList.remove('exam-open');
        document.removeEventListener('keydown', _onKeydown);
        window.removeEventListener('popstate', _onPopstate);
        if (_historyPushed && !fromPopstate) {
            _historyPushed = false;
            try { history.back(); } catch (e) { /* noop */ }
        } else {
            _historyPushed = false;
        }
    }

    /* =========================================================
       마크다운 로드 소스 (프로토콜별)
       ========================================================= */

    // 'content/exams/subject1_100_questions.md' → 'data/exams_md/subject1_100_questions.js'
    function _bundlePathFor(mdPath) {
        const stem = mdPath.split('/').pop().replace(/\.md$/i, '');
        return 'data/exams_md/' + stem + '.js';
    }

    // 클래식 <script> 동적 주입 (file:// 에서도 동작). 재사용/캐시 처리 포함.
    function _injectScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-exam-bundle="${src}"]`);
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
            s.dataset.examBundle = src;
            s.dataset.loaded = 'false';
            s.addEventListener('load', () => { s.dataset.loaded = 'true'; resolve(); });
            s.addEventListener('error', () => { s.dataset.loaded = 'error'; reject(new Error('bundle load error: ' + src)); });
            document.head.appendChild(s);
        });
    }

    // 번들(전역 __EXAM_MD__)에서 마크다운 조회 — 없으면 해당 번들 스크립트를 주입 후 재조회
    async function _loadFromBundle(mdPath) {
        if (window.__EXAM_MD__ && typeof window.__EXAM_MD__[mdPath] === 'string') {
            return window.__EXAM_MD__[mdPath];
        }
        try {
            await _injectScript(_bundlePathFor(mdPath));
        } catch (e) {
            throw new Error('문제집 번들을 찾을 수 없습니다. 터미널에서 `node tools/build_exam_bundles.js` 를 실행해 번들을 생성하세요.');
        }
        if (window.__EXAM_MD__ && typeof window.__EXAM_MD__[mdPath] === 'string') {
            return window.__EXAM_MD__[mdPath];
        }
        throw new Error('문제집 번들에 해당 문항이 없습니다. `node tools/build_exam_bundles.js` 로 다시 빌드하세요.');
    }

    // http(s) 라이브 fetch
    async function _fetchMd(mdPath) {
        const res = await fetch(mdPath, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.text();
    }

    // 프로토콜에 맞춰 마크다운 원문 확보
    async function _loadMd(mdPath) {
        // file:// 은 fetch가 원천 차단되므로 곧장 번들 사용
        if (location.protocol === 'file:') {
            return _loadFromBundle(mdPath);
        }
        // http(s): 라이브 .md 우선(항상 최신), 실패하면 번들로 폴백
        try {
            return await _fetchMd(mdPath);
        } catch (err) {
            try {
                return await _loadFromBundle(mdPath);
            } catch (bundleErr) {
                throw err; // 원래의 네트워크 오류를 그대로 노출
            }
        }
    }

    /* =========================================================
       메인 엔트리
       ========================================================= */
    async function openExam(mdPath) {
        const title = _titleFromPath(mdPath);

        const cached = _getCached(mdPath);
        if (cached) { _renderBody(title, cached); _open(); return; }

        _showLoading(title);

        try {
            const mdText = await _loadMd(mdPath);
            const bodyHtml = _mdToHtml(mdText);
            _setCached(mdPath, bodyHtml);
            _renderBody(title, bodyHtml);
        } catch (err) {
            console.error('Exam load failed:', err);
            _showError(title, err && err.message ? err.message : String(err));
        }
    }

    return {
        openExam,
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
