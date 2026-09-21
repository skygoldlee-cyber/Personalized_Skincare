# -*- coding: utf-8 -*-
"""
test_gtts_mp3.py
================
gTTS(묣 Google TTS)를 사용해 실제 교재 MD → 청킹 → 원고 정제 → MP3 생성 → 병합
전체 파이프라인을 테스트하는 스크립트.

실행:
    python audiobook/test_gtts_mp3.py                    # manufacturing ch01 첫 3청크
    python audiobook/test_gtts_mp3.py --all              # manufacturing ch01 전체
    python audiobook/test_gtts_mp3.py --chapter 2        # manufacturing ch02 전체
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# audiobook/ 디렉터리를 import 경로에 추가
AUDIOBOOK_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = AUDIOBOOK_DIR.parent.parent
sys.path.insert(0, str(AUDIOBOOK_DIR))

from md_chunker import chunk_markdown_file
from script_polisher import polish_chapter
from mp3_merger import merge_mp3_files

from gtts import gTTS


# ---------------------------------------------------------------------------
# 설정
# ---------------------------------------------------------------------------

SUBJECT_DIR = PROJECT_ROOT / "content/manufacturing"
OUTPUT_DIR = AUDIOBOOK_DIR / "mp3" / "test_gtts"
GTTS_LANG = "ko"
GTTS_SLOW = False
MAX_CHUNKS_DEFAULT = 3  # 기본은 처음 3청크만 (빠른 테스트)


def synthesize_gtts(text: str, out_path: Path, lang: str = GTTS_LANG) -> Path:
    """gTTS로 텍스트를 MP3로 변환."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tts = gTTS(text=text, lang=lang, slow=GTTS_SLOW)
    tts.save(str(out_path))
    size_kb = out_path.stat().st_size // 1024
    print(f"  [gTTS] {out_path.name} ({size_kb:,} KB)")
    return out_path


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser(description="gTTS 테스트 MP3 생성")
    ap.add_argument("--chapter", type=int, default=1, help="챕터 번호 (기본: 1)")
    ap.add_argument("--all", action="store_true", help="전체 청크 변환 (기본: 처음 3개)")
    ap.add_argument("--max-chunks", type=int, default=MAX_CHUNKS_DEFAULT,
                    help=f"변환할 최대 청크 수 (기본: {MAX_CHUNKS_DEFAULT})")
    args = ap.parse_args()

    # MD 파일 찾기
    md_files = sorted(SUBJECT_DIR.glob(f"{args.chapter}.*.md"))
    if not md_files:
        print(f"[오류] 챕터 {args.chapter} MD 파일을 찾을 수 없습니다: {SUBJECT_DIR}")
        return 1

    md_path = md_files[0]
    print(f"{'='*60}")
    print(f"  gTTS 테스트 MP3 생성")
    print(f"  대상: {md_path.name}")
    print(f"{'='*60}")

    # [1] 청킹
    print(f"\n[1/4] MD 청킹 중...")
    chapter = chunk_markdown_file(md_path, chapter_no=args.chapter)
    total_chars = sum(len(c.text) for c in chapter.chunks)
    print(f"  → {len(chapter.chunks)}개 청크 / 총 {total_chars:,}자")
    for c in chapter.chunks:
        print(f"    {c.chunk_id}  [{len(c.text):>5}자]  {c.section_title[:40]}")

    # [2] 원고 정제
    print(f"\n[2/4] 청취용 원고 정제 중...")
    scripts = polish_chapter(chapter)
    script_chars = sum(len(s) for s in scripts)
    print(f"  → {script_chars:,}자 원고 생성")

    # 변환할 청크 수 제한
    if not args.all:
        max_n = min(args.max_chunks, len(scripts))
        print(f"  ※ 테스트 모드: 처음 {max_n}개 청크만 변환 (--all로 전체 변환)")
        scripts_to_use = scripts[:max_n]
        chunks_to_use = chapter.chunks[:max_n]
    else:
        scripts_to_use = scripts
        chunks_to_use = chapter.chunks

    # [3] gTTS 변환
    print(f"\n[3/4] gTTS 음성 합성 중... ({len(scripts_to_use)}개 청크)")
    chunk_dir = OUTPUT_DIR / f"ch{args.chapter:02d}_chunks"
    mp3_paths: list[Path] = []

    for i, (chunk, script) in enumerate(zip(chunks_to_use, scripts_to_use), 1):
        if not script.strip():
            print(f"  [skip] {chunk.chunk_id} — 빈 원고")
            continue

        out_path = chunk_dir / f"{chunk.chunk_id}.mp3"
        print(f"  [{i}/{len(scripts_to_use)}] {chunk.chunk_id} ({len(script):,}자)")

        try:
            synthesize_gtts(script, out_path)
            mp3_paths.append(out_path)
            # gTTS rate limit 방지
            if i < len(scripts_to_use):
                time.sleep(1)
        except Exception as e:
            print(f"  [실패] {chunk.chunk_id}: {e}")

    if not mp3_paths:
        print("\n[오류] 생성된 MP3가 없습니다.")
        return 1

    # [4] MP3 병합
    print(f"\n[4/4] MP3 병합 중... ({len(mp3_paths)}개 파일)")
    merged_path = OUTPUT_DIR / f"ch{args.chapter:02d}_test_audiobook.mp3"
    merge_mp3_files(mp3_paths, merged_path)

    # 결과 요약
    merged_size = merged_path.stat().st_size // 1024
    print(f"\n{'='*60}")
    print(f"  완료!")
    print(f"  청크 MP3: {chunk_dir}/ ({len(mp3_paths)}개)")
    print(f"  통합 MP3: {merged_path} ({merged_size:,} KB)")
    print(f"{'='*60}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
