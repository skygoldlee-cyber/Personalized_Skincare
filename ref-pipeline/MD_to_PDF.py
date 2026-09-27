# MD → PDF 변환기 (독립 실행형)
#
# 의존성: markdown (requirements.txt) + 로컬 Chrome/Edge (헤드리스 인쇄).
# Mermaid 다이어그램은 mermaid.ink → kroki.io 순으로 정적 SVG로 프리렌더해
# 박아 넣는다 (네트워크 실패 시 다이어그램 소스가 코드 블록으로 출력됨).
#
# 사용:
#   python MD_to_PDF.py                                 # GUI 모드 (PySide6 필요)
#   python MD_to_PDF.py --cli --in doc.md               # doc.pdf 생성
#   python MD_to_PDF.py --cli --in a.md b.md --out-dir out/  # 일괄 변환
#   python MD_to_PDF.py --cli --in doc.md --keep-html   # 중간 HTML 보존
import argparse
import base64
import html
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import markdown


# =============================================================================
# Mermaid 전처리·프리렌더 (MD_to_HTML.py에서 임베딩 — 독립 실행 보장)
# =============================================================================

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

    def _render_one(m: re.Match, label: str = "") -> str:
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
            try:
                print(f"[Mermaid pre-render failed] {label}: {last_err}", file=sys.stderr)
            except Exception:
                pass

        if svg:
            # SVG에서 악의적 요소 제거 (XSS 방어)
            svg = re.sub(r"<script[\s\S]*?</script>", "", svg, flags=re.IGNORECASE)
            svg = re.sub(r'\son\w+\s*=\s*"[^"]*"', "", svg)
            svg = re.sub(r"\son\w+\s*=\s*'[^']*'", "", svg)

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


# =============================================================================
# 인쇄용 HTML 템플릿
# =============================================================================

# Windows 표준 브라우저 경로 → PATH 순으로 탐색
_BROWSER_CANDIDATES = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
)

