// src/views/formula-fields.js — 처방 작업대 고객·안정성 필드 블록 (formula.js에서 분리)
// @spec FO-06~08
// 고객 정보 선택지 채우기·고객 카드 불러오기/저장·안정성 확인 필드 읽기/쓰기·
// 알레르기 칩·접이식 섹션 요약. 공유 상태(calc)·getEl·readCalcInputs는
// formula.js에서 import한다 (런타임 호출 전용 순환 — formula-recommend.js와 동일 패턴).
import { esc } from '../../../sanitize.js';
import { showToast } from '../../../ui-utils.js';
import { showStoreError } from '../../../pro-upgrade.js';
import {
  CUSTOMER_OPTIONS, STABILITY_METHODS, STABILITY_RESULTS,
} from '../formula-store.js';
import { listCustomers, getCustomer, createCustomer } from '../customer-store.js';
import { renderRecommend } from './formula-recommend.js';
import { getEl, calc, getIndex, readCalcInputs } from './formula.js';

/** 고객 정보 선택지(select·칩)를 CUSTOMER_OPTIONS에서 채운다 — 1회만 */
export function populateCustomerFields() {
  const genderEl = getEl('formula-cust-gender');
  if (genderEl && !genderEl.dataset.bound) {
    genderEl.dataset.bound = '1';
    CUSTOMER_OPTIONS.gender.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      genderEl.appendChild(o);
    });
  }
  const skinEl = getEl('formula-cust-skintype');
  if (skinEl && !skinEl.dataset.bound) {
    skinEl.dataset.bound = '1';
    CUSTOMER_OPTIONS.skinType.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      skinEl.appendChild(o);
    });
  }
  const formEl = getEl('formula-cust-formulation');
  if (formEl && !formEl.dataset.bound) {
    formEl.dataset.bound = '1';
    CUSTOMER_OPTIONS.formulation.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      formEl.appendChild(o);
    });
  }
  const chipBox = getEl('formula-cust-concerns');
  if (chipBox && !chipBox.dataset.bound) {
    chipBox.dataset.bound = '1';
    CUSTOMER_OPTIONS.concerns.forEach(v => {
      const label = document.createElement('label');
      label.className = 'formula-chip';
      label.innerHTML = `<input type="checkbox" value="${esc(v)}"><span>${esc(v)}</span>`;
      chipBox.appendChild(label);
    });
  }
  const pregEl = getEl('formula-cust-pregnancy');
  if (pregEl && !pregEl.dataset.bound) {
    pregEl.dataset.bound = '1';
    CUSTOMER_OPTIONS.pregnancy.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      pregEl.appendChild(o);
    });
  }

  // 고객 필드 변경 → 추천 패널 갱신 (1회 바인딩)
  const self = /** @type {{_recBound?: boolean}} */ (/** @type {any} */ (populateCustomerFields));
  if (!self._recBound) {
    self._recBound = true;
    ['formula-cust-gender', 'formula-cust-skintype', 'formula-cust-formulation', 'formula-cust-age', 'formula-cust-name',
      'formula-cust-pregnancy', 'formula-cust-products']
      .forEach(id => {
        const el = getEl(id);
        if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderRecommend);
      });
    if (chipBox) chipBox.addEventListener('change', renderRecommend);
  }

  // 고객 카드 셀렉트 — 등록 고객이 변하므로 매번 다시 채운다
  const refEl = getEl('formula-cust-ref');
  if (refEl) {
    refEl.innerHTML = '<option value="">고객 카드에서 불러오기…</option>'
      + listCustomers().map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    refEl.value = (getEl('formula-cust-id') || {}).value || '';
    if (!refEl.dataset.bound) {
      refEl.dataset.bound = '1';
      refEl.addEventListener('change', formulaCustLoad);
    }
  }
}

