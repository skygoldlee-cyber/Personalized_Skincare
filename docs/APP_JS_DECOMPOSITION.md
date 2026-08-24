# app.js 점진 분해 로드맵

> 목적: 4,900줄대 `src/app.js` 모놀리식을 **동작을 깨지 않고** 점진적으로 모듈화하는 안전 절차와 후보 목록.
> 최종 업데이트: 2026-08-23

## 현재 구조 (중요 전제)

- `app.js`는 **IIFE로 감싸져 있지 않고** 전역 스코프에 약 145개의 최상위 `function` 선언과
  일부 최상위 상태(`simState`, `dailyState` 등), 그리고 끝의 `DOMContentLoaded` 리스너로 구성된다.
- 다른 `src/*.js`도 모두 **클래식 스크립트(전역 공유)**로 로드된다. 즉 함수/상태가 전역에서 서로를 참조한다.
- HTML에는 인라인 이벤트 핸들러(`onclick="..."`)가 있어 **함수가 전역명으로 노출되어야** 동작한다.

### 그래서 안전한 분해 원칙

1. **전역 함수는 전역으로 유지한다.** 모듈을 IIFE/ESM으로 감싸 전역 노출을 끊으면 인라인 핸들러가 깨진다.
   (ESM 전환은 별도 대규모 작업 — 이 로드맵의 범위 밖.)
2. 추출은 "**응집된 최상위 함수 묶음 + 그 묶음이 전용으로 소유한 최상위 상태**"를 통째로
   새 `src/<name>.js`로 옮기고, `index.html`에서 **app.js보다 먼저** 로드한다.
3. 옮긴 함수가 참조하는 다른 전역(다른 파일의 함수/상태)은 런타임에 해소되므로 그대로 둔다.
4. **닫힌(중첩) 함수/클로저는 통째로 옮기거나 아예 두는** 것이 원칙 — 일부만 떼면 스코프가 깨진다.
5. 각 추출 후 반드시: `node --check` (양쪽 파일) → 브라우저에서 해당 화면 스모크 테스트.

## 완료

- ✅ **`src/reader-format.js`** — 교재 리더 본문 포맷터(`formatSectionContentForReader`, 순수 함수, 외부 상태 의존 0).
  app.js에서 약 145줄 제거. (2026-08-23)
- (이전) `charts.js`, `scratchpad.js`, `trainer-calc.js`, `utils.js`, `sanitize.js`, `state.js`, `data-loader.js` 분리 완료.

## 남은 후보 클러스터 (app.js 최상위 함수 ≈145개 기준)

| 후보 모듈 | 대략 함수 수 | 함께 옮길 상태 | 비고 |
|-----------|-------------|----------------|------|
| `src/exam-sim.js` (모의고사) | ~21 | `simState`(1206행) | OMR/채점 렌더와 결합도 확인 필요 |
| `src/daily-challenge.js` | ~13 | `dailyState`(2946행) | 문제 생성기 포함(성분/용어/계산) |
| `src/reader.js` (리더 UI/오디오) | ~15(+오디오 9) | 리더 오디오 상태 | reader-format.js와 짝. 오디오 상태 이동 주의 |
| `src/quiz-review.js` (퀴즈/복습) | ~15 | 퀴즈 진행 상태 | `state.quiz` 사용부 확인 |
| `src/dashboard.js` (대시보드/통계) | ~4 | — | charts.js와 연동 |
| `src/calc-practice.js` (계산 화면) | ~5 | calc 진행 상태 | 순수 로직은 이미 trainer-calc.js |
| `src/ingredients-trainer.js` | ~1(+생성기) | `state.trainer.ingredients` | 생성기는 daily와 공유 여부 확인 |
| `src/ui-common.js` (네비/토스트/방향) | ~21 | — | `setupOrientationToggle`, `showOrientationToast` 등 소형부터 시작 권장 |

> **권장 순서**: 결합도가 낮고 상태가 명확한 것부터 — ①`ui-common`의 방향/토스트 소형 함수,
> ②`dashboard`, ③`calc-practice`, ④`daily-challenge`(dailyState 동반), ⑤`exam-sim`(simState 동반).
> 리더/퀴즈는 상태 공유가 많아 마지막에.

## 추출 절차 체크리스트

1. 대상 함수 묶음의 외부 의존성 확인: `sed -n 'A,Bp' src/app.js | grep -oE '\b(simState|dailyState|state|...)\b' | sort -u`
2. 전용 상태가 있으면 그 선언도 함께 이동, 없으면 함수만 이동.
3. 새 파일 상단에 역할 주석 + 전역 스코프 명시.
4. `index.html`에서 app.js **이전**에 `<script defer>`로 추가.
5. `node --check` 양쪽 → 브라우저 스모크(해당 탭 진입/문제풀이/렌더 확인).
6. 커밋은 **한 모듈씩** — 회귀 시 되돌리기 쉽게.
