# Content 변경 작업 절차 가이드

> content/ 폴더의 교재, 문제은행, 참조자료, 오디오북, 원료 데이터가 변경될 때 따라야 할 표준 작업 절차.

## 개요

이 프로젝트는 `content/` 폴더의 Markdown/JSON 파일이 **단일 소스 오브 트루스(SSOT)** 역할을 합니다. 소스 코드(`src/`)를 직접 수정하지 않고, content 파일과 매니페스트만 편집하면 빌드 파이프라인이 나머지를 자동 처리합니다.

> **멀티시험 구조 (2026-09-20~)**: 이 문서의 `content/`·`data/` 경로는 각 시험의 `contentRoot`/`dataRoot`를 의미합니다. 기본 시험(cosmetic)은 `content/`·`data/` 루트이며, 추가 시험은 `content/exams/<id>/`·`data/exams/<id>/` 루트를 갖습니다. `build:data`는 `content/exams.json`의 모든 시험을 순회 빌드하므로 절차는 동일합니다. 새 시험 추가는 `AGENTS.md`의 "멀티시험 구조" 섹션을 참조하세요.

```mermaid
flowchart LR
    subgraph SSOT["content/ (단일 소스 오브 트루스)"]
        M["manifest.json<br/>과목·시험·UI·추천링크"]
        R["references.json<br/>참조자료 매핑"]
        T["교재/*.md<br/>표준형+이야기형"]
        E["문제은행/*.md"]
        A["audiobook/mp3/"]
        I["ingredients/"]
    end

    subgraph BUILD["빌드 파이프라인 (npm run build:data)"]
        B1["build:pdf-registry"]
        B2["build:keyword-index"]
        B3["build:index"]
        B4["build:study-md"]
        B5["build:exam-bundles"]
        B6["build:audio-manifest"]
        B7["check:parser"]
    end

    subgraph OUT["자동 생성 산출물"]
        O1["src/pdf-registry.js"]
        O2["src/keyword-index.js"]
        O3["data/registry.js"]
        O4["data/subjects/*.js"]
        O5["data/exams/*.js"]
        O6["data/study_md/*.js"]
        O7["data/exams_md/*.js"]
        O8["data/audio_manifest.js"]
        O9["sw.js (DATA_ASSETS+MD_ASSETS)"]
    end

    subgraph RUNTIME["런타임 (src/)"]
        App["app.js + views/"]
        DL["DataLoader"]
        RR["pdf-registry.js"]
        KI["keyword-index.js"]
    end

    subgraph DEPLOY["배포"]
        V["Vercel Production"]
    end

    R --> B1 --> O1
    T --> B2
    R --> B2 --> O2
    M --> B3
    T --> B3 --> O3
    E --> B3 --> O4
    I --> B3 --> O5
    M --> B3 --> O9
    T --> B4 --> O6
    E --> B5 --> O7
    A --> B6 --> O8
    B3 --> B7

    O1 --> RR
    O2 --> KI
    O3 --> DL
    O4 --> DL
    O5 --> DL
    O6 --> DL
    O7 --> DL
    O8 --> App
    O9 --> V
    RR --> App
    KI --> App
    DL --> App
    App --> V

    style SSOT fill:#e8f5e9
    style BUILD fill:#fff3e0
    style OUT fill:#e3f2fd
    style RUNTIME fill:#f3e5f5
    style DEPLOY fill:#fce4ec
```

---

## 1. 변경 유형별 수정 파일

| 변경 유형 | 수정할 파일 | 비고 |
|----------|------------|------|
| **교재 내용 수정** | `content/교재/{과목}/*.md` | 표준형/이야기형 모두 수정 |
| **문제은행 수정** | `content/문제은행/과목N_단일정답형.md` | 문제 추가/삭제/수정 |
| **과목 추가/삭제** | `content/manifest.json` | `subjects` 배열 수정 |
| **시험 추가/삭제** | `content/manifest.json` | `exams` 배열 수정 |
| **참조자료 추가/삭제** | `content/references.json` | 참조자료 매핑 수정 |
| **오디오북 추가** | `content/audiobook/mp3/{과목}/` | MP3 파일 배치 |
| **통합 모의고사 문제 수 변경** | `content/manifest.json` | `integratedExam.questionsPerSubject` 수정 |
| **UI 텍스트 변경** | `content/manifest.json` | `uiText` 객체 수정 |
| **추천 링크 변경** | `content/manifest.json` | `resources` 객체 수정 |
| **원료 데이터 변경** | `content/ingredients/` | 원료 MD/JSON 수정 |

