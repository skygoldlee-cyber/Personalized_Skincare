// src/views/formula-batch.js — Formula OS 조제 기록(배치) 뷰 (Phase A)
//
// 목록 패널(formula-batch-panel) + 폼(formula-batch-form-panel) +
// 상세(formula-batch-detail-panel) — formula.js의 showPanel/subNav 재사용.
//
// 배치는 회차 기록: 생성 시 처방의 검증 결과·전성분·제형을 스냅샷으로 저장해
// 처방이 수정·삭제돼도 당시 기록이 보존된다 (batch-store.js 주석 참조).

import { esc } from '../sanitize.js';
import { showToast, showConfirm } from '../ui-utils.js';
import { showPanel, formulaSubNav } from './formula.js';
import { listFormulas, getFormula } from '../formula-store.js';
import { listCustomers, getCustomer } from '../customer-store.js';
import { buildIngredientIndex, checkFormulaItems } from '../formula-check.js';
import { evaluateStability, STAB } from '../formula-stability.js';
import {
  listBatches, getBatch, getBatchUsage,
  createBatch, updateBatch, deleteBatch,
  QC_FIELDS, QC_VALUES, HYGIENE_FIELDS,
} from '../batch-store.js';
import { localDateTimeNow } from '../store-utils.js';
import { DataLoader } from '../data-loader.js';
import { daysUntilExpiry, findMaterialsByName } from '../material-ledger.js';
import { isPreservative } from '../formula-stability.js';
import {
  buildBatchRecordHtml, buildLabelHtml, buildGuideHtml, printHtml, batchQcSummary,
} from './formula-print.js';
import { toCsv, downloadCsv } from '../csv-utils.js';

// 폼 상태 — editingId가 있으면 보정 모드(identity 필드 읽기 전용)
const draft = { editingId: null };

let ingredientIndex = null;
function getIndex() {
  if (!ingredientIndex) {
    const db = typeof window.INGREDIENTS_DATA !== 'undefined' ? window.INGREDIENTS_DATA : [];
    ingredientIndex = buildIngredientIndex(db);
  }
  return ingredientIndex;
}

/* =======================================================
   배치 목록 — 필터 · CSV보내기
   ======================================================= */

// 목록 필터 상태 — 패널을 벗어나도 유지 (세션 내)
const listFilter = { formula: '', customer: '', qc: '', delivered: '' };

/** 필터 조건에 맞는 배치만 반환 — CSV보내기도 이 결과를 사용 */
function applyListFilter(batches) {
  return batches.filter(b => {
    if (listFilter.formula && b.formulaName !== listFilter.formula) return false;
    if (listFilter.customer
      && !(b.customerName || '').toLowerCase().includes(listFilter.customer.toLowerCase())) {
      return false;
    }
    if (listFilter.qc) {
      const s = batchQcSummary(b);
      const hasBad = s.bad.length > 0;
      const unchecked = s.unchecked === QC_FIELDS.length;
      if (listFilter.qc === 'bad' && !hasBad) return false;
      if (listFilter.qc === 'ok' && (hasBad || unchecked)) return false;
      if (listFilter.qc === 'unchecked' && !unchecked) return false;
    }
    if (listFilter.delivered === 'yes' && !b.deliveredAt) return false;
    if (listFilter.delivered === 'no' && b.deliveredAt) return false;
    return true;
  });
}

