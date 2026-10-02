// tests/e2e/toc-sidebar.spec.js — 교재리더 TOC 사이드바 뷰포트 잘림 회귀
// @spec TR-21~23,R-10,UX-NAV-09 (레이아웃 회귀 검증)
// 배경: .reader-toc가 calc(100vh - 200px) 매직넘버로 실제 크롬 높이(~380px)를
// 과소계상해 aside 하단이 뷰포트 밖으로 나감 → 스크롤바를 끝까지 내려도
// 마지막 목차 항목이 화면에 표시되지 않던 버그. 뷰가 flex 컬럼으로 잔여 높이를
// 채우고 .reader-layout의 확정 높이에 max-height:100%를 걸도록 교정했다.

import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
    page.addInitScript(() => {
        localStorage.setItem('current_exam', 'cosmetic');
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

        // ≤900px(태블릿·모바일)에서는 TOC가 translateX(-100%) 오프캔버스 드로어 — 열어서 측정
        const isDrawer = await page.evaluate(() =>
            getComputedStyle(document.getElementById('reader-toc')).position === 'fixed');
        if (isDrawer) {
            const btn = page.locator('#reader-toc-mobile-btn');
            if (await btn.isVisible()) await btn.click();
            await expect(page.locator('#reader-toc')).toHaveClass(/mobile-open/);
        }

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
        // TR-22/23: 리더 활성 시 페이지 스크롤러(.main-content)에 스크롤 범위가
        // 없어야 함 — 범위가 있으면 콘텐츠 밖 휠 입력에 뷰 전체가 밀린다
        expect(m.mcCanScroll).toBe(false);
        // 스크롤바를 끝까지 내린 상태에서 마지막 목차 항목이 보여야 함
        expect(m.lastItemBottom).toBeLessThanOrEqual(m.vh + 1);
        // TR-22/23 + R-10: 크롬이 오버레이로 전환되어 본문이 잔여 높이 전체 차지 —
        // 뷰포트의 60% 이상 확보해야 실질적 가독 영역 (모바일·데스크톱 공통)
        expect(m.contentClientH).toBeGreaterThan(m.vh * 0.6);

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

        // TR-22/23: 스크롤 다운 시 크롬 오버레이 자동 숨김 (공간 회수는 오버레이라 높이 불변)
        const chromeHidden = await page.evaluate(() =>
            document.getElementById('reader-chrome')?.classList.contains('reader-chrome-hidden')
        );
        expect(chromeHidden).toBe(true);
    });

    // TR-23: absolute 오버레이 요소가 .reader-layout 하단을 넘치면 그 오버플로가
    // 스크롤 조상(.main-content)의 scrollHeight로 전파되어 페이지 스크롤 범위를
    // 만든다 → 콘텐츠 밖 휠 입력에 뷰 전체가 위로 밀리는 버그의 회귀 검증.
    test('오버레이가 레이아웃을 넘쳐도 페이지 스크롤 범위가 생기지 않고 뷰가 밀리지 않는다', async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.evaluate(() => {
            document.querySelectorAll('#app-confirm-overlay, #onboarding-overlay').forEach(el => el.remove());
            location.hash = '/reader';
        });
        await page.locator('#reader-subject-select').selectOption({ index: 1 });
        await expect(page.locator('#reader-toc-list .reader-toc-item').first()).toBeVisible({ timeout: 30_000 });

        // 오버레이 요소(섹션 표시줄)를 레이아웃 하단 밖으로 강제 — 크롬 툴바 래핑·
        // 오디오 패널로 크롬이 넘치는 상황과 동등한 오버플로 상태 재현
        await page.evaluate(() => {
            const h = document.getElementById('reader-sticky-heading');
            h.classList.remove('is-hidden');
            h.style.top = '150vh';
        });
        const m = await page.evaluate(() => {
            const mc = document.querySelector('.main-content');
            // overflow:hidden 상태에선 scrollHeight가 오버플로를 포함해도 스크롤 불가 —
            // 실제 scrollTop 이동 시도로 스크롤 가능 여부를 판정한다
            mc.scrollTop = 9999;
            return {
                scrollTop: mc.scrollTop,
                overflowY: getComputedStyle(mc).overflowY,
            };
        });
        expect(m.overflowY).toBe('hidden');
        expect(m.scrollTop).toBe(0);

        // 콘텐츠 밖(뷰 가장자리)에서 휠 — 레이아웃 위치가 불변이어야 함
        const topBefore = await page.evaluate(() =>
            document.getElementById('reader-layout').getBoundingClientRect().top
        );
        await page.mouse.move(10, 400);
        for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(50); }
        const topAfter = await page.evaluate(() =>
            document.getElementById('reader-layout').getBoundingClientRect().top
        );
        expect(topAfter).toBe(topBefore);
    });
});
