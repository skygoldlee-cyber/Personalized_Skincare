// tests/e2e/responsive-flow.spec.js — 반응형·내비·폼·PWA 게이팅 실측
// @spec R-02,R-04,R-05,R-08,UX-NAV-06,UX-NAV-07,UX-SCR-01,UX-FORM-01,UX-FORM-02,UX-PWA-01,UX-PWA-02,UX-PWA-05
// 스크롤 복원·그리드 종열·회전·커맨드 팔레트·스크롤바 이원화·입력 폰트·
// 터치 피드백·standalone 게이팅·--app-height 실측 — 모두 레이아웃/입력 의존이라 e2e만 유효.

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

async function boot(page) {
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
    await page.evaluate(() =>
        document.querySelectorAll('#onboarding-overlay, #app-confirm-overlay').forEach(el => el.remove()));
}

/** 뷰 이동 — 데스크톱 사이드바/모바일 탭 바에 보이는 항목 우선, 없으면 더보기 시트 */
async function navClick(page, target) {
    const visible = page.locator(
        `.nav-item[data-target="${target}"]:visible, .mobile-tab-item[data-target="${target}"]:visible`);
    if (await visible.count()) { await visible.first().click(); return; }
    // 탭 바에 없는 뷰 — 더보기 시트 경유
    await page.locator('#mobile-more-btn').click();
    await expect(page.locator('#mobile-more-sheet')).not.toHaveClass(/is-hidden/);
    await page.locator(`#mobile-more-sheet [data-target="${target}"]`).first().click();
}

