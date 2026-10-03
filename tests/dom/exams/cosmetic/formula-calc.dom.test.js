// tests/dom/formula-calc.dom.test.js — 배합 계산기 + 포뮬러 목록 시나리오
// @spec FO-01,FO-27,FO-28,FO-30,FO-31,FO-32,DI-07,DI-09
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.1 (Phase 2a)
// 검증: 배합률→투입량 계산, 합계 100% 판정, 한도 초과/금지/미등록 배지,
//       고객 카드 불러오기, 저장→목록 반영, 삭제 confirm, JSON보내기/가져오기,
//       안정성 기록→카드 배지·전성분, 자가 등록 성분 모달·배지·인덱스 갱신

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
}));

import { showToast, showConfirm } from '../../../../src/ui-utils.js';
import {
    loadIndexHtml, el, isVisible, selectFile, flushAsync, lastToast, spyAnchorDownload,
} from '../../helpers.js';
import {
    formulaNew, openFormulaList, formulaCalcAddRow,
    formulaCalcSave, formulaDelete, formulaCustLoad, formulaOpen,
    formulaExportJson, formulaImportJson,
    formulaWeighOpen, formulaWeighNext, formulaToggleContrast,
    invalidateIngredientIndex,
    customIngAdd, customIngEdit, customIngSave, customIngDelete, customIngClose,
} from '../../../../src/exams/cosmetic/views/formula.js';
import { createCustomIngredient, listCustomIngredients } from '../../../../src/exams/cosmetic/custom-ingredient-store.js';
import { getJSON } from '../../../../src/storage.js';
import { STORAGE_KEYS } from '../../../../src/storage-keys.js';
import { listFormulas, createFormula, serializeFormula } from '../../../../src/exams/cosmetic/formula-store.js';
import { createCustomer } from '../../../../src/exams/cosmetic/customer-store.js';

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

    it('고객 카드 불러오기 → 고객 필드 반영', () => {
        const { customer } = createCustomer({ name: '김OO', skinType: '건성', concerns: ['건조'], pregnancy: '임신 중' });
        formulaNew();

        el('formula-cust-ref').value = customer.id;
        formulaCustLoad();

        expect(el('formula-cust-name').value).toBe('김OO');
        expect(el('formula-cust-skintype').value).toBe('건성');
        expect(el('formula-cust-pregnancy').value).toBe('임신 중');
        expect(el('formula-cust-id').value).toBe(customer.id);
        expect(el('formula-cust-concerns').querySelector('input[value="건조"]').checked).toBe(true);
        // 필드가 화면에 즉시 반영되므로 별도 확인 토스트는 띄우지 않는다 (알림 피로 완화)
        expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining('불러왔습니다'), expect.anything());
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

    it('고시 개정 감지 — 저장 스냅샷과 현재 DB 불일치 시 배지·배너', () => {
        const { formula } = createFormula({
            name: '구기준 포뮬러',
            ingredients: [
                // 스텁 DB는 살리실산 restricted/2.0% — 저장 시점이 approved/5.0%로 다름
                { name: '살리실산', concentration: 1, snapshot: { type: 'approved', limit: '5.0%' } },
                { name: '정제수', concentration: 99 }, // 스냅샷 없음 → 비교 제외
            ],
        });
        openFormulaList();
        expect(el('formula-list').innerHTML).toContain('기준 변경 1');

        formulaOpen(formula.id);
        expect(el('formula-std-warn').classList.contains('is-hidden')).toBe(false);
        expect(el('formula-std-warn').textContent).toContain('1종');
    });

    it('고시 개정 감지 — 스냅샷이 현재 DB와 동일하면 배지·배너 없음', () => {
        const { formula } = createFormula({
            name: '최신 포뮬러',
            ingredients: [
                { name: '살리실산', concentration: 1, snapshot: { type: 'restricted', limit: '2.0%' } },
            ],
        });
        openFormulaList();
        expect(el('formula-list').innerHTML).not.toContain('기준 변경');

        formulaOpen(formula.id);
        expect(el('formula-std-warn').classList.contains('is-hidden')).toBe(true);
    });
});

