// src/utils.js - 의존성 없는 범용 헬퍼 모듈 (글로벌 스코프 실행)
// @spec F-05,Q-05,T-02
//
// v2 리뷰 권고 #4: 검색용 한글 초성 추출 헬퍼를 차트 모듈(charts.js)에서
// 성격에 맞게 범용 유틸로 이동. app.js보다 먼저 로드되어야 합니다.

export function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 로컬 날짜를 'YYYY-MM-DD' 키로 반환 — 저장소 날짜 버킷의 표준 형식.
 * toISOString().slice(0,10)은 UTC라 KST 00~09시에 하루 전으로
 * 버킷되는 오류가 있으므로 로컬 성분으로 조립한다.
 */
export function localDateKey(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 오늘 날짜를 'YYYY-MM-DD' 키로 반환 (진도/스트릭/백업 파일명 공용) */
export function todayKey(date) {
    return localDateKey(date || new Date());
}

/** 정규식 특수문자 이스케이프 — 동적 RegExp 생성 시 필수 */
export function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 디바운스 — 마지막 호출 후 delay(ms) 경과 시 1회 실행. .cancel()로 대기 취소 */
export function debounce(func, delay = 150) {
    let timer;
    const wrapped = function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
    wrapped.cancel = () => clearTimeout(timer);
    return wrapped;
}

/** 초 → 'mm:ss' 고정폭 (타이머 표시용 — 분은 항상 2자리, 60분 초과도 누적) */
export function fmtMMSS(sec) {
    const s = Math.floor(Number(sec));
    if (!isFinite(s) || s < 0) return '00:00';
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

/** 초 → 'm:ss' (1시간 이상 'h:mm:ss') — 오디오·재생 위치 표시용 */
export function fmtClock(sec) {
    const s = Math.floor(Number(sec));
    if (!isFinite(s) || s < 0) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function getChosung(str) {
    const chosungs = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i) - 44032;
        // 유효한 완성형 한글 음절 범위: 0 ~ 11171 (가 ~ 힣)
        if (code >= 0 && code <= 11171) {
            result += chosungs[Math.floor(code / 588)];
        } else {
            result += str.charAt(i);
        }
    }
    return result;
}

/**
 * 지식DB 엔티티 이름 정규화 — 공식 DB ↔ 자가 등록 충돌 비교용 (DI-08).
 * 대소문자·공백 차이를 무시한다 (괄호 내용은 유지 — "살리실산(베타)"와 "살리실산"은 별개 원료).
 * @param {*} name
 * @returns {string}
 */
export function normalizeEntityName(name) {
    return typeof name === 'string' ? name.trim().toLowerCase().replace(/\s+/g, '') : '';
}