/** 필터 바 렌더 — 처방 옵션은 실제 배치에 있는 처방명으로 구성 */
function renderFilterBar(batches) {
  const bar = document.getElementById('batch-filter-bar');
  if (!bar) return;
  const names = [...new Set(batches.map(b => b.formulaName).filter(Boolean))].sort();
  const opt = (v, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(v || '전체')}</option>`;
  bar.innerHTML = `
    <select id="batch-filter-formula" class="form-select batch-filter-sel" aria-label="처방 필터">
      <option value="">전체 처방</option>
      ${names.map(n => opt(n, listFilter.formula)).join('')}
    </select>
    <input type="search" id="batch-filter-customer" class="form-input batch-filter-input"
      placeholder="고객명 검색" value="${esc(listFilter.customer)}" aria-label="고객명 검색">
    <select id="batch-filter-qc" class="form-select batch-filter-sel" aria-label="QC 상태 필터">
      <option value="">QC 전체</option>
      <option value="bad"${listFilter.qc === 'bad' ? ' selected' : ''}>QC 이상</option>
      <option value="ok"${listFilter.qc === 'ok' ? ' selected' : ''}>QC 정상</option>
      <option value="unchecked"${listFilter.qc === 'unchecked' ? ' selected' : ''}>QC 미기록</option>
    </select>
    <select id="batch-filter-delivered" class="form-select batch-filter-sel" aria-label="인도 여부 필터">
      <option value="">인도 전체</option>
      <option value="yes"${listFilter.delivered === 'yes' ? ' selected' : ''}>인도 완료</option>
      <option value="no"${listFilter.delivered === 'no' ? ' selected' : ''}>미인도</option>
    </select>
    <button class="btn btn-secondary btn-sm" data-click="batchExportCsv" title="필터된 목록을 CSV로 저장">
      <i class="fa-solid fa-file-csv" aria-hidden="true"></i> CSV
    </button>`;
  const bind = (id, key, evt) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, () => { listFilter[key] = el.value.trim(); openBatchPanel(); });
  };
  bind('batch-filter-formula', 'formula', 'change');
  bind('batch-filter-qc', 'qc', 'change');
  bind('batch-filter-delivered', 'delivered', 'change');
  const custEl = document.getElementById('batch-filter-customer');
  if (custEl) custEl.addEventListener('input', () => { listFilter.customer = custEl.value.trim(); renderBatchList(); });
}

export function openBatchPanel() {
  showPanel('formula-batch-panel');
  const subnav = document.getElementById('formula-batch-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('batch');
  const batches = listBatches();
  renderFilterBar(batches);
  renderBatchList(batches);
}

/** 목록 본문만 다시 그림 — 필터 입력 중 필터 바 재생성(포커스 손실)을 피하기 위함 */
function renderBatchList(batches) {
  const list = document.getElementById('batch-list');
  if (!list) return;
  const all = batches || listBatches();

  const usage = getBatchUsage();
  const usageEl = document.getElementById('batch-list-usage');
  const filtered = applyListFilter(all);
  if (usageEl) {
    usageEl.textContent = filtered.length === all.length
      ? `기록 ${usage.count}/${usage.limit}`
      : `기록 ${filtered.length}/${all.length} (총 ${usage.limit} 한도)`;
  }

  if (!all.length) {
    list.innerHTML = `
      <div class="formula-empty">
        <i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>
        <h4>조제 기록이 없습니다</h4>
        <p>My 포뮬러 카드의 [조제 기록] 버튼으로 첫 회차를 기록해 보세요.</p>
        <button class="btn btn-primary" data-click="openFormulaList"><i class="fa-solid fa-book" aria-hidden="true"></i> My 포뮬러 열기</button>
      </div>`;
    return;
  }
  if (!filtered.length) {
    list.innerHTML = `
      <div class="formula-empty">
        <i class="fa-solid fa-filter" aria-hidden="true"></i>
        <h4>필터 조건에 맞는 기록이 없습니다</h4>
        <p>필터를 바꾸거나 초기화해 보세요.</p>
        <button class="btn btn-secondary" data-click="batchFilterReset" title="모든 필터 조건을 초기화"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> 필터 초기화</button>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(b => {
    const s = batchQcSummary(b);
    const qcHtml = s.bad.length
      ? `<span class="f-check f-check-banned">QC 이상: ${esc(s.bad.join('·'))}</span>`
      : (s.unchecked === QC_FIELDS.length
          ? '<span class="f-check f-check-unknown">QC 미기록</span>'
          : `<span class="f-check f-check-ok">QC 정상 ${QC_FIELDS.length - s.bad.length - s.unchecked}/${QC_FIELDS.length}</span>`);
    const hygHtml = `<span class="f-check ${s.hygDone === s.hygTotal ? 'f-check-ok' : 'f-check-warn'}">위생 ${s.hygDone}/${s.hygTotal}</span>`;
    const expiryHtml = b.expiryAt ? expiryBadge(b.expiryAt) : '';
    // 인도일 — 판매내역서 근거 (미기록 시 회색 배지)
    const delivHtml = b.deliveredAt
      ? `<span class="f-check f-check-ok">인도 ${esc(b.deliveredAt)}</span>`
      : '<span class="f-check f-check-unknown">미인도</span>';
    // QC 이상인데 조치 미기록이면 경고 배지
    const dispHtml = s.bad.length
      ? (b.disposition
          ? `<span class="f-check f-check-warn">조치: ${esc(b.disposition)}</span>`
          : '<span class="f-check f-check-banned">조치 미기록</span>')
      : (b.disposition ? `<span class="f-check f-check-unknown">조치: ${esc(b.disposition)}</span>` : '');
    return `
      <div class="formula-card">
        <div class="formula-card-head">
          <h4 class="formula-card-name">${esc(b.batchNo)} — ${esc(b.formulaName)}</h4>
          <span class="formula-card-meta">조제 ${esc((b.madeAt || '').replace('T', ' '))} · ${b.targetVolume != null ? `${b.targetVolume}${b.unit || 'g'}` : '총량 미지정'}${b.customerName ? ` · ${esc(b.customerName)}` : ''}</span>
        </div>
        <div class="formula-card-checks">${qcHtml}${hygHtml}${expiryHtml}${delivHtml}${dispHtml}</div>
        <div class="formula-card-actions">
          <button class="btn btn-primary btn-sm" data-click="batchOpen" data-arg="${esc(b.id)}" title="조제 기록 상세 보기"><i class="fa-solid fa-eye" aria-hidden="true"></i> 상세</button>
          <button class="btn btn-secondary btn-sm" data-click="batchPrintLabel" data-arg="${esc(b.id)}" title="제품 라벨 인쇄"><i class="fa-solid fa-tag" aria-hidden="true"></i> 라벨</button>
          <button class="btn btn-secondary btn-sm" data-click="batchPrintGuide" data-arg="${esc(b.id)}" title="사용 안내문 인쇄"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> 안내문</button>
        </div>
      </div>`;
  }).join('');
}

