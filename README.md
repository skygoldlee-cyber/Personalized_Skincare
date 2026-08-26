# 💄 Cosmetic Pass Master

> **맞춤형화장품 조제관리사 자격시험 스마트 학습 플랫폼**
>
> 교재 읽기 · 플래시카드 · 기출 퀴즈 · 오답 복습 · 성적 분석 · 오디오북까지 하나로.

[![Deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)](vercel.json)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 📖 프로젝트 소개

**Cosmetic Pass Master**는 한국 **맞춤형화장품 조제관리사** 국가자격시험을 준비하는 수험생을 위한 웹 기반 학습 애플리케이션입니다. 순수 HTML/CSS/JavaScript로 구현된 SPA(Single Page Application)로, 별도의 백엔드 없이 Vercel에 정적 배포됩니다.

### 시험 과목 (4과목 · 19단원)

| 과목 | 단원 수 | 내용 |
|------|:---:|------|
| 1. 맞춤형화장품의 이해 | 7 | 개요, 피부·모발 생리구조, 관능평가, 제품 상담·안내, 혼합·소분, 충진·포장 |
| 2. 유통화장품 안전관리 | 5 | 작업장·작업자 위생관리, 설비·기구관리, 내용물·원료관리, 포장재 관리 |
| 3. 화장품 제조 및 품질관리 | 5 | 원료의 종류와 특성, 기능과 품질, 사용제한 원료, 화장품 관리, 위해사례 판단·보고 |
| 4. 화장품법의 이해 | 2 | 화장품법, 개인정보 보호법 |

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 📊 **대시보드** | 학습 진도, 과목별 성적 레이더 차트, 성적 추이 꺾은선 그래프 |
| 📖 **교재 본문 읽기** | 4과목 19단원 교재 전문 열기/검색 |
| 🃏 **플래시카드** | 단원별 핵심 개념 암기 카드 (앞/뒤 뒤집기) |
| ❓ **기출 퀴즈** | 900+ 문항 풀이, 즉시 채점 및 해설 |
| ⭐ **오답/중요 복습** | 틀린 문제·북마크 문제 집중 복습 |
| 🏋️ **스마트 훈련소** | 취약 영역 집중 연습 |
| 📝 **실전 예상문제집** | 과목별 모의고사 (100문항 × 다수 세트) + MD 문제집 인앱 뷰어 (목차·인쇄, 팝업 없음) |
| 🔍 **성분 검색 사전** | 사용 가능/금지/제한 화장품 성분 검색 (배합 한도 포함) |
| 🎧 **오디오북** | TTS로 생성한 단원별 음성 강의 (MP3) |
| ✏️ **스크래치패드** | HTML5 Canvas 손글씨 연습장 |
| 🌗 **라이트/다크 테마** | 시스템 테마 자동 감지 + 수동 토글 (헤더·모바일 탭 바), FOUC 없는 즉시 적용 |
| 📱 **모바일 최적화** | 하단 탭 바 네비게이션, safe-area 대응, 스크롤 복원, 오프라인 감지, 가로/세로 보기 토글 |

---

## 🛠️ 기술 스택

**Frontend**
- 순수 HTML5 / CSS3 / Vanilla JavaScript (프레임워크 없음)
- ES Modules (ESM) — `import`/`export` 기반 명시적 의존성 그래프
- SPA 라우팅 (자체 구현)
- SVG 기반 차트 (레이더/꺾은선, 외부 라이브러리 없음)
- Noto Sans KR · Outfit (Google Fonts), FontAwesome 아이콘 (자체 호스팅 — [`vendor/fontawesome/`](vendor/fontawesome/), CDN 의존 없음)
- **라이트/다크 듀얼 테마 UI**: CSS 변수 기반 디자인 토큰, 시스템 테마 연동, `localStorage` 선택 영속화
- **반응형 모바일 레이아웃**: 하단 탭 바 네비게이션, safe-area-inset 대응, 100dvh 동적 뷰포트

**테스트**
- Node.js 내장 테스트 러너 (`node --test`) — 88 unit tests (sha256, sanitize, state, parser, trainer-calc, utils, delegation-guard)
- Vitest + jsdom — 10 DOM tests (backup 모듈)
- GitHub Actions CI — push 시 `npm test` + parser parity 자동 실행

