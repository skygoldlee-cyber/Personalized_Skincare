// src/views/formula-recommend.js — 추천 베이스·원료 패널 + 맞춤 규칙 UI (formula.js에서 분리)
// @spec FO-05,FO-06,FO-08
// 규칙 기반 추천(이름만 제안, 농도 미제안) 렌더링, 맞춤 후보/규칙 CRUD·보내기·가져오기,
// 원료 datalist 생성. 공유 상태(calc)·렌더러는 formula.js에서 import한다(런타임 호출 전용 순환).
import { esc } from '../sanitize.js';
import { showToast, showConfirm } from '../ui-utils.js';
import {
  recommendFor, baseDefaultCandidates,
  loadCustomRules, addCustomCandidate, removeCustomCandidate,
  resetCustomRules, customRuleTargets,
  serializeCustomRules, importCustomRules,
  ROLE_PHASE,
} from '../formula-rules.js';
import {
  calc, getEl, getIndex,
  renderCalcRows, renderStability, updateFoldSummaries, readCustomerInputs,
} from './formula.js';
/* =======================================================
   추천 베이스 · 원료 패널 (규칙 기반 — 이름만 제안, 농도 미제안)
   ======================================================= */

export function renderRecommend() {
  const panel = getEl('formula-recommend');
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
export function downloadJson(json, filename) {
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

export function renderCustomRules() {
  const targetEl = getEl('formula-rule-target');
  const listEl = getEl('formula-rule-list');
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
  const targetEl = getEl('formula-rule-target');
  const nameEl = getEl('formula-rule-name');
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
  const input = getEl('formula-rule-file-input');
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

export function populateDatalist() {
  const dl = getEl('formula-ing-datalist');
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

