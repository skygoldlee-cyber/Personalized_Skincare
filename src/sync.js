// src/sync.js — 클라우드 스냅샷 동기화 (Phase 2)
// localStorage가 1차 저장소로 남고, 로그인 상태에서만 sync_snapshots 테이블과
// push/pull한다. 페이로드는 backup.js의 논리 키→값 포맷을 재사용하되
// 고객 카드·상담 이력(타인 개인정보)은 동기화에서 제외한다 (설계 §7).
import { getSupabase, getAuthSession } from './supabase-client.js';
import { isSupabaseConfigured } from './supabase-config.js';
import { safeGetItem, safeSetItem, listScopedKeys, setDataWriteHook } from './state.js';
import { STORAGE_KEYS, BACKUP_KEYS, isDailyCompletedKey } from './storage-keys.js';
import { unscopedKey, getActiveExamId } from './exam-context.js';
import { showToast, showConfirm } from './ui-utils.js';

// 동기화 제외 — 고객 카드·상담 이력은 타인 개인정보라 로컬 전용 (SUPABASE_DESIGN §7)
const SYNC_EXCLUDE = new Set([STORAGE_KEYS.CUSTOMER_ITEMS]);
const SYNC_STATIC = new Set(BACKUP_KEYS.filter(k => !SYNC_EXCLUDE.has(k)));

// 동기화 메타 키 자체는 쓰기 훅에서 제외 (markDirty 재귀 방지)
const META_KEYS = new Set([STORAGE_KEYS.SYNC_DIRTY, STORAGE_KEYS.SYNC_LAST_TS]);

const PUSH_DEBOUNCE_MS = 2500;

let _signedIn = false;
let _pushTimer = null;
let _applyingRemote = false; // 원격 페이로드 적용 중 — 그 쓰기는 dirty로 세지 않음

function getDeviceId() {
    let id = safeGetItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        safeSetItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
}

/** 동기화 대상 키 수집 — 정적 키(고객 제외) + daily_completed_* 동적 키, 논리 키 포맷 */
export function collectSyncPayload() {
    const keys = [...SYNC_STATIC, ...listScopedKeys(isDailyCompletedKey).map(unscopedKey)];
    const payload = {};
    keys.forEach(k => {
        const v = safeGetItem(k);
        if (v !== null) payload[k] = v;
    });
    return payload;
}

function updateSyncStatus(text) {
    const el = document.getElementById('auth-sync-status');
    if (el) el.textContent = text;
}

function fmtTs(iso) {
    try { return new Date(iso).toLocaleString('ko-KR'); } catch (_) { return iso; }
}

// ── 쓰기 훅 → dirty 표시 + 로그인 시 디바운스 push ──────────────
function onLocalWrite(logicalKey) {
    if (META_KEYS.has(logicalKey)) return;
    if (!SYNC_STATIC.has(logicalKey) && !isDailyCompletedKey(logicalKey)) return;
    if (_applyingRemote) return;
    markDirty();
}

export function markDirty() {
    safeSetItem(STORAGE_KEYS.SYNC_DIRTY, '1');
    if (!_signedIn) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(() => { pushSync().catch(() => {}); }, PUSH_DEBOUNCE_MS);
}

// ── push: 현재 시험의 페이로드를 upsert ──────────────────────────
export async function pushSync() {
    const sb = await getSupabase();
    if (!sb || !_signedIn) return false;
    const session = await getAuthSession();
    if (!session) { _signedIn = false; return false; }
    const now = new Date().toISOString();
    const { error } = await sb.from('sync_snapshots').upsert({
        user_id: session.user.id,
        exam_id: getActiveExamId(),
        payload: collectSyncPayload(),
        updated_at: now,
        device_id: getDeviceId(),
    });
    if (error) {
        console.warn('[sync] push 실패:', error.message);
        updateSyncStatus('동기화 실패 — 다음 변경 시 재시도');
        return false;
    }
    safeSetItem(STORAGE_KEYS.SYNC_DIRTY, '0');
    safeSetItem(STORAGE_KEYS.SYNC_LAST_TS, now);
    updateSyncStatus(`마지막 동기화: ${fmtTs(now)}`);
    return true;
}

