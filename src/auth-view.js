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
    [/token has expired|invalid.*token|otp.*expired|otp.*invalid/i, '인증 코드가 만료되었거나 올바르지 않습니다.'],
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
    hide(el('auth-otp-area'));
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

/**
 * 이메일 로그인 통합 — signInWithOtp 메일 하나에 링크+인증 코드가 동봉되므로
 * 버튼을 나누지 않는다. 발송 후 코드 입력 칸을 항상 표시해
 * 브라우저(링크 클릭)·PWA(코드 입력) 어느 환경이든 같은 절차로 완료한다.
 */
export async function authEmailLogin() {
    const sb = await getSupabase();
    if (!sb) return;
    const { email } = readCredentials();
    if (!email) { setMsg('이메일을 입력하세요.', true); return; }
    setMsg('로그인 메일 발송 중...');
    const { error } = await sb.auth.signInWithOtp({ email });
    if (error) { setMsg(friendlyError(error), true); return; }
    show(el('auth-otp-area'));
    setMsg('로그인 링크와 인증 코드를 이메일로 보냈습니다. 메일의 링크를 누르거나, 메일의 인증 코드를 아래에 입력하세요.');
}

/** @deprecated authEmailLogin으로 통합 — 기존 핸들러 호환용 별칭 */
export const authMagicLink = authEmailLogin;
export const authSendOtp = authEmailLogin;

export async function authVerifyOtp() {
    const sb = await getSupabase();
    if (!sb) return;
    const { email } = readCredentials();
    const token = (el('auth-otp-code')?.value || '').trim();
    if (!email) { setMsg('이메일을 입력하세요.', true); return; }
    if (!/^\d{6,8}$/.test(token)) { setMsg('메일에 표시된 숫자 인증 코드를 입력하세요.', true); return; }
    setMsg('코드 확인 중...');
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) { setMsg(friendlyError(error), true); return; }
    setMsg('');
    closeAuthModal();
    showToast('로그인했습니다.', 'success');
    await refreshAuthUI();
}

/** 로그인 상태에서 비밀번호 설정/변경 — 매직링크 가입 계정이 PWA 등에서 비밀번호 로그인할 수 있게 한다 */
export async function authSetPassword() {
    const sb = await getSupabase();
    if (!sb) return;
    const input = el('auth-new-password');
    const password = input?.value || '';
    if (password.length < 6) { setMsg('비밀번호는 6자 이상이어야 합니다.', true); return; }
    setMsg('비밀번호 설정 중...');
    const { error } = await sb.auth.updateUser({ password });
    if (error) { setMsg(friendlyError(error), true); return; }
    if (input) input.value = '';
    setMsg('');
    showToast('비밀번호가 설정되었습니다. 다음부터 이메일+비밀번호로 로그인할 수 있습니다.', 'success');
}

export async function authSignOut() {
    const sb = await getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    closeAuthModal();
    showToast('로그아웃했습니다. 이 기기의 데이터는 유지됩니다.', 'info');
    await refreshAuthUI();
}

// 매직링크 랜딩 플래그 — 해시에 access_token이 있던 시작에서만
// SIGNED_IN 토스트를 띄운다 (수동 로그인 경로는 자체 토스트 보유)
let _magicLinkLanding = false;

/**
 * 매직링크 랜딩 처리 — URL 해시의 error_* 파라미터는 한글 토스트로 안내 후 정리,
 * access_token이 있으면 supabase-js가 세션을 소비하므로 성공 토스트를 예약한다.
 * supabase 초기화(해시 소비) 전에 호출해야 파라미터를 읽을 수 있다.
 */
function handleAuthLanding() {
    const hash = (typeof window !== 'undefined' && window.location?.hash) || '';
    if (hash.length < 2) return;
    const params = new URLSearchParams(hash.slice(1));
    const errDesc = params.get('error_description') || '';
    const errCode = params.get('error_code') || params.get('error') || '';
    if (errDesc || errCode) {
        const msg = /expired/i.test(errCode + errDesc)
            ? '로그인 링크가 만료되었습니다. 계정 메뉴에서 다시 요청하세요.'
            : '로그인 링크를 처리하지 못했습니다. 다시 시도하세요.';
        showToast(msg, 'error');
        try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
        return;
    }
    if (params.has('access_token')) _magicLinkLanding = true;
}

/** 앱 초기화 시 1회 — 매직링크 랜딩 처리 + 세션 복원 반영 + 상태 변화 구독 */
export async function initAuthView() {
    if (!el('auth-modal')) return;
    try { handleAuthLanding(); } catch (_) {}
    try { await refreshAuthUI(); } catch (_) { /* 오프라인 등 — 로그인 UI는 비로그인 상태로 둠 */ }
    try {
        await onAuthChange((_session, event) => {
            if (event === 'SIGNED_IN' && _magicLinkLanding) {
                _magicLinkLanding = false;
                showToast('로그인했습니다.', 'success');
            }
            refreshAuthUI().catch(() => {});
        });
    } catch (_) {}
}
