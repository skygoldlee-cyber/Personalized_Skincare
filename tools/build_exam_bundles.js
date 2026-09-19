#!/usr/bin/env node
/* ============================================================
 * tools/build_exam_bundles.js
 * ------------------------------------------------------------
 * content/exams/*.md (실전 예상문제집 원본)을 클래식 <script>로 불러올 수 있는
 * JS 번들로 굽는다. → file:// 로 index.html을 더블클릭해도 fetch 없이
 * 문제집을 열 수 있게 하기 위함.
 *
 * 입력 : content/문제은행/<manifest.json의 exams[].file>
 *        (manifest 미등록 MD — 설계 문서, 생성 산출물(*_합답형.md) 등 — 은 번들하지 않음)
 * 출력 : data/exams_md/<파일명>.js
 *        각 파일은 다음 형태로 전역에 등록한다.
 *          (window.__EXAM_MD__ = window.__EXAM_MD__ || {})["content/문제은행/<파일명>.md"] = "<마크다운>";
 *        키는 app.js의 ExamViewer.openExam('content/문제은행/...md') 과 정확히 일치한다.
 *
 * 사용 : node tools/build_exam_bundles.js
 *        (.md 를 수정하면 다시 실행할 것)
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'content', '문제은행');
const OUT_DIR = path.join(ROOT, 'data', 'exams_md');
const MANIFEST = path.join(ROOT, 'content', 'manifest.json');

const AUTOGEN_HEADER = '// 자동 생성된 문제집 번들입니다. 수정하지 마십시오. (tools/build_exam_bundles.js)';

function main() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error(`[build:exams] 원본 폴더가 없습니다: ${SRC_DIR}`);
        process.exit(1);
    }

    // manifest.json에 등록된 시험 파일만 번들한다.
    // 문제은행 폴더의 다른 MD(설계 문서, *_합답형.md 등 생성 산출물)는 뷰어 대상이 아니다.
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const examFiles = new Set((manifest.exams || []).map((e) => e.file));

    const mdFiles = fs.readdirSync(SRC_DIR)
        .filter((f) => f.toLowerCase().endsWith('.md') && examFiles.has(f))
        .sort();

    if (mdFiles.length === 0) {
        console.error(`[build:exams] manifest에 등록된 문제집 MD가 ${SRC_DIR} 에 없습니다.`);
        process.exit(1);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    let totalBytes = 0;
    const generated = [];

    for (const file of mdFiles) {
        const srcPath = path.join(SRC_DIR, file);
        const md = fs.readFileSync(srcPath, 'utf8');

        // openExam()에 넘어오는 경로와 정확히 동일한 키 (항상 POSIX 슬래시)
        const key = 'content/문제은행/' + file;

        // JSON.stringify 로 문자열 리터럴을 안전하게 생성
        //  → 따옴표/역슬래시/개행/유니코드/${ 등 모두 이스케이프 처리됨
        const body =
            AUTOGEN_HEADER + '\n' +
            `// 원본: content/문제은행/${file}\n` +
            '(window.__EXAM_MD__ = window.__EXAM_MD__ || {})[' +
            JSON.stringify(key) + '] = ' + JSON.stringify(md) + ';\n';

        const stem = file.replace(/\.md$/i, '');
        const outPath = path.join(OUT_DIR, stem + '.js');
        fs.writeFileSync(outPath, body, 'utf8');

        const bytes = Buffer.byteLength(body, 'utf8');
        totalBytes += bytes;
        generated.push({ file, out: path.relative(ROOT, outPath), kb: (bytes / 1024).toFixed(1) });
    }

    // manifest에서 빠진 파일의 stale 번들 정리
    const keep = new Set(mdFiles.map((f) => f.replace(/\.md$/i, '') + '.js'));
    for (const f of fs.readdirSync(OUT_DIR)) {
        if (f.endsWith('.js') && !keep.has(f)) {
            fs.unlinkSync(path.join(OUT_DIR, f));
            console.log(`  ✗ stale 번들 제거: ${f}`);
        }
    }

    console.log('[build:exams] 문제집 번들 생성 완료');
    for (const g of generated) {
        console.log(`  ✓ ${g.file}  →  ${g.out}  (${g.kb} KB)`);
    }
    console.log(`  총 ${generated.length}개, ${(totalBytes / 1024).toFixed(1)} KB`);
    console.log('  이후 content/exams/*.md 를 수정하면 이 스크립트를 다시 실행하세요.');
}

main();
