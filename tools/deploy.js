#!/usr/bin/env node
/**
 * tools/deploy.js — 안전한 Vercel 배포 가드
 *
 * `vercel --prod`는 git을 거치지 않고 로컬 파일을 직접 업로드하므로,
 * 미푸시 커밋/미커밋 변경이 그대로 프로덕션에 올라가는 사고를 막기 위한 래퍼.
 *
 * 순서:
 *   1) main 브랜치 + 작업 트리 clean + origin/main 동기화 검사
 *   2) sw.js CACHE_VERSION 스탬프 (stamp-sw-version.js)
 *      → 값이 바뀌면 'chore(sw): CACHE_VERSION 스탬프' 자동 커밋 + push
 *   3) vercel --prod --yes 실행
 *
 * 차단 조건:
 *   - 커밋되지 않은 변경이 있는 경우 (untracked 포함)
 *   - origin/main 에 없는 로컬 커밋이 있는 경우 (unpushed)
 *   - origin/main 보다 뒤처진 경우 (push 전 pull 필요)
 *   - 스탬프 커밋/push 실패
 *
 * 사용: npm run deploy
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { stampSwVersion } = require('./build/stamp-sw-version.js');
const { stampReleaseNotes } = require('./build/stamp-release-notes.js');

// 팀 프로젝트는 개인 계정 기본 스코프로는 배포가 거부되므로(Not authorized),
// .vercel/project.json의 orgId를 --scope로 명시한다. 개인 프로젝트(orgId 없음)면 생략.
function vercelScopeArgs() {
    try {
        const p = path.join(__dirname, '..', '.vercel', 'project.json');
        const { orgId } = JSON.parse(fs.readFileSync(p, 'utf8'));
        return orgId ? ['--scope', orgId] : [];
    } catch {
        return [];
    }
}

function git(args) {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
}

function fail(msg) {
    console.error(`\n❌ 배포 차단: ${msg}\n`);
    process.exit(1);
}

function main() {
    // 최신 원격 상태 반영 (실패해도 계속 — 오프라인이면 아래 비교가 로컬 기준으로 동작)
    try {
        git('fetch origin main --quiet');
    } catch {
        console.warn('⚠️  git fetch 실패 — 로컬에 기록된 origin/main 기준으로 검사합니다.');
    }

    const branch = git('rev-parse --abbrev-ref HEAD');
    if (branch !== 'main') {
        fail(`현재 브랜치가 '${branch}' 입니다. main 브랜치에서만 배포하세요.`);
    }

    // 작업 트리 오염 검사
    const dirty = git('status --porcelain');
    if (dirty) {
        console.error(dirty);
        fail('커밋되지 않은 변경이 있습니다. 커밋 후 배포하세요.');
    }

    // 미푸시 커밋 검사
    const unpushed = git('rev-list --count origin/main..HEAD');
    if (parseInt(unpushed, 10) > 0) {
        fail(`원격에 없는 로컬 커밋 ${unpushed}개가 있습니다. 'git push' 후 배포하세요.`);
    }

    // 원격보다 뒤처짐 검사
    const behind = git('rev-list --count HEAD..origin/main');
    if (parseInt(behind, 10) > 0) {
        fail(`origin/main 보다 ${behind}개 커밋 뒤처져 있습니다. 'git pull' 후 배포하세요.`);
    }

    console.log('✅ 배포 전 검사 통과 (main · clean · origin/main 동기화)');

    // 콘텐츠 품질 게이트 — 콤보 감사 오류(무결성·회귀)가 있으면 배포 차단.
    // 경고는 통과시키되 리포트는 combo_audit_report.json에 남는다.
    const audit = spawnSync('node', ['tools/audit_combo.js'], { encoding: 'utf8' });
    if (audit.status !== 0) {
        process.stdout.write(audit.stdout || '');
        process.stderr.write(audit.stderr || '');
        fail('audit:combo 품질 게이트 실패 — 오류 해소 후 배포하세요.');
    }
    console.log('✅ 콤보 품질 게이트 통과');

    // sw.js CACHE_VERSION + 앱 버전/릴리스 노트 스탬프 — 바뀌면 자동 커밋 + push
    const stamp = stampSwVersion();
    if (stamp.changed) {
        // data/version.js를 동일 버전으로 갱신하고, pending 노트를 확정
        // (pending이 없으면 커밋 subject로 자동 초안 — 배포 전 notes:draft로 편집 권장)
        stampReleaseNotes({ version: stamp.newValue, prevVersion: stamp.oldValue });
        try {
            git('add sw.js data/version.js data/release-notes.js data/release-notes.json');
            git('commit -m "chore(sw): CACHE_VERSION 스탬프" --quiet');
            git('push origin main --quiet');
        } catch (e) {
            fail(`스탬프 커밋/푸시 실패: ${e.message}`);
        }
        const stillUnpushed = git('rev-list --count origin/main..HEAD');
        if (parseInt(stillUnpushed, 10) > 0) {
            fail('스탬프 커밋이 push되지 않았습니다. 수동으로 확인하세요.');
        }
        console.log(`✅ sw.js 스탬프 커밋·푸시 완료 (${stamp.newValue})\n`);
    }

    const result = spawnSync('vercel', ['--prod', '--yes', ...vercelScopeArgs()], {
        stdio: 'inherit',
        shell: true,
    });
    process.exit(result.status ?? 1);
}

main();
