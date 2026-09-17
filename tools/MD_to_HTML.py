import markdown
from pathlib import Path
import unicodedata
import html
import re
import argparse
import base64
import glob
import hashlib
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass


# =============================================================================
# 모바일 file:// 디버깅 및 해결 이력 (2025-01)
#
# 모바일 Chrome/Safari에서 로컬 HTML 파일(file:// 또는 content://)을 열면
# 인라인 <script>가 전혀 실행되지 않는 보안 정책이 적용된다.
# 이 환경에서 작동하도록 하기 위해 아래와 같은 CSS-only/구조적 해결을 적용했다.
#
# [발견된 이슈 및 해결]
# 1. 테마 토글 버튼 미응답 (모바일)
#    - 원인: 인라인 JS 차단 + 라이트박스 오버레이(z-index:10000)가 버튼을 가림
#    - 해결: CSS-only checkbox/label 토글 + :has() 선택자, 버튼 z-index 2147483000
#
# 2. 본문 내 목차 링크 미응답 (모바일)
#    - 원인 A: 마크다운 원본의 목차가 일반 텍스트(•)로 작성되어 링크가 아님
#    - 원인 B: 일부 파일의 마크다운 링크 href가 잘못된 앵커(#-텍스트)를 가리킴
#    - 원인 C: backdrop-filter가 stacking context를 생성하여 앵커 이동을 방해
#    - 해결: _linkify_inline_toc()로 • 항목 및 <ol> 안 <a>의 href를 올바른 id로 변환
#           + 모든 backdrop-filter 제거 (CSS blur 대신 opacity 사용)
#
# 3. 모바일 TOC 드로어 미작동
#    - 원인: 인라인 JS 차단으로 drawer-hidden 클래스 토글 불가
#    - 해결: #tocSwitch checkbox + :has() 선택자로 CSS-only 드로어 구현
#           TOC 링크를 <label for="tocSwitch">로 감싸 링크 클릭 시 드로어 자동 닫기
#    - 추가: 별도 TOC 버튼 대신 왼쪽 끝 스와이프 제스처로 오픈 (모던 패턴)
#            왼쪽 가장자리에 작은 힌트 탭(<label>)을 두어 JS 없는 환경에서도
#            탭으로 열 수 있도록 폴백 유지
#
# 4. 모바일 좌우 여백 없음
#    - 원인: Tailwind CDN 미로드 시 .px-4 등 유틸리티 미적용
#    - 해결: article에 직접 padding: 0 1rem 추가
#
# [모바일 file:// 호환성 원칙]
# - 인라인 <script>는 실행되지 않으므로, 중요 기능은 CSS-only로 구현
# - checkbox/label + :has() 선택자로 토글/드로어 등 UI 상태 관리
# - backdrop-filter는 stacking context를 생성해 앵커 이동을 방해 → 사용 금지
# - 기본 <a href="#id"> 앵커 동작은 JS 없이도 작동하므로 활용
# - Tailwind CDN은 로드되지 않을 수 있으므로, 필수 레이아웃은 CSS로 직접 보장
# =============================================================================


# UX toggles (can be overridden via CLI)
COLLAPSE_CODEBLOCK_MIN_LINES = 35

# ASCII/박스 드로잉 다이어그램 감지용 문자 집합 (여러 파이프라인 함수에서 공용)
BOX_CHARS = frozenset("┌┐└┘├┤┬┴┼│─═╔╗╚╝╠╣╦╩╬┃━▲▼◀▶")

# blockquote → 콜아웃 카드 분류 규칙. (CSS 클래스, 키워드 튜플) 쌍이며
# 위에서부터 순서대로 평가되어 첫 매칭이 적용된다.
CALLOUT_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("callout-sop", ("📋", "[CÔTELEAF SOP]", "[SOP]", "체크리스트")),
    ("callout-trouble", ("🚨", "[현장 트러블슈팅]", "[트러블슈팅]", "트러블슈팅")),
    ("callout-warning", ("⚠️", "[감시원 단골 지적]", "[단속 방지]", "단골 지적", "행정처분 방지")),
    ("callout-form", ("📑", "[CÔTELEAF 실무 서식]", "[실무 서식]")),
    ("callout-character", ("💡", "민수", "지연", "현우", "수진")),
    ("callout-exam", ("🎯", "🧠", "기출", "암기")),
)

# Embed the Mermaid library directly into the generated HTML by default.
# The CDN build (mermaid.min.js) is ~3.5MB; on mobile in-app browsers
# (KakaoTalk, Samsung Internet viewer, etc.) and flaky networks that large
# external script often fails to load, leaving the diagram source as raw text.
# Inlining it removes the runtime network dependency so diagrams render offline.
EMBED_MERMAID = True
MERMAID_ASSET_NAME = "mermaid.min.js"
# Tried in order at build time; the first that returns a real file is cached.
MERMAID_CDN_URLS = (
    "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
    "https://unpkg.com/mermaid@11/dist/mermaid.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.17.2/mermaid.min.js",
)
# ESM 빌드는 CDN 폴백의 최후 수단으로 사용 (생성 HTML 내 JS가 import)
MERMAID_ESM_URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"
# The library is multi-MB; anything much smaller is an error page, not the lib.
_MERMAID_MIN_BYTES = 200_000

# Known-good SRI hashes for Mermaid 11.x CDN builds (sha384 base64).
# If a CDN returns content whose hash doesn't match, it's rejected.
# None = skip SRI check (fallback to size-only validation).
# URL을 추가할 때는 MERMAID_CDN_URLS에 넣고, 해시가 확인되면 여기서 덮어쓴다.
MERMAID_SRI_HASHES: dict[str, str | None] = dict.fromkeys(MERMAID_CDN_URLS)

# In-memory cache for the Mermaid library (no disk writes).
_MERMAID_JS_MEMORY: str | None = None


@dataclass(frozen=True)
class RenderConfig:
    collapse_codeblock_min_lines: int = COLLAPSE_CODEBLOCK_MIN_LINES
    embed_mermaid: bool = EMBED_MERMAID
    prerender_mermaid: bool = True


def _read_text_if_exists(path: Path) -> str | None:
    try:
        if path and path.exists() and path.is_file():
            return path.read_text(encoding="utf-8")
    except Exception:
        return None
    return None


