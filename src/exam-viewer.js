// src/exam-viewer.js - 실전 예상문제집 런타임 MD→HTML 변환 뷰어
// @spec EV-01~08
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
//     - file:// : tools/build/build_exam_bundles.js 가 구운 data/exams_md/<stem>.js 번들 사용
//                 (클래식 <script> 는 file:// 에서도 로드되므로 동작)
//   번들이 없으면 `node tools/build/build_exam_bundles.js` 를 실행하라는 안내를 띄웁니다.
//   오버레이 셸·캐시·TOC·번들 주입은 src/doc-overlay.js 공용 베이스 사용
//
import { escapeHTML } from './sanitize.js';
import { parseMarkdown } from './markdown-parser.js';
import { resolveRefPath } from './pdf-registry.js';
import { contentPath, dataPath } from './exam-context.js';
import { getJSON, setJSON } from './storage.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { CACHE } from './config/cache.js';
import { proFeatureNotice } from './pro-upgrade.js';
import { renderMermaidIn } from './mermaid-render.js';
import { DataLoader } from './data-loader.js';
import { buildComboSubjectMd } from './combo-doc.js';
import { makeSessionCache, injectBundleScript, fetchMd, buildTocHtml, mountToc, createDocOverlay } from './doc-overlay.js';

export const ExamViewer = (() => {
    // 캐시 포맷 변경: v7 — allowMermaid 활성화 (참조자료 md의 ```mermaid 블록 렌더링)
    const _cache = makeSessionCache('exam_md_cache_v7_', CACHE.EXAM_CACHE_TTL_MS); // 24시간

    // 네비게이션 히스토리 스택 (인용 링크 이동 후 뒤로가기용)
    const _navStack = []; // [{ mdPath, lineNum, scrollPos }]

    /* =========================================================
       마크다운 → HTML 변환 (기존 로직 그대로 — 정상 동작 확인됨)
       ========================================================= */
    function _mdToHtml(mdText, mdPath) {
        // ref_md는 #L#### 인용 라인번호 보존을 위해 시각적 줄 그대로 변환된 산출물이라
        // 문장 중간 절단이 많다 — joinWraps로 연속줄을 병합한다 (라인번호는 유지됨)
        const joinWraps = typeof mdPath === 'string' && mdPath.indexOf('ref_md') !== -1;
        return parseMarkdown(mdText, { allowMermaid: true, addLineNumbers: true, joinWraps: joinWraps });
    }

    /* =========================================================
       파일 경로 → 제목
       ========================================================= */
    function _titleFromPath(mdPath) {
        // 가상 경로 'combo:N' — 복수정답형 문제집 (런타임 직렬화 문서)
        if (typeof mdPath === 'string' && mdPath.startsWith('combo:')) {
            const num = parseInt(mdPath.slice(6), 10);
            const subj = ((DataLoader.registry || {}).subjects || []).find(s => s.order === num);
            return `${subj ? subj.name : `과목${num}`} ㄱㄴㄷ 조합형`;
        }
        const filename = mdPath.split('/').pop();
        const registry = (typeof window !== 'undefined' && window.DATA_REGISTRY) || null;
        if (registry && Array.isArray(registry.exams)) {
            const exam = registry.exams.find(e => e.file === filename);
            if (exam && exam.title) return exam.title;
        }
        return filename.replace(/\.md$/i, '').replace(/_/g, ' ');
    }

    /* =========================================================
       앱 내부 전체화면 오버레이 (팝업/새창 미사용)
       ========================================================= */
    let _currentMdPath = null;

    // 앱의 실제 테마 토큰(--bg-app / --bg-card / --color-text-main / --color-text-muted)을
    // 사용해 글로벌 다크/라이트 테마를 자동으로 따라갑니다.
    // (이전에는 존재하지 않는 --bg-color/--text-color/--card-bg/--text-muted 를 참조해
    //  항상 라이트 폰트 기본값으로 떨어져 전역 테마가 적용되지 않던 문제 수정)
    const OVERLAY_CSS = `
#exam-overlay{position:fixed;inset:0;z-index:var(--z-modal-overlay);display:none;flex-direction:column;
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
#exam-overlay .exam-line-highlight{background:rgba(250,204,21,.35);border-radius:4px;
  padding:2px 4px;margin:-2px -4px;
  animation:exam-line-pulse 1.5s ease-in-out 2;}
@keyframes exam-line-pulse{0%,100%{background:rgba(250,204,21,.35);}50%{background:rgba(250,204,21,.6);}}
#exam-overlay .exam-resume-chip{position:absolute;right:18px;bottom:22px;z-index:5;
  display:inline-flex;align-items:center;gap:2px;
  background:var(--bg-card);border:1px solid var(--border-color);border-radius:999px;
  box-shadow:0 6px 18px rgba(0,0,0,.28);padding:4px 6px 4px 14px;font-size:.82rem;}
#exam-overlay .exam-resume-chip.is-hidden{display:none;}
#exam-overlay .exam-resume-go{background:none;border:none;color:var(--color-primary);
  font:inherit;font-weight:700;cursor:pointer;padding:4px 6px;}
#exam-overlay .exam-resume-x{background:none;border:none;color:var(--color-text-muted);
  cursor:pointer;padding:4px 8px;font-size:.85rem;border-radius:50%;}
#exam-overlay .exam-resume-x:hover{color:var(--color-text-main);}
@media print{
  body.exam-open>*:not(#exam-overlay){display:none !important;}
  #exam-overlay{position:static !important;display:block !important;}
  #exam-overlay .exam-ov-bar,#exam-overlay .exam-ov-toc,#exam-overlay .exam-resume-chip{display:none !important;}
  #exam-overlay .exam-ov-scroll{overflow:visible !important;padding:0 !important;}
}`;

    const _overlay = createDocOverlay({
        id: 'exam-overlay',
        styleId: 'exam-overlay-style',
        css: OVERLAY_CSS,
        ariaLabel: '문제집 뷰어',
        bodyClass: 'exam-open',
        historyMarker: 'examOverlay',
        innerHTML: `
            <div class="exam-ov-bar">
                <button type="button" class="exam-ov-btn" data-exam-close aria-label="닫기">
                    <i class="fa-solid fa-xmark"></i> 닫기
                </button>
                <button type="button" class="exam-ov-btn is-hidden" data-exam-back aria-label="이전 문서로">
                    <i class="fa-solid fa-arrow-left"></i> 뒤로
                </button>
                <div class="exam-ov-title" id="exam-ov-title" role="heading" aria-level="1"></div>
                <button type="button" class="exam-ov-btn primary" data-exam-print aria-label="인쇄 또는 PDF 저장">
                    <i class="fa-solid fa-print"></i> 인쇄 / PDF
                </button>
            </div>
            <div class="exam-ov-scroll" role="document" tabindex="0">
                <article id="exam-article" class="study-section"></article>
            </div>
            <div id="exam-resume-chip" class="exam-resume-chip is-hidden">
                <button type="button" id="exam-resume-go" class="exam-resume-go"></button>
                <button type="button" id="exam-resume-dismiss" class="exam-resume-x" aria-label="이어보기 닫기"><i class="fa-solid fa-xmark"></i></button>
            </div>`,
        wire(el) {
            el.querySelector('[data-exam-close]')?.addEventListener('click', () => close());
            el.querySelector('[data-exam-back]')?.addEventListener('click', () => _goBack());
            el.querySelector('[data-exam-print]')?.addEventListener('click', () => window.print());
            el.querySelector('#exam-resume-go')?.addEventListener('click', () => {
                const chip = el.querySelector('#exam-resume-chip');
                const scroll = el.querySelector('.exam-ov-scroll');
                const pos = parseInt((chip && /** @type {HTMLElement} */ (chip).dataset.pos) || '0', 10);
                if (scroll && pos > 0) scroll.scrollTo({ top: pos, behavior: 'smooth' });
                if (chip) chip.classList.add('is-hidden');
            });
            el.querySelector('#exam-resume-dismiss')?.addEventListener('click', () => {
                el.querySelector('#exam-resume-chip')?.classList.add('is-hidden');
            });
        },
        onClose(el) {
            // 이어보기 위치 저장 — 300px 이상 읽은 문서만 기록 (상단이면 기록 삭제)
            const scroll = el.querySelector('.exam-ov-scroll');
            if (_currentMdPath && scroll) _savePos(_currentMdPath, scroll.scrollTop);
            _hideResumeChip();
            _navStack.length = 0; // 히스토리 초기화
            _currentMdPath = null;
        }
    });
    const _ensureOverlay = _overlay.ensure;
    const _open = _overlay.open;
    const close = _overlay.close;
    const isOpen = _overlay.isOpen;

    /* ---- 이어보기: 문서별 마지막 스크롤 위치 (시험 스코프 진도 키, 세션 간 유지) ---- */
    const POS_MIN = 300; // 상단 근처(300px 미만)는 이어보기 대상이 아님
    let _resumeTimer = null;

    function _readPosMap() {
        const map = getJSON(STORAGE_KEYS.EXAM_VIEW_POS, {});
        return (map && typeof map === 'object') ? map : {};
    }

    function _savePos(mdPath, pos) {
        const map = _readPosMap();
        if (pos > POS_MIN) map[mdPath] = pos;
        else delete map[mdPath];
        setJSON(STORAGE_KEYS.EXAM_VIEW_POS, map);
    }

    function _hideResumeChip() {
        if (_resumeTimer) { clearTimeout(_resumeTimer); _resumeTimer = null; }
        _overlay.el()?.querySelector('#exam-resume-chip')?.classList.add('is-hidden');
    }

    // 저장된 위치가 있으면 우하단 '이어보기' 칩 표시 — 클릭 시 해당 지점으로 스크롤
    function _maybeShowResumeChip(mdPath) {
        const overlayEl = _overlay.el();
        const chip = overlayEl && overlayEl.querySelector('#exam-resume-chip');
        const scroll = overlayEl && overlayEl.querySelector('.exam-ov-scroll');
        const go = overlayEl && overlayEl.querySelector('#exam-resume-go');
        if (!chip || !scroll || !go) return;
        const pos = _readPosMap()[mdPath] || 0;
        const denom = scroll.scrollHeight - scroll.clientHeight;
        if (pos < POS_MIN || denom <= 0) { _hideResumeChip(); return; }
        const pct = Math.min(99, Math.round((pos / denom) * 100));
        chip.dataset.pos = String(pos);
        go.innerHTML = `<i class="fa-solid fa-bookmark"></i> 이어보기 · ${pct}% 지점`;
        chip.classList.remove('is-hidden');
        _resumeTimer = setTimeout(() => chip.classList.add('is-hidden'), 8000);
    }

    function _renderBody(title, bodyHtml, mdPath) {
        const el = _ensureOverlay();
        el.querySelector('#exam-ov-title').textContent = title;
        const article = el.querySelector('#exam-article');
        article.innerHTML = bodyHtml;
        article.dataset.examMdpath = mdPath || '';

        // 상대 이미지 경로(images/...)를 MD 파일 위치 기준 절대 URL로 변환
        // (변환 없으면 앱 루트 기준으로 해석되어 ref_md 문서 이미지가 깨짐)
        if (mdPath) {
            const baseUrl = new URL(
                mdPath.substring(0, mdPath.lastIndexOf('/') + 1),
                location.href).href;
            article.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                    img.src = new URL(src, baseUrl).href;
                }
            });
        }

        // 목차를 본문 앞에 삽입 (오버레이 스크롤 컨테이너 안쪽 상단)
        const scroll = el.querySelector('.exam-ov-scroll');
        mountToc(scroll, article, buildTocHtml(article, {
            idPrefix: 'exam-h-', jumpAttr: 'exam-jump', tocClass: 'exam-ov-toc'
        }), { tocClass: 'exam-ov-toc', jumpAttr: 'exam-jump' });
        // PDF 참조 링크 인터셉트: .pdf 링크를 대응하는 .md 경로로 변환하여 오버레이에서 열기
        article.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!/\.pdf$/i.test(href)) return;
            const pdfFile = decodeURIComponent(href.split('/').pop());
            const mdPath = resolveRefPath(pdfFile);
            if (mdPath) {
                a.setAttribute('href', mdPath);
                a.classList.add('source-link');
                const icon = a.querySelector('i');
                if (!icon) a.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-file-lines"></i> ');
            }
        });

        // 교재 인용 링크(../교재/.../*.md#LNN) 클릭 → 오버레이 내에서 교재 열기
        article.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!/\.md(#L(\d+))?$/i.test(href)) return;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                // 현재 문제집 경로를 기준으로 상대 경로 해석
                const basePath = a.closest('[data-exam-mdpath]');
                const currentPath = basePath
                    ? basePath.dataset.examMdpath
                    : (a.dataset.examMdpath || '');
                let resolved = href;
                try {
                    if (currentPath) {
                        const baseDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                        resolved = decodeURIComponent(new URL(href, new URL(baseDir, location.href)).pathname);
                    } else {
                        resolved = decodeURIComponent(new URL(href, location.href).pathname);
                    }
                    // 선행 슬래시 제거 (대시보드에서 열 때와 경로 일치)
                    resolved = resolved.replace(/^\//, '');
                } catch (err) { resolved = href.replace(/^\.\.\//, contentPath('')).replace(/\.\.\//g, ''); }
                const lineMatch = href.match(/#L(\d+)$/);
                const lineNum = lineMatch ? parseInt(lineMatch[1]) : null;
                openExam(resolved, lineNum);
            });
        });

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

    /* =========================================================
       마크다운 로드 소스 (프로토콜별)
       ========================================================= */

    // '{contentRoot}/문제은행/과목1_문제은행.md' → '{dataRoot}/exams_md/과목1_문제은행.js'
    function _bundlePathFor(mdPath) {
        const stem = mdPath.split('/').pop().replace(/\.md$/i, '');
        return dataPath('exams_md/') + stem + '.js';
    }

    // 번들(전역 __EXAM_MD__)에서 마크다운 조회 — 없으면 해당 번들 스크립트를 주입 후 재조회
    async function _loadFromBundle(mdPath) {
        if (window.__EXAM_MD__ && typeof window.__EXAM_MD__[mdPath] === 'string') {
            return window.__EXAM_MD__[mdPath];
        }
        try {
            await injectBundleScript(_bundlePathFor(mdPath), 'data-exam-bundle');
        } catch (e) {
            throw new Error('문제집 번들을 찾을 수 없습니다. 터미널에서 `node tools/build/build_exam_bundles.js` 를 실행해 번들을 생성하세요.');
        }
        if (window.__EXAM_MD__ && typeof window.__EXAM_MD__[mdPath] === 'string') {
            return window.__EXAM_MD__[mdPath];
        }
        throw new Error('문제집 번들에 해당 문항이 없습니다. `node tools/build/build_exam_bundles.js` 로 다시 빌드하세요.');
    }

    // 프로토콜에 맞춰 마크다운 원문 확보
    async function _loadMd(mdPath) {
        // 'combo:N' — 복수정답형 드릴 데이터(자동 변환 + 수작업 파일럿)를
        // 문제집 MD로 런타임 직렬화. 별도 .md 산출물은 더 이상 없다.
        if (typeof mdPath === 'string' && mdPath.startsWith('combo:')) {
            const num = parseInt(mdPath.slice(6), 10);
            const questions = await DataLoader.loadComboDrills(num);
            if (!questions || !questions.length) {
                throw new Error('이 과목의 ㄱㄴㄷ 조합 문항이 없습니다.');
            }
            const subj = ((DataLoader.registry || {}).subjects || []).find(s => s.order === num);
            return buildComboSubjectMd(num, subj && subj.name, questions);
        }
        // file:// 은 fetch가 원천 차단되므로 곧장 번들 사용
        if (location.protocol === 'file:') {
            return _loadFromBundle(mdPath);
        }
        // http(s): 라이브 .md 우선(항상 최신), 실패하면 번들로 폴백
        try {
            return await fetchMd(mdPath);
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
    function _updateBackButton() {
        const overlayEl = _overlay.el();
        if (!overlayEl) return;
        const backBtn = overlayEl.querySelector('[data-exam-back]');
        if (backBtn) {
            backBtn.classList.toggle('is-hidden', _navStack.length === 0);
        }
    }

    function _goBack() {
        if (_navStack.length === 0) return;
        const prev = _navStack.pop();
        _currentMdPath = prev.mdPath;
        _openExamInternal(prev.mdPath, prev.lineNum, prev.scrollPos);
    }

    async function _openExamInternal(mdPath, lineNum, restoreScrollPos) {
        const title = _titleFromPath(mdPath);

        const cached = _cache.get(mdPath);
        if (cached) {
            _renderBody(title, cached.html, mdPath);
            _open();
            // 오버레이 표시 후 렌더 — mermaid 측정이 display:none 상태에서 부정확할 수 있음
            renderMermaidIn(_overlay.el().querySelector('#exam-article'), '[exam]');
            _updateBackButton();
            if (lineNum) {
                _scrollToLine(lineNum, cached.mdText);
                _hideResumeChip();
            } else if (restoreScrollPos != null) {
                const scroll = _overlay.el().querySelector('.exam-ov-scroll');
                if (scroll) scroll.scrollTop = restoreScrollPos;
                _hideResumeChip();
            } else {
                _maybeShowResumeChip(mdPath);
            }
            return;
        }

        _showLoading(title);

        try {
            const mdText = await _loadMd(mdPath);
            const bodyHtml = _mdToHtml(mdText, mdPath);
            _cache.set(mdPath, { html: bodyHtml, mdText: mdText || null });
            _renderBody(title, bodyHtml, mdPath);
            renderMermaidIn(_overlay.el().querySelector('#exam-article'), '[exam]');
            _updateBackButton();
            if (lineNum) {
                _scrollToLine(lineNum, mdText);
                _hideResumeChip();
            } else if (restoreScrollPos != null) {
                const scroll = _overlay.el().querySelector('.exam-ov-scroll');
                if (scroll) scroll.scrollTop = restoreScrollPos;
                _hideResumeChip();
            } else {
                _maybeShowResumeChip(mdPath);
            }
        } catch (err) {
            console.error('Exam load failed:', err);
            _showError(title, err && err.message ? err.message : String(err));
        }
    }

    async function openExam(mdPath, lineNum) {
        // 이미 열려있는 상태에서 다른 파일을 여는 경우 (인용 링크 클릭)
        // 현재 문서를 히스토리에 저장
        if (isOpen() && _currentMdPath && _currentMdPath !== mdPath) {
            const scroll = _overlay.el().querySelector('.exam-ov-scroll');
            const pos = scroll ? scroll.scrollTop : 0;
            _savePos(_currentMdPath, pos); // 나가는 문서도 이어보기 위치 기록
            _navStack.push({
                mdPath: _currentMdPath,
                lineNum: null,
                scrollPos: pos
            });
        }
        _currentMdPath = mdPath;
        await _openExamInternal(mdPath, lineNum);
    }

    // 복수정답형 문제집 — Pro 제공 예정 기능.
    // combo:N 가상 경로로 열어 _loadMd가 드릴 번들을 문서로 직렬화하게 한다.
    async function openCombo(subjectNum) {
        proFeatureNotice('combo_set', 'ㄱㄴㄷ 조합 문제집');
        const num = parseInt(subjectNum, 10);
        if (!Number.isFinite(num)) return;
        await openExam(`combo:${num}`);
    }

    /* =========================================================
       라인 스크롤 헬퍼 (LNN 링크용) — data-md-line 기반
       ========================================================= */
    function _scrollToLine(lineNum, mdText) {
        const el = _overlay.el();
        if (!el) return;
        const scroll = el.querySelector('.exam-ov-scroll');
        if (!scroll) return;

        const article = el.querySelector('#exam-article');
        if (!article) return;

        // 하이라이트 헬퍼
        function highlightElement(target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('exam-line-highlight');
            setTimeout(() => target.classList.remove('exam-line-highlight'), 5000);
        }

        // data-md-line 속성을 가진 요소들 수집
        const lineEls = article.querySelectorAll('[data-md-line]');
        if (lineEls.length === 0) {
            // 폴백: 비례 스크롤
            if (mdText) {
                const lines = mdText.replace(/\r\n/g, '\n').split('\n');
                const ratio = (lineNum - 1) / lines.length;
                scroll.scrollTop = scroll.scrollHeight * ratio;
            }
            return;
        }

        // lineNum에 가장 가까운 요소 찾기 (data-md-line <= lineNum 중 최대)
        let bestEl = null;
        let bestDiff = Infinity;

        // 정확히 일치하는 요소가 있으면 우선 선택
        for (const e of lineEls) {
            const elLine = parseInt(e.getAttribute('data-md-line'));
            if (elLine === lineNum) {
                bestEl = e;
                break;
            }
            const diff = lineNum - elLine;
            if (diff >= 0 && diff < bestDiff) {
                bestDiff = diff;
                bestEl = e;
            }
        }

        if (bestEl) {
            // 테이블 내부의 특정 행을 찾는 경우: 테이블 내에서 근접 행 찾기
            if (bestEl.classList.contains('reader-table-wrapper')) {
                // 테이블 행들 중에서 가장 가까운 행 찾기
                const rows = bestEl.querySelectorAll('tbody tr');
                if (rows.length > 0 && mdText) {
                    const tableStart = parseInt(bestEl.getAttribute('data-md-line'));
                    // 테이블 내에서 목표 라인과 가장 가까운 행 찾기
                    let bestRow = rows[0];
                    let minRowDiff = Infinity;
                    rows.forEach((row, idx) => {
                        // 각 행은 대략 1줄 (헤더 + 구분선 제외)
                        const rowLine = tableStart + idx + 2; // 헤더(1) + 구분선(1)
                        const diff = Math.abs(rowLine - lineNum);
                        if (diff < minRowDiff) {
                            minRowDiff = diff;
                            bestRow = row;
                        }
                    });
                    highlightElement(bestRow);
                    return;
                }
            }
            highlightElement(bestEl);
            return;
        }

        // 폴백: 비례 스크롤
        if (mdText) {
            const lines = mdText.replace(/\r\n/g, '\n').split('\n');
            const ratio = (lineNum - 1) / lines.length;
            scroll.scrollTop = scroll.scrollHeight * ratio;
        }
    }

    return {
        openExam,
        openCombo,
        close,
        isOpen,
        _mdToHtml,  // 테스트용 노출
        _clearCache: _cache.clear
    };
})();

// 전역 노출은 app.js에서 일괄 수행합니다.
