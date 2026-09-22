// tests/dom/formula-calc.dom.test.js — 배합 계산기 + 포뮬러 목록 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.1 (Phase 2a)
// 검증: 배합률→투입량 계산, 합계 100% 판정, 한도 초과/금지/미등록 배지,
//       고객 카드 불러오기, 저장→목록 반영, 삭제 confirm, JSON보내기/가져오기,
//       안정성 기록→카드 배지·전성분

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
}));

import { showToast, showConfirm } from '../../src/ui-utils.js';
import {
    loadIndexHtml, el, isVisible, selectFile, flushAsync, lastToast, spyAnchorDownload,
} from './helpers.js';
import {
    formulaNew, openFormulaCalc, openFormulaList, formulaCalcAddRow,
    formulaCalcSave, formulaDelete, formulaCustLoad,
    formulaExportJson, formulaImportJson,
} from '../../src/views/formula.js';
import { listFormulas, createFormula, serializeFormula } from '../../src/formula-store.js';
import { createCustomer, listCustomers } from '../../src/customer-store.js';

// 원료 DB 스텁 — getIndex()가 모듈 싱글턴으로 1회 구축되므로 컨트롤러 호출 전 주입
const INGREDIENTS_STUB = [
    { name: '정제수', engName: 'Water', type: 'approved', category: '용제', description: '', limit: '' },
    { name: '글리세린', engName: 'Glycerin', type: 'approved', category: '보습제', description: '', limit: '' },
    { name: '살리실산', engName: 'Salicylic Acid', type: 'restricted', category: '기타', description: '', limit: '2.0%' },
    { name: '납', engName: 'Lead', type: 'banned', category: '중금속', description: '', limit: '사용 금지' },
];

function rowEl(i) {
    return el('formula-calc-rows').querySelectorAll('.f-row')[i];
}

/** 행의 원료명·배합률을 입력 이벤트로 세팅 (리스너가 calc.rows에 반영) */
function setRow(i, name, conc) {
    const row = rowEl(i);
    if (name != null) {
        const n = row.querySelector('.f-name');
        n.value = name;
        n.dispatchEvent(new Event('input'));
    }
    if (conc != null) {
        const c = row.querySelector('.f-conc');
        c.value = String(conc);
        c.dispatchEvent(new Event('input'));
    }
}

