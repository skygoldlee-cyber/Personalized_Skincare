# Formula OS — 조제관리사 업무 전체 커버리지 설계안

> 상위 문서: `FORMULA_OS_DESIGN.md` (Phase 5-A 기본 설계, 구현 완료)
> 범위: 맞춤형화장품 조제관리사 **9개 주요 업무** 전체를 Formula OS가 유기적으로 커버하도록 확장
> 상태: 📐 설계안 — 미구현

---

## 1. 배경 — 조제관리사 주요 업무와 현재 커버리지

| # | 업무 | 구체적 내용 | 현재 커버리지 |
|---|------|------------|--------------|
| 1 | 고객 상담 | 피부·두피 상태, 요구사항, 알레르기·주의사항 확인 | 부분 — 고객 정보 필드는 있으나 포뮬러에 종속, 고객 단위 관리·이력 없음 |
| 2 | 제품 설계 | 기초제품·원료·기능성 성분 선택 | 부분 — 추천 규칙·베이스 템플릿 동작 중 |
| 3 | 조제 | 계량·혼합·소분·제조 | ✅ 계산기·단계·절차·투입량·인쇄 |
| 4 | 원료 관리 | 표시사항·사용기한·보관조건·재고 | ❌ 없음 |
| 5 | 품질관리 | 외관·색상·향·점도 확인, 오염 방지 | 부분 — 안정성 실험 기록만, 회차별 QC 없음 |
| 6 | 안전관리 | 도구·환경 위생, 교차오염 방지 | ❌ 없음 |
| 7 | 표시·기록관리 | 원료·조제량·조제일자·고객 정보 기록 | 부분 — 조제 기록지·전성분은 있으나 조제일자·배치 없음 |
| 8 | 사용법 안내 | 사용량·순서·보관법·주의사항 안내 | ❌ 없음 |
| 9 | 법규 준수 | 판매업 법규·안전·품질관리 기준 준수 | 부분 — 한도·금지 검증만, 기록 보존 의무 안내 없음 |

**진단**: 현재 Formula OS는 "처방(레시피) 작성 + 규정 검증" 중심. 업무 1·4·5·6·7·8은 "고객"과 "조제 회차"라는 별도 엔티티 없이는 표현 불가.

---

## 2. 핵심 설계 결정 — 처방(Formula)과 배치(Batch) 분리

같은 처방으로 여러 번 조제하며, **조제할 때마다** 일자·조제량·QC·위생·고객이 기록돼야 한다.

```
고객(customer) ──┐
                 ├─→ 처방(formula) ──→ 배치(batch) ──→ 라벨·안내문 출력
원료장부(stock) ─┘      (설계·검증)     (조제 회차 기록)      (고객 인도물)
```

| 엔티티 | 의미 | 생명주기 |
|---|---|---|
| `formula` | 재사용 가능한 배합 처방 (기존 스키마 유지) | 장기 보관, 수정·복제 |
| `batch` | 처방을 실제로 조제한 회차 기록 | 부가 기록 전용(append), 수정보다 신규 배치 권장 |
| `customer` | 상담·조제 대상 고객 | 독립 관리, 여러 포뮬러·배치에서 참조 |
| `material` | 원료 재고 항목 | 입고·사용·기한 경과 |

**안정성 확인의 역할 분리**: 처방의 `stability`는 "이 처방이 검증됐는가"(설계 판단 근거), 배치의 `qc`/`stability`는 "이 회차가 이상 없었는가"(회차 확인)로 분리한다. 처방에 양호 기록이 있어도 배치별 QC는 별도 수행·기록.

---

## 3. 신규 도메인 모듈

| 모듈 | 책임 | 커버 업무 |
|---|---|---|
| `src/customer-store.js` | 고객 CRUD — 상담 카드·상담 이력, 포뮬러·배치에서 참조 | 1 |
| `src/material-ledger.js` | 원료장부 — 입고일·사용기한·보관조건·잔량, 기한 임박 경고 | 4 |
| `src/batch-store.js` | 조제 이력 — 배치번호 채번, QC·위생 체크, 고객·조제일 기록 | 5·6·7 |
| `src/usage-guide.js` | 사용 안내문 생성 — 제형별 템플릿 + 원료별 주의 자동 병기 | 8 |

기존 `formula-store.js`/`formula-rules.js`/`formula-check.js`/`formula-stability.js`는 그대로 유지 — 처방 계층으로 역할 고정.

## 4. 데이터 스키마

### 4.1 customer (customer-store.js)

```js
{ id: 'cust_<base36>', name, age, gender, skinType, scalpType,
  concerns[], allergies[], pregnancy, products, purpose,   // 기존 포뮬러 customer 필드 계승 + purpose·scalpType·상담이력
  consultLog: [{ date: 'YYYY-MM-DD', text }],
  notes, createdAt, updatedAt }
```

- `formula.customer`는 자유입력 객체로 유지하되 `customerId` 참조 필드 추가 — 기존 저장 포뮬러 호환(참조 없으면 인라인 값 그대로 사용).
- 고객 삭제 시 참조 중인 포뮬러·배치는 인라인 스냅샷으로 전환(고객명만 남김) — 기록 보존 원칙.

### 4.2 batch (batch-store.js)

```js
{ id: 'bat_<base36>', formulaId, formulaName,                // 스냅샷 이름 — 처방 삭제돼도 기록 유지
  batchNo: 'YYYYMMDD-NN',                                     // 당일 순번 자동 채번
  customerId, customerName,                                   // 인라인 폴백 겸용
  targetVolume, unit, madeAt: 'YYYY-MM-DDTHH:MM',            // 조제 일시
  qc: { appearance, color, scent, viscosity, foreign },       // 각 '정상'|'이상'|'미확인'
  hygiene: { toolsSterilized: bool, workspaceCleaned: bool, glovesWorn: bool },
  expiryAt: 'YYYY-MM-DD',                                     // 권장 사용기한
  notes, createdAt }
```

