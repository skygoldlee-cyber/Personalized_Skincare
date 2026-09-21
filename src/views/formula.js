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
  CUSTOMER_OPTIONS,
} from '../formula-store.js';
import {
  recommendFor, baseDefaultCandidates,
  loadCustomRules, addCustomCandidate, removeCustomCandidate,
  resetCustomRules, customRuleTargets,
  serializeCustomRules, importCustomRules,
} from '../formula-rules.js';

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

/**
 * 성분 사전/원료 상세에서 "포뮬러에 추가" — 현재 계산기 드래프트에 행을 추가하고
 * 배합 계산기로 이동한다. 농도는 비워 두어 사용자가 직접 입력(검증 대상)하게 한다.
 * @param {string} name - INGREDIENTS_DATA의 원료명
 */
export function formulaAddIngredient(name) {
  if (typeof name !== 'string' || !name.trim()) return;
  const trimmed = name.trim();
  // 마지막 빈 행 재사용, 아니면 새 행 추가
  const last = calc.rows[calc.rows.length - 1];
  if (last && !last.name) {
    last.name = trimmed;
  } else {
    calc.rows.push({ name: trimmed, concentration: null });
  }
  // 사전 등 다른 뷰에서 호출될 수 있으므로 formula-view로 전환 후 계산기 표시
  switchView('formula-view');
  openFormulaCalc();
  showToast(`"${trimmed}"을(를) 추가했습니다 — 배합률(%)을 입력하세요.`, 'success');
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
    const custParts = [];
    if (f.customer) {
      if (f.customer.name) custParts.push(f.customer.name);
      if (f.customer.age != null) custParts.push(`${f.customer.age}세`);
      if (f.customer.gender) custParts.push(f.customer.gender);
      if (f.customer.skinType) custParts.push(f.customer.skinType);
      if (f.customer.formulation) custParts.push(`제형: ${f.customer.formulation}`);
      if (f.customer.concerns && f.customer.concerns.length) custParts.push(`고민: ${f.customer.concerns.join(', ')}`);
    }
    return `
      <div class="formula-card">
        <div class="formula-card-head">
          <h4 class="formula-card-name">${esc(f.name)}</h4>
          <span class="formula-card-meta">${esc(vol)} · 원료 ${ingCount}종 · ${date}</span>
        </div>
        ${custParts.length ? `<div class="formula-card-customer"><i class="fa-solid fa-user" aria-hidden="true"></i> ${esc(custParts.join(' · '))}</div>` : ''}
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

/** 고객 정보 선택지(select·칩)를 CUSTOMER_OPTIONS에서 채운다 — 1회만 */
function populateCustomerFields() {
  const genderEl = document.getElementById('formula-cust-gender');
  if (genderEl && !genderEl.dataset.bound) {
    genderEl.dataset.bound = '1';
    CUSTOMER_OPTIONS.gender.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      genderEl.appendChild(o);
    });
  }
  const skinEl = document.getElementById('formula-cust-skintype');
  if (skinEl && !skinEl.dataset.bound) {
    skinEl.dataset.bound = '1';
    CUSTOMER_OPTIONS.skinType.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      skinEl.appendChild(o);
    });
  }
  const formEl = document.getElementById('formula-cust-formulation');
  if (formEl && !formEl.dataset.bound) {
    formEl.dataset.bound = '1';
    CUSTOMER_OPTIONS.formulation.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      formEl.appendChild(o);
    });
  }
  const chipBox = document.getElementById('formula-cust-concerns');
  if (chipBox && !chipBox.dataset.bound) {
    chipBox.dataset.bound = '1';
    CUSTOMER_OPTIONS.concerns.forEach(v => {
      const label = document.createElement('label');
      label.className = 'formula-chip';
      label.innerHTML = `<input type="checkbox" value="${esc(v)}"><span>${esc(v)}</span>`;
      chipBox.appendChild(label);
    });
  }

  // 고객 필드 변경 → 추천 패널 갱신 (1회 바인딩)
  if (!populateCustomerFields._recBound) {
    populateCustomerFields._recBound = true;
    ['formula-cust-gender', 'formula-cust-skintype', 'formula-cust-formulation', 'formula-cust-age', 'formula-cust-name']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderRecommend);
      });
    if (chipBox) chipBox.addEventListener('change', renderRecommend);
  }
}

/** 고객 필드 현재 값 읽기 → store 스키마 */
function readCustomerInputs() {
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  const ageRaw = val('formula-cust-age');
  const chipBox = document.getElementById('formula-cust-concerns');
  const concerns = chipBox
    ? Array.from(chipBox.querySelectorAll('input:checked')).map(cb => cb.value)
    : [];
  return {
    name: val('formula-cust-name').trim(),
    age: ageRaw === '' ? null : parseInt(ageRaw, 10),
    gender: val('formula-cust-gender'),
    skinType: val('formula-cust-skintype'),
    concerns,
    formulation: val('formula-cust-formulation'),
  };
}

/** 고객 필드에 값 복원 (sourceFormula.customer) */
function writeCustomerInputs(customer) {
  const c = customer || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v == null ? '' : v;
  };
  set('formula-cust-name', c.name || '');
  set('formula-cust-age', c.age != null ? c.age : '');
  set('formula-cust-gender', c.gender || '');
  set('formula-cust-skintype', c.skinType || '');
  set('formula-cust-formulation', c.formulation || '');
  const chipBox = document.getElementById('formula-cust-concerns');
  if (chipBox) {
    const selected = Array.isArray(c.concerns) ? c.concerns : [];
    chipBox.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = selected.includes(cb.value);
    });
  }
}

/* =======================================================
   추천 베이스 · 원료 패널 (규칙 기반 — 이름만 제안, 농도 미제안)
   ======================================================= */

function renderRecommend() {
  const panel = document.getElementById('formula-recommend');
  if (!panel) return;
  const customer = readCustomerInputs();
  const hasInput = customer.skinType || customer.formulation
    || customer.concerns.length || customer.age != null;
  if (!hasInput) {
    panel.classList.add('is-hidden');
    panel.innerHTML = '';
    return;
  }

  const rec = recommendFor(customer, getIndex(), loadCustomRules());
  const hasBase = rec.bases.length > 0;
  const hasIngs = rec.ingredients.length > 0;
  const hasCautions = rec.cautions.length > 0;

  if (!hasBase && !hasIngs && !hasCautions) {
    panel.classList.remove('is-hidden');
    panel.innerHTML = '<div class="formula-rec-note">선택한 조합의 추천 데이터는 준비 중입니다.</div>';
    return;
  }

  let html = '<div class="formula-rec-head">추천 베이스 · 원료 <span class="formula-rec-note">참고용 — 최종 조성은 고시 원문 확인</span></div>';

  if (hasBase) {
    html += `<div class="formula-rec-section"><div class="formula-rec-label">베이스 구성${customer.formulation ? ` — ${esc(customer.formulation)}` : ''}</div><div class="formula-rec-roles">`;
    rec.bases.forEach(b => {
      const star = b.required ? ' <span class="formula-rec-req" title="수상 제형 필수">*</span>' : '';
      const cands = b.candidates.length
        ? b.candidates.map(c => `<button type="button" class="formula-rec-chip" data-click="formulaRecAdd" data-arg="${esc(c)}">${esc(c)}</button>`).join('')
        : '<span class="formula-rec-nocand">직접 입력</span>';
      html += `<div class="formula-rec-role"><span class="formula-rec-role-name">${esc(b.role)}${star}</span><span class="formula-rec-cands">${cands}</span></div>`;
    });
    html += `</div><button type="button" class="btn btn-secondary btn-sm" data-click="formulaLoadBase"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> 베이스 불러오기 (필수 역할)</button></div>`;
  }

  if (hasIngs) {
    html += `<div class="formula-rec-section"><div class="formula-rec-label">추천 원료</div><div class="formula-rec-cands">`;
    rec.ingredients.forEach(i => {
      const limitTag = i.limit ? ` <span class="formula-rec-limit">≤${esc(i.limit)}</span>` : '';
      const cautionTag = i.irritant ? ' <span class="formula-rec-irritant" title="연령대 자극 주의">⚠</span>' : '';
      const reason = i.reasons.join('·');
      html += `<button type="button" class="formula-rec-chip" data-click="formulaRecAdd" data-arg="${esc(i.name)}" title="${esc(reason)}">${esc(i.name)}${limitTag}${cautionTag}<span class="formula-rec-reason">${esc(reason)}</span></button>`;
    });
    html += '</div></div>';
  }

  if (hasCautions) {
    html += `<div class="formula-rec-cautions">${rec.cautions.map(c => `<div><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${esc(c)}</div>`).join('')}</div>`;
  }

  panel.innerHTML = html;
  panel.classList.remove('is-hidden');
}

/** 추천 칩 클릭 → 현재 계산기에 행 추가 (뷰 전환 없음) */
export function formulaRecAdd(name) {
  if (typeof name !== 'string' || !name.trim()) return;
  const trimmed = name.trim();
  if (calc.rows.some(r => r.name === trimmed)) {
    showToast(`"${trimmed}"은(는) 이미 추가되어 있습니다.`, 'info');
    return;
  }
  const last = calc.rows[calc.rows.length - 1];
  if (last && !last.name) last.name = trimmed;
  else calc.rows.push({ name: trimmed, concentration: null });
  renderCalcRows();
}

/** 베이스 불러오기 — required 역할의 첫 후보를 행으로 채움 */
export function formulaLoadBase() {
  const { formulation } = readCustomerInputs();
  const names = baseDefaultCandidates(formulation);
  if (!names.length) {
    showToast('이 제형의 자동 베이스가 없습니다.', 'info');
    return;
  }
  let added = 0;
  names.forEach(name => {
    if (calc.rows.some(r => r.name === name)) return;
    const empty = calc.rows.find(r => !r.name);
    if (empty) empty.name = name;
    else calc.rows.push({ name, concentration: null });
    added++;
  });
  renderCalcRows();
  showToast(added ? `베이스 원료 ${added}종을 추가했습니다 — 배합률을 입력하세요.` : '이미 모두 추가되어 있습니다.', 'success');
}

/* =======================================================
   맞춤 추천 규칙 (사용자 후보 — 기본 매핑에 병합)
   ======================================================= */

const RULE_SCOPE_LABEL = { base: '베이스 역할', concern: '피부 고민', skin: '피부 유형' };

function renderCustomRules() {
  const targetEl = document.getElementById('formula-rule-target');
  const listEl = document.getElementById('formula-rule-list');
  if (!listEl) return;

  // 대상 셀렉트 1회 채우기 (optgroup: 베이스 역할 / 피부 고민 / 피부 유형)
  if (targetEl && !targetEl.dataset.bound) {
    targetEl.dataset.bound = '1';
    const targets = customRuleTargets();
    Object.keys(RULE_SCOPE_LABEL).forEach(scope => {
      const group = document.createElement('optgroup');
      group.label = RULE_SCOPE_LABEL[scope];
      (targets[scope] || []).forEach(key => {
        const o = document.createElement('option');
        o.value = `${scope}|${key}`;
        o.textContent = key;
        group.appendChild(o);
      });
      targetEl.appendChild(group);
    });
  }

  // 현재 맞춤 후보 목록
  const rules = loadCustomRules();
  let html = '';
  Object.keys(RULE_SCOPE_LABEL).forEach(scope => {
    Object.entries(rules[scope] || {}).forEach(([key, names]) => {
      names.forEach(name => {
        html += `<span class="formula-rule-chip"><span class="formula-rule-chip-key">${esc(RULE_SCOPE_LABEL[scope])} · ${esc(key)}</span> ${esc(name)}`
          + `<button type="button" class="formula-rule-chip-x" data-click="formulaRuleRemove" data-arg="${esc(`${scope}|${key}|${name}`)}" aria-label="${esc(name)} 맞춤 후보 삭제"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></span>`;
      });
    });
  });
  listEl.innerHTML = html || '<span class="formula-rec-note">등록된 맞춤 후보가 없습니다. 대상을 고르고 원료명을 추가하세요.</span>';
}

/** 맞춤 후보 추가 — 셀렉트 대상 + 원료명 입력 */
export function formulaRuleAdd() {
  const targetEl = document.getElementById('formula-rule-target');
  const nameEl = document.getElementById('formula-rule-name');
  const target = targetEl ? targetEl.value : '';
  const sep = target.indexOf('|');
  const scope = sep > 0 ? target.slice(0, sep) : '';
  const key = sep > 0 ? target.slice(sep + 1) : '';
  const name = nameEl ? nameEl.value : '';

  const r = addCustomCandidate(scope, key, name);
  if (!r.ok) { showToast(r.error || '추가에 실패했습니다.', 'error'); return; }

  // banned·미등록 원료는 추천에서 자동 제외됨 — 추가 시점에 안내
  const ing = getIndex().get(name.trim());
  if (!ing) {
    showToast(`"${name.trim()}"은(는) 원료 DB에 없어 추천에 표시되지 않습니다.`, 'info');
  } else if (ing.type === 'banned') {
    showToast(`"${name.trim()}"은(는) 사용 불가 원료라 추천에서 제외됩니다.`, 'info');
  } else {
    showToast(`"${name.trim()}"을(를) "${key}" 추천 후보에 추가했습니다.`, 'success');
  }
  if (nameEl) nameEl.value = '';
  renderCustomRules();
  renderRecommend();
}

/** 맞춤 후보 삭제 — data-arg: "scope|key|name" */
export function formulaRuleRemove(arg) {
  if (typeof arg !== 'string') return;
  const parts = arg.split('|');
  const scope = parts[0];
  const key = parts[1] || '';
  const name = parts.slice(2).join('|');
  const r = removeCustomCandidate(scope, key, name);
  if (!r.ok) { showToast(r.error || '삭제에 실패했습니다.', 'error'); return; }
  showToast(`"${name}" 맞춤 후보를 삭제했습니다.`, 'success');
  renderCustomRules();
  renderRecommend();
}

/** 맞춤 규칙 전체 초기화 */
export function formulaRuleReset() {
  showConfirm('등록한 맞춤 추천 규칙을 모두 초기화할까요?', () => {
    if (resetCustomRules()) {
      showToast('맞춤 추천 규칙을 초기화했습니다.', 'success');
      renderCustomRules();
      renderRecommend();
    } else {
      showToast('초기화에 실패했습니다.', 'error');
    }
  });
}

/** 맞춤 규칙 JSON 내보내기 — 외부 공유·편집용 파일 다운로드 */
export function formulaRuleExport() {
  const json = serializeCustomRules();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `formula_rules_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('맞춤 추천 규칙 파일을 다운로드했습니다.', 'success');
}

