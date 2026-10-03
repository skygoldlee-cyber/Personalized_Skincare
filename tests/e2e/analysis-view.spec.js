// tests/e2e/analysis-view.spec.js — 맞춤학습(analysis-view) E2E 시뮬레이션 (SPEC ROAD-Q8)
// @spec AN-01,AN-02,AN-03,AN-04,AN-05,AN-09
//
// jsdom 계층이 커버하지 못하는 브라우저 통합 경로를 검증한다:
//   ① 합성 이력 시드 → 진단 카드·예측·차트 렌더 (라우팅 + DataLoader + 렌더 통합)
//   ② 빈 이력 → 진단 준비 온보딩 게이트 (AN-04, 표본 미달 방향)
//   ③ 실제 퀴즈 완주 → 기록이 분석 뷰에 반영 (기록→분석 파이프라인, AN-04 표본 충족 방향)
// 시드 스키마·의도된 결과값은 tests/fixtures/analysis-seed.js 주석 참조.

import { test, expect } from '@playwright/test';
import { analysisBootKeys, buildAnalysisSeed } from '../fixtures/analysis-seed.js';

const seedStorage = (page, entries) => page.addInitScript((kv) => {
    Object.entries(kv).forEach(([k, v]) => localStorage.setItem(k, v));
}, entries);

const trackErrors = (page) => {
    page._errors = [];
    page.on('pageerror', err => page._errors.push(String(err)));
};
const cleanErrors = (page) => page._errors.filter(e => !/favicon|manifest/i.test(e));

/** #/analysis 딥링크 진입 후 앱 초기화·뷰 활성화까지 대기 */
async function gotoAnalysis(page) {
    await page.goto('/index.html#/analysis');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
    await expect(page.locator('#analysis-view')).toHaveClass(/active/, { timeout: 15_000 });
}

test.describe('맞춤학습 — 합성 이력 시드', () => {
    test.beforeEach(({ page }) => {
        seedStorage(page, { ...analysisBootKeys(), ...buildAnalysisSeed() });
        trackErrors(page);
    });

    test('시드된 이력이 진단 카드·히트맵·예측·차트에 반영된다', async ({ page }) => {
        test.setTimeout(90_000);
        await gotoAnalysis(page);

        // AN-04: 표본 충족(퀴즈 25문·모의고사 4회) → 온보딩 카드 부재
        await expect(page.locator('#analysis-onboarding-hint')).toHaveCount(0);

        // AN-02 오답 패턴 — 최근 7일 3건, 시험 확장 분류(법령·조문 혼동) 포함
        const cause = page.locator('#analysis-wrong-cause');
        await expect(cause).toContainText('최근 7일 · 3건');
        await expect(cause).toContainText('암기 부족');
        await expect(cause).toContainText('계산 실수');
        await expect(cause).toContainText('법령·조문 혼동');

        // AN-02 취약 진술 — 오판 텍스트·복습 대기·개념 클러스터·이상 진술 경고
        const weak = page.locator('#analysis-weak-statements');
        await expect(weak).toContainText('오늘 복습 대기 2개');
        await expect(weak).toContainText('조제관리사는 교육을 이수해야 한다');
        await expect(weak).toContainText('4회 오판');
        await expect(weak).toContainText('같은 개념 구간에서 반복 오판');
        await expect(weak).toContainText('반복 오판 진술 1개');
        // 졸업(streak≥3) 진술은 목록에서 제외
        await expect(weak).not.toContainText('졸업된 진술');

        // AN-08 학습 리듬 — 오늘 목표·주간 학습일·D-day·집중 시간대·주간 성장
        const rhythm = page.locator('#analysis-study-rhythm');
        await expect(rhythm).toContainText('오늘 목표 달성');
        await expect(rhythm).toContainText('70%');
        await expect(rhythm).toContainText('이번 주 학습일');
        await expect(rhythm).toContainText('D-30');
        await expect(rhythm).toContainText('저녁 (18~22시)');
        await expect(rhythm).toContainText('주간 정답률');

        // 단원별 취약 — 진술 cid → 교재 단원 해석 후 과목 그룹화
        const chapter = page.locator('#analysis-chapter-weak');
        await expect(chapter).toContainText('화장품법의 이해');
        await expect(chapter).toContainText('2. 화장품의 정의');
        await expect(chapter).toContainText('1. 사용제한 원료의 종류');

        // 합격 갭 — 실제 결과 보정(+10) 반영 추정 70점 → 합격선 도달, 최저 과목 보강 추천
        const gap = page.locator('#analysis-pass-gap');
        await expect(gap).toContainText('도달');
        await expect(gap).toContainText('최우선 보강');
        await expect(gap).toContainText('화장품 제조 및 품질관리 50%');

        // 과목 카드 — 퀴즈 풀이 수·마스터리 레벨 반영
        const cards = page.locator('#subject-cards-container');
        await expect(cards).toContainText('(8문)');
        await expect(cards).toContainText('Lv.');

        // 히트맵 — manufacturing 3/8=38% 최저
        await expect(page.locator('#subject-heatmap')).toContainText('38%');

        // 성적 추이·레이더 차트 — 이력 4회로 빈 상태 대신 SVG 렌더
        await expect(page.locator('#analytics-chart-wrapper svg')).toBeVisible();
        await expect(page.locator('#radar-chart-wrapper svg')).toBeVisible();

        // 합격 진단 — 최근 평균 60% ≥ 합격선 60, 과락 과목 없음 → '합격 예측'
        const pred = page.locator('#prediction-result-area');
        await expect(pred).toContainText('최근 평균 60%');
        await expect(pred.locator('.pred-status-badge')).toHaveText('합격 예측');

        // AN-05 복합 예상 점수 — 실제 결과 보정 +10점 반영 + 자가 보고 배지
        const est = page.locator('#prediction-estimate-area');
        await expect(est).toContainText('예상 점수');
        await expect(est).toContainText('64~76점');
        await expect(est).toContainText('실제 결과 보정 +10점 적용');
        await expect(est.locator('.actual-result')).toContainText('합격');
        await expect(est.locator('.actual-result')).toContainText('65점');

        expect(cleanErrors(page)).toEqual([]);
    });

    test('주간 리포트 — 클립보드 폴백으로 리포트 텍스트가 복사된다', async ({ page, context }) => {
        test.setTimeout(90_000);
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        // Web Share 미지원 경로 강제 → 클립보드 폴백 분기 검증.
        // writeText를 감싸 복사 본문을 window.__e2eClipboard에 기록 (readText는 포커스 의존이라 플레이크 유발)
        await page.addInitScript(() => {
            try { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }); } catch (e) { /* read-only 환경 무시 */ }
            try {
                const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
                navigator.clipboard.writeText = (t) => { window.__e2eClipboard = t; return orig(t); };
            } catch (e) { /* clipboard 미지원 시 토스트 분기로 검증 */ }
        });
        await gotoAnalysis(page);

        await page.locator('[data-click="exportAnalysisReport"]').click();
        await expect(page.locator('#app-toast')).toContainText('클립보드에 복사', { timeout: 10_000 });

        const clip = await page.evaluate(() => window.__e2eClipboard || '');
        expect(clip).toContain('주간 학습 리포트');
        expect(clip).toContain('예상 점수');
        expect(clip).toContain('최우선 보강');
        expect(clip).toContain('D-30');
        expect(cleanErrors(page)).toEqual([]);
    });
});