def _download_text(url: str, timeout: int = 30) -> str | None:
    """Best-effort download of a text asset. Returns None on any failure."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        text = data.decode("utf-8", errors="replace")
        # Guard against captive-portal / 404 HTML pages masquerading as the asset.
        if len(text.encode("utf-8")) < _MERMAID_MIN_BYTES:
            return None
        return text
    except Exception:
        return None


def _ensure_mermaid_js(assets_dir: Path | None = None) -> str | None:
    """Return the Mermaid library source, using an in-memory cache.

    Downloads from MERMAID_CDN_URLS on first call, then caches in memory.
    No files or directories are written to disk.

    Returns None if the library cannot be obtained (offline), in which case
    the generated HTML keeps its CDN <script> tag as a fallback.
    """
    global _MERMAID_JS_MEMORY
    if _MERMAID_JS_MEMORY is not None:
        return _MERMAID_JS_MEMORY

    # If a pre-existing local copy exists (e.g. user-managed), use it.
    if assets_dir:
        try:
            cache = Path(assets_dir) / MERMAID_ASSET_NAME
            cached = _read_text_if_exists(cache)
            if cached and len(cached.encode("utf-8")) >= _MERMAID_MIN_BYTES:
                _MERMAID_JS_MEMORY = cached
                return cached
        except Exception:
            pass

    for url in MERMAID_CDN_URLS:
        text = _download_text(url)
        if text:
            # SRI 검증: 알려진 해시가 있으면 검증, 없으면 크기만 검증
            expected_hash = MERMAID_SRI_HASHES.get(url)
            if expected_hash is not None:
                actual_hash = base64.b64encode(
                    hashlib.sha384(text.encode("utf-8")).digest()
                ).decode("ascii")
                if actual_hash != expected_hash:
                    try:
                        print(f"[Mermaid SRI mismatch] {url}", file=sys.stderr)
                    except Exception:
                        pass
                    continue  # 해시 불일치 → 다음 CDN 시도
            _MERMAID_JS_MEMORY = text
            return text
    return None


def _embed_mermaid_js(doc_html: str, js_text: str) -> str:
    """Replace the Mermaid CDN <script src> tag with an inline <script> block."""
    if not doc_html or not js_text:
        return doc_html
    # Neutralize any "</script" so it cannot terminate our inline block early.
    # (In JS source, "<\/script" is equivalent to "</script" inside strings.)
    safe = re.sub(r"</script", r"<\\/script", js_text, flags=re.IGNORECASE)
    inline = "<script>\n" + safe + "\n</script>"
    return doc_html.replace(
        f'<script src="{MERMAID_CDN_URLS[0]}"></script>',
        inline,
    )


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="ko" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>%%TITLE%%</title>

  <!-- 테마 FOUC 방지: localStorage에서 테마 읽어 checkbox 체크.
       모바일 file:// 에서 인라인 스크립트가 차단되면 무시되고,
       CSS 기본값(다크)이 적용된다. JS가 작동하는 환경에서만 실행. -->
  <script>
    (function () {
      try {
        var saved = localStorage.getItem('doc_theme');
        var mode = saved || ((window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark');
        document.documentElement.dataset.theme = mode;
        if (mode === 'dark') document.documentElement.classList.add('doc-bg');
        // 글자 크기 복원 (doc_fontsize: 0=작게 ~ 4=크게, 기본 2)
        var fs = localStorage.getItem('doc_fontsize');
        if (fs !== null) {
          var sizes = ['0.9375rem', '1.0rem', '1.0625rem', '1.1875rem', '1.3125rem'];
          var fi = parseInt(fs, 10);
          if (!isNaN(fi) && fi >= 0 && fi < sizes.length) {
            document.documentElement.style.setProperty('--article-fs', sizes[fi]);
          }
        }
        // checkbox 동기화 (body 로드 전이므로 DOMContentLoaded에서 처리)
        document.addEventListener('DOMContentLoaded', function () {
          var cb = document.getElementById('themeSwitch');
          if (cb) cb.checked = (mode === 'light');
        });
      } catch (e) {
        document.documentElement.dataset.theme = 'dark';
      }
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'media',
      theme: {
        extend: {
          typography: {
            DEFAULT: {
              css: {
                maxWidth: '100%',
              }
            }
          }
        }
      }
    }
  </script>

  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      try {
        // Only highlight code blocks NOT already processed by Pygments codehilite
        document.querySelectorAll('pre code').forEach(function (el) {
          if (!el.closest('.highlight')) {
            hljs.highlightElement(el);
          }
        });
      } catch (e) {}
    });
  </script>

  <script src="%%MERMAID_CDN_URL%%"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      try {
        if (window.mermaid) {
          // Initial render happens after theme is applied (see theme script)
        }
      } catch (e) {}
    });
  </script>

  <style>
    /* --- Tailwind Fallback (CDN blocked) ---
       This project normally uses Tailwind CDN. If the CDN is blocked,
       these minimal utility class fallbacks keep the doc readable.
    */
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    }

    .mx-auto { margin-left: auto; margin-right: auto; }
    .max-w-screen-2xl { max-width: 1536px; }
    .max-w-screen-xl { max-width: 1280px; }

    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .py-8 { padding-top: 2rem; padding-bottom: 2rem; }

    @media (min-width: 640px) {
      .sm\:px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    }
    @media (min-width: 1024px) {
      .lg\:px-8 { padding-left: 2rem; padding-right: 2rem; }
    }

    .min-h-screen { min-height: 100vh; }
    .flex { display: flex; }
    .grid { display: grid; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-3 { gap: 0.75rem; }

    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    @media (min-width: 1024px) {
      .lg\:grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
      .lg\:col-span-3 { grid-column: span 3 / span 3; }
      .lg\:col-span-9 { grid-column: span 9 / span 9; }
      .lg\:block { display: block; }
    }

    .hidden { display: none; }

    .sticky { position: sticky; }
    .top-0 { top: 0; }
    .top-24 { top: 6rem; }
    .z-40 { z-index: 40; }

    .rounded-xl { border-radius: 0.75rem; }
    .rounded-2xl { border-radius: 1rem; }

    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }

    .inline-flex { display: inline-flex; }
    .leading-tight { line-height: 1.25; }
    .overflow-auto { overflow: auto; }

    .fixed { position: fixed; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .right-0 { right: 0; }
    .w-80 { width: 20rem; }
    .h-screen { height: 100vh; }
    .p-4 { padding: 1rem; }
    .p-3 { padding: 0.75rem; }
    .pt-3 { padding-top: 0.75rem; }
    .mt-3 { margin-top: 0.75rem; }
    .w-full { width: 100%; }
    .border-b { border-bottom-width: 1px; }
    .border { border-width: 1px; }
    .shadow-xl { box-shadow: var(--shadow-xl); }
    .transition { transition: all 0.2s ease; }

    /* Skip link: 키보드/스크린리더용 본문 바로가기 (포커스 시에만 표시) */
    .skip-link {
      position: fixed;
      top: -4rem;
      left: 1rem;
      z-index: 80;
      padding: 0.6rem 1rem;
      border-radius: 0.75rem;
      background: var(--a1);
      color: var(--on-accent);
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: top 0.2s ease;
    }
    .skip-link:focus { top: 0.75rem; }

    .sm\:hidden { display: block; }
    @media (min-width: 640px) { .sm\:hidden { display: none; } }

    /* Mobile TOC drawer */
    .drawer-backdrop {
      background: var(--backdrop);
    }

    /* 모바일 주소창 영역을 제외한 동적 뷰포트 높이(100dvh)를 사용하고,
       flex column + min-height:0 로 nav가 패널 안에서 스크롨되도록 한다.
       (Tailwind h-[calc(100vh-6rem)]에 의존하면 헤더 높이 초과 시
       마지막 목차 항목이 화면 밖으로 잘려 스크롨 불가) */
    .drawer-panel {
      height: 100vh;
      height: 100dvh;
      max-width: 22rem;
      width: 85vw;
      background: var(--panel);
      border-right: 1px solid var(--border);
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* 왼쪽 가장자리 스와이프 힌트 탭.
       JS 없는 환경(file://)에서는 label 탭으로 드로어를 열고,
       JS 환경에서는 왼쪽 끝 스와이프 제스처로 연다. */
    .toc-edge-hint {
      position: fixed;
      left: 0;
      top: 35%;
      width: 10px;
      height: 72px;
      border-radius: 0 8px 8px 0;
      background: var(--edge-hint);
      z-index: 30;
      display: none;
      cursor: pointer;
      /* 최초 진입 시 짧게 강조해 발견성을 높인다 (CSS-only, JS 불필요) */
      animation: edgeHintPulse 1.6s ease-in-out 0.8s 3;
    }
    @keyframes edgeHintPulse {
      0%, 100% { width: 10px; opacity: 0.6; }
      50%      { width: 16px; opacity: 1; }
    }
    @media (max-width: 1023px) { .toc-edge-hint { display: block; } }
    #tocSwitch:checked ~ .toc-edge-hint { display: none; }
    #tocMobile {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    /* CSS-only TOC 드로어 토글: checkbox #tocSwitch 체크 시 표시 */
    .toc-switch {
      position: fixed;
      width: 0;
      height: 0;
      opacity: 0;
      pointer-events: none;
    }
    #tocDrawer { display: none; }
    #tocSwitch:checked ~ #tocDrawer { display: block; }
    /* 데스크톱(1024px+)에서는 사이드바 TOC를 쓰므로 모바일 드로어 비활성화 */
    @media (min-width: 1024px) {
      #tocSwitch:checked ~ #tocDrawer { display: none; }
    }

    /* Toast */
    #toast {
      position: fixed;
      left: 50%;
      bottom: 20px;
      transform: translateX(-50%);
      padding: 0.6rem 0.9rem;
      border-radius: 9999px;
      border: 1px solid var(--border);
      background: var(--floating-bg);
      color: var(--fg);
      font-size: 0.85rem;
      box-shadow: var(--shadow);
      display: none;
      z-index: 60;
    }

    /* CSS-only 테마 토글: checkbox를 숨기고 label로 토글 (JS 없이도 작동) */
    .theme-switch {
      position: fixed;
      right: 18px;
      bottom: 18px;
      width: 0;
      height: 0;
      opacity: 0;
      pointer-events: none;
    }

    /* Floating Theme button (failsafe when topbar buttons are hidden/clipped) */
    .theme-fab {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 99999;
      border: 1px solid var(--floating-border);
      background: var(--floating-bg);
      color: var(--fg);
      padding: 0.75rem 1rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      box-shadow: var(--shadow);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: var(--tap-highlight);
      touch-action: manipulation;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      min-height: 44px;
      min-width: 44px;
    }
    .theme-fab:hover { background: var(--floating-hover); }
    /* checkbox 상태에 따라 label 텍스트 변경 (JS 없이도 작동) */
    #btnThemeFab::after { content: "Theme: Dark"; }
    html:has(#themeSwitch:checked) #btnThemeFab::after { content: "Theme: Light"; }
    /* JS가 작동할 때 data-theme 기반 텍스트 (checkbox 미체크 상태에서 data-theme=light인 경우) */
    html[data-theme="light"]:not(:has(#themeSwitch:checked)) #btnThemeFab::after { content: "Theme: Light"; }

    /* Collapsible code blocks */
    .codewrap.collapsed {
      max-height: 18rem;
      overflow: hidden;
      mask-image: var(--collapse-mask);
      -webkit-mask-image: var(--collapse-mask);
    }
    .expand-btn {
      position: absolute;
      left: 0.6rem;
      top: 0.6rem;
      padding: 0.35rem 0.55rem;
      border-radius: 0.7rem;
      font-size: 0.75rem;
      line-height: 1rem;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--btn-bg);
      color: var(--fg);
      cursor: pointer;
      user-select: none;
    }
    .expand-btn:hover { background: var(--btn-hover); }

    .admonition {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 0.9rem;
      padding: 0.85rem 1rem;
      margin: 1rem 0;
    }
    .admonition > .admonition-title {
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--fg);
    }
    .admonition.note { border-left: 4px solid var(--admonition-note); }
    .admonition.tip { border-left: 4px solid var(--admonition-tip); }
    .admonition.warning { border-left: 4px solid var(--admonition-warning); }
    .admonition.danger { border-left: 4px solid var(--admonition-danger); }

    :root {
      color-scheme: dark;
      --fg: rgba(226, 232, 240, 0.88);
      --muted: rgba(226, 232, 240, 0.68);
      --panel: rgba(15, 23, 42, 0.55);
      --border: rgba(148, 163, 184, 0.16);
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      --table-cover: #101b30; /* body #020617 + panel rgba(15,23,42,.55) 합성색 */

      --a1: rgba(59,130,246,1);   /* blue */
      --a2: rgba(168,85,247,1);   /* violet */
      --a3: rgba(34,197,94,1);    /* green */
      --a4: rgba(20,184,166,1);   /* teal */
      --a5: rgba(244,63,94,1);    /* rose */
      --a6: rgba(250,204,21,1);   /* amber */

      /* Pygments codehilite token colors — dark (Monokai-inspired) */
      --hl-hll-bg: #49483e;
      --hl-comment: #959077;
      --hl-keyword: #66d9ef;
      --hl-kn: #ff4689;
      --hl-operator: #ff4689;
      --hl-name: #f8f8f2;
      --hl-attr: #a6e22e;
      --hl-class: #a6e22e;
      --hl-fm: #f8f8f2;
      --hl-tag: #ff4689;
      --hl-constant: #66d9ef;
      --hl-string: #e6db74;
      --hl-escape: #ae81ff;
      --hl-number: #ae81ff;
      --hl-literal: #ae81ff;
      --hl-punct: #f8f8f2;
      --hl-w: #f8f8f2;
      --hl-err: #ed007e;
      --hl-generic: #f8f8f2;
      --hl-gd: #ff4689;
      --hl-gi: #a6e22e;
      --hl-gp: #ff4689;
      --hl-go: #f8f8f2;
      --hl-comment-style: normal;

      /* ===== 테마 서피스 (다크) — 아래 light 블록과 1:1 대응. 색상은 여기서만 관리 ===== */
      --page-bg: #020617;
      --doc-bg: radial-gradient(1200px 700px at 20% -10%, rgba(59,130,246,0.18), transparent 60%),
                radial-gradient(900px 600px at 80% 10%, rgba(168,85,247,0.14), transparent 55%),
                radial-gradient(1000px 700px at 40% 110%, rgba(34,197,94,0.10), transparent 60%),
                linear-gradient(180deg, #030712 0%, #020617 55%, #030712 100%);
      --backdrop: rgba(2, 6, 23, 0.55);
      --edge-hint: rgba(148, 163, 184, 0.35);
      --subtitle-fg: rgba(226, 232, 240, 0.70);
      --badge-bg: rgba(226, 232, 240, 0.08);
      --badge-border: rgba(226, 232, 240, 0.10);
      --hover-bg: rgba(226, 232, 240, 0.08);
      --floating-bg: rgba(2, 6, 23, 0.75);
      --floating-hover: rgba(2, 6, 23, 0.88);
      --floating-border: rgba(226, 232, 240, 0.18);
      --resume-bg: rgba(2, 6, 23, 0.85);
      --tbtn-bg: rgba(226, 232, 240, 0.10);
      --tbtn-hover: rgba(226, 232, 240, 0.16);
      --tbtn-border: rgba(226, 232, 240, 0.18);
      --btn-bg: rgba(226, 232, 240, 0.06);
      --btn-hover: rgba(226, 232, 240, 0.10);
      --input-bg: rgba(255, 255, 255, 0.06);
      --mark-bg: rgba(250, 204, 21, 0.30);
      --mark-border: rgba(250, 204, 21, 0.32);
      --mark-active-bg: rgba(59, 130, 246, 0.28);
      --mark-active-border: rgba(59, 130, 246, 0.34);
      --toc-mark-bg: rgba(250, 204, 21, 0.22);
      --toc-mark-border: rgba(250, 204, 21, 0.22);
      --toc-title: var(--fg);
      --toc-subtitle: var(--muted);
      --strong: rgba(248, 250, 252, 0.98);
      --code-inline-bg: rgba(148, 163, 184, 0.12);
      --code-inline-border: rgba(148, 163, 184, 0.18);
      --code-inline-fg: var(--fg);
      --code-bg: rgba(2, 6, 23, 0.85);
      --code-border: rgba(59, 130, 246, 0.18);
      --code-fg: var(--fg);
      --hljs-fg: rgba(226, 232, 240, 0.92);
      --hljs-comment: rgba(148, 163, 184, 0.80);
      --hljs-keyword: rgba(168, 85, 247, 0.95);
      --hljs-string: rgba(34, 197, 94, 0.95);
      --hljs-title: rgba(59, 130, 246, 0.95);
      --hljs-number: rgba(250, 204, 21, 0.95);
      --hljs-attr: rgba(94, 234, 212, 0.95);
      --hljs-builtin: rgba(244, 63, 94, 0.95);
      --hljs-meta: rgba(203, 213, 225, 0.95);
      --mermaid-bg: rgba(15, 23, 42, 0.75);
      --mermaid-border: rgba(59, 130, 246, 0.22);
      --mermaid-fg: rgba(226, 232, 240, 0.92);
      --mermaid-img-bg: #e9e3d1;
      --mermaid-err-bg: rgba(2, 6, 23, 0.55);
      --mermaid-err-fg: rgba(226, 232, 240, 0.92);
      --mermaid-err-title: rgba(254, 226, 226, 0.92);
      --th-bg: rgba(59, 130, 246, 0.10);
      --th-fg: rgba(224, 231, 255, 0.98);
      --th-border: rgba(148, 163, 184, 0.18);
      --td-border: rgba(148, 163, 184, 0.18);
      --tr-even: rgba(148, 163, 184, 0.04);
      --tr-hover: rgba(148, 163, 184, 0.08);
      --quote-border: rgba(99, 102, 241, 0.65);
      --quote-bg: rgba(99, 102, 241, 0.07);
      --callout-sop-bg: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03));
      --callout-sop-border: rgba(16, 185, 129, 0.25);
      --callout-trouble-bg: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.03));
      --callout-trouble-border: rgba(245, 158, 11, 0.25);
      --callout-warning-bg: linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(244, 63, 94, 0.03));
      --callout-warning-border: rgba(244, 63, 94, 0.25);
      --callout-form-bg: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(99, 102, 241, 0.03));
      --callout-form-border: rgba(99, 102, 241, 0.25);
      --callout-character-bg: linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(6, 182, 212, 0.03));
      --callout-character-border: rgba(6, 182, 212, 0.25);
      --callout-exam-bg: linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(168, 85, 247, 0.03));
      --callout-exam-border: rgba(168, 85, 247, 0.25);
      --lightbox-bg: rgba(0, 0, 0, 0.85);
      --progress-bg: linear-gradient(90deg, #38bdf8, #a78bfa);

      /* ===== 공통 액센트 (테마 무관 — 라이트/다크 양쪽에서 같은 값) ===== */
      --on-accent: #fff;
      --toc-active-bg: rgba(20, 184, 166, 0.14);
      --toc-active-border: rgba(20, 184, 166, 0.28);
      --toc-hover-bg: rgba(20, 184, 166, 0.12);
      --toc-guide: rgba(148, 163, 184, 0.14);
      --scrollbar-thumb: rgba(148, 163, 184, 0.24);
      --scrollbar-thumb-hover: rgba(148, 163, 184, 0.34);
      --scrollbar-track: rgba(2, 6, 23, 0.65);
      --h2-bar: linear-gradient(90deg, rgba(168,85,247,0.95), rgba(59,130,246,0.75), rgba(20,184,166,0.75));
      --admonition-note: rgba(59, 130, 246, 0.65);
      --admonition-tip: rgba(34, 197, 94, 0.65);
      --admonition-warning: rgba(250, 204, 21, 0.65);
      --admonition-danger: rgba(244, 63, 94, 0.65);
      --diff-add-bg: rgba(34, 197, 94, 0.12);
      --diff-del-bg: rgba(244, 63, 94, 0.12);
      --mermaid-img-border: rgba(148, 163, 184, 0.25);
      --mermaid-img-fg: #1e293b;
      --mermaid-fallback-bg: rgba(2, 6, 23, 0.85);
      --mermaid-err-border: rgba(244, 63, 94, 0.22);
      --mermaid-err-tint: rgba(244, 63, 94, 0.04);
      --err-msg-border: rgba(148, 163, 184, 0.18);
      --callout-sop-accent: #10b981;
      --callout-trouble-accent: #f59e0b;
      --callout-warning-accent: #f43f5e;
      --callout-form-accent: #6366f1;
      --callout-character-accent: #06b6d4;
      --callout-exam-accent: #a855f7;

      /* ===== 효과·인쇄 (테마 무관) ===== */
      --shadow-xl: 0 20px 60px rgba(2, 6, 23, 0.35);
      --quote-shadow: 0 4px 15px rgba(0, 0, 0, 0.10);
      --lightbox-img-shadow: 0 20px 60px rgba(0, 0, 0, 0.50);
      --edge-shadow: rgba(0, 0, 0, 0.30);
      --collapse-mask: linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0));
      --tap-highlight: transparent;
      --print-code-border: #cccccc;
      --print-code-bg: #f6f8fa;
      --print-code-fg: #24292e;
    }

    [data-theme="light"], html:has(#themeSwitch:checked) {
      color-scheme: light;
      --fg: rgba(63, 58, 45, 0.95);
      --muted: rgba(122, 114, 96, 1);
      --panel: rgba(233, 228, 212, 0.90);
      --border: rgba(63, 58, 45, 0.16);
      --shadow: 0 10px 25px rgba(2, 6, 23, 0.10);
      --table-cover: #e6e1d1; /* body #cdc8ba + panel rgba(233,228,212,.90) 합성색 */

      --a1: rgba(37, 99, 235, 1);
      --a2: rgba(124, 58, 237, 1);
      --a3: rgba(22, 163, 74, 1);
      --a4: rgba(13, 148, 136, 1);
      --a5: rgba(225, 29, 72, 1);
      --a6: rgba(202, 138, 4, 1);

      /* Pygments codehilite token colors — light (GitHub-inspired) */
      --hl-hll-bg: #f2e9c6;
      --hl-comment: #6a737d;
      --hl-keyword: #d73a49;
      --hl-kn: #d73a49;
      --hl-operator: #d73a49;
      --hl-name: #24292e;
      --hl-attr: #005cc5;
      --hl-class: #6f42c1;
      --hl-fm: #6f42c1;
      --hl-tag: #22863a;
      --hl-constant: #005cc5;
      --hl-string: #032f62;
      --hl-escape: #032f62;
      --hl-number: #005cc5;
      --hl-literal: #005cc5;
      --hl-punct: #24292e;
      --hl-w: #24292e;
      --hl-err: #cb2431;
      --hl-generic: #24292e;
      --hl-gd: #cb2431;
      --hl-gi: #22863a;
      --hl-gp: #005cc5;
      --hl-go: #6a737d;
      --hl-comment-style: italic;

      /* ===== 테마 서피스 (라이트) — 위 :root 블록과 1:1 대응 ===== */
      --page-bg: #cdc8ba;
      --doc-bg: radial-gradient(1200px 700px at 25% -10%, rgba(37,99,235,0.10), transparent 60%),
                radial-gradient(900px 600px at 80% 0%, rgba(124,58,237,0.08), transparent 55%),
                linear-gradient(180deg, #ded8c6 0%, #cdc8ba 60%, #ded8c6 100%);
      --backdrop: rgba(15, 23, 42, 0.25);
      --edge-hint: rgba(15, 23, 42, 0.25);
      --subtitle-fg: var(--muted);
      --badge-bg: rgba(233, 228, 212, 0.72);
      --badge-border: rgba(15, 23, 42, 0.10);
      --hover-bg: rgba(15, 23, 42, 0.06);
      --floating-bg: rgba(233, 228, 212, 0.94);
      --floating-hover: rgba(243, 239, 228, 0.98);
      --floating-border: rgba(15, 23, 42, 0.14);
      --resume-bg: rgba(233, 228, 212, 0.95);
      --tbtn-bg: rgba(233, 228, 212, 0.72);
      --tbtn-hover: rgba(233, 228, 212, 0.95);
      --tbtn-border: rgba(15, 23, 42, 0.10);
      --btn-bg: rgba(233, 228, 212, 0.75);
      --btn-hover: rgba(233, 228, 212, 0.95);
      --input-bg: rgba(233, 228, 212, 0.85);
      --mark-bg: rgba(234, 179, 8, 0.22);
      --mark-border: rgba(234, 179, 8, 0.28);
      --mark-active-bg: rgba(37, 99, 235, 0.18);
      --mark-active-border: rgba(37, 99, 235, 0.22);
      --toc-mark-bg: rgba(234, 179, 8, 0.24);
      --toc-mark-border: rgba(234, 179, 8, 0.30);
      --toc-title: var(--fg);
      --toc-subtitle: var(--muted);
      --strong: rgba(63, 58, 45, 0.98);
      --code-inline-bg: rgba(148, 163, 184, 0.14);
      --code-inline-border: rgba(148, 163, 184, 0.22);
      --code-inline-fg: rgba(63, 58, 45, 0.92);
      --code-bg: #e6e0cb;
      --code-border: rgba(63, 58, 45, 0.14);
      --code-fg: #3f3a2d;
      --hljs-fg: #24292e;
      --hljs-comment: #6a737d;
      --hljs-keyword: #d73a49;
      --hljs-string: #032f62;
      --hljs-title: #6f42c1;
      --hljs-number: #005cc5;
      --hljs-attr: #005cc5;
      --hljs-builtin: #e36209;
      --hljs-meta: #6a737d;
      --mermaid-bg: rgba(233, 228, 212, 0.75);
      --mermaid-border: rgba(63, 58, 45, 0.18);
      --mermaid-fg: rgba(63, 58, 45, 0.92);
      --mermaid-img-bg: #e9e3d1;
      --mermaid-err-bg: rgba(15, 23, 42, 0.06);
      --mermaid-err-fg: rgba(63, 58, 45, 0.88);
      --mermaid-err-title: rgba(190, 18, 60, 0.92);
      --th-bg: rgba(37, 99, 235, 0.08);
      --th-fg: rgba(63, 58, 45, 0.95);
      --th-border: rgba(15, 23, 42, 0.12);
      --td-border: rgba(15, 23, 42, 0.10);
      --tr-even: rgba(15, 23, 42, 0.03);
      --tr-hover: rgba(15, 23, 42, 0.05);
      --quote-border: rgba(99, 102, 241, 0.75);
      --quote-bg: rgba(99, 102, 241, 0.06);
      --callout-sop-bg: linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(16, 185, 129, 0.04));
      --callout-sop-border: rgba(16, 185, 129, 0.35);
      --callout-trouble-bg: linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(245, 158, 11, 0.04));
      --callout-trouble-border: rgba(245, 158, 11, 0.35);
      --callout-warning-bg: linear-gradient(135deg, rgba(244, 63, 94, 0.14), rgba(244, 63, 94, 0.04));
      --callout-warning-border: rgba(244, 63, 94, 0.35);
      --callout-form-bg: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(99, 102, 241, 0.04));
      --callout-form-border: rgba(99, 102, 241, 0.35);
      --callout-character-bg: linear-gradient(135deg, rgba(6, 182, 212, 0.14), rgba(6, 182, 212, 0.04));
      --callout-character-border: rgba(6, 182, 212, 0.35);
      --callout-exam-bg: linear-gradient(135deg, rgba(168, 85, 247, 0.14), rgba(168, 85, 247, 0.04));
      --callout-exam-border: rgba(168, 85, 247, 0.35);
      --lightbox-bg: rgba(233, 228, 212, 0.92);
      --progress-bg: linear-gradient(90deg, #0284c7, #7c3aed);
    }

    .doc-bg {
      background: var(--doc-bg);
    }

    .glass {
      background: var(--panel);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      color: var(--fg);
      position: relative;
      contain: none;
    }

    body {
      color: var(--fg);
      background: var(--page-bg);
    }

    .doc-subtitle { color: var(--subtitle-fg); }

    .brand-badge {
      background: var(--badge-bg);
      border: 1px solid var(--badge-border);
      color: var(--fg);
    }

    .theme-btn {
      border: 1px solid var(--tbtn-border);
      background: var(--tbtn-bg);
      color: var(--fg);
    }
    .theme-btn:hover { background: var(--tbtn-hover); }

    #searchOverlay {
      position: fixed;
      top: 72px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      width: min(860px, calc(100vw - 24px));
      display: none;
    }
    #searchOverlay[data-open="1"] { display: block; }
    .search-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
      border-radius: 1rem;
    }
    .search-input {
      flex: 1;
      border-radius: 0.9rem;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--fg);
      padding: 0.6rem 0.75rem;
      font-size: 0.95rem;
      outline: none;
    }
    .search-meta {
      color: var(--muted);
      font-size: 0.85rem;
      white-space: nowrap;
      padding: 0 0.25rem;
    }
    mark.search-mark {
      background: var(--mark-bg);
      border: 1px solid var(--mark-border);
      color: inherit;
      padding: 0.02rem 0.12rem;
      border-radius: 0.25rem;
    }
    mark.search-mark.search-active {
      background: var(--mark-active-bg);
      border-color: var(--mark-active-border);
    }

    /* Pygments codehilite token colors — theme-aware via CSS variables */
    .highlight .hll { background-color: var(--hl-hll-bg); }
    .highlight .c, .highlight .ch, .highlight .cm, .highlight .cp,
    .highlight .cpf, .highlight .c1, .highlight .cs { color: var(--hl-comment); font-style: var(--hl-comment-style); }
    .highlight .k, .highlight .kc, .highlight .kd, .highlight .kp,
    .highlight .kr, .highlight .kt { color: var(--hl-keyword); }
    .highlight .kn { color: var(--hl-kn); }
    .highlight .o, .highlight .ow { color: var(--hl-operator); }
    .highlight .n, .highlight .nb, .highlight .ni, .highlight .nl,
    .highlight .nn, .highlight .nv, .highlight .bp,
    .highlight .vc, .highlight .vg, .highlight .vi, .highlight .vm,
    .highlight .py { color: var(--hl-name); }
    .highlight .fm { color: var(--hl-fm); }
    .highlight .na { color: var(--hl-attr); }
    .highlight .nc, .highlight .nd, .highlight .ne,
    .highlight .nf, .highlight .nx { color: var(--hl-class); }
    .highlight .nt { color: var(--hl-tag); }
    .highlight .no { color: var(--hl-constant); }
    .highlight .s, .highlight .sa, .highlight .sb, .highlight .sc,
    .highlight .dl, .highlight .sd, .highlight .s2, .highlight .sh,
    .highlight .si, .highlight .sx, .highlight .sr, .highlight .s1,
    .highlight .ss { color: var(--hl-string); }
    .highlight .se { color: var(--hl-escape); }
    .highlight .m, .highlight .mb, .highlight .mf, .highlight .mh,
    .highlight .mi, .highlight .mo, .highlight .il { color: var(--hl-number); }
    .highlight .l, .highlight .ld { color: var(--hl-literal); }
    .highlight .p, .highlight .pm { color: var(--hl-punct); }
    .highlight .w { color: var(--hl-w); }
    .highlight .err { color: var(--hl-err); }
    .highlight .g, .highlight .ge, .highlight .gr, .highlight .gh,
    .highlight .gs, .highlight .gt, .highlight .gu,
    .highlight .ges, .highlight .esc, .highlight .x { color: var(--hl-generic); }
    .highlight .ge { font-style: italic; }
    .highlight .gs { font-weight: bold; }
    .highlight .gd { color: var(--hl-gd); }
    .highlight .gi { color: var(--hl-gi); }
    .highlight .gp { color: var(--hl-gp); font-weight: bold; }
    .highlight .go { color: var(--hl-go); }

    /* nicer scrollbars (webkit only) */
    #toc::-webkit-scrollbar, article pre::-webkit-scrollbar { height: 10px; width: 10px; }
    #toc::-webkit-scrollbar-thumb, article pre::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 9999px;
      border: 2px solid var(--scrollbar-track);
    }
    #toc::-webkit-scrollbar-thumb:hover, article pre::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }

    #toc ul { list-style: none; padding-left: 0; margin: 0.25rem 0 0; }
    #toc li { margin: 0.125rem 0; }
    /* TOC 링크를 감싼 label: 링크처럼 표시 (모바일 드로어 자동 닫기용) */
    .toc-link { display: block; cursor: pointer; }
    #toc a, #tocMobile a {
      display: block;
      padding: 0.35rem 0.5rem;
      border-radius: 0.6rem;
      color: var(--muted);
      text-decoration: none;
    }
    #toc a:hover { background: var(--toc-hover-bg); color: var(--fg); }
    #toc a.toc-active {
      background: var(--toc-active-bg);
      border: 1px solid var(--toc-active-border);
      font-weight: 600;
    }
    #toc .toc > ul { margin-top: 0.25rem; }

    .toc-section {
      margin-top: 0.25rem;
    }
    .toc-section-header {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .toc-toggle {
      width: 1.5rem;
      height: 1.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.5rem;
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      user-select: none;
      font-weight: 700;
      line-height: 1;
    }
    .toc-toggle:hover {
      background: var(--hover-bg);
      border-color: var(--border);
      color: var(--fg);
    }
    .toc-children {
      margin-left: 0.75rem;
      border-left: 1px solid var(--toc-guide);
      padding-left: 0.5rem;
      margin-top: 0.15rem;
    }
    .toc-collapsed .toc-children { display: none; }

    .toc-mark {
      background: var(--toc-mark-bg);
      border: 1px solid var(--toc-mark-border);
      color: inherit;
      padding: 0.02rem 0.18rem;
      border-radius: 0.25rem;
    }

    .toc-title { color: var(--toc-title); }
    .toc-subtitle { color: var(--toc-subtitle); }

    article { color: var(--fg); line-height: 1.75; font-size: var(--article-fs, 1.0625rem); max-width: clamp(72ch, 82vw, 96ch); margin-left: auto; margin-right: auto; padding: 0 1rem; }
    article p { color: var(--fg); margin: 1rem 0; }
    article li { color: var(--fg); margin: 0.25rem 0; }
    article ul, article ol { padding-left: 1.5rem; margin: 0.5rem 0; }
    article ul { list-style-type: disc; }
    article ol { list-style-type: decimal; }
    article hr {
      border: none;
      height: 1px;
      background: var(--border);
      margin: 2rem 0;
    }
    article a { color: var(--a1); text-decoration: underline; text-underline-offset: 3px; }
    article a:hover { color: var(--a4); }
    article strong { color: var(--strong); font-weight: 700; }
    article em { color: var(--muted); font-style: italic; }
    article .headerlink {
      opacity: 0;
      transition: opacity 0.15s;
      text-decoration: none;
      margin-left: 0.3rem;
      color: var(--muted);
    }
    article h1:hover .headerlink,
    article h2:hover .headerlink,
    article h3:hover .headerlink,
    article h4:hover .headerlink { opacity: 0.6; }
    article .headerlink:hover { opacity: 1; }

    article h1 {
      font-size: 2rem;
      line-height: 2.5rem;
      margin: 0 0 1rem;
      background: linear-gradient(90deg, var(--a4), var(--a1), var(--a2));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      letter-spacing: -0.02em;
    }
    article h2 {
      font-size: 1.5rem;
      line-height: 2rem;
      margin: 2.25rem 0 0.75rem;
      color: var(--fg);
      position: relative;
      padding-top: 0.2rem;
    }
    article h2:before {
      content: '';
      display: block;
      height: 2px;
      width: 2.5rem;
      margin-bottom: 0.7rem;
      background: var(--h2-bar);
      border-radius: 9999px;
    }
    article h3 { font-size: 1.25rem; line-height: 1.75rem; margin: 1.75rem 0 0.5rem; color: var(--a4); }
    article h4 { font-size: 1.125rem; line-height: 1.75rem; margin: 1.25rem 0 0.5rem; color: var(--muted); font-weight: 600; }

    article code {
      font-family: "Cascadia Mono", "Cascadia Mono PL", Consolas, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
      font-size: 0.95em;
      background: var(--code-inline-bg);
      border: 1px solid var(--code-inline-border);
      color: var(--code-inline-fg);
      padding: 0.12rem 0.35rem;
      border-radius: 0.45rem;
    }
    article pre {
      background: var(--code-bg);
      border: 1px solid var(--code-border);
      border-radius: 0.9rem;
      padding: 1rem;
      overflow: auto;
      white-space: pre;
      tab-size: 4;
      -moz-tab-size: 4;
      font-variant-ligatures: none;
      font-feature-settings: "liga" 0, "calt" 0;
      letter-spacing: 0;
      font-family: "Cascadia Mono", "Cascadia Mono PL", Consolas, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
      font-kerning: none;
      line-height: 1.52;
      color: var(--code-fg);
    }
    /* codehilite 외부 테마(hljs CDN CSS)보다 우선하도록 !important 유지 */
    .highlight, .highlight pre, .highlight pre code {
      color: var(--code-fg) !important;
      background: var(--code-bg) !important;
    }
    .highlight { border-radius: 0.9rem; }
    article pre code {
      background: transparent;
      border: none;
      padding: 0;
      white-space: pre;
      tab-size: 4;
      -moz-tab-size: 4;
      font-variant-ligatures: none;
      font-feature-settings: "liga" 0, "calt" 0;
      letter-spacing: 0;
      font-family: inherit;
      font-kerning: none;
    }

    /* python-markdown codehilite wrapper */
    .highlight pre {
      white-space: pre;
      tab-size: 4;
      -moz-tab-size: 4;
      font-variant-ligatures: none;
      font-feature-settings: "liga" 0, "calt" 0;
      letter-spacing: 0;
      font-family: "Cascadia Mono", "Cascadia Mono PL", Consolas, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
      font-kerning: none;
      line-height: 1.52;
    }

    .highlight pre *, article pre * {
      font-family: inherit;
      font-variant-ligatures: none;
      font-feature-settings: "liga" 0, "calt" 0;
      letter-spacing: 0;
    }

    /* highlight.js may add .hljs and nested spans; force mono to prevent glyph fallback */
    .hljs, .hljs * {
      font-family: "Cascadia Mono", "Cascadia Mono PL", Consolas, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace !important;
      font-variant-ligatures: none !important;
      font-feature-settings: "liga" 0, "calt" 0 !important;
      letter-spacing: 0 !important;
      font-kerning: none !important;
    }

    /* --- highlight.js CSS fallback theme (when CDN CSS is blocked) --- */
    .hljs {
      display: block;
      overflow-x: auto;
      padding: 0;
      color: var(--hljs-fg);
      background: transparent;
    }
    .hljs-comment,
    .hljs-quote {
      color: var(--hljs-comment);
      font-style: italic;
    }
    .hljs-keyword,
    .hljs-selector-tag,
    .hljs-subst {
      color: var(--hljs-keyword);
      font-weight: 600;
    }
    .hljs-string,
    .hljs-doctag,
    .hljs-regexp {
      color: var(--hljs-string);
    }
    .hljs-title,
    .hljs-section,
    .hljs-selector-id,
    .hljs-selector-class {
      color: var(--hljs-title);
      font-weight: 600;
    }
    .hljs-number,
    .hljs-literal,
    .hljs-symbol,
    .hljs-bullet {
      color: var(--hljs-number);
    }
    .hljs-attr,
    .hljs-attribute,
    .hljs-variable,
    .hljs-template-variable,
    .hljs-type {
      color: var(--hljs-attr);
    }
    .hljs-built_in,
    .hljs-builtin-name {
      color: var(--hljs-builtin);
    }
    .hljs-meta,
    .hljs-meta-keyword,
    .hljs-meta-string {
      color: var(--hljs-meta);
    }
    .hljs-emphasis { font-style: italic; }
    .hljs-strong { font-weight: 700; }
    .hljs-addition { background: var(--diff-add-bg); }
    .hljs-deletion { background: var(--diff-del-bg); }
    /* --- end highlight.js fallback theme --- */

    article pre, article pre code, .highlight pre, .highlight pre code {
      font-family: "Cascadia Mono", "Cascadia Mono PL", Consolas, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace !important;
      font-variant-ligatures: none !important;
      font-feature-settings: "liga" 0, "calt" 0 !important;
      letter-spacing: 0 !important;
      font-kerning: none !important;
    }

    /* ASCII/box-drawing diagrams: try harder to keep CJK glyphs monospaced on Windows/Chrome */
    .ascii-diagram,
    .ascii-diagram code {
      font-family: "D2Coding", "NanumGothicCoding", "Cascadia Mono", "Cascadia Mono PL", Consolas, "JetBrains Mono", "GulimChe", "DotumChe", "MS Gothic", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace !important;
      font-variant-ligatures: none !important;
      font-feature-settings: "liga" 0, "calt" 0 !important;
      letter-spacing: 0 !important;
      font-kerning: none !important;
      white-space: pre !important;
      tab-size: 4;
      -moz-tab-size: 4;
      text-rendering: optimizeSpeed;
    }

    /* Mermaid blocks (offline lite: shown as plain text) */
    .mermaid {
      white-space: pre;
      tab-size: 4;
      -moz-tab-size: 4;
      font-variant-ligatures: none;
      font-feature-settings: "liga" 0, "calt" 0;
      letter-spacing: 0;
      font-family: "Cascadia Mono", "Cascadia Mono PL", Consolas, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
      font-kerning: none;
      line-height: 1.35;
      background: var(--mermaid-bg);
      border: 1px solid var(--mermaid-border);
      border-radius: 0.9rem;
      padding: 1rem;
      overflow: auto;
      margin: 1rem 0;
      color: var(--mermaid-fg);
    }

    .mermaid svg {
      display: block;
      margin: 0.25rem auto;
    }

    .mermaid-svg {
      margin: 1rem 0;
      text-align: center;
      overflow: auto;
      background: var(--mermaid-img-bg);
      border: 1px solid var(--mermaid-img-border);
      border-radius: 0.75rem;
      padding: 1rem;
      color: var(--mermaid-img-fg) !important;
    }
    .mermaid-svg svg {
      display: block;
      margin: 0.25rem auto;
      max-width: 100% !important;
      height: auto !important;
    }

    /* Pre-rendered SVG as <img>: fully isolated from external CSS.
       다크/라이트 모드 전환과 무관하게 SVG 자체 색상 유지. */
    .mermaid-img {
      margin: 1rem 0;
      text-align: center;
      background: var(--mermaid-img-bg);
      border: 1px solid var(--mermaid-img-border);
      border-radius: 0.75rem;
      padding: 1rem;
    }
    .mermaid-img img {
      max-width: 100% !important;
      height: auto !important;
      display: block;
      margin: 0 auto;
    }

    /* Dark mode: improve mermaid node shape visibility */
    .mermaid svg .node rect,
    .mermaid svg .node circle,
    .mermaid svg .node ellipse,
    .mermaid svg .node polygon {
      stroke-width: 1.5 !important;
      stroke-opacity: 0.55 !important;
      fill-opacity: 0.92 !important;
    }

    /* Ensure labels remain visible for client-rendered mermaid only.
       Pre-rendered SVGs (.mermaid-svg) already have correct fill colors
       from mermaid.ink default theme. */
    .mermaid:not(.mermaid-svg) svg text,
    .mermaid:not(.mermaid-svg) svg .label text,
    .mermaid:not(.mermaid-svg) svg .edgeLabel,
    .mermaid:not(.mermaid-svg) svg .edgeLabel text {
      fill: currentColor !important;
      color: currentColor !important;
    }

    .mermaid-fallback {
      white-space: pre;
      tab-size: 4;
      -moz-tab-size: 4;
      font-variant-ligatures: none;
      font-feature-settings: "liga" 0, "calt" 0;
      letter-spacing: 0;
      font-family: "Cascadia Mono", "Cascadia Mono PL", Consolas, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
      line-height: 1.35;
      background: var(--mermaid-fallback-bg);
      border: 1px solid var(--mermaid-err-border);
      border-radius: 0.9rem;
      padding: 1rem;
      overflow: auto;
      margin: 1rem 0;
    }

    .mermaid-error {
      border: 1px solid var(--mermaid-err-border);
      background: var(--mermaid-err-tint);
      border-radius: 0.9rem;
      padding: 0.85rem;
      margin: 1rem 0;
    }
    .mermaid-error-title {
      font-weight: 800;
      font-size: 0.9rem;
      color: var(--mermaid-err-title);
      margin-bottom: 0.5rem;
    }
    .mermaid-error details {
      margin-top: 0.6rem;
    }
    .mermaid-error summary {
      cursor: pointer;
      user-select: none;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .mermaid-error pre.mermaid-error-msg {
      margin-top: 0.5rem;
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--mermaid-err-bg);
      border: 1px solid var(--err-msg-border);
      border-radius: 0.75rem;
      padding: 0.6rem 0.7rem;
      color: var(--mermaid-err-fg);
      overflow: auto;
    }

    /* Copy button for code blocks */
    .codewrap { position: relative; }
    .copy-btn {
      position: absolute;
      top: 0.6rem;
      right: 0.6rem;
      padding: 0.35rem 0.55rem;
      border-radius: 0.7rem;
      font-size: 0.75rem;
      line-height: 1rem;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--btn-bg);
      color: var(--fg);
      cursor: pointer;
      user-select: none;
    }
    .copy-btn:hover { background: var(--btn-hover); }

    .lang-label {
      position: absolute;
      top: 0.6rem;
      right: 4.2rem;
      padding: 0.2rem 0.5rem;
      border-radius: 0.5rem;
      font-size: 0.7rem;
      line-height: 1rem;
      font-weight: 600;
      color: var(--muted);
      user-select: none;
      pointer-events: none;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .table-wrap {
      overflow-x: auto;
      max-width: 100%;
      -webkit-overflow-scrolling: touch;
      margin: 1.25rem 0;
      /* 스크롤 가능 방향을 가장자리 그림자로 표시 (background-attachment: local/scroll 기법) */
      background-image:
        linear-gradient(to right, var(--table-cover) 50%, rgba(0,0,0,0)),
        linear-gradient(to left, var(--table-cover) 50%, rgba(0,0,0,0)),
        radial-gradient(farthest-side at 0 50%, var(--edge-shadow), rgba(0,0,0,0)),
        radial-gradient(farthest-side at 100% 50%, var(--edge-shadow), rgba(0,0,0,0));
      background-position: left center, right center, left center, right center;
      background-repeat: no-repeat;
      background-size: 24px 100%, 24px 100%, 14px 100%, 14px 100%;
      background-attachment: local, local, scroll, scroll;
    }
    .table-wrap table {
      width: max-content;
      min-width: 100%;
      border-collapse: collapse;
      margin: 0;
    }
    article th, article td {
      border: 1px solid var(--td-border);
      padding: 0.65rem 0.85rem;
      vertical-align: top;
      overflow-wrap: break-word;
      word-break: keep-all;
      hyphens: auto;
    }
    article th { background: var(--th-bg); font-weight: 600; color: var(--th-fg); border-color: var(--th-border); }
    article tbody tr:nth-child(even) { background: var(--tr-even); }
    article tbody tr:hover { background: var(--tr-hover); }
    /* Enhanced Practical Notes & Callouts */
    article blockquote {
      border-left: 4px solid var(--quote-border);
      padding: 0.85rem 1.15rem;
      margin: 1.25rem 0;
      background: var(--quote-bg);
      border-radius: 0.75rem;
      color: var(--fg);
      box-shadow: var(--quote-shadow);
      position: relative;
    }
    /* SOP Callouts (Emerald/Green) */
    article blockquote.callout-sop {
      border-left: 4px solid var(--callout-sop-accent);
      background: var(--callout-sop-bg);
      border: 1px solid var(--callout-sop-border);
      border-left-width: 4px;
    }
    /* Troubleshooting Callouts (Amber/Orange) */
    article blockquote.callout-trouble {
      border-left: 4px solid var(--callout-trouble-accent);
      background: var(--callout-trouble-bg);
      border: 1px solid var(--callout-trouble-border);
      border-left-width: 4px;
    }
    /* Inspection Warning Callouts (Rose/Red) */
    article blockquote.callout-warning {
      border-left: 4px solid var(--callout-warning-accent);
      background: var(--callout-warning-bg);
      border: 1px solid var(--callout-warning-border);
      border-left-width: 4px;
    }
    /* Form & Document Sample Callouts (Indigo/Blue) */
    article blockquote.callout-form {
      border-left: 4px solid var(--callout-form-accent);
      background: var(--callout-form-bg);
      border: 1px solid var(--callout-form-border);
      border-left-width: 4px;
    }
    /* Character Note Callouts (Cyan/Sky) */
    article blockquote.callout-character {
      border-left: 4px solid var(--callout-character-accent);
      background: var(--callout-character-bg);
      border: 1px solid var(--callout-character-border);
      border-left-width: 4px;
    }
    /* Exam & Quiz Focus Callouts (Purple/Violet) */
    article blockquote.callout-exam {
      border-left: 4px solid var(--callout-exam-accent);
      background: var(--callout-exam-bg);
      border: 1px solid var(--callout-exam-border);
      border-left-width: 4px;
    }

    /* Back to Top button */
    .back-to-top {
      position: fixed;
      right: 18px;
      bottom: 64px;
      z-index: 9998;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 9999px;
      border: 1px solid var(--floating-border);
      background: var(--floating-bg);
      color: var(--fg);
      font-size: 1.2rem;
      line-height: 1;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow);
      transition: opacity 0.2s;
    }
    .back-to-top:hover { background: var(--floating-hover); }

    /* Lightbox */
    .lightbox-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: var(--lightbox-bg);
      display: none;
      align-items: center;
      justify-content: center;
      cursor: zoom-out;
    }
    .lightbox-overlay img {
      max-width: 92vw;
      max-height: 92vh;
      border-radius: 0.75rem;
      box-shadow: var(--lightbox-img-shadow);
    }
    article img {
      cursor: zoom-in;
    }

    /* 모바일에서 테마 버튼 클릭이 안 되는 문제 방어:
       라이트박스/검색 오버레이는 활성화 전에는 화면을 덮어도 탭을 가로채지
       않도록 pointer-events를 끈다. (Tailwind 등으로 display 제어가 어긋나
       투명하게 남아도 버튼 클릭을 막지 않게 하는 안전장치.)
       활성 상태(display:flex / [data-open="1"])일 때만 이벤트를 받는다. */
    .lightbox-overlay { pointer-events: none; }
    .lightbox-overlay[style*="flex"] { pointer-events: auto; }
    #searchOverlay { pointer-events: none; }
    #searchOverlay[data-open="1"] { pointer-events: auto; }
    /* 테마 버튼은 항상 최상단에서 탭을 받는다. */
    .theme-fab {
      pointer-events: auto !important;
      z-index: 2147483000 !important;
    }

    /* TOC progress */
    .toc-progress {
      font-size: 0.7rem;
      color: var(--muted);
      padding: 0.2rem 0.5rem;
      margin-bottom: 0.25rem;
    }

    .topbar {
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      overflow: visible;
      transition: transform 0.25s ease;
    }
    /* 스크롤 다운 시 topbar 자동 숨김 (몰입형 독서) */
    .topbar.topbar-hidden { transform: translateY(-100%); }

    /* 읽기 진행률 바 — 최상단 고정, topbar가 숨어도 유지 */
    #readingProgress {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      width: 0%;
      background: var(--progress-bg);
      z-index: 65;
      transition: width 0.08s linear;
      pointer-events: none;
    }
    /* CSS 스크롤 구동 애니메이션: JS 없는 모바일 file:// 환경에서도
       진행률 바가 동작한다 (Chrome 115+, Safari 26+).
       지원하는 브라우저에서는 아래 JS 폴백이 자동으로 비활성화된다. */
    @supports (animation-timeline: scroll()) {
      #readingProgress {
        width: 100%;
        transform-origin: 0 50%;
        transform: scaleX(0);
        transition: none;
        animation: readingProgressFill linear both;
        animation-timeline: scroll(root);
      }
    }
    @keyframes readingProgressFill {
      to { transform: scaleX(1); }
    }

    /* 모션 감축 설정 시 자동 숨김/진행률 애니메이션을 비활성화한다.
       진행률 바는 애니메이션 없이 최종 상태(scaleX(1)=가득 참)로 표시되지
       않도록 JS 폴백이 width를 계속 갱신하도록 둔다 — CSS 애니메이션만 끈다. */
    @media (prefers-reduced-motion: reduce) {
      .topbar { transition: none; }
      #readingProgress { transition: none; }
      .toc-edge-hint { animation: none; }
      @supports (animation-timeline: scroll()) {
        /* transform을 해제하고 width를 JS 폴백이 갱신할 수 있게 0으로 둔다 */
        #readingProgress { animation: none; transform: none; width: 0; }
      }
    }

    /* 이어읽기 제안 버튼 (하단 중앙) */
    #resumeBtn {
      position: fixed;
      left: 50%;
      bottom: 100px;
      transform: translateX(-50%);
      z-index: 65;
      display: none;
      border: 1px solid var(--floating-border);
      background: var(--resume-bg);
      color: var(--fg);
      padding: 0.6rem 1rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      box-shadow: var(--shadow);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: var(--tap-highlight);
      white-space: nowrap;
    }
    #resumeBtn.show { display: inline-flex; align-items: center; gap: 0.35rem; }
    /* TOC 드로어가 열린 동안에는 이어읽기 버튼을 숨긴다.
       (resumeBtn z-index 65 > 드로어 z-40 이므로 백드롭 위에 떠 보이는 것 방지) */
    #tocSwitch:checked ~ #resumeBtn { display: none !important; }

    /* 앵커(목차) 이동 시 대상 heading이 sticky 헤더 뒤에 숨지 않도록
       스크롤 여백을 준다. 헤더 높이(약 60px)보다 넉넉하게 잡는다. */
    article h1, article h2, article h3, article h4, article h5, article h6,
    :target {
      scroll-margin-top: 5rem;
    }

    /* Print styles */
    @media print {
      header.topbar, .theme-fab, #toast, #tocDrawer,
      aside, .copy-btn, .expand-btn, .lang-label,
      .back-to-top, .lightbox-overlay, #searchOverlay,
      #readingProgress, #resumeBtn, .toc-edge-hint { display: none !important; }
      article { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
      article pre, .highlight pre {
        white-space: pre-wrap !important;
        word-break: break-word !important;
        border: 1px solid var(--print-code-border) !important;
        background: var(--print-code-bg) !important;
        color: var(--print-code-fg) !important;
      }
      .codewrap.collapsed {
        max-height: none !important;
        overflow: visible !important;
        mask-image: none !important;
        -webkit-mask-image: none !important;
      }
      article table { display: table !important; }
      a[href]::after { content: none !important; }
      .mermaid svg { max-width: 100% !important; }
    }
  </style>
</head>

<body class="min-h-screen">
  <a class="skip-link" href="#mainContent">본문으로 바로가기</a>
  <!-- CSS-only TOC 드로어 토글: checkbox + label (JS 없이도 열고 닫기 가능) -->
  <input type="checkbox" id="tocSwitch" class="toc-switch" aria-label="목차 드로어 열기/닫기" />
  <!-- 왼쪽 가장자리 힌트 탭: 탭하면 드로어 오픈 (JS 없는 환경 폴백) -->
  <label for="tocSwitch" class="toc-edge-hint" aria-label="목차 열기"></label>
  <header class="topbar sticky top-0 z-50">
    <div class="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="brand-badge h-9 w-9 rounded-xl grid place-items-center font-bold">MD</div>
        <div class="leading-tight">
          <div class="doc-subtitle text-xs">Documentation</div>
          <div class="text-sm font-semibold">%%TITLE%%</div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button id="btnFontMinus" class="theme-btn inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium" aria-label="글자 크기 줄이기">A&#8722;</button>
        <button id="btnFontPlus" class="theme-btn inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium" aria-label="글자 크기 키우기">A+</button>
        <button id="btnSearch" class="theme-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium">Search</button>
        <button id="btnAutoFold" class="theme-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium">AutoFold</button>
        <button id="btnFold" class="theme-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium">Fold</button>
      </div>
    </div>
  </header>

  <div id="searchOverlay" aria-hidden="true">
    <div class="glass search-bar">
      <input id="searchInput" class="search-input" type="search" placeholder="Search in document... (Esc to close)" autocomplete="off" />
      <span id="searchCount" class="search-meta">0 / 0</span>
      <button id="btnSearchPrev" class="theme-btn rounded-xl px-3 py-2 text-xs font-medium" type="button">Prev</button>
      <button id="btnSearchNext" class="theme-btn rounded-xl px-3 py-2 text-xs font-medium" type="button">Next</button>
      <button id="btnSearchClose" class="theme-btn rounded-xl px-3 py-2 text-xs font-medium" type="button">Close</button>
    </div>
  </div>

  <!-- Mobile TOC Drawer: checkbox #tocSwitch 체크 시 표시 (CSS-only) -->
  <div id="tocDrawer" class="fixed inset-0 z-40">
    <label for="tocSwitch" id="tocBackdrop" class="drawer-backdrop fixed inset-0"></label>
    <div class="fixed left-0 top-0 drawer-panel">
      <div class="p-4 border-b" style="border-color: var(--border);">
        <div class="flex items-center justify-between">
          <div>
            <div class="toc-title text-sm font-semibold">목차</div>
            <div class="toc-subtitle text-xs mt-0.5">Heading 기반 자동 생성</div>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnAutoFoldMobile" class="theme-btn rounded-xl px-3 py-2 text-xs font-medium">AutoFold</button>
            <label for="tocSwitch" id="btnTocClose" class="theme-btn rounded-xl px-3 py-2 text-xs font-medium">Close</label>
          </div>
        </div>
        <div class="mt-3">
          <input id="tocSearchMobile" type="search" placeholder="Search..." class="w-full rounded-xl border border-slate-200/10 bg-white/5 px-3 py-2 text-sm" />
        </div>
      </div>
      <nav id="tocMobile" class="p-3 text-sm">
        %%TOC_HTML%%
      </nav>
    </div>
  </div>

  <div class="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside class="hidden lg:block lg:col-span-3">
        <div class="sticky top-24">
          <div class="glass rounded-2xl">
            <div class="px-4 py-3 border-b border-slate-200/10">
              <div class="toc-title text-sm font-semibold">목차</div>
              <div class="toc-subtitle text-xs mt-0.5">Heading 기반 자동 생성</div>
            </div>
            <div class="px-3 pt-3">
              <input id="tocSearch" type="search" placeholder="Search..." class="w-full rounded-xl border border-slate-200/10 bg-white/5 px-3 py-2 text-sm" />
            </div>
            <nav id="toc" class="h-[calc(100vh-10rem)] overflow-auto p-3 text-sm">
              %%TOC_HTML%%
            </nav>
          </div>
        </div>
      </aside>

      <main id="mainContent" class="lg:col-span-9" tabindex="-1">
        <article class="glass rounded-2xl px-6 sm:px-8 py-8">
          %%BODY_HTML%%
        </article>
      </main>
    </div>
  </div>

  <div id="toast" role="status" aria-live="polite"></div>
  <div id="readingProgress" aria-hidden="true"></div>
  <button id="resumeBtn" type="button">&#8635; 이어읽기</button>
  <button id="btnBackToTop" type="button" class="back-to-top" aria-label="Back to top">&#8593;</button>
  <div id="lightbox" class="lightbox-overlay"><img id="lightboxImg" src="" alt="" /></div>

  <script>
    // Shared utilities (used by multiple script blocks)
    function _showToast(msg) {
      var el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.style.display = 'block';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, 1200);
    }
    function _getAutoFold() {
      try {
        var v = localStorage.getItem('toc_autofold');
        if (v === null) return true;
        return v === '1';
      } catch (e) { return true; }
    }
  </script>

  <!-- CSS-only 테마 토글: checkbox + label (JS 없이도 작동, 모바일 file:// 대응).
       JS가 작동하면 change 이벤트로 data-theme 동기화 + localStorage 저장 + Mermaid 재렌더. -->
  <input type="checkbox" id="themeSwitch" class="theme-switch" aria-label="다크/라이트 테마 전환" />
  <label for="themeSwitch" id="btnThemeFab" class="theme-fab">Theme</label>

  <script>
    (function () {
      var root = document.documentElement;
      var btnFab = document.getElementById('btnThemeFab');
      var btnAutoFold = document.getElementById('btnAutoFold');
      var btnAutoFoldMobile = document.getElementById('btnAutoFoldMobile');
      if (!btnFab) return;

      var getAutoFold = _getAutoFold;
      var showToast = _showToast;

      function setAutoFold(v) {
        try { localStorage.setItem('toc_autofold', v ? '1' : '0'); } catch (e) {}
        if (btnAutoFold) {
          btnAutoFold.textContent = v ? 'AutoFold: On' : 'AutoFold: Off';
        }
        if (btnAutoFoldMobile) {
          btnAutoFoldMobile.textContent = v ? 'AutoFold: On' : 'AutoFold: Off';
        }
      }

      // 임베드가 꺼져 있고(=CDN 사용) 기본 CDN이 모바일 인앱 브라우저에서 차단된
      // 경우를 대비한 안전망. window.mermaid 가 준비되지 않았을 때 대체 CDN과
      // ESM 모듈을 순서대로 한 번씩 주입해 본다. (임베드된 경우엔 애초에 실행 안 됨)
      function ensureMermaidLoading() {
        if (ensureMermaidLoading._started || window.mermaid) return;
        ensureMermaidLoading._started = true;
        var cdns = [%%MERMAID_CDN_URLS_JS%%];
        var i = 0;
        function tryEsm() {
          if (window.mermaid) return;
          try {
            var m = document.createElement('script');
            m.type = 'module';
            m.textContent =
              "import m from '%%MERMAID_ESM_URL%%';" +
              "window.mermaid = m;";
            document.head.appendChild(m);
          } catch (e) {}
        }
        function tryNext() {
          if (window.mermaid || i >= cdns.length) { tryEsm(); return; }
          var s = document.createElement('script');
          s.src = cdns[i++];
          s.async = true;
          s.onerror = function () { tryNext(); };
          s.onload = function () { /* window.mermaid should now be set */ };
          document.head.appendChild(s);
        }
        tryNext();
      }

      function fixMindmapContrast() {
        function relLum(r, g, b) {
          var f = function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        }
        function parseColor(c) {
          if (!c) return null;
          c = c.trim();
          var m;
          if (m = c.match(/^#([0-9a-f]{3})$/i)) return [parseInt(m[1][0]+m[1][0],16), parseInt(m[1][1]+m[1][1],16), parseInt(m[1][2]+m[1][2],16)];
          if (m = c.match(/^#([0-9a-f]{6})$/i)) return [parseInt(m[1].substr(0,2),16), parseInt(m[1].substr(2,2),16), parseInt(m[1].substr(4,2),16)];
          if (m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
          return null;
        }
        function getFill(el) {
          var fill = el.getAttribute('fill');
          if (!fill || fill === 'none' || fill === 'transparent') {
            var st = el.getAttribute('style') || '';
            var m = st.match(/fill:\s*([^;]+)/);
            if (m) fill = m[1].trim();
          }
          if (!fill || fill === 'none' || fill === 'transparent' || fill.indexOf('url(') === 0) return null;
          return fill;
        }
        var containers = document.querySelectorAll('.mermaid');
        for (var ci = 0; ci < containers.length; ci++) {
          var cont = containers[ci];
          var isPre = false;
          var nodes = cont.querySelectorAll('.mindmap-node');
          for (var ni = 0; ni < nodes.length; ni++) {
            var g = nodes[ni];
            var shape = g.querySelector('path, rect, circle, ellipse, polygon');
            if (!shape) continue;
            var fill = getFill(shape);
            if (!fill) continue;
            var rgb = parseColor(fill);
            if (!rgb) continue;
            var lum = relLum(rgb[0], rgb[1], rgb[2]);
            var textColor = lum > 0.4 ? '#0f172a' : '#f1f5f9';
            if (isPre) {
              var texts = g.querySelectorAll('text');
              for (var ti = 0; ti < texts.length; ti++) texts[ti].style.fill = textColor;
              var fos = g.querySelectorAll('foreignObject');
              for (var fi = 0; fi < fos.length; fi++) fos[fi].style.color = textColor;
            } else {
              g.style.color = textColor;
            }
          }
        }
      }

      function renderMermaid(mode) {
        try {
          if (!window.mermaid) {
            ensureMermaidLoading();
            renderMermaid._waited = (renderMermaid._waited || 0) + 1;
            if (renderMermaid._waited <= 100) {
              setTimeout(function () { renderMermaid(root.dataset.theme || mode); }, 200);
            } else if (!renderMermaid._notified) {
              renderMermaid._notified = true;
              var pending = document.querySelectorAll('.mermaid');
              for (var pi = 0; pi < pending.length; pi++) {
                var pn = pending[pi];
                if (pn.querySelector('svg')) continue;
                var note = document.createElement('div');
                note.className = 'mermaid-error-title';
                note.style.margin = '0 0 0.4rem 0';
                note.textContent = 'mermaid.min.js load failed';
                pn.parentNode.insertBefore(note, pn);
              }
            }
            return;
          }
          renderMermaid._waited = 0;

          var theme = (mode === 'light') ? 'default' : 'dark';
          var themeVars = (mode === 'light') ? {} : {
            mainBkg: '#1e3a5f',
            primaryColor: '#1e3a5f',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#3b82f6',
            lineColor: '#64748b',
            textColor: '#e2e8f0',
            nodeBorder: '#3b82f6',
            edgeLabelBackground: '#1e293b',
            clusterBkg: '#1e293b',
            clusterBorder: '#475569',
            secondBkg: '#334155',
            tertiaryColor: '#475569',
          };

          // Save original source so we can restore on re-render (theme change)
          var nodes = document.querySelectorAll('.mermaid');
          for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (!n.dataset.src) n.dataset.src = n.textContent || '';
            // Remove any previously rendered SVG to force fresh render
            n.removeAttribute('data-processed');
            n.innerHTML = '';
            n.textContent = n.dataset.src;
          }

          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: theme,
            themeVariables: themeVars
          });

          // Use mermaid.run() — the v11 standard API.
          // It finds all .mermaid elements and renders them automatically.
          var runResult = window.mermaid.run({ querySelector: '.mermaid' });
          if (runResult && typeof runResult.then === 'function') {
            runResult.then(function () { fixMindmapContrast(); }).catch(function (err) {
              try { console.error('[Mermaid run error]', err); } catch (e) {}
            });
          } else {
            setTimeout(fixMindmapContrast, 300);
          }
        } catch (e2) {
          try { console.error('[renderMermaid error]', e2); } catch (e) {}
        }
      }

      function apply(mode) {
        root.dataset.theme = mode;
        // doc-bg는 <html>(documentElement)에만 적용한다. <head>의 초기 테마
        // 스크립트는 파싱 도중 <body>가 아직 없을 수 있어 documentElement를
        // 대상으로 쓴다. 여기서도 같은 요소에 맞춰야 테마 전환 시 배경이
        // 어긋나지 않는다. (과거 <body> 대상 코드가 남긴 클래스는 함께 제거)
        document.body.classList.remove('doc-bg');
        if (mode === 'light') {
          root.classList.remove('doc-bg');
        } else {
          root.classList.add('doc-bg');
        }
        // checkbox 동기화 (label 텍스트는 CSS ::after로 처리되므로 JS textContent 불필요)
        var cb = document.getElementById('themeSwitch');
        if (cb) cb.checked = (mode === 'light');
        try { renderMermaid(mode); } catch (e) {}
        try { setAutoFold(getAutoFold()); } catch (e) {}
      }

      var saved = null;
      try { saved = localStorage.getItem('doc_theme'); } catch (e) {}
      var mode = saved;
      if (!mode) {
        try {
          mode = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
        } catch (e) {
          mode = 'dark';
        }
      }
      apply(mode);

      // 안전망: mermaid.min.js 를 포함한 모든 하위 리소스가 로드된 뒤 한 번 더 렌더한다.
      // 모바일 크롬에서 파싱 시점에 스크립트가 준비되지 않아 다이어그램이 텍스트로
      // 남는 문제를 이 재렌더가 해결한다.
      window.addEventListener('load', function () {
        try { renderMermaid(root.dataset.theme || mode); } catch (e) {}
        try { fixMindmapContrast(); } catch (e) {}
      });

      // 테마 토글: checkbox change 이벤트 기반.
      // label(#btnThemeFab)을 클릭하면 checkbox가 자동 토글 → change 발생.
      // JS가 차단된 환경(모바일 file://)에서는 CSS :has()만으로 토글 작동.
      var themeCb = document.getElementById('themeSwitch');
      if (themeCb) {
        themeCb.addEventListener('change', function () {
          mode = themeCb.checked ? 'light' : 'dark';
          try { localStorage.setItem('doc_theme', mode); } catch (e) {}
          apply(mode);
          try { showToast(mode === 'light' ? 'Light mode' : 'Dark mode'); } catch (e) {}
        });
      }
      // 외부 호출용 (다른 스크립트에서 테마 토글 필요 시)
      window._toggleTheme = function () {
        if (themeCb) themeCb.click();
      };

      if (btnAutoFold) {
        setAutoFold(getAutoFold());
        btnAutoFold.addEventListener('click', function () {
          var next = !getAutoFold();
          setAutoFold(next);
          showToast(next ? 'AutoFold On' : 'AutoFold Off');
        });
      }

      if (btnAutoFoldMobile) {
        setAutoFold(getAutoFold());
        btnAutoFoldMobile.addEventListener('click', function () {
          var next = !getAutoFold();
          setAutoFold(next);
          showToast(next ? 'AutoFold On' : 'AutoFold Off');
        });
      }

      // 글자 크기 조절 (A−/A+): --article-fs 변경 + localStorage 저장
      var FS_SIZES = ['0.9375rem', '1.0rem', '1.0625rem', '1.1875rem', '1.3125rem'];
      var FS_LABELS = ['아주 작게', '작게', '기본', '크게', '아주 크게'];
      function getFontIdx() {
        try {
          var v = parseInt(localStorage.getItem('doc_fontsize'), 10);
          if (isNaN(v)) return 2;
          return Math.max(0, Math.min(FS_SIZES.length - 1, v));
        } catch (e) { return 2; }
      }
      function setFontIdx(i) {
        i = Math.max(0, Math.min(FS_SIZES.length - 1, i));
        document.documentElement.style.setProperty('--article-fs', FS_SIZES[i]);
        try { localStorage.setItem('doc_fontsize', String(i)); } catch (e) {}
        showToast('글자 크기: ' + FS_LABELS[i]);
      }
      var btnFontMinus = document.getElementById('btnFontMinus');
      var btnFontPlus = document.getElementById('btnFontPlus');
      if (btnFontMinus) btnFontMinus.addEventListener('click', function () { setFontIdx(getFontIdx() - 1); });
      if (btnFontPlus) btnFontPlus.addEventListener('click', function () { setFontIdx(getFontIdx() + 1); });
    })();
  </script>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      var btnSearch = document.getElementById('btnSearch');
      var overlay = document.getElementById('searchOverlay');
      var input = document.getElementById('searchInput');
      var countEl = document.getElementById('searchCount');
      var btnPrev = document.getElementById('btnSearchPrev');
      var btnNext = document.getElementById('btnSearchNext');
      var btnClose = document.getElementById('btnSearchClose');
      var article = document.querySelector('article');
      if (!overlay || !input || !article) return;

      var marks = [];
      var hitMarks = [];
      var activeHit = -1;
      var isComposing = false;
      var applyTimer = null;

      function isEditableTarget(t) {
        if (!t) return false;
        var tag = (t.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (t.isContentEditable) return true;
        return false;
      }

      function setOpen(v) {
        overlay.dataset.open = v ? '1' : '0';
        overlay.setAttribute('aria-hidden', v ? 'false' : 'true');
        if (v) {
          try { input.focus(); input.select(); } catch (e) {}
        }
      }

      function clearMarks() {
        try {
          for (var i = 0; i < marks.length; i++) {
            var m = marks[i];
            if (!m || !m.parentNode) continue;
            var txt = document.createTextNode(m.textContent || '');
            m.parentNode.replaceChild(txt, m);
          }
          marks = [];
          hitMarks = [];
          activeHit = -1;
          if (countEl) countEl.textContent = '0 / 0';
        } catch (e) {}
      }

      function normalizeQuery(q) {
        var s = String(q || '').trim();
        try {
          if (s && s.normalize) s = s.normalize('NFC');
        } catch (e) {}
        return s;
      }

      function collectTextNodes() {
        var walker = document.createTreeWalker(
          article,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function (node) {
              try {
                if (!node || !node.parentNode) return NodeFilter.FILTER_REJECT;
                var s = String(node.nodeValue || '');
                if (!s || !s.trim()) return NodeFilter.FILTER_REJECT;
                var p = node.parentNode;
                var tag = (p.tagName || '').toLowerCase();
                if (tag === 'script' || tag === 'style') return NodeFilter.FILTER_REJECT;
                if (tag === 'code' || tag === 'pre') return NodeFilter.FILTER_REJECT;
                if (p.closest && p.closest('pre, code, .mermaid, .highlight')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              } catch (e) {
                return NodeFilter.FILTER_REJECT;
              }
            }
          },
          false
        );
        var nodes = [];
        var n = null;
        while ((n = walker.nextNode())) nodes.push(n);
        return nodes;
      }

      function highlight(q) {
        clearMarks();
        q = normalizeQuery(q);
        if (!q) return;

        var qLower = q.toLowerCase();
        var nodes = collectTextNodes();
        if (!nodes || nodes.length === 0) return;

        // Search across the whole article text so matches spanning multiple text nodes
        // still work (common in HTML due to inline elements).
        var full = '';
        var meta = [];
        var off = 0;
        for (var i = 0; i < nodes.length; i++) {
          var t = String(nodes[i].nodeValue || '');
          meta.push({ node: nodes[i], start: off, len: t.length });
          full += t;
          off += t.length;
        }
        try { if (full && full.normalize) full = full.normalize('NFC'); } catch (e) {}
        var fullLower = full.toLowerCase();

        var hits = [];
        var pos = 0;
        while (true) {
          var at = fullLower.indexOf(qLower, pos);
          if (at < 0) break;
          hits.push({ start: at, end: at + q.length });
          pos = at + q.length;
        }
        if (hits.length === 0) {
          if (countEl) countEl.textContent = '0 / 0';
          return;
        }

        hitMarks = [];
        for (var z = 0; z < hits.length; z++) hitMarks.push([]);

        function wrapInNode(node, a, b, hitIndex) {
          try {
            // Split into [0..a)[a..b)[b..]
            var mid = node;
            if (a > 0) mid = node.splitText(a);
            var after = mid;
            if ((b - a) < mid.nodeValue.length) after = mid.splitText(b - a);
            var m = document.createElement('mark');
            m.className = 'search-mark';
            m.textContent = mid.nodeValue;
            mid.parentNode.replaceChild(m, mid);
            marks.push(m);
            try {
              if (typeof hitIndex === 'number' && hitIndex >= 0) {
                m.dataset.hitIndex = String(hitIndex);
                if (hitMarks[hitIndex]) hitMarks[hitIndex].push(m);
              }
            } catch (e2) {}
          } catch (e) {}
        }

        // Apply from end to start so Text.splitText offsets remain valid.
        for (var h = hits.length - 1; h >= 0; h--) {
          var s = hits[h].start;
          var e = hits[h].end;
          for (var j = meta.length - 1; j >= 0; j--) {
            var item = meta[j];
            var ns = item.start;
            var ne = item.start + item.len;
            if (e <= ns || s >= ne) continue;
            var localStart = Math.max(0, s - ns);
            var localEnd = Math.min(item.len, e - ns);
            if (localEnd > localStart) {
              wrapInNode(item.node, localStart, localEnd, h);
            }
          }
        }

        // Wrapping is applied in reverse order; sort marks back into document order
        // so navigation starts from the top.
        try {
          marks.sort(function (a, b) {
            if (a === b) return 0;
            var pos = a.compareDocumentPosition(b);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
          });
        } catch (e) {}

        // Sort segments inside each hit to keep active styling consistent.
        try {
          for (var hh = 0; hh < hitMarks.length; hh++) {
            hitMarks[hh].sort(function (a, b) {
              if (a === b) return 0;
              var pos = a.compareDocumentPosition(b);
              if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
              if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
              return 0;
            });
          }
        } catch (e2) {}

        if (hits.length > 0) {
          setActive(0);
        } else {
          if (countEl) countEl.textContent = '0 / 0';
        }
      }

      function setActive(idx) {
        if (!hitMarks || hitMarks.length === 0) return;
        if (idx < 0) idx = hitMarks.length - 1;
        if (idx >= hitMarks.length) idx = 0;

        try {
          if (activeHit >= 0 && hitMarks[activeHit] && hitMarks[activeHit].length) {
            for (var i = 0; i < hitMarks[activeHit].length; i++) {
              hitMarks[activeHit][i].classList.remove('search-active');
            }
          }
        } catch (e) {}

        activeHit = idx;
        var arr = hitMarks[activeHit] || [];
        for (var j = 0; j < arr.length; j++) {
          try { arr[j].classList.add('search-active'); } catch (e2) {}
        }
        var el = arr.length ? arr[0] : null;
        if (el) {
          try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e3) { try { el.scrollIntoView(true); } catch (e4) {} }
        }
        if (countEl) countEl.textContent = String(activeHit + 1) + ' / ' + String(hitMarks.length);
      }

      function next() { if (hitMarks.length) setActive(activeHit + 1); }
      function prev() { if (hitMarks.length) setActive(activeHit - 1); }

      function closeAndClear() {
        setOpen(false);
        input.value = '';
        clearMarks();
      }

      if (btnSearch) {
        btnSearch.addEventListener('click', function () {
          setOpen(true);
        });
      }
      if (btnClose) btnClose.addEventListener('click', closeAndClear);
      if (btnNext) btnNext.addEventListener('click', next);
      if (btnPrev) btnPrev.addEventListener('click', prev);

      function scheduleApply() {
        try { if (applyTimer) clearTimeout(applyTimer); } catch (e) {}
        applyTimer = setTimeout(function () {
          try {
            // Defer again to ensure input.value is updated (IME / composition timing).
            if (window.requestAnimationFrame) {
              window.requestAnimationFrame(function () {
                setTimeout(function () { highlight(input.value); }, 0);
              });
            } else {
              setTimeout(function () { highlight(input.value); }, 0);
            }
          } catch (e2) {
            highlight(input.value);
          }
        }, 0);
      }

      input.addEventListener('compositionstart', function () {
        isComposing = true;
        scheduleApply();
      });
      input.addEventListener('compositionupdate', function () {
        // Update while composing so multi-char Korean queries are searchable immediately.
        scheduleApply();
      });
      input.addEventListener('compositionend', function () {
        isComposing = false;
        scheduleApply();
      });

      input.addEventListener('beforeinput', function () {
        scheduleApply();
      });

      input.addEventListener('input', function (e) {
        // Do not block while composing: Chrome IME may keep isComposing true until commit.
        scheduleApply();
      });

      input.addEventListener('keyup', function (e) {
        if (!e) return;
        if (e.key === 'Enter' || e.key === 'Escape') return;
        scheduleApply();
      });

      input.addEventListener('keydown', function (e) {
        if (!e) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) prev();
          else next();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeAndClear();
        }
      });

      document.addEventListener('keydown', function (e) {
        if (!e) return;
        if (isEditableTarget(e.target) && e.target !== input) return;

        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          setOpen(true);
          return;
        }
        if (!e.ctrlKey && !e.metaKey && e.key === '/' && e.target !== input) {
          e.preventDefault();
          setOpen(true);
          return;
        }
        if (e.key === 'Escape' && overlay.dataset.open === '1') {
          e.preventDefault();
          closeAndClear();
          return;
        }
        if (overlay.dataset.open === '1') {
          if (e.key === 'F3') {
            e.preventDefault();
            if (e.shiftKey) prev();
            else next();
          }
        }
      });
    });
  </script>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      var drawer = document.getElementById('tocDrawer');
      var backdrop = document.getElementById('tocBackdrop');
      var btnClose = document.getElementById('btnTocClose');
      var tocCb = document.getElementById('tocSwitch');

      function openDrawer() {
        if (tocCb) tocCb.checked = true;
      }
      function closeDrawer() {
        if (tocCb) tocCb.checked = false;
      }

      if (btnClose) btnClose.addEventListener('click', closeDrawer);
      if (backdrop) backdrop.addEventListener('click', closeDrawer);
      document.addEventListener('keydown', function (e) {
        if (e && e.key === 'Escape') closeDrawer();
      });

      // 왼쪽 가장자리 스와이프로 TOC 드로어 열기 (모바일 표준 패턴)
      // - 화면 왼쪽 끝(24px 이내)에서 오른쪽으로 스와이프 → 드로어 오픈
      // - 드로어가 열린 상태에서 왼쪽으로 스와이프 → 드로어 닫기
      (function () {
        if (!tocCb) return;
        var EDGE = 24;     // 왼쪽 끝 인식 영역 (px)
        var THRESH = 48;   // 스와이프 인식 최소 거리 (px)
        var startX = 0, startY = 0, tracking = false, wasOpen = false;

        document.addEventListener('touchstart', function (e) {
          if (!e.touches || e.touches.length !== 1) { tracking = false; return; }
          var t = e.touches[0];
          if (!tocCb.checked && t.clientX <= EDGE) {
            tracking = true; wasOpen = false;
            startX = t.clientX; startY = t.clientY;
          } else if (tocCb.checked) {
            tracking = true; wasOpen = true;
            startX = t.clientX; startY = t.clientY;
          } else {
            tracking = false;
          }
        }, { passive: true });

        document.addEventListener('touchmove', function (e) {
          if (!tracking) return;
          var t = e.touches[0];
          var dx = t.clientX - startX;
          var dy = t.clientY - startY;
          // 세로 스크롤 의도면 취소
          if (Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }
          if (!wasOpen && dx > THRESH) { openDrawer(); tracking = false; }
          else if (wasOpen && dx < -THRESH) { closeDrawer(); tracking = false; }
        }, { passive: true });

        document.addEventListener('touchend', function () { tracking = false; }, { passive: true });
        document.addEventListener('touchcancel', function () { tracking = false; }, { passive: true });
      })();

      // 모바일 드로어 안의 목차 링크를 누르면 드로어를 닫아, 이동한 위치가
      // 보이도록 한다. 드로어는 fixed inset-0으로 화면 전체를 덮기 때문에
      // 닫지 않으면 앵커 이동이 일어나도 사용자에게는 아무 변화가 없는 것처럼
      // 보인다. 앵커 기본 동작(해시 이동)은 막지 않는다.
      var tocMobileNav = document.getElementById('tocMobile');
      if (tocMobileNav) {
        tocMobileNav.addEventListener('click', function (e) {
          var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
          if (!a) return;
          var id = (a.getAttribute('href') || '').slice(1);
          // 드로어를 닫은 뒤, 레이아웃이 반영된 다음 대상으로 스크롤한다.
          closeDrawer();
          if (id) {
            var target = document.getElementById(id);
            if (target) {
              e.preventDefault();
              setTimeout(function () {
                try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                catch (e2) { try { target.scrollIntoView(true); } catch (e3) {} }
                try { history.replaceState(null, '', '#' + id); } catch (e4) {}
              }, 60);
            }
          }
        });
      }
    });
  </script>

  <script>
    // 읽기 UX 3종: 진행률 바, topbar 자동 숨김, 이어읽기(스크롤 위치 복원)
    document.addEventListener('DOMContentLoaded', function () {
      var topbar = document.querySelector('.topbar');
      var progress = document.getElementById('readingProgress');
      var resumeBtn = document.getElementById('resumeBtn');
      var docEl = document.documentElement;
      var lastY = window.scrollY || 0;
      var ticking = false;
      var SAVE_KEY = 'doc_scroll:' + (location.pathname || 'doc');

      // CSS 스크롤 구동 애니메이션이 지원되면 JS로 width를 갱신하지 않는다
      // (둘 다 적용되면 width% × scaleX로 진행률이 이중 반영됨).
      // 단, prefers-reduced-motion 환경에서는 CSS 애니메이션이 꺼져 있으므로
      // JS 폴백이 동작해야 한다.
      var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var cssScrollProgress = !reduceMotion && !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));

      function onScroll() {
        var y = window.scrollY || docEl.scrollTop || 0;
        var max = docEl.scrollHeight - window.innerHeight;
        // 1) 진행률 바 (CSS 미지원 브라우저용 JS 폴백)
        if (progress && !cssScrollProgress) {
          var pct = max > 0 ? Math.min(100, Math.max(0, (y / max) * 100)) : 0;
          progress.style.width = pct + '%';
        }
        // 2) topbar 자동 숨김: 아래로 스크롤 시 숨기고 위로 올리면 표시
        if (topbar) {
          if (y > lastY + 6 && y > 90) topbar.classList.add('topbar-hidden');
          else if (y < lastY - 6 || y <= 90) topbar.classList.remove('topbar-hidden');
        }
        lastY = y;
      }
      window.addEventListener('scroll', function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(function () { ticking = false; onScroll(); });
        }
      }, { passive: true });
      onScroll();

      // 3) 이어읽기: 스크롤 위치를 localStorage에 저장 (debounce)
      var saveT = null;
      function savePos() {
        try {
          var y = window.scrollY || 0;
          var max = docEl.scrollHeight - window.innerHeight;
          if (max > 0 && y / max >= 0.98) localStorage.removeItem(SAVE_KEY); // 끝까지 읽음
          else localStorage.setItem(SAVE_KEY, String(Math.round(y)));
        } catch (e) {}
      }
      window.addEventListener('scroll', function () {
        if (saveT) clearTimeout(saveT);
        saveT = setTimeout(savePos, 400);
      }, { passive: true });
      window.addEventListener('pagehide', savePos);
      window.addEventListener('beforeunload', savePos);

      // 재방문 시 이어읽기 제안 — 해시 링크(#anchor)로 직접 진입한 경우는 제외
      try {
        var saved = parseInt(localStorage.getItem(SAVE_KEY) || '0', 10);
        var maxPos = docEl.scrollHeight - window.innerHeight;
        if (resumeBtn && saved > 300 && !location.hash && maxPos > 0) {
          resumeBtn.textContent = '↺ 이어읽기 ' + Math.round(saved / maxPos * 100) + '%';
          resumeBtn.classList.add('show');
          var hide = function () { resumeBtn.classList.remove('show'); };
          resumeBtn.addEventListener('click', function () {
            try { window.scrollTo({ top: saved, behavior: 'smooth' }); }
            catch (e) { window.scrollTo(0, saved); }
            hide();
          });
          // 수동 스크롤/터치/키 입력 시 제안 숨김 (프로그램 스크롤에는 반응 안 함)
          ['wheel', 'touchmove', 'keydown'].forEach(function (ev) {
            window.addEventListener(ev, hide, { once: true, passive: true });
          });
          setTimeout(hide, 12000);
        }
      } catch (e) {}
    });
  </script>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      var btnFold = document.getElementById('btnFold');

      function getFoldMinLinesDefault() {
        return %%COLLAPSE_MIN_LINES%%;
      }

      function getFoldMinLines() {
        try {
          var v = localStorage.getItem('doc_collapse_min_lines');
          if (v === null || v === undefined || v === '') return getFoldMinLinesDefault();
          var n = parseInt(v, 10);
          if (!isFinite(n) || n < 0) return getFoldMinLinesDefault();
          return n;
        } catch (e) {
          return getFoldMinLinesDefault();
        }
      }

      function setFoldMinLines(n) {
        try { localStorage.setItem('doc_collapse_min_lines', String(n)); } catch (e) {}
        if (btnFold) btnFold.textContent = (n <= 0) ? 'Fold: Off' : ('Fold: ' + n);
      }

      function isExpanded(codeId) {
        try { return localStorage.getItem('code_expanded_' + codeId) === '1'; } catch (e) { return false; }
      }

      function setExpanded(codeId, v) {
        try { localStorage.setItem('code_expanded_' + codeId, v ? '1' : '0'); } catch (e) {}
      }

      function getCodeText(pre) {
        var code = pre.querySelector('code');
        if (code) return code.textContent || '';
        return pre.textContent || '';
      }

      async function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return;
        }
        // Fallback: execCommand
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.left = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
      }

      var showToast = _showToast;

      function addCodeUX(pre) {
        if (!pre) return;
        // Mermaid blocks are rendered separately
        if (pre.classList.contains('mermaid') || pre.classList.contains('mermaid-fallback')) return;
        if (pre.dataset && pre.dataset.copyBound === '1') return;
        pre.dataset.copyBound = '1';

        var block = pre;
        try {
          var hl = pre.closest ? pre.closest('.highlight') : null;
          if (hl) block = hl;
        } catch (e) {}

        var wrapper = block.parentElement;
        if (!wrapper || !wrapper.classList || !wrapper.classList.contains('codewrap')) {
          wrapper = document.createElement('div');
          wrapper.className = 'codewrap';
          block.parentNode.insertBefore(wrapper, block);
          wrapper.appendChild(block);
        }

        // Stable id per page render (used for persistence)
        var codeId = '';
        try {
          if (!wrapper.dataset.codeId) wrapper.dataset.codeId = String(addCodeUX._idx++);
          codeId = wrapper.dataset.codeId;
        } catch (e) {
          codeId = String(addCodeUX._idx++);
        }

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'copy-btn';
        btn.textContent = 'Copy';
        btn.addEventListener('click', async function () {
          var text = getCodeText(pre);
          try {
            await copyText(text);
            showToast('Copied');
          } catch (e) {
            showToast('Copy failed');
          }
        });

        wrapper.appendChild(btn);

        // Language label
        try {
          var codeEl = pre.querySelector('code');
          if (codeEl) {
            var cls = codeEl.className || '';
            var m = cls.match(/language-(\S+)/);
            if (m && m[1]) {
              var lang = m[1].toLowerCase();
              if (lang !== 'text' && lang !== 'nohighlight') {
                var lbl = document.createElement('span');
                lbl.className = 'lang-label';
                lbl.textContent = lang;
                wrapper.appendChild(lbl);
              }
            }
          }
        } catch (e) {}

        // Collapse long code blocks
        function applyFold() {
          var minLines = getFoldMinLines();
          var text = getCodeText(pre);
          var lines = text.split(/\r?\n/);
          var count = lines.length;
          var shouldFold = (minLines > 0) && (count >= minLines);

          var exp = wrapper.querySelector('.expand-btn');
          if (!shouldFold) {
            wrapper.classList.remove('collapsed');
            if (exp && exp.parentNode) exp.parentNode.removeChild(exp);
            return;
          }

          if (!exp) {
            exp = document.createElement('button');
            exp.type = 'button';
            exp.className = 'expand-btn';
            exp.textContent = 'Expand';
            exp.addEventListener('click', function () {
              var isCollapsed = wrapper.classList.contains('collapsed');
              if (isCollapsed) {
                wrapper.classList.remove('collapsed');
                exp.textContent = 'Collapse';
                setExpanded(codeId, true);
              } else {
                wrapper.classList.add('collapsed');
                exp.textContent = 'Expand';
                setExpanded(codeId, false);
              }
            });
            wrapper.appendChild(exp);
          }

          // Restore persisted state
          if (isExpanded(codeId)) {
            wrapper.classList.remove('collapsed');
            exp.textContent = 'Collapse';
          } else {
            wrapper.classList.add('collapsed');
            exp.textContent = 'Expand';
          }
        }

        applyFold();
        wrapper._applyFold = applyFold;
      }

      addCodeUX._idx = 0;

      var pres = document.querySelectorAll('article pre');
      for (var i = 0; i < pres.length; i++) {
        addCodeUX(pres[i]);
      }

      function applyFoldAll() {
        try {
          var wraps = document.querySelectorAll('.codewrap');
          for (var i = 0; i < wraps.length; i++) {
            var w = wraps[i];
            if (w && w._applyFold) w._applyFold();
          }
        } catch (e) {}
      }

      // Fold button behavior
      if (btnFold) {
        var cur = getFoldMinLines();
        setFoldMinLines(cur);
        btnFold.addEventListener('click', function () {
          var steps = [0, 20, 35, 60];
          var v = getFoldMinLines();
          var idx = 0;
          for (var i = 0; i < steps.length; i++) {
            if (steps[i] === v) { idx = i; break; }
          }
          var next = steps[(idx + 1) % steps.length];
          setFoldMinLines(next);
          applyFoldAll();
        });
      }
    });
  </script>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      function enhanceToc(tocId, storageKey) {
        var toc = document.getElementById(tocId);
        if (!toc) return;

        var links = toc.querySelectorAll('a[href^="#"]');
        if (!links || links.length === 0) return;

        // Build sections based on heading level inferred from href targets.
        // python-markdown TOC renders nested <ul>, but link ordering is still linear.
        var items = [];
        for (var i = 0; i < links.length; i++) items.push(links[i]);

        // Determine level via closest LI nesting depth, fallback to text indent.
        function levelOf(a) {
          var li = a.closest('li');
          var lvl = 1;
          while (li) {
            var parentUl = li.parentElement;
            if (!parentUl || parentUl.tagName !== 'UL') break;
            var parentLi = parentUl.closest('li');
            if (!parentLi) break;
            lvl += 1;
            li = parentLi;
          }
          // toc_depth starts at 2-4, so treat lvl==1 as H2.
          return lvl;
        }

        var root = document.createElement('div');
        var currentSection = null;
        var sectionIdx = -1;

        // load collapsed state
        var collapsed = {};
        try {
          var raw = localStorage.getItem(storageKey);
          if (raw) collapsed = JSON.parse(raw) || {};
        } catch (e) {}

        function save() {
          try { localStorage.setItem(storageKey, JSON.stringify(collapsed)); } catch (e) {}
        }

        for (var k = 0; k < items.length; k++) {
          var a = items[k];
          var lvl = levelOf(a);

          if (lvl === 1) {
            sectionIdx += 1;
            currentSection = document.createElement('div');
            currentSection.className = 'toc-section';
            currentSection.dataset.sectionIndex = String(sectionIdx);

            var header = document.createElement('div');
            header.className = 'toc-section-header';

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toc-toggle';
            btn.textContent = (collapsed[sectionIdx] ? '▸' : '▾');

            var children = document.createElement('div');
            children.className = 'toc-children';

            if (collapsed[sectionIdx]) currentSection.classList.add('toc-collapsed');

            btn.addEventListener('click', function (ev) {
              var sec = ev.currentTarget._sec;
              var idx = Number(sec.dataset.sectionIndex);
              var isCollapsed = sec.classList.contains('toc-collapsed');
              if (isCollapsed) {
                sec.classList.remove('toc-collapsed');
                collapsed[idx] = false;
                ev.currentTarget.textContent = '▾';
              } else {
                sec.classList.add('toc-collapsed');
                collapsed[idx] = true;
                ev.currentTarget.textContent = '▸';
              }
              save();
            });
            btn._sec = currentSection;

            header.appendChild(btn);
            header.appendChild(a.cloneNode(true));
            currentSection.appendChild(header);
            currentSection.appendChild(children);
            root.appendChild(currentSection);
          } else {
            if (!currentSection) {
              // No H2 encountered yet; create a dummy section.
              currentSection = document.createElement('div');
              currentSection.className = 'toc-section';
              currentSection.dataset.sectionIndex = '0';
              var children0 = document.createElement('div');
              children0.className = 'toc-children';
              currentSection.appendChild(children0);
              root.appendChild(currentSection);
            }
            var ch = currentSection.querySelector('.toc-children');
            var itemWrap = document.createElement('div');
            // visually indent: lvl 2->H3, lvl3->H4
            itemWrap.style.marginLeft = (lvl === 2 ? '0.25rem' : '1.0rem');
            itemWrap.appendChild(a.cloneNode(true));
            ch.appendChild(itemWrap);
          }
        }

        // replace content
        toc.innerHTML = '';
        toc.appendChild(root);
      }

      enhanceToc('toc', 'toc_collapsed_desktop');
      enhanceToc('tocMobile', 'toc_collapsed_mobile');
    });
  </script>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      // Tag ASCII/box-drawing diagrams so we can apply a stricter font stack.
      (function () {
        try {
          var boxRe = /[┌┐└┘├┤┬┴┼│─═╔╗╚╝╠╣╦╩╬┃━]/;
          var pres = document.querySelectorAll('article pre, .highlight pre');
          for (var i = 0; i < pres.length; i++) {
            var pre = pres[i];
            var text = (pre.textContent || '');
            if (boxRe.test(text)) {
              pre.classList.add('ascii-diagram');
              var code = pre.querySelector('code');
              if (code) code.classList.add('ascii-diagram');
            }
          }
        } catch (e) {}
      })();

      function attachSearch(inputId, tocId) {
        var input = document.getElementById(inputId);
        var toc = document.getElementById(tocId);
        if (!input || !toc) return;

        var isSyncing = false;
        function syncSearchValue(v) {
          if (isSyncing) return;
          isSyncing = true;
          try {
            var otherId = (inputId === 'tocSearch') ? 'tocSearchMobile' : 'tocSearch';
            var other = document.getElementById(otherId);
            if (other && other.value !== v) {
              other.value = v;
            }
          } catch (e) {}
          isSyncing = false;
        }

        function escapeHtml(s) {
          return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function escapeRegex(s) {
          return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function normalize(s) {
          return String(s || '').toLowerCase().trim();
        }

        function apply() {
          var q = normalize(input.value);
          syncSearchValue(input.value);
          var links = toc.querySelectorAll('a[href^="#"]');
          for (var i = 0; i < links.length; i++) {
            var a = links[i];
            if (!a.dataset.origText) {
              a.dataset.origText = a.textContent || '';
            }
            var orig = a.dataset.origText;
            var text = normalize(orig);
            var match = (!q || text.indexOf(q) >= 0);
            a.style.display = match ? '' : 'none';

            if (!q) {
              a.innerHTML = escapeHtml(orig);
            } else if (match) {
              var re = new RegExp('(' + escapeRegex(q) + ')', 'ig');
              a.innerHTML = escapeHtml(orig).replace(re, '<mark class="toc-mark">$1</mark>');
            }
          }

          // When searching, expand all sections so matches are visible.
          try {
            var sections = toc.querySelectorAll('.toc-section');
            for (var j = 0; j < sections.length; j++) {
              if (q) sections[j].classList.remove('toc-collapsed');
            }
          } catch (e) {}
        }

        input.addEventListener('input', apply);
        apply();
      }

      attachSearch('tocSearch', 'toc');
      attachSearch('tocSearchMobile', 'tocMobile');
    });
  </script>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      var toc = document.getElementById('toc');
      var tocMobile = document.getElementById('tocMobile');
      if (!toc && !tocMobile) return;

      var getAutoFold = _getAutoFold;

      function collectLinks(container) {
        if (!container) return [];
        var list = container.querySelectorAll('a[href^="#"]');
        return list ? Array.prototype.slice.call(list) : [];
      }

      var tocLinks = collectLinks(toc);
      var tocLinksMobile = collectLinks(tocMobile);
      var allLinks = tocLinks.concat(tocLinksMobile);
      if (!allLinks || allLinks.length === 0) return;

      var linkById = {};
      for (var i = 0; i < allLinks.length; i++) {
        var href = allLinks[i].getAttribute('href') || '';
        if (href.charAt(0) === '#') {
          var id = href.slice(1);
          if (!linkById[id]) linkById[id] = [];
          linkById[id].push(allLinks[i]);
        }
      }

      var headings = document.querySelectorAll('article h1, article h2, article h3, article h4');
      if (!headings || headings.length === 0) return;

      function setActive(id) {
        for (var j = 0; j < allLinks.length; j++) {
          allLinks[j].classList.remove('toc-active');
        }
        var arr = linkById[id];
        if (arr && arr.length) {
          for (var x = 0; x < arr.length; x++) {
            arr[x].classList.add('toc-active');
            try {
              var sec = arr[x].closest('.toc-section');
              if (sec) sec.classList.remove('toc-collapsed');
            } catch (e) {}
          }

          // Auto-collapse non-active sections (only if not searching)
          try {
            var q1 = '';
            var q2 = '';
            var s1 = document.getElementById('tocSearch');
            var s2 = document.getElementById('tocSearchMobile');
            if (s1) q1 = String(s1.value || '').trim();
            if (s2) q2 = String(s2.value || '').trim();
            var isSearching = (q1.length > 0) || (q2.length > 0);

            if (getAutoFold() && !isSearching) {
              function collapseOthers(container, activeLink) {
                if (!container || !activeLink) return;
                var activeSec = activeLink.closest('.toc-section');
                var secs = container.querySelectorAll('.toc-section');
                for (var i = 0; i < secs.length; i++) {
                  if (secs[i] === activeSec) secs[i].classList.remove('toc-collapsed');
                  else secs[i].classList.add('toc-collapsed');
                }
              }

              collapseOthers(toc, arr[0]);
              if (tocMobile && arr.length > 1) {
                collapseOthers(tocMobile, arr[arr.length - 1]);
              } else {
                collapseOthers(tocMobile, arr[0]);
              }
            }
          } catch (e) {}

          // 활성 링크를 각자 속한 TOC nav의 중앙으로 스크롤 (데스크톱/모바일 양쪽)
          try {
            for (var x2 = 0; x2 < arr.length; x2++) {
              var a2 = arr[x2];
              var nav = a2.closest ? a2.closest('nav') : null;
              if (nav) {
                var top = a2.offsetTop - nav.clientHeight / 2;
                if (top < 0) top = 0;
                nav.scrollTop = top;
              }
            }
          } catch (e) {}
        }
      }

      var currentId = '';

      if (typeof IntersectionObserver !== 'undefined') {
        var observer = new IntersectionObserver(function (entries) {
          var best = null;
          for (var k = 0; k < entries.length; k++) {
            var ent = entries[k];
            if (ent.isIntersecting) {
              if (!best || ent.intersectionRatio > best.intersectionRatio) {
                best = ent;
              }
            }
          }
          if (best && best.target && best.target.id && best.target.id !== currentId) {
            currentId = best.target.id;
            setActive(currentId);
          }
        }, { rootMargin: '-20% 0px -70% 0px', threshold: [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1] });

        for (var h = 0; h < headings.length; h++) {
          if (headings[h].id) observer.observe(headings[h]);
        }
      } else {
        function onScroll() {
          var bestId = '';
          var bestTop = -Infinity;
          for (var h2 = 0; h2 < headings.length; h2++) {
            var el = headings[h2];
            if (!el.id) continue;
            var rect = el.getBoundingClientRect();
            if (rect.top <= 120 && rect.top > bestTop) {
              bestTop = rect.top;
              bestId = el.id;
            }
          }
          if (bestId && bestId !== currentId) {
            currentId = bestId;
            setActive(currentId);
          }
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }

      if (location.hash && location.hash.length > 1) {
        var initId = location.hash.slice(1);
        if (linkById[initId]) {
          currentId = initId;
          setActive(currentId);
        }
      }

      // 모바일 드로어가 열릴 때 현재 읽는 섹션으로 목차 스크롤
      var tocSwitchEl = document.getElementById('tocSwitch');
      if (tocSwitchEl) {
        tocSwitchEl.addEventListener('change', function () {
          if (tocSwitchEl.checked && currentId) setActive(currentId);
        });
      }
    });
  </script>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      // A-1: Back to Top button
      var btnTop = document.getElementById('btnBackToTop');
      if (btnTop) {
        window.addEventListener('scroll', function () {
          if (window.scrollY > 200) {
            btnTop.style.display = 'flex';
          } else {
            btnTop.style.display = 'none';
          }
        }, { passive: true });
        btnTop.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }

      // A-2: Lightbox for images
      var lightbox = document.getElementById('lightbox');
      var lightboxImg = document.getElementById('lightboxImg');
      if (lightbox && lightboxImg) {
        document.querySelectorAll('article img').forEach(function (img) {
          img.addEventListener('click', function () {
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt || '';
            lightbox.style.display = 'flex';
          });
        });
        lightbox.addEventListener('click', function () {
          lightbox.style.display = 'none';
          lightboxImg.src = '';
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && lightbox.style.display === 'flex') {
            lightbox.style.display = 'none';
            lightboxImg.src = '';
          }
        });
      }

      // A-3: TOC progress indicator
      (function () {
        var toc = document.getElementById('toc');
        var tocMobile = document.getElementById('tocMobile');
        if (!toc && !tocMobile) return;

        var headings = document.querySelectorAll('article h2, article h3, article h4');
        var total = headings.length;
        if (total === 0) return;

        function addProgress(container) {
          if (!container) return null;
          var el = document.createElement('div');
          el.className = 'toc-progress';
          el.textContent = '0 / ' + total;
          container.parentNode.insertBefore(el, container);
          return el;
        }

        var progEl = addProgress(toc);
        var progElMobile = addProgress(tocMobile);

        function updateProgress() {
          var idx = 0;
          for (var i = 0; i < headings.length; i++) {
            var rect = headings[i].getBoundingClientRect();
            if (rect.top <= 150) idx = i + 1;
          }
          var text = idx + ' / ' + total;
          if (progEl) progEl.textContent = text;
          if (progElMobile) progElMobile.textContent = text;
        }

        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();
      })();

      // A-4: Code block double-click to select all
      document.querySelectorAll('article pre, .highlight pre').forEach(function (pre) {
        pre.addEventListener('dblclick', function (e) {
          // Don't interfere with button clicks
          if (e.target.closest('button')) return;
          try {
            var sel = window.getSelection();
            var range = document.createRange();
            var code = pre.querySelector('code') || pre;
            range.selectNodeContents(code);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (err) {}
        });
      });
    });
  </script>
</body>
</html>
"""


