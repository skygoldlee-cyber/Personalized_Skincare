// ui-utils.js - 로딩 오버레이 및 스피너 UI 유틸리티 (공통 모듈)
// @spec A-07,UX-FB-01~04

export function showGlobalLoading(message = '로딩 중...') {
    let overlay = document.getElementById('global-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-loading-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <p id="global-loading-message"></p>
        `;
        document.body.appendChild(overlay);
    }
    const msgEl = document.getElementById('global-loading-message');
    if (msgEl) msgEl.textContent = message;
    overlay.classList.add('is-visible');
}

export function hideGlobalLoading() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) {
        overlay.classList.remove('is-visible');
        setTimeout(() => {
            overlay.classList.add('is-hidden');
        }, 200);
    }
}

// 스피너 애니메이션(@keyframes spin)은 css/ui-overlay.css에 정의됨

/* =========================================================
   햅틱 피드백 (모바일 정답/오답 진동)
   ========================================================= */
export function vibrate(pattern) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(pattern); } catch (_) { /* no-op */ }
    }
}
export const HAPTIC = { correct: 30, wrong: [40, 30, 40], tap: 10 };

/* =========================================================
   B1: 커스텀 토스트 및 컨펌 모달 — alert/confirm 대체
   ========================================================= */

// 토스트 알림 (alert 대체) — #app-toast 스택에 최대 3개까지 쌓아 연속 알림 유실 방지
const MAX_TOASTS = 3;
export function showToast(message, type = 'info', duration, iconClass = '') {
    // 성공 토스트는 화면 변화와 확인이 중복되므로 기본 노출을 짧게 — 알림 피로 완화
    if (duration === undefined) duration = type === 'success' ? 2000 : 3000;
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    // 스택 상한 — 초과 시 가장 오래된 항목부터 제거
    while (toast.children.length >= MAX_TOASTS) {
        toast.firstElementChild?.remove();
    }
    // 타입별 아이콘/색상 (CSS 변수에서 읽기)
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
    const cssVars = { info: '--color-primary', success: '--color-success', warning: '--color-warning', error: '--color-danger' };
    const icon = iconClass || icons[type] || icons.info;
    const colorVar = cssVars[type] || cssVars.info;
    const style = getComputedStyle(document.documentElement);
    const color = style.getPropertyValue(colorVar).trim();
    const item = document.createElement('div');
    item.className = 'app-toast-item is-visible';
    item.innerHTML = `<i class="fa-solid ${escapeHtml(icon)}" style="color:${color}; margin-right:0.5rem;"></i>${escapeHtml(message)}`;
    toast.appendChild(item);
    toast.classList.add('is-visible');
    setTimeout(() => {
        item.classList.remove('is-visible');
        setTimeout(() => {
            item.remove();
            if (!toast.children.length) toast.classList.remove('is-visible');
        }, 250);
    }, duration);
}

// 컨펌 모달 (confirm 대체) — Promise 반환
export function showConfirm(message, title = '확인') {
    return new Promise((resolve) => {
        // 기존 모달 제거
        const existing = document.getElementById('app-confirm-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'app-confirm-overlay';
        overlay.innerHTML = `
            <div class="app-confirm-dialog">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
                <div class="app-confirm-actions">
                    <button class="app-confirm-cancel">취소</button>
                    <button class="app-confirm-ok">확인</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        // 애니메이션
        const dialog = /** @type {HTMLElement} */ (overlay.querySelector('.app-confirm-dialog'));
        requestAnimationFrame(() => {
            overlay.classList.add('is-visible');
            dialog.classList.add('is-visible');
        });

        const close = (result) => {
            overlay.classList.remove('is-visible');
            dialog.classList.remove('is-visible');
            setTimeout(() => {
                untrapFocus();
                overlay.remove();
            }, 200);
            resolve(result);
        };

        overlay.querySelector('.app-confirm-ok')?.addEventListener('click', () => close(true));
        overlay.querySelector('.app-confirm-cancel')?.addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        // Escape 키로 취소
        const onKey = (e) => {
            if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
        };
        document.addEventListener('keydown', onKey);
        // 포커스 트랩 적용
        const untrapFocus = trapFocus(dialog);
    });
}

// 알림 모달 (alert 대체) — 확인 버튼만 있는 단일 공지용, Promise 반환
export function showAlert(message, title = '알림') {
    return new Promise((resolve) => {
        const existing = document.getElementById('app-confirm-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'app-confirm-overlay';
        overlay.innerHTML = `
            <div class="app-confirm-dialog">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
                <div class="app-confirm-actions">
                    <button class="app-confirm-ok">확인</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const dialog = /** @type {HTMLElement} */ (overlay.querySelector('.app-confirm-dialog'));
        requestAnimationFrame(() => {
            overlay.classList.add('is-visible');
            dialog.classList.add('is-visible');
        });

        const untrapFocus = trapFocus(dialog);
        const close = () => {
            overlay.classList.remove('is-visible');
            dialog.classList.remove('is-visible');
            setTimeout(() => {
                untrapFocus();
                overlay.remove();
            }, 200);
            resolve(true);
        };

        overlay.querySelector('.app-confirm-ok')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        const onKey = (e) => {
            if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
        };
        document.addEventListener('keydown', onKey);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/* =========================================================
   B2: 모달 포커스 트랩 유틸리티 (접근성)
   ========================================================= */

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 모달 내 포커스를 트랩하고, 닫힐 때 초점을 반환.
 * @param {HTMLElement} modalEl - 포커스를 트랩할 모달 컨테이너
 * @param {HTMLElement} [triggerEl] - 모달을 열은 트리거 요소 (닫힐 때 초점 반환)
 * @returns {() => void} trap 해제 함수 (모달 닫힐 때 호출)
 */
export function trapFocus(modalEl, triggerEl) {
    if (!modalEl) return () => {};

    /** @type {HTMLElement|null} */
    const previouslyFocused = triggerEl || /** @type {HTMLElement|null} */ (document.activeElement);

    // 첫 포커스 가능 요소로 초점 이동
    const focusables = modalEl.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
        /** @type {HTMLElement} */ (focusables[0]).focus();
    } else {
        modalEl.setAttribute('tabindex', '-1');
        modalEl.focus();
    }

    const onKeydown = (e) => {
        if (e.key !== 'Tab') return;
        const currentFocusables = modalEl.querySelectorAll(FOCUSABLE_SELECTOR);
        if (currentFocusables.length === 0) {
            e.preventDefault();
            return;
        }
        const first = /** @type {HTMLElement} */ (currentFocusables[0]);
        const last = /** @type {HTMLElement} */ (currentFocusables[currentFocusables.length - 1]);

        if (e.shiftKey) {
            if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    modalEl.addEventListener('keydown', onKeydown);

    // 해제 함수: 이벤트 리스너 제거 + 초점 반환
    return () => {
        modalEl.removeEventListener('keydown', onKeydown);
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
            previouslyFocused.focus();
        }
    };
}
