// src/formula-rules.js — Formula OS 추천 엔진 (규칙 기반)
//
// 고객 조건(제형·고민·피부유형·나이) → 추천 베이스·원료.
// AI 생성이 아닌 큐레이션 매핑 테이블 + 결정적 로직.
//
// 안전 원칙 (FORMULA_OS_DESIGN.md §9.3):
//   - 이름만 추천, 농도 값은 제안하지 않는다
//   - 매핑에는 approved/restricted만 허용 — banned 이름은 무결성 테스트로 차단
//   - DB에 없는 베이스 원료(정제수·유화제 등)는 후보 없이 역할명만 표시

/* =======================================================
   ① 제형 → 베이스 템플릿
   role: 베이스 역할명 / required: 수상 제형 필수 여부
   candidates: DB 매칭 후보 (비어 있으면 역할 안내만 표시)
   ======================================================= */

const R = {
  WATER:      { role: '용제 (정제수)', required: true, candidates: [] },
  HUMECTANT:  { role: '보습제', required: false, candidates: ['글리세린', '부틸렌글라이콜', '히알루론산'] },
  OIL:        { role: '오일', required: false, candidates: ['스쿠알렌', '올리브 오일', '미네랄 오일'] },
  SILICONE:   { role: '실리콘', required: false, candidates: ['다이메티콘', '사이클로메티콘'] },
  EMULSIFIER: { role: '유화제', required: false, candidates: ['솔비탄라우레이트'] },
  THICKENER:  { role: '점증제', required: false, candidates: ['카보머', '잔탄검', '히드록시에틸셀룰로오스'] },
  SURFACTANT: { role: '계면활성제', required: false, candidates: ['코카미도프로필베타인', '소듐라우레스설페이트(SLES)', '소듐라우릴설페이트(SLS)'] },
  PRESERVE:   { role: '보존제', required: true, candidates: ['페녹시에탄올', '벤질알코올', '파라벤류'] },
  PH_ADJ:     { role: 'pH 조절제', required: false, candidates: ['트리알킬아민, 트리알칸올아민 및 그 염류'] },
  UV:         { role: '자외선차단제', required: true, candidates: ['티타늄디옥사이드', '징크옥사이드', '옥토크릴렌', '에칠헥실살리실레이트', '호모살레이트'] },
  ANTIOX:     { role: '산화방지제', required: false, candidates: ['토코페롤(비타민E)', 'BHT', '부틸하이드록시아니솔(BHA)'] },
};

export const BASE_TEMPLATES = Object.freeze({
  '세럼·에센스':  [R.WATER, R.HUMECTANT, R.THICKENER, R.PRESERVE],
  '토너·미스트':  [R.WATER, R.HUMECTANT, R.PRESERVE],
  '로션·에멀전':  [R.WATER, R.OIL, R.EMULSIFIER, R.HUMECTANT, R.PRESERVE],
  '크림·밤':      [R.WATER, R.OIL, R.EMULSIFIER, R.THICKENER, R.PRESERVE],
  '젤':           [R.WATER, R.THICKENER, R.PH_ADJ, R.PRESERVE],
  '오일':         [R.OIL, R.ANTIOX],
  '클렌저':       [R.SURFACTANT, R.HUMECTANT, R.THICKENER, R.PRESERVE],
  '선크림':       [R.UV, { role: '오일·실리콘', required: false, candidates: ['다이메티콘', '스쿠알렌'] }, R.EMULSIFIER, R.PRESERVE],
  '마스크·팩':    [R.WATER, R.HUMECTANT, R.THICKENER, R.PRESERVE],
});

/* =======================================================
   ② 고민 → 기능성 원료 매핑 (큐레이션)
   ======================================================= */

export const CONCERN_INGREDIENTS = Object.freeze({
  '건조':         ['히알루론산', '세라마이드', '판테놀', '스쿠알렌', '글리세린'],
  '피지·모공':    ['아연PCA', '살리실산', '나이아신아마이드'],
  '여드름·트러블': ['살리실산', '아연PCA', '시카(센텔라아시아티카)'],
  '민감·홍조':    ['시카(센텔라아시아티카)', '판테놀', '세라마이드', '이눌린'],
  '미백·잡티':    ['나이아신아마이드', '알부틴', '비타민C(아스코르브산)'],
  '주름·탄력':    ['아데노신', '레티놀', '콜라겐'],
  '각질':         ['살리실산', '살리실릭애씨드'],
  '진정':         ['시카(센텔라아시아티카)', '판테놀', '알파글루칸올리고사카라이드'],
});

