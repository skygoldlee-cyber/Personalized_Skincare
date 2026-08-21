// src/sanitize.js — XSS 방어 유틸리티 모듈 (글로벌 스코프 실행)
//
// v2 리뷰 권고 #3 (XSS 잠재 경로 — innerHTML 직접 주입) 대응.
// 학습 데이터를 innerHTML로 주입하기 전에 HTML 특수문자를 이스케이프하여
// 외부/비신뢰 데이터가 유입되더라도 스크립트/마크업 인젝션이 발생하지 않도록 합니다.
//
// 의존성 없음(dependency-free). 어떤 스크립트보다도 먼저 로드되어야 합니다.

/* =======================================================
   🛡️ HTML 이스케이프 & 안전 주입 헬퍼
   ======================================================= */

// HTML 특수문자 → 안전한 엔티티 매핑.
// 엔티티 리터럴을 소스에 직접 적으면 편집/저장 과정에서 디코딩될 수 있으므로
// String.fromCharCode로 생성합니다. (결과는 동일: & < > " ')
const HTML_ESCAPE_MAP = {
    '&': '&' + 'amp;',
    '<': '&' + 'lt;',
    '>': '&' + 'gt;',
    '"': '&' + 'quot;',
    "'": '&' + '#39;'
};

/**
 * 문자열 내 HTML 특수문자를 이스케이프합니다.
 * textContent에 준하는 안전성을 제공하면서, 이후 의도된 태그(<br> 등)만
 * 개발자가 명시적으로 붙일 수 있도록 합니다.
 *
 * @param {*} value 이스케이프할 값 (문자열이 아니면 문자열로 변환)
 * @returns {string} 이스케이프된 안전한 문자열
 */
function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, function (ch) {
        return HTML_ESCAPE_MAP[ch];
    });
}

/**
 * 데이터를 이스케이프한 뒤 개행 문자(\n)만 <br>로 변환합니다.
 * 기존 `data.replace(/\n/g, '<br>')` 패턴의 안전한 대체재입니다.
 *
 * @param {*} value 원본 데이터
 * @returns {string} innerHTML에 안전하게 주입 가능한 문자열
 */
function safeTextWithBreaks(value) {
    return escapeHTML(value).replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * 템플릿 리터럴 내에서 데이터 조각을 이스케이프하기 위한 짧은 별칭.
 * 사용 예: el.innerHTML = `<span>${esc(card.term)}</span>`;
 *
 * @param {*} value 이스케이프할 값
 * @returns {string} 이스케이프된 문자열
 */
function esc(value) {
    return escapeHTML(value);
}
