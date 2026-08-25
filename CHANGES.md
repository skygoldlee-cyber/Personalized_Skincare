# 코드 리뷰 수정 내역 (1~12 순차수정)

> 대상: Personalized_Skincare (Cosmetic Pass Master) 배포판
> 작업일: 2026-08-23
> 검증: 모든 `src/*.js` `node --check` 통과 · `node tools/build/index.js` 재빌드 성공 ·
> registry↔번들 14개 실재 확인 · 비ASCII 콘텐츠 파일 0 · `vercel.json` JSON 유효.

## 🔴 높음

**#1 죽은 레거시 데이터 파일 배포 제거**
- `data/study_data.js`(946KB), `data/exam_data.js`(571KB) 삭제(어디에서도 로드 안 됨, ~1.48MB 절감).
- `.vercelignore`에 제외 규칙 추가 + 잘못된 주석("앱은 data/*.js 사용") 정정.

**#2 캐시 정책 수정 (`immutable` 오적용)**
- `vercel.json`: 해시 파일명 번들(`/data/subjects`, `/data/exams`, `/data/ingredients_data.*`)만 `immutable`.
- 비해시(`/src/*`, `/data/registry.js`, `/data/id_migration.js`, `/data/audio_manifest.js`, `/index.html`)는
  `max-age=0, must-revalidate`로 변경 → 재배포 후 구버전 JS 실행/SW 갱신 무력화 방지.
  (기존엔 `/data/(.*)` 블랭킷 immutable이 비해시 `registry.js`까지 덮던 문제도 함께 해소.)

**#3 `FOLDER_STRUCTURE.md` 최신화**
- 구 모놀리식 설명 → 실제 모듈러 구조(SSOT `manifest.json` → `tools/build` → `registry` + 해시 번들 →
  `data-loader` 온디맨드)로 전면 갱신. 데이터 흐름도/명령어/폴더표 정정. (문서 버전 2.0)

## 🟡 중간

**#4 `state.js` localStorage 접근 보호**
- `safeGetItem`/`safeSetItem` 래퍼 추가(try/catch). 본문 18개 접근(읽기9·쓰기9)을 전부 래퍼로 교체.
- 용량 초과/사파리 프라이빗/스토리지 비활성에서 저장·마이그레이션이 앱 흐름을 중단시키지 않음.

**#5 CSP·보안 헤더 + CDN 하드닝**
- `vercel.json`에 `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` 추가.
- `index.html` CDN 링크에 `crossorigin`/`referrerpolicy` 추가. SRI는 잘못된 해시가 아이콘을 깨뜨리므로
  **검증된 값만 넣도록 방법을 주석으로 안내**(현재 미적용).

**#6 CP949 파일명 슬러그화**
- 콘텐츠 md/html 38개를 `{순번}.{chapterKey}.md/html` ASCII 슬러그로 이관 + `manifest.json` 갱신.
- 재빌드로 검증: 카드/퀴즈 **수·ID 불변**(law 131/11, 맵 타깃 131/131·11/11), 표시 제목도 `#` H1 기반이라 불변.
  번들 해시 변경은 번들 내 `fileName`/`filePath` 메타가 새 이름으로 올바르게 갱신된 결과일 뿐 학습 데이터는 동일.
- 리눅스 CI/빌드의 `File does not exist`(CP949↔UTF-8 불일치) 원인 제거.

## 🟢 낮음

**#7 레거시 파서 제거** — `tools/parse_data.js`/`parse_exams.js`/`parse_ingredients.js` + `.ps1` 6종 삭제.
`tools/build/` 파이프라인으로 완전 대체. `MODULAR_DESIGN.md` 상태 갱신.

**#8 innerHTML 이스케이프 일관성 + 표시 버그 수정**
- 이스케이프 싱크(daily/weak/sim)로 가면서 `<br>`/`<strong>`을 미리 박아 **태그가 문자로 노출**되던
  생성부 8곳 정리(2283/2291/2359/2886/2888/3027/3054/3070): `<br>`→`\n`, `<strong>` 해제.
