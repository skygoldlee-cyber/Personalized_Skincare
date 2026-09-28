// law-links.js — 참조자료 문서 → law.go.kr 원문(최신 통합본) 링크 매퍼
// 참조자료 PDF는 전부 식약처/법제처 공식 문서라 한글주소로 원문 페이지를 열 수 있다.
// 한글주소 규약: 공백·특수문자 제거 명칭 — 법령은 /법령/, 고시·규정·기준은 /행정규칙/
// 파일명에 (발령기관)(제XXXX-N호)(시행일) 꼬리가 붙으므로 접두 매칭으로 판별.
// 매칭은 위에서 아래로 — 더 구체적인 패턴을 먼저 둘 것.

const LAW_BASE = 'https://www.law.go.kr';
const LAW_RULE = `${LAW_BASE}/법령`;      // 법률·시행령·시행규칙(총리령)
const LAW_ADM = `${LAW_BASE}/행정규칙`;   // 식약처 고시 등 행정규칙

// [매칭 문자열(공백 제거 후 contains), URL]
const LAW_DOC_URLS = [
  // ——— 법령 ———
  ['화장품법시행령', `${LAW_RULE}/화장품법시행령`],
  ['화장품법시행규칙', `${LAW_RULE}/화장품법시행규칙`],
  ['시행규칙_별표', `${LAW_RULE}/화장품법시행규칙`],   // 별표 파편 → 모법(시행규칙)
  ['화장품법(법률)', `${LAW_RULE}/화장품법`],
  ['화장품법', `${LAW_RULE}/화장품법`],
  ['개인정보', `${LAW_RULE}/개인정보보호법`],
  // ——— 행정규칙 (구체명칭 우선) ———
  ['기능성화장품심사', `${LAW_ADM}/기능성화장품심사에관한규정`],
  ['기능성화장품기준', `${LAW_ADM}/기능성화장품기준및시험방법`],
  ['KFCC', `${LAW_ADM}/기능성화장품기준및시험방법`],          // KFCC_별표* = 기능성화장품 기준 및 시험방법 별표
  ['주의사항', `${LAW_ADM}/화장품사용할때의주의사항및알레르기유발성분표시에관한규정`],
  ['알레르기', `${LAW_ADM}/화장품사용할때의주의사항및알레르기유발성분표시에관한규정`],
  ['색소', `${LAW_ADM}/화장품의색소종류및기준`],
  ['안전기준', `${LAW_ADM}/화장품안전기준등에관한규정`],
  ['우수화장품', `${LAW_ADM}/우수화장품제조및품질관리기준`],
  ['CGMP', `${LAW_ADM}/우수화장품제조및품질관리기준`],
];

/**
 * 참조자료 문서명/파일명 → law.go.kr 원문 URL (없으면 null — 순수 함수)
 * @param {string} name 예: '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf'
 * @returns {string|null}
 */
export function lawUrlFor(name) {
  if (!name) return null;
  // 표시명('시행규칙 별표7 …')과 파일명('시행규칙_별표7_….pdf') 모두 대응 — 공백·괄호·언더스코어 제거
  const key = String(name).replace(/[\s()_]/g, '').replace(/\.(pdf|md|html?)$/i, '');
  for (const [pat, url] of LAW_DOC_URLS) {
    if (key.includes(pat.replace(/[\s()_]/g, ''))) return url;
  }
  return null;
}
