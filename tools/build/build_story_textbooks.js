#!/usr/bin/env node
// tools/build/build_story_textbooks.js — 표준형 + 서사 패치 → _이야기형.md 생성
// @spec BP-10 (서사 커버리지 게이트 — 챕터별 story 블록 수 리포트 + 0블록 패치 오류)
// @spec BP-11 (서사-본문 정합 검증 — 서사 인용 조문·수치가 표준형에 없으면 경고)
// @spec BP-12 (이야기 회상 — 본문 일치 사실 토큰으로 챕터 말미 빈칸형 항목 자동 생성)
//
// manifest의 각 chapter가 storyFile을 선언하면, 같은 디렉터리의
//   story/<표준형 파일명 - _표준형.md>_서사.md
// 패치를 표준형에 병합하여 storyFile을 생성한다.
// 패치 파일이 없으면 storyFile을 제거하지 않고 건너뛴다(수작업 이야기형 호환).
//
// 사용:
//   node tools/build/build_story_textbooks.js           # 생성
//   node tools/build/build_story_textbooks.js --check   # 생성물 ↔ 디스크 비교만
//
// 서사 커버리지 게이트: 패치가 존재하는데 story 플래그 블록이 0개면 오류
// (이야기형이 표준형과 동일 — storyFile 선언이 무의미). 수작업 이야기형은
// story:start 마커를 스캔해 서사 블록 수를 보고하고, 없으면 경고만 한다.
'use strict';

const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam_targets');
const {
    parsePatch, applyPatch, norm, GEN_BANNER, splitStoryBlocks,
    findStoryInconsistencies, extractRecallItems, buildRecallSection,
} = require('./story_merge');

const ROOT = path.resolve(__dirname, '..', '..');
const CHECK = process.argv.includes('--check');
const SCAFFOLD_IDX = process.argv.indexOf('--scaffold');
const SCAFFOLD = SCAFFOLD_IDX >= 0 ? process.argv[SCAFFOLD_IDX + 1] : null;

/** 서사 커버리지 리포트 — 챕터별 서사 블록 수 (생성·--check 공통) */
function printCoverage(coverage) {
    if (!coverage.length) return;
    console.log('서사 커버리지:');
    coverage.forEach(c => {
        const tag = c.manual ? '수작업' : '패치';
        console.log(`  ${c.blocks === 0 ? '⚠' : '·'} ${c.rel} — 서사 ${c.blocks}블록 (${tag})${c.blocks === 0 ? ' — 이야기형이 표준형과 동일할 수 있음' : ''}`);
    });
}

/** 서사-본문 정합 경고 — 서사가 인용한 조문·수치가 표준형에 없으면 오탈자/모순 가능성 */
function printConsistency(warnings) {
    if (!warnings.length) return;
    console.log('서사-본문 정합 경고:');
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
}

function patchPathFor(dirAbs, stdFile) {
    const base = stdFile.replace(/(_표준형)?\.md$/i, '');
    return path.join(dirAbs, 'story', `${base}_서사.md`);
}

