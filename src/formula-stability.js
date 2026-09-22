// src/formula-stability.js — Formula OS 제형 안정성 체크 엔진
//
// 원료 조합 + 배합비(상 비율) + 배합방법(투입 단계·절차·pH) → 제형 안정성 경고.
// 법규 검증(formula-check.js)과 별개 축이다 — 규정 OK ≠ 안정성 보장.
//
// 큐레이션 규칙 테이블 기반 결정적 평가. 규칙에 없는 조합은 판정하지 않는다
// (잘못된 경고보다 미판정이 안전 — formula-check.js와 같은 보수 원칙).
//
// 판정 단계:
//   warn — 분리·침전·변성 등 제형 불량 가능성이 높은 조합
//   info — 개선 권고·기록 누락 (직접 불량은 아니지만 확인 가치 있음)

export const STAB = Object.freeze({
  WARN: 'warn',
  INFO: 'info',
});

// 가열 단계로 간주하는 투입 phase — 후첨가·기능성은 냉각 후 투입으로 간주
const HEATED_PHASES = new Set(['수상부', '유상부', '실리콘부']);
// 유화 대상이 되는 비수상 phase
const OIL_PHASES = new Set(['유상부', '실리콘부']);

/* ---------- 원료 분류 패턴 (DB category 우선, 이름은 폴백) ---------- */

const hasCat = (ing, re) => !!(ing && typeof ing.category === 'string' && re.test(ing.category));
const nameHas = (name, pats) => pats.some(p => name.includes(p));

// 유화 가능 원료 — 유화제·계면활성제 카테고리 또는 대표 유화 성분명
const EMULSIFIER_PAT = [
  '솔비탄', '폴리소르베이트', '글리세릴스테아레이트', '세테아릴', '세테아레스',
  '레시틴', '세테아릴글루코사이드', '폴리글리세릴', '스테아레스', '라우레스',
  '올레스', '스테아릭애씨드', '세트리모늄', '벤제토늄', '피이지', 'PEG',
];
const isEmulsifier = (ing, name) =>
  hasCat(ing, /유화제|계면활성제/) || nameHas(name, EMULSIFIER_PAT);

// 점증제 — 수상층 점도 확보 수단
const THICKENER_PAT = [
  '카보머', '잔탄검', '셀룰로오스', '알기네이트', '카라기난', '젤란검',
  '구아검', '아크릴레이트', '폴리아크릴', '카복시비닐',
];
const isThickener = (ing, name) =>
  hasCat(ing, /점증제/) || nameHas(name, THICKENER_PAT);

// 양이온성 원료 — 카보머·음이온 계면활성제와 침전
const CATIONIC_PAT = [
  '세트리모늄', '스테아트리모늄', '벤잘코늄', '벤제토늄', '쿼터늄',
  '라우라모늄', '트리모늄', '트리메칠암모늄',
];
const isCationic = (ing, name) =>
  hasCat(ing, /양이온성/) || nameHas(name, CATIONIC_PAT);

// 음이온성 계면활성제 — 양이온과 침전
const ANIONIC_PAT = [
  '라우릴설페이트', '라우레스설페이트', '사코시네이트', '이세치오네이트',
  '코코일글루타메이트', '라우로일', '코코일',
];
const isAnionic = (ing, name) =>
  hasCat(ing, /음이온성/) || nameHas(name, ANIONIC_PAT);

// 비이온성 계면활성제 — 고농도 시 보존제 미셀 흡착
const NONIONIC_PAT = ['폴리소르베이트', '글루코사이드', '솔비탄', '라우레스', '세테아레스'];
const isNonionicSurf = (ing, name) =>
  hasCat(ing, /비이온성/) || (!isCationic(ing, name) && !isAnionic(ing, name) && nameHas(name, NONIONIC_PAT));

