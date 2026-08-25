# -*- coding: utf-8 -*-
"""
run_pipeline.py
===============
MD 교재 → 청취용 원고 → (선택) ElevenLabs TTS → 챕터별 MP3 통합
전체 파이프라인 오케스트레이션 CLI.

파이프라인 단계:
    [1] MD 스캔      : 4개 과목 폴터에서 .md 파일 수집
    [2] 청킹         : md_chunker.chunk_markdown_file (≤2,500자)
    [3] 원고 정제    : script_polisher.polish_chapter → audiobook/scripts/
    [4] TTS (선택)   : tts_elevenlabs.synthesize_chapter → audiobook/mp3/<과목>/<챕터>/
    [5] MP3 병합     : mp3_merger.merge_mp3_files → audiobook/mp3/<과목>/chXX_제목.mp3

사용 예:
    # 원고만 생성 (API 키 불필요, 물료)
    python run_pipeline.py --polish-only

    # 특정 과목/챕터만
    python run_pipeline.py --subject manufacturing --chapter 1

    # TTS까지 전체 실행 (ELEVENLABS_API_KEY 필요)
    python run_pipeline.py --tts

    # 중단 후 이어서
    python run_pipeline.py --tts --resume
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

# 같은 디렉터리의 모듈 임포트 (스크립트 직접 실행 대비)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from md_chunker import (  # noqa: E402
    DEFAULT_MAX_CHARS,
    Chapter,
    chunk_markdown_file,
    save_chunks_as_files,
)
from script_polisher import polish_chapter  # noqa: E402


# ---------------------------------------------------------------------------
# 상수 / 설정
# ---------------------------------------------------------------------------

# 프로젝트 루트 = content/audiobook/ 의 2단계 상위 디렉터리 (작업공간 루트)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# 과목 키 → (MD 폴터명, 출력용 한글 과목명)
SUBJECT_DIRS = {
    "understanding":  ("content/understanding", "맞춤형화장품의 이해"),
    "safety":         ("content/safety", "유통화장품 안전관리"),
    "manufacturing":  ("content/manufacturing", "화장품 제조 및 품질관리"),
    "law":            ("content/law", "화장품법의 이해"),
}

# 출력 디렉터리
SCRIPTS_DIR = PROJECT_ROOT / "content" / "audiobook" / "scripts"   # 청취용 원고 (.txt)
CHUNKS_DIR  = PROJECT_ROOT / "content" / "audiobook" / "chunks"    # 원본 청크 (.md, 검수용)
MP3_DIR     = PROJECT_ROOT / "content" / "audiobook" / "mp3"       # MP3 출력


@dataclass
class ChapterJob:
    """파이프라인 처리 단위: MD 파일 1개 = 챕터 1개."""
    subject_key: str
    subject_name: str
    md_path: Path
    chapter_no: int          # 파일명 앞 숫자 (1, 2, 3 ...)
    slug: str                # 출력 디렉터리명용 안전 문자열


# ---------------------------------------------------------------------------
# MD 파일 스캔
# ---------------------------------------------------------------------------

MD_FILE_RE = re.compile(r"^(\d+)\..*\.md$")


def scan_chapter_jobs(subject_filter: Optional[str] = None,
                      chapter_filter: Optional[int] = None) -> List[ChapterJob]:
    """4개 과목 폴터에서 MD 파일 목록을 수집해 ChapterJob 리스트로 반환."""
    jobs: List[ChapterJob] = []
    for key, (dirname, subject_name) in SUBJECT_DIRS.items():
        if subject_filter and key != subject_filter:
            continue
        folder = PROJECT_ROOT / dirname
        if not folder.is_dir():
            print(f"[warn] 폴터 없음: {folder}")
            continue
        for md in sorted(folder.glob("*.md")):
            m = MD_FILE_RE.match(md.name)
            if not m:
                continue
            ch_no = int(m.group(1))
            if chapter_filter and ch_no != chapter_filter:
                continue
            # 출력 경로용 slug: 파일명에서 확장자/공백/특수문자 정리
            slug = re.sub(r"[^\w가-힣]+", "_", md.stem).strip("_")[:40]
            jobs.append(ChapterJob(
                subject_key=key,
                subject_name=subject_name,
                md_path=md,
                chapter_no=ch_no,
                slug=slug,
            ))
    # 과목 순서(SUBJECT_DIRS 선언 순서) → 챕터 번호 순
    order = {k: i for i, k in enumerate(SUBJECT_DIRS)}
    jobs.sort(key=lambda j: (order[j.subject_key], j.chapter_no))
    return jobs


# ---------------------------------------------------------------------------
# 단계별 실행 함수
# ---------------------------------------------------------------------------

def step_chunk(job: ChapterJob, max_chars: int) -> Chapter:
    """[2] MD → Chapter(Chunk 리스트). 검수용 원본 청크도 저장."""
    chapter = chunk_markdown_file(job.md_path, job.chapter_no, max_chars)
    save_chunks_as_files(chapter, CHUNKS_DIR / job.subject_key / f"ch{job.chapter_no:02d}")
    return chapter


def step_polish(job: ChapterJob, chapter: Chapter) -> List[str]:
    """[3] Chapter → 청취용 원고 문자열 리스트. audiobook/scripts/에 저장."""
    scripts = polish_chapter(chapter, include_intro_outro=True)
    out_dir = SCRIPTS_DIR / job.subject_key
    out_dir.mkdir(parents=True, exist_ok=True)
    for chunk, script in zip(chapter.chunks, scripts):
        (out_dir / f"{chunk.chunk_id}.txt").write_text(script, encoding="utf-8")
    return scripts


def step_tts(job: ChapterJob, chapter: Chapter, scripts: List[str],
             voice: str, resume: bool) -> List[Path]:
    """[4] 원고 → 청크별 MP3 (ElevenLabs). 지연 임포트로 --polish-only 시 SDK 불필요."""
    from tts_elevenlabs import (
        TTSConfig, get_api_key, make_client, resolve_voice_id, synthesize_chapter,
    )
    client = make_client()
    voice_id = resolve_voice_id(client, voice)
    cfg = TTSConfig(api_key=get_api_key(), voice_id=voice_id)
    out_dir = MP3_DIR / job.subject_key / f"ch{job.chapter_no:02d}_chunks"
    chunk_ids = [c.chunk_id for c in chapter.chunks]
    return synthesize_chapter(client, cfg, scripts, chunk_ids, out_dir, resume=resume)


def step_merge(job: ChapterJob, mp3_paths: List[Path]) -> Optional[Path]:
    """[5] 청크 MP3들 → 챕터 통합 MP3 1개."""
    from mp3_merger import merge_mp3_files
    if not mp3_paths:
        return None
    out_dir = MP3_DIR / job.subject_key
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"ch{job.chapter_no:02d}_{job.slug}.mp3"
    return merge_mp3_files(mp3_paths, out_path)


# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------

def main() -> int:
    # Windows cp949 콘솔 한글/유니코드 출력 대응
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser(
        description="MD 교재 → 청취용 원고 → MP3 오디오북 파이프라인",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("--subject", choices=list(SUBJECT_DIRS.keys()),
                    help="특정 과목만 처리 (기본: 전체)")
    ap.add_argument("--chapter", type=int,
                    help="특정 챕터 번호만 처리 (예: 1)")
    ap.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS,
                    help=f"TTS 청크 최대 글자 수 (기본: {DEFAULT_MAX_CHARS})")
    ap.add_argument("--polish-only", action="store_true",
                    help="원고 정제까지만 수행 (TTS/API 키 불필요)")
    ap.add_argument("--tts", action="store_true",
                    help="TTS 변환 + MP3 병합까지 수행 (ELEVENLABS_API_KEY 필요)")
    ap.add_argument("--voice", default="Aria",
                    help="ElevenLabs 음성 이름 또는 ID (기본: Aria)")
    ap.add_argument("--no-resume", dest="resume", action="store_false",
                    help="기존 MP3도 다시 생성 (기본: 이미 있으면 건너뜀)")
    ap.add_argument("--list", action="store_true",
                    help="처리 대상 목록만 출력하고 종료")
    args = ap.parse_args()

    jobs = scan_chapter_jobs(args.subject, args.chapter)
    if not jobs:
        print("처리할 MD 파일이 없습니다. --subject/--chapter 조건을 확인하세요.")
        return 1

    print(f"대상: {len(jobs)}개 챕터")
    for j in jobs:
        print(f"  [{j.subject_key:<14}] ch{j.chapter_no:02d}  {j.md_path.name}")
    if args.list:
        return 0

    # --polish-only 와 --tts 둘 다 없으면 polish-only로 간주 (안전 기본값)
    do_tts = args.tts and not args.polish_only

    ok, fail = 0, 0
    for i, job in enumerate(jobs, 1):
        print(f"\n{'='*70}")
        print(f"[{i}/{len(jobs)}] {job.subject_name} — 제{job.chapter_no}장 ({job.md_path.name})")
        print(f"{'='*70}")
        try:
            chapter = step_chunk(job, args.max_chars)
            total_chars = sum(len(c.text) for c in chapter.chunks)
            print(f"  청킹 완료: {len(chapter.chunks)}개 청크 / {total_chars:,}자")

            scripts = step_polish(job, chapter)
            script_chars = sum(len(s) for s in scripts)
            print(f"  원고 정제 완료: {script_chars:,}자 → {SCRIPTS_DIR / job.subject_key}")

            if do_tts:
                mp3s = step_tts(job, chapter, scripts, args.voice, args.resume)
                merged = step_merge(job, mp3s)
                if merged:
                    size_kb = merged.stat().st_size // 1024
                    print(f"  챕터 MP3: {merged} ({size_kb:,} KB)")
            ok += 1
        except Exception as e:  # noqa: BLE001
            fail += 1
            print(f"  [실패] {job.md_path.name}: {e}")
            if do_tts:
                # TTS 중단 시에도 다음 챕터 계속 (청크 단위 재개 가능)
                continue

    print(f"\n완료: 성공 {ok}개 / 실패 {fail}개")
    if not do_tts:
        print("※ 원고만 생성되었습니다. MP3 생성: python run_pipeline.py --tts")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
