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
   → **(2026-08-24 폐기)** FontAwesome을 자체 호스팅([`vendor/fontawesome/`](../../vendor/fontawesome/))으로 전환하여 CDN/SRI가 더 이상 필요하지 않습니다. 모바일 아이콘 깨짐(네모) 문제 해결 목적. CSP의 `font-src`/`style-src`에서 cdnjs도 제거되었습니다.

---

## 후속 수정 내역 (2026-08-24)

### 모바일 오프라인 배너 오탐(false offline) 종합 수정 — sw `v10` → `v11`

모바일(Android Chrome)에서 인터넷이 정상인데도 "인터넷 연결이 끊어졌습니다" 배너가 로드 수 초 후 나타나 계속 유지되던 문제를 3차에 걸쳐 수정. 상세 설계는 [`ARCHITECTURE.md` "오프라인 감지 설계"](ARCHITECTURE.md) 참조.

- **1차 (v8)**: 프로브 신뢰성 개선 — 연속 실패 임계(`FAIL_THRESHOLD=2`), 타임아웃 4s→6s, `res.ok` 검사, SW `?_probe=` 바이패스.
- **2차 (v10)**: 프로브 대상을 전용 `ping.txt`(내용 `1`)로 교체, `cache: 'no-store'` 제거(일부 웹뷰/보안정책과 충돌해 fetch 자체가 실패하는 사례 방지), `navigator.onLine` 사전 차단 제거, 적응 주기(온라인 30s/오프라인 5s), 슬립 복귀 10초 유예. `serve.js`에 `.txt` MIME 추가.
- **3차 (v11)**: **`navigator.onLine === true` 억제 가드 추가** — 온라인이면 프로브 없이 신뢰하여 콜드스타트/저속망에서의 일시적 프로브 실패로 인한 가짜 배너를 원천 차단. `onLine === false`일 때만 ping.txt 프로브로 최종 확인하는 비대칭 신뢰 구조로 확정.
- **4차 (v12)**: **SW 프로브 프록시 전환** — PWA standalone(iOS WebKit/일부 웹뷰)에서 `?_probe=` 요청을 SW가 단순 `return`으로 바이패스하면 샌드박스가 `respondWith` 없는 fetch를 차단해 프로브가 항상 실패하던 문제 수정. `event.respondWith(fetch(request))`로 명시적 네트워크 프록시.
- **5차 (v13)**: **Standalone 인지 임계치 강화** — 설치형 PWA는 `onLine === false` 오탐 빈도가 높아 판정을 더 보수적으로. `FAIL_THRESHOLD` 일반 3회/standalone 4회, `PROBE_TIMEOUT` 8초, 슬립 복귀·콜드스타트 유예 15초(`WAKE_GRACE_MS`), 첫 프로브 5초 지연, `online` 이벤트 시 즉시 배너 해제.

### 사용자 매뉴얼 및 요약집 런타임 MD 뷰어 전환 및 다이어그램 오류 수정 (sw `v16` → `v17`, 2026-08-24)

- **배경**: 기존 개별 정적 HTML 방식(`user_manual.html`, `study_summary.html`)을 폐기하고, 마크다운 원본(`docs/*.md`)을 직접 읽어 렌더링하는 인앱 뷰어([`src/manual-viewer.js`](../../src/manual-viewer.js))를 통합 구축함.
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
  - [`src/exam-viewer.js`](../../src/exam-viewer.js) 신규: `exams/*.md`를 런타임 fetch → 자체 MD→HTML 변환(`_mdToHtml`) → `#exam-overlay` 오버레이 렌더링. 팝업/별도 HTML 문서 불필요.
  - 목차(TOC) 자동 생성, 인쇄/PDF 버튼, `Esc`·모바일 뒤로가기(`history.pushState`) 닫기.
  - sessionStorage 캐시(`exam_md_cache_v2_`, 24h TTL) — 재염 시 네트워크 0회.
- **file:// 지원 번들**: [`tools/build_exam_bundles.js`](../../tools/build_exam_bundles.js)가 `exams/*.md` → `data/exams_md/<stem>.js`(전역 `window.__EXAM_MD__`) 생성. `file://`의 fetch 차단을 클래식 `<script>` 주입으로 우회. http(s)는 live fetch 우선 + 번들 폴리백.
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

---

## 🏛️ 후속 수정 내역 (2026-08-25, 3차 — 모바일 네비게이션 및 PWA 설치 수정)

### 9. 모바일 매뉴얼 뷰어 즉시 닫힘 수정 (sw `v31` → `v32`)

- **증상**: 모바일에서 매뉴얼 버튼을 누르면 매뉴얼 화면이 잠시 나왔다가 즉시 메인 화면으로 복귀.
- **원인**: 매뉴얼 링크가 `<a href="#">`로 되어 있어 hash change → `popstate` 이벤트가 발생하고, `manual-viewer.js`의 `_onPopstate()` 핸들러가 즉시 오버레이를 닫아버림.
- **해결**:
  - `index.html`: 매뉴얼 링크를 `<a href="#">`에서 `<button type="button">`으로 변경 → hash change 자체를 원천 차단.
  - `src/manual-viewer.js`: `_openTimestamp` 변수 추가, `_onPopstate()`에서 open 후 300ms 이내 popstate 이벤트 무시하는 타이밍 가드 추가.

### 10. 네비게이션 자동 대시보드 복귀 수정 (sw `v32`)

- **증상**: PC/모바일 모두에서 다른 메뉴를 클릭하여 이동해도 얼마 안 되어 대시보드로 자동 복귀.
- **원인**: `src/app-fallback.js`가 무조건 `window.__APP_INITIALIZED = false`로 덮어써서, 8초 타임아웃 후 앱이 재초기화되며 대시보드로 리셋됨.
- **해결**: `app-fallback.js`에서 `window.__APP_INITIALIZED = false` 무조건 덮어쓰기 제거. 이미 초기화된 경우 재실행하지 않도록 가드.

### 11. 전역 데이터 레지스트리/매니페스트 참조 방식 변경 (sw `v33`)

- **배경**: `data/registry.js`와 `data/audio_manifest.js`를 정적 ESM import에서 `window` 전역 참조로 변경하여, 이 파일들 로드 실패 시 `app.js` 모듈 그래프 전체가 죽는 것을 방지 (모바일 PWA 견고성).
- **변경**:
  - `data/registry.js`: `window.DATA_REGISTRY` 할당 추가.
  - `data/audio_manifest.js`: `window.AUDIO_MANIFEST`, `window.AUDIO_BASE_URL`, `window.getAudioUrl` 할당 추가.
  - `src/app.js`, `src/data-loader.js`, `src/views/exam-simulator.js`, `src/views/textbook-reader.js`, `src/views/textbook-search.js`: 정적 import 제거 → `window.*` 참조로 변경.
