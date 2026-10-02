// tests/e2e/a11y.spec.js — 접근성 자동 스캔 (axe-core, 실브라우저)
// @spec A-01,A-03,A-04,UX-NAV-04
// ARIA·대비·터치 타겟은 실제 렌더링 DOM에서만 검증 가능 — jsdom 불가.
// 심각(critical/serious) 위반 0건을 게이트로 고정한다.
// moderate/minor는 보고만 — 기존 백로그가 있을 수 있어 점진 정리 대상.

import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// 알려진 axe 오탐 — 문서화된 예외만 허용 (새 예외 추가 시 근거 필수)
const KNOWN_FALSE_POSITIVES = [
    {
        rule: 'color-contrast',
        targetRe: /^(select\.form-select|#fc-subject-select|#fc-difficulty-select)$/,
        why: 'axe-core가 <select> 표시값을 UA 내부 색(#696c6f)으로 오계측 — 실측 getComputedStyle은 fg #1f2937 on #d7d2c1 = 9.7:1로 A-03 충족',
    },
];

function isFp(v, node) {
    const target = node.target.join(' ');
    return KNOWN_FALSE_POSITIVES.some(fp =>
        fp.rule === v.id && fp.targetRe.test(target));
}

async function scan(page, label) {
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    // 오탐 노드를 제거하고 남은 노드가 없으면 위반 자체를 제외
    const real = results.violations
        .map(v => ({ ...v, nodes: v.nodes.filter(n => !isFp(v, n)) }))
        .filter(v => v.nodes.length > 0);
    const bad = real.filter(v => v.impact === 'critical' || v.impact === 'serious');
    if (real.length) {
        console.log(`[a11y:${label}] violations=${real.length} (serious+=${bad.length})`);
        for (const v of real) {
            console.log(`  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}개 노드)`);
            for (const n of v.nodes.slice(0, 8)) {
                const d = n.any?.[0]?.data || {};
                console.log(`      → ${n.target.join(' ')} | fg=${d.fgColor} bg=${d.bgColor} ratio=${d.contrastRatio} (필요 ${d.expectedContrastRatio})`);
            }
        }
    }
    return bad;
}

test.beforeEach(async ({ page }) => {
    page._errors = [];
    page.on('pageerror', err => page._errors.push(String(err)));
    await page.addInitScript(() => {
        localStorage.setItem('current_exam', 'cosmetic');
        localStorage.setItem('onboarding_seen_v1', '1');
        localStorage.setItem('cosmetic:onboarding_seen_v1', '1');
    });
});

test.describe('접근성 자동 스캔 (A-01/03/04)', () => {
    test('대시보드: 심각 위반 0건', async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        const bad = await scan(page, 'dashboard');
        expect(bad.map(v => v.id)).toEqual([]);
    });

    test('학습 뷰(플래시카드): 심각 위반 0건', async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        const nav = page.locator('.nav-item[data-target="flashcard-view"]:visible, .mobile-tab-item[data-target="flashcard-view"]:visible');
        await nav.first().click();
        await expect(page.locator('#flashcard-view')).toBeVisible();
        // 셀렉트 옵션이 데이터 로드로 채워질 때까지 대기 — 미채움 상태는 UA가 dim 처리
        await page.waitForFunction(() =>
            document.getElementById('fc-subject-select')?.options.length > 1, null, { timeout: 20_000 });
        const bad = await scan(page, 'flashcard');
        expect(bad.map(v => v.id)).toEqual([]);
    });

    test('설정 패널 오픈 상태: 심각 위반 0건', async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.locator('#settings-toggle-btn').click();
        await expect(page.locator('#settings-panel')).not.toHaveClass(/is-hidden/);
        const bad = await scan(page, 'settings');
        expect(bad.map(v => v.id)).toEqual([]);
    });

    test('다크 테마 — 대시보드·플래시카드: 심각 위반 0건', async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.evaluate(() => localStorage.setItem('appTheme', 'dark'));
        await page.reload();
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        let bad = await scan(page, 'dashboard-dark');
        const nav = page.locator('.nav-item[data-target="flashcard-view"]:visible, .mobile-tab-item[data-target="flashcard-view"]:visible');
        await nav.first().click();
        await expect(page.locator('#flashcard-view')).toBeVisible();
        await page.waitForFunction(() =>
            document.getElementById('fc-subject-select')?.options.length > 1, null, { timeout: 20_000 });
        bad = bad.concat(await scan(page, 'flashcard-dark'));
        expect(bad.map(v => v.id)).toEqual([]);
    });

    test('주요 뷰에서 가로 오버플로가 발생하지 않는다 (UX-NAV-04)', async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.evaluate(() =>
            document.querySelectorAll('#onboarding-overlay, #app-confirm-overlay').forEach(el => el.remove()));
        for (const target of ['dashboard-view', 'flashcard-view', 'quiz-view', 'textbook-view', 'dictionary-view']) {
            const nav = page.locator(`.nav-item[data-target="${target}"]:visible, .mobile-tab-item[data-target="${target}"]:visible`).first();
            if (await nav.count()) {
                await nav.click();
            } else {
                // 탭 바에 없는 뷰 — 더보기 시트 경유 (모바일)
                const more = page.locator('#mobile-more-btn');
                if (!(await more.isVisible())) continue;
                await more.click();
                const item = page.locator(`#mobile-more-sheet [data-target="${target}"]`).first();
                if (!(await item.count())) {
                    await page.locator('#more-sheet-close').click();
                    continue;
                }
                await item.click();
            }
            await expect(page.locator(`#${target}`)).toBeVisible({ timeout: 10_000 });
            const over = await page.evaluate(() => ({
                sw: document.documentElement.scrollWidth,
                iw: window.innerWidth,
                view: document.querySelector('.view-section.active')?.id,
            }));
            expect(over.sw, `${over.view} 가로 오버플로 ${over.sw}>${over.iw}`).toBeLessThanOrEqual(over.iw + 1);
        }
    });
});