// ── 원격 페이로드 적용 — 화이트리스트 키만, 현재 시험 네임스페이스에 기록 ──
function applyPayload(payload) {
    if (!payload || typeof payload !== 'object') return 0;
    _applyingRemote = true;
    let count = 0;
    try {
        Object.keys(payload).forEach(k => {
            if ((SYNC_STATIC.has(k) || isDailyCompletedKey(k))
                && payload[k] !== null && typeof payload[k] === 'string') {
                if (safeSetItem(k, payload[k])) count++;
            }
        });
    } finally {
        _applyingRemote = false;
    }
    return count;
}

// ── pull: 원격 조회 → 최신성 비교 → 적용/충돌 확인/push ──────────
export async function pullSync() {
    const sb = await getSupabase();
    if (!sb || !_signedIn) return 'none';
    const session = await getAuthSession();
    if (!session) { _signedIn = false; return 'none'; }

    const { data, error } = await sb.from('sync_snapshots')
        .select('payload,updated_at,device_id')
        .eq('user_id', session.user.id)
        .eq('exam_id', getActiveExamId())
        .maybeSingle();
    if (error) {
        console.warn('[sync] pull 실패:', error.message);
        updateSyncStatus('동기화 조회 실패');
        return 'error';
    }

    const dirty = safeGetItem(STORAGE_KEYS.SYNC_DIRTY) === '1';
    const localTs = safeGetItem(STORAGE_KEYS.SYNC_LAST_TS);

    if (!data) {
        // 원격 없음 — 로컬 변경이 있으면 최초 push
        if (dirty) { await pushSync(); return 'pushed'; }
        updateSyncStatus('클라우드에 저장된 데이터 없음');
        return 'none';
    }

    const remoteTs = data.updated_at;
    if (!remoteTs || (localTs && remoteTs <= localTs)) {
        // 로컬이 최신 — 미동기화 변경이 있으면 push
        if (dirty) { await pushSync(); return 'pushed'; }
        updateSyncStatus(`동기화됨 (${fmtTs(remoteTs)})`);
        return 'uptodate';
    }

    // 원격이 더 최신 — 로컬 미동기화 변경이 있으면 충돌 확인
    if (dirty) {
        const useRemote = await showConfirm(
            `클라우드에 더 최신 데이터가 있습니다 (${fmtTs(remoteTs)}, 기기 ${data.device_id || '알 수 없음'}).\n` +
            `가져오면 이 기기에서 아직 동기화되지 않은 변경이 덮어씌워집니다.`,
            '동기화 충돌');
        if (!useRemote) { await pushSync(); return 'pushed'; }
    }

    const n = applyPayload(data.payload);
    safeSetItem(STORAGE_KEYS.SYNC_LAST_TS, remoteTs);
    safeSetItem(STORAGE_KEYS.SYNC_DIRTY, '0');
    if (n > 0) {
        showToast('클라우드 데이터를 적용했습니다. 새로고침합니다.', 'success');
        updateSyncStatus(`동기화됨 (${fmtTs(remoteTs)})`);
        setTimeout(() => { try { location.reload(); } catch (_) {} }, 800);
    }
    return 'applied';
}

/** 설정/계정 모달의 "지금 동기화" 버튼 */
export async function syncNow() {
    updateSyncStatus('동기화 중...');
    const r = await pullSync();
    if (r === 'none') showToast('로그인이 필요하거나 동기화할 데이터가 없습니다.', 'info');
}

/** 앱 초기화 시 1회 — 쓰기 훅 등록 + 세션 확인 + 로그인 변화 구독 */
export async function initSync() {
    if (!isSupabaseConfigured()) return;
    setDataWriteHook(onLocalWrite);
    try {
        const session = await getAuthSession();
        _signedIn = !!session;
        if (_signedIn) await pullSync();
    } catch (_) { /* 오프라인 등 — 로컬 전용으로 계속 동작 */ }
    try {
        const sb = await getSupabase();
        sb?.auth.onAuthStateChange((_event, session) => {
            const was = _signedIn;
            _signedIn = !!session;
            if (_signedIn && !was) pullSync().catch(() => {});
        });
    } catch (_) {}
    // 온라인 복귀 시 미동기화 변경 재시도
    try {
        window.addEventListener('online', () => {
            if (_signedIn && safeGetItem(STORAGE_KEYS.SYNC_DIRTY) === '1') {
                pushSync().catch(() => {});
            }
        });
    } catch (_) {}
}
