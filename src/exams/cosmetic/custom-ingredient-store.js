// src/exams/cosmetic/custom-ingredient-store.js — 사용자 등록 성분 사전 (DI-06~08)
// @spec DI-06,DI-07,DI-08,DI-09
//
// 공식 원료 DB(번들)에 없는 원료를 사용자가 등록해 사전·배합 검증에 반영한다.
// localStorage `custom_ingredients` (scopedKey → 시험별 네임스페이스 자동).
//
// 스키마:
//   { id:'cing_…', name, engName, type:'custom', category, limit,
//     description, custom:true, createdAt, updatedAt }
//
// 정책:
//   - type은 'custom' 고정 — 법정 유형(approved/restricted/banned)을 사용자가
//     선언하는 것을 금지해 규제 오판을 차단한다 (DI-07).
//   - limit은 자가 선언값 — checkIngredient의 커스텀 분기에서 초과 경고에만
//     사용되고, 통과 표기는 '자가 한도 이내'로 법정 OK와 구분된다.
//   - 공식 DB 동명(정규화 비교) 등록은 거부 — 공식 규제 데이터 덮어쓰기 방지.
//     고시 개정으로 공식 등록되면 _superseded로 표시되고 인덱스는 공식 우선.

import { STORAGE_KEYS } from '../../storage-keys.js';
import { normalizeEntityName } from '../../utils.js';
import {
  loadItems, saveItems, newId, clampStr,
} from './store-utils.js';

// Free 플랜 저장 한도
export const CUSTOM_INGREDIENT_LIMIT_FREE = 50;

const MAX_NAME_LEN = 120;
const MAX_ENG_LEN = 160;
const MAX_CATEGORY_LEN = 60;
const MAX_LIMIT_LEN = 120;
const MAX_DESC_LEN = 500;

function newCustomId() {
  return newId('cing');
}

function loadAll() {
  return loadItems(STORAGE_KEYS.CUSTOM_INGREDIENTS);
}

function saveAll(items) {
  return saveItems(STORAGE_KEYS.CUSTOM_INGREDIENTS, items);
}

function sanitize(data) {
  return {
    name: clampStr(data.name || '', MAX_NAME_LEN).trim(),
    engName: clampStr(data.engName || '', MAX_ENG_LEN).trim(),
    type: 'custom',
    category: clampStr(data.category || '', MAX_CATEGORY_LEN).trim(),
    limit: clampStr(data.limit || '', MAX_LIMIT_LEN).trim(),
    description: clampStr(data.description || '', MAX_DESC_LEN).trim(),
    custom: true,
  };
}

/** 등록 목록 — 최신 등록 순 */
export function listCustomIngredients() {
  return loadAll().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function getCustomIngredient(id) {
  return loadAll().find(i => i.id === id) || null;
}

/** 저장 한도·현재 개수 */
export function getCustomIngredientUsage() {
  return { count: loadAll().length, limit: CUSTOM_INGREDIENT_LIMIT_FREE };
}

/**
 * 공식 인덱스(Map) 기준으로 커스텀 항목에 _superseded 플래그를 붙인다.
 * 고시 개정으로 공식 등록된 자가 항목 — 사전에서는 '공식 등록됨' 배지,
 * 검증 인덱스에서는 공식 항목이 우선한다.
 * @param {Map<string,object>} officialIndex - buildIngredientIndex 결과
 * @returns {object[]} 커스텀 항목 (각 항목에 _superseded 부여)
 */
export function annotateCustomItems(officialIndex) {
  const officialNorm = new Set();
  if (officialIndex && typeof officialIndex.forEach === 'function') {
    officialIndex.forEach((v, k) => officialNorm.add(normalizeEntityName(k)));
  }
  return loadAll()
    .filter(i => i && i.name)
    .map(i => ({ ...i, _superseded: officialNorm.has(normalizeEntityName(i.name)) }));
}

/**
 * 동명 충돌 검사 — 공식 DB 또는 기존 커스텀 항목과 정규화 이름이 겹치면 차단.
 * @param {string} name
 * @param {Map<string,object>} [officialIndex]
 * @param {string|null} [excludeId] - 수정 시 자기 자신 제외
 * @returns {string|null} 충돌 사유 또는 null
 */
function collisionReason(name, officialIndex, excludeId) {
  const norm = normalizeEntityName(name);
  if (!norm) return '원료명을 입력하세요.';
  if (officialIndex && typeof officialIndex.forEach === 'function') {
    let hit = null;
    officialIndex.forEach((v, k) => {
      if (!hit && normalizeEntityName(k) === norm) hit = k;
    });
    if (hit) {
      return `"${hit}"은(는) 공식 DB에 등록된 성분입니다 — 공식 항목이 우선 적용됩니다.`;
    }
  }
  const dup = loadAll().find(i => i.id !== excludeId && normalizeEntityName(i.name) === norm);
  if (dup) return `"${dup.name}"(으)로 이미 등록되어 있습니다.`;
  return null;
}

/**
 * @param {object} data - {name, engName, category, limit, description}
 * @param {{officialIndex?: Map<string,object>}} [opts]
 * @returns {{ok:boolean, item?:object, error?:string}}
 */
export function createCustomIngredient(data, opts = {}) {
  const clean = sanitize(data || {});
  const err = collisionReason(clean.name, opts.officialIndex, null);
  if (err) return { ok: false, error: err };
  const { count, limit } = getCustomIngredientUsage();
  if (count >= limit) return { ok: false, error: `자가 등록은 최대 ${limit}종까지 가능합니다.` };
  const now = Date.now();
  const item = { id: newCustomId(), ...clean, createdAt: now, updatedAt: now };
  const items = loadAll();
  items.push(item);
  if (!saveAll(items)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, item };
}

/**
 * @param {string} id
 * @param {object} data
 * @param {{officialIndex?: Map<string,object>}} [opts]
 */
export function updateCustomIngredient(id, data, opts = {}) {
  const items = loadAll();
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return { ok: false, error: '등록 항목을 찾을 수 없습니다.' };
  const clean = sanitize({ ...items[idx], ...(data || {}) });
  const err = collisionReason(clean.name, opts.officialIndex, id);
  if (err) return { ok: false, error: err };
  items[idx] = { ...items[idx], ...clean, updatedAt: Date.now() };
  if (!saveAll(items)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, item: items[idx] };
}

export function deleteCustomIngredient(id) {
  const items = loadAll();
  const next = items.filter(i => i.id !== id);
  if (next.length === items.length) return { ok: false, error: '등록 항목을 찾을 수 없습니다.' };
  if (!saveAll(next)) return { ok: false, error: '삭제에 실패했습니다.' };
  return { ok: true };
}
