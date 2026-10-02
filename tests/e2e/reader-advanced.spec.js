// tests/e2e/reader-advanced.spec.js — 리더 고급 기능 실브라우저 회귀
// @spec TR-06,TR-10,TR-15,TR-16,TR-16a,TR-20
// 계층 TOC·모바일 드로어 제스처·툴바 자동숨김·Mermaid/이미지 모달·기출 링크 뷰어 —
// 레이아웃·제스처·오버레이 상호작용이라 jsdom 불가.

import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
    page._errors = [];
    page.on('pageerror', err => page._errors.push(String(err)));
    page.addInitScript(() => {
        localStorage.setItem('current_exam', 'cosmetic');
        localStorage.setItem('onboarding_seen_v1', '1');
        localStorage.setItem('cosmetic:onboarding_seen_v1', '1');
    });
});

async function openReader(page) {
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
    await page.evaluate(() => {
        document.querySelectorAll('#app-confirm-overlay, #onboarding-overlay').forEach(el => el.remove());
        location.hash = '/reader';
    });
    await expect(page.locator('#reader-subject-select')).toBeVisible({ timeout: 15_000 });
    await page.locator('#reader-subject-select').selectOption({ index: 1 });
    await expect(page.locator('#reader-toc-list .reader-toc-item').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() =>
        document.querySelectorAll('#textbook-reader-container .reader-section-card').length > 0,
        null, { timeout: 30_000 });
}

/** ≤900px에서는 TOC가 오프캔버스 드로어 — 열려있지 않으면 모바일 버튼으로 연다 */
async function ensureTocOpen(page) {
    const drawer = await page.evaluate(() =>
        getComputedStyle(document.getElementById('reader-toc')).position === 'fixed');
    if (!drawer) return;
    const isOpen = await page.evaluate(() =>
        document.getElementById('reader-toc').classList.contains('mobile-open'));
    if (!isOpen) {
        await page.locator('#reader-toc-mobile-btn').click();
        await expect(page.locator('#reader-toc')).toHaveClass(/mobile-open/);
    }
}

const isDrawerViewport = page =>
    page.evaluate(() => window.innerWidth <= 900);

