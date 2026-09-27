// src/theme-init.js - 페인트 전에 테마 클래스를 적용하여 깜빡임(FOUC) 방지
// @spec TH-02,TH-03
// 참고: 이 파일은 ES module이 아닌 classic 스크립트로 로드되므로 storage-keys.js를 import할 수 없음.
// 'appTheme' 키는 STORAGE_KEYS.APP_THEME (src/storage-keys.js)과 반드시 동기화해야 함.
(function () {
    try {
        const saved = localStorage.getItem('appTheme');
        const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        const theme = saved || (prefersLight ? 'light' : 'dark');
        document.documentElement.classList.toggle('light-theme', theme === 'light');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'light' ? '#dde3ec' : '#0b0f19');
    } catch (e) {}
})();
