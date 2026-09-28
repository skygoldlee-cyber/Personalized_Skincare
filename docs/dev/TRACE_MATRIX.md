# 🔗 TRACE MATRIX — 요구사양 추적 매트릭스

> **문서 ID**: DOC-DEV-04
> **관련 SPEC ID**: 해당 없음 (본 문서가 추적 산출물)
> ⚠️ 자동 생성 파일 — `npm run build:trace`로 재생성. 직접 편집 금지.
> 입력 해시: 75f67e7b424230ce
> 생성: 2026-09-28 · 원천: SPEC.md(351개 ID) + @spec 태그 + 문서 헤더

| 열 | 의미 | 원천 |
|----|------|------|
| 상태 | SPEC의 구현 상태 (✅·🟡·미구현 등) | SPEC.md 표 마지막 셀 |
| 검증 수단 | 파생 분류 — 테스트/도구 검증/구현(테스트 갭)/문서 검토 | 연결된 산출물 유형 |
| 문서 | 해당 요구사항을 다루는 문서 (DOC-ID) | 각 문서 헤더 "관련 SPEC ID" |
| 소스 | 구현 코드 파일 | `// @spec` 태그 |
| 테스트 | 검증 테스트 파일 | `// @spec` 태그 (tests/) |
| 보고서 | 분석·결과 보고서 | report_archive 헤더 |
| 출처 | 요구사항의 기원 (법령·시험 규정·사업 문서) | SPEC 부록 "요구사항 출처" 표 |

**커버리지 요약**: 요구사항 351개 — 문서 연결 224 · 소스 연결 330 · 테스트 연결 344 · 보고서 연결 109

---

## 3.1 대시보드

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| D-01 | ✅ | 테스트 | — | html/views/dashboard.html<br>index.html<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-02 | ✅ | 테스트 | — | src/app-dashboard.js<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-03 | ✅ | 테스트 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-04 | ✅ | 테스트 | — | src/app-dashboard.js<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-05 | ✅ | 테스트 | — | src/app-dashboard.js<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-06 | ✅ | 테스트 | — | src/app-dashboard.js<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-07 | ✅ | 테스트 | — | src/views/daily-challenge.js<br>src/views/dashboard.js | tests/dom/study-challenge.dom.test.js<br>tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-08 | ✅ | 테스트 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-09 | ✅ | 테스트 | — | css/dashboard.css<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-10 | ✅ | 테스트 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-11 | ✅ | 테스트 | — | src/recommendations.js<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-12 | ✅ | 테스트 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-13 | ✅ | 테스트 | — | src/recommendations.js<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-14 | ✅ | 테스트 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |
| D-15 | ✅ | 테스트 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 | — |

## 3.1.5 맞춤학습

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| AN-01 | ✅ | 테스트 | DOC-DSN-03 | html/views/analysis.html<br>index.html<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-09 | — |
| AN-02 | ✅ | 테스트 | DOC-DSN-03 | src/views/dashboard.js<br>src/views/quiz-wrong-cause.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-09 | — |
| AN-03 | ✅ | 테스트 | DOC-DSN-03 | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-09 | — |

## 3.2 플래시카드

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| F-01 | ✅ | 테스트 | DOC-REF-03 | css/study.css<br>html/views/flashcard.html<br>index.html<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |
| F-02 | ✅ | 테스트 | DOC-REF-03 | css/study.css<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |
| F-03 | ✅ | 테스트 | DOC-REF-03 | src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |
| F-04 | ✅ | 테스트 | DOC-REF-03 | src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |
| F-05 | ✅ | 테스트 | DOC-REF-03 | src/utils.js<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js<br>tests/unit/utils.test.js | DOC-ARC-05 | — |
| F-06 | ✅ | 테스트 | DOC-REF-03 | src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |
| F-07 | ✅ | 테스트 | DOC-REF-03 | src/spaced-repetition.js<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |
| F-08 | ✅ | 테스트 | DOC-REF-03 | src/spaced-repetition.js<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |
| F-09 | ✅ | 테스트 | DOC-REF-03 | src/spaced-repetition.js<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |
| F-10 | ✅ | 테스트 | DOC-REF-03 | src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 | — |

## 3.3 퀴즈

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| Q-01 | ✅ | 테스트 | DOC-REF-01 | html/views/quiz.html<br>index.html<br>src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-02 | ✅ | 테스트 | DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-03 | ✅ | 테스트 | DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-04 | ✅ | 테스트 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-05 | ✅ | 테스트 | DOC-DSN-04<br>DOC-REF-01 | src/utils.js<br>src/views/quiz.js | tests/dom/study-quiz.dom.test.js<br>tests/unit/utils.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-06 | ✅ | 테스트 | DOC-DSN-04<br>DOC-REF-01 | src/views/daily-challenge.js<br>src/views/quiz.js | tests/dom/study-challenge.dom.test.js<br>tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-07 | ✅ | 테스트 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-08 | ✅ | 테스트 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js<br>src/weak-items.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-09 | ✅ | 테스트 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-10 | ✅ | 테스트 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |
| Q-11 | ✅ | 테스트 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 | — |

## 3.4 모의고사

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| E-01 | ✅ | 테스트 | — | css/exam.css<br>html/views/exam.html<br>index.html<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 | 조제관리사 국가시험 형식 — 4과목 OMR·시간 제한 (한국산업인력공단 시행 규정) |
| E-02 | ✅ | 테스트 | — | src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 | — |
| E-03 | ✅ | 테스트 | — | src/views/exam-sim-state.js<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 | — |
| E-04 | ✅ | 테스트 | — | src/views/exam-sim-review.js<br>src/views/exam-sim-weak.js<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 | — |
| E-05 | ✅ | 테스트 | — | src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 | — |
| E-06 | ✅ | 테스트 | — | src/views/exam-sim-review.js<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 | — |
| E-07 | ✅ | 테스트 | — | css/exam.css<br>src/views/exam-sim-review.js<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 | 시험 합격 기준 — 과목별 40점 미만 과락·전 과목 평균 60점 이상 |

## 3.5 교재 리더

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| TR-01 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-03<br>DOC-REF-04<br>DOC-REF-05 | html/views/textbook-reader.html<br>index.html<br>src/markdown-parser.js<br>src/reader-format.js<br>…외 2개 | tests/dom/study-reader.dom.test.js<br>tests/unit/markdown-parser-general.test.js<br>tests/unit/reader-format-general.test.js<br>tests/unit/textbook-parser.test.js | — | — |
| TR-02 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-03 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-04 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-05 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-06 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | css/reader-mermaid.css<br>src/mermaid-render.js<br>src/mermaid-utils.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/mermaid-parser.test.js<br>tests/unit/mermaid-pipeline.test.js<br>tests/unit/mermaid-reader-format.test.js<br>…외 3개 | — | — |
| TR-07 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/mermaid-render.js<br>src/mermaid-utils.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/mermaid-parser.test.js<br>tests/unit/mermaid-pipeline.test.js<br>tests/unit/mermaid-reader-format.test.js<br>…외 3개 | — | — |
| TR-08 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/mermaid-render.js<br>src/mermaid-utils.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/mermaid-parser.test.js<br>tests/unit/mermaid-pipeline.test.js<br>tests/unit/mermaid-reader-format.test.js<br>…외 3개 | — | — |
| TR-09 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/markdown-parser.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/markdown-parser-general.test.js | — | — |
| TR-10 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/reader-ref-links.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-11 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-12 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-13 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-14 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-15 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | css/reader-extras.css<br>css/reader.css<br>src/views/reader-toolbar.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-16 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | css/reader-extras.css<br>css/reader.css<br>src/views/reader-toolbar.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-16a | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | src/views/reader-toolbar.js | tests/unit/content-engineering.test.js | — | — |
| TR-17 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | css/reader-extras.css<br>css/reader.css<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |
| TR-18 | ✅ | 테스트 | DOC-RBK-07<br>DOC-REF-05 | css/reader-extras.css<br>css/reader.css<br>src/views/reader-toolbar.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — | — |

## 3.6 교재 리더 — 학습 보조 도구

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| SA-01 | ✅ | 테스트 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — | — |
| SA-02 | ✅ | 테스트 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — | — |
| SA-03 | ✅ | 테스트 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — | — |
| SA-04 | ✅ | 테스트 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — | — |
| SA-05 | ✅ | 테스트 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — | — |

