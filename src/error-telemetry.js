// src/error-telemetry.js — 클라이언트 런타임 오류 텔레메트리
// @spec none (관측성 인프라 — Supabase 미설정 환경에서는 완전 무동작)
// ------------------------------------------------------------
// window 'error'·'unhandledrejection' 이벤트를 수집해 익명 insert가 허용된
// client_errors 테이블로 보낸다 (feedback.js와 같은 전송 패턴).
// - Supabase 미설정: 아무 일도 하지 않음 (조용히 no-op)
// - 세션당 상한·메시지 중복 억제로 폭주 방지 — 오류 루프가 네트워크 폭주가 되지 않게
// - 개인정보 최소화: message/stack/url/버전·UA만 전송, 입력 데이터 미포함
// ------------------------------------------------------------
import { getSupabase } from './supabase-client.js';
import { getActiveExamId } from './exam-context.js';

const MAX_PER_SESSION = 10;   // 세션당 전송 상한
const STACK_MAX = 4000;       // 스택 잘라내기
const _seen = new Set();      // kind+message 중복 억제
let _sent = 0;
let _installed = false;

/**
 * 오류 이벤트 → DB 행 페이로드 (순수 함수 — 테스트 용이)
 * @param {string} kind 'error'|'unhandledrejection'
 * @param {unknown} err Error 객체 또는 임의 값
 * @param {Object} [meta] { view, filename, lineno }
 */
export function buildErrorPayload(kind, err, meta = {}) {
    const e = err instanceof Error ? err : null;
    const rawMsg = e ? e.message : ((/** @type {{message?: unknown}} */ (err) || {}).message ?? err);
    const message = String(rawMsg || 'unknown').slice(0, 500);
    return {
        kind: kind === 'unhandledrejection' ? 'unhandledrejection' : 'error',
        message,
        stack: (e && e.stack ? String(e.stack) : '').slice(0, STACK_MAX) || null,
        view: meta.view || null,
        exam_id: (() => { try { return getActiveExamId(); } catch { return null; } })(),
        app_version: (typeof window !== 'undefined' && window.APP_VERSION) || null,
        url: (typeof window !== 'undefined' && window.location?.pathname) || null,
        user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
        meta: {
            filename: meta.filename || null,
            lineno: meta.lineno || null,
            ...(meta.extra || {}),
        },
    };
}

/** 기본 전송 — Supabase client_errors 테이블 (익명 insert 정책, schema.sql §5) */
async function defaultInsert(rows) {
    const sb = await getSupabase();
    if (!sb) return { disabled: true };
    const { error } = await sb.from('client_errors').insert(rows);
    return { error };
}

/**
 * 오류 전송 — 중복·상한·미설정 환경을 내부에서 처리. 절대 throw하지 않는다.
 * @param {Object} [deps] 테스트 주입용 { insert }
 * @returns {Promise<'sent'|'dup'|'capped'|'disabled'|'failed'>}
 */
export async function reportClientError(kind, err, meta = {}, deps = {}) {
    try {
        const key = kind + '|' + String((err && err.message) || err);
        if (_seen.has(key)) return 'dup';
        if (_sent >= MAX_PER_SESSION) return 'capped';
        _seen.add(key);

        const insert = deps.insert || defaultInsert;
        const res = await insert([buildErrorPayload(kind, err, meta)]);
        if (res.disabled) return 'disabled';
        if (res.error) return 'failed';
        _sent++;
        return 'sent';
    } catch {
        return 'failed';
    }
}

/**
 * window 오류 리스너 설치 — initApp 초기에 1회 호출. 중복 호출은 무시.
 * @param {Window|null} [win] 테스트 주입용
 */
export function initErrorTelemetry(win = (typeof window !== 'undefined' ? window : null)) {
    if (_installed || !win || typeof win.addEventListener !== 'function') return;
    _installed = true;
    win.addEventListener('error', (event) => {
        // 모듈/스크립트 로드 실패(error 없이 filename만)는 app-fallback이 담당 — 여기선 런타임 오류만
        if (!event.error) return;
        void reportClientError('error', event.error, {
            filename: event.filename, lineno: event.lineno,
        });
    });
    win.addEventListener('unhandledrejection', (event) => {
        if (!event.reason) return;
        void reportClientError('unhandledrejection', event.reason, {});
    });
}

/** 테스트용 — 내부 카운터 리셋 */
export function _resetTelemetryForTest() {
    _seen.clear(); _sent = 0; _installed = false;
}
