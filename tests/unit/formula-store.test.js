// tests/unit/formula-store.test.js
// src/formula-store.js — My Formula 영속성 계층 테스트.
// CRUD·Free 한도·스냅샷 보존·투입량 계산의 불변식을 고정한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMULA_LIMIT_FREE,
  PHASE_OPTIONS,
  newFormulaId,
  listFormulas,
  getFormula,
  getFormulaUsage,
  createFormula,
  updateFormula,
  deleteFormula,
  duplicateFormula,
  calcAmounts,
  serializeFormula,
  importFormula,
} from '../../src/formula-store.js';

// --- localStorage 모킹 (state.test.js와 동일 패턴) ---

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
  name: '수분 세럼 v1',
  targetVolume: 100,
  unit: 'g',
  notes: '테스트 메모',
  ingredients: [
    { name: '정제수', engName: 'Water', concentration: 80, snapshot: { type: 'approved', limit: '' } },
    { name: '페녹시에탄올', engName: 'Phenoxyethanol', concentration: 0.8,
      snapshot: { type: 'restricted', limit: '1.0%' } },
  ],
});

// ── ID ─────────────────────────────────────────────────────

test('newFormulaId: fml_ 접두사 + 유일성', () => {
  const a = newFormulaId();
  const b = newFormulaId();
  assert.match(a, /^fml_/);
  assert.notEqual(a, b);
});

// ── create / list / get ────────────────────────────────────

test('createFormula: 정상 생성 + 목록·단건 조회', () => {
  const r = createFormula(sample());
  assert.equal(r.ok, true);
  assert.match(r.formula.id, /^fml_/);
  assert.equal(r.formula.name, '수분 세럼 v1');

  const list = listFormulas();
  assert.equal(list.length, 1);
  assert.equal(getFormula(r.formula.id).name, '수분 세럼 v1');
  assert.equal(getFormula('fml_nonexistent'), null);
});

test('createFormula: 이름 없으면 거부', () => {
  assert.equal(createFormula({ name: '' }).ok, false);
  assert.equal(createFormula({}).ok, false);
});

test('createFormula: 이름/메모 길이 클램프', () => {
  const r = createFormula({ name: 'x'.repeat(100), notes: 'y'.repeat(600) });
  assert.equal(r.ok, true);
  assert.equal(r.formula.name.length, 60);
  assert.equal(r.formula.notes.length, 500);
});

test('createFormula: 무효 원료 행은 제거', () => {
  const r = createFormula({
    name: 't',
    ingredients: [
      { name: '정제수', concentration: 80 },
      { name: '', concentration: 5 },           // 빈 이름 → 제거
      null,                                     // 비객체 → 제거
      { concentration: 3 },                     // name 없음 → 제거
    ],
  });
  assert.equal(r.formula.ingredients.length, 1);
  assert.equal(r.formula.ingredients[0].name, '정제수');
});

// ── 한도 (Free 5개) ────────────────────────────────────────

test('한도: FORMULA_LIMIT_FREE 초과 생성 거부', () => {
  for (let i = 0; i < FORMULA_LIMIT_FREE; i++) {
    assert.equal(createFormula({ name: `f${i}` }).ok, true);
  }
  const usage = getFormulaUsage();
  assert.equal(usage.count, FORMULA_LIMIT_FREE);
  assert.equal(usage.canCreate, false);

  const over = createFormula({ name: 'overflow' });
  assert.equal(over.ok, false);
  assert.match(over.error, /최대/);
});

test('한도: 삭제 후 재생성 가능', () => {
  const ids = [];
  for (let i = 0; i < FORMULA_LIMIT_FREE; i++) {
    ids.push(createFormula({ name: `f${i}` }).formula.id);
  }
  assert.equal(deleteFormula(ids[0]).ok, true);
  assert.equal(createFormula({ name: 'new' }).ok, true);
});

// ── update ─────────────────────────────────────────────────

test('updateFormula: 필드 갱신 + id/createdAt 보존', () => {
  const { formula } = createFormula(sample());
  const r = updateFormula(formula.id, {
    ...formula, name: '세럼 v2', targetVolume: 50,
  });
  assert.equal(r.ok, true);
  assert.equal(r.formula.name, '세럼 v2');
  assert.equal(r.formula.id, formula.id);
  assert.equal(r.formula.createdAt, formula.createdAt);
  assert.ok(r.formula.updatedAt >= formula.updatedAt);
});

test('updateFormula: 없는 id → 오류', () => {
  assert.equal(updateFormula('fml_x', { name: 'a' }).ok, false);
});

// ── duplicate ──────────────────────────────────────────────

test('duplicateFormula: 복사본 생성 + 한도 적용', () => {
  const { formula } = createFormula(sample());
  const r = duplicateFormula(formula.id);
  assert.equal(r.ok, true);
  assert.match(r.formula.name, /복사본/);
  assert.notEqual(r.formula.id, formula.id);
  assert.equal(r.formula.ingredients.length, 2);

  assert.equal(duplicateFormula('fml_none').ok, false);
});

// ── snapshot 보존 ──────────────────────────────────────────

test('snapshot: 저장 시점 규정 기준이 행에 보존된다', () => {
  const { formula } = createFormula(sample());
  const saved = getFormula(formula.id);
  assert.deepEqual(saved.ingredients[1].snapshot, { type: 'restricted', limit: '1.0%' });
});

// ── calcAmounts ────────────────────────────────────────────

test('calcAmounts: 총량×농도 → 투입량 (소수 2자리)', () => {
  const { formula } = createFormula(sample());
  const amounts = calcAmounts(formula);
  assert.equal(amounts[0].amount, 80);      // 100g × 80%
  assert.equal(amounts[1].amount, 0.8);     // 100g × 0.8%
});

