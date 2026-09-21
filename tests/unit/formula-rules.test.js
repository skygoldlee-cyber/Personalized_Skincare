// tests/unit/formula-rules.test.js
// src/formula-rules.js — 추천 엔진 무결성 테스트.
// 핵심 불변식: ①매핑의 모든 이름이 실제 DB에 존재 ②banned 이름 0개
// ③출력에 type/limit 스냅샷 부착 ④빈 입력 → 빈 추천 ⑤주의문 발화.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  recommendFor,
  baseDefaultCandidates,
  allRuleIngredientNames,
  BASE_TEMPLATES,
  CONCERN_INGREDIENTS,
  loadCustomRules,
  addCustomCandidate,
  removeCustomCandidate,
  resetCustomRules,
  customRuleTargets,
  serializeCustomRules,
  importCustomRules,
  ROLE_PHASE,
  _RULE_KEYS,
} from '../../src/formula-rules.js';
import { buildIngredientIndex } from '../../src/formula-check.js';
import { CUSTOMER_OPTIONS, PHASE_OPTIONS } from '../../src/formula-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 실제 원료 DB 번들 로드 (해시 파일명은 디렉터리 스캔으로 해석)
function loadIngredients() {
  const dir = path.resolve(__dirname, '../../data/exams/cosmetic');
  const file = fs.readdirSync(dir).find(f => /^ingredients_data\.[a-f0-9]+\.js$/.test(f));
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  return JSON.parse(src.match(/var INGREDIENTS_DATA = (\[[\s\S]*\]);/)[1]);
}

const DB = loadIngredients();
const INDEX = buildIngredientIndex(DB);

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

// ── 매핑 무결성 ──────────────────────────────────────

test('매핑 무결성: 모든 추천 이름이 DB에 존재하고 banned가 아님', () => {
  const missing = [];
  const banned = [];
  for (const name of allRuleIngredientNames()) {
    const ing = INDEX.get(name);
    if (!ing) missing.push(name);
    else if (ing.type === 'banned') banned.push(name);
  }
  assert.deepEqual(missing, [], `DB에 없는 추천 이름: ${missing}`);
  assert.deepEqual(banned, [], `banned 원료가 추천에 포함: ${banned}`);
});

test('매핑 키 정합: 베이스 템플릿·고민 키가 CUSTOMER_OPTIONS와 일치', () => {
  assert.deepEqual([..._RULE_KEYS.formulations].sort(), [...CUSTOMER_OPTIONS.formulation].sort());
  assert.deepEqual([..._RULE_KEYS.concerns].sort(), [...CUSTOMER_OPTIONS.concerns].sort());
});

test('후보 풍부도: 모든 베이스 역할 후보 ≥5, 고민 매핑 ≥5', () => {
  const thin = [];
  Object.values(BASE_TEMPLATES).flat().forEach(r => {
    if (r.candidates.length < 5) thin.push(`${r.role}(${r.candidates.length})`);
  });
  Object.entries(CONCERN_INGREDIENTS).forEach(([k, v]) => {
    if (v.length < 5) thin.push(`고민:${k}(${v.length})`);
  });
  assert.deepEqual(thin, [], `후보 5개 미만: ${thin}`);
});

// ── recommendFor ───────────────────────────────────

test('제형 선택 시 베이스 템플릿 반환 + required 보존제 포함', () => {
  const r = recommendFor({ formulation: '세럼·에센스' }, INDEX);
  assert.ok(r.bases.length >= 3);
  const roles = r.bases.map(b => b.role);
  assert.ok(roles.includes('보존제'));
  const preserve = r.bases.find(b => b.role === '보존제');
  assert.equal(preserve.required, true);
});

test('고민 선택 시 원료 추천 — 이름·이유·type·limit 스냅샷', () => {
  const r = recommendFor({ concerns: ['미백·잡티'] }, INDEX);
  const names = r.ingredients.map(i => i.name);
  assert.ok(names.includes('나이아신아마이드'));
  const niac = r.ingredients.find(i => i.name === '나이아신아마이드');
  assert.deepEqual(niac.reasons, ['미백·잡티']);
  assert.equal(niac.limit, '5.0%');   // DB limit 스냅샷 부착
});

