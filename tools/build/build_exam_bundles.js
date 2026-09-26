// tools/build/build_exam_bundles.js — 문제은행 MD → {dataRoot}/exams_md/<stem>.js 번들 생성
// ============================================================
// 입력 : {contentRoot}/문제은행/<manifest.json의 exams[].file>
//        (manifest 미등록 MD — 설계 문서, 생성 산출물(*_복수정답형.md) 등 — 은 번들하지 않음)
// 출력 : {dataRoot}/exams_md/<stem>.js  (window.__EXAM_MD__["<contentRoot>/문제은행/<file>"] = "...")
//
// [멀티시험] content/exams.json의 모든 시험을 순회한다.
//   - 기본 시험(cosmetic): content/문제은행 → data/exams_md/
//   - 추가 시험: content/exams/<id>/문제은행 → data/exams/<id>/exams_md/
// file:// 환경에서는 fetch가 차단되므로 이 번들이 뷰어의 유일한 데이터 소스다.
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam_targets');

const ROOT = path.resolve(__dirname, '..', '..');
const AUTOGEN_HEADER = '// 자동 생성된 문제집 번들입니다. 수정하지 마십시오. (tools/build/build_exam_bundles.js)';

function buildForExam(target) {
    const SRC_DIR = path.join(ROOT, target.contentRoot, '문제은행');
    const OUT_DIR = path.join(ROOT, target.dataRoot, 'exams_md');

    if (!target.manifest) {
        console.warn(`[build:exams] ${target.id}: manifest 없음(${target.manifestPath}) — 건너뜀`);
        return;
    }
    if (!fs.existsSync(SRC_DIR)) {
        console.warn(`[build:exams] ${target.id}: 원본 폴더 없음(${SRC_DIR}) — 건너뜀`);
        return;
    }

    // manifest.json에 등록된 시험 파일만 번들한다.
    // 문제은행 폴더의 다른 MD(설계 문서, *_복수정답형.md 등 생성 산출물)는 뷰어 대상이 아니다.
    const examFiles = new Set((target.manifest.exams || []).map((e) => e.file));
    // 복수정답형 문제집(과목N_복수정답형.md 또는 exams[].comboFile)도 뷰어 대상
    (target.manifest.exams || []).forEach((e) => { if (e.comboFile) examFiles.add(e.comboFile); });
    for (const f of fs.readdirSync(SRC_DIR)) {
        if (/_복수정답형\.md$/i.test(f)) examFiles.add(f);
    }

    const mdFiles = fs.readdirSync(SRC_DIR)
        .filter((f) => f.toLowerCase().endsWith('.md') && examFiles.has(f))
        .sort();

    if (mdFiles.length === 0) {
        console.warn(`[build:exams] ${target.id}: manifest에 등록된 문제집 MD가 ${SRC_DIR} 에 없습니다 — 건너뜀`);
        return;
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    let totalBytes = 0;
    const generated = [];

    for (const file of mdFiles) {
        const srcPath = path.join(SRC_DIR, file);
        const md = fs.readFileSync(srcPath, 'utf8');

        // openExam()에 넘어오는 경로와 정확히 동일한 키 (항상 POSIX 슬래시, contentRoot 포함)
        const key = `${target.contentRoot}/문제은행/${file}`;

        // JSON.stringify 로 문자열 리터럴을 안전하게 생성
        //  → 따옴표/역슬래시/개행/유니코드/${ 등 모두 이스케이프 처리됨
        const body =
            AUTOGEN_HEADER + '\n' +
            `// 원본: ${key}\n` +
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

    console.log(`[build:exams] ${target.id} 문제집 번들 생성 완료 (${target.contentRoot} → ${target.dataRoot}/exams_md)`);
    for (const g of generated) {
        console.log(`  ✓ ${g.file}  →  ${g.out}  (${g.kb} KB)`);
    }
    console.log(`  총 ${generated.length}개, ${(totalBytes / 1024).toFixed(1)} KB`);
}

function main() {
    for (const target of getExamTargets(ROOT)) {
        buildForExam(target);
    }
}

main();
