# 🧩 교재 콘텐츠 모듈화 설계 방안 (Modular Content Design)

> **대상 프로젝트**: Cosmetic Pass Master — 맞춤형화장품 조제관리사 스마트 학습 플랫폼
> **작성일**: 2026-08-22
> **개정**: 2026-08-22 (rev.2) — 안정 ID 해시 입력 재설계(`chapterKey` 포함·`definition` 제외), Phase 간 선행 조건 명문화, ID 마이그레이션/`ALLOWED_KEYS` 세부 보강, SW 캐시 전략 단순화
> **목적**: 교재 내용이 수시로 변경되어도 코드 수정 없이 콘텐츠만 교체하면 되는 **콘텐츠 주도(Content-Driven) 모듈화 아키텍처** 제안
> **관련 문서**: [`ARCHITECTURE.md`](ARCHITECTURE.md) — 기존 아키텍처 개요

---

## 📋 목차

1. [배경: 왜 모듈화가 필요한가](#-배경-왜-모듈화가-필요한가)
2. [현재 구조의 결합점(Coupling Points) 분석](#-현재-구조의-결합점-분석)
3. [설계 목표와 원칙](#-설계-목표와-원칙)
4. [제안 아키텍처 개요](#-제안-아키텍처-개요)
5. [Layer 1: 콘텐츠 소스 계층 — 매니페스트 주도 구조](#-layer-1-콘텐츠-소스-계층)
6. [Layer 2: 파싱 파이프라인 계층 — 플러그인형 빌드](#-layer-2-파싱-파이프라인-계층)
7. [Layer 3: 데이터 번들 계층 — 과목별 분리 + 버전 레지스트리](#-layer-3-데이터-번들-계층)
8. [Layer 4: 런타임 로더 계층 — 지연 로딩과 진행상황 보존](#-layer-4-런타임-로더-계층)
9. [안정적 ID 체계 (Stable ID)](#-안정적-id-체계-stable-id)
10. [스키마 검증 및 빌드 안전장치](#-스키마-검증-및-빌드-안전장치)
11. [콘텐츠 변경 시나리오별 작업 흐름](#-콘텐츠-변경-시나리오별-작업-흐름)
12. [단계별 마이그레이션 로드맵](#-단계별-마이그레이션-로드맵)
13. [기대 효과 요약](#-기대-효과-요약)

---

## 🎯 배경: 왜 모듈화가 필요한가

본 프로젝트의 핵심 자산은 **교재 콘텐츠**이며, 이 콘텐츠는 다음과 같은 이유로 지속적으로 변경됩니다.

| 변경 유형 | 빈도 | 예시 |
|-----------|------|------|
| 법령 개정 | 연 1~2회 | 화장품법 개정, 개인정보 보호법 시행령 변경 |
| 출제 기준 변경 | 연 1회 | 과목 구성 변경, 단원 추가/삭제 |
| 기출문제 반영 | 수시 | 🔖기출 마커 추가, 해설 보강 |
| 연도 갱신 | 연 1회 | `...2026.md` → `...2027.md` |
| 오탈자 수정 | 수시 | 본문 내용 교정 |
| 신규 과목/단원 추가 | 비정기 | 새로운 시험 과목 편입 |

**현재 문제점**: 위 변경이 발생할 때마다 코드(파서, 앱, SW)를 함께 수정해야 하거나, 사용자의 학습 진행상황(외운 카드, 오답 노트)이 깨집니다.

**모듈화의 목표**: *"콘텐츠 편집자는 마크다운 파일과 매니페스트만 수정하고, 개발자는 코드를 건드리지 않으며, 사용자는 진행상황을 잃지 않는다."*

---

## 🔍 현재 구조의 결합점 분석

코드베이스 분석을 통해 식별된 **7가지 구조적 결합점**입니다.

### C1. 하드코딩된 과목 레지스트리
[`tools/parse_data.js`](../tools/parse_data.js:7)의 `SUBJECT_DIRS` 배열에 과목이 코드로 고정되어 있습니다.

```javascript
// 현재: 과목 추가/이름변경 시 코드 수정 필요
const SUBJECT_DIRS = [
  { id: 'law', name: '1과목: 화장품법의 이해', dir: 'content/law' },
  ...
];
```
**영향**: 과목 추가/순서 변경/이름 변경 → 파서 코드 수정 → 재배포

### C2. 파일명-연도 결합
`1.화장품법2026.md`처럼 연도가 파일명에 내장되어 있어, 연도 갱신 시 **파일명 일괄 변경 + 참조 추적**이 필요합니다.

**영향**: 매년 파일명 변경 → 파서가 파일명에서 번호를 추출하므로 ID 체계 흔들림

### C3. 위치 기반 ID (Positional ID) — 가장 치명적
카드/퀴즈 ID가 `${subjectId}_card_${filePrefix}_${cards.length + 1}` 형태의 **순번**입니다.

**영향**: 표 중간에 행 1개 삽입 → 이후 모든 카드 ID가 밀림 → localStorage에 저장된 "외운 카드" 목록(`memorizedCards`)이 엉뚱한 카드를 가리킴 → **사용자 진행상황 오염**

### C4. 모놀리식 데이터 번들
4개 과목 전체가 단일 `study_data.js`로 번들링됩니다.

**영향**: 1개 단원 수정 → 전체 번들 재생성 → Service Worker 캐시 무효화 범위 과다 → 오프라인 사용자가 전체 데이터 재다운로드

### C5. 마커 의존 파싱 (Fragile Parsing)
퀴즈 생성이 `🔖기출`/`📌중요` 이모지와 표 구조에 강하게 의존합니다.

**영향**: 콘텐츠 편집 시 마커 누락/표 구조 변경 → 퀴즈가 **조용히 사라짐** (빌드 에러 없음) → 품질 저하를 사용자가 발견할 때까지 인지 불가

### C6. 과목 명칭 중복 관리 + 번호 불일치
[`parse_exams.js`](../tools/parse_exams.js:10)의 `subjectNames`와 [`parse_data.js`](../tools/parse_data.js:8)의 `SUBJECT_DIRS`가 **별도 하드코딩**되어 있습니다.

**영향**: 과목명 변경 시 두 파일을 동기화해야 함. 실수 시 시험 데이터와 학습 데이터의 과목 매핑 불일치

### C7. 스키마 검증 부재
파싱 결과물에 대한 스키마/건전성 검증이 없습니다.

**영향**: 파싱 실패가 런타임 에러로 발현 (예: 빈 배열 → 앱 화면이 텅 빔)

---

## 🧭 설계 목표와 원칙

### 목표 (SMART)
1. **콘텐츠 추가/수정 시 코드 변경 0건** — 매니페스트 파일 1개만 수정
2. **진행상황 보존율 100%** — 콘텐츠 재생성 후에도 기존 카드/퀴즈의 ID 불변
3. **변경 범위 격리** — 1개 과목 변경 시 해당 과목 번들만 재빌드/재배포
4. **빌드 타임 검증** — 파싱 이상 시 빌드가 실패하고 원인을 출력 (조용한 데이터 손실 금지)

### 원칙
| 원칙 | 설명 |
|------|------|
| **Single Source of Truth** | 과목 정의는 `content/manifest.json` 단 1곳에만 존재 |
| **Convention over Configuration** | 파일명 규칙 대신 매니페스트 선언 (단, 폐기 시 유연한 fallback) |
| **Immutable Content ID** | 콘텐츠 ID는 콘텐츠 자체에서 유도, 위치/순서와 무관 |
| **Fail Loud, Fail Early** | 검증 실패는 빌드 타임에 에러로, 런타임 폭발 금지 |
| **Progressive Migration** | 기존 구조와 공존하며 단계적 전환 (빅뱅 재작성 금지) |
| **Zero-Backend 유지** | 기존 설계 철학(정적 호스팅, Vanilla JS) 유지 |

---

## 🏗️ 제안 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Content Source (콘텐츠 소스 계층)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ content/manifest.json  ← ★ 단일 진실 공급원 (SSOT)         │  │
│  │ content/<subjectKey>/<chapterKey>.md  ← 연도 무관 파일명    │  │
│  │ exams/<subjectKey>/<partKey>.md                           │  │
│  │ ingredients/*.md                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 읽기
┌──────────────────────────▼──────────────────────────────────────┐
│  Layer 2: Build Pipeline (파싱 파이프라인 계층)                    │
│  ┌───────────┐ ┌────────────┐ ┌───────────┐ ┌────────────────┐  │
│  │ 매니페스트 │→│ 과목별 파서 │→│ 스키마 검증│→│ 과목별 번들 출력 │  │
│  │   로더    │ │ (플러그인) │ │ + ID 유도  │ │ + 레지스트리    │  │
│  └───────────┘ └────────────┘ └───────────┘ └────────────────┘  │
│       tools/build/ (신규 모듈화된 빌드 시스템)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 생성
┌──────────────────────────▼──────────────────────────────────────┐
│  Layer 3: Data Bundles (데이터 번들 계층)                          │
│  data/registry.js           ← 버전/목록/해시 레지스트리            │
│  data/subjects/law.js       ← 과목별 독립 번들                     │
│  data/subjects/safety.js                                          │
│  data/exams/subject1.js     ← 시험별 독립 번들                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ <script> 로드
┌──────────────────────────▼──────────────────────────────────────┐
│  Layer 4: Runtime Loader (런타임 로더 계층)                        │
│  src/data-loader.js  ← 레지스트리 기반 지연 로딩 + 버전 체크        │
│  src/app.js          ← 데이터 접근은 로더 API 경유 (직접 참조 금지) │
└─────────────────────────────────────────────────────────────────┘
```

**핵심 변화**: `content/manifest.json`이 전체 시스템을 구동하는 유일한 설정이며, 파서/번들/앱 모두 이 파일에서 과목 정의를 읽습니다.

---

## 📂 Layer 1: 콘텐츠 소스 계층

### 1-1. 콘텐츠 매니페스트 (`content/manifest.json`) — 신규

모든 과목/단원/시험의 정의를 단일 파일로 통합합니다.

```json
{
  "schemaVersion": 1,
  "contentYear": "2026",
  "subjects": [
    {
      "key": "law",
      "order": 1,
      "name": "화장품법의 이해",
      "dir": "law",
      "chapters": [
        { "key": "cosmetic-law", "title": "화장품법", "file": "cosmetic-law.md" },
        { "key": "privacy-law",  "title": "개인정보 보호법", "file": "privacy-law.md" }
      ]
    },
    {
      "key": "manufacturing",
      "order": 2,
      "name": "화장품 제조 및 품질관리",
      "dir": "manufacturing",
      "chapters": [
        { "key": "ingredients", "title": "화장품 원료의 종류와 특성 및 제품의 제조관리", "file": "ingredients.md" },
        { "key": "quality",     "title": "화장품의 기능과 품질", "file": "quality.md" },
        { "key": "restricted",  "title": "화장품 사용제한 원료", "file": "restricted.md" },
        { "key": "management",  "title": "화장품 관리", "file": "management.md" },
        { "key": "hazard",      "title": "위해사례 판단 및 보고", "file": "hazard.md" }
      ]
    }
  ],
  "exams": [
    { "key": "subject1",    "subject": "law",           "part": 1, "title": "화장품법의 이해 (1~100번)",    "file": "subject1_100_questions.md" },
    { "key": "subject2_p1", "subject": "manufacturing", "part": 1, "title": "화장품 제조 및 품질관리 - 1부", "file": "subject2_100_questions.md" },
    { "key": "subject2_p2", "subject": "manufacturing", "part": 2, "title": "화장품 제조 및 품질관리 - 2부", "file": "subject2_part2_100.md" },
    { "key": "subject2_p3", "subject": "manufacturing", "part": 3, "title": "화장품 제조 및 품질관리 - 3부", "file": "subject2_part3_100.md" }
  ]
}
```

> **시험 파일은 총 9개**입니다(subject1×1, subject2×3, subject3×2, subject4×3). subject3·subject4도 위와 동일한 패턴으로 매니페스트에 나열합니다. `part` 필드는 현재 `parse_exams.js`가 파일명 정규식(`part(\d+)`/`_p(\d+)`)으로 파트 번호를 추출하던 로직을 **선언적으로 대체**합니다 — 파일명 규칙 변경이 파트 번호에 영향을 주지 않습니다.

**효과**:
- 과목 추가 = 매니페스트에 객체 1개 추가 (코드 수정 없음)
- 과목 순서 = `order` 필드로 제어 (디렉토리명/파일명과 무관)
- 과목명 = `name` 필드 단일 관리 → C6 해소

### 1-2. 파일명에서 연도 제거

| 현재 | 제안 |
|------|------|
| `content/law/1.화장품법2026.md` | `content/law/cosmetic-law.md` |
| `content/law/2.개인정보 보호법2026.md` | `content/law/privacy-law.md` |

- 연도는 `manifest.json`의 `contentYear` 필드로 관리 (UI 표시용)
- 순번(1., 2.)은 `chapters` 배열 순서로 관리 → 단원 삽입/삭제가 파일명에 영향 없음
- 한글 파일명 → 안정적 키(slug) 사용으로 OS/인코딩 이슈 제거

> **마이그레이션 부담 완화**: 초기 전환기에는 매니페스트의 `file` 필드가 기존 한글 파일명을 가리키도록 허용(예: `"file": "1.화장품법2026.md"`). 파일 리네이밍은 선택 사항으로 단계적 진행.

---

## ⚙️ Layer 2: 파싱 파이프라인 계층

### 2-1. 디렉토리 구조 (신규 `tools/build/`)

기존 3개 파서(`parse_data.js`, `parse_exams.js`, `parse_ingredients.js`)를 공통 프레임워크 위의 플러그인으로 재구성합니다.

```
tools/
├── build/
│   ├── index.js              ← 진입점: 매니페스트 로드 → 플러그인 실행 → 검증 → 출력
│   ├── manifest-loader.js    ← manifest.json 로드 + 자체 검증
│   ├── id-factory.js         ← 안정적 ID 생성 (해시 기반)
│   ├── schema.js             ← 출력 데이터 스키마 정의 + 검증기
│   ├── plugins/
│   │   ├── textbook.plugin.js   ← parse_data.js 로직 이전
│   │   ├── exams.plugin.js      ← parse_exams.js 로직 이전
│   │   └── ingredients.plugin.js← parse_ingredients.js 로직 이전
│   └── report.js             ← 빌드 리포트 (과목별 카드/퀴즈 수, 경고)
├── parse_data.js             ← (레거시, 전환기 동안 유지)
└── ...
```

### 2-2. 플러그인 인터페이스

각 플러그인은 동일한 계약을 따릅니다.

```javascript
// tools/build/plugins/textbook.plugin.js (개념 예시)
module.exports = {
  name: 'textbook',
  /**
   * @param {object} subject  - manifest의 과목 정의 1건
   * @param {object} ctx      - { workspaceDir, idFactory, logger }
   * @returns {{ cards: [], quizzes: [], chapters: [] }}
   */
  build(subject, ctx) { /* 기존 parseMarkdownFile 로직 이동 */ },
  validate(data) { /* 필수 필드/최소 개수 검증 */ }
};
```

**효과**: 새 콘텐츠 유형(예: "용어 사전", "판례 모음")이 추가되면 플러그인 1개를 새로 작성해 등록하면 됩니다. 기존 코드에 `if/else`를 추가하지 않습니다 (Open/Closed 원칙).

### 2-3. 빌드 실행 (package.json 스크립트)

```json
{
  "scripts": {
    "build:data": "node tools/build/index.js",
    "build:data:law": "node tools/build/index.js --only law"
  }
}
```

`--only <subjectKey>` 옵션으로 **변경된 과목만 재빌드** → C4 해소의 빌드 측면.

---

## 📦 Layer 3: 데이터 번들 계층

### 3-1. 과목별 분리 번들 + 레지스트리

| 현재 | 제안 |
|------|------|
| `data/study_data.js` (전체 1개) | `data/subjects/<key>.js` (과목별) + `data/registry.js` |
| `data/exam_data.js` (전체 1개) | `data/exams/<key>.js` (시험별) + 레지스트리에 통합 |

**`data/registry.js`** (자동 생성):

```javascript
// 자동 생성된 데이터 레지스트리입니다. 수정하지 마십시오.
const DATA_REGISTRY = {
  schemaVersion: 1,
  contentYear: "2026",
  generatedAt: "2026-08-22T07:00:00Z",
  subjects: [
    {
      key: "law",
      order: 1,
      name: "화장품법의 이해",
      bundle: "./data/subjects/law.js",
      global: "STUDY_DATA_law",       // 번들이 선언하는 전역 상수명
      contentHash: "a1b2c3d4",        // 콘텐츠 해시 (변경 감지용)
      stats: { cards: 87, quizzes: 134, chapters: 2 }
    },
    // ...
  ],
  exams: [ /* 동일 구조 */ ]
};
```

### 3-2. 콘텐츠 해시 (contentHash)

빌드 시 과목의 원본 마크다운 전체를 SHA-256 해시하여 레지스트리에 기록합니다. 이 해시를 **번들 파일명에도 포함**(예: `law.a1b2c3d4.js`)하여, 내용이 바뀐 과목만 URL이 달라지고 브라우저/SW 캐시가 자연스럽게 변경분만 갱신하도록 합니다([4-3](#4-3-service-worker-전략-수정) 참조).

> **해시 길이 규약**: `contentHash`(과목 단위 변경 감지)는 SHA-256 앞 **8자리**, [안정 카드/퀴즈 ID](#-안정적-id-체계-stable-id)의 `shortHash`는 앞 **6자리**로 서로 다릅니다. 용도가 다르므로 `tools/build/id-factory.js`에 각각 상수(`CONTENT_HASH_LEN = 8`, `ID_HASH_LEN = 6`)로 분리 관리합니다.

**활용**:
- 번들 URL이 해시를 포함하므로 변경된 과목만 캐시에서 갱신 (C4 해소의 런타임 측면)
- 빌드 리포트에 "마지막 빌드 이후 변경된 과목" 표시

---

## 🔌 Layer 4: 런타임 로더 계층

### 4-1. `src/data-loader.js` (신규)

앱이 데이터 전역 상수를 직접 참조하는 대신, 로더 API를 통해 접근합니다.

```javascript
// src/data-loader.js (개념 예시)
const DataLoader = {
  _loaded: {},

  /** 레지스트리 기반 초기화: 대시보드에 필요한 메타만 먼저 */
  init() {
    this.registry = window.DATA_REGISTRY;
  },

  /** 과목 번들 지연 로딩 (최초 접근 시 <script> 동적 삽입) */
  async loadSubject(key) {
    if (this._loaded[key]) return this._loaded[key];
    const meta = this.registry.subjects.find(s => s.key === key);
    await loadScriptOnce(meta.bundle);          // 유틸: script 태그 삽입 Promise
    this._loaded[key] = window[meta.global];
    return this._loaded[key];
  },

  /** 전체 과목 메타 목록 (대시보드/네비게이션용 — 번들 로드 불필요) */
  getSubjectList() { return this.registry.subjects; }
};
```

### 4-2. 앱 코드 변경 범위 (최소화)

| 위치 | 현재 | 변경 후 |
|------|------|---------|
| 과목 목록 렌더링 | `Object.keys(STUDY_DATA)` | `DataLoader.getSubjectList()` |
| 플래시카드 진입 | `STUDY_DATA[subjectId].cards` | `await DataLoader.loadSubject(key)` → `.cards` |
| 퀴즈 진입 | `STUDY_DATA[subjectId].quizzes` | 동일 패턴 |

**부수 효과**: 초기 로드 시 사용하지 않는 과목 번들을 로드하지 않아 **초기 구동 속도 향상** (모바일 체감 개선).

### 4-3. Service Worker 전략 수정

**우선 권장 (단순 · 저위험)**: 번들 파일명에 콘텐츠 해시를 포함시킵니다(예: `law.a1b2c3d4.js`). 내용이 바뀐 과목만 URL이 달라지므로 **브라우저 HTTP 캐시와 SW Cache-First가 자동으로 변경분만 갱신**합니다 — fetch 핸들러에 별도 대조 로직이 필요 없습니다. 레지스트리(`registry.js`)만 Network First로 두어 항상 최신 번들 URL을 가리키게 합니다.

| 항목 | 현재 | 제안(우선) |
|------|------|------|
| 데이터 캐시 단위 | 전체 번들 1개 | 레지스트리(Network First) + 해시 파일명 과목 번들(Cache First) |
| 캐시 무효화 | `CACHE_VERSION` 수동 증가 (전체 삭제) | 번들 URL 변경으로 변경 과목만 자연 갱신 |

`sw.js`의 `DATA_ASSETS`는 `./data/registry.js`로 축소합니다.

> **⏸️ 후순위(선택) — SW 내 해시 대조 로직**
> fetch 핸들러에서 캐시된 레지스트리 해시와 요청을 직접 대조하는 방식은 SW 생명주기(activate 캐시 정리, 레지스트리 stale 처리, 롤백)와 얽혀 미묘한 버그를 유발하기 쉽습니다. **현 데이터 총량(~2MB: study 944KB + exam 571KB + ingredients 457KB)에서 과목별 재다운로드가 실제 체감 문제인지 먼저 측정**한 뒤, 위 해시 파일명 방식으로 부족할 때에만 별도 단계로 도입합니다.

---

## 🔑 안정적 ID 체계 (Stable ID)

**문제(C3)의 핵심 해결책**입니다.

### 현재 (위치 기반 — 취약)
```
law_card_1_5   ← 1번 파일의 5번째 카드. 앞에 1개 삽입되면 6번으로 밀림
```

### 제안 (콘텐츠 유도 해시 — 불변)
```
law_card_a3f9c2  ← (subjectKey + chapterKey + term)의 해시 앞 6자리
```

**생성 규칙** (`tools/build/id-factory.js`):

```javascript
function stableId(subjectKey, chapterKey, type, term) {
  const raw = `${subjectKey}|${chapterKey}|${term}`;
  return `${subjectKey}_${type}_${shortHash(raw)}`;  // 예: law_card_a3f9c2
}
```

> **⚠️ 설계 결정 — 해시 입력에서 `definition`(정의 본문)을 제외한 이유**
> 초기 안은 `definition` 첫 50자를 해시 입력에 포함했으나 다음 이유로 **제외**합니다.
> 1. **오탈자 수정·해설 보강은 "수시" 빈도의 변경**([배경](#-배경-왜-모듈화가-필요한가) 표)이며 거의 항상 정의 본문에서 발생합니다. 정의를 해시에 넣으면 이 잦은 편집마다 카드 ID가 바뀌어 "외운 카드"가 초기화됩니다 → 진행상황 보존율 100% 목표와 정면충돌.
> 2. `term`(카드 앞면)은 정의 본문보다 훨씬 덜 바뀌므로 ID 안정성이 더 높습니다.
>
> **트레이드오프**: 용어명(`term`)을 바꾸면 ID가 바뀝니다(→ 새 카드 취급). 그러나 용어명 변경은 드물고, 발생 시 "새로운 개념 학습"으로 취급하는 것이 학습상으로도 타당합니다.

> **⚠️ 설계 결정 — 해시 입력에 `chapterKey`를 포함한 이유**
> 같은 과목의 서로 다른 단원에 동일 용어가 등장하는 것은 정상적인 콘텐츠입니다(예: "위해평가"가 3과목 여러 단원에 출현). `subjectKey + term`만으로 해시하면 이런 정당한 콘텐츠에서 **동일 ID가 생성되어 [`uniqueIds` 검증](#-스키마-검증-및-빌드-안전장치)이 빌드를 실패**시킵니다. 이는 해시 함수 충돌([Q3](#q3-해시-충돌-가능성은))이 아니라 **입력 충돌**이라 해시 길이를 늘려도 해결되지 않습니다. `chapterKey`를 포함해 단원 간 동일 용어를 구분합니다.
>
> **잔여 위험**: 같은 단원 안에 동일 용어 카드가 2장 있으면 여전히 충돌합니다. 이는 학습자에게도 혼란스러운 콘텐츠이므로, 빌드 검증에서 검출해 **콘텐츠를 수정(용어 구분)**하는 것을 원칙으로 합니다.

### ID 변경 규칙 (예측 가능성)

| 콘텐츠 변경 | ID 변화 | 진행상황 영향 |
|-------------|---------|---------------|
| 표에 새 행 **추가** | 새 행만 새 ID | ✅ 기존 진행상황 100% 유지 |
| 행 **삭제** | 해당 ID 소멸 | ✅ 고아 진행상황은 자동 정리(아래 참조) |
| 정의(본문) **오탈자·해설 수정** | 변화 없음 | ✅ 완전 무관 (해시 입력에서 제외) |
| **용어명(term) 수정** | 해당 카드 ID 변경 | ⚠️ 해당 카드 1장만 '새 카드' 취급 (드묾, 허용 범위) |
| 카드를 **다른 단원으로 이동** | 해당 카드 ID 변경 | ⚠️ 해당 카드 1장만 '새 카드' 취급 (허용 범위) |
| 표 **행 순서 변경** | 변화 없음 | ✅ 완전 무관 |
| 단원 파일 **이름 변경** | 변화 없음 (매니페스트 키 기준) | ✅ 완전 무관 |

### 고아 진행상황 정리 (Orphan Cleanup)

앱 시작 시 localStorage의 `memorizedCards`/`wrongAnswers`에 존재하지 않는 ID가 있으면 제거하는 마이그레이션 로직을 `state.js`의 `loadProgress()`에 추가합니다. 이는 콘텐츠 삭제 시에도 스토리지가 오염되지 않도록 합니다.

---

## 🛡️ 스키마 검증 및 빌드 안전장치

### 5-1. 빌드 타임 검증 (`tools/build/schema.js`)

```javascript
const SubjectSchema = {
  required: ['key', 'name', 'cards', 'quizzes', 'chapters'],
  rules: [
    d => d.cards.length > 0      || '카드가 0개입니다 — 파싱 실패 의심',
    d => d.chapters.length > 0   || '단원이 0개입니다 — 파일 경로 확인',
    d => uniqueIds(d.cards)      || '카드 ID 중복 발생',
    d => uniqueIds(d.quizzes)    || '퀴즈 ID 중복 발생',
  ]
};
```

- 검증 실패 시 **빌드가 exit code 1로 실패**하고 어떤 과목의 어떤 규칙이 깨졌는지 출력 → C5/C7 해소
- 카드/퀴즈 수가 **이전 빌드 대비 20% 이상 감소**하면 경고 출력 (조용한 대량 손실 방지, 이전 통계는 `tools/build/.last-stats.json`에 저장)

### 5-2. 매니페스트 자체 검증

- `chapters[].file`이 실제 존재하는지
- `key` 중복 여부
- `exams[].subject`가 `subjects[].key` 중 하나를 가리키는지 (C6 해소의 검증 측면)

### 5-3. 파싱 마커 감시

플러그인이 `🔖기출` 마커가 있는데 퀴즈가 생성되지 않은 행을 수집해 빌드 리포트에 경고로 출력합니다.

```
[WARN] law/cosmetic-law.md: 🔖기출 마커가 있으나 퀴즈 미생성 — 3건
  - "제조판매업자는 매 제조번호별로..."
```

---

## 🔄 콘텐츠 변경 시나리오별 작업 흐름

### 시나리오 A: 법령 개정으로 단원 내용 수정 (가장 빈번)

| 단계 | 작업 | 코드 수정? |
|------|------|-----------|
| 1 | 해당 `.md` 파일 본문 수정 | ❌ |
| 2 | `npm run build:data:law` (해당 과목만) | ❌ |
| 3 | 검증 통과 확인 → 커밋/배포 | ❌ |
| 4 | 사용자: 다음 접속 시 레지스트리 해시 비교로 해당 과목만 갱신 | ❌ |

**진행상황**: 수정된 카드만 ID 변경 → 나머지 외운 카드 유지 ✅

### 시나리오 B: 새 단원 추가

| 단계 | 작업 | 코드 수정? |
|------|------|-----------|
| 1 | `content/<subject>/new-chapter.md` 작성 | ❌ |
| 2 | `manifest.json`의 `chapters` 배열에 1줄 추가 | ❌ (설정만) |
| 3 | `npm run build:data:<subject>` | ❌ |
| 4 | 배포 | ❌ |

### 시나리오 C: 새 과목 추가 (최악의 경우였음)

| 단계 | 작업 | 코드 수정? |
|------|------|-----------|
| 1 | `content/newsubject/` 디렉토리 + md 파일 생성 | ❌ |
| 2 | `manifest.json`의 `subjects`에 객체 추가 | ❌ (설정만) |
| 3 | `npm run build:data` | ❌ |
| 4 | 배포 — 앱 네비게이션/대시보드가 레지스트리 기반이므로 자동 반영 | ❌ |

**현재 대비**: 기존에는 `parse_data.js` + `parse_exams.js` + `app.js` 일부 + `sw.js`까지 최대 4곳 수정 필요 → **0곳으로 감소**

### 시나리오 D: 연도 갱신 (2026 → 2027)

| 단계 | 작업 | 코드 수정? |
|------|------|-----------|
| 1 | 내용이 바뀐 md 파일들 수정 | ❌ |
| 2 | `manifest.json`의 `contentYear` 변경 | ❌ (설정만) |
| 3 | 전체 재빌드 | ❌ |

**현재 대비**: 기존에는 모든 파일명 일괄 리네이밍 필요 → **파일명 변경 불필요**

---

## 🗺️ 단계별 마이그레이션 로드맵

빅뱅 전환의 리스크를 피하기 위해 **4단계 점진 도입**을 권장합니다. 각 단계는 독립적으로 배포 가능하며, 기존 구조와 공존합니다.

> **🔒 Phase 간 선행 조건 (반드시 준수)**
> 현재 카드/퀴즈 ID는 `filePrefix`(파일명 앞 번호 `1.`, `2.` …)에 의존합니다 — `parse_data.js`의 `filename.match(/^(\d+)\./)`가 이 번호를 뽑아 `${subjectId}_card_${filePrefix}_${n}`에 넣습니다. 따라서 **안정 ID(Phase 2)가 배포되기 전에는 콘텐츠 파일명·앞번호를 절대 변경하지 않습니다.** 파일명에서 순번을 제거하거나 슬러그화하면 `filePrefix`가 `'0'`으로 떨어져 **모든 레거시 ID가 밀리고 진행상황이 전부 깨집니다.**
> → 즉 C2(파일명-연도 결합)와 C3(위치 ID)는 `filePrefix`를 통해 사실상 한 몸입니다. Layer 1의 "파일명에서 연도·순번 제거"(1-2절)와 Phase 4의 파일명 슬러그화는 **Phase 2 완료 이후에만** 수행합니다.

### Phase 1 — 매니페스트 도입 (리스크: 낮음)
**목표**: 하드코딩 레지스트리 제거 (C1, C6 해소)

1. `content/manifest.json` 작성 (**기존 파일명·앞번호를 그대로** `file` 필드에 매핑 — 위 선행 조건에 따라 이 단계에서 파일명을 바꾸지 않음)
2. `tools/parse_data.js`와 `tools/parse_exams.js`가 `SUBJECT_DIRS`/`subjectNames` 대신 매니페스트를 읽도록 수정
3. 기존 출력 형식(`data/study_data.js` 단일 번들)은 **그대로 유지** → 앱 코드 변경 없음

**완료 기준**: 매니페스트만 수정해 과목 순서 변경 가능

### Phase 2 — 안정적 ID 도입 (리스크: 중간, 사용자 데이터 마이그레이션 필요)
**목표**: 진행상황 보존 (C3 해소)

1. `id-factory.js` 구현 및 파서에 적용
2. **ID 마이그레이션 맵 생성 (일회성)**: 마이그레이션 시점의 콘텐츠 스냅샷에 대해 **구 파서(위치 기반)와 신 파서(해시 기반)를 같은 행에 대해 동시 실행**하고, 각 행의 등장 순서로 구 ID ↔ 신 ID를 페어링해 `data/id_migration.js`로 출력합니다. 신 ID는 위치와 무관하므로, 짝을 맺을 수 있는 유일한 기준이 "동일 스냅샷에서의 행 순서"라는 점에 유의합니다. 따라서 이 맵은 **해당 스냅샷에만 유효한 일회성 산출물**이며, 전 사용자 마이그레이션이 끝나면(또는 충분한 유예 기간 후) 폐기하고 이후 빌드에서 재생성하지 않습니다.
3. `state.js`의 `loadProgress()`에 1회성 마이그레이션 로직 추가 (구 ID로 저장된 진행상황을 신 ID로 변환 후 완료 플래그 저장)
4. **`app.js`의 `importData()` `ALLOWED_KEYS` 화이트리스트에 마이그레이션 완료 플래그 키를 추가** — 누락 시 사용자가 백업을 내보냈다 재가져오면 플래그가 유실되어 마이그레이션이 재실행됩니다(`importData()`는 화이트리스트에 없는 키를 복원하지 않음).
5. 고아 ID 정리 로직 추가

**완료 기준**: 콘텐츠 중간 삽입 후 재빌드해도 기존 진행상황 유지

### Phase 3 — 번들 분리 + 런타임 로더 (리스크: 중간)
**목표**: 변경 격리와 초기 로딩 개선 (C4 해소)

1. 파서 출력을 과목별 `data/subjects/<key>.js` + `data/registry.js`로 변경
2. `src/data-loader.js` 작성
3. `app.js`의 데이터 접근 지점을 로더 API로 교체 (접근 지점이 한정적이므로 범위 명확)
4. `index.html`의 `<script>` 목록에서 개별 데이터 파일 제거 → `registry.js` + `data-loader.js` 추가
5. `sw.js` 캐시 전략 수정

**완료 기준**: 1개 과목 재빌드 시 다른 과목 번들의 캐시 유지

### Phase 4 — 검증 강화 + 파이프라인 정리 (리스크: 낮음)
**목표**: 조용한 실패 제거 (C5, C7 해소)

1. `tools/build/` 플러그인 구조로 파서 재편 (기능 동등)
2. 스키마 검증 + 통계 비교 + 마커 감시 추가
3. `package.json` 스크립트 정비, 레거시 파서 제거
4. (선택) 콘텐츠 파일명 슬러그화 — **Phase 2 안정 ID 배포 이후에만 안전** (그 전에는 `filePrefix` 변화로 레거시 ID가 깨짐, 위 선행 조건 참조)

**완료 기준**: 파싱 이상 시 CI/빌드가 실패하고 원인 출력

---

## ✨ 기대 효과 요약

| 지표 | 현재 | 목표 |
|------|------|------|
| 콘텐츠 수정 시 코드 변경 파일 수 | 1~4개 | **0개** (매니페스트만) |
| 단원 1개 수정 시 재빌드/재다운로드 범위 | 전체 데이터 | **해당 과목 번들만** |
| 콘텐츠 중간 삽입 시 진행상황 손실 | 발생 (ID 밀림) | **0건** (해시 ID) |
| 파싱 실패 감지 시점 | 사용자 신고 후 | **빌드 타임** |
| 과목명 정의 위치 | 2곳 (불일치 위험) | **1곳** (manifest) |
| 초기 로드 데이터량 | 전체 번들 | **레지스트리 + 필요 과목만** |

---

## 📎 부록: 설계 결정 대안 검토

### Q1. JSON 파일 + fetch 대신 JS 번들 유지 이유는?
기존 설계 철학(Zero-Backend, 오프라인 우선, `<script>` 로드로 fetch/CORS 이슈 회피)을 유지하기 위해 **JS 전역 상수 번들 방식을 유지**합니다. 다만 번들을 과목 단위로 쪼개어 격리성을 확보합니다.

### Q2. ES Modules 전환과의 관계는?
본 설계는 기존 "점진적 모듈화" 전략([`ARCHITECTURE.md`](ARCHITECTURE.md))과 양립합니다. `data-loader.js`는 전역 스크립트로 시작하되, 향후 `import`로 전환 가능하도록 순수 선언으로 작성합니다. 콘텐츠 모듈화(본 문서)는 **데이터 경계**의 모듈화이고, ES Modules는 **코드 경계**의 모듈화이므로 서로 독립적으로 진행 가능합니다.

### Q3. 해시 충돌 가능성은?
두 종류를 구분해야 합니다.
- **해시 함수 충돌** (서로 다른 입력 → 같은 해시): 과목당 카드가 수백 장 규모이므로 6자리(16^6 ≈ 1,680만)면 충돌 확률이 무시할 수준이며, 빌드 검증(`uniqueIds`)에서 검출 시 해시 길이를 늘려 대응합니다.
- **입력 충돌** (같은 입력 → 필연적으로 같은 해시): 해시 입력이 `subjectKey|chapterKey|term`이므로, **같은 단원에 동일 용어 카드가 2장** 있으면 해시 길이와 무관하게 충돌합니다. 이는 콘텐츠 문제이므로 빌드 검증에서 검출해 **용어를 구분하도록 콘텐츠를 수정**합니다(해시 길이로는 해결 불가). 단원 간 동일 용어는 `chapterKey`로 이미 구분됩니다.
