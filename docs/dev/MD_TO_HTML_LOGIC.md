# 📄 MD → HTML 변환·표시 로직 기술 문서

> **작성일**: 2026-08-29
> **대상**: `content/*.md`, `docs/user/*.md` 마크다운 문서를 모바일/PWA에서 HTML로 변환하여 표시하는 전체 파이프라인

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

---

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                      MD → HTML 변환 파이프라인                      │
│                                                                 │
│  [1] 원문 확보                                                    │
│   ├─ http(s):  fetch(content/*.md)  ← SW Cache First             │
│   └─ file://:  data/docs_md/*.js    ← 전역 __DOC_MD__ 폴백        │
│                                                                 │
│  [2] 파싱                                                        │
│   └─ markdown-parser.js → parseMarkdown(mdText, options)         │
│       ├─ HTML 이스케이프 (sanitize.js)                            │
│       ├─ 인라인 서식 (bold, italic, code)                        │
│       ├─ 블록 파싱 (header, table, list, quote, code, hr)        │
│       └─ Mermaid 코드블록 → <pre class="mermaid">                │
│                                                                 │
│  [3] 렌더링                                                      │
│   └─ manual-viewer.js → _renderBody(title, html)                 │
│       ├─ 전체화면 오버레이 (#manual-overlay)                      │
│       ├─ 목차 자동 생성 (h2/h3 기반)                              │
│       ├─ Mermaid 온디맨드 로드 + run()                            │
│       └─ 테마 토큰 연동 (다크/라이트)                              │
│                                                                 │
│  [4] 캐싱                                                        │
│   ├─ sessionStorage: 변환된 HTML (TTL 24h)                       │
│   └─ SW Cache Storage: .md 원문 (Cache First)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/markdown-parser.js` | 공통 마크다운 → HTML 변환 함수 (순수 함수, ESM) |
| `src/sanitize.js` | XSS 방어 — `escapeHTML()`, `safeTextWithBreaks()` |
| `src/manual-viewer.js` | 매뉴얼/요약집 런타임 뷰어 (fetch → 파싱 → 오버레이 표시) |
| `src/reader-format.js` | 교재 리더용 포맷터 (`parseMarkdown`에 reader 옵션 적용) |
| `src/exam-viewer.js` | 예상문제집 뷰어 (`parseMarkdown` 사용, Mermaid 비활성) |
| `sw.js` | Service Worker — `.md` 파일 Cache First, 프리캐시 |
| `tools/build_doc_bundles.js` | `file://` 폴백용 JS 번들 빌드 (`data/docs_md/*.js`) |

---

## 2. 마크다운 원문 확보 (Fetch / Bundle)

### 2.1 소스 정의

`@/c:\Project\Personalized_Skincare\src\manual-viewer.js:15-18`

```javascript
const MD_SOURCES = {
    'user_manual': { path: 'docs/user/user_manual.md', title: '사용자 매뉴얼' },
    'study_summary': { path: 'content/study_summary.md', title: '핵심 단권화 요약집' }
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
content/study_summary.md  →  data/docs_md/study_summary.js
```

---

## 3. Service Worker 캐싱 전략

### 3.1 프리캐시 (설치 시)

`@/c:\Project\Personalized_Skincare\sw.js:110-114`

```javascript
const MD_ASSETS = [
  './docs/user/user_manual.md',
  './content/study_summary.md'
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
| 마크다운 파서 | `src/markdown-parser.js` |
| XSS 방어 | `src/sanitize.js` |
| 매뉴얼 뷰어 | `src/manual-viewer.js` |
| 교재 리더 포맷터 | `src/reader-format.js` |
| 예상문제집 뷰어 | `src/exam-viewer.js` |
| Service Worker | `sw.js` |
| 번들 빌더 | `tools/build_doc_bundles.js` |
| 이벤트 위임 | `src/app.js` |
