#!/usr/bin/env python3
"""ref_md 재변환 — pdfplumber 기반 (공백 복원 + 표 구조화)

기존 pypdfium2 get_text_range() 변환은 한국어 PDF의 좌표 기반 공백을 유실하고
표 셀을 파편화했다. pdfplumber는 문자 좌표 간격으로 공백을 복원하고
find_tables()로 표를 행 구조로 추출한다.

출력: content/참조자료/ref_md_v2/{basename}/{basename}.md (스테이징, 검수 후 교체)

셀 내 줄바꿈은 렌더링 wrap이므로 ''로 병합한다(공백 병합 시 화학명이 중간에
끊기는 것보다 wrap 경계 공백 유실이 피해가 적음 — 줄 내 공백은 좌표로 복원됨).
"""
import pdfplumber
import pymupdf
import os
import sys
import glob
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

BASE = os.path.join(os.path.dirname(__file__), '..')
REF_BASE = os.path.join(BASE, 'content', '참조자료')
OUT_DIR = os.path.join(REF_BASE, 'ref_md_v2')

# PDF가 있는 하위 디렉토리 전체 탐색
PDF_DIRS = [d for d in os.listdir(REF_BASE)
            if os.path.isdir(os.path.join(REF_BASE, d))
            and d not in ('ref_md', 'ref_md_v2')]


def collect_pdfs():
    pdfs = []
    for d in PDF_DIRS:
        for f in glob.glob(os.path.join(REF_BASE, d, '*.pdf')):
            pdfs.append((d, f))
    return sorted(pdfs, key=lambda x: os.path.basename(x[1]))


def cell_text(cell):
    """표 셀 정규화 — wrap 병합(''), 공백 정리, 파이프 이스케이프"""
    if cell is None:
        return ''
    t = cell.replace('\n', '')
    t = re.sub(r'\s+', ' ', t).strip()
    return t.replace('|', '｜')


def merge_split_columns(rows):
    """모든 행에서 동일 상수인 인접 열 쌍을 병합 (예: 'CAS'|'No' → 'CAS No')"""
    if len(rows) < 3:
        return rows
    width = max(len(r) for r in rows)
    rows = [list(r) + [''] * (width - len(r)) for r in rows]
    # 열 쌍 i,i+1이 대부분의 행에서 상수 패턴이면 병합
    merges = []
    i = 0
    while i < width - 1:
        pairs = [(r[i], r[i + 1]) for r in rows if r[i] or r[i + 1]]
        both = [p for p in pairs if p[0] and p[1]]
        # 인접 두 열이 대부분 같은 상수 쌍이면 하나로 병합 (예: 'CAS' 'No')
        if both and len(set(pairs)) <= 3 and len(set(both)) == 1 \
                and len(both) >= len(rows) * 0.5:
            merges.append(i)
            i += 2
        else:
            i += 1
    if not merges:
        return rows
    for r in rows:
        for i in reversed(merges):
            if r[i] and r[i + 1]:
                r[i] = r[i] + ' ' + r[i + 1]
            elif r[i + 1]:
                r[i] = r[i + 1]
            del r[i + 1]
    return rows


def table_to_md(table_rows):
    """pdfplumber 행 리스트 → MD 표. None/빈 행 정리, 열 수 패딩"""
    rows = []
    for r in table_rows:
        cells = [cell_text(c) for c in r]
        rows.append(cells)
    if not rows:
        return ''
    width = max(len(r) for r in rows)
    rows = [r + [''] * (width - len(r)) for r in rows]
    # 전부 빈 행 제거
    rows = [r for r in rows if any(c for c in r)]
    rows = merge_split_columns(rows)
    if not rows:
        return ''
    out = []
    out.append('| ' + ' | '.join(rows[0]) + ' |')
    out.append('| ' + ' | '.join(['---'] * width) + ' |')
    for r in rows[1:]:
        out.append('| ' + ' | '.join(r) + ' |')
    return '\n'.join(out)


def point_in_bbox(x, y, bbox):
    return bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3]


# 선 기반 표가 열을 누락했을 때 텍스트 정렬로 재추출하기 위한 대체 설정
TEXT_TABLE_SETTINGS = {
    'vertical_strategy': 'text',
    'horizontal_strategy': 'lines',
    'snap_x_tolerance': 12,
    'join_x_tolerance': 12,
    'min_words_vertical': 2,
}

# 표 영역 밖에 남은 데이터형 텍스트 줄 (숫자/CAS/단위 등 짧은 토큰 반복)
DATA_LINE_RE = re.compile(r'^\s*\d+\s+\S+')


