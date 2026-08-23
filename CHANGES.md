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
3. FontAwesome SRI는 `cdnjs.com/libraries/font-awesome/6.4.0`의 "Copy SRI" 값으로 채워 넣으세요.
