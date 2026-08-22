# 변경 완료 보고서 (Walkthrough)

코드 리뷰 보고서의 개선제안 A, B, C에 따른 모든 코드 수정 및 모듈 분리 작업이 성공적으로 수행되었습니다.

---

## 🛠️ 변경 내용 요약

### 1. [개선제안 A] 데이터 복원 (`importData`) 보안 검증 적용
사용자가 가져오기 한 JSON 백업 데이터의 키가 화이트리스트(`ALLOWED_KEYS`)에 속해 있는 유효한 키인지 검사하는 필터를 추가하여 로컬 스토리지 오염을 방지했습니다.

```diff
 function importData(event) {
     const file = event.target.files[0];
     if (!file) return;
     
+    const ALLOWED_KEYS = [
+        'fc_memorized',
+        'fc_weak',
+        'quiz_results',
+        'sim_results_history',
+        'pomo_total_time',
+        'study_streak',
+        'study_streak_last_date',
+        'calc_history',
+        'streak_days',
+        'sim_draft'
+    ];
+    
     const reader = new FileReader();
     reader.onload = function(e) {
         try {
             const data = JSON.parse(e.target.result);
             
             // 데이터 검증 및 복원
-            Object.keys(data).forEach(k => {
-                if (data[k] !== null) {
-                    localStorage.setItem(k, data[k]);
-                }
-            });
-            
-            alert('학습 데이터 복원이 성공적으로 완료되었습니다! 페이지를 새로고침하여 적용합니다.');
-            location.reload();
+            let restoredCount = 0;
            Object.keys(data).forEach(k => {
-                if (ALLOWED_KEYS.includes(k) && data[k] !== null) {
+                if (ALLOWED_KEYS.includes(k) && data[k] !== null) {
                    localStorage.setItem(k, data[k]);
-                    restoredCount++;
+                    restoredCount++;
                }
            });
            
-            if (restoredCount > 0) {
+            if (restoredCount > 0) {
                alert('학습 데이터 복원이 성공적으로 완료되었습니다! 페이지를 새로고침하여 적용합니다.');
                location.reload();
            } else {
                alert('가져올 유효한 학습 데이터 키가 존재하지 않습니다.');
            }
         } catch (err) {
             alert('유효하지 않은 백업 파일입니다. 백업 데이터 복원 실패.');
         }
```

### 2. [개선제안 B] 뽀모도로 타이머 타임스탬프 기반 계산 보완
뽀모도로 타이머의 백그라운드 탭 스로틀링(Throttling) 현상 방지 계산식(`Date.now() - startTime` 기반 차감 방식)이 이미 정상 동작 중임을 확인하였습니다. 이에 대한 개발 주석을 추가하여 유지보수성을 보완했습니다.

```diff
 /* =======================================================
    ⏱️ 집중 뽀모도로 타이머 (Pomodoro Study Timer)
+   * 백그라운드 탭 차단(Timer Throttling)에 의한 오차를 방지하기 위해,
+   * 단순 setInterval 초 차감이 아닌 시작 시간과의 절대 타임스탬프 차이(Date.now() - startTime)를
+   * 사용하여 백그라운드 환경에서도 정확한 시간이 흐르도록 계산합니다.
    ======================================================= */
 function togglePomodoro() {
...
         // 일시 정지 후 재개 및 시작 시 시점 기록
         pomoState.duration = pomoState.timeLeft;
         pomoState.startTime = Date.now();
...
 function tickPomodoro() {
     const pomoState = state.trainer.pomodoro;
     if (!pomoState.isRunning) return;
     
+    // 시작 시각으로부터 경과된 실시간(seconds) 계산 (백그라운드 스로틀링 극복 핵심)
     const elapsedSeconds = Math.floor((Date.now() - pomoState.startTime) / 1000);
```

### 3. [개선제안 C] 파일 모듈화 (SVG 차트 및 드로잉 연습장 분리)
`app.js`의 3,700여 라인 코드 중 약 500라인가량의 UI 독립 구성 요소를 두 개의 별도 모듈 파일로 추출하였습니다.

