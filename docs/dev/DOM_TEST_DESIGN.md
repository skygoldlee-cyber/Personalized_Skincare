# DOM 시나리오 테스트 설계 (jsdom)

> 상태: 🔄 확장 진행 중 — Phase 1(실무 코어) 완료 · 작성일: 2026-09-23 · 확장: 2026-09-23

## 1. 목적

UI/UX의 **상황별 기능 동작**을 실제 브라우저 없이 자동 검증한다 — 패널 전환,
폼 저장→목록 반영, 파일 가져오기 전체 흐름, 상태 배지, 영속화 등
"사용자가 버튼을 눌렀을 때 벌어지는 일"을 회귀 가드로 고정한다.

**커버리지 목표는 학습·실무 전 영역의 케이스별 시나리오다** — 앱의 모든 뷰
컨트롤러에 대해 정상 흐름·빈 상태·경계값·오류/거부·영속성 케이스를 정의하고
우선순위에 따라 단계적으로 구현한다 (§5·§6).

## 2. 테스트 가능 범위 (jsdom 경계)

| 영역 | jsdom | 비고 |
|---|---|---|
| 패널 전환·`is-hidden` 토글 | ✅ | `showPanel`·서브내비 칩 활성 상태 |
| 폼 읽기/쓰기·저장→리렌더 | ✅ | 실제 index.html 마크업 사용 |
| 파일 가져오기 (CSV/JSON) | ✅ | `input.files` 주입 + `change` 디스패치, `File.arrayBuffer()` 지원 |
| 인코딩 분기 (UTF-8/EUC-KR) | ✅ | 바이트 배열로 File 생성 |
| `showToast`/`showConfirm` 호출 | ✅ | `vi.mock` + 호출 인자 검증 |
| localStorage 영속·시험별 격리 | ✅ | jsdom 내장 + `scopedKey` |
| 상태 머신 전이 (퀴즈 진행·시뮬레이터) | ✅ | state 모듈 + DOM 반영 검증 |
| SVG 차트 렌더 | ⚠️ 부분 | DOM 생성 여부까지 (레이아웃/좌표 계산 불가) |
| CSS 레이아웃·스크롤 잘림 | ❌ | jsdom은 레이아웃 엔진 없음 → Playwright 영역 |
| Service Worker·PWA·오프라인 | ❌ | 실제 브라우저 필요 |
| 실제 파일 다운로드·인쇄 | ❌ | anchor click spy로 호출 여부만 검증 |
| 오디오 재생·Media Session | ❌ | Audio 엘리먼트 스텁 필요, 재생 자체는 검증 불가 |

## 3. 아키텍처

```
tests/dom/
  helpers.js                      공통 픽스처·유틸
  backup.dom.test.js              (기존) 백업/복원
  router.dom.test.js              (기존) 뷰 전환·타이틀
  formula-nav.dom.test.js         ✅ Phase 1 — 패널 전환·서브내비 칩
  formula-customer.dom.test.js    ✅ Phase 1 — 고객 CRUD + CSV
  formula-material.dom.test.js    ✅ Phase 1 — 원료 기한 배지 + CSV
  formula-compliance.dom.test.js  ✅ Phase 1 — 체크 토글 영속·초기화
  formula-calc.dom.test.js        ✅ Phase 2a — 계산기·규정 검증·포뮬러 저장·JSON
  formula-batch.dom.test.js       ✅ Phase 2b — 배치 채번·QC·위생·보정·인쇄
  formula-print.dom.test.js       ✅ Phase 2c — 기록지·라벨·안내문·print-area
  ── 이하 설계 (§5 매트릭스) ──
  study-quiz.dom.test.js          퀴즈 시작→채점→결과
  study-flashcard.dom.test.js     카드 로드→뒤집기→암기 표시
  study-dashboard.dom.test.js     통계 렌더·약점 추천
  study-reader.dom.test.js        교재 열기·읽기 위치 이어하기
  …
```

