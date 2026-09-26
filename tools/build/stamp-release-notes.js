#!/usr/bin/env node
/* ============================================================
 * tools/build/stamp-release-notes.js
 * ------------------------------------------------------------
 * 배포 시 앱 버전 번들(data/version.js)과 사용자용 변경 이력을 갱신한다.
 *
 * 데이터 소스: data/release-notes.json  (사람이 편집하는 진실 소스)
 * 생성 산출물: data/release-notes.js    (window.RELEASE_NOTES 래퍼 — 직접 편집 금지)
 *
 * 역할:
 *   1) data/version.js 의 window.APP_VERSION 을 배포 버전으로 치환
 *      (sw.js CACHE_VERSION과 동일 값 — stamp-sw-version.js와 세트)
 *   2) release-notes.json 의 pending 항목({ "pending": true })에
 *      실제 버전을 부여해 확정하고 release-notes.js를 재생성한다.
 *   3) pending 항목이 없으면 이전 버전 커밋 이후의 커밋 subject로
 *      초안을 자동 생성한다 (수동 편집 워크플로: npm run notes:draft).
 *
 * 사용:
 *   - 모듈: const { stampReleaseNotes } = require('./stamp-release-notes.js');
 *           stampReleaseNotes({ version: stamp.newValue });
 *   - 단독 초안: node tools/build/stamp-release-notes.js --draft
 *     → 커밋 subject로 pending 항목을 만들고, 개발자가 JSON을 수동 편집 후 배포.
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const VERSION_PATH = path.join(ROOT, 'data', 'version.js');
const NOTES_JSON_PATH = path.join(ROOT, 'data', 'release-notes.json');
const NOTES_JS_PATH = path.join(ROOT, 'data', 'release-notes.js');
const MAX_ENTRIES = 20; // 최근 20개 버전만 유지

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

function pad2(n) { return String(n).padStart(2, '0'); }
function today(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 버전 문자열 끝의 git 해시 토큰 추출 (v369-20260926-346691b → 346691b) */
function versionCommit(version) {
  const m = /-([0-9a-f]{7,})$/i.exec(version || '');
  return m ? m[1] : null;
}

/** data/version.js 갱신. @returns {{ changed: boolean, oldValue, newValue }} */
function stampAppVersion(version, { dryRun = false, silent = false } = {}) {
  const src = fs.existsSync(VERSION_PATH) ? fs.readFileSync(VERSION_PATH, 'utf8') : '';
  const m = /window\.APP_VERSION\s*=\s*'([^']*)'/.exec(src);
  const oldValue = m ? m[1] : '';
  if (oldValue === version) {
    if (!silent) console.log(`[release-notes] APP_VERSION 변경 없음 ('${oldValue}')`);
    return { changed: false, oldValue, newValue: version };
  }
  if (!dryRun) {
    fs.writeFileSync(VERSION_PATH,
      `// data/version.js — 앱 버전 전역 (배포 시 tools/build/stamp-release-notes.js가 갱신)\n` +
      `// sw.js CACHE_VERSION과 동일 값을 유지한다.\n` +
      `window.APP_VERSION = '${version}';\n`);
  }
  if (!silent) console.log(`[release-notes] APP_VERSION '${oldValue}' → '${version}'`);
  return { changed: true, oldValue, newValue: version };
}

/** JSON 소스 로드 — 문법 오류는 배포를 차단하는 명시적 실패로 던진다 */
function loadNotes() {
  if (!fs.existsSync(NOTES_JSON_PATH)) return [];
  try {
    const entries = JSON.parse(fs.readFileSync(NOTES_JSON_PATH, 'utf8'));
    if (!Array.isArray(entries)) throw new Error('최상위가 배열이 아닙니다');
    return entries;
  } catch (e) {
    throw new Error(`[release-notes] release-notes.json 파싱 실패 — JSON 문법을 확인하세요: ${e.message}`);
  }
}