def _auto_fence_ascii_diagrams(md_text: str) -> str:
    box_chars = BOX_CHARS
    lines = md_text.splitlines()
    out: list[str] = []

    def is_diagram_line(s: str) -> bool:
        if not s.strip():
            return False
        hit = any(ch in box_chars for ch in s)
        if not hit:
            return False
        # Avoid wrapping mermaid fenced blocks or already fenced code
        return True

    i = 0
    in_fence = False
    while i < len(lines):
        line = lines[i]
        stripped = line.lstrip()

        if stripped.startswith("```"):
            # NOTE: Fence detection is intentionally simple.
            # - Only supports triple-backtick fences (not ~~~)
            # - Does not attempt to handle nested/imbalanced fences inside fenced blocks
            in_fence = not in_fence
            out.append(line)
            i += 1
            continue

        if in_fence:
            out.append(line)
            i += 1
            continue

        if is_diagram_line(line):
            start = i
            j = i
            while j < len(lines):
                if is_diagram_line(lines[j]) or lines[j].strip() == "":
                    j += 1
                    continue
                break

            block = lines[start:j]
            while block and block[0].strip() == "":
                block.pop(0)
            while block and block[-1].strip() == "":
                block.pop()

            # Require at least 2 non-empty lines with box chars to avoid
            # false positives on single occurrences like "│" in prose.
            diagram_line_count = sum(1 for b in block if any(ch in box_chars for ch in b))
            if diagram_line_count >= 2:
                out.append("```text")
                out.extend(block)
                out.append("```")
            else:
                out.extend(block)
            i = j
            continue

        out.append(line)
        i += 1

    return "\n".join(out) + ("\n" if md_text.endswith("\n") else "")


