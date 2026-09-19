// tools/build_all_data.js — content/exams.json의 모든 시험에 대해
// tools/build/index.js를 EXAM_ID 환경변수와 함께 순차 실행한다.
//
// 각 시험은 자신의 contentRoot/dataRoot로 빌드된다:
//   - 기본 시험(cosmetic): content/ → data/
//   - 추가 시험: content/exams/<id>/ → data/exams/<id>/
//
// 사용: node tools/build_all_data.js  (npm run build:data 체인에 포함)
//       --only <keys> 인자는 각 시험 빌드에 그대로 전달된다.
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { getExamTargets } = require('./build/exam-targets');

const ROOT = path.resolve(__dirname, '..');
const passthrough = process.argv.slice(2); // --only 등

function main() {
  const targets = getExamTargets(ROOT);
  if (!targets.length) {
    console.error('content/exams.json에 등록된 시험이 없습니다.');
    process.exit(1);
  }

  for (const target of targets) {
    if (!target.manifest) {
      console.warn(`[build:all] ${target.id}: ${target.manifestPath} 없음 — 건너뜀`);
      continue;
    }
    console.log(`\n=== [build:all] 시험 "${target.id}" (${target.contentRoot} → ${target.dataRoot}) ===`);
    const res = spawnSync(
      process.execPath,
      [path.join(ROOT, 'tools', 'build', 'index.js'), ...passthrough],
      {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, EXAM_ID: target.id }
      }
    );
    if (res.status !== 0) {
      console.error(`[build:all] 시험 "${target.id}" 빌드 실패 (exit ${res.status})`);
      process.exit(res.status || 1);
    }
  }

  console.log('\n=== [build:all] 모든 시험 빌드 완료 ===');
}

main();
