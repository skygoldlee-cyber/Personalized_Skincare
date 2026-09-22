// src/views/formula.js — Formula OS 뷰 컨트롤러 (Phase 5-A)
//
// 허브(메뉴) + My 포뮬러 목록 + 배합 계산기 서브뷰.
// 트레이너와 동일한 패턴: 하나의 view-section 안에서 패널을 is-hidden으로 전환.
//
// 안전 원칙: 배합량을 "제안"하지 않고 사용자가 입력한 값을 고시 데이터로
// "검증"만 한다. 검증 결과는 법정 한도 기준이며 제품 안전성·안정성·품질 보장이 아니다.

import { esc } from '../sanitize.js';
import { showToast, showConfirm } from '../ui-utils.js';
import { switchView } from './navigation.js';
import {
  CHECK, buildIngredientIndex, checkFormulaItems,
} from '../formula-check.js';
import { STAB, evaluateStability } from '../formula-stability.js';
import {
  listFormulas, getFormula, createFormula, updateFormula,
  deleteFormula, duplicateFormula, getFormulaUsage, calcAmounts,
  CUSTOMER_OPTIONS, PHASE_OPTIONS, STABILITY_METHODS, STABILITY_RESULTS,
  serializeFormula, importFormula,
} from '../formula-store.js';
import {
  recommendFor, baseDefaultCandidates,
  loadCustomRules, addCustomCandidate, removeCustomCandidate,
  resetCustomRules, customRuleTargets,
  serializeCustomRules, importCustomRules,
  ROLE_PHASE,
} from '../formula-rules.js';
import { listCustomers, getCustomer, createCustomer } from '../customer-store.js';
import { findMaterialByName, materialStatus, daysUntilExpiry } from '../material-ledger.js';

const PANELS = [
  'formula-menu-panel', 'formula-list-panel', 'formula-calc-panel',
  'formula-batch-panel', 'formula-batch-form-panel', 'formula-batch-detail-panel',
  'formula-customer-panel', 'formula-customer-form-panel', 'formula-customer-detail-panel',
  'formula-material-panel', 'formula-material-form-panel',
  'formula-compliance-panel',
];

// 계산기 드래프트 상태 (저장 전 작업 데이터)
const calc = {
  rows: [{ name: '', concentration: null, phase: '' }],
  steps: [],
  editingId: null,   // null이면 신규, id면 기존 포뮬러 수정
  stabRecordedAt: null, // 안정성 확인 기록의 저장 시각(자동 부여)
};

let ingredientIndex = null;

function getIndex() {
  if (!ingredientIndex) {
    const db = typeof window.INGREDIENTS_DATA !== 'undefined' ? window.INGREDIENTS_DATA : [];
    ingredientIndex = buildIngredientIndex(db);
  }
  return ingredientIndex;
}

export function showPanel(id) {
  PANELS.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.toggle('is-hidden', p !== id);
  });
}

/* =======================================================
   서브내비 — 허브 복귀 없이 관련 섹션으로 1클릭 이동
   ======================================================= */

const SUBNAV_ITEMS = [
  { id: 'list', label: 'My 포뮬러', click: 'openFormulaList' },
  { id: 'calc', label: '배합 계산기', click: 'formulaNew' },
  { id: 'customer', label: '고객 관리', click: 'openCustomerPanel' },
  { id: 'batch', label: '조제 기록', click: 'openBatchPanel' },
  { id: 'material', label: '원료 장부', click: 'openMaterialPanel' },
  { id: 'compliance', label: '법규 준수', click: 'openCompliancePanel' },
];

/**
 * 서브내비 칩 HTML — 서브패널 헤더에 삽입.
 * @param {string} active - 현재 패널의 SUBNAV_ITEMS.id (활성 칩 표시)
 */
