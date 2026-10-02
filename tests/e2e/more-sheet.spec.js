// tests/e2e/more-sheet.spec.js — 모바일 더보기 시트 회귀
// @spec UX-NAV-01, UX-NAV-08
// modal-back.js의 마커 소비 history.back()가 같은 클릭 안의 data-click
// 네비게이션(시험전환)과 레이스를 일으켜 사용자를 이전 뷰로 되돌리던 버그:
// 시트 닫기 → observer 마이크로태스크 → back() 큐잉 → 위임 핸들러의
// pushState 뒤에 back()가 해소되어 새 뷰 엔트리를 팝. 시트를 열어둔 채
// 대기하면 마커가 반드시 존재하므로 실기기에서는 항상 재현됐다.
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

test('더보기 → 시험전환 클릭 시 시험 선택 뷰로 전환된다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });

    const moreVisible = await page.locator('#mobile-more-btn').isVisible();
    if (!moreVisible) test.skip();

    await page.locator('#mobile-more-btn').click();
    await expect(page.locator('#mobile-more-sheet')).not.toHaveClass(/is-hidden/);

    const btn = page.locator('#mobile-more-sheet [data-click="showExamSelect"]');
    await expect(btn).toBeVisible();
    await btn.click();

    await expect(page.locator('#exam-select-view')).toHaveClass(/active/, { timeout: 5_000 });
    await expect(page.locator('#mobile-more-sheet')).toHaveClass(/is-hidden/);
    console.log('errors:', page._errors);
    expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
});

test('시트 스크롤 후 시험전환도 동일하게 동작한다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
    if (!(await page.locator('#mobile-more-btn').isVisible())) test.skip();

    await page.locator('#mobile-more-btn').click();
    const btn = page.locator('#mobile-more-sheet [data-click="showExamSelect"]');
    await btn.scrollIntoViewIfNeeded();
    await page.locator('.more-sheet-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);
    await btn.tap();

    await expect(page.locator('#exam-select-view')).toHaveClass(/active/, { timeout: 5_000 });
    console.log('errors:', page._errors);
    expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
});

test('백드롭 닫기 후 modal-back 마커가 소비되어 사장 엔트리가 남지 않는다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
    if (!(await page.locator('#mobile-more-btn').isVisible())) test.skip();

    await page.locator('#mobile-more-btn').click();
    await page.waitForTimeout(300); // 마커 push 대기
    await page.locator('#more-sheet-backdrop').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300); // 지연 소비 대기

    // 소비가 정상이면 현재 엔트리는 modalBack 마커가 아니다
    const st = await page.evaluate(() => history.state);
    expect(st && st.modalBack === true).toBeFalsy();
    await expect(page.locator('#mobile-more-sheet')).toHaveClass(/is-hidden/);
});

test('다른 뷰(퀴즈)에서 진입해도 시험전환이 시험선택으로 이동한다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
    if (!(await page.locator('#mobile-more-btn').isVisible())) test.skip();

    // 퀴즈 뷰로 이동 후 더보기 시트 열기
    await page.locator('.mobile-tab-item[data-target="quiz-view"]:visible').first().click();
    await page.locator('#mobile-more-btn').click();
    const btn = page.locator('#mobile-more-sheet [data-click="showExamSelect"]');
    await btn.tap();

    await expect(page.locator('#exam-select-view')).toHaveClass(/active/, { timeout: 5_000 });
    console.log('errors:', page._errors);
    expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
});
