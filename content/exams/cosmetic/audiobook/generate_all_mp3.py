# -*- coding: utf-8 -*-
"""
generate_all_mp3.py
====================
4개 과목 전체 교재를 TTS로 MP3 오디오북으로 변환하는 배치 스크립트.

지원 TTS 엔진:
  - pyttsx3: Windows 내장 SAPI5 (오프라인, 레이트 리밋 없음, 한국어 지원)
  - gtts: gTTS 라이브러리 (온라인, 현재 Google 봇 탐지에 차단됨)
  - google: Google Translate TTS 직접 호출 (온라인, 자연스러운 음질, 비공식 엔드포인트)

실행:
    python content/audiobook/generate_all_mp3.py                  # 전체
    python content/audiobook/generate_all_mp3.py --subject law     # 특정 과목만
    python content/audiobook/generate_all_mp3.py --dry-run         # 처리 목록만 출력
    python content/audiobook/generate_all_mp3.py --merge-only     # 청크만 있고 병합 안 된 것 병합
    python content/audiobook/generate_all_mp3.py --engine google   # Google TTS 직접 호출
    python content/audiobook/generate_all_mp3.py --engine gtts     # gTTS 사용 (기본: pyttsx3)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

AUDIOBOOK_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = AUDIOBOOK_DIR.parent.parent
sys.path.insert(0, str(AUDIOBOOK_DIR))

from md_chunker import chunk_markdown_file
from script_polisher import polish_chapter
from mp3_merger import merge_mp3_files
from run_pipeline import scan_chapter_jobs, ChapterJob

try:
    import pyttsx3
    _HAS_PYTTSX3 = True
except ImportError:
    _HAS_PYTTSX3 = False

try:
    from gtts import gTTS
    _HAS_GTTS = True
except ImportError:
    _HAS_GTTS = False

try:
    from pydub import AudioSegment
    _HAS_PYDUB = True

    # ffmpeg 경로 명시적 설정 (PATH가 갱신되지 않은 셸에서도 동작하도록)
    import os as _os
    _ffmpeg_candidates = [
        _os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe"),
        r"C:\Users\sky\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    ]
    for _cand in _ffmpeg_candidates:
        if _os.path.isfile(_cand):
            AudioSegment.converter = _cand
            _os.environ["PATH"] = _os.path.dirname(_cand) + _os.pathsep + _os.environ.get("PATH", "")
            break
except ImportError:
    _HAS_PYDUB = False


# TTS 설정
TTS_ENGINE = "pyttsx3"  # "pyttsx3" 또는 "gtts"
GTTS_LANG = "ko"
GTTS_SLOW = False
RATE_LIMIT_DELAY = 3.0   # gTTS 호출 간 기본 대기 (초)
MAX_RETRIES = 5
RETRY_BASE_DELAY = 10.0  # 실패 시 대기 시작 (초)
PROGRESS_FILE = AUDIOBOOK_DIR / ".generation_progress.json"

# pyttsx3 설정
PYTTSX3_RATE = 150  # 말하기 속도 (기본값: 200, 한국어는 150이 적당)
PYTTSX3_VOLUME = 1.0


def load_progress() -> dict:
    """진행 상황 파일 로드."""
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"completed_chapters": [], "failed_chunks": {}}


def save_progress(progress: dict) -> None:
    """진행 상황 파일 저장."""
    try:
        PROGRESS_FILE.write_text(json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def synthesize_powershell(text: str, out_path: Path) -> Path:
    """PowerShell System.Speech를 사용하여 텍스트를 WAV로 변환 후 MP3로 변환."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    wav_path = out_path.with_suffix(".wav")

    # 기존 파일 정리
    for p in [wav_path, out_path]:
        if p.exists():
            try:
                p.unlink()
            except Exception:
                pass

    # PowerShell 스크립트로 WAV 생성
    ps_script = f'''
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -2
$synth.Volume = 100

# 한국어 음성 찾기
$voices = $synth.GetInstalledVoices() | Where-Object {{ $_.VoiceInfo.Culture.Name -like "ko*" }}
if ($voices) {{
    $synth.SelectVoice($voices[0].VoiceInfo.Name)
}}

$synth.SetOutputToWaveFile("{wav_path}")
$synth.Speak("{text.replace('"', '`"').replace('\n', ' ')}")
$synth.Dispose()
'''

    import subprocess
    result = subprocess.run(
        ["powershell", "-Command", ps_script],
        capture_output=True,
        text=True,
        timeout=60
    )

    if result.returncode != 0:
        raise RuntimeError(f"PowerShell TTS 실패: {result.stderr}")

    if not wav_path.exists() or wav_path.stat().st_size == 0:
        raise RuntimeError(f"WAV 파일이 생성되지 않았습니다: {wav_path}")

    # WAV → MP3 변환
    if _HAS_PYDUB:
        try:
            audio = AudioSegment.from_wav(str(wav_path))
            audio.export(str(out_path), format="mp3", bitrate="128k")
            wav_path.unlink()
        except Exception as e:
            print(f"[warn] MP3 변환 실패, WAV 유지: {e}")
            if out_path.exists():
                out_path.unlink()
            wav_path.rename(out_path)
    else:
        if out_path.exists():
            out_path.unlink()
        wav_path.rename(out_path)

    return out_path


