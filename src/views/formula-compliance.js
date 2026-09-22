// Formula OS — 법규 준수 체크리스트 (Phase D)
// 맞춤형화장품판매업자·조제관리사의 법정 의무를 카테고리별 자가점검 항목으로 정리.
// 항목 내용은 참조자료 법령 정리(과목1 cosmetic-law, 과목4 mixing-subdivision·overview)와
// ref_md 법령 원문에 근거하며, 각 항목은 근거 문서로 바로 이동 링크를 가진다.
// 체크 상태는 localStorage `formula_compliance`(시험별 네임스페이스)에 저장되고
// 백업/초기화 대상에 포함된다. 이 화면은 법률 자문이 아니며, 실제 의무 판단은
// 원문 법령과 관할 지방식약청 안내를 따라야 한다.

import { esc } from '../sanitize.js';
import { showToast, showConfirm } from '../ui-utils.js';
import { safeGetItem, safeSetItem } from '../state.js';
import { STORAGE_KEYS } from '../storage-keys.js';
import { contentPath } from '../exam-context.js';
import { showPanel, formulaSubNav } from './formula.js';

/* =======================================================
   참조 문서 테이블 — contentRoot 기준 상대 경로
   ======================================================= */

const LAW_DOCS = {
  law: {
    label: '화장품법 통합 정리',
    desc: '영업 3종·준수사항·과태료 (과목1)',
    path: '참조자료/과목1/1.cosmetic-law.md',
  },
  mix: {
    label: '혼합·소분 실무 정리',
    desc: '안전관리 기준·시설·위생 (과목4)',
    path: '참조자료/과목4/6.mixing-subdivision.md',
  },
  overview: {
    label: '맞춤형화장품 개요',
    desc: '제12조의2 준수사항·안정성시험 (과목4)',
    path: '참조자료/과목4/1.overview.md',
  },
  statute: {
    label: '화장품법(법률) 원문',
    desc: '제20901호 (2026-04-02 시행)',
    path: '참조자료/ref_md/과목1/화장품법(법률)(제20901호)(20260402)/화장품법(법률)(제20901호)(20260402).md',
  },
  rule: {
    label: '화장품법 시행규칙 원문',
    desc: '총리령 제02109호 (2026-04-02 시행)',
    path: '참조자료/ref_md/과목1/화장품법 시행규칙(총리령)(제02109호)(20260402)/화장품법 시행규칙(총리령)(제02109호)(20260402).md',
  },
  cgmp: {
    label: '우수화장품 제조·품질관리기준',
    desc: '식약처고시 제2024-46호',
    path: '참조자료/ref_md/과목2/우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822)/우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).md',
  },
  safety: {
    label: '화장품 안전기준 등에 관한 규정',
    desc: '식약처고시 제2026-19호 — 사용불가·한도 원료',
    path: '참조자료/ref_md/과목2/화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318)/화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).md',
  },
  caution: {
    label: '주의사항·알레르기 표시 규정',
    desc: '식약처고시 제2026-56호 — 유형별 주의사항·25종',
    path: '참조자료/ref_md/과목4/화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805)/화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).md',
  },
  labeling: {
    label: '포장 표시기준·방법 (별표4)',
    desc: '시행규칙 별표 — 기재사항·표시방법',
    path: '참조자료/ref_md/과목3/시행규칙_별표4_포장표시기준및방법/시행규칙_별표4_포장표시기준및방법.md',
  },
  sanctions: {
    label: '행정처분 기준 (별표7)',
    desc: '시행규칙 별표 — 위반별 처분 기준',
    path: '참조자료/ref_md/과목1/시행규칙_별표7_행정처분기준/시행규칙_별표7_행정처분기준.md',
  },
};

/* =======================================================
   체크리스트 정의 — 항목 id는 영구 안정 (체크 상태의 키)
   ======================================================= */

