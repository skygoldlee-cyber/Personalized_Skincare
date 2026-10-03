// Formula OS — 표시사항 검토 + 광고 문구 점검 패널 (FO-35·36)
// @spec FO-33,FO-35,FO-36
// 화장품법 제10조 표시사항 자가점검(라벨 시트 인쇄 포함)과
// 제13조 기반 광고 문구 금지 표현 린트를 제공한다.
// 제조업·책임판매업 유형에서 서브내비·허브 카드로 노출 (biz-profile BIZ_PANELS).
// 판정은 자가점검용 참고이며 최종 판단은 법령 원문·광고 심의 기준을 따른다.

import { esc } from '../../../sanitize.js';
import { showToast } from '../../../ui-utils.js';
import { getJSON, setJSON } from '../../../storage.js';
import { STORAGE_KEYS } from '../../../storage-keys.js';
import { lawUrlFor } from '../../../law-links.js';
import { showPanel, formulaSubNav } from './formula.js';
import { listFormulas } from '../formula-store.js';
import { printHtml } from './formula-print.js';
import { lintAdCopy, summarizeLint, AD_CATEGORIES } from '../ad-lint.js';

/* =======================================================
   표시사항 검토 (FO-35) — 화장품법 제10조·시행규칙 별표4 기준 필드
   ======================================================= */

/** 필드 정의 — id는 폼 요소 id·드래프트 키로 영구 안정 */
const LABEL_FIELDS = [
  { id: 'label-product', label: '제품명', required: true },
  { id: 'label-seller', label: '책임판매업자 상호', required: true, note: '제조판매업이면 제조판매업자 상호' },
  { id: 'label-address', label: '책임판매업자 주소', required: true },
  { id: 'label-lot', label: '제조번호', required: true, note: '회수 추적의 기준 — 제조 배치번호와 연결 권장' },
  { id: 'label-expiry', label: '사용기한 (또는 개봉 후 사용기한)', required: true },
  { id: 'label-volume', label: '내용물 용량·중량', required: true },
  { id: 'label-ingredients', label: '전성분', required: true, textarea: true, note: '함량 내림차순 — 1% 이하는 순서 자유. My 포뮬러에서 자동 삽입 가능' },
  { id: 'label-country', label: '제조국 (수입품)', required: false, note: '국산이면 비워둠' },
  { id: 'label-caution', label: '사용 시 주의사항', required: false, textarea: true, note: '해당 유형(눈·입술용·어린이 등)은 필수 — 알레르기 유발성분 표시 규정 확인' },
];

/** 드래프트 읽기 — 폼 필드 전체를 한 객체로 */
function readLabelForm() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const f of LABEL_FIELDS) {
    const el = /** @type {HTMLInputElement|null} */(document.getElementById(f.id));
    out[f.id] = el ? el.value : '';
  }
  const fn = /** @type {HTMLInputElement|null} */(document.getElementById('label-functional'));
  out['label-functional'] = fn && fn.checked ? '1' : '';
  return out;
}

/** @param {Record<string, string>} d */
function writeLabelForm(d) {
  if (!d || typeof d !== 'object') return;
  for (const f of LABEL_FIELDS) {
    const el = /** @type {HTMLInputElement|null} */(document.getElementById(f.id));
    if (el && typeof d[f.id] === 'string') el.value = d[f.id];
  }
  const fn = /** @type {HTMLInputElement|null} */(document.getElementById('label-functional'));
  if (fn) fn.checked = d['label-functional'] === '1';
}

function saveLabelDraft() {
  setJSON(STORAGE_KEYS.FORMULA_LABEL_DRAFT, readLabelForm());
}

/** 필수 기재 체크 — 제10조 요건별 적합/보완 표시 HTML */
function labelChecklistHtml(d) {
  const fn = d['label-functional'] === '1';
  const imported = d['label-country'] && d['label-country'].trim();
  /** @type {Array<{label:string, ok:boolean, need:boolean, optional:boolean, manual?:boolean}>} */
  const checks = LABEL_FIELDS.map(f => {
    const filled = !!(d[f.id] && d[f.id].trim());
    const need = f.required || (f.id === 'label-country' && !!imported);
    return { label: f.label, ok: filled, need, optional: !f.required };
  });
  if (fn) checks.push({
    label: '기능성화장품 표기 확인 — "기능성화장품" 문구·심사(보고) 여부 표기',
    ok: false, need: false, manual: true, optional: false,
  });
  const li = checks.map(c => {
    const state = c.ok ? 'ok' : (c.need || c.manual ? 'warn' : 'skip');
    const mark = c.ok ? '✓' : (c.need || c.manual ? '!' : '–');
    return `<li class="label-check-item label-check-${state}"><span class="label-check-mark">${mark}</span> ${esc(c.label)}${c.manual ? ' <span class="label-check-opt">(수동 확인)</span>' : (c.optional && !c.ok ? ' <span class="label-check-opt">(해당 시)</span>' : '')}</li>`;
  }).join('');
  const missing = checks.filter(c => c.need && !c.ok).length;
  return `<ul class="label-check-list">${li}</ul>
    <p class="label-check-summary">${missing ? `필수 ${missing}항목 미기재 — 확인 후 보완하세요.` : '필수 표시사항이 모두 기재됐습니다.'}</p>`;
}

function renderLabelChecklist() {
  const box = document.getElementById('label-check-result');
  if (box) box.innerHTML = labelChecklistHtml(readLabelForm());
}