## 3.7 교재 리더 — 용어집

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| G-01 | ✅ | 테스트 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — | — |
| G-02 | ✅ | 테스트 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — | — |
| G-03 | ✅ | 테스트 | — | src/views/glossary-renderer.js<br>src/views/reader-ref-links.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — | — |
| G-04 | ✅ | 테스트 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — | — |
| G-05 | ✅ | 테스트 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — | — |
| G-06 | ✅ | 테스트 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — | — |
| G-07 | ✅ | 테스트 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — | — |
| G-08 | ✅ | 테스트 | — | src/glossary-query.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js<br>tests/unit/glossary-query.test.js | — | — |
| G-09 | ✅ | 테스트 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — | — |

## 3.8 교재 리더 — 참조자료 연결

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| RR-01 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-02 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/views/reader-ref-links.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-03 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/views/reader-ref-links.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-04 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/keyword-index.js<br>src/views/reader-ref-links.js<br>tools/build/build_keyword_index.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-05 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js<br>src/views/reader-ref-links.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-06 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js<br>src/views/reader-ref-links.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-07 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-08 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-09 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-10 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-11 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-12 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-13 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js<br>src/pdf-registry.js<br>tools/build/build_pdf_registry.js | tests/dom/common-htmlviewer.dom.test.js<br>tests/unit/pdf-registry.test.js | — | — |
| RR-14 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | css/print.css<br>src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-15 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | css/html-viewer.css<br>src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |
| RR-16 | ✅ | 테스트 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — | — |

## 3.9 교재 검색

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| TS-01 | ✅ | 테스트 | — | html/views/textbook.html<br>index.html<br>src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |
| TS-02 | ✅ | 테스트 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |
| TS-03 | ✅ | 테스트 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |
| TS-04 | ✅ | 테스트 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |
| TS-05 | ✅ | 테스트 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |
| TS-06 | ✅ | 테스트 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |
| TS-07 | ✅ | 테스트 | — | src/mermaid-render.js<br>src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |
| TS-08 | ✅ | 테스트 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |
| TS-09 | ✅ | 테스트 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — | — |

## 3.10 성분 사전

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| DI-01 | ✅ | 테스트 | — | html/views/dictionary.html<br>index.html<br>src/views/dictionary.js | tests/dom/study-dictionary.dom.test.js | — | — |
| DI-02 | ✅ | 테스트 | — | src/views/dictionary.js | tests/dom/study-dictionary.dom.test.js | — | — |
| DI-03 | ✅ | 테스트 | — | src/views/dictionary.js | tests/dom/study-dictionary.dom.test.js | — | — |

## 3.11 훈련소

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| T-01 | ✅ | 테스트 | — | html/views/trainer.html<br>index.html<br>src/trainer-calc.js<br>src/views/trainer-calc-practice.js<br>…외 1개 | tests/dom/study-trainer.dom.test.js<br>tests/unit/trainer-calc.test.js | DOC-ARC-05 | — |
| T-02 | ✅ | 테스트 | — | src/utils.js<br>src/views/trainer-ingredients.js<br>src/views/trainer.js | tests/dom/study-trainer.dom.test.js | DOC-ARC-05 | — |
| T-03 | ✅ | 테스트 | — | src/views/pomodoro.js<br>src/views/trainer.js | tests/dom/study-pomodoro.dom.test.js<br>tests/dom/study-trainer.dom.test.js | DOC-ARC-05 | — |
| T-04 | ✅ | 테스트 | — | css/trainer.css<br>src/scratchpad.js<br>src/views/trainer.js | tests/dom/common-scratchpad.dom.test.js<br>tests/dom/study-trainer.dom.test.js | DOC-ARC-05 | — |
| T-05 | ✅ | 테스트 | — | css/trainer.css<br>src/views/trainer-calc-practice.js<br>src/views/trainer.js | tests/dom/study-trainer.dom.test.js | DOC-ARC-05 | — |

## 3.12 오디오북

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| AO-01 | ✅ | 테스트 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | ref-pipeline/audiobook/generate_all_mp3.py<br>ref-pipeline/audiobook/run_pipeline.py<br>ref-pipeline/audiobook/tts_elevenlabs.py<br>ref-pipeline/audiobook/tts_google_direct.py<br>…외 1개 | tests/dom/reader-audio.dom.test.js | — | — |
| AO-02 | ✅ | 테스트 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | src/views/reader-audio.js | tests/dom/reader-audio.dom.test.js | — | — |
| AO-03 | ✅ | 테스트 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | src/views/reader-audio.js | tests/dom/reader-audio.dom.test.js | — | — |
| AO-04 | ✅ | 테스트 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | src/views/reader-audio.js | tests/dom/reader-audio.dom.test.js | — | — |
| AO-05 | ✅ | 테스트 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | src/views/reader-audio.js | tests/dom/reader-audio.dom.test.js | — | — |

## 3.13 데이터 백업/복원

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| B-01 | ✅ | 테스트 | — | src/views/backup.js | tests/dom/backup.dom.test.js | — | — |
| B-02 | ✅ | 테스트 | — | src/views/backup.js | tests/dom/backup.dom.test.js | — | — |
| B-03 | ✅ | 테스트 | — | src/views/backup.js | tests/dom/backup.dom.test.js | — | — |
| B-04 | ✅ | 테스트 | — | src/views/backup.js | tests/dom/backup.dom.test.js | — | — |

## 3.14 문제집 뷰어

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| EV-01 | ✅ | 테스트 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — | — |
| EV-02 | ✅ | 테스트 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — | — |
| EV-03 | ✅ | 테스트 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — | — |
| EV-04 | ✅ | 테스트 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — | — |
| EV-05 | ✅ | 테스트 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — | — |
| EV-06 | ✅ | 테스트 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — | — |
| EV-07 | ✅ | 테스트 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — | — |
| EV-08 | ✅ | 테스트 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — | — |

## 3.15 학습안내서/사용자매뉴얼 뷰어

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| MV-01 | ✅ | 테스트 | DOC-REF-04<br>DOC-USR-02<br>DOC-USR-07 | src/manual-viewer.js | tests/dom/study-manual.dom.test.js | — | — |
| MV-02 | ✅ | 테스트 | DOC-REF-04<br>DOC-USR-02<br>DOC-USR-07 | src/manual-viewer.js<br>src/mermaid-render.js | tests/dom/study-manual.dom.test.js | — | — |
| MV-03 | ✅ | 테스트 | DOC-REF-04<br>DOC-USR-02<br>DOC-USR-07 | src/manual-viewer.js | tests/dom/study-manual.dom.test.js | — | — |
| MV-04 | ✅ | 테스트 | DOC-REF-04<br>DOC-USR-02<br>DOC-USR-07 | src/manual-viewer.js<br>tools/build/build_doc_bundles.js | tests/dom/study-manual.dom.test.js | — | — |

## 3.16 차트 및 시각화

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| C-01 | ✅ | 테스트 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — | — |
| C-02 | ✅ | 테스트 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — | — |
| C-03 | ✅ | 테스트 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — | — |
| C-04 | ✅ | 테스트 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — | — |
| C-05 | ✅ | 테스트 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — | — |

## 3.17 콘텐츠 품질 감사

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| CQ-01 | ✅ | 테스트 | — | tools/check/audit_card_quality.js | tests/unit/audit-quality.test.js | — | — |
| CQ-02 | ✅ | 테스트 | — | tools/check/audit_card_quality.js | tests/unit/audit-quality.test.js | — | — |
| CQ-03 | ✅ | 테스트 | — | tools/check/audit_card_quality.js | tests/unit/audit-quality.test.js | — | — |
| CQ-04 | ✅ | 테스트 | — | tools/check/audit_card_quality.js | tests/unit/audit-quality.test.js | — | — |
| CQ-05 | ✅ | 테스트 | — | tools/check/audit_combo.js<br>tools/check/check_combo_pilot.js | tests/unit/audit-quality.test.js | — | — |

