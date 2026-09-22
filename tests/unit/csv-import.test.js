// tests/unit/csv-import.test.js
// src/csv-utils.js 파서·인코딩 + 고객/원료 CSV 가져오기(importCustomers·importMaterials)
// 정합성 테스트 — 중복 건너뜀·한도·sanitize 경유를 고정한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv, csvToObjects, decodeCsvBuffer, toCsv,
} from '../../src/csv-utils.js';
import {
  importCustomers, listCustomers, CUSTOMER_LIMIT_FREE,
} from '../../src/customer-store.js';
import {
  importMaterials, listMaterials, MATERIAL_LIMIT_FREE, createMaterial,
} from '../../src/material-ledger.js';
import {
  CUST_CSV_COLS, CUST_CSV_HEADERS, csvRowToCustomer,
} from '../../src/views/formula-customer.js';
import {
  MAT_CSV_COLS, MAT_CSV_HEADERS, csvRowToMaterial,
} from '../../src/views/formula-material.js';

// --- localStorage 모킹 (customer-store.test.js와 동일 패턴) ---

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

/* =======================================================
   parseCsv
   ======================================================= */

test('parseCsv — 기본 행과 빈 행 제거', () => {
  const rows = parseCsv('a,b\n1,2\n\n3,4\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', '2'], ['3', '4']]);
});

test('parseCsv — 따옴표 필드 내 쉼표·개행·"" 이스케이프', () => {
  const rows = parseCsv('name,note\n"김,철수","line1\nline2"\n"say ""hi""",x');
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], '김,철수');
  assert.equal(rows[1][1], 'line1\nline2');
  assert.equal(rows[2][0], 'say "hi"');
});

