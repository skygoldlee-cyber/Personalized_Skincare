import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // DOM 테스트는 jsdom 환경에서 실행
        environment: 'jsdom',
        include: ['tests/dom/**/*.test.js'],
        globals: true,
    },
});
