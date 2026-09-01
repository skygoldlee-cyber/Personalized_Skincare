// src/pdf-registry.js — 참조자료 중앙 설정 모듈 (HTML 변환본 기반)
// ================================================================
// 과목이 변경될 때 이 파일만 수정하면 됩니다.
// reader-format.js와 textbook-reader.js는 이 파일을 import하여 사용합니다.
//
// 참조자료는 content/참조자료/html_output/ 하위의 MD 변환본을 사용합니다.
// 각 파일은 {파일명(확장자 제거)}/{파일명(확장자 제거)}.md 구조로 배치됩니다.
//
// 수정 가이드:
// 1. 새 과목 추가 → SUBJECT_DIR_MAP, REF_DIRS, REFERENCE_FILES에 항목 추가
// 2. 새 법령 참조자료 추가 → REF_DIRS.법령원문, SOURCE_REF_MAP, REFERENCE_LAW에 추가
// 3. 새 참조자료 추가 → REFERENCE_COMMON 또는 REFERENCE_FILES에 추가
// ================================================================

// --- 과목 키 → 참조자료 폴더명 매핑 ---
export const SUBJECT_DIR_MAP = {
    'law': '과목1',
    'manufacturing': '과목2',
    'safety': '과목3',
    'understanding': '과목4'
};

// --- 폴더별 참조자료 파일 목록 (원본 PDF 파일명, HTML 경로는 자동 변환) ---
// 우선순위: 과목N > 공통 > 법령원문 (같은 파일명이면 먼저 등록된 폴더가 우선)
export const REF_DIRS = {
    '법령원문': [
        '화장품법(법률)(제20901호)(20260402).pdf',
        '화장품법 시행규칙(총리령)(제02109호)(20260402).pdf',
        '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf',
        '우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).pdf',
        '기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf',
        '기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf',
        '화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).pdf',
        '화장품의 색소 종류 및 기준(식품의약품안전처고시)(제2023-61호)(20230921).pdf'
    ],
    '공통': [
        '화장품법(법률)(제20901호)(20260402).pdf', '색소종류및기준_전체.pdf',
        '시행규칙_별표3_사용시주의사항.pdf', '시행규칙_별표4_포장표시기준및방법.pdf',
        '시행규칙_별표5_표시광고범위및준수사항.pdf', '시행규칙_별표6_위해화장품공표문.pdf',
        '시행규칙_별표7_행정처분기준.pdf', '시행규칙_별표9_수수료.pdf',
        '안전기준_별표1_사용불가원료.pdf', '안전기준_별표2_사용제한원료.pdf',
        '안전기준_별표3_인체세포조직배양액안전기준.pdf', '안전기준_별표4_유통안전관리시험방법.pdf',
        '주의사항_별표1_유형별주의사항표시문구.pdf', '주의사항_별표2_알레르기유발성분25종.pdf',
        'CGMP_별표1_공정별분류.pdf', 'CGMP_별표2_실시상황평가표.pdf', 'CGMP_별표3_적합업소로고.pdf'
    ],
    '과목1': [
        '시행규칙_별표1_품질관리기준.pdf', '시행규칙_별표2_책임판매안전관리기준.pdf'
    ],
    '과목2': [
        'KFCC_별표1_통칙.pdf', 'KFCC_별표2_미백_나이아신아마이드.pdf', 'KFCC_별표3_주름개선_레티놀.pdf',
        'KFCC_별표4_자외선보호.pdf', 'KFCC_별표5_미백주름복합.pdf', 'KFCC_별표6_모발색상변화.pdf',
        'KFCC_별표7_체모제거_치오글리콜산.pdf', 'KFCC_별표8_여드름완화_살리실릭애씨드.pdf',
        'KFCC_별표9_탈모완화_덱스판테놀.pdf', 'KFCC_별표10_일반시험법.pdf', '안전기준_별표1_색소_구.pdf'
    ],
    '과목3': [],
    '과목4': []
};

