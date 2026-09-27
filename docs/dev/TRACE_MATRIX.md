# 🔗 TRACE MATRIX — 요구사양 추적 매트릭스

> **문서 ID**: DOC-DEV-04
> **관련 SPEC ID**: 해당 없음 (본 문서가 추적 산출물)
> ⚠️ 자동 생성 파일 — `npm run build:trace`로 재생성. 직접 편집 금지.
> 입력 해시: 72e4086ed6d3c3da
> 생성: 2026-09-27 · 원천: SPEC.md(344개 ID) + @spec 태그 + 문서 헤더

| 열 | 의미 | 원천 |
|----|------|------|
| 문서 | 해당 요구사항을 다루는 문서 (DOC-ID) | 각 문서 헤더 "관련 SPEC ID" |
| 소스 | 구현 코드 파일 | `// @spec` 태그 |
| 테스트 | 검증 테스트 파일 | `// @spec` 태그 (tests/) |
| 보고서 | 분석·결과 보고서 | report_archive 헤더 |

**커버리지 요약**: 요구사항 344개 — 문서 연결 222 · 소스 연결 325 · 테스트 연결 340 · 보고서 연결 109

---

## 5.1 데이터 아키텍처

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| DA-01 | DOC-RBK-03<br>DOC-RBK-08 | tools/build/index.js<br>tools/build/manifest_loader.js | tests/unit/data-architecture.test.js | — |
| DA-02 | DOC-RBK-03 | src/data-loader.js<br>tools/build/index.js | tests/unit/data-architecture.test.js | — |
| DA-03 | DOC-RBK-03 | src/data-loader.js | tests/unit/data-loader.test.js | — |
| DA-04 | DOC-RBK-03 | tools/build/build_study_md_bundle.js | tests/unit/data-architecture.test.js | — |
| DA-05 | DOC-RBK-03 | src/state.js<br>src/storage.js | tests/unit/state.test.js | — |
| DA-06 | DOC-RBK-03 | src/exam-context.js<br>src/paths.js<br>src/pwa-manifest.js<br>tools/build/exam_targets.js | tests/unit/data-architecture.test.js | — |
| DA-07 | DOC-RBK-03 | src/exam-context.js<br>src/storage-keys.js<br>src/storage.js | tests/unit/storage-key-sync.test.js | — |
| DA-08 | DOC-DSN-08<br>DOC-RBK-03 | src/exam-context.js | tests/unit/data-architecture.test.js | — |
| DA-09 | DOC-RBK-03 | src/storage.js | tests/unit/storage.test.js | — |

## 3.1 대시보드

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| D-01 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-02 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-03 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-04 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-05 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-06 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-07 | — | src/views/daily-challenge.js<br>src/views/dashboard.js | tests/dom/study-challenge.dom.test.js<br>tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-08 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-09 | — | css/dashboard.css<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-10 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-11 | — | src/recommendations.js<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-12 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-13 | — | src/recommendations.js<br>src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-14 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |
| D-15 | — | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-05<br>DOC-ARC-10 |

## 3.1.5 맞춤 학습 리포트

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| AN-01 | DOC-DSN-03 | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-09 |
| AN-02 | DOC-DSN-03 | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-09 |
| AN-03 | DOC-DSN-03 | src/views/dashboard.js | tests/dom/study-dashboard.dom.test.js | DOC-ARC-09 |

## 3.2 플래시카드

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| F-01 | DOC-REF-03 | css/study.css<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |
| F-02 | DOC-REF-03 | css/study.css<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |
| F-03 | DOC-REF-03 | src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |
| F-04 | DOC-REF-03 | src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |
| F-05 | DOC-REF-03 | src/utils.js<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js<br>tests/unit/utils.test.js | DOC-ARC-05 |
| F-06 | DOC-REF-03 | src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |
| F-07 | DOC-REF-03 | src/spaced-repetition.js<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |
| F-08 | DOC-REF-03 | src/spaced-repetition.js<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |
| F-09 | DOC-REF-03 | src/spaced-repetition.js<br>src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |
| F-10 | DOC-REF-03 | src/views/flashcard.js | tests/dom/study-flashcard.dom.test.js | DOC-ARC-05 |

## 3.3 퀴즈

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| Q-01 | DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-02 | DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-03 | DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-04 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-05 | DOC-DSN-04<br>DOC-REF-01 | src/utils.js<br>src/views/quiz.js | tests/dom/study-quiz.dom.test.js<br>tests/unit/utils.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-06 | DOC-DSN-04<br>DOC-REF-01 | src/views/daily-challenge.js<br>src/views/quiz.js | tests/dom/study-challenge.dom.test.js<br>tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-07 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-08 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js<br>src/weak-items.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-09 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-10 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |
| Q-11 | DOC-DSN-04<br>DOC-REF-01 | src/views/quiz.js | tests/dom/study-quiz.dom.test.js | DOC-ARC-05<br>DOC-ARC-09<br>DOC-ARC-11 |

## 3.4 모의고사

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| E-01 | — | css/exam.css<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 |
| E-02 | — | src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 |
| E-03 | — | src/views/exam-sim-state.js<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 |
| E-04 | — | src/views/exam-sim-review.js<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 |
| E-05 | — | src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 |
| E-06 | — | src/views/exam-sim-review.js<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 |
| E-07 | — | css/exam.css<br>src/views/exam-sim-review.js<br>src/views/exam-simulator.js | tests/dom/study-simulator.dom.test.js | DOC-ARC-05<br>DOC-ARC-10<br>DOC-ARC-11 |

