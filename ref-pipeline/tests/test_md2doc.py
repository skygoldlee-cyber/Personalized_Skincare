"""md2doc.py 순수 변환 함수 단위 테스트.

대상: 네트워크/GUI 없이 검증 가능한 전처리·후처리·에셋 선택 함수들.
실행: python -m pytest ref-pipeline/tests/ -v
"""
import base64
import hashlib
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import md2doc  # noqa: E402


# ---------------------------------------------------------------------------
# _auto_fence_ascii_diagrams
# ---------------------------------------------------------------------------

class TestAutoFenceAsciiDiagrams:
    def test_wraps_multiline_box_diagram(self):
        md = "본문\n\n┌──┐\n│A │\n└──┘\n\n다음\n"
        out = md2doc._auto_fence_ascii_diagrams(md)
        assert "```text\n┌──┐\n│A │\n└──┘\n```" in out

    def test_single_box_line_not_wrapped(self):
        md = "문장 안 │ 파이프 하나\n다른 문장\n"
        out = md2doc._auto_fence_ascii_diagrams(md)
        assert "```text" not in out

    def test_existing_fence_untouched(self):
        md = "```python\nx = '┌'\ny = '┐'\n```\n"
        out = md2doc._auto_fence_ascii_diagrams(md)
        assert out == md

    def test_no_diagram_passthrough(self):
        md = "# 제목\n\n일반 문단입니다.\n"
        assert md2doc._auto_fence_ascii_diagrams(md) == md


# ---------------------------------------------------------------------------
# _tag_fenced_diagram_blocks_as_text
# ---------------------------------------------------------------------------

class TestTagFencedDiagramBlocks:
    def test_langless_box_fence_tagged_text(self):
        md = "```\n┌─┐\n│ │\n└─┘\n```\n"
        out = md2doc._tag_fenced_diagram_blocks_as_text(md)
        assert out.startswith("```text\n")

    def test_langless_plain_fence_unchanged(self):
        md = "```\nplain code\n```\n"
        assert md2doc._tag_fenced_diagram_blocks_as_text(md) == md

    def test_lang_fence_unchanged(self):
        md = "```python\nprint('┌')\n```\n"
        assert md2doc._tag_fenced_diagram_blocks_as_text(md) == md

    def test_preserves_indent(self):
        md = "  ```\n┌─┐\n└─┘\n  ```\n"
        out = md2doc._tag_fenced_diagram_blocks_as_text(md)
        assert out.splitlines()[0] == "  ```text"


# ---------------------------------------------------------------------------
# _normalize_diagram_codeblocks
# ---------------------------------------------------------------------------

class TestNormalizeDiagramCodeblocks:
    def test_tab_nbsp_fullwidth_normalized_in_text_fence(self):
        md = "```text\n┌─\t┐\n│ │\n└─　┘\n```\n"
        out = md2doc._normalize_diagram_codeblocks(md)
        assert "\t" not in out
        assert " " not in out
        assert "　" not in out

    def test_lang_fence_without_box_chars_unchanged(self):
        md = "```python\nx\t= 1 \n```\n"
        assert md2doc._normalize_diagram_codeblocks(md) == md

    def test_lang_fence_with_box_chars_normalized(self):
        # 언어가 지정돼 있어도 박스 문자가 있으면 다이어그램으로 간주해 정규화
        md = "```console\n┌─\t┐\n```\n"
        out = md2doc._normalize_diagram_codeblocks(md)
        assert "\t" not in out

    def test_outside_fence_unchanged(self):
        md = "탭\t유지 유지\n"
        assert md2doc._normalize_diagram_codeblocks(md) == md


# ---------------------------------------------------------------------------
# _inline_mermaid_fences
# ---------------------------------------------------------------------------

