# 📚 문서 인덱스 (Documentation Index)

> **Cosmetic Pass Master / Passmula** — 맞춤형화장품 조제관리사 스마트 학습 + 실무(Formula OS) 플랫폼
> 최종 갱신: 2026-09-24

이 문서는 `docs/` 아래 모든 문서의 **역할 설명**과 **목적별 읽기 순서**를 제공합니다.

---

## 🧭 목적별 읽기 순서

### ① 프로젝트 전체를 처음 이해하는 경우 (신규 기여자)

```
1. README.md (루트)          — 프로젝트 소개·기능·기술 스택·폴더 구조
2. AGENTS.md (루트)          — 명령어·코드 규칙·검증 체크리스트 (작업 전 필수)
3. docs/dev/ARCHITECTURE.md  — Local-First·ESM·DataLoader·SW 캐시·동기화 등 설계 결정
4. docs/dev/SPEC.md          — 구현 완료된 기능의 요구사양 명세
5. docs/dev/CONTENT_WORKFLOW.md — 콘텐츠=SSOT, 빌드 파이프라인 개요
6. docs/dev/TESTING.md       — 유닛 489 + DOM 332 테스트 구조
7. docs/dev/CHANGES.md       — 변경 이력 (왜 바뀌었는지의 맥락)
```

### ② 교재·문제은행·참조자료 콘텐츠를 편집하는 경우

```
1. CONTENT_WORKFLOW.md           — content/exams/<id>/ 편집 → build:data → 검증 절차
2. TEXTBOOK_AUTHORING_GUIDE.md   — 교재 MD 작성 규칙 (카드/퀴즈 추출 규칙)
3. NUMBERING_SYSTEM.md           — 교재 챕터/섹션 십진 번호체계
4. QUESTION_SCHEMA_DESIGN.md     — 문항 스키마 (단일/복수정답·OX·단답)
5. COMBO_GENERATION_GUIDE.md     — 복수정답형 드릴 문항 생성 도구 절차
6. TEXTBOOK_REFERENCE_MAPPING.md — 교재↔참조자료 매핑 규칙
```

### ③ Formula OS(실무 기능)를 이해·확장하는 경우

```
1. FORMULA_OS_DESIGN.md          — Phase 5-A 기본 설계 (원료DB·계산기·검증)
2. FORMULA_OS_WORKFLOW_DESIGN.md — 9개 조제 업무 확장 설계 (Phase A~D)
3. SPEC.md §3.18                 — 구현된 상세 요구사양
```

### ④ 배포·환경·운영 작업

```
1. DEPLOYMENT_GUIDE.md    — Vercel 배포·CSP/캐시 정책·트러블슈팅
2. MULTI_MACHINE_SETUP.md — 새 머신에서 Git/Vercel 환경 재현
3. AUDIO_HOSTING_GUIDE.md — 오디오북 호스팅 구조
4. SUPABASE_DESIGN.md §A.7~A.8 — 계정·동기화 구조 + 대시보드 설정 요건
5. Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md — SMTP·메일 템플릿 운영 절차
```

### ⑤ 제품 전략·수익화 방향 검토

```
1. docs/맞춤형화장품_조제관리사_자격증플랫폼_사업기획서.md — 플랫폼 사업기획서 (법적 경계·기술 자산)
2. dev/Cosmetic Master Business Plan.md — 상위 브랜드 전략 (Pass+Practice 두 루프, TAM·Moat·GTM)
3. FEATURE_PROPOSALS.md          — 합격 핵심 루프 11단계 제품 전략
4. PASS_TO_PRACTICE_STRATEGY.md  — 합격 후 실무 플랫폼 전환 전략
5. PASS_CORE_LOOP_REVIEW.md      — 핵심 루프의 코드 반영도 진단 (시점 스냅샷)
6. READER_FEEDBACK_DESIGN.md     — 독자 피드백 공유 기능 설계안
7. SUBSCRIPTION_ROADMAP.md       — 월 구독 전환 로드맵
8. FORMULA_OS_경쟁전략.md          — Formula OS 경쟁 지도·차별화 축·시나리오별 대응
9. 판매업소_인터뷰_스크립트.md      — Step 0 판매업소 인터뷰 질문·중단 기준·집계 시트
10. 맞춤형화장품판매업소_조사_2026-09.md — 판매업소·솔루션 공급사·시장 수치·규제 동향 조사 (인터뷰 모집 자료)
```

### ⑥ 학습자(사용자) 관점 문서

```
user/user_manual.md → 학습안내서(앱 내) → user/exam_strategy.md → user/subject1~4_numbers.md
```

---

## 📂 문서 구조

```
docs/
├── README.md                    ← 본 파일 (문서 인덱스 + 읽기 순서)
├── 맞춤형화장품_조제관리사_자격증플랫폼_사업기획서.md
├── FORMULA_OS_경쟁전략.md          ← Formula OS 경쟁·차별화 전략
├── dev/                         ← 개발·설계·운영 문서 (28개)
├── user/                        ← 사용자/학습자 문서 (7개)
└── report_archive/              ← 1회성 분석 보고서 아카이브 (4개)
```