export function formulaSubNav(active) {
  return `<div class="formula-subnav" role="navigation" aria-label="Formula OS 섹션 이동">${SUBNAV_ITEMS.map(item => {
    const cls = item.id === active ? 'formula-subnav-chip is-active' : 'formula-subnav-chip';
    return `<button type="button" class="${cls}" data-click="${item.click}">${esc(item.label)}</button>`;
  }).join('')}</div>`;
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
    calc.rows.push({ name: trimmed, concentration: null, phase: '' });
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

/**
 * 저장 시점 스냅샷(ingredients[].snapshot)과 현재 원료 DB를 비교해
 * 고시 개정으로 기준(type/limit)이 바뀐 원료 수를 반환한다.
 */
export function countChangedStandards(formula, index) {
  let changed = 0;
  (formula.ingredients || []).forEach(item => {
    if (!item || !item.snapshot || !item.name) return;
    const cur = index && typeof index.get === 'function' ? index.get(item.name) : null;
    if (!cur) return; // 현재 DB 미등록은 unknown 판정이 이미 커버
    if ((item.snapshot.type || '') !== (cur.type || '')
      || (item.snapshot.limit || '') !== (cur.limit || '')) {
      changed++;
    }
  });
  return changed;
}

function checkSummaryHtml(formula) {
  const index = getIndex();
  const { summary } = checkFormulaItems(
    (formula.ingredients || []).map(i => ({ name: i.name, concentration: i.concentration })),
    index
  );
  const parts = [];
  const changed = countChangedStandards(formula, index);
  if (changed) {
    parts.push(`<span class="f-check f-check-warn" title="저장 후 고시 기준이 변경된 원료 ${changed}종 — 재검증 권장">기준 변경 ${changed}</span>`);
  }
  if (summary.banned) parts.push(`<span class="f-check f-check-banned">금지 ${summary.banned}</span>`);
  if (summary.warn) parts.push(`<span class="f-check f-check-warn">초과 ${summary.warn}</span>`);
  if (summary.unknown) parts.push(`<span class="f-check f-check-unknown">확인 ${summary.unknown}</span>`);
  if (summary.ok) parts.push(`<span class="f-check f-check-ok">정상 ${summary.ok}</span>`);
  const stab = evaluateStability(formula.ingredients || [], getIndex(), {
    formulation: formula.customer && formula.customer.formulation,
    phTarget: formula.phTarget,
    phActual: formula.phActual,
    steps: formula.steps,
  });
  const warns = stab.warnings.filter(w => w.level === STAB.WARN).length;
  const infos = stab.warnings.length - warns;
  if (warns) parts.push(`<span class="f-check f-check-warn" title="제형 안정성 경고">안정성 ${warns}</span>`);
  if (infos) parts.push(`<span class="f-check f-check-unknown" title="제형 안정성 참고">참고 ${infos}</span>`);
  // 실험 확인 결과 — 규칙 경고보다 사용자 실험이 확정 근거
  if (formula.stability && formula.stability.result === '양호') {
    parts.push(`<span class="f-check f-check-ok" title="안정성 실험 확인${formula.stability.method ? `: ${esc(formula.stability.method)}` : ''}">안정성 확인</span>`);
  } else if (formula.stability && formula.stability.result === '이상 발견') {
    parts.push(`<span class="f-check f-check-banned" title="안정성 실험에서 이상 확인">안정성 이상</span>`);
  }
  return parts.join('');
}

export function openFormulaList() {
  showPanel('formula-list-panel');
  const subnav = document.getElementById('formula-list-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('list');
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
      if (f.customer.pregnancy) custParts.push(f.customer.pregnancy);
      if (f.customer.allergies && f.customer.allergies.length) custParts.push(`알레르기 ${f.customer.allergies.length}종`);
    }
    return `
      <div class="formula-card">
        <div class="formula-card-head">
          <h4 class="formula-card-name">${esc(f.name)}</h4>
          <span class="formula-card-meta">${esc(vol)} · 원료 ${ingCount}종 · ${date}</span>
        </div>
        ${custParts.length ? `<div class="formula-card-customer"><i class="fa-solid fa-user" aria-hidden="true"></i> ${esc(custParts.join(' · '))}</div>` : ''}
        <div class="formula-card-checks">${checkSummaryHtml(f)}</div>
        ${f.fullIngredients && f.fullIngredients.length ? `<div class="formula-card-inci" title="전성분 표시 순서 — 안정성 확인된 배합에 저장 시 자동 생성"><i class="fa-solid fa-list-ol" aria-hidden="true"></i> ${esc(f.fullIngredients.join(', '))}</div>` : ''}
        <div class="formula-card-actions">
          <button class="btn btn-primary btn-sm" data-click="formulaOpen" data-arg="${esc(f.id)}" title="배합 계산기에서 이 처방 열기"><i class="fa-solid fa-calculator" aria-hidden="true"></i> 열기</button>
          <button class="btn btn-secondary btn-sm" data-click="batchNew" data-arg="${esc(f.id)}" title="이 처방으로 조제한 회차 기록"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i> 조제 기록</button>
          <button class="btn btn-secondary btn-sm" data-click="formulaDuplicate" data-arg="${esc(f.id)}" title="이 처방을 복제해 새 포뮬러로 저장"><i class="fa-solid fa-copy" aria-hidden="true"></i> 복제</button>
          <button class="btn btn-secondary btn-sm" data-click="formulaCardExport" data-arg="${esc(f.id)}" title="JSON 파일로 보내기"><i class="fa-solid fa-file-export" aria-hidden="true"></i> 보내기</button>
          <button class="btn btn-secondary btn-sm f-danger" data-click="formulaDelete" data-arg="${esc(f.id)}" title="포뮬러 삭제 (복구 불가)"><i class="fa-solid fa-trash" aria-hidden="true"></i> 삭제</button>
        </div>
      </div>`;
  }).join('');
}

export function formulaNew() {
  calc.rows = [{ name: '', concentration: null, phase: '' }];
  calc.steps = [];
  calc.editingId = null;
  calc.stabRecordedAt = null;
  openFormulaCalc();
}

export function formulaOpen(id) {
  const f = getFormula(id);
  if (!f) { showToast('포뮬러를 찾을 수 없습니다.', 'error'); return; }
  calc.rows = (f.ingredients || []).map(i => ({ name: i.name, concentration: i.concentration, phase: i.phase || '' }));
  if (!calc.rows.length) calc.rows = [{ name: '', concentration: null, phase: '' }];
  calc.steps = Array.isArray(f.steps) ? f.steps.slice() : [];
  calc.editingId = f.id;
  calc.stabRecordedAt = f.stability && f.stability.recordedAt ? f.stability.recordedAt : null;
  openFormulaCalc(f);
}

export function formulaDuplicate(id) {
  const r = duplicateFormula(id);
  if (!r.ok) { showToast(r.error || '복제에 실패했습니다.', 'error'); return; }
  showToast(`"${r.formula.name}"이 생성되었습니다.`, 'success');
  openFormulaList();
}

export async function formulaDelete(id) {
  const f = getFormula(id);
  if (!f) return;
  const ok = await showConfirm(`"${f.name}" 포뮬러를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`, '포뮬러 삭제');
  if (!ok) return;
  const r = deleteFormula(id);
  if (!r.ok) { showToast(r.error || '삭제에 실패했습니다.', 'error'); return; }
  showToast('포뮬러가 삭제되었습니다.', 'success');
  openFormulaList();
}

/* =======================================================
   배합 계산기
   ======================================================= */

function readCalcInputs() {
  const volEl = document.getElementById('formula-target-volume');
  const unitEl = document.getElementById('formula-unit');
  const phTEl = document.getElementById('formula-ph-target');
  const phAEl = document.getElementById('formula-ph-actual');
  const num = el => (el && el.value !== '' ? parseFloat(el.value) : null);
  return {
    targetVolume: num(volEl),
    unit: unitEl ? unitEl.value : 'g',
    phTarget: num(phTEl),
    phActual: num(phAEl),
  };
}