def _inline_mermaid_fences(md_text: str) -> str:
    """Convert ```mermaid fences into raw HTML blocks before markdown conversion.

    This prevents codehilite/pygments from tokenizing mermaid source (which can
    destroy whitespace and make it impossible to reconstitute the original diagram).
    """

    # Keep it simple: only support triple-backtick fences.
    lines = md_text.splitlines()
    out: list[str] = []
    i = 0
    in_mermaid = False
    buf: list[str] = []

    # Replace unsafe label text inside node definitions to avoid mermaid grammar conflicts.
    # Examples we need to handle (from mermaid.md):
    #   EL[ebest_live.py\nrun_...\n(orchestrator)]
    #   tee[tee (--tee/--no-tee)]
    #   B[Unpack tick_norm depth -> raw keys (best-effort)]
    # Match at token boundaries only (avoid rewriting inside already-quoted labels).
    # FIX: 레이블이 이미 "..." 또는 '...' 로 감싸인 경우(예: ID["label"])를
    # 다시 처리하지 않도록 lookahead로 제외한다.
    # 패턴: ID[ 다음이 " 또는 ' 로 시작하면 이미 따옴표 처리 완료 → 스킵.
    node_pat_sq  = re.compile(r'(?P<prefix>^|[^A-Za-z0-9_"\'])'
                               r'(?P<id>[A-Za-z_][A-Za-z0-9_]*)'
                               r'\[(?!["\'])(?P<label>[^\]]*?)\]')
    node_pat_par = re.compile(r'(?P<prefix>^|[^A-Za-z0-9_"\'])'
                               r'(?P<id>[A-Za-z_][A-Za-z0-9_]*)'
                               r'\((?!["\'])(?P<label>[^\)]*?)\)')
    node_pat_cur = re.compile(r'(?P<prefix>^|[^A-Za-z0-9_"\'])'
                               r'(?P<id>[A-Za-z_][A-Za-z0-9_]*)'
                               r'\{(?!["\'])(?P<label>[^\}]*?)\}')

    def _sanitize_label(label: str) -> str:
        s = label
        # \n → <br/>
        s = s.replace("\\n", "<br/>")
        s = s.replace("->", "→")
        # " → ' (레이블이 ["label"] 큰따옴표로 감싸이므로 내부 " 는 ' 로)
        s = s.replace('"', "'")
        # -- → — (mermaid 링크 구문과 충돌 방지)
        s = s.replace("--", "—")
        # [ ] → 유니코드 전각 대괄호 ［ ］ (U+FF3B, U+FF3D)
        # &#91;/&#93; HTML 엔티티는 safe_src.replace("&","&amp;") 에 의해
        # &amp;#91; 로 이중인코딩되어 브라우저가 &#91; 리터럴로 표시하므로 사용 금지.
        # 유니코드 전각 대괄호는 인코딩 문제 없이 mermaid 레이블에 안전하게 표시됨.
        s = s.replace("]", "］")
        s = s.replace("[", "［")
        return s

    def sanitize_mermaid_line(line: str) -> str:
        # Mermaid does not reliably support "\\n" escapes inside labels; use <br/>.
        line = line.replace("\\n", "<br/>")

        # Sanitize edge labels written as |label| (flowchart links)
        # FIX: |"label"| 형태(이미 큰따옴표로 감싸진 엣지 레이블)는 그대로 유지.
        # |label| 형태(따옴표 없는 것)만 _sanitize_label 처리.
        # 이유: _sanitize_label의 " → ' 변환이 |"label"| → |'label'| 로 만들어
        # mermaid 파서가 ' 를 구분자로 오해하여 파싱 오류 발생.
        def _edge_label_repl(m: re.Match) -> str:
            inner = m.group(1)
            # 이미 큰따옴표로 감싸진 경우: |"label"| → 그대로 유지
            if inner.startswith('"') and inner.endswith('"'):
                return f"|{inner}|"
            # 따옴표 없는 경우만 sanitize
            sanitized = _sanitize_label(inner)
            # ( ) 는 Mermaid 렉서가 PS(stadium) 토큰으로 오해석 → 전각 괄호로 교체
            sanitized = sanitized.replace("(", "（").replace(")", "）")
            return "|" + sanitized + "|"

        line = re.sub(r"\|([^|]+)\|", _edge_label_repl, line)

        # quadrantChart 전용: title/x-axis/y-axis/quadrant-N 라인 처리.
        # ★ diagram_type 체크 필수 — xychart-beta 등 다른 다이어그램의
        #   x-axis/y-axis 문법은 완전히 달라 이 처리를 적용하면 파싱 오류 발생.
        _s_stripped = line.lstrip()
        _indent_qc  = line[: len(line) - len(_s_stripped)]
        _cur_diagram_type = getattr(sanitize_mermaid_line, '_diagram_type', '')

        if _cur_diagram_type == 'quadrantChart':
            # title: 그대로 유지 (lexer가 [^\n]* 로 읽어 한글 OK)
            if _s_stripped.startswith('title '):
                return line

            # x-axis / y-axis: 각 라벨을 따옴표로 감싸기
            # quadrantChart x-axis 문법: X_AXIS STR --> STR | X_AXIS STR
            for _kw in ('x-axis', 'y-axis'):
                if _s_stripped.startswith(_kw):
                    _rest = _s_stripped[len(_kw):].strip()
                    if '-->' in _rest:
                        _left, _right = _rest.split('-->', 1)
                        _left  = _left.strip().strip('"').strip("'")
                        _right = _right.strip().strip('"').strip("'")
                        return f'{_indent_qc}{_kw} "{_left}" --> "{_right}"'
                    else:
                        _label = _rest.strip().strip('"').strip("'")
                        return f'{_indent_qc}{_kw} "{_label}"' if _label else line

            # quadrant-N: 라벨을 따옴표로 감싸기
            _qn_m = re.match(r'(quadrant-[1-4])\s+(.*)', _s_stripped)
            if _qn_m:
                _qn   = _qn_m.group(1)
                _qlbl = _qn_m.group(2).strip().strip('"').strip("'")
                return f'{_indent_qc}{_qn} "{_qlbl}"'

        # Special-case subgraph headers: keep syntax but quote the label if it uses bracket label forms.
        s = line.lstrip()
        if s.startswith("subgraph "):
            # 이미 큰따옴표로 감싸진 레이블 subgraph ID["label"] 은 그대로 유지 (재처리 금지)
            if re.match(r'^\s*subgraph\s+[A-Za-z_][A-Za-z0-9_]*\["', line):
                return line
            # 따옴표 없는 레이블을 큰따옴표로 감싸기
            m_sq = re.match(r"^(\s*)subgraph\s+([A-Za-z_][A-Za-z0-9_]*)\[([^\"'].*)\]\s*$", line)
            if m_sq:
                indent, sid, label = m_sq.groups()
                return f'{indent}subgraph {sid}["{_sanitize_label(label)}"]'
            m_par = re.match(r"^(\s*)subgraph\s+([A-Za-z_][A-Za-z0-9_]*)\(([^\"'].*)\)\s*$", line)
            if m_par:
                indent, sid, label = m_par.groups()
                return f'{indent}subgraph {sid}["{_sanitize_label(label)}"]'
            m_cur = re.match(r"^(\s*)subgraph\s+([A-Za-z_][A-Za-z0-9_]*)\{([^\"'].*)\}\s*$", line)
            if m_cur:
                indent, sid, label = m_cur.groups()
                return f'{indent}subgraph {sid}["{_sanitize_label(label)}"]'
            return line

        def repl_sq(m: re.Match) -> str:
            prefix = m.group('prefix')
            node_id = m.group('id')
            label = _sanitize_label(m.group('label'))
            return f"{prefix}{node_id}[\"{label}\"]"

        def repl_par(m: re.Match) -> str:
            prefix = m.group('prefix')
            node_id = m.group('id')
            label = _sanitize_label(m.group('label'))
            return f"{prefix}{node_id}(\"{label}\")"

        def repl_cur(m: re.Match) -> str:
            prefix = m.group('prefix')
            node_id = m.group('id')
            label = _sanitize_label(m.group('label'))
            return f"{prefix}{node_id}{{\"{label}\"}}"

        # flowchart 노드 문법(id[label], id(label), id{label})을 쓰지 않는
        # 다이어그램 타입은 node_pat 치환을 완전히 건너뜀.
        #
        # sequenceDiagram : E->>D: text 메시지가 node_pat_par 에 오매칭됨
        # xychart-beta    : x-axis/y-axis 배열 구문 충돌
        # quadrantChart   : x-axis/y-axis/title 특수 문법
        # timeline        : 'generate()' 같은 텍스트가 generate("") 로 오변환됨
        # gantt           : 태스크 이름이 node_pat 과 우연히 매칭될 수 있음
        # mindmap         : 들여쓰기 트리 구조, 노드 문법 없음
        # sankey-beta     : CSV 형식, 노드 문법 없음
        # block-beta / packet-beta / architecture-beta : 별도 문법
        skip_node_pat = getattr(sanitize_mermaid_line, '_diagram_type', '') in (
            'sequenceDiagram', 'xychart-beta', 'quadrantChart',
            'timeline', 'gantt', 'mindmap', 'sankey-beta',
            'block-beta', 'packet-beta', 'architecture-beta',
            'classDiagram',   # 메서드 시그니처 id(params)가 flowchart node_pat에 오매칭됨
        )
        if not skip_node_pat:
            # ★ BUG FIX: node_pat_par/cur 는 ["..."] 내부까지 재처리한다.
            # 예: G["분류 헤드 Linear(64→32)"] → Linear(64→32) 를 별개 노드로 오인해
            #     G["분류 헤드 Linear('64→32')"] 로 변환 → Mermaid parse failed.
            #
            # 해결: 이미 ["..."] 로 감싸진 구간을 플레이스홀더로 보호 후 node_pat 적용,
            #       이후 원래 텍스트로 복원한다.
            _ph_map: dict[str, str] = {}
            _ph_counter = [0]

            def _protect_quoted_label(m: re.Match) -> str:
                key = f"\x00PH{_ph_counter[0]}\x00"
                _ph_map[key] = m.group(0)
                _ph_counter[0] += 1
                return key

            # ["..."] 구간 보호 (내부에 "] 가 없는 단순 구간만 대상)
            protected = re.sub(r'\["[^"]*?"\]', _protect_quoted_label, line)

            protected = node_pat_sq.sub(repl_sq, protected)
            protected = node_pat_par.sub(repl_par, protected)
            protected = node_pat_cur.sub(repl_cur, protected)

            # 플레이스홀더 복원
            for key, val in _ph_map.items():
                protected = protected.replace(key, val)

            line = protected
        return line

    while i < len(lines):
        line = lines[i]
        if not in_mermaid:
            # Accept ```mermaid with trailing spaces and any casing.
            if re.match(r"^```\s*mermaid\s*$", line.strip(), flags=re.IGNORECASE):
                in_mermaid = True
                buf = []
                raw_buf = []   # 원본 라인 보존 (fallback용)
                sanitize_mermaid_line._diagram_type = ''  # 블록 시작 시 초기화
                i += 1
                continue
            out.append(line)
            i += 1
            continue

        # in mermaid fence
        if line.strip() == "```":
            _diagram_type = getattr(sanitize_mermaid_line, '_diagram_type', '')
            _is_quadrant  = (_diagram_type == 'quadrantChart')

            # sanitize_mermaid_line 이 '' 를 반환한 라인 제거
            src = "\n".join(ln for ln in buf if ln != '')
            safe_src = html.escape(src, quote=False)
            # 후처리: 이미 ["label"] 로 감싸인 노드 레이블 내부의 " 를 ' 로 교체.
            # node_pat_sq lookahead 가 건너뛴 케이스 대응.
            # xychart x-axis/y-axis 배열 형태 ["a","b","c"] 는 제외.
            # 탐욕적 매칭(.*?)으로 ["...최초..."] 전체를 캡처한다.
            def _fix_inner_quotes(line: str) -> str:
                stripped = line.lstrip()
                # quadrantChart 의 x-axis/y-axis/quadrant-N/title 라인:
                # sanitize_mermaid_line 에서 따옴표 배치 완료 → 재처리 금지.
                if _is_quadrant and (
                        stripped.startswith('x-axis') or
                        stripped.startswith('y-axis') or
                        stripped.startswith('title ') or
                        re.match(r'quadrant-[1-4]\b', stripped)):
                    return line
                # xychart x-axis/y-axis: ["a","b","c"] 배열 구문 보호.
                # _fix_inner_quotes 가 배열 내부 " → ' 로 바꾸면 파싱 실패.
                if stripped.startswith('x-axis') or stripped.startswith('y-axis'):
                    return line
                # ["..."] 패턴을 탐욕적으로 찾아 내부 " → '
                # 단, --> |"label"| 엣지 레이블의 경우도 보호 필요
                result = []
                pos = 0
                while pos < len(line):
                    # [" 시작 탐색
                    open_idx = line.find('["', pos)
                    if open_idx == -1:
                        result.append(line[pos:])
                        break
                    result.append(line[pos:open_idx + 2])  # [" 포함
                    inner_start = open_idx + 2
                    # "] 종료 탐색 — 가장 마지막 "] 사용 (탐욕적)
                    close_idx = line.find('"]', inner_start)
                    if close_idx == -1:
                        result.append(line[inner_start:])
                        break
                    inner = line[inner_start:close_idx]
                    # 내부 " → ' (단, HTML 엔티티 &quot; 는 보호)
                    inner = inner.replace('"', "'")
                    inner = inner.replace('<', '&lt;')
                    result.append(inner + '"]')
                    pos = close_idx + 2
                return ''.join(result)

            safe_src = '\n'.join(_fix_inner_quotes(fl) for fl in safe_src.split('\n'))
            out.append(f"<div class=\"mermaid\">{safe_src}</div>")
            in_mermaid = False
            buf = []
            i += 1
            continue

        # 첫 번째 라인(다이어그램 타입 선언)을 감지해 node_pat 스킵 여부 결정.
        # e.g. "sequenceDiagram", "xychart-beta", "quadrantChart" 등.
        stripped_line = line.strip()
        if not buf:  # 블록의 첫 번째 라인
            diagram_type = stripped_line.split()[0] if stripped_line else ''
            sanitize_mermaid_line._diagram_type = diagram_type
        raw_buf.append(line)
        buf.append(sanitize_mermaid_line(line))
        i += 1

    # Unterminated fence: fall back to original text
    if in_mermaid:
        out.append("```mermaid")
        out.extend(buf)

    return "\n".join(out) + ("\n" if md_text.endswith("\n") else "")