- **SW**: `data/registry.js`와 `data/audio_manifest.js`를 `SHELL_ASSETS` 프리캐시에 추가 (모듈 그래프에서 분리되어 별도 캐싱 필요).

### 12. PWA 설치 버튼 수정 — beforeinstallprompt 조기 캡처 (sw `v34` → `v35`)

- **증상**: Android Chrome에서 "앱 설치" 버튼 클릭 시 실제 설치 프롬프트가 뜨지 않고 수동 설치 안내 모달만 표시.
- **원인 1**: `beforeinstallprompt` 이벤트는 Chrome에서 페이지 로드 직후 한 번만 발생하지만, `app.js`는 `type="module"`(deferred)이라 실행이 늦어 이벤트 리스너 등록 전에 이벤트가 발생해 버림.
- **해결 1**: `src/pwa-install-capture.js` 신규 — `<head>`에서 즉시 실행되는 클래식 스크립트로 `beforeinstallprompt` 조기 캡처 → `window.__deferredPrompt`에 저장.
- **원인 2**: SW 등록이 `app.js`(deferred module) 안에 있어 Android Chrome이 PWA 설치 가능 판정을 내리기 전에 SW가 활성화되지 않음.
- **해결 2**: SW 등록을 `pwa-install-capture.js`로 이동하여 `<head>`에서 즉시 등록. `app.js`의 중복 SW 등록 제거.

### 13. PWA 설치 진단 패널 및 manifest Content-Type 수정 (sw `v36` → `v37`)

- **진단 패널**: 설치 안내 모달에 PWA 진단 정보 패널 추가 — `beforeinstallprompt` 캡처 여부, SW 등록 상태, display-mode, manifest fetch 상태/Content-Type 등 화면 표시.
- **manifest Content-Type**: `vercel.json`에 `manifest.webmanifest`에 대한 `Content-Type: application/manifest+json; charset=utf-8` 헤더 추가 — Android Chrome은 manifest Content-Type을 엄격히 검사.
- **manifest 개선**: `prefer_related_applications: false` 추가, 192x192/512x512 아이콘 `purpose`를 `"any maskable"`로 변경.

### 14. 인앱 브라우저(WebView) 감지 및 Chrome 안내 (sw `v38`)

- **진단 결과**: Android에서 `beforeinstallprompt`가 발생하지 않는 원인은 코드가 아니라 **인앱 브라우저(WebView)** 환경. UA 끝의 `wv`가 WebView를 의미 (카카오톡 등 인앱 브라우저). WebView는 구조적으로 `beforeinstallprompt`를 발생시키지 않고 PWA 설치 미지원.
- **해결**:
  - `src/app.js` `detectPlatform()`: 인앱 브라우저 감지 로직 추가 (`wv)` UA 플래그, KakaoTalk, Instagram, FBAN/FBAV, LINE, Twitter, Snapchat 패턴).
  - `index.html`: 인앱 브라우저용 "Chrome으로 열기" 3단계 안내 모달 섹션 추가.
  - `src/app.js`: 인앱 브라우저 감지 시 페이지 로드 0.8초 후 자동으로 안내 모달 표시 (sessionStorage로 1회만).

### 15. 캐시 스큐 수정 — navigation을 Cache First로 전환 (sw `v38` → `v39`)

- **증상**: Chrome(SW 활성)에서만 앱이 실패하고, 인앱 브라우저(WebView, SW 없음)에서는 정상 작동. PC 설치 PWA도 정상.
- **근본 원인**: navigation(HTML)에 `Network First`를 적용한 것이 핵심.
  - 구 SW(v38)가 페이지를 제어하는 동안 방문하면:
    1. `index.html`은 `Network First` → **신버전 HTML** 획득 (네트워크에서)
    2. `/src/*.js`는 `Cache First` → **구버전 JS** 서빙 (구 캐시에서)
    3. 신버전 HTML + 구버전 JS = **캐시 스큐** → ESM import 그래프 붕괴 → 앱 초기화 실패
  - WebView는 SW가 없으므로 모든 요청이 네트워크 직행 → 신 HTML + 신 JS = 정상 작동
  - PC 설치 PWA는 브라우저 탭이 트리거한 SW 업데이트 완료 후 실행되므로 스큐를 겪지 않음
- **해결 1 — navigation `Cache First` 전환** (`sw.js`):
  - HTML과 JS가 항상 동일한 `CACHE_VERSION` 캐시에서 서빙 → 세대 내 불일치 원천 차단.
  - 구 SW: 구 HTML + 구 JS = 구버전 앱 정상 작동. 신 SW 활성화 후 리로드: 신 HTML + 신 JS = 신버전 앱 정상 작동.
  - 업데이트 지연은 최대 1 page load 분량 (`skipWaiting()` + `controllerchange` 리로드로 자동 해소).
- **해결 2 — `precacheResilient()` 도입** (`sw.js`):
  - `cache.addAll()`의 원자성(all-or-nothing)을 버리고 `Promise.allSettled()` + 개별 `cache.add()`로 변경.
  - `addAll`은 하나라도 404면 전체 reject → `skipWaiting()` 미실행 → `cacheFirst` 환경에서 사용자가 구버전에 영영 갇힘.
  - `allSettled`는 일부 실패해도 SW 활성화 보장, 실패분은 `cacheFirst`의 네트워크 폴백으로 온디맨드 자가 치유.
- **해결 3 — `verify-shell-assets.js` CI 검증 추가** (`tools/verify-shell-assets.js`):
  - 배포 전 `SHELL_ASSETS`/`DATA_ASSETS`의 모든 파일이 저장소에 존재하는지 확인.
  - `precacheResilient`이 누락을 조용히 넘기므로 CI에서 사전 차단 (비-0 종료로 실패).
  - `ci.yml`에 `npm run verify:assets` 단계 추가.
- **해결 4 — `ci.yml` 수정**: 존재하지 않는 `test:integration` 스크립트 → `check:parser`로 수정.

### 16. 폴더 구조 개선 및 불필요 파일 정리

- **불필요 파일 삭제**:
  - `improvements_report.md` (1회성 보고서, CHANGES.md가 대체)
  - `tools/generate_migration_map.js` (package.json 스크립트에 없음, id_migration.js 이미 생성됨)
  - `tools/generate_pwa_icons.ps1` (아이콘 이미 존재)
