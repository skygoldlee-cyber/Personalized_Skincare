// tests/unit/formula-os.test.js — Formula OS 핵심 스토어·규칙 테스트
// @spec FO-03,FO-04,FO-07,FO-09
// 제조 단계 태그, 고객 안전 필드, pH/제조 절차/메모 정제,
// 포뮬러 JSON 내보내기·가져오기 왕복을 고정한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

function createMockStorage() {
  const store = {};
  return {
    getItem(key) { return key in store ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    get length() { return Object.keys(store).length; },
    key(i) { return Object.keys(store)[i] ?? null; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
    _store: store,
  };
}

let store;
let originalLocalStorage;

beforeEach(async () => {
  originalLocalStorage = global.localStorage;
  Object.defineProperty(global, 'localStorage', {
    value: createMockStorage(),
    configurable: true,
    writable: true,
  });
  const suffix = `?t=${Date.now()}-${Math.random()}`;
  store = {
    formula: await import(`../../src/formula-store.js${suffix}`),
    rules: await import(`../../src/formula-rules.js${suffix}`),
  };
});

afterEach(() => {
  Object.defineProperty(global, 'localStorage', {
    value: originalLocalStorage,
    configurable: true,
    writable: true,
  });
});

// ---------- FO-03: 제조 단계(Phase) 태그 ----------

test('FO-03: PHASE_OPTIONS이 6단계를 정의한다', () => {
  const opts = store.formula.PHASE_OPTIONS;
  assert.deepEqual([...opts], ['수상부', '유상부', '실리콘부', '기능성', '후첨가', '기타']);
});

test('FO-03: 원료의 phase는 허용 단계로 정제되고 잘못된 값은 버려진다', () => {
  const r = store.formula.createFormula({
    name: '테스트',
    ingredients: [
      { name: '정제수', phase: '수상부' },
      { name: '가짜원료', phase: '마법부' },
    ],
  });
  assert.ok(r.ok);
  const ings = r.formula.ingredients;
  assert.equal(ings[0].phase, '수상부');
  assert.equal(ings[1].phase, '', '허용 외 phase는 빈 값으로 정제');
});

test('FO-03: 추천 규칙의 역할→단계 매핑(ROLE_PHASE)이 PHASE_OPTIONS와 정합하다', () => {
  const { ROLE_PHASE } = store.rules;
  for (const [role, phase] of Object.entries(ROLE_PHASE)) {
    assert.ok(store.formula.PHASE_OPTIONS.includes(phase), `role ${role}의 phase '${phase}'가 PHASE_OPTIONS에 없음`);
  }
});

// ---------- FO-04: 고객 정보·안전 필드 ----------

test('FO-04: 고객 필드(피부·제형·고민·알레르기·임신수유·사용 제품)가 정제 보존된다', () => {
  const r = store.formula.createFormula({
    name: '고객포함',
    customer: {
      name: '김고객',
      age: 34,
      gender: '여성',
      skinType: '민감성',
      concerns: ['진정', '건조'],
      formulation: '로션·에멀전',
      allergies: ['파라벤', '향료'],
      pregnancy: '임신 중',
      products: '레티놀 세럼',
      bogus: 'DROP TABLE',
    },
  });
  assert.ok(r.ok);
  const c = r.formula.customer;
  assert.equal(c.name, '김고객');
  assert.equal(c.age, 34);
  assert.equal(c.skinType, '민감성');
  assert.deepEqual(c.concerns, ['진정', '건조']);
  assert.equal(c.formulation, '로션·에멀전');
  assert.deepEqual(c.allergies, ['파라벤', '향료']);
  assert.equal(c.pregnancy, '임신 중');
  assert.equal(c.products, '레티놀 세럼');
  assert.equal(c.bogus, undefined, '비스키마 필드는 제거');
});

test('FO-04: 허용 외 enum 값과 빈 고객 객체는 정제된다', () => {
  const r = store.formula.createFormula({
    name: 'x',
    customer: { skinType: '외계인피부', gender: '기타3' },
  });
  assert.ok(r.ok);
  assert.equal(r.formula.customer, null, '모든 필드가 무효면 고객 객체 부재');
});

test('FO-04: 알레르기 이력은 최대 개수·길이로 제한된다', () => {
  const r = store.formula.createFormula({
    name: 'x',
    customer: { name: 'A', allergies: Array.from({ length: 50 }, (_, i) => `알레르기${i}`) },
  });
  assert.ok(r.ok);
  assert.ok(r.formula.customer.allergies.length <= 20, '알레르기 최대 20개');
});

// ---------- FO-07: 제조 정보 (pH·절차·메모) ----------

test('FO-07: 목표/실측 pH는 0~14 범위로 정제된다', () => {
  const r = store.formula.createFormula({
    name: 'pH테스트',
    phTarget: 5.5,
    phActual: 99,
    notes: '제조 메모',
  });
  assert.ok(r.ok);
  assert.equal(r.formula.phTarget, 5.5);
  assert.equal(r.formula.phActual, null, '범위 밖 pH는 null');
  assert.equal(r.formula.notes, '제조 메모');
});

test('FO-07: 제조 절차 단계는 최대 20개로 제한되고 공백 단계는 제거된다', () => {
  const steps = Array.from({ length: 30 }, (_, i) => `단계 ${i + 1}`);
  steps[3] = '   ';
  const r = store.formula.createFormula({ name: 'x', steps });
  assert.ok(r.ok);
  assert.ok(r.formula.steps.length <= 20, `steps ≤ 20 (실제 ${r.formula.steps.length})`);
  assert.ok(r.formula.steps.every(s => s.trim().length > 0), '빈 단계 제거');
});

// ---------- FO-09: JSON 내보내기·가져오기 ----------

test('FO-09: serializeFormula → importFormula 왕복이 필드를 보존하고 새 ID를 부여한다', () => {
  const created = store.formula.createFormula({
    name: '왕복 테스트',
    targetVolume: 100,
    unit: 'g',
    phTarget: 6,
    steps: ['수상부 가열', '유상부 가열', '유화'],
    ingredients: [{ name: '정제수', concentration: 70, phase: '수상부' }],
    customer: { name: '김고객', skinType: '건성' },
  });
  assert.ok(created.ok);

  const json = store.formula.serializeFormula(created.formula);
  const parsed = JSON.parse(json);
  assert.equal(parsed.type, 'formula-os');
  assert.equal(parsed.version, 1);

  const imported = store.formula.importFormula(json);
  assert.ok(imported.ok);
  const f = imported.formula;
  assert.notEqual(f.id, created.formula.id, '가져오기는 새 ID 부여');
  assert.equal(f.name, '왕복 테스트');
  assert.equal(f.targetVolume, 100);
  assert.deepEqual(f.steps, ['수상부 가열', '유상부 가열', '유화']);
  assert.equal(f.customer.name, '김고객');
  assert.equal(f.ingredients[0].phase, '수상부');
});

test('FO-09: 잘못된 JSON과 비포뮬러 데이터를 거부한다', () => {
  assert.equal(store.formula.importFormula('{{{').ok, false);
  assert.equal(store.formula.importFormula('{"foo": 1}').ok, false);
  assert.equal(store.formula.importFormula('[1,2,3]').ok, false);
});

// ---------- FO-08/FO-23 맥락: 저장 한도 게이트 (기존 커버 보강) ----------

test('FO 한도: getFormulaUsage가 Free 한도(5개) 기준 canCreate를 보고한다', () => {
  const u0 = store.formula.getFormulaUsage();
  assert.equal(u0.limit, 5);
  assert.equal(u0.canCreate, true);
  for (let i = 0; i < 5; i++) {
    assert.ok(store.formula.createFormula({ name: `f${i}` }).ok);
  }
  const u5 = store.formula.getFormulaUsage();
  assert.equal(u5.canCreate, false);
  const r = store.formula.createFormula({ name: 'over' });
  assert.equal(r.ok, false, '한도 초과 저장 거부');
});
