// src/usage-guide.js — Formula OS 사용 안내문 생성기 (Phase A)
//
// 무상태 생성기: 포뮬러(또는 배치 스냅샷)의 제형·원료·고객 조건으로
// 사용법·보관법·주의사항 문구를 조립한다. 생성된 문구는 일반 지침일 뿐
// 법적 적합성·안전성은 사용자가 확인해야 한다 — 면책 문구를 항상 병기한다.
//
// buildUsageGuide({ formulation, ingredientNames, customer }) →
//   { directions: string, storage: string, cautions: string[] }

// 제형별 사용법·보관법 템플릿 — CUSTOMER_OPTIONS.formulation 키와 대응
const FORMULATION_GUIDES = {
  '세럼·에센스': {
    directions: '세안 후 토너로 피부결을 정돈한 뒤 적량(2~3방울)을 얼굴 전체에 부드럽게 펴 바르고 흡수시킵니다. 이후 로션·크림 단계로 마무리하세요.',
    storage: '직사광선과 고온을 피해 서늘한 곳에 보관하세요. 개봉 후 3개월 이내 사용을 권장합니다.',
  },
  '토너·미스트': {
    directions: '세안 직후 화장솜에 적셔 피부결을 따라 닦아내거나, 손바닥에 덜어 가볍게 두드려 흡수시킵니다. 미스트는 20~30cm 거리에서 분사합니다.',
    storage: '직사광선을 피해 실온 보관하세요. 눈에 들어가지 않도록 주의하세요.',
  },
  '로션·에멀전': {
    directions: '세럼·에센스 다음 단계에서 적량을 얼굴과 목에 골고루 펴 바릅니다.',
    storage: '직사광선과 고온을 피해 서늘한 곳에 보관하세요. 개봉 후 6개월 이내 사용을 권장합니다.',
  },
  '크림·밤': {
    directions: '스킨케어 마지막 단계에서 적량을 덜어 얼굴 전체에 부드럽게 펴 바릅니다. 건조한 부위에는 한 번 더 얇게 덧바릅니다.',
    storage: '직사광선과 고온을 피해 서늘한 곳에 보관하세요. 개봉 후 6개월 이내 사용을 권장합니다.',
  },
  '젤': {
    directions: '적량을 덜어 피부에 얇게 펴 바릅니다. 수분 공급·진정 목적으로 냉장 보관 후 사용하면 청량감이 높아집니다.',
    storage: '직사광선을 피해 보관하세요. 냉장 보관 시 응고되지 않는지 확인 후 사용하세요.',
  },
  '오일': {
    directions: '스킨케어 마지막 단계 또는 크림과 섞어 사용합니다. 2~3방울을 손바닥에서 데운 뒤 가볍게 눌러 흡수시킵니다.',
    storage: '직사광선과 고온·산화를 피해 밀봉하여 서늘한 곳에 보관하세요.',
  },
  '클렌저': {
    directions: '적량을 물과 함께 거품 낸 뒤 얼굴을 부드럽게 마사지하고 미온수로 충분히 헹굽니다.',
    storage: '물이 들어가지 않도록 주의하고 실온 보관하세요.',
  },
  '선크림': {
    directions: '외출 15~30분 전에 적량을 얼굴·목 등 노출 부위에 골고루 펴 바릅니다. 장시간 야외 활동 시 2~3시간 간격으로 덧바릅니다.',
    storage: '고온(차량 내부 등)과 직사광선을 피해 보관하세요. 개봉 후 6개월 이내 사용을 권장합니다.',
  },
  '마스크·팩': {
    directions: '세안 후 피부에 고르게 도포하고 10~15분 후 미온수로 헹구거나 떼어냅니다. 주 1~2회 사용을 권장합니다.',
    storage: '직사광선을 피해 서늘한 곳에 보관하세요. 개봉 후에는 가급적 빨리 사용하세요.',
  },
};

