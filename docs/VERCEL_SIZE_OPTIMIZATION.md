# 📦 Vercel 배포 크기 최적화 가이드

> **대상 프로젝트**: 맞춤형화장품 조제관리사 스마트 학습 플랫폼  
> **최종 업데이트**: 2026-08-21  
> **목적**: Vercel Hobby 플랜(100MB 제한)에 맞춰 프로젝트 크기 최적화

---

## 📊 현재 크기 분석

| 구분 | 크기 | 비율 | Vercel 배포 여부 |
|------|------|------|----------------|
| **전체 프로젝트** | **~1.03 GB** | 100% | ❌ 불가능 |
| `content/**/*.html` | 501 MB | 48.6% | ❌ 제외 필요 |
| `audiobook/mp3/` | 302 MB | 29.3% | ❌ 제외 필요 |
| ~~`exams/**/*.html`~~ | ~~220 MB~~ | — | 🗑️ **삭제됨** (2026-08-24, 런타임 MD 뷰어로 대체) |
| `data/*.js` | 1.88 MB | 0.2% | ✅ 포함 |
| `src/*.js` | 0.22 MB | 0.02% | ✅ 포함 |
| `docs/` (MD만) | 4.64 MB | 0.5% | ✅ 포함 |
| `content/ingredients/` | 0.26 MB | 0.03% | ✅ 포함 |
| 루트 파일 (`index.html`, `style.css` 등) | 0.82 MB | 0.08% | ✅ 포함 |
| **배포 대상 합계** | **~7.8 MB** | **0.8%** | ✅ **배포 가능** |

---

## 🎯 최적화 전략

### 전략 A: 정적 사이트만 배포 (기본, 권장)

앱의 핵심 기능(학습, 퀴즈, 모의고사)은 `data/*.js`에 내장되어 있으므로, 대용량 HTML과 MP3 없이도 동작합니다.

**배포 대상 (총 ~7.8 MB):**
```
Personalized_Skincare/
├── index.html          # 진입점 (0.82 MB 루트 파일 중 일부)
├── style.css           # 스타일
├── serve.js            # 로컬 개발용 (배포 불필요하지만 크기 작음)
├── vercel.json         # Vercel 설정
├── .vercelignore       # 배포 제외 목록
├── .gitignore          # Git 추적 제외 목록
│
├── src/                # 앱 로직 (0.22 MB)
│   ├── app.js          # 메인 로직 (오디오 CDN 지원 추가됨)
│   ├── charts.js
│   ├── sanitize.js
│   ├── scratchpad.js
│   └── state.js
│
├── data/               # 데이터 번들 (1.88 MB)
│   ├── study_data.js
│   ├── exam_data.js
│   ├── ingredients_data.js
│   └── audio_manifest.js  # AUDIO_BASE_URL 설정 추가됨
│
├── docs/               # 문서 (MD + 앱 링크용 HTML 포함, ~4.6 MB)
│   ├── user_manual.md
│   ├── user_manual.html      # ✅ 배포 포함 (앱에서 "사용자 매뉴얼" 링크로 엶)
│   ├── study_summary.md
│   ├── study_summary.html    # ✅ 배포 포함 (앱에서 "핵심 단권화 요약집" 링크로 엶)
│   ├── VERCEL_DEPLOY_GUIDE.md
│   └── VERCEL_SIZE_OPTIMIZATION.md  # 본 문서
│
├── content/            # 📚 학습 교재 및 성분 원본 (MD만, HTML 제외)
│   ├── understanding/*.md
│   ├── safety/*.md
│   ├── manufacturing/*.md
│   ├── law/*.md
│   └── ingredients/    # 성분 데이터 (0.26 MB)
│       ├── approved_ingredients.md
│       ├── banned_ingredients.md
│       └── restricted_ingredients.md
│
├── exams/              # 📝 시험 원본 (MD만 — 정적 HTML은 2026-08-24 삭제됨)
│   └── *.md
```