- **`.vercelignore` 개선**: `data/exams_md/`, `data/docs_md/`, `data/study_md/` 추가 (file:// 전용 폴백 번들, ~980KB 배포 절감)
- **`exams/` → `content/exams/` 이동**: 모든 콘텐츠 MD를 `content/` 하위로 통합
  - `index.html` 9개 `data-arg` 경로 업데이트
  - `tools/build_exam_bundles.js` 소스 디렉토리 및 키 생성 로직 업데이트
  - `data/exams_md/*.js` 번들 재생성 (키를 `content/exams/`로 변경)
  - `sw.js`, `.vercelignore` 주석 경로 업데이트

### 17. ARCHITECTURE.md — Service Worker 동작 메커니즘 섹션 추가

- **신규 섹션**: "Service Worker 동작 메커니즘" (6소섹션)
  1. 수명 주기 (install → activate → fetch 활성화 흐름도)
  2. 요청 가로채기 흐름 (7단계 분기 전략 ASCII 다이어그램)
  3. 캐시 스큐 방지 메커니즘 (문제 시나리오 vs 해결 메커니즘 비교)
  4. 캐시 전략 구현체 (Cache First / Network First / SWR 함수 설명)
  5. 자가 복구 메커니즘 (app-fallback.js 단계적 복구 흐름)
  6. CI 검증 (verify-shell-assets.js 배포 전 사전 차단)
- **기존 문서 갱신**:
  - 목차에 신규 섹션 추가 (번호 9~14 재정렬)
  - 아키텍처 다이어그램: 삭제된 `study_data.js`/`exam_data.js` 제거, `registry.js`/`id_migration.js` 추가
  - Vercel CDN 박스: `docs/*.html` → `content/*.md`
  - 스크립트 로드 순서: 현재 ESM 구조 반영 (theme-init, pwa-install-capture, app-fallback 포함)
  - `exam-viewer.js` 설명: `exams/*.md` → `content/exams/*.md`
  - `id_migration.js` 생성 주체: `generate_migration_map.js`(삭제됨) → `tools/build/index.js`
  - 데이터 파이프라인 다이어그램: `exams/**/*.md` → `content/exams/**/*.md`
- **검증 결과** (모바일 Chrome 실기기): PL=1 (루프 없음), CC=1 (SW 교체 1회), init=1325ms (정상 초기화), nav=9/11 (메뉴 정상), PWA 설치 정상 완료.

### 18. 기능 및 학습 경험 고도화 (UX/Feature) — 3항목 구현

- **3-2. Media Session API 연동** (`src/views/textbook-reader.js`):
  - `setupMediaSession()` / `clearMediaSession()` 함수 추가
  - `navigator.mediaSession.metadata`: 단원 제목, 과목명, 앨범 아트(icon-192/512) 설정
  - `setActionHandler`: play, pause, seekto, previoustrack(이전 단원), nexttrack(다음 단원) 핸들러 등록
  - `playbackState` 동기화: play/pause 이벤트에서 'playing'/'paused' 설정
  - Android Chrome에서 잠금화면/알림바 미디어 컨트롤 활성화

- **3-3. 인터랙티브 차트 툴팁** (`src/charts.js`):
  - 공통 툴팁 유틸리티(`getChartTooltip`, `showChartTooltip`, `hideChartTooltip`, `bindTooltip`) 추가
  - 라인 차트: 데이터 포인트 hover/touch 시 날짜, 점수, 이전 대비 증감(▲/▼), 최근 평균 표시
  - 레이더 차트: 꼭짓점 hover/touch 시 과목명, 점수, 합격 상태(과락/미달/안정권), 응시 횟수, 전체 평균 표시
  - 모바일 터치 지원: touchstart/touchend 이벤트 (2초 후 자동 숨김)
  - 화면 경계 자동 보정으로 툴팁이 화면 밖으로 넘어가지 않음

- **3-1. 모의고사 오답 복습 연동 보완** (`src/views/exam-simulator.js`):
  - `weak_sim_*` ID 매핑 문제 수정: 기존에는 STUDY_DATA에서 찾지 못해 누락되던 모의고사 오답을 `window.EXAM_DATA`에서 원본 문제를 찾아 복습 문제로 조립
  - `startWeakExam()`의 `_startWeakExamImpl()`에 1-b) 분기 추가: `weak_sim_` 접두사 ID를 EXAM_DATA에서 역추적하여 문제/정답/해설/옵션 복원

### 19. 디자인 완성도 및 마이크로 인터랙션 (UI/UX) — 3항목

- **5-1. 뷰 전환 모션**: 이미 구현됨 (`css/base.css` `@keyframes fadeIn` + `animation: fadeIn 0.4s ease forwards`)
- **5-2. 3D 플래시카드 GPU 가속** (`css/study.css`):
  - `will-change: transform` 추가로 GPU 가속 명시적 힌트 → 저가형 단말기 렌더링 최적화
  - 기존 `perspective: 1200px`, `preserve-3d`, `backface-visibility: hidden` 유지
- **5-3. 라이트 모드 배지 WCAG 대비 개선** (`css/exam.css`):
  - `.badge-cyan`: `#0e7490` (대비 ~5.4:1), `.badge-violet`: `#6d28d9` (~5.9:1)
  - `.badge-emerald`: `#047857` (~4.8:1), `.badge-amber`: `#92400e` (~5.7:1)
  - 모든 배지 WCAG AA 기준(4.5:1) 충족

---

## 20. 콘텐츠 하드코딩 제거 (2026-08-26)

> **목표**: 향후 `content/` 전체 교체 시 소스 코드 수정 불필요하도록 모든 콘텐츠 데이터를 동적 로딩으로 전환

### 수정 내역

