// tests/unit/material-ledger.test.js
// src/material-ledger.js — 원료 장부 영속성 계층 테스트.
// CRUD·기한 상태(expired/soon/ok/none)·이름 매칭·정렬을 고정한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIAL_LIMIT_FREE,
  EXPIRY_SOON_DAYS,
  STORAGE_OPTIONS,
  listMaterials,
  getMaterial,
  findMaterialByName,
  getMaterialUsage,
  materialStatus,
  daysUntilExpiry,
  expiringMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from '../../src/material-ledger.js';

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

const NOW = new Date('2026-09-22T12:00:00');

const sample = () => ({
  name: '글리세린',
  lot: 'A123',
  receivedAt: '2026-09-01',
  expiryAt: '2026-12-01',
  storage: '냉암소',
  qty: 500,
  unit: 'g',
  notes: '',
});

test('createMaterial — 원료명 필수·id 부여', () => {
  assert.equal(createMaterial({}).ok, false);
  const r = createMaterial(sample());
  assert.equal(r.ok, true);
  assert.ok(r.material.id.startsWith('mat_'));
});

test('materialStatus — 기한 경과·임박·정상·미기재 판정', () => {
  const base = { name: 'x' };
  assert.equal(materialStatus({ ...base, expiryAt: '2026-09-20' }, NOW), 'expired');
  assert.equal(materialStatus({ ...base, expiryAt: '2026-10-10' }, NOW), 'soon');
  assert.equal(materialStatus({ ...base, expiryAt: '2027-06-01' }, NOW), 'ok');
  assert.equal(materialStatus({ ...base }, NOW), 'none');
  assert.equal(materialStatus({ ...base, expiryAt: 'bad' }, NOW), 'none');
});

test('daysUntilExpiry — D-day 계산', () => {
  assert.equal(daysUntilExpiry({ expiryAt: '2026-09-30' }, NOW), 8);
  assert.equal(daysUntilExpiry({ expiryAt: '2026-09-20' }, NOW), -2);
  assert.equal(daysUntilExpiry({}), null);
});

test('listMaterials — 기한 임박 순 정렬, 미기재는 맨 뒤', () => {
  createMaterial({ ...sample(), name: 'A', expiryAt: '2027-01-01' });
  createMaterial({ ...sample(), name: 'B', expiryAt: '2026-10-05' });
  createMaterial({ ...sample(), name: 'C', expiryAt: '' });
  const list = listMaterials();
  assert.equal(list[0].name, 'B');
  assert.equal(list[1].name, 'A');
  assert.equal(list[2].name, 'C');
});

test('findMaterialByName — 정확 매칭만 (부분 매칭 오탐 방지)', () => {
  createMaterial(sample());
  assert.ok(findMaterialByName('글리세린'));
  assert.equal(findMaterialByName('글리세'), null);
  assert.equal(findMaterialByName('글리세린류'), null);
  assert.equal(findMaterialByName(''), null);
});

test('expiringMaterials — 임박·경과만 필터', () => {
  createMaterial({ ...sample(), name: '정상', expiryAt: '2027-06-01' });
  createMaterial({ ...sample(), name: '임박', expiryAt: '2026-10-01' });
  createMaterial({ ...sample(), name: '경과', expiryAt: '2026-09-01' });
  const list = expiringMaterials(NOW);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map(m => m.name).sort(), ['경과', '임박']);
});

test('updateMaterial·deleteMaterial', () => {
  const r = createMaterial(sample());
  const u = updateMaterial(r.material.id, { ...sample(), qty: 250 });
  assert.equal(u.ok, true);
  assert.equal(getMaterial(r.material.id).qty, 250);
  assert.equal(deleteMaterial(r.material.id).ok, true);
  assert.equal(listMaterials().length, 0);
});

test('sanitize — 날짜 형식 정제', () => {
  const r = createMaterial({ ...sample(), receivedAt: '09/01', expiryAt: 'not-a-date' });
  assert.equal(r.material.receivedAt, '');
  assert.equal(r.material.expiryAt, '');
});

test('getMaterialUsage·상수', () => {
  assert.equal(getMaterialUsage().limit, MATERIAL_LIMIT_FREE);
  assert.equal(EXPIRY_SOON_DAYS, 30);
  assert.ok(STORAGE_OPTIONS.includes('냉암소'));
});
