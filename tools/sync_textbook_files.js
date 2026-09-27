#!/usr/bin/env node
/**
 * sync_textbook_files.js — 교재/문제은행 파일 ↔ manifest·sw.js·인용 경로 동기화
 *
 * 교재 변경 시 수동으로 맞춰야 했던 선언 지점을 파일시스템 스캔으로 자동 동기화한다.
 *
 * 동기화 대상:
 *   - manifest.json chapters[].file / storyFile
 *       ({contentRoot}/{subjects[].dir}/ 안의 *_표준형.md → file, *_이야기형.md → storyFile)
 *   - manifest.json exams[] — 문제은행/*.md 미등록 파일 자동 등록 (자동 생성 파일 제외)
 *   - sw.js MD_ASSETS — // MD_ASSETS:BEGIN/END 마커 사이를 manifest 선언으로 재생성
 *   - --rename: 교재/문제은행 파일명 변경을 manifest + sw.js + 콘텐츠 md 인용 경로에 전파
 *
 * manifest.json은 포맷 보존을 위해 전체 재직렬화하지 않고 부분 텍스트 치환으로 갱신한다
 * (치환 대상 문자열의 출현 횟수가 예상과 다르면 재직렬화로 폴백하고 경고를 남긴다).
 *
 * 자동화 불가(보고만): docSubjectRules·sourceRefMap 등 의미 판단 항목,
 *   glossary/number-drills 내용, 학습안내서 본문, #L 라인번호 재동기화(sync:citations 담당).
 *
 * 사용:
 *   node tools/sync_textbook_files.js           # 동기화 실행 (쓰기)
 *   node tools/sync_textbook_files.js --check   # 불일치 보고만 (exit 1 on drift)
 *   node tools/sync_textbook_files.js --rename <contentRoot 상대 구경로> <신경로>
 *       예: --rename 교재/law/OLD.md 교재/law/NEW.md
 */

// @spec none (콘텐츠 구조 동기화 도구)
const fs = require('fs');
const path = require('path');
const { getExamTargets, getPrecacheMdAssets } = require('./build/exam_targets.js');

const ROOT = path.resolve(__dirname, '..');
const SW_PATH = path.join(ROOT, 'sw.js');
const MD_BEGIN = '// MD_ASSETS:BEGIN';
const MD_END = '// MD_ASSETS:END';

const CHECK_ONLY = process.argv.includes('--check');
const renameIdx = process.argv.indexOf('--rename');
const RENAME = renameIdx >= 0
    ? { from: process.argv[renameIdx + 1], to: process.argv[renameIdx + 2] }
    : null;

const posix = p => p.split(path.sep).join('/');
const jstr = s => JSON.stringify(s); // JSON 문자열 리터럴 (이스케이프 일관)
const drift = [];   // 불일치/변경 보고
const manual = [];  // 자동화 불가 수동 작업 보고
const report = (target, kind, detail) => drift.push(`[${target}] ${kind}: ${detail}`);

/** 자동 생성 md 판별 (복수정답형 등 빌드 산출물) */
const isAutogen = abs => {
    try { return /자동 생성/.test(fs.readFileSync(abs, 'utf-8').slice(0, 600)); }
    catch { return false; }
};

/** dir 안의 직계 .md 파일 목록 */
function mdFilesIn(dirAbs) {
    if (!fs.existsSync(dirAbs)) return [];
    return fs.readdirSync(dirAbs).filter(f => f.endsWith('.md'));
}

/* ---------- manifest 포맷 보존 편집 ---------- */

/**
 * manifest.json에 부분 치환/삽입을 적용한다 (전체 재직렬화는 폴백).
 * @param edits [{search, replace}] — raw 텍스트에서 search의 출현 횟수가
 *        같은 search를 가진 편집 수와 일치할 때만 적용 (모호하면 폴백)
 * @param inserts [text] — "exams" 배열 끝에 삽입할 객체 블록 (들여쓰기 포함)
 */
