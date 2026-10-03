// tests/dom/dictionary-custom.dom.test.js — 자가 등록 성분 사전 병합 검증
// @spec DI-06,DI-08
// 검증: schema.customKey 선언 시 로컬 등록 항목 병합·'사용자 등록' 배지·필터·
//       '성분 추가' 버튼 노출·'공식 등록됨' superseded·카드 '수정' 액션,
//       customKey 미선언 스키마는 버튼·병합 모두 없음.

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { loadIndexHtml, el, resetStudyState } from './helpers.js';
import { DataLoader } from '../../src/data-loader.js';
import {
    renderDictionary, setDictFilter, dictState,
} from '../../src/views/dictionary.js';
import { setJSON } from '../../src/storage.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

const COSMETIC_SCHEMA = {
    registryKey: 'ingredients',
    global: 'INGREDIENTS_DATA',
    entityUnit: '원료',
    filterField: 'type',
    customKey: 'CUSTOM_INGREDIENTS',
    customLabel: '성분 추가',
    fields: {
        title: 'name',
        subtitle: 'engName',
        subtitleEmpty: '영문명 없음',
        search: ['name', 'engName', 'category'],
        chosungField: 'name',
    },
    badge: {
        field: 'type',
        defaultLabel: '사용 가능',
        labels: { approved: '사용 가능', restricted: '사용 제한', banned: '사용 금지', custom: '사용자 등록' },
    },
    filters: [
        { key: 'all', label: '전체 성분' },
        { key: 'custom', label: '사용자 등록' },
    ],
    details: [{ key: 'category', label: '카테고리', empty: '기타' }],
};

const DB = [
    { name: '정제수', engName: 'Water', type: 'approved', category: '용제', limit: '' },
    { name: '살리실산', engName: 'Salicylic Acid', type: 'restricted', category: '각질', limit: '2.0%' },
];

function seedCustom(items) {
    setJSON(STORAGE_KEYS.CUSTOM_INGREDIENTS, items);
}

describe('지식DB 사전 — 자가 등록 성분 병합 (DI-06·08)', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        dictState.query = '';
        dictState.filter = 'all';
        loadIndexHtml();
        DataLoader.registry = {
            knowledge: COSMETIC_SCHEMA,
            ingredients: { version: '9.9.9', stats: { count: DB.length } },
        };
        window.INGREDIENTS_DATA = DB;
        vi.clearAllMocks();
    });

    it('자가 항목이 공식 목록 뒤에 병합 — 카드·"사용자 등록" 배지', () => {
        seedCustom([{ id: 'cing_1', name: '자체 베이스 A', engName: 'Base A', type: 'custom', custom: true, category: '베이스', limit: '' }]);
        renderDictionary();

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(3);
        const customCard = cards[2];
        expect(customCard.querySelector('.dict-card-title').textContent).toBe('자체 베이스 A');
        expect(customCard.querySelector('.dict-badge').textContent).toBe('사용자 등록');
        expect(customCard.querySelector('.dict-badge').className).toContain('custom');
    });

    it('"성분 추가" 버튼 노출 — customKey 선언 시에만', () => {
        renderDictionary();
        const btn = document.getElementById('dict-custom-add');
        expect(btn).not.toBeNull();
        expect(btn.dataset.click).toBe('customIngAdd');
        expect(btn.textContent).toContain('성분 추가');
    });

    it('custom 필터 → 자가 항목만 표시', () => {
        seedCustom([{ id: 'cing_1', name: '자체 베이스 A', type: 'custom', custom: true }]);
        setDictFilter('custom');

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        expect(cards.length).toBe(1);
        expect(cards[0].textContent).toContain('자체 베이스 A');
    });

    it('공식 동명 자가 항목 → "공식 등록됨" 배지 (DI-08)', () => {
        seedCustom([{ id: 'cing_1', name: '살리실산', type: 'custom', custom: true }]); // 등록 후 공식 DB에 편입된 시나리오
        renderDictionary();

        const cards = el('dict-results-container').querySelectorAll('.dict-card');
        const customCard = cards[2];
        expect(customCard.querySelector('.dict-card-title').textContent).toBe('살리실산');
        expect(customCard.querySelector('.dict-badge').textContent).toBe('공식 등록됨');
        expect(customCard.querySelector('.dict-badge').className).toContain('superseded');
    });

    it('자가 카드 상세에 "수정" 액션 — customIngEdit 위임', () => {
        seedCustom([{ id: 'cing_1', name: '자체 베이스 A', type: 'custom', custom: true }]);
        renderDictionary();

        const customCard = el('dict-results-container').querySelectorAll('.dict-card')[2];
        const editBtn = customCard.querySelector('[data-click="customIngEdit"]');
        expect(editBtn).not.toBeNull();
        expect(editBtn.dataset.arg).toBe('cing_1');
    });

    it('자가 수록수가 버전 배지에 병기 — "+자가 N"', () => {
        seedCustom([
            { id: 'cing_1', name: '자체A', type: 'custom', custom: true },
            { id: 'cing_2', name: '자체B', type: 'custom', custom: true },
        ]);
        renderDictionary();
        expect(el('dict-db-version').textContent).toContain('원료 DB v9.9.9');
        expect(el('dict-db-version').textContent).toContain('+자가 2');
    });
});

describe('지식DB 사전 — customKey 미선언 스키마는 자가 기능 없음', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        dictState.query = '';
        dictState.filter = 'all';
        loadIndexHtml();
        const noCustom = { ...COSMETIC_SCHEMA };
        delete noCustom.customKey;
        delete noCustom.customLabel;
        DataLoader.registry = {
            knowledge: noCustom,
            ingredients: { version: '9.9.9', stats: { count: DB.length } },
        };
        window.INGREDIENTS_DATA = DB;
        seedCustom([{ id: 'cing_1', name: '자체 베이스 A', type: 'custom', custom: true }]);
        vi.clearAllMocks();
    });

    it('자가 항목 미병합·버튼 미노출 — 스키마가 기능을 게이트', () => {
        renderDictionary();
        expect(el('dict-results-container').querySelectorAll('.dict-card').length).toBe(2);
        expect(document.getElementById('dict-custom-add')).toBeNull();
    });
});
