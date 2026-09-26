// src/whats-new.js — 새 버전 알림 순수 로직 테스트.
// collectNewEntries의 버전 비교·집계·상한·폴백 불변식을 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectNewEntries } from '../../src/whats-new.js';

const NOTES = [
  { version: 'v3-20260103-ccc', date: '2026-01-03', notes: ['세 번째'] },
  { version: 'v2-20260102-bbb', date: '2026-01-02', notes: ['두 번째'] },
  { version: 'v1-20260101-aaa', date: '2026-01-01', notes: ['첫 번째'] },
];

test('collectNewEntries: lastSeen 이후 배포분만 반환', () => {
  const out = collectNewEntries(NOTES, 'v1-20260101-aaa');
  assert.deepEqual(out.map(e => e.version), ['v3-20260103-ccc', 'v2-20260102-bbb']);
});

test('collectNewEntries: lastSeen이 최신이면 빈 배열', () => {
  assert.deepEqual(collectNewEntries(NOTES, 'v3-20260103-ccc'), []);
});

test('collectNewEntries: lastSeen이 목록에 없으면 최근 3버전까지', () => {
  const five = [
    { version: 'v5', notes: ['5'] }, { version: 'v4', notes: ['4'] },
    { version: 'v3', notes: ['3'] }, { version: 'v2', notes: ['2'] },
    { version: 'v1', notes: ['1'] },
  ];
  const out = collectNewEntries(five, 'v-없는버전');
  assert.deepEqual(out.map(e => e.version), ['v5', 'v4', 'v3']);
});

test('collectNewEntries: pending 항목(버전 없음)은 제외', () => {
  const withPending = [{ pending: true, notes: ['초안'] }, ...NOTES];
  const out = collectNewEntries(withPending, null);
  assert.ok(out.every(e => e.version));
  assert.equal(out.length, 3);
});

test('collectNewEntries: notes가 비어있으면 폴백 문구 삽입', () => {
  const out = collectNewEntries([{ version: 'v9', notes: [] }], null);
  assert.equal(out[0].notes.length, 1);
  assert.match(out[0].notes[0], /개선|안정성/);
});

test('collectNewEntries: 항목 수 상한 10 적용', () => {
  const many = { version: 'v9', notes: Array.from({ length: 15 }, (_, i) => `n${i}`) };
  const out = collectNewEntries([many], null);
  assert.equal(out[0].notes.length, 10);
});

test('collectNewEntries: 빈 입력은 빈 배열', () => {
  assert.deepEqual(collectNewEntries([], 'v1'), []);
  assert.deepEqual(collectNewEntries(null, 'v1'), []);
});
