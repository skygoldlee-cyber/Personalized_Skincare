#!/usr/bin/env node
/**
 * check_storage_access.js — localStorage 직접 접근 탐지
 *
 * storage.js가 추상화 계층(scopedKey 네임스페이스·쓰기 훅·쿼터 감지 중앙화)이고
 * storage-keys.js가 키 SSOT다. 이들을 우회한 직접 localStorage 접근은
 * 네임스페이스·마이그레이션·쿼터 처리를 빠져나가므로 허용 모듈 외 금지.
 *
 * 허용 목록 (ALLOWED_FILES) — 각각 부트스트랩 시점 제약 또는 인프라 역할로
 * 추상화 계층 사용이 불가능한 경우에 한정:
 *   - src/storage.js              — 추상화 계층 본체
 *   - src/exam-context.js         — scopedKey·마이그레이션 스윕 자체가 인프라
 *   - src/theme-init.js           — 모듈 로드 전 FOUC 방지 부트 스크립트
 *   - src/pwa-manifest.js         — 클래식 스크립트(ESM 아님), 모듈 로딩 불가
 *   - src/pwa-install-capture.js  — 설치 프롬프트 캡처의 원샷 플래그
 *
 * 사용법:
 *   npm.cmd run check:storage   # 단독 실행
 */

// @spec none (인프라 검증)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

const ALLOWED_FILES = new Set([
  'storage.js',
  'exam-context.js',
  'theme-init.js',
  'pwa-manifest.js',
  'pwa-install-capture.js',
]);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

const issues = [];
let scanned = 0;
for (const file of walk(SRC)) {
  scanned++;
  const base = path.basename(file);
  if (ALLOWED_FILES.has(base)) continue;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/localStorage\.\w/.test(line)) {
      issues.push(`${rel}:${i + 1} — localStorage 직접 접근 (storage.js 경유 필요)`);
    }
  });
}

if (!issues.length) {
  console.log(`✅ 저장소 접근 정합 — src/ ${scanned}개 파일, 직접 접근 없음 (허용 ${ALLOWED_FILES.size}개 모듈)`);
  process.exit(0);
}

console.log(`\n⚠ localStorage 직접 접근 ${issues.length}건:\n`);
for (const i of issues) console.log(`  ✗ ${i}`);
console.log('\n부트스트랩 제약 등으로 불가피하면 ALLOWED_FILES에 사유 주석과 함께 등록하세요.');
process.exit(1);
