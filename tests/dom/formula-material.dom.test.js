// tests/dom/formula-material.dom.test.js — 원료 장부 CRUD·기한 배지 + CSV 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §4
// 검증: 빈 상태→등록→목록, 기한 4상태 배지·경고 배너, CSV 가져오기(이름+LOT 중복)

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
    openMaterialPanel, matNew, matSave,
    matImportCsv, matExportCsv, matCsvTemplate,
} from '../../src/views/formula-material.js';
import { listMaterials, createMaterial } from '../../src/material-ledger.js';

/** 오늘 + offset일을 YYYY-MM-DD로 */
function dstr(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function csvFile(text) {
    return new File([text], 'materials.csv', { type: 'text/csv' });
}

describe('원료 장부 — CRUD·기한 배지 + CSV 시나리오', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        vi.mocked(showToast).mockClear();
        vi.mocked(showConfirm).mockClear();
    });

    it('빈 상태 → 등록 폼 → 저장 → 목록 반영', () => {
        openMaterialPanel();
        expect(el('material-list').innerHTML).toContain('등록된 원료가 없습니다');

        matNew();
        expect(isVisible('formula-material-form-panel')).toBe(true);
        el('mat-name').value = '글리세린';
        el('mat-expiry').value = dstr(90);
        matSave();

        expect(isVisible('formula-material-panel')).toBe(true);
        expect(el('material-list').innerHTML).toContain('글리세린');
        expect(el('material-list-usage').textContent).toBe('1/30 등록');
    });

    it('기한 상태 4종 배지 — 경과/임박/정상/미기재 + 경고 배너', () => {
        createMaterial({ name: '만료원료', expiryAt: dstr(-1) });
        createMaterial({ name: '임박원료', expiryAt: dstr(10) });
        createMaterial({ name: '정상원료', expiryAt: dstr(90) });
        createMaterial({ name: '무기한원료' });
        openMaterialPanel();

        const html = el('material-list').innerHTML;
        expect(html).toContain('기한 경과');
        expect(html).toContain('기한 임박');
        expect(html).toContain('정상');
        expect(html).toContain('기한 미기재');

        // 경고 배너 — 임박·경과 2종 집계
        expect(el('material-expiry-alert').classList.contains('is-hidden')).toBe(false);
        expect(el('material-expiry-alert').textContent).toContain('2종');
    });

    it('경고 대상 없으면 배너 숨김', () => {
        createMaterial({ name: '정상원료', expiryAt: dstr(90) });
        openMaterialPanel();
        expect(el('material-expiry-alert').classList.contains('is-hidden')).toBe(true);
    });

    it('CSV 가져오기 — 날짜 정규화 + 이름+LOT 중복 건너뜀', async () => {
        createMaterial({ name: '글리세린', lot: 'L01' });
        matImportCsv();
        selectFile('material-file-input', csvFile(
            '원료명,LOT,사용기한,잔량\n글리세린,L01,2026.12.31,500\n글리세린,L02,2026/6/30,300\n히알루론산,,2027-01-15,50'));
        await flushAsync();

        const list = listMaterials();
        expect(list.length).toBe(3); // L01 중복 스킵, L02·히알루론산 추가
        const l02 = list.find(m => m.lot === 'L02');
        expect(l02.expiryAt).toBe('2026-06-30'); // YYYY/M/D → ISO 정규화
        expect(l02.qty).toBe(300);
        expect(lastToast()[0]).toContain('2건 추가');
        expect(lastToast()[0]).toContain('중복 1건 건너뜀');
    });

    it('CSV보내기·양식 — 다운로드 트리거', () => {
        createMaterial({ name: '글리세린' });
        const dl = spyAnchorDownload();
        matExportCsv();
        matCsvTemplate();
        dl.restore();

        expect(dl.clicks.length).toBe(2);
        expect(dl.clicks[0].download).toMatch(/^materials_.*\.csv$/);
        expect(dl.clicks[1].download).toBe('materials_template.csv');
    });
});
