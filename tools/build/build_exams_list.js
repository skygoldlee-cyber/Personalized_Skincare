/**
 * tools/build/build_exams_list.js — content/exams.json → data/exams.js 번들 생성
 *
 * file:// 환경에서는 JSON fetch가 불가하므로 시험 레지스트리를
 * 클래식 스크립트 번들(window.EXAMS_LIST)로 발행한다.
 * 사용: node tools/build/build_exams_list.js  (build:data 체인에 포함)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'content', 'exams.json');
const OUT = path.join(ROOT, 'data', 'exams.js');
const MANIFEST_TEMPLATE = path.join(ROOT, 'manifest.webmanifest');

function main() {
    const exams = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
    if (!exams || !Array.isArray(exams.exams) || exams.exams.length === 0) {
        throw new Error('content/exams.json: exams 배열이 비어 있습니다');
    }
    const ids = new Set();
    exams.exams.forEach(e => {
        if (!e.id || !e.name) throw new Error('exams.json: 각 시험에는 id/name이 필요합니다');
        if (ids.has(e.id)) throw new Error(`exams.json: 중복 시험 id '${e.id}'`);
        ids.add(e.id);
        if (!e.contentRoot || !e.dataRoot) {
            throw new Error(`exams.json: '${e.id}'에 contentRoot/dataRoot가 필요합니다`);
        }
    });
    const js = '// 자동 생성된 시험 레지스트리 번들입니다. 수정하지 마십시오.\n' +
        '// 원본: content/exams.json (생성: node tools/build/build_exams_list.js)\n' +
        'var EXAMS_LIST = ' + JSON.stringify(exams, null, 2) + ';\n' +
        "if (typeof window !== 'undefined') { window.EXAMS_LIST = EXAMS_LIST; }\n" +
        "if (typeof module !== 'undefined' && module.exports) { module.exports = EXAMS_LIST; }\n";
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, js, 'utf-8');
    console.log(`✅ data/exams.js 생성 — 시험 ${exams.exams.length}개 (${[...ids].join(', ')})`);

    // 시험별 정적 PWA 매니페스트 생성 (manifest.<id>.webmanifest)
    // pwa-manifest.js가 활성 시험에 맞춰 링크를 이 실제 파일로 교체한다.
    // blob:/data: URL은 Chrome 설치 요건에서 유효하지 않은 스킴으로 판정되어
    // beforeinstallprompt가 발생하지 않으므로 반드시 실제 파일이어야 한다.
    const base = JSON.parse(fs.readFileSync(MANIFEST_TEMPLATE, 'utf-8'));
    const emitted = new Set();
    exams.exams.forEach(e => {
        const manifest = Object.assign({}, base, {
            id: e.id + '-pass',
            name: e.title || e.name,
            short_name: e.shortName || e.name,
            description: e.desc || base.description || ''
        });
        const fname = `manifest.${e.id}.webmanifest`;
        fs.writeFileSync(path.join(ROOT, fname), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
        emitted.add(fname);
    });
    // exams.json에서 제거된 시험의 stale 매니페스트 정리
    fs.readdirSync(ROOT).forEach(f => {
        if (/^manifest\..+\.webmanifest$/.test(f) && !emitted.has(f)) {
            fs.unlinkSync(path.join(ROOT, f));
            console.log(`  🗑 stale 매니페스트 제거: ${f}`);
        }
    });
    console.log(`✅ 시험별 매니페스트 생성 — ${emitted.size}개 (${[...emitted].join(', ')})`);
}

main();
