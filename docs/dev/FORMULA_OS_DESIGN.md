# Formula OS — Phase 5-A 기본 설계안

> 상위 문서: `PASS_TO_PRACTICE_STRATEGY.md` (전략), `Cosmetic Master Business Plan.md` (사업)
> 범위: **Phase 5-A MVP만** — 원료 DB + 배합 계산기 + My Formula + 규정 Check
> 검증 지표: **"한 달 후에도 포뮬러를 만들러 다시 오는가"** (5-A 사용자의 30%가 2개월차에 ≥1개 포뮬러 생성)

---

## 1. 설계 원칙

1. **Zero-Backend 유지** — 5-A는 localStorage + 기존 데이터 번들로 완결. Supabase·인증은 5-C에서 검토.
2. **기존 자산 최대 재사용** — 원료 데이터(1,357종), 계산 엔진, 사전 뷰, 백업/복원, 이벤트 위임 패턴 그대로.
3. **기능 삭제 없이 추가** — Pass Loop(시험 학습)과 병존. 실무 모드는 내비의 별도 그룹.
4. **생성 vs 검증 분리** — 시스템은 배합량을 "제안"하지 않는다. 사용자가 입력하고 시스템이 고시 데이터로 "검증"만 한다.
5. **규정 ≠ 안전성** — "법정 한도 내"와 "안전함"을 UI에서 분리 표기.
6. **용어 통일** — "처방" 금지. 배합/포뮬러/레시피만 사용 (UI·DB·코드 공통).

---

## 2. 제품 구조 (정보 아키텍처)

### 2.1 내비게이션

사이드바에 4번째 그룹 추가 — 시험 학습 그룹과 시각적으로 분리:

```
학습        대시보드 · 플래시카드 · 기출 퀴즈
훈련 · 평가  스마트 훈련소 · 오답/중요 복습 · 실전 모의고사
자료 · 도구  교재 읽기 · 교재 검색 · 성분 사전 · 캘린더
실무 (Formula OS)  ← 신규
            포뮬러 라이브러리 (formula-view)
```

**구현 선택 — 단일 허브 뷰**: `formula-view` 하나로 4개 기능을 서브 패널로 제공 (스마트 훈련소의 `trainer-view` 패턴 재사용). 내비 항목 1개만 추가돼 Phase 1 복잡도 정리와 충돌하지 않는다.

### 2.2 허브 화면 구성 (formula-view)

```
┌─ Formula OS ──────────────────────────┐
│ [📋 내 포뮬러]  3개 · 최근 수정 2일 전   │
│ [⚖️ 배합 계산기] 총량×배합률→투입량      │
│ [🧴 원료 DB]    1,357종 검색·한도 확인   │
│ [✅ 규정 Check]  배합표 → 한도 검증      │
└────────────────────────────────────────┘
```

| 서브뷰 | 역할 | 재사용 |
|---|---|---|
| `formula-list` | 포뮬러 목록·검색·복제·삭제 | review-view 카드 패턴 |
| `formula-edit` | 포뮬러 작성 (원료 행 추가, 각 배합률 입력, 자동 계산) | 신규 |
| `formula-calc` | 단발 계산기 (총량 + % → g/mL) | `trainer-calc.js` 로직 개념 |
| `formula-ing` | 원료 검색·상세 (사전의 실무판) | `dictionary.js` 확장 |

규정 Check는 별도 서브뷰가 아니라 **포뮬러 편집 화면 내 검증 패널**로 통합 — 편집 중 실시간 검증이 사용 흐름상 자연스럽다. 허브 카드는 포뮬러 편집으로 직행.

---

## 3. 데이터 모델

### 3.1 저장 키 (localStorage, 시험 스코프)

| 키 | 내용 | 스코프 |
|---|---|---|
| `formula_items` | 포뮬러 배열 (최대 Free 5개) | `cosmetic:` (scopedKey 자동) |
| `formula_last_used` | 마지막 사용 일시 배열 (재방문 지표용) | `cosmetic:` |
| `formula_seq` | id 채번 카운터 | `cosmetic:` |

`BACKUP_KEYS`에 `formula_items` 추가 → 기존 백업/복원이 그대로 포뮬러를 포함.

### 3.2 포뮬러 스키마 (5-A 단순화판)

