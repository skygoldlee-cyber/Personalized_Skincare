// tests/dom/onboarding-zoom.dom.test.js — 첫 방문 시작 안내 + 이미지 라이트박스
// @spec UX-FB-05, TR-20
// UX-FB-05: 학습 데이터 없는 최초 방문 1회만 표시 — 재방문 사용자는 방해 금지
// TR-20: .reader-img 클릭 → 전체화면 확대 모달, 닫기 시 상태 정리

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    trapFocus: vi.fn(() => () => {}),
}));

vi.mock('../../src/exam-context.js', () => ({
    getExamAppName: () => 'Passmula',
}));

// state.js의 safeGetItem/safeSetItem을 localStorage 위임으로 대체
vi.mock('../../src/state.js', () => ({
    safeGetItem: (k) => localStorage.getItem(k),
    safeSetItem: (k, v) => localStorage.setItem(k, v),
}));

import { showOnboardingModal, maybeShowOnboarding } from '../../src/onboarding.js';
import { openImageZoom, closeImageZoom, attachImageZoomIn } from '../../src/image-zoom.js';

beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
});

describe('UX-FB-05 첫 방문 시작 안내', () => {
    it('학습 데이터가 없으면 모달을 1회 표시하고 seen 플래그를 기록한다', () => {
        maybeShowOnboarding();
        expect(document.getElementById('onboarding-overlay')).toBeTruthy();
        expect(localStorage.getItem('onboarding_seen_v1')).toBe('1');
        expect(document.querySelectorAll('.onboarding-step')).toHaveLength(3);
    });

    it('기존 사용자(학습 키 존재)는 플래그만 기록하고 모달을 띄우지 않는다', () => {
        localStorage.setItem('quiz_results', '{}');
        maybeShowOnboarding();
        expect(document.getElementById('onboarding-overlay')).toBeNull();
        expect(localStorage.getItem('onboarding_seen_v1')).toBe('1');
    });

    it('seen 플래그가 있으면 재표시하지 않는다', () => {
        localStorage.setItem('onboarding_seen_v1', '1');
        maybeShowOnboarding();
        expect(document.getElementById('onboarding-overlay')).toBeNull();
    });

    it('설정 메뉴 재열람 경로 — showOnboardingModal은 항상 표시한다', () => {
        localStorage.setItem('quiz_results', '{}');
        showOnboardingModal();
        const dialog = document.querySelector('#onboarding-overlay [role="dialog"]');
        expect(dialog).toBeTruthy();
        expect(dialog.textContent).toContain('시작 안내');
    });
});

describe('TR-20 이미지 라이트박스', () => {
    it('openImageZoom이 전체화면 모달에 이미지를 복제해 표시한다', () => {
        const img = document.createElement('img');
        img.src = 'data/exams/cosmetic/img.png';
        img.className = 'reader-img';
        document.body.appendChild(img);

        openImageZoom(img);

        const modal = document.getElementById('reader-img-zoom-modal');
        expect(modal).toBeTruthy();
        expect(modal.classList.contains('is-hidden')).toBe(false);
        expect(modal.querySelector('.img-zoom-target')).toBeTruthy();

        closeImageZoom();
        expect(modal.classList.contains('is-hidden')).toBe(true);
    });

    it('attachImageZoomIn은 컨테이너 위임으로 .reader-img 클릭을 연결한다', () => {
        const root = document.createElement('div');
        const img = document.createElement('img');
        img.src = 'x.png';
        img.className = 'reader-img';
        root.appendChild(img);
        document.body.appendChild(root);

        attachImageZoomIn(root);
        img.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
        img.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));

        expect(document.getElementById('reader-img-zoom-modal')).toBeTruthy();
        // 드래그(10px 이상)는 클릭으로 취급하지 않는다
        closeImageZoom();
        document.getElementById('reader-img-zoom-modal')?.remove();
        img.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
        img.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 0 }));
        expect(document.getElementById('reader-img-zoom-modal')?.classList.contains('is-hidden') ?? true).toBe(true);
    });
});
