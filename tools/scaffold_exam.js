#!/usr/bin/env node
// tools/scaffold_exam.js — 신규 시험 팩 스캐폴더 (Phase B, MULTI_EXAM_DB_DESIGN §7)
// @spec ES-01,DA-06
//
// "새 시험 추가"의 1~3번 수동 단계를 1커맨드로 만든다:
//   ① content/exams/<id>/ 디렉터리 + 최소 manifest/references/샘플 콘텐츠
//   ② content/exams.json 엔트리 삽입
//   ③ 검증 안내 출력 (check:content -- --build 실행 방법)
//
// 사용:
//   node tools/scaffold_exam.js <id> --name "시험명" [--short-name X] [--year 2027]
//   node tools/scaffold_exam.js <id> --remove      # 골격 제거 (exams.json 엔트리 + 디렉터리)
//   node tools/scaffold_exam.js <id> --name ... --dry-run
//
// 생성물을 실제 시험으로 승격하려면 샘플 MD를 실제 교재·문제은행으로 교체하고
// manifest.json의 subjects/exams를 실제 과목 구성으로 수정한다.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXAMS_JSON = path.join(ROOT, 'content', 'exams.json');

const ID_RE = /^[a-z][a-z0-9_-]*$/;

function fail(msg) {
    console.error(`✗ ${msg}`);
    process.exit(1);
}

const VALUE_OPTS = new Set(['name', 'short-name', 'year']);

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) { args._.push(a); continue; }
        const eq = a.indexOf('=');
        if (eq !== -1) {
            args[a.slice(2, eq).replace(/-/g, '_')] = a.slice(eq + 1);
        } else {
            const key = a.slice(2);
            args[key.replace(/-/g, '_')] = VALUE_OPTS.has(key) ? argv[++i] : true;
        }
    }
    return args;
}

function loadExams() {
    return JSON.parse(fs.readFileSync(EXAMS_JSON, 'utf-8'));
}