describe('배합 계산기 — 태블릿·현장 작업 (FO-27~31)', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        vi.mocked(showToast).mockClear();
        vi.mocked(showConfirm).mockClear();
        vi.mocked(showConfirm).mockResolvedValue(true);
    });

    it('배합률 스테퍼 — + 버튼으로 0.1 증감하고 투입량·합계 갱신 (FO-27)', () => {
        formulaNew();
        el('formula-target-volume').value = '200';
        el('formula-target-volume').dispatchEvent(new Event('input'));
        setRow(0, '글리세린', 5);
        const inc = rowEl(0).querySelector('.f-step-btn[data-dir="1"]');
        const dec = rowEl(0).querySelector('.f-step-btn[data-dir="-1"]');
        inc.dispatchEvent(new Event('click'));
        expect(rowEl(0).querySelector('.f-conc').value).toBe('5.1');
        expect(rowEl(0).querySelector('.f-amount').textContent).toBe('= 10.20g');
        dec.dispatchEvent(new Event('click'));
        dec.dispatchEvent(new Event('click'));
        expect(rowEl(0).querySelector('.f-conc').value).toBe('4.9');
    });

    it('진행 단계 표시 — 원료 입력·검증 완료에 따라 단계 활성 (FO-27)', () => {
        formulaNew();
        const steps = () => el('formula-progress').querySelectorAll('.f-prog-step.is-done');
        expect(steps().length).toBe(0);
        setRow(0, '글리세린', 5);       // 한도 없는 일반 원료 → 검증 통과
        expect(steps().length).toBe(2); // 원료 입력 + 한도 검증
        expect(steps()[0].textContent).toContain('원료 입력');
        expect(steps()[1].textContent).toContain('한도 검증');
    });

    it('계량 모드 — 원료별 투입량 대형 표시 순회·종료 (FO-28)', () => {
        formulaNew();
        el('formula-target-volume').value = '200';
        el('formula-target-volume').dispatchEvent(new Event('input'));
        setRow(0, '글리세린', 5);
        formulaCalcAddRow();
        setRow(1, '정제수', 95);

        formulaWeighOpen();
        expect(el('formula-weigh-overlay').classList.contains('is-hidden')).toBe(false);
        expect(el('formula-weigh-name').textContent).toBe('글리세린');
        expect(el('formula-weigh-amount').textContent).toBe('10.00g');
        expect(el('formula-weigh-pos').textContent).toBe('1 / 2');

        formulaWeighNext();
        expect(el('formula-weigh-name').textContent).toBe('정제수');
        formulaWeighNext(); // 마지막 → 자동 종료
        expect(el('formula-weigh-overlay').classList.contains('is-hidden')).toBe(true);
    });

    it('계량 모드 — 이름 없는 행만 있으면 안내하고 미오픈 (FO-28)', () => {
        formulaNew();
        formulaWeighOpen();
        expect(el('formula-weigh-overlay').classList.contains('is-hidden')).toBe(true);
    });

    it('작업 드래프트 자동 저장·재진입 복원 (FO-30)', () => {
        vi.useFakeTimers();
        try {
            formulaNew();
            el('formula-name-input').value = '수분 세럼';
            el('formula-name-input').dispatchEvent(new Event('input'));
            setRow(0, '글리세린', 5);
            vi.advanceTimersByTime(700);
            const draft = getJSON(STORAGE_KEYS.FORMULA_CALC_DRAFT);
            expect(draft.rows[0].name).toBe('글리세린');
            expect(draft.name).toBe('수분 세럼');

            formulaNew(); // 재진입 → 드래프트 복원
            expect(rowEl(0).querySelector('.f-name').value).toBe('글리세린');
            expect(el('formula-name-input').value).toBe('수분 세럼');
            expect(el('formula-draft-status').textContent).toContain('복원');
        } finally {
            vi.useRealTimers();
        }
    });

    it('고대비 토글 — #formula-view 스코프 클래스·영속 (FO-31)', () => {
        const view = document.getElementById('formula-view');
        expect(view.classList.contains('formula-hc')).toBe(false);
        formulaToggleContrast();
        expect(view.classList.contains('formula-hc')).toBe(true);
        expect(getJSON(STORAGE_KEYS.FORMULA_HIGH_CONTRAST)).toBe(true);
        formulaToggleContrast();
        expect(view.classList.contains('formula-hc')).toBe(false);
    });
});

