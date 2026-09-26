// tests/dom/common-theme.dom.test.js — 테마 토글 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.3 (Phase 5)
// 검증: 토글→light-theme 클래스·localStorage·아이콘·theme-color(H/P)
//       · 모바일 버튼 동기화(H) · 시스템 테마 변경 추종(B)

import { describe, it, beforeEach, expect, vi } from 'vitest';

import { loadIndexHtml, el } from './helpers.js';
import { setupThemeToggle } from '../../src/theme-toggle.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

describe('테마 — 토글·영속·시스템 연동', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        document.documentElement.classList.remove('light-theme');
        delete window.AppTheme;
        vi.clearAllMocks();
    });

    it('초기화 → AppTheme API 노출, 기본 다크 (moon 아이콘)', () => {
        setupThemeToggle();

        expect(window.AppTheme).toBeDefined();
        expect(window.AppTheme.isLight()).toBe(false);
        expect(el('theme-toggle-btn').querySelector('i').className).toContain('fa-moon');
    });

    it('토글 클릭 → 라이트 테마 + localStorage + 메타색 + 아이콘 전환 (H/P)', () => {
        const events = [];
        document.addEventListener('themechange', (e) => events.push(e.detail.light));
        setupThemeToggle();

        el('theme-toggle-btn').click();

        expect(document.documentElement.classList.contains('light-theme')).toBe(true);
        expect(localStorage.getItem(STORAGE_KEYS.APP_THEME)).toBe('light');
        expect(el('theme-toggle-btn').querySelector('i').className).toContain('fa-sun');
        expect(el('theme-toggle-btn').title).toContain('다크');
        expect(events).toEqual([true]);

        // 모바일 버튼도 동기화
        expect(el('mobile-theme-toggle').querySelector('i').className).toContain('fa-sun');
    });

    it('재토글 → 다크 복귀', () => {
        setupThemeToggle();
        el('theme-toggle-btn').click();
        el('mobile-theme-toggle').click(); // 모바일 버튼으로 다시 토글

        expect(document.documentElement.classList.contains('light-theme')).toBe(false);
        expect(localStorage.getItem(STORAGE_KEYS.APP_THEME)).toBe('dark');
    });

    it('시스템 테마 변경 → 저장된 선택이 없을 때만 추종 (B)', () => {
        let mediaListener = null;
        window.matchMedia = vi.fn(() => ({
            matches: false,
            addEventListener: (ev, cb) => { if (ev === 'change') mediaListener = cb; },
            addListener: (cb) => { mediaListener = cb; },
        }));
        setupThemeToggle();

        // 미저장 → 시스템 라이트로 전환에 따라감
        mediaListener({ matches: true });
        expect(document.documentElement.classList.contains('light-theme')).toBe(true);

        // 수동 선택 저장 후 → 추종 중단
        window.AppTheme.apply(false);
        mediaListener({ matches: true });
        expect(document.documentElement.classList.contains('light-theme')).toBe(false);
    });
});