function rowCheckInfo(item) {
  const index = getIndex();
  const ing = item.name ? index.get(item.name) : null;
  const r = checkFormulaItems([{ name: item.name, concentration: item.concentration }], index).results[0];
  const info = CHECK_BADGE[r.check] || CHECK_BADGE[CHECK.UNKNOWN];
  const label = !item.name ? '원료명 입력' : (ing ? info.label : 'DB 미등록');
  let html = `<span class="f-check ${info.cls}" title="${esc(r.note)}">${label}</span>`;
  // 원료 장부 연동 — 이름 정확 매칭 시 기한 임박·경과 경고 병기
  const mat = item.name ? findMaterialByName(item.name) : null;
  if (mat) {
    const s = materialStatus(mat);
    const days = daysUntilExpiry(mat);
    if (s === 'expired') {
      html += ` <span class="f-check f-check-banned" title="원료 장부 기한 경과 — 사용 금지">재고 기한 경과</span>`;
    } else if (s === 'soon') {
      html += ` <span class="f-check f-check-warn" title="원료 장부 기한 임박">재고 D-${days != null ? days : '?'}</span>`;
    }
  }
  return { check: r.check, html };
}

// 행을 다시 그리지 않고 계산 결과(투입량·배지·합계·단계 소계·검증 요약)만 갱신 — 입력 중 포커스 유지
function updateCalcComputed() {
  const { targetVolume, unit } = readCalcInputs();
  const container = document.getElementById('formula-calc-rows');
  if (!container) return;

  // 빈 상태 안내 배너 — 이름 있는 행이 없을 때만 표시 (입력 시점에도 갱신)
  const emptyEl = document.getElementById('formula-empty-state');
  if (emptyEl) emptyEl.classList.toggle('is-hidden', calc.rows.some(r => r.name));

  let sumConc = 0;
  let sumAmount = 0;
  const phaseSums = {}; // 단계별 배합률 소계
  const checkCounts = { ok: 0, warn: 0, banned: 0, unknown: 0 }; // 검증 요약 카운트
  container.querySelectorAll('.f-row').forEach((rowEl, i) => {
    const item = calc.rows[i];
    if (!item) return;
    const amountEl = rowEl.querySelector('.f-amount');
    const checkEl = rowEl.querySelector('.f-check-cell');
    const conc = item.concentration;
    const amount = targetVolume != null && conc != null ? Math.round(targetVolume * conc) / 100 : null;
    if (amountEl) amountEl.textContent = amount != null ? `= ${amount.toFixed(2)}${unit}` : '';
    if (checkEl) {
      if (item.name) {
        const info = rowCheckInfo(item);
        checkEl.innerHTML = info.html;
        checkCounts[info.check] = (checkCounts[info.check] || 0) + 1;
      } else {
        checkEl.innerHTML = '';
      }
    }
    if (conc != null) {
      sumConc += conc;
      const ph = item.phase || '기타';
      phaseSums[ph] = (phaseSums[ph] || 0) + conc;
    }
    if (amount != null) sumAmount += amount;
  });

  // 검증 요약 — 상단바 (문제 건수만, 전부 정상이면 정상 배지)
  const checkSumEl = document.getElementById('formula-check-summary');
  if (checkSumEl) {
    const named = calc.rows.filter(r => r.name).length;
    const parts = [];
    if (checkCounts.banned) parts.push(`<span class="f-check f-check-banned">금지 ${checkCounts.banned}</span>`);
    if (checkCounts.warn) parts.push(`<span class="f-check f-check-warn">초과 ${checkCounts.warn}</span>`);
    if (checkCounts.unknown) parts.push(`<span class="f-check f-check-unknown">확인 ${checkCounts.unknown}</span>`);
    if (!parts.length && named) parts.push(`<span class="f-check f-check-ok">정상 ${checkCounts.ok}</span>`);
    checkSumEl.innerHTML = parts.join('');
  }

  const sumConcEl = document.getElementById('formula-sum-conc');
  const sumAmountEl = document.getElementById('formula-sum-amount');
  const statusEl = document.getElementById('formula-sum-status');
  const rounded = Math.round(sumConc * 100) / 100;
  if (sumConcEl) sumConcEl.textContent = `${rounded}%`;
  if (sumAmountEl) sumAmountEl.textContent = targetVolume != null ? `${sumAmount.toFixed(2)}${unit}` : '—';
  // 합계 100% 판정 — 조제 기록으로서 전성분 합계 검증
  if (statusEl) {
    if (sumConc <= 0) {
      statusEl.textContent = '';
      statusEl.className = 'formula-sum-badge';
    } else if (Math.abs(rounded - 100) < 0.01) {
      statusEl.textContent = '100% 정상';
      statusEl.className = 'formula-sum-badge f-check f-check-ok';
    } else if (rounded > 100) {
      statusEl.textContent = `${(rounded - 100).toFixed(2)}% 초과`;
      statusEl.className = 'formula-sum-badge f-check f-check-banned';
    } else {
      statusEl.textContent = `${(100 - rounded).toFixed(2)}% 부족`;
      statusEl.className = 'formula-sum-badge f-check f-check-warn';
    }
  }
  // 단계별 소계 (입력된 단계만, PHASE_OPTIONS 순서)
  const phaseEl = document.getElementById('formula-phase-sums');
  if (phaseEl) {
    const parts = PHASE_OPTIONS
      .filter(p => phaseSums[p] != null)
      .map(p => `${p} ${Math.round(phaseSums[p] * 100) / 100}%`);
    phaseEl.textContent = parts.length ? `단계별: ${parts.join(' · ')}` : '';
  }
  renderStability();
}

