# AGENTS.md — AI 에이전트 프로젝트 가이드라인

> 이 파일은 Devin, Claude Code, Cursor 등 AI 코딩 에이전트가 프로젝트에 진입했을 때 참조하는 가이드라인입니다.

## 프로젝트 개요

**Passmula** — 맞춤형화장품 조제관리사 자격시험 대비 + Formula OS 실무 배합 통합 플랫폼.

- 순수 HTML/CSS/JavaScript (Vanilla ES Modules, 프레임워크 없음)
- PWA (Service Worker 오프라인 캐시, 설치 가능)
- Vercel 정적 배포 + **선택적 Supabase** (로그인 사용자 클라우드 동기화 — 미설정 시 앱 정상 동작)
- 사용자 진행 상황은 localStorage가 1차 저장소 (계정 없이 전 기능 사용 가능)

## 핵심 명령어

> **주의**: Windows PowerShell 환경. `npm`/`npx` 스크립트가 실행 정책으로 차단되므로 `npm.cmd`/`npx.cmd` 사용.

```powershell
# 테스트
npm.cmd test                          # 유닛 테스트 (node --test)
npm.cmd run test:dom                  # DOM 테스트 (Vitest + jsdom)
npm.cmd run test:all                   # 전체 테스트 (unit + parser + dom)

# 빌드
npm.cmd run build:data                 # content/exams/<id>/*.md → data/exams/<id>/ 번들 생성 (모든 시험 순회)
node tools/build/build_doc_bundles.js        # docs/user/{user_manual,formula_manual}.md, content/exams/cosmetic/docs/학습안내서.md → data/docs_md/ + {dataRoot}/docs_md/ 번들 (앱 내 문서 갱신 시 필수)
npm.cmd run check:parser               # 빌드 파서 ↔ 런타임 파서 등가성 검증
npm.cmd run check:imports              # src/ 내 ES 모듈 import/export 교차 검증
npm.cmd run stamp:sw                   # sw.js CACHE_VERSION을 커밋 해시로 스탬프
npm.cmd run notes:draft                # 릴리스 노트 pending 초안 생성 (커밋 subject 기반 → data/release-notes.json 수동 편집 후 배포)
npm.cmd run verify:assets              # SHELL_ASSETS/DATA_ASSETS 파일 존재 검증

# 콘텐츠 동기화 (build:data에 자동 통합됨)
npm.cmd run sync:citations              # 문제은행 인용 라인번호 동기화
node tools/sync_citation_lines.js --check  # 변경사항 확인만 (수정 안 함)

# 로컬 서버
npm.cmd run serve                      # http://localhost:3000

# 배포
npm.cmd run deploy                     # 배포 가드(clean tree + origin/main 동기화 확인) → sw 스탬프 자동 커밋·푸시 → vercel --prod 실행
# ※ 사용자가 "배포"라고 요청하면 이 명령 하나로 전체 단계 수행
# ※ `vercel --prod` 직접 실행 금지 — 미푸시 커밋/미커밋 변경이 프로덕션에 올라감

# 감사
npm.cmd run audit:cards                 # 카드 품질 자동 감사 (짧은 설명, 중복, 참조 링크 유효성)
npm.cmd run audit:combo                 # 복수정답형 품질 감사 (정답 유일성·중복 진술집합·모순쌍·위치편향·경로별 통계)

# 콘텐츠 통합 검증 (교재 교체 등 대규모 콘텐츠 변경 후)
npm.cmd run check:content               # 인용·귀속·레이아웃·드릴·파서·임포트·자산·카드·문서·테스트 일괄 검증
npm.cmd run check:content -- --build    # build:data 선실행 후 검증 (교재 교체 시 권장)
npm.cmd run check:content -- --quick    # DOM 테스트 생략
npm.cmd run check:manifest              # manifest 선언 ↔ 파일/과목 자산 정합성만 단독 검증
npm.cmd run check:reflayout             # 참조자료 4계층 정합성 (PDF 폴더↔ref_md↔references.json↔규칙, 링크 해석)
npm.cmd run check:refsubjects           # ref_md 문서의 인용 득표↔과목 귀속 교차 검증
npm.cmd run check:reffresh              # 참조자료 PDF 해시 ↔ ref_md 신선도 (PDF 교체 감지)
npm.cmd run check:reflines              # 교재 (LNN)/📌출처 조문 ↔ ref_md 실제 내용 검증
npm.cmd run check:drillfresh            # 드릴 번들 ↔ 문제은행 번들 신선도 (stale 시 npm run build:drills)
npm.cmd run check:docs                  # README·AGENTS·docs/*.md 내 경로 참조 존재 검증 (파일 이동/삭제 후 스테일 참조 탐지)

# 참조자료 PDF → ref_md 변환 (Python 3 + pdfplumber, 이미지 추출 시 pymupdf 필요)
npm.cmd run convert:refs                # 참조자료 PDF 전체 → ref_md_v2/ 스테이징 변환 (파일명 필터 인자 가능)
npm.cmd run verify:refs                 # ref_md_v2 vs ref_md 골든 비교 (내용 누락 시 exit 1)
npm.cmd run check:reffresh -- --update  # 승격 완료 후 PDF 해시 매니페스트(pdf_hashes.json) 스탬프
# ※ PDF 교체/재변환 절차: ① PDF 교체 ② convert:refs ③ verify:refs ④ ref_md_v2 → ref_md/과목N/{문서}/ 수동 승격 ⑤ check:reffresh -- --update
# ※ ref_md는 `#L####` 라인 인용이 의존하므로 항상 시각적 줄 그대로(segment=False) 변환 — 엔진의 --no-segment 상당
```

## 디렉토리 구조

```
index.html              # App Shell (단일 HTML)
style.css               # CSS 진입점 (@import로 모듈 로드)
sw.js                   # Service Worker
manifest.webmanifest    # PWA 매니페스트
feature-plan.json       # 기능별 무료/Pro 전환 설정 (pro = 배지+안내, free = 완전 무료)
serve.js                # 로컬 개발 서버
src/                    # ES Modules
  app.js                # 메인 애플리케이션 로직 (초기화, 이벤트 위임, 라우팅)
  app-fallback.js       # ESM 로드 실패 시 자동 복구 (모바일 PWA 대응)
  router.js             # 뷰 라우터 (navigateToView, getViewTitles)
  state.js              # 전역 상태 + 진행 영속성 (saveProgress — 저장은 storage.js 위임)
  storage.js            # 저장소 추상화 계층 — 백엔드 교체 가능(getItem/setItem 동기·Async 이중 API), 스코프·쓰기훅·쿼터 감지 중앙화
  ui-utils.js           # showToast, showConfirm, showGlobalLoading, trapFocus
  sanitize.js           # XSS 방어 (escapeHTML, safeTextWithBreaks)
  data-loader.js        # 온디맨드 콘텐츠 로더 (DataLoader)
  scratchpad.js          # 스크래치패드 캔버스 (계산 연습용)
  spaced-repetition.js  # SM-2 간격 반복 알고리즘
  study-aids.js         # 기출 필터, 숫자 암기표
  study-tracker.js      # 학습 캘린더/목표 추적 헬퍼 (recordStudyActivity, getStudyGoals)
  statement-tracker.js  # 진술 원자(sid) 단위 오판 통계·졸업 추적 (SM-2 연동)
  recommendations.js    # 합격 전략 추천 엔진 + 예상 점수 추정 + 실제 결과 보고 (순수 로직)
  command-palette.js    # 통합 검색 팔레트 (Ctrl+K) — 뷰/교재/카드/퀴즈/성분/문제집 검색·실행
  weak-items.js         # 약점(오답) 항목 ID 문법·해석 공용 모듈 (weak_quiz_/weak_sim_ 접두사, 퀴즈·카드 인덱스 캐시, DOM 비의존)
  questions.js          # 문항 스키마 (single/combo/short/ox), deriveComboAnswer, validateQuestion
  exam-viewer.js        # 문제집/참조자료 MD 뷰어
  manual-viewer.js      # 학습안내서/매뉴얼 MD 뷰어
  charts.js             # SVG 레이더/꺾은선 차트
  pdf-registry.js       # 참조자료 경로 매핑 (시험별 테이블 — getRefTables())
  glossary-query.js     # 용어집 인덱스 쿼리 API (getGlossaryIndex())
  html-viewer.js        # 외부 HTML 콘텐츠 뷰어
  reader-format.js      # 교재 본문 포맷터
  textbook-parser.js    # 교재 MD 파서
  markdown-parser.js    # 공통 MD 파서
  mermaid-utils.js       # Mermaid 다이어그램 설정
  mermaid-render.js      # Mermaid 지연 로딩 + 컨테이너 렌더링 (reader/search/manual 공용)
  pwa-manifest.js        # 시험별 동적 PWA 매니페스트 (클래식 스크립트 — 빌드 산출물 manifest.<id>.webmanifest 실제 파일로 링크 교체, blob: 금지)
  keyword-index.js      # 교재 셀→참조자료 키워드 매핑 (시험별 — 자동 생성)
  web-vitals.js         # Core Web Vitals 모니터링
  sha256.js             # 안정적 ID 해시
  utils.js              # 공통 유틸리티 (shuffle 등)
  storage-keys.js       # localStorage 키 중앙 관리
  paths.js              # 파일 경로 상수 중앙 관리 (시험 루트 인지형)
  exam-context.js       # 활성 시험 해석/전환, scopedKey 네임스페이스, hasFeature
  formula-store.js      # Formula OS — 포뮬러 CRUD·저장 한도(5개), 고객·원료 스키마 정제
  formula-rules.js      # Formula OS — 추천 규칙 (베이스·고민/피부 매핑, 안전 필터, 맞춤 규칙)
  formula-check.js      # Formula OS — 고시 한도 규정 검증 엔진 (원료 인덱스, 4상태 판정)
  formula-stability.js  # Formula OS — 제형 안정성 체크 (상 비율·상호작용·단계·pH)
  store-utils.js        # Formula OS — 스토어 공통 헬퍼 (loadItems/newId/clamp…)
  batch-store.js        # Formula OS — 조제 기록(배치) 채번·QC·위생·스냅샷 (50건)
  customer-store.js     # Formula OS — 고객 카드·상담 이력(append-only) (20명)
  material-ledger.js    # Formula OS — 원료 입고·사용기한·재고, 기한 경고 (30종)
  usage-guide.js        # Formula OS — 사용 안내문 생성기 (제형 템플릿+원료 주의)
  csv-utils.js          # Formula OS — CSV 파서·EUC-KR 폴백 디코딩·BOM 직렬화
  pwa-install.js        # PWA 설치 프롬프트 설정
  whats-new.js          # 새 버전 변경 이력 알림 (APP_VERSION 비교 → 모달, 설정 "변경 이력" 재열람)
  feedback.js           # 의견 수신 — 설정 "의견 보내기" 모달, ?src= 유입 추적, 익명 insert, 오프라인 큐
  pro-upgrade.js        # Pro 안내 — feature-plan.json 로드, PRO 배지(data-pro-feature) 제어, 한도 초과 업그레이드 모달
  theme-init.js         # 테마 초기화 (즉시 실행)
  theme-toggle.js       # 테마 토글 UI
  ui-mode.js            # 학습/실무 UI 모드 전환 (ui_mode 전역 키, 학습 도구 접이식)
  supabase-config.js    # Supabase 프로젝트 URL·Publishable key (공개 설계상 키)
  supabase-client.js    # Supabase lazy init — vendor/supabase UMD 동적 로드
  auth-view.js          # 계정/로그인 모달 (이메일+PW·회원가입·매직링크)
  sync.js               # 클라우드 스냅샷 동기화 (sync_snapshots push/pull, dirty 훅·디바운스·충돌 확인, 고객 키 제외)
  config/
    timing.js           # 타이밍 상수 (PWA 프로브, 스와이프 임계값 등)
    cache.js            # 캐시 설정 상수
  views/                # 뷰 컨트롤러 (29개)
    navigation.js       # 뷰 전환 유틸 (switchView)
    textbook-reader.js  # 교재 리더 (본문 + 참조자료)
    reader-audio.js     # 오디오북 플레이어
    textbook-search.js # 교재 검색 (역색인)
    quiz.js             # 기출 퀴즈
    flashcard.js        # 3D 플래시카드
    daily-challenge.js  # 데일리 챌린지
    dashboard.js        # 대시보드 + 맞춤 학습 리포트 뷰 (통계·히트맵·개인화 진단 카드)
    trainer.js          # 스마트 훈련소 허브 (재수출)
    trainer-calc-practice.js  # 계산 연습기
    trainer-ingredients.js    # 원료 배합 챌린지
    trainer-drills.js   # O/X·복수정답형 드릴 UI
    pomodoro.js         # 뽀모도로 타이머
    exam-simulator.js   # 실전 모의고사 시뮬레이터
    exam-sim-state.js   # 시뮬레이터 상태
    exam-sim-review.js  # 시뮬레이터 결과 리뷰
    exam-select.js      # 시험 선택/전환 뷰
    dictionary.js       # 용어집
    study-calendar.js    # 학습 캘린더/목표 뷰
    glossary-renderer.js # 용어집 렌더링
    event-listeners.js  # 이벤트 리스너 일괄 바인딩
    formula.js          # Formula OS 뷰 — 배합 계산기, 추천, My 포뮬러, 서브내비 칩, 인쇄·JSON 공유
    formula-batch.js    # Formula OS — 조제 기록(배치) 목록·폼·상세 패널
    formula-customer.js # Formula OS — 고객 관리 패널 (카드·상담 이력·역참조)
    formula-material.js # Formula OS — 원료 장부 패널 (기한 배지·경고)
    formula-compliance.js # Formula OS — 법규 준수 체크리스트 + 법령 MD 링크
    formula-print.js    # Formula OS — 인쇄 빌더 (조제 기록지·라벨·안내문)
    backup.js           # 백업/복원
    offline-detection.js # 오프라인 감지 (app.js에서 분리)