export function openLabelPanel() {
  showPanel('formula-label-panel');
  const subnav = document.getElementById('formula-label-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('label');
  writeLabelForm(getJSON(STORAGE_KEYS.FORMULA_LABEL_DRAFT));
  // 포뮬러 전성분 선택지 — fullIngredients 보유분만
  const sel = /** @type {HTMLSelectElement} */(document.getElementById('label-formula-select'));
  if (sel) {
    const opts = listFormulas().filter(f => f.fullIngredients && f.fullIngredients.length);
    sel.innerHTML = '<option value="">— My 포뮬러에서 전성분 가져오기 —</option>' +
      opts.map(f => `<option value="${esc(f.id)}">${esc(f.name || '(이름 없음)')}</option>`).join('');
  }
  renderLabelChecklist();
  // 입력마다 드래프트 저장 + 체크 갱신 — 패널 요소에만 위임
  const panel = document.getElementById('formula-label-panel');
  if (panel && !panel.dataset.labelWired) {
    panel.dataset.labelWired = '1';
    panel.addEventListener('input', () => { saveLabelDraft(); renderLabelChecklist(); });
    panel.addEventListener('change', () => { saveLabelDraft(); renderLabelChecklist(); });
    if (sel) sel.addEventListener('change', labelFormulaImport);
  }
}

/** 포뮬러 선택 → 전성분 자동 삽입 (FO-35) */
export function labelFormulaImport() {
  const sel = /** @type {HTMLSelectElement} */(document.getElementById('label-formula-select'));
  const target = /** @type {HTMLTextAreaElement} */(document.getElementById('label-ingredients'));
  if (!sel || !target || !sel.value) return;
  const f = listFormulas().find(x => x.id === sel.value);
  if (f && f.fullIngredients && f.fullIngredients.length) {
    target.value = f.fullIngredients.join(', ');
    saveLabelDraft();
    renderLabelChecklist();
    showToast(`"${f.name}"의 전성분을 가져왔습니다.`, 'success');
  } else {
    showToast('선택한 포뮬러에 전성분 정보가 없습니다 — 안정성 "양호" 확인된 포뮬러만 생성됩니다.', 'error');
  }
}

/** 라벨 시트 인쇄 — 입력값 그대로 표시사항 레이아웃 (FO-35) */
export function labelPrintSheet() {
  const d = readLabelForm();
  const rows = LABEL_FIELDS
    .filter(f => d[f.id] && d[f.id].trim())
    .map(f => `<tr><th>${esc(f.label)}</th><td>${esc(d[f.id]).replace(/\n/g, '<br>')}</td></tr>`)
    .join('');
  if (!rows) { showToast('인쇄할 표시사항이 없습니다.', 'error'); return; }
  const lawUrl = lawUrlFor('화장품법');
  printHtml(`<div class="fp-doc">
    <h2>화장품 표시사항 시트</h2>
    <table class="fp-table">${rows}</table>
    <p class="fp-meta-line">화장품법 제10조·시행규칙 별표4 기준 자가점검 출력 — ${lawUrl ? `<a href="${esc(lawUrl)}">법령 원문</a>` : '법령 원문 확인'}</p>
  </div>`);
}

/* =======================================================
   광고 문구 점검 (FO-36) — 제13조 금지 표현 린트
   ======================================================= */

export function openAdLintPanel() {
  showPanel('formula-adlint-panel');
  const subnav = document.getElementById('formula-adlint-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('adlint');
}

/** 점검 실행 — 입력 문구를 금지 표현 사전과 대조해 하이라이트·가이드 출력 */
export function adlintRun() {
  const ta = /** @type {HTMLTextAreaElement} */(document.getElementById('adlint-input'));
  const box = document.getElementById('adlint-result');
  if (!ta || !box) return;
  const text = ta.value;
  if (!text.trim()) { showToast('점검할 문구를 입력하세요.', 'error'); return; }
  const hits = lintAdCopy(text);

  // 본문 하이라이트 — 위치 기준 <mark> 삽입
  let html = '';
  let pos = 0;
  for (const h of hits) {
    html += esc(text.slice(pos, h.index));
    html += `<mark class="adlint-mark adlint-${esc(h.category)}" title="${esc(h.label)}">${esc(text.slice(h.index, h.index + h.length))}</mark>`;
    pos = h.index + h.length;
  }
  html += esc(text.slice(pos));

  if (!hits.length) {
    box.innerHTML = `<div class="adlint-ok"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> 금지 표현이 발견되지 않았습니다. 최종 판단은 광고 심의 기준·관할 지방식약청 안내를 따르세요.</div>`;
    return;
  }
  const sum = summarizeLint(hits);
  const sumHtml = Object.keys(sum).map(c => {
    const cat = AD_CATEGORIES[c];
    return `<span class="adlint-sum adlint-${esc(c)}">${esc(cat.label)} ${sum[c]}건</span>`;
  }).join('');
  const listHtml = hits.map(h => {
    const ctx = text.slice(Math.max(0, h.index - 8), h.index + h.length + 8).trim();
    return `<li><span class="adlint-sum adlint-${esc(h.category)}">${esc(h.label)}</span> "<strong>${esc(h.term)}</strong>" <span class="adlint-ctx">…${esc(ctx)}…</span><br><span class="adlint-sug">→ ${esc(h.suggestion)}</span></li>`;
  }).join('');
  box.innerHTML = `<div class="adlint-summary">${sumHtml}</div>
    <div class="adlint-text">${html.replace(/\n/g, '<br>')}</div>
    <ul class="adlint-list">${listHtml}</ul>
    <p class="adlint-note">자동 사전 대조 결과입니다 — 확정 위반 여부는 화장품법 제13조·광고 심의 기준으로 최종 판단하세요.</p>`;
}

export function adlintClear() {
  const ta = /** @type {HTMLTextAreaElement} */(document.getElementById('adlint-input'));
  const box = document.getElementById('adlint-result');
  if (ta) ta.value = '';
  if (box) box.innerHTML = '';
}
