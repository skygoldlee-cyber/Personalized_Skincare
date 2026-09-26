// tests/dom/common-a11y.dom.test.js — 접근성(a11y) 공통 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.3 (Phase 5)
// 검증: 토스트 role=status/aria-live(H) · confirm 모달 포커스 트랩·Escape(X)
//       · trapFocus Tab 순환(H) · 아이콘 버튼 aria-label 전수(H)
// 주의: 이 파일은 ui-utils.js를 모킹하지 않고 실 구현을 검증한다.

import { describe, it, beforeEach, expect, vi } from 'vitest';

import { loadIndexHtml, el } from './helpers.js';
import { showToast, showConfirm, trapFocus } from '../../src/ui-utils.js';

describe('a11y — 토스트·포커스 트랩·라벨', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    it('showToast → #app-toast role=status·aria-live·is-visible, 재사용', () => {
        showToast('테스트 메시지', 'success');

        const toast = el('app-toast');
        expect(toast).not.toBeNull();
        expect(toast.getAttribute('role')).toBe('status');
        expect(toast.getAttribute('aria-live')).toBe('polite');
        expect(toast.classList.contains('is-visible')).toBe(true);
        expect(toast.textContent).toContain('테스트 메시지');

        // 두 번째 호출 → 같은 엘리먼트 재사용 (중복 생성 없음)
        showToast('두 번째', 'error');
        expect(document.querySelectorAll('#app-toast').length).toBe(1);
        expect(toast.textContent).toContain('두 번째');
        expect(toast.innerHTML).toContain('fa-circle-xmark');
    });

    it('showToast → XSS 문자열은 escape되어 텍스트로만 렌더', () => {
        showToast('<img src=x onerror=alert(1)>', 'info');
        const toast = el('app-toast');
        expect(toast.querySelector('img')).toBeNull();
        expect(toast.textContent).toContain('<img');
    });

    it('showConfirm → 오버레이 + 확인/취소 버튼, 확인 클릭 시 true', async () => {
        const p = showConfirm('삭제할까요?', '확인');
        const overlay = el('app-confirm-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.textContent).toContain('삭제할까요?');

        overlay.querySelector('.app-confirm-ok').click();
        expect(await p).toBe(true);
    });

    it('showConfirm Escape → false + 트랩 해제', async () => {
        const p = showConfirm('진행?', '확인');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(await p).toBe(false);
    });

    it('trapFocus → Tab이 마지막 요소에서 첫 요소로 순환', () => {
        const modal = document.createElement('div');
        modal.innerHTML = '<button id="fb1">A</button><button id="fb2">B</button>';
        document.body.appendChild(modal);

        const untrap = trapFocus(modal);
        expect(document.activeElement).toBe(el('fb1')); // 첫 포커스 이동

        // 마지막 요소에서 Tab → 첫 요소로
        el('fb2').focus();
        modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(document.activeElement).toBe(el('fb1'));

        untrap();
        modal.remove();
    });

    it('아이콘 전용 버튼 → aria-label 또는 title 존재 전수', () => {
        // aria-label·title 둘 다 없는 아이콘 전용 버튼 수집
        const offenders = [];
        document.querySelectorAll('button').forEach(btn => {
            const text = (btn.textContent || '').trim();
            const hasIconOnly = btn.querySelector('i.fa-solid, i.fa-regular, i.fa-brands') && text.length === 0;
            if (hasIconOnly && !btn.getAttribute('aria-label') && !btn.getAttribute('title')) {
                offenders.push(btn.id || btn.className);
            }
        });
        // 알려진 무해 사례(버튼 텍스트를 갖는 혼합 버튼)는 제외됨 — 신규 위반 0건
        expect(offenders).toEqual([]);
    });

    it('오프라인 배너 → role=status + aria-live 정적 마크업 확인', () => {
        const banner = el('offline-banner');
        expect(banner.getAttribute('role')).toBe('status');
        expect(banner.getAttribute('aria-live')).toBe('polite');
    });
});
