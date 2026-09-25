# 🎓 학습 Premium(Pro) 구현 과제 정리

> **작성일**: 2026-09-25
> **목적**: 학습(시험 준비) 측 Premium의 구현 대상을 우선순위·공수·전제 조건과 함께 정리
> **관련 문서**: [FEATURE_PROPOSALS.md](FEATURE_PROPOSALS.md), [PASS_CORE_LOOP_REVIEW.md](PASS_CORE_LOOP_REVIEW.md), [SUBSCRIPTION_ROADMAP.md](SUBSCRIPTION_ROADMAP.md), [사업기획서](../맞춤형화장품_조제관리사_자격증플랫폼_사업기획서.md)

---

## 0. 전제

- Premium의 유료 근거는 콘텐츠 차단이 아니라 **"나에게 맞게 공부시켜주는 개인화"** (사업기획서 §8.1).
- 학습 콘텐츠 엔진(교재 파싱, 카드/퀴즈 추출, SM-2, 모의고사·과락 판정)은 완성됨 — 과제는 **끊어진 파이프라인 배선 + 개인화 계층** (PASS_CORE_LOOP_REVIEW §6).
- 사업 순서상 학습 Premium은 **개인화 완성 후**이며, Formula OS Pro 검증과 병행 (사업기획서 §12.3).

## A. 끊어진 파이프라인 복구 (공수 소~중)

| # | 과제 | 현재 상태 | 구현 |
|---|---|---|---|
| A1 | 퀴즈 오답 → `weakCards` 연결 | 데일리챌린지·모의고사·플래시카드는 오답 시 `weakCards.add()` 호출 — **일반 기출 퀴즈(`quiz.js`)는 누락** | `quiz.js` 오답 처리에 `state.weakCards.add()` — 한 줄급 |
| A2 | 오답 → 재학습 연결 | 오답 리뷰 목록 표시만 존재, 재학습 자동 연결 없음 | ① 오답 원인 자가 태깅(암기부족/개념오해/계산실수) — AI 자동 분류는 데이터 축적 후 2단계 ② 교재 섹션(L### 인용)·관련 카드·유사문제 매칭 ③ 재시험 루프 |

## B. 개인화 학습 엔진 (Premium 핵심)

| # | 기능 | 현재 상태 | 구현 |
|---|---|---|---|
| B1 | AI 맞춤 학습 경로 ("오늘의 합격 전략") | ❌ | SM-2 복습 대기 + 정답률 최저 + 헷갈린 카드 + 미학습 챕터 + 과락 과목 우선순위 종합 → "왜 공부해야 하는지" 이유 표시 카드 (FEATURE_PROPOSALS §4.1 와이어프레임 참조) |
| B2 | 진단 평가 | ❌ | 과목별 10~20문항 진단 세트 → 약점 프로파일 생성 (사업기획서 §5.4) |
| B3 | 학습 목표 / D-Day | ❌ (`study-tracker.js`에 목표 헬퍼만) | 시험일 설정·카운트다운·일일/주간 목표·달성률 추적 — manifest `exams` 일정 연동 가능 (FEATURE_PROPOSALS §4.4) |
| B4 | 오답 패턴 분석 | △ 오답 노트 기본만 | 7일 오답 원인 분포·과목/키워드 집계 → 처방 추천 (사업기획서 §5.4) |

## C. 차별화 (Phase 2 — B 완성 후)

| # | 기능 | 비고 |
|---|---|---|
| C1 | 합격 예측 점수 | 대시보드 `prediction-card`에 기본 틀(3단계 진단) 존재하나 신뢰구간·실제 합격자 결과 데이터 연동 없음 — **데이터 수집 경로 선행 필수** |
| C2 | 통합 검색 (Ctrl+K 팔레트) | 교재/카드/퀴즈/참조자료/성분/뷰 전환 통합 (FEATURE_PROPOSALS §4.5) |
| C3 | 출제 패턴 분석·코칭 리포트·지식 맵·요약 노트 | FEATURE_PROPOSALS Phase 2 |

## D. 유료화 인프라 (Premium 출시 선행 조건)

| # | 과제 | 참조 |
|---|---|---|
| D1 | 결제 시스템 (토스/Stripe) + 구독 관리 | SUBSCRIPTION_ROADMAP §4 |
| D2 | 콘텐츠 게이팅 + entitlement 판정 + CSP 완화 + SW 캐시 무효화 | SUBSCRIPTION_ROADMAP §4~§6 |
| D3 | 무료 티어 축소 폭·그랜드파더링 정책 확정 — **클라우드 동기화는 유료 전환 대상 제외**(회수 반발 리스크) | SUBSCRIPTION_ROADMAP §3.4 |

## 후순위 (사업기획서 기준)

조제 시뮬레이터 · 학습 커뮤니티 · 멘토링 매칭 · B2B 학원 솔루션 · 학습 타임라인/북마크/알림 등 부가 기능.

## 진행 순서 요약

```
A1 → A2 (배선 복구, 공수 소)
  → B1 → B3 → B2 → B4 (개인화 계층 — Premium의 실체)
  → C (차별화, C1은 데이터 수집 선행)
  → D (유료화 인프라 — Formula OS Pro 검증과 병행)
```

---

## 📎 관련 문서

- [FEATURE_PROPOSALS.md](FEATURE_PROPOSALS.md) — 추천 기능 제안 (합격 핵심 루프 정의)
- [PASS_CORE_LOOP_REVIEW.md](PASS_CORE_LOOP_REVIEW.md) — 파이프라인 끊김 지점 코드 리뷰
- [SUBSCRIPTION_ROADMAP.md](SUBSCRIPTION_ROADMAP.md) — 수익화 3단계 전환 로드맵
- [사업기획서 §5.4·§8.4·§12.3](../맞춤형화장품_조제관리사_자격증플랫폼_사업기획서.md)
