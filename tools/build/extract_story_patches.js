#!/usr/bin/env node
// tools/build/extract_story_patches.js — 기존 _이야기형.md에서 서사 패치 추출 (1회 마이그레이션)
// @spec none (콘텐츠 빌드 도구)
//
// 각 storyFile을 표준형과 비교해 story/<base>_서사.md 패치를 생성한다.
// 서사 블록·추가 섹션·제목 부제는 패치로 이관하고, 이야기형 고유 본문 편집은
// 정규화 대상으로 drift 리포트에만 기록한다(표준형으로 복원됨).
//
// 사용:
//   node tools/build/extract_story_patches.js           # 패치 생성 + drift 보고
//   node tools/build/extract_story_patches.js --dry     # 보고만 (파일 미생성)
'use strict';

const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam_targets');
const { extractPatch, formatPatch } = require('./story_merge');

const ROOT = path.resolve(__dirname, '..', '..');
const DRY = process.argv.includes('--dry');

function header(base, stdFile, storyFile) {
    return [
        `# ${base} — 이야기형 서사 패치`,
        ``,
        `> 이 파일은 \`${stdFile}\`에 삽입할 서사·추가 섹션·제목 부제를 정의합니다.`,
        `> \`${storyFile}\`는 \`npm run build:story\`로 생성되는 산출물입니다 — 직접 편집 금지.`,
        `> 표준형 본문이 바뀌면 앵커(따옴표 안 줄)가 깨질 수 있습니다 — build 실패 시 앵커를 갱신하세요.`,
        ``,
    ];
}

function main() {
    let extracted = 0;
    let driftTotal = 0;

    for (const t of getExamTargets(ROOT)) {
        if (!t.manifest) continue;
        for (const subj of t.manifest.subjects || []) {
            const dirAbs = path.join(ROOT, t.contentRoot, subj.dir);
            for (const ch of subj.chapters || []) {
                if (!ch.storyFile) continue;
                const stdAbs = path.join(dirAbs, ch.file);
                const storyAbs = path.join(dirAbs, ch.storyFile);
                if (!fs.existsSync(stdAbs) || !fs.existsSync(storyAbs)) continue;

                const base = ch.file.replace(/_표준형\.md$/i, '');
                const { ops, drift, std } = extractPatch(
                    fs.readFileSync(storyAbs, 'utf8'),
                    fs.readFileSync(stdAbs, 'utf8'));

                const patchText = formatPatch(ops, std, header(base, ch.file, ch.storyFile));
                const storyInserts = ops.filter(o => o.kind === 'insert' && o.story).length;
                const extraInserts = ops.filter(o => o.kind === 'insert' && !o.story).length;
                const renames = ops.filter(o => o.kind !== 'insert').length;

                console.log(`\n=== ${subj.dir}/${base} ===`);
                console.log(`  패치 ops: 서사 ${storyInserts} · 추가섹션 ${extraInserts} · 제목변형 ${renames}`);
                console.log(`  정규화 대상(이야기형 고유 본문 편집): ${drift.length} hunks`);
                drift.forEach((d, k) => {
                    if (k >= 8) return;
                    const ctx = d.delLines[0] || d.insLines[0] || '';
                    console.log(`    [L${d.ai + 1}] 표준형 -${d.delLines.length}줄/이야기형 +${d.insLines.length}줄 — ${ctx.slice(0, 60)}`);
                });
                if (drift.length > 8) console.log(`    … 외 ${drift.length - 8} hunks`);
                driftTotal += drift.length;

                if (!DRY) {
                    const patchDir = path.join(dirAbs, 'story');
                    fs.mkdirSync(patchDir, { recursive: true });
                    const patchAbs = path.join(patchDir, `${base}_서사.md`);
                    fs.writeFileSync(patchAbs, patchText, 'utf8');
                    console.log(`  → ${path.relative(ROOT, patchAbs)}`);
                    extracted++;
                }
            }
        }
    }

    console.log(`\n${DRY ? '[dry-run] ' : ''}완료: 패치 ${extracted}개, 정규화 hunk ${driftTotal}건`);
    if (driftTotal) {
        console.log('⚠ 정규화 대상은 이야기형만의 본문 편집입니다 — 표준형으로 되돌아가야 할 수정인지 검토하세요.');
    }
}

main();
