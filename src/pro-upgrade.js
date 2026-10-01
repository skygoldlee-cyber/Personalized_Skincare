/**
 * Pro 업그레이드 안내 — 무료 플랜 한도 도달 시 표시하는 정보성 모달.
 *
 * 결제 인프라 도입 전이므로 "준비 중" 안내에 그친다 (LEARNING_PREMIUM_PLAN 지연 원칙).
 * 스토어가 `{ ok:false, error:'Free 플랜은 ...' }`를 반환하는 모든 지점에서
 * isFreeLimitError()로 판별 후 showUpgradeNotice()를 호출한다.
 */

// @spec ROAD-P0

import { esc } from './sanitize.js';
import { trapFocus } from './ui-utils.js';
import { safeGetItem, safeSetItem } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { trackAction } from './usage-stats.js';
import { hasFeature } from './exam-context.js';

/** 스토어 오류가 무료 한도 초과인지 판별 */
function isFreeLimitError(error) {
    return typeof error === 'string' && error.startsWith('Free 플랜');
}

// --- 기능 플랜 (feature-plan.json — 기능별 무료/Pro 전환) ---
let _featurePlan = null;

/**
 * feature-plan.json을 로드해 메모리에 보관하고 PRO 배지를 갱신한다.
 * fetch 실패·오프라인 시 기본값(pro 표기)을 유지한다.
 */
export async function loadFeaturePlan() {
    try {
        const res = await fetch('feature-plan.json', { cache: 'no-cache' });
        if (res.ok) _featurePlan = await res.json();
    } catch (e) { /* 오프라인·로드 실패 시 기본값 유지 */ }
    if (!_featurePlan) _featurePlan = {};
    refreshProBadges();
}

/** 기능이 Pro 표기 대상인지 판별 (플랜 미로드·키 누락 시 pro로 간주) */
function isProFeature(featureKey) {
    const v = _featurePlan && _featurePlan.features && _featurePlan.features[featureKey];
    return v !== 'free';
}

/**
 * Pro 이용 권한 여부 — ROAD-P1에서 Supabase entitlement 서버 검증으로 교체 예정.
 * 현재는 로컬 플래그(pro_entitled)만 참조하며, 설정 경로는 결제 인프라와 함께 도입된다.
 */
export function hasProEntitlement() {
    return safeGetItem(STORAGE_KEYS.PRO_ENTITLED) === '1';
}

/**
 * 클라우드 동기화 사용 가능 여부 — 플랜이 free면 전원 허용, pro면 entitlement 필요.
 * feature-plan.json의 cloud_sync를 free로 내리면 entitlement 없이 재활성화 가능 (무료 체험 프로모션용 레버).
 */
export function canCloudSync() {
    return !isProFeature('cloud_sync') || hasProEntitlement();
}

/** data-pro-feature 속성을 가진 PRO 배지를 플랜에 맞춰 표시/숨긴다
 * @param {Document|HTMLElement} [root]
 */
export function refreshProBadges(root = document) {
    if (!_featurePlan) return;
    root.querySelectorAll('[data-pro-feature]').forEach(el => {
        el.classList.toggle('is-hidden', !isProFeature(/** @type {HTMLElement} */ (el).dataset.proFeature));
        if (!el.getAttribute('title')) el.setAttribute('title', 'Pro 제공 예정 기능 — 현재 무료로 이용할 수 있습니다');
    });
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

/**
 * Pro 기능 안내 — 기능 진입 시점에 1회 표시 (기능별 seen 플래그).
 * 무료 회수 없이 "Pro 제공 예정" 사실만 알린다.
 * feature-plan.json에서 'free'로 표시된 기능은 안내하지 않는다.
 * @param {string} featureKey - seen 플래그 키 (예: 'mock_exam', 'combo_drill')
 * @param {string} featureName - 표시용 기능명
 */
export function proFeatureNotice(featureKey, featureName) {
    if (!isProFeature(featureKey)) return;
    let seen = {};
    try { seen = JSON.parse(safeGetItem(STORAGE_KEYS.PRO_NOTICE_SEEN) || '{}') || {}; } catch (e) { seen = {}; }
    if (seen[featureKey]) return;
    seen[featureKey] = new Date().toISOString();
    safeSetItem(STORAGE_KEYS.PRO_NOTICE_SEEN, JSON.stringify(seen));

    const { overlay, close } = _showDialog(`
        <div class="app-confirm-dialog pro-upgrade-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pro-notice-title">
            <h3 id="pro-notice-title">💎 Pro 기능 안내</h3>
            <p><strong>${esc(featureName)}</strong>은(는) Pro 버전에서 제공되는 기능입니다.<br>현재는 무료 체험 기간으로 누구나 이용할 수 있습니다.</p>
            <div class="pro-upgrade-benefits">
                <p class="pro-upgrade-sub">Pro 가입 시 로그인 계정의 클라우드 동기화로 <strong>여러 디바이스 간 학습 상태가 공유</strong>됩니다.</p>
            </div>
            <div class="app-confirm-actions">
                <button class="app-confirm-cancel app-confirm-compare">Free / Pro 비교</button>
                <button class="app-confirm-ok">확인</button>
            </div>
        </div>
    `);
    overlay.querySelector('.app-confirm-compare')?.addEventListener('click', () => { close(); showPlanCompare(); });
}

/** 모달 표시 공통부 — 오버레이 생성·표시 애니메이션·trapFocus·닫기 핸들러.
 * @param {string} innerHtml 다이얼로그 내부 HTML (.app-confirm-dialog 루트 포함)
 * @returns {{overlay: HTMLElement, close: function}} */
function _showDialog(innerHtml) {
    const existing = document.getElementById('pro-upgrade-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pro-upgrade-overlay';
    overlay.className = 'app-confirm-overlay';
    overlay.innerHTML = innerHtml;
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
    };
    overlay.querySelector('.app-confirm-ok')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
    };
    document.addEventListener('keydown', onKey);
    return { overlay, close };
}