## 3.18 Formula OS — 실전 배합 작업실

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| FO-01 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/dom/formula-calc.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-02 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-check.js<br>src/views/formula.js | tests/unit/formula-check.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | 화장품 안전기준 등에 관한 규정(식약처고시 제2026-19호) — 원료별 사용 한도·금지 |
| FO-03 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/unit/formula-os.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-04 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/unit/formula-os.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-05 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-rules.js<br>src/views/formula-recommend.js<br>src/views/formula.js | tests/unit/formula-rules.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-06 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-rules.js<br>src/views/formula-recommend.js<br>src/views/formula.js | tests/unit/formula-rules.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-07 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/unit/formula-os.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-08 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-store.js<br>src/views/formula-recommend.js<br>src/views/formula.js | tests/unit/formula-store.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-09 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/unit/formula-os.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-10 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | css/formula.css<br>src/views/formula.js | tests/dom/review-drills-formula.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-11 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/dom/review-drills-formula.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-12 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-stability.js | tests/unit/formula-stability.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-13 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-stability.js | tests/unit/formula-stability.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-14 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-stability.js<br>src/views/formula-print.js | tests/unit/formula-stability.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | 화장품법 시행규칙 — 전성분 표기 순서 (1% 초과 내림차순 → 1% 이하 → 색소 최하단) |
| FO-15 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | css/formula.css<br>css/trainer.css<br>html/views/formula.html<br>index.html<br>…외 1개 | tests/dom/formula-nav.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-16 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/batch-store.js<br>src/store-utils.js<br>src/views/formula-batch.js | tests/dom/formula-batch.dom.test.js<br>tests/unit/batch-store.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | 화장품법·시행규칙 — 맞춤형화장품 판매업의 조제 기록 의무 |
| FO-17 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/customer-store.js<br>src/store-utils.js<br>src/views/formula-customer.js | tests/dom/formula-customer.dom.test.js<br>tests/unit/customer-store.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-18 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/material-ledger.js<br>src/store-utils.js<br>src/views/formula-material.js | tests/dom/formula-material.dom.test.js<br>tests/unit/material-ledger.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-19 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula-compliance.js | tests/dom/formula-compliance.dom.test.js<br>tests/unit/formula-compliance.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | 화장품법·시행규칙 전반 — 영업·자격·표시·기록 준수 의무 |
| FO-20 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/usage-guide.js | tests/unit/usage-guide.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-21 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | css/print.css<br>src/views/formula-print.js | tests/dom/formula-print.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | 화장품법 표시 규정 — 용기 라벨 기재사항·조제 기록지 |
| FO-22 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/csv-utils.js | tests/unit/csv-import.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | — |
| FO-23 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/batch-store.js<br>src/formula-store.js | tests/unit/batch-store.test.js<br>tests/unit/formula-store.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 | 사업 판단 — docs/dev/design/SUBSCRIPTION_ROADMAP.md |

## 3.19 계정·클라우드 동기화

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| AU-01 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09 | src/auth-view.js | tests/dom/common-auth.dom.test.js | — | — |
| AU-02 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09<br>DOC-RBK-06 | src/auth-view.js<br>src/supabase-client.js | tests/dom/common-auth.dom.test.js<br>tests/unit/supabase-client.test.js | — | — |
| AU-03 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09<br>DOC-RBK-06 | src/auth-view.js | tests/dom/common-auth.dom.test.js | — | — |
| AU-04 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09<br>DOC-RBK-06 | src/auth-view.js | tests/dom/common-auth.dom.test.js | — | — |
| AU-05 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09 | src/sync.js | tests/dom/common-sync.dom.test.js | — | — |
| AU-06 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09 | src/sync.js | tests/dom/common-sync.dom.test.js | — | — |
| AU-07 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09 | src/sync.js | tests/dom/common-sync.dom.test.js<br>tests/unit/storage-key-sync.test.js | — | 개인정보보호법 — 타인(고객) PII의 서버 저장 제한 원칙 |
| AU-08 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09 | src/auth-view.js<br>src/supabase-client.js<br>src/supabase-config.js<br>src/sync.js | tests/dom/common-auth.dom.test.js<br>tests/dom/common-sync.dom.test.js<br>tests/unit/supabase-client.test.js | — | — |

## 3.20 학습 캘린더·복습·드릴

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| DR-01 | ✅ | 테스트 | — | html/views/trainer.html<br>index.html<br>src/views/trainer-drills.js<br>tools/build/build_ox_drills.js<br>…외 1개 | tests/dom/study-trainer-drills.dom.test.js | DOC-ARC-05<br>DOC-ARC-09 | — |
| DR-02 | ✅ | 테스트 | DOC-DSN-04<br>DOC-RBK-02<br>DOC-REF-01 | src/views/trainer-drill-combo.js<br>src/views/trainer-drills.js<br>tools/build/build_combo_drills.js<br>tools/drill-utils.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/combo-transform.test.js | DOC-ARC-05<br>DOC-ARC-09 | — |
| DR-03 | ✅ | 테스트 | DOC-RBK-02<br>DOC-REF-01 | src/statement-tracker.js<br>src/views/trainer-drills.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/statement-tracker.test.js | DOC-ARC-05<br>DOC-ARC-09 | — |
| DR-04 | ✅ | 테스트 | DOC-RBK-02<br>DOC-REF-01 | src/statement-tracker.js<br>src/views/trainer-drills.js<br>src/weak-items.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/statement-tracker.test.js | DOC-ARC-05<br>DOC-ARC-09 | 법령·고시 수치 (드릴 콘텐츠의 기원 — 문항 자체는 내부 제작) |
| DR-05 | ✅ | 테스트 | DOC-RBK-02<br>DOC-REF-01 | src/statement-tracker.js<br>src/views/trainer-drills.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/statement-tracker.test.js | DOC-ARC-05<br>DOC-ARC-09 | — |
| DR-06 | ✅ | 테스트 | DOC-RBK-02<br>DOC-REF-01 | src/views/exam-simulator.js<br>src/views/trainer-drills.js | tests/dom/study-trainer-drills.dom.test.js | DOC-ARC-05<br>DOC-ARC-09 | — |
| DR-07 | ✅ | 테스트 | DOC-RBK-02<br>DOC-REF-01 | src/questions.js<br>src/views/trainer-drills.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/combo-transform.test.js<br>tests/unit/questions.test.js | DOC-ARC-05<br>DOC-ARC-09 | — |
| ND-01 | ✅ | 테스트 | DOC-USR-03<br>DOC-USR-04<br>DOC-USR-05<br>DOC-USR-06 | src/views/trainer-drills.js<br>src/views/trainer.js | tests/dom/review-drills-formula.dom.test.js | — | — |
| RV-01 | ✅ | 테스트 | — | html/views/review.html<br>index.html<br>src/views/quiz.js<br>src/views/trainer.js | tests/dom/review-drills-formula.dom.test.js | — | — |
| SC-01 | ✅ | 테스트 | — | css/study-calendar.css<br>html/views/calendar.html<br>index.html<br>src/views/study-calendar.js | tests/dom/study-calendar.dom.test.js | DOC-ARC-05 | — |
| SC-02 | ✅ | 테스트 | — | src/views/study-calendar.js | tests/dom/study-calendar.dom.test.js | DOC-ARC-05 | — |
| SC-03 | ✅ | 테스트 | — | src/study-tracker.js | tests/unit/study-tracker.test.js | DOC-ARC-05 | — |

## 3.21 UI 모드 전환

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| UM-01 | ✅ | 테스트 | DOC-DSN-01<br>DOC-DSN-02 | src/ui-mode.js | tests/dom/common-uimode.dom.test.js | DOC-ARC-06 | — |
| UM-02 | ✅ | 테스트 | DOC-DSN-01<br>DOC-DSN-02 | src/ui-mode.js | tests/dom/common-uimode.dom.test.js | DOC-ARC-06 | — |
| UM-03 | ✅ | 테스트 | DOC-DSN-01<br>DOC-DSN-02 | src/ui-mode.js | tests/dom/common-uimode.dom.test.js | DOC-ARC-06 | — |
| UM-04 | ✅ | 테스트 | DOC-DSN-01<br>DOC-DSN-02 | src/router.js<br>src/ui-mode.js | tests/dom/common-uimode.dom.test.js<br>tests/dom/router.dom.test.js | DOC-ARC-06 | — |
| UM-05 | ✅ | 테스트 | DOC-DSN-01<br>DOC-DSN-02 | src/ui-mode.js | tests/dom/common-uimode.dom.test.js | DOC-ARC-06 | — |