test.describe('맞춤학습 — 온보딩 게이트 (표본 미달)', () => {
    test('빈 이력 → 진단 준비 카드와 안내 상태, 퀴즈 CTA가 퀴즈 뷰로 이동한다', async ({ page }) => {
        test.setTimeout(90_000);
        seedStorage(page, analysisBootKeys());
        trackErrors(page);
        await gotoAnalysis(page);

        // AN-04: 표본 미달 — 진행률 카드 + 빈 상태 문구
        const hint = page.locator('#analysis-onboarding-hint');
        await expect(hint).toBeVisible();
        await expect(hint).toContainText('진단 준비 중');
        await expect(hint).toContainText('0/10');
        await expect(page.locator('#analysis-wrong-cause')).toContainText('틀린 이유');
        await expect(page.locator('#analysis-weak-statements')).toContainText('드릴');
        await expect(page.locator('#empty-chart-msg')).toBeVisible();
        await expect(page.locator('#prediction-result-area')).toContainText('모의고사 점수를 토대로');

        // CTA — '지금 퀴즈 풀기'가 실제 퀴즈 시작으로 연결되는지 (딥링크가 아닌 상호작용)
        await hint.locator('[data-click="startSubjectQuiz"]').click();
        await expect(page.locator('#quiz-view')).toHaveClass(/active/, { timeout: 15_000 });
        await expect(page.locator('#quiz-arena-panel')).toBeVisible({ timeout: 30_000 });
        expect(cleanErrors(page)).toEqual([]);
    });
});

test.describe('맞춤학습 — 기록→분석 파이프라인', () => {
    test('퀴즈 10문 완주 후 분석 뷰에 온보딩 해제·정답률이 반영된다', async ({ page }, testInfo) => {
        // 실경로 완주는 chromium에서 1회 — mobile/tablet 프로젝트는 시드 테스트가 커버
        test.skip(testInfo.project.name !== 'chromium', '실경로 플로우는 chromium에서만 실행');
        test.setTimeout(120_000);
        seedStorage(page, analysisBootKeys());
        trackErrors(page);

        // ① 표본 미달 상태 확인
        await gotoAnalysis(page);
        await expect(page.locator('#analysis-onboarding-hint')).toContainText('0/10');

        // ② 실제 퀴즈 완주 — 온보딩 CTA → 10문 응답 → 결과 패널
        await page.locator('#analysis-onboarding-hint [data-click="startSubjectQuiz"]').click();
        await expect(page.locator('#quiz-arena-panel')).toBeVisible({ timeout: 30_000 });
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

        // ③ 분석 뷰 복귀 — 기록이 반영되어 온보딩 해제·과목 카드에 풀이 수 표시
        await page.evaluate(() => { location.hash = '#/analysis'; });
        await expect(page.locator('#analysis-view')).toHaveClass(/active/, { timeout: 15_000 });
        await expect(page.locator('#analysis-onboarding-hint')).toHaveCount(0);
        await expect(page.locator('#subject-cards-container')).toContainText('(10문)');
        await expect(page.locator('#subject-heatmap .heatmap-cell[title*="10문"]')).toHaveCount(1);
        expect(cleanErrors(page)).toEqual([]);
    });
});
