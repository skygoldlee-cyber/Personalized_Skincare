// src/batch-store.js — Formula OS 조제 기록(배치) 영속성 계층 (Phase A)
//
// 처방(formula)과 조제 회차(batch) 분리: 같은 처방으로 여러 번 조제하며
// 회차마다 조제일시·QC·위생·고객을 기록한다. localStorage `batch_items`
// (safeGetItem/safeSetItem 경유 → 시험별 네임스페이스 자동 적용).
//
// 배치 스키마:
//   { id:'bat_…', formulaId, formulaName,             // 이름 스냅샷 — 처방 삭제 대비
//     batchNo:'YYYYMMDD-NN',                           // 당일 순번 자동 채번
//     customerId, customerName,                        // 인라인 폴백 겸용 (Phase B에서 참조 승격)
//     targetVolume, unit, madeAt:'YYYY-MM-DDTHH:MM',
//     qc:{appearance,color,scent,viscosity,foreign},   // '정상'|'이상'|'미확인'
//     hygiene:{toolsSterilized,workspaceCleaned,glovesWorn},
//     expiryAt:'YYYY-MM-DD',                           // 권장 사용기한
//     formulation, fullIngredients[],                  // 라벨·안내문용 스냅샷 (처방 수정·삭제와 무관)
//     checkSnapshot:{ok,warn,banned,unknown,stabWarn,stabInfo},
//     notes, createdAt }
//
// 기록 원칙: 배치는 append 지향 — identity 필드(batchNo·formulaId·madeAt·
// 스냅샷류)는 생성 후 불변. updateBatch는 QC·위생·기한·고객·메모 보정만 허용.
//
// checkSnapshot — 배치 생성 시점의 규정 검증·안정성 규칙 결과 요약.
// 처방이 나중에 수정돼도 당시 검증 근거가 보존된다. 뷰에서 계산해 전달한다.

import { STORAGE_KEYS } from './storage-keys.js';
import {
  loadItems, saveItems, newId, clampStr, numOrNull, pickEnum,
  clampDate, clampDateTime,
} from './store-utils.js';

// Free 플랜 저장 한도 (기록 보존 업무 특성상 포뮬러보다 넉넉하게)
export const BATCH_LIMIT_FREE = 50;

// 회차별 품질 확인(QC) 항목 — 외관·색상·향·점도·이물
export const QC_FIELDS = Object.freeze([
  { key: 'appearance', label: '외관' },
  { key: 'color', label: '색상' },
  { key: 'scent', label: '향' },
  { key: 'viscosity', label: '점도' },
  { key: 'foreign', label: '이물·오염' },
]);
export const QC_VALUES = Object.freeze(['정상', '이상', '미확인']);

// 위생·안전 체크 항목
export const HYGIENE_FIELDS = Object.freeze([
  { key: 'toolsSterilized', label: '도구·기구 소독' },
  { key: 'workspaceCleaned', label: '작업 공간 정리' },
  { key: 'glovesWorn', label: '장갑 착용' },
]);

const MAX_NAME_LEN = 60;
const MAX_NOTE_LEN = 500;
const MAX_INCI = 60;

/** 고유 ID 생성: bat_<base36시간><난수> */
export function newBatchId() {
  return newId('bat');
}

function loadAll() {
  return loadItems(STORAGE_KEYS.BATCH_ITEMS);
}

function saveAll(batches) {
  return saveItems(STORAGE_KEYS.BATCH_ITEMS, batches);
}

function sanitizeQc(qc) {
  const out = {};
  const src = qc && typeof qc === 'object' ? qc : {};
  QC_FIELDS.forEach(f => { out[f.key] = pickEnum(src[f.key], QC_VALUES); });
  return out;
}

function sanitizeHygiene(h) {
  const out = {};
  const src = h && typeof h === 'object' ? h : {};
  HYGIENE_FIELDS.forEach(f => { out[f.key] = src[f.key] === true; });
  return out;
}

function sanitizeCheckSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return null;
  const intOr0 = v => {
    const n = numOrNull(v);
    return n != null && n >= 0 ? Math.floor(n) : 0;
  };
  const s = {
    ok: intOr0(snap.ok), warn: intOr0(snap.warn), banned: intOr0(snap.banned),
    unknown: intOr0(snap.unknown), stabWarn: intOr0(snap.stabWarn), stabInfo: intOr0(snap.stabInfo),
  };
  return Object.values(s).some(v => v > 0) ? s : null;
}

