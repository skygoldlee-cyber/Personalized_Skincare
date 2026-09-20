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
    # 병합 후 열 수 재계산 (구분선이 데이터 행보다 길어지는 것 방지)
    width = max(len(r) for r in rows)
    rows = [r + [''] * (width - len(r)) for r in rows]
    out = []
    out.append('| ' + ' | '.join(rows[0]) + ' |')
    out.append('| ' + ' | '.join(['---'] * width) + ' |')
    for r in rows[1:]:
        out.append('| ' + ' | '.join(r) + ' |')
    return '\n'.join(out)


def fill_empty_cells(page, table, rows):
    """격자선 누락으로 None이 된 셀을 셀 bbox 기준 단어로 채운다.

    색소 #92 '카라멜'처럼 셀 경계선이 끊긴 경우 extract()가 None을 반환하지만
    단어는 행 밴드 안에 존재한다. 다른 행의 정상 셀 x 범위를 열 밴드로 삼아
    해당 행 y 범위 내의 고아 단어를 빈 셀에 배정한다.
    """
    if not rows:
        return rows
    ncols = max(len(r) for r in rows)
    # 열 x 밴드: 정상 셀 bbox의 (x0, x2) 중앙값
    bands = [[] for _ in range(ncols)]
    for ri, row in enumerate(table.rows):
        if ri >= len(rows):
            break
        for ci, cb in enumerate(row.cells):
            if ci < ncols and cb is not None and ri < len(rows) \
                    and ci < len(rows[ri]) and rows[ri][ci]:
                bands[ci].append((cb[0], cb[2]))
    xb = []
    for ci in range(ncols):
        if bands[ci]:
            xs0 = sorted(b[0] for b in bands[ci])
            xs1 = sorted(b[1] for b in bands[ci])
            xb.append((xs0[len(xs0) // 2], xs1[len(xs1) // 2]))
        else:
            xb.append(None)
    words = page.extract_words()
    for ri, row in enumerate(table.rows):
        if ri >= len(rows):
            break
        yb = row.bbox  # (x0, top, x1, bottom)
        if not yb:
            continue
        # 같은 행의 형제 셀 bbox — 가로 병합 셀은 빈 칸이 아니라 병합 영역이므로
        # 병합 셀 범위 안에 드는 열 밴드는 채우지 않는다
        siblings = [cb for cb in row.cells if cb]
        for ci in range(min(ncols, len(rows[ri]))):
            if rows[ri][ci] or not xb[ci]:
                continue
            bx0, bx2 = xb[ci]
            cx = (bx0 + bx2) / 2
            if any(sb[0] + 3 < cx < sb[2] - 3
                   and sb[1] - 3 < (yb[1] + yb[3]) / 2 < sb[3] + 3
                   for sb in siblings):
                continue
            hit = [w['text'] for w in words
                   if w['top'] >= yb[1] - 2 and w['bottom'] <= yb[3] + 2
                   and bx0 - 3 <= (w['x0'] + w['x1']) / 2 <= bx2 + 3]
            if hit:
                rows[ri][ci] = ' '.join(hit)
    return rows


# 무선 표 본문 재구성용 — 행 시작 마커 (가. / 가) / (가) / 1) / 1. / (1))
ROW_MARKER_RE = re.compile(r'^\s*\(?[가-힣\d]+[.)]')
# 재구성 구간에서 제외할 잡행 (페이지 번호, 문서 머리말)
JUNK_LINE_RE = re.compile(r'^\s*(?:-\s*\d+\s*-|■.*별표|\d+\s*페이지)\s*$')


def table_x_edges(table):
    """표 셀 bbox의 x 경계 목록 → 열 밴드 경계"""
    edges = sorted({e for row in table.rows for c in row.cells if c
                    for e in (c[0], c[2])})
    return edges


def reconstruct_borderless(page, edges, y_min, exclude_bboxes):
    """무선(격자선 없는) 표 본문을 열 밴드로 재구성.

    헤더 표에서 학습한 x 경계로 단어를 열에 배정하고, 행 마커
    (가. / 1) / 1.)로 논리 행을 나눈다. wrap 조각(이전 조각이 열 오른쪽
    끝까지 찬 경우)은 ''로, 그 외는 ' '로 병합한다.

    반환: (md_table, consumed_y_intervals, header_cells) — 재구성할
    칼럼형 줄이 부족하면 (None, [], None).
    """
    words = page.extract_words()
    words = [w for w in words if w['top'] > y_min
             and not any(point_in_bbox(w['x0'], w['top'], bb)
                         for bb in exclude_bboxes)]
    if len(words) < 15:
        return None, [], None

    # 줄 클러스터 (top ±3)
    lines = []
    for w in sorted(words, key=lambda w: (w['top'], w['x0'])):
        if lines and abs(w['top'] - lines[-1][-1]['top']) <= 3:
            lines[-1].append(w)
        else:
            lines.append([w])
    line_objs = []
    for ws in lines:
        ws.sort(key=lambda w: w['x0'])
        txt = ' '.join(w['text'] for w in ws)
        if JUNK_LINE_RE.match(txt):
            continue
        line_objs.append((min(w['top'] for w in ws),
                          max(w['bottom'] for w in ws), ws))

    ncols = len(edges) - 1

    def band_of(w):
        cx = (w['x0'] + w['x1']) / 2
        for i in range(ncols):
            if edges[i] - 2 <= cx < edges[i + 1]:
                return i
        return 0 if cx < edges[0] else ncols - 1

    aligned = sum(1 for _, _, ws in line_objs
                  if len({band_of(w) for w in ws}) >= 2)
    if aligned < 5:
        return None, [], None

    # 논리 행 그룹핑: 첫 단어가 col0이고 행 마커로 시작하면 새 행
    groups = []
    for top, bottom, ws in line_objs:
        txt = ' '.join(w['text'] for w in ws)
        if not groups or (band_of(ws[0]) == 0 and ROW_MARKER_RE.match(txt)):
            groups.append([])
        groups[-1].append(ws)

    rows_out = []
    for g in groups:
        cells = [''] * ncols
        prev_x1 = [None] * ncols
        for ws in g:
            frags = {}
            for w in ws:
                frags.setdefault(band_of(w), []).append(w)
            for b, wl in frags.items():
                frag = ' '.join(x['text'] for x in wl)
                fx1 = max(x['x1'] for x in wl)
                if cells[b]:
                    wrap = prev_x1[b] is not None and prev_x1[b] >= edges[b + 1] - 15
                    cells[b] += ('' if wrap else ' ') + frag
                else:
                    cells[b] = frag
                prev_x1[b] = fx1
        if any(cells):
            rows_out.append(cells)

    if len(rows_out) < 3:
        return None, [], None
    md = table_to_md(rows_out)
    ivs = [(top, bottom) for top, bottom, _ in line_objs]
    return md, ivs, rows_out


def promote_text_header(segments):
    """표 직전의 텍스트 줄이 표 헤더이면 표 안으로 승격한다.

    pdfplumber가 헤더 행의 밑줄선을 못 잡아 헤더가 표 밖 텍스트로
    남는 경우(예: '연번 성분명 CAS 등록번호')에 대응. 토큰 수가 표 열
    수와 같고 표 첫 행이 데이터형(숫자 시작)일 때만 적용한다.
    """
    for i in range(1, len(segments)):
        tk, tc = segments[i][1], segments[i][2]
        pk, pc = segments[i - 1][1], segments[i - 1][2]
        if tk != 'table' or pk != 'text':
            continue
        if segments[i][0] - segments[i - 1][0] > 60:
            continue
        lines = tc.split('\n')
        if len(lines) < 2 or not lines[1].lstrip().startswith('| ---'):
            continue
        ncols = lines[0].count('|') - 1
        toks = pc.split()
        if len(toks) != ncols or not re.match(r'^\|\s*\d+\s*\|', lines[0]):
            continue
        data0 = lines[0]
        lines[0] = '| ' + ' | '.join(toks) + ' |'
        lines.insert(2, data0)
        segments[i] = (segments[i][0], 'table', '\n'.join(lines))
        segments[i - 1] = (segments[i - 1][0], 'text', None)
    return [s for s in segments if s[2] is not None]


# 페이지 경계 등으로 끊긴 표의 이어지는 데이터 행 첫 셀 패턴
# (마커 단독 셀 '| 92 |' 또는 마커+본문 셀 '| 가. 법 제3조…' 모두 허용)
DATA_ROW_START_RE = re.compile(
    r'^\|\s*(?:\d+|[가-힣]\.|\d+\)|[IVX]+\.)(?:\s*\||\s)')


def _norm_row(line, w):
    cells = [c.strip() for c in line.strip().strip('|').split('|')]
    cells += [''] * (w - len(cells))
    return '| ' + ' | '.join(cells[:w]) + ' |'


def _cells_subset(a, b):
    """a의 각 셀이 ''이거나 b의 같은 위치 셀에 포함되면 True (반복 헤더 판별)"""
    ca = [c.strip() for c in a.strip().strip('|').split('|')]
    cb = [c.strip() for c in b.strip().strip('|').split('|')]
    if len(ca) != len(cb):
        return False
    return all(not x or x in y for x, y in zip(ca, cb))


def merge_continuation_tables(segments):
    """페이지 경계로 끊긴 인접 표 세그먼트를 병합한다.

    다음 페이지에서 별도 표로 감지된 이어지는 표는 첫 데이터 행이
    헤더로 오인된다. 사이에 텍스트가 없고(잡행 텍스트는 건너뜀),
    두 번째 표의 첫 행이 데이터 행이거나 앞 표 헤더의 반복이며
    열 수가 ±1 이내로 같으면 하나로 합친다.
    """
    out = []
    for seg in segments:
        if seg[1] == 'table':
            j = len(out) - 1
            while (j >= 0 and out[j][1] == 'text'
                   and JUNK_LINE_RE.match(out[j][2] or '')):
                j -= 1
            if j >= 0 and out[j][1] == 'table':
                prev = out[j][2].split('\n')
                cur = seg[2].split('\n')
                is_rep_header = (len(prev) >= 1
                                 and _cells_subset(cur[0], prev[0]))
                cont = (len(cur) >= 2
                        and cur[1].lstrip().startswith('| ---')
                        and (DATA_ROW_START_RE.match(cur[0])
                             or is_rep_header))
                if cont:
                    pw = prev[0].count('|') - 1
                    cw = cur[0].count('|') - 1
                    if abs(pw - cw) <= 1:
                        w = max(pw, cw)
                        # 반복 헤더면 cur[0]도 버리고, 데이터 행이면 cur[0] 유지
                        tail = cur[2:] if is_rep_header else [cur[0]] + cur[2:]
                        merged = ([_norm_row(l, w) for l in prev]
                                  + [_norm_row(l, w) for l in tail])
                        out[j] = (out[j][0], 'table', '\n'.join(merged))
                        continue
        out.append(seg)
    return out


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


def page_to_md(page, image_names=None, state=None):
    """페이지 → (텍스트 줄, 표, 이미지) 세그먼트를 y순 병합"""
    if state is None:
        state = {}
    tables = list(page.find_tables())
    # 선 기반 표가 인접 데이터 열을 누락했으면 텍스트 정렬 전략으로 재시도
    if count_orphan_data(page, tables) >= 3:
        alt = list(page.find_tables(table_settings=TEXT_TABLE_SETTINGS))
        if alt and count_orphan_data(page, alt) < count_orphan_data(page, tables):
            tables = alt
    bboxes = [t.bbox for t in tables]

    segments = []
    consumed = []  # 재구성으로 소비된 y 구간 (텍스트 추출에서 제외)
    for t in tables:
        rows = fill_empty_cells(page, t, t.extract())
        md = table_to_md(rows)
        if md:
            segments.append((t.bbox[1], 'table', md))
        # 헤더만 잡힌 표(≤3행, ≥5열, 셀 내 줄바꿈 적음) → 열 경계를
        # 학습하고 하단 무선 본문 재구성. 셀에 줄바꿈이 많은 표는
        # 실제로는 행이 셀 안으로 합쳐진 완성형 표이므로 제외한다.
        nl = sum((c or '').count('\n') for r in rows for c in r)
        if rows and len(rows) <= 3 and len(rows[0]) >= 5 and nl <= 6:
            edges = table_x_edges(t)
            if len(edges) >= 6:
                state['bands'] = edges
                state['header'] = [cell_text(c) for c in rows[0]]
                rec, ivs, _ = reconstruct_borderless(
                    page, edges, t.bbox[3], bboxes)
                if rec:
                    segments.append((t.bbox[3], 'table', rec))
                    consumed.extend(ivs)

    # 무표 페이지 — 이전 페이지에서 학습한 열 밴드로 이어지는 표 재구성.
    # 재구성이 실패하면 표가 끝난 것으로 보고 밴드를 만료한다
    # (일반 텍스트 페이지를 가짜 표로 삼키는 것 방지).
    if not tables and state.get('bands'):
        rec, ivs, _ = reconstruct_borderless(page, state['bands'], 0, [])
        if rec:
            hdr = state.get('header')
            if hdr:
                rl = rec.split('\n')
                rec = '| ' + ' | '.join(hdr) + ' |\n' + \
                    '| ' + ' | '.join(['---'] * len(hdr)) + ' |\n' + \
                    '\n'.join(rl[:1] + rl[2:])
            segments.append((0, 'table', rec))
            consumed.extend(ivs)
        else:
            state['bands'] = None

    # 표 영역·재구성 소비 구간 밖 문자만 남겨 텍스트 추출
    def keep_char(obj):
        if obj['object_type'] != 'char':
            return True
        cy = (obj['top'] + obj['bottom']) / 2
        if any(point_in_bbox(obj['x0'], cy, bb) for bb in bboxes):
            return False
        if any(y0 - 2 <= cy <= y1 + 2 for y0, y1 in consumed):
            return False
        return True

    filtered = page.filter(keep_char) if (bboxes or consumed) else page

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
    state = {}  # 페이지 간 열 밴드/헤더 유지 (무선 표 연속 페이지용)
    mudoc = pymupdf.open(pdf_path)
    with pdfplumber.open(pdf_path) as pdf:
        for pi, page in enumerate(pdf.pages):
            image_names = []
            if pi < len(mudoc):
                image_names = extract_page_images(mudoc[pi], pi, images_dir)
            segments.extend(page_to_md(page, image_names, state))
    mudoc.close()
    segments = promote_text_header(segments)
    segments = merge_continuation_tables(segments)
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
