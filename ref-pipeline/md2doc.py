# @spec CS-01,CS-05
import markdown
from pathlib import Path
import unicodedata
import html
import re
import argparse
import base64
import glob
import random
import hashlib
import json
import logging
import sys
import time
import urllib.request
import urllib.parse
import shutil
import subprocess
import tempfile
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

# Windows cp949 콘솔 대응 — 한글/유니코드 안내 메시지가 깨지지 않게 UTF-8 고정
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


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

# 진단 로그 — CLI는 __main__에서 basicConfig, GUI는 progress_cb 경로 별도 유지.
# 라이브러리로 임포트될 때는 핸들러 없이 조용히 동작한다.
logger = logging.getLogger("md2doc")

# ASCII/박스 드로잉 다이어그램 감지용 문자 집합 (여러 파이프라인 함수에서 공용)
BOX_CHARS = frozenset("┌┐└┘├┤┬┴┼│─═╔╗╚╝╠╣╦╩╬┃━▲▼◀▶")

# blockquote → 콜아웃 카드 분류 기본 규칙 (범용 이모지 마커만 포함).
# 프로젝트 특화 키워드(인물명·문서 태그 등)는 스크립트 옆의
# callout_rules.json 또는 --callout-rules로 주입한다.
# (CSS 클래스, 키워드 튜플) 쌍이며 위에서부터 순서대로 평가되어 첫 매칭이 적용된다.
CALLOUT_RULES_DEFAULT: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("callout-sop", ("📋",)),
    ("callout-trouble", ("🚨",)),
    ("callout-warning", ("⚠️",)),
    ("callout-form", ("📑",)),
    ("callout-character", ("💡",)),
    ("callout-exam", ("🎯", "🧠")),
)

_CALLOUT_RULES_CACHE: tuple[tuple[str, tuple[str, ...]], ...] | None = None


def _resolve_callout_rules(rules_file: str | Path | None = None) -> tuple[tuple[str, tuple[str, ...]], ...]:
    """콜아웃 분류 규칙을 결정한다.

    우선순위: --callout-rules 명시 경로 → 스크립트 옆 callout_rules.json → 기본값.
    rules_file이 None이면 결과를 캐시한다 (변환마다 반복 로드 방지).
    """
    global _CALLOUT_RULES_CACHE
    if rules_file is None and _CALLOUT_RULES_CACHE is not None:
        return _CALLOUT_RULES_CACHE

    candidates = [Path(rules_file)] if rules_file else [Path(__file__).with_name("callout_rules.json")]
    for cand in candidates:
        try:
            if cand.is_file():
                data = json.loads(cand.read_text(encoding="utf-8"))
                rules = tuple(
                    (str(r["class"]), tuple(str(k) for k in r["keywords"]))
                    for r in data.get("rules", [])
                    if r.get("class") and r.get("keywords")
                )
                if rules:
                    if rules_file is None:
                        _CALLOUT_RULES_CACHE = rules
                    return rules
        except Exception as e:
            logger.warning("[callout_rules] failed to load %s: %s", cand, e)

    if rules_file is None:
        _CALLOUT_RULES_CACHE = CALLOUT_RULES_DEFAULT
    return CALLOUT_RULES_DEFAULT

# Embed the Mermaid library directly into the generated HTML by default.
# The CDN build (mermaid.min.js) is ~3.5MB; on mobile in-app browsers
# (KakaoTalk, Samsung Internet viewer, etc.) and flaky networks that large
# external script often fails to load, leaving the diagram source as raw text.
# Inlining it removes the runtime network dependency so diagrams render offline.
EMBED_MERMAID = True
MERMAID_ASSET_NAME = "mermaid.min.js"
# CDN URL은 정확한 버전으로 고정 — 같은 빌드에서 매번 동일한 라이브러리를 얻는다.
# vendor/mermaid/mermaid.min.js는 별도 빌드라 CDN 바이트와 다르므로,
# vendor가 있으면 항상 그것을 우선 사용하고 CDN은 부재 시 폴백으로만 쓴다.
MERMAID_VERSION = "11.17.2"
# Tried in order at build time; the first that returns a real file is cached.
MERMAID_CDN_URLS = (
    f"https://cdn.jsdelivr.net/npm/mermaid@{MERMAID_VERSION}/dist/mermaid.min.js",
    f"https://unpkg.com/mermaid@{MERMAID_VERSION}/dist/mermaid.min.js",
    f"https://fastly.jsdelivr.net/npm/mermaid@{MERMAID_VERSION}/dist/mermaid.min.js",
)
# ESM 빌드는 CDN 폴백의 최후 수단으로 사용 (생성 HTML 내 JS가 import)
MERMAID_ESM_URL = f"https://cdn.jsdelivr.net/npm/mermaid@{MERMAID_VERSION}/dist/mermaid.esm.min.mjs"
# The library is multi-MB; anything much smaller is an error page, not the lib.
_MERMAID_MIN_BYTES = 200_000

# 고정 버전 npm dist 빌드의 sha384(base64) — jsdelivr/unpkg/fastly.jsdelivr가
# 동일 바이트를 서빙하므로 동일 해시 적용. 버전을 올릴 때 재계산해 갱신한다.
# (계산: sha384sum vendor 또는 curl <url> | openssl dgst -sha384 -binary | base64)
_MERMAID_PINNED_SHA384 = "EOXBFmc3gx5mb+vn0vPvvGqACToJD24hhacX5Yx+8NUUQrHIle/Qi5Bg9o3zKwW2"
MERMAID_SRI_HASHES: dict[str, str | None] = {
    url: _MERMAID_PINNED_SHA384 for url in MERMAID_CDN_URLS
}

