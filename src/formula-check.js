// src/formula-check.js — Formula OS 규정 Check 엔진 (Phase 5-A)
//
// 원료 + 배합 농도(%) → 법정 한도 검증. 배합을 "생성"하지 않고 공식 고시
// 데이터로 "검증"만 수행한다 (생성·검증 분리 원칙).
//
// 핵심 원칙: 파싱 실패·모호한 경우는 반드시 'unknown'.
// 잘못된 ok/warn 판정보다 사람이 원문을 확인하게 하는 미탐이 안전하다.

export const CHECK = Object.freeze({
  OK: 'ok',
  WARN: 'warn',
  BANNED: 'banned',
  UNKNOWN: 'unknown',
});

// "5.0%"·"0.0015%" 형태의 백분율 수치 추출
const PCT_RE = /(\d+(?:\.\d+)?)\s*%/g;
// "N% 초과 시 표시" — 사용 한도가 아니라 라벨 표시 기준
const LABELING_RE = /초과\s*시\s*표시/;
// 명시적 금지 표현
const BAN_TEXT_RE = /사용\s*불가|사용\s*금지/;

/**
 * 한도 문자열을 파싱한다.
 * @param {string|null|undefined} limitText - INGREDIENTS_DATA의 limit 필드
 * @returns {{values:number[], primary:number|null, conditional:boolean, labeling:boolean}}
 *   values: 발견된 % 수치 전부 (내림차순 아님, 원문 순서)
 *   primary: 검증 기준값 = 가장 엄격한 값(min). 수치 없으면 null
 *   conditional: 수치 외 적용 조건 텍스트 존재 여부 (제품별/씻어내는 등)
 *   labeling: "N% 초과 시 표시" 등 한도가 아닌 표시 기준 여부
 */
export function parseLimitText(limitText) {
  const result = { values: [], primary: null, conditional: false, labeling: false };
  if (!limitText || typeof limitText !== 'string') return result;

  const text = limitText.trim();
  if (!text) return result;

  if (LABELING_RE.test(text)) {
    result.labeling = true;
    return result;
  }

  const values = [];
  let m;
  PCT_RE.lastIndex = 0;
  while ((m = PCT_RE.exec(text)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isNaN(v)) values.push(v);
  }
  result.values = values;

  if (values.length > 0) {
    result.primary = Math.min(...values);
    // 수치와 구분 기호(쉼표·중점·공백·괄호조건)를 제외한 텍스트가 남으면 조건부로 간주
    const stripped = text
      .replace(PCT_RE, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[,\s•·.\-–—]/g, '');
    // 괄호 안 조건도 실질 조건이므로, 괄호가 있었거나 잔여 문자가 있으면 conditional
    result.conditional = /\([^)]*\)/.test(text) || stripped.length > 0 || values.length > 1;
  }
  return result;
}

/**
 * 단일 원료의 배합 농도를 검증한다.
 * @param {object|null} ingredient - INGREDIENTS_DATA 항목 {name,type,limit,...}
 * @param {number|string} concentration - 배합 농도 (%)
 * @returns {{check:string, primaryLimit:number|null, conditional:boolean, note:string, raw:string}}
 */
export function checkIngredient(ingredient, concentration) {
  const base = { check: CHECK.UNKNOWN, primaryLimit: null, conditional: false, note: '', raw: '' };

  if (!ingredient || typeof ingredient !== 'object') {
    return { ...base, note: '원료 DB에서 찾을 수 없습니다 — 한도를 직접 확인하세요.' };
  }
  base.raw = ingredient.limit || '';

  // 사용 금지 원료 — 수치 검증 이전에 차단
  if (ingredient.type === 'banned' || BAN_TEXT_RE.test(ingredient.limit || '')) {
    return { ...base, check: CHECK.BANNED, note: '사용 금지 원료 — 배합 불가' };
  }

  const conc = typeof concentration === 'string' ? parseFloat(concentration) : concentration;
  if (typeof conc !== 'number' || Number.isNaN(conc)) {
    return { ...base, note: '농도 미입력 — 배합률(%)을 입력하면 한도를 검증합니다.' };
  }
  if (conc <= 0) {
    return { ...base, note: '농도 확인 필요 — 0% 초과로 입력하세요.' };
  }

  const parsed = parseLimitText(ingredient.limit);
  base.primaryLimit = parsed.primary;
  base.conditional = parsed.conditional;

  // 한도 정보가 없는 경우
  if (!parsed.values.length) {
    if (parsed.labeling) {
      return { ...base, note: '표시 기준 수치 — 사용 한도가 아닙니다. 원문 확인.' };
    }
    if (!base.raw) {
      // 한도 표기 없음: approved는 사용 가능, restricted는 확인 필요
      return ingredient.type === 'restricted'
        ? { ...base, note: '사용 제한 원료 — 한도 정보가 없어 원문 확인이 필요합니다.' }
        : { ...base, check: CHECK.OK, note: '제한 없음 (사용 가능 원료)' };
    }
    return { ...base, note: '한도 수치 해석 불가 — 원문을 확인하세요.' };
  }

  if (conc > parsed.primary) {
    return {
      ...base,
      check: CHECK.WARN,
      note: `기준 한도 ${parsed.primary}% 초과${parsed.conditional ? ' — 조건별 한도 확인 필요' : ''}`,
    };
  }
  return {
    ...base,
    check: CHECK.OK,
    note: parsed.conditional ? '한도 이내 — 조건부 한도(제품류·씻어내는 등) 적용 여부 확인' : '한도 이내',
  };
}

/**
 * 원료 이름 → 항목 인덱스를 생성한다.
 * @param {Array<object>} ingredients - INGREDIENTS_DATA
 * @returns {Map<string, object>}
 */
export function buildIngredientIndex(ingredients) {
  const index = new Map();
  if (!Array.isArray(ingredients)) return index;
  for (const ing of ingredients) {
    if (ing && typeof ing.name === 'string' && !index.has(ing.name)) {
      index.set(ing.name, ing);
    }
  }
  return index;
}

/**
 * 포뮬러의 원료 배열 전체를 검증한다.
 * @param {Array<{name:string, concentration:number|string}>} items
 * @param {Map<string, object>} index - buildIngredientIndex() 결과
 * @returns {{results: Array<object>, summary: {ok:number, warn:number, banned:number, unknown:number}}}
 */
export function checkFormulaItems(items, index) {
  const results = [];
  const summary = { ok: 0, warn: 0, banned: 0, unknown: 0 };
  if (!Array.isArray(items)) return { results, summary };

  for (const item of items) {
    if (!item) continue;
    const ingredient = index && typeof item.name === 'string' ? index.get(item.name) : null;
    const r = checkIngredient(ingredient, item.concentration);
    results.push({ name: item.name, ...r });
    summary[r.check] += 1;
  }
  return { results, summary };
}
