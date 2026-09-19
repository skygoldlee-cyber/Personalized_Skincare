# 문항 스키마 설계 — Cosmetic Pass Master

맞춤형화장품 조제관리사 시험 문항을 위한 데이터 스키마와 채점 유틸(`questions.js`) 설계 문서.
합답형(조합형) 문항의 "진술 단위 O/X → 정답 조합 도출" 구조가 핵심.

---

## 1. 시험 문제 형태 (설계 배경)

- **총 100문항 / 120분 / 총점 1,000점**
- **1~80번 선다형**, **81~100번 단답형**

| 과목 | 배점 | 비중 | 선다형 | 단답형 |
|---|---|---|---|---|
| 1. 화장품법의 이해 | 100점 | 10% | 7 | 3 |
| 2. 화장품 제조 및 품질관리 | 250점 | 25% | 20 | 5 |
| 3. 유통화장품 안전관리 | 250점 | 25% | 25 | 0 |
| 4. 맞춤형화장품의 이해 | 400점 | 40% | 28 | 12 |

**합격 기준:** 총점의 60%(600점) 이상 **AND** 각 과목 만점의 40% 이상(하나라도 미만이면 과락).

선다형은 두 갈래로 출제된다.

- **단일정답형** — 보기 5개 중 옳은/틀린 하나를 고름.
- **합답형(조합형)** — `ㄱ·ㄴ·ㄷ·ㄹ` 진술을 제시하고 "옳은 것을 모두 고른 것은?"을 물은 뒤, 선택지가 `①ㄱ,ㄴ ②ㄱ,ㄷ …` 조합으로 나옴. 답 자체는 조합 하나(단일 정답)지만, 진술 전부를 정확히 판단해야 맞출 수 있어 체감 난이도가 높다. 배합한도·사용제한 원료·법령 수치 영역에 집중됨.

---

## 2. 문항 유형

`type` 하나로 네 유형을 구분한다. 퀴즈·모의고사·오답노트가 유형 분기 없이 동일 함수로 처리된다.

| type | 설명 | 정답 표현 | 응답(response) |
|---|---|---|---|
| `single` | 단일정답 5지선다 | `options[].correct` | 옵션 id |
| `combo` | 합답형(ㄱㄴㄷ 조합) | 진술 `truth`로 **도출** | 옵션 id (또는 2단계 응시용 `{optionId, judgments}`) |
| `short` | 단답형(81~100번) | `accept[]` 표기 목록 | 입력 문자열 |
| `ox` | 진위형 — 진술 1개의 참/거짓 판정. O/X 드릴 산출물을 담는 유형 ([COMBO_STUDY_STRATEGY.md](./COMBO_STUDY_STRATEGY.md) §4-①) | `truth` | `'O'`/`'X'`/boolean |

---

## 3. 스키마

### 공통 필드

```js
{
  id: 'q-04-137',      // 전역 유니크
  subject: 4,          // 과목 1~4
  type: 'combo',       // 'single' | 'combo' | 'short'
  stem: '문제 발문',
  points: 8,           // 배점 (과목 합이 100/250/250/400 되도록 배분)
  difficulty: 3,       // 1~5 (선택)
  tags: ['사용제한원료'],
  source: '제10회 기출 변형',
  explain: '전체 해설 (선택)'
}
```

### single — 단일정답

```js
{
  type: 'single',
  options: [
    { id: '1', text: '…', truth: true },
    { id: '2', text: '…', correct: true, truth: false, explain: '실제로는 …' },
    { id: '3', text: '…', truth: true }
  ],
  answer: '2'          // 선택: correct 옵션과 일치 검증됨
}
```

- `correct` — 발문의 정답 여부 (채점용)
- `truth` — **명제 자체의 참/거짓** (발문 극성과 무관). O/X 드릴 자동 생성 시 각 보기를
  그대로 참/거짓 문항으로 펼치는 기반이 된다. "옳지 않은 것은?" 문항에서는 정답 보기가
  `correct:true, truth:false`, 나머지 4개가 `truth:true`가 되어 오히려 좋은 O/X 재료가 된다.

