// src/views/formula-customer.js — Formula OS 고객 관리 뷰 (Phase B)
//
// 목록(formula-customer-panel) + 폼(formula-customer-form-panel) +
// 상세(formula-customer-detail-panel) — formula.js의 showPanel/subNav 재사용.
//
// 고객은 독립 엔티티: 포뮬러·배치는 customerId로 참조하고 이름은 스냅샷으로
// 보존한다. 상담 이력은 append-only — 수정·삭제 대신 신규 기록을 권장.

import { esc } from '../sanitize.js';
import { showToast, showConfirm } from '../ui-utils.js';
import { showPanel, formulaSubNav } from './formula.js';
import { listFormulas, unlinkCustomerFromFormulas } from '../formula-store.js';
import { listBatches } from '../batch-store.js';
import {
  listCustomers, getCustomer, getCustomerUsage,
  createCustomer, updateCustomer, deleteCustomer, addConsultLog,
  CUSTOMER_LIMIT_FREE, SCALP_OPTIONS,
} from '../customer-store.js';
import { CUSTOMER_OPTIONS } from '../formula-store.js';
import { clampDate } from '../store-utils.js';

// 폼 상태 — editingId + 알레르기 칩 목록 (포뮬러 폼과 동일 패턴)
const cust = { editingId: null, allergies: [] };

/* =======================================================
   고객 목록
   ======================================================= */

export function openCustomerPanel() {
  showPanel('formula-customer-panel');
  const subnav = document.getElementById('formula-customer-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('customer');
  const list = document.getElementById('customer-list');
  if (!list) return;

  const usage = getCustomerUsage();
  const usageEl = document.getElementById('customer-list-usage');
  if (usageEl) usageEl.textContent = `${usage.count}/${usage.limit} 등록`;

  const customers = listCustomers();
  if (!customers.length) {
    list.innerHTML = `
      <div class="formula-empty">
        <i class="fa-solid fa-users" aria-hidden="true"></i>
        <h4>등록된 고객이 없습니다</h4>
        <p>고객 카드를 등록하면 처방·조제 기록에서 참조하고 상담 이력을 남길 수 있습니다.</p>
        <button class="btn btn-primary" data-click="custNew"><i class="fa-solid fa-plus" aria-hidden="true"></i> 첫 고객 등록</button>
      </div>`;
    return;
  }

  const formulas = listFormulas();
  const batches = listBatches();
  list.innerHTML = customers.map(c => {
    const meta = [c.age != null ? `${c.age}세` : '', c.gender, c.skinType, c.scalpType ? `두피 ${c.scalpType}` : '']
      .filter(Boolean).join(' · ');
    const tags = [
      c.concerns && c.concerns.length ? `고민: ${c.concerns.join(', ')}` : '',
      c.pregnancy || '',
      c.allergies && c.allergies.length ? `알레르기 ${c.allergies.length}종` : '',
    ].filter(Boolean).join(' · ');
    const fCount = formulas.filter(f => f.customerId === c.id).length;
    const bCount = batches.filter(b => b.customerId === c.id).length;
    const logCount = (c.consultLog || []).length;
    return `
      <div class="formula-card">
        <div class="formula-card-head">
          <h4 class="formula-card-name">${esc(c.name)}</h4>
          <span class="formula-card-meta">${esc(meta || '정보 없음')}</span>
        </div>
        ${tags ? `<div class="formula-card-customer"><i class="fa-solid fa-tag" aria-hidden="true"></i> ${esc(tags)}</div>` : ''}
        <div class="formula-card-meta">처방 ${fCount}건 · 조제 ${bCount}회 · 상담 ${logCount}건</div>
        <div class="formula-card-actions">
          <button class="btn btn-primary btn-sm" data-click="custOpen" data-arg="${esc(c.id)}"><i class="fa-solid fa-eye" aria-hidden="true"></i> 상세</button>
          <button class="btn btn-secondary btn-sm" data-click="custEdit" data-arg="${esc(c.id)}"><i class="fa-solid fa-pen" aria-hidden="true"></i> 수정</button>
          <button class="btn btn-secondary btn-sm f-danger" data-click="custDelete" data-arg="${esc(c.id)}"><i class="fa-solid fa-trash" aria-hidden="true"></i> 삭제</button>
        </div>
      </div>`;
  }).join('');
}

/* =======================================================
   고객 폼 (신규 · 수정)
   ======================================================= */

function fillCustomerSelects() {
  const fill = (id, options, placeholder) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">${placeholder}</option>`
      + options.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  };
  fill('cust-gender', CUSTOMER_OPTIONS.gender, '미선택');
  fill('cust-skintype', CUSTOMER_OPTIONS.skinType, '미선택');
  fill('cust-scalptype', SCALP_OPTIONS, '미선택');
  fill('cust-pregnancy', CUSTOMER_OPTIONS.pregnancy, '해당 없음');
  const chipBox = document.getElementById('cust-concerns');
  if (chipBox && !chipBox.dataset.bound) {
    chipBox.dataset.bound = '1';
    chipBox.innerHTML = CUSTOMER_OPTIONS.concerns.map(v =>
      `<label class="formula-chip"><input type="checkbox" value="${esc(v)}"><span>${esc(v)}</span></label>`
    ).join('');
  }
}

