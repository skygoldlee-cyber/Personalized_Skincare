#!/usr/bin/env node
/* ============================================================
 * tools/build/build_doc_bundles.js
 * ------------------------------------------------------------
 * docs/user/{user_manual,formula_manual}.md 와 각 시험 {contentRoot}/docs/*.md
 * (앱 내 표시 문서 원본, GLOBAL_DOCS·EXAM_DOC_FILES 참조)를
 * 클래식 <script>로 불러올 수 있는 JS 번들로 굽는다.
 * → file:// 로 index.html을 더블클릭핸들 때 fetch 없이 문서를 열 수 있게 하기 위함.
 *
 * 입력 : docs/user/*.md, content/exams/<id>/docs/*.md
 * 출력 : data/docs_md/<파일명>.js, {dataRoot}/docs_md/<파일명>.js
 *        각 파일은 다음 형태로 전역에 등록한다.
 *          (window.__DOC_MD__ = window.__DOC_MD__ || {})["<경로>/<파일명>.md"] = "<마크다운>";
 *        키는 src/manual-viewer.js 의 MD_SOURCES[].path 와 정확히 일치한다.
 *
 * 사용 : node tools/build/build_doc_bundles.js          # 번들 생성 (.md 수정 후 필수)
 *        node tools/build/build_doc_bundles.js --check  # 신선도 검증 — 번들이 원본과
 *                                                       # 다르면 exit 1 (check:content에 포함)
 *
 * 원본 마크다운은 번들에 임베드하기 전 CRLF/LF 개행을 정규화한다 — 작업트리
 * 개행 상태(autocrlf 등)가 번들 콘텐츠로 번지는 것을 방지.
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */

// @spec BP-01,MV-04
'use strict';

const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam_targets');

const ROOT = path.resolve(__dirname, '..', '..');

// 앱 공용 문서 — 시험과 무관, 항상 data/docs_md/ 에 출력
// (src/manual-viewer.js 의 MD_SOURCES 와 동기화 유지)
const GLOBAL_DOCS = [
    { file: 'user_manual.md', dir: path.join(ROOT, 'docs', 'user'), key: 'docs/user/user_manual.md' },
    { file: 'formula_manual.md', dir: path.join(ROOT, 'docs', 'user'), key: 'docs/user/formula_manual.md' }
];

// 시험별 문서 — 각 시험의 {contentRoot}/ 아래 파일을 {dataRoot}/docs_md/ 에 출력.
// key는 contentPath() 결과와 동일해야 한다 ('{contentRoot}/docs/학습안내서.md').
const EXAM_DOC_FILES = ['docs/학습안내서.md', 'docs/두음법_암기_총정리.md'];

const AUTOGEN_HEADER = '// 자동 생성된 문서 번들입니다. 수정하지 마십시오. (tools/build/build_doc_bundles.js)';

const IS_CHECK = process.argv.includes('--check');

const normEol = (s) => s.replace(/\r\n/g, '\n');

function bundleBody(srcPath, key) {
    const md = normEol(fs.readFileSync(srcPath, 'utf8'));
    return AUTOGEN_HEADER + '\n' +
        `// 원본: ${key}\n` +
        '(window.__DOC_MD__ = window.__DOC_MD__ || {})[' +
        JSON.stringify(key) + '] = ' + JSON.stringify(md) + ';\n';
}

function emitBundle(outDir, srcPath, key, file, generated, stale) {
    const body = bundleBody(srcPath, key);
    const stem = path.basename(file).replace(/\.md$/i, '');
    const outPath = path.join(outDir, stem + '.js');
    const rel = path.relative(ROOT, outPath);
    if (IS_CHECK) {
        const cur = fs.existsSync(outPath) ? normEol(fs.readFileSync(outPath, 'utf8')) : null;
        if (cur !== body) stale.push(rel);
    } else {
        fs.writeFileSync(outPath, body, 'utf8');
    }
    generated.push({ key, out: rel, bytes: Buffer.byteLength(body, 'utf8') });
}

function main() {
    const generated = [];
    const missing = [];
    const stale = [];

    // 1) 앱 공용 문서 → data/docs_md/
    const globalOut = path.join(ROOT, 'data', 'docs_md');
    if (!IS_CHECK) fs.mkdirSync(globalOut, { recursive: true });
    for (const doc of GLOBAL_DOCS) {
        const srcPath = path.join(doc.dir, doc.file);
        if (!fs.existsSync(srcPath)) { missing.push(doc.key); continue; }
        emitBundle(globalOut, srcPath, doc.key, doc.file, generated, stale);
    }

    // 2) 시험별 문서 → {dataRoot}/docs_md/
    for (const target of getExamTargets(ROOT)) {
        const outDir = path.join(ROOT, target.dataRoot, 'docs_md');
        if (!IS_CHECK) fs.mkdirSync(outDir, { recursive: true });
        for (const file of EXAM_DOC_FILES) {
            const srcPath = path.join(ROOT, target.contentRoot, file);
            const key = `${target.contentRoot}/${file}`;
            if (!fs.existsSync(srcPath)) { missing.push(key); continue; }
            emitBundle(outDir, srcPath, key, file, generated, stale);
        }
    }

    if (IS_CHECK) {
        console.log('[check:docs] 문서 번들 신선도 검증');
        for (const g of generated) console.log(`  ✓ ${g.out}`);
        if (missing.length > 0) console.warn(`  ⚠ 누락된 원본: ${missing.join(', ')}`);
        if (stale.length > 0) {
            console.error(`\n❌ 원본과 불일치 ${stale.length}건 — node tools/build/build_doc_bundles.js 실행 필요:`);
            for (const s of stale) console.error(`   - ${s}`);
            process.exit(1);
        }
        console.log(`\n✅ 문서 번들 ${generated.length}개가 원본과 일치합니다.`);
        return;
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