---

## 2. 표준 빌드 절차

### 2.1 전체 빌드 (권장)

content 변경 후 아래 한 줄로 전체 파이프라인 실행:

```powershell
npm.cmd run build:data
```

이 명령은 다음 파이프라인을 순차 실행합니다:

```mermaid
flowchart TD
    A["npm run build:data"] --> B["build:pdf-registry"]
    B --> B1["content/references.json<br/>→ src/pdf-registry.js"]
    B1 --> C["build:keyword-index"]
    C --> C1["교재 MD 스캔 + references.json<br/>→ src/keyword-index.js"]
    C1 --> D["build:index (tools/build/index.js)"]
    D --> D1["manifest.json<br/>→ data/registry.js"]
    D --> D2["content/교재/*.md<br/>→ data/subjects/*.js"]
    D --> D3["content/문제은행/*.md<br/>→ data/exams/*.js"]
    D --> D4["content/ingredients/<br/>→ data/ingredients_data.js"]
    D --> D5["sw.js DATA_ASSETS<br/>+ MD_ASSETS 자동 갱신"]
    D5 --> E["build:study-md"]
    E --> E1["content/교재/*.md<br/>→ data/study_md/*.js"]
    E1 --> F["build:exam-bundles"]
    F --> F1["content/문제은행/*.md<br/>→ data/exams_md/*.js"]
    F1 --> G["build:audio-manifest"]
    G --> G1["content/audiobook/mp3/<br/>→ data/audio_manifest.js"]
    G1 --> H["check:parser"]
    H --> H1["빌드 파서 ↔ 런타임 파서<br/>등가성 검증"]
    H1 --> I["✅ 빌드 완료"]

    style A fill:#4a90d9,color:#fff
    style I fill:#27ae60,color:#fff
```

### 2.2 부분 빌드 (특정 과목만)

```powershell
npm.cmd run build:data:law           # 1과목만
npm.cmd run build:data:manufacturing # 2과목만
npm.cmd run build:data:safety        # 3과목만
npm.cmd run build:data:understanding # 4과목만
```

### 2.3 개별 스크립트 실행

```powershell
npm.cmd run build:pdf-registry       # 참조자료 레지스트리만
npm.cmd run build:keyword-index      # 키워드 인덱스만
npm.cmd run build:study-md           # 폴백 번들만
npm.cmd run build:exam-bundles       # 시험 폴백 번들만
npm.cmd run build:audio-manifest     # 오디오 매니페스트만
```

---

## 3. 변경 유형별 상세 절차

### 3.1 교재 내용 수정

1. `content/교재/{과목}/{파일명}.md` 편집 (표준형, 이야기형 모두)
2. `npm.cmd run build:data` 실행
3. **인용 라인 동기화** (교재 라인 변경 시):
   ```powershell
   node tools/sync_citation_lines.js --check   # 변경사항 확인만
   node tools/sync_citation_lines.js            # 실제 동기화 실행
   ```
   - 문제은행의 인용 링크(`[label: L####](<path#L####>)`) 라인 번호를 교재 변경에 맞춰 자동 갱신
   - 인용문(`>` 블록) 지문으로 인용 라인 ±3 검증 → 불일치 시 타겟 파일에서 재탐색(정확 포함 → 쉥글 → 키프레이즈)
   - 범위초과 링크도 인용문 지문으로 재탐색 (skip하지 않음)
   - 키프레이즈만 일치하는 낮은 신뢰도 매칭은 자동 갱신하지 않음
   - 미발견 항목은 수동 확인 필요 (exit code 1)