### combo — 합답형 (핵심)

진술마다 `truth`(O/X)를 달고, 선택지는 "옳다고 주장하는 진술 집합"(`members`)으로 표현한다.
정답은 저장하지 않고 진술 truth에서 **도출**한다.

> **저작 규칙 — 출처 명기 (필수)**: 합답형 문항은 `citation` 필드에 출처·인용을 반드시 담고,
> 렌더링 시 **문제 서두**(stem 앞)에 표기한다. 진술 저작의 근거가 되는 교재 라인/조문을 적는다
> (예: `'📖 교재: L1247 (한선·땀샘)'`, `'📖 화장품법 제3조'`). `check:combo`가 누락을 오류로 검출한다.

```js
{
  type: 'combo',
  citation: '📖 교재: L610, 제5조 (사용 가능 원료)',   // 필수 — 문제 서두에 표기
  statements: [
    { id: 'ㄱ', sid: 'st-04-0001', conceptId: '혼합소분범위', text: '…', truth: true,  explain: '근거 조문·수치' },
    { id: 'ㄴ', sid: 'st-04-0002', conceptId: '신고주체',     text: '…', truth: false, explain: '실제로는 …' },
    { id: 'ㄷ', sid: 'st-04-0003', conceptId: '혼합소분범위', text: '…', truth: true,  explain: '…' },
    { id: 'ㄹ', sid: 'st-04-0004', conceptId: '신고주체',     text: '…', truth: false, explain: '…' }
  ],
  options: [
    { id: '1', members: ['ㄱ', 'ㄴ'] },
    { id: '2', members: ['ㄱ', 'ㄷ'] },        // ← 도출 정답 (truth인 진술 집합과 일치)
    { id: '3', members: ['ㄴ', 'ㄷ', 'ㄹ'] },
    { id: '4', members: ['ㄱ', 'ㄷ', 'ㄹ'] },
    { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }
  ],
  answer: '2'          // 선택: 도출값과 일치 검증됨
}
```

**왜 도출 방식인가**

- **데이터 무결성** — `validateQuestion()`이 저장된 `answer`와 도출값 불일치를 잡아낸다. 문항을 대량 임포트할 때 정답 오타를 사전에 걸러낸다.
- **진술 단위 피드백** — 채점 결과에 `perStatement`(각 진술의 O/X + 해설)가 포함된다. "어느 진술에서 틀렸는지"를 학습자에게 정확히 짚어줄 수 있다 — 이 시험에서 실점이 가장 잦은 지점.

**진술 필드**

- `id` — 문항 내 라벨 (`ㄱ`, `ㄴ`, …)
- `sid` — **전역 안정 ID**. 진술은 문항이 아니라 독립 추적 가능한 학습 원자다
  ([COMBO_STUDY_STRATEGY.md](./COMBO_STUDY_STRATEGY.md) §2-①③). 오답 통계·SM-2 간격반복 큐의 키로 사용해,
  같은 지식이 여러 문항에 중복 출제돼도 오판이 한 곳으로 누적된다.
- `conceptId` — 혼동쌍·관련 진술 그룹 (예: `'신고주체'` — "신고 vs 등록" 진술들을 묶어
  나란히 대조하는 학습 화면을 자동 구성, 전략 §2-⑤).

**perStatement 피드백 — 사용자 오판 자동 유도**

`gradeAnswer()`는 사용자가 고른 옵션의 `members`를 "참이라고 판정한 진술 집합"으로 해석해
진술별 오판을 자동 산출한다:

```js
perStatement = [
  { id: 'ㄴ', sid: 'st-04-0002', truth: false, userJudged: true,  judgedCorrect: false, explain: '…' },
  //                                         ^^^^^^^^^^^^^^^^ "ㄴ을 O로 착각" 자동 검출
]
```