css/                    # 스타일시트 모듈 (base.css, reader.css, reader-mermaid.css, trainer.css, exam.css, dashboard.css, study.css, study-calendar.css, formula.css, print.css, ui-overlay.css, html-viewer.css)
content/                # 시험 콘텐츠 컨테이너 (시험 소유 파일 없음 — 순수 네임스페이스)
  exams.json            # 시험 레지스트리 (멀티시험 엔트리 — 멀티시험 구조 섹션 참조)
  exams/cosmetic/       # 기본 시험 콘텐츠 루트 (contentRoot)
    manifest.json       # 과목/교재/문제은행 선언
    references.json     # 참조자료 매핑 설정
    교재/                # 4과목 MD 파일 (표준형 4 + 이야기형 4 = 8파일, 총 19챕터 — 과목별 2·5·5·7)
    문제은행/            # 과목별 문제은행 MD
    참조자료/            # 법령고시/별표/참조자료 — PDF는 공통·과목1~4 폴더, MD 변환본은 ref_md/과목N/{문서}/{문서}.md (과목 폴더가 귀속의 진실)
      원료/              # 원료 DB — approved/restricted/banned/colorants_ingredients.md + db_version.json (버전·이력)
    audiobook/          # 오디오북 MP3 산출물 (생성 스크립트는 ref-pipeline/audiobook/)
    number-drills/      # 숫자 암기 드릴 JSON
  exams/<id>/           # 추가 시험도 동일한 내부 구조 (대칭)