def _normalize_diagram_codeblocks(md_text: str) -> str:
    """Normalize whitespace/unicode inside box-drawing diagram code blocks.

    This targets cases where the MD itself looks misaligned due to tabs,
    non-breaking spaces, or full-width spaces inside the diagram.
    """

    box_chars = BOX_CHARS
    lines = md_text.splitlines()
    out: list[str] = []

    i = 0
    in_fence = False
    fence_lang = ""
    fence_has_box = False

    def normalize_line(s: str) -> str:
        s = unicodedata.normalize("NFKC", s)
        s = s.replace("\t", "    ")
        s = s.replace("\u00a0", " ")
        s = s.replace("\u3000", "  ")
        return s

    while i < len(lines):
        line = lines[i]
        stripped = line.lstrip()

        if stripped.startswith("```"):
            if not in_fence:
                in_fence = True
                fence_lang = stripped[3:].strip().lower()
                fence_has_box = False
                out.append(line)
            else:
                in_fence = False
                fence_lang = ""
                fence_has_box = False
                out.append(line)
            i += 1
            continue

        if in_fence:
            if any(ch in box_chars for ch in line):
                fence_has_box = True
            # Only normalize if this looks like a diagram fence.
            if fence_lang in ("", "text") or fence_has_box:
                out.append(normalize_line(line))
            else:
                out.append(line)
            i += 1
            continue

        out.append(line)
        i += 1

    return "\n".join(out) + ("\n" if md_text.endswith("\n") else "")


