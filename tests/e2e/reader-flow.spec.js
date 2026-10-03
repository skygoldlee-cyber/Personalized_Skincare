// tests/e2e/reader-flow.spec.js — 교재리더 본체 동작 회귀 (실브라우저)
// @spec TR-01,TR-02,TR-03,TR-04,TR-11,TR-12,TR-14,TR-17,TR-18,TR-19,SA-01,RR-07
// 렌더·TOC·단원 이동·읽기 위치 영속/복원·이야기형 토글·섹션 표시줄을 실측한다.
// jsdom은 레이아웃·스크롤을 계산하지 않으므로 이 검증은 e2e에서만 유효하다.

import { test, expect } from '@playwright/test';

async function openReader(page) {
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
    await page.evaluate(() => {
        document.querySelectorAll('#app-confirm-overlay, #onboarding-overlay').forEach(el => el.remove());
        location.hash = '/reader';
    });
    await expect(page.locator('#reader-subject-select')).toBeVisible({ timeout: 15_000 });
    await page.locator('#reader-subject-select').selectOption({ index: 1 });
    // 과목 선택 → chapter 0 자동 로드 (비동기) — TOC와 본문 카드 모두 렌더될 때까지 대기
    await expect(page.locator('#reader-toc-list .reader-toc-item').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() =>
        document.querySelectorAll('#textbook-reader-container .reader-section-card').length > 0,
        null, { timeout: 30_000 });
}

/** ≤900px에서는 TOC가 translateX(-100%) 오프캔버스 드로어 — 열려있지 않으면 모바일 버튼으로 연다 */
async function ensureTocOpen(page) {
    const drawer = await page.evaluate(() =>
        getComputedStyle(document.getElementById('reader-toc')).position === 'fixed');
    if (!drawer) return;
    const isOpen = await page.evaluate(() =>
        document.getElementById('reader-toc').classList.contains('mobile-open'));
    if (!isOpen) {
        const btn = page.locator('#reader-toc-mobile-btn');
        if (await btn.isVisible()) await btn.click();
        await expect(page.locator('#reader-toc')).toHaveClass(/mobile-open/);
    }
}

test.beforeEach(({ page }) => {
    page.addInitScript(() => {
        localStorage.setItem('current_exam', 'cosmetic');
        localStorage.setItem('onboarding_seen_v1', '1');
        localStorage.setItem('cosmetic:onboarding_seen_v1', '1');
    });
    page._errors = [];
    page.on('pageerror', err => page._errors.push(String(err)));
});

