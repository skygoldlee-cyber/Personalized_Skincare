// src/supabase-client.js — Supabase 클라이언트 lazy 초기화 + 인증 헬퍼
// vendor/supabase/supabase.js (UMD → window.supabase)는 첫 사용 시점에 동적 로드 —
// 앱 시작 비용을 늘리지 않고, 미설정 환경(isSupabaseConfigured()=false)에서는 조용히 비활성.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, isSupabaseConfigured } from './supabase-config.js';

let _client = null;
let _vendorPromise = null;

function loadVendor() {
    if (typeof window !== 'undefined' && window.supabase) return Promise.resolve();
    if (_vendorPromise) return _vendorPromise;
    _vendorPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/supabase/supabase.js';
        s.onload = () => resolve();
        s.onerror = () => {
            _vendorPromise = null; // 재시도 가능하게
            reject(new Error('Supabase 라이브러리를 불러오지 못했습니다.'));
        };
        document.head.appendChild(s);
    });
    return _vendorPromise;
}

/** 설정 미비 시 null — 호출부는 null 분기로 로그인 UI를 숨긴다 */
export async function getSupabase() {
    if (!isSupabaseConfigured()) return null;
    if (_client) return _client;
    await loadVendor();
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return _client;
}

export async function getAuthSession() {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session ?? null;
}

/** 로그인 상태 변화 구독 — session=null이면 로그아웃 상태. 두 번째 인자로 이벤트명 전달 */
export async function onAuthChange(cb) {
    const sb = await getSupabase();
    if (!sb) return;
    sb.auth.onAuthStateChange((event, session) => cb(session, event));
}
