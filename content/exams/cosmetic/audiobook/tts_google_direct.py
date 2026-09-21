# -*- coding: utf-8 -*-
"""
tts_google_direct.py
====================
Google Translate TTS의 구형 translate_tts GET 엔드포인트를 직접 호출하여
MP3를 생성하는 모듈. gTTS 라이브러리의 RPC(batchexecute) 방식이 Google 봇 탐지에
차단되는 문제를 우회한다.

주의: 비공식 엔드포인트이므로 Google 정책 변경 시 동작하지 않을 수 있음.
"""

from __future__ import annotations

import time
from pathlib import Path

import requests

TTS_URL = "https://translate.google.com/translate_tts"
MAX_CHARS = 180  # 엔드포인트가 한 번에 처리 가능한 문자 수 (안전 마진)

HEADERS = {
    "Referer": "http://translate.google.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
}


def _split_text(text: str, max_chars: int = MAX_CHARS) -> list[str]:
    """문장 단위로 텍스트를 max_chars 이하로 분할."""
    import re

    # 문장 분리 (한국어/영어 문장 종결 부호)
    sentences = re.split(r"(?<=[.!?。！？])\s+|(?<=[다요음함니다습니다])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    parts: list[str] = []
    current = ""
    for s in sentences:
        if len(s) > max_chars:
            # 문장 자체가 너무 길면 강제 분할
            if current:
                parts.append(current)
                current = ""
            for i in range(0, len(s), max_chars):
                parts.append(s[i : i + max_chars])
            continue
        if len(current) + len(s) + 1 <= max_chars:
            current = f"{current} {s}".strip()
        else:
            if current:
                parts.append(current)
            current = s
    if current:
        parts.append(current)

    return parts if parts else [text[:max_chars]]


def synthesize_google_direct(
    text: str,
    out_path: Path,
    lang: str = "ko",
    max_retries: int = 5,
    retry_delay: float = 5.0,
) -> Path:
    """구형 translate_tts 엔드포인트로 텍스트를 MP3로 변환.

    긴 텍스트는 문장 단위로 분할하여 여러 번 요청 후 MP3 바이너리를 이어붙인다
    (MP3 프레임 구조상 단순 concat으로도 재생 가능).
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    parts = _split_text(text)
    mp3_chunks: list[bytes] = []

    for idx, part in enumerate(parts):
        params = {
            "ie": "UTF-8",
            "q": part,
            "tl": lang,
            "client": "tw-ob",
            "ttsspeed": "1",
            "total": "1",
            "idx": "0",
            "textlen": str(len(part)),
        }

        last_err: Exception | None = None
        for attempt in range(1, max_retries + 1):
            try:
                r = requests.get(TTS_URL, params=params, headers=HEADERS, timeout=30)
                if r.status_code == 200 and r.content:
                    mp3_chunks.append(r.content)
                    break
                if r.status_code == 429:
                    wait = retry_delay * (2 ** (attempt - 1))
                    print(f"429 retry {attempt}/{max_retries} ({wait:.0f}s)", end=" ", flush=True)
                    time.sleep(wait)
                    last_err = RuntimeError(f"HTTP 429 (시도 {attempt}/{max_retries})")
                    continue
                last_err = RuntimeError(f"HTTP {r.status_code}")
                time.sleep(retry_delay)
            except requests.RequestException as e:
                last_err = e
                time.sleep(retry_delay * attempt)
        else:
            raise RuntimeError(f"Google TTS 직접 호출 실패 (파트 {idx + 1}/{len(parts)}): {last_err}")

        # 파트 간 짧은 대기 (정중한 요청)
        if idx < len(parts) - 1:
            time.sleep(0.3)

    out_path.write_bytes(b"".join(mp3_chunks))
    return out_path


if __name__ == "__main__":
    import sys

    test_text = (
        "안녕하세요. 구글 TTS 직접 호출 테스트입니다. "
        "이 음성은 구글 트랜슬레이트의 음성 합성 엔진으로 생성되었습니다."
    )
    out = Path(__file__).resolve().parent / "mp3" / "_test_google_direct.mp3"
    synthesize_google_direct(test_text, out)
    print(f"생성 완료: {out} ({out.stat().st_size:,} bytes)")
