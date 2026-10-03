# 🛠 적용 소프트웨어 공학 기법 카탈로그

> **문서 ID**: DOC-REF-10
> **관련 SPEC ID**: 해당 없음 (공학 기법 색인 — 개별 항목이 관련 ID를 인용)
> **목적**: 이 저장소에 실제 적용된 소프트웨어 공학 기법을 한눈에 정리 — 각 기법의 개념·구현물·검증 명령을 짝지어 기록. 표준·프레임워크 대응 평가는 [ENGINEERING_PRACTICES.md](ENGINEERING_PRACTICES.md)(DOC-REF-08) 부록 A, 게이트 실행 절차는 [VERIFY_DEPLOY_PIPELINE.md](../runbooks/VERIFY_DEPLOY_PIPELINE.md) 참조.

---

## 요약 — 기법 총람

| # | 기법 | 구현물 | 검증/실행 |
|---|------|--------|-----------|
| 1 | 단일 소스 오브 트루스 (SSOT) | content/ 원본 ↔ data/ 생성물 분리 | `check:datafresh` |
| 2 | 신선도 게이트 | 입력 해시·재생성 비교 | `check:trace`·`check:html`·`check:drillfresh`·`check:docbundles` |
| 3 | 결정성 빌드 | 개행 정규화·해시 스탬프 | `.gitattributes`·`build_trace_matrix` |
| 4 | 다층 검증 방어 | 훅 → 로컬 → CI → 배포 가드 4중 | `check:hooks`·`check:ci`·`deploy` |
| 5 | 요구사항 추적성 | SPEC ID ↔ @spec ↔ 문서 ↔ 테스트 | `build:trace`·`check:specrefs` |
| 6 | 영향도 분석 | 변경 파일 → 영향 요구사항·권장 테스트 | `tools/check/impact_tests.js` |
| 7 | 이중 구현 등가성 | 빌드 파서 ↔ 런타임 파서 대조 | `check:parser` |
| 8 | 아키텍처 피트니스 함수 | 계층 분류·경계 규칙 기계 강제 | `check:domainmap`·`check:imports`·`check:storage` |
| 9 | 도메인 격리·규약 경로 | `exams/<id>/` 배치 + 활성 시험 해석 | `check:domainmap`·E2E 격리 테스트 |
| 10 | 테스트 피라미드 | unit(node:test) → DOM(vitest) → E2E(playwright) | `test`·`test:dom`·`test:e2e` |
| 11 | **속성 기반 테스트 (PBT)** | fast-check 불변식 | `tests/unit/property-based.test.js` |
| 12 | **변이 테스트** | Stryker 명령 러너 (순수 모듈 스코프) | `npm run mutate` |
| 13 | 커버리지 기준선 | 병합 커버리지 임계값 — 악화만 차단 | `coverage_merge.js --check` |
| 14 | 골든 마스터 비교 | ref_md_v2 vs ref_md 출력 대조 | `verify:refs` |
| 15 | **성능 예산** | SHELL_ASSETS 크기 상한 | `check:perf` |
| 16 | 문서-코드 동기화 | 변경 시 문서 갱신 강제 | `check:docsync`·`check:testfirst` |
| 17 | 문서 인벤토리 정합 | 트리·경로·명령·플랜·플래그 양방향 | `check:inventory`·`check:commands`·`check:plan`·`check:featflags`·`check:ciparity` |
| 18 | **ADR (아키텍처 결정 기록)** | `docs/dev/adr/` | 문서 규약 |
| 19 | Docs-as-Code | 문서도 검증 대상 — 경로·DOC ID 게이트 | `check:docs` |
| 20 | 저장소 추상화 | `storage.js` — localStorage/Supabase 동일 API | `check:storage` |
| 21 | **오류 텔레메트리** | 런타임 오류 → client_errors 익명 insert | `src/error-telemetry.js` |
| 22 | 배포 단일 진입점 + 스탬프 | 가드→게이트→버전 스탬프→배포 | `npm run deploy` |
| 23 | 공급망 보안 | SBOM·npm audit·Dependabot·시크릿 스캔 | `sbom`·`check:secrets`·CI audit |
| 24 | CalVer 버저닝 | `v<날짜>-<커밋해시>` 스탬프 | `stamp:sw`·deploy.js |
| 25 | 점진적 품질 (래칫) | 기준선 동결 — 신규 악화만 차단 | lint `--max-warnings 0`·specrefs 기준선 |