function applyManifestEdits(target, edits, inserts) {
    const raw = fs.readFileSync(target.manifestPath, 'utf-8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    let out = raw;
    let ok = true;

    const grouped = new Map();
    for (const e of edits) {
        const g = grouped.get(e.search) || { search: e.search, replace: e.replace, expect: 0 };
        g.expect++;
        grouped.set(e.search, g);
    }
    for (const g of grouped.values()) {
        const occ = out.split(g.search).length - 1;
        if (occ !== g.expect) { ok = false; break; }
        out = out.split(g.search).join(g.replace);
    }
    if (ok) {
        for (const ins of inserts) {
            const ai = out.indexOf('"exams": [');
            const close = ai >= 0 ? out.indexOf(eol + '  ]', ai) : -1;
            if (close < 0) { ok = false; break; }
            out = out.slice(0, close) + ',' + eol + ins + out.slice(close);
        }
    }
    if (!ok) {
        manual.push(`[${target.id}] manifest.json: 부분 치환 모호 — 전체 재직렬화로 폴백 (포맷 재정렬됨)`);
        fs.writeFileSync(target.manifestPath, JSON.stringify(target.manifest, null, 2) + eol, 'utf-8');
        return;
    }
    if (out !== raw) fs.writeFileSync(target.manifestPath, out, 'utf-8');
}

/** 신규 exams[] 항목의 들여쓰기 블록 생성 (기존 4/6칸 스타일) */
function examEntryBlock(e, eol) {
    return [
        '    {',
        `      "key": ${jstr(e.key)},`,
        `      "subject": ${jstr(e.subject)},`,
        `      "part": ${e.part},`,
        `      "title": ${jstr(e.title)},`,
        `      "file": ${jstr(e.file)}`,
        '    }'
    ].join(eol);
}

/* ---------- manifest 동기화 ---------- */

/** 과목 dir에서 표준형/이야기형 파일 쌍을 해석 */
function scanTextbookDir(dirAbs) {
    const files = mdFilesIn(dirAbs).filter(f => !isAutogen(path.join(dirAbs, f)));
    const standard = files.filter(f => /_표준형\.md$/.test(f));
    const story = files.filter(f => /_이야기형\.md$/.test(f));
    return { standard, story, files };
}

function syncManifest(target) {
    const m = target.manifest;
    if (!m) return;
    const sroot = path.join(ROOT, target.contentRoot);
    const eol = fs.readFileSync(target.manifestPath, 'utf-8').includes('\r\n') ? '\r\n' : '\n';
    const edits = [], inserts = [];

    for (const s of m.subjects || []) {
        if (!s.dir) continue;
        const dirAbs = path.join(sroot, s.dir);
        const { standard, story } = scanTextbookDir(dirAbs);
        for (const ch of s.chapters || []) {
            // dir 안에 표준형이 정확히 1개면 file을 그걸로 동기화
            if (standard.length === 1 && ch.file !== standard[0]) {
                report(target.id, 'manifest', `chapters.file "${ch.file}" → "${standard[0]}" (${s.dir})`);
                edits.push({ search: `"file": ${jstr(ch.file)}`, replace: `"file": ${jstr(standard[0])}` });
                ch.file = standard[0];
            } else if (standard.length > 1) {
                manual.push(`[${target.id}] ${s.dir}: 표준형 후보 ${standard.length}개 — chapters[].file 수동 지정 필요 (${standard.join(', ')})`);
            }
            if (story.length === 1 && ch.storyFile !== story[0]) {
                report(target.id, 'manifest', `chapters.storyFile "${ch.storyFile}" → "${story[0]}" (${s.dir})`);
                edits.push({ search: `"storyFile": ${jstr(ch.storyFile)}`, replace: `"storyFile": ${jstr(story[0])}` });
                ch.storyFile = story[0];
            } else if (story.length > 1) {
                manual.push(`[${target.id}] ${s.dir}: 이야기형 후보 ${story.length}개 — chapters[].storyFile 수동 지정 필요`);
            }
        }
    }

    // 문제은행 — 과목N_ 접두로 subjects[].order와 매칭해 미등록 파일 자동 등록
    const bankDir = path.join(sroot, '문제은행');
    const declaredExams = new Set((m.exams || []).map(e => e.file).filter(Boolean));
    const declaredKeys = new Set((m.exams || []).map(e => e.key));
    const orderToSubject = {};
    for (const s of m.subjects || []) {
        if (Number.isFinite(s.order)) orderToSubject[s.order] = s;
    }
    for (const f of mdFilesIn(bankDir)) {
        const abs = path.join(bankDir, f);
        if (declaredExams.has(f) || isAutogen(abs)) continue;
        const numM = f.match(/^과목(\d+)_/);
        const subj = numM && orderToSubject[+numM[1]];
        if (!subj) {
            manual.push(`[${target.id}] 문제은행/${f}: 과목 번호로 subjects[].order를 못 찾음 — exams[] 수동 등록 필요`);
            continue;
        }
        const qCount = (fs.readFileSync(abs, 'utf-8').match(/\*\*Q\d+\./g) || []).length;
        let key = `subject${subj.order}`, n = 1;
        while (declaredKeys.has(key)) key = `subject${subj.order}_${++n}`;
        const entry = {
            key,
            subject: subj.key,
            part: 1,
            title: `${subj.name} (${qCount}제)`,
            file: f,
        };
        report(target.id, 'manifest', `exams[] 미등록 문제은행 등록: ${f} → ${subj.key} (${qCount}문)`);
        inserts.push(examEntryBlock(entry, eol));
        (m.exams = m.exams || []).push(entry);
        declaredKeys.add(key);
    }

    if (!edits.length && !inserts.length) return;
    if (!CHECK_ONLY) applyManifestEdits(target, edits, inserts);
}

/* ---------- sw.js MD_ASSETS 동기화 ---------- */

/** MD_ASSETS 기대 목록 — build:index.js와 동일 생성기(공통 함수)를 사용해 drift 없음을 보장 */
const expectedMdAssets = () => getPrecacheMdAssets(ROOT);

function syncSwAssets() {
    const src = fs.readFileSync(SW_PATH, 'utf-8');
    const bi = src.indexOf(MD_BEGIN), ei = src.indexOf(MD_END);
    if (bi < 0 || ei < 0 || bi > ei) {
        manual.push('[sw.js] MD_ASSETS:BEGIN/END 마커 없음 — 자동 동기화 불가, 수동 관리');
        return;
    }
    const expected = expectedMdAssets();
    const inner = src.slice(bi + MD_BEGIN.length, ei);
    const current = [...inner.matchAll(/'(.*?)'/g)].map(m => m[1]);
    const missing = expected.filter(p => !current.includes(p));
    const stale = current.filter(p => !expected.includes(p));
    for (const p of missing) report('sw.js', 'MD_ASSETS', `누락 ${p}`);
    for (const p of stale) report('sw.js', 'MD_ASSETS', `스테일 ${p}`);
    if (!missing.length && !stale.length) return;
    if (CHECK_ONLY) return;
    const block = '\n' + expected.map(p => `  '${p}',`).join('\n') + '\n  ';
    fs.writeFileSync(SW_PATH, src.slice(0, bi + MD_BEGIN.length) + block + src.slice(ei), 'utf-8');
}

/* ---------- --rename 전파 ---------- */

function applyRename(target, from, to) {
    const sroot = path.join(ROOT, target.contentRoot);
    const oldAbs = path.join(sroot, from);
    const newAbs = path.join(sroot, to);
    const oldBase = path.basename(from), newBase = path.basename(to);
    if (!fs.existsSync(oldAbs) && !fs.existsSync(newAbs)) return 0; // 이 시험 대상과 무관
    let touched = 0;

    // 1) 파일 이동
    if (fs.existsSync(oldAbs)) {
        fs.mkdirSync(path.dirname(newAbs), { recursive: true });
        fs.renameSync(oldAbs, newAbs);
        touched++;
        console.log(`  이동: ${posix(from)} → ${posix(to)}`);
    }

    // 2) manifest file/storyFile/exams.file — 포맷 보존 치환
    const m = target.manifest;
    const edits = [];
    for (const s of m.subjects || []) {
        const d = posix(s.dir || '');
        for (const ch of s.chapters || []) {
            for (const key of ['file', 'storyFile']) {
                if (ch[key] && `${d}/${ch[key]}` === posix(from)) {
                    edits.push({ search: `"${key}": ${jstr(ch[key])}`, replace: `"${key}": ${jstr(newBase)}` });
                    ch[key] = newBase; touched++;
                }
            }
        }
    }
    for (const e of m.exams || []) {
        if (`문제은행/${e.file || ''}` === posix(from)) {
            edits.push({ search: `"file": ${jstr(e.file)}`, replace: `"file": ${jstr(newBase)}` });
            e.file = newBase; touched++;
        }
    }
    if (edits.length) applyManifestEdits(target, edits, []);

    // 3) sw.js MD_ASSETS 경로 문자열
    const sw = fs.readFileSync(SW_PATH, 'utf-8');
    const oldSw = `./${posix(target.contentRoot)}/${posix(from)}`;
    const newSw = `./${posix(target.contentRoot)}/${posix(to)}`;
    if (sw.includes(oldSw)) {
        fs.writeFileSync(SW_PATH, sw.split(oldSw).join(newSw), 'utf-8');
        touched++;
    }

    // 4) 콘텐츠 md 내 인용 경로 치환 — basename 기준 상대경로를 재계산.
    //    #L 라인번호 프래그먼트는 그대로 보존 (라인 재동기화는 sync:citations 담당)
    const mdRoots = ['교재', '문제은행', 'docs'];
    const oldNameEnc = encodeURIComponent(oldBase);
    for (const sub of mdRoots) {
        const dirAbs = path.join(sroot, sub);
        if (!fs.existsSync(dirAbs)) continue;
        const walk = function* (d) {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const p = path.join(d, e.name);
                if (e.isDirectory()) yield* walk(p);
                else if (e.name.endsWith('.md')) yield p;
            }
        };
        for (const mdAbs of walk(dirAbs)) {
            if (mdAbs === newAbs) continue;
            const c = fs.readFileSync(mdAbs, 'utf-8');
            const relOld = posix(path.relative(path.dirname(mdAbs), oldAbs));
            const relNew = posix(path.relative(path.dirname(mdAbs), newAbs));
            let next = c.split(relOld).join(relNew);
            if (oldNameEnc !== oldBase && next.includes(oldNameEnc)) {
                next = next.split(oldNameEnc).join(encodeURIComponent(newBase));
            }
            if (next !== c) { fs.writeFileSync(mdAbs, next, 'utf-8'); touched++; }
        }
    }
    return touched;
}

