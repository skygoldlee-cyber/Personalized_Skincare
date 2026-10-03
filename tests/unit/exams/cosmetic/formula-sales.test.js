// tests/unit/exams/cosmetic/formula-sales.test.js
// @spec FO-33,FO-34,FO-36
// biz-profile.js 사업 유형 프로파일 + ad-lint.js 광고 문구 린트 엔진.
// 검증: 유형 영속·폴백, 패널 가시 테이블, 체크리스트 세트 매핑,
//       금지 표현 매칭·위치·중첩 제거·카테고리 집계.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIZ_TYPES, BIZ_CHECKLIST_SET,
  getBizType, setBizType, bizVisible, bizChecklistSet,
} from '../../../../src/exams/cosmetic/biz-profile.js';
import { lintAdCopy, summarizeLint, AD_CATEGORIES, AD_BANNED_TERMS } from '../../../../src/exams/cosmetic/ad-lint.js';
import { CHECKLIST_SETS } from '../../../../src/exams/cosmetic/views/formula-compliance.js';

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

beforeEach(() => {
  mockStorage = createMockStorage();
  originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = mockStorage;
});

afterEach(() => {
  globalThis.localStorage = originalLocalStorage;
});

// ── 사업 유형 프로파일 (FO-33) ──

test('기본 유형은 custom — 미설정·비정상 값 폴백 (FO-33)', () => {
  assert.equal(getBizType(), 'custom');
  assert.equal(setBizType('bogus'), false);
  assert.equal(getBizType(), 'custom');
});

test('setBizType 영속 — 세 유형 왕복 (FO-33)', () => {
  for (const t of Object.keys(BIZ_TYPES)) {
    assert.equal(setBizType(t), true);
    assert.equal(getBizType(), t);
  }
});

test('bizVisible — 유형별 패널 가시 테이블 (FO-33)', () => {
  // 책임판매업: 제조 기능 숨김, 표시·광고 노출
  assert.equal(bizVisible('calc', 'sales'), false);
  assert.equal(bizVisible('batch', 'sales'), false);
  assert.equal(bizVisible('material', 'sales'), false);
  assert.equal(bizVisible('label', 'sales'), true);
  assert.equal(bizVisible('adlint', 'sales'), true);
  assert.equal(bizVisible('customer', 'sales'), true);
  // 제조업: 고객 제외, 표시·광고 포함
  assert.equal(bizVisible('customer', 'mfg'), false);
  assert.equal(bizVisible('calc', 'mfg'), true);
  assert.equal(bizVisible('label', 'mfg'), true);
  // 미선언 id는 모든 유형 공용
  assert.equal(bizVisible('list', 'sales'), true);
  assert.equal(bizVisible('compliance', 'mfg'), true);
});

test('bizChecklistSet — 유형 → 세트 매핑 (FO-34)', () => {
  assert.equal(bizChecklistSet('custom'), 'custom');
  assert.equal(bizChecklistSet('mfg'), 'mfg');
  assert.equal(bizChecklistSet('sales'), 'sales');
  assert.equal(bizChecklistSet('unknown'), 'custom');
});

// ── 체크리스트 세트 구조 (FO-34) ──

test('CHECKLIST_SETS — 3세트 존재·항목 id 전역 유일 (FO-34)', () => {
  assert.deepEqual(Object.keys(CHECKLIST_SETS).sort(), ['custom', 'mfg', 'sales']);
  const ids = new Set();
  for (const set of Object.values(CHECKLIST_SETS)) {
    assert.ok(set.key, `세트 ${set.label}에 저장 키 필요`);
    for (const sec of set.sections) {
      for (const it of sec.items) {
        assert.ok(!ids.has(it.id), `항목 id 중복: ${it.id}`);
        ids.add(it.id);
      }
    }
  }
});

test('CHECKLIST_SETS — BIZ_CHECKLIST_SET 매핑이 실제 세트와 정합 (FO-34)', () => {
  for (const setId of Object.values(BIZ_CHECKLIST_SET)) {
    assert.ok(CHECKLIST_SETS[setId], `세트 ${setId} 부재`);
  }
});

// ── 광고 문구 린트 (FO-36) ──

test('lintAdCopy — 의약품 오인 표현 매칭·위치 (FO-36)', () => {
  const hits = lintAdCopy('이 크림은 아토피를 치료합니다.');
  assert.equal(hits.length, 2); // 아토피 + 치료
  assert.deepEqual(hits.map(h => h.term), ['아토피', '치료']);
  assert.equal(hits[0].category, 'medicine');
  assert.equal(hits[0].index, 6); // '아토피' 위치
});

test('lintAdCopy — 과대·기능성 분류 + 제안 (FO-36)', () => {
  const hits = lintAdCopy('부작용 없는 미백 크림, 100% 안전 보장');
  const cats = hits.map(h => h.category);
  assert.ok(cats.includes('overclaim'));
  assert.ok(cats.includes('functional'));
  const func = hits.find(h => h.category === 'functional');
  assert.match(func.suggestion, /기능성/);
});

test('lintAdCopy — 깨끗한 문구는 빈 결과, 반복 발현은 전부 포착 (FO-36)', () => {
  assert.equal(lintAdCopy('촉촉한 보습 크림으로 피부를 진정시켜 줍니다.').length, 0);
  assert.equal(lintAdCopy('치료하고 또 치료한다').length, 2);
  assert.equal(lintAdCopy('').length, 0);
  assert.equal(lintAdCopy(null).length, 0);
});

test('lintAdCopy — 중첩 매칭 제거 (FO-36)', () => {
  // '탈모 치료' 안에 '탈모'·'치료' 조합 — 긴 표현이 우선이고 겹침 없음을 보장
  const hits = lintAdCopy('탈모 치료 효과');
  let lastEnd = -1;
  for (const h of hits) {
    assert.ok(h.index >= lastEnd, '중첩 매치 존재');
    lastEnd = h.index + h.length;
  }
});

test('summarizeLint — 카테고리 집계 + 사전 카테고리 정합 (FO-36)', () => {
  const sum = summarizeLint(lintAdCopy('치료 효과 부작용 없는 미백'));
  assert.equal(sum.medicine, 1);
  assert.equal(sum.overclaim, 1);
  assert.equal(sum.functional, 1);
  // 사전의 모든 category가 AD_CATEGORIES에 선언돼 있어야 함
  for (const rule of AD_BANNED_TERMS) {
    assert.ok(AD_CATEGORIES[rule.category], `미선언 카테고리: ${rule.category} (${rule.term})`);
  }
});
