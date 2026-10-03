// Formula OS — 사업 유형 프로파일 (FO-33)
// @spec FO-33,FO-34
// 맞춤형화장품 조제(기본)·화장품제조업·책임판매업 — 유형 선택을 영속하고
// 허브 카드·서브내비·체크리스트 세트의 가시 범위를 여기서 한 곳에 선언한다.
// 유형별 UI 게이트는 "숨김"일 뿐 저장 데이터(포뮬러·배치·체크 상태)는 공유·보존된다.

import { getJSON, setJSON } from '../../storage.js';
import { STORAGE_KEYS } from '../../storage-keys.js';

/** 사업 유형 정의 — id는 FORMULA_BIZ_TYPE 저장값으로 영구 안정 */
export const BIZ_TYPES = {
  custom: { id: 'custom', label: '맞춤형화장품 조제', desc: '판매업 신고 + 조제관리사 배치 — 소량 맞춤 제작' },
  mfg: { id: 'mfg', label: '화장품제조업', desc: '제조업 등록 — CGMP 기준 품질관리' },
  sales: { id: 'sales', label: '책임판매업', desc: '책임판매업 등록 — 표시·광고·유통 관리' },
};

const BIZ_IDS = Object.keys(BIZ_TYPES);
const DEFAULT_BIZ = 'custom';

/** 현재 사업 유형 — 미설정·비정상 값은 맞춤형조제(기존 동작)로 폴백 */
export function getBizType() {
  const t = getJSON(STORAGE_KEYS.FORMULA_BIZ_TYPE);
  return BIZ_IDS.includes(t) ? t : DEFAULT_BIZ;
}

export function setBizType(type) {
  if (!BIZ_IDS.includes(type)) return false;
  setJSON(STORAGE_KEYS.FORMULA_BIZ_TYPE, type);
  return true;
}

/* =======================================================
   유형별 기능 가시 범위 — 서브내비 id·허브 카드 공용 테이블
   미선언 항목은 모든 유형에 노출 (list·compliance).
   ======================================================= */
export const BIZ_PANELS = {
  customer: ['custom', 'sales'],        // B2C 상담 기록 — 제조업은 B2B라 제외
  calc: ['custom', 'mfg'],              // 배합·처방 — 책임판매업은 제조 안 함
  batch: ['custom', 'mfg'],             // 조제·생산 기록 — 책임판매업 제외
  material: ['custom', 'mfg'],          // 원료 장부 — 책임판매업은 완제품 취급
  label: ['mfg', 'sales'],              // 표시사항 검토 — 제조·판매 표시 책임 (FO-35)
  adlint: ['mfg', 'sales'],             // 광고 문구 점검 — 광고 주체 (FO-36)
};

/** 서브내비·카드가 현재 유형에 보이는가 — 미선언 항목은 true (모든 유형 공용) */
export function bizVisible(panelId, bizType) {
  const allow = BIZ_PANELS[panelId];
  return !allow || allow.includes(bizType || getBizType());
}

/* =======================================================
   체크리스트 세트 해석 (FO-34) — 유형 → 세트 id
   ======================================================= */
export const BIZ_CHECKLIST_SET = { custom: 'custom', mfg: 'mfg', sales: 'sales' };

export function bizChecklistSet(bizType) {
  return BIZ_CHECKLIST_SET[bizType || getBizType()] || 'custom';
}

/* =======================================================
   허브 업무 흐름 안내 (FO-33) — 유형별 카드 구성과 짝을 이루는 문구.
   카드 단계 배지는 applyBizProfile이 노출 카드 기준으로 재번호한다.
   ======================================================= */
export const BIZ_GUIDE = {
  custom: '실제 업무 흐름 순서입니다. ① 상담(고객) → ② 설계(계산기·작업대) → ③ 레시피 확정(My 포뮬러·보관함) → ④ 재료 확인(원료 장부) → ⑤ 조제·기록 순으로 진행하고, 법규 준수는 전 단계에서 상시 점검합니다.',
  mfg: '실제 업무 흐름 순서입니다. ① 처방 설계(계산기·작업대) → ② 레시피 확정(My 포뮬러·보관함) → ③ 원료 확인(원료 장부) → ④ 제조·기록 순으로 진행하고, 표시사항·광고·법규 준수는 상시 점검합니다.',
  sales: '표시·광고 관리 흐름입니다. 제품 정보는 My 포뮬러에서 불러오고, 표시사항(제10조)·광고 문구(제13조)·법규 준수를 상시 점검합니다. 고객 카드는 상담 이력 기록용입니다.',
};
