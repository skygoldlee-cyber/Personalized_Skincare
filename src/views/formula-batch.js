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
import { buildIngredientIndex, checkFormulaItems } from '../formula-check.js';
import { evaluateStability, STAB } from '../formula-stability.js';
import {
  listBatches, getBatch, getBatchUsage,
  createBatch, updateBatch, deleteBatch,
  QC_FIELDS, QC_VALUES, HYGIENE_FIELDS,
} from '../batch-store.js';
import { localDateTimeNow } from '../store-utils.js';
import {
  buildBatchRecordHtml, buildLabelHtml, buildGuideHtml, printHtml, batchQcSummary,
} from './formula-print.js';

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
   배치 목록
   ======================================================= */

export function openBatchPanel() {
  showPanel('formula-batch-panel');
  const subnav = document.getElementById('formula-batch-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('batch');
  const list = document.getElementById('batch-list');
  if (!list) return;

  const usage = getBatchUsage();
  const usageEl = document.getElementById('batch-list-usage');
  if (usageEl) usageEl.textContent = `기록 ${usage.count}/${usage.limit}`;

  const batches = listBatches();
  if (!batches.length) {
    list.innerHTML = `
      <div class="formula-empty">
        <i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>
        <h4>조제 기록이 없습니다</h4>
        <p>My 포뮬러 카드의 [조제 기록] 버튼으로 첫 회차를 기록해 보세요.</p>
        <button class="btn btn-primary" data-click="openFormulaList"><i class="fa-solid fa-book" aria-hidden="true"></i> My 포뮬러 열기</button>
      </div>`;
    return;
  }

  list.innerHTML = batches.map(b => {
    const s = batchQcSummary(b);
    const qcHtml = s.bad.length
      ? `<span class="f-check f-check-banned">QC 이상: ${esc(s.bad.join('·'))}</span>`
      : (s.unchecked === QC_FIELDS.length
          ? '<span class="f-check f-check-unknown">QC 미기록</span>'
          : `<span class="f-check f-check-ok">QC 정상 ${QC_FIELDS.length - s.bad.length - s.unchecked}/${QC_FIELDS.length}</span>`);
    const hygHtml = `<span class="f-check ${s.hygDone === s.hygTotal ? 'f-check-ok' : 'f-check-warn'}">위생 ${s.hygDone}/${s.hygTotal}</span>`;
    const expiryHtml = b.expiryAt ? expiryBadge(b.expiryAt) : '';
    return `
      <div class="formula-card">
        <div class="formula-card-head">
          <h4 class="formula-card-name">${esc(b.batchNo)} — ${esc(b.formulaName)}</h4>
          <span class="formula-card-meta">조제 ${esc((b.madeAt || '').replace('T', ' '))} · ${b.targetVolume != null ? `${b.targetVolume}${b.unit || 'g'}` : '총량 미지정'}${b.customerName ? ` · ${esc(b.customerName)}` : ''}</span>
        </div>
        <div class="formula-card-checks">${qcHtml}${hygHtml}${expiryHtml}</div>
        <div class="formula-card-actions">
          <button class="btn btn-primary btn-sm" data-click="batchOpen" data-arg="${esc(b.id)}"><i class="fa-solid fa-eye" aria-hidden="true"></i> 상세</button>
          <button class="btn btn-secondary btn-sm" data-click="batchPrintLabel" data-arg="${esc(b.id)}" title="제품 라벨 인쇄"><i class="fa-solid fa-tag" aria-hidden="true"></i> 라벨</button>
          <button class="btn btn-secondary btn-sm" data-click="batchPrintGuide" data-arg="${esc(b.id)}" title="사용 안내문 인쇄"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> 안내문</button>
        </div>
      </div>`;
  }).join('');
}

function expiryBadge(expiryAt) {
  const days = Math.ceil((new Date(`${expiryAt}T00:00`) - Date.now()) / 86400000);
  if (days < 0) return '<span class="f-check f-check-banned">사용기한 경과</span>';
  if (days <= 30) return `<span class="f-check f-check-warn">기한 D-${days}</span>`;
  return `<span class="f-check f-check-unknown">기한 ${esc(expiryAt)}</span>`;
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

function writeBatchForm(b) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v == null ? '' : v;
  };
  set('batch-made-at', b ? b.madeAt : localDateTimeNow());
  set('batch-target-volume', b && b.targetVolume != null ? b.targetVolume : '');
  set('batch-unit', (b && b.unit) || 'g');
  set('batch-customer-name', (b && b.customerName) || '');
  set('batch-expiry', (b && b.expiryAt) || '');
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
  writeBatchForm(null);
  const title = document.getElementById('batch-form-title');
  if (title) title.textContent = '조제 기록 — 신규';
  const f = typeof formulaId === 'string' ? getFormula(formulaId) : null;
  if (f) applyFormulaDefaults(f);
  bindFormOnce();
  updateBatchFormMode();
}