- 성분 해설의 `esc()` + 싱크 이중 이스케이프 제거(한 번만 이스케이프).
- raw 싱크(계산/성분 질문)는 의도된 HTML이라 유지하고 "의도된 HTML" 주석 명시.

**#9 `trainer-calc.js` 상단 주석 mojibake 복구** — 이중 인코딩 주석을 깨끗한 UTF-8로 재작성(코드는 원래 정상).

**#10 오프라인 감지 개선** — 연결성 프로브를 제3자 `www.gstatic.com/generate_204` →
**same-origin**(`./manifest.webmanifest?_probe=…`, no-store)로 교체. 지역 차단 시 오프라인 오탐 방지. CSP `connect-src`도 정리.

**#11 `id_migration.js` sunset 안내** — 지금은 유지(마이그레이션 필요). `index.html` 주석 + `.vercelignore`에
유예 후 안전 제거 절차 명시(state.js가 `typeof ID_MIGRATION_MAP === 'undefined'` 가드).

**#12 `app.js` 모놀리식 축소(안전 1단계 + 로드맵)**
- 순수 함수 `formatSectionContentForReader`(외부 상태 의존 0)를 `src/reader-format.js`로 분리(약 145줄↓),
  `index.html`에서 app.js보다 먼저 로드.
- 나머지는 브라우저 스모크 테스트가 필요해 **안전 분해 로드맵**을 `docs/APP_JS_DECOMPOSITION.md`로 문서화
  (전역 유지 원칙, 클러스터별 후보, 추출 체크리스트).

---

## 실제 저장소 적용 시 유의사항

1. 이 산출물은 **CP949 zip을 UTF-8로 복원한 작업본**입니다. 실제 git 체크아웃에 적용할 때:
   - 콘텐츠 파일 **이름 변경**(38개)과 **삭제**(구 데이터 2 + 레거시 파서 6)를 반영하세요.
   - `data/` 번들은 재빌드 산출물이므로, 본인 환경에서 `node tools/build/index.js` +
     `node tools/generate_migration_map.js`를 다시 돌려 생성하는 것을 권장합니다(내용은 동일해야 함).
2. `vercel.json`의 CSP는 인라인 스크립트/핸들러 때문에 `script-src 'unsafe-inline'`을 포함합니다.
   장기적으로 인라인 제거 후 nonce/hash 기반으로 강화 가능.
3. ~~FontAwesome SRI는 `cdnjs.com/libraries/font-awesome/6.4.0`의 "Copy SRI" 값으로 채워 넣으세요.~~
   → **(2026-08-24 폐기)** FontAwesome을 자체 호스팅([`vendor/fontawesome/`](vendor/fontawesome/))으로 전환하여 CDN/SRI가 더 이상 필요하지 않습니다. 모바일 아이콘 깨짐(네모) 문제 해결 목적. CSP의 `font-src`/`style-src`에서 cdnjs도 제거되었습니다.

---

## 후속 수정 내역 (2026-08-24)

### 모바일 오프라인 배너 오탐(false offline) 종합 수정 — sw `v10` → `v11`

모바일(Android Chrome)에서 인터넷이 정상인데도 "인터넷 연결이 끊어졌습니다" 배너가 로드 수 초 후 나타나 계속 유지되던 문제를 3차에 걸쳐 수정. 상세 설계는 [`docs/ARCHITECTURE.md` "오프라인 감지 설계"](docs/ARCHITECTURE.md) 참조.