---

## 🔧 개발 문서 (docs/dev/)

### 아키텍처·명세

| 문서 | 설명 |
|------|------|
| [ARCHITECTURE.md](dev/ARCHITECTURE.md) | 시스템 아키텍처·설계 철학 — Local-First + 선택적 클라우드, ESM 구조, 데이터 흐름, PWA/SW 전략, 계정·동기화, UI 모드, Formula OS, 배포 파이프라인, 구현 레시피, 강건성 가이드라인 |
| [SPEC.md](dev/SPEC.md) | 요구사양 명세서 — 구현된 기능을 역공학해 정리 (현행 기준서) |
| [SUPABASE_DESIGN.md](dev/SUPABASE_DESIGN.md) | Supabase 계정·클라우드 동기화·Pro 권한 설계 — Phase 1~2 구현 완료, URL/PWA 동일 로그인 UX |
| [FLASHCARD_LOGIC.md](dev/FLASHCARD_LOGIC.md) | 플래시카드 생성·난이도·필터·SM-2 간격 반복 로직 |
| [MD_TO_HTML_LOGIC.md](dev/MD_TO_HTML_LOGIC.md) | MD→HTML 변환 로직 — 런타임 파서(manual-viewer)와 빌드 파이프라인 |

### 콘텐츠 파이프라인

| 문서 | 설명 |
|------|------|
| [CONTENT_WORKFLOW.md](dev/CONTENT_WORKFLOW.md) | 콘텐츠 변경 표준 절차 — `content/`=SSOT, `build:data` 파이프라인, 검증 명령 |
| [TEXTBOOK_AUTHORING_GUIDE.md](dev/TEXTBOOK_AUTHORING_GUIDE.md) | 교재 Markdown 작성 지침 — 카드/퀴즈 추출 규칙, manifest.json, 빌드 검증 |
| [NUMBERING_SYSTEM.md](dev/NUMBERING_SYSTEM.md) | 교재 챕터/섹션 십진 번호체계 |
| [QUESTION_SCHEMA_DESIGN.md](dev/QUESTION_SCHEMA_DESIGN.md) | 문항 데이터 스키마 — 복수정답형의 "진술 단위 O/X → 조합 도출" 구조 |
| [COMBO_GENERATION_GUIDE.md](dev/COMBO_GENERATION_GUIDE.md) | 복수정답형 드릴 생성 도구 — `build_combo_drills.js` + `ref-statements.js` |
| [TEXTBOOK_REFERENCE_MAPPING.md](dev/TEXTBOOK_REFERENCE_MAPPING.md) | 교재 챕터/섹션 ↔ 참조자료 파일 매핑 정의 |
| [COMBO_STUDY_STRATEGY.md](dev/COMBO_STUDY_STRATEGY.md) | 복수정답형 학습 전략 — 진술 원자 단위 학습법, 전략→기능 매핑 (코드 주석에서 참조) |

### Formula OS (실무)

| 문서 | 설명 |
|------|------|
| [FORMULA_OS_DESIGN.md](dev/FORMULA_OS_DESIGN.md) | Phase 5-A 기본 설계 — 원료 DB·배합 계산기·My 포뮬러·규정 검증 (구현 완료) |
| [FORMULA_OS_WORKFLOW_DESIGN.md](dev/FORMULA_OS_WORKFLOW_DESIGN.md) | 조제관리사 9개 업무 전체 커버리지 — 고객·배치·원료장부·법규 (Phase A~D 구현 완료) |

### 테스트·품질

| 문서 | 설명 |
|------|------|
| [TESTING.md](dev/TESTING.md) | 테스트 가이드 — 유닛(node:test) + DOM(Vitest/jsdom) 전체 목록·규칙 |
| [DOM_TEST_DESIGN.md](dev/DOM_TEST_DESIGN.md) | DOM 시나리오 테스트 설계 — jsdom 경계, 케이스 유형 매트릭스, Phase 1~5 로드맵 |

### 운영·환경

| 문서 | 설명 |
|------|------|
| [DEPLOYMENT_GUIDE.md](dev/DEPLOYMENT_GUIDE.md) | Vercel 배포·오디오 호스팅 — 용량 최적화, CSP/캐시 정책, 체크리스트, 트러블슈팅 |
| [MULTI_MACHINE_SETUP.md](dev/MULTI_MACHINE_SETUP.md) | 다중 머신 개발 환경 — GitHub SSH, Vercel CLI 인증, Actions 자동 배포 |
| [AUDIO_HOSTING_GUIDE.md](dev/AUDIO_HOSTING_GUIDE.md) | 오디오북 호스팅·청취 아키텍처 — GitHub Releases 연동, 모바일 청취 동작 |
| [Supabase_Custom_SMTP_MagicLink_OTP_설정가이드.md](dev/Supabase_Custom_SMTP_MagicLink_OTP_%EC%84%A4%EC%A0%95%EA%B0%80%EC%9D%B4%EB%93%9C.md) | Supabase 운영 런북 — Custom SMTP(Gmail 앱 비밀번호)·Magic Link/OTP 템플릿·체크리스트 |
| [CHANGES.md](dev/CHANGES.md) | 코드 변경 이력 (Changelog) — 변경의 이유와 맥락 |

