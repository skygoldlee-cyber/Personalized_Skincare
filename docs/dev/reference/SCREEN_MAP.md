# 화면 지도 (Screen Map)

> **목적**: 앱의 모든 화면을 `view id ↔ 마크업 파셜 ↔ URL 해시 ↔ 내비게이션 위치 ↔ SPEC §` 로 매핑한 단일 인벤토리. 화면 관련 작업 시 "이 화면은 어느 SPEC 섹션인가"를 탐색 없이 결정하기 위한 참조.
> **관련 문서**: [SPEC.md](../SPEC.md) (요구사항 원천 — 기기별 배치 계약은 §4.10) · [USER_FLOW.md](../design/USER_FLOW.md) (화면 간 전환 흐름) · [ARCHITECTURE.md](../ARCHITECTURE.md) (뷰 라우팅 구조)
> **최종 업데이트**: 2026-10-03
> **문서 ID**: DOC-REF-09
> **관련 SPEC ID**: `UX-NAV-01`(3단계 네비) · `UX-NAV-08`(해시 라우팅) · `UM-01~05`(학습↔실무 모드)

---

## 1. 뷰 인벤토리

모든 뷰는 `index.html`의 `.view-section` (파셜: `html/views/`) 이고 `navigateToView()`(`src/router.js`)가 `.active` 토글로 전환한다. 해시 슬러그는 `VIEW_HASH_SLUGS`가 소유 — **뷰 추가/이름 변경 시 이 표와 `VIEW_HASH_SLUGS`·SPEC §3.x를 함께 갱신**.

| 화면 | view id | 파셜 | 해시 | 네비 위치 (데스크톱 / 모바일) | SPEC § | 모드 |
|------|---------|------|------|------------------------------|--------|------|
| 학습 대시보드 | `dashboard-view` | dashboard.html | `#/dashboard` | 사이드바 / 탭바 1 | §3.1 | 학습 전용 |
| 맞춤학습 | `analysis-view` | analysis.html | `#/analysis` | 사이드바 / 더보기 시트 | §3.1.5 | 학습 전용 |
| 개념 플래시카드 | `flashcard-view` | flashcard.html | `#/cards` | 사이드바 / 탭바 2 | §3.2 | 학습 전용 |
| 기출 및 핵심 퀴즈 | `quiz-view` | quiz.html | `#/quiz` | 사이드바 / 탭바 3 | §3.3 | 학습 전용 |
| 스마트 훈련소 | `trainer-view` | trainer.html | `#/trainer` | 사이드바 / 더보기 시트 | §3.11 | 학습 전용 |
| 오답 및 중요 복습 | `review-view` | review.html | `#/review` | 사이드바 / 더보기 시트 | §3.20 (`RV-01`) | 학습 전용 |
| 실전 모의고사 | `exam-view` | exam.html | `#/exam` | 사이드바 / 더보기 시트 | §3.4·§3.14 | 학습 전용 |
| Formula OS | `formula-view` | formula.html | `#/formula` | 사이드바 / 탭바 (실무 랜딩) | §3.18 | 실무 (학습 모드에서도 노출) |
| 교재리더 | `textbook-reader-view` | textbook-reader.html | `#/reader` | 사이드바 / 더보기 시트 | §3.5~3.8 | 학습 전용 |
| 교재검색 | `textbook-view` | textbook.html | `#/textbook` | 사이드바 / 더보기 시트 | §3.9 | 학습 전용 |
| 사전 | `dictionary-view` | dictionary.html | `#/ingredients` | 사이드바 / 탭바 | §3.10 | 공통 (`data-feature="dictionary"`) |
| 학습 캘린더 | `calendar-view` | calendar.html | `#/calendar` | 사이드바 / 더보기 시트 | §3.20 | 학습 전용 |
| 시험 선택 | `exam-select-view` | exam-select.html | `#/exams` | nav 없음 — 설정 패널·더보기 시트 '시험 전환' (`data-feature="examSwitch"`, 등록 시험 ≥2개일 때만 표시) | §3.22 | 공통 |

