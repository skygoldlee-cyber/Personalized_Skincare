// src/doc-overlay.js — MD 문서 전체화면 오버레이 공용 베이스
// @spec EV-01~08, MV-01~04
// exam-viewer.js(문제집)·manual-viewer.js(매뉴얼)의 병렬 구현에서 추출한 공통부:
//   - 세션 캐시(TTL·LRU 옵션) · 번들 <script> 주입 · TOC 생성/마운트 · 오버레이 셸 수명주기
// html-viewer.js는 셸·검색 모델이 달라 오버레이 베이스 대상이 아니지만,
// 세션 캐시는 makeSessionCache의 maxEntries(LRU) 옵션을 공유한다.
import { escapeHTML } from './sanitize.js';

/**
 * sessionStorage TTL 캐시. payload는 호출자가 결정 ({ html, mdText? } 등).
 * opts.maxEntries > 0이면 LRU 한도 — 최근 사용 키가 맨 뒤, 초과 시 가장
 * 오래된 항목을 제거한다. LRU 순서는 '<prefix>__lru_order__' 키에 영속화
 * (get에서는 메모리만 갱신, set에서만 저장 — 쓰기 빈도 절약).
 * @param {string} prefix - 캐시 키 접두사 (버전 태그 포함 권장)
 * @param {number} ttl - 유효 시간(ms)
 * @param {{ maxEntries?: number }} [opts]
 */
export function makeSessionCache(prefix, ttl, { maxEntries = 0 } = {}) {
    const keyOf = (id) => prefix + String(id).replace(/[^a-zA-Z0-9]/g, '_');
    const orderKey = prefix + '__lru_order__';
    let _order = null; // LRU 키 순서 (null = sessionStorage 미복원)

    function _loadOrder() {
        if (_order !== null) return;
        _order = [];
        try {
            const raw = sessionStorage.getItem(orderKey);
            if (raw) _order = JSON.parse(raw) || [];
        } catch (e) { /* noop */ }
    }
    function _saveOrder() {
        try { sessionStorage.setItem(orderKey, JSON.stringify(_order)); } catch (e) { /* noop */ }
    }
    function _touch(k) {
        const i = _order.indexOf(k);
        if (i >= 0) _order.splice(i, 1);
        _order.push(k);
    }
    function _evict() {
        while (_order.length > maxEntries) {
            const oldest = _order.shift();
            try { sessionStorage.removeItem(oldest); } catch (e) { /* noop */ }
        }
    }

    return {
        get(id) {
            const k = keyOf(id);
            try {
                const raw = sessionStorage.getItem(k);
                if (!raw) return null;
                const entry = JSON.parse(raw);
                if (Date.now() - entry.timestamp > ttl) {
                    sessionStorage.removeItem(k);
                    return null;
                }
                if (maxEntries) { _loadOrder(); _touch(k); }
                return entry;
            } catch (e) {
                return null;
            }
        },
        set(id, payload) {
            const k = keyOf(id);
            try {
                if (maxEntries) { _loadOrder(); _touch(k); _evict(); }
                sessionStorage.setItem(k, JSON.stringify({ timestamp: Date.now(), ...payload }));
                if (maxEntries) _saveOrder();
            } catch (e) {
                // QuotaExceededError 등은 무시 (다음에 재변환)
            }
        },
        clear() {
            const keys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith(prefix)) keys.push(k);
            }
            keys.forEach(k => sessionStorage.removeItem(k));
            if (_order) { _order = []; }
        }
    };
}

/**
 * 클래식 <script> 동적 주입 (file:// 에서도 동작). 같은 src는 재사용하며
 * dataset.loaded 상태로 중복 주입·실패를 추적한다.
 * @param {string} src - 스크립트 URL
 * @param {string} datasetAttr - 추적용 data-* 속성명 전체 (예: 'data-exam-bundle')
 * @returns {Promise<void>}
 */
export function injectBundleScript(src, datasetAttr) {
    return /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
        const existing = /** @type {HTMLElement|null} */ (document.querySelector(`script[${datasetAttr}="${src}"]`));
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
        s.setAttribute(datasetAttr, src);
        s.dataset.loaded = 'false';
        s.addEventListener('load', () => { s.dataset.loaded = 'true'; resolve(); });
        s.addEventListener('error', () => { s.dataset.loaded = 'error'; reject(new Error('bundle load error: ' + src)); });
        document.head.appendChild(s);
    }));
}

/**
 * http(s) 라이브 MD fetch (캐시 우회). 실패 시 호출자가 번들 폴백을 결정한다.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchMd(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.text();
}

/**
 * 본문 h2/h3에서 목차(details) HTML 생성.
 * @param {HTMLElement} article
 * @param {{ idPrefix: string, jumpAttr: string, tocClass: string }} opts
 *   jumpAttr: 'exam-jump'|'manual-jump' → data-<jumpAttr> 속성으로 점프 타겟 식별
 */