class TestInlineMermaidFences:
    def test_basic_block_becomes_div(self):
        md = "```mermaid\nflowchart LR\n    A-->B\n```\n"
        out = md2doc._inline_mermaid_fences(md)
        assert '<div class="mermaid">' in out
        assert "flowchart LR" in out
        assert "```mermaid" not in out

    def test_html_chars_escaped(self):
        md = "```mermaid\nflowchart LR\n    A[a<b]-->B\n```\n"
        out = md2doc._inline_mermaid_fences(md)
        assert "&lt;" in out
        assert "a<b]" not in out

    def test_unterminated_forest_passthrough(self):
        md = "```mermaid\nflowchart LR\n    A-->B\n"
        out = md2doc._inline_mermaid_fences(md)
        assert "```mermaid" in out
        assert '<div class="mermaid">' not in out

    def test_unterminated_fence_returns_raw_lines(self):
        # 미종결 펜스는 sanitize 없이 원본 라인을 그대로 돌려줘야 한다 —
        # 'flowchart' 같은 입력이 따옴표 삽입 등으로 변형되면 안 된다.
        md = '```mermaid\nflowchart LR\n    A[원본 "따옴표" 레이블]-->B\n'
        out = md2doc._inline_mermaid_fences(md)
        assert 'A[원본 "따옴표" 레이블]-->B' in out

    def test_other_fence_unchanged(self):
        md = "```python\nprint(1)\n```\n"
        assert md2doc._inline_mermaid_fences(md) == md

    def test_unquoted_label_gets_quoted(self):
        md = "```mermaid\nflowchart LR\n    A[라벨 텍스트]-->B\n```\n"
        out = md2doc._inline_mermaid_fences(md)
        assert 'A["라벨 텍스트"]' in out

    def test_case_insensitive_fence(self):
        md = "```MERMAID\nflowchart LR\n    A-->B\n```\n"
        out = md2doc._inline_mermaid_fences(md)
        assert '<div class="mermaid">' in out


# ---------------------------------------------------------------------------
# _apply_smart_pagination
# ---------------------------------------------------------------------------

class TestApplySmartPagination:
    def test_heading_glued_to_next_block(self):
        body = "<h2>제목</h2><p>짧은 단락</p>"
        out = md2doc._apply_smart_pagination(body)
        assert '<div class="keep"><h2>제목</h2><p>짧은 단락</p></div>' in out

    def test_long_pre_marked(self):
        pre = "<pre>" + "\n".join(f"line{i}" for i in range(md2doc._LONG_PRE_LINES + 5)) + "</pre>"
        out = md2doc._apply_smart_pagination(pre)
        assert 'class="long-pre"' in out

    def test_short_pre_unchanged(self):
        body = "<pre>short\ncode</pre>"
        out = md2doc._apply_smart_pagination(body)
        assert 'class="long-pre"' not in out

    def test_long_table_chunked_with_thead(self):
        rows = "".join(
            f"<tr><td>{'x' * 60}</td></tr>" for _ in range(200)
        )
        body = f"<table><thead><tr><th>H</th></tr></thead><tbody>{rows}</tbody></table>"
        out = md2doc._apply_smart_pagination(body)
        assert out.count("<table>") > 1
        assert out.count("<thead>") == out.count("<table>")

    def test_new_page_h2_flag(self):
        out = md2doc._apply_smart_pagination("<h2>t</h2>", new_page_h2=True)
        assert '<h2 class="new-page"' in out


# ---------------------------------------------------------------------------
# _ensure_mermaid_js — 로컬 우선 + SRI 검증
# ---------------------------------------------------------------------------

_FAKE_JS = "/* mermaid */" + "x" * 250_000  # _MERMAID_MIN_BYTES(200KB) 초과


@pytest.fixture(autouse=True)
def _reset_mermaid_memory():
    md2doc._MERMAID_JS_MEMORY = None
    yield
    md2doc._MERMAID_JS_MEMORY = None


