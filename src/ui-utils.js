// ui-utils.js - 로딩 오버레이 및 스피너 UI 유틸리티 (공통 모듈)
// @spec A-07,UX-FB-01~04

import { escapeHTML, safeTextWithBreaks } from './sanitize.js';

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

/**
 * 객관식(.limits-opt-btn) 채점 표시 — 전 버튼 비활성 + 정답 버튼 강조 + 오답 선택 표시.
 * 버튼은 dataset.value에 비교값을 보유해야 한다 — 표시 텍스트 부분일치는
 * '5'가 '50'에도 걸리는 오매칭 버그가 있어 값 비교로 통일한다.
 * @param {ParentNode|null} container - 선택지 버튼 컨테이너
 * @param {HTMLButtonElement} selectedBtn - 사용자가 선택한 버튼
 * @param {string} correctValue - 정답 값
 */
export function markChoiceButtons(container, selectedBtn, correctValue) {
    if (!container) return;
    container.querySelectorAll('.limits-opt-btn').forEach(node => {
        const btn = /** @type {HTMLButtonElement} */ (node);
        btn.disabled = true;
        if (btn.dataset.value === correctValue) btn.classList.add('correct');
    });
    if (selectedBtn && selectedBtn.dataset.value !== correctValue) {
        selectedBtn.classList.add('incorrect');
    }
}

/**
 * 오답 리뷰 목록 HTML — 전부 정답이면 완료 문구, 아니면 문항별 카드 목록.
 * 항목은 {question, selected, correctAnswer} 형태 (훈련소·퀴즈 결과 공용).
 * @param {Array<{question:string, selected:string, correctAnswer:string}>} wrongAnswers
 * @param {(item:object, idx:number)=>string} [renderItem] 문항별 카드 HTML 커스텀 렌더러
 * @returns {string}
 */
export function wrongReviewHtml(wrongAnswers, renderItem) {
    if (!wrongAnswers.length) {
        return '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 문제를 맞혔습니다!</p>';
    }
    const item = renderItem || ((s, idx) => `
        <div style="padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
            <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:0.3rem;">Q${idx + 1}</div>
            <p style="font-size:0.9rem; margin-bottom:0.4rem;">${safeTextWithBreaks(s.question)}</p>
            <p style="font-size:0.85rem; color:var(--color-danger);">내 답: ${escapeHTML(s.selected)}</p>
            <p style="font-size:0.85rem; color:var(--color-success);">정답: <strong>${escapeHTML(s.correctAnswer)}</strong></p>
        </div>`);
    return `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오답 리뷰 (${wrongAnswers.length}문제)</h3>`
        + wrongAnswers.map((s, idx) => item(s, idx)).join('');
}

/**
 * 훈련소 세션 결과 패널 HTML — 헤더(제목+배지) + 트로피 + 점수 요약 + 오답 리뷰 + 액션.
 * @param {object} o
 * @param {string} [o.headerTitle] 헤더 제목 (header 생략 시 필수)
 * @param {string} [o.badge] 헤더 배지 라벨 (header 생략 시 필수)
 * @param {string} o.doneTitle 완료 제목 (예: "훈련 완료!")
 * @param {number} o.correct 정답 수
 * @param {number} o.total 총 문항 수
 * @param {string} o.reviewHTML 오답 리뷰 HTML (wrongReviewHtml 결과)
 * @param {string} o.retryClick 다시 풀기 data-click 핸들러명
 * @param {string} [o.retryArg] 다시 풀기 버튼 data-arg 값
 * @param {string} [o.retryLabel] 다시 풀기 버튼 라벨 (기본 "다시 풀기")
 * @param {string} [o.extraActions] 추가 액션 버튼 HTML (메뉴 버튼 앞)
 * @param {string} [o.statLine] 점수 아래 보조 통계 문구
 * @param {string} [o.header] 헤더 블록 HTML (생략 시 sim-arena-header + 제목/배지)
 * @returns {string}
 */
export function trainerResultHtml({ headerTitle, badge, doneTitle, correct, total, reviewHTML, retryClick, retryArg = '', retryLabel = '다시 풀기', extraActions = '', statLine = '', header }) {
    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
    const headerBlock = header !== undefined ? header : `
        <div class="sim-arena-header" style="margin-bottom: 2rem;">
            <button class="btn btn-secondary" data-click="exitTrainerSubView" title="훈련소 메뉴로 돌아가기"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
            <div class="sim-title-group">
                <h4>${headerTitle}</h4>
                <span class="badge badge-quiz-cat">${badge}</span>
            </div>
        </div>`;
    return `${headerBlock}
        <div class="trainer-arena" style="text-align:center;">
            <i class="fa-solid fa-trophy trophy-icon"></i>
            <h2>${doneTitle}</h2>
            <p class="result-score-summary">정답수: <strong>${correct}</strong> / ${total} (${rate}%)</p>
            ${statLine ? `<p style="color:var(--color-text-muted); font-size:0.85rem;">${statLine}</p>` : ''}
            <div style="text-align:left; margin:1.5rem 0; max-width:600px; margin-left:auto; margin-right:auto;">${reviewHTML}</div>
            <div class="result-actions" style="display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;">
                <button class="btn btn-primary" data-click="${retryClick}"${retryArg ? ` data-arg="${retryArg}"` : ''}><i class="fa-solid fa-rotate-left"></i> ${retryLabel}</button>
                ${extraActions}
                <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-house"></i> 메뉴로</button>
            </div>
        </div>`;
}

/**
 * 채점 피드백 패널 표시 — 패널 노출 + incorrect 클래스 + 제목/설명 + 다음 버튼.
 * (훈련소·데일리 챌린지 공용; titleHtml/descHtml은 호출부에서 esc 처리된 HTML)
 * @param {object} o
 * @param {string} o.panelId 피드백 패널 요소 id
 * @param {string} o.titleId 피드백 제목 요소 id
 * @param {string} [o.descId] 피드백 설명 요소 id
 * @param {string} [o.nextBtnId] 다음 버튼 요소 id (표시 대상)
 * @param {boolean} o.isCorrect 정답 여부
 * @param {string} o.titleHtml 제목 HTML
 * @param {string} [o.descHtml] 설명 HTML
 */
export function showAnswerFeedback({ panelId, titleId, descId, nextBtnId, isCorrect, titleHtml, descHtml = '' }) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.remove('is-hidden');
    panel.classList.toggle('incorrect', !isCorrect);
    const title = document.getElementById(titleId);
    if (title) title.innerHTML = titleHtml;
    const desc = descId ? document.getElementById(descId) : null;
    if (desc) desc.innerHTML = descHtml;
    const nextBtn = nextBtnId ? document.getElementById(nextBtnId) : null;
    if (nextBtn) nextBtn.classList.remove('is-hidden');
}

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
    item.innerHTML = `<i class="fa-solid ${escapeHTML(icon)}" style="color:${color}; margin-right:0.5rem;"></i>${escapeHTML(message)}`;
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
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(message)}</p>
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
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(message)}</p>
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
