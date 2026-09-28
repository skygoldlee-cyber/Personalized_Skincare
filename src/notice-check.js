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

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAW_SEARCH_URL = 'https://www.law.go.kr/법령/화장품안전기준등에관한규정';

function statusUrl(examId) {
  return `https://raw.githubusercontent.com/skygoldlee-cyber/Personalized_Skincare/main/content/exams/${examId}/notice_status.json`;
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

function renderBanner(latest) {
  const el = document.getElementById('formula-notice-banner');
  if (!el) return;
  const dismissed = getItem(STORAGE_KEYS.NOTICE_DISMISSED_DATE) || '';
  if (dismissed && latest.effectiveDate && dismissed >= latest.effectiveDate) return;
  const notice = latest.notice || '신규 고시';
  const eff = latest.effectiveDate ? `(${latest.effectiveDate} 시행)` : '';
  el.innerHTML = `
    <div class="notice-banner-body">
      <span class="notice-banner-icon" aria-hidden="true">⚠</span>
      <div class="notice-banner-text">
        <strong>식약처 고시 ${escapeHTML(notice)} ${escapeHTML(eff)} 확인됨</strong><br>
        원료 DB는 이전 고시 기준입니다. 배합 전 <a href="${LAW_SEARCH_URL}" target="_blank" rel="noopener">고시 원문(law.go.kr)</a>을 확인하세요.
      </div>
      <button type="button" class="notice-banner-close" data-click="dismissMfdsNotice" data-arg="${escapeHTML(latest.effectiveDate || '')}" aria-label="닫기">×</button>
    </div>`;
  el.hidden = false;
}

/** Formula OS 첫 표시 시 호출 — 실패해도 조용히 무시 */
export async function checkMfdsNotice() {
  try {
    const last = parseInt(getItem(STORAGE_KEYS.NOTICE_CHECKED_AT) || '0', 10);
    if (Date.now() - last < CHECK_INTERVAL_MS) return;

    const res = await fetch(statusUrl(getActiveExamId() || 'cosmetic'), { cache: 'no-store' });
    if (!res.ok) return; // 실패 시 스탬프 안 찍음 — 다음 진입에 재시도
    setItem(STORAGE_KEYS.NOTICE_CHECKED_AT, String(Date.now()));
    const status = await res.json();
    if (isNewerNotice(status)) renderBanner(status.latest);
  } catch (_) { /* 네트워크/파싱 실패 — 배너 생략 */ }
}

/** 배너 닫기 (data-click 위임) — 같은 시행일의 고시는 다시 표시하지 않음 */
export function dismissMfdsNotice(effectiveDate) {
  if (effectiveDate) setItem(STORAGE_KEYS.NOTICE_DISMISSED_DATE, effectiveDate);
  const el = document.getElementById('formula-notice-banner');
  if (el) el.hidden = true;
}