## 3.22 시험 선택·전환

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| ES-01 | ✅ | 테스트 | — | html/views/exam-select.html<br>index.html<br>src/app-dashboard.js<br>src/exam-context.js<br>…외 1개 | tests/dom/study-examselect.dom.test.js<br>tests/unit/exam-context.test.js | DOC-ARC-07 | — |
| ES-02 | ✅ | 테스트 | — | src/app-shell.js<br>src/exam-context.js<br>src/views/exam-select.js | tests/dom/study-examselect.dom.test.js<br>tests/unit/exam-context.test.js | DOC-ARC-07 | — |
| ES-03 | ✅ | 테스트 | — | src/app-shell.js<br>src/exam-context.js<br>src/views/exam-select.js | tests/dom/study-examselect.dom.test.js<br>tests/unit/exam-context.test.js | DOC-ARC-07 | — |
| ES-04 | ✅ | 테스트 | — | src/exam-context.js | tests/unit/exam-context.test.js | DOC-ARC-07 | — |
| ES-05 | ✅ | 테스트 | — | src/exam-context.js | tests/unit/exam-context.test.js | DOC-ARC-07 | — |

## 3.23 사용자 의견 수신

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| FB-01 | ✅ | 테스트 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — | 사업 판단 — docs/dev/design/USER_FEEDBACK_DESIGN.md (유튜브 유입 대응) |
| FB-02 | ✅ | 테스트 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — | 사업 판단 — docs/dev/design/USER_FEEDBACK_DESIGN.md (유튜브 유입 대응) |
| FB-03 | ✅ | 테스트 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — | 사업 판단 — docs/dev/design/USER_FEEDBACK_DESIGN.md (유튜브 유입 대응) |
| FB-04 | ✅ | 테스트 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — | 사업 판단 — docs/dev/design/USER_FEEDBACK_DESIGN.md (유튜브 유입 대응) |
| FB-05 | ✅ | 테스트 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — | 사업 판단 — docs/dev/design/USER_FEEDBACK_DESIGN.md (유튜브 유입 대응) |
| FB-06 | ✅ | 테스트 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — | 사업 판단 — docs/dev/design/USER_FEEDBACK_DESIGN.md (유튜브 유입 대응) |
| FB-07 | ✅ | 테스트 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — | 사업 판단 — docs/dev/design/USER_FEEDBACK_DESIGN.md (유튜브 유입 대응) |
| FB-08 | ✅ (코드) / ⚙️ (대시보드 설정 필요) | 테스트 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js<br>tools/supabase/functions/feedback-notify/index.ts | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — | 사업 판단 — docs/dev/design/USER_FEEDBACK_DESIGN.md (유튜브 유입 대응) |

## 4.1 PWA & 오프라인

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| P-01 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | sw.js | tests/unit/pwa-sw.test.js | — | — |
| P-02 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | src/config/cache.js<br>sw.js | tests/unit/pwa-sw.test.js | — | — |
| P-03 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | sw.js | tests/unit/pwa-sw.test.js | — | — |
| P-04 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | sw.js | tests/unit/pwa-sw.test.js | — | — |
| P-04a | ✅ | 테스트 | DOC-RBK-01 | css/app-responsive.css | tests/unit/pwa-sw.test.js | — | — |
| P-05 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | sw.js<br>tools/build/stamp_sw_version.js | tests/unit/pwa-sw.test.js | — | — |
| P-06 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | sw.js | tests/unit/pwa-sw.test.js<br>tests/unit/sw-prune.test.js | — | — |
| P-07 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | css/app-responsive.css<br>src/pwa-install-capture.js<br>src/pwa-install.js | tests/unit/pwa-sw.test.js | — | — |
| P-08 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | src/app-shell.js<br>src/pwa-install.js | tests/unit/pwa-sw.test.js | — | — |
| P-09 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | src/pwa-install.js | tests/unit/pwa-sw.test.js | — | — |
| P-10 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | src/pwa-manifest.js | tests/unit/pwa-sw.test.js | — | — |
| P-11 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | src/app-fallback.js | tests/unit/pwa-sw.test.js | — | — |
| P-12 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | tools/check/verify_shell_assets.js | tests/unit/pwa-sw.test.js | — | — |
| P-13 | ✅ | 테스트 | DOC-RBK-01<br>DOC-RBK-04 | src/app-version.js<br>src/whats-new.js<br>tools/build/stamp_release_notes.js | tests/dom/whats-new.dom.test.js<br>tests/unit/whats-new.test.js | — | — |

## 4.2 오프라인 감지

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| O-01 | ✅ | 테스트 | — | css/app-responsive.css<br>src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — | — |
| O-02 | ✅ | 테스트 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — | — |
| O-03 | ✅ | 테스트 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — | — |
| O-04 | ✅ | 테스트 | — | src/app-shell.js<br>sw.js | tests/dom/common-offline.dom.test.js | — | — |
| O-05 | ✅ | 테스트 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — | — |
| O-06 | ✅ | 테스트 | — | src/config/timing.js<br>src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — | — |
| O-07 | ✅ | 테스트 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — | — |

## 4.3 보안

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| S-01 | ✅ | 테스트 | DOC-DSN-08<br>DOC-DSN-09 | index.html<br>tools/build/build_html.js | tests/unit/security.test.js | — | — |
| S-02 | ✅ | 테스트 | — | src/app.js<br>src/views/event-listeners.js | tests/dom/common-eventlisteners.dom.test.js | — | — |
| S-03 | ✅ | 테스트 | — | src/app.js<br>src/views/event-listeners.js | tests/dom/common-eventlisteners.dom.test.js | — | — |
| S-04 | ✅ | 테스트 | — | — | tests/unit/delegation-guard.test.js | — | — |
| S-05 | ✅ | 테스트 | — | src/sanitize.js | tests/unit/sanitize.test.js | — | — |
| S-06 | ✅ | 테스트 | — | src/storage-keys.js<br>src/views/backup.js | tests/dom/backup.dom.test.js | — | — |
| S-07 | ✅ | 테스트 | — | index.html | tests/unit/security.test.js | — | — |
| S-08 | ✅ | 테스트 | — | src/app.js | tests/unit/security.test.js | — | — |

## 4.4 성능

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| PF-01 | ✅ | 테스트 | — | src/data-loader.js | tests/unit/perf-invariants.test.js | — | — |
| PF-02 | ✅ | 테스트 | — | src/data-loader.js | tests/unit/perf-invariants.test.js | — | — |
| PF-03 | ✅ | 테스트 | — | src/data-loader.js | tests/unit/perf-invariants.test.js | — | — |
| PF-04 | ✅ | 테스트 | — | src/html-viewer.js | tests/unit/perf-invariants.test.js | — | — |
| PF-05 | ✅ | 테스트 | — | src/html-viewer.js | tests/unit/perf-invariants.test.js | — | — |
| PF-06 | ✅ | 테스트 | — | src/html-viewer.js | tests/unit/perf-invariants.test.js | — | — |
| PF-07 | ✅ | 테스트 | — | src/data-loader.js<br>src/views/dashboard.js | tests/unit/perf-invariants.test.js | — | — |
| PF-08 | ✅ | 테스트 | — | src/views/textbook-search.js | tests/unit/perf-invariants.test.js | — | — |
| PF-09 | ✅ | 테스트 | — | src/views/dictionary.js | tests/unit/perf-invariants.test.js | — | — |
| PF-10 | ✅ | 테스트 | — | src/app.js | tests/unit/perf-invariants.test.js | — | — |
| PF-11 | ✅ | 테스트 | — | ref-pipeline/convert.py<br>ref-pipeline/pdf2md.py | tests/unit/perf-invariants.test.js | — | — |
| PF-12 | ✅ | 테스트 | — | src/keyword-index.js<br>tools/build/build_keyword_index.js | tests/unit/perf-invariants.test.js | — | — |
| PF-13 | ✅ | 테스트 | — | src/mermaid-render.js | tests/unit/perf-invariants.test.js | — | — |
| PF-14 | ✅ | 테스트 | — | css/base.css | tests/unit/perf-invariants.test.js | — | — |
| PF-15 | ✅ | 테스트 | — | ref-pipeline/convert.py | tests/unit/perf-invariants.test.js | — | — |
| PF-16 | ✅ | 테스트 | — | src/mermaid-render.js | tests/unit/perf-invariants.test.js | — | — |

