#!/usr/bin/env node
/* ============================================================
 * tools/build_doc_bundles.js
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
 * 사용 : node tools/build_doc_bundles.js
 *        (.md 를 수정하면 다시 실행할 것)
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'docs_md');

// 번들로 구울 문서 목록 (src/manual-viewer.js 의 MD_SOURCES 와 동기화 유지)
// path: 원본 파일의 루트 상대 경로, key: manual-viewer.js MD_SOURCES[].path 와 동일
const DOC_FILES = [
    { file: 'user_manual.md', dir: path.join(ROOT, 'docs', 'user'), key: 'docs/user/user_manual.md' },
    { file: 'study_summary.md', dir: path.join(ROOT, 'content'), key: 'content/study_summary.md' }
];

const AUTOGEN_HEADER = '// 자동 생성된 문서 번들입니다. 수정하지 마십시오. (tools/build_doc_bundles.js)';

function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    let totalBytes = 0;
    const generated = [];
    const missing = [];

    for (const doc of DOC_FILES) {
        const srcPath = path.join(doc.dir, doc.file);
        if (!fs.existsSync(srcPath)) {
            missing.push(doc.key);
            continue;
        }
        const md = fs.readFileSync(srcPath, 'utf8');

        // manual-viewer.js MD_SOURCES[].path 와 정확히 동일한 키 (항상 POSIX 슬래시)
        const key = doc.key;

        // JSON.stringify 로 문자열 리터럴을 안전하게 생성
        const body =
            AUTOGEN_HEADER + '\n' +
            `// 원본: ${doc.key}\n` +
            '(window.__DOC_MD__ = window.__DOC_MD__ || {})[' +
            JSON.stringify(key) + '] = ' + JSON.stringify(md) + ';\n';

        const stem = doc.file.replace(/\.md$/i, '');
        const outPath = path.join(OUT_DIR, stem + '.js');
        fs.writeFileSync(outPath, body, 'utf8');

        const bytes = Buffer.byteLength(body, 'utf8');
        totalBytes += bytes;
        generated.push({ key: doc.key, out: path.relative(ROOT, outPath), kb: (bytes / 1024).toFixed(1) });
    }

    console.log('[build:docs] 문서 번들 생성 완료');
    for (const g of generated) {
        console.log(`  ✓ ${g.key}  →  ${g.out}  (${g.kb} KB)`);
    }
    if (missing.length > 0) {
        console.warn(`  ⚠ 누락된 원본: ${missing.join(', ')}`);
    }
    console.log(`  총 ${generated.length}개, ${(totalBytes / 1024).toFixed(1)} KB`);
    console.log('  이후 원본 .md 를 수정하면 이 스크립트를 다시 실행하세요.');
}

main();
