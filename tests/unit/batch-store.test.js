// tests/unit/batch-store.test.js
// src/batch-store.js — 조제 기록(배치) 영속성 계층 테스트.
// 채번·불변 필드·QC/위생 정제·스냅샷 보존의 불변식을 고정한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_LIMIT_FREE,
  QC_FIELDS,
  QC_VALUES,
  HYGIENE_FIELDS,
  listBatches,
  getBatch,
  listBatchesByFormula,
  nextBatchNo,
  createBatch,
  updateBatch,
  deleteBatch,
} from '../../src/batch-store.js';

// --- localStorage 모킹 (formula-store.test.js와 동일 패턴) ---

function createMockStorage() {
  const store = {};
  return {
    getItem(key) { return key in store ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
    _store: store,
  };
}

let mockStorage;
let originalLocalStorage;

beforeEach(() => {
  mockStorage = createMockStorage();
  originalLocalStorage = global.localStorage;
  Object.defineProperty(global, 'localStorage', {
    value: mockStorage, writable: true, configurable: true,
  });
});

afterEach(() => {
  if (originalLocalStorage !== undefined) {
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage, writable: true, configurable: true,
    });
  } else {
    delete global.localStorage;
  }
});

const sample = () => ({
  formulaId: 'fml_abc',
  formulaName: '수분 세럼 v1',
  madeAt: '2026-09-22T14:30',
  targetVolume: 100,
  unit: 'g',
  customerName: '김OO',
  expiryAt: '2026-12-22',
  qc: { appearance: '정상', color: '정상', scent: '정상', viscosity: '정상', foreign: '정상' },
  hygiene: { toolsSterilized: true, workspaceCleaned: true, glovesWorn: true },
  formulation: '세럼·에센스',
  fullIngredients: ['정제수', '글리세린'],
  checkSnapshot: { ok: 8, warn: 0, banned: 0, unknown: 1, stabWarn: 0, stabInfo: 2 },
  notes: '첫 회차',
});

test('createBatch — 필수값 검증 (formulaName·madeAt)', () => {
  assert.equal(createBatch({ madeAt: '2026-09-22T10:00' }).ok, false);
  assert.equal(createBatch({ formulaName: 'x' }).ok, false);
  const r = createBatch(sample());
  assert.equal(r.ok, true);
  assert.ok(r.batch.id.startsWith('bat_'));
});

test('batchNo — 당일 순번 채번 (YYYYMMDD-NN)', () => {
  const r1 = createBatch(sample());
  const r2 = createBatch({ ...sample(), madeAt: '2026-09-22T16:00' });
  assert.equal(r1.batch.batchNo, '20260922-01');
  assert.equal(r2.batch.batchNo, '20260922-02');
  const r3 = createBatch({ ...sample(), madeAt: '2026-09-23T09:00' });
  assert.equal(r3.batch.batchNo, '20260923-01');
});

test('listBatches — madeAt 내림차순', () => {
  createBatch({ ...sample(), madeAt: '2026-09-20T10:00' });
  createBatch({ ...sample(), madeAt: '2026-09-22T10:00' });
  const list = listBatches();
  assert.equal(list[0].batchNo, '20260922-01');
  assert.equal(list[1].batchNo, '20260920-01');
});

test('listBatchesByFormula — 처방별 필터', () => {
  createBatch(sample());
  createBatch({ ...sample(), formulaId: 'fml_other', formulaName: '다른 처방' });
  const list = listBatchesByFormula('fml_abc');
  assert.equal(list.length, 1);
  assert.equal(list[0].formulaId, 'fml_abc');
});

test('updateBatch — QC·위생·메모 보정만 허용, identity 불변', () => {
  const r = createBatch(sample());
  const id = r.batch.id;
  const u = updateBatch(id, {
    qc: { appearance: '이상' },
    notes: '보정됨',
    // identity 필드 변경 시도 — 무시돼야 함
    batchNo: '19990101-99',
    madeAt: '1999-01-01T00:00',
    formulaId: 'fml_hacked',
    checkSnapshot: { ok: 0, warn: 0, banned: 99, unknown: 0, stabWarn: 0, stabInfo: 0 },
  });
  assert.equal(u.ok, true);
  const b = getBatch(id);
  assert.equal(b.qc.appearance, '이상');
  assert.equal(b.qc.color, '정상'); // 미지정 항목은 기존값 유지
  assert.equal(b.notes, '보정됨');
  assert.equal(b.batchNo, '20260922-01'); // 불변
  assert.equal(b.madeAt, '2026-09-22T14:30'); // 불변
  assert.equal(b.formulaId, 'fml_abc'); // 불변
  assert.equal(b.checkSnapshot.unknown, 1); // 스냅샷 불변
});

