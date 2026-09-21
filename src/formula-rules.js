// src/formula-rules.js — Formula OS 추천 엔진 (규칙 기반)
//
// 고객 조건(제형·고민·피부유형·나이) → 추천 베이스·원료.
// AI 생성이 아닌 큐레이션 매핑 테이블 + 결정적 로직.
//
// 안전 원칙 (FORMULA_OS_DESIGN.md §9.3):
//   - 이름만 추천, 농도 값은 제안하지 않는다
//   - 매핑에는 approved/restricted만 허용 — banned 이름은 무결성 테스트로 차단
//   - 사용자 커스텀 후보도 런타임에 banned/미등록 이름을 필터링한다
//   - DB에 없는 베이스 원료(정제수·유화제 등)는 후보 없이 역할명만 표시

import { safeGetItem, safeSetItem } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';

/* =======================================================
   ① 제형 → 베이스 템플릿
   role: 베이스 역할명 / required: 수상 제형 필수 여부
   candidates: DB 매칭 후보 (비어 있으면 역할 안내만 표시)
   ======================================================= */

const R = {
  WATER:      { role: '용제 (정제수)', required: true, candidates: ['부틸렌글라이콜', '프로필렌글라이콜', '디프로필렌글라이콜', '에탄올', '아이소프로필알코올'] },
  HUMECTANT:  { role: '보습제', required: false, candidates: ['글리세린', '부틸렌글라이콜', '프로필렌글라이콜', '히알루론산', '판테놀'] },
  OIL:        { role: '오일', required: false, candidates: ['스쿠알렌', '올리브 오일', '코코넛 오일', '미네랄 오일', '호호바오일', '아르간오일'] },
  SILICONE:   { role: '실리콘', required: false, candidates: ['다이메티콘', '사이클로메티콘', '사이클로펜타실록세인', '디메치콘올', '페닐트리메치콘'] },
  EMULSIFIER: { role: '유화제', required: false, candidates: ['솔비탄라우레이트', '글리세릴스테아레이트', '세테아릴알코올', '폴리소르베이트60', '세테아릴글루코사이드', '레시틴', '스테아릭애씨드', '폴리소르베이트20'] },
  THICKENER:  { role: '점증제', required: false, candidates: ['카보머', '잔탄검', '히드록시에틸셀룰로오스', '알기네이트', '셀룰로오스'] },
  SURFACTANT: { role: '계면활성제', required: false, candidates: ['코카미도프로필베타인', '소듐라우레스설페이트(SLES)', '소듐라우릴설페이트(SLS)', '데실글루코사이드', '코코글루코사이드'] },
  PRESERVE:   { role: '보존제', required: true, candidates: ['페녹시에탄올', '벤질알코올', '파라벤류', '벤조익애씨드', '메칠클로로이소치아졸리논'] },
  PH_ADJ:     { role: 'pH 조절제', required: false, candidates: ['시트릭애씨드', '소듐시트레이트', '포타슘하이드록사이드 또는 소듐하이드록사이드', '트리알킬아민, 트리알칸올아민 및 그 염류', '암모니아'] },
  UV:         { role: '자외선차단제', required: true, candidates: ['티타늄디옥사이드', '징크옥사이드', '옥토크릴렌', '에칠헥실살리실레이트', '호모살레이트'] },
  ANTIOX:     { role: '산화방지제', required: false, candidates: ['토코페롤(비타민E)', 'BHT', '부틸하이드록시아니솔(BHA)', '아스코르빌팔미테이트', '프로필갈레이트'] },
};

export const BASE_TEMPLATES = Object.freeze({
  '세럼·에센스':  [R.WATER, R.HUMECTANT, R.THICKENER, R.PRESERVE],
  '토너·미스트':  [R.WATER, R.HUMECTANT, R.PRESERVE],
  '로션·에멀전':  [R.WATER, R.OIL, R.EMULSIFIER, R.HUMECTANT, R.PRESERVE],
  '크림·밤':      [R.WATER, R.OIL, R.EMULSIFIER, R.THICKENER, R.PRESERVE],
  '젤':           [R.WATER, R.THICKENER, R.PH_ADJ, R.PRESERVE],
  '오일':         [R.OIL, R.ANTIOX],
  '클렌저':       [R.SURFACTANT, R.HUMECTANT, R.THICKENER, R.PRESERVE],
  '선크림':       [R.UV, { role: '오일·실리콘', required: false, candidates: ['다이메티콘', '사이클로메티콘', '사이클로펜타실록세인', '스쿠알렌', '미네랄 오일'] }, R.EMULSIFIER, R.PRESERVE],
  '마스크·팩':    [R.WATER, R.HUMECTANT, R.THICKENER, R.PRESERVE],
});

/* =======================================================
   ② 고민 → 기능성 원료 매핑 (큐레이션)
   ======================================================= */

