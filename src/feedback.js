// src/feedback.js — 사용자 의견 수신 (USER_FEEDBACK_DESIGN.md)
// ------------------------------------------------------------
// 익명 insert 가능한 Supabase `feedback` 테이블로 의견을 보낸다.
// 오프라인·미설정 환경에서는 localStorage 큐(pending_feedback)에 쌓아
// 온라인 복귀 또는 다음 제출 시 플러시한다.
// 유입 채널은 부팅 시 ?src= 파라미터를 entry_source에 기록해 첨부.
// ------------------------------------------------------------
import { getJSON, setJSON, getItem, setItem } from './storage.js';
import { getActiveExamId } from './exam-context.js';
import { getSupabase, getAuthSession } from './supabase-client.js';
import { esc } from './sanitize.js';
import { trapFocus, showToast } from './ui-utils.js';

const ENTRY_SRC_KEY = 'entry_source';
const QUEUE_KEY = 'pending_feedback';
const COOLDOWN_KEY = 'feedback_last_ts';
const HINT_KEY = 'feedback_hint_seen';   // "의견 보내기" NEW 배지 클릭 여부
const DOT_KEY = 'feedback_dot_seen';     // 설정 버튼 점 — 패널 첫 오픈까지
const COOLDOWN_MS = 60_000;
const QUEUE_MAX = 20;
const BODY_MIN = 4;
const BODY_MAX = 2000;
const SRC_RE = /^[a-z0-9-]{1,20}$/;
// 이메일·전화번호 등 개인정보 패턴 — 제출 전 경고용 (best-effort 차단)
const PII_RE = /[\w.+-]+@[\w-]+\.[\w.]+|0?1[0-9]-?\d{3,4}-?\d{4}/;

export const FEEDBACK_KINDS = [
    { id: 'improve', label: '개선' },
    { id: 'praise', label: '칭찬' },
    { id: 'bug', label: '오류' },
    { id: 'idea', label: '제안' },
];

// ---------------------------------------------------------------------------
// 유입 채널 추적
// ---------------------------------------------------------------------------

/**
 * 부팅 시 URL의 ?src= 파라미터를 캡처해 최초 유입 채널로 기록한다.
 * 이미 기록돼 있으면 덮어쓰지 않는다 (최초 유입 채널 보존).
 * 캡처 후에는 주소창에서 파라미터를 제거한다.
 */
export function captureEntrySource() {
    try {
        const url = new URL(window.location.href);
        const src = url.searchParams.get('src');
        if (!src || !SRC_RE.test(src)) return;
        if (!getItem(ENTRY_SRC_KEY)) {
            setJSON(ENTRY_SRC_KEY, { src, ts: Date.now() });
        }
        url.searchParams.delete('src');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) { /* noop — URL 파싱 실패는 무시 */ }
}

export function getEntrySource() {
    return getJSON(ENTRY_SRC_KEY)?.src ?? null;
}

// ---------------------------------------------------------------------------
// 신기능 안내 힌트 — 설정 ⚙️ 점 + "의견 보내기" NEW 배지 (각 1회성)
// ---------------------------------------------------------------------------

/** 부팅 시 호출 — 아직 안 봤으면 설정 버튼에 점, 메뉴 항목에 NEW 배지 부착 */
export function initFeedbackHint() {
    if (!getItem(DOT_KEY)) {
        const btn = document.getElementById('settings-toggle-btn');
        if (btn && !btn.querySelector('.feedback-dot')) {
            const dot = document.createElement('span');
            dot.className = 'feedback-dot';
            dot.setAttribute('aria-hidden', 'true');
            btn.appendChild(dot);
        }
    }
    if (!getItem(HINT_KEY)) {
        const fb = document.getElementById('feedback-btn');
        if (fb && !fb.querySelector('.feedback-new')) {
            const badge = document.createElement('span');
            badge.className = 'feedback-new';
            badge.textContent = 'NEW';
            fb.appendChild(badge);
        }
    }
}

/** 설정 패널 첫 오픈 → ⚙️ 점 제거 */
export function dismissFeedbackDot() {
    if (!getItem(DOT_KEY)) {
        setItem(DOT_KEY, '1');
        document.querySelector('#settings-toggle-btn .feedback-dot')?.remove();
    }
}