function sanitizeBatch(data) {
  return {
    formulaId: clampStr(data.formulaId || '', 40).trim(),
    formulaName: clampStr(data.formulaName || '', MAX_NAME_LEN).trim(),
    customerId: clampStr(data.customerId || '', 40).trim(),
    customerName: clampStr(data.customerName || '', 30).trim(),
    targetVolume: numOrNull(data.targetVolume),
    unit: data.unit === 'ml' ? 'ml' : 'g',
    madeAt: clampDateTime(data.madeAt),
    qc: sanitizeQc(data.qc),
    hygiene: sanitizeHygiene(data.hygiene),
    expiryAt: clampDate(data.expiryAt),
    // 라벨·안내문용 스냅샷 — 처방 수정·삭제와 무관하게 이 회차의 정보를 보존
    formulation: clampStr(data.formulation || '', 30).trim(),
    fullIngredients: Array.isArray(data.fullIngredients)
      ? data.fullIngredients.map(n => clampStr(n, 120).trim()).filter(Boolean).slice(0, MAX_INCI)
      : [],
    checkSnapshot: sanitizeCheckSnapshot(data.checkSnapshot),
    notes: clampStr(data.notes || '', MAX_NOTE_LEN).trim(),
  };
}

/** 저장된 배치 목록 — madeAt 내림차순 (ISO 문자열은 사전순=시간순) */
export function listBatches() {
  return loadAll().slice().sort((a, b) => String(b.madeAt || '').localeCompare(String(a.madeAt || '')));
}

export function getBatch(id) {
  return loadAll().find(b => b.id === id) || null;
}

/** 처방별 배치 이력 — madeAt 내림차순 */
export function listBatchesByFormula(formulaId) {
  return listBatches().filter(b => b.formulaId === formulaId);
}

/** 저장 한도·현재 개수 */
export function getBatchUsage() {
  const count = loadAll().length;
  return { count, limit: BATCH_LIMIT_FREE, canCreate: count < BATCH_LIMIT_FREE };
}

/**
 * 배치번호 채번 — 'YYYYMMDD-NN'. 해당 일자의 기존 최대 순번 + 1.
 * @param {string} [dateStr] - 'YYYY-MM-DD' (기본: 오늘)
 */
export function nextBatchNo(dateStr) {
  const date = clampDate(dateStr) || localToday();
  const prefix = date.replace(/-/g, '');
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  loadAll().forEach(b => {
    const m = re.exec(b.batchNo || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

function localToday() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 새 배치 생성 — batchNo는 madeAt 일자 기준 자동 채번.
 * @returns {{ok:boolean, batch?:object, error?:string}}
 */
export function createBatch(data) {
  const usage = getBatchUsage();
  if (!usage.canCreate) {
    return { ok: false, error: `Free 플랜은 최대 ${usage.limit}건까지 기록할 수 있습니다.` };
  }
  const clean = sanitizeBatch(data || {});
  if (!clean.formulaName) return { ok: false, error: '처방 이름이 필요합니다.' };
  if (!clean.madeAt) return { ok: false, error: '조제 일시를 입력하세요.' };

  const batch = {
    id: newBatchId(),
    batchNo: nextBatchNo(clean.madeAt.slice(0, 10)),
    ...clean,
    createdAt: Date.now(),
  };
  const all = loadAll();
  all.push(batch);
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, batch };
}

/**
 * 배치 보정 — QC·위생·사용기한·고객·메모·제조량만 수정 가능.
 * batchNo·처방·조제일시·스냅샷은 기록 무결성을 위해 불변.
 * @returns {{ok:boolean, batch?:object, error?:string}}
 */
export function updateBatch(id, patch) {
  const all = loadAll();
  const idx = all.findIndex(b => b.id === id);
  if (idx < 0) return { ok: false, error: '조제 기록을 찾을 수 없습니다.' };

  const src = all[idx];
  // qc·hygiene은 필드 단위 병합 — 부분 보정 시 기존 항목이 날아가지 않게
  const merged = sanitizeBatch({
    ...src, ...patch,
    madeAt: src.madeAt,
    qc: { ...src.qc, ...(patch && patch.qc) },
    hygiene: { ...src.hygiene, ...(patch && patch.hygiene) },
  });
  all[idx] = {
    ...src,
    customerId: merged.customerId, customerName: merged.customerName,
    targetVolume: merged.targetVolume, unit: merged.unit,
    qc: merged.qc, hygiene: merged.hygiene,
    expiryAt: merged.expiryAt, notes: merged.notes,
  };
  if (!saveAll(all)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, batch: all[idx] };
}

/** @returns {{ok:boolean, error?:string}} */
export function deleteBatch(id) {
  const all = loadAll();
  const idx = all.findIndex(b => b.id === id);
  if (idx < 0) return { ok: false, error: '조제 기록을 찾을 수 없습니다.' };
  all.splice(idx, 1);
  if (!saveAll(all)) return { ok: false, error: '삭제에 실패했습니다.' };
  return { ok: true };
}
