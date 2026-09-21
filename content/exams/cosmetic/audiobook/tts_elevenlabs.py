# -*- coding: utf-8 -*-
"""
tts_elevenlabs.py
=================
ElevenLabs API를 사용해 청취용 원고 텍스트를 MP3로 변환하는 모듈.

특징:
  - API 키는 환경변수 ELEVENLABS_API_KEY 에서 읽음
  - 청크별 개별 MP3 저장 → 중간에 실패하더라도 이어서 재개 가능
  - 이미 생성된 MP3는 건너뛰기(--resume)
  - 지수 백오프 재시도 (429/5xx 대응)
  - 한국어 강의식 음성에 적합한 기본 설정
    model: eleven_multilingual_v2
    stability: 0.5 / similarity_boost: 0.75 / style: 0.0 (감정 최소)
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional

try:
    from elevenlabs.client import ElevenLabs
    from elevenlabs import VoiceSettings
    _HAS_SDK = True
except ImportError:
    _HAS_SDK = False


# ---------------------------------------------------------------------------
# 설정
# ---------------------------------------------------------------------------

DEFAULT_MODEL_ID = "eleven_multilingual_v2"
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"
DEFAULT_VOICE_NAME = "Aria"          # 차분한 여성 강의식 (사용자 변경 권장)
MAX_RETRIES = 4
RETRY_BASE_DELAY = 3.0               # seconds (지수 백오프)


@dataclass
class TTSConfig:
    api_key: str
    voice_id: str
    model_id: str = DEFAULT_MODEL_ID
    output_format: str = DEFAULT_OUTPUT_FORMAT
    stability: float = 0.5
    similarity_boost: float = 0.75
    style: float = 0.0
    use_speaker_boost: bool = True


# ---------------------------------------------------------------------------
# 클라이언트
# ---------------------------------------------------------------------------

def get_api_key() -> str:
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "환경변수 ELEVENLABS_API_KEY가 설정되지 않았습니다.\n"
            "PowerShell:  $env:ELEVENLABS_API_KEY=\"여기에_키\""
        )
    return key


def make_client(api_key: Optional[str] = None) -> "ElevenLabs":
    if not _HAS_SDK:
        raise RuntimeError(
            "elevenlabs 패키지가 설치되지 않았습니다.\n"
            "설치: pip install elevenlabs"
        )
    return ElevenLabs(api_key=api_key or get_api_key())


def resolve_voice_id(client: "ElevenLabs", voice_name_or_id: str) -> str:
    """
    음성 이름(예: 'Aria')이 주어지면 ID로 변환.
    이미 ID 형식(20자 영숫자)이면 그대로 반환.
    """
    if re_full_voice_id(voice_name_or_id):
        return voice_name_or_id
    voices = client.voices.get_all()
    for v in voices.voices:
        if v.name.lower() == voice_name_or_id.lower():
            return v.voice_id
    available = ", ".join(v.name for v in voices.voices[:20])
    raise ValueError(
        f"음성 '{voice_name_or_id}'을(를) 찾을 수 없습니다.\n"
        f"사용 가능한 음성 일부: {available} ..."
    )


def re_full_voice_id(s: str) -> bool:
    import re
    return bool(re.fullmatch(r"[A-Za-z0-9]{20,}", s))


# ---------------------------------------------------------------------------
# TTS 변환
# ---------------------------------------------------------------------------

def text_to_mp3_bytes(client: "ElevenLabs", cfg: TTSConfig, text: str) -> Iterator[bytes]:
    """텍스트를 MP3 바이트 스트림으로 변환 (ElevenLabs SDK generator)."""
    return client.text_to_speech.convert(
        voice_id=cfg.voice_id,
        model_id=cfg.model_id,
        output_format=cfg.output_format,
        text=text,
        voice_settings=VoiceSettings(
            stability=cfg.stability,
            similarity_boost=cfg.similarity_boost,
            style=cfg.style,
            use_speaker_boost=cfg.use_speaker_boost,
        ),
    )


def synthesize_chunk_to_file(
    client: "ElevenLabs",
    cfg: TTSConfig,
    text: str,
    out_path: str | Path,
    resume: bool = True,
) -> Path:
    """
    단일 청크 텍스트를 MP3 파일로 저장.
    resume=True이고 파일이 이미 있으면 건너뛴다.
    재시도(지수 백오프) 내장.
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if resume and out_path.exists() and out_path.stat().st_size > 0:
        print(f"  [skip] 이미 존재: {out_path.name}")
        return out_path

    last_err: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            audio = text_to_mp3_bytes(client, cfg, text)
            with open(out_path, "wb") as f:
                for chunk in audio:
                    f.write(chunk)
            print(f"  [ok] {out_path.name} ({out_path.stat().st_size // 1024} KB)")
            return out_path
        except Exception as e:  # noqa: BLE001
            last_err = e
            delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
            print(f"  [retry {attempt}/{MAX_RETRIES}] {out_path.name}: {e} → {delay:.0f}초 후 재시도")
            time.sleep(delay)

    raise RuntimeError(f"TTS 변환 실패: {out_path.name} — {last_err}")


def synthesize_chapter(
    client: "ElevenLabs",
    cfg: TTSConfig,
    scripts: list[str],
    chunk_ids: list[str],
    out_dir: str | Path,
    resume: bool = True,
) -> list[Path]:
    """
    청취용 원고 리스트를 순서대로 MP3로 변환.
    반환값: 생성된 MP3 파일 경로 리스트 (순서 유지).
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for cid, script in zip(chunk_ids, scripts):
        if not script.strip():
            continue
        p = out_dir / f"{cid}.mp3"
        synthesize_chunk_to_file(client, cfg, script, p, resume=resume)
        paths.append(p)
    return paths


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("사용법: python tts_elevenlabs.py \"테스트할 한국어 문장\" [voice_id_or_name]")
        sys.exit(1)

    text = sys.argv[1]
    voice = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_VOICE_NAME

    client = make_client()
    vid = resolve_voice_id(client, voice)
    cfg = TTSConfig(api_key=get_api_key(), voice_id=vid)
    out = synthesize_chunk_to_file(client, cfg, text, "tts_test.mp3", resume=False)
    print(f"완료: {out.resolve()}")