/* ---------- main ---------- */

console.log('=== 교재/문제은행 파일 구조 동기화 ===\n');
if (CHECK_ONLY) console.log('[--check] 쓰기 없이 불일치만 보고합니다.\n');

const targets = getExamTargets(ROOT);

if (RENAME) {
    if (!RENAME.from || !RENAME.to) {
        console.error('사용법: --rename <contentRoot 상대 구경로> <신경로>');
        process.exit(2);
    }
    let touched = 0;
    for (const t of targets) touched += applyRename(t, RENAME.from, RENAME.to);
    console.log(`리네임 전파 완료 (${touched}개 지점). 이어서 일반 동기화를 실행합니다.\n`);
}

for (const t of targets) {
    syncManifest(t);
}
syncSwAssets();

if (drift.length) {
    console.log('=== 불일치/변경 내역 ===');
    for (const d of drift) console.log(`  • ${d}`);
    console.log(`\n총 ${drift.length}건`);
} else {
    console.log('드리프트 없음 — manifest↔디스크↔sw.js 일치.');
}

if (manual.length) {
    console.log('\n=== 수동 작업 필요 (자동화 불가) ===');
    for (const x of manual) console.log(`  ⚠ ${x}`);
}

if (CHECK_ONLY && drift.length) {
    console.log('\n❌ 구조 드리프트 감지 — node tools/sync_textbook_files.js 로 동기화하세요.');
    process.exit(1);
}
