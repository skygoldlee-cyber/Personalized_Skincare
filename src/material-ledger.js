// src/material-ledger.js — Formula OS 원료 장부 영속성 계층 (Phase C)
//
// 원료 재고 항목: 입고일·사용기한·보관조건·잔량을 관리하고 기한 임박/경과를
// 경고한다. localStorage `material_items` (safeGetItem/safeSetItem 경유 →
// 시험별 네임스페이스 자동 적용).
//
// 스키마:
//   { id:'mat_…', name, lot, receivedAt:'YYYY-MM-DD', expiryAt:'YYYY-MM-DD',
//     storage, qty, unit, notes }
//
// 기한 상태는 저장하지 않고 조회 시 계산한다 (materialStatus) — 날짜가 지나도
// 별도 갱신 없이 항상 현재 상태를 반영.

import { STORAGE_KEYS } from './storage-keys.js';
import {
  loadItems, saveItems, newId, clampStr, numOrNull, clampDate,
} from './store-utils.js';

// Free 플랜 저장 한도
export const MATERIAL_LIMIT_FREE = 30;

// 기한 임박 판정 기준일
export const EXPIRY_SOON_DAYS = 30;

// 보관 조건 선택지
export const STORAGE_OPTIONS = Object.freeze(['실온', '냉장', '냉동', '냉암소', '기타']);

const MAX_NAME_LEN = 120;
const MAX_LOT_LEN = 40;
const MAX_STORAGE_LEN = 30;
const MAX_NOTE_LEN = 300;

/** 고유 ID 생성: mat_<base36시간><난수> */
export function newMaterialId() {
  return newId('mat');
}

function loadAll() {
  return loadItems(STORAGE_KEYS.MATERIAL_ITEMS);
}

function saveAll(items) {
  return saveItems(STORAGE_KEYS.MATERIAL_ITEMS, items);
}

function sanitizeMaterial(data) {
  return {
    name: clampStr(data.name || '', MAX_NAME_LEN).trim(),
    lot: clampStr(data.lot || '', MAX_LOT_LEN).trim(),
    receivedAt: clampDate(data.receivedAt),
    expiryAt: clampDate(data.expiryAt),
    storage: clampStr(data.storage || '', MAX_STORAGE_LEN).trim(),
    qty: numOrNull(data.qty),
    unit: clampStr(data.unit || '', 10).trim(),
    notes: clampStr(data.notes || '', MAX_NOTE_LEN).trim(),
  };
}

/** 원료 장부 목록 — 기한 임박 순(기한 없음은 맨 뒤) */
export function listMaterials() {
  return loadAll().slice().sort((a, b) => {
    if (!a.expiryAt && !b.expiryAt) return (b.createdAt || 0) - (a.createdAt || 0);
    if (!a.expiryAt) return 1;
    if (!b.expiryAt) return -1;
    return a.expiryAt.localeCompare(b.expiryAt);
  });
}

export function getMaterial(id) {
  return loadAll().find(m => m.id === id) || null;
}

/** 이름 정확 매칭 — 계산기 원료 행과 장부 연결용 (부분 매칭은 오탐 위험) */
export function findMaterialByName(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const target = name.trim();
  return loadAll().find(m => m.name === target) || null;
}

/** 저장 한도·현재 개수 */
export function getMaterialUsage() {
  const count = loadAll().length;
  return { count, limit: MATERIAL_LIMIT_FREE, canCreate: count < MATERIAL_LIMIT_FREE };
}

/**
 * 기한 상태 — 'expired'(기한일 지남) | 'soon'(EXPIRY_SOON_DAYS 이내) | 'ok' | 'none'(기한 미기재)
 * 기한일 당일은 아직 사용 가능(D-0) — 경과는 기한일 다음날부터.
 * @param {object} m - 원료 항목
 * @param {Date} [now] - 기준 시각 (테스트 주입용)
 */
export function materialStatus(m, now) {
  const d = daysUntilExpiry(m, now);
  if (d == null) return 'none';
  if (d < 0) return 'expired';
  return d <= EXPIRY_SOON_DAYS ? 'soon' : 'ok';
}

/** 기한까지 남은 일수 — 자정 기준 날짜 차이 (기한 없음/파싱 실패 시 null) */
export function daysUntilExpiry(m, now) {
  if (!m || !m.expiryAt) return null;
  const exp = new Date(`${m.expiryAt}T00:00:00`);
  if (Number.isNaN(exp.getTime())) return null;
  const base = now instanceof Date ? new Date(now.getTime()) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  base.setHours(0, 0, 0, 0);
  return Math.round((exp.getTime() - base.getTime()) / 86400000);
}

/** 기한 임박·경과 항목 — 배지·경고 패널용 */
export function expiringMaterials(now) {
  return listMaterials().filter(m => {
    const s = materialStatus(m, now);
    return s === 'soon' || s === 'expired';
  });
}

/**
 * 새 원료 항목 등록.
 * @returns {{ok:boolean, material?:object, error?:string}}
 */
export function createMaterial(data) {
  const usage = getMaterialUsage();
  if (!usage.canCreate) {
    return { ok: false, error: `Free 플랜은 최대 ${usage.limit}종까지 등록할 수 있습니다.` };
  }
  const clean = sanitizeMaterial(data || {});
  if (!clean.name) return { ok: false, error: '원료명을 입력하세요.' };

  const now = Date.now();
  const material = { id: newMaterialId(), ...clean, createdAt: now, updatedAt: now };
  const all = loadAll();
  all.push(material);
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, material };
}

/** @returns {{ok:boolean, material?:object, error?:string}} */
export function updateMaterial(id, data) {
  const all = loadAll();
  const idx = all.findIndex(m => m.id === id);
  if (idx < 0) return { ok: false, error: '원료 항목을 찾을 수 없습니다.' };

  const clean = sanitizeMaterial(data || {});
  if (!clean.name) return { ok: false, error: '원료명을 입력하세요.' };

  const updated = { ...all[idx], ...clean, id, updatedAt: Date.now() };
  all[idx] = updated;
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, material: updated };
}

/** @returns {{ok:boolean, error?:string}} */
export function deleteMaterial(id) {
  const all = loadAll();
  const idx = all.findIndex(m => m.id === id);
  if (idx < 0) return { ok: false, error: '원료 항목을 찾을 수 없습니다.' };
  all.splice(idx, 1);
  if (!saveAll(all)) return { ok: false, error: '삭제에 실패했습니다.' };
  return { ok: true };
}
