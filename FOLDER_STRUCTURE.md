# 📁 프로젝트 폴더구조 가이드

> **대상 프로젝트**: 맞춤형화장품 조제관리사 스마트 학습 플랫폼 (Cosmetic Pass Master)
> **최종 업데이트**: 2026-08-23 (모듈러 아키텍처 반영)
> **목적**: 실제 코드 구조를 정확히 설명하고 각 구성 요소의 역할을 정의
> **아키텍처 설계서**: [`docs/MODULAR_DESIGN.md`](docs/MODULAR_DESIGN.md) — 콘텐츠 주도 모듈러 빌드/로딩 설계(권위 문서)
> **배포 최적화**: [`docs/VERCEL_SIZE_OPTIMIZATION.md`](docs/VERCEL_SIZE_OPTIMIZATION.md)

---

## 🏛️ 아키텍처 개요 (중요)

이 프로젝트는 **콘텐츠 주도 모듈러 구조**를 사용합니다. 과거의 단일 번들
(`data/study_data.js` / `data/exam_data.js`)은 **더 이상 사용하지 않습니다**.

```
content/manifest.json      ← 단일 진실 원천(SSOT): 과목·단원·파일 목록
        │  (빌드)
        ▼
tools/build/index.js       ← 플러그인 기반 빌드 파이프라인
        │  produces
        ▼
data/registry.js           ← 번들 목록/메타(과목·시험·성분, 해시 파일명 포인터)
data/subjects/<key>.<hash>.js   ← 과목별 학습 번들(카드/퀴즈/챕터)
data/exams/<key>.<hash>.js      ← 시험별 문항 번들
data/ingredients_data.<hash>.js ← 성분 사전 번들
        │  (런타임)
        ▼
index.html → src/data-loader.js → 필요한 과목/시험만 온디맨드 로드
```

- **런타임 로딩**: `index.html`은 `data/registry.js` + `src/data-loader.js`만 먼저 읽고,
  사용자가 진입하는 과목/시험 번들을 `DataLoader.loadSubject()/loadExam()`으로 그때 로드합니다.
- **캐시 무효화**: 번들은 파일명에 콘텐츠 해시를 포함하므로(예: `law.cd33ce72.js`)
  변경된 것만 새 URL이 되어 자연 갱신됩니다(`sw.js` + `vercel.json` 참고).
- **진행상황 보존**: 콘텐츠 편집 시 안정 ID(`data/id_migration.js`)로 사용자 학습기록을 이관합니다.

---

## 📂 전체 구조 개요

