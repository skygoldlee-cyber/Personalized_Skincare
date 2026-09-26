// tests/dom/study-search.dom.test.js — 교재 검색 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 검색어 입력→역색인 검색→결과 카드(H) · 과목 필터(H) · 결과 없음(B)
//       · 초기화→빈 상태(E) · 하이라이트·더보기 토글(H)

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import {
    loadIndexHtml, el, stubRegistry, resetStudyState,
} from './helpers.js';
import {
    renderTextbookSearch, setTextbookFilter, clearTextbookSearch, toggleTextbookCard,
} from '../../src/views/textbook-search.js';

const SUBJ_A = {
    key: 'subja',
    name: '과목A',
    chapters: [{
        chapterKey: 'ch1',
        chapterTitle: '1장 화장품법',
        filePath: 'content/exams/cosmetic/교재/subja.md',
        sections: [
            { title: '화장품 정의', content: '화장품은 인체를 청결 미화하는 물품이다.' },
            { title: '조제관리사', content: '맞춤형 화장품 조제관리사는 혼합 소분 업무를 한다.' },
        ],
    }],
};
const SUBJ_B = {
    key: 'subjb',
    name: '과목B',
    chapters: [{
        chapterKey: 'ch1',
        chapterTitle: '1장 제조',
        filePath: 'content/exams/cosmetic/교재/subjb.md',
        sections: [
            { title: '화장품 제조', content: '제조업 등록과 품질관리 기준을 따른다.' },
        ],
    }],
};

function search(query) {
    el('textbook-search-input').value = query;
    el('textbook-search-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

describe('교재 검색 — 역색인·필터·결과 카드', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        stubRegistry([SUBJ_A, SUBJ_B]);
        renderTextbookSearch();
        setTextbookFilter('all'); // 모듈 상태 리셋
        vi.clearAllMocks();
    });

    it('빈 검색어 → 초기 안내 상태 (E)', () => {
        expect(el('textbook-results-container').textContent).toContain('검색어를 입력하세요');
        expect(el('textbook-search-summary').textContent).toContain('키워드를 입력하면');
    });

    it('검색어 입력(Enter) → 매칭 섹션 카드·하이라이트·건수 요약 (H)', () => {
        search('화장품');

        const cards = el('textbook-results-container').querySelectorAll('.textbook-result-card');
        expect(cards.length).toBe(3); // 과목A 2건 + 과목B 1건
        expect(el('textbook-search-summary').innerHTML).toContain('3</strong>건');
        expect(cards[0].querySelector('.textbook-card-title').innerHTML).toContain('<mark');
        expect(cards[0].textContent).toContain('과목A');
        expect(cards[0].textContent).toContain('1장 화장품법');
    });

    it('복수 키워드 → AND 검색 (교집합)', () => {
        search('화장품 조제관리사');

        const cards = el('textbook-results-container').querySelectorAll('.textbook-result-card');
        expect(cards.length).toBe(1);
        expect(cards[0].querySelector('.textbook-card-title').textContent).toContain('조제관리사');
    });

    it('과목 필터 → 해당 과목 결과만 표시 + 필터 버튼 활성화', () => {
        search('화장품');
        setTextbookFilter('subja');

        const cards = el('textbook-results-container').querySelectorAll('.textbook-result-card');
        expect(cards.length).toBe(2);
        cards.forEach(c => expect(c.textContent).toContain('과목A'));
        // 과목 버튼은 동적 생성 — '전체' 버튼의 active 해제로 필터 적용 확인
        const allBtn = document.querySelector('.textbook-filter-buttons [data-filter="all"]');
        expect(allBtn.classList.contains('active-filter')).toBe(false);
    });

    it('일치 없음 → 없음 안내 (B)', () => {
        search('존재하지않는키워드');

        expect(el('textbook-results-container').textContent).toContain('일치하는 내용이 없습니다');
        expect(el('textbook-search-summary').innerHTML).toContain('0</strong>건');
    });

    it('검색 초기화 → 빈 상태 복귀', () => {
        search('화장품');
        clearTextbookSearch();

        expect(el('textbook-search-input').value).toBe('');
        expect(el('textbook-results-container').textContent).toContain('검색어를 입력하세요');
    });

    it('긴 결과 → 더보기 버튼·접기 토글 (H)', () => {
        window.STUDY_DATA = {}; // 기본 픽스처 제외하고 장문 과목만 색인
        const longSubj = {
            key: 'subjc', name: '과목C',
            chapters: [{
                chapterKey: 'ch1', chapterTitle: '긴장', filePath: 'x.md',
                sections: [{ title: '화장품 장문', content: '화장품 '.repeat(100) }],
            }],
        };
        stubRegistry([longSubj]);
        search('화장품');

        const body = el('textbook-card-0-body');
        expect(body.classList.contains('collapsed')).toBe(true);
        toggleTextbookCard('textbook-card-0');
        expect(body.classList.contains('collapsed')).toBe(false);
        expect(el('textbook-card-0-toggle-btn').textContent).toContain('접기');
    });
});