def synthesize_pyttsx3(text: str, out_path: Path) -> Path:
    """pyttsx3로 텍스트를 MP3로 변환 (Windows SAPI5 사용)."""
    # pyttsx3는 파일 저장에 문제가 있어 PowerShell 방식으로 대체
    return synthesize_powershell(text, out_path)


def synthesize_gtts(text: str, out_path: Path) -> Path:
    """gTTS로 텍스트를 MP3로 변환. 429 에러 시 더 긴 대기."""
    if not _HAS_GTTS:
        raise RuntimeError("gtts 패키지가 설치되지 않았습니다. 설치: pip install gtts")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    last_err: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            tts = gTTS(text=text, lang=GTTS_LANG, slow=GTTS_SLOW)
            tts.save(str(out_path))
            return out_path
        except Exception as e:
            last_err = e
            err_str = str(e)
            if attempt < MAX_RETRIES:
                if "429" in err_str:
                    delay = RETRY_BASE_DELAY * (3 ** (attempt - 1))
                    print(f"rate-limit retry {attempt}/{MAX_RETRIES} ({delay:.0f}s)", end=" ", flush=True)
                else:
                    delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                    print(f"retry {attempt}/{MAX_RETRIES} ({delay:.0f}s)", end=" ", flush=True)
                time.sleep(delay)
            else:
                raise

    raise RuntimeError(f"gTTS 실패: {last_err}")


def synthesize_google(text: str, out_path: Path) -> Path:
    """Google Translate TTS 직접 호출로 텍스트를 MP3로 변환."""
    from tts_google_direct import synthesize_google_direct

    return synthesize_google_direct(text, out_path, lang=GTTS_LANG)


def synthesize_text(text: str, out_path: Path) -> Path:
    """설정된 TTS 엔진으로 텍스트를 MP3로 변환."""
    if TTS_ENGINE == "pyttsx3":
        return synthesize_pyttsx3(text, out_path)
    elif TTS_ENGINE == "google":
        return synthesize_google(text, out_path)
    else:
        return synthesize_gtts(text, out_path)


