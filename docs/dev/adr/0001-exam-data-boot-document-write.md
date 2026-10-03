# ADR-0001: 활성 시험 데이터 번들을 document.write 부트 스크립트로 로드

> **문서 ID**: DOC-ADR-01
> **관련 SPEC ID**: P-01~06
> **상태**: accepted (2026-10-03)

## 상황 (Context)

멀티시험 분리 이전, `index.template.html`은 `__EXAM_DATA_ROOT__` 플레이스홀더를 빌드 시
기본 시험(cosmetic)으로 치환해 `registry.js`·`id_migration.js`를 정적 로드했다.
이는 시험 무관하게 cosmetic 데이터 번들을 요청해 비활성 시험 격리를 깨뜨렸다
(네트워크 격리 E2E가 실제 결함으로 포착).

제약:
- 두 스크립트는 `window.DATA_REGISTRY`·`window.ID_MIGRATION_MAP` 전역을 설정하며,
  이후 `data/exams.js`의 `EXAMS_LIST` 소비자보다 **먼저 실행**되어야 한다
- CSP `script-src 'self'` — 인라인 스크립트 불가
- 동적 `import()`·`script.async`는 실행 순서를 보장하지 않거나 비동기라 전역 설정 시점이 어긋난다
- `data/exams.js`(EXAMS_LIST)는 클래식 스크립트로 파싱 시점에 이미 로드됨 — 활성 시험 해석 가능

## 결정 (Decision)

`src/exam-data-boot.js` 클래식 부트 스크립트를 두고, 문서 파싱 중(`readyState === 'loading'`)
활성 시험을 해석해 `document.write`로 `{dataRoot}/id_migration.js`·`registry.js`를 동기 삽입한다.

## 대안 (Alternatives considered)

- **ESM `await import()` 부트**: 실행 순서가 앱 모듈 초기화보다 늦어 전역 미설정 창이 생김 — 기각
- **빌드 시 전 시험 번들 삽입 + 런타임 선택**: 비활성 시험 자산을 계속 받음 — 격리 목적에 반함
- **서버 사이드 치환**: 정적 배포(Vercel)라 서버 로직 없음 — 불가
- **`script.src` + `defer` 수동 삽입**: DOMContentLoaded까지 실행이 지연되어 전역 설정 경쟁 상태 — 기각

## 결과 (Consequences)

- 장점: 실행 순서·CSP·정적 배포 제약을 모두 만족, 비활성 시험은 데이터 번들을 전혀 받지 않음
- 비용: `document.write`는 파싱 중에만 유효 — 비동기 로드되면 조용히 무시됨
  (`check:html`이 템플릿의 정적 위치를, E2E 21건이 실제 부팅을 감시해 회귀 즉시 표면화)
- 부수 효과: `check:storage` 허용 목록에 부트 스크립트의 `current_exam` 직접 접근이
  사유와 함께 등록됨 — 스토리지 추상화가 아직 로드되지 않은 시점의 예외