- **모바일 탭바 순서**: 대시보드 · 플래시카드 · 퀴즈 · (실무 모드: Formula OS·매뉴얼) · 사전 · **더보기**(시트에 나머지 전부 + 시험 전환·사용자 매뉴얼)
- **`nav-study-only`**: 실무 모드(`ui_mode=practice`)에서 숨김. 현재 뷰가 학습 전용이면 실무 전환 시 `formula-view`로 자동 랜딩 (`src/ui-mode.js`)
- **`data-feature`**: 시험별 `features` 플래그(`content/exams.json`)로 기능 자체를 숨김 — 뷰가 없는 게 아니라 기능 게이팅

## 2. 비뷰 화면 (오버레이·드로어·모달)

`.view-section`이 아닌 별도 레이어 — 뷰 전환 없이 현재 화면 위에 표시된다.

| 화면 | 요소 | 진입 | 성격 | 관련 규칙 |
|------|------|------|------|-----------|
| 설정 패널 | 헤더 ⚙ 드롭다운 | 헤더 버튼 | 관리 기능 통합(백업·시험 전환·시작 안내 등) | UX-SET-01~05 |
| 더보기 시트 | `#mobile-more-sheet` (`role="dialog"`) | 모바일 탭바 '더보기' | 전체 메뉴 그리드(학습·훈련평가·자료도구·기타) + 시험 전환·매뉴얼 | UX-NAV-01, §4.10.1 |
| 통합 검색 팔레트 | `#cmdk-overlay` | Ctrl/Cmd+K, 헤더 🔍 | 뷰/교재/카드/퀴즈/성분/문제집 검색·실행 | UX-NAV-06 |
| 시작 안내 모달 | `#onboarding-overlay` | 최초 방문 1회 / 설정 재열람 | 3단계 안내 | UX-FB-05 |
| 계정/로그인 모달 | `#auth-modal` | 설정 패널 '계정/로그인' | 이메일+비밀번호 · 로그인 메일(매직링크+OTP) — 미설정 시 안내 문구 | §3.19 (AU-01~08) |
| 의견 보내기 모달 | `#feedback-overlay` | 설정 패널 '의견 보내기' | 유형 4종·별점·본문 — 오프라인 큐 | §3.23 (FB-01~07) |
| 새 소식/변경 이력 | `#whats-new-overlay` | 버전 갱신 감지 / 설정 재열람 | 릴리스 노트 모달 | `src/whats-new.js` |
| Pro 안내·플랜 비교 | `#pro-upgrade-overlay` | 무료 한도 도달·Pro 안내·설정 '플랜 안내' | 정보성 모달 공유 셸 (결제 경로 없음) | ROAD-P0/P1 |
| PWA 설치 안내 | `#pwa-install-modal` | 설치 프롬프트 캡처 / 설정 | 브라우저별 안내 4종 + 진단 | UX-PWA-04 |
| 일일 챌린지 | `#daily-challenge-modal` | 대시보드 데일리 카드 | 단계형 미니 퀴즈 모달 | §3.20 (SC-04) |
| 목표 설정 모달 | `#goal-settings-modal` | 캘린더 뷰 | 일일 목표·주간 학습 일수 | §3.20 (SC-02) |
| 내 사용 통계 | `#usage-stats-overlay` | 설정 패널 | 로컬 사용 카운터 표 (전송 없음) | `src/usage-stats.js` |
| 커스텀 확인 모달 | `#app-confirm-overlay` | `showConfirm`/`showAlert` | 네이티브 alert 대체 | UX-FB-02 |
| 전역 로딩 | `#global-loading-overlay` | `showGlobalLoading()` | 데이터 fetch 시 전체 오버레이 (동적 생성) | UX-FB-04 |
| 문제집/참조자료 뷰어 | `#exam-overlay` | 과목 카드·리더 기출 링크·대시보드 | MD 뷰어, 자체 뒤로가기 마커 | §3.14, TR-10 |
| 참조자료 HTML 뷰어 | `#html-ref-overlay` | 리더 참조 링크 | 수록 문서 HTML 표시 | §3.8 (RR-04) |
| 학습안내서/매뉴얼 뷰어 | `#manual-overlay` | 더보기 시트·문제집 화면 | MD 뷰어, 자체 뒤로가기 마커 | §3.15, UX-NAV-08 |
| 리더 TOC 드로어 | `#reader-toc` + 백드롭 | 모바일: 왼쪽 엣지 스와이프/목차 버튼 | ≤900px fixed 드로어, 데스크톱은 사이드바 | TR-22/23 |
| 표 전체화면 모달 | `#reader-table-modal` | 본문 표 확대 버튼 | 라이트박스 재사용 셸 | TR-20 |
| 이미지 라이트박스 | `#reader-img-zoom-modal` | `.reader-img` 탭 | 확대·드래그 | TR-20 |
| Mermaid 확대 모달 | `#mermaid-zoom-modal` | 본문 다이어그램 탭 | 확대·팬 | TR-07 |
| 오프라인 배너 | `#offline-banner` | `offline`/`online` 이벤트 자동 | 상단 고정 상태 배너 | §4.1~4.2 |
| 용량 경고 배너 | `#storage-warning-banner` | 저장 용량 임계 | 대시보드 배너 | R-09 |
| 식약처 고시 배너 | `#formula-notice-banner` | formula-view 진입 | 고시 확인·원문 링크 | §3.18 |
| SW 업데이트 토스트 | `#sw-update-toast` | Service Worker 새 버전 | 하단 토스트 + 새로고침 유도 | UX-PWA-03 |
| 앱 토스트 | `#app-toast` | `showToast()` | 하단 단기 알림 (error/success/info) | UX-FB-01 |
| ESM 로드 폴백 | `#app-fallback-overlay` | 모듈 로드 실패 감지 | 복구 안내 오버레이 | `src/app-fallback.js` |
| 종료 안내 화면 | `.app-exit-screen` | 앱 종료 시도 차단 시 | PWA 종료 폴백 | UX-PWA-01 |