/** "의견 보내기" 첫 클릭 → NEW 배지 제거 */
export function dismissFeedbackHint() {
    if (!getItem(HINT_KEY)) {
        setItem(HINT_KEY, '1');
        document.querySelector('#feedback-btn .feedback-new')?.remove();
    }
}

// ---------------------------------------------------------------------------
// 제출 페이로드 (순수 함수 — 테스트 용이)
// ---------------------------------------------------------------------------

export function buildFeedbackPayload({ kind, rating, body, view, honeypot, userId }) {
    const k = FEEDBACK_KINDS.some(f => f.id === kind) ? kind : 'improve';
    const r = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
    return {
        kind: k,
        rating: r,
        body: String(body || '').trim().slice(0, BODY_MAX),
        view: view || null,
        app_version: (typeof window !== 'undefined' && window.APP_VERSION) || null,
        entry_src: getEntrySource(),
        exam_id: getActiveExamId(),
        user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
        user_id: userId || null,
        meta: { honeypot: !!honeypot },
    };
}

export function validateFeedback(payload) {
    if (payload.meta?.honeypot) return 'spam';
    if (!payload.body || payload.body.length < BODY_MIN) return 'short';
    if (payload.body.length > BODY_MAX) return 'long';
    if (PII_RE.test(payload.body)) return 'pii';
    return null;
}

export function cooldownRemaining(now = Date.now(), lastTs = null) {
    const last = lastTs ?? (Number(getItem(COOLDOWN_KEY)) || 0);
    return Math.max(0, COOLDOWN_MS - (now - last));
}

// ---------------------------------------------------------------------------
// 큐 + 전송
// ---------------------------------------------------------------------------

function enqueue(item) {
    const q = getJSON(QUEUE_KEY, []);
    q.push(item);
    if (q.length > QUEUE_MAX) q.shift(); // 가장 오래된 것부터 폐기
    setJSON(QUEUE_KEY, q);
    return q.length;
}

async function insertRemote(items) {
    const sb = await getSupabase();
    if (!sb) return { ok: false };
    const session = await getAuthSession();
    const uid = session?.user?.id || null;
    const rows = items.map(i => ({ ...i, user_id: i.user_id || uid }));
    const { error } = await sb.from('feedback').insert(rows);
    return { ok: !error };
}

/** 큐에 쌓인 의견을 전송한다 — 온라인 복귀·다음 제출 시 호출 */
export async function flushPendingFeedback() {
    const q = getJSON(QUEUE_KEY, []);
    if (!q.length) return 0;
    const res = await insertRemote(q);
    if (!res.ok) return 0;
    setJSON(QUEUE_KEY, []);
    return q.length;
}

/**
 * 의견 제출 — 성공/큐잉/거부를 구분해 반환.
 * @returns {{status:'sent'|'queued'|'cooldown'|'invalid'|'spam'|'pii', queuedCount?:number}}
 */
export async function submitFeedback(input) {
    if (cooldownRemaining() > 0) return { status: 'cooldown' };
    const payload = buildFeedbackPayload(input);
    const invalid = validateFeedback(payload);
    if (invalid) return { status: invalid };

    setItem(COOLDOWN_KEY, String(Date.now()));

    // 선행 큐와 함께 한 번에 전송 시도
    const pending = getJSON(QUEUE_KEY, []);
    const all = [...pending, payload];
    const res = await insertRemote(all);
    if (res.ok) {
        setJSON(QUEUE_KEY, []);
        return { status: 'sent' };
    }
    const queuedCount = enqueue(payload); // 신규 건만 큐잉 (기존 큐는 유지)
    return { status: 'queued', queuedCount };
}

// ---------------------------------------------------------------------------
// 모달 UI
// ---------------------------------------------------------------------------

