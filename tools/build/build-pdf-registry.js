// tools/build/build-pdf-registry.js
// content/references.json → src/pdf-registry.js 자동 생성
// 참조자료 추가/삭제/변경 시 references.json만 수정하면 됨 (빌드 시 pdf-registry.js 재생성)
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = path.resolve(__dirname, '..', '..');
const refsPath = path.join(WORKSPACE_DIR, 'content', 'references.json');
const outPath = path.join(WORKSPACE_DIR, 'src', 'pdf-registry.js');

function build() {
  if (!fs.existsSync(refsPath)) {
    console.warn('content/references.json not found — skipping pdf-registry.js generation');
    return;
  }
  const refs = JSON.parse(fs.readFileSync(refsPath, 'utf-8'));

  // SOURCE_REF_MAP → RegExp 객체로 컴파일
  const sourceRefMapJs = refs.sourceRefMap.map(item => {
    const testRe = `/${item.test}/${item.flags || ''}`;
    const excludePart = item.exclude ? `, exclude: /${item.exclude}/` : '';
    return `    { test: ${testRe}${excludePart}, file: ${JSON.stringify(item.file)} }`;
  }).join(',\n');

  // KEYWORD_REF_MAP → RegExp 객체로 컴파일
  const keywordRefMapJs = refs.keywordRefMap.map(item => {
    const patternRe = `/${item.pattern}/${item.flags || 'g'}`;
    return `    { pattern: ${patternRe}, file: ${JSON.stringify(item.file)}, search: ${JSON.stringify(item.search)} }`;
  }).join(',\n');

  // REFERENCE_FILES
  const refFilesJs = Object.entries(refs.referenceFiles).map(([key, items]) => {
    const itemsJs = items.map(item =>
      `        { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)} }`
    ).join(',\n');
    return `    ${JSON.stringify(key)}: [\n${itemsJs}\n    ]`;
  }).join(',\n');

  // REFERENCE_COMMON
  const commonJs = refs.referenceCommon.map(item =>
    `    { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REFERENCE_INGREDIENTS
  const ingJs = refs.referenceIngredients.map(item =>
    `    { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REFERENCE_LAW
  const lawJs = refs.referenceLaw.map(item =>
    `    { name: ${JSON.stringify(item.name)}, file: ${JSON.stringify(item.file)}, type: ${JSON.stringify(item.type)}, dir: ${JSON.stringify(item.dir)} }`
  ).join(',\n');

  // REF_DIRS
  const refDirsJs = Object.entries(refs.refDirs).map(([dir, files]) => {
    const filesJs = files.length > 0
      ? files.map(f => `        ${JSON.stringify(f)}`).join(',\n')
      : '';
    return `    ${JSON.stringify(dir)}: [\n${filesJs}\n    ]`;
  }).join(',\n');

  // SUBJECT_DIR_MAP
  const subjMapJs = Object.entries(refs.subjectDirMap).map(([k, v]) =>
    `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`
  ).join(',\n');

  const output = `// src/pdf-registry.js — 참조자료 중앙 설정 모듈 (MD 변환본 기반)
// ================================================================
// ⚠️ 이 파일은 content/references.json에서 빌드 시 자동 생성됩니다.
// 직접 수정하지 마시고 content/references.json을 수정 후 npm run build:pdf-registry 실행.
// ================================================================
// 참조자료는 content/참조자료/ref_md/ 하위의 MD 변환본을 사용합니다.
// 각 파일은 {파일명(확장자 제거)}/{파일명(확장자 제거)}.md 구조로 배치됩니다.
//
// 참고: 레지스트리의 \`file\` 필드는 원본 PDF 파일명을 키로 사용하지만,
//       실제 서비스되는 것은 _toMdPath()로 변환된 ref_md/{base}/{base}.md 입니다.
//       type:'pdf'는 "원본이 PDF"임을 의미하며, 런타임에는 MD로 서비스됩니다.
//       type:'md'는 처음부터 MD로 작성된 참조자료(원료 목록 등)입니다.
// ================================================================

// --- 과목 키 → 참조자료 폴더명 매핑 ---
export const SUBJECT_DIR_MAP = {
${subjMapJs}
};

// --- 폴더별 참조자료 파일 목록 (원본 PDF 파일명, MD 경로는 _toMdPath로 자동 변환) ---
// 우선순위: 과목N > 공통 > 법령원문 (같은 파일명이면 먼저 등록된 폴더가 우선)
const REF_DIRS = {
${refDirsJs}
};

// --- 출처 키워드 → 참조자료 파일명 매핑 (위에서 아래로 순차 매칭, 첫 매칭 사용) ---
export const SOURCE_REF_MAP = [
${sourceRefMapJs}
];

// --- 본문 키워드 → 참조자료 자동 링크 매핑 ---
// reader-format.js에서 교재 본문의 키워드를 자동으로 클릭 가능한 링크로 변환
// pattern: 본문에서 매칭할 정규식, file: 참조자료 PDF 파일명, search: 검색어(생략시 매칭된 텍스트 사용)
export const KEYWORD_REF_MAP = [
${keywordRefMapJs}
];

// --- 과목별 참조자료 파일 목록 ---
export const REFERENCE_FILES = {
${refFilesJs}
};

// --- 공통 참조자료 (모든 과목) ---
export const REFERENCE_COMMON = [
${commonJs}
];

// --- 원료 참조자료 ---
export const REFERENCE_INGREDIENTS = [
${ingJs}
];

// --- 법령원문 참조자료 ---
export const REFERENCE_LAW = [
${lawJs}
];

// ================================================================
// 파생 맵 (수정 불필요 — 위의 설정에서 자동 생성됨)
// ================================================================

// MD 기본 경로: content/참조자료/ref_md/{basename}/{basename}.md
// basename = 파일명에서 .pdf 확장자 제거
// 전체 참조자료를 MD로 변환 (한글 엔티티 인코딩 문제 해결 + 용량 절감)
const MD_CONVERSION_TARGETS = null; // null = 전체 MD 변환

function _toMdPath(fileName) {
    const base = fileName.replace(/\\.pdf$/, '');
    const ext = '.md';
    return \`content/참조자료/ref_md/\${base}/\${base}\${ext}\`;
}

// 파일명 → MD 경로 매핑 (reader-format.js용, 우선순위: 과목N > 공통 > 법령원문)
const _DIR_PRIORITY = ['과목4', '과목3', '과목2', '과목1', '공통', '법령원문'];
export const REF_FILE_TO_PATH = {};
for (const dir of _DIR_PRIORITY) {
    for (const f of REF_DIRS[dir] || []) {
        if (!REF_FILE_TO_PATH[f]) REF_FILE_TO_PATH[f] = _toMdPath(f);
    }
}

// 파일명 → 폴더명 레지스트리 (textbook-reader.js용, 동일 우선순위)
export const REF_REGISTRY = {};
for (const dir of _DIR_PRIORITY) {
    for (const f of REF_DIRS[dir] || []) {
        if (!REF_REGISTRY[f]) REF_REGISTRY[f] = dir;
    }
}

// --- 헬퍼 함수 ---

export function resolveRefPath(fileName) {
    if (!fileName) return '';
    if (fileName.startsWith('content/')) return fileName;
    return REF_FILE_TO_PATH[fileName] || '';
}

export function mapSourceToRef(sourceText) {
    if (!sourceText) return '';
    const s = sourceText.trim();

    let refFile = '';
    for (const entry of SOURCE_REF_MAP) {
        if (entry.exclude) {
            if (entry.test.test(s) && !entry.exclude.test(s)) { refFile = entry.file; break; }
        } else {
            if (entry.test.test(s)) { refFile = entry.file; break; }
        }
    }
    if (!refFile) return '';

    return _toMdPath(refFile);
}

// --- 본문 키워드 자동 링크 헬퍼 ---
// KEYWORD_REF_MAP의 패턴을 본문 텍스트에 적용하여 링크 생성 정보 반환
export function resolveKeywordRef(text) {
    if (!text) return null;
    for (const entry of KEYWORD_REF_MAP) {
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
  console.log('Generated: src/pdf-registry.js');
}

build();
