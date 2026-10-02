// views/reader-ref-links.js — 참조자료 링크 프리뷰·클릭 위임·원문 배지 갱신 (textbook-reader.js에서 분리)
// @spec TR-10,G-03,RR-02~06,RR-17,RR-19
// 역할: 호버/롱프레스 프리뷰 툴팁, data-ref-*/data-exam-md/data-glossary 클릭 위임(document 단일 리스너),
//       인라인 참조 링크의 law.go.kr 현행본 배지 갱신(refreshRefLinkNotices, RR-19).
//       (툴바 "참조자료" 드롭다운 패널은 2026-10 제거 — SPEC RR-07)
import { esc } from '../sanitize.js';
import { showToast } from '../ui-utils.js';
import { openHtmlViewer } from '../html-viewer.js';
import { scrollToGlossary } from './glossary-renderer.js';
import { ensureNoticeStatus, markStaleRefLinks } from '../notice-check.js';
import { TIMING } from '../config/timing.js';
import { openSubjectChapter } from './textbook-reader.js';

/**
 * 렌더된 인라인 참조 링크([data-law-url])의 원문 URL을 현행본으로 보정하고
 * 시행 예정 개정본 배지를 표시한다 (비동기 — 상태 파일 캐시됨).
 * 구 드롭다운 패널 렌더 시점에 묶여 있던 트리거를 본문 렌더 완료 시점으로 이전.
 */
export function refreshRefLinkNotices(root = document) {
    ensureNoticeStatus().then(() => markStaleRefLinks(root));
}

// --- 참조자료 인라인 프리뷰 (툴팁) ---
const _previewCache = {};
let _previewEl = null;
let _previewTimer = null;
let _previewTouchTimer = null;

function _ensurePreviewEl() {
    if (_previewEl) return _previewEl;
    _previewEl = document.createElement('div');
    _previewEl.id = 'ref-preview-tooltip';
    _previewEl.setAttribute('role', 'tooltip');
    _previewEl.classList.add('is-hidden');
    document.body.appendChild(_previewEl);
    return _previewEl;
}

async function _showPreview(linkEl) {
    const path = linkEl.dataset.refHtml;
    const search = linkEl.dataset.refSearch || '';
    if (!path) return;

    const el = _ensurePreviewEl();
    el.innerHTML = '<div style="opacity:0.6;">로딩 중...</div>';
    el.classList.remove('is-hidden');

    try {
        if (!_previewCache[path]) {
            const fileUrl = new URL(path, window.location.href).href;
            const resp = await fetch(fileUrl);
            const rawText = await resp.text();
            const isMd = path.endsWith('.md');
            let text;
            if (isMd) {
                text = rawText.replace(/^#{1,6}\s.*$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\|/g, ' ').trim();
            } else {
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawText, 'text/html');
                text = doc.body.textContent.replace(/\s+/g, ' ').trim();
            }
            _previewCache[path] = text;
        }

        const fullText = _previewCache[path];
        let snippet;
        if (search && search.length >= 2) {
            const idx = fullText.toLowerCase().indexOf(search.toLowerCase());
            if (idx >= 0) {
                const start = Math.max(0, idx - 60);
                snippet = (start > 0 ? '...' : '') + fullText.slice(start, idx + search.length + 120) + '...';
            } else {
                snippet = fullText.slice(0, 200) + '...';
            }
        } else {
            snippet = fullText.slice(0, 200) + '...';
        }

        const fileName = decodeURIComponent(path.split('/').pop().replace(/\.(html|md)$/, ''));
        el.innerHTML = `<div style="font-weight:600;margin-bottom:4px;color:var(--color-primary,#1f6feb);"><i class="fa-solid fa-file-lines"></i> ${esc(fileName)}</div><div style="white-space:pre-wrap;word-break:break-word;">${esc(snippet)}</div>`;
    } catch (err) {
        el.innerHTML = '<div style="opacity:0.6;">미리보기를 불러올 수 없습니다.</div>';
    }

    // Position tooltip near the link
    const rect = linkEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;
    if (top + elRect.height > window.innerHeight - 10) {
        top = Math.max(10, rect.top - elRect.height - 6);
    }
    if (left + elRect.width > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - elRect.width - 10);
    }
    el.style.top = top + 'px';
    el.style.left = left + 'px';
}

function _hidePreview() {
    if (_previewEl) _previewEl.classList.add('is-hidden');
}