# 저장소에 자체 호스팅된 Mermaid 빌드 — 네트워크 없이 확정 버전을 얻는 1순위 소스
_REPO_VENDOR_MERMAID = (
    Path(__file__).resolve().parent.parent / "vendor" / "mermaid" / MERMAID_ASSET_NAME
)

# In-memory cache for the Mermaid library (no disk writes).
_MERMAID_JS_MEMORY: str | None = None


@dataclass(frozen=True)
class RenderConfig:
    collapse_codeblock_min_lines: int = COLLAPSE_CODEBLOCK_MIN_LINES
    embed_mermaid: bool = EMBED_MERMAID
    prerender_mermaid: bool = True
    callout_rules_file: str | None = None


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

    우선순위: 인메모리 캐시 → 저장소 vendor 파일(오프라인·버전 확정) →
    assets_dir 로컬 사본 → 고정 버전 CDN (SRI 검증).
    첫 성공 결과를 메모리에 캐시한다 (디스크 쓰기 없음).

    Returns None if the library cannot be obtained (offline), in which case
    the generated HTML keeps its CDN <script> tag as a fallback.
    """
    global _MERMAID_JS_MEMORY
    if _MERMAID_JS_MEMORY is not None:
        return _MERMAID_JS_MEMORY

    # 저장소에 자체 호스팅된 빌드 — 네트워크 없이 확정 버전을 얻는 1순위 소스
    for local in (_REPO_VENDOR_MERMAID,
                  Path(assets_dir) / MERMAID_ASSET_NAME if assets_dir else None):
        if local is None:
            continue
        try:
            cached = _read_text_if_exists(local)
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
                    logger.warning("[Mermaid SRI mismatch] %s", url)
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


def _load_template(name: str) -> str:
    """ref-pipeline/template/ 아래의 HTML 템플릿을 읽어 반환한다.

    템플릿 부재는 빌드 실패 원인이므로 명시적 오류를 발생시킨다.
    """
    p = Path(__file__).resolve().parent / "template" / name
    if not p.is_file():
        raise FileNotFoundError(f"template not found: {p}")
    return p.read_text(encoding="utf-8")


HTML_TEMPLATE = _load_template("doc.html")


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
                               r'\((?!["\'\x00\[])(?P<label>[^\)]*?)\)')
    node_pat_cur = re.compile(r'(?P<prefix>^|[^A-Za-z0-9_"\'])'
                               r'(?P<id>[A-Za-z_][A-Za-z0-9_]*)'
                               r'\{(?!["\'\x00])(?P<label>[^\}]*?)\}')

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

        _cur_diagram_type = getattr(sanitize_mermaid_line, '_diagram_type', '')

        # Sanitize edge labels written as |label| (flowchart links)
        # FIX: |"label"| 형태(이미 큰따옴표로 감싸진 엣지 레이블)는 그대로 유지.
        # |label| 형태(따옴표 없는 것)만 _sanitize_label 처리.
        # 이유: _sanitize_label의 " → ' 변환이 |"label"| → |'label'| 로 만들어
        # mermaid 파서가 ' 를 구분자로 오해하여 파싱 오류 발생.
        # FIX2: |label| 문법은 flowchart/graph/stateDiagram 전용 — erDiagram의
        # 카디널리티(||--||, }o--o{ 등)가 \|...\|에 오매칭되어 -- → — 로 파괴됨.
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

        if _cur_diagram_type in ('', 'flowchart', 'graph', 'stateDiagram', 'stateDiagram-v2'):
            line = re.sub(r"\|([^|]+)\|", _edge_label_repl, line)

        # quadrantChart 전용: title/x-axis/y-axis/quadrant-N 라인 처리.
        # ★ diagram_type 체크 필수 — xychart-beta 등 다른 다이어그램의
        #   x-axis/y-axis 문법은 완전히 달라 이 처리를 적용하면 파싱 오류 발생.
        _s_stripped = line.lstrip()
        _indent_qc  = line[: len(line) - len(_s_stripped)]

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

            # 따옴표 레이블 구간 보호: ["..."], ("..."), {"..."}, [("...")],
            # {{"..."}}, (("...")), >"..."], [/"..."/] 등 모든 셰이프.
            # 열림 기호 연속 + "..." + 닫힘 기호 연속을 통째로 보호해야
            # 레이블 내부의 foo() 같은 텍스트가 node_pat_par에 오매칭되지 않고
            # [("...")] 실린더 형태도 유지된다.
            # 주의: 레이블 밖의 따옴표(예: A[foo "bar" baz] 내부)는 보호하지 않아
            # _sanitize_label의 " → ' 치환이 계속 동작한다.
            protected = re.sub(
                r'[\[({>/\\]+"[^"]*?"[\])}/\\\]]*'
                r'|"[^"]*?"(?=\s*(?:-->|---|==>|==|-\.-|\.->))',
                _protect_quoted_label, line)

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


# === Mermaid 사전렌더 SVG 캐시 ===
# 다이어그램 소스(테마 포함) 해시를 키로 ref-pipeline/.mermaid_cache/에
# SVG를 저장 — 재빌드 시 네트워크 요청 없이 즉시 재사용한다.
# 렌더러 출력이 바뀌어 캐시를 무효화해야 할 때는 SALT를 올린다.
_MERMAID_CACHE_SALT = "mermaid.ink:default:ffffff:v1"


def _mermaid_cache_dir() -> Path:
    return Path(__file__).resolve().parent / ".mermaid_cache"


def _mermaid_cache_key(src: str) -> str:
    return hashlib.sha256(
        (_MERMAID_CACHE_SALT + "\x00" + src).encode("utf-8")
    ).hexdigest()


def _mermaid_cache_read(src: str) -> str | None:
    try:
        p = _mermaid_cache_dir() / (_mermaid_cache_key(src) + ".svg")
        if p.is_file():
            text = p.read_text(encoding="utf-8")
            if text.strip().startswith("<svg") and "</svg>" in text:
                return text
    except Exception as e:
        logger.warning("[mermaid-cache] read failed: %s", e)
    return None


def _mermaid_cache_write(src: str, svg: str) -> None:
    try:
        d = _mermaid_cache_dir()
        d.mkdir(parents=True, exist_ok=True)
        (d / (_mermaid_cache_key(src) + ".svg")).write_text(svg, encoding="utf-8")
    except Exception as e:
        logger.warning("[mermaid-cache] write failed: %s", e)


def _prerender_mermaid_to_svg(html_body: str, progress_cb=None) -> str:
    """Replace all <div class="mermaid">...</div> with inline SVG from mermaid.ink.

    Uses the mermaid.ink render API to pre-render diagrams at build time.
    Falls back to the original div (for client-side rendering) if the API fails.
    progress_cb(current, total, status) is called for each diagram if provided.

    소스 해시 디스크 캐시(.mermaid_cache/)로 재빌드 시 네트워크 요청을 생략하고,
    프로세스 내 dedupe로 동일 다이어그램 중복 렌더링도 막는다.
    """
    pattern = re.compile(r'<div class="mermaid">([\s\S]*?)</div>', re.IGNORECASE)
    matches = list(pattern.finditer(html_body))
    total = len(matches)
    if total == 0:
        return html_body

    # 진행 표시용 라벨 (다이어그램 소스 첫 줄)
    labels = [html.unescape(m.group(1)).strip().split('\n')[0][:60] for m in matches]

    # 동일 소스의 중복 네트워크 요청 방지 (워커 간 공유 — dict get/set은 GIL로 안전)
    src_results: dict[str, str | None] = {}

    def _render_one(m: re.Match, label: str = "") -> str:
        src = html.unescape(m.group(1)).strip()
        if not src:
            return m.group(0)

        if src in src_results:
            svg = src_results[src]
        else:
            svg = _mermaid_cache_read(src)

        if svg is None:
            # 메인 웹앱(src/mermaid-utils.js)과 동일한 전략:
            # mindmap은 항상 'default' 테마로 렌더링 (밝은 파스텔 배경 + 어두운 텍스트).
            # dark 테마는 노드 배경이 어두워져 텍스트 대비가 급격히 저하됨.
            # flowchart 등 다른 타입도 동일하게 default로 렌더링하여
            # 다크 페이지 위에서 "밝은 카드"처럼 표시.
            # 모든 다이어그램을 default 테마로 렌더링
            encoded = base64.urlsafe_b64encode(src.encode("utf-8")).decode("ascii")
            url = f"https://mermaid.ink/svg/{encoded}?theme=default&bgColor=ffffff"

            last_err = None
            for _attempt in range(4):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        svg = resp.read().decode("utf-8", errors="replace")
                    if svg and svg.strip().startswith("<svg") and "</svg>" in svg:
                        break
                    svg = None
                    last_err = "empty/invalid SVG response"
                except Exception as e:
                    last_err = e
                    svg = None
                if _attempt < 3:
                    # 503 레이트리밋 대비 지터 백오프 (워커 간 요청 분산)
                    time.sleep(1.5 * (_attempt + 1) + random.random())

            if svg is None:
                # Fallback renderer: kroki.io (deflate + base64url path encoding).
                # Transparent-background SVG sits on .mermaid-img's own background.
                kdata = base64.urlsafe_b64encode(
                    zlib.compress(src.encode("utf-8"), 9)
                ).decode("ascii")
                kurl = f"https://kroki.io/mermaid/svg/{kdata}"
                for _kattempt in range(2):
                    try:
                        req = urllib.request.Request(kurl, headers={"User-Agent": "Mozilla/5.0"})
                        with urllib.request.urlopen(req, timeout=30) as resp:
                            cand = resp.read().decode("utf-8", errors="replace")
                        if cand and cand.strip().startswith("<svg") and "</svg>" in cand:
                            svg = cand
                            break
                    except Exception as e:
                        last_err = e
                        if _kattempt == 0:
                            time.sleep(1.0)

            if svg is None:
                logger.warning("[Mermaid pre-render failed] %s: %s", label, last_err)

            if svg:
                # SVG에서 악의적 요소 제거 (XSS 방어)
                svg = re.sub(r"<script[\s\S]*?</script>", "", svg, flags=re.IGNORECASE)
                svg = re.sub(r'\son\w+\s*=\s*"[^"]*"', "", svg)
                svg = re.sub(r"\son\w+\s*=\s*'[^']*'", "", svg)

            src_results[src] = svg
            if svg:
                _mermaid_cache_write(src, svg)

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
    # 워커 2개 + 지터 백오프로 mermaid.ink 레이트리밋(503)을 완화한다.
    replacements: list[str] = [m.group(0) for m in matches]
    with ThreadPoolExecutor(max_workers=2) as pool:
        fut_map = {pool.submit(_render_one, m, labels[i]): i for i, m in enumerate(matches)}
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
    callout_rules = _resolve_callout_rules(config.callout_rules_file)

    def _classify_blockquote(m: re.Match) -> str:
        tag_attrs = m.group(1)
        content = m.group(2)
        cls = "callout-card"
        for rule_cls, keywords in callout_rules:
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
        '목차'/'TOC'/'Table of Contents'를 포함하는 h2 헤딩 아래의
        첫 번째 블록만 처리한다."""
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

        # 목차 헤딩('목차'/'TOC'/'Table of Contents'를 포함하는 h2) 직후의
        # 첫 번째 블록(<p>, <ol> 또는 <ul>)만 변환.
        pattern = re.compile(
            r'(<h2[^>]*>[^<]*?(?:목차|toc|table\s+of\s+contents).*?</h2>\s*)(?:<p([^>]*)>([\s\S]*?)</p>|<(ol|ul)([^>]*)>([\s\S]*?)</\4>)',
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
    # 빌드 표시: 구버전/신버전 파일 구별용 (모바일 전송 파일 혼동 방지)
    doc_html = doc_html.replace("%%BUILD%%", "b" + time.strftime("%m%d%H%M"))
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

    # Verify all template placeholders were substituted before inserting the
    # body — checking at this point also avoids false positives from literal
    # "%%FOO%%" text inside the document body itself.
    leftover = sorted(set(re.findall(r'%%[A-Z][A-Z0-9_]+%%', doc_html)) - {"%%BODY_HTML%%"})
    if leftover:
        raise RuntimeError(f"Unsubstituted template placeholders: {leftover}")

    doc_html = doc_html.replace("%%BODY_HTML%%", html_body)
    return doc_html


def convert_markdown_file(
    in_path: Path,
    out_path: Path | None = None,
    title: str | None = None,
    config: RenderConfig | None = None,
    progress_cb=None,
) -> Path:
    """단일 Markdown 파일을 standalone HTML로 변환·저장하고 출력 경로를 반환한다."""
    md_text = in_path.read_text(encoding="utf-8-sig")
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
            logger.warning("[skip] input not found: %s", pat)

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
            QComboBox,
        )
        from PySide6.QtCore import Qt, QSettings, QUrl
        from PySide6.QtGui import QDesktopServices
    except Exception as e:
        raise SystemExit(
            "PySide6 is not available. Install it (pip install PySide6) or run with --cli.\n"
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
    w.setWindowTitle("md2doc — MD → HTML/PDF Converter")
    w.setMinimumWidth(620)

    settings = QSettings("Transformer", "md2doc")

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

    r4 = row("Options")

    chk_mobile = QCheckBox("모바일용 (SVG 사전 렌더링)")
    chk_mobile.setChecked(True)
    chk_mobile.setToolTip(
        "체크: Mermaid 다이어그램을 빌드 시 SVG로 사전 렌더링\n"
        "      → 모바일/in-app 브라우저에서 JS 없이도 표시, HTML도 가벼움 (~0.3MB)\n"
        "      ※ 사전 렌더링에 실패한 다이어그램이 있으면 3.5MB 라이브러리를\n"
        "        자동 임베드하여 폴백 렌더링 보장\n"
        "해제: CDN 스크립트로 클라이언트 사이드 렌더링 (가벼운 HTML, PC 권장)"
    )

    chk_pdf = QCheckBox("PDF도 함께 생성")
    chk_pdf.setToolTip(
        "HTML 생성 후 같은 내용을 헤드리스 Chrome/Edge 인쇄로 PDF도 만듦\n"
        "(브라우저 자동 탐색 — 없으면 실패 안내만 표시되고 HTML은 정상 생성됨)"
    )

    r4.addWidget(chk_mobile)
    r4.addWidget(chk_pdf)
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
            # 모바일 모드에서는 사전 렌더링 실패분의 폴백으로만 사용되므로 항상 켠다.
            # (성공 시 임베드되지 않아 크기 비용 없음) / PC 모드는 CDN 사용.
            embed_mermaid=bool(chk_mobile.isChecked()),
            prerender_mermaid=bool(chk_mobile.isChecked()),
        )

        # Read input file in main thread (fast)
        try:
            md_text = in_path.read_text(encoding="utf-8-sig")
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
            finished_signal = Signal(object, object, object)  # (result_html, pdf_result, error)
            progress_signal = Signal(int, int, str)   # (current, total, status)

            def __init__(self, md_text, title, config, want_pdf, in_path):
                super().__init__()
                self._md_text = md_text
                self._title = title
                self._config = config
                self._want_pdf = want_pdf
                self._in_path = in_path

            def run(self):
                try:
                    out_html = markdown_to_tailwind_html(
                        self._md_text,
                        title=self._title,
                        config=self._config,
                        progress_cb=lambda cur, tot, st: self.progress_signal.emit(cur, tot, st),
                    )
                    pdf_res = None
                    if self._want_pdf:
                        try:
                            pdf_res = convert_markdown_to_pdf(
                                self._in_path, title=self._title,
                                progress_cb=lambda cur, tot, st: self.progress_signal.emit(cur, tot, st),
                            )
                        except Exception as pe:
                            pdf_res = pe  # HTML은 정상 — PDF 실패만 별도 보고
                    self.finished_signal.emit(out_html, pdf_res, None)
                except Exception as e:
                    self.finished_signal.emit(None, None, e)

        worker = _Worker(md_text, title, render_config, chk_pdf.isChecked(), in_path)
        w._active_worker = worker  # prevent GC while running

        def _on_progress(cur, tot, st):
            if st == "done":
                status_label.setText("Writing HTML...")
            else:
                status_label.setText(f"Rendering Mermaid diagram {cur}/{tot}: {st}")
            app.processEvents()

        worker.progress_signal.connect(_on_progress)

        def _on_done(result_html, pdf_res, error):
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
                settings.setValue("prerender_mermaid", 1 if chk_mobile.isChecked() else 0)
                settings.setValue("also_pdf", 1 if chk_pdf.isChecked() else 0)
            except Exception:
                pass

            last_generated["path"] = str(out_path)
            btn_open.setEnabled(True)
            btn_folder.setEnabled(True)

            msg = f"Generated:\n{out_path}"
            if isinstance(pdf_res, Path):
                msg += f"\n{pdf_res}"
            elif isinstance(pdf_res, Exception):
                QMessageBox.warning(w, "PDF 실패",
                                    f"HTML은 생성됐지만 PDF 변환에 실패했습니다:\n{pdf_res}")
            QMessageBox.information(w, "Done", msg)

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
        chk_mobile.setChecked(bool(prev_prerender))
        chk_pdf.setChecked(bool(int(settings.value("also_pdf", 0) or 0)))
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


