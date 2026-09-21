// src/views/formula.js — Formula OS 뷰 컨트롤러 (Phase 5-A)
//
// 허브(메뉴) + My 포뮬러 목록 + 배합 계산기 서브뷰.
// 트레이너와 동일한 패턴: 하나의 view-section 안에서 패널을 is-hidden으로 전환.
//
// 안전 원칙: 배합량을 "제안"하지 않고 사용자가 입력한 값을 고시 데이터로
// "검증"만 한다. 검증 결과는 법정 한도 기준이며 제품 안전성 보장이 아니다.

import { esc } from '../sanitize.js';
import { showToast, showConfirm } from '../ui-utils.js';
import { switchView } from './navigation.js';
import {
  CHECK, buildIngredientIndex, checkFormulaItems,
} from '../formula-check.js';
import {
  listFormulas, getFormula, createFormula, updateFormula,
  deleteFormula, duplicateFormula, getFormulaUsage,
} from '../formula-store.js';

const PANELS = ['formula-menu-panel', 'formula-list-panel', 'formula-calc-panel'];

// 계산기 드래프트 상태 (저장 전 작업 데이터)
const calc = {
  rows: [{ name: '', concentration: null }],
  editingId: null,   // null이면 신규, id면 기존 포뮬러 수정
};

let ingredientIndex = null;

function getIndex() {
  if (!ingredientIndex) {
    const db = typeof window.INGREDIENTS_DATA !== 'undefined' ? window.INGREDIENTS_DATA : [];
    ingredientIndex = buildIngredientIndex(db);
  }
  return ingredientIndex;
}

function showPanel(id) {
  PANELS.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.toggle('is-hidden', p !== id);
  });
}

/* =======================================================
   허브 / 서브뷰 전환
   ======================================================= */

export function initFormulaView() {
  showPanel('formula-menu-panel');
  const usage = getFormulaUsage();
  const badge = document.getElementById('formula-usage-badge');
  if (badge) badge.textContent = `저장 ${usage.count}/${usage.limit}`;
}

export function exitFormulaSubView() {
  initFormulaView();
}

export function openIngredientDict() {
  switchView('dictionary-view');
}

/* =======================================================
   My 포뮬러 목록
   ======================================================= */

const CHECK_BADGE = {
  [CHECK.OK]: { cls: 'f-check-ok', label: '한도 이내' },
  [CHECK.WARN]: { cls: 'f-check-warn', label: '한도 초과' },
  [CHECK.BANNED]: { cls: 'f-check-banned', label: '금지 원료' },
  [CHECK.UNKNOWN]: { cls: 'f-check-unknown', label: '확인 필요' },
};

function checkSummaryHtml(formula) {
  const { summary } = checkFormulaItems(
    (formula.ingredients || []).map(i => ({ name: i.name, concentration: i.concentration })),
    getIndex()
  );
  const parts = [];
  if (summary.banned) parts.push(`<span class="f-check f-check-banned">금지 ${summary.banned}</span>`);
  if (summary.warn) parts.push(`<span class="f-check f-check-warn">초과 ${summary.warn}</span>`);
  if (summary.unknown) parts.push(`<span class="f-check f-check-unknown">확인 ${summary.unknown}</span>`);
  if (summary.ok) parts.push(`<span class="f-check f-check-ok">정상 ${summary.ok}</span>`);
  return parts.join('');
}

export function openFormulaList() {
  showPanel('formula-list-panel');
  const list = document.getElementById('formula-list');
  if (!list) return;

  const usage = getFormulaUsage();
  const usageEl = document.getElementById('formula-list-usage');
  if (usageEl) usageEl.textContent = `${usage.count}/${usage.limit} 저장됨`;

  const formulas = listFormulas();
  if (!formulas.length) {
    list.innerHTML = `
      <div class="formula-empty">
        <i class="fa-solid fa-flask-vial" aria-hidden="true"></i>
        <h4>저장된 포뮬러가 없습니다</h4>
        <p>배합 계산기에서 원료와 농도를 입력하고 포뮬러로 저장해 보세요.</p>
        <button class="btn btn-primary" data-click="formulaNew"><i class="fa-solid fa-plus" aria-hidden="true"></i> 첫 포뮬러 만들기</button>
      </div>`;
    return;
  }

  list.innerHTML = formulas.map(f => {
    const ingCount = (f.ingredients || []).length;
    const date = f.updatedAt ? new Date(f.updatedAt).toLocaleDateString('ko-KR') : '';
    const vol = f.targetVolume != null ? `${f.targetVolume}${f.unit || 'g'}` : '총량 미지정';
    return `
      <div class="formula-card">
        <div class="formula-card-head">
          <h4 class="formula-card-name">${esc(f.name)}</h4>
          <span class="formula-card-meta">${esc(vol)} · 원료 ${ingCount}종 · ${date}</span>
        </div>
        <div class="formula-card-checks">${checkSummaryHtml(f)}</div>
        <div class="formula-card-actions">
          <button class="btn btn-primary btn-sm" data-click="formulaOpen" data-arg="${esc(f.id)}"><i class="fa-solid fa-calculator" aria-hidden="true"></i> 열기</button>
          <button class="btn btn-secondary btn-sm" data-click="formulaDuplicate" data-arg="${esc(f.id)}"><i class="fa-solid fa-copy" aria-hidden="true"></i> 복제</button>
          <button class="btn btn-secondary btn-sm f-danger" data-click="formulaDelete" data-arg="${esc(f.id)}"><i class="fa-solid fa-trash" aria-hidden="true"></i> 삭제</button>
        </div>
      </div>`;
  }).join('');
}