export const CONCERN_INGREDIENTS = Object.freeze({
  '건조':         ['히알루론산', '세라마이드', '판테놀', '스쿠알렌', '글리세린'],
  '피지·모공':    ['아연PCA', '살리실산', '나이아신아마이드', '살리실릭애씨드', '알란토인클로로하이드록시알루미늄(알클록사)'],
  '여드름·트러블': ['살리실산', '아연PCA', '시카(센텔라아시아티카)', '살리실릭애씨드', '알란토인클로로하이드록시알루미늄(알클록사)'],
  '민감·홍조':    ['시카(센텔라아시아티카)', '판테놀', '세라마이드', '이눌린', '알란토인클로로하이드록시알루미늄(알클록사)'],
  '미백·잡티':    ['나이아신아마이드', '알부틴', '비타민C(아스코르브산)', '아스코르빌팔미테이트', '알파-하이드록시애씨드(AHA)'],
  '주름·탄력':    ['아데노신', '레티놀', '콜라겐', '비타민C(아스코르브산)', '알에이치(또는 에스에이치) 올리고펩타이드-1(상피세포성장인자)'],
  '각질':         ['살리실산', '살리실릭애씨드', '알파-하이드록시애씨드(AHA)', '우레아', '시트릭애씨드'],
  '진정':         ['시카(센텔라아시아티카)', '판테놀', '알파글루칸올리고사카라이드', '이눌린', '알란토인클로로하이드록시알루미늄(알클록사)'],
});

// 피부유형 → 추가 추천 (이유 태그 '피부유형')
const SKIN_INGREDIENTS = Object.freeze({
  '건성':   ['세라마이드', '스쿠알렌', '올리브 오일', '판테놀', '히알루론산'],
  '지성':   ['아연PCA', '히알루론산', '나이아신아마이드', '살리실산', '알란토인클로로하이드록시알루미늄(알클록사)'],
  '복합성': ['나이아신아마이드', '히알루론산', '글리세린', '판테놀', '스쿠알렌'],
  '민감성': ['시카(센텔라아시아티카)', '판테놀', '세라마이드', '이눌린', '알란토인클로로하이드록시알루미늄(알클록사)'],
  '중성':   ['히알루론산', '판테놀', '세라마이드', '글리세린', '스쿠알렌'],
});

/* =======================================================
   ③ 주의문 규칙
   ======================================================= */

// 나이 조건 시 자극 주의 대상 원료
const IRRITANT_INGREDIENTS = ['레티놀', '살리실산', '살리실릭애씨드', '알파-하이드록시애씨드(AHA)'];

/* =======================================================
   ④ 사용자 맞춤 추천 규칙 (localStorage 병합)
   스키마: { base:{역할:[이름]}, concern:{고민:[이름]}, skin:{피부유형:[이름]} }
   기본 매핑에 "추가"만 병합 — 기본값 삭제는 불가 (초기화로 전체 리셋).
   ======================================================= */

const CUSTOM_SCOPES = ['base', 'concern', 'skin'];
const MAX_CUSTOM_PER_KEY = 30;

function emptyCustomRules() {
  return { base: {}, concern: {}, skin: {} };
}

/** 파싱된 객체 → 정제된 규칙 구조 (스키마 외 값·중복·초과분 제거) */
function sanitizeRulesObject(parsed) {
  const rules = emptyCustomRules();
  CUSTOM_SCOPES.forEach(scope => {
    const bucket = parsed && parsed[scope];
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return;
    Object.entries(bucket).forEach(([key, list]) => {
      if (!Array.isArray(list)) return;
      const names = [...new Set(list
        .filter(n => typeof n === 'string' && n.trim())
        .map(n => n.trim()))].slice(0, MAX_CUSTOM_PER_KEY);
      if (names.length) rules[scope][key] = names;
    });
  });
  return rules;
}

/** 저장된 맞춤 규칙 로드 (손상·누락 시 빈 규칙) */
export function loadCustomRules() {
  const raw = safeGetItem(STORAGE_KEYS.FORMULA_RULES);
  if (!raw) return emptyCustomRules();
  try {
    return sanitizeRulesObject(JSON.parse(raw));
  } catch (e) {
    return emptyCustomRules();
  }
}

function saveCustomRules(rules) {
  return safeSetItem(STORAGE_KEYS.FORMULA_RULES, JSON.stringify(rules));
}