test.describe('교재리더 고급 기능', () => {
    test('계층형 TOC가 챕터별로 접히고 펼쳐진다 (TR-15)', async ({ page }) => {
        test.setTimeout(60_000);
        await openReader(page);
        await ensureTocOpen(page);
        const toggle = page.locator('#reader-toc-list .toc-toggle-icon').first();
        if (!(await toggle.count())) { test.skip(true, '하위 항목이 있는 TOC 없음'); return; }
        const children = page.locator('#reader-toc-list .reader-toc-children').first();
        const wasCollapsed = await children.evaluate(el => el.classList.contains('collapsed'));
        // 드로어 내부 스크롤 영역의 아이콘은 뷰포트 밖일 수 있음 — DOM 디스패치로 토글 검증
        await toggle.evaluate(el => el.click());
        await page.waitForTimeout(250);
        const isCollapsed = await children.evaluate(el => el.classList.contains('collapsed'));
        expect(isCollapsed).toBe(!wasCollapsed);
    });

    test('드로어: 엣지 힌트로 열고 백드롭/항목 클릭으로 닫는다 (TR-16)', async ({ page }) => {
        if (!(await isDrawerViewport(page))) { test.skip(true, '≤900px 드로어 전용'); return; }
        test.setTimeout(60_000);
        await openReader(page);
        // 엣지 힌트 탭 → 드로어 오픈
        const hint = page.locator('#reader-toc-edge-hint');
        if (await hint.isVisible()) {
            await hint.click();
            await expect(page.locator('#reader-toc')).toHaveClass(/mobile-open/);
        } else {
            await page.locator('#reader-toc-mobile-btn').click();
            await expect(page.locator('#reader-toc')).toHaveClass(/mobile-open/);
        }
        // 백드롭 클릭 → 닫힘
        await page.locator('#reader-toc-backdrop').click({ force: true });
        await expect(page.locator('#reader-toc')).not.toHaveClass(/mobile-open/);
        // 다시 열고 항목 클릭 → 닫힘
        await page.locator('#reader-toc-mobile-btn').click();
        await expect(page.locator('#reader-toc')).toHaveClass(/mobile-open/);
        await page.locator('#reader-toc-list .reader-toc-item').first().click();
        await page.waitForTimeout(300);
        await expect(page.locator('#reader-toc')).not.toHaveClass(/mobile-open/);
    });

    test('스크롤 다운 시 크롬이 자동 숨겨지고 업 시 복귀한다 (TR-16a)', async ({ page }) => {
        test.setTimeout(60_000);
        await openReader(page);
        const chrome = page.locator('#reader-chrome');
        await expect(chrome).not.toHaveClass(/reader-chrome-hidden/);
        await page.evaluate(() => {
            const c = document.getElementById('textbook-reader-container');
            c.scrollTop = Math.min(800, c.scrollHeight - c.clientHeight);
            c.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(400);
        await expect(chrome).toHaveClass(/reader-chrome-hidden/);
        await page.evaluate(() => {
            const c = document.getElementById('textbook-reader-container');
            c.scrollTop = Math.max(0, c.scrollTop - 400);
            c.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(400);
        await expect(chrome).not.toHaveClass(/reader-chrome-hidden/);
    });

    test('본문 Mermaid 다이어그램이 렌더되고 확대 모달이 동작한다 (TR-06)', async ({ page }) => {
        test.setTimeout(90_000);
        await openReader(page);
        const count = await page.evaluate(() =>
            document.querySelectorAll('#textbook-reader-container .mermaid, #textbook-reader-container pre.mermaid').length);
        if (!count) { test.skip(true, '선택 과목 챕터에 Mermaid 없음'); return; }
        // 온디맨드 렌더 완료 대기 — svg가 채워질 때까지
        await page.waitForFunction(() =>
            document.querySelector('#textbook-reader-container .mermaid svg, #textbook-reader-container pre.mermaid svg'),
            null, { timeout: 30_000 });
        const expandBtn = page.locator('#textbook-reader-container .mermaid-expand-btn, #textbook-reader-container [class*="mermaid-zoom"], #textbook-reader-container .mermaid').first();
        await expandBtn.scrollIntoViewIfNeeded();
        // 확대 트리거 — 전용 버튼이 있으면 클릭, 없으면 다이어그램 탭
        const btn = page.locator('#textbook-reader-container .mermaid-expand-btn').first();
        if (await btn.count()) await btn.click(); else await expandBtn.click();
        const modal = page.locator('#mermaid-zoom-modal, .mermaid-zoom-modal').first();
        await expect(modal).not.toHaveClass(/is-hidden/, { timeout: 5_000 });
    });

    test('기출문제 링크가 문제집 뷰어 오버레이를 연다 (TR-10)', async ({ page }) => {
        test.setTimeout(90_000);
        await openReader(page);
        const link = page.locator('#textbook-reader-container .exam-link-btn').first();
        if (!(await link.count())) { test.skip(true, '선택 과목 챕터에 기출 링크 없음'); return; }
        await link.scrollIntoViewIfNeeded();
        await link.click();
        await expect(page.locator('#exam-overlay')).toHaveClass(/open/, { timeout: 15_000 });
    });

    test('본문 이미지 라이트박스가 열리고 닫힌다 (TR-20)', async ({ page }) => {
        test.setTimeout(90_000);
        await openReader(page);
        const img = page.locator('#textbook-reader-container .reader-img, #textbook-reader-container img').first();
        if (!(await img.count())) { test.skip(true, '선택 과목 챕터에 이미지 없음'); return; }
        await img.scrollIntoViewIfNeeded();
        await img.click();
        const modal = page.locator('#reader-img-zoom-modal');
        await expect(modal).not.toHaveClass(/is-hidden/, { timeout: 5_000 });
        await page.keyboard.press('Escape');
        await expect(modal).toHaveClass(/is-hidden/, { timeout: 5_000 });
    });
});
