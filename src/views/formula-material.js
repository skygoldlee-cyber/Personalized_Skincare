// src/views/formula-material.js — Formula OS 원료 장부 뷰 (Phase C)
//
// 목록(formula-material-panel) + 폼(formula-material-form-panel).
// 기한 상태는 저장하지 않고 표시 시 계산한다 — materialStatus/daysUntilExpiry.

import { esc } from '../sanitize.js';
import { showToast, showConfirm } from '../ui-utils.js';
import { showPanel, formulaSubNav } from './formula.js';
import {
  listMaterials, getMaterial, getMaterialUsage,
  createMaterial, updateMaterial, deleteMaterial, importMaterials,
  materialStatus, daysUntilExpiry, STORAGE_OPTIONS,
} from '../material-ledger.js';
import {
  parseCsv, csvToObjects, readCsvFile, toCsv, downloadCsv,
} from '../csv-utils.js';

const mat = { editingId: null };

const STATUS_LABEL = {
  expired: { cls: 'f-check-banned', label: '기한 경과' },
  soon: { cls: 'f-check-warn', label: '기한 임박' },
  ok: { cls: 'f-check-ok', label: '정상' },
  none: { cls: 'f-check-unknown', label: '기한 미기재' },
};

/** 기한 배지 HTML — 목록 카드·계산기 경고 공용 */
export function materialBadgeHtml(m) {
  const s = materialStatus(m);
  const days = daysUntilExpiry(m);
  const info = STATUS_LABEL[s];
  const suffix = days != null && s !== 'none'
    ? (days < 0 ? ` D+${Math.abs(days)}` : ` D-${days}`)
    : '';
  return `<span class="f-check ${info.cls}">${info.label}${esc(suffix)}</span>`;
}

/* =======================================================
   원료 장부 목록
   ======================================================= */

export function openMaterialPanel() {
  showPanel('formula-material-panel');
  const subnav = document.getElementById('formula-material-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('material');
  const list = document.getElementById('material-list');
  if (!list) return;

  const usage = getMaterialUsage();
  const usageEl = document.getElementById('material-list-usage');
  if (usageEl) usageEl.textContent = `${usage.count}/${usage.limit} 등록`;

  const expiring = listMaterials().filter(m => ['soon', 'expired'].includes(materialStatus(m)));
  const alertEl = document.getElementById('material-expiry-alert');
  if (alertEl) {
    alertEl.classList.toggle('is-hidden', !expiring.length);
    alertEl.textContent = expiring.length
      ? `기한 임박·경과 원료 ${expiring.length}종 — 상단에 표시됩니다.`
      : '';
  }

  const materials = listMaterials();
  if (!materials.length) {
    list.innerHTML = `
      <div class="formula-empty">
        <i class="fa-solid fa-boxes-stacked" aria-hidden="true"></i>
        <h4>등록된 원료가 없습니다</h4>
        <p>입고일·사용기한·보관조건을 등록하면 기한 임박 경고와 계산기 연동이 동작합니다.</p>
        <button class="btn btn-primary" data-click="matNew"><i class="fa-solid fa-plus" aria-hidden="true"></i> 첫 원료 등록</button>
      </div>`;
    return;
  }

  list.innerHTML = materials.map(m => {
    const meta = [
      m.lot ? `LOT ${m.lot}` : '',
      m.receivedAt ? `입고 ${m.receivedAt}` : '',
      m.expiryAt ? `기한 ${m.expiryAt}` : '',
      m.qty != null ? `잔량 ${m.qty}${m.unit || ''}` : '',
      m.storage || '',
    ].filter(Boolean).join(' · ');
    const s = materialStatus(m);
    const rowCls = s === 'expired' ? ' is-expired' : (s === 'soon' ? ' is-expiring' : '');
    return `
      <div class="formula-card material-card${rowCls}">
        <div class="formula-card-head">
          <h4 class="formula-card-name">${esc(m.name)}</h4>
          <span class="formula-card-meta">${esc(meta || '정보 없음')}</span>
        </div>
        <div class="formula-card-checks">${materialBadgeHtml(m)}</div>
        ${m.notes ? `<div class="formula-card-meta">메모: ${esc(m.notes)}</div>` : ''}
        <div class="formula-card-actions">
          <button class="btn btn-secondary btn-sm" data-click="matEdit" data-arg="${esc(m.id)}"><i class="fa-solid fa-pen" aria-hidden="true"></i> 수정</button>
          <button class="btn btn-secondary btn-sm f-danger" data-click="matDelete" data-arg="${esc(m.id)}"><i class="fa-solid fa-trash" aria-hidden="true"></i> 삭제</button>
        </div>
      </div>`;
  }).join('');
}

/* =======================================================
   원료 폼 (등록 · 수정)
   ======================================================= */

function fillStorageSelect(value) {
  const sel = document.getElementById('mat-storage');
  if (!sel) return;
  sel.innerHTML = '<option value="">보관 조건 선택…</option>'
    + STORAGE_OPTIONS.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value = value || '';
}

function writeMaterialForm(m) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v == null ? '' : v;
  };
  const src = m || {};
  set('mat-name', src.name || '');
  set('mat-lot', src.lot || '');
  set('mat-received', src.receivedAt || '');
  set('mat-expiry', src.expiryAt || '');
  set('mat-qty', src.qty != null ? src.qty : '');
  set('mat-unit', src.unit || '');
  set('mat-notes', src.notes || '');
  fillStorageSelect(src.storage);
}

