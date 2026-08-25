#!/usr/bin/env node
/* tools/build_study_md_bundle.js
 * file:// 실행용 폴백 번들 생성.
 * content/manifest.json + 모든 content MD 원문을 window.__STUDY_MD__ 로 인라인한다.
 * http(s) 배포에서는 런타임이 content/*.md 를 직접 fetch 하므로 이 번들이 불필요하지만,
 * 로컬 파일(file://) 실행 시에는 fetch가 차단되어 이 폴백이 사용된다.
 * (exam-viewer의 data/exams_md/*.js 와 동일한 file:// 대응 패턴)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'content', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const files = {};
let count = 0;
for (const subj of manifest.subjects) {
    for (const ch of subj.chapters) {
        const rel = `content/${subj.dir}/${ch.file}`;
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) throw new Error(`Missing MD file: ${rel}`);
        files[rel] = fs.readFileSync(abs, 'utf-8');
        count++;
    }
}

const payload = { manifest, files };
const out = `// 자동 생성된 file:// 폴백 번들입니다. 수정하지 마십시오.
// 생성: tools/build_study_md_bundle.js  |  ${new Date().toISOString()}
// http(s)에서는 content/*.md 를 직접 fetch하므로 이 파일이 사용되지 않습니다.
window.__STUDY_MD__ = ${JSON.stringify(payload)};
`;

const outPath = path.join(ROOT, 'data', 'study_md.js');
fs.writeFileSync(outPath, out, 'utf-8');
const kb = (Buffer.byteLength(out, 'utf-8') / 1024).toFixed(0);
console.log(`✓ data/study_md.js 생성 완료 — ${manifest.subjects.length}과목, ${count}개 MD, ${kb}KB`);
