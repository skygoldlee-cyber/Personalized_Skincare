# -*- coding: utf-8 -*-
"""
script_polisher.py
==================
시험교재 Markdown을 '청취용 오디오 원고'로 정제하는 모듈.

변환 규칙:
  - 표(|..|)          → "다음 표를 살펴 보겠습니다. 항목: 값, ..." 서술형
  - <br> / <br/>      → 문장 나눔
  - 불릿(-, •)        → "첫째, ... 둘째, ..." 또는 자연스러운 나열
  - **볼드**          → 볼드 기호 제거 (강조는 TTS 억양에 맡김)
  - 법조항 제3조(정의) → "화장품법 제3조, 정의." 형태로 읽기 좋게
  - ①②③ / ①          → "첫째", "둘째" 또는 그대로
  - 영문 약어          → 한글 발음 병기 유지 (TTS가 알아서 읽도록 원문 유지)
  - --- 구분선         → 삭제
  - # 헤더            → "제N장, 제목." 형태의 안내 멘트
  - 코드블록          → "다음 내용을 참고하세요." 요약 처리 (읽기 부적합)
  - 화학식/기호        → 그대로 (TTS 발음에 맡김) + 불필요 특수기호 정리
"""

from __future__ import annotations

import re
from typing import List

from md_chunker import Chunk


# ---------------------------------------------------------------------------
# 숫자/서열 읽기 변환
# ---------------------------------------------------------------------------

CIRCLED = {
    "①": "첫째", "②": "둘째", "③": "셋째", "④": "넷째", "⑤": "다섯째",
    "⑥": "여섯째", "⑦": "일곱째", "⑧": "여덟째", "⑨": "아홉째", "⑩": "열째",
}

KOREAN_NUM = ["", "첫", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉", "열"]


def circled_to_korean(text: str) -> str:
    for k, v in CIRCLED.items():
        text = text.replace(k, v)
    return text


# ---------------------------------------------------------------------------
# 표 → 서술형 변환
# ---------------------------------------------------------------------------

def table_to_narration(table_md: str) -> str:
    """
    마크다운 표를 청취용 서술문으로 변환.

    예)
    | 용어 | 정의 |
    |---|---|
    | 극성 | 전자 분포가 기울어진 것 |
    →
    다음 내용을 표로 정리했습니다.
    용어와 정의에 대한 내용입니다.
    극성: 전자 분포가 기울어진 것.
    """
    lines = [l.strip() for l in table_md.strip().split("\n") if l.strip()]
    rows: List[List[str]] = []
    for line in lines:
        if not (line.startswith("|") and line.endswith("|")):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        # 구분행 (|---|---|) 스킵
        if all(re.fullmatch(r":?-+:?", c) for c in cells if c):
            continue
        rows.append(cells)

    if not rows:
        return ""

    header = rows[0]
    data = rows[1:]

    out: List[str] = ["다음 내용을 표로 정리했습니다."]
    if len(header) >= 2:
        cols = "와(과) ".join(h for h in header if h)
        out.append(f"{cols}에 대한 내용입니다.")

    for cells in data:
        cells = [c for c in cells]
        if not any(cells):
            continue
        # 첫 열이 비어 있으면 이전 행의 연속 (계층 표) → 두 번째 열을 항목명으로
        if len(cells) >= 2 and not cells[0] and cells[1]:
            item = clean_inline(cells[1])
            desc = clean_inline(cells[2]) if len(cells) > 2 else ""
            out.append(f"{item}: {desc}." if desc else f"{item}.")
        else:
            item = clean_inline(cells[0])
            desc = " ".join(clean_inline(c) for c in cells[1:] if c)
            out.append(f"{item}: {desc}." if desc else f"{item}.")

    return "\n".join(out)


# ---------------------------------------------------------------------------
# 인라인 마크업 정리
# ---------------------------------------------------------------------------

def clean_inline(text: str) -> str:
    """<br>, **, 불릿 기호 등 인라인 마크업을 읽기 좋은 텍스트로 정리."""
    t = text
    # <br> → 쉼표/문장 구분
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.IGNORECASE)
    # 볼드/이탤릭 제거
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)
    # 인라인 코드 → 내용만
    t = re.sub(r"`([^`]+)`", r"\1", t)
    # 불릿 기호 정리
    t = re.sub(r"^[•\-\*]\s*", "", t, flags=re.MULTILINE)
    # ┗ 계층 기호 → "하위 항목으로"
    t = t.replace("┗", "하위 항목으로,")
    # HTML 엔티티
    t = t.replace("&nbsp;", " ")
    # 다중 공백
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()


# ---------------------------------------------------------------------------
# 법조항/특수 패턴 읽기 변환
# ---------------------------------------------------------------------------

