/**
 * mermaid-render.js — Mermaid 지연 로딩 + 컨테이너 렌더링 + 다이어그램 확대 모달 공용 모듈.
 * textbook-reader.js와 textbook-search.js의 중복 구현을 통합한 것.
 */

// @spec TR-06~08,MV-02,TS-07,PF-13,PF-16
import { detectMermaidType, getMermaidClassName, getMermaidInitOptions } from './mermaid-utils.js';
import { PATHS } from './paths.js';
import { trapFocus } from './ui-utils.js';

let _mermaidLoadPromise = null;

/**
 * vendor/mermaid.min.js를 지연 로딩해 window.mermaid를 반환한다.
 * @returns {Promise<Object>}
 */
function ensureMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (_mermaidLoadPromise) return _mermaidLoadPromise;
    _mermaidLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PATHS.VENDOR_MERMAID;
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

/**
 * 컨테이너 내 pre.mermaid 노드를 순차 렌더링한다.
 * @param {HTMLElement|null} container
 * @param {string} logPrefix 로그 접두사 ('[reader]', '[search]' 등)
 */
export function renderMermaidIn(container, logPrefix = '[mermaid]') {
    const nodes = container ? container.querySelectorAll('pre.mermaid') : [];
    if (nodes.length === 0) return;
    ensureMermaid()
        .then((mermaid) => {
            try {
                const isLight = document.documentElement.classList.contains('light-theme');
                const nodeArr = Array.from(nodes);
                // 각 노드의 diagram 타입 감지하여 클래스 추가
                const nodeTypes = [];
                nodeArr.forEach(node => {
                    const type = detectMermaidType(node.textContent);
                    nodeTypes.push(type);
                    node.classList.add(getMermaidClassName(type));
                });
                let rendered = 0;
                let failed = 0;
                const renderNext = (i) => {
                    if (i >= nodeArr.length) {
                        if (failed > 0) console.warn(`${logPrefix} mermaid: ${rendered} rendered, ${failed} failed`);
                        return;
                    }
                    const node = nodeArr[i];
                    const type = nodeTypes[i];
                    mermaid.initialize(getMermaidInitOptions(type, isLight));
                    mermaid.run({ nodes: [node] })
                        .then(() => {
                            rendered++;
                            attachMermaidZoom(/** @type {HTMLElement} */ (node));
                            renderNext(i + 1);
                        })
                        .catch((e) => {
                            failed++;
                            console.warn(`${logPrefix} mermaid node ${i} failed:`, e?.message || e);
                            node.innerHTML = '<span style="color:var(--color-text-muted);font-size:0.8rem;">[다이어그램 렌더링 실패]</span>';
                            renderNext(i + 1);
                        });
                };
                renderNext(0);
            } catch (e) {
                console.warn(`${logPrefix} mermaid render failed:`, e);
            }
        })
        .catch((e) => console.warn(`${logPrefix} mermaid load failed:`, e));
}

/* =========================================================
   다이어그램 확대 모달 — 렌더된 Mermaid SVG를 전체 화면으로 표시
   본문의 pre.mermaid는 overflow-x:auto라 넓은 다이어그램이 잘려
   보이므로, 모달에서 양방향 스크롤 + 확대/축소를 제공한다.
   reader/search/manual 공용 — 모달은 첫 사용 시 document.body에 생성.
   ========================================================= */

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const ZOOM_DRAG_THRESHOLD = 10; // px — 스크롤 드래그와 탭 구분

/** @type {HTMLElement|null} */
let _zoomModal = null;
/** @type {(() => void)|null} */
let _zoomUntrap = null;
/** @type {{w:number,h:number}|null} */
let _zoomSvgSize = null;
/** @type {SVGSVGElement|null} */
let _zoomSvgEl = null;
let _zoomScale = 1;

/**
 * SVG의 고유 크기를 추정한다 (viewBox → width/height 속성 → 인라인 max-width 순).
 * @param {SVGSVGElement} svg
 * @returns {{w:number,h:number}|null}
 */
function _getSvgIntrinsicSize(svg) {
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
    const w = parseFloat(svg.getAttribute('width') || '');
    const h = parseFloat(svg.getAttribute('height') || '');
    if (w > 0 && h > 0 && !(svg.getAttribute('width') || '').includes('%')) {
        return { w, h };
    }
    const mw = parseFloat(svg.style?.maxWidth || '');
    if (mw > 0) return { w: mw, h: mw };
    return null;
}