*   **`src/charts.js` [NEW]**: SVG 성적 꺾은선 차트, 역량 진단 레이더 차트, 합격 진단 로직, 한글 초성 검색 헬퍼 이관.
*   **`src/scratchpad.js` [NEW]**: HTML5 Canvas 기반 손글씨 계산 연습장 기능, 연필/지우개 드로잉 브러시 상태 제어 로직 이관.
*   **`app.js` [MODIFY]**: 추출된 함수들을 소스코드에서 완전히 소거하여 결합도 및 모놀리식 규모 감소.
*   **`index.html` [MODIFY]**: 브라우저 런타임에 글로벌 스코프를 유지해 HTML의 기존 inline `onclick` 핸들러들이 수정 없이 그대로 작동하도록 script 태그 배치 순서 추가.

```diff
     <!-- Inject Exam Data -->
     <script src="exam_data.js"></script>
+    <!-- Inject SVG Charts & Scratchpad Logic Modules -->
+    <script src="src/charts.js"></script>
+    <script src="src/scratchpad.js"></script>
     <!-- App Logic Script -->
     <script src="app.js"></script>
 </body>
```
 
 ---
 
 ## 🎧 교재 오디오 싱크 스크롤 (Audio Sync Scroll) `신규!`
 
 오디오북 재생 위치에 맞춰 텍스트가 자동으로 스크롤되고 현재 섹션이 하이라이트되는 기능을 구현했습니다.
 
 ### 변경 내용 요약
 
 1. **섹션 동기화 로직** (`src/app.js`)
    - `computeSectionBoundaries()`: 각 섹션의 텍스트 길이 비율에 따라 오디오 전체 길이를 배분해 예상 재생 구간을 계산합니다.
    - `syncScrollWithAudio()`: `timeupdate` 이벤트마다 현재 재생 위치에 해당하는 섹션을 찾아 하이라이트하고 스크롤합니다.
    - 접혀 있는 섹션은 자동으로 펼칩니다.
 
 2. **자동 스크롤 토글**
    - 플레이어에 **"스크롤 따라가기"** 버튼을 추가해 켜기/끄기가 가능합니다.
    - 설정은 `localStorage`에 저장되어 다음에도 유지됩니다.
 
 3. **하이라이트 스타일** (`style.css`)
    - 현재 섹션 카드에 `.current-section` 스타일(시안 테두리+그림자)이 적용됩니다.
    - 현재 섹션 제목은 시안 색으로 강조됩니다.
    - 토글 버튼 활성 상태 스타일도 추가했습니다.
 
 ### 동작 방식
 - 오디오 재생 시작 → 메타데이터 로드 후 섹션별 예상 구간 계산 → 재생 위치가 섹션 경계를 넘을 때마다 해당 섹션으로 부드럽게 스크롤.
 - 시크바를 직접 움직여도 즉시 해당 섹션으로 동기화됩니다.
 - 정지/단원 전환 시 하이라이트가 제거됩니다.
 
 ---
 
 ## 🧪 검증 결과 및 확인 녹화

모든 기능 분할 및 리팩토링 후 브라우저 서브에이전트가 검증 시나리오를 수행하여 정상 작동을 증명했습니다.
*   **스크립트 로딩**: 모듈 파일 분할 후에도 대시보드가 정상 렌더링되며 개발자 도구 콘솔에 어떠한 Syntax/Runtime 오류도 잡히지 않습니다.
*   **연습장 드로잉**: 스마트 훈련소 계산연습장에서 마우스 드래그를 이용한 연필 그리기, 지우개 모드 부분 삭제, 전체 지우기, 닫기 동작이 완벽하게 구동됩니다.
*   **연습장 토글**: 연습장을 열고 닫을 때 DOM 컨테이너 상태와 UI 아이콘 텍스트가 의도한 디자인 명세에 부합하게 변환됩니다.

---

## 📲 PWA 설치 기능 추가 및 배포 안정화 (2026-08-21)

### 개요
앱을 홈 화면에 설치할 수 있는 PWA 기능을 구현하고, 배포 환경(특히 모바일)에서 발생한 캐시/리소스 문제를 해결했습니다.

