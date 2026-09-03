# 🏛️ 설계 컨셉 & 아키텍처 (Architecture & Design Concept)

> **대상 프로젝트**: Cosmetic Pass Master — 맞춤형화장품 조제관리사 스마트 학습 플랫폼
> **최종 업데이트**: 2026-09-03
> **목적**: 시스템의 설계 철학, 아키텍처 구조, 주요 설계 결정 사항을 설명

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
9. [테마 시스템 (라이트/다크)](#-테마-시스템-라이트다크)
10. [PWA & 오프라인 전략](#-pwa--오프라인-전략)
11. [Service Worker 동작 메커니즘](#-service-worker-동작-메커니즘)
12. [반응형 & 모바일 설계](#-반응형--모바일-설계)
13. [보안 설계](#-보안-설계)
14. [빌드 타임 데이터 파이프라인](#-빌드-타임-데이터-파이프라인)
15. [주요 설계 결정 및 근거](#-주요-설계-결정-및-근거)
16. [향후 확장 방향](#-향후-확장-방향)
17. [`content/` 내용 변경 시 수정 파일 및 절차 가이드](#content-내용-변경-시-수정-파일-및-절차-가이드)

---

## 🎯 설계 철학 (Design Philosophy)

본 프로젝트는 다음 4가지 핵심 원칙 위에 설계되었습니다.

### 1. **Zero-Backend (서버리스 정적 아키텍처)**
- 별도의 백엔드 서버, 데이터베이스, 인증 시스템 없이 **순수 프론트엔드만으로 완결**되는 애플리케이션
- 학습 데이터 중 **시험 문항·성분 사전은 빌드 타임 JS 번들**, **교재 본문·카드·퀴즈는 `content/*.md`를 런타임에 fetch+파싱**하여 사용 (2026-08-24~ 런타임 MD 전환)
- 사용자 진행 상황은 `localStorage`에만 저장 → 계정/로그인 불필요
- **근거**: 개인 학습 도구 특성상 서버 운영 비용·복잡성을 제거하고, Vercel 묵료 정적 호스팅으로 무한 확장 가능

### 2. **Vanilla First (프레임워크 묵 의존)**
- React/Vue 같은 프레임워크나 빌드 도구(Webpack/Vite) 없이 **순수 HTML/CSS/JavaScript**로 구현
- 외부 런타임 라이브러리 최소화 (차트도 직접 SVG 생성)
- **근거**:
  - 빌드 스텝 제거 → 소스 = 배포물, 디버깅 단순화
  - 브라우저가 곧 런타임 → 장기 유지보수 시 프레임워크 버전 종속성 리스크 제거
  - 번들 크기 최소화 → 모바일 환경에서 빠른 초기 로드

### 3. **Offline-Capable PWA (오프라인 우선)**
- Service Worker로 App Shell과 학습 데이터를 캐시하여 **지하철 등 묵인터넷 환경에서도 학습 가능**
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
│ │   index.html (App Shell)  +  style.css (디자인 시스템)    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                    Application Layer                     │ │
│ │  ┌─────────┐ ┌─────────┐ ┌────────────┐ ┌────────────┐ │ │
│ │  │ app.js  │ │router.js│ │scratchpad  │ │trainer-    │ │ │
│ │  │ (초기화· │ │ (SPA    │ │  .js       │ │ calc.js    │ │ │
│ │  │ 이벤트) │ │ 라우팅) │ │ (캔버스)   │ │ (문제생성) │ │ │
│ │  └─────────┘ └─────────┘ └────────────┘ └────────────┘ │ │
│ │  ┌─────────┐ ┌─────────┐ ┌────────────┐                │ │
│ │  │state.js │ │utils.js │ │ ui-utils   │  sanitize.js  │ │
│ │  │ (상태·  │ │ (초성·  │ │ (로딩UI)   │  (보안 유틸)   │ │
│ │  │  영속성)│ │  헬퍼)  │ └────────────┘                │ │
│ │  └─────────┘ └─────────┘                                │ │
│ │  ┌─────────┐ ┌──────────────┐                          │ │
│ │  │types.js │ │reader-format │  navigation.js           │ │
│ │  │(JSDoc   │ │  .js         │  (뷰 전환 유틸)           │ │
│ │  │ 타입)   │ │ (리더 포맷)  │                          │ │
│ │  └─────────┘ └──────────────┘                          │ │
│ │  ┌──────────────┐ ┌──────────────┐                     │ │
│ │  │pdf-registry │ │html-viewer   │  (MD 참조자료 뷰어)    │ │
│ │  │  .js         │ │  .js         │  (fetch+DOM+검색+PDF)  │ │
│ │  └──────────────┘ └──────────────┘                     │ │
│ │  ┌──────────────────────────────────────────────────┐  │ │
│ │  │  views/ (뷰 컨트롤러 모듈)                          │  │ │
│ │  │  dashboard · flashcard · quiz · daily-challenge    │  │ │
│ │  │  trainer · pomodoro · dictionary · backup          │  │ │
│ │  │  textbook-search · textbook-reader · exam-simulator│  │ │
│ │  │  glossary-renderer · navigation                    │  │ │
│ │  └──────────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                       Data Layer                         │ │
│ │  registry.js · ingredients_data.js · audio_manifest.js    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                    Persistence Layer                     │ │
│ │   localStorage (학습 진행·설정)  +  Cache Storage (SW)   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │ 정적 파일 서빙                       │ MP3 스트리밍 (캐시 제외)
┌────────┴──────────┐                ┌────────┴──────────┐
│   Vercel (CDN)    │                │  외부 오디오 CDN   │
│  - App Shell      │                │  (302MB, 선택적)   │
│  - 데이터 번들     │                └───────────────────┘
│  - content/*.md   │
└───────────────────┘
```

---

## � 프로젝트 루트 파일 분류

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
| `src/` | 애플리케이션 소스 코드 (ESM 모듈 + 뷰 컨트롤러) |
| `css/` | UI 모듈별 스타일시트 (`base`, `dashboard`, `study`, `exam`, `trainer`, `reader`) |
| `data/` | 빌드 산출물 (레지스트리, 과목/시험/성분 번들, MD 폴백) |
| `content/` | 교재 MD 원본(`교재/`), 문제은행(`문제은행/`), 참조자료(`참조자료/`), 학습안내서, 오디오북 파이프라인, report, utils |
| ~~`exams/`~~ | (삭제됨 — `content/문제은행/`로 이동) |
| `docs/` | 프로젝트 문서 (`dev/` 개발 문서, `user/` 사용자 문서) |
| `tools/` | 빌드 스크립트, 로컬 개발 서버, 검증 도구 |
| `tests/` | 자동화 테스트 (`unit/` Node.js, `dom/` Vitest+jsdom) |
| `vendor/` | 자체 호스팅 라이브러리 (FontAwesome, 웹폰트, Mermaid.js) |
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
├── css/                        # UI 모듈별 스타일시트
│   ├── base.css                #   전역, 레이아웃, 네비게이션, 스크롤바
│   ├── dashboard.css           #   대시보드
│   ├── study.css               #   플래시카드, 퀴즈
│   ├── exam.css                #   모의고사, 배지
│   ├── reader.css              #   교재 리더, 용어집, 학습보조, Mermaid
│   └── trainer.css             #   훈련소, 계산기, 손글씨
│
├── src/                        # 애플리케이션 소스 (ESM)
│   ├── app.js                  #   오케스트레이터 (초기화, 이벤트 위임, 라우터 연결)
│   ├── router.js               #   SPA 라우터 (뷰 타이틀 맵, 네비게이션 디스패치)
│   ├── app-fallback.js         #   ESM 로드 실패 시 자가 복구
│   ├── pwa-install-capture.js  #   beforeinstallprompt 조기 캡처 + SW 등록
│   ├── theme-init.js           #   FOUC 방지 (페인트 전 테마 적용)
│   ├── state.js                #   전역 상태 + localStorage 영속성
│   ├── data-loader.js          #   온디맨드 과목/시험 로딩
│   ├── textbook-parser.js      #   런타임 MD → 카드/퀴즈/챕터 파싱
│   ├── reader-format.js        #   MD→HTML 변환, 링크 재작성, 키워드 자동링크
│   ├── markdown-parser.js      #   범용 MD→HTML 파서
│   ├── pdf-registry.js         #   참조자료 중앙 설정 (과목 변경 시 유일 수정 파일)
│   ├── html-viewer.js          #   참조자료 fetch+DOM 뷰어, 검색, 하이라이트
│   ├── exam-viewer.js          #   문제은행 MD 런타임 뷰어
│   ├── manual-viewer.js        #   학습안내서/매뉴얼 뷰어
│   ├── glossary-query.js       #   용어집 조회 API
│   ├── keyword-index.js        #   교재 셀→참조자료 키워드 매핑 (자동 생성)
│   ├── concept-map.js          #   SVG 마인드맵 (용어집 링크 유지)
│   ├── study-aids.js           #   기출 필터, 숫자 암기표
│   ├── charts.js               #   SVG 레이더/꺾은선 차트 + 툴팁
│   ├── sanitize.js             #   XSS 방어
│   ├── sha256.js               #   안정적 ID 해시
│   ├── web-vitals.js           #   Core Web Vitals (LCP/CLS/INP) 모니터링
│   ├── trainer-calc.js         #   계산 훈련 문제 생성 (순수 로직)
│   ├── scratchpad.js           #   손글씨 Canvas
│   ├── types.js                #   JSDoc @typedef 타입 정의
│   ├── ui-utils.js             #   로딩 UI 공통 유틸
│   ├── utils.js                #   초성 추출, Fisher-Yates 셔플
│   ├── globals.d.ts            #   전역 타입 선언
│   └── views/                  #   뷰 컨트롤러 모듈
│       ├── dashboard.js        #     대시보드 통계
│       ├── flashcard.js        #     3D 플래시카드
│       ├── quiz.js             #     퀴즈 + 복습
│       ├── daily-challenge.js  #     데일리 챌린지 (quiz.js에서 분리)
│       ├── trainer.js          #     훈련소 UI
│       ├── pomodoro.js         #     뽀모도로 타이머 (trainer.js에서 분리)
│       ├── exam-simulator.js   #     모의고사 시뮬레이터
│       ├── textbook-reader.js  #     교재 리더 + 오디오 + Media Session
│       ├── textbook-search.js  #     교재 본문 검색
│       ├── dictionary.js       #     성분 사전
│       ├── backup.js           #     데이터 백업/복원
│       ├── glossary-renderer.js #    용어집 렌더링 + scrollToGlossary()
│       └── navigation.js       #     뷰 전환 유틸
│
├── content/                    # SSOT — 모든 교재/문제/참조자료 원본
│   ├── manifest.json           #   과목/단원/시험/추천링크 메타데이터
│   ├── 학습안내서.md
│   ├── 교재/
│   │   ├── glossary/           #   과목별 큐레이션 용어 정의 JSON (subject1~4)
│   │   ├── law/                #   1과목 (본문 + 이야기형)
│   │   ├── manufacturing/      #   2과목
│   │   ├── safety/             #   3과목
│   │   └── understanding/      #   4과목
│   ├── 문제은행/                #   과목N_문제은행_교재인용.md (4개)
│   ├── 참조자료/
│   │   ├── ref_md/             #   HTML/MD 변환본 (42개, ~26MB)
│   │   ├── 공통/               #   공통 참조자료
│   │   ├── 과목1~4/            #   과목별 참조자료
│   │   ├── 법령원문/           #   법령 원문
│   │   └── 원료/               #   성분 원본 MD
│   ├── audiobook/              #   Python TTS 파이프라인
│   │   ├── run_pipeline.py     #     전체 파이프라인
│   │   ├── md_chunker.py       #     MD 청크 분할
│   │   ├── tts_elevenlabs.py   #     ElevenLabs TTS
│   │   ├── tts_google_direct.py #    Google TTS
│   │   ├── mp3_merger.py       #     MP3 병합
│   │   ├── script_polisher.py  #     스크립트 정제
│   │   ├── generate_all_mp3.py #     전 과목 일괄 생성
│   │   └── mp3/                #     생성된 MP3 (gitignore)
│   └── utils/                  #   Python 변환 스크립트
│       ├── batch_convert.py    #     배치 HTML 변환
│       ├── convert_ref_md.py   #     ref_md HTML→MD 변환
│       ├── check_laws.py       #     법령 업데이트 검사
│       └── md_to_html.py       #     단일 HTML 변환
│
├── data/                       # 빌드 타임 생성 (자동 생성, 직접 수정 금지)
│   ├── registry.js             #   과목/시험/성분 메타
│   ├── audio_manifest.js       #   오디오 챕터 매핑
│   ├── ingredients_data.*.js   #   성분 데이터 (해시 파일명)
│   ├── exams/                  #   시험 데이터 번들 (해시 파일명)
│   ├── exams_md/               #   문제은행 MD 폴백 번들 (file:// 전용)
│   ├── study_md/               #   교재 MD 폴백 번들 (과목별 분할, file:// 전용)
│   ├── docs_md/                #   학습안내서/매뉴얼 MD 폴백 번들
│
├── tools/                      # 빌드/검증 도구
│   ├── build/
│   │   ├── index.js            #   메인 빌드 (registry, exams, ingredients)
│   │   ├── manifest-loader.js  #   manifest.json 검증
│   │   ├── schema.js           #   스키마 검증
│   │   ├── id-factory.js       #   안정적 ID 생성
│   │   ├── build_keyword_index.js # GLOSSARY_INDEX + 큐레이션 병합
│   │   ├── report.js           #   빌드 통계
│   │   ├── stamp-sw-version.js #   SW 캐시 버전 자동 스탬프
│   │   └── plugins/
│   │       ├── textbook.plugin.js
│   │       ├── exams.plugin.js
│   │       └── ingredients.plugin.js
│   ├── build_doc_bundles.js    #   학습안내서/매뉴얼 폴백 번들
│   ├── build_exam_bundles.js   #   문제은행 폴백 번들
│   ├── build_study_md_bundle.js #  교재 폴백 번들 (과목별 분할)
│   ├── check_parser_parity.js  #   빌드 파서 ↔ 런타임 파서 등가성 검증
│   ├── verify-shell-assets.js  #   프리캐시 파일 존재 CI 검증
│   └── fix-mindmap-indent.mjs  #   Mermaid mindmap 들여쓰기 수정
│
├── tests/                      # 자동화 테스트
│   ├── unit/                   #   단위 테스트 (19개 파일, 248 tests)
│   │   ├── delegation-guard.test.js
│   │   ├── glossary-query.test.js
│   │   ├── id-factory.test.js
│   │   ├── markdown-parser-general.test.js
│   │   ├── mermaid-*.test.js   #   Mermaid 렌더링 (5개)
│   │   ├── pdf-registry.test.js
│   │   ├── reader-format-general.test.js
│   │   ├── sanitize.test.js
│   │   ├── sha256.test.js
│   │   ├── state.test.js
│   │   ├── study-aids.test.js
│   │   ├── textbook-parser.test.js
│   │   ├── trainer-calc.test.js
│   │   └── utils.test.js
│   └── dom/                    #   DOM 테스트 (Vitest + jsdom)
│       ├── backup.dom.test.js
│       └── router.dom.test.js
│
├── vendor/                     # 자체 호스팅 라이브러리
│   ├── fontawesome/
│   │   ├── css/all.min.css
│   │   └── webfonts/           #   .woff2, .ttf
│   ├── fonts/
│   │   ├── fonts.css           #   @font-face 정의
│   │   ├── noto-sans-kr-*.woff2 #  5 가중치
│   │   └── outfit-*.woff2      #   4 가중치
│   └── mermaid/
│       └── mermaid.min.js      #   3.3MB, 온디맨드 로드
│
└── docs/                       # 프로젝트 문서
    ├── README.md               #   문서 인덱스
    ├── dev/                    #   개발자 문서
    │   ├── ARCHITECTURE.md     #     아키텍처 설계서 (본 문서)
    │   ├── SPEC.md             #     요구사양 명세서
    │   ├── CHANGES.md          #     변경 이력
    │   ├── TESTING.md          #     테스트 가이드
    │   ├── DEPLOYMENT_GUIDE.md #     배포 가이드
    │   ├── MULTI_MACHINE_SETUP.md
    │   ├── FLASHCARD_LOGIC.md
    │   ├── MD_TO_HTML_LOGIC.md
    │   ├── TEXTBOOK_AUTHORING_GUIDE.md
    │   ├── AUDIO_HOSTING_GUIDE.md
    │   └── SUBSCRIPTION_ROADMAP.md
    ├── report_archive/         #   분석 보고서 아카이브 (앱 미참조)
    └── user/
        └── user_manual.md      #   사용자 매뉴얼
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
- 9개의 `<section class="view-section">`이 하나의 HTML에 공존
- `switchView(targetView)`가 `.active` 클래스를 토글하여 화면 전환 (페이지 리로드 없음)
- 뷰 목록: dashboard / flashcard / quiz / review / trainer / exam / textbook / textbook-reader / dictionary

### 2. Application Layer (응용 계층)

| 모듈 | 책임 |
|------|------|
| [`src/app.js`](../../src/app.js) | **메인 오케스트레이터**. 초기화(`initApp`), **이벤트 위임 바인딩**(`data-click`/`data-input`/`data-args` + `resolveDelegatedHandler`/`parseDelegatedArgs`), `startFocusSubjectStudy` 등 뷰 간 브릿지 함수. `populateExamCards()`로 registry 기반 시험 카드 동적 생성. 라우팅은 `router.js`에 위임 |
| [`src/router.js`](../../src/router.js) | **SPA 라우터**. `getViewTitles()`로 뷰 타이틀/서브타이틀 맵 생성, `navigateToView()`로 뷰 전환 디스패치 (active 클래스 토글, 헤더 갱신, 뷰 렌더러 호출, 오디오 정지, 포커스 모드 해제) |
| [`src/charts.js`](../../src/charts.js) | SVG 기반 차트 생성 (레이더 차트, 성적 꺾은선 그래프). **인터랙티브 툴팁**(hover/touch) 지원. 외부 차트 라이브러리 미사용 |
| [`src/scratchpad.js`](../../src/scratchpad.js) | HTML5 Canvas 손글씨 연습장 (계산 문제 풀이용) |
| [`src/trainer-calc.js`](../../src/trainer-calc.js) | 계산 훈련 문제 생성기. **순수 로직** — DOM 의존 없이 문제 데이터 객첼만 반환 |
| [`src/state.js`](../../src/state.js) | 전역 상태 객체(`state`) 정의 + localStorage 영속성(`loadProgress`/`saveProgress`). 기본 과목은 `null`이며 `initApp()`에서 registry 첫 과목으로 설정 |
| [`src/utils.js`](../../src/utils.js) | 의존성 없는 범용 헬퍼 (한글 초성 추출 `getChosung()` 등) |
| [`src/sanitize.js`](../../src/sanitize.js) | HTML/XSS 방어 및 텍스트 정제 유틸리티 |
| [`src/pdf-registry.js`](../../src/pdf-registry.js) | 참조자료 중앙 설정 모듈. 과목별 참조자료 매핑, 출처→PDF 파일명 매핑, MD 변환본 경로 자동 생성 (`REF_DIRS`, `resolveRefPath`, `mapSourceToRef`). 원본 PDF는 `.vercelignore`로 배포 제외, `ref_md/*.md` 변환본(3.7MB)으로 인앱 뷰어+PDF 저장 지원 |
| [`src/html-viewer.js`](../../src/html-viewer.js) | 앱 내 HTML/MD 참조자료 뷰어. `fetch()`+`DOMParser`(HTML) 또는 `parseMarkdown()`(MD)로 로드 후 DOM 직접 주입 (iframe 없음). **키워드 기반 스크롤**: `KEYWORD_INDEX`에서 추출한 셀 텍스트 키워드로 검색→첫 번째 하이라이트로 스크롤 (L###은 스크롤에 사용하지 않음). **성능 최적화**: sessionStorage 캐싱(24h TTL)으로 재방문 시 즉시 렌더링, span 일괄 제거(normalize 호출 최소화), 검색 조기 종료(첫 매치 즉시 스크롤 + 나머지 `requestIdleCallback` 지연 하이라이트). 텍스트 노드 순회 검색 + `<mark>` 하이라이트, 검색 결과 내비게이션(이전/다음), 인쇄 지원. **PDF 저장** (v210 도입): 인쇄 전용 CSS로 오버레이 제약 없이 전체 문서를 브라우저 인쇄 다이얼로그로 출력 → "PDF로 저장" 선택 가능 |
| [`src/reader-format.js`](../../src/reader-format.js) | 교재 리더 본문 포맷터. `parseMarkdown()` + HTML 참조 링크 변환 (`data-ref-html`, `data-ref-search`) + 참조자료 인라인 렌더링 |
| [`src/exam-viewer.js`](../../src/exam-viewer.js) | 문제집(MD) 런타임 뷰어. `content/문제은행/*.md` fetch → 자체 MD→HTML 변환 → 인앱 전체화면 오버레이 렌더링. TOC 생성·인쇄·sessionStorage 캐시(24h)·`file://` 번들 폴리백(`data/exams_md/*.js`) 지원. **시험 제목은 registry에서 동적 조회** (하드코딩 없음) |

| 파일 | 내용 | 생성 주체 |
|------|------|-----------|
| [`data/registry.js`](../../data/registry.js) | 시험/성분 번들 목록·메타 + 과목 목록/통계 + 추천 링크. **과목 `shortName`**, 시험 **`file`**, **`resources`** 필드 포함 → 소스 코드 하드코딩 제거 | `tools/build/index.js` |
| [`content/**/*.md`](../../content/) + [`content/manifest.json`](../../content/manifest.json) | **교재/카드/퀴즈/시험/추천링크의 원본 (SSOT).** `manifest.json`에 과목 `shortName`, 시험 `file`, `resources`(추천 링크·채널 요약) 등 메타 포함 → 소스 코드 하드코딩 없이 전체 콘텐츠 교체 가능 | 저자 직접 작성 |
| [`data/study_md/`](../../data/study_md/) | 교재 MD `file://` 폴백 번들 (**과목별 분할**: manifest.js + 과목별 `.js`). http에선 미사용. 과목 로드 시 해당 파일만 온디맨드 로드 | `tools/build_study_md_bundle.js` |
| [`data/exams/<key>.<hash>.js`](../../data/exams/) | 시험별 문항 번들 | `tools/build/index.js` (exams plugin) |
| [`data/ingredients_data.<hash>.js`](../../data/) | 화장품 성분 사전 (가용/금지/제한) | `tools/build/index.js` (ingredients plugin) |
| [`data/id_migration.js`](../../data/id_migration.js) | 레거시 ID → 안정 ID 일회성 매핑 | `tools/build/index.js` (id-factory) |
| [`data/audio_manifest.js`](../../data/audio_manifest.js) | 오디오 파일 경로 매니페스트 | 오디오북 파이프라인 |

> ⚠️ `data/subjects/<key>.<hash>.js`(과목 학습 번들)는 **2026-08-24부터 런타임 MD 파싱으로 대체·제거**되었다. 디렉토리 자체도 삭제되었으며, `npm run build:data`가 재생성하더라도 앱은 로드하지 않고 배포에서도 제외(`.vercelignore`)된다.

**특징**: 시험/성분 번들은 전역 상수 JS로 `<script>` 로드만으로 즉시 사용(오프라인 핵심). 교재/카드/퀴즈는 `content/*.md`를 런타임 fetch(http, SW `Cache First`로 오프라인 대응)하거나 `file://`에선 `data/study_md/` 과목별 분할 폴백을 사용한다.

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

<body> 하단 (DOMContentLoaded 이후)
  3. data/registry.js       (type=module — 번들 메타, window.DATA_REGISTRY 할당)
  4. data/audio_manifest.js (type=module — 오디오 경로, window.AUDIO_MANIFEST 할당)
  5. vendor/mermaid/mermaid.min.js (defer — 다이어그램 렌더링)
  6. src/app.js             (type=module — ESM 진입점, 모든 src/ 모듈을 내부 import)
  7. src/app-fallback.js    (defer — ESM 로드 실패 시 자동 복구, app.js와 독립 실행)
```

### 모듈화 전략: "점진적 모듈화 (Progressive Modularization)"

거대한 단일 `app.js`(원래 약 4,900줄)를 한 번에 ES Modules로 전환하는 대신, **부수효과 없는 순수 로직부터 글로벌 스코프 스크립트로 점진 분리**하는 전략을 채택했습니다. 2026-09-03 기준 `app.js`는 **약 1,300줄**로 축소되었고, 라우팅 로직은 `router.js`로 분리, 11개 뷰 컨트롤러 모듈이 `src/views/`에 분리되었습니다.

**분리 원칙**:
1. **DOM 의존성 없는 순수 로직 우선 분리** → `trainer-calc.js`(문제 생성), `utils.js`(초성 추출), `reader-format.js`(리더 포맷터)
2. **상태·영속성 로직 분리** → `state.js`
3. **뷰 컨트롤러 분리** → `src/views/` 디렉터리에 과목별/기능별 모듈 추출
4. **공통 UI 유틸 분리** → `ui-utils.js`(로딩 오버레이) — 순환 의존성 방지
5. **ES Modules 전환 대비**: 각 파일을 `export` 추가만으로 변환 가능하도록 순수 선언으로 구성

```
[분리 완료]
utils.js (헬퍼·Fisher-Yates shuffle)  views/backup.js (백업/복원)
trainer-calc.js (문제 생성)       views/textbook-search.js (교재 검색)
state.js (상태·영속성)            views/textbook-reader.js (리더+오디오+Media Session)
charts.js (시각화+인터랙티브 툴팁) views/exam-simulator.js (모의고사+오답 복습)
sanitize.js (보안)                views/dashboard.js (대시보드)
scratchpad.js (캔버스)            views/flashcard.js (플래시카드)
reader-format.js (리더 포맷터+키워드 자동링크+L### 확장)    views/quiz.js (퀴즈+복습)
ui-utils.js (로딩 UI)             views/daily-challenge.js (데일리 챌린지)
types.js (JSDoc 타입 정의)        views/trainer.js (훈련소)
html-viewer.js (참조자료 뷰어+키워드 스크롤+PDF 저장)    views/pomodoro.js (뽀모도로 타이머)
pdf-registry.js (참조자료 레지스트리+KEYWORD_REF_MAP 자동링크)  views/dictionary.js (성분 검색)
keyword-index.js (KEYWORD_INDEX: 교재 셀→참조자료 키워드 매핑)  views/navigation.js (뷰 전환 유틸)
markdown-parser.js (MD→HTML 파서)  views/glossary-renderer.js (용어집 렌더링)
router.js (SPA 라우터: 타이틀 맵+네비게이션 디스패치)
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

- **낵스port**: `exportData()` → 허용 키만 추출 → JSON 다운로드
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
| **세션 상태** | 현재 퀴즈 진행 인덱스, 필터 | 메모리만 | 새로고침 시 초기화가 자연스러움 |
| **파생 상태** | 대시보드 통계, 차트 데이터 | 렌더 시 계산 | 원본으로부터 계산 가능 (중복 저장 방지) |

### Set 사용 근거
`memorizedCards`, `weakCards`에 `Set`을 사용하여 **O(1) 조회 + 자동 중복 제거**를 보장합니다. localStorage 저장 시에는 `Array.from()`으로 직렬화, 로드 시 `new Set()`으로 복원합니다.

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
| 2 | 시험/성분 데이터 번들 (`data/exams/*.hash.js`, `data/ingredients_data.*.js`) · 교재 원본 (`content/*.md`) | **Cache First** | 해시 파일명/정적 MD로 자연 갱신, 오프라인 학습 핵심. 교재 MD는 최초 fetch 시 캐시됨 |
| 3 | 외부 CDN (Google Fonts) | **Stale-While-Revalidate** | 외부 리소스 안정성 확보. FontAwesome은 2026-08-24부터 자체 호스팅([`vendor/fontawesome/`](../../vendor/fontawesome/))으로 전환하여 CDN 의존 제거, App Shell 프리캐시에 포함 |
| 4 | MP3 오디오 (302MB) | **네트워크 직행 (바이패스)** | 대용량 미디어는 캐시 제외 (저장공간 보호) |
| 5 | `/src/` 하위 JS 모듈 | **Cache First** | ESM import 그래프는 한 모듈이라도 버전이 어긋나면 전체가 드랍됨. `Network First`를 쓰면 모바일 불안정 네트워크에서 일부는 신버전(네트워크), 일부는 구버전(캐시)이 섞여 import 그래프 붕괴. `Cache First` + `SHELL_ASSETS` 프리캐시로 동일 버전 파일만 일관 서빙 (v38부터 적용) |
| 6 | CSS (`*.css`) | **Cache First** | 배포 전환 순간 "구버전 HTML(cacheFirst) + 신버전 CSS(networkFirst)" 혼합으로 화면 깨짐 방지. `/src/` JS와 동일 사유로 `cacheFirst` + `SHELL_ASSETS` 프리캐시로 세대 일관성 확보 (2026-08-26 수정) |
| 7 | 그 외 JS (`*.js`) | **Network First** | 온라인이면 항상 최신 배포본 제공, 오프라인이면 캐시 폴리백. `CACHE_VERSION` 범프를 깜빡핬어도 모바일에 구버전이 남지 않도록 함 |
| 8 | 그 외 App Shell (아이콘/이미지 등) | **Stale-While-Revalidate** | 빠른 표시 + 백그라운드 갱신 |

### 캐시 버전 관리
- `CACHE_VERSION` 상수로 캐시 네임스페이스 관리 (빌드 시 자동 갱신)
- **빌드 타임 자동 치환**: `tools/build/stamp-sw-version.js`가 빌드 완료 시 `CACHE_VERSION`을 `${prefix}-${YYYYMMDD}-${gitShort}` 형태로 자동 갱신 → 수동 관리 불필요
- **배포 시 버전을 올리면 구 캐시 자동 정리** → 모바일 구버전 고착(Stale Cache) 문제 방지
- `SHELL_ASSETS`에는 [`src/utils.js`](../../src/utils.js), [`src/trainer-calc.js`](../../src/trainer-calc.js) 등 분리된 모듈이 모두 프리캐시에 포함됨
- `data/registry.js`, `data/audio_manifest.js`도 프리캐시에 포함 (2026-08-25, window 전역 참조 방식 전환으로 모듈 그래프에서 분리되어 별도 캐싱 필요)

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
  - 이 한 줄이 모바일 콜드스타트/저속망에서 프로브가 일시 실패핮라도 가짜 배너가 뜨는 것을 원천 차단합니다. (v11)
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
  ├─ *.md?
  │     ├─ /ref_md/ 경로? ──► Cache First (DATA_CACHE) — 배포 간 유지 (26MB 참조자료)
  │     └─ 그 외? ──► Cache First (SHELL_CACHE) — 정적 마크다운 원본
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

---

## 📱 반응형 & 모바일 설계

### 적응형 네비게이션 (Adaptive Navigation)

| 화면 | 네비게이션 | 구현 |
|------|-----------|------|
| **데스크톱** (>768px) | 좌측 사이드바 | `.sidebar` 표시, `.mobile-tab-bar` 숨김 |
| **모바일** (≤768px) | 하단 탭 바 | `.sidebar` 숨김, `.mobile-tab-bar` 표시 (10개 메뉴, 가로 스크롤) |

### 모바일 최적화 기법

1. **동적 뷰포트**: `100dvh` 사용 → 모바일 브라우저 주소창 표시/숨김에 따른 레이아웃 점프 방지
2. **Safe Area 대응**: `env(safe-area-inset-bottom)` → iPhone 홈 인디케이터 영역 자동 확보
3. **스크롤 위치 복원**: 뷰 전환 시 `saveScrollPosition()`/`restoreScrollPosition()`으로 이전 위치 기억
4. **터치 타겟**: 최소 44×44px 터치 영역 확보
5. **그리드 종열 전환**: 데스크톱 다열 그리드(성적 분석 3열 등) → 모바일 세로보기에서 `1fr` 단일 열로 자동 전환

### CSS 설계 원칙
- **CSS 변수 기반 디자인 토큰**: `--color-primary`, `--bg-card`, `--radius-md` 등으로 테마 일관성 유지
- **모바일 미디어 쿼리는 파일 후반부 배치**: CSS 캐스케이드 우선순위 확보 (동일 특이성 시 나중 선언이 승리)
- **인라인 스타일 오버라이드 패턴**: HTML 인라인 `grid-template-columns` 등은 모바일에서 `[style*="..."]` 속성 선택자 + `!important`로 재정의

---

## 🔒 보안 설계

본 프로젝트는 사용자 입력이 교재 검색, 백업 복원, 캔버스 등 다양한 경로로 유입되므로 다음 방어 계층을 둡니다.

### 1. XSS 방어 ([`src/sanitize.js`](../../src/sanitize.js))
- 사용자 데이터를 DOM에 삽입할 때 텍스트 정제(sanitize) 적용
- 신뢰할 수 있는 코드 생성 HTML(숫자 + `<strong>` 등)만 `innerHTML` 허용, raw 사용자 입력은 이스케이프

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

## ⚙️ 데이터 파이프라인 (빌드 타임 + 런타임)

시험 문항·성분 사전은 빌드 타임에 해시드 번들로 생성하고, **교재 본문·카드·퀴즈는 런타임에 `content/*.md`를 직접 파싱**합니다(재빌드 없이 최신 반영).

```
[원본 콘텐츠]                [변환]                              [산출/소비]
content/manifest.json ──► tools/build/index.js        ──► data/registry.js (과목목록·시험·성분 메타)
content/exams/**/*.md       ──► (exams plugin)             ──► data/exams/<key>.<hash>.js
content/ingredients/*.md ──► (ingredients plugin)       ──► data/ingredients_data.<hash>.js

content/**/*.md ───(런타임 fetch)──► src/data-loader.js + src/textbook-parser.js ──► STUDY_DATA (카드/퀴즈/챕터)
content/**/*.md ───(file:// 폴백)──► tools/build_study_md_bundle.js ──► data/study_md/ (과목별 분할)
```

**특징**:
- **SSOT**: `content/manifest.json` + `content/**/*.md`가 교재/카드/퀴즈의 단일 진실 원천
- **런타임 파싱**: `src/textbook-parser.js`가 브라우저에서 카드/퀴즈/챕터를 조립. 카드/퀴즈 안정 ID는 `src/sha256.js`(Node `crypto`와 동일)로 재현되어 진도 보존
- **재빌드 불필요**: `content/*.md` 수정 시 http 배포는 즉시 반영. `file://` 지원이 필요할 때만 `npm run build:study-md` 실행 (과목별 분할 번들 생성)
- **온디맨드 로딩**: `src/data-loader.js`가 필요한 과목/시험만 로드하고, 로드 후 registry stats를 실제 개수로 갱신
- **해시 파일명(시험/성분)**: 번들 내용이 바뀌면 파일명도 바뀌어 캐시 무효화가 자연스럽게 이루어짐

**오디오북 파이프라인** ([`content/audiobook/`](../../content/audiobook/README.md))은 Python 기반 별도 파이프라인으로, MD 청크 분할 → TTS → MP3 병합을 수행합니다.

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

---

## ⚖️ 주요 설계 결정 및 근거

| 결정 | 선택 | 대안 | 근거 |
|------|------|------|------|
| **아키텍처** | Zero-Backend 정적 SPA | 서버 + DB | 개인 학습 도구, 운영비 0, Vercel 묵료 배포 |
| **프레임워크** | Vanilla JS | React/Vue | 빌드 불필요, 장기 유지보수성, 번들 최소화 |
| **상태 관리** | 단일 전역 객체 + localStorage | Redux/MobX | 규모 대비 복잡도 과다, 직렬화 단순성 |
| **차트** | 직접 SVG 생성 | Chart.js 등 | 외부 의존성 제거, 가벼움, 커스터마이징 자유 |
| **데이터 로딩** | 시험/성분: JS 상수 `<script>` · 교재/카드/퀴즈: 런타임 MD fetch+파싱 | 전량 번들 또는 전량 백엔드 | 시험/성분은 오프라인 단순화, 교재는 재빌드 없이 최신 반영 + 표현 중복 제거 |
| **모듈 시스템** | 글로벌 스코프 + 점진 분리 | ES Modules 즉시 전환 | 리스크 최소화, `export` 추가만으로 전환 가능하게 준비 |
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
   - Vitest + jsdom으로 DOM 렌더링/이벤트 테스트 기반 구축 (259 tests: 248 unit + 11 DOM)
   - GitHub Actions CI로 push 시 자동 테스트 실행

4. **타입 안정성 도입** ✅
   - JSDoc `@typedef` 타입 정의 구축 (`src/types.js`, 217줄)
   - `jsconfig.json` checkJs로 편집기 타입 검사/자동완성 활성화

5. **백엔드 연동 확장성 (필요 시)**
   - 상태 영속성 계층(`state.js`의 `saveProgress`)을 추상화핛두어, 향후 클라우드 동기화 시 해당 지점만 API 호출로 교체 가능하도록 설계

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

14. **교재 리더 인터랙티브 개념 맵** 🔁 (2026-09-01 축소 → 용어집 링크로 재활용)
   - `src/concept-map.js`: 순수 SVG 마인드맵 생성기 — 개념 맵 컨테이너는 삭제되었으나, **용어집 링크 클릭 시 `scrollToGlossary()` 공유 함수로 재활용** 중
   - `textbook-reader.js`에서 개념 맵 컨테이너 HTML, `renderConceptMap` 호출, 토글 이벤트 제거 — `concept-map.js`는 용어집 점프 기능 유지

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
   - `content/교재/glossary/subject{1-4}.json`: 과목별 큐레이션 용어 정의 파일 (수작성)
   - `tools/build/build_keyword_index.js`: 빌드 시 JSON 파일을 읽어 `GLOSSARY_INDEX`의 `explanation`을 큐레이션 정의로 덮어쓰기, `curated: true` 플래그 추가
   - `src/views/textbook-reader.js`: 용어집 테이블 헤더 "설명 (참조문서 발췌)" → "설명"으로 변경
   - `css/reader.css`: 용어집 테이블 `table-layout: fixed` 적용 — 과목별 컬럼 폭 일관성 확보
   - JSON 파일은 빌드 타임 전용이므로 SW 캐시 불필요 (빌드 결과가 `src/keyword-index.js`에 합쳐짐)

18. **HTML 뷰어 스크롤바 가시성 수정** ✅ (2026-09-01)
   - **문제**: `css/base.css` 전역 스크롤바 색상이 `rgba(255,255,255,0.1)` (흰색 반투명) → HTML 뷰어의 흰 배경에서 스크롤바가 안 보임
   - **해결**: `src/html-viewer.js`에 뷰어 전용 스크롤바 스타일 추가 (`#888` thumb, `#f0f0f0` track, 12px 폭)
   - **구조 개선**: 오버레이를 flexbox에서 절대 위치(`position:fixed`) 기반으로 변경 — 브라우저별 flexbox 구현 차이에 영향받지 않고 스크롤 영역 확보

---

## 📋 `content/` 내용 변경 시 수정 파일 및 절차 가이드

> `content/` 폴더의 마크다운 원문, 폴더 구조, 또는 매니페스트가 변경될 때 수행해야 할 수정 작업과 빌드/배포 절차를 정리합니다.

### 변경 유형별 수정 파일 매트릭스

| 변경 유형 | 수정 필요 파일 | 설명 |
|-----------|---------------|------|
| **교재 MD 내용 수정** (기존 파일) | (수정 불필요) | `manifest.json`의 `dir`/`file` 필드가 경로를 참조하므로, 파일명이 같으면 자동 반영 |
| **교재 MD 파일 추가/삭제/이름 변경** | `content/manifest.json` | `subjects[].chapters[].file` 필드 갱신 |
| | `sw.js` | `MD_ASSETS` 배열의 경로 갱신 + `CACHE_VERSION` 버전업 |
| | `content/utils/batch_convert.py` | `BATCH_TARGETS["교재"]` 경로 갱신 |
| **문제은행 MD 변경** | `content/manifest.json` | `exams` 섹션의 파일 경로 갱신 |
| | `content/utils/batch_convert.py` | `BATCH_TARGETS["문제은행"]` 경로 갱신 |
| **참조자료 MD/HTML 변경** | `src/pdf-registry.js` | 참조자료 파일 목록·경로 매핑 (중앙 설정 모듈, HTML 변환본 경로 자동 생성) |
| | `tools/build/plugins/ingredients.plugin.js` | `INGREDIENTS_DIR` 경로 (원료 하위 폴더 변경 시) |
| **학습안내서 MD 변경** | (파일명 동일 시 수정 불필요) | `manual-viewer.js`, `build_doc_bundles.js`, `sw.js`가 `content/학습안내서.md` 경로 참조 |
| | `content/utils/batch_convert.py` | 파일명 변경 시 `BATCH_TARGETS["학습안내서"]` 갱신 |
| **보고서 MD 변경** (`content/report/`) | `content/utils/batch_convert.py` | `BATCH_TARGETS["report"]` 경로 갱신 |
| **새 과목 추가** | `content/manifest.json` | `subjects[]`에 새 과목 항목 추가 (`key`, `name`, `dir`, `chapters`) |
| | `src/pdf-registry.js` | `SUBJECT_DIR_MAP`, `REF_DIRS`, `REFERENCE_FILES`에 새 과목 항목 추가 |
| | `sw.js` | `MD_ASSETS`에 새 과목 MD 경로 추가 |
| | `content/utils/batch_convert.py` | `BATCH_TARGETS["교재"]`에 새 파일 추가 |
| | `content/audiobook/` | 오디오북 파이프라인 스크립트에 새 과목 추가 (필요 시) |
| **폴더 구조 개편** | 위 모든 파일 | 경로가 일괄 변경되므로 모든 참조 파일 검토 필요 |

### 빌드 절차 (content/ 변경 후)

```bash
# 1. 데이터 빌드 (registry, exam bundles, ingredients)
npm run build:data

# 2. 교재 MD 폴백 번들 재생성
npm run build:study-md

# 3. 문서 번들 재생성 (학습안내서, 사용자 매뉴얼)
node tools/build_doc_bundles.js

# 4. 파서 정합성 검증 (선택)
node tools/check_parser_parity.js

# 5. 테스트
npm test

# 6. Python 배치 변환 (독립 HTML 파일 필요 시)
cd content/utils
python batch_convert.py
```

### 배포 절차

```bash
# 1. SW 캐시 버전 갱신 (필수 — 모바일 PWA 반영을 위해)
#    sw.js의 CACHE_VERSION을 갱신
#    형식: v<번호>-<날짜>-<설명> (예: v44-20260831-content-update)

# 2. Git 커밋 & 푸시
git add -A
git commit -m "content: <변경 내용 요약>"
git push

# 3. Vercel 배포
cmd /c vercel --prod 2>&1
```

> **주의**: `CACHE_VERSION`을 갱신하지 않으면 모바일 PWA에서 구버전 캐시가 유지되어 변경사항이 반영되지 않습니다.

### 자동 생성 파일 (수정 금지)

다음 파일들은 빌드 스크립트에 의해 자동 생성되므로 **직접 수정하지 마세요**:

| 파일 | 생성 스크립트 |
|------|-------------|
| `data/registry.js` | `tools/build/index.js` |
| `data/exams/*.hash.js` | `tools/build/index.js` (exams.plugin.js) |
| `data/exams_md/*.js` | `tools/build_exam_bundles.js` |
| `data/study_md/*.js` | `tools/build_study_md_bundle.js` |
| `data/docs_md/*.js` | `tools/build_doc_bundles.js` |
| `data/ingredients_data.*.js` | `tools/build/index.js` (ingredients.plugin.js) |
| `data/id_migration.js` | `tools/build/index.js` (id-factory.plugin.js) |

### 주요 참조 파일 목록 (content/ 경로 의존)

| 파일 | 참조 방식 | 비고 |
|------|----------|------|
| `content/manifest.json` | SSOT — 모든 빌드의 원천 | `subjects[].dir`, `chapters[].file` |
| `sw.js` | `MD_ASSETS` 하드코딩 | 프리캐시 대상 MD 파일 경로 |
| `src/manual-viewer.js` | `MD_SOURCES` 객체 | 학습안내서, 사용자매뉴얼 경로 |
| `src/pdf-registry.js` | `SUBJECT_DIR_MAP`, `REF_DIRS`, `REFERENCE_FILES`, `MD_CONVERSION_TARGETS` | 참조자료 중앙 설정 (HTML/MD 변환본 경로 자동 생성, 대용량 3개는 `.md` 반환, 과목 변경 시 유일 수정 파일) |
| `src/data-loader.js` | `manifest.subjects[].dir` 동적 참조 | 런타임 MD 로드 |
| `src/textbook-parser.js` | `manifest.subjects[].dir` 동적 참조 | 런타임 MD 파싱 |
| `tools/build/manifest-loader.js` | `manifest.json` 검증 | 빌드 시 파일 존재 확인 |
| `tools/build/plugins/textbook.plugin.js` | `subject.dir` 동적 참조 | 빌드 시 MD 파싱 |
| `tools/build/plugins/ingredients.plugin.js` | `INGREDIENTS_DIR` 하드코딩 | `content/참조자료/원료/` |
| `tools/build/plugins/exams.plugin.js` | `manifest.exams` 참조 | 문제은행 MD 처리 |
| `tools/build_doc_bundles.js` | `DOC_FILES` 배열 | 학습안내서, 사용자매뉴얼 번들 |
| `tools/build_study_md_bundle.js` | `manifest.subjects[].dir` 동적 참조 | 교재 MD 폴백 번들 |
| `tools/check_parser_parity.js` | `manifest.subjects[].dir` 동적 참조 | 파서 정합성 검증 |
| `content/utils/batch_convert.py` | `BATCH_TARGETS` 딕셔너리 | 배치 HTML 변환 대상 |
| `content/utils/md_to_html.py` | `--in` 인자 (기본값 `학습안내서.md`) | 단일 HTML 변환 |
| `content/utils/convert_ref_md.py` | `MD_CONVERSION_TARGETS` Set (스크립트 내 하드코딩) | ref_md 대용량 HTML→MD 변환 및 body-only 추출 |
| `content/audiobook/generate_all_mp3.py` | 과목 키 참조 | 오디오북 생성 |

---

## � 교재 변경 시 소스 수정 필요성 검토

> **검토일**: 2026-09-02
> **목적**: 교재 콘텐츠가 변경될 때 소스 코드 수정이 최소화되는지 검증

### 설계 원칙

프로젝트는 **content/manifest.json**을 SSOT(Single Source of Truth)로 사용하여, 교재 원문 교체/과목 추가 시 소스 코드 수정을 최소화하도록 설계되어 있다.

- 교재 원문(`content/교재/*.md`) 교체 → 소스 수정 불필요
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
| `REF_DIRS` | 법령원문/공통/과목별 PDF 파일 목록 | 참조자료 PDF 변경 시 |
| `SOURCE_REF_MAP` | 출처 키워드 → PDF 매칭 정규식 | 법령 개정/참조자료 변경 시 |
| `KEYWORD_REF_MAP` | 본문 키워드 → 자동 링크 매핑 | 별표/규정 변경 시 |
| `REFERENCE_FILES` | 과목별 참조자료 파일 목록 | 과목별 참조자료 변경 시 |
| `REFERENCE_COMMON` | 공통 참조자료 목록 | 공통 참조자료 변경 시 |
| `REFERENCE_LAW` | 법령원문 참조자료 목록 | 법령 개정 시 |

### 2순위: `src/reader-format.js` — **조건부** (파일명 패턴 하드코딩)

| 하드코딩 대상 | 위치 | 수정 조건 |
|---------------|------|----------|
| 기출문제 링크 패턴 `기출문제/과목N_...` | `reader-format.js:21` | 기출문제 파일명 규칙 변경 시 |
| ~~문제은행 경로 `content/문제은행/과목${N}_문제은행_교재인용.md`~~ | ~~`reader-format.js:23`~~ | ✅ **제거됨** — `DATA_REGISTRY.exams[].file`에서 동적 조회 (2026-09-03) |
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
| `PROCEDURE_KEYWORDS` (`신고`, `승인`, `등록` 등) | `study-aids.js:201` | 완전히 다른 분야 교재로 변경 시 |
| `detectAdminPenalty` 키워드 (`행정처분`) | `study-aids.js:332` | 완전히 다른 분야 교재로 변경 시 |

> 같은 화장품 분야 내에서 교재 버전이 바뀌는 경우 수정 불필요

### 6순위: `src/trainer-calc.js` — **조건부** (계산 문제 유형)

| 하드코딩 대상 | 위치 | 수정 조건 |
|---------------|------|----------|
| 4가지 계산 유형 (원료 배합량, 혼합 평균 농도, 한도 내 최대 추가량, 희석 농도) | `trainer-calc.js:11-103` | 완전히 다른 분야 교재로 변경 시 |

> 화장품 조제 분야의 계산 문제에 특화. 같은 분야 내에서는 수정 불필요

### 7순위: `src/keyword-index.js` — **불필요** (자동 생성)

빌드 도구(`tools/build/build_keyword_index.js`)가 `content/참조자료/`에서 자동 생성. 교재가 바뀌면 **재빌드만 하면 됨**.

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

## �� 관련 문서

- [`README.md`](../../README.md) — 프로젝트 소개 및 시작 가이드 (폴더 구조 포함)
- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — Vercel 배포 및 오디오 호스팅 가이드
- [`AUDIO_HOSTING_GUIDE.md`](AUDIO_HOSTING_GUIDE.md) — 오디오북 호스팅 및 청취 가이드
- [`MULTI_MACHINE_SETUP.md`](MULTI_MACHINE_SETUP.md) — 다중 머신 개발 환경 설정
- [`CHANGES.md`](CHANGES.md) — 코드 리뷰 및 아키텍처 개편 수정 이력 (Changelog)
- [`MD_TO_HTML_LOGIC.md`](MD_TO_HTML_LOGIC.md) — MD→HTML 변환·표시 로직 기술 문서
- [`TESTING.md`](TESTING.md) — 단위 테스트 가이드 (259 tests: 248 unit + 11 DOM)