- **`src/exam-viewer.js`**: 9개 시험 제목 하드코딩 맵 제거 → `registry.exams[].file` 매칭으로 `.title` 동적 조회
- **`src/views/exam-simulator.js`**: `examIdToSubjectId()`의 `subject1→'law'` 등 4개 하드코딩 폴백 제거 → registry 전용 조회, 실패 시 `null` 반환
- **`src/charts.js`**: `aggregateSubjectRates()`의 인덱스 기반 `subjectN` 파싱 제거 → `registry.exams` key 매칭
- **`src/state.js`**: `flashcards.subject`/`quiz.subject` 기본값 `'law'` → `null` (initApp에서 registry 첫 과목으로 설정)
- **`src/app.js`**: `.replace()` 체인 shortName → `registry.subjects[].shortName` 필드 사용; `populateExamCards()` 추가로 시험 카드 동적 생성
- **`index.html`**: 4개 과목별 하드코딩 시험 카드 제거 → `#exam-cards-dynamic` 컨테이너 (JS에서 registry 기반 생성)
- **`index.html`**: 6개 유튜브/외부링크 카드 + 4개 채널 요약 판넬 + 부록 설명 하드코딩 제거 → `#resources-section` 동적 컨테이너
- **`content/manifest.json`**: 모든 과목에 `shortName` 필드 추가; `resources` 섹션 추가 (sectionTitle, summaries, links)
- **`tools/build/index.js`**: registry 출력에 `shortName`, `file`, `resources` 필드 추가
- **`tools/build/manifest-loader.js`**: 시험 파일 경로 `exams/` → `content/exams/` 수정
- **`tools/build/plugins/exams.plugin.js`**: 동일 경로 수정
- **`src/types.js`**: `SubjectMeta.shortName`, `ExamMeta.file`, `ResourcesMeta` typedef 추가; `DataRegistry.resources` 필드 추가; `FlashcardsState.subject`/`QuizSessionState.subject` → `string|null`

### 검증

- `node tools/build/index.js` 재빌드 성공 (registry에 `shortName`, `file`, `resources` 필드 포함 확인)
- `npm test` 86/86 통과
- Vercel 배포 완료

---

## 21. 프로덕션 CSP 버그 수정 (2026-08-26)

> **목표**: Vercel 배포본에서만 발생하는 CSP(`script-src 'self'`) 관련 버그 2건 + 캐시 일관성 1건 + 인코딩 1건 수정

### 수정 내역

- **`index.html`**: 인라인 `onchange="importData(event)"` 제거 (CSP 차단) → `accept=".json"` 속성만 유지
- **`src/views/backup.js`**: `setupImportListener()` 추가 — `addEventListener('change', importData)`로 CSP-safe 바인딩
- **`src/app.js`**: `setupImportListener` import 추가, `initApp`에서 호출; `window.importData` 전역 노출 제거 (불필요)
- **`docs/user_manual.md`**: mermaid 코드블록 → 텍스트 ASCII 플로우차트로 대체 (mermaid.js 불필요)
- **`index.html`**: `vendor/mermaid/mermaid.min.js` `<script>` 태그 제거
- **`sw.js`**: `SHELL_ASSETS`에서 `mermaid.min.js` 제거 (프리캐시 3.2MB 절감)
- **`src/manual-viewer.js`**: `_renderMermaid()` → no-op (mermaid.js 런타임 의존 제거)
- **`sw.js`**: CSS 라우팅을 `networkFirst` → `cacheFirst`로 변경 (배포 전환 시 HTML/CSS 세대 불일치 방지)
- **`src/utils.js`**: mojibake (이중 인코딩) 헤더 주석 수정

### 검증

- `node tools/build/index.js` 재빌드 성공
- `npm test` 86/86 통과
- Vercel 배포 완료

---

## 25. 교재 리더 학습 보조 도구 추가 (2026-08-26)

> **목표**: 교재 리더에 4가지 학습 보조 기능을 추가하여 자격증 시험 대비 학습 효율 향상

### 추가 내역

- **`src/study-aids.js`** (신규): 4가지 학습 보조 도구 (CSP-safe, 의존성 제로)
  - ① 기출 필터 & 요약: `🔖기출` 마커 섹션 하이라이트, 비기출 섹션 디밍 토글, 핵심 요약 카드
  - ② 숫자·기한 빈칸 카드: 정규식으로 숫자/기한/횟수 자동 추출 → 챕터별 암기표
  - ③ 절차 플로우: 신고/변경/교육/폐업 절차를 정적 SVG 플로우차트로 시각화
  - ④ 행정처분 비교표: sticky column + zebra striping + 기출 하이라이트
- **`css/reader.css`**: 학습 보조 카드, 토글 버튼, 디밤 섹션, 반응형 레이아웃 스타일 추가
- **`src/views/textbook-reader.js`**: 기출 필터 버튼 및 학습 보조 HTML 통합, 토글 이벤트 바인딩

### 검증

- `npm test` 86/86 통과
- Vercel 배포 완료

---

## 26. 교재 콘텐츠 5대 학습 보조 개선 적용 (2026-08-27)

> **목표**: 전 교재(4과목 19단원) Markdown 콘텐츠에 5가지 학습 보조 요소를 추가하여 시험 대비 학습 효율 및 콘텐츠 직관성 향상

### 적용 내역

**5가지 개선 요소 (전 19단원 일괄 적용)**:
1. **학습 가이드**: 각 단원 시작에 출제 빈도(★), 예상 소요 시간, 핵심 키워드 블록 추가
2. **한 줄 요약**: 각 주요 섹션(`##`) 하단에 핵심 내용을 한 줄로 요약한 blockquote 추가
3. **비교표**: 주요 개념, 수치, 기준을 한눈에 비교할 수 있는 표 추가/확장
4. **확인문제**: 객관식 4지선다 문제 + 상세 해설을 각 단원 말미에 추가
5. **용어 사전**: 단원별 핵심 용어와 포인트를 정리한 표를 단원 말미에 추가

**적용 대상 파일 (19개)**:
- `content/law/1.cosmetic-law.md`, `content/law/2.privacy-law.md`
- `content/manufacturing/1.ingredients.md` ~ `5.hazard.md`
- `content/safety/1.workspace-safety.md` ~ `5.packaging-safety.md`
- `content/understanding/1.overview.md` ~ `7.filling-packaging.md`

### 빌드 시스템 수정

- **`tools/build/plugins/textbook.plugin.js`**: 카드 중복 제거 로직 추가
  - 용어 사전 표와 본문 표 간 동일 용어 중복으로 인한 duplicate card ID 빌드 에러 해결
  - 기존 퀴즈 중복 제거 로직과 동일한 패턴(`Set` 기반 ID dedup) 적용
- **`src/textbook-parser.js`**: 런타임 파서에 동일한 카드 중복 제거 로직 동기화
  - `check_parser_parity.js` 등가성 검증 유지

### 검증

- `npm run build:data` 성공 (law 172 cards, manufacturing 596, safety 305, understanding 593)
- `npm run check:parser` — 빌드 파서 ↔ 런타임 파서 등가성 검증 통과
- `npm run test:all` — 88 unit tests + 10 DOM tests 전부 통과

---