/** 고객 카드 선택 → 고객 정보 필드 채우기 + customerId 참조 저장 */
export function formulaCustLoad() {
  const sel = getEl('formula-cust-ref');
  const id = sel ? sel.value : '';
  if (!id) return;
  const c = getCustomer(id);
  if (!c) { showToast('고객을 찾을 수 없습니다.', 'error'); return; }
  writeCustomerInputs(c, c.id);
  updateFoldSummaries();
  renderRecommend();
}

/** 현재 고객 정보 입력값을 고객 카드로 저장 + 이 포뮬러에 참조 연결 */
export function formulaCustSaveAs() {
  const data = readCustomerInputs();
  const r = createCustomer(data);
  if (!r.ok) { showStoreError(r, '고객 관리', showToast, '고객 등록에 실패했습니다.'); return; }
  const idEl = getEl('formula-cust-id');
  if (idEl) idEl.value = r.customer.id;
  const refEl = getEl('formula-cust-ref');
  if (refEl) {
    const opt = document.createElement('option');
    opt.value = r.customer.id;
    opt.textContent = r.customer.name;
    refEl.appendChild(opt);
    refEl.value = r.customer.id;
  }
  showToast(`"${r.customer.name}" 고객 카드를 만들고 연결했습니다.`, 'success');
}

/** 안정성 실험 확인 셀렉트를 STABILITY_* 상수에서 채운다 — 1회만 */
export function populateStabilityFields() {
  const methodEl = getEl('formula-stab-method');
  if (methodEl && !methodEl.dataset.bound) {
    methodEl.dataset.bound = '1';
    STABILITY_METHODS.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      methodEl.appendChild(o);
    });
  }
  const resultEl = getEl('formula-stab-result');
  if (resultEl && !resultEl.dataset.bound) {
    resultEl.dataset.bound = '1';
    STABILITY_RESULTS.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      resultEl.appendChild(o);
    });
  }
}

/** 안정성 확인 필드 현재 값 읽기 → store 스키마 */
export function readStabilityInputs() {
  const val = id => {
    const el = getEl(id);
    return el ? el.value : '';
  };
  return {
    method: val('formula-stab-method'),
    result: val('formula-stab-result'),
    note: val('formula-stab-note').trim(),
  };
}

/** 안정성 확인 필드에 값 복원 (sourceFormula.stability) */
export function writeStabilityInputs(stab) {
  const s = stab || {};
  const set = (id, v) => {
    const el = getEl(id);
    if (el) el.value = v || '';
  };
  set('formula-stab-method', s.method || '');
  set('formula-stab-result', s.result || '');
  set('formula-stab-note', s.note || '');
}

/** 고객 필드 현재 값 읽기 → store 스키마 */
export function readCustomerInputs() {
  const val = id => {
    const el = getEl(id);
    return el ? el.value : '';
  };
  const ageRaw = val('formula-cust-age');
  const chipBox = getEl('formula-cust-concerns');
  const concerns = chipBox
    ? Array.from(chipBox.querySelectorAll('input:checked')).map(cb => /** @type {HTMLInputElement} */ (cb).value)
    : [];
  const allergyBox = getEl('formula-cust-allergies');
  const allergies = allergyBox
    ? Array.from(allergyBox.querySelectorAll('.formula-allergy-chip')).map(c => /** @type {HTMLElement} */ (c).dataset.name || '').filter(Boolean)
    : [];
  return {
    name: val('formula-cust-name').trim(),
    age: ageRaw === '' ? null : parseInt(ageRaw, 10),
    gender: val('formula-cust-gender'),
    skinType: val('formula-cust-skintype'),
    concerns,
    formulation: val('formula-cust-formulation'),
    allergies,
    pregnancy: val('formula-cust-pregnancy'),
    products: val('formula-cust-products').trim(),
  };
}