def count_orphan_data(page, tables):
    """표 y 범위 안에서 표 밖 데이터형 텍스트 줄 수"""
    if not tables:
        return 0
    ymin = min(t.bbox[1] for t in tables) - 5
    ymax = max(t.bbox[3] for t in tables) + 5
    bboxes = [t.bbox for t in tables]
    orphan = 0
    for line in page.extract_text_lines():
        if ymin <= line['top'] <= ymax:
            outside = not any(
                point_in_bbox(line['x0'], line['top'], bb) or
                point_in_bbox(line['x1'], line['top'], bb)
                for bb in bboxes
            )
            if outside and (DATA_LINE_RE.match(line['text'])
                            or re.search(r'\d{2,}-\d+-\d', line['text'])):
                orphan += 1
    return orphan


def page_to_md(page, image_names=None):
    """페이지 → (텍스트 줄, 표, 이미지) 세그먼트를 y순 병합"""
    tables = list(page.find_tables())
    # 선 기반 표가 인접 데이터 열을 누락했으면 텍스트 정렬 전략으로 재시도
    if count_orphan_data(page, tables) >= 3:
        alt = list(page.find_tables(table_settings=TEXT_TABLE_SETTINGS))
        if alt and count_orphan_data(page, alt) < count_orphan_data(page, tables):
            tables = alt
    bboxes = [t.bbox for t in tables]

    segments = []
    for t in tables:
        md = table_to_md(t.extract())
        if md:
            segments.append((t.bbox[1], 'table', md))

    # 표 영역 밖 문자만 남겨 텍스트 추출
    if bboxes:
        filtered = page.filter(
            lambda obj: not (
                obj['object_type'] == 'char'
                and any(point_in_bbox(obj['x0'], (obj['top'] + obj['bottom']) / 2, bb) for bb in bboxes)
            )
        )
    else:
        filtered = page

    for line in filtered.extract_text_lines():
        segments.append((line['top'], 'text', line['text']))

    # 이미지 위치에 참조 삽입
    for top, name in (image_names or []):
        segments.append((top, 'image', f'![이미지](images/{name})'))

    segments.sort(key=lambda s: s[0])
    return segments


def extract_page_images(mupdf_page, page_index, images_dir):
    """페이지 이미지 추출 → (top, 파일명) 리스트. images/pageNNN_imgNN.ext"""
    out = []
    for i, img in enumerate(mupdf_page.get_images(full=True)):
        xref = img[0]
        rects = mupdf_page.get_image_rects(xref)
        if not rects:
            continue
        try:
            data = mupdf_page.parent.extract_image(xref)
        except Exception:
            continue
        ext = data.get('ext', 'png')
        name = f'page{page_index:03d}_img{i:02d}.{ext}'
        if images_dir:
            os.makedirs(images_dir, exist_ok=True)
            with open(os.path.join(images_dir, name), 'wb') as f:
                f.write(data['image'])
        out.append((rects[0].y0, name))
    return out


def convert(pdf_path, images_dir=None):
    """PDF → MD 본문"""
    segments = []
    mudoc = pymupdf.open(pdf_path)
    with pdfplumber.open(pdf_path) as pdf:
        for pi, page in enumerate(pdf.pages):
            image_names = []
            if pi < len(mudoc):
                image_names = extract_page_images(mudoc[pi], pi, images_dir)
            segments.extend(page_to_md(page, image_names))
    mudoc.close()
    # 표 앞뒤는 빈 줄로 분리 (페이지 경계에서 표가 붙어 깨지는 것 방지)
    out = []
    prev_kind = None
    for _, kind, content in segments:
        if kind != 'text' or prev_kind != 'text':
            out.append('')
        out.append(content)
        prev_kind = kind
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def whitespace_ratio(text):
    if not text:
        return 0
    return sum(1 for c in text if c in ' \t') / len(text) * 100


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    pdfs = collect_pdfs()
    report = []
    for subdir, pdf_path in pdfs:
        basename = os.path.splitext(os.path.basename(pdf_path))[0]
        if only and only not in basename:
            continue
        out_dir = os.path.join(OUT_DIR, basename)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, basename + '.md')
        try:
            body = convert(pdf_path, os.path.join(out_dir, 'images'))
        except Exception as e:
            print(f'FAIL {basename}: {e}')
            report.append({'doc': basename, 'error': str(e)})
            continue
        md = f'# {basename}\n\n{body}\n'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(md)
        n_tables = md.count('|---') + md.count('| ---')
        report.append({
            'doc': basename, 'src': subdir,
            'chars': len(body), 'lines': body.count('\n') + 1,
            'ws': round(whitespace_ratio(body), 1), 'tables': n_tables,
        })
        print(f'OK {basename}: {len(body):,}자, 공백 {report[-1]["ws"]}%, 표 {n_tables}')
    with open(os.path.join(OUT_DIR, '_report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f'\n총 {len(report)}개 → {OUT_DIR}')


if __name__ == '__main__':
    main()