# =============================================================================
# MD → PDF 변환 (헤드리스 Chrome 인쇄) — 구 MD_to_PDF.py
# =============================================================================

# Windows 표준 브라우저 경로 → PATH 순으로 탐색
_BROWSER_CANDIDATES = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
)

# 인쇄 전용 스타일 — 다크 테마/드로어/플로팅 UI 없는 문서 레이아웃
PRINT_TEMPLATE = _load_template("print.html")


def _find_browser() -> str | None:
    for cand in _BROWSER_CANDIDATES:
        if Path(cand).is_file():
            return cand
    for name in ("chrome", "chrome.exe", "msedge", "msedge.exe", "chromium"):
        found = shutil.which(name)
        if found:
            return found
    return None


def md_to_html_body(
    md_text: str,
    render_mermaid: bool = True,
    new_page_h2: bool = False,
    progress_cb=None,
) -> str:
    # codehilite가 토큰화하기 전에 ```mermaid 펜스를 raw HTML 블록으로 변환
    # (md2doc.py와 동일한 전처리 — 변환 후 정규식은 codehilite 마크업과 불일치)
    if render_mermaid:
        md_text = _inline_mermaid_fences(md_text)
    md = markdown.Markdown(
        extensions=[
            "fenced_code", "tables", "toc", "codehilite",
            "admonition", "attr_list", "md_in_html",
        ],
        extension_configs={"toc": {"permalink": False}},
    )
    body = md.convert(md_text)
    if render_mermaid:
        body = _prerender_mermaid_to_svg(body, progress_cb=progress_cb)
    body = _apply_smart_pagination(body, new_page_h2=new_page_h2)
    return body