const SECTIONS = [
  {
    id: 'license',
    title: '영업·자격',
    icon: 'fa-id-card',
    items: [
      { id: 'lic-report', text: '맞춤형화장품판매업 신고 완료', note: '신고서 + 조제관리사 자격증 사본 + 시설명세서 (관할 지방식약청)', refs: ['law', 'rule'] },
      { id: 'lic-manager', text: '혼합·소분 업무에 조제관리사 배치', note: '품질·안전 관리 업무 종사자로 조제관리사를 두어야 함', refs: ['law', 'rule'] },
      { id: 'lic-edu', text: '조제관리사 매년 안전성·품질관리 교육 이수', note: '미이수 시 과태료(50만 원 이하) 대상', refs: ['law'] },
      { id: 'lic-materials', text: '사용 원료 목록 매년 1회 식약처 보고', note: '맞춤형화장품에 사용된 모든 원료 — 원료 장부로 목록 관리 가능', refs: ['law'] },
    ],
  },
  {
    id: 'facility',
    title: '시설·위생 기준',
    icon: 'fa-pump-soap',
    items: [
      { id: 'fac-space', text: '혼합·소분 공간을 다른 용도 공간과 분리·구획', note: '보건위생상 위해 우려가 없다고 인정되면 예외', refs: ['mix', 'rule'] },
      { id: 'fac-vent', text: '환기시설 구비', refs: ['mix'] },
      { id: 'fac-wash', text: '손·장비 세척을 위한 세척시설 구비', refs: ['mix'] },
      { id: 'fac-clean', text: '작업대·바닥·벽·천장·창문 청결 유지', refs: ['mix'] },
      { id: 'fac-pest', text: '방충·방서 대책 마련 + 정기 점검', refs: ['mix'] },
      { id: 'fac-person', text: '위생복·마스크 착용, 피부 외상자 작업 금지', refs: ['mix'] },
      { id: 'fac-tools', text: '장비·도구 사용 전·후 세척·건조·오염 방지', note: '세제 잔류 주의 · UV 살균기는 겹치지 않게 한 층 배치', refs: ['mix'] },
    ],
  },
  {
    id: 'mixing',
    title: '혼합·소분 안전관리',
    icon: 'fa-flask-vial',
    items: [
      { id: 'mix-cert', text: '혼합·소분 전 내용물·원료 품질성적서 확인', refs: ['law', 'mix'] },
      { id: 'mix-hand', text: '혼합·소분 전 손 소독·세정 또는 일회용 장갑', refs: ['law', 'mix'] },
      { id: 'mix-container', text: '포장용기 오염 여부 확인', refs: ['law', 'mix'] },
      { id: 'mix-hygiene', text: '기구 사용 전 위생 점검, 사용 후 세척', refs: ['law', 'mix'] },
      { id: 'mix-noillegal', text: '유통·판매 화장품의 임의 혼합·소분 금지', note: '향료·색소·보존제 추가로 제형을 바꾸는 행위 포함', refs: ['law'] },
    ],
  },
  {
    id: 'records',
    title: '기록 작성·보관',
    icon: 'fa-clipboard-check',
    items: [
      { id: 'rec-sales', text: '판매내역서 작성·보관', note: '제조번호 + 사용기한(또는 개봉 후 사용기간) + 판매일자·판매량 — 전자문서 가능', refs: ['law', 'overview'], app: { label: '조제 기록 탭', click: 'openBatchPanel' } },
      { id: 'rec-batch', text: '배치별 조제 기록 (처방·QC·위생) 유지', note: '이 앱의 조제 기록은 배치번호·품질 확인·위생 점검·검증 스냅샷을 보존', app: { label: '조제 기록 탭', click: 'openBatchPanel' } },
      { id: 'rec-consult', text: '고객 상담·알레르기 정보 기록', note: '피부 타입·알레르기·상담 이력 — 안전사고 추적의 근거', app: { label: '고객 관리 탭', click: 'openCustomerPanel' } },
      { id: 'rec-ledger', text: '원료 입고·사용기한·재고 기록', app: { label: '원료 장부 탭', click: 'openMaterialPanel' } },
    ],
  },
  {
    id: 'labeling',
    title: '표시·소비자 안내',
    icon: 'fa-tag',
    items: [
      { id: 'lab-label', text: '전성분·사용기한·주의사항 표시', note: '배치의 라벨 인쇄로 전성분·조제일·사용기한 표기 가능', refs: ['labeling', 'caution'], app: { label: '조제 기록 탭', click: 'openBatchPanel' } },
      { id: 'lab-explain', text: '판매 시 소비자에게 설명', note: '사용된 내용물·원료의 내용·특성 + 사용 시 주의사항 — 안내문 출력 활용', refs: ['law'], app: { label: '조제 기록 탭', click: 'openBatchPanel' } },
      { id: 'lab-ads', text: '의약품 오인·기능성 오인·허위 표시·광고 금지', note: '화장품법 제13조', refs: ['law', 'statute'] },
    ],
  },
  {
    id: 'safety',
    title: '안전·보고',
    icon: 'fa-shield-heart',
    items: [
      { id: 'saf-sideeffect', text: '부작용 발생 시 지체 없이 식약처 보고', refs: ['law', 'overview'] },
      { id: 'saf-ingredients', text: '사용불가 원료 배제·사용한도 준수', note: '배합 계산기가 한도·금지 원료를 자동 검증 (규정 확인용이며 안전성 보장 아님)', refs: ['safety'], app: { label: '배합 계산기', click: 'formulaNew' } },
      { id: 'saf-stability', text: '안정성 확인 기록 관리', note: '장기보존·가속·가혹·개봉 후 시험 — 처방의 안정성 확인 기록 활용', refs: ['cgmp', 'overview'] },
      { id: 'fac-inspect', text: '판매장 시설·기구 정기 점검 (보건위생상 위해 방지)', refs: ['law', 'overview'] },
    ],
  },
];