function writeJson(file, obj) {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

function registryGlobalFor(id) {
    return `DATA_REGISTRY_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

// ── 템플릿 ──────────────────────────────────────────────────────────────

function manifestTemplate(id, name, year) {
    return {
        schemaVersion: 1,
        contentYear: String(year),
        subjects: [{
            key: 'subject1',
            order: 1,
            name: `${name} 1과목`,
            shortName: '1과목',
            dir: '교재/subject1',
            chapters: [{ key: 'full', title: `${name} 1과목 (전체)`, file: '1과목_개요.md' }]
        }],
        exams: [{
            key: 'exam1',
            subject: 'subject1',
            part: 1,
            title: `${name} 1과목 (예시 3제)`,
            file: '과목1_문제은행.md'
        }],
        integratedExam: {
            questionsPerSubject: { subject1: 3 },
            examTimeMin: 30,
            passAverage: 60,
            subjectFailBelow: 40
        },
        uiText: {
            dictionary: { title: '지식DB 사전', subtitle: '엔티티 검색 (manifest.knowledge 스키마 필요)' }
        }
    };
}

function referencesTemplate() {
    return {
        schemaVersion: 1,
        _comment: '참조자료 매핑 설정. lawRefs: content/lawdb.json의 법령 id 목록 (나열 순서 = 매칭 우선순위). noticeCore: 고시 감시 배너의 기준 문서명. 자세한 구조는 design/MULTI_EXAM_DB_DESIGN.md §4',
        lawRefs: [],
        noticeCore: null,
        subjectDefaultRefdoc: {},
        subjectDirMap: {},
        docSubjectRules: [],
        multiSubjectDocs: [],
        refDirs: [],
        referenceLaw: []
    };
}

function textbookSample(name) {
    return `# 📕 1과목 ${name} 개요

> 이 파일은 \`tools/scaffold_exam.js\`가 생성한 플레이스홀더입니다. 실제 교재 내용으로 교체하세요.

## Chapter 01. 시험 개요

### 1. 과목 소개

- 이 시험은 스캐폴더로 추가되었습니다. \`manifest.json\`의 subjects/exams를 실제 과목 구성으로 수정하세요.
- 법령 참조가 있다면 \`content/lawdb.json\`에 엔트리를 추가하고 \`references.json\`의 \`lawRefs\`에 id를 나열하세요.
`;
}

function examSample() {
    return `# 1과목 예시 문제은행

> 스캐폴드 생성 샘플 — 실제 문제은행으로 교체하세요.

## 📝 [1부: 객관식 5지선다형]

### Q1. 이 시험의 스캐폴드가 생성한 샘플 문항입니다. 정답은?
① 첫 번째 선택지
② 두 번째 선택지
③ 세 번째 선택지
④ 네 번째 선택지
⑤ 다섯 번째 선택지

---

### Q2. 샘플 문항 2입니다. 옳은 것은?
① 가
② 나
③ 다
④ 라
⑤ 마

---

### Q3. 샘플 문항 3입니다. 옳지 않은 것은?
① 가
② 나
③ 다
④ 라
⑤ 마

---

## 🔑 정답 및 해설

**Q1.**

> **정답: ②**

**Q2.**

> **정답: ①**

**Q3.**

> **정답: ⑤**
`;
}

function examsEntry(id, name, shortName, year) {
    return {
        id,
        name,
        shortName: shortName || name,
        title: `Passmula — ${name}`,
        logoMain: 'Pass',
        logoSub: 'mula',
        desc: `${name} — scaffold 생성 골격 (콘텐츠 교체 필요)`,
        icon: 'fa-solid fa-book',
        year: String(year),
        contentRoot: `content/exams/${id}`,
        dataRoot: `data/exams/${id}`,
        manifestPath: `content/exams/${id}/manifest.json`,
        registryBundle: `data/exams/${id}/registry.js`,
        registryGlobal: registryGlobalFor(id),
        features: {}
    };
}

// ── 생성 / 제거 ─────────────────────────────────────────────────────────

function scaffold(id, opts) {
    const doc = loadExams();
    if (doc.exams.some(e => e.id === id)) fail(`이미 등록된 시험 id: ${id}`);
    const name = opts.name;
    if (!name) fail('--name "시험명" 필수');
    const year = opts.year || new Date().getFullYear() + 1;

    const contentDir = path.join(ROOT, 'content', 'exams', id);
    if (fs.existsSync(contentDir) && !opts.force) {
        fail(`${contentDir} 이미 존재 — --force로 덮어쓰거나 --remove 후 재실행`);
    }

    const files = [
        [path.join(contentDir, 'manifest.json'), JSON.stringify(manifestTemplate(id, name, year), null, 2) + '\n'],
        [path.join(contentDir, 'references.json'), JSON.stringify(referencesTemplate(), null, 2) + '\n'],
        [path.join(contentDir, '교재', 'subject1', '1과목_개요.md'), textbookSample(name)],
        [path.join(contentDir, '문제은행', '과목1_문제은행.md'), examSample()],
    ];
    // notice_status.json은 고시 감시 첫 --update 실행 시 루트에 생성되므로 디렉터리 불요
    const dirs = [
        'docs', '참조자료', 'knowledge',
    ].map(d => path.join(contentDir, d));

    if (opts.dry_run) {
        console.log('[dry-run] 생성 예정:');
        files.forEach(([f]) => console.log('  +', path.relative(ROOT, f)));
        dirs.forEach(d => console.log('  +', path.relative(ROOT, d) + '/'));
        console.log('  ~ content/exams.json — 엔트리 추가:', id);
        return;
    }

    dirs.concat(files.map(([f]) => path.dirname(f))).forEach(d => fs.mkdirSync(d, { recursive: true }));
    files.forEach(([f, c]) => fs.writeFileSync(f, c, 'utf-8'));

    doc.exams.push(examsEntry(id, name, opts.short_name, year));
    writeJson(EXAMS_JSON, doc);

    console.log(`✓ 시험 골격 생성: ${id}`);
    console.log(`  contentRoot: content/exams/${id}`);
    console.log(`  registryGlobal: ${registryGlobalFor(id)}`);
    console.log('');
    console.log('다음 단계:');
    console.log('  1. 샘플 MD를 실제 교재·문제은행으로 교체하고 manifest.json 수정');
    console.log('  2. (법령 시험이면) content/lawdb.json에 법령 추가 + references.json.lawRefs 나열 → npm.cmd run build:pdf-registry');
    console.log('  3. npm.cmd run check:content -- --build  (빌드 + 통합 검증)');
    console.log(`  4. 되돌리려면: node tools/scaffold_exam.js ${id} --remove`);
}

function remove(id) {
    const doc = loadExams();
    const idx = doc.exams.findIndex(e => e.id === id);
    if (idx === -1) fail(`exams.json에 없는 시험 id: ${id}`);
    const entry = doc.exams[idx];
    if (entry.default) fail('기본 시험은 제거할 수 없습니다');

    const dirs = [
        path.join(ROOT, 'content', 'exams', id),
        path.join(ROOT, 'data', 'exams', id),
    ];
    for (const d of dirs) {
        if (fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
            console.log(`  - ${path.relative(ROOT, d)}/`);
        }
    }
    doc.exams.splice(idx, 1);
    writeJson(EXAMS_JSON, doc);
    console.log(`✓ 시험 제거: ${id}`);
}

// ── main ────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const id = args._[0];
if (!id) {
    console.log('사용: node tools/scaffold_exam.js <id> --name "시험명" [--short-name X] [--year YYYY] [--dry-run|--force|--remove]');
    process.exit(1);
}
if (!ID_RE.test(id)) fail(`시험 id는 ${ID_RE} 형식이어야 합니다: ${id}`);

if (args.remove) remove(id); else scaffold(id, args);