/** 맞춤 후보 추가. @returns {{ok:boolean, error?:string}} */
export function addCustomCandidate(scope, key, name) {
  if (!CUSTOM_SCOPES.includes(scope)) return { ok: false, error: '대상 구분이 올바르지 않습니다.' };
  if (typeof key !== 'string' || !key.trim()) return { ok: false, error: '대상을 선택하세요.' };
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) return { ok: false, error: '원료명을 입력하세요.' };
  const rules = loadCustomRules();
  const list = rules[scope][key] || (rules[scope][key] = []);
  if (list.includes(n)) return { ok: false, error: '이미 등록된 후보입니다.' };
  if (list.length >= MAX_CUSTOM_PER_KEY) return { ok: false, error: `후보는 대상당 최대 ${MAX_CUSTOM_PER_KEY}개입니다.` };
  list.push(n);
  if (!saveCustomRules(rules)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true };
}

/** 맞춤 후보 제거. @returns {{ok:boolean, error?:string}} */
export function removeCustomCandidate(scope, key, name) {
  if (!CUSTOM_SCOPES.includes(scope)) return { ok: false, error: '대상 구분이 올바르지 않습니다.' };
  const rules = loadCustomRules();
  const list = rules[scope] && rules[scope][key];
  if (!list) return { ok: false, error: '등록된 후보가 없습니다.' };
  const next = list.filter(n => n !== name);
  if (next.length) rules[scope][key] = next;
  else delete rules[scope][key];
  if (!saveCustomRules(rules)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true };
}

/** 맞춤 규칙 전체 초기화 */
export function resetCustomRules() {
  return saveCustomRules(emptyCustomRules());
}

/* ---------- 외부 JSON 규칙 파일 가져오기/내보내기 ----------
   포맷:
   {
     "version": 1,
     "base":    { "<베이스 역할명>": ["원료명", ...] },
     "concern": { "<피부 고민 키>": ["원료명", ...] },
     "skin":    { "<피부 유형 키>": ["원료명", ...] }
   }
   version 등 메타 필드는 무시. 이름은 런타임에 banned·미등록 필터 적용.
   --------------------------------------------------------- */

const CUSTOM_RULES_FORMAT_VERSION = 1;

/** 현재 맞춤 규칙을 외부 공유용 JSON 문자열로 직렬화 */
export function serializeCustomRules() {
  const rules = loadCustomRules();
  return JSON.stringify({ version: CUSTOM_RULES_FORMAT_VERSION, ...rules }, null, 2);
}

/**
 * 외부 JSON 규칙 가져오기.
 * @param {string|object} input - JSON 문자열 또는 파싱된 객체
 * @param {{merge?:boolean}} [opts] - merge=false면 기존 맞춤 규칙 대체 (기본: 병합)
 * @returns {{ok:boolean, error?:string, added?:number, skipped?:number}}
 */
export function importCustomRules(input, opts) {
  let parsed;
  try {
    parsed = typeof input === 'string' ? JSON.parse(input) : input;
  } catch (e) {
    return { ok: false, error: '유효한 JSON 파일이 아닙니다.' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '규칙 JSON 형식이 아닙니다.' };
  }

  const incoming = sanitizeRulesObject(parsed);
  const hasAny = CUSTOM_SCOPES.some(s => Object.keys(incoming[s]).length > 0);
  if (!hasAny) {
    return { ok: false, error: '가져올 규칙이 없습니다. base/concern/skin 키를 확인하세요.' };
  }

  const replace = !!(opts && opts.merge === false);
  const rules = replace ? emptyCustomRules() : loadCustomRules();
  let added = 0;
  let skipped = 0;
  CUSTOM_SCOPES.forEach(scope => {
    Object.entries(incoming[scope]).forEach(([key, names]) => {
      const list = rules[scope][key] || (rules[scope][key] = []);
      names.forEach(n => {
        if (list.includes(n) || list.length >= MAX_CUSTOM_PER_KEY) { skipped++; return; }
        list.push(n);
        added++;
      });
    });
  });
  if (!added && !replace) {
    return { ok: false, error: '모두 이미 등록된 후보입니다.' };
  }
  if (!saveCustomRules(rules)) return { ok: false, error: '저장에 실패했습니다.' };
  return { ok: true, added, skipped };
}

/** 커스텀 규칙 대상 목록 — UI 셀렉트용 */
export function customRuleTargets() {
  return {
    base: [...new Set(Object.values(BASE_TEMPLATES).flat().map(r => r.role))],
    concern: Object.keys(CONCERN_INGREDIENTS),
    skin: Object.keys(SKIN_INGREDIENTS),
  };
}

/** 후보 이름을 DB 기준으로 정제 — 미등록·banned 제거 + dedupe (index 없으면 dedupe만) */
function filterCandidateNames(names, index) {
  const seen = new Set();
  return (Array.isArray(names) ? names : []).filter(n => {
    if (typeof n !== 'string' || seen.has(n)) return false;
    if (index) {
      const ing = index.get(n);
      if (!ing || ing.type === 'banned') return false;
    }
    seen.add(n);
    return true;
  });
}