## 24. Vercel 크로스머신 배포 지원 및 문서 갱신 (2026-08-26)

> **목표**: 다른 PC에서도 Vercel 배포가 가능하도록 프로젝트 식별 정보를 Git에 추적하고, 배포 가이드 문서 갱신

### 수정 내역

- **`.gitignore`**: `.vercel` 유지 + `!.vercel/project.json` 예외 추가 — projectId/orgId가 Git에 추적되어 새 머신에서 `vercel link` 불필요
- **`.vercel/project.json`**: Git에 최초 커밋 (projectId, orgId 포함)
- **`docs/DEPLOYMENT_GUIDE.md`**: 섹션 1(프로젝트 저장 정보), 섹션 4(vercel.json CSP/캐시 정책) 추가, 섹션 재구성
- **`docs/MULTI_MACHINE_SETUP.md`**: projectId/orgId 표 추가, Cascade IDE 타임아웃 경고(`--token` 사용 권장), 관련 문서 링크 수정
- **`css/reader.css`**: `-webkit-line-clamp`에 표준 `line-clamp` 속성 추가 (CSS lint 경고 해결)

### 검증

- `npm test` 86/86 통과
- Vercel 배포 완료 (`cmd /c vercel --prod`)

---

## 23. CSP 이벤트 위임 전면 적용 및 회귀 가드 추가 (2026-08-27)

> **목표**: 배포판(CSP `script-src 'self'`)에서 동적 생성 HTML의 인라인 `onclick`/`oninput`이 브라우저에 의해 차단되어 데일리 챌린지·리더 오디오 컨트롤·대시보드 과목 바로가기·오답 노트 제외 버튼 등이 조용히 죽어 있던 버그 일괄 수정

### 수정 내역

- **`src/app.js`**: 이벤트 위임 시스템 고도화
  - `resolveDelegatedHandler()`: `window`에서 점 표기 네임스페이스(`ManualViewer.openManual` 등)로 핸들러를 찾는 공용 함수 추출
  - `parseDelegatedArgs()`: `data-args`(JSON 배열, 다중/타입 인자) 우선 파싱, 없으면 `data-arg`(단일 문자열) 폴백
  - `data-input` 위임 추가: range 슬라이더 등 `input` 이벤트용, `el.value`를 인자로 전달
  - 누락된 window 브리지 7개 추가: `startSubjectStudy`, `startSubjectQuiz`, `removeWeakCard`, `closeDailyModal`, `nextDailyStep`, `submitDailyCardAnswer`, `submitDailyShortAnswer`
- **`src/views/dashboard.js`**: 인라인 `onclick` → `data-click`/`data-arg` (과목 바로가기 2곳)
- **`src/views/quiz.js`**: 인라인 `onclick` → `data-click`/`data-args` (데일리 챌린지 모달 6곳, 오답 노트 제외 1곳)
- **`src/views/exam-simulator.js`**: 인라인 `onclick` → `data-click`/`data-arg` (오답 과목 재학습 1곳)
- **`src/views/textbook-reader.js`**: 인라인 `onclick`/`oninput` → `data-click`/`data-input`/`data-args` (오디오 컨트롤 5곳)
- **`src/views/textbook-search.js`**: 인라인 `onclick` → `data-click`/`data-arg` (카드 더 보기 1곳)
- **`tests/unit/delegation-guard.test.js`** (신규): CSP 회귀 가드 테스트
  - `src/**/*.js` + `index.html`에서 인라인 `on*=` 이벤트 핸들러 속성 잔존 검출
  - `data-click`/`data-input`으로 참조되는 모든 핸들러 최상위 식별자가 `app.js`에서 `window`에 브리지되어 있는지 교차 검증

### 검증

- `npm test` 88/88 통과 (기존 86 + 신규 2)
- Vercel 배포 완료

---

## 24. 교재 본문 Mermaid 다이어그램 지원 및 시각화 콘텐츠 추가 (2026-08-27)

> **목표**: 교재 리더에서 Mermaid 마인드맵·플로우차트를 렌더링하여 학습자에게 시각적·직관적인 학습 자료 제공

### 수정 내역

- **`src/reader-format.js`**: `allowMermaid: true` 옵션 추가
  - `parseMarkdown()` 호출 시 mermaid 코드블록을 `<pre class="mermaid">`로 변환하도록 활성화
- **`src/views/textbook-reader.js`**: Mermaid 온디맨드 로드·렌더링 로직 추가
  - `_ensureMermaid()`: `vendor/mermaid/mermaid.min.js` (3.3MB)를 mermaid 블록이 있을 때만 동적 주입 (manual-viewer.js와 동일 패턴)
  - `_renderReaderMermaid()`: `pre.mermaid` 노드를 찾아 `mermaid.run()`으로 렌더링, 라이트/다크 테마별 초기화
  - `renderChapterContent()` 끝에 `_renderReaderMermaid(container)` 호출 추가
- **교재 콘텐츠 8개 파일에 11개 다이어그램 추가**:
  - `content/law/1.cosmetic-law.md`: 법령체계 mindmap + 영업분류 flowchart
  - `content/manufacturing/1.ingredients.md`: 원료 분류 mindmap
  - `content/manufacturing/3.restricted.md`: 사용제한 원료 한도 flowchart
  - `content/manufacturing/5.hazard.md`: 위해성 평가 4단계 flowchart
  - `content/safety/1.workspace-safety.md`: CGMP 3대 요소 mindmap
  - `content/understanding/1.overview.md`: 맞춤형화장품 정의 flowchart
  - `content/understanding/2.physiology.md`: 피부 구조 flowchart
  - `content/understanding/3.sensory-evaluation.md`: 관능평가 순서 flowchart
  - `content/understanding/6.mixing-subdivision.md`: 제형 안정성 감소 요인 flowchart
  - `content/understanding/7.filling-packaging.md`: 충진기 종류 mindmap

### 검증

- `npm run build:data` 성공 (카드 1,178개, 파서 등가성 검사 통과)
- `npm test` 88/88 통과
- SW 캐시: mermaid.min.js는 기존과 동일하게 온디맨드 Network First로 캐싱 (프리캐시 불필요)

---

## 27. 사용자 매뉴얼 전면 재정리 (2026-08-27)

> **목표**: 사용자 매뉴얼(`docs/user/user_manual.md`)의 섹션 번호 불연속(7→11 점프), `신규!` 태그 잔존, Mermaid 미렌더링, 누락 기능(교재 리더·학습 보조·5대 개선) 설명 부재 문제를 일괄 해결

