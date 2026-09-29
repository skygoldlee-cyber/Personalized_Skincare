// src/app-shell.js — 앱 셸 크롬: 뷰포트 높이·가로세로 토글·data-click 접근성·
// 시험 브랜딩·기능 플래그·원료 DB 버전 알림 (app.js에서 분리)
// @spec R-08,P-08,O-04,ES-02,ES-03
import { safeGetItem, safeSetItem, safeRemoveItem } from "./state.js";
import { STORAGE_KEYS } from "./storage-keys.js";
import { DataLoader } from "./data-loader.js";
import { getActiveExam, getExamList, hasFeature } from "./exam-context.js";
import { showToast, showAlert } from "./ui-utils.js";

// 설치형 PWA 콜드 스타트에서 dvh가 실제 화면보다 크게 측정되는 경우가 있어
// (스플래시 직후 시스템 바 확정 전) — visualViewport 기준으로 재측정해 자정시킨다.
// 과대 측정 시 .main-content 끝이 화면 밖으로 나가 스크롤 끝 콘텐츠가 탭 바에 가려짐.
export function initViewportHeight() {
    const sync = () => {
        const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${h}px`);
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.visualViewport?.addEventListener('resize', sync);
}


// --- 가로/세로 보기 ---
// 실제 기기 회전 + 반응형 CSS가 가로/세로를 직접 처리하므로
// 가로/세로 보기 토글 — landscape-mode 클래스를 토글하고 상태를 저장
export function setupOrientationToggle() {
    const btn = document.getElementById('orientation-toggle-btn');
    if (!btn) return;

    // 초기 상태 복원
    if (safeGetItem(STORAGE_KEYS.PREFERRED_ORIENTATION) === 'landscape') {
        document.body.classList.add('landscape-mode');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-mobile-screen';
    }

    btn.addEventListener('click', () => {
        const isLandscape = document.body.classList.toggle('landscape-mode');
        if (isLandscape) {
            safeSetItem(STORAGE_KEYS.PREFERRED_ORIENTATION, 'landscape');
        } else {
            safeRemoveItem(STORAGE_KEYS.PREFERRED_ORIENTATION);
        }
        // 아이콘 업데이트
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isLandscape ? 'fa-solid fa-mobile-screen' : 'fa-solid fa-mobile-screen-button';
        }
        showOrientationToast(isLandscape);
    });
}

// 방향 전환 알림 표시 — 공용 토스트 스택 사용 (커스텀 아이콘 지정)
function showOrientationToast(isLandscape) {
    const icon = isLandscape ? 'fa-solid fa-mobile-screen' : 'fa-solid fa-mobile-screen-button';
    showToast(isLandscape ? '가로 보기 모드' : '세로 보기 모드', 'info', 2000, icon);
}


export function enhanceDataClickAccessibility() {
    document.querySelectorAll('[data-click]').forEach(el => {
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    });
}

// 동적 콘텐츠에도 접근성 속성 자동 부여
const _dataClickObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = /** @type {Element} */ (node);
            if (el.matches('[data-click]')) {
                if (el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA') {
                    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
                    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
                }
            }
            if (el.querySelectorAll) {
                el.querySelectorAll('[data-click]').forEach(el => {
                    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
                    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
                    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
                });
            }
        }
    }
});
if (document.body) {
    _dataClickObserver.observe(document.body, { childList: true, subtree: true });
}



/** 활성 시험의 브랜딩을 DOM에 반영 (문서 제목 + 사이드바 로고) */
export function applyExamBranding() {
    const exam = getActiveExam();
    if (!exam) return;
    if (exam.title) document.title = exam.title;
    const logoMain = document.querySelector('.logo-text h1');
    const logoSub = document.querySelector('.logo-text span');
    if (logoMain && exam.logoMain) logoMain.textContent = exam.logoMain;
    if (logoSub && exam.logoSub) logoSub.textContent = exam.logoSub;
}

/**
 * 원료 DB 갱신 감지 — 레지스트리의 ingredients.contentHash를 마지막 확인 값과 비교해
 * 정정/개정 배포로 바뀐 경우 1회 알림을 띄운다. 최초 방문(저장값 없음)은 조용히 기록만 한다.
 * contentHash는 원료 파일 내용의 해시라 배포 시점이 아니라 실제 데이터 변경 때만 발화한다.
 */
// 기존 사용자 식별용 — 실제 사용으로만 생성되는 진행 데이터 키들 (알림 기능 도입 전 사용자 구분)
const RETURNING_USER_KEYS = [
    STORAGE_KEYS.QUIZ_RESULTS, STORAGE_KEYS.STUDY_CALENDAR, STORAGE_KEYS.STUDY_STREAK,
    STORAGE_KEYS.FC_MEMORIZED, STORAGE_KEYS.FC_SPACED_REPETITION,
    STORAGE_KEYS.SIM_RESULTS_HISTORY, STORAGE_KEYS.FORMULA_ITEMS, STORAGE_KEYS.READER_LAST_POSITION
];

export function checkIngredientsUpdate() {
    const meta = (DataLoader.registry && DataLoader.registry.ingredients) || null;
    const hash = meta && meta.contentHash;
    if (!hash) return;
    try {
        const prev = safeGetItem(STORAGE_KEYS.INGREDIENTS_HASH);
        // 알림 키는 '버전:해시' — 데이터 해시가 같아도 db_version 범프(표시 전용 개정)는 발화한다.
        const notifyKey = `${meta.version || 'data'}:${hash}`;
        const notifiedHash = safeGetItem(STORAGE_KEYS.INGREDIENTS_DB_NOTIFIED);
        // 진행 데이터 존재 = 알림 기능 도입 전부터 쓰던 기존 사용자 → 이 버전 알림을 아직 못 봤다면 1회 고지
        const isReturningUser = RETURNING_USER_KEYS.some(k => safeGetItem(k) !== null);
        const hashChanged = prev !== null && prev !== hash;
        const missedNotice = isReturningUser && notifiedHash !== notifyKey;
        if (hashChanged || missedNotice) {
            const version = meta.version ? ` v${meta.version}` : '';
            const notice = meta.notice ? `\n\n갱신 내역: ${meta.notice}` : '';
            const count = meta.stats && meta.stats.count ? `\n수록 원료 ${meta.stats.count}종 · 성분 사전과 Formula OS 규정 검증이 최신 기준으로 적용됩니다.` : '';
            const history = Array.isArray(meta.history) ? meta.history : [];
            const prevNote = history.length
                ? `\n\n이전 개정:\n${history.slice(0, 3).map(h => `· v${h.version} (${h.updatedAt || '—'}) ${h.notice || ''}`).join('\n')}`
                : '';
            // 확인 플래그는 사용자가 모달을 실제로 닫은 뒤에만 기록한다.
            // (SW 업데이트 리로드 등으로 모달이 조기 소실되면 다음 방문에 다시 고지)
            showAlert(`원료 데이터베이스가${version}로 갱신되었습니다.${notice}${count}${prevNote}`, '원료 DB 갱신')
                .then(() => {
                    safeSetItem(STORAGE_KEYS.INGREDIENTS_DB_NOTIFIED, notifyKey);
                    safeSetItem(STORAGE_KEYS.INGREDIENTS_HASH, hash);
                })
                .catch(() => {});
        } else if (prev === null) {
            // 신규 사용자: 현재 버전을 '이미 확인한 것'으로 기록해 향후 오발화 방지
            safeSetItem(STORAGE_KEYS.INGREDIENTS_DB_NOTIFIED, notifyKey);
        } else if (prev !== hash) {
            safeSetItem(STORAGE_KEYS.INGREDIENTS_HASH, hash);
        }
    } catch (e) { /* 알림 실패가 초기화를 막지 않도록 무시 */ }
}

/** 성분 사전 버전 배지 탭 → 원료 DB 버전 이력 모달 (현재 버전 + 누적 개정 내역) */
export function showIngredientsChangelog() {
    const meta = (DataLoader.registry && DataLoader.registry.ingredients) || null;
    if (!meta || !meta.version) { showToast('원료 DB 버전 정보가 없습니다.', 'info'); return; }
    const lines = [`현재: v${meta.version} (${meta.updatedAt || '—'})`];
    if (meta.notice) lines.push(`  ${meta.notice}`);
    const history = Array.isArray(meta.history) ? meta.history : [];
    if (history.length) {
        lines.push('', '이전 개정:');
        history.forEach(h => lines.push(`· v${h.version} (${h.updatedAt || '—'}) ${h.notice || ''}`));
    }
    if (meta.stats && meta.stats.count) lines.push('', `수록 원료 ${meta.stats.count}종`);
    showAlert(lines.join('\n'), '원료 DB 버전 이력');
}

/** 활성 시험의 features 플래그에 따라 도메인 특화 UI 숨김 (data-feature 속성 기반) */
export function applyFeatureFlags() {
    const multiExam = getExamList().length > 1;
    document.querySelectorAll('[data-feature]').forEach(node => {
        const el = /** @type {HTMLElement} */ (node);
        // 시험 전환 버튼은 플래그가 아닌 실제 시험 수로 결정 — 1개면 무의미
        const on = el.dataset.feature === 'examSwitch'
            ? multiExam
            : hasFeature(el.dataset.feature);
        if (!on) el.classList.add('is-hidden');
    });
}

