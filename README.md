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
| 📝 **실전 예상문제집** | 과목별 모의고사 (100문항 × 다수 세트) |
| 🔍 **성분 검색 사전** | 사용 가능/금지/제한 화장품 성분 검색 (배합 한도 포함) |
| 🎧 **오디오북** | TTS로 생성한 단원별 음성 강의 (MP3) |
| ✏️ **스크래치패드** | HTML5 Canvas 손글씨 연습장 |
| 📱 **모바일 최적화** | 하단 탭 바 네비게이션, safe-area 대응, 스크롤 복원, 오프라인 감지 |

---

## 🛠️ 기술 스택

**Frontend**
- 순수 HTML5 / CSS3 / Vanilla JavaScript (프레임워크 없음)
- SPA 라우팅 (자체 구현)
- SVG 기반 차트 (레이더/꺾은선, 외부 라이브러리 없음)
- Noto Sans KR · Outfit (Google Fonts), FontAwesome 아이콘
- 다크 테마 UI
- **반응형 모바일 레이아웃**: 하단 탭 바 네비게이션, safe-area-inset 대응, 100dvh 동적 뷰포트

**데이터 파이프라인** (빌드 타임)
- Node.js 스크립트로 MD 교재/문제 → JS 데이터 번들 생성
  - `tools/parse_data.js` → `data/study_data.js`
  - `tools/parse_exams.js` → `data/exam_data.js`
  - `tools/parse_ingredients.js` → `data/ingredients_data.js`

**오디오북 파이프라인** (`audiobook/`)
- Python: 마크다운 청크 분할 → TTS(Google gTTS / ElevenLabs) → MP3 병합
- 모델: `ko_KR-jimin-medium.onnx`

**배포**
- Vercel (정적 호스팅, SPA rewrite 설정)

---

## 📁 폴터 구조

```
├── index.html / style.css      # 앱 진입점·전역 스타일
├── manifest.webmanifest        # PWA 매니페스트 (앱 이름/아이콘/테마)
├── sw.js                       # PWA Service Worker (오프라인 캐시)
├── icons/                      # PWA 아이콘 (192/512/maskable)
├── src/                        # 애플리케이션 소스
│   ├── app.js                  # 메인 로직 (라우팅·상태·렌더링)
│   ├── charts.js               # SVG 차트
│   ├── sanitize.js             # XSS 방어·텍스트 정제
│   ├── scratchpad.js           # Canvas 연습장
│   └── state.js                # 상태 관리·로컬 스토리지
├── data/                       # 생성된 데이터 번들 (study/exam/ingredients/audio)
├── content/                    # 교재 MD + HTML (4과목 19단원)
├── exams/                      # 시험 문제 MD + HTML
├── ingredients/                # 성분 원본 MD (approved/banned/restricted)
├── audiobook/                  # 오디오북 파이프라인 (Python·TTS·MP3)
├── tools/                      # 데이터 생성 스크립트 (Node.js/PowerShell)
└── docs/                       # 매뉴얼·요약·배포 가이드
```

자세한 구조는 [`FOLDER_STRUCTURE.md`](FOLDER_STRUCTURE.md)를 참고하세요.

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

- **하단 탭 바**: 대시보드/교재/카드/퀴즈/모의고사/매뉴얼 빠른 이동
- **safe-area 대응**: iPhone 하단 홈 인디케이터 영역 자동 확보
- **스크롤 복원**: 탭 전환 시 이전 스크롤 위치 기억
- **오프라인 감지**: 네트워크 끊김 시 상단 배너 표시

### 데이터 재생성 (교재/문제 수정 시)

```bash
node tools/parse_data.js
node tools/parse_exams.js
node tools/parse_ingredients.js
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