### 3.1 helpers.js API

| 함수 | 역할 |
|---|---|
| `loadIndexHtml()` | `index.html`의 `<body>`를 jsdom `document.body`에 주입 (script 제거). **실제 마크업을 쓰므로 id 오기재·버튼 누락도 잡는다** |
| `el(id)` | `getElementById` 단축 |
| `isVisible(id)` | `!el(id).classList.contains('is-hidden')` |
| `selectFile(inputId, file)` | `input.files` 주입 + `change` 이벤트 디스패치 |
| `flushAsync(ms)` | FileReader·arrayBuffer·showConfirm 비동기 체인 대기 |
| `lastToast()` | 모킹된 `showToast`의 마지막 호출 인자 `[message, type]` |
| `spyAnchorDownload()` | `a.click()` spy로 다운로드 트리거 검증 |

학습 영역 확장 시 추가 예정 (§5.3):

| 함수 | 역할 |
|---|---|
| `seedStudyData(subjId, {cards, quizzes})` | `window.STUDY_DATA` 과목 스텁 주입 |
| `seedProgress({memorized, weak, quizResults})` | localStorage 시딩 후 `loadProgress()`로 `state` 재구성 |
| `stubRegistry(subjects)` | `window.DATA_REGISTRY` 최소 레지스트리 스텁 |

### 3.2 핸들러 호출 방식

`data-click` **위임 자체는 테스트하지 않는다** — `app.js` 전체 부팅은
부작용(오디오·차트·SW 등록)이 크고, 위임 매핑은 `delegation-guard` 유닛
테스트가 이미 정적으로 검증한다. 대신 **컨트롤러 export 함수를 직접 호출**
(`custNew()`·`startQuiz()`·`compToggle(id)`)하고 DOM 결과를 검증한다.
유일한 실제 이벤트 경로는 file input의 `change` — `input.dataset.bound`
리스너 바인딩 로직까지 커버하기 위해 `dispatchEvent`를 사용한다.

### 3.3 모킹 전략

| 대상 | 방법 |
|---|---|
| `ui-utils.js` | `vi.mock` — `showToast: vi.fn()`, `showConfirm: vi.fn(() => Promise.resolve(true))`. 거부 시나리오는 `mockResolvedValueOnce(false)` |
| `localStorage` | jsdom 내장 그대로 사용, `beforeEach`에서 `clear()` |
| 다운로드 | `document.createElement('a')` spy (backup.dom.test.js 패턴) |
| `window.ExamViewer` | 법령 링크 테스트 시 `window.ExamViewer = { openExam: vi.fn() }` 주입 |
| `window.STUDY_DATA` | 학습 뷰 테스트 시 과목 스텁 직접 대입 (DataLoader 경유 X) |
| `charts.js` | DOM 생성까지는 실사용, 좌표 의존 함수만 `vi.mock` |
| `reader-audio.js` | 오디오 무관 뷰는 `vi.mock`으로 무력화 |
| `matchMedia`/`scrollTo`/`IntersectionObserver` | jsdom 미지원 — helpers에 폴리필 스텁 집중 |
| 모듈 상태 | `vi.resetModules()` 미사용 — 모듈 레벨 폼 상태(`cust.editingId`)는 흐름상 컨트롤러가 재설정 |

## 4. 구현 완료 — 실무 영역 Phase 1 (27개)

### formula-nav.dom.test.js (5)
- `initFormulaView` → 허브만 표시, 저장 배지 갱신
- `openCustomerPanel`/`openMaterialPanel`/`openCompliancePanel` → 대상 패널 표시 + 서브내비 6칩 + 활성 칩 정확
- `exitFormulaSubView` → 허브 복귀
- 서브내비 칩의 `data-click`가 실제 핸들러명과 일치