test('sanitize — qc 열거형·위생 불리언·날짜 형식 정제', () => {
  const r = createBatch({
    ...sample(),
    qc: { appearance: '이상함', color: '정상' },
    hygiene: { toolsSterilized: 'yes' },
    expiryAt: '22/12/2026',
  });
  const b = r.batch;
  assert.equal(b.qc.appearance, '');        // 허용값 아님 → ''
  assert.equal(b.qc.color, '정상');
  assert.equal(b.hygiene.toolsSterilized, false); // true만 인정
  assert.equal(b.expiryAt, '');              // YYYY-MM-DD 아님 → ''
});

test('deleteBatch — 삭제 후 목록에서 제거', () => {
  const r = createBatch(sample());
  assert.equal(deleteBatch(r.batch.id).ok, true);
  assert.equal(getBatch(r.batch.id), null);
  assert.equal(listBatches().length, 0);
});

test('nextBatchNo — 날짜 접두사로 직접 채번', () => {
  createBatch({ ...sample(), madeAt: '2026-09-25T10:00' });
  assert.equal(nextBatchNo('2026-09-25'), '20260925-02');
  assert.equal(nextBatchNo('2026-09-26'), '20260926-01');
});

test('checkSnapshot — 생성 시점 검증 요약이 그대로 보존', () => {
  const snap = { ok: 3, warn: 1, banned: 0, unknown: 2, stabWarn: 1, stabInfo: 0 };
  const r = createBatch({ ...sample(), checkSnapshot: snap });
  assert.deepEqual(r.batch.checkSnapshot, { ...snap, dbVersion: '' });
});

test('checkSnapshot — dbVersion 보존 + 카운트 전부 0이어도 버전이 있으면 유지', () => {
  const snap = { ok: 0, warn: 0, banned: 0, unknown: 0, stabWarn: 0, stabInfo: 0, dbVersion: '2026-03' };
  const r = createBatch({ ...sample(), checkSnapshot: snap });
  assert.equal(r.batch.checkSnapshot.dbVersion, '2026-03');
  // 카운트·버전 모두 없으면 스냅샷 자체를 버림
  const r2 = createBatch({ ...sample(), checkSnapshot: { ok: 0 } });
  assert.equal(r2.batch.checkSnapshot, null);
});

test('phMeasured — 0~14 범위 정제 + 보정으로 갱신', () => {
  const r = createBatch({ ...sample(), phMeasured: 5.5 });
  assert.equal(r.batch.phMeasured, 5.5);
  // 범위 밖 → null
  const r2 = createBatch({ ...sample(), phMeasured: 15 });
  assert.equal(r2.batch.phMeasured, null);
  const r3 = createBatch({ ...sample(), phMeasured: 'abc' });
  assert.equal(r3.batch.phMeasured, null);
  // 보정으로 갱신 가능
  const u = updateBatch(r.batch.id, { phMeasured: 4.2 });
  assert.equal(u.ok, true);
  assert.equal(getBatch(r.batch.id).phMeasured, 4.2);
});

test('materialLots — {name,materialId,lot} 정제 + name/materialId 없으면 제외', () => {
  const r = createBatch({
    ...sample(),
    materialLots: [
      { name: '글리세린', materialId: 'mat_1', lot: 'L2401' },
      { name: '정제수', materialId: 'mat_2' },           // lot 없음 허용
      { name: '', materialId: 'mat_3', lot: 'X' },        // name 없음 → 제외
      { name: '폐기', lot: 'Y' },                         // materialId 없음 → 제외
      'junk',
    ],
  });
  assert.equal(r.batch.materialLots.length, 2);
  assert.equal(r.batch.materialLots[0].lot, 'L2401');
  // 보정으로 갱신 가능
  const u = updateBatch(r.batch.id, {
    materialLots: [{ name: '글리세린', materialId: 'mat_9', lot: 'L9999' }],
  });
  assert.equal(u.ok, true);
  assert.equal(getBatch(r.batch.id).materialLots[0].materialId, 'mat_9');
});

test('deliveredAt·disposition — 날짜 형식·열거형 정제', () => {
  const r = createBatch({
    ...sample(),
    deliveredAt: '2026-09-25',
    disposition: '폐기',
  });
  assert.equal(r.batch.deliveredAt, '2026-09-25');
  assert.equal(r.batch.disposition, '폐기');
  // 잘못된 값 정제
  const r2 = createBatch({ ...sample(), deliveredAt: '25/09/2026', disposition: '버림' });
  assert.equal(r2.batch.deliveredAt, '');
  assert.equal(r2.batch.disposition, '');
  // 보정으로 인도일·조치 기록
  const u = updateBatch(r2.batch.id, { deliveredAt: '2026-09-26', disposition: '재조제' });
  assert.equal(u.batch.deliveredAt, '2026-09-26');
  assert.equal(u.batch.disposition, '재조제');
});

test('QC_FIELDS·QC_VALUES·HYGIENE_FIELDS — 스키마 상수', () => {
  assert.equal(QC_FIELDS.length, 5);
  assert.deepEqual([...QC_VALUES], ['정상', '이상', '미확인']);
  assert.equal(HYGIENE_FIELDS.length, 3);
});
