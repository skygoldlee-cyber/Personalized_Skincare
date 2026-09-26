// tests/dom/study-reader.dom.test.js — 교재 리더 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 과목 목록 로드(H) · 과목 선택→본문·TOC 렌더(H) · 읽기 위치 저장·복원(P/R)
//       · 북마크 토글→영속(P) · 미선택 빈 상태(E)

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    trapFocus: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import {
    loadIndexHtml, el, flushAsync, stubRegistry, resetStudyState, storedJson,
} from './helpers.js';
import { renderTextbookReader, textbookReaderState } from '../../src/views/textbook-reader.js';
import { safeSetItem } from '../../src/state.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

const SUBJ = {
    key: 'subja',
    name: '과목A',
    chapters: [{
        chapterKey: 'ch1',
        filePath: 'content/exams/cosmetic/교재/subja.md',
        sections: [
            { title: 'Chapter 01 개론', content: '첫 번째 섹션 본문입니다.' },
            { title: '1. 핵심 개념', content: '두 번째 섹션 본문입니다.' },
        ],
    }],
};

function resetReaderState() {
    textbookReaderState.selectedSubject = '';
    textbookReaderState.selectedChapter = '';
    textbookReaderState.storyMode = false;
}

describe('교재 리더 — 과목 선택·본문·이어하기·북마크', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        resetReaderState();
        loadIndexHtml();
        // jsdom 미구현 API 스텁
        Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn();
        vi.clearAllMocks();
    });

    it('초기 렌더 → 과목 셀렉트에 레지스트리 과목 옵션', () => {
        stubRegistry([SUBJ]);
        renderTextbookReader();

        const opts = el('reader-subject-select').querySelectorAll('option');
        expect(opts.length).toBe(2); // placeholder + subja
        expect(opts[1].value).toBe('subja');
        expect(opts[1].textContent).toBe('과목A');
    });

    it('과목 선택 → 본문 섹션 카드·TOC·툴바 렌더', async () => {
        stubRegistry([SUBJ]);
        renderTextbookReader();

        const sel = el('reader-subject-select');
        sel.value = 'subja';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await flushAsync(30);

        const cards = el('textbook-reader-container').querySelectorAll('.reader-section-card');
        expect(cards.length).toBe(2);
        expect(cards[0].querySelector('.reader-section-title').textContent).toContain('Chapter 01');
        // TOC 항목 생성 + 툴바 표시
        expect(el('reader-toc-list').querySelectorAll('.reader-toc-item').length).toBeGreaterThan(0);
        expect(el('reader-toolbar').classList.contains('is-hidden')).toBe(false);
        // 읽기 위치가 저장됨
        expect(storedJson(STORAGE_KEYS.READER_LAST_POSITION).subject).toBe('subja');
    });

    it('읽기 위치 이어하기 → 저장된 과목 자동 복원·본문 재렌더 (P/R)', async () => {
        stubRegistry([SUBJ]);
        // 이전 세션 위치 시딩
        safeSetItem(STORAGE_KEYS.READER_LAST_POSITION,
            JSON.stringify({ subject: 'subja', chapter: '0', scrollTop: 120, storyMode: false, ts: Date.now() }));

        renderTextbookReader();
        await flushAsync(30);

        expect(el('reader-subject-select').value).toBe('subja');
        expect(el('textbook-reader-container').querySelectorAll('.reader-section-card').length).toBe(2);
    });

    it('북마크 토글 → localStorage 영속 + 아이콘 상태 반영', async () => {
        stubRegistry([SUBJ]);
        renderTextbookReader();
        const sel = el('reader-subject-select');
        sel.value = 'subja';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await flushAsync(30);

        const btn = el('textbook-reader-container').querySelector('.reader-bookmark-btn');
        btn.click();

        expect(storedJson(STORAGE_KEYS.READER_BOOKMARKS)).toContain('subja_0_0');
        expect(btn.classList.contains('bookmarked')).toBe(true);

        // 재클릭 → 해제
        btn.click();
        expect(storedJson(STORAGE_KEYS.READER_BOOKMARKS)).not.toContain('subja_0_0');
        expect(btn.classList.contains('bookmarked')).toBe(false);
    });

    it('과목 해제 → 빈 상태 안내', async () => {
        stubRegistry([SUBJ]);
        renderTextbookReader();
        const sel = el('reader-subject-select');
        sel.value = 'subja';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await flushAsync(30);

        sel.value = '';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        expect(el('textbook-reader-container').textContent).toContain('읽을 교재를 선택하세요');
    });
});

