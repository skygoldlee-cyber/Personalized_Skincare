#!/usr/bin/env python3
"""pdf2md — 한국어 법령·참조 PDF → Markdown 일반화 변환기 (pdfplumber 기반)

convert_ref_pdfs_v2.py의 변환 엔진(좌표 공백 복원 + 표 구조화 + 무선 표
재구성 + 페이지 경계 표 병합 + 러닝 머리말/워터마크 제거 + 이미지 추출)을
그대로 계승하되, 프로젝트 고정 경로/스테이징 워크플로를 걷어내고 임의 입력에
쓸 수 있게 일반화했다. 표 로직은 원본과 바이트 동일하다.

추가:
  · 문장 단위 병합 — PDF의 시각적 wrap 줄을 구조 마커(제N조/①/1./가.)와
    문장 종결(~다./.) 기준의 논리 단위 한 줄로 접는다. (--no-segment로 끔)
    ⚠ 주의: 병합은 라인 번호를 크게 바꾼다. `#L####` 라인 인용이 있는
    산출물(이 프로젝트의 ref_md)에는 --no-segment로 변환할 것.
  · 표 건강 점검 — 변환된 표의 빈 셀 비율/행 수를 --doctor로 리포트한다.

사용:
  python pdf2md.py <입력...>            # 파일/디렉토리/glob (없으면 --pdf-root 스캔)
  python pdf2md.py ./refs -o ./out      # ./refs 아래 모든 PDF → ./out/{name}/{name}.md
  python pdf2md.py 화장품법               # 경로가 아니면 파일명 필터로 동작 (구버전 호환)
  python pdf2md.py --no-segment ...      # 문장 병합 없이 시각적 줄 그대로
  python pdf2md.py --doctor ...          # 변환 후 표 건강도 출력
  python pdf2md.py --verify [-o OUT --gold GOLD]  # 골든 비교 (내용 누락 감지)
  python pdf2md.py --profile p.json ...  # 도메인 패턴(잡행/워터마크/마커) 오버라이드

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
import argparse

sys.stdout.reconfigure(encoding='utf-8')

# ── 경로 기본값 (모두 CLI로 오버라이드 가능) ──────────────────────────────
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DEFAULT_PDF_ROOT = os.path.join(BASE, 'content', '참조자료')
# 입력 스캔에서 제외할 하위 디렉토리 (변환 산출물 폴더)
EXCLUDE_DIRS = {'ref_md', 'ref_md_v2', 'out', 'md'}

# ── 도메인 프로파일 (한국어 법령/참조 기본값) ─────────────────────────────
# --profile FILE.json 의 동일 키로 덮어쓸 수 있다. 값은 정규식 문자열/숫자.
PROFILE = {
    # 무선 표 본문 재구성용 행 시작 마커 (가. / 가) / (가) / 1) / 1. / (1))
    'row_marker':  r'^\s*\(?[가-힣\d]+[.)]',
    # 재구성 구간에서 제외할 잡행 (쪽번호/머리말/워터마크)
    'junk_line':   r'^\s*(?:-\s*\d+\s*-|■.*별표|\d+\s*페이지|.*국가법령정보센터.*)\s*$',
    # 번호가 바뀌어 빈도 집계에 안 잡히는 반복 꼬리말(워터마크)
    'watermark':   r'국가법령정보센터|법제처\s+\d+',
    'page_num':    r'^-?\s*\d{1,4}\s*-?$',
    'margin_pt':          45,    # 상·하단 마진 대역(pt)
    'margin_freq_min':    3,     # 러닝 머리말 최소 반복 페이지 수
    'margin_freq_ratio':  0.4,   # 문서 페이지의 40%+에서 반복
    # 문장 단위 병합 — 새 논리 단위를 여는 구조 마커
    'struct_marker': r'^\s*(?:제\d+조(?:의\d+)?|[①-⑮]|\(\d+\)|\d+\)|\d+\.'
                     r'|[가-힣][.)]|\([가-힣]\)|[IVXivx]+[.)])',
    # 단위가 "닫혔다"고 볼 종결 (이 뒤 줄은 새 단위로 시작)
    'unit_closed':  r'(?:[.。:!?]|다|음|함)["」\'\)\]]*\s*$',
    'segment': True,   # 문장 단위 병합 on/off (--no-segment로 False)
}


def _compile_globals():
    """PROFILE 문자열 → 엔진이 참조하는 모듈 전역(정규식/숫자)로 컴파일"""
    g = globals()
    g['ROW_MARKER_RE']    = re.compile(PROFILE['row_marker'])
    g['JUNK_LINE_RE']     = re.compile(PROFILE['junk_line'])
    g['WATERMARK_RE']     = re.compile(PROFILE['watermark'])
    g['PAGE_NUM_RE']      = re.compile(PROFILE['page_num'])
    g['STRUCT_MARKER_RE'] = re.compile(PROFILE['struct_marker'])
    g['UNIT_CLOSED_RE']   = re.compile(PROFILE['unit_closed'])
    g['MARGIN_PT']         = PROFILE['margin_pt']
    g['MARGIN_FREQ_MIN']   = PROFILE['margin_freq_min']
    g['MARGIN_FREQ_RATIO'] = PROFILE['margin_freq_ratio']


def load_profile(path):
    """JSON 프로파일을 PROFILE에 병합하고 전역을 재컴파일한다."""
    with open(path, encoding='utf-8') as f:
        prof = json.load(f)
    unknown = [k for k in prof if k not in PROFILE]
    if unknown:
        print(f'경고: 알 수 없는 프로파일 키 무시 — {", ".join(unknown)}')
    PROFILE.update({k: v for k, v in prof.items() if k in PROFILE})
    _compile_globals()


_compile_globals()


# ── 변환 엔진 (convert_ref_pdfs_v2.py 원본과 바이트 동일) ──────────────────
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
    words = _words(page)
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

def collect_margin_junk(pdf):
    """페이지 상·하단 대역에서 문서 전체에 반복되는 텍스트 줄을 수집한다.
    (문서 제목 러닝 헤더 등. 법제처 푸터처럼 번호가 바뀌는 줄은
    WATERMARK_RE가 별도로 처리하므로 여기서는 잡히지 않아도 된다)
    """
    npages = len(pdf.pages)
    counter = {}
    for page in pdf.pages:
        h = float(page.height)
        seen = set()
        for ln in _text_lines(page):
            t = ln['text'].strip()
            if t and len(t) <= 60 \
                    and (ln['top'] < MARGIN_PT or ln['bottom'] > h - MARGIN_PT):
                seen.add(t)
        for t in seen:
            counter[t] = counter.get(t, 0) + 1
    return {t for t, c in counter.items()
            if c >= MARGIN_FREQ_MIN and c >= npages * MARGIN_FREQ_RATIO}


def _is_margin_junk(txt, top, bottom, page_h, margin_junk):
    """마진 대역 안의 잡행(러닝 헤더/워터마크/쪽번호)인지 판정"""
    if top >= MARGIN_PT and bottom <= page_h - MARGIN_PT:
        return False
    t = txt.strip()
    return (t in margin_junk
            or bool(WATERMARK_RE.search(t))
            or bool(PAGE_NUM_RE.match(t)))


def table_x_edges(table):
    """표 셀 bbox의 x 경계 목록 → 열 밴드 경계"""
    edges = sorted({e for row in table.rows for c in row.cells if c
                    for e in (c[0], c[2])})
    return edges


def reconstruct_borderless(page, edges, y_min, exclude_bboxes,
                           margin_junk=frozenset()):
    """무선(격자선 없는) 표 본문을 열 밴드로 재구성.

    헤더 표에서 학습한 x 경계로 단어를 열에 배정하고, 행 마커
    (가. / 1) / 1.)로 논리 행을 나눈다. wrap 조각(이전 조각이 열 오른쪽
    끝까지 찬 경우)은 ''로, 그 외는 ' '로 병합한다.

    반환: (md_table, consumed_y_intervals, header_cells) — 재구성할
    칼럼형 줄이 부족하면 (None, [], None).
    """
    words = [w for w in _words(page) if w['top'] > y_min
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
    page_h = float(page.height)
    line_objs = []
    for ws in lines:
        ws.sort(key=lambda w: w['x0'])
        txt = ' '.join(w['text'] for w in ws)
        if JUNK_LINE_RE.match(txt):
            continue
        lt, lb = min(w['top'] for w in ws), max(w['bottom'] for w in ws)
        if _is_margin_junk(txt, lt, lb, page_h, margin_junk):
            continue
        line_objs.append((lt, lb, ws))

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
CAS_RE = re.compile(r'\d{2,}-\d+-\d')
UNIT_RE = re.compile(r'\d+(?:\.\d+)?\s*(?:%|ppm|ppb|mg|mL|㎍|µg|g)\b', re.I)


def _words(page):
    """페이지 단위 extract_words 캐시 — fill_empty_cells(표마다 호출),
    재구성, 고아 탐지가 같은 단어 목록을 공유한다."""
    w = getattr(page, '_pdf2md_words', None)
    if w is None:
        w = page.extract_words()
        page._pdf2md_words = w
    return w


def _text_lines(page):
    """페이지 단위 extract_text_lines 캐시"""
    lines = getattr(page, '_pdf2md_lines', None)
    if lines is None:
        lines = page.extract_text_lines()
        page._pdf2md_lines = lines
    return lines


def count_orphan_data(page, tables):
    """표 y 범위 안에서 표 밖 데이터형 텍스트 줄 수"""
    if not tables:
        return 0
    ymin = min(t.bbox[1] for t in tables) - 5
    ymax = max(t.bbox[3] for t in tables) + 5
    bboxes = [t.bbox for t in tables]
    orphan = 0
    for line in _text_lines(page):
        if ymin <= line['top'] <= ymax:
            outside = not any(
                point_in_bbox(line['x0'], line['top'], bb) or
                point_in_bbox(line['x1'], line['top'], bb)
                for bb in bboxes
            )
            # 숫자 시작 행, CAS 번호, 단위 토큰 2개+ (이름이 선행하는
            # 데이터 행 — 예: '카라멜 (Caramel) 5% 10ppm' — 도 탐지)
            txt = line['text']
            if outside and (DATA_LINE_RE.match(txt) or CAS_RE.search(txt)
                            or len(UNIT_RE.findall(txt)) >= 2):
                orphan += 1
    return orphan


def page_to_md(page, image_names=None, state=None, margin_junk=frozenset()):
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
                    page, edges, t.bbox[3], bboxes, margin_junk)
                if rec:
                    segments.append((t.bbox[3], 'table', rec))
                    consumed.extend(ivs)

    # 무표 페이지 — 이전 페이지에서 학습한 열 밴드로 이어지는 표 재구성.
    # 재구성이 실패하면 표가 끝난 것으로 보고 밴드를 만료한다
    # (일반 텍스트 페이지를 가짜 표로 삼키는 것 방지).
    if not tables and state.get('bands'):
        rec, ivs, _ = reconstruct_borderless(
            page, state['bands'], 0, [], margin_junk)
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

    page_h = float(page.height)
    for line in filtered.extract_text_lines():
        if _is_margin_junk(line['text'], line['top'], line['bottom'],
                           page_h, margin_junk):
            continue
        segments.append((line['top'], 'text', line['text']))

    # 이미지 위치에 참조 삽입
    for top, name in (image_names or []):
        segments.append((top, 'image', f'![이미지](images/{name})'))

    segments.sort(key=lambda s: s[0])
    return segments


def extract_page_images(mupdf_page, page_index, images_dir,
                        name_prefix=''):
    """페이지 이미지 추출 → (top, 파일명) 리스트. images/{prefix}pageNNN_imgNN.ext

    --flat 모드처럼 여러 문서가 images/를 공유할 때는 name_prefix로
    문서명을 붙여 파일명 충돌을 막는다.
    """
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
        name = f'{name_prefix}page{page_index:03d}_img{i:02d}.{ext}'
        if images_dir:
            os.makedirs(images_dir, exist_ok=True)
            with open(os.path.join(images_dir, name), 'wb') as f:
                f.write(data['image'])
        out.append((rects[0].y0, name))
    return out

def convert(pdf_path, images_dir=None, image_prefix=''):
    """PDF → MD 본문. image_prefix는 --flat 같이 images/를 공유하는
    출력 모드에서 파일명 충돌 방지용 접두사."""
    segments = []
    state = {}  # 페이지 간 열 밴드/헤더 유지 (무선 표 연속 페이지용)
    mudoc = pymupdf.open(pdf_path)
    with pdfplumber.open(pdf_path) as pdf:
        margin_junk = collect_margin_junk(pdf)
        for pi, page in enumerate(pdf.pages):
            image_names = []
            if pi < len(mudoc):
                image_names = extract_page_images(
                    mudoc[pi], pi, images_dir, image_prefix)
            segments.extend(page_to_md(page, image_names, state,
                                       margin_junk))
    mudoc.close()
    segments = promote_text_header(segments)
    segments = merge_continuation_tables(segments)
    segments = segment_sentences(segments)   # 문장 단위 병합 (표/이미지 경계에서 리셋)
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
def _norm_cmp(t):
    """비교용 정규화 — 표 파이프·공백·마크업을 제거해 병합/분할된 줄도 매칭"""
    return re.sub(r'[\s*_`#>|「」()\[\]-]+', '', t)


def _is_junk_cmp(t):
    """골든 비교에서 제외할 잡행 — 워터마크/쪽번호/재구성 잡행"""
    t = t.strip()
    return (not t or WATERMARK_RE.search(t) or PAGE_NUM_RE.match(t)
            or bool(JUNK_LINE_RE.match(t)))


# ── 문장 단위 병합 ────────────────────────────────────────────────────────
def segment_sentences(segments):
    """PDF 시각적 wrap 줄을 논리 단위 한 줄로 접는다 (표/이미지 경계에서 리셋).

    규칙(보수적): 현재 줄이 구조 마커(제N조/①/1./가.)로 시작하면 새 단위,
    이전 단위가 종결(~다./.)로 닫혔으면 새 단위, 그 외에는 wrap 연속으로 보고
    이전 단위에 공백으로 병합한다. 한국어 법령 PDF는 어절 단위 줄바꿈이라
    공백 병합이 안전하다.
    """
    if not PROFILE.get('segment', True):
        return segments
    out = []
    for seg in segments:
        y, kind, content = seg
        if (kind == 'text' and content is not None
                and out and out[-1][1] == 'text'):
            prev = out[-1][2]
            cur = content.strip()
            if (cur and not STRUCT_MARKER_RE.match(cur)
                    and not UNIT_CLOSED_RE.search(prev.strip())):
                out[-1] = (out[-1][0], 'text', prev.rstrip() + ' ' + cur)
                continue
        out.append(seg)
    return out


# ── 표 건강 점검 (--doctor) ───────────────────────────────────────────────
def _md_table_blocks(md):
    """MD 본문에서 연속된 표 줄 블록(파이프로 시작)을 추출"""
    blocks, cur = [], []
    for ln in md.split('\n'):
        if ln.lstrip().startswith('|'):
            cur.append(ln)
        else:
            if len(cur) >= 2:
                blocks.append('\n'.join(cur))
            cur = []
    if len(cur) >= 2:
        blocks.append('\n'.join(cur))
    return blocks


def table_health(block):
    lines = block.split('\n')

    def cells(l):
        return [c.strip() for c in l.strip().strip('|').split('|')]

    header = cells(lines[0])
    body = [cells(l) for l in lines[2:]] if len(lines) > 2 else []
    total = sum(len(r) for r in body) or 1
    empty = sum(1 for r in body for c in r if not c)
    ragged = len({len(r) for r in body} | {len(header)}) > 1
    return {
        'cols': len(header), 'rows': len(body),
        'empty_pct': round(empty / total * 100, 1), 'ragged': ragged,
    }


def doctor_report(basename, md):
    flags = []
    for i, blk in enumerate(_md_table_blocks(md), 1):
        h = table_health(blk)
        why = []
        if h['cols'] < 2:
            why.append('열<2')
        if h['rows'] < 1:
            why.append('데이터행 없음')
        if h['empty_pct'] > 40:
            why.append(f"빈셀 {h['empty_pct']}%")
        if h['ragged']:
            why.append('열수 불균일')
        if why:
            flags.append((i, h, why, blk.split('\n')[0][:70]))
    if flags:
        print(f'  ⚠ {basename}: 표 {len(flags)}개 점검 필요')
        for i, h, why, head in flags:
            print(f'    표#{i} ({h["cols"]}열×{h["rows"]}행) {", ".join(why)} — {head}')
    return len(flags)


# ── 입력 해석 (경로 또는 파일명 필터) ─────────────────────────────────────
def _labeled(path):
    return (os.path.basename(os.path.dirname(os.path.abspath(path))) or '.',
            os.path.abspath(path))


def _scan_dir(root, apply_excludes=False):
    """root 아래 PDF 재귀 스캔. apply_excludes는 변환 산출물 폴더가
    섞여 있는 기본 pdf_root 스캔에만 적용한다 — 명시적 입력 디렉터리의
    'md'/'out' 같은 폴더명은 사용자 의도로 존중한다."""
    found = []
    for dirpath, dirnames, filenames in os.walk(root):
        if apply_excludes:
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn.lower().endswith('.pdf'):
                found.append(_labeled(os.path.join(dirpath, fn)))
    return found


def collect_pdfs(tokens, pdf_root):
    """tokens = PDF 파일/디렉토리/glob 또는 (경로가 아니면) 파일명 필터.
    경로 입력이 하나라도 있으면 그것만, 없으면 pdf_root를 스캔하며 필터 적용."""
    path_pdfs, filters = [], []
    for tok in tokens:
        if any(c in tok for c in '*?['):
            hits = [h for h in glob.glob(tok) if h.lower().endswith('.pdf')]
            if hits:
                path_pdfs += [_labeled(h) for h in hits]
            else:
                filters.append(tok)
        elif os.path.isfile(tok) and tok.lower().endswith('.pdf'):
            path_pdfs.append(_labeled(tok))
        elif os.path.isdir(tok):
            path_pdfs += _scan_dir(tok)
        else:
            filters.append(tok)

    if path_pdfs:
        pdfs = path_pdfs
    else:
        pdfs = _scan_dir(pdf_root, apply_excludes=True)
        if filters:
            pdfs = [(l, p) for (l, p) in pdfs
                    if any(f in os.path.basename(p) for f in filters)]

    seen, uniq = set(), []
    for lbl, p in pdfs:
        if p not in seen:
            seen.add(p)
            uniq.append((lbl, p))
    return sorted(uniq, key=lambda x: os.path.basename(x[1]))


# ── 골든 비교 (내용 누락 감지) ────────────────────────────────────────────
def verify(out_dir, gold_dir, only=None):
    """{out}/{doc}/{doc}.md(중첩) 또는 {out}/{doc}.md(--flat) 출력을
    gold 디렉터리(항상 중첩 구조)와 비교한다."""
    if not os.path.isdir(out_dir):
        print(f'출력 없음: {out_dir} — 먼저 변환을 실행하세요.')
        return 1
    if only:
        # 경로가 넘어와도 문서명 기준으로 비교
        only = os.path.splitext(os.path.basename(only))[0]
    # 중첩 구조 우선, 없으면 flat .md를 탐색
    pairs = []  # (문서명, 신규 md 경로)
    for d in sorted(os.listdir(out_dir)):
        p = os.path.join(out_dir, d)
        if os.path.isdir(p):
            md = os.path.join(p, d + '.md')
            if os.path.exists(md):
                pairs.append((d, md))
    if not pairs:
        for fn in sorted(os.listdir(out_dir)):
            if fn.lower().endswith('.md') and fn != '_report.json':
                pairs.append((os.path.splitext(fn)[0],
                              os.path.join(out_dir, fn)))
    bad_docs = []
    compared = 0
    print(f'{"문서":<44} {"기존":>6} {"신규":>6} {"누락":>4}')
    print('-' * 70)
    for d, new_p in pairs:
        if only and only not in d:
            continue
        compared += 1
        old_p = os.path.join(gold_dir, d, d + '.md')
        new_text = open(new_p, encoding='utf-8').read()
        new_lines = new_text.split('\n')
        new_count = {}
        for l in new_lines:
            s = l.strip()
            if s:
                new_count[s] = new_count.get(s, 0) + 1
        new_all = _norm_cmp(new_text)
        new_n = sum(1 for l in new_lines if not _is_junk_cmp(l))
        if not os.path.exists(old_p):
            print(f'{d[:44]:<44} {"(신규)":>6} {new_n:>6} {"-":>4}')
            continue
        old_text = open(old_p, encoding='utf-8').read()
        missing = []
        old_n = 0
        for l in old_text.split('\n'):
            if _is_junk_cmp(l):
                continue
            old_n += 1
            s = l.strip()
            if new_count.get(s, 0) > 0:
                new_count[s] -= 1
                continue
            n = _norm_cmp(s)
            if len(n) >= 8 and n in new_all:
                continue
            missing.append(s)
        mark = ' ⚠' if missing else ''
        print(f'{d[:44]:<44} {old_n:>6} {new_n:>6} {len(missing):>4}{mark}')
        if missing:
            bad_docs.append((d, missing))
    print('-' * 70)
    for d, missing in bad_docs:
        print(f'\n[누락] {d} — {len(missing)}줄')
        for l in missing[:10]:
            print('   -', l[:80])
        if len(missing) > 10:
            print(f'   … 외 {len(missing) - 10}줄')
    print(f'\n검증: {compared}개 문서, 내용 누락 문서 {len(bad_docs)}개')
    return len(bad_docs)


# ── CLI ───────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description='한국어 법령·참조 PDF → Markdown 변환기',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('inputs', nargs='*',
                    help='PDF 파일/디렉토리/glob. 경로가 아니면 파일명 필터로 동작. '
                         '생략 시 --pdf-root 를 스캔')
    ap.add_argument('--pdf-root', default=DEFAULT_PDF_ROOT,
                    help=f'기본 스캔 루트 (기본: {DEFAULT_PDF_ROOT})')
    ap.add_argument('-o', '--out', default=None,
                    help='출력 디렉토리 (기본: <pdf-root>/ref_md_v2)')
    ap.add_argument('--gold', default=None,
                    help='--verify 비교 대상 (기본: <pdf-root>/ref_md)')
    ap.add_argument('--flat', action='store_true',
                    help='{out}/{name}.md 로 평면 출력 (기본: {out}/{name}/{name}.md)')
    ap.add_argument('--no-images', action='store_true', help='이미지 추출 생략')
    ap.add_argument('--no-segment', action='store_true',
                    help='문장 단위 병합 없이 PDF 시각적 줄 그대로')
    ap.add_argument('--profile', help='도메인 패턴 오버라이드 JSON')
    ap.add_argument('--doctor', action='store_true', help='변환 후 표 건강도 점검')
    ap.add_argument('--verify', action='store_true',
                    help='변환 없이 골든 비교(내용 누락 감지)만 수행')
    args = ap.parse_args()

    if args.profile:
        load_profile(args.profile)
    if args.no_segment:
        PROFILE['segment'] = False

    out_dir = args.out or os.path.join(args.pdf_root, 'ref_md_v2')
    gold_dir = args.gold or os.path.join(args.pdf_root, 'ref_md')

    if args.verify:
        only = args.inputs[0] if args.inputs else None
        sys.exit(1 if verify(out_dir, gold_dir, only) else 0)

    pdfs = collect_pdfs(args.inputs, args.pdf_root)
    if not pdfs:
        print('변환할 PDF가 없습니다. 경로나 필터를 확인하세요.')
        sys.exit(1)

    report, flagged = [], 0
    for subdir, pdf_path in pdfs:
        basename = os.path.splitext(os.path.basename(pdf_path))[0]
        doc_dir = out_dir if args.flat else os.path.join(out_dir, basename)
        os.makedirs(doc_dir, exist_ok=True)
        out_path = os.path.join(doc_dir, basename + '.md')
        images_dir = None if args.no_images else os.path.join(doc_dir, 'images')
        # --flat은 모든 문서가 out/images/를 공유 → 파일명에 문서명 접두
        img_prefix = (basename + '_') if args.flat else ''
        try:
            body = convert(pdf_path, images_dir, img_prefix)
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
        if args.doctor:
            flagged += doctor_report(basename, md)

    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, '_report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    fails = [r for r in report if 'error' in r]
    print(f'\n총 {len(report)}개 → {out_dir}'
          + (f'  ⚠ 실패 {len(fails)}건' if fails else ''))
    if args.doctor:
        print(f'표 점검 필요 문항: {flagged}건'
              if flagged else '표 점검: 이상 없음')


if __name__ == '__main__':
    main()
