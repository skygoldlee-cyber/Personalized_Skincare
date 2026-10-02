// tests/e2e/a11y-interaction.spec.js — 접근성 상호작용 실브라우저 검증
// @spec A-02,A-05,A-06,A-07,UX-FB-01,UX-FB-05
// 키보드 탐색·focus-visible·reduced-motion·커스텀 토스트/컨펌·온보딩 1회성은
// 실제 입력·미디어 쿼리가 필요해 jsdom 불가 — e2e에서만 유효하다.

import { test, expect } from '@playwright/test';

const seed = () => {
    localStorage.setItem('current_exam', 'cosmetic');
    localStorage.setItem('onboarding_seen_v1', '1');
    localStorage.setItem('cosmetic:onboarding_seen_v1', '1');
};

test.beforeEach(({ page }) => {
    page._errors = [];
    page.on('pageerror', err => page._errors.push(String(err)));
    page.addInitScript(seed);
});

async function boot(page) {
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
}

test.describe('접근성 상호작용', () => {
    test('플래시카드가 키보드(Enter/Space)로 뒤집힌다 (A-02)', async ({ page }) => {
        test.setTimeout(60_000);
        await boot(page);
        const nav = page.locator('.nav-item[data-target="flashcard-view"]:visible, .mobile-tab-item[data-target="flashcard-view"]:visible');
        if (await nav.count()) {
            await nav.first().click();
        } else {
            await page.locator('#mobile-more-btn').click();
            await page.locator('#mobile-more-sheet [data-target="flashcard-view"]').first().click();
        }
        await expect(page.locator('#flashcard-view')).toBeVisible();
        await page.locator('#fc-subject-select').selectOption({ index: 1 });
        const card = page.locator('#flashcard-item');
        await expect(card).toBeVisible({ timeout: 20_000 });
        await card.focus();
        await page.keyboard.press('Enter');
        await expect(card).toHaveClass(/flipped/);
        expect(await card.getAttribute('aria-expanded')).toBe('true');
        await page.keyboard.press('Enter');
        await expect(card).not.toHaveClass(/flipped/);
        expect(await card.getAttribute('aria-expanded')).toBe('false');
    });

    test('키보드 탐색 시 :focus-visible 포커스 링이 표시된다 (A-05)', async ({ page }) => {
        await boot(page);
        // Tab으로 첫 초점 이동 — :focus-visible은 키보드 입력에서만 발동
        await page.keyboard.press('Tab');
        const m = await page.evaluate(() => {
            const el = document.activeElement;
            const cs = getComputedStyle(el);
            return { tag: el.tagName, outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle };
        });
        expect(m.tag).not.toBe('BODY');
        expect(m.outlineStyle).toBe('solid');
        expect(parseFloat(m.outlineWidth)).toBeGreaterThanOrEqual(2);
    });

    test('prefers-reduced-motion에서 애니메이션이 축소된다 (A-06)', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await boot(page);
        const durs = await page.evaluate(() => {
            const el = document.querySelector('.view-section.active') || document.body;
            const cs = getComputedStyle(el);
            return { anim: cs.animationDuration, trans: cs.transitionDuration };
        });
        // 규약: animation/transition 0.01ms 축소
        expect(parseFloat(durs.anim)).toBeLessThan(0.001);
        expect(parseFloat(durs.trans)).toBeLessThan(0.001);
    });

    test('커스텀 토스트·컨펌이 네이티브 대체로 동작한다 (A-07, UX-FB-01)', async ({ page }) => {
        await boot(page);
        const isMobile = await page.evaluate(() => window.innerWidth <= 768);
        // showToast — 실제 모듈 경유 호출 (UI 일관성 검증)
        await page.evaluate(async () => {
            const m = await import('./src/ui-utils.js');
            m.showToast('e2e 검증 토스트', 'info');
        });
        const item = page.locator('.app-toast-item.is-visible');
        await expect(item).toBeVisible();
        await expect(page.locator('#app-toast')).toHaveAttribute('role', 'status');
        // UX-FB-01: 모바일에서는 하단(탭 바 위) 배치 — 중앙 팝업 금지
        if (isMobile) {
            const geom = await page.evaluate(() => ({
                top: document.querySelector('.app-toast-item').getBoundingClientRect().top,
                vh: window.innerHeight,
            }));
            expect(geom.top).toBeGreaterThan(geom.vh * 0.5);
        }
        // 자동 소멸
        await expect(item).toHaveCount(0, { timeout: 6_000 });
        // showConfirm — 다이얼로그·포커스 트랩·Esc 취소
        await page.evaluate(async () => {
            const m = await import('./src/ui-utils.js');
            window.__confirmResult = undefined;
            m.showConfirm('e2e 확인?', 'e2e').then(r => { window.__confirmResult = r; });
        });
        await expect(page.locator('.app-confirm-dialog.is-visible')).toBeVisible();
        // 포커스 트랩: Tab을 반복해도 다이얼로그 밖으로 나가지 않는다
        for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
        const trapped = await page.evaluate(() =>
            document.querySelector('.app-confirm-dialog').contains(document.activeElement));
        expect(trapped).toBe(true);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => window.__confirmResult === false);
        await expect(page.locator('#app-confirm-overlay')).toHaveCount(0, { timeout: 3_000 });
    });

    test('온보딩은 최초 방문에서 1회만 표시된다 (UX-FB-05)', async ({ page }) => {
        await boot(page);
        // 재방문(플래그 보유) — 자동 표시 없음
        await page.evaluate(async () => {
            const m = await import('./src/onboarding.js');
            m.maybeShowOnboarding();
        });
        await page.waitForTimeout(300);
        expect(await page.locator('#onboarding-overlay').count()).toBe(0);
        // 최초 방문(플래그·기존 사용자 힌트 모두 제거) — 모달 표시
        await page.evaluate(async () => {
            ['onboarding_seen_v1', 'cosmetic:onboarding_seen_v1', 'quiz_results', 'fc_memorized', 'study_streak', 'sim_results_history']
                .forEach(k => localStorage.removeItem(k));
            const m = await import('./src/onboarding.js');
            m.maybeShowOnboarding();
        });
        const overlay = page.locator('#onboarding-overlay');
        await expect(overlay).toHaveClass(/is-visible/, { timeout: 5_000 });
        // 표시와 무관하게 플래그가 즉시 기록된다 — 재호출 시 비표시
        const flagged = await page.evaluate(() =>
            !!(localStorage.getItem('onboarding_seen_v1') || localStorage.getItem('cosmetic:onboarding_seen_v1')));
        expect(flagged).toBe(true);
        const closeBtn = overlay.locator('button').first();
        if (await closeBtn.isVisible()) await closeBtn.click();
        await page.evaluate(async () => {
            const m = await import('./src/onboarding.js');
            m.maybeShowOnboarding();
        });
        await page.waitForTimeout(300);
        // 플래그가 있으면 재표시되지 않는다 — 닫힌 오버레이는 DOM에서 제거됨
        await expect(overlay).toHaveCount(0);
    });
});
