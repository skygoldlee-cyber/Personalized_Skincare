// tests/dom/formula-batch.dom.test.js — 조제 기록(배치) 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.1 (Phase 2b)
// 검증: 빈 목록, 신규 폼 처방 바인딩·QC 렌더, 저장→채번·스냅샷·상세 전환,
//       순번 증가, 처방 미선택 거부, 보정 모드 identity 잠금·QC 병합,
//       삭제 confirm, QC 이상 목록 배지, 인쇄 → print-area

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
}));

import { showToast, showConfirm } from '../../src/ui-utils.js';
import { loadIndexHtml, el, isVisible, lastToast, spyAnchorDownload } from './helpers.js';
import {
    openBatchPanel, batchNew, batchEdit, batchSave, batchOpen,
    batchDelete, batchPrintRecord, batchPrintLabel,
    batchExportCsv, batchFilterReset, suggestExpiryDays,
} from '../../src/views/formula-batch.js';
import { createFormula } from '../../src/formula-store.js';
import { createCustomer } from '../../src/customer-store.js';
import { listBatches, getBatch, createBatch, QC_FIELDS, HYGIENE_FIELDS } from '../../src/batch-store.js';
import { createMaterial } from '../../src/material-ledger.js';
import { DataLoader } from '../../src/data-loader.js';

const INGREDIENTS_STUB = [
    { name: '정제수', engName: 'Water', type: 'approved', category: '용제', description: '', limit: '' },
    { name: '글리세린', engName: 'Glycerin', type: 'approved', category: '보습제', description: '', limit: '' },
    { name: '살리실산', engName: 'Salicylic Acid', type: 'restricted', category: '기타', description: '', limit: '2.0%' },
];

function seedFormula(extra = {}) {
    return createFormula({
        name: '수분 세럼',
        targetVolume: 100,
        unit: 'ml',
        customer: { name: '김OO' },
        ingredients: [
            { name: '정제수', concentration: 95 },
            { name: '글리세린', concentration: 5 },
        ],
        ...extra,
    }).formula;
}

function checkQc(key, value) {
    const r = document.querySelector(`input[name="batch-qc-${key}"][value="${value}"]`);
    r.checked = true;
}

