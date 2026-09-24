// tests/dom/common-glossary.dom.test.js — 용어집 수집·렌더·스크롤
// 커버리지 갭 보강: src/views/glossary-renderer.js

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));
// 용어집 쿼리·참조경로 해석을 스텁 — collectGlossaryItems의 병합 로직만 검증
vi.mock('../../src/glossary-query.js', () => ({
    getGlossaryByRefFile: vi.fn((file, seen) => {
        if (file !== '법령A.md') return [];
        const item = {
            idxKey: `법령A.md|k${seen.size}`,
            keyword: '시행령', explanation: '하위법령 설명', refDoc: '법령A',
        };
        seen.add(item.idxKey);
        return [item];
    }),
    getGlossaryBySubject: vi.fn((subjId, seen) => {
        if (subjId !== '과목1') return [];
        const item = {
            idxKey: 'glossary:과목1:시행령',
            keyword: '시행령', explanation: '큐레이션 설명', refDoc: '법령A', curated: true,
        };
        seen.add(item.idxKey);
        return [item];
    }),
}));
vi.mock('../../src/pdf-registry.js', () => ({
    resolveRefPath: vi.fn((f) => f === '법령A.pdf' ? 'content/refs/법령A.pdf' : ''),
}));

import {
    loadIndexHtml, resetStudyState, flushAsync,
} from './helpers.js';
import {
    collectGlossaryItems, renderGlossaryTable, appendGlossaryTocItem, scrollToGlossary,
} from '../../src/views/glossary-renderer.js';

const SECTIONS = [
    { content: '본문1 📌 **출처**: 법령A | 나머지' },
    { content: '본문2 — 출처 없음' },
];

describe('glossary-renderer — 용어집 수집·렌더·스크롤', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    it('collectGlossaryItems — 출처 매핑 + 과목 수집 병합, 중복 제거', () => {
        const mapFn = (src) => src.includes('법령A') ? 'docs/법령A.md' : '';
        const items = collectGlossaryItems(SECTIONS, null, mapFn, '과목1');
        // 출처 기반 1개 + 과목 기반 1개 (idxKey 달라 모두 수집)
        expect(items.length).toBe(2);
        expect(items.some(i => i.curated)).toBe(true);
    });

    it('collectGlossaryItems — 출처 없으면 chapterRefPath 폴백 사용', () => {
        const mapFn = () => '';
        const items = collectGlossaryItems(
            [{ content: '본문만' }], 'docs/법령A.md', mapFn, null);
        expect(items.length).toBe(1); // 폴백 경로로 ref 파일 수집
    });

    it('renderGlossaryTable — 항목 표 렌더 + 참조 링크', () => {
        const html = renderGlossaryTable([
            { idxKey: 'k1', keyword: '시행령', explanation: '설명', refDoc: '법령A' },
            { idxKey: 'k2', keyword: '과태료', explanation: '', refDoc: '없는문서' },
        ]);
        expect(html).toContain('glossary-table');
        expect(html).toContain('시행령');
        expect(html).toContain('data-ref-html="content/refs/법령A.pdf"');
        expect(html).toContain('(설명 없음)'); // 빈 explanation 폴백
        expect(renderGlossaryTable([])).toBe('');
    });

    it('appendGlossaryTocItem — TOC 항목 추가 + 클릭 시 스크롤', () => {
        const toc = document.createElement('div');
        document.body.appendChild(toc);
        const glossary = document.createElement('div');
        glossary.id = 'reader-glossary';
        glossary.scrollIntoView = vi.fn();
        document.body.appendChild(glossary);

        appendGlossaryTocItem(toc);
        const item = toc.querySelector('.glossary-toc');
        expect(item).toBeTruthy();
        item.click();
        expect(glossary.scrollIntoView).toHaveBeenCalled();
        toc.remove(); glossary.remove();
    });

    it('scrollToGlossary — 대상 하이라이트 + 뒤로가기 버튼 노출', async () => {
        const container = document.createElement('div');
        container.className = 'textbook-reader-content';
        document.body.appendChild(container);
        const row = document.createElement('tr');
        row.id = 'glossary-k1';
        row.scrollIntoView = vi.fn();
        document.body.appendChild(row);

        scrollToGlossary('k1', null);
        expect(row.scrollIntoView).toHaveBeenCalled();
        const backBtn = document.querySelector('.glossary-back-btn');
        expect(backBtn).toBeTruthy();
        expect(backBtn.classList.contains('is-hidden')).toBe(false);

        scrollToGlossary('nonexistent', null); // 대상 없음 — 무시
        container.remove(); row.remove(); backBtn.remove();
    });
});