## 3.5 교재 리더

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| TR-01 | DOC-RBK-07<br>DOC-REF-03<br>DOC-REF-04<br>DOC-REF-05 | src/markdown-parser.js<br>src/reader-format.js<br>src/textbook-parser.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/markdown-parser-general.test.js<br>tests/unit/reader-format-general.test.js<br>tests/unit/textbook-parser.test.js | — |
| TR-02 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-03 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-04 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-05 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-06 | DOC-RBK-07<br>DOC-REF-05 | css/reader-mermaid.css<br>src/mermaid-render.js<br>src/mermaid-utils.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/mermaid-parser.test.js<br>tests/unit/mermaid-pipeline.test.js<br>tests/unit/mermaid-reader-format.test.js<br>…외 3개 | — |
| TR-07 | DOC-RBK-07<br>DOC-REF-05 | src/mermaid-render.js<br>src/mermaid-utils.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/mermaid-parser.test.js<br>tests/unit/mermaid-pipeline.test.js<br>tests/unit/mermaid-reader-format.test.js<br>…외 3개 | — |
| TR-08 | DOC-RBK-07<br>DOC-REF-05 | src/mermaid-render.js<br>src/mermaid-utils.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/mermaid-parser.test.js<br>tests/unit/mermaid-pipeline.test.js<br>tests/unit/mermaid-reader-format.test.js<br>…외 3개 | — |
| TR-09 | DOC-RBK-07<br>DOC-REF-05 | src/markdown-parser.js<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js<br>tests/unit/markdown-parser-general.test.js | — |
| TR-10 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-11 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-12 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-13 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-14 | DOC-RBK-07<br>DOC-REF-05 | src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-15 | DOC-RBK-07<br>DOC-REF-05 | css/reader.css<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-16 | DOC-RBK-07<br>DOC-REF-05 | css/reader.css<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-17 | DOC-RBK-07<br>DOC-REF-05 | css/reader.css<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |
| TR-18 | DOC-RBK-07<br>DOC-REF-05 | css/reader.css<br>src/views/textbook-reader.js | tests/dom/study-reader.dom.test.js | — |

## 3.6 교재 리더 — 학습 보조 도구

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| SA-01 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — |
| SA-02 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — |
| SA-03 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — |
| SA-04 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — |
| SA-05 | — | src/study-aids.js<br>src/views/textbook-reader.js | tests/unit/study-aids.test.js | — |

## 3.7 교재 리더 — 용어집

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| G-01 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — |
| G-02 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — |
| G-03 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — |
| G-04 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — |
| G-05 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — |
| G-06 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — |
| G-07 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — |
| G-08 | — | src/glossary-query.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js<br>tests/unit/glossary-query.test.js | — |
| G-09 | — | src/views/glossary-renderer.js<br>src/views/textbook-reader.js | tests/dom/common-glossary.dom.test.js | — |

## 3.8 교재 리더 — 참조자료 연결

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| RR-01 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-02 | DOC-REF-04<br>DOC-REF-07 | src/views/textbook-reader.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-03 | DOC-REF-04<br>DOC-REF-07 | src/views/textbook-reader.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-04 | DOC-REF-04<br>DOC-REF-07 | src/keyword-index.js<br>src/views/textbook-reader.js<br>tools/build/build_keyword_index.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-05 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js<br>src/views/textbook-reader.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-06 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js<br>src/views/textbook-reader.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-07 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-08 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-09 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-10 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-11 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-12 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-13 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js<br>src/pdf-registry.js<br>tools/build/build_pdf_registry.js | tests/dom/common-htmlviewer.dom.test.js<br>tests/unit/pdf-registry.test.js | — |
| RR-14 | DOC-REF-04<br>DOC-REF-07 | css/print.css<br>src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-15 | DOC-REF-04<br>DOC-REF-07 | css/html-viewer.css<br>src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |
| RR-16 | DOC-REF-04<br>DOC-REF-07 | src/html-viewer.js | tests/dom/common-htmlviewer.dom.test.js | — |

## 3.9 교재 검색

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| TS-01 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |
| TS-02 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |
| TS-03 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |
| TS-04 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |
| TS-05 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |
| TS-06 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |
| TS-07 | — | src/mermaid-render.js<br>src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |
| TS-08 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |
| TS-09 | — | src/views/textbook-search.js | tests/dom/study-search.dom.test.js | — |

## 3.10 성분 사전

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| DI-01 | — | src/views/dictionary.js | tests/dom/study-dictionary.dom.test.js | — |
| DI-02 | — | src/views/dictionary.js | tests/dom/study-dictionary.dom.test.js | — |
| DI-03 | — | src/views/dictionary.js | tests/dom/study-dictionary.dom.test.js | — |

