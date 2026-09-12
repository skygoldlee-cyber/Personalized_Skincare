# AGENTS.md — AI 에이전트 프로젝트 가이드라인

> 이 파일은 Devin, Claude Code, Cursor 등 AI 코딩 에이전트가 프로젝트에 진입했을 때 참조하는 가이드라인입니다.

## 프로젝트 개요

**Cosmetic Pass Master** — 맞춤형화장품 조제관리사 자격시험 대비 웹 학습 플랫폼.

- 순수 HTML/CSS/JavaScript (Vanilla ES Modules, 프레임워크 없음)
- PWA (Service Worker 오프라인 캐시, 설치 가능)
- Vercel 정적 배포 (백엔드 없음)
- 사용자 진행 상황은 localStorage에만 저장 (계정/로그인 불필요)

## 핵심 명령어

> **주의**: Windows PowerShell 환경. `npm`/`npx` 스크립트가 실행 정책으로 차단되므로 `npm.cmd`/`npx.cmd` 사용.

```powershell
# 테스트
npm.cmd test                          # 유닛 테스트 (node --test, 248개)
npm.cmd run test:dom                  # DOM 테스트 (Vitest + jsdom)
npm.cmd run test:all                   # 전체 테스트 (unit + parser + dom)

# 빌드
npm.cmd run build:data                 # content/*.md → data/ 번들 생성
npm.cmd run check:parser               # 빌드 파서 ↔ 런타임 파서 등가성 검증
npm.cmd run check:imports              # src/ 내 ES 모듈 import/export 교차 검증
npm.cmd run stamp:sw                   # sw.js CACHE_VERSION을 커밋 해시로 스탬프
npm.cmd run verify:assets              # SHELL_ASSETS/DATA_ASSETS 파일 존재 검증

# 로컬 서버
npm.cmd run serve                      # http://localhost:3000

# 배포
vercel --prod --yes                    # Vercel 프로덕션 배포

# 감사
npm.cmd run audit:cards                 # 카드 품질 자동 감사 (짧은 설명, 중복, 참조 링크 유효성)
```

## 디렉토리 구조

```
index.html              # App Shell (단일 HTML)
style.css               # CSS 진입점 (@import로 모듈 로드)
sw.js                   # Service Worker
manifest.webmanifest    # PWA 매니페스트
serve.js                # 로컬 개발 서버
src/                    # ES Modules
  app.js                # 메인 애플리케이션 로직 (초기화, 이벤트 위임, 라우팅)
  app-fallback.js       # ESM 로드 실패 시 자동 복구 (모바일 PWA 대응)
  router.js             # 뷰 라우터 (navigateToView, getViewTitles)
  navigation.js         # 뷰 전환 (switchView) — views/navigation.js
  state.js              # 전역 상태 + localStorage 저장 (saveProgress, safeGet/SetItem)
  ui-utils.js           # showToast, showConfirm, showGlobalLoading, trapFocus
  sanitize.js           # XSS 방어 (escapeHTML, safeTextWithBreaks)
  data-loader.js        # 온디맨드 콘텐츠 로더 (DataLoader)
  scratchpad.js          # 스크래치패드 캔버스 (계산 연습용)
  spaced-repetition.js  # SM-2 간격 반복 알고리즘
  study-aids.js         # 기출 필터, 숫자 암기표
  charts.js             # SVG 레이더/꺾은선 차트
  pdf-registry.js       # 참조자료 경로 매핑
  html-viewer.js        # 외부 HTML 콘텐츠 뷰어
  reader-format.js      # 교재 본문 포맷터
  textbook-parser.js    # 교재 MD 파서
  markdown-parser.js    # 공통 MD 파서
  mermaid-utils.js       # Mermaid 다이어그램 설정
  keyword-index.js      # 교재 셀→참조자료 키워드 매핑
  web-vitals.js         # Core Web Vitals 모니터링
  sha256.js             # 안정적 ID 해시
  utils.js              # 공통 유틸리티 (shuffle 등)
  storage-keys.js       # localStorage 키 중앙 관리
  paths.js              # 파일 경로 상수 중앙 관리
  pwa-install.js        # PWA 설치 프롬프트 설정
  theme-init.js         # 테마 초기화 (즉시 실행)
  theme-toggle.js       # 테마 토글 UI
  config/
    timing.js           # 타이밍 상수 (PWA 프로브, 스와이프 임계값 등)
    cache.js            # 캐시 설정 상수
  views/                # 뷰 컨트롤러
    textbook-reader.js  # 교재 리더 (본문 + 참조자료)
    reader-audio.js     # 오디오북 플레이어
    textbook-search.js # 교재 검색 (역색인)
    quiz.js             # 기출 퀴즈
    daily-challenge.js  # 데일리 챌린지
    dashboard.js        # 대시보드 (통계, 히트맵)
    trainer.js          # 스마트 훈련소 허브 (재수출)
    trainer-calc-practice.js  # 계산 연습기
    trainer-ingredients.js    # 원료 배합 챌린지
    pomodoro.js         # 뽀모도로 타이머
    exam-simulator.js   # 실전 모의고사 시뮬레이터
    exam-sim-state.js   # 시뮬레이터 상태
    exam-sim-review.js  # 시뮬레이터 결과 리뷰
    dictionary.js       # 용어집
    glossary-renderer.js # 용어집 렌더링
    backup.js           # 백업/복원
    offline-detection.js # 오프라인 감지 (app.js에서 분리)
    manual-viewer.js    # 학습안내서 뷰어
    exam-viewer.js      # 문제집 뷰어
css/                    # 스타일시트 모듈 (base.css, reader.css, reader-mermaid.css, trainer.css, exam.css, dashboard.css, study.css, print.css, ui-overlay.css, html-viewer.css)
content/                # 교재/문제은행/참조자료 Markdown 원본
  교재/                  # 4과목 20챕터 MD 파일 (표준형 20 + 이야기형 20)
  문제은행/              # 과목별 문제은행 MD
  참조자료/              # 법령원문/별표/참조자료 (HTML/MD)
  audiobook/            # 오디오북 MP3 + 매니페스트
  ingredients/          # 원료 데이터
data/                   # 빌드 생성 번들 (registry.js, subjects/, exams/, ingredients_data.js)
tools/                  # 빌드 스크립트
  build/                # 데이터 파이프라인 (manifest → registry + 해시 번들)
vendor/                 # 자체 호스팅 자산 (fonts/, fontawesome/)
tests/                  # 테스트
  unit/                 # node --test 유닛 테스트
  dom/                  # Vitest + jsdom DOM 테스트
docs/                   # 개발 문서
  dev/                  # 아키텍처, 배포 가이드, 변경 이력
  user/                 # 사용자 매뉴얼
```

