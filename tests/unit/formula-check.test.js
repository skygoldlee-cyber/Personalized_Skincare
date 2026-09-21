// tests/unit/formula-check.test.js
// src/formula-check.js — Formula OS 규정 Check 엔진 골든 테스트.
// 파서 변경·판정 기준 변경 시 회귀를 감지한다.
// 핵심 불변식: 모호한 입력은 절대 ok/warn이 아니라 unknown.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECK,
  parseLimitText,
  checkIngredient,
  buildIngredientIndex,
  checkFormulaItems,
} from '../../src/formula-check.js';

const ing = (type, limit, extra = {}) => ({ name: '테스트원료', type, limit, ...extra });

// ── parseLimitText ─────────────────────────────────────────

test('parseLimitText: 단순 "N%" → primary=N, conditional=false', () => {
  const r = parseLimitText('1.0%');
  assert.deepEqual(r.values, [1.0]);
  assert.equal(r.primary, 1.0);
  assert.equal(r.conditional, false);
  assert.equal(r.labeling, false);
});

test('parseLimitText: 괄호 조건 "5.0% (두발용)" → conditional=true', () => {
  const r = parseLimitText('5.0% (두발용)');
  assert.equal(r.primary, 5.0);
  assert.equal(r.conditional, true);
});

test('parseLimitText: 복합 "0.4% (단일), 0.8% (혼합)" → primary=min', () => {
  const r = parseLimitText('0.4% (단일), 0.8% (혼합)');
  assert.deepEqual(r.values, [0.4, 0.8]);
  assert.equal(r.primary, 0.4);
  assert.equal(r.conditional, true);
});

test('parseLimitText: 제품 조건 "산화염모제에 2.0%" → conditional', () => {
  const r = parseLimitText('산화염모제에 2.0%');
  assert.equal(r.primary, 2.0);
  assert.equal(r.conditional, true);
});

test('parseLimitText: "N% 초과 시 표시" → labeling, primary=null', () => {
  const r = parseLimitText('0.01% 초과 시 표시');
  assert.equal(r.labeling, true);
  assert.equal(r.primary, null);
});

test('parseLimitText: 빈 문자열/null → 수치 없음', () => {
  for (const t of ['', '   ', null, undefined]) {
    const r = parseLimitText(t);
    assert.equal(r.values.length, 0);
    assert.equal(r.primary, null);
  }
});

// ── checkIngredient: banned ────────────────────────────────

test('checkIngredient: type=banned → banned (농도 무관)', () => {
  const r = checkIngredient(ing('banned', '사용 불가 (2.0%)'), 0.1);
  assert.equal(r.check, CHECK.BANNED);
});

test('checkIngredient: limit에 "사용 불가" 문구 → banned', () => {
  const r = checkIngredient(ing('restricted', '사용 불가'), 1.0);
  assert.equal(r.check, CHECK.BANNED);
});

// ── checkIngredient: 수치 검증 ─────────────────────────────

test('checkIngredient: restricted 한도 이내 → ok', () => {
  const r = checkIngredient(ing('restricted', '1.0%'), 0.8);
  assert.equal(r.check, CHECK.OK);
  assert.equal(r.primaryLimit, 1.0);
});

test('checkIngredient: restricted 한도 초과 → warn', () => {
  const r = checkIngredient(ing('restricted', '1.0%'), 1.2);
  assert.equal(r.check, CHECK.WARN);
  assert.match(r.note, /초과/);
});

test('checkIngredient: 한도 경계값(==primary) → ok', () => {
  const r = checkIngredient(ing('restricted', '1.0%'), 1.0);
  assert.equal(r.check, CHECK.OK);
});

test('checkIngredient: approved + 한도 표기 → 수치 검증 동일 적용', () => {
  // 세트리모늄클로라이드 같은 approved+limit 케이스
  const r = checkIngredient(ing('approved', '5.0% (두발용)'), 6.0);
  assert.equal(r.check, CHECK.WARN);
  assert.equal(r.conditional, true);
});

// ── checkIngredient: 미탐 원칙 (unknown) ──────────────────

test('checkIngredient: approved + 한도 없음 → ok "제한 없음"', () => {
  const r = checkIngredient(ing('approved', ''), 50);
  assert.equal(r.check, CHECK.OK);
});

test('checkIngredient: restricted + 한도 없음 → unknown', () => {
  const r = checkIngredient(ing('restricted', ''), 1.0);
  assert.equal(r.check, CHECK.UNKNOWN);
});

test('checkIngredient: 조건부 원문만 있고 % 없음 → unknown', () => {
  const r = checkIngredient(ing('restricted', '두발용 제품에만 사용'), 1.0);
  assert.equal(r.check, CHECK.UNKNOWN);
});

test('checkIngredient: 표시 기준 문자열 → unknown', () => {
  const r = checkIngredient(ing('approved', '0.01% 초과 시 표시'), 0.5);
  assert.equal(r.check, CHECK.UNKNOWN);
});

test('checkIngredient: 농도 미입력/0/음수/NaN → unknown', () => {
  for (const c of [undefined, NaN, 'abc', 0, -1]) {
    const r = checkIngredient(ing('restricted', '1.0%'), c);
    assert.equal(r.check, CHECK.UNKNOWN, `conc=${c}`);
  }
});

test('checkIngredient: DB에 없는 원료 → unknown', () => {
  const r = checkIngredient(null, 1.0);
  assert.equal(r.check, CHECK.UNKNOWN);
});

// ── checkFormulaItems: 집계 ────────────────────────────────

test('checkFormulaItems: 전체 포뮬러 검증 + 요약 카운트', () => {
  const index = buildIngredientIndex([
    { name: '글리세린', type: 'approved', limit: '' },
    { name: '페녹시에탄올', type: 'restricted', limit: '1.0%' },
    { name: '금지원료', type: 'banned', limit: '사용 불가' },
  ]);
  const { results, summary } = checkFormulaItems([
    { name: '글리세린', concentration: 10 },
    { name: '페녹시에탄올', concentration: 1.5 },
    { name: '금지원료', concentration: 0.1 },
    { name: '미등록원료', concentration: 5 },
  ], index);

  assert.equal(results.length, 4);
  assert.deepEqual(summary, { ok: 1, warn: 1, banned: 1, unknown: 1 });
});

test('checkFormulaItems: 빈 배열/null 입력 → 빈 결과', () => {
  assert.deepEqual(checkFormulaItems([], new Map()).summary, { ok: 0, warn: 0, banned: 0, unknown: 0 });
  assert.deepEqual(checkFormulaItems(null, new Map()).results, []);
});