def process_chapter(job: ChapterJob, output_root: Path, progress: dict) -> Path | None:
    """챕터 1개를 MD → 청킹 → 정제 → TTS → 병합."""
    chapter_key = f"{job.subject_key}/ch{job.chapter_no:02d}"

    # [1] 청킹
    chapter = chunk_markdown_file(job.md_path, job.chapter_no)
    total_chars = sum(len(c.text) for c in chapter.chunks)
    print(f"  청킹: {len(chapter.chunks)}개 청크 / {total_chars:,}자")

    # [2] 원고 정제
    scripts = polish_chapter(chapter)
    script_chars = sum(len(s) for s in scripts)
    print(f"  원고: {script_chars:,}자")

    # [3] TTS 변환
    chunk_dir = output_root / job.subject_key / f"ch{job.chapter_no:02d}_chunks"
    mp3_paths: list[Path] = []
    fail_count = 0
    failed_chunk_ids: list[str] = []

    for i, (chunk, script) in enumerate(zip(chapter.chunks, scripts), 1):
        if not script.strip():
            continue
        out_path = chunk_dir / f"{chunk.chunk_id}.mp3"

        # 이미 생성된 파일 건너뛰기 (0 bytes 파일은 재생성)
        if out_path.exists():
            size = out_path.stat().st_size
            if size > 0:
                size_kb = size // 1024
                print(f"  [{i}/{len(chapter.chunks)}] {chunk.chunk_id} (skip, {size_kb:,} KB)")
                mp3_paths.append(out_path)
                continue
            else:
                print(f"  [{i}/{len(chapter.chunks)}] {chunk.chunk_id} (0 bytes, 재생성)")
                out_path.unlink()

        print(f"  [{i}/{len(chapter.chunks)}] {chunk.chunk_id} ({len(script):,}자) ...", end=" ", flush=True)
        try:
            synthesize_text(script, out_path)
            size_kb = out_path.stat().st_size // 1024
            print(f"OK ({size_kb:,} KB)")
            mp3_paths.append(out_path)
            if i < len(chapter.chunks) and TTS_ENGINE == "gtts":
                time.sleep(RATE_LIMIT_DELAY)
        except Exception as e:
            fail_count += 1
            failed_chunk_ids.append(chunk.chunk_id)
            print(f"FAIL: {e}")

    # 실패한 청크 기록
    if failed_chunk_ids:
        progress["failed_chunks"][chapter_key] = failed_chunk_ids
        save_progress(progress)

    if not mp3_paths:
        print(f"  [오류] 생성된 MP3 없음")
        return None

    # [4] 병합
    merged_path = output_root / job.subject_key / f"ch{job.chapter_no:02d}_{job.slug}.mp3"
    merge_mp3_files(mp3_paths, merged_path)

    if fail_count:
        print(f"  ※ {fail_count}개 청크 실패 (재실행하면 이어서 가능)")
    else:
        # 성공 시 이전 실패 기록 정리
        if chapter_key in progress.get("failed_chunks", {}):
            del progress["failed_chunks"][chapter_key]
        if chapter_key not in progress["completed_chapters"]:
            progress["completed_chapters"].append(chapter_key)
        save_progress(progress)

    return merged_path


def merge_existing_chunks(job: ChapterJob, output_root: Path) -> Path | None:
    """이미 생성된 청크 MP3들만 병합 (TTS 재생성 없이). 0 bytes 파일은 제외."""
    chunk_dir = output_root / job.subject_key / f"ch{job.chapter_no:02d}_chunks"
    if not chunk_dir.exists():
        return None

    all_chunks = sorted(chunk_dir.glob("*.mp3"), key=lambda p: int(p.stem.split("_")[-1]))
    chunk_files = [p for p in all_chunks if p.stat().st_size > 0]

    if not chunk_files:
        if all_chunks:
            print(f"  [warn] 청크 {len(all_chunks)}개 모두 0 bytes")
        return None

    skipped = len(all_chunks) - len(chunk_files)
    if skipped > 0:
        print(f"  [warn] 0 bytes 청크 {skipped}개 제외됨")

    merged_path = output_root / job.subject_key / f"ch{job.chapter_no:02d}_{job.slug}.mp3"
    if merged_path.exists() and merged_path.stat().st_size > 0:
        print(f"  [skip] 이미 병합됨: {merged_path.name}")
        return merged_path

    print(f"  청크 {len(chunk_files)}개 발견 → 병합 중...")
    merge_mp3_files(chunk_files, merged_path)
    return merged_path


