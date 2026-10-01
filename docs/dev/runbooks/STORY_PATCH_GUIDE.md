# 이야기형 교재 — 서사 패치 작성 가이드

> **문서 ID**: DOC-DEV-41
> **대상**: 이야기형 교재(`*_이야기형.md`)의 서사를 작성·수정하는 사람
> **핵심 규칙**: `*_이야기형.md`는 `npm run build:story` 생성물 — **절대 직접 편집 금지**

## 1. 파일 구조와 역할

```
교재/<과목dir>/
  <과목>_표준형.md          ← 본문 원본 (canonical)
  story/<과목>_서사.md      ← 서사·삽입 지시 원본 (canonical, 이 파일만 편집)
  <과목>_이야기형.md        ← 생성물 (build:story 산출, 커밋됨 — 직접 편집 금지)
```

- 생성물의 역할·커밋 이유: Vercel이 저장소를 그대로 정적 서빙하므로 빌드 산출물도 커밋되어야 런타임에 존재한다.
- 생성물 첫 줄에는 `<!-- ⚠️ 자동 생성 파일 … -->` 배너가 붙는다.
- `check:datafresh`가 생성물의 신선도를 감시한다 — 원본과 어긋나면 실패.

## 2. 지시어 문법

지시어는 HTML 주석 한 줄 + 내용 블록 + `<!-- /@ -->` 종결자로 구성한다.

### @insert — 내용 삽입

```md
<!-- @insert slot="sNN" story -->

📖 ┈┈┈┈ **이야기** ┈┈┈┈

(서사 본문)

┈┈┈┈ **본문** ┈┈┈┈ 📘

<!-- /@ -->
```

삽입 위치(택 1):

| 지정 | 동작 |
|---|---|
| `slot="id"` | 표준형의 `<!-- story:slot:id -->` 마커 **바로 뒤**에 삽입 — **권장**, 문구 편집에 견고 |
| `before="정확한 한 줄"` | 해당 줄 앞에 삽입 — 줄 내용이 바뀌면 실패 |
| `after="정확한 한 줄"` | 해당 줄 뒤에 삽입 |
| `at="start"` / `at="end"` | 문서 맨 앞/맨 뒤 — 프롤로그·에필로그용 |

- `story` 플래그: 블록을 `<!-- story:start/end -->` 마커로 감싼다(리더에서 서사 강조 렌더링). 서사가 아닌 추가 섹션(등장인물·여정도 등)은 생략.
- 중복 앵커: 같은 줄이 표준형에 여러 번 있으면 `n="k"`로 k번째를 지정 (`before="..." n="2"`).
- 슬롯 ID는 표준형 내 유일해야 하며 `[\w-]+` 문자만 허용.

### @suffix — 줄 끝 문자열 추가 (제목 부제)

```md
<!-- @suffix line="## 📚 Chapter 01. 피부 구조" -->
 — 수진의 첫 날
<!-- /@ -->
```

앵커 줄 끝에 내용 첫 줄을 붙인다. 챕터 부제·서사 분위기 제목에 사용.

### @replace — 한 줄 교체

```md
<!-- @replace line="## 🧭 학습 아이콘" -->
## 🧭 이야기 아이콘
<!-- /@ -->
```

헤딩 등 한 줄 전체를 교체한다. `block` 플래그는 연속 `>` 콜아웃 블록 전체를 교체(기억 태그 등).

## 3. 신규 과목 시작 — --scaffold

```powershell
npm.cmd run build:story -- --scaffold <subjectKey>
```

- 표준형 헤딩 목록을 앵커 후보 주석으로 포함한 골격 `story/<과목>_서사.md` 생성.
- 이미 패치가 있으면 건너뛰고 덮어쓰지 않는다.
- 생성 후 `manifest.json`의 `chapters[]`에 `"storyFile": "<과목>_이야기형.md"`를 선언해야 빌드가 생성한다.
- `check:manifest`가 선언↔패치 불일치(한쪽만 존재)를 경고로 잡는다.

## 4. 슬롯 마커 추가 (표준형 측)

서사 삽입점이 새로 필요하면 표준형 해당 위치에 마커를 심는다:

```md
<!-- story:slot:ch03-장면2 -->
```

- HTML 주석이라 렌더링·파서에 무해.
- 마커를 심으면 표준형의 라인 번호가 밀리므로 **`npm run sync:citations` + `build:data`가 필수** (문제은행 `#L####` 인용 갱신).
- 마커 삭제 시 해당 슬롯을 쓰는 패치 op가 빌드 에러로 표면된다 — 조용한 스킵 없음.

## 5. 빌드·검증 절차

```powershell
npm.cmd run build:story            # 4과목 이야기형 재생성
npm.cmd run build:story -- --check # 생성물↔패치 일치만 확인 (드리프트·앵커 실패 시 exit 1)
npm.cmd run sync:citations         # 표준형/이야기형 라인 변경 후 인용 동기화
npm.cmd run build:data             # story → study_md 등 하위 번호까지 전체 재생성
npm.cmd run check:manifest         # 선언↔패치 정합성
npm.cmd run check:datafresh        # 생성물 신선도 게이트
```

앵커 실패(`슬롯 없음`/`앵커 없음`)는 에러로 출력되고 exit 1 — 표준형을 수정해 마커/앵커가 깨진 경우 패치의 슬롯·앵커를 새 위치로 고친다.

## 6. 오디오북 참고

- 현재 `audiobook/mp3/` 사전 녹음 파일은 없음 — 브라우저 TTS가 표시 텍스트를 실시간 읽으므로 불일치 위험 없음.
- 향후 사전 녹음 mp3를 추가하면 이야기형 본문 변경 시 재녹음이 필요하다. `check:manifest`가 mp3 존재 시 경고한다.

## 7. 유틸리티

| 도구 | 용도 |
|---|---|
| `tools/build/story_merge.js` | diff·패치 파서/적용 엔진 (라이브러리) |
| `tools/build/build_story_textbooks.js` | CLI — 생성·`--check`·`--scaffold` |
| `tools/build/migrate_story_slots.js` | 텍스트 앵커→슬롯 1회 마이그레이션 (완료됨, 기록용) |
| `tools/build/extract_story_patches.js` | 기존 이야기형→패치 추출 (1회 마이그레이션 완료, 기록용) |
