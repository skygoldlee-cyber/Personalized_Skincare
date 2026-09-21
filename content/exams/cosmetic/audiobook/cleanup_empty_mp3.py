# -*- coding: utf-8 -*-
"""
cleanup_empty_mp3.py
====================
0 bytes 또는 손상된 MP3 파일을 찾아 삭제하는 스크립트.
gTTS 생성 중 중단되어 빈 파일이 남은 경우 정리용.

실행:
    python audiobook/cleanup_empty_mp3.py          # 확인만
    python audiobook/cleanup_empty_mp3.py --delete  # 실제 삭제
"""

import argparse
from pathlib import Path


def find_empty_mp3s(root: Path) -> list[Path]:
    """0 bytes MP3 파일을 재귀적으로 찾기."""
    empty = []
    for mp3 in root.rglob("*.mp3"):
        if mp3.stat().st_size == 0:
            empty.append(mp3)
    return empty


def main():
    ap = argparse.ArgumentParser(description="0 bytes MP3 파일 정리")
    ap.add_argument("--delete", action="store_true", help="실제 삭제 (기본: 확인만)")
    args = ap.parse_args()

    root = Path(__file__).parent / "mp3"
    empty = find_empty_mp3s(root)

    if not empty:
        print("0 bytes MP3 파일이 없습니다.")
        return 0

    print(f"0 bytes MP3 파일 {len(empty)}개 발견:")
    for f in empty:
        rel = f.relative_to(root)
        print(f"  {rel}")

    if args.delete:
        for f in empty:
            f.unlink()
        print(f"\n{len(empty)}개 파일 삭제 완료.")
    else:
        print(f"\n삭제하려면 --delete 옵션을 추가하세요.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