/** 확대 모달 DOM을 1회 생성한다. @returns {HTMLElement} */
function _ensureZoomModal() {
    if (_zoomModal && _zoomModal.isConnected) return _zoomModal;
    const modal = document.createElement('div');
    modal.id = 'mermaid-zoom-modal';
    modal.className = 'reader-table-modal mermaid-zoom-modal is-hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', '다이어그램 확대 보기');
    modal.innerHTML = `
        <div class="reader-table-modal-backdrop"></div>
        <div class="reader-table-modal-content mermaid-zoom-content">
            <div class="mermaid-zoom-toolbar">
                <button type="button" id="mermaid-zoom-out" class="mermaid-zoom-btn" title="축소" aria-label="축소"><i class="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i></button>
                <span id="mermaid-zoom-level" class="mermaid-zoom-level">100%</span>
                <button type="button" id="mermaid-zoom-in" class="mermaid-zoom-btn" title="확대" aria-label="확대"><i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i></button>
                <button type="button" id="mermaid-zoom-fit" class="mermaid-zoom-btn" title="화면에 맞추기"><i class="fa-solid fa-expand" aria-hidden="true"></i> 맞춤</button>
            </div>
            <button type="button" class="reader-table-modal-close" id="mermaid-zoom-close" aria-label="다이어그램 확대 닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            <div id="mermaid-zoom-body" class="mermaid-zoom-body"></div>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.reader-table-modal-backdrop')?.addEventListener('click', closeMermaidZoom);
    modal.querySelector('#mermaid-zoom-close')?.addEventListener('click', closeMermaidZoom);
    modal.querySelector('#mermaid-zoom-in')?.addEventListener('click', () => _stepZoom(1));
    modal.querySelector('#mermaid-zoom-out')?.addEventListener('click', () => _stepZoom(-1));
    modal.querySelector('#mermaid-zoom-fit')?.addEventListener('click', () => _setZoom(_fitScale()));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && _zoomModal && !_zoomModal.classList.contains('is-hidden')) closeMermaidZoom();
    });
    _zoomModal = modal;
    return modal;
}

/** 모달 너비에 전체 다이어그램이 들어가는 배율 (작은 다이어그램은 확대하지 않음) */
function _fitScale() {
    const body = _zoomModal?.querySelector('#mermaid-zoom-body');
    if (!body || !_zoomSvgSize) return 1;
    const avail = Math.max(200, body.clientWidth - 8);
    return Math.min(1, avail / _zoomSvgSize.w);
}

/** @param {number} scale */
function _setZoom(scale) {
    _zoomScale = scale;
    if (_zoomSvgEl && _zoomSvgSize) {
        _zoomSvgEl.style.maxWidth = 'none';
        _zoomSvgEl.style.width = `${Math.round(_zoomSvgSize.w * scale)}px`;
        _zoomSvgEl.style.height = 'auto';
    }
    const label = _zoomModal?.querySelector('#mermaid-zoom-level');
    if (label) label.textContent = `${Math.round(scale * 100)}%`;
}

/** @param {1|-1} dir */
function _stepZoom(dir) {
    const next = dir > 0
        ? (ZOOM_STEPS.find(s => s > _zoomScale + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1])
        : ([...ZOOM_STEPS].reverse().find(s => s < _zoomScale - 0.001) ?? ZOOM_STEPS[0]);
    _setZoom(next);
}

/**
 * 렌더된 다이어그램을 확대 모달로 연다.
 * @param {HTMLElement} pre - svg가 렌더된 pre.mermaid 노드
 */
export function openMermaidZoom(pre) {
    const svg = pre && pre.querySelector ? pre.querySelector('svg') : null;
    if (!svg) return;
    const modal = _ensureZoomModal();
    const body = modal.querySelector('#mermaid-zoom-body');
    if (!body) return;
    body.innerHTML = '';
    body.scrollTop = 0;
    body.scrollLeft = 0;
    // pre를 얕게 복제해 mermaid-* 클래스를 유지 — 테마 색상 CSS(pre.mermaid-* 스코프)가 그대로 적용됨
    const stage = /** @type {HTMLElement} */ (pre.cloneNode(false));
    stage.classList.add('mermaid-zoom-stage');
    stage.removeAttribute('style');
    delete stage.dataset.mermaidZoomBound;
    const clone = /** @type {SVGSVGElement} */ (svg.cloneNode(true));
    clone.style.cursor = '';
    stage.appendChild(clone);
    body.appendChild(stage);
    _zoomSvgEl = clone;
    _zoomSvgSize = _getSvgIntrinsicSize(svg) || { w: 800, h: 400 };
    modal.classList.remove('is-hidden');
    _setZoom(_fitScale());
    if (_zoomUntrap) _zoomUntrap();
    _zoomUntrap = trapFocus(modal, /** @type {HTMLElement} */ (pre.querySelector('.mermaid-expand-btn')) || pre);
}

/** 확대 모달을 닫는다. */
export function closeMermaidZoom() {
    if (!_zoomModal) return;
    _zoomModal.classList.add('is-hidden');
    if (_zoomUntrap) {
        _zoomUntrap();
        _zoomUntrap = null;
    }
    _zoomSvgEl = null;
    _zoomSvgSize = null;
}

/**
 * 렌더 완료된 pre.mermaid에 확대 버튼과 클릭-확대를 바인딩한다.
 * @param {HTMLElement} pre
 */
export function attachMermaidZoom(pre) {
    if (!pre || pre.dataset.mermaidZoomBound) return;
    pre.dataset.mermaidZoomBound = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mermaid-expand-btn';
    btn.title = '다이어그램 확대';
    btn.setAttribute('aria-label', '다이어그램 확대');
    btn.innerHTML = '<i class="fa-solid fa-expand" aria-hidden="true"></i>';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMermaidZoom(pre);
    });
    pre.appendChild(btn);
    const svg = pre.querySelector('svg');
    if (svg) {
        svg.style.cursor = 'zoom-in';
        let downX = 0;
        let downY = 0;
        svg.addEventListener('pointerdown', (e) => {
            downX = e.clientX;
            downY = e.clientY;
        });
        svg.addEventListener('click', (e) => {
            if (Math.hypot(e.clientX - downX, e.clientY - downY) < ZOOM_DRAG_THRESHOLD) {
                openMermaidZoom(pre);
            }
        });
    }
}