---

## 신규 도입 6종 상세 (2026-10-04)

### 11. 속성 기반 테스트 (Property-Based Testing)

- **개념**: 예제를 나열하는 대신 "항상 성립해야 할 성질(불변식)"을 기술하고, fast-check가 입력 공간을 자동 생성·축소(shrink)해 반례를 찾는다
- **구현물**: `tests/unit/property-based.test.js` — 8개 속성
- **적용 대상**: `deriveComboAnswer`(정답 유일성·순서 불변) · `generateComboOptions`(멤버 부분집합·정답 유일·시드 결정성) · `weak-items` ID 문법(왕복·멱등) · SM-2 스케줄러(repetition 단조·easiness≥1.3·nextReview>오늘)
- **효과**: 작성자가 생각하지 못한 입력 조합을 기계가 탐색 — 첫 실행에서 상태 누수(스텁 공유)를 반례로 잡아낸 이력

### 12. 변이 테스트 (Mutation Testing)

- **개념**: 소스를 의도적으로 변이(조건 반전·연산자 교체)시킨 뒤 테스트를 실행 — 변이를 못 죽이는(survived) 테스트는 검증력이 없는 것
- **구현물**: `stryker.conf.mjs` — 명령 러너가 변이체당 `node --test`를 실행해 exit code로 생존 판정
- **스코프**: `questions.js`·`spaced-repetition.js`·`weak-items.js`·`statement-tracker.js` (순수 핵심만 — 전체 대상은 실행 시간 비대)
- **위치**: CI 게이트 아님 — `npm run mutate` 수동 스팟 체크. 리포트 `reports/mutation/`(gitignore)
- **기준선**: weak-items.js 16.8% — `STUDY_DATA` 인덱스 캐시 경로가 기존 테스트 공백으로 드러남 (백로그)

### 15. 성능 예산 (Performance Budget)

- **개념**: 자산 크기 상한을 코드에 명문화하고 초과 시 빌드를 실패시킨다 — PWA는 프리캐시 목록이 곧 첫 방문 다운로드량
- **구현물**: `tools/check/check_perf_budget.js` — sw.js `SHELL_ASSETS`를 파싱해 실제 stat 합산
- **예산** (2026-10 기준선 + 여유): 셸 총량 12.5MB · JS 4.8MB · 단일 파일 6MB · index.html 160KB
- **게이트 배선**: `check:ci` 체인 + `ci.yml` 양쪽 — `check:ciparity`가 양방향 정합을 강제

### 8·16 연계 — 도메인 경계 게이트 (check:imports 확장)

- **개념**: 아키텍처 피트니스 함수 — 계층 경계 위반을 컴파일이 아닌 린트 게이트로 차단
- **규칙**: ① platform 파일의 `src/exams/` 정적 import 금지 (`_domainImport`/템플릿만) ② `import('./exams/<id>…')` 리터럴 동적 import 금지 (`${}` 템플릿만) ③ `src/exams/<a>/`→`src/exams/<b>/` 교차 시험 참조 금지
- **효과**: 규약 경로 전환(ADR-0002)의 재하드코딩 회귀를 정적 차단

### 18. ADR (Architecture Decision Records)

- **개념**: "왜 그렇게 결정했는가"를 상황·결정·대안·결과 4단으로 번호 매긴 기록 — 코드는 what, 설계 문서는 how, ADR은 why를 보존
- **구현물**: `docs/dev/adr/` — 규약·템플릿(README) + ADR-0001~0003
- **규약**: 연번 재사용 금지, 번복은 후속 ADR로만(`superseded by`), `check:docs`가 헤더·경로 검증

