// tests/dom/common-htmlviewer.dom.test.js — 참조자료 HTML/MD 뷰어 오버레이 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md — src/html-viewer.js (window.HtmlViewer)
// 검증: MD 렌더·제목(H) · XSS 제거(X) · 검색 하이라이트·이동(H) · LRU 캐시(P)
//       · fetch 실패 오류(X) · 닫기(H)
// _overlayEl 모듈 상태 잔존 방지를 위해 매 테스트 모듈 리셋

import { describe, it, beforeEach, expect, vi } from 'vitest';
import { loadIndexHtml, el, flushAsync } from './helpers.js';

const MD_PATH = 'content/exams/cosmetic/참조자료/ref_md/과목1/화장품법/화장품법.md';
const MD_TEXT = '# 화장품법\n\n제1조(목적) 이 법은 화장품의 안전성 확보를 목적으로 한다.\n\n제2조(정의) 용어 정의.';
const HTML_PATH = 'content/exams/cosmetic/참조자료/html/규정.html';
const HTML_TEXT = '<html><body><h1>규정 본문</h1><p>배합한도 기준입니다.</p></body></html>';

let fetchMock;
function stubFetch(map) {
    fetchMock = vi.fn(async (url) => {
        // 한글 경로는 URL에서 퍼센트 인코딩되므로 디코딩 후 비교
        const decoded = decodeURIComponent(String(url));
        const entry = Object.entries(map).find(([k]) => decoded.includes(k));
        if (!entry) return { ok: false, status: 404, text: async () => '' };
        return { ok: true, status: 200, text: async () => entry[1] };
    });
    vi.stubGlobal('fetch', fetchMock);
}

describe('HTML 뷰어 — 열기·검색·캐시·XSS', () => {
    let openHtmlViewer;
    beforeEach(async () => {
        localStorage.clear();
        sessionStorage.clear();
        vi.resetModules();
        ({ openHtmlViewer } = await import('../../src/html-viewer.js'));
        loadIndexHtml();
        Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn();
        vi.clearAllMocks();
    });

    it('MD 문서 열기 — 오버레이 open + 제목·본문 렌더 (H)', async () => {
        stubFetch({ [MD_PATH]: MD_TEXT });
        await openHtmlViewer(MD_PATH);
        await flushAsync(30);

        const ov = el('html-ref-overlay');
        expect(ov.classList.contains('open')).toBe(true);
        expect(document.body.classList.contains('no-scroll')).toBe(true);
        expect(el('hr-title').textContent).toContain('화장품법');
        expect(ov.querySelector('.hr-ov-content').textContent).toContain('안전성 확보');
    });

    it('HTML 문서 — script·on* 핸들러·javascript: URI 제거 (X)', async () => {
        const evil = '<html><body><p onclick="x()">본문</p><script>alert(1)</script>'
            + '<a href="javascript:evil()">링크</a><img src="pic.png" onerror="x()"></body></html>';
        stubFetch({ [HTML_PATH]: evil });
        await openHtmlViewer(HTML_PATH);
        await flushAsync(30);

        const content = document.querySelector('.hr-ov-content');
        expect(content.querySelector('script')).toBeNull();
        expect(content.querySelector('[onclick]')).toBeNull();
        expect(content.querySelector('[onerror]')).toBeNull();
        const link = content.querySelector('a');
        expect(link.getAttribute('href')).toBeNull();
    });

    it('검색어 하이라이트 — mark 생성 + 개수 표시 + 이전/다음 이동 (H)', async () => {
        stubFetch({ [MD_PATH]: MD_TEXT });
        await openHtmlViewer(MD_PATH, '안전성');
        await flushAsync(50);

        const marks = document.querySelectorAll('mark.hr-highlight');
        expect(marks.length).toBe(1);
        expect(marks[0].textContent).toBe('안전성');
        expect(el('hr-search-count').textContent).toContain('1');
        el('hr-next-btn').click();
        expect(el('hr-search-count').textContent).toBe('1/1');
        expect(document.querySelector('mark.current')).not.toBeNull();
    });

    it('재오픈 — sessionStorage 캐시 재사용, fetch 미호출 (P)', async () => {
        stubFetch({ [MD_PATH]: MD_TEXT });
        await openHtmlViewer(MD_PATH);
        await flushAsync(30);
        window.HtmlViewer.close();

        stubFetch({ [MD_PATH]: '## 다른 내용' });
        await openHtmlViewer(MD_PATH);
        await flushAsync(30);
        // 캐시된 원문으로 렌더 — 새 fetch 없음
        expect(fetchMock).not.toHaveBeenCalled();
        expect(document.querySelector('.hr-ov-content').textContent).toContain('안전성 확보');
    });

    it('fetch 실패 — 오류 메시지 표시 (X)', async () => {
        stubFetch({});
        await openHtmlViewer('content/missing.md');
        await flushAsync(30);

        expect(el('hr-loading').textContent).toContain('문서 로딩 실패');
    });

    it('ref_md 문서 — joinWraps로 문장 중간 절단 병합 (H)', async () => {
        const wrapped = '# 화장품법\n\n제1조(목적) 이 법은 국민보건 향상에 이바지함을 목\n적으로 한다.';
        stubFetch({ [MD_PATH]: wrapped });
        await openHtmlViewer(MD_PATH);
        await flushAsync(30);

        const content = document.querySelector('.hr-ov-content');
        expect(content.textContent).toContain('목적으로 한다');
    });

    it('닫기 — 오버레이 닫힘·no-scroll 해제 (H)', async () => {
        stubFetch({ [MD_PATH]: MD_TEXT });
        await openHtmlViewer(MD_PATH);
        await flushAsync(30);
        el('hr-close-btn').click();

        expect(el('html-ref-overlay').classList.contains('open')).toBe(false);
        expect(document.body.classList.contains('no-scroll')).toBe(false);
    });
});
