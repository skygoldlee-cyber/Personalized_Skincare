// Formula OS — 광고 문구 점검 엔진 (FO-36)
// @spec FO-36
// 화장품법 제13조(의약품 오인·기능성 오인·허위·과대 표시·광고 금지)에 근거한
// 보수적 금지 표현 사전. 확실한 위험 표현만 적재한다 — 애매한 표현까지 경고하면
// 검토 도구의 신뢰가 무너진다. 판정은 참고용이며 최종 판단은 광고 심의 기준과
// 관할 지방식약청 안내를 따른다.

/* =======================================================
   금지 표현 사전 — {term, category, note, suggestion}
   term은 부분 문자열 매칭 (조사·어미 변형 포착용).
   ======================================================= */
export const AD_CATEGORIES = {
  medicine: { id: 'medicine', label: '의약품 오인', desc: '질병 치료·예방 효능 표현 — 화장품은 의약품처럼 표시·광고할 수 없음' },
  overclaim: { id: 'overclaim', label: '과대·허위 표현', desc: '절대적·검증 불가 효능 표현' },
  functional: { id: 'functional', label: '기능성 범위 주의', desc: '기능성화장품 심사(보고) 제품만 쓸 수 있는 표현 — 일반 화장품에 사용 금지' },
};

export const AD_BANNED_TERMS = [
  // 의약품 오인 — 질병·생리 작용 효능
  { term: '치료', category: 'medicine', suggestion: '개선·완화·케어' },
  { term: '치유', category: 'medicine', suggestion: '회복·케어' },
  { term: '완치', category: 'medicine', suggestion: '표현 삭제' },
  { term: '소염', category: 'medicine', suggestion: '진정·케어' },
  { term: '항염', category: 'medicine', suggestion: '진정·케어' },
  { term: '항균', category: 'medicine', suggestion: '세정·청결 — 인체 항균 표현은 의약외품 영역' },
  { term: '살균', category: 'medicine', suggestion: '세정·청결' },
  { term: '소독', category: 'medicine', suggestion: '세정·청결' },
  { term: '면역', category: 'medicine', suggestion: '표현 삭제 — 면역 관련은 의약·건기식 영역' },
  { term: '통증', category: 'medicine', suggestion: '표현 삭제' },
  { term: '염증 완화', category: 'medicine', suggestion: '진정·케어' },
  { term: '아토피', category: 'medicine', suggestion: '질병명 언급 금지 — 민감성 피부용 표현으로' },
  { term: '습진', category: 'medicine', suggestion: '질병명 언급 금지' },
  { term: '여드름 치료', category: 'medicine', suggestion: '트러블 케어 — 여드름성 피부 완화는 기능성(여드름성 피부 완화 화장품) 심사 필요' },
  { term: '탈모 치료', category: 'medicine', suggestion: '탈모 증상 완화는 기능성 심사 필요' },
  { term: '흉터 제거', category: 'medicine', suggestion: '표현 삭제' },
  { term: '세포 재생', category: 'medicine', suggestion: '피부 장벽 케어' },
  { term: '피부 재생', category: 'medicine', suggestion: '피부 장벽 케어' },
  { term: '재생 효과', category: 'medicine', suggestion: '표현 삭제' },
  { term: '기미 제거', category: 'medicine', suggestion: '미백(기능성) 범위 표현으로' },
  { term: '잡티 제거', category: 'medicine', suggestion: '미백(기능성) 범위 표현으로' },
  { term: '혈액 순환', category: 'medicine', suggestion: '표현 삭제 — 생리 기능 작용 표현' },
  { term: '해독', category: 'medicine', suggestion: '표현 삭제' },
  { term: '디톡스', category: 'medicine', suggestion: '표현 삭제' },
  { term: '녹내장', category: 'medicine', suggestion: '질병명 언급 금지' },
  { term: '항암', category: 'medicine', suggestion: '질병명 언급 금지' },

  // 과대·허위 — 절대적·검증 불가 표현
  { term: '부작용 없', category: 'overclaim', suggestion: '안전성은 개인차 — 절대 표현 삭제' },
  { term: '무자극', category: 'overclaim', suggestion: '민감성 피부용·저자극 테스트 완료(근거 있는 경우)' },
  { term: '100% 안전', category: 'overclaim', suggestion: '절대 표현 삭제' },
  { term: '100% 효과', category: 'overclaim', suggestion: '절대 표현 삭제' },
  { term: '완벽한 효과', category: 'overclaim', suggestion: '구체적 효능 범위로' },
  { term: '즉효', category: 'overclaim', suggestion: '표현 삭제' },
  { term: '즉각적 효과', category: 'overclaim', suggestion: '표현 삭제' },
  { term: '의학적 효과', category: 'overclaim', suggestion: '표현 삭제' },
  { term: '의사 처방', category: 'overclaim', suggestion: '표현 삭제' },
  { term: '병원용', category: 'overclaim', suggestion: '표현 삭제 — 의료기관 전용 오인' },
  { term: '처방전', category: 'overclaim', suggestion: '표현 삭제' },
  { term: '기적', category: 'overclaim', suggestion: '표현 삭제' },
  { term: '세계 최초', category: 'overclaim', suggestion: '근거 있는 경우에만 — 검증 불가 시 삭제' },
  { term: '영구적', category: 'overclaim', suggestion: '표현 삭제' },
  { term: '반영구', category: 'overclaim', suggestion: '표현 삭제' },

  // 기능성 범위 — 일반 화장품에 사용 시 위반
  { term: '미백', category: 'functional', suggestion: '미백 기능성 심사 제품만 표기 가능' },
  { term: '주름 개선', category: 'functional', suggestion: '주름개선 기능성 심사 제품만 표기 가능' },
  { term: '주름개선', category: 'functional', suggestion: '주름개선 기능성 심사 제품만 표기 가능' },
  { term: '자외선 차단', category: 'functional', suggestion: '자외선차단 기능성 심사 제품만 표기 가능' },
  { term: '자외선차단', category: 'functional', suggestion: '자외선차단 기능성 심사 제품만 표기 가능' },
  { term: 'SPF', category: 'functional', suggestion: '자외선차단 기능성 심사 제품만 표기 가능' },
  { term: 'PA+', category: 'functional', suggestion: '자외선차단 기능성 심사 제품만 표기 가능' },
  { term: '탈모 증상 완화', category: 'functional', suggestion: '탈모 증상 완화 기능성 심사 제품만 표기 가능' },
  { term: '튼살', category: 'functional', suggestion: '튼살 관련 표현은 기능성 심사 대상' },
];