## 3.11 훈련소

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| T-01 | — | src/trainer-calc.js<br>src/views/trainer-calc-practice.js<br>src/views/trainer.js | tests/dom/study-trainer.dom.test.js<br>tests/unit/trainer-calc.test.js | DOC-ARC-05 |
| T-02 | — | src/utils.js<br>src/views/trainer-ingredients.js<br>src/views/trainer.js | tests/dom/study-trainer.dom.test.js | DOC-ARC-05 |
| T-03 | — | src/views/pomodoro.js<br>src/views/trainer.js | tests/dom/study-pomodoro.dom.test.js<br>tests/dom/study-trainer.dom.test.js | DOC-ARC-05 |
| T-04 | — | css/trainer.css<br>src/scratchpad.js<br>src/views/trainer.js | tests/dom/common-scratchpad.dom.test.js<br>tests/dom/study-trainer.dom.test.js | DOC-ARC-05 |
| T-05 | — | css/trainer.css<br>src/views/trainer-calc-practice.js<br>src/views/trainer.js | tests/dom/study-trainer.dom.test.js | DOC-ARC-05 |

## 3.12 오디오북

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| AO-01 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | ref-pipeline/audiobook/generate_all_mp3.py<br>ref-pipeline/audiobook/run_pipeline.py<br>ref-pipeline/audiobook/tts_elevenlabs.py<br>ref-pipeline/audiobook/tts_google_direct.py<br>…외 1개 | tests/dom/reader-audio.dom.test.js | — |
| AO-02 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | src/views/reader-audio.js | tests/dom/reader-audio.dom.test.js | — |
| AO-03 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | src/views/reader-audio.js | tests/dom/reader-audio.dom.test.js | — |
| AO-04 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | src/views/reader-audio.js | tests/dom/reader-audio.dom.test.js | — |
| AO-05 | DOC-PPL-01<br>DOC-PPL-02<br>DOC-PPL-03<br>DOC-RBK-01 | src/views/reader-audio.js | tests/dom/reader-audio.dom.test.js | — |

## 3.13 데이터 백업/복원

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| B-01 | — | src/views/backup.js | tests/dom/backup.dom.test.js | — |
| B-02 | — | src/views/backup.js | tests/dom/backup.dom.test.js | — |
| B-03 | — | src/views/backup.js | tests/dom/backup.dom.test.js | — |
| B-04 | — | src/views/backup.js | tests/dom/backup.dom.test.js | — |

## 3.14 문제집 뷰어

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| EV-01 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — |
| EV-02 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — |
| EV-03 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — |
| EV-04 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — |
| EV-05 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — |
| EV-06 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — |
| EV-07 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — |
| EV-08 | DOC-REF-04 | src/exam-viewer.js | tests/dom/study-examviewer.dom.test.js | — |

## 3.15 학습안내서/사용자매뉴얼 뷰어

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| MV-01 | DOC-REF-04<br>DOC-USR-02<br>DOC-USR-07 | src/manual-viewer.js | tests/dom/study-manual.dom.test.js | — |
| MV-02 | DOC-REF-04<br>DOC-USR-02<br>DOC-USR-07 | src/manual-viewer.js<br>src/mermaid-render.js | tests/dom/study-manual.dom.test.js | — |
| MV-03 | DOC-REF-04<br>DOC-USR-02<br>DOC-USR-07 | src/manual-viewer.js | tests/dom/study-manual.dom.test.js | — |
| MV-04 | DOC-REF-04<br>DOC-USR-02<br>DOC-USR-07 | src/manual-viewer.js<br>tools/build/build_doc_bundles.js | tests/dom/study-manual.dom.test.js | — |

## 3.16 차트 및 시각화

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| C-01 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — |
| C-02 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — |
| C-03 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — |
| C-04 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — |
| C-05 | DOC-RBK-04 | src/charts.js | tests/dom/charts.dom.test.js | — |

## 3.17 콘텐츠 품질 감사

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| CQ-01 | — | tools/audit_card_quality.js | tests/unit/audit-quality.test.js | — |
| CQ-02 | — | tools/audit_card_quality.js | tests/unit/audit-quality.test.js | — |
| CQ-03 | — | tools/audit_card_quality.js | tests/unit/audit-quality.test.js | — |
| CQ-04 | — | tools/audit_card_quality.js | tests/unit/audit-quality.test.js | — |
| CQ-05 | — | tools/audit_combo.js<br>tools/check_combo_pilot.js | tests/unit/audit-quality.test.js | — |

## 3.18 Formula OS — 실전 배합 작업실

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| FO-01 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/dom/formula-calc.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-02 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-check.js<br>src/views/formula.js | tests/unit/formula-check.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-03 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/unit/formula-os.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-04 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/unit/formula-os.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-05 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-rules.js<br>src/views/formula.js | tests/unit/formula-rules.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-06 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-rules.js<br>src/views/formula.js | tests/unit/formula-rules.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-07 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/unit/formula-os.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-08 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-store.js<br>src/views/formula.js | tests/unit/formula-store.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-09 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/unit/formula-os.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-10 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | css/formula.css<br>src/views/formula.js | tests/dom/review-drills-formula.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-11 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula.js | tests/dom/review-drills-formula.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-12 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-stability.js | tests/unit/formula-stability.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-13 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-stability.js | tests/unit/formula-stability.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-14 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/formula-stability.js<br>src/views/formula-print.js | tests/unit/formula-stability.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-15 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | css/formula.css<br>src/views/formula.js | tests/dom/formula-nav.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-16 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/batch-store.js<br>src/store-utils.js<br>src/views/formula-batch.js | tests/dom/formula-batch.dom.test.js<br>tests/unit/batch-store.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-17 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/customer-store.js<br>src/store-utils.js<br>src/views/formula-customer.js | tests/dom/formula-customer.dom.test.js<br>tests/unit/customer-store.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-18 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/material-ledger.js<br>src/store-utils.js<br>src/views/formula-material.js | tests/dom/formula-material.dom.test.js<br>tests/unit/material-ledger.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-19 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/views/formula-compliance.js | tests/dom/formula-compliance.dom.test.js<br>tests/unit/formula-compliance.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-20 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/usage-guide.js | tests/unit/usage-guide.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-21 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | css/print.css<br>src/views/formula-print.js | tests/dom/formula-print.dom.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-22 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/csv-utils.js | tests/unit/csv-import.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |
| FO-23 | DOC-BIZ-01<br>DOC-BIZ-05<br>DOC-DSN-02<br>DOC-USR-02 | src/batch-store.js<br>src/formula-store.js | tests/unit/batch-store.test.js<br>tests/unit/formula-store.test.js | DOC-ARC-01<br>DOC-ARC-04<br>DOC-ARC-06 |

