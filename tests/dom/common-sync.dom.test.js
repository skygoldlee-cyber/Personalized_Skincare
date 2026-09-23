// tests/dom/common-sync.dom.test.js — 클라우드 스냅샷 동기화 (Phase 2) 시나리오
// 설계: docs/dev/SUPABASE_DESIGN.md §4·§9 — window.supabase 스텁으로 원격 상태를 제어
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadIndexHtml, el, lastToast, flushAsync, storedJson } from './helpers.js';

let confirmResult = true;
vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(confirmResult)),
    showAlert: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: {},
}));

// ── Supabase 스텁 — session + remoteRow로 로그인·원격 상태를 제어 ──
let session = null;
let remoteRow = null;        // sync_snapshots 행 { payload, updated_at, device_id }
let upsertError = null;
const upsertSpy = vi.fn(async (row) => {
    if (upsertError) return { error: upsertError };
    remoteRow = row; return { error: null };
});
const sb = {
    auth: {
        getSession: vi.fn(async () => ({ data: { session } })),
        onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({
        upsert: upsertSpy,
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: remoteRow, error: null })),
                })),
            })),
        })),
    })),
};
window.supabase = { createClient: vi.fn(() => sb) };

import { initSync, markDirty, pushSync, pullSync, syncNow, collectSyncPayload } from '../../src/sync.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';
import { scopedKey } from '../../src/exam-context.js';

const USER = { id: 'u1', email: 'me@test.com' };
const login = () => { session = { user: USER }; };

function dirty() { return localStorage.getItem(scopedKey(STORAGE_KEYS.SYNC_DIRTY)) === '1'; }
function lastTs() { return localStorage.getItem(scopedKey(STORAGE_KEYS.SYNC_LAST_TS)); }

describe('클라우드 동기화 (Phase 2)', () => {
    beforeEach(async () => {
        session = null; remoteRow = null; upsertError = null; confirmResult = true;
        localStorage.clear();
        loadIndexHtml();
        vi.clearAllMocks();
        sb.auth.getSession.mockImplementation(async () => ({ data: { session } }));
        await initSync(); // 쓰기 훅 등록 (비로그인)
        vi.clearAllMocks();
    });
    afterEach(() => { vi.useRealTimers(); });

    it('collectSyncPayload — 백업 키 수집, 고객 카드·미설정 키 제외', () => {
        localStorage.setItem(scopedKey(STORAGE_KEYS.FC_MEMORIZED), '["a"]');
        localStorage.setItem(scopedKey(STORAGE_KEYS.CUSTOMER_ITEMS), '[{"name":"고객"}]');
        const p = collectSyncPayload();
        expect(p[STORAGE_KEYS.FC_MEMORIZED]).toBe('["a"]');
        expect(p[STORAGE_KEYS.CUSTOMER_ITEMS]).toBeUndefined(); // 개인정보 — 동기화 제외
    });

    it('쓰기 훅 — 동기화 대상 키 저장 시 dirty 표시, 비로그인은 push 없음', async () => {
        const { safeSetItem } = await import('../../src/state.js');
        safeSetItem(STORAGE_KEYS.FC_MEMORIZED, '[]');
        expect(dirty()).toBe(true);
        expect(sb.from).not.toHaveBeenCalled(); // 비로그인 → push 안 함
    });

    it('쓰기 훅 — 비대상 키·동기화 메타 키는 dirty를 세우지 않음', async () => {
        const { safeSetItem } = await import('../../src/state.js');
        safeSetItem(STORAGE_KEYS.SYNC_DIRTY, '0');
        safeSetItem('readerBookmarks', '[]'); // 백업 대상 아님
        expect(dirty()).toBe(false);
    });

    it('로그인 + 쓰기 → 디바운스 push → upsert·dirty 해제·last_ts 기록', async () => {
        login(); await initSync();
        vi.clearAllMocks();
        vi.useFakeTimers();
        markDirty();
        await vi.advanceTimersByTimeAsync(3000);
        vi.useRealTimers();
        await flushAsync();
        expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'u1', exam_id: 'cosmetic',
        }));
        expect(dirty()).toBe(false);
        expect(lastTs()).toBeTruthy();
    });

    it('pull — 원격 없음 + dirty → 최초 push', async () => {
        login(); await initSync();
        markDirty();
        const r = await pullSync();
        expect(r).toBe('pushed');
        expect(remoteRow.user_id).toBe('u1');
    });

    it('pull — 원격이 최신 + 로컬 clean → 페이로드 적용·last_ts 갱신', async () => {
        login(); await initSync();
        remoteRow = {
            payload: { [STORAGE_KEYS.FC_MEMORIZED]: '["x","y"]', evil_key: '["nope"]' },
            updated_at: '2026-01-01T00:00:00Z', device_id: 'other-device',
        };
        const r = await pullSync();
        expect(r).toBe('applied');
        expect(storedJson(STORAGE_KEYS.FC_MEMORIZED)).toEqual(['x', 'y']);
        expect(localStorage.getItem(scopedKey('evil_key'))).toBeNull(); // 화이트리스트 외 무시
        expect(lastTs()).toBe('2026-01-01T00:00:00Z');
        expect(dirty()).toBe(false); // 적용 쓰기는 dirty로 세지 않음
    });

    it('충돌 — 원격 최신 + 로컬 dirty, "이 기기 유지" 선택 → 로컬 push', async () => {
        login(); await initSync();
        markDirty();
        remoteRow = { payload: {}, updated_at: '2026-01-01T00:00:00Z', device_id: 'd2' };
        confirmResult = false; // 이 기기 데이터 유지
        const r = await pullSync();
        expect(r).toBe('pushed');
        expect(upsertSpy).toHaveBeenCalled();
    });

    it('충돌 — "클라우드 가져오기" 선택 → 원격 적용', async () => {
        login(); await initSync();
        markDirty();
        remoteRow = {
            payload: { [STORAGE_KEYS.QUIZ_RESULTS]: '{"s1":{"total":2}}' },
            updated_at: '2026-01-01T00:00:00Z', device_id: 'd2',
        };
        const r = await pullSync();
        expect(r).toBe('applied');
        expect(storedJson(STORAGE_KEYS.QUIZ_RESULTS)).toEqual({ s1: { total: 2 } });
        expect(dirty()).toBe(false);
    });

    it('push 실패 — dirty 유지 + 상태 표시', async () => {
        login(); await initSync();
        upsertError = { message: 'network down' };
        markDirty();
        const ok = await pushSync();
        expect(ok).toBe(false);
        expect(dirty()).toBe(true);
        expect(el('auth-sync-status').textContent).toContain('실패');
    });

    it('syncNow — 로그인 상태에서 pull 경로 실행, 상태 문구 갱신', async () => {
        login(); await initSync();
        remoteRow = { payload: {}, updated_at: '2026-02-01T00:00:00Z', device_id: 'd2' };
        await syncNow();
        expect(el('auth-sync-status').textContent).toContain('동기화');
    });

    it('비로그인 — pull/push 모두 무시, 오류 없이 종료', async () => {
        expect(await pullSync()).toBe('none');
        expect(await pushSync()).toBe(false);
        expect(sb.from).not.toHaveBeenCalled();
    });
});
