#!/usr/bin/env node
// tools/build/migrate_story_slots.js — 텍스트 앵커 패치 → 슬롯 마커 앵커 1회 마이그레이션
// @spec none (콘텐츠 빌드 도구)
//
// 각 서사 패치의 @insert before/after/at 지시어를 해석해 표준형에
// <!-- story:slot:sNN --> 마커를 심고, 패치 지시어를 @insert slot="sNN"으로 재작성한다.
// suffix/replace op는 줄 단위 편집이라 line= 앵커를 그대로 유지한다.
//
// 사용: node tools/build/migrate_story_slots.js   (이후 npm run build:story + sync:citations)
'use strict';

const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam_targets');
const { parsePatch, norm } = require('./story_merge');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR_RE = /^(\s*<!--\s*@insert\s+)(.*?)\s*-->\s*$/;

function resolvePos(stdLines, op) {
    if (op.where === 'start') return 0;
    if (op.where === 'end') return stdLines.length;
    const idx = stdLines.reduce((found, l, i) => {
        if (l === op.anchor && ++found.c === (op.n || 1)) found.i = i;
        return found;
    }, { c: 0, i: -1 }).i;
    if (idx < 0) throw new Error(`앵커 미해석: ${op.where}="${op.anchor}"`);
    return op.where === 'before' ? idx : idx + 1;
}

function main() {
    for (const t of getExamTargets(ROOT)) {
        if (!t.manifest) continue;
        for (const subj of t.manifest.subjects || []) {
            const dirAbs = path.join(ROOT, t.contentRoot, subj.dir);
            for (const ch of subj.chapters || []) {
                if (!ch.storyFile) continue;
                const base = ch.file.replace(/_표준형\.md$/i, '');
                const patchAbs = path.join(dirAbs, 'story', `${base}_서사.md`);
                if (!fs.existsSync(patchAbs)) continue;

                const stdPath = path.join(dirAbs, ch.file);
                const stdLines = norm(fs.readFileSync(stdPath, 'utf8')).split('\n');
                const patchText = norm(fs.readFileSync(patchAbs, 'utf8'));
                const ops = parsePatch(patchText);

                // insert op → 표준형 삽입 위치 해석, 문서 순으로 슬롯 ID 부여
                const inserts = ops.filter(o => o.kind === 'insert');
                if (!inserts.length) { console.log(`  - ${subj.dir}: insert 없음`); continue; }
                const placed = inserts.map(op => ({ op, pos: resolvePos(stdLines, op) }));
                placed.sort((a, b) => a.pos - b.pos);
                placed.forEach((p, i) => { p.slot = `s${String(i + 1).padStart(2, '0')}`; });

                // 표준형에 마커 삽입 (아래부터 — 인덱스 보존, 동일 위치는 역순)
                const markers = placed.map(p => ({ pos: p.pos, slot: p.slot }));
                markers.sort((a, b) => b.pos - a.pos || b.slot.localeCompare(a.slot));
                for (const m of markers) stdLines.splice(m.pos, 0, `<!-- story:slot:${m.slot} -->`);
                fs.writeFileSync(stdPath, stdLines.join('\n'), 'utf8');

                // 패치 지시어를 slot=으로 재작성 (파일 순서 == parsePatch 순서)
                const queue = inserts.slice(); // 파일 순서
                const slotOf = new Map(placed.map(p => [p.op, p.slot]));
                const newPatch = patchText.split('\n').map(l => {
                    const m = l.match(DIR_RE);
                    if (!m) return l;
                    const op = queue.shift();
                    return `${m[1]}slot="${slotOf.get(op)}"${op.story ? ' story' : ''} -->`;
                }).join('\n');
                fs.writeFileSync(patchAbs, newPatch, 'utf8');
                console.log(`  ✓ ${subj.dir}/${base}: 슬롯 ${markers.length}개 삽입, 지시어 갱신`);
            }
        }
    }
    console.log('\n완료 — npm run build:story로 이야기형 재생성 후 sync:citations·build:data를 실행하세요');
}

main();
