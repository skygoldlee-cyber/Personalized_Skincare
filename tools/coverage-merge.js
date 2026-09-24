// tools/coverage-merge.js — 유닛(node:test + c8)과 DOM(vitest) 커버리지 병합
//
// 배경: 유닛 테스트는 node:test, DOM 테스트는 vitest로 따로 실행돼
// 커버리지가 두 리포트로 갈린다. 각각 coverage-final.json(istanbul 형식)을
// 생성하고 이 스크립트가 하나로 합쳐 실질 커버리지를 출력한다.
//
// 사용:
//   npm run coverage        → coverage/coverage-final.json (vitest)
//   npm run coverage:unit   → coverage-unit/coverage-final.json (c8)
//   node tools/coverage-merge.js  → 병합 요약 + coverage-merged/ 리포트
// (npm run coverage:all 로 일괄 실행 가능)

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const SummarizerFactory = require('istanbul-lib-report/lib/summarizer-factory');
const reports = require('istanbul-reports');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = [
    { name: 'DOM (vitest)', file: 'coverage/coverage-final.json' },
    { name: '유닛 (c8)', file: 'coverage-unit/coverage-final.json' },
];

const map = libCoverage.createCoverageMap();
let merged = 0;
for (const { name, file } of SOURCES) {
    const abs = join(ROOT, file);
    if (!existsSync(abs)) {
        console.warn(`⚠ ${name} 리포트 없음: ${file}`);
        continue;
    }
    map.merge(JSON.parse(readFileSync(abs, 'utf8')));
    merged++;
    console.log(`✓ ${name} 병합 완료`);
}
if (merged === 0) {
    console.error('병합할 커버리지가 없습니다. npm run coverage / npm run coverage:unit을 먼저 실행하세요.');
    process.exit(1);
}

const context = libReport.createContext({
    dir: join(ROOT, 'coverage-merged'),
    coverageMap: map,
});
const tree = new SummarizerFactory(map).pkg;
tree.visit(reports.create('text'), context);
tree.visit(reports.create('html'), context);
console.log('\n📊 병합 HTML 리포트: coverage-merged/index.html');
