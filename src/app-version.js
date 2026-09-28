// src/app-version.js — 앱 버전 접근 + 표시 포맷터
// @spec P-13
// ------------------------------------------------------------
// window.APP_VERSION(data/version.js)는 빌드 스탬프로 찍히는 기계 ID다
// (v<YYYYMMDD>-<gitShort> — stamp_sw_version.js). 사용자에게 보이는
// 곳에서는 formatAppVersion()으로 읽기 쉬운 형태로 변환한다:
//   v20261016-fd06122      → v2026.10.16 · fd06122
//   v369-20260928-fd06122  → v2026.09.28 · fd06122   (구 채널 프리픽스 자동 제거)
// 비교·저장·페이로드에는 원본 문자열을 그대로 쓴다(표시만 변환).
// ------------------------------------------------------------

/** 배포 스탬프 원본 버전 (없으면 null) */
export function appVersion() {
    return (typeof window !== 'undefined' && window.APP_VERSION) || null;
}

/**
 * 기계 버전 → 표시용 문자열.
 * 신형식 `v20261016-fd06122`와 구형식 `v369-20260928-fd06122` 모두 처리.
 * 형식이 맞지 않으면 원본을 그대로 반환.
 * @param {string | null | undefined} v
 * @returns {string}
 */
export function formatAppVersion(v) {
    const m = /^v?\d*-?(\d{4})(\d{2})(\d{2})-([0-9a-f]+)$/i.exec(v || '');
    if (!m) return v || '';
    return `v${m[1]}.${m[2]}.${m[3]} · ${m[4]}`;
}
