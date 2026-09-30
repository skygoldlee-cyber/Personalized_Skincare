// tools/build/build_pdf_registry.js
// @spec BP-01,RR-13,RR-17
// {contentRoot}/references.json → src/pdf-registry.js 자동 생성 (content/exams.json의 모든 시험 순회)
// content/lawdb.json + references.json(lawRefs) → src/law-links.js 자동 생성 (같은 실행)
// 참조자료 추가/삭제/변경 시 해당 시험의 references.json만, 법령 링크는 lawdb.json만 수정하면 됨.
//
// [멀티시험] 시험별 테이블은 _EXAM_TABLES[examId]에 담기고, 런타임 접근은
//   getRefTables()가 활성 시험을 해석한다(없으면 기본 시험으로 폴백).
//   파생 경로(REF_FILE_TO_PATH)는 각 시험의 contentRoot로 계산된다.
const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam_targets.js');
const { docSubject } = require('./ref_statements.js');

const WORKSPACE_DIR = path.resolve(__dirname, '..', '..');
const outPath = path.join(WORKSPACE_DIR, 'src', 'pdf-registry.js');
const lawLinksOutPath = path.join(WORKSPACE_DIR, 'src', 'law-links.js');
const LAWDB_PATH = path.join(WORKSPACE_DIR, 'content', 'lawdb.json');

