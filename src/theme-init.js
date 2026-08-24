// src/theme-init.js - 페인트 전에 테마 클래스를 적용하여 깜빡임(FOUC) 방지
(function () {
    try {
        var saved = localStorage.getItem('appTheme');
        var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        var theme = saved || (prefersLight ? 'light' : 'dark');
        document.documentElement.classList.toggle('light-theme', theme === 'light');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f7fa' : '#0b0f19');
    } catch (e) {}
})();
