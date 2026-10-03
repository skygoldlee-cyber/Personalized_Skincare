# ADR-0002: 도메인 자산을 `exams/${활성시험}/` 규약 경로로 해석

> **문서 ID**: DOC-ADR-02
> **관련 SPEC ID**: P-01~06
> **상태**: accepted (2026-10-03)

## 상황 (Context)

도메인 모듈 물리 이동(Phase E) 후에도 플랫폼 레지스트리·셸이
`./exams/cosmetic/views/formula.js`·`html/exams/cosmetic/formula.html` 같은
시험 id 하드코딩 경로를 품고 있었다. 이 상태는 "시험 추가 = 콘텐츠 배치 + 등록" 목표를
어긋낸다 — 새 시험은 기존 시험 id를 직접 참조하는 플랫폼 코드를 수정해야 했다.

## 결정 (Decision)

플랫폼 코드의 도메인 자산 경로를 모두 **활성 시험 해석 규약**으로 전환한다:

- 뷰 모듈: `practice-registry._domainImport(rel)` → `import(\`./exams/${getActiveExamId()}/${rel}\`)`
- 마크업: `_domainMarkup(rel)` → `html/exams/${활성시험}/${rel}` fetch
- 스타일: 레지스트리 `styles` 필드 → `css/exams/${활성시험}/` `<link>` 지연 주입
- 데이터: `exam-data-boot.js`가 `{dataRoot}/registry.js` 동기 삽입 (ADR-0001)
- 셸 스텁: `data-lazy-view="html/exams/{examId}/formula.html"` 플레이스홀더

정적 검증은 `check:imports`가 `${getActiveExamId()}` 세그먼트를 `src/exams/` 실재 디렉터리
전수로 확장해 수행하고, `check:domainmap`이 platform 파일의 `exams/<등록id>/` 리터럴을 차단한다.

## 대안 (Alternatives considered)

- **manifest 필드에 전체 경로 선언** (`views: {"formula": "exams/cosmetic/views/formula.js"}`):
  등록 지점에 시험 id가 다시 새어 나옴 + manifest가 구현 세부(파일 구조)에 결합 — 기각
- **도메인 자기등록** (모듈이 피처 계약을 export): 타이틀·핸들러까지 domain으로 이동해
  완결성은 높으나, 등록 전 스캔/부팅 전 비용·핸들러 명단 가시성 상실 — 두 번째 실무 피처
  추가 시 재검토로 유보

## 결과 (Consequences)

- 시험 추가가 `exams/<id>/` 규약 배치 + exams.json 등록만으로 동작 — 플랫폼 코드 수정 0
- `data-lazy-view` 플레이스홀더는 `{examId}` 패턴 — build_html·DOM 헬퍼·런타임이 같은 해석
- 동적 경로라 번들러 없는 vanilla 환경에서도 정적 분석 공백이 생기지 않도록
  체커 두 개가 확장 해석을 강제한다 (회귀 차단)
