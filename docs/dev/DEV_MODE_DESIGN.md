# PWA 개발자모드 / 고객모드 구분 관리 설계방안

> **작성일**: 2026-09-12
> **상태**: 설계 제안 (구현 대기)
> **대상**: Cosmetic Pass Master (Personalized_Skincare)

---

## 1. 현재 상태 분석

| 항목 | 현재 |
|---|---|
| 환경 분리 | 없음 (단일 배포) |
| 개발자 도구 | `tools/` (Node.js CLI, 앱 미통합) |
| 디버그 로그 | `console.debug` 전역 (항상 출력) |
| 개발자 메뉴 | 사이드바에 없음 |
| 환경 변수 | `.env.local` (Vercel 배포 미반영) |
| 콘텐츠 검증 | 수동 실행 (`npm.cmd run audit:cards`) |

---

## 2. 설계 목표

```
고객모드 (Production)           개발자모드 (Dev)
├── 학습 기능만 노출              ├── 학습 기능 + 개발자 도구
├── 디버그 로그 OFF              ├── 디버그 로그 ON
├── 콘솔 경고 최소화              ├── 상세 진단 로그
├── PWA 캐시 자동 관리            ├── 캐시 수동 제어/무효화
├── analytics/에러 리포팅        ├── 로컬 상세 에러 표시
└── 빠른 로딩 최적화              ├── 검증 도구/감사 패널
```

---

## 3. 모드 구분 방식 (3가지 옵션)

### 옵션 A — URL 기반 (추천)

```
https://personalized-skincare-study.vercel.app/          → 고객모드
https://personalized-skincare-study.vercel.app/#?dev=1   → 개발자모드
```

**장점**: 단일 배포, URL 파라미터로 즉시 전환, 별도 도메인 불필요
**구현**: `URLSearchParams` + `sessionStorage`로 세션 유지

### 옵션 B — 별도 도메인/경로

```
https://personalized-skincare-study.vercel.app/          → 고객모드
https://personalized-skincare-study.vercel.app/dev/      → 개발자모드
```

**장점**: 명확한 분리, 개발자 도구 코드 자체가 고객 배포에서 제외 가능
**단점**: 별도 빌드/배포 필요, Service Worker 분기 복잡

### 옵션 C — 환경 변수 빌드 분기

```powershell
npm.cmd run build:data -- --mode=dev    # 개발자용 번들
npm.cmd run build:data -- --mode=prod  # 고객용 번들
```

**장점**: 트리 쉐이킹으로 개발자 코드 완전 제거
**단점**: 빌드 파이프라인 2배, Vercel 정적 배포에서 환경 분기 복잡

---

## 4. 추천 설계 (옵션 A + 부분 B 하이브리드)

### 4.1 진입 방식

| 방식 | 대상 | 지속성 |
|---|---|---|
| `#?dev=1` URL 파라미터 | 개발자 | sessionStorage (세션 유지) |
| 사이드바 푸터 5회 연속 클릭 | 개발자 (숨겨진 진입) | sessionStorage |
| `localStorage.devMode = true` | 개발자 (수동 설정) | 영구 |
| Vercel Preview 배포 | 개발자 | 도메인 기반 자동 감지 |

### 4.2 개발자모드 기능

#### A. 사이드바 개발자 메뉴 추가

```
🔧 개발자 도구
├── 📊 카드 품질 감사 (audit:cards)
├── 🔗 인용 링크 검증
├── 📝 파서 등가성 검사
├── 🗂️ 캐시 상태 조회/무효화
├── 📦 데이터 빌드 실행 (빌드 로그 표시)
└── 🐛 디버그 로그 패널
```

#### B. 디버그 로그 제어

```js
// src/config/debug.js
const DEV_MODE = sessionStorage.getItem('devMode') === '1'
    || new URLSearchParams(location.hash.slice(1)).get('dev') === '1'
    || (!location.hostname.includes('vercel.app'));  // 로컬 = 개발자

export const debug = {
    log: DEV_MODE ? console.log.bind(console, '[dev]') : () => {},
    warn: DEV_MODE ? console.warn.bind(console, '[dev]') : () => {},
    error: console.error.bind(console),  // 에러는 항상 출력
};
```

#### C. 캐시 관리 패널

- 현재 Service Worker 캐시 버전 표시
- 캐시 항목 수/용량 조회
- 수동 캐시 무효화 버튼
- DATA_CACHE vs SHELL_CACHE 개별 제어

#### D. 콘텐츠 검증 대시보드

