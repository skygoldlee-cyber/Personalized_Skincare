// src/image-zoom.js — 교재 본문 이미지(.reader-img) 라이트박스 확대 모달.
// @spec TR-20
// reader-table-modal 셸 + mermaid-zoom 툴바 CSS를 재사용한다 (mermaid-render.js의
// 다이어그램 확대 모달과 동일한 UX: 배율 단계·맞춤·드래그 스크롤·Esc/백드롭 닫기).
// 모달은 role="dialog"이므로 modal-back.js가 뒤로가기 닫기를 자동 감지한다.

import { trapFocus } from './ui-utils.js';

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const ZOOM_DRAG_THRESHOLD = 10; // px — 스크롤 드래그와 탭 구분

/** @type {HTMLElement|null} */
let _imgZoomModal = null;
/** @type {(() => void)|null} */
let _imgZoomUntrap = null;
/** @type {HTMLImageElement|null} */
let _zoomImgEl = null;
let _imgNaturalW = 0;
let _imgZoomScale = 1;

/** 확대 모달 DOM을 1회 생성한다. @returns {HTMLElement} */
function _ensureImgZoomModal() {
    if (_imgZoomModal && _imgZoomModal.isConnected) return _imgZoomModal;
    const modal = document.createElement('div');
    modal.id = 'reader-img-zoom-modal';
    modal.className = 'reader-table-modal mermaid-zoom-modal is-hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', '이미지 확대 보기');
    modal.innerHTML = `
        <div class="reader-table-modal-backdrop"></div>
        <div class="reader-table-modal-content mermaid-zoom-content">
            <div class="mermaid-zoom-toolbar">
                <button type="button" id="img-zoom-out" class="mermaid-zoom-btn" title="축소" aria-label="축소"><i class="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i></button>
                <span id="img-zoom-level" class="mermaid-zoom-level">100%</span>
                <button type="button" id="img-zoom-in" class="mermaid-zoom-btn" title="확대" aria-label="확대"><i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i></button>
                <button type="button" id="img-zoom-fit" class="mermaid-zoom-btn" title="화면에 맞추기"><i class="fa-solid fa-expand" aria-hidden="true"></i> 맞춤</button>
            </div>
            <button type="button" class="reader-table-modal-close" id="img-zoom-close" aria-label="이미지 확대 닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            <div id="img-zoom-body" class="mermaid-zoom-body img-zoom-body"></div>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.reader-table-modal-backdrop')?.addEventListener('click', closeImageZoom);
    modal.querySelector('#img-zoom-close')?.addEventListener('click', closeImageZoom);
    modal.querySelector('#img-zoom-in')?.addEventListener('click', () => _stepImgZoom(1));
    modal.querySelector('#img-zoom-out')?.addEventListener('click', () => _stepImgZoom(-1));
    modal.querySelector('#img-zoom-fit')?.addEventListener('click', () => _setImgZoom(_fitImgScale()));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && _imgZoomModal && !_imgZoomModal.classList.contains('is-hidden')) closeImageZoom();
    });
    _imgZoomModal = modal;
    return modal;
}

/** 모달 너비에 이미지 전체가 들어가는 배율 (작은 이미지는 확대하지 않음) */
function _fitImgScale() {
    const body = _imgZoomModal?.querySelector('#img-zoom-body');
    if (!body || !_imgNaturalW) return 1;
    const avail = Math.max(200, body.clientWidth - 8);
    return Math.min(1, avail / _imgNaturalW);
}

/** @param {number} scale */
function _setImgZoom(scale) {
    _imgZoomScale = scale;
    if (_zoomImgEl && _imgNaturalW) {
        _zoomImgEl.style.maxWidth = 'none';
        _zoomImgEl.style.width = `${Math.round(_imgNaturalW * scale)}px`;
        _zoomImgEl.style.height = 'auto';
    }
    const label = _imgZoomModal?.querySelector('#img-zoom-level');
    if (label) label.textContent = `${Math.round(scale * 100)}%`;
}

/** @param {1|-1} dir */
function _stepImgZoom(dir) {
    const next = dir > 0
        ? (ZOOM_STEPS.find(s => s > _imgZoomScale + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1])
        : ([...ZOOM_STEPS].reverse().find(s => s < _imgZoomScale - 0.001) ?? ZOOM_STEPS[0]);
    _setImgZoom(next);
}

/**
 * 본문 이미지를 확대 모달로 연다.
 * @param {HTMLImageElement} img - 클릭된 .reader-img 요소
 */
export function openImageZoom(img) {
    if (!img || !img.src) return;
    const modal = _ensureImgZoomModal();
    const body = modal.querySelector('#img-zoom-body');
    if (!body) return;
    body.innerHTML = '';
    body.scrollTop = 0;
    body.scrollLeft = 0;
    const clone = /** @type {HTMLImageElement} */ (img.cloneNode(false));
    clone.className = 'img-zoom-target';
    clone.removeAttribute('loading');
    _imgNaturalW = img.naturalWidth || img.width || 800;
    // 지연 로딩 등으로 naturalWidth를 아직 모르면 로드 완료 시 재보정
    if (!img.naturalWidth) {
        clone.addEventListener('load', () => {
            if (clone.naturalWidth) {
                _imgNaturalW = clone.naturalWidth;
                _setImgZoom(_imgZoomScale);
            }
        }, { once: true });
    }
    body.appendChild(clone);
    _zoomImgEl = clone;
    modal.classList.remove('is-hidden');
    _setImgZoom(_fitImgScale());
    if (_imgZoomUntrap) _imgZoomUntrap();
    _imgZoomUntrap = trapFocus(modal, img);
}

/** 확대 모달을 닫는다. */
export function closeImageZoom() {
    if (!_imgZoomModal) return;
    _imgZoomModal.classList.add('is-hidden');
    if (_imgZoomUntrap) {
        _imgZoomUntrap();
        _imgZoomUntrap = null;
    }
    _zoomImgEl = null;
    _imgNaturalW = 0;
}

/**
 * 컨테이너 내 .reader-img 클릭 → 확대 모달 바인딩 (이벤트 위임, 1회 바인딩).
 * 리렌더로 자식이 교체돼도 컨테이너 위임이라 유효하다.
 * @param {HTMLElement} root - 렌더 컨테이너
 */
export function attachImageZoomIn(root) {
    if (!root || root.dataset.imgZoomBound) return;
    root.dataset.imgZoomBound = '1';
    let downX = 0;
    let downY = 0;
    root.addEventListener('pointerdown', (e) => {
        downX = e.clientX;
        downY = e.clientY;
    });
    root.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const img = target && target.closest ? target.closest('img.reader-img') : null;
        if (!img || !root.contains(img)) return;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) >= ZOOM_DRAG_THRESHOLD) return;
        openImageZoom(/** @type {HTMLImageElement} */ (img));
    });
}
