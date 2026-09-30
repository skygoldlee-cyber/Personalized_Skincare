// tests/dom/dictionary-schema.dom.test.js — 비기본 시험 지식DB 스키마 드리븐 렌더 검증
// @spec DI-01~03
// 검증: manifest.knowledge → registry.knowledge 스키마가 식품첨가물 스키마로
//       카드·배지·필터·헤더·CSV를 렌더하는지 확인 (Phase D — food 시험 additives)

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
    renderDictionary, filterDictionary, setDictFilter, dictState,
    dictExportCsv,
} from '../../src/views/dictionary.js';

// food/manifest.json의 knowledge 스키마를 반영한 축소본
const FOOD_SCHEMA = {
    registryKey: 'additives',
    global: 'ADDITIVES_DATA',
    entityUnit: '첨가물',
    filterField: 'useCategory',
    fields: {
        title: 'name',
        subtitle: 'engName',
        subtitleEmpty: '영문명 없음',
        search: ['name', 'engName', 'purpose', 'useLimit'],
        chosungField: 'name',
    },
    badge: {
        field: 'useCategory',
        defaultLabel: '기타',
        labels: { preservative: '보존료', sweetener: '감미료', colorFixative: '발색제' },
    },
    filters: [
        { key: 'all', label: '전체 첨가물' },
        { key: 'preservative', label: '보존료' },
        { key: 'sweetener', label: '감미료' },
        { key: 'colorFixative', label: '발색제' },
    ],
    details: [
        { key: 'purpose', label: '용도', empty: '-' },
        { key: 'useLimit', label: '사용기준', empty: '공전 사용기준표 참조', wide: true },
        { key: 'note', label: 'TIP', tip: true },
    ],
    csv: {
        filename: 'additives',
        headers: ['첨가물명', '영문명', '용도', '분류', '사용기준'],
        fields: ['name', 'engName', 'purpose', { badgeLabel: 'useCategory' }, 'useLimit'],
    },
    header: {
        title: '식품첨가물 사전',
        subtitle: '지정 식품첨가물 검색 — 식품첨가물공전 기준',
        searchPlaceholder: '첨가물명·영문명·용도 검색',
    },
};

const DB = [
    { name: '소르빈산', engName: 'Sorbic Acid', useCategory: 'preservative', purpose: '보존료 — 곰팡이 억제', useLimit: '식품류별 상이', note: '칼륨염으로도 지정' },
    { name: '아스파탐', engName: 'Aspartame', useCategory: 'sweetener', purpose: '감미료 — 설탕 대비 200배', useLimit: '식품류별 상이' },
    { name: '아질산나트륨', engName: 'Sodium Nitrite', useCategory: 'colorFixative', purpose: '발색제 — 햄·소시지 발색', useLimit: '0.07g/kg 이하' },
];

describe('지식DB 사전 — 비기본 스키마(식품첨가물)', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        dictState.query = '';
        dictState.filter = 'all';
        loadIndexHtml();
        // dictionary.js는 window.DataLoader 전역의 registry를 읽는다 (모듈 임포트 아님)
        window.DataLoader = {
            registry: {
                knowledge: FOOD_SCHEMA,
                additives: { version: '0.1.0', stats: { count: DB.length } },
            },
        };
        window.ADDITIVES_DATA = DB;
        delete window.INGREDIENTS_DATA; // 기본 스키마 전역과 오염 방지
        vi.clearAllMocks();
    });

    it('스키마 필드로 카드 렌더 — 제목·부제·분류 배지 라벨', () => {
        renderDictionary();

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(3);
        expect(cards[0].querySelector('.dict-card-title').textContent).toBe('소르빈산');
        expect(cards[0].querySelector('.dict-card-subtitle').textContent).toBe('Sorbic Acid');
        expect(cards[0].querySelector('.dict-badge').textContent).toBe('보존료');
        expect(cards[1].querySelector('.dict-badge').textContent).toBe('감미료');
        expect(cards[2].querySelector('.dict-badge').textContent).toBe('발색제');
    });

    it('스키마 필터 버튼을 렌더 — cosmetic 유형 버튼이 아닌 첨가물 분류', () => {
        renderDictionary();

        const filters = [...document.querySelectorAll('.dict-filter-buttons button')].map(b => b.dataset.filter);
        expect(filters).toEqual(['all', 'preservative', 'sweetener', 'colorFixative']);
        expect(document.querySelector('.dict-filter-buttons').textContent).toContain('전체 첨가물');
    });

    it('useCategory 필터 → 해당 분류만 표시', () => {
        setDictFilter('sweetener');

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('아스파탐');
    });

    it('스키마 search 필드 — 용도 텍스트로 검색 매칭', () => {
        el('dict-search-input').value = '곰팡이';
        filterDictionary();

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('소르빈산');
    });

    it('상세 행은 스키마 details 키를 표시', () => {
        renderDictionary();
        const card = el('dict-results-container').querySelector('.dict-card');
        card.click();

        const details = card.querySelector('.dict-card-details');
        expect(details.textContent).toContain('용도');
        expect(details.textContent).toContain('곰팡이 억제');
        expect(details.textContent).toContain('사용기준');
        expect(details.textContent).toContain('칼륨염으로도 지정'); // tip 행
    });

    it('버전 표기가 entityUnit + registry 메타를 사용', () => {
        renderDictionary();
        expect(el('dict-db-version').textContent).toContain('첨가물 DB v0.1.0');
        expect(el('dict-db-version').textContent).toContain('3종');
    });

    it('CSV보내기 — 스키마 csv.fields(배지 라벨 치환) + 파일명', () => {
        const dl = spyAnchorDownload();
        dictExportCsv();
        dl.restore();

        expect(dl.clicks.length).toBe(1);
        expect(dl.clicks[0].download).toMatch(/^additives_v0\.1\.0_.*\.csv$/);
        expect(lastToast()[0]).toContain('첨가물 3종');
    });
});