test('calcAmounts: 총량 없으면 amount=null', () => {
  const { formula } = createFormula({
    name: 't', ingredients: [{ name: 'a', concentration: 10 }],
  });
  assert.equal(calcAmounts(formula)[0].amount, null);
  assert.deepEqual(calcAmounts(null), []);
});

// ── 고객 정보 (customer) ─────────────────────────────────

test('customer: 정상 필드 저장 + 복원', () => {
  const { formula } = createFormula({
    name: '고객 포뮬러',
    customer: {
      name: '김고객', age: 32, gender: '여성', skinType: '민감성',
      concerns: ['민감·홍조', '진정'], formulation: '세럼·에센스',
    },
  });
  const c = getFormula(formula.id).customer;
  assert.equal(c.name, '김고객');
  assert.equal(c.age, 32);
  assert.equal(c.gender, '여성');
  assert.equal(c.skinType, '민감성');
  assert.deepEqual(c.concerns, ['민감·홍조', '진정']);
  assert.equal(c.formulation, '세럼·에센스');
});

test('customer: enum 외 값은 빈 문자열로 필터', () => {
  const { formula } = createFormula({
    name: 't',
    customer: { gender: '알수없음', skinType: '악성', formulation: '앰플', concerns: ['없는항목', '진정'] },
  });
  const c = getFormula(formula.id).customer;
  assert.equal(c.gender, '');
  assert.equal(c.skinType, '');
  assert.equal(c.formulation, '');
  assert.deepEqual(c.concerns, ['진정']);  // 허용 목록 내만 유지
});

test('customer: 전부 비어 있으면 null 저장', () => {
  const { formula } = createFormula({
    name: 't',
    customer: { name: '', gender: '', concerns: [] },
  });
  assert.equal(getFormula(formula.id).customer, null);
});

test('customer: 없으면 null — 하위호환', () => {
  const { formula } = createFormula({ name: 't' });
  assert.equal(getFormula(formula.id).customer, null);
});

test('customer: update로 수정 가능', () => {
  const { formula } = createFormula({ name: 't' });
  const r = updateFormula(formula.id, {
    name: 't', customer: { name: '이고객', skinType: '지성' },
  });
  assert.equal(r.formula.customer.name, '이고객');
  assert.equal(r.formula.customer.skinType, '지성');
});

// ── 제조 단계(phase) · pH · 절차(steps) ─────────────────

test('phase: PHASE_OPTIONS 값만 보존, enum 외는 빈 문자열', () => {
  const { formula } = createFormula({
    name: 't',
    ingredients: [
      { name: 'a', phase: '수상부' },
      { name: 'b', phase: '없는단계' },
      { name: 'c' },
    ],
  });
  const ings = getFormula(formula.id).ingredients;
  assert.equal(ings[0].phase, '수상부');
  assert.equal(ings[1].phase, '');
  assert.equal(ings[2].phase, '');
  PHASE_OPTIONS.forEach(p => assert.equal(typeof p, 'string'));
});

test('pH: 0~14 범위만 저장, 범위 밖은 null', () => {
  const { formula } = createFormula({ name: 't', phTarget: 5.5, phActual: '6.0' });
  const f = getFormula(formula.id);
  assert.equal(f.phTarget, 5.5);
  assert.equal(f.phActual, 6);

  const { formula: bad } = createFormula({ name: 't2', phTarget: 15, phActual: -1 });
  const bf = getFormula(bad.id);
  assert.equal(bf.phTarget, null);
  assert.equal(bf.phActual, null);
});

test('steps: 공백 제거·빈 단계 필터·20개·200자 클램프', () => {
  const { formula } = createFormula({
    name: 't',
    steps: ['  수상부 80℃ 가열  ', '', null, '유상부 가열·용해', 'x'.repeat(250)],
  });
  const s = getFormula(formula.id).steps;
  assert.equal(s.length, 3);
  assert.equal(s[0], '수상부 80℃ 가열');
  assert.equal(s[2].length, 200);

  const { formula: empty } = createFormula({ name: 't2' });
  assert.deepEqual(getFormula(empty.id).steps, []);
});

// ── 포뮬러 JSON보내기/가져오기 ─────────────────────

test('serialize/import: 왕복 보존 + id 재부여', () => {
  const { formula } = createFormula({
    ...sample(),
    phTarget: 5.5,
    steps: ['수상부 가열', '유상부 투입'],
    ingredients: [{ name: '글리세린', concentration: 10, phase: '수상부' }],
  });
  const json = serializeFormula(formula);
  const r = importFormula(json);
  assert.equal(r.ok, true);
  assert.notEqual(r.formula.id, formula.id);
  assert.equal(r.formula.name, '수분 세럼 v1');
  assert.equal(r.formula.phTarget, 5.5);
  assert.deepEqual(r.formula.steps, ['수상부 가열', '유상부 투입']);
  assert.equal(r.formula.ingredients[0].phase, '수상부');
});

test('import: 잘못된 JSON·비객체 거부', () => {
  assert.equal(importFormula('{bad json').ok, false);
  assert.equal(importFormula('123').ok, false);
  assert.equal(importFormula('[1,2]').ok, false);
});

test('import: 이름 없는 데이터 → 생성 거부, 한도 초과 → 한도 오류', () => {
  assert.equal(importFormula('{"type":"formula-os","formula":{"name":""}}').ok, false);
  for (let i = 0; i < FORMULA_LIMIT_FREE; i++) {
    createFormula({ name: `f${i}` });
  }
  const r = importFormula('{"name":"over"}');
  assert.equal(r.ok, false);
  assert.match(r.error, /최대/);
});
