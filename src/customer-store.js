// src/customer-store.js — Formula OS 고객 카드·상담 이력 영속성 계층 (Phase B)
//
// 고객은 처방·배치와 독립된 엔티티 — 여러 포뮬러·배치가 customerId로 참조한다.
// localStorage `customer_items` (safeGetItem/safeSetItem 경유 → 시험별
// 네임스페이스 자동 적용).
//
// 고객 스키마:
//   { id:'cust_…', name, age, gender, skinType, scalpType,
//     concerns[], allergies[], pregnancy, products, purpose,
//     consultLog: [{ date:'YYYY-MM-DD', text }],   // append-only 상담 이력
//     notes, createdAt, updatedAt }
//
// 참조 규칙: 포뮬러의 customer 객체는 인라인 값으로 유지(기존 데이터 호환)하고
// customerId 참조를 병기한다. 고객 삭제 시 참조 중인 포뮬러는 인라인 스냅샷만
// 남기고 customerId를 해제 — 기록 보존 원칙 (unlinkCustomerFromFormulas).
// 배치는 customerName 스냅샷이 이미 있으므로 별도 정리 불필요.

import { STORAGE_KEYS } from './storage-keys.js';
import {
  loadItems, saveItems, newId, clampStr, numOrNull, pickEnum, clampDate,
} from './store-utils.js';
import { CUSTOMER_OPTIONS } from './formula-store.js';

// Free 플랜 저장 한도
export const CUSTOMER_LIMIT_FREE = 20;

// 두피 유형 — CUSTOMER_OPTIONS.skinType과 별도 축 (두피 전용 처방 대비)
export const SCALP_OPTIONS = Object.freeze(['건성', '지성', '민감성', '정상']);

const MAX_NAME_LEN = 30;
const MAX_NOTE_LEN = 500;
const MAX_LOG_LEN = 300;
const MAX_LOGS = 100;
const MAX_ALLERGIES = 15;
const MAX_ALLERGY_LEN = 60;
const MAX_PRODUCTS_LEN = 300;
const MAX_PURPOSE_LEN = 120;

/** 고유 ID 생성: cust_<base36시간><난수> */
export function newCustomerId() {
  return newId('cust');
}

function loadAll() {
  return loadItems(STORAGE_KEYS.CUSTOMER_ITEMS);
}

function saveAll(customers) {
  return saveItems(STORAGE_KEYS.CUSTOMER_ITEMS, customers);
}

function sanitizeStringList(list, maxItems, maxLen) {
  if (!Array.isArray(list)) return [];
  return list
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems)
    .map(v => v.slice(0, maxLen));
}

function sanitizeConsultLog(log) {
  if (!Array.isArray(log)) return [];
  return log
    .map(e => {
      if (!e || typeof e !== 'object') return null;
      const date = clampDate(e.date);
      const text = clampStr(e.text || '', MAX_LOG_LEN).trim();
      return date && text ? { date, text } : null;
    })
    .filter(Boolean)
    .slice(-MAX_LOGS); // 오래된 것부터 잘라 최신 MAX_LOGS건만 유지
}

function sanitizeCustomer(data) {
  const c = {
    name: clampStr(data.name || '', MAX_NAME_LEN).trim(),
    age: numOrNull(data.age),
    gender: pickEnum(data.gender, CUSTOMER_OPTIONS.gender),
    skinType: pickEnum(data.skinType, CUSTOMER_OPTIONS.skinType),
    scalpType: pickEnum(data.scalpType, SCALP_OPTIONS),
    concerns: sanitizeStringList(data.concerns, CUSTOMER_OPTIONS.concerns.length, 30)
      .filter(v => CUSTOMER_OPTIONS.concerns.includes(v)),
    allergies: sanitizeStringList(data.allergies, MAX_ALLERGIES, MAX_ALLERGY_LEN),
    pregnancy: pickEnum(data.pregnancy, CUSTOMER_OPTIONS.pregnancy),
    products: clampStr(data.products || '', MAX_PRODUCTS_LEN).trim(),
    purpose: clampStr(data.purpose || '', MAX_PURPOSE_LEN).trim(),
    consultLog: sanitizeConsultLog(data.consultLog),
    notes: clampStr(data.notes || '', MAX_NOTE_LEN).trim(),
  };
  return c;
}

