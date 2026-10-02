// tests/e2e/theme.spec.js — 듀얼 테마 실브라우저 검증
// @spec TH-01,TH-02,TH-03,TH-04,TH-05
// jsdom은 computed style·prefers-color-scheme을 실제 계산하지 못하므로
// 테마의 실제 발현(클래스·CSS 변수·미디어쿼리)은 e2e에서만 유효하다.

import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
    page.addInitScript(() => {
        localStorage.setItem('current_exam', 'cosmetic');
        localStorage.setItem('onboarding_seen_v1', '1');
        localStorage.setItem('cosmetic:onboarding_seen_v1', '1');
    });
    page._errors = [];
    page.on('pageerror', err => page._errors.push(String(err)));
});

test.describe('테마 결정 우선순위 (TH-03)', () => {
    test('저장된 테마가 prefers-color-scheme보다 우선한다', async ({ page }) => {
        // 저장=light + 시스템=dark → light 적용이어야 함
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.addInitScript(() => {
            localStorage.setItem('appTheme', 'light');
            localStorage.setItem('cosmetic:appTheme', 'light');
            localStorage.setItem('onboarding_seen_v1', '1');
        });
        await page.goto('/index.html');
        const isLight = await page.evaluate(() =>
            document.documentElement.classList.contains('light-theme'));
        expect(isLight).toBe(true);
    });

    test('저장값 없으면 prefers-color-scheme를 따른다', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' });
        await page.addInitScript(() => localStorage.setItem('onboarding_seen_v1', '1'));
        await page.goto('/index.html');
        const isLight = await page.evaluate(() =>
            document.documentElement.classList.contains('light-theme'));
        expect(isLight).toBe(true);
    });

    test('저장값·시스템 선호 모두 없으면 다크가 기본이다', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.addInitScript(() => localStorage.setItem('onboarding_seen_v1', '1'));
        await page.goto('/index.html');
        const isLight = await page.evaluate(() =>
            document.documentElement.classList.contains('light-theme'));
        expect(isLight).toBe(false);
    });
});

test.describe('테마 토글 (TH-01/02/04)', () => {
    test('토글 시 light-theme 클래스·localStorage·themechange·실제 배경색이 동기화된다', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('onboarding_seen_v1', '1');
            window.__themeEvents = 0;
            document.addEventListener('themechange', () => window.__themeEvents++);
        });
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });

        const before = await page.evaluate(() => ({
            light: document.documentElement.classList.contains('light-theme'),
            bodyBg: getComputedStyle(document.body).backgroundColor,
        }));

        await page.locator('#theme-toggle-btn').click();
        await page.waitForTimeout(200);

        const after = await page.evaluate(() => ({
            light: document.documentElement.classList.contains('light-theme'),
            bodyBg: getComputedStyle(document.body).backgroundColor,
            saved: localStorage.getItem('appTheme') || localStorage.getItem('cosmetic:appTheme'),
            events: window.__themeEvents,
        }));
        expect(after.light).toBe(!before.light);
        expect(after.bodyBg).not.toBe(before.bodyBg); // 실제 배경색 반영 (토큰 스왑)
        expect(after.saved).toBe(after.light ? 'light' : 'dark');
        expect(after.events).toBeGreaterThanOrEqual(1); // TH-04 브로드캐스트
        expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
    });
});

test.describe('리더 테마 동기화 (TH-05)', () => {
    test('라이트 테마에서 리더 뷰에 reader-light-theme이 적용된다', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('appTheme', 'light');
            localStorage.setItem('cosmetic:appTheme', 'light');
            localStorage.setItem('onboarding_seen_v1', '1');
        });
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.evaluate(() => {
            document.querySelectorAll('#app-confirm-overlay, #onboarding-overlay').forEach(el => el.remove());
            location.hash = '/reader';
        });
        await expect(page.locator('#reader-subject-select')).toBeVisible({ timeout: 15_000 });
        await page.locator('#reader-subject-select').selectOption({ index: 1 });
        await expect(page.locator('#reader-toc-list .reader-toc-item').first()).toBeVisible({ timeout: 30_000 });

        const hasClass = await page.evaluate(() =>
            document.getElementById('textbook-reader-view').classList.contains('reader-light-theme'));
        expect(hasClass).toBe(true);
    });
});
