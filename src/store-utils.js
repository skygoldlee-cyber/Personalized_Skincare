// src/store-utils.js — localStorage 엔티티 스토어 공통 헬퍼 (Formula OS)
//
// formula-store·batch-store·customer-store·material-ledger가 공유하는
// 저장·식별·정제 부품. 모든 키는 safeGetItem/safeSetItem 경유로
// 시험별 네임스페이스(scopedKey)가 자동 적용된다.

import { safeGetItem, safeSetItem } from './state.js';

/** 키의 배열 항목 전체 로드 — 파싱 실패·비배열은 빈 배열 */
export function loadItems(key) {
  const raw = safeGetItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/** 배열 항목 전체 저장 — 실패 시 false */
export function saveItems(key, items) {
  return safeSetItem(key, JSON.stringify(items));
}

/** 고유 ID 생성: <prefix>_<base36시간><난수> */
export function newId(prefix) {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** 문자열을 최대 길이로 절단 (비문자열 → '') */
export function clampStr(s, max) {
  return typeof s === 'string' ? s.slice(0, max) : '';
}

/** 숫자 변환 — 변환 불가 시 null */
export function numOrNull(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

/** 열거형 선택 — 허용 목록에 없으면 '' */
export function pickEnum(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : '';
}

/** 'YYYY-MM-DD' 형식만 통과 (아니면 '') */
export function clampDate(s) {
  const v = clampStr(s, 10).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

/** 'YYYY-MM-DDTHH:MM' 형식만 통과 (아니면 '') */
export function clampDateTime(s) {
  const v = clampStr(s, 19).trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : '';
}

/** datetime-local 입력용 현재 시각 문자열 (로컬 시간대 기준) */
export function localDateTimeNow() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
