// tests/unit/formula-stability.test.js
// src/formula-stability.js — 제형 안정성 체크 엔진 테스트.
// 핵심 불변식: 규칙에 없는 조합은 경고를 만들지 않는다 (미판정이 안전).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAB, evaluateStability } from '../../src/formula-stability.js';
import { buildIngredientIndex } from '../../src/formula-check.js';

// 테스트용 미니 DB — 실제 원료명·카테고리를 모사
const DB = [
  { name: '정제수', type: 'approved', category: '용제' },
  { name: '미네랄 오일', type: 'approved', category: '오일' },
  { name: '폴리소르베이트60', type: 'approved', category: '유화제' },
  { name: '글리세릴스테아레이트', type: 'approved', category: '유화제' },
  { name: '카보머', type: 'approved', category: '점증제' },
  { name: '잔탄검', type: 'approved', category: '점증제' },
  { name: '세트리모늄클로라이드', type: 'approved', category: '양이온성 계면활성제' },
  { name: '소듐라우릴설페이트(SLS)', type: 'restricted', category: '음이온성 계면활성제' },
  { name: '페녹시에탄올', type: 'restricted', category: '방부제' },
  { name: '비타민C(아스코르브산)', type: 'approved', category: '기능성 성분' },
  { name: '레티놀', type: 'restricted', category: '기능성 성분' },
  { name: '향료원료', type: 'approved', category: '향료' },
  { name: '살리실산', type: 'restricted', category: '기타' },
  { name: '나이아신아마이드', type: 'approved', category: '기능성 성분' },
  { name: '포타슘하이드록사이드 또는 소듐하이드록사이드', type: 'restricted', category: 'pH 조절제' },
  { name: '납', type: 'banned', category: '중금속' },
];
const index = buildIngredientIndex(DB);

const row = (name, concentration = null, phase = '') => ({ name, concentration, phase });
const levels = r => r.warnings.map(w => w.level);
const msgs = r => r.warnings.map(w => w.msg).join(' | ');

// ── 기본 불변식 ─────────────────────────────────────────

test('빈 입력 → 경고 없음', () => {
  for (const items of [undefined, null, [], [{}, { name: '' }]]) {
    const r = evaluateStability(items, index, {});
    assert.equal(r.warnings.length, 0);
  }
});

test('banned 원료는 안정성 평가에서 제외', () => {
  const r = evaluateStability([
    row('정제수', 80, '수상부'), row('납', 1, '유상부'),
  ], index, {});
  assert.equal(msgs(r).includes('유화제'), false);
});

// ── ① 상 비율 균형 ──────────────────────────────────────

test('수상부+유상부인데 유화제 없음 → warn', () => {
  const r = evaluateStability([
    row('정제수', 70, '수상부'), row('미네랄 오일', 20, '유상부'),
  ], index, {});
  assert.equal(levels(r)[0], STAB.WARN);
  assert.match(msgs(r), /유화제가 감지되지 않습니다/);
});

test('유화제 있으면 미감지 경고 없음', () => {
  const r = evaluateStability([
    row('정제수', 70, '수상부'), row('미네랄 오일', 20, '유상부'),
    row('폴리소르베이트60', 3, '유상부'),
  ], index, {});
  assert.equal(msgs(r).includes('유화제가 감지되지 않습니다'), false);
});

test('유화제:유상부 비율 10% 미만 → warn', () => {
  const r = evaluateStability([
    row('정제수', 70, '수상부'), row('미네랄 오일', 20, '유상부'),
    row('폴리소르베이트60', 1, '유상부'),
  ], index, {});
  assert.match(msgs(r), /유화제 비율이 유상부 대비/);
});

test('유화제:유상부 비율 충분 → 비율 경고 없음', () => {
  const r = evaluateStability([
    row('정제수', 70, '수상부'), row('미네랄 오일', 20, '유상부'),
    row('폴리소르베이트60', 3, '유상부'), row('카보머', 0.5, '수상부'),
    row('페녹시에탄올', 1, '후첨가'),
  ], index, {});
  assert.equal(msgs(r).includes('유화제 비율'), false);
});

test('농도 미입력 행이 있으면 비율 판정 생략', () => {
  const r = evaluateStability([
    row('정제수', 70, '수상부'), row('미네랄 오일', null, '유상부'),
    row('폴리소르베이트60', 1, '유상부'), row('잔탄검', 0.5, '수상부'),
  ], index, {});
  assert.equal(msgs(r).includes('유화제 비율'), false);
});

test('에멀전 + 점증제 없음 → info', () => {
  const r = evaluateStability([
    row('정제수', 70, '수상부'), row('미네랄 오일', 20, '유상부'),
    row('폴리소르베이트60', 3, '유상부'),
  ], index, {});
  assert.match(msgs(r), /점증제가 없는 에멀전/);
});