def _tag_fenced_diagram_blocks_as_text(md_text: str) -> str:
    """If a fenced code block has no language and contains box-drawing chars,
    tag it as ```text to avoid unwanted syntax highlighting and font fallback."""

    box_chars = BOX_CHARS
    lines = md_text.splitlines()
    out: list[str] = []

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.lstrip()

        if stripped.startswith("```"):
            fence = stripped
            lang = fence[3:].strip()
            if lang:
                out.append(line)
                i += 1
                continue

            # No language specified: look ahead until closing fence
            j = i + 1
            has_box = False
            while j < len(lines):
                if lines[j].lstrip().startswith("```"):
                    break
                if any(ch in box_chars for ch in lines[j]):
                    has_box = True
                j += 1

            if has_box:
                # Preserve original indentation
                prefix = line[: len(line) - len(stripped)]
                out.append(prefix + "```text")
            else:
                out.append(line)

            i += 1
            continue

        out.append(line)
        i += 1

    return "\n".join(out) + ("\n" if md_text.endswith("\n") else "")


def _prerender_mermaid_to_svg(html_body: str, progress_cb=None) -> str:
    """Replace all <div class="mermaid">...</div> with inline SVG from mermaid.ink.

    Uses the mermaid.ink render API to pre-render diagrams at build time.
    Falls back to the original div (for client-side rendering) if the API fails.
    progress_cb(current, total, status) is called for each diagram if provided.
    """
    pattern = re.compile(r'<div class="mermaid">([\s\S]*?)</div>', re.IGNORECASE)
    matches = list(pattern.finditer(html_body))
    total = len(matches)
    if total == 0:
        return html_body

    # 진행 표시용 라벨 (다이어그램 소스 첫 줄)
    labels = [html.unescape(m.group(1)).strip().split('\n')[0][:60] for m in matches]

    def _render_one(m: re.Match) -> str:
        src = html.unescape(m.group(1)).strip()
        if not src:
            return m.group(0)

        # 메인 웹앱(src/mermaid-utils.js)과 동일한 전략:
        # mindmap은 항상 'default' 테마로 렌더링 (밝은 파스텔 배경 + 어두운 텍스트).
        # dark 테마는 노드 배경이 어두워져 텍스트 대비가 급격히 저하됨.
        # flowchart 등 다른 타입도 동일하게 default로 렌더링하여
        # 다크 페이지 위에서 "밝은 카드"처럼 표시.
        # 모든 다이어그램을 default 테마로 렌더링
        encoded = base64.urlsafe_b64encode(src.encode("utf-8")).decode("ascii")
        url = f"https://mermaid.ink/svg/{encoded}?theme=default&bgColor=ffffff"

        svg = None
        for _attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    svg = resp.read().decode("utf-8", errors="replace")
                if svg and svg.strip().startswith("<svg") and "</svg>" in svg:
                    # SVG에서 악의적 요소 제거 (XSS 방어)
                    svg = re.sub(r"<script[\s\S]*?</script>", "", svg, flags=re.IGNORECASE)
                    svg = re.sub(r'\son\w+\s*=\s*"[^"]*"', "", svg)
                    svg = re.sub(r"\son\w+\s*=\s*'[^']*'", "", svg)
                    break
                svg = None
            except Exception as e:
                if _attempt < 2:
                    time.sleep(1.5 * (_attempt + 1))  # 503 레이트리밋 대비 백오프
                    continue
                try:
                    print(f"[Mermaid pre-render failed] {e}", file=sys.stderr)
                except Exception:
                    pass
                break

        if svg:
            # SVG를 <img> 태그로 인라인 임베드하여 외부 CSS의 영향을
            # 완전히 차단. data: URI로 인라인 SVG를 사용하면 다크/라이트
            # 모드 전환과 무관하게 SVG 자체 색상이 유지됨.
            svg_b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
            return (
                f'<div class="mermaid-img">'
                f'<img src="data:image/svg+xml;base64,{svg_b64}"'
                f' alt="Mermaid diagram" />'
                f"</div>"
            )

        # Fallback: keep original div for client-side rendering
        return m.group(0)

    # 다이어그램 렌더링은 네트워크 바운드이므로 병렬 처리한다.
    # 결과는 원래 순서대로 재조립하고, progress_cb는 이 스레드에서만 호출한다.
    replacements: list[str] = [m.group(0) for m in matches]
    with ThreadPoolExecutor(max_workers=4) as pool:
        fut_map = {pool.submit(_render_one, m): i for i, m in enumerate(matches)}
        done = 0
        for fut in as_completed(fut_map):
            i = fut_map[fut]
            try:
                replacements[i] = fut.result()
            except Exception:
                replacements[i] = matches[i].group(0)
            done += 1
            if progress_cb:
                try:
                    progress_cb(done, total, labels[i])
                except Exception:
                    pass

    result = []
    last_end = 0
    for idx, m in enumerate(matches):
        result.append(html_body[last_end:m.start()])
        result.append(replacements[idx])
        last_end = m.end()
    result.append(html_body[last_end:])

    if progress_cb:
        try:
            progress_cb(total, total, "done")
        except Exception:
            pass

    return "".join(result)