/**
 * 문구에서 금지 표현 검색 — 위치·분류·수정 가이드 반환.
 * @param {string} text - 점검할 광고·제품 설명 문구
 * @returns {Array<{index:number, length:number, term:string, category:string, label:string, suggestion:string}>}
 *   index 오름차순, 하이라이트 렌더용. 중첩 매칭은 앞쪽(긴) 항목 우선.
 */
export function lintAdCopy(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const hits = [];
  for (const rule of AD_BANNED_TERMS) {
    let from = 0;
    for (;;) {
      const idx = text.indexOf(rule.term, from);
      if (idx < 0) break;
      hits.push({
        index: idx, length: rule.term.length, term: rule.term,
        category: rule.category, label: AD_CATEGORIES[rule.category].label,
        suggestion: rule.suggestion,
      });
      from = idx + rule.term.length;
    }
  }
  // 위치순 정렬 + 중첩 제거 — 같은 구간에 짧은 표현과 긴 표현이 겹치면 먼저 잡힌 것 유지
  hits.sort((a, b) => a.index - b.index || b.length - a.length);
  const out = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.index < lastEnd) continue;
    out.push(h);
    lastEnd = h.index + h.length;
  }
  return out;
}

/** 카테고리별 건수 집계 — {categoryId: count} */
export function summarizeLint(hits) {
  const out = {};
  for (const h of hits) out[h.category] = (out[h.category] || 0) + 1;
  return out;
}
