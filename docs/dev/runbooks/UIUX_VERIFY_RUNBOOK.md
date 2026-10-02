# UI/UX 검증 런북 — TRACE 체계 단계별 확인 절차

> **목적**: UI/UX 변경(크기·배치·가시성·인터랙션)을 TRACE MATRIX 체계 안에서 단계별로 검증하는 표준 절차. SPEC 선행 → @spec 추적 → 정적 게이트 → 자동 테스트 → 시각 실측 → 추적 갱신 → 배포 확인까지 누락 없이 진행하기 위한 운영 문서.
> **관련 문서**: [SPEC.md](../SPEC.md) §4.8.8 (UX-VFY-01~05 — 본 절차의 요구사양 원천) · [VERIFY_DEPLOY_PIPELINE.md](VERIFY_DEPLOY_PIPELINE.md) (전체 게이트 파이프라인) · [TESTING.md](../reference/TESTING.md)
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
- [ ] chromium + mobile 양 프로젝트 통과 (`npm.cmd run test:e2e -- tests/e2e/<파일>`)
- [ ] DOM/단위는 로직·존재만 검증 — 기하 단언은 e2e에만 둔다 (jsdom 측정값은 전부 0)
- [ ] 회귀: `npm.cmd run check:specrefs` → "UI/UX E2E 갭"이 기준선(61) 초과 시 실패. 신규 UI/UX ID는 e2e @spec과 함께 들어와야 통과

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

## 회귀 규칙

| 상황 | 대응 |
|------|------|
| 신규 UI/UX 요구사항에 e2e 없이 커밋 | `check:specrefs` 실패 — e2e @spec 추가 필수 |
| 규약·리뷰형 요구사항이라 e2e 불필요 | 기준선은 유지 가능하나 감소가 원칙 — `UIUX_E2E_GAP_BASELINE` 하향 조정으로 백로그 소진 추적 |
| 임시 계측 spec 잔류 | 작업 완료 시 삭제 — 측정용 파일은 커밋 대상 아님 |
| 기존 e2e 단언이 신규 변경으로 실패 | 단순 임계치 완화 금지 — 변경된 기하를 재측정해 새 기준값으로 갱신하고 CHANGES.md에 기록 |