```
Personalized Skincare/
│
├── 📄 index.html                    ← ✅ 배포 (앱 진입점, 테마 로직 내장)
├── 📄 style.css                     ← ✅ 배포 (전역 스타일, 라이트/다크)
├── 📄 manifest.webmanifest          ← ✅ 배포 (PWA 매니페스트)
├── 📄 ping.txt                      ← ✅ 배포 (오프라인 감지용 연결 프로브 대상, 내용 `1`; SW 프리캐시 + `?_probe=` 요청은 SW가 네트워크 프록시)
├── 📄 sw.js                         ← ✅ 배포 (Service Worker; 쉘 Network First, 데이터 안정캐시)
├── 📄 serve.js                      ← 로컬 개발 서버 (Vercel 제외)
├── 📄 vercel.json                   ← Vercel 설정 (캐시/보안 헤더)
├── 📄 .vercelignore / .gitignore    ← 배포/추적 제외 목록
├── 📄 package.json                  ← 빌드 스크립트(build:data / --only)
├── 📄 FOLDER_STRUCTURE.md           ← 본 문서
│
├── 📂 icons/                        ← ✅ 배포 (PWA 아이콘 192/512/maskable)
│
├── 📂 vendor/                       ← ✅ 배포 (자체 호스팅 서드파티 자산)
│   ├── fontawesome/                 ← FontAwesome 6.4.0 자체 호스팅 (2026-08-24~)
│   │   ├── css/all.min.css          ← CDN(cdnjs) 대체 — 모바일 아이콘 깨짐 해결
│   │   └── webfonts/*.woff2/.ttf    ← SW 프리캐시 포함 (오프라인에서도 아이콘 표시)
│   └── mermaid/                     ← 🆕 Mermaid v10 자체 호스팅 (2026-08-24~)
│       └── mermaid.min.js           ← CDN(jsDelivr) 대체 — CSP `script-src 'self'` 통과, docs/*.html 다이어그램 렌더링 복구
│
├── 📂 src/                          ← ✅ 배포 (애플리케이션 소스; 전역 스코프)
│   ├── sanitize.js                  ← XSS 방어(esc/safeTextWithBreaks) — 가장 먼저 로드
│   ├── data-loader.js               ← 🆕 레지스트리 기반 온디맨드 번들 로더(DataLoader)
│   ├── utils.js                     ← 범용 헬퍼(한글 초성 추출 등)
│   ├── charts.js                    ← SVG 차트(레이더/성적 추이), 합격 진단
│   ├── scratchpad.js                ← HTML5 Canvas 손글씨 계산 연습장
│   ├── trainer-calc.js              ← 계산 훈련 문제 생성기(순수 로직)
│   ├── state.js                     ← 전역 상태 + localStorage 영속성 + ID 마이그레이션 실행
│   └── app.js                       ← 메인 앱(SPA 라우팅/렌더링/오디오/퀴즈/모의고사/훈련소)
│
├── 📂 data/                         ← ✅ 배포 (빌드 산출물 — 수정 금지)
│   ├── registry.js                  ← 번들 목록/메타(SSOT의 빌드 결과)
│   ├── id_migration.js              ← 레거시 ID → 안정 ID 일회성 매핑
│   ├── audio_manifest.js            ← 오디오 파일 경로 매니페스트
│   ├── subjects/<key>.<hash>.js     ← 과목별 학습 번들 (law/manufacturing/safety/understanding)
│   ├── exams/<key>.<hash>.js        ← 시험별 문항 번들 (subject1, subject2_p1 …)
│   └── ingredients_data.<hash>.js   ← 성분 사전 번들
│
├── 📂 content/                      ← 🔧 MD/manifest만 Git, HTML은 .vercelignore
│   ├── manifest.json                ← 🆕 단일 진실 원천(SSOT): 과목/단원/파일 정의
│   ├── understanding/ (7단원)        ← 1과목: 맞춤형화장품의 이해
│   ├── safety/ (5단원)              ← 2과목: 유통화장품 안전관리
│   ├── manufacturing/ (5단원)        ← 3과목: 화장품 제조 및 품질관리
│   └── law/ (2단원)                 ← 4과목: 화장품법의 이해
│       └── {번호}.{제목}2026.md      ← .html은 빌드 산출/배포 제외
│
├── 📂 exams/                        ← 🔧 MD만 Git, HTML은 .vercelignore(!exams/*.html로 배포 포함)
│   └── subject{n}_*.md/.html        ← 과목별 모의고사 원본(빌드 입력) + 인쇄용 HTML
│
├── 📂 ingredients/                  ← 🔧 성분 원본 MD (빌드 입력)
│   ├── approved_ingredients.md
│   ├── banned_ingredients.md
│   └── restricted_ingredients.md
│
├── 📂 tools/                        ← ❌ Vercel 제외 (빌드/변환 자동화)
│   ├── build/                       ← 🆕 모듈러 빌드 파이프라인
│   │   ├── index.js                 ← 빌드 엔트리(전체 / --only 부분 빌드)
│   │   ├── manifest-loader.js       ← manifest.json 로드/검증
│   │   ├── id-factory.js            ← 안정 ID 해시 생성(stableId)
│   │   ├── schema.js                ← 번들 스키마/uniqueIds 검증
│   │   ├── report.js                ← 통계 이상 감지 + 마커 감시 리포트
│   │   └── plugins/                 ← textbook / exams / ingredients 플러그인
│   ├── generate_migration_map.js    ← id_migration.js 생성(플러그인 ID 규칙과 동기)
│   ├── convert_study_docs.ps1       ← 교재 MD → HTML 변환(선택)
│   └── generate_pwa_icons.ps1       ← PWA 아이콘 생성(선택)
│
├── 📂 audiobook/                    ← ❌ Vercel 제외 (TTS 오디오 파이프라인, Python)
│   ├── chunks/ · scripts/ · mp3/ · models/
│   ├── *.py (run_pipeline / md_chunker / script_polisher / tts_* / …)
│   └── requirements.txt · README.md · AUDIOBOOK_SUMMARY.md
│
└── 📂 docs/                         ← ⚠️ 선택(HTML 제외, MD 위주)
    ├── MODULAR_DESIGN.md            ← 🆕 모듈러 아키텍처 설계서(권위 문서)
    ├── ARCHITECTURE.md · walkthrough.md · code_review_report.md
    ├── user_manual.md/.html · study_summary.md/.html
    └── VERCEL_DEPLOY_GUIDE.md · VERCEL_SIZE_OPTIMIZATION.md · AUDIO_HOSTING_GUIDE.md · MULTI_MACHINE_SETUP.md
```