### formula-customer.dom.test.js (9)
- 빈 상태 → `custNew` 폼 → 이름 입력 → `custSave` → 상세 패널 + 목록 카드
- `custImportCsv`: UTF-8 CSV 2행 → confirm 후 2건 추가·토스트 요약
- EUC-KR 바이트 파일 → 한글 디코딩 성공
- 중복 이름 건너뜀 집계, 헤더 불일치 파일 → 오류 토스트, confirm 거부 → 미반영
- `custExportCsv`/`custCsvTemplate` → 다운로드 트리거 + 토스트

### formula-material.dom.test.js (5)
- 빈 상태 → 등록 → 목록 카드
- 기한 상태 4종 배지: expired(어제) · soon(D-10) · ok(D-90) · none(미기재)
- 경고 배너 표시·숨김 조건
- CSV 가져오기 — 이름+LOT 중복 건너뜀, 날짜 `YYYY.M.D`/`YYYY/M/D` 정규화 반영

### formula-compliance.dom.test.js (8)
- 패널 렌더 — 6개 섹션·27항목·진행 배지 `0/27`
- `compToggle` → localStorage 영속 + 재렌더 시 checked 유지 + 배지 `1/27`
- 재토글 → 해제, 미등록 id → 무동작
- `compReset` confirm 승인/거부 분기
- `compOpenLaw` → `window.ExamViewer.openExam`에 참조자료 경로 전달 / 미존재 시 안내 토스트

## 5. 전체 영역 시나리오 매트릭스

모든 뷰에 대해 6가지 케이스 유형을 기준으로 시나리오를 정의한다:

| 유형 | 코드 | 의미 |
|---|---|---|
| 정상 흐름 | H | 해피 패스 — 핵심 기능 완주 |
| 빈 상태 | E | 데이터 0건일 때의 렌더·안내 |
| 경계값 | B | 한도·최소/최대·특수 입력 |
| 오류/거부 | X | 잘못된 입력·confirm 거부·의존 객체 부재 |
| 영속성 | P | localStorage 저장·재진입 복원·시험별 격리 |
| 재진입 | R | 같은 뷰 반복 진입 시 상태 초기화·누수 없음 |

### 5.1 실무 영역 (Formula OS) — localStorage만 의존

| 뷰 | 파일(계획) | 시나리오 (케이스) | 상태 |
|---|---|---|---|
| 허브·서브내비 | `formula-nav` | 패널 전환 전수(H) · 활성 칩(H) · 복귀(R) | ✅ 완료 |
| 고객 관리 | `formula-customer` | CRUD(H/E) · CSV 인코딩·중복·거부(B/X) ·보내기(H) | ✅ 완료 |
| 원료 장부 | `formula-material` | CRUD(H) · 기한 4상태(B) · CSV 중복·날짜(X) | ✅ 완료 |
| 법규 체크 | `formula-compliance` | 렌더(H) · 토글·초기화(P/X) · 뷰어 연동(H/X) | ✅ 완료 |
| 배합 계산기 | `formula-calc` | 배합률→투입량 계산(H) · 합계≠100 경고(X) · 고시 한도 초과 경고(B) · 고객 불러오기 연동(H) · 포뮬러 저장→배지(P) | ✅ 완료 |
| 포뮬러 목록 | `formula-calc` | 빈 목록(E) · 저장→목록 반영(H) · 삭제 confirm(X) · JSON보내기/가져오기(P) | ✅ 완료 |
| 조제 기록(배치) | `formula-batch` | 생성 채번(H) · QC 스냅샷 저장(H) · 상세·불변 정책(X) · 포뮬러 연결(H) | ✅ 완료 |
| 출력물 | `formula-print` | 기록지·라벨·안내문 생성 → print-area DOM 내용 검증(H) · 빈 드래프트/미존재 배치 거부(X) | ✅ 완료 |
| 안정성 | `formula-calc` | 안정성 기록 입력→판정 배지(H/B) | ✅ 완료 |

### 5.2 학습 영역 — `window.STUDY_DATA`·`state` 의존

