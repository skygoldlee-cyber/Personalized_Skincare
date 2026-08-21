# -*- coding: utf-8 -*-
"""
md_chunker.py
=============
시험교재 Markdown 파일을 챕터/절 단위로 분할하는 모듈.

입력 MD 구조 가정 (2026 화장품 조제관리사 교재):
    # CHAPTER 01. 챕터 제목          <- H1 : 챕터
    ## 1. 대단원 제목                <- H2 : 섹션
    ### (1) 소절 제목                <- H3 : 절
    #### ① 세부 항목                 <- H4 : 항목

출력:
    Chunk 객체 리스트. 각 Chunk는 TTS 한 번 호출에 적합한 크기
    (기본 2,500자 이하)로 분할됨.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List


# ---------------------------------------------------------------------------
# 데이터 구조
# ---------------------------------------------------------------------------

@dataclass
class Chunk:
    """TTS 변환 단위 텍스트 블록."""
    chapter_no: int            # 챕터 번호 (1부터)
    chapter_title: str         # 챕터 제목
    section_title: str         # 현재 섹션(H2) 제목
    seq: int                   # 챕터 내 순번 (1부터)
    text: str                  # 원본 마크다운 텍스트

    @property
    def chunk_id(self) -> str:
        return f"ch{self.chapter_no:02d}_{self.seq:03d}"


@dataclass
class Chapter:
    chapter_no: int
    title: str
    chunks: List[Chunk] = field(default_factory=list)


# ---------------------------------------------------------------------------
# 상수
# ---------------------------------------------------------------------------

# ElevenLabs는 요청당 최대 5,000자까지 안정적.
# 안전 마진을 두고 2,500자를 기본 최대로 사용.
DEFAULT_MAX_CHARS = 2500

H1_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
H2_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)
H3_RE = re.compile(r"^###\s+(.+)$", re.MULTILINE)


# ---------------------------------------------------------------------------
# 핵심 로직
# ---------------------------------------------------------------------------

def split_markdown_into_blocks(md_text: str) -> List[str]:
    """
    마크다운을 '의미 블록' 리스트로 분할한다.
    블록 단위:
      - 표(| ... | 연속 행)는 하나의 블록
      - 코드블록(``` ... ```)은 하나의 블록
      - 빈 줄로 구분되는 문단/리스트는 하나의 블록
      - 헤더(#, ##, ###, ####)는 자체 블록
    """
    lines = md_text.split("\n")
    blocks: List[str] = []
    buf: List[str] = []
    in_code = False
    in_table = False

    def flush():
        nonlocal buf
        if buf:
            blocks.append("\n".join(buf).strip())
            buf = []

    for line in lines:
        stripped = line.strip()

        # 코드블록 토글
        if stripped.startswith("```"):
            if in_code:
                buf.append(line)
                flush()
                in_code = False
            else:
                flush()
                buf.append(line)
                in_code = True
            continue
        if in_code:
            buf.append(line)
            continue

        # 표 행
        is_table_row = stripped.startswith("|") and stripped.endswith("|")
        if is_table_row:
            buf.append(line)
            in_table = True
            continue
        else:
            if in_table:
                flush()
                in_table = False

        # 헤더는 독립 블록
        if re.match(r"^#{1,4}\s+", stripped):
            flush()
            blocks.append(stripped)
            continue

        # 빈 줄 → 블록 경계
        if stripped == "":
            flush()
            continue

        buf.append(line)

    flush()
    return [b for b in blocks if b]


def merge_blocks_into_chunks(
    blocks: List[str],
    chapter_no: int,
    chapter_title: str,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> List[Chunk]:
    """
    블록 리스트를 max_chars 이하의 Chunk로 묶는다.
    단일 블록이 max_chars를 넘으면 문장 단위로 추가 분할한다.
    """
    chunks: List[Chunk] = []
    cur_parts: List[str] = []
    cur_len = 0
    section_title = ""
    seq = 0

    def flush():
        nonlocal cur_parts, cur_len, seq
        if not cur_parts:
            return
        seq += 1
        chunks.append(Chunk(
            chapter_no=chapter_no,
            chapter_title=chapter_title,
            section_title=section_title,
            seq=seq,
            text="\n\n".join(cur_parts),
        ))
        cur_parts = []
        cur_len = 0

    for block in blocks:
        # 현재 섹션 추적 (H2 헤더)
        h2 = H2_RE.match(block)
        if h2:
            section_title = h2.group(1).strip()

        # 단일 블록이 너무 크면 문장 단위 분할
        if len(block) > max_chars:
            for piece in split_long_block(block, max_chars):
                if cur_len + len(piece) + 2 > max_chars and cur_parts:
                    flush()
                cur_parts.append(piece)
                cur_len += len(piece) + 2
            continue

        if cur_len + len(block) + 2 > max_chars and cur_parts:
            flush()

        cur_parts.append(block)
        cur_len += len(block) + 2

    flush()
    return chunks


def split_long_block(block: str, max_chars: int) -> List[str]:
    """max_chars를 초과하는 단일 블록을 문장/줄 단위로 분할."""
    # 표인 경우 행 단위로 분할 (헤더+구분행 유지)
    lines = block.split("\n")
    if all(l.strip().startswith("|") for l in lines if l.strip()):
        header = lines[:2]  # 헤더 + 구분행
        rows = lines[2:]
        pieces: List[str] = []
        cur = header[:]
        cur_len = sum(len(l) for l in cur)
        for row in rows:
            if cur_len + len(row) + 1 > max_chars and len(cur) > 2:
                pieces.append("\n".join(cur))
                cur = header[:]
                cur_len = sum(len(l) for l in cur)
            cur.append(row)
            cur_len += len(row) + 1
        if len(cur) > 2:
            pieces.append("\n".join(cur))
        return pieces

    # 일반 텍스트: 문장 단위 분할
    sentences = re.split(r"(?<=[.!?다음함됨있음])\s+", block)
    pieces = []
    cur = ""
    for s in sentences:
        if len(cur) + len(s) + 1 > max_chars and cur:
            pieces.append(cur.strip())
            cur = s
        else:
            cur = (cur + " " + s) if cur else s
    if cur.strip():
        pieces.append(cur.strip())
    return pieces


def chunk_markdown_file(
    md_path: str | Path,
    chapter_no: int,
    max_chars: int = DEFAULT_MAX_CHARS,
) -> Chapter:
    """
    MD 파일 하나를 읽어 Chapter 객체(낶은 Chunk 리스트 포함)로 변환.
    """
    md_path = Path(md_path)
    text = md_path.read_text(encoding="utf-8")

    # H1에서 챕터 제목 추출
    h1 = H1_RE.search(text)
    chapter_title = h1.group(1).strip() if h1 else md_path.stem

    blocks = split_markdown_into_blocks(text)
    chunks = merge_blocks_into_chunks(blocks, chapter_no, chapter_title, max_chars)

    return Chapter(chapter_no=chapter_no, title=chapter_title, chunks=chunks)


def save_chunks_as_files(chapter: Chapter, out_dir: str | Path) -> List[Path]:
    """
    챕터의 Chunk들을 개별 .md 파일로 저장 (검수/디버깅용).
    파일명: ch01_001.md, ch01_002.md, ...
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: List[Path] = []
    for chunk in chapter.chunks:
        p = out_dir / f"{chunk.chunk_id}.md"
        p.write_text(chunk.text, encoding="utf-8")
        paths.append(p)
    return paths


# ---------------------------------------------------------------------------
# CLI (단독 테스트용)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    # Windows cp949 콘솔 한글/유니코드 출력 대응
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    if len(sys.argv) < 2:
        print("사용법: python md_chunker.py <md파일경로> [챕터번호] [최대글자수]")
        sys.exit(1)

    path = sys.argv[1]
    ch_no = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    max_c = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_MAX_CHARS

    chapter = chunk_markdown_file(path, ch_no, max_c)
    total = sum(len(c.text) for c in chapter.chunks)
    print(f"챕터: {chapter.title}")
    print(f"청크 수: {len(chapter.chunks)}개 / 총 {total:,}자")
    for c in chapter.chunks:
        print(f"  {c.chunk_id}  [{len(c.text):>5}자]  {c.section_title[:30]}")
