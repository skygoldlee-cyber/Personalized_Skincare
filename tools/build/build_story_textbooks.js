#!/usr/bin/env node
// tools/build/build_story_textbooks.js — 표준형 + 서사 패치 → _이야기형.md 생성
// @spec none (콘텐츠 빌드 도구)
//
// manifest의 각 chapter가 storyFile을 선언하면, 같은 디렉터리의
//   story/<표준형 파일명 - _표준형.md>_서사.md
// 패치를 표준형에 병합하여 storyFile을 생성한다.
// 패치 파일이 없으면 storyFile을 제거하지 않고 건너뛴다(수작업 이야기형 호환).
//
// 사용:
//   node tools/build/build_story_textbooks.js           # 생성
//   node tools/build/build_story_textbooks.js --check   # 생성물 ↔ 디스크 비교만
'use strict';

const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam_targets');
const { parsePatch, applyPatch, norm } = require('./story_merge');

const ROOT = path.resolve(__dirname, '..', '..');
const CHECK = process.argv.includes('--check');

function patchPathFor(dirAbs, stdFile) {
    const base = stdFile.replace(/_표준형\.md$/i, '');
    return path.join(dirAbs, 'story', `${base}_서사.md`);
}

function main() {
    const generated = [];
    const skipped = [];
    const failed = [];
    let drifted = 0;

    for (const t of getExamTargets(ROOT)) {
        if (!t.manifest) continue;
        for (const subj of t.manifest.subjects || []) {
            const dirAbs = path.join(ROOT, t.contentRoot, subj.dir);
            for (const ch of subj.chapters || []) {
                if (!ch.storyFile) continue;
                const stdAbs = path.join(dirAbs, ch.file);
                const patchAbs = patchPathFor(dirAbs, ch.file);
                const outAbs = path.join(dirAbs, ch.storyFile);
                const rel = path.relative(ROOT, outAbs);

                if (!fs.existsSync(patchAbs)) {
                    skipped.push(`${rel} (패치 없음 — 수작업 파일 유지)`);
                    continue;
                }
                const std = norm(fs.readFileSync(stdAbs, 'utf8'));
                const ops = parsePatch(fs.readFileSync(patchAbs, 'utf8'));
                const { text, errors } = applyPatch(std, ops);
                if (errors.length) {
                    failed.push(`${rel}:\n    ${errors.join('\n    ')}`);
                    continue;
                }
                if (CHECK) {
                    const cur = fs.existsSync(outAbs) ? norm(fs.readFileSync(outAbs, 'utf8')) : '';
                    if (cur !== text) { drifted++; console.log(`  ✗ 드리프트: ${rel}`); }
                    else console.log(`  ✓ ${rel}`);
                    continue;
                }
                const prev = fs.existsSync(outAbs) ? norm(fs.readFileSync(outAbs, 'utf8')) : null;
                fs.writeFileSync(outAbs, text, 'utf8');
                generated.push(`${rel}${prev === null ? ' (신규)' : prev === text ? '' : ' (갱신)'}`);
            }
        }
    }

    if (CHECK) {
        if (failed.length) {
            console.error('실패:');
            failed.forEach(f => console.error(`  ✗ ${f}`));
        }
        if (drifted || failed.length) {
            if (drifted) console.error(`\n❌ 이야기형 ${drifted}개 파일이 패치/표준형과 불일치 — npm run build:story 후 커밋 필요`);
            process.exit(1);
        }
        console.log('\n✅ 모든 이야기형이 패치와 일치합니다');
        return;
    }

    if (generated.length) {
        console.log('생성된 이야기형:');
        generated.forEach(g => console.log(`  + ${g}`));
    }
    if (skipped.length) {
        console.log('건너뜀:');
        skipped.forEach(s => console.log(`  - ${s}`));
    }
    if (failed.length) {
        console.error('실패:');
        failed.forEach(f => console.error(`  ✗ ${f}`));
        process.exit(1);
    }
    if (!generated.length) console.log('생성 대상 없음');
}

main();
