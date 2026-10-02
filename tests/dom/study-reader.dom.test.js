// tests/dom/study-reader.dom.test.js — 교재 리더 시나리오
// @spec TR-01~18
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

    it('툴바 접기 토글 → collapsed + aria-expanded', async () => {
        await renderRichChapter();

        el('reader-toolbar-toggle').click();
        expect(el('reader-toolbar').classList.contains('collapsed')).toBe(true);
        expect(el('reader-toolbar-toggle').getAttribute('aria-expanded')).toBe('false');
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

import { markStoryNarrative } from '../../src/reader-format.js';

describe('이야기형 서사 태깅 — markStoryNarrative', () => {
    function buildCard(title, innerHtml) {
        document.body.innerHTML = `
            <div class="reader-section-card">
                <div class="reader-section-header"><h4 class="reader-section-title">${title}</h4></div>
                <div class="textbook-reader-section-content">${innerHtml}</div>
            </div>`;
        return document.querySelector('.textbook-reader-section-content');
    }

    it('📖 장면 헤딩 ~ 동급 본문 헤딩 전까지 서사 태깅', () => {
        const content = buildCard('📚 Chapter 01', `
            <h4 class="md-h4">1.1 본문 소제목</h4>
            <p class="md-para">본문 설명</p>
            <h4 class="md-h4">📖 민수의 상황</h4>
            <p class="md-para">서사 문단</p>
            <div class="md-quote">"대사입니다"</div>
            <div class="md-quote">🔖 기억 태그: 콜아웃</div>
            <h4 class="md-h4">2.1 다음 본문</h4>
            <p class="md-para">다시 본문</p>`);
        markStoryNarrative(content);

        const paras = content.querySelectorAll('p.md-para');
        expect(paras[0].classList.contains('story-narrative')).toBe(false); // 장면 이전 본문
        expect(paras[1].classList.contains('story-narrative')).toBe(true);  // 장면 서사
        expect(paras[2].classList.contains('story-narrative')).toBe(false); // 장면 종료 후 본문
        const heads = content.querySelectorAll('.md-h4');
        expect(heads[1].classList.contains('story-narrative')).toBe(true);  // 📖 헤딩
        expect(heads[2].classList.contains('story-narrative')).toBe(false);
        const quotes = content.querySelectorAll('.md-quote');
        expect(quotes[0].classList.contains('story-narrative')).toBe(true);  // 대사
        expect(quotes[1].classList.contains('story-narrative')).toBe(false); // 🔖 콜아웃 제외
    });

    it('💭 에필로그 인용구부터 섹션 끝까지 서사 태깅', () => {
        const content = buildCard('📚 Chapter 01', `
            <p class="md-para">본문</p>
            <div class="md-quote">💭 에필로그 — Chapter 01을 마치며</div>
            <p class="md-para">에필로그 서사</p>`);
        markStoryNarrative(content);

        const paras = content.querySelectorAll('p.md-para');
        expect(paras[0].classList.contains('story-narrative')).toBe(false);
        expect(paras[1].classList.contains('story-narrative')).toBe(true);
        expect(content.querySelector('.md-quote').classList.contains('story-narrative')).toBe(true);
    });

    it('h3 장면 이후의 h4 본문 소제목은 서사로 물들지 않는다 (리프 블록 종료)', () => {
        const content = buildCard('📚 Chapter 01', `
            <h3 class="md-h3">📖 수진, 조제대 앞에서 얼어붙다</h3>
            <p class="md-para">서사 문단</p>
            <h4 class="md-h4">1.1 「화장품법」</h4>
            <p class="md-para">본문 설명</p>`);
        markStoryNarrative(content);

        const paras = content.querySelectorAll('p.md-para');
        expect(paras[0].classList.contains('story-narrative')).toBe(true);
        expect(paras[1].classList.contains('story-narrative')).toBe(false);
        expect(content.querySelector('.md-h3').classList.contains('story-narrative')).toBe(true);
        expect(content.querySelector('.md-h4').classList.contains('story-narrative')).toBe(false);
    });

    it('명시 마커 모드 — 📖┈이야기┈ ~ ┈본문┈📘 사이만 서사 태깅', () => {
        const content = buildCard('📚 Chapter 01', `
            <p class="md-para">본문 문단</p>
            <p class="md-para">📖 ┈┈┈┈ 이야기 ┈┈┈┈</p>
            <h4 class="md-h4">📖 민수의 상황</h4>
            <p class="md-para">서사 문단</p>
            <div class="md-quote">🔖 기억 태그도 마커 안이면 서사</div>
            <p class="md-para">┈┈┈┈ 본문 ┈┈┈┈ 📘</p>
            <p class="md-para">다시 본문</p>
            <h4 class="md-h4">📖 마커 밖 📖 헤딩은 무시</h4>
            <p class="md-para">본문</p>`);
        markStoryNarrative(content);

        const paras = content.querySelectorAll('p.md-para');
        expect(paras[0].classList.contains('story-narrative')).toBe(false);
        expect(paras[1].classList.contains('story-boundary-start')).toBe(true);
        expect(paras[2].classList.contains('story-narrative')).toBe(true);
        expect(paras[3].classList.contains('story-boundary-end')).toBe(true);
        expect(paras[4].classList.contains('story-narrative')).toBe(false);
        expect(paras[5].classList.contains('story-narrative')).toBe(false);
        // 마커 모드에서는 헤딩 휴리스틱이 개입하지 않는다
        expect(content.querySelectorAll('.md-h4')[0].classList.contains('story-narrative')).toBe(true);
        expect(content.querySelectorAll('.md-h4')[1].classList.contains('story-narrative')).toBe(false);
        // 마커 안 콜아웃은 명시 범위라 서사로 태깅된다
        expect(content.querySelector('.md-quote').classList.contains('story-narrative')).toBe(true);
    });

    it('컨테이너 div는 textContent가 마커 패턴이어도 경계로 오인하지 않음', () => {
        // .reader-subsection-content가 마커 문단으로 시작/끝나면 div 전체가
        // .story-boundary로 태깅되어 내부 전체가 중앙정렬되는 회귀 방지
        const content = buildCard('📚 Chapter 01', `
            <p class="md-para">본문 문단</p>
            <div class="reader-subsection-content">
                <p class="md-para">📖 ┈┈┈┈ 이야기 ┈┈┈┈</p>
                <p class="md-para">서사 문단</p>
                <p class="md-para">┈┈┈┈ 본문 ┈┈┈┈ 📘</p>
                <p class="md-para">다시 본문</p>
            </div>
            <p class="md-para">뒤따르는 본문</p>`);
        markStoryNarrative(content);

        const sub = content.querySelector('.reader-subsection-content');
        // 컨테이너 div 자체는 경계가 아니지만, 바깥 호출은 하위 리프 마커를 정상 태깅한다
        expect(sub.classList.contains('story-boundary')).toBe(false);
        expect(sub.classList.contains('story-narrative')).toBe(false);
        const paras = sub.querySelectorAll('p.md-para');
        expect(paras[0].classList.contains('story-boundary-start')).toBe(true);
        expect(paras[1].classList.contains('story-narrative')).toBe(true);
        expect(paras[2].classList.contains('story-boundary-end')).toBe(true);
        expect(paras[3].classList.contains('story-narrative')).toBe(false);
        // 마커 범위 밖의 본문은 태깅되지 않는다
        expect(content.querySelectorAll(':scope > p.md-para.story-narrative').length).toBe(0);
    });

    it('끝 마커만 단독으로 있는 컨테이너 — 이어지는 서사 범위로 처리', () => {
        // 서사 범위가 서브섹션 경계를 넘나들어 끝 마커만 남은 경우:
        // 마커 앞 요소는 서사, 끝 마커는 숨김 태깅되어야 한다
        const content = buildCard('📚 Chapter 01', `
            <p class="md-para">서사 문단</p>
            <div class="md-quote">"대사"</div>
            <p class="md-para">┈┈┈┈ 본문 ┈┈┈┈ 📘</p>
            <p class="md-para">이후 본문</p>`);
        markStoryNarrative(content);

        const paras = content.querySelectorAll('p.md-para');
        expect(paras[0].classList.contains('story-narrative')).toBe(true);
        expect(content.querySelector('.md-quote').classList.contains('story-narrative')).toBe(true);
        expect(paras[1].classList.contains('story-boundary-end')).toBe(true);
        expect(paras[2].classList.contains('story-narrative')).toBe(false);
    });

    it('이야기 접기 칩이 서사 멤버를 토글한다', () => {
        const content = buildCard('📚 Chapter 01', `
            <p class="md-para">📖 ┈┈┈┈ 이야기 ┈┈┈┈</p>
            <p class="md-para">서사 문단1</p>
            <div class="md-quote">"대사"</div>
            <p class="md-para">서사 문단2</p>
            <p class="md-para">┈┈┈┈ 본문 ┈┈┈┈ 📘</p>
            <p class="md-para">본문</p>`);
        markStoryNarrative(content);

        const toggle = content.querySelector('.story-toggle');
        expect(toggle).not.toBeNull();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        const members = [...content.querySelectorAll('.story-narrative')];
        expect(members.length).toBe(3);
        expect(members.every(m => !m.hidden)).toBe(true);

        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.classList.contains('is-collapsed')).toBe(true);
        expect(members.every(m => m.hidden)).toBe(true);
        expect(toggle.textContent).toContain('펼치기');

        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(members.every(m => !m.hidden)).toBe(true);
    });

    it('중첩 컨테이너 중복 호출 시 접기 칩은 1개만 생성된다', () => {
        // textbook-reader는 .textbook-reader-section-content와 .reader-subsection-content
        // 각각에 markStoryNarrative를 호출한다 — 같은 그룹에 칩이 두 번 삽입되면 안 된다
        const content = buildCard('📚 Chapter 01', `
            <div class="reader-subsection-content">
                <p class="md-para">📖 ┈┈┈┈ 이야기 ┈┈┈┈</p>
                <p class="md-para">서사 문단</p>
                <p class="md-para">┈┈┈┈ 본문 ┈┈┈┈ 📘</p>
            </div>`);
        markStoryNarrative(content);
        markStoryNarrative(content.querySelector('.reader-subsection-content'));
        markStoryNarrative(content); // 재렌더 중복 호출
        expect(content.querySelectorAll('.story-toggle').length).toBe(1);
    });

    it('서사 구간 양끝에 스크린리더 라벨이 삽입되고 중복 호출에도 1쌍만 유지된다', () => {
        const content = buildCard('📚 Chapter 01', `
            <p class="md-para">본문</p>
            <p class="md-para">📖 ┈┈┈┈ 이야기 ┈┈┈┈</p>
            <p class="md-para">서사 문단</p>
            <p class="md-para">┈┈┈┈ 본문 ┈┈┈┈ 📘</p>
            <p class="md-para">다시 본문</p>`);
        markStoryNarrative(content);
        markStoryNarrative(content); // 중복 호출
        const labels = content.querySelectorAll('.story-sr-label');
        expect(labels.length).toBe(2);
        expect(labels[0].textContent).toBe('이야기 구간 시작');
        expect(labels[1].textContent).toBe('이야기 구간 끝');
        // 라벨은 접기 대상 멤버 밖에 있어 접혀도 구조 전달 유지
        expect(labels[0].classList.contains('story-narrative')).toBe(false);
        expect(labels[0].classList.contains('sr-only')).toBe(true);
    });

    it('프롤로그·등장인물 카드는 전체 서사', () => {
        const content = buildCard('프롤로그 — 민수의 첫 번째 화장품', `
            <p class="md-para">서사 문단</p>
            <div class="md-quote">"혼자 질문하는 대사"</div>
            <div class="md-quote">📌 출처: 화장품법</div>`);
        markStoryNarrative(content);

        expect(content.querySelector('p.md-para').classList.contains('story-narrative')).toBe(true);
        const quotes = content.querySelectorAll('.md-quote');
        expect(quotes[0].classList.contains('story-narrative')).toBe(true);
        expect(quotes[1].classList.contains('story-narrative')).toBe(false);
    });
});

import { attachImageZoomIn, openImageZoom, closeImageZoom } from '../../src/image-zoom.js';

describe('이미지 확대 모달 — image-zoom', () => {
    function buildContentWithImg() {
        document.body.innerHTML = `
            <div class="textbook-reader-section-content">
                <p class="md-para"><img class="reader-img" src="./content/exams/cosmetic/교재/law/images/1과목_삽화.png" alt="삽화"></p>
                <p class="md-para">본문 문단</p>
            </div>`;
        return document.querySelector('.textbook-reader-section-content');
    }

    it('.reader-img 클릭 시 확대 모달이 열리고 클릭 원본 src/alt를 복제한다', () => {
        const content = buildContentWithImg();
        attachImageZoomIn(content);
        const img = content.querySelector('img.reader-img');
        img.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const modal = document.getElementById('reader-img-zoom-modal');
        expect(modal).toBeTruthy();
        expect(modal.classList.contains('is-hidden')).toBe(false);
        const zoomed = modal.querySelector('.img-zoom-target');
        expect(zoomed.src).toContain('images/1%');
        expect(zoomed.alt).toBe('삽화');
        expect(zoomed.classList.contains('reader-img')).toBe(false);
        closeImageZoom();
        expect(modal.classList.contains('is-hidden')).toBe(true);
    });

    it('본문 문단 클릭은 모달을 열지 않고, 재바인딩은 위임이라 중복되지 않는다', () => {
        const content = buildContentWithImg();
        attachImageZoomIn(content);
        attachImageZoomIn(content); // 재렌더 재호출 방어
        content.querySelectorAll('p.md-para')[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const modal = document.getElementById('reader-img-zoom-modal');
        expect(!modal || modal.classList.contains('is-hidden')).toBe(true);
    });

    it('닫기 버튼·배율 버튼이 동작한다', () => {
        const content = buildContentWithImg();
        openImageZoom(content.querySelector('img.reader-img'));
        const modal = document.getElementById('reader-img-zoom-modal');
        const level = () => parseInt(modal.querySelector('#img-zoom-level').textContent, 10);
        const before = level();
        modal.querySelector('#img-zoom-in').click();
        expect(level()).toBeGreaterThan(before);
        modal.querySelector('#img-zoom-out').click();
        expect(level()).toBe(before);
        modal.querySelector('#img-zoom-close').click();
        expect(modal.classList.contains('is-hidden')).toBe(true);
    });
});
