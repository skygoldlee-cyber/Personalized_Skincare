// tests/dom/formula-print.dom.test.js — Formula OS 인쇄 산출물 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.1 (Phase 2c)
// 검증: formulaPrint 빈 드래프트 거부·기록지 렌더, 배치 기록지 QC·위생·스냅샷,
//       라벨 전성분·폴백, 안내문 제형 템플릿·원료 주의, afterprint 정리,
//       미존재 배치 에러

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
}));

import { showToast } from '../../src/ui-utils.js';
import { loadIndexHtml, el, lastToast } from './helpers.js';
import { formulaNew, formulaOpen, formulaPrint } from '../../src/views/formula.js';
import {
    batchPrintRecord, batchPrintLabel, batchPrintGuide,
} from '../../src/views/formula-batch.js';
import { createFormula } from '../../src/formula-store.js';
import { createBatch } from '../../src/batch-store.js';

const INGREDIENTS_STUB = [
    { name: '정제수', engName: 'Water', type: 'approved', category: '용제', description: '', limit: '' },
    { name: '살리실산', engName: 'Salicylic Acid', type: 'restricted', category: '기타', description: '', limit: '2.0%' },
];

const printArea = () => el('formula-print-area');

describe('인쇄 산출물 — 기록지·라벨·안내문', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        window.print = vi.fn();
        vi.mocked(showToast).mockClear();
    });

    it('formulaPrint — 빈 드래프트 → info 토스트·미렌더', () => {
        formulaNew();
        formulaPrint();
        expect(lastToast()[0]).toContain('인쇄할 원료가 없습니다');
        expect(lastToast()[1]).toBe('info');
        expect(printArea().innerHTML).toBe('');
        expect(window.print).not.toHaveBeenCalled();
    });

    it('formulaPrint — 저장 포뮬러 기록지 렌더 + print·afterprint 정리', () => {
        const { formula } = createFormula({
            name: '수분 세럼', targetVolume: 100, unit: 'ml',
            ingredients: [{ name: '정제수', concentration: 100, phase: '수상부' }],
        });
        formulaOpen(formula.id);
        formulaPrint();

        const html = printArea().innerHTML;
        expect(html).toContain('조제 기록지 — 수분 세럼');
        expect(html).toContain('정제수');
        expect(html).toContain('100%'); // 합계 행
        expect(document.body.classList.contains('formula-printing')).toBe(true);
        expect(window.print).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new Event('afterprint'));
        expect(document.body.classList.contains('formula-printing')).toBe(false);
    });

    it('기록지 — pH·제조 절차·안정성·전성분 섹션 반영', () => {
        const { formula } = createFormula({
            name: '확인 크림', targetVolume: 50,
            phTarget: 5.5, phActual: 5.6,
            steps: ['수상부 80℃ 가열', '유상부 가열 후 혼합'],
            stability: { method: '가속(고온) 시험', result: '양호', recordedAt: '2026-09-20T10:00' },
            fullIngredients: ['정제수', '글리세린'],
            ingredients: [{ name: '정제수', concentration: 100 }],
        });
        formulaOpen(formula.id);
        formulaPrint();

        const html = printArea().innerHTML;
        expect(html).toContain('목표 pH: 5.5');
        expect(html).toContain('제조 절차');
        expect(html).toContain('수상부 80℃ 가열');
        expect(html).toContain('제형 안정성');
        expect(html).toContain('전성분 표시: 정제수');
        expect(html).toContain('가속(고온) 시험');
        expect(html).toContain('기록 2026-09-20 10:00'); // recordedAt 보존
    });

    it('배치 기록지 — QC 배지·위생 체크·검증 스냅샷', () => {
        const { batch } = createBatch({
            formulaName: '세럼', batchNo: undefined, madeAt: '2026-09-20T10:00',
            customerName: '김OO', targetVolume: 100, unit: 'g', expiryAt: '2026-12-20',
            qc: { appearance: '정상', scent: '이상' },
            hygiene: { toolsSterilized: true, glovesWorn: true },
            checkSnapshot: { ok: 1, warn: 1, banned: 0, unknown: 0, stabWarn: 0, stabInfo: 0 },
        });
        batchPrintRecord(batch.id);

        const html = printArea().innerHTML;
        expect(html).toContain(`조제 기록 — ${batch.batchNo}`);
        expect(html).toContain('○ 정상');
        expect(html).toContain('✕ 이상');
        expect(html).toContain('☑ 도구·기구 소독');
        expect(html).toContain('☐ 작업 공간 정리');
        expect(html).toContain('규정 검증 (조제 시점 스냅샷)');
        expect(html).toContain('초과 1');
        expect(window.print).toHaveBeenCalledTimes(1);
    });

    it('배치 라벨 — 전성분·고객·주의 문구', () => {
        const { batch } = createBatch({
            formulaName: '세럼', madeAt: '2026-09-20T10:00',
            customerName: '김OO', targetVolume: 30, unit: 'ml', expiryAt: '2026-12-20',
            fullIngredients: ['정제수', '글리세린'],
        });
        batchPrintLabel(batch.id);

        const html = printArea().innerHTML;
        expect(html).toContain('fp-label');
        expect(html).toContain(`배치번호 ${batch.batchNo}`);
        expect(html).toContain('정제수, 글리세린');
        expect(html).toContain('고객 김OO');
        expect(html).toContain('표시된 고객 외 사용 금지');
    });

    it('배치 라벨 — 전성분 미생성 시 폴백 안내', () => {
        const { batch } = createBatch({ formulaName: '세럼', madeAt: '2026-09-20T10:00' });
        batchPrintLabel(batch.id);
        expect(printArea().innerHTML).toContain('전성분 미생성');
    });

    it('사용 안내문 — 제형 템플릿 + 원료별 주의 자동 병기', () => {
        const { batch } = createBatch({
            formulaName: 'BHA 토너', madeAt: '2026-09-20T10:00',
            formulation: '토너·미스트', expiryAt: '2026-12-20',
            fullIngredients: ['정제수', '살리실산'],
        });
        batchPrintGuide(batch.id);

        const html = printArea().innerHTML;
        expect(html).toContain('사용 안내문 — BHA 토너');
        expect(html).toContain('사용법');
        expect(html).toContain('화장솜에 적셔'); // 토너·미스트 템플릿
        expect(html).toContain('보관 방법');
        expect(html).toContain('BHA(살리실산) 함유'); // 원료 주의 자동 병기
        expect(html).toContain('일반적인 사용 지침'); // 면책 문구
    });

    it('미존재 배치 인쇄 → 에러 토스트·미렌더', () => {
        batchPrintRecord('bat_none');
        expect(lastToast()[1]).toBe('error');
        expect(printArea().innerHTML).toBe('');
        expect(window.print).not.toHaveBeenCalled();
    });
});