/** references.json → _EXAM_TABLES 항목 JS 리터럴 (없는 키는 빈 값으로 관대 처리 — 골격 시험 허용) */
function examTablesJs(refs, contentRoot) {
  const arr = v => (Array.isArray(v) ? v : []);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  // SOURCE_REF_MAP → RegExp 객체로 컴파일
  const sourceRefMapJs = arr(refs.sourceRefMap).map(item => {
    const testRe = `/${item.test}/${item.flags || ''}`;
    const excludePart = item.exclude ? `, exclude: /${item.exclude}/` : '';
    return `        { test: ${testRe}${excludePart}, file: ${JSON.stringify(item.file)} }`;
  }).join(',\n');

  // KEYWORD_REF_MAP → RegExp 객체로 컴파일
  const keywordRefMapJs = arr(refs.keywordRefMap).map(item => {
    const patternRe = `/${item.pattern}/${item.flags || 'g'}`;
    return `        { pattern: ${patternRe}, file: ${JSON.stringify(item.file)}, search: ${JSON.stringify(item.search)} }`;
  }).join(',\n');

  // REFERENCE_FILES
  const refFilesJs = Object.entries(obj(refs.referenceFiles)).map(([key, items]) => {
    const itemsJs = items.map(item =>
      `            { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)} }`
    ).join(',\n');
    return `        ${JSON.stringify(key)}: [\n${itemsJs}\n        ]`;
  }).join(',\n');

  // REFERENCE_COMMON
  const commonJs = arr(refs.referenceCommon).map(item =>
    `        { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REFERENCE_INGREDIENTS
  const ingJs = arr(refs.referenceIngredients).map(item =>
    `        { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REFERENCE_LAW
  const lawJs = arr(refs.referenceLaw).map(item =>
    `        { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REF_DIRS
  const refDirsJs = Object.entries(obj(refs.refDirs)).map(([dir, files]) => {
    const filesJs = files.length > 0
      ? files.map(f => `            ${JSON.stringify(f)}`).join(',\n')
      : '';
    return `        ${JSON.stringify(dir)}: [\n${filesJs}\n        ]`;
  }).join(',\n');

  // SUBJECT_DIR_MAP
  const subjMapJs = Object.entries(obj(refs.subjectDirMap)).map(([k, v]) =>
    `        ${JSON.stringify(k)}: ${JSON.stringify(v)}`
  ).join(',\n');

  // REF_MD_SUBJECTS: 파일명 → ref_md 과목 서브디렉터리 (ref_md/과목N/{doc}/ 구조)
  const refMdSubjects = {};
  for (const files of Object.values(obj(refs.refDirs))) {
    for (const f of files) {
      const s = docSubject(f.replace(/\.pdf$/i, ''), contentRoot);
      if (s) refMdSubjects[f] = `과목${s}`;
    }
  }
  const refMdSubjJs = Object.entries(refMdSubjects).map(([k, v]) =>
    `            ${JSON.stringify(k)}: ${JSON.stringify(v)}`
  ).join(',\n');

  return `        contentRoot: ${JSON.stringify(contentRoot)},
        SUBJECT_DIR_MAP: {
${subjMapJs}
        },
        REF_MD_SUBJECTS: {
${refMdSubjJs}
        },
        REF_DIRS: {
${refDirsJs}
        },
        SOURCE_REF_MAP: [
${sourceRefMapJs}
        ],
        KEYWORD_REF_MAP: [
${keywordRefMapJs}
        ],
        REFERENCE_FILES: {
${refFilesJs}
        },
        REFERENCE_COMMON: [
${commonJs}
        ],
        REFERENCE_INGREDIENTS: [
${ingJs}
        ],
        REFERENCE_LAW: [
${lawJs}
        ]`;
}

/** content/lawdb.json 로드 (없으면 null — 법령DB 미사용 저장소 허용) */
function loadLawDb() {
  if (!fs.existsSync(LAWDB_PATH)) return null;
  return JSON.parse(fs.readFileSync(LAWDB_PATH, 'utf-8'));
}

function lawUrl(law) {
  return `https://www.law.go.kr/${law.type === 'law' ? '법령' : '행정규칙'}/${law.slug}`;
}

/**
 * 한 시험의 [matchKey, url] 평탄 목록.
 * references.json.lawRefs(lawdb id 순서 배열)가 있으면 그 순서로,
 * 없으면 lawdb 선언 순서로 전체를 포함한다.
 */
function examLawPairs(refs, lawdb, examId) {
  const laws = (lawdb && lawdb.laws) || [];
  const byId = new Map(laws.map(l => [l.id, l]));
  // lawRefs 키가 아예 없으면(레거시) 전체 포함, 명시되면(빈 배열 포함) 그대로 사용
  const ids = ('lawRefs' in refs) ? (refs.lawRefs || []) : laws.map(l => l.id);
  const pairs = [];
  for (const id of ids) {
    const law = byId.get(id);
    if (!law) {
      console.warn(`[${examId}] lawdb에 없는 lawRef id: ${id} — lawdb.json 또는 references.json 확인`);
      continue;
    }
    for (const k of law.matchKeys || []) pairs.push([k, lawUrl(law)]);
  }
  return pairs;
}

function buildLawLinks(targets, refsByExam, defaultId) {
  const lawdb = loadLawDb();
  if (!lawdb) {
    console.warn('content/lawdb.json not found — law-links.js는 빈 매핑으로 생성됩니다');
  }
  const entries = [];
  for (const target of targets) {
    const refs = refsByExam.get(target.id);
    if (!refs) continue;
    const pairs = examLawPairs(refs, lawdb, target.id);
    const pairsJs = pairs.map(([k, u]) =>
      `    [${JSON.stringify(k)}, ${JSON.stringify(u)}]`).join(',\n');
    entries.push(`    ${JSON.stringify(target.id)}: [\n${pairsJs}\n    ]`);
  }

  const output = `// src/law-links.js — 참조 문서 → law.go.kr 원문(최신 통합본) 링크 매퍼
// @spec RR-17
// ================================================================
// ⚠️ 이 파일은 content/lawdb.json + {contentRoot}/references.json(lawRefs)에서
// 빌드 시 자동 생성됩니다. 직접 수정하지 마시고 lawdb.json을 수정 후
// npm run build:pdf-registry 실행.
// ================================================================
// 한글주소 규약: 공백·특수문자 제거 명칭 — 법령은 /법령/, 고시·규정·기준은 /행정규칙/
// 파일명에 (발령기관)(제XXXX-N호)(시행일) 꼬리가 붙으므로 접두 매칭으로 판별.
// 매칭은 위에서 아래로 — 시험별 lawRefs 순서가 곧 우선순위 (구체적인 것을 먼저).
// [멀티시험] 시험별 매핑은 _EXAM_LAW_URLS[examId] — 활성 시험을 해석한다.

import { getActiveExamId } from './exam-context.js';

const _DEFAULT_EXAM_ID = ${JSON.stringify(defaultId)};

const _EXAM_LAW_URLS = {
${entries.join(',\n')}
};

// 활성 시험의 매칭 테이블 (미등록 시험은 기본 시험으로 폴백)
function activeLawUrls() {
  const id = getActiveExamId();
  return _EXAM_LAW_URLS[id] || _EXAM_LAW_URLS[_DEFAULT_EXAM_ID] || [];
}

// 전 시험 매칭 합집합 (URL 기준 중복 제거 — 순서 보존)
// keep-export — tools/check/check_law_urls.js가 한글주소 유효성을 전수 검증한다 (src/ 외부 소비자라 check:imports 미집계)
export const LAW_DOC_URLS = [...new Map(
  Object.values(_EXAM_LAW_URLS).flat().map(p => [JSON.stringify(p), p])
).values()];

/**
 * 참조자료 문서명/파일명 → law.go.kr 원문 URL (없으면 null — 순수 함수)
 * @param {string} name 예: '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf'
 * @returns {string|null}
 */
export function lawUrlFor(name) {
  if (!name) return null;
  // 표시명('시행규칙 별표7 …')과 파일명('시행규칙_별표7_….pdf') 모두 대응 — 공백·괄호·언더스코어 제거
  const key = String(name).replace(/[\\s()_]/g, '').replace(/\\.(pdf|md|html?)$/i, '');
  for (const [pat, url] of activeLawUrls()) {
    if (key.includes(pat.replace(/[\\s()_]/g, ''))) return url;
  }
  return null;
}
`;

  fs.writeFileSync(lawLinksOutPath, output, 'utf-8');
  const total = entries.length;
  console.log(`Generated: src/law-links.js (시험 ${total}개 — lawdb ${((lawdb && lawdb.laws) || []).length}종)`);
}

function build() {
  const targets = getExamTargets(WORKSPACE_DIR);
  const defaultId = (targets.find(t => t.isDefault) || targets[0] || {}).id || '';

  const entries = [];
  const refsByExam = new Map();
  for (const target of targets) {
    const refsPath = path.join(WORKSPACE_DIR, target.contentRoot, 'references.json');
    if (!fs.existsSync(refsPath)) {
      if (target.isDefault) {
        console.warn(`${target.contentRoot}/references.json not found — 기본 시험에 참조자료 테이블이 없습니다`);
      }
      continue;
    }
    const refs = JSON.parse(fs.readFileSync(refsPath, 'utf-8'));
    refsByExam.set(target.id, refs);
    entries.push(`    ${JSON.stringify(target.id)}: {\n${examTablesJs(refs, target.contentRoot)}\n    }`);
  }

  if (entries.length === 0) {
    console.warn('references.json을 가진 시험이 없습니다 — pdf-registry.js는 빈 테이블로 생성됩니다');
  }

  const output = `// src/pdf-registry.js — 참조자료 중앙 설정 모듈 (MD 변환본 기반)
// @spec RR-13
// ================================================================
// ⚠️ 이 파일은 {contentRoot}/references.json에서 빌드 시 자동 생성됩니다.
// 직접 수정하지 마시고 해당 시험의 references.json을 수정 후 npm run build:pdf-registry 실행.
// ================================================================
// 참조자료는 {contentRoot}/참조자료/ref_md/ 하위의 MD 변환본을 사용합니다.
// 각 파일은 {파일명(확장자 제거)}/{파일명(확장자 제거)}.md 구조로 배치됩니다.
//
// 참고: 테이블의 \`file\` 필드는 원본 PDF 파일명을 키로 사용하지만,
//       실제 서비스되는 것은 ref_md/{base}/{base}.md 입니다.
//       type:'pdf'는 "원본이 PDF"임을 의미하며, 런타임에는 MD로 서비스됩니다.
//       type:'md'는 처음부터 MD로 작성된 참조자료(원료 목록 등)입니다.
// [멀티시험] 시험별 테이블은 _EXAM_TABLES[examId] — getRefTables()가 활성 시험을 해석한다.
// ================================================================

import { getActiveExamId } from './exam-context.js';

const _DEFAULT_EXAM_ID = ${JSON.stringify(defaultId)};

const _EXAM_TABLES = {
${entries.join(',\n')}
};

// --- 파생 맵 (시험별 자동 계산 — REF_DIRS에서 생성) ---
// 파일명 → MD 경로 / 폴더명 (우선순위: 과목N 내림차순 > 공통 > 법령고시 > 기타)
const _EXAM_DERIVED = {};
for (const [eid, t] of Object.entries(_EXAM_TABLES)) {
    const root = t.contentRoot || 'content';
    const refDirs = t.REF_DIRS || {};
    const dirPriority = [
        ...Object.keys(refDirs).filter(d => /^과목\\d+$/.test(d)).sort((a, b) => parseInt(b.slice(2), 10) - parseInt(a.slice(2), 10)),
        ...Object.keys(refDirs).filter(d => !/^과목\\d+$/.test(d))
    ];
    const fileToPath = {};
    const registry = {};
    for (const dir of dirPriority) {
        for (const f of refDirs[dir] || []) {
            if (!fileToPath[f]) {
                const base = f.replace(/\\.pdf$/, '');
                const sub = (t.REF_MD_SUBJECTS || {})[f];
                fileToPath[f] = \`\${root}/참조자료/ref_md/\${sub ? sub + '/' : ''}\${base}/\${base}.md\`;
                registry[f] = dir;
            }
        }
    }
    _EXAM_DERIVED[eid] = { REF_FILE_TO_PATH: fileToPath, REF_REGISTRY: registry };
}

/**
 * 활성 시험의 참조자료 테이블 묶음.
 * 활성 시험에 테이블이 없으면 기본 시험으로 폴백 (refDocs 기능 없는 시험은 빈 테이블 반환 가능).
 * @returns {{contentRoot?: string, SUBJECT_DIR_MAP?: Object, REF_DIRS?: Object,
 *   SOURCE_REF_MAP?: Array, KEYWORD_REF_MAP?: Array, REFERENCE_FILES?: Object,
 *   REFERENCE_COMMON?: Array, REFERENCE_INGREDIENTS?: Array, REFERENCE_LAW?: Array,
 *   REF_FILE_TO_PATH?: Object, REF_REGISTRY?: Object, REF_MD_SUBJECTS?: Object}}
 */
export function getRefTables() {
    const id = getActiveExamId();
    const eid = _EXAM_TABLES[id] ? id : _DEFAULT_EXAM_ID;
    return { ...(_EXAM_TABLES[eid] || {}), ...(_EXAM_DERIVED[eid] || {}) };
}

// --- 헬퍼 함수 ---

export function resolveRefPath(fileName) {
    if (!fileName) return '';
    const t = getRefTables();
    const root = t.contentRoot || 'content';
    if (fileName.startsWith(\`\${root}/\`)) return fileName;
    return (t.REF_FILE_TO_PATH || {})[fileName] || '';
}

export function mapSourceToRef(sourceText) {
    if (!sourceText) return '';
    const s = sourceText.trim();
    const t = getRefTables();

    let refFile = '';
    for (const entry of (t.SOURCE_REF_MAP || [])) {
        if (entry.exclude) {
            if (entry.test.test(s) && !entry.exclude.test(s)) { refFile = entry.file; break; }
        } else {
            if (entry.test.test(s)) { refFile = entry.file; break; }
        }
    }
    if (!refFile) return '';

    const base = refFile.replace(/\\.pdf$/, '');
    const sub = (t.REF_MD_SUBJECTS || {})[refFile];
    return \`\${t.contentRoot || 'content'}/참조자료/ref_md/\${sub ? sub + '/' : ''}\${base}/\${base}.md\`;
}

// --- 본문 키워드 자동 링크 헬퍼 ---
// KEYWORD_REF_MAP의 패턴을 본문 텍스트에 적용하여 링크 생성 정보 반환
export function resolveKeywordRef(text) {
    if (!text) return null;
    for (const entry of (getRefTables().KEYWORD_REF_MAP || [])) {
        const m = text.match(entry.pattern);
        if (m) {
            const path = resolveRefPath(entry.file);
            if (path) {
                return { match: m[0], path, search: entry.search || m[0] };
            }
        }
    }
    return null;
}
`;

  fs.writeFileSync(outPath, output, 'utf-8');
  console.log(`Generated: src/pdf-registry.js (시험 ${entries.length}개: ${targets.filter(t => fs.existsSync(path.join(WORKSPACE_DIR, t.contentRoot, 'references.json'))).map(t => t.id).join(', ')})`);

  buildLawLinks(targets, refsByExam, defaultId);
}

build();