- **1차 (v8)**: 프로브 신뢰성 개선 — 연속 실패 임계(`FAIL_THRESHOLD=2`), 타임아웃 4s→6s, `res.ok` 검사, SW `?_probe=` 바이패스.
- **2차 (v10)**: 프로브 대상을 전용 `ping.txt`(내용 `1`)로 교체, `cache: 'no-store'` 제거(일부 웹뷰/보안정책과 충돌해 fetch 자체가 실패하는 사례 방지), `navigator.onLine` 사전 차단 제거, 적응 주기(온라인 30s/오프라인 5s), 슬립 복귀 10초 유예. `serve.js`에 `.txt` MIME 추가.
- **3차 (v11)**: **`navigator.onLine === true` 억제 가드 추가** — 온라인이면 프로브 없이 신뢰하여 콜드스타트/저속망에서의 일시적 프로브 실패로 인한 가짜 배너를 원천 차단. `onLine === false`일 때만 ping.txt 프로브로 최종 확인하는 비대칭 신뢰 구조로 확정.
- **4차 (v12)**: **SW 프로브 프록시 전환** — PWA standalone(iOS WebKit/일부 웹뷰)에서 `?_probe=` 요청을 SW가 단순 `return`으로 바이패스하면 샌드박스가 `respondWith` 없는 fetch를 차단해 프로브가 항상 실패하던 문제 수정. `event.respondWith(fetch(request))`로 명시적 네트워크 프록시.
- **5차 (v13)**: **Standalone 인지 임계치 강화** — 설치형 PWA는 `onLine === false` 오탐 빈도가 높아 판정을 더 보수적으로. `FAIL_THRESHOLD` 일반 3회/standalone 4회, `PROBE_TIMEOUT` 8초, 슬립 복귀·콜드스타트 유예 15초(`WAKE_GRACE_MS`), 첫 프로브 5초 지연, `online` 이벤트 시 즉시 배너 해제.

### 사용자 매뉴얼 및 요약집 런타임 MD 뷰어 전환 및 다이어그램 오류 수정 (sw `v16` → `v17`, 2026-08-24)

- **배경**: 기존 개별 정적 HTML 방식(`user_manual.html`, `study_summary.html`)을 폐기하고, 마크다운 원본(`docs/*.md`)을 직접 읽어 렌더링하는 인앱 뷰어([`src/manual-viewer.js`](src/manual-viewer.js))를 통합 구축함.
- **다이어그램 오류 증상**: 런타임 뷰어로 전환되면서, 매뉴얼에 작성된 Mermaid 다이어그램이 렌더링되지 못하고 `graph TD …` 텍스트 그대로 노출되는 현상 발생.
- **원인**:
  - `index.html`에 Mermaid 라이브러리가 포함되지 않았으며, CSP 정책(`script-src 'self'`)으로 인해 외부 CDN 로드가 불가능했음.
  - 마크다운 파싱 결과물을 DOM에 삽입한 후에 `mermaid.run()`을 호출하여 다이어그램 렌더링을 지시하는 핸들러 및 테마 전환 대응 로직이 누락됨.
- **해결**:
  - `index.html`에 로컬 자체 호스팅된 [`vendor/mermaid/mermaid.min.js`](vendor/mermaid/mermaid.min.js) 로드를 `defer`로 등록함.
  - `src/manual-viewer.js` 내에 `_renderMermaid()`를 구현해 `.mermaid` 요소를 찾아 렌더링하도록 지시하고, 테마(`light-theme` 유무)에 맞춰 `dark` / `default` 설정을 자동 적용함.
  - `themechange` 이벤트 핸들러를 추가해 테마 변경 시에도 다이어그램이 깨지지 않고 실시간 갱신 및 재렌더링되도록 수정함.
- **오프라인 및 SW**:
  - 오프라인/PWA 지원을 위해 `sw.js`의 `SHELL_ASSETS` 목록에 `vendor/mermaid/mermaid.min.js`를 등록하고 `CACHE_VERSION`을 **`v17-20260824`**로 상향 적용함.

### 문제집 뷰어 런타임 전환 — 정적 HTML 폐지 (sw `v13` → `v15`, 2026-08-24)

