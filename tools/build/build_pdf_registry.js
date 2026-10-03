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
  const hasLawRefs = 'lawRefs' in refs;
  const ids = hasLawRefs ? (refs.lawRefs || []) : laws.map(l => l.id);
  if (!hasLawRefs && laws.length) {
    console.warn(`[${examId}] references.json에 lawRefs 키 없음 — lawdb 전체(${laws.length}종)가 이 시험 매칭에 주입됩니다. 의도된 경우 "lawRefs": []를 명시하세요.`);
  }
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

/**
 * notice-check.js markStaleRefLinks 조인 계약 검증.
 * DOM의 data-law-url은 lawdb slug 기반(lawUrlFor), notice_status.json의
 * docs[].url은 ref-pipeline이 파일명에서 유도(첫 '(' 앞 문서명의 공백 제거 —
 * _exam_root.py parse_ref_filename과 동일 규칙). 둘이 어긋나면 현행본
 * 보정/개정 배지가 조용히 miss하므로 빌드 시점에 경고한다.
 * 추가로 matchKeys 교차 오염도 검증한다 — contains 매칭이라 한 파일명이
 * 복수 lawdb 항목에 걸릴 수 있으며, lawRefs 밖 법령에 걸리는 matchKey는
 * 시험 추가·lawRefs 변경 시 오링크로 이어질 수 있다.
 */
function checkLawUrlJoin(refs, lawdb, examId) {
  const laws = (lawdb && lawdb.laws) || [];
  const hasLawRefs = refs && 'lawRefs' in refs;
  const refIds = hasLawRefs ? (refs.lawRefs || []) : laws.map(l => l.id);
  const refOrder = new Map(refIds.map((id, i) => [id, i]));
  const lawFiles = ((refs || {}).referenceLaw || []).map(it => it && it.file).filter(Boolean);
  const normKey = s => String(s).replace(/[\s()_]/g, '');
  for (const f of lawFiles) {
    const docName = String(f).split('(')[0].trim();
    // 런타임 lawUrlFor와 동일 정규화(확장자 제거 후 공백·괄호·언더스코어 제거)
    const norm = normKey(String(f).replace(/\.(pdf|md|html?)$/i, ''));
    const matched = laws.filter(l => (l.matchKeys || []).some(k => norm.includes(normKey(k))));
    if (!matched.length) {
      console.warn(`[${examId}] referenceLaw 파일이 어떤 lawdb matchKeys에도 매칭되지 않습니다: ${f} — data-law-url 없음으로 고시 배지/현행본 보정 미적용`);
      continue;
    }
    const inside = matched.filter(l => refOrder.has(l.id)).sort((a, b) => refOrder.get(a.id) - refOrder.get(b.id));
    const chosen = inside[0];
    if (!chosen) {
      console.warn(`[${examId}] "${f}"이(가) lawdb(${matched.map(l => l.id).join(', ')})와 매칭되지만 이 시험 lawRefs에 없습니다 — data-law-url 미적용`);
      continue;
    }
    // 파이프라인 유도 URL: (법률|대통령령|총리령|부령) 꼬리 → 법령, 그 외 → 행정규칙
    const targetSeg = /\((법률|대통령령|총리령|부령)\)/.test(f) ? '법령' : '행정규칙';
    const derivedUrl = `https://www.law.go.kr/${targetSeg}/${docName.replace(/\s+/g, '')}`;
    if (lawUrl(chosen) !== derivedUrl) {
      console.warn(`[${examId}] markStaleRefLinks 조인 불일치 — "${f}"은(는) ${lawUrl(chosen)}로 매칭되지만 ref-pipeline은 ${derivedUrl}를 기록합니다 (lawdb slug 또는 파일명 확인)`);
    }
    if (matched.length > 1) {
      const outside = matched.filter(l => !refOrder.has(l.id)).map(l => l.id);
      if (outside.length) {
        console.warn(`[${examId}] "${f}"의 파일명이 lawRefs 밖 법령(${outside.join(', ')})에도 매칭됩니다 — matchKey 범위가 넓은지 확인 (선택: ${chosen.id})`);
      } else {
        console.warn(`[${examId}] "${f}"이(가) 복수 법령(${inside.map(l => l.id).join(', ')})에 매칭됩니다 — lawRefs 순서로 "${chosen.id}" 선택됨`);
      }
    }
  }
}

/**
 * 이름 기반 참조 검증 — noticeCore·subjectDefaultRefdoc는 문자열 이름으로
 * referenceLaw를 가리키므로 문서명/파일명이 바뀌면 조용히 어긋난다.
 */
function checkNamedRefs(refs, examId) {
  const lawFiles = ((refs || {}).referenceLaw || []).map(it => it && it.file).filter(Boolean);
  const basenames = new Set(lawFiles.map(f => String(f).replace(/\.pdf$/i, '')));
  const docNames = new Set(lawFiles.map(f => String(f).split('(')[0].trim()));
  const nc = refs && refs.noticeCore;
  if (nc && lawFiles.length && !docNames.has(nc)) {
    console.warn(`[${examId}] noticeCore "${nc}"이(가) referenceLaw 문서명과 일치하지 않습니다 — 고시 감시 기준 문서 확인`);
  }
  for (const [k, v] of Object.entries((refs && refs.subjectDefaultRefdoc) || {})) {
    if (v && !basenames.has(v)) {
      console.warn(`[${examId}] subjectDefaultRefdoc["${k}"]="${v}"이(가) referenceLaw 파일에 없습니다 — 파일명 변경 시 함께 갱신 필요`);
    }
  }
}

function buildLawLinks(targets, refsByExam, defaultId) {
  const lawdb = loadLawDb();
  if (!lawdb) {
    console.warn('content/lawdb.json not found — law-links.js는 빈 매핑으로 생성됩니다');
  }
  // lawdb 내부 정합성 — slug는 통상 "명칭의 공백 제거" 형태이며,
  // 어긋나면 파일명 유도 URL(ref-pipeline)과 slug URL(런타임 링크)이 갈라져
  // markStaleRefLinks 조인이 조용히 실패할 수 있다 (특수문자 정규화는 예외 허용 — 경고만).
  for (const law of ((lawdb && lawdb.laws) || [])) {
    const expectSlug = String(law.name || '').replace(/\s+/g, '');
    if (law.slug && law.slug !== expectSlug) {
      console.warn(`lawdb "${law.id}": slug "${law.slug}" ≠ name 공백제거 "${expectSlug}" — 파일명 유도 URL과의 조인이 깨질 수 있습니다`);
    }
  }
  const entries = [];
  for (const target of targets) {
    const refs = refsByExam.get(target.id);
    if (!refs) continue;
    const pairs = examLawPairs(refs, lawdb, target.id);
    checkLawUrlJoin(refs, lawdb, target.id);
    checkNamedRefs(refs, target.id);
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

// 전 시험 매칭 합집합 (URL 기준 중복 제거 — 같은 문서의 matchKey는 첫 것만 유지, 순서 보존)
// keep-export — tools/check/check_law_urls.js가 한글주소 유효성을 전수 검증한다 (src/ 외부 소비자라 check:imports 미집계)
export const LAW_DOC_URLS = [...new Map(
  Object.values(_EXAM_LAW_URLS).flat().map(p => [p[1], p])
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
 * 활성 시험에 테이블이 없으면 기본 시험으로 폴백 (참조자료 없는 시험은 빈 테이블 반환 가능).
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
