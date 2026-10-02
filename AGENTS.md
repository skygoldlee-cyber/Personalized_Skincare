# AGENTS.md — AI 에이전트 프로젝트 가이드라인

> 이 파일은 Devin, Claude Code, Cursor 등 AI 코딩 에이전트가 프로젝트에 진입했을 때 참조하는 가이드라인입니다.
> **문서 ID**: DOC-ROOT-02
> **관련 SPEC ID**: 해당 없음 (작업 가이드 — ID 인용 규약은 별도 절)

## 프로젝트 개요

**Passmula** — 맞춤형화장품 조제관리사 자격시험 대비 + Formula OS 실무 배합 통합 플랫폼.

- 순수 HTML/CSS/JavaScript (Vanilla ES Modules, 프레임워크 없음)
- PWA (Service Worker 오프라인 캐시, 설치 가능)
- Vercel 정적 배포 + **선택적 Supabase** (로그인 사용자 클라우드 동기화 — 미설정 시 앱 정상 동작)
- 사용자 진행 상황은 localStorage가 1차 저장소 (계정 없이 전 기능 사용 가능)

## 핵심 명령어

> **주의**: Windows PowerShell 환경. `npm`/`npx` 스크립트가 실행 정책으로 차단되므로 `npm.cmd`/`npx.cmd` 사용.
> **환경 요구사양**(Node/Python 버전, 선택 도구, 최초 설정 절차)은 `docs/dev/reference/DEV_ENVIRONMENT.md` 참조.

