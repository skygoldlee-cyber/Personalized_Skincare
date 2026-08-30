#!/usr/bin/env python3
"""batch_convert.py — 교재·학습안내서·report MD 파일을 HTML로 일괄 변환

사용법:
    python batch_convert.py                  # 기본: 모든 대상 파일 변환 → ../html/
    python batch_convert.py --no-prerender   # Mermaid SVG 사전 렌더링 생략 (PC용, 가벼운 HTML)
    python batch_convert.py --no-embed       # Mermaid 라이브러리 인라인 생략 (CDN 사용)
    python batch_convert.py --only 교재       # 특정 그룹만 변환

대상 파일 (ROOT 기준 상대경로):
    교재/1과목_화장품법의이해.md
    교재/2과목_제조및품질관리.md
    교재/3과목_유통화장품안전관리.md
    교재/4과목_맞춤형화장품의이해.md
    학습안내서.md
    report/출제비중분포조사결과.md
    report/출제비중기반학습방법.md
    report/법령최신확인결과.md
    report/오답위험_분석보고서.md
    문제은행/과목1_문제은행_교재인용.md
    문제은행/과목2_문제은행_교재인용.md
    문제은행/과목3_문제은행_교재인용.md
    문제은행/과목4_문제은행_교재인용.md

출력: ../html/ (각 파일명과 동일한 .html)
"""

import argparse
import sys
import time
from pathlib import Path

# md_to_html.py의 변환 함수를 임포트
sys.path.insert(0, str(Path(__file__).resolve().parent))
from md_to_html import markdown_to_tailwind_html, RenderConfig

ROOT = Path(__file__).resolve().parent.parent
HTML_DIR = ROOT / "html"

BATCH_TARGETS = {
    "교재": [
        "교재/1과목_화장품법의이해.md",
        "교재/2과목_제조및품질관리.md",
        "교재/3과목_유통화장품안전관리.md",
        "교재/4과목_맞춤형화장품의이해.md",
    ],
    "학습안내서": [
        "학습안내서.md",
    ],
    "report": [
        "report/출제비중분포조사결과.md",
        "report/출제비중기반학습방법.md",
        "report/법령최신확인결과.md",
        "report/오답위험_분석보고서.md",
    ],
    "문제은행": [
        "문제은행/과목1_문제은행_교재인용.md",
        "문제은행/과목2_문제은행_교재인용.md",
        "문제은행/과목3_문제은행_교재인용.md",
        "문제은행/과목4_문제은행_교재인용.md",
    ],
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
        choices=list(BATCH_TARGETS.keys()),
        help="특정 그룹만 변환 (교재, 학습안내서, report, 문제은행)",
    )
    args = parser.parse_args()

    config = RenderConfig(
        prerender_mermaid=not args.no_prerender,
        embed_mermaid=not args.no_embed,
    )

    if args.only:
        groups = {args.only: BATCH_TARGETS[args.only]}
    else:
        groups = BATCH_TARGETS

    HTML_DIR.mkdir(parents=True, exist_ok=True)

    total_files = sum(len(v) for v in groups.values())
    total_elapsed = 0.0
    done = 0
    failed = []

    print(f"배치 변환 시작: {total_files}개 파일 → {HTML_DIR.relative_to(ROOT)}/")
    print(f"  옵션: prerender={'ON' if config.prerender_mermaid else 'OFF'}, "
          f"embed={'ON' if config.embed_mermaid else 'OFF'}")
    print()

    for group_name, files in groups.items():
        print(f"[{group_name}]")
        for rel in files:
            md_path = ROOT / rel
            out_path = HTML_DIR / (md_path.stem + ".html")
            if not md_path.exists():
                print(f"  ✗ {rel} — 파일 없음, 건너뜀")
                failed.append(rel)
                continue
            try:
                total_elapsed += convert_one(md_path, out_path, config)
                done += 1
            except Exception as e:
                print(f"  ✗ {rel} — 변환 실패: {e}")
                failed.append(rel)
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
