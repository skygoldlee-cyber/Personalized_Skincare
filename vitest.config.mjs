import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // DOM 테스트는 jsdom 환경에서 실행
        environment: 'jsdom',
        include: ['tests/dom/**/*.test.js'],
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json'],
            include: ['src/**/*.js'],
            exclude: [
                'src/supabase-config.js', // 상수 선언만 — 측정 대상 아님
                // jsdom으로 테스트 불가한 환경 의존 모듈 — 분모에서 제외
                'src/types.js',               // JSDoc typedef 선언 전용 (런타임 코드 없음)
                'src/app-fallback.js',        // ESM 로드 실패 복구 부트스트랩 (window.onerror)
                'src/pwa-install.js',         // beforeinstallprompt 브라우저 이벤트
                'src/pwa-install-capture.js', // 모듈 로드 즉시 beforeinstallprompt 캡처
                'src/pwa-manifest.js',        // 매니페스트 링크 교체 (로드 즉시 실행)
                'src/theme-init.js',          // DOM 이전 즉시 실행 스크립트
                'src/web-vitals.js',          // PerformanceObserver
                'src/views/reader-audio.js',  // Audio API
            ],
        },
    },
});
