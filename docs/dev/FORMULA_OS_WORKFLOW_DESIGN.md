# Formula OS — 조제관리사 업무 전체 커버리지 설계안

> 상위 문서: `FORMULA_OS_DESIGN.md` (Phase 5-A 기본 설계, 구현 완료)
> 범위: 맞춤형화장품 조제관리사 **9개 주요 업무** 전체를 Formula OS가 유기적으로 커버하도록 확장
> 상태: ✅ 구현 완료 — Phase A~D 전부 반영 (f6cd274 · 5b9c356 · 9bce945 · 0389ed7)

---

## 1. 배경 — 조제관리사 주요 업무와 현재 커버리지

| # | 업무 | 구체적 내용 | 현재 커버리지 |
|---|------|------------|--------------|
| 1 | 고객 상담 | 피부·두피 상태, 요구사항, 알레르기·주의사항 확인 | ✅ 고객 관리 탭 — 카드 CRUD·상담 이력(append)·처방/배치 역참조 (Phase B) |
| 2 | 제품 설계 | 기초제품·원료·기능성 성분 선택 | ✅ 추천 규칙·베이스 템플릿 (기존) |
| 3 | 조제 | 계량·혼합·소분·제조 | ✅ 계산기·단계·절차·투입량·인쇄 (기존) |
| 4 | 원료 관리 | 표시사항·사용기한·보관조건·재고 | ✅ 원료 장부 — 입고·기한(D-day)·잔량, 계산기 기한 경고 (Phase C) |
| 5 | 품질관리 | 외관·색상·향·점도 확인, 오염 방지 | ✅ 배치별 QC 5항목(정상/이상/미확인) + 처방 안정성 기록 분리 (Phase A) |
| 6 | 안전관리 | 도구·환경 위생, 교차오염 방지 | ✅ 배치 위생 체크 3항목 + 법규 체크리스트 시설·위생 섹션 (Phase A·D) |
| 7 | 표시·기록관리 | 원료·조제량·조제일자·고객 정보 기록 | ✅ 배치번호·조제일시·스냅샷 보존 + 라벨 인쇄 (Phase A) |
| 8 | 사용법 안내 | 사용량·순서·보관법·주의사항 안내 | ✅ 사용 안내문 생성기(제형 템플릿+원료 주의 규칙) + 인쇄 (Phase A) |
| 9 | 법규 준수 | 판매업 법규·안전·품질관리 기준 준수 | ✅ 법규 준수 체크리스트 25항목 + 법령 원문 링크 (Phase D) |

**진단(당시)**: 확장 전 Formula OS는 "처방(레시피) 작성 + 규정 검증" 중심이었음. 업무 1·4·5·6·7·8은 "고객"과 "조제 회차"라는 별도 엔티티 없이는 표현 불가 → Phase A~D로 전부 해소.

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

| 모듈 | 책임 | 커버 업무 | 상태 |
|---|---|---|---|
| `src/store-utils.js` | 스토어 공통 헬퍼 (loadItems/saveItems/newId/clampStr/pickEnum…) — formula-store도 공용화 | 공통 | ✅ |
| `src/customer-store.js` | 고객 CRUD — 상담 카드·상담 이력, 포뮬러·배치에서 참조 | 1 | ✅ Phase B |
| `src/material-ledger.js` | 원료장부 — 입고일·사용기한·보관조건·잔량, 기한 임박 경고 | 4 | ✅ Phase C |
| `src/batch-store.js` | 조제 이력 — 배치번호 채번, QC·위생 체크, 고객·조제일 기록 | 5·6·7 | ✅ Phase A |
| `src/usage-guide.js` | 사용 안내문 생성 — 제형별 템플릿 + 원료별 주의 자동 병기 | 8 | ✅ Phase A |
| `src/views/formula-batch.js` | 배치 목록·폼·상세 패널 컨트롤러 | 5·6·7 | ✅ Phase A |
| `src/views/formula-print.js` | 조제 기록지·제품 라벨(70mm)·사용 안내문 인쇄 빌더 | 7·8 | ✅ Phase A |
| `src/views/formula-customer.js` | 고객 목록·폼·상세(상담 이력·역참조) 패널 | 1 | ✅ Phase B |
| `src/views/formula-material.js` | 원료 장부 목록·폼 패널 | 4 | ✅ Phase C |
| `src/views/formula-compliance.js` | 법규 준수 체크리스트 — 6개 카테고리 25항목 + 법령 원문 링크 + 체크 상태 영속 | 9 | ✅ Phase D |

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
- 원료 주의 규칙: 레티노이드·AHA·BHA·비타민C·향료/에센셜오일·알코올·BPO — 이름 정규식 매칭. 고객 조건: 임신수유→전문가 상담 문구, 알레르기 원료 포함→해당 성분 명시 경고.

### 4.5 법규 준수 체크리스트 (views/formula-compliance.js — Phase D)

```js
// 정적 데이터 + 체크 상태만 영속 — 별도 스토어 없음
localStorage 'formula_compliance' → { checked: { itemId: isoString }, updatedAt }
```

- `SECTIONS` 6개(영업·자격 / 시설·위생 / 혼합·소분 안전관리 / 기록 보관 / 표시·안내 / 안전·보고) 25항목 — 항목 id는 체크 상태 키이므로 영구 안정.
- `LAW_DOCS` 10종 — 화장품법·시행규칙 원문(ref_md), CGMP, 안전기준 규정, 주의사항 규정, 별표4·7 + 과목1·4 정리 문서. `contentPath()` 기준 경로로 시험 루트 해석, `ExamViewer.openExam`으로 문서 뷰어 오픈.
- 항목별 `app` 링크 — 조제 기록·고객 관리·원료 장부·계산기로 data-click 직행.
- 근거: 시행규칙 제12조의2 판매업자 준수사항(품질성적서·손 소독·용기 점검·판매내역서·소비자 설명·부작용 보고), 혼합·소분 시설기준(공간 분리·환기·세척시설), 매년 교육 이수·원료 목록 연 1회 보고.
- 면책: 자가점검 참고 자료이며 법률 자문이 아님을 패널 상단에 상시 표시.
- 테스트 `tests/unit/formula-compliance.test.js` — 항목 id 고유성·refs 유효성·LAW_DOCS 실존·필수 섹션 커버리지.