test('parseCsv — 구분자 자동 감지 (탭·세미콜론)', () => {
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('parseCsv — CRLF 처리', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('decodeCsvBuffer — UTF-8 BOM 제거', () => {
  const src = '﻿이름,나이\n김,30';
  const buf = new TextEncoder().encode(src).buffer;
  assert.equal(decodeCsvBuffer(buf), '이름,나이\n김,30');
});

test('decodeCsvBuffer — EUC-KR 폴백 (깨진 UTF-8 바이트)', () => {
  // '가' = EUC-KR 0xB0 0xA1 — UTF-8로는 해석 불가 → 폴백
  const buf = new Uint8Array([0xB0, 0xA1]).buffer;
  assert.equal(decodeCsvBuffer(buf), '가');
});

test('csvToObjects — 헤더 정규화(공백·대소문자) + 별칭 매핑', () => {
  const rows = parseCsv(' Name , 피부 타입 ,나이\n김OO,건성,30');
  const objs = csvToObjects(rows, CUST_CSV_COLS);
  assert.equal(objs.length, 1);
  assert.equal(objs[0].name, '김OO');
  assert.equal(objs[0].skinType, '건성');
  assert.equal(objs[0].age, '30');
});

test('csvToObjects — 매핑 불가 헤더만 있으면 빈 배열', () => {
  assert.deepEqual(csvToObjects(parseCsv('foo,bar\n1,2'), CUST_CSV_COLS), []);
});

test('toCsv — BOM 선두·쉼표 이스케이프·CRLF', () => {
  const csv = toCsv(['이름', '메모'], [{ n: 'a' }], r => ['김,OO', 'say "hi"']);
  assert.ok(csv.charCodeAt(0) === 0xFEFF);
  assert.ok(csv.includes('"김,OO"'));
  assert.ok(csv.includes('"say ""hi"""'));
  assert.ok(csv.includes('\r\n'));
});

/* =======================================================
   고객 CSV 가져오기
   ======================================================= */

test('csvRowToCustomer — 목록 분리·임신 정규화', () => {
  const c = csvRowToCustomer({
    name: '김OO', concerns: '건조;민감·홍조', allergies: '파라벤|향료',
    pregnancy: '임신', age: '30',
  });
  assert.deepEqual(c.concerns, ['건조', '민감·홍조']);
  assert.deepEqual(c.allergies, ['파라벤', '향료']);
  assert.equal(c.pregnancy, '임신 중');
});

test('importCustomers — 신규 추가·중복 건너뜀·이름 없음 제외', () => {
  const st = importCustomers([
    csvRowToCustomer({ name: '김OO', skinType: '건성' }),
    csvRowToCustomer({ name: '김OO' }),            // 파일 내 중복
    csvRowToCustomer({ name: '', age: '20' }),      // 이름 없음 → skipped
    csvRowToCustomer({ name: '이OO' }),
  ]);
  assert.equal(st.added, 2);
  assert.equal(st.duplicate, 1);
  assert.equal(st.skipped, 1);
  assert.equal(listCustomers().length, 2);
  // 재가져오기 → 기존과 중복
  const st2 = importCustomers([csvRowToCustomer({ name: '김OO' })]);
  assert.equal(st2.duplicate, 1);
  assert.equal(st2.added, 0);
});

test('importCustomers — sanitize 경유 (옵션 외 값·길이 제한)', () => {
  const st = importCustomers([csvRowToCustomer({
    name: 'A'.repeat(50), skinType: '존재하지않는타입', concerns: '건조;없는고민',
  })]);
  assert.equal(st.added, 1);
  const c = listCustomers()[0];
  assert.ok(c.name.length <= 30);
  assert.equal(c.skinType, '');
  assert.deepEqual(c.concerns, ['건조']);
});

test('importCustomers — 한도 초과분 제외', () => {
  const rows = Array.from({ length: CUSTOMER_LIMIT_FREE + 3 }, (_, i) =>
    csvRowToCustomer({ name: `고객${i}` }));
  const st = importCustomers(rows);
  assert.equal(st.added, CUSTOMER_LIMIT_FREE);
  assert.equal(st.overLimit, 3);
});

/* =======================================================
   원료 CSV 가져오기
   ======================================================= */

test('csvRowToMaterial — 날짜 표기 정규화', () => {
  const m = csvRowToMaterial({ name: '글리세린', expiryAt: '2026.3.5', receivedAt: '2025/01/09' });
  assert.equal(m.expiryAt, '2026-03-05');
  assert.equal(m.receivedAt, '2025-01-09');
});

test('importMaterials — 원료명+LOT 중복 건너뜀', () => {
  createMaterial({ name: '글리세린', lot: 'L01' });
  const st = importMaterials([
    csvRowToMaterial({ name: '글리세린', lot: 'L01' }),  // 중복
    csvRowToMaterial({ name: '글리세린', lot: 'L02' }),  // 이름 같아도 LOT 다름 → 추가
    csvRowToMaterial({ name: '', qty: '10' }),            // 이름 없음
    csvRowToMaterial({ name: '히알루론산' }),
  ]);
  assert.equal(st.added, 2);
  assert.equal(st.duplicate, 1);
  assert.equal(st.skipped, 1);
  assert.equal(listMaterials().length, 3);
});

test('importMaterials — 한도 초과분 제외', () => {
  const rows = Array.from({ length: MATERIAL_LIMIT_FREE + 2 }, (_, i) =>
    csvRowToMaterial({ name: `원료${i}` }));
  const st = importMaterials(rows);
  assert.equal(st.added, MATERIAL_LIMIT_FREE);
  assert.equal(st.overLimit, 2);
});

test('CSV 왕복 —보내기 출력을 다시 가져오면 헤더가 매핑됨', () => {
  const csv = toCsv([...CUST_CSV_HEADERS], [{ name: '김OO' }], () =>
    ['김OO', '30', '여성', '건성', '지성', '건조;민감·홍조', '파라벤', '임신 중', '세럼', '목적', '메모']);
  const rows = csvToObjects(parseCsv(csv.slice(1)), CUST_CSV_COLS); // BOM 제외
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, '김OO');
  assert.equal(rows[0].concerns, '건조;민감·홍조');

  const mcsv = toCsv([...MAT_CSV_HEADERS], [{}], () =>
    ['글리세린', 'L01', '2025-01-01', '2026-01-01', '실온', '500', 'g', '']);
  const mrows = csvToObjects(parseCsv(mcsv.slice(1)), MAT_CSV_COLS);
  assert.equal(mrows[0].name, '글리세린');
  assert.equal(mrows[0].lot, 'L01');
});
