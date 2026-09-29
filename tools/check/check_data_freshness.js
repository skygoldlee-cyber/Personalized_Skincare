#!/usr/bin/env node
/**
 * check_data_freshness.js — 생성물(data/ 번들·keyword-index·sw.js 자산 목록 등)과
 * 원본(content/*.md·manifest·exams.json)의 신선도 검증.
 *
 * 방법: 빌드 체인(build:data의 생성 단계)을 그대로 실행한 뒤 git status/diff로
 * 생성물 범위의 변경을 감지한다. 커밋된 산출물이 원본과 어긋나 있으면
 * (=build:data 누락) drift로 보고한다. 다른 신선도 체크와 달리 생성기마다
 * 별도 --check를 구현할 필요 없이 실제 빌드 결과를 비교하므로 누락이 없다.
 *
 *   - 실행 전 생성물 범위가 clean이어야 한다 (dirty면 중단 — 빌드가 덮어쓰므로)
 *   - sync:citations는 [인용] 단계가 전담하므로 체인에서 제외 (원본 md를 쓰는 유일한 단계)
 *   - 타임스탬프·스탬프 라인(generatedAt·생성: 헤더·CACHE_VERSION)만의 차이는 무시
 *   - 감지 후 생성물은 HEAD 상태로 복원한다 (drift 여부와 무관하게 항상 원복)
 *
 * 사용: node tools/check/check_data_freshness.js   (불일치 시 exit 1)
 *       npm run check:datafresh / check:content [데이터신선도] 단계
 */

// @spec none (생성물 신선도 게이트)
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');

// 빌드 체인 — package.json build:data 기준 (sync:citations·postbuild check:parser 제외)
const BUILD_STEPS = [
    'build_exams_list.js',
    'build_pdf_registry.js',
    'build_keyword_index.js',
    'build_all_data.js',
    'build_study_md_bundle.js',
    'build_exam_bundles.js',
    'build_audio_manifest.js',
    'build_question_chapters.js',
    'build_id_migration.js',
];

// 이 패턴에 해당하는 라인만 바뀐 diff는 드리프트로 간주하지 않는다
// (생성 시각·HEAD 스탬프 — 내용 드리프트가 아님)
const NOISE_LINE = /"generatedAt"\s*:|^\/\/ 생성:.*\|\s*\d{4}-|CACHE_VERSION\s*=\s*['"]/;

// 생성물 경로 판정 (git이 반환하는 POSIX 스타일 경로 기준)
function inScope(p) {
    return p.startsWith('data/')
        || p === 'src/keyword-index.js'
        || p === 'sw.js'
        || p === 'index.html'
        || p === 'manifest.webmanifest'
        || /^manifest\.[^/]*\.webmanifest$/.test(p)
        || (p.startsWith('content/') && p.endsWith('/manifest.json'))
        || /^tools\/build\/\.last-stats[^/]*\.json$/.test(p);
}

function git(args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

/** 추적 파일의 작업트리 변경 목록 (수정·삭제) — NUL 구분으로 비ASCII 경로 안전 */
function changedTracked() {
    return git(['diff', '--name-only', '-z', 'HEAD', '--'])
        .split('\0').filter(Boolean);
}

/** 미추적 파일 목록 (새 생성물 감지용) */
function untracked() {
    return git(['ls-files', '--others', '--exclude-standard', '-z'])
        .split('\0').filter(Boolean);
}

/** 파일의 작업트리 diff가 노이즈 라인만으로 구성됐는지 판정 */
function isNoiseOnlyDiff(file) {
    let diff;
    try {
        diff = git(['diff', '-U0', 'HEAD', '--', file]);
    } catch {
        return false;
    }
    const changed = diff.split('\n').filter(l =>
        (l.startsWith('+') && !l.startsWith('+++')) ||
        (l.startsWith('-') && !l.startsWith('---')));
    if (!changed.length) return true;
    return changed.every(l => NOISE_LINE.test(l.slice(1)));
}

/** 생성물 범위를 HEAD 상태로 복원 (수정·삭제 파일은 checkout, 신규 파일은 삭제) */
function restore(paths, untrackedPaths) {
    for (const p of paths) {
        try { git(['checkout', 'HEAD', '--', p]); } catch { /* 새 파일→HEAD에 없음 */ }
    }
    for (const p of untrackedPaths) {
        try { fs.rmSync(path.join(ROOT, p), { force: true }); } catch { /* ignore */ }
    }
}

function main() {
    console.log('생성물 신선도 검증 — 빌드 체인 실행 후 git diff 비교\n');

    // 1) 사전 조건: 생성물 범위 clean (dirty면 빌드가 덮어써 사용자 변경이 유실됨)
    const preDirty = [...changedTracked(), ...untracked()].filter(inScope);
    if (preDirty.length) {
        console.error('❌ 생성물 경로에 미커밋 변경이 있습니다 — 빌드가 덮어쓰므로 커밋·스태시 후 재실행하세요:');
        for (const p of preDirty.slice(0, 15)) console.error(`   - ${p}`);
        if (preDirty.length > 15) console.error(`   … 외 ${preDirty.length - 15}개`);
        process.exit(1);
    }

    // 2) 빌드 체인 실행 (실패해도 생성물 원복 후 종료)
    const postTracked = [];
    let postUntracked = [];
    try {
        for (const step of BUILD_STEPS) {
            const tool = path.join('tools', 'build', step);
            process.stdout.write(`  ▶ ${step}\n`);
            const r = spawnSync(process.execPath, [tool], {
                cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
            });
            if (r.status !== 0) {
                console.error(`  ❌ ${step} 실패 (exit ${r.status}):`);
                console.error((r.stderr || r.stdout || '').trim().split('\n').slice(-10).join('\n'));
                process.exitCode = 1;
                return;
            }
        }

        // 3) 생성물 범위의 diff 수집
        const tracked = changedTracked().filter(inScope);
        postUntracked = untracked().filter(inScope);
        postTracked.push(...tracked);

        const drift = [];
        const noiseOnly = [];
        for (const f of tracked) {
            (isNoiseOnlyDiff(f) ? noiseOnly : drift).push(f);
        }
        for (const f of postUntracked) drift.push(`${f} (신규 산출물)`);

        if (!drift.length) {
            console.log(`\n✅ 생성물이 원본과 일치합니다 (검사 ${tracked.length + postUntracked.length}개 경로` +
                (noiseOnly.length ? `, 타임스탬프 갱신 ${noiseOnly.length}개 무시` : '') + ')');
            return;
        }

        console.error(`\n❌ 생성물 드리프트 ${drift.length}건 — npm run build:data 후 커밋 필요:`);
        for (const f of drift.slice(0, 20)) console.error(`   - ${f}`);
        if (drift.length > 20) console.error(`   … 외 ${drift.length - 20}개`);
        if (noiseOnly.length) console.log(`   (참고) 타임스탬프만 갱신된 파일 ${noiseOnly.length}개는 정상으로 간주`);
        process.exitCode = 1;
    } finally {
        // 4) 생성물 원복 — 드리프트 보고 후에도 작업트리는 항상 HEAD 상태로
        const restTracked = postTracked.length ? postTracked : changedTracked().filter(inScope);
        const restUntracked = postUntracked.length ? postUntracked : untracked().filter(inScope);
        restore(restTracked, restUntracked);
    }
}

main();