## 3.19 계정·클라우드 동기화

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| AU-01 | DOC-DSN-08<br>DOC-DSN-09 | src/auth-view.js | tests/dom/common-auth.dom.test.js | — |
| AU-02 | DOC-DSN-08<br>DOC-DSN-09<br>DOC-RBK-06 | src/auth-view.js<br>src/supabase-client.js | tests/dom/common-auth.dom.test.js<br>tests/unit/supabase-client.test.js | — |
| AU-03 | DOC-DSN-08<br>DOC-DSN-09<br>DOC-RBK-06 | src/auth-view.js | tests/dom/common-auth.dom.test.js | — |
| AU-04 | DOC-DSN-08<br>DOC-DSN-09<br>DOC-RBK-06 | src/auth-view.js | tests/dom/common-auth.dom.test.js | — |
| AU-05 | DOC-DSN-08<br>DOC-DSN-09 | src/sync.js | tests/dom/common-sync.dom.test.js | — |
| AU-06 | DOC-DSN-08<br>DOC-DSN-09 | src/sync.js | tests/dom/common-sync.dom.test.js | — |
| AU-07 | DOC-DSN-08<br>DOC-DSN-09 | src/sync.js | tests/dom/common-sync.dom.test.js<br>tests/unit/storage-key-sync.test.js | — |
| AU-08 | DOC-DSN-08<br>DOC-DSN-09 | src/auth-view.js<br>src/supabase-client.js<br>src/supabase-config.js<br>src/sync.js | tests/dom/common-auth.dom.test.js<br>tests/dom/common-sync.dom.test.js<br>tests/unit/supabase-client.test.js | — |
| DA-10 | — | src/customer-store.js<br>src/sync.js | tests/unit/customer-store.test.js | — |

## 3.20 학습 캘린더·복습·드릴

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| DR-01 | — | src/views/trainer-drills.js<br>tools/build/build_ox_drills.js<br>tools/drill-utils.js | tests/dom/study-trainer-drills.dom.test.js | DOC-ARC-05<br>DOC-ARC-09 |
| DR-02 | DOC-DSN-04<br>DOC-RBK-02<br>DOC-REF-01 | src/views/trainer-drills.js<br>tools/build/build_combo_drills.js<br>tools/drill-utils.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/combo-transform.test.js | DOC-ARC-05<br>DOC-ARC-09 |
| DR-03 | DOC-RBK-02<br>DOC-REF-01 | src/statement-tracker.js<br>src/views/trainer-drills.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/statement-tracker.test.js | DOC-ARC-05<br>DOC-ARC-09 |
| DR-04 | DOC-RBK-02<br>DOC-REF-01 | src/statement-tracker.js<br>src/views/trainer-drills.js<br>src/weak-items.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/statement-tracker.test.js | DOC-ARC-05<br>DOC-ARC-09 |
| DR-05 | DOC-RBK-02<br>DOC-REF-01 | src/statement-tracker.js<br>src/views/trainer-drills.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/statement-tracker.test.js | DOC-ARC-05<br>DOC-ARC-09 |
| DR-06 | DOC-RBK-02<br>DOC-REF-01 | src/views/exam-simulator.js<br>src/views/trainer-drills.js | tests/dom/study-trainer-drills.dom.test.js | DOC-ARC-05<br>DOC-ARC-09 |
| DR-07 | DOC-RBK-02<br>DOC-REF-01 | src/questions.js<br>src/views/trainer-drills.js | tests/dom/study-trainer-drills.dom.test.js<br>tests/unit/combo-transform.test.js<br>tests/unit/questions.test.js | DOC-ARC-05<br>DOC-ARC-09 |
| ND-01 | DOC-USR-03<br>DOC-USR-04<br>DOC-USR-05<br>DOC-USR-06 | src/views/trainer-drills.js<br>src/views/trainer.js | tests/dom/review-drills-formula.dom.test.js | — |
| RV-01 | — | src/views/quiz.js<br>src/views/trainer.js | tests/dom/review-drills-formula.dom.test.js | — |
| SC-01 | — | css/study-calendar.css<br>src/views/study-calendar.js | tests/dom/study-calendar.dom.test.js | DOC-ARC-05 |
| SC-02 | — | src/views/study-calendar.js | tests/dom/study-calendar.dom.test.js | DOC-ARC-05 |
| SC-03 | — | src/study-tracker.js | tests/unit/study-tracker.test.js | DOC-ARC-05 |