# 인쇄 전용 스타일 — 다크 테마/드로어/플로팅 UI 없는 문서 레이아웃
PRINT_TEMPLATE = r"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>%%TITLE%%</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1a1a1a;
    max-width: 180mm;
    margin: 0 auto;
  }
  h1 { font-size: 20pt; border-bottom: 3px solid #333; padding-bottom: 6px;
       page-break-after: avoid; }
  h2 { font-size: 15pt; border-bottom: 1.5px solid #999; padding-bottom: 4px;
       margin-top: 1.6em; page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin-top: 1.3em; page-break-after: avoid; }
  h4 { font-size: 11pt; margin-top: 1.1em; page-break-after: avoid; }
  /* 헤딩 + 첫 본문을 한 덩어리로 묶어 페이지 맨 밑 고립 헤딩 방지 */
  .keep { page-break-inside: avoid; }
  .new-page { page-break-before: always; }
  p { margin: 0.55em 0; orphans: 3; widows: 3; }
  a { color: #1a56db; text-decoration: none; }
  ul, ol { margin: 0.4em 0; padding-left: 1.6em; }
  li { margin: 0.2em 0; page-break-inside: avoid; }
  blockquote {
    margin: 0.7em 0; padding: 0.6em 1em;
    border-left: 4px solid #c9d4e4; background: #f4f7fb;
    color: #333;
    page-break-inside: avoid;
  }
  code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 9.5pt;
    background: #f1f3f5; padding: 1px 4px; border-radius: 3px;
  }
  pre {
    background: #f6f8fa; border: 1px solid #d8dce3; border-radius: 6px;
    padding: 10px 12px; font-size: 8.5pt; line-height: 1.5;
    white-space: pre-wrap; word-break: break-all;
    page-break-inside: avoid;
  }
  /* 40줄 초과 코드 블록: 통째 유지 불가 — 내부 분할 허용 (페이지 하단 빈 공간 방지) */
  pre.long-pre { page-break-inside: auto; }
  pre code { background: none; padding: 0; font-size: inherit; }
  /* 표는 가급적 한 페이지에 통째로 — 페이지보다 긴 표는 빌드 시 조각으로
     분할되므로(_split_long_table) 여기선 avoid만 유지한다 */
  table {
    border-collapse: collapse; width: 100%; margin: 0.7em 0;
    font-size: 9.5pt; page-break-inside: avoid;
  }
  th, td { border: 1px solid #c9ced6; padding: 5px 8px; text-align: left;
           vertical-align: top; }
  th { background: #eef1f5; font-weight: 700; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }  /* 표 분할 시 헤더 행 반복 */
  hr { border: none; border-top: 1px solid #ccc; margin: 1.2em 0; }
  /* max-height: 페이지(261mm)보다 큰 이미지는 축소 — 거대 이미지가
     페이지를 넘기며 다음 페이지 상단에 빈 조각을 남기는 문제 방지 */
  img, svg { max-width: 100%; max-height: 245mm; height: auto; page-break-inside: avoid; }
  .mermaid, .mermaid-img { text-align: center; margin: 0.8em 0; page-break-inside: avoid; }
</style>
</head>
<body>
%%BODY%%
</body>
</html>
"""


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
    # (MD_to_HTML.py와 동일한 전처리 — 변환 후 정규식은 codehilite 마크업과 불일치)
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
                print(f"[img embed fail] {img_path}: {e}", file=sys.stderr)
        else:
            print(f"[img not found] {src} (기준: {base_dir})", file=sys.stderr)
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


def convert_markdown_file(
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

    md_text = in_path.read_text(encoding="utf-8")
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
    else:
        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".html", encoding="utf-8", delete=False
        )
        tmp.write(doc)
        tmp.close()
        html_path = Path(tmp.name)

    try:
        html_to_pdf(html_path, out_path, browser)
    finally:
        if not keep_html:
            html_path.unlink(missing_ok=True)
    return out_path


def _run_gui() -> int:
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
                    written = convert_markdown_file(
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Markdown → PDF 변환기 (헤드리스 Chrome 인쇄)")
    parser.add_argument("--gui", action="store_true", default=False,
                        help="GUI 모드로 실행 (기본값 — --cli 미지정 시 GUI)")
    parser.add_argument("--cli", action="store_true", default=False,
                        help="CLI 모드로 실행 (--in 필수)")
    parser.add_argument("--in", dest="in_paths", nargs="+", default=None)
    parser.add_argument("--out", dest="out_path", default=None,
                        help="출력 PDF 경로 (단일 입력일 때만)")
    parser.add_argument("--out-dir", dest="out_dir", default=None,
                        help="출력 디렉토리 (다중 입력용)")
    parser.add_argument("--title", dest="title", default=None)
    parser.add_argument("--keep-html", dest="keep_html", action="store_true",
                        help="인쇄용 중간 HTML을 <이름>.print.html로 보존")
    parser.add_argument("--no-mermaid", dest="no_mermaid", action="store_true",
                        help="Mermaid 프리렌더 생략 (코드 블록으로 출력)")
    parser.add_argument("--new-page-h2", dest="new_page_h2", action="store_true",
                        help="h2(##) 섹션마다 새 페이지에서 시작")
    parser.add_argument("--browser", dest="browser", default=None,
                        help="Chrome/Edge 실행 파일 경로 (자동 탐색 실패 시)")
    args = parser.parse_args()

    # MD_to_HTML.py와 동일한 컨벤션: --cli 미지정 시 GUI 진입
    if not args.cli:
        try:
            return _run_gui()
        except ImportError:
            raise SystemExit(
                "GUI 모드는 PySide6가 필요합니다.\n"
                "  pip install PySide6\n"
                "또는 CLI로 사용: python MD_to_PDF.py --cli --in doc.md"
            )

    if not args.in_paths:
        raise SystemExit("--in이 필요합니다. (GUI는 --cli 없이 실행)")

    in_paths = [Path(p) for p in args.in_paths]
    missing = [str(p) for p in in_paths if not p.is_file()]
    if missing:
        raise SystemExit(f"입력 파일 없음: {', '.join(missing)}")
    if args.out_path and len(in_paths) > 1:
        raise SystemExit("--out은 단일 입력일 때만 사용 가능")

    done = 0
    for in_path in in_paths:
        if args.out_path:
            out_path = Path(args.out_path)
        elif args.out_dir:
            out_path = Path(args.out_dir) / (in_path.stem + ".pdf")
        else:
            out_path = None
        try:
            written = convert_markdown_file(
                in_path,
                out_path=out_path,
                title=args.title if len(in_paths) == 1 else None,
                keep_html=bool(args.keep_html),
                render_mermaid=not args.no_mermaid,
                new_page_h2=bool(args.new_page_h2),
                browser=args.browser,
            )
            print(str(written))
            done += 1
        except Exception as e:
            print(f"[error] {in_path}: {e}", file=sys.stderr)

    if len(in_paths) > 1:
        print(f"Converted {done}/{len(in_paths)} file(s).", file=sys.stderr)
    return 0 if done else 1


if __name__ == "__main__":
    raise SystemExit(main())