/** 제형 안정성 패널 — 배합비·투입 단계·절차·pH 규칙 기반 경고 (법규 검증과 별개 축) */
function renderStability() {
  const panel = document.getElementById('formula-stability');
  if (!panel) return;
  const named = calc.rows.filter(r => r.name);
  if (!named.length) {
    panel.classList.add('is-hidden');
    panel.innerHTML = '';
    return;
  }
  const { phTarget, phActual } = readCalcInputs();
  const { warnings } = evaluateStability(named, getIndex(), {
    formulation: readCustomerInputs().formulation,
    phTarget, phActual,
    steps: calc.steps,
  });
  const stab = readStabilityInputs();
  const stabRecorded = stab.method || stab.result || stab.note;
  if (!warnings.length && !stabRecorded) {
    panel.classList.add('is-hidden');
    panel.innerHTML = '';
    return;
  }
  // 실험 확인 상태 — 규칙 경고보다 사용자 실험이 확정 근거
  let confirmHtml = '';
  if (stabRecorded) {
    const recorded = calc.stabRecordedAt ? `기록 ${calc.stabRecordedAt.replace('T', ' ')}` : '';
    const parts = [stab.method, stab.result, recorded, stab.note].filter(Boolean);
    const cls = stab.result === '양호' ? 'f-stab-good' : (stab.result === '이상 발견' ? 'f-stab-bad' : 'f-stab-info');
    const ic = stab.result === '양호' ? 'fa-circle-check' : (stab.result === '이상 발견' ? 'fa-triangle-exclamation' : 'fa-flask');
    confirmHtml = `<div class="formula-stab-confirm ${cls}"><i class="fa-solid ${ic}" aria-hidden="true"></i> 실험 확인 기록: ${esc(parts.join(' · '))}</div>`;
  }
  const icon = l => l === STAB.WARN
    ? '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>'
    : '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>';
  panel.innerHTML = `
    <div class="formula-stab-head"><i class="fa-solid fa-flask" aria-hidden="true"></i> 제형 안정성
      <span class="formula-rec-note">규칙 기반 참고 — 실제 안정성은 제조 정보의 실험 확인으로 확정</span></div>
    ${confirmHtml}
    ${warnings.length ? `<ul class="formula-stab-list">
      ${warnings.map(w => `<li class="f-stab-${w.level}">${icon(w.level)} ${esc(w.msg)}</li>`).join('')}
    </ul>` : ''}`;
  panel.classList.remove('is-hidden');
}

function renderCalcRows() {
  const container = document.getElementById('formula-calc-rows');
  if (!container) return;

  container.innerHTML = '';
  calc.rows.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'f-row';
    row.innerHTML = `
      <div class="f-row-top">
        <input type="text" class="f-name" list="formula-ing-datalist" value="${esc(item.name)}"
               placeholder="원료명 (예: 글리세린)" aria-label="원료 ${i + 1} 이름">
        <span class="f-check-cell"></span>
        <button type="button" class="f-del" data-click="formulaCalcRemoveRow" data-arg="${i}"
                aria-label="원료 ${i + 1} 삭제"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="f-row-bottom">
        <input type="number" class="f-conc" min="0" step="0.01" value="${item.concentration != null ? item.concentration : ''}"
               placeholder="%" aria-label="원료 ${i + 1} 배합률(%)">
        <span class="f-amount"></span>
        <select class="f-phase" aria-label="원료 ${i + 1} 제조 단계">
          <option value="">단계</option>
          ${PHASE_OPTIONS.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
        </select>
      </div>`;

    const nameEl = row.querySelector('.f-name');
    const concEl = row.querySelector('.f-conc');
    const phaseEl = row.querySelector('.f-phase');
    phaseEl.value = item.phase || '';
    nameEl.addEventListener('input', () => {
      calc.rows[i].name = nameEl.value.trim();
      updateCalcComputed();
    });
    concEl.addEventListener('input', () => {
      const v = concEl.value === '' ? null : parseFloat(concEl.value);
      calc.rows[i].concentration = (v != null && !Number.isNaN(v)) ? v : null;
      updateCalcComputed();
    });
    phaseEl.addEventListener('change', () => {
      calc.rows[i].phase = phaseEl.value;
      updateCalcComputed();
    });
    container.appendChild(row);
  });
  updateCalcComputed();
}

/** 행을 제조 단계(PHASE_OPTIONS) 순서로 정렬 — 지정 안 한 행은 맨 뒤 */
export function formulaSortPhase() {
  const order = p => {
    const i = PHASE_OPTIONS.indexOf(p);
    return i < 0 ? PHASE_OPTIONS.length : i;
  };
  calc.rows.sort((a, b) => order(a.phase) - order(b.phase));
  renderCalcRows();
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
  const pregEl = document.getElementById('formula-cust-pregnancy');
  if (pregEl && !pregEl.dataset.bound) {
    pregEl.dataset.bound = '1';
    CUSTOMER_OPTIONS.pregnancy.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      pregEl.appendChild(o);
    });
  }

  // 고객 필드 변경 → 추천 패널 갱신 (1회 바인딩)
  if (!populateCustomerFields._recBound) {
    populateCustomerFields._recBound = true;
    ['formula-cust-gender', 'formula-cust-skintype', 'formula-cust-formulation', 'formula-cust-age', 'formula-cust-name',
      'formula-cust-pregnancy', 'formula-cust-products']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderRecommend);
      });
    if (chipBox) chipBox.addEventListener('change', renderRecommend);
  }

  // 고객 카드 셀렉트 — 등록 고객이 변하므로 매번 다시 채운다
  const refEl = document.getElementById('formula-cust-ref');
  if (refEl) {
    refEl.innerHTML = '<option value="">고객 카드에서 불러오기…</option>'
      + listCustomers().map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    refEl.value = (document.getElementById('formula-cust-id') || {}).value || '';
    if (!refEl.dataset.bound) {
      refEl.dataset.bound = '1';
      refEl.addEventListener('change', formulaCustLoad);
    }
  }
}

/** 고객 카드 선택 → 고객 정보 필드 채우기 + customerId 참조 저장 */
export function formulaCustLoad() {
  const sel = document.getElementById('formula-cust-ref');
  const id = sel ? sel.value : '';
  if (!id) return;
  const c = getCustomer(id);
  if (!c) { showToast('고객을 찾을 수 없습니다.', 'error'); return; }
  writeCustomerInputs(c, c.id);
  updateFoldSummaries();
  renderRecommend();
  showToast(`"${c.name}" 고객 정보를 불러왔습니다.`, 'success');
}

