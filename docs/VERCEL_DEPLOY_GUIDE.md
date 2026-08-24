# 📱 Vercel 배포 가이드 — 스마트폰에서 학습 앱 보기

> **대상 프로젝트**: 맞춤형화장품 조제관리사 스마트 학습 플랫폼
> **난이도**: ⭐ (쉬움) · **소요 시간**: 약 10~15분 · **비용**: 묘료 (Hobby 플랜, 비용 0원)
>
> 이 프로젝트는 **순수 정적 사이트**(HTML + CSS + JS, 빌드 도구 없음)이므로
> Vercel에 그대로 올리면 바로 동작합니다. 서버 설정이나 코드 수정이 필요 없습니다.

---

## 📋 목차

1. [사전 준비물](#1-사전-준비물)
2. [배포 방법 A — GitHub 연동 (자동 재배포, 권장)](#2-배포-방법-a--github-연동-자동-재배포-권장)
3. [배포 방법 B — Vercel CLI (가장 빠름)](#3-배포-방법-b--vercel-cli-가장-빠름)
4. [배포 방법 C — 웹에서 Drag & Drop](#4-배포-방법-c--웹에서-drag--drop)
5. [스마트폰에서 접속하기](#5-스마트폰에서-접속하기)
6. [홈 화면에 앱처럼 추가하기](#6-홈-화면에-앱처럼-추가하기)
7. [문제 해결 (FAQ)](#7-문제-해결-faq)
8. [참고 사항](#8-참고-사항)

---

## 1. 사전 준비물

| 준비물 | 설명 | 방법별 필요 여부 |
|---|---|---|
| ✅ **Vercel 계정** | [vercel.com](https://vercel.com) 에서 가입 (Hobby 플랜은 묘료) | A, B, C 모두 필요 |
| ✅ **GitHub 계정** | [github.com](https://github.com) 에서 가입 | 방법 A만 필요 |
| ✅ **Git** (선택) | [git-scm.com](https://git-scm.com) 에서 다운로드 | 방법 A에서 권장 |
| ✅ **Node.js** (선택) | [nodejs.org](https://nodejs.org) LTS 버전 | 방법 B만 필요 |

> 💡 **어떤 방법을 선택해야 할까요?**
> - 내용을 자주 수정하고 **자동으로 다시 배포**하고 싶다 → **방법 A (GitHub)**
> - 지금 당장 1분 안에 올리고 싶다 → **방법 B (CLI)** 또는 **방법 C (Drag & Drop)**

---

## 2. 배포 방법 A — GitHub 연동 (자동 재배포, 권장)

코드를 수정한 뒤 `git push`만 하면 Vercel이 **자동으로 재배포**해 주는 방식입니다.

### 2-1. GitHub에 저장소(Repository) 만들기

1. [github.com](https://github.com) 로그인 → 오른쪽 위 **`+`** → **New repository** 클릭
2. 저장소 이름 입력 (예: `skincare-study-app`)
3. **Public** 선택 (Private도 가능하지만 묘료 플랜에서는 일부 기능에 제한이 있을 수 있음)
4. **"Add a README" 는 체크하지 않기** (프로젝트에 이미 파일이 있으므로)
5. **Create repository** 클릭

### 2-2. 이 프로젝트를 GitHub에 업로드

VS Code에서 터미널을 열고 (`` Ctrl+` ``) 아래 명령을 순서대로 실행합니다:

```bash
# 1) Git 저장소 초기화 (최초 1회)
git init

# 2) 모든 파일 스테이징
git add .

# 3) 첫 커밋
git commit -m "Initial commit: skincare study app"

# 4) GitHub 저장소와 연결 (아래 URL을 본인 것으로 변경!)
git remote add origin https://github.com/본인아이디/skincare-study-app.git

# 5) 업로드
git branch -M main
git push -u origin main
```

> ⚠️ `본인아이디/skincare-study-app` 부분은 2-1에서 만든 저장소 주소로 바꿔주세요.
> GitHub 페이지 상단의 초록색 **Code** 버튼을 누륩면 주소를 복사할 수 있습니다.

### 2-3. Vercel에 연결

1. [vercel.com](https://vercel.com) 로그인 → 대시보드에서 **"Add New..." → "Project"** 클릭
2. **"Continue with GitHub"** 로 GitHub 계정 연동 (처음이면 권한 승인 필요)
3. 저장소 목록에서 방금 만든 `skincare-study-app` 옆의 **"Import"** 클릭
4. **Configure Project** 화면이 나오면 — **아무것도 바꾸지 말고** 그대로 둡니다:

   | 설정 항목 | 값 (그대로 두기) |
   |---|---|
   | Framework Preset | `Other` |
   | Root Directory | `./` |
   | Build Command | *(비워둠)* |
   | Output Directory | *(비워둠)* |
   | Install Command | *(비워둠)* |

5. **"Deploy"** 버튼 클릭 🚀
6. 약 30초~1분 후 **"Congratulations!"** 화면이 뜨면 배포 완료!

### 2-4. 이후 업데이트 방법

내용을 수정한 후 터미널에서:

```bash
git add .
git commit -m "내용 수정"
git push
```

→ Vercel이 감지해서 **자동으로 재배포**됩니다. (보통 1분 이내 반영)

---

## 3. 배포 방법 B — Vercel CLI (가장 빠름)

GitHub 없이 명령어 한 방에 올리는 방식입니다.

### 3-1. Vercel CLI 설치 (최초 1회)

터미널에서:

```bash
npm install -g vercel
```

> Node.js가 없다면 먼저 [nodejs.org](https://nodejs.org)에서 LTS 버전을 설치하세요.

### 3-2. 로그인

```bash
vercel login
```

→ 이메일 주소를 입력하면 인증 메일이 발송됩니다. 메일의 **"Verify"** 링크를 클릭하세요.

### 3-3. 배포

프로젝트 폴터 위치(`c:\Project\Personalized Skincare`)에서 터미널을 열고:

```bash
vercel
```

처음 실행하면 몇 가지 질문이 나옵니다:

| 질문 | 입력 |
|---|---|
| `Set up and deploy ...?` | `Y` (엔터) |
| `Which scope...?` | 본인 계정 선택 (엔터) |
| `Link to existing project?` | `N` (엔터) |
| `What's your project's name?` | 원하는 이름 입력 (예: `skincare-app`) |
| `In which directory is your code located?` | `./` (엔터) |
| `Want to modify these settings?` | `N` (엔터) |

→ 배포가 완료되면 `https://skincare-app-xxxx.vercel.app` 형태의 주소가 출력됩니다.

### 3-4. 이후 업데이트 방법

내용 수정 후 다시:

```bash
vercel --prod
```

---

## 4. 배포 방법 C — 웹에서 Drag & Drop

Git도 Node.js도 없이, 마우스만으로 올리는 방식입니다.

1. [vercel.com](https://vercel.com) 로그인 → **"Add New..." → "Project"**
2. 대시보드에서 폴터를 그대로 끌어다 놓을 수 있는 업로드 영역(또는 Drag & Drop 링크) 찾기
3. 탐색기에서 `C:\Project\Personalized Skincare` **폴터 전체를 드래그**해서 업로드 영역에 놓기
4. 프로젝트 이름 입력 → **Deploy** 클릭

> ⚠️ 이 방법은 **자동 재배포가 안 됩니다.** 내용을 수정하면 매번 다시 드래그해서 올려야 합니다.
> 자주 수정할 예정이라면 **방법 A (GitHub)** 를 강력히 권장합니다.

---

## 5. 스마트폰에서 접속하기

배포가 완료되면 Vercel이 제공하는 주소(예: `https://skincare-app.vercel.app`)로 접속하면 됩니다.

### 📱 QR 코드 활용

Vercel 대시보드 → 해당 프로젝트 → **"Visit"** 버튼 옆의 **QR 코드 아이콘**을 클릭하면
QR 코드가 표시됩니다. 스마트폰 침메라로 스캔하면 바로 열립니다.

### 📱 그냥 주소 입력

스마트폰 브라우저(삼성 인터넷, Chrome, Safari 등) 주소창에 배포된 URL을 입력합니다.

### 📱 카카오톡으로 나에게 보기

PC에서 카카오톡 "나와의 채팅"으로 URL을 본인에게 전송한 뒤, 스마트폰에서 링크를 눌러도 됩니다.

> ✅ 이 프로젝트는 반응형 디자인이 적용되어 있고
> `index.html`에 `viewport` 메타 태그도 있어서 모바일 화면에 자동 최적화됩니다.

---

## 6. 홈 화면에 앱처럼 추가하기 (PWA 설치)

브라우저를 매번 열 필요 없이, **앱 아이콘처럼** 홈 화면에 추가할 수 있습니다.
이 프로젝트는 PWA(Progressive Web App)로 구성되어 있어, 설치 후 오프라인에서도 핵심 기능(플래시카드, 퀴즈, 교재 읽기 등)을 사용할 수 있습니다.

### 📲 앱 내 "앱 설치" 버튼 (가장 간편, 권장)

앱 화면 **우측 상단 헤더의 "앱 설치" 버튼**을 누륮면 됩니다.

- **설치 조건이 충족된 경우(Android Chrome 등)**: 브라우저의 네이티브 설치 확인 팝업이 바로 표시됩니다. "설치"를 누륮면 완료됩니다.
- **설치 조건이 아직 충족되지 않은 경우**: 사용 중인 기기/브라우저에 맞는 **단계별 설치 안내 모달**이 표시됩니다.
  - Android: 브라우저 메뉴(⋮ 또는 ≡) → "앱 설치" / "홈 화면에 추가" 순서 안내
  - iPhone(iOS): Safari 공유 버튼 → "홈 화면에 추가" 순서 안내
- 모달은 닫기 버튼, 배경 클릭, ESC 키로 닫을 수 있습니다.

> 💡 **참고**: Chrome 108+ 정책 변경으로 브라우저가 자동으로 설치 배너를 띄우지 않습니다.
> `beforeinstallprompt` 이벤트는 사용자가 사이트를 일정 횟수 이상 방문하는 등의 참여도 조건이
> 충족되어야 발생하므로, 첫 방문 시에는 안내 모달이 표시될 수 있습니다.

### 🤖 Android (브라우저 메뉴로 수동 설치)

1. 배포된 사이트에 접속
2. 브라우저의 **메뉴 버튼** 탭
   - Chrome: 주소창 오른쪽 **⋮ (점 3개)**
   - 삼성 인터넷: 화면 하단 **≡ (삼선)**
3. **"앱 설치"** 또는 **"홈 화면에 추가"** 선택
   - 삼성 인터넷: **"페이지를 홈 화면에 추가"**
4. 이름 확인 후 **"설치" / "추가"** → 홈 화면에 아이콘이 생깁니다

### 🍎 iPhone (Safari)

1. **Safari**로 배포된 사이트에 접속 (반드시 Safari여야 함)
2. 하단의 **공유 버튼** (□↑ 아이콘) 탭
3. 아래로 스크롤 → **"홈 화면에 추가"** 선택
4. **"추가"** 탭 → 홈 화면에 아이콘이 생깁니다

---

## 7. 문제 해결 (FAQ)

### ❓ 배포 후 페이지가 하얗게(빈 화면) 나와요

- 브라우저에서 `F12` → **Console** 탭을 열어 빨간 오류를 확인하세요.
- 이 프로젝트는 `src/sanitize.js` → `data/registry.js` → `src/data-loader.js` → `src/utils.js` → `src/charts.js` → `src/scratchpad.js` → `src/trainer-calc.js` → `data/id_migration.js` → `src/state.js` → `src/reader-format.js` → `src/app.js` 순서로 로드되어야 합니다. 파일이 누락되지 않았는지 확인하세요.
- **Ctrl + Shift + R** (강력 새로고침)으로 캐시를 지워보세요.

### ❓ 교재 본문(HTML 파일)이 열리지 않아요

- 한글 폴터(디렉터리)명(`2026 맞춤형화장품의 이해` 등)과 공백이 포함된 경로는 브라우저가 자동으로 URL 인코딩하므로 정상 동작합니다.
- 만약 404 오류가 난다면, 해당 HTML 파일이 저장소에 포함되어 있는지 확인하세요.
  (`git add .` 했을 때 모든 파일이 올라갔는지 `git status`로 확인)

### ❓ "This deployment is blocked" 또는 빌드 오류가 나요

- 이 프로젝트는 빌드가 필요 없으므로, Vercel 설정에서 **Build Command / Output Directory가 비어 있는지** 확인하세요.
- 프로젝트 설정 → **General** → **Framework Preset**이 `Other`인지 확인하세요.

### ❓ 학습 진도(플래시카드 완료 등)가 사라져요

- 학습 진도는 각 기기의 **브라우저 localStorage**에 저장됩니다.
- 스마트폰과 PC는 **별도로 저장**되며, 서로 동기화되지 않습니다. (정상 동작)
- 브라우저의 "방문 기록/캐시 삭제"를 하면 진도도 함께 삭제될 수 있으니 주의하세요.

### ❓ 도메인을 내 마음대로 바꾸고 싶어요

- Vercel 대시보드 → 프로젝트 → **Settings → Domains**에서
  `원하는이름.vercel.app` 서브도메인을 묘료로 변경할 수 있습니다.
- 본인 소유 도메인(예: `myapp.com`)이 있다면 거기에도 연결 가능합니다.

### ❓ 프로젝트를 삭제하고 싶어요

- Vercel 대시보드 → 프로젝트 → **Settings → General** → 맨 아래 **"Delete Project"**

---

## 8. 참고 사항

### 📁 이 프로젝트가 Vercel에서 잘 동작하는 이유

| 항목 | 상태 |
|---|---|
| 빌드 도구 (webpack, vite 등) | ❌ 없음 → 설정 불필요 |
| 런타임 데이터 로드 | ✅ `data/registry.js` + `src/data-loader.js`가 해시드 번들을 온디맨드 로드 |
| 외부 의존성 | Google Fonts CDN만 사용. FontAwesome은 자체 호스팅([`vendor/fontawesome/`](../vendor/fontawesome/))으로 전환되어 CDN 의존 없음 |
| 한글/공백 포함 경로 | ✅ 콘텐츠 파일명은 ASCII 슬러그로 정규화됨 |
| `viewport` 메타 태그 | ✅ 모바일 반응형 지원 |

### 💰 비용

- **Hobby (개인) 플랜은 완전 묘료**입니다. (비용 0원)
- 월 100GB 대역폭, 비상업적 용도라면 충분합니다.
- 개인 학습용이므로 묘료 사용 범위를 초과할 일이 사실상 없습니다.

### 🔒 주의

- Public 저장소 + Vercel 배포 시 **누구나 URL만 알면 접속**할 수 있습니다.
- 학습 자료의 저작권 등이 걱정된다면 저장소를 **Private**으로 만들거나,
  Vercel의 **Deployment Protection**(비밀번호 보호) 기능을 설정하세요.
  (Vercel 대시보드 → Settings → Deployment Protection)

---

## ✅ 빠른 요약 (TL;DR)

```bash
# 1. GitHub에 올리기
git init && git add . && git commit -m "init"
git remote add origin https://github.com/본인아이디/저장소명.git
git push -u origin main

# 2. vercel.com 에서 "Import Project" → 저장소 선택 → Deploy 클릭

# 3. 생성된 URL (예: https://저장소명.vercel.app) 을 스마트폰에서 열기

# 4. 스마트폰 브라우저 메뉴에서 "홈 화면에 추가"
```

끝! 🎉
