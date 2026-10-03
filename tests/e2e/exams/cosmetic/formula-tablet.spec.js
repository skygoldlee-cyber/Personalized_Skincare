// tests/e2e/exams/cosmetic/formula-tablet.spec.js — Formula OS 태블릿·현장 작업 계약
// @spec FO-26,FO-27,FO-28,FO-29,FO-30,FO-31,UX-PWA-06
// 실습실·조제실에서 태블릿(≤900px·터치)으로 쓰는 시나리오를 실브라우저로 검증한다:
// 터치 타깃 ≥44px·입력 16px(iOS 줌 방지), 스테퍼·진행 표시·계량 모드·고대비 토글,
// 작업 드래프트 자동 저장·복원. 뷰포트를 스펙이 직접 834px로 고정해
// chromium/mobile/tablet 어느 프로젝트에서도 동일하게 재현된다.

import { test, expect } from '@playwright/test';

const TABLET = { width: 834, height: 1112 };

test.describe('Formula OS — 태블릿 현장 작업 (834px 터치 대역)', () => {
    test.beforeEach(({ page }) => {
        page.addInitScript(() => {
            // current_exam 미설정이면 앱이 시험 선택 뷰로 리다이렉트해 딥링크를 덮는다
            localStorage.setItem('current_exam', 'cosmetic');
            localStorage.setItem('onboarding_seen_v1', '1');
            localStorage.setItem('cosmetic:onboarding_seen_v1', '1');
        });
        page._errors = [];
        page.on('pageerror', err => page._errors.push(String(err)));
    });

    async function openCalc(page) {
        await page.goto('/index.html#/formula');
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.setViewportSize(TABLET);
        await expect(page.locator('#formula-menu-panel')).toBeVisible({ timeout: 10_000 });
        await page.locator('.trainer-menu-card[data-click="formulaNew"]').click();
        await expect(page.locator('#formula-calc-panel')).toBeVisible();
    }

    test('터치 타깃·입력 크기 — ≤900px 대역에서 버튼 ≥44px·입력 폰트 16px (FO-26)', async ({ page }) => {
        await openCalc(page);
        // 서브내비 칩·스테퍼·입력의 실측 터치 면적
        const chip = page.locator('.formula-subnav-chip').first();
        await expect(chip).toBeVisible();
        expect((await chip.boundingBox()).height).toBeGreaterThanOrEqual(44);
        const stepBtn = page.locator('.f-step-btn').first();
        await expect(stepBtn).toBeVisible();
        expect((await stepBtn.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await expect(page.locator('.f-row .f-name').first()).toHaveCSS('font-size', '16px');
        // 숫자 입력은 inputmode로 숫자 패드 유도
        await expect(page.locator('#formula-target-volume')).toHaveAttribute('inputmode', 'decimal');
        expect(page._errors).toEqual([]);
    });

    test('스테퍼·진행 표시 — ± 버튼 증감과 단계 상태 갱신 (FO-27)', async ({ page }) => {
        await openCalc(page);
        await page.locator('.f-row .f-name').first().fill('테스트원료');
        // 키보드 대신 스테퍼로만 배합률 입력 — 장갑 조작 경로
        await page.locator('.f-row .f-step-btn[data-dir="1"]').first().click();
        await expect(page.locator('.f-row .f-conc').first()).toHaveValue('0.1');
        await expect(page.locator('.f-row .f-amount').first()).toContainText('0.10');
        // 진행 스트립: 원료 입력 단계 완료 표시
        const steps = page.locator('#formula-progress .f-prog-step.is-done');
        await expect(steps.first()).toContainText('원료 입력');
    });

    test('계량 모드 — 대형 투입량 표시 순회·종료 (FO-28)', async ({ page }) => {
        await openCalc(page);
        await page.locator('.f-row .f-name').first().fill('테스트원료');
        await page.locator('.f-row .f-step-btn[data-dir="1"]').first().click();
        await page.locator('[data-click="formulaWeighOpen"]').click();
        const ov = page.locator('#formula-weigh-overlay');
        await expect(ov).toBeVisible();
        await expect(page.locator('#formula-weigh-name')).toHaveText('테스트원료');
        await expect(page.locator('#formula-weigh-amount')).toContainText('0.10g');
        await page.locator('[data-click="formulaWeighNext"]').click(); // 마지막 → 자동 종료
        await expect(ov).toBeHidden();
        expect(page._errors).toEqual([]);
    });

    test('작업지시서 버튼 노출·드래프트 자동 저장·고대비 토글 (FO-29,FO-30,FO-31)', async ({ page }) => {
        await openCalc(page);
        await expect(page.locator('[data-click="formulaPrintWorkOrder"]')).toBeVisible();
        // 드래프트: 원료 입력 → 디바운스 자동 저장 → 재진입 복원
        await page.locator('.f-row .f-name').first().fill('테스트원료');
        await page.waitForFunction(
            () => localStorage.getItem('cosmetic:formula_calc_draft') != null,
            null, { timeout: 5_000 }
        );
        await page.locator('#formula-calc-panel [data-click="exitFormulaSubView"]').click();
        await page.locator('.trainer-menu-card[data-click="formulaNew"]').click();
        await expect(page.locator('.f-row .f-name').first()).toHaveValue('테스트원료');
        await expect(page.locator('#formula-draft-status')).toContainText('복원');
        // 고대비 토글 — 허브로 돌아가 버튼 클릭
        await page.locator('#formula-calc-panel [data-click="exitFormulaSubView"]').click();
        await page.locator('#formula-contrast-btn').click();
        await expect(page.locator('#formula-view')).toHaveClass(/formula-hc/);
        expect(page._errors).toEqual([]);
    });
});
