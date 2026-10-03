// stryker.conf.mjs — 변이 테스트 (mutation testing) 설정
// 대상: 순수 핵심 로직만 — 전체 src 대상은 실행 시간이 비대하므로 스코프 한정.
// 수동 스팟 체크용 (npm run mutate) — CI 게이트 아님.
//   명령 러너는 변이체당 아래 command를 실행해 exit code로 생존을 판정한다.
//   대상 파일을 넓힐 때는 command에 해당 테스트 파일을 함께 추가할 것.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    'src/questions.js',
    'src/spaced-repetition.js',
    'src/weak-items.js',
    'src/statement-tracker.js',
  ],
  testRunner: 'command',
  commandRunner: {
    command: 'node --test tests/unit/questions.test.js tests/unit/property-based.test.js tests/unit/statement-tracker.test.js',
  },
  coverageAnalysis: 'off',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/mutation-report.html' },
  concurrency: 4,
  timeoutMS: 30000,
  // break 미설정 — 점수는 참고 지표. 직관적 생존자는 리포트로 검토.
  thresholds: { high: 80, low: 50 },
};