function expiryBadge(expiryAt) {
  const days = daysUntilExpiry({ expiryAt });
  if (days == null) return '';
  if (days < 0) return `<span class="f-check f-check-banned">사용기한 경과 D+${Math.abs(days)}</span>`;
  if (days <= 30) return `<span class="f-check f-check-warn">기한 D-${days}</span>`;
  return `<span class="f-check f-check-unknown">기한 ${esc(expiryAt)}</span>`;
}

export function batchFilterReset() {
  listFilter.formula = '';
  listFilter.customer = '';
  listFilter.qc = '';
  listFilter.delivered = '';
  openBatchPanel();
}

/* ---- CSV보내기 — 현재 필터가 적용된 목록 기준 ---- */

const BATCH_CSV_HEADERS = [
  '배치번호', '처방', '고객', '조제일시', '제조량', '단위', '제형',
  'QC이상', 'QC미확인', '위생', '실측pH', '사용기한', '인도일', '조치',
  '사용LOT', '원료DB버전', '메모',
];

function batchToCsvRow(b) {
  const s = batchQcSummary(b);
  return [
    b.batchNo || '',
    b.formulaName || '',
    b.customerName || '',
    (b.madeAt || '').replace('T', ' '),
    b.targetVolume != null ? b.targetVolume : '',
    b.unit || '',
    b.formulation || '',
    s.bad.join(';'),
    s.unchecked,
    `${s.hygDone}/${s.hygTotal}`,
    b.phMeasured != null ? b.phMeasured : '',
    b.expiryAt || '',
    b.deliveredAt || '',
    b.disposition || '',
    (b.materialLots || []).map(l => `${l.name}:${l.lot || '-'}`.trim()).join('; '),
    (b.checkSnapshot && b.checkSnapshot.dbVersion) || '',
    b.notes || '',
  ];
}

export function batchExportCsv() {
  const rows = applyListFilter(listBatches());
  if (!rows.length) { showToast('보낼 조제 기록이 없습니다.', 'warning'); return; }
  downloadCsv(
    toCsv([...BATCH_CSV_HEADERS], rows, batchToCsvRow),
    `batches_${new Date().toISOString().split('T')[0]}.csv`
  );
  showToast(`조제 기록 ${rows.length}건을 CSV로 저장했습니다.`, 'success');
}

/* =======================================================
   배치 폼 (신규 · 보정)
   ======================================================= */

function fillFormulaSelect(selectedId) {
  const sel = document.getElementById('batch-formula');
  if (!sel) return;
  const formulas = listFormulas();
  sel.innerHTML = '<option value="">처방 선택…</option>'
    + formulas.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
  if (selectedId) sel.value = selectedId;
}

/** 고객 카드 셀렉트 — 등록 고객이 변하므로 매번 다시 채운다 */
function fillCustomerSelect(selectedId) {
  const sel = document.getElementById('batch-customer-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">고객 카드에서 선택…</option>'
    + listCustomers().map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  sel.value = selectedId || '';
}

function writeBatchForm(b) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v == null ? '' : v;
  };
  set('batch-made-at', b ? b.madeAt : localDateTimeNow());
  set('batch-target-volume', b && b.targetVolume != null ? b.targetVolume : '');
  set('batch-unit', (b && b.unit) || 'g');
  set('batch-customer-id', (b && b.customerId) || '');
  set('batch-customer-name', (b && b.customerName) || '');
  set('batch-expiry', (b && b.expiryAt) || '');
  set('batch-delivered', (b && b.deliveredAt) || '');
  set('batch-disposition', (b && b.disposition) || '');
  set('batch-ph', b && b.phMeasured != null ? b.phMeasured : '');
  set('batch-notes', (b && b.notes) || '');
  QC_FIELDS.forEach(f => {
    const v = (b && b.qc && b.qc[f.key]) || '';
    const radio = document.querySelector(`input[name="batch-qc-${f.key}"][value="${v || '미확인'}"]`);
    if (radio) radio.checked = true;
  });
  HYGIENE_FIELDS.forEach(f => {
    const el = document.getElementById(`batch-hyg-${f.key}`);
    if (el) el.checked = !!(b && b.hygiene && b.hygiene[f.key]);
  });
}

