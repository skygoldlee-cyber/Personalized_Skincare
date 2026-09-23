// tests/dom/common-auth.dom.test.js — Supabase 계정/로그인 모달 시나리오
// 설계: docs/dev/SUPABASE_DESIGN.md §5·§9 — window.supabase 스텁으로 세션 상태를 제어
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndexHtml, el, isVisible, lastToast, flushAsync } from './helpers.js';
import { showConfirm } from '../../src/ui-utils.js';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showAlert: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: {},
}));

// supabase-js 스텁 — session 변수로 로그인 상태를 동적으로 제어.
// getSupabase()는 window.supabase가 이미 있으면 vendor 로드를 건너뛴다.
let session = null;
const authStub = {
    getSession: vi.fn(async () => ({ data: { session } })),
    signInWithPassword: vi.fn(async ({ email, password }) => {
        if (password === 'wrong') return { data: {}, error: new Error('Invalid login credentials') };
        session = { user: { email } };
        return { data: { session }, error: null };
    }),
    signUp: vi.fn(async () => ({ data: {}, error: null })),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => { session = null; return { error: null }; }),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
    verifyOtp: vi.fn(async ({ email, token }) => {
        if (token === '000000') return { data: {}, error: new Error('Token has expired or is invalid') };
        session = { user: { email } };
        return { data: { session }, error: null };
    }),
    onAuthStateChange: vi.fn(),
};
window.supabase = { createClient: vi.fn(() => ({ auth: authStub })) };

import {
    initAuthView, openAuthModal, closeAuthModal, refreshAuthUI,
    authSignIn, authSignUp, authEmailLogin, authMagicLink, authSignOut, authSetPassword,
    authSendOtp, authVerifyOtp, resetEmailLoginCooldown,
} from '../../src/auth-view.js';

function fillAuth(email, pw) {
    el('auth-email').value = email;
    el('auth-password').value = pw;
}

