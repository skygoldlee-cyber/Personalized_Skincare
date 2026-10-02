#!/usr/bin/env node
/**
 * check_test_first.js — 소스 변경 시 테스트 동반 강제 게이트 (Docs-First)
 *
 * 실행 로직(src/*.js, ref-pipeline/*.py)이 변경됐는데 테스트
 * (tests/, ref-pipeline/tests/)가 함께 변경되지 않으면 실패한다.
 * AGENTS.md의 "테스트 선행" 규칙을 작업 트리·push·CI 3층에서 구조적으로
 * 강제한다 — 머신·에이전트·기여자와 무관하게 동일하게 적용된다.
 *
 * 사용법:
 *   node tools/check/check_test_first.js            # 작업 트리(HEAD 대비) 검사
 *   node tools/check/check_test_first.js --staged   # 스테이징된 변경 검사
 *                                                   # (브랜치 내 기커밋 테스트도 인정)
 *   node tools/check/check_test_first.js --ref origin/main  # ref 대비 검사 (pre-push/CI)
 *
 * 우회:
 *   - 커밋 메시지 행 끝에 [no-test] 기재 — --ref 모드 전용, 그 커밋의 파일만 면제
 *   - 환경변수 SKIP_TESTFIRST=1 (모든 모드)
 *   - pre-commit: git commit --no-verify
 *
 * 범위 (의도적 제한):
 *   - 트리거: src/*.js · ref-pipeline/*.py — 실행 로직만. 마크업·스타일·
 *     설정·tools/ 체커는 테스트 의무가 과도하므로 제외 (docsync가 문서를 강제)
 *   - 인정: tests/ · ref-pipeline/tests/ — 기존 테스트 갱신도 인정
 *     ("테스트 작성 후 구현"의 순서는 커밋 분할로 표현 가능 — 범위 합산)
 */

// @spec none (테스트 선행 게이트)
const { execSync } = require('child_process');

// 테스트 동반을 요구하는 실행 로직 변경
const TRIGGERS = [
    /^src\/.+\.js$/,
    /^ref-pipeline\/.+\.py$/,
];

// 테스트 변경으로 인정하는 경로
const TESTS = [
    /^tests\//,
    /^ref-pipeline\/tests\//,
];

const BYPASS_MARK = '[no-test]';

