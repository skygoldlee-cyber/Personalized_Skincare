// src/storage.js — 저장소 추상화 계층 테스트.
// 스코프 적용·JSON 헬퍼·쓰기 훅·백엔드 교체(비동기 전용 백엔드 포함)의 불변식을 고정한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalStorageBackend,
  setStorageBackend,
  getStorageBackend,
  getItem,
  setItem,
  removeItem,
  removeItemRaw,
  listKeys,
  getJSON,
  setJSON,
  getItemAsync,
  setItemAsync,
  removeItemAsync,
  listKeysAsync,
  getJSONAsync,
  setJSONAsync,
  setDataWriteHook,
  setMany,
  setJSONMany,
  isStorageUnavailable,
} from '../../src/storage.js';

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

let mockStorage;
let originalLocalStorage;
let originalBackend;

beforeEach(() => {
  mockStorage = createMockStorage();
  originalLocalStorage = global.localStorage;
  Object.defineProperty(global, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
  originalBackend = getStorageBackend();
  setStorageBackend(createLocalStorageBackend());
  setDataWriteHook(null);
});

afterEach(() => {
  setStorageBackend(originalBackend);
  setDataWriteHook(null);
  Object.defineProperty(global, 'localStorage', {
    value: originalLocalStorage,
    configurable: true,
    writable: true,
  });
});

test('setItem은 논리 키에 시험 접두사를 적용해 저장한다', () => {
  setItem('fc_weak', 'x');
  const keys = Object.keys(mockStorage._store);
  assert.equal(keys.length, 1);
  assert.ok(keys[0].endsWith(':fc_weak'), `스코프된 키여야 함: ${keys[0]}`);
  assert.equal(getItem('fc_weak'), 'x');
});

test('GLOBAL_KEYS(appTheme)는 접두사 없이 저장된다', () => {
  setItem('appTheme', 'dark');
  assert.equal(mockStorage._store['appTheme'], 'dark');
});

test('getJSON/setJSON이 객체를 왕복한다', () => {
  assert.equal(setJSON('study_goals', { dailyCards: 50 }), true);
  assert.deepEqual(getJSON('study_goals'), { dailyCards: 50 });
});

test('getJSON은 파싱 실패·부재 시 fallback을 반환한다', () => {
  assert.equal(getJSON('no_such_key'), null);
  assert.equal(getJSON('no_such_key', 7), 7);
  mockStorage._store['cosmetic:broken'] = '{not json';
  assert.equal(getJSON('broken', 'fb'), 'fb');
});

test('setItem 성공 시 데이터 쓰기 훅이 논리 키로 호출된다', () => {
  const seen = [];
  setDataWriteHook((k) => seen.push(k));
  setItem('quiz_results', '[]');
  assert.deepEqual(seen, ['quiz_results']);
});

test('listKeys는 현재 시험 네임스페이스의 실제 키만 반환한다', () => {
  mockStorage._store['cosmetic:daily_completed_2026-01-01'] = '1';
  mockStorage._store['other:daily_completed_2026-01-01'] = '1';
  mockStorage._store['appTheme'] = 'dark';
  const keys = listKeys((u) => u.startsWith('daily_completed_'));
  assert.deepEqual(keys, ['cosmetic:daily_completed_2026-01-01']);
});

test('removeItemRaw는 이미 스코프된 실제 키를 그대로 삭제한다', () => {
  setItem('daily_completed_2026-01-01', '1');
  const raw = listKeys((u) => u.startsWith('daily_completed_'))[0];
  removeItemRaw(raw);
  assert.equal(listKeys((u) => u.startsWith('daily_completed_')).length, 0);
});

test('비동기 전용 백엔드로 교체하면 Async API는 동작하고 동기 API는 null/false다', async () => {
  const mem = new Map();
  setStorageBackend({
    name: 'async-only',
    sync: false,
    async getItemAsync(k) { return mem.has(k) ? mem.get(k) : null; },
    async setItemAsync(k, v) { mem.set(k, String(v)); },
    async removeItemAsync(k) { mem.delete(k); },
    async keysAsync() { return [...mem.keys()]; },
  });

  assert.equal(getItem('fc_weak'), null);          // 동기 API는 미지원 → null
  assert.equal(setItem('fc_weak', 'x'), false);    // 동기 쓰기도 불가
  assert.equal(await setItemAsync('fc_weak', 'x'), true);
  assert.equal(await getItemAsync('fc_weak'), 'x');
  assert.ok([...mem.keys()][0].endsWith(':fc_weak'));
  await removeItemAsync('fc_weak');
  assert.equal(await getItemAsync('fc_weak'), null);
});

test('Async API도 쓰기 훅과 listKeys 필터가 동일하게 적용된다', async () => {
  const seen = [];
  setDataWriteHook((k) => seen.push(k));
  await setJSONAsync('quiz_results', [1, 2]);
  assert.deepEqual(seen, ['quiz_results']);
  assert.deepEqual(await getJSONAsync('quiz_results'), [1, 2]);
  assert.deepEqual(await listKeysAsync((u) => u === 'quiz_results'), ['cosmetic:quiz_results']);
});

test('setMany 중간 실패 시 이미 쓴 키를 이전 값으로 복원한다', () => {
  const mem = new Map();
  mem.set('cosmetic:existing', 'old');   // 덮어쓰기 대상 기존값
  let calls = 0;
  setStorageBackend({
    name: 'fail-on-third-write',
    sync: true,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      calls++;
      if (calls === 3) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      mem.set(k, String(v));
    },
    removeItem: (k) => mem.delete(k),
    keys: () => [...mem.keys()],
  });

  // 쓰기 순서: new_key(성공) → existing(성공) → failing_key(실패 → 롤백)
  const ok = setMany({ new_key: 'A', existing: 'new', failing_key: 'B' });
  assert.equal(ok, false);
  assert.equal(mem.has('cosmetic:new_key'), false);        // 없던 키는 삭제로 복원
  assert.equal(mem.get('cosmetic:existing'), 'old');       // 기존 키는 이전 값으로 복원
  assert.equal(mem.has('cosmetic:failing_key'), false);    // 실패한 키는 기록되지 않음
});

test('setMany 전체 성공 경로', () => {
  const ok = setJSONMany({ a_key: { x: 1 }, b_key: [1, 2] });
  assert.equal(ok, true);
  assert.deepEqual(getJSON('a_key'), { x: 1 });
  assert.deepEqual(getJSON('b_key'), [1, 2]);
});

test('쓰기 실패 시 false를 반환하고 unavailable 플래그가 선다', () => {
  setStorageBackend({
    name: 'failing',
    sync: true,
    getItem() { return null; },
    setItem() { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; },
    removeItem() {},
    keys() { return []; },
  });
  assert.equal(setItem('k', 'v'), false);
  assert.equal(isStorageUnavailable(), true);
});