4. `npm.cmd test` 통과 확인
5. 커밋 + 배포

### 3.1-1 과목 교재 전체 교체 체크리스트

과목의 교재를 통째로 다른 문서로 교체할 때는 단순 수정보다 의존성이 넓습니다.
아래 7개 계층을 순서대로 확인하세요.

```mermaid
flowchart TD
    S["새 교재 MD 준비"] --> S1["① 매니페스트/등록<br/>manifest.json + references.json"]
    S1 --> S2["② 파서 계약 확인<br/>표 2열 · 🔖마커 · ## N. 챕터"]
    S2 --> S3["③ 과목별 자산<br/>glossary · number-drills · audiobook"]
    S3 --> S4["④ 통합 빌드+검증<br/>npm.cmd run check:content -- --build"]

    S4 --> Q1{"전 단계 통과?"}
    Q1 -- No --> F1["실패 단계 수정 후 재실행"]
    F1 --> S4

    Q1 -- Yes --> S5["⑤ 인용 라인 동기화<br/>sync_citation_lines --check → 미발견 0건"]
    S5 --> S6["⑥ ref_md 귀속 확인<br/>check_ref_subjects 불일치 기준선 이내"]
    S6 --> S7["⑦ 진행 데이터 이관<br/>id_migration.js 생성 → 사용자 안내"]
    S7 --> D["커밋 + sw bump + 배포"]

    style S fill:#e8f5e9
    style S4 fill:#fff3e0
    style Q1 fill:#fff3e0
    style F1 fill:#fce4ec
    style D fill:#27ae60,color:#fff
```

**1. 매니페스트/등록**
- [ ] `content/manifest.json` — `subjects[].dir`·`file`/`storyFile` 경로가 새 교재를 가리키는지, `exams[].subject`·`integratedExam.questionsPerSubject` 키 정합
- [ ] `content/references.json` — `subjectDirMap`·`refDirs`·`referenceFiles` 과목 귀속

**2. 콘텐츠 파서 계약 (새 교재가 지켜야 할 형식)**
- [ ] 카드 추출용 표 `| 용어 | 설명 |` 2열 구조, `- **용어**: 설명` 리스트
- [ ] 퀴즈 마커 `🔖기출`/`📌중요`/`★필수` + `**볼드**` 빈칸 대상
- [ ] 챕터 헤딩 `## 📚 Chapter NN.` 또는 `## N.` (question_chapters 경계)
- [ ] 참조 링크 `../참조자료/ref_md/과목N/...` 형식 (상세: `docs/dev/TEXTBOOK_AUTHORING_GUIDE.md`)

**3. 과목별 자산 (번호·키 기준 하드코딩 지점)**
- [ ] `content/교재/glossary/subject{N}.json` — 큐레이션 용어집 (과목 order 번호 기준)
- [ ] `content/number-drills/{과목키}.json`
- [ ] `content/audiobook/mp3/{과목키}/` — 교재 교체 시 TTS 재생성(`generate_all_mp3.py`)
- [ ] `tools/check_ref_subjects.js`의 `SUBJECT_DIRS` 매핑 (과목키↔번호 변경 시)

**4. 빌드 재생성**

```powershell
npm.cmd run check:content -- --build   # build:data + 전 계층 검증을 한 번에 실행
```

`--build` 없이 실행하면 검증만 수행합니다. 단계별 실패는 리포트에 모아 출력됩니다.

**5. 인용 라인번호 (가장 깨지기 쉬운 지점)**
- [ ] 문제은행의 `(<교재파일.md#L1234>)` 인용은 라인 번호에 하드 의존 — 교재 교체로 라인이 밀리면 인용 전수 재검증
- [ ] `node tools/sync_citation_lines.js --check` 결과 미발견 0건 확인
- [ ] `tools/citation_fingerprints.json` 지문 재생성 필요 시 `--fingerprint`

