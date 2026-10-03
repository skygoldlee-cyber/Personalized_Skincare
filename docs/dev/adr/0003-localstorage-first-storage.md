# ADR-0003: localStorage 1차 저장 + Supabase 선택적 동기화

> **문서 ID**: DOC-ADR-03
> **관련 SPEC ID**: ST-01~05,AU-01~08
> **상태**: accepted (2026-09-30 — 프로젝트 초기부터 유지된 결정의 사후 문서화)

## 상황 (Context)

진행 데이터(학습 진도·카드 스케줄·오답)를 어디에 둘지 선택이 필요했다.
계정/서버 의무화는 익명 사용·오프라인 PWA·"설치 즉시 학습" 경험과 충돌한다.

## 결정 (Decision)

`localStorage`를 유일한 1차 저장소로 하고 `storage.js` 추상화 계층 뒤에 둔다.
Supabase는 로그인 사용자의 **선택적 동기화** 경로로만 사용하며, 미설정 환경에서도
전 기능이 동작한다 (`isSupabaseConfigured()` → 로그인 UI 숨김).

## 대안 (Alternatives considered)

- **서버 우선 (계정 의무)**: 진입 장벽·오프라인 불가·개인정보 수집 범위 확대 — 기각
- **IndexedDB 1차**: 용량은 크지만 동기 코드 전면 비동기화 비용 대비 실익 낮음 —
  쿼터 경고(storage.js의 감지 훅)로 5MB 한계를 커버한다고 판단
- **서비스 워커 캐시에 진도 저장**: 캐시는 앱 자산이지 데이터 저장소가 아님 — 기각

## 결과 (Consequences)

- 모든 src 모듈이 localStorage를 직접 만지면 백엔드 교체가 불가능해지므로
  `check:storage` 게이트가 직접 접근을 차단하고 `storage.js` 추상화를 강제한다
  (부트스크립트·인프라 예외는 ALLOWED_FILES에 사유 명시)
- Supabase 스키마(`tools/supabase/schema.sql`)는 익명 insert·RLS로 공개키 노출을 상쇄
- 오프라인 큐잉(`pending_feedback` 등)은 storage.js 경유 — 온라인 복귀 시 플러시