### 21. 오류 텔레메트리 (Error Telemetry)

- **개념**: 배포 후 사용자 환경의 런타임 오류를 관측 — 테스트가 통과한 코드도 실기기에서 깨질 수 있는 블라인드 존 해소
- **구현물**: `src/error-telemetry.js` — `error`/`unhandledrejection` 리스너 → Supabase `client_errors` 익명 insert
- **안전장치**: Supabase 미설정 시 완전 no-op · 세션 10건 상한 · 메시지 중복 억제(오류 루프→네트워크 폭주 방지) · 개인정보 최소화(입력 데이터 미포함)
- **배선**: `initApp` 최초 단계 — 이후 초기화 실패도 수집. 스키마 `tools/supabase/schema.sql` §5 (RLS insert-only)

---

## 기존 기법 상세

### 1. 단일 소스 오브 트루스 (SSOT)

- **개념**: 모든 정보에 유일한 권위 원본을 두고, 파생물은 전부 생성물로 만든다 — 원본·사본의 양방향 편집이 만드는 불일치를 구조적으로 원천 차단
- **구현물**: `content/`(교재·문제은행·문서 원본) → `build:data`/`build_doc_bundles` → `data/` 번들 · `index.template.html`+`html/views/` 파셜 → `build:html` → `index.html` · SPEC+`@spec` 태그 → `build:trace` → `TRACE_MATRIX.md`
- **규약**: 생성물 직접 편집 금지(헤더에 생성기 명시) — 수정은 항상 원본에서, 생성물은 재생성

### 2. 신선도 게이트 (Freshness Gate)

- **개념**: "원본을 바꿨는데 생성물 재생성을 잊었다"는 침묵의 불일치를 게이트로 탐지
- **구현물·방식**:
  - `check:trace` — TRACE_MATRIX 입력 파일 해시 스탬프 비교
  - `check:html` — index.html을 파셜에서 재조립해 바이트 비교(개행 정규화)
  - `check:datafresh` — 빌드 체인 실행 후 `git diff`로 생성물 변동 감지·자동 원복
  - `check:drillfresh`·`check:docbundles` — 드릴/문서 번들 ↔ 원본 쌍 비교
- **효과**: 생성물 경로가 clean일 때만 실행되는 설계로 거짓 양성 없이 누락된 재생성을 매번 차단

### 3. 결정성 빌드 (Deterministic Build)