describe('배합 계산기 — 자가 등록 성분 (DI-07·09, FO-32)', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.INGREDIENTS_DATA = INGREDIENTS_STUB;
        invalidateIngredientIndex(); // 모듈 싱글턴 — 스토어 상태와 재동기화
        vi.mocked(showToast).mockClear();
        vi.mocked(showConfirm).mockClear();
        vi.mocked(showConfirm).mockResolvedValue(true);
    });

    it("'DB 미등록' 행에 '사전 등록' 액션 — data-click=customIngAdd·원료명 인자 (FO-32)", () => {
        formulaNew();
        setRow(0, '미등록원료', 1);

        const cell = rowEl(0).querySelector('.f-check-cell');
        const btn = cell.querySelector('[data-click="customIngAdd"]');
        expect(btn).not.toBeNull();
        expect(btn.dataset.arg).toBe('미등록원료');
        expect(btn.textContent).toContain('사전 등록');
    });

    it('자가 등록 원료 — "자가 등록"/"자가 한도 초과" 배지, 법정 라벨 아님 (DI-07)', () => {
        createCustomIngredient({ name: '자체 베이스A', limit: '2.0%' });
        createCustomIngredient({ name: '자체 보습B' }); // 한도 미선언
        invalidateIngredientIndex();

        formulaNew();
        formulaCalcAddRow();
        formulaCalcAddRow();
        setRow(0, '자체 베이스A', 1);   // 자가 한도 2% 이내
        setRow(1, '자체 베이스A', 5);   // 초과
        setRow(2, '자체 보습B', 3);     // 한도 없음

        const cells = el('formula-calc-rows').querySelectorAll('.f-check-cell');
        expect(cells[0].textContent).toContain('자가 한도 이내');
        expect(cells[1].textContent).toContain('자가 한도 초과');
        expect(cells[2].textContent).toContain('자가 등록');
        // 'DB 미등록' 아님 — 커스텀은 등록 항목으로 인식
        expect(cells[2].textContent).not.toContain('DB 미등록');
    });

    it('미등록 행 → 등록 모달 프리필 → 저장 시 행 배지 즉시 갱신 (FO-32·DI-09)', () => {
        formulaNew();
        setRow(0, '신원료X', 2);
        expect(rowEl(0).querySelector('.f-check-cell').textContent).toContain('DB 미등록');

        customIngAdd('신원료X');
        expect(el('cing-overlay').classList.contains('is-hidden')).toBe(false);
        expect(el('cing-name').value).toBe('신원료X');

        customIngSave();
        expect(listCustomIngredients().map(i => i.name)).toContain('신원료X');
        expect(el('cing-overlay').classList.contains('is-hidden')).toBe(true);
        // 저장 후 행 재렌더 → '자가 등록' 배지
        expect(rowEl(0).querySelector('.f-check-cell').textContent).toContain('자가 등록');
        expect(lastToast()[0]).toContain('등록');
    });

    it('공식 DB 동명 등록 시도 → 거부 토스트·저장 안 됨 (DI-08)', () => {
        customIngAdd('살리실산');
        customIngSave();

        expect(listCustomIngredients().length).toBe(0);
        expect(lastToast()[0]).toContain('공식 DB');
        expect(el('cing-overlay').classList.contains('is-hidden')).toBe(false); // 모달 유지
        customIngClose();
    });

    it('수정·삭제 — 수정은 인덱스 갱신, 삭제는 확인 후 배지 복귀 (DI-06·09)', async () => {
        const r = createCustomIngredient({ name: '자체 원료C' });
        invalidateIngredientIndex();
        formulaNew();
        setRow(0, '자체 원료C', 1);
        expect(rowEl(0).querySelector('.f-check-cell').textContent).toContain('자가 등록');

        // 수정 — 한도 부여
        customIngEdit(r.item.id);
        expect(el('cing-title').textContent).toContain('수정');
        expect(el('cing-delete').classList.contains('is-hidden')).toBe(false);
        el('cing-limit').value = '0.5%';
        customIngSave();
        expect(rowEl(0).querySelector('.f-check-cell').textContent).toContain('자가 한도 초과');

        // 삭제 — 확인 후 'DB 미등록' 복귀
        customIngEdit(r.item.id);
        await customIngDelete();
        await flushAsync();
        expect(listCustomIngredients().length).toBe(0);
        expect(rowEl(0).querySelector('.f-check-cell').textContent).toContain('DB 미등록');
    });
});
