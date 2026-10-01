// src/onboarding.js — 첫 방문 시작 안내 모달
// ------------------------------------------------------------
// 학습 데이터가 전혀 없는 진짜 최초 방문에서만 1회 표시한다.
// 기존 사용자(학습 키가 이미 있는 경우)는 플래그만 기록하고 방해하지 않는다.
// 설정 메뉴 "시작 안내" 버튼으로 언제든 재열람 가능.
// ------------------------------------------------------------
import { safeGetItem, safeSetItem } from './state.js';
import { trapFocus } from './ui-utils.js';
import { getExamAppName } from './exam-context.js';
import { esc } from './sanitize.js';

const SEEN_KEY = 'onboarding_seen_v1';
// whats-new.js와 동일 기준 — 이 중 하나라도 있으면 신규 사용자가 아님
const RETURNING_USER_HINTS = ['quiz_results', 'fc_memorized', 'study_streak', 'sim_results_history'];

const STEPS = [
    {
        icon: 'fa-book-open',
        title: '예상 문제집',
        body: '대시보드 과목 카드에서 문제집을 열람하세요. 읽던 위치는 자동 저장되어 이어보기가 뜹니다.',
    },
    {
        icon: 'fa-clock',
        title: '모의고사',
        body: '모의고사 시작에서 실전(선다형+단답형) 또는 ㄱㄴㄷ 조합을 골라 20·40·전체 문항으로 응시합니다. OMR 마킹·타이머·과락 판정을 지원합니다.',
    },
    {
        icon: 'fa-rotate-left',
        title: '복습 루프',
        body: '틀린 문항은 복습노트와 간격 반복(SM-2)에 자동 등록됩니다. 대시보드 "오늘 복습 → 지금 복습"과 훈련소 취약 드릴로 다시 푸세요.',
    },
];

/** 시작 안내 모달 — 최초 방문 자동 표시와 설정 메뉴 재열람 공용 */
export function showOnboardingModal() {
    const existing = document.getElementById('onboarding-overlay');
    if (existing) existing.remove();

    const items = STEPS.map((s, i) => `
        <li class="onboarding-step">
            <span class="onboarding-step-num">${i + 1}</span>
            <div>
                <p class="onboarding-step-title"><i class="fa-solid ${s.icon}" aria-hidden="true"></i> ${s.title}</p>
                <p class="onboarding-step-body">${s.body}</p>
            </div>
        </li>`).join('');

    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.innerHTML = `
        <div class="app-confirm-dialog onboarding-dialog" role="dialog" aria-modal="true" aria-label="시작 안내">
            <h3><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> ${esc(getExamAppName())} 시작 안내</h3>
            <ol class="onboarding-steps">${items}</ol>
            <p class="onboarding-foot">진도는 이 기기에 자동 저장되며 오프라인에서도 학습할 수 있습니다.</p>
            <div class="app-confirm-actions">
                <button class="app-confirm-ok">시작하기</button>
            </div>
        </div>`;
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
        setTimeout(() => { untrapFocus(); overlay.remove(); }, 200);
        safeSetItem(SEEN_KEY, '1');
    };
    overlay.querySelector('.app-confirm-ok')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
    };
    document.addEventListener('keydown', onKey);
}

/** 앱 초기화 시 호출 — 학습 데이터가 없는 최초 방문에서만 자동 표시 */
export function maybeShowOnboarding() {
    if (safeGetItem(SEEN_KEY)) return;
    safeSetItem(SEEN_KEY, '1'); // 재표시 방지는 모달 표시 여부와 무관하게 먼저 기록
    const isReturning = RETURNING_USER_HINTS.some(k => safeGetItem(k) !== null);
    if (isReturning) return; // 이 기능 도입 전부터 쓰던 사용자 — 조용히 통과
    showOnboardingModal();
}