/** 보정 모드 — identity 필드(처방·조제일시·배치번호)는 읽기 전용 표시 */
export function batchEdit(id) {
  const b = getBatch(id);
  if (!b) { showToast('조제 기록을 찾을 수 없습니다.', 'error'); return; }
  draft.editingId = b.id;
  showPanel('formula-batch-form-panel');
  fillFormulaSelect(b.formulaId);
  writeBatchForm(b);
  const title = document.getElementById('batch-form-title');
  if (title) title.textContent = `조제 기록 보정 — ${b.batchNo}`;
  bindFormOnce();
  updateBatchFormMode();
}

/** 보정 모드에서는 처방·조제일시 변경 불가 (기록 무결성 — 틀린 회차는 삭제 후 재기록) */
function updateBatchFormMode() {
  const editing = !!draft.editingId;
  ['batch-formula', 'batch-made-at'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = editing;
  });
}

/** 처방 선택 시 총량·단위·고객명 기본값 채우기 (입력된 값은 덮어쓰지 않음) */
function applyFormulaDefaults(f) {
  const volEl = document.getElementById('batch-target-volume');
  const unitEl = document.getElementById('batch-unit');
  const custEl = document.getElementById('batch-customer-name');
  if (volEl && !volEl.value && f.targetVolume != null) volEl.value = f.targetVolume;
  if (unitEl && f.unit) unitEl.value = f.unit;
  if (custEl && !custEl.value && f.customer && f.customer.name) custEl.value = f.customer.name;
}

export function batchFormulaChanged() {
  const sel = document.getElementById('batch-formula');
  const f = sel && sel.value ? getFormula(sel.value) : null;
  if (f) applyFormulaDefaults(f);
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
    customerName: val('batch-customer-name'),
    expiryAt: val('batch-expiry'),
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
  return {
    ok: summary.ok || 0, warn: summary.warn || 0, banned: summary.banned || 0,
    unknown: summary.unknown || 0, stabWarn, stabInfo: stab.warnings.length - stabWarn,
  };
}

export function batchSave() {
  const data = readBatchForm();

  if (draft.editingId) {
    // 보정 — QC·위생·기한·고객·메모만 갱신
    const r = updateBatch(draft.editingId, {
      customerName: data.customerName, targetVolume: data.targetVolume, unit: data.unit,
      qc: data.qc, hygiene: data.hygiene, expiryAt: data.expiryAt, notes: data.notes,
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
    ? `<div class="formula-card-meta">규정 검증 스냅샷 — 정상 ${snap.ok}${snap.warn ? ` · 초과 ${snap.warn}` : ''}${snap.banned ? ` · 금지 ${snap.banned}` : ''}${snap.unknown ? ` · 확인 ${snap.unknown}` : ''}${snap.stabWarn ? ` · 안정성 경고 ${snap.stabWarn}` : ''}</div>`
    : '';

  box.innerHTML = `
    <div class="formula-card">
      <div class="formula-card-head">
        <h4 class="formula-card-name">${esc(b.batchNo)} — ${esc(b.formulaName)}</h4>
        <span class="formula-card-meta">조제 ${esc((b.madeAt || '').replace('T', ' '))} · ${b.targetVolume != null ? `${b.targetVolume}${b.unit || 'g'}` : '총량 미지정'}${b.formulation ? ` · 제형 ${esc(b.formulation)}` : ''}</span>
      </div>
      <div class="formula-card-customer"><i class="fa-solid fa-user" aria-hidden="true"></i> ${esc(b.customerName || '고객 미기록')} · 권장 사용기한 ${esc(b.expiryAt || '미기록')}</div>
      <div class="batch-qc-grid">${qcRows}</div>
      <div class="formula-card-checks">${hyg}</div>
      ${b.fullIngredients && b.fullIngredients.length ? `<div class="formula-card-inci"><i class="fa-solid fa-list-ol" aria-hidden="true"></i> ${esc(b.fullIngredients.join(', '))}</div>` : ''}
      ${snapHtml}
      ${b.notes ? `<div class="formula-card-meta">메모: ${esc(b.notes)}</div>` : ''}
      <div class="formula-card-actions">
        <button class="btn btn-secondary btn-sm" data-click="batchPrintRecord" data-arg="${esc(b.id)}"><i class="fa-solid fa-print" aria-hidden="true"></i> 기록지</button>
        <button class="btn btn-secondary btn-sm" data-click="batchPrintLabel" data-arg="${esc(b.id)}"><i class="fa-solid fa-tag" aria-hidden="true"></i> 라벨</button>
        <button class="btn btn-secondary btn-sm" data-click="batchPrintGuide" data-arg="${esc(b.id)}"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> 안내문</button>
        <button class="btn btn-secondary btn-sm" data-click="batchEdit" data-arg="${esc(b.id)}" title="QC·위생·기한·메모 보정"><i class="fa-solid fa-pen" aria-hidden="true"></i> 보정</button>
        <button class="btn btn-secondary btn-sm f-danger" data-click="batchDelete" data-arg="${esc(b.id)}"><i class="fa-solid fa-trash" aria-hidden="true"></i> 삭제</button>
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