```powershell
# 테스트
npm.cmd test                          # 유닛 테스트 (node --test)
npm.cmd run test:dom                  # DOM 테스트 (Vitest + jsdom)
npm.cmd run test:e2e                   # E2E 테스트 (Playwright 실브라우저 — 부트스트랩·SW·PWA·네비게이션, serve.js 자동 기동)
npm.cmd run test:all                   # 전체 테스트 (unit + parser + dom)

# 빌드
npm.cmd run build:data                 # content/exams/<id>/*.md → data/exams/<id>/ 번들 생성 (모든 시험 순회)
node tools/build/build_doc_bundles.js        # content/exams/<id>/docs/*.md → {dataRoot}/docs_md/ 번들 (앱 내 문서 갱신 시 필수 — 매뉴얼·학습안내서 모두 시험별 문서)
npm.cmd run build:html                # index.template.html + html/views/*.html → index.html 조립 (뷰 마크업 변경 시 필수)
npm.cmd run check:html                # index.html이 파셜 조립 결과와 일치하는지 비교 (개행 정규화 — pre-push·CI 게이트)
npm.cmd run check:parser               # 빌드 파서 ↔ 런타임 파서 등가성 검증
npm.cmd run check:imports              # src/ 내 ES 모듈 import/export 교차 검증
npm.cmd run stamp:sw                   # sw.js CACHE_VERSION을 커밋 해시로 스탬프
npm.cmd run notes:draft                # 릴리스 노트 pending 초안 생성 (커밋 subject 기반 → data/release-notes.json 수동 편집 후 배포)
npm.cmd run verify:assets              # SHELL_ASSETS/DATA_ASSETS 파일 존재 검증

npm.cmd run build:story                 # 표준형 + story/*_서사.md 패치 → _이야기형.md 생성 (build:data에 포함, --check=일치 검증 + 서사 커버리지 리포트 — 0블록 패치는 오류, -- --scaffold <subjectKey>=신규 과목 패치 골격)
#   이야기형 패치 작성법(슬롯 마커·지시어 문법): docs/dev/runbooks/STORY_PATCH_GUIDE.md
# 콘텐츠 동기화 (build:data에 자동 통합됨)
npm.cmd run sync:citations              # 문제은행 인용 라인번호 동기화
node tools/sync_citation_lines.js --check  # 변경사항 확인만 (수정 안 함)
node tools/sync_textbook_files.js       # 교재/문제은행 파일 ↔ manifest·sw.js MD_ASSETS 구조 동기화 (--check=보고만, --rename <구> <신>=파일명 변경 전파)

# 로컬 서버 (vercel.json 헤더 미러링 — 프로덕션 CSP·캐시 정책 그대로 적용)
npm.cmd run serve                      # http://localhost:3000

# 배포
npm.cmd run deploy                     # 배포 가드(clean tree + origin/main 동기화 확인) → sw 스탬프 자동 커밋·푸시 → vercel --prod 실행
# ※ 사용자가 "배포"라고 요청하면 이 명령 하나로 전체 단계 수행
# ※ `vercel --prod` 직접 실행 금지 — 미푸시 커밋/미커밋 변경이 프로덕션에 올라감

# 감사
npm.cmd run audit:cards                 # 카드 품질 자동 감사 (짧은 설명, 중복, 참조 링크 유효성)
npm.cmd run sbom                        # SPDX 형식 SBOM 생성 → sbom.spdx.json (CI 아티팩트, gitignore 대상)
npm.cmd run audit:combo                 # 복수정답형 품질 감사 (정답 유일성·중복 진술집합·모순쌍·위치편향·경로별 통계)

# 전체 점검 (단일 진입점 — lint·types·html·docs + check:content 전 단계)
npm.cmd run check:all                    # 저장소 전체 검증 일괄 실행
npm.cmd run check:all:quick              # DOM 테스트 생략 빠른 점검 (check:all -- --quick 은 플래그 미전달로 동작 안 함)
npm.cmd run check:ci                     # CI 게이트 로컬 재현 — lint·types·imports·docs·docsync·specrefs·trace·html·content-only·unit·assets·parser (coverage·E2E·audit는 CI 전용)

# 콘텐츠 통합 검증 (교재 교체 등 대규모 콘텐츠 변경 후)
npm.cmd run check:content               # 인용·귀속·레이아웃·드릴·ID이관·파서·임포트·자산·카드·문서·테스트 일괄 검증
npm.cmd run check:content -- --build    # build:data 선실행 후 검증 (교재 교체 시 권장)
npm.cmd run check:content -- --quick    # DOM 테스트 생략
npm.cmd run check:content -- --content-only  # 콘텐츠 추적 단계만 (CI용 — 파서·임포트·테스트 등 별도 게이트 제외)
npm.cmd run check:manifest              # manifest 선언 ↔ 파일/과목 자산 정합성 + 미등록 .md 역방향 경고
npm.cmd run check:reflayout             # 참조자료 4계층 정합성 (PDF 폴더↔ref_md↔references.json↔규칙, 링크 해석)
npm.cmd run check:refsubjects           # ref_md 문서의 인용 득표↔과목 귀속 교차 검증
npm.cmd run check:reffresh              # 참조자료 PDF 해시 ↔ ref_md 신선도 (PDF 교체 감지)
npm.cmd run check:reflines              # 교재 (LNN)/📌출처 조문 ↔ ref_md 실제 내용 검증
npm.cmd run check:drillfresh            # 드릴 번들 ↔ 문제은행 번들 신선도 (stale 시 npm run build:drills)
npm.cmd run check:docbundles           # docs_md 번들 ↔ 원본 문서 신선도 (check:content에 포함)
npm.cmd run check:datafresh            # data/·생성물 ↔ 원본 신선도 — 빌드 체인 실행 후 git diff 비교·자동 원복 (생성물 경로가 clean이어야 실행 가능)
npm.cmd run check:docs                  # README·AGENTS·docs/*.md 내 경로 참조 존재 검증 + 문서 ID 누락·중복 검증 + 디렉토리 구조 정합 (check_inventory) + npm 명령 정합 (check_npm_commands) + 플랜 키 정합 (check_plan_features) + 도메인 기능 플래그 정합 (check_feature_flags) + 저장소 접근 탐지 (check_storage_access) + 릴리스 노트 정합 (check_release_notes) + CI 패리티 (check_ci_parity)
npm.cmd run check:inventory             # AGENTS.md 디렉토리 구조 트리 ↔ 실제 파일시스템 정합 (전 트리 존재성 + src/ 전수·css 목록 양방향 + N개 개수 표기) + ARCHITECTURE.md box 트리(├──/└──) 존재성
npm.cmd run check:commands              # 문서의 npm 명령 인용 ↔ package.json 스크립트 양방향 정합
npm.cmd run check:plan                  # feature-plan.json 키 ↔ 코드 사용(isProFeature·data-pro-feature·proFeatureNotice) ↔ 로드맵 문서 정합
npm.cmd run check:featflags             # exams.json features 키 ↔ 코드 사용(hasFeature·features.X·data-feature) 양방향 — 미선언 키 사용 = 영구 falsy 죽은 경로로 오류
npm.cmd run check:storage               # src/ 내 localStorage 직접 접근 탐지 — storage.js 추상화 우회 금지 (부트스크립트·인프라 모듈은 ALLOWED_FILES)
npm.cmd run check:ciparity              # ci.yml 워크플로 명령 ↔ check:ci 체인 양방향 정합 (비대칭은 CI_ONLY·LOCAL_ONLY 명단에 사유 명시)
npm.cmd run check:secrets               # 추적 파일 시크릿 패턴 스캔 (개인키·service_role·토큰 — 공개키는 ALLOWLIST, pre-commit 게이트)
npm.cmd run check:notes                 # release-notes.json 스키마·버전 해시→커밋 해석·최신 항목↔APP_VERSION 정합
npm.cmd run check:domainmap             # 파일 계층 분류 강제 — src/css/html/data/content/tests 전 파일이 domain-map.json에 선언 필수 (분류 규약: ARCHITECTURE.md "파일 계층 분류")
npm.cmd run check:uitext                # UI 텍스트 커버리지 — data-uitext↔manifest.uiText 양방향 + platform HTML 시험명 잔존 검사
npm.cmd run scaffold:exam -- <id> --name "시험명"  # 새 시험 스캐폴딩 — exams.json 등록 + manifest/references 골격 + 샘플 교재·문제은행·docs/ 생성 (--dry-run=미리보기, <id> --remove=제거)
npm.cmd run lint                        # ESLint — 에러 0 필수 (기존 경고는 점진 정리 대상)
npm.cmd run check:types                 # tsc --noEmit (jsconfig checkJs — JSDoc 타입 진단)
npm.cmd run check:specrefs              # SPEC↔@spec 스테일 참조 + 테스트 갭 기준선(기준선 0 — 신규 갭 즉시 실패)
npm.cmd run check:docsync               # 소스 변경 시 문서 갱신 강제 — src/tools/tests/설정 변경에 docs/·AGENTS·README 갱신 동반 필수. 우회: SKIP_DOCSYNC=1 (모든 단계) · 커밋 메시지 행 끝의 [no-docs] (pre-push --ref 단계에서만 인식 — 마크된 커밋의 파일만 면제되며 다른 커밋은 계속 검사. pre-commit은 메시지 미존재로 불가)
npm.cmd run check:trace                 # TRACE_MATRIX 입력 해시 신선도
npm.cmd run check:lawurls               # law.go.kr 한글주소 유효성 전수 검증 (law-links.js 매핑 실호출, 오류 페이지 본문 판별)
node tools/impact_tests.js              # 변경 파일 → 영향 요구사항·권장 테스트 (미커밋 변경 자동 분석, --ref <ref>로 diff 분석, --run으로 권장 테스트 실제 실행 — pre-push 게이트)
npm.cmd run hooks:install               # Git 훅 활성화 (opt-in) — pre-commit: check:types+lint (IDE 오류 시 커밋 차단) / pre-push: +check:trace/specrefs/docs/영향테스트(impact_tests --run)
npm.cmd run check:hooks                 # 훅 설치 여부 확인 (권고 — 미설치 시 로컬 게이트 우회됨, check:ci 첫 단계)

# 참조자료 PDF → ref_md 변환 (Python 3 + pdfplumber, 이미지 추출 시 pymupdf 필요)
npm.cmd run convert:refs                # 참조자료 PDF 전체 → ref_md_v2/ 스테이징 변환 (파일명 필터 인자 가능)
npm.cmd run verify:refs                 # ref_md_v2 vs ref_md 골든 비교 (내용 누락 시 exit 1)
npm.cmd run check:reffresh -- --update  # 승격 완료 후 PDF 해시 매니페스트(pdf_hashes.json) 스탬프
# ※ PDF 교체/재변환 절차: ① PDF 교체 ② convert:refs ③ verify:refs ④ ref_md_v2 → ref_md/과목N/{문서}/ 수동 승격 ⑤ check:reffresh -- --update
# ※ ref_md는 `#L####` 라인 인용이 의존하므로 항상 시각적 줄 그대로(segment=False) 변환 — 엔진의 --no-segment 상당

