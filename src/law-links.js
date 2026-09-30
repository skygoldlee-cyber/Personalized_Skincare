// src/law-links.js — 참조 문서 → law.go.kr 원문(최신 통합본) 링크 매퍼
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

const _DEFAULT_EXAM_ID = "cosmetic";

const _EXAM_LAW_URLS = {
    "cosmetic": [
    ["화장품법시행령", "https://www.law.go.kr/법령/화장품법시행령"],
    ["화장품법시행규칙", "https://www.law.go.kr/법령/화장품법시행규칙"],
    ["시행규칙_별표", "https://www.law.go.kr/법령/화장품법시행규칙"],
    ["화장품법(법률)", "https://www.law.go.kr/법령/화장품법"],
    ["화장품법", "https://www.law.go.kr/법령/화장품법"],
    ["개인정보", "https://www.law.go.kr/법령/개인정보보호법"],
    ["기능성화장품심사", "https://www.law.go.kr/행정규칙/기능성화장품심사에관한규정"],
    ["기능성화장품기준", "https://www.law.go.kr/행정규칙/기능성화장품기준및시험방법"],
    ["KFCC", "https://www.law.go.kr/행정규칙/기능성화장품기준및시험방법"],
    ["주의사항", "https://www.law.go.kr/행정규칙/화장품사용할때의주의사항및알레르기유발성분표시에관한규정"],
    ["알레르기", "https://www.law.go.kr/행정규칙/화장품사용할때의주의사항및알레르기유발성분표시에관한규정"],
    ["색소", "https://www.law.go.kr/행정규칙/화장품의색소종류및기준"],
    ["colorants_ingredients", "https://www.law.go.kr/행정규칙/화장품의색소종류및기준"],
    ["안전기준", "https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정"],
    ["banned_ingredients", "https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정"],
    ["restricted_ingredients", "https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정"],
    ["우수화장품", "https://www.law.go.kr/행정규칙/우수화장품제조및품질관리기준"],
    ["CGMP", "https://www.law.go.kr/행정규칙/우수화장품제조및품질관리기준"]
    ],
    "food": [
    ["식품위생법시행규칙", "https://www.law.go.kr/법령/식품위생법시행규칙"],
    ["식품위생법시행령", "https://www.law.go.kr/법령/식품위생법시행령"],
    ["식품위생법(법률)", "https://www.law.go.kr/법령/식품위생법"],
    ["식품위생법", "https://www.law.go.kr/법령/식품위생법"],
    ["식품의기준및규격", "https://www.law.go.kr/행정규칙/식품의기준및규격"],
    ["식품공전", "https://www.law.go.kr/행정규칙/식품의기준및규격"],
    ["식품등의표시기준", "https://www.law.go.kr/행정규칙/식품등의표시기준"],
    ["식품등의 표시기준", "https://www.law.go.kr/행정규칙/식품등의표시기준"],
    ["식품첨가물의기준및규격", "https://www.law.go.kr/행정규칙/식품첨가물의기준및규격"],
    ["식품첨가물공전", "https://www.law.go.kr/행정규칙/식품첨가물의기준및규격"]
    ]
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
  const key = String(name).replace(/[\s()_]/g, '').replace(/\.(pdf|md|html?)$/i, '');
  for (const [pat, url] of activeLawUrls()) {
    if (key.includes(pat.replace(/[\s()_]/g, ''))) return url;
  }
  return null;
}
