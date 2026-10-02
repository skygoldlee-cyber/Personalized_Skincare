#!/usr/bin/env node
/**
 * check_feature_flags.js — exams.json features 플래그 ↔ 코드 사용 정합성 (도메인 축)
 *
 * 시험별 도메인 기능 플래그(content/exams.json의 exams[].features)와 실제
 * 소비처를 양방향 검증한다. 소비 패턴 세 가지:
 *   - hasFeature('k')             — src/
 *   - features.k / features?.k    — src/ (직접 접근)
 *   - data-feature="k"            — html/·index.template.html (applyFeatureFlags)
 *
 * 규칙:
 *   - 사용 키가 어떤 시험의 features에도 미선언 → 오류 (영구 falsy 죽은 경로 —
 *     story_textbook이 exams.json 미선언으로 서사 검색 인덱스가 프로덕션에서
 *     침묵적으로 비활성됐던 사례)
 *   - 선언됐으나 사용처 없음 → 경고 (프로비저닝 허용)
 *   - 예외 키: examSwitch — app-shell.js에서 features가 아닌 시험 수로 동적 판정
 *
 * 사용법:
 *   npm.cmd run check:featflags   # 단독 실행
 */

// @spec none (인프라 검증)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EXAMS = path.join(ROOT, 'content', 'exams.json');
const CODE_DIRS = ['src', 'html'];
const CODE_FILES = ['index.template.html'];

// features 플래그가 아닌 동적 판정 키 (app-shell.js applyFeatureFlags 참조)
const DYNAMIC_KEYS = new Set(['examSwitch']);

const exams = JSON.parse(fs.readFileSync(EXAMS, 'utf8')).exams || [];
const declared = new Set();
for (const exam of exams) for (const k of Object.keys(exam.features || {})) declared.add(k);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|html)$/.test(e.name)) yield p;
  }
}

const USE_RE = /hasFeature\(\s*['"]([\w-]+)['"]|features\??\.([A-Za-z_]\w*)|data-feature=["']([\w-]+)["']/g;
const used = new Map(); // key → files
const files = [
  ...CODE_FILES.map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f)),
  ...CODE_DIRS.flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? [...walk(path.join(ROOT, d))] : [])),
];
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const m of fs.readFileSync(file, 'utf8').matchAll(USE_RE)) {
    const key = m[1] || m[2] || m[3];
    if (key === 'hasOwnProperty') continue;
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(rel);
  }
}

const issues = [];
const warnings = [];

// ① 사용 키는 최소 한 시험의 features에 선언 필수
for (const [key, locs] of used) {
  if (!declared.has(key) && !DYNAMIC_KEYS.has(key)) {
    issues.push(`어떤 시험의 features에도 미선언 키를 코드가 참조: "${key}" (${locs[0]}${locs.length > 1 ? ` 외 ${locs.length - 1}곳` : ''}) — 영구 falsy 죽은 경로. exams.json에 선언하거나 호출을 제거하세요`);
  }
}

// ② 선언됐으나 사용처 없음 → 경고
for (const key of declared) {
  if (!used.has(key)) warnings.push(`features 선언됐으나 코드 미사용: "${key}"`);
}

for (const w of warnings) console.log(`  ⚠ ${w}`);
if (!issues.length) {
  console.log(`✅ 기능 플래그 정합 — 선언 ${declared.size}개 ↔ 코드 사용 ${used.size}개 (동적 키 ${DYNAMIC_KEYS.size}개 제외)`);
  process.exit(0);
}

console.log(`\n⚠ 기능 플래그 불일치 ${issues.length}건:\n`);
for (const i of issues) console.log(`  ✗ ${i}`);
process.exit(1);