data/                   # 빌드 생성 번들
  exams.js              # 전역 시험 목록 (window.EXAMS_LIST)
  audio_manifest.js     # 전역 오디오 매니페스트 (시험 id 키 분리)
  version.js            # window.APP_VERSION — 배포 스탬프와 동기화
  release-notes.json    # 사용자용 변경 이력 진실 소스 (notes:draft → JSON 편집 → deploy)
  release-notes.js      # window.RELEASE_NOTES — 생성 파일 (직접 편집 금지)
  docs_md/              # 앱 공용 문서 번들 (user_manual·formula_manual — 시험 무관)
  exams/cosmetic/       # 기본 시험 데이터 루트 (dataRoot: registry.js, subjects/, exams/, drills/, study_md/, docs_md/, id_migration.js 등)
  exams/<id>/           # 추가 시험 데이터 루트 (동일 구조)
tools/                  # 빌드 스크립트
  build/                # 데이터 파이프라인 (manifest → registry + 해시 번들)
  sync_citation_lines.js # 문제은행 인용 링크 라인번호 동기화 (교재 변경 시)
ref-pipeline/           # 교재·참조자료 생성/변환 독립 도구함 (PDF→MD, MD→HTML, 오디오북 TTS, 법령 검증) — 사용 절차는 ref-pipeline/README.md 참조
vendor/                 # 자체 호스팅 자산 (fonts/, fontawesome/)
tests/                  # 테스트
  unit/                 # node --test 유닛 테스트
  dom/                  # Vitest + jsdom DOM 테스트