# 이 줄 수를 넘는 <pre>는 한 페이지에 못 들어갈 수 있어 내부 분할 허용
_LONG_PRE_LINES = 40
# 이 예상 줄 수를 넘는 <table>은 한 페이지에 못 들어갈 수 있어 조각으로 분할.
# 행 수가 아니라 셀 텍스트 길이로 높이를 추정한다 — 콘티 표처럼
# 10행이지만 행 높이가 큰 표도 한 페이지를 넘기므로 행 수만으로는 부족.
_LONG_TABLE_LINES = 38
# 분할 조각당 목표 줄 수 — A4 한 페이지 본문(~44줄)보다 작게 잡아
# 각 조각이 페이지를 넘지 않도록 한다
_TABLE_CHUNK_LINES = 30
# 헤딩에 붙일 수 있는 직후 블록의 최대 텍스트 길이 — 너무 긴 단락을
# .keep으로 묶으면 통째로 다음 페이지로 밀려 큰 여백이 생긴다
_KEEP_MAX_CHARS = 600


def _apply_smart_pagination(body: str, new_page_h2: bool = False) -> str:
    """인쇄용 지능형 페이지 나눔 후처리.

    1) h2~h4 헤딩 + 직후 블록(단락/목록/인용)을 .keep div로 묶어
       '페이지 맨 밑에 헤딩만 남는' 고립을 방지한다. 표/코드블록처럼
       길이를 알 수 없는 요소는 묶지 않는다.
    2) _LONG_PRE_LINES 초과 <pre>에 .long-pre를 붙여 내부 분할을 허용한다.
       (짧은 블록만 통째 유지 → 큰 빈 공간 방지)
    """
    # 1) 헤딩 + 직후 블록 묶기
    heading_pat = re.compile(
        r'(<h[2-4][^>]*>[\s\S]*?</h[2-4]>)'
        r'(\s*<(?:p|ul|ol|blockquote)\b[^>]*>[\s\S]*?</(?:p|ul|ol|blockquote)>)?',
        re.IGNORECASE,
    )

    def _glue_heading(m: re.Match) -> str:
        head, nxt = m.group(1), m.group(2)
        # 긴 블록은 묶지 않는다 — keep 덩어리가 커지면 페이지 하단 여백만 커짐
        if nxt and len(re.sub(r"<[^>]+>", "", nxt)) > _KEEP_MAX_CHARS:
            nxt = None
        return f'<div class="keep">{head}{nxt or ""}</div>'

    body = heading_pat.sub(_glue_heading, body)

    # 2) 긴 코드 블록 내부 분할 허용
    def _mark_long_pre(m: re.Match) -> str:
        block = m.group(0)
        if block.count("\n") > _LONG_PRE_LINES:
            return block.replace("<pre>", '<pre class="long-pre">', 1)
        return block

    body = re.sub(r"<pre>[\s\S]*?</pre>", _mark_long_pre, body)

    # 3) 긴 표는 페이지 크기의 조각으로 미리 분할한다.
    #    Chrome이 분할된 행의 연속 부분을 빈 공간으로 렌더하는 quirk가 있어
    #    CSS page-break 규칙만으로는 페이지 상단 공백이 남는다.
    #    각 조각을 _TABLE_CHUNK_LINES 이하로 잘라 page-break-inside: avoid
    #    (기본 table CSS)로 통째 유지시키면 행이 절대 중간에 잘리지 않는다.
    def _est_row_lines(tr: str) -> int:
        cells = re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr, re.IGNORECASE)
        ncols = max(len(cells), 1)
        # 셀당 대략적 문자 용량: 표 폭 180mm ÷ 열 수 (9.5pt 한글 ≈ 3.4mm/자,
        # 셀 패딩 고려 보수적 추정 — 과대추정 시 한 페이지를 넘는 표를
        # '짧은 표'로 오인해 avoid가 통째 밀어내기 + 큰 여백을 만든다)
        cap = max(8, int(45 / ncols))
        row_lines = 1
        for c in cells:
            # <br>·</li>·</p> 등 블록 경계를 실제 줄바꿈으로 환산
            txt = re.sub(r"(?i)<br\s*/?>|</(?:li|p|div|ul|ol)>", "\n", c)
            txt = re.sub(r"<[^>]+>", "", txt)
            cell_lines = sum(
                max(1, -(-len(seg) // cap)) for seg in txt.split("\n")
            )
            row_lines = max(row_lines, cell_lines)
        return row_lines

    def _split_long_table(m: re.Match) -> str:
        block = m.group(0)
        rows = re.findall(r"<tr[\s\S]*?</tr>", block, re.IGNORECASE)
        if sum(_est_row_lines(r) for r in rows) <= _LONG_TABLE_LINES:
            return block

        # <thead>를 각 조각에 복제해 분할된 표에도 헤더가 붙도록 한다
        thead_m = re.search(r"<thead[\s\S]*?</thead>", block, re.IGNORECASE)
        thead_html = thead_m.group(0) if thead_m else ""
        tbody = re.search(r"<tbody[\s\S]*?</tbody>", block, re.IGNORECASE)
        body_rows = (
            re.findall(r"<tr[\s\S]*?</tr>", tbody.group(0), re.IGNORECASE)
            if tbody else rows[len(re.findall(r"<tr[\s\S]*?</tr>", thead_html)):]
        )

        chunks: list[list[str]] = []
        current: list[str] = []
        current_lines = _est_row_lines(thead_html) if thead_html else 0
        for r in body_rows:
            rl = _est_row_lines(r)
            # 단일 행이 조각 한계를 넘어도 그대로 둔다 (행은 원자 단위)
            if current and current_lines + rl > _TABLE_CHUNK_LINES:
                chunks.append(current)
                current, current_lines = [], 0
            current.append(r)
            current_lines += rl
        if current:
            chunks.append(current)

        if len(chunks) <= 1:
            return block
        return "\n".join(
            "<table>" + thead_html + "<tbody>" + "".join(c) + "</tbody></table>"
            for c in chunks
        )

    body = re.sub(r"<table>[\s\S]*?</table>", _split_long_table, body)

    if new_page_h2:
        body = re.sub(r"<h2\b", '<h2 class="new-page"', body)
    return body


_IMG_MIME = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
    ".bmp": "image/bmp", ".ico": "image/x-icon",
}


def _embed_local_images(body: str, base_dir: Path) -> str:
    """<img src="상대경로">를 base64 data URI로 임베딩한다.

    출력 HTML이 임시 폴더에 생성되므로 상대경로 이미지는 반드시 깨진다.
    MD 파일 위치 기준으로 로컬 이미지를 읽어 자립형 HTML을 만든다.
    http(s)/data/file URI는 그대로 둔다. 없는 파일은 경고만 출력.
    """
    def _repl(m: re.Match) -> str:
        open_tag, src = m.group(1), m.group(2)
        if re.match(r"(?i)(?:https?:|data:|file:|//)", src):
            return m.group(0)
        # URL 디코딩 + ?query / #fragment 제거 후 실제 파일 경로 해석
        raw = urllib.parse.unquote(re.split(r"[?#]", src, 1)[0])
        img_path = (base_dir / raw).resolve()
        mime = _IMG_MIME.get(img_path.suffix.lower())
        if mime and img_path.is_file():
            try:
                data = base64.b64encode(img_path.read_bytes()).decode("ascii")
                return f'{open_tag}data:{mime};base64,{data}"'
            except Exception as e:
                logger.warning("[img embed fail] %s: %s", img_path, e)
        else:
            logger.warning("[img not found] %s (기준: %s)", src, base_dir)
        return m.group(0)

    return re.sub(r'(<img\b[^>]*?\bsrc=")([^"]+)"', _repl, body, flags=re.IGNORECASE)


def html_to_pdf(html_path: Path, pdf_path: Path, browser: str) -> None:
    url = html_path.resolve().as_uri()
    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path.resolve()}",
        url,
    ]
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=120,
    )
    if result.returncode != 0 or not pdf_path.exists():
        raise RuntimeError(
            f"브라우저 인쇄 실패: {result.stderr.strip() or result.stdout.strip()}"
        )


