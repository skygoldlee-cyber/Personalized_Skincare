// src/views/formula-print.js — Formula OS 인쇄 산출물 빌더 (Phase A)
//
// 조제 기록지(배치)·제품 라벨·사용 안내문 HTML 생성 + 공용 인쇄 트리거.
// 기존 formula.js의 조제 기록지와 같은 #formula-print-area + body.formula-printing
// 메커니즘을 재사용한다 (print.css의 fp-* 규칙 + fp-label 신설).

import { esc } from '../sanitize.js';
import { QC_FIELDS, HYGIENE_FIELDS } from '../batch-store.js';
import { buildUsageGuideFromBatch } from '../usage-guide.js';

const QC_BADGE = { '정상': '○', '이상': '✕', '미확인': '—' };

function fmtDateTime(v) {
  return typeof v === 'string' && v ? v.replace('T', ' ') : '—';
}

function fmtDate(v) {
  return typeof v === 'string' && v ? v : '—';
}

/** 배치 QC·위생 요약 텍스트 — 카드·인쇄 공용 */
export function batchQcSummary(b) {
  const qc = b && b.qc ? b.qc : {};
  const bad = QC_FIELDS.filter(f => qc[f.key] === '이상').map(f => f.label);
  const unchecked = QC_FIELDS.filter(f => !qc[f.key]).length;
  const hyg = b && b.hygiene ? b.hygiene : {};
  const hygDone = HYGIENE_FIELDS.filter(f => hyg[f.key]).length;
  return { bad, unchecked, hygDone, hygTotal: HYGIENE_FIELDS.length };
}

/** 조제 기록지(배치) — 회차 기록 + QC·위생 + 검증 스냅샷 */
export function buildBatchRecordHtml(b) {
  const qcRows = QC_FIELDS.map(f => {
    const v = b.qc && b.qc[f.key] ? b.qc[f.key] : '';
    const cls = v === '이상' ? 'fp-qc-bad' : (v === '정상' ? 'fp-qc-ok' : '');
    return `<tr><td>${esc(f.label)}</td><td class="${cls}">${v ? `${QC_BADGE[v]} ${esc(v)}` : '미기록'}</td></tr>`;
  }).join('');
  const hygItems = HYGIENE_FIELDS.map(f => {
    const done = !!(b.hygiene && b.hygiene[f.key]);
    return `<li>${done ? '☑' : '☐'} ${esc(f.label)}</li>`;
  }).join('');
  const snap = b.checkSnapshot;
  const snapParts = snap
    ? [`정상 ${snap.ok}`, snap.warn ? `초과 ${snap.warn}` : '', snap.banned ? `금지 ${snap.banned}` : '',
       snap.unknown ? `확인 필요 ${snap.unknown}` : '', snap.stabWarn ? `안정성 경고 ${snap.stabWarn}` : '']
      .filter(Boolean).join(' · ')
    : '';

  return `
    <div class="fp-doc">
      <h1>조제 기록 — ${esc(b.batchNo || '')}</h1>
      <p class="fp-meta-line">처방: ${esc(b.formulaName || '—')} · 조제 일시: ${esc(fmtDateTime(b.madeAt))}</p>
      <p class="fp-meta-line">고객: ${esc(b.customerName || '—')} · 제조량: ${b.targetVolume != null ? `${b.targetVolume}${b.unit || 'g'}` : '—'} · 권장 사용기한: ${esc(fmtDate(b.expiryAt))}</p>
      ${b.formulation ? `<p class="fp-meta-line">제형: ${esc(b.formulation)}</p>` : ''}
      <h3>품질 확인 (회차)</h3>
      <table class="fp-table"><tbody>${qcRows}</tbody></table>
      <h3>위생·안전 확인</h3>
      <ul class="fp-steps">${hygItems}</ul>
      ${b.fullIngredients && b.fullIngredients.length ? `<h3>전성분 표시</h3><p class="fp-meta-line fp-inci">${esc(b.fullIngredients.join(', '))}</p>` : ''}
      ${snapParts ? `<h3>규정 검증 (조제 시점 스냅샷)</h3><p class="fp-meta-line">${esc(snapParts)}</p>` : ''}
      ${b.notes ? `<h3>메모</h3><p class="fp-notes">${esc(b.notes)}</p>` : ''}
      <p class="fp-disclaimer">검증 결과는 법정 배합 한도 기준일 뿐 제품의 안전성·안정성·품질을 보장하지 않습니다.</p>
    </div>`;
}

/** 제품 라벨 — 전성분·조제일·사용기한·주의사항 (소형 라벨 레이아웃) */
export function buildLabelHtml(b) {
  const inci = (b.fullIngredients && b.fullIngredients.length)
    ? b.fullIngredients.join(', ')
    : '(전성분 미생성 — 처방에서 안정성 "양호" 확인 후 저장 필요)';
  return `
    <div class="fp-label">
      <div class="fp-label-name">${esc(b.formulaName || '(이름 없음)')}</div>
      <div class="fp-label-line">배치번호 ${esc(b.batchNo || '—')} · 조제일 ${esc(fmtDate(b.madeAt ? b.madeAt.slice(0, 10) : ''))}</div>
      <div class="fp-label-line">내용량 ${b.targetVolume != null ? `${b.targetVolume}${b.unit || 'g'}` : '—'} · 권장 사용기한 ${esc(fmtDate(b.expiryAt))}</div>
      ${b.customerName ? `<div class="fp-label-line">고객 ${esc(b.customerName)}</div>` : ''}
      <div class="fp-label-inci"><span class="fp-label-cap">전성분</span> ${esc(inci)}</div>
      <div class="fp-label-caution">맞춤형화장품 — 표시된 고객 외 사용 금지 · 이상 시 사용 중지</div>
    </div>`;
}

/** 사용 안내문 — 제형별 사용법·보관법·주의사항 */
export function buildGuideHtml(b) {
  const g = buildUsageGuideFromBatch(b);
  return `
    <div class="fp-doc">
      <h1>사용 안내문 — ${esc(b.formulaName || '(이름 없음)')}</h1>
      <p class="fp-meta-line">배치번호 ${esc(b.batchNo || '—')} · 권장 사용기한 ${esc(fmtDate(b.expiryAt))}</p>
      ${b.customerName ? `<p class="fp-meta-line">고객: ${esc(b.customerName)}</p>` : ''}
      <h3>사용법</h3><p class="fp-notes">${esc(g.directions)}</p>
      <h3>보관 방법</h3><p class="fp-notes">${esc(g.storage)}</p>
      <h3>주의사항</h3>
      <ul class="fp-steps">${g.cautions.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    </div>`;
}

/** 공용 인쇄 트리거 — 전용 영역에 렌더 후 window.print() */
export function printHtml(html) {
  const area = document.getElementById('formula-print-area');
  if (!area) return;
  area.innerHTML = html;
  document.body.classList.add('formula-printing');
  const cleanup = () => {
    document.body.classList.remove('formula-printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