| 뷰 | 파일(계획) | 시나리오 (케이스) | 주요 픽스처 |
|---|---|---|---|
| 대시보드 | `study-dashboard` | 진도 0건 렌더(E) · 진도 시딩→통계 반영(H/P) · 약점 과목 추천(H) | STUDY_DATA + seedProgress, charts 부분 모킹 |
| 플래시카드 | `study-flashcard` | 카드 로드(H) · 빈 과목 안내(E) · 뒤집기(H) · 암기/취약 표시→localStorage(P) · SM-2 due 필터(B) | STUDY_DATA(cards) |
| 기출 퀴즈 | `study-quiz` | 시작→10문제 출제(H) · 과목 무퀴즈 경고(E) · 답 선택→즉시 채점(H) · 종료→결과 화면(H) · 오답 결과 영속(P) · 중도 이탈(R) | STUDY_DATA(quizzes) |
| 오답/중요 복습 | `study-quiz` | 오답 0건 안내(E) · 오답만 재출제(H) · 복습 중 정답 시 목록 제외(P) | seedProgress(quizResults) |
| 데일리 챌린지 | `study-challenge` | 오늘 문항 생성(H) · 완료 후 재진입 시 완료 상태(R/P) · 스트릭 갱신(B) | STUDY_DATA + 날짜 고정 |
| 스마트 훈련소 | `study-trainer` | 취약 카드 집계(H) · 계산 연습 정답/오답 판정(H/X) · 원료 배합 챌린지(B) | STUDY_DATA + seedProgress |
| 뽀모도로 | `study-pomodoro` | 시작/정지→누적 표시(H) · 날짜 경계 리셋(P/B) | 타이머 fake timers |
| 모의고사 | `study-simulator` | 세트 선택(H) · 상태 전이(state 모듈) → 제출→리뷰(H) · 미응답 경고(B) | 문제은행 스텁 |
| 교재 리더 | `study-reader` | 단원 열기→MD 렌더(H) · 읽기 위치 저장→이어하기(P) · TOC 클릭(H) · 미로드 과목 안내(E) | DataLoader 모킹(정적 MD 스텁) |
| 교재 검색 | `study-search` | 쿼리→결과 목록(H) · 결과 0건(E) · 결과 클릭→리더 이동(H) | 역색인 스텁 |
| 성분 사전 | `study-dictionary` | 검색→결과·배합한도(H) · 금지 성분 경고 표시(X) · 결과 없음(E) | 성분 데이터 스텁 |
| 용어집 | `study-glossary` | 목록 렌더(H) · 검색 필터(H) · 참조 링크(H) | glossary 인덱스 스텁 |
| 학습 캘린더 | `study-calendar` | 기록→히트맵 반영(H/P) · 목표 설정(B) | seedProgress |
| 매뉴얼 뷰어 | `study-manual` | 학습↔실무 전환(H) · `doc:` 링크 전환(H) · mermaid 블록 마크업(H) | 번들 스텁 + `_renderMermaid` 모킹 |
| 문제집 뷰어 | `study-examviewer` | MD 문제집 열기·목차(H) · 인쇄 버튼(H) | 번들 스텁 |
| 시험 선택 | `study-examselect` | 목록 렌더(H) · 전환 호출→reload 트리거(H) | EXAMS_LIST 스텁 + reload 모킹 |

### 5.3 공통/시스템 영역

| 영역 | 파일(계획) | 시나리오 (케이스) |
|---|---|---|
| 백업/복원 | `backup` (기존) |보내기(H) · 복원(H) · 손상 파일(X) | ✅ 완료 |
| 라우터 | `router` (기존) | 뷰 전환·타이틀·active 동기화(H) | ✅ 완료 |
| 테마 | `common-theme` | 토글→`data-theme` 속성·localStorage(H/P) · 시스템 테마(B) |
| 오프라인 감지 | `common-offline` | `offline` 이벤트→배너 표시(H) · 복귀→해제(H) | navigator.onLine 스텁 |
| 스크래치패드 | `common-scratchpad` | 열기/닫기(H) · 지우기(H) | canvas 2d 컨텍스트 스텁 |
| 접근성 | `common-a11y` | 토스트 `role="status"` 갱신 · 모달 `trapFocus` · 아이콘 버튼 `aria-label` 존재 전수 |
| `data-click` 위임 | (유닛) | `delegation-guard`가 정적 검증 — DOM 테스트 범위 제외 | ✅ 완료(유닛) |

