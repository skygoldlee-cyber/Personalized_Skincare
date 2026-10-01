// tests/dom/story-search.dom.test.js — 이야기형 서사 검색 (TS-10)
// @spec TS-10
// story_textbook 활성 시험에서 첫 검색이 storyFile을 지연 로드해
// 서사 블록만 인덱스에 병합하고 '서사' 배지로 구분 표시하는지 고정한다.

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
    loadIndexHtml, el, stubRegistry, resetStudyState,
} from './helpers.js';
import {
    renderTextbookSearch, setTextbookSearchQuery,
} from '../../src/views/textbook-search.js';

const STORY_MD = [
    '# 📕 과목A 이야기형 학습교재',
    '',
    '## 📚 Chapter 01. 정의',
    '',
    '<!-- story:start -->',
    '',
    '## 프롤로그 — 민수의 첫 도전',
    '',
    '민수는 비누방울 원리로 계면활성제를 이해했다.',
    '',
    '<!-- story:end -->',
    '',
    '본문 내용.',
].join('\n');

const SUBJ_A = {
    key: 'subja',
    name: '과목A',
    chapters: [{
        chapterKey: 'full',
        chapterTitle: '1장 정의',
        filePath: 'content/exams/cosmetic/교재/subja/subja_표준형.md',
        sections: [
            { title: '화장품 정의', content: '화장품은 인체를 청결 미화하는 물품이다.' },
        ],
    }],
};

const MANIFEST = {
    subjects: [{
        key: 'subja',
        name: '과목A',
        dir: '교재/subja',
        chapters: [{ key: 'full', title: '1장 정의', file: 'subja_표준형.md', storyFile: 'subja_이야기형.md' }],
    }],
};

function stubFetch() {
    vi.stubGlobal('fetch', vi.fn((url) => {
        const u = String(url);
        if (u.includes('manifest.json')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST) });
        }
        if (u.includes('이야기형')) {
            return Promise.resolve({ ok: true, text: () => Promise.resolve(STORY_MD) });
        }
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
    }));
}

describe('이야기형 서사 검색 (TS-10)', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        stubRegistry([SUBJ_A]);
        window.EXAMS_LIST = { exams: [{
            id: 'cosmetic', default: true, name: '테스트',
            features: { story_textbook: true },
            contentRoot: 'content/exams/cosmetic',
        }] };
        stubFetch();
        renderTextbookSearch();
    });

    it('서사 전용 표현 검색 — 지연 로드된 storyFile에서 매칭 + 서사 배지', async () => {
        // '비누방울'은 서사에만 존재 — 첫 실행 시 0건, 인덱스 병합 후 재검색으로 1건
        setTextbookSearchQuery('비누방울');
        expect(el('textbook-results-container').textContent).toContain('일치하는 내용이 없습니다');

        await vi.waitFor(() => {
            const cards = el('textbook-results-container').querySelectorAll('.textbook-result-card');
            expect(cards.length).toBe(1);
        }, { timeout: 3000 });

        const card = el('textbook-results-container').querySelector('.textbook-result-card');
        expect(card.textContent).toContain('비누방울');
        expect(card.textContent).toContain('서사');
        // 링크는 표준형이 아닌 storyFile로 연결된다
        const link = card.querySelector('a[href]');
        expect(link.getAttribute('href')).toContain('이야기형');
    });

    it('본문 검색은 기존 동작 유지 — 서사 항목이 OR로 추가 매칭되지 않음', async () => {
        setTextbookSearchQuery('화장품');
        await vi.waitFor(() => {
            expect(el('textbook-results-container').querySelectorAll('.textbook-result-card').length)
                .toBe(1);
        }, { timeout: 3000 });
        // 서사 인덱스 로드 후에도 '화장품'은 본문 섹션에만 매칭 (서사에 '화장품' 없음)
        await new Promise(r => setTimeout(r, 50));
        const cards = el('textbook-results-container').querySelectorAll('.textbook-result-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).not.toContain('서사');
    });
});