## 아키텍처 핵심

1. **Zero-Backend**: 순수 프론트엔드, Vercel 정적 호스팅
2. **Vanilla ES Modules**: `<script type="module">`, import/export, 프레임워크 없음
3. **DataLoader 온디맨드**: `content/*.md`를 런타임 fetch + parseMarkdown으로 렌더링
4. **Service Worker**: Cache First (HTML/JS/CSS), DATA_CACHE (MD/참조자료, 배포 간 유지)
5. **이벤트 위임**: `data-click`/`data-arg` 속성 기반, CSP `script-src 'self'` 호환

## 코드 스타일 및 규칙

### JavaScript
- ES Modules (`import`/`export`), 클래식 스크립트는 데이터 파일/외부 라이브러리만
- 2-space 들여쓰기
- `window` 전역 노출: `data-click` 이벤트 위임을 위해 `app.js`에서 `window`에 핸들러 매핑
- 인라인 `onclick`/`oninput` 금지 (CSP 차단) → `data-click`/`data-input` 사용
- `element.style.display = '...'` 금지 → `classList.add/remove('is-hidden')` 사용
- `alert()`/`confirm()` 금지 → `showToast()`/`showConfirm()` 사용 (src/ui-utils.js)

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
2. `npm.cmd test` — 유닛 테스트 248개 통과 확인
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
- **DOM 테스트**: `tests/dom/backup.dom.test.js` — `showToast` 모킹 기반 10개 테스트 통과 (alert → showToast 교체 반영)

## 관련 문서

- `docs/dev/ARCHITECTURE.md` — 시스템 아키텍처 상세
- `docs/dev/DEPLOYMENT_GUIDE.md` — 배포 가이드
- `docs/dev/CONTENT_WORKFLOW.md` — content 변경 시 작업 절차 가이드
- `docs/dev/CHANGES.md` — 변경 이력
- `docs/dev/TESTING.md` — 테스트 가이드
- `docs/dev/TEXTBOOK_AUTHORING_GUIDE.md` — 교재 작성 가이드
- `docs/user/user_manual.md` — 사용자 매뉴얼
