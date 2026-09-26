// tools/build/build_pdf_registry.js
// {contentRoot}/references.json → src/pdf-registry.js 자동 생성 (content/exams.json의 모든 시험 순회)
// 참조자료 추가/삭제/변경 시 해당 시험의 references.json만 수정하면 됨 (빌드 시 pdf-registry.js 재생성)
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

/** references.json → _EXAM_TABLES 항목 JS 리터럴 */
function examTablesJs(refs, contentRoot) {
  // SOURCE_REF_MAP → RegExp 객체로 컴파일
  const sourceRefMapJs = refs.sourceRefMap.map(item => {
    const testRe = `/${item.test}/${item.flags || ''}`;
    const excludePart = item.exclude ? `, exclude: /${item.exclude}/` : '';
    return `        { test: ${testRe}${excludePart}, file: ${JSON.stringify(item.file)} }`;
  }).join(',\n');

  // KEYWORD_REF_MAP → RegExp 객체로 컴파일
  const keywordRefMapJs = refs.keywordRefMap.map(item => {
    const patternRe = `/${item.pattern}/${item.flags || 'g'}`;
    return `        { pattern: ${patternRe}, file: ${JSON.stringify(item.file)}, search: ${JSON.stringify(item.search)} }`;
  }).join(',\n');

  // REFERENCE_FILES
  const refFilesJs = Object.entries(refs.referenceFiles).map(([key, items]) => {
    const itemsJs = items.map(item =>
      `            { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)} }`
    ).join(',\n');
    return `        ${JSON.stringify(key)}: [\n${itemsJs}\n        ]`;
  }).join(',\n');

  // REFERENCE_COMMON
  const commonJs = refs.referenceCommon.map(item =>
    `        { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REFERENCE_INGREDIENTS
  const ingJs = refs.referenceIngredients.map(item =>
    `        { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REFERENCE_LAW
  const lawJs = refs.referenceLaw.map(item =>
    `        { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REF_DIRS
  const refDirsJs = Object.entries(refs.refDirs).map(([dir, files]) => {
    const filesJs = files.length > 0
      ? files.map(f => `            ${JSON.stringify(f)}`).join(',\n')
      : '';
    return `        ${JSON.stringify(dir)}: [\n${filesJs}\n        ]`;
  }).join(',\n');

  // SUBJECT_DIR_MAP
  const subjMapJs = Object.entries(refs.subjectDirMap).map(([k, v]) =>
    `        ${JSON.stringify(k)}: ${JSON.stringify(v)}`
  ).join(',\n');

  // REF_MD_SUBJECTS: 파일명 → ref_md 과목 서브디렉터리 (ref_md/과목N/{doc}/ 구조)
  const refMdSubjects = {};
  for (const files of Object.values(refs.refDirs)) {
    for (const f of files) {
      const s = docSubject(f.replace(/\.pdf$/i, ''));
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

function build() {
  const targets = getExamTargets(WORKSPACE_DIR);
  const defaultId = (targets.find(t => t.isDefault) || targets[0] || {}).id || '';

  const entries = [];
  for (const target of targets) {
    const refsPath = path.join(WORKSPACE_DIR, target.contentRoot, 'references.json');
    if (!fs.existsSync(refsPath)) {
      if (target.isDefault) {
        console.warn(`${target.contentRoot}/references.json not found — 기본 시험에 참조자료 테이블이 없습니다`);
      }
      continue;
    }
    const refs = JSON.parse(fs.readFileSync(refsPath, 'utf-8'));
    entries.push(`    ${JSON.stringify(target.id)}: {\n${examTablesJs(refs, target.contentRoot)}\n    }`);
  }

  if (entries.length === 0) {
    console.warn('references.json을 가진 시험이 없습니다 — pdf-registry.js는 빈 테이블로 생성됩니다');
  }

  const output = `// src/pdf-registry.js — 참조자료 중앙 설정 모듈 (MD 변환본 기반)
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
 *   REF_FILE_TO_PATH?: Object, REF_REGISTRY?: Object}}
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
}

build();