- **배경**: `exams/*.html` 정적 문제집 9종(~220MB)은 Vercel 100MB 제한으로 배포 불가 → 런타임 MD 변환 뷰어로 대체하기로 결정.
- **1차 시도 실패**: 팝업(`window.open` + `document.write`) 방식 뷰어에서 "문제집을 불러올 수 없습니다 / Failed to fetch" 오류. `about:blank` 문서는 `<base>`가 없어 상대 경로가 전부 404이고, iOS PWA/팝업 차단 환경은 `window.open`이 `null` 반환.
- **최종 해결 — 인앱 전체화면 오버레이**:
  - [`src/exam-viewer.js`](src/exam-viewer.js) 신규: `exams/*.md`를 런타임 fetch → 자체 MD→HTML 변환(`_mdToHtml`) → `#exam-overlay` 오버레이 렌더링. 팝업/별도 HTML 문서 불필요.
  - 목차(TOC) 자동 생성, 인쇄/PDF 버튼, `Esc`·모바일 뒤로가기(`history.pushState`) 닫기.
  - sessionStorage 캐시(`exam_md_cache_v2_`, 24h TTL) — 재염 시 네트워크 0회.
- **file:// 지원 번들**: [`tools/build_exam_bundles.js`](tools/build_exam_bundles.js)가 `exams/*.md` → `data/exams_md/<stem>.js`(전역 `window.__EXAM_MD__`) 생성. `file://`의 fetch 차단을 클래식 `<script>` 주입으로 우회. http(s)는 live fetch 우선 + 번들 폴리백.
- **삭제**: `exams/*.html` 9종, `exams/exam-style.css` (오버레이가 스타일 자체 주입). `.vercelignore`의 `!exams/*.html` 예외 규칙 폐기.
- **변환기 수정**: 코드펜스 보호(`FENCE_TOKEN`), 이탤릭 정규식이 목록 마커(`* `)를 오식하던 버그, blockquote의 `>` 엔티티 판별.
- **SW**: `CACHE_VERSION` v13 → **v15-20260824**. `.md` Cache First + `/data/` Cache First(번들 포함).
- **검증**: 변환 단위 테스트 16/16, 오버레이 로직 테스트 11/11, E2E 캐시(첫 염 fetch 1회→재염 0회) 통과.
- **운영 노트**: `exams/*.md` 편집 후 `node tools/build_exam_bundles.js` 실행 + `data/exams_md/*.js` 커밋 필요.
- **기타**: `.vscode/settings.json` 추가 — `.vercelignore` 등 ignore 파일을 JS로 오인해 발생하던 가짜 진단 제거.

### Phase 1: 보안 하드닝(CSP 강화) 및 웹폰트 자체 호스팅 완료 (sw `v18`, 2026-08-24)

- **인라인 이벤트 핸들러 onclick 전면 제거**:
  - `index.html` 내부에 존재하던 67개의 인라인 `onclick` 속성을 전부 삭제했습니다.
  - 이를 대체하기 위해 각 엘리먼트에 `data-click="함수명"` 및 `data-arg="인자값"` 속성을 주입하고, [`src/app.js`](src/app.js)의 `setupEventListeners()`에서 전역 클릭 위임(Event Delegation) 패턴을 통해 window/네임스페이스 하위의 메서드를 안전하게 동적 바인딩 및 실행하도록 일괄 개선했습니다.
- **인라인 script 태그 분리 및 이관**:
  - HTML 헤더에 존재하던 테마 깜빡임(FOUC) 방지 인라인 스크립트를 [`src/theme-init.js`](src/theme-init.js) 외부 파일로 격리했습니다.
  - HTML 바닥 부분에 존재하던 PWA 설치 프롬프트 및 테마 전환/동기화 로직 인라인 스크립트들을 모두 제거하고, [`src/app.js`](src/app.js)에 `setupPWAInstall()` 및 `setupThemeToggle()` 함수로 선언 및 병합하여 `initApp()` 단계에서 programmatic하게 초기화되도록 이관했습니다.
  - 이를 통해 `index.html` 내부의 모든 실행 가능한 인라인 JS 코드를 완전히 차단했습니다.
