#!/usr/bin/env node
/**
 * check_doc_sync.js — 소스 변경 시 관련 문서 갱신 강제 게이트
 *
 * 프로덕션 소스(src/tools/tests/css/설정 등)가 변경됐는데 관련 문서
 * (docs/, AGENTS.md, README.md)가 함께 갱신되지 않으면 실패한다.
 * "코드가 바뀌면 문서도 바뀐다"를 커밋·push·CI 3층에서 구조적으로 강제한다.
 *
 * 사용법:
 *   node tools/check/check_doc_sync.js            # 작업 트리(HEAD 대비) 검사
 *   node tools/check/check_doc_sync.js --staged   # 스테이징된 변경 검사 (pre-commit)
 *   node tools/check/check_doc_sync.js --ref origin/main  # ref 대비 브랜치 변경 검사 (pre-push/CI)
 *
 * 우회:
 *   - 커밋 메시지 행 끝에 [no-docs] 기재 — --ref 모드 전용, 그 커밋의 파일만 면제
 *     (pre-commit은 메시지가 아직 없어 불가 — SKIP_DOCSYNC=1 사용)
 *   - 환경변수 SKIP_DOCSYNC=1 (모든 모드)
 *   - pre-commit: git commit --no-verify
 *
 * 예외:
 *   - sw.js·data/ — deploy.js의 'CACHE_VERSION 스탬프' 자동 커밋 대상
 *   - content/ — 콘텐츠는 check:content 파이프라인·런북이 검증
 *   - ref-pipeline/ · vendor/ — 독립 도구함·서드파티 (자체 README로 충분)
 */

// @spec none (문서 동기화 게이트)
const { execSync } = require('child_process');

// 문서 갱신을 요구하는 변경 — 관련 문서가 스테일해질 수 있는 경로
const TRIGGERS = [
    /^src\//,
    /^tools\//,
    /^tests\//,
    /^css\//,
    /^html\//,
    /^\.github\//,
    /^\.githooks\//,
    /^(index\.html|index\.template\.html|style\.css|manifest\.webmanifest|vercel\.json|package(-lock)?\.json|jsconfig\.json|eslint\.config\.mjs|vitest\.config\.mjs|playwright\.config\.js|serve\.js|feature-plan\.json)$/,
];

// 트리거보다 우선 평가되는 제외 경로 — 자동 스탬프·생성물·독립 파이프라인·문서 자체
const EXEMPT = [
    /^sw\.js$/,              // deploy 스탬프 자동 커밋 대상
    /^data\//,               // 빌드·스탬프 산출물
    /^docs\//,               // 문서 자체
    /^AGENTS\.md$/, /^README\.md$/,
    /^content\//,            // 콘텐츠는 check:content 파이프라인이 검증
    /^ref-pipeline\//,       // 독립 도구함 — 자체 README
    /^vendor\//,             // 서드파티 자산
];

// 문서 갱신으로 인정하는 경로
const DOCS = [
    /^docs\//,
    /^AGENTS\.md$/,
    /(^|\/)README\.md$/,
];

const BYPASS_MARK = '[no-docs]';