2단계 응시 모드(진술별 O/X 선판정 → 조합 선택)에서는
`response = { optionId, judgments: { 'ㄱ': true, … } }`로 명시 판정을 받을 수 있고,
이 경우 `judgments`가 `members` 유도보다 우선한다. 미응답이면 `userJudged/judgedCorrect`는 `null`.

### short — 단답형

```js
{
  type: 'short',
  stem: '천연보습인자(NMF)의 …',
  accept: ['아미노산', 'amino acid', 'aminoacid']  // 허용 표기 목록
}
```

`normalizeText()`로 공백·대소문자·괄호 흔들림을 흡수한 뒤 비교한다 (`' 아미노산 '`, `'Amino Acid'` 모두 정답 처리).

### ox — 진위형

O/X 드릴 문항을 담는 유형. combo의 `statements[]`와 single의 `options[].truth`에서
자동 생성되는 산출물이므로 원본 역추적 필드를 둔다.

```js
{
  type: 'ox',
  stem: '다음 진술의 참/거짓을 판정하시오.',
  statement: '맞춤형화장품판매업은 지방식약청장에게 신고한다',
  truth: true,
  derivedFrom: 'q-04-137#ㄴ',   // 원본 문항#진술 — 약점 집계 시 귀속용
  explain: '화장품법 제3조'
}
```

---

## 4. API

| 함수 | 용도 | 반환 |
|---|---|---|
| `deriveComboAnswer(q)` | combo 정답 조합 도출 | 옵션 id 또는 `null`(유일하지 않을 때) |
| `generateComboOptions(allIds, truthIds, {count})` | combo 오답 조합 자동 생성 — 정답 집합 외 무작위 부분집합으로 선지 구성. 반영 전 `validateQuestion`으로 유일성 재확인 | 옵션 배열 |
| `validateQuestion(q)` | 데이터 무결성 검사 | 문제 사유 배열(`[]`이면 정상) |
| `gradeAnswer(q, response)` | 한 문항 채점 | `{ correct, earned, max, correctAnswer, perStatement? }` |
| `scoreExam(questions, responses)` | 모의고사 집계·합격 판정 | 아래 참조 |
| `normalizeText(s)` | 단답형 비교용 정규화 | 정규화 문자열 |

### 태그 표준 어휘 (`STANDARD_TAGS`)

`tags`는 고정 어휘를 권장한다 — "숫자·한도·기한만 모은 카드 덱" 같은 주제별
자동 필터([COMBO_STUDY_STRATEGY.md](./COMBO_STUDY_STRATEGY.md) §2-④)의 기반:

```
수치 | 한도 | 기한 | 금지원료 | 처분기준 | 구성비 | 절차 | 정의
```

### `scoreExam` 반환

```js
{
  totalEarned, totalMax, totalPct,
  bySubject: { 1: { earned, max, pct, pass }, 2: {…}, 3: {…}, 4: {…} },
  subjectPass,   // 전 과목 40% 이상인가
  passed,        // 총점 60% AND subjectPass
  details: [ … ] // 문항별 채점 결과
}
```

---

## 5. 뷰 연결

- **퀴즈 / 오답·복습** → `gradeAnswer(q, response)` 하나로 정오답 + 배점 + (combo면) 진술 피드백.
- **단답형** → `normalizeText()`로 표기 흔들림 흡수.
- **모의고사** → `scoreExam()`이 과목별 집계 후 **총점 60% + 과목별 40% 과락**을 그대로 판정.
- **오답노트** → `details[]` 또는 개별 `gradeAnswer` 결과에서 `question.id` + 사용자 응답을 저장.
- **O/X 드릴** → combo `statements[]`와 single `options[].truth`를 펼쳐 `type:'ox'` 문항으로 자동 생성.
- **약한 진술 추적** → `perStatement.judgedCorrect === false`인 진술의 `sid`를 누적해
  SM-2 간격반복 큐(`spaced-repetition.js`)에 재출제 카드로 등록. `conceptId`로 혼동쌍 대조 화면 구성.

