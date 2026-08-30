# 📄 MD → HTML 변환·표시 로직 기술 문서

> **작성일**: 2026-08-29 (최종 갱신: 2026-08-31)
> **대상**: `content/*.md`, `docs/user/*.md` 마크다운 문서를 HTML로 변환하는 두 가지 파이프라인
> - **런타임 (JS)**: PWA 앱 내 `manual-viewer.js`가 실시간 MD → HTML 변환
> - **빌드 타임 (Python)**: `content/utils/md_to_html.py`가 독립 HTML 파일 생성

---

## 📋 목차

1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [마크다운 원문 확보 (Fetch / Bundle)](#2-마크다운-원문-확보-fetch--bundle)
3. [Service Worker 캐싱 전략](#3-service-worker-캐싱-전략)
4. [마크다운 파서 (`markdown-parser.js`)](#4-마크다운-파서-markdown-parserjs)
5. [뷰어 모듈 (`manual-viewer.js`)](#5-뷰어-모듈-manual-viewerjs)
6. [Mermaid 다이어그램 렌더링](#6-mermaid-다이어그램-렌더링)
7. [모바일 특화 처리](#7-모바일-특화-처리)
8. [데이터 흐름 요약 (Mermaid)](#8-데이터-흐름-요약-mermaid)
9. [Python MD→HTML 변환기 (`md_to_html.py`)](#9-python-mdhtml-변환기-md_to_htmlpy)
10. [배치 변환 스크립트 (`batch_convert.py`)](#10-배치-변환-스크립트-batch_convertpy)
11. [`content/` 내용 변경 시 수정 파일 및 절차 가이드](#11-content-내용-변경-시-수정-파일-및-절차-가이드)

---

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│              MD → HTML 변환 파이프라인 (두 가지 경로)               │
│                                                                 │
│  ┌─ A. 런타임 (JS / PWA 앱 내) ────────────────────────────────┐ │
│  │                                                              │
│  │  [1] 원문 확보                                                │
│  │   ├─ http(s):  fetch(content/*.md)  ← SW Cache First         │
│  │   └─ file://:  data/docs_md/*.js    ← 전역 __DOC_MD__ 폴백    │
│  │                                                              │
│  │  [2] 파싱                                                    │
│  │   └─ markdown-parser.js → parseMarkdown(mdText, options)     │
│  │       ├─ HTML 이스케이프 (sanitize.js)                        │
│  │       ├─ 인라인 서식 (bold, italic, code)                    │
│  │       ├─ 블록 파싱 (header, table, list, quote, code, hr)    │
│  │       └─ Mermaid 코드블록 → <pre class="mermaid">            │
│  │                                                              │
│  │  [3] 렌더링                                                  │
│  │   └─ manual-viewer.js → _renderBody(title, html)             │
│  │       ├─ 전체화면 오버레이 (#manual-overlay)                  │
│  │       ├─ 목차 자동 생성 (h2/h3 기반)                          │
│  │       ├─ Mermaid 온디맨드 로드 + run()                        │
│  │       └─ 테마 토큰 연동 (다크/라이트)                          │
│  │                                                              │
│  │  [4] 캐싱                                                    │
│  │   ├─ sessionStorage: 변환된 HTML (TTL 24h)                   │
│  │   └─ SW Cache Storage: .md 원문 (Cache First)                │
│  └──────────────────────────────────────────────────────────────┘
│                                                                 │
│  ┌─ B. 빌드 타임 (Python / 독립 HTML 생성) ─────────────────────┐
│  │                                                              │
│  │  [1] 원문 읽기                                                │
│  │   └─ content/*.md 파일 직접 읽기 (UTF-8)                      │
│  │                                                              │
│  │  [2] 전처리                                                  │
│  │   ├─ _auto_fence_ascii_diagrams() — 박스 그리기 자동 펜스     │
│  │   ├─ _tag_fenced_diagram_blocks_as_text() — 언어 태깅         │
│  │   ├─ _normalize_diagram_codeblocks() — 유니코드 정규화        │
│  │   └─ _inline_mermaid_fences() — mermaid 펜스 → <div> 변환     │
│  │       └─ 노드 레이블 sanitize (따옴표, 괄호, → 등)             │
│  │                                                              │
│  │  [3] 파싱 (python-markdown)                                  │
│  │   └─ extensions: fenced_code, tables, toc, codehilite,        │
│  │      admonition, attr_list, md_in_html                        │
│  │                                                              │
│  │  [4] 후처리                                                  │
│  │   ├─ 테이블 → .table-wrap (가로 스크롤)                       │
│  │   ├─ blockquote → callout 분류 (SOP/trouble/warning 등)      │
│  │   ├─ Mermaid → mermaid.ink API 사전 SVG 렌더링 (모바일)       │
│  │   └─ Mermaid 라이브러리 인라인 임베드 (3.5MB, 오프라인 보장)   │
│  │                                                              │
│  │  [5] 독립 HTML 파일 출력                                      │
│  │   └─ Tailwind CDN + 폴백 CSS, highlight.js, TOC, 검색,        │
│  │      다크/라이트 테마, 코드 접기/복사, 라이트박스, 인쇄        │
│  └──────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/markdown-parser.js` | 공통 마크다운 → HTML 변환 함수 (순수 함수, ESM) |
| `src/sanitize.js` | XSS 방어 — `escapeHTML()`, `safeTextWithBreaks()` |
| `src/manual-viewer.js` | 매뉴얼/학습안내서 런타임 뷰어 (fetch → 파싱 → 오버레이 표시) |
| `src/reader-format.js` | 교재 리더용 포맷터 (`parseMarkdown`에 reader 옵션 적용) |
| `src/exam-viewer.js` | 예상문제집 뷰어 (`parseMarkdown` 사용, Mermaid 비활성) |
| `sw.js` | Service Worker — `.md` 파일 Cache First, 프리캐시 |
| `tools/build_doc_bundles.js` | `file://` 폴백용 JS 번들 빌드 (`data/docs_md/*.js`) |
| `content/utils/md_to_html.py` | Python 독립 HTML 변환기 (GUI/CLI, Tailwind + Mermaid 임베드) |
| `content/utils/batch_convert.py` | 배치 변환 스크립트 (교재/학습안내서/보고서/문제은행 일괄 HTML 변환) |

---

## 2. 마크다운 원문 확보 (Fetch / Bundle)

### 2.1 소스 정의

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:15-18`

```javascript
const MD_SOURCES = {
    'user_manual': { path: 'docs/user/user_manual.md', title: '사용자 매뉴얼' },
    'study_summary': { path: 'content/학습안내서.md', title: '학습 안내서' }
};
```

### 2.2 프로토콜별 로드 전략

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:421-438`

```javascript
async function _loadMd(sourceKey) {
    // file://: fetch 원천 차단 → 번들 사용
    if (location.protocol === 'file:') {
        return _loadFromBundle(sourceKey);
    }
    // http(s): 라이브 .md 우선, 실패 시 번들 폴백
    try {
        return await _fetchMd(sourceKey);
    } catch (err) {
        return await _loadFromBundle(sourceKey);
    }
}
```

| 프로토콜 | 1순위 | 2순위 (폴백) |
|----------|-------|-------------|
| `http(s):` | `fetch(.md)` — 항상 최신 | `data/docs_md/*.js` 번들 |
| `file://` | — (fetch 차단) | `data/docs_md/*.js` 번들 |

### 2.3 번들 폴백 메커니즘

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:403-418`

- `tools/build_doc_bundles.js`가 `.md` 원문을 JS 파일로 번들링
- 번들 파일은 전역 `window.__DOC_MD__` 객체에 경로별 마크다운 원문 저장
- 클래식 `<script>` 동적 주입으로 로드 (ESM `import` 불필요 → `file://`에서도 동작)

```
docs/user/user_manual.md  →  data/docs_md/user_manual.js
content/학습안내서.md      →  data/docs_md/학습안내서.js
```

---

## 3. Service Worker 캐싱 전략

### 3.1 프리캐시 (설치 시)

`@/c:\Project\Personalized_Skincare\sw.js:110-114`

```javascript
const MD_ASSETS = [
  './docs/user/user_manual.md',
  './content/학습안내서.md',
  './content/교재/law/1과목_화장품법의이해.md',
  './content/교재/manufacturing/2과목_제조및품질관리.md',
  './content/교재/safety/3과목_유통화장품안전관리.md',
  './content/교재/understanding/4과목_맞춤형화장품의이해.md'
];
```

`@/c:\Project\Personalized_Skincare\sw.js:162-171`

```javascript
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      precacheResilient(SHELL_CACHE, SHELL_ASSETS),
      precacheResilient(DATA_CACHE, DATA_ASSETS),
      precacheResilient(SHELL_CACHE, MD_ASSETS)   // ← MD 파일 프리캐시
    ]).then(() => self.skipWaiting())
  );
});
```

- `precacheResilient()`는 개별 `cache.add()`를 `Promise.allSettled`로 처리
- 일부 404가 있어도 `skipWaiting()`은 실행됨 (전체 실패 방지)
- 실패분은 온디맨드 fetch 시 자가 치유

### 3.2 fetch 이벤트 — `.md` 파일

`@/c:\Project\Personalized_Skincare\sw.js:282-286`

```javascript
// 마크다운 원본 파일 → Cache First (정적 원본, 배포 시 갱신)
if (MD_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
}
```

| 전략 | 대상 | 이유 |
|------|------|------|
| **Cache First** | `*.md` | 정적 원본, 배포 시 `CACHE_VERSION` 갱신으로 캐시 무효화 |
| **Cache First** | navigation, `/src/*.js`, CSS | 캐시 스큐 방지 (동일 버전 캐시 세대 보장) |
| **Network First** | `data/registry.js` | 레지스트리는 최신 변경사항 즉시 반영 |

### 3.3 캐시 무효화

- `sw.js`의 `CACHE_VERSION`이 변경되면 `activate` 이벤트에서 구버전 `SHELL_CACHE` 전체 삭제
- 새 SW가 `skipWaiting()`으로 즉시 활성화 → 다음 page load에서 신버전 캐시 사용

---

## 4. 마크다운 파서 (`markdown-parser.js`)

`@/c:\Project\Personalized_Skincare\src\markdown-parser.js:16-266`

### 4.1 설계 원칙

- **의존성 제로**: 외부 라이브러리 없이 순수 정규식 + 줄 단위 파싱
- **XSS 방어**: 파싱 전 `escapeHTML()`로 모든 HTML 특수문자 이스케이프
- **옵션 기반**: 호출부에서 기능 on/off (`allowMermaid`, `useReaderStyles` 등)

### 4.2 파싱 파이프라인

```
[원문]
  ↓ 1. 안전한 인라인 태그 보호 (<br>, <sup>, &nbsp; → 토큰 치환)
  ↓ 2. HTML 이스케이프 (escapeHTML — & < > " ' 변환)
  ↓ 3. 토큰 복원 (<br>, <sup>, &nbsp;)
  ↓ 4. 펜스 라인 토큰 치환 (```언어 → FENCE_TOKEN언어)
  ↓ 4-1. 코드블록 내부 * ` 보호 (STAR_TOKEN, BTICK_TOKEN)
  ↓ 5. 인라인 서식 (**bold**, *italic*, `code`)
  ↓ 6. 줄 단위 블록 파싱:
       ├─ 코드블록 (```...```)
       ├─ 테이블 (| ... | ... |)
       ├─ 인용문 (> ...)
       ├─ 목록 (- / * / 1.)
       ├─ 헤더 (# ## ### ####)
       ├─ 구분선 (--- ***)
       ├─ 빈 줄
       └─ 일반 문단 (<p>)
  ↓ 7. 최종 블록 플러시 (미처리 테이블/인용/코드/목록)
[HTML 문자열]
```

### 4.3 옵션

`@/c:\Project\Personalized_Skincare\src\markdown-parser.js:16-24`

| 옵션 | 기본값 | 사용처 |
|------|--------|--------|
| `allowMermaid` | `false` | `manual-viewer.js` (`true`), `exam-viewer.js` (`false`) |
| `useCustomListDiv` | `false` | `reader-format.js` (`true`) |
| `useReaderStyles` | `false` | `reader-format.js` (`true`) |
| `customSpacing` | `false` | `reader-format.js` (`true`) |
| `allowItalics` | `true` | 전체 |
| `allowInlineCode` | `true` | 전체 |

### 4.4 테이블 파싱 상세

`@/c:\Project\Personalized_Skincare\src\markdown-parser.js:87-117`

- 양끝 파이프 `|` 제거 후 내부 `|`로 셀 분리
- 이스케이프된 파이프 `\|`는 `PIPE_ESC_TOKEN`으로 보호 후 복원
- 구분선 행 (`|---|:--:|`)은 데이터에서 제외
- 첫 행 → `<th>`, 나머지 → `<td>`
- 래퍼: `<div class="reader-table-wrapper"><table class="reader-table">`

### 4.5 Mermaid 코드블록 처리

`@/c:\Project\Personalized_Skincare\src\markdown-parser.js:131-132`

```javascript
if (allowMermaid && codeLang === 'mermaid') {
    output.push(`<pre class="mermaid">${codeLines.join('\n')}</pre>`);
}
```

- `allowMermaid: true` + 언어가 `mermaid`인 경우 → `<pre class="mermaid">` 태그로 출력
- 일반 코드블록은 `<pre class="reader-code-block"><code>...</code></pre>`
- 실제 다이어그램 렌더링은 뷰어 모듈에서 온디맨드 수행 (§6 참조)

---

## 5. 뷰어 모듈 (`manual-viewer.js`)

### 5.1 엔트리 포인트

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:443-465`

```javascript
async function openDocument(sourceKey) {
    // 1. 캐시 확인 (sessionStorage, TTL 24h)
    const cached = _getCached(sourceKey);
    if (cached) { _renderBody(title, cached); _open(); return; }

    // 2. 로딩 UI 표시
    _showLoading(title);

    // 3. MD 원문 로드 → HTML 변환 → 캐시 저장 → 렌더링
    const mdText = await _loadMd(sourceKey);
    const bodyHtml = _mdToHtml(mdText);
    _setCached(sourceKey, bodyHtml);
    _renderBody(title, bodyHtml);
}
```

### 5.2 캐시 (sessionStorage)

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:19-61`

- **키**: `manual_md_cache_v3_<정규화된_경로>`
- **값**: `{ timestamp, html }` JSON 문자열
- **TTL**: 24시간 (만료 시 자동 삭제)
- 변환된 **HTML만 저장** (원문이 아닌 변환 결과) → 재방문 시 파싱 생략

### 5.3 오버레이 UI

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:77-198`

- **전체화면 오버레이**: `position: fixed; inset: 0; z-index: 9999`
- **상단 바**: 닫기 버튼, 제목, 인쇄/PDF 버튼
- **스크롤 컨테이너**: `-webkit-overflow-scrolling: touch` (모바일 관성 스크롤)
- **본문**: `max-width: 900px; margin: 0 auto; line-height: 1.8`
- **테마 연동**: CSS 변수 `var(--bg-app)`, `var(--color-text-main)` 등 사용 → 다크/라이트 자동 전환

### 5.4 목차 자동 생성

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:200-211`

- 본문 내 `h2`, `h3` 요소를 스캔하여 `<details>` 목차 생성
- 각 헤딩에 자동으로 `id` 부여
- 클릭 시 `scrollIntoView({ behavior: 'smooth' })`로 이동

### 5.5 이벤트 위임 연동

- `index.html`에서 `data-click="ManualViewer.openManual"` / `data-click="ManualViewer.openSummary"` 속성으로 버튼 연결
- `src/app.js`의 `document.body.addEventListener('click', ...)`에서 위임 처리
- 안드로이드 Chrome `Text` 노드 대응: `e.target instanceof Element ? e.target : e.target.parentElement`

---

## 6. Mermaid 다이어그램 렌더링

### 6.1 온디맨드 로드

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:215-256`

```javascript
let _mermaidLoadPromise = null;

function _ensureMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (_mermaidLoadPromise) return _mermaidLoadPromise;
    _mermaidLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './vendor/mermaid/mermaid.min.js';  // 3.3MB
        script.async = true;
        script.onload = () => resolve(window.mermaid);
        document.head.appendChild(script);
    });
    return _mermaidLoadPromise;
}
```

- Mermaid 라이브러리 (3.3MB)는 **다이어그램이 있을 때만** 로드
- 모듈 스코프 `Promise`로 중복 주입/경쟁 방지
- 1회 로드 후 브라우저 캐시 → 오프라인에서도 렌더링 가능

### 6.2 렌더링 실행

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:233-256`

```javascript
function _renderMermaid() {
    const nodes = document.querySelectorAll('#manual-article pre.mermaid');
    if (nodes.length === 0) return;  // 다이어그램 없으면 로드 안 함

    _ensureMermaid().then((mermaid) => {
        const isLight = document.documentElement.classList.contains('light-theme');
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: isLight ? 'default' : 'dark'
        });
        mermaid.run({ querySelector: '#manual-article pre.mermaid' });
    });
}
```

- 테마에 따라 Mermaid 테마 전환 (`default` / `dark`)
- `securityLevel: 'strict'` — HTML 주입 공격 방지
- `startOnLoad: false` — 수동 `run()` 호출 (온디맨드)

### 6.3 테마 변경 시 재렌더링

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:472-479`

```javascript
document.addEventListener('themechange', () => {
    if (isOpen() && _currentBodyHtml) {
        article.innerHTML = _currentBodyHtml;
        _renderMermaid();  // 테마에 맞춰 다이어그램 재렌더링
    }
});
```

---

## 7. 모바일 특화 처리

### 7.1 오프라인 지원

| 계층 | 메커니즘 |
|------|----------|
| SW 프리캐시 | `MD_ASSETS`가 `install` 시 `SHELL_CACHE`에 캐싱 → 오프라인에서도 `.md` fetch 가능 |
| SW Cache First | `.md` 패턴 요청은 캐시 우선 서빙 |
| 번들 폴백 | `fetch` 실패 시 `data/docs_md/*.js` 번들에서 원문 확보 |
| sessionStorage | 변환된 HTML을 24h 캐싱 → 재방문 시 파싱 생략 |

### 7.2 모바일 UI 최적화

- **오버레이 전체화면**: `position: fixed; inset: 0` → 모바일에서 앱 내 문서 뷰어 경험
- **관성 스크롤**: `-webkit-overflow-scrolling: touch`
- **안드로이드 뒤로가기**: `history.pushState()`로 히스토리 상태 추가 → 뒤로가기로 오버레이 닫기
- **ESC 키**: `keydown` 리스너로 닫기
- **패딩 반응형**: `padding: 20px clamp(16px, 4vw, 48px)` → 화면 크기별 최적화
- **인쇄/PDF**: `@media print` 규칙으로 오버레이만 인쇄

### 7.3 안드로이드 Chrome Text 노드 대응

`@/c:\Project\Personalized_Skincare\src\app.js:948-954`

```javascript
document.body.addEventListener('click', (e) => {
    // 일부 안드로이드 Chrome에서 e.target이 Text 노드가 될 수 있어
    // closest()가 없어 TypeError 발생 → 버튼 동작 안 함
    const targetEl = e.target instanceof Element ? e.target : e.target.parentElement;
    if (!targetEl) return;
    const el = targetEl.closest('[data-click]');
    if (!el) return;
```

- 특정 안드로이드 Chrome에서 `e.target`이 `Text` 노드로 반환되는 버그 대응
- `Text` 노드는 `closest()` 메서드가 없어 `TypeError` 발생 → 버튼 클릭 무반응
- `instanceof Element` 체크 후 `parentElement` 폴백으로 해결

---

## 8. 데이터 흐름 요약 (Mermaid)

```mermaid
flowchart TD
    A[사용자: 매뉴얼/요약집 버튼 클릭] --> B{sessionStorage 캐시 hit?}
    B -->|Yes| C[_renderBody: HTML 주입 + 목차 + Mermaid]
    B -->|No| D[_showLoading: 스피너 표시]

    D --> E[_loadMd: 원문 확보]
    E --> F{프로토콜?}
    F -->|http(s)| G[fetch .md 파일]
    F -->|file://| H[번들 JS 주입]

    G --> I{fetch 성공?}
    I -->|Yes| J[마크다운 원문 확보]
    I -->|No| H

    H --> K{번들 로드 성공?}
    K -->|Yes| J
    K -->|No| L[_showError: 에러 UI]

    J --> M[parseMarkdown: MD → HTML 변환]
    M --> N[escapeHTML → 인라인 서식 → 블록 파싱]
    N --> O{allowMermaid?}
    O -->|Yes| P[mermaid 코드블록 → pre.mermaid]
    O -->|No| Q[일반 코드블록 → pre.reader-code-block]

    P --> R[_setCached: sessionStorage에 HTML 저장]
    Q --> R
    R --> C

    C --> S[_buildToc: h2/h3 목차 생성]
    S --> T[_renderMermaid: Mermaid 다이어그램 확인]
    T --> U{pre.mermaid 존재?}
    U -->|Yes| V[_ensureMermaid: 3.3MB 온디맨드 로드]
    U -->|No| W[렌더링 완료]
    V --> X[mermaid.run: 다이어그램 렌더링]
    X --> W

    subgraph SW 캐싱
        Y[SW install: MD_ASSETS 프리캐시]
        Z[SW fetch: .md → Cache First]
    end

    Y -.-> Z
    Z -.-> G
```

---

## 📎 관련 파일

| 파일 | 경로 |
|------|------|
| 마크다운 파서 (JS) | `src/markdown-parser.js` |
| XSS 방어 | `src/sanitize.js` |
| 매뉴얼 뷰어 | `src/manual-viewer.js` |
| 교재 리더 포맷터 | `src/reader-format.js` |
| 예상문제집 뷰어 | `src/exam-viewer.js` |
| Service Worker | `sw.js` |
| 번들 빌더 | `tools/build_doc_bundles.js` |
| 이벤트 위임 | `src/app.js` |
| Python 변환기 | `content/utils/md_to_html.py` |
| 배치 변환 스크립트 | `content/utils/batch_convert.py` |

---

## 9. Python MD→HTML 변환기 (`md_to_html.py`)

`@/c:\Project\Personalized_Skincare\content\utils\md_to_html.py`

### 9.1 개요

`md_to_html.py`는 Python 기반의 독립 HTML 변환기입니다. PWA 앱의 런타임 변환(JS)과는 별도로, **빌드 타임에 완전한 독립 HTML 파일**을 생성합니다. 모바일 인앱 브라우저(카카오톡, 삼성 인터넷 뷰어 등)에서 CDN 스크립트가 차단되는 환경을 대상으로 설계되었습니다.

### 9.2 실행 모드

| 모드 | 명령 | 설명 |
|------|------|------|
| **GUI** (기본) | `python md_to_html.py` | PySide6 드래그&드롭 GUI, 설정 영속화 (`QSettings`) |
| **CLI** | `python md_to_html.py --cli --in <file.md> --out <file.html>` | 명령행 변환, CI/배치용 |

CLI 옵션:
- `--in`: 입력 MD 파일 경로 (기본값: `학습안내서.md`)
- `--out`: 출력 HTML 경로 (기본값: 입력과 동일 이름 `.html`)
- `--title`: HTML `<title>` (기본값: 파일명 stem)
- `--collapse-min-lines`: 코드 블록 접기 임계값 (기본값: 35, 0=Off)
- `--mermaid-sanitize`: `auto` / `on` / `off`
- `--no-embed-mermaid`: Mermaid 라이브러리 인라인 생략 (CDN 사용, PC 권장)
- `--no-prerender-mermaid`: Mermaid 사전 SVG 렌더링 생략 (클라이언트 사이드 렌더링)

### 9.3 변환 파이프라인

```
[MD 원문]
  ↓ 1. _auto_fence_ascii_diagrams()
       — 박스 그리기 문자(┌┐└┘├┤┬┴┼│─═ 등)가 2줄 이상 → ```text 자동 펜스
  ↓ 2. _tag_fenced_diagram_blocks_as_text()
       — 언어 미지정 펜스에 박스 문자 포함 시 ```text 태깅
  ↓ 3. _normalize_diagram_codeblocks()
       — NFKC 정규화, 탭→4공백, NBSP→공백, 전각공백→2공백
  ↓ 4. _inline_mermaid_fences()
       — ```mermaid ... ``` → <div class="mermaid">...</div>
       — 노드 레이블 sanitize: 따옴표 감싸기, → 치환, 괄호 전각화
       — 다이어그램 타입 감지 (sequenceDiagram, xychart-beta, quadrantChart 등)
       — 타입별 node_pat 스킵 (flowchart 전용 문법이 아닌 경우)
  ↓ 5. python-markdown 변환
       — extensions: fenced_code, tables, toc (toc_depth 2-4), codehilite,
         admonition, attr_list, md_in_html
  ↓ 6. 후처리
       — <table> → <div class="table-wrap"><table> (가로 스크롤)
       — <blockquote> → callout 분류 (SOP/trouble/warning/form/character/exam)
       — <pre><code class="language-mermaid"> → <div class="mermaid"> (포스트 처리)
  ↓ 7. Mermaid 사전 렌더링 (prerender_mermaid=True 시)
       — mermaid.ink API로 SVG 렌더링 → <div class="mermaid-svg"> 교체
       — 실패 시 원본 <div class="mermaid"> 유지 (클라이언트 사이드 폴백)
  ↓ 8. Mermaid 라이브러리 임베드 (embed_mermaid=True 시)
       — CDN에서 mermaid.min.js (~3.5MB) 다운로드 → <script> 인라인 교체
       — 메모리 캐시 (디스크 파일 생성 안 함)
       — 다운로드 실패 시 CDN <script> 태그 유지 (폴백)
  ↓ 9. HTML 템플릿 주입
       — %%TITLE%%, %%TOC_HTML%%, %%BODY_HTML%%, %%COLLAPSE_MIN_LINES%%
[독립 HTML 파일]
```

### 9.4 `RenderConfig` 데이터클래스

`@/c:\Project\Personalized_Skincare\content\utils\md_to_html.py:39-44`

```python
@dataclass(frozen=True)
class RenderConfig:
    collapse_codeblock_min_lines: int = 35
    mermaid_sanitize_mode: str = "auto"
    embed_mermaid: bool = True
    prerender_mermaid: bool = True
```

### 9.5 생성되는 HTML 문서 기능

| 기능 | 설명 |
|------|------|
| **Tailwind CSS** | CDN 로드 + CDN 차단 시 폴백 CSS (내장 최소 유틸리티 클래스) |
| **highlight.js** | 코드 블록 구문 강조 (CDN + 폴백 테마 내장) |
| **Mermaid** | 사전 SVG 렌더링(모바일) 또는 클라이언트 사이드 렌더링(PC) |
| **다크/라이트 테마** | `localStorage` 영속화, `prefers-color-scheme` 감지, FAB 버튼 |
| **TOC 사이드바** | 데스크톱: sticky 사이드바, 모바일: 드로어, 검색 + AutoFold + scroll-spy |
| **인문서 검색** | `Ctrl+K` / `/` 단축키, IME 조합 중 실시간 검색, `mark.search-mark` 하이라이트 |
| **코드 블록 UX** | Copy 버튼, 언어 라벨, 줄 수 기반 접기/펼치기 (localStorage 영속화) |
| **ASCII 다이어그램** | 박스 그리기 문자 감지 → `ascii-diagram` 클래스, D2Coding/NanumGothicCoding 폰트 |
| **라이트박스** | 이미지 클릭 시 전체화면 확대 |
| **Back to Top** | 스크롤 200px 이상 시 플로팅 버튼 |
| **인쇄/PDF** | `@media print` — UI 요소 숨김, 코드 블록 줄바꿈, 테이블 전체 표시 |
| **Callout 분류** | blockquote 내용 기반 자동 분류: SOP(초록), 트러블슈팅(주황), 경고(빨강), 서식(남색), 캐릭터(청록), 시험(보라) |

### 9.6 Mermaid 사전 렌더링 상세

`@/c:\Project\Personalized_Skincare\content\utils\md_to_html.py:3167-3233`

- `<div class="mermaid">` 블록을 mermaid.ink API(`https://mermaid.ink/svg/{base64}?theme=dark&bgColor=0f172a`)로 SVG 변환
- 변환 성공 시 `<div class="mermaid-svg">{svg}</div>`로 교체
- 실패 시 원본 `<div class="mermaid">` 유지 → 클라이언트 사이드 렌더링 폴백
- 라이트 테마에서 SVG에 `filter: invert(0.88) hue-rotate(180deg)` 적용

### 9.7 Mermaid 라이브러리 임베드

`@/c:\Project\Personalized_Skincare\content\utils\md_to_html.py:71-114`

- `_ensure_mermaid_js()`: CDN 3개 순차 시도 (jsdelivr → unpkg → cdnjs), 200KB 미만 응답은 에러 페이지로 간주하고 스킵
- `_embed_mermaid_js()`: `<script src="...mermaid.min.js">` 태그를 인라인 `<script>`로 교체
- `</script` → `<\/script` 이스케이프로 인라인 블록 조기 종료 방지
- 메모리 캐시 (`_MERMAID_JS_MEMORY`) — 디스크 파일 생성 없음

### 9.8 JS 런타임 파서와의 차이

| 항목 | JS (`markdown-parser.js`) | Python (`md_to_html.py`) |
|------|---------------------------|--------------------------|
| **실행 시점** | 런타임 (브라우저) | 빌드 타임 (로컬) |
| **파서** | 자체 정규식 기반 (의존성 제로) | python-markdown 라이브러리 |
| **출력** | HTML fragment (오버레이에 주입) | 완전한 독립 HTML 파일 |
| **Mermaid** | 클라이언트 사이드 `mermaid.run()` | 사전 SVG 렌더링 + 라이브러리 인라인 |
| **구문 강조** | 미지원 | highlight.js + Pygments codehilite |
| **TOC** | `h2`/`h3` 스캔 후 `<details>` 생성 | python-markdown `toc` 확장 (toc_depth 2-4) |
| **검색** | 미지원 | 인문서 전체 검색 (IME 대응) |
| **테마** | CSS 변수 연동 (앱 테마) | 독립 `localStorage` (`doc_theme`) |
| **캐싱** | sessionStorage (TTL 24h) | 파일 출력 (영속) |
| **ASCII 다이어그램** | 미지원 | 자동 펜스 + 폰트 최적화 |
| **Callout** | 미지원 | blockquote 자동 분류 (6종) |

---

## 10. 배치 변환 스크립트 (`batch_convert.py`)

`@/c:\Project\Personalized_Skincare\content\utils\batch_convert.py`

### 10.1 개요

`batch_convert.py`는 `md_to_html.py`의 `markdown_to_tailwind_html()` 함수를 호출하여 여러 MD 파일을 일괄 HTML로 변환하는 스크립트입니다. `content/` 폴더를 기준으로 상대 경로를 사용합니다.

### 10.2 변환 대상

```python
BATCH_TARGETS = {
    "교재": [
        "교재/law/1과목_화장품법의이해.md",
        "교재/manufacturing/2과목_제조및품질관리.md",
        "교재/safety/3과목_유통화장품안전관리.md",
        "교재/understanding/4과목_맞춤형화장품의이해.md",
    ],
    "학습안내서": ["학습안내서.md"],
    "report": [
        "report/출제비중분포조사결과.md",
        "report/출제비중기반학습방법.md",
        "report/법령최신확인결과.md",
        "report/오답위험_분석보고서.md",
    ],
    "문제은행": [
        "문제은행/과목1_문제은행_교재인용.md",
        "문제은행/과목2_문제은행_교재인용.md",
        "문제은행/과목3_문제은행_교재인용.md",
        "문제은행/과목4_문제은행_교재인용.md",
    ],
}
```

- 총 13개 MD 파일 → 13개 HTML 파일 변환
- 출력: 각 그룹별 `html/` 하위 폴더 (예: `content/교재/html/`, `content/report/html/`)

### 10.3 실행

```bash
cd content/utils
python batch_convert.py
```

- `md_to_html.py`와 동일한 디렉토리에서 실행 필요
- `RenderConfig` 기본값 사용 (모바일 모드: SVG 사전 렌더링 + Mermaid 임베드)

---

## 11. `content/` 내용 변경 시 수정 파일 및 절차 가이드

> `content/` 폴더의 마크다운 원문, 폴더 구조, 또는 매니페스트가 변경될 때 수행해야 할 수정 작업과 빌드/배포 절차를 정리합니다.

### 11.1 변경 유형별 수정 파일 매트릭스

| 변경 유형 | 수정 필요 파일 | 설명 |
|-----------|---------------|------|
| **교재 MD 내용 수정** (기존 파일) | (수정 불필요) | `manifest.json`의 `dir`/`file` 필드가 경로를 참조하므로, 파일명이 같으면 자동 반영 |
| **교재 MD 파일 추가/삭제/이름 변경** | `content/manifest.json` | `subjects[].chapters[].file` 필드 갱신 |
| | `sw.js` | `MD_ASSETS` 배열의 경로 갱신 + `CACHE_VERSION` 버전업 |
| | `content/utils/batch_convert.py` | `BATCH_TARGETS["교재"]` 경로 갱신 |
| **문제은행 MD 변경** | `content/manifest.json` | `exams` 섹션의 파일 경로 갱신 |
| | `content/utils/batch_convert.py` | `BATCH_TARGETS["문제은행"]` 경로 갱신 |
| **참조자료 MD 변경** | `src/views/textbook-reader.js` | 참조자료 링크 렌더링 로직 (경로 패턴 확인) |
| | `tools/build/plugins/ingredients.plugin.js` | `INGREDIENTS_DIR` 경로 (원료 하위 폴더 변경 시) |
| **학습안내서 MD 변경** | (파일명 동일 시 수정 불필요) | `manual-viewer.js`, `build_doc_bundles.js`, `sw.js`가 `content/학습안내서.md` 경로 참조 |
| | `content/utils/batch_convert.py` | 파일명 변경 시 `BATCH_TARGETS["학습안내서"]` 갱신 |
| **보고서 MD 변경** (`content/report/`) | `content/utils/batch_convert.py` | `BATCH_TARGETS["report"]` 경로 갱신 |
| **새 과목 추가** | `content/manifest.json` | `subjects[]`에 새 과목 항목 추가 (`key`, `name`, `dir`, `chapters`) |
| | `sw.js` | `MD_ASSETS`에 새 과목 MD 경로 추가 |
| | `content/utils/batch_convert.py` | `BATCH_TARGETS["교재"]`에 새 파일 추가 |
| | `content/audiobook/` | 오디오북 파이프라인 스크립트에 새 과목 추가 (필요 시) |
| **폴더 구조 개편** | 위 모든 파일 | 경로가 일괄 변경되므로 모든 참조 파일 검토 필요 |

### 11.2 빌드 절차 (content/ 변경 후)

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

### 11.3 배포 절차

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

### 11.4 자동 생성 파일 (수정 금지)

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

### 11.5 주요 참조 파일 목록 (content/ 경로 의존)

| 파일 | 참조 방식 | 비고 |
|------|----------|------|
| `content/manifest.json` | SSOT — 모든 빌드의 원천 | `subjects[].dir`, `chapters[].file` |
| `sw.js` | `MD_ASSETS` 하드코딩 | 프리캐시 대상 MD 파일 경로 |
| `src/manual-viewer.js` | `MD_SOURCES` 객체 | 학습안내서, 사용자매뉴얼 경로 |
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
| `content/audiobook/generate_all_mp3.py` | 과목 키 참조 | 오디오북 생성 |