// --- 출처 키워드 → 참조자료 파일명 매핑 (위에서 아래로 순차 매칭, 첫 매칭 사용) ---
export const SOURCE_REF_MAP = [
    { test: /화장품법\s*제?\d+조/, exclude: /시행령|시행규칙|고시/, file: '화장품법(법률)(제20901호)(20260402).pdf' },
    { test: /시행규칙/, file: '화장품법 시행규칙(총리령)(제02109호)(20260402).pdf' },
    { test: /안전기준/, file: '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf' },
    { test: /CGMP|품질관리|우수화장품/, file: '우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).pdf' },
    { test: /기능성화장품\s*기준|시험\s*방법/, file: '기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf' },
    { test: /기능성화장품\s*심사/, file: '기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf' },
    { test: /주의사항|알레르기/, file: '화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).pdf' },
    { test: /색소/, file: '화장품의 색소 종류 및 기준(식품의약품안전처고시)(제2023-61호)(20230921).pdf' },
    { test: /개인정보\s*보호법/, file: '화장품법(법률)(제20901호)(20260402).pdf' },
    { test: /화장품법/, file: '화장품법(법률)(제20901호)(20260402).pdf' },
];

// --- 본문 키워드 → 참조자료 자동 링크 매핑 ---
// reader-format.js에서 교재 본문의 키워드를 자동으로 클릭 가능한 링크로 변환
// pattern: 본문에서 매칭할 정규식, file: 참조자료 PDF 파일명, search: 검색어(생략시 매칭된 텍스트 사용)
export const KEYWORD_REF_MAP = [
    { pattern: /시행규칙\s*별표\s*1(?!\s*_)|별표\s*1\s*품질관리기준/g, file: '시행규칙_별표1_품질관리기준.pdf', search: '품질관리기준' },
    { pattern: /시행규칙\s*별표\s*2(?!\s*_)|별표\s*2\s*책임판매/g, file: '시행규칙_별표2_책임판매안전관리기준.pdf', search: '책임판매' },
    { pattern: /시행규칙\s*별표\s*3(?!\s*_)|별표\s*3\s*사용시주의/g, file: '시행규칙_별표3_사용시주의사항.pdf', search: '사용시주의' },
    { pattern: /시행규칙\s*별표\s*4(?!\s*_)|별표\s*4\s*포장/g, file: '시행규칙_별표4_포장표시기준및방법.pdf', search: '포장표시' },
    { pattern: /시행규칙\s*별표\s*5(?!\s*_)|별표\s*5\s*표시광고/g, file: '시행규칙_별표5_표시광고범위및준수사항.pdf', search: '표시광고' },
    { pattern: /시행규칙\s*별표\s*6(?!\s*_)|별표\s*6\s*위해화장품/g, file: '시행규칙_별표6_위해화장품공표문.pdf', search: '위해화장품' },
    { pattern: /시행규칙\s*별표\s*7(?!\s*_)|별표\s*7\s*행정처분/g, file: '시행규칙_별표7_행정처분기준.pdf', search: '행정처분' },
    { pattern: /시행규칙\s*별표\s*9(?!\s*_)|별표\s*9\s*수수료/g, file: '시행규칙_별표9_수수료.pdf', search: '수수료' },
    { pattern: /안전기준\s*별표\s*1(?!\s*_)|별표\s*1\s*사용불가원료/g, file: '안전기준_별표1_사용불가원료.pdf', search: '사용불가원료' },
    { pattern: /안전기준\s*별표\s*2(?!\s*_)|별표\s*2\s*사용제한원료/g, file: '안전기준_별표2_사용제한원료.pdf', search: '사용제한원료' },
    { pattern: /안전기준\s*별표\s*3(?!\s*_)|별표\s*3\s*인체세포/g, file: '안전기준_별표3_인체세포조직배양액안전기준.pdf', search: '인체세포' },
    { pattern: /안전기준\s*별표\s*4(?!\s*_)|별표\s*4\s*유통안전/g, file: '안전기준_별표4_유통안전관리시험방법.pdf', search: '유통안전' },
    { pattern: /주의사항\s*별표\s*1(?!\s*_)|별표\s*1\s*유형별주의사항/g, file: '주의사항_별표1_유형별주의사항표시문구.pdf', search: '유형별주의사항' },
    { pattern: /주의사항\s*별표\s*2(?!\s*_)|별표\s*2\s*알레르기유발성분/g, file: '주의사항_별표2_알레르기유발성분25종.pdf', search: '알레르기유발성분' },
    { pattern: /CGMP\s*별표\s*1(?!\s*_)|별표\s*1\s*공정별분류/g, file: 'CGMP_별표1_공정별분류.pdf', search: '공정별분류' },
    { pattern: /CGMP\s*별표\s*2(?!\s*_)|별표\s*2\s*실시상황평가/g, file: 'CGMP_별표2_실시상황평가표.pdf', search: '실시상황평가' },
    { pattern: /CGMP\s*별표\s*3(?!\s*_)|별표\s*3\s*적합업소/g, file: 'CGMP_별표3_적합업소로고.pdf', search: '적합업소' },
    { pattern: /KFCC\s*별표\s*1(?!\s*_)|별표\s*1\s*통칙/g, file: 'KFCC_별표1_통칙.pdf', search: '통칙' },
    { pattern: /KFCC\s*별표\s*2(?!\s*_)|별표\s*2\s*미백/g, file: 'KFCC_별표2_미백_나이아신아마이드.pdf', search: '미백' },
    { pattern: /KFCC\s*별표\s*3(?!\s*_)|별표\s*3\s*주름/g, file: 'KFCC_별표3_주름개선_레티놀.pdf', search: '주름개선' },
    { pattern: /KFCC\s*별표\s*4(?!\s*_)|별표\s*4\s*자외선/g, file: 'KFCC_별표4_자외선보호.pdf', search: '자외선보호' },
    { pattern: /KFCC\s*별표\s*5(?!\s*_)|별표\s*5\s*미백주름/g, file: 'KFCC_별표5_미백주름복합.pdf', search: '미백주름복합' },
    { pattern: /KFCC\s*별표\s*6(?!\s*_)|별표\s*6\s*모발색상/g, file: 'KFCC_별표6_모발색상변화.pdf', search: '모발색상' },
    { pattern: /KFCC\s*별표\s*7(?!\s*_)|별표\s*7\s*체모제거/g, file: 'KFCC_별표7_체모제거_치오글리콜산.pdf', search: '체모제거' },
    { pattern: /KFCC\s*별표\s*8(?!\s*_)|별표\s*8\s*여드름/g, file: 'KFCC_별표8_여드름완화_살리실릭애씨드.pdf', search: '여드름완화' },
    { pattern: /KFCC\s*별표\s*9(?!\s*_)|별표\s*9\s*탈모/g, file: 'KFCC_별표9_탈모완화_덱스판테놀.pdf', search: '탈모완화' },
    { pattern: /KFCC\s*별표\s*10(?!\s*_)|별표\s*10\s*일반시험/g, file: 'KFCC_별표10_일반시험법.pdf', search: '일반시험법' },
    { pattern: /색소종류및기준|색소\s*종류\s*및\s*기준/g, file: '색소종류및기준_전체.pdf', search: '색소종류' },
];

