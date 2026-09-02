# 🧪 단위 테스트 가이드 (Unit Testing Guide)

> **작성일**: 2026-09-02
> **대상**: `tests/` 디렉토리의 자동화 테스트 (Unit + DOM)
> **프레임워크**: Node.js 내장 `node:test` (Unit) + Vitest/jsdom (DOM)

---

## 📋 목차

1. [테스트 개요](#1-테스트-개요)
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
| **Unit** | `node:test` | Node.js (DOM 없음) | `tests/unit/*.test.js` | 250 |
| **DOM** | Vitest + jsdom | 브라우저 DOM 시뮬레이션 | `tests/dom/*.test.js` | 10 |
| **합계** | | | | **260** |

### 설계 원칙

- **순수 로직 우선**: DOM 의존성 없는 모듈(`sanitize.js`, `sha256.js`, `trainer-calc.js` 등)은 Node.js 내장 테스트로 검증 → 빠르고 가벼움
- **DOM 테스트 분리**: `localStorage`, `document` 등 브라우저 API가 필요한 테스트는 Vitest + jsdom 환경에서 실행
- **회귀 가드**: CSP 위반(`delegation-guard`), Mermaid 렌더링 파이프라인 등 배포 후에만 발견되는 버그를 사전 차단
- **실제 콘텐츠 검증**: 교재 MD 파일의 Mermaid 블록 들여쓰기, 문법 등 실제 콘텐츠를 대상으로 검증
- **교재 무관 공통 테스트**: 합성 데이터(synthetic data)를 사용하여 교재 콘텐츠가 바뀌어도 로직 자체를 검증 (`study-aids`, `pdf-registry`, `glossary-query`, `markdown-parser-general`, `reader-format-general`)

---

## 2. 실행 명령어

```bash
# Unit 테스트만 실행 (250개)
npm test
# 또는
npm run test:unit

# DOM 테스트만 실행 (10개)
npm run test:dom

# 전체 실행 (Unit + 파서 정합성 + DOM)
npm run test:all

# Watch 모드 (Unit, 파일 변경 시 자동 재실행)
npm run test:watch
```

### `package.json` 스크립트 정의

| 스크립트 | 명령 | 비고 |
|----------|------|------|
| `test` | `node --test tests/unit/*.test.js` | Unit 테스트 |
| `test:unit` | `node --test tests/unit/*.test.js` | `test`와 동일 |
| `test:dom` | `vitest run` | DOM 테스트 (jsdom) |
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
| 14 | `study-aids.test.js` | 27 | `extractExamHighlights()`, `extractNumberDrills()`, `detectProcedureFlow()`, `detectAdminPenalty()`, `isKeySection()` | 합성 데이터, 교재 무관 |
| 15 | `pdf-registry.test.js` | 21 | `resolveRefPath()`, `mapSourceToRef()`, `resolveKeywordRef()`, 데이터 구조 검증 | 합성 데이터, 교재 무관 |
| 16 | `glossary-query.test.js` | 13 | `getGlossaryByRefFile()`, `getGlossaryByRefFiles()`, `getGlossaryEntry()`, `getAllGlossaryKeywords()` | 합성 데이터, 교재 무관 |
| 17 | `markdown-parser-general.test.js` | 35 | 헤더, 표, 리스트, 인라인 서식, 코드블록, 인용문, 특수 토큰, 빈 입력 | 합성 데이터, 교재 무관 |
| 18 | `reader-format-general.test.js` | 19 | 페이지 참조 제거, 기출문제/참조자료/출처 링크 변환, 용어집 자동 링크, Mermaid 보호 | 합성 데이터, 교재 무관 |
| | **합계** | **250** | | |

### DOM 테스트 (`tests/dom/`)

| # | 파일 | 테스트 수 | 검증 대상 | 비고 |
|---|------|-----------|-----------|------|
| 1 | `backup.dom.test.js` | 10 | `getBackupKeys()`, `exportData()`, `triggerImport()`, `importData()` | localStorage + DOM 조작 |
| | **합계** | **10** | | |

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
- **실제 교재 파일 검증**: `content/교재/*.md` 파일의 모든 Mermaid 블록에 대해 들여쓰기 및 문법 유효성 확인
- **CSS 클래스 분리 로직**: mindmap → `mermaid-mindmap`, flowchart → `mermaid-flowchart` 클래스 할당
- **`<br/>` 태그 보존**: mindmap과 flowchart 모두에서 `<br/>`이 엔티티로 보존됨

### 4.5 학습 보조 (Study Aids) — 교재 무관, 합성 데이터

#### `study-aids.test.js` (27개)
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
- `REF_FILE_TO_PATH` / `REF_REGISTRY`: 우선순위(과목N > 공통 > 법령원문) 검증

### 4.7 용어집 쿼리 (Glossary Query) — 교재 무관, 합성 데이터

#### `glossary-query.test.js` (13개)
- `getGlossaryByRefFile()`: prefix 매칭, `seenKeys` 중복 방지, 빈/미존재 파일명
- `getGlossaryByRefFiles()`: 다중 파일 수집, 중복 제거, null/빈 문자열 스킵
- `getGlossaryEntry()`: 존재/비존재, 반환 객체 불변성 (spread copy)
- `getAllGlossaryKeywords()`: 배열 반환, `{keyword, idxKey}` 구조, 일관성

### 4.8 일반 마크다운 파싱 (Markdown Parser General) — 교재 무관, 합성 데이터

#### `markdown-parser-general.test.js` (35개)
- **헤더**: `#`→`<h1>`, `##`→`<h2>`, `###`→`<h3>`, `useReaderStyles` 시 `<h5 class="md-h3">`/`<h6 class="md-h4">`
- **표**: 기본 테이블, 구분선 행 제외, 빈 셀 보존, `reader-table-wrapper` 클래스
- **리스트**: ul(`-`), ol(번호), `useCustomListDiv` 시 `md-list-item` div 렌더링
- **인라인 서식**: `**볼드**`→`<strong>`, `*이탤릭*`→`<em>`, `` `코드` ``→`<code>`, `[text](url)`→`<a>`, `allowItalics`/`allowInlineCode` 비활성화
- **코드블록**: 기본 `<pre>`, 언어 지정, 내부 볼드/이탤릭/링크 미적용
- **인용문**: `>`→`<blockquote>`, `useReaderStyles` 시 `md-quote`
- **특수 토큰**: `<br/>`, `<sup>`, `&nbsp;`, HTML 이스케이프(`<script>` 차단)
- **빈 입력**: 빈 문자열, 공백만
- **구분선**: `---`→`<hr>`, `useReaderStyles` 시 `reader-hr`
- **일반 문단**: `<p>`, `useReaderStyles` 시 `md-para`, `customSpacing` 시 빈 줄에 spacing div

### 4.9 교재 리더 포맷팅 (Reader Format General) — 교재 무관, 합성 데이터

#### `reader-format-general.test.js` (19개)
- **페이지 참조 제거**: `본문 p.22`, `p.22~p.27`, 헤더 `p.NN — `, 괄호 `(p.80~83)`, `참고: 본문 p.22`
- **기출문제 링크**: `[text](기출문제/과목N_...)` → `exam-link-btn` + `data-exam-md`
- **참조자료 링크**: `[file.pdf](../참조자료/...)` → `source-link` + `data-ref-html`
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
| `<모듈명>.dom.test.js` | `tests/dom/` | `backup.dom.test.js` |
| `<기능명>-<층위>.test.js` | `tests/unit/` | `mermaid-parser.test.js`, `mermaid-rendering.test.js` |

---

## 6. CI 연동

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

## 7. 트러블슈팅

### 7.1 Unit 테스트 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| `Cannot find module '../../src/...'` | ESM import 경로 오류 | `import.meta.url` 기준 상대 경로 확인 |
| `require is not defined` | CommonJS 모듈을 ESM에서 직접 import | `createRequire(import.meta.url)` 사용 |
| `localStorage is not defined` | Unit 테스트에 DOM API 없음 | 해당 테스트를 `tests/dom/`으로 이동 |

### 7.2 DOM 테스트 실패

| 증상 | 원인 | 해결 |
|------|------|------|
| `ReferenceError: document is not defined` | jsdom 환경 미적용 | `vitest.config.mjs`의 `environment: 'jsdom'` 확인 |
| `localStorage.clear is not a function` | jsdom localStorage 미초기화 | `beforeEach`에서 `localStorage.clear()` 호출 |
| 타이머 관련 비결정적 실패 | `setTimeout`/`setInterval` 비동기 | `vi.useFakeTimers()` / `vi.useRealTimers()` 사용 |

### 7.3 Mermaid 테스트 실패

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
| 쉘 자산 검증 | `tools/verify-shell-assets.js` | 프리캐시 파일 존재 확인 |
