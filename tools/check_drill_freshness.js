#!/usr/bin/env node
/**
 * check_drill_freshness.js — 드릴 번들 ↔ 문제은행 번들 신선도 검증
 *
 * {dataRoot}/drills/{ox,combo}_*.js 는 {dataRoot}/exams/subjectN.<hash>.js 에서
 * 자동 생성되는 2차 파생물이다. 문제은행이 재빌드되면 exams 번들 파일명의
 * 해시가 바뀌지만 드릴은 `npm run build:drills` 재실행 전까지 구버전을 유지한다.
 * 각 드릴 번들 헤더의 `// 원본: <path>`를 읽어 원본 파일 존재를 확인한다.
 *
 *   - 원본 번들 없음(해시 변경) → ERROR: build:drills 재실행 필요
 *   - exams 번들에 대응하는 드릴 없음 → WARN (문항 부재로 미생성일 수 있음)
 *   - 원본 헤더 없는 번들(combo_pilot.js 등 수작업) → 검사 제외
 *
 * 사용: node tools/check_drill_freshness.js   (불일치 시 exit 1)
 */
const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./build/exam_targets.js');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_RE = /^\/\/ 원본:\s*(\S+)/m;

const errors = [];
const warnings = [];

console.log('='.repeat(70));
console.log('드릴 번들 ↔ 문제은행 번들 신선도 검증');
console.log('='.repeat(70));

let scanned = 0;
for (const t of getExamTargets(ROOT)) {
  const drillsDir = path.join(ROOT, t.dataRoot, 'drills');
  const examsDir = path.join(ROOT, t.dataRoot, 'exams');
  if (!fs.existsSync(examsDir)) continue;
  scanned++;

  const examFiles = fs.readdirSync(examsDir).filter(f => f.endsWith('.js'));
  const drillFiles = fs.existsSync(drillsDir)
    ? fs.readdirSync(drillsDir).filter(f => f.endsWith('.js'))
    : [];

  let checked = 0;
  for (const f of drillFiles) {
    const src = fs.readFileSync(path.join(drillsDir, f), 'utf8');
    const m = src.match(SOURCE_RE);
    if (!m) continue; // 수작업/인덱스 번들은 원본 헤더 없음
    checked++;
    if (!fs.existsSync(path.join(ROOT, m[1]))) {
      errors.push(`[${t.id}] ${f}: 원본 번들 없음 → ${m[1]} — npm run build:drills 재실행 필요`);
    }
  }

  // exams 번들별 대응 드릴 존재 여부 (과목 키 = 파일명 첫 세그먼트)
  for (const ef of examFiles) {
    const key = ef.split('.')[0];
    for (const kind of ['ox', 'combo']) {
      if (!drillFiles.includes(`${kind}_${key}.js`)) {
        warnings.push(`[${t.id}] ${kind}_${key}.js 없음 — build:drills 미실행 또는 대상 문항 부재`);
      }
    }
  }
  console.log(`[${t.id}] 드릴 ${checked}개 검사 (exams ${examFiles.length}개)`);
}

if (!scanned) console.log('exams 번들을 가진 시험이 없습니다.');
if (warnings.length) {
  console.log('\n■ 경고');
  warnings.forEach(w => console.log('  ' + w));
}
if (errors.length) {
  console.log(`\n■ 오류 ${errors.length}건`);
  errors.forEach(e => console.log('  ' + e));
  process.exit(1);
}
console.log('\n✅ 드릴 번들이 최신 문제은행 번들과 일치합니다.');
