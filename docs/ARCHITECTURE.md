# 🏛️ 설계 컨셉 & 아키텍처 (Architecture & Design Concept)

> **대상 프로젝트**: Cosmetic Pass Master — 맞춤형화장품 조제관리사 스마트 학습 플랫폼
> **최종 업데이트**: 2026-08-21
> **목적**: 시스템의 설계 철학, 아키텍처 구조, 주요 설계 결정 사항을 설명

---

## 📋 목차

1. [설계 철학 (Design Philosophy)](#-설계-철학-design-philosophy)
2. [시스템 아키텍처 개요](#-시스템-아키텍처-개요)
3. [계층별 상세 구조](#-계층별-상세-구조)
4. [모듈 설계](#-모듈-설계)
5. [데이터 흐름](#-데이터-흐름)
6. [상태 관리 전략](#-상태-관리-전략)
7. [PWA & 오프라인 전략](#-pwa--오프라인-전략)
8. [반응형 & 모바일 설계](#-반응형--모바일-설계)
9. [보안 설계](#-보안-설계)
10. [빌드 타임 데이터 파이프라인](#-빌드-타임-데이터-파이프라인)
11. [주요 설계 결정 및 근거](#-주요-설계-결정-및-근거)
12. [향후 확장 방향](#-향후-확장-방향)

---

## 🎯 설계 철학 (Design Philosophy)

본 프로젝트는 다음 4가지 핵심 원칙 위에 설계되었습니다.

### 1. **Zero-Backend (서버리스 정적 아키텍처)**
- 별도의 백엔드 서버, 데이터베이스, 인증 시스템 없이 **순수 프론트엔드만으로 완결**되는 애플리케이션
- 모든 학습 데이터는 빌드 타임에 JS 번들로 생성되어 정적 배포
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
│ │  │ app.js  │ │charts.js│ │scratchpad  │ │trainer-    │ │ │
│ │  │ (라우팅· │ │ (SVG    │ │  .js       │ │ calc.js    │ │ │
│ │  │  렌더링) │ │  차트)  │ │ (캔버스)   │ │ (문제생성) │ │ │
│ │  └─────────┘ └─────────┘ └────────────┘ └────────────┘ │ │
│ │  ┌─────────┐ ┌─────────┐                                │ │
│ │  │state.js │ │utils.js │  sanitize.js (보안 유틸)       │ │
│ │  │ (상태·  │ │ (초성·  │                                │ │
│ │  │  영속성)│ │  헬퍼)  │                                │ │
│ │  └─────────┘ └─────────┘                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                       Data Layer                         │ │
│ │  study_data.js · exam_data.js · ingredients_data.js      │ │
│ │  audio_manifest.js          (빌드 타임 생성, 불변)        │ │
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
│  - docs/*.html    │
└───────────────────┘
```

---

## 📚 계층별 상세 구조

### 1. Presentation Layer (표현 계층)

| 파일 | 역할 |
|------|------|
| [`index.html`](../index.html) | 단일 HTML 페이지(SPA App Shell). 모든 뷰 섹션이 하나의 문서에 존재하며 JS로 표시 전환 |
| [`style.css`](../style.css) | 전역 디자인 시스템. CSS 변수 기반 테마, 반응형 미디어 쿼리, 애니메이션 |
| [`manifest.webmanifest`](../manifest.webmanifest) | PWA 매니페스트 (앱 이름, 아이콘, 테마 색상) |

**SPA 뷰 전환 방식**:
- 9개의 `<section class="view-section">`이 하나의 HTML에 공존
- `switchView(targetView)`가 `.active` 클래스를 토글하여 화면 전환 (페이지 리로드 없음)
- 뷰 목록: dashboard / flashcard / quiz / review / trainer / exam / textbook / textbook-reader / dictionary

### 2. Application Layer (응용 계층)

| 모듈 | 책임 |
|------|------|
| [`src/app.js`](../src/app.js) | **메인 오케스트레이터**. 초기화(`initApp`), SPA 라우팅, 이벤트 바인딩, 각 기능별 렌더링 함수 |
| [`src/charts.js`](../src/charts.js) | SVG 기반 차트 생성 (레이더 차트, 성적 꺾은선 그래프). 외부 차트 라이브러리 미사용 |
| [`src/scratchpad.js`](../src/scratchpad.js) | HTML5 Canvas 손글씨 연습장 (계산 문제 풀이용) |
| [`src/trainer-calc.js`](../src/trainer-calc.js) | 계산 훈련 문제 생성기. **순수 로직** — DOM 의존 없이 문제 데이터 객첼만 반환 |
| [`src/state.js`](../src/state.js) | 전역 상태 객체(`state`) 정의 + localStorage 영속성(`loadProgress`/`saveProgress`) |
| [`src/utils.js`](../src/utils.js) | 의존성 없는 범용 헬퍼 (한글 초성 추출 `getChosung()` 등) |
| [`src/sanitize.js`](../src/sanitize.js) | HTML/XSS 방어 및 텍스트 정제 유틸리티 |

### 3. Data Layer (데이터 계층)

| 파일 | 내용 | 생성 주체 |
|------|------|-----------|
| [`data/study_data.js`](../data/study_data.js) | 4과목 19단원 교재 본문 + 플래시카드 | `tools/parse_data.js` |
| [`data/exam_data.js`](../data/exam_data.js) | 900+ 문항 시험 문제 | `tools/parse_exams.js` |
| [`data/ingredients_data.js`](../data/ingredients_data.js) | 화장품 성분 사전 (가용/금지/제한) | `tools/parse_ingredients.js` |
| [`data/audio_manifest.js`](../data/audio_manifest.js) | 오디오 파일 경로 매니페스트 | 오디오북 파이프라인 |

**특징**: 모두 전역 상수를 선언하는 JS 파일로, 별도 fetch 없이 `<script>` 로드만으로 즉시 사용 가능 (오프라인 핵심).

### 4. Persistence Layer (영속성 계층)

- **`localStorage`**: 학습 진행 상황 (외운 카드, 오답, 모의고사 성적, 스트릭, 설정 등)
- **Cache Storage (Service Worker)**: App Shell + 데이터 번들의 오프라인 캐시

---

## 🧩 모듈 설계

### 스크립트 로드 순서 (의존성 그래프)

[`index.html`](../index.html)의 로드 순서는 **의존성 방향**을 반영합니다 (하향식):

```
1. sanitize.js      (즉시 — 인라인 스크립트의 XSS 방어용)
2. data/*.js        (defer — 전역 데이터 상수)
3. utils.js         (defer — 의존성 無, 최하위 헬퍼)
4. charts.js        (defer — utils 의존)
5. scratchpad.js    (defer — 독립)
6. trainer-calc.js  (defer — 독립, 순수 로직)
7. state.js         (defer — 전역 state + 영속성)
8. app.js           (defer — 위 모든 것에 의존, 최종 오케스트레이터)
```

### 모듈화 전략: "점진적 모듈화 (Progressive Modularization)"

거대한 단일 `app.js`(약 4,900줄)를 한 번에 ES Modules로 전환하는 대신, **부수효과 없는 순수 로직부터 글로벌 스코프 스크립트로 점진 분리**하는 전략을 채택했습니다.

**분리 원칙**:
1. **DOM 의존성 없는 순수 로직 우선 분리** → `trainer-calc.js`(문제 생성), `utils.js`(초성 추출)
2. **상태·영속성 로직 분리** → `state.js`
3. **ES Modules 전환 대비**: 각 파일을 `export` 추가만으로 변환 가능하도록 순수 선언으로 구성

```
[분리 완료]                     [향후 분리 후보]
utils.js (헬퍼)                 - 텍스트 검색 로직 (performTextbookSearch)
trainer-calc.js (문제 생성)      - 오디오 리더 로직 (renderTextbookReader)
state.js (상태·영속성)           - 모의고사 채점 로직 (submitExam)
charts.js (시각화)               - 데일리 챌린지 로직
sanitize.js (보안)
scratchpad.js (캔버스)
```

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

[`src/state.js`](../src/state.js)의 `state` 객체가 **단일 진실 공급원(Single Source of Truth)** 역할을 합니다.

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

## 📴 PWA & 오프라인 전략

### Service Worker 캐시 계층 ([`sw.js`](../sw.js))

리소스 특성별로 **3종 캐시 + 1종 바이패스** 전략을 적용합니다.

| 캐시 | 대상 | 전략 | 근거 |
|------|------|------|------|
| **Shell** | HTML/CSS/JS/아이콘 | Stale-While-Revalidate | 빠른 표시 + 백그라운드 갱신 |
| **Data** | `data/*.js` | Cache First | 거의 불변, 오프라인 학습 핵심 |
| **CDN** | Google Fonts/FontAwesome | Stale-While-Revalidate | 외부 리소스 안정성 확보 |
| **(바이패스)** | MP3 오디오 (302MB) | 네트워크 직행 | 대용량 미디어는 캐시 제외 (저장공간 보호) |

### 캐시 버전 관리
- `CACHE_VERSION` 상수로 캐시 네임스페이스 관리 (`v2` 등)
- **배포 시 버전을 올리면 구 캐시 자동 정리** → 모바일 구버전 고착(Stale Cache) 문제 방지
- 네비게이션 요청은 Network-First로 처리하여 최신 HTML 우선 보장

### 오프라인 감지 설계
- `navigator.onLine`은 OS 어댑터 상태만 반영하므로 **신뢰하지 않음**
- 실제 도달 가능성 프로브: `https://www.gstatic.com/generate_204` (`no-cors`, 4초 타임아웃, 30초 주기)
- 오탐지(false offline) 방지 로직 포함

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

### 1. XSS 방어 ([`src/sanitize.js`](../src/sanitize.js))
- 사용자 데이터를 DOM에 삽입할 때 텍스트 정제(sanitize) 적용
- 신뢰할 수 있는 코드 생성 HTML(숫자 + `<strong>` 등)만 `innerHTML` 허용, raw 사용자 입력은 이스케이프

### 2. 백업 복원 화이트리스트
- `importData()`에서 `ALLOWED_KEYS`에 정의된 키만 localStorage에 복원
- 악성 JSON 백업 파일로 인한 스토리지 오염/스크립트 키 주입 방지

### 3. Content 보안
- 외부 리소스는 신뢰된 CDN(Google Fonts, FontAwesome)으로 제한
- Service Worker의 캐시 대상을 명시적 화이트리스트로 관리

---

## ⚙️ 빌드 타임 데이터 파이프라인

런타임 변환 비용을 없애기 위해 **콘텐츠 → 데이터 번들 변환을 빌드 타임에 수행**합니다.

```
[원본 콘텐츠]                [변환 스크립트]              [데이터 번들]
content/**/*.md    ──►   tools/parse_data.js       ──►   data/study_data.js
exams/**/*.md      ──►   tools/parse_exams.js      ──►   data/exam_data.js
ingredients/*.md   ──►   tools/parse_ingredients.js ──►  data/ingredients_data.js
```

**장점**:
- 런타임에 마크다운 파서를 탑재할 필요 없음 → 번들 경량화
- 생성물이 순수 JS 상수이므로 `<script defer>` 로드만으로 즉시 사용 가능
- 오프라인 캐시가 단순해짐 (정적 JS 파일)

**오디오북 파이프라인** ([`audiobook/`](../audiobook/README.md))은 Python 기반 별도 파이프라인으로, MD 청크 분할 → TTS → MP3 병합을 수행합니다.

---

## ⚖️ 주요 설계 결정 및 근거

| 결정 | 선택 | 대안 | 근거 |
|------|------|------|------|
| **아키텍처** | Zero-Backend 정적 SPA | 서버 + DB | 개인 학습 도구, 운영비 0, Vercel 묵료 배포 |
| **프레임워크** | Vanilla JS | React/Vue | 빌드 불필요, 장기 유지보수성, 번들 최소화 |
| **상태 관리** | 단일 전역 객체 + localStorage | Redux/MobX | 규모 대비 복잡도 과다, 직렬화 단순성 |
| **차트** | 직접 SVG 생성 | Chart.js 등 | 외부 의존성 제거, 가벼움, 커스터마이징 자유 |
| **데이터 로딩** | JS 상수 `<script>` 로드 | fetch + JSON | 오프라인 단순화, 파싱 오버헤드 제거 |
| **모듈 시스템** | 글로벌 스코프 + 점진 분리 | ES Modules 즉시 전환 | 리스크 최소화, `export` 추가만으로 전환 가능하게 준비 |
| **오디오** | 외부 CDN (캐시 제외) | 앱 번들 포함 | 302MB → Vercel 용량 제한 및 캐시 저장공간 보호 |

---

## 🚀 향후 확장 방향

1. **ES Modules 전환 완성**
   - 현재 글로벌 스코프 모듈들에 `export`/`import` 적용 → 명시적 의존성 그래프, 트리셰이킹 가능

2. **추가 도메인 로직 분리**
   - 텍스트 검색 엔진, 오디오 리더, 모의고사 채점기 등을 독립 모듈로 분리 → 단위 테스트 작성 기반 마련

3. **타입 안정성 도입 (선택)**
   - JSDoc + `checkJs` 또는 TypeScript 점진 도입으로 대형 리팩토링 안전성 확보

4. **백엔드 연동 확장성 (필요 시)**
   - 상태 영속성 계층(`state.js`의 `saveProgress`)을 추상화핛두어, 향후 클라우드 동기화 시 해당 지점만 API 호출로 교체 가능하도록 설계

5. **성능 계측**
   - Core Web Vitals (LCP/CLS/INP) 기준 지속 모니터링, 대용량 데이터 지연 로딩 검토

---

## 📎 관련 문서

- [`FOLDER_STRUCTURE.md`](../FOLDER_STRUCTURE.md) — 폴터·파일 구조 상세
- [`README.md`](../README.md) — 프로젝트 소개 및 시작 가이드
- [`docs/walkthrough.md`](walkthrough.md) — 변경 이력 및 버그 수정 기록
- [`docs/code_review_report.md`](code_review_report.md) — 코드 리뷰 및 개선 제안
- [`docs/VERCEL_DEPLOY_GUIDE.md`](VERCEL_DEPLOY_GUIDE.md) — 배포 가이드
- [`docs/VERCEL_SIZE_OPTIMIZATION.md`](VERCEL_SIZE_OPTIMIZATION.md) — 배포 크기 최적화