def markdown_to_tailwind_html(md_text: str, title: str = "Document", config: RenderConfig | None = None, progress_cb=None) -> str:
    config = config or RenderConfig()
    md_text = _auto_fence_ascii_diagrams(md_text)
    md_text = _tag_fenced_diagram_blocks_as_text(md_text)
    md_text = _normalize_diagram_codeblocks(md_text)
    md_text = _inline_mermaid_fences(md_text)
    md = markdown.Markdown(
        extensions=[
            "fenced_code",
            "tables",
            "toc",
            "codehilite",
            "admonition",
            "attr_list",
            "md_in_html",
        ],
        extension_configs={
            "codehilite": {
                "css_class": "highlight",
                "linenums": False,
            },
            "toc": {
                "permalink": True,
                "toc_depth": "2-4",
            },
        },
    )

    html_body = md.convert(md_text)
    toc_html = getattr(md, "toc", "") or ""

    # Convert ```mermaid blocks rendered by markdown/codehilite into <div class="mermaid">...</div>
    # Typical output: <pre><code class="language-mermaid">...</code></pre>
    def _mermaid_repl(m: re.Match) -> str:
        inner = m.group(1)
        src = html.unescape(inner)
        return f"<div class=\"mermaid\">{src}</div>"

    html_body = re.sub(
        r"<pre><code class=\"language-mermaid\">([\s\S]*?)</code></pre>",
        _mermaid_repl,
        html_body,
        flags=re.IGNORECASE,
    )

    # Wrap all <table> elements in a scrollable container so wide tables
    # scroll horizontally instead of pushing the page wider than the viewport.
    html_body = re.sub(
        r"(<table\b(?![^>]*class=\"table-wrap\")[^>]*>.*?</table>)",
        r'<div class="table-wrap">\1</div>',
        html_body,
        flags=re.IGNORECASE | re.DOTALL,
    )

    # Classify blockquotes into high-contrast, beautiful callout cards
    def _classify_blockquote(m: re.Match) -> str:
        tag_attrs = m.group(1)
        content = m.group(2)
        cls = "callout-card"
        for rule_cls, keywords in CALLOUT_RULES:
            if any(kw in content for kw in keywords):
                cls += f" {rule_cls}"
                break
        return f'<blockquote class="{cls}"{tag_attrs}>{content}</blockquote>'

    html_body = re.sub(
        r'<blockquote([^>]*)>([\s\S]*?)</blockquote>',
        _classify_blockquote,
        html_body,
        flags=re.IGNORECASE,
    )

    # 본문 내 일반 텍스트 목차(•로 시작하는 항목)를 하이퍼링크로 변환.
    # md.toc에서 헤딩 텍스트→ID 매핑을 추출하고, 본문의 목차 항목 텍스트와
    # 매칭하여 <a href="#ID">텍스트</a>로 변환한다.
    # 모바일 file://에서도 기본 앵커 동작으로 스크롤 이동 작동.
    def _build_heading_map(toc_html_str: str) -> dict:
        """toc_html에서 {헤딩텍스트: id} 매핑을 추출한다."""
        mapping = {}
        if not toc_html_str:
            return mapping
        for m in re.finditer(r'<a\s+href="#([^"]+)"[^>]*>(.*?)</a>', toc_html_str, re.DOTALL):
            hid = m.group(1)
            htext = re.sub(r'<[^>]+>', '', m.group(2)).strip()
            if htext and hid:
                mapping[htext] = hid
        return mapping

    def _linkify_inline_toc(body_html: str, heading_map: dict) -> str:
        """본문의 목차 항목을 하이퍼링크로 변환/수정.
        1) •로 시작하는 일반 텍스트 항목 → <a href="#id">로 변환
        2) <ol>/<ul> 안의 <li><a> 항목 중 href가 잘못된 경우 → 올바른 id로 수정
        '📋 목차' 헤딩 아래의 첫 번째 블록만 처리한다."""
        if not heading_map:
            return body_html

        def _find_heading_id(plain_text: str) -> str:
            """plain_text와 매칭되는 헤딩 id를 찾는다."""
            # 정확 매칭
            for htext, hid in heading_map.items():
                if plain_text == htext:
                    return hid
            # 부분 매칭
            for htext, hid in heading_map.items():
                if plain_text and (plain_text in htext or htext in plain_text):
                    return hid
            return None

        def _linkify_p_content(p_attrs: str, content: str) -> str:
            if '•' not in content:
                return f'<p{p_attrs}>{content}</p>'
            lines = content.split('\n')
            new_lines = []
            for line in lines:
                stripped = line.lstrip()
                if not stripped.startswith('•'):
                    new_lines.append(line)
                    continue
                after_bullet = stripped[1:].strip()
                plain = re.sub(r'<[^>]+>', '', after_bullet).strip()
                matched_id = _find_heading_id(plain)
                if matched_id:
                    new_line = line.replace(
                        after_bullet,
                        f'<a href="#{matched_id}">{after_bullet}</a>',
                        1,
                    )
                    new_lines.append(new_line)
                else:
                    new_lines.append(line)
            return f'<p{p_attrs}>{chr(10).join(new_lines)}</p>'

        def _fix_list_links(tag: str, attrs: str, content: str) -> str:
            """<ol>/<ul> 안의 <li><a href="#잘못된-id"> 텍스트</a>에서
            텍스트를 헤딩과 매칭하여 올바른 id로 수정한다."""
            def _fix_a_tag(m: re.Match) -> str:
                href = m.group(1)
                text = m.group(2)
                # 텍스트에서 HTML 태그 제거
                plain = re.sub(r'<[^>]+>', '', text).strip()
                matched_id = _find_heading_id(plain)
                if matched_id:
                    return f'<a href="#{matched_id}">{text}</a>'
                return m.group(0)
            return f'<{tag}{attrs}>{re.sub(r"<a\s+href=\"#([^\"]+)\"[^>]*>([\s\S]*?)</a>", _fix_a_tag, content, flags=re.DOTALL)}</{tag}>'

        # '📋 목차' 헤딩 직후의 첫 번째 블록(<p>, <ol> 또는 <ul>)만 변환.
        pattern = re.compile(
            r'(<h2[^>]*>[^<]*📋\s*목차.*?</h2>\s*)(?:<p([^>]*)>([\s\S]*?)</p>|<(ol|ul)([^>]*)>([\s\S]*?)</\4>)',
            re.IGNORECASE | re.DOTALL,
        )

        def _toc_heading_replacer(m: re.Match) -> str:
            heading = m.group(1)
            if m.group(2) is not None:  # <p> 블록
                return heading + _linkify_p_content(m.group(2), m.group(3))
            elif m.group(4) is not None:  # <ol>/<ul> 블록
                return heading + _fix_list_links(m.group(4), m.group(5), m.group(6))
            return m.group(0)

        return pattern.sub(_toc_heading_replacer, body_html)

    # Pre-render Mermaid diagrams to inline SVG at build time (mobile mode).
    # This eliminates all client-side JS dependency — diagrams work on any
    # mobile browser without loading the 3.4MB mermaid.min.js library.
    # Skipped in PC mode for lighter HTML; Mermaid renders client-side via CDN.
    if config.prerender_mermaid:
        html_body = _prerender_mermaid_to_svg(html_body, progress_cb=progress_cb)

    # 본문 내 일반 텍스트 목차(• 항목)를 하이퍼링크로 변환.
    # toc_html이 label로 감싸지기 전의 원본에서 heading_map을 추출한다.
    heading_map = _build_heading_map(toc_html)
    html_body = _linkify_inline_toc(html_body, heading_map)

    doc_html = HTML_TEMPLATE
    # 제목에 <, >, & 등이 있어도 <title>/헤더 마크업이 깨지지 않도록 이스케이프.
    doc_html = doc_html.replace("%%TITLE%%", html.escape(title))
    # 모바일 TOC 링크 클릭 시 드로어 자동 닫기 (CSS-only):
    # 각 TOC 링크를 <label for="tocSwitch">로 감싸면, 링크 클릭 시 label이
    # checkbox를 토글하여 드로어가 닫히고, 링크의 기본 동작(해시 이동)도 유지됨.
    # JS가 차단된 모바일 file:// 환경에서도 작동.
    if toc_html:
        toc_html = re.sub(
            r'(<a\s+href="#[^"]*"[^>]*>)(.*?)(</a>)',
            r'<label for="tocSwitch" class="toc-link">\1\2\3</label>',
            toc_html,
            flags=re.DOTALL,
        )
    doc_html = doc_html.replace("%%TOC_HTML%%", toc_html)
    doc_html = doc_html.replace("%%BODY_HTML%%", html_body)
    doc_html = doc_html.replace("%%COLLAPSE_MIN_LINES%%", str(int(config.collapse_codeblock_min_lines)))
    doc_html = doc_html.replace("%%MERMAID_CDN_URL%%", MERMAID_CDN_URLS[0])
    doc_html = doc_html.replace(
        "%%MERMAID_CDN_URLS_JS%%",
        ", ".join(f"'{u}'" for u in MERMAID_CDN_URLS),
    )
    doc_html = doc_html.replace("%%MERMAID_ESM_URL%%", MERMAID_ESM_URL)

    # Embed Mermaid by default so diagrams render on mobile / in-app browsers
    # that fail to load the large CDN script. Best-effort: if the library can't
    # be fetched (offline, no cache), the CDN <script> tag stays as a fallback.
    #
    # 사전 렌더링으로 모든 다이어그램이 <img> SVG로 변환되어
    # <div class="mermaid">가 하나도 남지 않으면 클라이언트 렌더링 경로가
    # 필요 없으므로, ~3.5MB mermaid.min.js를 임베드하는 대신 스크립트 태그
    # 자체를 제거해 생성 파일 크기를 크게 줄인다.
    needs_mermaid_runtime = '<div class="mermaid"' in html_body
    if needs_mermaid_runtime and config.embed_mermaid:
        mm_js = _ensure_mermaid_js()
        if mm_js:
            doc_html = _embed_mermaid_js(doc_html, mm_js)
    elif not needs_mermaid_runtime:
        doc_html = re.sub(
            r'\s*<script src="' + re.escape(MERMAID_CDN_URLS[0]) + r'"></script>',
            '',
            doc_html,
        )

    return doc_html


