/* ============================================================
 * tools/drill-utils.js — O/X·복수정답형 드릴 생성기 공용 유틸
 * ------------------------------------------------------------
 * inferTags: 문항 텍스트에서 STANDARD_TAGS(src/questions.js) 어휘를 추론.
 *   "숫자·기준 카드 덱"(docs/dev/COMBO_STUDY_STRATEGY.md §2-④) 필터용 태그 부여에 사용.
 * ============================================================ */
'use strict';

// STANDARD_TAGS = ['수치','한도','기한','금지원료','처분기준','구성비','절차','정의']
const TAG_RULES = [
  [/금지|사용 ?불가|배합 ?불가|사용 ?제한|쓸 수 없/, '금지원료'],
  [/벌금|징역|처분|과태료|영업 ?정지|허가 ?취소|등록 ?취소|고발/, '처분기준'],
  [/기한|이내|경과|주기|유효 ?기간|만료|보존 ?연한|사용 ?기한|제조일자|매년|반기/, '기한'],
  [/절차|신고|등록|허가|승인|제출|보고|검사 ?방법|순서|심사/, '절차'],
  [/한도|%|퍼센트|함량|농도|배합/, '한도'],
  [/구성 ?비|비율|비중|분포|포함/, '구성비'],
  [/\d/, '수치'],
  [/정의|이란|의미|뜻/, '정의'],
];

/**
 * 텍스트(발문+진술 합본)에서 표준 태그 추론 — 매칭된 태그 배열 (중복 없음, 최대 3개)
 * @param {...string} texts
 * @returns {string[]}
 */
function inferTags(...texts) {
  const joined = texts.filter(Boolean).join(' ');
  const tags = [];
  for (const [re, tag] of TAG_RULES) {
    if (re.test(joined) && !tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, 3);
}

module.exports = { inferTags };