## 4.5 접근성

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| A-01 | ✅ | 테스트 | DOC-DSN-01 | index.html | tests/dom/common-a11y.dom.test.js | — | — |
| A-02 | ✅ | 테스트 | DOC-DSN-01 | src/views/flashcard.js | tests/dom/common-a11y.dom.test.js | — | — |
| A-03 | ✅ | 테스트 | DOC-DSN-01 | css/base.css | tests/dom/common-a11y.dom.test.js | — | — |
| A-04 | ✅ | 테스트 | DOC-DSN-01 | css/base.css | tests/dom/common-a11y.dom.test.js | — | — |
| A-05 | ✅ | 테스트 | DOC-DSN-01 | css/base.css<br>css/ui-overlay.css | tests/dom/common-a11y.dom.test.js | — | — |
| A-06 | ✅ | 테스트 | DOC-DSN-01 | css/base.css<br>css/study.css | tests/dom/common-a11y.dom.test.js | — | — |
| A-07 | ✅ | 테스트 | DOC-DSN-01 | src/ui-utils.js | tests/dom/common-a11y.dom.test.js | — | — |

## 4.6 반응형 & 모바일

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| R-01 | ✅ | 테스트 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — | — |
| R-02 | ✅ | 테스트 | DOC-DSN-01 | css/base.css | tests/dom/common-navigation.dom.test.js | — | — |
| R-03 | ✅ | 테스트 | DOC-DSN-01 | css/base.css | tests/dom/common-navigation.dom.test.js | — | — |
| R-04 | ✅ | 테스트 | DOC-DSN-01 | src/views/navigation.js | tests/dom/common-navigation.dom.test.js | — | — |
| R-05 | ✅ | 테스트 | DOC-DSN-01 | css/dashboard.css | tests/dom/common-navigation.dom.test.js | — | — |
| R-06 | ✅ | 테스트 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — | — |
| R-07 | ✅ | 테스트 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — | — |
| R-08 | ✅ | 테스트 | DOC-DSN-01 | src/app-shell.js | tests/dom/common-navigation.dom.test.js | — | — |
| R-09 | ✅ | 테스트 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — | — |

## 4.7 테마 시스템

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| TH-01 | ✅ | 테스트 | DOC-DSN-01 | css/base.css<br>css/reader-extras.css<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — | — |
| TH-02 | ✅ | 테스트 | DOC-DSN-01 | css/base.css<br>index.html<br>src/theme-init.js<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — | — |
| TH-03 | ✅ | 테스트 | DOC-DSN-01 | css/base.css<br>src/theme-init.js<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — | — |
| TH-04 | ✅ | 테스트 | DOC-DSN-01 | css/base.css<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — | — |
| TH-05 | ✅ | 테스트 | DOC-DSN-01 | css/base.css<br>css/reader-extras.css<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — | — |
| TH-06 | ✅ | 테스트 | DOC-DSN-01 | css/base.css<br>css/reader-mermaid.css<br>src/mermaid-utils.js | tests/dom/common-theme.dom.test.js<br>tests/unit/mermaid-utils.test.js | — | — |

## 4.8 UI/UX 설계 요구사양

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| UX-FB-01 | `@media (max-width: 768px) { #app-toast { top:auto; bottom: calc(80px + safe-area) } }` — 하단 탭 바 위 | 테스트 | — | css/ui-overlay.css<br>src/ui-utils.js | tests/unit/ux-invariants.test.js | — | — |
| UX-FB-02 | 네이티브 대화상자는 PWA 설치 흐름을 깨고 스타일 제어 불가. 커스텀 모달은 포커스 트랩 + Escape + 배경 클릭 닫기 포함 | 테스트 | — | css/ui-overlay.css<br>src/ui-utils.js | tests/unit/ux-invariants.test.js | — | — |
| UX-FB-03 | `animationend` 리스너로 클래스 해제 — `display:none` 상태에서는 애니메이션이 안 돌아 첫 실제 표시에 실행됨. `prefers-reduced-motion`에서는 자동으로 0.01ms 처리됨 | 테스트 | — | css/ui-overlay.css<br>src/ui-utils.js | tests/unit/ux-invariants.test.js | — | — |
| UX-FB-04 | 부분 스켈레톤보다 구현 비용이 낮고 일관됨 | 테스트 | — | css/ui-overlay.css<br>src/ui-utils.js | tests/unit/ux-invariants.test.js | — | — |
| UX-FORM-01 | 16px 미만이면 iOS Safari가 포커스 시 자동 확대 | 테스트 | — | css/reader.css | tests/unit/ux-invariants.test.js | — | — |
| UX-FORM-02 | 모바일에서 물리적 눌림감 제공 | 테스트 | — | css/base.css | tests/unit/ux-invariants.test.js | — | — |
| UX-NAV-01 | 한 번에 하나의 네비게이션만 노출 — 중복 방지. 하단 탭 바는 엄지 도달권, 가로 스크롤 + 양끝 그림자 힌트(`background-attachment: local, local, scroll, scroll` 기법)로 더 있음을 표시 | 테스트 | DOC-DSN-01 | css/app-responsive.css<br>src/app.js<br>src/router.js | tests/dom/common-navigation.dom.test.js<br>tests/dom/router.dom.test.js | — | — |
| UX-NAV-02 | 스크롤 중에도 설정·테마에 접근 가능. 단, 부모가 스크롤 컨테이너(`overflow-y: auto`)일 때만 작동 — `body` 스크롤 구조면 의도대로 동작하는지 확인할 것 | 테스트 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — | — |
| UX-NAV-03 | 드롭다운은 절대위치로 헤더 경계를 넘어야 함. 넘침 제어는 `min-width:0`+말줄임과 `flex-shrink:0`으로 처리 | 테스트 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — | — |
| UX-NAV-04 | `.app-container { width: 100% }`. 특히 클래식 스크롤바가 상시 표시되는 데스크톱에서 차이 발생 | 테스트 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — | — |
| UX-NAV-05 | back-to-top(`bottom:1.25rem`)이 탭 바(z 1400)에 완전히 가려진 실제 사례. 배너·토스트·플로팅 버튼 신규 추가 시에도 동일 규칙 적용. `.main-content`는 `padding-bottom: calc(80px + safe)` + `scroll-padding-bottom`으로 콘텐츠·포커스 요소 보호 | 테스트 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — | — |
| UX-NAV-06 | `searchAll()`은 소스 주입 가능한 순수 함수로 분리해 테스트 가능. 실행은 기존 경로 재사용(nav 클릭 시뮬레이션, `startSubjectStudy/Quiz`, `openSubjectChapter`, `ExamViewer.openExam`) — 네비게이션 분기 신설 금지. 뷰 목록은 nav-item DOM 스캔이라 feature 게이팅(`is-hidden`)을 자동 반영. z-index 2500 (탭 바·모달 위). 전 소스 로컬 데이터로 오프라인 동작 | 테스트 | DOC-DSN-01 | src/command-palette.js | tests/dom/common-navigation.dom.test.js<br>tests/dom/study-commandpalette.dom.test.js<br>tests/unit/command-palette.test.js | — | — |
| UX-NAV-07 | 내비게이션(사이드바·탭 바·뒤로가기)은 사용자의 이전 위치를 보존하는 게 기대 동작이지만, "맞춤 리포트 보기"·"퀴즈 풀기" 같은 액션 버튼이 이전 스크롤을 복원하면 중간에서 열려 맥락을 잃는다. `restoreScrollPosition`의 `pendingTop` 플래그가 복원 시점에 소비되어 `saveScrollPosition` 덮어쓰기와 무관하게 동작. 새 액션 딥링크 추가 시 `scrollTop: true` 필수 — `data-args='["view-id", {"scrollTop": true}]'` 또는 직접 호출 모두 지원 | 테스트 | DOC-DSN-01 | src/views/navigation.js | tests/dom/common-navigation.dom.test.js | — | — |
| UX-PWA-01 | 모바일 OS(Android/iOS)는 웹의 자체 종료를 차단 — 프로그래밍으로 완전 종료 불가. 데스크톱 설치 PWA는 `close()`가 동작하므로 모바일 안내는 불필요. 차단되면 "최근 앱 목록에서 밀어 닫으세요"(터치)/"창을 닫아주세요"(데스크톱) 안내 화면으로 대체하는 것이 최선 | 테스트 | — | src/app.js | tests/unit/ux-invariants.test.js | — | — |
| UX-PWA-02 | 브라우저 탭에서 의미 없는 버튼(앱 종료 등)을 숨겨 혼란 방지. iOS는 `navigator.standalone`만 지원하므로 둘 다 확인 필수 | 테스트 | — | src/pwa-install.js | tests/unit/ux-invariants.test.js | — | — |
| UX-PWA-03 | "배포했는데 안 바뀐다" 보고의 대부분이 이 패턴. 사용자 안내 문구와 업데이트 토스트 필수 | 테스트 | — | sw.js | tests/unit/ux-invariants.test.js | — | — |
| UX-PWA-04 | 미설치 상태에서만 노출, 설치 후 자동 숨김 — 헤더 공간 절약 | 테스트 | — | src/pwa-install.js | tests/unit/ux-invariants.test.js | — | — |
| UX-PWA-05 | PWA 콜드 스타트에서 `dvh`가 실제 화면보다 크게 측정되면 `.main-content` 끝이 화면 밖으로 밀려 스크롤 끝 콘텐츠가 탭 바에 가려짐(대시보드 '내 학습 분석·도구' 실제 장애). JS 미실행 시 `100dvh` 폴백 | 테스트 | — | src/app.js | tests/unit/ux-invariants.test.js | — | — |
| UX-SCR-01 | `@media (pointer: coarse), (max-width: 900px) { * { scrollbar-width: none } ::-webkit-scrollbar { width:0; height:0 } }` — `pointer: coarse`만 믿지 말고 폭 기준을 병기할 것(일부 기기에서 pointer 감지 실패 사례 있음). 모바일 스크롤바는 드래그용이 아니므로 위치 표시도 불필요 | 테스트 | — | css/reader.css<br>src/views/reader-toolbar.js | tests/unit/ux-invariants.test.js | — | — |
| UX-SCR-02 | `*` 또는 개별 컨테이너에 지정 | 테스트 | — | css/reader.css | tests/unit/ux-invariants.test.js | — | — |
| UX-SCR-03 | 하드코딩 색상은 다크/라이트 한쪽에서 묻힘 (실제로 미정의 변수 폴백으로 라이트 배경에 흰 카드가 되는 사고 있었음 — `.comp-item` 사례) | 테스트 | — | css/reader.css | tests/unit/ux-invariants.test.js | — | — |
| UX-SET-01 | 헤더에 아이콘 버튼을 늘리면 모바일에서 제목과 경쟁. 자주 쓰지 않는 토글(가로/세로 보기 등)은 설정 안으로 이동 | 테스트 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — | — |
| UX-SET-02 | 항목이 늘어나도 뷰포트를 넘지 않음. 없으면 소형 기기에서 하단 항목이 잘림 | 테스트 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — | — |
| UX-SET-03 | Apple HIG/Google Material 최소 터치 영역 | 테스트 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — | — |
| UX-SET-04 | 사용자가 "몇 버전인지" 문의할 때 유일한 확인 경로. SW 등록 스크립트 URL에서 버전 자동 추출 | 테스트 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — | — |
| UX-SET-05 | 일관된 드롭다운 UX | 테스트 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — | — |

## 5.1 데이터 아키텍처

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| DA-01 | ✅ | 테스트 | DOC-RBK-03<br>DOC-RBK-08 | tools/build/index.js<br>tools/build/manifest_loader.js | tests/unit/data-architecture.test.js | — | — |
| DA-02 | ✅ | 테스트 | DOC-RBK-03 | src/data-loader.js<br>tools/build/index.js | tests/unit/data-architecture.test.js | — | — |
| DA-03 | ✅ | 테스트 | DOC-RBK-03 | src/data-loader.js | tests/unit/data-loader.test.js | — | — |
| DA-04 | ✅ | 테스트 | DOC-RBK-03 | tools/build/build_study_md_bundle.js | tests/unit/data-architecture.test.js | — | — |
| DA-05 | ✅ | 테스트 | DOC-RBK-03 | src/state.js<br>src/storage.js | tests/unit/state.test.js | — | — |
| DA-06 | ✅ | 테스트 | DOC-RBK-03 | src/exam-context.js<br>src/paths.js<br>src/pwa-manifest.js<br>tools/build/exam_targets.js | tests/unit/data-architecture.test.js | — | — |
| DA-07 | ✅ | 테스트 | DOC-RBK-03 | src/exam-context.js<br>src/storage-keys.js<br>src/storage.js | tests/unit/storage-key-sync.test.js | — | — |
| DA-08 | ✅ | 테스트 | DOC-DSN-08<br>DOC-RBK-03 | src/exam-context.js | tests/unit/data-architecture.test.js | — | — |
| DA-09 | ✅ | 테스트 | DOC-RBK-03 | src/storage.js | tests/unit/storage.test.js | — | — |
| DA-10 | ✅ | 테스트 | — | src/customer-store.js<br>src/sync.js | tests/unit/customer-store.test.js | — | 개인정보보호법 — 상동 (조제관리사가 고객 개인정보를 클라우드에 올리지 않는 설계) |

## 5.2 안정적 ID 체계

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| ID-01 | ✅ | 테스트 | DOC-DSN-04<br>DOC-RBK-08<br>DOC-REF-03<br>DOC-REF-05 | src/sha256.js<br>tools/build/id_factory.js | tests/unit/id-factory.test.js<br>tests/unit/sha256.test.js | — | — |
| ID-02 | ✅ | 테스트 | DOC-DSN-04<br>DOC-RBK-08<br>DOC-REF-03<br>DOC-REF-05 | src/sha256.js<br>tools/build/id_factory.js | tests/unit/id-factory.test.js<br>tests/unit/sha256.test.js | — | — |
| ID-03 | ✅ | 테스트 | DOC-DSN-04<br>DOC-RBK-08<br>DOC-REF-03<br>DOC-REF-05 | tools/build/id_factory.js | tests/unit/id-factory.test.js | — | — |
| ID-04 | ✅ | 테스트 | DOC-DSN-04<br>DOC-RBK-08<br>DOC-REF-03<br>DOC-REF-05 | tools/build/build_id_migration.js<br>tools/build/id_factory.js | tests/unit/id-factory.test.js | — | — |

## 5.3 빌드 파이프라인

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| BP-01 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/build_all_data.js<br>tools/build/build_audio_manifest.js<br>tools/build/build_combo_drills.js<br>tools/build/build_doc_bundles.js<br>…외 19개 | tests/unit/build-pipeline.test.js | — | — |
| BP-02 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/index.js<br>tools/build/schema.js<br>tools/check/check_imports.js | tests/unit/build-pipeline.test.js | — | — |
| BP-03 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/index.js<br>tools/build/manifest_loader.js<br>tools/check/check_manifest.js | tests/unit/build-pipeline.test.js | — | — |
| BP-04 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/build_exam_bundles.js<br>tools/build/index.js | tests/unit/build-pipeline.test.js | — | — |
| BP-05 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/check/check_parser_parity.js | tests/unit/build-pipeline.test.js | — | — |
| BP-06 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/build_keyword_index.js | tests/unit/build-pipeline.test.js | — | — |
| BP-07 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/stamp_release_notes.js<br>tools/build/stamp_sw_version.js<br>tools/deploy.js | tests/unit/build-pipeline.test.js | — | — |
| BP-08 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/check/audit_card_quality.js | tests/unit/build-pipeline.test.js | — | — |

## 5.4 콘텐츠 구조

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| CS-01 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/batch_convert.py<br>ref-pipeline/md2doc.py<br>tools/build/build_study_md_bundle.js<br>tools/build/plugins/textbook.plugin.js<br>…외 1개 | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-02 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | tools/build/index.js<br>tools/build/plugins/exams.plugin.js | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-03 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/check_laws.py<br>ref-pipeline/convert.py<br>ref-pipeline/pdf2md.py<br>tools/check/check_ref_freshness.js<br>…외 2개 | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-04 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | tools/build/index.js<br>tools/build/plugins/ingredients.plugin.js | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-05 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/batch_convert.py<br>ref-pipeline/md2doc.py | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-06 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | tools/build/build_keyword_index.js | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-07 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/audiobook/cleanup_empty_mp3.py<br>ref-pipeline/audiobook/generate_all_mp3.py<br>ref-pipeline/audiobook/md_chunker.py<br>ref-pipeline/audiobook/mp3_merger.py<br>…외 6개 | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-08 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | tools/build/build_study_md_bundle.js | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-09 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/convert.py<br>tools/check/check_ref_subjects.js<br>tools/check/check_reflayout.js<br>tools/check/check_refmerge.js | tests/unit/content-structure.test.js | DOC-ARC-08 | — |
| CS-10 | ✅ | 테스트 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/convert.py<br>ref-pipeline/pdf2md.py | tests/unit/content-structure.test.js | DOC-ARC-08 | — |