- **개념**: 동일 입력이면 환경 무관하게 동일 바이트 출력 — 재현 불가 빌드는 diff·캐시·검증을 전부 불가능하게 만든다
- **구현물**: `.gitattributes`의 LF 강제 + `build_trace_matrix`의 개행 정규화 해시 — Windows(autocrlf)와 Linux CI가 동일 해시를 생산
- **효과**: 해시 기반 신선도 게이트(#2)가 성립하는 전제 조건

### 4. 다층 검증 방어 (Defense in Depth)

- **개념**: 하나의 게이트가 뚫려도 다음 층이 잡도록 검증을 시점별로 중첩
- **층**: `pre-commit`(types·lint·secrets) → `pre-push`(trace·specrefs·docs·영향 테스트) → `check:ci`(18단계) → `deploy.js` 가드(clean tree·origin 동기화·게이트 재실행·배포 후 스모크)
- **강제**: `check:hooks`가 훅 미설치를 경고(check:ci 첫 단계) — 로컬 우회 경로 자체를 감시

### 5. 요구사항 추적성 (Requirements Traceability)

- **개념**: 요구사항 ID → 구현 → 테스트 → 문서의 링크를 코드 주석(`@spec`)과 문서 헤더(`관련 SPEC ID`)로 인라인화해 기계 스캔
- **구현물**: `tools/build/build_trace_matrix.js` → `docs/dev/TRACE_MATRIX.md` — 390개 요구사항 × 소스/테스트/문서/보고서 링크
- **게이트**: `check:specrefs` — 스테일 ID 참조 탐지 + "소스 연결 있는데 테스트 없는 요구사항" 갭 기준선(**현재 0 — 신규 갭 즉시 실패**)
- **효과**: "이 요구사항 어디 구현됐지?" 역방향 질의와 "이 코드가 어떤 요구사항이지?" 정방향 질의 모두 지원

### 6. 영향도 분석 (Impact Analysis)

- **개념**: 변경 파일에서 영향받는 요구사항과 실행해야 할 테스트를 추적 매트릭스로 역산
- **구현물**: `tools/check/impact_tests.js` — 미커밋 diff 자동 분석, `--ref`로 커밋 범위 분석, `--run`으로 권장 테스트 실제 실행
- **배선**: pre-push 훅에서 `--run` 실행 — 전체 스위트 대신 영향 범위만 검증해 푸시 지연 최소화

### 7. 이중 구현 등가성 (Dual-Implementation Equivalence)

- **개념**: 동일 변환을 구현한 두 파서(빌드용·런타임용)가 같은 입력에서 이행 차이를 내지 않는지 지속 대조
- **구현물**: `check:parser` — 빌드 파이프라인 파서 ↔ 런타임 `markdown-parser.js`의 동일 문서 변환 결과 비교
- **배경**: 콘텐츠 MD가 빌드 번들과 앱 내 뷰어에서 각각 파싱되는 구조 — 한쪽만 수정되는 파서 드리프트가 실수로 발생한 이력에서 도입

### 8. 아키텍처 피트니스 함수 (Architecture Fitness Functions)

- **개념**: 아키텍처 규칙을 문서가 아닌 실행 가능한 검사로 표현 — "규칙을 지켜라"가 아니라 "위반하면 빌드가 깨진다"
- **구현물**:
  - `check:domainmap` — watchedDirs 전 파일의 platform/feature/domain 분류 강제 + 시험명·`exams/<id>/` 리터럴의 platform 침투 차단
  - `check:imports` — import/export 교차 검증 + **도메인 경계 3규칙**(신규 6종 상세 참조)
  - `check:storage` — `storage.js` 우회하는 localStorage 직접 접근 차단(부트스크립트 등 사유 등록된 허용 목록 제외)
- **효과**: 멀티시험 분리 같은 대규모 리팩터링이 "한 번의 수술"이 아니라 게이트가 유지하는 지속 상태가 됨

### 9. 도메인 격리·규약 경로 (Convention over Configuration)

- **개념**: 시험별 자산을 `exams/<id>/` 규약 위치에 두고 활성 시험만 런타임 해석 — 설정 파일 대신 디렉터리 규약이 배치를 결정
- **구현물**: `src/exams/`·`html/exams/`·`css/exams/`·`tests/*/exams/`·`content/exams/`·`data/exams/` 6계층 + `_domainImport()`+`${getActiveExamId()}` 템플릿 + `exam-data-boot.js`(파싱 중 활성 시험 데이터 번들 동기 삽입)
- **검증**: E2E가 네트워크 수준에서 증명 — food 부팅 시 `exams/cosmetic/` 요청 0건. 규약 테스트가 feature 선언 시험의 실물 파일 존재를 검증

### 10. 테스트 피라미드 (Test Pyramid)

- **개념**: 빠르고 결정적인 하층 테스트를 다수, 느리고 취약한 상층을 소수로 — 비용 대비 신뢰 최적화
- **계층**(2026-10 기준): unit `node --test` 800+(순수 로직) → DOM vitest+jsdom 510(뷰 계약·오프라인 모킹) → E2E Playwright 21(실브라우저 부트·SW·격리)
- **규약**: `check:testfirst`가 로직 변경 시 테스트 동반을 강제 — 피라미드가 스스로 유지됨

### 13. 커버리지 기준선 (Coverage Ratchet)

- **개념**: 절대 목표치 대신 "지금보다 나빠지지 않는다"를 강제 — 기존 부채는 동결하고 신규 악화만 차단
- **구현물**: `coverage_merge.js --check` — unit+DOM v8 커버리지 병합 후 기준선 대비 하향 시 실패
- **철학**: 백분율 목표는 게이밍(무의미 테스트 작성)을 유도하지만, 래칫은 회귀만 막아 실효성이 높음

### 14. 골든 마스터 비교 (Golden Master)

- **개념**: 레거시 변환 결과를 "정답본"으로 동결하고, 재변환 출력과 대조해 회귀 탐지 — 요구사양을 완전히 명문화 못 하는 변환 로직에 유효
- **구현물**: `verify:refs` — `ref_md_v2/`(재변환 스테이징) vs `ref_md/`(승격된 현행본) 내용 대조, 누락 시 exit 1
- **절차**: PDF 교체 → convert:refs → verify:refs → 수동 승격 → `check:reffresh -- --update`(PDF 해시 스탬프)

### 16. 문서-코드 동기화 게이트 (Docs-First Enforcement)

- **개념**: "문서는 나중에"가 구조적으로 불가능하도록 커밋/푸시 단계에서 강제
- **구현물**:
  - `check:docsync` — src/tools/tests/설정 변경 시 docs/·AGENTS·README 갱신 동반 필수 (`SKIP_DOCSYNC=1`·`[no-docs]` 우회 경로는 명시적으로 존재 — 면제도 감사 가능하게)
  - `check:testfirst` — 로직 변경 시 테스트 동반 (`[no-test]`·`SKIP_TESTFIRST=1`)
- **효과**: 문서 정합 게이트(#17)가 "스테일을 잡는" 층이라면, 이 층은 "스테일이 생기지 않게 하는" 층

### 17. 문서 인벤토리 정합 (Inventory Parity)

- **개념**: 문서 안의 선언(트리·경로·명령·키 목록)과 실제 파일시스템·package.json·코드 사용의 양방향 일치를 검증
- **구현물**: `check:inventory`(AGENTS 트리·ARCHITECTURE box 트리 ↔ 실물) · `check:commands`(문서의 npm 인용 ↔ 스크립트) · `check:plan`(feature-plan 키 ↔ 코드 사용 ↔ 로드맵) · `check:featflags`(exams.json features ↔ 코드 사용 — 미선언 키는 영구 falsy 죽은 경로) · `check:ciparity`(ci.yml ↔ check:ci) · `check:notes`(릴리스 노트 ↔ 커밋 해석)
- **효과**: docs/README 트리의 "(10개)" 같은 개수 표기까지 실측과 불일치하면 실패 — 문서가 거짓말을 할 수 없는 구조

### 19. Docs-as-Code

- **개념**: 문서를 코드와 같은 수명주기(버전·검증·리뷰)로 관리
- **구현물**: 모든 문서의 `문서 ID`(DOC-XXX-NN, 유일성 검증) + `관련 SPEC ID` 헤더 + `check:docs`가 경로 참조 실존·ID 누락/중복을 pre-push·CI에서 검증
- **효과**: 문서 링크 부패·고아 문서·인덱스 누락이 게이트 실패로 표면화

### 20. 저장소 추상화 계층 (Storage Abstraction)

- **개념**: 영속성 접근을 단일 모듈로 수렴시켜 백엔드 교체·스코프·쿼터 정책을 중앙화
- **구현물**: `src/storage.js` — localStorage(1차)/Supabase(선택 동기화) 동일 API, 동기 getItem/setItem + Async 이중 인터페이스, 쓰기 훅·쿼터 감지 중앙화
- **강제**: `check:storage`(#8)가 우회를 차단 — 부트 스크립트 등 예외는 ALLOWED_FILES에 사유 명시 필수 (ADR-0003)

### 22. 배포 단일 진입점 + 스탬프 (Single-Entry Deploy)

- **개념**: 배포는 사람 절차가 아닌 스크립트 하나 — 가드·검증·버전 스탬프·사후 확인이 한 흐름
- **구현물**: `tools/deploy/deploy.js` — clean tree·origin/main 동기화 가드 → 품질 게이트 재실행 → `stamp:sw`로 CACHE_VERSION 자동 커밋·푸시 → `vercel --prod` → 배포 후 스모크(index 200·sw.js 버전·APP_VERSION 일치)
- **규약**: `vercel --prod` 직접 실행 금지 — 미푸시 커밋이 프로덕션에 올라가는 사고 경로 차단

### 23. 공급망 보안 (Supply-Chain Security)

- **개념**: 내 코드가 아니라 의존성·빌드 산출물의 무결성도 검증 대상
- **구현물**: `npm run sbom`(SPDX 산출 → CI 아티팩트) · `npm audit --audit-level=high`(CI 게이트) · Dependabot 주간 PR · `check:secrets`(개인키·service_role·토큰 패턴 — pre-commit 차단, publishable key는 ALLOWLIST)
- **판별**: Stryker 도입 시 undici high 취약점을 즉시 탐지→`audit fix` 해소한 실전 사례 있음

### 24. CalVer 버저닝

- **개념**: `v<날짜>-<커밋해시>` — 배포 시각과 코드 정체를 한 문자열로 (API 소비자가 없는 앱에서 SemVer의 의미론은 불필요)
- **구현물**: `stamp:sw`가 sw.js CACHE_VERSION·APP_VERSION을 커밋 해시로 스탬프 → 배포 스모크가 sw.js 버전 문자열과 APP_VERSION 일치를 실검증
- **효과**: 프로덕션에 올라간 정확한 커밋을 역추적 가능 — "지금 서버에 뭐가 떠 있지"가 버전 문자열 하나로 해소

### 25. 점진적 품질 강제 (Quality Ratchet)

- **개념**: 레거시 위반은 기준선으로 동결하고 신규 위반만 실패시키는 일방향 래칫 — 완벽 요구는 마비를 만들지만 래칫은 방향만 강제
- **구현물**: `lint --max-warnings 0`(기존 경고 동결·신규 경고 차단) · specrefs 갭 기준선 0 · 커버리지 하향 차단(#13)
- **철학**: 개선은 선택, 악화는 불가 — 시간이 지날수록 품질이 단조 증가

---

## 카테고리별 적용 맵

### A. 요구사항 → 산출물 추적

```
SPEC.md(ID) ──→ 소스 @spec ──→ tests @spec ──→ docs 헤더 ──→ TRACE_MATRIX
      │               │              │              │
      └── check:specrefs (스테일·갭 기준선)  └── check:trace (입력 해시 신선도)
```

- `impact_tests.js`: 변경 파일 → 영향 요구사항 → 권장 테스트 (pre-push 실행)
- 테스트 갭 기준선 = 0 — 소스 연결 있으나 테스트 없는 신규 요구사항 즉시 차단

### B. 아키텍처 피트니스 함수

| 게이트 | 강제하는 규칙 |
|--------|---------------|
| `check:domainmap` | watchedDirs 전 파일의 platform/feature/domain 선언 + 시험 리터럴·경로 차단 + 미등록 시험 디렉터리 탐지 |
| `check:imports` | import/export 교차 검증 + 도메인 경계 3규칙 + `${getActiveExamId()}` 확장 해석 + `typeof` 가드·unused 탐지 |
| `check:storage` | src/의 localStorage 직접 접근 차단 — `storage.js` 추상화 강제 |
| `check:uitext` | platform HTML의 시험 용어 잔존 + data-uitext↔manifest 양방향 |
| `check:featflags`·`check:plan` | features/플랜 키 선언↔사용 양방향 — 미선언 키는 죽은 경로로 오류 |

### C. 빌드·생성물 관리

- **SSOT → 생성물**: content/*.md → data/ 번들 · index.template+파셜 → index.html · SPEC+@spec → TRACE_MATRIX
- **신선도 게이트**: 입력 해시(trace) · 재조립 비교(html) · 빌드-후-git-diff(datafresh) · 번들 쌍 비교(drillfresh·docbundles)
- **결정성**: LF 정규화 해시 — Windows autocrlf ↔ Linux CI 동일 바이트
- **파서 등가성**: 빌드 파서 vs 런타임 파서 동일 입력 대조 (`check:parser`)
- **골든 비교**: `verify:refs`가 ref_md_v2 변환본과 승격본을 대조

### D. 테스트 계층

| 계층 | 도구 | 수량(2026-10 기준) |
|------|------|-------------------|
| 예제 기반 유닛 | node:test | 800+ |
| **속성 기반** | fast-check | 8 |
| DOM | vitest+jsdom | 510 |
| E2E | Playwright | 21 (3 프로젝트) |
| **변이** | Stryker | 수동 (4모듈 스코프) |
| 커버리지 | v8 병합+기준선 | 임계값 하향 차단 |

### E. 운영·관측성·배포

- **배포 단일 진입점**: `deploy.js` — clean tree·origin 동기화 가드 → 품질 게이트 재실행 → `v<날짜>-<해시>` 스탬프 → vercel --prod → 배포 후 스모크
- **오류 텔레메트리**: client_errors (익명 insert, RLS 조회 차단)
- **웹바이탈**: `src/web-vitals.js` 측정 + `check:perf` 예산
- **오프라인 감지**: 프로브 실패 누적 → 배너 (DOM 테스트가 모킹으로 검증)

### F. 보안

- CSP `script-src 'self'` — 인라인 스크립트·핸들러 전면 금지 (delegation-guard·security 테스트가 스캔)
- `check:secrets` — 추적 파일의 개인키·토큰 패턴 (pre-commit 차단)
- SBOM(SPDX) CI 아티팩트 + `npm audit --audit-level=high` + Dependabot 주간 PR
- Supabase: RLS 강제 — publishable key는 설계상 공개, 실 보안은 정책

### G. 문서 프로세스

- **Docs-as-Code**: 문서도 테스트 대상 — 경로 존재·DOC ID·명령 인용 정합
- **Docs-First 게이트**: 소스 변경 시 문서 갱신 동반(`check:docsync`) + 로직 변경 시 테스트 동반(`check:testfirst`)
- **ADR**: 결정의 "왜"를 이력으로 보존 (`docs/dev/adr/`)
- **런북 문화**: 반복 작업은 전부 runbook화 (runbooks/ 11종)

---

## 부록 — 의도적 미적용 기법과 사유

| 기법 | 미적용 사유 |
|------|-------------|
| SemVer | API 소비자 없는 앱 — CalVer+커밋해시가 더 직접적 (ENGINEERING_PRACTICES 부록 A) |
| Conventional Commits 강제 훅 | 이미 규약을 따르는 커밋 이력 — 외부 기여자 생기면 도입 검토 |
| SLSA provenance·서명 | 정적 PWA 배포 형태에는 과도 — SBOM으로 SSDF 기본 수준 충족 |
| Visual regression (스크린샷 diff) | 멀티시험 테마 검증엔 유효하나 유지 비용 대비 현 E2E가 충분 — 테마 확장 시 재검토 |
| Consumer-driven contract | 백엔드가 Supabase 단일 — 스키마는 schema.sql+설계 문서가 담당 |

---

## 관련 문서

- [ENGINEERING_PRACTICES.md](ENGINEERING_PRACTICES.md) — 기법의 표준·프레임워크 대응 평가 (ISO 29148·SLSA·IEEE 1012 대조)
- [VERIFY_DEPLOY_PIPELINE.md](../runbooks/VERIFY_DEPLOY_PIPELINE.md) — 게이트 실행 순서·실패 복구
- [TESTING.md](TESTING.md) — 테스트 파일 목록·커버리지·PBT/변이 사용법
- [ARCHITECTURE.md](../ARCHITECTURE.md) — 구조 상세·도메인 경계 규약
- `docs/dev/adr/` — 아키텍처 결정 기록