### 수정 내역

- **`docs/user/user_manual.md`** 전면 개편:
  - **섹션 번호 재정렬**: 1~6 유지, 구 section 7(7대 편의 기능)을 7~12로 분리, 구 section 11(모바일)을 13으로 이동, 테마/PWA를 14/15로 재번호 부여
  - **신규 section 7 (교재 리더)**: 교재 본문 읽기, 인터랙티브 개념 맵, 학습 보조 도구(4종), 5대 학습 보조 요소, 교재 본문 통합 검색을 하나의 섹션으로 통합
  - **Mermaid 다이어그램 복원**: 상단 Workflow를 ASCII → Mermaid `graph TD`로 변환 (manual-viewer.js 온디맨드 mermaid.js 로드 지원 확인)
  - **`신규!` 태그 전면 제거**: 모든 섹션에서 12개 `신규!` 태그 삭제
  - **오타 수정**: `즉적` → `즉각`, `누륩면` → `누르면`, `낮이가` → `높이가`
  - **중복 섹션 통합**: 구 section 7의 "오답 모의고사"를 section 4(오답/복습)로 이동 통합
  - **누락 기능 추가**: 레이더 차트 인터랙티브 툴팁, 대용량 문서 렌더링 최적화를 모바일 섹션으로 이동

### 검증

- `npm run build:data` 성공 (카드 1,666개, 파서 등가성 통과)
- `npm run test:all` — 88 unit + 10 DOM tests 전부 통과

---

## 22. 교재 리더 인터랙티브 개념 맵 추가 (2026-08-26)

> **목표**: 교재 본문 읽기 화면에 섹션 구조를 시각화한 마인드맵을 추가하여 학습자가 챕터 전체 구조를 한눈에 파악하고 원하는 섹션으로 빠르게 이동

### 추가 내역

- **`src/concept-map.js`** (신규): 순수 SVG 인터랙티브 개념 맵 생성기
  - Mermaid.js 없이 자체 SVG 렌더링 (CSP-safe, 의존성 제로, 오프라인 호환)
  - `generateConceptMap()`: 챕터 섹션 데이터 → SVG 마인드맵 문자열
  - `generateMobileLayout()`: 세로 트리 레이아웃 (루트 상단, 노드 수직 배치, 280px 폭)
  - `generateDesktopLayout()`: 좌/우 수평 레이아웃 (루트 중앙, 노드 양쪽 배치, 760px 폭)
  - `renderConceptMap()`: 컨테이너에 SVG 렌더링 + 클릭 이벤트 바인딩 + resize 감지
  - 기출(`🔖기출`)/중요(`📌중요`) 마커 섹션: amber 색상 stroke + 점 표시
  - 라이트/다크 테마 지원
- **`css/reader.css`**: 개념 맵 컨테이너, 노드 hover/focus, 토글 애니메이션, 모바일 반응형
  - `.concept-map-body.expanded`: `overflow-y: auto` + `-webkit-overflow-scrolling: touch`
  - 모바일 `max-height: 60vh` 내부 스크롤, 하단 페이드 그라데이션 indicator
- **`src/views/textbook-reader.js`**: `renderChapterContent()`에 개념 맵 통합
  - 챕터 헤더 아래, 섹션 카드 위에 렌더링
  - 노드 클릭 → 해당 섹션으로 smooth scroll + 자동 펼침
  - 펼치기/접기 토글 버튼
  - 모바일 감지: 컨테이너 폭 < 480px 시 세로 레이아웃, 화면 회전 시 자동 재렌더링

### 검증

- `node tools/build/index.js` 재빌드 성공
- `npm test` 86/86 통과
- Vercel 배포 완료

---

## 32. html_output 대용량 파일 MD 변환 및 body-only 추출 (2026-09-01)

> **목표**: `html_output` 디렉토리의 HTML 파일들이 ~44.5MB로 배포 용량 부담이 큰 문제를 해결하기 위해, 대용량 법령 원문 3개를 Markdown으로 변환하고 나머지 38개는 `<head>`/`<style>`/base64 이미지를 제거하여 용량 절감

### 문제 배경

- `html_output` HTML 파일 42개 총 ~44.5MB가 Vercel 배포에 포함되어 업로드 시간 및 저장소 부담
- 상위 3개 법령 원문 (기능성화장품 기준 11MB, KFCC_별표10 5.3MB, 화장품 안전기준 3.3MB)이 전체의 ~60% 차지
- 이들은 순수 텍스트(조문)로 절대 좌표 기반 배치가 의미 없음 → Markdown 플로우 레이아웃이 오히려 모바일에서 가독성 향상
- 나머지 파일들은 `<head>`/`<style>`(~2KB, 모든 파일 동일)과 base64 인라인 이미지가 불필요 (`html-viewer.js`는 `body.innerHTML`만 사용)

### 수정 내역

- **`content/utils/convert_html_output.py`** (신규): HTML→MD 변환 및 body-only 추출 Python 스크립트
  - 대용량 3개: HTML 파싱 → `<p>` 태그를 top/left 좌표순 정렬 → 텍스트 추출, `<table class="pdf-table">`을 MD 표로 변환, 파일 참조 이미지는 `![](images/...)`로 변환, base64 이미지 제거
  - 나머지 38개: `<body>` 내용만 추출, `<style>` 태그 및 base64 `data:` URI 이미지 제거
  - CRLF 정규화 처리 (Windows 환경 대응)
- **`src/pdf-registry.js`**: `MD_CONVERSION_TARGETS` Set 추가, `_toHtmlPath()`에서 대상 3개 파일에 대해 `.md` 확장자 반환
- **`src/html-viewer.js`**:
  - `parseMarkdown` import 추가
  - `openHtmlViewer()`: `htmlPath.endsWith('.md')` 분기 — MD 파일은 `parseMarkdown()`으로 HTML 변환 후 주입, HTML 파일은 기존 `DOMParser` 방식 유지
  - MD 렌더링 콘텐츠용 CSS 스타일 추가 (`h1`~`h3`, `p`, `ul`/`ol`/`li`, `table.reader-table`, `blockquote`, `img`, `hr`, `pre.reader-code-block`)
  - MD 이미지 경로 절대 경로 변환 (HTML과 동일하게 처리)
  - 타이틀 추출 정규식 `.html` → `.(html|md)` 확장
- **`src/reader-format.js`**: 참조 링크 표시명에서 `.md` 확장자 제거 정규식 추가 (`/\.(html|md)$/`)
- **`.gitignore`**: `!content/참조자료/html_output/**/*.md` 예외 추가 (MD 변환본 Git 추적)
- **`sw.js`**: `CACHE_VERSION` → `v119-20260901-html-to-md`