## 5.5 교재 콘텐츠 학습 보조 요소

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| CE-01 | ✅ | 테스트 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — | — |
| CE-02 | ✅ | 테스트 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — | — |
| CE-03 | ✅ | 테스트 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — | — |
| CE-04 | ✅ | 테스트 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — | — |
| CE-05 | ✅ | 테스트 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — | — |

## 5.6 이야기형 교재 서사 구조

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| ST-01 | ✅ | 테스트 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — | — |
| ST-02 | ✅ | 테스트 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — | — |
| ST-03 | ✅ | 테스트 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — | — |
| ST-04 | ✅ | 테스트 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — | — |
| ST-05 | ✅ | 테스트 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — | — |
| ST-06 | ✅ | 테스트 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — | — |
| ST-07 | ✅ | 테스트 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — | — |

## 7.2 유료화 인프라

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| ROAD-P0 | ✅ | 테스트 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 4개 | src/pro-upgrade.js | tests/dom/pro-plan.dom.test.js<br>tests/unit/learning-pro.test.js | DOC-ARC-01<br>DOC-ARC-03<br>DOC-ARC-06 | — |
| ROAD-P1 | 미구현 (유일한 Phase 1~2 잔여) | 문서 검토 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 2개 | — | — | DOC-ARC-01<br>DOC-ARC-03<br>DOC-ARC-06 | 사업 문서 — docs/report_archive/FEATURE_PROPOSALS.md · SUBSCRIPTION_ROADMAP.md |
| ROAD-P2 | 미구현 | 문서 검토 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 2개 | — | — | DOC-ARC-01<br>DOC-ARC-03<br>DOC-ARC-06 | 사업 문서 — docs/report_archive/FEATURE_PROPOSALS.md · SUBSCRIPTION_ROADMAP.md |
| ROAD-P3 | 미구현 | 문서 검토 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 2개 | — | — | DOC-ARC-01<br>DOC-ARC-02<br>DOC-ARC-03<br>DOC-ARC-06 | 사업 문서 — docs/report_archive/FEATURE_PROPOSALS.md · SUBSCRIPTION_ROADMAP.md |
| ROAD-P4 | ✅ 결정·게이트 구현 | 테스트 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 2개 | src/sync.js | tests/dom/common-sync.dom.test.js | DOC-ARC-01<br>DOC-ARC-03<br>DOC-ARC-06<br>DOC-ARC-07 | 사업 문서 — docs/report_archive/FEATURE_PROPOSALS.md · SUBSCRIPTION_ROADMAP.md |

## 7.3 Learning Pro 잔여·차별화

| ID | 상태 | 검증 수단 | 문서 | 소스 | 테스트 | 보고서 | 출처 |
|----|------|-----------|------|------|--------|--------|------|
| ROAD-L1 | 🟡 부분 (예상 점수만) | — | — | — | — | — | 사업 문서 — docs/report_archive/PRO_MULTI_EXAM_EVALUATION.md · FEATURE_PROPOSALS.md |
| ROAD-L2 | 미구현 | — | — | — | — | — | 사업 문서 — docs/report_archive/PRO_MULTI_EXAM_EVALUATION.md · FEATURE_PROPOSALS.md |
| ROAD-L3 | 미구현 | — | — | — | — | — | 사업 문서 — docs/report_archive/PRO_MULTI_EXAM_EVALUATION.md · FEATURE_PROPOSALS.md |
| ROAD-L4 | 미구현 | — | — | — | — | — | 사업 문서 — docs/report_archive/PRO_MULTI_EXAM_EVALUATION.md · FEATURE_PROPOSALS.md |
| ROAD-L5 | ✅ 카운터 구현 (판정 데이터 수집 중) | 테스트 | — | src/usage-stats.js | tests/dom/usage-stats.dom.test.js | — | 사업 문서 — docs/report_archive/PRO_MULTI_EXAM_EVALUATION.md · FEATURE_PROPOSALS.md |

---

## 부록 A — 문서 → 요구사양 역방향 매핑