/**
 * 고객 조건으로 추천을 생성한다.
 * @param {object} customer - {gender, age, skinType, concerns[], formulation}
 * @param {Map<string,object>} index - buildIngredientIndex() 결과
 * @param {object} [custom] - loadCustomRules() 결과 (사용자 맞춤 후보)
 * @returns {{bases:Array, ingredients:Array<{name,reasons,type,limit,irritant}>, cautions:string[]}}
 */
export function recommendFor(customer, index, custom) {
  const result = { bases: [], ingredients: [], cautions: [] };
  if (!customer || typeof customer !== 'object') return result;
  const cu = custom && typeof custom === 'object' ? custom : emptyCustomRules();

  // 알레르기·부작용 이력 원료 — 모든 추천(기본·맞춤 후보 포함)에서 제외
  const allergies = new Set(
    (Array.isArray(customer.allergies) ? customer.allergies : [])
      .map(a => (typeof a === 'string' ? a.trim() : ''))
      .filter(Boolean)
  );
  const excludedByAllergy = new Set();
  const notAllergen = n => {
    if (allergies.has(n)) { excludedByAllergy.add(n); return false; }
    return true;
  };

  // ① 제형 → 베이스 템플릿 (+ 맞춤 후보 병합, 알레르기 제외)
  const template = BASE_TEMPLATES[customer.formulation];
  if (template) {
    result.bases = template.map(r => ({
      role: r.role,
      required: !!r.required,
      candidates: filterCandidateNames(
        r.candidates.concat((cu.base && cu.base[r.role]) || []), index)
        .filter(notAllergen),
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
    ((cu.concern && cu.concern[c]) || []).forEach(name => add(name, c));
  });
  (SKIN_INGREDIENTS[customer.skinType] || []).forEach(name => add(name, '피부유형'));
  ((cu.skin && cu.skin[customer.skinType]) || []).forEach(name => add(name, '피부유형'));

  const age = typeof customer.age === 'number' ? customer.age : null;
  const youngOrOld = age != null && (age < 20 || age > 65);
  const pregnant = customer.pregnancy === '임신 중' || customer.pregnancy === '수유 중';
  const productsText = typeof customer.products === 'string' ? customer.products : '';
  const overlap = [];

  for (const [name, meta] of seen) {
    const ing = index && index.get(name);
    if (!ing || ing.type === 'banned') continue; // 미등록·금지 원료는 추천하지 않음
    if (!notAllergen(name)) continue;            // 알레르기 이력 원료 제외
    // 사용 중인 제품/약물과의 성분 중복 감지 (자유 기술 문자열 부분 일치)
    if (productsText && productsText.includes(name)) overlap.push(name);
    result.ingredients.push({
      name,
      reasons: [...meta.reasons],
      type: ing.type || '',
      limit: ing.limit || '',
      irritant: (youngOrOld && IRRITANT_INGREDIENTS.includes(name))
        || (pregnant && PREGNANCY_CAUTION.includes(name)),
    });
  }

  // ③ 주의문
  if (excludedByAllergy.size) {
    result.cautions.push(`알레르기 이력: ${[...excludedByAllergy].join(', ')} — 추천에서 자동 제외됨`);
  }
  if (pregnant) {
    result.cautions.push('임신·수유 중: 레티놀 등 비타민A 유도체·살리실산 계열은 전문의 상담 후 사용 권장');
  }
  if (overlap.length) {
    result.cautions.push(`사용 중인 제품/약물과 성분 중복 가능: ${overlap.join(', ')} — 병용 시 자극·중복 확인`);
  }
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

// 임신·수유 시 주의 원료 — 비타민A 유도체·각질제거 계열 (추천 칩에 ⚠ 표시)
const PREGNANCY_CAUTION = ['레티놀', '살리실산', '살리실릭애씨드'];

// 베이스 역할 → 제조 단계(Phase) 기본 매핑 — 추천 칩으로 행 추가 시 자동 태깅용
// (formula-store.js PHASE_OPTIONS 값과 정합 유지 — 테스트가 검증)
export const ROLE_PHASE = Object.freeze({
  '용제 (정제수)': '수상부',
  '보습제': '수상부',
  '점증제': '수상부',
  '계면활성제': '수상부',
  '오일': '유상부',
  '유화제': '유상부',
  '산화방지제': '유상부',
  '자외선차단제': '유상부',
  '오일·실리콘': '유상부',
  '실리콘': '실리콘부',
  '보존제': '후첨가',
  'pH 조절제': '후첨가',
});

/** '베이스 불러오기' 대상: required 역할의 첫 후보 → {name, role, phase} */
export function baseDefaultCandidates(formulation) {
  const template = BASE_TEMPLATES[formulation];
  if (!template) return [];
  return template
    .filter(r => r.required && r.candidates.length)
    .map(r => ({ name: r.candidates[0], role: r.role, phase: ROLE_PHASE[r.role] || '' }));
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