def convert_markdown_to_pdf(
    in_path: Path,
    out_path: Path | None = None,
    title: str | None = None,
    keep_html: bool = False,
    render_mermaid: bool = True,
    new_page_h2: bool = False,
    browser: str | None = None,
    progress_cb=None,
) -> Path:
    """단일 Markdown 파일을 PDF로 변환·저장하고 출력 경로를 반환한다."""
    browser = browser or _find_browser()
    if not browser:
        raise RuntimeError(
            "Chrome/Edge를 찾지 못했습니다. --browser로 실행 파일 경로를 지정하세요."
        )

    md_text = in_path.read_text(encoding="utf-8-sig")
    body = md_to_html_body(
        md_text,
        render_mermaid=render_mermaid,
        new_page_h2=new_page_h2,
        progress_cb=progress_cb,
    )
    # 출력 HTML은 임시 폴더에 생성되므로 상대경로 이미지를 data URI로 임베딩
    body = _embed_local_images(body, in_path.parent)
    doc = PRINT_TEMPLATE.replace("%%TITLE%%", html.escape(title or in_path.stem))
    doc = doc.replace("%%BODY%%", body)

    out_path = out_path or in_path.with_suffix(".pdf")
    if keep_html:
        html_path = in_path.with_suffix(".print.html")
        html_path.write_text(doc, encoding="utf-8")
        html_to_pdf(html_path, out_path, browser)
    else:
        # 실패·예외 시에도 임시 HTML이 남지 않도록 TemporaryDirectory 사용
        with tempfile.TemporaryDirectory(prefix="md2doc-") as tmpdir:
            html_path = Path(tmpdir) / (in_path.stem + ".print.html")
            html_path.write_text(doc, encoding="utf-8")
            html_to_pdf(html_path, out_path, browser)
    return out_path