describe('계정/로그인 모달', () => {
    beforeEach(() => {
        session = null;
        localStorage.clear();
        loadIndexHtml();
        resetEmailLoginCooldown();
        vi.clearAllMocks();
        // clearAllMocks는 구현도 지우므로 호출 횟수만 검증하는 용도로 재설정 불필요 —
        // 스텁은 async 함수로 재정의
        authStub.getSession.mockImplementation(async () => ({ data: { session } }));
        authStub.signInWithPassword.mockImplementation(async ({ email, password }) => {
            if (password === 'wrong') return { data: {}, error: new Error('Invalid login credentials') };
            session = { user: { email } };
            return { data: { session }, error: null };
        });
        authStub.signUp.mockImplementation(async () => ({ data: {}, error: null }));
        authStub.signInWithOtp.mockImplementation(async () => ({ data: {}, error: null }));
        authStub.signOut.mockImplementation(async () => { session = null; return { error: null }; });
        authStub.updateUser.mockImplementation(async () => ({ data: {}, error: null }));
        authStub.verifyOtp.mockImplementation(async ({ email, token }) => {
            if (token === '000000') return { data: {}, error: new Error('Token has expired or is invalid') };
            session = { user: { email } };
            return { data: { session }, error: null };
        });
    });

    it('모달 열기 — 비로그인 시 로그인 폼 표시·계정 영역 숨김 (H)', async () => {
        await openAuthModal();
        expect(isVisible('auth-modal')).toBe(true);
        expect(isVisible('auth-form-area')).toBe(true);
        expect(isVisible('auth-account-area')).toBe(false);
        expect(el('auth-menu-label').textContent).toBe('계정 / 로그인');
    });

    it('로그인 — 빈 입력은 API 호출 없이 안내 메시지 (X)', async () => {
        await openAuthModal();
        await authSignIn();
        expect(authStub.signInWithPassword).not.toHaveBeenCalled();
        expect(el('auth-modal-msg').textContent).toContain('이메일과 비밀번호');
    });

    it('로그인 성공 — 모달 닫힘·토스트·설정 라벨에 이메일 (H)', async () => {
        await openAuthModal();
        fillAuth('user@test.com', 'pass1234');
        await authSignIn();
        expect(isVisible('auth-modal')).toBe(false);
        expect(lastToast()[0]).toContain('로그인');
        await refreshAuthUI();
        expect(el('auth-menu-label').textContent).toBe('user@test.com');
    });

    it('로그인 실패 — 영문 오류가 한글 안내로 매핑 (X)', async () => {
        await openAuthModal();
        fillAuth('user@test.com', 'wrong');
        await authSignIn();
        expect(el('auth-modal-msg').textContent).toContain('이메일 또는 비밀번호');
        expect(isVisible('auth-modal')).toBe(true); // 모달은 열린 채 유지
    });

    it('회원가입 — 확인 메일 안내 표시 (H)', async () => {
        await openAuthModal();
        fillAuth('new@test.com', 'pass1234');
        await authSignUp();
        expect(authStub.signUp).toHaveBeenCalledWith({ email: 'new@test.com', password: 'pass1234' });
        expect(el('auth-modal-msg').textContent).toContain('확인 메일');
    });

    it('매직링크 — 이메일만으로 발송, 빈 이메일은 검증 (H/X)', async () => {
        await openAuthModal();
        await authMagicLink();
        expect(authStub.signInWithOtp).not.toHaveBeenCalled();
        fillAuth('link@test.com', '');
        await authMagicLink();
        expect(authStub.signInWithOtp).toHaveBeenCalledWith({ email: 'link@test.com', options: { emailRedirectTo: location.origin } });
        expect(el('auth-modal-msg').textContent).toContain('로그인 링크');
    });

    it('로그인 상태에서 열기 — 계정 영역·이메일 표시 (R)', async () => {
        session = { user: { email: 'me@test.com' } };
        await openAuthModal();
        expect(isVisible('auth-form-area')).toBe(false);
        expect(isVisible('auth-account-area')).toBe(true);
        expect(el('auth-account-email').textContent).toBe('me@test.com');
        expect(el('auth-menu-label').textContent).toBe('me@test.com');
    });

    it('로그아웃 — 세션 해제·폼 영역 복귀·라벨 복원 (H)', async () => {
        session = { user: { email: 'me@test.com' } };
        await openAuthModal();
        await authSignOut();
        expect(authStub.signOut).toHaveBeenCalled();
        expect(lastToast()[0]).toContain('로그아웃');
        await refreshAuthUI();
        expect(el('auth-menu-label').textContent).toBe('계정 / 로그인');
    });

    it('비밀번호 설정 — updateUser 호출·토스트·입력란 비움 (H)', async () => {
        session = { user: { email: 'me@test.com' } };
        await openAuthModal();
        el('auth-new-password').value = 'newpass6';
        await authSetPassword();
        expect(authStub.updateUser).toHaveBeenCalledWith({ password: 'newpass6' });
        expect(lastToast()[0]).toContain('비밀번호');
        expect(el('auth-new-password').value).toBe('');
    });

    it('비밀번호 설정 — 6자 미만은 API 호출 없이 검증 메시지 (X)', async () => {
        session = { user: { email: 'me@test.com' } };
        await openAuthModal();
        el('auth-new-password').value = '123';
        await authSetPassword();
        expect(authStub.updateUser).not.toHaveBeenCalled();
        expect(el('auth-modal-msg').textContent).toContain('6자 이상');
    });

    it('인증 코드 발송 — signInWithOtp 호출 + 코드 입력 영역 표시 (H)', async () => {
        await openAuthModal();
        el('auth-email').value = 'otp@test.com';
        await authSendOtp();
        expect(authStub.signInWithOtp).toHaveBeenCalledWith({ email: 'otp@test.com', options: { emailRedirectTo: location.origin } });
        expect(isVisible('auth-otp-area')).toBe(true);
        expect(el('auth-modal-msg').textContent).toContain('인증 코드');
    });

    it('인증 코드 검증 — 숫자 코드로 verifyOtp → 로그인 완료 (H)', async () => {
        await openAuthModal();
        el('auth-email').value = 'otp@test.com';
        await authSendOtp();
        el('auth-otp-code').value = '123456';
        await authVerifyOtp();
        expect(authStub.verifyOtp).toHaveBeenCalledWith({ email: 'otp@test.com', token: '123456', type: 'email' });
        expect(isVisible('auth-modal')).toBe(false);
        expect(lastToast()[0]).toContain('로그인');
    });

    it('인증 코드 검증 — 비숫자·만료 코드는 오류 안내 (X)', async () => {
        await openAuthModal();
        el('auth-email').value = 'otp@test.com';
        el('auth-otp-code').value = 'abc';
        await authVerifyOtp();
        expect(authStub.verifyOtp).not.toHaveBeenCalled();
        expect(el('auth-modal-msg').textContent).toContain('인증 코드');
        el('auth-otp-code').value = '000000';
        await authVerifyOtp();
        expect(el('auth-modal-msg').textContent).toContain('만료');
    });

    it('initAuthView — 저장된 세션 복원 시 라벨에 이메일 (P/R)', async () => {
        session = { user: { email: 'saved@test.com' } };
        await initAuthView();
        expect(el('auth-menu-label').textContent).toBe('saved@test.com');
    });

    it('로그인 메일 통합 — 발송 시 코드 입력 영역 + 링크·코드 안내 (H)', async () => {
        await openAuthModal();
        el('auth-email').value = 'uni@test.com';
        await authEmailLogin();
        expect(authStub.signInWithOtp).toHaveBeenCalledWith({ email: 'uni@test.com', options: { emailRedirectTo: location.origin } });
        expect(isVisible('auth-otp-area')).toBe(true);
        const msg = el('auth-modal-msg').textContent;
        expect(msg).toContain('로그인 링크');
        expect(msg).toContain('인증 코드');
    });

    it('매직링크 랜딩 오류 — 해시 error 파라미터 → 만료 안내 토스트 + URL 정리 (H)', async () => {
        location.hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
        await initAuthView();
        expect(lastToast()[0]).toContain('만료');
        expect(location.hash).toBe('');
        location.hash = '';
    });

    it('매직링크 랜딩 성공 — access_token 해시 → SIGNED_IN 시 로그인 토스트 (H)', async () => {
        location.hash = '#access_token=tok123&refresh_token=ref&type=magiclink';
        await initAuthView();
        const cb = authStub.onAuthStateChange.mock.calls[0][0];
        session = { user: { email: 'link@test.com' } };
        cb('SIGNED_IN', session);
        expect(lastToast()[0]).toContain('로그인했습니다');
        location.hash = '';
    });

    it('token_hash 랜딩 — 확인 시 verifyOtp로 세션 성립 + URL 정리 (H)', async () => {
        history.replaceState(null, '', '/?token_hash=tok_hash_1&type=email');
        await initAuthView();
        await flushAsync();
        expect(showConfirm).toHaveBeenCalled();
        expect(authStub.verifyOtp).toHaveBeenCalledWith({ token_hash: 'tok_hash_1', type: 'email' });
        expect(lastToast()[0]).toContain('로그인했습니다');
        expect(location.search).toBe('');
    });

    it('token_hash 랜딩 — 취소 시 토큰 미소비 (스캐너 방어) (X)', async () => {
        showConfirm.mockResolvedValueOnce(false);
        history.replaceState(null, '', '/?token_hash=tok_hash_2&type=email');
        await initAuthView();
        await flushAsync();
        expect(showConfirm).toHaveBeenCalled();
        expect(authStub.verifyOtp).not.toHaveBeenCalled();
    });

    it('재발송 쿨다운 — 발송 후 버튼 비활성 + 재호출 차단 (R)', async () => {
        await openAuthModal();
        el('auth-email').value = 'cd@test.com';
        await authEmailLogin();
        expect(authStub.signInWithOtp).toHaveBeenCalledTimes(1);
        const btn = document.querySelector('[data-click="authEmailLogin"]');
        expect(btn.disabled).toBe(true);
        await authEmailLogin();
        expect(authStub.signInWithOtp).toHaveBeenCalledTimes(1);
        expect(el('auth-modal-msg').textContent).toContain('재발송');
    });
});