---

## 6. 자동 변환 파이프라인 (`tools/build_combo_drills.js`)

`data/exams/subjectN.*.js`(실제 앱 파이프라인의 `choice`/`blank` 문항)를 합답형으로 **전량 기계 변환**한다.
객관식은 선지를 진술로 재조합하고, 단답형은 정답 풀링으로 진술을 구성한다.

**변환 결과**: 과목1 `100` / 과목2 `250` / 과목3 `250` / 과목4 `400` = **1,000문** (원본 문제은행과 동일 총량), 스키마 검증 오류 0.

### 6-1. 변환 모드 분류

| 모드 | 대상 | truth 규칙 | 발문 처리 |
|---|---|---|---|
| `fact` | 명제형 선지(문장형) — 전체 선지의 60%+가 서술 종결어미이고 발문이 설명형(`설명/내용/사항/방법/특징/작용/관한/대한…`) | 부정형 발문(`옳지 않은/틀린/맞지 않는…`)이면 정답 보기 = 거짓 진술 → `!isAnswer`, 아니면 `isAnswer` | 주제만 추출해 `…으로 옳은 것을 모두 고른 것은?`으로 **긍정 정규화** (극성은 truth에 이미 반영) |
| `answer` | 회상·분류형 선지(고유명사·수치) | `isAnswer` (발문 극성 보존 — 정답 집합과 일치) | 꼬리 패턴 교체 → `…모두 고른 것은?` / `…에 해당하는 것을 모두 고른 것은?`. 교체 불가 꼬리(`~하는가?`, 콜론 종결 등)는 **원형 유지 + `— 해당하는 것을 모두 고르시오.` 부기** |

발문 끝의 `(단, …)` 조건 주석은 변환 전 분리해 변환 후 재부착한다.

### 6-2. 특수 케이스 처리

- **`'위 ①②③ 모두'` 메타 선지가 정답** (과목3 4문): 원형 숫자 개수만큼 실질 선지를 참으로.
  상호배타 메타 선지(`~없었다`, `~불필요` 등)는 참에서 제외하고, 개수 불일치 시 신뢰 불가로 스킵.
- **조합형 발문 오탐 방지**: `COMBO_STEM_RE = /모두 고른|ㄱ\s*[.)]/` — `조합` 단어가 들어간
  일반 객관식(성분-함량 조합, 제품 유형 조합, 조합 향료 등)은 answer 모드로 정상 변환.
- **제외**: 진짜 ㄱㄴㄷ 조합 발문, 참 진술 0개, 진술 2개 미만.

### 6-3. 단답형(`blank`) → 합답형

선지가 없으므로 **정답 풀링**으로 진술을 구성한다.

1. **정답 풀 구축** — 과목별로 단답형 대표 정답(허용 답안 첫 번째)을 유형별(`num`: 숫자 포함 / `term`: 용어) Map으로 수집 + 전 과목 통합 풀.
2. **오답 선지 추첨** — 같은 유형 풀에서 seeded 추첨 4개. 정답의 허용 답안 전부와
   정규화(공백·대소문자·괄호 제거) 후 **부분문자열 관계인 후보는 모호성으로 제외**
   (정답 `맞춤형화장품 조제관리사` vs 후보 `조제관리사` → 제외).
3. **풀 보충** — 과목 내 후보가 4개 미만이면 전 과목 풀로 보충 (과목3 단답형 1문 대응).
4. **다중 빈칸 `(B)` 문항** — `(A)`·`(B)` 각각 1문항으로 변환 (정답 = `answer` 쉼표 분할의 해당 순번).
   과목1 +1, 과목2 +4 → 총 산출 1,005문 (원본 1,000문 대비 +5).
5. **발문** — `**[ (A) ]**` 마커를 `(A)`로 평문화 + `— (A)에 해당하는 것을 모두 고르시오.` 부기.

### 6-4. 결정론성·추적성·검증