def run_pdf_gui() -> int:
    """PySide6 GUI 모드 — 인자 없이 실행 시 진입한다."""
    from PySide6.QtCore import Qt, QThread, Signal
    from PySide6.QtWidgets import (
        QApplication, QCheckBox, QFileDialog, QHBoxLayout, QLabel, QLineEdit,
        QListWidget, QMainWindow, QMessageBox, QProgressBar, QPushButton,
        QPlainTextEdit, QVBoxLayout, QWidget,
    )

    class ConvertWorker(QThread):
        log = Signal(str)
        progress = Signal(int, int)  # 완료 수, 전체 수
        done = Signal(int)           # 성공 파일 수

        def __init__(self, paths, out_dir, opts, parent=None):
            super().__init__(parent)
            self._paths = paths
            self._out_dir = out_dir
            self._opts = opts

        def run(self):
            ok = 0
            total = len(self._paths)
            for i, in_path in enumerate(self._paths):
                self.log.emit(f"[변환 시작] {in_path.name}")

                def mermaid_cb(cur, tot, label, name=in_path.name):
                    self.log.emit(f"  {name}: mermaid {cur}/{tot} — {label}")

                try:
                    out_path = (
                        (self._out_dir / (in_path.stem + ".pdf"))
                        if self._out_dir else None
                    )
                    written = convert_markdown_to_pdf(
                        in_path, out_path=out_path,
                        keep_html=self._opts["keep_html"],
                        render_mermaid=not self._opts["no_mermaid"],
                        new_page_h2=self._opts["new_page_h2"],
                        browser=self._opts["browser"] or None,
                        progress_cb=mermaid_cb,
                    )
                    self.log.emit(f"[완료] {written}")
                    ok += 1
                except Exception as e:
                    self.log.emit(f"[오류] {in_path.name}: {e}")
                self.progress.emit(i + 1, total)
            self.done.emit(ok)

    class MainWindow(QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("Markdown → PDF 변환기")
            self.setAcceptDrops(True)
            self._worker = None

            root = QWidget()
            self.setCentralWidget(root)
            lay = QVBoxLayout(root)

            lay.addWidget(QLabel("변환할 Markdown 파일 (드래그앤드롭 가능):"))
            self.list = QListWidget()
            self.list.setMinimumHeight(120)
            lay.addWidget(self.list)

            btn_row = QHBoxLayout()
            for text, fn in (
                ("파일 추가…", self.add_files),
                ("선택 제거", self.remove_selected),
                ("전체 비우기", self.list.clear),
            ):
                b = QPushButton(text)
                b.clicked.connect(fn)
                btn_row.addWidget(b)
            lay.addLayout(btn_row)

            out_row = QHBoxLayout()
            out_row.addWidget(QLabel("출력 폴더 (비우면 원본과 동일 위치):"))
            self.out_dir = QLineEdit()
            self.out_dir.setPlaceholderText("입력 파일과 같은 폴더")
            out_row.addWidget(self.out_dir, 1)
            b = QPushButton("찾아보기…")
            b.clicked.connect(self.pick_out_dir)
            out_row.addWidget(b)
            lay.addLayout(out_row)

            self.keep_html = QCheckBox("중간 HTML 보존 (.print.html)")
            self.no_mermaid = QCheckBox("Mermaid 렌더 생략 (소스 그대로 출력)")
            self.new_page_h2 = QCheckBox("## 섹션마다 새 페이지 시작")
            for cb in (self.keep_html, self.no_mermaid, self.new_page_h2):
                lay.addWidget(cb)

            br_row = QHBoxLayout()
            br_row.addWidget(QLabel("브라우저 (자동 탐색 실패 시):"))
            self.browser = QLineEdit()
            self.browser.setPlaceholderText(_find_browser() or "chrome.exe 경로")
            br_row.addWidget(self.browser, 1)
            b = QPushButton("찾아보기…")
            b.clicked.connect(self.pick_browser)
            br_row.addWidget(b)
            lay.addLayout(br_row)

            self.progress = QProgressBar()
            self.progress.setValue(0)
            lay.addWidget(self.progress)

            self.convert_btn = QPushButton("PDF로 변환")
            self.convert_btn.clicked.connect(self.start_convert)
            lay.addWidget(self.convert_btn)

            lay.addWidget(QLabel("로그:"))
            self.log_view = QPlainTextEdit()
            self.log_view.setReadOnly(True)
            self.log_view.setMinimumHeight(140)
            lay.addWidget(self.log_view)

            self.resize(680, 620)

        def log(self, msg):
            self.log_view.appendPlainText(msg)

        def add_files(self):
            files, _ = QFileDialog.getOpenFileNames(
                self, "Markdown 파일 선택", "", "Markdown (*.md *.markdown)"
            )
            for f in files:
                self.list.addItem(f)

        def remove_selected(self):
            for item in self.list.selectedItems():
                self.list.takeItem(self.list.row(item))

        def pick_out_dir(self):
            d = QFileDialog.getExistingDirectory(self, "출력 폴더 선택")
            if d:
                self.out_dir.setText(d)

        def pick_browser(self):
            f, _ = QFileDialog.getOpenFileName(
                self, "Chrome/Edge 실행 파일", "", "Executable (*.exe)"
            )
            if f:
                self.browser.setText(f)

        def dragEnterEvent(self, e):
            if e.mimeData().hasUrls():
                e.acceptProposedAction()

        def dropEvent(self, e):
            for url in e.mimeData().urls():
                p = url.toLocalFile()
                if p.lower().endswith((".md", ".markdown")):
                    self.list.addItem(p)

        def start_convert(self):
            paths = [
                Path(self.list.item(i).text()) for i in range(self.list.count())
            ]
            if not paths:
                QMessageBox.warning(self, "입력 없음", "변환할 .md 파일을 추가하세요.")
                return
            missing = [p.name for p in paths if not p.is_file()]
            if missing:
                QMessageBox.warning(
                    self, "파일 없음", "파일이 없습니다: " + ", ".join(missing)
                )
                return
            opts = {
                "keep_html": self.keep_html.isChecked(),
                "no_mermaid": self.no_mermaid.isChecked(),
                "new_page_h2": self.new_page_h2.isChecked(),
                "browser": self.browser.text().strip(),
            }
            out_dir = Path(self.out_dir.text()) if self.out_dir.text().strip() else None
            self.convert_btn.setEnabled(False)
            self.progress.setValue(0)
            self._worker = ConvertWorker(paths, out_dir, opts, self)
            self._worker.log.connect(self.log)
            self._worker.progress.connect(
                lambda done, total: self.progress.setValue(int(100 * done / total))
            )
            self._worker.done.connect(self.on_done)
            self._worker.start()

        def on_done(self, ok):
            self.convert_btn.setEnabled(True)
            total = self.list.count()
            self.log(f"=== {ok}/{total}개 변환 완료 ===")

    app = QApplication(sys.argv)
    win = MainWindow()
    win.show()
    return app.exec()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
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
        default=None,
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
    parser.add_argument(
        "--callout-rules",
        dest="callout_rules",
        default=None,
        help="콜아웃 분류 규칙 JSON 경로. 미지정 시 스크립트 옆 callout_rules.json을 사용하고, 없으면 기본 이모지 규칙.",
    )
    # ── PDF 모드 (구 MD_to_PDF.py 통합) ─────────────────────────────────
    parser.add_argument(
        "--pdf",
        action="store_true",
        default=False,
        help="PDF 모드 — GUI/CLI 모두 MD→PDF로 동작 (헤드리스 Chrome 인쇄)",
    )
    parser.add_argument("--out-dir", dest="out_dir", default=None,
                        help="PDF 모드: 출력 디렉토리 (다중 입력용)")
    parser.add_argument("--keep-html", dest="keep_html", action="store_true",
                        help="PDF 모드: 인쇄용 중간 HTML을 <이름>.print.html로 보존")
    parser.add_argument("--no-mermaid", dest="no_mermaid", action="store_true",
                        help="PDF 모드: Mermaid 프리렌더 생략 (코드 블록으로 출력)")
    parser.add_argument("--new-page-h2", dest="new_page_h2", action="store_true",
                        help="PDF 모드: h2(##) 섹션마다 새 페이지에서 시작")
    parser.add_argument("--browser", dest="browser", default=None,
                        help="PDF 모드: Chrome/Edge 실행 파일 경로 (자동 탐색 실패 시)")
    parser.add_argument("--verbose", "-v", dest="verbose", action="store_true",
                        help="진단 로그를 DEBUG 수준까지 출력")
    parser.add_argument("--quiet", "-q", dest="quiet", action="store_true",
                        help="경고 이상의 로그만 출력")
    args = parser.parse_args()

    logging.basicConfig(
        level=(logging.DEBUG if args.verbose
               else logging.ERROR if args.quiet
               else logging.INFO),
        format="%(message)s",
    )

    # Default to GUI unless --cli is provided. --pdf는 PDF 전용 GUI로 진입.
    if not bool(args.cli):
        raise SystemExit(run_pdf_gui() if args.pdf else run_gui())

    if not args.in_paths:
        raise SystemExit("--in is required in --cli mode. (Run without --cli to launch the GUI.)")

    in_paths = _expand_input_paths(list(args.in_paths))
    if not in_paths:
        raise SystemExit("No input files matched.")

    single = len(in_paths) == 1
    if args.out_path and not single:
        raise SystemExit("--out can only be used with a single input file.")
    if args.title and not single:
        raise SystemExit("--title can only be used with a single input file.")

    # ── PDF 모드 (구 MD_to_PDF.py CLI 경로) ────────────────────────────
    if args.pdf:
        out_dir = Path(args.out_dir) if args.out_dir else None
        done = 0
        for in_path in in_paths:
            out_path = (Path(args.out_path) if (args.out_path and single)
                        else (out_dir / (in_path.stem + '.pdf')) if out_dir
                        else None)
            try:
                written = convert_markdown_to_pdf(
                    in_path, out_path=out_path,
                    title=args.title if single else None,
                    keep_html=args.keep_html,
                    render_mermaid=not args.no_mermaid,
                    new_page_h2=args.new_page_h2,
                    browser=args.browser,
                )
                print(str(written))
                done += 1
            except Exception as e:
                logger.error("[error] %s: %s", in_path, e)
        if not single:
            logger.info("Converted %d/%d file(s).", done, len(in_paths))
        if done == 0:
            raise SystemExit("All conversions failed.")
        raise SystemExit(0)

    if args.collapse_min_lines is not None and int(args.collapse_min_lines) > 0:
        collapse_min_lines = int(args.collapse_min_lines)
    else:
        collapse_min_lines = COLLAPSE_CODEBLOCK_MIN_LINES

    render_config = RenderConfig(
        collapse_codeblock_min_lines=collapse_min_lines,
        embed_mermaid=bool(args.embed_mermaid),
        prerender_mermaid=bool(args.prerender_mermaid),
        callout_rules_file=args.callout_rules,
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
            logger.error("[error] %s: %s", in_path, e)

    if not single:
        logger.info("Converted %d/%d file(s).", done, len(in_paths))
    if done == 0:
        raise SystemExit("All conversions failed.")
