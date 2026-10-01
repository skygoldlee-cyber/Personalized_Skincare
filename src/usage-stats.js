// src/usage-stats.js — 로컬 기능 사용 카운터 (유료가치 판정 데이터)
// @spec ROAD-L5
//
// 외부 전송 없이 이 기기의 localStorage에만 누적한다. 뷰 전환과 유료가치
// 후보 기능(오답→교재 근거·진단 평가·이야기형·맞춤학습 등)의 사용 횟수를
// 측정해 설정의 '내 사용 통계'에서 확인 — Pro 전환 의향 판단의 정량 근거.
// GLOBAL 키(기기 단위)로 저장 — 로그인 없는 프로모션 기간에는 owner의
// 익명 device_id가 "유저" 단위이며, 시험 전환해도 누적이 유지된다.

import { STORAGE_KEYS } from './storage-keys.js';
import { safeGetItem, safeSetItem } from './state.js';
import { esc } from './sanitize.js';
import { trapFocus } from './ui-utils.js';

const DAYS_KEEP = 90; // days 맵 상한 — 저장량 제한

/** 유료가치 판정 기준 — 기능 액션 합계가 이 횟수에 도달하면 유료가치 인정 (ROAD-P1 착수 근거) */
export const PRO_VALUE_THRESHOLD = 20;

/** 액션 키 → 표시 라벨 (유료가치 후보 기능과 LEARNING_PREMIUM_PLAN 표 대응) */
const ACTION_LABELS = {
    weak_to_textbook: '오답 → 교재 근거 보기',
    weak_to_card: '오답 → 복습 노트',
    weak_to_similar: '오답 → 유사 문제',
    diagnostic_quiz: '진단 평가',
    story_textbook: '이야기형 교재 읽기',
    personal_analysis: '맞춤학습 보기',
    analysis_report: '주간 리포트 공유',
    actual_exam_report: '실제 시험 결과 보고',
    command_palette: '통합 검색 (Ctrl+K)',
    plan_compare: 'Free/Pro 플랜 비교',
};

/**
 * 유료가치 판정 대상 (Pro 후보 기능) — PRO_VALUE_THRESHOLD 합산에만 포함.
 * command_palette·plan_compare 같은 편의/UI 액션은 통계 표시용으로만 남긴다.
 */
const VALUE_ACTIONS = new Set([
    'weak_to_textbook', 'weak_to_card', 'weak_to_similar',
    'diagnostic_quiz', 'story_textbook', 'personal_analysis', 'analysis_report', 'actual_exam_report',
]);

function _todayStr() { return new Date().toISOString().slice(0, 10); }

function _load() {
    try {
        const d = JSON.parse(safeGetItem(STORAGE_KEYS.USAGE_STATS) || 'null');
        if (d && typeof d === 'object' && d.v === 1
            && typeof d.views === 'object' && typeof d.actions === 'object' && typeof d.days === 'object') return d;
    } catch (e) { /* 손상 데이터는 초기값으로 복구 */ }
    return { v: 1, owner: null, firstUse: null, lastUse: null, days: {}, views: {}, actions: {} };
}

/** 익명 유저 식별 — 로그인 없는 기간의 "유저" 단위. sync.js getDeviceId와 같은 키 공유 */
function _ownerId() {
    let id = safeGetItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        safeSetItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
}

function _bump(bucket, key) {
    if (!key) return;
    const d = _load();
    const now = new Date().toISOString();
    if (!d.owner) d.owner = _ownerId();
    if (!d.firstUse) d.firstUse = now;
    d.lastUse = now;
    const day = _todayStr();
    d.days[day] = (d.days[day] || 0) + 1;
    const dayKeys = Object.keys(d.days).sort();
    while (dayKeys.length > DAYS_KEEP) {
        const oldest = dayKeys.shift();
        if (oldest) delete d.days[oldest];
    }
    d[bucket][key] = (d[bucket][key] || 0) + 1;
    safeSetItem(STORAGE_KEYS.USAGE_STATS, JSON.stringify(d));
}

/** 뷰 진입 카운트 — navigation.js의 switchView에서 호출 */
export function trackView(viewId) { _bump('views', viewId); }

/** 기능 액션 카운트 — 유료가치 후보 기능의 호출부에서 호출 */
export function trackAction(key) { _bump('actions', key); }

export function getUsageStats() { return _load(); }

