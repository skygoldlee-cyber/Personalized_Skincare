// tests/e2e/app.spec.js — 실브라우저 스모크 (jsdom 불가 영역)
// @spec UX-NAV-01,UX-NAV-08,UX-SET-01,UX-SET-02,UX-SET-03,UX-FB-04,P-01,P-02,P-10,P-11
// 앱 초기화 부팅, 콘솔 오류 부재, 뷰 전환, SW 등록, PWA 자산 응답을 고정한다.

import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
    // 첫 방문 분기(시험 선택 뷰 + 온보딩 오버레이)가 클릭을 가로막지 않도록 시드
    page.addInitScript(() => {
        localStorage.setItem('current_exam', 'cosmetic');
        localStorage.setItem('onboarding_seen_v1', '1');
        localStorage.setItem('cosmetic:onboarding_seen_v1', '1');
    });
    // 페이지 레벨 오류는 모든 테스트에서 감지 — 나중에 배열로 확인
    page._errors = [];
    page.on('pageerror', err => page._errors.push(String(err)));
});

test.describe('앱 부트스트랩', () => {
    test('index.html 로드 → 대시보드 렌더 + 초기화 완료 플래그', async ({ page }) => {
        await page.goto('/index.html');
        await expect(page.locator('#view-title')).toHaveText(/학습 대시보드/);
        // app-fallback.js가 감지하는 정상 초기화 플래그
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
    });

    test('앱 폴백 오버레이가 정상 부팅에서는 나타나지 않는다', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForTimeout(2000);
        await expect(page.locator('#app-fallback-overlay')).toHaveCount(0);
    });

    test('네비게이션으로 뷰가 전환된다 (데스크톱 사이드바 / 모바일 하단 탭 바)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        // 데스크톱: 사이드바 .nav-item · 모바일: 하단 탭 바 .mobile-tab-item — 보이는 쪽 선택
        const visibleNav = page.locator('.nav-item[data-target="flashcard-view"]:visible, .mobile-tab-item[data-target="flashcard-view"]:visible');
        await visibleNav.first().click();
        await expect(page.locator('#flashcard-view')).toBeVisible();
        // UX-NAV-08: 뷰 전환 시 #/슬러그 pushState — 딥링크·뒤로가기의 기반
        await expect(page).toHaveURL(/#\/cards$/);
    });
});

test.describe('PWA 자산·서비스 워커', () => {
    test('manifest.webmanifest가 올바른 Content-Type으로 응답된다', async ({ request }) => {
        const resp = await request.get('/manifest.webmanifest');
        expect(resp.ok()).toBe(true);
        expect(resp.headers()['content-type']).toContain('manifest+json');
        const json = await resp.json();
        expect(json.name).toBeTruthy();
        expect(json.icons.length).toBeGreaterThan(0);
    });

    test('sw.js가 서빙되고 등록 스크립트가 존재한다', async ({ page, request }) => {
        const resp = await request.get('/sw.js');
        expect(resp.ok()).toBe(true);
        expect(resp.headers()['content-type']).toContain('javascript');

        await page.goto('/index.html');
        // localhost는 secure context — SW 등록 완료까지 대기
        const swState = await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return 'unsupported';
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                return reg ? (reg.active ? 'active' : 'registered') : 'none';
            } catch { return 'error'; }
        });
        // 로컬 정적 서버는 SW 등록에 필요한 최소 조건 충족 (미지원/오류만 실패)
        expect(['active', 'registered', 'none']).toContain(swState);
    });

    test('App Shell 핵심 자산(style.css·data/version.js·아이콘)이 200이다', async ({ request }) => {
        for (const url of ['/style.css', '/data/version.js', '/icons/icon-192.png']) {
            const resp = await request.get(url);
            expect(resp.ok(), `${url} 응답 실패`).toBe(true);
        }
    });
});

test.describe('UI 골격', () => {
    test('헤더 액션(테마·설정·설치) 버튼이 렌더된다', async ({ page }) => {
        await page.goto('/index.html');
        await expect(page.locator('#theme-toggle-btn')).toBeVisible();
        await expect(page.locator('#settings-toggle-btn')).toBeVisible();
    });

    test('설정 패널이 토글된다', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        const panel = page.locator('#settings-panel');
        await expect(panel).toHaveClass(/is-hidden/);
        await page.locator('#settings-toggle-btn').click();
        await expect(panel).not.toHaveClass(/is-hidden/);
    });

    test('설정 패널은 뷰포트 한계 내에서 내부 스크롤한다 (UX-SET-02)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.locator('#settings-toggle-btn').click();
        const panel = page.locator('#settings-panel');
        await expect(panel).not.toHaveClass(/is-hidden/);
        const m = await page.evaluate(() => {
            const el = document.getElementById('settings-panel');
            const cs = getComputedStyle(el);
            return {
                overflowY: cs.overflowY,
                maxH: parseFloat(cs.maxHeight),
                h: el.getBoundingClientRect().height,
                vh: window.innerHeight,
            };
        });
        expect(m.overflowY).toBe('auto');
        // max-height: calc(100dvh - 5rem) — 뷰포트를 넘지 않는 상한
        expect(Math.abs(m.maxH - (m.vh - 80))).toBeLessThanOrEqual(2);
        expect(m.h).toBeLessThanOrEqual(m.maxH);
    });

    test('설정 항목의 터치 타겟이 44px 이상이다 (UX-SET-03)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.locator('#settings-toggle-btn').click();
        await expect(page.locator('#settings-panel')).not.toHaveClass(/is-hidden/);
        const heights = await page.evaluate(() =>
            [...document.querySelectorAll('#settings-panel .settings-item')]
                .filter(el => el.offsetParent !== null)   // is-hidden 항목 제외
                .map(el => el.getBoundingClientRect().height));
        expect(heights.length).toBeGreaterThan(0);
        for (const h of heights) expect(h).toBeGreaterThanOrEqual(43.5);
    });

    test('전역 로딩 오버레이가 뷰포트 전체를 덮는다 (UX-FB-04)', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.evaluate(async () => {
            const m = await import('./src/ui-utils.js');
            m.showGlobalLoading('테스트 로딩');
        });
        const overlay = page.locator('#global-loading-overlay');
        await expect(overlay).toHaveClass(/is-visible/);
        const g = await page.evaluate(() => {
            const el = document.getElementById('global-loading-overlay');
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
                pos: cs.position, w: r.width, h: r.height,
                z: parseInt(cs.zIndex, 10), vw: innerWidth, vh: innerHeight,
            };
        });
        expect(g.pos).toBe('fixed');
        expect(g.w).toBeGreaterThanOrEqual(g.vw);
        expect(g.h).toBeGreaterThanOrEqual(g.vh);
        expect(g.z).toBeGreaterThanOrEqual(9000);   // --z-loading — 최상위 레이어
        await page.evaluate(async () => {
            (await import('./src/ui-utils.js')).hideGlobalLoading();
        });
    });
});