# 식약처 고시 감지 (참조 법령·고시 다문서 추적 — references.json referenceLaw에서 자동 유도)
python ref-pipeline/check_mfds_notice.py --update   # 키: LAW_OC_KEY 환경변수 또는 ref-pipeline/.env.local.json (gitignore됨)
# ※ 대상 시험: --exam <id|경로> 인자 > EXAM_CONTENT_ROOT env > EXAM_ID env > exams.json default
#   (모든 ref-pipeline 스크립트가 공용 헬퍼 _exam_root.py로 같은 순서 해석)
# ※ 배너 기준 문서는 references.json.noticeCore, 수동검증값은 law_verified.json — 시험별 설정으로 분리됨
# ※ baseline(파일명의 제N호·시행일)↔latest(법령=target:law / 고시=target:admrul) 비교를 notice_status.json docs[]에 기록
#   — 신규 고시 감지 시 Actions가 이슈 생성 + check_law_urls.js로 한글주소 유효성도 함께 검증
# ※ docs[].currentUrl = 시행일자≤오늘 최신본(현행본)의 시리얼 URL — 한글주소가 시행 예정 개정본으로 연결될 때 앱이
#   ↗원문 링크를 현행본(lsInfoP/admRulInfoP)으로 보정하고 '⏳ 시행 예정 개정본' 배지 표시 (notice-check.js markStaleRefLinks)
# ※ 앱은 Formula OS 진입 시 배너 표시 + 허브 '식약처 고시 확인' 버튼으로 law.go.kr 등록 문서 병렬 실시간 조회(src/notice-check.js, 시험별 referenceLaw)
# ※ Actions 크론(주1회 자동)은 선택사항 — 저장소 Settings → Secrets에 LAW_OC_KEY 등록 시 활성화.
#   미등록이면 수동 실행만 가능. 앱 내 실시간 버튼이 확인을 커버하나, 크론은 이슈 자동 생성 안전망 역할
# ※ 대조 절차: docs/dev/ingredients_audit_제2026-19호.md
```

## 디렉토리 구조

```
index.template.html     # App Shell 템플릿 — <!-- @include --> 마커로 뷰 파셜 조립
index.html              # App Shell (생성물 — npm run build:html 산출, 직접 편집 금지)
html/views/             # 뷰 마크업 파셜 13개 — 뷰 HTML 편집은 여기서, build:html로 재생성
style.css               # CSS 진입점 (@import로 모듈 로드)
sw.js                   # Service Worker
manifest.webmanifest    # PWA 매니페스트
feature-plan.json       # 기능별 무료/Pro 전환 설정 (pro = 배지+안내, free = 완전 무료)
serve.js                # 로컬 개발 서버
src/                    # ES Modules
  app.js                # 메인 애플리케이션 로직 (초기화, 이벤트 위임, 라우팅)
  app-dashboard.js      # 대시보드 셀렉트·시험/리소스 카드·스토리지 경고 (app.js 분리)
  app-shell.js          # 뷰포트·가로세로·data-click 접근성·시험 브랜딩(타이틀·로고·아이콘·앱명)·기능 플래그 (app.js 분리)
  app-fallback.js       # ESM 로드 실패 시 자동 복구 (모바일 PWA 대응)
  router.js             # 뷰 라우터 (navigateToView, getViewTitles, initViewHashRouting — #/슬러그 딥링크·뒤로가기)
  state.js              # 전역 상태 + 진행 영속성 (saveProgress — 저장은 storage.js 위임)
  storage.js            # 저장소 추상화 계층 — 백엔드 교체 가능(getItem/setItem 동기·Async 이중 API), 스코프·쓰기훅·쿼터 감지 중앙화
  ui-utils.js           # showToast, showConfirm, trapFocus + 훈련 공용 마크업(markChoiceButtons·wrongReviewHtml·trainerResultHtml·showAnswerFeedback)
  sanitize.js           # XSS 방어 (escapeHTML, safeTextWithBreaks, esc, stripTags)
  data-loader.js        # 온디맨드 콘텐츠 로더 (DataLoader)
  scratchpad.js          # 스크래치패드 캔버스 (계산 연습용)
  trainer-calc.js       # 계산 트레이너 문제 생성기 (순수 로직, 전역 스코프 실행)
  spaced-repetition.js  # SM-2 간격 반복 알고리즘
  study-aids.js         # 기출 필터, 숫자 암기표
  study-tracker.js      # 학습 캘린더/목표 추적 헬퍼 (recordStudyActivity, getStudyGoals)
  statement-tracker.js  # 진술 원자(sid) 단위 오판 통계·졸업 추적 (SM-2 연동)
  recommendations.js    # 합격 전략 추천 엔진 + 예상 점수 추정 + 실제 결과 보고 (순수 로직)
  analysis-engine.js    # 맞춤학습 심층 분석 순수 로직 (AN-01~09 — 예측 점수·취약 단원·주간 리포트)
  command-palette.js    # 통합 검색 팔레트 (Ctrl+K) — 뷰/교재/카드/퀴즈/성분/문제집 검색·실행
  weak-items.js         # 약점(오답) 항목 ID 문법·해석 공용 모듈 (weak_quiz_/weak_sim_ 접두사, 퀴즈·카드 인덱스 캐시, DOM 비의존)
  questions.js          # 문항 스키마 (single/combo/short/ox), deriveComboAnswer, validateQuestion (샘플 문항은 tests/fixtures/sample-questions.js)
  exam-viewer.js        # 문제집/참조자료 MD 뷰어
  combo-doc.js          # 복수정답형 드릴 → 문제집 MD 런타임 직렬화 (과목N_복수정답형.md 산출물 대체)
  manual-viewer.js      # 학습안내서/매뉴얼 MD 뷰어
  modal-back.js         # 모달/오버레이 뒤로가기 닫기 — is-hidden 토글 감시 + 동일 URL 마커 pushState/popstate
  charts.js             # SVG 레이더/꺾은선 차트
  pdf-registry.js       # 참조자료 경로 매핑 (생성물 — 시험별 테이블, getRefTables())
  law-links.js          # 참조 문서 → law.go.kr 원문 링크 매퍼 (생성물 — content/lawdb.json + references.json lawRefs → build:pdf-registry)
  notice-check.js       # 식약처 고시 감시 — 다문서 배너·실시간 확인 버튼·상태 패널·참조 링크 현행본 보정
  glossary-query.js     # 용어집 인덱스 쿼리 API (getGlossaryIndex())
  html-viewer.js        # 외부 HTML 콘텐츠 뷰어
  reader-format.js      # 교재 본문 포맷터
  textbook-parser.js    # 교재 MD 파서
  markdown-parser.js    # 공통 MD 파서
  mermaid-utils.js       # Mermaid 다이어그램 설정
  mermaid-render.js      # Mermaid 지연 로딩 + 컨테이너 렌더링 + 다이어그램 확대 모달 (reader/search/manual 공용)
  image-zoom.js          # 교재 본문 이미지(.reader-img) 라이트박스 확대 모달
  pwa-manifest.js        # 시험별 동적 PWA 매니페스트 (클래식 스크립트 — 빌드 산출물 manifest.<id>.webmanifest 실제 파일로 링크 교체 + 문서 제목·설명·apple-mobile-web-app-title 갱신, blob: 금지)
  keyword-index.js      # 교재 셀→참조자료 키워드 매핑 (시험별 — 자동 생성)
  web-vitals.js         # Core Web Vitals 모니터링
  sha256.js             # 안정적 ID 해시
  utils.js              # 공통 유틸리티 (shuffle·todayKey·getChosung 등)
  types.js              # 중앙 JSDoc 타입 정의 모듈 (@spec none)
  storage-keys.js       # localStorage 키 중앙 관리
  paths.js              # 파일 경로 상수 중앙 관리 (시험 루트 인지형)
  exam-context.js       # 활성 시험 해석/전환, scopedKey 네임스페이스, hasFeature, getExamAppName(시험별 앱 이름 — exams.json appName)
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
  pwa-install-capture.js # beforeinstallprompt 조기 캡처 + SW 조기 등록 (<head> 즉시 실행, 클래식 스크립트)
  app-version.js        # 앱 버전 접근·표시 포맷터 (window.APP_VERSION → formatAppVersion)
  whats-new.js          # 새 버전 변경 이력 알림 (APP_VERSION 비교 → 모달, 설정 "변경 이력" 재열람)
  onboarding.js         # 첫 방문 시작 안내 모달 (학습 데이터 없는 최초 방문 1회, 설정에서 재열람)
  feedback.js           # 의견 수신 — 설정 "의견 보내기" 모달, ?src= 유입 추적, 익명 insert, 오프라인 큐
  pro-upgrade.js        # Pro 안내 — feature-plan.json 로드, PRO 배지(data-pro-feature) 제어, 한도 초과 업그레이드 모달, Free/Pro 플랜 비교 모달 (showPlanCompare — 설정 '플랜 안내')
  usage-stats.js        # 로컬 사용 카운터 (ROAD-L5) — 뷰·액션 횟수를 기기 단위(익명 device_id) localStorage에 누적, Pro 후보 액션 20회 판정, 설정 '내 사용 통계' 모달
  theme-init.js         # 테마 초기화 (즉시 실행)
  theme-toggle.js       # 테마 토글 UI
  ui-mode.js            # 학습/실무 UI 모드 전환 (ui_mode 전역 키, 학습 도구 접이식)
  supabase-config.js    # Supabase 프로젝트 URL·Publishable key (공개 설계상 키)
  supabase-client.js    # Supabase lazy init — vendor/supabase UMD 동적 로드
  auth-view.js          # 계정/로그인 모달 (이메일+PW·회원가입·매직링크)
  sync.js               # 클라우드 스냅샷 동기화 (sync_snapshots push/pull, dirty 훅·디바운스·충돌 확인, 고객 키 제외, Pro entitlement 게이트)
  globals.d.ts          # 전역 타입 선언 (jsconfig checkJs용)
  package.json          # {"type":"module"} — src/ ESM 선언
  config/
    timing.js           # 타이밍 상수 (PWA 프로브, 스와이프 임계값 등)
    cache.js            # 캐시 설정 상수
  views/                # 뷰 컨트롤러 (35개)
    navigation.js       # 뷰 전환 유틸 (switchView)
    textbook-reader.js  # 교재 리더 (본문 + 참조자료)
    reader-ref-links.js # 참조자료 링크 생성·프리뷰·클릭 위임 (textbook-reader.js에서 분리)
    reader-toolbar.js   # 교재 리더 툴바·독서 설정·스크롤 이벤트 (textbook-reader.js에서 분리)
    reader-audio.js     # 오디오북 플레이어
    textbook-search.js # 교재 검색 (역색인)
    quiz.js             # 기출 퀴즈
    quiz-wrong-cause.js # 오답 원인 태깅·재학습 액션 (quiz.js에서 분리)
    flashcard.js        # 3D 플래시카드
    daily-challenge.js  # 데일리 챌린지
    dashboard.js        # 대시보드 + 맞춤학습 뷰 (통계·히트맵·개인화 진단 카드)
    trainer.js          # 스마트 훈련소 허브 (재수출)
    trainer-calc-practice.js  # 계산 연습기
    trainer-ingredients.js    # 원료 배합 챌린지
    trainer-drills.js   # O/X 드릴 + 드릴 공통 오케스트레이션
    trainer-drill-combo.js # 복수정답형(combo) 드릴 (trainer-drills.js에서 분리)
    pomodoro.js         # 뽀모도로 타이머
    exam-simulator.js   # 실전 모의고사 시뮬레이터
    exam-sim-state.js   # 시뮬레이터 상태
    exam-sim-review.js  # 시뮬레이터 결과 리뷰
    exam-sim-weak.js    # 오답 모의고사 (exam-simulator.js에서 분리)
    exam-select.js      # 시험 선택/전환 뷰
    dictionary.js       # 지식DB 사전 (스키마 드리븐 — manifest.knowledge → registry.knowledge)
    study-calendar.js    # 학습 캘린더/목표 뷰
    glossary-renderer.js # 용어집 렌더링
    event-listeners.js  # 이벤트 리스너 일괄 바인딩
    formula.js          # Formula OS 뷰 — 배합 계산기, 추천, My 포뮬러, 서브내비 칩, 인쇄·JSON 공유
    formula-recommend.js # 추천 베이스·원료 패널 + 맞춤 규칙 UI (formula.js에서 분리)
    formula-batch.js    # Formula OS — 조제 기록(배치) 목록·폼·상세 패널
    formula-customer.js # Formula OS — 고객 관리 패널 (카드·상담 이력·역참조)
    formula-material.js # Formula OS — 원료 장부 패널 (기한 배지·경고)
    formula-compliance.js # Formula OS — 법규 준수 체크리스트 + 법령 MD 링크
    formula-print.js    # Formula OS — 인쇄 빌더 (조제 기록지·라벨·안내문)
    backup.js           # 백업/복원
    offline-detection.js # 오프라인 감지 (app.js에서 분리)
