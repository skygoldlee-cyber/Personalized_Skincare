// tests/dom/formula-customer.dom.test.js — 고객 관리 CRUD + CSV 가져오기 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §4
// 검증: 빈 상태→등록→목록, CSV UTF-8/EUC-KR 디코딩, 중복 건너뜀, confirm 거부,
//       헤더 불일치 오류,보내기·양식 다운로드 트리거

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
    openCustomerPanel, custNew, custSave,
    custImportCsv, custExportCsv, custCsvTemplate,
} from '../../src/views/formula-customer.js';
import { listCustomers, createCustomer } from '../../src/customer-store.js';

function csvFile(text, name = 'customers.csv') {
    return new File([text], name, { type: 'text/csv' });
}

describe('고객 관리 — CRUD + CSV 시나리오', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        vi.mocked(showToast).mockClear();
        vi.mocked(showConfirm).mockClear();
    });

    it('빈 상태 → 등록 폼 → 저장 → 상세·목록 반영', () => {
        openCustomerPanel();
        expect(el('customer-list').innerHTML).toContain('등록된 고객이 없습니다');

        custNew();
        expect(isVisible('formula-customer-form-panel')).toBe(true);
        el('cust-name').value = '김OO';
        custSave();

        expect(isVisible('formula-customer-detail-panel')).toBe(true);
        expect(el('customer-detail').innerHTML).toContain('김OO');
        expect(listCustomers().length).toBe(1);

        openCustomerPanel();
        expect(el('customer-list').innerHTML).toContain('김OO');
        expect(el('customer-list-usage').textContent).toBe('1/20 등록');
    });

    it('CSV 가져오기 — UTF-8 2행 → confirm 후 추가 + 요약 토스트', async () => {
        custImportCsv(); // file input에 change 리스너 바인딩
        selectFile('customer-file-input', csvFile('이름,나이,피부타입\n김OO,30,건성\n이OO,25,지성'));
        await flushAsync();

        expect(vi.mocked(showConfirm)).toHaveBeenCalledTimes(1);
        expect(listCustomers().length).toBe(2);
        expect(lastToast()[0]).toContain('2건 추가');
        expect(lastToast()[1]).toBe('success');
        expect(el('customer-list').innerHTML).toContain('이OO');
    });

    it('CSV 가져오기 — EUC-KR(CP949) 파일 한글 디코딩', async () => {
        custImportCsv();
        // '이름\n가' in EUC-KR: 이=C0CC 름=B8A7, 가=B0A1
        const bytes = new Uint8Array([0xC0, 0xCC, 0xB8, 0xA7, 0x0A, 0xB0, 0xA1]);
        selectFile('customer-file-input', new File([bytes], 'euckr.csv'));
        await flushAsync();

        expect(listCustomers().length).toBe(1);
        expect(listCustomers()[0].name).toBe('가');
    });

    it('CSV 가져오기 — 중복 이름 건너뜀 집계', async () => {
        createCustomer({ name: '김OO' });
        custImportCsv();
        selectFile('customer-file-input', csvFile('이름\n김OO\n박OO'));
        await flushAsync();

        expect(listCustomers().length).toBe(2);
        expect(lastToast()[0]).toContain('1건 추가');
        expect(lastToast()[0]).toContain('중복 1건 건너뜀');
    });

    it('CSV 가져오기 — 매핑 불가 헤더 → 오류 토스트, 저장 없음', async () => {
        custImportCsv();
        selectFile('customer-file-input', csvFile('foo,bar\n1,2'));
        await flushAsync();

        expect(listCustomers().length).toBe(0);
        expect(vi.mocked(showConfirm)).not.toHaveBeenCalled();
        expect(lastToast()[1]).toBe('error');
    });

    it('CSV 가져오기 — confirm 거부 시 저장 없음', async () => {
        vi.mocked(showConfirm).mockResolvedValueOnce(false);
        custImportCsv();
        selectFile('customer-file-input', csvFile('이름\n김OO'));
        await flushAsync();

        expect(listCustomers().length).toBe(0);
    });

    it('CSV보내기 — 다운로드 트리거 + 건수 토스트', () => {
        createCustomer({ name: '김OO' });
        const dl = spyAnchorDownload();
        custExportCsv();
        dl.restore();

        expect(dl.clicks.length).toBe(1);
        expect(dl.clicks[0].download).toMatch(/^customers_.*\.csv$/);
        expect(lastToast()[0]).toContain('1명');
    });

    it('CSV보내기 — 목록이 비면 info 토스트, 다운로드 없음', () => {
        const dl = spyAnchorDownload();
        custExportCsv();
        dl.restore();

        expect(dl.clicks.length).toBe(0);
        expect(lastToast()[1]).toBe('info');
    });

    it('양식 다운로드 — 표준 헤더 CSV 트리거', () => {
        const dl = spyAnchorDownload();
        custCsvTemplate();
        dl.restore();

        expect(dl.clicks.length).toBe(1);
        expect(dl.clicks[0].download).toBe('customers_template.csv');
    });
});
