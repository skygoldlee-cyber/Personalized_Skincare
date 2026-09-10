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
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(11, 15, 25, 0.7);
            backdrop-filter: blur(5px);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            transition: opacity 0.2s ease;
        `;
        overlay.innerHTML = `
            <div class="spinner" style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1.25rem;"></div>
            <p id="global-loading-message" style="font-weight: 600; font-size: 1.05rem; margin: 0;"></p>
        `;
        document.body.appendChild(overlay);
    }
    document.getElementById('global-loading-message').textContent = message;
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
}

export function hideGlobalLoading() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 200);
    }
}

// 스피너 애니메이션을 위한 CSS 추가
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(spinnerStyle);

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
        toast.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.9);
            background: rgba(15, 23, 42, 0.95); color: #fff; padding: 1rem 1.5rem;
            border-radius: 12px; font-size: 0.95rem; font-weight: 500; z-index: 99998;
            border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease;
            pointer-events: none; max-width: 90vw; text-align: center; line-height: 1.5;
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        `;
        document.body.appendChild(toast);
    }
    // 타입별 아이콘/색상
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
    const colors = { info: '#06b6d4', success: '#10b981', warning: '#f59e0b', error: '#ef4444' };
    const icon = icons[type] || icons.info;
    const color = colors[type] || colors.info;
    toast.innerHTML = `<i class="fa-solid ${icon}" style="color:${color}; margin-right:0.5rem;"></i>${escapeHtml(message)}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, -50%) scale(1)';
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -50%) scale(0.9)';
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
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99997;
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.2s ease;
            backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
        `;
        overlay.innerHTML = `
            <div class="app-confirm-dialog" style="
                background: var(--bg-card, #1a1a2e); border: 1px solid var(--border-color, rgba(255,255,255,0.1));
                border-radius: 16px; padding: 1.5rem; max-width: 400px; width: 90vw;
                box-shadow: 0 16px 48px rgba(0,0,0,0.4); transform: scale(0.95);
                transition: transform 0.2s ease;
            ">
                <h3 style="margin:0 0 0.75rem; font-size:1.1rem; font-weight:700; color:var(--color-text-main,#fff);">${escapeHtml(title)}</h3>
                <p style="margin:0 0 1.5rem; font-size:0.95rem; color:var(--color-text-muted,#9ca3af); line-height:1.6; white-space:pre-wrap;">${escapeHtml(message)}</p>
                <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
                    <button class="app-confirm-cancel" style="
                        padding:0.65rem 1.5rem; border:1px solid var(--border-color,rgba(255,255,255,0.15));
                        background:transparent; color:var(--color-text-muted,#9ca3af); border-radius:8px;
                        font-size:0.9rem; font-weight:600; cursor:pointer; min-height:44px; min-width:80px;
                        font-family: inherit;
                    ">취소</button>
                    <button class="app-confirm-ok" style="
                        padding:0.65rem 1.5rem; border:none;
                        background:linear-gradient(135deg, var(--color-primary,#06b6d4), var(--color-secondary,#8b5cf6));
                        color:#fff; border-radius:8px; font-size:0.9rem; font-weight:600; cursor:pointer;
                        min-height:44px; min-width:80px; font-family: inherit;
                    ">확인</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        // 애니메이션
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.querySelector('.app-confirm-dialog').style.transform = 'scale(1)';
        });

        const close = (result) => {
            overlay.style.opacity = '0';
            overlay.querySelector('.app-confirm-dialog').style.transform = 'scale(0.95)';
            setTimeout(() => overlay.remove(), 200);
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
        // 포커스
        overlay.querySelector('.app-confirm-ok').focus();
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