```json
{
  "id": "f_0007",
  "name": "보습 세럼 A",
  "totalVolume": 100,
  "totalUnit": "g",
  "ingredients": [
    {
      "name": "페녹시에탄올",
      "concentration": 0.8,
      "amount": 0.8,
      "limitText": "1.0%",
      "check": "ok | warn | banned | unknown"
    }
  ],
  "notes": "지성 피부용",
  "createdAt": "2026-09-21T09:00:00",
  "updatedAt": "2026-09-21T09:00:00"
}
```

- `amount = totalVolume × concentration / 100` (저장 시 계산값도 함께 보관 — 재계산 버그 방지용 스냅샷)
- `check`는 저장 시점의 검증 결과 스냅샷. 고시 개정 시 재검증 대상이 됨(5-B 영향 분석의 기반).
- 버전 관리·고객 연결은 5-B — 5-A에서는 `version`/`customer` 필드를 만들지 않는다.

### 3.3 Free 한도

`formula_items.length >= 5`이면 "새 포뮬러" 비활성 + 안내 문구. 결제 인프라가 없으므로 한도는 **제품 정책 선언**으로만 동작 — 클라이언트 강제는 느슨한 게이트로 충분.

---

## 4. 핵심 엔진 설계

### 4.1 배합 계산기 (`formula-calc`)

```
총량 [100] [g ▾]
원료 배합률 [0.8] %  →  투입량: 0.8 g
```

- 단위: g / mL (mL는 밀도 근사 1 g/mL 가정 명시 — 정밀 환산은 사용자 책임임을 툴팁 표기)
- 복수 행 지원: 여러 원료 % 를 한 번에 넣고 각 투입량 + 합계 표시
- "이 배합을 포뮬러로 저장" 버튼 → formula-edit로 이동 (전환 유도 — Lock-in 시작점)

### 4.2 규정 Check 엔진 (`formula-check.js` 신규 모듈)

`INGREDIENTS_DATA`의 `type`·`limit` 텍스트를 규칙 기반으로 해석:

```
type=banned              → check=banned   (🔴 사용 금지 원료)
type=restricted + limit  → 수치 파싱 → 입력 농도와 비교
    농도 > 한도           → check=warn     (🟠 한도 초과)
    농도 ≤ 한도           → check=ok       (🟢 한도 이내)
type=approved            → check=ok       (🟢 사용 가능, 한도 표기는 참고)
limit 파싱 불가/조건부    → check=unknown  (⚪ 원문 표시, 사람 확인 요청)
```

**limit 파서 규칙** (보수적 설계 — 파싱 실패는 unknown으로, 오판 금지):
- `"1.0%"` → 단순 한도 1.0
- `"5.0% (두발용)"` → 한도 5.0 + 조건 텍스트 표시 (조건 충족 여부는 사용자 판단 — 검증은 수치만)
- `"0.4% (단일), 0.8% (혼합)"` → 혼합 기준 0.8을 적용하고 단일/혼합 구분 표기
- `"사용 후 씻어내는 제품에 0.0015%..."` → 조건부 → 0.0015 파싱 + 전체 원문 표시
- 수치 없음/복잡 조건 → unknown

**UI 분리 표기 (안전 설계 §4.3)**:
- 🟢 한도 이내 / 🟠 한도 초과 / 🔴 사용 금지 / ⚪ 확인 필요
- 한도 이내 배지 옆에 항상 `법정 한도 기준이며 안전성을 보장하지 않습니다` 문구 (1회 표시, 클릭 시 상세)

### 4.3 원료 DB (`formula-ing`)

기존 `dictionary.js`의 검색을 확장 — 원료 탭 시 상세 패널:

```
글리세린 (Glycerin)            [포뮬러에 추가]
─────────────
분류: approved · 보습제
한도: — (제한 없음)
설명: 건조한 피부에 수분을...
TIP:  폴리올의 대표 성분, 고농도 시 피부 자극
```

- "포뮬러에 추가" → 편집 중인 포뮬러가 있으면 원료 행 삽입, 없으면 새 포뮬러 생성
- 시험용 사전(정의 검색)과 실무용(한도·적합성)은 **같은 데이터, 다른 컨텍스트** — dictionary 뷰에 "실무 정보" 섹션을 추가하는 방식도 가능하나, 5-A에서는 formula-view 안의 검색으로 분리해 Pass/Practice 경계를 유지

