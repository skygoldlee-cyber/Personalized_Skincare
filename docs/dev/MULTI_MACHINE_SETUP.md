# 💻 다른 머신에서 GitHub / Vercel 접근 설정 가이드

> **대상 프로젝트**: 맞춤형화장품 조제관리사 스마트 학습 플랫폼 (Personalized_Skincare)
> **최종 업데이트**: 2026-08-26
> **목적**: 새로운 PC·노트북에서 GitHub 푸시와 Vercel 배포를 최소 설정으로 재현하기 위한 표준 절차

---

## 📌 현재 프로젝트 인증 상태

| 항목 | 현재 상태 | 비고 |
|------|-----------|------|
| Git remote | `git@github-skygold:skygoldlee-cyber/Personalized_Skincare.git` | SSH 별칭 방식 (개인 키 필요) |
| GitHub CLI (`gh`) | 미설치 | 설치 권장 |
| Vercel 링크 | `.vercel/project.json` Git 추적됨 (`810de57`부터) | projectId/orgId 자동 인식 |
| Vercel CLI | 설치됨 | `vercel --prod` 사용 중 |

> **문제점**: SSH 키 방식은 새 머신마다 키 생성 → GitHub 등록 → `~/.ssh/config` 별칭 설정이 필요해 번거롭습니다.

---

## 🥇 추천 방법: GitHub CLI + Vercel 토큰

### 1️⃣ GitHub — `gh` CLI 사용 (SSH 키 불필요)

`gh` CLI는 **브라우저 로그인 한 번**으로 인증이 끝나며, git 자격증명 헬퍼까지 자동 설정합니다. SSH 키 관리가 완전히 사라집니다.

#### 새 머신에서 최초 1회 설정

```bash
# 1. 설치
#    Windows:  winget install --id GitHub.cli
#    macOS:    brew install gh
#    Linux:    sudo apt install gh

# 2. 로그인 (브라우저가 열리며 GitHub 승인)
gh auth login
#   선택지: GitHub.com → HTTPS → Login with a web browser

# 3. 클론 (gh가 인증을 자동 처리)
gh repo clone skygoldlee-cyber/Personalized_Skincare
cd Personalized_Skincare
```

> ✅ 이후 `git push` / `git pull` 도 추가 인증 없이 동작합니다.

#### 기존 SSH remote를 HTTPS로 전환 (선택)

이미 SSH로 클론한 경우 아래 명령으로 HTTPS 방식으로 바꿀 수 있습니다.

```bash
git remote set-url origin https://github.com/skygoldlee-cyber/Personalized_Skincare.git
gh auth setup-git   # git이 gh 인증을 사용하도록 설정
```

---

### 2️⃣ Vercel — 프로젝트 토큰 사용 (비대화형)

이 리포지토리에는 `.vercel/project.json`이 Git에 커밋되어 있어 (`810de57`부터), **토큰만 있으면** 로그인 없이 바로 배포할 수 있습니다.

#### 프로젝트 식별 정보 (`.vercel/project.json`)

| 항목 | 값 |
|------|-----|
| **projectId** | `prj_706IdDze2DZsNwjADIfhvsfWL3HW` |
| **orgId** | `team_P4ciaJGD9bvDziPxZM6FOCSK` |
| **projectName** | `personalized-skincare-study` |

#### 토큰 발급 (기존 머신 또는 웹에서 1회)

1. https://vercel.com/account/tokens 접속 (skygold 계정으로 로그인)
2. **Create Token** 클릭
3. Scope를 `personalized-skincare-study` 프로젝트로 **제한** (보안 권장)
4. 생성된 토큰을 안전한 곳에 보관 (1Password, Bitwarden 등)

