#!/usr/bin/env node
/* tools/build_study_md_bundle.js
 * file:// 실행용 폴백 번들 생성 (과목별 분할 버전).
 *
 * 기존에는 모든 MD 원문을 단일 study_md.js (513KB)에 인라인했으나,
 * 과목별로 분할하여 사용자가 해당 과목만 로드하도록 최적화했다.
 *
 * 출력:
 *   data/study_md/manifest.js       — manifest JSON (~3KB)
 *   data/study_md/{subjectKey}.js   — 과목별 MD 원문 (~100-200KB each)
 *
 * http(s) 배포에서는 content/*.md 를 직접 fetch 하므로 이 번들이 불필요하지만,
 * 로컬 파일(file://) 실행 시에는 fetch가 차단되어 이 폴백이 사용된다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'content', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const outDir = path.join(ROOT, 'data', 'study_md');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// 1) manifest.js 생성
const manifestOut = `// 자동 생성된 file:// 폴백 manifest입니다. 수정하지 마십시오.
// 생성: tools/build_study_md_bundle.js  |  ${new Date().toISOString()}
window.__STUDY_MD_MANIFEST__ = ${JSON.stringify(manifest)};
`;
fs.writeFileSync(path.join(outDir, 'manifest.js'), manifestOut, 'utf-8');

// 2) 과목별 MD 파일 번들 생성
let totalCount = 0;
const subjectKeys = [];
for (const subj of manifest.subjects) {
    const files = {};
    let count = 0;
    for (const ch of subj.chapters) {
        const rel = `content/${subj.dir}/${ch.file}`;
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) throw new Error(`Missing MD file: ${rel}`);
        files[rel] = fs.readFileSync(abs, 'utf-8');
        count++;
    }
    totalCount += count;
    subjectKeys.push(subj.key);

    const subjOut = `// 자동 생성된 file:// 폴백 번들 (${subj.key})입니다. 수정하지 마십시오.
// 생성: tools/build_study_md_bundle.js  |  ${new Date().toISOString()}
window.__STUDY_MD_FILES__ = window.__STUDY_MD_FILES__ || {};
window.__STUDY_MD_FILES__['${subj.key}'] = ${JSON.stringify(files)};
`;
    const subjPath = path.join(outDir, `${subj.key}.js`);
    fs.writeFileSync(subjPath, subjOut, 'utf-8');
    const kb = (Buffer.byteLength(subjOut, 'utf-8') / 1024).toFixed(0);
    console.log(`  ✓ data/study_md/${subj.key}.js — ${count}개 MD, ${kb}KB`);
}

// 3) 기존 단일 파일 삭제 (레거시 호환: 남겨두지 않음)
const oldPath = path.join(ROOT, 'data', 'study_md.js');
if (fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
    console.log('  ✓ 기존 data/study_md.js 삭제 (과목별 분할로 대체)');
}

const manifestKb = (Buffer.byteLength(manifestOut, 'utf-8') / 1024).toFixed(0);
console.log(`✓ data/study_md/ 생성 완료 — ${manifest.subjects.length}과목, ${totalCount}개 MD`);
console.log(`  manifest.js: ${manifestKb}KB + 과목별 분할 파일 (합산 시 기존 513KB → 동일하나 lazy-load 가능)`);