describe('조제 기록 — 배치 시나리오', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        window.print = vi.fn();
        DataLoader.registry = { ingredients: { version: '2026-03' } };
        vi.mocked(showToast).mockClear();
        vi.mocked(showConfirm).mockClear();
        vi.mocked(showConfirm).mockResolvedValue(true);
    });

    it('빈 목록 → 안내 + 기록 배지', () => {
        openBatchPanel();
        expect(isVisible('formula-batch-panel')).toBe(true);
        expect(el('batch-list').innerHTML).toContain('조제 기록이 없습니다');
        expect(el('batch-list-usage').textContent).toBe('기록 0/50');
    });

    it('신규 폼 — 처방 바인딩·기본값 채움·QC·위생 필드 렌더', () => {
        const f = seedFormula();
        batchNew(f.id);

        expect(isVisible('formula-batch-form-panel')).toBe(true);
        expect(el('batch-form-title').textContent).toBe('조제 기록 — 신규');
        expect(el('batch-formula').value).toBe(f.id);
        // applyFormulaDefaults — 처방의 총량·단위·고객명
        expect(el('batch-target-volume').value).toBe('100');
        expect(el('batch-unit').value).toBe('ml');
        expect(el('batch-customer-name').value).toBe('김OO');
        // QC 라디오 5항목×3값, 위생 체크박스 3개
        QC_FIELDS.forEach(q => {
            expect(document.querySelectorAll(`input[name="batch-qc-${q.key}"]`).length).toBe(3);
        });
        HYGIENE_FIELDS.forEach(h => {
            expect(el(`batch-hyg-${h.key}`)).toBeTruthy();
        });
    });

    it('고객 카드 선택 → 이름·customerId 자동 반영', () => {
        const { customer } = createCustomer({ name: '이OO', skinType: '지성' });
        const f = seedFormula();
        batchNew(f.id);

        const sel = el('batch-customer-select');
        sel.value = customer.id;
        sel.dispatchEvent(new Event('change'));

        expect(el('batch-customer-id').value).toBe(customer.id);
        expect(el('batch-customer-name').value).toBe('이OO');
    });

    it('저장 → 배치번호 채번·검증 스냅샷·상세 패널 전환', async () => {
        const f = seedFormula({ ingredients: [{ name: '살리실산', concentration: 5 }] });
        batchNew(f.id);
        checkQc('appearance', '정상');
        checkQc('scent', '정상');
        el('batch-hyg-toolsSterilized').checked = true;

        await batchSave();

        const b = listBatches()[0];
        expect(b.batchNo).toMatch(/^\d{8}-01$/);
        expect(b.formulaName).toBe('수분 세럼');
        expect(b.qc.appearance).toBe('정상');
        expect(b.hygiene.toolsSterilized).toBe(true);
        expect(b.hygiene.glovesWorn).toBe(false);
        // 규정 검증 스냅샷 — 살리실산 5% > 한도 2% → warn 1, DB 버전 기록
        expect(b.checkSnapshot.warn).toBe(1);
        expect(b.checkSnapshot.dbVersion).toBe('2026-03');
        expect(el('batch-detail').innerHTML).toContain('원료 DB v2026-03');
        expect(lastToast()[0]).toContain(b.batchNo);
        expect(lastToast()[1]).toBe('success');
        // 저장 후 상세 패널로 전환 — 스냅샷·QC 행 표시
        expect(isVisible('formula-batch-detail-panel')).toBe(true);
        expect(el('batch-detail').innerHTML).toContain(b.batchNo);
        expect(el('batch-detail').innerHTML).toContain('규정 검증 스냅샷');
        expect(el('batch-detail').innerHTML).toContain('초과 1');
    });

    it('같은 일자 두 번째 배치 → 순번 -02', async () => {
        const f = seedFormula();
        batchNew(f.id);
        await batchSave();
        batchNew(f.id);
        await batchSave();

        const nos = listBatches().map(b => b.batchNo).sort();
        expect(nos[0]).toMatch(/-01$/);
        expect(nos[1]).toMatch(/-02$/);
    });

    it('처방 미선택 저장 → 에러 토스트·미저장', async () => {
        batchNew();
        await batchSave();
        expect(listBatches().length).toBe(0);
        expect(lastToast()[0]).toContain('처방을 선택');
        expect(lastToast()[1]).toBe('error');
    });

    it('보정 모드 — 처방·조제일시 잠금 + QC 부분 병합·배치번호 불변', async () => {
        const { batch } = createBatch({
            formulaName: '수분 세럼', madeAt: '2026-09-20T10:00',
            qc: { appearance: '정상' }, hygiene: { glovesWorn: true },
        });
        batchEdit(batch.id);

        expect(el('batch-form-title').textContent).toContain('보정');
        expect(el('batch-formula').disabled).toBe(true);
        expect(el('batch-made-at').disabled).toBe(true);
        // 기존 값이 폼에 복원됨
        expect(document.querySelector('input[name="batch-qc-appearance"]:checked').value).toBe('정상');
        expect(el('batch-hyg-glovesWorn').checked).toBe(true);

        checkQc('scent', '이상');
        await batchSave();

        const b = getBatch(batch.id);
        expect(b.batchNo).toBe(batch.batchNo);          // identity 불변
        expect(b.madeAt).toBe('2026-09-20T10:00');
        expect(b.qc.appearance).toBe('정상');            // 기존 QC 유지
        expect(b.qc.scent).toBe('이상');                 // 부분 병합
        expect(lastToast()[0]).toContain('보정');
    });

    it('삭제 — confirm 거부 시 유지, 승인 시 제거·목록 갱신', async () => {
        const { batch } = createBatch({ formulaName: '세럼', madeAt: '2026-09-20T10:00' });
        openBatchPanel();

        vi.mocked(showConfirm).mockResolvedValueOnce(false);
        await batchDelete(batch.id);
        expect(listBatches().length).toBe(1);

        await batchDelete(batch.id);
        expect(listBatches().length).toBe(0);
        expect(lastToast()[1]).toBe('success');
        expect(el('batch-list').innerHTML).toContain('조제 기록이 없습니다');
    });

    it('QC 이상·위생 미완료 → 목록 카드 배지', () => {
        createBatch({
            formulaName: '세럼', madeAt: '2026-09-20T10:00',
            qc: { appearance: '정상', scent: '이상' },
            hygiene: { toolsSterilized: true, glovesWorn: true },
        });
        openBatchPanel();
        const list = el('batch-list').innerHTML;
        expect(list).toContain('QC 이상: 향');
        expect(list).toContain('위생 2/3');
    });

    it('실측 pH — 폼 입력 → 저장·상세 표시, 보정으로 갱신', async () => {
        const f = seedFormula();
        batchNew(f.id);
        el('batch-ph').value = '5.5';
        await batchSave();

        const b = listBatches()[0];
        expect(b.phMeasured).toBe(5.5);
        expect(el('batch-detail').innerHTML).toContain('실측 pH: 5.5');

        batchEdit(b.id);
        expect(el('batch-ph').value).toBe('5.5');
        el('batch-ph').value = '4.2';
        await batchSave();
        expect(getBatch(b.id).phMeasured).toBe(4.2);
    });

    it('고객 알레르기 × 처방 원료 충돌 → 저장 전 confirm 경고', async () => {
        const { customer } = createCustomer({ name: '박OO', allergies: ['글리세린'] });
        const f = seedFormula(); // 글리세린 5% 포함
        batchNew(f.id);
        el('batch-customer-select').value = customer.id;
        el('batch-customer-select').dispatchEvent(new Event('change'));

        // 실시간 경고 표시
        expect(el('batch-allergy-warn').classList.contains('is-hidden')).toBe(false);
        expect(el('batch-allergy-warn').textContent).toContain('글리세린');

        // confirm 거부 → 미저장
        vi.mocked(showConfirm).mockResolvedValueOnce(false);
        await batchSave();
        expect(listBatches().length).toBe(0);
        expect(vi.mocked(showConfirm).mock.calls[0][0]).toContain('글리세린');

        // confirm 승인 → 저장
        await batchSave();
        expect(listBatches().length).toBe(1);
    });

    it('알레르기 무관 고객 → 경고 없이 바로 저장', async () => {
        const { customer } = createCustomer({ name: '최OO', allergies: ['레티놀'] });
        const f = seedFormula();
        batchNew(f.id);
        el('batch-customer-select').value = customer.id;
        el('batch-customer-select').dispatchEvent(new Event('change'));

        expect(el('batch-allergy-warn').classList.contains('is-hidden')).toBe(true);
        await batchSave();
        expect(vi.mocked(showConfirm)).not.toHaveBeenCalled();
        expect(listBatches().length).toBe(1);
    });

    it('LOT 선택 — 장부 매칭 select 렌더 + 저장 스냅샷', async () => {
        createMaterial({ name: '글리세린', lot: 'L2401', expiryAt: '2027-01-01', qty: 500, unit: 'g' });
        createMaterial({ name: '글리세린', lot: 'L2506', expiryAt: '2028-01-01', qty: 300, unit: 'g' });
        const f = seedFormula();
        batchNew(f.id);

        const sel = document.querySelector('.batch-lot-select[data-name="글리세린"]');
        expect(sel).toBeTruthy();
        expect(sel.options.length).toBe(2);
        expect(sel.value).toBeTruthy(); // 기한 임박 순 첫 항목이 기본 선택

        await batchSave();
        const b = listBatches()[0];
        expect(b.materialLots.length).toBe(1);
        expect(b.materialLots[0].name).toBe('글리세린');
        expect(b.materialLots[0].lot).toBe('L2401'); // 임박 LOT가 기본값
        expect(el('batch-detail').innerHTML).toContain('L2401');
    });

    it('재고 부족 경고 — 소요량 > 잔량 합계 시 표시', async () => {
        // 글리세린 잔량 3g — 처방은 100ml × 5% = 5 필요
        createMaterial({ name: '글리세린', lot: 'L1', qty: 3, unit: 'ml' });
        const f = seedFormula(); // targetVolume 100ml, 글리세린 5%
        batchNew(f.id);

        const warn = el('batch-stock-warn');
        expect(warn.classList.contains('is-hidden')).toBe(false);
        expect(warn.textContent).toContain('글리세린');
        expect(warn.textContent).toContain('재고 부족');

        // 총량을 50으로 줄이면 필요 2.5 ≤ 잔량 3 → 경고 해제
        el('batch-target-volume').value = '50';
        el('batch-target-volume').dispatchEvent(new Event('input'));
        expect(el('batch-stock-warn').classList.contains('is-hidden')).toBe(true);
    });

    it('인도일 + QC 이상 조치 — 저장·목록 배지·상세·인쇄 반영', async () => {
        const f = seedFormula();
        batchNew(f.id);
        el('batch-delivered').value = '2026-09-25';
        checkQc('appearance', '이상');
        el('batch-disposition').value = '폐기';
        await batchSave();

        const b = listBatches()[0];
        expect(b.deliveredAt).toBe('2026-09-25');
        expect(b.disposition).toBe('폐기');
        const detail = el('batch-detail').innerHTML;
        expect(detail).toContain('인도일 2026-09-25');
        expect(detail).toContain('조치: 폐기');

        openBatchPanel();
        const list = el('batch-list').innerHTML;
        expect(list).toContain('인도 2026-09-25');
        expect(list).toContain('조치: 폐기');
    });

    it('QC 이상 + 조치 미기록 → 목록에 "조치 미기록" 배지', () => {
        createBatch({
            formulaName: '세럼', madeAt: '2026-09-20T10:00',
            qc: { appearance: '이상' },
        });
        openBatchPanel();
        expect(el('batch-list').innerHTML).toContain('조치 미기록');
    });

    it('인쇄 — 기록지·라벨 → print-area 렌더 + printing 클래스', () => {
        const { batch } = createBatch({
            formulaName: '세럼', madeAt: '2026-09-20T10:00',
            fullIngredients: ['정제수', '글리세린'],
            deliveredAt: '2026-09-21',
            materialLots: [{ name: '글리세린', materialId: 'mat_1', lot: 'L2401' }],
        });
        batchPrintRecord(batch.id);
        const html = el('formula-print-area').innerHTML;
        expect(html).toContain(batch.batchNo);
        expect(html).toContain('인도일');
        expect(html).toContain('L2401');
        expect(html).toContain('조제자(조제관리사)'); // 서명란
        expect(document.body.classList.contains('formula-printing')).toBe(true);
        expect(window.print).toHaveBeenCalledTimes(1);

        batchPrintLabel(batch.id);
        expect(el('formula-print-area').innerHTML).toContain('정제수');
        expect(window.print).toHaveBeenCalledTimes(2);
    });

    it('사용기한 자동 제안 — 보존제 180일 / 수상 무보존제 14일 / 무수 90일', () => {
        // 수상부 + 보존제 없음 → 14일
        const fWater = seedFormula();
        expect(suggestExpiryDays(fWater)).toBe(14);
        // 보존제 포함 → 180일
        const fPres = seedFormula({
            ingredients: [{ name: '페녹시에탄올', concentration: 1 }],
        });
        expect(suggestExpiryDays(fPres)).toBe(180);
        // 무수(정제수·수상부 없음) + 보존제 없음 → 90일
        const fOil = seedFormula({
            ingredients: [{ name: '스쿠알렌', concentration: 100, phase: '유상부' }],
        });
        expect(suggestExpiryDays(fOil)).toBe(90);
        // 원료 없음 → null
        expect(suggestExpiryDays(seedFormula({ ingredients: [] }))).toBeNull();
    });

    it('사용기한 자동 제안 — 신규 폼에서 빈 필드만 채우고 힌트 표시', () => {
        const f = seedFormula(); // 수상 무보존제 → 14일
        batchNew(f.id);
        expect(el('batch-expiry').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(el('batch-expiry-hint').textContent).toContain('자동 제안 14일');
        // 사용자 입력은 덮어쓰지 않음
        el('batch-expiry').value = '2027-12-31';
        el('batch-formula').dispatchEvent(new Event('change'));
        expect(el('batch-expiry').value).toBe('2027-12-31');
    });

    it('목록 필터 — 처방·고객·QC·인도별 필터링 + 초기화', () => {
        createBatch({ formulaName: '수분 세럼', customerName: '김OO', madeAt: '2026-09-20T10:00' });
        createBatch({
            formulaName: '진정 크림', customerName: '이OO', madeAt: '2026-09-21T10:00',
            qc: { appearance: '이상' }, deliveredAt: '2026-09-22',
        });
        openBatchPanel();
        expect(el('batch-list').innerHTML).toContain('수분 세럼');
        expect(el('batch-list').innerHTML).toContain('진정 크림');

        // 처방 필터
        el('batch-filter-formula').value = '수분 세럼';
        el('batch-filter-formula').dispatchEvent(new Event('change'));
        expect(el('batch-list').innerHTML).toContain('수분 세럼');
        expect(el('batch-list').innerHTML).not.toContain('진정 크림');
        batchFilterReset();

        // 고객명 텍스트 필터
        el('batch-filter-customer').value = '이OO';
        el('batch-filter-customer').dispatchEvent(new Event('input'));
        expect(el('batch-list').innerHTML).not.toContain('수분 세럼');
        expect(el('batch-list').innerHTML).toContain('진정 크림');
        batchFilterReset();

        // QC 이상 필터
        el('batch-filter-qc').value = 'bad';
        el('batch-filter-qc').dispatchEvent(new Event('change'));
        expect(el('batch-list').innerHTML).not.toContain('수분 세럼');
        expect(el('batch-list').innerHTML).toContain('진정 크림');
        batchFilterReset();

        // 인도 여부 필터 — 미인도만
        el('batch-filter-delivered').value = 'no';
        el('batch-filter-delivered').dispatchEvent(new Event('change'));
        expect(el('batch-list').innerHTML).toContain('수분 세럼');
        expect(el('batch-list').innerHTML).not.toContain('진정 크림');
        batchFilterReset();

        // 조건 불일치 → 필터 전용 빈 상태
        el('batch-filter-customer').value = '없는고객';
        el('batch-filter-customer').dispatchEvent(new Event('input'));
        expect(el('batch-list').innerHTML).toContain('필터 조건에 맞는 기록이 없습니다');
        batchFilterReset(); // 모듈 필터 상태는 테스트 간 유지되므로 정리
    });

    it('CSV보내기 — 필터된 목록 다운로드 트리거 + 건수 토스트', () => {
        createBatch({ formulaName: '수분 세럼', customerName: '김OO', madeAt: '2026-09-20T10:00' });
        createBatch({ formulaName: '진정 크림', customerName: '이OO', madeAt: '2026-09-21T10:00' });
        const dl = spyAnchorDownload();
        batchExportCsv();
        dl.restore();
        expect(dl.clicks.length).toBe(1);
        expect(dl.clicks[0].download).toMatch(/^batches_\d{4}-\d{2}-\d{2}\.csv$/);
        expect(lastToast()[0]).toContain('2건');
    });

    it('CSV보내기 — 기록이 없으면 warning 토스트, 다운로드 없음', () => {
        const dl = spyAnchorDownload();
        batchExportCsv();
        dl.restore();
        expect(dl.clicks.length).toBe(0);
        expect(lastToast()[1]).toBe('warning');
    });
});
