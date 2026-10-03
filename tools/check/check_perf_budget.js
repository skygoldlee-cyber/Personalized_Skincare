#!/usr/bin/env node
/* ============================================================
 * tools/check/check_perf_budget.js
 * ------------------------------------------------------------
 * 성능 예산 게이트 — sw.js SHELL_ASSETS의 실제 파일 크기를 계측해
 * 예산 상한과 비교한다. PWA는 프리캐시 목록 = 첫 방문 다운로드량이므로
 * 셸 크기 증가를 커밋 시점에 차단한다.
 *
 * 예산 (2026-10 기준선, 여유 ~10~15%):
 *   - 셸 총량     ≤ 12.5 MB  (현재 ~11.0MB — noto-emoji 5.6MB·mermaid 3.3MB 지배)
 *   - JS 총량     ≤  4.8 MB  (현재 ~4.5MB — vendor/mermaid가 3.3MB)
 *   - 단일 파일   ≤  6.0 MB  (현재 최대 noto-color-emoji 5.6MB)
 *   - index.html  ≤  160 KB  (현재 ~127KB)
 *
 * 상한을 넘기고 싶으면 이 파일의 예산과 "기준선" 주석을 함께 수정할 것 —
 * 무성의한 상향은 PR 리뷰에서 걸러야 한다.
 *
 * 사용:
 *   node tools/check/check_perf_budget.js
 *   npm run check:perf
 * ============================================================ */

// @spec UX-PWA-03
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SW_FILE = path.join(ROOT, 'sw.js');
const INDEX_FILE = path.join(ROOT, 'index.html');

const KB = 1024, MB = 1024 * 1024;
const BUDGET = {
    shellTotalMB: 12.5,   // SHELL_ASSETS 합계
    jsTotalMB: 4.8,       // 셸 내 .js 합계
    singleFileMB: 6.0,    // 단일 파일 상한
    indexHtmlKB: 160,     // App Shell 조립 결과물
};

function shellAssets() {
    const src = fs.readFileSync(SW_FILE, 'utf8');
    const m = src.match(/SHELL_ASSETS\s*=\s*\[([\s\S]*?)\];/);
    if (!m) throw new Error('sw.js에서 SHELL_ASSETS 배열을 찾지 못함');
    return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]);
}

const fmt = (b) => (b >= MB ? (b / MB).toFixed(1) + 'MB' : (b / KB).toFixed(0) + 'KB');

function main() {
    const errors = [];
    const entries = shellAssets();
    let total = 0, jsTotal = 0, maxFile = { path: '', size: 0 };

    for (const e of entries) {
        const p = e.replace(/^\.\//, '').replace(/^\//, '');
        const abs = path.join(ROOT, p);
        if (!fs.existsSync(abs)) continue; // 존재 검증은 verify:assets 담당 — 여기선 예산만
        const size = fs.statSync(abs).size;
        total += size;
        if (p.endsWith('.js')) jsTotal += size;
        if (size > maxFile.size) maxFile = { path: e, size };
    }

    if (total > BUDGET.shellTotalMB * MB) {
        errors.push(`셸 총량 ${fmt(total)} > 예산 ${BUDGET.shellTotalMB}MB`);
    }
    if (jsTotal > BUDGET.jsTotalMB * MB) {
        errors.push(`JS 총량 ${fmt(jsTotal)} > 예산 ${BUDGET.jsTotalMB}MB`);
    }
    if (maxFile.size > BUDGET.singleFileMB * MB) {
        errors.push(`단일 파일 ${maxFile.path} ${fmt(maxFile.size)} > 예산 ${BUDGET.singleFileMB}MB`);
    }
    const indexSize = fs.existsSync(INDEX_FILE) ? fs.statSync(INDEX_FILE).size : 0;
    if (indexSize > BUDGET.indexHtmlKB * KB) {
        errors.push(`index.html ${fmt(indexSize)} > 예산 ${BUDGET.indexHtmlKB}KB`);
    }

    console.log(`📏 성능 예산 — 셸 ${entries.length}개 ${fmt(total)} · JS ${fmt(jsTotal)} · 최대 파일 ${maxFile.path} ${fmt(maxFile.size)} · index.html ${fmt(indexSize)}`);

    if (errors.length) {
        console.error('\n❌ 성능 예산 초과:');
        for (const e of errors) console.error('  ' + e);
        process.exit(1);
    }
    console.log('✅ 성능 예산 통과');
}

main();
