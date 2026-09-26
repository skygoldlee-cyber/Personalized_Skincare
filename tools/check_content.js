#!/usr/bin/env node
/**
 * check_content.js — 콘텐츠 변경(교재 교체 등) 후 의존성 통합 검증
 *
 * 흩어진 검증 도구를 의존 계층 순서대로 실행하고 한 장짜리 리포트를 출력한다.
 * 모든 단계를 실행한 뒤 결과를 모아서 보고하므로, 한 번 실행으로 전체 실패 지점을 파악할 수 있다.
 *
 * 사용법:
 *   npm.cmd run check:content            # 검증만 (읽기 전용 단계)
 *   npm.cmd run check:content -- --build # build:data 선실행 후 검증 (교재 교체 시 권장)
 *   npm.cmd run check:content -- --quick # DOM 테스트 생략 (빠른 확인)
 *
 * 종료코드: 실패 단계가 있으면 1
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const WITH_BUILD = args.includes('--build');
const QUICK = args.includes('--quick');

// [명령, 인자, 셸 필요 여부]
const STEPS = [
  ...(WITH_BUILD ? [[
    'npm.cmd', ['run', 'build:data'], true,
    '빌드', 'build:data — data/ 번들 전체 재생성 (+인용 라인 동기화)'
  ]] : []),
  ['node', ['tools/check_manifest.js'], false,
    '선언', 'manifest 선언 ↔ 파일/과목 자산 정합성'],
  ['node', ['tools/sync_citation_lines.js', '--check'], false,
    '인용', '문제은행 → 교재 #L라인번호 인용 동기화 상태'],
  ['node', ['tools/check_ref_subjects.js'], false,
    '귀속', 'ref_md 문서의 과목 귀속 vs 실제 인용 득표 (정보 단계 — 불일치는 참고 보고)'],
  ['node', ['tools/check_reflayout.js'], false,
    '레이아웃', '참조자료 폴더/레지스트리 정합성'],
  ['node', ['tools/check_ref_freshness.js'], false,
    '신선도', '참조자료 PDF 해시 ↔ ref_md 변환본 (PDF 교체 감지)'],
  ['node', ['tools/check_ref_lines.js'], false,
    '참조라인', '교재/문제은행 (LNN) 참조 라인 ↔ ref_md 실제 내용'],
  ['node', ['tools/check_drill_freshness.js'], false,
    '드릴신선도', '드릴 번들 ↔ 문제은행 번들 (build:drills 필요 감지)'],
  ['node', ['tools/check_combo_pilot.js'], false,
    '드릴', '복수정답형(combo) 드릴 데이터 정합성'],
  ['node', ['tools/check_parser_parity.js'], false,
    '파서', '빌드 파서 ↔ 런타임 파서 출력 등가성'],
  ['node', ['tools/check_imports.js'], false,
    '임포트', 'src/ ES 모듈 import/export 교차 검증'],
  ['node', ['tools/verify_shell_assets.js'], false,
    '자산', 'sw.js SHELL_ASSETS/DATA_ASSETS 파일 존재'],
  ['node', ['tools/audit_card_quality.js'], false,
    '카드', '카드 품질 감사 (짧은 설명·중복·참조 링크)'],
  ['node', ['tools/check_docs_paths.js'], false,
    '문서', 'README·AGENTS·docs/*.md 경로 참조 존재 검증 (스테일 탐지)'],
  ['node', ['--test', 'tests/unit/*.test.js'], false,
    '테스트', '유닛 테스트 (node --test)'],
  ...(QUICK ? [] : [[
    'node', ['node_modules/vitest/vitest.mjs', 'run'], false,
    '테스트', 'DOM 테스트 (vitest + jsdom)'
  ]]),
];

const results = [];
console.log('═'.repeat(60));
console.log(' 콘텐츠 의존성 통합 검증' + (WITH_BUILD ? ' (build:data 선실행)' : '') + (QUICK ? ' [quick]' : ''));
console.log('═'.repeat(60));

for (const [cmd, cmdArgs, shell, layer, desc] of STEPS) {
  const label = `[${layer}] ${desc}`;
  process.stdout.write(`\n▶ ${label}\n`);
  const r = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    shell,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ok = r.status === 0;
  results.push({ label, ok, output: (r.stdout || '') + (r.stderr || '') });
  console.log(ok ? `  ✅ 통과` : `  ❌ 실패 (exit ${r.status})`);
}

console.log('\n' + '═'.repeat(60));
console.log(' 검증 리포트');
console.log('═'.repeat(60));

const failed = results.filter(r => !r.ok);
for (const r of results) {
  console.log(` ${r.ok ? '✅' : '❌'} ${r.label}`);
  // 귀속 단계는 정보 보고: 불일치 건수를 별도 표시 (교재 교체 후 증가하면 재검토)
  if (r.label.startsWith('[귀속]')) {
    const m = r.output.match(/불일치 (\d+)건/);
    if (m) console.log(`    ℹ 규칙↔인용 불일치 ${m[1]}건 — 상세: node tools/check_ref_subjects.js`);
  }
}

if (!failed.length) {
  console.log('\n🎉 전 단계 통과 — 콘텐츠 의존성 정상입니다.');
  process.exit(0);
}

console.log(`\n⚠ 실패 ${failed.length}건 — 실패 단계의 출력 끝부분:\n`);
for (const r of failed) {
  const tail = r.output.trim().split('\n').slice(-15).join('\n');
  console.log(`─ ${r.label} ${'─'.repeat(40)}\n${tail}\n`);
}
process.exit(1);