/** 고객 목록 — updatedAt 내림차순 */
export function listCustomers() {
  return loadAll().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getCustomer(id) {
  return loadAll().find(c => c.id === id) || null;
}

/** 저장 한도·현재 개수 */
export function getCustomerUsage() {
  const count = loadAll().length;
  return { count, limit: CUSTOMER_LIMIT_FREE, canCreate: count < CUSTOMER_LIMIT_FREE };
}

/**
 * 새 고객 생성.
 * @returns {{ok:boolean, customer?:object, error?:string}}
 */
export function createCustomer(data) {
  const usage = getCustomerUsage();
  if (!usage.canCreate) {
    return { ok: false, error: `Free 플랜은 최대 ${usage.limit}명까지 등록할 수 있습니다.` };
  }
  const clean = sanitizeCustomer(data || {});
  if (!clean.name) return { ok: false, error: '고객 이름을 입력하세요.' };

  const now = Date.now();
  const customer = { id: newCustomerId(), ...clean, createdAt: now, updatedAt: now };
  const all = loadAll();
  all.push(customer);
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, customer };
}

/**
 * 고객 갱신 (id·createdAt·consultLog 보존 — 이력은 addConsultLog로만 추가).
 * @returns {{ok:boolean, customer?:object, error?:string}}
 */
export function updateCustomer(id, data) {
  const all = loadAll();
  const idx = all.findIndex(c => c.id === id);
  if (idx < 0) return { ok: false, error: '고객을 찾을 수 없습니다.' };

  const clean = sanitizeCustomer({ ...data, consultLog: all[idx].consultLog });
  if (!clean.name) return { ok: false, error: '고객 이름을 입력하세요.' };

  const updated = { ...all[idx], ...clean, id, updatedAt: Date.now() };
  all[idx] = updated;
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, customer: updated };
}

/**
 * 외부 데이터 일괄 가져오기 (CSV 등) — sanitize 후 이름 중복은 건너뛴다.
 * 기존 항목은 절대 덮어쓰지 않는다. 한도 도달 시 나머지 행은 overLimit으로 집계.
 * @param {object[]} rows - sanitizeCustomer에 넘길 원시 객체 배열
 * @returns {{added:number, skipped:number, duplicate:number, overLimit:number}}
 */
export function importCustomers(rows) {
  const existing = loadAll();
  const seen = new Set(existing.map(c => c.name));
  const stats = { added: 0, skipped: 0, duplicate: 0, overLimit: 0 };
  const incoming = [];
  for (const raw of rows || []) {
    const clean = sanitizeCustomer(raw);
    if (!clean.name) { stats.skipped++; continue; }
    if (seen.has(clean.name)) { stats.duplicate++; continue; }
    if (existing.length + incoming.length >= CUSTOMER_LIMIT_FREE) { stats.overLimit++; continue; }
    seen.add(clean.name);
    const now = Date.now();
    incoming.push({ id: newCustomerId(), ...clean, createdAt: now, updatedAt: now });
  }
  if (incoming.length) saveAll(existing.concat(incoming));
  stats.added = incoming.length;
  return stats;
}

/**
 * 상담 이력 추가 — append 전용 (수정·삭제 없음, 기록 보존 원칙).
 * @param {string} id - 고객 id
 * @param {string} text - 상담 내용
 * @param {string} [date] - 'YYYY-MM-DD' (기본: 오늘)
 * @returns {{ok:boolean, customer?:object, error?:string}}
 */
export function addConsultLog(id, text, date) {
  const all = loadAll();
  const idx = all.findIndex(c => c.id === id);
  if (idx < 0) return { ok: false, error: '고객을 찾을 수 없습니다.' };

  const clean = clampStr(text || '', MAX_LOG_LEN).trim();
  if (!clean) return { ok: false, error: '상담 내용을 입력하세요.' };

  let d = clampDate(date);
  if (!d) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  const log = [...(all[idx].consultLog || []), { date: d, text: clean }].slice(-MAX_LOGS);
  all[idx] = { ...all[idx], consultLog: log, updatedAt: Date.now() };
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, customer: all[idx] };
}

/**
 * 고객 삭제 — 참조 중인 포뮬러의 customerId는 인라인 스냅샷만 남기고 해제.
 * 배치는 customerName 스냅샷이 보존되므로 별도 처리 없음.
 * @returns {{ok:boolean, error?:string}}
 */
export function deleteCustomer(id) {
  const all = loadAll();
  const idx = all.findIndex(c => c.id === id);
  if (idx < 0) return { ok: false, error: '고객을 찾을 수 없습니다.' };
  all.splice(idx, 1);
  if (!saveAll(all)) return { ok: false, error: '삭제에 실패했습니다.' };
  return { ok: true };
}