// 원료별 주의 규칙 — 원료명 정규식 매칭 (한국명·INCI 영문명 모두 커버)
const INGREDIENT_CAUTIONS = [
  {
    re: /레티놀|레티날|레티닐|retinol|retinal|retinyl/i,
    msg: '레티노이드 함유 — 야간 사용을 권장하며, 주간에는 자외선 차단제를 병용하세요. 임신·수유 중에는 사용 전 전문가와 상담하세요.',
  },
  {
    re: /\bAHA\b|글리콜릭|젖산|락틱|glycolic|lactic\s*acid|만델릭|mandelic/i,
    msg: 'AHA(각질 제거산) 함유 — 자외선 민감도가 높아질 수 있으므로 자외선 차단을 병행하고, 첫 사용 전 패치 테스트를 권장합니다.',
  },
  {
    re: /\bBHA\b|살리실산|salicylic/i,
    msg: 'BHA(살리실산) 함유 — 저농도·국소 부위 위주로 사용하고, 민감 피부는 패치 테스트 후 사용하세요.',
  },
  {
    re: /아스코르빅|아스코빅|비타민\s*C|ascorbic|에틸아스코빌/i,
    msg: '비타민C 계열 함유 — 개봉 후 냉장 보관하고 단기간에 사용하세요. 변색(갈변) 시 사용을 중지하세요.',
  },
  {
    re: /향료|에센셜\s*오일|fragrance|parfum|라벤더|티트리|페퍼민트|유칼립투스|시트라/i,
    msg: '향료·에센셜오일 함유 — 민감 피부는 팔 안쪽에 패치 테스트 후 사용하세요.',
  },
  {
    re: /에탄올|변성알코올|ethanol|alcohol\s*denat/i,
    msg: '알코올 함유 — 건조·민감 피부는 사용 빈도를 조절하세요.',
  },
  {
    re: /벤조일퍼옥사이드|benzoyl/i,
    msg: '벤조일퍼옥사이드 함유 — 의약외품 성분, 표시 농도와 사용 부위를 반드시 확인하세요.',
  },
];

const GUIDE_DISCLAIMER = '본 안내문은 일반적인 사용 지침입니다. 실제 사용 전 고객의 피부 상태와 알레르기 이력을 확인하고, 이상이 있으면 사용을 중지하세요.';

/**
 * 사용 안내문 조립.
 * @param {object} input
 * @param {string} [input.formulation] - 제형 (CUSTOMER_OPTIONS.formulation 값)
 * @param {string[]} [input.ingredientNames] - 배합 원료명 배열
 * @param {object} [input.customer] - {allergies[], pregnancy} 등 고객 조건
 * @returns {{directions:string, storage:string, cautions:string[]}}
 */
export function buildUsageGuide(input) {
  const src = input && typeof input === 'object' ? input : {};
  const formulation = typeof src.formulation === 'string' ? src.formulation : '';
  const names = Array.isArray(src.ingredientNames) ? src.ingredientNames : [];
  const customer = src.customer && typeof src.customer === 'object' ? src.customer : {};

  const guide = FORMULATION_GUIDES[formulation] || {
    directions: '적량을 피부에 골고루 펴 바르고 흡수시킵니다.',
    storage: '직사광선과 고온·저온을 피해 실온의 서늘한 곳에 보관하세요.',
  };

  const cautions = [];
  INGREDIENT_CAUTIONS.forEach(rule => {
    const hit = names.find(n => typeof n === 'string' && rule.re.test(n));
    if (hit) cautions.push(`${hit}: ${rule.msg}`);
  });

  if (customer.pregnancy) {
    cautions.push('임신·수유 중 고객 — 사용 전 전문가(의사) 상담을 권장합니다.');
  }
  const allergies = Array.isArray(customer.allergies) ? customer.allergies : [];
  const hits = allergies.filter(a => names.some(n => n === a || (typeof n === 'string' && n.includes(a))));
  hits.forEach(a => {
    cautions.push(`알레르기 이력 원료 "${a}" 포함 — 사용 금지 또는 전문가 상담이 필요합니다.`);
  });
  cautions.push(GUIDE_DISCLAIMER);

  return { directions: guide.directions, storage: guide.storage, cautions };
}

/** 포뮬러 객체에서 바로 안내문 생성 — formulation은 customer.formulation, 원료는 ingredients[].name */
export function buildUsageGuideFromFormula(formula) {
  const f = formula && typeof formula === 'object' ? formula : {};
  return buildUsageGuide({
    formulation: f.customer && f.customer.formulation,
    ingredientNames: Array.isArray(f.ingredients) ? f.ingredients.map(i => i.name) : [],
    customer: f.customer,
  });
}

/** 배치에서 안내문 생성 — 저장 시점 스냅샷(formulation·fullIngredients) 사용 */
export function buildUsageGuideFromBatch(batch) {
  const b = batch && typeof batch === 'object' ? batch : {};
  return buildUsageGuide({
    formulation: b.formulation,
    ingredientNames: Array.isArray(b.fullIngredients) ? b.fullIngredients : [],
    customer: { allergies: [], pregnancy: '' },
  });
}
