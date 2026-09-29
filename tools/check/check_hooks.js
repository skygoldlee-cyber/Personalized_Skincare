#!/usr/bin/env node
/**
 * check_hooks.js — Git 훅(core.hooksPath) 활성화 여부 확인 (권고 단계)
 *
 * .githooks의 pre-commit/pre-push 게이트는 opt-in이라 미설치 환경에서는
 * 로컬 품질 게이트가 조용히 우회된다. CI가 최종 방어선이지만 조기 감지를 위해
 * 설치 상태를 안내한다 (항상 exit 0 — 차단하지 않는 권고).
 *
 * 사용: node tools/check/check_hooks.js   (check:ci 첫 단계)
 */

// @spec none (개발환경 권고 체크)
'use strict';

const { execFileSync } = require('child_process');

let hooksPath = null;
try {
    hooksPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
} catch { /* 미설정 */ }

if (hooksPath === '.githooks') {
    console.log('✅ Git 훅 활성화됨 (core.hooksPath = .githooks)');
} else {
    console.warn('⚠️  Git 훅 미설치 — pre-commit/pre-push 게이트가 로컬에서 우회됩니다.');
    console.warn('   활성화: npm run hooks:install  (CI는 훅과 무관하게 전 게이트를 실행)');
}
process.exit(0);
