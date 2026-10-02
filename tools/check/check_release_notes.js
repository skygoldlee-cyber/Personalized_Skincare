#!/usr/bin/env node
/**
 * check_release_notes.js — data/release-notes.json ↔ git 이력·버전 스탬프 정합성
 *
 * 사용자에게 보이는 변경 이력이 실제 배포 이력과 어긋나지 않는지 검증한다:
 *   - JSON 파싱 + 스키마 (version `vYYYYMMDD-<7hex>`, date ISO, notes 비어있지 않음)
 *   - 각 스탬프 버전의 해시 접미사가 실제 커밋으로 해석되는가 (git cat-file)
 *   - 최신 스탬프 항목의 version === data/version.js의 APP_VERSION
 *   - pending 초안 항목은 최대 1개 (stamp_release_notes.js 계약)
 *
 * 사용법:
 *   npm.cmd run check:notes          # 단독 실행
 *   npm.cmd run check:docs           # 연쇄 실행 (본 검사 포함)
 */

// @spec none (릴리스 노트 정합 검증)
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const NOTES = path.join(ROOT, 'data', 'release-notes.json');
const VERSION_JS = path.join(ROOT, 'data', 'version.js');

const issues = [];

let entries;
try {
  entries = JSON.parse(fs.readFileSync(NOTES, 'utf8'));
} catch (e) {
  console.log(`✗ release-notes.json 파싱 실패 — ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(entries)) {
  console.log('✗ release-notes.json은 배열이어야 합니다');
  process.exit(1);
}

const pendingCount = entries.filter((e) => e.pending === true).length;
if (pendingCount > 1) issues.push(`pending 항목 ${pendingCount}개 — 최대 1개만 허용`);

const seen = new Set();
const stamped = [];
for (const [i, e] of entries.entries()) {
  const tag = `entries[${i}]`;
  if (!e || typeof e !== 'object') { issues.push(`${tag} — 객체가 아님`); continue; }
  if (e.pending === true) {
    if (!Array.isArray(e.notes) || !e.notes.length) issues.push(`${tag} — pending 항목에 notes 없음`);
    continue;
  }
  if (!/^v\d{8}-[0-9a-f]{7}$/.test(e.version || '')) issues.push(`${tag} — version 형식 오류: "${e.version}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) issues.push(`${tag} — date 형식 오류: "${e.date}"`);
  if (!Array.isArray(e.notes) || !e.notes.every((n) => typeof n === 'string' && n.trim())) {
    issues.push(`${tag} — notes는 비어있지 않은 문자열 배열이어야 함`);
  }
  if (seen.has(e.version)) issues.push(`${tag} — version 중복: ${e.version}`);
  seen.add(e.version);
  stamped.push(e);
}

// 버전 해시 → 실제 커밋 해석 (spawnSync — cmd의 `^` 이스케이프 회피)
for (const e of stamped) {
  const hash = e.version.split('-').pop();
  const r = spawnSync('git', ['cat-file', '-e', `${hash}^{commit}`], { cwd: ROOT, stdio: 'pipe' });
  if (r.status !== 0) {
    issues.push(`${e.version} — 해시 ${hash}가 실제 커밋으로 해석되지 않음`);
  }
}

// 최신 스탬프 항목 ↔ APP_VERSION 일치 (노트와 배포 버전의 괴리 탐지)
try {
  const m = fs.readFileSync(VERSION_JS, 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/);
  if (m && stamped.length && stamped[0].version !== m[1]) {
    issues.push(`최신 노트 버전 ${stamped[0].version} ≠ APP_VERSION ${m[1]} — 배포 스탬프와 노트가 어긋남`);
  }
} catch { /* version.js 없으면 스킵 */ }

if (!issues.length) {
  console.log(`✅ 릴리스 노트 정합 — 항목 ${entries.length}개 (pending ${pendingCount}), 전 버전 커밋 해석됨`);
  process.exit(0);
}

console.log(`⚠ 릴리스 노트 불일치 ${issues.length}건:\n`);
for (const i of issues) console.log(`  ✗ ${i}`);
process.exit(1);
