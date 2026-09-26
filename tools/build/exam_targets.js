// tools/build/exam_targets.js — 멀티시험 빌드 대상 해석 (공통 헬퍼)
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

module.exports = { getExamTargets, getSubjectMaps, getDefaultExamRoots };
