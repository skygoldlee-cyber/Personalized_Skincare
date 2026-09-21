# -*- coding: utf-8 -*-
"""
mp3_merger.py
=============
챕터별 개별 MP3 파일들을 하나의 MP3로 병합하는 모듈.

병합 방식 (우선순위):
  1. ffmpeg이 설치되어 있으면 → 무손실 concat (가장 깨끗)
  2. pydub + ffmpeg → 동일
  3. ffmpeg이 없으면 → 순수 Python 바이너리 concat
     (MP3 프레임 구조상 대부분의 플레이어에서 재생 가능.
      완벽한 병합을 원하면 ffmpeg 설치 권장)
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List


def _ensure_ffmpeg_on_path() -> None:
    """PATH가 갱신되지 않은 셸에서도 ffmpeg을 찾을 수 있도록 경로 추가."""
    if shutil.which("ffmpeg"):
        return
    candidates = [
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Links"),
        r"C:\Users\sky\AppData\Local\Microsoft\WinGet\Links",
        r"C:\ffmpeg\bin",
        r"C:\Program Files\ffmpeg\bin",
    ]
    for cand in candidates:
        if os.path.isfile(os.path.join(cand, "ffmpeg.exe")):
            os.environ["PATH"] = cand + os.pathsep + os.environ.get("PATH", "")
            return


_ensure_ffmpeg_on_path()


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def merge_mp3_files(
    mp3_paths: List[str | Path],
    out_path: str | Path,
    silence_ms: int = 700,
) -> Path:
    """
    MP3 파일 리스트를 순서대로 하나로 병합.
    silence_ms: 청크 사이에 삽입할 무음 (밀리초). ffmpeg/pydub 경로에서만 적용.
    """
    mp3_paths = [Path(p) for p in mp3_paths]
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if not mp3_paths:
        raise ValueError("병합할 MP3 파일이 없습니다.")

    if has_ffmpeg():
        _merge_with_ffmpeg(mp3_paths, out_path, silence_ms)
    else:
        print("[warn] ffmpeg을 찾을 수 없어 단순 바이너리 concat으로 병합합니다.")
        print("       더 깨끗한 결과를 원하면 https://ffmpeg.org 에서 설치하세요.")
        _merge_binary_concat(mp3_paths, out_path)

    size_kb = out_path.stat().st_size // 1024
    print(f"[merge] {out_path.name} ({size_kb:,} KB, {len(mp3_paths)}개 파일 병합)")
    return out_path


def _merge_with_ffmpeg(mp3_paths: List[Path], out_path: Path, silence_ms: int) -> None:
    """ffmpeg concat demuxer + 선택적 무음 삽입."""
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        list_file = tmpdir / "concat.txt"

        if silence_ms > 0:
            # 무음 MP3 생성
            silence_file = tmpdir / "silence.mp3"
            subprocess.run(
                [
                    "ffmpeg", "-y", "-f", "lavfi",
                    "-i", "anullsrc=r=44100:cl=mono",
                    "-t", f"{silence_ms / 1000:.3f}",
                    "-q:a", "9", "-acodec", "libmp3lame",
                    str(silence_file),
                ],
                check=True, capture_output=True,
            )
            entries = []
            for i, p in enumerate(mp3_paths):
                entries.append(f"file '{p.resolve().as_posix()}'")
                if i < len(mp3_paths) - 1:
                    entries.append(f"file '{silence_file.resolve().as_posix()}'")
            list_file.write_text("\n".join(entries), encoding="utf-8")
        else:
            list_file.write_text(
                "\n".join(f"file '{p.resolve().as_posix()}'" for p in mp3_paths),
                encoding="utf-8",
            )

        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", str(list_file),
                "-c", "copy",
                str(out_path),
            ],
            check=True, capture_output=True,
        )


def _merge_binary_concat(mp3_paths: List[Path], out_path: Path) -> None:
    """ffmpeg이 없을 때의 최후 수단: 바이너리 이어붙이기."""
    with open(out_path, "wb") as out:
        for p in mp3_paths:
            out.write(p.read_bytes())


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("사용법: python mp3_merger.py <출력.mp3> <입력1.mp3> <입력2.mp3> ...")
        sys.exit(1)

    merge_mp3_files(sys.argv[2:], sys.argv[1])
