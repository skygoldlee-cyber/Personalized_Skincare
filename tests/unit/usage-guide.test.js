// tests/unit/usage-guide.test.js
// src/usage-guide.js — 사용 안내문 생성기 테스트.
// 제형 템플릿·원료 주의 규칙·고객 조건 주의 병기를 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUsageGuide,
  buildUsageGuideFromFormula,
  buildUsageGuideFromBatch,
} from '../../src/usage-guide.js';

test('제형 템플릿 — 세럼·에센스 사용법·보관법', () => {
  const g = buildUsageGuide({ formulation: '세럼·에센스' });
  assert.match(g.directions, /세안/);
  assert.match(g.storage, /보관/);
  assert.ok(g.cautions.length >= 1); // 면책 문구 항상 포함
});

test('미지정 제형 — 기본 템플릿 폴백', () => {
  const g = buildUsageGuide({ formulation: '없는제형' });
  assert.ok(g.directions.length > 0);
  assert.ok(g.storage.length > 0);
});

test('원료 주의 규칙 — 레티놀·살리실산·비타민C 매칭', () => {
  const g = buildUsageGuide({
    ingredientNames: ['정제수', '레티놀', '살리실산', '아스코르빅애씨드'],
  });
  assert.ok(g.cautions.some(c => /레티노이드/.test(c)));
  assert.ok(g.cautions.some(c => /살리실산|BHA/.test(c)));
  assert.ok(g.cautions.some(c => /비타민C/.test(c)));
});

test('고객 조건 — 임신·수유 + 알레르기 원료 교집합', () => {
  const g = buildUsageGuide({
    ingredientNames: ['글리세린', '파라벤'],
    customer: { pregnancy: '임신 중', allergies: ['파라벤', '없는원료'] },
  });
  assert.ok(g.cautions.some(c => /임신·수유/.test(c)));
  assert.ok(g.cautions.some(c => /파라벤/.test(c) && /알레르기/.test(c)));
  assert.ok(!g.cautions.some(c => /없는원료/.test(c) && /알레르기/.test(c)));
});

test('buildUsageGuideFromFormula — 포뮬러 스키마 변환', () => {
  const g = buildUsageGuideFromFormula({
    customer: { formulation: '선크림' },
    ingredients: [{ name: '징크옥사이드' }],
  });
  assert.match(g.directions, /15~30분/);
});

test('buildUsageGuideFromBatch — 배치 스냅샷 사용', () => {
  const g = buildUsageGuideFromBatch({
    formulation: '크림·밤',
    fullIngredients: ['정제수', '레티놀'],
  });
  assert.match(g.directions, /마지막 단계/);
  assert.ok(g.cautions.some(c => /레티노이드/.test(c)));
});

test('빈 입력 — 면책 문구만 반환', () => {
  const g = buildUsageGuide({});
  assert.ok(g.cautions.length === 1);
  assert.match(g.cautions[0], /일반적인 사용 지침/);
});
