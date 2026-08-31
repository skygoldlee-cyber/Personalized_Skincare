# 🎴 플래시카드 생성 로직 설계문서

> **최종 업데이트**: 2026-08-31
> **관련 파일**: `src/textbook-parser.js`, `tools/build/plugins/textbook.plugin.js`, `src/views/flashcard.js`, `src/state.js`, `index.html`, `css/study.css`

---

## 📋 목차

1. [개요](#-개요)
2. [데이터 흐름](#-데이터-흐름)
3. [카드 추출 파이프라인](#-카드-추출-파이프라인)
4. [카드 품질 필터링](#-카드-품질-필터링)
5. [카드 메타데이터](#-카드-메타데이터)
6. [퀴즈 생성](#-퀴즈-생성)
7. [프론트엔드 렌더링](#-프론트엔드-렌더링)
8. [파서 등가성](#-파서-등가성)

---

## 📌 개요

플래시카드 시스템은 교재 Markdown(`content/*.md`)에서 표(table)와 리스트 항목(list item)을 파싱하여 **용어-설명 카드**를 자동 생성한다. 각 카드는 중요도 점수에 따라 필터링되며, 8가지 타입으로 분류되어 프론트엔드에서 배지로 표시된다.

### 핵심 원칙

- **이중 파서 패리티**: 빌드 파서(`tools/build/plugins/textbook.plugin.js`)와 런타임 파서(`src/textbook-parser.js`)가 바이트 단위로 동일한 결과를 생성해야 함
- **점수 기반 품질 관리**: 모든 카드는 0-100점 중요도 점수를 받으며, 40점 미만은 자동 제거
- **정수 연산**: 부동소수점 오차 방지를 위해 가중치 합산에 정수 산술 사용

---

## 🔄 데이터 흐름

```
content/*.md (교재 원문)
       │
       ├── [빌드 타임] textbook.plugin.js → data/subjects/*.js (번들)
       │
       └── [런타임] textbook-parser.js → window.STUDY_DATA (메모리)
                    │
                    ▼
            loadFlashcards() ── 필터링 + 정렬
                    │
                    ▼
            renderFlashcard() ── DOM 렌더링
```

### 빌드 타임 경로

1. `tools/build/index.js`가 `manifest.json`의 과목 목록을 순회
2. 각 과목에 대해 `textbook.plugin.js`의 `build()` 호출
3. `parseMarkdownFile()`이 각 챕터 MD 파일을 파싱하여 `{ cards, quizzes, warnings }` 반환
4. 과목 단위로 중복 카드/퀴즈 제거 후 `data/subjects/<key>.<hash>.js` 번들로 출력

### 런타임 경로

1. `DataLoader.loadSubject()`가 MD 파일을 fetch하여 `mdByFile` 맵 구성
2. `buildSubjectData()`가 `parseMarkdownFile()`을 호출하여 카드/퀴즈/챕터 데이터 생성
3. `window.STUDY_DATA[subjectKey]`에 저장
4. `loadFlashcards()`가 필터링 + 정렬 후 `renderFlashcard()`로 화면 갱신

---

## 🏗️ 카드 추출 파이프라인

`parseMarkdownFile(content, subjectId, filename, chapterKey)` 함수가 수행하는 전체 파이프라인:

### 1. 섹션 스캔

```javascript
// ## 헤더를 섹션으로 인식
if (line.startsWith('## ')) {
    currentSection = line.substring(3).trim();
    skipSection = /* 제외 섹션 판별 */;
}
```

**제외 섹션** (카드 추출에서 스킵):
- `🧭`으로 시작하는 섹션 (네비게이션)
- `🎯 과목 시각화` 섹션
- `📋 별표` 섹션
- `📊`로 시작하는 섹션 (비교표/데이터 표)
- `🔢`로 시작하는 섹션 (숫자 암기)
- `🔗`로 시작하는 섹션
- `데이터 구조` 포함 섹션
- `주요 성분 데이터` 포함 섹션

### 2. 테이블 기반 카드 추출

Markdown 표(`|`로 시작하는 라인)에서 카드를 추출한다.

```
| 항목 | 내용 |
| --- | --- |
| 원료A | 설명... |
```

**처리 순서**:

1. 첫 번째 열 = `term`(용어), 두 번째 열 = `definition`(설명)
2. `cleanText()`로 마커 제거 (🔖기출, 📌중요, 🎯기출/중요)
3. **사전 필터링** (아래 "카드 품질 필터링" 참조)
4. 메타데이터 계산 (`cardType`, `importance`, `difficulty`)
5. importance ≥ 40인 카드만 `cards[]`에 추가

### 3. 리스트 항목 기반 카드 추출

`🔖기출` 또는 `📌중요` 마커가 포함된 리스트 항목에서 카드를 추출한다.

```
- **용어**: 설명 🔖기출
```

**패턴 매칭**:
```javascript
/^[-*]\s+\*\*([^*]+)\*\*(?:\s*🔖기출)?\s*[:：-]\s*(.+)$/
```

- `**굵은 글씨**` 부분이 `term`, 콜론/대시 이후가 `definition`
- 리스트 카드는 항상 `isKey = true`
- 테이블과 동일한 사전 필터링 + 메타데이터 계산 적용

---

## 🧹 카드 품질 필터링

모든 카드(테이블/리스트 공통)는 다음 필터를 순차적으로 통과해야 한다:

### 사전 필터링 (메타데이터 계산 전)

| 순서 | 필터 | 조건 | 이유 |
|------|------|------|------|
| 1 | 빈 값 | `!term \|\| !desc` | 의미 없는 카드 |
| 2 | 의미 없는 definition | `/^[—–\-✔✖×○●□■☆★]$/` | 비교표 마커 등 |
| 3 | 숫자만 term | `/^\d+$/` | 표 행 번호 |
| 4 | **괄호 정리** | `**` 제거, `(L숫자)` 제거, ①②③ 제거, 한국어 괄호 제거 | 불필요한 메타정보 |
| 5 | 빈 term | `!cleanTerm` | 정리 후 빈 값 |
| 6 | 짧은 term | `length <= 2` | 의미 부족 |
| 7 | 긴 term | `length > 50` | 문장이 term에 들어간 경우 |
| 8 | **범용 표현** | `isGenericTerm(cleanTerm)` | "기능", "기준" 등 |
| 9 | 동일 term/definition | `cleanTerm === cleanDesc` | 순환 카드 |
| 10 | 별표 참조 | `/^별표\s*\d/`, `/←.*별표.*참조$/` | 참조성 설명 |
| 11 | 마크다운 링크만 | `/^\[.+\]\(.+\)$/` | 링크만 있는 설명 |
| 12 | 짧은 definition | `length <= 10` | 설명으로서 의미 부족 |

### 사후 필터링 (메타데이터 계산 후)

| 필터 | 조건 | 이유 |
|------|------|------|
| importance | `< 40` | 저품질 카드 제거 |

### 범용 표현 필터 (`isGenericTerm`)

범용적으로 사용되는 표현(예: "정의", "목적", "기능", "보관 조건")은 키워드로 부적합하다고 판단하여 제거한다.

**두 가지 매칭 방식**:

1. **정확 매칭** (`GENERIC_SINGLE` Set): 단일 단어가 범용어인 경우
   - 예: `정의`, `목적`, `종류`, `특징`, `기준`, `방법`, `관리`, `주의사항` 등 80+ 단어

2. **접미사 매칭** (`GENERIC_SUFFIXES` 배열): 15자 이하의 term이 범용 접미사로 끝나는 경우
   - 예: `기능`, `기준`, `방법`, `절차`, `조건`, `사항`, `내용`, `순서`, `단계` 등 60+ 접미사
   - 단, `term.length > suffix.length` 조건 (접미사 자체는 제외)

### 괄호 정리 규칙

```javascript
const cleanTerm = term
    .replace(/\*\*/g, '')                    // **굵은글씨** → 굵은글씨
    .replace(/\s*\(L\d+\)\s*/g, '')           // (L12) 줄번호 참조 제거
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')       // 원번호 기호 제거
    .replace(/\s*\(([^a-zA-Z()]*?)\)/g, '')   // 한국어 괄호 제거, 영어 괄호는 유지
    .trim();
```

**영어 괄호 유지 예시**:
- `GMP (Good Manufacturing Practice)` → 괄호 유지
- `기능성화장품 (미백)` → 괄호 제거 → `기능성화장품`

---

## 🏷️ 카드 메타데이터

각 카드는 3가지 메타데이터를 가진다:

### Card 객체 구조

```javascript
{
    id: string,           // stableId(subjectId, chapterKey, 'card', term)
    category: string,     // ## 섹션명
    term: string,         // 정제된 용어
    definition: string,   // 정제된 설명
    isKey: boolean,       // 기출/중요 마커 여부
    cardType: string,     // 8가지 타입 중 하나
    importance: number,   // 0-100 중요도 점수
    difficulty: string    // 'easy' | 'medium' | 'hard'
}
```

### 1. 카드 타입 분류 (`classifyCardType`)

`term`과 `definition`을 합친 텍스트에서 패턴 매칭으로 8가지 타입 중 하나를 결정한다.

**분류 우선순위** (위에서 아래로, 첫 매칭이 채택):

| 우선순위 | 타입 | 매칭 패턴 | 예시 |
|----------|------|-----------|------|
| 1 | `penalty` | 벌금, 징역, 과태료, 벌칙, 행정처분, 등록취소, 영업정지, 폐지, 처벌 | "벌금 500만원 이하" |
| 2 | `prohibition` | 금지, 안 된다, 수 없, 불가, 하지 아니, 금지함 | "다량보존제 사용 금지" |
| 3 | `exception` | 예외, 단,, 제외, 아니하, 예외적으로 | "다만, 의약품외품은 예외" |
| 4 | `number` | 숫자+단위 (일, 년, 개월, 회, 명, %, 이상, 이하, 미만, 초과, 분의, 시간, 도, 배, g, mL, kg, mg) | "30일 이내 신고" |
| 5 | `requirement` | 요건, 조건, 기준, 필요, 자격, 구비, 갖추어야 | "구비서류 3종" |
| 6 | `comparison` | vs, ≠, ＝, 구분, 비교, 차이, 차이점, 다르, 해당한다, 해당하지 | "A vs B 구분" |
| 7 | `procedure` | 절차, 순서, 단계, 과정, 신청, 신고, 등록, 승인, 보고, 통보 | "신고 절차" |
| 8 | `definition` | (기본값, 매칭 없을 때) | 일반 개념 설명 |

### 2. 중요도 점수 (`scoreCard`)

6가지 요인을 가중 합산하여 0-100점을 계산한다.

| 요소 | 가중치 | 점수 범위 | 계산 기준 |
|------|--------|-----------|-----------|
| **시험중요도** | 30% | 50-100 | 기본 50, `isKey` +30, penalty/prohibition/exception +20, number/requirement/comparison +10 |
| **암기필요도** | 25% | 50-100 | 기본 50, 숫자+단위 +30, number/comparison 타입 +20, term 3-15자 +10 |
| **숫자/조건성** | 15% | 0-100 | 숫자+단위 100, 요건/조건/기준 70, requirement/procedure 타입 50, 기타 0 |
| **기출관련성** | 15% | 0-100 | `isKey` 100, 카테고리에 "기출" 포함 30, 기타 0 |
| **카드적합성** | 10% | 0-100 | 기본 70, term 3-15자 +20, term >30자 -20, definition >200자 -20, definition <15자 -10, •· 시작 -10 |
| **반복학습가치** | 5% | 0-100 | 기본 60, definition/comparison 타입 +20, **굵은글씨** 포함 +10, •· 시작 -10 |

**가중 합산 공식** (정수 연산):

```javascript
const score = Math.round(
    (examImportance * 30 +
     memorizeNeed * 25 +
     numericScore * 15 +
     examRel * 15 +
     cardFit * 10 +
     repeatValue * 5) / 100
);
```

> ⚠️ **부동소수점 주의**: 가중치를 직접 곱하는 방식(예: `examImportance * 0.3`)은 부동소수점 오차로 파서 패리티 문제를 발생시킨다. 정수 가중치 합산 후 100으로 나누는 방식을 사용해야 한다.

### 3. 난이도 분류 (`determineDifficulty`)

| 난이도 | 조건 |
|--------|------|
| `hard` | definition 길이 > 150 이거나 `•`/`·`로 시작 |
| `easy` | definition 길이 ≤ 50 이고 cardType이 `definition` |
| `medium` | definition에 숫자 포함 이거나 길이 > 80 |
| `easy` | (위 조건 모두 미충족 시) |

---

## ❓ 퀴즈 생성

`isKey = true`인 카드에 대해서만 퀴즈를 생성한다. 퀴즈는 3가지 우선순위로 생성된다:

### 테이블 행 기반 퀴즈

| 우선순위 | 조건 | 퀴즈 타입 | 설명 |
|----------|------|-----------|------|
| 1 | `**굵은글씨**` 포함 | `blank` | 굵은 글씨를 빈칸으로 변환 |
| 2 | 숫자+단위 포함 | `blank` | 숫자를 빈칸으로 변환 |
| 3 | (둘 다 없음) | `term` | definition을 보여주고 term을 맞추기 |

### 리스트 항목 기반 퀴즈

리스트 항목은 항상 `isKey = true`이므로 항상 퀴즈가 생성된다. 테이블과 동일한 우선순위를 사용한다.

### 퀴즈 ID 생성

```javascript
const makeQuizId = (term, answer) => {
    const base = `${term}|${answer}`;
    const n = (quizIdCounts.get(base) || 0) + 1;
    quizIdCounts.set(base, n);
    const input = n === 1 ? base : `${base}#${n}`;
    return stableId(subjectId, chapterKey, 'quiz', input);
};
```

동일 term/answer 조합이 여러 개일 경우 `#n` 접미사로 고유성을 보장한다.

### 숫자 빈칸 정규식

```javascript
/\b\d+(?:\.\d+)?(?:%|세 이하|세 이상|개월|일|년|배|종|가지|개|시간|g|ml|kg|℃|도|분|초|주|ppm|㎛|회\/hr|개\/hr|개\/㎥)\b/g
```

---

## 🎨 프론트엔드 렌더링

### 상태 관리 (`state.js`)

```javascript
flashcards: {
    subject: null,           // 현재 과목 키
    currentIndex: 0,         // 현재 카드 인덱스
    keyOnly: false,          // 기출/중요만 필터
    difficultyFilter: 'all', // 'all' | 'easy' | 'medium' | 'hard'
    sortBy: 'importance',    // 'importance' | 'default'
    data: []                 // 필터링된 카드 목록
}
```

### 필터링 + 정렬 (`loadFlashcards`)

```javascript
// 1. 기출/중요 필터
if (fcConfig.keyOnly) {
    cards = cards.filter(c => c.isKey);
}

// 2. 난이도 필터
if (fcConfig.difficultyFilter !== 'all') {
    cards = cards.filter(c => c.difficulty === fcConfig.difficultyFilter);
}

// 3. 중요도 내림차순 정렬
if (fcConfig.sortBy === 'importance') {
    cards = [...cards].sort((a, b) => (b.importance || 0) - (a.importance || 0));
}
```

### 카드 타입 배지 (`renderFlashcard`)

카드 앞면/뒷면에 `cardType`에 따른 색상 배지를 표시한다.

| 타입 | 라벨 | 색상 |
|------|------|------|
| `penalty` | 처벌 | 빨강 (#dc2626) |
| `prohibition` | 금지 | 진빨강 (#b91c1c) |
| `exception` | 예외 | 주황 (#d97706) |
| `number` | 숫자 | 파랑 (#2563eb) |
| `requirement` | 요건 | 보라 (#7c3aed) |
| `comparison` | 비교 | 청록 (#0d9488) |
| `procedure` | 절차 | 초록 (#16a34a) |
| `definition` | 개념 | 회색 (#6b7280) |

### HTML 구조

```html
<!-- 필터 바 -->
<select id="fc-difficulty-select">
    <option value="all">전체</option>
    <option value="easy">쉬움</option>
    <option value="medium">보통</option>
    <option value="hard">어려움</option>
</select>

<!-- 카드 앞면 -->
<div class="card-header">
    <div class="card-header-left">
        <span class="card-badge" id="card-front-category">카테고리</span>
        <span class="card-type-badge" id="card-front-type"></span>
    </div>
    <span class="card-key-icon" id="card-front-star">★</span>
</div>
```

---

## 🔒 파서 등가성

### 원칙

빌드 파서(`tools/build/plugins/textbook.plugin.js`)와 런타임 파서(`src/textbook-parser.js`)는 **바이트 단위로 동일한** `{ name, cards, quizzes, chapters }`를 생성해야 한다.

### 검증

```bash
npm run check:parser
# → tools/check_parser_parity.js가 두 파서의 출력을 직접 대조
```

### 알려진 패리티 함정

1. **부동소수점 오차**: `0.3 * 50` vs `30 * 50 / 100` 결과가 다를 수 있음 → 정수 연산 사용
2. **정규식 앵커 차이**: `^\*\*` (앵커 있음) vs `\*\*` (앵커 없음)는 다른 매칭 결과를 생성 → 양쪽 정규식을 완전히 동일하게 유지
3. **`path.basename` vs 수동 구현**: 빌드 파서는 Node.js `path.basename()` 사용, 런타임 파서는 `basenameNoMd()` 수동 구현 → 동일 결과 보장 필요

### 파일 대응표

| 기능 | 빌드 파서 | 런타임 파서 |
|------|-----------|-------------|
| 파일 읽기 | `fs.readFileSync()` | `mdByFile` 맵에서 가져옴 |
| 줄 분할 | `content.split(/\r?\n/)` | 동일 |
| stableId | `ctx.idFactory.stableId` (Node crypto) | `./sha256.js` (순수 JS 구현) |
| 섹션명 | `path.basename(filename, '.md')` | `basenameNoMd(filename)` |
| 나머지 로직 | 동일 | 동일 |

---

## 📊 현재 카드 통계 (2026-08-31)

| 과목 | 카드 수 |
|------|---------|
| law (화장품법) | 149 |
| manufacturing (제조/품질관리) | 501 |
| safety (유통안전관리) | 169 |
| understanding (맞춤형화장품) | 341 |
| **합계** | **1,160** |
