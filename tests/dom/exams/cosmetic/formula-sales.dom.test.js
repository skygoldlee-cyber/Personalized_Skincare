// tests/dom/exams/cosmetic/formula-sales.dom.test.js — 사업 유형·표시사항·광고 점검
// @spec FO-33,FO-34,FO-35,FO-36
// 검증: 사업 유형 칩 렌더·전환 영속, 허브 카드·서브내비 유형별 게이트,
//       체크리스트 세트 라벨·항목·체크 상태 분리,
//       표시사항 폼 체크·전성분 가져오기·인쇄, 광고 린트 실행·지우기.

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
}));

import { loadIndexHtml, el, isVisible, lastToast } from '../../helpers.js';
import {
    initFormulaView, formulaSetBizType, formulaSubNav,
} from '../../../../src/exams/cosmetic/views/formula.js';
import {
    openLabelPanel, labelFormulaImport, labelPrintSheet,
    openAdLintPanel, adlintRun, adlintClear,
} from '../../../../src/exams/cosmetic/views/formula-sales.js';
import { openCompliancePanel, compToggle } from '../../../../src/exams/cosmetic/views/formula-compliance.js';
import { setBizType } from '../../../../src/exams/cosmetic/biz-profile.js';
import { createFormula } from '../../../../src/exams/cosmetic/formula-store.js';
import { getJSON } from '../../../../src/storage.js';
import { STORAGE_KEYS } from '../../../../src/storage-keys.js';

const INGREDIENTS_STUB = [
    { name: '정제수', engName: 'Water', type: 'approved', category: '용제', limit: '' },
];

function hubCards() {
    return [...document.querySelectorAll('#formula-menu-panel .trainer-menu-card')]
        .filter(c => !c.classList.contains('is-hidden'));
}

describe('Formula OS — 사업 유형 프로파일 (FO-33)', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        vi.clearAllMocks();
    });

    it('허브에 유형 칩 3개 렌더 — 기본 유형은 맞춤형조제 활성', () => {
        initFormulaView();
        const chips = document.querySelectorAll('#formula-biz-bar .formula-biz-chip');
        expect(chips.length).toBe(3);
        expect(document.querySelector('#formula-biz-bar .formula-biz-chip.is-active').dataset.arg).toBe('custom');
        // 맞춤형: 기존 6카드 (표시사항·광고 카드는 숨김)
        expect(hubCards().length).toBe(6);
    });

    it('책임판매업 전환 — 제조 기능 숨기고 표시사항·광고 카드 노출·영속', () => {
        initFormulaView();
        formulaSetBizType('sales');
        expect(getJSON(STORAGE_KEYS.FORMULA_BIZ_TYPE)).toBe('sales');

        const visible = hubCards().map(c => c.dataset.click);
        expect(visible).not.toContain('formulaNew');      // 배합 계산기 숨김
        expect(visible).not.toContain('openBatchPanel');   // 조제 기록 숨김
        expect(visible).not.toContain('openMaterialPanel');// 원료 장부 숨김
        expect(visible).toContain('openLabelPanel');       // 표시사항 노출
        expect(visible).toContain('openAdLintPanel');      // 광고 점검 노출
        expect(visible).toContain('openCompliancePanel');  // 법규 준수는 공용
    });

    it('제조업 전환 — 고객 카드만 숨기고 생산·표시 기능 노출', () => {
        formulaSetBizType('mfg');
        initFormulaView();
        const visible = hubCards().map(c => c.dataset.click);
        expect(visible).not.toContain('openCustomerPanel');
        expect(visible).toContain('formulaNew');
        expect(visible).toContain('openBatchPanel');
        expect(visible).toContain('openLabelPanel');
        expect(visible).toContain('openAdLintPanel');
    });

    it('서브내비도 유형별 게이트 — sales는 표시사항·광고 칩, 제조 칩 없음 (FO-33)', () => {
        setBizType('sales');
        const nav = formulaSubNav('label');
        expect(nav).toContain('openLabelPanel');
        expect(nav).toContain('openAdLintPanel');
        expect(nav).not.toContain('openBatchPanel');
        expect(nav).not.toContain('formulaNew');
        setBizType('custom');
        const nav2 = formulaSubNav('calc');
        expect(nav2).toContain('openBatchPanel');
        expect(nav2).not.toContain('openLabelPanel');
    });
});