> **범례:** ✅ 배포 포함 · 🔧 Git만(HTML 등 일부 제외) · ❌ 배포 제외 · ⚠️ 선택 · 🆕 모듈러 전환으로 추가

---

## 📊 `data/` — 빌드 산출물 (모듈러 번들)

| 파일 | 생성 주체 | 내용 | 캐시 정책 |
|------|-----------|------|-----------|
| `registry.js` | `tools/build/index.js` | 과목·시험·성분 번들 목록/메타(해시 포인터) | 재검증(비해시) |
| `id_migration.js` | `tools/generate_migration_map.js` | 레거시→안정 ID 매핑(일회성) | 재검증(비해시) |
| `audio_manifest.js` | 수동 | 과목/단원별 MP3 경로 | 재검증(비해시) |
| `subjects/<key>.<hash>.js` | textbook 플러그인 | 카드/퀴즈/챕터 | `immutable`(해시) |
| `exams/<key>.<hash>.js` | exams 플러그인 | 시험 문항 | `immutable`(해시) |
| `ingredients_data.<hash>.js` | ingredients 플러그인 | 성분 사전 | `immutable`(해시) |

> ⚠️ 이 파일들은 **수동 편집 금지**. 재생성은 `npm run build:data`(전체) 또는
> `npm run build:data:<과목>` / `node tools/build/index.js --only <key>`(부분).

---

## 🔧 `tools/` — 빌드/변환 자동화

| 스크립트 | 입력 | 출력 | 역할 |
|----------|------|------|------|
| `build/index.js` | `content/manifest.json` + MD | `data/registry.js` + 번들 | 전체/부분 빌드, sw.js 갱신, 검증/리포트 |
| `generate_migration_map.js` | content MD | `data/id_migration.js` | 안정 ID 이관 맵(플러그인과 동일 규칙) |
| `convert_study_docs.ps1` | content MD | content HTML | 교재 HTML 변환(선택) |
| `generate_pwa_icons.ps1` | 원본 아이콘 | icons/*.png | PWA 아이콘(선택) |

> 참고: 과거 `parse_data.js` / `parse_exams.js` / `parse_ingredients.js`(단일 번들 파서)는
> `tools/build/` 파이프라인으로 대체되어 **폐기**되었습니다.

---

## 🔄 데이터 흐름도

```mermaid
graph TD
    M[content/manifest.json (SSOT)] -->|tools/build/index.js| R[data/registry.js]
    M -->|textbook plugin| S[data/subjects/*.hash.js]
    E[exams/*.md] -->|exams plugin| X[data/exams/*.hash.js]
    I[ingredients/*.md] -->|ingredients plugin| G[data/ingredients_data.hash.js]
    M -->|generate_migration_map.js| MIG[data/id_migration.js]
    A[content/**/*.md] -->|audiobook pipeline| MP3[audiobook/mp3/*.mp3]
    MP3 -->|manual mapping| AM[data/audio_manifest.js]

    R --> IDX[index.html]
    AM --> IDX
    MIG --> IDX
    IDX --> DL[src/data-loader.js]
    DL -->|on demand| S
    DL -->|on demand| X
    DL -->|on demand| G
    IDX --> APP[src/app.js + state/charts/… ]
```

---

## 🚀 주요 명령어

```bash
# 로컬 개발 서버
node serve.js 8001      # http://localhost:8001/index.html

# 데이터 빌드(전체)
npm run build:data

# 부분 빌드(변경 과목만)
npm run build:data:law            # 또는
node tools/build/index.js --only law,safety

# 안정 ID 이관 맵 재생성(퀴즈 ID 규칙 변경 시 함께)
node tools/generate_migration_map.js

# 오디오북 생성
cd audiobook && pip install -r requirements.txt && python run_pipeline.py
```

---

## 📝 파일 명명 규칙

교재/시험 원본 파일명과 그 참조는 `content/manifest.json`의 `dir`/`file` 필드가 기준입니다.
번들 산출물은 `{key}.{contentHash}.js` 규칙으로 생성됩니다(수동 명명 금지).

---

**문서 버전**: 2.0 (모듈러 아키텍처)