- **옵션 생성**: `generateComboOptions`에 **mulberry32 seeded RNG**(시드 = 문항 id 해시)를 주입해
  재빌드해도 동일 조합이 재현된다. 도출 정답 위치도 시드로 분산.
- **`sid` 통합**: `stableId(subjKey, 'bank', 'st', …)` — O/X 드릴과 **동일 규칙**으로 생성해
  같은 진술이 O/X·합답형 어디서 오판돼도 하나의 `sid`로 누적된다.
- **`citation` 자동 생성**: `explanation`의 `교재: Lxxxx`·`화장품법 제N조` 패턴을 추출해
  `📖 교재: L579 (출처: 과목N 문제은행 Qn)` 형태로 구성 — 서두 명기 규칙(§3) 충족.
- **검증**: 생성 문항 전량 `validateQuestion` 통과 후 `deriveComboAnswer`로 `answer` 고정.
- **진술 셔플**: 정답이 항상 `ㄱ`에 오지 않도록 seeded 셔플로 진술 순서를 섞는다 (단답형).
- **`conceptId` 클러스터**: explanation의 첫 교재 `L####`를 부여 — 같은 교재 구간의 진술을
  개념 그룹으로 묶어 취약 리뷰의 혼동쌍 표시에 사용 (없으면 `q:{문항id}` 폴백).
- **전체집합 오지 제한**: `generateComboOptions`의 `banFull`로 정답이 전체가 아닌 문항의
  "모두 고르기" 선지를 제한해 선지 패턴 단조로움을 줄인다.
- **진술 explain 비중복**: 생성 문항은 진술별 해설을 저장하지 않고 문항 `explain`으로 폴백 — 번들 ~45% 절감.
- **태그 추론**: `tools/drill-utils.js`의 `inferTags`가 STANDARD_TAGS 어휘(수치·기한·금지원료 등)를
  발문+진술에서 자동 부여 — "숫자·기준 카드 덱" 필터 기반.
- **문항 id**: `stableId(subjKey,'bank','combo',원문id)` — 재생성 순서와 무관하게 안정.

### 6-5. 산출물

| 산출물 | 경로 | 용도 |
|---|---|---|
| 런타임 번들 | `data/drills/combo_subjectN.js` → `var COMBO_DRILLS_subjectN` | `DataLoader.loadComboDrills(N)`이 로드 — 파일럿(`combo_pilot.js`, cb- 접두)과 병합 |
| 검토용 MD | `content/문제은행/과목N_합답형.md` | 문제은행 MD와 동일 구조(문제부/정답부 분리). 자동 변환분만 수록해 과목당 101/254/250/400 정합 (다중 빈칸 (B) 문항 +5) |

재생성: `npm run build:drills` (O/X + 합답형 번들 일괄).

---

## 7. 사용 예

```js
import { gradeAnswer, scoreExam, validateQuestion } from './src/questions.js';

// 출제/임포트 검증
const problems = validateQuestion(q);
if (problems.length) console.warn(q.id, problems);

// 단일 채점
const r = gradeAnswer(q, userResponse);
// r.perStatement 로 combo 진술별 O/X 렌더

// 모의고사
const result = scoreExam(questions, responses);
if (result.passed) { /* 합격 */ }
```

---

## 8. 유의점

- **모듈은 순수 로직**(렌더링 없음). ES 모듈로 `src/questions.js`에 두고 `app.js`에서 `import`.
- `scoreExam`은 일부 과목만 있는 소규모 세트에선 빈 과목이 과락 처리되어 `passed:false`가 나온다. 100문항 정식 세트에서 정상 동작.
- **예시 문항의 내용·수치는 자리표시자**다. 실제 진술의 O/X 근거는 식약처 교수학습 가이드(개정판)로 검증해 채워야 한다.

---

*데이터 출처(시험 형식): 식품의약품안전처 · 대한상공회의소 자격평가사업단 공개자료 (2026.09 기준)*