test('여러 고민 선택 시 이유 태그가 합산되고 이름은 중복되지 않음', () => {
  const r = recommendFor({ concerns: ['민감·홍조', '진정'] }, INDEX);
  const names = r.ingredients.map(i => i.name);
  assert.equal(new Set(names).size, names.length);
  const cica = r.ingredients.find(i => i.name === '시카(센텔라아시아티카)');
  assert.ok(cica.reasons.length >= 2);   // 민감·홍조 + 진정 양쪽 이유
});

test('피부유형 선택 시 추가 추천 + 민감성은 주의문 발화', () => {
  const r = recommendFor({ skinType: '민감성' }, INDEX);
  assert.ok(r.ingredients.some(i => i.reasons.includes('피부유형')));
  assert.ok(r.cautions.some(c => c.includes('향료')));
});

test('나이 경계: <20 또는 >65 시 자극 원료 플래그 + 주의문', () => {
  const young = recommendFor({ age: 19, concerns: ['주름·탄력'] }, INDEX);
  const retinol = young.ingredients.find(i => i.name === '레티놀');
  assert.equal(retinol.irritant, true);
  assert.ok(young.cautions.length >= 1);

  const adult = recommendFor({ age: 30, concerns: ['주름·탄력'] }, INDEX);
  assert.equal(adult.ingredients.find(i => i.name === '레티놀').irritant, false);
  assert.equal(adult.cautions.length, 0);
});

test('빈 입력 → 빈 추천 (undefined/빈 객체)', () => {
  assert.deepEqual(recommendFor(null, INDEX), { bases: [], ingredients: [], cautions: [] });
  assert.deepEqual(recommendFor({}, INDEX), { bases: [], ingredients: [], cautions: [] });
});

test('DB에 없는 이름이 매핑에 섞여도 추천에서 제외', () => {
  // 방어: 매핑 테이블이 미래에 잘못된 이름을 포함해도 런타임은 silent-skip
  const r = recommendFor({ formulation: '젤' }, INDEX);
  for (const b of r.bases) {
    for (const c of b.candidates) {
      assert.ok(INDEX.has(c), `${c} 는 DB에 있어야 함`);
    }
  }
});

// ── baseDefaultCandidates ──────────────────────────

test('베이스 불러오기: required 역할의 첫 후보만 반환 (name+role+phase)', () => {
  const rows = baseDefaultCandidates('세럼·에센스');
  const names = rows.map(r => r.name);
  assert.ok(names.includes('페녹시에탄올'));   // 보존제(required) 첫 후보
  assert.ok(!names.includes('글리세린'));      // 보습제는 required 아님
  assert.deepEqual(baseDefaultCandidates('없는제형'), []);
  rows.forEach(r => assert.ok(r.role && typeof r.phase === 'string'));
});

test('ROLE_PHASE: 모든 템플릿 역할이 PHASE_OPTIONS 값으로 매핑됨', () => {
  const roles = new Set();
  Object.values(BASE_TEMPLATES).flat().forEach(r => roles.add(r.role));
  for (const role of roles) {
    const phase = ROLE_PHASE[role];
    assert.ok(phase, `역할 '${role}'에 phase 매핑이 있어야 함`);
    assert.ok(PHASE_OPTIONS.includes(phase), `phase '${phase}'는 PHASE_OPTIONS에 있어야 함`);
  }
});

// ── 맞춤 추천 규칙 ──────────────────────────────────

test('맞춤 규칙 저장소: 추가·로드·삭제·초기화 라운드트립', () => {
  assert.equal(addCustomCandidate('base', '유화제', '글리세린').ok, true);
  assert.equal(addCustomCandidate('concern', '건조', '우레아').ok, true);
  assert.equal(addCustomCandidate('bad-scope', 'x', 'y').ok, false);
  assert.equal(addCustomCandidate('base', '유화제', '글리세린').ok, false); // 중복

  const rules = loadCustomRules();
  assert.deepEqual(rules.base['유화제'], ['글리세린']);
  assert.deepEqual(rules.concern['건조'], ['우레아']);

  assert.equal(removeCustomCandidate('base', '유화제', '글리세린').ok, true);
  assert.equal(loadCustomRules().base['유화제'], undefined);

  assert.equal(resetCustomRules(), true);
  assert.deepEqual(loadCustomRules(), { base: {}, concern: {}, skin: {} });
});

