// tests/e2e/mobile-overflow.spec.js — 뷰포트 오버플로·클릭 차단 스윕 (잘림 게이트)
// @spec UX-NAV-05,UX-NAV-10,UX-NAV-11,UX-FB-06,UX-SET-03
// 수평 오버플로·스크롤 불가 내부 클립·모달 액션 버튼 잘림·오버레이 가림은
// 실제 레이아웃 계산이 필요해 jsdom 불가 — 실브라우저 계측으로만 검증한다 (UX-VFY-02).
//
// 사례: 성분사전 '성분 추가' 버튼 nowrap 잘림, 자가 등록 모달 등록 버튼 잘림.
// chromium(1280) + mobile(Pixel 7) + tablet(834) 프로젝트별로 전 뷰를 순회한다.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

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

/** 뷰 전환 중 뜨는 Pro 안내·확인 오버레이를 닫는다 — 스윕 대상은 뷰 자체 레이아웃 */
async function dismissOverlays(page) {
    await page.evaluate(() => {
        document.querySelectorAll(
            '#pro-upgrade-overlay, #app-confirm-overlay, #whats-new-overlay,'
            + ' #feedback-overlay, #usage-stats-overlay, #onboarding-overlay, #cing-overlay')
            .forEach(el => el.remove());
    });
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

    test('하단 탭 바가 스크롤 끝 콘텐츠를 가리지 않는다 (UX-NAV-05)', async ({ page }) => {
        test.setTimeout(120_000);
        await boot(page);
        // meta viewport 적용 후 측정 — about:blank는 모바일 에뮬에서 980px로 잡혀 판정이 틀어진다
        const vw = await page.evaluate(() => window.innerWidth);
        if (vw > 768) { test.skip(true, '하단 탭 바는 ≤768px 대역 전용'); return; }
        const views = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.view-section')).map(el => el.id));
        const failures = [];
        for (const v of views) {
            await page.evaluate(async id => {
                const nav = await import('./src/views/navigation.js');
                nav.switchView(id, { scrollTop: true });
            }, v);
            await page.waitForTimeout(700);
            await dismissOverlays(page);
            const r = await page.evaluate(() => {
                const tab = document.getElementById('mobile-tab-bar');
                if (!tab || !tab.offsetParent) return { skip: true };
                const tabTop = tab.getBoundingClientRect().top;
                // 스크롤 끝까지 내린 뒤 가장 아래에 있는 상호작용 요소를 실측
                const mc = document.querySelector('.main-content');
                if (mc) mc.scrollTop = mc.scrollHeight;
                window.scrollTo(0, document.documentElement.scrollHeight);
                const active = document.querySelector('.view-section.active');
                if (!active) return { skip: true };
                const items = Array.from(active.querySelectorAll(
                    'button:not([disabled]), a[href], input, select, textarea, [data-click], [role="button"]'))
                    .filter(el => { const b = el.getBoundingClientRect(); return b.width && b.height; });
                if (!items.length) return { skip: true };
                const deepest = items.reduce((a, b) =>
                    a.getBoundingClientRect().bottom > b.getBoundingClientRect().bottom ? a : b);
                const dr = deepest.getBoundingClientRect();
                const lbl = deepest.tagName.toLowerCase()
                    + (deepest.id ? '#' + deepest.id : '')
                    + (typeof deepest.className === 'string' && deepest.className.trim()
                        ? '.' + deepest.className.trim().split(/\s+/)[0] : '');
                return { skip: false, label: lbl, bottom: dr.bottom, tabTop };
            });
            if (!r.skip && r.bottom > r.tabTop + 1) {
                failures.push(`${v}: ${r.label} bottom=${Math.round(r.bottom)} > tabTop=${Math.round(r.tabTop)}`);
            }
        }
        expect(failures, `탭 바에 가려진 요소:\n${failures.join('\n')}`).toEqual([]);
    });

    test('상호작용 요소가 다른 요소에 가려져 클릭 불가하지 않다 (UX-NAV-11)', async ({ page }) => {
        test.setTimeout(180_000);
        await boot(page);
        const views = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.view-section')).map(el => el.id));
        const failures = [];
        for (const v of views) {
            await page.evaluate(async id => {
                const nav = await import('./src/views/navigation.js');
                nav.switchView(id, { scrollTop: true });
            }, v);
            await page.waitForTimeout(700);
            await dismissOverlays(page);
            const r = await page.evaluate(() => {
                // 소멸성 오버레이는 타이밍상 일시 가림이라 대상 제외
                const IGNORE_COVER = '#app-toast, .offline-banner, #global-loading-overlay, #mobile-more-sheet';
                const label = el => el.tagName.toLowerCase()
                    + (el.id ? '#' + el.id : '')
                    + (typeof el.className === 'string' && el.className.trim()
                        ? '.' + el.className.trim().split(/\s+/)[0] : '');
                const active = document.querySelector('.view-section.active');
                if (!active) return { total: 0, bad: [] };
                // 접힘 패널(details·max-height 접기) 등 overflow:hidden 조상에 잘린 요소는
                // 스크롤로 도달 불가한 의도된 숨김 — 사용자가 펼치기 전까지 대상 아님
                const clippedByAncestor = el => {
                    const b = el.getBoundingClientRect();
                    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
                    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
                        const cs = getComputedStyle(a);
                        const hides = [cs.overflowX, cs.overflowY].some(o => o === 'hidden' || o === 'clip');
                        if (!hides) continue;
                        const ar = a.getBoundingClientRect();
                        if (cx < ar.left - 1 || cx > ar.right + 1 || cy < ar.top - 1 || cy > ar.bottom + 1) return true;
                    }
                    return false;
                };
                const items = Array.from(active.querySelectorAll(
                    'button:not([disabled]), a[href], input, select, textarea, [data-click], [role="button"]'))
                    .filter(el => {
                        const b = el.getBoundingClientRect();
                        const cs = getComputedStyle(el);
                        return b.width && b.height
                            && cs.pointerEvents !== 'none' && cs.visibility !== 'hidden'
                            // 닫힌 details 자식은 레이아웃만 남고 미렌더(content-visibility) — 펼치기 전 대상 아님
                            && !el.closest('details:not([open])')
                            && !clippedByAncestor(el);
                    });
                // 대용량 뷰(사전 그리드 등)는 균등 샘플링으로 상한
                let sample = items;
                if (items.length > 80) {
                    const step = items.length / 80;
                    sample = Array.from({ length: 80 }, (_, i) => items[Math.floor(i * step)]);
                }
                const bad = [];
                for (const el of sample) {
                    el.scrollIntoView({ block: 'center', inline: 'center' });
                    const b = el.getBoundingClientRect();
                    const cx = b.left + b.width / 2;
                    const cy = b.top + b.height / 2;
                    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) {
                        bad.push(`${label(el)} — scrollIntoView 후에도 뷰포트 밖 (${Math.round(cx)},${Math.round(cy)})`);
                        continue;
                    }
                    const hit = document.elementFromPoint(cx, cy);
                    if (!hit) continue;
                    // 자기 자신·자식(버튼 안 아이콘)·조상(스크롤러 경계 클립 — 스크롤로 도달 가능)은 정상
                    if (hit === el || el.contains(hit) || hit.contains(el)) continue;
                    if (hit.closest(IGNORE_COVER)) continue;
                    bad.push(`${label(el)} ← 가림: ${label(hit)}`);
                    if (bad.length >= 8) break;
                }
                return { total: items.length, bad };
            });
            if (r.bad.length) {
                failures.push(`${v} (검사 ${Math.min(r.total, 80)}개): [${r.bad.join(' | ')}]`);
            }
        }
        expect(failures, `가려진 상호작용 요소:\n${failures.join('\n')}`).toEqual([]);
    });

    // 기존 소형 요소는 tests/e2e/baselines/touch-targets.json에 "뷰|라벨" 다중집합으로
    // 등록돼 있고 그 개수까지 허용 — **신규 위반만 실패**. 라벨은 `tag#id.첫클래스`.
    // 인라인 링크(a)와 네이티브 체크박스/라디오(라벨이 탭 타깃)는 면제.
    test('터치 타깃 44px 미만 신규 요소가 없다 (UX-SET-03 확장)', async ({ page }) => {
        test.setTimeout(180_000);
        await boot(page);
        const vw = await page.evaluate(() => innerWidth);
        if (vw > 768) { test.skip(true, '터치 타깃 스윕은 모바일 대역(≤768px) 전용'); return; }

        const baseline = JSON.parse(readFileSync('tests/e2e/baselines/touch-targets.json', 'utf8'));
        const quota = new Map();
        for (const k of baseline) quota.set(k, (quota.get(k) || 0) + 1);

        const views = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.view-section')).map(el => el.id));
        const fresh = [];
        for (const v of views) {
            await page.evaluate(async id => {
                const nav = await import('./src/views/navigation.js');
                nav.switchView(id, { scrollTop: true });
            }, v);
            await page.waitForTimeout(700);
            await dismissOverlays(page);
            const offenders = await page.evaluate((viewId) => {
                const view = document.getElementById(viewId);
                const out = [];
                const seen = new Set();
                view?.querySelectorAll('button, a[href], input, select, textarea, [data-click]').forEach(el => {
                    if (seen.has(el)) return;
                    seen.add(el);
                    if (el.tagName === 'A') return;                    // 인라인 링크 면제
                    if (el.matches('input[type="checkbox"], input[type="radio"]')) return;
                    if (!el.getClientRects().length) return;
                    if (el.closest('details:not([open])')) return;
                    for (let n = el.parentElement; n && n !== view; n = n.parentElement) {
                        const s = getComputedStyle(n);
                        if (s.display === 'none' || s.visibility === 'hidden') return;
                    }
                    const s = getComputedStyle(el);
                    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return;
                    const r = el.getBoundingClientRect();
                    if (r.right <= 0 || r.bottom <= 0) return;
                    if (Math.min(r.width, r.height) >= 44) return;
                    const cls = String(el.className?.baseVal ?? el.className ?? '')
                        .trim().split(/\s+/)[0] || '';
                    out.push(`${viewId}|${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${cls} ${Math.round(r.width)}x${Math.round(r.height)}`);
                });
                return out;
            }, v);
            for (const k of offenders) {
                const key = k.replace(/ \d+x\d+$/, '');
                const left = quota.get(key) || 0;
                if (left > 0) quota.set(key, left - 1);
                else fresh.push(k);
            }
        }
        expect(fresh, [
            '터치 타깃 44px 미만 신규 요소 감지 — 의도된 소형 컨트롤이면',
            'tests/e2e/baselines/touch-targets.json에 "뷰|라벨"을 등록하고, 아니면 ≥44px로 확대',
            ...fresh,
        ].join('\n')).toEqual([]);
    });
});