### 5.4 케이스 우선순위

모든 뷰에 6유형을 강제하지 않는다 — 뷰 특성상 무의미한 케이스(예:
매뉴얼 뷰어의 경계값)는 생략하고, **데이터가 있는 뷰는 E(빈 상태)와
P(영속성)를 필수**로, **입력 폼이 있는 뷰는 X(오류/거부)를 필수**로 한다.

## 6. 단계별 로드맵

| Phase | 범위 | 예상 규모 | 상태 |
|---|---|---|---|
| **1** | 실무 코어: nav·고객·원료·법규 | 27개 | ✅ 완료 |
| **2** | 실무 잔여: 계산기·배치·출력물 | 28개 | ✅ 완료 |
| **3** | 학습 코어: 퀴즈·플래시카드·대시보드 (helpers에 STUDY_DATA/registry 픽스처 추가) | ~20개 | 📋 설계 |
| **4** | 학습 확장: 리더·검색·사전·용어집·시뮬레이터·캘린더·챌린지·훈련소·뽀모도로 | ~35개 | 📋 설계 |
| **5** | 공통: 테마·오프라인·스크래치패드·a11y·매뉴얼/문제집/시험선택 뷰어 | ~15개 | 📋 설계 |
| **6** | Playwright E2E (별도 설계) — 레이아웃·SW·PWA·실제 다운로드/인쇄 | 스모크 5개 내외 | ⏸️ 보류 |

Phase 3~5는 helpers 픽스처(§3.1 추가 예정 API)가 선행 과제다 — 학습 뷰는
Formula OS와 달리 `window.STUDY_DATA`·`state`·`DataLoader`·차트·오디오
의존이 있어 뷰별 모킹 조합을 §5.2의 "주요 픽스처" 열로 관리한다.

## 7. 작성 규칙

- 각 테스트 파일 선두에 `vi.mock('../../src/ui-utils.js', …)` — ESM 호이스팅으로 컨트롤러 import보다 먼저 적용됨
- `beforeEach`: `localStorage.clear()` + `loadIndexHtml()` (+ 학습 영역은 `delete window.STUDY_DATA`·필요 픽스처 시딩)
- 비동기 플로우 끝에 `await flushAsync()` — `setTimeout(0)` 1~2회
- 토스트 검증은 문구 `stringContaining` + type 인자까지 확인
- 파일 단위 `describe` — 시나리오 순서 의존 최소화(스토어 상태는 localStorage로 고정)
- 학습 뷰는 **모듈 싱글턴 `state`를 공유**하므로 `loadProgress()` 재호출 또는 state 필드 직접 리셋으로 테스트 간 격리
- 날짜 의존 로직(기한 배지·스트릭·뽀모도로)은 `vi.useFakeTimers()` + `setSystemTime`으로 고정

## 8. 실행

```powershell
npm.cmd run test:dom      # Vitest + jsdom 전체
npm.cmd run test:all      # unit + parser parity + imports + dom
```

## 9. 한계 및 E2E 확장 (Playwright)

jsdom이 커버 못 하는 영역 — 실제 레이아웃(사이드바 스크롤 잘림 같은 CSS 버그),
SW·PWA 설치, 실제 다운로드/인쇄, 오디오 재생 — 은 `tests/e2e/`에 Playwright
스모크(앱 로드→뷰 전환→CSV 업로드)로 분리. 브라우저 바이너리(~150MB) 필요로
CI 기본 파이프라인과 분리해 `npm run test:e2e` 수동 실행을 권장한다.
