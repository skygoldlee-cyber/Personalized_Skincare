// src/auth-view.js — 계정/로그인 모달 (Phase 1: 인증만, 동기화는 Phase 2)
// 이메일+비밀번호 로그인·회원가입·매직링크. 세션은 supabase-js가 localStorage에 자동 보관.
import { getSupabase, onAuthChange } from './supabase-client.js';
import { showToast, showConfirm, trapFocus } from './ui-utils.js';

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
    if (modal._untrapFocus) modal._untrapFocus();
    modal._untrapFocus = trapFocus(modal);
    try { await refreshAuthUI(); }
    catch (e) { setMsg(friendlyError(e), true); }
}

export function closeAuthModal() {
    const modal = el('auth-modal');
    if (modal && modal._untrapFocus) { modal._untrapFocus(); modal._untrapFocus = null; }
    hide(modal);
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

// 이메일 재발송 쿨다운 — Supabase는 같은 주소 재요청을 짧은 간격으로 제한하고,
// Custom SMTP 적용 후 시간당 발송 한도도 별도로 생긴다.
// 만료 시각을 localStorage에 보관해 새로고침해도 쿨다운이 유지되게 한다.
const COOLDOWN_KEY = 'passmula_auth_mail_cooldown_until';
const COOLDOWN_SEC = 60;
let _emailLoginCooldown = 0;

function _loadCooldownUntil() {
    try { return parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10) || 0; }
    catch (_) { return 0; }
}
function _saveCooldownUntil(ts) {
    try {
        if (ts > 0) localStorage.setItem(COOLDOWN_KEY, String(ts));
        else localStorage.removeItem(COOLDOWN_KEY);
    } catch (_) {}
}

function startEmailLoginCooldown(btn, remainingSec = COOLDOWN_SEC) {
    _emailLoginCooldown = remainingSec;
    _saveCooldownUntil(Date.now() + remainingSec * 1000);
    if (!btn) return;
    const label = btn.dataset.cooldownLabel || btn.textContent;
    btn.dataset.cooldownLabel = label;
    const tick = () => {
        if (_emailLoginCooldown <= 0) {
            btn.disabled = false;
            btn.textContent = label;
            _saveCooldownUntil(0);
            return;
        }
        btn.disabled = true;
        btn.textContent = `다시 보내기 (${_emailLoginCooldown}초)`;
        _emailLoginCooldown--;
        setTimeout(tick, 1000);
    };
    tick();
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
    if (_emailLoginCooldown > 0) { setMsg(`재발송은 ${_emailLoginCooldown}초 후에 가능합니다.`, true); return; }
    setMsg('로그인 메일 발송 중...');
    const { error } = await sb.auth.signInWithOtp({
        email,
        // Redirect URLs 허용 목록과 일치해야 함 — 로컬/프로덕션이 각자 자기 도메인으로 복귀
        options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setMsg(friendlyError(error), true); return; }
    show(el('auth-otp-area'));
    setMsg('로그인 링크와 인증 코드를 이메일로 보냈습니다. 메일의 링크를 누르거나, 메일의 인증 코드를 아래에 입력하세요.');
    startEmailLoginCooldown(document.querySelector('[data-click="authEmailLogin"]'));
}

/** 비밀번호 분실 — 로그인 메일(OTP)로 로그인한 뒤 계정 화면에서 새 비밀번호 설정 */
export async function authForgotPassword() {
    const sb = await getSupabase();
    if (!sb) return;
    const { email } = readCredentials();
    if (!email) { setMsg('비밀번호를 재설정할 이메일을 입력하세요.', true); return; }
    if (_emailLoginCooldown > 0) { setMsg(`재발송은 ${_emailLoginCooldown}초 후에 가능합니다.`, true); return; }
    setMsg('로그인 메일 발송 중...');
    const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setMsg(friendlyError(error), true); return; }
    show(el('auth-otp-area'));
    setMsg('로그인 메일을 보냈습니다. 코드로 로그인한 뒤 계정 화면의 "비밀번호 설정"에서 새 비밀번호를 지정하세요.');
    startEmailLoginCooldown(document.querySelector('[data-click="authEmailLogin"]'));
}

/** @deprecated authEmailLogin으로 통합 — 기존 핸들러 호환용 별칭 */
export const authMagicLink = authEmailLogin;
export const authSendOtp = authEmailLogin;

/** 재발송 쿨다운 초기화 — 테스트 간 모듈 상태 리셋용 */
export function resetEmailLoginCooldown() { _emailLoginCooldown = 0; _saveCooldownUntil(0); }

export async function authVerifyOtp() {
    const sb = await getSupabase();
    if (!sb) return;
    const { email } = readCredentials();
    const token = (el('auth-otp-code')?.value || '').replace(/\s/g, '');
    if (!email) { setMsg('이메일을 입력하세요.', true); return; }
    // 자릿수 고정 금지 — Email OTP Length 설정(6~10)에 따라 달라진다
    if (!/^\d{6,10}$/.test(token)) { setMsg('메일에 표시된 숫자 인증 코드를 입력하세요.', true); return; }
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
 * 로그인 링크 랜딩 처리 (두 형태):
 *  ① ?token_hash= — 권장 템플릿. 앱 도메인으로 직행하며, 확인 클릭 시에만
 *     verifyOtp로 토큰을 소비한다 (메일 스캐너·미리보기의 사전 소진 방지,
 *     iOS 사용자에게 코드 경로 안내 기회 확보, flowType 무관).
 *  ② #access_token/#error — 기본 ConfirmationURL 해시 (하위 호환).
 * supabase 초기화(해시 소비) 전에 호출해야 파라미터를 읽을 수 있다.
 */
async function handleAuthLanding() {
    const query = new URLSearchParams(window.location?.search || '');
    const tokenHash = query.get('token_hash');
    if (tokenHash) {
        try { history.replaceState(null, '', location.pathname); } catch (_) {}
        const ok = await showConfirm(
            '이 브라우저에서 로그인할까요? 설치된 앱(PWA)에서 로그인 중이라면 취소하고 메일의 인증 코드를 앱에 입력하세요.',
            '로그인 링크'
        );
        if (!ok) {
            showToast('링크 로그인을 취소했습니다. 토큰은 유지됩니다 — 같은 메일의 인증 코드로 계속 로그인할 수 있습니다.', 'info');
            return;
        }
        const sb = await getSupabase();
        if (!sb) return;
        // 템플릿이 지정한 토큰 종류를 그대로 전달 — Confirm signup 메일은 type=signup
        const type = query.get('type') || 'email';
        const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) showToast(friendlyError(error), 'error');
        else showToast('로그인했습니다.', 'success');
        return;
    }

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
    // Enter 키 제출 — 버튼 클릭 없이 폼 완료
    const enter = (id, fn) => {
        const node = el(id);
        if (node) node.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fn(); } });
    };
    enter('auth-email', authSignIn);
    enter('auth-password', authSignIn);
    enter('auth-otp-code', authVerifyOtp);
    enter('auth-new-password', authSetPassword);
    // 새로고침 전 발송의 남은 쿨다운 복원
    const remaining = Math.ceil((_loadCooldownUntil() - Date.now()) / 1000);
    if (remaining > 0) startEmailLoginCooldown(document.querySelector('[data-click="authEmailLogin"]'), remaining);
    try { handleAuthLanding().catch(() => {}); } catch (_) {}
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