## 3.21 UI 모드 전환

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| UM-01 | DOC-DSN-01<br>DOC-DSN-02 | src/ui-mode.js | tests/dom/common-uimode.dom.test.js | DOC-ARC-06 |
| UM-02 | DOC-DSN-01<br>DOC-DSN-02 | src/ui-mode.js | tests/dom/common-uimode.dom.test.js | DOC-ARC-06 |
| UM-03 | DOC-DSN-01<br>DOC-DSN-02 | src/ui-mode.js | tests/dom/common-uimode.dom.test.js | DOC-ARC-06 |
| UM-04 | DOC-DSN-01<br>DOC-DSN-02 | src/router.js<br>src/ui-mode.js | tests/dom/common-uimode.dom.test.js<br>tests/dom/router.dom.test.js | DOC-ARC-06 |
| UM-05 | DOC-DSN-01<br>DOC-DSN-02 | src/ui-mode.js | tests/dom/common-uimode.dom.test.js | DOC-ARC-06 |

## 3.22 시험 선택·전환

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| ES-01 | — | src/exam-context.js<br>src/views/exam-select.js | tests/dom/study-examselect.dom.test.js<br>tests/unit/exam-context.test.js | DOC-ARC-07 |
| ES-02 | — | src/exam-context.js<br>src/views/exam-select.js | tests/dom/study-examselect.dom.test.js<br>tests/unit/exam-context.test.js | DOC-ARC-07 |
| ES-03 | — | src/exam-context.js<br>src/views/exam-select.js | tests/dom/study-examselect.dom.test.js<br>tests/unit/exam-context.test.js | DOC-ARC-07 |
| ES-04 | — | src/exam-context.js | tests/unit/exam-context.test.js | DOC-ARC-07 |
| ES-05 | — | src/exam-context.js | tests/unit/exam-context.test.js | DOC-ARC-07 |

## 3.23 사용자 의견 수신

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| FB-01 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — |
| FB-02 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — |
| FB-03 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — |
| FB-04 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — |
| FB-05 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — |
| FB-06 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — |
| FB-07 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — |
| FB-08 | DOC-DSN-05<br>DOC-DSN-09 | src/feedback.js<br>tools/supabase/functions/feedback-notify/index.ts | tests/dom/feedback.dom.test.js<br>tests/unit/feedback.test.js | — |

## 4.1 PWA & 오프라인

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| P-01 | DOC-RBK-01<br>DOC-RBK-04 | sw.js | tests/unit/pwa-sw.test.js | — |
| P-02 | DOC-RBK-01<br>DOC-RBK-04 | src/config/cache.js<br>sw.js | tests/unit/pwa-sw.test.js | — |
| P-03 | DOC-RBK-01<br>DOC-RBK-04 | sw.js | tests/unit/pwa-sw.test.js | — |
| P-04 | DOC-RBK-01<br>DOC-RBK-04 | sw.js | tests/unit/pwa-sw.test.js | — |
| P-05 | DOC-RBK-01<br>DOC-RBK-04 | sw.js<br>tools/build/stamp_sw_version.js | tests/unit/pwa-sw.test.js | — |
| P-06 | DOC-RBK-01<br>DOC-RBK-04 | sw.js | tests/unit/pwa-sw.test.js<br>tests/unit/sw-prune.test.js | — |
| P-07 | DOC-RBK-01<br>DOC-RBK-04 | src/pwa-install-capture.js<br>src/pwa-install.js | tests/unit/pwa-sw.test.js | — |
| P-08 | DOC-RBK-01<br>DOC-RBK-04 | src/pwa-install.js | tests/unit/pwa-sw.test.js | — |
| P-09 | DOC-RBK-01<br>DOC-RBK-04 | src/pwa-install.js | tests/unit/pwa-sw.test.js | — |
| P-10 | DOC-RBK-01<br>DOC-RBK-04 | src/pwa-manifest.js | tests/unit/pwa-sw.test.js | — |
| P-11 | DOC-RBK-01<br>DOC-RBK-04 | src/app-fallback.js | tests/unit/pwa-sw.test.js | — |
| P-12 | DOC-RBK-01<br>DOC-RBK-04 | tools/verify_shell_assets.js | tests/unit/pwa-sw.test.js | — |
| P-13 | DOC-RBK-01<br>DOC-RBK-04 | src/whats-new.js<br>tools/build/stamp_release_notes.js | tests/dom/whats-new.dom.test.js<br>tests/unit/whats-new.test.js | — |

## 4.2 오프라인 감지

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| O-01 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — |
| O-02 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — |
| O-03 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — |
| O-04 | — | sw.js | tests/dom/common-offline.dom.test.js | — |
| O-05 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — |
| O-06 | — | src/config/timing.js<br>src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — |
| O-07 | — | src/views/offline-detection.js | tests/dom/common-offline.dom.test.js | — |

## 4.3 보안

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| S-01 | DOC-DSN-08<br>DOC-DSN-09 | index.html | tests/unit/security.test.js | — |
| S-02 | — | src/app.js<br>src/views/event-listeners.js | tests/dom/common-eventlisteners.dom.test.js | — |
| S-03 | — | src/app.js<br>src/views/event-listeners.js | tests/dom/common-eventlisteners.dom.test.js | — |
| S-04 | — | — | tests/unit/delegation-guard.test.js | — |
| S-05 | — | src/sanitize.js | tests/unit/sanitize.test.js | — |
| S-06 | — | src/storage-keys.js<br>src/views/backup.js | tests/dom/backup.dom.test.js | — |
| S-07 | — | index.html | tests/unit/security.test.js | — |
| S-08 | — | src/app.js | tests/unit/security.test.js | — |