**데이터 파이프라인** (빌드 타임)
- Node.js 모듈러 빌드 파이프라인으로 MD 교재/문제 → 해시드 JS 번들 생성
  - `tools/build/index.js` → `data/registry.js` + `data/subjects/*.hash.js` + `data/exams/*.hash.js` + `data/ingredients_data.*.js`
  - `tools/build_exam_bundles.js` → `data/exams_md/*.js` (문제집 MD file:// 폴리백 번들)
  - `tools/build_study_md_bundle.js` → `data/study_md/` (교재 MD file:// 폴백, 과목별 분할)
  - `tools/generate_migration_map.js` → `data/id_migration.js`
  - 런타임: `src/data-loader.js`가 registry를 보고 필요한 과목/시험만 온디맨드 로드

**오디오북 파이프라인** (`content/audiobook/`)
- Python: 마크다운 청크 분할 → TTS(Google gTTS / ElevenLabs) → MP3 병합
- 모델: `ko_KR-jimin-medium.onnx`

**배포**
- Vercel (정적 호스팅, SPA rewrite 설정)
- GitHub Actions CI (push 시 자동 테스트 + 파서 정합성 검증)

---

## 📁 폴더 구조 상세

```
Personalized Skincare/
│
├── 📄 index.html                    ← ✅ 배포 (앱 진입점, 테마 로직 내장)
├── 📄 style.css                     ← ✅ 배포 (전역 스타일, 라이트/다크)
├── 📄 manifest.webmanifest          ← ✅ 배포 (PWA 매니페스트)
├── 📄 ping.txt                      ← ✅ 배포 (오프라인 감지용 연결 프로브 대상, 내용 `1`)
├── 📄 sw.js                         ← ✅ 배포 (Service Worker; 캐시 및 쉘 갱신)
├── 📄 serve.js                      ← 로컬 개발 서버 (Vercel 제외)
├── 📄 vercel.json                   ← Vercel 설정 (캐시/보안 헤더)
├── 📄 .vercelignore / .gitignore    ← 배포/추적 제외 목록
├── 📄 package.json                  ← 빌드 스크립트(build:data / --only)
│
├── 📂 icons/                        ← ✅ 배포 (PWA 아이콘 192/512/maskable)
│
├── 📂 vendor/                       ← ✅ 배포 (자체 호스팅 서드파티 자산)
│   ├── fontawesome/                 ← FontAwesome 6.4.0 자체 호스팅
│   └── mermaid/                     ← Mermaid v10 자체 호스팅 (인앱 다이어그램용)
│
├── 📂 src/                          ← ✅ 배포 (애플리케이션 소스; ESM 모듈화)
│   ├── sanitize.js                  ← XSS 방어(esc/safeTextWithBreaks)
│   ├── data-loader.js               ← 레지스트리 기반 온디맨드 번들 로더(DataLoader)
│   ├── utils.js                     ← 범용 헬퍼(한글 초성 추출 등)
│   ├── ui-utils.js                  ← 공통 UI 유틸(로딩 오버레이/spinner)
│   ├── charts.js                    ← SVG 차트 및 합격 진단
│   ├── scratchpad.js                ← Canvas 손글씨 계산 연습장
│   ├── trainer-calc.js              ← 계산 훈련 문제 생성기
│   ├── state.js                     ← 전역 상태 + localStorage 영속화
│   ├── exam-viewer.js               ← 문제집(MD) 런타임 인앱 뷰어
│   ├── views/                       ← 뷰 컨트롤러 모듈 (app.js에서 분리)
│   │   ├── dashboard.js             ← 대시보드 통계 및 챌린지
│   │   ├── flashcard.js             ← 플래시카드 학습
│   │   ├── quiz.js                  ← 기출 퀴즈 및 오답 복습
│   │   ├── trainer.js               ← 스마트 훈련소
│   │   ├── dictionary.js            ← 성분 검색 사전
│   │   ├── backup.js                ← 데이터 백업/복원
│   │   ├── textbook-search.js       ← 교재 본문 검색
│   │   ├── textbook-reader.js       ← 교재 리더 + 오디오 재생
│   │   └── exam-simulator.js        ← 실전 모의고사 시뮬레이터
│   └── app.js                       ← 메인 앱 (라우팅, 공통 렌더러, 초기화)
│
├── 📂 data/                         ← ✅ 배포 (빌드 산출물 — 수정 금지)
│   ├── registry.js                  ← 번들 목록/메타
│   ├── id_migration.js              ← 레거시 ID ➔ 안정 ID 일회성 매핑
│   ├── audio_manifest.js            ← 오디오 파일 경로 매니페스트
│   ├── subjects/<key>.<hash>.js     ← 과목별 학습 번들 (레거시, 미사용)
│   ├── exams/<key>.<hash>.js        ← 시험별 문항 번들
│   ├── exams_md/<stem>.js           ← 문제집 MD 번들 (file:// 프로토콜 폴백)
│   ├── study_md/                    ← 교재 MD file:// 폴백 (과목별 분할)
│   │   ├── manifest.js              ← 폴백 manifest (~3KB)
│   │   └── <subjectKey>.js          ← 과목별 MD 원문 (온디맨드 로드)
│   └── ingredients_data.<hash>.js   ← 성분 사전 번들
│
├── 📂 content/                      ← 교재 MD 원본 (manifest만 빌드에 참조)
│   ├── manifest.json                ← 단일 진실 원천(SSOT): 과목/단원/파일 정의
│   ├── understanding/               ← 1과목: 맞춤형화장품의 이해
│   ├── safety/                      ← 2과목: 유통화장품 안전관리
│   ├── manufacturing/               ← 3과목: 화장품 제조 및 품질관리
│   ├── law/                         ← 4과목: 화장품법의 이해
│   ├── ingredients/                 ← 성분 원본 MD
│   ├── study_summary.md             ← 핵심 단권화 요약집 (앱 내 뷰어 연동)
│   └── audiobook/                   ← 오디오북 파이프라인 (Python)
│
├── 📂 exams/                        ← ✅ 배포 (모의고사 MD 원본 및 뷰어 소스)
│
├── 📂 tests/                        ← 자동화 테스트
│   ├── unit/                        ← Node.js 내장 테스트 러너 (88 tests)
│   └── dom/                         ← Vitest + jsdom DOM 테스트 (10 tests)
├── 📂 .github/workflows/            ← GitHub Actions CI (test + parser parity)
│
└── 📂 docs/                         ← 문서 (개발 + 사용자)
    ├── README.md                    ← 문서 인덱스
    ├── dev/                         ← 개발 문서
    │   ├── ARCHITECTURE.md          ← 아키텍처 및 설계 표준 가이드
    │   ├── DEPLOYMENT_GUIDE.md      ← Vercel 배포 및 오디오 호스팅 가이드
    │   ├── MULTI_MACHINE_SETUP.md   ← 멀티 머신 개발 환경 설정
    │   ├── PROJECT_MINDMAP.md       ← 프로젝트 전체 구조 마인드맵
    │   ├── CHANGES.md               ← 코드 리뷰 수정 내역
    │   └── IMPROVEMENTS_REPORT.md   ← 보완 및 개선점 보고서
    └── user/                        ← 사용자 문서
        └── user_manual.md           ← 사용자 매뉴얼 (앱 내 뷰어 연동)
```

> **범례:** ✅ 배포 포함 · ❌ 배포 제외 · 🆕 최신 모듈러 개편 반영 (2026-08-25)

자세한 설계 컨셉과 상세 아키텍처는 [`docs/dev/ARCHITECTURE.md`](docs/dev/ARCHITECTURE.md)를 참고하세요.
전체 문서 목록은 [`docs/README.md`](docs/README.md)를 참고하세요.

---

## 🚀 시작하기

### 로컬 실행

별도 빌드 없이 정적 파일이므로 로컬 서버만 띄우면 됩니다.

```bash
# Node.js가 있다면
node serve.js

# 또는 Python
python -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속.

### Vercel 배포

[`vercel.json`](vercel.json)과 [`.vercelignore`](.vercelignore)가 이미 구성되어 있습니다.

```bash
npm i -g vercel
vercel --prod
```

배포 최적화 및 오디오 호스팅 상세는 [`docs/dev/DEPLOYMENT_GUIDE.md`](docs/dev/DEPLOYMENT_GUIDE.md)를 참고하세요.

### 모바일 접속

스마트폰에서 접속하면 자동으로 모바일 최적화 레이아웃이 적용됩니다.

- **하단 탭 바**: 대시보드/교재읽기/카드/퀴즈/모의고사/복습/훈련소/교재검색/성분검색/매뉴얼 10개 메뉴 (가로 스크롤 지원)
- **가로/세로 보기 토글**: 헤더의 회전 아이콘 버튼으로 강제 가로 레이아웃 전환 가능
- **safe-area 대응**: iPhone 하단 홈 인디케이터 영역 자동 확보
- **스크롤 복원**: 탭 전환 시 이전 스크롤 위치 기억
- **오프라인 감지**: 실제 인터넷 끊김 시에만 상단 배너 표시 (전체 화면 크기 대응, `navigator.onLine` 억제 가드 + 연속 3~4회 실패 확정 + standalone/슬립 복귀 유예로 오탐 원천 차단, 적응 주기 연결 확인)
- **대시보드 카드**: 세로보기에서 통계·분석 카드 1열(종열) 배치

### PWA 설치 및 브라우저 호환성

본 플랫폼은 PWA(Progressive Web App)로 제작되어 홈 화면에 설치하면 네이티브 앱처럼 사용할 수 있습니다.

#### 권장 브라우저
- **Android**: **Google Chrome** (기본 브라우저로 설정 권장)
- **iOS**: **Safari** (PWA 설치 필수)

#### 알려진 이슈 및 해결
일부 모바일 브라우저(삼성 인터넷, Whale 등)에서는 PWA 설치 후 **교재 본문 검색** 또는 **성분 검색 사전** 데이터가 로드되지 않을 수 있습니다. 이는 브라우저별 Service Worker 캐시 정책 및 스크립트 로딩 방식 차이 때문입니다.

**증상**: "원료 데이터베이스가 비어있습니다" 또는 검색 결과 없음
**해결 방법**:
1. 기기의 **기본 브라우저를 Chrome으로 변경**합니다.
2. 또는 **앱을 완전히 삭제 후 Chrome으로 재설치**합니다.
3. 문제가 지속되면 브라우저에서 `?debug=1` 쿼리 파라미터로 접속하여 디버그 패널을 확인하세요.

#### 디버그 패널 사용법
개발/진단 목적으로 `?debug=1` 쿼리 파라미터를 URL에 추가하면 화면 하단에 디버그 패널이 표시됩니다. Service Worker 상태, DataLoader 로딩 여부, 오류 메시지를 실시간으로 확인할 수 있습니다.

### 데이터 재생성 (교재/문제 수정 시)

```bash
# 전체 빌드
npm run build:data

# 부분 빌드 (변경 과목만)
npm run build:data:law
node tools/build/index.js --only law,safety

# file:// 폴백 번들 재생성 (교재 MD 수정 시)
npm run build:study-md

# 안정 ID 이관 맵 재생성 (퀴즈 ID 규칙 변경 시)
node tools/generate_migration_map.js
```

---

## 🎧 오디오북 생성

```bash
cd content/audiobook
pip install -r requirements.txt
cp .env.example .env   # API 키 입력
python run_pipeline.py
```

사용법은 [`content/audiobook/README.md`](content/audiobook/README.md) 참고.

---

## 📦 Git 관리 참고

대용량 파일은 Git 추적에서 제외됩니다 ([`.gitignore`](.gitignore)):

- `content/audiobook/mp3/`, `*.mp3` — 생성된 음성 파일 (외부 CDN 권장)
- `content/audiobook/models/`, `*.onnx` — TTS 모델
- `content/**/*.html` — 100MB 초과 HTML
- `archive/`, `.env` 등

---

## 📄 라이선스

MIT License

---

<div align="center">
  <sub>© 2026 Cosmetic Pass Master — 맞춤형화장품 조제관리사 합격을 향해 🎯</sub>
</div>