---

## 5. 기술 구조

### 5.1 신규 파일

```
src/views/formula.js          # 허브 + 라우팅 + 목록 렌더
src/views/formula-edit.js     # 편집 서브뷰 (원료 행 CRUD, 실시간 계산·검증)
src/formula-store.js          # localStorage CRUD, 한도 게이팅, 채번
src/formula-check.js          # 규정 Check 엔진 (limit 파서 + type 판정)
index.html                    # formula-view 섹션 + 내비 아이템 + 그룹 라벨
css/                          # 기존 토큰 재사용, 소규모 추가분
tests/unit/formula-check.test.js   # limit 파서·판정 경계 테스트
tests/unit/formula-store.test.js   # CRUD·Free 한도 테스트
```

### 5.2 연결점

| 연결 | 방법 |
|---|---|
| 원료 데이터 | `DataLoader.loadIngredients()` (기존, 온디맨드) |
| 뷰 전환 | `viewRenderers['formula-view']` + router titlesMap (기존 패턴) |
| 이벤트 | `data-click`/`data-arg` 위임 + `DELEGATED_HANDLERS` 등록 (delegation-guard 대응) |
| 저장 | `safeGetItem`/`safeSetItem` → 자동 `cosmetic:` 스코프 |
| 백업 | `BACKUP_KEYS`에 `formula_items` 추가 |
| 기능 게이트 | `features` 플래그 `formula` — cosmetic만 활성 (다른 시험에서 자동 숨김) |
| SW 캐시 | 신규 JS는 `SHELL_ASSETS` 자동 포함 검증(`verify:assets`)에 의존 — 목록 추가 필요 |

### 5.3 재방문 지표 (검증용, 로컬)

`formula_last_used`에 `["2026-09-21", ...]` 식으로 포뮬러 관련 활동(생성·수정·열람·계산기 사용)을 날짜로만 기록. 외부 전송 없이 사용자가 백업을 공유하면 검증 지표로 읽을 수 있는 최소 수단.

---

## 6. 구현 슬라이스 (커밋 단위 제안)

| # | 범위 | 산출물 |
|---|---|---|
| 1 | `formula-check.js` + 단위 테스트 | limit 파서, type 판정, 경계 케이스 (조건부·복합 한도·금지) |
| 2 | `formula-store.js` + 테스트 | CRUD, 5개 한도, 채번, 백업 키 등록 |
| 3 | `formula-view` 허브 + 목록 + 계산기 | 내비 그룹 추가, 카드 허브, 단발 계산기 |
| 4 | `formula-edit` | 원료 행 CRUD, 실시간 검증 배지, 저장/복제/삭제 |
| 5 | 원료 DB 상세 + "포뮬러에 추가" | dictionary 확장 또는 허브 내 검색 |
| 6 | 마감 | 사용자 매뉴얼, SW 스탬프, 검증 지표 |

슬라이스 1~2는 UI 없이 먼저 검증 가능 — 실패 가능성이 큰 규정 파서를 앞에 둔다.

---

## 7. 5-A에서 하지 않는 것 (명시적 제외)

- 버전 관리, 고객 기록, 법령 알림, 영향 분석 → **5-B**
- AI 배합 참고 → **5-C** (법률 검토 선행)
- Supabase·계정·동기화·결제 → **5-C**
- 커뮤니티 → **5-D**
- 포뮬러 템플릿/공유 → 검증 후 검토

## 8. 리스크

| 리스크 | 완화 |
|---|---|
| limit 문자열 파싱 오류로 잘못된 검증 | 파싱 실패는 무조건 `unknown` (수치 검증 포기, 원문만 표시) — 오탐보다 미탐이 안전 |
| "한도 이내 = 안전" 오인 | 배지 옆 고지 문구 상시 표기 |
| 실무 모드가 시험 학습 흐름을 방해 | 내비 그룹 분리 + features 게이트, Pass 뷰에는 침입 안 함 |
| localStorage 용량 | 포뮬러 수백 개도 수십 KB — 문제 없음. 백업 JSON에 자동 포함 |
| 재방문 검증 실패 | 5-A 범위에서만 손실 — 5-B 이후 투자 중단 (계획된 실패) |