// 보존제 — 미셀 흡착으로 유효농도 저하 가능
const PRESERVATIVE_PAT = [
  '페녹시에탄올', '파라벤', '벤조익', '소듐벤조에이트', '포타슘솔베이트', '솔빅애씨드',
  '이소치아졸리논', '이미다졸리디닐', '디아졸리디닐', '벤질알코올', '클로페네신',
  '디엠디엠', '디하이드로아세틱', '메칠클로로이소치아졸리논',
];
export const isPreservative = (ing, name) =>
  hasCat(ing, /방부제|보존제/) || nameHas(name, PRESERVATIVE_PAT);

// 중화제 — 카보머 젤화용 알칼리
const NEUTRALIZER_PAT = [
  '하이드록사이드', '트리에탄올아민', '트리알킬아민', '트리알칸올아민',
  '아미노메틸프로판', '아미노메틸프로판디올', '암모니아', '아르기닌',
  '소듐시트레이트', '시트레이트', '수산화', '테트라하이드록시프로필',
];
const isNeutralizer = (ing, name) =>
  hasCat(ing, /pH 조절제/) || nameHas(name, NEUTRALIZER_PAT);

// 열 민감 원료 — 가열 단계 투입 시 변성·분해·휘발
// name 패턴 → 경고 메모 (이유 + 권장 조치)
const HEAT_SENSITIVE = [
  { pat: ['비타민C', '아스코르브산', '아스코빌'], note: '열·산소에 불안정 — 냉각 후 후첨가, 산화방지제 병용 권장' },
  { pat: ['레티놀', '레티날', '레티닐'], note: '열·광·산소에 불안정 — 냉각 후 후첨가 권장' },
  { pat: ['히알루론산', '히알루로네이트'], note: '고온 장시간에서 분자량 저하 — 후첨가 권장' },
  { pat: ['알부틴'], note: '열·극단 pH에서 하이드로퀴논 유리 우려 — 후첨가 권장' },
  { pat: ['콜라겐'], note: '단백질 열변성 — 후첨가 권장' },
  { pat: ['펩타이드'], note: '펩타이드 열변성 — 후첨가 권장' },
  { pat: ['우레아'], note: '고온에서 암모니아로 분해 — 후첨가 권장' },
  { pat: ['센텔라', '시카'], note: '고온 장시간 시 활성 저하 가능 — 후첨가 권장' },
  { pat: ['효소', '엔자임'], note: '단백질 변성 — 후첨가 권장' },
  { pat: ['향료', '프래그런스', '에센셜오일'], note: '휘발성 — 냉각 후 후첨가 권장' },
];
const heatSensitiveNote = (ing, name) => {
  if (hasCat(ing, /향료|산화 정유/)) return '휘발성 — 냉각 후 후첨가 권장';
  const hit = HEAT_SENSITIVE.find(h => nameHas(name, h.pat));
  return hit ? hit.note : null;
};

// pH 적정대 — 실측/목표 pH가 범위 밖이면 경고
const PH_BAND = {
  '카보머': { min: 5.5, max: 8.0, label: 'pH 5.5~8 — 중화 시 점도 발현' },
  '살리실산': { min: 3.0, max: 4.0, label: 'pH 3~4 권장' },
  '살리실릭애씨드': { min: 3.0, max: 4.0, label: 'pH 3~4 권장' },
  '알파-하이드록시애씨드(AHA)': { min: 3.5, max: 4.5, label: 'pH 3.5~4.5 권장' },
  '비타민C(아스코르브산)': { min: 2.0, max: 3.5, label: 'pH 3.5 이하 권장' },
  '레티놀': { min: 5.0, max: 7.5, label: 'pH 5~7.5 권장' },
  '나이아신아마이드': { min: 5.0, max: 7.0, label: 'pH 5~7 권장' },
  '알부틴': { min: 5.0, max: 7.0, label: 'pH 5~7 권장' },
  '메칠클로로이소치아졸리논': { min: 3.0, max: 8.0, label: 'pH 8 이하 권장' },
};

// 절차 텍스트 키워드
const STEP_HEAT_RE = /가열|가온|℃|°C|\d{2,}\s*도/;
const STEP_EMUL_RE = /유화|혼합|교반|믹싱|호모게|균질|믹서|프로펠러/;
const STEP_NEUTRAL_RE = /중화|pH|수산화|하이드록사이드|알칼리|트리에탄올|아미노메틸|중성/;

