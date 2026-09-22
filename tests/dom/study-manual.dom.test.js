// tests/dom/study-manual.dom.test.js — 매뉴얼 뷰어 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 5)
// 검증: 문서 열기→오버레이·MD 렌더·TOC(H) · doc: 링크로 문서 간 전환(H)
//       · 캐시(P) · 닫기(H) · 미등록 소스 오류(X)
// __DOC_MD__ 번들을 스텁 — fetch 실패 시 번들 폴백 경로로 주입
// 참고: _overlayEl이 모듈 상태로 잔존하므로 매 테스트 모듈 리셋

import { describe, it, beforeEach, expect, vi } from 'vitest';

import { loadIndexHtml, el, flushAsync } from './helpers.js';
import { PATHS } from '../../src/paths.js';

const MD_USER = '# 학습 매뉴얼\n\n## 섹션 1\n\n본문 내용입니다.\n\n## 섹션 2\n\n[실무 매뉴얼로](doc:formula_manual)\n';
const MD_MERMAID = '# 다이어그램 문서\n\n```mermaid\nflowchart LR\n  A --> B\n```\n';
const MD_FORMULA = '# 실무 매뉴얼\n\n## 배합\n\n포뮬러 내용.\n';

describe('매뉴얼 뷰어 — 문서 열기·TOC·전환', () => {
    let ManualViewer;
    beforeEach(async () => {
        localStorage.clear();
        sessionStorage.clear();
        vi.resetModules();
        ({ ManualViewer } = await import('../../src/manual-viewer.js'));
        loadIndexHtml();
        window.__DOC_MD__ = {
            [PATHS.USER_MANUAL]: MD_USER,
            [PATHS.FORMULA_MANUAL]: MD_FORMULA,
        };
        // jsdom 미지원 API
        Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn();
        vi.clearAllMocks();
    });

    it('openManual → 오버레이 open + MD 본문·TOC 렌더 (H)', async () => {
        await ManualViewer.openManual();
        await flushAsync(30);

        expect(ManualViewer.isOpen()).toBe(true);
        expect(el('manual-ov-title').textContent).toBe('학습 매뉴얼');
        const article = el('manual-article');
        expect(article.textContent).toContain('본문 내용입니다');
        expect(article.querySelector('h1').textContent).toContain('학습 매뉴얼');
        // h2 2개 → 목차 생성
        const toc = document.querySelector('.manual-ov-toc');
        expect(toc).not.toBeNull();
        expect(toc.querySelectorAll('[data-manual-jump]').length).toBe(2);
    });

    it('doc: 링크 클릭 → 같은 오버레이에서 실무 매뉴얼로 전환 (H)', async () => {
        await ManualViewer.openManual();
        await flushAsync(30);

        const link = el('manual-article').querySelector('a[href="doc:formula_manual"]');
        link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await flushAsync(30);

        expect(el('manual-ov-title').textContent).toBe('실무 매뉴얼 (Formula OS)');
        expect(el('manual-article').textContent).toContain('포뮬러 내용');
        expect(ManualViewer.isOpen()).toBe(true);
    });

    it('재오픈 → sessionStorage 캐시 재사용 (P)', async () => {
        await ManualViewer.openManual();
        await flushAsync(30);
        ManualViewer.close();

        // 번들 제거 후에도 캐시된 HTML로 렌더
        delete window.__DOC_MD__;
        await ManualViewer.openManual();
        await flushAsync(30);
        expect(el('manual-article').textContent).toContain('본문 내용입니다');
    });

    it('미등록 소스 → 오류 화면 (X)', async () => {
        await ManualViewer.openDocument('nonexistent_doc');
        await flushAsync(10);

        expect(el('manual-article').textContent).toContain('매뉴얼을 불러올 수 없습니다');
        expect(ManualViewer.isOpen()).toBe(true);
    });

    it('mermaid 블록 → pre.mermaid 마크업으로 렌더 (H)', async () => {
        window.__DOC_MD__[PATHS.USER_MANUAL] = MD_MERMAID;
        await ManualViewer.openManual();
        await flushAsync(30);

        const pre = el('manual-article').querySelector('pre.mermaid');
        expect(pre).not.toBeNull();
        expect(pre.textContent).toContain('A --> B');
        // 지연 로딩 트리거 호출 — jsdom에서는 라이브러리 미로드로 렌더 생략, 마크업만 검증
    });

    it('닫기 → 오버레이 닫힘·body 클래스 해제', async () => {
        await ManualViewer.openManual();
        await flushAsync(30);
        ManualViewer.close();

        expect(ManualViewer.isOpen()).toBe(false);
        expect(document.body.classList.contains('manual-open')).toBe(false);
    });
});