css/                    # 스타일시트 모듈 (base.css, reader.css, app-responsive.css, reader-extras.css, reader-mermaid.css, trainer.css, exam.css, dashboard.css, study.css, study-calendar.css, formula.css, print.css, ui-overlay.css, html-viewer.css — @import 순서가 캐스케이드, style.css 참조)
content/                # 시험 콘텐츠 컨테이너
  exams.json            # 시험 레지스트리 (멀티시험 엔트리 — 멀티시험 구조 섹션 참조)
  lawdb.json            # 공용 법령DB — law.go.kr 메타데이터 SSOT (id·slug·type·matchKeys·watch). 시험별 사용 목록은 references.json.lawRefs가 지정 → build:pdf-registry가 src/law-links.js 생성
  exams/cosmetic/       # 기본 시험 콘텐츠 루트 (contentRoot)
    manifest.json       # 과목/교재/문제은행 선언 + knowledge(사전 뷰 엔티티 스키마)
    references.json     # 참조자료 매핑 설정 + lawRefs(법령 링크 대상) + noticeCore(고시 감시 기준 문서)
    law_verified.json   # check_laws.py 수동 검증값 {"문서명": ["번호","시행일","판정"]}
    교재/                # 4과목 MD 파일 (표준형 4 + 이야기형 4 = 8파일, 총 19챕터 — 과목별 2·5·5·7)
    문제은행/            # 과목별 문제은행 MD
    참조자료/            # 법령고시/별표/참조자료 — PDF는 공통·과목1~4 폴더, MD 변환본은 ref_md/과목N/{문서}/{문서}.md (과목 폴더가 귀속의 진실)
      원료/              # 원료 참조자료 MD — GENERATED-TABLE 표는 knowledge/ingredients.json에서 빌드 재생성 (마커 밖 서술만 수기)
    knowledge/          # 지식DB SSOT — ingredients.json (원료 1,402종 items + meta 버전·이력, db_version.json 계승)
    audiobook/          # 오디오북 MP3 산출물 (생성 스크립트는 ref-pipeline/audiobook/)
    number-drills/      # 숫자 암기 드릴 JSON
  exams/<id>/           # 추가 시험도 동일한 내부 구조 (대칭)
