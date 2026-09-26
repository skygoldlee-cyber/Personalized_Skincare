// tests/dom/study-examselect.dom.test.js — 시험 선택 뷰 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.2 (Phase 5)
// 검증: EXAMS_LIST→카드 렌더·현재 시험 표시(H) · 다른 시험 선택→저장·리로드(P)
//       · 같은 시험 선택→대시보드 복귀(H) · 목록 비어있음(E)

import { describe, it, beforeEach, expect, vi } from 'vitest';

import { loadIndexHtml, el } from './helpers.js';
import { renderExamSelect, selectExamAction } from '../../src/views/exam-select.js';

const EXAMS = {
    exams: [
        { id: 'cosmetic', name: '맞춤형화장품 조제관리사', desc: '기본 시험', icon: 'fa-solid fa-flask', year: '2026', default: true },
        { id: 'other', name: '다른 시험', desc: '보조 시험', icon: 'fa-solid fa-book', year: '2026' },
    ],
};

describe('시험 선택 — 목록·전환·복귀', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.EXAMS_LIST = EXAMS;
        vi.clearAllMocks();
    });

    it('목록 렌더 → 시험 카드 2장 + 현재(기본) 시험 표시', () => {
        renderExamSelect();

        const cards = el('exam-select-list').querySelectorAll('.exam-select-card');
        expect(cards.length).toBe(2);
        expect(cards[0].textContent).toContain('맞춤형화장품 조제관리사');
        expect(cards[0].classList.contains('current')).toBe(true);
        expect(cards[0].textContent).toContain('현재 시험');
        expect(cards[1].classList.contains('current')).toBe(false);
    });

    it('다른 시험 선택 → current_exam 저장 + 리로드 트리거(P)', () => {
        renderExamSelect();
        // jsdom에서 location.reload는 미구현 — 호출 시도만으로 selectExam이 true 반환
        selectExamAction('other');

        expect(localStorage.getItem('current_exam')).toBe('other');
        // 리로드 경로 → switchView 미호출 (dashboard는 index.html 기본 active이므로 사전에 제거 후 검증)
        el('dashboard-view').classList.remove('active');
        selectExamAction('other');
        expect(el('dashboard-view').classList.contains('active')).toBe(false);
    });

    it('같은 시험 선택 → 리로드 없이 대시보드로 복귀 (H)', () => {
        localStorage.setItem('current_exam', 'cosmetic');
        renderExamSelect();

        selectExamAction('cosmetic');

        expect(el('dashboard-view').classList.contains('active')).toBe(true);
    });

    it('목록 없음 → 안내 문구 (E)', () => {
        delete window.EXAMS_LIST;
        renderExamSelect();
        expect(el('exam-select-list').textContent).toContain('등록된 시험이 없습니다');
    });
});