test('유화제 있는데 유상부 없음 → info', () => {
  const r = evaluateStability([
    row('정제수', 95, '수상부'), row('폴리소르베이트20', 2, '수상부'),
  ], index, {});
  assert.match(msgs(r), /유상부가 없습니다/);
});

// ── ② 상호작용 ──────────────────────────────────────────

test('카보머 × 양이온성 → warn', () => {
  const r = evaluateStability([
    row('정제수', 95, '수상부'), row('카보머', 0.5, '수상부'),
    row('세트리모늄클로라이드', 2, '수상부'),
  ], index, {});
  assert.match(msgs(r), /카보머 × 양이온성/);
});

test('음이온성 × 양이온성 → warn', () => {
  const r = evaluateStability([
    row('정제수', 90, '수상부'), row('소듐라우릴설페이트(SLS)', 5, '수상부'),
    row('세트리모늄클로라이드', 2, '수상부'),
  ], index, {});
  assert.match(msgs(r), /음이온성.*양이온성/);
});

test('보존제 + 비이온성 5% 초과 → info', () => {
  const r = evaluateStability([
    row('정제수', 90, '수상부'), row('페녹시에탄올', 1, '후첨가'),
    row('폴리소르베이트20', 6, '수상부'),
  ], index, {});
  assert.match(msgs(r), /미셀에 흡착/);
});

// ── ③ 배합방법 ──────────────────────────────────────────

test('열 민감 + 가열 단계 + 절차에 가열 → warn', () => {
  const r = evaluateStability([
    row('정제수', 90, '수상부'), row('비타민C(아스코르브산)', 5, '수상부'),
  ], index, { steps: ['수상부 80℃ 가열'] });
  const w = r.warnings.find(w => w.msg.includes('비타민C'));
  assert.equal(w && w.level, STAB.WARN);
});

test('열 민감 + 가열 단계 + 절차 없음 → info', () => {
  const r = evaluateStability([
    row('정제수', 90, '수상부'), row('레티놀', 1, '유상부'),
  ], index, {});
  const w = r.warnings.find(w => w.msg.includes('레티놀'));
  assert.equal(w && w.level, STAB.INFO);
});

test('열 민감 + 후첨가 단계 → 경고 없음', () => {
  const r = evaluateStability([
    row('정제수', 90, '수상부'), row('비타민C(아스코르브산)', 5, '후첨가'),
  ], index, { steps: ['수상부 80℃ 가열'] });
  assert.equal(msgs(r).includes('비타민C'), false);
});

test('향료 카테고리도 열 민감으로 탐지', () => {
  const r = evaluateStability([
    row('정제수', 90, '수상부'), row('향료원료', 0.3, '수상부'),
  ], index, { steps: ['80℃ 가열 후 유화'] });
  assert.match(msgs(r), /향료원료.*휘발성/);
});

test('카보머 + 중화제·중화 단계 없음 → info', () => {
  const r = evaluateStability([
    row('정제수', 95, '수상부'), row('카보머', 0.5, '수상부'),
  ], index, {});
  assert.match(msgs(r), /중화제.*필요/);
});

test('카보머 + 중화제 있음 → 중화 경고 없음', () => {
  const r = evaluateStability([
    row('정제수', 95, '수상부'), row('카보머', 0.5, '수상부'),
    row('포타슘하이드록사이드 또는 소듐하이드록사이드', 0.2, '후첨가'),
  ], index, {});
  assert.equal(msgs(r).includes('중화'), false);
});

test('에멀전 + 절차에 유화 단계 없음 → info', () => {
  const r = evaluateStability([
    row('정제수', 70, '수상부'), row('미네랄 오일', 20, '유상부'),
    row('폴리소르베이트60', 3, '유상부'), row('카보머', 0.5, '수상부'),
    row('포타슘하이드록사이드 또는 소듐하이드록사이드', 0.2, '후첨가'),
  ], index, { steps: ['각 상을 따로 준비', '용기에 담기'] });
  assert.match(msgs(r), /유화·교반.*없습니다/);
});

test('pH 밴드 이탈 → warn (실측 우선)', () => {
  const r = evaluateStability([
    row('정제수', 95, '수상부'), row('살리실산', 1, '기능성'),
  ], index, { phTarget: 4.0, phActual: 6.5 });
  assert.match(msgs(r), /살리실산.*pH/);
  assert.match(msgs(r), /6\.5/);
});

test('pH 밴드 이내 → 경고 없음', () => {
  const r = evaluateStability([
    row('정제수', 95, '수상부'), row('살리실산', 1, '기능성'),
  ], index, { phActual: 3.5 });
  assert.equal(r.warnings.length, 0);
});

test('제형 미선택 + phase 미지정이면 상 비율 판정 안 함', () => {
  const r = evaluateStability([
    row('정제수', 90), row('미네랄 오일', 5),
  ], index, {});
  assert.equal(r.warnings.length, 0);
});
