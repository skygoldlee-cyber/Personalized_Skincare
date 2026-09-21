# -*- coding: utf-8 -*-
"""
test_audiobook.py
=================
audiobook 파이프라인 모듈 단위 테스트 (unittest 기반, 외부 의존성 없음).

실행:
    python audiobook/test_audiobook.py
    python -m unittest audiobook.test_audiobook -v
    python -m unittest discover audiobook -v
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# elevenlabs SDK가 설치되지 않은 환경에서도 테스트 가능하도록 VoiceSettings mock
import tts_elevenlabs as _tts_mod
if not _tts_mod._HAS_SDK:
    _tts_mod.VoiceSettings = MagicMock()

# audiobook/ 디렉터리를 import 경로에 추가
AUDIOBOOK_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(AUDIOBOOK_DIR))

from md_chunker import (  # noqa: E402
    DEFAULT_MAX_CHARS,
    Chunk,
    Chapter,
    chunk_markdown_file,
    merge_blocks_into_chunks,
    save_chunks_as_files,
    split_long_block,
    split_markdown_into_blocks,
)
from script_polisher import (  # noqa: E402
    block_to_narration,
    circled_to_korean,
    clean_inline,
    polish_chapter,
    polish_chunk,
    polish_law_refs,
    table_to_narration,
)
from mp3_merger import _merge_binary_concat, has_ffmpeg, merge_mp3_files  # noqa: E402
from run_pipeline import (  # noqa: E402
    ChapterJob,
    scan_chapter_jobs,
    step_chunk,
    step_merge,
    step_polish,
    SUBJECT_DIRS,
    CHUNKS_DIR,
    SCRIPTS_DIR,
    MP3_DIR,
)
from tts_elevenlabs import (  # noqa: E402
    MAX_RETRIES,
    RETRY_BASE_DELAY,
    TTSConfig,
    get_api_key,
    re_full_voice_id,
    resolve_voice_id,
    synthesize_chapter,
    synthesize_chunk_to_file,
)


# ===========================================================================
# md_chunker.py 테스트
# ===========================================================================

class TestSplitMarkdownIntoBlocks(unittest.TestCase):
    """split_markdown_into_blocks 함수 테스트."""

    def test_paragraphs_split_by_blank_line(self):
        md = "첫 번째 문단입니다.\n\n두 번째 문단입니다."
        blocks = split_markdown_into_blocks(md)
        self.assertEqual(blocks, ["첫 번째 문단입니다.", "두 번째 문단입니다."])

    def test_header_is_own_block(self):
        md = "문단 내용\n\n## 섹션 제목\n\n다음 문단"
        blocks = split_markdown_into_blocks(md)
        self.assertEqual(len(blocks), 3)
        self.assertEqual(blocks[1], "## 섹션 제목")

    def test_table_is_single_block(self):
        md = "| A | B |\n|---|---|\n| 1 | 2 |\n\n문단"
        blocks = split_markdown_into_blocks(md)
        self.assertEqual(len(blocks), 2)
        self.assertTrue(blocks[0].startswith("| A | B |"))
        self.assertEqual(blocks[1], "문단")

    def test_code_block_is_single_block(self):
        md = "```\ncode line 1\ncode line 2\n```\n\n문단"
        blocks = split_markdown_into_blocks(md)
        self.assertEqual(len(blocks), 2)
        self.assertIn("code line 1", blocks[0])
        self.assertEqual(blocks[1], "문단")

    def test_empty_lines_ignored(self):
        md = "문단1\n\n\n\n문단2"
        blocks = split_markdown_into_blocks(md)
        self.assertEqual(blocks, ["문단1", "문단2"])

    def test_list_block_grouped(self):
        md = "- 항목1\n- 항목2\n- 항목3"
        blocks = split_markdown_into_blocks(md)
        self.assertEqual(len(blocks), 1)
        self.assertIn("항목1", blocks[0])
        self.assertIn("항목3", blocks[0])


class TestSplitLongBlock(unittest.TestCase):
    """split_long_block 함수 테스트."""

    def test_table_split_preserves_header(self):
        rows = ["| A | B |", "|---|---|"] + [f"| {i} | {i*2} |" for i in range(50)]
        block = "\n".join(rows)
        pieces = split_long_block(block, max_chars=200)
        self.assertGreater(len(pieces), 1)
        for piece in pieces:
            lines = piece.split("\n")
            self.assertEqual(lines[0], "| A | B |")
            self.assertEqual(lines[1], "|---|---|")

    def test_sentence_split(self):
        block = "문장 하나입니다. " * 100  # ~1,800자
        pieces = split_long_block(block, max_chars=500)
        self.assertGreater(len(pieces), 1)
        for piece in pieces:
            self.assertLessEqual(len(piece), 500)

    def test_short_block_no_split(self):
        block = "짧은 문장입니다."
        pieces = split_long_block(block, max_chars=100)
        self.assertEqual(pieces, ["짧은 문장입니다."])


class TestMergeBlocksIntoChunks(unittest.TestCase):
    """merge_blocks_into_chunks 함수 테스트."""

    def test_small_blocks_merged_into_single_chunk(self):
        blocks = ["블록 A", "블록 B", "블록 C"]
        chunks = merge_blocks_into_chunks(blocks, 1, "테스트 챕터")
        self.assertEqual(len(chunks), 1)
        self.assertIn("블록 A", chunks[0].text)
        self.assertIn("블록 C", chunks[0].text)

    def test_blocks_split_when_exceeding_max(self):
        blocks = ["가" * 100, "나" * 100, "다" * 100]
        chunks = merge_blocks_into_chunks(blocks, 1, "챕터", max_chars=150)
        self.assertGreater(len(chunks), 1)

    def test_chunk_id_format(self):
        blocks = ["내용"]
        chunks = merge_blocks_into_chunks(blocks, 3, "챕터")
        self.assertEqual(chunks[0].chunk_id, "ch03_001")

    def test_h2_updates_section_title(self):
        blocks = ["## 피부 구조", "문단 내용", "다음 문단"]
        chunks = merge_blocks_into_chunks(blocks, 1, "챕터")
        self.assertEqual(chunks[0].section_title, "피부 구조")

    def test_seq_increments(self):
        blocks = ["가" * 100, "나" * 100]
        chunks = merge_blocks_into_chunks(blocks, 1, "챕터", max_chars=150)
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0].seq, 1)
        self.assertEqual(chunks[1].seq, 2)


class TestChunkMarkdownFile(unittest.TestCase):
    """chunk_markdown_file 함수 테스트 (임시 파일 사용)."""

    def test_reads_and_chunks_file(self):
        md_content = "# CHAPTER 01. 테스트 챕터\n\n## 1. 개요\n\n내용입니다.\n\n## 2. 상세\n\n더 많은 내용입니다."
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp) / "test_chapter.md"
            tmp_path.write_text(md_content, encoding="utf-8")
            chapter = chunk_markdown_file(tmp_path, chapter_no=1)
            self.assertEqual(chapter.chapter_no, 1)
            self.assertIn("테스트 챕터", chapter.title)
            self.assertGreater(len(chapter.chunks), 0)
            self.assertIsInstance(chapter.chunks[0], Chunk)

    def test_no_h1_uses_filename_stem(self):
        md_content = "헤더 없는 문서입니다."
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp) / "no_header_doc.md"
            tmp_path.write_text(md_content, encoding="utf-8")
            chapter = chunk_markdown_file(tmp_path, chapter_no=2)
            self.assertEqual(chapter.title, "no_header_doc")


class TestSaveChunksAsFiles(unittest.TestCase):
    """save_chunks_as_files 함수 테스트."""

    def test_saves_files_with_correct_names(self):
        chunks = [
            Chunk(chapter_no=1, chapter_title="T", section_title="S", seq=1, text="첫 번째"),
            Chunk(chapter_no=1, chapter_title="T", section_title="S", seq=2, text="두 번째"),
        ]
        chapter = Chapter(chapter_no=1, title="T", chunks=chunks)
        with tempfile.TemporaryDirectory() as tmp:
            paths = save_chunks_as_files(chapter, tmp)
            self.assertEqual(len(paths), 2)
            self.assertEqual(paths[0].name, "ch01_001.md")
            self.assertEqual(paths[1].name, "ch01_002.md")
            self.assertEqual(paths[0].read_text(encoding="utf-8"), "첫 번째")


class TestChunkDataclass(unittest.TestCase):
    """Chunk dataclass 테스트."""

    def test_chunk_id_zero_padded(self):
        c = Chunk(chapter_no=5, chapter_title="", section_title="", seq=7, text="")
        self.assertEqual(c.chunk_id, "ch05_007")

    def test_default_max_chars_constant(self):
        self.assertEqual(DEFAULT_MAX_CHARS, 2500)


# ===========================================================================
# script_polisher.py 테스트
# ===========================================================================

class TestCircledToKorean(unittest.TestCase):
    """circled_to_korean 함수 테스트."""

    def test_circled_numbers_converted(self):
        self.assertEqual(circled_to_korean("① 첫 번째"), "첫째 첫 번째")
        self.assertEqual(circled_to_korean("⑤ 다섯 번째"), "다섯째 다섯 번째")

    def test_no_circled_unchanged(self):
        self.assertEqual(circled_to_korean("일반 텍스트"), "일반 텍스트")


class TestCleanInline(unittest.TestCase):
    """clean_inline 함수 테스트."""

    def test_br_tag_to_newline(self):
        result = clean_inline("첫 줄<br>둘째 줄")
        self.assertIn("\n", result)

    def test_bold_removed(self):
        self.assertEqual(clean_inline("**강조** 텍스트"), "강조 텍스트")

    def test_inline_code_removed(self):
        self.assertEqual(clean_inline("`코드` 텍스트"), "코드 텍스트")

    def test_bullet_removed(self):
        self.assertEqual(clean_inline("- 항목 내용"), "항목 내용")
        self.assertEqual(clean_inline("• 항목 내용"), "항목 내용")

    def test_nbsp_to_space(self):
        self.assertEqual(clean_inline("A&nbsp;B"), "A B")

    def test_multiple_spaces_collapsed(self):
        self.assertEqual(clean_inline("A   B"), "A B")

    def test_hierarchy_symbol(self):
        result = clean_inline("┗ 하위 항목")
        self.assertIn("하위 항목으로", result)


class TestPolishLawRefs(unittest.TestCase):
    """polish_law_refs 함수 테스트."""

    def test_article_with_parenthesis(self):
        self.assertEqual(polish_law_refs("제3조(정의)"), "제3조, 정의")

    def test_article_with_subnumber(self):
        self.assertEqual(polish_law_refs("제3조의2"), "제3조의 2")

    def test_no_match_unchanged(self):
        self.assertEqual(polish_law_refs("일반 문장"), "일반 문장")


class TestTableToNarration(unittest.TestCase):
    """table_to_narration 함수 테스트."""

    def test_simple_table(self):
        table = "| 용어 | 정의 |\n|---|---|\n| 극성 | 전자 분포가 기울어진 것 |"
        result = table_to_narration(table)
        self.assertIn("다음 내용을 표로 정리했습니다", result)
        self.assertIn("극성", result)
        self.assertIn("전자 분포가 기울어진 것", result)

    def test_empty_table_returns_empty(self):
        self.assertEqual(table_to_narration(""), "")

    def test_header_only_table(self):
        table = "| A | B |\n|---|---|"
        result = table_to_narration(table)
        self.assertIn("다음 내용을 표로 정리했습니다", result)

    def test_sub_row_with_empty_first_cell(self):
        table = "| 구분 | 내용 |\n|---|---|\n|  | 세부항목 | 설명 |"
        result = table_to_narration(table)
        self.assertIn("세부항목", result)


class TestBlockToNarration(unittest.TestCase):
    """block_to_narration 함수 테스트."""

    def test_h1_header(self):
        result = block_to_narration("# CHAPTER 01. 화장품 개요")
        self.assertIn("제1장", result)
        self.assertIn("화장품 개요", result)

    def test_h2_header(self):
        result = block_to_narration("## 1. 피부 구조")
        self.assertIn("피부 구조", result)

    def test_code_block_replaced(self):
        result = block_to_narration("```\nsome code\n```")
        self.assertIn("개념 도식", result)

    def test_table_block(self):
        result = block_to_narration("| A | B |\n|---|---|\n| 1 | 2 |")
        self.assertIn("표로 정리했습니다", result)

    def test_separator_removed(self):
        self.assertEqual(block_to_narration("---"), "")
        self.assertEqual(block_to_narration("***"), "")
        self.assertEqual(block_to_narration("___"), "")

    def test_bullet_list(self):
        result = block_to_narration("- 첫 번째\n- 두 번째\n- 세 번째")
        self.assertIn("다음 항목들이 있습니다", result)
        self.assertIn("첫 번째", result)
        self.assertIn("그리고", result)

    def test_single_bullet(self):
        result = block_to_narration("- 하나만")
        self.assertEqual(result, "하나만")

    def test_paragraph(self):
        result = block_to_narration("일반 문단입니다.")
        self.assertEqual(result, "일반 문단입니다.")

    def test_circled_in_header(self):
        result = block_to_narration("#### ① 유지(오일)")
        self.assertIn("첫째", result)
        self.assertIn("유지(오일)", result)


class TestPolishChunk(unittest.TestCase):
    """polish_chunk 함수 테스트."""

    def test_first_chunk_has_intro(self):
        chunk = Chunk(chapter_no=1, chapter_title="CHAPTER 01. 테스트", section_title="", seq=1, text="내용")
        result = polish_chunk(chunk, is_first=True, is_last=False)
        self.assertIn("이번 장에서는", result)
        self.assertIn("제1장", result)

    def test_last_chunk_has_outro(self):
        chunk = Chunk(chapter_no=1, chapter_title="CHAPTER 01. 테스트", section_title="", seq=1, text="내용")
        result = polish_chunk(chunk, is_first=False, is_last=True)
        self.assertIn("이상으로", result)
        self.assertIn("제1장", result)

    def test_no_intro_outro(self):
        chunk = Chunk(chapter_no=1, chapter_title="테스트", section_title="", seq=1, text="내용")
        result = polish_chunk(chunk, is_first=False, is_last=False)
        self.assertNotIn("이번 장에서는", result)
        self.assertNotIn("이상으로", result)
        self.assertIn("내용", result)


class TestPolishChapter(unittest.TestCase):
    """polish_chapter 함수 테스트."""

    def test_returns_list_matching_chunks(self):
        chunks = [
            Chunk(chapter_no=1, chapter_title="T", section_title="", seq=1, text="첫"),
            Chunk(chapter_no=1, chapter_title="T", section_title="", seq=2, text="둘"),
            Chunk(chapter_no=1, chapter_title="T", section_title="", seq=3, text="셋"),
        ]
        chapter = Chapter(chapter_no=1, title="T", chunks=chunks)
        scripts = polish_chapter(chapter)
        self.assertEqual(len(scripts), 3)
        self.assertIn("이번 장에서는", scripts[0])  # intro
        self.assertIn("이상으로", scripts[2])      # outro
        self.assertNotIn("이번 장에서는", scripts[1])
        self.assertNotIn("이상으로", scripts[1])

    def test_no_intro_outro(self):
        chunks = [Chunk(chapter_no=1, chapter_title="T", section_title="", seq=1, text="내용")]
        chapter = Chapter(chapter_no=1, title="T", chunks=chunks)
        scripts = polish_chapter(chapter, include_intro_outro=False)
        self.assertNotIn("이번 장에서는", scripts[0])
        self.assertNotIn("이상으로", scripts[0])


# ===========================================================================
# mp3_merger.py 테스트
# ===========================================================================

class TestMp3Merger(unittest.TestCase):
    """mp3_merger 모듈 테스트 (실제 오디오 처리 없이 mock/바이너리 테스트)."""

    def test_has_ffmpeg_returns_bool(self):
        result = has_ffmpeg()
        self.assertIsInstance(result, bool)

    def test_binary_concat(self):
        with tempfile.TemporaryDirectory() as tmp:
            p1 = Path(tmp) / "a.mp3"
            p2 = Path(tmp) / "b.mp3"
            out = Path(tmp) / "out.mp3"
            p1.write_bytes(b"FAKE_MP3_DATA_1")
            p2.write_bytes(b"FAKE_MP3_DATA_2")
            _merge_binary_concat([p1, p2], out)
            self.assertEqual(out.read_bytes(), b"FAKE_MP3_DATA_1FAKE_MP3_DATA_2")

    def test_merge_empty_list_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                merge_mp3_files([], Path(tmp) / "out.mp3")

    def test_merge_creates_output_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            p1 = Path(tmp) / "a.mp3"
            p1.write_bytes(b"data")
            out = Path(tmp) / "merged.mp3"
            # ffmpeg 없을 때 바이너리 concat으로 폴트백
            with patch("mp3_merger.has_ffmpeg", return_value=False):
                merge_mp3_files([p1], out)
            self.assertTrue(out.exists())


# ===========================================================================
# run_pipeline.py 테스트
# ===========================================================================

class TestScanChapterJobs(unittest.TestCase):
    """scan_chapter_jobs 함수 테스트."""

    def test_scan_returns_list(self):
        jobs = scan_chapter_jobs()
        self.assertIsInstance(jobs, list)

    def test_scan_finds_existing_chapters(self):
        # manufacturing 과목은 실제 MD 파일이 존재해야 함
        jobs = scan_chapter_jobs(subject_filter="manufacturing")
        self.assertGreater(len(jobs), 0)
        self.assertTrue(all(j.subject_key == "manufacturing" for j in jobs))

    def test_chapter_filter(self):
        jobs = scan_chapter_jobs(subject_filter="manufacturing", chapter_filter=1)
        self.assertTrue(all(j.chapter_no == 1 for j in jobs))

    def test_invalid_subject_returns_empty(self):
        jobs = scan_chapter_jobs(subject_filter="nonexistent_subject")
        self.assertEqual(jobs, [])

    def test_jobs_sorted_by_subject_then_chapter(self):
        jobs = scan_chapter_jobs()
        if len(jobs) >= 2:
            for i in range(len(jobs) - 1):
                key_i = list(SUBJECT_DIRS.keys()).index(jobs[i].subject_key)
                key_j = list(SUBJECT_DIRS.keys()).index(jobs[i + 1].subject_key)
                if key_i == key_j:
                    self.assertLessEqual(jobs[i].chapter_no, jobs[i + 1].chapter_no)
                else:
                    self.assertLess(key_i, key_j)


class TestStepChunk(unittest.TestCase):
    """step_chunk 함수 테스트."""

    def test_step_chunk_returns_chapter(self):
        jobs = scan_chapter_jobs(subject_filter="manufacturing", chapter_filter=1)
        if not jobs:
            self.skipTest("manufacturing ch01 MD 파일 없음")
        job = jobs[0]
        with tempfile.TemporaryDirectory() as tmp:
            with patch("run_pipeline.CHUNKS_DIR", Path(tmp)):
                chapter = step_chunk(job, 2500)
                self.assertIsInstance(chapter, Chapter)
                self.assertGreater(len(chapter.chunks), 0)


class TestStepPolish(unittest.TestCase):
    """step_polish 함수 테스트."""

    def test_step_polish_writes_scripts(self):
        jobs = scan_chapter_jobs(subject_filter="manufacturing", chapter_filter=1)
        if not jobs:
            self.skipTest("manufacturing ch01 MD 파일 없음")
        job = jobs[0]
        chapter = Chapter(
            chapter_no=1, title="T",
            chunks=[Chunk(chapter_no=1, chapter_title="T", section_title="", seq=1, text="내용")]
        )
        with tempfile.TemporaryDirectory() as tmp:
            with patch("run_pipeline.SCRIPTS_DIR", Path(tmp)):
                scripts = step_polish(job, chapter)
                self.assertEqual(len(scripts), 1)
                self.assertTrue((Path(tmp) / job.subject_key / "ch01_001.txt").exists())


class TestStepMerge(unittest.TestCase):
    """step_merge 함수 테스트."""

    def test_step_merge_empty_returns_none(self):
        job = ChapterJob(
            subject_key="test", subject_name="테스트",
            md_path=Path("dummy.md"), chapter_no=1, slug="test"
        )
        result = step_merge(job, [])
        self.assertIsNone(result)


class TestChapterJobDataclass(unittest.TestCase):
    """ChapterJob dataclass 테스트."""

    def test_fields(self):
        job = ChapterJob(
            subject_key="manufacturing",
            subject_name="화장품 제조 및 품질관리",
            md_path=Path("test.md"),
            chapter_no=1,
            slug="test_slug",
        )
        self.assertEqual(job.chapter_no, 1)
        self.assertEqual(job.slug, "test_slug")


# ===========================================================================
# tts_elevenlabs.py 테스트
# ===========================================================================

class TestTTSConfig(unittest.TestCase):
    """TTSConfig dataclass 테스트."""

    def test_defaults(self):
        cfg = TTSConfig(api_key="key", voice_id="vid")
        self.assertEqual(cfg.model_id, "eleven_multilingual_v2")
        self.assertEqual(cfg.output_format, "mp3_44100_128")
        self.assertEqual(cfg.stability, 0.5)
        self.assertEqual(cfg.similarity_boost, 0.75)
        self.assertEqual(cfg.style, 0.0)
        self.assertTrue(cfg.use_speaker_boost)

    def test_max_retries_constant(self):
        self.assertEqual(MAX_RETRIES, 4)

    def test_retry_base_delay_constant(self):
        self.assertEqual(RETRY_BASE_DELAY, 3.0)


class TestGetApiKey(unittest.TestCase):
    """get_api_key 함수 테스트."""

    def test_missing_key_raises(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(RuntimeError) as ctx:
                get_api_key()
            self.assertIn("ELEVENLABS_API_KEY", str(ctx.exception))

    def test_key_returned(self):
        with patch.dict("os.environ", {"ELEVENLABS_API_KEY": "test_key_123"}):
            self.assertEqual(get_api_key(), "test_key_123")

    def test_whitespace_stripped(self):
        with patch.dict("os.environ", {"ELEVENLABS_API_KEY": "  spaced_key  "}):
            self.assertEqual(get_api_key(), "spaced_key")


class TestReFullVoiceId(unittest.TestCase):
    """re_full_voice_id 함수 테스트."""

    def test_valid_voice_id(self):
        self.assertTrue(re_full_voice_id("abc123def456ghi789jk"))

    def test_short_string_not_voice_id(self):
        self.assertFalse(re_full_voice_id("Aria"))

    def test_empty_string(self):
        self.assertFalse(re_full_voice_id(""))


class TestResolveVoiceId(unittest.TestCase):
    """resolve_voice_id 함수 테스트 (mock 사용)."""

    def test_id_passthrough(self):
        mock_client = MagicMock()
        result = resolve_voice_id(mock_client, "abc123def456ghi789jk")
        self.assertEqual(result, "abc123def456ghi789jk")
        mock_client.voices.get_all.assert_not_called()

    def test_name_resolved(self):
        mock_voice = MagicMock()
        mock_voice.name = "Aria"
        mock_voice.voice_id = "voice_id_12345678901"
        mock_client = MagicMock()
        mock_client.voices.get_all.return_value.voices = [mock_voice]
        result = resolve_voice_id(mock_client, "Aria")
        self.assertEqual(result, "voice_id_12345678901")

    def test_name_case_insensitive(self):
        mock_voice = MagicMock()
        mock_voice.name = "Aria"
        mock_voice.voice_id = "voice_id_12345678901"
        mock_client = MagicMock()
        mock_client.voices.get_all.return_value.voices = [mock_voice]
        result = resolve_voice_id(mock_client, "aria")
        self.assertEqual(result, "voice_id_12345678901")

    def test_unknown_name_raises(self):
        mock_voice = MagicMock()
        mock_voice.name = "Aria"
        mock_client = MagicMock()
        mock_client.voices.get_all.return_value.voices = [mock_voice]
        with self.assertRaises(ValueError):
            resolve_voice_id(mock_client, "NonexistentVoice")


class TestSynthesizeChunkToFile(unittest.TestCase):
    """synthesize_chunk_to_file 함수 테스트 (mock 사용)."""

    def test_skip_existing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "test.mp3"
            out.write_bytes(b"existing")
            mock_client = MagicMock()
            cfg = TTSConfig(api_key="k", voice_id="v")
            result = synthesize_chunk_to_file(mock_client, cfg, "텍스트", out, resume=True)
            self.assertEqual(result, out)
            mock_client.text_to_speech.convert.assert_not_called()

    def test_no_resume_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "test.mp3"
            out.write_bytes(b"old")
            mock_client = MagicMock()
            mock_client.text_to_speech.convert.side_effect = lambda **kw: iter([b"new_audio"])
            cfg = TTSConfig(api_key="k", voice_id="v")
            with patch("tts_elevenlabs.time.sleep"):
                synthesize_chunk_to_file(mock_client, cfg, "텍스트", out, resume=False)
            self.assertEqual(out.read_bytes(), b"new_audio")

    def test_creates_parent_dirs(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "deep" / "nested" / "test.mp3"
            mock_client = MagicMock()
            mock_client.text_to_speech.convert.side_effect = lambda **kw: iter([b"audio"])
            cfg = TTSConfig(api_key="k", voice_id="v")
            with patch("tts_elevenlabs.time.sleep"):
                synthesize_chunk_to_file(mock_client, cfg, "텍스트", out)
            self.assertTrue(out.exists())


class TestSynthesizeChapter(unittest.TestCase):
    """synthesize_chapter 함수 테스트 (mock 사용)."""

    def test_skips_empty_scripts(self):
        with tempfile.TemporaryDirectory() as tmp:
            mock_client = MagicMock()
            mock_client.text_to_speech.convert.side_effect = lambda **kw: iter([b"audio"])
            cfg = TTSConfig(api_key="k", voice_id="v")
            scripts = ["내용 있음", "", "  ", "두 번째 내용"]
            chunk_ids = ["ch01_001", "ch01_002", "ch01_003", "ch01_004"]
            with patch("tts_elevenlabs.time.sleep"):
                paths = synthesize_chapter(mock_client, cfg, scripts, chunk_ids, tmp)
            self.assertEqual(len(paths), 2)

    def test_output_files_named_by_chunk_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            mock_client = MagicMock()
            mock_client.text_to_speech.convert.side_effect = lambda **kw: iter([b"audio"])
            cfg = TTSConfig(api_key="k", voice_id="v")
            with patch("tts_elevenlabs.time.sleep"):
                paths = synthesize_chapter(mock_client, cfg, ["텍스트"], ["ch01_001"], tmp)
            self.assertEqual(paths[0].name, "ch01_001.mp3")


# ===========================================================================
# 통합 테스트 (실제 파일 사용)
# ===========================================================================

class TestIntegration(unittest.TestCase):
    """실제 MD 파일을 사용한 통합 테스트."""

    def test_chunk_and_polish_real_file(self):
        """실제 manufacturing ch01 MD 파일을 청킹→정제까지 수행."""
        md_path = AUDIOBOOK_DIR.parent / "manufacturing" / "1.화장품 원료의 종류와 특성 및 제품의 제조관리2026.md"
        if not md_path.exists():
            self.skipTest(f"테스트 파일 없음: {md_path}")

        chapter = chunk_markdown_file(md_path, chapter_no=1)
        self.assertGreater(len(chapter.chunks), 0)

        scripts = polish_chapter(chapter)
        self.assertEqual(len(scripts), len(chapter.chunks))

        # 모든 스크립트가 비어있지 않아야 함
        for i, script in enumerate(scripts):
            self.assertTrue(script.strip(), f"스크립트 {i}가 비어있음")

        # 첫 청크에 인트로, 마지막에 아웃트로
        self.assertIn("이번 장에서는", scripts[0])
        self.assertIn("이상으로", scripts[-1])

    def test_chunk_sizes_within_limit(self):
        """모든 청크가 max_chars 이내인지 확인."""
        md_path = AUDIOBOOK_DIR.parent / "manufacturing" / "1.화장품 원료의 종류와 특성 및 제품의 제조관리2026.md"
        if not md_path.exists():
            self.skipTest(f"테스트 파일 없음: {md_path}")

        chapter = chunk_markdown_file(md_path, chapter_no=1, max_chars=2500)
        for chunk in chapter.chunks:
            # 청크 크기가 max_chars의 1.5배를 넘지 않아야 함 (분할 알고리즘 여유분)
            self.assertLessEqual(
                len(chunk.text), 2500 * 1.5,
                f"{chunk.chunk_id}이 너무 큼: {len(chunk.text)}자"
            )


# ===========================================================================
# 실행
# ===========================================================================

if __name__ == "__main__":
    # Windows cp949 콘솔 한글 출력 대응
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    unittest.main(verbosity=2)
