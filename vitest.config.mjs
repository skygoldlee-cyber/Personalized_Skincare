import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // DOM 테스트는 jsdom 환경에서 실행
        environment: 'jsdom',
        include: ['tests/dom/**/*.test.js'],
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.js'],
            exclude: [
                'src/supabase-config.js', // 상수 선언만 — 측정 대상 아님
            ],
        },
    },
});