## 3. 뷰별 상태 분기 (전역 규약 외 화면 고유 상태)

공통 상태 규약(loading/empty/error/disabled)은 SPEC §4.9.5 참조 — 아래는 화면 고유 분기만 기록한다.

| 화면 | 상태 분기 |
|------|-----------|
| 대시보드 | 학습 기록 없음(빈 지표) / 학습 중(진행률·연속일·오늘 복습 표시) / 용량 초과 배너(R-09) |
| 교재리더 | 과목 미선택(empty-state) / 챕터 로딩 / 표준형↔이야기형 / 크롬 자동숨김 / 오디오 패널 표시 |
| 퀴즈 | 설정(과목·유형·문항수) → 진행(문항·진행바) → 결과(점수·오답 등록) |
| 모의고사 | 유형 선택(실전/ㄱㄴㄷ·문항수) → 응시(OMR·타이머) → 채점(과락 판정) → 리뷰 |
| 플래시카드 | 과목·필터 선택 → 카드 앞/뒤 → 암기 완료 표시 |
| 사전 | 검색어 없음(전체/필터) → 검색 결과 → 결과 없음(empty) |
| 시험 선택 | 현재 시험 배지 / `comingSoon` 시험은 선택 불가(알림) / 다른 시험 선택 시 리로드 |
| Formula OS | 허브 6메뉴(①고객→②배합 계산기→③My 포뮬러→④원료 장부→⑤조제 기록+법규 준수 상시) + 서브내비 칩 상호 이동 (FO-15) — 각 패널 독립 CRUD 상태 |

## 4. 변경 시 갱신 규칙

- **뷰 추가/삭제**: `html/views/` 파셜 + `index.template.html` include + `VIEW_HASH_SLUGS` + nav 버튼 + SPEC §3.x 요구사항 + **이 표** — `check:docsync`가 문서 동반을 강제
- **해시 슬러그는 변경 금지**: 기존 딥링크·복원 데이터와 호환 — 변경 시 UX-NAV-08 마이그레이션 필요
- **기능 플래그 신설**: `data-feature` 속성 + `exams.json.features` 등록 (멀티시험 대칭)
