#!/usr/bin/env node
/* ============================================================
 * tools/verify-shell-assets.js
 * ------------------------------------------------------------
 * sw.js 의 SHELL_ASSETS / DATA_ASSETS 에 나열된 모든 프리캐시 자산이
 * 실제로 저장소에 존재하는지 빌드/CI 타임에 검증한다.
 *
 * 왜 필요한가?
 *   install 핸들러는 자산을 개별 캐싱하도록 완화되어(precacheResilient),
 *   목록에 없는 파일이 있어도 새 SW 활성화가 브릭되지는 않는다. 다만
 *   navigation 이 cacheFirst 이므로, 배포에 누락된 셸 자산은 오프라인
 *   최초 로드에서 조용히 실패한다. 이 스크립트는 그 드리프트를 배포 전에
 *   드러내어(비-0 종료) SHELL_ASSETS 목록과 실제 파일을 강제로 일치시킨다.
 *
 * 사용:
 *   node tools/verify-shell-assets.js
 *   npm run verify:assets
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SW_PATH = path.join(ROOT, 'sw.js');

/** sw.js 에서 `const NAME = [ ... ];` 배열의 문자열 리터럴만 수집 */
function extractArray(src, name) {
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
  if (!m) throw new Error(name + ' 배열을 sw.js 에서 찾지 못했습니다.');
  const entries = [];
  const re = /(['"])(.*?)\1/g;
  // 주석 전용 라인만 스킵한다. (인라인 트레일링 주석은 따옴표 뒤이므로 영향 없음.
  //  '//' 를 무조건 잘라내면 'https://' 같은 URL 이 손상되므로 그렇게 하지 않는다.)
  for (const rawLine of m[1].split('\n')) {
    if (rawLine.trim().startsWith('//')) continue;
    let mm;
    while ((mm = re.exec(rawLine))) entries.push(mm[2]);
    re.lastIndex = 0;
  }
  return entries;
}

function main() {
  const src = fs.readFileSync(SW_PATH, 'utf8');
  const groups = [
    ['SHELL_ASSETS', extractArray(src, 'SHELL_ASSETS')],
    ['DATA_ASSETS', extractArray(src, 'DATA_ASSETS')]
  ];

  const missing = [];
  let checked = 0;

  for (const [name, assets] of groups) {
    for (const asset of assets) {
      // './' 는 디렉터리 인덱스 → 서버가 index.html 로 해소하므로 검사 생략
      if (asset === './') continue;
      // 외부(절대 URL)는 로컬 존재 검사 대상이 아님
      if (/^https?:\/\//i.test(asset)) continue;
      const rel = asset.replace(/^\.\//, '').split(/[?#]/)[0];
      checked++;
      if (!fs.existsSync(path.join(ROOT, rel))) {
        missing.push(name + ': ' + asset);
      }
    }
  }

  if (missing.length) {
    console.error('❌ 프리캐시 자산 ' + missing.length + '개 누락 (검사 ' + checked + '개):');
    for (const item of missing) console.error('   - ' + item);
    console.error('\nsw.js 의 SHELL_ASSETS/DATA_ASSETS 목록과 실제 파일을 일치시키세요.');
    process.exit(1);
  }

  console.log('✅ 프리캐시 자산 전수 확인: ' + checked + '개 모두 존재.');
}

main();