### 제품 전략·기획

| 문서 | 설명 |
|------|------|
| [Cosmetic Master Business Plan.md](dev/Cosmetic%20Master%20Business%20Plan.md) | 상위 브랜드 전략 — Pass Master + Formula OS 두 루프, TAM/SAM/SOM, Moat, GTM |
| [FEATURE_PROPOSALS.md](dev/FEATURE_PROPOSALS.md) | 합격 핵심 루프 중심 제품 전략 — Free/Pro 경계, Phase 로드맵 |
| [PASS_TO_PRACTICE_STRATEGY.md](dev/PASS_TO_PRACTICE_STRATEGY.md) | Pass→Practice 전략 — 합격 후 실무 플랫폼으로 전환하는 설계 |
| [PASS_CORE_LOOP_REVIEW.md](dev/PASS_CORE_LOOP_REVIEW.md) | 합격 핵심 루프 코드 반영도 진단 (작성 시점 스냅샷) |
| [READER_FEEDBACK_DESIGN.md](dev/READER_FEEDBACK_DESIGN.md) | 독자 피드백 공유 기능 설계 제안 (미구현) |
| [SUBSCRIPTION_ROADMAP.md](dev/SUBSCRIPTION_ROADMAP.md) | 월 구독 서비스 전환 로드맵 |
| [STUDY_APP_DESIGN_GUIDE.md](dev/STUDY_APP_DESIGN_GUIDE.md) | 학습 앱 재사용 설계 가이드 — 다른 자격시험/교재 적용 템플릿 |

---

## 👤 사용자 문서 (docs/user/)

| 문서 | 설명 | 접근 방법 |
|------|------|-----------|
| [user_manual.md](user/user_manual.md) | 사용자 매뉴얼 | 앱 내 "매뉴얼" 메뉴 (manual-viewer 렌더) |
| [formula_manual.md](user/formula_manual.md) | Formula OS 실무 매뉴얼 | 앱 내 실무 매뉴얼 (doc: 링크 연동) |
| [exam_strategy.md](user/exam_strategy.md) | 시험 합격 공략법 — 4과목·100문항·과락 기준 전략 | 직접 열기 |
| [subject1~4_numbers.md](user/subject1_numbers.md) | 과목별 숫자 암기 요약정리 (4파일) | 직접 열기 |
| [학습안내서.md](../content/exams/cosmetic/학습안내서.md) | 학습 안내서 | 앱 내 "요약집" 메뉴 (`content/exams/cosmetic/`) |

> 사용자 문서는 앱의 `manual-viewer.js`가 런타임에 fetch하여 인앱 오버레이로 렌더링합니다.

---

## 🗄️ 아카이브 (docs/report_archive/)

1회성 분석 보고서 — 앱 코드에서 참조하지 않음. 이력 보관용.

| 문서 | 설명 |
|------|------|
| 법령최신확인결과.md | 교재 법령 수치의 최신 개정 반영 여부 조사 |
| 오답위험_분석보고서.md | 문제은행 오답 유발 패턴 분석 |
| 출제비중기반학습방법.md | 출제 비중 기반 학습 우선순위 제안 |
| 출제비중분포조사결과.md | 과목별 출제 비중 조사 데이터 |

---

## 🔗 루트 문서

| 문서 | 설명 |
|------|------|
| [README.md](../README.md) | 프로젝트 소개·기능·기술 스택·폴더 구조·시작하기 |
| [AGENTS.md](../AGENTS.md) | AI 에이전트/개발자 작업 가이드 — 명령어·코드 규칙·검증 체크리스트 |

---

## 📌 문서 작성 규칙

- **업데이트 날짜**: 각 문서 상단에 `최종 업데이트` 명시
- **링크**: 상대 경로 사용 (`../`, `dev/`, `user/`); 공백 파일명은 `%20` 인코딩
- **Mermaid 다이어그램**: `securityLevel: 'strict'` + crypto nonce로 인앱 및 GitHub 렌더링 지원
- **인코딩**: UTF-8 (BOM 없음)
- **신규 문서 추가 시**: 이 인덱스의 해당 분류 표에 행 추가 + 읽기 순서 경로에 필요 시 반영
- **시점 스냅샷 문서** (리뷰·조사 보고서): `report_archive/`에 두거나 문서 상단에 작성 시점 명시
