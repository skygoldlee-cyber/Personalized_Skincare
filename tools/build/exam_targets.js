// tools/build/exam_targets.js — 멀티시험 빌드 대상 해석 (공통 헬퍼)
// @spec BP-01,DA-06
//
// content/exams.json의 모든 시험을 빌드 대상으로 반환한다.
// 각 시험은 자신의 contentRoot/dataRoot를 가지며, manifest는
// {contentRoot}/manifest.json에서 읽는다.
const fs = require('fs');
const path = require('path');

/**
 * @param {string} workspaceDir 프로젝트 루트
 * @returns {Array<{id:string, contentRoot:string, dataRoot:string, manifestPath:string, manifest:object|null}>}
 */
function getExamTargets(workspaceDir) {
    const examsPath = path.join(workspaceDir, 'content', 'exams.json');
    if (!fs.existsSync(examsPath)) {
        throw new Error(`시험 레지스트리 없음: ${examsPath} (content/exams.json 필요)`);
    }
    const doc = JSON.parse(fs.readFileSync(examsPath, 'utf-8'));
    return (doc.exams || []).map(e => {
        const contentRoot = e.contentRoot || 'content';
        const dataRoot = e.dataRoot || 'data';
        const manifestPath = path.join(workspaceDir, contentRoot, 'manifest.json');
        return {
            id: e.id,
            isDefault: !!e.default,
            features: e.features || {},
            contentRoot,
            dataRoot,
            manifestPath,
            manifest: fs.existsSync(manifestPath)
                ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
                : null
        };
    });
}

/** 기본 시험(default:true, 없으면 첫 항목)의 루트 해석 — 레거시 도구용 */
function getDefaultExamRoots(workspaceDir) {
    const targets = getExamTargets(workspaceDir);
    const t = targets.find(x => x.isDefault) || targets[0];
    return t ? { contentRoot: t.contentRoot, dataRoot: t.dataRoot, id: t.id }
        : { contentRoot: 'content', dataRoot: 'data', id: 'cosmetic' };
}

/**
 * manifest에서 exam key → 과목번호(order)/과목키/과목명 매핑 생성.
 * 기존 하드코딩된 SUBJECT_NUM/SUBJECT_KEY/SUBJECT_TITLE 테이블 대체용.
 */
function getSubjectMaps(manifest) {
    const SUBJECT_NUM = {};
    const SUBJECT_KEY = {};
    const SUBJECT_TITLE = {};
    (manifest.exams || []).forEach(e => {
        const subj = (manifest.subjects || []).find(s => s.key === e.subject);
        if (subj) {
            SUBJECT_NUM[e.key] = subj.order;
            SUBJECT_TITLE[subj.order] = subj.name;
        }
        SUBJECT_KEY[e.key] = e.subject || e.key;
    });
    return { SUBJECT_NUM, SUBJECT_KEY, SUBJECT_TITLE };
}

/**
 * 모든 시험의 프리캐시 MD 자산 목록 ('./' 접두, 존재하는 파일만).
 * sw.js의 MD_ASSETS를 재생성하는 두 경로(build:index.js, sync_textbook_files.js)가
 * 동일 목록을 만들도록 공통 함수로 둔다.
 * 대상: {contentRoot}/docs/*.md 전체(정렬) + manifest 선언 교재(file/storyFile) + 문제은행(exams[].file)
 */
function getPrecacheMdAssets(workspaceDir) {
    const list = [];
    const push = rel => {
        if (fs.existsSync(path.join(workspaceDir, rel))) list.push(`./${rel}`);
    };
    for (const t of getExamTargets(workspaceDir)) {
        if (!t.manifest) continue;
        const docsDir = path.join(workspaceDir, t.contentRoot, 'docs');
        if (fs.existsSync(docsDir)) {
            for (const f of fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).sort()) {
                push(`${t.contentRoot}/docs/${f}`);
            }
        }
        for (const subj of t.manifest.subjects || []) {
            for (const ch of subj.chapters || []) {
                if (ch.file) push(`${t.contentRoot}/${subj.dir}/${ch.file}`);
                if (ch.storyFile) push(`${t.contentRoot}/${subj.dir}/${ch.storyFile}`);
            }
        }
        for (const exam of t.manifest.exams || []) {
            if (exam.file) push(`${t.contentRoot}/문제은행/${exam.file}`);
        }
    }
    return list;
}

/**
 * 모든 시험의 프리캐시 미디어 자산 목록 ('./' 접두, 존재하는 파일만, 정렬).
 * 대상: {contentRoot}/교재/<과목>/images/ 아래의 .webp 파일 전체.
 * 교재 본문이 참조하는 서빙 포맷은 .webp — .png는 원본 보관용(수 MB)으로
 * 프리캐시하면 설치 크기가 불필요하게 팽창하므로 제외한다.
 * 시험이 늘어나도 수동 나열 없이 프리캐시 대칭이 유지된다.
 */
function getPrecacheMediaAssets(workspaceDir) {
    const list = [];
    const MEDIA_EXT = new Set(['.webp']);
    for (const t of getExamTargets(workspaceDir)) {
        const root = path.join(workspaceDir, t.contentRoot, '교재');
        if (!fs.existsSync(root)) continue;
        const walk = (d) => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const p = path.join(d, e.name);
                if (e.isDirectory()) walk(p);
                else if (MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
                    list.push('./' + path.relative(workspaceDir, p).split(path.sep).join('/'));
                }
            }
        };
        walk(root);
    }
    return list.sort();
}

module.exports = { getExamTargets, getSubjectMaps, getDefaultExamRoots, getPrecacheMdAssets, getPrecacheMediaAssets };
