// src/whats-new.js — 새 버전 적용 알림 ("무엇이 바뀌었나")
// ------------------------------------------------------------
// window.APP_VERSION(data/version.js, 배포 스탬프)과 마지막으로 본 버전
// (last_seen_version, 앱 전역 키)을 비교해 업데이트 후 첫 부팅에서
// 변경 이력 모달을 띄운다. 설정 메뉴 "변경 이력" 버튼으로도 재열람 가능.
// 이력 소스: window.RELEASE_NOTES (data/release-notes.js — 배포 시 커밋
// subject로 자동 초안 생성, 수동 편집 권장).
// ------------------------------------------------------------
import { safeGetItem, safeSetItem } from './state.js';
import { esc } from './sanitize.js';
import { trapFocus } from './ui-utils.js';

const SEEN_KEY = 'last_seen_version';
const MAX_VERSIONS = 3;    // 건너뛴 버전이 많아도 최근 3개까지만
const MAX_ITEMS = 10;      // 표시 항목 상한
const FALLBACK_NOTE = '내부 개선 및 안정성이 향상되었습니다.';

function appVersion() {
    return (typeof window !== 'undefined' && window.APP_VERSION) || null;
}

export function releaseNotes() {
    return (typeof window !== 'undefined' && Array.isArray(window.RELEASE_NOTES))
        ? window.RELEASE_NOTES : [];
}

/**
 * lastSeen 이후에 배포된 항목만 추린다 (순수 함수 — 테스트 용이).
 * lastSeen이 목록에 없으면(여러 버전 건너뜀) 최근 MAX_VERSIONS개를 반환.
 */
export function collectNewEntries(notes, lastSeen) {
    const released = (notes || []).filter(e => e && e.version);
    if (!released.length) return [];
    const idx = lastSeen ? released.findIndex(e => e.version === lastSeen) : -1;
    const slice = idx === -1 ? released : released.slice(0, idx);
    return slice.slice(0, MAX_VERSIONS).map(e => ({
        ...e,
        notes: (e.notes && e.notes.length ? e.notes : [FALLBACK_NOTE]).slice(0, MAX_ITEMS),
    }));
}

/** 변경 이력 모달 — 부팅 자동 표시와 설정 메뉴 재열람 공용 */
export function showReleaseNotesModal(entries, title = '새로운 소식') {
    if (!entries.length) return;
    // ui-utils의 showConfirm/showAlert와 같은 오버레이 ID 공유 — 동시 표시 시 교체
    const existing = document.getElementById('app-confirm-overlay');
    if (existing) existing.remove();

    const sections = entries.map(e => `
        <div class="whats-new-entry">
            <p class="whats-new-version">${esc(e.version)} <span class="whats-new-date">${esc(e.date || '')}</span></p>
            <ul>${e.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        </div>`).join('');

    const overlay = document.createElement('div');
    overlay.id = 'app-confirm-overlay';
    overlay.innerHTML = `
        <div class="app-confirm-dialog whats-new-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
            <h3><i class="fa-solid fa-sparkles" aria-hidden="true"></i> ${esc(title)}</h3>
            <div class="whats-new-body">${sections}</div>
            <div class="app-confirm-actions">
                <button class="app-confirm-ok">확인</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const dialog = overlay.querySelector('.app-confirm-dialog');
    requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
        dialog.classList.add('is-visible');
    });

    const untrapFocus = trapFocus(dialog);
    const close = () => {
        overlay.classList.remove('is-visible');
        dialog.classList.remove('is-visible');
        setTimeout(() => { untrapFocus(); overlay.remove(); }, 200);
        safeSetItem(SEEN_KEY, appVersion() || '');
    };
    overlay.querySelector('.app-confirm-ok').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
    };
    document.addEventListener('keydown', onKey);
}

/** 앱 초기화 시 호출 — 버전이 바뀐 첫 부팅에서만 자동 표시 */
export function maybeShowWhatsNew() {
    const current = appVersion();
    if (!current) return;
    const lastSeen = safeGetItem(SEEN_KEY);
    if (lastSeen === current) return;
    // 최초 설치(이력 없음)에는 모달 없이 버전만 기록
    if (!lastSeen) {
        safeSetItem(SEEN_KEY, current);
        return;
    }
    showReleaseNotesModal(collectNewEntries(releaseNotes(), lastSeen));
}
