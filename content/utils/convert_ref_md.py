#!/usr/bin/env python3
"""
convert_ref_md.py — ref_md 디렉토리 최적화 스크립트

[목적]
  ref_md의 HTML 파일들이 너무 커서(~45MB) 배포 부담이 큼.
  - 대용량 법령 원문 3개(상위 60%) → Markdown으로 변환 (~70% 절감)
  - 나머지 39개 → <head>/<style> 제거 + base64 이미지 제거 (body-only HTML)

[사용법]
  python content/utils/convert_ref_md.py
"""

import re
import os
import html
from pathlib import Path
from html.parser import HTMLParser

REF_MD_DIR = Path(__file__).parent.parent / "참조자료" / "ref_md"

# MD 변환 대상 — None이면 전체 파일을 MD로 변환
MD_TARGETS = None  # 전체 MD 변환 (한글 엔티티 인코딩 문제 해결)


def decode_entities(text):
    """HTML 엔티티 디코딩"""
    return html.unescape(text)


def extract_text_from_spans(html_fragment):
    """<span> 태그들에서 텍스트만 추출"""
    # <span ...>텍스트</span> → 텍스트
    text = re.sub(r'<span[^>]*>', '', html_fragment)
    text = text.replace('</span>', '')
    return decode_entities(text)


def parse_style(style_str):
    """style 속성에서 top, left 값 추출 (pt 단위)"""
    top = 9999.0
    left = 9999.0
    m = re.search(r'top:\s*([\d.]+)pt', style_str)
    if m:
        top = float(m.group(1))
    m = re.search(r'left:\s*([\d.]+)pt', style_str)
    if m:
        left = float(m.group(1))
    return top, left


def convert_table_to_md(table_html):
    """HTML <table class="pdf-table">을 MD 표로 변환"""
    rows = []
    for tr_match in re.finditer(r'<tr>(.*?)</tr>', table_html, re.DOTALL):
        tr_content = tr_match.group(1)
        cells = []
        for cell_match in re.finditer(r'<t[hd][^>]*>(.*?)</t[hd]>', tr_content, re.DOTALL):
            cell_text = cell_match.group(1)
            # <br> → 스페이스 (MD 표 셀에서는 줄바꿈이 어려움)
            cell_text = re.sub(r'<br\s*/?>', ' / ', cell_text, flags=re.IGNORECASE)
            # 나머지 HTML 태그 제거
            cell_text = re.sub(r'<[^>]+>', '', cell_text)
            cell_text = decode_entities(cell_text).strip()
            # 파이프 문자 이스케이프
            cell_text = cell_text.replace('|', '\\|')
            cells.append(cell_text)
        if cells:
            rows.append(cells)

    if not rows:
        return ''

    # 첫 번째 행을 헤더로 사용
    max_cols = max(len(r) for r in rows)
    # 열 수 맞추기
    for r in rows:
        while len(r) < max_cols:
            r.append('')

    md_lines = []
    # 헤더
    md_lines.append('| ' + ' | '.join(rows[0]) + ' |')
    # 구분선
    md_lines.append('| ' + ' | '.join(['---'] * max_cols) + ' |')
    # 데이터 행
    for row in rows[1:]:
        md_lines.append('| ' + ' | '.join(row) + ' |')

    return '\n'.join(md_lines)


