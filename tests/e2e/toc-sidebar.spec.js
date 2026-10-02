// tests/e2e/toc-sidebar.spec.js — 교재리더 TOC 사이드바 뷰포트 잘림 회귀
// @spec none (레이아웃 회귀 검증)
// 배경: .reader-toc가 calc(100vh - 200px) 매직넘버로 실제 크롬 높이(~380px)를
// 과소계상해 aside 하단이 뷰포트 밖으로 나감 → 스크롤바를 끝까지 내려도
// 마지막 목차 항목이 화면에 표시되지 않던 버그. 뷰가 flex 컬럼으로 잔여 높이를
// 채우고 .reader-layout의 확정 높이에 max-height:100%를 걸도록 교정했다.

import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
    page.addInitScript(() => {
        localStorage.setItem('onboarding_seen_v1', '1');
        localStorage.setItem('cosmetic:onboarding_seen_v1', '1');
        localStorage.setItem('cosmetic:quiz_results', '[]');
    });
});

test.describe('교재리더 TOC 사이드바', () => {
    test('TOC·본문 컬럼이 뷰포트 안에 들어오고 스크롤 끝에서 마지막 항목이 보인다', async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.evaluate(() => {
            document.querySelectorAll('#app-confirm-overlay, #onboarding-overlay').forEach(el => el.remove());
            location.hash = '/reader';
        });
        await expect(page.locator('#reader-subject-select')).toBeVisible({ timeout: 15_000 });

        const select = page.locator('#reader-subject-select');
        await select.selectOption({ index: 1 });
        await expect(page.locator('#reader-toc-list .reader-toc-item').first()).toBeVisible({ timeout: 30_000 });

        const m = await page.evaluate(() => {
            const toc = document.getElementById('reader-toc');
            const content = document.getElementById('textbook-reader-container');
            toc.scrollTop = toc.scrollHeight; // 스크롤 끝 상태에서 측정
            const tr = toc.getBoundingClientRect();
            const cr = content.getBoundingClientRect();
            const items = toc.querySelectorAll('.reader-toc-item, .reader-toc-sub-item');
            const last = items[items.length - 1].getBoundingClientRect();
            const mc = document.querySelector('.main-content');
            return {
                vh: window.innerHeight,
                tocBottom: tr.bottom,
                contentBottom: cr.bottom,
                contentClientH: content.clientHeight,
                mcCanScroll: mc.scrollHeight > mc.clientHeight + 2,
                lastItemBottom: last.bottom,
                lastItemTitle: items[items.length - 1].dataset.tocTitle,
            };
        });
        // TOC aside와 본문 컬럼 모두 뷰포트 안에 완전히 들어와야 함
        expect(m.tocBottom).toBeLessThanOrEqual(m.vh);
        expect(m.contentBottom).toBeLessThanOrEqual(m.vh);
        // 스크롤바를 끝까지 내린 상태에서 마지막 목차 항목이 보여야 함
        expect(m.lastItemBottom).toBeLessThanOrEqual(m.vh + 1);
        // 모바일 회귀: 펼친 툴바(~430px)가 flex 잔여 공간을 잠식해 본문이 34px로
        // 붕괴했던 문제 + 상단 크롬(컨트롤 세로 스택·툴바 패딩)이 본문을 349px로
        // 줄이던 문제 — 모바일은 뷰포트 55% 이상, 데스크톱은 펼친 툴바를
        // 감안해 35% 이상 확보해야 실질적 가독 영역
        const isMobile = test.info().project.name === 'mobile';
        expect(m.contentClientH).toBeGreaterThan(m.vh * (isMobile ? 0.55 : 0.35));

        // 본문 스크롤 → sticky-heading 표시돼도 본문 높이는 리플로우되지 않아야 함
        // (오버레이 배치 — 이전에는 인플로우라 표시 시 ~50px 영구 잠식)
        await page.evaluate(() => {
            const c = document.getElementById('textbook-reader-container');
            c.scrollTop = c.scrollTopMax || c.scrollHeight;
            c.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(400);
        const afterScroll = await page.evaluate(() =>
            document.getElementById('textbook-reader-container').clientHeight
        );
        expect(afterScroll).toBe(m.contentClientH);
    });
});