### 변환 결과

| 파일 | 변환 전 | 변환 후 | 절감률 |
|------|---------|---------|--------|
| 기능성화장품 기준 및 시험방법... | 11,011KB | 925KB | 92% |
| KFCC_별표10_일반시험법 | 5,346KB | 376KB | 93% |
| 화장품 안전기준 등에 관한 규정... | 3,321KB | 482KB | 85% |
| 나머지 38개 (body-only) | ~24.8MB | ~20.3MB | ~18% |
| **전체** | **~44.5MB** | **~26MB** | **41%** |

### 검증

- `npm test` 88/88 통과
- Vercel 배포 완료 (업로드 16.4MB, 이전 ~35MB 대비 절감)
- MD 변환 파일에 표(table) 53개 라인 포함 확인
- `resolveRefPath()` → `data-ref-html` → `openHtmlViewer()` 경로 일관성 확인

### 핵심 개선점

- **배포 용량 41% 절감**: 44.5MB → 26MB (18.5MB 절감)
- **런타임 변환**: MD 파일은 `parseMarkdown()`으로 클라이언트에서 동적 HTML 렌더링 — 검색/하이라이트/인쇄 기능 동일 유지
- **하이브리드 전략**: 법령 조문(텍스트 위주)은 MD, 별표/표류(레이아웃 중요)는 HTML body 유지
- **모바일 가독성**: MD 변환 파일은 플로우 레이아웃으로 모바일에서 더 읽기 편함

---

## 31. HTML 뷰어 iframe → fetch+DOM 주입 전환 및 검색 개선 (2026-09-01)

> **목표**: iframe 기반 HTML 뷰어가 Vercel CSP `frame-ancestors`/`X-Frame-Options` 헤더 충돌로 로드되지 않는 문제를 근본 해결하고, 검색 기능을 개선

### 문제 배경

- iframe 방식이 Vercel의 `frame-ancestors: none` CSP 헤더와 충돌하여 "연결을 거부했습니다" 에러 발생
- `frame-ancestors: self`로 변경 시도 → Vercel이 Unicode 경로 패턴 매칭 실패
- 별도 CSP 규칙 추가 → catch-all 규칙이 우선 적용되어 효과 없음

### 수정 내역

- **`src/html-viewer.js`** (전면 재작성): iframe 방식 제거, `fetch()` + `DOMParser` + DOM 직접 주입 방식으로 전환
  - `fetch()`로 HTML 파일 로드 → `DOMParser`로 파싱 → `body.innerHTML`을 오버레이 컨테이너에 직접 주입
  - CSP `frame-ancestors`/`X-Frame-Options` 문제 원천 제거
  - 이미지 상대 경로 → 절대 경로 자동 변환
  - HTML 변환본 스타일을 오버레이 CSS로 직접 적용 (`.hr-ov-content` 하위 셀렉터)
  - **검색 내비게이션 추가**: 이전/다음 버튼(`chevron-up/down`), `Enter`=다음, `Shift+Enter`=이전 키보드 단축키, 카운트 `1/N` 형식
  - **다중 매치 검색 수정**: `_highlightInTextNode()` 헬퍼로 텍스트 노드 내 모든 매치 발견 (기존: 첫 매치만 발견 후 `break`)
  - **스크롤 초기화**: 새 문서 로드 시 `scrollTop=0` + `innerHTML=''`로 이전 문서 잔류 방지
  - **로딩 엘리먼트 정리**: `display:none` → `remove()`로 DOM에서 완전 제거
  - **인쇄 기능 개선**: 인쇄 창에 뷰어 스타일시트 포함, `position:static` 오버라이드
- **`vercel.json`**: CSP `frame-ancestors`를 `none`으로 복원 (iframe 불필요), `frame-src` 제거, `$schema` 제거 (VS Code 경고 해결)
- **`.vercelignore`**: `*.html` 무시 + `!` negation 패턴 → `content/html/` 디렉토리 단위 제외로 변경 (Vercel이 negation+Unicode glob을 제대로 처리하지 못하는 문제 해결)
- **`sw.js`**: `CACHE_VERSION` → `v112-20260901-html-viewer-improve`

### 검증

- `npm test` 88/88 통과
- Vercel 배포 완료
- 참조 링크 클릭 시 HTML 문서 정상 표시 확인

### 핵심 개선점

- **CSP 독립성**: iframe을 사용하지 않으므로 `frame-ancestors`/`X-Frame-Options` 설정에 영향받지 않음
- **검색 정확도**: 텍스트 노드 내 모든 매치를 발견하여 누락 없이 하이라이트
- **UX 개선**: 검색 결과 간 이동 버튼 + 키보드 단축키, 진행 표시 (`1/N`)

---

## 30. PDF 뷰어 → HTML 뷰어 전환 (2026-09-01)

> **목표**: PDF.js 기반 참조자료 뷰어의 페이지/라인 참조 오류를 근본 해결하기 위해, `html_output` 폴더의 HTML 변환본을 iframe으로 표시하고 DOM 텍스트 노드 직접 검색으로 정확한 하이라이트 제공

### 수정 내역

