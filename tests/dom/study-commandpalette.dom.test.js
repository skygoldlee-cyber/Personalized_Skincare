// tests/dom/study-commandpalette.dom.test.js — 통합 검색 팔레트 UI
import { describe, it, beforeEach, expect, vi } from 'vitest';
import {
    initCommandPalette, openCommandPalette, closeCommandPalette, executePaletteResult
} from '../../src/command-palette.js';

function seedDom() {
    document.body.innerHTML = `
        <button class="nav-item" data-target="dashboard-view">대시보드</button>
        <button class="nav-item" data-target="flashcard-view">플래시카드</button>
        <button class="nav-item is-hidden" data-target="dictionary-view">성분 사전</button>`;
    window.STUDY_DATA = {
        law: {
            name: '화장품법의 이해',
            cards: [{ id: 'c1', term: '화장품 정의', definition: '피부에 사용' }],
            quizzes: [{ id: 'q1', question: '화장품법의 목적은?', options: ['공중위생'] }],
            chapters: [{ chapterTitle: 'Chapter 01 총칙', sections: [{ title: '화장품의 정의', content: '' }] }]
        }
    };
    window.INGREDIENTS_DATA = [{ name: '글리세린', engName: 'Glycerin', category: '보습' }];
    window.DataLoader = { registry: { exams: [{ title: '화장품법의 이해 (100문)', file: '과목1.md', subject: 'law' }] } };
}

function type(query) {
    const input = document.getElementById('cmdk-input');
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(k, opts = {}) {
    document.getElementById('cmdk-input')
        .dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }));
}

describe('command-palette — 통합 검색', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        seedDom();
        initCommandPalette();
    });

    it('Ctrl+K로 팔레트가 열리고 다시 누르면 닫힌다', () => {
        const overlay = document.getElementById('cmdk-overlay');
        expect(overlay).toBeTruthy();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        expect(overlay.classList.contains('is-hidden')).toBe(false);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        expect(overlay.classList.contains('is-hidden')).toBe(true);
    });

    it('검색어 입력 → 유형별 그룹 헤더와 결과 렌더링', () => {
        openCommandPalette();
        type('화장품');
        const box = document.getElementById('cmdk-results');
        expect(box.querySelectorAll('.cmdk-item').length).toBeGreaterThan(0);
        const labels = [...box.querySelectorAll('.cmdk-group-label')].map(el => el.textContent);
        expect(labels).toContain('교재');
        expect(labels).toContain('플래시카드');
    });

    it('매칭 없을 때 본문검색 브리지 항목 표시', () => {
        openCommandPalette();
        type('존재하지않는검색어');
        const items = document.querySelectorAll('#cmdk-results .cmdk-item');
        expect(items.length).toBe(1);
        expect(document.getElementById('cmdk-results').textContent).toContain('본문에서');
    });

    it('화살표 키로 활성 항목 이동, Enter로 실행', () => {
        openCommandPalette();
        type('대시보드');
        const btn = document.querySelector('.nav-item[data-target="dashboard-view"]');
        const spy = vi.fn();
        btn.addEventListener('click', spy);
        key('ArrowDown');
        key('ArrowUp'); // wrap-around 순환 확인
        key('Enter');
        expect(spy).toHaveBeenCalled();
        expect(document.getElementById('cmdk-overlay').classList.contains('is-hidden')).toBe(true);
    });

    it('Escape로 닫힌다', () => {
        openCommandPalette();
        expect(document.getElementById('cmdk-overlay').classList.contains('is-hidden')).toBe(false);
        key('Escape');
        expect(document.getElementById('cmdk-overlay').classList.contains('is-hidden')).toBe(true);
    });

    it('뷰 결과 실행 → 해당 nav-item 클릭', () => {
        openCommandPalette();
        type('플래시카드');
        const btn = document.querySelector('.nav-item[data-target="flashcard-view"]');
        const spy = vi.fn();
        btn.addEventListener('click', spy);
        executePaletteResult(0);
        expect(spy).toHaveBeenCalled();
    });

    it('카드 결과 실행 → startSubjectStudy 호출', () => {
        const spy = vi.fn();
        window.startSubjectStudy = spy;
        openCommandPalette();
        type('화장품 정의');
        const idx = [...document.querySelectorAll('.cmdk-item')]
            .findIndex(el => el.textContent.includes('화장품 정의'));
        expect(idx).toBeGreaterThanOrEqual(0);
        executePaletteResult(idx);
        expect(spy).toHaveBeenCalledWith('law');
    });

    it('특수문자 포함 검색어가 안전하게 렌더링된다', () => {
        openCommandPalette();
        type('<img src=x onerror=alert(1)>');
        const box = document.getElementById('cmdk-results');
        expect(box.innerHTML).toContain('&lt;img');
        expect(box.querySelector('img')).toBeNull();
    });

    it('feature 게이팅된(is-hidden) 뷰는 검색 대상에서 제외', () => {
        openCommandPalette();
        type('성분 사전');
        const items = [...document.querySelectorAll('.cmdk-item-title')].map(el => el.textContent);
        expect(items).not.toContain('성분 사전');
    });
});