function readMaterialForm() {
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  const qtyRaw = val('mat-qty');
  return {
    name: val('mat-name'),
    lot: val('mat-lot'),
    receivedAt: val('mat-received'),
    expiryAt: val('mat-expiry'),
    storage: val('mat-storage'),
    qty: qtyRaw === '' ? null : parseFloat(qtyRaw),
    unit: val('mat-unit'),
    notes: val('mat-notes'),
  };
}

export function matNew() {
  mat.editingId = null;
  showPanel('formula-material-form-panel');
  writeMaterialForm(null);
  const title = document.getElementById('material-form-title');
  if (title) title.textContent = '원료 등록';
}

export function matEdit(id) {
  const m = getMaterial(id);
  if (!m) { showToast('원료 항목을 찾을 수 없습니다.', 'error'); return; }
  mat.editingId = m.id;
  showPanel('formula-material-form-panel');
  writeMaterialForm(m);
  const title = document.getElementById('material-form-title');
  if (title) title.textContent = `원료 수정 — ${m.name}`;
}

export function matSave() {
  const data = readMaterialForm();
  const r = mat.editingId ? updateMaterial(mat.editingId, data) : createMaterial(data);
  if (!r.ok) { showToast(r.error || '저장에 실패했습니다.', 'error'); return; }
  showToast(`"${r.material.name}" 원료가 저장되었습니다.`, 'success');
  openMaterialPanel();
}

export async function matDelete(id) {
  const m = getMaterial(id);
  if (!m) return;
  const ok = await showConfirm(`"${m.name}" 원료 항목을 삭제할까요?`, '원료 삭제');
  if (!ok) return;
  const r = deleteMaterial(id);
  if (!r.ok) { showToast(r.error || '삭제에 실패했습니다.', 'error'); return; }
  showToast('원료 항목이 삭제되었습니다.', 'success');
  openMaterialPanel();
}

/* =======================================================
   CSV 가져오기·보내기·양식
   ======================================================= */