test.describe('반응형·내비게이션 실측', () => {
    test('내비 왕복 시 스크롤이 복원되고 딥링크는 맨 위로 연다 (R-04, UX-NAV-07)', async ({ page }) => {
        test.setTimeout(60_000);
        await boot(page);
        // 대시보드에서 스크롤
        const sc = await page.evaluate(() => {
            const mc = document.querySelector('.main-content');
            const range = mc.scrollHeight - mc.clientHeight;
            if (range > 100) { mc.scrollTop = Math.min(400, range); }
            return { range, top: mc.scrollTop };
        });
        if (sc.range <= 100) { test.skip(true, '이 뷰포트에서 대시보드 스크롤 범위 부족'); return; }
        const saved = sc.top;
        await navClick(page, 'flashcard-view');
        await expect(page.locator('#flashcard-view')).toBeVisible();
        await navClick(page, 'dashboard-view');
        await expect(page.locator('#dashboard-view')).toBeVisible();
        // 복원은 활성화 직후 rAF + 대시보드 비동기 재렌더가 겹친다 — 안정값까지 폴링
        await page.waitForTimeout(1200);
        const restored = await page.evaluate(() => document.querySelector('.main-content').scrollTop);
        expect(restored).toBeCloseTo(saved, -1);
        // 액션 딥링크(scrollTop:true)는 맨 위로
        await page.evaluate(async () => {
            const nav = await import('./src/views/navigation.js');
            nav.switchView('flashcard-view', { scrollTop: true });
        });
        await page.waitForTimeout(300);
        const deepTop = await page.evaluate(() => document.querySelector('.main-content').scrollTop);
        expect(deepTop).toBe(0);
    });

    test('그리드가 뷰포트 대역에 맞게 종열 전환된다 (R-05)', async ({ page }) => {
        await boot(page);
        const cols = await page.evaluate(() => {
            const grid = document.querySelector('.stats-grid, .dashboard-grid, .cards-grid');
            if (!grid) return null;
            return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
        });
        if (cols === null) { test.skip(true, '대시보드 그리드 미존재'); return; }
        const vw = await page.evaluate(() => window.innerWidth);
        // R-05 종열 전환 — 좁은 대역은 열 수 감소(stats-grid 모바일 의도적 2열, ≤375px 1열)
        if (vw <= 900) expect(cols).toBeLessThanOrEqual(2);
        else expect(cols).toBeGreaterThanOrEqual(2);
    });

    test('가로/세로 전환 — 버튼은 비활성이고 landscape-mode 핸들러는 유지된다 (R-08)', async ({ page }) => {
        await boot(page);
        // 버튼은 의도적 비표시(실제 기기 회전으로 대체) — 계약: 숨김 유지 + 핸들러 동작
        await expect(page.locator('#orientation-toggle-btn')).toBeHidden();
        const r = await page.evaluate(() => {
            const btn = document.getElementById('orientation-toggle-btn');
            const before = document.body.classList.contains('landscape-mode');
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            const mid = document.body.classList.contains('landscape-mode');
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return { before, mid, after: document.body.classList.contains('landscape-mode') };
        });
        expect(r.mid).toBe(!r.before);
        expect(r.after).toBe(r.before);
    });

    test('통합 검색 팔레트가 Ctrl+K로 열리고 검색·실행된다 (UX-NAV-06)', async ({ page }) => {
        await boot(page);
        await page.keyboard.press('Control+k');
        const overlay = page.locator('#cmdk-overlay');
        await expect(overlay).not.toHaveClass(/is-hidden/);
        const input = page.locator('#cmdk-input');
        await expect(input).toBeFocused();
        await input.fill('퀴즈');
        const first = page.locator('#cmdk-results .cmdk-item, #cmdk-results [role="option"]').first();
        await expect(first).toBeVisible({ timeout: 10_000 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        // 팔레트가 닫히고 무언가 실행됐다 (뷰 전환 또는 액션)
        await expect(overlay).toHaveClass(/is-hidden/);
    });

    test('터치 환경에서는 스크롤바가 숨겨진다 (UX-SCR-01)', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(() => ({
            vw: window.innerWidth,
            coarse: matchMedia('(pointer: coarse)').matches,
            sbw: getComputedStyle(document.querySelector('.main-content')).scrollbarWidth,
        }));
        if (r.vw <= 900 || r.coarse) expect(r.sbw).toBe('none');
        else expect(r.sbw).not.toBe('none');
    });

    test('모바일 입력 필드가 iOS 줌 방지 기준(16px) 이상이다 (UX-FORM-01)', async ({ page }) => {
        const vw = await page.evaluate(() => window.innerWidth);
        if (vw > 900) { test.skip(true, '모바일 대역 전용 규약'); return; }
        await boot(page);
        const small = await page.evaluate(() =>
            Array.from(document.querySelectorAll('input, select, textarea'))
                .filter(el => el.offsetParent !== null)
                .map(el => ({ el: el.id || el.className, fs: parseFloat(getComputedStyle(el).fontSize) }))
                .filter(x => x.fs < 16));
        expect(small).toEqual([]);
    });

    test('터치 피드백 — 누르는 동안 scale이 적용된다 (UX-FORM-02)', async ({ page }) => {
        const vw = await page.evaluate(() => window.innerWidth);
        await boot(page);
        const target = vw <= 768 ? page.locator('.mobile-tab-item').first() : page.locator('.nav-item').first();
        const box = await target.boundingBox();
        if (!box) { test.skip(true, '대상 미표시'); return; }
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        // 누른 상태(:active)에서 transform 계측 — 규약은 scale(0.92~0.98).
        // transition이 있으므로 보간 완료까지 홀드 후 측정
        await page.waitForTimeout(350);
        const tf = await target.evaluate(el => getComputedStyle(el).transform);
        await page.mouse.up();
        const scale = tf === 'none' ? 1 : parseFloat(tf.match(/matrix\(([^,]+)/)?.[1] || '1');
        expect(scale).toBeGreaterThan(0.85);
        expect(scale).toBeLessThan(1);
    });

    test('브라우저 탭에서 standalone 전용 UI가 숨겨진다 (UX-PWA-02)', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(() => ({
            standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
            quitHidden: document.getElementById('app-quit-btn')?.classList.contains('is-hidden'),
        }));
        expect(r.standalone).toBe(false);
        expect(r.quitHidden).toBe(true);
    });

    test('종료 확인 → 차단 시 안내 화면 폴백이 나타난다 (UX-PWA-01)', async ({ page }) => {
        await boot(page);
        // quitApp은 standalone 게이팅이라 버튼이 숨겨져 있음 — 핸들러 직접 호출로 폴백 경로 검증
        await page.evaluate(() => {
            const btn = document.getElementById('app-quit-btn');
            btn.classList.remove('is-hidden');
            btn.click();
        });
        await expect(page.locator('#app-confirm-overlay')).toBeVisible({ timeout: 5_000 });
        await page.locator('.app-confirm-ok').click();
        // 탭 컨텍스트에서는 window.close()가 차단 → 600ms 후 안내 화면
        await expect(page.locator('.app-exit-screen')).toBeVisible({ timeout: 3_000 });
    });

    test('뷰포트 높이 변동 시 --app-height가 실시간 추적한다 (R-02)', async ({ page }) => {
        await boot(page);
        const before = await page.evaluate(() => ({
            appH: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height')),
            vh: window.innerHeight,
        }));
        expect(Math.abs(before.appH - before.vh)).toBeLessThanOrEqual(2);
        // 주소창 표시/숨김에 해당하는 동적 높이 변동 시뮬레이션 — resize 계열 이벤트로 갱신돼야 한다
        const cur = await page.viewportSize();
        await page.setViewportSize({ width: cur.width, height: Math.max(400, cur.height - 120) });
        await page.waitForFunction(() => {
            const appH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height'));
            return Math.abs(appH - window.innerHeight) <= 2;
        }, null, { timeout: 5_000 });
    });

    test('--app-height가 실측 뷰포트와 일치한다 (UX-PWA-05)', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(() => ({
            appH: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-height')),
            vh: window.innerHeight,
            containerH: document.querySelector('.app-container').getBoundingClientRect().height,
        }));
        expect(r.appH).toBeGreaterThan(0);
        // JS 실측값은 innerHeight와 일치 (≤1px 오차)
        expect(Math.abs(r.appH - r.vh)).toBeLessThanOrEqual(2);
        // 컨테이너 높이 경계는 높이 고정 대역(데스크톱·≤768px)에서만 — 태블릿(769–900)은
        // 의도된 페이지 스크롤 구조라 height:auto
        const vw = await page.evaluate(() => window.innerWidth);
        if (vw > 900 || vw <= 768) {
            expect(Math.abs(r.containerH - r.vh)).toBeLessThanOrEqual(2);
        }
    });
});