/* =======================================================
   리더 툴바·본문 검색·TOC 드로어·표 모달 (initReaderToolbar 경로)
   ======================================================= */

const SUBJ_RICH = {
    key: 'subja',
    name: '과목A',
    chapters: [{
        chapterKey: 'ch1',
        filePath: 'content/exams/cosmetic/교재/subja.md',
        sections: [
            { title: 'Chapter 01 개론', content: '화장품 개념 본문입니다.\n\n### 세부 항목\n\n세부 본문.' },
            { title: '1. 핵심 개념', content: '화장품 정의 본문입니다.\n\n| 항목 | 내용 |\n|---|---|\n| a | b |' },
        ],
    }],
};

async function renderRichChapter() {
    stubRegistry([SUBJ_RICH]);
    renderTextbookReader();
    const sel = el('reader-subject-select');
    sel.value = 'subja';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync(30);
}

describe('교재 리더 — 툴바·검색·드로어·표 모달', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        resetReaderState();
        loadIndexHtml();
        Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn();
        vi.clearAllMocks();
        document.body.classList.remove('reader-focus-mode');
    });

    it('글자 크기 +/-/리셋 → 표시·CSS 변수·localStorage 영속, 경계 클램프', async () => {
        await renderRichChapter();

        el('reader-font-increase').click();
        expect(el('reader-font-size-display').textContent).toBe('105%');
        expect(storedJson(STORAGE_KEYS.READER_FONT_SCALE)).toBe(1.05);
        expect(el('textbook-reader-container').style.getPropertyValue('--reader-font-scale')).toBe('1.05');

        el('reader-font-reset').click();
        expect(el('reader-font-size-display').textContent).toBe('100%');

        // 하한 클램프: 1.0 → 0.85까지
        for (let i = 0; i < 5; i++) el('reader-font-decrease').click();
        expect(el('reader-font-size-display').textContent).toBe('85%');
        el('reader-font-decrease').click();
        expect(el('reader-font-size-display').textContent).toBe('85%');
    });

    it('줄 간격 조절 → 표시·CSS 변수·영속, 리셋 복원', async () => {
        await renderRichChapter();

        el('reader-line-height-decrease').click();
        expect(el('reader-line-height-display').textContent).toBe('1.95');
        expect(storedJson(STORAGE_KEYS.READER_LINE_HEIGHT)).toBe(1.95);

        el('reader-line-height-reset').click();
        expect(el('reader-line-height-display').textContent).toBe('2.05');
    });

    it('집중 모드 토글 → body 클래스 + 버튼 라벨 전환', async () => {
        await renderRichChapter();

        el('reader-focus-toggle').click();
        expect(document.body.classList.contains('reader-focus-mode')).toBe(true);
        expect(el('reader-focus-toggle').textContent).toContain('집중 해제');

        el('reader-focus-toggle').click();
        expect(document.body.classList.contains('reader-focus-mode')).toBe(false);
    });

    it('툴바 접기 토글 → collapsed + aria-expanded', async () => {
        await renderRichChapter();

        el('reader-toolbar-toggle').click();
        expect(el('reader-toolbar').classList.contains('collapsed')).toBe(true);
        expect(el('reader-toolbar-toggle').getAttribute('aria-expanded')).toBe('false');
    });

    it('모두 접기/펼치기 → 섹션 카드 collapsed 일괄 토글', async () => {
        await renderRichChapter();

        el('reader-collapse-all').click();
        const cards = el('textbook-reader-container').querySelectorAll('.reader-section-card');
        expect(cards.length).toBeGreaterThan(0);
        cards.forEach(c => expect(c.classList.contains('collapsed')).toBe(true));

        el('reader-expand-all').click();
        cards.forEach(c => expect(c.classList.contains('collapsed')).toBe(false));
    });

    it('본문 검색 → 하이라이트 마크 + 카운트, next/prev 순환, clear 해제', async () => {
        await renderRichChapter();

        const input = el('reader-in-content-search');
        input.value = '화장품';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

        const view = el('textbook-reader-view');
        const marks = view.querySelectorAll('.reader-search-highlight');
        expect(marks.length).toBe(2); // 섹션 2곳에 '화장품'
        expect(el('reader-search-count').textContent).toBe('1/2');
        expect(marks[0].classList.contains('current-match')).toBe(true);

        el('reader-search-next').click();
        expect(el('reader-search-count').textContent).toBe('2/2');
        expect(marks[1].classList.contains('current-match')).toBe(true);

        el('reader-search-prev').click();
        expect(el('reader-search-count').textContent).toBe('1/2');

        el('reader-search-clear').click();
        expect(view.querySelectorAll('.reader-search-highlight').length).toBe(0);
    });

    it('본문 검색 — 2글자 미만 쿼리는 무시', async () => {
        await renderRichChapter();

        const input = el('reader-in-content-search');
        input.value = '화';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(el('textbook-reader-view').querySelectorAll('.reader-search-highlight').length).toBe(0);
    });

    it('모바일 TOC 드로어 — 버튼 토글 + backdrop 클릭 닫기', async () => {
        await renderRichChapter();

        el('reader-toc-mobile-btn').click();
        expect(el('reader-toc').classList.contains('mobile-open')).toBe(true);
        expect(el('reader-toc-backdrop').classList.contains('is-hidden')).toBe(false);

        el('reader-toc-backdrop').click();
        expect(el('reader-toc').classList.contains('mobile-open')).toBe(false);
        expect(el('reader-toc-backdrop').classList.contains('is-hidden')).toBe(true);
    });

    it('표 확장 → 모달에 테이블 복제, 닫기 버튼·Escape로 닫힘', async () => {
        await renderRichChapter();

        const expandBtn = el('textbook-reader-container').querySelector('.reader-table-expand-btn');
        expect(expandBtn).toBeTruthy();
        expandBtn.click();

        const modal = el('reader-table-modal');
        expect(modal.classList.contains('is-hidden')).toBe(false);
        expect(el('reader-table-modal-body').querySelector('table')).toBeTruthy();

        el('reader-table-modal-close').click();
        expect(modal.classList.contains('is-hidden')).toBe(true);

        // 다시 열어 Escape로 닫기
        expandBtn.click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(modal.classList.contains('is-hidden')).toBe(true);
    });

    it('TOC 항목 클릭 → 해당 섹션으로 스크롤 + 접힘 해제', async () => {
        await renderRichChapter();
        const scrollSpy = vi.fn();
        Element.prototype.scrollIntoView = scrollSpy;

        const cards = el('textbook-reader-container').querySelectorAll('.reader-section-card');
        cards[1].classList.add('collapsed');
        const tocItem = el('reader-toc-list').querySelector('.reader-toc-item[data-section-idx="1"]');
        expect(tocItem).toBeTruthy();
        tocItem.click();

        expect(scrollSpy).toHaveBeenCalled();
        expect(cards[1].classList.contains('collapsed')).toBe(false);
    });

    it('themechange 이벤트 → 리더 테마 클래스 동기화', async () => {
        await renderRichChapter();
        document.documentElement.classList.add('light-theme');
        document.dispatchEvent(new Event('themechange'));
        expect(el('textbook-reader-view').classList.contains('reader-light-theme')).toBe(true);
        document.documentElement.classList.remove('light-theme');
    });
});