// 피부유형 → 추가 추천 (이유 태그 '피부유형')
const SKIN_INGREDIENTS = Object.freeze({
  '건성':   ['세라마이드', '스쿠알렌', '올리브 오일'],
  '지성':   ['아연PCA', '히알루론산'],
  '복합성': ['나이아신아마이드', '히알루론산'],
  '민감성': ['시카(센텔라아시아티카)', '판테놀'],
  '중성':   [],
});

/* =======================================================
   ③ 주의문 규칙
   ======================================================= */

// 나이 조건 시 자극 주의 대상 원료
const IRRITANT_INGREDIENTS = ['레티놀', '살리실산', '살리실릭애씨드', '알파-하이드록시애씨드(AHA)'];

/**
 * 고객 조건으로 추천을 생성한다.
 * @param {object} customer - {gender, age, skinType, concerns[], formulation}
 * @param {Map<string,object>} index - buildIngredientIndex() 결과
 * @returns {{bases:Array, ingredients:Array<{name,reasons,type,limit,irritant}>, cautions:string[]}}
 */
export function recommendFor(customer, index) {
  const result = { bases: [], ingredients: [], cautions: [] };
  if (!customer || typeof customer !== 'object') return result;

  // ① 제형 → 베이스 템플릿
  const template = BASE_TEMPLATES[customer.formulation];
  if (template) {
    result.bases = template.map(r => ({
      role: r.role,
      required: !!r.required,
      candidates: r.candidates.slice(),
    }));
  }

  // ② 고민 + 피부유형 → 원료 추천 (이름 dedupe, 이유 수집)
  const seen = new Map(); // name → {reasons:Set}
  const add = (name, reason) => {
    if (!seen.has(name)) seen.set(name, { reasons: new Set([reason]) });
    else seen.get(name).reasons.add(reason);
  };
  (Array.isArray(customer.concerns) ? customer.concerns : []).forEach(c => {
    (CONCERN_INGREDIENTS[c] || []).forEach(name => add(name, c));
  });
  (SKIN_INGREDIENTS[customer.skinType] || []).forEach(name => add(name, '피부유형'));

  const age = typeof customer.age === 'number' ? customer.age : null;
  const youngOrOld = age != null && (age < 20 || age > 65);

  for (const [name, meta] of seen) {
    const ing = index && index.get(name);
    if (!ing) continue; // DB 없는 이름은 추천하지 않음 (매핑 무결성은 테스트가 강제)
    result.ingredients.push({
      name,
      reasons: [...meta.reasons],
      type: ing.type || '',
      limit: ing.limit || '',
      irritant: youngOrOld && IRRITANT_INGREDIENTS.includes(name),
    });
  }

  // ③ 주의문
  if (customer.skinType === '민감성') {
    result.cautions.push('민감성 피부: 향료·에탄올 계열은 자극 가능성 — 소량 패치 테스트 권장');
  }
  if (youngOrOld) {
    result.cautions.push(
      age < 20
        ? '20세 미만: 고기능성·각질제거 원료는 저농도부터 시작 권장'
        : '65세 이상: 피부 장벽 약화 가능 — 자극 원료는 저농도 권장'
    );
  }

  return result;
}

/** '베이스 불러오기' 대상: 템플릿에서 required 역할의 첫 후보 이름들 */
export function baseDefaultCandidates(formulation) {
  const template = BASE_TEMPLATES[formulation];
  if (!template) return [];
  return template
    .filter(r => r.required && r.candidates.length)
    .map(r => r.candidates[0]);
}

// 매핑 무결성 점검용 — 테스트에서 참조하는 전체 추천 이름 수집
export function allRuleIngredientNames() {
  const names = new Set();
  Object.values(BASE_TEMPLATES).flat().forEach(r => r.candidates.forEach(n => names.add(n)));
  Object.values(CONCERN_INGREDIENTS).flat().forEach(n => names.add(n));
  Object.values(SKIN_INGREDIENTS).flat().forEach(n => names.add(n));
  return names;
}

// CUSTOMER_OPTIONS와의 정합성 검증용 (테스트에서 사용)
export const _RULE_KEYS = Object.freeze({
  formulations: Object.keys(BASE_TEMPLATES),
  concerns: Object.keys(CONCERN_INGREDIENTS),
});
