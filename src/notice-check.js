// notice-check.js — 식약처 고시 감지 배너 (Formula OS 최초 진입 시)
//
// 구조: GitHub Actions(주1회)가 law.go.kr 오픈API로 최신 고시를 조회해
// content/exams/<id>/notice_status.json에 기록 → 앱은 raw.githubusercontent.com에서
// 읽어 baseline(번들 원료 DB 기준)보다 최신이면 배너로 알림.
// 하루 1회 스로틀 + 닫은 고시는 같은 시행일까지 억제. 오프라인/실패 시 무시.

import { getItem, setItem } from './storage.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { getActiveExamId } from './exam-context.js';
import { escapeHTML } from './sanitize.js';
import { lawUrlFor } from './law-links.js';
import { getRefTables } from './pdf-registry.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
// 한글주소(행정규칙) — 일련번호를 알면 admRulInfoP.do 상세 페이지가 더 정확
const LAW_SEARCH_URL = 'https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정';
function ruleInfoUrl(serial) {
  return serial ? `https://www.law.go.kr/admRulInfoP.do?admRulSeq=${encodeURIComponent(serial)}` : LAW_SEARCH_URL;
}
const RULE_NAME = '화장품 안전기준 등에 관한 규정';
const LAW_API = 'https://www.law.go.kr/DRF';
// law.go.kr 오픈API 운영자 코드 — 공개 계정 식별자(비밀키 아님). 호출량 제한은 계정별 적용
const LAW_OC = 'goldrune1125';

function statusUrl(examId) {
  return `https://raw.githubusercontent.com/skygoldlee-cyber/Personalized_Skincare/main/content/exams/${examId}/notice_status.json`;
}

/** '제2026-19호' / '2026-19' 등 → '제2026-19호' 정규화 (순수 함수 — 테스트용) */
export function normalizeNotice(s) {
  const m = /^제?\s*(20\d{2})\s*-?\s*(\d+)\s*호?$/.exec(String(s ?? '').trim());
  return m ? `제${m[1]}-${m[2]}호` : null;
}

/** 상세 응답 객체에서 최신 고시번호 추출 (순수 함수 — 테스트용) */
export function findNoticeNumber(node) {
  const cands = [];
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') { walk(v); continue; }
      if (k.includes('공포번호') || k.includes('고시번호')) {
        const n = normalizeNotice(v);
        if (n) cands.push(n);
      }
    }
  })(node);
  if (!cands.length) {
    for (const m of JSON.stringify(node).matchAll(/제\s*20\d{2}\s*-\s*\d+\s*호/g)) {
      const n = normalizeNotice(m[0]);
      if (n) cands.push(n);
    }
  }
  if (!cands.length) return null;
  const key = (s) => { const m = /20(\d{2})-(\d+)/.exec(s); return m ? [+m[1], +m[2]] : [0, 0]; };
  return cands.sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1]).pop();
}

/** baseline보다 최신 고시인지 판정 (순수 함수 — 테스트용) */
export function isNewerNotice(status) {
  const latest = status?.latest;
  const base = status?.baseline;
  if (!latest || !base) return false;
  const le = latest.effectiveDate || '';
  const be = base.effectiveDate || '';
  if (le && be) return le > be;
  // 날짜가 없으면 고시번호 비교 (제2026-19호 → [2026,19])
  const num = (s) => { const m = /20(\d{2})\s*-\s*(\d+)/.exec(s || ''); return m ? [+m[1], +m[2]] : null; };
  const ln = num(latest.notice); const bn = num(base.notice);
  return !!(ln && bn && (ln[0] > bn[0] || (ln[0] === bn[0] && ln[1] > bn[1])));
}