function renderCustAllergyChips() {
  const box = document.getElementById('cust-allergies');
  if (!box) return;
  box.innerHTML = cust.allergies.map(n =>
    `<span class="formula-rule-chip formula-allergy-chip" data-name="${esc(n)}">${esc(n)}`
    + `<button type="button" class="formula-rule-chip-x" data-click="custAllergyRemove" data-arg="${esc(n)}" aria-label="${esc(n)} 삭제"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></span>`
  ).join('');
}

export function custAllergyAdd() {
  const input = document.getElementById('cust-allergy-input');
  const name = input ? input.value.trim() : '';
  if (!name) return;
  if (cust.allergies.includes(name)) {
    showToast(`"${name}"은(는) 이미 등록되어 있습니다.`, 'info');
    return;
  }
  cust.allergies.push(name);
  renderCustAllergyChips();
  if (input) input.value = '';
}

export function custAllergyRemove(name) {
  if (typeof name !== 'string') return;
  cust.allergies = cust.allergies.filter(n => n !== name);
  renderCustAllergyChips();
}

function writeCustomerForm(c) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v == null ? '' : v;
  };
  const src = c || {};
  set('cust-name', src.name || '');
  set('cust-age', src.age != null ? src.age : '');
  set('cust-gender', src.gender || '');
  set('cust-skintype', src.skinType || '');
  set('cust-scalptype', src.scalpType || '');
  set('cust-pregnancy', src.pregnancy || '');
  set('cust-products', src.products || '');
  set('cust-purpose', src.purpose || '');
  set('cust-notes', src.notes || '');
  cust.allergies = Array.isArray(src.allergies) ? src.allergies.slice() : [];
  renderCustAllergyChips();
  const chipBox = document.getElementById('cust-concerns');
  if (chipBox) {
    const selected = Array.isArray(src.concerns) ? src.concerns : [];
    chipBox.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = selected.includes(cb.value);
    });
  }
}

function readCustomerForm() {
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  const ageRaw = val('cust-age');
  const chipBox = document.getElementById('cust-concerns');
  const concerns = chipBox
    ? Array.from(chipBox.querySelectorAll('input:checked')).map(cb => cb.value)
    : [];
  return {
    name: val('cust-name'),
    age: ageRaw === '' ? null : parseInt(ageRaw, 10),
    gender: val('cust-gender'),
    skinType: val('cust-skintype'),
    scalpType: val('cust-scalptype'),
    concerns,
    allergies: cust.allergies.slice(),
    pregnancy: val('cust-pregnancy'),
    products: val('cust-products'),
    purpose: val('cust-purpose'),
    notes: val('cust-notes'),
  };
}

export function custNew() {
  cust.editingId = null;
  showPanel('formula-customer-form-panel');
  fillCustomerSelects();
  writeCustomerForm(null);
  const title = document.getElementById('customer-form-title');
  if (title) title.textContent = '고객 등록';
}

export function custEdit(id) {
  const c = getCustomer(id);
  if (!c) { showToast('고객을 찾을 수 없습니다.', 'error'); return; }
  cust.editingId = c.id;
  showPanel('formula-customer-form-panel');
  fillCustomerSelects();
  writeCustomerForm(c);
  const title = document.getElementById('customer-form-title');
  if (title) title.textContent = `고객 수정 — ${c.name}`;
}

export function custSave() {
  const data = readCustomerForm();
  const r = cust.editingId ? updateCustomer(cust.editingId, data) : createCustomer(data);
  if (!r.ok) { showToast(r.error || '저장에 실패했습니다.', 'error'); return; }
  showToast(`"${r.customer.name}" 고객이 저장되었습니다.`, 'success');
  custOpen(r.customer.id);
}

/* =======================================================
   고객 상세 — 상담 이력 + 참조 역조회
   ======================================================= */