describe('Formula OS — 체크리스트 세트 (FO-34)', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        vi.clearAllMocks();
    });

    it('유형별 세트 라벨·항목 — sales는 표시·광고 세트로 렌더', () => {
        setBizType('sales');
        openCompliancePanel();
        expect(el('comp-set-label').textContent).toContain('책임판매업');
        expect(el('comp-list').textContent).toContain('의약품 오인 표현 금지');
        expect(el('comp-list').textContent).not.toContain('맞춤형화장품판매업 신고');
    });

    it('체크 상태는 세트별 분리 — custom 체크가 sales에 섞이지 않음', () => {
        setBizType('custom');
        openCompliancePanel();
        compToggle('lic-report');
        expect(getJSON(STORAGE_KEYS.COMPLIANCE_CHECKS).checked['lic-report']).toBeTruthy();

        setBizType('sales');
        openCompliancePanel();
        expect(el('comp-progress-badge').textContent).toContain('점검 0/');
        compToggle('sales-reg');
        expect(getJSON(STORAGE_KEYS.COMPLIANCE_CHECKS_SALES).checked['sales-reg']).toBeTruthy();
        // custom 키는 오염 없음
        expect(getJSON(STORAGE_KEYS.COMPLIANCE_CHECKS).checked['sales-reg']).toBeUndefined();
    });
});

describe('Formula OS — 표시사항 검토 (FO-35)', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        vi.clearAllMocks();
        setBizType('sales');
    });

    it('패널 오픈 — 제10조 필드·필수 미기재 경고·드래프트 복원', () => {
        openLabelPanel();
        expect(isVisible('formula-label-panel')).toBe(true);
        expect(el('label-check-result').textContent).toContain('필수');
        // 필수 필드 채우면 체크 갱신 (input 이벤트 경유)
        el('label-product').value = '수분 세럼';
        el('label-product').dispatchEvent(new Event('input', { bubbles: true }));
        expect(el('label-check-result').textContent).toContain('제품명');
        // 드래프트 저장 → 재오픈 복원
        expect(getJSON(STORAGE_KEYS.FORMULA_LABEL_DRAFT)['label-product']).toBe('수분 세럼');
        openLabelPanel();
        expect(el('label-product').value).toBe('수분 세럼');
    });

    it('My 포뮬러 전성분 가져오기 — 안정성 양호 포뮬러의 전성분 삽입', () => {
        const r = createFormula({
            name: '세럼A',
            ingredients: [{ name: '정제수', concentration: 90 }, { name: '글리세린', concentration: 10 }],
            stability: { result: '양호' },
        });
        expect(r.ok).toBe(true);
        openLabelPanel();
        const sel = el('label-formula-select');
        expect(sel.options.length).toBe(2); // 안내 + 포뮬러 1
        sel.value = r.formula.id;
        labelFormulaImport();
        expect(el('label-ingredients').value).toBe('정제수, 글리세린');
        expect(lastToast()[0]).toContain('전성분');
    });

    it('라벨 시트 인쇄 — 기재 항목만 표로 출력', () => {
        const spy = vi.fn();
        window.print = spy;
        openLabelPanel();
        el('label-product').value = '수분 세럼';
        el('label-product').dispatchEvent(new Event('input', { bubbles: true }));
        labelPrintSheet();
        expect(spy).toHaveBeenCalled();
        expect(el('formula-print-area').innerHTML).toContain('수분 세럼');
        expect(el('formula-print-area').innerHTML).toContain('화장품법 제10조');
    });
});

describe('Formula OS — 광고 문구 점검 (FO-36)', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        vi.clearAllMocks();
        setBizType('sales');
    });

    it('금지 표현 하이라이트 + 분류 배지 + 수정 가이드', () => {
        openAdLintPanel();
        expect(isVisible('formula-adlint-panel')).toBe(true);
        el('adlint-input').value = '아토피를 치료하는 부작용 없는 크림';
        adlintRun();

        const box = el('adlint-result');
        expect(box.querySelector('.adlint-summary').textContent).toContain('의약품 오인');
        expect(box.querySelector('.adlint-summary').textContent).toContain('과대');
        expect(box.querySelector('.adlint-mark').textContent).toBe('아토피');
        expect(box.querySelector('.adlint-list').textContent).toContain('민감성');
    });

    it('깨끗한 문구 — 적합 안내, 지우기로 초기화', () => {
        openAdLintPanel();
        el('adlint-input').value = '촉촉한 보습으로 피부를 진정시켜 줍니다.';
        adlintRun();
        expect(el('adlint-result').textContent).toContain('발견되지 않았습니다');

        el('adlint-input').value = '치료 크림';
        adlintClear();
        expect(el('adlint-input').value).toBe('');
        expect(el('adlint-result').innerHTML).toBe('');
    });
});