function renderBanner(latest, extraDocs) {
  const el = document.getElementById('formula-notice-banner');
  if (!el) return;
  const dismissed = getItem(STORAGE_KEYS.NOTICE_DISMISSED_DATE) || '';
  if (dismissed && latest.effectiveDate && dismissed >= latest.effectiveDate) return;
  const notice = latest.notice || '신규 고시';
  const label = latest.ruleName || '식약처 고시';
  const eff = latest.effectiveDate ? `(${latest.effectiveDate} 시행)` : '';
  const extra = extraDocs?.length
    ? `<br><small>함께 갱신된 문서: ${extraDocs.map(d => escapeHTML(d)).join(', ')} — '고시 정보 보기'에서 문서별 비교를 확인하세요.</small>`
    : '';
  el.innerHTML = `
    <div class="notice-banner-body">
      <span class="notice-banner-icon" aria-hidden="true">⚠</span>
      <div class="notice-banner-text">
        <strong>${escapeHTML(label)} ${escapeHTML(notice)} ${escapeHTML(eff)} 확인됨</strong><br>
        앱 문서는 이전 기준의 스냅샷입니다. 배합 전 <a href="${ruleInfoUrl(latest.serialNo)}" target="_blank" rel="noopener">공식 원문(law.go.kr)</a>을 확인하세요.${extra}
      </div>
      <button type="button" class="notice-banner-close" data-click="dismissMfdsNotice" data-arg="${escapeHTML(latest.effectiveDate || '')}" aria-label="닫기">×</button>
    </div>`;
  el.hidden = false;
}

// ——— 상태 파일 캐시 (다문서 docs[] — 참조 링크 '갱신 필요' 배지에 사용) ———
let _lastStatus = null;
let _statusPromise = null;

/** notice_status.json 캐시 반환 — 원격 우선, 번들 폴백. 최초 1회만 fetch */
export function ensureNoticeStatus() {
  if (_statusPromise) return _statusPromise;
  const examId = getActiveExamId() || 'cosmetic';
  _statusPromise = (async () => {
    for (const url of [statusUrl(examId), `content/exams/${examId}/notice_status.json`]) {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) { _lastStatus = await r.json(); break; }
      } catch (_) { /* 다음 후보 */ }
    }
    return _lastStatus;
  })();
  return _statusPromise;
}

/** 렌더된 참조 링크(data-law-url)를 스캔해 원문 개정 문서에 '갱신 필요' 배지 삽입 */
export function markStaleRefLinks(root = document) {
  const stale = new Set((_lastStatus?.docs || []).filter(d => d.newer && d.url).map(d => d.url));
  if (!stale.size) return;
  root.querySelectorAll('[data-law-url]').forEach(el => {
    if (!stale.has(/** @type {HTMLElement} */ (el).dataset.lawUrl) || el.querySelector('.ref-stale-badge')) return;
    el.insertAdjacentHTML('beforeend',
      ' <span class="ref-stale-badge" title="공식 원문이 개정됐습니다 — 앱 내 문서는 이전 기준 스냅샷일 수 있습니다">⚠ 갱신 필요</span>');
  });
}

/** Formula OS 첫 표시 시 호출 — 실패해도 조용히 무시 */
export async function checkMfdsNotice() {
  try {
    const last = parseInt(getItem(STORAGE_KEYS.NOTICE_CHECKED_AT) || '0', 10);
    if (Date.now() - last < CHECK_INTERVAL_MS) { ensureNoticeStatus(); return; }

    const res = await fetch(statusUrl(getActiveExamId() || 'cosmetic'), { cache: 'no-store' });
    if (!res.ok) return; // 실패 시 스탬프 안 찍음 — 다음 진입에 재시도
    setItem(STORAGE_KEYS.NOTICE_CHECKED_AT, String(Date.now()));
    const status = await res.json();
    _lastStatus = status;
    if (isNewerNotice(status)) {
      const extra = (status.docs || []).filter(d => d.newer && d.name !== RULE_NAME).map(d => d.name);
      renderBanner(status.latest, extra);
    } else if (status.docs?.some(d => d.newer)) {
      // 안전기준 외 문서만 개정된 경우 — 참조 문서 갱신 안내 배너
      const changed = status.docs.filter(d => d.newer);
      renderBanner(
        { notice: changed[0].latestNotice || '개정 확인', effectiveDate: changed[0].latestDate,
          serialNo: '', ruleName: changed[0].name },
        changed.slice(1).map(d => d.name),
      );
    }
  } catch (_) { /* 네트워크/파싱 실패 — 배너 생략 */ }
}

// ——— 수동 실시간 확인 (law.go.kr 직접 조회 — 참조 법령·고시 전체) ———

