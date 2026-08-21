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
