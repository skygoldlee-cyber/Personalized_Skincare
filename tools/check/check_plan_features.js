#!/usr/bin/env node
/**
 * check_plan_features.js — feature-plan.json 키 ↔ 코드 사용 ↔ 로드맵 문서 정합성
 *
 * 무료/Pro 전환 설정(feature-plan.json)의 기능 키가 세 축에서 일치하는지 검사한다:
 *   - 코드 사용: isProFeature('k')·data-pro-feature="k"·proFeatureNotice('k')
 *     참조 키는 feature-plan.json에 선언돼 있어야 한다 (누락 시 기본값 pro에
 *     의존해 free 전환 레버가 사라짐 — 과거 audiobook 키 누락 사례)
 *   - 문서 동기: 선언된 키는 SUBSCRIPTION_ROADMAP.md의 Pro 대상 목록에 기재
 *   - 선언됐으나 코드에서 미사용인 키는 경고 (사전 프로비저닝 허용)
 *
 * 사용법:
 *   npm.cmd run check:plan   # 단독 실행
 */

// @spec ROAD-P0 (무료/Pro 전환 레버 정합)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PLAN = path.join(ROOT, 'feature-plan.json');
const ROADMAP = path.join(ROOT, 'docs', 'dev', 'design', 'SUBSCRIPTION_ROADMAP.md');
const CODE_DIRS = ['src', 'html'];
const CODE_FILES = ['index.html', 'index.template.html'];

const planKeys = Object.keys(JSON.parse(fs.readFileSync(PLAN, 'utf8')).features || {});

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|html)$/.test(e.name)) yield p;
  }
}

const USE_RE = /isProFeature\(\s*['"]([\w-]+)['"]|data-pro-feature=["']([\w-]+)["']|proFeatureNotice\(\s*['"]([\w-]+)['"]/g;
const used = new Map(); // key → files
const files = [
  ...CODE_FILES.map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f)),
  ...CODE_DIRS.flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? [...walk(path.join(ROOT, d))] : [])),
];
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const m of fs.readFileSync(file, 'utf8').matchAll(USE_RE)) {
    const key = m[1] || m[2] || m[3];
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(rel);
  }
}

const issues = [];
const warnings = [];

// ① 코드가 참조하는 키는 feature-plan.json에 선언 필수
for (const [key, locs] of used) {
  if (!planKeys.includes(key)) {
    issues.push(`feature-plan.json 미선언 키를 코드가 참조: "${key}" (${locs[0]} 외 ${locs.length - 1}곳)`);
  }
}

const roadmap = fs.readFileSync(ROADMAP, 'utf8');
for (const key of planKeys) {
  // ② 선언된 키는 로드맵 문서의 대상 목록에 기재
  if (!new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(roadmap)) {
    issues.push(`feature-plan.json 키가 로드맵 문서에 없음: "${key}" (docs/dev/design/SUBSCRIPTION_ROADMAP.md 대상 목록 갱신 필요)`);
  }
  // ③ 선언됐으나 코드 미사용 → 경고 (사전 프로비저닝 허용)
  if (!used.has(key)) warnings.push(`feature-plan.json 선언됐으나 코드 미사용: "${key}"`);
}

for (const w of warnings) console.log(`  ⚠ ${w}`);
if (!issues.length) {
  console.log(`✅ 플랜 기능 정합 — 키 ${planKeys.length}개 ↔ 코드 사용 ${used.size}개 ↔ 로드맵 일치`);
  process.exit(warnings.length ? 0 : 0);
}

console.log(`\n⚠ 플랜 기능 불일치 ${issues.length}건:\n`);
for (const i of issues) console.log(`  ✗ ${i}`);
process.exit(1);