**6. 참조자료(ref_md) 귀속**
- [ ] `node tools/check_ref_subjects.js` — 불일치 건수가 교체 전 기준선보다 늘었는지 확인
- [ ] `node tools/check_reflayout.js` — 폴더/레지스트리 정합성
- [ ] 문서→과목 귀속 규칙은 `content/references.json`의 `docSubjectRules`가 진실 (폴더 이동보다 규칙이 우선인 평탄 잔존 문서용)

**7. 사용자 진행 데이터 (localStorage)**
- [ ] 카드/퀴즈 ID는 `stableId(subjectKey, chapterKey, type, term)` — 교재가 바뀌면 term 해시가 달라집니다
- [ ] `npm.cmd run build:id-migration`이 이전 스냅샷(`data/card_terms_snapshot.json`)과 비교해 term이 유일하게 일치하는 구ID→신ID 이관 맵(`data/id_migration.js`)을 생성합니다 — 같은 용어가 남아 있으면 진도가 자동 이관됩니다
- [ ] 스냅샷 파일은 커밋 대상입니다 — 배포된 직전 빌드의 ID 집합을 보존해야 이관이 동작합니다
- [ ] term이 바뀌거나 삭제된 카드의 진도는 이관 불가 → `cleanOrphansForSubject`가 정리(삭제). 과목 통째 교체 시 잔량을 사용자에게 안내하세요

### 3.2 과목 추가

1. `content/교재/{새과목키}/` 디렉토리 생성, MD 파일 배치
2. `content/manifest.json`의 `subjects` 배열에 항목 추가:
   ```json
   {
     "key": "newsubject",
     "order": 5,
     "name": "새 과목명",
     "shortName": "약칭",
     "dir": "교재/newsubject",
     "chapters": [
       { "key": "full", "title": "...", "file": "5과목_..._표준형.md", "storyFile": "5과목_..._이야기형.md" }
     ]
   }
   ```
3. `content/references.json`의 `subjectDirMap`에 매핑 추가:
   ```json
   "newsubject": "과목5"
   ```
4. `content/references.json`의 `referenceFiles`에 과목별 참조자료 추가
5. `content/references.json`의 `refDirs`에 `과목5` 배열 추가
6. `content/문제은행/과목5_단일정답형.md` 생성 후 `manifest.json`의 `exams`에 추가
7. `npm.cmd run build:data` 실행
8. 검증 + 커밋 + 배포

### 3.3 참조자료 추가

1. `content/참조자료/ref_md/과목N/{파일명}/{파일명}.md` 배치 (PDF→MD 변환본 — 과목 폴더가 문항 생성 귀속의 진실)
2. `content/references.json` 수정:
   - `refDirs.{해당폴더}` 배열에 파일명 추가
   - `referenceFiles.{과목}` 또는 `referenceCommon`에 항목 추가
   - 출처 매칭이 필요하면 `sourceRefMap`에 정규식 매핑 추가
   - 본문 자동 링크가 필요하면 `keywordRefMap`에 패턴 추가
3. `npm.cmd run build:data` 실행
4. 검증 + 커밋 + 배포

### 3.3-1 PDF → MD 재변환 절차 (ref_md 갱신)

참조자료 PDF를 추가·교체하거나 변환 규칙을 수정했을 때의 표준 절차:

```powershell
# 1) 스테이징 변환 (ref_md_v2에 출력, ref_md는 건드리지 않음)
python tools/convert_ref_pdfs_v2.py            # 전체
python tools/convert_ref_pdfs_v2.py 화장품법     # 파일명 부분 일치만

# 2) 골든 비교 — 현행 ref_md 대비 내용 누락 감사 (누락 있으면 종료코드 1)
python tools/convert_ref_pdfs_v2.py --verify
```

- `--verify`는 현행 문서의 비잡행 라인(워터마크·쪽번호 제외)이 신규 문서에
  존재하는지 **멀티셋(등장 횟수) 기준**으로 검사한다. 줄 병합·분할은
  정규화 부분문자열 매칭으로 흡수한다.