def convert_html_to_md(html_content, base_name):
    """HTML 파일을 Markdown으로 변환"""
    # CRLF 정규화
    html_content = html_content.replace('\r\n', '\n').replace('\r', '\n')

    md_lines = [f'# {base_name}', '']

    # 페이지 단위로 분할
    pages = re.split(r'<div class="page">', html_content)

    for page_html in pages[1:]:  # 첫 번째는 <body> 이전 부분
        # 페이지가 끝나는 위치 찾기
        page_end = page_html.find('</div>\n<div class="page">')
        if page_end == -1:
            page_end = page_html.find('</div>\n\n</div>\n</body>')
        if page_end == -1:
            page_content = page_html
        else:
            page_content = page_html[:page_end]

        # 표 추출 (페이지 내에서 표가 나오면 텍스트 앞에 배치)
        table_md_parts = []
        for table_match in re.finditer(
            r'<table class="pdf-table">(.*?)</table>', page_content, re.DOTALL
        ):
            md_table = convert_table_to_md(table_match.group(1))
            if md_table:
                table_md_parts.append(md_table)

        # 이미지 파일 참조 추출 (base64 제외, 파일 참조만)
        img_parts = []
        for img_match in re.finditer(
            r'<img[^>]*src="images/([^"]+)"[^>]*/?>', page_content
        ):
            img_parts.append(f'![이미지](images/{img_match.group(1)})')

        # 텍스트 추출: <p style="top:...;left:..."> 내의 텍스트
        text_items = []
        for p_match in re.finditer(
            r'<p\s+style="([^"]*)"[^>]*>(.*?)</p>', page_content, re.DOTALL
        ):
            style_str = p_match.group(1)
            inner = p_match.group(2)
            top, left = parse_style(style_str)
            text = extract_text_from_spans(inner)
            # 빈 텍스트나 공백만 있는 텍스트 건너뛰기
            if text.strip():
                text_items.append((top, left, text.strip()))

        # top, left 순으로 정렬 (자연스러운 읽기 순서)
        text_items.sort(key=lambda x: (round(x[0], 1), round(x[1], 1)))

        # 페이지 헤더 정보 (Page X / Y) 건너뛰기 - "법제처" 등 페이지 번호 패턴
        filtered_texts = []
        for top, left, text in text_items:
            # 페이지 번호 라인 건너뛰기 (법제처 + 숫자 + 국가법령정보센터 패턴)
            if re.match(r'^법제처\s+\d+\s+국가법령정보센터', text):
                continue
            # 문서 제목 반복 라인 건너뛰기 (상단에 위치한 짧은 제목)
            if top < 30 and left > 400 and text == base_name:
                continue
            filtered_texts.append(text)

        # 페이지 내용이 있으면 추가
        has_content = False

        if filtered_texts:
            for text in filtered_texts:
                md_lines.append(text)
                md_lines.append('')
                has_content = True

        if table_md_parts:
            for tbl in table_md_parts:
                md_lines.append(tbl)
                md_lines.append('')
                has_content = True

        if img_parts:
            for img in img_parts:
                md_lines.append(img)
                md_lines.append('')
                has_content = True

        if has_content:
            md_lines.append('---')
            md_lines.append('')

    return '\n'.join(md_lines)


def strip_html_to_body(html_content):
    """HTML에서 <body> 내용만 추출하고 <style>, base64 이미지 제거"""
    # CRLF 정규화
    html_content = html_content.replace('\r\n', '\n').replace('\r', '\n')
    # <body> 내용 추출
    body_match = re.search(r'<body[^>]*>(.*)</body>', html_content, re.DOTALL)
    if not body_match:
        return html_content

    body = body_match.group(1)

    # <style> 태그 제거
    body = re.sub(r'<style[^>]*>.*?</style>', '', body, flags=re.DOTALL | re.IGNORECASE)

    # base64 data: URI 이미지 제거 (파일 참조 이미지는 유지)
    # data:image/png;base64,... 형태의 src를 가진 <img> 태그 제거
    body = re.sub(
        r'<img[^>]*src="data:image/[^"]*"[^>]*/?>',
        '',
        body,
        flags=re.DOTALL | re.IGNORECASE
    )

    # 빈 <div class="images"></div> 정리
    body = re.sub(
        r'<div class="images">\s*</div>',
        '',
        body,
        flags=re.DOTALL
    )

    return body.strip()


def main():
    if not REF_MD_DIR.exists():
        print(f"ERROR: {REF_MD_DIR} not found")
        return

    md_count = 0
    body_count = 0
    total_saved = 0

    for item in REF_MD_DIR.iterdir():
        if not item.is_dir():
            continue

        html_file = item / f"{item.name}.html"
        if not html_file.exists():
            continue

        original_size = html_file.stat().st_size
        html_content = html_file.read_text(encoding='utf-8')

        if MD_TARGETS is None or item.name in MD_TARGETS:
            # Markdown 변환
            md_content = convert_html_to_md(html_content, item.name)
            md_file = item / f"{item.name}.md"
            md_file.write_text(md_content, encoding='utf-8')
            new_size = md_file.stat().st_size

            # 원본 HTML 삭제
            html_file.unlink()

            saved = original_size - new_size
            total_saved += saved
            md_count += 1
            print(
                f"  [MD] {item.name}: "
                f"{original_size/1024:.0f}KB → {new_size/1024:.0f}KB "
                f"(-{saved/1024:.0f}KB, {saved/original_size*100:.0f}% 절감)"
            )
        else:
            # Body-only 추출
            body_content = strip_html_to_body(html_content)
            html_file.write_text(body_content, encoding='utf-8')
            new_size = html_file.stat().st_size

            saved = original_size - new_size
            total_saved += saved
            body_count += 1
            if saved > 0:
                print(
                    f"  [BODY] {item.name}: "
                    f"{original_size/1024:.0f}KB → {new_size/1024:.0f}KB "
                    f"(-{saved/1024:.0f}KB, {saved/original_size*100:.0f}% 절감)"
                )

    print(
        f"\n완료: MD 변환 {md_count}개, Body 추출 {body_count}개, "
        f"총 절감: {total_saved/1024/1024:.1f}MB"
    )


if __name__ == '__main__':
    main()
