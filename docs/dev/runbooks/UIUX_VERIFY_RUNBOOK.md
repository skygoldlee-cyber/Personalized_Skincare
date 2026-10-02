# UI/UX 검증 런북 — TRACE 체계 단계별 확인 절차

> **목적**: UI/UX 변경(크기·배치·가시성·인터랙션)을 TRACE MATRIX 체계 안에서 단계별로 검증하는 표준 절차. SPEC 선행 → @spec 추적 → 정적 게이트 → 자동 테스트 → 시각 실측 → 추적 갱신 → 배포 확인까지 누락 없이 진행하기 위한 운영 문서.
> **관련 문서**: [SPEC.md](../SPEC.md) §4.8.8 (UX-VFY-01~05 — 본 절차의 요구사양 원천) · [UIUX_요구사양.md](../UIUX_요구사양.md) (기기별 배치 계약 — 검증 대상 정의) · [VERIFY_DEPLOY_PIPELINE.md](VERIFY_DEPLOY_PIPELINE.md) (전체 게이트 파이프라인) · [TESTING.md](../reference/TESTING.md)
> **최종 업데이트**: 2026-10-02
> **문서 ID**: DOC-RBK-11
> **관련 SPEC ID**: `UX-VFY-01~05`

---

## 왜 별도 절차인가

UI/UX 요구사양은 단위·DOM 테스트로 검증 불가능한 영역이 있다 — jsdom은 레이아웃을 계산하지 않으므로 `offsetHeight`·`getBoundingClientRect`가 전부 0이다. "요소가 존재한다"와 "화면에 제대로 보인다"는 다른 명제이며, 후자는 **실제 브라우저 계측**만이 증명한다.

## 단계별 절차

### V0. 요구사양 정의 (코드 이전) — UX-VFY-01

- [ ] `docs/dev/SPEC.md`에 요구사항 ID 부여 (기존 접두사: `TR-` 리더 / `UX-*` 재사용 규칙 / `R-` 반응형 / `A-` 접근성 / `TH-` 테마)
- [ ] 검증 유형 명시 — **E2E 실측**(기하·가시성) / **DOM·단위**(존재·클래스·로직) / **규약·리뷰**(금지 패턴·설계 원칙)
- [ ] 측정 가능한 수용 기준 포함 (예: "본문 높이 ≥ 뷰포트 60%")

### V1. 구현 + 추적 연결

- [ ] 변경 소스(CSS·JS·HTML 파셜)에 `@spec` 태그 부기
- [ ] HTML 파셜 변경 시 `npm.cmd run build:html` → `check:html` 통과

### V2. 정적 게이트

```powershell
npm.cmd run lint            # ESLint 에러 0
npm.cmd run check:types     # tsc --noEmit
```

### V3. 자동 동작 검증 — UX-VFY-02/03

- [ ] **기하 계열**(높이·너비·겹침·잘림·스크롤·오버레이 위치) → `tests/e2e/`에서 계측 단언:
  ```js
  const h = await page.evaluate(() => el.getBoundingClientRect().height);
  expect(h).toBeGreaterThan(vh * 0.6);  // toBeVisible만으로는 미충족
  ```
- [ ] chromium + mobile + tablet 3개 프로젝트 통과 (`npm.cmd run test:e2e -- tests/e2e/<파일>`)
  - 뷰포트 대역: chromium=1280×720 데스크톱 / tablet=834×1112(769–900 상단 바 대역) / mobile=Pixel 7(≤768 하단 탭 바)
  - 반응형 경계(900px TOC 드로어 전환 등)를 건드린 변경은 3개 모두 필수
- [ ] 접근성 변경(색·대비·포커스·라벨) → `tests/e2e/a11y.spec.js`에 대상 추가 — axe 스캔은 워커 실행 시 전 프로젝트 자동 적용
- [ ] DOM/단위는 로직·존재만 검증 — 기하 단언은 e2e에만 둔다 (jsdom 측정값은 전부 0)
- [ ] 회귀: `npm.cmd run check:specrefs` → "UI/UX E2E 갭"이 기준선(43) 초과 시 실패. 신규 UI/UX ID는 e2e @spec과 함께 들어와야 통과

### V4. 시각 실측 + 기록 — UX-VFY-04