/* =======================================================
   체크 상태 영속화 — {checked: {id: isoString}, updatedAt}
   ======================================================= */

function loadChecks() {
  try {
    const raw = safeGetItem(STORAGE_KEYS.COMPLIANCE_CHECKS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.checked && typeof parsed.checked === 'object' ? parsed.checked : {};
  } catch (e) {
    return {};
  }
}

function saveChecks(checked) {
  return safeSetItem(STORAGE_KEYS.COMPLIANCE_CHECKS, JSON.stringify({ checked, updatedAt: new Date().toISOString() }));
}

/* =======================================================
   렌더링
   ======================================================= */

function refLinks(refs) {
  if (!refs || !refs.length) return '';
  return `<span class="comp-refs">${refs.map(key => {
    const doc = LAW_DOCS[key];
    if (!doc) return '';
    return `<a href="#" class="comp-ref-link" data-click="compOpenLaw" data-arg="${esc(key)}"><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${esc(doc.label)}</a>`;
  }).join('')}</span>`;
}

function renderSections(checked) {
  return SECTIONS.map(sec => {
    const done = sec.items.filter(it => checked[it.id]).length;
    const items = sec.items.map(it => {
      const isDone = !!checked[it.id];
      const appLink = it.app ? `<a href="#" class="comp-ref-link comp-app-link" data-click="${esc(it.app.click)}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i> ${esc(it.app.label)}</a>` : '';
      return `<li class="comp-item${isDone ? ' is-done' : ''}">
        <label class="comp-item-label">
          <input type="checkbox" class="comp-check" data-click="compToggle" data-arg="${esc(it.id)}"${isDone ? ' checked' : ''} aria-label="${esc(it.text)}">
          <span class="comp-item-text">${esc(it.text)}${it.note ? `<span class="comp-item-note">${esc(it.note)}</span>` : ''}</span>
        </label>
        <span class="comp-item-links">${refLinks(it.refs)}${appLink}</span>
      </li>`;
    }).join('');
    return `<section class="comp-section">
      <h5 class="comp-section-title"><i class="fa-solid ${esc(sec.icon)}" aria-hidden="true"></i> ${esc(sec.title)} <span class="comp-count">${done}/${sec.items.length}</span></h5>
      <ul class="comp-list">${items}</ul>
    </section>`;
  }).join('');
}

function renderDocList() {
  return Object.keys(LAW_DOCS).map(key => {
    const doc = LAW_DOCS[key];
    return `<a href="#" class="comp-doc-link" data-click="compOpenLaw" data-arg="${esc(key)}">
      <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
      <span class="comp-doc-label">${esc(doc.label)}</span>
      <span class="comp-doc-desc">${esc(doc.desc)}</span>
    </a>`;
  }).join('');
}

function render() {
  const checked = loadChecks();
  const list = document.getElementById('comp-list');
  if (list) list.innerHTML = renderSections(checked);
  const docs = document.getElementById('comp-docs');
  if (docs) docs.innerHTML = renderDocList();
  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const done = Object.keys(checked).filter(id => checked[id]).length;
  const badge = document.getElementById('comp-progress-badge');
  if (badge) badge.textContent = `점검 ${done}/${total}`;
}

/* =======================================================
   공개 핸들러
   ======================================================= */

export function openCompliancePanel() {
  showPanel('formula-compliance-panel');
  const subnav = document.getElementById('formula-compliance-subnav');
  if (subnav) subnav.innerHTML = formulaSubNav('compliance');
  render();
}

export function compToggle(itemId) {
  if (typeof itemId !== 'string' || !itemId) return;
  const known = SECTIONS.some(s => s.items.some(it => it.id === itemId));
  if (!known) return;
  const checked = loadChecks();
  if (checked[itemId]) {
    delete checked[itemId];
  } else {
    checked[itemId] = new Date().toISOString();
  }
  saveChecks(checked);
  render();
}

export function compReset() {
  showConfirm('체크리스트 점검 상태를 모두 초기화할까요?').then(ok => {
    if (!ok) return;
    saveChecks({});
    render();
    showToast('체크리스트를 초기화했습니다.');
  }).catch(() => {});
}

export function compOpenLaw(key) {
  const doc = LAW_DOCS[key];
  if (!doc) return;
  if (window.ExamViewer && window.ExamViewer.openExam) {
    window.ExamViewer.openExam(contentPath(doc.path));
  } else {
    showToast('문서 뷰어를 사용할 수 없습니다.');
  }
}

// 테스트·외부 검증용 — 항목 정의와 문서 테이블 노출
export { SECTIONS as COMPLIANCE_SECTIONS, LAW_DOCS };