#### 새 머신에서 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 루트에서 (.vercel/project.json 자동 인식)
# Windows pwsh 환경에서는 cmd /c 래퍼 사용 권장
cmd /c vercel --prod --token <VERCEL_TOKEN>
```

> ⚠️ **Cascade(IDE AI)에서 배포 시**: `vercel login`의 브라우저 OAuth 대기가 타임아웃을 유발할 수 있습니다. 반드시 `--token` 옵션을 사용하여 비대화형 배포를 수행하세요.

#### 환경변수로 자동화 (권장)

```bash
# Windows (cmd)
setx VERCEL_TOKEN "발급받은_토큰"

# macOS / Linux (~/.zshrc 또는 ~/.bashrc)
export VERCEL_TOKEN="발급받은_토큰"
```

환경변수 설정 후에는 토큰 옵션 없이 바로 배포 가능합니다.

```bash
cmd /c vercel --prod --yes
```

---

## 🥈 대안: GitHub Actions로 배포 자동화 (로컬 Vercel 불필요)

머신에 **아무것도 설치하지 않고**, `git push`만으로 배포되게 하는 방법입니다.

### 설정 절차

1. **GitHub Secrets 등록** (리포지토리 → Settings → Secrets and variables → Actions)
   | Secret 이름 | 값 |
   |-------------|-----|
   | `VERCEL_TOKEN` | 위에서 발급한 토큰 |
   | `VERCEL_ORG_ID` | `.vercel/project.json`의 `orgId` |
   | `VERCEL_PROJECT_ID` | `.vercel/project.json`의 `projectId` |

2. **워크플로 파일 추가**: `.github/workflows/deploy.yml`

```yaml
name: Vercel Production Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm i -g vercel
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### 효과

- `git push origin main` → GitHub가 자동으로 Vercel 프로덕션 배포
- 새 머신에서는 **Git(또는 gh)만 있으면** 되고, Vercel CLI·로그인이 전혀 필요 없음

> ⚠️ 주의: 이 방식을 적용하면 로컬에서 `vercel --prod`를 직접 실행할 필요가 없어집니다. 수동 배포와 자동 배포를 혼용할 경우 충돌에 주의하세요.

---

## 🥉 최소 변경: 현재 SSH 방식 유지 + 키 재사용

SSH를 계속 쓰고 싶다면 다음 중 하나를 선택하세요.

1. **비밀번호 관리자 SSH 에이전트 활용**
   - 1Password / Bitwarden의 SSH 에이전트에 개인키를 저장하면 모든 머신에서 동기화됩니다.

2. **수동 키 복사**
   - 새 머신에서 키 생성 후 GitHub에 등록하고, `~/.ssh/config`에 `Host github-skygold` 별칭을 동일하게 복사합니다.

> 다만 머신이 늘어날수록 키 관리가 번거로워져 **비추천**합니다.

---

## 📊 방법 비교 요약

| 방법 | GitHub 인증 | Vercel 인증 | 새 머신 설치 | 배포 방식 | 추천도 |
|------|-------------|-------------|--------------|-----------|--------|
| **gh CLI + Vercel 토큰** | 브라우저 1회 | 토큰 1회 | gh + vercel CLI | 수동 `vercel --prod` | ⭐⭐⭐⭐⭐ |
| **GitHub Actions** | 브라우저 1회 | Secrets 1회 | gh 만 | `git push` 시 자동 | ⭐⭐⭐⭐⭐ |
| SSH 키 동기화 | 키 매번/동기화 | 브라우저 1회 | git + vercel | 수동 | ⭐⭐ |

---

## ✅ 권장 조합

> **`gh auth login` (GitHub) + GitHub Actions 자동 배포 (Vercel)**

새 머신에서는 `gh` 하나만 설치하면 되고, 배포는 `git push`만 하면 자동으로 이루어집니다.

---

## 🔗 관련 문서

- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — Vercel 배포 전체 가이드 (프로젝트 정보, CSP, 캐시 정책)
- [`CHANGES.md`](CHANGES.md) — 코드 리뷰 수정 이력