// --- 과목별 참조자료 파일 목록 ---
export const REFERENCE_FILES = {
    'law': [
        { name: '화장품법 통합 정리', file: '1.cosmetic-law.md', type: 'md' },
        { name: '개인정보보호법', file: '2.privacy-law.md', type: 'md' },
        { name: '시행규칙 별표1 품질관리기준', file: '시행규칙_별표1_품질관리기준.pdf', type: 'pdf' },
        { name: '시행규칙 별표2 책임판매안전관리기준', file: '시행규칙_별표2_책임판매안전관리기준.pdf', type: 'pdf' }
    ],
    'manufacturing': [
        { name: '원료 종류와 특성', file: '1.ingredients.md', type: 'md' },
        { name: '품질관리', file: '2.quality.md', type: 'md' },
        { name: '사용 제한 원료', file: '3.restricted.md', type: 'md' },
        { name: '제조 관리', file: '4.management.md', type: 'md' },
        { name: '위해 관리', file: '5.hazard.md', type: 'md' },
        { name: 'KFCC 별표1 통칙', file: 'KFCC_별표1_통칙.pdf', type: 'pdf' },
        { name: 'KFCC 별표2 미백', file: 'KFCC_별표2_미백_나이아신아마이드.pdf', type: 'pdf' },
        { name: 'KFCC 별표3 주름개선', file: 'KFCC_별표3_주름개선_레티놀.pdf', type: 'pdf' },
        { name: 'KFCC 별표4 자외선보호', file: 'KFCC_별표4_자외선보호.pdf', type: 'pdf' },
        { name: 'KFCC 별표5 미백주름복합', file: 'KFCC_별표5_미백주름복합.pdf', type: 'pdf' },
        { name: 'KFCC 별표6 모발색상변화', file: 'KFCC_별표6_모발색상변화.pdf', type: 'pdf' },
        { name: 'KFCC 별표7 체모제거', file: 'KFCC_별표7_체모제거_치오글리콜산.pdf', type: 'pdf' },
        { name: 'KFCC 별표8 여드름완화', file: 'KFCC_별표8_여드름완화_살리실릭애씨드.pdf', type: 'pdf' },
        { name: 'KFCC 별표9 탈모완화', file: 'KFCC_별표9_탈모완화_덱스판테놀.pdf', type: 'pdf' },
        { name: 'KFCC 별표10 일반시험법', file: 'KFCC_별표10_일반시험법.pdf', type: 'pdf' }
    ],
    'safety': [
        { name: '작업장 위생관리', file: '1.workspace-safety.md', type: 'md' },
        { name: '작업자 안전', file: '2.worker-safety.md', type: 'md' },
        { name: '설비 안전', file: '3.equipment-safety.md', type: 'md' },
        { name: '자재 안전', file: '4.material-safety.md', type: 'md' },
        { name: '포장 안전', file: '5.packaging-safety.md', type: 'md' }
    ],
    'understanding': [
        { name: '맞춤형화장품 개요', file: '1.overview.md', type: 'md' },
        { name: '피부 생리학', file: '2.physiology.md', type: 'md' },
        { name: '감각 평가', file: '3.sensory-evaluation.md', type: 'md' },
        { name: '상담', file: '4.consulting.md', type: 'md' },
        { name: '가이드라인', file: '5.guideline.md', type: 'md' },
        { name: '혼합·소분', file: '6.mixing-subdivision.md', type: 'md' },
        { name: '충전·포장', file: '7.filling-packaging.md', type: 'md' }
    ]
};