export function formulaNew() {
  calc.rows = [{ name: '', concentration: null }];
  calc.editingId = null;
  openFormulaCalc();
}

export function formulaOpen(id) {
  const f = getFormula(id);
  if (!f) { showToast('포뮬러를 찾을 수 없습니다.', 'error'); return; }
  calc.rows = (f.ingredients || []).map(i => ({ name: i.name, concentration: i.concentration }));
  if (!calc.rows.length) calc.rows = [{ name: '', concentration: null }];
  calc.editingId = f.id;
  openFormulaCalc(f);
}

export function formulaDuplicate(id) {
  const r = duplicateFormula(id);
  if (!r.ok) { showToast(r.error || '복제에 실패했습니다.', 'error'); return; }
  showToast(`"${r.formula.name}"이 생성되었습니다.`, 'success');
  openFormulaList();
}

export function formulaDelete(id) {
  const f = getFormula(id);
  if (!f) return;
  showConfirm(`"${f.name}" 포뮬러를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`, () => {
    const r = deleteFormula(id);
    if (!r.ok) { showToast(r.error || '삭제에 실패했습니다.', 'error'); return; }
    showToast('포뮬러가 삭제되었습니다.', 'success');
    openFormulaList();
  });
}

/* =======================================================
   배합 계산기
   ======================================================= */

function readCalcInputs() {
  const volEl = document.getElementById('formula-target-volume');
  const unitEl = document.getElementById('formula-unit');
  return {
    targetVolume: volEl && volEl.value !== '' ? parseFloat(volEl.value) : null,
    unit: unitEl ? unitEl.value : 'g',
  };
}

function rowCheckBadge(item) {
  const index = getIndex();
  const ing = item.name ? index.get(item.name) : null;
  const r = checkFormulaItems([{ name: item.name, concentration: item.concentration }], index).results[0];
  const info = CHECK_BADGE[r.check] || CHECK_BADGE[CHECK.UNKNOWN];
  const label = !item.name ? '원료명 입력' : (ing ? info.label : 'DB 미등록');
  return `<span class="f-check ${info.cls}" title="${esc(r.note)}">${label}</span>`;
}

// 행을 다시 그리지 않고 계산 결과(투입량·배지·합계)만 갱신 — 입력 중 포커스 유지
function updateCalcComputed() {
  const { targetVolume, unit } = readCalcInputs();
  const container = document.getElementById('formula-calc-rows');
  if (!container) return;

  let sumConc = 0;
  let sumAmount = 0;
  container.querySelectorAll('.f-row').forEach((rowEl, i) => {
    const item = calc.rows[i];
    if (!item) return;
    const amountEl = rowEl.querySelector('.f-amount');
    const checkEl = rowEl.querySelector('.f-check-cell');
    const conc = item.concentration;
    const amount = targetVolume != null && conc != null ? Math.round(targetVolume * conc) / 100 : null;
    if (amountEl) amountEl.textContent = amount != null ? `${amount.toFixed(2)}${unit}` : '—';
    if (checkEl) checkEl.innerHTML = item.name ? rowCheckBadge(item) : '';
    if (conc != null) sumConc += conc;
    if (amount != null) sumAmount += amount;
  });

  const sumConcEl = document.getElementById('formula-sum-conc');
  const sumAmountEl = document.getElementById('formula-sum-amount');
  if (sumConcEl) sumConcEl.textContent = `${Math.round(sumConc * 100) / 100}%`;
  if (sumAmountEl) sumAmountEl.textContent = targetVolume != null ? `${sumAmount.toFixed(2)}${unit}` : '—';
}

