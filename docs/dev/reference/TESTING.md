# 🧪 단위 테스트 가이드 (Unit Testing Guide)

> **작성일**: 2026-09-03
> **대상**: `tests/` 디렉토리의 자동화 테스트 (Unit + DOM)
> **프레임워크**: Node.js 내장 `node:test` (Unit) + Vitest/jsdom (DOM)

---

## 📋 목차

1. [테스트 개요](#1-테스트-개요)
1A. [테스트 정책](#1a-테스트-정책)
2. [실행 명령어](#2-실행-명령어)
3. [테스트 파일 목록](#3-테스트-파일-목록)
4. [테스트 분류별 상세](#4-테스트-분류별-상세)
5. [새 테스트 작성 가이드](#5-새-테스트-작성-가이드)
6. [CI 연동](#6-ci-연동)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 테스트 개요

| 구분 | 프레임워크 | 환경 | 파일 위치 | 테스트 수 |
|------|-----------|------|-----------|-----------|
| **Unit** | `node:test` | Node.js (DOM 없음) | `tests/unit/*.test.js` | 552 |
| **DOM** | Vitest + jsdom | 브라우저 DOM 시뮬레이션 | `tests/dom/*.test.js` | 358 |
| **합계** | | | | **873** |

### 설계 원칙

- **순수 로직 우선**: DOM 의존성 없는 모듈(`sanitize.js`, `sha256.js`, `trainer-calc.js` 등)은 Node.js 내장 테스트로 검증 → 빠르고 가벼움
- **DOM 테스트 분리**: `localStorage`, `document` 등 브라우저 API가 필요한 테스트는 Vitest + jsdom 환경에서 실행
- **회귀 가드**: CSP 위반(`delegation-guard`), Mermaid 렌더링 파이프라인 등 배포 후에만 발견되는 버그를 사전 차단
- **실제 콘텐츠 검증**: 교재 MD 파일의 Mermaid 블록 들여쓰기, 문법 등 실제 콘텐츠를 대상으로 검증
- **교재 무관 공통 테스트**: 합성 데이터(synthetic data)를 사용하여 교재 콘텐츠가 바뀌어도 로직 자체를 검증 (`study-aids`, `pdf-registry`, `glossary-query`, `markdown-parser-general`, `reader-format-general`)
- **커버리지 측정**: 두 러너가 갈라 있어(vitest=DOM, node:test=유닛) 단일 리포트로는 실수치가 안 나온다 — `coverage:all`이 c8+vitest 결과를 병합해 실질 커버리지를 산출. jsdom으로 검증 불가한 환경 의존 모듈(PWA 설치·Audio·PerformanceObserver·typedef-only)은 `vitest.config.mjs`의 `coverage.exclude`로 분모에서 제외

---

## 1A. 테스트 정책

### 언제 테스트를 추가하는가 (진입 기준)

| 변경 유형 | 테스트 의무 | 최소 범위 |
|---|---|---|
| 버그 수정 | **필수** | 실패를 재현하는 테스트 1개 — 수정 전 실패, 수정 후 통과 확인 |
| 순수 로직 모듈 신규/변경 (storage, store, rules, parser 계열) | **필수** | 해피 경로 + 엣지(빈값/손상 데이터) + 실패 경로 1개씩 |
| 뷰 컨트롤러 기능 추가 | **권장** | DOM 테스트 — 사용자 시나리오 단위(§DOM_TEST_DESIGN 5.4 우선순위 참조) |
| 스타일·문구·마크업만 변경 | 불필요 | 기존 테스트 통과 확인으로 충분 |
| 콘텐츠(MD/문제은행) 변경 | 불필요 | `check:content` 계열 검증이 대신함 |

### 랜덤/셔플 대상의 단정 규칙

- **셔플된 선택지·랜덤 오답지가 있는 UI에서 대상 요소를 텍스트 부분문자열(`includes`)로 찾지 않는다** — `"5"`가 `"50"`에 매치되어 간헐 실패·오표시의 원인이 된다. `data-*` 속성의 원본 값 또는 접미사 제거 후 `===` 비교 (DOM_TEST_DESIGN §3.3 참조).
- `Math.random`/`Date` 의존 결과를 단정할 때는 값 자체가 아니라 **불변식**(개수·범위·상태 전이)을 검증한다.

### flaky 발견 시 절차

1. **재실행으로 확인** — 해당 파일 단독 실행이 통과하면 전체 스위트에서 재실행해 간헐성 확인.
2. **원인을 찾아 수정** — "재실행하면 통과"로 넘기지 않는다. 공유 상태 누수·비결정 입력(랜덤·시간)·비동기 경합·부분문자열 매칭이 주된 원인.
3. **기록** — 원인과 교훈을 CHANGES.md에 남기고, 재발 방지 규칙이면 본 문서 또는 DOM_TEST_DESIGN.md에 반영.
4. quarantine(스킵)은 **최후 수단** — 이유를 주석으로 명시하고 follow-up을 남긴다.

### 커버리지 기준

- **순수 로직 모듈은 유닛 테스트 필수** — 새 leaf 모듈(`weak-items.js`, `storage.js` 패턴)은 테스트 파일을 함께 만든다.
- **뷰는 시나리오 기반** — 라인 커버리지가 아니라 DOM_TEST_DESIGN §5 매트릭스의 H(해피)/P(영속)/X(실패) 케이스 존재 여부로 판단한다.
- 절대 수치 목표는 두지 않는다 — 낮은 커버리지 영역은 §6의 "남은 저커버리지 영역" 표로 관리하며, 위험도(데이터 손실·법정 기록)가 높은 경로부터 채운다.

---

## 2. 실행 명령어

```bash
# Unit 테스트만 실행
npm test
# 또는
npm run test:unit

# DOM 테스트만 실행
npm run test:dom

# 전체 실행 (Unit + 파서 정합성 + DOM)
npm run test:all

# 커버리지 — DOM만 / 유닛만 / 병합(실질 수치)
npm run coverage          # vitest(V8) → coverage/
npm run coverage:unit     # c8 + node:test → coverage-unit/
npm run coverage:all      # 둘 다 실행 후 coverage-merged/ 병합 리포트 생성

# Watch 모드 (Unit, 파일 변경 시 자동 재실행)
npm run test:watch
```

### `package.json` 스크립트 정의

| 스크립트 | 명령 | 비고 |
|----------|------|------|
| `test` | `node --test tests/unit/*.test.js` | Unit 테스트 |
| `test:unit` | `node --test tests/unit/*.test.js` | `test`와 동일 |
| `test:dom` | `vitest run` | DOM 테스트 (jsdom) |
| `coverage` | `vitest run --coverage` | DOM 테스트 + V8 커버리지 (src/ 대상, `coverage/` 출력) |
| `coverage:unit` | `c8 ... node --test tests/unit/*.test.js` | 유닛 테스트 커버리지 (src/ 대상, `coverage-unit/` 출력) |
| `coverage:all` | 두 커버리지 실행 + `tools/coverage_merge.js` | 유닛+DOM 병합 리포트 (`coverage-merged/`) — 실질 커버리지는 이 수치 |
| `test:all` | `node --test tests/unit/*.test.js && node tools/check_parser_parity.js && vitest run` | 전체 |
| `test:watch` | `node --test --watch tests/unit/*.test.js` | Watch 모드 |

---

## 3. 테스트 파일 목록

### Unit 테스트 (`tests/unit/`)

| # | 파일 | 테스트 수 | 검증 대상 | 비고 |
|---|------|-----------|-----------|------|
| 1 | `sanitize.test.js` | 9 | `escapeHTML()`, `safeTextWithBreaks()`, `esc()` | XSS 방어 유틸리티 |
| 2 | `sha256.test.js` | 13 | `sha256hex()`, `stableId()` | Node `crypto`와 교차 검증 |
| 3 | `id-factory.test.js` | 13 | `stableId()`, `shortHash()` | 빌드 타임 ID 생성 로직 |
| 4 | `utils.test.js` | 7 | `getChosung()` | 한글 초성 추출 |
| 5 | `trainer-calc.test.js` | 8 | `buildCalcQuestion()` | 계산 훈련 문제 생성 |
| 6 | `state.test.js` | 16 | `loadProgress()`, `saveProgress()`, `cleanOrphansForSubject()` | localStorage 모킹 |
| 7 | `textbook-parser.test.js` | 20 | `parseMarkdownFile()`, `parseTextbookContent()`, `buildSubjectData()` | 교재 MD 파싱 |
| 8 | `delegation-guard.test.js` | 2 | 인라인 `on*=` 속성 잔존, `window` 브리지 누락 | CSP 회귀 가드 |
| 9 | `mermaid-parser.test.js` | 11 | `parseMarkdown()`의 Mermaid 코드블록 처리 | `<pre class="mermaid">` 변환, HTML 엔티티 보존 |
| 10 | `mermaid-textcontent.test.js` | 5 | Mermaid 블록 `textContent` 시뮬레이션 | 브라우저 `textContent` 동작 재현 |
| 11 | `mermaid-reader-format.test.js` | 4 | `formatSectionContentForReader()` 처리 후 Mermaid 블록 보존 | `<br/>` 엔티티, 페이지 참조/용어집 링크 간섭 |
| 12 | `mermaid-pipeline.test.js` | 4 | 전체 파이프라인: MD → HTML → Mermaid 블록 | HTML 태그 미혼입, 볼드/이탤릭/링크 비적용 |
| 13 | `mermaid-rendering.test.js` | 23 | 다이어그램 타입 감지, mindmap 들여쓰기, CSS 클래스 분리, 실제 교재 파일 검증 | 2026-09-02 추가 |
| 14 | `study-aids.test.js` | 25 | `extractExamHighlights()`, `extractNumberDrills()`, `detectProcedureFlow()`, `detectAdminPenalty()`, `isKeySection()` | 합성 데이터, 교재 무관 |
| 15 | `pdf-registry.test.js` | 21 | `resolveRefPath()`, `mapSourceToRef()`, `resolveKeywordRef()`, 데이터 구조 검증 | 합성 데이터, 교재 무관 |
| 16 | `glossary-query.test.js` | 13 | `getGlossaryByRefFile()`, `getGlossaryByRefFiles()`, `getGlossaryEntry()`, `getAllGlossaryKeywords()` | 합성 데이터, 교재 무관 |
| 17 | `markdown-parser-general.test.js` | 47 | 헤더, 표, 리스트, 인용문, 특수 토큰, 빈 입력 + `joinWraps`(ref_md 시각적 줄 병합, 러닝헤더 스킵) | 합성 데이터, 교재 무관 |
| 18 | `reader-format-general.test.js` | 19 | 페이지 참조 제거, 기출문제/참조자료/출처 링크 변환, 용어집 자동 링크, Mermaid 보호 | 합성 데이터, 교재 무관 |
| 19 | `combo-transform.test.js` | 7 | 복수정답형(ⓐⓑⓒ) 문항 변환 — 진술 추출, 정답 조합, 변형 ID | `src/questions.js` (`generateComboOptions`, `deriveComboAnswer`) |
| 20 | `statement-tracker.test.js` | 9 | 복수정답형 진술별 정답 추적·통계 | `src/questions.js` (`gradeAnswer`) + `src/statement-tracker.js` |
| 21 | `questions.test.js` | 17 | `src/questions.js` — 문제 필터·출제 로직 | 합성 데이터 |
| 22 | `data-loader.test.js` | 7 | `src/data-loader.js` — 데이터 번들 로딩, 캐시 동작 | `window` 글로벌 모킹 |
| 23 | `exam-context.test.js` | 12 | `src/exam-context.js` — 시험 해석, `scopedKey` 네임스페이스, 기능 플래그 | 합성 데이터 |
| 24 | `storage-key-sync.test.js` | 2 | `src/storage-keys.js` 선언 키 ↔ 실제 사용 키 동기화 | 키 누락 회귀 가드 |
| 25 | `formula-store.test.js` | 31 | `src/formula-store.js` — 포뮬러 CRUD·저장 한도(5), 고객·원료·안정성 스키마 정제, 전성분 표시 순서 | Formula OS, localStorage 모킹 |
| 26 | `formula-rules.test.js` | 23 | `src/formula-rules.js` — 추천 규칙, 안전 필터(금지·알레르기·임신수유), 맞춤 규칙 병합·직렬화 | Formula OS, 합성 데이터 |
| 27 | `formula-check.test.js` | 20 | `src/formula-check.js` — 원료 인덱스, 배합 검증(한도이내/초과/금지/확인필요), 고시 출처 | Formula OS, 합성 데이터 |
| 28 | `formula-stability.test.js` | 22 | `src/formula-stability.js` — 상 비율·상호작용·투입 단계·pH 규칙, 미판정 불변식 | Formula OS, 합성 데이터 |
| 29 | `batch-store.test.js` | 14 | `src/batch-store.js` — 배치 채번(YYYYMMDD-NN), identity 불변, QC·위생 병합, `checkSnapshot` 보존, 50건 한도, LOT 추적·인도일·재고 경고·QC 조치 | Formula OS Phase A |
| 30 | `usage-guide.test.js` | 7 | `src/usage-guide.js` — 제형 템플릿, 원료 주의 규칙(레티노이드·AHA·향료 등), 임신/알레르기 병기 | Formula OS Phase A |
| 31 | `customer-store.test.js` | 9 | `src/customer-store.js` — 고객 CRUD, 상담 이력 append-only, `unlinkCustomerFromFormulas`, 20명 한도 | Formula OS Phase B |
| 32 | `material-ledger.test.js` | 9 | `src/material-ledger.js` — 원료 CRUD, 기한 상태 파생(expired/soon/ok/none), `daysUntilExpiry` 자정 기준 | Formula OS Phase C |
| 33 | `formula-compliance.test.js` | 4 | `src/views/formula-compliance.js` — 항목 id 고유성, refs 유효성, 법령 파일 실존, 필수 섹션 커버리지 | Formula OS Phase D |
| 34 | `csv-import.test.js` | 17 | `src/csv-utils.js` 파서·EUC-KR 디코딩 + `importCustomers`/`importMaterials` 중복·한도·sanitize | Formula OS CSV |
| 35 | `supabase-client.test.js` | 6 | `src/supabase-client.js` — lazy init, UMD 동적 로드, 미설정 폴백 | window 스텁 |
| 36 | `sw-prune.test.js` | 5 | `sw.js` 캐시 프루닝 — 한글 경로 인코딩 오삭제 회귀 가드 | 서비스워커 로직 |
| 37 | `mermaid-utils.test.js` | 8 | `src/mermaid-utils.js` — 다이어그램 타입 감지, CSS 클래스, init 옵션(테마 분기) | 순수 함수 |
| 38 | `command-palette.test.js` | 11 | `src/command-palette.js` — `searchAll()` 통합 검색 순수 로직 | 2026-09-26 추가 |
| 39 | `learning-pro.test.js` | 20 | `src/recommendations.js` — 추천·오답 원인·예상 점수 순수 로직 | 2026-09-26 추가 |
| 40 | `storage.test.js` | 12 | `src/storage.js` — 스코프·JSON 헬퍼·쓰기 훅·백엔드 교체·`setMany` 롤백 | 저장소 추상화 |
| 41 | `whats-new.test.js` | 7 | `src/whats-new.js` — `collectNewEntries` 버전 비교·집계·상한·폴백 | 순수 함수 |
| 42 | `feedback.test.js` | 13 | `src/feedback.js` — `?src=` 캡처·sanitize, 페이로드 빌드/검증, 쿨다운, 큐·플러시 | window/localStorage 스텁 |
| | **합계** | **552** | | |

### DOM 테스트 (`tests/dom/`)

| # | 파일 | 테스트 수 | 검증 대상 | 비고 |
|---|------|-----------|-----------|------|
| 1 | `backup.dom.test.js` | 10 | `getBackupKeys()`, `exportData()`, `triggerImport()`, `importData()` | localStorage + DOM 조작 |
| 2 | `router.dom.test.js` | 11 | `getViewTitles()`, `navigateToView()` | 뷰 타이틀 맵, active 클래스 동기화, 렌더러 호출, 오디오 정지, 포커스 모드 | 2026-09-03 추가 |
| — | `helpers.js` | — | 공통 픽스처 | `loadIndexHtml()`(실제 index.html 주입), `selectFile`, `flushAsync`, `lastToast`, `spyAnchorDownload` | 2026-09-23 추가 |
| 3 | `formula-nav.dom.test.js` | 6 | 패널 전환·서브내비 | 허브↔서브패널 is-hidden 전환, 서브내비 6칩·활성 칩 | 2026-09-23 추가 |
| 4 | `formula-customer.dom.test.js` | 9 | 고객 CRUD + CSV | 빈 상태→등록→목록, CSV UTF-8/EUC-KR·중복·confirm 거부·보내기·양식 | 2026-09-23 추가 |
| 5 | `formula-material.dom.test.js` | 5 | 원료 장부 + CSV | 기한 4상태 배지·경고 배너, CSV 이름+LOT 중복·날짜 정규화 | 2026-09-23 추가 |
| 6 | `formula-compliance.dom.test.js` | 8 | 법규 체크리스트 | 27항목 렌더·배지, 체크 토글 영속·재토글·초기화, ExamViewer 연동 | 2026-09-23 추가 |
| 7 | `formula-calc.dom.test.js` | 12 | 배합 계산기·포뮬러 목록 | 투입량 계산, 합계 100% 판정, 한도 초과/금지/미등록 배지, 고객 불러오기, 저장→목록, 삭제 confirm, JSON 왕복 | 2026-09-23 추가 |
| 8 | `formula-batch.dom.test.js` | 22 | 조제 기록(배치) | 빈 목록, 처방 바인딩·기본값, QC·위생 렌더, 저장→채번·스냅샷·상세, 순번 증가, 보정 identity 잠금·QC 병합, 삭제 confirm, 인쇄 | 2026-09-23 추가 |
| 9 | `formula-print.dom.test.js` | 8 | 인쇄 산출물 | 포뮬러/배치 기록지, 라벨 전성분·폴백, 안내문 템플릿·원료 주의, afterprint 정리, 거부 케이스 | 2026-09-23 추가 |
| 10 | `study-quiz.dom.test.js` | 14 | 기출 퀴즈·오답 복습 | 출제·단답/객관식/OX 채점·결과 화면·오답 영속·재시작·약점 퀴즈·복습 필터/제외 | 2026-09-23 추가 |
| 11 | `study-flashcard.dom.test.js` | 8 | 플래시카드 | 중요도 정렬·뒤집기·순환 이동·빈 과목·기출/난이도 필터·외움/헷갈림 영속·재진입 복원 | 2026-09-23 추가 |
| 12 | `study-dashboard.dom.test.js` | 6 | 대시보드 | 0건 통계·시딩 통계·과목 카드·히트맵·약점 추천(3문 조건)·헷갈림 추천 | 2026-09-23 추가 |
| 13 | `study-challenge.dom.test.js` | 12 | 데일리 챌린지 | 미완료/완료 상태, 스트릭 유지·리셋, 8문항 모달·채점·분류, 완료 영속·재진입, 이탈 confirm | 2026-09-23 추가 |
| 14 | `study-pomodoro.dom.test.js` | 7 | 뽀모도로 | 시작/일시정지/리셋, 완주 누적, 날짜 경계 리셋 (fake timers) | 2026-09-23 추가 |
| 15 | `study-trainer.dom.test.js` | 12 | 스마트 훈련소 | 메뉴/서브패널 전환, 한도 퀴즈 채점, 계산 연습 이력·비수치 경고, 원료 챌린지·빈DB 가드, 취약 진술 복습 | 2026-09-23 추가 |
| 16 | `study-calendar.dom.test.js` | 6 | 학습 캘린더 | 목표 카드·월 그리드, 활동 기록→학습일·달성률, 월 이동, 목표 저장·기본값, 취소 불변 | 2026-09-23 추가 |
| 17 | `study-simulator.dom.test.js` | 14 | 모의고사 | 아레나·OMR, 답안·문항 이동, 제출 채점·오답 카드 등록, 리뷰, 드래프트 이어하기, 시간 만료 자동 제출, 오답 모의고사(startWeakExam — 카드/퀴즈/combo 재조립·과목 필터) | 2026-09-23 추가 |
| 18 | `study-reader.dom.test.js` | 16 | 교재 리더 | 과목 옵션·본문/TOC 렌더, 읽기 위치 이어하기, 북마크 영속, 빈 상태 + 툴바(글자/줄간격·집중모드·접기·모두접기)·본문 검색 하이라이트·모바일 TOC 드로어·표 확장 모달·TOC 클릭 스크롤·테마 동기화 | 2026-09-23 추가 |
| 19 | `study-search.dom.test.js` | 7 | 교재 검색 | 역색인 검색·하이라이트·건수, AND 교집합, 과목 필터, 결과 없음, 더보기 토글, 초기화 | 2026-09-23 추가 |
| 20 | `study-dictionary.dom.test.js` | 12 | 성분 사전 | 카드·3상태 배지, 이름/영문/초성 검색, type 필터, 빈 DB·결과 없음, 상세 토글 | 2026-09-23 추가 |
| 21 | `study-manual.dom.test.js` | 6 | 매뉴얼 뷰어 | 오버레이·MD 렌더·TOC, doc: 링크 문서 전환, sessionStorage 캐시, mermaid 마크업, 미등록 소스 오류, 닫기 | 2026-09-23 추가 |
| 22 | `study-examviewer.dom.test.js` | 7 | 문제집 뷰어 | 오버레이·MD 렌더·TOC, 인쇄 버튼→window.print, 캐시 재사용, 미존재 문서 오류, 닫기 | 2026-09-23 추가 |
| 23 | `study-examselect.dom.test.js` | 4 | 시험 선택 | 카드 렌더·현재 시험 배지, 다른 시험→저장·리로드, 같은 시험→대시보드 복귀, 빈 목록 | 2026-09-23 추가 |
| 24 | `common-theme.dom.test.js` | 4 | 테마 토글 | data-theme·localStorage 영속, 아이콘 전환, 시스템 테마 초기화 | 2026-09-23 추가 |
| 25 | `common-offline.dom.test.js` | 4 | 오프라인 감지 | offline 이벤트·프로브 실패→배너 표시, online 복귀→해제 (fake timers) | 2026-09-23 추가 |
| 26 | `common-scratchpad.dom.test.js` | 4 | 스크래치패드 | 열기/닫기·지우기·포인터 그리기 (canvas 2d 스텁, resetModules) | 2026-09-23 추가 |
| 27 | `common-a11y.dom.test.js` | 7 | 접근성 | 토스트 role=status, 모달 trapFocus·aria-modal, 아이콘 버튼 aria-label 전수 | 2026-09-23 추가 |
| 28 | `common-uimode.dom.test.js` | 7 | 학습/실무 UI 모드 | 모드 전환→학습 항목 CSS 숨김(실제 캐스케이드)·학습 도구 펼침·랜딩 리다이렉트·영속 복원·학습/실무 매뉴얼 가시성·토글 2곳(푸터·설정) 동기화 | 2026-09-23 추가 |
| 29 | `common-auth.dom.test.js` | 24 | 계정/로그인 (Supabase) | 모달 열기·로그인 성공/실패 한글 매핑·회원가입·매직링크·OTP 코드 발송/검증·비밀번호 설정·로그아웃·세션 복원 (window.supabase 스텁) | 2026-09-23 추가 |
| 30 | `common-sync.dom.test.js` | 11 | 클라우드 동기화 | 페이로드 수집(고객 제외)·쓰기 훅 dirty·디바운스 push·pull 적용·충돌 양방향·push 실패·비로그인 무시 | 2026-09-23 추가 |
| 31 | `common-glossary.dom.test.js` | 5 | 용어집 공용 경로 | 용어집 인덱스·링크 렌더 | 2026-09-24 추가 |
| 32 | `common-htmlviewer.dom.test.js` | 7 | HTML 뷰어 | 외부 HTML 콘텐츠 로드·렌더 경로 | 2026-09-24 추가 |
| 33 | `common-navigation.dom.test.js` | 4 | 뷰 전환 공용 | navigation 유틸 경로 | 2026-09-24 추가 |
| 34 | `study-trainer-drills.dom.test.js` | 12 | O/X·복수정답 드릴 | 드릴 UI·채점 경로 | 2026-09-24 추가 |
| 35 | `common-eventlisteners.dom.test.js` | 21 | 이벤트 위임·리스너 | data-click/data-args/data-input 디스패치·키보드 접근성, 설정 메뉴·진도 초기화, 플래시카드 버튼·시뮬 이동·퀴즈 단축키 | 2026-09-24 추가 |
| 36 | `study-commandpalette.dom.test.js` | 9 | 통합 검색 팔레트 | 팔레트 열기·검색·키보드 내비·실행 | 2026-09-26 추가 |
| 37 | `whats-new.dom.test.js` | 7 | 새 버전 변경 이력 알림 | 최초 실행/업데이트/재부팅 분기, 복귀 사용자 판별, 확인→last_seen 기록, 설정 재열람 | 2026-09-26 추가 |
| 38 | `feedback.dom.test.js` | 10 | 의견 보내기 모달 | 렌더링, 유형/별점 선택, 성공 제출, 오프라인 큐+플러시, 검증 거부, 허니팝, XSS 이스케이프, 신기능 힌트(점+배지) 표시·소멸 | 2026-09-26 추가 |
| | **합계** | **358** | | |

---

## 4. 테스트 분류별 상세

### 4.1 보안 (Security)

#### `sanitize.test.js` (9개)
- `escapeHTML()`: 특수문자(`<`, `>`, `&`, `"`, `'`) 이스케이프
- `safeTextWithBreaks()`: `<br>` 태그는 줄바꿈으로, 나머지는 이스케이프
- `esc()`: 싱크용 이스케이프 (이중 이스케이프 방지)

#### `delegation-guard.test.js` (2개)
- **인라인 핸들러 잔존 검사**: `src/**/*.js`와 `index.html`에서 `on*="..."` 속성이 하나도 없어야 함
- **window 브리지 누락 검사**: `data-click`/`data-input`으로 참조되는 모든 핸들러가 `window`에 노출되어 있어야 함
- **목적**: CSP `script-src 'self'` 환경에서 인라인 이벤트 핸들러가 차단되는 버그 회귀 방지

### 4.2 데이터 무결성 (Data Integrity)

#### `sha256.test.js` (13개)
- `sha256hex()`: 순수 JS 구현 SHA-256이 Node `crypto.createHash('sha256')`와 동일한 결과
- `stableId()`: 카드/퀴즈 안정 ID 생성 (`subjectKey_card_hash6` 형식)
- 빈 문자열, 한글, 긴 문자열 등 다양한 입력 검증

#### `id-factory.test.js` (13개)
- 빌드 타임 `tools/build/id-factory.js`의 ID 생성 로직
- `stableId()`: 동일 입력 → 동일 ID, 다른 subjectKey → 다른 ID
- `shortHash()`: 해시 길이 일관성

#### `state.test.js` (16개)
- `loadProgress()` / `saveProgress()`: localStorage 직렬화/역직렬화
- `cleanOrphansForSubject()`: 존재하지 않는 카드 ID 제거 (고아 진행상황 정리)
- localStorage 모킹 (`getItem`/`setItem`/`removeItem`/`clear`)
- `Set` 직렬화 (`Array.from`) / 역직렬화 (`new Set`) 검증

### 4.3 파싱 (Parsing)

#### `textbook-parser.test.js` (20개)
- `parseMarkdownFile()`: MD 파일 → 카드/퀴즈/챕터 데이터
- `parseTextbookContent()`: 표(table)에서 카드 추출, 리스트에서 카드 추출
- `buildSubjectData()`: 과목 전체 데이터 구조 조립
- 자동 제외 규칙 (용어 3자 이하, 정의 10자 이하 등) 검증
- 퀴즈 자동 생성 (볼드 빈칸, 숫자+단위 빈칸, 용어 맞추기)

#### `utils.test.js` (7개)
- `getChosung()`: 한글 초성 추출 (유니코드 코드포인트 연산)
- 단일 글자, 다양한 글자, 빈 문자열 검증

#### `trainer-calc.test.js` (8개)
- `buildCalcQuestion()`: 계산 문제 생성 로직
- 반환 객체 필수 필드 (`type`, `question`, `answer`, `unit`, `solution`)
- 정답 계산 정확성, 단위 포함 여부

### 4.4 Mermaid 렌더링 (Mermaid Rendering)

#### `mermaid-parser.test.js` (11개)
- `parseMarkdown()`의 `allowMermaid: true` 옵션 동작
- ```mermaid 코드블록 → `<pre class="mermaid">` 태그 변환
- Mermaid 문법 요소 보존: 화살표(`→`), 따옴표, 괄호, `<br/>`, `subgraph`
- HTML 태그로 오인 변환 방지 (`<a>`, `<strong>`, `<em>` 생성 차단)

#### `mermaid-textcontent.test.js` (5개)
- Mermaid 블록의 브라우저 `textContent` 동작 시뮬레이션
- HTML 엔티티 디코딩 (`&lt;` → `<`, `&gt;` → `>`, `&quot;` → `"`)
- mindmap과 flowchart 각각의 `textContent` 검증
- 불필요한 HTML 속성 미포함 확인

#### `mermaid-reader-format.test.js` (4개)
- `formatSectionContentForReader()` 처리 후 Mermaid 블록 내용 보존
- `<br/>` 엔티티가 reader-format 처리를 거쳐도 손상되지 않음
- 페이지 참조(`L###`)와 용어집 링크가 Mermaid 블록 내부에 삽입되지 않음

#### `mermaid-pipeline.test.js` (4개)
- 전체 파이프라인: MD 원문 → `parseMarkdown()` → HTML 출력
- Mermaid 블록 내에 실제 HTML 태그가 없어야 함 (엔티티만)
- 볼드(`**`), 이탤릭(`*`), 링크(`[text](url)`)가 Mermaid 블록 내에 적용되지 않음
- Mermaid + 일반 텍스트 + 표 혼합 콘텐츠 처리

#### `mermaid-rendering.test.js` (23개) — 2026-09-02 추가
- **다이어그램 타입 감지**: `textContent`가 `mindmap`으로 시작하면 mindmap, 그 외는 flowchart
- **mindmap 들여쓰기 검증**: 각 레벨이 최소 1 space 증가해야 함 (동일 들여쓰기 → "There can be only one root" 에러)
- **파서 출력 타입 감지**: `parseMarkdown()` 출력 HTML에서 Mermaid 블록 추출 후 타입 판별
- **파이프라인 통합**: MD → 파싱 → 포맷팅 → 타입 감지 전체 흐름 검증
- **실제 교재 파일 검증**: `content/exams/cosmetic/교재/*.md` 파일의 모든 Mermaid 블록에 대해 들여쓰기 및 문법 유효성 확인
- **CSS 클래스 분리 로직**: mindmap → `mermaid-mindmap`, flowchart → `mermaid-flowchart` 클래스 할당
- **`<br/>` 태그 보존**: mindmap과 flowchart 모두에서 `<br/>`이 엔티티로 보존됨

### 4.5 학습 보조 (Study Aids) — 교재 무관, 합성 데이터

#### `study-aids.test.js` (25개)
- `extractExamHighlights()`: 🔖기출/📌중요 마커 라인 추출, 마커/볼드 제거, 표 행 제외, 120자 자름
- `extractNumberDrills()`: 숫자+단위 정규식 매칭, 중복 제거(`Set`), 빈칸(`▓▓`) 치환, `isKey` 플래그
- `detectProcedureFlow()`: 절차 키워드 감지, 번호/원문자 리스트 추출, 기한 추출, 단계 2개 미만 → null
- `detectAdminPenalty()`: 행정처분 표 감지, 헤더/데이터 행 추출, 행 2개 미만 → null
- `isKeySection()`: 🔖기출, 📌중요, 🎯 기출 마커 감지 (본문 + 제목)

### 4.6 참조자료 레지스트리 (PDF Registry) — 교재 무관, 합성 데이터

#### `pdf-registry.test.js` (21개)
- `resolveRefPath()`: `content/` passthrough, 빈 입력, 등록/미등록 파일 → MD 경로 변환
- `mapSourceToRef()`: `SOURCE_REF_MAP` 순차 매칭, `exclude` 정규식 동작, 매칭 없음
- `resolveKeywordRef()`: `KEYWORD_REF_MAP` 패턴 매칭, `match`/`path`/`search` 반환
- 데이터 구조 검증: `SUBJECT_DIR_MAP`, `REFERENCE_FILES`, `REFERENCE_COMMON`, `REFERENCE_LAW`, `SOURCE_REF_MAP`, `KEYWORD_REF_MAP`
- `REF_FILE_TO_PATH` / `REF_REGISTRY`: 우선순위(과목N > 공통 > 법령고시) 검증

### 4.7 용어집 쿼리 (Glossary Query) — 교재 무관, 합성 데이터

#### `glossary-query.test.js` (13개)
- `getGlossaryByRefFile()`: prefix 매칭, `seenKeys` 중복 방지, 빈/미존재 파일명
- `getGlossaryByRefFiles()`: 다중 파일 수집, 중복 제거, null/빈 문자열 스킵
- `getGlossaryEntry()`: 존재/비존재, 반환 객체 불변성 (spread copy)
- `getAllGlossaryKeywords()`: 배열 반환, `{keyword, idxKey}` 구조, 일관성

### 4.8 일반 마크다운 파싱 (Markdown Parser General) — 교재 무관, 합성 데이터

#### `markdown-parser-general.test.js` (47개)
- **헤더**: `#`→`<h1>`, `##`→`<h2>`, `###`→`<h3>`, `useReaderStyles` 시 `<h3 class="md-h3">`/`<h4 class="md-h4">`
- **표**: 기본 테이블, 구분선 행 제외, 빈 셀 보존, `reader-table-wrapper` 클래스
- **리스트**: ul(`-`), ol(번호), `useCustomListDiv` 시 `md-list-item` div 렌더링
- **인라인 서식**: `**볼드**`→`<strong>`, `*이탤릭*`→`<em>`, `` `코드` ``→`<code>`, `[text](url)`→`<a>`, `allowItalics`/`allowInlineCode` 비활성화
- **코드블록**: 기본 `<pre>`, 언어 지정, 내부 볼드/이탤릭/링크 미적용
- **인용문**: `>`→`<blockquote>`, `useReaderStyles` 시 `md-quote`
- **특수 토큰**: `<br/>`, `<sup>`, `&nbsp;`, HTML 이스케이프(`<script>` 차단)
- **빈 입력**: 빈 문자열, 공백만
- **구분선**: `---`→`<hr>`, `useReaderStyles` 시 `reader-hr`
- **일반 문단**: `<p>`, `useReaderStyles` 시 `md-para`, `customSpacing` 시 빈 줄에 spacing div
- **joinWraps (ref_md 시각적 줄 병합)**: 문장 중간 절단 복원, `span data-md-line` 인용 정밀도 유지, 날짜 꼬리(`<개정`+`2018. 3. 13.>`)·화학식(`Freon 113)`) 오분류 교정, 러닝헤더 스킵(페이지 경계 병합 복원), 짧은 prev 줄 공백 결합 vs 문장부호 꼬리 무공백 구분

### 4.9 교재 리더 포맷팅 (Reader Format General) — 교재 무관, 합성 데이터

#### `reader-format-general.test.js` (19개)
- **페이지 참조 제거**: `본문 p.22`, `p.22~p.27`, 헤더 `p.NN — `, 괄호 `(p.80~83)`, `참고: 본문 p.22`
- **기출문제 링크**: `[text](../기출문제/과목N_...)` → `exam-link-btn` + `data-exam-md`
- **참조자료 링크**: `[file.pdf](../../참조자료/...)` → `source-link` + `data-ref-html`
- **출처 링크**: `출처: \`...md\`` → `data-ref-md`, `출처: \`xxx.pdf\`` → `data-ref-html`
- **Mermaid 블록 보호**: 페이지 참조 제거 시 Mermaid 내용 보존, 용어집 링크 미침투
- **용어집 자동 링크**: `<p>` 내 키워드 링크, 기존 `<a>` 내 중복 방지, 2자 미만 제외, 긴 키워드 우선
- **출처 Deep Linking**: `제N조` 추출 → `data-ref-search` 추가
- **빈/최소 입력**: 빈 문자열, 일반 텍스트, 파라미터 없이 호출

### 4.10 DOM (Vitest + jsdom)

#### `backup.dom.test.js` (10개)
- `getBackupKeys()`: 정적 키 + 동적 키(과목별 카드 ID) 수집
- `exportData()`: 백업 JSON 생성, `ALLOWED_KEYS` 화이트리스트 필터링
- `triggerImport()`: 파일 입력 트리거
- `importData()`: JSON 복원, 화이트리스트 검증, localStorage 복원
- `beforeEach`로 `localStorage.clear()` + `document.body.innerHTML = ''` 초기화

#### `router.dom.test.js` (11개) — 2026-09-03 추가
- `getViewTitles()`: 뷰 ID → 타이틀/서브타이틀 맵 생성, `null` 입력 시 기본값
- `navigateToView()`: 
  - active 클래스 토글 (이전 뷰 비활성, 새 뷰 활성)
  - 헤더 타이틀/서브타이틀 갱신
  - 뷰 렌더러 호출 (등록된 렌더러만)
  - `textbook-reader-view`가 아닐 때 `stopReaderAudio` 호출
  - `textbook-reader-view`로 이동 시 `stopReaderAudio` 미호출
  - 포커스 모드 해제 (`body.focus-mode` 클래스 제거)
  - `data-view` 속성 기반 네비게이션

### 4.11 Formula OS — 배합 계산기

#### `formula-store.test.js` (31개)
- `src/formula-store.js`: 포뮬러 저장/조회/복제/삭제 CRUD
- 저장 한도 `FORMULA_LIMIT`(5개) 초과 시 오래된 항목 삭제
- 고객 정보 정제 — 이름 길이, 피부 유형/제형 화이트리스트(`CUSTOMER_OPTIONS`), 알레르기·임신수유·사용 중 제품 필드
- 원료 행 정제 — 이름/배합률/제조 단계(`PHASES`), 빈 행 제거, 단계별 정렬 순서
- 규정 검증 스냅샷(`checkResult`) 보존, 저장 시각 필드
- 안정성 실험 확인 정제 — 방법·결과 enum, `recordedAt` 형식 검증, serialize 왕복
- 전성분 표시(`fullIngredients`) — 안정성 '양호' 시 표시 순서 자동 생성(1% 초과 내림차순 → 1% 이하 → 색소 최하단), 미확인 시 미생성
- localStorage 모킹 (`getItem`/`setItem`/`removeItem`)

#### `formula-rules.test.js` (23개)
- `src/formula-rules.js`: 제형별 베이스 템플릿(세럼·크림 등) 추천 역할 규칙
- 고민·피부 유형별 원료 제안 매핑
- 안전 필터 — `banned` 상태 원료 제외, 고객 알레르기 원료 제외, 임신수유 `⚠` 플래그
- 맞춤 규칙 추가/삭제/초기화, 기본 규칙과 병합 시키기
- 맞춤 규칙 JSON 직렬화/역직렬화 (export/import 형식)
- 합성 데이터 (가짜 원료 레지스트리 주입), 실제 DB 무관

#### `formula-check.test.js` (20개)
- `src/formula-check.js`: 원료 이름 인덱스 구축 (표기 변형·별표 병기)
- 배합 검증 4상태 — 한도이내(`within`) / 한도초과(`over`) / 금지(`banned`) / 확인필요(`unknown`)
- 고시 한도(`maxPercent`)와 실제 배합률 비교, 경계값(같음 = 이내)
- 고시 출처(`고시/별표 번호`) 문자열 추적
- 합계 100% 판정 보조 계산

### 4.12 복수정답형 파이프라인

#### `combo-transform.test.js` (7개)
- `src/questions.js`: 단일정답 문항 → 복수정답형(ⓐⓑⓒ 선택) 변환 (`generateComboOptions`)
- 진술 추출, 정답 조합 매칭, 변형 문항 ID 생성

#### `statement-tracker.test.js` (9개)
- `src/statement-tracker.js`: 진술별 정답률 추적·통계 집계

### 4.10b DOM — Formula OS UI 시나리오 (2026-09-23, 설계: DOM_TEST_DESIGN.md)

`tests/dom/helpers.js`가 실제 `index.html`의 `<body>`를 jsdom에 주입 — 컨트롤러
export 함수를 직접 호출하고 DOM 반영을 검증한다. `data-click` 위임 자체는
`delegation-guard`가 정적 검증하므로 중복 테스트하지 않는다. 학습 영역은
`seedStudyData`/`seedProgress`/`resetStudyState`/`storedJson` 픽스처로
`window.STUDY_DATA`·진도 localStorage를 시딩한다 — 과목 키는 `[a-z]+` 전용
(대시보드 집계 정규식 접두사 매칭). 플래시카드는 실제 `setupEventListeners`
바인딩을 경유해 클릭 경로까지 검증한다.

#### `formula-nav.dom.test.js` (6개)
- `initFormulaView`/`open*Panel`/`exitFormulaSubView` — 12개 패널의 `is-hidden` 전수 검증
- 서브내비 칩 개수·활성 칩 텍스트·칩의 `data-click` 핸들러명 존재

#### `formula-customer.dom.test.js` (9개)
- 빈 상태→`custNew`→폼 입력→`custSave`→상세 패널·목록 카드·사용 배지
- CSV: UTF-8 2행 가져오기(confirm 후 토스트 요약), EUC-KR 바이트 파일 디코딩,
  중복 건너뜀 집계, 헤더 불일치 오류, confirm 거부,보내기·양식 다운로드 트리거

#### `formula-material.dom.test.js` (5개)
- 등록→목록 반영, 기한 4상태 배지(expired/soon/ok/none)·경고 배너 표시·숨김
- CSV: `YYYY.M.D`/`YYYY/M/D` 날짜 정규화, 이름+LOT 중복 건너뜀

#### `formula-compliance.dom.test.js` (8개)
- 6섹션·27항목 렌더, `점검 N/27` 배지
- `compToggle` → `cosmetic:formula_compliance` 영속 + 재렌더 checked 유지,
  재토글 해제, 미등록 id 무동작
- `compReset` confirm 승인/거부 분기, `compOpenLaw` → `window.ExamViewer.openExam` 경로·미존재 시 안내 토스트

#### `study-quiz.dom.test.js` (14개)
- 출제→아레나·진행률·문제 렌더, 무퀴즈 과목 경고, 단답/객관식/OX 채점·피드백
- 완주→결과 화면 점수·오답 리뷰, 중도 재시작 초기화, 오답 `quizResults` 영속
- 복습: 약점 0건 안내, 약점 카드 재출제(약점 집중 퀴즈), 정답 시 약점 해제+영속, 과목 필터, 수동 제외

#### `study-flashcard.dom.test.js` (8개)
- 중요도순 정렬·용어/배지/인덱스 렌더, 클릭 뒤집기(aria), 다음/이전 순환
- 빈 과목 안내, 기출만/난이도 필터, 외움/헷갈림→localStorage 영속+배지, 재진입 복원

#### `study-dashboard.dom.test.js` (6개)
- 진도 0건 통계·안내, 시딩→암기율/정답률/복습 대기, 과목 카드·히트맵
- 약점 추천: 3문 이상 응시 과목 중 최저 정답률 + 헷갈림 카드 최다

### 4.12b Formula OS — 업무 레이어 (Phase A~D) + CSV

#### `batch-store.test.js` (14개)
- 배치번호 `YYYYMMDD-NN` 당일 채번, 처방·일시·스냅샷 identity 불변
- QC·위생 필드 단위 병합(통째 덮어쓰기 방지), `checkSnapshot` 보존, 50건 한도

#### `usage-guide.test.js` (7개)
- 제형 9종 템플릿 선택, 원료 주의 규칙 발화(레티노이드·AHA·BHA·비타민C·향료·알코올·BPO)
- 고객 임신/알레르기 조건 주의문 병기

#### `customer-store.test.js` (9개)
- 고객 CRUD·20명 한도, 상담 이력 `addConsultLog` append-only(수정·삭제 불가)
- 고객 삭제 시 `unlinkCustomerFromFormulas` — 인라인 스냅샷 보존 + 참조 해제

#### `material-ledger.test.js` (9개)
- 원료 CRUD·30종 한도, 기한 상태 파생(`expired`/`soon`/`ok`/`none`)
- `daysUntilExpiry` 자정 기준 D-day (기한 당일 D-0, 익일부터 경과)

#### `formula-compliance.test.js` (4개)
- 27항목 id 고유성, `refs` 구조 유효성, **법령 MD 파일 실존 검증**(ref_md 경로), 6개 필수 섹션 커버리지

#### `csv-import.test.js` (17개)
- `src/csv-utils.js`: 따옴표 필드(쉼표·개행·`""`), 구분자 `,`/`;`/탭 감지, UTF-8 BOM·EUC-KR 폴백, 헤더 정규화 매핑, `toCsv` BOM+이스케이프
- `importCustomers`/`importMaterials`: 중복 건너뜀(고객=이름, 원료=이름+LOT), 이름 없음 제외, 한도 초과 집계, sanitize 경유, CSV 왕복

### 4.13 기타 신규 분류

#### `questions.test.js` (17개)
- `src/questions.js`: 과목/유형 필터, 출제 순서·개수 로직

#### `data-loader.test.js` (7개)
- `src/data-loader.js`: 번들 fetch·캐시, `window` 글로벌 주입 검증

#### `exam-context.test.js` (12개)
- `src/exam-context.js`: 시험 해석, `scopedKey()` 네임스페이스, `hasFeature()` 기능 게이팅

#### `storage-key-sync.test.js` (2개)
- `src/storage-keys.js`에 선언된 키 ↔ `src/`에서 실제 사용하는 `localStorage` 키 일치
- 미등록 키 회귀 가드

---

## 5. 새 테스트 작성 가이드

### 5.1 Unit 테스트 (DOM 불필요)

```javascript
// tests/unit/<모듈명>.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { myFunction } from '../../src/my-module.js';

test('myFunction: 기본 동작', () => {
    const result = myFunction('input');
    assert.equal(result, 'expected');
});

test('myFunction: 엣지 케이스', () => {
    assert.throws(() => myFunction(null), /Error message/);
});
```

**규칙**:
- `import` from `node:test` 및 `node:assert/strict`
- 테스트 대상 모듈은 `../../src/`에서 ESM import
- CommonJS 모듈은 `createRequire(import.meta.url)`로 로드 (`id-factory.test.js` 참조)
- DOM API(`document`, `localStorage` 등) 사용 불가 → DOM 테스트로 이동

### 5.2 DOM 테스트 (브라우저 환경 필요)

```javascript
// tests/dom/<모듈명>.dom.test.js
import { describe, it, beforeEach, expect } from 'vitest';
import { myDomFunction } from '../../src/my-module.js';

describe('my-module — DOM 테스트', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    it('DOM 조작 검증', () => {
        document.body.innerHTML = '<div id="target"></div>';
        myDomFunction();
        expect(document.querySelector('#target').textContent).toBe('expected');
    });
});
```

**규칙**:
- 파일명은 `*.dom.test.js` (Vitest 설정에서 `tests/dom/**/*.test.js` 매칭)
- `import` from `vitest` (`describe`, `it`, `expect`, `beforeEach` 등)
- `environment: 'jsdom'`으로 브라우저 DOM 시뮬레이션
- `localStorage`, `document`, `window` 등 브라우저 API 사용 가능

### 5.3 Mermaid 관련 테스트

Mermaid 렌더링 로직 테스트 시 공통 헬퍼 패턴:

```javascript
// MD에서 Mermaid 블록 추출
function extractMermaidBlocks(html) {
    const blocks = [];
    const regex = /<pre class="mermaid">(.*?)<\/pre>/gs;
    let match;
    while ((match = regex.exec(html)) !== null) {
        blocks.push(match[1]);
    }
    return blocks;
}

// HTML 엔티티 디코딩 (브라우저 textContent 시뮬레이션)
function decodeEntities(text) {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

// 다이어그램 타입 감지
function detectDiagramType(textContent) {
    const trimmed = textContent.trim().toLowerCase();
    if (trimmed.startsWith('mindmap')) return 'mindmap';
    return 'flowchart';
}
```

### 5.4 네이밍 규칙

| 패턴 | 위치 | 예시 |
|------|------|------|
| `<모듈명>.test.js` | `tests/unit/` | `sanitize.test.js`, `state.test.js` |
| `<모듈명>.dom.test.js` | `tests/dom/` | `backup.dom.test.js`, `router.dom.test.js` |
| `<기능명>-<층위>.test.js` | `tests/unit/` | `mermaid-parser.test.js`, `mermaid-rendering.test.js` |

---

## 6. 커버리지 현황

`npm run coverage:all` 기준 **병합 라인 79.7%** (`src/` 최상위 81.5%, `src/views` 77.2%).

- 병합 리포트(`coverage-merged/index.html`)가 실질 수치 — vitest 단독 리포트는 유닛 테스트가 커버하는 순수 로직을 0%로 표시하므로 과소평가된다.
- jsdom으로 검증 불가한 환경 의존 모듈은 `vitest.config.mjs` `coverage.exclude`로 분모에서 제외 (`types.js`, `app-fallback`, `pwa-install*`, `theme-init`, `web-vitals`, `reader-audio`).

### 측정 제외 파일 (수동 검증 영역)

| 파일 | 성격 | 사유 |
|------|------|------|
| `types.js` | JSDoc typedef 선언 | 런타임 코드 없음 — 측정 자체가 무의미 |
| `app-fallback.js` | ESM 로드 실패 복구 부트스트랩 | `window.onerror` 경계 — 모듈 로드 실패 재현 불가 |
| `pwa-install.js`, `pwa-install-capture.js`, `pwa-manifest.js` | 설치 프롬프트·매니페스트 | `beforeinstallprompt` 브라우저 이벤트 |
| `theme-init.js` | DOM 이전 즉시 실행 스크립트 | FOUC 방지 초기화 — 부트스트랩 영역 |
| `web-vitals.js` | 성능 모니터링 | `PerformanceObserver` |
| `reader-audio.js` | 오디오북 플레이어 | `Audio` API |

### 남은 저커버리지 영역

| 파일 | 라인 | 성격 | 개선 방향 |
|------|------|------|-----------|
| `app.js` | 0% | 메인 진입점 (1100+ 라인) — 모듈 로드 시 즉시 실행돼 DOM 테스트로는 임포트 불가 | 부분 함수를 별도 모듈로 분리해 테스트 가능하게 하거나, E2E 도구로 커버 |
| `charts.js` | 17% | SVG 차트 렌더링 | 렌더 출력 DOM을 스냅샷/구조 검증하는 방식으로 가능 |
| `event-listeners.js` | 68% | `data-click` 위임 바인딩 — 디스패치·키보드 접근성·핸들러 본문 커버 완료 | 잔여는 스와이프 제스처·일부 분기 |
| `textbook-reader.js` | 53% | 대형 뷰 컨트롤러 (1650 라인) — 툴바·본문 검색·TOC 드로어·표 모달 커버 완료 | 스크롤 스파이·참조 미리보기·오디오 연동 경로 |
| `exam-viewer.js` | ~54% | 문제집 뷰어 | 해설·인용 링크 경로 보강 |
| `exam-simulator.js` | 69% | 시뮬레이터 | 오답 모의고사(startWeakExam) 커버 완료 — 잔여는 결과 리뷰 세부 경로 |
| `data-loader.js` | ~73% | `_loadScript` 스크립트 로딩 경로 | jsdom의 script 로드 제약 — 스텁 분기 커버 가능 |
| `manual-viewer.js` | ~67% | 학습안내서 뷰어 | 섹션 네비게이션 경로 보강 |

> 수치는 `coverage-merged` 기준. 특정 파일의 미커버 라인은 리포트의
> `Uncovered Line #s` 컬럼 참조.

---

## 7. CI 연동

### GitHub Actions

```yaml
# .github/workflows/ci.yml (요약)
- name: Unit tests
  run: npm test

- name: DOM tests
  run: npm run test:dom
```

- `push` 시 자동 실행
- Unit 테스트 실패 시 CI 실패 → 머지 차단
- DOM 테스트는 별도 step으로 실행 (Vitest 설치 필요)

### 배포 전 체크리스트

```bash
# 1. 전체 테스트
npm run test:all

# 2. 파서 정합성 (빌드 파서 ↔ 런타임 파서)
npm run check:parser

# 3. 쉘 자산 검증 (프리캐시 파일 존재 확인)
npm run verify:assets
```

---

## 8. 트러블슈팅

### 8.1 Unit 테스트 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| `Cannot find module '../../src/...'` | ESM import 경로 오류 | `import.meta.url` 기준 상대 경로 확인 |
| `require is not defined` | CommonJS 모듈을 ESM에서 직접 import | `createRequire(import.meta.url)` 사용 |
| `localStorage is not defined` | Unit 테스트에 DOM API 없음 | 해당 테스트를 `tests/dom/`으로 이동 |

### 8.2 DOM 테스트 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| `ReferenceError: document is not defined` | jsdom 환경 미적용 | `vitest.config.mjs`의 `environment: 'jsdom'` 확인 |
| `localStorage.clear is not a function` | jsdom localStorage 미초기화 | `beforeEach`에서 `localStorage.clear()` 호출 |
| 타이머 관련 비결정적 실패 | `setTimeout`/`setInterval` 비동기 | `vi.useFakeTimers()` / `vi.useRealTimers()` 사용 |
| 전체 스위트에서만 간헐 실패, 단독 실행은 통과 | 테스트 간 상태 공유·타이밍 경합 (관측 사례: `study-trainer` 수치 훈련, `formula-calc`) | 단독 재실행으로 확인 — 반복되면 `beforeEach` 상태 초기화·fake timer 경계 점검 |

### 8.3 Mermaid 테스트 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| "There can be only one root" | mindmap 들여쓰기가 계층 구조를 반영하지 않음 | 각 레벨이 최소 1 space 증가하도록 수정 |
| Mermaid 블록 내 HTML 태그 발견 | `parseMarkdown()`이 Mermaid 문법을 HTML로 변환 | `allowMermaid: true` 옵션 확인, 코드블록 내 인라인 서식 비활성화 확인 |
| `<br/>`이 사라짐 | `escapeHTML()`이 `<br/>`를 이스케이프 | `safeTextWithBreaks()` 또는 토큰 치환 패턴 확인 |

---

## 📎 관련 파일

| 파일 | 경로 | 비고 |
|------|------|------|
| Unit 테스트 | `tests/unit/*.test.js` | Node.js `node:test` |
| DOM 테스트 | `tests/dom/*.test.js` | Vitest + jsdom |
| Vitest 설정 | `vitest.config.mjs` | `environment: 'jsdom'` |
| 테스트용 package.json | `tests/unit/package.json` | (있을 경우) |
| CI 워크플로우 | `.github/workflows/ci.yml` | GitHub Actions |
| 파서 정합성 검증 | `tools/check_parser_parity.js` | 빌드 파서 ↔ 런타임 파서 |
| 쉘 자산 검증 | `tools/verify_shell_assets.js` | 프리캐시 파일 존재 확인 |