async function lawApi(path, params, target = 'admrul') {
  const q = new URLSearchParams({ OC: LAW_OC, target, type: 'JSON', ...params });
  const res = await fetch(`${LAW_API}/${path}?${q}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fmtDate(d) {
  d = String(d || '').trim();
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
}

/** 참조자료 파일명 → 감시 메타 (공식명·기준 고시·시행일·API 유형 — 순수 함수, 테스트용) */
export function parseRefDoc(file) {
  const name = String(file).split('(')[0].trim();
  const m = /\(제([\d]+(?:-\d+)?)호\)\s*\((\d{8})\)/.exec(file);
  const target = /\((법률|대통령령|총리령|부령)\)/.test(file) ? 'law' : 'admrul';
  return {
    name, target, file, url: lawUrlFor(file),
    baselineNotice: m ? `제${m[1]}호` : null,
    baselineDate: m ? fmtDate(m[2]) : null,
  };
}

/** 감시 문서 목록 — references.json referenceLaw에서 유도 (pdf-registry 경유) */
export function watchDocs() {
  const laws = getRefTables().REFERENCE_LAW || [];
  return laws.filter(f => f.file).map(f => parseRefDoc(f.file));
}

/** 문서 1종의 law.go.kr 최신본 조회 → {notice, effectiveDate, serial} */
async function fetchLatestFor(doc) {
  if (doc.target === 'law') {
    const res = await lawApi('lawSearch.do', { query: doc.name, display: 50, sort: 'efdes' }, 'law');
    let items = res?.LawSearch?.law ?? [];
    if (!Array.isArray(items)) items = [items];
    const exact = items.filter((i) => String(i['법령명한글'] || '').trim() === doc.name);
    if (!exact.length) throw new Error('법령 검색 결과 없음');
    exact.sort((a, b) => String(b['시행일자'] || '').localeCompare(String(a['시행일자'] || '')));
    return {
      notice: exact[0]['공포번호'] ? `제${exact[0]['공포번호']}호` : null,
      effectiveDate: fmtDate(exact[0]['시행일자']),
      serial: String(exact[0]['법령일련번호'] || ''),
    };
  }
  const res = await lawApi('lawSearch.do', { query: doc.name, display: 50, sort: 'efdes' });
  let items = res?.AdmRulSearch?.admrul ?? [];
  if (!Array.isArray(items)) items = [items];
  const exact = items.filter((i) => String(i['행정규칙명'] || '').trim() === doc.name);
  if (!exact.length) throw new Error('규정 검색 결과 없음');
  exact.sort((a, b) => String(b['시행일자'] || '').localeCompare(String(a['시행일자'] || '')));
  const serial = String(exact[0]['행정규칙일련번호'] || '');
  const detail = await lawApi('lawService.do', { ID: serial });
  return {
    notice: findNoticeNumber(detail),
    effectiveDate: fmtDate(exact[0]['시행일자']),
    serial,
  };
}

/** law.go.kr에서 대상 규정의 최신 시행 고시 조회 (레거시 단일 문서 — 테스트 호환) */
async function fetchLatestNotice() {
  return fetchLatestFor(parseRefDoc('화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf'));
}

/** 번들 기준 고시 — 같은 출처 스냅샷 우선(배포 DB와 일치), 실패 시 원격 상태 파일 */
async function fetchBaseline(examId) {
  for (const url of [`content/exams/${examId}/notice_status.json`, statusUrl(examId)]) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) return (await r.json()).baseline || null;
    } catch (_) { /* 다음 후보 */ }
  }
  return null;
}

/** '식약처 고시 확인' 버튼 (data-click 위임) — 참조 법령·고시 전체를 law.go.kr에서 병렬 조회 */
export async function checkMfdsNoticeNow() {
  const out = document.getElementById('notice-check-result');
  const btn = /** @type {HTMLButtonElement|null} */ (document.querySelector('[data-click="checkMfdsNoticeNow"]'));
  if (out) out.textContent = 'law.go.kr 확인 중…';
  if (btn) btn.disabled = true;
  try {
    const docs = watchDocs();
    const results = await Promise.allSettled(docs.map(d => fetchLatestFor(d)));
    const changed = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') { failed.push(docs[i].name); return; }
      const live = r.value;
      if (live.effectiveDate && docs[i].baselineDate && live.effectiveDate > docs[i].baselineDate) {
        changed.push({ ...docs[i], latestNotice: live.notice, latestDate: live.effectiveDate, serial: live.serial });
      }
    });
    setItem(STORAGE_KEYS.NOTICE_CHECKED_AT, String(Date.now()));
    if (changed.length) {
      const first = changed[0];
      renderBanner({ notice: first.latestNotice, effectiveDate: first.latestDate,
                     serialNo: first.target === 'admrul' ? first.serial : '', ruleName: first.name },
                   changed.slice(1).map(d => d.name));
      const names = changed.map(d => `${d.name} ${d.latestNotice || ''}`).join(' · ');
      if (out) out.textContent = `⚠ 개정 감지 ${changed.length}종 — ${names}. 참조 문서 스냅샷 갱신 필요${failed.length ? ` (${failed.length}종 조회 실패)` : ''}`;
    } else if (out) {
      out.textContent = `✅ 최신 상태 — 감시 문서 ${docs.length - failed.length}종 모두 기준과 일치${failed.length ? ` (${failed.length}종 조회 실패)` : ''}`;
    }
  } catch (_) {
    if (out) out.textContent = '확인 실패 — 네트워크 또는 law.go.kr 응답 오류. 잠시 후 다시 시도하세요.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** 상태 파일 → 표시용 행 목록 (순수 함수 — 테스트용) */
export function statusRows(status) {
  if (!status) return [];
  const b = status.baseline || {};
  const l = status.latest || {};
  const rows = [
    ['기준(번들 DB)', `${b.notice || '—'} · 시행 ${b.effectiveDate || '—'}`],
    ['최신 확인', `${l.notice || '—'} · 시행 ${l.effectiveDate || '—'}${l.serialNo ? ` · 일련번호 ${l.serialNo}` : ''}`],
    ['마지막 자동 확인', status.checkedAt || '—'],
    ['신규 고시', status.newerFound ? '있음 — 원문 확인 필요' : '없음'],
  ];
  // 문서별 기준↔최신 비교 — 개정 감지 시 '갱신 필요' 표시
  if (Array.isArray(status.docs) && status.docs.length) {
    rows.push(['감시 문서', `${status.docs.length}종 — 기준 고시 ↔ law.go.kr 최신`]);
    for (const d of status.docs) {
      const mark = d.newer ? ' ⚠ 갱신 필요' : (d.error ? ' (조회 실패)' : '');
      rows.push([`· ${d.name}`, `${d.baselineNotice || '—'}(${d.baselineDate || '—'}) → ${d.latestNotice || '—'}(${d.latestDate || '—'})${mark}`]);
    }
  }
  return rows;
}

/** '고시 정보 보기' 버튼 (data-click 위임) — notice_status.json 내용을 패널로 표시/숨김 */
export async function viewMfdsNoticeStatus() {
  const panel = document.getElementById('notice-status-view');
  if (!panel) return;
  if (!panel.hidden) { panel.hidden = true; return; }
  panel.innerHTML = '<div class="notice-status-loading">상태 파일 불러오는 중…</div>';
  panel.hidden = false;

  const examId = getActiveExamId() || 'cosmetic';
  let status = null;
  let source = '';
  // Actions가 갱신한 원격 파일 우선, 실패 시 번들 스냅샷
  for (const [url, tag] of [[statusUrl(examId), '원격'], [`content/exams/${examId}/notice_status.json`, '번들']]) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) { status = await r.json(); source = tag; break; }
    } catch (_) { /* 다음 후보 */ }
  }
  if (!status) {
    panel.innerHTML = '<div class="notice-status-loading">상태 파일을 불러오지 못했습니다 — 네트워크를 확인하세요.</div>';
    return;
  }
  const rows = statusRows(status).map(([k, v]) =>
    `<div class="notice-status-row"><span class="notice-status-key">${escapeHTML(k)}</span><span>${escapeHTML(v)}</span></div>`).join('');
  panel.innerHTML = `
    ${rows}
    <div class="notice-status-links">
      <a href="${statusUrl(examId)}" target="_blank" rel="noopener">상태 파일 원문</a>
      <a href="${ruleInfoUrl(status.latest?.serialNo)}" target="_blank" rel="noopener">고시 원문(law.go.kr)</a>
      <span class="notice-status-src">출처: ${source}</span>
    </div>`;
}

/** 배너 닫기 (data-click 위임) — 같은 시행일의 고시는 다시 표시하지 않음 */
export function dismissMfdsNotice(effectiveDate) {
  if (effectiveDate) setItem(STORAGE_KEYS.NOTICE_DISMISSED_DATE, effectiveDate);
  const el = document.getElementById('formula-notice-banner');
  if (el) el.hidden = true;
}
