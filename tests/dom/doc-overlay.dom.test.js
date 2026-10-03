// tests/dom/doc-overlay.dom.test.js — MD 문서 오버레이 공용 베이스
// @spec EV-01~08, MV-01~04
// exam-viewer·manual-viewer에서 추출된 공통부의 계약을 고정한다:
//   세션 캐시 TTL/프리픽스 · 번들 스크립트 주입 재사용 · TOC 생성/점프 · 오버레이 셸 수명주기

import { describe, it, beforeEach, expect, vi } from 'vitest';
import {
    makeSessionCache, injectBundleScript, fetchMd,
    buildTocHtml, mountToc, createDocOverlay,
} from '../../src/doc-overlay.js';

describe('makeSessionCache — TTL 세션 캐시', () => {
    beforeEach(() => { sessionStorage.clear(); });

    it('set/get 왕복 — payload 보존', () => {
        const c = makeSessionCache('t_v1_', 1000);
        c.set('a/b_c.md', { html: '<p>x</p>' });
        const got = c.get('a/b_c.md');
        expect(got.html).toBe('<p>x</p>');
        expect(typeof got.timestamp).toBe('number');
    });

    it('TTL 만료 시 null + 키 제거', () => {
        const c = makeSessionCache('t_v1_', 10);
        c.set('k', { html: 'h' });
        // 타임스탬프를 과거로 조작
        const key = Object.keys(sessionStorage).find(k => k.startsWith('t_v1_'));
        const entry = JSON.parse(sessionStorage.getItem(key));
        entry.timestamp = Date.now() - 60000;
        sessionStorage.setItem(key, JSON.stringify(entry));
        expect(c.get('k')).toBeNull();
        expect(sessionStorage.getItem(key)).toBeNull();
    });

    it('clear는 자기 프리픽스 키만 제거', () => {
        const a = makeSessionCache('t_a_', 1000);
        const b = makeSessionCache('t_b_', 1000);
        a.set('x', { html: '1' });
        b.set('x', { html: '2' });
        a.clear();
        expect(a.get('x')).toBeNull();
        expect(b.get('x').html).toBe('2');
    });
});

describe('makeSessionCache — maxEntries LRU 옵션', () => {
    beforeEach(() => { sessionStorage.clear(); });

    it('한도 초과 시 가장 오래된 항목 제거', () => {
        const c = makeSessionCache('l_v1_', 60000, { maxEntries: 2 });
        c.set('k1', { html: '1' });
        c.set('k2', { html: '2' });
        c.set('k3', { html: '3' });
        expect(c.get('k1')).toBeNull();
        expect(c.get('k2').html).toBe('2');
        expect(c.get('k3').html).toBe('3');
    });

    it('get 히트 시 최근 사용 위치로 이동 (다음 evict 대상에서 제외)', () => {
        const c = makeSessionCache('l_v2_', 60000, { maxEntries: 2 });
        c.set('k1', { html: '1' });
        c.set('k2', { html: '2' });
        c.get('k1'); // k1이 최근 사용 → k2가 최소 사용
        c.set('k3', { html: '3' });
        expect(c.get('k1').html).toBe('1');
        expect(c.get('k2')).toBeNull();
        expect(c.get('k3').html).toBe('3');
    });

    it('LRU 순서가 sessionStorage에 영속화 — 새 인스턴스가 복원', () => {
        const c1 = makeSessionCache('l_v3_', 60000, { maxEntries: 2 });
        c1.set('k1', { html: '1' });
        c1.set('k2', { html: '2' });
        // 새 인스턴스 = 세션 재시작 상황. 저장된 순서로 evict 판정
        const c2 = makeSessionCache('l_v3_', 60000, { maxEntries: 2 });
        c2.set('k3', { html: '3' });
        expect(c2.get('k1')).toBeNull();
        expect(c2.get('k2').html).toBe('2');
        expect(c2.get('k3').html).toBe('3');
    });
});

describe('injectBundleScript — 번들 스크립트 주입', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
    });

    it('동일 src는 재주입하지 않고 loaded=true면 즉시 resolve', async () => {
        const s = document.createElement('script');
        s.setAttribute('data-test-bundle', 'x.js');
        s.dataset.loaded = 'true';
        document.head.appendChild(s);
        await expect(injectBundleScript('x.js', 'data-test-bundle')).resolves.toBeUndefined();
        expect(document.querySelectorAll('script[data-test-bundle]').length).toBe(1);
    });

    it('loaded=error면 reject', async () => {
        const s = document.createElement('script');
        s.setAttribute('data-test-bundle', 'y.js');
        s.dataset.loaded = 'error';
        document.head.appendChild(s);
        await expect(injectBundleScript('y.js', 'data-test-bundle')).rejects.toThrow('bundle load error');
    });

    it('신규 스크립트를 data 속성과 함께 주입', () => {
        injectBundleScript('z.js', 'data-test-bundle').catch(() => {});
        const s = document.querySelector('script[data-test-bundle="z.js"]');
        expect(s).not.toBeNull();
        expect(s.dataset.loaded).toBe('false');
    });
});