- **`src/html-viewer.js`** (신규): iframe 기반 HTML 참조자료 뷰어 오버레이. DOM `TreeWalker`로 텍스트 노드 순회 → `<mark>` 하이라이트 + 스크롤. 검색어 자동 검색, 인쇄 지원
- **`src/pdf-registry.js`**: `PDF_DIRS`→`REF_DIRS`, `SOURCE_PDF_MAP`→`SOURCE_REF_MAP`, `PDF_FILE_TO_PATH`→`REF_FILE_TO_PATH`, `PDF_REGISTRY`→`REF_REGISTRY`로 개명. `_toHtmlPath()` 함수로 PDF 파일명 → `html_output/{base}/{base}.html` 경로 자동 변환. `resolvePdfPath`→`resolveRefPath`, `mapSourceToPdf`→`mapSourceToRef`로 개명
- **`src/reader-format.js`**: `data-pdf-path`→`data-ref-html`, `data-pdf-search`→`data-ref-search` 속성명 변경. `pdfPath` 파라미터→`refPath`로 개명. 참조자료 파일 목록의 PDF 타입을 HTML 경로로 변환. 아이콘 `fa-file-pdf`→`fa-file-lines`로 통일
- **`src/views/textbook-reader.js`**: `openPdf` import→`openHtmlViewer` import. `mapSourceToPdf`→`mapSourceToRef`. `chapterPdfPath`→`chapterRefPath`, `pdfPath`→`refPath` 변수명 변경. `buildReferenceLinks()` 내 PDF 경로→HTML 경로 변환. `bindReferenceLinks()`에서 `data-pdf-path`→`data-ref-html` 바인딩
- **`src/concept-map.js`**: `pdfPath`→`refPath` 파라미터/변수명 변경. `data-pdf-path`→`data-ref-html` 속성명 변경. `PdfViewer.openPdf`→`HtmlViewer.openHtmlViewer` 호출 변경
- **`sw.js`**: `pdf-viewer.js`→`html-viewer.js` 캐시 대상 교체. `pdf.min.mjs`/`pdf.worker.min.mjs` 프리캐시 제거. `CACHE_VERSION` → `v103-20260901-html-viewer-docs`
- **`.gitignore`**: `!content/참조자료/html_output/**/*.html` 예외 추가 (HTML 변환본 Git 추적)
- **`.vercelignore`**: `!content/참조자료/html_output/**/*.html` 배포 포함. `content/참조자료/**/*.pdf` 배포 제외 (용량 절감 ~27MB)
- **`docs/dev/ARCHITECTURE.md`**: `html-viewer.js` 모듈 추가, 아키텍처 다이어그램 갱신, 모듈 설명 갱신, content 변경 매트릭스 갱신 (`PDF_DIRS`→`REF_DIRS`), 참조 파일 목록 갱신

### 검증

- `npm test` 88/88 통과
- Vercel 배포 완료

### 핵심 개선점

- **정확한 검색**: PDF.js의 근사치 하이라이트(`topRatio = 0.1 + i * 0.05`) 대신 DOM 텍스트 노드 직접 순회 → 정확한 텍스트 위치에 `<mark>` 배치
- **배포 용량 절감**: PDF 27MB 제외, HTML 35MB 포함 (순증 8MB)
- **PDF.js 의존성 제거**: `pdf.min.mjs`/`pdf.worker.min.mjs` 불필요

---

## 29. PDF 제N조 검색어 자동 추가 및 레지스트리 중앙화 (2026-09-01)

> **목표**: 출처 라인의 "제N조"를 PDF 링크 검색어로 자동 추출 (방안 C), PDF/참조자료 설정을 단일 모듈로 중앙화하여 과목 변경 시 수정 범위 최소화

### 수정 내역

- **`src/reader-format.js`**: 출처/참고 라인에서 `제N조`/`제N조의M` 패턴을 추출하여 PDF 링크에 `data-pdf-search` 속성 자동 추가 (방안 C). 기본형·이야기형 모두 적용
- **`src/pdf-registry.js`** (신규): PDF 파일 목록(`PDF_DIRS`), 출처 키워드→PDF 매핑(`SOURCE_PDF_MAP`), 과목별 참조자료(`REFERENCE_FILES`), 공통/원료/법령원문 참조자료, 헬퍼 함수(`resolvePdfPath`, `mapSourceToPdf`)를 단일 모듈로 통합
- **`src/reader-format.js`**: `_PDF_DIR_MAP`, `_PDF_FILE_TO_PATH`, `_resolvePdfPath` 제거 → `import { resolvePdfPath }`로 전환
- **`src/views/textbook-reader.js`**: `REFERENCE_DIR_MAP`, `REFERENCE_FILES`, `REFERENCE_COMMON`, `REFERENCE_INGREDIENTS`, `REFERENCE_LAW`, `_PDF_REGISTRY`, `_SOURCE_PDF_MAP`, `_mapSourceToPdf` 제거 → `import`로 전환 (중복 코드 216행 삭제)
- **`sw.js`**: `CACHE_VERSION` → `v100-20260901-pdf-registry-refactor`
- **`docs/dev/ARCHITECTURE.md`**: `pdf-registry.js` 모듈 추가, content 변경 매트릭스 갱신, 참조 파일 목록 갱신

### 검증

- `npm test` 88/88 통과
- Vercel 배포 완료

### 과목 변경 시 수정 가이드

- **`src/pdf-registry.js` 1개 파일만 수정**하면 됨 (이전: 3개 파일 수정 필요)
- `SUBJECT_DIR_MAP`, `PDF_DIRS`, `REFERENCE_FILES`에 새 과목 항목 추가
- 제N조 추출 로직은 한국 법령 형식에 의존하므로 과목 변경과 무관하게 동작

---

## 28. 콘텐츠 폴더 구조 개편 및 학습안내서 전환 (2026-08-31)

> **목표**: 콘텐츠 폴더 구조를 한국어 명명으로 통일하고, 문제은행/참조자료/교재/학습안내서 경로를 일원화

### 수정 내역

- **콘텐츠 폴더 이동**:
  - `content/law/`, `content/manufacturing/`, `content/safety/`, `content/understanding/` → `content/교재/{law,manufacturing,safety,understanding}/`
  - `content/exams/` → `content/문제은행/` (문제은행 MD 4개 파일)
  - `content/ingredients/` → `content/참조자료/원료/` (성분 원본 MD)
  - `content/study_summary.md` → `content/학습안내서.md`
- **`content/manifest.json`**: 과목 `dir` 필드를 `교재/{subject_key}`로 갱신
- **`sw.js`**: `MD_ASSETS` 경로를 `content/교재/` 및 `content/학습안내서.md`로 갱신
- **`src/manual-viewer.js`**: `study_summary` 소스 경로를 `content/학습안내서.md`로 변경, 제목을 "학습 안내서"로 변경
- **`tools/build_doc_bundles.js`**: 문서 번들 소스를 `학습안내서.md`로 변경
- **`tools/build/plugins/ingredients.plugin.js`**: `INGREDIENTS_DIR`을 `content/참조자료/원료`로 변경
- **`content/utils/batch_convert.py`**: 교재 파일 경로를 하위 폴더 구조에 맞게 수정 (`교재/law/` 등)
- **신규 폴더**: `content/report/` (분석 보고서 MD 4개), `content/utils/` (Python 스크립트 3개)
- **문서 갱신**: `ARCHITECTURE.md`, `PROJECT_MINDMAP.md`, `docs/README.md`, `README.md` 콘텐츠 구조 및 경로 반영

### 검증

- `npm test` 88/88 통과
- `node tools/build_doc_bundles.js` 재빌드 성공
- `python content/utils/batch_convert.py` 13/13 파일 HTML 변환 성공
- Vercel 배포 완료