- 배치 생성 시점의 `formula-check`·`formula-stability` 결과 요약을 스냅샷으로 함께 저장(`checkSnapshot`) — 처방이 나중에 수정돼도 당시 검증 근거 보존.

### 4.3 material (material-ledger.js)

```js
{ id: 'mat_<base36>', name, lot, receivedAt: 'YYYY-MM-DD',
  expiryAt: 'YYYY-MM-DD', storage, qty, unit, notes }
```

- 기한 임박(30일 이내)·기한 경과 → 장부 목록 배지 + 계산기에서 해당 원료 행 경고(이름 매칭).

### 4.4 사용 안내문 (usage-guide.js — 상태 없는 생성기)

```js
buildUsageGuide(formula) → {
  directions: string,   // 제형별 사용량·순서 템플릿
  storage: string,      // 보관법 템플릿
  cautions: string[],   // 원료·고객 조건 기반 자동 주의사항
}
```

- 제형 템플릿 테이블(세럼→"적량을 피부에 도포…", 크림→…, 선크림→"외출 15분 전…") 내장.
- 원료 주의 규칙: 레티놀→야간 사용, AHA·BHA→자외선 주의·패치테스트, 비타민C→개봉 후 냉장·단기 사용, 향료·에센셜오일→패치테스트, 살리실산→저농도·국소. 고객 조건: 임신수유→전문가 상담 문구, 알레르기 원료 포함→해당 성분 명시 경고.

---

## 5. UI 구조 — formula-view를 업무 흐름으로 재편

```
Formula OS (formula-view)
├─ 배합 계산기   (기존 — 처방 작성·검증·안정성 확인)
├─ My 포뮬러    (기존 — 처방 목록) + [조제 기록] 버튼 → 배치 생성
├─ 고객 관리    (신규 탭 — 고객 카드 CRUD·상담 이력·고객별 처방/배치 이력)
├─ 조제 기록    (신규 탭 — 배치 목록: 일자·배치번호·QC·고객, 상세 인쇄)
├─ 원료 장부    (신규 탭 — 입고·기한·재고, 기한 임박 배지)
└─ 출력        — 조제 기록지(기존) + 제품 라벨(전성분·조제일·사용기한·주의사항) + 사용 안내문
```

- 허브 카드 4개 → 6개(고객 관리·조제 기록·원료 장부 추가, 출력은 배치 상세·포뮬러 카드 액션으로 흡수).
- 배치 생성 플로우: My 포뮬러 카드 `조제 기록` → 배치 폼(조제일시 기본값=지금, 총량, 고객 선택, QC·위생 체크리스트) → 저장 → 조제 기록 목록 + 라벨/안내문 인쇄.

---

## 6. 기존 자산 연결

| 기존 자산 | 연결 |
|---|---|
| `fullIngredients` (전성분 표시) | 제품 라벨의 전성분 행 그대로 사용 |
| `formula.stability` (안정성 확인) | 처방 검증으로 유지 — 배치는 회차별 QC로 분리 |
| `formula-check` 규정 검증 | 배치 생성 시 재실행 → `checkSnapshot`으로 저장 |
| `formula-rules` 안전 필터 | 안내문 주의사항 자동 병기(알레르기·임신수유) |
| `STABILITY_METHODS` enum | 배치 QC 확장 시 후속 안정성 항목 재사용 |
| 백업(`BACKUP_KEYS`) | `customer_items`·`batch_items`·`material_items` 키 등록 — 백업/복원 자동 포함 |

---

## 7. 구현 로드맵

| Phase | 범위 | 커버 업무 | 비고 |
|---|---|---|---|
| **A** | `batch-store.js` + 조제 기록 탭 + 배치 폼(QC·위생 체크) + 라벨·안내문 인쇄(`usage-guide.js`) | 5·6·7·8 | 스토어 1개 + 생성기 1개, 기존 데이터 무수정 |
| **B** | `customer-store.js` + 고객 관리 탭 + 포뮬러 `customerId` 참조 전환(인라인 호환) | 1 | 기존 포뮬러 customer 객체 마이그레이션 설계 필요 |
| **C** | `material-ledger.js` + 원료 장부 탭 + 기한 경고(계산기 원료 행 연동) | 4 | 재고 자동 차감은 후속 검토 |
| **D** | 법규 준수 체크리스트(기록 보존·시설 기준) + 참조자료 법령 링크 | 9 | 참조자료 기존 MD 연결 |

권장 순서 A→B→C→D — A가 커버 폭 대비 비용이 가장 좋고, B는 마이그레이션, C는 연동 복잡도가 있다.

## 8. 설계 원칙 (기존 원칙 계승 + 추가)

1. Zero-Backend 유지 — 모든 신규 스토어는 localStorage + `safeGetItem`/`safeSetItem`.
2. 생성 vs 검증 분리 — 안내문·라벨은 "템플릿 생성", 법적 적합성은 사용자 확인 문구 병기.
3. 기록은 부가(append) 지향 — 배치·상담이력은 수정보다 신규 기록을 권장하는 UX.
4. 참조 + 스냅샷 병용 — 고객·처방 참조하되 삭제·수정에 대비해 이름·검증 결과는 스냅샷 보존.
5. 규정 ≠ 안전성, 규칙 경고 ≠ 실험 확정 — 기존 면책 원칙을 라벨·안내문에도 적용.