class TestEnsureMermaidJs:
    def test_vendor_file_preferred_no_network(self, tmp_path, monkeypatch):
        vendor = tmp_path / "vendor" / "mermaid"
        vendor.mkdir(parents=True)
        (vendor / "mermaid.min.js").write_text(_FAKE_JS, encoding="utf-8")
        monkeypatch.setattr(
            md2doc, "_REPO_VENDOR_MERMAID", vendor / "mermaid.min.js"
        )

        def _boom(url, timeout=30):
            raise AssertionError("network must not be used")

        monkeypatch.setattr(md2doc, "_download_text", _boom)
        assert md2doc._ensure_mermaid_js() == _FAKE_JS

    def test_tiny_vendor_falls_back_to_cdn(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            md2doc, "_REPO_VENDOR_MERMAID", tmp_path / "missing.js"
        )
        monkeypatch.setattr(md2doc, "_download_text", lambda url, timeout=30: _FAKE_JS)
        monkeypatch.setattr(
            md2doc, "MERMAID_SRI_HASHES", {u: None for u in md2doc.MERMAID_CDN_URLS}
        )
        assert md2doc._ensure_mermaid_js() == _FAKE_JS

    def test_sri_match_accepted(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            md2doc, "_REPO_VENDOR_MERMAID", tmp_path / "missing.js"
        )
        expected = base64.b64encode(
            hashlib.sha384(_FAKE_JS.encode("utf-8")).digest()
        ).decode("ascii")
        monkeypatch.setattr(
            md2doc, "MERMAID_SRI_HASHES", {u: expected for u in md2doc.MERMAID_CDN_URLS}
        )
        monkeypatch.setattr(md2doc, "_download_text", lambda url, timeout=30: _FAKE_JS)
        assert md2doc._ensure_mermaid_js() == _FAKE_JS

    def test_sri_mismatch_skips_to_next_cdn(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            md2doc, "_REPO_VENDOR_MERMAID", tmp_path / "missing.js"
        )
        good_hash = base64.b64encode(
            hashlib.sha384(_FAKE_JS.encode("utf-8")).digest()
        ).decode("ascii")
        urls = md2doc.MERMAID_CDN_URLS
        monkeypatch.setattr(
            md2doc, "MERMAID_SRI_HASHES", {u: good_hash for u in urls}
        )
        bad = _FAKE_JS + "tampered"
        payloads = {urls[0]: bad, urls[1]: _FAKE_JS, urls[2]: _FAKE_JS}
        monkeypatch.setattr(
            md2doc, "_download_text", lambda url, timeout=30: payloads.get(url)
        )
        assert md2doc._ensure_mermaid_js() == _FAKE_JS

    def test_all_sources_fail_returns_none(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            md2doc, "_REPO_VENDOR_MERMAID", tmp_path / "missing.js"
        )
        monkeypatch.setattr(md2doc, "_download_text", lambda url, timeout=30: None)
        assert md2doc._ensure_mermaid_js() is None

    def test_memory_cache_reused(self, tmp_path, monkeypatch):
        calls = []
        monkeypatch.setattr(
            md2doc, "_REPO_VENDOR_MERMAID", tmp_path / "missing.js"
        )
        monkeypatch.setattr(
            md2doc, "_download_text",
            lambda url, timeout=30: calls.append(url) or _FAKE_JS,
        )
        monkeypatch.setattr(
            md2doc, "MERMAID_SRI_HASHES", {u: None for u in md2doc.MERMAID_CDN_URLS}
        )
        first = md2doc._ensure_mermaid_js()
        second = md2doc._ensure_mermaid_js()
        assert first == second == _FAKE_JS
        assert len(calls) == 1


# ---------------------------------------------------------------------------
# Mermaid SVG 디스크 캐시
# ---------------------------------------------------------------------------

@pytest.fixture()
def _cache_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(md2doc, "_mermaid_cache_dir", lambda: tmp_path / "mcache")
    return tmp_path / "mcache"


class TestMermaidCache:
    _SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>x</text></svg>'

    def test_round_trip(self, _cache_tmp):
        md2doc._mermaid_cache_write("flowchart LR\nA-->B", self._SVG)
        assert md2doc._mermaid_cache_read("flowchart LR\nA-->B") == self._SVG

    def test_miss_returns_none(self, _cache_tmp):
        assert md2doc._mermaid_cache_read("flowchart LR\nX-->Y") is None

    def test_key_is_src_sensitive(self, _cache_tmp):
        md2doc._mermaid_cache_write("src A", self._SVG)
        assert md2doc._mermaid_cache_read("src B") is None

    def test_invalid_content_not_returned(self, _cache_tmp):
        md2doc._mermaid_cache_write("src", "<html>not svg</html>")
        assert md2doc._mermaid_cache_read("src") is None

    def test_key_deterministic(self):
        a = md2doc._mermaid_cache_key("same src")
        b = md2doc._mermaid_cache_key("same src")
        assert a == b
        assert md2doc._mermaid_cache_key("other") != a

    def test_key_includes_renderer(self):
        # 같은 소스라도 렌더러(mermaid.ink / kroki 폴백)가 다르면
        # 출력 SVG가 다르므로 캐시 키를 분리해야 한다.
        a = md2doc._mermaid_cache_key("src", renderer="mermaid.ink")
        b = md2doc._mermaid_cache_key("src", renderer="kroki")
        assert a != b

    def test_renderer_entries_isolated(self, _cache_tmp):
        md2doc._mermaid_cache_write("src", self._SVG, renderer="kroki")
        assert md2doc._mermaid_cache_read("src", renderer="kroki") == self._SVG
        assert md2doc._mermaid_cache_read("src", renderer="mermaid.ink") is None


# ---------------------------------------------------------------------------
# _embed_mermaid_js
# ---------------------------------------------------------------------------