const TRIGGER_HINTS = [
    { re: /^src\//, hint: 'tests/ (node --test) · tests/dom/ (Vitest) — DOM_TEST_DESIGN.md §구조' },
    { re: /^ref-pipeline\//, hint: 'ref-pipeline/tests/ (pytest — 순수 함수 단위)' },
];

function git(args) {
    // -c core.quotepath=false — 비ASCII(한글) 경로의 옥탈 이스케이프·인용 방지
    return execSync(`git -c core.quotepath=false ${args}`, { encoding: 'utf8' }).trim();
}

function isTrigger(file) {
    return TRIGGERS.some((re) => re.test(file)) && !TESTS.some((re) => re.test(file));
}
function isTest(file) {
    return TESTS.some((re) => re.test(file));
}

/** 파일 목록에서 트리거/테스트를 분류해 위반 여부를 판정한다. */
function analyze(files) {
    const triggers = files.filter(isTrigger);
    const tests = files.filter(isTest);
    return {
        triggers,
        tests,
        violated: triggers.length > 0 && tests.length === 0,
    };
}

function suggestTests(files) {
    const hints = new Set();
    for (const f of files) {
        for (const { re, hint } of TRIGGER_HINTS) {
            if (re.test(f)) hints.add(hint);
        }
    }
    return [...hints];
}

function listStaged() {
    return git('diff --cached --name-only').split('\n').filter(Boolean);
}

/** 브랜치에 이미 커밋된 테스트 변경 — "테스트 먼저 커밋 → 구현 커밋" 순서를 인정한다. */
function committedBranchFiles() {
    try {
        return git('diff --name-only origin/main...HEAD').split('\n').filter(Boolean);
    } catch {
        return []; // origin/main 부재(오프라인·신규 클론) — 스테이징분만 평가
    }
}

function listRange(ref) {
    // 커밋 단위 수집 — [no-test]는 그 커밋의 파일만 면제한다 (check_doc_sync와 동일 계약)
    const commits = git(`log --format=%H ${ref}..HEAD`).split('\n').filter(Boolean);
    const files = new Set();
    const exempted = [];
    for (const sha of commits) {
        const subject = git(`log -1 --format=%B ${sha}`);
        if (/\[no-test\]\s*$/m.test(subject)) {
            exempted.push(`${sha.slice(0, 7)} ${subject.split('\n')[0]}`);
            continue;
        }
        for (const f of git(`diff-tree --no-commit-id --name-only -r ${sha}`).split('\n').filter(Boolean)) {
            files.add(f);
        }
    }
    if (exempted.length) {
        console.log(`◇ ${BYPASS_MARK} 면제 커밋 ${exempted.length}개: ${exempted.join(' · ')}`);
    }
    return [...files];
}

/** git status --porcelain 한 줄에서 파일 경로를 추출한다. */
function parseStatusLine(line) {
    const path = line.replace(/^[A-Z?! ]{1,2} /, '').split(' -> ').pop();
    return path.replace(/^"|"$/g, '');
}

function listWorkingTree() {
    return git('status --porcelain').split('\n').filter(Boolean).map(parseStatusLine);
}

function run(mode, ref) {
    let files;
    if (mode === 'staged') {
        // 스테이징 ∪ 브랜치 기커밋 — 테스트를 먼저 커밋한 뒤 구현을 스테이징하는
        // Docs-First 커밋 분할을 통과시킨다
        files = [...new Set([...listStaged(), ...committedBranchFiles()])];
    } else if (mode === 'ref') {
        try {
            git(`rev-parse --verify ${ref}`);
        } catch {
            console.warn(`⚠️  ref '${ref}' 확인 불가 — 작업 트리 기준으로 검사합니다.`);
            files = listWorkingTree();
        }
        if (!files) files = listRange(ref);
    } else {
        // 작업 트리는 미커밋 변경만 본다 — 소스를 먼저 건드리면 테스트가
        // 생기기 전까지 실패하므로 작성 순서 자체를 강제한다
        files = listWorkingTree();
    }

    if (process.env.SKIP_TESTFIRST === '1') {
        console.log('✅ 테스트 선행 게이트 우회 — SKIP_TESTFIRST=1');
        return 0;
    }
    if (!files.length) {
        console.log('✅ 테스트 선행 게이트 통과 — 분석할 변경 없음');
        return 0;
    }

    const { triggers, tests, violated } = analyze(files);
    if (!triggers.length) {
        console.log(`✅ 테스트 선행 게이트 통과 — 실행 로직 변경 없음 (${files.length}개 파일)`);
        return 0;
    }
    if (!violated) {
        console.log(`✅ 테스트 선행 게이트 통과 — 로직 변경 ${triggers.length}개 + 테스트 변경 ${tests.length}개`);
        return 0;
    }

    console.error(`\n❌ 테스트 선행 게이트 실패 — 로직 ${triggers.length}개가 변경됐지만 테스트 변경이 없습니다:`);
    for (const f of triggers.slice(0, 15)) console.error(`   - ${f}`);
    if (triggers.length > 15) console.error(`   … 외 ${triggers.length - 15}개`);
    console.error('\n   Docs-First: 실패 테스트(재현/기대 동작)를 먼저 작성하세요. 후보:');
    for (const h of suggestTests(triggers)) console.error(`   - ${h}`);
    console.error(`\n   기존 테스트로 충분하면 커밋 메시지에 ${BYPASS_MARK} 를 넣거나 SKIP_TESTFIRST=1로 우회하세요.`);
    console.error('   (커밋 단계라면 git commit --no-verify 도 가능)\n');
    return 1;
}

function main(argv = process.argv.slice(2)) {
    let mode = 'worktree';
    let ref = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--staged') mode = 'staged';
        else if (argv[i] === '--ref') { mode = 'ref'; ref = argv[++i]; }
    }
    if (mode === 'ref' && !ref) {
        console.error('❌ --ref 뒤에 기준 ref를 지정하세요 (예: --ref origin/main)');
        return 1;
    }
    return run(mode, ref);
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check_test_first.js');
if (isDirectRun) {
    process.exit(main());
}

module.exports = { TRIGGERS, TESTS, BYPASS_MARK, isTrigger, isTest, analyze, parseStatusLine, run, main };