def polish_law_refs(text: str) -> str:
    """제3조(정의) → 제3조, 정의. / 제3조의2 → 제3조의 2"""
    t = text
    t = re.sub(r"(제\d+조)\(([^)]+)\)", r"\1, \2", t)
    t = re.sub(r"제(\d+)조의(\d+)", r"제\1조의 \2", t)
    return t


# ---------------------------------------------------------------------------
# 블록 단위 변환
# ---------------------------------------------------------------------------

HEADER_MAP = {
    1: "챕터",
    2: "대단원",
    3: "소절",
    4: "세부 항목",
}


def block_to_narration(block: str) -> str:
    """단일 마크다운 블록을 청취용 원고로 변환."""
    stripped = block.strip()

    # 헤더
    m = re.match(r"^(#{1,4})\s+(.+)$", stripped)
    if m:
        level = len(m.group(1))
        title = clean_inline(m.group(2))
        title = circled_to_korean(title)
        title = polish_law_refs(title)
        # "CHAPTER 01. XXX" → "제1장. XXX"
        title = re.sub(r"^CHAPTER\s*0?(\d+)\.\s*", r"제\1장. ", title, flags=re.IGNORECASE)
        if level == 1:
            return f"\n{title}\n"
        return f"\n{title}\n"

    # 코드블록
    if stripped.startswith("```"):
        return "다음 내용은 개념 도식입니다. 교재를 함께 참고하세요."

    # 표
    if stripped.startswith("|"):
        return table_to_narration(stripped)

    # 구분선
    if stripped in ("---", "***", "___"):
        return ""

    # 리스트 블록 (여러 줄이 - 또는 • 로 시작)
    lines = [l for l in stripped.split("\n") if l.strip()]
    if lines and all(re.match(r"^\s*[-•*]\s+", l) for l in lines):
        items = [clean_inline(l) for l in lines]
        items = [circled_to_korean(i) for i in items]
        if len(items) == 1:
            return items[0]
        joined = ",\n".join(items[:-1]) + ",\n그리고 " + items[-1]
        return f"다음 항목들이 있습니다.\n{joined}."

    # 일반 문단
    t = clean_inline(stripped)
    t = circled_to_korean(t)
    t = polish_law_refs(t)
    return t


# ---------------------------------------------------------------------------
# 공개 API
# ---------------------------------------------------------------------------

INTRO_TEMPLATE = "이번 장에서는 {title}에 대해 알아보겠습니다."
OUTRO_TEMPLATE = "이상으로 {title} 장의 내용을 마치겠습니다."


def polish_chunk(chunk: Chunk, is_first: bool = False, is_last: bool = False) -> str:
    """
    Chunk 하나를 청취용 원고 텍스트로 변환.
    첫 청크에는 도입 멘트, 마지막 청크에는 마무리 멘트를 추가한다.
    """
    parts: List[str] = []

    if is_first:
        title = re.sub(r"^CHAPTER\s*0?(\d+)\.\s*", r"제\1장, ", chunk.chapter_title, flags=re.IGNORECASE)
        parts.append(INTRO_TEMPLATE.format(title=title))

    for block in chunk.text.split("\n\n"):
        narration = block_to_narration(block)
        if narration:
            parts.append(narration)

    if is_last:
        title = re.sub(r"^CHAPTER\s*0?(\d+)\.\s*", r"제\1장", chunk.chapter_title, flags=re.IGNORECASE)
        parts.append(OUTRO_TEMPLATE.format(title=title))

    # 문장 사이 자연스러운 pause를 위해 빈 줄 유지
    text = "\n\n".join(parts)
    # 3줄 이상 연속 빈 줄 정리
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def polish_chapter(chapter, include_intro_outro: bool = True) -> List[str]:
    """
    Chapter의 모든 Chunk를 청취용 원고 리스트로 변환.
    반환값[i]는 chapter.chunks[i]에 대응.
    """
    results: List[str] = []
    n = len(chapter.chunks)
    for i, chunk in enumerate(chapter.chunks):
        results.append(polish_chunk(
            chunk,
            is_first=(include_intro_outro and i == 0),
            is_last=(include_intro_outro and i == n - 1),
        ))
    return results


# ---------------------------------------------------------------------------
# CLI (단독 테스트)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    from pathlib import Path
    from md_chunker import chunk_markdown_file

    # Windows cp949 콘솔에서도 유니코드(아래첨자 ₅ 등) 출력 가능하도록 UTF-8 강제
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    if len(sys.argv) < 2:
        print("사용법: python script_polisher.py <md파일경로> [챕터번호]")
        sys.exit(1)

    chapter = chunk_markdown_file(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 1)
    scripts = polish_chapter(chapter)
    print(f"=== {chapter.title} | 청크 {len(scripts)}개 ===\n")
    for i, s in enumerate(scripts, 1):
        print(f"----- 청크 {i} ({len(s)}자) -----")
        print(s[:500] + ("..." if len(s) > 500 else ""))
        print()
