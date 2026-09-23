// tests/dom/common-auth.dom.test.js — Supabase 계정/로그인 모달 시나리오
// 설계: docs/dev/SUPABASE_DESIGN.md §5·§9 — window.supabase 스텁으로 세션 상태를 제어
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndexHtml, el, isVisible, lastToast, flushAsync } from './helpers.js';

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
    onAuthStateChange: vi.fn(),
};
window.supabase = { createClient: vi.fn(() => ({ auth: authStub })) };

import {
    initAuthView, openAuthModal, closeAuthModal, refreshAuthUI,
    authSignIn, authSignUp, authMagicLink, authSignOut, authSetPassword,
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
        expect(authStub.signInWithOtp).toHaveBeenCalledWith({ email: 'link@test.com' });
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

    it('initAuthView — 저장된 세션 복원 시 라벨에 이메일 (P/R)', async () => {
        session = { user: { email: 'saved@test.com' } };
        await initAuthView();
        expect(el('auth-menu-label').textContent).toBe('saved@test.com');
    });
});