// 변경 경로별로 갱신 후보 문서를 안내 (점검 편의 — 정확한 매핑보다 넓게 제시)
const DOC_HINTS = [
    { re: /^tests\/e2e|^playwright\.config/, hint: 'docs/dev/reference/TESTING.md §4.14 (E2E 계층)' },
    { re: /^tests\//, hint: 'docs/dev/reference/TESTING.md §3 (파일별 테스트 수·목록)' },
    { re: /^\.github\//, hint: 'docs/dev/reference/TESTING.md §7 · DEV_ENVIRONMENT.md (CI 절차)' },
    { re: /^\.githooks\//, hint: 'docs/dev/reference/DEV_ENVIRONMENT.md (훅 설명)' },
    { re: /^package\.json$|^tools\//, hint: 'AGENTS.md · docs/dev/reference/DEV_ENVIRONMENT.md (명령 표)' },
    { re: /^src\/views\//, hint: 'docs/dev/ARCHITECTURE.md (뷰 목록) · DOM_TEST_DESIGN.md' },
    { re: /^src\/|^css\/|^index\.html|^index\.template\.html|^html\//, hint: 'docs/dev/ARCHITECTURE.md · AGENTS.md (구조·규칙)' },
    { re: /vercel\.json|manifest\.webmanifest/, hint: 'docs/dev/ARCHITECTURE.md (배포·보안·PWA)' },
];

function git(args) {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
}

function isExempt(file) {
    return EXEMPT.some((re) => re.test(file));
}
function isTrigger(file) {
    return !isExempt(file) && TRIGGERS.some((re) => re.test(file));
}
function isDoc(file) {
    return DOCS.some((re) => re.test(file));
}

/** 파일 목록에서 트리거/문서를 분류해 위반 여부를 판정한다. */
function analyze(files) {
    const triggers = files.filter(isTrigger);
    const docs = files.filter(isDoc);
    return {
        triggers,
        docs,
        violated: triggers.length > 0 && docs.length === 0,
    };
}

function suggestDocs(files) {
    const hints = new Set(['docs/dev/CHANGES.md (변경 이력 — 항상)']);
    for (const f of files) {
        for (const { re, hint } of DOC_HINTS) {
            if (re.test(f)) hints.add(hint);
        }
    }
    return [...hints];
}

function listStaged() {
    return git('diff --cached --name-only').split('\n').filter(Boolean);
}
function listRange(ref) {
    // 커밋 단위 수집 — [no-docs]는 그 커밋의 파일만 면제한다 (범위 내 다른
    // 커밋까지 면제되던 부작용 방지). 문서 페어링은 범위 전체 합산 유지.
    const commits = git(`log --format=%H ${ref}..HEAD`).split('\n').filter(Boolean);
    const files = new Set();
    const exempted = [];
    for (const sha of commits) {
        const subject = git(`log -1 --format=%B ${sha}`);
        // 행 끝의 마크만 면제로 인정 — "… [no-docs]" 트레일러·독립 라인 허용,
        // 본문 한가운데 문법 설명으로 언급된 경우("[no-docs]는 …")는 오면제 방지
        if (/\[no-docs\]\s*$/m.test(subject)) {
            exempted.push(`${sha.slice(0, 7)} ${subject.split('\n')[0]}`);
            continue;
        }
        // diff-tree는 머지 커밋에서 빈 목록 반환 — 본 저장소는 선형 이력이 표준
        for (const f of git(`diff-tree --no-commit-id --name-only -r ${sha}`).split('\n').filter(Boolean)) {
            files.add(f);
        }
    }
    if (exempted.length) {
        console.log(`◇ ${BYPASS_MARK} 면제 커밋 ${exempted.length}개: ${exempted.join(' · ')}`);
    }
    return [...files];
}
/** git status --porcelain 한 줄에서 파일 경로를 추출한다.
 * 상태 열은 1~2글자+공백 — 출력 trim으로 첫 줄 선행 공백이 제거될 수 있어 slice(3) 부정확. */
function parseStatusLine(line) {
    const path = line.replace(/^[A-Z?! ]{1,2} /, '').split(' -> ').pop();
    return path.replace(/^"|"$/g, '');
}

function listWorkingTree() {
    // porcelain으로 신규(untracked) 파일도 포착 — diff HEAD는 미추적 파일을 놓침
    return git('status --porcelain').split('\n').filter(Boolean).map(parseStatusLine);
}
function run(mode, ref) {
    let files;
    if (mode === 'staged') {
        files = listStaged();
    } else if (mode === 'ref') {
        try {
            git(`rev-parse --verify ${ref}`);
        } catch {
            console.warn(`⚠️  ref '${ref}' 확인 불가 — 작업 트리 기준으로 검사합니다.`);
            files = listWorkingTree();
        }
        if (!files) files = listRange(ref);
    } else {
        files = listWorkingTree();
    }

    if (process.env.SKIP_DOCSYNC === '1') {
        console.log('✅ 문서 동기화 게이트 우회 — SKIP_DOCSYNC=1');
        return 0;
    }
    if (!files.length) {
        console.log('✅ 문서 동기화 게이트 통과 — 분석할 변경 없음');
        return 0;
    }

    const { triggers, docs, violated } = analyze(files);
    if (!triggers.length) {
        console.log(`✅ 문서 동기화 게이트 통과 — 문서 갱신 필요 대상 없음 (${files.length}개 파일)`);
        return 0;
    }
    if (!violated) {
        console.log(`✅ 문서 동기화 게이트 통과 — 소스 변경 ${triggers.length}개 + 문서 갱신 ${docs.length}개`);
        return 0;
    }

    console.error(`\n❌ 문서 동기화 게이트 실패 — 소스 ${triggers.length}개가 변경됐지만 문서 갱신이 없습니다:`);
    for (const f of triggers.slice(0, 15)) console.error(`   - ${f}`);
    if (triggers.length > 15) console.error(`   … 외 ${triggers.length - 15}개`);
    console.error('\n   갱신 후보 문서:');
    for (const h of suggestDocs(triggers)) console.error(`   - ${h}`);
    console.error(`\n   문서 변경이 불필요하면 커밋 메시지에 ${BYPASS_MARK} 를 넣거나 SKIP_DOCSYNC=1로 우회하세요.`);
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

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check_doc_sync.js');
if (isDirectRun) {
    process.exit(main());
}

module.exports = { TRIGGERS, EXEMPT, DOCS, BYPASS_MARK, isTrigger, isDoc, isExempt, analyze, parseStatusLine, run, main };