def main() -> int:
    global RATE_LIMIT_DELAY, TTS_ENGINE

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser(description="전체 교재 → TTS MP3 오디오북 생성")
    ap.add_argument("--subject", choices=["understanding", "safety", "manufacturing", "law"],
                    help="특정 과목만 처리")
    ap.add_argument("--chapter", type=int, help="특정 챕터만 처리")
    ap.add_argument("--dry-run", action="store_true", help="처리 목록만 출력")
    ap.add_argument("--delay", type=float, default=RATE_LIMIT_DELAY,
                    help=f"gTTS 호출 간 대기 시간 (기본: {RATE_LIMIT_DELAY}초)")
    ap.add_argument("--merge-only", action="store_true",
                    help="TTS 생성 없이 이미 있는 청크들만 병합")
    ap.add_argument("--engine", choices=["pyttsx3", "gtts", "google"], default=TTS_ENGINE,
                    help=f"TTS 엔진 선택 (기본: {TTS_ENGINE})")
    args = ap.parse_args()

    RATE_LIMIT_DELAY = args.delay
    TTS_ENGINE = args.engine

    # TTS 엔진 확인
    if TTS_ENGINE == "pyttsx3" and not _HAS_PYTTSX3:
        print("[오류] pyttsx3가 설치되지 않았습니다.")
        print("설치: pip install pyttsx3")
        return 1
    if TTS_ENGINE == "gtts" and not _HAS_GTTS:
        print("[오류] gtts가 설치되지 않았습니다.")
        print("설치: pip install gtts")
        return 1

    jobs = scan_chapter_jobs(args.subject, args.chapter)
    if not jobs:
        print("처리할 MD 파일이 없습니다.")
        return 1

    # 전체 규모 출력
    total_size = sum(j.md_path.stat().st_size for j in jobs)
    print(f"{'='*60}")
    print(f"  전체 교재 → {TTS_ENGINE.upper()} MP3 오디오북 생성")
    print(f"  대상: {len(jobs)}개 챕터 / 총 {total_size/1024:.0f} KB")
    if args.merge_only:
        print(f"  모드: 청크 병합만 (TTS 재생성 없음)")
    print(f"{'='*60}")
    for j in jobs:
        size = j.md_path.stat().st_size
        print(f"  [{j.subject_key:15s}] ch{j.chapter_no:02d}  {size/1024:>5.0f} KB  {j.md_path.name}")

    if args.dry_run:
        print("\n--dry-run 모드: 실제 변환은 수행하지 않습니다.")
        return 0

    output_root = AUDIOBOOK_DIR / "mp3"
    progress = load_progress()
    ok, fail, skipped = 0, 0, 0
    start_time = time.time()

    for idx, job in enumerate(jobs, 1):
        chapter_key = f"{job.subject_key}/ch{job.chapter_no:02d}"

        print(f"\n{'='*60}")
        print(f"[{idx}/{len(jobs)}] {job.subject_name} — 제{job.chapter_no}장")
        print(f"  파일: {job.md_path.name}")
        print(f"{'='*60}")

        # --merge-only 모드: 병합만 수행
        if args.merge_only:
            merged = merge_existing_chunks(job, output_root)
            if merged:
                size_kb = merged.stat().st_size // 1024
                print(f"  → {merged.name} ({size_kb:,} KB)")
                ok += 1
            else:
                skipped += 1
                print(f"  [skip] 병합할 청크 없음")
            continue

        # 이미 완료된 챕터 건너뛰기
        merged_path = output_root / job.subject_key / f"ch{job.chapter_no:02d}_{job.slug}.mp3"
        if merged_path.exists() and merged_path.stat().st_size > 0:
            size_kb = merged_path.stat().st_size // 1024
            print(f"  [skip] 이미 완료됨 ({size_kb:,} KB)")
            skipped += 1
            continue

        try:
            merged = process_chapter(job, output_root, progress)
            if merged:
                size_kb = merged.stat().st_size // 1024
                print(f"  → {merged.name} ({size_kb:,} KB)")
                ok += 1
            else:
                fail += 1
        except KeyboardInterrupt:
            print(f"\n\n중단됨. 진행: {ok}개 성공 / {fail}개 실패 / {skipped}개 건너뜀")
            print("이어서 실행: 같은 명령을 다시 실행하면 생성된 청크는 건너뜀")
            print(f"진행 상황 파일: {PROGRESS_FILE}")
            return 130
        except Exception as e:
            fail += 1
            print(f"  [실패] {e}")

    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)

    print(f"\n{'='*60}")
    print(f"  전체 완료: 성공 {ok}개 / 실패 {fail}개 / 건너뜀 {skipped}개")
    print(f"  소요 시간: {minutes}분 {seconds}초")
    print(f"  출력 위치: {output_root}/")
    if progress["failed_chunks"]:
        print(f"  실패한 청크: {len(progress['failed_chunks'])}개 챕터")
        print(f"  (자세한 내용: {PROGRESS_FILE})")
    print(f"{'='*60}")

    return 0 if fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
