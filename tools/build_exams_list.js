/**
 * tools/build_exams_list.js — content/exams.json → data/exams.js 번들 생성
 *
 * file:// 환경에서는 JSON fetch가 불가하므로 시험 레지스트리를
 * 클래식 스크립트 번들(window.EXAMS_LIST)로 발행한다.
 * 사용: node tools/build_exams_list.js  (build:data 체인에 포함)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'content', 'exams.json');
const OUT = path.join(ROOT, 'data', 'exams.js');

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
        '// 원본: content/exams.json (생성: node tools/build_exams_list.js)\n' +
        'var EXAMS_LIST = ' + JSON.stringify(exams, null, 2) + ';\n' +
        "if (typeof window !== 'undefined') { window.EXAMS_LIST = EXAMS_LIST; }\n" +
        "if (typeof module !== 'undefined' && module.exports) { module.exports = EXAMS_LIST; }\n";
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, js, 'utf-8');
    console.log(`✅ data/exams.js 생성 — 시험 ${exams.exams.length}개 (${[...ids].join(', ')})`);
}

main();