/** 의견 보내기 모달 — 전용 overlay id로 showConfirm/showAlert와 독립 */
export function showFeedbackModal(currentView) {
    const existing = document.getElementById('feedback-overlay');
    if (existing) existing.remove();

    const src = getEntrySource();
    const ver = (typeof window !== 'undefined' && window.APP_VERSION) || '';
    const ctxBits = [currentView, ver, src].filter(Boolean).join(' · ');

    const overlay = document.createElement('div');
    overlay.id = 'feedback-overlay';
    overlay.innerHTML = `
        <div class="app-confirm-dialog feedback-dialog" role="dialog" aria-modal="true" aria-label="의견 보내기">
            <h3><i class="fa-solid fa-comment-dots" aria-hidden="true"></i> 의견 보내기</h3>
            <div class="feedback-body">
                <div class="feedback-kinds" role="radiogroup" aria-label="의견 유형">
                    ${FEEDBACK_KINDS.map(k =>
                        `<button type="button" class="feedback-kind" data-kind="${k.id}" aria-pressed="${k.id === 'improve'}">${k.label}</button>`).join('')}
                </div>
                <div class="feedback-stars" role="radiogroup" aria-label="평가 (선택)">
                    ${[1, 2, 3, 4, 5].map(n =>
                        `<button type="button" class="feedback-star" data-star="${n}" aria-label="${n}점">★</button>`).join('')}
                </div>
                <textarea class="feedback-text" rows="4" maxlength="${BODY_MAX}"
                    placeholder="어떤 점이 좋았거나 불편했는지 알려주세요"></textarea>
                <input type="text" class="feedback-hp" tabindex="-1" aria-hidden="true" autocomplete="off" />
                <p class="feedback-ctx">📎 ${esc(ctxBits || '앱 정보 없음')}</p>
                <p class="feedback-note">연락처·이름 등 개인정보는 넣지 말아 주세요.</p>
            </div>
            <div class="app-confirm-actions">
                <button class="app-confirm-cancel">취소</button>
                <button class="app-confirm-ok feedback-submit">보내기</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const dialog = overlay.querySelector('.app-confirm-dialog');
    requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
        dialog.classList.add('is-visible');
    });

    let kind = 'improve';
    let rating = null;
    overlay.querySelectorAll('.feedback-kind').forEach(btn => {
        btn.addEventListener('click', () => {
            kind = btn.dataset.kind;
            overlay.querySelectorAll('.feedback-kind').forEach(b =>
                b.setAttribute('aria-pressed', String(b === btn)));
        });
    });
    overlay.querySelectorAll('.feedback-star').forEach(btn => {
        btn.addEventListener('click', () => {
            const n = Number(btn.dataset.star);
            rating = (rating === n) ? null : n; // 같은 별 재클릭 → 해제
            overlay.querySelectorAll('.feedback-star').forEach(b =>
                b.classList.toggle('is-on', Number(b.dataset.star) <= (rating || 0)));
        });
    });

    const untrapFocus = trapFocus(dialog);
    const close = () => {
        overlay.classList.remove('is-visible');
        dialog.classList.remove('is-visible');
        setTimeout(() => { untrapFocus(); overlay.remove(); }, 200);
    };
    overlay.querySelector('.app-confirm-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
    };
    document.addEventListener('keydown', onKey);

    overlay.querySelector('.feedback-submit').addEventListener('click', async () => {
        const body = overlay.querySelector('.feedback-text').value;
        const honeypot = overlay.querySelector('.feedback-hp').value;
        const result = await submitFeedback({ kind, rating, body, view: currentView, honeypot });
        switch (result.status) {
            case 'sent':
                close();
                showToast('의견을 보냈습니다. 감사합니다!', 'success');
                break;
            case 'queued':
                close();
                showToast('오프라인 상태 — 연결되면 자동으로 전송됩니다.', 'info');
                break;
            case 'cooldown':
                showToast('잠시 후에 다시 보낼 수 있습니다.', 'info');
                break;
            case 'pii':
                showToast('이메일·전화번호는 넣지 말아 주세요.', 'error');
                break;
            case 'short':
                showToast(`내용을 ${BODY_MIN}자 이상 입력해 주세요.`, 'error');
                break;
            case 'spam':
                close(); // 봇으로 의심 — 조용히 성공인 척 닫기
                showToast('의견을 보냈습니다. 감사합니다!', 'success');
                break;
            default:
                showToast('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
        }
    });
}
