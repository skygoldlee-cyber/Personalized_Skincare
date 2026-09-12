// ui-utils.js - 로딩 오버레이 및 스피너 UI 유틸리티 (공통 모듈)

export function showLoading(containerId, message = '로딩 중...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--color-text-muted);">
            <div class="spinner" style="width: 40px; height: 40px; border: 3px solid var(--border-color); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
            <p>${message}</p>
        </div>
    `;
}

export function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const loading = container.querySelector('.loading-state');
    if (loading) {
        loading.remove();
    }
}

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
    document.getElementById('global-loading-message').textContent = message;
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

// 토스트 알림 (alert 대체)
let _toastTimer = null;
export function showToast(message, type = 'info', duration = 3000) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    // 타입별 아이콘/색상 (CSS 변수에서 읽기)
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
    const cssVars = { info: '--color-primary', success: '--color-success', warning: '--color-warning', error: '--color-danger' };
    const icon = icons[type] || icons.info;
    const colorVar = cssVars[type] || cssVars.info;
    const style = getComputedStyle(document.documentElement);
    const color = style.getPropertyValue(colorVar).trim();
    toast.innerHTML = `<i class="fa-solid ${icon}" style="color:${color}; margin-right:0.5rem;"></i>${escapeHtml(message)}`;
    toast.classList.add('is-visible');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
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
        requestAnimationFrame(() => {
            overlay.classList.add('is-visible');
            overlay.querySelector('.app-confirm-dialog').classList.add('is-visible');
        });

        const close = (result) => {
            overlay.classList.remove('is-visible');
            overlay.querySelector('.app-confirm-dialog').classList.remove('is-visible');
            setTimeout(() => {
                untrapFocus();
                overlay.remove();
            }, 200);
            resolve(result);
        };

        overlay.querySelector('.app-confirm-ok').addEventListener('click', () => close(true));
        overlay.querySelector('.app-confirm-cancel').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        // Escape 키로 취소
        const onKey = (e) => {
            if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
        };
        document.addEventListener('keydown', onKey);
        // 포커스 트랩 적용
        const untrapFocus = trapFocus(overlay.querySelector('.app-confirm-dialog'));
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

    const previouslyFocused = triggerEl || document.activeElement;

    // 첫 포커스 가능 요소로 초점 이동
    const focusables = modalEl.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
        focusables[0].focus();
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
        const first = currentFocusables[0];
        const last = currentFocusables[currentFocusables.length - 1];

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
