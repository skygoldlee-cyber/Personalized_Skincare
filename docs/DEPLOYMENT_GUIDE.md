# 📱 Vercel 배포 및 오디오북 호스팅 종합 가이드 (Deployment & Hosting)

> **대상 프로젝트**: 맞춤형화장품 조제관리사 스마트 학습 플랫폼 (Cosmetic Pass Master)  
> **최종 업데이트**: 2026-08-25  
> **목적**: Vercel 무료 Hobby 플랜(100MB 한도)에 맞춰 프로젝트 크기를 최적화하고, 대용량 오디오북을 연동하여 스마트폰 홈 화면에 설치(PWA)하는 배포 프로세스 가이드

---

## 📋 목차
1. [배경 및 용량 분석](#1-배경-및-용량-분석)
2. [Vercel 배포 최적화 (.vercelignore 설정)](#2-vercel-배포-최적화-vercelignore-설정)
3. [Vercel 서비스 배포 방법](#3-vercel-서비스-배포-방법)
4. [대용량 오디오북 외부 호스팅 (GitHub Releases)](#4-대용량-오디오북-외부-호스팅-github-releases)
5. [모바일 기기 설치 및 PWA 등록](#5-모바일-기기-설치-및-pwa-등록)

---

## 1. 배경 및 용량 분석

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

## 2. Vercel 배포 최적화 (.vercelignore 설정)

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

## 3. Vercel 서비스 배포 방법

### 방법 A: GitHub 연동 자동 배포 (권장)
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

### 방법 B: Vercel CLI 직접 배포 (가장 빠름)
Git 연동 없이 터미널 명령어 하나로 현재 로컬 상태를 즉시 배포합니다.

1. **Vercel CLI 설치**:
   ```bash
   npm install -g vercel
   ```
2. **배포 명령어 실행**:
   ```bash
   vercel --prod
   ```
3. 터미널의 대화형 프롬프트에 따라 엔터를 누르고 연동하면 배포 URL이 즉시 생성됩니다.

---

## 4. 대용량 오디오북 외부 호스팅 (GitHub Releases)

Vercel 용량 한도를 피하기 위해 대용량 MP3 파일은 **GitHub Releases** 공간에 릴리스 파일(Binaries) 형식으로 호스팅하여 무제한 다운로드 대역폭과 Range 요청(이어듣기) 지원을 무료로 확보합니다.

### 4-1. GitHub Release 생성 및 MP3 업로드
1. GitHub 저장소의 우측 메뉴에서 **Releases** ➔ **Create a new release**를 클릭합니다.
2. **Tag version**에 `audiobook-v1`을 입력하고 타이틀을 `Audiobook v1`으로 정합니다.
3. 19개 챕터의 통합 MP3 파일들을 **Attach binaries** 영역에 드래그 앤 드롭하여 업로드한 후 **Publish release**를 클릭합니다.
4. 업로드된 파일의 개별 URL은 다음과 같은 고정 규칙을 가집니다.
   ```
   https://github.com/skygoldlee-cyber/Personalized_Skincare/releases/download/audiobook-v1/ch01_1_화장품법.mp3
   ```

### 4-2. 오디오 매니페스트 연동 코드 수정
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

## 5. 모바일 기기 설치 및 PWA 등록

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
