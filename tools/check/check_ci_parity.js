#!/usr/bin/env node
/**
 * check_ci_parity.js — .github/workflows/ci.yml ↔ package.json check:ci 정합성
 *
 * AGENTS.md는 "check:ci = CI 게이트 로컬 재현"을 약속한다. 이 검사는 두 축이
 * 서로 드리프트하지 않는지 양방향으로 대조한다:
 *   - ci.yml의 모든 검증 명령이 check:ci 체인에 있거나 CI_ONLY 명단에 있는가
 *   - check:ci의 모든 명령이 ci.yml에 있거나 LOCAL_ONLY 명단에 있는가
 *
 * 신규 게이트 추가 시 어느 한쪽에만 넣으면 여기서 차단된다 — 의도된 비대칭은
 * 아래 명단에 사유를 달아 명시한다.
 *
 * 사용법:
 *   npm.cmd run check:ciparity   # 단독 실행
 */

// @spec none (CI 정합 검증)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const PKG = path.join(ROOT, 'package.json');

// CI에만 있는 단계 — 환경 설치·아티팩트·CI 전용 수집 (로컬 재현 불필요)
const CI_ONLY = new Set([
  'npm ci',                          // 의존성 설치
  'npm audit',                       // 취약점 감사 (네트워크 필요)
  'npm run sbom',                    // SBOM 아티팩트 생성
  'npm run coverage',                // 커버리지 수집은 CI 아티팩트
  'npm run coverage:unit',
  'coverage_merge.js',               // 병합 커버리지 게이트
  'npx playwright',                  // 브라우저 설치 (playwright install --with-deps)
  'npm run test:e2e',                // E2E는 CI 전용 계층
  'impact_tests.js',                 // PR 영향 리포트 (정보성)
]);

// 로컬에만 있는 단계 — CI에서 의미 없는 로컬 환경 검증
const LOCAL_ONLY = new Set([
  'check:hooks',                     // 훅 설치 여부 — 로컬 전용
]);

/** 명령 문자열 → 비교 토큰 (npm run X → X 유지, node tools/… → 경로 유지) */
function tokenize(cmd) {
  const tokens = [];
  for (const seg of cmd.split('&&')) {
    const s = seg.trim();
    let m = s.match(/^npm(?:\.cmd)?\s+(?:run\s+)?([a-zA-Z][\w:-]*)/);
    if (m) { tokens.push(m[1] === 'test' ? 'npm test' : (s.includes(' run ') ? `npm run ${m[1]}` : `npm ${m[1]}`)); continue; }
    m = s.match(/^node\s+([\w./\\-]+\.js)/);
    if (m) { tokens.push(m[1].replace(/\\/g, '/').split('/').pop()); continue; }
    m = s.match(/^npx(?:\.cmd)?\s+([\w./@-]+)/);
    if (m) { tokens.push(`npx ${m[1]}`); continue; }
    if (s) tokens.push(s.split(/\s+/)[0]);
  }
  return tokens;
}

const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
const chain = pkg.scripts['check:ci'];
if (!chain) { console.log('✗ package.json에 check:ci 스크립트가 없습니다'); process.exit(1); }
const localCmds = new Set(tokenize(chain).map((t) => (t.startsWith('npm run ') ? t : t)));

const ciText = fs.readFileSync(WORKFLOW, 'utf8');
const ciCmds = new Set();
for (const m of ciText.matchAll(/^\s+run:\s*(.+)$/gm)) {
  for (const t of tokenize(m[1])) ciCmds.add(t);
}

const issues = [];
// ① CI 명령이 check:ci에도 있거나 CI_ONLY 명단에 있어야 함
for (const c of ciCmds) {
  if (!localCmds.has(c) && !CI_ONLY.has(c)) {
    issues.push(`ci.yml에만 있는 명령: "${c}" — check:ci에 편입하거나 CI_ONLY에 사유를 달아 등록`);
  }
}
// ② check:ci 명령이 ci.yml에도 있거나 LOCAL_ONLY 명단에 있어야 함
for (const c of localCmds) {
  if (!ciCmds.has(c) && !LOCAL_ONLY.has(c.replace(/^npm run /, '')) && !LOCAL_ONLY.has(c)) {
    issues.push(`check:ci에만 있는 명령: "${c}" — ci.yml에 추가하거나 LOCAL_ONLY에 사유를 달아 등록`);
  }
}

if (!issues.length) {
  console.log(`✅ CI 정합 — ci.yml ${ciCmds.size}개 명령 ↔ check:ci ${localCmds.size}개 (CI 전용 ${CI_ONLY.size}·로컬 전용 ${LOCAL_ONLY.size} 명시)`);
  process.exit(0);
}
console.log(`⚠ CI 정합 불일치 ${issues.length}건:\n`);
for (const i of issues) console.log(`  ✗ ${i}`);
process.exit(1);