## 4.4 성능

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| PF-01 | — | src/data-loader.js | tests/unit/perf-invariants.test.js | — |
| PF-02 | — | src/data-loader.js | tests/unit/perf-invariants.test.js | — |
| PF-03 | — | src/data-loader.js | tests/unit/perf-invariants.test.js | — |
| PF-04 | — | src/html-viewer.js | tests/unit/perf-invariants.test.js | — |
| PF-05 | — | src/html-viewer.js | tests/unit/perf-invariants.test.js | — |
| PF-06 | — | src/html-viewer.js | tests/unit/perf-invariants.test.js | — |
| PF-07 | — | src/data-loader.js<br>src/views/dashboard.js | tests/unit/perf-invariants.test.js | — |
| PF-08 | — | src/views/textbook-search.js | tests/unit/perf-invariants.test.js | — |
| PF-09 | — | src/views/dictionary.js | tests/unit/perf-invariants.test.js | — |
| PF-10 | — | src/app.js | tests/unit/perf-invariants.test.js | — |
| PF-11 | — | ref-pipeline/convert.py<br>ref-pipeline/pdf2md.py | tests/unit/perf-invariants.test.js | — |
| PF-12 | — | src/keyword-index.js<br>tools/build/build_keyword_index.js | tests/unit/perf-invariants.test.js | — |
| PF-13 | — | src/mermaid-render.js | tests/unit/perf-invariants.test.js | — |
| PF-14 | — | css/base.css | tests/unit/perf-invariants.test.js | — |
| PF-15 | — | ref-pipeline/convert.py | tests/unit/perf-invariants.test.js | — |
| PF-16 | — | src/mermaid-render.js | tests/unit/perf-invariants.test.js | — |

## 4.5 접근성

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| A-01 | DOC-DSN-01 | index.html | tests/dom/common-a11y.dom.test.js | — |
| A-02 | DOC-DSN-01 | src/views/flashcard.js | tests/dom/common-a11y.dom.test.js | — |
| A-03 | DOC-DSN-01 | css/base.css | tests/dom/common-a11y.dom.test.js | — |
| A-04 | DOC-DSN-01 | css/base.css | tests/dom/common-a11y.dom.test.js | — |
| A-05 | DOC-DSN-01 | css/base.css<br>css/ui-overlay.css | tests/dom/common-a11y.dom.test.js | — |
| A-06 | DOC-DSN-01 | css/base.css<br>css/study.css | tests/dom/common-a11y.dom.test.js | — |
| A-07 | DOC-DSN-01 | src/ui-utils.js | tests/dom/common-a11y.dom.test.js | — |

## 4.6 반응형 & 모바일

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| R-01 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| R-02 | DOC-DSN-01 | css/base.css | tests/dom/common-navigation.dom.test.js | — |
| R-03 | DOC-DSN-01 | css/base.css | tests/dom/common-navigation.dom.test.js | — |
| R-04 | DOC-DSN-01 | src/views/navigation.js | tests/dom/common-navigation.dom.test.js | — |
| R-05 | DOC-DSN-01 | css/dashboard.css | tests/dom/common-navigation.dom.test.js | — |
| R-06 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| R-07 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| R-08 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| R-09 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| UX-NAV-07 | DOC-DSN-01 | src/views/navigation.js | tests/dom/common-navigation.dom.test.js | — |

## 4.7 테마 시스템

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| TH-01 | DOC-DSN-01 | css/base.css<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — |
| TH-02 | DOC-DSN-01 | css/base.css<br>index.html<br>src/theme-init.js<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — |
| TH-03 | DOC-DSN-01 | css/base.css<br>src/theme-init.js<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — |
| TH-04 | DOC-DSN-01 | css/base.css<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — |
| TH-05 | DOC-DSN-01 | css/base.css<br>src/theme-toggle.js | tests/dom/common-theme.dom.test.js | — |
| TH-06 | DOC-DSN-01 | css/base.css<br>css/reader-mermaid.css<br>src/mermaid-utils.js | tests/dom/common-theme.dom.test.js<br>tests/unit/mermaid-utils.test.js | — |