describe('fetchMd — 라이브 fetch', () => {
    it('ok 응답은 텍스트 반환', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'md!' })));
        await expect(fetchMd('a.md')).resolves.toBe('md!');
        vi.unstubAllGlobals();
    });

    it('비-2xx는 HTTP 상태로 reject', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' })));
        await expect(fetchMd('missing.md')).rejects.toThrow('HTTP 404');
        vi.unstubAllGlobals();
    });
});

describe('buildTocHtml + mountToc — 목차', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('h2/h3에서 목차 생성 — depth·jump 속성·idPrefix 부여', () => {
        const article = document.createElement('article');
        article.innerHTML = '<h2>섹션 A</h2><h3>하위 B</h3>';
        const html = buildTocHtml(article, { idPrefix: 'm-h-', jumpAttr: 'manual-jump', tocClass: 'manual-ov-toc' });
        expect(html).toContain('manual-ov-toc');
        expect(html).toContain('data-manual-jump="m-h-0"');
        expect(html).toContain('depth-3');
        expect(article.querySelector('h2').id).toBe('m-h-0');
        expect(article.querySelector('h3').id).toBe('m-h-1');
    });

    it('헤딩 없으면 빈 문자열', () => {
        const article = document.createElement('article');
        article.innerHTML = '<p>본문만</p>';
        expect(buildTocHtml(article, { idPrefix: 'x-', jumpAttr: 'j', tocClass: 't' })).toBe('');
    });

    it('mountToc: 기존 TOC 제거 후 본문 앞 삽입 + 점프 클릭 시 scrollIntoView', () => {
        Element.prototype.scrollIntoView = vi.fn();
        const scroll = document.createElement('div');
        scroll.innerHTML = '<details class="exam-ov-toc">old</details><article id="a"><h2 id="h-0">T</h2></article>';
        document.body.appendChild(scroll); // getElementById 점프 타겟 해석에 필요
        const article = scroll.querySelector('article');
        mountToc(scroll, article,
            '<details class="exam-ov-toc"><a data-exam-jump="h-0">go</a></details>',
            { tocClass: 'exam-ov-toc', jumpAttr: 'exam-jump' });
        const tocs = scroll.querySelectorAll('.exam-ov-toc');
        expect(tocs.length).toBe(1);
        expect(scroll.firstElementChild).toBe(tocs[0]);
        tocs[0].querySelector('a').click();
        expect(article.querySelector('#h-0').scrollIntoView).toHaveBeenCalled();
    });
});

describe('createDocOverlay — 셸 수명주기', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.head.innerHTML = '';
    });

    const cfg = () => ({
        id: 'test-overlay',
        styleId: 'test-overlay-style',
        css: '#test-overlay{display:none;}',
        innerHTML: '<div class="bar"><button data-close>x</button></div><div class="sc"><article></article></div>',
        bodyClass: 'test-open',
        historyMarker: 'testOverlay',
        wire: (el) => el.querySelector('[data-close]').addEventListener('click', () => ov.close()),
    });
    let ov;

    it('ensure는 1회만 DOM 생성 + 스타일 주입 + wire 호출', () => {
        ov = createDocOverlay(cfg());
        const a = ov.ensure();
        const b = ov.ensure();
        expect(a).toBe(b);
        expect(document.querySelectorAll('#test-overlay').length).toBe(1);
        expect(document.getElementById('test-overlay-style')).not.toBeNull();
        expect(a.getAttribute('role')).toBe('dialog');
        expect(a.getAttribute('aria-modal')).toBe('true');
    });

    it('open→isOpen true + body 잠금 클래스, close→복원', () => {
        ov = createDocOverlay(cfg());
        ov.open();
        expect(ov.isOpen()).toBe(true);
        expect(document.body.classList.contains('test-open')).toBe(true);
        ov.close();
        expect(ov.isOpen()).toBe(false);
        expect(document.body.classList.contains('test-open')).toBe(false);
    });

    it('Escape 키로 닫힘', () => {
        ov = createDocOverlay(cfg());
        ov.open();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(ov.isOpen()).toBe(false);
    });

    it('onClose 훅이 클래스 해제 전에 호출됨 (스크롤 저장 등)', () => {
        const order = [];
        ov = createDocOverlay({
            ...cfg(),
            onClose: (el) => order.push(el.classList.contains('open') ? 'open' : 'closed'),
        });
        ov.open();
        ov.close();
        expect(order).toEqual(['open']);
    });

    it('popstateGuardMs — 직후 popstate는 무시', () => {
        ov = createDocOverlay({ ...cfg(), popstateGuardMs: 60000 });
        ov.open();
        window.dispatchEvent(new Event('popstate'));
        expect(ov.isOpen()).toBe(true);
    });
});
