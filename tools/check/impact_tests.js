#!/usr/bin/env node
/**
 * impact_tests.js — 변경 파일의 영향 요구사항·권장 테스트 역산
 *
 * 변경된 파일 목록(git diff 또는 인자)을 받아, 각 파일의 @spec/관련 SPEC ID를
 * 읽어 영향받는 요구사항과 실행해야 할 테스트 파일을 역산한다.
 *
 * 사용법:
 *   node tools/check/impact_tests.js                      # 미커밋 변경(워크트리+스테이징) 자동 분석
 *   node tools/check/impact_tests.js src/views/dashboard.js css/dashboard.css
 *   node tools/check/impact_tests.js --ref origin/main    # 특정 ref 대비 diff 분석
 *   node tools/check/impact_tests.js --ref origin/main --run  # 권장 테스트까지 실행 (pre-push 게이트)
 */

// @spec none (영향도 분석 도구)
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const T = require('../lib/trace_scan');

const REF_RE = /^(?!-)[A-Za-z0-9][A-Za-z0-9._~/-]*$/; // git ref 형식 — 플래그·셸 인젝션 차단 (^는 cmd 이스케이프 충돌로 제외, HEAD~N 지원)

function gitChanged(ref) {
  try {
    // -c core.quotepath=false — 비ASCII(한글) 경로의 옥탈 이스케이프·인용 방지
    if (ref) {
      if (!REF_RE.test(ref)) { console.error(`유효하지 않은 ref: ${ref}`); process.exit(2); }
      return execSync(`git -c core.quotepath=false diff --name-only ${ref}...HEAD`, { cwd: T.ROOT, encoding: 'utf8' })
        .split('\n').map(s => s.trim()).filter(Boolean);
    }
    const a = execSync('git -c core.quotepath=false diff --name-only', { cwd: T.ROOT, encoding: 'utf8' }).split('\n');
    const b = execSync('git -c core.quotepath=false diff --name-only --cached', { cwd: T.ROOT, encoding: 'utf8' }).split('\n');
    const c = execSync('git -c core.quotepath=false ls-files --others --exclude-standard', { cwd: T.ROOT, encoding: 'utf8' }).split('\n');
    return [...new Set([...a, ...b, ...c].map(s => s.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

/** 변경된 검증 도구 자체를 1회 실행 — @spec none이라 테스트 역산이 안 되는 메타 갭 보완 */
function runChangedCheckers(files) {
  const targets = files
    .filter((f) => /^tools\/check\/(check|audit|verify)_[\w-]+\.js$/.test(f))
    .map((f) => path.join(T.ROOT, f))
    .filter((f) => fs.existsSync(f));
  // 공용 파서 변경은 모든 소비 체커에 전파 — 대표 소비자로 실증
  if (files.includes('tools/lib/trace_scan.js')) {
    targets.push(path.join(T.ROOT, 'tools/check/check_spec_refs.js'));
  }
  if (!targets.length) return false;
  let failed = false;
  for (const t of targets) {
    console.log(`\n▶ 변경 체커 자기 검증: node ${path.relative(T.ROOT, t)}`);
    const r = spawnSync(process.execPath, [t], { cwd: T.ROOT, stdio: 'inherit' });
    if (r.status !== 0) failed = true;
  }
  return failed;
}

/** 권장 테스트 실제 실행 — unit은 node --test, dom은 vitest. 실패 시 exit 1 */
function runTests(testFiles) {
  const units = [...testFiles].filter((f) => f.includes('/unit/')).sort();
  const doms = [...testFiles].filter((f) => f.includes('/dom/')).sort();
  const other = [...testFiles].filter((f) => !units.includes(f) && !doms.includes(f));
  if (other.length) console.log(`  ※ 실행 미지정 테스트 유형 스킵: ${other.join(', ')}`);

  let failed = false;
  if (units.length) {
    console.log(`\n▶ unit 실행: node --test (${units.length}개)`);
    const r = spawnSync('node', ['--test', ...units], { cwd: T.ROOT, stdio: 'inherit' });
    if (r.status !== 0) failed = true;
  }
  if (doms.length) {
    // 셸 래퍼(npx.cmd) 대신 vitest 엔트리를 node로 직접 실행 — 인자 인젝션·DEP0190 회피
    const vitest = path.join(T.ROOT, 'node_modules', 'vitest', 'vitest.mjs');
    console.log(`\n▶ dom 실행: vitest run (${doms.length}개)`);
    const r = spawnSync(process.execPath, [vitest, 'run', ...doms], { cwd: T.ROOT, stdio: 'inherit' });
    if (r.status !== 0) failed = true;
  }
  return failed;
}

function main() {
  const args = process.argv.slice(2);
  const doRun = args.includes('--run');
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
    if (!doRun) {
      const doms = [...testFiles].filter(f => f.includes('/dom/'));
      const units = [...testFiles].filter(f => f.includes('/unit/'));
      console.log('\n실행 예시:');
      if (units.length) console.log(`  node --test ${units.join(' ')}`);
      if (doms.length) console.log(`  npx vitest run ${doms.map(f => f.replace('tests/dom/', '')).join(' ')}`);
    }
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

  if (doRun) {
    let failed = false;
    if (testFiles.size) {
      if (runTests(testFiles)) {
        console.log('\n✗ 영향 테스트 실패');
        failed = true;
      } else {
        console.log('\n✓ 영향 테스트 전부 통과');
      }
    } else {
      console.log('\n◇ 실행할 테스트 없음');
    }
    if (runChangedCheckers(files)) failed = true;
    process.exit(failed ? 1 : 0);
  }
}

main();