/** 신규 배치 폼 — data-arg로 formulaId를 받으면 해당 처방으로 바인딩 */
export function batchNew(formulaId) {
  draft.editingId = null;
  showPanel('formula-batch-form-panel');
  fillFormulaSelect(typeof formulaId === 'string' ? formulaId : '');
  fillCustomerSelect('');
  bindFormOnce(); // QC 라디오 렌더 선행 — writeBatchForm이 라디오를 체크하려면 DOM이 있어야 함
  writeBatchForm(null);
  const title = document.getElementById('batch-form-title');
  if (title) title.textContent = '조제 기록 — 신규';
  const f = typeof formulaId === 'string' ? getFormula(formulaId) : null;
  if (f) applyFormulaDefaults(f);
  updateBatchFormMode();
  renderLotFields(f, null);
  updateAllergyWarn();
  updateStockWarn();
}

/** 보정 모드 — identity 필드(처방·조제일시·배치번호)는 읽기 전용 표시 */
export function batchEdit(id) {
  const b = getBatch(id);
  if (!b) { showToast('조제 기록을 찾을 수 없습니다.', 'error'); return; }
  draft.editingId = b.id;
  showPanel('formula-batch-form-panel');
  fillFormulaSelect(b.formulaId);
  fillCustomerSelect(b.customerId);
  bindFormOnce(); // QC 라디오 렌더 선행 — 기존 QC 값 복원이 라디오 DOM에 의존
  writeBatchForm(b);
  const title = document.getElementById('batch-form-title');
  if (title) title.textContent = `조제 기록 보정 — ${b.batchNo}`;
  updateBatchFormMode();
  const f = b.formulaId ? getFormula(b.formulaId) : null;
  renderLotFields(f, b);
  updateAllergyWarn();
  updateStockWarn();
}

/** 보정 모드에서는 처방·조제일시 변경 불가 (기록 무결성 — 틀린 회차는 삭제 후 재기록) */
function updateBatchFormMode() {
  const editing = !!draft.editingId;
  ['batch-formula', 'batch-made-at'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = editing;
  });
}

/**
 * 권장 사용기한 자동 제안 — 보존제 유무·수상 여부 기반 일수.
 * 법적 유효기간이 아닌 참고 제안이며, 필드는 사용자가 수정할 수 있다.
 * - 보존제 포함 → 180일
 * - 보존제 없음 + 수상부 원료 있음 → 14일 (미생물 리스크, 냉장·단기 사용 권장)
 * - 보존제 없음 + 무수 제형 → 90일
 * @returns {number|null} 제안 일수 (원료 없으면 null)
 */
export function suggestExpiryDays(formula) {
  const items = (formula && formula.ingredients) || [];
  if (!items.length) return null;
  const index = getIndex();
  const hasPreservative = items.some(
    i => i && i.name && isPreservative(index.get(i.name), i.name)
  );
  if (hasPreservative) return 180;
  const hasWater = items.some(
    i => i && (i.phase === '수상부' || (i.name || '').includes('정제수'))
  );
  return hasWater ? 14 : 90;
}