/** 플랜 비교에 노출하는 기능 목록 — feature-plan.json 키와 매핑 */
const PLAN_FEATURES = [
    { key: 'personal_analysis', label: '맞춤학습 (오답 패턴·취약 진술·성적 예측)' },
    { key: 'story_textbook', label: '이야기형 교재 본문 읽기' },
    { key: 'mock_exam', label: '실전 모의고사' },
    { key: 'combo_mock', label: 'ㄱㄴㄷ 조합 모의고사' },
    { key: 'combo_set', label: 'ㄱㄴㄷ 조합 문제집' },
    { key: 'combo_drill', label: 'ㄱㄴㄷ 조합 훈련' },
    { key: 'cloud_sync', label: '클라우드 동기화 (여러 디바이스 상태 공유)' },
];

/** Free/Pro 기능 비교 안내 모달 — 설정의 '플랜 안내'·계정 모달에서 연다.
 * feature-plan.json의 현재 값을 반영하므로 플랜 전환 시 문구가 어긋나지 않는다. */
export async function showPlanCompare() {
    trackAction('plan_compare');
    // 저장 한도 혜택은 Formula OS 기능 보유 시험에서만 노출 — 한도 수치는
    // 각 스토어의 상수에서 유도 (도메인 모듈은 지연 로딩으로 초기 번들 미포함)
    let limitsRow = '';
    if (hasFeature('formula')) {
        try {
            const [fs, cs, ml, bs] = await Promise.all([
                import('./formula-store.js'),
                import('./customer-store.js'),
                import('./material-ledger.js'),
                import('./batch-store.js'),
            ]);
            limitsRow = `<li>저장 한도 무제한 — 무료 플랜: My 포뮬러 ${fs.FORMULA_LIMIT_FREE} · 고객 ${cs.CUSTOMER_LIMIT_FREE} · 원료 ${ml.MATERIAL_LIMIT_FREE} · 조제 기록 ${bs.BATCH_LIMIT_FREE}</li>`;
        } catch (e) { /* 한도 표기 생략 — 모달 자체는 표시 */ }
    }
    const featureRows = PLAN_FEATURES.map(f => {
        const tag = isProFeature(f.key)
            ? '<span class="pro-badge">PRO</span>'
            : '<span class="plan-free-tag">무료 제공</span>';
        return `<li>${esc(f.label)} ${tag}</li>`;
    }).join('');

    _showDialog(`
        <div class="app-confirm-dialog pro-upgrade-dialog" role="alertdialog" aria-modal="true" aria-labelledby="plan-compare-title">
            <h3 id="plan-compare-title">💎 Free / Pro 안내</h3>
            <p>현재는 <strong>무료 체험 기간</strong>으로 Pro 표시 기능도 무료로 이용할 수 있습니다.</p>
            <div class="pro-upgrade-benefits">
                <p class="pro-upgrade-sub"><strong>기능별 제공 범위</strong> — 현재 플랜 설정 반영</p>
                <ul>${featureRows}</ul>
                <p class="pro-upgrade-sub"><strong>Pro 전용 혜택 (예정)</strong></p>
                <ul>
                    ${limitsRow}
                    <li>클라우드 동기화 — 로그인 계정 기준 여러 디바이스 간 학습 상태 공유</li>
                    <li>오디오북 등 신규 Pro 기능 우선 제공</li>
                </ul>
                <p class="pro-upgrade-sub"><strong>로그인</strong></p>
                <ul>
                    <li>무료 플랜 — <strong>로그인 불필요</strong>, 모든 데이터는 이 기기에 저장</li>
                    <li>Pro 플랜 — <strong>로그인 필요</strong> (클라우드 동기화·구독 관리 계정)</li>
                </ul>
                <p class="pro-upgrade-sub">그 외 학습 도구(퀴즈·플래시카드·교재 표준형·검색·사전·캘린더·훈련소·백업)는 <strong>항상 무료</strong>입니다.</p>
            </div>
            <div class="app-confirm-actions">
                <button class="app-confirm-ok">확인</button>
            </div>
        </div>
    `);
}

/** Pro 업그레이드 안내 모달 (정보성 — 결제 경로 없음) */
export function showUpgradeNotice(featureLabel, limitMessage) {
    const { overlay, close } = _showDialog(`
        <div class="app-confirm-dialog pro-upgrade-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pro-upgrade-title">
            <h3 id="pro-upgrade-title">💎 무료 한도 도달</h3>
            <p>${esc(limitMessage || `${featureLabel}의 무료 플랜 한도에 도달했습니다.`)}</p>
            <div class="pro-upgrade-benefits">
                <p class="pro-upgrade-sub"><strong>Pro 플랜(준비 중)</strong>에서는:</p>
                <ul>
                    <li>${esc(featureLabel)} 저장 한도 무제한</li>
                    <li>클라우드 동기화 — 여러 디바이스 간 학습 상태 공유</li>
                    <li>오디오북 · 개인화된 맞춤형 리포트</li>
                </ul>
            </div>
            <div class="app-confirm-actions">
                <button class="app-confirm-cancel app-confirm-compare">Free / Pro 비교</button>
                <button class="app-confirm-ok">확인</button>
            </div>
        </div>
    `);
    overlay.querySelector('.app-confirm-compare')?.addEventListener('click', () => { close(); showPlanCompare(); });
}