/** 현재 고객 정보 입력값을 고객 카드로 저장 + 이 포뮬러에 참조 연결 */
export function formulaCustSaveAs() {
  const data = readCustomerInputs();
  const r = createCustomer(data);
  if (!r.ok) { showToast(r.error || '고객 등록에 실패했습니다.', 'error'); return; }
  const idEl = document.getElementById('formula-cust-id');
  if (idEl) idEl.value = r.customer.id;
  const refEl = document.getElementById('formula-cust-ref');
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
function populateStabilityFields() {
  const methodEl = document.getElementById('formula-stab-method');
  if (methodEl && !methodEl.dataset.bound) {
    methodEl.dataset.bound = '1';
    STABILITY_METHODS.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      methodEl.appendChild(o);
    });
  }
  const resultEl = document.getElementById('formula-stab-result');
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
function readStabilityInputs() {
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  return {
    method: val('formula-stab-method'),
    result: val('formula-stab-result'),
    note: val('formula-stab-note').trim(),
  };
}

/** 안정성 확인 필드에 값 복원 (sourceFormula.stability) */
function writeStabilityInputs(stab) {
  const s = stab || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || '';
  };
  set('formula-stab-method', s.method || '');
  set('formula-stab-result', s.result || '');
  set('formula-stab-note', s.note || '');
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
  const allergyBox = document.getElementById('formula-cust-allergies');
  const allergies = allergyBox
    ? Array.from(allergyBox.querySelectorAll('.formula-allergy-chip')).map(c => c.dataset.name || '').filter(Boolean)
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
function writeCustomerInputs(customer, customerId) {
  const c = customer || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v == null ? '' : v;
  };
  set('formula-cust-id', customerId || '');
  const refEl = document.getElementById('formula-cust-ref');
  if (refEl) refEl.value = customerId || '';
  set('formula-cust-name', c.name || '');
  set('formula-cust-age', c.age != null ? c.age : '');
  set('formula-cust-gender', c.gender || '');
  set('formula-cust-skintype', c.skinType || '');
  set('formula-cust-formulation', c.formulation || '');
  set('formula-cust-pregnancy', c.pregnancy || '');
  set('formula-cust-products', c.products || '');
  renderAllergyChips(Array.isArray(c.allergies) ? c.allergies : []);
  const chipBox = document.getElementById('formula-cust-concerns');
  if (chipBox) {
    const selected = Array.isArray(c.concerns) ? c.concerns : [];
    chipBox.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = selected.includes(cb.value);
    });
  }
}

/** 알레르기 원료 칩 렌더 */
function renderAllergyChips(allergies) {
  const box = document.getElementById('formula-cust-allergies');
  if (!box) return;
  box.innerHTML = allergies.length
    ? allergies.map(n => `<span class="formula-rule-chip formula-allergy-chip" data-name="${esc(n)}">${esc(n)}`
        + `<button type="button" class="formula-rule-chip-x" data-click="formulaAllergyRemove" data-arg="${esc(n)}" aria-label="${esc(n)} 알레르기 이력 삭제"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></span>`).join('')
    : '';
}