- **보안 CSP 규격 강화**:
  - 모든 인라인 스크립트가 배제됨에 따라 [`vercel.json`](vercel.json) 헤더 설정의 Content Security Policy에서 `script-src` 정책의 `'unsafe-inline'` 지시어를 영구 제거하고 **`script-src 'self'`** 로 하드닝을 완료했습니다.
- **구글 웹폰트 로컬 자체 호스팅**:
  - 오프라인 환경 기동성 제고를 위해 Google Fonts CDN 의존성을 제거하고 `Noto Sans KR` 및 `Outfit` 서체를 로컬화했습니다.
  - google-webfonts-helper API를 통해 Noto Sans KR(5개 가중치) 및 Outfit(4개 가중치)의 경량화된 `.woff2` 단일 폰트 파일들을 다운로드하여 [`vendor/fonts/`](vendor/fonts/) 에 배치하고, `@font-face`를 정의한 [`vendor/fonts/fonts.css`](vendor/fonts/fonts.css)를 연동했습니다.
  - `vercel.json` CSP 설정의 `font-src` 및 `style-src` 에서 외부 구글 폰트 도메인들(`fonts.googleapis.com`, `fonts.gstatic.com`)을 완전히 걷어냈습니다.
- **서비스 워커 캐싱 전략 보강**:
  - [`sw.js`](sw.js)의 `SHELL_ASSETS` 프리캐시 목록에 신설된 `src/theme-init.js` 및 `vendor/fonts/*` 자산들을 모두 추가하였습니다.
  - 캐시가 클라이언트에 즉시 갱신되도록 `CACHE_VERSION`을 **`v18-20260824`**로 상향하였습니다.

### Phase 2: native ES Modules (ESM) 모듈 전환 및 고아 ID 정리 완료 (sw `v19`, 2026-08-24)

- **native ES Modules (ESM) 아키텍처 도입**:
  - `index.html`에서 기존 11개의 `<script>` 태그들을 들어내고 메인 ESM 엔트리 포인트인 `<script type="module" src="src/app.js"></script>`만 호출하도록 통합 정돈했습니다. (데이터 파일 및 외부 Mermaid 라이브러리는 최적화를 위해 클래식 스크립트 유지)
  - `src/` 내 모든 자바스크립트 파일들(`utils.js`, `sanitize.js`, `reader-format.js`, `trainer-calc.js`, `scratchpad.js`, `charts.js`, `state.js`, `data-loader.js`, `exam-viewer.js`, `manual-viewer.js`)에 `import`/`export` 문법을 도입해 모듈 스코프와 명시적 종속 관계를 확립했습니다.
- **이벤트 위임 지원용 전역 노출 바인딩**:
  - ESM 전환 시 모듈 내의 함수들이 비공개 스코프에 갇히는 문제를 우려하여, `app.js` 최하단에 `window` 전역 객체로 `ManualViewer`, `ExamViewer`, `DataLoader` 및 30여 개의 클릭 핸들러 함수들을 매핑해 주는 바인딩 테이블을 추가하여 기존 `data-click` 기반 이벤트 위임 동작과의 완벽한 하위 호환성을 확보했습니다.
- **고아 ID 정리 데드 코드 소거**:
  - `src/state.js` 내의 `loadProgress()` 초기화 부분에서 dynamic lazy loading 도입으로 인해 영구적으로 사용되지 않게 된 `STUDY_DATA` 판정용 레거시 고아 ID 클리닝 조건문을 완전히 삭제했습니다. (동적 데이터 로딩 완료 시점의 개별 정리 로직은 `DataLoader`에 의해 안정적으로 기동 중)
- **서비스 워커 프리캐시 버전 상향**:
  - 소스코드 및 모듈 로딩 아키텍처 개편에 대응하여 서비스 워커의 `CACHE_VERSION`을 **`v19-20260824`**로 상향 적용하여 클라이언트 캐시 갱신을 강제하였습니다.

---

## 🏛️ 후속 수정 및 아키텍처 개편 내역 (2026-08-25)