/** 처방 선택 시 사용기한이 비어 있으면 제안값으로 채우고 근거 힌트를 표시한다 */
function updateExpiryHint(formula) {
  const expEl = document.getElementById('batch-expiry');
  const hintEl = document.getElementById('batch-expiry-hint');
  if (!expEl) return;
  const days = suggestExpiryDays(formula);
  if (hintEl) hintEl.textContent = days != null ? `자동 제안 ${days}일 — 필요 시 수정` : '';
  if (days == null || expEl.value) return;
  const madeEl = document.getElementById('batch-made-at');
  const base = madeEl && madeEl.value ? new Date(madeEl.value) : new Date();
  if (Number.isNaN(base.getTime())) return;
  const d = new Date(base.getTime() + days * 86400000);
  expEl.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 처방 선택 시 총량·단위·고객 기본값 채우기 (입력된 값은 덮어쓰지 않음) */
function applyFormulaDefaults(f) {
  const volEl = document.getElementById('batch-target-volume');
  const unitEl = document.getElementById('batch-unit');
  const custEl = document.getElementById('batch-customer-name');
  const custIdEl = document.getElementById('batch-customer-id');
  const custSel = document.getElementById('batch-customer-select');
  if (volEl && !volEl.value && f.targetVolume != null) volEl.value = f.targetVolume;
  if (unitEl && f.unit) unitEl.value = f.unit;
  // 처방에 연결된 고객 카드가 있으면 참조 우선, 아니면 인라인 이름만 채움
  if (f.customerId && getCustomer(f.customerId)) {
    if (custIdEl) custIdEl.value = f.customerId;
    if (custSel) custSel.value = f.customerId;
    if (custEl) custEl.value = getCustomer(f.customerId).name;
  } else if (custEl && !custEl.value && f.customer && f.customer.name) {
    custEl.value = f.customer.name;
  }
  updateExpiryHint(f);
}

/** 고객 카드 선택 → 이름 필드 + customerId 참조 저장 */
export function batchCustChanged() {
  const sel = document.getElementById('batch-customer-select');
  const id = sel ? sel.value : '';
  const idEl = document.getElementById('batch-customer-id');
  const nameEl = document.getElementById('batch-customer-name');
  if (idEl) idEl.value = id;
  const c = id ? getCustomer(id) : null;
  if (nameEl) nameEl.value = c ? c.name : '';
  updateAllergyWarn();
}

export function batchFormulaChanged() {
  const sel = document.getElementById('batch-formula');
  const f = sel && sel.value ? getFormula(sel.value) : null;
  if (f) applyFormulaDefaults(f);
  renderLotFields(f, null);
  updateAllergyWarn();
  updateStockWarn();
}

/* =======================================================
   사용 원료 LOT 선택 + 재고 부족 경고
   ======================================================= */

/**
 * 처방 원료 ↔ 원료 장부 이름 매칭으로 LOT 선택 UI를 렌더한다.
 * 복수 LOT이면 select, 단일이면 고정 표기. 기존 배치(b)의 materialLots를 복원.
 */
function renderLotFields(formula, b) {
  const box = document.getElementById('batch-lots');
  if (!box) return;
  const saved = new Map(
    (b && Array.isArray(b.materialLots) ? b.materialLots : []).map(l => [l.name, l.materialId])
  );
  const rows = (formula && Array.isArray(formula.ingredients) ? formula.ingredients : [])
    .map(i => {
      const name = (i && i.name || '').trim();
      if (!name) return '';
      const mats = findMaterialsByName(name);
      if (!mats.length) return '';
      const opts = mats.map(m => {
        const days = daysUntilExpiry(m);
        const exp = m.expiryAt ? ` · 기한 ${m.expiryAt}${days != null && days < 0 ? ' (경과)' : days != null && days <= 30 ? ` (D-${days})` : ''}` : '';
        return `<option value="${esc(m.id)}">${esc(m.lot || m.name)}${esc(exp)}${m.qty != null ? ` · 잔량 ${m.qty}${esc(m.unit || '')}` : ''}</option>`;
      }).join('');
      return `<div class="batch-qc-row">
        <span class="batch-qc-label">${esc(name)}</span>
        <select class="form-select batch-lot-select" data-name="${esc(name)}" aria-label="${esc(name)} 사용 LOT">${opts}</select>
      </div>`;
    }).filter(Boolean);
  box.innerHTML = rows.length
    ? rows.join('')
    : '<div class="formula-rec-note">장부에 매칭되는 원료가 없습니다 — 원료 장부에 등록하면 LOT 추적이 가능합니다.</div>';
  // 기존 선택 복원 (보정 모드)
  box.querySelectorAll('.batch-lot-select').forEach(sel => {
    const prev = saved.get(sel.dataset.name);
    if (prev) sel.value = prev;
  });
}

/** 폼에서 선택된 LOT 목록 → {name, materialId, lot}[] */
function readLotSelections() {
  return Array.from(document.querySelectorAll('#batch-lots .batch-lot-select'))
    .map(sel => {
      const m = findMaterialsByName(sel.dataset.name).find(x => x.id === sel.value);
      return m ? { name: sel.dataset.name, materialId: m.id, lot: m.lot || '' } : null;
    })
    .filter(Boolean);
}

/**
 * 소요량 vs 장부 잔량 — 같은 이름 원료의 잔량 합계가 필요량보다 적으면 경고.
 * 단위가 배치 단위와 같은 항목만 합산 (g↔ml 혼합 방지). LOT 선택 변경에도 반응.
 */
function updateStockWarn() {
  const warnEl = document.getElementById('batch-stock-warn');
  if (!warnEl) return;
  const fsel = document.getElementById('batch-formula');
  const formula = fsel && fsel.value ? getFormula(fsel.value) : null;
  const volEl = document.getElementById('batch-target-volume');
  const unitEl = document.getElementById('batch-unit');
  const vol = volEl && volEl.value !== '' ? parseFloat(volEl.value) : null;
  const unit = unitEl ? unitEl.value : 'g';
  const shortages = [];
  if (formula && vol != null && !Number.isNaN(vol)) {
    (formula.ingredients || []).forEach(i => {
      const name = (i && i.name || '').trim();
      if (!name || i.concentration == null) return;
      const need = vol * i.concentration / 100;
      const stock = findMaterialsByName(name)
        .filter(m => m.qty != null && (!m.unit || m.unit === unit))
        .reduce((s, m) => s + m.qty, 0);
      const mats = findMaterialsByName(name);
      if (mats.length && stock < need) {
        shortages.push(`${name} — 필요 ${Math.round(need * 100) / 100}${unit}, 잔량 ${stock}${unit}`);
      }
    });
  }
  if (!shortages.length) {
    warnEl.classList.add('is-hidden');
    warnEl.innerHTML = '';
    return;
  }
  warnEl.classList.remove('is-hidden');
  warnEl.innerHTML = `<div class="f-check f-check-warn batch-stock-warn-box">`
    + `<i class="fa-solid fa-box-open" aria-hidden="true"></i> 재고 부족: ${esc(shortages.join(' · '))}</div>`;
}

/** 선택된 고객 카드의 알레르기 이력 ↔ 처방 원료 충돌을 폼에 실시간 표시 */
function updateAllergyWarn() {
  const warnEl = document.getElementById('batch-allergy-warn');
  if (!warnEl) return;
  const conflicts = currentAllergyConflicts();
  if (!conflicts.length) {
    warnEl.classList.add('is-hidden');
    warnEl.innerHTML = '';
    return;
  }
  warnEl.classList.remove('is-hidden');
  warnEl.innerHTML = `<div class="f-check f-check-banned batch-allergy-warn-box">`
    + `<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> `
    + `고객 알레르기 이력 원료가 처방에 포함되어 있습니다: ${esc(conflicts.join(', '))} — 저장 전 반드시 확인하세요.</div>`;
}

/** 현재 폼 상태 기준 알레르기 충돌 원료 목록 */
function currentAllergyConflicts() {
  const fsel = document.getElementById('batch-formula');
  const csel = document.getElementById('batch-customer-id');
  const formula = fsel && fsel.value ? getFormula(fsel.value) : null;
  const customer = csel && csel.value ? getCustomer(csel.value) : null;
  return findAllergyConflicts(customer, formula);
}

/** QC 라디오 그룹 렌더 — QC_FIELDS/QC_VALUES에서 생성, 1회만 */
function renderQcFields() {
  const box = document.getElementById('batch-qc-fields');
  if (!box || box.dataset.bound) return;
  box.dataset.bound = '1';
  box.innerHTML = QC_FIELDS.map(f => `
    <div class="batch-qc-row">
      <span class="batch-qc-label">${esc(f.label)}</span>
      <span class="batch-qc-opts">${QC_VALUES.map(v => `
        <label class="formula-chip batch-qc-chip">
          <input type="radio" name="batch-qc-${f.key}" value="${esc(v)}">
          <span>${esc(v)}</span>
        </label>`).join('')}
      </span>
    </div>`).join('');
}

function bindFormOnce() {
  renderQcFields();
  const sel = document.getElementById('batch-formula');
  if (sel && !sel.dataset.bound) {
    sel.dataset.bound = '1';
    sel.addEventListener('change', batchFormulaChanged);
  }
  const custSel = document.getElementById('batch-customer-select');
  if (custSel && !custSel.dataset.bound) {
    custSel.dataset.bound = '1';
    custSel.addEventListener('change', batchCustChanged);
  }
  // 총량·단위 변경 → 재고 부족 경고 갱신
  ['batch-target-volume', 'batch-unit'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.stockBound) {
      el.dataset.stockBound = '1';
      el.addEventListener('input', updateStockWarn);
      el.addEventListener('change', updateStockWarn);
    }
  });
}