def convert_markdown_file(
    in_path: Path,
    out_path: Path | None = None,
    title: str | None = None,
    config: RenderConfig | None = None,
    progress_cb=None,
) -> Path:
    """단일 Markdown 파일을 standalone HTML로 변환·저장하고 출력 경로를 반환한다."""
    md_text = in_path.read_text(encoding="utf-8")
    out_path = out_path or in_path.with_suffix(".html")
    out_html = markdown_to_tailwind_html(
        md_text, title=title or in_path.stem, config=config, progress_cb=progress_cb
    )
    out_path.write_text(out_html, encoding="utf-8")
    return out_path


def _expand_input_paths(patterns: list[str]) -> list[Path]:
    """--in 인자들을 실제 파일 경로 목록으로 확장한다 (glob 패턴 지원)."""
    paths: list[Path] = []
    for pat in patterns:
        matched = glob.glob(pat, recursive=True) if glob.has_magic(pat) else []
        if matched:
            paths.extend(Path(m) for m in sorted(matched))
        elif Path(pat).is_file():
            paths.append(Path(pat))
        else:
            print(f"[skip] input not found: {pat}", file=sys.stderr)

    seen: set[str] = set()
    unique: list[Path] = []
    for p in paths:
        key = str(p.resolve())
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique


def run_gui() -> int:
    try:
        from PySide6.QtWidgets import (
            QApplication,
            QWidget,
            QVBoxLayout,
            QHBoxLayout,
            QLabel,
            QLineEdit,
            QPushButton,
            QFileDialog,
            QMessageBox,
            QCheckBox,
            QSpinBox,
            QComboBox,
        )
        from PySide6.QtCore import Qt, QSettings, QUrl
        from PySide6.QtGui import QDesktopServices
    except Exception as e:
        raise SystemExit(
            "PySide6 is not available. Install it (pip install PySide6) or run without --gui.\n"
            f"Details: {e}"
        )

    app = QApplication.instance() or QApplication(sys.argv)

    class _DropWidget(QWidget):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.setAcceptDrops(True)
            self._on_drop = None

        def dragEnterEvent(self, event):
            if event.mimeData().hasUrls():
                event.acceptProposedAction()

        def dropEvent(self, event):
            urls = event.mimeData().urls()
            if urls and self._on_drop:
                path = urls[0].toLocalFile()
                if path:
                    self._on_drop(path)

    w = _DropWidget()
    w.setWindowTitle("MD \u2192 HTML Converter")
    w.setMinimumWidth(620)

    settings = QSettings("Transformer", "MD_to_HTML")

    root = QVBoxLayout(w)
    root.setContentsMargins(12, 12, 12, 12)
    root.setSpacing(10)

    def row(label_text: str):
        box = QHBoxLayout()
        box.setSpacing(8)
        lab = QLabel(label_text)
        lab.setMinimumWidth(120)
        box.addWidget(lab)
        return box

    in_edit = QLineEdit("")
    in_edit.setPlaceholderText("*.md")
    out_edit = QLineEdit("")
    out_edit.setPlaceholderText("*.html")
    title_edit = QLineEdit("")

    r1 = row("Input (.md)")
    r1.addWidget(in_edit)
    btn_in = QPushButton("Browse")
    r1.addWidget(btn_in)
    root.addLayout(r1)

    r2 = row("Output (.html)")
    r2.addWidget(out_edit)
    btn_out = QPushButton("Browse")
    r2.addWidget(btn_out)
    root.addLayout(r2)

    r3 = row("Title")
    r3.addWidget(title_edit)
    root.addLayout(r3)

    spin_collapse = QSpinBox()
    spin_collapse.setRange(0, 9999)
    spin_collapse.setValue(COLLAPSE_CODEBLOCK_MIN_LINES)
    spin_collapse.setSingleStep(5)
    spin_collapse.setToolTip("0 = Off")

    r4 = row("Options")

    chk_mobile = QCheckBox("모바일용 (SVG 사전 렌더링 + 라이브러리 임베드)")
    chk_mobile.setChecked(True)
    chk_mobile.setToolTip(
        "체크: Mermaid 다이어그램을 빌드 시 SVG로 사전 렌더링 + 3.5MB 라이브러리 인라인\n"
        "      → 모바일/in-app 브라우저에서 오프라인 렌더링 보장 (HTML 크기 증가)\n"
        "해제: CDN 스크립트로 클라이언트 사이드 렌더링 (가벼운 HTML, PC 권장)"
    )

    def _sync_mobile(state):
        is_on = bool(state)
        chk_embed_mermaid.setChecked(is_on)
        chk_embed_mermaid.setEnabled(not is_on)

    chk_mobile.toggled.connect(_sync_mobile)

    chk_embed_mermaid = QCheckBox("Mermaid 라이브러리 임베드")
    chk_embed_mermaid.setChecked(EMBED_MERMAID)
    chk_embed_mermaid.setToolTip(
        "Mermaid 라이브러리(3.5MB)를 HTML에 인라인\n"
        "모바일/in-app 브라우저에서 CDN 로딩 실패 시에도 렌더링 보장\n"
        "(메모리 캐시 사용 — 디스크 파일 생성 안 함)"
    )

    r4.addSpacing(10)
    r4.addWidget(QLabel("Fold min lines"))
    r4.addWidget(spin_collapse)

    r4.addSpacing(10)
    r4.addWidget(chk_mobile)
    r4.addWidget(chk_embed_mermaid)
    r4.addStretch(1)
    root.addLayout(r4)

    action_row = QHBoxLayout()
    action_row.addStretch(1)

    btn_open = QPushButton("Open output")
    btn_open.setEnabled(False)
    action_row.addWidget(btn_open)

    btn_folder = QPushButton("Open folder")
    btn_folder.setEnabled(False)
    action_row.addWidget(btn_folder)

    btn_run = QPushButton("Generate")
    btn_run.setDefault(True)
    btn_run.setMinimumHeight(34)
    action_row.addWidget(btn_run)

    root.addLayout(action_row)

    last_generated = {"path": None}

    out_manually_set = {"value": False}

    def suggested_out_path(in_text: str) -> str:
        try:
            p = Path((in_text or "").strip())
            if p.name:
                return str(p.with_suffix('.html'))
        except Exception:
            pass
        return ""

    def maybe_update_out_from_in():
        if out_manually_set["value"]:
            return
        sug = suggested_out_path(in_edit.text())
        if sug:
            out_edit.setText(sug)

    def browse_in():
        p, _ = QFileDialog.getOpenFileName(w, "Select markdown", str(Path.cwd()), "Markdown (*.md);;All files (*.*)")
        if p:
            in_edit.setText(p)
            try:
                title_edit.setText(Path(p).stem)
            except Exception:
                pass
            try:
                maybe_update_out_from_in()
            except Exception:
                pass

    def _handle_drop(path: str):
        in_edit.setText(path)
        try:
            title_edit.setText(Path(path).stem)
        except Exception:
            pass
        try:
            maybe_update_out_from_in()
        except Exception:
            pass

    w._on_drop = _handle_drop

    def browse_out():
        try:
            base = Path(in_edit.text().strip())
            default_path = base.with_suffix('.html') if base.name else (Path.cwd() / 'output.html')
        except Exception:
            default_path = Path.cwd() / 'output.html'
        p, _ = QFileDialog.getSaveFileName(w, "Save HTML", str(default_path), "HTML (*.html)")
        if p:
            out_edit.setText(p)
            out_manually_set["value"] = True

    def open_output():
        try:
            p = last_generated.get("path")
            if not p:
                return
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(p)))
        except Exception:
            return

    def open_folder():
        try:
            p = last_generated.get("path")
            if not p:
                return
            folder = Path(str(p)).parent
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder)))
        except Exception:
            return

    def run():
        nonlocal w
        in_raw = in_edit.text().strip()
        if not in_raw:
            QMessageBox.critical(w, "Error", "Please select an input markdown file (*.md).")
            return

        in_path = Path(in_raw)
        out_raw = out_edit.text().strip()
        out_path = Path(out_raw) if out_raw else in_path.with_suffix('.html')
        if not in_path.exists() or not in_path.is_file():
            QMessageBox.critical(w, "Error", f"Input file not found:\n{in_path}")
            return

        render_config = RenderConfig(
            collapse_codeblock_min_lines=int(spin_collapse.value()),
            embed_mermaid=bool(chk_embed_mermaid.isChecked()),
            prerender_mermaid=bool(chk_mobile.isChecked()),
        )

        # Read input file in main thread (fast)
        try:
            md_text = in_path.read_text(encoding="utf-8")
        except Exception as e:
            QMessageBox.critical(w, "Error", f"Failed to read input:\n{e}")
            return

        title = title_edit.text().strip() or in_path.stem

        # Disable UI during conversion (conversion runs in background thread)
        btn_run.setEnabled(False)
        btn_run.setText("Generating...")
        btn_open.setEnabled(False)
        btn_folder.setEnabled(False)
        if chk_mobile.isChecked():
            status_label = QLabel("Converting... (pre-rendering Mermaid diagrams may take a while)")
        else:
            status_label = QLabel("Converting... (PC mode — client-side Mermaid)")
        status_label.setAlignment(Qt.AlignCenter)
        status_label.setStyleSheet("color: #3b82f6; padding: 4px;")
        root.addWidget(status_label)
        app.processEvents()

        # Use a worker thread to avoid freezing the GUI
        from PySide6.QtCore import QThread, Signal

        class _Worker(QThread):
            finished_signal = Signal(object, object)  # (result_html, error)
            progress_signal = Signal(int, int, str)   # (current, total, status)

            def __init__(self, md_text, title, config):
                super().__init__()
                self._md_text = md_text
                self._title = title
                self._config = config

            def run(self):
                try:
                    out_html = markdown_to_tailwind_html(
                        self._md_text,
                        title=self._title,
                        config=self._config,
                        progress_cb=lambda cur, tot, st: self.progress_signal.emit(cur, tot, st),
                    )
                    self.finished_signal.emit(out_html, None)
                except Exception as e:
                    self.finished_signal.emit(None, e)

        worker = _Worker(md_text, title, render_config)
        w._active_worker = worker  # prevent GC while running

        def _on_progress(cur, tot, st):
            if st == "done":
                status_label.setText("Writing HTML...")
            else:
                status_label.setText(f"Rendering Mermaid diagram {cur}/{tot}: {st}")
            app.processEvents()

        worker.progress_signal.connect(_on_progress)

        def _on_done(result_html, error):
            worker.deleteLater()
            w._active_worker = None
            status_label.deleteLater()
            btn_run.setEnabled(True)
            btn_run.setText("Generate")

            if error is not None:
                QMessageBox.critical(w, "Error", f"Failed to generate HTML:\n{error}")
                return

            try:
                out_path.write_text(result_html, encoding="utf-8")
            except Exception as e:
                QMessageBox.critical(w, "Error", f"Failed to write output:\n{e}")
                return

            # Persist GUI state
            try:
                settings.setValue("in_path", str(in_path))
                settings.setValue("out_path", str(out_path))
                settings.setValue("title", str(title_edit.text()))
                settings.setValue("collapse_min_lines", int(spin_collapse.value()))
                settings.setValue("embed_mermaid", 1 if chk_embed_mermaid.isChecked() else 0)
                settings.setValue("prerender_mermaid", 1 if chk_mobile.isChecked() else 0)
            except Exception:
                pass

            last_generated["path"] = str(out_path)
            btn_open.setEnabled(True)
            btn_folder.setEnabled(True)

            QMessageBox.information(w, "Done", f"Generated:\n{out_path}")

        worker.finished_signal.connect(_on_done)
        worker.start()

    btn_in.clicked.connect(browse_in)
    btn_out.clicked.connect(browse_out)
    btn_run.clicked.connect(run)
    btn_open.clicked.connect(open_output)
    btn_folder.clicked.connect(open_folder)

    def on_out_edited(_text: str):
        # Any manual edit to output path should stop auto-following the input path.
        if out_edit.hasFocus():
            out_manually_set["value"] = True

    def on_in_edited(_text: str):
        maybe_update_out_from_in()
        try:
            if not title_edit.text().strip():
                p = Path(in_edit.text().strip())
                if p.name:
                    title_edit.setText(p.stem)
        except Exception:
            pass

    out_edit.textEdited.connect(on_out_edited)
    in_edit.textChanged.connect(on_in_edited)

    # Restore previous session
    try:
        prev_collapse = int(settings.value("collapse_min_lines", COLLAPSE_CODEBLOCK_MIN_LINES) or COLLAPSE_CODEBLOCK_MIN_LINES)
        prev_embed_mermaid = int(settings.value("embed_mermaid", 1 if EMBED_MERMAID else 0) or 0)
        prev_prerender = int(settings.value("prerender_mermaid", 1) or 0)

        # Keep input/output fields empty on launch so placeholders (*.md/*.html) are visible.
        # (We still persist these values on Generate, but we don't auto-restore them.)
        try:
            in_edit.setText("")
            out_edit.setText("")
            title_edit.setText("")
            out_manually_set["value"] = False
        except Exception:
            pass
        spin_collapse.setValue(prev_collapse)
        chk_mobile.setChecked(bool(prev_prerender))
        chk_embed_mermaid.setChecked(bool(prev_embed_mermaid) or bool(prev_prerender))
    except Exception:
        pass

    w.show()
    # Center on screen
    try:
        screen = app.primaryScreen().availableGeometry()
        w.move(
            (screen.width() - w.frameGeometry().width()) // 2,
            (screen.height() - w.frameGeometry().height()) // 2,
        )
    except Exception:
        pass
    return app.exec()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--gui",
        action="store_true",
        default=False,
    )
    parser.add_argument(
        "--cli",
        action="store_true",
        default=False,
    )
    parser.add_argument(
        "--no-embed-mermaid",
        dest="embed_mermaid",
        action="store_false",
        default=EMBED_MERMAID,
        help="Do NOT inline the Mermaid library; keep the CDN <script> tag instead.",
    )
    parser.add_argument(
        "--no-prerender-mermaid",
        dest="prerender_mermaid",
        action="store_false",
        default=True,
        help="Skip pre-rendering Mermaid to SVG; use client-side CDN rendering (lighter HTML for PC).",
    )
    parser.add_argument(
        "--in",
        dest="in_paths",
        nargs="+",
        default=["학습안내서.md"],
        help="입력 Markdown 파일(들). 여러 개 또는 glob 패턴 지원 (예: \"content/**/*.md\").",
    )
    parser.add_argument(
        "--out",
        dest="out_path",
        default=None,
        help="출력 HTML 경로. 단일 입력일 때만 사용 가능.",
    )
    parser.add_argument(
        "--title",
        dest="title",
        default=None,
        help="문서 제목. 단일 입력일 때만 사용 가능.",
    )
    parser.add_argument(
        "--collapse-min-lines",
        dest="collapse_min_lines",
        type=int,
        default=COLLAPSE_CODEBLOCK_MIN_LINES,
    )
    args = parser.parse_args()

    # Default to GUI unless --cli is provided.
    if not bool(args.cli):
        raise SystemExit(run_gui())

    in_paths = _expand_input_paths(list(args.in_paths))
    if not in_paths:
        raise SystemExit("No input files matched.")

    single = len(in_paths) == 1
    if args.out_path and not single:
        raise SystemExit("--out can only be used with a single input file.")
    if args.title and not single:
        raise SystemExit("--title can only be used with a single input file.")

    if args.collapse_min_lines is not None and int(args.collapse_min_lines) > 0:
        collapse_min_lines = int(args.collapse_min_lines)
    else:
        collapse_min_lines = COLLAPSE_CODEBLOCK_MIN_LINES

    render_config = RenderConfig(
        collapse_codeblock_min_lines=collapse_min_lines,
        embed_mermaid=bool(args.embed_mermaid),
        prerender_mermaid=bool(args.prerender_mermaid),
    )

    done = 0
    for in_path in in_paths:
        out_path = Path(args.out_path) if (args.out_path and single) else None
        try:
            written = convert_markdown_file(
                in_path,
                out_path=out_path,
                title=args.title if single else None,
                config=render_config,
            )
            print(str(written))
            done += 1
        except Exception as e:
            print(f"[error] {in_path}: {e}", file=sys.stderr)

    if not single:
        print(f"Converted {done}/{len(in_paths)} file(s).", file=sys.stderr)
    if done == 0:
        raise SystemExit("All conversions failed.")