---

## 5. UI 구조 — formula-view를 업무 흐름으로 재편

```
Formula OS (formula-view) — 허브 카드 + 서브패널 전환 (PANELS + is-hidden)
├─ 배합 계산기   (기존 — 처방 작성·검증·안정성 확인·고객 카드 연동)
├─ My 포뮬러    (기존 — 처방 목록) + [조제 기록] 버튼 → 배치 생성
├─ 고객 관리    (고객 카드 CRUD·상담 이력 append·고객별 처방/배치 역참조)
├─ 조제 기록    (배치 목록: 일자·배치번호·QC·고객·기한 배지, 상세 인쇄)
├─ 원료 장부    (입고·기한·재고, 기한 임박/경과 배지 + 경고 배너)
├─ 법규 준수    (체크리스트 25항목 + 법령 문서 링크 — 체크 상태 영속)
└─ 출력        — 조제 기록지(기존) + 제품 라벨(전성분·조제일·사용기한·주의사항) + 사용 안내문
```

- 허브 카드 7개(My 포뮬러·배합 계산기·원료 검색·고객 관리·조제 기록·원료 장부·법규 준수), 출력은 배치 상세·포뮬러 카드 액션으로 흡수.
- **서브내비 칩(절충안 채택)**: 인뷰 탭 대신 각 서브패널 헤더 아래 `formulaSubNav()` 칩 6개 — 허브 복귀 없이 1클릭 섹션 이동. 신규 UI 패턴·탭 접근성 도입 없이 기존 패널 전환 재사용.
- 배치 생성 플로우: My 포뮬러 카드 `조제 기록` → 배치 폼(조제일시 기본값=지금, 총량, 고객 카드 선택/인라인 폴백, QC 5항목·위생 3항목) → 저장 → 목록 + 라벨/안내문 인쇄.
- 배치 수정 정책: identity 필드(처방·배치번호·조제일시·스냅샷) 불변, QC·위생·사용기한·메모만 보정 가능.
- 기한 계산: `daysUntilExpiry` 자정 기준 D-day(기한 당일 D-0), 장부 카드·배지·계산기 경고 공용.

---

## 6. 기존 자산 연결

| 기존 자산 | 연결 |
|---|---|
| `fullIngredients` (전성분 표시) | 제품 라벨의 전성분 행 그대로 사용 |
| `formula.stability` (안정성 확인) | 처방 검증으로 유지 — 배치는 회차별 QC로 분리 |
| `formula-check` 규정 검증 | 배치 생성 시 재실행 → `checkSnapshot`으로 저장 |
| `formula-rules` 안전 필터 | 안내문 주의사항 자동 병기(알레르기·임신수유) |
| `STABILITY_METHODS` enum | 배치 QC 확장 시 후속 안정성 항목 재사용 |
| 백업(`BACKUP_KEYS`) | `customer_items`·`batch_items`·`material_items`·`formula_compliance` 키 등록 — 백업/복원 자동 포함 |
| 참조자료 법령 MD | 법규 체크리스트의 항목별 근거 링크 (`ExamViewer.openExam` + `contentPath`) — PDF는 배포 제외이므로 ref_md 변환본 연결 |

---

## 7. 구현 로드맵

| Phase | 범위 | 커버 업무 | 상태 |
|---|---|---|---|
| **A** | `store-utils.js` + `batch-store.js` + `usage-guide.js` + 조제 기록 탭 + 라벨·안내문 인쇄(`formula-print.js`) + 서브내비 칩 도입 | 5·6·7·8 | ✅ `f6cd274` |
| **B** | `customer-store.js` + 고객 관리 탭 + 포뮬러 `customerId` 참조(인라인 호환, 지연 전환 — 고객 카드로 저장/불러오기) + 배치 폼 고객 select | 1 | ✅ `5b9c356` |
| **C** | `material-ledger.js` + 원료 장부 탭 + 계산기 원료 행 기한 경고(이름 정확 매칭) | 4 | ✅ `9bce945` |
| **D** | `views/formula-compliance.js` — 25항목 체크리스트 + 법령 링크 + `formula_compliance` 키 | 9 | ✅ `0389ed7` |

실행 순서 A→B→C→D로 진행. free 한도: 배치 50건·고객 20명·원료 30종. 재고 자동 차감·고객 일괄 마이그레이션 도구는 후속 검토로 유보.

## 8. 설계 원칙 (기존 원칙 계승 + 추가)

1. Zero-Backend 유지 — 모든 신규 스토어는 localStorage + `safeGetItem`/`safeSetItem`.
2. 생성 vs 검증 분리 — 안내문·라벨은 "템플릿 생성", 법적 적합성은 사용자 확인 문구 병기.
3. 기록은 부가(append) 지향 — 배치·상담이력은 수정보다 신규 기록을 권장하는 UX.
4. 참조 + 스냅샷 병용 — 고객·처방 참조하되 삭제·수정에 대비해 이름·검증 결과는 스냅샷 보존.
5. 규정 ≠ 안전성, 규칙 경고 ≠ 실험 확정 — 기존 면책 원칙을 라벨·안내문에도 적용.
