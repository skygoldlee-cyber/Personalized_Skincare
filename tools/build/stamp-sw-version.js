#!/usr/bin/env node
/* ============================================================
 * tools/build/stamp-sw-version.js
 * ------------------------------------------------------------
 * sw.js 의 `CACHE_VERSION` 상수를 빌드 타임에 자동 치환한다.
 * (개선안 2-2: 서비스 워커 버전 관리 자동화)
 *
 * 버전 규칙(기본값):
 *   ${prefix}-${YYYYMMDD}-${gitShort}
 *     - prefix   : 기존 CACHE_VERSION 의 선두 채널 토큰(예: v28)을 보존.
 *                  없으면 'v'. (SW_CACHE_PREFIX 로 덮어쓰기 가능)
 *     - YYYYMMDD : 빌드 시각(로컬)
 *     - gitShort : `git rev-parse --short` (7자)
 *   git 을 못 쓰는 환경(비-git/CI 캐시아웃 등)에서는 해시 대신
 *   타임스탬프(HHmmss)로 대체해 항상 고유성을 보장한다.
 *
 * 왜 이렇게?
 *   - HEAD 커밋으로 값이 결정된다 → 같은 커밋이면 같은 버전(멱등).
 *     코드/HTML(App Shell)이 바뀌어 커밋되면 해시가 달라져 새 캐시로
 *     승격되고, activate 훅이 구 캐시를 정리한다.
 *   - dirty(-d) 마커는 두지 않는다: build:data 가 data/* 번들을 매 빌드
 *     재생성(→ 커밋 필요)하므로 stamp 시점의 트리는 사실상 항상 dirty 라
 *     마커가 상시 켜져 신호로서 무의미하기 때문.
 *
 * 사용:
 *   - 모듈:   const { stampSwVersion } = require('./stamp-sw-version.js');
 *             stampSwVersion();            // index.js 빌드 말미에서 호출
 *   - 단독:   node tools/build/stamp-sw-version.js
 *             node tools/build/stamp-sw-version.js --dry-run
 *             node tools/build/stamp-sw-version.js --prefix v29
 *             node tools/build/stamp-sw-version.js --full-timestamp
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SW_PATH = path.join(ROOT, 'sw.js');

// CACHE_VERSION 선언 라인만 정확히 매칭한다.
//   그룹1: 'const CACHE_VERSION = '
//   그룹2: 따옴표 문자 (' 또는 ")
//   그룹3: 기존 값
//   그룹4: 세미콜론 + 뒤따르는 주석(있으면) — 그대로 보존
// 주의: DATA_CACHE_VERSION 라인은 식별자가 다르므로 매칭되지 않는다.
const DECL_RE = /^(\s*const\s+CACHE_VERSION\s*=\s*)(['"])(.*?)\2(\s*;.*)?$/;

/** git 명령을 조용히 실행. 실패하면 null. */
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

/** 로컬 시각 기준 YYYYMMDD */
function dateStamp(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

/** 로컬 시각 기준 HHmmss (git 폴백용) */
function timeStamp(d = new Date()) {
  return `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

/** 기존 값에서 선두 채널 토큰(v28 등)을 뽑아낸다. 없으면 'v'. */
function derivePrefix(currentValue) {
  const m = /^([A-Za-z]+\d*)/.exec(currentValue || '');
  return m ? m[1] : 'v';
}

/**
 * 새 CACHE_VERSION 문자열을 계산한다.
 * @param {object}  [opts]
 * @param {string}  [opts.currentValue]   기존 값(프리픽스 보존용)
 * @param {string}  [opts.prefix]         프리픽스 강제 지정
 * @param {boolean} [opts.fullTimestamp]  git 을 무시하고 항상 타임스탬프 사용
 * @param {Date}    [opts.now]
 * @returns {string}
 */
function computeVersion(opts = {}) {
  const now = opts.now || new Date();
  const prefix = opts.prefix || process.env.SW_CACHE_PREFIX || derivePrefix(opts.currentValue);
  const date = dateStamp(now);

  if (!opts.fullTimestamp) {
    const short = git(['rev-parse', '--short=7', 'HEAD']);
    if (short) return `${prefix}-${date}-${short}`;
  }
  // git 미가용 또는 --full-timestamp: 타임스탬프로 고유성 보장
  return `${prefix}-${date}-${timeStamp(now)}`;
}

/**
 * sw.js 의 CACHE_VERSION 을 새 값으로 치환한다.
 * @param {object}  [opts]
 * @param {string}  [opts.swPath]         대상 파일 (기본 <root>/sw.js)
 * @param {string}  [opts.version]        치환할 값 강제 지정(미지정 시 computeVersion)
 * @param {string}  [opts.prefix]         computeVersion 로 전달
 * @param {boolean} [opts.fullTimestamp]  computeVersion 로 전달
 * @param {boolean} [opts.dryRun]         파일을 쓰지 않고 결과만 반환
 * @param {boolean} [opts.silent]         콘솔 로그 억제
 * @returns {{ changed: boolean, oldValue: string, newValue: string, path: string }}
 */
function stampSwVersion(opts = {}) {
  const swPath = opts.swPath || SW_PATH;
  const src = fs.readFileSync(swPath, 'utf8');

  // 원본 EOL 보존 (이 리포의 sw.js 는 CRLF).
  // split(/\r?\n/) → join(eol) 은 파일을 그대로 복원한다
  // (끝의 개행 유무까지 — trailing 개행이 있으면 배열 끝에 '' 요소가 남는다).
  const eol = /\r\n/.test(src) ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);

  let idx = -1;
  let match = null;
  for (let i = 0; i < lines.length; i++) {
    const m = DECL_RE.exec(lines[i]);
    if (m) { idx = i; match = m; break; }
  }
  if (idx === -1) {
    throw new Error(
      `[stamp-sw-version] CACHE_VERSION 선언 라인을 찾지 못했습니다: ${swPath}\n` +
      `  기대 형식: const CACHE_VERSION = '...';`
    );
  }

  const [, head, quote, oldValue, tail = ''] = match;
  const newValue = opts.version || computeVersion({
    currentValue: oldValue,
    prefix: opts.prefix,
    fullTimestamp: opts.fullTimestamp,
  });

  const result = { changed: oldValue !== newValue, oldValue, newValue, path: swPath };

  if (!result.changed) {
    if (!opts.silent) console.log(`[stamp-sw-version] 변경 없음 (CACHE_VERSION = '${oldValue}')`);
    return result;
  }

  lines[idx] = `${head}${quote}${newValue}${quote}${tail}`;
  const out = lines.join(eol);

  if (opts.dryRun) {
    if (!opts.silent) console.log(`[stamp-sw-version] (dry-run) '${oldValue}' → '${newValue}'`);
    return result;
  }

  fs.writeFileSync(swPath, out); // utf8, EOL 보존
  if (!opts.silent) console.log(`[stamp-sw-version] CACHE_VERSION '${oldValue}' → '${newValue}'`);
  return result;
}

module.exports = { stampSwVersion, computeVersion };

// 단독 실행 지원
if (require.main === module) {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  try {
    stampSwVersion({
      dryRun: has('--dry-run'),
      fullTimestamp: has('--full-timestamp'),
      prefix: val('--prefix'),
      version: val('--version'),
    });
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