function readBatchForm() {
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  const qc = {};
  QC_FIELDS.forEach(f => {
    const r = document.querySelector(`input[name="batch-qc-${f.key}"]:checked`);
    qc[f.key] = r ? r.value : '';
  });
  const hygiene = {};
  HYGIENE_FIELDS.forEach(f => {
    const el = document.getElementById(`batch-hyg-${f.key}`);
    hygiene[f.key] = !!(el && el.checked);
  });
  const sel = document.getElementById('batch-formula');
  return {
    formulaId: sel ? sel.value : '',
    madeAt: val('batch-made-at'),
    targetVolume: val('batch-target-volume') === '' ? null : parseFloat(val('batch-target-volume')),
    unit: val('batch-unit'),
    customerId: val('batch-customer-id'),
    customerName: val('batch-customer-name'),
    expiryAt: val('batch-expiry'),
    deliveredAt: val('batch-delivered'),
    disposition: val('batch-disposition'),
    phMeasured: val('batch-ph') === '' ? null : parseFloat(val('batch-ph')),
    materialLots: readLotSelections(),
    notes: val('batch-notes'),
    qc, hygiene,
  };
}

/**
 * 처방의 검증 결과를 스냅샷 요약으로 계산 — 배치 생성 시점의 근거 보존.
 * 원본 결과 대신 건수 요약만 저장한다 (용량·의미 모두 요약이 충분).
 */