docs/                   # 개발 문서
  dev/                  # 아키텍처, 배포 가이드, 변경 이력
  user/                 # 사용자 매뉴얼
```

## 아키텍처 핵심

1. **Local-First + Optional Cloud**: 순수 프론트엔드 + Vercel 정적 호스팅이 기본, Supabase는 로그인 사용자에게만 붙는 선택 레이어 (미설정 시 완전 정상 동작)
2. **Vanilla ES Modules**: `<script type="module">`, import/export, 프레임워크 없음
3. **DataLoader 온디맨드**: `{contentRoot}/*.md`를 런타임 fetch + parseMarkdown으로 렌더링
4. **Service Worker**: Cache First (HTML/JS/CSS), DATA_CACHE (MD/참조자료, 배포 간 유지)
5. **이벤트 위임**: `data-click`/`data-arg` 속성 기반, CSP `script-src 'self'` 호환
6. **멀티시험 플랫폼**: 시험별 `contentRoot`/`dataRoot` 분리 — 아래 "멀티시험 구조" 참조

## 멀티시험 구조

- **시험 레지스트리**: `content/exams.json` → `data/exams.js` 번들(`window.EXAMS_LIST`, `npm run build:data`에 포함). 각 시험 엔트리: `id`, `name`, `title`/`logoMain`/`logoSub`(브랜딩), `desc`, `icon`, `year`, `default`, `contentRoot`, `dataRoot`, `registryBundle`, `registryGlobal`, `features`(기능 플래그)
- **시험별 루트 (대칭)**: 모든 시험이 `content/exams/<id>/`(manifest.json + references.json + 교재/문제은행/참조자료/audiobook 등)와 `data/exams/<id>/`(registry.js, subjects/, exams/, drills/, study_md/, docs_md/, supplements/, id_migration.js 등) 구조 — 기본 시험(cosmetic)도 예외 없음. `content/`·`data/` 루트에는 전역 파일만: `exams.json`/`exams.js`, `audio_manifest.js`(시험 id 키 분리), `docs_md/`(앱 공용 문서)
- **시험 컨텍스트**: `src/exam-context.js` — `contentPath()`/`dataPath()`(경로 해석), `hasFeature()`(기능 게이팅), `selectExam()`(전환 = `location.reload()`로 모듈 상태 리셋), `scopedKey()`(진도 네임스페이스 `<examId>:key`)
- **진도 격리**: `safeGetItem`/`safeSetItem` 등이 자동으로 시험 접두사 적용. 테마·리더 설정 등 `GLOBAL_KEYS`만 비네임스페이스. 백업 파일은 비접두사 논리 키(시험 간 호환)
- **새 시험 추가 절차**: ① `content/exams/<id>/`에 manifest.json + references.json + 교재/문제은행 배치 ② `content/exams.json`에 엔트리 추가 (`contentRoot`/`dataRoot`/`registryBundle`/`registryGlobal` 지정 — 비기본 시험은 `registryGlobal: "DATA_REGISTRY_<id>"`) ③ `npm.cmd run check:content -- --build` → 끝 (앱 로직 변경 불필요)
- **기능 플래그**: `features`에 없는 기능은 `data-feature` 속성/`hasFeature()`로 자동 숨김 — 성분사전·원료배합·계산연습·오디오북·참조자료 등 도메인 특화 기능
- **Node 도구**: `EXAM_ID`/`EXAM_CONTENT_ROOT`/`EXAM_DATA_ROOT` env로 대상 시험 지정 (예: `EXAM_ID=<id> node tools/build/index.js`)

## 구조 변경 시 문서 갱신 규칙

- 디렉터리/파일 이동·삭제·추가 시 경로를 참조하는 문서를 함께 갱신: `README.md`·`AGENTS.md` 디렉터리 트리, `docs/dev/ARCHITECTURE.md` 트리·변경 매트릭스, `docs/README.md` 인덱스, 관련 런북(`docs/dev/runbooks/CONTENT_WORKFLOW.md`, `docs/dev/runbooks/TEXTBOOK_REPLACEMENT_RUNBOOK.md`, `ref-pipeline/README.md`)
- 갱신 후 `npm.cmd run check:docs` 통과 필수 — 문서 내 스테일 경로 참조를 자동 탐지 (`check:content`에도 통합돼 자동 실행)
- 계획/미구현 경로·이력 서술 등 의도적 참조는 `tools/config/docs_paths_allowlist.json`에 `reason`과 함께 등록

## 코드 스타일 및 규칙

### JavaScript
- ES Modules (`import`/`export`), 클래식 스크립트는 데이터 파일/외부 라이브러리만
- 2-space 들여쓰기
- `window` 전역 노출: `data-click` 이벤트 위임을 위해 `app.js`에서 `window`에 핸들러 매핑
- 인라인 `onclick`/`oninput` 금지 (CSP 차단) → `data-click`/`data-input` 사용
- `element.style.display = '...'` 금지 → `classList.add/remove('is-hidden')` 사용
- `alert()`/`confirm()` 금지 → `showToast()`/`showConfirm()` 사용 (src/ui-utils.js)
- **강건성 규칙** (상세: `docs/dev/ARCHITECTURE.md` 강건성 가이드라인 섹션):
  - 배열 접근 후 bounds 체크: `if (!item) return;`
  - `window.X` 접근 시 존재 체크: `window.X && window.X[key]`
  - `parseInt()` 결과 `isNaN()` 체크
  - `localStorage` 접근 시 `try/catch` 래핑 (또는 `safeGetItem`/`safeSetItem` 사용)
  - `document.getElementById()` 결과 null 체크
  - Promise 체인에 `.catch()` 추가

### CSS
- `style.css`가 진입점, `@import`로 `css/*.css` 로드
- 디자인 토큰은 `css/base.css` `:root`의 CSS 변수 사용 (`--color-primary`, `--radius-md` 등)
- `!important` 최소화 (Mermaid 다이어그램 규칙은 예외 — 인라인 스타일 덮어쓰기용)
- 미디어 쿼리 브레이크포인트: 768px / 900px / 1200px (3단계)
- 인라인 `style="display: none;"` 금지 → `class="is-hidden"` 사용
- 유틸리티 클래스: `.is-hidden`, `.is-flex`, `.is-grid` (css/base.css)

### HTML
- 단일 `index.html` (App Shell)
- `<h1>`은 페이지당 1개 (사이드바 브랜드)
- 헤딩 위계: h1 → h2 → h3 → h4 순서 준수 (h5/h6는 위계 역행 주의)
- 인라인 이벤트 핸들러 (`onclick`, `oninput` 등) 금지
- 아이콘 전용 버튼에는 `aria-label` 필수
- 동적 피드백 영역에는 `role="status" aria-live="polite"` 권장

## Service Worker 캐시 규칙

- `sw.js`의 `CACHE_VERSION`은 배포마다 bump 필요
- 형식: `v{번호}-{날짜}-{설명 또는 커밋해시}`
- `stamp:sw` 스크립트로 커밋 해시 자동 스탬프 가능
- `SHELL_CACHE`: HTML/JS/CSS (배포마다 삭제 후 재캐시)
- `DATA_CACHE`: MD/참조자료 (배포 간 유지, 해시 파일명으로 갱신 감지)

## 검증 체크리스트 (변경 후 필수)

1. `node --check` — 수정한 JS 파일 문법 검증
2. `npm.cmd test` — 유닛 테스트 통과 확인
3. `npm.cmd run check:parser` — 콘텐츠 변경 시 파서 등가성 검증
4. `npm.cmd run check:imports` — src/ 내 ES 모듈 import/export 교차 검증
5. `npm.cmd run verify:assets` — SHELL_ASSETS 파일 존재 확인
6. `git status` — 임시 파일(`_temp_*.js`, `.git/COMMIT_MSG.txt`) 제거 확인
7. `sw.js` `CACHE_VERSION` bump 확인
7. Vercel 배포 후 `https://personalized-skincare-study.vercel.app` 200 OK 확인

## 주의사항

- **PowerShell 환경**: `&&` 연산자 사용 불가 → `;` 사용. `npm` → `npm.cmd`.
- **Mermaid `!important`**: `css/reader.css`의 Mermaid 규칙 `!important`는 제거 금지 (Mermaid 라이브러리 인라인 스타일 덮어쓰기용)
- **콘텐츠 편집 후**: `npm.cmd run build:data` 실행 후 `data/` 번들 커밋 필요
- **CSP**: `vercel.json`에 `script-src 'self'` (인라인 스크립트 금지)
- **DOM 테스트**: `tests/dom/` — Phase 1~5 전 뷰 커버 (매트릭스·작성 규칙은 `docs/dev/design/DOM_TEST_DESIGN.md`, 파일별 목록·정책은 `docs/dev/reference/TESTING.md`)

## 관련 문서

- `docs/dev/ARCHITECTURE.md` — 시스템 아키텍처 상세
- `docs/dev/runbooks/DEPLOYMENT_GUIDE.md` — 배포 가이드
- `docs/dev/runbooks/CONTENT_WORKFLOW.md` — content 변경 시 작업 절차 가이드
- `docs/dev/CHANGES.md` — 변경 이력
- `docs/dev/reference/TESTING.md` — 테스트 가이드
- `docs/dev/design/DOM_TEST_DESIGN.md` — jsdom UI 시나리오 테스트 설계
- `docs/dev/design/SUPABASE_DESIGN.md` — 계정·클라우드 동기화 설계안 (Phase 1~2 구현 완료, Pro entitlement는 미구현)
- `docs/dev/runbooks/TEXTBOOK_AUTHORING_GUIDE.md` — 교재 작성 가이드
- `docs/dev/reference/NUMBERING_SYSTEM.md` — 교재 번호체계 가이드 (십진법)
- `docs/dev/design/QUESTION_SCHEMA_DESIGN.md` — 문항 스키마 + 복수정답형 변환 파이프라인 설계
- `docs/dev/design/FORMULA_OS_WORKFLOW_DESIGN.md` — 조제관리사 9개 업무 전체 커버리지 확장 설계안 (고객·배치·원료장부·안내문)
- `docs/dev/runbooks/COMBO_GENERATION_GUIDE.md` — 복수정답형 문항 생성 절차·품질 게이트·수치 조정 가이드
- `docs/dev/reference/COMBO_STUDY_STRATEGY.md` — 복수정답형 학습 전략 (전략→기능 매핑 포함)
- `docs/user/user_manual.md` — 학습 매뉴얼 (시험 대비)
- `docs/user/formula_manual.md` — 실무 매뉴얼 (Formula OS)