/** Pro 후보 기능 사용 합계가 유료가치 판정 기준(PRO_VALUE_THRESHOLD)에 도달했는지 */
export function isValueThresholdMet() {
    return getValueActionTotal() >= PRO_VALUE_THRESHOLD;
}

export function resetUsageStats() {
    safeSetItem(STORAGE_KEYS.USAGE_STATS,
        JSON.stringify({ v: 1, owner: null, firstUse: null, lastUse: null, days: {}, views: {}, actions: {} }));
}

/** 유료가치 판정 대상 액션 합계 — Pro 후보 기능(VALUE_ACTIONS) 사용 횟수만 집계 */
function getValueActionTotal() {
    const d = _load();
    return Object.entries(d.actions)
        .filter(([k]) => VALUE_ACTIONS.has(k))
        .reduce((s, [, n]) => s + n, 0);
}

function _fmtDate(iso) {
    return iso ? String(iso).slice(0, 10) : '—';
}

/**
 * 내 사용 통계 모달 — 설정 메뉴에서 연다.
 * 뷰 라벨은 router.getViewTitles를 동적 import로 해석 (navigation→usage-stats
 * 정적 import 경로와의 순환 참조 회피 — state.js의 study-tracker 패턴과 동일).
 */
export async function showUsageStats() {
    const d = _load();
    let titles = {};
    try {
        const { getViewTitles } = await import('./router.js');
        titles = getViewTitles(window.DATA_REGISTRY) || {};
    } catch (e) { titles = {}; }

    const viewRows = Object.entries(d.views).sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `<tr><td>${esc((titles[id] && titles[id].title) || id)}</td><td class="usage-num">${n}회</td></tr>`).join('');
    const actionRows = Object.entries(d.actions).sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `<tr><td>${esc(ACTION_LABELS[k] || k)}</td><td class="usage-num">${n}회</td></tr>`).join('');
    const totalActions = Object.values(d.actions).reduce((s, n) => s + n, 0);
    const valueTotal = Object.entries(d.actions)
        .filter(([k]) => VALUE_ACTIONS.has(k)).reduce((s, [, n]) => s + n, 0);
    const activeDays = Object.keys(d.days).length;

    const existing = document.getElementById('usage-stats-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'usage-stats-overlay';
    overlay.className = 'app-confirm-overlay';
    overlay.innerHTML = `
        <div class="app-confirm-dialog pro-upgrade-dialog" role="alertdialog" aria-modal="true" aria-labelledby="usage-stats-title">
            <h3 id="usage-stats-title">📊 내 사용 통계</h3>
            <div class="pro-upgrade-benefits">
                <ul>
                    <li>첫 사용: <strong>${_fmtDate(d.firstUse)}</strong> · 최근 사용: <strong>${_fmtDate(d.lastUse)}</strong></li>
                    <li>학습 활동 일수: <strong>${activeDays}일</strong> · 기능 사용 합계: <strong>${totalActions}회</strong></li>
                    <li>Pro 후보 기능 사용: <strong>${valueTotal}/${PRO_VALUE_THRESHOLD}회</strong>${valueTotal >= PRO_VALUE_THRESHOLD ? ' — 유료가치 판정 <strong>충족</strong>' : ''}</li>
                </ul>
            </div>
            ${viewRows ? `<h4 class="usage-stats-sub">화면별 사용</h4><table class="usage-stats-table">${viewRows}</table>` : ''}
            ${actionRows ? `<h4 class="usage-stats-sub">기능별 사용</h4><table class="usage-stats-table">${actionRows}</table>` : ''}
            ${!viewRows && !actionRows ? '<p>아직 기록된 사용 데이터가 없습니다.</p>' : ''}
            <p class="usage-stats-note">이 데이터는 이 기기에만 저장되며 외부로 전송되지 않습니다.</p>
            <div class="app-confirm-btns">
                <button type="button" class="btn btn-secondary app-confirm-cancel" data-reset-usage>초기화</button>
                <button type="button" class="btn btn-primary app-confirm-ok">확인</button>
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
    };
    overlay.querySelector('.app-confirm-ok')?.addEventListener('click', close);
    overlay.querySelector('[data-reset-usage]')?.addEventListener('click', () => { resetUsageStats(); close(); showUsageStats(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
    };
    document.addEventListener('keydown', onKey);
}