/** JSON 가져오기 트리거 — 숨겨진 파일 입력 클릭 */
export function formulaRuleImport() {
  const input = document.getElementById('formula-rule-file-input');
  if (!input) return;
  if (!input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('change', formulaRuleImportFile);
  }
  input.click();
}

/** 규칙 JSON 파일 읽기 → importCustomRules 병합 */
function formulaRuleImportFile(event) {
  const input = event.target;
  const file = input && input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const r = importCustomRules(e.target && e.target.result);
    if (!r.ok) {
      showToast(r.error || '가져오기에 실패했습니다.', 'error');
    } else {
      const skip = r.skipped ? `, 중복·한도 초과 ${r.skipped}건 제외` : '';
      showToast(`맞춤 규칙 ${r.added}건을 가져왔습니다${skip}.`, 'success');
      renderCustomRules();
      renderRecommend();
    }
    input.value = ''; // 같은 파일 재선택 허용
  };
  reader.onerror = () => { showToast('파일을 읽지 못했습니다.', 'error'); input.value = ''; };
  reader.readAsText(file);
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
  populateCustomerFields();

  const title = document.getElementById('formula-calc-title');
  if (title) title.textContent = calc.editingId ? '포뮬러 수정' : '배합 계산기';

  const volEl = document.getElementById('formula-target-volume');
  const unitEl = document.getElementById('formula-unit');
  const nameEl = document.getElementById('formula-name-input');
  const notesEl = document.getElementById('formula-notes-input');
  if (sourceFormula) {
    if (volEl) volEl.value = sourceFormula.targetVolume != null ? sourceFormula.targetVolume : '';
    if (unitEl) unitEl.value = sourceFormula.unit || 'g';
    if (nameEl) nameEl.value = sourceFormula.name || '';
    if (notesEl) notesEl.value = sourceFormula.notes || '';
  } else {
    if (volEl && !volEl.value) volEl.value = '100';
    if (unitEl) unitEl.value = 'g';
    if (nameEl) nameEl.value = '';
    if (notesEl) notesEl.value = '';
  }
  writeCustomerInputs(sourceFormula ? sourceFormula.customer : null);
  renderRecommend();
  renderCustomRules();

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
  const notesEl = document.getElementById('formula-notes-input');
  const notes = notesEl ? notesEl.value.trim() : '';
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

  const data = { name, targetVolume, unit, notes, customer: readCustomerInputs(), ingredients };
  const r = calc.editingId ? updateFormula(calc.editingId, data) : createFormula(data);

  if (!r.ok) { showToast(r.error || '저장에 실패했습니다.', 'error'); return; }
  calc.editingId = r.formula.id;
  showToast(`"${r.formula.name}" 포뮬러가 저장되었습니다.`, 'success');
  initFormulaView();
}