export function buildTocHtml(article, { idPrefix, jumpAttr, tocClass }) {
    const headings = article.querySelectorAll('h2, h3');
    if (headings.length === 0) return '';
    let items = '';
    headings.forEach((h, idx) => {
        if (!h.id) h.id = idPrefix + idx;
        const depth = h.tagName === 'H3' ? 'depth-3' : 'depth-2';
        const label = h.textContent.replace(/🔖기출|📌중요/g, '').trim();
        items += `<a href="#${h.id}" class="${depth}" data-${jumpAttr}="${h.id}">${escapeHTML(label)}</a>`;
    });
    return `<details class="${tocClass}"><summary><i class="fa-solid fa-list"></i> 목차</summary>${items}</details>`;
}

/**
 * 기존 TOC를 제거하고 새 TOC를 본문 앞에 삽입 + 점프 클릭 핸들러 부착.
 * @param {HTMLElement} scroll - 오버레이 스크롤 컨테이너
 * @param {HTMLElement} article - 본문 요소
 * @param {string} tocHtml - buildTocHtml 결과 (''이면 제거만)
 * @param {{ tocClass: string, jumpAttr: string }} opts
 */
export function mountToc(scroll, article, tocHtml, { tocClass, jumpAttr }) {
    const oldToc = scroll.querySelector('.' + tocClass);
    if (oldToc) oldToc.remove();
    if (!tocHtml) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = tocHtml;
    const toc = wrap.firstElementChild;
    if (!toc) return;
    scroll.insertBefore(toc, article);
    toc.addEventListener('click', (e) => {
        const a = e.target instanceof Element ? e.target.closest(`[data-${jumpAttr}]`) : null;
        if (!a) return;
        e.preventDefault();
        const jumpId = a.getAttribute(`data-${jumpAttr}`);
        const target = jumpId ? document.getElementById(jumpId) : null;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

/**
 * 전체화면 문서 오버레이 셸 수명주기 팩토리.
 * open: 스타일 주입·DOM 생성·body 잠금 클래스·Escape/popstate·히스토리 마커 push.
 * close: 역순 해제 + history.back() 복원. onClose 훅은 클래스 해제 전에 호출된다
 *        (스크롤 위치 저장 등 뷰어별 정리용).
 * @param {{
 *   id: string, styleId: string, css: string, innerHTML: string,
 *   ariaLabel?: string, bodyClass: string, historyMarker: string,
 *   popstateGuardMs?: number, wire?: (el: HTMLElement) => void,
 *   onClose?: (el: HTMLElement) => void
 * }} cfg
 */
export function createDocOverlay({ id, styleId, css, innerHTML, ariaLabel, bodyClass, historyMarker, popstateGuardMs = 0, wire, onClose }) {
    let _overlayEl = null;
    let _historyPushed = false;
    let _openTimestamp = 0;

    function injectStylesOnce() {
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    function ensure() {
        if (_overlayEl) return _overlayEl;
        injectStylesOnce();
        const el = document.createElement('div');
        el.id = id;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
        el.innerHTML = innerHTML;
        document.body.appendChild(el);
        _overlayEl = el;
        if (wire) wire(el);
        return el;
    }

    function _onKeydown(e) { if (e.key === 'Escape') close(); }
    function _onPopstate() {
        if (!isOpen()) return;
        // _open() 직후 발생하는 popstate(잔류 해시 변경 등) 무시
        if (popstateGuardMs && Date.now() - _openTimestamp < popstateGuardMs) return;
        close(true);
    }

    function open() {
        const el = ensure();
        if (!el.classList.contains('open')) {
            el.classList.add('open');
            document.body.classList.add(bodyClass);
            document.addEventListener('keydown', _onKeydown);
            window.addEventListener('popstate', _onPopstate);
            _openTimestamp = Date.now();
            // 안드로이드 뒤로가기 / 스와이프로 닫히도록 히스토리 상태 추가
            try { history.pushState({ [historyMarker]: true }, ''); _historyPushed = true; }
            catch (e) { _historyPushed = false; }
        }
    }

    function isOpen() {
        return !!(_overlayEl && _overlayEl.classList.contains('open'));
    }

    function close(fromPopstate) {
        if (!_overlayEl) return;
        if (onClose) onClose(_overlayEl);
        _overlayEl.classList.remove('open');
        document.body.classList.remove(bodyClass);
        document.removeEventListener('keydown', _onKeydown);
        window.removeEventListener('popstate', _onPopstate);
        if (_historyPushed && !fromPopstate) {
            _historyPushed = false;
            try { history.back(); } catch (e) { /* noop */ }
        } else {
            _historyPushed = false;
        }
    }

    return { ensure, open, close, isOpen, el: () => _overlayEl };
}