describe('배합 계산기 — 입력·검증·저장 시나리오', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        vi.mocked(showToast).mockClear();
        vi.mocked(showConfirm).mockClear();
        vi.mocked(showConfirm).mockResolvedValue(true);
    });

    it('원료명+배합률 입력 → 투입량 자동 계산·합계 표시·빈 상태 해제', () => {
        formulaNew();
        expect(isVisible('formula-calc-panel')).toBe(true);
        expect(el('formula-empty-state').classList.contains('is-hidden')).toBe(false);

        el('formula-target-volume').value = '200';
        el('formula-target-volume').dispatchEvent(new Event('input'));
        setRow(0, '글리세린', 5);

        expect(rowEl(0).querySelector('.f-amount').textContent).toBe('= 10.00g');
        expect(el('formula-sum-conc').textContent).toBe('5%');
        expect(el('formula-empty-state').classList.contains('is-hidden')).toBe(true);
    });

    it('합계 100% 판정 — 부족(경고)·정상·초과(금지) 배지', () => {
        formulaNew();
        formulaCalcAddRow();
        setRow(0, '정제수', 90);
        setRow(1, '글리세린', 5);

        const status = el('formula-sum-status');
        expect(status.textContent).toBe('5.00% 부족');
        expect(status.className).toContain('f-check-warn');

        setRow(1, '글리세린', 10);
        expect(status.textContent).toBe('100% 정상');
        expect(status.className).toContain('f-check-ok');

        setRow(0, '정제수', 105);
        expect(status.textContent).toBe('15.00% 초과');
        expect(status.className).toContain('f-check-banned');
    });

    it('한도 초과·금지·미등록 원료 → 행 배지 + 상단 검증 요약', () => {
        formulaNew();
        formulaCalcAddRow();
        formulaCalcAddRow();
        setRow(0, '살리실산', 5);      // 한도 2% 초과
        setRow(1, '납', 0.1);           // 사용 금지
        setRow(2, '미등록원료', 1);      // DB 미등록

        const cells = el('formula-calc-rows').querySelectorAll('.f-check-cell');
        expect(cells[0].textContent).toContain('한도 초과');
        expect(cells[1].textContent).toContain('금지 원료');
        expect(cells[2].textContent).toContain('DB 미등록');

        const summary = el('formula-check-summary');
        expect(summary.textContent).toContain('금지 1');
        expect(summary.textContent).toContain('초과 1');
        expect(summary.textContent).toContain('확인 1');
    });

    it('고객 카드 불러오기 → 고객 필드 반영 + 토스트', () => {
        const { customer } = createCustomer({ name: '김OO', skinType: '건성', concerns: ['건조'], pregnancy: '임신 중' });
        formulaNew();

        el('formula-cust-ref').value = customer.id;
        formulaCustLoad();

        expect(el('formula-cust-name').value).toBe('김OO');
        expect(el('formula-cust-skintype').value).toBe('건성');
        expect(el('formula-cust-pregnancy').value).toBe('임신 중');
        expect(el('formula-cust-id').value).toBe(customer.id);
        expect(el('formula-cust-concerns').querySelector('input[value="건조"]').checked).toBe(true);
        expect(lastToast()[0]).toContain('김OO');
        expect(lastToast()[1]).toBe('success');
    });

    it('포뮬러 저장 → 목록 카드·검증 배지 반영', () => {
        formulaNew();
        formulaCalcAddRow();
        el('formula-name-input').value = '테스트 세럼';
        setRow(0, '정제수', 90);
        setRow(1, '글리세린', 10);

        formulaCalcSave();

        expect(listFormulas().length).toBe(1);
        expect(lastToast()[0]).toContain('테스트 세럼');
        expect(lastToast()[1]).toBe('success');

        openFormulaList();
        const list = el('formula-list').innerHTML;
        expect(list).toContain('테스트 세럼');
        expect(list).toContain('원료 2종');
        expect(list).toContain('정상 2');
    });

    it('안정성 양호 기록 → 저장 시 recordedAt 자동 부여 + 카드 배지·전성분', () => {
        formulaNew();
        el('formula-name-input').value = '확인 포뮬러';
        setRow(0, '정제수', 95);
        formulaCalcAddRow();
        setRow(1, '글리세린', 5);
        el('formula-stab-method').value = '실온 경시 관찰';
        el('formula-stab-result').value = '양호';

        formulaCalcSave();

        const f = listFormulas()[0];
        expect(f.stability.result).toBe('양호');
        expect(f.stability.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(f.fullIngredients).toEqual(['정제수', '글리세린']);

        openFormulaList();
        const list = el('formula-list').innerHTML;
        expect(list).toContain('안정성 확인');
        expect(list).toContain('전성분');
    });

    it('빈 목록 → 빈 상태 안내 + 저장 배지', () => {
        openFormulaList();
        expect(el('formula-list').innerHTML).toContain('저장된 포뮬러가 없습니다');
        expect(el('formula-list-usage').textContent).toBe('0/5 저장됨');
    });

    it('삭제 — confirm 거부 시 유지, 승인 시 제거', async () => {
        const { formula } = createFormula({ name: '삭제 대상', ingredients: [{ name: '정제수', concentration: 100 }] });
        openFormulaList();

        vi.mocked(showConfirm).mockResolvedValueOnce(false);
        await formulaDelete(formula.id);
        expect(listFormulas().length).toBe(1);

        await formulaDelete(formula.id);
        expect(listFormulas().length).toBe(0);
        expect(lastToast()[1]).toBe('success');
    });

    it('JSON보내기 — 다운로드 트리거, 빈 드래프트는 info 토스트', () => {
        const dl = spyAnchorDownload();
        formulaNew();
        formulaExportJson(); // 원료 없음 → info
        expect(dl.clicks.length).toBe(0);
        expect(lastToast()[1]).toBe('info');

        setRow(0, '정제수', 100);
        formulaExportJson();
        expect(dl.clicks.length).toBe(1);
        expect(dl.clicks[0].download).toMatch(/^formula_.*\.json$/);
        dl.restore();
    });

    it('JSON가져오기 — 파일 선택 → 저장·목록 반영', async () => {
        const json = serializeFormula({ name: '가져온 포뮬러', ingredients: [{ name: '정제수', concentration: 100 }] });
        formulaImportJson(); // change 리스너 바인딩 + click()
        selectFile('formula-file-input', new File([json], 'f.json'));
        await flushAsync();

        expect(listFormulas().length).toBe(1);
        expect(listFormulas()[0].name).toBe('가져온 포뮬러');
        expect(lastToast()[0]).toContain('가져온 포뮬러');
        expect(el('formula-list').innerHTML).toContain('가져온 포뮬러');
    });
});