- 카드 품질 감사 결과 (짧은 설명, 중복, 참조 링크)
- 인용 라인번호 동기화 상태
- 파서 등가성 검사 결과
- 자산 누락 검증

#### E. 데이터 빌드 로그

- `build:data` 실행 로그 실시간 표시 (Vercel Serverless Function 필요)
- 또는 로컬에서만 실행 가능 안내

### 4.3 고객모드 최적화

| 항목 | 처리 |
|---|---|
| `console.debug` | `src/config/debug.js`로 래핑 → no-op |
| 개발자 메뉴 | DOM에서 제외 (CSS `is-hidden`이 아닌 미렌더링) |
| 개발자 도구 JS | 동적 import로 지연 로드 (고객 모드에서 미로드) |
| 에러 리포팅 | `try/catch` + 사용자 친화적 토스트 |
| analytics | (향후) 사용자 행동 추적 |

### 4.4 구현 아키텍처

```
src/
├── config/
│   ├── debug.js          # DEV_MODE 플래그 + debug.log/warn
│   └── cache.js          # (기존)
├── views/
│   ├── dev-panel.js      # 개발자 도구 패널 (동적 import)
│   ├── dev-audit.js      # 카드 감사 뷰
│   ├── dev-cache.js      # 캐시 관리 뷰
│   └── dev-build.js      # 빌드 로그 뷰
└── app.js                # 진입 시 DEV_MODE 체크 → 개발자 메뉴 조건부 렌더링
```

### 4.5 Service Worker 분기

```js
// sw.js
const IS_DEV = self.location.search.includes('dev=1');
const CACHE_VERSION = IS_DEV
    ? `dev-${STAMP}`
    : `v343-20260912-${STAMP}`;
// 개발자모드: 캐시 만료 0 (항상 네트워크 우선)
// 고객모드: 기존 Cache-First 정책 유지
```

---

## 5. 구현 단계 (우선순위별)

### P0 — 즉시 적용 (1단계)

1. `src/config/debug.js` 생성 → `console.debug` 래핑
2. `#?dev=1` URL 파라미터 감지 + `sessionStorage` 유지
3. 사이드바 개발자 메뉴 조건부 렌더링
4. 디버그 로그 ON/OFF

### P1 — 단계적 추가 (2단계)

5. 캐시 관리 패널 (버전, 항목 수, 무효화)
6. 카드 품질 감사 뷰 (기존 `tools/audit_card_quality.js` 연동)
7. 인용 라인번호 동기화 상태 표시

### P2 — 고도화 (3단계)

8. Vercel Preview 배포 자동 개발자모드 감지
9. 개발자 도구 동적 import (고객 모드 번들 크기 절감)
10. 에러 리포팅 (Sentry/Logflare 연동 검토)

---

## 6. 보안 고려사항

| 항목 | 조치 |
|---|---|
| 개발자 도구 악용 | `#?dev=1`만으로는 보호 불충분 → 추가 인증 토큰 검토 |
| 캐시 무효화 악용 | Rate limit (세션당 3회 제한) |
| 빌드 실행 | Vercel Serverless Function 필요 → 별도 인증 |
| 디버그 정보 노출 | 고객모드에서 `debug.js` 자체 미로드 |

---

## 7. 기대 효과

| 항목 | 효과 |
|---|---|
| 고객 UX | 디버그 로그/개발자 메뉴 제거로 깔끔한 경험 |
| 개발 효율 | 브라우저 내 즉시 검증/감사 도구 접근 |
| 번들 크기 | 개발자 도구 동적 import로 고객 번들 절감 |
| 유지보수 | 환경 분리로 프로덕션 안정성 향상 |
| 배포 단순화 | 단일 배포 + 런타임 분기 (옵션 A) |

---

## 8. 권장사항

1. **옵션 A (URL 기반) 추천**: 단일 배포, 즉시 전환, 복잡도 최소
2. **P0부터 순차 적용**: `debug.js` + 개발자 메뉴 조건부 렌더링 먼저
3. **Vercel Preview 배포 활용**: 개발자모드 자동 감지로 개발 브랜치 테스트
4. **보안 토큰 검토**: `#?dev=1` 노출 시 무분별 접근 가능 → 향후 PIN/토큰 인증 추가

---

## 관련 문서

- [아키텍처](ARCHITECTURE.md)
- [배포 가이드](DEPLOYMENT_GUIDE.md)
- [변경 이력](CHANGES.md)
- [사용자 매뉴얼](../user/user_manual.md)
