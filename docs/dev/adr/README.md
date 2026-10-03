# Architecture Decision Records (ADR)

> **문서 ID**: DOC-ADR-00
> **관련 SPEC ID**: 해당 없음 (결정 기록 색인 — 프로세스 문서)

아키텍처 결정의 **"왜"**를 보존한다. 코드는 "무엇"을, 설계 문서는 "어떻게"를 말하지만
대안 검토·제약·트레이드오프 같은 결정 맥락은 시간이 지나면 소실된다 — ADR이 그 공백을 메운다.

## 규약

- 파일명: `NNNN-영문-슬러그.md` (4자리 연번, 한 번 부여된 번호는 재사용 금지)
- 상태: `proposed` → `accepted` / `deprecated` / `superseded by ADR-NNNN`
- 결정은 후속 ADR로만 번복한다 — 이력을 지우거나 덮어쓰지 않는다
- 새 ADR을 추가하면 이 표에도 행을 추가한다

## 템플릿

```markdown
# ADR-NNNN: 제목

> **문서 ID**: DOC-ADR-NN
> **관련 SPEC ID**: 관련 ID 또는 "해당 없음"
> **상태**: accepted (YYYY-MM-DD)

## 상황 (Context)
배경·제약·문제의 구체적 조건.

## 결정 (Decision)
선택한 방식 — 한두 문장으로.

## 대안 (Alternatives considered)
검토했으나 기각한 방식과 그 사유.

## 결과 (Consequences)
이 결정이 낳는 결과 — 좋은 것과 나쁜 것 모두.
```

## 결정 목록

| ADR | 제목 | 상태 | 날짜 |
|-----|------|------|------|
| [0001](0001-exam-data-boot-document-write.md) | 활성 시험 데이터 번들을 document.write 부트 스크립트로 로드 | accepted | 2026-10-03 |
| [0002](0002-domain-asset-convention-paths.md) | 도메인 자산을 `exams/${활성시험}/` 규약 경로로 해석 | accepted | 2026-10-03 |
| [0003](0003-localstorage-first-storage.md) | localStorage 1차 저장 + Supabase 선택적 동기화 | accepted | 2026-09-30 |
