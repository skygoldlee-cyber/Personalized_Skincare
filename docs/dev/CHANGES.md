# 코드 리뷰 수정 내역 (1~12 순차수정)

> 대상: Personalized_Skincare (Cosmetic Pass Master) 배포판
> 작업일: 2026-08-23
> 검증: 모든 `src/*.js` `node --check` 통과 · `node tools/build/index.js` 재빌드 성공 ·

## 2026-09-25 통합 검색 → 교재 본문검색 브리지

- 팔레트 결과 맨 아래에 **"교재 본문에서 '검색어' 전체 검색"** 항목을 항상 노출
  (매칭 0건이어도 유지 — 제목 인덱스로 못 찾는 본문 내용의 탐색 경로).
- 선택 시 `setTextbookSearchQuery()`로 검색어를 교재 본문검색 뷰에 주입한 뒤
  해당 뷰로 이동 — 뷰 로딩 완료 후 렌더에서 자동으로 전수검색 실행.
- `textbook-search.js`에 `setTextbookSearchQuery` 추가(상태·입력창·즉시검색 통합).
- 테스트: 유닛 +1(브리지 항상 맨 끝·단독 표시), DOM "결과 없음" 단정을 브리지
  렌더링 단정으로 교체 — 520/341 통과.

## 2026-09-25 Learning Pro 콘텐츠 독립성 강화 (유료 기능 선결 조건)

- **합격 규칙 매니페스트 선언**: `integratedExam.passAverage`(60)·`subjectFailBelow`(40)
  신설 + `getExamRules()` 헬퍼(exam-context). 기존 3곳의 하드코딩 제거 —
  recommendations.js(과락 40), exam-sim-review.js(40/60), charts.js(60).
  시험/교재 교체 시 매니페스트만 수정하면 전체 판정 로직이 유효.
- **시맨틱 버그 수정**: `renderPassFailDiagnosis`가 60점 미만을 "과락"으로
  표기하던 것을 실제 과락선(`subjectFailBelow`=40) 기준으로 정정 —
  과목 점수행 `(과락)`·레이더 툴팁 "과락 위험" 동일 적용.
- **`subjectKeyOf` 강화**: `[a-z]+` 전제 제거 + `weak_quiz_`/`weak_sim_` 접두사
  사전 제거 — 과목 키에 숫자·밑줄이 들어가는 시험에서도 정확 추출.
- **섹션 딥링크 형식 독립**: 팔레트 교재 이동이 "Chapter N" 영문 형식에 종속
  되던 것을 섹션 제목 직접 매칭(`openSubjectSection`)으로 교체 — 교재 형식이
  바뀌어도 동작.
- 검증: 유닛 +1(getExamRules)·팔레트 테스트 갱신 — 519/341 전체 통과,
  registry 재빌드로 선언값 전파 확인.

## 2026-09-25 예상 점수 추정 + 실제 결과 자가 보고 — Learning Pro C1(부분)

- **`estimateExpectedScore`**: 최근 모의고사 5회 평균 ±1σ로 예상 점수 대 산출,
  최근 8회 선형 회귀로 상승/보합/하락 추세 판정 — 합격 진단 카드 하단 표시.
- **실제 결과 자가 보고**: `actual_exam_result`(합격/불합격 + 선택 점수) 저장 —
  시험일 경과(D-day ≤ 0) 시 진단 카드에 입력 폼 노출, 기록 후 예상 대비 오차 표시.
  보정된 합격 "확률"이 아닌 점수 추정치로 표기를 한정(데이터 축적 후 2단계).
- 검증: 유닛 +6개(범위 클램프·추세 판정·영속·유효성) — 518/341 전체 통과.

## 2026-09-25 통합 검색 팔레트 (Ctrl+K) — Learning Pro C2

- **`src/command-palette.js` 신규**: 하나의 검색창에서 뷰 이동·교재 섹션·플래시카드·
  기출 퀴즈·성분 사전(초성 검색)·문제집 파일을 통합 검색 — `searchAll()`은 주입 가능한
  순수 함수로 분리해 유닛 테스트 가능.
- **진입점**: 헤더 돋보기 버튼(모바일 포함) + `Ctrl/Cmd+K` 전역 단축키.
  `↑↓` 이동·`Enter` 실행·`ESC` 닫기, 배경 클릭 닫기.
- **실행 경로는 기존 앱 경로 재사용**: 뷰 → nav-item 클릭 시뮬레이션(feature 게이팅
  `is-hidden` 반영), 카드 → `startSubjectStudy`, 퀴즈 → `startSubjectQuiz`,
  교재 → `openSubjectChapter`(Chapter N → `chN` 앵커), 성분 → 사전 뷰 쿼리 주입,
  문제집 → `ExamViewer.openExam`. 신규 네비게이션 분기 없음.
- **오프라인 완전 동작**: 모든 검색 대상이 `STUDY_DATA`/`INGREDIENTS_DATA`/`DataLoader.registry`
  등 로컬 데이터 — SW 프리캐시에 모듈 등록.
- 검증: 유닛 +10개(검색 매칭·그룹 상한·초성), DOM +9개(단축키·그룹 렌더·키보드
  내비·XSS 이스케이프·feature 게이팅) — 512/341 전체 통과.

## 2026-09-25 모바일 하단 탭 바 겹침 수정 + PWA 콜드 스타트 뷰포트 보정

- **하단 플로팅 요소 탭 바 겹침 수정**: `.reader-back-to-top`(`bottom:1.25rem`)이
  탭 바(높이 `calc(70px+safe)`, z 1400)에 완전히 가려지던 문제 — 스크롤 시 나타나야
  하는 버튼이 보이지 않았음. `.glossary-back-btn`(5rem), `#storage-warning-banner`,
  `.nav-init-fail-banner`(bottom:0)도 동일하게 탭 바 위로 이동.
- **스크롤 하단 여유**: `.main-content` `padding-bottom` 70→80px(탭 바+여유) +
  `scroll-padding-bottom` 신설 — 포커스/`scrollIntoView`로 요소가 탭 바 밑으로
  들어가지 않도록.
- **PWA 콜드 스타트 `dvh` 과대측정 대응**: 설치형 PWA 첫 실행에서 뷰포트가 실제
  화면보다 크게 측정되면 `.main-content` 끝이 화면 밖으로 밀려 스크롤 끝 위젯
  (대시보드 '내 학습 분석·도구')이 탭 바에 가려지는 간헐 장애 — `initViewportHeight()`가
  `visualViewport.height`를 `--app-height`로 반영하고 resize 계열 이벤트에 자동 갱신,
  `.app-container { height: var(--app-height, 100dvh) }` (JS 미실행 시 dvh 폴백).
  실기기 검증 완료.
- 설계 규칙 문서화: ARCHITECTURE.md 모바일 최적화 기법, SPEC.md UX-NAV-05/UX-PWA-05 +
  환경적 제약표.

## 2026-09-25 참조자료 파이프라인 검증 체계 + 퀴즈 추출 버그 수정

- **PDF→MD 파이프라인 복구/검증 강화**: `pdf2md.py`·`convert_ref_pdfs_v2.py`가
  멀티시험 구조(`content/exams/<id>/참조자료`)를 해석하도록 수정 — `EXAM_CONTENT_ROOT` env 지원.
  신규 검사 3종을 `check:content`에 통합: `check:reffresh`(PDF SHA-256 매니페스트
  `참조자료/pdf_hashes.json` — 원본 교체 감지), `check:reflines`(교재 `📌출처` 조문 ↔
  ref_md 실제 내용 — `../참조자료/` 논리 링크 해석 포함), `check:drillfresh`
  (드릴 번들 ↔ 문제은행 번들 신선도 — `// 원본:` 헤더 해시 비교). npm 스크립트
  `convert:refs`/`verify:refs` 추가. 일회성 도구 10종 `tools/_archive/` 이동.
- **숫자 빈칸 퀴즈 경로 사장 버그 수정**: 파서의 `numRegex`가 끝 `\b` 때문에 한글
  단위(일·년·개월 등)와 기호 단위(%, ℃, ㎛) 뒤에서 절대 매칭되지 않던 문제 —
  JS `\w`에 한글이 없어 단위 뒤 공백·구두점에서 경계가 성립하지 않았음.
  `\b` → `(?![가-힣0-9A-Za-z])` 후방 금지 + 숫자-단위 간 공백 허용으로 교체
  (빌드 `textbook.plugin.js`·런타임 `src/textbook-parser.js` 동시 수정,
  `check:parser` 등가성 유지). 퀴즈 +67개 복구 (농도 한계·기간 등 시험 핵심).
- **🔖기출 마커 경고 정확화**: 헤더·볼드 라벨·번호/불릿 라벨 등 퀴즈 생성이
  구조적으로 불가한 라인을 경고에서 제외하고, 경고에 `파일:L번호` 위치 부여 —
  61건(대부분 노이즈) → 0건. 잔여는 콘텐츠 수정(안내판·피부색 결정 요인·염류의 예
  볼드 보강)과 파서 수정으로 해소.
- **term형 퀴즈 정합**: 질문 하한 15→11자(카드 `desc>10` 규칙과 동일)로 완화해
  "제조관리기준서: 제조공정 및 시설 관리" 류 복구. 반대로 같은 질문에 정답이
  둘 이상인 모호 term 퀴즈는 제외 (타이핑 채점 불가 — 내용은 카드로 계속 노출).
- **인용 라인 교정 2건**: 과목2 `L438→L430`(벤젠 행), 과목3 `L336→L318`(디옥산 절).
  `sync:citations --check` 593/593 일치.
- **빌드 통계 파일 단위 diff**: `.last-stats.json`에 과목별 `files` 맵 기록,
  파일 소실·카드→0·20%↓ 감소·신규 0카드를 각각 경고 — 과목 합계 20% 룰이
  못 잡던 소규모 무소음 드롭 탐지.

## 2026-09-24 이벤트 위임·리더 툴바 DOM 테스트 추가 (+32)

- `common-eventlisteners.dom.test.js`(+21): data-click/data-args/data-input
  위임 디스패치, 네임스페이스 핸들러 해석, Enter/Space 키보드 접근성,
  설정 메뉴, 진도 초기화, 플래시카드 버튼·집계, sim 이동, 퀴즈 숫자/OX 단축키.
  `event-listeners.js` 라인 38→68%.
- `study-reader.dom.test.js`(+11): 리더 툴바(글자/줄간격·집중모드·접기),
  본문 검색 하이라이트+순환 네비, 모바일 TOC 드로어, 표 확장 모달,
  TOC 클릭 스크롤, themechange 동기화. `textbook-reader.js` 40→53%.
- 병합 라인 커버리지 78.3→79.7%.

## 2026-09-24 커버리지 공백 보강 — mermaid-utils·오답 모의고사

- **테스트 추가** (+14): `tests/unit/mermaid-utils.test.js`(8 —
  다이어그램 타입 감지 전 타입, CSS 클래스, init 옵션 테마 분기),
  `study-simulator.dom.test.js` 오답 모의고사(+6 — `startWeakExam`의
  카드/퀴즈/combo 재조립, 과목 필터, 빈 데이터 토스트).
- **실버그 수정**: `_startWeakExamImpl`이 combo 문항 조립 시
  `comboOptions`·`statements`를 버려 `deriveComboJudgments`가 항상
  null → 진술 판정·리뷰 미동작하던 문제. 두 필드 유지로 수정.
- **커버리지**: 병합 라인 77.3→78.3%, `mermaid-utils` 0→100%,
  `exam-simulator` 49→69%.

## 2026-09-24 테스트 커버리지 실측 개선 (병합 리포트)

- **병합 리포트 도구**: 유닛(node:test)과 DOM(vitest)이 갈린 두 러너의
  커버리지를 하나로 합산 — `c8`(유닛 측정) + `tools/coverage-merge.js`
  (istanbul-lib-coverage 머지) + `npm run coverage:all` 일괄 스크립트.
  `coverage-unit/`·`coverage-merged/` gitignore 등록.
- **측정 제외**: jsdom으로 검증 불가한 환경 의존 모듈을
  `vitest.config.mjs` `coverage.exclude`에 명시 — `types.js`(typedef
  전용), `app-fallback`, `pwa-install(-capture/-manifest)`, `theme-init`,
  `web-vitals`, `reader-audio`. 분모가 정직해짐.
- **결과**: 병합 기준 **라인 77.3%** (기존 vitest 단독 표시 53.2% →
  유닛 커버 합산 + 제외 정정의 합성). `src/` 최상위 80.7%.
- **테스트 공백 보강** (+21): `study-trainer-drills`(12 — OX/복수정답형
  전 플로우, 진술 판정·소거·키보드 단축키, 취약 리뷰),
  `common-navigation`(4 — 뷰 전환·스크롤 복원), `common-glossary`(5 —
  용어집 수집·렌더·스크롤). trainer-drills 15→91%, glossary-renderer
  20→82%, navigation 24→48%.

## 2026-09-24 SW 프루닝 한글 경로 인코딩 함정 수정

- **배경**: `sw.js` `pruneStaleDataBundles`가 캐시 요청의
  `new URL(req.url).pathname`(퍼센트 인코딩 상태)과 레지스트리에서
  추출한 원시 경로 접미사를 `endsWith`로 직접 비교 — 한글 파일명 번들이
  레지스트리에 참조돼 있어도 매칭 실패로 **참조 중인 번들을 오삭제**할 수
  있었다. 참조 추출 정규식도 `[A-Za-z0-9_./-]` ASCII 전용이라 한글 참조를
  인식하지 못했다 (html-viewer 테스트 작성 중 발견한 함정의 프로덕션 잔재).
- **수정**: 추출 정규식을 `[\p{L}\p{N}_./-]`(u 플래그)로 유니코드 확장,
  `pathname`은 `decodeURIComponent` 후 비교(실패 시 원본 폴백).
- **테스트**: `tests/unit/sw-prune.test.js` (+5) — vm 샌드박스에서 실제
  sw.js를 실행해 프루닝 동작 검증: 한글 참조 번들 보존, 비ASCII 참조 추출,
  서브디렉터리 배포 끝 일치, ALWAYS_KEEP 경로, registry fetch 실패 시
  best-effort 무동작.

## 2026-09-24 테스트 커버리지 보강

- **커버리지 도구 도입**: `@vitest/coverage-v8` + `npm run coverage`
  스크립트 — DOM 테스트 기준 라인 53%·문 50% 실측 가능.
  `coverage/` 산출물은 gitignore 등록.
- **html-viewer DOM 테스트 신규** (+7): MD/HTML 렌더·제목, XSS 제거
  (script·on* 핸들러·javascript: URI), 검색 하이라이트·이전다음 이동,
  sessionStorage LRU 캐시 재사용, fetch 실패 오류, ref_md joinWraps,
  닫기. 한글 경로 퍼센트 인코딩 대응 fetch 스텁.
- **supabase-client 유닛 테스트 신규** (+6): window/document 스텁으로
  vendor lazy 로드 검증 — 로드 생략(기존 window.supabase), 스크립트
  생성·auth 옵션(flowType:implicit 등), 클라이언트 캐시, 로드 실패
  reject+재시도, getAuthSession, onAuthChange (session, event) 순서.

## 2026-09-24 ref_md 문장 중간 절단 복원 (joinWraps)

- **배경**: ref_md(법령·고시 원문 41문서)는 PDF 고정폭 wrap 산출물이라
  문장 중간에 줄이 잘린다("…화장품을 말\n한다.", "…제\n품"). `pdf2md.py`가
  `#L####` 인용 라인번호 보존을 위해 `segment=False`(시각적 줄 유지)로
  변환하므로 소스 수정 불가 → 렌더 타임 복원으로 해결.
- **`markdown-parser.js`**: `joinWraps` 옵션 추가(기본 off). 이전 평문/
  리스트 항목이 문장부호 없이 끝나고 다음 줄이 구조 마커(제N조·가.·①·
  별표·[ 등)로 시작하지 않으면 이전 `<p>`/`<li>`에 병합. 결합 구분자는
  휴리스틱: 다음 줄이 조사·어미 꼬리로 시작("…에|서")하면 무공백, 이전
  줄이 조사·어미로 끝나면("…또는|증진") 공백, 그 외는 무공백(단어 중간
  절단이 지배적). 쉼표·ㆍ·여는괄호 종료 뒤 연도형 숫자("2023. 6. 22.>")
  는 목록이 아닌 연속줄로 처리. 병합 시 첫 줄의 `data-md-line` 유지 →
  L#### 인용은 병합 단락 시작으로 도착
- **`exam-viewer.js`** / **`html-viewer.js`**: 경로에 `ref_md` 포함 시
  `joinWraps: true` 자동 적용 (수작성 참조자료·교재는 미적용)
- **효과**: 41개 문서에서 문장 중간 절단 ~23,000줄이 단락으로 병합됨.
  테스트 추가 (markdown-parser-general.test.js, study-examviewer.dom.test.js)

**후속 보완 (동일 배포)**:
- 연속줄을 `<span data-md-line>`으로 감싸 L#### 인용이 병합 문단 시작이
  아닌 원줄 위치로 도착
- 오분류 교정: 날짜 꼬리(`<개정` 미닫힘 + `2018. 3. 13.>`), 화학식 꼬리
  (`Freon\n113)`, `1→\n1000)` 3자리+N) 패턴)를 `<li>` 오분류 대신 병합
- 러닝헤더 스킵: H1 제목의 `(` 앞부분과 정확히 일치하는 반복 단독줄
  (예: "화장품법 시행규칙"×35)을 투명하게 건너뛰어 페이지 경계 문장 병합
  복원 (`혼합ㆍ소분` + 헤더 + `과정에서` → `혼합ㆍ소분 과정에서`)
- 공백 휴리스틱 보강: 매우 짧은 prev 줄(<16자, 서식 필드 라벨)은 공백
  결합 — 단 짧은 문장부호 꼬리("한다.")는 어형 절단으로 무공백 유지
- 캐시 버전 범프: `exam_md_cache_v6_`, `ref_doc_v2_` (구 병합 전 HTML
  잔존 방지)
- `check:refmerge` 감사 스크립트 추가 — struct-merge/date-in-li/
  header-merge HIGH 0 확인
- 조사 후 보류: pdfplumber x0 들여쓰기(연속줄 +10~13pt, 러닝헤더 x0≈480)로
  연속줄 확정 판별은 가능하나, 소스 재생성+인용 재동기화 비용 대비 실익이
  적어 문서화로 대체 (미종결prev+구조시작 1,331건은 대부분 `~한 경우`로
  끝나는 정상 항목 경계)

## 2026-09-24 앱 종료 기능 + 모바일 스크롤바 숨김

- **설정 메뉴 '앱 종료' 항목** (`index.html`, `app.js`, `ui-overlay.css`):
  설치형 PWA(standalone, `display-mode`/`navigator.standalone` 감지)에서만
  설정 패널에 표시. 클릭 → `showConfirm` 확인 → `window.close()`(데스크톱 PWA
  동작) → `history.back()` 시도 → 모두 차단되면 600ms 후 전체 화면
  `.app-exit-screen` 안내로 대체 ("최근 앱 목록에서 밀어 닫기").
  모바일 OS는 웹의 자체 종료를 차단하므로 안내+제스처 유도가 실질적 종료 경로.
  항목 툴팁에도 동일 안내 포함
- **모바일 스크롤바 완전 숨김** (`base.css`): `@media (pointer: coarse),
  (max-width: 900px)`에서 `::-webkit-scrollbar` 폭 0 + `scrollbar-width: none`
  (`*` 컨테이너). 데스크톱은 10px·진한 thumb 유지. 터치 환경은 드래그용이
  아니므로 위치 표시 불필요 판단
- **참조자료 이미지 표시 수정** (`exam-viewer.js`): `parseMarkdown` 결과 주입 시
  상대 이미지 경로를 md 디렉터리 기준 절대 URL로 재작성 — `data-ref-md`·법규
  준수 문서·문제은행 인용 경로에서 `이미지` alt 텍스트로 보이던 문제 해소
- **ref_md 아티팩트 정리**: 변환 조각 이미지 74건 제거(별표 제목 글자-이미지
  중복 56 + 수식 기호 조각 18). 참조 무결성 0건 깨짐, 의미 이미지
  (QR·로고·심벌·구조식·장치도) 전량 보존
- **스크롤바 가시성 강화** (`base.css`): 폭 6→10px, thumb 대비 상승,
  track `--bg-subtle`, Firefox `scrollbar-*` 추가 — 이후 모바일은 숨김 처리
- **잔여 스크롤 오버라이드 정리**: 모바일 네비·OMR 그리드 4→6px + 새 변수
- **미해결 확인**: 우측 가장자리 회색 띠 신고 → 삼성 엣지 패널(OS 핸들)로 판명

## 2026-09-24 Formula OS UI 정리 + 고객 데이터 고지

- **배합 계산기 서브내비 추가** (`index.html`, `formula.js`): 다른 서브패널에만
  있던 섹션 이동 칩 6개를 계산기 상단에도 배치 — `formulaSubNav('calc')`
- **허브 카드 정리** (`index.html`): 성분 사전 카드 제거 (사이드바 메뉴와 중복)
  — 허브 7개 → 6개. `openIngredientDict` 핸들러·사이드바 항목은 유지
- **고객 데이터 로컬 전용 고지** (`index.html`, `formula.css`):
  `.formula-data-notice` 콜아웃 박스 신규 (primary tint 배경·테두리·아이콘,
  본문 `text-main`) — 고객 카드·상담 이력이 동기화 제외임을 고객 관리 화면에 명시,
  서브내비 아래 배치
- **다크모드 가독성 수정** (`formula.css`): `.comp-item`·`.comp-doc-link`가
  미정의 변수(`--color-surface`/`--color-text`) 폴백으로 항상 흰 배경이던 문제 —
  `--bg-card`/`--border-color`/`--color-text-main` 테마 변수로 교체
- **`formula-safety-note` 아래 마진**: 경고 박스와 첫 섹션 간격 확보
  (법규 준수 '영업·자격' 붙음 해소, 원료 기한 경고 → 목록도 개선)
- **사용자 매뉴얼 갱신** (`formula_manual.md` + 번들 재생성): 허브 6개,
  성분 사전 접근 경로, 고객 데이터 로컬 전용, §7 동기화 설명 갱신

## 2026-09-23 UI/문구 미세 수정 일괄

- **SW 업데이트 토스트 스피너 찌그러짐 수정** (`pwa-install-capture.js`):
  flex 컨테이너 안 16px 원이 좁은 화면에서 축소되어 타원이 되던 문제 —
  `flex:none`으로 크기 고정. ※ 토스트는 교체되는 구버전이 그리므로
  다음 배포의 토스트부터 효과 확인 가능
- **계정 모달 문구** (`index.html`, `auth-view.js`):
  - 가입 절차 안내 추가 — "로그인 메일" 경로는 첫 로그인 시 계정 자동 생성,
    회원가입 버튼은 비밀번호 로그인용임을 명시
  - 동기화 대상 표현을 "학습 진도 또는 포뮬러·조제 기록"으로 수정
  - `비밀번호 찾기` title·발송 메시지 — 사용 조건과 절차를 명확히
- **`MD_to_HTML.py`** — 테마 버튼 `ThemeTheme: Dark` 중복 표기 수정
  (라벨 텍스트 제거, `::after`만 표시)
- **`.gitignore`** — `docs/**/*.html` 생성 산출물 제외

## 2026-09-23 계정 모달 — 이메일 인증 코드(OTP) 로그인

- **`authSendOtp`/`authVerifyOtp`** (`auth-view.js`): `signInWithOtp`로 코드 발송 →
  6~8자리 코드 입력 → `verifyOtp({type:'email'})` — 리다이렉트 없이
  **PWA 안에서 로그인 완결** (매직링크는 브라우저로 열려 PWA 세션 불가)
- 로그인 폼에 `인증 코드 보내기 (앱/PWA)` 버튼 + 코드 입력 행 (발송 후 표시)
- 오류 매핑 추가: `Token has expired` → "인증 코드가 만료되었거나 올바르지 않습니다"
- **주의**: Magic Link 이메일 템플릿에 `{{ .Token }}` 추가 필요 (SUPABASE_DESIGN §A.7)
- 테스트: DOM 253개 (+3 common-auth)

## 2026-09-23 계정 모달 — 비밀번호 설정 (PWA 로그인 경로)

- **`authSetPassword`** (`auth-view.js`): 로그인 상태에서 `updateUser({password})`로
  비밀번호 등록 — 매직링크 가입 계정이 PWA(메일 링크가 브라우저를 여는 환경)에서도
  이메일+비밀번호로 로그인 가능해짐
- 계정 모달 로그인 영역에 비밀번호 입력 행 + `설정` 버튼, 6자 미만 로컬 검증
- SUPABASE_DESIGN §5·§A.7 갱신 — 비밀번호 미설정 이슈·PWA 매직링크 한계 해결 표기
- 테스트: DOM 250개 (+2 common-auth), 자산 125개

## 2026-09-23 Supabase Phase 2 — 스냅샷 클라우드 동기화

- **`src/sync.js` 신규**: `sync_snapshots` 테이블과 시험별 push/pull —
  페이로드는 backup.js의 논리 키→값 포맷 재사용(§4), `customer_items` 제외(§7).
  - 쓰기 훅: `state.js` `setDataWriteHook()` 콜백 — 순환 import 없이
    `safeSetItem` 성공 시 동기화 대상 키만 `sync_dirty` 표시 (메타 키 재귀 가드)
  - 로그인 시 변경마다 2.5초 디바운스 push(upsert), `online` 이벤트에서 미동기화 재시도
  - pull: 원격 최신 → 화이트리스트 적용 후 리로드; 로컬 dirty + 원격 최신 =
    충돌 → `showConfirm`으로 "클라우드 가져오기/이 기기 유지(=push)" 선택(LWW)
  - `device_id`(전역 UUID)·`sync_last_ts`·`sync_dirty` 키 추가 — 메타는 시험 스코프
- **UI**: 계정 모달에 동기화 상태 라인 + `지금 동기화` 버튼 + 개인정보 안내 문구
- **테스트**: DOM 248개 (+11 common-sync — 페이로드 수집/훅/디바운스/pull·
  충돌 양방향/실패/비로그인), import 0 오류, 자산 125개 (`src/sync.js` 등록)

## 2026-09-23 Supabase Phase 1 — 계정/로그인

- **Supabase 연동 기반**: `src/supabase-config.js`(프로젝트 URL·
  Publishable key — 공개 설계상 키, 보안은 RLS 담당) +
  `src/supabase-client.js`(vendor UMD lazy 로드·클라이언트 싱글턴·
  세션 헬퍼). `vendor/supabase/supabase.js` 2.116.0 self-host
  (`script-src 'self'`로 CDN 불가). 미설정 환경에서는
  `isSupabaseConfigured()` 게이트로 조용히 비활성.
- **로그인 모달** (`src/auth-view.js` + index.html): 설정 메뉴
  `계정 / 로그인` 항목 → 이메일+비밀번호 로그인·회원가입·매직링크.
  영문 오류를 한글로 매핑, 로그인 시 설정 라벨이 이메일로 전환.
  로그아웃 시 로컬 데이터 유지 안내.
- **인프라**: vercel.json `connect-src`에 `*.supabase.co` 추가,
  sw.js 자산 124개(외부 오리진은 기존 cross-origin 조기 리턴으로
  캐시 제외 — 변경 불필요 확인).
- **스키마**: `tools/supabase/schema.sql` — profiles·sync_snapshots·
  pro_codes + RLS + 가입 트리거 + redeem_code RPC.
- 테스트: DOM 237개 (+9 common-auth), import 0 오류, 자산 124개.

## 2026-09-23 모바일 실무 모드 학습도구 탭

- **모바일 학습 항목 펼침 경로**: `학습 도구` 펼침 라벨이 사이드바
  전용이라 모바일 실무 모드에서 학습 뷰로 갈 방법이 모드 복귀뿐이던
  문제 — 탭 바에 실무 전용 `학습도구` 탭 추가 (`data-click=
  toggleStudyTools`, 펼침 시 primary 컬러 표시). `toggleStudyTools`/
  `applyUiMode`가 `[data-click=toggleStudyTools]` 전체의 aria-expanded를
  동기화해 사이드바 라벨과 상태 일치. 실무 모드 탭 5→6개.
- 토스트 문구 "사이드바의 학습 도구" → "학습 도구"로 일반화 (모바일 대응).

## 2026-09-23 실무 모드 보강 + 모바일 설정 수정

- **실무 모드 학습 매뉴얼 숨김** (4189672): 학습 매뉴얼 버튼(사이드바·
  설정 패널·모바일 탭)에 `nav-study-only` 적용. 모바일은 신규
  `nav-practice-only` 클래스로 매뉴얼 탭 자리에 `실무매뉴얼` 탭을
  표시 — 학습 모드 복귀 시 원복.
- **설정 메뉴 모드 전환** (addd94d): 사이드바 푸터 토글은 모바일에서
  도달 불가 — 설정 패널에 `모드: 학습 모드` 항목 추가해 모든 화면
  크기에서 전환 가능. `applyUiMode`가 `.ui-mode-label`/
  `[data-click=toggleUiMode]` 전체를 일괄 동기화해 두 토글 상태 일치.
- **모바일 설정 드롭다운 클리핑 수정** (0ccb090): 768px 미디어쿼리의
  `.app-header{overflow:hidden}`이 헤더 아래로 펼쳐지는 설정 패널을
  잘라 모바일에서 설정 버튼이 무반응처럼 보이던 문제 — overflow 제거
  (넘침 방지는 기존 h2 말줄임+header-actions flex-shrink:0이 담당).
- **문서 동기화**: 학습 매뉴얼에 §12.5 학습/실무 모드 섹션 신설,
  메뉴 구성·모바일 탭 목록(14개) 정정, 실무 매뉴얼 허브 카드명
  `성분 사전` 반영, README 탭 바 목록 갱신.

## 2026-09-23 학습/실무 UI 모드 + 내비 자기설명성 개선

- **학습/실무 UI 모드** (`src/ui-mode.js` 신규): 합격 후 실무 중심 사용자를
  위한 모드 전환. 사이드바 푸터의 `학습 모드 ⇄ 실무 모드` 토글로 전환하고
  `ui_mode`(전역 키, GLOBAL_KEYS 등록)에 영속. 실무 모드 시
  `body.ui-mode-practice` + `.nav-study-only` 마킹의 CSS 규칙으로 학습·
  훈련 그룹(6항목)과 모바일 탭바 학습 탭을 숨기고, 접이식 `학습 도구`
  라벨로 필요 시 펼침(`ui_study_tools_open` 영속). 실무 모드 랜딩은
  `formula-view`(hasFeature 게이팅), 학습 전용 뷰에서 전환하면 자동
  리다이렉트. 실무 매뉴얼 버튼은 CSS order로 최상단 재배치.
- **내비 명명 통일** (e4bee31): 사이드바 `Formula OS`+pill`실무` →
  `실무 작업실`(3중 명명 해소), 모바일 탭 `포뮬러`→`실무`, `교재`→`교재읽기`,
  모의고사 아이콘 `fa-file-lines` 통일, 허브 `원료 검색` 카드 → `성분 사전`
  (dictionary-view 목적지와 정합), 훈련소 부제 6개 카드 범위로 확장.