/** JSON 저장 + JS 래퍼 재생성 */
function writeNotes(entries) {
  const trimmed = entries.slice(0, MAX_ENTRIES);
  fs.writeFileSync(NOTES_JSON_PATH, JSON.stringify(trimmed, null, 2) + '\n');
  fs.writeFileSync(NOTES_JS_PATH,
    `// data/release-notes.js — 생성 파일, 직접 편집 금지\n` +
    `// 진실 소스: data/release-notes.json — npm run notes:draft → JSON 편집 → deploy\n` +
    `window.RELEASE_NOTES = ${JSON.stringify(trimmed)};\n`);
}

/** 기준 버전 이후 커밋 subject 목록 (릴리스 노트 초안용) */
function commitsSince(version) {
  const hash = versionCommit(version);
  const range = hash ? `${hash}..HEAD` : '-10';
  const out = git(['log', range, '--pretty=%s']);
  if (!out) return [];
  return out.split('\n')
    .map(s => s.trim())
    .filter(s => s && !/^chore\(sw\)|Merge /.test(s)) // 자동 스탬프·머지 커밋 제외
    .slice(0, 10);
}

/**
 * 배포 시 호출 — APP_VERSION 치환 + pending/초안 항목에 실제 버전 부여.
 * @param {{ version: string, prevVersion?: string }} opts
 */
function stampReleaseNotes({ version, prevVersion, dryRun = false } = {}) {
  stampAppVersion(version, { dryRun });
  const entries = loadNotes();
  if (entries.length && entries[0].version === version) return { stamped: false };

  const pendingIdx = entries.findIndex(e => e.pending === true);
  if (pendingIdx >= 0) {
    entries[pendingIdx].pending = undefined;
    delete entries[pendingIdx].pending;
    entries[pendingIdx].version = version;
    entries[pendingIdx].date = today();
    // pending이 최상단이 아니면 맨 앞으로
    if (pendingIdx > 0) entries.unshift(entries.splice(pendingIdx, 1)[0]);
  } else {
    const notes = commitsSince(prevVersion);
    entries.unshift({
      version,
      date: today(),
      notes: notes.length ? notes : ['내부 개선 및 안정성 향상'],
    });
    console.log(`[release-notes] ⚠️ pending 노트 없음 — 커밋 subject ${notes.length}건으로 자동 초안 생성. 다음 배포부터 'npm run notes:draft'로 미리 편집하세요.`);
  }
  if (!dryRun) writeNotes(entries);
  return { stamped: true };
}

/** 배포 전 호출 — 커밋 subject로 pending 초안 생성/갱신 (수동 편집용) */
function draftNotes() {
  const entries = loadNotes();
  const lastReleased = entries.find(e => e.version);
  const notes = commitsSince(lastReleased?.version);
  const draft = { pending: true, date: today(), notes: notes.length ? notes : ['(변경 내용을 직접 작성하세요)'] };
  const pendingIdx = entries.findIndex(e => e.pending === true);
  if (pendingIdx >= 0) {
    // 이미 pending이 있으면 덮어쓰지 않는다 — 수동 편집분 보존
    console.log(`[release-notes] pending 항목이 이미 있습니다 (${entries[pendingIdx].notes.length}건) — 기존 내용 유지.`);
    return;
  }
  entries.unshift(draft);
  writeNotes(entries);
  console.log(`[release-notes] pending 초안 ${draft.notes.length}건 생성 — data/release-notes.json을 편집 후 배포하세요.`);
}

module.exports = { stampReleaseNotes, stampAppVersion, draftNotes, loadNotes };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  if (process.argv.includes('--draft')) {
    if (dryRun) { console.log(loadNotes()); return; }
    draftNotes();
  } else {
    const i = process.argv.indexOf('--version');
    if (i < 0) { console.error('사용법: --draft | --version <v> [--dry-run]'); process.exit(1); }
    stampReleaseNotes({ version: process.argv[i + 1], dryRun });
  }
}
