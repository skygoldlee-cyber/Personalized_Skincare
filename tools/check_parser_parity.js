#!/usr/bin/env node
/* tools/check_parser_parity.js
 * 빌드 파서(tools/build/plugins/textbook.plugin.js)와
 * 런타임 파서(src/textbook-parser.js)가 동일한 content/*.md 에 대해
 * 바이트 단위로 동일한 {name, cards, quizzes, chapters}를 만드는지 검증한다.
 *
 * 두 파서 중 하나만 규칙이 바뀌면 이 검사가 실패하여 조용한 분기(진도 ID 어긋남 등)를 막는다.
 * 별도 정답 파일에 의존하지 않고 두 구현을 직접 대조하므로 콘텐츠가 바뀌어도 유효하다.
 *
 * 사용:  node tools/check_parser_parity.js   (npm run check:parser)
 * 종료코드: 일치 0 / 불일치 1
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const plugin = require('./build/plugins/textbook.plugin.js');
const idFactory = require('./build/id-factory.js');

function readManifest() {
    const p = path.join(ROOT, 'content', 'manifest.json');
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function firstDiff(aArr, bArr, label) {
    const n = Math.max(aArr.length, bArr.length);
    if (aArr.length !== bArr.length) {
        return `${label} 개수 불일치: build=${aArr.length} runtime=${bArr.length}`;
    }
    for (let i = 0; i < n; i++) {
        const a = JSON.stringify(aArr[i]);
        const b = JSON.stringify(bArr[i]);
        if (a !== b) {
            return `${label}[${i}] 불일치\n    build   : ${a}\n    runtime : ${b}`;
        }
    }
    return null;
}

async function main() {
    // 런타임 파서는 ESM (src/package.json: type=module) → 동적 import 로 로드
    const { buildSubjectData } = await import('../src/textbook-parser.js');

    const manifest = readManifest();
    let allOk = true;
    const summary = [];

    for (const subject of manifest.subjects) {
        // 1) 빌드 파서
        const buildData = plugin.build(subject, { workspaceDir: ROOT, idFactory });

        // 2) 런타임 파서 (filePath 확장자까지 맞추기 위해 html 모드 사용)
        const mdByFile = {};
        for (const ch of subject.chapters) {
            mdByFile[ch.file] = fs.readFileSync(
                path.join(ROOT, 'content', subject.dir, ch.file), 'utf-8'
            );
        }
        const runtimeData = buildSubjectData(subject, mdByFile, { filePathMode: 'html' });

        // 3) 대조
        const problems = [];
        if (buildData.name !== runtimeData.name) {
            problems.push(`name 불일치: build="${buildData.name}" runtime="${runtimeData.name}"`);
        }
        const dc = firstDiff(buildData.cards, runtimeData.cards, 'cards');
        if (dc) problems.push(dc);
        const dq = firstDiff(buildData.quizzes, runtimeData.quizzes, 'quizzes');
        if (dq) problems.push(dq);
        const dch = firstDiff(buildData.chapters, runtimeData.chapters, 'chapters');
        if (dch) problems.push(dch);

        const ok = problems.length === 0;
        allOk = allOk && ok;
        summary.push(
            `  ${ok ? '✓' : '✗'} ${subject.key.padEnd(14)} ` +
            `cards ${buildData.cards.length} · quizzes ${buildData.quizzes.length} · chapters ${buildData.chapters.length}`
        );
        if (!ok) {
            summary.push('    ' + problems.join('\n    '));
        }
    }

    console.log('교재 파서 등가성 검사 (build plugin ↔ runtime parser)');
    console.log(summary.join('\n'));

    if (allOk) {
        console.log('\n✅ 두 파서 출력이 완전히 일치합니다.');
        process.exit(0);
    } else {
        console.error('\n❌ 파서 분기 감지 — tools/build/plugins/textbook.plugin.js 와 src/textbook-parser.js 를 동기화하세요.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('파서 등가성 검사 중 오류:', err);
    process.exit(1);
});
