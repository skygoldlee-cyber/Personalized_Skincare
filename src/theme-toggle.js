// src/theme-toggle.js — 테마 토글 로직 (app.js에서 추출)
import { STORAGE_KEYS } from './storage-keys.js';

/**
 * 헤더/모바일 테마 토글 버튼을 초기화하고 전역 테마 API를 노출합니다.
 */
export function setupThemeToggle() {
    var root = document.documentElement;
    var meta = document.querySelector('meta[name="theme-color"]');
    function isLight() { return root.classList.contains('light-theme'); }
    function apply(light) {
        root.classList.toggle('light-theme', light);
        if (meta) meta.setAttribute('content', light ? '#dde3ec' : '#0b0f19');
        try { localStorage.setItem(STORAGE_KEYS.APP_THEME, light ? 'light' : 'dark'); } catch (e) {}
        // 리더 등 다른 모듈이 동일한 테마 상태를 공유하도록 이벤트 브로드캐스트
        document.dispatchEvent(new CustomEvent('themechange', { detail: { light: light } }));
    }
    function toggle() { apply(!isLight()); }
    // 전역 테마 API 노출 (단일 소스 오브 트루스)
    window.AppTheme = { isLight: isLight, apply: apply, toggle: toggle };

    var btn = document.getElementById('theme-toggle-btn');
    function syncHeaderBtn() {
        if (!btn) return;
        var i = btn.querySelector('i');
        if (i) i.className = isLight() ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        btn.title = isLight() ? '다크 모드로 전환' : '라이트 모드로 전환';
    }
    syncHeaderBtn();
    document.addEventListener('themechange', syncHeaderBtn);
    if (btn) btn.addEventListener('click', toggle);

    // 모바일 하단 탭 바의 테마 토글
    var mBtn = document.getElementById('mobile-theme-toggle');
    function syncMobileBtn() {
        if (!mBtn) return;
        var i = mBtn.querySelector('i');
        if (i) i.className = isLight() ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    syncMobileBtn();
    document.addEventListener('themechange', syncMobileBtn);
    if (mBtn) mBtn.addEventListener('click', toggle);

    // 사용자가 수동 선택하지 않았을 때만 시스템 테마 변경을 따라감
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: light)');
        var onChange = function (e) {
            var hasTheme;
            try { hasTheme = localStorage.getItem(STORAGE_KEYS.APP_THEME); } catch (_) { hasTheme = null; }
            if (hasTheme) return;
            apply(e.matches);
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }
}
