// tests/unit/error-telemetry.test.js
// @spec none (텔레메트리 자체 검증 — 관측성 인프라)
// src/error-telemetry.js — 페이로드 구성·중복 억제·세션 상한·미설정/실패 경로

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildErrorPayload, reportClientError, initErrorTelemetry, _resetTelemetryForTest,
} from '../../src/error-telemetry.js';

beforeEach(() => _resetTelemetryForTest());

// ── 페이로드 ────────────────────────────────────────────────

test('buildErrorPayload: Error → message/stack/kind 채움, 길이 상한', () => {
  const err = new TypeError('boom'.repeat(200));
  const p = buildErrorPayload('error', err, { view: 'quiz', filename: 'app.js', lineno: 7 });
  assert.equal(p.kind, 'error');
  assert.ok(p.message.length <= 500);
  assert.ok(p.stack.includes('TypeError'));
  assert.equal(p.view, 'quiz');
  assert.equal(p.meta.filename, 'app.js');
  assert.equal(p.meta.lineno, 7);
});

test('buildErrorPayload: 비-Error 값도 문자열화, kind 비정상값은 error로 정규화', () => {
  const p = buildErrorPayload('weird', 'plain string');
  assert.equal(p.kind, 'error');
  assert.equal(p.message, 'plain string');
  assert.equal(p.stack, null);
});

// ── 전송 ────────────────────────────────────────────────────

test('reportClientError: insert 성공 → sent, 같은 오류 재전송 → dup', async () => {
  const rows = [];
  const insert = async (r) => { rows.push(...r); return {}; };
  const err = new Error('same');
  assert.equal(await reportClientError('error', err, {}, { insert }), 'sent');
  assert.equal(await reportClientError('error', err, {}, { insert }), 'dup');
  assert.equal(rows.length, 1);
});

test('reportClientError: 세션 상한 — 10건 초과는 capped', async () => {
  const insert = async () => ({});
  let last = '';
  for (let i = 0; i < 12; i++) {
    last = await reportClientError('error', new Error(`e${i}`), {}, { insert });
  }
  assert.equal(last, 'capped');
});

test('reportClientError: 미설정(disabled)·전송 실패·예외도 throw 없이 상태 반환', async () => {
  assert.equal(await reportClientError('error', new Error('x'), {}, { insert: async () => ({ disabled: true }) }), 'disabled');
  _resetTelemetryForTest();
  assert.equal(await reportClientError('error', new Error('x'), {}, { insert: async () => ({ error: new Error('db') }) }), 'failed');
  _resetTelemetryForTest();
  assert.equal(await reportClientError('error', new Error('x'), {}, { insert: async () => { throw new Error('net'); } }), 'failed');
});

// ── 리스너 설치 ─────────────────────────────────────────────

test('initErrorTelemetry: error/unhandledrejection 리스너 등록 + 이중 설치 방지', () => {
  const handlers = {};
  const fakeWin = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    location: { pathname: '/x' },
  };
  initErrorTelemetry(fakeWin);
  initErrorTelemetry(fakeWin); // 이중 호출 무시
  assert.equal(typeof handlers.error, 'function');
  assert.equal(typeof handlers.unhandledrejection, 'function');

  // 리스너 발화가 절대 throw하지 않음 (전송 실패도 흡수)
  handlers.error({ error: new ReferenceError('r'), filename: 'a.js', lineno: 1 });
  handlers.error({}); // error 없는 스크립트 로드 실패 — 무시 경로
  handlers.unhandledrejection({ reason: new TypeError('p') });
  handlers.unhandledrejection({ reason: null }); // reason 없음 — 무시
});
