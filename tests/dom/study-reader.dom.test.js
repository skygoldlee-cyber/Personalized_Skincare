// tests/dom/study-reader.dom.test.js — 교재 리더 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 4)
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