export function custOpen(id) {
  const c = getCustomer(id);
  if (!c) { showToast('고객을 찾을 수 없습니다.', 'error'); return; }
  showPanel('formula-customer-detail-panel');
  const subnav = document.getElementById('customer-detail-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('customer');
  const box = document.getElementById('customer-detail');
  if (!box) return;

  const meta = [c.age != null ? `${c.age}세` : '', c.gender, c.skinType, c.scalpType ? `두피 ${c.scalpType}` : '']
    .filter(Boolean).join(' · ');
  const tags = [
    c.concerns && c.concerns.length ? `고민: ${c.concerns.join(', ')}` : '',
    c.purpose ? `목적: ${c.purpose}` : '',
    c.pregnancy || '',
    c.allergies && c.allergies.length ? `알레르기: ${c.allergies.join(', ')}` : '',
    c.products ? `사용 중: ${c.products}` : '',
  ].filter(Boolean).join(' · ');

  const logs = (c.consultLog || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const logHtml = logs.length
    ? logs.map(l => `<div class="cust-log-row"><span class="cust-log-date">${esc(l.date)}</span><span>${esc(l.text)}</span></div>`).join('')
    : '<div class="formula-rec-note">상담 이력이 없습니다.</div>';

  const formulas = listFormulas().filter(f => f.customerId === c.id);
  const batches = listBatches().filter(b => b.customerId === c.id);
  const fHtml = formulas.length
    ? formulas.map(f => `<button class="formula-rec-chip" data-click="formulaOpen" data-arg="${esc(f.id)}">${esc(f.name)}</button>`).join('')
    : '<span class="formula-rec-note">연결된 처방이 없습니다.</span>';
  const bHtml = batches.length
    ? batches.map(b => `<button class="formula-rec-chip" data-click="batchOpen" data-arg="${esc(b.id)}">${esc(b.batchNo)}</button>`).join('')
    : '<span class="formula-rec-note">조제 기록이 없습니다.</span>';

  box.innerHTML = `
    <div class="formula-card">
      <div class="formula-card-head">
        <h4 class="formula-card-name">${esc(c.name)}</h4>
        <span class="formula-card-meta">${esc(meta || '정보 없음')}</span>
      </div>
      ${tags ? `<div class="formula-card-customer"><i class="fa-solid fa-tag" aria-hidden="true"></i> ${esc(tags)}</div>` : ''}
      ${c.notes ? `<div class="formula-card-meta">메모: ${esc(c.notes)}</div>` : ''}

      <div class="cust-section">
        <div class="cust-section-head">상담 이력 <span class="fold-hint">추가만 가능 — 기록 보존</span></div>
        <div class="cust-log-list">${logHtml}</div>
        <div class="formula-allergy-input-row">
          <input type="text" id="cust-log-input" class="form-input" maxlength="300" placeholder="상담 내용 (예: 건조함 호소, 수분 세럼 요청)" aria-label="상담 내용">
          <button type="button" class="btn btn-secondary btn-sm" data-click="custLogAdd" data-arg="${esc(c.id)}"><i class="fa-solid fa-plus" aria-hidden="true"></i> 추가</button>
        </div>
      </div>

      <div class="cust-section">
        <div class="cust-section-head">이 고객의 처방</div>
        <div class="formula-rec-cands">${fHtml}</div>
      </div>
      <div class="cust-section">
        <div class="cust-section-head">이 고객의 조제</div>
        <div class="formula-rec-cands">${bHtml}</div>
      </div>

      <div class="formula-card-actions">
        <button class="btn btn-secondary btn-sm" data-click="custEdit" data-arg="${esc(c.id)}"><i class="fa-solid fa-pen" aria-hidden="true"></i> 수정</button>
        <button class="btn btn-secondary btn-sm f-danger" data-click="custDelete" data-arg="${esc(c.id)}"><i class="fa-solid fa-trash" aria-hidden="true"></i> 삭제</button>
      </div>
    </div>`;
}

/** 상담 이력 추가 — 오늘 날짜로 append */
export function custLogAdd(id) {
  const input = document.getElementById('cust-log-input');
  const text = input ? input.value.trim() : '';
  const r = addConsultLog(id, text);
  if (!r.ok) { showToast(r.error || '추가에 실패했습니다.', 'error'); return; }
  showToast('상담 이력을 기록했습니다.', 'success');
  custOpen(id);
}

export async function custDelete(id) {
  const c = getCustomer(id);
  if (!c) return;
  const linked = listFormulas().filter(f => f.customerId === c.id).length;
  const warn = linked ? ` 연결된 처방 ${linked}건은 고객 정보만 남기고 연결이 해제됩니다.` : '';
  const ok = await showConfirm(`"${c.name}" 고객을 삭제할까요?${warn} 이 작업은 되돌릴 수 없습니다.`, '고객 삭제');
  if (!ok) return;
  unlinkCustomerFromFormulas(id);
  const r = deleteCustomer(id);
  if (!r.ok) { showToast(r.error || '삭제에 실패했습니다.', 'error'); return; }
  showToast('고객이 삭제되었습니다.', 'success');
  openCustomerPanel();
}