test('맞춤 후보 병합: 베이스 역할·고민·피부유형에 추가 반영', () => {
  const custom = {
    base: { '유화제': ['레시틴'] },
    concern: { '건조': ['우레아'] },
    skin: { '건성': ['호호바오일'] },
  };
  const r = recommendFor({ formulation: '크림·밤', concerns: ['건조'], skinType: '건성' }, INDEX, custom);
  const emul = r.bases.find(b => b.role === '유화제');
  assert.ok(emul.candidates.includes('레시틴'));
  const names = r.ingredients.map(i => i.name);
  assert.ok(names.includes('우레아'));
  assert.ok(names.includes('호호바오일'));
});

test('맞춤 후보 안전 필터: banned·미등록 이름은 추천에서 제외', () => {
  const bannedName = DB.find(i => i.type === 'banned').name;
  const custom = {
    base: { '보습제': [bannedName, '없는원료XYZ', '히알루론산'] },
    concern: { '건조': [bannedName] },
    skin: {},
  };
  const r = recommendFor({ formulation: '세럼·에센스', concerns: ['건조'] }, INDEX, custom);
  const hum = r.bases.find(b => b.role === '보습제');
  assert.ok(!hum.candidates.includes(bannedName));
  assert.ok(!hum.candidates.includes('없는원료XYZ'));
  assert.ok(hum.candidates.includes('히알루론산'));
  assert.ok(!r.ingredients.some(i => i.name === bannedName));
});

test('맞춤 규칙 대상 목록: 3개 스코프 제공', () => {
  const t = customRuleTargets();
  assert.ok(t.base.includes('유화제'));
  assert.ok(t.concern.length >= 5);
  assert.ok(t.skin.includes('민감성'));
});

test('외부 JSON 가져오기: 병합·중복 집계·잘못된 입력 거부', () => {
  addCustomCandidate('base', '유화제', '레시틴');
  const incoming = JSON.stringify({
    version: 1,
    base: { '유화제': ['레시틴', '글리세릴스테아레이트'], '점증제': ['카보머'] },
    concern: { '건조': ['우레아'] },
  });
  const r = importCustomRules(incoming);
  assert.equal(r.ok, true);
  assert.equal(r.added, 3);      // 레시틴은 중복 → skipped
  assert.equal(r.skipped, 1);
  const rules = loadCustomRules();
  assert.deepEqual(rules.base['유화제'], ['레시틴', '글리세릴스테아레이트']);
  assert.deepEqual(rules.base['점증제'], ['카보머']);

  assert.equal(importCustomRules('not-json{').ok, false);
  assert.equal(importCustomRules(JSON.stringify([1, 2])).ok, false);
  assert.equal(importCustomRules(JSON.stringify({ other: {} })).ok, false);
  assert.equal(importCustomRules(incoming).ok, false); // 전부 중복 → 실패
});

test('외부 JSON 가져오기: merge=false면 기존 규칙 대체', () => {
  addCustomCandidate('skin', '건성', '호호바오일');
  const r = importCustomRules(JSON.stringify({ concern: { '건조': ['우레아'] } }), { merge: false });
  assert.equal(r.ok, true);
  const rules = loadCustomRules();
  assert.deepEqual(rules.skin, {});
  assert.deepEqual(rules.concern['건조'], ['우레아']);
});

test('내보내기→가져오기 라운드트립: 직렬화 포맷 왕복 보존', () => {
  addCustomCandidate('base', '보습제', '판테놀');
  addCustomCandidate('skin', '민감성', '이눌린');
  const json = serializeCustomRules();
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, 1);

  resetCustomRules();
  const r = importCustomRules(json);
  assert.equal(r.ok, true);
  const rules = loadCustomRules();
  assert.deepEqual(rules.base['보습제'], ['판테놀']);
  assert.deepEqual(rules.skin['민감성'], ['이눌린']);
});
