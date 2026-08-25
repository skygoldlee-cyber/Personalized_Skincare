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
- SPA 라우팅 (자체 구현)
- SVG 기반 차트 (레이더/꺾은선, 외부 라이브러리 없음)
- Noto Sans KR · Outfit (Google Fonts), FontAwesome 아이콘 (자체 호스팅 — [`vendor/fontawesome/`](vendor/fontawesome/), CDN 의존 없음)
- **라이트/다크 듀얼 테마 UI**: CSS 변수 기반 디자인 토큰, 시스템 테마 연동, `localStorage` 선택 영속화
- **반응형 모바일 레이아웃**: 하단 탭 바 네비게이션, safe-area-inset 대응, 100dvh 동적 뷰포트

**데이터 파이프라인** (빌드 타임)
- Node.js 모듈러 빌드 파이프라인으로 MD 교재/문제 → 해시드 JS 번들 생성
  - `tools/build/index.js` → `data/registry.js` + `data/subjects/*.hash.js` + `data/exams/*.hash.js` + `data/ingredients_data.*.js`
  - `tools/build_exam_bundles.js` → `data/exams_md/*.js` (문제집 MD file:// 폴리백 번들)
  - `tools/generate_migration_map.js` → `data/id_migration.js`
  - 런타임: `src/data-loader.js`가 registry를 보고 필요한 과목/시험만 온디맨드 로드

**오디오북 파이프라인** (`audiobook/`)
- Python: 마크다운 청크 분할 → TTS(Google gTTS / ElevenLabs) → MP3 병합
- 모델: `ko_KR-jimin-medium.onnx`

**배포**
- Vercel (정적 호스팅, SPA rewrite 설정)

---

## 📁 폴터 구조

```
├── index.html / style.css      # 앱 진입점·전역 스타일 (라이트/다크 테마)
├── manifest.webmanifest        # PWA 매니페스트 (앱 이름/아이콘/테마)
├── sw.js                       # PWA Service Worker (오프라인 캐시, 코드 자산 Network First)
├── icons/                      # PWA 아이콘 (192/512/maskable)
├── src/                        # 애플리케이션 소스
│   ├── app.js                  # 메인 로직 (라우팅·상태·렌더링)
│   ├── charts.js               # SVG 차트
│   ├── data-loader.js          # 레지스트리 기반 온디맨드 번들 로더
│   ├── reader-format.js        # 교재 리더 본문 포맷터 (순수 함수)
│   ├── sanitize.js             # XSS 방어·텍스트 정제
│   ├── scratchpad.js           # Canvas 연습장
│   ├── state.js                # 상태 관리·로컬 스토리지
│   ├── trainer-calc.js         # 계산 훈련 문제 생성기 (순수 로직)
│   └── utils.js                # 범용 헬퍼 (한글 초성 추출 등)
├── data/                       # 빌드 산출물 (registry + 해시 번들)
│   ├── registry.js             # 번들 목록/메타
│   ├── id_migration.js         # 레거시→안정 ID 일회성 매핑
│   ├── audio_manifest.js       # 오디오 파일 경로 매니페스트
│   ├── subjects/<key>.<hash>.js    # 과목별 학습 번들
│   ├── exams/<key>.<hash>.js       # 시험별 문항 번들
│   └── ingredients_data.<hash>.js  # 성분 사전 번들
├── content/                    # 교재 MD + manifest.json (4과목 19단원) 및 성분 원본 MD (ingredients/)
├── exams/                      # 시험 문제 MD + HTML
├── audiobook/                  # 오디오북 파이프라인 (Python·TTS·MP3)
├── tools/                      # 빌드/변환 자동화 (Node.js)
│   └── build/                  # 모듈러 빌드 파이프라인
└── docs/                       # 매뉴얼·요약·배포 가이드
```

자세한 구조는 [`FOLDER_STRUCTURE.md`](FOLDER_STRUCTURE.md)를, 설계 컨셉과 아키텍처는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)를 참고하세요.

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
vercel
```

배포 최적화 상세는 [`docs/VERCEL_DEPLOY_GUIDE.md`](docs/VERCEL_DEPLOY_GUIDE.md), [`docs/VERCEL_SIZE_OPTIMIZATION.md`](docs/VERCEL_SIZE_OPTIMIZATION.md) 참고.

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

# 안정 ID 이관 맵 재생성 (퀴즈 ID 규칙 변경 시)
node tools/generate_migration_map.js
```

---

## 🎧 오디오북 생성

```bash
cd audiobook
pip install -r requirements.txt
cp .env.example .env   # API 키 입력
python run_pipeline.py
```

사용법은 [`audiobook/README.md`](audiobook/README.md) 참고.

---

## 📦 Git 관리 참고

대용량 파일은 Git 추적에서 제외됩니다 ([`.gitignore`](.gitignore)):

- `audiobook/mp3/`, `*.mp3` — 생성된 음성 파일 (외부 CDN 권장)
- `audiobook/models/`, `*.onnx` — TTS 모델
- `content/**/*.html` — 100MB 초과 HTML
- `archive/`, `.env` 등

---

## 📄 라이선스

MIT License

---

<div align="center">
  <sub>© 2026 Cosmetic Pass Master — 맞춤형화장품 조제관리사 합격을 향해 🎯</sub>
</div>
