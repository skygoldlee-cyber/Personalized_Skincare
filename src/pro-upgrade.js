/**
 * Pro 업그레이드 안내 — 무료 플랜 한도 도달 시 표시하는 정보성 모달.
 *
 * 결제 인프라 도입 전이므로 "준비 중" 안내에 그친다 (LEARNING_PREMIUM_PLAN 지연 원칙).
 * 스토어가 `{ ok:false, error:'Free 플랜은 ...' }`를 반환하는 모든 지점에서
 * isFreeLimitError()로 판별 후 showUpgradeNotice()를 호출한다.
 */

import { esc } from './sanitize.js';
import { trapFocus } from './ui-utils.js';

/** 스토어 오류가 무료 한도 초과인지 판별 */
export function isFreeLimitError(error) {
    return typeof error === 'string' && error.startsWith('Free 플랜');
}

/**
 * 스토어 저장 결과의 오류를 표시한다.
 * 무료 한도 초과 → Pro 업그레이드 안내 모달, 그 외 → 일반 오류 토스트.
 * @param {{ok:boolean, error?:string}} result - 스토어 반환값
 * @param {string} featureLabel - 한도에 걸린 기능명 (예: 'My 포뮬러')
 * @param {function} showToast - 토스트 함수 (호출측 임포트 전달)
 * @param {string} [fallback] - error가 없을 때 표시할 기본 메시지
 */
export function showStoreError(result, featureLabel, showToast, fallback = '저장에 실패했습니다.') {
    if (isFreeLimitError(result.error)) { showUpgradeNotice(featureLabel, result.error); return; }
    showToast(result.error || fallback, 'error');
}

/** Pro 업그레이드 안내 모달 (정보성 — 결제 경로 없음) */
export function showUpgradeNotice(featureLabel, limitMessage) {
    const existing = document.getElementById('pro-upgrade-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pro-upgrade-overlay';
    overlay.className = 'app-confirm-overlay';
    overlay.innerHTML = `
        <div class="app-confirm-dialog pro-upgrade-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pro-upgrade-title">
            <h3 id="pro-upgrade-title">💎 무료 한도 도달</h3>
            <p>${esc(limitMessage || `${featureLabel}의 무료 플랜 한도에 도달했습니다.`)}</p>
            <div class="pro-upgrade-benefits">
                <p class="pro-upgrade-sub"><strong>Pro 플랜(준비 중)</strong>에서는:</p>
                <ul>
                    <li>${esc(featureLabel)} 저장 한도 무제한</li>
                    <li>클라우드 동기화 · 멀티기기 이어쓰기</li>
                    <li>오디오북 · 상세 학습 리포트</li>
                </ul>
            </div>
            <div class="app-confirm-actions">
                <button class="app-confirm-ok">확인</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
        overlay.querySelector('.app-confirm-dialog').classList.add('is-visible');
    });

    const untrapFocus = trapFocus(overlay.querySelector('.app-confirm-dialog'));
    const close = () => {
        overlay.classList.remove('is-visible');
        overlay.querySelector('.app-confirm-dialog').classList.remove('is-visible');
        setTimeout(() => { untrapFocus(); overlay.remove(); }, 200);
    };
    overlay.querySelector('.app-confirm-ok').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
    };
    document.addEventListener('keydown', onKey);
}
