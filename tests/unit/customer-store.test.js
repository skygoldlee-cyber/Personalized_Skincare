// tests/unit/customer-store.test.js
// src/customer-store.js — 고객 카드·상담 이력 영속성 계층 테스트.
// CRUD·상담 이력 append-only·참조 해제(unlinkCustomerFromFormulas)를 고정한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMER_LIMIT_FREE,
  SCALP_OPTIONS,
  listCustomers,
  getCustomer,
  getCustomerUsage,
  createCustomer,
  updateCustomer,
  addConsultLog,
  deleteCustomer,
} from '../../src/customer-store.js';
import {
  createFormula, getFormula, unlinkCustomerFromFormulas,
} from '../../src/formula-store.js';

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
  name: '김OO',
  age: 32,
  gender: '여성',
  skinType: '건성',
  scalpType: '지성',
  concerns: ['건조', '주름·탄력'],
  allergies: ['파라벤'],
  pregnancy: '',
  products: '레티놀 세럼',
  purpose: '데일리 수분 케어',
  notes: '민감 피부',
});

test('createCustomer — 이름 필수·id 부여', () => {
  assert.equal(createCustomer({}).ok, false);
  const r = createCustomer(sample());
  assert.equal(r.ok, true);
  assert.ok(r.customer.id.startsWith('cust_'));
  assert.equal(r.customer.name, '김OO');
});

test('sanitize — 열거형·목록 필드 정제', () => {
  const r = createCustomer({
    ...sample(),
    gender: '기타',                    // 허용값 아님 → ''
    scalpType: '두피',                  // 허용값 아님 → ''
    concerns: ['건조', '없는고민'],       // 허용 목록 외 제거
    age: 'abc',                        // → null
  });
  const c = r.customer;
  assert.equal(c.gender, '');
  assert.equal(c.scalpType, '');
  assert.deepEqual(c.concerns, ['건조']);
  assert.equal(c.age, null);
});

test('updateCustomer — 상담 이력 보존 (폼이 덮어쓰지 못함)', () => {
  const r = createCustomer(sample());
  addConsultLog(r.customer.id, '첫 방문 상담', '2026-09-20');
  const u = updateCustomer(r.customer.id, { ...sample(), consultLog: [], name: '김OO(수정)' });
  assert.equal(u.ok, true);
  const c = getCustomer(r.customer.id);
  assert.equal(c.name, '김OO(수정)');
  assert.equal(c.consultLog.length, 1); // 폼의 빈 배열로 덮어쓰지 않음
});

test('addConsultLog — append-only·날짜 기본값·정렬 불변', () => {
  const r = createCustomer(sample());
  const id = r.customer.id;
  assert.equal(addConsultLog(id, '').ok, false); // 빈 내용 거부
  addConsultLog(id, '건조함 호소', '2026-09-10');
  addConsultLog(id, '세럼 조제 완료', '2026-09-22');
  const c = getCustomer(id);
  assert.equal(c.consultLog.length, 2);
  assert.equal(c.consultLog[0].date, '2026-09-10');
  assert.equal(c.consultLog[1].text, '세럼 조제 완료');
  // 잘못된 날짜 형식 → 오늘 날짜로 대체
  const r2 = addConsultLog(id, '오늘 기록', 'bad-date');
  assert.equal(r2.ok, true);
  assert.match(r2.customer.consultLog[2].date, /^\d{4}-\d{2}-\d{2}$/);
});

test('listCustomers — updatedAt 내림차순', () => {
  const a = createCustomer(sample());
  const b = createCustomer({ ...sample(), name: '이OO' });
  updateCustomer(a.customer.id, { ...sample(), name: '김OO(갱신)' });
  const list = listCustomers();
  assert.equal(list[0].name, '김OO(갱신)');
});

test('deleteCustomer — 고객 삭제', () => {
  const r = createCustomer(sample());
  assert.equal(deleteCustomer(r.customer.id).ok, true);
  assert.equal(getCustomer(r.customer.id), null);
});

test('포뮬러 참조 — customerId 저장·고객 삭제 시 인라인 스냅샷만 남김', () => {
  const c = createCustomer(sample()).customer;
  const f = createFormula({
    name: '수분 세럼',
    customer: sample(),
    customerId: c.id,
  }).formula;
  assert.equal(getFormula(f.id).customerId, c.id);

  // 고객 삭제 → 참조 해제 + 인라인 customer 보존
  const touched = unlinkCustomerFromFormulas(c.id);
  assert.equal(touched, 1);
  const after = getFormula(f.id);
  assert.equal(after.customerId, '');
  assert.equal(after.customer.name, '김OO'); // 인라인 스냅샷 보존
});

test('getCustomerUsage — 한도 표시', () => {
  const u = getCustomerUsage();
  assert.equal(u.limit, CUSTOMER_LIMIT_FREE);
  assert.equal(u.canCreate, true);
});

test('SCALP_OPTIONS — 두피 유형 상수', () => {
  assert.deepEqual([...SCALP_OPTIONS], ['건성', '지성', '민감성', '정상']);
});