### 1. 교재 데이터 및 오디오북 폴더 이동 및 정리 (sw `v23`)
- **폴더 이전**: 프로젝트 루트에 무질서하게 흩어져 있던 `audiobook/` 폴더와 `ingredients/` 폴더의 데이터가 모두 교재 콘텐츠의 일부임을 명확히 하기 위해 `content/` 하위로 위치를 통합하였습니다 (`content/audiobook/`, `content/ingredients/`).
- **참조 최적화**: 
  - `data/audio_manifest.js`의 19개 챕터 MP3 파일 상대 경로 접두사를 `content/audiobook/mp3/...` 형태로 동기화했습니다.
  - `.gitignore` 및 `.vercelignore` 내 배포 제외 및 필터 규칙을 최신 디렉터리 경로에 맞춰 일제히 갱신하였습니다.
- **문서 수정**: 5개 주요 기술 문서 내 오디오북 폴더 참조 경로를 일제히 `content/audiobook/`으로 수정했습니다.

### 2. 한국어 오타 및 경로 문법 오류 교정
- 파이프라인 정제 스크립트 및 마크다운 README 등에 잔존하던 한글 오타 및 경로 표기 오류를 수정했습니다.
  - 오타 수정: `건드러뛰기` ➔ `건너뛰기`, `건드러뜀` ➔ `건너뜀`, `실패핟라도` ➔ `실패하더라도`, `묣료` ➔ `무료`
  - README 내 실행 예시 경로: `audiobook\run_pipeline.py` ➔ `content\audiobook\run_pipeline.py` 등 실제 이동된 위치를 바르게 표기하여 실행 명령어 가독성을 보장했습니다.

### 3. 과목 및 모의고사 연동 유연성 확보 (Dynamic SSOT Architecture, sw `v24`)
- **HTML UI 동적 렌더링**: `index.html`에 하드코딩되어 있던 플래시카드/퀴즈 선택 `<option>` 및 과목 필터 버튼 목록을 제거하고, `src/app.js`에서 앱 실행 시 `DATA_REGISTRY`의 과목 메타 데이터를 기반으로 동적 DOM 엘리먼트를 생성/삽입하도록 개편했습니다. (과목 뱃지 색상 또한 dynamic cycle을 통해 순환 렌더링)
- **N-축 삼각함수 레이더 차트**: `src/charts.js`의 `renderRadarChart` 함수를 리팩토링하여 임의의 과목 수(N)에 비례하여 $\theta_i = \frac{2\pi \cdot i}{N}$ 기반으로 다각형 그리드, 축, 라벨, 점수 데이터 폴리곤이 완전히 동적 계산 및 렌더링되도록 수학적 구조로 보강하였습니다.
- **동적 시험-과목 매핑**: 모의고사 ID(예: `subject1_p1` 등) 문자열 분석 하드코딩 판정을 제거하고 `DATA_REGISTRY.exams` 레지스트리를 대조해 부모 과목 키를 동적 조회하도록 수정했습니다. 이전 시험 기록 호환성을 위해 `subject1~4` 형태에 대응하는 하향 호환성 가드를 마련했습니다.
- **파이프라인 연동**: Python 스크립트(`run_pipeline.py`) 또한 하드코딩된 `SUBJECT_DIRS`를 지우고 `content/manifest.json`을 읽어 과목 경로와 레이아웃을 런타임에 자동 추론하도록 수정했습니다.

### 4. 중복 및 노후 문서 전면 정리 및 통합
- **아키텍처 가이드 통합**: `ARCHITECTURE.md`에 `MODULAR_DESIGN.md` 및 `APP_JS_DECOMPOSITION.md`의 설계 명세서와 Stable ID 규칙, 검증 파이프라인 등의 핵심 설계 정보를 병합하고 중복 2개 파일을 삭제했습니다.
- **배포 가이드 통합**: Vercel 배포, 용량 최적화, 외부 오디오 호스팅 가이드를 하나의 완결성 있는 `DEPLOYMENT_GUIDE.md`로 통합하고 구 문서 3개 파일을 삭제했습니다.
- **과거 로그 단일화**: `CHANGES.md`에 이전 세션의 주요 수정 완료 보고서(`walkthrough.md`, `code_review_report.md`)와 기술 마일스톤 이력(`RUNTIME_MD_MIGRATION.md`) 정보를 요약 병합하고 구 문서 3개 파일을 삭제했습니다.
- **폴더 구조 README 통합**: `FOLDER_STRUCTURE.md` 내의 폴더 트리를 `README.md`로 흡수하고 해당 파일을 정리했습니다.

