// tests/dom/study-dictionary.dom.test.js — 성분 사전 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 원료 카드 렌더·배지(H) · 검색(이름/영문/초성)·필터(H) · 빈 DB(E)
//       · 결과 없음(B) · 카드 펼침(H) · 검색 초기화(H)

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { loadIndexHtml, el, resetStudyState, spyAnchorDownload, lastToast } from './helpers.js';
import {
    renderDictionary, filterDictionary, setDictFilter, clearDictSearch, dictState,
    dictExportCsv,
} from '../../src/views/dictionary.js';
import { showToast } from '../../src/ui-utils.js';

const DB = [
    { name: '글리세린', engName: 'Glycerin', type: 'approved', category: '보습제', description: '습윤제', limit: '제한 없음', tip: '보습 핵심' },
    { name: '살리실산', engName: 'Salicylic Acid', type: 'restricted', category: '각질제거', description: 'BHA', limit: '0.5% 이하' },
    { name: '포름알데히드', engName: 'Formaldehyde', type: 'banned', category: '방부제', description: '사용 금지' },
];

function render() {
    renderDictionary();
}

describe('성분 사전 — 검색·필터·카드', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        dictState.query = '';
        dictState.filter = 'all';
        loadIndexHtml();
        window.INGREDIENTS_DATA = DB;
        vi.clearAllMocks();
    });

    it('DB 로드 → 카드 3종 + 상태 배지', () => {
        render();

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(3);
        expect(cards[0].textContent).toContain('글리세린');
        expect(cards[0].querySelector('.dict-badge').textContent).toBe('사용 가능');
        expect(cards[1].querySelector('.dict-badge').textContent).toBe('사용 제한');
        expect(cards[2].querySelector('.dict-badge').textContent).toBe('사용 금지');
    });

    it('빈 DB → 안내 메시지 (E)', () => {
        window.INGREDIENTS_DATA = [];
        render();
        expect(el('dict-results-container').textContent).toContain('원료 데이터베이스가 비어있습니다');
    });

    it('이름 검색 → 매칭 카드만 표시', () => {
        el('dict-search-input').value = '살리실산';
        filterDictionary();

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('Salicylic Acid');
    });

    it('영문명 검색 → 매칭', () => {
        el('dict-search-input').value = 'glycerin';
        filterDictionary();
        expect(el('dict-results-container').querySelectorAll('.dict-card').length).toBe(1);
    });

    it('초성 검색 → ㄱㄹㅅㄹ 매칭', () => {
        el('dict-search-input').value = 'ㄱㄹㅅㄹ';
        filterDictionary();

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('글리세린');
    });

    it('카테고리 필터 → 해당 type만 표시 + 버튼 활성화', () => {
        setDictFilter('banned');

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(1);
        expect(cards[0].querySelector('.dict-badge').textContent).toBe('사용 금지');
        expect(document.querySelector('.dict-filter-buttons [data-filter="banned"]').classList.contains('active-filter')).toBe(true);
    });

    it('검색+필터 결과 없음 → 없음 안내 (B)', () => {
        el('dict-search-input').value = '없는성분';
        filterDictionary();
        expect(el('dict-results-container').textContent).toContain('검색 결과가 없습니다');
    });

    it('카드 클릭 → 상세 펼침/접힘 토글', () => {
        render();
        const card = el('dict-results-container').querySelector('.dict-card');
        const details = card.querySelector('.dict-card-details');

        expect(details.classList.contains('is-hidden')).toBe(true);
        card.click();
        expect(details.classList.contains('is-hidden')).toBe(false);
        expect(details.textContent).toContain('습윤제');
        expect(details.textContent).toContain('보습 핵심'); // tip
        card.click();
        expect(details.classList.contains('is-hidden')).toBe(true);
    });

    it('검색 초기화 → 전체 목록 복원', () => {
        el('dict-search-input').value = '살리실산';
        filterDictionary();
        clearDictSearch();

        expect(el('dict-search-input').value).toBe('');
        expect(el('dict-results-container').querySelectorAll('.dict-card').length).toBe(3);
    });

    it('CSV보내기 — 전체 목록 다운로드 트리거 + 건수 토스트', () => {
        const dl = spyAnchorDownload();
        dictExportCsv();
        dl.restore();

        expect(dl.clicks.length).toBe(1);
        expect(dl.clicks[0].download).toMatch(/^ingredients.*\.csv$/);
        expect(lastToast()[0]).toContain('3종');
        expect(lastToast()[1]).toBe('success');
    });

    it('CSV보내기 — 필터 적용 시 해당 유형만보내기', () => {
        setDictFilter('banned');
        const dl = spyAnchorDownload();
        dictExportCsv();
        dl.restore();

        expect(dl.clicks.length).toBe(1);
        expect(lastToast()[0]).toContain('1종');
    });

    it('CSV보내기 — 검색 결과 0건이면 warning 토스트, 다운로드 없음', () => {
        el('dict-search-input').value = '없는성분';
        filterDictionary();
        const dl = spyAnchorDownload();
        dictExportCsv();
        dl.restore();

        expect(dl.clicks.length).toBe(0);
        expect(vi.mocked(showToast).mock.calls.at(-1)[1]).toBe('warning');
    });
});