function buildCheckSnapshot(formula) {
  if (!formula || !Array.isArray(formula.ingredients) || !formula.ingredients.length) return null;
  const index = getIndex();
  const { summary } = checkFormulaItems(
    formula.ingredients.map(i => ({ name: i.name, concentration: i.concentration })),
    index
  );
  const stab = evaluateStability(formula.ingredients, index, {
    formulation: formula.customer && formula.customer.formulation,
    phTarget: formula.phTarget, phActual: formula.phActual, steps: formula.steps,
  });
  const stabWarn = stab.warnings.filter(w => w.level === STAB.WARN).length;
  const meta = (DataLoader.registry && DataLoader.registry.ingredients) || null;
  return {
    ok: summary.ok || 0, warn: summary.warn || 0, banned: summary.banned || 0,
    unknown: summary.unknown || 0, stabWarn, stabInfo: stab.warnings.length - stabWarn,
    dbVersion: meta && meta.version ? String(meta.version) : '',
  };
}

/**
 * 고객 알레르기·임신 조건과 처방 원료의 충돌을 검사한다.
 * 알레르기 이력은 자유 텍스트라 양방향 부분 일치로 판정한다
 * ("파라벤" 이력 ↔ "메칠파라벤" 원료처럼 상위/하위 표기 차이를 커버).
 * @returns {string[]} 충돌 원료명 배열
 */
export function findAllergyConflicts(customer, formula) {
  if (!customer || !formula || !Array.isArray(formula.ingredients)) return [];
  const allergies = (Array.isArray(customer.allergies) ? customer.allergies : [])
    .map(a => (typeof a === 'string' ? a.trim() : '')).filter(Boolean);
  if (!allergies.length) return [];
  return formula.ingredients
    .map(i => i.name)
    .filter(n => typeof n === 'string' && allergies.some(a => n.includes(a) || a.includes(n)));
}

export async function batchSave() {
  const data = readBatchForm();

  // 알레르기 교차검증 — 신규·보정 모두 저장 전 확인 (기록이므로 차단이 아닌 확인)
  const conflicts = currentAllergyConflicts();
  if (conflicts.length) {
    const ok = await showConfirm(
      `고객 알레르기 이력 원료가 처방에 포함되어 있습니다:\n${conflicts.join(', ')}\n\n그래도 이 조제 기록을 저장할까요?`,
      '알레르기 원료 확인'
    );
    if (!ok) return;
  }

  if (draft.editingId) {
    // 보정 — QC·위생·기한·고객·메모·실측 pH만 갱신
    const r = updateBatch(draft.editingId, {
      customerId: data.customerId, customerName: data.customerName,
      targetVolume: data.targetVolume, unit: data.unit,
      qc: data.qc, phMeasured: data.phMeasured, hygiene: data.hygiene,
      expiryAt: data.expiryAt, deliveredAt: data.deliveredAt,
      disposition: data.disposition, materialLots: data.materialLots,
      notes: data.notes,
    });
    if (!r.ok) { showToast(r.error || '저장에 실패했습니다.', 'error'); return; }
    showToast(`${r.batch.batchNo} 기록이 보정되었습니다.`, 'success');
    batchOpen(r.batch.id);
    return;
  }

  const formula = data.formulaId ? getFormula(data.formulaId) : null;
  if (!formula) { showToast('조제한 처방을 선택하세요.', 'error'); return; }
  const r = createBatch({
    ...data,
    formulaName: formula.name,
    formulation: (formula.customer && formula.customer.formulation) || '',
    fullIngredients: formula.fullIngredients || [],
    checkSnapshot: buildCheckSnapshot(formula),
  });
  if (!r.ok) { showToast(r.error || '저장에 실패했습니다.', 'error'); return; }
  showToast(`${r.batch.batchNo} 조제 기록이 저장되었습니다.`, 'success');
  batchOpen(r.batch.id);
}

/* =======================================================
   배치 상세 · 삭제 · 인쇄
   ======================================================= */

