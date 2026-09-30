# 멀티시험 확장 설계 — 법령DB·지식DB 일반화

> 상위 문서: [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §9 멀티시험 플랫폼 구조 · [`LEARNING_PREMIUM_PLAN.md`](LEARNING_PREMIUM_PLAN.md) "두 번째 시험 추가 전 선결 과제" · [`../../report_archive/PRO_MULTI_EXAM_EVALUATION.md`](../../report_archive/PRO_MULTI_EXAM_EVALUATION.md) (시험 후보 평가)
> **관련 SPEC ID**: `ES-01~05` (시험 선택·전환) · `DA-06~08` (멀티시험 대칭 구조·경로) · `RR-13` (참조자료 레지스트리) · `RR-17` (law.go.kr 링크) · `RR-19`, `FO-24` (고시 감시) — 로드맵 항목 ROAD-M1(타 시험 등록)의 실행 설계
> **문서 ID**: DOC-DSN-10
> **상태**: Phase A·B·C 구현 완료 (2026-09-30) — A1·A2는 기존 코드가 이미 시험별 테이블 구조라 확인으로 종결, A3~A7 본 문서대로 구현. B는 스캐폴더 라운드트립 검증, C는 식품기사(food) 파일럿으로 전 체인 검증 (§9 표 하단 주석 참조)
> **목적**: 다른 자격시험을 "콘텐츠 팩"으로 온보딩할 수 있도록, 현재 cosmetic에 결합된 법령·지식 데이터 계층을 시험 비종속으로 일반화한다.

---

## 1. 배경과 목표

`PRO_MULTI_EXAM_EVALUATION.md`의 결론: Pro 로직은 멀티시험 이식 준비가 완료됐고, 확장의 실제 병목은 **시험당 콘텐츠 제작 공수**다. 그런데 법령·고시·원료 DB 같은 도메인 데이터 계층은 아직 cosmetic 고정 가정이 남아 있어, 두 번째 시험을 올리면 스크립트 사본·분기 코드가 생긴다.

본 설계의 목표는 두 가지다:

1. **법령DB** — 법령·고시 메타데이터(명칭·종류·law.go.kr 슬러그·감시 설정)를 시험과 분리된 SSOT로 관리하고, 원문 링크·고시 감시·인용 체인이 이를 공유하게 한다.
2. **지식DB** — 성분사전(`ingredients_data`)으로 검증된 "도메인 엔티티 사전" 패턴을 스키마 일반화해, 시험마다 다른 엔티티(식품첨가물·유해물질·약물 등)를 코드 변경 없이 수용한다.

**검증 기준** (LEARNING_PREMIUM_PLAN의 KPI와 동일): 두 번째 시험 추가 시 `src/`·`tools/` 수정 0줄 — 콘텐츠 배치 + `exams.json` 엔트리만으로 전 기능 동작.

---

## 2. 현황 진단

### 2.1 이미 시험 중립 (재사용 가능)

| 영역 | 자산 | 비고 |
|------|------|------|
| 시험 레지스트리 | `content/exams.json` + `src/exam-context.js` | 활성 시험 해석·`scopedKey` 진도 격리·`hasFeature` 게이팅 |
| 경로 계층 | `src/paths.js` (`contentPath`/`dataPath`) | 모든 콘텐츠 경로가 활성 시험 루트 기준 |
| 교재·문제은행 | `manifest.json` → `tools/build/exam_targets.js` 순회 빌드 | `build:data` 전 단계가 이미 시험 순회형 |
| 학습 엔진 | SM-2·진술 트래커·모의고사·OX/combo 드릴·카드/퀴즈 파서 | 콘텐츠 무관 |
| PDF→MD | `ref-pipeline/` (pdf2md·batch_convert·verify) | 도메인 무관 — `EXAM_CONTENT_ROOT` 계약 일부 존재 |
| 지식 번들 로딩 | `data-loader.js` `loadIngredients()` | `registry.ingredients.{bundle,global}` 메타에서 읽으므로 번들명 무관 |
| 저장·동기화 | `storage.js` + `sync.js` | `sync_snapshots.exam_id` 단위로 이미 분리 |

### 2.2 시험 결합 (일반화 필요)

| 모듈 | 현재 상태 | 결합 내용 |
|------|----------|----------|
| `src/pdf-registry.js` | 생성물이지만 **단일 공유 출력**이 기본 시험에 바인딩 | ARCHITECTURE §9에 후속 과제로 이미 명시 |
| `src/keyword-index.js` | 동일 | 교재 셀→참조자료 키워드 매핑이 단일 시험용 |
| `src/law-links.js` | `LAW_DOC_URLS` 상수 | 화장품법 계열 한글주소 매핑이 하드코딩 |
| `src/notice-check.js` | `RULE_NAME`·`LAW_SEARCH_URL`·repo URL 상수 | 특정 고시·특정 저장소 고정 (`statusUrl`만 examId 인지) |
| `ref-pipeline/check_mfds_notice.py` | `STATUS_FILE`/`REFS_FILE` 경로 고정 | `content/exams/cosmetic/` 하드코딩 |
| `ref-pipeline/check_laws.py` | `LAWS` 상수 | cosmetic 전용 8개 법령 (LEARNING_PREMIUM_PLAN 선결 과제) |
| `src/views/dictionary.js` | 성분 전용 UI | 필드 라벨·검색·배지가 "성분" 도메인에 고정 |
| `formula-*` 일괄 | cosmetic 도메인 모듈 | `features.formula`로 이미 게이팅 — 타 시험은 `false`면 충분 |

---

## 3. 목표 아키텍처 — 3계층

```
┌──────────────────────────────────────────────────────────────┐
│ 플랫폼 코어 (src/, tools/)                                     │
│   파서·리더·학습엔진·스토어·동기화 — 시험 무관, 코드 변경 없음    │
├──────────────────────────────────────────────────────────────┤
│ 공용 법령DB  content/lawdb.json                    ← 신규      │
│   법령 메타데이터 SSOT: 명칭·종류(법령/행정규칙)·슬러그·발령기관  │
│   (개인정보보호법 등 여러 시험이 공유하는 법령을 단일 관리)        │
├──────────────────────────────────────────────────────────────┤
│ 시험 팩  content/exams/<id>/ + data/exams/<id>/    ← 기존 구조 │
│   ├─ manifest.json     과목·챕터·문제은행·합격규칙·UI문구        │
│   ├─ references.json   참조자료 매핑 + lawId 참조              │
│   ├─ knowledge/        지식DB 원본 (엔티티 사전)      ← 신규     │
│   ├─ 교재/ 문제은행/ 참조자료/ref_md/                          │
│   └─ notice_status.json 고시 감시 상태                         │
└──────────────────────────────────────────────────────────────┘
```

**설계 원칙**: 기존 "콘텐츠 설정 파일 → 빌드 생성물" 패턴(`references.json` → `pdf-registry.js`, `exams.json` → `data/exams.js`)을 그대로 따른다. 새 파일 형식을 도입하더라도 새 메커니즘은 도입하지 않는다.

---

## 4. 법령DB 설계

### 4.1 `content/lawdb.json` (공용 SSOT)

law.go.kr 한글주소 규약(공백·특수문자 제거 명칭 → `/법령/` 또는 `/행정규칙/`)을 데이터로 내린다.

```json
{
  "schemaVersion": 1,
  "laws": [
    {
      "id": "cosmetic-act",
      "name": "화장품법",
      "type": "law",
      "slug": "화장품법",
      "matchKeys": ["화장품법(법률)", "화장품법"],
      "watch": { "target": "law" }
    },
    {
      "id": "cosmetic-safety-std",
      "name": "화장품 안전기준 등에 관한 규정",
      "type": "admrul",
      "slug": "화장품안전기준등에관한규정",
      "matchKeys": ["안전기준"],
      "watch": { "target": "admrul" },
      "children": ["안전기준_별표"]
    }
  ]
}
```

- `type`: `law` → `law.go.kr/법령/<slug>`, `admrul` → `/행정규칙/<slug>` (법률·시행령·총리령은 `law`, 고시·규정은 `admrul`)
- `matchKeys`: 파일명·표시명 매칭용 접두 키 — 기존 `LAW_DOC_URLS`의 매칭 문자열에 해당
- `children`: 별표·부속 파편이 모법으로 링크되는 패턴 (`KFCC_*` → 기능성화장품 고시, `시행규칙_별표` → 화장품법 시행규칙). `lawUrlFor`가 파일명에 children 접두가 포함되면 부모 slug로 해석
- `watch`: `check_mfds_notice.py`가 조회할 DRF target (`law`/`admrul`). 미지정 시 감시 제외
- 시험 간 공유 법령(개인정보보호법·소비자기본법 등)은 여기 한 곳에만 등록 — 법 개정·명칭 변경 시 단일 수정점

### 4.2 생성물 전환 — `law-links.js`

현재 손편집 상수 `LAW_DOC_URLS`를 빌드 생성물로 전환한다. `build_pdf_registry.js`(이미 시험 순회 + `references.json` 소비)를 확장해 `src/law-links.js`의 데이터부를 생성:

```js
// 생성 결과 (src/law-links.js — 생성물 표기 헤더 추가)
const _EXAM_LAW_URLS = {
  "cosmetic": [ ["화장품법시행규칙", ".../법령/화장품법시행규칙"], ... ],
  "<newExam>": [ ... ]
};
```

- `lawUrlFor(name)`은 활성 시험의 매핑만 조회 (`getActiveExamId()` — pdf-registry의 `getRefTables()`와 동일 패턴)
- 시험별 필요 법령만 담으므로 `references.json`의 `referenceLaw`·`refDirs`에 등장하는 문서의 `lawId` 집합에서 부분집합을 만든다
- `check_law_urls.js`의 전수 한글주소 검증은 생성된 매핑을 그대로 소비 — 검증 체인 변경 없음

### 4.3 감시 파이프라인 시험 파라미터화

| 파일 | 변경 |
|------|------|
| `ref-pipeline/_exam_root.py` | 신규 공유 헬퍼 — 시험 해석 순서(CLI `--exam` > `EXAM_CONTENT_ROOT` env > exams.json default)를 한곳에 (LEARNING_PREMIUM_PLAN 선결 과제 이관) |
| `ref-pipeline/check_mfds_notice.py` | `STATUS_FILE`/`REFS_FILE`을 `_exam_root.py` 해석 결과로 대체 + `--exam` 인자. 감시 대상은 기존처럼 `references.json.referenceLaw`에서 자동 유도, 기준 문서는 `references.json.noticeCore`에서 읽음 |
| `ref-pipeline/check_laws.py` | `LAWS` 상수 → 활성 시험의 `referenceLaw` 파일명에서 목록 자동 유도, 수동검증값은 `{시험 루트}/law_verified.json`으로 이관 |
| `src/notice-check.js` | `RULE_NAME`·`LAW_SEARCH_URL` 상수 → `notice_status.json`의 `docs[]`+`latest.ruleName`으로 일반화, repo URL은 `STATUS_REPO` 상수로 분리 (`statusUrl(examId)`는 기존 구현 유지). Formula OS 배너는 `features.formula` 게이트 유지 |
| GitHub Actions 워크플로 | `matrix: exam` 추가 또는 시험 목록 조회 후 순회 — 크론 1회 실행으로 모든 시험 감시 |

**레거시 필드 호환**: `notice_status.json`의 top-level `baseline/latest`는 cosmetic 원료 DB 대조용. 새 시험은 `docs[]`만 사용하므로 스키마 변경 없이 공존한다.

### 4.4 ref_md 공유 여부 (결정 보류)

공유 법령의 `ref_md` 변환본을 `content/exams/<id>/참조자료/ref_md/`에 시험별로 둘지, 공용 위치로 올릴지는 보류한다.

- **시험별 유지 (기본안)**: 인용 `(LNNN)` 라인 번호가 과목 귀속·ref_md 경로와 결합되어 있어 공유하면 `resolveRefPath`가 contentRoot 밖을 참조하게 됨. 변환본 중복 비용(~수백 KB/시험)보다 경로 단순성이 낫다
- **공용 승격 (최적화)**: 동일 법령을 3개+ 시험이 쓸 때 재검토. `REF_FILE_TO_PATH`가 이미 맵 기반이라 절대 경로 항목을 허용하는 것만으로 가능

---

## 5. 지식DB 설계

### 5.1 위치와 스키마 — `{contentRoot}/knowledge/`

> **Phase A 구현 변형 (2026-09-30)**: 스키마는 `manifest.knowledge` 블록으로 선언되고 `registry.knowledge`로 패스스루된다 — 별도 `schema.json` 대신 기존 manifest→registry 계약을 재사용했다. `dictionary.js`가 이 스키마(엔티티 단위·필드 매핑·배지·필터·CSV·헤더·액션 버튼)로 렌더링하며, 스키마 부재 시 화장품 원료와 동일한 내장 기본값으로 폴백한다.
>
> **Phase D 구현 변형 (2026-09-30)**: `knowledge/` 디렉터리의 JSON 데이터셋은 `tools/build/plugins/knowledge.plugin.js`가 처리한다 — `knowledge/<key>.json`(예: `content/exams/food/knowledge/additives.json`) → `{dataRoot}/<key>_data.<hash>.js` + `window.<KEY>_DATA` 전역, `registry[key]`에 `bundle`/`global`/`version`/`updatedAt`/`stats` 메타를 기록(기존 `ingredients` 메타와 동일 계약). 스키마는 `schema.json` 대신 `manifest.knowledge`에 필드·배지·필터·CSV·검색선언을 직접 둔다. `DataLoader.loadDictionary()`가 `registry.knowledge.registryKey`로 온디맨드 로드하며, `ingredients` 키는 기존 `loadIngredients()` 경로로 폴백한다. 아래 `schema.json` + `build_knowledge_bundles.js` 분리 구조는 다중 세트 UI(§5.2)가 필요해질 때 재검토 대상으로 유지한다.

성분사전의 일반화. 원본은 시험 콘텐츠와 함께 버전 관리되는 MD/JSON, 산출물은 클래식 번들:

```
{contentRoot}/knowledge/
  ├── schema.json        ← 엔티티 스키마 선언 (필드·카테고리·표시 규칙)
  ├── substances.json    ← 엔티티 컬렉션 (시험 도메인별 이름은 자유)
  └── ...
↓ build (tools/build/build_knowledge_bundles.js — 신규)
{dataRoot}/knowledge/<set>.<hash>.js   ← window.KNOWLEDGE_<examId>_<set>
```

```json
// schema.json (예시 — cosmetic의 성분사전에 대응)
{
  "schemaVersion": 1,
  "sets": [
    {
      "key": "ingredients",
      "title": "성분 사전",
      "idField": "id",
      "displayField": "name",
      "searchFields": ["name", "nameEn", "aliases"],
      "categories": ["보존제", "자외선차단제", "색소"],
      "fields": [
        { "key": "limit",  "label": "배합한도", "type": "text" },
        { "key": "lawRef", "label": "근거고시", "type": "lawRef" },
        { "key": "caution","label": "주의",    "type": "text" }
      ],
      "bundle": "ingredients_data"
    }
  ]
}
```

- `type: "lawRef"` 필드는 값으로 lawdb `id`를 받아 원문 링크를 자동 부착 — 법령DB↔지식DB 연결점
- `registry.js`에 `knowledge: { sets: [{key, bundle, global, title}] }`를 추가해 `DataLoader`가 온디맨드 로드 (기존 `ingredients` 메타와 같은 계약)
- 다른 시험 예시: 식품 계열 = 식품첨가물 DB, 화학 계열 = 유해물질·GHS DB, 관세 = 품목분류표 — 스키마만 바꾸고 코드 재사용

### 5.2 뷰 일반화

| 현재 | 개선 |
|------|------|
| `dictionary.js`가 `INGREDIENTS_DATA` 전역·성분 필드명에 고정 | `registry.knowledge.sets` 순회 — 탭/셀렉트가 `title`, 테이블 열이 `schema.fields`, 검색이 `searchFields`에서 렌더링 |
| `features.dictionary` 플래그만 존재 | 플래그는 유지 + `manifest`에 사용할 set key 목록을 선언 (`knowledgeSets: ["ingredients"]`) |
| `REFERENCE_INGREDIENTS`(원료 MD 목록) | `references.json` 기존 dir 메커니즘 재사용 — knowledge 원본을 참조자료로도 노출 가능 |

### 5.3 문항↔엔티티 역참조 (후속)

기존 인용 체인(문항 → 교재 라인 → ref_md 조문)의 확장:

- 문제은행·교재 본문의 키워드와 엔티티 `name`/`aliases` 매칭 → "이 성분이 출제된 문항" 역조회
- `keyword-index.js`의 셀→참조자료 매핑 빌드를 재사용해 `dataPath('knowledge/entity_refs.js')` 생성
- Phase D 과제로 분리 — MVP는 조회 전용 사전

---

## 6. 시험 결합 잔재 정리 (Phase A 작업 목록)

> **구현 상태 (2026-09-30)**: 전 항목 완료. A1·A2는 `pdf-registry.js`·`keyword-index.js`가 이미 `_EXAM_TABLES[examId]` + `getActiveExamId()` 해석 구조로 생성되고 있어 "확인"으로 종결(ARCHITECTURE §9의 stale 주석만 정정). A3~A7은 아래와 같이 구현됨 — 검증: 단위 742 + 사전 DOM 12 + notice 단위 17 + `check:lawurls` 10/10 실검증 통과.

| # | 대상 | 작업 | 검증 | 상태 |
|---|------|------|------|------|
| A1 | `pdf-registry.js` | 시험별 테이블 구조 이미 완비 — 확인으로 종결 | `check:reflayout` 시험 순회 | ✅ |
| A2 | `keyword-index.js` | 동일 — 시험별 매핑 생성 확인 | `check:content` | ✅ |
| A3 | `law-links.js` | `LAW_DOC_URLS` → `_EXAM_LAW_URLS` 생성물화 (§4.2), `build_pdf_registry.js`가 함께 출력 | `check:lawurls` 통과 | ✅ |
| A4 | `lawdb.json` 신설 | §4.1 스키마 + cosmetic 10종 이관 (`references.json.lawRefs`가 목록·순서 소유) | `build:data` 통합 | ✅ |
| A5 | `ref-pipeline/_exam_root.py` | 공유 헬퍼 추출 — `exam_root()`·`parse_ref_filename()`·`utf8_stdio()`; `check_mfds_notice.py`(--exam, `noticeCore`)·`check_laws.py`(referenceLaw 자동 유도 + `law_verified.json`)·`pdf2md.py`·`batch_convert.py`·audiobook 3종 연결 | 스크립트 직접 실행 | ✅ |
| A6 | `notice-check.js` | `docs[]` 기반 일반화 — 기준 문서는 `status.latest.ruleName`/`noticeCore`, `STATUS_REPO` 상수 분리, `ruleInfoUrl`이 law/admrul 양쪽 시리얼 지원 | `test:dom` notice 케이스 | ✅ |
| A7 | `dictionary.js` | 스키마 드리븐 렌더러로 리팩터 — `manifest.knowledge` → `registry.knowledge` 패스스루, 필터 버튼·배지·상세·CSV·헤더를 스키마에서 렌더(내장 기본값 = cosmetic과 동일) | DOM 테스트 12/12 | ✅ |

각 항목은 cosmetic 동작 회귀 0건이 완료 조건 — `npm.cmd run check:all` 통과가 게이트.

---

## 7. 신규 시험 온보딩 절차 (목표 상태)

```
1. content/lawdb.json              해당 시험 법령 엔트리 추가 (공유 법령은 재사용)
2. content/exams/<id>/              manifest.json + references.json + knowledge/
                                   + 교재/ + 문제은행/ + 참조자료/
3. content/exams.json               엔트리 + features 플래그
4. ref-pipeline                     PDF → ref_md (기존 절차 그대로)
5. npm.cmd run check:content -- --build    빌드 + 통합 검증
```

`tools/scaffold_exam.js` (신규, Phase B)가 1~3번의 골격을 생성한다: `exams.json` 엔트리 삽입 + `manifest.json` 템플릿(과목 1개 예시) + 디렉터리 트리 + `references.json` 빈 스키마. "문서화된 6단계"를 1커맨드로 만들어 온보딩 실수를 줄인다.

---

## 8. 검증 전략

| 계층 | 수단 |
|------|------|
| 빌드 정합성 | `check:content -- --build` — 인용·귀속·레이아웃·파서·자산 검증이 시험 순회형으로 이미 동작 |
| 법령DB | `check:lawurls` 전수 한글주소 검증 (생성 매핑 소비) + `check_mfds_notice.py --exam` 수동 실행 |
| 지식DB | `schema.json` 스키마 검증을 `build_knowledge_bundles.js`에 내장 (필수 필드·lawRef 참조 유효성) |
| 골든 회귀 | `ref-pipeline/tests/` 샘플 추가 — pdf2md 엔진 수정 시 안전망 (LEARNING_PREMIUM_PLAN 선결 과제 이관) |
| KPI | LEARNING_PREMIUM_PLAN 멀티시험 확장 KPI 표로 콘텐츠 제작시간 실측 — `src`/`tools` 수정 0줄 확인 |

---

## 9. 로드맵

| Phase | 내용 | 완료 조건 |
|-------|------|----------|
| A — 결합도 해소 | §6 표의 A1~A7 — ✅ 완료 (2026-09-30) | `check:all` 통과 + cosmetic 회귀 0 |
| B — 스캐폴더 | `tools/scaffold_exam.js` — ✅ 완료 (2026-09-30) | 더미 시험(dummytest)으로 scaffold→build→피커 표시→제거→잔재 0 라운드트립 통과 |
| C — 파일럿 | 식품기사(`food`) — 법령 암기형, 식약처 고시 체계 공유로 재사용성 최대 — ✅ 완료 (2026-09-30) | 전 체인 동작: 교재→문항→인용→법령 링크→고시 감시 (아래 "Phase C 파일럿 결과" 참조) |
| D — 지식DB 일반화 | `dictionary` 스키마 드리븐화 + 두 번째 엔티티 타입 적용 | ✅ 완료 (2026-09-30 — food `additives` 세트, `knowledge.plugin.js`, `loadDictionary()`, 스키마 DOM 테스트 7건) · 엔티티 역참조(§5.3)·다중 세트 UI(§5.2)는 후속 |

**의존 관계**: A→C는 순차 (B는 A 이후 언제든). D는 C와 독립 진행 가능 — 다만 지식DB가 있는 시험을 파일럿으로 고르면 D의 검증 경로가 확보된다.

### Phase C 파일럿 결과 (food, 2026-09-30)

- **스코프**: 식품기사 필기의 1과목(식품위생학) 축소본 — 교재 1챕터 + 문항 8제 + ref_md 발췌본 3종(식품위생법 제21065호 / 식품공전 제2026-55호 / 표시기준 제2026-37호). `manifest._pilot` 주석으로 부분 콘텐츠임을 명시.
- **검증된 체인**: lawdb 5종 추가 → `law-links.js`의 `_EXAM_LAW_URLS.food` 생성 · `check:lawurls` 실검증 15종 통과 · `pdf-registry`/`keyword-index` 시험별 테이블 생성 · 인용 동기화(8개 링크, 미발견 0) · `check_mfds_notice.py`가 `EXAM_ID=food`로 감시 대상 3종(law/admrul target 구분 + baseline 제호·시행일)을 references.json에서 자동 유도.
- **파일럿에서 발견·수정된 버그**: ① `build_pdf_registry.js`의 `docSubject()` 호출이 `contentRoot`를 전달하지 않아 비기본 시험의 `REF_MD_SUBJECTS`가 기본 시험 규칙으로 계산되던 문제 수정 ② 스캐폴드 `references.json`의 결손 키는 빈 값으로 관대 처리, `lawRefs: []`는 "법령 없음"으로 구분.
- **Phase D 연결 (2026-09-30)**: `knowledge/additives.json`(식품첨가물 12종) + `manifest.knowledge` 스키마 + `features.dictionary` 활성화 → `data/exams/food/additives_data.<hash>.js` + `ADDITIVES_DATA` 전역. `tests/dom/dictionary-schema.dom.test.js`가 비-cosmetic 스키마(배지·필터·상세·CSV·빈 상태·토스트 문구)를 검증한다. 첨가물공전(lawdb `food-additives-std`) → `lawRef` 필드로 법령DB↔지식DB 연결점도 검증됨.
- **남은 파일럿 갭**: 물리 PDF 미확보(ref_md 수기 발췌로 대체 — PDF 확보 시 ref-pipeline 변환 절차로 전환), `notice_status.json`은 첫 `--update` 실행 시 생성(현재 시드 없음 — 앱은 미존재 파일을 정상 처리), 문제은행 챕터 매핑 4건 미해석(단일 챕터 구조상 무해).

---

## 10. 리스크와 미결 사항

1. **콘텐츠가 병목** (재확인): 코드 일반화보다 시험당 교재·문항·인용 제작 공수가 훨씬 크다. 파일럿 선정 시 콘텐츠 소스(공개 교재·기출) 확보 용이성이 결정적
2. **인용 라인 체인의 시험 이식성**: `(LNNN)` 인용은 ref_md 시각적 줄에 의존 — 시험별 ref_md를 유지하는 한 안전하지만, 공용 ref_md로 전환하면 라인 드리프트 재검증 필요 (§4.4)
3. **`notice-check.js`의 repo URL**: `statusUrl`이 `raw.githubusercontent.com/<owner>/<repo>`를 박아둠 — 플랫폼을 포크 배포하는 경우 상수 분리 필요 (A6에 포함)
4. **고시 감시 크론의 API 할당**: 시험이 늘면 law.go.kr DRF 호출 수가 선형 증가 — 배치 딜레이·실패 재시도 정책을 `check_mfds_notice.py`에 유지
5. **Formula OS 계열**: 타 시험의 "실무 모듈"은 도메인이 완전히 다르므로 본 설계 범위 밖. `features` 플래그 게이팅으로 충분하며, 필요 시 시험별 모듈을 `src/views/`에 추가하는 별도 설계로 다룬다
6. **미결**: ① lawdb의 `children` 매칭을 정규식 목록으로 할지 접두 규칙으로 할지 ② `references.json`에 `lawId` 필드를 추가할지, 파일명 매칭(matchKeys)만으로 유도할지 — 구현 착수 시 결정

---

## 📎 관련 문서

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — §9 멀티시험 플랫폼 구조, §20 데이터 파이프라인
- [`LEARNING_PREMIUM_PLAN.md`](LEARNING_PREMIUM_PLAN.md) — 멀티시험 확장 KPI, ref-pipeline 선결 과제 (본 문서 §6 A5·§8로 이관)
- [`../../report_archive/PRO_MULTI_EXAM_EVALUATION.md`](../../report_archive/PRO_MULTI_EXAM_EVALUATION.md) — 시험 후보 유형 평가, 킬러 피처 분석
- [`../SPEC.md`](../SPEC.md) — §7.4 ROAD-M1 (타 시험 등록)