/** 신규 과목 서사 패치 골격 생성 — 표준형의 헤딩을 앵커 후보로 주석 목록 제공 */
function scaffoldPatch(dirAbs, stdFile) {
    const std = norm(fs.readFileSync(path.join(dirAbs, stdFile), 'utf8'));
    const headings = std.split('\n').filter(l => /^#{1,2} /.test(l));
    const base = stdFile.replace(/(_표준형)?\.md$/i, '');
    return [
        `# ${base} — 이야기형 서사 패치`,
        '',
        `> 이 파일은 \`${stdFile}\`에 삽입할 서사·추가 섹션·제목 부제를 정의합니다.`,
        `> \`${base}_이야기형.md\`는 \`npm run build:story\`로 생성되는 산출물입니다 — 직접 편집 금지.`,
        `> 삽입 지점 지시어: @insert before/after="앵커 줄" · @insert slot="id" · at="start/end" ·`,
        '> story 플래그로 story:start/end 자동 부여 · @suffix/@replace line="…" · 중복 앵커는 n="k"',
        '',
        '<!-- 표준형 헤딩 (앵커 후보)',
        ...headings.map(h => `  ${h}`),
        '-->',
        '',
        '<!-- @insert at="start" story -->',
        '',
        '📖 ┈┈┈┈ **이야기** ┈┈┈┈',
        '',
        '## 프롤로그 — (장면 제목)',
        '',
        '(서사를 작성하세요)',
        '',
        '┈┈┈┈ **본문** ┈┈┈┈ 📘',
        '',
        '<!-- /@ -->',
        '',
    ].join('\n');
}

function runScaffold(subjectKey) {
    let done = 0;
    for (const t of getExamTargets(ROOT)) {
        if (!t.manifest) continue;
        for (const subj of t.manifest.subjects || []) {
            if (subj.key !== subjectKey) continue;
            const dirAbs = path.join(ROOT, t.contentRoot, subj.dir);
            for (const ch of subj.chapters || []) {
                const patchAbs = patchPathFor(dirAbs, ch.file);
                if (fs.existsSync(patchAbs)) {
                    console.log(`  - 이미 존재, 건너뜀: ${path.relative(ROOT, patchAbs)}`);
                    continue;
                }
                fs.mkdirSync(path.dirname(patchAbs), { recursive: true });
                fs.writeFileSync(patchAbs, scaffoldPatch(dirAbs, ch.file), 'utf8');
                console.log(`  + ${path.relative(ROOT, patchAbs)}`);
                done++;
            }
        }
    }
    if (!done) {
        console.log('생성된 패치 없음 (과목 키 확인 또는 이미 존재)');
        return;
    }
    console.log(`\n다음 단계: manifest.json subjects[].chapters[]에 storyFile을 선언하면 build:story가 생성합니다`);
}

function main() {
    if (SCAFFOLD_IDX >= 0) {
        if (!SCAFFOLD || SCAFFOLD.startsWith('-')) {
            console.error('사용법: --scaffold <subjectKey> (예: --scaffold sanitation)');
            process.exit(1);
        }
        runScaffold(SCAFFOLD);
        return;
    }
    const generated = [];
    const skipped = [];
    const failed = [];
    const coverage = [];
    const consistency = [];
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
                    // 수작업 이야기형의 서사 커버리지 — story:start 마커 스캔 (없으면 경고만)
                    if (fs.existsSync(outAbs)) {
                        const txt = norm(fs.readFileSync(outAbs, 'utf8'));
                        const n = (txt.match(/<!-- story:start -->/g) || []).length;
                        coverage.push({ rel, blocks: n, manual: true });
                        // 수작업 파일도 서사 인용 정합 검증은 수행 (생성물 표식은 비교에서 제외)
                        if (fs.existsSync(stdAbs)) {
                            const stdTxt = norm(fs.readFileSync(stdAbs, 'utf8'));
                            const { blocks } = splitStoryBlocks(txt);
                            findStoryInconsistencies(stdTxt, blocks.flatMap(b => b.lines))
                                .forEach(w => consistency.push(`${rel}: 서사 인용 '${w}' — 표준형 본문에 없음`));
                        }
                    }
                    continue;
                }
                const std = norm(fs.readFileSync(stdAbs, 'utf8'));
                const ops = parsePatch(fs.readFileSync(patchAbs, 'utf8'));
                const merged = applyPatch(std, ops);
                if (merged.errors.length) {
                    failed.push(`${rel}:\n    ${merged.errors.join('\n    ')}`);
                    continue;
                }
                const storyBlocks = ops.filter(o => o.kind === 'insert' && o.story);
                coverage.push({ rel, blocks: storyBlocks.length, manual: false });
                if (storyBlocks.length === 0) {
                    failed.push(`${rel}: 패치에 story 플래그 블록 없음 — 이야기형이 표준형과 동일합니다 (storyFile 선언이 무의미)`);
                    continue;
                }
                // 서사-본문 정합: 서사가 인용한 조문·수치가 본문에 없으면 경고 (BP-11)
                const storyLines = storyBlocks.flatMap(o => o.lines);
                findStoryInconsistencies(std, storyLines)
                    .forEach(w => consistency.push(`${rel}: 서사 인용 '${w}' — 표준형 본문에 없음`));
                // 이야기 회상: 본문과 일치하는 서사 속 사실 토큰 → 챕터 말미 빈칸형 항목 (BP-12)
                const recall = buildRecallSection(extractRecallItems(storyLines, std));
                const text = GEN_BANNER + '\n' + merged.text + recall;
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
        printCoverage(coverage);
        printConsistency(consistency);
        console.log('\n✅ 모든 이야기형이 패치와 일치합니다');
        return;
    }

    printCoverage(coverage);
    printConsistency(consistency);
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
