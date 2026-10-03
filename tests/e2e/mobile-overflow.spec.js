// tests/e2e/mobile-overflow.spec.js — 뷰포트 오버플로 스윕 (가로·세로 잘림 게이트)
// @spec UX-NAV-10,UX-FB-06
// 수평 오버플로·스크롤 불가 내부 클립·모달 액션 버튼 잘림은 실제 레이아웃
// 계산이 필요해 jsdom 불가 — 실브라우저 계측으로만 검증한다 (UX-VFY-02).
//
// 사례: 성분사전 '성분 추가' 버튼 nowrap 잘림, 자가 등록 모달 등록 버튼 잘림.
// chromium(1280) + mobile(Pixel 7) + tablet(834) 프로젝트별로 전 뷰를 순회한다.

import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
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

/**
 * 수평 오버플로 수집 — ① 페이지 스크롤 넘침 + 그 범인 ② 스크롤 불가 내부 클립.
 * 예외: 가로 스크롤 컨테이너(overflow-x:auto/scroll) 안의 자식,
 *       text-overflow:ellipsis 말줄임, select/option(네이티브 렌더).
 */
async function collectOverflow(page) {
    return page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const label = el => el.tagName.toLowerCase()
            + (el.id ? '#' + el.id : '')
            + (typeof el.className === 'string' && el.className.trim()
                ? '.' + el.className.trim().split(/\s+/)[0] : '');
        const inHScroller = el => {
            for (let a = el.parentElement; a; a = a.parentElement) {
                const ax = getComputedStyle(a).overflowX;
                if (ax === 'auto' || ax === 'scroll') return true;
            }
            return false;
        };
        const pageOffenders = [];
        const clipped = [];
        for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            // ① 뷰포트 오른쪽을 넘는 요소 — 스크롤러 안이면 페이지 넘침 원인 아님
            if (r.right > vw + 2 && !inHScroller(el)) {
                pageOffenders.push(`${label(el)} right=${Math.round(r.right)}`);
            }
            // ② 내부 클립 — 자기 폭보다 넓은 내용을 스크롤 불가로 자름
            if (el.scrollWidth > el.clientWidth + 2) {
                const cs = getComputedStyle(el);
                if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip')
                    && cs.textOverflow !== 'ellipsis'
                    && !inHScroller(el)
                    && !['SELECT', 'OPTION', 'SVG', 'CANVAS'].includes(el.tagName)) {
                    clipped.push(`${label(el)} ${el.clientWidth}<${el.scrollWidth}`);
                }
            }
        }
        return {
            docOver: document.documentElement.scrollWidth - vw,
            pageOffenders: pageOffenders.slice(0, 8),
            clipped: clipped.slice(0, 8),
        };
    });
}

test.describe('모바일 오버플로 스윕', () => {
    test('모든 뷰에서 수평 오버플로·내부 클립이 없다 (UX-NAV-10)', async ({ page }) => {
        test.setTimeout(120_000);
        await boot(page);
        const views = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.view-section')).map(el => el.id));
        const failures = [];
        for (const v of views) {
            await page.evaluate(async id => {
                const nav = await import('./src/views/navigation.js');
                nav.switchView(id, { scrollTop: true });
            }, v);
            // 비동기 렌더(사전·분석 등 DataLoader 경유) 안정화 대기
            await page.waitForTimeout(700);
            const r = await collectOverflow(page);
            if (r.docOver > 1 || r.clipped.length) {
                failures.push(`${v}: docOver=${r.docOver} 범인=[${r.pageOffenders.join(' | ')}] 클립=[${r.clipped.join(' | ')}]`);
            }
        }
        expect(failures, `수평 오버플로 발견:\n${failures.join('\n')}`).toEqual([]);
    });

    test('모달 카드가 뷰포트 안에 있고 액션 버튼이 노출된다 — 세로·가로 (UX-FB-06)', async ({ page }) => {
        await boot(page);
        // 모바일 세로 + 짧은 가로(키보드 대응) 양쪽에서 실측
        for (const vp of [{ width: 360, height: 640 }, { width: 640, height: 320 }]) {
            await page.setViewportSize(vp);

            // ① 자가 등록 모달 — 도메인 CSS는 비동기 주입이므로 스타일 반영까지 대기
            await page.evaluate(async () => {
                const m = await import('./src/exams/cosmetic/views/formula.js');
                m.customIngAdd();
            });
            const cing = page.locator('#cing-overlay');
            await expect(cing).toBeVisible();
            await page.waitForFunction(() =>
                getComputedStyle(document.querySelector('.cing-body')).overflowY === 'auto',
                null, { timeout: 5_000 });
            const cingRect = await page.evaluate(() => {
                const foot = document.querySelector('#cing-overlay .cing-foot').getBoundingClientRect();
                const card = document.querySelector('#cing-overlay .f-weigh-card').getBoundingClientRect();
                return { footBottom: foot.bottom, footTop: foot.top, cardBottom: card.bottom, vh: innerHeight };
            });
            expect(cingRect.footBottom, `cing 푸터가 뷰포트 밖 (vp ${vp.width}×${vp.height})`)
                .toBeLessThanOrEqual(cingRect.vh + 1);
            expect(cingRect.footTop).toBeGreaterThanOrEqual(0);
            await page.locator('#cing-overlay [data-click="customIngClose"]').first().click();

            // ② 컨펌 다이얼로그 — 긴 메시지로 눌러도 액션이 보여야 함
            await page.evaluate(async () => {
                const u = await import('./src/ui-utils.js');
                u.showConfirm('확인 문구가 아주 길어지는 경우를 검증합니다.\n'.repeat(12) + '계속하시겠습니까?');
            });
            await expect(page.locator('#app-confirm-overlay')).toBeVisible();
            const dlg = await page.evaluate(() => {
                const card = document.querySelector('#app-confirm-overlay .app-confirm-dialog');
                const act = document.querySelector('#app-confirm-overlay .app-confirm-actions').getBoundingClientRect();
                const cs = getComputedStyle(card);
                const rect = card.getBoundingClientRect();
                return { actBottom: act.bottom, cardH: rect.height, vh: innerHeight,
                         overflowY: cs.overflowY, maxH: cs.maxHeight };
            });
            // 카드는 뷰포트 안(90dvh 상한) + 스크롤 가능해야 액션에 도달 가능
            expect(dlg.cardH).toBeLessThanOrEqual(dlg.vh * 0.95 + 1);
            expect(['auto', 'scroll']).toContain(dlg.overflowY);
            await page.locator('#app-confirm-overlay .app-confirm-cancel').click();
        }
    });
});