data/                   # 빌드 생성 번들
  exams.js              # 전역 시험 목록 (window.EXAMS_LIST)
  audio_manifest.js     # 전역 오디오 매니페스트 (시험 id 키 분리)
  version.js            # window.APP_VERSION — 배포 스탬프와 동기화
  release-notes.json    # 사용자용 변경 이력 진실 소스 (notes:draft → JSON 편집 → deploy)
  release-notes.js      # window.RELEASE_NOTES — 생성 파일 (직접 편집 금지)
  docs_md/              # 앱 공용 문서 번들 (현재 비어 있음 — 인앱 문서는 전부 시험별, MV-04)
  exams/cosmetic/       # 기본 시험 데이터 루트 (dataRoot: registry.js, subjects/, exams/, drills/, study_md/, docs_md/, id_migration.js 등)
  exams/<id>/           # 추가 시험 데이터 루트 (동일 구조)
tools/                  # 빌드·검증 스크립트
  build/                # 데이터 파이프라인 (manifest → registry + 해시 번들)
  check/                # 검증·감사 스크립트 (check_*·audit_*·verify_shell_assets·coverage_merge)
  lib/                  # 공용 스캔·파싱 라이브러리 (trace_scan.js)
  _archive/             # 일회성·이력 스크립트 보관
  sync_citation_lines.js # 문제은행 인용 링크 라인번호 동기화 (교재 변경 시 — 대상 파일 없으면 미발견으로 실패)
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

