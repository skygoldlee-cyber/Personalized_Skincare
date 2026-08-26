# 📱 Vercel 배포 및 오디오북 호스팅 종합 가이드 (Deployment & Hosting)

> **대상 프로젝트**: 맞춤형화장품 조제관리사 스마트 학습 플랫폼 (Cosmetic Pass Master)  
> **최종 업데이트**: 2026-08-26  
> **목적**: Vercel 무료 Hobby 플랜(100MB 한도)에 맞춰 프로젝트 크기를 최적화하고, 대용량 오디오북을 연동하여 스마트폰 홈 화면에 설치(PWA)하는 배포 프로세스 가이드

---

## 📋 목차
1. [Vercel 프로젝트 저장 정보](#1-vercel-프로젝트-저장-정보)
2. [배경 및 용량 분석](#2-배경-및-용량-분석)
3. [Vercel 배포 최적화 (.vercelignore 설정)](#3-vercel-배포-최적화-vercelignore-설정)
4. [vercel.json 헤더 및 캐시 정책](#4-verceljson-헤더-및-캐시-정책)
5. [Vercel 서비스 배포 방법](#5-vercel-서비스-배포-방법)
6. [대용량 오디오북 외부 호스팅 (GitHub Releases)](#6-대용량-오디오북-외부-호스팅-github-releases)
7. [모바일 기기 설치 및 PWA 등록](#7-모바일-기기-설치-및-pwa-등록)

---

## 1. Vercel 프로젝트 저장 정보

### 1-1. 프로젝트 식별 정보 (`.vercel/project.json`)

| 항목 | 값 |
|------|-----|
| **projectId** | `prj_706IdDze2DZsNwjADIfhvsfWL3HW` |
| **orgId** | `team_P4ciaJGD9bvDziPxZM6FOCSK` |
| **projectName** | `personalized-skincare-study` |
| **프로덕션 URL** | `https://personalized-skincare-study.vercel.app` |
| **Vercel 대시보드** | `https://vercel.com/skygold/personalized-skincare-study` |

> `.vercel/project.json`은 `.gitignore`에 의해 Git에 커밋되지 않지만, `.vercelignore`에서 `.vercel/`이 배포 제외되므로 로컬에만 존재합니다. 새 머신에서는 `vercel` 명령 한 번으로 자동 생성됩니다.

### 1-2. Git 원격 저장소

| 항목 | 값 |
|------|-----|
| **remote origin** | `git@github-skygold:skygoldlee-cyber/Personalized_Skincare.git` (SSH 별칭) |
| **브랜치** | `main` |
| **GitHub URL** | `https://github.com/skygoldlee-cyber/Personalized_Skincare` |

### 1-3. 인증 방식

| 서비스 | 방식 | 비고 |
|--------|------|------|
| **GitHub** | SSH 키 (`github-skygold` 별칭) | `~/.ssh/config`에 별칭 정의 필요 |
| **Vercel CLI** | 글로벌 로그인 (브라우저 OAuth) | `vercel login` 1회 수행 → 토큰 자동 저장 |

> 새 머신 설정이 필요한 경우 [`docs/MULTI_MACHINE_SETUP.md`](MULTI_MACHINE_SETUP.md) 참조.

### 1-4. 배포 전 빌드 파이프라인

배포 전 반드시 다음 순서로 빌드 및 테스트를 수행합니다:

```bash
# 1. 데이터 빌드 (content/*.md → data/*.hash.js 번들 생성)
node tools/build/index.js

# 2. 단위 테스트 (86개)
npm test

# 3. Vercel 프로덕션 배포
cmd /c vercel --prod
```

> ⚠️ `npx vercel` 대신 `cmd /c vercel --prod`를 사용합니다 (Windows pwsh 환경).

---

## 2. 배경 및 용량 분석

본 플랫폼의 19개 챕터 오디오북 MP3 파일의 합계는 **약 302MB**입니다. Vercel 무료 Hobby 플랜은 1회 배포 시 프로젝트의 총용량을 **100MB**로 제한하므로, 오디오 파일을 프로젝트 소스코드와 함께 배포할 수 없습니다.

따라서 다음과 같은 **최적화 및 분할 호스팅 전략**을 적용합니다.
- **정적 사이트 최적화**: 미사용 HTML 파일 및 오디오북 폴더를 배포 대상에서 완전히 제외하여 배포 크기를 약 **7.8MB (한도의 7.8%)** 수준으로 압축합니다.
- **오디오북 외부 호스팅**: MP3 파일은 무료이며 대역폭 제한이 넉넉한 **GitHub Releases**에 업로드하여 스트리밍 연동합니다.

### 📊 프로젝트 공간 구성 분석 (2026년 8월 기준)

| 구분 | 실제 용량 | Vercel 배포 여부 | 최적화 조치 |
|---|---|---|---|
| `content/audiobook/mp3/` | 302 MB | ❌ 배포 제외 | 외부 GitHub Releases로 호스팅 우회 |
| `content/**/*.html` | 501 MB | ❌ 배포 제외 | 빌드타임/런타임에서 마크다운 파싱 뷰어로 완전 대체 |
| `src/*.js` 및 `style.css` | ~1.2 MB | ✅ 배포 포함 | 앱 실행 핵심 코드 |
| `data/` (레지스트리, 통계) | 1.88 MB | ✅ 배포 포함 | DB 대체 정적 리소스 |
| `docs/` (사용자 매뉴얼 등) | 4.64 MB | ✅ 배포 포함 | 핵심 매뉴얼 마크다운 및 HTML |
| **최종 배포 대상 합계** | **~7.8 MB** | ✅ **배포 가능** | **용량 한도(100MB) 안정권 진입** |

---

## 3. Vercel 배포 최적화 (.vercelignore 설정)

정적 자원만 Vercel에 업로드되도록 하기 위해 프로젝트 루트의 [`.vercelignore`](file:///c:/Project/Personalized_Skincare/.vercelignore) 파일에 다음과 같은 규칙을 설정합니다.

```
# .vercelignore

# 1. 오디오북 소스코드 및 대용량 MP3 폴더 통째로 제외
content/audiobook/

# 2. 빌드타임에서 런타임 MD 변환으로 대체되어 더 이상 쓰지 않는 HTML 파일들 제외
content/**/*.html
exams/**/*.html

# 3. 개발 도구 및 로컬 가상 환경 제외
tools/
__pycache__/
.env.local

# 4. HTML 예외 처리 (매뉴얼 및 요약집 포함용)
*.html
!index.html        # 메인 진입점은 포함
!docs/*.html       # 앱 내 메뉴로 여는 매뉴얼 및 요약본은 포함 (누락 시 404 에러 발생)
```

---

## 5. Vercel 서비스 배포 방법

### 방법 A: Vercel CLI 직접 배포 (현재 사용 방식)

Git push 후 터미널에서 직접 배포합니다. 현재 프로젝트에서 사용하는 방식입니다.

```bash
# 1. 빌드
node tools/build/index.js

# 2. 테스트
npm test

# 3. Git 커밋 및 푸시
git add -A && git commit -m "feat: ..." && git push origin main

# 4. Vercel 배포 (Windows pwsh)
cmd /c vercel --prod
```

배포 완료 후 출력 예:
```
✓ Ready in 6s
Production:  https://personalized-skincare-study.vercel.app
```

### 방법 B: GitHub 연동 자동 배포
코드를 수정하고 `git push`를 실행하면 Vercel이 변경 사항을 감지하여 자동으로 다시 배포해 줍니다.

1. **GitHub 저장소 만들기**: GitHub 로그인 후 **New repository**를 생성합니다 (예: `skincare-study-app`). README는 추가하지 않고 빈 상태로 생성합니다.
2. **로컬 저장소 연결 및 푸시**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/본인아이디/skincare-study-app.git
   git branch -M main
   git push -u origin main
   ```
3. **Vercel 연동**: Vercel 대시보드에 접속하여 **Add New... ➔ Project**를 클릭하고 방금 업로드한 GitHub 저장소를 **Import**합니다.
4. **프로젝트 빌드 설정**: 빌드 옵션(Framework Preset: *Other*, Build/Output Command: *비워둠*)은 수정 없이 기본값으로 두고 **Deploy**를 클릭합니다. 약 30초 후 배포가 완료됩니다.

### 방법 C: GitHub Actions 자동 배포

`git push`만 하면 GitHub가 자동으로 Vercel 배포를 수행합니다. 설정 방법은 [`docs/MULTI_MACHINE_SETUP.md`](MULTI_MACHINE_SETUP.md)의 "GitHub Actions로 배포 자동화" 섹션을 참조하세요.

> ⚠️ 수동 배포(방법 A)와 자동 배포(방법 C)를 혼용하면 충돌이 발생할 수 있으므로 하나를 선택하세요.

---

## 4. vercel.json 헤더 및 캐시 정책

[`vercel.json`](../vercel.json)은 CSP 헤더, 보안 헤더, 캐시 정책을 정의합니다.

### 4-1. Content-Security-Policy (CSP)

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
img-src 'self' data:;
font-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src 'self' 'unsafe-eval';
connect-src 'self';
worker-src 'self';
manifest-src 'self'
```

- `script-src 'self' 'unsafe-eval'`: 자체 JS만 허용 (inline script 차단). `unsafe-eval`은 빌드 산출물 호환성을 위해 유지
- `connect-src 'self'`: 외부 API 호출 차단 (오디오는 GitHub Releases URL이 `connect-src`가 아닌 `media-src`로 처리됨 — 사운드 파일은 `<audio>` 태그로 로드되어 CSP `media-src` 제한이 없으면 허용)
- `frame-ancestors 'none'`: 클릭재킹 방지

### 4-2. 보안 헤더

| 헤더 | 값 | 목적 |
|------|-----|------|
| `X-Content-Type-Options` | `nosniff` | MIME 스니핑 방지 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer 정보 제한 |
| `X-Frame-Options` | `DENY` | iframe 삽입 차단 |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()` | 디바이스 API 접근 차단 |

### 4-3. 캐시 정책

| 경로 | Cache-Control | 이유 |
|------|---------------|------|
| `/sw.js` | `no-cache, no-store, must-revalidate` | Service Worker는 항상 최신 |
| `/manifest.webmanifest` | `public, max-age=0, must-revalidate` | PWA 매니페스트 즉시 갱신 |
| `/index.html` | `public, max-age=0, must-revalidate` | 진입점 항상 최신 |
| `/src/(.*)` | `public, max-age=0, must-revalidate` | JS 모듈 배포 시 즉시 반영 |
| `/data/registry.js` | `public, max-age=0, must-revalidate` | 레지스트리 갱신 즉시 반영 |
| `/data/audio_manifest.js` | `public, max-age=0, must-revalidate` | 오디오 매니페스트 갱신 즉시 반영 |
| `/data/id_migration.js` | `public, max-age=0, must-revalidate` | 마이그레이션 맵 갱신 |
| `/data/exams/(.*)` | `public, max-age=31536000, immutable` | 해시 파일명 — 1년 불변 캐시 |
| `/data/ingredients_data.(.*)` | `public, max-age=31536000, immutable` | 해시 파일명 — 1년 불변 캐시 |

---

## 6. 대용량 오디오북 외부 호스팅 (GitHub Releases)

Vercel 용량 한도를 피하기 위해 대용량 MP3 파일은 **GitHub Releases** 공간에 릴리스 파일(Binaries) 형식으로 호스팅하여 무제한 다운로드 대역폭과 Range 요청(이어듣기) 지원을 무료로 확보합니다.

### 6-1. GitHub Release 생성 및 MP3 업로드
1. GitHub 저장소의 우측 메뉴에서 **Releases** ➔ **Create a new release**를 클릭합니다.
2. **Tag version**에 `audiobook-v1`을 입력하고 타이틀을 `Audiobook v1`으로 정합니다.
3. 19개 챕터의 통합 MP3 파일들을 **Attach binaries** 영역에 드래그 앤 드롭하여 업로드한 후 **Publish release**를 클릭합니다.
4. 업로드된 파일의 개별 URL은 다음과 같은 고정 규칙을 가집니다.
   ```
   https://github.com/skygoldlee-cyber/Personalized_Skincare/releases/download/audiobook-v1/ch01_1_화장품법.mp3
   ```

### 6-2. 오디오 매니페스트 연동 코드 수정
업로드된 주소를 앱에서 접근할 수 있도록 [`data/audio_manifest.js`](file:///c:/Project/Personalized_Skincare/data/audio_manifest.js) 파일을 수정합니다.

- **`AUDIO_BASE_URL` 설정**:
  ```javascript
  // data/audio_manifest.js
  const AUDIO_BASE_URL = 'https://github.com/skygoldlee-cyber/Personalized_Skincare/releases/download/audiobook-v1';
  ```
- **`getAudioUrl()` 경로 해소 로직**: GitHub Releases 에셋은 폴더 깊이 구조를 지원하지 않고 단일 경로 아래 파일명으로 서빙하므로, 파일 경로를 조합할 때 중간 과목 폴더명을 제외하도록 수정합니다.
  ```javascript
  export function getAudioUrl(chapterNo, subjectKey) {
      const filename = getAudioFilename(chapterNo, subjectKey);
      if (!filename) return null;
      if (AUDIO_BASE_URL) {
          // Releases 다운로드 URL: BASE_URL + 파일명
          return `${AUDIO_BASE_URL}/${filename}`;
      }
      // 로컬 개발 폴백 경로
      return `./content/audiobook/mp3/${subjectKey}/${filename}`;
  }
  ```

---

## 7. 모바일 기기 설치 및 PWA 등록

스마트폰에서 모바일 앱처럼 깔끔하게 설치하여 홈 화면에 두고 실행하는 방법입니다.

### iOS (사파리)
1. **Safari** 브라우저를 열고 내 Vercel 배포 주소(예: `https://your-app.vercel.app`)로 접속합니다.
2. 하단의 **공유(Share) 버튼**을 클릭합니다.
3. 메뉴 목록에서 **"홈 화면에 추가(Add to Home Screen)"**를 선택합니다.
4. 이름을 설정한 뒤 완료하면 모바일 바탕화면에 바로가기 아이콘이 생기며, 이후에는 주소창 없는 전체 화면의 네이티브 앱 형태로 공부할 수 있습니다.

### Android (크롬)
1. **Chrome** 브라우저로 배포 사이트에 접속합니다.
2. 주소창 우측의 더보기(점 3개) 버튼을 누릅니다.
3. **"홈 화면에 추가"** 또는 **"앱 설치"** 항목을 클릭하여 지시에 따라 설치를 마칩니다.
