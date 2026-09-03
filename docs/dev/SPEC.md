# 📋 요구사양 명세서 (Software Requirements Specification)

> **프로젝트**: Cosmetic Pass Master — 맞춤형화장품 조제관리사 스마트 학습 플랫폼
> **버전**: 1.3 (2026-09-03 기준 — #48~#50 변경사항 반영: SW 업데이트 토스트, 참조자료 PDF 저장, ref_md 구버전 정리)
> **문서 성격**: 구현 완료된 기능을 역공학하여 체계적으로 정리한 요구사양 명세서

---

## 📑 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 요구사항](#2-시스템-요구사항)
3. [기능 요구사양](#3-기능-요구사양)
4. [비기능 요구사양](#4-비기능-요구사양)
5. [데이터 요구사양](#5-데이터-요구사양)
6. [제약사항](#6-제약사항)

---

## 1. 프로젝트 개요

### 1.1 목적

맞춤형화장품 조제관리사 자격시험 대비 개인 학습 도구. 서버/DB 없이 순수 프론트엔드로 구현된 PWA(Progressive Web App)이며, 오프라인 환경에서도 모든 학습 기능이 동작한다.

### 1.2 대상 사용자

- 스마트폰(주) 및 데스크톱(보조)으로 학습하는 수험생
- 지하철/스터디카페 등 무인터넷 환경에서 학습하는 사용자
- 계정 생성 없이 즉시 학습을 시작하고자 하는 사용자

### 1.3 핵심 설계 원칙

| 원칙 | 내용 |
|------|------|
| **Zero-Backend** | 서버, DB, 인증 없이 순수 정적 프론트엔드. Vercel 무료 호스팅 |
| **Vanilla First** | React/Vue 등 프레임워크 미사용. 순수 HTML/CSS/JS (ESM) |
| **Offline-Capable PWA** | Service Worker로 App Shell + 학습 데이터 캐시. 설치 가능 |
| **Mobile-First** | 모바일 하단 탭 바 ↔ 데스크톱 사이드바 적응형 네비게이션 |
| **Content-Agnostic** | `content/manifest.json`을 SSOT로 사용. 교재 전체 교체 시 소스 수정 불필요 |

---

## 2. 시스템 요구사항

### 2.1 런타임 환경

- **대상 브라우저**: Chrome, Safari, Edge, Samsung Internet (모바일/데스크톱)
- **PWA 설치**: Android Chrome, iOS Safari, 데스크톱 Chrome/Edge
- **오프라인 동작**: Service Worker 지원 브라우저에서 완전 오프라인 학습 가능
- **file:// 프로토콜**: 로컬 파일 직접 열기 시 폴백 번들 제공 (fetch 차단 우회)

### 2.2 호스팅

- **Vercel 정적 호스팅** (무료 티어)
- **외부 오디오 CDN**: MP3 오디오북 302MB (Vercel 용량 제한으로 외부 호스팅)

### 2.3 의존성

- **런타임 외부 라이브러리**: 없음 (차트, 다이어그램 모두 자체 구현 또는 온디맨드 로드)
- **온디맨드 라이브러리**: Mermaid.js (3.3MB, mermaid 블록이 있는 챕터를 열 때만 동적 로드)
- **폰트**: Noto Sans KR, Outfit (자체 호스팅, 오프라인 지원)
- **아이콘**: FontAwesome 6.4 (자체 호스팅)
- **개발 의존성**: Vitest + jsdom (테스트), Node.js (빌드 도구)

---

## 3. 기능 요구사양

### 3.1 대시보드 (Dashboard)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| D-01 | 전체 학습 통계를 한눈에 파악 가능 (외운 카드, 오답, 퀴즈 성적, 스트릭) | ✅ |
| D-02 | 과목별 학습 진행률 카드 표시 (registry 기반 동적 생성) | ✅ |
| D-03 | 과목별 카운트 O(1) 조회 (캐싱 기반 성능 최적화) | ✅ |
| D-04 | 과목 바로가기 버튼 (클릭 시 해당 과목 학습 시작) | ✅ |
| D-05 | 추천 링크/유튜브 채널 카드 (manifest.json `resources` 기반 동적 생성) | ✅ |
| D-06 | 시험 카드 (registry 기반 동적 생성, 하드코딩 없음) | ✅ |
| D-07 | 일일 챌린지 모달 (데일리 학습 카드) | ✅ |

### 3.2 플래시카드 (Flashcard)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| F-01 | 3D 플립 카드 애니메이션 (perspective, preserve-3d, backface-visibility) | ✅ |
| F-02 | GPU 가속 (`will-change: transform`) | ✅ |
| F-03 | 키보드 접근성 (`role="button"`, `tabindex="0"`, Enter/Space 플립, `aria-expanded`) | ✅ |
| F-04 | "외웠어요" / "헷갈려요" 카드 분류 (Set 기반 O(1) 조회) | ✅ |
| F-05 | 카드 셔플 (Fisher-Yates 공정 셔플) | ✅ |
| F-06 | 과목별 카드 필터링 | ✅ |

### 3.3 퀴즈 (Quiz)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| Q-01 | 빈칸 채우기 퀴즈 (교재 본문에서 자동 추출) | ✅ |
| Q-02 | 객관식 확인문제 (교재 단원 말미 4지선다) | ✅ |
| Q-03 | 즉각 피드백 (정답/오답 표시, `role="status"`, `aria-live`) | ✅ |
| Q-04 | 오답 노트 관리 (틀린 문제 자동 수집, 제외 기능) | ✅ |
| Q-05 | 문제 셔플 (Fisher-Yates) | ✅ |
| Q-06 | 일일 챌린지 (데일리 모달, 단계별 진행) | ✅ |
| Q-07 | 퀴즈 결과 통계 (정답률, 진행 상황) | ✅ |

### 3.4 모의고사 (Exam Simulator)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| E-01 | 실전 모의고사 시뮬레이션 (타이머, OMR 카드, 채점) | ✅ |
| E-02 | 과목별 모의고사 (registry 기반 동적 시험-과목 매핑) | ✅ |
| E-03 | 중단된 모의고사 이어하기 (세션 복원) | ✅ |
| E-04 | 오답 복습 모의고사 (틀린 문제 자동 수집 → `weak_sim_*` ID) | ✅ |
| E-05 | 오답 과목 재학습 기능 | ✅ |
| E-06 | 성적 기록 및 추세 분석 (꺾은선 그래프) | ✅ |
| E-07 | 합격/과락/미달 판정 표시 | ✅ |

### 3.5 교재 리더 (Textbook Reader)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| TR-01 | 마크다운 교재 본문을 HTML로 렌더링 (런타임 MD 파싱) | ✅ |
| TR-02 | 과목별 단원 목차 (사이드바/드롭다운) | ✅ |
| TR-03 | 단원 간 이동 (이전/다음 챕터) | ✅ |
| TR-04 | 스크롤 위치 기억/복원 (뷰 전환 시) | ✅ |
| TR-05 | 기출 마커(🔖기출) 및 중요 마커(📌중요) 하이라이트 | ✅ |
| TR-06 | Mermaid 다이어그램 렌더링 (mindmap + flowchart + sequence + gantt + pie + timeline + state + gitGraph + quadrant + class + er + sankey, 온디맨드 로드) | ✅ |
| TR-07 | 다이어그램 타입별 개별 렌더링 (`mermaid-utils.js` 타입 감지, 하나 실패해도 나머지 정상) | ✅ |
| TR-08 | 키워드 자동 링크 보호 (Mermaid 블록 내 용어집 링크 치환 방지) | ✅ |
| TR-09 | 마크다운 링크 파싱 (`[text](url)` → `<a>` 변환) | ✅ |
| TR-10 | 기출문제 링크 클릭 → 문제집 HTML 뷰어 오버레이 (ExamViewer 연동) | ✅ |

### 3.6 교재 리더 — 학습 보조 도구

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| SA-01 | 기출 필터 & 요약: 🔖기출 섹션 하이라이트 + 비기출 섹션 디밍 토글 | ✅ |
| SA-02 | 기출 핵심 요약 카드 표시 | ✅ |
| SA-03 | 숫자·기한 빈칸 카드: 정규식으로 숫자/기한/횟수 자동 추출 → 챕터별 암기표 | ✅ |

### 3.7 교재 리더 — 용어집 (Glossary)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| G-01 | 단원 말미 용어집 테이블 자동 생성 | ✅ |
| G-02 | 본문 중 용어집 키워드 자동 링크 (`glossary-term-link` 클래스) | ✅ |
| G-03 | (LNN) 참조 링크 → 용어집 해당 행으로 점프 (`glossary-link` 클래스) | ✅ |
| G-04 | 용어집 행 점프 시 임시 하이라이트 (노란색 배경, 2초 후 해제) | ✅ |
| G-05 | **원래 위치로 돌아가기**: 용어집 점프 후 플로팅 "← 원래 위치로" 버튼 표시 | ✅ |
| G-06 | 스크롤 컨테이너 동적 감지 (`.textbook-reader-content` / `.main-content`) | ✅ |
| G-07 | `scrollToGlossary()` 공유 함수 — 본문 링크, 개념 맵 노드 링크 모두 통합 | ✅ |
| G-08 | 과목별 큐레이션 용어 정의 (JSON 파일에서 빌드 시 병합, `curated: true`) | ✅ |
| G-09 | 용어집 테이블 `table-layout: fixed`로 과목별 컬럼 폭 일관성 | ✅ |

### 3.8 교재 리더 — 참조자료 연결

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| RR-01 | 참조자료 HTML/MD 뷰어 오버레이 (fetch + DOMParser/parseMarkdown, iframe 없음) | ✅ |
| RR-02 | 키워드 기반 스크롤: `KEYWORD_INDEX`에서 추출한 키워드로 검색 → 첫 하이라이트로 스크롤 | ✅ |
| RR-03 | Deep Linking: `data-ref-anchor` (제N조 앵커) → 요소 ID → 헤딩 텍스트 → 검색 fallback | ✅ |
| RR-04 | 본문 키워드 자동 하이퍼링크: `KEYWORD_REF_MAP` (28개 패턴) → `data-ref-html` 링크 | ✅ |
| RR-05 | 인라인 프리뷰 툴팁: 데스크톱 hover 400ms / 모바일 롱프레스 600ms (200자 스니펫) | ✅ |
| RR-06 | L### 참조 확장: 라인 번호 기반 스크롤 (앵커 → 라인 → 검색 fallback) | ✅ |
| RR-07 | 컨텍스트 사이드바: 현재 단원의 출처와 매칭되는 참조자료 상단 추천 표시 | ✅ |
| RR-08 | 검색 내비게이션: 이전/다음 버튼, `Enter`/`Shift+Enter` 단축키, `1/N` 카운트 | ✅ |
| RR-09 | sessionStorage 캐싱 (24h TTL) — 재방문 시 fetch 0회 | ✅ |
| RR-10 | 검색 조기 종료: 첫 매치 즉시 스크롤, 나머지 `requestIdleCallback` 지연 하이라이트 | ✅ |
| RR-11 | 전체 참조자료 PDF → MD 변환 (ref_md/ 36종 3.7MB, 원본 PDF 27.2MB는 배포 제외) | ✅ |
| RR-12 | 참조자료 PDF 링크 → HTML 뷰어 변환 (`data-ref-html`) | ✅ |
| RR-13 | `pdf-registry.js` 중앙 설정 모듈 (과목 변경 시 1개 파일만 수정) | ✅ |
| RR-14 | 인쇄 기능 (인쇄 전용 CSS 주입, 오버레이 제약 없이 전체 문서 출력) | ✅ |
| RR-15 | 스크롤바 가시성 (뷰어 전용 스크롤바 스타일, 흰 배경에서 가시) | ✅ |
| RR-16 | PDF 저장 버튼 (브라우저 인쇄 다이얼로그 → "PDF로 저장", 인쇄 전용 CSS로 전체 문서) | ✅ |

### 3.9 교재 검색 (Textbook Search)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| TS-01 | 교재 본문 전문 검색 (모든 과목/단원) | ✅ |
| TS-02 | 검색 인덱스 사전 구축 (`toLowerCase()` 캐싱, 검색마다 재계산 방지) | ✅ |
| TS-03 | 250ms 디바운스 (모바일 타이핑 랙 감소) | ✅ |
| TS-04 | 검색 결과 카드 토글 (더 보기/접기) | ✅ |
| TS-05 | 검색 결과 카운트 (`aria-live="polite"`) | ✅ |
| TS-06 | 검색 결과 마크다운 렌더링 (`parseMarkdown` 기반, 코드블록/테이블/머메이드 지원) | ✅ |
| TS-07 | 검색 결과 Mermaid 다이어그램 온디맨드 렌더링 (`_renderSearchMermaid`) | ✅ |

### 3.10 성분 사전 (Dictionary)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| DI-01 | 화장품 성분 검색 (가용/금지/제한 분류) | ✅ |
| DI-02 | 250ms 디바운스 검색 | ✅ |
| DI-03 | 초성 검색 지원 (`getChosung()`) | ✅ |

### 3.11 훈련소 (Trainer)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| T-01 | 계산 훈련 문제 생성기 (DOM 의존 없는 순수 로직, `trainer-calc.js`) | ✅ |
| T-02 | 원료 챌린지 (Fisher-Yates 셔플) | ✅ |
| T-03 | 뽀모도로 타이머 | ✅ |
| T-04 | 손글씨 연습장 (HTML5 Canvas, `scratchpad.js`) | ✅ |
| T-05 | 계산 한도/농도 슬라이더 (`data-input` 이벤트 위임) | ✅ |

### 3.12 오디오북 (Audiobook)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| A-01 | 단원별 MP3 오디오 재생 (외부 CDN, SW 캐시 제외) | ✅ |
| A-02 | Media Session API 연동 (잠금화면/알림바 미디어 제어) | ✅ |
| A-03 | play/pause/seekto/previoustrack/nexttrack 액션 핸들러 | ✅ |
| A-04 | `navigator.mediaSession.metadata`: 단원 제목, 과목명, 앨범 아트 | ✅ |
| A-05 | 오디오 컨트롤 UI (재생/일시정지, 진행바, 속도 조절) | ✅ |

### 3.13 데이터 백업/복원 (Backup)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| B-01 | 학습 진행 상황 JSON 내보내기 (허용 키만 추출) | ✅ |
| B-02 | JSON 가져오기 (`ALLOWED_KEYS` 화이트리스트 검증) | ✅ |
| B-03 | 악성 키 주입 방지 (보안 설계) | ✅ |
| B-04 | CSP-safe 이벤트 바인딩 (`addEventListener`, 인라인 `onchange` 없음) | ✅ |

### 3.14 문제집 뷰어 (Exam Viewer)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| EV-01 | 문제은행 MD 런타임 뷰어 (fetch → MD→HTML 변환 → 전체화면 오버레이) | ✅ |
| EV-02 | 목차(TOC) 자동 생성 | ✅ |
| EV-03 | 인쇄/PDF 버튼 | ✅ |
| EV-04 | `Esc` / 모바일 뒤로가기(`history.pushState`) 닫기 | ✅ |
| EV-05 | sessionStorage 캐시 (24h TTL) | ✅ |
| EV-06 | `file://` 폴백 번들 (`data/exams_md/*.js`, 클래식 `<script>` 주입) | ✅ |
| EV-07 | 시험 제목 registry 동적 조회 (하드코딩 없음) | ✅ |
| EV-08 | 교재 본문 기출문제 링크 → 문제집 뷰어 연동 | ✅ |

### 3.15 학습안내서/사용자매뉴얼 뷰어 (Manual Viewer)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| MV-01 | 마크다운 문서 런타임 뷰어 (`docs/*.md` 직접 fetch + 렌더링) | ✅ |
| MV-02 | Mermaid 다이어그램 렌더링 (온디맨드, 테마별 dark/default) | ✅ |
| MV-03 | `popstate` 타이밍 가드 (open 후 300ms 이내 이벤트 무시) | ✅ |
| MV-04 | `file://` 폴백 번들 (`data/docs_md/*.js`) | ✅ |

### 3.16 차트 및 시각화 (Charts)

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| C-01 | SVG 레이더 차트 (N축 삼각함수 기반, 과목 수에 비례 자동 계산) | ✅ |
| C-02 | SVG 꺾은선 차트 (성적 추세) | ✅ |
| C-03 | 인터랙티브 툴팁 (hover/touch, 날짜/점수/증감/합격상태 표시) | ✅ |
| C-04 | 모바일 터치 지원 (2초 후 자동 숨김, 화면 경계 자동 보정) | ✅ |
| C-05 | 외부 차트 라이브러리 미사용 (직접 SVG 생성) | ✅ |

---

## 4. 비기능 요구사양

### 4.1 PWA & 오프라인

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| P-01 | Service Worker 기반 오프라인 캐싱 (7단계 분기 전략) | ✅ |
| P-02 | App Shell + 데이터 번들 프리캐시 (`precacheResilient`, `allSettled`) | ✅ |
| P-03 | 캐시 스큐 방지 (navigation Cache First, 동일 세대 일관 서빙) | ✅ |
| P-04 | `skipWaiting()` + `controllerchange` 자동 리로드 | ✅ |
| P-04a | SW 업데이트 토스트 팝업 (3단계: 다운로드→설치→완료, `pwa-install-capture.js`) | ✅ |
| P-05 | `CACHE_VERSION` 관리 (배포마다 버전업, 구 캐시 자동 정리) | ✅ |
| P-06 | 구 해시 번들 선별 삭제 (`pruneStaleDataBundles`) | ✅ |
| P-07 | PWA 설치 프롬프트 (`beforeinstallprompt` 조기 캡처, `<head>` 클래식 스크립트) | ✅ |
| P-08 | 설치 진단 패널 (SW 상태, display-mode, manifest 검증) | ✅ |
| P-09 | 인앱 브라우저(WebView) 감지 + "Chrome으로 열기" 안내 | ✅ |
| P-10 | `manifest.webmanifest` Content-Type 명시 (`application/manifest+json`) | ✅ |
| P-11 | 자가 복구 메커니즘 (`app-fallback.js`, 단계적 복구: SW update → 하드 리셋 → 수동 복구) | ✅ |
| P-12 | CI 검증 (`verify-shell-assets.js`, 배포 전 프리캐시 파일 존재 확인) | ✅ |

### 4.2 오프라인 감지

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| O-01 | 억제 우선(suppress-first) 원칙 — 오프라인일 때만 배너 표시 | ✅ |
| O-02 | 1차 게이트: `navigator.onLine === true` 신뢰 (억제 방향) | ✅ |
| O-03 | 2차 게이트: same-origin `ping.txt` 프로브 (오프라인 재확인) | ✅ |
| O-04 | SW 프로브 프록시 (`event.respondWith(fetch(request))`, standalone 호환) | ✅ |
| O-05 | 3중 오탐 방지: standalone 감지 + 연속 실패 임계(3/4회) + 타임아웃(8s) + 슬립 유예(15s) | ✅ |
| O-06 | 적응 주기: 온라인 30s / 오프라인 복구 감시 5s | ✅ |
| O-07 | `online` 이벤트 시 즉시 배너 해제 | ✅ |

### 4.3 보안

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| S-01 | CSP `script-src 'self'` (인라인 스크립트/핸들러 전면 차단) | ✅ |
| S-02 | 이벤트 위임 패턴 (`data-click`/`data-arg`/`data-args`/`data-input`) | ✅ |
| S-03 | `resolveDelegatedHandler()` 점 표기 네임스페이스 함수 참조 | ✅ |
| S-04 | 회귀 가드 테스트 (`delegation-guard.test.js`, 인라인 `on*=` 잔존 검출) | ✅ |
| S-05 | XSS 방어 (`sanitize.js`, 텍스트 정제 + 이스케이프) | ✅ |
| S-06 | 백업 복원 화이트리스트 (`ALLOWED_KEYS`) | ✅ |
| S-07 | 보안 헤더: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` | ✅ |
| S-08 | `window` 브리지 노출 (ESM 모듈 스코프 격리 해결, 모든 위임 핸들러) | ✅ |

### 4.4 성능

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| PF-01 | 런타임 MD 파싱 (교재/카드/퀴즈, 재빌드 불필요) | ✅ |
| PF-02 | 온디맨드 과목 로딩 (필요한 과목만 로드) | ✅ |
| PF-03 | `file://` 폴백 번들 과목별 분할 (513KB → 112KB, 78% 감소) | ✅ |
| PF-04 | 참조자료 sessionStorage 캐싱 (24h TTL, 재방문 시 fetch 0회) | ✅ |
| PF-05 | 검색 조기 종료 + `requestIdleCallback` 지연 하이라이트 | ✅ |
| PF-06 | span 일괄 제거 최적화 (normalize 호출 최소화) | ✅ |
| PF-07 | 대시보드 통계 O(1) 조회 (과목별 카운트 맵 캐싱) | ✅ |
| PF-08 | 교재 검색 인덱스 사전 구축 (검색마다 재계산 방지) | ✅ |
| PF-09 | 디바운스 (250ms, 성분/교재 검색) | ✅ |
| PF-10 | `console.log` → `console.debug` (프로덕션 콘솔 노이즈 제거) | ✅ |
| PF-11 | ref_md 대용량 파일 MD 변환 (배포 용량 41% 절감) | ✅ |
| PF-12 | `KEYWORD_INDEX` 경로 단축 (51KB → 14KB, 72% 절감) | ✅ |
| PF-13 | Mermaid.js 온디맨드 로드 (3.3MB, mermaid 블록 있을 때만) | ✅ |
| PF-14 | 전역 테이블 가로 스크롤 (CSS 전역 규칙으로 중복 스타일 제거, 렌더링 일관성) | ✅ |
| PF-15 | 화장품법 PDF 중복 제거 (공통/ 22페이지 → 법령원문/ 30페이지 정본 통합) | ✅ |
| PF-16 | Mermaid 다이어그램 타입별 초기화 공용화 (`mermaid-utils.js`, 3개 모듈 중복 제거) | ✅ |

### 4.5 접근성

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| A-01 | ARIA 속성 (`role="dialog"`, `aria-modal`, `aria-label`, `aria-live`) | ✅ |
| A-02 | 플래시카드 키보드 지원 (`role="button"`, `tabindex="0"`, Enter/Space) | ✅ |
| A-03 | 라이트 모드 WCAG AA 대비 (배지 색상 4.5:1 이상) | ✅ |
| A-04 | 터치 타겟 최소 44×44px | ✅ |

### 4.6 반응형 & 모바일

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| R-01 | 적응형 네비게이션 (데스크톱 사이드바 ↔ 모바일 하단 탭 바) | ✅ |
| R-02 | 동적 뷰포트 (`100dvh`, 주소창 표시/숨김 레이아웃 점프 방지) | ✅ |
| R-03 | Safe Area 대응 (`env(safe-area-inset-bottom)`) | ✅ |
| R-04 | 스크롤 위치 복원 (뷰 전환 시) | ✅ |
| R-05 | 그리드 종열 전환 (데스크톱 다열 → 모바일 단일 열) | ✅ |
| R-06 | 인라인 스타일 오버라이드 패턴 (`[style*="..."]` + `!important`) | ✅ |
| R-07 | 전역 테이블 가로 스크롤 (`width:max-content;min-width:100%` + wrapper `overflow-x:auto`) | ✅ |

### 4.7 테마 시스템

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| TH-01 | CSS 변수 기반 듀얼 테마 (다크 기본, 라이트 토글) | ✅ |
| TH-02 | FOUC 방지 (`<head>` 인라인 테마 적용, 페인트 전) | ✅ |
| TH-03 | 테마 결정 우선순위: `localStorage` > `prefers-color-scheme` > 다크 | ✅ |
| TH-04 | `themechange` 커스텀 이벤트 브로드캐스트 (모듈 간 동기화) | ✅ |
| TH-05 | 교재 리더 테마 동기화 (`.reader-light-theme` 클래스) | ✅ |
| TH-06 | Mermaid 다이어그램 테마별 렌더링 (dark/default, 타입별 CSS 클래스 분리: `mermaid-mindmap`/`mermaid-flowchart`/`mermaid-other`) | ✅ |

---

## 5. 데이터 요구사양

### 5.1 데이터 아키텍처

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| DA-01 | `content/manifest.json`을 SSOT로 사용 (과목, 단원, 시험, 추천 링크) | ✅ |
| DA-02 | 시험/성분 데이터: 빌드 타임 해시드 JS 번들 (`<script>` 로드) | ✅ |
| DA-03 | 교재/카드/퀴즈: 런타임 MD fetch + 파싱 (재빌드 불필요) | ✅ |
| DA-04 | `file://` 폴백: 과목별 분할 JS 번들 (`data/study_md/`) | ✅ |
| DA-05 | 사용자 진행 상황: `localStorage` 영속화 (계정/로그인 불필요) | ✅ |

### 5.2 안정적 ID 체계

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| ID-01 | 카드 ID: `sha256(subjectKey\|chapterKey\|term)` 앞 6자리 (정의 본문 제외, 오탈자 수정 시 ID 불변) | ✅ |
| ID-02 | 퀴즈 ID: `sha256(term\|answer)`, 중복 시 순번(`#n`) 결합 | ✅ |
| ID-03 | 고아 진행상황 정리 (삭제된 카드 ID 자동 감지/제거) | ✅ |
| ID-04 | 레거시 ID 마이그레이션 (`id_migration.js`, 1회성) | ✅ |

### 5.3 빌드 파이프라인

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| BP-01 | `tools/build/index.js`: registry, exam bundles, ingredients 생성 | ✅ |
| BP-02 | 스키마 검증 (카드/단원 수, 고유 ID 중복, 20% 급감 경고) | ✅ |
| BP-03 | 매니페스트 자체 검증 (`chapters[].file` 존재, `exams[].subject` 정합성) | ✅ |
| BP-04 | 파싱 마커 감시 (`🔖기출` 마커 + 정답 빈칸 누락 경고) | ✅ |
| BP-05 | 빌드 파서 ↔ 런타임 파서 등가성 검증 (`check_parser_parity.js`) | ✅ |
| BP-06 | `GLOSSARY_INDEX` 자동 생성 + 큐레이션 JSON 병합 (`build_keyword_index.js`) | ✅ |
| BP-07 | SW 캐시 버전 자동 스탬프 (`stamp-sw-version.js`) | ✅ |

### 5.4 콘텐츠 구조

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| CS-01 | 교재: `content/교재/{과목키}/*.md` (본문 + 이야기형) | ✅ |
| CS-02 | 문제은행: `content/문제은행/과목N_문제은행_교재인용.md` | ✅ |
| CS-03 | 참조자료: `content/참조자료/ref_md/` (MD 변환본 36종 3.7MB, 원본 PDF는 배포 제외) | ✅ |
| CS-04 | 성분 원본: `content/참조자료/원료/` | ✅ |
| CS-05 | 학습안내서: `content/학습안내서.md` | ✅ |
| CS-06 | 용어집 큐레이션: `content/교재/glossary/subject{1-4}.json` | ✅ |
| CS-07 | 오디오북: `content/audiobook/` (Python TTS 파이프라인) | ✅ |
| CS-08 | 파일명 ASCII 슬러그화 (CP949↔UTF-8 불일치 원천 제거) | ✅ |

### 5.5 교재 콘텐츠 학습 보조 요소

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| CE-01 | 학습 가이드: 단원 시작에 출제 빈도(★), 예상 소요 시간, 핵심 키워드 | ✅ |
| CE-02 | 한 줄 요약: 각 섹션(`##`) 하단 blockquote | ✅ |
| CE-03 | 비교표: 주요 개념/수치/기준 비교 | ✅ |
| CE-04 | 확인문제: 객관식 4지선다 + 상세 해설 (단원 말미) | ✅ |
| CE-05 | 용어 사전: 단원별 핵심 용어 정리표 (단원 말미) | ✅ |

### 5.6 이야기형 교재 서사 구조

| ID | 요구사양 | 구현 상태 |
|----|---------|-----------|
| ST-01 | 프롤로그: 주인공 실수 경험 설정 (시험 함정 회피 서사) | ✅ |
| ST-02 | 읽는 방법 4단계 가이드 (상황 이해 → 시험 포인트 → 기억 태그 → 법령 원문 → 에필로그) | ✅ |
| ST-03 | 여정도: 학습 안내/목표/흐름 통합 시각화 | ✅ |
| ST-04 | 실수→교훈 패턴 (🔖 기억 태그, 대화 형식) | ✅ |
| ST-05 | 에필로그 + 다음 장 예고 (각 장 말미) | ✅ |
| ST-06 | "이야기에서 자료로" 전환 블록 (별표/별지 서식 앞) | ✅ |
| ST-07 | 통합 에필로그 (4과목 주인공 조제대에서 만남) | ✅ |

---

## 6. 제약사항

### 6.1 용량 제약

| 항목 | 제약 | 해결 방안 |
|------|------|-----------|
| Vercel 파일 크기 | 100MB/파일 | 문제집 정적 HTML(220MB) → 런타임 MD 뷰어로 대체 |
| Vercel 배포 용량 | ~100MB | ref_md MD 변환(41% 절감), 폴백 번들 `.vercelignore` |
| 오디오북 | 302MB | 외부 CDN 호스팅 (SW 캐시 제외) |
| `localStorage` | ~5MB | 용량 초과 시 사용자 경고 배너 |

### 6.2 환경적 제약

| 항목 | 제약 | 해결 방안 |
|------|------|-----------|
| 인앱 브라우저 (WebView) | `beforeinstallprompt` 미발생 | "Chrome으로 열기" 안내 모달 |
| iOS Safari PWA | `respondWith` 없는 fetch 차단 | SW 프로브 프록시 전환 |
| `file://` 프로토콜 | fetch 차단 | 클래식 `<script>` 주입 폴백 번들 |
| CSP `script-src 'self'` | 인라인 스크립트/핸들러 차단 | 이벤트 위임 패턴 |
| 모바일 주소창 | 뷰포트 점프 | `100dvh` 동적 뷰포트 |

### 6.3 콘텐츠 변경 시 수정 파일

| 변경 유형 | 수정 필요 파일 |
|-----------|---------------|
| 교재 MD 내용 수정 (기존 파일) | (수정 불필요) |
| 교재 MD 파일 추가/삭제/이름 변경 | `content/manifest.json`, `sw.js`, `content/utils/batch_convert.py` |
| 참조자료 변경 | `src/pdf-registry.js` (유일 수정 파일) |
| 새 과목 추가 | `content/manifest.json`, `src/pdf-registry.js`, `sw.js`, `content/utils/batch_convert.py` |
| 과목명 표시 | `manifest.json` `shortName` 필드 (소스 수정 불필요) |
| 시험 추가/변경 | `content/manifest.json` `exams` 섹션 (소스 수정 불필요) |
| 추천 링크 변경 | `content/manifest.json` `resources` 섹션 (소스 수정 불필요) |

---

## 부록: 모듈 구성

### 핵심 모듈

| 모듈 | 파일 | 책임 |
|------|------|------|
| 오케스트레이터 | `src/app.js` | 초기화, SPA 라우팅, 이벤트 위임, 뷰 간 브릿지 |
| 상태 관리 | `src/state.js` | 전역 상태 객체, localStorage 영속성 |
| 데이터 로더 | `src/data-loader.js` | 온디맨드 과목/시험 로딩 |
| 교재 파서 | `src/textbook-parser.js` | 런타임 MD → 카드/퀴즈/챕터 조립 |
| 리더 포맷터 | `src/reader-format.js` | MD→HTML 변환, 링크 재작성, 키워드 자동 링크 |
| 마크다운 파서 | `src/markdown-parser.js` | MD→HTML 범용 파서 |
| 참조자료 레지스트리 | `src/pdf-registry.js` | 참조자료 중앙 설정 (과목 변경 시 유일 수정 파일) |
| HTML 뷰어 | `src/html-viewer.js` | 참조자료 fetch+DOM 주입, 검색, 하이라이트 |
| 문제집 뷰어 | `src/exam-viewer.js` | 문제은행 MD 런타임 뷰어 |
| 매뉴얼 뷰어 | `src/manual-viewer.js` | 학습안내서/사용자매뉴얼 뷰어 |
| 차트 | `src/charts.js` | SVG 레이더/꺾은선 차트 + 인터랙티브 툴팁 |
| 보안 | `src/sanitize.js` | XSS 방어, 텍스트 정제 |
| 유틸 | `src/utils.js` | 초성 추출, Fisher-Yates 셔플 |
| 키워드 인덱스 | `src/keyword-index.js` | 교재 셀→참조자료 키워드 매핑 (자동 생성) |
| 용어집 렌더러 | `src/views/glossary-renderer.js` | 용어집 테이블 렌더링, `scrollToGlossary()` 공유 함수 |
| 학습 보조 | `src/study-aids.js` | 기출 필터, 숫자 암기표 |
| 개념 맵 | `src/concept-map.js` | SVG 마인드맵 (콘텐츠 내장 Mermaid로 대체, 용어집 링크만 유지) |

### 뷰 컨트롤러 (`src/views/`)

| 모듈 | 책임 |
|------|------|
| `dashboard.js` | 대시보드 통계, 과목 카드 |
| `flashcard.js` | 3D 플래시카드 |
| `quiz.js` | 퀴즈 + 복습 + 일일 챌린지 |
| `trainer.js` | 훈련소 (계산, 원료, 뽀모도로) |
| `exam-simulator.js` | 모의고사 시뮬레이터 |
| `textbook-reader.js` | 교재 리더 + 오디오 + Media Session |
| `textbook-search.js` | 교재 본문 검색 |
| `dictionary.js` | 성분 사전 검색 |
| `backup.js` | 데이터 백업/복원 |
| `navigation.js` | 뷰 전환 유틸 |

### 자가 복구

| 모듈 | 책임 |
|------|------|
| `src/app-fallback.js` | ESM 로드 실패 시 단계적 복구 (SW update → 하드 리셋 → 수동) |
| `src/pwa-install-capture.js` | `beforeinstallprompt` 조기 캡처 + SW 조기 등록 + 업데이트 토스트 |
| `src/theme-init.js` | FOUC 방지 (페인트 전 테마 적용) |

### Service Worker

| 모듈 | 책임 |
|------|------|
| `sw.js` | 7단계 캐시 분기 전략, `precacheResilient`, 캐시 스큐 방지, 구 캐시 정리 |

### 테스트

| 항목 | 내용 |
|------|------|
| 단위 테스트 | 248개 (`tests/unit/`, Node.js) |
| DOM 테스트 | Vitest + jsdom (`tests/dom/`) |
| 회귀 가드 | `delegation-guard.test.js` (인라인 `on*=` 잔존 검출) |
| CI | GitHub Actions (`npm test` + `check_parser_parity` + `verify:assets`) |