- **시험 레지스트리**: `content/exams.json` → `data/exams.js` 번들(`window.EXAMS_LIST`, `npm run build:data`에 포함). 각 시험 엔트리: `id`, `name`, `appName`(시험별 앱 이름 — 브랜드면 표기), `title`/`logoMain`/`logoSub`(브랜딩), `desc`, `icon`, `year`, `default`, `contentRoot`, `dataRoot`, `registryBundle`, `registryGlobal`, `features`(기능 플래그). **`year`가 시험 연도의 유일한 진실 소스(SSOT)** — `build:exams-list`가 각 시험의 `manifest.json` `contentYear`와 `index.html`·`manifest.webmanifest`의 연도 텍스트(기본 시험 기준)로 자동 전파하므로, 연도 변경은 `exams.json`만 수정 후 `build:data` 재실행
- **시험별 루트 (대칭)**: 모든 시험이 `content/exams/<id>/`(manifest.json + references.json + 교재/문제은행/참조자료/audiobook 등)와 `data/exams/<id>/`(registry.js, subjects/, exams/, drills/, study_md/, docs_md/, supplements/, id_migration.js 등) 구조 — 기본 시험(cosmetic)도 예외 없음. `content/`·`data/` 루트에는 전역 파일만: `exams.json`/`exams.js`, `audio_manifest.js`(시험 id 키 분리), `docs_md/`(앱 공용 문서)
- **시험 컨텍스트**: `src/exam-context.js` — `contentPath()`/`dataPath()`(경로 해석), `hasFeature()`(기능 게이팅), `selectExam()`(전환 = `location.reload()`로 모듈 상태 리셋), `scopedKey()`(진도 네임스페이스 `<examId>:key`)
- **진도 격리**: `safeGetItem`/`safeSetItem` 등이 자동으로 시험 접두사 적용. 테마·리더 설정 등 `GLOBAL_KEYS`만 비네임스페이스. 백업 파일은 비접두사 논리 키(시험 간 호환)
- **새 시험 추가 절차**: ① `content/exams/<id>/`에 manifest.json + references.json + 교재/문제은행 배치 — 법령 참조가 있으면 `content/lawdb.json`에 엔트리 + `references.json.lawRefs`·`noticeCore` 설정, 사전이 있으면 `manifest.knowledge` 스키마 선언 ② `content/exams.json`에 엔트리 추가 (`contentRoot`/`dataRoot`/`registryBundle`/`registryGlobal` 지정 — 비기본 시험은 `registryGlobal: "DATA_REGISTRY_<id>"`) ③ `npm.cmd run check:content -- --build` → 끝 (앱 로직 변경 불필요). 상세: `docs/dev/design/MULTI_EXAM_DB_DESIGN.md`
- **기능 플래그**: `features`에 없는 기능은 `data-feature` 속성/`hasFeature()`로 자동 숨김 — 성분사전·원료배합·계산연습·오디오북·참조자료 등 도메인 특화 기능
- **Node 도구**: `EXAM_ID`/`EXAM_CONTENT_ROOT`/`EXAM_DATA_ROOT` env로 대상 시험 지정 (예: `EXAM_ID=<id> node tools/build/index.js`)
- **Python 도구**: ref-pipeline 전 스크립트가 `ref-pipeline/_exam_root.py`로 동일 순서 해석 — `--exam` 인자 > `EXAM_CONTENT_ROOT` > `EXAM_ID` > exams.json default (예: `python ref-pipeline/check_laws.py --exam <id>`)

