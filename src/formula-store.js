// src/formula-store.js — Formula OS My Formula 영속성 계층 (Phase 5-A)
//
// 포뮬러 CRUD + Free 한도 + 백업 통합. localStorage `formula_items`
// (safeGetItem/safeSetItem 경유 → 시험별 네임스페이스 자동 적용).
//
// 포뮬러 스키마:
//   { id, name, targetVolume, unit('g'|'ml'), notes,
//     customer: {name, age, gender, skinType, concerns[], formulation},
//     ingredients: [{name, engName, concentration, note, snapshot:{type,limit}}],
//     createdAt, updatedAt }
//
// customer — 맞춤 조제 대상 고객 컨텍스트. 모든 필드 선택(optional).
//
// ingredients[].snapshot — 저장 시점의 규정 기준(type/limit)을 보존한다.
// 원료 DB가 갱신돼도 과거 포뮬러의 검증 근거가 바뀌지 않게 하기 위함.

import { safeGetItem, safeSetItem } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';

// Free 플랜 저장 한도 (결제 연동 없이 정책 상수로만 동작)
export const FORMULA_LIMIT_FREE = 5;

// 고객 필드 선택지 (formula-store sanitize + formula.js UI가 공유)
export const CUSTOMER_OPTIONS = Object.freeze({
  gender: ['남성', '여성', '기타'],
  skinType: ['건성', '지성', '복합성', '중성', '민감성'],
  concerns: ['건조', '피지·모공', '여드름·트러블', '민감·홍조', '미백·잡티', '주름·탄력', '각질', '진정'],
  formulation: ['세럼·에센스', '토너·미스트', '로션·에멀전', '크림·밤', '젤', '오일', '클렌저', '선크림', '마스크·팩'],
});

const MAX_NAME_LEN = 60;
const MAX_NOTE_LEN = 500;

/** 고유 ID 생성: fml_<base36시간><난수> */
export function newFormulaId() {
  const rand = Math.random().toString(36).slice(2, 6);
  return `fml_${Date.now().toString(36)}${rand}`;
}

