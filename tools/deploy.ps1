<#
.SYNOPSIS
  Cosmetic Pass Master — 전체 배포 파이프라인 일괄 실행 스크립트
.DESCRIPTION
  1. npm run build:data  (빌드 + 파서 등가성 검사)
  2. sw.js CACHE_VERSION major bump (선택적, --bump)
  3. git add -A && git commit && git push
  4. vercel --prod 배포
.PARAMETER Message
  Git commit message (필수)
.Parameter Bump
  SW CACHE_VERSION의 major 번호를 1 증가 (예: v155 → v156)
  생략 시 빌드의 stamp-sw-version.js가 date+git hash만 갱신
.Parameter SkipDeploy
  Vercel 배포를 건너뛰고 커밋/푸시까지만 실행
.Parameter SkipPush
  Git commit/push를 건너뛰고 빌드+배포만 실행
.EXAMPLE
  .\tools\deploy.ps1 -Message "교재 콘텐츠 수정"
  .\tools\deploy.ps1 -Message "교재 콘텐츠 수정" -Bump
  .\tools\deploy.ps1 -Message "교재 콘텐츠 수정" -Bump -SkipDeploy
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Message,

  [switch]$Bump,
  [switch]$SkipDeploy,
  [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'
$ROOT = Resolve-Path "$PSScriptRoot\.."
Set-Location $ROOT

function Write-Step($n, $msg) {
  Write-Host "`n========== Step ${n}: ${msg} ==========" -ForegroundColor Cyan
}

# ── Step 1: SW major bump (빌드 전에 수행해야 빌드가 새 버전을 반영) ──
if ($Bump) {
  Write-Step 1 "SW CACHE_VERSION major bump"

  $swPath = Join-Path $ROOT 'sw.js'
  $swContent = Get-Content $swPath -Raw -Encoding UTF8
  $pattern = "(const\s+CACHE_VERSION\s*=\s*['""])([A-Za-z]+)(\d+)"
  if ($swContent -match $pattern) {
    $prefix = $Matches[2]
    $num = [int]$Matches[3] + 1
    $newPrefix = "${prefix}${num}"
    $swContent = $swContent -replace $pattern, ('$1' + $newPrefix)
    # 주석도 갱신
    $swContent = $swContent -replace "(const\s+CACHE_VERSION\s*=\s*['""][^'""]+['""]\s*;\s*//\s*).*", ('$1' + $Message)
    Set-Content $swPath -Value $swContent -Encoding UTF8 -NoNewline
    Write-Host "  CACHE_VERSION major bumped: ${prefix}$($Matches[3]) → $newPrefix" -ForegroundColor Green
  } else {
    Write-Host "  WARNING: CACHE_VERSION 패턴을 찾을 수 없습니다. 수동 확인 필요." -ForegroundColor Yellow
  }
}

# ── Step 2: Build ──
Write-Step 2 "npm run build:data"
npm run build:data
if ($LASTEXITCODE -ne 0) {
  Write-Host "BUILD FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
  exit 1
}
Write-Host "  Build + parser parity check passed." -ForegroundColor Green

# ── Step 3: Git commit & push ──
if (-not $SkipPush) {
  Write-Step 3 "Git commit & push"
  git add -A
  if ($LASTEXITCODE -ne 0) { Write-Host "git add FAILED" -ForegroundColor Red; exit 1 }

  $commitResult = git commit -m $Message 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ($commitResult -match 'nothing to commit') {
      Write-Host "  Nothing to commit — working tree clean." -ForegroundColor Yellow
    } else {
      Write-Host "git commit FAILED: $commitResult" -ForegroundColor Red
      exit 1
    }
  } else {
    Write-Host "  Committed: $Message" -ForegroundColor Green
  }

  git push
  if ($LASTEXITCODE -ne 0) { Write-Host "git push FAILED" -ForegroundColor Red; exit 1 }
  Write-Host "  Pushed to remote." -ForegroundColor Green
} else {
  Write-Step 3 "Git commit & push (skipped)"
}

# ── Step 4: Vercel deploy ──
if (-not $SkipDeploy) {
  Write-Step 4 "Vercel deploy (--prod)"
  cmd /c vercel --prod
  if ($LASTEXITCODE -ne 0) {
    Write-Host "VERCEL DEPLOY FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
  }
  Write-Host "  Vercel production deploy complete." -ForegroundColor Green
} else {
  Write-Step 4 "Vercel deploy (skipped)"
}

# ── Summary ──
Write-Host "`n========== Pipeline Complete ==========" -ForegroundColor Cyan
Write-Host "  Message : $Message"
Write-Host "  SW Bump : $(if ($Bump) {'Yes'} else {'No (stamp-sw-version auto)'})"
Write-Host "  Push    : $(if ($SkipPush) {'Skipped'} else {'Done'})"
Write-Host "  Deploy  : $(if ($SkipDeploy) {'Skipped'} else {'Done'})"
Write-Host "========================================`n" -ForegroundColor Cyan