/** 알레르기 원료 추가 — 입력값을 칩으로 등록 */
export function formulaAllergyAdd() {
  const input = document.getElementById('formula-allergy-input');
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
function updateFoldSummaries() {
  const custEl = document.getElementById('fold-sum-customer');
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
  const procEl = document.getElementById('fold-sum-process');
  if (procEl) {
    const { phTarget, phActual } = readCalcInputs();
    const notesEl = document.getElementById('formula-notes-input');
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

/* =======================================================
   추천 베이스 · 원료 패널 (규칙 기반 — 이름만 제안, 농도 미제안)
   ======================================================= */

function renderRecommend() {
  const panel = document.getElementById('formula-recommend');
  if (!panel) return;
  const customer = readCustomerInputs();
  const hasInput = customer.skinType || customer.formulation
    || customer.concerns.length || customer.age != null
    || customer.pregnancy || customer.allergies.length;
  if (!hasInput) {
    panel.classList.add('is-hidden');
    panel.innerHTML = '';
    updateFoldSummaries();
    renderStability();
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
        ? b.candidates.map(c => `<button type="button" class="formula-rec-chip" data-click="formulaRecAddBase" data-arg="${esc(`${b.role}|${c}`)}" title="이 원료를 처방에 추가">${esc(c)}</button>`).join('')
        : '<span class="formula-rec-nocand">직접 입력</span>';
      html += `<div class="formula-rec-role"><span class="formula-rec-role-name">${esc(b.role)}${star}</span><span class="formula-rec-cands">${cands}</span></div>`;
    });
    html += `</div><button type="button" class="btn btn-secondary btn-sm" data-click="formulaLoadBase" title="선택한 추천 원료를 필수 역할별로 처방에 일괄 추가"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> 베이스 불러오기 (필수 역할)</button></div>`;
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
  updateFoldSummaries();
  renderStability(); // 제형 선택 변경이 상 비율 규칙에 영향
}

/** 추천 행 추가 공통 — name + 제조 단계(phase) 태깅 */
function addRecRow(name, phase) {
  const trimmed = name.trim();
  if (calc.rows.some(r => r.name === trimmed)) {
    showToast(`"${trimmed}"은(는) 이미 추가되어 있습니다.`, 'info');
    return false;
  }
  const last = calc.rows[calc.rows.length - 1];
  if (last && !last.name) {
    last.name = trimmed;
    if (!last.phase) last.phase = phase;
  } else {
    calc.rows.push({ name: trimmed, concentration: null, phase });
  }
  renderCalcRows();
  return true;
}

/** 추천 원료 칩 클릭 → 기능성 단계로 행 추가 */
export function formulaRecAdd(name) {
  if (typeof name !== 'string' || !name.trim()) return;
  addRecRow(name, '기능성');
}

/** 베이스 역할 칩 클릭 — data-arg: "role|name", 역할에 맞는 phase 자동 태깅 */
export function formulaRecAddBase(arg) {
  if (typeof arg !== 'string') return;
  const sep = arg.indexOf('|');
  const role = sep > 0 ? arg.slice(0, sep) : '';
  const name = sep > 0 ? arg.slice(sep + 1) : arg;
  if (!name.trim()) return;
  addRecRow(name, ROLE_PHASE[role] || '');
}

/** 베이스 불러오기 — required 역할의 첫 후보를 phase 태깅과 함께 행으로 채움 */
export function formulaLoadBase() {
  const { formulation } = readCustomerInputs();
  const fallback = !formulation;
  const rows = baseDefaultCandidates(formulation || '세럼·에센스');
  if (!rows.length) {
    showToast('이 제형의 자동 베이스가 없습니다.', 'info');
    return;
  }
  let added = 0;
  rows.forEach(r => {
    if (calc.rows.some(row => row.name === r.name)) return;
    const empty = calc.rows.find(row => !row.name);
    if (empty) {
      empty.name = r.name;
      if (!empty.phase) empty.phase = r.phase;
    } else {
      calc.rows.push({ name: r.name, concentration: null, phase: r.phase });
    }
    added++;
  });
  renderCalcRows();
  if (!added) { showToast('이미 모두 추가되어 있습니다.', 'info'); return; }
  const note = fallback ? ' (제형 미선택 — 세럼·에센스 기준)' : '';
  showToast(`베이스 원료 ${added}종을 추가했습니다${note} — 배합률을 입력하세요.`, 'success');
}

/** JSON 파일 다운로드 공용 헬퍼 */
function downloadJson(json, filename) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
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
export async function formulaRuleReset() {
  const ok = await showConfirm('등록한 맞춤 추천 규칙을 모두 초기화할까요?', '맞춤 규칙 초기화');
  if (!ok) return;
  if (resetCustomRules()) {
    showToast('맞춤 추천 규칙을 초기화했습니다.', 'success');
    renderCustomRules();
    renderRecommend();
  } else {
    showToast('초기화에 실패했습니다.', 'error');
  }
}

/** 맞춤 규칙 JSON 내보내기 — 외부 공유·편집용 파일 다운로드 */
export function formulaRuleExport() {
  downloadJson(serializeCustomRules(), `formula_rules_${new Date().toISOString().split('T')[0]}.json`);
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
  populateStabilityFields();

  const title = document.getElementById('formula-calc-title');
  if (title) title.textContent = calc.editingId ? '포뮬러 수정' : '배합 계산기';

  const volEl = document.getElementById('formula-target-volume');
  const unitEl = document.getElementById('formula-unit');
  const phTEl = document.getElementById('formula-ph-target');
  const phAEl = document.getElementById('formula-ph-actual');
  const nameEl = document.getElementById('formula-name-input');
  const notesEl = document.getElementById('formula-notes-input');
  if (sourceFormula) {
    if (volEl) volEl.value = sourceFormula.targetVolume != null ? sourceFormula.targetVolume : '';
    if (unitEl) unitEl.value = sourceFormula.unit || 'g';
    if (phTEl) phTEl.value = sourceFormula.phTarget != null ? sourceFormula.phTarget : '';
    if (phAEl) phAEl.value = sourceFormula.phActual != null ? sourceFormula.phActual : '';
    if (nameEl) nameEl.value = sourceFormula.name || '';
    if (notesEl) notesEl.value = sourceFormula.notes || '';
  } else {
    if (volEl && !volEl.value) volEl.value = '100';
    if (unitEl) unitEl.value = 'g';
    if (phTEl) phTEl.value = '';
    if (phAEl) phAEl.value = '';
    if (nameEl) nameEl.value = '';
    if (notesEl) notesEl.value = '';
  }
  renderSteps();
  writeCustomerInputs(sourceFormula ? sourceFormula.customer : null,
    sourceFormula ? sourceFormula.customerId : '');
  writeStabilityInputs(sourceFormula ? sourceFormula.stability : null);
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
  // pH·메모·안정성 확인 필드 변경 → 제조 정보 접이식 요약 + 안정성 평가 갱신
  ['formula-ph-target', 'formula-ph-actual', 'formula-notes-input',
    'formula-stab-method', 'formula-stab-result', 'formula-stab-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.foldBound) {
      el.dataset.foldBound = '1';
      el.addEventListener('input', () => { updateFoldSummaries(); renderStability(); });
    }
  });

  // 고시 개정 감지 — 저장된 스냅샷 기준과 현재 DB가 다른 원료가 있으면 배너 표시
  const stdWarnEl = document.getElementById('formula-std-warn');
  if (stdWarnEl) {
    const changed = sourceFormula ? countChangedStandards(sourceFormula, getIndex()) : 0;
    if (changed) {
      stdWarnEl.classList.remove('is-hidden');
      stdWarnEl.innerHTML = `<div class="f-check f-check-warn batch-allergy-warn-box">`
        + `<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> `
        + `저장 후 고시 기준이 변경된 원료가 ${changed}종 있습니다 — 한도를 재검증하고 다시 저장하면 스냅샷이 갱신됩니다.</div>`;
    } else {
      stdWarnEl.classList.add('is-hidden');
      stdWarnEl.innerHTML = '';
    }
  }

  // 내용이 있는 접이식 섹션은 자동 펼침 (기존 포뮬러 수정 진입 시)
  const custFold = document.getElementById('formula-fold-customer');
  const procFold = document.getElementById('formula-fold-process');
  if (sourceFormula) {
    const c = sourceFormula.customer || {};
    const hasCust = c.name || c.skinType || c.formulation || (c.concerns && c.concerns.length)
      || c.pregnancy || (c.allergies && c.allergies.length) || c.products || c.age != null;
    if (custFold) custFold.open = !!hasCust;
    const hasProc = sourceFormula.phTarget != null || sourceFormula.phActual != null
      || (sourceFormula.steps && sourceFormula.steps.length) || sourceFormula.notes
      || sourceFormula.stability;
    if (procFold) procFold.open = !!hasProc;
  } else {
    if (custFold) custFold.open = false;
    if (procFold) procFold.open = false;
  }
  updateFoldSummaries();

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

/* =======================================================
   제조 절차 (steps) — 조제 순서 기록
   ======================================================= */

function renderSteps() {
  const list = document.getElementById('formula-steps-list');
  if (!list) return;
  if (!calc.steps.length) {
    list.innerHTML = '<div class="formula-rec-note">단계를 추가해 조제 순서를 기록하세요. (예: 수상부 가열 → 유상부 용해 → 유화 → 후첨가)</div>';
    return;
  }
  list.innerHTML = '';
  calc.steps.forEach((text, i) => {
    const row = document.createElement('div');
    row.className = 'formula-step-row';
    row.innerHTML = `
      <span class="formula-step-no" aria-hidden="true">${i + 1}</span>
      <input type="text" class="f-step form-input" maxlength="200" value="${esc(text)}"
             placeholder="예: 수상부 80℃ 가열 후 교반" aria-label="제조 절차 ${i + 1}단계">
      <button type="button" class="f-del" data-click="formulaStepRemove" data-arg="${i}"
              aria-label="절차 ${i + 1} 삭제"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
    const input = row.querySelector('.f-step');
    input.addEventListener('input', () => { calc.steps[i] = input.value; updateFoldSummaries(); renderStability(); });
    list.appendChild(row);
  });
  updateFoldSummaries();
}

export function formulaStepAdd() {
  calc.steps.push('');
  renderSteps();
  const list = document.getElementById('formula-steps-list');
  const last = list && list.querySelector('.formula-step-row:last-child .f-step');
  if (last) last.focus();
}

export function formulaStepRemove(idx) {
  const i = parseInt(idx, 10);
  if (Number.isNaN(i) || i < 0 || i >= calc.steps.length) return;
  calc.steps.splice(i, 1);
  renderSteps();
}

/* =======================================================
   저장 / 인쇄 / JSON 보내기·가져오기
   ======================================================= */

/** 현재 화면 입력을 포뮬러 데이터로 수집 (저장·인쇄·보내기 공용) */
function currentDraft() {
  const nameEl = document.getElementById('formula-name-input');
  const notesEl = document.getElementById('formula-notes-input');
  const { targetVolume, unit, phTarget, phActual } = readCalcInputs();
  const index = getIndex();
  // 보정 중인 저장본의 기록 메타 — 인쇄·직렬화에서 전성분·기록일시 보존
  const existing = calc.editingId ? getFormula(calc.editingId) : null;
  return {
    name: nameEl ? nameEl.value.trim() : '',
    targetVolume, unit, phTarget, phActual,
    notes: notesEl ? notesEl.value.trim() : '',
    steps: calc.steps.slice(),
    customer: readCustomerInputs(),
    customerId: (() => {
      const el = document.getElementById('formula-cust-id');
      return el ? el.value : '';
    })(),
    stability: {
      ...readStabilityInputs(),
      recordedAt: existing && existing.stability ? (existing.stability.recordedAt || '') : '',
    },
    fullIngredients: existing && existing.fullIngredients ? existing.fullIngredients : [],
    ingredients: calc.rows
      .filter(r => r.name)
      .map(r => {
        const ing = index.get(r.name);
        return {
          name: r.name,
          engName: ing && ing.engName ? ing.engName : '',
          concentration: r.concentration,
          phase: r.phase || '',
          snapshot: ing ? { type: ing.type || '', limit: ing.limit || '' } : null,
        };
      }),
  };
}

/** 계산 결과를 포뮬러로 저장 (신규 또는 editingId 갱신) */
export function formulaCalcSave() {
  const data = currentDraft();
  // 안정성 확인 기록이 있으면 저장 시각 자동 부여 — 내용이 바뀐 경우만 갱신
  if (data.stability && (data.stability.method || data.stability.result || data.stability.note)) {
    const prev = calc.editingId ? (getFormula(calc.editingId) || {}).stability : null;
    const same = prev && prev.method === data.stability.method
      && prev.result === data.stability.result && prev.note === data.stability.note;
    data.stability.recordedAt = same ? (prev.recordedAt || '')
      : new Date().toISOString().slice(0, 16);
  }
  const r = calc.editingId ? updateFormula(calc.editingId, data) : createFormula(data);

  if (!r.ok) { showToast(r.error || '저장에 실패했습니다.', 'error'); return; }
  calc.editingId = r.formula.id;
  calc.stabRecordedAt = r.formula.stability ? r.formula.stability.recordedAt : null;
  showToast(`"${r.formula.name}" 포뮬러가 저장되었습니다.`, 'success');
  initFormulaView();
}

/* =======================================================
   조제 기록지 인쇄 · 포뮬러 JSON 보내기/가져오기
   ======================================================= */

/** 인쇄용 조제 기록지 HTML 생성 */
function buildPrintHtml(f) {
  const vol = f.targetVolume != null ? `${f.targetVolume}${f.unit || 'g'}` : '—';
  const cust = f.customer || {};
  const custParts = [cust.name, cust.age != null ? `${cust.age}세` : '', cust.gender,
    cust.skinType, cust.formulation ? `제형: ${cust.formulation}` : '',
    cust.concerns && cust.concerns.length ? `고민: ${cust.concerns.join(', ')}` : '',
    cust.pregnancy,
    cust.allergies && cust.allergies.length ? `알레르기: ${cust.allergies.join(', ')}` : '',
    cust.products ? `사용 중: ${cust.products}` : '']
    .filter(Boolean).join(' · ');

  const amounts = calcAmounts(f);
  const checks = checkFormulaItems(
    f.ingredients.map(i => ({ name: i.name, concentration: i.concentration })),
    getIndex()
  );
  let sumConc = 0;
  const rowsHtml = f.ingredients.map((item, i) => {
    const conc = item.concentration;
    if (conc != null) sumConc += conc;
    const amount = amounts[i] && amounts[i].amount != null ? `${amounts[i].amount.toFixed(2)}${f.unit || 'g'}` : '—';
    const badge = CHECK_BADGE[checks.results[i] ? checks.results[i].check : CHECK.UNKNOWN] || CHECK_BADGE[CHECK.UNKNOWN];
    const limit = item.snapshot && item.snapshot.limit ? ` (한도 ${item.snapshot.limit})` : '';
    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(item.phase || '—')}</td>
      <td>${esc(item.name)}${item.engName ? `<br><span class="fp-eng">${esc(item.engName)}</span>` : ''}</td>
      <td class="fp-num">${conc != null ? `${conc}%` : '—'}</td>
      <td class="fp-num">${amount}</td>
      <td>${badge.label}${esc(limit)}</td>
    </tr>`;
  }).join('');
  const rounded = Math.round(sumConc * 100) / 100;

  const stepsHtml = (f.steps && f.steps.length)
    ? `<h3>제조 절차</h3><ol class="fp-steps">${f.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
    : '';
  const stab = evaluateStability(f.ingredients, getIndex(), {
    formulation: cust.formulation, phTarget: f.phTarget, phActual: f.phActual, steps: f.steps,
  });
  const stabConfirm = f.stability
    ? `<p class="fp-meta-line">안정성 실험 확인: ${esc([f.stability.method, f.stability.result, f.stability.recordedAt && `기록 ${f.stability.recordedAt.replace('T', ' ')}`, f.stability.note].filter(Boolean).join(' · '))}</p>`
    : '';
  const inciHtml = (f.fullIngredients && f.fullIngredients.length)
    ? `<p class="fp-meta-line fp-inci">전성분 표시: ${esc(f.fullIngredients.join(', '))}</p>`
    : '';
  const stabHtml = (stab.warnings.length || f.stability || inciHtml)
    ? `<h3>제형 안정성</h3>${stabConfirm}${inciHtml}${stab.warnings.length ? `<ul class="fp-stab">${stab.warnings.map(w => `<li>${w.level === STAB.WARN ? '[주의] ' : '[참고] '}${esc(w.msg)}</li>`).join('')}</ul>` : ''}`
    : '';
  const notesHtml = f.notes ? `<h3>메모</h3><p class="fp-notes">${esc(f.notes)}</p>` : '';
  const phLine = (f.phTarget != null || f.phActual != null)
    ? `<p class="fp-meta-line">목표 pH: ${f.phTarget != null ? f.phTarget : '—'} · 실측 pH: ${f.phActual != null ? f.phActual : '—'}</p>`
    : '';

  return `
    <div class="fp-doc">
      <h1>조제 기록지 — ${esc(f.name || '(이름 없음)')}</h1>
      <p class="fp-meta-line">총 제조량: ${vol} · 작성일: ${new Date().toLocaleDateString('ko-KR')}</p>
      ${custParts ? `<p class="fp-meta-line">고객: ${esc(custParts)}</p>` : ''}
      ${phLine}
      <table class="fp-table">
        <thead><tr><th>#</th><th>단계</th><th>원료명</th><th>배합률</th><th>투입량</th><th>규정 검증</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="3">합계</td><td class="fp-num">${rounded}%</td><td></td><td></td></tr></tfoot>
      </table>
      ${stepsHtml}
      ${stabHtml}
      ${notesHtml}
      <p class="fp-disclaimer">검증 결과는 법정 배합 한도 기준일 뿐 제품의 안전성·안정성·품질을 보장하지 않습니다.</p>
    </div>`;
}

/** 조제 기록지 인쇄 — 인쇄 전용 영역에 렌더 후 window.print() */
export function formulaPrint() {
  const area = document.getElementById('formula-print-area');
  if (!area) return;
  const draft = currentDraft();
  if (!draft.ingredients.length) {
    showToast('인쇄할 원료가 없습니다.', 'info');
    return;
  }
  area.innerHTML = buildPrintHtml(draft);
  document.body.classList.add('formula-printing');
  const cleanup = () => {
    document.body.classList.remove('formula-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/** 현재 드래프트를 JSON 파일로 보내기 */
export function formulaExportJson() {
  const draft = currentDraft();
  if (!draft.ingredients.length) {
    showToast('보낼 원료가 없습니다.', 'info');
    return;
  }
  const safeName = (draft.name || 'formula').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  downloadJson(serializeFormula(draft), `formula_${safeName}_${new Date().toISOString().split('T')[0]}.json`);
  showToast('포뮬러 JSON 파일을 다운로드했습니다.', 'success');
}

/** 목록 카드에서 저장된 포뮬러를 JSON으로 보내기 */
export function formulaCardExport(id) {
  const f = getFormula(id);
  if (!f) { showToast('포뮬러를 찾을 수 없습니다.', 'error'); return; }
  const safeName = (f.name || 'formula').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  downloadJson(serializeFormula(f), `formula_${safeName}_${new Date().toISOString().split('T')[0]}.json`);
  showToast(`"${f.name}" 포뮬러를 다운로드했습니다.`, 'success');
}

/** 포뮬러 JSON 가져오기 트리거 — 숨겨진 파일 입력 클릭 */
export function formulaImportJson() {
  const input = document.getElementById('formula-file-input');
  if (!input) return;
  if (!input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('change', formulaImportFile);
  }
  input.click();
}

function formulaImportFile(event) {
  const input = event.target;
  const file = input && input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const r = importFormula(e.target && e.target.result);
    if (!r.ok) {
      showToast(r.error || '가져오기에 실패했습니다.', 'error');
    } else {
      showToast(`"${r.formula.name}" 포뮬러를 가져왔습니다.`, 'success');
      openFormulaList();
    }
    input.value = '';
  };
  reader.onerror = () => { showToast('파일을 읽지 못했습니다.', 'error'); input.value = ''; };
  reader.readAsText(file);
}
