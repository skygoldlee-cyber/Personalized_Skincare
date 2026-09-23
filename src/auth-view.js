// src/auth-view.js — 계정/로그인 모달 (Phase 1: 인증만, 동기화는 Phase 2)
// 이메일+비밀번호 로그인·회원가입·매직링크. 세션은 supabase-js가 localStorage에 자동 보관.
import { getSupabase, onAuthChange } from './supabase-client.js';
import { showToast } from './ui-utils.js';

const el = id => document.getElementById(id);
const show = n => n && n.classList.remove('is-hidden');
const hide = n => n && n.classList.add('is-hidden');

// Supabase 영문 오류 → 한글 안내
const ERR_MAP = [
    [/invalid login credentials/i, '이메일 또는 비밀번호가 올바르지 않습니다.'],
    [/user already registered|already been registered/i, '이미 가입된 이메일입니다. 로그인을 이용하세요.'],
    [/password should be at least/i, '비밀번호는 6자 이상이어야 합니다.'],
    [/unable to validate email|invalid email/i, '이메일 형식이 올바르지 않습니다.'],
    [/email not confirmed/i, '이메일 인증이 완료되지 않았습니다. 받은 메일의 링크를 눌러주세요.'],
    [/rate limit|too many requests/i, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.'],
];
function friendlyError(err) {
    const msg = err?.message || String(err);
    for (const [re, ko] of ERR_MAP) if (re.test(msg)) return ko;
    return msg;
}

function setMsg(text, isError = false) {
    const box = el('auth-modal-msg');
    if (!box) return;
    if (!text) { hide(box); box.textContent = ''; return; }
    box.textContent = text;
    box.classList.toggle('auth-modal-msg-error', isError);
    show(box);
}

/** 세션 상태에 따라 모달의 폼/계정 영역과 설정 메뉴 라벨을 갱신 */
export async function refreshAuthUI() {
    const sb = await getSupabase();
    const menuLabel = el('auth-menu-label');
    const form = el('auth-form-area');
    const account = el('auth-account-area');
    if (!sb) {
        if (menuLabel) menuLabel.textContent = '계정 (미설정)';
        return null;
    }
    const { data } = await sb.auth.getSession();
    const user = data?.session?.user ?? null;
    if (menuLabel) menuLabel.textContent = user ? (user.email || '계정') : '계정 / 로그인';
    if (user) {
        hide(form); show(account);
        const emailEl = el('auth-account-email');
        if (emailEl) emailEl.textContent = user.email || '';
    } else {
        show(form); hide(account);
    }
    return user;
}

export async function openAuthModal() {
    const modal = el('auth-modal');
    if (!modal) return;
    setMsg('');
    show(modal);
    try { await refreshAuthUI(); }
    catch (e) { setMsg(friendlyError(e), true); }
}

export function closeAuthModal() {
    hide(el('auth-modal'));
    setMsg('');
}

function readCredentials() {
    return {
        email: (el('auth-email')?.value || '').trim(),
        password: el('auth-password')?.value || '',
    };
}

export async function authSignIn() {
    const sb = await getSupabase();
    if (!sb) return;
    const { email, password } = readCredentials();
    if (!email || !password) { setMsg('이메일과 비밀번호를 입력하세요.', true); return; }
    setMsg('로그인 중...');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setMsg(friendlyError(error), true); return; }
    setMsg('');
    closeAuthModal();
    showToast('로그인했습니다.', 'success');
    await refreshAuthUI();
}

export async function authSignUp() {
    const sb = await getSupabase();
    if (!sb) return;
    const { email, password } = readCredentials();
    if (!email || !password) { setMsg('이메일과 비밀번호를 입력하세요.', true); return; }
    setMsg('가입 처리 중...');
    const { error } = await sb.auth.signUp({ email, password });
    if (error) { setMsg(friendlyError(error), true); return; }
    setMsg('가입 확인 메일을 보냈습니다. 메일의 링크를 누르면 로그인됩니다.');
    await refreshAuthUI();
}

export async function authMagicLink() {
    const sb = await getSupabase();
    if (!sb) return;
    const { email } = readCredentials();
    if (!email) { setMsg('이메일을 입력하세요.', true); return; }
    setMsg('매직링크 발송 중...');
    const { error } = await sb.auth.signInWithOtp({ email });
    if (error) { setMsg(friendlyError(error), true); return; }
    setMsg('로그인 링크를 이메일로 보냈습니다. 메일을 확인하세요.');
}

export async function authSignOut() {
    const sb = await getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    closeAuthModal();
    showToast('로그아웃했습니다. 이 기기의 데이터는 유지됩니다.', 'info');
    await refreshAuthUI();
}

/** 앱 초기화 시 1회 — 세션 복원 반영 + 상태 변화 구독 */
export async function initAuthView() {
    if (!el('auth-modal')) return;
    try { await refreshAuthUI(); } catch (_) { /* 오프라인 등 — 로그인 UI는 비로그인 상태로 둠 */ }
    try {
        await onAuthChange(() => { refreshAuthUI().catch(() => {}); });
    } catch (_) {}
}