### 1. 커스텀 앱 설치 버튼 및 안내 모달
- **배경**: Chrome 108+ 정책 변경으로 브라우저 자동 설치 배너가 제거되어, 앱 내 커스텀 설치 진입점이 필요해짐.
- **구현**:
    - 헤더 우측에 "앱 설치" 버튼(`#pwa-install-btn`) 추가 (모바일은 아이콘만 표시).
    - `beforeinstallprompt` 이벤트 캡처 → 조건 충족 시 네이티브 설치 팝업 호출.
    - 조건 미충족 시(모바일 초기 방문 등) 플랫폼 감지(`detectPlatform`) 후 **iOS/Android 분기 설치 안내 모달** 표시.
    - 모달에는 각 플랫폼별 설치 단계를 인라인 SVG 일러스트로 시각화 (별도 이미지 에셋 불필요).
    - 설치 완료(`appinstalled`) 또는 standalone 모드에서는 버튼 자동 숨김.
- **브라우저별 안내**: Chrome(⋮), 삼성 인터넷(하단 ≡), Safari(공유 버튼) 등 메뉴 위치가 다른 경우를 모두 커버하도록 문구 보강.

### 2. Service Worker 캐시 고착 문제 해결
- **증상**: 모바일 Vercel 배포 환경에서만 설치 버튼이 보이지 않음 (로컬/PC는 정상).
- **원인**: `CACHE_VERSION`이 `v1`으로 고정되어 브라우저가 `sw.js` 변경을 감지하지 못해, 모바일이 구버전 HTML/JS를 캐시에서 계속 제공받음 (Stale-While-Revalidate).
- **해결**:
    - `CACHE_VERSION` → `v2` 상향: 모든 클라이언트가 SW 업데이트를 감지하고 구 캐시(`cosmetic-pass-*-v1`) 삭제.
    - 페이지 네비게이션(`request.mode === 'navigate'`)은 **Network-First** 전략으로 변경: 온라인이면 항상 최신 HTML 우선, 오프라인 시 캐시 폴리백.
    - 새 SW 적용 시(`controllerchange`) 1회 자동 새로고침으로 구버전 화면 즉시 탈출.
    - 콘솔 빌드 마커(`[BUILD] v2 ...`) 추가로 신버전 적용 여부 즉시 진단 가능.

### 3. Vercel 배포 누락 리소스 수정
- **증상**: 배포 환경에서 "사용자 매뉴얼" / "핵심 단권화 요약집" 링크가 404.
- **원인**: `.vercelignore`의 `*.html` 규칙이 모든 HTML을 재귀적으로 제외하면서 `docs/*.html`도 함께 제외됨.
- **해결**: `.vercelignore`에 `!docs/*.html` 예외 추가 → `docs/user_manual.html`, `docs/study_summary.html` 배포 포함. (`exams/*.html`은 ~220MB로 100MB 제한 초과하여 계속 제외)

### 관련 커밋
- `feat: PWA 커스텀 설치 버튼 추가 및 모바일 최적화`
- `fix: 모바일 구버전 캐시 고착 해결 - SW v2 + 네비게이션 Network-First + 자동 새로고침`
- `fix: Vercel 배포에 docs/*.html 포함 - 사용자 매뉴얼 404 해결`
- `feat: PWA 설치 안내 모달 추가 - iOS/Android 분기 + 단계별 일러스트`
- `fix: PWA 설치 안내 문구 개선 - 브라우저별 메뉴 위치 안내 추가`