- 누락 0이면 `ref_md_v2/{doc}/{doc}.md`와 `images/`를 `ref_md/과목N/`의
  동명 디렉터리에 복사해 승격한다(`index.html` 보존). 문서 과목은
  `tools/build/ref-statements.js`의 `DOC_SUBJECT_RULES`로 확인.
- 승격 후 라인 번호가 밀리므로 반드시 `npm.cmd run sync:citations` →
  `node tools/sync_citation_lines.js --check`(미발견 0 확인) →
  `npm.cmd run build:data` → `node tools/build_combo_drills.js` 순서로
  후속 재생성을 실행한다.

### 3.4 오디오북 추가

1. `content/audiobook/mp3/{과목키}/` 디렉토리에 MP3 파일 배치
2. `npm.cmd run build:audio-manifest` 실행 (또는 `npm.cmd run build:data`)
3. 검증 + 커밋 + 배포

> **주의**: MP3 파일은 Vercel 배포 시 용량 초과(302MB)로 인해 함께 배포할 수 없음.
> `data/audio_manifest.js`의 `AUDIO_BASE_URL`을 외부 CDN으로 설정 필요.

### 3.5 통합 모의고사 문제 수 변경

1. `content/manifest.json`의 `integratedExam.questionsPerSubject` 수정:
   ```json
   "integratedExam": {
     "questionsPerSubject": {
       "law": 10,
       "manufacturing": 25,
       "safety": 25,
       "understanding": 40
     }
   }
   ```
2. `npm.cmd run build:data` 실행
3. 검증 + 커밋 + 배포

---

## 4. 검증 체크리스트

> **통합 명령**: `npm.cmd run check:content`은 아래 전 항목(+귀속·레이아웃·드릴·카드 감사)을 한 번에 실행합니다.

빌드 후 반드시 확인:

```powershell
# 1. 유닛 테스트 (248개)
npm.cmd test

# 2. import/export 검증
npm.cmd run check:imports

# 3. 셸 자산 존재 확인
npm.cmd run verify:assets

# 4. 파서 등가성 (build:data에 포함되지만 단독 실행 시)
npm.cmd run check:parser

# 5. 임시 파일 제거 확인
git status
```

```mermaid
flowchart TD
    Start["빌드 완료"] --> T1{"npm test<br/>248개 통과?"}
    T1 -- No --> F1["❌ 테스트 실패<br/>원인 수정"]
    F1 --> Start
    T1 -- Yes --> T2{"check:imports<br/>0 오류?"}
    T2 -- No --> F2["❌ import/export 오류<br/>수정"]
    F2 --> Start
    T2 -- Yes --> T3{"verify:assets<br/>전체 존재?"}
    T3 -- No --> F3["❌ 자산 누락<br/>sw.js 확인"]
    F3 --> Start
    T3 -- Yes --> T4{"git status<br/>임시 파일 없음?"}
    T4 -- No --> F4["임시 파일 제거"]
    F4 --> T4
    T4 -- Yes --> OK["✅ 검증 통과<br/>배포 가능"]

    style OK fill:#27ae60,color:#fff
    style F1 fill:#e74c3c,color:#fff
    style F2 fill:#e74c3c,color:#fff
    style F3 fill:#e74c3c,color:#fff
    style F4 fill:#f39c12,color:#fff
```

---

## 5. 배포 절차

### 5.1 Service Worker 버전 bump

애플리케이션 코드/콘텐츠 변경 시 `sw.js`의 `CACHE_VERSION`을 bump:

```powershell
npm.cmd run stamp:sw   # 커밋 해시로 자동 스탬프
```

또는 수동 편집:
```js
const CACHE_VERSION = 'v{번호}-{날짜}-{설명}';
```

### 5.2 Vercel 배포

```powershell
git add -A
git commit -m "content: 변경 내용 요약"
git push origin main
npx.cmd vercel --prod --yes --scope skygold
```

### 5.3 배포 확인

- https://personalized-skincare-study.vercel.app 접속
- HTTP 200 확인
- 변경된 콘텐츠 정상 표시 확인

