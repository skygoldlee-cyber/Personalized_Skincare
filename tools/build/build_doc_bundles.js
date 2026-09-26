#!/usr/bin/env node
/* ============================================================
 * tools/build/build_doc_bundles.js
 * ------------------------------------------------------------
 * docs/user/user_manual.md, content/study_summary.md (앱 내 표시 문서 원본)를
 * 클래식 <script>로 불러올 수 있는 JS 번들로 굽는다.
 * → file:// 로 index.html을 더블클릭핸들 때 fetch 없이 문서를 열 수 있게 하기 위함.
 *
 * 입력 : docs/user/user_manual.md, content/study_summary.md
 * 출력 : data/docs_md/<파일명>.js
 *        각 파일은 다음 형태로 전역에 등록한다.
 *          (window.__DOC_MD__ = window.__DOC_MD__ || {})["<경로>/<파일명>.md"] = "<마크다운>";
 *        키는 src/manual-viewer.js 의 MD_SOURCES[].path 와 정확히 일치한다.
 *
 * 사용 : node tools/build/build_doc_bundles.js
 *        (.md 를 수정하면 다시 실행할 것)
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam-targets');

const ROOT = path.resolve(__dirname, '..', '..');

// 앱 공용 문서 — 시험과 무관, 항상 data/docs_md/ 에 출력
// (src/manual-viewer.js 의 MD_SOURCES 와 동기화 유지)
const GLOBAL_DOCS = [
    { file: 'user_manual.md', dir: path.join(ROOT, 'docs', 'user'), key: 'docs/user/user_manual.md' },
    { file: 'formula_manual.md', dir: path.join(ROOT, 'docs', 'user'), key: 'docs/user/formula_manual.md' }
];

// 시험별 문서 — 각 시험의 {contentRoot}/ 아래 파일을 {dataRoot}/docs_md/ 에 출력.
// key는 contentPath() 결과와 동일해야 한다 ('{contentRoot}/학습안내서.md').
const EXAM_DOC_FILES = ['학습안내서.md', '두음법_암기_총정리.md'];

const AUTOGEN_HEADER = '// 자동 생성된 문서 번들입니다. 수정하지 마십시오. (tools/build/build_doc_bundles.js)';

function writeBundle(outDir, srcPath, key, file, generated) {
    const md = fs.readFileSync(srcPath, 'utf8');
    const body =
        AUTOGEN_HEADER + '\n' +
        `// 원본: ${key}\n` +
        '(window.__DOC_MD__ = window.__DOC_MD__ || {})[' +
        JSON.stringify(key) + '] = ' + JSON.stringify(md) + ';\n';
    const stem = file.replace(/\.md$/i, '');
    const outPath = path.join(outDir, stem + '.js');
    fs.writeFileSync(outPath, body, 'utf8');
    generated.push({ key, out: path.relative(ROOT, outPath), bytes: Buffer.byteLength(body, 'utf8') });
}

function main() {
    const generated = [];
    const missing = [];

    // 1) 앱 공용 문서 → data/docs_md/
    const globalOut = path.join(ROOT, 'data', 'docs_md');
    fs.mkdirSync(globalOut, { recursive: true });
    for (const doc of GLOBAL_DOCS) {
        const srcPath = path.join(doc.dir, doc.file);
        if (!fs.existsSync(srcPath)) { missing.push(doc.key); continue; }
        writeBundle(globalOut, srcPath, doc.key, doc.file, generated);
    }

    // 2) 시험별 문서 → {dataRoot}/docs_md/
    for (const target of getExamTargets(ROOT)) {
        const outDir = path.join(ROOT, target.dataRoot, 'docs_md');
        fs.mkdirSync(outDir, { recursive: true });
        for (const file of EXAM_DOC_FILES) {
            const srcPath = path.join(ROOT, target.contentRoot, file);
            const key = `${target.contentRoot}/${file}`;
            if (!fs.existsSync(srcPath)) { missing.push(key); continue; }
            writeBundle(outDir, srcPath, key, file, generated);
        }
    }

    let totalBytes = 0;
    console.log('[build:docs] 문서 번들 생성 완료');
    for (const g of generated) {
        totalBytes += g.bytes;
        console.log(`  ✓ ${g.key}  →  ${g.out}  (${(g.bytes / 1024).toFixed(1)} KB)`);
    }
    if (missing.length > 0) {
        console.warn(`  ⚠ 누락된 원본: ${missing.join(', ')}`);
    }
    console.log(`  총 ${generated.length}개, ${(totalBytes / 1024).toFixed(1)} KB`);
    console.log('  이후 원본 .md 를 수정하면 이 스크립트를 다시 실행하세요.');
}

main();
