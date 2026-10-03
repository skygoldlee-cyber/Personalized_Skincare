// tests/unit/exams/cosmetic/custom-ingredient-store.test.js
// @spec DI-06,DI-07,DI-08
// custom-ingredient-store.js — 자가 등록 성분 스토어 + formula-check 커스텀 분기.
// 검증: CRUD·정제, 공식/커스텀 동명 충돌 차단(정규화), _superseded 주석,
//       한도 초과/이내/미선언 판정과 custom 플래그.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOM_INGREDIENT_LIMIT_FREE,
  listCustomIngredients,
  getCustomIngredient,
  getCustomIngredientUsage,
  annotateCustomItems,
  createCustomIngredient,
  updateCustomIngredient,
  deleteCustomIngredient,
} from '../../../../src/exams/cosmetic/custom-ingredient-store.js';
import { buildIngredientIndex, checkIngredient, CHECK } from '../../../../src/exams/cosmetic/formula-check.js';

function createMockStorage() {
  const store = {};
  return {
    getItem(key) { return key in store ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
  };
}

let mockStorage;
let originalLocalStorage;

const OFFICIAL = [
  { name: '정제수', engName: 'Water', type: 'approved', limit: '' },
  { name: '살리실산', engName: 'Salicylic Acid', type: 'restricted', limit: '2.0%' },
];

function officialIndex() {
  return buildIngredientIndex(OFFICIAL);
}

beforeEach(() => {
  mockStorage = createMockStorage();
  originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = mockStorage;
});

afterEach(() => {
  globalThis.localStorage = originalLocalStorage;
});

test('등록 → 목록·단건 조회, type은 custom 고정·custom:true 마커', () => {
  const r = createCustomIngredient({ name: '자체 베이스 A', engName: 'Base A', category: '베이스', limit: '5.0%' });
  assert.equal(r.ok, true);
  assert.equal(r.item.type, 'custom');
  assert.equal(r.item.custom, true);
  assert.ok(r.item.id.startsWith('cing_'));
  assert.equal(listCustomIngredients().length, 1);
  assert.equal(getCustomIngredient(r.item.id).name, '자체 베이스 A');
});

test('공식 DB 동명 차단 — 대소문자·공백 정규화 비교 (DI-08)', () => {
  const idx = officialIndex();
  // 정확 동명
  assert.equal(createCustomIngredient({ name: '살리실산' }, { officialIndex: idx }).ok, false);
  // 공백·대소문자 정규화 동명
  const r = createCustomIngredient({ name: ' Salicylic   Acid ' }, { officialIndex: idx });
  // engName이 아니라 name 기준이라 이건 통과해야 함 — name 'Salicylic Acid'는 공식 name '살리실산'과 다름
  assert.equal(r.ok, true);
});

test('공식 동명 정규화 — 공백 차이 이름도 차단', () => {
  const idx = buildIngredientIndex([{ name: '정제수 A', type: 'approved' }]);
  const r = createCustomIngredient({ name: '정제수  A' }, { officialIndex: idx });
  assert.equal(r.ok, false);
  assert.match(r.error, /공식 DB/);
});

test('커스텀 중복 차단 + 수정 시 자기 자신은 제외', () => {
  const r = createCustomIngredient({ name: '베이스X' });
  assert.equal(r.ok, true);
  assert.equal(createCustomIngredient({ name: '베이스X ' }).ok, false);
  const u = updateCustomIngredient(r.item.id, { name: '베이스X', limit: '3%' });
  assert.equal(u.ok, true);
  assert.equal(u.item.limit, '3%');
});

test('수정 — 다른 항목과 충돌하는 이름은 거부', () => {
  createCustomIngredient({ name: '베이스A' });
  const b = createCustomIngredient({ name: '베이스B' });
  const u = updateCustomIngredient(b.item.id, { name: '베이스A' });
  assert.equal(u.ok, false);
  assert.match(u.error, /이미 등록/);
});

test('삭제 — 존재하지 않는 id는 실패', () => {
  const r = createCustomIngredient({ name: '삭제대상' });
  assert.equal(deleteCustomIngredient(r.item.id).ok, true);
  assert.equal(deleteCustomIngredient(r.item.id).ok, false);
});

test('저장 한도 — FREE 한도 초과 시 실패', () => {
  for (let i = 0; i < CUSTOM_INGREDIENT_LIMIT_FREE; i++) {
    assert.equal(createCustomIngredient({ name: `원료${i}` }).ok, true);
  }
  assert.equal(getCustomIngredientUsage().count, CUSTOM_INGREDIENT_LIMIT_FREE);
  const r = createCustomIngredient({ name: '초과원료' });
  assert.equal(r.ok, false);
  assert.match(r.error, /최대/);
});

test('annotateCustomItems — 공식 동명 커스텀은 _superseded (DI-08)', () => {
  createCustomIngredient({ name: '신원료A' });
  createCustomIngredient({ name: '살리실산' }); // 공식 없던 시점에 등록됐다 가정 — 직접 삽입
  // 공식에 '살리실산'이 있으므로 annotate에서 superseded 여야 한다
  const idx = officialIndex();
  const annotated = annotateCustomItems(idx);
  const byName = Object.fromEntries(annotated.map(i => [i.name, i._superseded]));
  assert.equal(byName['신원료A'], false);
  assert.equal(byName['살리실산'], true);
});

test('checkIngredient — 커스텀: 한도 미선언 → OK + custom 플래그 (DI-07)', () => {
  const r = checkIngredient({ name: '자체원료', type: 'custom', custom: true, limit: '' }, 5);
  assert.equal(r.check, CHECK.OK);
  assert.equal(r.custom, true);
  assert.match(r.note, /자가 등록/);
});

test('checkIngredient — 커스텀: 자가 한도 초과 → WARN, 이내 → OK (DI-07)', () => {
  const ing = { name: '자체원료', type: 'custom', custom: true, limit: '2.0%' };
  const over = checkIngredient(ing, 3);
  assert.equal(over.check, CHECK.WARN);
  assert.equal(over.custom, true);
  assert.match(over.note, /자가 등록 한도/);
  const within = checkIngredient(ing, 1.5);
  assert.equal(within.check, CHECK.OK);
  assert.equal(within.custom, true);
  assert.match(within.note, /자가 등록 한도 이내/);
});

test('checkIngredient — 커스텀은 banned 텍스트가 있어도 banned 판정 안 됨 (DI-07)', () => {
  const r = checkIngredient({ name: '자체원료', type: 'custom', custom: true, limit: '사용 금지' }, 1);
  assert.notEqual(r.check, CHECK.BANNED);
  assert.equal(r.custom, true);
});

test('checkIngredient — 공식 항목은 custom 플래그 없음 (회귀)', () => {
  const r = checkIngredient(OFFICIAL[1], 1);
  assert.equal(r.check, CHECK.OK);
  assert.equal(r.custom, undefined);
});