## 구조 변경 시 문서 갱신 규칙

- 디렉터리/파일 이동·삭제·추가 시 경로를 참조하는 문서를 함께 갱신: `README.md`·`AGENTS.md` 디렉터리 트리, `docs/dev/ARCHITECTURE.md` 트리·변경 매트릭스, `docs/README.md` 인덱스, 관련 런북(`docs/dev/runbooks/CONTENT_WORKFLOW.md`, `docs/dev/runbooks/TEXTBOOK_REPLACEMENT_RUNBOOK.md`, `ref-pipeline/README.md`)
- 갱신 후 `npm.cmd run check:docs` 통과 필수 — 문서 내 스테일 경로 참조를 자동 탐지 (`check:content`에도 통합돼 자동 실행)
- 계획/미구현 경로·이력 서술 등 의도적 참조는 `tools/config/docs_paths_allowlist.json`에 `reason`과 함께 등록

## 요구사양 ID 체계 (SPEC ID)

- `docs/dev/SPEC.md`의 기능/비기능/데이터 요구사항은 **접두사+번호 ID**로 식별 (예: `Q-05`, `FB-01`, `UX-NAV-07`). 접두사는 절별 유일 — 신규 기능은 SPEC에 먼저 ID를 부여한다.
- ID → 구현 매핑은 `docs/dev/ARCHITECTURE.md` "🔗 요구사양 추적 (SPEC ID 매트릭스)" 절 참조.
- 다른 dev 문서는 헤더에 `> **관련 SPEC ID**: XX-##` 행으로 자신이 다루는 요구사항을 표기한다. 복수 ID 나열 구분자는 `,` `·` `/` 모두 허용 (`FO-24/RR-19` 가능 — 단 접두사 생략형 `FO-24/25`는 비지원). CHANGES.md·커밋 메시지에서도 관련 ID 인용 권장.
- **코드 추적**: 소스/테스트 파일의 헤더 주석에 `// @spec FB-01~08` (JS/TS), `/* @spec TH-01 */` (CSS), `# @spec CS-03` (Python), `<!-- @spec S-01 -->` (HTML) 형태로 구현 범위를 표기. SPEC 미해당 인프라 파일은 `@spec none (사유)` 표기로 "의도적 미커버"를 명시. 비자명한 로직에는 함수 직상단에 `// @spec UX-NAV-07 — 이유` 형태의 선택 태그 권장.
- `npm.cmd run check:specrefs`로 양방향 검증 — 코드가 참조하는 ID가 SPEC에 없으면 실패(ID 삭제·개명 시 스테일 참조 탐지), SPEC ID가 어떤 코드에도 없으면 커버리지 공백 경고. `check:content`에 통합됨.

## 문서 ID 체계 (DOC ID)

- 모든 마크다운 문서(`docs/`, `ref-pipeline/`, 루트 `README.md`·`AGENTS.md`)는 상단에 `> **문서 ID**: DOC-XX-NN` 헤더를 갖는다.
- 접두사는 영역별 구분 — `DOC-ROOT`(루트) · `DOC-IDX`(인덱스) · `DOC-DEV`(수위 문서) · `DOC-DSN`(design/) · `DOC-REF`(reference/) · `DOC-RBK`(runbooks/) · `DOC-USR`(user/) · `DOC-BIZ`(business/) · `DOC-ARC`(report_archive/) · `DOC-PPL`(ref-pipeline/).
- ID → 파일 매핑 레지스트리는 `docs/README.md` "문서 ID 레지스트리" 절 — 신규 문서는 해당 영역 다음 번호를 채번해 표에 등록한다.
- `npm.cmd run check:docs`(check_doc_ids.js 포함)가 헤더 누락·형식 오류·ID 중복을 검증한다.

## 추적 매트릭스 (TRACE MATRIX)