let _refLinksDelegationInitialized = false;
function _initRefLinkDelegation() {
    if (_refLinksDelegationInitialized) return;
    _refLinksDelegationInitialized = true;
    // click 이벤트 위임: document에서 단일 리스너로 처리
    document.addEventListener('click', (e) => {
        // law.go.kr 원문 링크는 온라인 전용 — 오프라인이면 안내 후 차단
        const ext = /** @type {Element|null} */ (e.target)?.closest('a.ref-law-ext, a.comp-law-ext');
        if (ext && navigator.onLine === false) {
            e.preventDefault();
            showToast('공식 원문 보기는 온라인 연결이 필요합니다');
            return;
        }
        const a = /** @type {HTMLElement|null} */ ((/** @type {Element|null} */ (e.target))?.closest('[data-exam-md], [data-ref-md], [data-ref-html], [data-ref-subject], [data-glossary]'));
        if (!a) return;
        if (a.hasAttribute('data-exam-md')) {
            e.preventDefault();
            const mdPath = a.dataset.examMd;
            if (mdPath && window.ExamViewer && window.ExamViewer.openExam) {
                window.ExamViewer.openExam(mdPath);
            }
            return;
        }
        if (a.hasAttribute('data-ref-md')) {
            e.preventDefault();
            const mdPath = a.dataset.refMd;
            const lineNum = a.dataset.refLine ? parseInt(a.dataset.refLine) : null;
            if (window.ExamViewer && window.ExamViewer.openExam) {
                window.ExamViewer.openExam(mdPath, lineNum);
            }
            return;
        }
        if (a.hasAttribute('data-ref-html')) {
            e.preventDefault();
            clearTimeout(_previewTimer);
            clearTimeout(_previewTouchTimer);
            _hidePreview();
            const refHtmlPath = a.dataset.refHtml;
            const searchKeyword = a.dataset.refSearch || '';
            const anchorId = a.dataset.refAnchor || '';
            const lineNum = a.dataset.refLine || '';
            if (refHtmlPath) {
                openHtmlViewer(refHtmlPath, searchKeyword, anchorId, lineNum);
            }
            return;
        }
        if (a.hasAttribute('data-ref-subject')) {
            e.preventDefault();
            const targetSubject = a.dataset.refSubject;
            const targetChapter = a.dataset.refChapter || '';
            if (!targetSubject) return;
            openSubjectChapter(targetSubject, targetChapter);
            return;
        }
        if (a.hasAttribute('data-glossary')) {
            e.preventDefault();
            scrollToGlossary(a.dataset.glossary, a);
            return;
        }
    });
}

export function bindReferenceLinks() {
    // click 이벤트 위임 초기화 (1회만 등록)
    _initRefLinkDelegation();

    // 용어집 앵커 바인딩은 click 위임으로 처리되므로 별도 호출 불필요

    // HTML 뷰어 호버/터치 프리뷰 (mouseenter/mouseleave/touch는 위임 불가 → 가드 사용)
    document.querySelectorAll('[data-ref-html]:not([data-ref-bound])').forEach(a => {
        a.setAttribute('data-ref-bound', 'true');
        // 호버 프리뷰 (데스크톱)
        a.addEventListener('mouseenter', () => {
            clearTimeout(_previewTimer);
            _previewTimer = setTimeout(() => _showPreview(a), TIMING.PREVIEW_HOVER_MS);
        });
        a.addEventListener('mouseleave', () => {
            clearTimeout(_previewTimer);
            _hidePreview();
        });
        // 롱프레스 프리뷰 (모바일) — 시각적 힌트: 600ms 동안 링크를 활성화 스타일로 표시
        a.addEventListener('touchstart', () => {
            clearTimeout(_previewTouchTimer);
            a.classList.add('ref-longpress-active');
            _previewTouchTimer = setTimeout(() => {
                a.classList.remove('ref-longpress-active');
                _showPreview(a);
            }, TIMING.PREVIEW_LONG_PRESS_MS);
        }, { passive: true });
        a.addEventListener('touchend', () => {
            clearTimeout(_previewTouchTimer);
            a.classList.remove('ref-longpress-active');
            setTimeout(_hidePreview, TIMING.PREVIEW_HIDE_MS);
        }, { passive: true });
        a.addEventListener('touchmove', () => {
            clearTimeout(_previewTouchTimer);
            a.classList.remove('ref-longpress-active');
            _hidePreview();
        }, { passive: true });
    });
}