**제외 대상 (`.vercelignore` 적용됨):**
- `audiobook/` — MP3, 파이썬 스크립트, TTS 모델
- `content/**/*.html` — 비대화된 HTML (MD 원본은 유지)
- ~~`exams/**/*.html`~~ — **2026-08-24부터 해당 없음**: 정적 시험지 HTML은 삭제되고
  `src/exam-viewer.js`가 `exams/*.md`를 런타임에 HTML로 변환해 전체화면 오버레이로 표시합니다.
  `exams/*.md`(원본)와 `data/exams_md/*.js`(file:// 폴리백 번들)는 `*.html` 규칙에 걸리지 않아 그대로 배포됩니다.
- `archive/` — 아카이브된 중복 원본 폴터 (구 `2026 *` 폴터들)
- `tools/`, `__pycache__/` — 개발 도구

> ⚠️ **`.vercelignore`의 `*.html` 예외 규칙**
> 기본적으로 모든 `*.html`을 제외하되, 아래는 반드시 배포에 포함합니다.
> ```
> *.html
> !index.html        # 앱 진입점
> !docs/*.html       # 앱 내 링크로 여는 매뉴얼/요약집 (없으면 404)
> ```
> `docs/*.html`을 예외 처리하지 않으면 배포 환경에서 "사용자 매뉴얼" 링크가 404가 됩니다.

---

### 전략 B: 오디오 외부 호스팅 (기능 확장)

MP3 파일(302MB)을 외부에 두고 앱에서 스트리밍합니다.

#### 옵션 1: GitHub Releases (묘료, 간단)

1. **MP3 업로드:**
   ```bash
   # audiobook/mp3/ 폴터를 ZIP으로 압축
   # GitHub 저장소 → Releases → New release → ZIP 업로드
   ```

2. **URL 형식:**
   ```
   https://github.com/{username}/{repo}/releases/download/v1.0/audio.zip
   ```
   > ⚠️ 단일 MP3 파일을 직접 올리려면 GitHub Pages 또는 raw URL 사용

#### 옵션 2: 별도 Vercel 프로젝트 (권장)

1. **새 저장소 생성:** `personalized-skincare-audio`
2. **MP3만 포함:** `audiobook/mp3/` 내용만 복사
3. **Vercel 배포:** 정적 사이트로 배포
4. **도메인:** `https://personalized-skincare-audio.vercel.app`

#### 옵션 3: Cloudflare R2 / AWS S3 (대용량, 저렴)

- Cloudflare R2: 10GB 묘료, egress 묘료
- AWS S3 + CloudFront: 대규모 트래픽에 적합

#### 설정 방법

`data/audio_manifest.js` 파일 상단의 `AUDIO_BASE_URL`을 수정:

```javascript
// 로컬 개발: null
const AUDIO_BASE_URL = null;

// 외부 CDN 사용 시:
const AUDIO_BASE_URL = 'https://personalized-skincare-audio.vercel.app';
// 또는
const AUDIO_BASE_URL = 'https://pub-xxxx.r2.dev';
```

---

### 전략 C: 완전 분리 (모노레포)

장기적으로 콘텐츠와 앱을 분리 관리합니다.

```
Personalized_Skincare/
├── apps/
│   └── web/                    # Vercel 배포 (3MB)
│       ├── index.html
│       ├── src/
│       └── data/
├── packages/
│   ├── content/                # MD 원본 (Git 관리)
│   ├── exams/                  # MD 원본 (Git 관리)
│   └── audio/                  # MP3 (Git LFS 또는 외부)
└── tools/                      # 빌드 스크립트
```

---

## 🚀 배포 절차

### 1. 사전 준비

```bash
# 1) Git 저장소 초기화 (최초 1회)
git init

# 2) .gitignore와 .vercelignore 확인
#    → 대용량 파일이 제외되었는지 확인

# 3) 스테이징 전 크기 확인
git add .
git status
# → audiobook/, content/**/*.html 등이 Untracked로 표시되면 정상
```

### 2. GitHub 업로드

```bash
git add .
git commit -m "Optimize for Vercel deployment: exclude large media files"
git remote add origin https://github.com/your-username/skincare-study-app.git
git branch -M main
git push -u origin main
```

### 3. Vercel 배포

1. [vercel.com](https://vercel.com) → **Add New → Project**
2. GitHub 저장소 Import
3. **Configure Project** (모두 기본값 유지):
   - Framework Preset: `Other`
   - Root Directory: `./`
   - Build Command: *(비워둠)*
   - Output Directory: *(비워둠)*
4. **Deploy** 클릭

### 4. 배포 확인

```bash
# Vercel CLI로 로컬 테스트 (선택)
npm i -g vercel
vercel dev
```

---

## ⚠️ 주의사항

### HTML 파일이 비대화된 이유

`content/**/*.html` 파일들이 **인라인 CSS/JS**를 포함하여 수백만 라인에 달합니다. 예:
- `content/manufacturing/1.화장품...html`: **176 MB** (4,099,170 라인)
- `content/law/1.화장품법2026.html`: **113 MB** (1,736,376 라인)

이 파일들은 `tools/convert_study_docs.ps1`로 MD에서 생성된 것으로, 앱에서는 `data/subjects/*.js` 번들을 사용하므로 HTML이 필요 없습니다.

> 📌 같은 문제였던 `exams/**/*.html`(~220MB)은 2026-08-24에 **전량 삭제**되어 더 이상 제외 대상이 아닙니다.
> 문제집은 이제 `exams/*.md` 원본을 `src/exam-viewer.js`가 런타임 변환해 보여줍니다.

### 오디오 기능 사용 시

현재 `.vercelignore`로 MP3가 제외되어 있어, 배포된 앱에서는 **오디오 재생이 불가능**합니다. 오디오 기능을 사용하려면:

1. **전략 B**의 외부 호스팅 설정
2. `data/audio_manifest.js`의 `AUDIO_BASE_URL` 수정
3. Git commit → push → Vercel 자동 재배포

---

## 📁 정리된 폴터 구조

```
Personalized_Skincare/
│
├── 📄 index.html                    # ✅ Vercel 배포
├── 📄 style.css                     # ✅ Vercel 배포
├── 📄 serve.js                      # 로컬 개발용 (배포 불필요)
│
├── 📂 src/                          # ✅ Vercel 배포
│   ├── app.js                       # 메인 로직 (오디오 CDN 지원 추가됨)
│   ├── charts.js
│   ├── sanitize.js
│   ├── scratchpad.js
│   └── state.js
│
├── 📂 data/                         # ✅ Vercel 배포
│   ├── study_data.js
│   ├── exam_data.js
│   ├── ingredients_data.js
│   └── audio_manifest.js            # AUDIO_BASE_URL 설정 추가됨
│
├── 📂 docs/                         # ⚠️ 선택적 (HTML 제외, MD만)
│   ├── user_manual.md
│   ├── study_summary.md
│   ├── VERCEL_DEPLOY_GUIDE.md
│   └── VERCEL_SIZE_OPTIMIZATION.md  # 본 문서
│
├── 📂 content/                      # 🔧 MD만 Git 관리, HTML은 .vercelignore
│   ├── understanding/*.md
│   ├── safety/*.md
│   ├── manufacturing/*.md
│   ├── law/*.md
│   └── ingredients/                 # ✅ Vercel 배포 (MD 원본)
│       └── *.md
│
├── 📂 exams/                        # ✅ MD 원본 (정적 HTML 폐지 — 런타임 뷰어로 대체)
│   └── *.md
│
├── 📂 archive/                      # ❌ Vercel 제외 (아카이브된 중복 원본)
│   ├── 2026 맞춤형화장품의 이해/
│   ├── 2026 유통화장품 안전관리/
│   ├── 2026 화장품 제조 및 품질관리/
│   └── 2026 화장품법의 이해/
│
├── 📂 audiobook/                    # ❌ Vercel 제외 (302MB)
│   ├── mp3/                         # 외부 CDN으로 이동 권장
│   └── *.py                         # 파이썬 스크립트
│
├── 📂 tools/                        # ❌ Vercel 제외 (빌드 도구)
│   └── *.js, *.ps1
│
├── 📄 .vercelignore                 # 🆕 Vercel 배포 제외 목록
├── 📄 .gitignore                    # 🆕 Git 추적 제외 목록
├── 📄 vercel.json                   # 🆕 Vercel SPA 설정
└── 📄 FOLDER_STRUCTURE.md           # 기존 문서
```

---

## 🔧 문제 해결

### Q: Vercel에서 "File size limit exceeded" 오류 발생

**A:** `.vercelignore`가 적용되지 않았거나, Git에 이미 대용량 파일이 커밋되었을 수 있습니다.

```bash
# Git 캐시 정리 후 재업로드
git rm -r --cached .
git add .
git commit -m "Remove large files from tracking"
git push
```

### Q: 오디오가 재생되지 않음

**A:** `data/audio_manifest.js`의 `AUDIO_BASE_URL`이 `null`이면 로컬 파일을 찾습니다. 외부 CDN URL을 설정하세요.

### Q: 로컬에서는 오디오가 재생됨

**A:** 정상입니다. 로컬 개발 시 `audiobook/mp3/`가 존재하므로 재생됩니다. Vercel 배포 시에만 외부 URL이 필요합니다.

---

## 📚 참고 자료

- [Vercel 공식 문서 - 파일 크기 제한](https://vercel.com/docs/concepts/limits/overview#file-size)
- [GitHub Releases - 대용량 파일 호스팅](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [Cloudflare R2 - 객체 스토리지](https://developers.cloudflare.com/r2/)