// 에멀전형 제형 — 제형 미선택 시 상 비율 규칙의 폴백 단서
const EMULSION_FORMULATIONS = new Set(['로션·에멀전', '크림·밤', '선크림']);

/**
 * 포뮬러의 제형 안정성을 평가한다.
 * @param {Array<{name:string, concentration:number|null, phase:string}>} items - 이름 있는 원료 행
 * @param {Map<string,object>|null} index - buildIngredientIndex() 결과 (없어도 이름 패턴으로 평가)
 * @param {{formulation?:string, phTarget?:number|null, phActual?:number|null, steps?:string[]}} [ctx]
 * @returns {{warnings:Array<{level:string, msg:string}>, phaseSums:object}}
 */
export function evaluateStability(items, index, ctx) {
  const warnings = [];
  const push = (level, msg) => warnings.push({ level, msg });
  const context = ctx && typeof ctx === 'object' ? ctx : {};

  const rows = (Array.isArray(items) ? items : []).filter(r => r && typeof r.name === 'string' && r.name.trim());
  if (!rows.length) return { warnings, phaseSums: {} };

  const getIng = name => (index && typeof index.get === 'function' ? index.get(name) : null);

  // 단계별 소계 + 분류 탐지 (금지 원료는 규정 검증이 이미 차단 — 안정성 평가 제외)
  const phaseSums = {};
  const live = []; // {row, ing}
  rows.forEach(row => {
    const name = row.name.trim();
    const ing = getIng(name);
    if (ing && ing.type === 'banned') return;
    const conc = typeof row.concentration === 'number' && !Number.isNaN(row.concentration) ? row.concentration : null;
    const phase = row.phase || '기타';
    if (conc != null) phaseSums[phase] = (phaseSums[phase] || 0) + conc;
    live.push({ name, conc, phase, ing });
  });

  const oilRows = live.filter(r => OIL_PHASES.has(r.phase));
  const waterRows = live.filter(r => r.phase === '수상부');
  const emulRows = live.filter(r => isEmulsifier(r.ing, r.name));
  const thickenerRows = live.filter(r => isThickener(r.ing, r.name));
  const cationicRows = live.filter(r => isCationic(r.ing, r.name));
  const anionicRows = live.filter(r => isAnionic(r.ing, r.name));
  const nonionicRows = live.filter(r => isNonionicSurf(r.ing, r.name));
  const preservativeRows = live.filter(r => isPreservative(r.ing, r.name));

  const steps = Array.isArray(context.steps) ? context.steps : [];
  const stepsText = steps.join(' ');
  const hasHeatStep = STEP_HEAT_RE.test(stepsText);
  const formulation = typeof context.formulation === 'string' ? context.formulation : '';
  const isEmulsion = (oilRows.length > 0 && waterRows.length > 0)
    || (EMULSION_FORMULATIONS.has(formulation) && waterRows.length > 0);

  /* ── ① 상(Phase) 비율 균형 ── */

  // 유상부 + 수상부 혼합인데 유화제 미감지
  if (oilRows.length > 0 && waterRows.length > 0 && emulRows.length === 0) {
    push(STAB.WARN, '수상부와 유상부가 함께 있지만 유화제가 감지되지 않습니다 — 에멀전 분리 위험. 유화 원료를 추가하세요.');
  }
  // 유화제:유상부 비율 — 모든 관련 행에 농도가 있을 때만 판정
  if (oilRows.length > 0 && emulRows.length > 0
    && oilRows.every(r => r.conc != null) && emulRows.every(r => r.conc != null)) {
    const oilPct = oilRows.reduce((s, r) => s + r.conc, 0);
    const emulPct = emulRows.reduce((s, r) => s + r.conc, 0);
    if (oilPct > 0 && emulPct > 0 && emulPct / oilPct < 0.1) {
      push(STAB.WARN, `유화제 비율이 유상부 대비 ${Math.round(emulPct / oilPct * 100)}%로 낮습니다 — 유화 안정성 확인 (일반적 기준 10% 이상).`);
    }
  }
  // 에멀전인데 수상층 점증제 없음
  if (isEmulsion && thickenerRows.length === 0) {
    push(STAB.INFO, '점증제가 없는 에멀전 — 점도가 낮으면 크리밍·침강이 생길 수 있습니다.');
  }
  // 유화제는 있으나 유화 대상 없음
  if (emulRows.length > 0 && oilRows.length === 0 && waterRows.length > 0) {
    push(STAB.INFO, '유화제가 있지만 유상부가 없습니다 — 향료·오일 가용화 목적이면 정상입니다.');
  }

  /* ── ② 원료 간 상호작용 ── */

  const hasCarbomer = live.some(r => r.name.includes('카보머') || r.name.includes('카복시비닐'));
  if (hasCarbomer && cationicRows.length > 0) {
    push(STAB.WARN, `카보머 × 양이온성 원료(${cationicRows.map(r => r.name).join(', ')}) — 침전·점도 상실 가능. 병용 피하거나 비이온성 점증제로 교체하세요.`);
  }
  if (anionicRows.length > 0 && cationicRows.length > 0) {
    push(STAB.WARN, `음이온성(${anionicRows.map(r => r.name).join(', ')}) × 양이온성(${cationicRows.map(r => r.name).join(', ')}) 계면활성제 — 침전·효과 상쇄 가능.`);
  }
  // 비이온성 계면활성제 고농도 — 보존제 미셀 흡착
  if (preservativeRows.length > 0 && nonionicRows.length > 0 && nonionicRows.every(r => r.conc != null)) {
    const nonionicPct = nonionicRows.reduce((s, r) => s + r.conc, 0);
    if (nonionicPct > 5) {
      push(STAB.INFO, `비이온성 계면활성제 ${Math.round(nonionicPct * 100) / 100}% — 보존제가 미셀에 흡착돼 유효농도가 낮아질 수 있습니다.`);
    }
  }

  /* ── ③ 배합방법 — 투입 단계·절차·pH ── */

  // 열 민감 원료가 가열 단계에 배치됨
  live.forEach(r => {
    if (!HEATED_PHASES.has(r.phase)) return;
    const note = heatSensitiveNote(r.ing, r.name);
    if (!note) return;
    if (hasHeatStep) {
      push(STAB.WARN, `${r.name}: 열 민감 원료가 가열 단계(${r.phase})에 있습니다 — ${note}.`);
    } else {
      push(STAB.INFO, `${r.name}: 열 민감 원료 — ${note}.`);
    }
  });
  // 카보머 중화 단계 누락
  if (hasCarbomer) {
    const hasNeutralizer = live.some(r => isNeutralizer(r.ing, r.name));
    if (!hasNeutralizer && steps.length > 0 && !STEP_NEUTRAL_RE.test(stepsText)) {
      push(STAB.INFO, '카보머 사용 — 중화(pH 조절) 단계가 절차에 없습니다. 중화 없이는 점도가 형성되지 않습니다.');
    } else if (!hasNeutralizer && steps.length === 0) {
      push(STAB.INFO, '카보머 사용 — 중화제(트리에탄올아민·수산화나트륨 등) 투입과 pH 조절이 필요합니다.');
    }
  }
  // 에멀전인데 유화 단계가 절차에 없음
  if (isEmulsion && steps.length > 0 && !STEP_EMUL_RE.test(stepsText)) {
    push(STAB.INFO, '수상부·유상부 혼합(유화·교반) 단계가 절차에 없습니다.');
  }
  // pH 적정대 이탈 (실측 우선, 없으면 목표)
  const ph = context.phActual != null ? context.phActual : context.phTarget;
  if (typeof ph === 'number' && !Number.isNaN(ph)) {
    live.forEach(r => {
      const band = PH_BAND[r.name];
      if (!band) return;
      if (ph < band.min || ph > band.max) {
        push(STAB.WARN, `${r.name}: ${band.label}이나 현재 pH는 ${ph}입니다.`);
      }
    });
  }

  return { warnings, phaseSums };
}
