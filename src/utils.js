// src/utils.js - 의존성 없는 범용 헬퍼 모듈 (글로벌 스코프 실행)
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