test.describe('교재리더 본체', () => {
    test('교재 본문이 HTML로 렌더되고 TOC가 채워진다 (TR-01/02)', async ({ page }) => {
        test.setTimeout(60_000);
        await openReader(page);
        const m = await page.evaluate(() => ({
            cards: document.querySelectorAll('#textbook-reader-container .reader-section-card').length,
            headings: document.querySelectorAll('#textbook-reader-container .reader-section-title, #textbook-reader-container .md-h3, #textbook-reader-container .md-h4').length,
            tocItems: document.querySelectorAll('#reader-toc-list .reader-toc-item').length,
        }));
        expect(m.cards).toBeGreaterThan(0);
        expect(m.headings).toBeGreaterThan(0);
        expect(m.tocItems).toBeGreaterThan(0);
        expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
    });

    test('툴바에 기출 필터·원본·참조자료 버튼이 노출되지 않는다 (SA-01,RR-07)', async ({ page }) => {
        test.setTimeout(60_000);
        await openReader(page);
        const group = page.locator('#reader-chapter-actions-group');
        await expect(group.locator('#exam-filter-btn')).toHaveCount(0);
        await expect(group.locator('#reader-ref-dropdown')).toHaveCount(0);
        await expect(group.locator('a:has-text("원본")')).toHaveCount(0);
    });

    test('TOC 항목 클릭으로 단원 간 이동한다 (TR-03)', async ({ page }) => {
        test.setTimeout(60_000);
        await openReader(page);
        const items = page.locator('#reader-toc-list .reader-toc-item');
        if ((await items.count()) < 2) test.skip();
        const target = items.nth(1);
        const title = await target.getAttribute('data-toc-title');
        await ensureTocOpen(page);
        await target.scrollIntoViewIfNeeded();
        await target.click();
        await page.waitForTimeout(500);
        const found = await page.evaluate((t) =>
            document.getElementById('textbook-reader-container').textContent.includes(t), title);
        expect(found).toBe(true);
    });

    test('읽기 위치가 저장되고 재방문 시 복원된다 (TR-11/12)', async ({ page }) => {
        test.setTimeout(90_000);
        await openReader(page);
        // 본문 스크롤 → 디바운스(1s) 저장 대기 — 저장값이 나타날 때까지 폴링
        await page.evaluate(() => {
            const c = document.getElementById('textbook-reader-container');
            c.scrollTop = Math.min(600, c.scrollHeight - c.clientHeight);
            c.dispatchEvent(new Event('scroll'));
        });
        await page.waitForFunction(() => {
            const p = JSON.parse(localStorage.getItem('cosmetic:readerLastPosition') || localStorage.getItem('readerLastPosition') || 'null');
            return p && p.scrollTop > 0;
        }, null, { timeout: 5_000 });
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cosmetic:readerLastPosition') || localStorage.getItem('readerLastPosition')));
        expect(saved.subject).toBeTruthy();
        expect(saved.scrollTop).toBeGreaterThan(0);

        // 재방문 → 같은 과목·스크롤 위치 복원
        await page.reload();
        await page.waitForFunction(() => window.__APP_INITIALIZED === true, null, { timeout: 15_000 });
        await page.evaluate(() => { location.hash = '/reader'; });
        await expect(page.locator('#reader-toc-list .reader-toc-item').first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(800);
        const restored = await page.evaluate(() => ({
            subject: document.getElementById('reader-subject-select').value,
            scrollTop: document.getElementById('textbook-reader-container').scrollTop,
        }));
        expect(restored.subject).toBe(saved.subject);
        expect(restored.scrollTop).toBeGreaterThan(0);
    });

    test('이야기형 토글이 본문을 재렌더하고 상태를 영속화한다 (TR-14)', async ({ page }) => {
        test.setTimeout(90_000);
        await openReader(page);
        const before = await page.evaluate(() =>
            document.getElementById('textbook-reader-container').innerHTML.length);
        const toggle = page.locator('#reader-story-mode-toggle');
        if (!(await toggle.isVisible())) test.skip();
        await toggle.check();
        // 재렌더 완료까지 본문 길이 변화 대기
        await page.waitForFunction((len) =>
            document.getElementById('textbook-reader-container').innerHTML.length !== len,
            before, { timeout: 15_000 });
        const saved = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('cosmetic:readerLastPosition') || localStorage.getItem('readerLastPosition') || '{}'));
        expect(saved.storyMode).toBe(true);
        expect(page._errors.filter(e => !/favicon|manifest/i.test(e))).toEqual([]);
    });

    test('뷰 이탈 후 복귀 시 읽기 스크롤이 복원된다 (TR-04)', async ({ page }) => {
        test.setTimeout(90_000);
        await openReader(page);
        await page.evaluate(() => {
            const c = document.getElementById('textbook-reader-container');
            c.scrollTop = Math.min(700, c.scrollHeight - c.clientHeight);
            c.dispatchEvent(new Event('scroll'));
        });
        // 스크롤 디바운스(1s) 저장 대기
        await page.waitForFunction(() => {
            const p = JSON.parse(localStorage.getItem('cosmetic:readerLastPosition') || 'null');
            return p && p.scrollTop > 0;
        }, null, { timeout: 5_000 });
        const saved = await page.evaluate(() =>
            document.getElementById('textbook-reader-container').scrollTop);
        expect(saved).toBeGreaterThan(0);

        // 다른 뷰로 이동 후 리더 복귀 — 뷰 렌더러가 savedPos.scrollTop으로 복원
        await page.evaluate(() => { location.hash = '/dashboard'; });
        await expect(page.locator('#dashboard-view')).toHaveClass(/active/);
        await page.evaluate(() => { location.hash = '/reader'; });
        await page.waitForFunction(() =>
            document.querySelectorAll('#textbook-reader-container .reader-section-card').length > 0,
            null, { timeout: 30_000 });
        await page.waitForFunction((s) =>
            Math.abs(document.getElementById('textbook-reader-container').scrollTop - s) < 15,
            saved, { timeout: 10_000 });
    });

    test('이야기형 전환 시 현재 섹션 앵커가 보존된다 (TR-19)', async ({ page }) => {
        test.setTimeout(90_000);
        await openReader(page);
        // 중간 섹션으로 스크롤 — 섹션 내부 오프셋(30px)을 둬 앵커 정밀도 검증
        const anchor = await page.evaluate(() => {
            const c = document.getElementById('textbook-reader-container');
            const secs = [...c.querySelectorAll('[id^="reader-section-"]')];
            if (secs.length < 3) return -1;
            const target = secs[Math.min(2, secs.length - 1)];
            c.scrollTop = target.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop + 30;
            c.dispatchEvent(new Event('scroll'));
            return parseInt(target.id.replace('reader-section-', ''), 10);
        });
        if (anchor < 0) { test.skip(true, '섹션 수 부족'); return; }
        const toggle = page.locator('#reader-story-mode-toggle');
        if (!(await toggle.count())) { test.skip(true, '이야기형 토글 없음'); return; }

        // 스크롤 다운으로 크롬이 자동 숨김(TR-22)돼 토글이 포인터 이벤트를 받지 못하므로
        // change 이벤트를 직접 dispatch한다. 재렌더 감지는 기존 섹션 카드 노드의 detach로 판정.
        await page.evaluate(() => {
            window.__readerCardBefore = document.querySelector('#textbook-reader-container .reader-section-card');
            const t = document.getElementById('reader-story-mode-toggle');
            t.checked = true;
            t.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForFunction(() => !window.__readerCardBefore.isConnected,
            null, { timeout: 20_000 });
        // 재렌더 후 같은 섹션이 최상단 가시 섹션이어야 한다 (scrollTop=0 리셋이면 실패)
        await page.waitForFunction((idx) => {
            const c = document.getElementById('textbook-reader-container');
            if (!c || c.scrollTop <= 0) return false;
            const cTop = c.getBoundingClientRect().top;
            let last = -1;
            for (const s of c.querySelectorAll('[id^="reader-section-"]')) {
                if (s.getBoundingClientRect().top - cTop <= 40) {
                    last = parseInt(s.id.replace('reader-section-', ''), 10);
                } else break;
            }
            return last === idx;
        }, anchor, { timeout: 10_000 });
    });

    test('스크롤 시 섹션 표시줄이 현재 섹션을 보여준다 (TR-17/18)', async ({ page }) => {
        test.setTimeout(60_000);
        await openReader(page);
        await page.evaluate(() => {
            const c = document.getElementById('textbook-reader-container');
            c.scrollTop = c.scrollHeight / 2;
            c.dispatchEvent(new Event('scroll'));
        });
        // 스크롤 스파이가 표시줄 텍스트 또는 활성 TOC 항목을 갱신할 때까지 폴링
        const spyWorked = await page.waitForFunction(() => {
            const t = document.getElementById('reader-sticky-heading-text')?.textContent?.trim();
            if (t && t.length > 0) return true;
            return !!document.querySelector('#reader-toc-list .reader-toc-item.active, #reader-toc-list .reader-toc-sub-item.active');
        }, null, { timeout: 5_000 }).then(() => true).catch(() => false);
        expect(spyWorked).toBe(true);
    });
});
