// tests/dom/feedback.dom.test.js — 의견 보내기 모달 시나리오
// 설계: docs/dev/design/USER_FEEDBACK_DESIGN.md — 모달 표시 → 유형/별점 선택 → 제출 → 큐/토스트 검증
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndexHtml, el, lastToast, flushAsync } from './helpers.js';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showAlert: vi.fn(),
    vibrate: vi.fn(),
    trapFocus: vi.fn(() => () => {}),
    HAPTIC: {},
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
}));

// supabase-js 스텁 — insert 호출 캡처, networkError로 성공/실패 제어
let insertCalls = [];
let networkError = null;
window.supabase = {
    createClient: vi.fn(() => ({
        auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
        from: (table) => ({
            insert: vi.fn(async (rows) => {
                insertCalls.push({ table, rows });
                return { error: networkError };
            }),
        }),
    })),
};

import { showFeedbackModal, flushPendingFeedback, initFeedbackHint, dismissFeedbackHint, dismissFeedbackDot } from '../../src/feedback.js';

function openModal() {
    showFeedbackModal('dashboard');
    return el('feedback-overlay');
}

describe('feedback.js — 의견 보내기 모달', () => {
    beforeEach(() => {
        localStorage.clear();
        insertCalls = [];
        networkError = null;
        document.body.innerHTML = '';
        window.APP_VERSION = 'v-test-dom';
    });

    it('설정의 의견 보내기 버튼이 실제 index.html에 존재', () => {
        loadIndexHtml();
        expect(el('feedback-btn')).not.toBeNull();
    });

    it('모달 오픈: 유형 버튼·별점·텍스트 영역·허니팝 렌더링', () => {
        const overlay = openModal();
        expect(overlay).not.toBeNull();
        expect(overlay.querySelectorAll('.feedback-kind').length).toBe(4);
        expect(overlay.querySelectorAll('.feedback-star').length).toBe(5);
        expect(overlay.querySelector('.feedback-text')).not.toBeNull();
        expect(overlay.querySelector('.feedback-hp')).not.toBeNull();
        expect(overlay.textContent).toContain('dashboard'); // 컨텍스트 표시
        expect(overlay.textContent).toContain('v-test-dom');
    });

    it('유형 선택: aria-pressed 토글', () => {
        const overlay = openModal();
        const bug = overlay.querySelector('[data-kind="bug"]');
        bug.click();
        expect(bug.getAttribute('aria-pressed')).toBe('true');
        expect(overlay.querySelector('[data-kind="improve"]').getAttribute('aria-pressed')).toBe('false');
    });

    it('별점 선택·재클릭 해제', () => {
        const overlay = openModal();
        const stars = overlay.querySelectorAll('.feedback-star');
        stars[3].click(); // 4점
        expect(overlay.querySelectorAll('.feedback-star.is-on').length).toBe(4);
        stars[3].click(); // 해제
        expect(overlay.querySelectorAll('.feedback-star.is-on').length).toBe(0);
    });

    it('성공 제출: insert 호출 + 모달 닫힘 + 감사 토스트', async () => {
        const overlay = openModal();
        overlay.querySelector('.feedback-text').value = '정말 유용한 앱입니다';
        overlay.querySelector('.feedback-submit').click();
        await flushAsync();
        expect(insertCalls.length).toBe(1);
        expect(insertCalls[0].rows[0].body).toBe('정말 유용한 앱입니다');
        expect(insertCalls[0].rows[0].view).toBe('dashboard');
        expect(lastToast()[0]).toContain('감사');
    });

    it('오프라인(전송 실패): 큐에 쌓고 안내 토스트', async () => {
        networkError = new Error('offline');
        const overlay = openModal();
        overlay.querySelector('.feedback-text').value = '오프라인 의견입니다';
        overlay.querySelector('.feedback-submit').click();
        await flushAsync();
        const q = JSON.parse(localStorage.getItem('pending_feedback'));
        expect(q.length).toBe(1);
        expect(lastToast()[0]).toContain('오프라인');

        // 온라인 복귀 → 플러시
        networkError = null;
        const flushed = await flushPendingFeedback();
        expect(flushed).toBe(1);
        expect(JSON.parse(localStorage.getItem('pending_feedback')).length).toBe(0);
    });

    it('짧은 본문은 검증 거부 — insert 없음', async () => {
        const overlay = openModal();
        overlay.querySelector('.feedback-text').value = '짧';
        overlay.querySelector('.feedback-submit').click();
        await flushAsync();
        expect(insertCalls.length).toBe(0);
        expect(lastToast()[0]).toContain('자 이상');
    });

    it('허니팝 입력된 제출은 조용히 성공 처리 — insert 없음', async () => {
        const overlay = openModal();
        overlay.querySelector('.feedback-hp').value = 'bot@spam';
        overlay.querySelector('.feedback-text').value = '충분히 긴 본문입니다';
        overlay.querySelector('.feedback-submit').click();
        await flushAsync();
        expect(insertCalls.length).toBe(0);
        expect(lastToast()[0]).toContain('감사'); // 봇에겐 성공인 척
    });

    it('신기능 힌트: 처음엔 ⚙️ 점 + NEW 배지, 확인 후 각각 제거', () => {
        loadIndexHtml();
        initFeedbackHint();
        expect(document.querySelector('#settings-toggle-btn .feedback-dot')).not.toBeNull();
        expect(document.querySelector('#feedback-btn .feedback-new')).not.toBeNull();

        dismissFeedbackDot();   // 패널 첫 오픈
        expect(document.querySelector('#settings-toggle-btn .feedback-dot')).toBeNull();
        expect(localStorage.getItem('feedback_dot_seen')).toBe('1');

        dismissFeedbackHint();  // 의견 보내기 첫 클릭
        expect(document.querySelector('#feedback-btn .feedback-new')).toBeNull();
        expect(localStorage.getItem('feedback_hint_seen')).toBe('1');

        // 다음 부팅에는 표시되지 않음
        document.body.innerHTML = '';
        loadIndexHtml();
        initFeedbackHint();
        expect(document.querySelector('.feedback-dot')).toBeNull();
        expect(document.querySelector('.feedback-new')).toBeNull();
    });

    it('본문 컨텍스트에 XSS 문자가 있어도 모달이 이스케이프 렌더링', () => {
        showFeedbackModal('<img src=x onerror=alert(1)>');
        const ctx = document.querySelector('.feedback-ctx');
        expect(ctx.innerHTML).not.toContain('<img');
        expect(ctx.textContent).toContain('<img');
    });
});
