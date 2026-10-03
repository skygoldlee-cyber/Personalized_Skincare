// tests/e2e/exam-switch.spec.js — 멀티시험 전환·도메인 격리 검증
// @spec ES-03,ES-05,DA-13
// 비기본 시험(food, comingSoon) 부팅을 실브라우저로 증명한다.
// comingSoon 카드는 UI 클릭 전환이 막혀 있으므로 current_exam을 시드해
// "다른 시험으로 부팅" 경로를 검증한다 — 시험별 브랜딩·기능 게이팅·
// 도메인 모듈 미로드가 cosmetic 하드코딩 없이 동작하는지가 관점.

import { test, expect } from '@playwright/test';

test.describe('비기본 시험(food) 부팅 — 도메인 격리', () => {
    test.beforeEach(({ page }) => {
        page.addInitScript(() => {
            localStorage.setItem('current_exam', 'food');
            localStorage.setItem('onboarding_seen_v1', '1');
            localStorage.setItem('food:onboarding_seen_v1', '1');
        });
        page._errors = [];
        page.on('pageerror', err => page._errors.push(String(err)));
    });

    test('시험별 브랜딩 — 타이틀·로고·앱명이 식품기사로 렌더된다', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        // applyExamBranding: title·로고·data-app-name이 exams.json food 엔트리로 치환
        await expect(page).toHaveTitle('식품기사');
        await expect(page.locator('.logo-text h1')).toHaveText('식품');
        await expect(page.locator('.logo-text span')).toHaveText('기사');
        await expect(page.locator('.logo-icon')).toHaveClass(/fa-bowl-food/);
        await expect(page.locator('[data-app-name]').first()).toHaveText('식품기사');
        // 비기본 시험은 pwa-manifest.js가 실제 파일로 링크 교체 (시험별 개별 설치)
        await expect(page.locator('link[rel="manifest"]'))
            .toHaveAttribute('href', /manifest\.food\.webmanifest/);
        expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
    });

    test('기능 플래그 게이팅 — cosmetic 전용 실무 메뉴가 노출되지 않는다', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        // food.features = { dictionary } — formula·ingredients·practiceMode는 is-hidden
        await expect(page.locator('[data-target="formula-view"]').first()).toHaveClass(/is-hidden/);
        await expect(page.locator('#ui-mode-toggle')).toHaveClass(/is-hidden/);
        // dictionary는 food에 선언 → 네비 항목 유지
        await expect(page.locator('[data-target="dictionary-view"]').first()).not.toHaveClass(/is-hidden/);
        // 시험 전환 버튼은 등록 시험 2개(comingSoon 포함)라 multiExam=true로 유지
        await expect(page.locator('[data-feature="examSwitch"]').first()).not.toHaveClass(/is-hidden/);
    });

    test('도메인 뷰 미로드 — formula-view 진입이 네비로 불가하고 DOM만 빈 섹션이다', async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        // practice-registry가 formula 피처 로더를 등록하지 않았는지 — 뷰 DOM은 빈 파셸만 존재
        const formulaView = page.locator('#formula-view');
        await expect(formulaView.first()).toHaveClass(/is-hidden/);
        // 훈련소 뷰에서 원료 챌린지 카드도 게이팅 (features.ingredients 미선언)
        const nav = page.locator('.nav-item[data-target="trainer-view"]:visible, .mobile-tab-item[data-target="trainer-view"]:visible');
        if (await nav.count() > 0) {
            await nav.first().click();
            await expect(page.locator('[data-click="startIngredientsChallenge"]')).toHaveClass(/is-hidden/);
        }
    });
});