- **모바일 탭바 스크롤 힌트** (e4bee31): `background-attachment:
  scroll/local` 조합의 순수 CSS 스크롤 섀도 — 양 끝 추가 항목 존재를
  스크롤 위치에 따라 표시/소멸.
- **테스트 픽스처 확장**: `injectCssFile()` — 실제 base.css를 `<style>`로
  주입해 jsdom에서 상태 기반 CSS 규칙(display:none 등)의 실제 캐스케이드
  검증 가능.
- **실무 모드 학습 항목 보정**: '자료·도구' 그룹의 교재 본문 읽기·교재 본문
  검색·학습 캘린더는 학습 기능 — 사이드바·모바일 탭에 `nav-study-only`
  추가하고 `STUDY_ONLY_VIEWS` 리다이렉트 목록에도 등록. 실무 모드에서
  남는 자료 항목은 성분 사전뿐.
- 테스트: 유닛 458, DOM 228 (+7 common-uimode), import 0 오류, 자산 120개.

## 2026-09-23 로그인 보완 2차 — type 전달·Enter·비밀번호 찾기

- **type 파라미터 전달** (결함 수정): token_hash 랜딩이 `type:'email'`로
  고정돼 신규 사용자의 Confirm signup 토큰(type=signup) 검증 실패 가능 —
  쿼리의 `type`을 `verifyOtp`에 그대로 전달. 템플릿은 Magic link=email,
  Confirm signup=signup으로 분기하도록 문서 갱신.
- **Enter 키 제출**: 이메일·비밀번호 칸→로그인, OTP·새 비밀번호 칸→각
  검증/설정 버튼 동작.
- **비밀번호 찾기 버튼**: 이메일로 로그인 메일을 보내 OTP 로그인 후 계정
  화면에서 비밀번호 재설정 — 분실 사용자 경로 확보.
- **모달 포커스 트랩**: trapFocus 적용 — Tab이 배경으로 빠지지 않음.
- **취소 안내 토스트**: token_hash 랜딩 취소 시 "코드로 계속 로그인" 안내.
- **쿨다운 지속화**: 재발송 쿨다운 만료 시각을 localStorage에 저장 —
  새로고침해도 남은 시간 유지.
- 테스트 +4 (DOM 263): type 전달, 취소 토스트, 쿨다운 저장, 비밀번호
  찾기, Enter 제출.

## 2026-09-23 Supabase 로그인 UX 통합 + 운영 견고화 (커밋 c07473f·b63e50f)

- **이메일 로그인 단일 버튼** (c07473f): 매직링크·인증 코드 버튼을
  `authEmailLogin`으로 통합 — signInWithOtp 메일 하나에 링크+코드 동봉.
  브라우저(링크)·PWA(코드) 동일 절차, 별칭으로 기존 핸들러 호환 유지.
  매직링크 랜딩 오류·성공 토스트 추가.
- **token_hash 랜딩** (이번): 메일 링크를 앱 도메인 `?token_hash=`로
  변경해 랜딩에서 확인 클릭 시에만 `verifyOtp`로 토큰 소비 — 메일
  스캐너·미리보기의 사전 소진 방지, iOS에 코드 경로 안내, Android
  링크 캡처 확률 상승, flowType 무관. 해시 랜딩은 하위 호환 유지.
- **운영 견고화**: `signInWithOtp`에 `emailRedirectTo: location.origin`
  명시, 발송 버튼 60초 재발송 쿨다운, OTP 입력 `one-time-code` 자동완성+
  공백 제거+6~10자리 허용, `createClient`에 `flowType:'implicit'` 명시 고정.
- **문서**: SUPABASE_DESIGN §A.7~A.8 — "두 변수는 독립적"을 "같은 일회용
  토큰의 두 표현"으로 정정, Confirm signup 템플릿 필수화, HTML 템플릿
  권장안, E2E에 신규 이메일 항목. SMTP/OTP 운영 런북 신규 등록.
- 테스트 +6 (DOM 259): 통합 버튼, 랜딩 오류·성공, token_hash 승인·취소,
  쿨다운 차단.

## 2026-09-23 UI 접근성·문서 보강 (커밋 816343e·a42a421·17f943a)

- **단일 시험 시 시험 선택 생략** (816343e): 초기 시험 피커를 `current_exam`
  미설정 + 등록 시험 2개 이상 조건으로 제한 — 시험이 1개뿐이면 바로
  대시보드 진입. 설정/탭 바의 '시험 전환' 버튼도 features 플래그 대신
  실제 등록 시험 수로 노출 제어. 멀티시험 추가 시 자동 복귀.
- **원료 DB CSV보내기** (a42a421): 성분 사전 검색창 옆 [CSV] 버튼 —
  현재 검색어·카테고리 필터가 적용된 목록을 저장. `filterIngredients()`
  추출로 가상 스크롤과 무관하게 현재 필터를 재계산(빈 결과 시 안내
  토스트, 전체 폴백 없음). 파일명에 DB 버전 포함, UTF-8 BOM.
  실무 매뉴얼 갱신 포함 — 법규 체크리스트 25→27항목 정정, 배치 CSV
  컬럼 명세표 추가.
- **주요 버튼 툴팁 보강** (17f943a): 아이콘 전용 버튼 aria-label 누락
  3건 수정(캘린더 월 이동·닫기 — AGENTS.md 규칙 위반). 삭제·초기화
  계열에 '복구 불가' 등 결과 명시 title, OX 판단·나가기 계열·인쇄 3종·
  플래시카드 평가 등 모호 라벨에 title 추가 — 동적 버튼 툴팁 19→45개.
- **OX 리스너 누적 버그 수정** (17f943a): `renderQuizQuestion`이 OX
  문제 렌더마다 버튼에 새 클로저 리스너를 추가해 이전 문제의 미소비
  리스너가 낡은 `currentQuiz.answer`로 이중 채점할 수 있던 선재 결함 —
  재렌더 시 기존 리스너 제거(`btn._oxHandler` 보관). 셔플 우연에 따라
  간헐 실패하던 DOM 테스트도 함께 안정화.
- 테스트: 유닛 458, DOM 221 유지.

## 2026-09-23 Formula OS — 개정 감지·기한 제안·목록 필터·CSV

포뮬러 재검증 워크플로와 배치 목록 운영 편의를 보강했다.

- **고시 개정 감지**: `countChangedStandards` — 포뮬러에 저장된 원료별
  `snapshot`(type/limit)을 현재 원료 DB와 비교해 기준이 바뀐 원료 수를 집계.
  목록 카드에 '기준 변경 N' 배지, 계산기 진입 시 재검증 배너(`formula-std-warn`)
  표시. 스냅샷 없는 원료·DB 미등록 원료는 제외(기존 unknown 판정이 커버).
- **사용기한 자동 제안**: `suggestExpiryDays` — 보존제 유무·수상 여부로
  권장 일수 제안(보존제 180일 / 무보존제 수상 14일 / 무보존제 무수 90일).
  배치 신규 폼에서 사용기한이 비어 있을 때만 채우고 '자동 제안 N일' 힌트 표시 —
  사용자 수정 가능, 법적 유효기간 아님. `formula-stability.isPreservative` 재사용.
- **배치 목록 필터**: 처방명 셀렉트·고객명 텍스트·QC 상태(이상/정상/미기록)·
  인도 여부. 필터 상태는 모듈에 유지, 필터링 결과 건수를 사용량 배지에 병기.
  조건 불일치 시 필터 전용 빈 상태 + 초기화 버튼.
- **배치 CSV보내기**: `batchExportCsv` — 필터 적용 목록을 BOM CSV로 저장
  (`batches_YYYY-MM-DD.csv`). 배치번호·처방·고객·조제일시·QC 요약·위생·
  실측 pH·기한·인도일·조치·LOT·DB버전·메모 포함.
- 테스트: DOM +7 (배치 5 + 계산기 2) — 유닛 458, DOM 218.

## 2026-09-23 Formula OS — 배치 추적성·기록 보강 2차

조제 기록의 법적 추적성과 품질 기록 완결성을 보강했다.

- **원료 LOT 추적**: 배치 폼이 처방 원료를 원료 장부와 이름으로 자동 매칭해
  사용 LOT을 `materialLots` 스냅샷으로 기록 — 복수 LOT은 select로 선택
  (기한 임박 순 기본값, 선입선출). 상세·조제 기록지에 표시.
- **고객 인도일**: `deliveredAt` 필드 — 시행규칙 판매내역서 근거. 목록에
  인도/미인도 배지, 상세·기록지에 표기.
- **재고 부족 경고**: 총량×농도 소요량 vs 장부 잔량(같은 단위만 합산) 비교 —
  부족 시 폼에 실시간 경고. 총량·단위 변경에 반응.
- **QC 이상 조치(disposition)**: 폐기/재조제/보류 열거형. 이상 배치에 조치
  미기록 시 목록에 '조치 미기록' 경고 배지.
- **조제 기록지 서명란**: 조제자(조제관리사)·확인자·확인일 서명 줄 추가.
- `findMaterialsByName` 신규 — 동명 원료 복수 LOT 전체 조회 (기한 임박 순).
- 테스트: 유닛 +2(458), DOM +4(211).

## 2026-09-23 Formula OS — 배치 안전·추적성 보강

조제 기록(배치)에 안전 검증과 추적성 필드를 추가했다.

- **고객 알레르기 교차검증**: 배치 폼에서 고객 카드 선택 시 알레르기 이력
  원료가 처방에 포함되면 실시간 경고 배너 표시 + 저장 전 확인 대화상자
  (`findAllergyConflicts`, 양방향 부분 일치 — "파라벤" 이력 ↔ "메칠파라벤"
  원료). `batchSave`가 async로 전환.
- **회차별 실측 pH**: 배치에 `phMeasured` 필드 추가 (0~14 정제). 폼 입력·
  상세 표시·조제 기록지 QC 표·보정 가능 필드에 포함.
- **checkSnapshot DB 버전**: 배치 생성 시점의 원료 DB 버전(`dbVersion`)을
  스냅샷에 기록 — 고시 개정 후에도 "당시 검증 기준"을 특정 가능. 상세·
  인쇄 기록지에 `원료 DB v…` 표기.

## 2026-09-23 DOM 시나리오 테스트 Phase 1~5 완료 (커밋 b040b9a~106d769)

`docs/dev/DOM_TEST_DESIGN.md` 매트릭스 기반으로 Vitest+jsdom DOM 테스트를
전 뷰로 확장 — 48개 → **204개** (27파일).

- **Phase 1** 실무 코어(27): 내비·고객 CRUD·원료 장부·법규 체크리스트
- **Phase 2** 실무 잔여(28): 배합 계산기·포뮬러 목록·배치(QC·위생·채번)·인쇄 산출물
- **Phase 3** 학습 코어(28): 퀴즈·플래시카드·대시보드·약점 복습 — helpers에
  `seedStudyData`/`seedProgress`/`stubRegistry`/`resetStudyState` 픽스처 추가
- **Phase 4** 학습 확장(66): 데일리·뽀모도로·훈련소·캘린더·모의고사·리더·검색·사전
  (fake timers·DataLoader 스텁)
- **Phase 5** 공통(34): 테마·오프라인·스크래치패드·a11y·매뉴얼/문제집/시험선택 뷰어
- **테스트가 잡아낸 실버그 5건**: 계산기 빈 상태 배너 미해제, 배치 보정 모드 QC
  데이터 손실(라디오 렌더 순서), 인쇄 시 전성분·기록일시 누락(currentDraft 메타),
  약점 퀴즈 정답 시 약점 미해제, 기본 시험 선택 시 불필요 리로드
  (getCurrentExamId→getActiveExamId)

## 2026-09-23 띄어쓰기 교정 + 문서 전수 동기화 (커밋 95504a6·9ac3e34)

- **띄어쓰기 교정**: `CSV로보내다`→`CSV로 보내다`, `JSON으로보내기`→`JSON으로 보내기`,
  `CSV보내기`→`CSV 보내기` 등 조사+동사 붙여쓰기 일괄 교정 (문서·버튼 title·
  토스트·주석). 이후 매뉴얼 2종 전수조사 — 의존명사(것·수·때·경우·등·정도·뿐)·
  조사+동사·명사+공백+조사·영문+조사 패턴 스캔 결과 잔여 오류 0건 확인
- **문서 동기화**: TESTING.md 테스트 표에 Phase A~D·CSV 테스트 파일 6종 추가
  (합계 398→454), AGENTS.md·README.md·ARCHITECTURE.md의 오래된 테스트 수
  (372/250/259) 일괄 정정, README Formula OS 행에 CSV·Phase A~D 기능 반영

## 2026-09-23 Formula OS — 고객·원료 CSV 가져오기/보내기

고객 관리·원료 장부에 CSV 상호운용 추가 — 기존 Excel 장부 데이터를 가져오고
현재 데이터를 CSV로 보내 재활용할 수 있다.

- **`src/csv-utils.js`** (신규): `parseCsv`(RFC4180 따옴표 필드·필드 내 쉼표/개행·
  구분자 `,`/`;`/탭 자동 감지) · `decodeCsvBuffer`(UTF-8 BOM → UTF-8 strict →
  **EUC-KR/CP949 폴백** — 한국 Excel CSV 대응) · `csvToObjects`(헤더 정규화 —
  소문자·공백 제거, 한/영 별칭 매핑) · `toCsv`(UTF-8 BOM + 필요 시 따옴표 +
  CRLF, Excel 한글 호환) · `downloadCsv`(data URI 다운로드)
- **스토어**: `importCustomers`/`importMaterials` — sanitize 경유 후 일괄 삽입,
  중복 건너뜀(고객=이름, 원료=이름+LOT), 기존 항목 덮어쓰지 않음, 이름 없는 행
  제외, Free 한도(20명/30종) 초과분 집계 → `{added,skipped,duplicate,overLimit}`
- **뷰**: `formula-customer.js`/`formula-material.js`에 헤더 맵
  (`CUST_CSV_COLS`/`MAT_CSV_COLS`)·행 변환(목록 `;`/`|`/`/` 분리, 임신 표기·
  날짜 `YYYY.M.D`/`YYYY/M/D` 정규화)·가져오기(showConfirm 건수 확인 후
  요약 토스트)·보내기·양식 다운로드 핸들러. 헤더 버튼 3개 + 숨김 file input
  (기존 JSON 가져오기 패턴과 동일)
- **테스트**: `csv-import.test.js` 17건 (파서 9 + 가져오기 8) — 유닛 437→454
- **문서**: `formula_manual.md` §3·§5에 CSV 헤더 표·인코딩 안내 추가

## 2026-09-22 Formula OS 업무 확장 Phase A~D (커밋 f6cd274·5b9c356·9bce945·0389ed7)

조제관리사 9개 업무 영역 전체 커버 (설계: FORMULA_OS_WORKFLOW_DESIGN.md).
처방(formula)·고객(customer)·조제 회차(batch)·원료(material) 엔티티 분리 +
법규 준수 자가점검. 허브 카드 7개 + 서브내비 칩 6개(인뷰 탭 대신 절충안 채택).

- **Phase A — 조제 기록·인쇄** (f6cd274): `store-utils.js`(스토어 공통 헬퍼,
  formula-store 공용화) · `batch-store.js`(배치번호 YYYYMMDD-NN 채번, identity
  불변, QC·위생만 보정, `checkSnapshot` 보존, 50건 한도) · `usage-guide.js`
  (제형 9종 템플릿 + 원료 주의 규칙 7종 + 임신/알레르기 병기) ·
  `views/formula-batch.js`(목록·폼·상세) · `views/formula-print.js`
  (기록지·70mm 라벨·안내문) · 서브내비 칩 `formulaSubNav()` 도입
- **Phase B — 고객 관리** (5b9c356): `customer-store.js`(20명 한도, 상담 이력
  append-only, 삭제 시 참조 해제+인라인 스냅샷 보존) · `views/formula-customer.js`
  (목록·폼·상세+처방/배치 역참조) · `formula.customerId` 참조 필드(기존 포뮬러
  무수정 호환) · 계산기 고객 카드 불러오기/저장 · 배치 폼 고객 select
- **Phase C — 원료 장부** (9bce945): `material-ledger.js`(30종 한도, 기한 상태
  파생 — expired/soon(30일)/ok/none, `daysUntilExpiry` 자정 기준 D-day) ·
  `views/formula-material.js` · 계산기 원료 행에 장부 기한 배지(이름 정확 매칭)
- **Phase D — 법규 준수** (0389ed7): `views/formula-compliance.js` — 6개
  카테고리 25항목 체크리스트(영업·자격/시설·위생/혼합·소분/기록/표시/안전·보고)
  + 법령 문서 10종 링크(`ExamViewer.openExam`, ref_md 경로) + 앱 기능 바로가기.
  체크 상태 `formula_compliance` 키 영속(시험별 격리·백업 포함)
- **수정한 결함**: `updateBatch` qc 객체 통째 덮어쓰기 → 필드 단위 병합 /
  `daysUntilExpiry` 기한 당일 오차 → 자정 기준 정정(배치 배지도 동일 함수로
  통일) / `formula-stability.js` SHELL_ASSETS 누락 등록 /
  고객 select 복원 타이밍(populate → writeCustomerInputs 순서 보장)
- **스토리지 키**: `batch_items`·`customer_items`·`material_items`·
  `formula_compliance` — 전부 scopedKey 시험별 격리 + BACKUP/RESET_KEYS 등록
- **테스트**: 신규 유닛 39건(batch-store 10·usage-guide 7·customer-store 9·
  material-ledger 9·formula-compliance 4) — 유닛 398→437
- **문서**: FORMULA_OS_WORKFLOW_DESIGN.md 전체 갱신(구현 완료 상태·실제 스키마·
  UI 절충안·로드맵), ARCHITECTURE.md 모듈 다이어그램·데이터 테이블

## 2026-09-22 전성분 표시 자동 생성 (fullIngredients)

안정성 '양호' 확인된 배합만 화장품법 전성분 표시 규칙으로 성분 순서를 생성·저장.

- **`buildFullIngredients(ingredients)`** (formula-store.js) — 1% 초과 함량
  내림차순 → 1% 이하·농도 미기입 → 색소(타르색소 호수·CI 번호·산화철·카민 등
  이름 패턴 탐지)는 함량 무관 최하단
- **스키마**: `formula.fullIngredients: string[]` — sanitizeFormula에서
  stability.result === '양호'일 때만 생성, 아니면 빈 배열. serialize/import 왕복
- **UI**: 포뮬러 카드에 전성분 행(2행 클램프), 조제 기록지 인쇄 '제형 안정성'
  섹션에 '전성분 표시' 행 추가

## 2026-09-22 안정성 확인 기록 일시 자동 부여(recordedAt)

수동 일자/일시 입력 필드를 제거하고, 저장 시각을 자동 기록하는 방식으로 전환.

- **스키마**: `stability.date` → `stability.recordedAt` (YYYY-MM-DDTHH:MM) —
  저장 시 자동 부여, 내용(method·result·note)이 바뀐 경우만 갱신되고
  동일 내용 재저장은 기존 시각 유지
- **UI**: 일자 입력 필드 제거(방법·결과·메모만), 패널·인쇄에 `기록 YYYY-MM-DD HH:MM` 표시
- 확인 방법 enum에 `가혹 시험` 추가(가속 다음 순서)

## 2026-09-22 Formula OS 안정성 실험 확인 기록 추가

규칙 경고는 "가능성"일 뿐 실제 안정성은 실험으로만 확정되므로, 사용자의
실험 결과를 포뮬러에 기록·추적하는 확인 레이어 추가.

- **스키마**: `formula.stability {method, result, date, note}` —
  `STABILITY_METHODS`(실온 경시·가속·동결-융해·원심분리·보존력·기타),
  `STABILITY_RESULTS`(양호·이상 발견) enum 정제, 날짜 YYYY-MM-DD만 허용,
  전부 빈 값이면 null. serialize/import 왕복 보존
- **UI**: 제조 정보 접이식에 '안정성 실험 확인' 필드(방법·결과·일자·메모),
  접이식 요약·안정성 패널 상단에 확인 기록 표시(양호=초록·이상=빨강),
  My 포뮬러 카드에 '안정성 확인/안정성 이상' 배지, 조제 기록지 인쇄 반영
- **설계**: 규칙 경고(formula-stability.js)와 확인 기록(formula-store.js)은
  별개 축 — 경고는 사용자가 직접 해소·확인하는 참고 정보로 유지
- **테스트**: formula-store.test.js에 스키마·왕복 테스트 2건 추가

## 2026-09-22 Formula OS 제형 안정성 체크 (formula-stability.js) 신규

배합비·배합방법이 제형 안정성에 미치는 영향을 평가하는 세 번째 검증 축 추가
(법규 검증 formula-check.js·추천 formula-rules.js와 분리). 큐레이션 규칙 테이블
기반 결정적 평가 — 규칙에 없는 조합은 미판정(보수 원칙).

- **`src/formula-stability.js`** — `evaluateStability(items, index, ctx)` →
  `{warnings:[{level:'warn'|'info', msg}], phaseSums}`
  - 상 비율: 수상부+유상부인데 유화제 미감지(warn), 유화제:유상부 <10%(warn),
    점증제 없는 에멀전(info), 유화 대상 없는 유화제(info)
  - 상호작용: 카보머×양이온성(warn), 음이온×양이온 계면활성제(warn),
    비이온성 계면활성제 >5% 시 보존제 미셀 흡착(info)
  - 배합방법: 열 민감 원료(비타민C·레티놀·히알루론산·알부틴·콜라겐·펩타이드·
    우레아·시카·향료)의 가열 단계 배치(warn/info), 카보머 중화 단계 누락(info),
    에멀전인데 절차에 유화 단계 누락(info)
  - pH 적정대: 실측 우선·목표 폴백으로 원료별 권장 범위(카보머·살리실산·AHA·
    비타민C·레티놀·나이아신아마이드·알부틴·MIT) 이탈 경고(warn)
  - 원료 분류는 DB `category` 우선 + 이름 패턴 폴백 (미등록 원료도 평가)
- **UI**: 원료 행 아래 `#formula-stability` 패널(aria-live) — 입력·단계·
  pH·절차·제형 변경 시 실시간 재평가. My 포뮬러 카드에 '안정성 n/참고 n'
  배지, 조제 기록지 인쇄에 '제형 안정성 참고' 섹션 추가
- **테스트**: `tests/unit/formula-stability.test.js` 22건 — 규칙별 발화·
  미발화 불변식 커버

## 2026-09-21 상위 문서 Formula OS 반영 점검·동기화

Formula OS 기능 추가(고객 안전 필드·추천 규칙·제조 단계·인쇄·JSON 공유·원료 DB 이력·계산기 UI 재구성)가 상위 문서에 반영되었는지 전수 점검 후 갱신.

- `SPEC.md` — §3.18 Formula OS 요구사항 표 신설(FO-01~11) + 뷰·도메인 모듈 표 추가, 단위 테스트 수 248→372 정정
- `CONTENT_WORKFLOW.md` — 원료 경로 `content/exams/cosmetic/ingredients/` → `참조자료/원료/` 정정, §3.6 "원료 데이터 변경 + DB 버전 절차" 신설 (`db_version.json` history 누적 규칙, `colorants_ingredients.md`는 색소 참조 문서로 파싱 대상 아님 명시)
- `TESTING.md` — 단위 248→372·DOM 11→21 정정, 누락 9개 테스트 파일(formula-store/rules/check, combo-transform, statement-tracker, questions, data-loader, exam-context, storage-key-sync) 추가 + §4.11~4.13 상세 분류 신설
- `ARCHITECTURE.md` — 뷰 계층에 formula 모듈군 추가, 데이터 테이블에 registry `ingredients` 메타(version·history·contentHash)와 Formula OS 모듈 행 추가, 빌드 파이프라인 원료 경로 정정
- `README.md` — 기능 표에 Formula OS 행 추가, 성분 사전에 DB 버전/이력 조회 명시
- `FORMULA_OS_DESIGN.md`·`PASS_TO_PRACTICE_STRATEGY.md`·`FEATURE_PROPOSALS.md` — Phase 5-A 구현 완료 상태 주석 추가 (제안 문서가 미구현으로 오인되지 않도록)
- `AGENTS.md` — 디렉토리 트리에 `참조자료/원료/` 항목 추가

## 2026-09-21 배합 계산기 UI/UX 재구성 (sticky 요약·액션바, 카드형 행, 접이식 섹션)

계산기의 단일 세로 폼 구조를 "상단 요약 / 중앙 작업 / 하단 액션" 3층으로 재편.

- **상단 고정 요약바** (`.fcb-top`, sticky): 총 제조량·단위 이동 + 배합률 합계
  (100% 판정 배지) + 규정 검증 건수(`금지/초과/확인/정상 n`) 상시 표시
- **하단 고정 액션바** (`.fcb-bottom`, sticky): 포뮬러 이름·저장·인쇄·JSON —
  모바일에서 탭 바 높이만큼 오프셋(`calc(76px + safe-area)`)
- **원료 행 카드형**: 6열 그리드 → `f-row-top`(이름·검증 배지·삭제) /
  `f-row-bottom`(배합률·투입량·단계) 2줄 카드
- **접이식 섹션**: 고객 정보(`formula-fold-customer`)·제조 정보
  (`formula-fold-process` — pH·절차·메모 통합)를 `<details>`로 축소.
  `updateFoldSummaries()`가 제목 옆에 내용 요약 표시, 기존 포뮬러 열기 시
  내용 있는 섹션만 자동 펼침
- **빈 상태**: 이름 있는 행이 없으면 `formula-empty-state` 안내 카드 —
  '추천 베이스 불러오기'(제형 미선택 시 세럼·에센스 기본) +
  `formulaOpenCustomer`(접이식 섹션 열고 고객명 포커스)
- **버그 수정**: `formulaDelete`·`formulaRuleReset`이 `showConfirm`을
  콜백 방식으로 호출해 동작하지 않던 문제 — Promise `await` 방식으로 교정
- **정리**: `formula-rows-head`·`formula-sum`·`formula-customer`(fieldset)·
  `formula-save-row`·`formula-actions-row` 마크업·CSS 제거,
  `formula-phase-sums`는 행 목록 푸터로 이동

## 2026-09-21 완전 대칭 멀티시험 마이그레이션 (content/exams/cosmetic/ + data/exams/cosmetic/)

기본 시험(cosmetic)만 `content/`·`data/` 루트를 특권적으로 쓰던 비대칭 구조를
폐기하고, 모든 시험이 `content/exams/<id>/`·`data/exams/<id>/`를 갖는 대칭
구조로 이행. `content/`·`data/` 루트에는 전역 파일만 남는다:
`content/exams.json`·`data/exams.js`(시험 목록), `data/audio_manifest.js`
(시험 id 키 분리 — 전역 유지), `data/docs_md/`(앱 공용 문서).

- **파일 이동**: `content/*` → `content/exams/cosmetic/` (exams.json 제외),
  `data/*` → `data/exams/cosmetic/` (exams.js·audio_manifest.js·docs_md/user_manual.js 제외)
- **exams.json**: `contentRoot`/`dataRoot`/`manifestPath`/`registryBundle`을 중첩 경로로 갱신
- **런타임**: `exam-context.js` 폴백 → `content/exams/<id>`/`data/exams/<id>`;
  `index.html` 정적 스크립트 → `data/exams/cosmetic/registry.js` 등
- **빌드**: `tools/build/index.js` — `IS_DEFAULT_EXAM`을 경로 문자열 비교가 아닌
  `default` 플래그로 판정; `EXAM_ID` 미지정 시 exams.json의 default 시험으로 해석.
  `textbook.plugin.js`의 `content/` 하드코딩 → `ctx.contentRoot` 사용
- **도구 전수 전환**: `getDefaultExamRoots()`/`getExamTargets()` 기반으로
  check_ref_subjects·check_reflayout·audit_*·citation 계열·combo/ox 드릴 등
  `content/`·`data/` 직접 경로 제거
- **audio_manifest 버그 수정**: 스캔 공백 시 기존 매니페스트 보존 로직이
  구 contentRoot 경로를 그대로 잔존시키던 것을, 보존 시 현재 contentRoot로
  경로 재작성하도록 수정
- **무결성 규칙**: `.gitignore`(`content/**`)·`.vercelignore`(`content/exams/*/`)
  와일드카드가 중첩 시험까지 커버; `vercel.json` 캐시 헤더에 `/data/audio_manifest.js`
  전역 규칙 추가; `sw.js` SHELL/DATA/MD 자산·BYPASS 패턴을 신규 경로로 갱신
- **진도 보존**: localStorage 키는 시험 id(`cosmetic:`) 네임스페이스 기준이라
  물리 경로 이동과 무관하게 사용자 진도 유지

검증: `check:content --quick` 전 단계 통과 · 유닛 294 · DOM 21 · 파서 등가성 ·
verify:assets 101개.

## 2026-09-21 콘텐츠 의존성 통합 검증 도구 (check:content) + 감사 도구 현행화

교재 교체 등 대규모 콘텐츠 변경 후 흩어진 검증 도구를 한 명령으로 실행하는
`npm.cmd run check:content`(`tools/check_content.js`) 추가 — 인용 라인 동기화 →
ref_md 과목 귀속 → 레이아웃 → 콤보 드릴 → 파서 등가성 → 임포트 → 셸 자산 →
카드 감사 → 유닛/DOM 테스트를 계층 순서대로 실행하고 실패 단계의 출력을 모아
한 장짜리 리포트로 출력. `--build`(build:data 선실행), `--quick`(DOM 생략) 옵션.

**선행 결함 수정 — `audit_card_quality.js`**: 런타임 파싱 전환 이후 폐지된
`data/subjects/*.js` 번들을 여전히 읽고 있어 "과목 0개"로 무동작하던 것을
`plugin.build()` 직접 파싱으로 전환(check_parser_parity와 동일 경로).
링크 감사도 원시 MD의 `../참조자료/...` 링크 존재 여부를 검사하도록 복구
(기존 `data-ref-html` 정규식은 원시 MD에 존재하지 않아 사실상 무동작).
과목 간 동일 카드(시험 범위 중첩, 정상)는 오류에서 제외하고 정보로 집계 —
과목 내 중복만 오류로 유지.

`CONTENT_WORKFLOW.md`에 "3.1-1 과목 교재 전체 교체 체크리스트"(7계층) 추가.

## 2026-09-21 교재 전체 교체 용이화 리팩토링 (R2→R1→R5)

**R2 — `check:manifest`** (`tools/check_manifest.js`): manifest 선언 ↔ 실제 파일
정합성을 빌드 전에 검증 — 교재/문제은행 파일 존재, subjects key·order 유일성,
exams→subjects 해석, 과목별 자산(glossary·number-drills·ref_md 폴더),
교재 파서 계약(챕터 헤딩·마커). `check:content` 첫 단계로 편입.