```mermaid
flowchart LR
    A["content/ 편집"] --> B["npm run build:data"]
    B --> C["검증 체크리스트"]
    C --> D["sw.js 버전 bump"]
    D --> E["git commit + push"]
    E --> F["vercel --prod"]
    F --> G["배포 확인<br/>HTTP 200"]
    G --> H["✅ 완료"]

    style A fill:#e8f5e9
    style B fill:#fff3e0
    style C fill:#fff3e0
    style D fill:#fff3e0
    style F fill:#fce4ec
    style H fill:#27ae60,color:#fff
```

---

## 6. 주의사항

### 6.1 직접 수정 금지 파일 (빌드 자동 생성)

아래 파일들은 빌드 시 자동 생성되므로 **직접 수정 금지**:

| 파일 | 생성 스크립트 | 소스 |
|------|-------------|------|
| `src/pdf-registry.js` | `tools/build/build-pdf-registry.js` | `content/references.json` |
| `src/keyword-index.js` | `tools/build/build_keyword_index.js` | `content/교재/*.md` + `content/references.json` |
| `data/registry.js` | `tools/build/index.js` | `content/manifest.json` |
| `data/subjects/*.js` | `tools/build/index.js` | `content/교재/*.md` |
| `data/exams/*.js` | `tools/build/index.js` | `content/문제은행/*.md` |
| `data/study_md/*.js` | `tools/build_study_md_bundle.js` | `content/교재/*.md` |
| `data/exams_md/*.js` | `tools/build_exam_bundles.js` | `content/문제은행/*.md` (manifest `exams` 등록분만) |
| `data/audio_manifest.js` | `tools/build/build-audio-manifest.js` | `content/audiobook/mp3/` |
| `data/drills/ox_subject*.js` | `tools/build_ox_drills.js` | `data/exams/*.js` (객관식) |
| `data/drills/combo_subject*.js` | `tools/build_combo_drills.js` | `data/exams/*.js` (객관식+단답형) |
| `content/문제은행/과목N_복수정답형.md` | `tools/build_combo_drills.js` | `data/exams/*.js` (검토용 산출물) |
| `sw.js` (DATA_ASSETS, MD_ASSETS) | `tools/build/index.js` | `content/manifest.json` |

> ※ `data/drills/`는 `data/exams/`의 2차 파생물입니다 — 문제은행 변경 시 `build:data` 후 `npm run build:drills`로 재생성해야 최신 문항이 반영됩니다.

### 6.2 PowerShell 환경

- `npm` → `npm.cmd`, `npx` → `npx.cmd` 사용
- `&&` 연산자 사용 불가 → `;` 사용

### 6.3 Vercel 용량 제한

- MP3 파일(302MB)은 Vercel 배포 불가
- `data/audio_manifest.js`의 `AUDIO_BASE_URL`을 외부 CDN으로 설정
- GitHub Releases, Cloudflare R2, AWS S3 등 활용

---

## 7. 빠른 참조: 변경 시 수정 파일 매트릭스

```
교재 내용 수정        → content/교재/*.md
교재 전체 교체        → §3.1-1 체크리스트 (7계층) + npm.cmd run check:content -- --build
문제은행 수정         → content/문제은행/*.md (+ npm run build:drills 로 드릴 번들 재생성)
복수정답형 파일럿 추가     → data/drills/combo_pilot.js 직접 편집 + npm run check:combo 검증
과목 추가/삭제        → content/manifest.json + content/references.json + content/교재/ + content/문제은행/
시험 추가/삭제         → content/manifest.json + content/문제은행/
참조자료 추가/삭제     → content/references.json + content/참조자료/ref_md/과목N/ (+ 해당 과목 폴더의 PDF)
오디오북 추가         → content/audiobook/mp3/
통합 모의고사 설정     → content/manifest.json (integratedExam)
UI 텍스트             → content/manifest.json (uiText)
추천 링크             → content/manifest.json (resources)
원료 데이터           → content/ingredients/

공통: npm.cmd run build:data → 검증 → 커밋 → 배포
```