## 4.8 UI/UX 설계 요구사양

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| UX-FB-01 | — | css/ui-overlay.css<br>src/ui-utils.js | tests/unit/ux-invariants.test.js | — |
| UX-FB-02 | — | css/ui-overlay.css<br>src/ui-utils.js | tests/unit/ux-invariants.test.js | — |
| UX-FB-03 | — | css/ui-overlay.css<br>src/ui-utils.js | tests/unit/ux-invariants.test.js | — |
| UX-FB-04 | — | css/ui-overlay.css<br>src/ui-utils.js | tests/unit/ux-invariants.test.js | — |
| UX-FORM-01 | — | css/reader.css | tests/unit/ux-invariants.test.js | — |
| UX-FORM-02 | — | css/base.css | tests/unit/ux-invariants.test.js | — |
| UX-NAV-01 | DOC-DSN-01 | src/app.js<br>src/router.js | tests/dom/common-navigation.dom.test.js<br>tests/dom/router.dom.test.js | — |
| UX-NAV-02 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| UX-NAV-03 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| UX-NAV-04 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| UX-NAV-05 | DOC-DSN-01 | — | tests/dom/common-navigation.dom.test.js | — |
| UX-NAV-06 | DOC-DSN-01 | src/command-palette.js | tests/dom/common-navigation.dom.test.js<br>tests/dom/study-commandpalette.dom.test.js<br>tests/unit/command-palette.test.js | — |
| UX-PWA-01 | — | src/app.js | tests/unit/ux-invariants.test.js | — |
| UX-PWA-02 | — | src/pwa-install.js | tests/unit/ux-invariants.test.js | — |
| UX-PWA-03 | — | sw.js | tests/unit/ux-invariants.test.js | — |
| UX-PWA-04 | — | src/pwa-install.js | tests/unit/ux-invariants.test.js | — |
| UX-PWA-05 | — | src/app.js | tests/unit/ux-invariants.test.js | — |
| UX-SCR-01 | — | css/reader.css | tests/unit/ux-invariants.test.js | — |
| UX-SCR-02 | — | css/reader.css | tests/unit/ux-invariants.test.js | — |
| UX-SCR-03 | — | css/reader.css | tests/unit/ux-invariants.test.js | — |
| UX-SET-01 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — |
| UX-SET-02 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — |
| UX-SET-03 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — |
| UX-SET-04 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — |
| UX-SET-05 | — | css/ui-overlay.css | tests/unit/ux-invariants.test.js | — |

## 5.2 안정적 ID 체계

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| ID-01 | DOC-DSN-04<br>DOC-RBK-08<br>DOC-REF-03<br>DOC-REF-05 | src/sha256.js<br>tools/build/id_factory.js | tests/unit/id-factory.test.js<br>tests/unit/sha256.test.js | — |
| ID-02 | DOC-DSN-04<br>DOC-RBK-08<br>DOC-REF-03<br>DOC-REF-05 | src/sha256.js<br>tools/build/id_factory.js | tests/unit/id-factory.test.js<br>tests/unit/sha256.test.js | — |
| ID-03 | DOC-DSN-04<br>DOC-RBK-08<br>DOC-REF-03<br>DOC-REF-05 | tools/build/id_factory.js | tests/unit/id-factory.test.js | — |
| ID-04 | DOC-DSN-04<br>DOC-RBK-08<br>DOC-REF-03<br>DOC-REF-05 | tools/build/build_id_migration.js<br>tools/build/id_factory.js | tests/unit/id-factory.test.js | — |

## 5.3 빌드 파이프라인

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| BP-01 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/build_all_data.js<br>tools/build/build_audio_manifest.js<br>tools/build/build_combo_drills.js<br>tools/build/build_doc_bundles.js<br>…외 19개 | tests/unit/build-pipeline.test.js | — |
| BP-02 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/index.js<br>tools/build/schema.js<br>tools/check_imports.js | tests/unit/build-pipeline.test.js | — |
| BP-03 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/index.js<br>tools/build/manifest_loader.js<br>tools/check_manifest.js | tests/unit/build-pipeline.test.js | — |
| BP-04 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/build_exam_bundles.js<br>tools/build/index.js | tests/unit/build-pipeline.test.js | — |
| BP-05 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/check_parser_parity.js | tests/unit/build-pipeline.test.js | — |
| BP-06 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/build_keyword_index.js | tests/unit/build-pipeline.test.js | — |
| BP-07 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/build/stamp_release_notes.js<br>tools/build/stamp_sw_version.js<br>tools/deploy.js | tests/unit/build-pipeline.test.js | — |
| BP-08 | DOC-PPL-01<br>DOC-RBK-02<br>DOC-RBK-03<br>DOC-RBK-08 | tools/audit_card_quality.js | tests/unit/build-pipeline.test.js | — |

## 5.4 콘텐츠 구조

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| CS-01 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/MD_to_HTML.py<br>ref-pipeline/batch_convert.py<br>tools/build/build_study_md_bundle.js<br>tools/build/plugins/textbook.plugin.js<br>…외 1개 | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-02 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | tools/build/index.js<br>tools/build/plugins/exams.plugin.js | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-03 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/check_laws.py<br>ref-pipeline/convert.py<br>ref-pipeline/pdf2md.py<br>ref-pipeline/pdf2md_gui.py<br>…외 3개 | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-04 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | tools/build/index.js<br>tools/build/plugins/ingredients.plugin.js | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-05 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/MD_to_HTML.py<br>ref-pipeline/batch_convert.py | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-06 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | tools/build/build_keyword_index.js | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-07 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/audiobook/cleanup_empty_mp3.py<br>ref-pipeline/audiobook/generate_all_mp3.py<br>ref-pipeline/audiobook/md_chunker.py<br>ref-pipeline/audiobook/mp3_merger.py<br>…외 6개 | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-08 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | tools/build/build_study_md_bundle.js | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-09 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/convert.py<br>tools/check_ref_subjects.js<br>tools/check_reflayout.js<br>tools/check_refmerge.js | tests/unit/content-structure.test.js | DOC-ARC-08 |
| CS-10 | DOC-PPL-01<br>DOC-RBK-03<br>DOC-RBK-07<br>DOC-RBK-08<br>…외 2개 | ref-pipeline/convert.py<br>ref-pipeline/pdf2md.py | tests/unit/content-structure.test.js | DOC-ARC-08 |