| 문서 ID | 파일 | 관련 SPEC ID |
|---------|------|--------------|
| DOC-ARC-01 | docs/report_archive/Cosmetic Master Business Plan.md | FO-01, FO-02, FO-03, FO-04, FO-05, FO-06, FO-07, FO-08, FO-09, FO-10, FO-11, FO-12, FO-13, FO-14, FO-15, FO-16, FO-17, FO-18, FO-19, FO-20, FO-21, FO-22, FO-23, ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4 |
| DOC-ARC-02 | docs/report_archive/EXTERNAL_REVIEW_LEARNING_PRO.md | ROAD-P3 |
| DOC-ARC-03 | docs/report_archive/FEATURE_PROPOSALS.md | ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4 |
| DOC-ARC-04 | docs/report_archive/FORMULA_OS_DESIGN.md | FO-01, FO-02, FO-03, FO-04, FO-05, FO-06, FO-07, FO-08, FO-09, FO-10, FO-11, FO-12, FO-13, FO-14, FO-15, FO-16, FO-17, FO-18, FO-19, FO-20, FO-21, FO-22, FO-23 |
| DOC-ARC-05 | docs/report_archive/PASS_CORE_LOOP_REVIEW.md | D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, DR-01, DR-02, DR-03, DR-04, DR-05, DR-06, DR-07, E-01, E-02, E-03, E-04, E-05, E-06, E-07, F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-10, Q-01, Q-02, Q-03, Q-04, Q-05, Q-06, Q-07, Q-08, Q-09, Q-10, Q-11, SC-01, SC-02, SC-03, T-01, T-02, T-03, T-04, T-05 |
| DOC-ARC-06 | docs/report_archive/PASS_TO_PRACTICE_STRATEGY.md | FO-01, FO-02, FO-03, FO-04, FO-05, FO-06, FO-07, FO-08, FO-09, FO-10, FO-11, FO-12, FO-13, FO-14, FO-15, FO-16, FO-17, FO-18, FO-19, FO-20, FO-21, FO-22, FO-23, ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4, UM-01, UM-02, UM-03, UM-04, UM-05 |
| DOC-ARC-07 | docs/report_archive/PRO_MULTI_EXAM_EVALUATION.md | ES-01, ES-02, ES-03, ES-04, ES-05, ROAD-P4 |
| DOC-ARC-08 | docs/report_archive/법령최신확인결과.md | CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10 |
| DOC-ARC-09 | docs/report_archive/오답위험_분석보고서.md | AN-01, AN-02, AN-03, DR-01, DR-02, DR-03, DR-04, DR-05, DR-06, DR-07, Q-01, Q-02, Q-03, Q-04, Q-05, Q-06, Q-07, Q-08, Q-09, Q-10, Q-11 |
| DOC-ARC-10 | docs/report_archive/출제비중기반학습방법.md | D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, E-01, E-02, E-03, E-04, E-05, E-06, E-07 |
| DOC-ARC-11 | docs/report_archive/출제비중분포조사결과.md | E-01, E-02, E-03, E-04, E-05, E-06, E-07, Q-01, Q-02, Q-03, Q-04, Q-05, Q-06, Q-07, Q-08, Q-09, Q-10, Q-11 |
| DOC-BIZ-01 | docs/business/FORMULA_OS_경쟁전략.md | FO-01, FO-02, FO-03, FO-04, FO-05, FO-06, FO-07, FO-08, FO-09, FO-10, FO-11, FO-12, FO-13, FO-14, FO-15, FO-16, FO-17, FO-18, FO-19, FO-20, FO-21, FO-22, FO-23, ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4 |
| DOC-BIZ-02 | docs/business/맞춤형화장품_조제관리사_자격증플랫폼_사업기획서.md | ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4 |
| DOC-BIZ-03 | docs/business/맞춤형화장품판매업소_조사_2026-09.md | ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4 |
| DOC-BIZ-04 | docs/business/유튜브_홍보동영상_제작의뢰서.md | ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4 |
| DOC-BIZ-05 | docs/business/판매업소_인터뷰_스크립트.md | FO-01, FO-02, FO-03, FO-04, FO-05, FO-06, FO-07, FO-08, FO-09, FO-10, FO-11, FO-12, FO-13, FO-14, FO-15, FO-16, FO-17, FO-18, FO-19, FO-20, FO-21, FO-22, FO-23, ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4 |
| DOC-DEV-01 | docs/dev/SPEC.md | — |
| DOC-DEV-02 | docs/dev/ARCHITECTURE.md | — |
| DOC-DEV-03 | docs/dev/CHANGES.md | — |
| DOC-DEV-04 | docs/dev/TRACE_MATRIX.md | — |
| DOC-DSN-01 | docs/dev/design/DOM_TEST_DESIGN.md | A-01, A-02, A-03, A-04, A-05, A-06, A-07, R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08, R-09, TH-01, TH-02, TH-03, TH-04, TH-05, TH-06, UM-01, UM-02, UM-03, UM-04, UM-05, UX-NAV-01, UX-NAV-02, UX-NAV-03, UX-NAV-04, UX-NAV-05, UX-NAV-06, UX-NAV-07 |
| DOC-DSN-02 | docs/dev/design/FORMULA_OS_WORKFLOW_DESIGN.md | FO-01, FO-02, FO-03, FO-04, FO-05, FO-06, FO-07, FO-08, FO-09, FO-10, FO-11, FO-12, FO-13, FO-14, FO-15, FO-16, FO-17, FO-18, FO-19, FO-20, FO-21, FO-22, FO-23, UM-01, UM-02, UM-03, UM-04, UM-05 |
| DOC-DSN-03 | docs/dev/design/LEARNING_PREMIUM_PLAN.md | AN-01, AN-02, AN-03, ROAD-P0 |
| DOC-DSN-04 | docs/dev/design/QUESTION_SCHEMA_DESIGN.md | DR-02, ID-01, ID-02, ID-03, ID-04, Q-04, Q-05, Q-06, Q-07, Q-08, Q-09, Q-10, Q-11 |
| DOC-DSN-05 | docs/dev/design/READER_FEEDBACK_DESIGN.md | FB-01, FB-02, FB-03, FB-04, FB-05, FB-06, FB-07, FB-08 |
| DOC-DSN-06 | docs/dev/design/STUDY_APP_DESIGN_GUIDE.md | — |
| DOC-DSN-07 | docs/dev/design/SUBSCRIPTION_ROADMAP.md | ROAD-P0, ROAD-P1, ROAD-P2, ROAD-P3, ROAD-P4 |
| DOC-DSN-08 | docs/dev/design/SUPABASE_DESIGN.md | AU-01, AU-02, AU-03, AU-04, AU-05, AU-06, AU-07, AU-08, DA-08, ROAD-P0, S-01 |
| DOC-DSN-09 | docs/dev/design/USER_FEEDBACK_DESIGN.md | AU-01, AU-02, AU-03, AU-04, AU-05, AU-06, AU-07, AU-08, FB-01, FB-02, FB-03, FB-04, FB-05, FB-06, FB-07, FB-08, S-01 |
| DOC-IDX-01 | docs/README.md | — |
| DOC-PPL-01 | ref-pipeline/README.md | AO-01, AO-02, AO-03, AO-04, AO-05, BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07, BP-08, CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10 |
| DOC-PPL-02 | ref-pipeline/audiobook/README.md | AO-01, AO-02, AO-03, AO-04, AO-05 |
| DOC-PPL-03 | ref-pipeline/audiobook/AUDIOBOOK_SUMMARY.md | AO-01, AO-02, AO-03, AO-04, AO-05 |
| DOC-RBK-01 | docs/dev/runbooks/AUDIO_HOSTING_GUIDE.md | AO-01, AO-02, AO-03, AO-04, AO-05, P-01, P-02, P-03, P-04, P-04a, P-05, P-06, P-07, P-08, P-09, P-10, P-11, P-12, P-13 |
| DOC-RBK-02 | docs/dev/runbooks/COMBO_GENERATION_GUIDE.md | BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07, BP-08, DR-02, DR-03, DR-04, DR-05, DR-06, DR-07 |
| DOC-RBK-03 | docs/dev/runbooks/CONTENT_WORKFLOW.md | BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07, BP-08, CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, DA-01, DA-02, DA-03, DA-04, DA-05, DA-06, DA-07, DA-08, DA-09 |
| DOC-RBK-04 | docs/dev/runbooks/DEPLOYMENT_GUIDE.md | C-01, C-02, C-03, C-04, C-05, P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-09, P-10, P-11, P-12, P-13 |
| DOC-RBK-05 | docs/dev/runbooks/MULTI_MACHINE_SETUP.md | — |
| DOC-RBK-06 | docs/dev/runbooks/Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md | AU-02, AU-03, AU-04 |
| DOC-RBK-07 | docs/dev/runbooks/TEXTBOOK_AUTHORING_GUIDE.md | CE-01, CE-02, CE-03, CE-04, CE-05, CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, ST-01, ST-02, ST-03, ST-04, ST-05, ST-06, ST-07, TR-01, TR-02, TR-03, TR-04, TR-05, TR-06, TR-07, TR-08, TR-09, TR-10, TR-11, TR-12, TR-13, TR-14, TR-15, TR-16, TR-16a, TR-17, TR-18 |
| DOC-RBK-08 | docs/dev/runbooks/TEXTBOOK_REPLACEMENT_RUNBOOK.md | BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07, BP-08, CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, DA-01, ID-01, ID-02, ID-03, ID-04 |
| DOC-REF-01 | docs/dev/reference/COMBO_STUDY_STRATEGY.md | DR-02, DR-03, DR-04, DR-05, DR-06, DR-07, Q-01, Q-02, Q-03, Q-04, Q-05, Q-06, Q-07, Q-08, Q-09, Q-10, Q-11 |
| DOC-REF-02 | docs/dev/reference/DEV_ENVIRONMENT.md | — |
| DOC-REF-03 | docs/dev/reference/FLASHCARD_LOGIC.md | F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-10, ID-01, ID-02, ID-03, ID-04, TR-01 |
| DOC-REF-04 | docs/dev/reference/MD_TO_HTML_LOGIC.md | EV-01, EV-02, EV-03, EV-04, EV-05, EV-06, EV-07, EV-08, MV-01, MV-02, MV-03, MV-04, RR-01, RR-02, RR-03, RR-04, RR-05, RR-06, RR-07, RR-08, RR-09, RR-10, RR-11, RR-12, RR-13, RR-14, RR-15, RR-16, TR-01 |
| DOC-REF-05 | docs/dev/reference/NUMBERING_SYSTEM.md | CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, ID-01, ID-02, ID-03, ID-04, TR-01, TR-02, TR-03, TR-04, TR-05, TR-06, TR-07, TR-08, TR-09, TR-10, TR-11, TR-12, TR-13, TR-14, TR-15, TR-16, TR-16a, TR-17, TR-18 |
| DOC-REF-06 | docs/dev/reference/TESTING.md | — |
| DOC-REF-07 | docs/dev/reference/TEXTBOOK_REFERENCE_MAPPING.md | CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, RR-01, RR-02, RR-03, RR-04, RR-05, RR-06, RR-07, RR-08, RR-09, RR-10, RR-11, RR-12, RR-13, RR-14, RR-15, RR-16 |
| DOC-ROOT-01 | README.md | — |
| DOC-ROOT-02 | AGENTS.md | — |
| DOC-USR-01 | docs/user/exam_strategy.md | — |
| DOC-USR-02 | docs/user/formula_manual.md | FO-01, FO-02, FO-03, FO-04, FO-05, FO-06, FO-07, FO-08, FO-09, FO-10, FO-11, FO-12, FO-13, FO-14, FO-15, FO-16, FO-17, FO-18, FO-19, FO-20, FO-21, FO-22, FO-23, MV-01, MV-02, MV-03, MV-04 |
| DOC-USR-03 | docs/user/subject1_numbers.md | ND-01 |
| DOC-USR-04 | docs/user/subject2_numbers.md | ND-01 |
| DOC-USR-05 | docs/user/subject3_numbers.md | ND-01 |
| DOC-USR-06 | docs/user/subject4_numbers.md | ND-01 |
| DOC-USR-07 | docs/user/user_manual.md | MV-01, MV-02, MV-03, MV-04 |

## 부록 B — 테스트 갭 (소스 연결 있으나 테스트 @spec 미연결)

없음 — 소스 연결된 모든 요구사항에 테스트 참조가 있음.