### 검증
- 프로덕션(https://personalized-skincare-study.vercel.app)에서 `sw.js`의 `CACHE_VERSION = 'v2'`, 설치 버튼, 모달 마크업, `docs/*.html` 200 응답 모두 확인.
- 모바일에서 설치 버튼 클릭 시 플랫폼별 안내 모달 정상 표시 확인.

---

## 오프라인 배너 오표시 버그 수정 (2026-08-21)

### 증상
- 인터넷에 정상 연결된 환경에서도 `index.html` 초기 로드 시 "인터넷 연결이 끊어졌습니다. 일부 기능이 제한될 수 있습니다." 배너가 화면 상단에 표시됨.

### 원인
1. **CSS 스코프 문제 (주원인)**: `.offline-banner` 스타일이 `@media (max-width: 768px)` 블록 날부에만 정의되어 있었음. 데스크톱(>768px)에서는 기본 숨김 스타일(`transform: translateY(-100%)`)이 존재하지 않아, JS가 `.show` 클래스를 추가하지 않아도 배너가 일반 블록 요소로 항상 렌더링됨.
2. **`navigator.onLine` 신뢰성 문제**: 해당 API는 실제 인터넷 도달 가능성이 아닌 OS 네트워크 어댑터 상태만 반영하므로 오탐지(false offline) 가능.

### 해결
- **`style.css`**: `.offline-banner` / `.offline-banner.show` 스타일을 미디어 쿼리 밖 전역 스코프로 이동 → 모든 화면 크기에서 기본 숨김 상태 유지.
- **`src/app.js` `setupOfflineDetection()` 개선**:
    - 초기 로드 시 `navigator.onLine`이 `true`이면 배너를 명시적으로 숨김(오탐지 방지).
    - 실제 연결 확인용 경량 프로브(`https://www.gstatic.com/generate_204`, `no-cors`, 4초 타임아웃) 추가.
    - 30초 간격 주기적 연결 상태 점검.
    - `offline` 이벤트 시 즉시 배너 표시, `online` 이벤트 시 프로브 재확인 후 숨김.

### 관련 커밋
- `fix: 온라인 환경에서도 오프라인 배너가 표시되던 버그 수정` (`c2aaaa5`)

### 검증
- `node --check src/app.js` 문법 검증 통과.
- 프로덕션 배포 완료 (https://personalized-skincare-study.vercel.app).

---

## 모바일 UI 개선 및 코드 모듈 분리 (2026-08-21)

### 1. 모바일 하단 탭 바 메뉴 확장
- **증상**: 모바일에서 교재본문 검색, 성분 검색, 복습, 훈련소 메뉴가 하단 탭 바에 없어 접근 불가.
- **해결**: `index.html` 모바일 탭 바에 누락된 4개 메뉴(복습/훈련소/교재검색/성분검색) 추가 → 총 10개 메뉴. `style.css`에 `overflow-x: auto` 적용으로 가로 스크롤 지원.

### 2. 일일 챌린지 카드 모바일 깨짐 수정
- **증상**: 모바일에서 "일일 5분 데일리 챌린지" 카드 레이아웃이 깨짐.
- **원인**: 전역 `[style*="display: flex"] { flex-wrap: wrap !important; }` 규칙이 카드 날부 flex 레이아웃을 강제 변경.
- **해결**: `style.css`에 `.daily-challenge-card` 전용 모바일 스타일(`flex-direction: column`) 추가.

### 3. 가로/세로 보기 토글 버튼 추가
- **요구사항**: 모바일에서 가로보기 모드를 수동으로 전환할 수 있는 토글 버튼 필요.
- **해결**:
    - `index.html` 헤더에 `#orientation-toggle-btn` 버튼 추가.
    - `src/app.js`에 `setupOrientationToggle()` 함수 추가 → `body.landscape-mode` 클래스 토글, `localStorage`에 선택 상태 저장, 토스트 알림 표시.
    - `style.css` 파일 끝에 `body.landscape-mode` 강제 가로 레이아웃 스타일 배치(CSS 우선순위 확보).
    - `DOMContentLoaded`에서 `setTimeout(100ms)`으로 이벤트 바인딩하여 DOM 준비 보장.

### 4. 성적 분석 그리드 모바일 종열 배치
- **증상**: 모바일 세로보기에서 "실전 모의고사 성적 분석 및 합격 예측" 3개 카드(성적 추이/과목별 진단/합격 예측)가 가로로 배치되어 표시 영역 부족.
- **원인**: `index.html`의 `.analytics-grid` 인라인 스타일 `grid-template-columns: 1.5fr 1.2fr 1.3fr`가 모바일 미디어 쿼리보다 우선 적용.
- **해결**:
    - `index.html`: 인라인 `grid-template-columns` 제거.
    - `style.css`: 모바일 미디어 쿼리에 `.analytics-grid { grid-template-columns: 1fr !important; }` 명시적 규칙 추가.

### 5. 코드 모듈 분리 (리팩토링)
- **목적**: `src/app.js`(약 5000줄)의 모놀리식 구조 개선, 유지보수성·테스트 용이성 확보.
- **변경 내용**:
    - **`src/trainer-calc.js`** (신규): 계산 훈련 문제 생성 로직 분리. DOM 조작 없이 순수 데이터(`{ type, question, answer, unit, solution }`)만 반환 → 단위 테스트·재사용 용이.
    - **`src/utils.js`** (신규): 의존성 없는 범용 헬퍼 모듈. 한글 초성 추출 함수(`getChosung()`)를 `charts.js`에서 이동. `app.js`보다 먼저 로드되어야 함.
    - **`src/app.js`**: 분리된 로직 제거 및 신규 모듈 참조로 대체.
    - **`src/charts.js`**: 초성 추출 로직을 `utils.js`로 이동.
    - **`index.html`**: 신규 스크립트 파일 로드 추가.

### 관련 커밋
- `fix: 모바일 세로보기에서 성적 분석 그리드 1열(종열) 배치로 수정` (`72ef8d4`)
- `refactor: 외부 수정사항 반영 - 코드 모듈 분리 (trainer-calc, utils)` (`8ffbc08`)

### 검증
- 프로덕션 배포 완료 (https://personalized-skincare-study.vercel.app).
- 모바일에서 하단 탭 바 10개 메뉴 정상 표시 및 가로 스크롤 동작 확인.
- 성적 분석 3개 카드가 세로보기에서 1열로 정상 배치 확인.

---

## 라이트/다크 테마 시스템 추가 및 SW 캐시 전략 개선 (2026-08-22)

### 개요
앱 전체에 라이트/다크 듀얼 테마를 도입하고, 모바일 하단 탭 바에 테마 토글을 추가했으며, Service Worker의 코드 자산 캐시 전략을 Network First로 개선하여 모바일 구버전 고착 문제를 근본적으로 방지했습니다.

### 1. 전역 라이트/다크 테마 시스템
- **FOUC 방지**: `index.html` `<head>`에 인라인 스크립트 추가 — 페인트 전에 `localStorage('appTheme')` 또는 `prefers-color-scheme`을 읽어 `<html>.light-theme` 클래스와 `theme-color` 메타 태그를 즉시 적용.
- **전역 테마 API**: `window.AppTheme = { isLight, apply, toggle }` 노출. 테마 변경 시 `localStorage` 저장 + `themechange` 커스텀 이벤트 브로드캐스트.
- **CSS 변수 오버라이드**: `style.css`의 `.light-theme` 블록에서 다크(기본) 디자인 토큰을 라이트 팔레트로 재정의하고, `.light-theme` 하위 선택자에서 라이트 전용 보정 규칙 약 220줄 추가 (하드코딩된 `#fff` 텍스트를 `var(--color-text-main)`으로 교체 등).
- **리더 테마 통합**: 기존 리더 전용 `readerLightTheme` 로컬 상태를 제거하고 전역 테마로 통합. `applyReaderThemeClass()`가 `themechange` 이벤트를 구독하여 즉시 동기화 → 두 테마가 어긋나는 버그 원천 차단.
- **헤더 토글 버튼**: 데스크톱 헤더에 `#theme-toggle-btn` 추가 (해/달 아이콘 자동 전환).

### 2. 모바일 하단 탭 바 테마 토글
- **증상**: 모바일에서는 헤더가 숨겨져 테마 전환 수단이 없었음.
- **해결**: 모바일 탭 바에 `#mobile-theme-toggle` 탭 추가 (아이콘 + "테마" 레이블). 헤더 버튼과 동일한 `toggle()`을 공유하고 `themechange` 이벤트로 아이콘 동기화.

### 3. Service Worker 캐시 전략 개선 (v3)
- **변경**: `CACHE_VERSION` `v2` → `v3` 상향.
- **프리캐시 보강**: `SHELL_ASSETS`에 `src/utils.js`, `src/trainer-calc.js` 추가 (모듈 분리 반영).
- **코드 자산 Network First**: `*.css` / `*.js` 요청을 Stale-While-Revalidate에서 **Network First**로 전환 — 온라인이면 항상 최신 배포본을 제공하고 오프라인이면 캐시 폴리백. `CACHE_VERSION` 범프를 깜빡핬어도 모바일에 구버전 JS/CSS가 남지 않도록 이중 안전장치 마련.

### 관련 커밋
- `Update index.html, src/app.js, style.css (external edits)` (`6ac5b2f`) — 테마 시스템 + 리더 통합 + 라이트 보정 CSS
- `Update index.html and sw.js (external edits)` (`e1eeca9`) — 모바일 테마 탭 + SW v3

### 검증
- 프로덕션 배포 완료 (https://personalized-skincare-study.vercel.app).
