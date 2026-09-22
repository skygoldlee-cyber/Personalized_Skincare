// tests/dom/formula-compliance.dom.test.js — 법규 준수 체크리스트 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §4
// 검증: 25항목 렌더·진행 배지, 체크 토글→localStorage 영속·재렌더 checked 유지,
//       초기화(confirm), 법령 링크→ExamViewer 연동

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
}));

import { showToast, showConfirm } from '../../src/ui-utils.js';
import { loadIndexHtml, el, isVisible, flushAsync, lastToast } from './helpers.js';
import { scopedKey } from '../../src/exam-context.js';
import {
    openCompliancePanel, compToggle, compReset, compOpenLaw,
    COMPLIANCE_SECTIONS,
} from '../../src/views/formula-compliance.js';

const FIRST_ID = COMPLIANCE_SECTIONS[0].items[0].id;
const TOTAL = COMPLIANCE_SECTIONS.reduce((n, s) => n + s.items.length, 0);

describe('법규 준수 체크리스트 — 렌더·영속 시나리오', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        vi.mocked(showToast).mockClear();
        vi.mocked(showConfirm).mockClear();
    });

    it('패널 렌더 — 6개 섹션·전체 항목·진행 배지 0/N', () => {
        openCompliancePanel();
        expect(isVisible('formula-compliance-panel')).toBe(true);
        expect(el('comp-list').querySelectorAll('.comp-section').length).toBe(6);
        expect(el('comp-list').querySelectorAll('.comp-check').length).toBe(TOTAL);
        expect(el('comp-progress-badge').textContent).toBe(`점검 0/${TOTAL}`);
    });

    it('compToggle — localStorage 영속 + checked 유지 + 배지 갱신', () => {
        openCompliancePanel();
        compToggle(FIRST_ID);

        // 스토리지 영속 (시험 네임스페이스 키)
        const raw = localStorage.getItem(scopedKey('formula_compliance'));
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw).checked[FIRST_ID]).toBeTruthy();

        // 재렌더 후 체크박스 checked + 배지 1/N
        const box = el('comp-list').querySelector(`[data-arg="${FIRST_ID}"]`);
        expect(box.checked).toBe(true);
        expect(el('comp-progress-badge').textContent).toBe(`점검 1/${TOTAL}`);
    });

    it('compToggle 재토글 — 해제로 복귀', () => {
        openCompliancePanel();
        compToggle(FIRST_ID);
        compToggle(FIRST_ID);
        expect(el('comp-progress-badge').textContent).toBe(`점검 0/${TOTAL}`);
        const raw = localStorage.getItem(scopedKey('formula_compliance'));
        expect(JSON.parse(raw).checked[FIRST_ID]).toBeUndefined();
    });

    it('compToggle — 미등록 id는 무동작', () => {
        openCompliancePanel();
        compToggle('nonexistent-item');
        expect(localStorage.getItem(scopedKey('formula_compliance'))).toBeNull();
    });

    it('compReset — confirm 승인 시 전체 해제', async () => {
        openCompliancePanel();
        compToggle(FIRST_ID);
        compReset();
        await flushAsync();

        expect(vi.mocked(showConfirm)).toHaveBeenCalledTimes(1);
        expect(el('comp-progress-badge').textContent).toBe(`점검 0/${TOTAL}`);
        expect(lastToast()[0]).toContain('초기화');
    });

    it('compReset — confirm 거부 시 유지', async () => {
        vi.mocked(showConfirm).mockResolvedValueOnce(false);
        openCompliancePanel();
        compToggle(FIRST_ID);
        compReset();
        await flushAsync();

        expect(el('comp-progress-badge').textContent).toBe(`점검 1/${TOTAL}`);
    });

    it('compOpenLaw — ExamViewer에 ref_md 경로 전달', () => {
        window.ExamViewer = { openExam: vi.fn() };
        openCompliancePanel();
        compOpenLaw('law');
        expect(window.ExamViewer.openExam).toHaveBeenCalledTimes(1);
        expect(vi.mocked(window.ExamViewer.openExam).mock.calls[0][0]).toContain('참조자료');
        delete window.ExamViewer;
    });

    it('compOpenLaw — ExamViewer 없으면 안내 토스트', () => {
        delete window.ExamViewer;
        openCompliancePanel();
        compOpenLaw('law');
        expect(lastToast()[0]).toContain('문서 뷰어');
    });
});
