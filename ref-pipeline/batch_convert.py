#!/usr/bin/env python3
"""batch_convert.py — 교재·학습안내서·report MD 파일을 HTML로 일괄 변환

사용법:
    python ref-pipeline/batch_convert.py                  # 기본: 모든 대상 파일 변환 → {EXAM}/html/
    python ref-pipeline/batch_convert.py --no-prerender   # Mermaid SVG 사전 렌더링 생략 (PC용, 가벼운 HTML)
    python ref-pipeline/batch_convert.py --no-embed       # Mermaid 라이브러리 인라인 생략 (CDN 사용)
    python ref-pipeline/batch_convert.py --only 교재       # 특정 그룹만 변환

대상 파일 (EXAM_CONTENT_ROOT 기준 glob 패턴):
    교재/<과목 dir>/*.md   — manifest subjects[].dir 기준 (표준형·이야기형 모두)
    학습안내서.md
    report/*.md            — report/ 존재 시에만
    문제은행/*.md          — 단일정답형·복수정답형 모두

출력: {EXAM_CONTENT_ROOT}/html/ (각 파일명과 동일한 .html)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# MD_to_HTML.py의 변환 함수를 임포트 (같은 폴더)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from MD_to_HTML import markdown_to_tailwind_html, RenderConfig

ROOT = Path(os.environ.get(
    "EXAM_CONTENT_ROOT",
    Path(__file__).resolve().parents[1] / "content" / "exams" / "cosmetic",
))
HTML_DIR = ROOT / "html"


def load_target_groups(root: Path) -> dict[str, list[str]]:
    """manifest의 과목 dir을 읽어 그룹별 glob 패턴 목록을 구성."""
    subject_dirs = []
    try:
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
        subject_dirs = [s["dir"] for s in manifest.get("subjects", []) if s.get("dir")]
    except Exception:
        pass
    if not subject_dirs:
        subject_dirs = ["교재/law", "교재/manufacturing", "교재/safety", "교재/understanding"]
    return {
        "교재": [f"{d}/*.md" for d in subject_dirs],
        "학습안내서": ["학습안내서.md"],
        "report": ["report/*.md"],
        "문제은행": ["문제은행/*.md"],
    }


def convert_one(md_path: Path, out_path: Path, config: RenderConfig) -> float:
    md_text = md_path.read_text(encoding="utf-8")
    title = md_path.stem
    t0 = time.perf_counter()
    out_html = markdown_to_tailwind_html(md_text, title=title, config=config)
    out_path.write_text(out_html, encoding="utf-8")
    elapsed = time.perf_counter() - t0
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"  ✓ {out_path.name:<40s} {size_mb:>6.1f} MB  {elapsed:>5.1f}s")
    return elapsed


def main():
    parser = argparse.ArgumentParser(
        description="교재·학습안내서·report MD → HTML 일괄 변환"
    )
    parser.add_argument(
        "--no-prerender",
        action="store_true",
        help="Mermaid SVG 사전 렌더링 생략 (PC용, 가벼운 HTML)",
    )
    parser.add_argument(
        "--no-embed",
        action="store_true",
        help="Mermaid 라이브러리 인라인 생략 (CDN <script> 사용)",
    )
    parser.add_argument(
        "--only",
        choices=["교재", "학습안내서", "report", "문제은행"],
        help="특정 그룹만 변환 (교재, 학습안내서, report, 문제은행)",
    )
    args = parser.parse_args()

    config = RenderConfig(
        prerender_mermaid=not args.no_prerender,
        embed_mermaid=not args.no_embed,
    )

    target_groups = load_target_groups(ROOT)
    if args.only:
        groups = {args.only: target_groups[args.only]}
    else:
        groups = target_groups

    HTML_DIR.mkdir(parents=True, exist_ok=True)

    # glob 패턴을 실제 파일 목록으로 전개
    expanded: dict[str, list[Path]] = {}
    for group_name, patterns in groups.items():
        files = []
        for pat in patterns:
            files.extend(sorted(ROOT.glob(pat)))
        expanded[group_name] = files

    total_files = sum(len(v) for v in expanded.values())
    total_elapsed = 0.0
    done = 0
    failed = []

    print(f"배치 변환 시작: {total_files}개 파일 → {HTML_DIR.relative_to(ROOT)}/")
    print(f"  옵션: prerender={'ON' if config.prerender_mermaid else 'OFF'}, "
          f"embed={'ON' if config.embed_mermaid else 'OFF'}")
    print()

    for group_name, files in expanded.items():
        if not files:
            continue
        print(f"[{group_name}]")
        for md_path in files:
            out_path = HTML_DIR / (md_path.stem + ".html")
            try:
                total_elapsed += convert_one(md_path, out_path, config)
                done += 1
            except Exception as e:
                print(f"  ✗ {md_path.relative_to(ROOT)} — 변환 실패: {e}")
                failed.append(str(md_path.relative_to(ROOT)))
        print()

    print(f"완료: {done}/{total_files} 파일, 총 {total_elapsed:.1f}s")
    if failed:
        print(f"실패 ({len(failed)}): {', '.join(failed)}")
        return 1

    # __pycache__ 정리
    import shutil
    pycache = Path(__file__).resolve().parent / "__pycache__"
    if pycache.exists():
        shutil.rmtree(pycache, ignore_errors=True)

    return 0


if __name__ == "__main__":
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    raise SystemExit(main())
