// src/utils.js - ìì¡´ì± ìë ë²ì© í¬í¼ ëª¨ë (ê¸ë¡ë² ì¤ì½í ì¤í)
//
// v2 ë¦¬ë·° ê¶ê³  #4: ê²ìì© íê¸ ì´ì± ì¶ì¶ í¬í¼ë¥¼ ì°¨í¸ ëª¨ë(charts.js)ìì
// ì±ê²©ì ë§ê² ë²ì© ì í¸ë¡ ì´ë. app.jsë³´ë¤ ë¨¼ì  ë¡ëëì´ì¼ í©ëë¤.

function getChosung(str) {
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
