#!/usr/bin/env node
/**
 * impact_tests.js — 변경 파일의 영향 요구사항·권장 테스트 역산
 *
 * 변경된 파일 목록(git diff 또는 인자)을 받아, 각 파일의 @spec/관련 SPEC ID를
 * 읽어 영향받는 요구사항과 실행해야 할 테스트 파일을 역산한다.
 *
 * 사용법:
 *   node tools/impact_tests.js                      # 미커밋 변경(워크트리+스테이징) 자동 분석
 *   node tools/impact_tests.js src/views/dashboard.js css/dashboard.css
 *   node tools/impact_tests.js --ref origin/main    # 특정 ref 대비 diff 분석
 */

// @spec none (영향도 분석 도구)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const T = require('./lib/trace_scan');

function gitChanged(ref) {
  try {
    if (ref) {
      return execSync(`git diff --name-only ${ref}...HEAD`, { cwd: T.ROOT, encoding: 'utf8' })
        .split('\n').map(s => s.trim()).filter(Boolean);
    }
    const a = execSync('git diff --name-only', { cwd: T.ROOT, encoding: 'utf8' }).split('\n');
    const b = execSync('git diff --name-only --cached', { cwd: T.ROOT, encoding: 'utf8' }).split('\n');
    const c = execSync('git ls-files --others --exclude-standard', { cwd: T.ROOT, encoding: 'utf8' }).split('\n');
    return [...new Set([...a, ...b, ...c].map(s => s.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  const refIdx = args.indexOf('--ref');
  const files = refIdx >= 0
    ? gitChanged(args[refIdx + 1])
    : (args.filter(a => !a.startsWith('--')).length
        ? args.filter(a => !a.startsWith('--'))
        : gitChanged(null));

  if (!files.length) {
    console.log('분석할 파일이 없습니다 — 인자로 파일을 지정하거나 변경을 만든 뒤 실행하세요.');
    process.exit(0);
  }

  const { specIds, tst, docs, reports } = T.scanAll();
  const impacted = new Map(); // specId → Set(변경 파일)
  const unscanned = [];
  for (const f of files) {
    const abs = path.join(T.ROOT, f);
    if (!fs.existsSync(abs)) { unscanned.push(f + ' (없음)'); continue; }
    const ids = T.idsInFile(abs, specIds);
    if (!ids.size) unscanned.push(f);
    for (const id of ids) {
      if (!impacted.has(id)) impacted.set(id, new Set());
      impacted.get(id).add(f);
    }
  }

  console.log('═'.repeat(60));
  console.log(' 영향도 분석 — TRACE MATRIX 기반');
  console.log('═'.repeat(60));
  console.log(`\n변경 파일 ${files.length}개 → 영향 요구사항 ${impacted.size}개`);

  if (impacted.size) {
    console.log('\n■ 영향 SPEC ID (변경 파일 → 요구사항):');
    for (const [id, fs2] of [...impacted].sort()) {
      const sec = specIds.get(id) || 'SPEC 미등록';
      console.log(`  ${id}  [${sec}]  ← ${[...fs2].join(', ')}`);
    }
  }

  // 권장 테스트: 영향 ID를 참조하는 tests/ 파일
  const testFiles = new Set();
  for (const id of impacted.keys()) for (const f of tst.get(id) || []) testFiles.add(f);
  console.log(`\n■ 권장 테스트 (${testFiles.size}개):`);
  if (testFiles.size) {
    for (const f of [...testFiles].sort()) console.log(`  ${f}`);
    const doms = [...testFiles].filter(f => f.includes('/dom/'));
    const units = [...testFiles].filter(f => f.includes('/unit/'));
    console.log('\n실행 예시:');
    if (units.length) console.log(`  node --test ${units.join(' ')}`);
    if (doms.length) console.log(`  npx vitest run ${doms.map(f => f.replace('tests/dom/', '')).join(' ')}`);
  } else {
    console.log('  — (영향 ID를 참조하는 테스트 없음)');
  }

  // 관련 문서·보고서
  const docIds = new Set(), rptIds = new Set();
  for (const id of impacted.keys()) {
    for (const d of docs.get(id) || []) docIds.add(d);
    for (const r of reports.get(id) || []) rptIds.add(r);
  }
  if (docIds.size) console.log(`\n■ 관련 문서: ${[...docIds].sort().join(', ')}`);
  if (rptIds.size) console.log(`■ 관련 보고서: ${[...rptIds].sort().join(', ')}`);
  if (unscanned.length) {
    console.log(`\n◇ 추적 태그 없는 변경 파일 ${unscanned.length}개 (영향 분석 불가):`);
    for (const f of unscanned.slice(0, 10)) console.log(`  ${f}`);
    if (unscanned.length > 10) console.log(`  …외 ${unscanned.length - 10}개`);
  }
}

main();