- 요구사양(SPEC ID) ↔ 문서(DOC ID) ↔ 소스·테스트(@spec) ↔ 보고서(report_archive 헤더)의 유기적 추적은 `docs/dev/TRACE_MATRIX.md`(DOC-DEV-04)가 담당 — `npm.cmd run build:trace`로 재생성하는 자동 산출물(직접 편집 금지).
- 연결 규약: 각 문서 헤더의 `> **관련 SPEC ID**: XX-##` 행 + 코드의 `@spec` 태그가 원천. `check:specrefs`가 양쪽 모두 SPEC 존재 여부를 검증한다.
- SPEC ID 변경·문서 추가·@spec 태그 변경 후에는 `npm.cmd run build:trace`로 매트릭스를 갱신한다. `npm.cmd run check:trace`가 입력 해시로 신선도를 검증(check:content 포함) — 스테일이면 실패.
- 활용 도구: `node tools/trace.js Q-05`(요구사항 도시어 — 문서·소스·테스트·보고서 즉시 조회), `node tools/impact_tests.js [파일…]`(변경 파일 → 영향 요구사항·권장 테스트 역산 — 인자 없으면 미커밋 변경 자동 분석).

## 코드 스타일 및 규칙

### 공통
- **로컬 폴더명·절대 경로 하드코딩 금지** — `C:\Project\...` 같은 로컬 절대 경로는 폴더 리네임·멀티 머신에서 깨짐. 코드는 `__file__`/`import.meta` 기준 상대 경로로 해석하고, 문서의 파일 참조는 저장소 루트 상대(`@/src/...`)로 표기. GitHub 리포 slug(`skygoldlee-cyber/passory`)·Vercel 프로젝트명 같은 원격 식별자는 예외.

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
7. `npm run deploy`의 배포 후 스모크 자동 통과 확인 (200·sw.js·APP_VERSION 스탬프 — passory.vercel.app)

## 주의사항

- **PowerShell 환경**: `&&` 연산자 사용 불가 → `;` 사용. `npm` → `npm.cmd`.
- **Mermaid `!important`**: `css/reader.css`의 Mermaid 규칙 `!important`는 제거 금지 (Mermaid 라이브러리 인라인 스타일 덮어쓰기용)
- **콘텐츠 편집 후**: `npm.cmd run build:data` 실행 후 `data/` 번들 커밋 필요. `check:content`(CI의 `--content-only` 단계 포함)가 스냅샷 drift·인용 대상 파일 부재·미등록 md·구조 드리프트를 차단 — 교재 파일 추가/이름 변경/삭제 시 `node tools/sync_textbook_files.js`(`--rename` 포함)로 선언·프리캐시·인용 경로를 먼저 동기화할 것
- **CSP**: `vercel.json`에 `script-src 'self'` (인라인 스크립트 금지)
- **DOM 테스트**: `tests/dom/` — Phase 1~5 전 뷰 커버 (매트릭스·작성 규칙은 `docs/dev/design/DOM_TEST_DESIGN.md`, 파일별 목록·정책은 `docs/dev/reference/TESTING.md`)

## 관련 문서

- `docs/dev/ARCHITECTURE.md` — 시스템 아키텍처 상세
- `docs/dev/runbooks/DEPLOYMENT_GUIDE.md` — 배포 가이드
- `docs/dev/runbooks/VERIFY_DEPLOY_PIPELINE.md` — 전체구조 점검→배포 게이트 파이프라인 (신선도 게이트·실패 복구 표)
- `docs/dev/runbooks/CONTENT_WORKFLOW.md` — content 변경 시 작업 절차 가이드
- `docs/dev/CHANGES.md` — 변경 이력
- `docs/dev/reference/TESTING.md` — 테스트 가이드
- `docs/dev/reference/ENGINEERING_PRACTICES.md` — 소프트웨어 공학 요소 정리 (SSOT·신선도 게이트·추적성)
- `docs/dev/design/DOM_TEST_DESIGN.md` — jsdom UI 시나리오 테스트 설계
- `docs/dev/design/SUPABASE_DESIGN.md` — 계정·클라우드 동기화 설계안 (Phase 1~2 구현 완료, Pro entitlement는 미구현)
- `docs/dev/runbooks/TEXTBOOK_AUTHORING_GUIDE.md` — 교재 작성 가이드
- `docs/dev/reference/NUMBERING_SYSTEM.md` — 교재 번호체계 가이드 (십진법)
- `docs/dev/design/QUESTION_SCHEMA_DESIGN.md` — 문항 스키마 + 복수정답형 변환 파이프라인 설계
- `docs/dev/design/FORMULA_OS_WORKFLOW_DESIGN.md` — 조제관리사 9개 업무 전체 커버리지 확장 설계안 (고객·배치·원료장부·안내문)
- `docs/dev/runbooks/COMBO_GENERATION_GUIDE.md` — 복수정답형 문항 생성 절차·품질 게이트·수치 조정 가이드
- `docs/dev/reference/COMBO_STUDY_STRATEGY.md` — 복수정답형 학습 전략 (전략→기능 매핑 포함)
- `content/exams/cosmetic/docs/user_manual.md` — 학습 매뉴얼 (시험 대비 — 시험별 문서)
- `content/exams/cosmetic/docs/formula_manual.md` — 실무 매뉴얼 (Formula OS — 시험별 문서)