// --- 공통 참조자료 (모든 과목) ---
export const REFERENCE_COMMON = [
    { name: '화장품법 원문', file: '화장품법(법률)(제20901호)(20260402).pdf', type: 'pdf', dir: '공통' },
    { name: '사용불가원료', file: '안전기준_별표1_사용불가원료.pdf', type: 'pdf', dir: '공통' },
    { name: '사용제한원료', file: '안전기준_별표2_사용제한원료.pdf', type: 'pdf', dir: '공통' },
    { name: '색소종류및기준', file: '색소종류및기준_전체.pdf', type: 'pdf', dir: '공통' },
    { name: '별표3 인체세포조직배양액안전기준', file: '안전기준_별표3_인체세포조직배양액안전기준.pdf', type: 'pdf', dir: '공통' },
    { name: '별표4 유통안전관리시험방법', file: '안전기준_별표4_유통안전관리시험방법.pdf', type: 'pdf', dir: '공통' },
    { name: '별표1 유형별주의사항표시문구', file: '주의사항_별표1_유형별주의사항표시문구.pdf', type: 'pdf', dir: '공통' },
    { name: '별표2 알레르기유발성분25종', file: '주의사항_별표2_알레르기유발성분25종.pdf', type: 'pdf', dir: '공통' },
    { name: '시행규칙 별표3 사용시주의사항', file: '시행규칙_별표3_사용시주의사항.pdf', type: 'pdf', dir: '공통' },
    { name: '시행규칙 별표4 포장표시기준', file: '시행규칙_별표4_포장표시기준및방법.pdf', type: 'pdf', dir: '공통' },
    { name: '시행규칙 별표5 표시광고범위', file: '시행규칙_별표5_표시광고범위및준수사항.pdf', type: 'pdf', dir: '공통' },
    { name: '시행규칙 별표6 위해화장품공표문', file: '시행규칙_별표6_위해화장품공표문.pdf', type: 'pdf', dir: '공통' },
    { name: '시행규칙 별표7 행정처분기준', file: '시행규칙_별표7_행정처분기준.pdf', type: 'pdf', dir: '공통' },
    { name: '시행규칙 별표9 수수료', file: '시행규칙_별표9_수수료.pdf', type: 'pdf', dir: '공통' },
    { name: 'CGMP 별표1 공정별분류', file: 'CGMP_별표1_공정별분류.pdf', type: 'pdf', dir: '공통' },
    { name: 'CGMP 별표2 실시상황평가표', file: 'CGMP_별표2_실시상황평가표.pdf', type: 'pdf', dir: '공통' },
    { name: 'CGMP 별표3 적합업소로고', file: 'CGMP_별표3_적합업소로고.pdf', type: 'pdf', dir: '공통' }
];