/** 고객 필드에 값 복원 (sourceFormula.customer) + 고객 카드 참조 복원 */
export function writeCustomerInputs(customer, customerId) {
  const c = customer || {};
  const set = (id, v) => {
    const el = getEl(id);
    if (el) el.value = v == null ? '' : v;
  };
  set('formula-cust-id', customerId || '');
  const refEl = getEl('formula-cust-ref');
  if (refEl) refEl.value = customerId || '';
  set('formula-cust-name', c.name || '');
  set('formula-cust-age', c.age != null ? c.age : '');
  set('formula-cust-gender', c.gender || '');
  set('formula-cust-skintype', c.skinType || '');
  set('formula-cust-formulation', c.formulation || '');
  set('formula-cust-pregnancy', c.pregnancy || '');
  set('formula-cust-products', c.products || '');
  renderAllergyChips(Array.isArray(c.allergies) ? c.allergies : []);
  const chipBox = getEl('formula-cust-concerns');
  if (chipBox) {
    const selected = Array.isArray(c.concerns) ? c.concerns : [];
    chipBox.querySelectorAll('input[type="checkbox"]').forEach(el => {
      const cb = /** @type {HTMLInputElement} */ (el);
      cb.checked = selected.includes(cb.value);
    });
  }
}

/** 알레르기 원료 칩 렌더 */
function renderAllergyChips(allergies) {
  const box = getEl('formula-cust-allergies');
  if (!box) return;
  box.innerHTML = allergies.length
    ? allergies.map(n => `<span class="formula-rule-chip formula-allergy-chip" data-name="${esc(n)}">${esc(n)}`
        + `<button type="button" class="formula-rule-chip-x" data-click="formulaAllergyRemove" data-arg="${esc(n)}" aria-label="${esc(n)} 알레르기 이력 삭제"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></span>`).join('')
    : '';
}

/** 알레르기 원료 추가 — 입력값을 칩으로 등록 */
export function formulaAllergyAdd() {
  const input = getEl('formula-allergy-input');
  const name = input ? input.value.trim() : '';
  if (!name) return;
  const current = readCustomerInputs().allergies;
  if (current.includes(name)) {
    showToast(`"${name}"은(는) 이미 등록되어 있습니다.`, 'info');
    return;
  }
  if (current.length >= 15) {
    showToast('알레르기 이력은 최대 15종까지 등록할 수 있습니다.', 'info');
    return;
  }
  renderAllergyChips([...current, name]);
  if (input) input.value = '';
  const ing = getIndex().get(name);
  if (!ing) showToast(`"${name}"은(는) DB 미등록 — 추천 필터에는 동작하지만 원문 확인이 필요합니다.`, 'info');
  renderRecommend();
}

/** 알레르기 원료 칩 삭제 */
export function formulaAllergyRemove(name) {
  if (typeof name !== 'string') return;
  renderAllergyChips(readCustomerInputs().allergies.filter(n => n !== name));
  renderRecommend();
}

/** 접이식 섹션 제목 옆 요약 — 내용이 있으면 '김OO · 건성' 형태로 표시 */
export function updateFoldSummaries() {
  const custEl = getEl('fold-sum-customer');
  if (custEl) {
    const c = readCustomerInputs();
    const parts = [
      c.name, c.age != null ? `${c.age}세` : '', c.gender, c.skinType, c.formulation,
      c.concerns.length ? `고민 ${c.concerns.length}` : '',
      c.pregnancy, c.allergies.length ? `알레르기 ${c.allergies.length}종` : '',
      c.products ? '제품 기록' : '',
    ].filter(Boolean);
    custEl.textContent = parts.join(' · ');
  }
  const procEl = getEl('fold-sum-process');
  if (procEl) {
    const { phTarget, phActual } = readCalcInputs();
    const notesEl = getEl('formula-notes-input');
    const parts = [];
    if (phTarget != null || phActual != null) {
      parts.push(`pH ${phTarget != null ? phTarget : '—'}/${phActual != null ? phActual : '—'}`);
    }
    if (calc.steps.length) parts.push(`절차 ${calc.steps.length}단계`);
    const stab = readStabilityInputs();
    if (stab.result) parts.push(`안정성 ${stab.result}`);
    else if (stab.method) parts.push('안정성 기록');
    if (notesEl && notesEl.value.trim()) parts.push('메모');
    procEl.textContent = parts.join(' · ');
  }
}
