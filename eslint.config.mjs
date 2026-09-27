// eslint.config.mjs — Passmula 최소 린트 설정 (flat config)
// 목적: 정적 분석 공백 해소 — 실수성 버그 탐지 우선, 스타일 강제는 최소.
// 확장: 위반이 정리되면 warn → error 승격, 규칙 추가는 점진적으로.

// @spec none (정적 분석 설정)
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'vendor/**',
      'data/**',               // 빌드 생성물
      'tools/_archive/**',
      'ref-pipeline/**',       // Python 중심
      'coverage*/**',
      'docs/**',
      'tools/supabase/**',
    ],
  },
  {
    files: ['src/**/*.js', 'tools/**/*.js', 'tests/**/*.js', 'sw.js', 'serve.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
        // 앱 전역 — 클래식 스크립트·데이터 번들이 window에 노출
        EXAMS_LIST: 'readonly', STUDY_DATA: 'readonly', APP_VERSION: 'readonly',
        RELEASE_NOTES: 'readonly', __DOC_MD__: 'writable',
        // app.js·data-loader.js가 window에 노출하는 브리지 전역
        DataLoader: 'readonly', updateGlobalStats: 'readonly', checkShortAnswer: 'readonly',
      },
    },
    rules: {
      // 버그성 — error
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-constant-condition': 'error',
      'no-cond-assign': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-fallthrough': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      // 점진 정리 — warn (위반 정리 후 error 승격)
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'eqeqeq': 'warn',
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-console': 'off', // tools/ 스크립트는 console 사용이 정상
    },
  },
  {
    // 테스트 파일 — Vitest/node:test 글로벌
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly', it: 'readonly', test: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly', afterAll: 'readonly',
        expect: 'readonly', vi: 'readonly',
      },
    },
  },
];