class TestEmbedMermaidJs:
    def test_replaces_cdn_tag_and_neutralizes_close(self):
        doc = (
            f'<html><head><script src="{md2doc.MERMAID_CDN_URLS[0]}"></script>'
            f"</head></html>"
        )
        js = 'var s = "</script>";'
        out = md2doc._embed_mermaid_js(doc, js)
        assert f'src="{md2doc.MERMAID_CDN_URLS[0]}"' not in out
        assert "<\\/script" in out
        assert '"</script>"' not in out

    def test_empty_inputs_passthrough(self):
        doc = "<html></html>"
        assert md2doc._embed_mermaid_js(doc, "") == doc
        assert md2doc._embed_mermaid_js("", "x") == ""


# ---------------------------------------------------------------------------
# markdown_to_tailwind_html — 네트워크 없는 통합 경로
# ---------------------------------------------------------------------------

class TestMarkdownToTailwindHtmlOffline:
    def test_basic_document(self):
        cfg = md2doc.RenderConfig(prerender_mermaid=False, embed_mermaid=False)
        out = md2doc.markdown_to_tailwind_html("# 제목\n\n본문 텍스트\n", config=cfg)
        assert "<h1" in out
        assert "본문 텍스트" in out
        assert "%%" not in out  # 플레이스홀더 잔존 없음

    def test_mermaid_div_kept_without_prerender(self):
        cfg = md2doc.RenderConfig(prerender_mermaid=False, embed_mermaid=False)
        md = "```mermaid\nflowchart LR\n    A-->B\n```\n"
        out = md2doc.markdown_to_tailwind_html(md, config=cfg)
        # 사전렌더 비활성 → 클라이언트 렌더링용 div + CDN 스크립트 태그 유지
        assert '<div class="mermaid">' in out
        assert md2doc.MERMAID_CDN_URLS[0] in out

    def test_title_escaped(self):
        cfg = md2doc.RenderConfig(prerender_mermaid=False, embed_mermaid=False)
        out = md2doc.markdown_to_tailwind_html(
            "# x\n", title='a<b>"c"', config=cfg
        )
        assert "<title>a&lt;b&gt;&quot;c&quot;</title>" in out


# ---------------------------------------------------------------------------
# _embed_local_images — base_dir 밖 경로 탈출 차단
# ---------------------------------------------------------------------------

class TestEmbedLocalImages:
    def test_sibling_image_embedded(self, tmp_path):
        base = tmp_path / "docs"
        base.mkdir()
        (base / "pic.png").write_bytes(b"pngdata")
        body = '<p><img src="pic.png" alt="x"></p>'
        out = md2doc._embed_local_images(body, base)
        assert "data:image/png;base64," in out

    def test_parent_traversal_not_embedded(self, tmp_path):
        # base_dir 밖 파일은 임베드되지 않아야 한다 (임의 로컬 파일 유출 방지)
        base = tmp_path / "docs"
        base.mkdir()
        (tmp_path / "outside.png").write_bytes(b"secret")
        body = '<p><img src="../outside.png" alt="x"></p>'
        out = md2doc._embed_local_images(body, base)
        assert "base64" not in out

    def test_remote_and_data_uri_untouched(self, tmp_path):
        body = (
            '<img src="https://x/y.png">'
            '<img src="data:image/png;base64,AAAA">'
        )
        assert md2doc._embed_local_images(body, tmp_path) == body


# ---------------------------------------------------------------------------
# _sanitize_svg — 렌더러 응답의 실행 가능 요소 제거
# ---------------------------------------------------------------------------

class TestSanitizeSvg:
    def test_script_and_handlers_removed(self):
        svg = '<svg><script>alert(1)</script><a onclick="x()">t</a></svg>'
        out = md2doc._sanitize_svg(svg)
        assert "<script" not in out
        assert "onclick" not in out

    def test_javascript_href_neutralized(self):
        svg = '<svg><a href="javascript:alert(1)">t</a></svg>'
        out = md2doc._sanitize_svg(svg)
        assert "javascript:" not in out

    def test_plain_svg_untouched(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>'
        assert md2doc._sanitize_svg(svg) == svg


# ---------------------------------------------------------------------------
# _build_markdown — 공통 변환기 팩토리
# ---------------------------------------------------------------------------

class TestBuildMarkdown:
    def test_extensions_available(self):
        md = md2doc._build_markdown()
        out = md.convert("| a | b |\n|---|---|\n| 1 | 2 |\n")
        assert "<table>" in out
        out = md.convert("```python\nx = 1\n```")
        assert "codehilite" in out or "highlight" in out