function loadAll() {
  const raw = safeGetItem(STORAGE_KEYS.FORMULA_ITEMS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveAll(formulas) {
  return safeSetItem(STORAGE_KEYS.FORMULA_ITEMS, JSON.stringify(formulas));
}

function clampStr(s, max) {
  return typeof s === 'string' ? s.slice(0, max) : '';
}

function numOrNull(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

function sanitizeIngredient(item) {
  if (!item || typeof item.name !== 'string' || !item.name.trim()) return null;
  return {
    name: item.name.trim(),
    engName: clampStr(item.engName || '', 120),
    concentration: numOrNull(item.concentration),
    note: clampStr(item.note || '', MAX_NOTE_LEN),
    // 저장 시점의 규정 기준 스냅샷 — 없으면 null (미등록 원료)
    snapshot: item.snapshot && typeof item.snapshot === 'object'
      ? { type: item.snapshot.type || '', limit: item.snapshot.limit || '' }
      : null,
  };
}

function pickEnum(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : '';
}

function sanitizeCustomer(customer) {
  if (!customer || typeof customer !== 'object') return null;
  const c = {
    name: clampStr(customer.name || '', 30).trim(),
    age: numOrNull(customer.age),
    gender: pickEnum(customer.gender, CUSTOMER_OPTIONS.gender),
    skinType: pickEnum(customer.skinType, CUSTOMER_OPTIONS.skinType),
    concerns: Array.isArray(customer.concerns)
      ? customer.concerns.filter(v => CUSTOMER_OPTIONS.concerns.includes(v))
      : [],
    formulation: pickEnum(customer.formulation, CUSTOMER_OPTIONS.formulation),
  };
  // 모든 필드가 비어 있으면 null — 빈 객체보다 부재가 낫다
  const empty = !c.name && c.age == null && !c.gender && !c.skinType
    && !c.concerns.length && !c.formulation;
  return empty ? null : c;
}

function sanitizeFormula(data) {
  const ingredients = Array.isArray(data.ingredients)
    ? data.ingredients.map(sanitizeIngredient).filter(Boolean)
    : [];
  return {
    name: clampStr(data.name || '', MAX_NAME_LEN).trim(),
    targetVolume: numOrNull(data.targetVolume),
    unit: data.unit === 'ml' ? 'ml' : 'g',
    notes: clampStr(data.notes || '', MAX_NOTE_LEN),
    customer: sanitizeCustomer(data.customer),
    ingredients,
  };
}

/** 저장된 포뮬러 목록 — updatedAt 내림차순 */
export function listFormulas() {
  return loadAll().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getFormula(id) {
  return loadAll().find(f => f.id === id) || null;
}

/** 저장 한도·현재 개수 */
export function getFormulaUsage() {
  const count = loadAll().length;
  return { count, limit: FORMULA_LIMIT_FREE, canCreate: count < FORMULA_LIMIT_FREE };
}

/**
 * 새 포뮬러 생성.
 * @returns {{ok:boolean, formula?:object, error?:string}}
 */
export function createFormula(data) {
  const usage = getFormulaUsage();
  if (!usage.canCreate) {
    return { ok: false, error: `Free 플랜은 최대 ${usage.limit}개까지 저장할 수 있습니다.` };
  }
  const clean = sanitizeFormula(data || {});
  if (!clean.name) return { ok: false, error: '포뮬러 이름을 입력하세요.' };

  const now = Date.now();
  const formula = { id: newFormulaId(), ...clean, createdAt: now, updatedAt: now };
  const all = loadAll();
  all.push(formula);
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, formula };
}

/**
 * 포뮬러 갱신 (id·createdAt은 보존).
 * @returns {{ok:boolean, formula?:object, error?:string}}
 */
export function updateFormula(id, data) {
  const all = loadAll();
  const idx = all.findIndex(f => f.id === id);
  if (idx < 0) return { ok: false, error: '포뮬러를 찾을 수 없습니다.' };

  const clean = sanitizeFormula(data || {});
  if (!clean.name) return { ok: false, error: '포뮬러 이름을 입력하세요.' };

  const updated = { ...all[idx], ...clean, id, updatedAt: Date.now() };
  all[idx] = updated;
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, formula: updated };
}

/** @returns {{ok:boolean, error?:string}} */
export function deleteFormula(id) {
  const all = loadAll();
  const idx = all.findIndex(f => f.id === id);
  if (idx < 0) return { ok: false, error: '포뮬러를 찾을 수 없습니다.' };
  all.splice(idx, 1);
  if (!saveAll(all)) return { ok: false, error: '삭제에 실패했습니다.' };
  return { ok: true };
}

/** 복제 — 새 ID + " (복사본)" 접미사, 한도 적용 */
export function duplicateFormula(id) {
  const src = getFormula(id);
  if (!src) return { ok: false, error: '포뮬러를 찾을 수 없습니다.' };
  const usage = getFormulaUsage();
  if (!usage.canCreate) {
    return { ok: false, error: `Free 플랜은 최대 ${usage.limit}개까지 저장할 수 있습니다.` };
  }
  return createFormula({
    ...src,
    name: `${src.name} (복사본)`.slice(0, MAX_NAME_LEN),
  });
}

/**
 * 원료별 실제 투입량 계산.
 * @param {object} formula
 * @returns {Array<{name:string, concentration:number|null, amount:number|null}>}
 *   amount = targetVolume × concentration / 100. 계산 불가 시 null.
 */
export function calcAmounts(formula) {
  if (!formula || !Array.isArray(formula.ingredients)) return [];
  const total = numOrNull(formula.targetVolume);
  return formula.ingredients.map(item => ({
    name: item.name,
    concentration: item.concentration,
    amount: total != null && item.concentration != null
      ? Math.round(total * item.concentration) / 100  // 소수 2자리 (×100/100)
      : null,
  }));
}
