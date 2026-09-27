// tests/e2e/flows.spec.js — 핵심 학습 플로우·오프라인 동작·CSP 하 Mermaid 렌더 (실브라우저)
// @spec none (인프라 — UI 조합 플로우 검증)
// serve.js가 vercel.json 헤더를 미러링하므로 이 테스트들은 실제 프로덕션
// CSP(script-src 'self' — unsafe-eval 없음) 하에서 실행된다.

import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
    page._errors = [];
    page.on('pageerror', err => page._errors.push(String(err)));
});

test.describe('학습 플로우', () => {
    test('퀴즈 완주 → 결과 패널 + 진도가 localStorage에 저장된다', async ({ page }) => {
        test.setTimeout(90_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });

        const nav = page.locator('.nav-item[data-target="quiz-view"]:visible, .mobile-tab-item[data-target="quiz-view"]:visible');
        await nav.first().click();

        // 첫 번째 실제 과목 옵션 선택 → 퀴즈 시작 (과목 번들 온디맨드 로드)
        const select = page.locator('#quiz-subject-select');
        const value = await select.locator('option').nth(1).getAttribute('value');
        await select.selectOption(value);
        await page.locator('#start-quiz-btn').click();
        await expect(page.locator('#quiz-arena-panel')).toBeVisible({ timeout: 30_000 });

        // 최대 10문제 — 유형(객관식/OX/단답)에 따라 응답
        for (let i = 0; i < 10; i++) {
            if (await page.locator('#quiz-result-panel').isVisible()) break;
            const options = page.locator('#quiz-options-container:not(.is-hidden) button');
            const ox = page.locator('#quiz-ox-container:not(.is-hidden) .quiz-ox-btn');
            const input = page.locator('#quiz-input-group:not(.is-hidden) #quiz-answer-input');
            if (await options.count()) await options.first().click();
            else if (await ox.count()) await ox.first().click();
            else {
                await input.fill('1');
                await page.locator('#submit-quiz-btn').click();
            }
            await expect(page.locator('#next-quiz-btn')).toBeVisible({ timeout: 10_000 });
            await page.locator('#next-quiz-btn').click();
        }

        await expect(page.locator('#quiz-result-panel')).toBeVisible({ timeout: 10_000 });
        const saved = await page.evaluate(() => localStorage.getItem('cosmetic:quiz_results'));
        expect(saved).toBeTruthy();
        expect(Object.keys(JSON.parse(saved)).length).toBeGreaterThan(0);
        expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
    });
});

test.describe('오프라인 동작', () => {
    test('네트워크 차단 시 오프라인 배너가 표시된다', async ({ page, context }) => {
        // 배너는 의도적으로 보수적 — 유예(15s) 후 연속 실패 3회에 표시 (최대 ~30s)
        test.setTimeout(90_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await context.setOffline(true);
        await expect(page.locator('#offline-banner')).toHaveClass(/show/, { timeout: 60_000 });
    });
});

test.describe('프로덕션 CSP 하 콘텐츠 렌더', () => {
    test("script-src 'self' (unsafe-eval 없음)에서 Mermaid 다이어그램이 렌더된다", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });

        // CSP 헤더가 실제로 적용됐는지 선 확인 — 미러링 회귀 시 즉시 실패
        const csp = await page.evaluate(async () =>
            (await fetch(location.pathname, { method: 'HEAD' })).headers.get('content-security-policy'));
        expect(csp).toContain("script-src 'self'");
        expect(csp).not.toContain('unsafe-eval');

        // 학습안내서(user_manual)에 mermaid 블록 포함 — 지연 로딩 후 렌더
        await page.locator('[data-click="ManualViewer.openManual"]:visible').first().click();
        const article = page.locator('#manual-article');
        await expect(article).toBeVisible({ timeout: 15_000 });
        await expect(article.locator('pre.mermaid svg').first()).toBeVisible({ timeout: 30_000 });
        await expect(article.locator('text=다이어그램 렌더링 실패')).toHaveCount(0);
        expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
    });
});