**R1 — 과목 식별자 단일화**: 하드코딩 매핑을 manifest/references.json 파생으로 교체.
- `check_ref_subjects.js`: `SUBJECT_DIRS` 상수 제거 → manifest의 dir↔order 사용
- `trainer-drills.js`: `SID_SUBJECT` 상수 제거 → DataLoader.registry에서 sid 접두사 해석
- `ref-statements.js`: `DOC_SUBJECT_RULES` → `references.json`의 `docSubjectRules`로 이전
  (내장 목록은 폴백으로 유지) — 문서→과목 귀속 진실을 콘텐츠 설정에 집중
- `build_keyword_index.js`: `_DIR_PRIORITY` 4과목 하드코딩 → refDirs 키에서 파생

**R5 — ID 마이그레이션 자동 생성** (`tools/build_id_migration.js`, build:data 체인 말미):
`data/card_terms_snapshot.json`(커밋 대상, 직전 빌드의 ID·term 스냅샷)과 현재 파싱을
비교해 term이 유일하게 일치하는 구ID→신ID 맵을 `data/id_migration.js`로 생성.
런타임은 `state.js`의 `cleanOrphansForSubject`가 고아 정리 전 이관을 적용 —
교재 갱신으로 ID 해시가 바뀌어도 term이 유지된 카드의 학습 진도가 보존된다.
index.html에 번들 로드 추가, sw.js DATA_ASSETS 프리캐시 편입(build/index.js 자동 목록).

**귀속 불일치 7건 정리**: 다수 과목이 공동 인용하는 문서(CGMP 고시·주의사항
규정 등)를 `references.json`의 `multiSubjectDocs`에 명시 등록 — 물리 폴더가
귀속의 진실이고 규칙은 폴백 기준선이므로, 의도된 다과목 인용을 불일치로
오판하지 않게 함. `check:refsubjects --strict` 기준 불일치 0건으로 게이트 정상화.

※ R3(앵커 인용)·R4(과목 코로케이션)는 보류 — R3은 전면 교체 시나리오에서
앵커도 의미 재검토가 필요해 실익이 작고(라인 드리프트는 지문 재탐색이 처리),
R4는 수백 파일 규모라 별도 단계로 진행 예정.

## 2026-09-20 ref_md PDF→MD 전면 재변환 (품질 개선)

구 변환(pypdfium2 raw 추출)은 한국어 PDF의 좌표 기반 공백을 유실해
18개 별표 문서가 공백 <7%로 판독 불가였고 표는 셀 단위로 파편화돼 있었다.
`tools/convert_ref_pdfs_v2.py`(신규, pdfplumber + pymupdf)로 41개 전 문서를 재변환:

- **공백 복원**: 문자 좌표 간격으로 공백 재구성 — `품질관리업무를적정하고` →
  `품질관리 업무를 적정하고`. `ㆍ` 등 누락 특수문자도 복원
- **표 구조화**: `find_tables()`로 MD 표 출력 — 사용불가원료(687명)·
  사용제한원료·행정처분기준 등이 정상 행 구조로 복원. 선이 부분적인 표는
  고아 데이터 줄 감지 후 텍스트 정렬 전략으로 자동 재시도(알레르기 25종의
  CAS 열 복원), 상수 열 쌍(`CAS`+`No`) 자동 병합
- **이미지 보존**: pymupdf로 원본 바이트 추출, y좌표 위치에 `![이미지]` 참조 삽입
- **지표**: 전 문서 공백 16.7~27.6%로 균일화(기존 2.6~25%), 손상 표 0건

추출기 연동(`ref-statements.js`): 정상 MD 표 행에서 멤버 열 추출 추가
(헤더 매칭 → 이름형 열 스코어링 폴백, 연번 열 회피, 페이지 경계 표 병합).
오답 풀을 이름형↔문장형 멤버 단위로 분리(길이로 정답이 들통나는 문제 방지),
토픽·멤버 필터 보강(문장형 토픽 강등, 조사/마커 시작 조각 제외).

**산출**: 참조자료 문항 139 → **155문**(과목2 76→92로 cap 도달, 총 910문).
검증: 생성 오류 0 · 유닛 294 · 파서 등가성 · imports · assets ·
check_combo_pilot 전 과목 무결성.

## 2026-09-20 참조자료 원문(ref_md) 복수정답형 생성 파일럿

`content/참조자료/ref_md` 법령·고시·별표 원문에서 검증된 진술 원자를 추출해
복수정답형 풀을 확충 — `tools/build/ref-statements.js` 신규 + `build_combo_drills.js` 연동:

- **추출 원자 3종**: 정의조항(용어↔정의 교차 결합으로 거짓 생성), 조문 열거
  목록(각 호/목 멤버십), 연번 표(알레르기 25종·색소) + 별표 계층 목록(유형별 주의사항)
- **발문 안전 규칙**: 멤버십 발문만 사용(`…에 해당하는 것을`) — `옳은 것` 발문은
  다른 목록의 참인 사실을 거짓 표기하는 모순이 되므로 금지. 인용 용어 주제 또는
  「문서」제N조 인용 발문
- **품질 게이트**: 공백 소실 문서(<7%)·손상 표 제외, 멤버 정화(균형 괄호·
  포괄조항·특수기호), 같은 조 목록 오답 배제, 목록 간 ≥60% 겹침 중복 방지
- **산출**: 참조자료 문항 139개(과목1 +35 / 과목2 +76 / 과목4 +28) — 전량
  복수정답(참 2~3), citation `📖 문서약칭 제N조`, 태그 `참조자료`
- **총량**: 755 → **894문** (100/234/255/305). 과목4는 법령 밖 영역
  (피부생리·관능평가·상담)이라 ref_md로 추가 확충 불가 — 한계로 기록
- 설계 문서 §6-3c 신설 — 추출 규칙·품질 게이트·과목 귀속·한계 문서화

## 2026-09-20 복수정답형 문항 품질 감사 반영

외부 감사(1,000문 정합성 점검) 지적사항 반영 — `tools/build_combo_drills.js` + `src/questions.js`:

- **옵션 letter 정렬**: `generateComboOptions`가 members를 라벨(ㄱ→ㅁ) 순으로 정렬 — 약 70% 옵션이 뒤섞여 있던 문제 해소. MD 출력도 동일 관례로 재정렬(파일럿 대비)
- **원본 정답 누출 차단**: `sanitizeExplain` — 소스 해설의 `정답: ②…` 라인을 번들 explain 저장 단계에서 제거 (과목2 Q217 사례), MD 출력 필터는 이중 안전장치
- **빈칸형 복수정답형 제외**: blank 254문은 정답이 하나뿐이라 100% 단일정답 → "참 진술 하나 찾기"로 공략 가능. 복수정답형 풀에서 제외하고 원본 단답형으로만 출제 (1,000→746문 + 재조합 9 = **755문**)
- **개념 재조합 복수정답**: 같은 교재 구간(conceptId = 첫 L####)의 fact 진술을 모아 참 2~3 + 거짓 2~3 구성 — 진짜 복수정답 복수정답형 9문(0/1/6/2). 챕터 단위는 입자가 커서 이질 진술이 섞이는 문제가 있어 L#### 단위로 한정. 근접 중복(부분문자열·공통 접두사≥60%) 방어, citation에 L####·진술별 explain에 원본 문항 포인터 부여. 진술 `sid` 재사용으로 취약 추적 연속
- **오답 선지 개선**(적용 후 폐기된 blank 경로에 구현됐던 것): 정답 유형 분류 `/^\d/` 정정(ISO 16128 류 오분류 방지) — blank 파이프라인 제거로 미적용이나 이력 보존

검증: 생성 오류 0건 · 유닛 294 · check_combo_pilot 정답분포 ①~⑤ 15~25% 균형

## 2026-09-20 전체 리뷰 후속 + 리팩토링 12항목

### 전체 리뷰 후속 수정 (cf1e721)
- SW `cache.put` 전략 함수 전부 `await` (respondWith settle 후 SW 종료로 캐시 유실 방지)
- `_loadScript` 리스너 부착 후 `dataset.loaded` 재확인 (settle 경합 방어)
- `getSubjectOrders` `Number.isFinite` 필터, `manifest.subjects` 배열 가드
- `types.js` 주석 정정 + `exams.json`에 `data/exams/` 겸용 주의 명시

### 리팩토링 12항목
1. **data-loader 틱 일원화**: 호출부 `setTimeout(r,0)` 10곳 → `_loadScript` 내부 resolve로 흡수
2. **checkJs 진단 정리**: textbook-parser/charts/exam-context/state/markdown-parser/audio_manifest 잔여 진단 해소
3. **테마 키 드리프트 가드**: `storage-key-sync.test.js` — theme-init/exam-context 리터럴 ↔ STORAGE_KEYS 일치 강제
4. **app.js 핸들러 브리지 통합**: 개별 `window.X=` 나열 → `DELEGATED_HANDLERS` 단일 맵 + `Object.assign(window, ...)`, delegation-guard 테스트가 맵 구조 인식
5. **Mermaid 공용화**: `src/mermaid-render.js` 신규 — reader/search/manual-viewer의 동일 코드 3벌(~185행) 통합
6. **시뮬레이터 결과 분리**: `submitExam`의 결과 렌더링(과목/단원 분석, 과락·합격 피드백) + `_chapterForQuestion` → `exam-sim-review.js` 이관 (simulator 1,104→938행)
7. **드릴 파이프라인 공용화**: `trainer-drills.js` O/X·복수정답형 setup/start/next/result 골격 → `DRILL_TYPES` 설정 맵 + 공용 함수, 공개 API 래퍼 유지
8. **참조자료 멀티시험화**: `pdf-registry.js`/`keyword-index.js` 생성 모듈을 시험별 테이블 맵(`_EXAM_TABLES`/`_EXAM_GLOSSARY_INDEX`)으로 전환, `getRefTables()`/`getGlossaryIndex()`가 활성 시험 해석. 빌드 도구는 exams.json 전체 순회, 파생 경로는 시험별 contentRoot로 계산
9. **sw 자산 집계**: `MD_ASSETS`/`DATA_ASSETS` 생성이 모든 시험 순회 + 디스크 존재 확인으로 변경 (기존: 기본 시험만)
10. **data/exams/ 경로 중복**: exams.json note에 겸용 주의 명시 (cf1e721에서 처리)
11. **동적 PWA 매니페스트**: `src/pwa-manifest.js` — 활성 시험 이름/설명으로 blob 매니페스트 주입(정적 파일은 폴백), `vercel.json` `manifest-src`에 `blob:` 허용
12. **테스트 보강**: `exam-context.test.js`(활성 시험 해석/네임스페이스/레거시 정리 12건) + `data-loader.test.js`(레지스트리 조회 7건) 신규, `pdf-registry.test.js`를 getRefTables 기반으로 갱신
- **+α**: `SHELL_ASSETS` 프리캐시 누락 모듈 12개 보충 (router/pomodoro/study-calendar 등)

## 2026-09-20 모의고사 결과 분석 강화 + 복수정답형 버튼 단일화

- **복수정답형 모의고사 버튼 단일화** (39eec88): 과목 카드의 40문/60문/전체 3칩 → "복수정답형 모의고사" 버튼 1개. 클릭 시 카드 내 문항 수 선택 행 펼침(20/40/60/전체 N문, 풀 크기에 맞춰 필터링). `data/drills/combo_index.js` 신규(과목별 실제 문항 수, 파일럿 포함 — 102/250/250/408)로 "전체 N문" 표기. `DataLoader.loadComboIndex`/`getComboCount` 추가
- **단원별 취약 분석** (1e10c99): `tools/build_question_chapters.js` 신규 — 문제은행 문항의 교재 인용(path#L번호)을 `## N.` 절/Chapter 단원으로 매핑해 `{dataRoot}/question_chapters.js` 생성(724/1000건 매핑, 나머지는 참조자료 인용 → '기타' 묶음). 결과 화면에 오답 포함 단원을 정답률 낮은 순으로 표시. 복수정답형은 `출처: 과목N 문제은행 Qn`으로 원문항 거슬러 매핑, 실패 시 L번호→라인 경계 폴백
- **과목별 복습 버튼 상시화** (1e10c99): 기존 과락(<40%) 과목만 추천 버튼 → 오답 있는 모든 과목 행에 `⚡ 복습` 버튼(해당 과목 집중 퀴즈)
- **문제집 유형 캡션** (2789a6e): 버튼 쌍 하단에 "선다형 + 단답형 혼합 · 수작업 원본" / "ㄱㄴㄷㄹ 조합형 · 원본 문항 자동 변환" 안내 추가

## 2026-09-20 멀티시험 전환 후속 UI 수정 + 브랜딩

- **시험 전환 버튼 겹침 수정** (3e3f904): `.sidebar-footer`가 가로 flex(`space-between`)인데 `width:100%` 버튼이 © 텍스트·버전을 밀어냄 → 푸터를 세로 스택으로 변경, ©/버전을 `.sidebar-footer-meta` 행으로 분리. 모바일 탭 바에 시험전환 탭 추가(모바일은 진입점 부재였음)
- **푸터 브랜딩** (48ec8e0): `© Cosmetic Master` → `© Pass Master`

## 2026-09-20 UI 배치 오류 전수 감사 + 수정

- **진행 중인 모의고사 배너** (bc26222): `.draft-banner`에 `display:flex` 선언 누락 → `justify-content`/`gap` 무시되어 버튼이 텍스트에 밀착. flex 적용
- **원료 단답형 입력행** (8e0f75a): `.ing-input-row`에 `display:flex` 누락 → input·버튼이 세로로 쌓임. flex 적용
- 전 CSS 전수 감사(전용 flex/grid 속성만 있고 `display` 없는 규칙 탐지 → HTML/JS 사용처 대조): 위 2건 외 의심 항목은 부모 규칙/유틸 클래스가 `display`를 제공하는 정상 케이스로 확인

## 2026-09-20 학습안내서 갱신 + 진입점 정리

- **학습안내서 갱신** (48816d7): 문제은행 유형 분포를 실제 파싱 기준으로 정정(객관식 746/단답형 254), O/X 드릴·복수정답형 드릴·취약 진술 리뷰·복수정답형 모의고사·통합 모의고사(100문/120분) 등 신규 기능을 §1 표에 반영, D-5~당일 플랜 자료 맵에 드릴·취약 리뷰 추가, §10 파일 구조에 `과목N_복수정답형.md` 추가, `data/docs_md/학습안내서.js` 폴백 번들 재생성
- **중복 진입점 정리** (d2f4e93): 학습 부록 카드에서 학습안내서 링크 제거 → 대시보드 독립 카드로만 진입. 부록 카드는 배지 + 두음법·숫자 총정리 링크만 표시

## 2026-09-20 멀티시험 플랫폼 아키텍처 (구조 개편)

여러 시험 과목을 병행 지원하는 구조로 전환. 신규 시험 없이 기존 cosmetic 시험으로 구조 검증.

### 결정 사항
- **전량 시험별 분리** — 각 시험이 독립 `contentRoot`/`dataRoot` 보유
- **구조만 검증** — 새 시험 콘텐츠는 추가하지 않음
- **기존 진도 초기화** — 레거시(비네임스페이스) 진도 키 1회 삭제 정책
- **홈 = 시험 선택** — 미선택 상태에서 시험 피커가 홈

### 콘텐츠/데이터 계층
- `content/exams.json` (신규) — 시험 레지스트리 소스: id/name/desc/icon/year/default/contentRoot/dataRoot/registryBundle/registryGlobal/features
- `data/exams.js` (신규, `tools/build_exams_list.js`) — file:// 호환용 클래식 번들 (`window.EXAMS_LIST`)
- 기본 시험(cosmetic): `content/`·`data/` 루트 유지. 추가 시험: `content/exams/<id>/` + `data/exams/<id>/`

### 런타임
- `src/exam-context.js` (신규, 리프 모듈) — 활성 시험 해석(`getActiveExam`), `selectExam`(리로드 전환), `hasFeature`, `contentPath`/`dataPath`, `scopedKey`/`unscopedKey`, `purgeLegacyStorage`. Node 도구용 `EXAM_ID`/`EXAM_CONTENT_ROOT`/`EXAM_DATA_ROOT` env 폴백 포함
- `src/state.js` — `safeGetItem`/`safeSetItem`/`safeRemoveItem`/`listScopedKeys`가 시험 네임스페이스(`<examId>:key`) 적용. 앱 전역 키(테마·리더 설정 등 `GLOBAL_KEYS`)는 비네임스페이스 유지
- `src/data-loader.js` — `init()`이 활성 시험 해석, `ensureRegistry()`가 비기본 시험 레지스트리 번들을 클래식 스크립트로 동적 로드. `getSubjectOrders()`·`_examKeyForOrder()`(order → exam key 해석) 추가, 드릴/MD/문제은행 경로를 `dataPath`/`contentPath` 기반으로
- `src/paths.js` — 전 경로를 `contentPath`/`dataPath` 기반 getter로
- `src/views/exam-select.js` (신규) — 시험 선택 카드 뷰. `index.html`에 `exam-select-view` 섹션 + 시험 전환 버튼 추가
- `src/views/backup.js` — 백업 파일은 비접두사 논리 키 유지(시험 간 호환), 복원은 현재 활성 시험 네임스페이스에 기록
- 기능 게이팅: `data-feature` 속성 기반 — dictionary/calcPractice/ingredients/appendixDocs/pomodoro는 HTML 속성, audiobook/refDocs는 리더 동적 버튼(`hasFeature`)으로 게이트
- `data/audio_manifest.js` — 시험 id 키로 분리된 단일 매니페스트(`AUDIO_MANIFEST['<examId>']`), `getAudioManifest(examId)` 헬퍼 추가, `reader-audio.js`가 활성 시험분 선택

### 빌드 파이프라인
- `tools/build/exam-targets.js` (신규) — `getExamTargets()`(exams.json → contentRoot/dataRoot/manifest 해석), `getSubjectMaps()`(manifest → SUBJECT_NUM/KEY/TITLE 파생 — 기존 하드코딩 테이블 대체)
- `tools/build_all_data.js` (신규) — `build:data`가 모든 시험을 순회 빌드 (`EXAM_ID`로 `tools/build/index.js` 재실행). `--only` 인자 패스스루
- `tools/build/index.js` — `EXAM_ID`/`EXAM_CONTENT_ROOT`/`EXAM_DATA_ROOT` 지원, 레지스트리 `bundle` 경로를 `{dataRoot}` 기준으로, 비기본 시험은 `DATA_REGISTRY_<id>` 전역명 + `var`-only(클래식 스크립트 주입 호환). sw.js 프리캐시 갱신은 기본 시험만
- 시험 순회로 일반화: `build_ox_drills.js`, `build_combo_drills.js`(과목 매핑/출력 디렉터리/MD 산출물), `build_exam_bundles.js`, `build_study_md_bundle.js`(storyFile 포함), `build_doc_bundles.js`, `build-audio-manifest.js`, `sync_citation_lines.js`, `check_parser_parity.js`
- `build-pdf-registry.js`/`build_keyword_index.js` — 기본 시험 전용 유지 + `EXAM_CONTENT_ROOT` env 지원 (공유 모듈 출력이라 시험별 분리는 후속 과제)
- `supplements.js` — `ctx.contentRoot`/`ctx.dataRoot` 사용, 보충 번들 경로 `{dataRoot}/supplements/`

### 검증
- `node --check` 전 파일 통과, 유닛 273개 + DOM 21개 통과 (테스트는 `scopedKey` 네임스페이스 반영), `check:parser` 4과목 등가성 일치, `check:imports` 0 오류, `verify:assets` 90개

## 2026-09-20 학습 캘린더 표시 오류 수정

- **캘린더 뷰 크래시**: `getWeeklyGoalProgress`가 dead code 정리 시 삭제된 `isStudiedOn`을 여전히 호출 → ReferenceError로 `renderStudyCalendar`가 innerHTML 도달 전 중단(뷰 전체 빈 화면). 인라인 항목 검사로 교체 (`study-tracker.js`)
- **목표 링 항상 0%**: JS가 `data-percent` 속성만 쓰고 CSS는 `var(--p, 0)`를 읽어 `--p` 미설정 → conic-gradient 채움이 항상 0%. 링 요소에 `style="--p:N"` 부여 (`study-calendar.js`)
- **UTC 날짜 버그**: `getTodayStr`/주간 집계가 `toISOString()`(UTC) 기준이라 KST 00:00~09:00에 "오늘"이 어제로 기록·표시 → 로컬 날짜 헬퍼 `_localDateStr`로 교체
- 이번 달 링 비율 분모를 고정 30일 → 실제 월 일수(`daysInMonth`)로 정정

## 2026-09-20 과목별 카드·퀴즈 수량을 문제은행 출제 비중으로 보정

### 배경

카드/퀴즈는 교재(용어 표·확인문제)에서 파생되어 수량이 교재 분량에 좌우되므로 문제은행 문항 비율(100/250/250/400 ≈ 10:25:25:40)과 괴리 — 1·2과목 과다, 3·4과목 부족.

### 구현 (혼합 방식)

- `tools/build/supplements.js` (신규): 전체 카드/퀴즈 수를 문제은행 비율로 **최대잔여 비례 배분**해 과목별 목표치 산출. 부족분은 문제은행 문항을 균등 간격 샘플링해 변환 — 카드(`{key}_card_*`, `문제 → 정답·해설`), 퀴즈(`{key}_quiz_*`, choice/ox/blank 그대로). 카드·퀴즈 풀은 상호 배타적 선택. 산출물 `data/supplements/{key}.js` (`var STUDY_SUPPLEMENT_{key}` — 클래식 스크립트라 file:// 호환)
- `tools/build/index.js`: 섹션 3.5 보충 단계 추가. 레지스트리 `subjects[].stats`에 `sourceCards/sourceQuizzes`(교재 원본), `targetCards/targetQuizzes`(목표) 기록, `stats.cards/quizzes`는 표시 수치 `min(원본+보충, 목표)`. 보충 과목은 `supplement`/`supplementGlobal` 경로 등록
- `src/data-loader.js`: `loadSubject`가 레지스트리 `supplement` 번들을 `_loadScript`로 로드해 `data.cards`/`data.quizzes`에 병합 (실패 시 경고 후 계속)
- `src/views/dashboard.js`: `_displayCounts()` — `targetCards/targetQuizzes` 존재 시 표시 수치를 상한 적용. 과목 카드·전체 통계·진도율 모두 목표 기준 (암기 수/진도율 100% 클램프). 실제 카드 덱은 전량 학습 가능
- `sw.js`: 프루닝 보존 대상에 `data/supplements/` 추가
- 결과: 표시 수치 108/36, 270/90, 270/90, 433/143 (카드·퀴즈 각각 문제은행 비율과 정확히 일치); safety +84카드/+37퀴즈, understanding +86카드/+43퀴즈 보충 번들 생성
- 후속: 보충 퀴즈를 **전량 단답형**으로 전환 — 객관식은 `choiceToBlank`가 긍정 발문 + 정답 ≤20자 → 단답형(정답 문구 입력), 긴 정답은 수치 `[ 빈칸 ]`화. 부정형 발문은 변환 제외(거짓 진술 학습 방지). 퀴즈 선별도 단답형 변환 가능 문항 우선 균등 편성

## 2026-09-20 복수정답형 학습 통합 강화 — 추적 연동·리뷰·편성 보완 11항목

### 시뮬레이터 ↔ 진술 추적 통합

- `comboToSimQuestion`이 원본 `options`(members 구조)를 `comboOptions`로 보존 — 시뮬 응답을 진술 판정으로 역산 가능
- `deriveComboJudgments` + `submitExam` 연동: 복수정답형 모의고사 응답이 `recordStatementJudgments`로 기록돼 취약 목록·SM-2가 시뮬 성적에도 반응
- `exam-sim-review`: 복수정답형 오답에 **진술 정오표** 표시 (실제 O/X vs 내 선택 선지의 포함 여부, 오판 진술 강조)

### 모의고사 편성

- 복수정답형 풀기 문항 수 선택 — `40문/60문/전체` 칩 (`startComboMockExam('N:count')` 파싱 + 무작위 샘플링)
- 통합 모의고사 "복수정답형 혼합" 체크박스 — 과목별 배정의 약 20%를 combo 문항으로 교체 (`#integrated-mix-combo`)

### 트레이너 UX

- "오늘 복습 대상 N개" 배지 — 트레이너 카드 3곳 + 드릴 setup 카운트 (`updateDueBadges`, initTrainer/setup 진입 시 갱신)
- 개념 집중 드릴 — 취약 리뷰 혼동쌍 그룹 헤더의 "이 개념만 드릴" (`startOxDrill('concept:<cid>')` — 동일 cid 취약 진술만 출제)
- 오판 진술 O/X 단건 재시도 — 오판 리뷰·취약 행의 재시도 버튼 (`startOxDrill('sid:<sid>')`)
- 드릴 완료 화면에 "취약 진술 리뷰" 바로가기 (오판 존재 시)
- 키보드 단축키 — O/X 드릴 `O`·`X` 판정, 복수정답형 `1`~`5` 선지 선택, `Enter` 다음 문제
- 과목별 진술 마스터 진행도 — 취약 리뷰 상단에 과목별 판정/취약/졸업 집계 (`getAllStatementStats`)

### 검증

- `check:combo`에 정답 위치 분포 검증 추가 — 번들 50문 이상 시 공백 위치·50% 초과 편향을 오류 처리, ①~⑤ 분포 리포트 출력

## 2026-09-20 복수정답형 총량 1,000문 조정 — 다중 빈칸 (B) 생성 중단

- `build_combo_drills.js`: 다중 빈칸 문항의 `(B)` 변형 생성을 중단하고 `(A)`만 변환 — 과목1 −1, 과목2 −4 → 총 **1,000문**(100/250/250/400)
- `buildBlankCombo`의 `blankLabel` 파라미터는 seed/sid/id 안정성을 위해 유지 — 기존 (A) 문항의 id·sid·문구 변경 없음 (추적 데이터 보존)
- 문서: `ARCHITECTURE.md`·`QUESTION_SCHEMA_DESIGN.md` §6-3/6-5의 산출 정합 갱신

## 2026-09-20 복수정답형 모의고사 — 실전 시뮬레이터 연동

- `populateExamCards`(app.js): 과목 카드에 "복수정답형 문제집"(`과목N_복수정답형.md` 열람) + "복수정답형 풀기"(`startComboMockExam`) 버튼 쌍 추가
- `startComboMockExam(N)` + `comboToSimQuestion`(exam-simulator.js): `loadComboDrills(N)` 로드 후 시뮬 형식 평탄화 — citation·진술 목록을 question 본문에 편입, `options[].members` 문자열화, 정답 id → 지시자 기호 변환
- `renderSimQuestion`: `combo` 유형을 객관식과 동일 옵션 UI로 렌더, 유형 라벨 "복수정답형 ㄱㄴㄷ"
- `submitExam`: combo를 choice/ox와 동일하게 지시자 비교 채점
- `startWeakExam`: `weak_sim_<subj>_combo_*` 카드 감지 시 해당 과목 combo 번들을 함께 로드, `COMBO_DRILLS_subjectN` 검색 폴백으로 복수정답형 오답 복습 지원
- `exam-sim-review.js`: `combo` 유형 배지 "복수정답형" 추가

## 2026-09-19 복수정답형 학습 체계 구축 — 스키마·변환기·드릴 UI·약점 추적

> **목표**: `docs/dev/QUESTION_SCHEMA_DESIGN.md` + `docs/dev/COMBO_STUDY_STRATEGY.md`를 실제 앱 파이프라인에 구현 — 진술(sid) 원자 단위로 O/X·복수정답형·약점 추적을 통합

### 문항 스키마 기반 (`src/questions.js`, e528f81)

- 설계 문서의 standalone 유틸을 `src/`로 이전해 앱 모듈화: `single`/`combo`/`short`/`ox` 4유형 + `deriveComboAnswer`/`generateComboOptions`/`validateQuestion`/`gradeAnswer`/`scoreExam`
- `perStatement`에 `userJudged`/`judgedCorrect` 자동 유도 — 선택 옵션 members = "참 판정 집합"으로 해석해 진술별 오판 검출, 2단계 응시(`{optionId, judgments}`) 지원
- 진술 `sid`(전역 안정 ID)·`conceptId`(혼동쌍), single `options[].truth`(명제 참/거짓), `STANDARD_TAGS` 어휘 추가

### O/X 드릴 생성 (d3f0c4b)

- `tools/build_ox_drills.js`: `data/exams` choice 문항의 선지를 진위형 문항으로 펼침 — `fact` 모드(명제 진위) 65문 / `answer` 모드(정답 판정) 636문 근원, 3,701문 생성
- `data/drills/`에 별도 출력 — 레지스트리 미등록 번들이라 sw.js `pruneStaleDataBundles`에 보존 규칙 추가

### 약한 진술 추적 (`src/statement-tracker.js`, cc586a3)

- `perStatement.judgedCorrect` 오판을 `sid` 키로 `statement_stats` + SM-2 스케줄에 누적, `getWeakStatements()`/`getDueStatementSids()` 제공
- O/X·복수정답형이 동일 sid 규칙을 공유해 교차 추적

### 복수정답형 전량 변환 (`tools/build_combo_drills.js`, 9f36efb → 7d7c672)

- **객관식 741문**: 선지를 ㄱ~ㅁ 진술로 재조합 — `fact`/`answer` 모드 분류, 부정 발문 긍정 정규화, `'위 ①②③ 모두'` 메타 정답 복구(개수 검증), `(단,…)` 조건절 보존, 불가 꼬리는 지시문 부기 폴백
- **단답형 254문**: 정답 풀링 — 유형별(num/term) 과목 정답 풀에서 오답 추첨, 정규화 부분문자열 모호성 필터, 전 과목 풀 보충, 다중빈칸은 (A) 문의 변환
- 결정론적 빌드: mulberry32 seeded RNG(문항 id 시드)로 옵션 조합·정답 위치 재현
- 결과: **과목1 100 / 과목2 250 / 과목3 250 / 과목4 400 = 1,000문**, 스키마 오류 0
- 산출물: `data/drills/combo_subject*.js`(런타임) + `content/문제은행/과목N_복수정답형.md`(검토용, 문제은행 동일 형식)
- `citation` 자동 생성 — 교재 라인·법령 조문 추출 + 원문 번호 (서두 명기 규칙 충족, aecf8f4에서 필수화)

### UI 연동 (b67a970)

- 스마트 훈련소에 O/X 판정 드릴·복수정답형 훈련 카드 추가 — 과목 선택 → 10문 출제 → 진술별 피드백 → 오판 리뷰
- `DataLoader.loadOxDrills(N)`/`loadComboDrills(N)`: 클래식 script 주입(`file://` 호환), 복수정답형은 수작업 파일럿(cb-)과 자동 번들 병합
- 취약 sid 포함 문항 최대 절반 우선 편성

### 버그 수정 (선행, 061d70b)

- 문제은행 정답 미파싱: MD 정답 형식 변경(`**Qn.**`+`> **정답: X**`) 미반영으로 전 과목 1,000문 `answer:""` — 파서 신형식 대응 + ox 오분류 82문 정정 + 객관식 채점 경로 불일치 2건(기호 비교) 수정

### 복수정답형 로직 전체 점검 보완 (11개 항목)

- **오판 리뷰 가독성**: `perStatement`에 진술 `text` 포함 → 결과 화면이 `ㄱ — 정답 O, 내 판정 X`만이 아니라 진술 내용까지 표시
- **번들 경량화**: 생성 문항의 `statement.explain` 중복(문항 explain 복제) 제거 → `q.explain` 폴백, 과목4 번들 1.49MB→813KB (~45%)
- **SM-2 편성 완성**: 사장됐던 `getDueStatementSids()`를 출제 편성에 연동 — 기한 도래 → 오판 → 임의 순 (O/X·복수정답형 공통)
- **취약 진술 리뷰 패널**: `statement_stats`에 text/truth/conceptId/subject 저장, 트레이너에 목록 UI + 과목 드릴 바로가기
- **2단계 응시 UI**: 진술별 O/X 토글 → 조합 자동 도출·직접 채점 (`{optionId, judgments}` 경로 활성화)
- **표준 태그**: `tools/drill-utils.js` `inferTags`로 STANDARD_TAGS(수치·기한·금지원료 등) 자동 부여 — O/X·복수정답형 공통
- **전체집합 오지 상한**: `generateComboOptions` `banFull` — "모두 고르기" 선지 과다(63%) 해소
- **conceptId 클러스터**: 교재 `L####` 기반 부여 — 취약 리뷰 혼동쌍 그룹핑 기반
- **다중 빈칸 (B) 출제**: `(A)`만 변환하던 것을 `(B)`까지 확장 — 과목1 +1, 과목2 +4 → 총 **1,005문**
- **안정 문항 id**: `combo-XX-NNNN` 위치 기반 → `stableId` 해시 기반 (재생성 시 id-문항 매핑 불변)
- **검증 확장**: `check:combo`가 파일럿 10문 → 생성 번들 5개 전체(1,015문) 검증 — 스키마·citation·도출 정답·중복 정답·채점 스모크

### 전략 문서 대조 후속 보완 (COMBO_STUDY_STRATEGY.md 리뷰)

- **전략 ④ 태그 집중 드릴**: O/X·복수정답형 setup에 '취약·복습 진술만'·'수치·한도·기한 집중' 특수 모드 (전 과목, `weak`/`num` 인자) — `inferTags` 데이터를 실제 필터로 연결
- **전략 ⑤ 혼동쌍 대조**: 같은 conceptId 그룹의 참/거짓 진술을 취약 리뷰에서 2단 대조 배치
- **전략 ⑦ 소거 전술**: 진술 판정과 모순되는 선지 실시간 흐림 처리 + "선지 N개 소거" 힌트
- **취약 목록 졸업 규칙**: 연속 정답 3회(`WEAK_GRADUATE_STREAK`) 시 취약 목록·우선 편성에서 제외, 재오판 시 복귀 — 무한 누적 해소
- **출제 수 선택**: 10/20/전체 칩 (두 드릴 setup 공유)
- **취약 리뷰 툴바**: 복습 대상 필터, 최근 판정 배지(`last`), 바로 드릴 버튼, 졸업 수 표시
- **버그**: 취약 리뷰 '드릴' 버튼 무반응 — `startOxDrill`/`startComboDrill`이 자기 패널을 표시하지 않던 문제 수정
- **접근성**: 진술 판정 버튼 `aria-pressed`
- **정리**: `check:imports` 경고 전량 해소 — 미사용 import/export·dead code(`getRecentStudyDays`/`isStudiedOn`) 제거, 내부 전용 상수 export 정리 → 59개 파일 경고 0

## 2026-09-18 중요숫자 암기정리 → 두음법 총정리 통합 + Part 2 설명·마인드맵 보강

> **목표**: 암기 문서 2종(`중요숫자_암기정리.md` + `두음법_암기_총정리.md`)을 단일 문서로 통합하고 숫자 파트 가독성 강화

### 문서 통합 (c2c70da)

- `content/두음법_암기_총정리.md`를 **Part 1(두음법 56개) + Part 2(중요 숫자)** 구조로 재편 — 과목별 섹션 `##`→`###` 강등으로 목차 2단계화
- `content/중요숫자_암기정리.md` 삭제 — 내용은 Part 2 상세 표 1~17로 흡수 (외부 링크 참조 제거)
- 고아 라인("정기검토·실태조사 5년·고시 재검토 3년")을 ①법 3분 핵심 그룹에 편입
- 참조 갱신: `학습안내서.md` 자료 맵·D-3/D-1 루틴, `README.md`, `ARCHITECTURE.md` (기존 옛 파일명 `맞춤형화장품조제관리사_중요숫자_암기정리.md` 참조도 함께 교정)

### Part 2 보강 (05eafc0)

- 도입부 설명: 구성 안내(패턴→상세표→함정표→3분 핵심) + 표기 범례(⭐·★·①②③④·🎯·㎍/g·개/g) + 추천 학습 순서
- 마인드맵 2종 신규: Part 2 전체 지도(기한·한도·청정소독·피부모발·행정자격 5그룹) + 17번 '같은 숫자 함정' 맵
- 노드 텍스트에서 mermaid 셰이프 문법 문자 제거(`%`→`퍼`, `㎛`→`마이크로` 등)

### 연동 갱신

- `index.html` 학습 부록 버튼 라벨 → "두음법·숫자 총정리"
- `manual-viewer.js` MD_SOURCES 제목 → '두음법·숫자 암기 총정리'
- `data/docs_md` 번들 재생성, `sw.js` CACHE_VERSION v361→v363 (배포 스탬프 f624b3e·dc0fa85)
- 검증: 유닛 테스트 248개 통과, mermaid 블록 7개 들여쓰기 전수 검증, 배포본 문서 200 OK

## 2026-09-18 통합 문서 리뷰 정정 (콘텐츠 정확도)

> **목표**: 사용자 작성 개선 사본(`두음법_숫자_암기_총정리.md`, `<a id>` 앵커·문서 내 목차 사용 — 앱 파서가 HTML을 이스케이프해 비호환)에서 콘텐츠 수정분만 이식하고, 리뷰에서 발견된 잔존 오류 전수 정정

### 이식 (사본 → 정식 문서)

- UVC 연상 "피부암" → "살균(오존층 차단)" (§16 '살균력 강함'과 정합)
- 도입부 "상세 표 1~17" → "1~16" (함정표 17 별도 구성과 정합)
- 모발 주기 비율 근사값 표기(약 90%·1~2%·약 15%) + §13 상호참조
- "토클레이브" → "오토클레이브" 오타
- HLB 표에 `8~18 O/W 유화제` 행 추가 + 마인드맵·암기 팁 동기화
- 팁의 "레티놀 2500=1.0%" 삭제 (2500 IU/g ≈ 0.075%로 등식 부정확)
- 🔗 두음법↔숫자 교차 연결표 신설 (§텍스트 참조 — 앱 파서가 앵커 미지원)

### 리뷰 정정

- 두음법 개수 **56→64개** 정정 (개인정보보호 8행 추가분 미반영이던 스테일 카운트) — 문서 2곳 + `학습안내서.md` 자료 맵
- 함정표: 15일 행에 '가'등급 회수 추가, 30일·90일 행의 파생 수치("90일의 1/3" 등) → 실항목(책임판매관리자 보충)·'—'로 교체
- §1 상세표 누락 3행 추가: 회수계획서 5일·위해성 등급별 회수(가15/나다30)·책임판매관리자 결원 보충 30일
- CGMP 이중 정의 구분: Part 1 `과·미·품`→"3대 **목적**", §11 인적자원·제조관리·품질관리→"3대 **구성요소**" 상호 참조
- 마인드맵 "모발주기 3년" → "3~6년" (최솟값만 표기되던 것 수정)
- 개선 사본 `두음법_숫자_암기_총정리.md` 삭제 (이식 완료)
- `sw.js` CACHE_VERSION → `v365-20260918-review-fix`

### 후속 보완 (리뷰 보완점 반영)

- **교재 링크 연결(A1)**: 매뉴얼 뷰어의 `subj:과목#chNN` 링크 66개가 `window.open`으로 떨어지던 죽은 링크 → `textbook-reader.js`에 `openSubjectChapter()` 추출·export(기존 `data-ref-subject` 핸들러도 동일 함수 사용으로 리팩터)하고, `manual-viewer.js` 클릭 핸들러가 `subj:`를 인터셉트해 오버레이 닫기 → 교재 리더 뷰 이동 → 해당 과목·챕터 스크롤
- **정합성(B2·B3·B4)**: §7에 포장공간비율(세정15·기타10·재사용25) 행, §11에 향수 부향률(퍼퓸15~25→EDC3~5) 행 추가 — 패턴표 전용이던 2항목 상세 표 편입. §11 과목 표기 `②④`→`②③④` (CGMP=③ 포함). 3분 핵심 ①법에 회수 기한 라인 추가
- **함정표 확장(B1)**: 다의어 숫자 5행 추가 — 1년(결격·보존·승계가중)·7일(폐업통지·변경처리·정보게재·에탄올)·12(업무정지·염모제·피지/NMF)·20(청정도·부유균·납·멸균·각질)·25(향료·포장공간·티타늄) + 함정 마인드맵 동기화. 표기 범례에 `§n` 추가
- **재확인(C)**: 소분 교육 2026.4.28(법률 `<신설>` 원문)·티로시나아제 0.2%·한선 pH·피부호흡 0.6~1.0% — 교재·ref_md 원문 대조 전부 일치
- `sw.js` CACHE_VERSION → `v366-20260918-subj-links`

## 2026-09-18 실전 모의고사 D-5 링크 제거 + 암기 문서 구조 개선

> **목표**: 사용자 작성 "개선 최종본" 리뷰 반영 — 전면 개편 대신 현 문서 구조를 유지하면서 검증 가능성·회상 효율 강화

### D-5 학습 플랜 링크 제거 (5c776db)

- `index.html` 실전 모의고사 부록 카드의 "D-5 학습 플랜 (안내서 §5)" 링크 삭제 — 학습안내서와 동일 문서를 여는 중복 단축키였음. `content/학습안내서.md`의 D-5 섹션 자체는 유지

### 암기 문서 구조 개선 (외부 리뷰 권고 반영)

- **D01~D64 일련번호**: Part 1 두음법 행에 연속 번호 부여 — 개수(64) 즉시 검증 가능. 알레르기 25종·피츠패트릭 6형은 두음법이 아니므로 `※` 표기로 64개에서 제외
- **출처 태그**: Part 2 상세 표 §1~16 헤더에 `[법]`(화장품법·개인정보보호법) / `[고시]`(식약처 고시) / `[교재]` 태그 부여 + 범례 추가 — 개정 가능 수치와 고정 지식 구분
- **혼동 쌍 3→6**: 기능성 11가지↔고시 7종, 영업 결격↔조제관리사 결격, 표피 5층↔표피 4대 세포 추가 (마인드맵·표 동기화)
- **⚡ 최종 30초 회상** 섹션 신설: 3분 핵심 뒤에 두음·숫자만 나열한 초압축 회상 카드 — 설명 없이 뜻만 회상하는 용도
- **읽는 법 팁**: Part 1 도입부에 "긴 두음은 상세 풀이 열의 굵은 글자(의미 단위)로 끊어 읽기" 안내 추가
- `sw.js` CACHE_VERSION → `v368-20260918-mnemonic-polish`, `data/docs_md` 번들 재생성

### 전과목 숫자암기 통합정리 흡수 (B안 — 고유 콘텐츠 이식 후 원본 삭제)

- `content/맞춤형화장품_조제관리사_전과목_숫자암기_통합정리.md`(원격 추가본, 앱 미연동 고아 문서)의 고유 수치를 Part 2에 이식 후 파일 삭제 — 단일 원본 유지
- **교재 검증으로 기존 문서 오류 2건 정정**: HLB W/O `4~6`→`3~6` (이야기형 교재 3곳 일치), 포장공간 25% `재사용 용기`→`종합제품` (4과목 교재·용어집 일치) — 표·팁·함정표·마인드맵 동기화
- **§11 소제목 표 3개 신설**: 기능성 고시 함량(미백 2~5%·감초 0.05%·치오글리콜산 3~4.5%·살리실릭애씨드 0.5%), 자외선차단제 한도(25→15→10→7.5→2.4→1), 보존제·기타 원료(페녹시에탄올 1.0·파라벤 0.4/0.8·IPBC 0.02/0.01·퍼머 11%·AHA 등) — 행마다 설명·암기 포인트 열 + 💡세트 공식/⚠️함정 팁
- **상세 표 신규 행**: §1 위해화장품 일반보고 즉시 · §2 심사 수수료(전자 189,000/방문 210,000원) · §7 퍼머 제1·2제·안전용기 의무 · §8 배양시설 1B·기록 3년 · §10 저울 편심오차 ±0.1%·면봉 24~30㎠·세척제 pH 4구간 · §12 멜라노사이트(10~20%·4:1~10:1) · §13 모표피 5~15층
- 패턴표에 UV차단제·보존제·기능성 함량 수열 추가, 함정표+마인드맵에 0.5% 함정(살리실릭애씨드 이중 기준) 추가, 3분 핵심·30초 회상 동기화, Part 2 지도 마인드맵 노드 3개 추가
- `sw.js` CACHE_VERSION → `v369-20260918-numbers-merge`

## 2026-09-17 문제은행 인용 전수 감사 + sync_citation_lines.js 실검증화 (7a1258d)

> **목표**: 문제은행 1,000제(과목1:100 / 과목2:250 / 과목3:250 / 과목4:400) 전수 리뷰 — 구조·정답·인용 링크·근거문 품질

### 감사 결과

- 구조: 문제 수·정답 매칭·5지선다 마커·번호 연속성·중복 모두 정상 (0건 오류)
- 인용 링크: 교재 압축으로 라인번호 대량 어긋남 — 기존 `sync_citation_lines.js`가 범위초과 링크를 조용히 skip해 `--check`가 0건으로 오보고하던 것이 원인

### 인용 복구 (누적)

- 라인번호 갱신 655건 + 대상 파일 재지정 129건 (인용문 지문으로 실재 위치 재검색)
- 인용문이 어디에도 없는 15건 수동 복구 (삭제된 표 → CGMP 고시/안전기준 원문 등으로 재지정)
- 압축·요약된 인용문 15건을 원문 verbatim으로 교정
- 오인용 수정: 스쿠알렌 인용이 표 구분선(`| --- |`)을 가리키던 것 → 실제 행(L1256), 정답과 무관한 라인을 가리키던 계산 문제 → 제5조 근거 등
- 최종: 581개 고유 인용 전수 검증 통과 (파일 존재·범위 내·라벨↔URL 일치·인용문 위치 일치, 미발견 0)

### sync_citation_lines.js 개선

- **범위초과 skip 제거**: 구 라인이 파일 길이를 넘어도 검증 대상에서 제외하지 않음
- **인용문 지문 재탐색**: `> 인용문` 블록을 추출해 타겟 파일에서 정확 포함 → 쉥글(10자·2개 이상) → 키프레이즈 순 재탐색
- **±3 검증**: 인용 라인 근처에 인용문 조각(4자 이상)이 있는지 확인 후 동일로 판정
- **메타 라인 제외**: 📖 근거 헤더·해설·고득점 TIP·허용 정답 라인은 인용문 지문에서 제외 (JS `\b`가 한글에 작동하지 않아 키워드 뒤 `*`/`:` 요구 방식 사용)
- `<sup>` 등 태그 정규화, 비표준 라벨(`[교재: 2과목 L1091]`) 지원
- 키프레이즈만 일치(낮은 신뢰도)는 자동 갱신하지 않고 미발견으로 보고 (exit 1)
- `build:data`의 `sync:citations` 단계에서 매 빌드마다 실질 검증 수행

### 잔여 사항

- 스핑고신·헤미데스모좀·코르네오데스모좀·초임계·MSDS·에어샤워·ADI·자유지방산·공정검증 등 ~15개 전문용어: 정답은 정확하나 교재에 해당 용어 미수록 — 콘텐츠 커버리지 갭 (향후 교재 보강 필요)
- `audit:cards`는 `data/subjects/` 번들 생성 중단 후 고아 상태 (기존 문제)

## 2026-09-16 교재 리더 모바일 UX — 엣지 스와이프 TOC·툴바 자동 숨김·힌트 탭

> **목표**: PWA 교재 리더에 모던 모바일 네비게이션 패턴 적용

### 엣지 스와이프 TOC (5591fd2)

- 화면 왼쪽 끝(24px)에서 오른쪽 스와이프 → TOC 드로어 오픈
- 드로어 열린 상태에서 왼쪽 스와이프 → 닫기 (배경 탭도 유지)
- `#reader-layout`에 바인딩 — `reader-toc`가 container의 형제라 열린 드로어의 터치가 container에 도달하지 않기 때문
- 세로 스크롤 보호: `|dy| > |dx|`이면 스와이프 취소
- 툴바 자동 숨김: 아래로 스크롤 시 숨김, 위로 올리면 복귀 (`.reader-toolbar-auto-hidden`)

### 드로어 가로 오버플로 수정 (8330eee)

- 증상: 스와이프로 드로어를 연 후 항목 끝 텍스트("…스트")가 노출
- 원인: `.reader-toc`에 `overflow-y: auto`만 지정 → `overflow-x`도 `auto`로 계산되어 가로 스크롤 가능
- 수정: `overflow-x: hidden` + `overscroll-behavior-x: none` + `touch-action: pan-y`

### 엣지 힌트 탭 (f767195)

- `#reader-toc-edge-hint`: 왼쪽 끝 8px×72px pill, `MD_to_HTML.py`의 `.toc-edge-hint`와 동일 패턴
- 표시 조건: TOC 로드 + 900px 이하 — `.reader-toc:not(.is-hidden) ~ .reader-toc-edge-hint`
- 드로어 열림 시 sibling selector로 자동 숨김, 탭으로도 드로어 오픈 가능
- z-index: `var(--z-drawer) - 1` (드로어/백드롭 아래, 본문 위)

### TOC 툴팁 모바일 제거 (0e98b50, d069358)

- 증상: 스와이프 후 "…근거한 고객정보관리" 같은 텍스트가 화면에 잔류
- 원인: `touchstart`로 표시된 `#toc-tooltip`이 `mouseleave`/`blur` 없이 계속 `is-visible` 상태로 남음
- 1차: 터치 툴팁 2.5초 자동 숨김 + 클릭/드로어 닫힘 시 숨김
- 2차(최종): 모바일은 탭 즉시 네비게이션되므로 툴팁 불필요 → `@media (hover: hover)` 기기에서만 바인딩
- `:hover` 시 `overflow: visible` 확장도 `(hover: hover)`로 제한 — 모바일 sticky-hover로 nowrap 텍스트가 항목 밖으로 넘치는 문제 차단

### 검증

- `npm test`: 248 pass, 0 fail
- CACHE_VERSION → `v360-20260916-0e98b50`

## 2026-09-15 MD_to_HTML.py 도구 + 참조자료 Mermaid 시각화·모바일 대응

> **목표**: 참조자료 MD를 단독 HTML로 변환하는 도구 추가 및 모바일 file:// 환경 대응

### 참조자료 콘텐츠 개선

- `d5e7b37` — 핵심암기 Ch01·Ch03에 Mermaid 다이어그램 9개 추가 (보습 4종·색소 5단계·기능성 11가지·향수 / 사용금지 5그룹·보존제·자외선차단제 한도·염모제·AHA)
- `962b327` / `57672f7` — Ch03 AHA 섹션 보강 후 4개 항목 구조로 재구성 (AHA 정의·기준 / 대표 5종 / 살리실릭애씨드 13세 vs 3세 혼동 포인트 / IPBC·트리클로산)
- `3251537` / `183a6ae` — Ch01/Ch03 핵심암기 13개 개선점 + 암기 용이성 개선

### tools/MD_to_HTML.py 신규 (8a79906)

- Markdown → 단독 HTML 변환 (Tailwind CDN + highlight.js + mermaid.ink 프리렌더)
- CSS-only 테마 토글(checkbox+label)·TOC 드로어 — 모바일 file:// 환경에서 인라인 JS 미실행 대응
- Mermaid는 `theme=default`로 렌더 후 base64 `<img>` 임베드 — 외부 CSS `color`/`fill` 상속으로 글자가 안 보이는 문제 차단 (07c2829)
- 왼쪽 끝 스와이프로 TOC 드로어 오픈 + `.toc-edge-hint` 힌트 탭 (08d435a)
- 읽기 진행률 바: CSS 스크롤 구동 애니메이션(`animation-timeline: scroll()`)으로 JS 없이 동작, 미지원 시 JS `width` 폴백
- topbar 자동 숨김 + 이어읽기(스크롤 위치 localStorage 복원) — JS 필요, file:// 제약 있음
- 모바일 대응 이력: 테마버튼 터치 미응답(06a2c3d), `<head>` 독립 스크립트(bfb6c7f), file:// 호환(1c19092), 드로어 마지막 항목 잘림(72da003)

### 검증

- `npm test`: 248 pass, 0 fail
- `check:parser`: 파서 등가성 통과

## 2026-09-14 두음 암기법(Acrostic Mnemonics) 전 과목 적용

> **목표**: 각 섹션의 핵심 암기 항목을 첫 글자 조합으로 암기 효율 향상

### 배경

- 시험 직전 마지막 5분에 가장 효과적인 암기법인 두음법(Acrostic Mnemonics) 적용
- 각 항목의 첫 글자를 조합해 한 단어/문장으로 만들어 회상 용이

### 변경 내용

| 과목 | 표준형 | 이야기형 | 주요 두음법 |
|------|--------|---------|------------|
| 1과목 | 9 | 6 | 법·시·규·고, 세·기·기·색·네·모, 제·책·맞, 정·피·마·형·자, 안·안·유효·사, 제·동·열·처·피·자 |
| 2과목 | 9 | 9 | 수·유·계·고·색·향·보·산·금·기, 음·양·양·비, 자·미·주·제·여·염·탈, 가·유·분, 제·제·품·위, 확·결·평·결 |
| 3과목 | 6 | 5 | 과·미·품, P·M·H, 계·살·금·유·용·연·표, 알·클·헥·아, 밀·기·밀·차 |
| 4과목 | 11 | 11 | 혼·소, 단·피·연·안·감·광·광·첩·유, 장·가·가·개, 표·진·피, 문·견·촉·기, 보·경·대·판·적·정 |

- 총 66개 두음법 추가 (표준형 35 + 이야기형 31)
- 각 섹션의 `한 줄 요약` 다음에 `🧠 두음법` 라인으로 추가

### 관련 문서 갱신

- `docs/dev/TEXTBOOK_AUTHORING_GUIDE.md`: "한 줄 핵심" → "한 줄 요약" 형식 갱신, 두음법 섹션 추가

### 검증

- `npm test`: 248 pass, 0 fail
- `check:parser`: 파서 등가성 통과
- 인용 라인번호: 동기화 완료
- CACHE_VERSION → `v360-20260914-2e31c35`

## 2026-09-14 마인드맵 매핑 표 하이퍼링크 기능 추가

> **목표**: 마인드맵 매핑 표의 중분류 셀을 클릭하여 해당 섹션으로 바로 이동

### 배경

- Mermaid 마인드맵 노드 하이퍼링크 미지원 (Mermaid 10.9.8, PR #7511 미머지)
- `securityLevel: 'strict'`로 click 콜백 차단
- 대안: 매핑 표 자동 링크화 (Markdown 소스 변경 없음)

### 변경 내용

- `src/reader-format.js`: "🗺️ 마인드맵 노드 상세 매핑" 표의 중분류(2열) 셀을 `data-toc-jump` 링크로 자동 변환
  - 대분류(1열)가 "Ch"로 시작하는 전체 마인드맵 매핑 표만 변환
  - 챕터별 매핑 표(대분류가 마인드맵 노드명)는 섹션 내 세부 내용이므로 제외
- `src/views/textbook-reader.js`: `data-toc-jump` 핸들러에 5순위 fallback 추가
  - 1~4순위: 섹션 제목 매칭 (기존)
  - 5순위: 섹션 본문 내용에서 텍스트 검색 (매핑 표 링크용)

### 검증

- `npm test`: 248 pass, 0 fail
- `check:parser`: 파서 등가성 통과
- CACHE_VERSION → `v360-20260914-97c1558`

## 2026-09-13 교재 리더 UI 개선 — 챕터 헤더 카드/브레드크럼 제거

> 모바일에서 교재 개요 위 내용이 표시되지 않는 문제 해결

### 챕터 헤더 카드 제거 + 툴바 통합
- `reader-chapter-header-card` 제거 (과목명 배지, 챕터 제목, 섹션 수, 예상 읽기 시간)
- 핵심 기능을 `reader-toolbar`의 `reader-chapter-actions-group`로 통합:
  - 기출 필터 토글, 원본 MD 링크, 참조자료 드롭다운, 오디오 듣기 버튼
- 오디오 플레이어 영역을 툴바 아래 별도 영역(`reader-audio-player-area`)으로 이동
- 과목 선택 해제 시 액션 그룹/오디오 플레이어 초기화
- CSS: `reader-chapter-header-card` `display:none` (레거시 호환)

### 브레드크럼 제거
- `reader-breadcrumb` 제거 (과목명 = 챕터 제목 중복)
- 현재 섹션 위치는 사이드바 TOC 하이라이트 + sticky heading + 진행률 바로 표시
- CSS: `.reader-breadcrumb` `display:none` (레거시 호환)
- 모바일 브레드크럼 축약 규칙 제거

### 검증
- `build:data`: 파서 등가성 ✓
- `npm.cmd test`: 248 pass / 0 fail
- `npm.cmd run test:dom`: 21 pass / 0 fail
- 인용 라인 동기화: 1070개 링크 전부 동일 (변경 없음)
- 프로덕션 HTTP 200, sw.js `v360-20260913-2902c75` 반영

### 커밋
- `c8857f2` — 챕터 헤더 카드 제거 + 핵심 기능 툴바 통합
- `2902c75` — 브레드크럼 제거 (과목/챕터/섹션 중복 정보)
- `0f0bb67` — sw.js CACHE_VERSION 재스탬프

## 2026-09-13 P0 학습 동기부여 기능 3종 + 학습 안내서 접근성 개선

> 이번 세션 작업: 학습 캘린더, 약점 분석 강화, 학습 목표 설정, 학습 안내서 바로가기 추가

### P0-1: 학습 캘린더/스탬프
- 월별 달력에 학습한 날짜 스탬프(✓) 표시
- 사이드바/모바일 탭바에 "학습 캘린더" 메뉴 추가
- 날짜별 카드/퀴즈/정답 수 기록 (localStorage `study_calendar`)
- 새 파일: `src/study-tracker.js`, `src/views/study-calendar.js`, `css/study-calendar.css`

### P0-2: 과목별 약점 분석 강화
- 대시보드 약점 추천에 "교재 읽기" 딥링크 버튼 추가
- 정답률 최저 과목 → 퀴즈 + 교재 버튼
- 헷갈린 카드最多 과목 → 카드 + 교재 버튼
- `startSubjectReader(subjId)` 함수 추가

### P0-3: 학습 목표 설정/알림
- 일일 카드/퀴즈 목표 + 주간 학습 일수 설정
- 목표 설정 모달 (목표 설정 버튼)
- 오늘/이번주/이번달 달성률 링 표시 (conic-gradient)
- `saveProgress()`에 학습 활동 기록 통합

### 학습 안내서 접근성 개선
- 대시보드에 학습 안내서 바로가기 카드 추가 (3번째 카드)
- daily-challenge-grid 2열 → 3열 (2fr 1fr 1fr)
- 학습 안내서 ↔ 사용자 매뉴얼 상호 참조 링크 추가
- 사용자 매뉴얼에 학습 캘린더 섹션(11.5) 추가
- 모바일 탭 바 설명 11개 → 12개 탭으로 갱신

### 검증
- `npm test`: 248 pass / 0 fail
- `test:dom`: 21 pass / 0 fail
- 프로덕션 HTTP 200

### 커밋
- `4e48591` — P0 학습 동기부여 기능 3종 추가
- `fb4ab8d` — 학습 안내서와 사용자 매뉴얼 상호 참조 링크 추가
- `57f026d` — 대시보드에 학습 안내서 바로가기 카드 추가

## 2026-09-12 교재 목차·가독성·TOC 툴팁·개선 제안 적용

> 이번 세션 작업: 목차 순서 정리, 추천 회독법 중복 제거, TOC 툴팁 개선, 개선 제안 3종 적용

### 📋 목차에서 🗺️ 과목 지도를 챕터들 위로 이동
- 8개 교재 파일의 `## 📋 목차`에서 `🗺️ 과목 지도`가 챕터들 아래에 있던 것을 챕터들 위로 이동
- 인용 라인번호 90개 동기화

### 🔄 추천 회독법 섹션 완전 제거 (중복 제거)
- 4개 과목 모두 동일한 내용이 파일 끝에 중복되어 8개 파일에서 `## 🔄 추천 회독법` 섹션 및 목차 항목 제거
- 인용 라인번호 345개 동기화
- 제거한 추천 회독법 안내를 `docs/user/user_manual.md` 교재 리더 섹션으로 이동

### 사용자 매뉴얼 점검 및 최신 기능 반영
- 가독성 도구 섹션 추가 (글자 크기, 줄 간격, 집중 모드, 섹션 진행률, 본문 검색, 표 확장, 챕터 끝 마커)
- 교재 콘텐츠 학습 보조 요소를 프론트/본문/백 매터 3영역으로 재구성
- 전체 학습 흐름 다이어그램 "5대 → 6대 학습요소" 업데이트
- 중복된 "이 장의 질문" 섹션 제거
- 📑 목차 헤더 이모지 누락 수정
- 상단에 최종 업데이트 날짜/버전/변경 이력 링크 추가

### 사이드바 TOC 툴팁 개선
- 1차: CSS `::after` 툴팁을 아래에서 오른쪽으로 변경
- 2차: 컨테이너 `overflow-y: auto`로 인한 잘림 문제 → JavaScript 기반 `position: fixed` 툴팁로 전환
- 화면 오른쪽 넘어가면 자동으로 왼쪽 표시
- 페이드 인/아웃 애니메이션
- 모바일 touchstart 이벤트 추가 (첫 탭 시 툴팁 표시, 2.5초 후 자동 숨김)

### 개선 제안 3종 적용
1. TOC 툴팁 모바일 touchstart 이벤트 추가 (passive 이벤트)
2. 사용자 매뉴얼 상단에 최종 업데이트 날짜/버전 추가
3. `build:data` 스크립트에 `sync:citations` 자동 통합 (`npm run sync:citations` 추가)

### 인용 라인번호 동기화
- `tools/sync_citation_lines.js`로 277개 라인번호 갱신 (누적)

### 검증
- `check:parser`: 두 파서 출력 완전 일치
- `npm test`: 248 pass / 0 fail
- `test:dom`: 21 pass / 0 fail
- `verify:assets`: 81개 프리캐시 자산 모두 존재
- 프로덕션 HTTP 200

### 커밋
- `ddc7cfb` — 📋 목차에서 🗺️ 과목 지도를 챕터들 위로 이동
- `376893a` — 🔄 추천 회독법 섹션 완전 제거 (중복 제거)
- `ef09ec9` — 사용자 매뉴얼에 🔄 추천 회독법 안내 추가
- `cf9f3cc` — 사용자 매뉴얼 점검 및 최신 기능 반영
- `6876b18` — 사이드바 목차 툴팁을 아래에서 오른쪽으로 변경
- `67c8f74` — 사이드바 TOC 툴팁 JavaScript 기반으로 전환
- `62e0456` — 인용 라인번호 동기화 (277개 갱신)
- `8906528` — 전체 리뷰 개선 제안 3종 적용


## 2026-09-12 교재 구조 일관성 정리 (과목 지도 · 30초 회상 · 용어 정리 · 인용 라인번호)

> 8개 교재 파일(4과목 × 표준형/이야기형)의 구조 일관성 점검 및 정리.

### 과목 개요 마인드맵을 챕터 계층구조로 재작성
- 기존 주제별 분류(법령 체계/영업 분류/주요 제도 등) → 챕터 계층구조(Ch01/Ch02/...)로 재작성
- 각 챕터 아래 해당 챕터의 섹션(`## 1. xxx`)을 하위 노드로 배치
- 매핑 테이블도 챕터 계층구조에 맞게 재작성
- 4과목 Ch01/Ch04/Ch05/Ch06 마인드맵 하위 노드를 실제 섹션 개수에 맞게 분리 (통합 해제)

### 과목 지도 재구성
- `### 🗺️ 과목 개요 마인드맵` + `### 🗺️ 챕터별 마인드맵` 구조로 통일
- `법령별 조문 구조 마인드맵`, `비교표들` 제거 (챕터별 마인드맵이 상세 시각화 담당)
- `### 🗺️ 과목 학습 흐름도` 제거 (테스트용 인위적 섹션)
- `tests/unit/mermaid-rendering.test.js`: flowchart 강제 검증 → 선택적 검증으로 완화

### 섹션 구조 일관성 개선
- `🎯 과목 시각화 개요` → `🗺️ 과목 지도` 이름 변경
- 이야기형 `## 📖` 출처 섹션을 `## 📚 Chapter` 다음으로 이동 (17개 섹션)
- 3과목 `## 📋 소독 시 유의사항` → `###` 헤딩 레벨 낮춤 (Ch01 하위 섹션)
- 1과목 이야기형 `## 📖 화장품법 통합 정리` → `###` 헤딩 레벨 낮춤
- 2과목 이야기형 `## 📚 학습 보조 자료 (원료 DB)` 그룹 헤더 제거

### 30초 회상 카드 일관성
- 1과목 이야기형 30초 회상 카드를 표준형에 맞춰 일치시킴 (카드 제목·순서·내용)

### 용어 정리 중복 제거
- 4과목 이야기형 Ch04 "불검출 균" 중복 항목 1개 제거

### 문제은행 인용 라인번호 동기화
- `tools/sync_citation_lines.js` 개선: 빈 fingerprint(빈 줄/형식적 줄 가리키는 인용) 처리 로직 추가
- 문제은행 4개 파일에서 176개 인용 링크 라인번호 수정 (빈 줄 → 가장 가까운 의미 있는 라인)

### 검증
- `check:parser`: 두 파서 출력 완전 일치
- `npm test`: 248 pass / 0 fail
- `test:dom`: 21 pass / 0 fail
- 프로덕션 HTTP 200

## 2026-09-12 가독성 향상 기능 4종 추가

> 교재 리더 가독성 향상을 위한 4개 기능 순차 적용.

### 추가 기능
- **#1 줄 간격 조절**: 툴바에 줄 간격 버튼 그룹 추가 (1.4~2.6, 0.1 단위). `--reader-line-height` CSS 변수 + localStorage 저장. 본문 및 인용구 line-height에 적용
- **#2 읽기 진행률 표시줄**: 이미 구현되어 있음 (상단 sticky progress bar, 스크롤 위치 기반 0–100%)
- **#3 현재 섹션 헤딩 sticky**: 스크롤 시 현재 섹션 제목이 상단에 sticky로 표시. 섹션 헤더가 화면 상단을 넘어갈 때 표시, 100px 미만 스크롤 시 숨김
- **#4 인용구 강조 스타일**: 기본 모드 blockquote에 좌측 보더(3px primary) + 배경색(primary-tint-8) + 패딩 + 라운드 코너 추가. 라이트 테마는 warning 색상 적용

### 검증
- `npm test`: 248 pass, 0 fail
- `npm run check:imports`: 54개 파일, 0개 오류
- `npm run verify:assets`: 81개 자산 확인
> registry↔번들 14개 실재 확인 · 비ASCII 콘텐츠 파일 0 · `vercel.json` JSON 유효.

## 2026-09-12 교재 본문 불필요한 줄바뀜 전수 정리

> 8개 교재 파일 본문의 불필요한 줄바뀜을 전수 조사 후 일괄 정리.

### 정리 항목
- **1과목 표준형**: 한 줄 핵심 blockquote 2줄 분리 14건 → 1줄 합치기
- **1과목 이야기형**: 해설 파편화 4건 → 단일 blockquote로 합치기 (개인정보 유형, 혼합·소분 점검, 제3자 제공 고지, CCTV 안내판)
- **2과목 표준형**: `-e ` 잔여 텍스트 1건 제거, 보기 빈 줄 분리 2건, 해설 파편화 1건, 오염물질 번호 목록 빈 줄 1건
- **2과목 이야기형**: `-e ` 잔여 텍스트 1건 제거
- **3과목 표준형**: 문장 중간 줄바뀜 3건(②, ④ 괄호 설명, ② 빈 줄), 보기 빈 줄 분리 12건
- **3과목 이야기형**: 프롤로그 문장 분리 1건, ②/④ 괄호 설명 2건, ② 빈 줄 1건, 보기 빈 줄 분리 12건
- **4과목 표준형**: 보기 빈 줄 분리 23건
- **4과목 이야기형**: 프롤로그 문장 분리 1건, 색 기준 시험방법 문장 분리 1건, 보기 빈 줄 분리 23건

### 검증
- `npm test`: 248 pass, 0 fail
- `npm run check:imports`: 54개 파일, 0개 오류
- `npm run verify:assets`: 81개 자산 확인
- `npm run build:data`: 파서 등가성 검사 통과

## 2026-09-12 시험 직전 체크리스트 핵심 내용 보완 및 3과목 교재 정정

> 체크리스트 항목이 교재의 핵심 내용(최우선 암기 축·출제 빈도 ★★★)을 반영하는지 검증 후 보완.

### 체크리스트 핵심 항목 추가 (9개)
- **1과목**: 표시·광고 규제, 개인정보 4종 분류, 안전성 정보 보고(15일)/위해평가 정기검토(5년)
- **2과목**: 자외선차단제 SPF·PA 기준, 사용금지·제한 원료(별표 1/2), 제조공정 5단계
- **3과목**: 필터 3종(P/F→M/F→H/F), 낙하균 Koch법 노출시간
- **4과목**: 유효성(효력시험+인체적용시험+SPF/PA), 혼합·소분 실무

### 3과목 교재 정정 (법령 원문 대조)
- **낙하균 노출 시간**: 체크리스트 "5분 노출" → "고청정 시설 30분 이상 노출" (본문 line 657 일치)
- **위해성 등급**: 4등급(가/나/다/라) → 3등급(가/나/다) (시행규칙 제14조의2 원문 일치)
- **회수 기간**: 가(즉시)·나(15일)·다(30일)·라(90일) → 가(15일 이내)·나/다(30일 이내) (시행규칙 제14조의3 원문 일치)
- 표준형·이야기형 교재 모두 정정 (마인드맵 노드, 조문 구조, Mermaid 다이어그램, 체크리스트)

## 2026-09-12 시험 직전 체크리스트 교재 대조 정정

> `docs/user/exam_strategy.md`의 시험 직전 체크리스트가 교재 실제 내용과 불일치하여 정정.

### 정정 항목
- **1과목 체크리스트**: "벌칙 금액, 개인정보 과태료 vs 벌칙" → 교재 체크리스트 기반 핵심 항목으로 재작성 (영업 3종, 법령 4단 체계, 행정처분 4단계, 결격사유, 기능성화장품 11가지, 천연/유기농 기준)
- **2과목 체크리스트**: "살리실산, 벤조페논-3, KFCC 별표 1~10" → 교재 명칭/수치 정정 (페녹시에탄올 1.0%·벤조익애씨드 0.5%·살리실릭애씨드 0.5%·티타늄디옥사이드 25%, CGMP 3대 요소·5장, 알레르기 유발성분 25종)
- **2과목 핵심 주제**: "기능성화장품 고시 성분 (KFCC 별표 1~10)" → "기능성화장품 심사 (심사대상 vs 보고대상)"
- **2과목 빈출 포인트**: "벤조페논-3 2.4%" → "티타늄디옥사이드 25.0%", "기능성화장품 10종 KFCC 별표" 제거
- **3과목 체크리스트**: "D/C/B/A 등급, 미생물 100/1,000, 소독제-중화제 매칭" → 교재 수치 정정 (1~4등급, 일반 1,000·영유아·눈화장 500개/g, 소독제 6종, 중금속 수치, 위해성 등급 3단계)
- **3과목 빈출 포인트**: "D급/C급/B급/A급" → "1등급~4등급", "눈/점막 100CFU/g" → "영유아·눈화장 500개/g", "중화제 매칭" → "중금속 한도·위해성 등급"
- **4과목 체크리스트**: "맞춤형 4유형, 포장 표시사항, 호모게나이저 vs 디스퍼" → 교재 핵심 항목으로 재작성 (맞춤형화장품 정의, 판매업 신고제, 자격시험, 안전성시험 9종, 안정성시험 4종, 피부 5층, 모발 성장주기, 인체적용시험, 교육)
- **4과목 빈출 포인트**: "맞춤형화장품 4유형" → "맞춤형화장품 정의(혼합형 vs 소분형)", "안전성 시험 4종" → "안전성시험 9종"

## 2026-09-12 소스코드 강건성 개선 (20개 항목)

> 강건성 리뷰(병렬 서브에이전트 2개 + 직접 조사)에서 식별된 20개 항목 일괄 수정.

### 🔴 높음 — TypeError 방지 (8건)
- **quiz.js:517**: `window.EXAM_DATA[examId].questions` → 존재 체크 + `isNaN(qNum)` 검증 + `filter(Boolean)`
- **quiz.js:141,208,50**: `quizState.data[currentIndex]` bounds 체크 (`if (!currentQuiz) return`)
- **exam-simulator.js:376**: `renderSimQuestion` bounds 체크 + DOM null 체크
- **exam-simulator.js:168**: `saveSimDraft` localStorage try/catch (QuotaExceededError 대응)
- **textbook-reader.js:780**: 모듈 로드 시점 localStorage try/catch (Safari 프라이빗 모드 대응)
- **textbook-reader.js:155,185**: Promise 체인 `.catch()` 추가 (unhandled rejection 방지)
- **exam-simulator.js 5곳**: `startSimSession`/`resumeSimDraft`/`exitSimArena`/`submitExam`/`startWeakExam` DOM null 체크
- **backup.js:63**: `JSON.parse` 결과 null/object 타입 검증

### 🟡 중간 — 예외 상황 대응 (8건)
- **trainer.js:243**: `while` 루프 무한 루프 안전장치 (`_safety < 100`)
- **textbook-reader.js, backup.js, charts.js, theme-toggle.js**: localStorage 접근 try/catch 래핑 (12곳)
- **exam-simulator.js:149**: 통합 모의고사 제목 "1~4과목" → `subjects.length` 기반 동적 생성

### 🟢 낮음 — 기능 안정성 (4건)
- **data-loader.js:191,197**: `getSubjectList`/`loadExam` registry null 체크
- **textbook-search.js:30**: `chapter.sections` undefined 체크
- **trainer-calc-practice.js:73**: `currentQ` undefined 체크

### 검증
- `npm test`: 248 pass, 0 fail
- `npm run check:imports`: 54개 파일, 0개 오류
- `npm run verify:assets`: 81개 자산 확인
- **SW**: v338-20260912-robustness

## 2026-09-12 content 변경 유연성 개선 + 사용자 매뉴얼 갱신

> content/ 폴더 변경 시 소스 코드 수정 없이 JSON/MD 파일만 편집하면 빌드 파이프라인이 자동 처리하도록 개선.

### refactor — content 변경 유연성 6개 항목 (b2dd72b)
- **#1 pdf-registry.js 자동 생성**: `content/references.json` 신규 생성(SSOT), `tools/build/build-pdf-registry.js`로 빌드 시 자동 생성
- **#2 sw.js MD_ASSETS 자동 갱신**: `tools/build/index.js`에서 manifest 기반으로 MD_ASSETS 배열 자동 생성, 이야기형 파일 자동 포함
- **#3 exam-simulator.js 동적화**: `subject1-4` 접두사 매칭 → registry.exams의 subject 필드 기반 동적 그룹화, 문제 수 manifest.integratedExam에서 관리
- **#4 빌드 파이프라인 통합**: `build:data` 한 번으로 pdf-registry → keyword-index → index → study-md → exam-bundles → audio-manifest → check:parser 순차 실행
- **#5 audio_manifest.js 자동 생성**: `tools/build/build-audio-manifest.js` 디렉토리 스캔, 기존 매니페스트 보존
- **#6 index.html 정적 텍스트 동적화**: "1,000제" 등 하드코딩 제거, populateExamCards()에서 registry 기반 동적 치환
- **build_keyword_index.js 중복 제거**: REF_DIRS/SUBJECT_DIR_TO_ID 하드코딩 → references.json에서 로드
- **검증**: npm test 248 pass, check:imports 54파일 0오류, verify:assets 81개, build:data 전체 파이프라인 성공
- **SW**: v337-20260912-content-flexibility

### docs — content 변경 작업 절차 가이드 (f287309)
- `docs/dev/CONTENT_WORKFLOW.md` 신규 작성: 변경 유형별 매트릭스, 빌드 파이프라인 순서도(Mermaid), 검증 플로우차트, 배포 워크플로우
- AGENTS.md 관련 문서 섹션에 CONTENT_WORKFLOW.md 추가

### docs — 사용자 매뉴얼 갱신
- 단원 수 정정: "19개 단원"/"20챕터" → "4과목 4챕터" (실제 manifest 기반)
- 과목별 문제 수 정정: 1과목 100제, 2과목 250제, 3과목 250제, 4과목 400제 (총 1,000제)
- 통합 모의고사: manifest 기반 동적 관리 안내 추가
- 오디오북: "19개 단원" → "4개 단원"

## 2026-09-12 리팩토링 잔여 이슈 정리 + scratchpad import 복원

> 리팩토링 후 잔여 이슈 10개 정리 및 파생 버그 1건 수정.

### refactor — 잔여 이슈 10개 정리 (0834542)
- **Dead code 제거**: `src/concept-map.js` (700+ 라인) 삭제, `sw.js` 캐시 리스트에서도 제거
  > **이력 일원화**: concept-map.js는 아래 단계를 거쳐 완전 삭제됨.
  > 1. 신규 추가 (초기): 순수 SVG 인터랙티브 마인드맵 생성기
  > 2. 축소 (2026-09-01): 개념 맵 컨테이너 삭제, 용어집 링크 기능만 잔존
  > 3. 완전 삭제 (2026-09-12, 0834542): dead code 분류, CSS 잔존도 2026-09-12 정리
  > 관련 과거 엔트리: line 984(신규), 1096(축소), 1336(파라미터 변경), 1504(통합)
- **미사용 import 제거**:
  - `app.js`: 16개 미사용 import + scratchpad 3개 + ui-utils 3개 + dead re-export 2줄
  - `quiz.js`: `daily-challenge.js` 11개 미사용 import
- **내부 전용 함수 export 제거**:
  - `spaced-repetition.js`: 7개 함수 (sm2, getDueCards, getCardSchedule, loadSchedules, saveSchedules, removeCardSchedule, clearAllSchedules)
  - `study-aids.js`: 4개 렌더링 헬퍼 (renderExamHighlightCard, renderNumberDrillCard, renderProcedureFlowCard, renderAdminPenaltyCard)
- **하드코딩 색상 → CSS 변수**: ui-utils.js, dashboard.js, charts.js, trainer-calc-practice.js, study-aids.js, scratchpad.js, app.js, css/trainer.css, css/reader.css
- **style.display 읽기 → classList.contains('is-hidden')**: app.js 5곳
- **index.html 인라인 style → CSS 클래스**: calc-scratchpad-btn min-height, calc-scratchpad-canvas touch-action
- **AGENTS.md 업데이트**: CSS 모듈 목록 (ui-overlay.css, html-viewer.css 추가), check:imports 명령어/체크리스트 추가
- **SW**: v331-20260912-refactor-cleanup

### fix — scratchpad import 복원 (6e743ab)
- **원인**: 잔여 이슈 정리 중 `scratchpad.js`의 4개 함수를 미사용 import로 판단하여 제거했으나, `app.js:1272-1274`에서 `window` 전역 노출용으로 참조 중이었음 → `ReferenceError: clearScratchpad is not defined`
- **수정**: `scratchpad.js` import 블록 복원 (initScratchpadCanvas, clearScratchpad, toggleCalcScratchpad, toggleScratchpadEraser)
- **교훈**: `check:imports`는 import된 이름이 export되는지만 검증. `window.X = X` 패턴으로 참조하는 경우 미사용 import 제거 시 주의 필요
- **SW**: v332-20260912-fix-scratchpad-import

### 검증
- `npm test`: 248 pass, 0 fail
- `npm run check:imports`: 52개 파일, 오류 없음
- `npm run verify:assets`: 79개 자산 확인
- 프로덕션 HTTP 200

## 2026-09-12 리팩토링 후 import/export 누락 3종 수정

> P0-P3 리팩토링(모듈 분할) 직후 발생한 import/export 연결 누락.
> `app.js` 전체 ES 모듈 로드 실패 → 네비게이션 메뉴 동작 안 함.

### fix 1 — dashboard.js updatePomodoroUI import 경로 수정 (564357e)
- **원인**: `trainer.js` 리팩토링 시 pomodoro 로직이 `pomodoro.js`로 분리. `dashboard.js`가 여전히 `trainer.js`에서 `updatePomodoroUI`를 import → SyntaxError
- **수정**: `dashboard.js` import 경로를 `./trainer.js` → `./pomodoro.js`로 변경
- **SW**: v326-20260912-fix-pomodoro-import

### fix 2 — textbook-reader.js reader-audio.js re-export 추가 (afdfde0)
- **원인**: `textbook-reader.js` 분리 시 `reader-audio.js`에서 import만 하고 re-export하지 않음. `app.js`가 `textbook-reader.js`에서 `cycleReaderAudioRate` 등을 import 시도 → SyntaxError
- **수정**: `textbook-reader.js`에서 `import { ... } from './reader-audio.js'` + `export { ... }` 분리 (내부 사용 + 외부 re-export)
- **SW**: v327→v328-20260912-fix-reader-audio-import

### fix 3 — reader-audio.js getAudioPathForChapter export 추가 (6a63556)
- **원인**: `reader-audio.js`의 `getAudioPathForChapter`가 `function`으로만 선언되고 `export`되지 않음. `textbook-reader.js`의 `_renderChapterContentInternal`에서 참조 → ReferenceError
- **수정**: `reader-audio.js`에서 `function` → `export function` 변경. `textbook-reader.js` import/re-export에 추가
- **SW**: v329-20260912-fix-getAudioPathForChapter

### 예방 조치 — check:imports 스크립트 추가
- `tools/check-imports.js`: src/ 내 모든 ES 모듈의 import/export 교차 검증 (53개 파일)
- `npm run check:imports` 및 `npm run test:all`에 포함
- 리팩토링 후 배포 전 깨진 import를 자동 감지

### 검증
- `npm test`: 248 passed, 0 failed
- `npm run check:imports`: 53개 파일, 오류 없음
- 프로덕션 HTTP 200

## 2026-09-12 P0-P3 단계적 리팩토링 (하드코딩 최소화 · 모듈 분할 · 접근성 · 보안)

### P0 (보안/접근성/순환의존성)
- `quiz.js` ↔ `dashboard.js` 순환 의존성 해소: `dashboard.js`가 `daily-challenge.js` 직접 import
- `html-viewer.js` innerHTML XSS 방어: DOMParser 기반 sanitize (script/on\*/javascript: 제거)
- `exam-simulator.js` OMR 버블/시뮬레이터 옵션: `role="button"`, `tabindex="0"`, `aria-label`, Enter/Space 핸들러

### P1 (성능/접근성/에러처리)
- `textbook-reader.js` 참조 링크: 매 렌더링 addEventListener → document 단일 위임 리스너 + `data-ref-bound` 가드
- z-index 하드코딩 → CSS 토큰 통일 (`--z-modal-overlay`, `--z-orientation-toast`, `--z-html-viewer`, `--z-banner`, `--z-toast-top`)
- `index.html` 장식용 `<i>` 아이콘 122개에 `aria-hidden="true"` 일괄 추가
- `app.js`/`textbook-reader.js` await try/catch 래핑 (PWA userChoice, renderStudyAids)

### P2 (God Module 분할)
- `app.js` → `src/pwa-install.js` (289라인) + `src/theme-toggle.js` (54라인) 추출 — 1,688 → 1,359라인 (19.5% 감소)
- `textbook-reader.js` → `src/views/reader-audio.js` (533라인) 추출 — 1,805 → 1,292라인 (28.4% 감소)
- `charts.js` localStorage 캐싱: 3개 함수 중복 읽기 → 모듈 스코프 `getSimResults()` 캐싱
- `pwa-install-capture.js` console.log 7개 제거 (console.error 1개 유지)

### P3 (구조 개선/메모리/lifecycle)
- 재수출 패턴 제거: `app.js`가 `daily-challenge.js`/`pomodoro.js` 직접 import (quiz.js/trainer.js 재수출 블록 제거)
- `reader.css` → `css/reader-mermaid.css` (451라인) 분할 — 3,588 → 3,139라인 (12.5% 감소)
- `textbook-search.js` 메모리 최적화: `_titleLower` + `_contentLower` → `_searchText` 단일 필드 통합
- `scratchpad.js` `initScratchpadCanvas` 중복 등록 방지 가드 추가
- `reader-format.js` TODO 정규식 체인 코멘트 정리 (장기 개선으로 보류 명시)
- `trainer.js` → `src/views/trainer-calc-practice.js` (210라인) + `src/views/trainer-ingredients.js` (357라인) 추출 — 906 → 371라인 (59% 감소)
- `exam-simulator.js` → `src/views/exam-sim-state.js` (10라인) + `src/views/exam-sim-review.js` (50라인) 추출 — 856 → 826라인

### 하드코딩 최소화 (AGENTS.md 위반 해결)
- `style.display = '...'` 패턴 → `classList.toggle('is-hidden')` 전환 (11개 파일)
- `body.style.overflow` → `body.no-scroll` CSS 클래스
- JS 하드코딩 색상 → CSS 변수 (`--color-gray`, `--success-tint-40`, `--danger-tint-40`, `--highlight-yellow-strong`, `--color-on-brand`)
- `base.css` 컴포넌트 색상 토큰화 (`--color-success-lighter`, `--color-success-darker`, `--color-danger-darkest`, `--logo-text-gradient`)
- `ui-overlay.css` 배너/툴팁 색상 토큰화 (`--color-banner-warning`, `--color-banner-error`, `--white-tint-10`, `--tooltip-bg`)

### 검증
- `node --check`: 모든 변경 JS 파일 통과
- `npm test`: 248 passed, 0 failed
- `npm run test:dom`: 21 passed, 0 failed
- 프로덕션 HTTP 200

## 2026-09-11 "참조 자료 (법령 원문 · 별표)"를 "참조 자료 (법령 원문)"로 변경

- "별표" 제거: 참조 자료 섹션은 법령 원문 링크 목록이므로 "별표" 표기 불필요
- 6개 교재 파일 + TEXTBOOK_AUTHORING_GUIDE.md 수정

## 2026-09-11 "별표 인덱스" 용어를 "별표"로 변경

- 애매한 용어 "별표 인덱스"를 "별표"로 변경
- 8개 교재 파일 + TEXTBOOK_AUTHORING_GUIDE.md 수정

## 2026-09-11 원료 DB 링크 텍스트 한국어로 변경

- `approved_ingredients.md` → `사용가능원료.md`
- `banned_ingredients.md` → `사용금지원료.md`
- `restricted_ingredients.md` → `사용제한원료.md`
- 2과목 표준형/이야기형 모두 수정

## 2026-09-11 원료 DB 링크 404 오류 수정

### `../참조자료/원료/` 링크 처리 추가
- `reader-format.js`: `../참조자료/원료/*.md` 링크를 `data-ref-html`로 변환하는 패턴 추가
- 기존에는 `../참조자료/ref_md/` 패턴만 처리하여 `approved_ingredients.md`, `banned_ingredients.md` 링크가 404 오류 발생

### 검증
- `node --check`: 성공
- `npm test`: 248 passed, 0 failed
- `npm run test:dom`: 21 passed, 0 failed

## 2026-09-11 참조 자료 섹션 하이퍼링크 목록으로 교체

### "📚 참조 자료" 섹션 요약 설명 제거, 링크 목록으로 교체
- 8개 교재 파일에서 "📚 참조 자료" 섹션의 상세 요약 설명 제거
- 각 섹션을 고유 참조 문서 하이퍼링크 목록으로 교체
- 1과목: 2130줄 → 23줄 (18개 링크)
- 2과목 표준형: 1752줄 → 38줄 (33개 링크)
- 2과목 이야기형: 1246줄 → 36줄 (31개 링크)
- 3과목: 1541줄 → 24줄 (19개 링크)
- 4과목: 654줄 → 21줄 (16개 링크)
- 중복 링크 제거 (URL 기준 고유화)

### 검증
- `npm run build:data`: 성공 (4과목 cards 357→342, quizzes 104→100)
- `npm test`: 248 passed, 0 failed
- `npm run test:dom`: 21 passed, 0 failed

## 2026-09-11 과목간 교차 참조 링크 텍스트 따옴표 제거

- 70개 교차 참조 링크에서 챕터명 따옴표 제거
- 예: `[1과목 1챕터 "화장품법"](subj:law#ch01)` → `[1과목 1챕터 화장품법](subj:law#ch01)`

## 2026-09-11 과목간 교차 참조 표 제거

### "본 과목 항목 | 관련 과목" 표 제거
- 8개 교재 파일에서 "🔗 과목 간 교차 참조" 섹션 제거
- 표의 논리 오류 수정: "본 과목 항목"에 타 과목 항목이 나열되고 "관련 과목"이 단순 텍스트로만 표시
- 이미 챕터별 "관련 과목" 섹션에 하이퍼링크가 있으므로 중복 제거

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed
- `npm run test:dom`: 21 passed, 0 failed

## 2026-09-11 과목간 교차 참조 챕터 섹션 연관관계 표시

### 교차 참조 링크 챕터 앵커 추가
- 70개 교차 참조 링크에 챕터 앵커 추가: `subj:law` → `subj:law#ch01`
- 패턴: `N과목 M챕터` → `#ch0M` 앵커
- 표준형/이야기형 모두 수정

### 교재 리더 챕터 섹션 스크롤 기능 추가
- `reader-format.js`: `subj:key#chNN` URL을 `data-ref-subject` + `data-ref-chapter` 속성으로 변환
- `textbook-reader.js`: `data-ref-chapter` 클릭 시 해당 챕터 섹션으로 스크롤
  - 과목 전환 후 콘텐츠 로드 대기 (800ms)
  - "Chapter 01" 패턴 매칭으로 섹션 검색
  - 섹션 펼치기 및 스크롤

### 검증
- `node --check`: 성공
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed
- `npm run test:dom`: 21 passed, 0 failed

## 2026-09-11 과목간 교차 참조 하이퍼링크 추가

### "관련 과목" 섹션 교차 참조 링크 변환
- 교재 전체 "관련 과목" 섹션 70개 교차 참조를 Markdown 링크로 변환
- 패턴: `N과목 M챕터 "챕터명"` → `[N과목 M챕터 "챕터명"](subj:subjectKey)`
- 1과목: 8개, 2과목: 16개, 3과목: 18개, 4과목: 28개
- 표준형/이야기형 모두 수정

### 교재 리더 과목 이동 기능 추가
- `reader-format.js`: `subj:` URL을 `data-ref-subject` 속성으로 변환
- `textbook-reader.js`: `data-ref-subject` 클릭 핸들러 추가
  - 과목 선택 드롭다운 업데이트
  - change 이벤트 트리거로 과목 전환
  - 컨테이너 스크롤 상단으로 이동

### 검증
- `node --check`: 성공
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed
- `npm run test:dom`: 21 passed, 0 failed

## 2026-09-11 교재 본문 읽기 단원 선택 UI 제거

### 단원 선택 UI 제거
- 각 과목당 chapter가 1개뿐이라 단원 선택이 의미 없음
- index.html에서 단원 선택 드롭다운 제거
- textbook-reader.js에서 chapterSelect 참조 제거, 과목 선택 시 자동으로 chapter 0(전체) 로드
- populateChapterSelect 함수 제거
- 부제목/안내문 수정: "과목과 단원을 선택하여" → "과목을 선택하여"

### 검증
- `node --check`: 성공
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed
- `npm run test:dom`: 21 passed, 0 failed

## 2026-09-11 교재 전체 참조문서 하이퍼링크 전수 변환

### 2과목 백쿼트 참조문서 마크다운 링크 변환
- 2과목 표준형 3개, 이야기형 8개 = 11개 백쿼트 참조문서를 마크다운 하이퍼링크로 변환
- `../참조자료/원료/banned_ingredients.md` → 마크다운 링크
- `../참조자료/원료/approved_ingredients.md` → 마크다운 링크
- `사용 불가 원료.md` (존재하지 않는 파일) → `banned_ingredients.md`로 대체
- 교재 전체 참조문서 하이퍼링크 전수조사: 8개 파일 모두 ✅ 하이퍼링크 없는 참조문서 0개

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 교재 전체 매핑 표 별표 하이퍼링크 전수 추가

### 매핑 표 별표 참조 링크 전수 추가
- 교재 전체 매핑 표 24개 별표 표시에 하이퍼링크 추가
- 2과목: 9개 표 (표 1, 2, 4, 5) — 별표 1, 2, 3, 4~10 참조 링크 추가
- 4과목: 3개 표 (표 4, 9) — 별표 1, 2 참조 링크 추가
- 2과목 표 5 별표 번호 정정: 본문 정리표 기준
  - 별표 4~5(모발·체모) → 별표 6·7
  - 별표 6~7(여드름·탈모) → 별표 8·9
  - 별표 8~10(복합·기타) → 별표 5·10
- 표준형/이야기형 모두 수정

### 검증
- 매핑 표 내 별표 표시 24개, 하이퍼링크 없는 표시 0개
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 4과목 매핑 표 별표 2 용어 정정

### 매핑 표 별표 2 핵심 포인트 용어 정정
- "제한 대상 원료" → "사용 제한 원료 (제한 필요 원료)" — 법령 용어에 맞게 정정
- 본문 2288행 "사용상의 제한이 필요한 원료", 용어 정리표 "사용제한 원료 = 별표 2(제한 필요 원료)" 기준
- 표준형/이야기형 모두 수정

## 2026-09-11 4과목 매핑 표 별표 참조 링크 추가

### 매핑 표 핵심 포인트 구체화 및 하이퍼링크 추가
- 4과목 챕터4 매핑 표 "사용금지 원료 별표 1" 핵심 포인트 구체화
  - 본문 2246행의 별표 1 내용 반영: 사용할 수 없는 원료 (히드로퀴논·수은·비소 등), 배합 금지
- 별표 1, 별표 2 참조 링크 하이퍼링크 추가
  - 별표 1: 안전기준_별표1_사용불가원료.md
  - 별표 2: 안전기준_별표2_사용제한원료.md
- 표준형/이야기형 모두 수정

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 4과목 매핑 표 3단계 노드 중분류 나열 전수 수정

### 매핑 표 3단계 노드 중분류 나열 문제 전수 수정
- 4과목 16개 매핑 표 전수조사: 5개 표에서 3단계 노드가 중분류에 나열된 문제 발견
- 3단계 노드를 부모 2단계 노드의 핵심 포인트에 병합
- 수정 표: 표 3(1개), 표 4(3개), 표 7(6개), 표 8(4개), 표 9(5개) = 19개 3단계 노드
- 표 6(랑게르한스세포)는 2단계/3단계 동일 텍스트 false positive로 제외
- 표준형/이야기형 모두 수정

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 4과목 챕터2 매핑 표 구조 수정

### 매핑 표 3단계 노드 중분류 나열 문제 수정
- 4과목 챕터2(피부 및 모발의 생리구조) 매핑 표: 45행 → 34행
- 마인드맵 3단계 노드가 중분류에 나열된 문제 수정
- 3단계 노드는 핵심 포인트에 병합, 2단계 노드만 중분류로 유지
- 표준형/이야기형 모두 수정

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 매핑 표 "개요" 행 제거 및 구조 통일

### 매핑 표 "개요" 행 제거
- 2·4과목 매핑 표에서 "개요" 중분류 행 192개 제거 (2과목 26 + 4과목 166)
- 대분류를 다음 행으로 이동하여 1·3과목과 동일한 패턴으로 통일
- 2과목 표 3(색소 종류 및 기준): 빈 표 복구 — flat 구조를 공통 대분류 + 중분류로 재구성 (7행)
- 결과: 4과목 전체 매핑 표 "개요" 행 0, 빈 표 0, 표준형/이야기형 완전 일치

### 검증
- `npm run build:data`: 성공 (4과목 cards 341→357, quizzes 103→104)
- `npm test`: 248 passed, 0 failed

## 2026-09-11 3과목 이야기형 매핑 표 표준형 동기화

### 매핑 표 표준형/이야기형 내용 통일
- 3과목 이야기형 매핑 표 3의 1행 용어 차이 수정 ("병기" → "함께 표시")
- 1·4과목은 이미 완전 일치 (수정 없음)
- 결과: 4과목 전체 매핑 표 표준형/이야기형 완전 일치

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 2과목 이야기형 매핑 표 표준형 동기화

### 매핑 표 표준형/이야기형 구조 통일
- 2과목 이야기형 19개 매핑 표를 표준형 기준으로 동기화
- "개요" 행 제거 + 분할된 중분류 `·` 병합 → 표준형 구조로 통일
- 결과: 19개 표 모두 표준형/이야기형 행 수 일치

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 매핑 표 중분류 빈 셀 "개요" 통일

### 매핑 표 중분류 첫 행 통일
- 중분류가 빈 대분류 그룹 첫 행에 "개요" 추가 (옵션 C)
- 대상: 2과목(표준 13 + 이야기 58), 4과목(표준 83 + 이야기 83) = 237개 행
- 1·3과목은 빈 중분류 행이 없어 수정 없음
- 모든 매핑 표 행이 3셀(대/중/핵심) 모두 채워져 시각적 균일

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 매핑 표 "해당 없음" 제거

### 마인드맵 노드 상세 매핑 표 정리
- 84개 행에서 "해당 없음" 텍스트 제거 (빈 셀로 대체)
- 대상: 8개 교재 파일의 "마인드맵 노드 상세 매핑" 표
- 본문 내용 표(안전장비·중금속 등)의 "해당 없음"은 유지

### 관련 문서 갱신
- `docs/dev/TEXTBOOK_AUTHORING_GUIDE.md` 3.7.2절 신설: 매핑 표 형식 규칙 문서화
  - 3단 표 통일, 배치 순서, "해당 없음" 금지, 소분류 `·` 병합 규칙

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed

## 2026-09-11 교재 구조 일관성 개선

### 헤딩 배치 일관성: 마인드맵→섹션1 통일
- 11개 챕터(×표준/이야기형 = 20개 파일)의 개요 마인드맵이 `섹션1→마인드맵` 패턴이었음
- 전체 20개 챕터를 `마인드맵→섹션1` 패턴으로 통일
- 대상: 1과목 Ch01, 2과목 Ch01/03/06, 3과목 Ch01/02/03, 4과목 Ch01/02/03

### 매핑 표 형식 통일: 4단→3단
- 38개 "마인드맵 노드 상세 매핑" 표를 4단(대/중/소/핵심)에서 3단(대/중/핵심)으로 통일
- 소분류 열을 중분류에 `·` 구분자로 병합
- 대상: 2과목(14개), 3과목(10개), 4과목(14개) 매핑 표

### 검증
- `npm run build:data`: 성공
- `npm run check:parser`: 파서 등가성 통과
- `npm test`: 248 passed, 0 failed
- `npm run verify:assets`: 67개 자산 존재
- 인용 링크: 999/999, 0 이슈

## 2026-09-11 챕터 개요 마인드맵 누락 섹션 보완

### 개요 마인드맵 vs 본문 섹션 전수조사
- 19개 챕터 전수조사 결과 4개 챕터의 개요 마인드맵이 본문 주요 섹션을 누락
- 4과목 Ch01: `주요 규정`·`유효성` 노드 추가 (표준+이야기형)
- 4과목 Ch02: `모발 구조·성장주기`·`피부·모발 상태 분석` 노드 추가 (표준+이야기형)
- 4과목 Ch06: `원료·내용물 유효성`·`원료·내용물 규격` 노드 추가 (표준+이야기형)
- 3과목 Ch05: `포장 시험 방법` 노드 추가 (표준+이야기형)
- 매핑 표 8개 동기화, 빌드·파서 검증·248 테스트 통과

## 2026-09-11 챕터 개요 마인드맵 전수조사 수정

### 중앙 노드 제목 일치 (5개 챕터 × 표준/이야기형 = 10개)
- 3과목 Ch03: `설비·기구 위생관리` → `설비 및 기구관리`
- 3과목 Ch05: `포장재 관리` → `포장재의 관리`
- 4과목 Ch02: `피부 생리구조` → `피부 및 모발의 생리구조`
- 4과목 Ch03: `관능평가 절차` → `관능평가 방법과 절차`
- 4과목 Ch06: `혼합·소분 공정` → `혼합 및 소분`

### 마인드맵 노드 상세 매핑 표 추가 (5개 챕터 × 표준/이야기형 = 10개)
- 2과목 Ch02, Ch04, Ch05: 매핑 표 신규 추가
- 4과목 Ch05: 매핑 표 신규 추가

### 마인드맵 노드 상세 매핑 표 불일치 수정 (8개 챕터 × 표준/이야기형 = 16개)
- 1과목 Ch01: 대분류가 마인드맵 루트 직하위 노드와 일치하도록 수정
- 2과목 Ch01, Ch03, Ch06: 누락된 대분류 추가 및 구조 일치
- 3과목 Ch01, Ch04: 대분류를 마인드맵 노드와 일치하도록 수정
- 4과목 Ch07: 충진기 종류만 과도 분할 → 충진 방법/포장 방법/비교표 대분류로 재구성

### 인용 링크 동기화
- 999개 인용 링크 라인 번호 동기화 (515개 갱신 + 8개 수동 수정 + 517개 evidence link URL 동기화)
- 인용 동기화 검증: 999/999 동일, 0 미발견

### 검증
- `npm run build:data`: 성공
- `npm test`: 248 passed, 0 failed
- 인용 링크: 999/999 동일, 0 미발견
- sw.js CACHE_VERSION: `v302-20260911-mindmap-audit`


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

## 36. 참조자료 뷰어 성능 최적화 (2026-09-01)

> **목표**: html-viewer.js의 로딩·렌더링·검색 성능을 4가지 방안으로 최적화

### 수정 내역

1. **sessionStorage fetch 캐싱** (`src/html-viewer.js`)
   - 참조자료 HTML/MD 렌더링 결과를 sessionStorage에 24h TTL로 캐싱
   - 재방문 시 fetch 0회, parseMarkdown/DOMParser 0회로 즉시 렌더링
2. **span 일괄 제거 최적화** (`src/html-viewer.js`)
   - 기존: span마다 `insertBefore` + `removeChild` + `normalize()` 호출 (O(n) normalize)
   - 개선: 모든 span을 먼저 수집 후 일괄 unwrap, `normalize()`는 부모별 1회만 호출
   - 대용량 HTML(수만 개 span)에서 2-3배 빠른 로딩
3. **검색 조기 종료** (`src/html-viewer.js`)
   - 첫 매치 발견 즉시 스크롤, 나머지 하이라이트는 `requestIdleCallback`으로 50개씩 지연 처리
   - 키워드 클릭 시 체감 스크롤 속도 대폭 향상
4. **KEYWORD_INDEX 경로 단축** (`src/keyword-index.js`, `src/concept-map.js`, `src/reader-format.js`)
   - 키를 전체 경로에서 파일명으로 단축: `"content/참조자료/ref_md/.../file.md|L123"` → `"file.md|L123"`
   - 51KB → 14KB (72% 절감)
   - `concept-map.js`, `reader-format.js`에서 런타임에 `path.split('/').pop()`으로 파일명 추출

### 검증

- `npm test` 88/88 통과
- `CACHE_VERSION` → `v134-20260901-viewer-optimize`
- Vercel 배포 완료

---

## 37. Mermaid 개별 렌더링 및 키워드 링크 보호 (2026-09-01)

> **목표**: 1과목 마인드맵이 전부 표시되지 않는 문제 수정

### 문제 분석

- **증상**: 1과목은 Mermaid 마인드맵 전부 미표시, 2과목은 대부분 표시됨
- **원인 1 — 일괄 렌더링 실패**: `mermaid.run({ nodes: Array.from(nodes) })`로 모든 다이어그램을 한 번에 렌더링 → 하나의 파싱 에러가 전체 렌더링을 중단시킴
- **원인 2 — 키워드 링크 손상**: `reader-format.js`의 용어집 자동 링크가 `<pre class="mermaid">` 블록 내부의 키워드를 `<a>` 태그로 치환 → Mermaid 문법 손상
- **원인 3 — securityLevel strict**: `securityLevel: 'strict'`가 `<br/>` 등 HTML 태그를 차단하여 일부 다이어그램 렌더링 실패

### 수정 내역

- **`src/views/textbook-reader.js`**: `_renderReaderMermaid()` 개별 노드 렌더링으로 변경
  - `mermaid.run({ nodes: [node] })`로 노드별 순차 렌더링 → 하나 실패해도 나머지는 정상 렌더링
  - `securityLevel: 'loose'`로 변경
- **`src/manual-viewer.js`**: 동일한 개별 렌더링 + `securityLevel: 'loose'` 적용
- **`src/reader-format.js`**: 키워드 자동 링크 플레이스홀더 보호 정규식에 `<pre class="mermaid">` 블록 추가
- **`sw.js`**: `CACHE_VERSION` → `v146-20260901-mermaid-individual-render`

### 검증

- 1과목·2과목 모든 Mermaid 다이어그램 정상 렌더링 확인
- Vercel 배포 완료

---

## 39. 과목별 큐레이션 용어집 JSON 병합 + 테이블/뷰어 UI 수정 (2026-09-01)

> **목표**: 과목별 중요 용어 해설을 JSON 파일에서 큐레이션 정의로 관리하고, 빌드 시 기존 자동 추출 설명에 병합

### 구현 내역

- **`content/교재/glossary/subject{1-4}.json`** (신규): 과목별 큐레이션 용어 정의 (1과목 22개, 2과목 38개, 3과목 6개, 4과목 빈 배열)
- **`tools/build/build_keyword_index.js`**: 빌드 시 `content/교재/glossary/*.json` 읽어 `GLOSSARY_INDEX`의 `explanation`을 큐레이션 정의로 덮어쓰기, `curated: true` 플래그 추가
- **`src/views/textbook-reader.js`**: 용어집 테이블 헤더 "설명 (참조문서 발췌)" → "설명"으로 변경
- **`css/reader.css`**: 용어집 테이블 `table-layout: fixed` + `width: 100%` 적용, `glossary-ref` 컬럼 `white-space: nowrap` → `word-break: break-word` — 과목별 컬럼 폭 일관성 확보
- **`sw.js`**: `CACHE_VERSION` → `v152-20260901-html-viewer-scrollbar-color`

### HTML 뷰어 스크롤바 수정

- **문제**: `css/base.css` 전역 스크롤바 색상이 `rgba(255,255,255,0.1)` (흰색 반투명) → HTML 뷰어 흰 배경에서 스크롤바 안 보임
- **해결**: `src/html-viewer.js`에 뷰어 전용 스크롤바 스타일 추가 (`#888` thumb, `#f0f0f0` track, 12px)
- **구조 개선**: 오버레이를 flexbox → 절대 위치(`position:fixed`) 기반으로 변경, `overflow-y:scroll !important` + 인라인 스타일 이중 보장

### 검증

- 88/88 단위 테스트 통과
- Vercel 배포 완료 (v152)

---

## 38. 학습 보조 기능 축소 — 개념 맵·절차 플로우·행정처분 계단 삭제 (2026-09-01)

> **목표**: Mermaid 마인드맵/플로우차트가 교재 콘텐츠에 직접 내장됨에 따라 중복 기능인 개념 맵, 절차 플로우, 행정처분 계단 기능을 전면 삭제

### 삭제 내역

- **개념 맵 (Concept Map)**: `textbook-reader.js`에서 개념 맵 컨테이너 HTML, `renderConceptMap()` 호출, 토글 이벤트, `concept-map.js` import 제거
- **절차 플로우 (Procedure Flow)**: `renderStudyAids()`에서 `renderProcedureFlowCard()` 호출 제거
- **행정처분 계단 (Admin Penalty Steps)**: `renderStudyAids()`에서 `renderAdminPenaltyCard()` 호출 제거
- **`src/study-aids.js`**: `renderStudyAids()`가 기출 핵심 요약 + 숫자·기한 암기표 2종만 반환하도록 축소
- **`sw.js`**: `CACHE_VERSION` → `v147-20260901-remove-cmap-flow-penalty`

### 유지 기능

- 기출 필터 & 요약 카드 (🔖기출 마커 하이라이트 + 디밍 토글)
- 숫자·기한 빈칸 카드 (정규식 자동 추출 암기표)

### 검증

- Vercel 배포 완료

---

## 35. 키워드 스크롤 정확성 수정 (2026-09-01)

> **목표**: 교재 표 셀의 키워드(L###) 링크 클릭 시 하이라이트된 키워드가 아닌 엉뚱한 위치로 스크롤되는 문제 수정

### 문제 배경

- 교재 표 셀에 `(L119|KFCC_별표1_통칙.pdf)` 형태의 참조 링크가 있음
- L### 번호는 원본 PDF→HTML 변환 시의 `<p>` 인덱스이나, `parseMarkdown`이 생성하는 `<p>` 인덱스와 불일치
- 예: "정제수 (L119)" 클릭 시 "약5~약6.5"로 스크롤됨 (L119 = "약3이하", "정제수"는 L97)
- 전수검사 결과 스크롤 정확도 62-75% (L### 기반 스크롤)

### 수정 내역

- **`src/keyword-index.js`** (재생성): 교재 셀 텍스트에서 키워드 추출 → 참조자료 존재 여부 검증 → `KEYWORD_INDEX` 맵 (273개 키워드, 270/273 검색 가능 99%)
- **`src/html-viewer.js`**: L### 기반 스크롤 폐기, 키워드 기반 스크롤로 전환
  - `KEYWORD_INDEX`에서 키워드 추출 → `_doSearch()`로 검색 → 첫 번째 하이라이트로 스크롤
  - 공백 포함 키워드 검색 실패 시 첫 단어로 재검색 fallback
  - L###은 더 이상 스크롤에 사용하지 않음 (참조용으로만 유지)
- **`sw.js`**: `CACHE_VERSION` → `v133-20260901-keyword-scroll`

### 검증

- 전수검사: 909개 링크 전부 키워드가 참조자료에 존재하고 하이라이트 위치로 스크롤됨 (100%)
  - 1과목: 162개 (99% 직접 매칭, 1개 첫 단어 fallback)
  - 2과목: 291개 (100%)
  - 3과목: 230개 (100%)
  - 4과목: 226개 (100%)
- `npm test` 88/88 통과
- Vercel 배포 완료

---

## 34. 참조자료 연결 5종 개선 (2026-09-01)

> **목표**: 교재 본문과 참조자료 간 연결을 단순 하이퍼링크에서 컨텍스트 인식 Deep Linking 시스템으로 개선

### 변경 내용

1. **컨텍스트 사이드바** (`src/views/textbook-reader.js`)
   - `buildReferenceLinks()`에 `contextRefPath` 파라미터 추가
   - 현재 단원의 출처와 매칭되는 참조자료를 "이 단원의 참조자료" 섹션에 상단 추천 표시
   - `chapterRefPath` 계산을 HTML 템플릿 상단으로 이동하여 중복 제거

2. **Deep Linking (조문 레벨 앵커)** (`src/html-viewer.js`, `src/reader-format.js`, `src/concept-map.js`)
   - `openHtmlViewer()`에 `anchorId` 파라미터 추가 — 로딩 후 해당 요소로 스크롤
   - 앵커 검색 3단계: `#id` → heading 텍스트 매칭 → 검색 결과 fallback
   - `reader-format.js`: 출처 라인의 `제N조`를 추출하여 `data-ref-anchor` 속성 자동 추가
   - `concept-map.js`: 참조자료 배지 클릭 시 `data-ref-anchor` 전달

3. **본문 키워드 자동 하이퍼링크** (`src/pdf-registry.js`, `src/reader-format.js`)
   - `KEYWORD_REF_MAP` (28개 패턴) 추가: 별표/KFCC/법령명 키워드 → 참조자료 파일 매핑
   - `resolveKeywordRef()` 헬퍼 함수 추가
   - `reader-format.js`: `<p>`/`<li>` 내 키워드를 자동으로 `data-ref-html` 링크로 변환
   - 링크 클릭 시 검색어 하이라이트까지 자동 수행

4. **인라인 프리뷰 툴팁** (`src/views/textbook-reader.js`)
   - `_showPreview()` / `_hidePreview()` 함수 추가
   - 데스크톱: mouseenter 400ms 후 툴팁 표시 (200자 스니펫 + 검색어 컨텍스트)
   - 모바일: touchstart 600ms 롱프레스 → 3초 후 자동 닫기
   - `_previewCache`로 fetch 결과 캐싱하여 재호출 시 즉시 표시

5. **L### 참조 확장** (`src/reader-format.js`, `src/html-viewer.js`)
   - L### 링크에 `data-ref-anchor` + `data-ref-line` 속성 추가
   - `openHtmlViewer()`에 `lineNum` 파라미터 추가
   - 라인 번호 기반 스크롤: block-level 요소의 텍스트 라인을 카운트하여 해당 위치로 스크롤
   - 앵커 → 라인 번호 → 검색 결과 순서로 fallback

### 검증

- `npm test` 88/88 통과
- `CACHE_VERSION` → `v121-20260901-ref-link-enhance` 갱신
- Vercel 배포 완료

---

## 33. 성능·접근성·품질 일괄 개선 (2026-09-01)

> **목표**: 프로젝트 전체 기능·성능 리뷰에서 식별된 7개 개선항목을 일괄 적용

### 변경 내용

1. **Fisher-Yates 셔플 알고리즘 도입** (`src/utils.js`, `app.js`, `quiz.js`, `exam-simulator.js`, `flashcard.js`, `trainer.js`)
   - 편향된 `.sort(() => 0.5 - Math.random())` 11곳을 공정한 Fisher-Yates `shuffle()` 함수로 교체
   - 퀴즈 문제 순서, 플래시카드 셔플, 모의고사 문제 선택, 원료 챌린지 등 모든 무작위 선택에 적용

2. **서비스 워커 캐시 전략 분리** (`sw.js`)
   - `ref_md/*.md` 및 `ref_md/*.html` 파일을 `SHELL_CACHE`(배포마다 삭제)에서 `DATA_CACHE`(배포 간 유지)로 이동
   - ~26MB 참조자료가 매 배포마다 재다운로드되는 문제 해결

3. **localStorage 용량 초과 사용자 경고** (`app.js`, `state.js`)
   - `state._storageUnavailable` 플래그 감지 시 하단 고정 경고 배너 표시
   - `saveProgress()` 실패 시 자동으로 배너 활성화

4. **교재 검색 인덱스 사전 구축** (`src/views/textbook-search.js`)
   - `section.content.toLowerCase()`를 검색마다 재계산하던 것을 최초 1회만 계산하여 캐싱
   - `STUDY_DATA` 키 변경 시에만 인덱스 재구축 (자동 무효화)

5. **console.log → console.debug 변경** (`app.js`, `app-fallback.js`, `state.js`)
   - 프로덕션 환경에서 브라우저 콘솔 노이즈 제거
   - `console.error`/`console.warn`은 유지

6. **접근성 ARIA 속성 추가** (`html-viewer.js`, `exam-viewer.js`, `app.js`, `index.html`)
   - `html-viewer` 및 `exam-viewer` 오버레이: `role="dialog"`, `aria-modal`, `aria-label`, `role="heading"`
   - 검색 결과 카운트: `aria-live="polite"`
   - 퀴즈 피드백/결과 패널: `role="status"`, `aria-live="polite"`
   - 플래시카드: `role="button"`, `tabindex="0"`, 키보드 Enter/Space 플립 지원, `aria-expanded` 상태

7. **대시보드 통계 O(1) 조회** (`src/views/dashboard.js`)
   - 과목별 카운트 맵(`_getSubjCounts()`)을 캐싱하여 `Set.filter()` 3중 순회를 O(1) 조회로 대체
   - `memorizedCards.size + weakCards.size + quizResults.length` 키 기반 캐시 무효화

### 검증

- `npm test` 88/88 통과
- `CACHE_VERSION` → `v120-20260901-perf-a11y` 갱신
- Vercel 배포 완료: https://personalized-skincare-study.vercel.app

---

## 32. ref_md 대용량 파일 MD 변환 및 body-only 추출 (2026-09-01)

> **목표**: `ref_md` 디렉토리의 HTML 파일들이 ~44.5MB로 배포 용량 부담이 큰 문제를 해결하기 위해, 대용량 법령 원문 3개를 Markdown으로 변환하고 나머지 38개는 `<head>`/`<style>`/base64 이미지를 제거하여 용량 절감

### 문제 배경

- `ref_md` HTML 파일 42개 총 ~44.5MB가 Vercel 배포에 포함되어 업로드 시간 및 저장소 부담
- 상위 3개 법령 원문 (기능성화장품 기준 11MB, KFCC_별표10 5.3MB, 화장품 안전기준 3.3MB)이 전체의 ~60% 차지
- 이들은 순수 텍스트(조문)로 절대 좌표 기반 배치가 의미 없음 → Markdown 플로우 레이아웃이 오히려 모바일에서 가독성 향상
- 나머지 파일들은 `<head>`/`<style>`(~2KB, 모든 파일 동일)과 base64 인라인 이미지가 불필요 (`html-viewer.js`는 `body.innerHTML`만 사용)

### 수정 내역

- **`content/utils/convert_ref_md.py`** (신규): HTML→MD 변환 및 body-only 추출 Python 스크립트
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
- **`.gitignore`**: `!content/참조자료/ref_md/**/*.md` 예외 추가 (MD 변환본 Git 추적)
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

> **목표**: PDF.js 기반 참조자료 뷰어의 페이지/라인 참조 오류를 근본 해결하기 위해, `ref_md` 폴더의 HTML 변환본을 iframe으로 표시하고 DOM 텍스트 노드 직접 검색으로 정확한 하이라이트 제공

### 수정 내역

- **`src/html-viewer.js`** (신규): iframe 기반 HTML 참조자료 뷰어 오버레이. DOM `TreeWalker`로 텍스트 노드 순회 → `<mark>` 하이라이트 + 스크롤. 검색어 자동 검색, 인쇄 지원
- **`src/pdf-registry.js`**: `PDF_DIRS`→`REF_DIRS`, `SOURCE_PDF_MAP`→`SOURCE_REF_MAP`, `PDF_FILE_TO_PATH`→`REF_FILE_TO_PATH`, `PDF_REGISTRY`→`REF_REGISTRY`로 개명. `_toHtmlPath()` 함수로 PDF 파일명 → `ref_md/{base}/{base}.html` 경로 자동 변환. `resolvePdfPath`→`resolveRefPath`, `mapSourceToPdf`→`mapSourceToRef`로 개명
- **`src/reader-format.js`**: `data-pdf-path`→`data-ref-html`, `data-pdf-search`→`data-ref-search` 속성명 변경. `pdfPath` 파라미터→`refPath`로 개명. 참조자료 파일 목록의 PDF 타입을 HTML 경로로 변환. 아이콘 `fa-file-pdf`→`fa-file-lines`로 통일
- **`src/views/textbook-reader.js`**: `openPdf` import→`openHtmlViewer` import. `mapSourceToPdf`→`mapSourceToRef`. `chapterPdfPath`→`chapterRefPath`, `pdfPath`→`refPath` 변수명 변경. `buildReferenceLinks()` 내 PDF 경로→HTML 경로 변환. `bindReferenceLinks()`에서 `data-pdf-path`→`data-ref-html` 바인딩
- **`src/concept-map.js`**: `pdfPath`→`refPath` 파라미터/변수명 변경. `data-pdf-path`→`data-ref-html` 속성명 변경. `PdfViewer.openPdf`→`HtmlViewer.openHtmlViewer` 호출 변경
- **`sw.js`**: `pdf-viewer.js`→`html-viewer.js` 캐시 대상 교체. `pdf.min.mjs`/`pdf.worker.min.mjs` 프리캐시 제거. `CACHE_VERSION` → `v103-20260901-html-viewer-docs`
- **`.gitignore`**: `!content/참조자료/ref_md/**/*.html` 예외 추가 (HTML 변환본 Git 추적)
- **`.vercelignore`**: `!content/참조자료/ref_md/**/*.html` 배포 포함. `content/참조자료/**/*.pdf` 배포 제외 (용량 절감 ~27MB)
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

---

## 40. 마인드맵 노드 불일치 12건 수정 (2026-09-02)

> **목표**: 4개 과목의 마인드맵 노드 및 매핑 테이블이 교재 본문과 불일치하는 사항을 일괄 수정 (본문/이야기형 양쪽 동시 적용)

### 수정 내역

**🔴 고우선순위 (5건)**
- **2과목 위해사례 회수기간**: 가등급 즉시/나등급 7일/다등급 15일 → 가등급 15일 이내, 나·다등급 30일 이내, 회수계획서 5일 이내 (본문+이야기형)
- **1과목 개인정보 보호법 6대 권리**: 영수증 발급/이용제한 요구/열람 요구 등 → 교재에 맞게 ① 정보 제공받을 권리 ~ ⑥ 자동화 결정 거부·설명으로 수정 (본문)
- **3과목 청정도 등급**: A/B/C/D등급 → 1~4등급 (본문+이야기형)
- **2과목 진주광택색소**: 운모·염소산비스무트 → 옥시염화비스무트·운모티탄 (본문+이야기형)
- **4과목 자격시험**: 필기60%·실기40% 잔재 → 이미 수정됨 확인

**🟠 중간우선순위 (5건)**
- **4과목 시설기준**: 불필요한 "필수 설비" 노드(교반기·유화기 등) 제거, "분리·구획" 중심으로 정리 (본문+이야기형)
- **1과목 실태조사 라벨**: "실태조사 5년마다" 통합 라벨 → "실태조사" + "5년마다 실시" 하위 노드로 분리 (본문)
- **4과목 안전성시험 9종**: 3줄 묶음(단회독성·피부자극 / 안점막·감작성·광독성 / 인체첩포·유전독성) → 9종 개별 나열 (본문+이야기형)
- **3과목 소독제 맥락 추가**: "소독제 4종" → "소독제 4종(손 소독용)", "소독제 6종" → "소독제 6종(시설용)" (본문+이야기형)
- **4과목 표피 5층 순서**: 기저→각질 역순 → 각질→투명→과립→유극→기저 본문 순서대로 수정 (본문+이야기형)

**🟡 저우선순위 (2건)**
- **2과목 오탈자**: 증목 → 증점 (본문+이야기형)
- **2과목 오탈자**: 영향분 → 영양분 (본문+이야기형)

### 검증

- `npm run build:data` 성공 (카드 1,162개, 퀴즈 330개, 파서 등가성 검사 통과)
- `sw.js` CACHE_VERSION v154 → v155 bump
- Git commit `d28903f` — 10 files changed, 174 insertions, 164 deletions
- Vercel 배포 완료

---

## 41. 이야기형 교재 5가지 개선안 전 과목 적용 (2026-09-02)

> **목표**: 4개 과목 이야기형 교재(`*_이야기형.md`)에 5가지 서사적 개선안을 순차 적용하여 학습 몰입도와 시험 함정 회피 능력 향상

### 적용 대상
- `content/교재/law/1과목_화장품법의이해_이야기형.md`
- `content/교재/manufacturing/2과목_제조및품질관리_이야기형.md`
- `content/교재/safety/3과목_유통화장품안전관리_이야기형.md`
- `content/교재/understanding/4과목_맞춤형화장품의이해_이야기형.md`

### 5가지 개선안

1. **프롤로그 강화**: 주인공의 실수 경험을 설정에 추가 — "각 단계에서 실수를 통해 시험 함정을 발견한다"는 서사 구조 명시
2. **읽는 방법 4단계 가이드**: 상황 이해 → 🎯 시험 포인트 확인 → 🔖 기억 태그로 함정 회피 → ⚖️ 법령 원문 확인 → 💭 에필로그로 흐름 연결 (외부 리뷰 후 문구 다듬기 적용)
3. **여정도 추가**: 기존 "학습 안내/학습 목표/학습 흐름/출제 빈도/과목 시각화 개요" 중복 섹션을 "수진의 여정도" 하나로 통합 — 각 장의 실수→교훈을 시각화
4. **실수→교훈 패턴 (🔖 기억 태그)**: 각 장 핵심 개념에서 주인공이 흔히 저지를 실수를 대화 형식으로 제시하고, 전문가가 정정하는 패턴 추가
   - 1과목: 2개 장 (법령 체계, 개인정보 보호법)
   - 2과목: 5개 장 (원료 분류, 품질 관리, 사용제한, 위해사례, 관리 기준)
   - 3과목: 5개 장 (위생관리, 설비관리, 미생물 한도, 포장재, 안전용기)
   - 4과목: 5개 장 (성장주기, 관능평가, 표시사항, 사용가능원료, 포장공간)
5. **에필로그 (💭)**: 각 장 끝에 에필로그와 다음 장 예고 추가 — 전 과목 최종 에필로그로 서사 마무리

### 외부 리뷰 후 추가 수정

6. **🎭 "이야기에서 자료로" 전환 블록**: 4개 과목 별표·별지 서식 종합 인덱스 앞에 서사→실무 자료 전환 안내 블록 추가 — "여기서부터는 인물의 장면이 아니라 근거 자료"임을 명시
7. **🎬 통합 에필로그 (4과목 말미)**: 민수(1과목)·지연(2과목)·현우(3과목)·수진(4과목) 네 주인공이 하나의 조제대에서 만나는 통합 에필로그 추가 — 4개 과목이 하나의 제품이 고객에게 닿기까지의 흐름임을 마무리
8. **읽는 방법 문구 다듬기**: "에필로그와 다음 장 예고" → "에필로그를 읽으면 다음 장이 예고되어"로 자연스럽게 수정 (3개 과목)
9. **스마트쿼터(“”) → ASCII 따옴표(") 통일**: 법령 원문 및 에필로그 대사의 인코딩 일관성 확보 (3·4과목)

### 검증

- `npm run build:data` 성공 (카드 1,162개, 퀴즈 330개, 파서 등가성 검사 통과)
- `sw.js` CACHE_VERSION v155 → v155 bump
- Git commit `a3bc396` — 4과목 6 files changed, 478 insertions, 261 deletions
- 외부 리뷰 후 추가 수정: Git commit `2ee7167` — 문서 갱신 포함 3 files changed
- Vercel 배포 완료

---

## #42 — 교재 본문 기출문제 링크 클릭 시 문제집 HTML 뷰어로 이동 (2026-09-02)

### 변경 내용

1. **마크다운 링크 파싱 추가**: `markdown-parser.js`에 `[text](url)` → `<a href="url">text</a>` 변환 로직 추가 — 기존에는 마크다운 링크가 텍스트로만 렌더됨
2. **기출문제 링크 → ExamViewer 연동**: `reader-format.js`에서 기출문제 링크(`기출문제/과목N_...`)를 `data-exam-md` 속성으로 변환, 실제 파일 경로(`content/문제은행/과목N_단일정답형.md`) 매핑
3. **참조자료 PDF 링크 처리**: 표 내 `[file.pdf](../참조자료/...)` 링크도 `data-ref-html`로 변환하여 앱 내 HTML 뷰어에서 열리도록 처리
4. **클릭 이벤트 바인딩**: `textbook-reader.js`의 `bindReferenceLinks()`에 `data-exam-md` 클릭 핸들러 추가 — `ExamViewer.openExam(mdPath)` 호출로 앱 내 전체화면 오버레이에 문제집 HTML 렌더링

### 검증

- `npm run build:data` 성공 (카드 1,162개, 퀴즈 330개, 파서 등가성 검사 통과)
- Vercel 배포 완료

---

## #43 — 용어집 링크 클릭 후 원래 위치로 돌아가기 (2026-09-02)

### 변경 내용

1. **`scrollToGlossary()` 공유 함수 추가**: `glossary-renderer.js`에 용어집 점프 + 원래 위치 복귀 기능을 통합한 공유 함수 추가. 클릭 시 스크롤 컨테이너(`.textbook-reader-content` / `.main-content`)의 `scrollTop`을 저장하고 용어집 테이블 해당 행으로 스크롤
2. **플로팅 "원래 위치로" 버튼**: 용어집 점프 후 화면 우하단에 고정 버튼 표시. 클릭 시 저장된 위치로 smooth scroll 복귀 후 자동 숨김
3. **`concept-map.js` 통합**: 개념 맵의 용어집 링크도 동일하게 `scrollToGlossary()` 사용하도록 수정
4. **CSS 추가**: `css/reader.css`에 `.glossary-back-btn` 플로팅 버튼 스타일 추가 (fixed, 둥근 모서리, 호버 애니메이션)
5. **SW 캐시 버전**: `v171` → `v172` bump

### 검증

- `npm test` 250 pass, 0 fail
- Git commit `2ca7627` (기능 구현), `6cc2bac` (스크롤 컨테이너 수정), `172babf` (SW bump)
- Vercel 배포 완료

---

## #44 — 화장품법 PDF 중복 제거 (2026-09-03)

### 변경 내용

1. **중복 PDF 삭제**: `content/참조자료/공통/화장품법(법률)(제20901호)(20260402).pdf` (22페이지, 186KB) 삭제 — `content/참조자료/법령원문/`의 30페이지 완전본(206KB)이 정본
2. **pdf-registry.js 갱신**: `REF_DIRS['공통']`에서 화장품법 PDF 항목 제거, `REFERENCE_COMMON` 배열에서도 제거 — 법령원문 폴더의 30페이지 버전만 서비스

### 검증

- `npm test` 248 pass, 0 fail
- Git commit `466cf66`
- Vercel 배포 완료

---

## #45 — 전역 테이블 가로 스크롤 적용 (2026-09-03)

### 배경

교재 및 참조자료의 테이블이 컨테이너 너비를 초과할 때 셀 내용이 찌그러지거나 잘리는 문제. 기존에는 모바일 `@media`에서 `table{display:block;overflow-x:auto}`를 적용했으나 `display:block`이 테이블 셀 정렬을 깨뜨리는 부작용.

### 변경 내용

1. **`css/base.css` 전역 규칙 추가**: 모든 `<table>`에 `width:max-content; min-width:100%; border-collapse:collapse` 적용 — 좁은 테이블은 컨테이너를 채우고, 넓은 테이블은 콘텐츠 너비만큼 확장되어 wrapper의 `overflow-x:auto`가 가로 스크롤 담당
2. **`css/reader.css` 개별 컴포넌트 정리**:
   - `.reader-table`에서 `width`/`min-width` 제거 (전역 규칙에 위임)
   - `.admin-penalty-table`에서 `width:100%` 제거 (전역 규칙에 위임)
   - 모바일 `@media`의 `table{display:block;overflow-x:auto}` 제거 → wrapper 기반 스크롤로 통일
   - `.glossary-table`은 `table-layout:fixed` 유지를 위해 `width:100%!important; min-width:unset!important`로 예외 처리
3. **`src/html-viewer.js` 인라인 CSS 정리**: 참조자료 뷰어 및 인쇄 CSS에서 `width:max-content;min-width:100%` 제거 (전역 규칙에 위임)

### 검증

- `npm test` 248 pass, 0 fail
- Git commit `b6f9992`
- Vercel 배포 완료

---

## #46 — 교재 통합 검색 머메이드 다이어그램 렌더링 (2026-09-03)

### 배경

교재 본문 통합 검색 결과에서 머메이드 다이어그램이 포함된 섹션이 raw 텍스트(`graph TD ...`)로 출력되는 문제. 기존 `formatSectionContent`가 단순 텍스트 라인별 `<p>` 래핑만 수행하여 코드블록(```mermaid ... ```)을 처리하지 못함.

### 변경 내용

1. **`src/views/textbook-search.js` `formatSectionContent` 재작성**: 단순 라인별 래핑 → `parseMarkdown(rawContent, {allowMermaid:true, useReaderStyles:true, ...})` 기반으로 변경. 마크다운 코드블록, 머메이드, 테이블 등 모든 마크다운 요소 지원
2. **검색어 하이라이트**: 마크다운 파싱 후에 적용하도록 순서 조정
3. **머메이드 온디맨드 로드/렌더 추가**: `_ensureMermaid()` + `_renderSearchMermaid(container)` 함수 추가 — `textbook-reader.js`와 동일한 온디맨드 패턴 (다이어그램이 있을 때만 mermaid.min.js 로드)
4. **검색 결과 렌더링 후 mermaid 실행**: `performTextbookSearch()` 마지막에 `_renderSearchMermaid(container)` 호출

### 검증

- `npm test` 248 pass, 0 fail
- Git commit `f7934fa`
- Vercel 배포 완료

---

## #47 — Mermaid 추가 다이어그램 타입 지원 및 교재 sequenceDiagram 교체 (2026-09-03)

### 배경

교재에서 Mermaid mindmap/flowchart만 사용 중이었으나, 행정 절차 등 다행위자 상호작용을 시각화하기에 sequenceDiagram이 더 적합한 케이스가 존재. 또한 Mermaid.js가 지원하는 다른 다이어그램 타입(gantt, pie, timeline, stateDiagram, gitGraph, quadrantChart 등)도 추가 비용 없이 활용 가능.

### 변경 내용

1. **`src/mermaid-utils.js` 신규 추가**: 다이어그램 타입 감지 공용 유틸리티
   - `detectMermaidType(text)`: 12종 타입 자동 감지 (mindmap, flowchart, sequence, class, state, gantt, pie, gitGraph, timeline, quadrant, sankey, er)
   - `getMermaidClassName(type)`: CSS 클래스 반환 (`mermaid-mindmap` | `mermaid-flowchart` | `mermaid-other`)
   - `getMermaidInitOptions(type, isLight)`: 타입별 Mermaid initialize 옵션 반환
2. **3개 렌더링 모듈 리팩터링**: `textbook-reader.js`, `textbook-search.js`, `manual-viewer.js` — 하드코딩된 mindmap/flowchart 분기를 `mermaid-utils.js` 공용 함수로 교체
3. **`css/reader.css` 스타일 추가**: `mermaid-other` 클래스 다크/라이트 테마 텍스트 대비 보정
4. **문서 갱신**:
   - `TEXTBOOK_AUTHORING_GUIDE.md`: 6종 추가 다이어그램 예시 (sequence, gantt, pie, timeline, state, gitGraph, quadrant) + 렌더링 스타일 분리 표 갱신
   - `STUDY_APP_DESIGN_GUIDE.md`: Mermaid 다이어그램 섹션 12종 전체 표로 확장
5. **교재 5곳 flowchart → sequenceDiagram 교체** (이야기형+표준형 각 10파일):
   - 제3조 영업의 등록: 영업희망자↔식약처장↔지방식약청장 상호작용
   - 제4조 기능성화장품 심사: 제조업자↔식약처장 심사/보고 절차
   - 제5조의2 위해화장품 회수: 영업자↔식약처장 회수·공표·감경 절차
   - 제24조 등록의 취소: 식약처장→영업자 행정처분 (의무/재량 + 과징금)
   - 2과목 기능성화장품 심사 흐름도: 제조업자↔식약처 심사/보고 + 승인/보완/반려

### 검증

- `npm run build:data` 성공, 파서 등가성 검사 통과
- `npm test` 248 pass, 0 fail
- Git commit `b9ad2ae` (기능 구현), `ed9c0f5` (SW bump)
- Vercel 배포 완료

---

## #48 — Service Worker 업데이트 알림 토스트 팝업 (2026-09-03)

### 배경

PWA에서 새 Service Worker가 감지되어 백그라운드에서 새 데이터를 fetch할 때 사용자에게 진행 상황이 보이지 않아, 갑작스러운 페이지 리로드로 인해 현재 학습 중인 화면을 잃는 불편이 발생.

### 변경 내용

1. **`src/pwa-install-capture.js`**: SW `updatefound` → `statechange` → `controllerchange` 생명주기 이벤트를 3단계 토스트 팝업으로 추적
   - 1단계: "새 버전 감지 — 다운로드 중..."
   - 2단계: "설치 중..."
   - 3단계: "업데이트 완료 — 페이지 새로고침" (자동 리로드)
   - `document.body` 미준비 시 `DOMContentLoaded`까지 토스트 생성 지연
   - 페이지 로드 시 `reg.update()` 강제 호출로 브라우저 기본 긴 업데이트 주기 단축
2. **`docs/dev/ARCHITECTURE.md`**: SW Lifecycle 섹션에 토스트 팝업 알림 흐름 문서화
3. **`docs/dev/DEPLOYMENT_GUIDE.md`**: 배포 체크리스트에 SW 캐시 버전 갱신 단계 추가

### 검증

- Git commit `860a5c5`
- Vercel 배포 완료

---

## #49 — 참조자료 뷰어 PDF 저장 기능 (2026-09-03)

### 배경

참조자료를 앱 내에서만 열람할 수 있고 PDF 파일로 저장할 수 없는 문제. 원본 PDF(27.2MB)는 `.vercelignore`로 배포 제외되어 있어, MD 변환본(3.7MB)을 활용한 PDF 저장 방식 필요.

### 변경 내용

1. **`src/html-viewer.js`**: 툴바에 "PDF 저장" 버튼 추가 (파일 PDF 아이콘 + 텍스트)
   - 기존 인쇄 버튼과 공통 `_printContent()` 함수 사용 → 브라우저 인쇄 다이얼로그에서 "PDF로 저장" 선택
   - **전체 문서 출력 수정** (v210): 오버레이 스타일시트를 인쇄 창에 포함하지 않고, 인쇄 전용 CSS만 별도 주입 — `position:fixed; height:100vh; overflow:hidden` 등 오버레이 제약이 원인이었던 2페이지 잘림 문제 해결
   - `content.innerHTML`를 직접 `<body>`에 주입하여 깔끔한 인쇄 문서 구조 생성
   - `escHtml()` 헬퍼 추가로 문서 제목 XSS 방어
2. **`docs/dev/ARCHITECTURE.md`**: `html-viewer.js` 및 `pdf-registry.js` 설명에 PDF 저장 기능 문서화, 다이어그램 라벨 갱신

### 검증

- Git commit `a008115` (버튼 추가), `9b89d35` (전체 출력 수정), `d16247b` (문서 갱신)
- Vercel 배포 완료

---

## #50 — ref_md 구버전 _구 파일 정리 (2026-09-03)

### 배경

`content/참조자료/ref_md/`에 41개 MD 변환본 중 5개의 `_구` 접미사 구버전 파일이 레지스트리에 미등록된 dead data로 잔존. PDF↔MD 1:1 매칭 검증에서 5개 불일치 발견.

### 변경 내용

1. **5개 `_구` 디렉토리 삭제**:
   - `안전기준_별표1_독성시험법_구/`
   - `안전기준_별표1_색소_구/`
   - `안전기준_별표2_기준시험방법작성요령_구/`
   - `안전기준_별표3_자외선차단효과측정_구/`
   - `안전기준_별표4_자료제출생략기능성_구/`
2. **`src/pdf-registry.js`**: `REF_DIRS.과목2`에서 `안전기준_별표1_색소_구.pdf` 제거
3. **정합성 검증**: MD 36개 = Registry 36개, 불일치 0건 확인

### 검증

- Git commit `87f3cae`
- Vercel 배포 완료 (v211)

---

## #51 — 문제은행 인용 검증 2차: 교재·법령 줄번호 일괄 수정 (2026-09-07)

### 배경

문제은행 4개 과목 MD 파일의 교재/법령 인용 줄번호가 참조원문과 불일치하는 227건 발견. 이를 4단계로 분류하여 일괄 수정.

### 변경 내용

1. **디옥산 4건** (과목2 Q62·115·181·198): L3841→L3838 (교재 원문 줄번호 오기 정정)
2. **교재 부분편집 9건**: 교재 원문 재편집으로 인한 줄번호 밀림 보정
3. **교재 정답표전용요약 34건**: 정답표에만 존재하는 요약문이 교재 본문에 없어, 본문에서 최적 근거 라인 검색 후 재연결
4. **법령 180건**: 참조법령 MD 파일에서 근거문구 일치 라인 재검색 후 줄번호 갱신
5. **수동 12건 출처 오류** (과목1 Q9·14·28·32·38·48·83·89·91·93·96·100): 잘못된 조문/별표 링크를 올바른 위치로 재연결
   - Q9·48·83·93: 시행규칙 L1007 (제12조 책임판매업자 준수사항)
   - Q91: 별표2 L27 (안전관리정보수집)
   - Q14·28·96: 화장품법 L2015 (제38조 벌칙)
   - Q32·38·89: 시행규칙 L1115 (제12조의2 맞춤형판매업자 준수사항)
   - Q100: 화장품법 L283 (맞춤형화장품판매업 정의)
6. **과목2 Q14 (청정도 등급표)**: 교재(표준형+이야기형)에 청정도 등급표 참고표 추가 후 링크 (L4893), 과목2 문제은행 L4891 초과 참조 3건 +9 보정
7. **과목4 Q66 (희석 계산식)**: 근거 원문이 존재하지 않는 계산 풀이 → "계산 해설" 표기로 링크 제거
8. **정상(오탐) 2건** (과목4 Q168·400): 별표7 L61이 정확히 맞음, 수정 불필요
9. **과목1 교재 인용 19건 줄번호 회귀 수정** (Q7·8·13·30·34·37·39·42·55·66·68·77·78·80·82·86·90·98·99): 이전 커밋 과정에서 되돌아간 줄번호를 정확한 위치로 복구 (38개 토큰)
10. **과목2 Q182·Q212** (인적자원/맨파워): L5429(학습방법) → L5410(CGMP 3요소 구조)로 수정
11. **과목1 잔여 10건 교재 인용 → 법령 조문으로 재연결** (Q18·21·26·45·46·51·53·57·61·97): 교재 요약행에만 존재하는 근거를 법령 원문으로 직접 연결
    - Q18·45·46: → 시행규칙 별표6 L3 (위해화장품 공표문)
    - Q21: → 화장품법 L1979 (제37조 벌칙, 1년 이하 징역/1천만원 벌금)
    - Q26: → 시행규칙 L1593 (전성분 표시 생략)
    - Q51: → 시행규칙 L1091 (안전성·유효성 정보 보고)
    - Q53: → 화장품법 L1921 (제36조 벌칙, 3년 이하)
    - Q57: → 화장품법 L1711 (제28조 과징금처분, 10억원)
    - Q61: → 시행규칙 L1673 (별표4 포장표시기준)
    - Q97: → 화장품법 L871 (제8조 안전기준, 사용금지 원료)

### 검증

- `npm run build:data` 성공, 파서 등가성 검사 통과
- 빌드 데이터(`data/exams/`, `data/registry.js`, `sw.js`) 갱신 완료

---

## 📌 인용 링크 기능 개선 (2026-09-07)

### 배경

PWA에서 교재 근거 인용 링크(`[교재: L####](<../교재/.../*.md#L####>)`) 클릭 시 404 오류, 동일 내용 반복 표시, 하이라이트 미작동 등의 문제가 순차적으로 발생함.

### 변경 내용

1. **Service Worker 캐시 분리** (`sw.js`)
   - `MD_ASSETS`(교재/문제은행 MD)를 `SHELL_CACHE` → `DATA_CACHE`로 이관
   - 배포 시 `SHELL_CACHE` 전체 삭제로 인해 26MB 교재 MD가 매 배포마다 재다운로드되는 문제 해결
   - `MD_PATTERN` fetch handler를 단순화하여 항상 `DATA_CACHE` 사용

2. **마크다운 파서 URL 수정** (`src/markdown-parser.js`)
   - 인용 링크 URL의 꺾쇠 괄호(`<>`)가 `escapeHTML`에 의해 `&lt;`/`&gt;`로 변환되어 잘못된 href 생성
   - 링크 파싱 단계에서 `&lt;`/`&gt;` 엔티티를 제거하여 올바른 URL 복원

3. **인용 링크 클릭 인터셉트** (`src/exam-viewer.js`)
   - 문제집 뷰어 내의 `.md` 링크 클릭 시 브라우저 네비게이션 대신 오버레이 내에서 교재 파일 열기
   - 상대경로 해결: `new URL(href, baseDir)` 기반으로 절대경로 생성 후 선행 `/` 제거

4. **라인 기반 하이라이트** (`src/markdown-parser.js`, `src/exam-viewer.js`)
   - `parseMarkdown`에 `addLineNumbers` 옵션 추가: 각 HTML 요소에 `data-md-line="N"` 속성 부여
   - `_scrollToLine`을 텍스트 매칭 → `data-md-line` 속성 기반 매칭으로 전면 개편
   - 정확한 라인 번호 매칭, 테이블 행 단위 스크롤, 비례 스크롤 폴백 유지
   - 하이라이트 CSS 개선: 펄스 애니메이션(1.5s × 2회), 노란색 배경, 5초 지속

5. **뒤로가기 네비게이션** (`src/exam-viewer.js`)
   - 인용 링크로 교재 파일을 연 후 이전 문제집으로 돌아가는 "뒤로" 버튼 추가
   - `_navStack` 히스토리 스택: 현재 문서 경로와 스크롤 위치 저장
   - `openExam`에서 다른 파일 열 시 현재 문서를 스택에 push
   - `_goBack`에서 스택 pop 후 이전 문서 복원 (스크롤 위치도 복원)

6. **sessionStorage 캐시 버전 갱신** (v4 → v5)
   - HTML 포맷 변경(`data-md-line` 속성 추가)으로 캐시 무효화

### 검증

- `npm test` 248개 단위 테스트 전수 통과
- `npm run build:data` 성공, 파서 등가성 검사 통과
- 인용 라인 번호 전수검증: 828개 링크(과목1: 74, 과목2: 213, 과목3: 195, 과목4: 346) 0개 오류
- Vercel 프로덕션 배포 완료

---

## #52 — 접근성 + 알림 UX 개선 3단계 (A1 + B1 + A4) (2026-09-10)

> **목표**: 키보드 접근성, 네이티브 대화상자 대체, 전정 감각 민감 사용자 지원

### 변경 내용

1. **A1: `:focus-visible` 포커스 링** (`css/base.css`)
   - 전역 `:focus-visible` 규칙 추가 — 마우스 클릭 시 포커스 링 숨김, 키보드 탐색 시 2px primary 색상 링 표시

2. **B1: alert/confirm → 커스텀 토스트/모달** (`src/ui-utils.js` + 9개 뷰 모듈)
   - `showToast(message, type, duration)`: 중앙 정렬, 타입별 아이콘/색상 (info/success/warning/error)
   - `showConfirm(message, title)`: Promise 기반 컨펌 모달, 백드롭 클릭/Escape로 취소, 44px 터치 영역
   - 30곳의 `alert`/`confirm`을 커스텀 컴포넌트로 교체
     - `app.js`: 진도 초기화, 시험 제출, 퀴즈 로드 실패
     - `textbook-reader.js`: 오디오 없음, 오디오 로드 실패
     - `quiz.js`: 퀴즈 없음, 답변 미입력
     - `daily-challenge.js`: 이미 완료, 로드 실패, 종료 확인, 정답 미입력, 완료
     - `trainer.js`: 숫자 오류, 정답 미입력
     - `pomodoro.js`: 집중 종료, 휴식 종료
     - `exam-simulator.js`: 로드 실패, 데이터 불완전, 세션 복원 실패, 시간 만료, 복습 실패
     - `backup.js`: 백업 완료, 복원 성공/실패

3. **A4: `prefers-reduced-motion`** (`css/base.css`)
   - `@media (prefers-reduced-motion: reduce)` 전역 규칙 추가
   - 모든 애니메이션/전환 0.01ms로 축소, `scroll-behavior: auto`

### 검증

- Git commit `4747442` (A1+B1+A4), `33537e6` (SW bump)
- CACHE_VERSION → `v271-20260910-4747442`
- Vercel 배포 완료

---

## #53 — 학습 핵심 기능 5종 추가 (2026-09-10)

> **목표**: 교재 읽기 이어하기, 간격 반복, 검색 성능, 학습 통계, 콘텐츠 품질 감사

### 변경 내용

1. **교재 읽기 이어하기 (Reading Resume)** (`src/views/textbook-reader.js`)
   - localStorage에 과목/챕터/스크롤 위치 저장 (1초 디바운스)
   - 30일 이상 지난 위치 자동 만료
   - 과목/챕터 전환 시 즉시 저장, 앱 재시작 시 마지막 위치 복원
   - 진도 초기화 시 위치 데이터도 함께 초기화

2. **간격 반복 (Spaced Repetition — SM-2)** (`src/spaced-repetition.js` 신규)
   - SM-2 알고리즘 구현: `repetition`, `easiness`, `nextReview` 저장
   - "외움" → 1일/3일/7일/14일... 간격 확장, "헷갈림" → 1일부터 재시작
   - 대시보드에 "오늘 복습" 카드 수 표시 (`index.html`, `dashboard.js`)
   - 진도 초기화 시 SM-2 데이터도 초기화

3. **교재 검색 성능 개선 (역색인)** (`src/views/textbook-search.js`)
   - inverted index 구축: 공백 기준 토큰화 + 2-gram 보조 인덱스
   - 검색 시 역색인에서 후보 섹션 교집합 계산 → 선형 검색 대비 성능 개선
   - 자동 캐싱으로 반복 검색 더 빠름

4. **학습 통계/분석 강화** (`src/views/dashboard.js`, `css/dashboard.css`, `index.html`)
   - 과목별 정답률 히트맵: 색상 코딩 (80%+ 초록, 60-79% 주황, 40-59% 빨강, <40% 진빨강, 미응시 회색)
   - 약점 과목 자동 추천: 정답률 최저 과목 + 헷갈린 카드最多 과목
   - 추천 카드에 "풀기"/"학습" 버튼으로 바로 이동

5. **콘텐츠 품질 점검 도구** (`tools/audit_card_quality.js` 신규)
   - 카드 품질 자동 감사: 짧은 설명, 중복, 의미 없음, 긴/짧은 term, 빈 definition, 저품질
   - 참조자료 링크 유효성 감사 (파일 존재 여부)
   - `npm run audit:cards` 스크립트 추가 (`package.json`)

### 검증

- Git commit `d7040bc` (5종 기능), `7464306` (SW bump)
- CACHE_VERSION → `v272-20260910-d7040bc`
- Vercel 배포 완료: https://personalized-skincare-study.vercel.app

---

## #54 — 사용자 매뉴얼 현재 UI/UX에 맞게 전면 갱신 (2026-09-10)

> **목표**: 사용자 매뉴얼을 현재 구현 상태와 정확히 일치하도록 전면 재작성

### 변경 내용

1. **`docs/user/user_manual.md` 전면 갱신** (42050 bytes, 433 lines)
   - **대시보드**: 오늘 복습 카드 수, 과목별 정답률 히트맵, 약점 과목 자동 추천, 인터랙티브 툴팁, 진도 초기화 연동 추가
   - **플래시카드**: SM-2 간격 반복 학습, 난이도 필터(easy/medium/hard), 키보드 지원(Enter/Space) 추가
   - **교재 리더**:
     - 이야기형 모드(storyMode) 토글 추가
     - TOC/브레드크럼/스크롤 스파이 추가
     - 교재 읽기 이어하기(30일 보관) 추가
     - 이전/다음 단원 이동 버튼 추가
     - 용어집 "원래 위치로 돌아가기" 플로팅 버튼 추가
     - 참조자료 사이드바/인라인 프리뷰 툴팁/PDF 저장 추가
     - 역색인 교재 검색 추가
   - **학습 보조 도구**: 4종 → 2종(기출 필터, 숫자 암기표)으로 정정 (절차 플로우/행정처분 비교표 삭제 반영)
   - **개념 맵 섹션 삭제** (Mermaid 다이어그램으로 대체됨)
   - **오디오**: Media Session API 연동(잠금화면 미디어 컨트롤) 추가
   - **접근성/알림**: focus-visible, 커스텀 토스트/컨펌, reduced-motion, ARIA 통합
   - **모바일**: 전역 테이블 가로 스크롤, SW 자동 업데이트 3단계 토스트 추가
   - **신규 섹션**: 가로/세로 보기 전환(17절), localStorage 용량 초과 안내(18절) 추가
   - **Workflow 다이어그램**: 개념맵 → 간격 반복 복습으로 교체

2. **SW 캐시 bump** (`sw.js`)
   - CACHE_VERSION → `v273-20260910-91649ef`

### 검증

- Git commit `91649ef` (매뉴얼 갱신), `080e42b` (SW bump)
- CACHE_VERSION → `v273-20260910-91649ef`
- Vercel 배포 완료: https://personalized-skincare-study.vercel.app

---

## #55 — UI/UX 정적 리뷰 기반 1~4차 순차 개선 (2026-09-10)

> **목표**: 정적 코드 기반 UI/UX 리뷰에서 식별된 4개 개선항목을 순차 적용하여 렌더링 일관성, 접근성, 반응형 동작, 시각적 위계 정합

### 1차: 미디어 쿼리 통합 + !important 제거 + 인라인 스타일/헤딩 위계 정리

- **미디어 쿼리 통합** (`css/reader.css`, `css/trainer.css`, `css/exam.css`, `css/base.css`)
  - 브레이크포인트 992/1024/1100px → 900px 통일 (3단계: 768/900/1200)
  - reader.css 480px 중첩 @media 해결 → 외부 480px 블록으로 병합
  - base.css 브레이크포인트 토큰 주석 추가
- **!important 제거** (`css/reader.css`)
  - `.reader-light-theme` 블록 !important 38건 제거 (변수화된 색상, 명시도로 덮어쓰기 가능)
  - Mermaid 다이어그램 !important는 기본 규칙도 !important 사용하므로 유지
- **인라인 스타일 제거** (`css/base.css`, `index.html`)
  - `.is-hidden` 유틸리티 클래스 추가
  - `style="display: none;"` 26건 → `class="is-hidden"` 교체
- **h1~h6 위계 정리** (`index.html`)
  - 인쇄용 `h1` → `h2` + `aria-hidden="true"` (페이지당 단일 h1 유지)
  - `h5` 6건 → `h3`/`h4` 강등 (위계 역행 해결)
  - 결과: h1 1개, h5 0개

### 2차: 접근성 + 햅틱 + 키보드 단축키 + 오프라인 폴백 등 13항목

1. **trainer.css 인쇄 스타일 분리** (`css/print.css` 신규, `css/trainer.css`, `style.css`)
   - `@media print` 블록 145줄을 `css/print.css`로 분리
   - `style.css`에 `print.css` import 추가
   - 인쇄용 `h1` → `h2` (위계 정리 연장)
2. **reader.css Mermaid !important** — 유지 (Mermaid 라이브러리 인라인 스타일 덮어쓰기용)
3. **JS element.style.display 조작 리팩토링** (13개 JS 파일)
   - `style.display = 'none'` → `classList.add('is-hidden')` (80건)
   - `style.display = 'block'/'flex'/'inline-flex'` → `classList.remove('is-hidden')` (68건)
   - 비교문/grid 패턴 보존, 총 148건 교체
4. **동적 피드백 영역 aria-live 확대** (`index.html`)
   - `offline-banner`: `role="status" aria-live="polite"`
   - `limits/calc/ing feedback panel`: `role="status" aria-live="polite"`
5. **터치 타깃 44px 보강** (`css/dashboard.css`, `index.html`, `css/reader.css`)
   - `.rec-item .btn-sm` min-height 32px → 44px
   - scratchpad 버튼 padding 2px 8px → 0.5rem 0.75rem + min-height 44px
   - `.pwa-modal-close` 36×36px → 44×44px
6. **글로벌 table 가로 스크롤 방어** (`css/base.css`)
   - `.view-section > table`, `.view-section > div > table`에 `display: block; overflow-x: auto; -webkit-overflow-scrolling: touch`
7. **오프라인 non-navigate fallback** (`sw.js`)
   - 이미지 요청 시 1×1 투명 PNG 반환 (UI 깨짐 방지)
   - 기존 캐시에서 유사 요청 폴백 추가
8. **로딩 스켈레톤 UI** — 스킵 (현재 스피너로 충분, 범용 스켈레톤은 데이터 구조 의존성 높음)
9. **햅틱 피드백** (`src/ui-utils.js`, `src/views/trainer.js`, `src/views/quiz.js`, `src/views/exam-simulator.js`)
   - `vibrate(pattern)` / `HAPTIC` 상수 추가 (correct: 30ms, wrong: [40,30,40], tap: 10ms)
   - trainer.js 4개, quiz.js 2개, exam-simulator.js 1개 정답/오답 처리에 vibrate 적용
10. **키보드 단축키 확대** (`src/app.js`)
    - 퀴즈/훈련소 객관식 숫자키 1-5 단축키
    - OX 진위형 o/p 단축키
11. **PWA orientation 검토** — 유지 (`any`가 학습앱에 적절)
12. **미사용 CSS 제거** — 스킵 (런타임 Chrome DevTools Coverage 필요)
13. **런타임 접근성 검증** — 스킵 (Lighthouse/axe-core + 실기기 테스트 필요, 추후 권장)

### 3차: TOC 사이드바 안보임 버그 긴급 수정

- **원인**: 2차 리팩토링에서 JS의 `style.display = 'block'/'none'`을 `classList.add/remove('is-hidden')`로 교체했으나, `index.html`의 인라인 `style="display:none;"` (공백 없는 패턴) 17건이 누락됨. JS에서 `classList.remove('is-hidden')`를 호출해도 인라인 `style="display:none;"`가 남아 요소가 숨겨진 상태로 유지됨.
- **수정**: `index.html`의 모든 `style="display:none;"` / `style="display: none;"` 인라인 스타일을 `class="is-hidden"`으로 변환 (17건)
  - `#reader-toc` (TOC 사이드바 — 핵심 버그), `#reader-toc-backdrop`, `#reader-toolbar`, `#reader-progress-bar`, `#reader-back-to-top`, `#reader-table-modal`
  - `#quiz-options-container`, `#quiz-ox-container`, `#fc-memorized-badge`, `#fc-weak-badge`
  - `#draft-resume-banner`, `#sim-result-panel`, `#sim-result-breakdown`
  - `#calc-scratchpad-container`, `#calc-solution-panel`, `#calc-solution-body`
  - `#ing-input-container`, `#pwa-diagnostics`
- **추가 수정**: `textbook-reader.js`의 `reader-back-to-top` 토글을 `classList.toggle('is-hidden')`로 변경

### 4차: 잔여 style.display 3건 classList 변환

- **`css/base.css`**: `.is-flex`, `.is-grid` 유틸리티 클래스 추가
- **`src/views/trainer.js`**: `optionsContainer.style.display = 'grid'` → `classList.remove('is-hidden')` (인라인 `display:grid`가 이미 있어 복원됨)
- **`src/html-viewer.js`**: `loading.style.display = 'flex'` 2건 → `classList.remove('is-hidden')` (`.hr-loading` CSS가 `display:flex` 제공)
- **결과**: `src/` 폴더 내 `style.display = '...'` 패턴 0건 달성

### 검증

- `node --check` 14개 JS 파일 문법 검증 통과
- `npm test` 248개 유닛 테스트 전체 통과
- Git commits: `1ec317e` (1차), `cf709e0` (2차), `5e454fe` (3차 TOC 버그 수정), `ffe45f3` (4차 잔여 변환)
- CACHE_VERSION: v279 → v280 → v281 → v282 → v283
- Vercel 배포 완료: https://personalized-skincare-study.vercel.app

---

## #56 — 핵심 용어 정리 시험집중형 재작성 + 영어 약어 full name 병기 (2026-09-10)

> **목표**: 4과목 표준형·이야기형 교재의 `## 📖 핵심 용어 정리` 섹션을 시험 출제 빈도·함정·숫자 중심의 실전 요약표로 재작성하고, 영어 약어에 영문 full name 병기

### 변경 내용

1. **핵심 용어 정리 표 재작성** (8개 교재 파일, 20개 섹션)
   - **표준형**: 1과목(2섹션), 2과목(6섹션), 3과목(5섹션), 4과목(7섹션)
   - **이야기형**: 1과목(2섹션), 2과목(6섹션), 3과목(5섹션), 4과목(7섹션)
   - 기존 단순 용어-설명 2열 표 → 주제별 분류 + 핵심 포인트 + 빈출 표시 + 숫자 강조 구조로 재구성
   - 정의, 시험 구분, 임계값, 법적 예외, 공식, 절차, 고빈도 암기 포인트 포함

2. **영어 약어 full name 병기**
   - `TEWL` → `TEWL (Trans-Epidermal Water Loss)`
   - `HLB` → `HLB (Hydrophilic-Lipophilic Balance)`
   - `CMC` → 제형: `Critical Micelle Concentration` / 모발: `Cell Membrane Complex` (문맥별 구분)
   - `CGMP` → `Cosmetic Good Manufacturing Practice`
   - `HEPA`, `HPLC (High Performance Liquid Chromatography)`, `TLC (Thin Layer Chromatography)`, `TOC (Total Organic Carbon)`, `CFU (Colony-Forming Unit)`, `SOP (Standard Operating Procedure)`, `NMF (Natural Moisturizing Factor)`, `DHT (Dihydrotestosterone)`, `PCA (Pyrrolidone Carboxylic Acid)`
   - `UVA/UVB/UVC` 파장 영역 표기
   - 포장재: `LDPE (Low Density Polyethylene)`, `HDPE (High Density Polyethylene)`, `PP (Polypropylene)`, `PS (Polystyrene)`, `AS (Acrylonitrile Styrene)`, `ABS (Acrylonitrile Butadiene Styrene)`, `PET (Polyethylene Terephthalate)`
   - 프탈레이트: `DBP (Dibutyl Phthalate)`, `BBP (Butyl Benzyl Phthalate)`, `DEHP (Di(2-ethylhexyl) Phthalate)`

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- Git commit `35c6d9f`
- Vercel 배포 완료

---

## #57 — 문제은행 인용 링크 라인 번호 동기화 (2026-09-10)

> **목표**: 핵심 용어 정리 재작성으로 인해 교재 라인 번호가 변경되어, 문제은행 999개 인용 링크 중 153개가 잘못된 위치를 가리키던 문제 수정

### 변경 내용

1. **자동 동기화** (`tools/fix_citation_lines.js` 신규)
   - 기존 fingerprint 매칭으로 846개는 자동 해결
   - 나머지는 git history(`git show HEAD~1:<교재파일>`)에서 이전 교재 내용을 가져와 구문 검색으로 138개 자동 매핑
   - main 링크와 evidence(근거) 링크를 모두 갱신 (중복 제거 없이 동일 라인 번호 공유)

2. **수동 매핑** (`tools/fix_manual_citations.js` 신규)
   - 재작성된 섹션에서 내용이 완전히 바뀌어 자동 검색이 불가능한 15개 항목
   - 각 항목의 이전 내용을 확인하고 현재 교재에서 해당 개념의 새 위치를 수동 지정
   - 예: 소르빅애씨드 L2415→L2475, 히알루론산 L3672→L3785, 탱크 L1791→L1837, 섬유아세포 L1208→L1237 등

3. **보조 도구 신규 추가**
   - `tools/extract_notfound.js`: 미발견 인용 링크 상세 추출 (evidenceText 포함)
   - `tools/fix_citation_lines.js`: fingerprint + git history 기반 자동 동기화
   - `tools/fix_manual_citations.js`: 수동 매핑 적용
   - `tools/notfound_citations.json`, `tools/still_notfound.json`: 중간 산출물

### 검증

- `node tools/sync_citation_lines.js`: **999개 링크 모두 동일 (미발견 0)**
- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- Git commit `bb2c657` (링크 동기화), `b512f24` (SW bump)
- CACHE_VERSION → `v286-20260910-bb2c657`
- Vercel 배포 완료: https://personalized-skincare-study.vercel.app

---

## #58 — 중요 용어 해설 품질 개선 (2026-09-10)

> **목표**: 교재 리더의 "📖 중요 용어 해설" 섹션이 glossary JSON의 양질 정의 156개를 모두 표시하도록 개선

### 배경

- "중요 용어 해설"은 `glossary-renderer.js`가 런타임에 동적 렌더링하는 섹션 (교재 MD에 직접 작성되지 않음)
- 기존: 교재 본문의 `(LNN|file.pdf)` 링크 기반으로만 GLOSSARY_INDEX에 등록 → 69개 항목
- 핵심 용어 정리 재작성으로 `(LNN|file.pdf)` 패턴이 제거되면서 자동 추출 0건으로 감소
- glossary JSON에 156개 양질 정의가 있었으나, 본문 링크가 없어 GLOSSARY_INDEX에 등록되지 못함
- 과목4는 큐레이션 정의가 1건도 반영되지 않았던 상태

### 변경 내용

1. **`tools/build/build_keyword_index.js` 개선**
   - glossary JSON의 모든 정의를 GLOSSARY_INDEX에 추가 등록하는 로직 신설
   - 교재 본문 링크 기반 자동 추출 + glossary JSON 기반 큐레이션 등록을 이원화
   - 미등록 큐레이션 항목은 과목별 대표 참조문서를 refDoc으로 하여 `glossary:과목N:키워드` 형식의 idxKey로 추가
   - 과목별 대표 참조문서 매핑:
     - 과목1: 화장품법(법률)(제20901호)(20260402)
     - 과목2: 우수화장품 제조 및 품질관리기준
     - 과목3: 우수화장품 제조 및 품질관리기준 (CGMP)
     - 과목4: 화장품법 시행규칙

2. **`src/glossary-query.js`**: `getGlossaryBySubject(subjectId)` 함수 추가
   - 과목 ID 기준으로 GLOSSARY_INDEX의 모든 항목을 반환 (glossary: 접두사 항목 포함)

3. **`src/views/glossary-renderer.js`**: `collectGlossaryItems()` 시그니처 확장
   - `subjectId` 파라미터 추가 (선택적)
   - 기존 출처(refFileName) 기반 수집 + 과목 ID 기반 수집을 병합
   - 중복 제거 (seenKeys Set 유지)

4. **`src/views/textbook-reader.js`**: `collectGlossaryItems()` 호출 시 `subjId` 전달

5. **`tests/unit/glossary-query.test.js`**: idxKey 형식 검증 테스트 업데이트
   - `|` 구분자 또는 `glossary:` 접두사 둘 다 허용

### 결과

| 과목 | 기존 항목 수 | 개선 후 항목 수 |
|------|------------|----------------|
| 과목1 | 12 (큐레이션 11) | 23 (전체 큐레이션) |
| 과목2 | 26 (큐레이션 18) | 52 (전체 큐레이션) |
| 과목3 | 16 (큐레이션 1) | 45 (전체 큐레이션) |
| 과목4 | 15 (큐레이션 0) | 36 (전체 큐레이션) |
| **총계** | **69** | **156** |

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- CACHE_VERSION → `v287-20260910-glossary`

---

## #59 — 핵심 용어 정리 영어 약어 full name 병기 (2026-09-10)

> **목표**: 8개 교재 파일의 "📖 핵심 용어 정리" 섹션에서 영어 약어에 full name 병기

### 배경

- 핵심 용어 정리 재작성(#56)에서 대부분의 약어에 full name이 병기되었으나 일부 누락 항목 존재
- 교재 본문에서만 사용되고 full name이 없는 약어: KFCC, CCTV, TEWL, NMF, UVB, UVA, GTIN, GS1, PEG, GMO, PVC, PSF, IPBC, HEPA, HPLC, TLC, TOC, CFU, HLB, SCI 등

### 변경 내용

**표준형 4개 파일**:
- 1과목: KFCC(Korean Functional Cosmetics Codex), CCTV(Closed-Circuit Television)
- 2과목: TEWL(Trans-Epidermal Water Loss), NMF(Natural Moisturizing Factor), UVB(Ultraviolet B), UVA(Ultraviolet A), GTIN(Global Trade Item Number), GS1(Global Standards 1), PEG(Polyethylene Glycol), GMO(Genetically Modified Organism), IPBC(Iodo-Propynyl Butyl Carbamate)
- 3과목: HEPA(High Efficiency Particulate Air), HPLC(High Performance Liquid Chromatography), TLC(Thin Layer Chromatography), TOC(Total Organic Carbon)
- 4과목: NMF(Natural Moisturizing Factor), HLB(Hydrophilic-Lipophilic Balance), SCI(Science Citation Index)

**이야기형 4개 파일**: 동일 약어에 동일 full name 병기

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- CACHE_VERSION → `v288-20260910-glossary-fullname`

---

## #60 — 핵심 용어 정리 → 📌 용어 정리 개명 + 3과목 중복 용어 정의 삭제 (2026-09-10)

> **목표**: 각 챕터별로 하나의 `📌 용어 정리` 섹션이 있도록 통일

### 변경 내용

1. **8개 교재 파일**: `## 📖 핵심 용어 정리` → `## 📌 용어 정리` 개명 (총 40개 섹션)
   - 표준형 4개: 1과목(2), 2과목(6), 3과목(5), 4과목(7) = 20개
   - 이야기형 4개: 1과목(2), 2과목(6), 3과목(5), 4과목(7) = 20개

2. **3과목 표준형/이야기형**: 본문 중간의 `#### 📌 용어 정리` 4개 삭제 (챕터 말미의 `## 📌 용어 정리`와 중복)
   - 표준형: L576, L724 (2개)
   - 이야기형: L658, L812 (2개)
   - 삭제된 용어: 구획, 구분, 분리, 소모품, 청소, 유지관리, 건물, 제조, 오염, 검교정 (이미 챕터 말미 `## 📌 용어 정리`에 포함)

### 결과

- 각 챕터마다 정확히 1개의 `## 📌 용어 정리` 섹션 보유
- 3과목 Ch01의 중복 용어 정의 제거로 본문 흐름 개선

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- CACHE_VERSION → `v289-20260910-glossary-rename`

---

## #61 — 📌 용어 정리 표준/이야기 동기화 (2026-09-10)

> **목표**: 40개 📌 용어 정리 섹션의 용어 세트를 표준형/이야기형 간 동기화

### 배경

- #60에서 각 챕터마다 1개의 `## 📌 용어 정리` 섹션 구조는 완성
- 그러나 표준형과 이야기형 간 용어 누락 및 용어명 불일치 존재

### 변경 내용

**누락 용어 추가**:
- 1과목 이야기형 Ch1: CGMP 누락 → 추가
- 4과목 이야기형 Ch3: 로션/에센스 평가, 메이크업 베이스/파운데이션 누락 → 추가
- 4과목 이야기형 Ch4: 따끔, 자통, 작열감, 불검출 균 누락 → 추가
- 4과목 표준형 Ch4: 비소·안티몬 누락 → 추가

**용어명 통일**:
- 4과목 Ch1: 안전성시험 9종 → 안전성시험 (이야기형)
- 4과목 Ch5: 장점/단점 → 맞춤형화장품 장점/맞춤형화장품 단점 (이야기형)
- 4과목 Ch7: 피스톤 방식/파우치 방식 → 피스톤 방식 충진기/파우치 방식 충진기 (이야기형)
- 4과목 Ch4: 영유아·눈화장/기타 화장품 → 영유아·눈/기타 (이야기형)

### 결과

- 40개 📌 용어 정리 섹션의 표준/이야기 용어 세트 100% 일치
- 과목 1~3: 이미 완벽 동기화 (1개 누락만 수정)
- 과목 4: 7개 챕터 모두 동기화 완료

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- CACHE_VERSION → `v290-20260910-glossary-sync`

---

## #62 — 📌 용어 정리 관련 문서 갱신 (2026-09-10)

> **목표**: #60/#61의 용어 정리 재구성을 관련 문서에 반영

### 변경 내용

1. **`docs/dev/TEXTBOOK_AUTHORING_GUIDE.md`**:
   - `## 📖 핵심 용어 정리` → `## 📌 용어 정리` 3곳 반영 (아스키아트 다이어그램, 헤더 표, 템플릿)
   - 카드 추출 제외 목록: `📖` (통합 정리)와 `📌` (용어 정리) 분리
   - 2-D 섹션에 `📌 용어 정리 섹션 규칙` 블록 추가 (챕터당 1개, 표준/이야기 동일 용어 세트, 영어 약어 full name 병기)
   - 체크리스트 3개 항목 추가 (챕터당 1개 섹션, 표준/이야기 용어 세트 일치, 영어 약어 full name)

2. **`AGENTS.md`**:
   - `4과목 19단원 MD 파일` → `4과목 20챕터 MD 파일 (표준형 20 + 이야기형 20)`

3. **`docs/user/user_manual.md`**:
   - `전 교재 19단원` → `전 교재 4과목 20챕터(표준형 20 + 이야기형 20)`
   - `핵심 용어 정리표` → `📌 용어 정리` 표

4. **`docs/dev/SPEC.md`**:
   - CE-05: `단원별 핵심 용어 정리표 (단원 말미)` → `챕터별 📌 용어 정리 표 (챕터 말미)`

---

## #63 — 1과목 표준형 Ch01 목차 부제 제거 (2026-09-10)

> **목표**: 표준형 목차 챕터 제목 형식 통일

### 배경

- 표준형 4과목 20챕터 중 1과목 Ch01만 유일하게 콘텐츠 요약 부제(`— 법령 체계, 정의, 영업, 품질, 행정처분`) 보유
- 다른 모든 표준형 챕터는 부제 없음, 이야기형만 서사 부제 보유
- 표준형끼리 형식 불일치

### 변경 내용

1. **`content/교재/law/1과목_화장품법의이해_표준형.md`**:
   - L93: `- **Chapter 01.** 화장품법의 이해 — 법령 체계, 정의, 영업, 품질, 행정처분`
   - → `- **Chapter 01.** 화장품법의 이해`

### 결과

- 표준형 20챕터 모두 부제 없는 통일된 형식
- 이야기형 20챕터만 서사 부제 보유 (설계 의도대로)

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v292-20260910-toc-unify`

---

## #64 — 교재 표시형식 전체 리뷰 및 통일 (2026-09-10)

> **목표**: 8개 교재 파일 표시형식 전체 리뷰 후 불일치 수정

### 변경 내용

1. **이야기형 챕터 헤더 📖→📚 통일** (4개 이야기형 파일, 20개 챕터):
   - `## 📖 Chapter NN.` → `## 📚 Chapter NN.` (표준형과 동일)

2. **출처 표시 형식 통일** (6개 파일, 9곳):
   - 백틱 `` `../참조자료/...` `` → 마크다운 링크 `[파일명](../참조자료/...)`

3. **2과목 이야기형 참조 자료 중복 해결**:
   - L4088 `## 📚 참조 자료 (원료 DB · 법령 원문)` → `## 📚 학습 보조 자료 (원료 DB)` (백 매터와 중복 해소)

4. **1과목 이야기형 통합 정리 섹션**:
   - `## 화장품법 통합 정리` → `## 📖 화장품법 통합 정리` (이모지 추가)

5. **1과목 이야기형 별표 인덱스명 통일**:
   - `### 📋 별표·서식 인덱스` → `### 📋 별표·별지 서식 종합 인덱스` (표준형과 일치)

6. **TEXTBOOK_AUTHORING_GUIDE.md 갱신**:
   - 챕터 헤더: 표준형/이야기형 공통 `📚` 사용 문서화 (서사 부제는 이야기형만)
   - 챕터 내 섹션 순서: 📊→✅→📌 (실제 교재에 맞게 수정)
   - 이야기형 `## 📚 Chapter NN.` 헤더 사용 문서화 (기존 "미사용" 설명 수정)
   - 체크리스트: 이야기형 챕터 헤더 "있는가?"로 수정

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v293-20260910-format-review`

---

## #65 — 마인드맵 없는 챕터 보완 (2026-09-10)

> **목표**: 마인드맵이 없는 4개 챕터에 마인드맵 추가 (표준형/이야기형 각각)

### 배경

- 교재 표시형식 전체 리뷰(#64)에서 마인드맵이 없는 챕터 4개 발견
- 2과목 Ch02(화장품 제조관리), Ch04(화장품 사용제한 원료), Ch05(화장품 관리)
- 4과목 Ch05(제품 안내)

### 변경 내용

1. **2과목 Ch02 화장품 제조관리**: 제조 3대 기술(유화·가용화·분산), 제조 공정, 품질 관리 마인드맵 추가
2. **2과목 Ch04 화장품 사용제한 원료**: 원료 관리 체계, 보존제, 자외선 차단, 알레르기, 천연·유기농 마인드맵 추가
3. **2과목 Ch05 화장품 관리**: 보관·유통, 사용 방법, 주의사항, 제품 단계 마인드맵 추가
4. **4과목 Ch05 제품 안내**: 표시사항, 가격표시제, 표시·광고, 영유아·어린이, 맞춤형 특징 마인드맵 추가

### 결과

- 40개 챕터 모두 1개 이상의 마인드맵 보유
- 표준형/이야기형 동일한 마인드맵 구조

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v294-20260910-mindmap-add`

## #66 — 챕터 첫 마인드맵을 전체 개요로 교체 (2026-09-10)

> **목표**: 챕터 다음에 바로 오는 첫 번째 마인드맵이 챕터 전체 주요 내용을 한눈에 보여주는 개요 마인드맵이 되도록 교체

### 배경

- #65 작업 후, 챕터 첫 마인드맵이 챕터 전체가 아닌 일부 주제만 다루는 경우가 7개 챕터에서 발견됨
- 챕터 개요 마인드맵은 학습자가 챕터 진입 시 전체 구조를 파악하는 역할이므로 전체 주요 내용을 포괄해야 함

### 변경 내용

1. **1과목 Ch01 화장품법의 이해**: 법령체계만 → 법령체계·화장품정의·영업3종·영업관리·행정처분·품질관리 전체 개요로 교체
2. **2과목 Ch01 화장품 원료의 종류와 특성**: 원료 분류만 → 원료분류·주요원료특성·기능성원료·비교표 전체 개요로 교체
3. **2과목 Ch03 화장품의 기능과 품질**: 6종 효과만 → 기능·품질·시험검사·CGMP 4대 기준서·비교표 전체 개요로 교체
4. **2과목 Ch06 위해사례 판단 및 보고**: 위해사례 판단만 → 위해사례이해·보고의무·비교표 전체 개요로 교체
5. **3과목 Ch01 작업장 위생관리**: CGMP 3대 요소만 → 위생기준·위생유지관리·소독및중화·비교표 전체 개요로 교체
6. **3과목 Ch04 내용물 및 원료관리**: 미생물 한도만 → 원료관리·폐기및품질관리·비교표 전체 개요로 교체
7. **4과목 Ch07 충진 및 포장**: 충진기 종류만 → 충진방법·포장방법·비교표 전체 개요로 교체

### 결과

- 7개 챕터 × 표준형/이야기형 = 14개 파일 교체
- 모든 챕터의 첫 마인드맵이 챕터 전체 주요 내용을 포괄하는 개요 마인드맵으로 통일

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v295-20260910-ch-overview`

## #67 — 마인드맵 내 깨진 참조 링크 잔해 제거 (2026-09-10)

> **목표**: 마인드맵 노드 안에 잘못 들어간 깨진 참조 링크 잔해 제거

### 배경

- #66 작업 중 마인드맵 감사에서 `(L?\` + PDF 파일명 형태의 깨진 텍스트 발견
- 3과목 표준형/이야기형 파일의 마인드맵 노드 안에 6개의 깨진 참조 링크 잔해가 있었음
- 원인: 마인드맵 작성 시 참조 자료 링크(예: `[L123](안전기준_별표2_사용제한원료.pdf)`)가 잘못 들어간 것

### 변경 내용

1. **3과목 표준형**: 3개 제거
   - Ch01 마인드맵: 칼슘카보네이트·클레이 뒤 `(L?\ 색소종류및기준_전체.pdf)` 제거
   - Ch01 마인드맵: 과산화수소·포르말린 뒤 `(L?\ 안전기준_별표2_사용제한원료.pdf)` 제거
   - Ch02 마인드맵: 아이오도퍼 뒤 `(L?\ 안전기준_별표2_사용제한원료.pdf)` 제거
2. **3과목 이야기형**: 3개 제거 (표준형과 동일)

### 결과

- 마인드맵 노드에서 깨진 참조 링크 잔해 6개 제거
- 마인드맵 노드 텍스트가 깔끔하게 정리됨

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v296-20260910-fix-mindmap-refs`

## #68 — 마인드맵을 챕터 헤더 바로 다음으로 이동 (2026-09-10)

> **목표**: 마인드맵이 챕터 헤더에서 멀리 떨어진 챕터들의 마인드맵을 챕터 헤더 바로 다음으로 이동

### 배경

- #67 작업 후 마인드맵 위치 감사에서 4개 챕터의 마인드맵이 챕터 헤더에서 멀리 떨어져 있는 것을 발견
- 3과목 Ch04: 헤더에서 +512/+523줄 (비교표 섹션 안에 마인드맵이 있었음)
- 4과목 Ch07: 헤더에서 +61/+71줄
- 사용자가 "3과목 챕터4에 마인드맵 안보임"이라고 보고

### 변경 내용

1. **3과목 Ch04 내용물 및 원료관리** (표준형/이야기형): 마인드맵을 비교표 섹션에서 챕터 헤더 바로 다음으로 이동
2. **4과목 Ch07 충진 및 포장** (표준형/이야기형): 마인드맵을 챕터 헤더 바로 다음으로 이동

### 결과

- 3과목 Ch04: +512줄 → +21줄 (표준형), +523줄 → +26줄 (이야기형)
- 4과목 Ch07: +61줄 → +39줄 (표준형), +71줄 → +44줄 (이야기형)
- 모든 챕터의 마인드맵이 챕터 헤더 바로 다음에 위치

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v297-20260910-move-mindmaps`

## #69 — 마인드맵/표 "별표 2 보존제·자외선차단·염모제" 표기 정정 (2026-09-10)

> **목표**: 마인드맵 노드와 표에서 "별표 2 보존제·자외선차단·염모제" 표기를 정정

### 배경

- 4과목 Ch03 마인드맵 노드와 상세 매핑 표에서 "별표 2 보존제·자외선차단·염모제"로 표기
- "별표 2"는 별표 번호이고 "보존제·자외선차단제·염모제"는 별표 2에 포함된 항목
- "별표 2"를 항목명 앞에 붙이는 표기는 중복/불필요

### 변경 내용

1. **4과목 표준형**: 마인드맵 노드 1곳, 표 1곳 수정
   - `별표 2 보존제·자외선차단·염모제` → `보존제·자외선차단제·염모제`
2. **4과목 이야기형**: 마인드맵 노드 1곳, 표 1곳 수정 (표준형과 동일)

### 결과

- 마인드맵 노드와 표에서 "별표 2" 중복 표기 제거
- 항목명만 깔끔하게 표시

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v298-20260910-fix-restricted-label`

## #70 — 2과목 Ch04 마인드맵 "별표 1/2" 노드 제거 (2026-09-10)

> **목표**: 2과목 Ch04 마인드맵에서 "별표 1", "별표 2" 노드 제거, 키워드 직접 표시

### 배경

- 2과목 Ch04 마인드맵에서 "별표 1", "별표 2" 노드가 번호만 표시되어 있고, 키워드가 별도 하위 노드로 분리되어 있었음
- 사용자 요청: "별표 1, 별표 2 --> 별표에 해당되는 키워드가 표시되야함"
- "별표 1", "별표 2" 노드를 제거하고, 상위 노드(사용금지 원료/사용제한 원료) 아래에 바로 키워드 표시

### 변경 내용

1. **2과목 표준형 Ch04 마인드맵**: "별표 1", "별표 2" 노드 제거
   - `사용금지 원료 → 별표 1 → 히드로퀴논·수은·비소` → `사용금지 원료 → 히드로퀴논·수은·비소`
   - `사용제한 원료 → 별표 2 → 보존제·자외선차단제·염모제` → `사용제한 원료 → 보존제·자외선차단제·염모제`
2. **2과목 이야기형 Ch04 마인드맵**: 동일하게 수정

### 결과

- 마인드맵에서 "별표 1", "별표 2" 번호만 표시된 노드 제거
- 상위 노드 아래에 바로 핵심 키워드 표시

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v299-20260910-remove-annex-nodes`

## #71 — 3과목 Ch03 마인드맵 "위생 기준 9가지" 노드 9개 항목으로 확장 (2026-09-10)

> **목표**: 3과목 Ch03 마인드맵 "위생 기준 9가지" 노드를 실제 9개 항목으로 확장

### 배경

- 3과목 Ch03 (설비·기구 위생관리) 마인드맵에서 "위생 기준 9가지" 노드 아래에 3개 항목만 표시되어 있었음
- 실제 교재 본문에는 9개 항목이 있음
- 사용자 보고: "위생 기준 9가지 표시가 이상함"

### 변경 내용

1. **3과목 표준형**: 마인드맵 노드 3개 → 9개 확장, 상세 매핑 표 3행 → 9행 확장
2. **3과목 이야기형**: 동일하게 수정

#### 마인드맵 노드 (9개 항목)
- 목적 적합·청소 가능
- 미사용 호스 위생관리
- 배수 용이·화학반응 없음
- 위치·오염 방지
- 벌크 용기 먼지·수분 보호
- 배관·배수관 역류 방지
- 대들보·파이프 노출 방지
- 소모품 품질 영향 없음
- 저울 영점·정기 점검

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v300-20260910-expand-hygiene-nodes`

## #72 — 모든 챕터 마인드맵 중앙 노드 Ch번호 통일 (2026-09-10)

> **목표**: 모든 챕터 마인드맵 중앙 노드에 Ch{번호}<br/> 형식 통일

### 배경

- 일부 챕터 마인드맵 중앙 노드에만 Ch번호가 있고, 다른 챕터는 Ch번호 없이 제목만 표시
- 사용자 요청: "모든 중앙노드에 원래대로 Ch05<br/>제품 안내 형식으로 통일"
- 18개 챕터 마인드맵 중앙 노드에 Ch번호 누락

### 변경 내용

18개 챕터 마인드맵 중앙 노드에 Ch번호 추가:
- 1과목: Ch02 (개인정보 보호법) — 표준/이야기형 각 1개
- 3과목: Ch02 (작업자 위생관리), Ch03 (설비·기구 위생관리), Ch05 (포장재 관리) — 표준/이야기형 각 3개
- 4과목: Ch01~Ch04, Ch06 (맞춤형화장품 개요, 피부 생리구조, 관능평가 절차, 제품 상담, 혼합·소분 공정) — 표준/이야기형 각 5개

### 검증

- `npm run build:data` 성공 (파서 등가성 검사 통과)
- `npm test` 248 pass, 0 fail
- 인용 링크 999/999 유효, 0 unresolved
- CACHE_VERSION → `v301-20260910-unify-ch-root-nodes`