function renderCalcRows() {
  const container = document.getElementById('formula-calc-rows');
  if (!container) return;

  container.innerHTML = '';
  calc.rows.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'f-row';
    row.innerHTML = `
      <input type="text" class="f-name" list="formula-ing-datalist" value="${esc(item.name)}"
             placeholder="원료명 (예: 글리세린)" aria-label="원료 ${i + 1} 이름">
      <input type="number" class="f-conc" min="0" step="0.01" value="${item.concentration != null ? item.concentration : ''}"
             placeholder="%" aria-label="원료 ${i + 1} 배합률(%)">
      <span class="f-amount">—</span>
      <span class="f-check-cell"></span>
      <button type="button" class="f-del" data-click="formulaCalcRemoveRow" data-arg="${i}"
              aria-label="원료 ${i + 1} 삭제"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;

    const nameEl = row.querySelector('.f-name');
    const concEl = row.querySelector('.f-conc');
    nameEl.addEventListener('input', () => {
      calc.rows[i].name = nameEl.value.trim();
      updateCalcComputed();
    });
    concEl.addEventListener('input', () => {
      const v = concEl.value === '' ? null : parseFloat(concEl.value);
      calc.rows[i].concentration = (v != null && !Number.isNaN(v)) ? v : null;
      updateCalcComputed();
    });
    container.appendChild(row);
  });
  updateCalcComputed();
}

function populateDatalist() {
  const dl = document.getElementById('formula-ing-datalist');
  if (!dl || dl.childElementCount) return;
  const db = typeof window.INGREDIENTS_DATA !== 'undefined' ? window.INGREDIENTS_DATA : [];
  // 금지 원료도 검색은 되되, 배합 검증에서 banned으로 표시된다.
  const frag = document.createDocumentFragment();
  db.forEach(ing => {
    const opt = document.createElement('option');
    opt.value = ing.name;
    if (ing.engName) opt.label = ing.engName;
    frag.appendChild(opt);
  });
  dl.appendChild(frag);
}

export function openFormulaCalc(sourceFormula) {
  showPanel('formula-calc-panel');
  populateDatalist();

  const title = document.getElementById('formula-calc-title');
  if (title) title.textContent = calc.editingId ? '포뮬러 수정' : '배합 계산기';

  const volEl = document.getElementById('formula-target-volume');
  const unitEl = document.getElementById('formula-unit');
  const nameEl = document.getElementById('formula-name-input');
  if (sourceFormula) {
    if (volEl) volEl.value = sourceFormula.targetVolume != null ? sourceFormula.targetVolume : '';
    if (unitEl) unitEl.value = sourceFormula.unit || 'g';
    if (nameEl) nameEl.value = sourceFormula.name || '';
  } else {
    if (volEl && !volEl.value) volEl.value = '100';
    if (unitEl) unitEl.value = 'g';
    if (nameEl) nameEl.value = '';
  }

  // 총량/단위 변경 시 재계산
  if (volEl && !volEl.dataset.bound) {
    volEl.dataset.bound = '1';
    volEl.addEventListener('input', updateCalcComputed);
  }
  if (unitEl && !unitEl.dataset.bound) {
    unitEl.dataset.bound = '1';
    unitEl.addEventListener('change', updateCalcComputed);
  }

  renderCalcRows();
}

export function formulaCalcAddRow() {
  calc.rows.push({ name: '', concentration: null });
  renderCalcRows();
  const container = document.getElementById('formula-calc-rows');
  const last = container && container.querySelector('.f-row:last-child .f-name');
  if (last) last.focus();
}

export function formulaCalcRemoveRow(idx) {
  const i = parseInt(idx, 10);
  if (Number.isNaN(i) || i < 0 || i >= calc.rows.length) return;
  calc.rows.splice(i, 1);
  if (!calc.rows.length) calc.rows.push({ name: '', concentration: null });
  renderCalcRows();
}

/** 계산 결과를 포뮬러로 저장 (신규 또는 editingId 갱신) */
export function formulaCalcSave() {
  const nameEl = document.getElementById('formula-name-input');
  const name = nameEl ? nameEl.value.trim() : '';
  const { targetVolume, unit } = readCalcInputs();

  const index = getIndex();
  const ingredients = calc.rows
    .filter(r => r.name)
    .map(r => {
      const ing = index.get(r.name);
      return {
        name: r.name,
        engName: ing && ing.engName ? ing.engName : '',
        concentration: r.concentration,
        snapshot: ing ? { type: ing.type || '', limit: ing.limit || '' } : null,
      };
    });

  const data = { name, targetVolume, unit, ingredients };
  const r = calc.editingId ? updateFormula(calc.editingId, data) : createFormula(data);

  if (!r.ok) { showToast(r.error || '저장에 실패했습니다.', 'error'); return; }
  calc.editingId = r.formula.id;
  showToast(`"${r.formula.name}" 포뮬러가 저장되었습니다.`, 'success');
  initFormulaView();
}
