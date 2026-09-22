// tests/dom/formula-nav.dom.test.js — Formula OS 패널 전환·서브내비 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §4
// 검증: 허브→서브패널 전환(is-hidden), 서브내비 칩 6개·활성 상태, 나가기 복귀

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
}));

import { loadIndexHtml, el, isVisible } from './helpers.js';
import { initFormulaView, exitFormulaSubView } from '../../src/views/formula.js';
import { openCustomerPanel } from '../../src/views/formula-customer.js';
import { openMaterialPanel } from '../../src/views/formula-material.js';
import { openCompliancePanel } from '../../src/views/formula-compliance.js';

const ALL_PANELS = [
    'formula-menu-panel', 'formula-list-panel', 'formula-calc-panel',
    'formula-batch-panel', 'formula-batch-form-panel', 'formula-batch-detail-panel',
    'formula-customer-panel', 'formula-customer-form-panel', 'formula-customer-detail-panel',
    'formula-material-panel', 'formula-material-form-panel',
    'formula-compliance-panel',
];

function onlyVisible(panelId) {
    ALL_PANELS.forEach(p => {
        expect(isVisible(p), `${p} visibility`).toBe(p === panelId);
    });
}

describe('Formula OS — 패널 전환·서브내비', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
    });

    it('initFormulaView — 허브만 표시 + 저장 배지 갱신', () => {
        initFormulaView();
        onlyVisible('formula-menu-panel');
        expect(el('formula-usage-badge').textContent).toContain('/5');
    });

    it('openCustomerPanel — 고객 패널 표시 + 서브내비 6칩·고객 활성', () => {
        openCustomerPanel();
        onlyVisible('formula-customer-panel');
        const chips = el('formula-customer-subnav').querySelectorAll('.formula-subnav-chip');
        expect(chips.length).toBe(6);
        const active = el('formula-customer-subnav').querySelector('.is-active');
        expect(active.textContent).toBe('고객 관리');
        // 모든 칩이 실제 핸들러명을 data-click으로 가짐
        chips.forEach(chip => expect(chip.dataset.click).toBeTruthy());
    });

    it('openMaterialPanel — 원료 장부 패널 + 활성 칩', () => {
        openMaterialPanel();
        onlyVisible('formula-material-panel');
        const active = el('formula-material-subnav').querySelector('.is-active');
        expect(active.textContent).toBe('원료 장부');
    });

    it('openCompliancePanel — 법규 준수 패널 + 활성 칩', () => {
        openCompliancePanel();
        onlyVisible('formula-compliance-panel');
        const active = el('formula-compliance-subnav').querySelector('.is-active');
        expect(active.textContent).toBe('법규 준수');
    });

    it('exitFormulaSubView — 허브로 복귀', () => {
        openCustomerPanel();
        exitFormulaSubView();
        onlyVisible('formula-menu-panel');
    });
});
