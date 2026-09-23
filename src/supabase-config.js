// src/supabase-config.js — Supabase 프로젝트 연결 설정
// ⚠️ 이 파일의 두 값은 "공개" 정보 — 정적 사이트 특성상 배포된 JS에 그대로 노출되며,
//    Publishable key는 설계상 클라이언트에 넣는 공개 키다. 실제 보안은 Supabase의
//    RLS(Row Level Security) 정책이 담당한다 (docs/dev/SUPABASE_DESIGN.md §3).
//    절대 넣으면 안 되는 것: Secret key(구 service_role)·DB 비밀번호·Direct connection string.

export const SUPABASE_URL = 'https://hunpzznyiaddekuggupu.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hm2gqKknWf6EvCGiQsniFA_-eid7xeT';

/** Supabase 기능이 설정되어 있는지 — 미설정(자리표시자)이면 로그인 UI를 숨긴다 */
export function isSupabaseConfigured() {
    return SUPABASE_URL.startsWith('https://')
        && SUPABASE_URL.includes('.supabase.co')
        && SUPABASE_PUBLISHABLE_KEY.length > 0;
}
