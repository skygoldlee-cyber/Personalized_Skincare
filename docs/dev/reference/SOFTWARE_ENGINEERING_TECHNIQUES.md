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