// --- 원료 참조자료 ---
export const REFERENCE_INGREDIENTS = [
    { name: '승인 원료 목록', file: 'approved_ingredients.md', type: 'md', dir: '원료' },
    { name: '금지 원료 목록', file: 'banned_ingredients.md', type: 'md', dir: '원료' },
    { name: '제한 원료 목록', file: 'restricted_ingredients.md', type: 'md', dir: '원료' }
];

// --- 법령원문 참조자료 ---
export const REFERENCE_LAW = [
    { name: '화장품법', file: '화장품법(법률)(제20901호)(20260402).pdf', type: 'pdf', dir: '법령원문' },
    { name: '화장품법 시행규칙', file: '화장품법 시행규칙(총리령)(제02109호)(20260402).pdf', type: 'pdf', dir: '법령원문' },
    { name: '화장품 안전기준 등에 관한 규정', file: '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf', type: 'pdf', dir: '법령원문' },
    { name: '우수화장품 제조 및 품질관리기준', file: '우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).pdf', type: 'pdf', dir: '법령원문' },
    { name: '기능성화장품 기준 및 시험방법', file: '기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf', type: 'pdf', dir: '법령원문' },
    { name: '기능성화장품 심사에 관한 규정', file: '기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf', type: 'pdf', dir: '법령원문' },
    { name: '화장품 사용 시 주의사항 및 알레르기', file: '화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).pdf', type: 'pdf', dir: '법령원문' },
    { name: '화장품의 색소 종류 및 기준', file: '화장품의 색소 종류 및 기준(식품의약품안전처고시)(제2023-61호)(20230921).pdf', type: 'pdf', dir: '법령원문' }
];

// ================================================================
// 파생 맵 (수정 불필요 — 위의 설정에서 자동 생성됨)
// ================================================================

// HTML 기본 경로: content/참조자료/html_output/{basename}/{basename}.md
// basename = 파일명에서 .pdf 확장자 제거
// 전체 참조자료를 MD로 변환 (한글 엔티티 인코딩 문제 해결 + 용량 절감)
const MD_CONVERSION_TARGETS = null; // null = 전체 MD 변환

function _toHtmlPath(fileName) {
    const base = fileName.replace(/\.pdf$/, '');
    const ext = '.md';
    return `content/참조자료/html_output/${base}/${base}${ext}`;
}

// 파일명 → HTML 경로 매핑 (reader-format.js용, 우선순위: 과목N > 공통 > 법령원문)
const _DIR_PRIORITY = ['과목4', '과목3', '과목2', '과목1', '공통', '법령원문'];
export const REF_FILE_TO_PATH = {};
for (const dir of _DIR_PRIORITY) {
    for (const f of REF_DIRS[dir] || []) {
        if (!REF_FILE_TO_PATH[f]) REF_FILE_TO_PATH[f] = _toHtmlPath(f);
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

    return _toHtmlPath(refFile);
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