## 5.5 교재 콘텐츠 학습 보조 요소

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| CE-01 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — |
| CE-02 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — |
| CE-03 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — |
| CE-04 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — |
| CE-05 | DOC-RBK-07 | — | tests/unit/content-engineering.test.js | — |

## 5.6 이야기형 교재 서사 구조

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| ST-01 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — |
| ST-02 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — |
| ST-03 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — |
| ST-04 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — |
| ST-05 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — |
| ST-06 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — |
| ST-07 | DOC-RBK-07 | src/views/textbook-reader.js | tests/unit/story-textbook.test.js | — |

## 7.2 유료화 인프라

| ID | 문서 | 소스 | 테스트 | 보고서 |
|----|------|------|--------|--------|
| ROAD-P0 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 4개 | src/pro-upgrade.js | tests/dom/pro-plan.dom.test.js<br>tests/unit/learning-pro.test.js | DOC-ARC-01<br>DOC-ARC-03<br>DOC-ARC-06 |
| ROAD-P1 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 2개 | — | — | DOC-ARC-01<br>DOC-ARC-03<br>DOC-ARC-06 |
| ROAD-P2 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 2개 | — | — | DOC-ARC-01<br>DOC-ARC-03<br>DOC-ARC-06 |
| ROAD-P3 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 2개 | — | — | DOC-ARC-01<br>DOC-ARC-02<br>DOC-ARC-03<br>DOC-ARC-06 |
| ROAD-P4 | DOC-BIZ-01<br>DOC-BIZ-02<br>DOC-BIZ-03<br>DOC-BIZ-04<br>…외 2개 | — | — | DOC-ARC-01<br>DOC-ARC-03<br>DOC-ARC-06<br>DOC-ARC-07 |

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
| DOC-RBK-01 | docs/dev/runbooks/AUDIO_HOSTING_GUIDE.md | AO-01, AO-02, AO-03, AO-04, AO-05, P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-09, P-10, P-11, P-12, P-13 |
| DOC-RBK-02 | docs/dev/runbooks/COMBO_GENERATION_GUIDE.md | BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07, BP-08, DR-02, DR-03, DR-04, DR-05, DR-06, DR-07 |
| DOC-RBK-03 | docs/dev/runbooks/CONTENT_WORKFLOW.md | BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07, BP-08, CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, DA-01, DA-02, DA-03, DA-04, DA-05, DA-06, DA-07, DA-08, DA-09 |
| DOC-RBK-04 | docs/dev/runbooks/DEPLOYMENT_GUIDE.md | C-01, C-02, C-03, C-04, C-05, P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-09, P-10, P-11, P-12, P-13 |
| DOC-RBK-05 | docs/dev/runbooks/MULTI_MACHINE_SETUP.md | — |
| DOC-RBK-06 | docs/dev/runbooks/Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md | AU-02, AU-03, AU-04 |
| DOC-RBK-07 | docs/dev/runbooks/TEXTBOOK_AUTHORING_GUIDE.md | CE-01, CE-02, CE-03, CE-04, CE-05, CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, ST-01, ST-02, ST-03, ST-04, ST-05, ST-06, ST-07, TR-01, TR-02, TR-03, TR-04, TR-05, TR-06, TR-07, TR-08, TR-09, TR-10, TR-11, TR-12, TR-13, TR-14, TR-15, TR-16, TR-17, TR-18 |
| DOC-RBK-08 | docs/dev/runbooks/TEXTBOOK_REPLACEMENT_RUNBOOK.md | BP-01, BP-02, BP-03, BP-04, BP-05, BP-06, BP-07, BP-08, CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, DA-01, ID-01, ID-02, ID-03, ID-04 |
| DOC-REF-01 | docs/dev/reference/COMBO_STUDY_STRATEGY.md | DR-02, DR-03, DR-04, DR-05, DR-06, DR-07, Q-01, Q-02, Q-03, Q-04, Q-05, Q-06, Q-07, Q-08, Q-09, Q-10, Q-11 |
| DOC-REF-02 | docs/dev/reference/DEV_ENVIRONMENT.md | — |
| DOC-REF-03 | docs/dev/reference/FLASHCARD_LOGIC.md | F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-10, ID-01, ID-02, ID-03, ID-04, TR-01 |
| DOC-REF-04 | docs/dev/reference/MD_TO_HTML_LOGIC.md | EV-01, EV-02, EV-03, EV-04, EV-05, EV-06, EV-07, EV-08, MV-01, MV-02, MV-03, MV-04, RR-01, RR-02, RR-03, RR-04, RR-05, RR-06, RR-07, RR-08, RR-09, RR-10, RR-11, RR-12, RR-13, RR-14, RR-15, RR-16, TR-01 |
| DOC-REF-05 | docs/dev/reference/NUMBERING_SYSTEM.md | CS-01, CS-02, CS-03, CS-04, CS-05, CS-06, CS-07, CS-08, CS-09, CS-10, ID-01, ID-02, ID-03, ID-04, TR-01, TR-02, TR-03, TR-04, TR-05, TR-06, TR-07, TR-08, TR-09, TR-10, TR-11, TR-12, TR-13, TR-14, TR-15, TR-16, TR-17, TR-18 |
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