---

## 🏛️ 후속 수정 및 아키텍처 개편 내역 (2026-08-25, 2차)

### 5. app.js 모듈화 — 뷰 컨트롤러 9개 모듈 분리 완료

- **배경**: 단일 `app.js`(원래 약 4,900줄)에서 뷰 컨트롤러 로직을 순차적으로 독립 ES Module로 추출하여 유지보수성과 테스트 가능성을 향상.
- **분리된 모듈** (`src/views/`):
  - `backup.js` — 데이터 백업/복원 (exportData, importData, triggerImport)
  - `textbook-search.js` — 교재 본문 검색 (검색 상태, 렌더링, 필터링, 카드 토글)
  - `textbook-reader.js` — 교재 리더 + 오디오 재생 (상태, 오디오 컨트롤, 렌더링)
  - `exam-simulator.js` — 실전 모의고사 시뮬레이터 (simState, 세션 관리, 타이머, OMR, 채점)
- **공통 UI 유틸 분리**: `src/ui-utils.js` — `showLoading`/`hideLoading`/`showGlobalLoading`/`hideGlobalLoading` + spinner CSS. 순환 의존성 방지를 위해 별도 모듈로 분리.
- **app.js 축소**: 3,277줄 → **1,154줄** (65% 감소). 남은 핵심: 초기화, 라우팅, 이벤트 바인딩, `startFocusSubjectStudy`(뷰 간 브릿지), `switchView`.
- **호환성 유지**: `window` 전역 객체에 추출된 함수들을 노출하여 기존 `data-click` 이벤트 위임 패턴과 인라인 핸들러 호환성 확보. `examIdToSubjectId`는 `exam-simulator.js`에서 정의 후 `app.js`를 통해 re-export.

### 6. DOM 테스트 환경 도입 (Vitest + jsdom)

- **Vitest + jsdom** 설치 및 `vitest.config.mjs` 설정 (jsdom 환경, `tests/dom/**/*.test.js` 포함).
- `tests/dom/backup.dom.test.js` — `backup.js` 모듈의 DOM 렌더링 및 이벤트 테스트 (10 tests).
- `package.json`에 `test:dom` 및 `test:all` 스크립트 추가.
- **총 테스트: 96개** (86 unit + 10 DOM), 전부 통과.

### 7. GitHub Actions CI 통합

- `.github/workflows/ci.yml` — push 시 자동으로 `npm test`(unit tests) + `node tools/check_parser_parity.js`(파서 정합성 검증) 실행.

### 8. data/study_md.js 폴백 번들 최적화 — 과목별 분할

- **배경**: `file://` 프로토콜용 단일 폴백 번들 `data/study_md.js`(513KB)를 과목별로 분할하여 초기 로드 크기 최적화.
- **변경**: 단일 513KB 파일 → `data/study_md/manifest.js`(3KB) + 과목별 `.js` 파일 (102~162KB each).
- **데이터 로더 수정**: `src/data-loader.js`의 `_ensureFallbackBundle()`을 `_ensureFallbackManifest()` + `_ensureFallbackSubjectFiles(key)`로 분리. 과목 로드 시 해당 과목의 MD 파일만 온디맨드 로드.
- **최적화 효과**: 사용자가 1과목만 학습할 경우 513KB → **112KB** (78% 감소). 전체 과목 순차 학습 시에도 한 번에 513KB 로드 대신 과목 전환 시마다 분할 로드.
- **빌드 스크립트**: `tools/build_study_md_bundle.js` 재작성. `npm run build:study-md`로 실행.