- [ ] 임시 계측 spec으로 실제 수치 확보 (패턴: 로컬 서버 기동 → `getBoundingClientRect`/`scrollHeight` 로그 출력 → 스크린샷 촬영 → **작업 후 삭제**)
- [ ] chromium(데스크톱) + mobile(Pixel 7급) 양쪽 수치
- [ ] 전후 수치를 `docs/dev/CHANGES.md` 항목에 기록 (예: "본문 296→500px (41%→69%)")
- [ ] 육안 스크린샷 검토 — 수치 통과해도 시각 이상(겹침·비율)은 별도 확인

### V5. 추적 갱신

```powershell
npm.cmd run build:trace      # TRACE_MATRIX 재생성
npm.cmd run check:trace      # 신선도 통과 확인
# TRACE_MATRIX에서 해당 ID의 "검증 수단" 열이 'E2E 테스트'로 표시되는지 확인
```

### V6. 배포 + 실기기 확인 — UX-VFY-05

```powershell
npm.cmd run deploy          # 가드 → 스탬프 → vercel --prod → 프로덕션 스모크
```

- [ ] 배포 스모크 통과 (`CACHE_VERSION`/`APP_VERSION` 200)
- [ ] **실기기 육안 확인** — UX-PWA-03(Cache First) 특성상 재실행 1~2회 후 반영됨을 안내
- [ ] 모바일은 safe-area·탭 바 겹침, 데스크톱은 창 크기 변동 시 재확인

## 자동화 불가 영역 — 수동 검증 면제 목록

E2E로 신뢰성 있게 자동화할 수 없는 요구사항은 아래 표로 관리한다. 면제는 "검증 생략"이 아니라 **V6의 수동 확인으로 이관**하는 것이며, 각 항목은 증거와 재평가 시점을 가진다.

| 요구사항 | 자동화 불가 사유 | 수동 확인 절차 | 기록할 증거 | 재평가 |
|----------|------------------|----------------|-------------|--------|
| PWA 설치 프롬프트 (UX-PWA-01/02) | `beforeinstallprompt`는 실제 설치 조건(사용자 인게이지먼트·HTTPS·미설치 상태)에서만 발화 — Playwright context로 합성 불가 | 실기기/데스크톱 Chrome에서 설치 배너 표시 → 설치 → 스탠드얼론 기동 | 기기·OS·브라우저 버전 + 스크린샷 | 브라우저가 `BeforeInstallPromptEvent` 프로그래밍 발화를 지원하면 e2e 전환 검토 |
| SW Cache First 갱신 타이밍 (UX-PWA-03) | 재실행·캐시 경쟁 조건이 타이밍 의존 — e2e에서 결정론적 재현 불가 | 배포 후 프로덕션 재실행 1~2회로 신버전 반영 확인 (`CACHE_VERSION` 스모크는 자동) | 배포 해시 + 반영 확인 시각 | — |
| 실기기 safe-area·주소창 (R-05 등) | `env(safe-area-inset-*)`·동적 뷰포트는 실기기에서만 실측 — 에뮬레이터는 inset 0 | iOS Safari·Android Chrome 실기기에서 하단 탭 바·노치 겹침 확인 | 기기 모델 + 스크린샷 | — |
| 시각적 품질(겹침·비율·여백 미학) | DOM 단언은 위치만 증명 — "보기 좋다"는 판정 불가 | V4 스크린샷 육안 검토 | 전후 스크린샷 (CHANGES.md 첨부) | — |

면제 항목 운영 규칙:

- 면제는 위 표에 **ID·사유·수동 절차·증거 요건**을 갖춰 등록한 것만 유효 — 주석이나 구두 합의는 인정하지 않는다
- 면제 항목도 `check:specrefs` 갭 집계에는 포함된다 — 기준선 안에서 관리되며, 자동화 수단이 생기면 즉시 e2e로 전환하고 기준선을 하향 갱신한다
- 배포 시 V6 실기기 확인은 면제 항목 포함 전 영역에 적용된다

## 회귀 규칙

| 상황 | 대응 |
|------|------|
| 신규 UI/UX 요구사항에 e2e 없이 커밋 | `check:specrefs` 실패 — e2e @spec 추가 필수 |
| 규약·리뷰형 요구사항이라 e2e 불필요 | 기준선은 유지 가능하나 감소가 원칙 — `UIUX_E2E_GAP_BASELINE` 하향 조정으로 백로그 소진 추적 |
| 임시 계측 spec 잔류 | 작업 완료 시 삭제 — 측정용 파일은 커밋 대상 아님 |
| 기존 e2e 단언이 신규 변경으로 실패 | 단순 임계치 완화 금지 — 변경된 기하를 재측정해 새 기준값으로 갱신하고 CHANGES.md에 기록 |
