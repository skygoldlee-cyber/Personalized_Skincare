# 🏛️ 설계 컨셉 & 아키텍처 (Architecture & Design Concept)

> **대상 프로젝트**: Passmula (Cosmetic Pass Master) — 맞춤형화장품 조제관리사 스마트 학습 + Formula OS 실무 플랫폼
> **최종 업데이트**: 2026-09-24
> **목적**: 시스템의 설계 철학, 아키텍처 구조, 주요 설계 결정 사항을 설명 — 이 문서만으로 신규 기여자가 설계 의도를 파악하고 동일한 패턴으로 구현할 수 있는 수준을 지향

---

## 📋 목차

1. [설계 철학 (Design Philosophy)](#-설계-철학-design-philosophy)
2. [시스템 아키텍처 개요](#-시스템-아키텍처-개요)
3. [프로젝트 루트 파일 분류](#-프로젝트-루트-파일-분류)
4. [계층적 디렉토리 구조](#-계층적-디렉토리-구조)
5. [계층별 상세 구조](#-계층별-상세-구조)
6. [모듈 설계](#-모듈-설계)
7. [데이터 흐름](#-데이터-흐름)
8. [상태 관리 전략](#-상태-관리-전략)
9. [멀티시험 플랫폼 구조](#-멀티시험-플랫폼-구조)
10. [계정·클라우드 동기화 (Supabase, 선택적)](#-계정클라우드-동기화-supabase-선택적)
11. [UI 모드 (학습 ↔ 실무)](#-ui-모드-학습--실무)
12. [Formula OS 도메인 아키텍처](#-formula-os-도메인-아키텍처)
13. [localStorage 키 체계](#-localstorage-키-체계)
14. [테마 시스템 (라이트/다크)](#-테마-시스템-라이트다크)
15. [PWA & 오프라인 전략](#-pwa--오프라인-전략)
16. [Service Worker 동작 메커니즘](#-service-worker-동작-메커니즘)
17. [반응형 & 모바일 설계](#-반응형--모바일-설계)
18. [보안 설계](#-보안-설계)
19. [강건성 가이드라인](#️-강건성-가이드라인-robustness-guidelines)
20. [데이터 파이프라인 (빌드 타임 + 런타임)](#️-데이터-파이프라인-빌드-타임--런타임)
21. [배포 파이프라인](#-배포-파이프라인)
22. [신규 기능 구현 레시피](#-신규-기능-구현-레시피)
23. [주요 설계 결정 및 근거](#-주요-설계-결정-및-근거)
24. [향후 확장 방향](#-향후-확장-방향)
25. [`content/` 내용 변경 시 수정 파일 및 절차 가이드](#content-내용-변경-시-수정-파일-및-절차-가이드)
26. [교재 변경 시 소스 수정 필요성 검토](#-교재-변경-시-소스-수정-필요성-검토)

---

## 🎯 설계 철학 (Design Philosophy)

본 프로젝트는 다음 4가지 핵심 원칙 위에 설계되었습니다.

### 1. **Local-First + Optional Cloud (로컬 우선, 선택적 클라우드)**
- **기본 동작은 백엔드 없이 완결**: 학습·실무 모든 기능이 정적 프론트엔드 + `localStorage`만으로 동작하며, 계정 없이 즉시 사용 가능
- **선택적 Supabase 레이어**: 로그인한 사용자에게만 이메일 인증·클라우드 스냅샷 동기화(`sync_snapshots`)를 제공. Supabase 미설정(`supabase-config.js` 플레이스홀더) 환경에서는 관련 UI가 안내 문구로 대체되고 앱은 그대로 동작
- 학습 데이터 중 **시험 문항·성분 사전은 빌드 타임 JS 번들**, **교재 본문·카드·퀴즈는 `content/**/*.md`를 런타임에 fetch+파싱**하여 사용 (2026-08-24~ 런타임 MD 전환)
- **근거**: 서버 운영 비용·복잡성을 없애면서(Vercel 정적 호스팅), 멀티기기 사용자를 위한 선택적 동기화 경로를 확보. **타인 개인정보(고객 카드·상담 이력)는 동기화에서 구조적으로 제외** — 조제관리사가 고객 PII를 서버에 올리지 않는 프라이버시 설계 (§10 참조)

### 2. **Vanilla First (프레임워크 무 의존)**
- React/Vue 같은 프레임워크나 빌드 도구(Webpack/Vite) 없이 **순수 HTML/CSS/JavaScript**로 구현
- 외부 런타임 라이브러리 최소화 (차트도 직접 SVG 생성)
- **근거**:
  - 빌드 스텝 제거 → 소스 = 배포물, 디버깅 단순화
  - 브라우저가 곧 런타임 → 장기 유지보수 시 프레임워크 버전 종속성 리스크 제거
  - 번들 크기 최소화 → 모바일 환경에서 빠른 초기 로드

### 3. **Offline-Capable PWA (오프라인 우선)**
- Service Worker로 App Shell과 학습 데이터를 캐시하여 **지하철 등 무인터넷 환경에서도 학습 가능**
- 설치 가능한(Installable) PWA로 홈 화면 추가 지원
- **근거**: 수험생의 주요 학습 공간(이동 중, 스터디카페)을 고려한 가용성 확보

### 4. **모바일 퍼스트 반응형 (Mobile-First Responsive)**
- 데스크톱 사이드바 ↔ 모바일 하단 탭 바로 네비게이션 패러다임 전환
- safe-area, 동적 뷰포트(`100dvh`), 가로/세로 대응 등 실기기 UX 최적화
- **근거**: 실제 사용자 대부분이 스마트폰으로 접속하는 사용 패턴 반영

---

## 🏗️ 시스템 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                     Presentation Layer                   │ │
│ │   index.html (App Shell)  +  style.css (@import css/*)   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                    Application Layer                     │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ 코어: app.js(오케스트레이터) · router.js · state.js │   │ │
│ │  │ storage.js(저장소 추상화·백엔드 교체) · storage-keys │   │ │
│ │  │ exam-context.js(시험 해석·scopedKey) · ui-mode.js   │   │ │
│ │  │ paths.js · data-loader.js · weak-items.js           │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ 유틸: utils · sanitize · sha256 · charts · ui-utils │   │ │
│ │  │ spaced-repetition · study-tracker · study-aids      │   │ │
│ │  │ textbook-parser · markdown-parser · reader-format   │   │ │
│ │  │ questions · statement-tracker · scratchpad          │   │ │
│ │  │ pdf-registry · keyword-index · glossary-query       │   │ │
│ │  │ web-vitals · trainer-calc · types(JSDoc)            │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ 뷰어: html-viewer · exam-viewer · manual-viewer     │   │ │
│ │  │ mermaid-render · mermaid-utils · pwa-manifest       │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ Formula OS 도메인: formula-store · formula-rules    │   │ │
│ │  │ formula-check · formula-stability · batch-store     │   │ │
│ │  │ customer-store · material-ledger · usage-guide      │   │ │
│ │  │ store-utils(공통) · csv-utils                       │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ 계정·동기화(선택): auth-view · sync                 │   │ │
│ │  │ supabase-client(lazy) · supabase-config             │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ views/ (28개 뷰 컨트롤러): dashboard · flashcard     │   │ │
│ │  │ quiz · daily-challenge · trainer(+calc/ingredients/ │   │ │
│ │  │ drills) · pomodoro · exam-simulator(+state/review)  │   │ │
│ │  │ textbook-reader · reader-audio · textbook-search    │   │ │
│ │  │ dictionary · study-calendar · backup · navigation   │   │ │
│ │  │ glossary-renderer · event-listeners · exam-select   │   │ │
│ │  │ offline-detection · formula(+batch/customer/        │   │ │
│ │  │ material/compliance/print)                          │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ 부팅(클래식 스크립트): theme-init ·                  │   │ │
│ │  │ pwa-install-capture · pwa-manifest · app-fallback   │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                       Data Layer                         │ │
│ │  data/exams.js(레지스트리) · data/exams/<id>/registry.js  │ │
│ │  · ingredients_data.*.js · audio_manifest.js · drills/    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                    Persistence Layer                     │ │
│ │   localStorage (1차 저장소, 시험 스코프 키)                │ │
│ │   Cache Storage (SW 오프라인) · sessionStorage (뷰어 캐시)│ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ 정적 파일 서빙       │ MP3 스트리밍        │ 선택적 동기화
┌────────┴──────────┐ ┌────────┴──────────┐ ┌───────┴───────────┐
│   Vercel (CDN)    │ │  외부 오디오 CDN   │ │  Supabase (선택)   │
│  - App Shell      │ │  (302MB, 캐시 제외)│ │  Auth +            │
│  - 데이터 번들     │ └───────────────────┘ │  sync_snapshots    │
│  - content/*.md   │                       └───────────────────┘
└───────────────────┘
```

---

## 🗂️ 프로젝트 루트 파일 분류

프로젝트 루트에는 프레임워크/도구 요구사항으로 인해 반드시 루트에 위치해야 하는 파일들이 있습니다.

### 루트 필수 파일 (이동 불가)

| 파일 | 용도 | 제약 사유 |
|------|------|-----------|
| `index.html` | SPA App Shell 진입점 | Vercel/정적 호스팅 루트 요구 |
| `style.css` | CSS 진입점 (`@import` 어그리게이터, `css/*.css` 6개 로드) | `index.html`에서 참조 |
| `sw.js` | Service Worker | SW 스코프이 루트(또는 명시적 `Scope`)에서만 전역 캐싱 |
| `manifest.webmanifest` | PWA 웹 앱 매니페스트 | `index.html`에서 참조 |
| `ping.txt` | 오프라인 감지용 same-origin 프로브 (내용 `1`) | `app.js`/`sw.js`에서 same-origin fetch |
| `vercel.json` | Vercel 배포 설정 (CSP, 보안 헤더, 캐시 정책) | Vercel CLI 요구 |
| `.vercelignore` | Vercel 배포 제외 목록 | Vercel CLI 요구 |
| `.gitignore` | Git 추적 제외 | Git 표준 |
| `README.md` | 프로젝트 소개 문서 | GitHub/관례 |
| `package.json` | npm 의존성 및 스크립트 | npm 표준 |
| `package-lock.json` | npm 의존성 잠금 파일 | npm 표준 |
| `jsconfig.json` | VSCode IntelliSense 설정 (`checkJs`, 경로 매핑) | IDE 프로젝트 루트 요구 |
| `vitest.config.mjs` | Vitest DOM 테스트 설정 | Vitest 요구 |
| `.github/` | GitHub Actions CI 워크플로우 | GitHub 요구 |
| `.vercel/` | Vercel CLI 프로젝트 설정 | Vercel CLI 요구 |
| `node_modules/` | npm 설치 패키지 | npm 표준 |

### 루트 디렉터리 (콘텐츠)

| 디렉터리 | 용도 |
|-----------|------|
| `src/` | 애플리케이션 소스 코드 (ESM 모듈 + `views/` 뷰 컨트롤러 + `config/` 상수) |
| `css/` | UI 모듈별 스타일시트 (`base`, `dashboard`, `study`, `exam`, `trainer`, `reader`, `formula` 등 12개) |
| `data/` | 빌드 산출물 — 전역(`exams.js`, `audio_manifest.js`, `docs_md/`) + 시험별 루트(`exams/<id>/`) |
| `content/` | 콘텐츠 SSOT — 전역(`exams.json` 시험 레지스트리) + 시험별 루트(`exams/<id>/`에 manifest/교재/문제은행/참조자료/오디오북) |
| `docs/` | 프로젝트 문서 (`dev/` 개발 문서, `user/` 사용자 문서) |
| `tools/` | 빌드 스크립트, 배포 가드(`deploy.js`), 검증 도구 |
| `tests/` | 자동화 테스트 (`unit/` Node.js, `dom/` Vitest+jsdom) |
| `vendor/` | 자체 호스팅 라이브러리 (FontAwesome, 웹폰트, Mermaid.js, Supabase UMD) |
| `icons/` | PWA 아이콘 (192/512/maskable) |

---

## 🌳 계층적 디렉토리 구조

```
Personalized_Skincare/
├── index.html                  # SPA 엔트리 포인트
├── style.css                   # 메인 스타일 (base.css import)
├── sw.js                       # Service Worker
├── manifest.webmanifest        # PWA 매니페스트
├── ping.txt                    # 오프라인 감지 프로브
├── serve.js                    # 로컬 개발 서버
├── package.json
├── package-lock.json
├── jsconfig.json               # JSDoc 타입 검사 설정
├── vitest.config.mjs           # 테스트 설정
├── vercel.json                 # Vercel 배포 + CSP 헤더
├── .gitignore / .vercelignore
├── README.md
│
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI
│
├── icons/                      # PWA 아이콘 (192/512/maskable)
│
├── css/                        # UI 모듈별 스타일시트 (style.css가 @import로 로드)
│   ├── base.css                #   전역, 레이아웃, 네비게이션, 스크롤바, 테마 변수
│   ├── dashboard.css           #   대시보드
│   ├── study.css               #   플래시카드, 퀴즈
│   ├── exam.css                #   모의고사, 배지
│   ├── reader.css              #   교재 리더, 용어집, 학습보조, Mermaid
│   ├── reader-mermaid.css      #   Mermaid 다이어그램 전용 스타일
│   ├── trainer.css             #   훈련소, 계산기, 손글씨
│   ├── html-viewer.css         #   참조자료 HTML 뷰어
│   ├── ui-overlay.css          #   오버레이, 모달, 토스트
│   ├── study-calendar.css      #   학습 캘린더, 목표 달성률
│   ├── formula.css             #   Formula OS (계산기·배치·고객·장부·체크리스트)
│   └── print.css               #   인쇄 전용 (조제 기록지·라벨·안내문)
│
├── src/                        # 애플리케이션 소스 (ESM)
│   ├── app.js                  #   오케스트레이터 (초기화, 이벤트 위임, 라우터 연결)
│   ├── router.js               #   SPA 라우터 (뷰 타이틀 맵, 네비게이션 디스패치)
│   ├── app-fallback.js         #   ESM 로드 실패 시 자가 복구
│   ├── pwa-install-capture.js  #   beforeinstallprompt 조기 캡처 + SW 등록
│   ├── theme-init.js           #   FOUC 방지 (페인트 전 테마 적용)
│   ├── state.js                #   전역 상태 + 진행 영속성 (저장은 storage.js 위임)
│   ├── storage.js              #   저장소 추상화 계층 (교체 가능 백엔드, 동기·Async 이중 API)
│   ├── data-loader.js          #   온디맨드 과목/시험 로딩
│   ├── textbook-parser.js      #   런타임 MD → 카드/퀴즈/챕터 파싱
│   ├── reader-format.js        #   MD→HTML 변환, 링크 재작성, 키워드 자동링크
│   ├── markdown-parser.js      #   범용 MD→HTML 파서
│   ├── pdf-registry.js         #   참조자료 중앙 설정 — 시험별 테이블(_EXAM_TABLES) + getRefTables()
│   ├── mermaid-render.js       #   Mermaid 지연 로딩·렌더링 공용 (reader/search/manual)
│   ├── pwa-manifest.js         #   시험별 동적 PWA 매니페스트 (클래식 스크립트)
│   ├── html-viewer.js          #   참조자료 fetch+DOM 뷰어, 검색, 하이라이트
│   ├── exam-viewer.js          #   문제은행 MD 런타임 뷰어 (인용 링크 네비게이션, 라인 하이라이트)
│   ├── manual-viewer.js        #   학습안내서/매뉴얼 뷰어
│   ├── glossary-query.js       #   용어집 조회 API
│   ├── keyword-index.js        #   교재 셀→참조자료 키워드 매핑 (자동 생성)
│   ├── paths.js                #   파일 경로 상수 중앙 관리
│   ├── storage-keys.js         #   localStorage 키 중앙 관리
│   ├── study-aids.js           #   기출 필터, 숫자 암기표
│   ├── study-tracker.js        #   학습 캘린더/목표 추적 (recordStudyActivity, getStudyGoals)
│   ├── spaced-repetition.js    #   SM-2 간격 반복 알고리즘, 복습 스케줄링
│   ├── recommendations.js      #   "오늘의 합격 전략" 추천 엔진 + 예상 점수 추정 + 실제 결과 보고 (순수 로직)
│   ├── command-palette.js      #   통합 검색 팔레트 (Ctrl+K) — 뷰/교재/카드/퀴즈/성분/문제집 통합 검색·실행
│   ├── weak-items.js           #   약점(오답) 항목 ID 문법·해석 + 퀴즈·카드 인덱스 캐시 (DOM 비의존)
│   ├── questions.js            #   문항 스키마·채점 유틸 (single/combo/short/ox)
│   ├── statement-tracker.js    #   진술 원자(sid) 단위 오판 통계 + 졸업 추적
│   ├── charts.js               #   SVG 레이더/꺾은선 차트 + 툴팁
│   ├── sanitize.js             #   XSS 방어
│   ├── sha256.js               #   안정적 ID 해시
│   ├── web-vitals.js           #   Core Web Vitals (LCP/CLS/INP) 모니터링
│   ├── trainer-calc.js         #   계산 훈련 문제 생성 (순수 로직)
│   ├── scratchpad.js           #   손글씨 Canvas
│   ├── types.js                #   JSDoc @typedef 타입 정의
│   ├── ui-utils.js             #   로딩 UI, 커스텀 토스트/컨펌 모달 (showToast/showConfirm)
│   ├── utils.js                #   초성 추출, Fisher-Yates 셔플
│   ├── globals.d.ts            #   전역 타입 선언
│   ├── exam-context.js         #   활성 시험 해석/전환, scopedKey 네임스페이스, hasFeature (리프 모듈)
│   ├── ui-mode.js              #   학습/실무 UI 모드 전환
│   ├── supabase-config.js      #   Supabase URL·Publishable key (공개 설계상 키)
│   ├── supabase-client.js      #   Supabase lazy init — vendor UMD 동적 로드
│   ├── auth-view.js            #   계정/로그인 모달 (이메일+PW·회원가입·매직링크 OTP)
│   ├── sync.js                 #   클라우드 스냅샷 동기화 (sync_snapshots push/pull)
│   ├── formula-store.js        #   Formula OS — 포뮬러 CRUD·한도(5)·스키마 정제·전성분 생성
│   ├── formula-rules.js        #   Formula OS — 추천 규칙 (베이스·고민/피부 매핑·안전 필터)
│   ├── formula-check.js        #   Formula OS — 고시 한도 검증 엔진 (4상태 판정)
│   ├── formula-stability.js    #   Formula OS — 제형 안정성 체크 (상 비율·상호작용·단계·pH)
│   ├── batch-store.js          #   Formula OS — 조제 기록(배치) 채번·QC·스냅샷 (한도 50)
│   ├── customer-store.js       #   Formula OS — 고객 카드·상담 이력 (한도 20, 동기화 제외)
│   ├── material-ledger.js      #   Formula OS — 원료 입고·기한·재고 (한도 30)
│   ├── usage-guide.js          #   Formula OS — 사용 안내문 생성기
│   ├── store-utils.js          #   Formula OS — 스토어 공통 헬퍼 (loadItems/newId/clamp…)
│   ├── csv-utils.js            #   CSV 파서·EUC-KR 폴백·BOM 직렬화
│   ├── config/
│   │   ├── timing.js           #   타이밍 상수 (PWA 프로브, 스와이프 임계값)
│   │   └── cache.js            #   캐시 설정 상수
│   └── views/                  #   뷰 컨트롤러 모듈
│       ├── dashboard.js        #     대시보드 통계
│       ├── flashcard.js        #     3D 플래시카드
│       ├── quiz.js             #     퀴즈 + 복습
│       ├── daily-challenge.js  #     데일리 챌린지 (quiz.js에서 분리)
│       ├── trainer.js          #     훈련소 허브 (재수출)
│       ├── trainer-calc-practice.js  # 계산 연습기
│       ├── trainer-ingredients.js    # 원료 배합 챌린지
│       ├── trainer-drills.js   #     O/X·복수정답형 드릴 UI
│       ├── pomodoro.js         #     뽀모도로 타이머 (trainer.js에서 분리)
│       ├── exam-simulator.js   #     모의고사 시뮬레이터
│       ├── exam-sim-state.js   #     시뮬레이터 상태
│       ├── exam-sim-review.js  #     시뮬레이터 결과 리뷰
│       ├── exam-select.js      #     시험 선택/전환 뷰
│       ├── textbook-reader.js  #     교재 리더 + 오디오 + Media Session
│       ├── reader-audio.js    #     오디오북 플레이어
│       ├── textbook-search.js  #     교재 본문 검색
│       ├── dictionary.js       #     성분 사전
│       ├── study-calendar.js   #     학습 캘린더/목표 뷰
│       ├── backup.js           #     데이터 백업/복원
│       ├── glossary-renderer.js #    용어집 렌더링 + scrollToGlossary()
│       ├── formula.js          #     Formula OS 허브 — 계산기·추천·My 포뮬러·서브내비
│       ├── formula-batch.js    #     조제 기록(배치) 목록·폼·상세
│       ├── formula-customer.js #     고객 관리 패널
│       ├── formula-material.js #     원료 장부 패널
│       ├── formula-compliance.js #   법규 준수 체크리스트
│       ├── formula-print.js    #     인쇄 빌더 (기록지·라벨·안내문)
│       ├── event-listeners.js  #     이벤트 리스너 일괄 바인딩
│       ├── offline-detection.js #    오프라인 감지
│       └── navigation.js       #     뷰 전환 유틸
│
├── content/                    # 콘텐츠 컨테이너 (시험 소유 파일 없음 — 순수 네임스페이스)
│   ├── exams.json              #   시험 레지스트리 — 멀티시험 엔트리 (id/name/branding/contentRoot/dataRoot/features)
│   └── exams/
│       └── <examId>/           #   시험별 콘텐츠 루트 (모든 시험 동일 내부 구조 — 대칭)
│           ├── manifest.json   #     과목/단원/시험/추천링크 메타데이터 (SSOT)
│           ├── references.json #     참조자료 매핑 설정
│           ├── 학습안내서.md
│           ├── 두음법_암기_총정리.md  #   두음법+중요숫자 통합 암기 문서
│           ├── combo_blocklist.json #  복수정답형 자동변환 제외 목록
│           ├── number-drills/  #     숫자 암기 드릴 JSON
│           ├── 교재/
│           │   ├── glossary/   #     과목별 큐레이션 용어 정의 JSON (subject1~4)
│           │   ├── law/        #     1과목 (본문 + 이야기형)
│           │   ├── manufacturing/  # 2과목
│           │   ├── safety/     #     3과목
│           │   └── understanding/  # 4과목
│           ├── 문제은행/        #    과목N_단일정답형.md (manifest 등록) + 과목N_복수정답형.md (생성 산출물)
│           ├── 참조자료/
│           │   ├── ref_md/과목N/{문서}/  # PDF→MD 변환본 (41개, ~26MB) — 과목 폴더가 귀속의 진실
│           │   ├── 공통/       #     공통 참조자료 PDF
│           │   ├── 과목1~4/    #     과목별 참조자료 PDF (+ 과목 노트 N.*.md)
│           │   ├── 법령고시/   #     법령 원문
│           │   └── 원료/       #     성분 원본 MD + db_version.json (버전·이력)
│           ├── audiobook/      #     Python TTS 파이프라인
│           │   ├── run_pipeline.py · md_chunker.py · tts_*.py · mp3_merger.py
│           │   ├── script_polisher.py · generate_all_mp3.py
│           │   └── mp3/        #     생성된 MP3 (gitignore)
│           └── utils/          #     Python 변환 스크립트
│               ├── batch_convert.py · convert_ref_md.py · check_laws.py · md_to_html.py
│
├── data/                       # 빌드 타임 생성 (자동 생성, 직접 수정 금지)
│   ├── exams.js                #   전역 시험 레지스트리 번들 (window.EXAMS_LIST, 클래식 스크립트)
│   ├── audio_manifest.js       #   오디오 챕터 매핑 (시험 id 키 분리)
│   ├── docs_md/                #   앱 공용 문서 폴백 번들 (user_manual·formula_manual — 시험 무관)
│   └── exams/
│       └── <examId>/           #   시험별 데이터 루트 (dataRoot — 모든 시험 대칭)
│           ├── registry.js     #     과목/시험/성분 메타 (shortName·file·resources·uiText)
│           ├── ingredients_data.<hash>.js  # 성분 사전 (해시 파일명)
│           ├── id_migration.js #     레거시 ID → 안정 ID 매핑
│           ├── card_terms_snapshot.json    # 카드 ID 추적 스냅샷
│           ├── question_chapters.js        # 문항id→단원 매핑 (취약 분석용)
│           ├── exams/          #     시험 문항 번들 (해시 파일명)
│           ├── exams_md/       #     문제은행 MD 폴백 번들 (file:// 전용)
│           ├── study_md/       #     교재 MD 폴백 번들 (과목별 분할, file:// 전용)
│           ├── docs_md/        #     시험 문서 폴백 (학습안내서)
│           ├── drills/         #     문항 드릴 번들 (레지스트리 미등록)
│           │   ├── ox_subject*.js    #   O/X 판정 드릴 (build_ox_drills.js)
│           │   ├── combo_subject*.js #   복수정답형 자동 변환 (build_combo_drills.js)
│           │   ├── combo_pilot.js    #   수작업 파일럿 (check:combo 검증)
│           │   └── combo_index.js    #   과목별 복수정답형 문항 수
│           └── supplements/    #     문제은행 비율 기반 보충 카드/퀴즈 (build/supplements.js)
│
├── tools/                      # 빌드/검증 도구
│   ├── build/
│   │   ├── index.js            #   메인 빌드 (registry, exams, ingredients)
│   │   ├── manifest-loader.js  #   manifest.json 검증
│   │   ├── schema.js           #   스키마 검증
│   │   ├── id-factory.js       #   안정적 ID 생성
│   │   ├── build_keyword_index.js # GLOSSARY_INDEX + 큐레이션 병합
│   │   ├── build-audio-manifest.js # 오디오 챕터 매니페스트 생성
│   │   ├── build-pdf-registry.js # PDF 레지스트리 생성
│   │   ├── report.js           #   빌드 통계
│   │   ├── stamp-sw-version.js #   SW 캐시 버전 자동 스탬프
│   │   └── plugins/
│   │       ├── textbook.plugin.js
│   │       ├── exams.plugin.js
│   │       └── ingredients.plugin.js
│   ├── build/supplements.js    #   문제은행 비율 기반 카드/퀴즈 목표 배분 + 보충 번들 (build:data 내 3.5단계)
│   ├── build_doc_bundles.js    #   학습안내서/매뉴얼 폴백 번들
│   ├── build_exam_bundles.js   #   문제은행 폴백 번들
│   ├── build_study_md_bundle.js #  교재 폴백 번들 (과목별 분할)
│   ├── build_ox_drills.js      #   O/X 드릴 생성기 (객관식 → 진위형 3,700+문)
│   ├── build_combo_drills.js   #   복수정답형 변환기 (choice → 755문 + 과목N_복수정답형.md)
│   ├── check_combo_pilot.js    #   복수정답형 파일럿 검증 (check:combo)
│   ├── check_parser_parity.js  #   빌드 파서 ↔ 런타임 파서 등가성 검증
│   ├── check-imports.js        #   ES 모듈 import/export 교차 검증
│   ├── verify-shell-assets.js  #   프리캐시 파일 존재 CI 검증
│   ├── audit_card_quality.js  #   카드 품질 자동 감사 (npm run audit:cards)
│   ├── audit_citation_links.js #  인용 링크 감사
│   ├── audit_hyperlinks.js     #   하이퍼링크 감사
│   ├── sync_citation_lines.js  #   문제은행 인용 라인번호 동기화 (build:data에 통합)
│   ├── check_pdf_to_md_mapping.js # PDF→MD 매핑 검사
│   ├── convert_pdf_links_to_md.js # PDF 링크→MD 변환
│   ├── normalize_url_encoding.js # URL 인코딩 정규화
│   ├── extract_notfound.js     #   404 인용 추출
│   ├── fix_citation_lines.js   #   인용 라인번호 수동 수정
│   ├── fix_manual_citations.js #   매뉴얼 인용 수정
│   ├── verify_citation_lines.js #  인용 라인번호 검증
│   ├── verify_citations.js     #   인용 검증
│   └── fix-mindmap-indent.mjs  #   Mermaid mindmap 들여쓰기 수정
│
├── tests/                      # 자동화 테스트
│   ├── unit/                   #   단위 테스트 (node --test)
│   │   └── *.test.js           #     delegation-guard · parser · mermaid · sanitize ·
│   │                           #     state · storage · store(batch/customer/material/formula) ·
│   │                           #     sync · exam-context · questions · statement-tracker 등
│   └── dom/                    #   DOM 테스트 (Vitest + jsdom)
│       ├── helpers.js          #     공통 DOM 셋업·모킹 헬퍼
│       ├── supabase.js         #     Supabase 모킹
│       ├── common-*.dom.test.js    # 공통 시나리오 (a11y/auth/offline/theme/uimode/sync…)
│       ├── formula-*.dom.test.js   # Formula OS 시나리오
│       ├── study-*.dom.test.js     # 학습 뷰 시나리오
│       └── backup · router.dom.test.js
│
├── vendor/                     # 자체 호스팅 라이브러리
│   ├── fontawesome/
│   │   ├── css/all.min.css
│   │   └── webfonts/           #   .woff2, .ttf
│   ├── fonts/
│   │   ├── fonts.css           #   @font-face 정의
│   │   ├── noto-sans-kr-*.woff2 #  5 가중치
│   │   └── outfit-*.woff2      #   4 가중치
│   ├── mermaid/
│   │   └── mermaid.min.js      #   3.3MB, 온디맨드 로드 (mermaid 블록 있을 때만)
│   └── supabase/
│       └── supabase.js         #   Supabase UMD — 로그인 시에만 동적 로드
│
└── docs/                       # 프로젝트 문서
    ├── README.md               #   문서 인덱스
    ├── dev/                    #   개발자 문서
    │   ├── ARCHITECTURE.md     #     아키텍처 설계서 (본 문서)
    │   ├── SPEC.md             #     요구사양 명세서
    │   ├── CHANGES.md          #     변경 이력
    │   ├── TESTING.md          #     테스트 가이드
    │   ├── DEPLOYMENT_GUIDE.md #     배포 가이드
    │   ├── CONTENT_WORKFLOW.md #     콘텐츠 변경 시 작업 절차
    │   ├── MULTI_MACHINE_SETUP.md
    │   ├── FLASHCARD_LOGIC.md
    │   ├── QUESTION_SCHEMA_DESIGN.md #  문항 스키마 + 복수정답형 변환 설계 (구 문제은행/문항 스키마 설계.md)
    │   ├── COMBO_STUDY_STRATEGY.md  #     복수정답형 학습전략 — 진술 원자 단위 학습법 (구 문제은행/복수정답형 학습전략.md)
    │   ├── MD_TO_HTML_LOGIC.md
    │   ├── TEXTBOOK_AUTHORING_GUIDE.md
    │   ├── AUDIO_HOSTING_GUIDE.md
    │   ├── SUBSCRIPTION_ROADMAP.md
    │   ├── FEATURE_PROPOSALS.md #    기능 제안 (Pass Core Loop)
    │   ├── PASS_CORE_LOOP_REVIEW.md # 합격 핵심 루프 리뷰
    │   ├── PASS_TO_PRACTICE_STRATEGY.md # 합격→실무 전략
    │   ├── FORMULA_OS_DESIGN.md #      Formula OS 도메인 설계
    │   ├── FORMULA_OS_WORKFLOW_DESIGN.md # 배치·고객·장부 업무 플로우 설계
    │   ├── SUPABASE_DESIGN.md #        Supabase 계정·동기화 설계안
    │   ├── Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md # SMTP·매직링크 설정
    │   ├── READER_FEEDBACK_DESIGN.md #  교재 리더 피드백 설계
    │   ├── STUDY_APP_DESIGN_GUIDE.md #  학습 앱 디자인 가이드
    │   └── Cosmetic Master Business Plan.md
    ├── report_archive/         #   분석 보고서 아카이브 (앱 미참조)
    └── user/
        ├── user_manual.md      #   사용자 매뉴얼
        ├── formula_manual.md   #   Formula OS 실무 매뉴얼
        ├── exam_strategy.md    #   시험 전략
        ├── subject1_numbers.md #   1과목 핵심 숫자
        ├── subject2_numbers.md #   2과목 핵심 숫자
        ├── subject3_numbers.md #   3과목 핵심 숫자
        └── subject4_numbers.md #   4과목 핵심 숫자
```

---

## 🏗️ 계층별 상세 구조

### 1. Presentation Layer (표현 계층)

| 파일 | 역할 |
|------|------|
| [`index.html`](../../index.html) | 단일 HTML 페이지(SPA App Shell). 모든 뷰 섹션이 하나의 문서에 존재하며 JS로 표시 전환 |
| [`style.css`](../../style.css) | 전역 디자인 시스템. CSS 변수 기반 테마, 반응형 미디어 쿼리, 애니메이션 |
| [`manifest.webmanifest`](../../manifest.webmanifest) | PWA 매니페스트 (앱 이름, 아이콘, 테마 색상) |

**SPA 뷰 전환 방식**:
- 12개의 `<section class="view-section">`이 하나의 HTML에 공존
- `router.js`의 `navigateToView(target, ctx)`가 `.active` 클래스를 토글하여 화면 전환 (페이지 리로드 없음). 타이틀/서브타이틀은 `getViewTitles(registry)`가 `DATA_REGISTRY.uiText`에서 동적 생성
- 뷰 목록: dashboard / flashcard / quiz / review / trainer / exam / textbook / textbook-reader / dictionary / formula / exam-select / calendar
- 내비게이션 동기화: `.nav-item`(사이드바)과 `.mobile-tab-item`(탭 바)에 동일 `data-target` 부여 → 뷰 전환 시 양쪽 활성 상태 자동 동기화
- 전환 부가 동작: 이전 뷰 스크롤 위치 저장·복원, 리더 집중 모드 해제, 오디오 정지, 뷰별 렌더 핸들러 호출 (`ctx.handlers`)

### 2. Application Layer (응용 계층)

| 모듈 | 책임 |
|------|------|
| [`src/app.js`](../../src/app.js) | **메인 오케스트레이터**. 초기화(`initApp`), **이벤트 위임 바인딩**(`data-click`/`data-input`/`data-args` + `resolveDelegatedHandler`/`parseDelegatedArgs`), `startFocusSubjectStudy` 등 뷰 간 브릿지 함수. `populateExamCards()`로 registry 기반 시험 카드 동적 생성. 라우팅은 `router.js`에 위임 |
| [`src/router.js`](../../src/router.js) | **SPA 라우터**. `getViewTitles()`로 뷰 타이틀/서브타이틀 맵 생성, `navigateToView()`로 뷰 전환 디스패치 (active 클래스 토글, 헤더 갱신, 뷰 렌더러 호출, 오디오 정지, 포커스 모드 해제) |
| [`src/charts.js`](../../src/charts.js) | SVG 기반 차트 생성 (레이더 차트, 성적 꺾은선 그래프). **인터랙티브 툴팁**(hover/touch) 지원. 외부 차트 라이브러리 미사용 |
| [`src/scratchpad.js`](../../src/scratchpad.js) | HTML5 Canvas 손글씨 연습장 (계산 문제 풀이용) |
| [`src/trainer-calc.js`](../../src/trainer-calc.js) | 계산 훈련 문제 생성기. **순수 로직** — DOM 의존 없이 문제 데이터 객첼만 반환 |
| [`src/state.js`](../../src/state.js) | 전역 상태 객체(`state`) 정의 + 진행 영속성(`loadProgress`/`saveProgress`). 기본 과목은 `null`이며 `initApp()`에서 registry 첫 과목으로 설정. `saveProgress()`에서 학습 활동 증분을 `study-tracker.js`로 자동 기록. `safeGetItem`/`safeSetItem` 등은 `storage.js` 위임 (하위호환 유지) |
| [`src/storage.js`](../../src/storage.js) | **저장소 추상화 계층** — 앱의 모든 영속 읽기·쓰기의 단일 퍼널. 논리 키 → `scopedKey` 시험 네임스페이스 적용, 백엔드는 `setStorageBackend()`로 교체 가능(기본 localStorage). 동기 API(`getItem`/`setItem`/`removeItem`/`listKeys`/`getJSON`/`setJSON`)와 비동기 API(`*Async`) 이중 제공 — IndexedDB/SQLite 등 비동기 백엔드는 Async 메서드만 구현하면 되고, sync:false 백엔드에서 동기 API는 null/false+경고. sync dirty 쓰기 훅·쿼터 불가 플래그(`isStorageUnavailable`) 중앙화 |
| [`src/study-tracker.js`](../../src/study-tracker.js) | 학습 캘린더/목표 추적 헬퍼. 날짜별 학습 활동 기록(`recordStudyActivity`), 학습 목표 조회/저장(`getStudyGoals`/`setStudyGoals`), 오늘/이번주/이번달 달성률 계산, 시험일 D-day·역산 권장량(`getDDay`/`getSuggestedDailyCount`) |
| [`src/recommendations.js`](../../src/recommendations.js) | "오늘의 합격 전략" 추천 엔진 (Learning Pro). SM-2 대기 → 과락 → 정답률 최저 → 헷갈린 카드 → 미학습 우선순위(`computeRecommendations`), 오답 원인 패턴 집계(`computeWrongCauseSummary`), 모의고사 이력 기반 예상 점수 추정(`estimateExpectedScore` — 합격 확률 아닌 점수 추정치), 실제 결과 자가 보고(`actual_exam_result`). DOM 비의존 순수 로직 |
| [`src/command-palette.js`](../../src/command-palette.js) | 통합 검색 팔레트 (Ctrl/Cmd+K). `searchAll()` 순수 함수가 뷰(nav-item 스캔 → feature 게이팅 반영)/교재 섹션/카드/퀴즈/성분(초성)/문제집을 통합 검색, 팔레트 UI는 ↑↓·Enter·ESC 키보드 내비. 실행은 기존 경로 재사용(nav 클릭 시뮬레이션, `startSubjectStudy/Quiz`, `openSubjectChapter`, `ExamViewer.openExam`). 전 소스 로컬 데이터로 오프라인 동작 |
| [`src/weak-items.js`](../../src/weak-items.js) | 약점(오답) 항목 ID 문법의 단일 소스 — `weak_quiz_`/`weak_sim_` 접두사 상수, `weakItemKey`/`parseWeakSimId`/`subjectKeyFromItemId`, 오답 해석(`resolveWrongQuiz`/`resolveCard`/`subjectForWeakItem`). **인덱스 캐시**: 퀴즈·카드를 `id → {항목, subjectId}` Map으로 인덱싱하고 STUDY_DATA·과목 키·배열 참조/길이 비교로 무효화 — `DataLoader.loadSubject()` 점진 로드 시 자동 재구축. DOM 비의존(`window` 가드) |
| [`src/utils.js`](../../src/utils.js) | 의존성 없는 범용 헬퍼 (한글 초성 추출 `getChosung()` 등) |
| [`src/sanitize.js`](../../src/sanitize.js) | HTML/XSS 방어 및 텍스트 정제 유틸리티 |
| [`src/pdf-registry.js`](../../src/pdf-registry.js) | 참조자료 중앙 설정 모듈. 과목별 참조자료 매핑, 출처→PDF 파일명 매핑, MD 변환본 경로 자동 생성 (`REF_DIRS`, `resolveRefPath`, `mapSourceToRef`). 원본 PDF는 `.vercelignore`로 배포 제외, `ref_md/과목N/*/*.md` 변환본(3.7MB)으로 인앱 뷰어+PDF 저장 지원 |
| [`src/html-viewer.js`](../../src/html-viewer.js) | 앱 내 HTML/MD 참조자료 뷰어. `fetch()`+`DOMParser`(HTML) 또는 `parseMarkdown()`(MD)로 로드 후 DOM 직접 주입 (iframe 없음). **키워드 기반 스크롤**: `KEYWORD_INDEX`에서 추출한 셀 텍스트 키워드로 검색→첫 번째 하이라이트로 스크롤 (L###은 스크롤에 사용하지 않음). **성능 최적화**: sessionStorage 캐싱(24h TTL)으로 재방문 시 즉시 렌더링, span 일괄 제거(normalize 호출 최소화), 검색 조기 종료(첫 매치 즉시 스크롤 + 나머지 `requestIdleCallback` 지연 하이라이트). 텍스트 노드 순회 검색 + `<mark>` 하이라이트, 검색 결과 내비게이션(이전/다음), 인쇄 지원. **PDF 저장** (v210 도입): 인쇄 전용 CSS로 오버레이 제약 없이 전체 문서를 브라우저 인쇄 다이얼로그로 출력 → "PDF로 저장" 선택 가능 |
| [`src/reader-format.js`](../../src/reader-format.js) | 교재 리더 본문 포맷터. `parseMarkdown()` + HTML 참조 링크 변환 (`data-ref-html`, `data-ref-search`) + 참조자료 인라인 렌더링. **참조자료 인라인 프리뷰 툴팁** (데스크톱 hover 400ms / 모바일 롱프레스 600ms, 200자 스니펫) |
| [`src/exam-viewer.js`](../../src/exam-viewer.js) | 문제집(MD) 런타임 뷰어. `content/exams/cosmetic/문제은행/*.md` fetch → 자체 MD→HTML 변환 → 인앱 전체화면 오버레이 렌더링. TOC 생성·인쇄·sessionStorage 캐시(24h)·`file://` 번들 폴리백(`data/exams/cosmetic/exams_md/*.js`) 지원. **시험 제목은 registry에서 동적 조회** (하드코딩 없음) |

| 파일 | 내용 | 생성 주체 |
|------|------|-----------|
| [`data/exams/cosmetic/registry.js`](../../data/exams/cosmetic/registry.js) | 시험/성분 번들 목록·메타 + 과목 목록/통계 + 추천 링크. **과목 `shortName`**, 시험 **`file`**, **`resources`** 필드 포함 → 소스 코드 하드코딩 제거 | `tools/build/index.js` |
| [`content/**/*.md`](../../content/) + [`content/exams/cosmetic/manifest.json`](../../content/exams/cosmetic/manifest.json) | **교재/카드/퀴즈/시험/추천링크의 원본 (SSOT).** `manifest.json`에 과목 `shortName`, 시험 `file`, `resources`(추천 링크·채널 요약) 등 메타 포함 → 소스 코드 하드코딩 없이 전체 콘텐츠 교체 가능 | 저자 직접 작성 |
| [`data/exams/cosmetic/study_md/`](../../data/exams/cosmetic/study_md/) | 교재 MD `file://` 폴백 번들 (**과목별 분할**: manifest.js + 과목별 `.js`). http에선 미사용. 과목 로드 시 해당 파일만 온디맨드 로드 | `tools/build_study_md_bundle.js` |
| [`data/exams/<key>.<hash>.js`](../../data/exams/) | 시험별 문항 번들 | `tools/build/index.js` (exams plugin) |
| [`data/exams/cosmetic/ingredients_data.<hash>.js`](../../data/) | 화장품 성분 사전 (가용/금지/제한) | `tools/build/index.js` (ingredients plugin) |
| `registry.js` → `ingredients` 메타 | 원료 DB `version`·`updatedAt`·`notice`·`history`(개정 이력 누적)·`contentHash`(내용 지문) — `content/…/원료/db_version.json`에서 병합. 사전 버전 배지·갱신 알림·Formula OS 검증 기준이 여기서 나옴 | `tools/build/index.js` |
| `src/formula-store.js` · `src/formula-rules.js` · `src/formula-check.js` · `src/formula-stability.js` | Formula OS 도메인 레이어 — 포뮬러 CRUD/한도(5개)·고객·안정성 스키마·전성분 표시 순서, 추천 규칙(BASE_TEMPLATES·고민/피부 매핑·맞춤 규칙 병합), 고시 한도 검증 엔진, 제형 안정성 체크(상 비율·상호작용·투입 단계·pH) | 수동 관리 |
| `src/batch-store.js` · `src/customer-store.js` · `src/material-ledger.js` · `src/usage-guide.js` · `src/store-utils.js` · `src/csv-utils.js` | Formula OS 업무 레이어 — 배치(조제 기록) 채번·QC·위생·스냅샷, 고객 카드·상담 이력, 원료 입고·기한·재고, 사용 안내문 생성기, 스토어 공통 헬퍼, CSV 파서·인코딩(EUC-KR 폴백)·직렬화 (FORMULA_OS_WORKFLOW_DESIGN.md) | 수동 관리 |
| `src/views/formula.js` | Formula OS 뷰 — 배합 계산기(sticky 요약·액션바, 카드형 원료 행, 접이식 고객/제조 정보), My 포뮬러, 추천 패널, 서브내비 칩, 인쇄·JSON 공유 | 수동 관리 |
| `src/views/formula-batch.js` · `formula-customer.js` · `formula-material.js` · `formula-compliance.js` · `formula-print.js` | Formula OS 패널 뷰 — 조제 기록(목록·폼·상세), 고객 관리, 원료 장부, 법규 준수 체크리스트(법령 MD 링크·체크 영속), 인쇄 빌더(기록지·라벨·안내문) | 수동 관리 |
| [`data/exams/cosmetic/id_migration.js`](../../data/exams/cosmetic/id_migration.js) | 레거시 ID → 안정 ID 일회성 매핑 | `tools/build/index.js` (id-factory) |
| [`data/audio_manifest.js`](../../data/audio_manifest.js) | 오디오 파일 경로 매니페스트 | 오디오북 파이프라인 |

> ⚠️ `data/exams/cosmetic/subjects/<key>.<hash>.js`(과목 학습 번들)는 **2026-08-24부터 런타임 MD 파싱으로 대체·제거**되었다. 디렉토리 자체도 삭제되었으며, `npm run build:data`가 재생성하더라도 앱은 로드하지 않고 배포에서도 제외(`.vercelignore`)된다.

**특징**: 시험/성분 번들은 전역 상수 JS로 `<script>` 로드만으로 즉시 사용(오프라인 핵심). 교재/카드/퀴즈는 `content/*.md`를 런타임 fetch(http, SW `Cache First`로 오프라인 대응)하거나 `file://`에선 `data/exams/cosmetic/study_md/` 과목별 분할 폴백을 사용한다.

### 4. Persistence Layer (영속성 계층)

- **`localStorage`**: 학습 진행 상황 (외운 카드, 오답, 모의고사 성적, 스트릭, 설정 등)
- **Cache Storage (Service Worker)**: App Shell + 데이터 번들의 오프라인 캐시

---

## 🧩 모듈 설계

### 스크립트 로드 순서 (의존성 그래프)

[`index.html`](../../index.html)의 로드 순서는 **의존성 방향**을 반영합니다 (하향식):

```
<head> (페인트 전 — FOUC 방지)
  1. src/theme-init.js     (클래식 — 페인트 전 테마 클래스 적용)
  2. src/pwa-install-capture.js (클래식 — beforeinstallprompt 조기 캡처 + SW 등록)

<body> 하단
  3. data/exams.js                    (클래식 — window.EXAMS_LIST 시험 레지스트리, file:// 호환)
  4. data/exams/cosmetic/id_migration.js (클래식 — 레거시→안정 ID 이관 맵)
  5. src/pwa-manifest.js              (클래식 — 활성 시험 기준 동적 manifest 링크 교체)
  6. data/exams/cosmetic/registry.js  (type=module — 기본 시험 메타, window.DATA_REGISTRY 할당)
  7. data/audio_manifest.js           (type=module — 오디오 경로, window.AUDIO_MANIFEST 할당)
  8. src/app.js                       (type=module — ESM 진입점, 모든 src/ 모듈을 내부 import)
  9. src/app-fallback.js              (defer — ESM 로드 실패 시 자동 복구, app.js와 독립 실행)

지연 로드 (초기 로드에서 제외):
  - vendor/mermaid/mermaid.min.js (3.3MB) — mermaid 블록이 있는 문서를 열 때만 주입
  - vendor/supabase/supabase.js     — 로그인/동기화 첫 사용 시에만 주입 (supabase-client.js)
  - 비기본 시험 registry.js        — 시험 전환 시 {dataRoot}/registry.js를 클래식 스크립트로 주입
```

### 모듈화 전략: "점진적 모듈화 (Progressive Modularization)"

거대한 단일 `app.js`(원래 약 4,900줄)를 한 번에 ES Modules로 전환하는 대신, **부수효과 없는 순수 로직부터 글로벌 스코프 스크립트로 점진 분리**하는 전략을 채택했습니다. `app.js`는 초기화·이벤트 위임 중심으로 축소되었고, 라우팅은 `router.js`, **29개 뷰 컨트롤러 모듈**이 `src/views/`에 분리되었습니다.

**분리 원칙**:
1. **DOM 의존성 없는 순수 로직 우선 분리** → `trainer-calc.js`(문제 생성), `utils.js`(초성 추출), `reader-format.js`(리더 포맷터)
2. **상태·영속성 로직 분리** → `state.js`
3. **뷰 컨트롤러 분리** → `src/views/` 디렉터리에 과목별/기능별 모듈 추출
4. **공통 UI 유틸 분리** → `ui-utils.js`(로딩 오버레이) — 순환 의존성 방지
5. **God Module 분할** → `app.js`에서 `pwa-install.js`/`theme-toggle.js` 추출, `textbook-reader.js`에서 `reader-audio.js` 추출, `trainer.js`에서 `trainer-calc-practice.js`/`trainer-ingredients.js` 추출, `exam-simulator.js`에서 `exam-sim-state.js`/`exam-sim-review.js` 추출
6. **재수출 패턴 제거** → `app.js`가 `daily-challenge.js`/`pomodoro.js`를 직접 import

```
[분리 완료 — src/ 루트]
app.js (초기화·이벤트 위임)          state.js (전역 상태·영속성)
router.js (SPA 라우터)               storage.js (저장소 추상화·백엔드 교체)
storage-keys.js (키 중앙 관리)       weak-items.js (약점 ID 문법·인덱스 캐시)
paths.js (경로 상수)                 exam-context.js (시험 해석·scopedKey·hasFeature)
ui-utils.js (토스트·모달·로딩)        sanitize.js (XSS 방어)
utils.js (헬퍼·shuffle)              types.js (JSDoc 타입)
data-loader.js (온디맨드 MD 로더)     markdown-parser.js (공통 MD 파서)
textbook-parser.js (교재 MD 파서)     reader-format.js (리더 포맷터+키워드 링크)
keyword-index.js (교재 셀→참조 키워드) pdf-registry.js (참조자료 레지스트리)
html-viewer.js (참조자료 뷰어)        exam-viewer.js (문제집 MD 뷰어)
manual-viewer.js (안내서/매뉴얼 뷰어)  mermaid-render.js + mermaid-utils.js
charts.js (SVG 차트)                 scratchpad.js (캔버스)
spaced-repetition.js (SM-2)          statement-tracker.js (진술 원자 추적)
questions.js (문항 스키마 검증)       study-aids.js (기출 필터·숫자표)
study-tracker.js (캘린더 추적)        sha256.js (안정 ID 해시)
web-vitals.js (성능 모니터링)         glossary-query.js (용어집 쿼리)
trainer-calc.js (계산 문제 생성)      csv-utils.js (CSV 파서·직렬화)
recommendations.js (합격 전략 추천)    command-palette.js (통합 검색 팔레트)
store-utils.js (스토어 공통 헬퍼)     formula-store.js (포뮬러 CRUD)
formula-rules.js (추천 규칙)          formula-check.js (고시 한도 검증)
formula-stability.js (제형 안정성)    batch-store.js (조제 기록)
customer-store.js (고객 카드)         material-ledger.js (원료 장부)
usage-guide.js (안내문 생성)          ui-mode.js (학습/실무 모드)
supabase-config.js (설정)            supabase-client.js (lazy init)
auth-view.js (계정 모달)             sync.js (스냅샷 동기화)
pwa-install.js (설치 프롬프트)        theme-init.js + theme-toggle.js
pwa-manifest.js (동적 매니페스트)     pwa-install-capture.js (SW 등록 캡처)
config/timing.js + cache.js          app-fallback.js (ESM 실패 복구)

[분리 완료 — src/views/ (29개)]
navigation.js (뷰 전환 유틸)         dashboard.js (대시보드)
flashcard.js (플래시카드)            quiz.js (퀴즈+복습)
daily-challenge.js (데일리 챌린지)    study-calendar.js (학습 캘린더)
textbook-reader.js (교재 리더)        reader-audio.js (오디오북)
textbook-search.js (본문 검색)       dictionary.js (성분 사전)
exam-simulator.js (모의고사)         exam-sim-state.js (시뮬 상태)
exam-sim-review.js (시뮬 리뷰)       exam-select.js (시험 선택)
trainer.js (훈련소 허브)             trainer-calc-practice.js
trainer-ingredients.js              trainer-drills.js (O/X·복수 드릴)
pomodoro.js (뽀모도로)              formula.js (Formula OS 허브)
formula-batch.js (조제 기록)         formula-customer.js (고객)
formula-material.js (원료 장부)      formula-compliance.js (법규 체크)
formula-print.js (인쇄 빌더)         glossary-renderer.js (용어집)
backup.js (백업/복원)               offline-detection.js (오프라인 감지)
event-listeners.js (이벤트 바인딩)
```

> `app.js`에 남은 함수: `startFocusSubjectStudy`(뷰 간 브릿지), 초기화/이벤트 바인딩. 라우팅은 `router.js`의 `navigateToView()`로 위임. `examIdToSubjectId`는 `exam-simulator.js`에서 정의 후 `app.js`를 통해 re-export되어 `quiz.js`가 import.

---

## 🔄 데이터 흐름

### 1. 초기 로드 흐름

```
브라우저 로드
   │
   ├─► data/*.js 로드 → 전역 데이터 상수 준비
   ├─► utils → charts → ... → state.js 로드
   │
   ▼
DOMContentLoaded
   │
   ├─► initApp()
   │     ├─► loadProgress()        ← localStorage에서 진행 상황 복원
   │     ├─► setupNavigation()     ← 탭/사이드바 이벤트 바인딩
   │     ├─► setupEventListeners()
   │     ├─► renderDashboard()     ← state + data로 첫 화면 렌더링
   │     └─► checkExamDraft()      ← 중단된 모의고사 이어하기 확인
   │
   └─► setupOrientationToggle() 등 부가 초기화 (setTimeout)
```

### 2. 학습 세션 상태 흐름 (예: 퀴즈)

```
사용자 입력 (답안 제출)
   │
   ▼
이벤트 핸들러 (app.js)
   │
   ├─► 전역 state 갱신 (메모리)
   ├─► UI 리렌더링 (DOM 조작)
   └─► saveProgress()
         │
         ▼
   localStorage 직렬화 저장
         │
         └─► updateGlobalStats() → 대시보드 통계 동기화
```

### 3. 데이터 백업/복원 흐름

- **export**: `exportData()` → 허용 키만 추출 → JSON 다운로드
- **Import**: `importData()` → **`ALLOWED_KEYS` 화이트리스트 검증** → localStorage 복원 → 새로고침
  - 악의적 키 주입으로 인한 localStorage 오염 방지 (보안 설계)

---

## 🗃️ 상태 관리 전략

### 단일 전역 상태 객체 (Single Global State)

[`src/state.js`](../../src/state.js)의 `state` 객체가 **단일 진실 공급원(Single Source of Truth)** 역할을 합니다.

```javascript
const state = {
    currentView: 'dashboard-view',   // 현재 활성 뷰

    // ── 영속화 대상 (localStorage 연동) ──
    memorizedCards: new Set(),       // 외운 카드
    weakCards: new Set(),            // 헷갈린 카드
    quizResults: {},                 // 퀴즈 결과

    // ── 세션 상태 (영속화 안 함) ──
    flashcards: { subject, currentIndex, data, ... },
    quiz:       { subject, data, correctCount, ... },
    trainer:    { limits, calc, ingredients, pomodoro, ... },
};
```

### 상태 분류 원칙

| 구분 | 예시 | 저장 위치 | 이유 |
|------|------|-----------|------|
| **영속 상태** | 외운 카드, 오답, 성적 기록 | localStorage | 세션 간 유지 필요 |
| **학습 기록** | 날짜별 카드/퀴즈/정답 수, 학습 목표 | localStorage (`study_calendar`, `study_goals`) | 캘린더/목표 달성률 추적 |
| **세션 상태** | 현재 퀴즈 진행 인덱스, 필터 | 메모리만 | 새로고침 시 초기화가 자연스러움 |
| **파생 상태** | 대시보드 통계, 차트 데이터 | 렌더 시 계산 | 원본으로부터 계산 가능 (중복 저장 방지) |

### Set 사용 근거
`memorizedCards`, `weakCards`에 `Set`을 사용하여 **O(1) 조회 + 자동 중복 제거**를 보장합니다. localStorage 저장 시에는 `Array.from()`으로 직렬화, 로드 시 `new Set()`으로 복원합니다.

---

## 🧪 멀티시험 플랫폼 구조

여러 자격시험 과목을 하나의 앱에서 병행 지원하기 위한 레지스트리 주도 구조입니다 (2026-09-20 도입, `e0ff585`).

### 시험 레지스트리
- **소스**: `content/exams.json` — 시험 엔트리(`id`, `name`, 브랜딩 `title`/`logoMain`/`logoSub`, `desc`, `icon`, `year`, `default`, `contentRoot`, `dataRoot`, `registryBundle`, `registryGlobal`, `features` 기능 플래그)
- **번들**: `data/exams.js` — `window.EXAMS_LIST` 클래식 스크립트 (`file://` 호환, `build:data` 체인에 포함)
- **완전 대칭 구조** (2026-09-22~): **기본 시험(cosmetic)을 포함한 모든 시험**이 `content/exams/<id>/` + `data/exams/<id>/`에 독립 루트 보유. `content/`·`data/` 루트에는 전역 파일(`exams.json`/`exams.js`, `audio_manifest.js`, `docs_md/` 앱 공용 문서)만 존재 — 시험 소유 파일 없음

### 시험 컨텍스트 (`src/exam-context.js`, 리프 모듈)
- `getActiveExam()`/`getExamList()` — `current_exam` localStorage 키 + `EXAMS_LIST`로 활성 시험 해석
- `contentPath(rel)`/`dataPath(rel)` — 모든 콘텐츠·데이터 경로는 활성 시험의 루트 기준으로 해석 (`src/paths.js`, `data-loader.js` 전 경로가 이를 사용)
- `selectExam(id)` — 시험 전환은 `location.reload()`로 수행해 모듈 상태·전역 캐시를 완전 리셋
- `hasFeature(name)` — 도메인 특화 기능(성분사전/계산연습/원료배합/오디오북/참조자료/뽀모도로/부록문서)을 시험별 `features` 플래그로 게이팅. HTML은 `data-feature` 속성, 동적 버튼은 `hasFeature()` 분기
- `scopedKey(key)` — 진도 localStorage 키를 `<examId>:key`로 네임스페이스. 앱 전역 키(테마·리더 설정 등 `GLOBAL_KEYS`)는 비네임스페이스 유지. `purgeLegacyStorage()`가 마이그레이션 1회에 레거시 비네임스페이스 진도 키 정리
- `examIdToSubjectId(examId)` — 모의고사/기출 시험지 id → 소유 과목 키 매핑 (약점 항목의 과목 귀속에 사용)
- `resolveLegacySubjectKey(key)` — 레거시 진도 키(`subject1` 등) → 현재 과목 키 정규화. charts.js·recommendations.js 공용 — 규칙 변경 시 이 함수만 수정

### 시험 선택/전환
- `src/views/exam-select.js` — 시험 선택 카드 뷰(`exam-select-view`). `current_exam` 미설정 **+ 등록 시험 2개 이상**일 때만 홈으로 표시 — 단일 시험 레지스트리에서는 기본 시험으로 바로 진입해 피커 생략
- 데스크톱 사이드바 푸터 + 모바일 탭 바의 "시험 전환" 버튼 → `showExamSelect()` → 카드 선택 시 `selectExam()` → 리로드. 버튼도 등록 시험 2개 이상일 때만 노출

### 레지스트리 로딩
- 기본 시험: `data/exams/cosmetic/registry.js` 정적 로드 (`window.DATA_REGISTRY`)
- 비기본 시험: `DataLoader.ensureRegistry()`가 `{dataRoot}/registry.js`를 클래식 스크립트로 동적 주입 (`DATA_REGISTRY_<examId>` 전역 — ESM export 불가라 `var` + `window` 할당 형태로 생성)

### 빌드 순회
- `tools/build/exam-targets.js` — `getExamTargets()`가 exams.json을 순회해 시험별 contentRoot/dataRoot/manifest 해석, `getSubjectMaps()`가 manifest에서 과목 매핑 파생(기존 `subject1~4` 하드코딩 테이블 대체)
- `tools/build_all_data.js` — `build:data`가 모든 시험을 `EXAM_ID`로 순회 빌드. ox/combo 드릴, exam/study_md/doc 번들, audio_manifest, citations, parser parity, question_chapters(문항→단원 매핑) 모두 시험 순회형
- 인덱스 번들: `{dataRoot}/drills/combo_index.js`(과목별 복수정답형 문항 수), `{dataRoot}/question_chapters.js`(문항id→단원 + 과목별 라인 경계) — 결과 화면 라벨/단원별 취약 분석용, `DataLoader.loadComboIndex`/`loadQuestionChapters`로 로드
- **공유 모듈 예외**: `src/pdf-registry.js`, `keyword-index.js`는 단일 공유 출력이라 기본 시험 바인딩 유지 — 비기본 시험에 참조자료 기능이 필요하면 시험별 파일 분리가 후속 과제

### 새 시험 추가 절차
1. `content/exams/<id>/`에 `manifest.json` + `references.json` + `교재/` + `문제은행/` 배치
2. `content/exams.json`에 엔트리 추가 (`contentRoot`/`dataRoot`/`registryBundle`/`registryGlobal` + 기능 플래그)
3. `npm.cmd run check:content -- --build` — 빌드 + 통합 검증 일괄. **앱 로직 변경 불필요**

---

## 🔐 계정·클라우드 동기화 (Supabase, 선택적)

> 설계안: [`SUPABASE_DESIGN.md`](SUPABASE_DESIGN.md) · SMTP/매직링크 설정: [`Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md`](Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md)

**원칙**: localStorage가 유일한 1차 저장소. Supabase는 "로그인한 사용자에게만" 붙는 선택적 레이어이며, 미설정/오프라인/비로그인 시 앱은 완전 정상 동작한다.

### 구성 요소

| 모듈 | 역할 |
|------|------|
| [`src/supabase-config.js`](../../src/supabase-config.js) | 프로젝트 URL·Publishable Key 상수 + `isSupabaseConfigured()` (플레이스홀더 감지) |
| [`src/supabase-client.js`](../../src/supabase-client.js) | lazy 초기화 — `vendor/supabase/supabase.js`(UMD)를 첫 사용 시점에 `<script>` 동적 주입 → `window.supabase.createClient`. `flowType: 'implicit'`, `persistSession`, `autoRefreshToken` 고정 |
| [`src/auth-view.js`](../../src/auth-view.js) | 계정 모달 — 이메일+PW 로그인/회원가입, `signInWithOtp` 로그인 메일(매직링크+OTP 코드 동봉), `verifyOtp`, 비밀번호 재설정(`updateUser`), 메일 재발송 60초 쿨다운 |
| [`src/sync.js`](../../src/sync.js) | 스냅샷 동기화 — `sync_snapshots` 테이블 push/pull |

### 동기화 데이터 흐름

```
쓰기 발생 (safeSetItem)
  │
  ├─ state.js _dataWriteHook → sync.js onLocalWrite(key)
  │     ├─ META_KEYS(동기화 메타 자체) 또는 비동기화 키 → 무시
  │     ├─ _applyingRemote 중 → 무시 (재귀 방지)
  │     └─ markDirty() → sync_dirty='1' → 로그인 시 2.5s 디바운스 pushSync()
  │
  └─ pushSync(): sync_snapshots upsert { user_id, exam_id, payload, updated_at, device_id }
        payload = BACKUP_KEYS(− customer_items) + daily_completed_* 동적 키

initSync() (앱 시작 시 1회)
  ├─ isSupabaseConfigured() 아니면 조용히 return
  ├─ setDataWriteHook 등록 (순환 import 방지용 콜백 패턴)
  ├─ 세션 확인 → 로그인 상태면 pullSync()
  └─ onAuthStateChange 구독: 로그인 전환 시 pullSync()
       + online 이벤트 시 dirty면 pushSync() 재시도

pullSync() (로그인 시 / "지금 동기화" 버튼)
  ├─ sync_snapshots select (user_id + exam_id 행)
  ├─ 원격 없음 → dirty면 최초 push
  ├─ remoteTs ≤ localTs → 로컬 최신, dirty면 push
  └─ 원격이 최신 → dirty면 showConfirm 충돌 확인 → applyPayload()
        화이트리스트 키만 현재 시험 네임스페이스에 기록 → 토스트 후 reload
```

### 프라이버시 설계 — 고객 PII 동기화 제외

`SYNC_EXCLUDE = { customer_items }` — 고객 카드·상담 이력은 **타인의 개인정보**이므로 페이로드·Supabase 테이블 양쪽에서 구조적으로 제외된다. 백업 파일(`BACKUP_KEYS`)과 전체 초기화(`RESET_KEYS`)에는 포함되어 로컬 관리는 정상 동작한다.

### CSP 연동

`vercel.json`의 CSP에 `connect-src 'self' https://*.supabase.co` — Supabase API 호출만 허용. UMD vendor 파일은 `'self'`라 별도 예외 불필요.

---

## 🎚️ UI 모드 (학습 ↔ 실무)

합격 후 실무 중심 사용자를 위한 네비게이션 모드 전환입니다 ([`src/ui-mode.js`](../../src/ui-mode.js)).

- **키**: `ui_mode` = `'study' | 'practice'` (GLOBAL_KEYS — 시험 무관 기기 설정)
- **게이팅**: `body.ui-mode-practice` 클래스 + `.nav-study-only`(실무에서 숨김) / `.nav-practice-only`(학습에서 숨김) 클래스로 CSS 제어
- **랜딩**: 실무 모드 초기화 시 `formula-view`로 랜딩 (`hasFeature('formula')` 게이트)
- **학습 도구 접이식**: 실무 모드에서 숨겨진 학습 메뉴를 `toggleStudyTools`로 펼침 — `ui_study_tools_open` 키 영속 + `aria-expanded` 동기화
- **진입점 이중화**: 사이드바 푸터 버튼 + 설정 패널 항목 (모바일은 사이드바가 숨겨지므로 설정 경로 필수)
- **학습 전용 뷰 가드**: `STUDY_ONLY_VIEWS` — 실무 모드에서 학습 뷰 접근 시 formula-view로 리다이렉트

---

## 🧪 Formula OS 도메인 아키텍처

> 설계안: [`FORMULA_OS_DESIGN.md`](FORMULA_OS_DESIGN.md) · 업무 플로우: [`FORMULA_OS_WORKFLOW_DESIGN.md`](FORMULA_OS_WORKFLOW_DESIGN.md) · 사용자 매뉴얼: `docs/user/formula_manual.md`

학습 앱 안에 내장된 실무 작업실. 9개 조제관리 업무 영역을 6개 패널로 묶어 `formula-view` 하나의 뷰 안에서 서브내비 칩으로 전환한다.

### 패널 구조 (허브 + 서브내비)

| 서브패널 | 스토어 | 뷰 | 주요 기능 |
|---------|--------|-----|----------|
| 배합 계산기 | `formula-store.js` | `formula.js` | 총량×배합률→투입량, 고시 한도 4상태 검증, 안정성 경고, 접이식 고객/제조 정보 |
| My 포뮬러 | `formula-store.js` | `formula.js` | 저장(5)·열기·복제·삭제, 규정 스냅샷, 전성분 표시 자동 생성 |
| 고객 관리 | `customer-store.js` | `formula-customer.js` | 고객 카드 + 상담 이력(append-only), CSV 입출력, 포뮬러·배치 역참조 |
| 조제 기록 | `batch-store.js` | `formula-batch.js` | 날짜-순번 채번(`YYYYMMDD-NN`), 처방 스냅샷, QC·위생 필드, 기록지 인쇄 |
| 원료 장부 | `material-ledger.js` | `formula-material.js` | 입고·사용기한·재고, 기한 경고 배지, 계산기 원료명 자동 매칭 |
| 법규 준수 | (체크 상태) | `formula-compliance.js` | 실무 체크리스트 + 관련 법령 MD `openExam` 링크 |

- **서브내비 칩**: 모든 패널 상단에 동일한 `formulaSubNav` 칩 바 — 패널 간 상호 이동
- **공유 컨텍스트**: 계산기의 고객/처방이 배치 폼과 안내문 생성에 재사용됨 (customerId 바인딩)
- **생성기**: `usage-guide.js` — 제형 템플릿 + 원료 주의 규칙 자동 합성
- **인쇄**: `formula-print.js` + `css/print.css` — `#formula-print-area`(화면 숨김)에 인쇄 전용 DOM 렌더 → `window.print()` → `afterprint` 정리
- **CSV**: `csv-utils.js` — EUC-KR 폴백 디코딩(엑셀 한글 깨짐 방지) + BOM 직렬화

### 스토어 공통 패턴 (`store-utils.js`)

모든 스토어 모듈이 동일한 계약을 따른다:

- `STORAGE_KEYS.<X>_ITEMS` 키에 JSON 배열로 영속 (`loadItems`/`saveItems`)
- `newId()` ID 발급, `clamp()` 입력 클램프, 스키마 정제(`sanitize*`)
- `*_LIMIT_FREE` 상수 + `canCreate()` 게이트 — 초과 시 안내 토스트
- Free 한도: **포뮬러 5 · 고객 20 · 배치 50 · 원료 30**

### 저장 스키마 개요

| 키 | 내용 | 한도 |
|----|------|------|
| `formula_items` | 포뮬러 {id, name, phase별 원료[], customer, process[], stability, 전성분} | 5 |
| `customer_items` | 고객 {id, name, 연락처, 피부, 알레르기, consults[](append-only)} | 20 — **동기화 제외** |
| `batch_items` | 배치 {id(YYYYMMDD-NN), formulaId, snapshot, qc, hygiene, producedAt} | 50 |
| `material_items` | 원료 {id, name, lot, receivedAt, useBy, stock, unit} | 30 |
| `formula_compliance` | 법규 체크리스트 체크 상태 | — |
| `formula_rules` | 사용자 맞춤 추천 규칙 (기본 규칙에 병합) | — |

---

## 🗝️ localStorage 키 체계

모든 영속 키는 [`src/storage-keys.js`](../../src/storage-keys.js)의 `STORAGE_KEYS`에 중앙 선언된다. 접근은 저장소 추상화 계층 [`src/storage.js`](../../src/storage.js)를 통한다 — `state.js`의 `safeGetItem`/`safeSetItem`(try/catch 래핑 + 시험 네임스페이스 자동 적용 + 쓰기 훅 호출)이 백엔드에 위임하는 형태. 백엔드는 `setStorageBackend()`로 교체 가능하며(기본 localStorage), 비동기 백엔드 이행 대비 `*Async` API를 병행 제공한다. 다중 키 원자적 쓰기는 `setMany`/`setJSONMany`(중간 실패 시 이전 값으로 롤백).

### 키 분류

| 분류 | 판별 | 예시 |
|------|------|------|
| **스코프드 진도 키** | `scopedKey()`가 `<examId>:` 접두사 부여 | `cosmetic:fc_memorized`, `cosmetic:quiz_results`, `cosmetic:formula_items` |
| **전역 키** | `GLOBAL_KEYS` Set — 접두사 없음 | `appTheme`, `ui_mode`, `readerFontScale`, `device_id`, `current_exam` |
| **동적 키** | 접두사 패턴 (`isDailyCompletedKey`) | `daily_completed_2026-09-24` |
| **동기화 메타** | `META_KEYS` — 쓰기 훅에서 제외 | `sync_dirty`, `sync_last_ts` |
| **세션 키** | `sessionStorage` | `__inappGuideShown` |

### 키 집합 (목적별 묶음)

| 집합 | 용도 |
|------|------|
| `BACKUP_KEYS` | 백업/복원·동기화 페이로드의 정적 키 화이트리스트 |
| `RESET_KEYS` | "진도 초기화" 시 제거할 키 (BACKUP_KEYS + 리더 위치 등) |
| `SYNC_EXCLUDE` | 동기화에서 제외 — `customer_items`(타인 PII) |
| `META_KEYS` | 쓰기 훅 재귀 방지 — 동기화 메타 키 자체 |
| `GLOBAL_KEYS` | 시험 네임스페이스에서 제외할 앱 전역 키 |

**규칙**: 새 영속 키를 추가할 때는 ① `STORAGE_KEYS`에 상수 선언 → ② 필요 시 `BACKUP_KEYS`/`RESET_KEYS`/`GLOBAL_KEYS` 등록 → ③ `data-click` 핸들러에서 `safeSetItem`으로만 쓰기 (동기화 dirty 추적이 자동 동작).

---

## 🌗 테마 시스템 (라이트/다크)

앱 전체가 **CSS 변수 기반 듀얼 테마**를 지원합니다. 단일 소스 오브 트루스(Single Source of Truth)는 `<html>` 요소의 `.light-theme` 클래스입니다.

### 구성 요소

| 구성 요소 | 위치 | 역할 |
|-----------|------|------|
| **FOUC 방지 스크립트** | [`index.html`](../../index.html) `<head>` 인라인 | 페인트 전에 `localStorage('appTheme')` 또는 `prefers-color-scheme`을 읽어 `<html>.light-theme` 클래스와 `<meta name="theme-color">`를 즉시 적용 → 테마 깜빡임(FOUC) 제거 |
| **전역 테마 API** | [`index.html`](../../index.html) 하단 인라인 | `window.AppTheme = { isLight, apply, toggle }` 노출. 테마 변경 시 `localStorage` 저장 + `themechange` 커스텀 이벤트 브로드캐스트 |
| **CSS 변수 오버라이드** | [`style.css`](../../style.css) `.light-theme` | `:root`(다크, 기본값)의 디자인 토큰을 라이트 팔레트로 재정의. `.light-theme` 하위 선택자에서만 라이트 전용 보정 규칙 추가 |
| **헤더 토글 버튼** | `#theme-toggle-btn` | 데스크톱 헤더에서 테마 전환 (해/달 아이콘) |
| **모바일 탭 토글** | `#mobile-theme-toggle` | 모바일 하단 탭 바의 "테마" 탭에서 전환 |

### 테마 결정 우선순위

```
localStorage('appTheme')  >  prefers-color-scheme: light  >  다크(기본)
```

- 사용자가 수동으로 선택하면 `localStorage`에 저장되어 이후 시스템 테마 변경을 무시
- 수동 선택이 없으면 시스템 테마 변경(`matchMedia('(prefers-color-scheme: light)').change`)을 실시간 추적

### 모듈 간 테마 동기화

- 테마 변경 시 `document.dispatchEvent(new CustomEvent('themechange'))`로 브로드캐스트
- 교재 리더([`src/app.js`](../../src/app.js) `applyReaderThemeClass()`)는 `themechange` 이벤트를 구독하여 `.reader-light-theme` 클래스를 즉시 동기화
- **설계 결정**: 과거 리더 전용 `readerLightTheme` 로컬 상태를 제거하고 전역 테마로 통합 → 두 테마가 어긋나는 버그 원천 차단

---

## 📴 PWA & 오프라인 전략

### Service Worker 캐시 계층 ([`sw.js`](../../sw.js))

리소스 특성별로 **7단계 분기 전략**을 적용합니다.

| 우선순위 | 대상 | 전략 | 근거 |
|:---:|------|------|------|
| 1 | 네비게이션 (`navigate`) | **Cache First** | HTML과 JS 모듈이 항상 동일한 `CACHE_VERSION` 캐시에서 서빙되도록 보장. `Network First`를 쓰면 구 SW가 신버전 HTML(네트워크) + 구버전 JS(캐시)를 섞어 반환하여 ESM import 그래프가 붕괴하는 **캐시 스큐** 발생 (v39 수정, 상세 후술) |
| 2 | 시험/성분 데이터 번들 (`data/exams/<id>/exams/*.hash.js`, `data/exams/<id>/ingredients_data.*.js`) · 교재 원본 (`content/**/*.md`) | **Cache First** | 해시 파일명/정적 MD로 자연 갱신, 오프라인 학습 핵심. 교재 MD는 최초 fetch 시 캐시됨 |
| 3 | 외부 CDN (Google Fonts) | **Stale-While-Revalidate** | 외부 리소스 안정성 확보. FontAwesome은 2026-08-24부터 자체 호스팅([`vendor/fontawesome/`](../../vendor/fontawesome/))으로 전환하여 CDN 의존 제거, App Shell 프리캐시에 포함 |
| 4 | MP3 오디오 (302MB) | **네트워크 직행 (바이패스)** | 대용량 미디어는 캐시 제외 (저장공간 보호) |
| 5 | `/src/` 하위 JS 모듈 | **Cache First** | ESM import 그래프는 한 모듈이라도 버전이 어긋나면 전체가 드랍됨. `Network First`를 쓰면 모바일 불안정 네트워크에서 일부는 신버전(네트워크), 일부는 구버전(캐시)이 섞여 import 그래프 붕괴. `Cache First` + `SHELL_ASSETS` 프리캐시로 동일 버전 파일만 일관 서빙 (v38부터 적용) |
| 6 | CSS (`*.css`) | **Cache First** | 배포 전환 순간 "구버전 HTML(cacheFirst) + 신버전 CSS(networkFirst)" 혼합으로 화면 깨짐 방지. `/src/` JS와 동일 사유로 `cacheFirst` + `SHELL_ASSETS` 프리캐시로 세대 일관성 확보 (2026-08-26 수정) |
| 7 | 그 외 JS (`*.js`) | **Network First** | 온라인이면 항상 최신 배포본 제공, 오프라인이면 캐시 폴리백. `CACHE_VERSION` 범프를 깜빡해도 모바일에 구버전이 남지 않도록 함 |
| 8 | 그 외 App Shell (아이콘/이미지 등) | **Stale-While-Revalidate** | 빠른 표시 + 백그라운드 갱신 |

### 캐시 버전 관리
- `CACHE_VERSION` 상수로 캐시 네임스페이스 관리 (빌드 시 자동 갱신)
- **빌드 타임 자동 치환**: `tools/build/stamp-sw-version.js`가 빌드 완료 시 `CACHE_VERSION`을 `${prefix}-${YYYYMMDD}-${gitShort}` 형태로 자동 갱신 → 수동 관리 불필요
- **배포 시 버전을 올리면 구 캐시 자동 정리** → 모바일 구버전 고착(Stale Cache) 문제 방지
- `SHELL_ASSETS`에는 [`src/utils.js`](../../src/utils.js), [`src/trainer-calc.js`](../../src/trainer-calc.js) 등 분리된 모듈이 모두 프리캐시에 포함됨
- `data/exams/cosmetic/registry.js`, `data/audio_manifest.js`도 프리캐시에 포함 (2026-08-25, window 전역 참조 방식 전환으로 모듈 그래프에서 분리되어 별도 캐싱 필요)

### 캐시 스큐 방지 설계 (v39, 2026-08-26)

**문제**: Chrome(SW 활성)에서만 앱이 실패하고, WebView(SW 없음)에서는 정상 작동하는 현상.

**근본 원인**: navigation(HTML)에 `Network First`를 적용한 것이 핵심 원인.
- 구 SW(v38)가 페이지를 제어하는 동안 방문하면:
  1. `index.html`은 `Network First` → **신버전 HTML** 획득
  2. `/src/*.js`는 `Cache First` → **구버전 JS** 서빙
  3. 신버전 HTML + 구버전 JS = **캐시 스큐** → ESM import 그래프 붕괴 → 앱 초기화 실패
- WebView는 SW가 없으므로 모든 요청이 네트워크 직행 → 신 HTML + 신 JS = 정상 작동
- PC 설치 PWA는 브라우저 탭이 트리거한 SW 업데이트 완료 후 실행되므로 스큐를 겪지 않음

**해결**:
1. **navigation을 `Cache First`로 전환**: HTML과 JS가 항상 동일한 `CACHE_VERSION` 캐시에서 서빙 → 세대 내 불일치 원천 차단. 새 SW install + `skipWaiting()` + `controllerchange` 리로드 후 신버전 캐시로 일괄 전환.
2. **`precacheResilient()` 도입**: `cache.addAll()`의 원자성(all-or-nothing)을 버리고 `Promise.allSettled()` + 개별 `cache.add()`로 변경. `addAll`은 하나라도 404면 전체 reject → `skipWaiting()` 미실행 → `cacheFirst` 환경에서 사용자가 구버전에 영영 갇힘. `allSettled`는 일부 실패해도 SW 활성화 보장, 실패분은 `cacheFirst`의 네트워크 폴백으로 온디맨드 자가 치유.
3. **`verify-shell-assets.js` CI 검증**: 배포 전 `SHELL_ASSETS`/`DATA_ASSETS`의 모든 파일이 저장소에 존재하는지 확인. `precacheResilient`이 누락을 조용히 넘기므로 CI에서 사전 차단.

**검증 결과** (모바일 Chrome 실기기):
- `PL=1` (리로드 루프 없음), `CC=1` (SW 교체 1회, 자동 리로드 없음)
- `init=1325ms` (앱 정상 초기화), `nav=9/11` (메뉴 정상 렌더링)
- PWA 설치까지 정상 완료

### 오프라인 감지 설계
판정은 **억제 우선(suppress-first)** 원칙을 따릅니다 — "실제로 오프라인일 때만" 배너를 띄우고, 모호하면 띄우지 않습니다.

- **1차 게이트 — `navigator.onLine` 억제 신뢰**: `true`이면 프로브 없이 온라인으로 간주.
  - 이 API는 "온라인인데 `false`"로 오탐하는 경우는 있어도 "오프라인인데 `true`"로 허위 보고하는 경우는 사실상 없으므로, **`true`는 신뢰(억제 방향), `false`는 불신(재확인)** 하는 비대칭 신뢰를 적용합니다.
  - 이 한 줄이 모바일 콜드스타트/저속망에서 프로브가 일시 실패하더라도 가짜 배너가 뜨는 것을 원천 차단합니다. (v11)
- **2차 게이트 — 실제 도달 프로브**: `onLine === false`일 때만 **same-origin** `./ping.txt?_probe={timestamp}` fetch 수행.
  - 과거 `www.gstatic.com/generate_204`(제3자, 지역 차단 시 오탐) → `manifest.webmanifest`를 거쳐 전용 `ping.txt`(내용 `1`)로 정착.
  - `cache: 'no-store'`는 일부 웹뷰/보안정책과 충돌해 fetch 자체가 실패하는 사례가 있어 제거하고, **쿼리스트링 타임스탬프로만 캐시를 우회**합니다.
  - `?_probe=` 요청은 Service Worker가 `event.respondWith(fetch(request))`로 **직접 네트워크에 프록시**하여 반환합니다 ([sw.js](../../sw.js)). 단순 `return`(바이패스)로 두면 WebKit standalone 샌드박스가 `respondWith` 없는 fetch를 차단해 프로브가 항상 실패하는 문제가 있어 v12에서 변경되었습니다. 캐시 저장은 하지 않으므로 캐시 오염은 발생하지 않습니다.
- **3중 오탐 방지 (standalone 감지 + 연속 실패 임계 + 타임아웃 + 슬립 유예)** (v13):
  - **Standalone 감지**: `display-mode: standalone` 미디어쿼리 + iOS `navigator.standalone`으로 설치형 PWA 여부를 판별. 설치형은 `onLine === false` 오탐 빈도가 높아 판정을 더 보수적으로 합니다.
  - `FAIL_THRESHOLD = isStandalone ? 4 : 3`: 프로브가 **연속 3회(일반)/4회(standalone)** 실패해야 오프라인 확정(미확정 시 2.5초 후 재시도).
  - `PROBE_TIMEOUT = 8000ms`: 모바일 저속망 여유분(4s→6s→8s로 단계적 상향).
  - **슬립 복귀/콜드스타트 유예**: 마지막 화면 활성화(`visibilitychange`) 또는 `offline` 이벤트 후 **15초(`WAKE_GRACE_MS`)** 이내 실패는 통신 칩셋/Wi-Fi 재연결 중일 수 있어 `isOfflineMode`와 무관하게 failStreak를 쌓지 않고 3초 후 재시도. 첫 프로브는 5초 지연.
- **적응 주기**: 온라인 정상 시 30초, 오프라인 확정 후 복구 감시는 5초로 단축. `online` 이벤트는 즉시 배너 해제(failStreak 초기화 + `hideBanner()`), `offline`/`visibilitychange` 이벤트는 wake 타임스탬프 갱신 후 즉시 재프로브.

### PWA 설치 프롬프트 설계

`beforeinstallprompt` 이벤트 캡처와 설치 버튼 동작을 담당하는 설계 요소들입니다.

| 구성 요소 | 위치 | 역할 |
|-----------|------|------|
| **조기 캡처 스크립트** | [`src/pwa-install-capture.js`](../../src/pwa-install-capture.js) `<head>` 클래식 스크립트 | `beforeinstallprompt` 이벤트를 최대한 빨리 캡처하여 `window.__deferredPrompt`에 저장. 동시에 SW를 조기 등록하여 Android Chrome이 PWA 설치 가능 판정을 내릴 수 있도록 함 |
| **설치 버튼 UI** | `#pwa-install-btn` (`index.html`) | `beforeinstallprompt` 캡처 시 표시. 클릭 시 `deferredPrompt.prompt()` 호출 |
| **설치 안내 모달** | `#pwa-install-modal` (`index.html`) | `deferredPrompt`가 null일 때 플랫폼별 수동 설치 안내 (Android/iOS/generic/inapp 분기) |
| **진단 패널** | `#pwa-diagnostics` (`index.html`) | `beforeinstallprompt` 미발생 시 원인 진단 정보 화면 표시 (SW 상태, display-mode, manifest 검증 등) |
| **인앱 브라우저 감지** | `detectPlatform()` ([`src/app.js`](../../src/app.js)) | UA 기반 WebView/인앱 브라우저 감지 (`wv)` 플래그, KakaoTalk, Instagram, Facebook, LINE, Twitter, Snapchat). 감지 시 "Chrome으로 열기" 안내 모달 자동 표시 |

**설계 결정사항**:
- SW 등록을 `app.js`(deferred module)가 아닌 `pwa-install-capture.js`(클래직 스크립트, `<head>`)에서 수행 → Android Chrome이 SW 활성화 상태를 빨리 인식하여 `beforeinstallprompt` 발생 조건 충족
- SW 업데이트 시 `updatefound`/`statechange`/`controllerchange` 3단계 추적 토스트 팝업으로 진행 상황 표시 (v207)
- `manifest.webmanifest`의 `Content-Type`을 `vercel.json`에서 `application/manifest+json; charset=utf-8`으로 명시 → Android Chrome의 엄격한 Content-Type 검사 대응
- 인앱 브라우저(WebView)는 구조적으로 `beforeinstallprompt`를 발생시키지 않으므로, 감지 시 "Chrome으로 열기" 안내만 제공 (코드 수정으로 해결 불가능한 환경적 제약)

---

## ⚙️ Service Worker 동작 메커니즘

Service Worker(`sw.js`)는 본 애플리케이션의 오프라인 지원과 캐시 일관성을 담보하는 핵심 컴포넌트입니다. 동작 메커니즘을 수명 주기, 요청 가로채기, 캐시 스큐 방지, 자가 복구의 4계층으로 설명합니다.

### 1. 수명 주기 (Lifecycle)

```
[최초 방문]
  pwa-install-capture.js → navigator.serviceWorker.register('./sw.js')
     │
     ▼
  install 이벤트
     ├─ precacheResilient(SHELL_CACHE, SHELL_ASSETS)  ← App Shell 프리캐시
     ├─ precacheResilient(DATA_CACHE, DATA_ASSETS)    ← 데이터 번들 프리캐시
     └─ self.skipWaiting()  ← 대기 없이 즉시 활성화 (개별 실패해도 항상 실행)
         │
         ▼
  activate 이벤트
     ├─ 구버전 캐시 삭제 (cosmetic-pass-* 중 현재 버전이 아닌 것)
     ├─ pruneStaleDataBundles()  ← 레지스트리가 더 이상 참조하지 않는 구 해시 번들 선별 삭제
     └─ self.clients.claim()  ← 기존 탭을 즉시 제어
         │
         ▼
  fetch 이벤트 활성화 (모든 요청 가로채 시작)

[배포 후 재방문]
  pwa-install-capture.js → reg.update() 강제 확인
     │
     ▼
  브라우저가 sw.js 바이트 비교 → 변경 감지 → updatefound 이벤트
     ├─ 🟢 토스트 팝업: "새 버전 확인 중..."
     │
     ▼
  새 SW install (installing → installed)
     ├─ 새 CACHE_VERSION 캐시에 신버전 자산 프리캐시
     ├─ statechange(installed) → 🟢 토스트: "새 버전 다운로드 완료 — 적용 준비 중..."
     ├─ skipWaiting() → 즉시 activate
     ├─ statechange(activating) → 🟢 토스트: "새 버전 적용 중..."
     ├─ 구버전 캐시 전체 삭제
     └─ controllerchange 이벤트
          ├─ 🟢 토스트: "새 버전 적용 완료 — 페이지를 새로고침합니다." (600ms 표시)
          └─ 페이지 리로드 → 신버전 일관 서빙
```

**SW 업데이트 진행 팝업** (v207 도입):
- `pwa-install-capture.js`에서 `updatefound` → `statechange` → `controllerchange` 3단계를 추적하여 하단 중앙 토스트 팝업 표시
- 비침습적: z-index 최고, 자동 페이드아웃 5초, 최초 등록 시 미표시 (업데이트 시에만)
- `document.body` 미생성 시 `DOMContentLoaded`까지 대기 (`<head>` 실행 대응)
- `reg.update()`로 페이지 로드마다 즉시 업데이트 확인 (브라우저 기본 ~24h 대기 불필요)

**`precacheResilient()`의 역할** (v39 도입):
- `cache.addAll()`은 원자성(all-or-nothing)을 가져 하나라도 404면 전체 reject → `skipWaiting()` 미실행
- `Promise.allSettled()` + 개별 `cache.add()`로 변경 → 일부 실패해도 SW 활성화 보장
- 실패분은 `cacheFirst`의 네트워크 폴백으로 온디맨드 자가 치유 (온라인 한정)

### 2. 요청 가로채기 흐름 (Fetch Interception)

모든 GET 요청은 `sw.js`의 fetch 핸들러를 통과하며, 요청 유형별로 8단계 분기 전략이 적용됩니다:

```
요청 도착
  │
  ├─ _probe 파라미터? ──► 네트워크 직행 (오프라인 감지 프로브, 캐시 불가)
  │
  ├─ 오디오/대용량 미디어? ──► 네트워크 직행 (캐시 제외, 저장공간 보호)
  │
  ├─ 외부 CDN (Google Fonts)? ──► Stale-While-Revalidate (캐시 즉시 + 백그라운드 갱신)
  │
  ├─ cross-origin? ──► 네트워크 직행 (동일 출처만 처리)
  │
  ├─ navigate (HTML)? ──► Cache First (SHELL_CACHE)
  │     캐시 우선 → 없으면 네트워크 → 캐시 저장 → 오프라인 시 index.html 폴백
  │
  ├─ /data/ 경로?
  │     ├─ registry.js? ──► Network First (DATA_CACHE) — 최신 메타 확인
  │     └─ 그 외? ──► Cache First (DATA_CACHE) — 해시 파일명으로 자연 갱신
  │
  ├─ *.md? ──► Cache First (DATA_CACHE) — 교재/문제은행/참조자료 MD (배포 간 유지)
  │
  ├─ /ref_md/*.html? ──► Cache First (DATA_CACHE) — 배포 간 유지 (body-only 참조자료)
  │
  ├─ /src/*.js? ──► Cache First (SHELL_CACHE) — ESM 모듈 일관성 보장
  │
  ├─ *.css / *.js? ──► Network First (SHELL_CACHE) — 최신 우선, 오프라인 시 캐시
  │
  └─ 그 외 (아이콘/이미지)? ──► Stale-While-Revalidate (SHELL_CACHE)
```

### 3. 캐시 스큐 방지 메커니즘 (v39 핵심 설계)

**문제 시나리오** (v38 이전, navigation이 Network First일 때):

```
구 SW(v38) 활성 중, 신버전 배포 후 사용자 방문
  │
  ├─ index.html 요청 → Network First → 네트워크에서 신버전 HTML 획득
  ├─ src/app.js 요청 → Cache First → 구 캐시(v38)에서 구버전 JS 서빙
  │
  └─ 신버전 HTML + 구버전 JS = 캐시 스큐
       └─ ESM import 그래프 붕괴 → 앱 초기화 실패 (Chrome에서만 발생)
```

**해결 메커니즘** (v39, navigation을 Cache First로 전환):

```
구 SW(v38) 활성 중, 신버전 배포 후 사용자 방문
  │
  ├─ index.html 요청 → Cache First → 구 캐시(v38)에서 구버전 HTML 서빙
  ├─ src/app.js 요청 → Cache First → 구 캐시(v38)에서 구버전 JS 서빙
  │
  └─ 구버전 HTML + 구버전 JS = 동일 세대 → 구버전 앱 정상 작동 ✅

  (백그라운드에서 새 SW install 완료 후)
  │
  ├─ controllerchange → 페이지 리로드
  │
  ├─ index.html 요청 → Cache First → 신 캐시(v39)에서 신버전 HTML 서빙
  ├─ src/app.js 요청 → Cache First → 신 캐시(v39)에서 신버전 JS 서빙
  │
  └─ 신버전 HTML + 신버전 JS = 동일 세대 → 신버전 앱 정상 작동 ✅
```

**핵심 원리**: HTML과 JS가 **항상 동일한 `CACHE_VERSION` 캐시에서 서빙**되므로, 세대 내 불일치가 원천 차단됩니다. 업데이트 지연은 최대 1 page load 분량입니다.

**왜 WebView/PC PWA에서는 문제가 없었나**:
- **WebView**: SW가 없음 → 모든 요청이 네트워크 직행 → 항상 신버전 일관 서빙
- **PC 설치 PWA**: 브라우저 탭이 SW 업데이트를 트리거한 후 실행되므로, 이미 신 SW가 활성화된 상태

### 4. 캐시 전략 구현체

| 전략 | 함수 | 동작 |
|------|------|------|
| **Cache First** | `cacheFirst()` | 캐시 조회 → 있으면 반환, 없으면 네트워크 fetch → 캐시 저장 → 반환. 오프라인 시 `offlineFallback()` |
| **Network First** | `networkFirst()` | 네트워크 fetch → 성공 시 캐시 저장 + 반환, 실패 시 캐시 폴백. 오프라인 시 `offlineFallback()` |
| **Stale-While-Revalidate** | `staleWhileRevalidate()` | 캐시 즉시 반환 + 백그라운드에서 네트워크 fetch → 캐시 갱신. 캐시 없으면 네트워크 대기 |

`offlineFallback()`: 네비게이션 요청이면 캐시된 `index.html` 반환, 그 외는 `Response.error()`.

### 5. 자가 복구 메커니즘 (app-fallback.js)

ESM 모듈 로드 실패 시 자동 복구를 담당하는 독립 스크립트입니다. `app.js`(type=module)와 분리되어 클래식 `<script defer>`로 로드됩니다.

```
app-fallback.js 폴링 시작 (400ms 간격, 15s 데드라인)
  │
  ├─ window.__APP_INITIALIZED 감지? ──► 정상 → 폴링 종료, 리로드 카운터 정리
  │
  └─ 15s 데드라인 도달, 초기화 안 됨
       │
       ├─ 1차 (reload count = 0): SW update + 리로드
       │     일시적 네트워크 문제일 수 있음 → 가벼운 갱신 시도
       │
       ├─ 2차 이후 (reload count ≥ 1): 하드 리셋 + 리로드
       │     모든 Cache Storage 삭제 + SW 등록 해제 → 캐시 스큐 확실히 해소
       │
       └─ 3회 초과 실패: 수동 복구 오버레이 표시
             "캐시 정리 후 다시 시도" 버튼 → hardReset() + 리로드
```

**설계 원칙**:
- **독립 실행**: ESM import 그래프가 전체 드랍되어도 이 스크립트는 실행됨 (클래식 스크립트)
- **오탐 방지**: 정상 초기화 감지 시 즉시 종료 → 불필요한 리로드 차단
- **단계적 복구**: 가벼운 갱신 → 하드 리셋 → 수동 복구 순으로 부작용 최소화
- **세션 스토리지 카운터**: `sessionStorage`로 리로드 횟수 추적 → 무한 루프 방지 (최대 3회)

### 6. CI 검증 (verify-shell-assets.js)

`precacheResilient`이 개별 실패를 조용히 넘기므로, CI에서 배포 전 사전 검증을 수행합니다:

- `SHELL_ASSETS` / `DATA_ASSETS`에 나열된 모든 파일이 저장소에 존재하는지 확인
- 누락 발견 시 `exit code 1`로 CI 실패 → 배포 차단
- `npm run verify:assets` 또는 `node tools/verify-shell-assets.js`로 실행

### 7. 문제은행 인용 링크 시스템 (exam-viewer.js)

문제은행 MD 파일 내의 교재 인용 링크(`[교재: L####](<../교재/.../*.md#L####>)`)를 클릭하면, 브라우저 네비게이션 없이 오버레이 내에서 교재 파일을 열고 해당 라인을 하이라이트하는 시스템입니다.

#### 구성 요소

| 구성 요소 | 위치 | 역할 |
|-----------|------|------|
| **`addLineNumbers` 옵션** | [`src/markdown-parser.js`](../../src/markdown-parser.js) | `parseMarkdown` 호출 시 `addLineNumbers: true`로 각 HTML 요소에 `data-md-line="N"` 속성 부여 (N = MD 원본 라인 번호) |
| **`joinWraps` 옵션** | [`src/markdown-parser.js`](../../src/markdown-parser.js) | ref_md 전용. PDF 고정폭 wrap으로 문장 중간에 잘린 연속줄을 이전 `<p>`/`<li>`에 병합. 연속줄은 `<span data-md-line>`으로 감싸 L#### 인용이 원줄 위치에 도착. H1 제목과 동일한 반복 단독줄(러닝헤더)은 투명 스킵. `exam-viewer`/`html-viewer`가 경로에 `ref_md` 포함 시 자동 적용. 품질 감사: `npm run check:refmerge` |
| **인용 링크 클릭 인터셉트** | [`src/exam-viewer.js`](../../src/exam-viewer.js) `_renderBody` | 뷰어 내 `.md` 링크 클릭 시 `e.preventDefault()` 후 `openExam(mdPath, lineNum)` 호출 |
| **`_scrollToLine`** | [`src/exam-viewer.js`](../../src/exam-viewer.js) | `data-md-line` 속성 기반으로 정확한 라인 매칭 → `scrollIntoView({ block: 'center' })` + 펄스 하이라이트 |
| **네비게이션 스택** | [`src/exam-viewer.js`](../../src/exam-viewer.js) `_navStack` | 인용 링크 이동 시 현재 문서 경로와 스크롤 위치를 push, "뒤로" 버튼으로 pop |
| **sessionStorage 캐시** | [`src/exam-viewer.js`](../../src/exam-viewer.js) | 렌더링된 HTML과 MD 원문을 캐시(v5), 재열람 시 즉시 표시 + 라인 스크롤 지원 |

#### 데이터 흐름

```
문제집 뷰어에서 [교재: L1241] 링크 클릭
  │
  ├─ 클릭 인터셉트: e.preventDefault()
  ├─ 상대경로 해결: new URL(href, baseDir) → 절대경로
  ├─ _navStack.push({ 현재 mdPath, scrollPos })
  │
  └─ openExam(교재path, 1241)
       │
       ├─ 캐시 hit? → _renderBody(캐시된 HTML)
       ├─ 캐시 miss? → _loadMd → _mdToHtml(addLineNumbers:true) → 캐시 저장 → _renderBody
       │
       └─ _scrollToLine(1241, mdText)
            │
            ├─ [data-md-line="1241"] 요소 검색
            ├─ 정확 매칭? → scrollIntoView + 하이라이트
            ├─ 없으면 가장 가까운 이전 라인 요소
            └─ 테이블? → 테이블 내 가장 가까운 행(row)으로 스크롤
```

#### 하이라이트 CSS

- `exam-line-highlight` 클래스: 노란색 배경(`rgba(250,204,21,.35)`), 펄스 애니메이션(1.5s × 2회), 5초 후 자동 제거
- `scrollIntoView({ behavior: 'smooth', block: 'center' })`로 대상 요소를 화면 중앙에 배치

---

## 📱 반응형 & 모바일 설계

### 적응형 네비게이션 (Adaptive Navigation)

| 화면 | 네비게이션 | 구현 |
|------|-----------|------|
| **데스크톱** (>768px) | 좌측 사이드바 | `.sidebar` 표시, `.mobile-tab-bar` 숨김 |
| **모바일** (≤768px) | 하단 탭 바 | `.sidebar` 숨김, `.mobile-tab-bar` 표시 (10개 메뉴, 가로 스크롤) |

### 모바일 최적화 기법

1. **동적 뷰포트 + 실측 보정**: `100dvh` 사용 → 모바일 브라우저 주소창 표시/숨김에 따른 레이아웃 점프 방지.
   단, 설치형 PWA 콜드 스타트에서 `dvh`가 실제 화면보다 크게 측정되는 사례가 있어(스플래시~시스템 인셋 확정 사이),
   `initViewportHeight()`가 `visualViewport.height`를 `--app-height` CSS 변수로 반영하고
   `.app-container { height: var(--app-height, 100dvh) }`로 사용 — `resize`/`orientationchange`/`visualViewport.resize`에 자동 갱신.
   과대측정 시 `.main-content` 끝이 화면 밖으로 밀려 스크롤 끝 콘텐츠가 탭 바에 가려지는 실제 장애를 유발했다
2. **Safe Area 대응**: `env(safe-area-inset-bottom)` → iPhone 홈 인디케이터 영역 자동 확보
3. **하단 탭 바 겹침 방지**: `.main-content`는 `padding-bottom: calc(80px + safe)`(탭 바 70px + 여유 10px)와
   `scroll-padding-bottom`을 적용 — 스크롤 끝 콘텐츠와 포커스/`scrollIntoView` 요소가 탭 바 밑으로 들어가지 않음.
   뷰 내 `position:fixed` 하단 요소(back-to-top, 배너, 토스트, 플로팅 버튼)도 `bottom: calc(70px + safe)` 이상으로 배치 필수 —
   `bottom: 0~2rem`이면 탭 바(z 1400)에 완전히 가려짐
4. **스크롤 위치 복원**: 뷰 전환 시 `saveScrollPosition()`/`restoreScrollPosition()`으로 이전 위치 기억
5. **터치 타겟**: 최소 44×44px 터치 영역 확보
6. **그리드 종열 전환**: 데스크톱 다열 그리드(성적 분석 3열 등) → 모바일 세로보기에서 `1fr` 단일 열로 자동 전환

### CSS 설계 원칙
- **CSS 변수 기반 디자인 토큰**: `--color-primary`, `--bg-card`, `--radius-md` 등으로 테마 일관성 유지
- **모바일 미디어 쿼리는 파일 후반부 배치**: CSS 캐시케이드 우선순위 확보 (동일 특이성 시 나중 선언이 승리)
- **인라인 스타일 오버라이드 패턴**: HTML 인라인 `grid-template-columns` 등은 모바일에서 `[style*="..."]` 속성 선택자 + `!important`로 재정의

### 하드코딩 색상 예외 허용 목록 (CSS 변수 적용 불가/의도적)

다음 파일들은 CSS 변수 대신 고정 색상값을 사용하며, 정리 대상이 아님:

| 파일 | 사유 |
|------|------|
| `src/app-fallback.js` | 초기 로드 시 DOM 미구성 상태에서 실행 — `getComputedStyle` 호출 불가 |
| `src/theme-init.js`, `src/theme-toggle.js` | 테마 초기화 자체 — CSS 변수 정의 전 실행 |
| `src/mermaid-utils.js` | Mermaid 테마 정의 자체 — Mermaid 라이브러리에 색상값 전달 |
| `src/html-viewer.js` | 외부 콘텐츠 격리 스타일링 — 독립적인 색상 체계 |
| `src/reader-format.js` | GitHub 스타일 코드 블록 테마 — 고정 스타일 매칭 필요 |
| `src/views/textbook-reader.js` | 코드 블록 하이라이트 — reader-format.js와 동일한 고정 색상 |
| `src/exam-viewer.js`, `src/manual-viewer.js` | 인쇄용 고정 색상 — `@media print` 대응 |

---

## 🔒 보안 설계

본 프로젝트는 사용자 입력이 교재 검색, 백업 복원, 캔버스 등 다양한 경로로 유입되므로 다음 방어 계층을 둡니다.

### 1. XSS 방어 ([`src/sanitize.js`](../../src/sanitize.js))
- 사용자 데이터를 DOM에 삽입할 때 텍스트 정제(sanitize) 적용
- 신뢰할 수 있는 코드 생성 HTML(숫자 + `<strong>` 등)만 `innerHTML` 허용, raw 사용자 입력은 이스케이프

### 1b. 외부 HTML sanitize ([`src/html-viewer.js`](../../src/html-viewer.js))
- fetch한 참조자료 HTML을 `innerHTML` 삽입 전 DOMParser 기반 sanitize 수행 (외부 라이브러리 없음)
- `<script>` 요소 제거, `on*` 이벤트 핸들러 속성 제거, `javascript:` URI 제거 (`href`/`src`/`action`/`formaction`)

### 2. 백업 복원 화이트리스트
- `importData()`에서 `ALLOWED_KEYS`에 정의된 키만 localStorage에 복원
- 악성 JSON 백업 파일로 인한 스토리지 오염/스크립트 키 주입 방지

### 3. Content 보안 (CSP)
- 외부 리소스는 신뢰된 CDN(Google Fonts)으로 제한. FontAwesome은 자체 호스팅으로 전환하여 외부 폰트/스타일 출처를 축소 (CSP `font-src`/`style-src`에서 cdnjs 제거됨)
- Service Worker의 캐시 대상을 명시적 화이트리스트로 관리
- **`script-src 'self'` (inline script 차단)**: 인라인 `onclick`/`oninput` 속성은 CSP에 의해 브라우저에서 실행 차단됨. 이를 우회하기 위해 **이벤트 위임 패턴** 사용:
  - `data-click="핸들러명"` + `data-arg="단일인자"` 또는 `data-args='["인자1", 인자2]'` (JSON 배열, 다중/타입 인자)
  - `data-input="핸들러명"` (range 슬라이더 등 input 이벤트용, `el.value`를 인자로 전달)
  - [`src/app.js`](../../src/app.js)의 `resolveDelegatedHandler()`가 `window`에서 점 표기 네임스페이스(`ManualViewer.openManual` 등)로 함수를 찾아 실행
  - 위임 참조되는 모든 핸들러는 `app.js` 하단에서 `window.<name> = <name>;`로 브리지 노출 필수 (ESM 모듈 스코프 격리 해결)
  - **회귀 가드**: [`tests/unit/delegation-guard.test.js`](../../tests/unit/delegation-guard.test.js)가 인라인 `on*=` 속성 잔존 및 `window` 브리지 누락을 자동 검출

---

## 🛡️ 강건성 가이드라인 (Robustness Guidelines)

> 2026-09-12 강건성 리뷰(20개 항목 수정)에서 확립된 코딩 규칙. 신규 코드 작성 시 준수 필수.

### 1. 배열 접근 시 bounds 체크
- `array[index]` 접근 후 반드시 `if (!item) return;` 또는 `if (!item) { showToast(...); return; }` 추가
- 특히 `quizState.data[currentIndex]`, `simState.data.questions[currentIndex]` 등 상태 기반 인덱스 접근

### 2. window 전역 데이터 접근 시 존재 체크
- `window.EXAM_DATA[examId]` → `window.EXAM_DATA && window.EXAM_DATA[examId]` 가드
- `window.DATA_REGISTRY` → `typeof window !== 'undefined' && window.DATA_REGISTRY` 가드
- `parseInt()` 결과 → `isNaN()` 체크

### 3. localStorage 접근 시 try/catch
- `localStorage.setItem/getItem/removeItem`은 Safari 프라이빗 모드, 용량 초과, 스토리지 비활성 환경에서 예외 발생
- `state.js`의 `safeGetItem`/`safeSetItem` 래퍼 사용 권장
- 직접 접근 시 반드시 `try { ... } catch (e) { /* noop */ }` 래핑

### 4. DOM 요소 접근 시 null 체크
- `document.getElementById('id').classList.add(...)` → `const el = document.getElementById('id'); if (el) el.classList.add(...);`
- 특히 `exam-simulator.js` 등 뷰 전환 시 다수 DOM 요소 동시 조작

### 5. Promise 체인에 .catch() 추가
- `.then()` 체인에는 항상 `.catch(err => console.error(...))` 추가
- unhandled rejection은 런타임 에러 안전망에서 감지되지만, 명시적 catch로 원인 추적 용이

### 6. 무한 루프 안전장치
- `while (condition)` 루프에는 카운터 기반 종료 조건 추가 (`_safety < 100`)
- 정규식 `exec` 루프는 `g` flag로 종료 보장

### 7. JSON.parse 결과 검증
- `JSON.parse(raw)` 결과가 `null`이거나 예상 타입이 아닐 수 있음
- `if (!data || typeof data !== 'object')` 검증 후 사용

---

## ⚙️ 데이터 파이프라인 (빌드 타임 + 런타임)

시험 문항·성분 사전은 빌드 타임에 해시드 번들로 생성하고, **교재 본문·카드·퀴즈는 런타임에 `content/*.md`를 직접 파싱**합니다(재빌드 없이 최신 반영).

```
[원본 콘텐츠]                [변환]                              [산출/소비]
content/exams/cosmetic/manifest.json ──► tools/build/index.js        ──► data/exams/cosmetic/registry.js (과목목록·시험·성분 메타)
content/exams/**/*.md       ──► (exams plugin)             ──► data/exams/<key>.<hash>.js
content/exams/cosmetic/참조자료/원료/*.md ──► (ingredients plugin)       ──► data/exams/cosmetic/ingredients_data.<hash>.js
content/exams/cosmetic/참조자료/원료/db_version.json ──► (ingredients plugin) ──► registry.js의 ingredients 메타 (version·history·contentHash)

content/**/*.md ───(런타임 fetch)──► src/data-loader.js + src/textbook-parser.js ──► STUDY_DATA (카드/퀴즈/챕터)
content/**/*.md ───(file:// 폴백)──► tools/build_study_md_bundle.js ──► data/exams/cosmetic/study_md/ (과목별 분할)

data/exams/<id>/exams/*.js ──► tools/build_ox_drills.js    ──► data/exams/<id>/drills/ox_subject*.js   (O/X 3,700+문)
data/exams/<id>/exams/*.js ──► tools/build_combo_drills.js ──► data/exams/<id>/drills/combo_subject*.js (복수정답형 755문)
                └──────────────────────────────► content/exams/cosmetic/문제은행/과목N_복수정답형.md (검토용 MD)
```

**특징**:
- **SSOT**: `content/exams/cosmetic/manifest.json` + `content/**/*.md`가 교재/카드/퀴즈의 단일 진실 원천
- **런타임 파싱**: `src/textbook-parser.js`가 브라우저에서 카드/퀴즈/챕터를 조립. 카드/퀴즈 안정 ID는 `src/sha256.js`(Node `crypto`와 동일)로 재현되어 진도 보존
- **재빌드 불필요**: `content/*.md` 수정 시 http 배포는 즉시 반영. `file://` 지원이 필요할 때만 `npm run build:study-md` 실행 (과목별 분할 번들 생성)
- **온디맨드 로딩**: `src/data-loader.js`가 필요한 과목/시험만 로드하고, 로드 후 registry stats를 실제 개수로 갱신
- **해시 파일명(시험/성분)**: 번들 내용이 바뀌면 파일명도 바뀌어 캐시 무효화가 자연스럽게 이루어짐

### 🧩 문항 드릴 파이프라인 (O/X·복수정답형)

시험 문항 스키마·채점 유틸([`src/questions.js`](../../src/questions.js))을 중심으로, `data/exams` 번들에서 학습 드릴을 파생 생성합니다.

```
data/exams/subjectN.*.js ──► build_ox_drills.js    ──► data/exams/cosmetic/drills/ox_subject*.js   (type:'ox')
                         ──► build_combo_drills.js ──► data/exams/cosmetic/drills/combo_subject*.js (type:'combo')
```

- **스키마**: `single`/`combo`/`short`/`ox` 4유형. combo는 진술 `truth`에서 정답 조합을 **도출**(`deriveComboAnswer`)하고 `validateQuestion`으로 유일성을 검증 — 정답 오타를 구조적으로 차단.
- **복수정답형 변환**(상세: [`QUESTION_SCHEMA_DESIGN.md`](./QUESTION_SCHEMA_DESIGN.md) §6): 객관식은 선지를 `fact`(명제 진위)/`answer`(정답 여부) 모드로 진술화, 같은 교재 구간(conceptId)의 fact 진술은 재조합해 복수정답 문항을 추가 생성. 단답형은 빈칸 정답이 하나뿐이라 100% 단일정답이 되므로 제외 — 원본 문제은행의 단답형으로 출제. 과목당 65/158/255/277 = 755문.
- **진술 원자 추적**: 진술의 `sid`(`stableId`)를 O/X·복수정답형이 공유 → [`src/statement-tracker.js`](../../src/statement-tracker.js)가 `perStatement.judgedCorrect` 판정을 `sid` 단위로 `statement_stats` `{j, w, lw, t, truth, cid, last, streak}` + SM-2 큐(`spaced-repetition.js`)에 누적. **연속 정답 3회(`WEAK_GRADUATE_STREAK`) 시 취약 목록 졸업**, 재오판 시 복귀. 드릴 편성은 **SM-2 기한 도래(`getDueStatementSids`) → 오판 진술 → 임의** 순.
- **드릴 모드**: 과목별(1~4) 외에 전 과목 특수 모드 `weak`(취약·복습 진술 필터)·`num`(수치·한도·기한 태그 필터 — `inferTags` 부여분) 지원, 출제 수 10/20/전체 선택. 복수정답형은 진술별 O/X 토글 2단계 응시 + 판정과 모순되는 선지 실시간 소거 표시(시험장 소거 전술 훈련).
- **취약 진술 리뷰 패널**: 누적 통계 열람 — conceptId 개념 그룹핑(참/거짓 혼동쌍 2단 대조), 복습 대상 필터, 최근 판정 배지, 졸업 수 표시, 바로 드릴 진입.
- **런타임**: `DataLoader.loadOxDrills(N)`/`loadComboDrills(N)`가 `data/exams/cosmetic/drills/` 번들을 클래식 `<script>` 주입으로 로드(`file://` 호환). 복수정답형은 수작업 파일럿(`combo_pilot.js`)과 자동 번들을 병합. UI는 `views/trainer-drills.js` + 트레이너 패널(`index.html`).
- **모의고사 연동**: 과목 카드의 "복수정답형 풀기"(40/60/전체 선택) → `startComboMockExam('N[:count]')`(`views/exam-simulator.js`)이 combo 번들을 `comboToSimQuestion`으로 시뮬 형식 평탄화(citation·진술 본문 편입, members 문자열화, 정답→지시자)해 시뮬레이터 세션 실행. 원본 members는 `comboOptions`에 보존돼 채점 시 `deriveComboJudgments`로 진술 판정을 역산해 `recordStatementJudgments`에 기록 — 시뮬 성적이 취약 추적·SM-2에 반영. 오답 리뷰는 진술 정오표 표시, 오답 복습(`weak_sim_*_combo_*` 카드)도 해당 번들 로드 후 지원. 통합 모의고사는 `#integrated-mix-combo` 체크 시 과목별 약 20%를 복수정답형으로 혼합.
- **캐시**: `data/exams/cosmetic/drills/`는 레지스트리 미등록 번들이라 `sw.js`의 `pruneStaleDataBundles`에서 `ALWAYS_KEEP`으로 명시 보존.
- **재생성·검증**: `npm run build:drills` (O/X + 복수정답형 일괄), `npm run check:combo` (파일럿 + 생성 번들 5개 전체 스키마·citation·채점 스모크 검증).

**오디오북 파이프라인** ([`content/exams/cosmetic/audiobook/`](../../content/exams/cosmetic/audiobook/README.md))은 Python 기반 별도 파이프라인으로, MD 청크 분할 → TTS → MP3 병합을 수행합니다.

### 🔑 안정적 ID 체계 (Stable ID)

학습 진행상황(외운 카드, 오답 노트)의 데이터 안정성을 위해 콘텐츠 유도형 해시 ID 체계를 적용합니다.
- **카드 ID 규칙**: `sha256(subjectKey|chapterKey|term)`의 앞 6자리를 취하여 `${subjectKey}_card_${shortHash}` 형태로 구성합니다.
  - **설계 결정**: 오탈자나 해설 보강 등 잦은 수정 시에도 ID가 변하지 않도록 정의 본문(`definition`)은 해시 입력에서 제외하고, 용어(`term`)만 사용합니다.
  - **단원 키 포함**: 서로 다른 단원에 동일 용어가 등장하더라도 유일성을 유지하도록 `chapterKey`를 해시 입력에 포함합니다.
- **퀴즈 ID 규칙**: 한 용어에 복수의 빈칸 퀴즈가 나오는 경우를 위해 `term|answer` 형태를 기반으로 해싱하고, 동일 정답이 중복 출현 시 순번(`#n`)을 결합하여 고유 ID를 부여합니다.
- **고아 진행상황 정리 (Orphan Cleanup)**: 교재 콘텐츠가 삭제되어 더 이상 존재하지 않는 카드 ID가 localStorage에 남아 있을 경우, 앱 로드 시점(`state.js`의 `loadProgress()`)에 자동으로 감지하고 제거하여 브라우저 스토리지 공간을 항상 깨끗하게 유지합니다.

### 🛡️ 스키마 검증 및 빌드 안전장치

- **빌드 타임 검증 (`tools/build/schema.js`)**: 빌드 도구는 과목 내 카드/단원 수의 유효성 및 고유 ID 중복 여부 등을 사전에 검증하며, 오류 발견 시 `exit code 1`로 빌드를 즉시 중단합니다. 또한, 이전 빌드 대비 데이터 수가 20% 이상 급감하는 경우 경고를 표시해 조용한 데이터 손실을 사전에 차단합니다.
- **매니페스트 자체 검증**: 매니페스트 파일 내 `chapters[].file`이 실제 경로에 존재하는지, 시험 정보(`exams[].subject`)가 등록된 과목을 바르게 지목하는지 정합성을 대조합니다.
- **파싱 마커 감시**: 마크다운 파일에 `🔖기출` 마커가 달려 있음에도 정답 빈칸이 누락되어 퀴즈가 생성되지 않은 비정상 행을 감지하여 빌드 시 경고 로그로 가시화합니다.

### 📄 참조자료 아키텍처 (PDF → MD 변환)

법령 원문·별표·식약처 고시 등 참조자료는 **원본 PDF를 직접 서비스하지 않고, MD로 변환하여 서비스**합니다. 이 설계는 PWA 환경에서 다음 7가지 이점을 제공합니다.

#### 파이프라인

```
[원본 PDF]                    [빌드 타임 변환]                    [런타임 서비스]
content/exams/cosmetic/참조자료/*.pdf  →  tools/build  →  content/exams/cosmetic/참조자료/ref_md/과목N/{base}/{base}.md
                         (PDF→MD 추출)        ↓
                                              DataLoader fetch + parseMarkdown
                                                   ↓
                                              html-viewer.js (data-ref-html)
```

- **SSOT**: [`content/exams/cosmetic/references.json`](../../content/exams/cosmetic/references.json)이 참조자료 중앙 설정
- **자동 생성**: [`tools/build/build-pdf-registry.js`](../../tools/build/build-pdf-registry.js)가 `references.json` → `src/pdf-registry.js` 자동 생성
- **매핑 키**: PDF 파일명은 `pdf-registry.js`의 `resolveRefPath()`에서 MD 경로 조회 키로만 사용 (직접 fetch 안 함)

#### PDF 직접 참조 대비 우위

| 영역 | PDF 직접 참조 | MD 변환 (현재) |
|------|-------------|----------------|
| **오프라인 가용성** | PDF.js 1MB+ 라이브러리 + PDF 파일 이중 캐시 | MD 파일만 캐시 (10-100KB/개), 라이브러리 불필요 |
| **검색 통합** | PDF 텍스트 추출 필요 (OCR/파서) | MD 파일 grep/인덱싱으로 즉시 검색, `textbook-search.js` 인덱스 통합 가능 |
| **크로스 레퍼런스** | PDF 페이지/좌표 기반 (불안정) | `(L123\|file.pdf)` 패턴 → 특정 줄 하이라이트, `../교재/.../*.md#LNN` 양방향 연결 |
| **렌더링 일관성** | PDF 고정 스타일, 테마 미적용 | CSS 변수로 라이트/다크 테마 자동 적용, 리더 툴바 글꼴 크기 연동 |
| **콘텐츠 편집** | PDF 편집 도구 필요, 바이너리 diff 불가 | 텍스트 편집기로 즉시 수정, Git 텍스트 diff로 변경 추적 |
| **성능** | PDF.js 다운로드 + 파싱 지연 (수백 ms) | 라이브러리 없음, MD 파싱 < 50ms, 메모리는 텍스트 문자열만 |
| **보안 (CSP)** | PDF.js 호환성 별도 검증 필요 | 기존 `script-src 'self'` 정책 그대로 적용, `html-viewer.js` DOMParser sanitize 적용 |

#### PDF 파일명 참조 루틴 (간접 참조)

PDF 파일명은 매핑 키로만 사용되며, 실제 서비스되는 것은 변환된 MD 경로입니다.

| 루틴 | 위치 | 동작 |
|------|------|------|
| `resolveRefPath()` | `src/pdf-registry.js:242` | PDF 파일명 → MD 경로 조회 (`REF_FILE_TO_PATH` 테이블) |
| `_toMdPath()` | `src/pdf-registry.js:217` | `xxx.pdf` → `content/exams/cosmetic/참조자료/ref_md/과목N/xxx/xxx.md` 변환 (`REF_MD_SUBJECTS` 맵) |
| `mapSourceToRef()` | `src/pdf-registry.js:248` | 출처 텍스트 → PDF 파일명 → MD 경로 |
| PDF 링크 인터셉트 | `src/reader-format.js:61,111,126` | 교재 본문 PDF 링크 → `data-ref-html` MD 링크 변환 |
| PDF 링크 인터셉트 | `src/exam-viewer.js:251-263` | 시험 문제 HTML PDF 링크 → MD 경로 치환 |
| 용어집 참조 | `src/views/glossary-renderer.js:52` | `refDoc + '.pdf'` → MD 경로 조회 |
| 참조자료 목록 | `src/views/textbook-reader.js:1084-1087` | 사이드바 PDF 파일명 → MD 경로 변환 |

#### 자산 현황

| 항목 | 개수 | 비고 |
|------|-----:|------|
| `content/exams/cosmetic/참조자료/` 내 PDF 원본 | 41개 | 레지스트리 매핑 키로만 사용 (직접 서비스 안 함) |
| `content/exams/cosmetic/참조자료/ref_md/과목N/` 내 MD 파일 | 41개 | 실제 서비스되는 참조자료 — 과목 폴더가 귀속의 진실 |
| `sw.js` PDF 캐시 | 0개 | PDF는 캐시하지 않음 |

#### 제약

- **원본 레이아웃 손실**: PDF의 표/이미지 배치가 MD 변환 시 단순화됨
- **변환 파이프라인 유지**: `tools/build` 스크립트 유지 필요
- **수동 변환**: PDF → MD 변환은 빌드 타임 1회 수동 (런타임 자동 아님)

---

## 🚀 배포 파이프라인

배포는 **`npm run deploy` 하나로만** 수행한다 (`tools/deploy.js`). `vercel --prod` 직접 실행은 git을 거치지 않고 로컬 파일을 직접 업로드하므로 금지.

### deploy.js 가드 순서

```
npm run deploy
  │
  ├─ 1) git fetch → 브랜치/트리/동기화 검사
  │     ├─ main 브랜치가 아니면 차단
  │     ├─ 커밋되지 않은 변경 있으면 차단 (untracked 포함)
  │     ├─ origin/main에 없는 로컬 커밋 있으면 차단
  │     └─ origin/main보다 뒤처져 있으면 차단
  │
  ├─ 2) 콘텐츠 품질 게이트 — audit_combo.js 실행, 오류 시 배포 차단
  │
  ├─ 3) sw.js CACHE_VERSION 스탬프 (stamp-sw-version.js)
  │     └─ 값이 바뀌면 'chore(sw): CACHE_VERSION 스탬프' 자동 커밋 + push
  │
  └─ 4) vercel --prod --yes 실행
        (팀 프로젝트는 .vercel/project.json의 orgId를 --scope로 명시)
```

**근거**: 미푸시 커밋/미커밋 변경이 프로덕션에 올라가는 사고 방지 + SW 캐시 버전 자동 스탬프(모바일 구버전 고착 방지) + 콤보 문항 무결성 게이트를 배포 경로에 강제.

### 개발/검증 명령 요약

| 명령 | 역할 |
|------|------|
| `npm test` | 단위 테스트 (node --test) |
| `npm run test:dom` | DOM 테스트 (Vitest + jsdom) |
| `npm run test:all` | unit + parser + imports + dom 일괄 |
| `npm run build:data` | 시험별 콘텐츠→데이터 번들 (모든 시험 순회) |
| `npm run check:content -- --build` | 콘텐츠 통합 검증 (교재 교체 등 대규모 변경 후) |
| `npm run verify:assets` | SHELL/DATA_ASSETS 파일 존재 검증 |
| `npm run deploy` | 배포 가드 + SW 스탬프 + vercel --prod |

---

## 🧩 신규 기능 구현 레시피

> "누구라도 설계·구현할 수 있게" — 새 기능을 추가할 때 따라야 할 표준 절차와 코드 계약.

### A. 새 뷰(화면) 추가

1. `index.html`에 `<section id="xxx-view" class="view-section">` 추가
2. 사이드바 `.nav-item` + 모바일 `.mobile-tab-item`에 `data-target="xxx-view"` 항목 추가
3. `src/router.js`의 `getViewTitles()`에 `'xxx-view': { title, subtitle }` 추가 (또는 `manifest.uiText` 활용)
4. `src/views/xxx.js` 뷰 컨트롤러 작성 → `app.js`의 `ctx.handlers`에 렌더 함수 등록
5. `sw.js` `SHELL_ASSETS`에 새 JS 파일 추가
6. DOM 테스트 추가 (`tests/dom/xxx.dom.test.js`)

### B. 새 영속 데이터 추가

1. `src/storage-keys.js`의 `STORAGE_KEYS`에 상수 선언
2. 백업·초기화 대상이면 `BACKUP_KEYS`/`RESET_KEYS`에 등록
3. 시험 무관 설정이면 `exam-context.js`의 `GLOBAL_KEYS`에 등록
4. 동기화 제외 대상(PII 등)이면 `sync.js`의 `SYNC_EXCLUDE`에 등록
5. 읽기/쓰기는 반드시 `safeGetItem`/`safeSetItem` 사용 (네임스페이스 + dirty 추적 자동)

### C. 새 상호작용 추가 (CSP-safe)

- 인라인 핸들러 금지 → `data-click="handlerName"` 또는 `data-args='[...]'`
- 핸들러는 `app.js` 하단의 `window.X = X` 브리지로 노출
- `data-input`은 input 이벤트용 (`el.value` 전달)
- DOM 표시 제어는 `classList`의 `.is-hidden`/`is-flex`/`is-grid` 사용 — `el.style.display` 금지
- `alert`/`confirm` 금지 → `showToast`/`showConfirm`/`showAlert`

### D. 새 Formula OS 스토어 추가

1. `src/store-utils.js`의 공통 헬퍼(`loadItems`/`saveItems`/`newId`/`clamp`) 재사용
2. `*_LIMIT_FREE` 상수 + `canCreate()` 게이트로 Free 한도 적용
3. 스키마 정제 함수(`sanitize*`)로 입력 정규화
4. `formula.js`의 PANELS/서브내비에 패널 등록 + `index.html`에 패널 섹션 추가

### E. 새 시험 추가

§9 "새 시험 추가 절차" 참조 — `content/exams/<id>/` 배치 + `exams.json` 엔트리 + `check:content -- --build`. 앱 로직 변경 불필요.

### 코딩 규칙 요약 (AGENTS.md 기준)

- 2-space 들여쓰기, ES Modules (`import`/`export`)
- `getElementById` 결과 null 체크, `localStorage`는 safeGetItem/safeSetItem
- Promise 체인에 `.catch()` 필수
- 배열 인덱스 접근 후 `if (!item) return;` bounds 체크
- `window.X` 접근 시 존재 체크, `parseInt` 결과 `isNaN` 체크
- 접근성: 터치 타겟 ≥44px, `aria-label`/`aria-expanded`/`aria-live` 유지
- UI/UX 규칙: SPEC.md §4.8 (재사용 가이드) 준수

---

## ⚖️ 주요 설계 결정 및 근거

| 결정 | 선택 | 대안 | 근거 |
|------|------|------|------|
| **아키텍처** | Local-First 정적 SPA + 선택적 Supabase | 서버 + DB | 개인 학습 도구, 운영비 0, Vercel 무료 배포. Supabase는 로그인 사용자에게만 붙는 선택 레이어 — 미설정 시에도 완전 동작 |
| **프레임워크** | Vanilla JS | React/Vue | 빌드 불필요, 장기 유지보수성, 번들 최소화 |
| **상태 관리** | 단일 전역 객체 + localStorage | Redux/MobX | 규모 대비 복잡도 과다, 직렬화 단순성 |
| **차트** | 직접 SVG 생성 | Chart.js 등 | 외부 의존성 제거, 가벼움, 커스터마이징 자유 |
| **데이터 로딩** | 시험/성분: JS 상수 `<script>` · 교재/카드/퀴즈: 런타임 MD fetch+파싱 | 전량 번들 또는 전량 백엔드 | 시험/성분은 오프라인 단순화, 교재는 재빌드 없이 최신 반영 + 표현 중복 제거 |
| **모듈 시스템** | ES Modules (전환 완료) + 데이터 파일만 클래식 스크립트 | 글로벌 스코프 유지 | 점진 분리 전략으로 무중단 전환 완료; 데이터 번들은 `file://` 동기 로드를 위해 클래식 유지 |
| **오디오** | 외부 CDN (캐시 제외) | 앱 번들 포함 | 302MB → Vercel 용량 제한 및 캐시 저장공간 보호 |

---

## 🚀 향후 확장 방향

1. **ES Modules 전환 완성** ✅
   - 모든 `src/` 모듈이 ESM `import`/`export` 사용 → 명시적 의존성 그래프 확립

2. **추가 도메인 로직 분리** ✅
   - `backup.js`, `textbook-search.js`, `textbook-reader.js`, `exam-simulator.js`, `daily-challenge.js`, `pomodoro.js`, `glossary-renderer.js`, `navigation.js` 등 11개 뷰 컨트롤러 모듈 분리 완료
   - `router.js`로 SPA 라우팅 로직 분리 (뷰 타이틀 맵, 네비게이션 디스패치)
   - `ui-utils.js` 공통 UI 유틸 분리로 순환 의존성 방지

3. **DOM 테스트 환경 도입** ✅
   - Vitest + jsdom으로 DOM 렌더링/이벤트 테스트 기반 구축 (722 tests: 458 unit + 264 DOM)
   - GitHub Actions CI로 push 시 자동 테스트 실행

4. **타입 안정성 도입** ✅
   - JSDoc `@typedef` 타입 정의 구축 (`src/types.js`, 217줄)
   - `jsconfig.json` checkJs로 편집기 타입 검사/자동완성 활성화

5. **백엔드 연동 확장성** ✅ (2026-09-23 — Supabase Phase 1~2 구현)
   - `state.js`의 `safeSetItem`에 쓰기 훅(`_dataWriteHook`)을 두어 순환 import 없이 `sync.js`가 dirty 추적에 연결
   - `sync_snapshots`(user_id + exam_id → payload/updated_at/device_id) upsert 스냅샷 방식으로 클라우드 동기화 구현 — 상세는 §10
   - **남은 과제**: 서버 기반 Pro entitlement(플랜 검증·한도 해제), 시험별 데이터 테이블 분리 — SUPABASE_DESIGN.md §10 결정 사항 참조

6. **성능 계측** ✅ (2026-09-03)
   - `src/web-vitals.js`: PerformanceObserver API로 LCP/CLS/INP 측정 (zero-dependency)
   - `app.js` 시작 시 `initWebVitals()` 호출, `pagehide` 시점에 `console.debug`로 최종 값 출력
   - 대용량 데이터 지연 로딩은 기존 온디맨드 로딩(`DataLoader`)으로 이미 구현됨

7. **인터랙티브 차트 툴팁** ✅
   - SVG 라인/레이더 차트에 hover/touch 툴팁 추가 (날짜, 점수, 증감, 과목별 합격 상태)
   - 모바일 터치 지원 + 화면 경계 자동 보정

8. **Media Session API 연동** ✅
   - 오디오북 재생 시 잠금화면/알림바 미디어 제어 (play/pause/seek/prev/next)
   - `navigator.mediaSession.metadata`로 단원 제목, 과목명, 앨범 아트 설정

9. **모의고사 오답 복습 연동** ✅
   - 틀린 문제 자동 수집 → `state.weakCards`에 `weak_sim_*` ID 등록
   - 오답 모의고사 생성 시 `window.EXAM_DATA`에서 원본 문제 역추적하여 복습 문제 조립

10. **라이트 모드 WCAG 대비 개선** ✅
   - 배지 색상(cyan/violet/emerald/amber) 라이트 테마 진한 색상 오버라이드 → WCAG AA 기준(4.5:1) 충족

11. **검색 디바운스 최적화** ✅
   - 성분 사전/교재 검색에 250ms 디바운스 적용 → 모바일 타이핑 랙 감소

12. **콘텐츠 하드코딩 제거** ✅
   - 시험 제목: `exam-viewer.js`의 9개 하드코딩 맵 → `registry.exams[].file` + `.title` 동적 조회
   - 과목 매핑: `exam-simulator.js`의 `subject1→'law'` 등 4개 하드코딩 폴백 제거 → registry 전용 조회
   - 차트 과목 매핑: `charts.js`의 인덱스 기반 `subjectN` 파싱 → `registry.exams` key 매칭
   - 기본 과목: `state.js`의 `'law'` 하드코딩 → `null` (initApp에서 registry 첫 과목으로 설정)
   - 축약명: `app.js`의 `.replace()` 체인 → `manifest.json` `shortName` 필드
   - 시험 카드: `index.html`의 4개 과목별 하드코딩 카드 → `populateExamCards()` 동적 생성
   - 추천 링크: `index.html`의 6개 유튜브/외부링크 카드 + 4개 채널 요약 → `manifest.json` `resources` 섹션 + `populateResourceCards()` 동적 생성
   - **결과: `content/` 전체 교체 시 소스 코드 수정 불필요**

13. **프로덕션 CSP 버그 수정** ✅
   - 백업 가져오기: `index.html` 인라인 `onchange=importData(event)` → CSP `script-src 'self'` 차단 → `backup.js`에서 `addEventListener('change')` 바인딩 (`setupImportListener`)
   - Mermaid 일시 제거: `vendor/mermaid/mermaid.min.js` (3.3MB)가 `unsafe-eval` 필요 → CSP 충돌 + 프리캐시 부담 → 이후 #16에서 온디맨드 방식으로 재도입 (필요 시에만 동적 로드)
   - CSS 캐시 스큐: `sw.js` CSS 라우팅 `networkFirst` → `cacheFirst`로 변경 (배포 전환 시 HTML/CSS 세대 불일치 방지)
   - 인코딩: `src/utils.js` mojibake 헤더 수정

14. **교재 리더 인터랙티브 개념 맵** ✅ (2026-09-12 완전 삭제)
   - `src/concept-map.js`: 과거 순수 SVG 마인드맵 생성기 — 개념 맵 컨테이너는 2026-09-01 삭제, 용어집 링크 기능만 잔존하다가 2026-09-12 dead code로 분류되어 완전 삭제
   - `textbook-reader.js`에서 개념 맵 컨테이너 HTML, `renderConceptMap` 호출, 토글 이벤트는 이미 제거됨

15. **교재 리더 학습 보조 도구** ✅ (2026-09-01 축소)
   - `src/study-aids.js`: 2가지 학습 보조 기능 (CSP-safe, 의존성 제로)
   - ① 기출 필터 & 요약: 🔖기출 마커 섹션 하이라이트 + 토글 버튼로 비기출 섹션 디밍, 핵심 요약 카드 표시
   - ② 숫자·기한 빈칸 카드: 정규식으로 숫자/기한/횟수 자동 추출 → 챕터별 암기표 생성
   - ~~③ 절차 플로우~~ (삭제 — Mermaid flowchart가 콘텐츠에 직접 내장됨)
   - ~~④ 행정처분 비교표~~ (삭제 — 콘텐츠 본문 표로 충분)
   - `textbook-reader.js`에 토글 버튼과 렌더링 통합, `css/reader.css`에 반응형 스타일 추가

16. **교재 본문 Mermaid 다이어그램 렌더링** ✅ (2026-09-02 개선)
   - `reader-format.js`에 `allowMermaid: true` 옵션 → ```mermaid 코드블록을 `<pre class="mermaid">`로 변환
   - `textbook-reader.js`에 `_ensureMermaid()` + `_renderReaderMermaid()` 추가 (온디맨드 패턴)
   - `vendor/mermaid/mermaid.min.js` (3.3MB)는 mermaid 블록이 있는 챕터를 열 때만 동적 로드
   - **개별 렌더링** (2026-09-01): `mermaid.run()`을 노드별로 개별 호출 → 하나의 다이어그램 실패가 전체 렌더링을 중단시키지 않음
   - **키워드 링크 보호** (2026-09-01): `reader-format.js`에서 `<pre class="mermaid">` 블록을 플레이스홀더로 보호 → 용어집 자동 링크가 Mermaid 문법을 손상시키지 않음
   - `securityLevel: 'strict'`로 변경 (XSS 방어 강화, 동적 script tag에 crypto nonce 추가)
   - 교재 콘텐츠에 mindmap + flowchart 다이어그램 다수 포함
   - **다이어그램 타입 감지 및 렌더링 분리** (2026-09-02): `_renderReaderMermaid()`에서 각 `pre.mermaid` 블록의 `textContent`를 검사하여 `mindmap`으로 시작하면 `mermaid-mindmap` 클래스, 그 외는 `mermaid-flowchart` 클래스 추가 → 타입별로 독립된 `mermaid.initialize()` 호출 (flowchart에만 `lineWidth: 1` themeVariable 적용, mindmap은 기본값 유지)
   - **CSS 스타일 분리** (2026-09-02): `css/reader.css`에서 `.mermaid-flowchart`와 `.mermaid-mindmap` 선택자로 분리 — flowchart에만 `stroke-width: 1px`, `fill: none`, 노드 배경/테두리, 화살표 마커 스타일 적용, mindmap은 텍스트 대비만 조정 → 두 다이어그램 타입 간 스타일 간섭 원천 차단
   - **마인드맵 들여쓰기 수정** (2026-09-02): `tools/fix-mindmap-indent.mjs` 스크립트로 4개 과목 교재 MD 파일의 mindmap 블록 들여쓰기를 계층 구조에 맞게 수정 (동일 들여쓰기 → root/1level/2level/3level 계층적 들여쓰기)
   - **단위 테스트 추가** (2026-09-02): `tests/unit/mermaid-rendering.test.js` (23개 테스트) — 다이어그램 타입 감지, mindmap 들여쓰기 검증, 파서 출력 타입 감지, 파이프라인 통합, 실제 교재 파일 검증, CSS 클래스 분리 로직, `<br/>` 태그 보존

17. **과목별 큐레이션 용어집 (Glossary Curation)** ✅ (2026-09-01)
   - `content/exams/cosmetic/교재/glossary/subject{1-4}.json`: 과목별 큐레이션 용어 정의 파일 (수작성)
   - `tools/build/build_keyword_index.js`: 빌드 시 JSON 파일을 읽어 `GLOSSARY_INDEX`의 `explanation`을 큐레이션 정의로 덮어쓰기, `curated: true` 플래그 추가
   - `src/views/textbook-reader.js`: 용어집 테이블 헤더 "설명 (참조문서 발췌)" → "설명"으로 변경
   - `css/reader.css`: 용어집 테이블 `table-layout: fixed` 적용 — 과목별 컬럼 폭 일관성 확보
   - JSON 파일은 빌드 타임 전용이므로 SW 캐시 불필요 (빌드 결과가 `src/keyword-index.js`에 합쳐짐)

18. **HTML 뷰어 스크롤바 가시성 수정** ✅ (2026-09-01)
   - **문제**: `css/base.css` 전역 스크롤바 색상이 `rgba(255,255,255,0.1)` (흰색 반투명) → HTML 뷰어의 흰 배경에서 스크롤바가 안 보임
   - **해결**: `src/html-viewer.js`에 뷰어 전용 스크롤바 스타일 추가 (`#888` thumb, `#f0f0f0` track, 12px 폭)
   - **구조 개선**: 오버레이를 flexbox에서 절대 위치(`position:fixed`) 기반으로 변경 — 브라우저별 flexbox 구현 차이에 영향받지 않고 스크롤 영역 확보

19. **교재 리더 이야기형 모드 (Story Mode)** ✅ (2026-09-10)
   - `textbook-reader.js`: `storyMode` 상태 토글 (표준형 ↔ 이야기형 MD 전환, `localStorage` 영속화)
   - `_이야기형.md` 파일 로드 실패 시 기본 모드로 자동 폴백 + 토스트 안내

20. **교재 리더 TOC/브레드크럼/스크롤 스파이** ✅ (2026-09-10)
   - 계층형 TOC (챕터/섹션 접기·펼치기, 하위 헤딩 표시)
   - 모바일 TOC 드로어 (왼쪽 끝 엣지 스와이프 오픈, 엣지 힌트 탭, 백드롭/왼쪽 스와이프/항목 클릭 시 닫기, 툴바 자동 숨김 — 2026-09-16 추가)
   - 브레드크럼 (과목 > 단원 > 현재 섹션, 스크롤 스파이 연동)
   - 스크롤 스파이 (`requestAnimationFrame` 스로틀링, 현재 섹션 TOC/브레드크럼 자동 하이라이트)

21. **교재 리더 이전/다음 단원 이동** ✅ (2026-09-10)
   - `textbook-reader.js`: 교재 본문 하단에 이전/다음 단원 버튼 (대상 단원명 표시, 단원 간 연속 학습)

22. **교재 검색 역색인 (Inverted Index)** ✅ (2026-09-10)
   - `textbook-search.js`: 공백 토큰화 + 2-gram 보조 인덱스 구축, 후보 섹션 교집합 계산
   - 자동 캐싱 (과목 키 변경 시에만 재구축, 반복 검색 성능 향상)

23. **대시보드 학습 통계/약점 분석** ✅ (2026-09-10)
   - `dashboard.js`: 과목별 정답률 히트맵 (색상 코딩: 80%+ 초록, 60-79% 주황, 40-59% 빨강, <40% 진빨강, 미응시 회색)
   - 약점 과목 자동 추천 (정답률 최저 + 헷갈린 카드最多, "풀기"/"학습" 버튼)

24. **접근성 ARIA 속성** ✅ (2026-09-10)
   - 오버레이: `role="dialog"`, `aria-modal`, `aria-label`
   - 검색 결과 카운트/퀴즈 피드백: `aria-live="polite"`
   - 플래시카드: `role="button"`, `aria-expanded`

25. **모바일 가로/세로 보기 전환** ✅ (2026-09-10)
   - `index.html`: `orientation-toggle-btn` (모바일 헤더 회전 아이콘, 강제 가로 레이아웃 전환)

26. **localStorage 용량 초과 안내** ✅ (2026-09-10)
   - `state.js`: `QuotaExceededError` 감지 시 하단 고정 경고 배너 표시

---

## 📋 `content/` 내용 변경 시 수정 파일 및 절차 가이드

> `content/` 폴더의 마크다운 원문, 폴더 구조, 또는 매니페스트가 변경될 때 수행해야 할 수정 작업과 빌드/배포 절차를 정리합니다.
> 아래 `<root>` = `content/exams/<examId>/` (멀티시험 대칭 구조 — 어떤 시험이든 동일 절차).

### 변경 유형별 수정 파일 매트릭스

| 변경 유형 | 수정 필요 파일 | 설명 |
|-----------|---------------|------|
| **교재 MD 내용 수정** (기존 파일) | (수정 불필요) | `manifest.json`의 `dir`/`file` 필드가 경로를 참조하므로, 파일명이 같으면 자동 반영 |
| **교재 MD 파일 추가/삭제/이름 변경** | `<root>/manifest.json` | `subjects[].chapters[].file` 필드 갱신 |
| | `sw.js` | `MD_ASSETS` 배열의 경로 갱신 + `CACHE_VERSION` 버전업 |
| | `<root>/utils/batch_convert.py` | `BATCH_TARGETS["교재"]` 경로 갱신 |
| **문제은행 MD 변경** | `<root>/manifest.json` | `exams` 섹션의 파일 경로 갱신 |
| | `<root>/utils/batch_convert.py` | `BATCH_TARGETS["문제은행"]` 경로 갱신 |
| **참조자료 MD/HTML 변경** | `<root>/references.json` + `src/pdf-registry.js` | 참조자료 파일 목록·경로 매핑 (`references.json` → `build-pdf-registry.js`가 `pdf-registry.js` 자동 생성) |
| | `tools/build/plugins/ingredients.plugin.js` | `INGREDIENTS_DIR` 경로 (원료 하위 폴더 변경 시) |
| **학습안내서 MD 변경** | (파일명 동일 시 수정 불필요) | `manual-viewer.js`, `build_doc_bundles.js`, `sw.js`가 `<root>/학습안내서.md` 경로 참조 |
| | `<root>/utils/batch_convert.py` | 파일명 변경 시 `BATCH_TARGETS["학습안내서"]` 갱신 |
| **새 과목 추가** | `<root>/manifest.json` | `subjects[]`에 새 과목 항목 추가 (`key`, `name`, `dir`, `chapters`) |
| | `src/pdf-registry.js` | `SUBJECT_DIR_MAP`, `REF_DIRS`, `REFERENCE_FILES`에 새 과목 항목 추가 |
| | `sw.js` | `MD_ASSETS`에 새 과목 MD 경로 추가 |
| | `<root>/utils/batch_convert.py` | `BATCH_TARGETS["교재"]`에 새 파일 추가 |
| | `<root>/audiobook/` | 오디오북 파이프라인 스크립트에 새 과목 추가 (필요 시) |
| **새 시험 추가** | `content/exams.json` + `content/exams/<id>/` | §9 "새 시험 추가 절차" 참조 — 앱 로직 변경 불필요 |
| **폴더 구조 개편** | 위 모든 파일 | 경로가 일괄 변경되므로 모든 참조 파일 검토 필요 |

### 빌드 절차 (content/ 변경 후)

```powershell
# 통합 검증 (빌드 + 인용·귀속·레이아웃·드릴·파서·임포트·자산·테스트 일괄)
npm.cmd run check:content -- --build

# 개별 단계가 필요한 경우:
npm.cmd run build:data             # 데이터 빌드 (모든 시험 순회 — registry, exams, ingredients, drills, 번들)
node tools/build_doc_bundles.js    # 문서 번들 (학습안내서, 사용자/포뮬러 매뉴얼)
npm.cmd test                       # 단위 테스트
```

### 배포 절차

```powershell
# 1. Git 커밋 & 푸시
git add -A
git commit -m "content: <변경 내용 요약>"
git push

# 2. 배포 (가드 + SW 스탬프 + vercel --prod 일괄)
npm.cmd run deploy
```

> **주의**: `npm run deploy`가 clean-tree·origin 동기화 검사 → 콤보 품질 게이트 → `CACHE_VERSION` 자동 스탬프(변경 시 자동 커밋·푸시) → `vercel --prod`를 순서대로 수행한다. `vercel --prod` 직접 실행 금지 — 상세는 §20 "배포 파이프라인". `CACHE_VERSION`이 갱신되지 않으면 모바일 PWA에서 구버전 캐시가 유지되어 변경사항이 반영되지 않는다.

### 자동 생성 파일 (수정 금지)

다음 파일들은 빌드 스크립트에 의해 자동 생성되므로 **직접 수정하지 마세요**:

> `<droot>` = `data/exams/<examId>/` (시험별 데이터 루트)

| 파일 | 생성 스크립트 |
|------|-------------|
| `data/exams.js` | `tools/build_exams_list.js` |
| `<droot>/registry.js` | `tools/build/index.js` |
| `<droot>/exams/*.hash.js` | `tools/build/index.js` (exams.plugin.js) |
| `<droot>/exams_md/*.js` | `tools/build_exam_bundles.js` |
| `<droot>/study_md/*.js` | `tools/build_study_md_bundle.js` |
| `data/docs_md/*.js` + `<droot>/docs_md/*.js` | `tools/build_doc_bundles.js` |
| `<droot>/ingredients_data.*.js` | `tools/build/index.js` (ingredients.plugin.js) |
| `<droot>/id_migration.js` | `tools/build_id_migration.js` |
| `<droot>/question_chapters.js` | `tools/build_question_chapters.js` |
| `src/pdf-registry.js` | `tools/build/build-pdf-registry.js` (references.json → 자동 생성) |
| `src/keyword-index.js` | `tools/build/build_keyword_index.js` |

### 주요 참조 파일 목록 (content/ 경로 의존)

| 파일 | 참조 방식 | 비고 |
|------|----------|------|
| `content/exams.json` | 시험 레지스트리 SSOT | `build_exams_list.js` → `data/exams.js` |
| `<root>/manifest.json` | 시험 콘텐츠 SSOT — 모든 빌드의 원천 | `subjects[].dir`, `chapters[].file`, `uiText`, `resources` |
| `<root>/references.json` | 참조자료 매핑 SSOT | `build-pdf-registry.js`의 입력 |
| `sw.js` | `MD_ASSETS` 하드코딩 | 프리캐시 대상 MD 파일 경로 |
| `src/manual-viewer.js` | `MD_SOURCES` 객체 | 학습안내서, 사용자매뉴얼 경로 |
| `src/pdf-registry.js` | `SUBJECT_DIR_MAP`, `REF_DIRS`, `REFERENCE_FILES`, `MD_CONVERSION_TARGETS` | 참조자료 중앙 설정 (자동 생성 파일 — `references.json` 수정 후 리빌드) |
| `src/data-loader.js` | `manifest.subjects[].dir` 동적 참조 | 런타임 MD 로드 (`contentPath()` 경유) |
| `src/textbook-parser.js` | `manifest.subjects[].dir` 동적 참조 | 런타임 MD 파싱 |
| `tools/build/manifest-loader.js` | `manifest.json` 검증 | 빌드 시 파일 존재 확인 |
| `tools/build/plugins/textbook.plugin.js` | `subject.dir` 동적 참조 | 빌드 시 MD 파싱 |
| `tools/build/plugins/ingredients.plugin.js` | `INGREDIENTS_DIR` 하드코딩 | `<root>/참조자료/원료/` |
| `tools/build/plugins/exams.plugin.js` | `manifest.exams` 참조 | 문제은행 MD 처리 |
| `tools/build_doc_bundles.js` | `DOC_FILES` 배열 | 학습안내서, 사용자/포뮬러 매뉴얼 번들 |
| `tools/build_study_md_bundle.js` | `manifest.subjects[].dir` 동적 참조 | 교재 MD 폴백 번들 |
| `tools/check_parser_parity.js` | `manifest.subjects[].dir` 동적 참조 | 파서 정합성 검증 |
| `tools/deploy.js` | `npm run deploy` | 배포 가드 (clean tree + origin 동기화 + 콤보 게이트 + SW 스탬프) |
| `<root>/utils/batch_convert.py` | `BATCH_TARGETS` 딕셔너리 | 배치 HTML 변환 대상 |
| `<root>/utils/md_to_html.py` | `--in` 인자 (기본값 `학습안내서.md`) | 단일 HTML 변환 |
| `<root>/utils/convert_ref_md.py` | `MD_CONVERSION_TARGETS` Set (스크립트 내 하드코딩) | ref_md 대용량 HTML→MD 변환 및 body-only 추출 |
| `<root>/audiobook/generate_all_mp3.py` | 과목 키 참조 | 오디오북 생성 |

---

## 📖 교재 변경 시 소스 수정 필요성 검토

> **검토일**: 2026-09-02
> **목적**: 교재 콘텐츠가 변경될 때 소스 코드 수정이 최소화되는지 검증

### 설계 원칙

프로젝트는 **content/exams/cosmetic/manifest.json**을 SSOT(Single Source of Truth)로 사용하여, 교재 원문 교체/과목 추가 시 소스 코드 수정을 최소화하도록 설계되어 있다.

- 교재 원문(`content/exams/cosmetic/교재/*.md`) 교체 → 소스 수정 불필요
- 과목 추가/제거 → `manifest.json` 수정 + `npm run build:data` 만으로 반영
- 과목명 표시 → `manifest.json`의 `shortName` 필드를 동적 사용 (`app.js`, `charts.js`, `exam-simulator.js`)
- 교재 파싱 로직 → 마커(🔖기출, 📌중요), 정규식, 카드 분류 로직은 모든 교재에 범용 적용
- 용어집 링크 → 본문 중 용어집 키워드 자동 링크(`glossary-term-link`), (LNN) 참조 링크(`glossary-link`), 개념 맵 노드 링크 모두 `scrollToGlossary()` 공유 함수로 통합 — 점프 후 "원래 위치로" 플로팅 버튼으로 복귀

### 수정 필요성 등급

| 등급 | 의미 |
|------|------|
| **필수** | 교재 콘텐츠가 바뀌면 반드시 수정해야 함 (설계 의도적) |
| **조건부** | 특정 조건(분야 변경, 파일명 규칙 변경, 연도 변경 등)에서만 수정 필요 |
| **불필요** | 재빌드만으로 자동 반영됨 |

### 1순위: `src/pdf-registry.js` — **필수 수정** (설계 의도적)

참조자료 중앙 설정 모듈. 파일 헤더에 명시된 대로 **이 파일만 수정하면 됨**.

수정 대상 상수:

| 상수 | 내용 | 수정 시점 |
|------|------|----------|
| `SUBJECT_DIR_MAP` | 과목 key → 폴더명 매핑 | 과목 구조 변경 시 |
| `REF_DIRS` | 법령고시/공통/과목별 PDF 파일 목록 | 참조자료 PDF 변경 시 |
| `SOURCE_REF_MAP` | 출처 키워드 → PDF 매칭 정규식 | 법령 개정/참조자료 변경 시 |
| `KEYWORD_REF_MAP` | 본문 키워드 → 자동 링크 매핑 | 별표/규정 변경 시 |
| `REFERENCE_FILES` | 과목별 참조자료 파일 목록 | 과목별 참조자료 변경 시 |
| `REFERENCE_COMMON` | 공통 참조자료 목록 | 공통 참조자료 변경 시 |
| `REFERENCE_LAW` | 법령고시 참조자료 목록 | 법령 개정 시 |

### 2순위: `src/reader-format.js` — **조건부** (파일명 패턴 하드코딩)

| 하드코딩 대상 | 위치 | 수정 조건 |
|---------------|------|----------|
| 기출문제 링크 패턴 `기출문제/과목N_...` | `reader-format.js:21` | 기출문제 파일명 규칙 변경 시 |
| ~~문제은행 경로 `content/exams/cosmetic/문제은행/과목${N}_단일정답형.md`~~ | ~~`reader-format.js:23`~~ | ✅ **제거됨** — `DATA_REGISTRY.exams[].file`에서 동적 조회 (2026-09-03) |
| 참조자료 폴더명 `참조자료`, `공통참조자료`, `N과목_참조자료` | `reader-format.js:31` | 참조자료 폴더 구조 변경 시 |
| 출처 경로 패턴 `../참조자료/...md`, `N과목_참조자료/...md` | `reader-format.js:48` | 참조자료 경로 규칙 변경 시 |

> ~~**개선 가능**: 기출문제 파일명을 `manifest.json`의 `exams[].file`에서 동적 참조하면 하드코딩 제거 가능~~ ✅ **완료** (2026-09-03)

### 3순위: `src/app.js` — **조건부** → ✅ **개선 완료** (2026-09-03)

| 하드코딩 대상 | 위치 | 수정 조건 |
|---------------|------|----------|
| ~~`'2026 시험 합격'`~~ | ~~`app.js:431`~~ | ✅ **제거됨** — `manifest.json` `uiText` + `contentYear`에서 동적 생성 |
| ~~`'교재 인용 1,000제 문제은행'`~~ | ~~`app.js:436`~~ | ✅ **제거됨** — `manifest.json` `uiText` + `{totalQuestions}` 플레이스홀더로 동적 생성 |
| ~~`'화장품 성분별 배합한도 및 고시 기준 통합 검색기'`~~ | ~~`app.js:439`~~ | ✅ **제거됨** — `manifest.json` `uiText.dictionary`에서 동적 조회 |

> **개선 내용**: `manifest.json`에 `uiText` 섹션 추가, 빌드 시 `{year}`/`{totalQuestions}` 플레이스홀더 치환 후 `registry.js`에 포함. `app.js`는 `DATA_REGISTRY.uiText`에서 동적 조회 (fallback 포함).

### 4순위: `index.html` — **조건부** (자격증명 하드코딩)

| 하드코딩 대상 | 위치 | 수정 조건 |
|---------------|------|----------|
| `<title>맞춤형화장품 조제관리사 ...` | `index.html:6` | 자격증명 변경 시 |
| `2026 맞춤형화장품 조제관리사 시험` | `index.html:8` | 연도/자격증명 변경 시 |
| `화장품법, 제조/품질관리, 안전관리, 맞춤형화장품 이해` | `index.html:830` | 과목명 변경 시 |

### 5순위: `src/study-aids.js` — **조건부** (단위/키워드 리스트)

| 하드코딩 대상 | 위치 | 수정 조건 |
|---------------|------|----------|
| `NUMBER_REGEX` 단위 목록 (`%`, `개월`, `g`, `ml`, `ppm` 등) | `study-aids.js:94` | 완전히 다른 분야 교재로 변경 시 |
| ~~`PROCEDURE_KEYWORDS`~~ (미사용 — 절차 플로우 삭제됨) | `study-aids.js:237` | (참고용 잔존, `renderStudyAids()`에서 미호출) |
| ~~`detectAdminPenalty` 키워드~~ (미사용 — 행정처분 비교표 삭제됨) | `study-aids.js:363` | (참고용 잔존, `renderStudyAids()`에서 미호출) |

> 같은 화장품 분야 내에서 교재 버전이 바뀌는 경우 수정 불필요

### 6순위: `src/trainer-calc.js` — **조건부** (계산 문제 유형)

| 하드코딩 대상 | 위치 | 수정 조건 |
|---------------|------|----------|
| 4가지 계산 유형 (원료 배합량, 혼합 평균 농도, 한도 내 최대 추가량, 희석 농도) | `trainer-calc.js:11-103` | 완전히 다른 분야 교재로 변경 시 |

> 화장품 조제 분야의 계산 문제에 특화. 같은 분야 내에서는 수정 불필요

### 7순위: `src/keyword-index.js` — **불필요** (자동 생성)

빌드 도구(`tools/build/build_keyword_index.js`)가 `content/exams/cosmetic/참조자료/`에서 자동 생성. 교재가 바뀌면 **재빌드만 하면 됨**.

### 요약 매트릭스

| 파일 | 등급 | 같은 분야 교재 변경 | 다른 분야 교재 변경 |
|------|------|-------------------|-------------------|
| `pdf-registry.js` | **필수** | ⚠️ 수정 (참조자료 매핑) | ⚠️ 수정 |
| `reader-format.js` | 조건부 | ✅ 수정 불필요 | ⚠️ 참조자료 폴더명 패턴만 수정 (문제은행 경로는 동적 조회) |
| `app.js` | ✅ 개선 | ✅ 수정 불필요 | ✅ 수정 불필요 (`manifest.json` `uiText`에서 동적) |
| `index.html` | 조건부 | ✅ 수정 불필요 (연도 제외) | ⚠️ 자격증명 수정 |
| `study-aids.js` | 조건부 | ✅ 수정 불필요 | ⚠️ 단위/키워드 수정 |
| `trainer-calc.js` | 조건부 | ✅ 수정 불필요 | ⚠️ 계산 유형 수정 |
| `keyword-index.js` | 불필요 | ✅ 재빌드만 | ✅ 재빌드만 |

> **결론**: `pdf-registry.js`가 유일한 필수 수정 파일이며, 같은 화장품 분야 내에서 교재 버전이 바뀌는 경우에는 이 파일만 수정하면 된다. 완전히 다른 분야로 교재가 바뀌는 경우에만 추가 수정이 발생한다.

---

## 📚 관련 문서

- [`README.md`](../../README.md) — 프로젝트 소개 및 시작 가이드 (폴더 구조 포함)
- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — Vercel 배포 및 오디오 호스팅 가이드
- [`AUDIO_HOSTING_GUIDE.md`](AUDIO_HOSTING_GUIDE.md) — 오디오북 호스팅 및 청취 가이드
- [`MULTI_MACHINE_SETUP.md`](MULTI_MACHINE_SETUP.md) — 다중 머신 개발 환경 설정
- [`CHANGES.md`](CHANGES.md) — 코드 리뷰 및 아키텍처 개편 수정 이력 (Changelog)
- [`MD_TO_HTML_LOGIC.md`](MD_TO_HTML_LOGIC.md) — MD→HTML 변환·표시 로직 기술 문서
- [`TESTING.md`](TESTING.md) — 테스트 가이드·정책 (unit + DOM)
- [`DOM_TEST_DESIGN.md`](DOM_TEST_DESIGN.md) — jsdom UI 시나리오 테스트 설계 (helpers·모킹 전략·Playwright 확장 경로)
- [`SPEC.md`](SPEC.md) — 요구사양 명세서 (기능 ID별 구현 상태, UI/UX 재사용 가이드 §4.8)
- [`FORMULA_OS_DESIGN.md`](FORMULA_OS_DESIGN.md) — Formula OS 도메인 설계
- [`FORMULA_OS_WORKFLOW_DESIGN.md`](FORMULA_OS_WORKFLOW_DESIGN.md) — 배치·고객·원료 장부 업무 플로우 설계
- [`SUPABASE_DESIGN.md`](SUPABASE_DESIGN.md) — Supabase 계정·클라우드 동기화 설계안 (Phase 1~2 구현 완료 — §10)
- [`Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md`](Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md) — SMTP·매직링크·OTP 설정 가이드