export function batchOpen(id) {
  const b = getBatch(id);
  if (!b) { showToast('조제 기록을 찾을 수 없습니다.', 'error'); return; }
  showPanel('formula-batch-detail-panel');
  const subnav = document.getElementById('batch-detail-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('batch');
  const box = document.getElementById('batch-detail');
  if (!box) return;

  const qcRows = QC_FIELDS.map(f => {
    const v = b.qc && b.qc[f.key];
    const cls = v === '이상' ? 'f-check-banned' : (v === '정상' ? 'f-check-ok' : 'f-check-unknown');
    return `<div class="batch-qc-row"><span class="batch-qc-label">${esc(f.label)}</span><span class="f-check ${cls}">${esc(v || '미기록')}</span></div>`;
  }).join('');
  const hyg = HYGIENE_FIELDS.map(f => {
    const done = !!(b.hygiene && b.hygiene[f.key]);
    return `<span class="f-check ${done ? 'f-check-ok' : 'f-check-unknown'}">${done ? '✓' : '—'} ${esc(f.label)}</span>`;
  }).join(' ');
  const snap = b.checkSnapshot;
  const snapHtml = snap
    ? `<div class="formula-card-meta">규정 검증 스냅샷${snap.dbVersion ? ` (원료 DB v${esc(snap.dbVersion)})` : ''} — 정상 ${snap.ok}${snap.warn ? ` · 초과 ${snap.warn}` : ''}${snap.banned ? ` · 금지 ${snap.banned}` : ''}${snap.unknown ? ` · 확인 ${snap.unknown}` : ''}${snap.stabWarn ? ` · 안정성 경고 ${snap.stabWarn}` : ''}</div>`
    : '';

  box.innerHTML = `
    <div class="formula-card">
      <div class="formula-card-head">
        <h4 class="formula-card-name">${esc(b.batchNo)} — ${esc(b.formulaName)}</h4>
        <span class="formula-card-meta">조제 ${esc((b.madeAt || '').replace('T', ' '))} · ${b.targetVolume != null ? `${b.targetVolume}${b.unit || 'g'}` : '총량 미지정'}${b.formulation ? ` · 제형 ${esc(b.formulation)}` : ''}</span>
      </div>
      <div class="formula-card-customer"><i class="fa-solid fa-user" aria-hidden="true"></i> ${esc(b.customerName || '고객 미기록')} · 권장 사용기한 ${esc(b.expiryAt || '미기록')}${b.deliveredAt ? ` · 인도일 ${esc(b.deliveredAt)}` : ' · 미인도'}</div>
      <div class="batch-qc-grid">${qcRows}</div>
      ${b.phMeasured != null ? `<div class="formula-card-meta">실측 pH: ${esc(String(b.phMeasured))}</div>` : ''}
      ${b.disposition ? `<div class="formula-card-meta">QC 이상 조치: ${esc(b.disposition)}</div>` : ''}
      ${b.materialLots && b.materialLots.length ? `<div class="formula-card-meta">사용 LOT: ${esc(b.materialLots.map(l => `${l.name} ${l.lot || ''}`.trim()).join(' · '))}</div>` : ''}
      <div class="formula-card-checks">${hyg}</div>
      ${b.fullIngredients && b.fullIngredients.length ? `<div class="formula-card-inci"><i class="fa-solid fa-list-ol" aria-hidden="true"></i> ${esc(b.fullIngredients.join(', '))}</div>` : ''}
      ${snapHtml}
      ${b.notes ? `<div class="formula-card-meta">메모: ${esc(b.notes)}</div>` : ''}
      <div class="formula-card-actions">
        <button class="btn btn-secondary btn-sm" data-click="batchPrintRecord" data-arg="${esc(b.id)}" title="조제 기록지 인쇄"><i class="fa-solid fa-print" aria-hidden="true"></i> 기록지</button>
        <button class="btn btn-secondary btn-sm" data-click="batchPrintLabel" data-arg="${esc(b.id)}" title="제품 라벨 인쇄"><i class="fa-solid fa-tag" aria-hidden="true"></i> 라벨</button>
        <button class="btn btn-secondary btn-sm" data-click="batchPrintGuide" data-arg="${esc(b.id)}" title="고객용 사용 안내문 인쇄"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> 안내문</button>
        <button class="btn btn-secondary btn-sm" data-click="batchEdit" data-arg="${esc(b.id)}" title="QC·위생·기한·메모 보정"><i class="fa-solid fa-pen" aria-hidden="true"></i> 보정</button>
        <button class="btn btn-secondary btn-sm f-danger" data-click="batchDelete" data-arg="${esc(b.id)}" title="조제 기록 삭제 (복구 불가)"><i class="fa-solid fa-trash" aria-hidden="true"></i> 삭제</button>
      </div>
    </div>`;
}

export async function batchDelete(id) {
  const b = getBatch(id);
  if (!b) return;
  const ok = await showConfirm(`${b.batchNo} 조제 기록을 삭제할까요? 기록은 되돌릴 수 없습니다.`, '조제 기록 삭제');
  if (!ok) return;
  const r = deleteBatch(id);
  if (!r.ok) { showToast(r.error || '삭제에 실패했습니다.', 'error'); return; }
  showToast('조제 기록이 삭제되었습니다.', 'success');
  openBatchPanel();
}

function printBatch(id, builder, emptyMsg) {
  const b = getBatch(id);
  if (!b) { showToast('조제 기록을 찾을 수 없습니다.', 'error'); return; }
  printHtml(builder(b));
}

export function batchPrintRecord(id) { printBatch(id, buildBatchRecordHtml); }
export function batchPrintLabel(id) { printBatch(id, buildLabelHtml); }
export function batchPrintGuide(id) { printBatch(id, buildGuideHtml); }