// CSV 헤더 → 원료 필드 매핑 (키는 정규화 형태: 소문자·공백 제거)
export const MAT_CSV_COLS = Object.freeze({
  '원료명': 'name', '원료': 'name', 'name': 'name',
  'lot': 'lot', '로트': 'lot', 'lot번호': 'lot', '제조번호': 'lot',
  '입고일': 'receivedAt', '입고': 'receivedAt', 'receivedat': 'receivedAt',
  '사용기한': 'expiryAt', '유통기한': 'expiryAt', '기한': 'expiryAt', 'expiryat': 'expiryAt',
  '보관조건': 'storage', '보관': 'storage', 'storage': 'storage',
  '잔량': 'qty', '수량': 'qty', '재고': 'qty', 'qty': 'qty',
  '단위': 'unit', 'unit': 'unit',
  '메모': 'notes', '비고': 'notes', 'notes': 'notes',
});

//보내기·양식의 표준 헤더 (한글)
export const MAT_CSV_HEADERS = Object.freeze(
  ['원료명', 'LOT', '입고일', '사용기한', '보관조건', '잔량', '단위', '메모']);

/** 날짜 표기 정규화 — '2025.3.1'·'2025/3/1' → '2025-03-01' (clampDate 입력용) */
function normCsvDate(v) {
  const s = String(v || '').trim().replace(/[./]/g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** CSV 행 객체 → sanitizeMaterial 입력 형태 */
export function csvRowToMaterial(o) {
  return {
    name: o.name,
    lot: o.lot,
    receivedAt: normCsvDate(o.receivedAt),
    expiryAt: normCsvDate(o.expiryAt),
    storage: o.storage,
    qty: o.qty,
    unit: o.unit,
    notes: o.notes,
  };
}

function matToCsvRow(m) {
  return [m.name, m.lot, m.receivedAt, m.expiryAt, m.storage,
    m.qty != null ? m.qty : '', m.unit, m.notes];
}

/** CSV 가져오기 트리거 — 숨겨진 파일 입력 클릭 */
export function matImportCsv() {
  const input = document.getElementById('material-file-input');
  if (!input) return;
  if (!input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('change', matImportFile);
  }
  input.click();
}

async function matImportFile(event) {
  const input = event.target;
  const file = input && input.files && input.files[0];
  input.value = '';
  if (!file) return;

  let text;
  try {
    text = await readCsvFile(file);
  } catch (e) {
    showToast('파일을 읽지 못했습니다.', 'error');
    return;
  }
  const rows = csvToObjects(parseCsv(text), MAT_CSV_COLS);
  if (!rows.length) {
    showToast('인식 가능한 행이 없습니다 — "양식" 버튼의 헤더를 사용하세요.', 'error');
    return;
  }
  const records = rows.map(csvRowToMaterial);
  const ok = await showConfirm(
    `CSV에서 ${records.length}건을 읽었습니다. 원료명+LOT이 같은 기존 항목은 건너뜁니다. 가져올까요?`,
    '원료 CSV 가져오기');
  if (!ok) return;

  const st = importMaterials(records);
  const parts = [`${st.added}건 추가`];
  if (st.duplicate) parts.push(`중복 ${st.duplicate}건 건너뜀`);
  if (st.skipped) parts.push(`원료명 없음 ${st.skipped}건 제외`);
  if (st.overLimit) parts.push(`한도 초과 ${st.overLimit}건 제외`);
  showToast(`가져오기 완료 — ${parts.join(', ')}`, st.added ? 'success' : 'info');
  openMaterialPanel();
}

/** 원료 장부 CSV 보내기 (UTF-8 BOM — Excel 한글 호환) */
export function matExportCsv() {
  const list = listMaterials();
  if (!list.length) { showToast('보낼 원료가 없습니다.', 'info'); return; }
  downloadCsv(toCsv([...MAT_CSV_HEADERS], list, matToCsvRow), `materials_${new Date().toISOString().split('T')[0]}.csv`);
  showToast(`${list.length}종의 원료를 CSV로보냈습니다.`, 'success');
}

/** 빈 CSV 양식 다운로드 — 표준 헤더만 */
export function matCsvTemplate() {
  downloadCsv(toCsv([...MAT_CSV_HEADERS], [], () => []), 'materials_template.csv');
  showToast('원료 CSV 양식을 다운로드했습니다.', 'success');
}
