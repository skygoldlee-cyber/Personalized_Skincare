#!/usr/bin/env python3
# @spec CS-03,CS-10,PF-11
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
  python pdf2md.py                       # GUI 모드 (기본, PySide6 필요)
  python pdf2md.py --cli <입력...>        # CLI — 파일/디렉토리/glob (없으면 --pdf-root 스캔)
  python pdf2md.py --cli ./refs -o ./out # ./refs 아래 모든 PDF → ./out/{name}/{name}.md
  python pdf2md.py --cli 화장품법          # 경로가 아니면 파일명 필터로 동작 (구버전 호환)
  python pdf2md.py --cli --no-segment ... # 문장 병합 없이 시각적 줄 그대로
  python pdf2md.py --cli --doctor ...     # 변환 후 표 건강도 출력
  python pdf2md.py --cli --verify [-o OUT --gold GOLD]  # 골든 비교 (내용 누락 감지)
  python pdf2md.py --cli --profile p.json ...           # 도메인 패턴 오버라이드

셀 내 줄바꿈은 렌더링 wrap이므로 ''로 병합한다(공백 병합 시 화학명이 중간에
끊기는 것보다 wrap 경계 공백 유실이 피해가 적음 — 줄 내 공백은 좌표로 복원됨).
"""
try:
    import pdfplumber
except ImportError:
    pdfplumber = None  # --verify/--gui 기동에는 불필요 — convert() 호출 시 필요
try:
    import pymupdf
except ImportError:
    pymupdf = None  # 이미지 추출 전용 — 없어도 텍스트/표 변환은 동작
import os
import sys
import glob
import json
import logging
import re
import argparse
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed

# Windows cp949 콘솔 대응 — 한글/유니코드 안내 메시지가 깨지지 않게 UTF-8 고정.
# pythonw/캡처 래퍼처럼 stdout가 없거나 reconfigure 미지원 환경에서는 건너뜀.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# 진단 로그 — CLI는 main()에서 basicConfig, GUI는 자체 로그 위젯 경로 별도 유지.
# 라이브러리로 임포트될 때는 핸들러 없이 조용히 동작한다.
logger = logging.getLogger('pdf2md')

# ── 경로 기본값 (모두 CLI로 오버라이드 가능) ──────────────────────────────
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def _default_content_root():
    """대상 시험의 contentRoot 해석 — Node 도구(tools/build/exam_targets.js)와
    같은 env 계약. 실제 해석은 _exam_root.exam_root()로 위임한다."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        from _exam_root import exam_root
        return str(exam_root())
    except Exception:
        return os.path.join(BASE, 'content')


DEFAULT_PDF_ROOT = os.path.join(_default_content_root(), '참조자료')
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
        logger.warning('알 수 없는 프로파일 키 무시 — %s', ', '.join(unknown))
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
        """단어의 중심 x가 속한 열 밴드. edges 밖 15pt 초과 단어는 None —
        우측 마진 잡행/쪽 주석이 마지막 셀에 붙는 것을 막는다."""
        cx = (w['x0'] + w['x1']) / 2
        for i in range(ncols):
            if edges[i] - 2 <= cx < edges[i + 1]:
                return i
        if cx < edges[0]:
            return 0 if cx >= edges[0] - 15 else None
        return ncols - 1 if cx <= edges[-1] + 15 else None

    aligned = sum(1 for _, _, ws in line_objs
                  if len({b for b in (band_of(w) for w in ws)
                          if b is not None}) >= 2)
    if aligned < 5:
        return None, [], None

    # 논리 행 그룹핑: 첫 단어가 col0이고 행 마커로 시작하면 새 행
    groups = []
    for top, bottom, ws in line_objs:
        txt = ' '.join(w['text'] for w in ws)
        first_band = band_of(ws[0])
        if not groups or (first_band == 0 and ROW_MARKER_RE.match(txt)):
            groups.append([])
        groups[-1].append(ws)

    rows_out = []
    for g in groups:
        cells = [''] * ncols
        prev_x1 = [None] * ncols
        for ws in g:
            frags = {}
            for w in ws:
                b = band_of(w)
                if b is not None:
                    frags.setdefault(b, []).append(w)
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
# \b 금지: %·㎍ 같은 비단어문자 단위 뒤에는 단어 경계가 성립하지 않는다
UNIT_RE = re.compile(r'\d+(?:\.\d+)?\s*(?:%|ppm|ppb|mg|mL|㎍|µg|g)', re.I)


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
    if pdfplumber is None:
        raise RuntimeError('pdfplumber 미설치 — pip install pdfplumber')
    segments = []
    state = {}  # 페이지 간 열 밴드/헤더 유지 (무선 표 연속 페이지용)
    if images_dir and pymupdf is None:
        logger.warning('pymupdf 미설치 — 이미지 추출을 건너뜁니다 '
                       '(pip install pymupdf)')
    mudoc = pymupdf.open(pdf_path) if (images_dir and pymupdf) else None
    try:
        with pdfplumber.open(pdf_path) as pdf:
            margin_junk = collect_margin_junk(pdf)
            for pi, page in enumerate(pdf.pages):
                image_names = []
                if mudoc is not None and pi < len(mudoc):
                    image_names = extract_page_images(
                        mudoc[pi], pi, images_dir, image_prefix)
                segments.extend(page_to_md(page, image_names, state,
                                           margin_junk))
    finally:
        if mudoc is not None:
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


def _table_flag_reasons(h):
    """table_health 결과 → 점검 사유 목록 (CLI doctor·GUI 경고 공용 규칙)."""
    why = []
    if h['cols'] < 2:
        why.append('열<2')
    if h['rows'] < 1:
        why.append('데이터행 없음')
    if h['empty_pct'] > 40:
        why.append(f"빈셀 {h['empty_pct']}%")
    if h['ragged']:
        why.append('열수 불균일')
    return why


def table_flag_strings(md):
    """MD 본문의 점검 필요 표 → '표#i (CxR) 사유' 문자열 리스트 (GUI 공용)."""
    out = []
    for idx, blk in enumerate(_md_table_blocks(md), 1):
        h = table_health(blk)
        why = _table_flag_reasons(h)
        if why:
            out.append(f"표#{idx} ({h['cols']}열×{h['rows']}행) {', '.join(why)}")
    return out


def doctor_report(basename, md):
    flags = []
    for i, blk in enumerate(_md_table_blocks(md), 1):
        h = table_health(blk)
        why = _table_flag_reasons(h)
        if why:
            flags.append((i, h, why, blk.split('\n')[0][:70]))
    if flags:
        logger.warning('  ⚠ %s: 표 %d개 점검 필요', basename, len(flags))
        for i, h, why, head in flags:
            logger.warning('    표#%d (%d열×%d행) %s — %s',
                           i, h['cols'], h['rows'], ', '.join(why), head)
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


def plan_doc_jobs(pdfs, out_dir, flat=False):
    """PDF 목록 → 문서별 출력 작업 계획.

    같은 basename의 PDF가 2개 이상이면 subdir 라벨로 출력을 구분해
    무음 덮어쓰기를 막는다:
      중첩(기본): {out}/{subdir}/{name}/{name}.md — ref_md/과목N/ 골드 구조와 정합
      평면(--flat): {out}/{subdir}__{name}.md + 이미지 접두 {subdir}__{name}_

    반환 항목: doc(표시명), src(subdir), pdf, dir(doc_dir), md(출력 경로),
    images, img_prefix, collided(충돌 여부).
    """
    counts = {}
    for _, p in pdfs:
        b = os.path.splitext(os.path.basename(p))[0]
        counts[b] = counts.get(b, 0) + 1

    jobs = []
    for subdir, pdf_path in pdfs:
        base = os.path.splitext(os.path.basename(pdf_path))[0]
        collided = counts[base] > 1
        if flat:
            stem = f'{subdir}__{base}' if collided else base
            jobs.append({
                'doc': stem, 'src': subdir, 'pdf': pdf_path,
                'dir': out_dir,
                'md': os.path.join(out_dir, stem + '.md'),
                'images': os.path.join(out_dir, 'images'),
                'img_prefix': stem + '_',
                'collided': collided, 'basename': base,
            })
        else:
            rel = os.path.join(subdir, base) if collided else base
            doc_dir = os.path.join(out_dir, rel)
            jobs.append({
                'doc': rel.replace(os.sep, '/'), 'src': subdir, 'pdf': pdf_path,
                'dir': doc_dir,
                'md': os.path.join(doc_dir, base + '.md'),
                'images': os.path.join(doc_dir, 'images'),
                'img_prefix': '',
                'collided': collided, 'basename': base,
            })
    return jobs


# ── 골든 비교 (내용 누락 감지) ────────────────────────────────────────────
def verify(out_dir, gold_dir, only=None):
    """{out}/{doc}/{doc}.md(중첩, 충돌 시 {out}/{subdir}/{doc}/{doc}.md)
    또는 {out}/{doc}.md(--flat) 출력을 gold 디렉터리(중첩 구조)와 비교한다."""
    if not os.path.isdir(out_dir):
        logger.error('출력 없음: %s — 먼저 변환을 실행하세요.', out_dir)
        return 1
    if only:
        # 경로가 넘어와도 문서명 기준으로 비교. 문자열 또는 문자열 리스트.
        if isinstance(only, str):
            only = [only]
        only = [os.path.splitext(os.path.basename(f))[0] for f in only]
    # 중첩 구조 우선 — {out}/{d}/{d}.md 와 충돌 구분용 {out}/{s}/{d}/{d}.md
    # 모두 탐색 (부모 디렉터리명이 파일 stem과 일치하는 .md만 문서로 인식).
    # 없으면 flat .md를 탐색한다.
    pairs = []  # (문서명: out_dir 상대경로, 신규 md 경로)
    for dirpath, _dirnames, filenames in os.walk(out_dir):
        for fn in filenames:
            if not fn.lower().endswith('.md'):
                continue
            stem = os.path.splitext(fn)[0]
            if os.path.basename(dirpath) == stem:
                rel = os.path.relpath(dirpath, out_dir).replace(os.sep, '/')
                pairs.append((rel, os.path.join(dirpath, fn)))
    if not pairs:
        for fn in sorted(os.listdir(out_dir)):
            if fn.lower().endswith('.md'):
                pairs.append((os.path.splitext(fn)[0],
                              os.path.join(out_dir, fn)))
    pairs.sort(key=lambda x: x[0])
    bad_docs = []
    compared = 0
    print(f'{"문서":<44} {"기존":>6} {"신규":>6} {"누락":>4}')
    print('-' * 70)
    for d, new_p in pairs:
        if only and not any(f in d for f in only):
            continue
        compared += 1
        stem = os.path.basename(d)
        # gold는 ref_md/과목N/{d}/{d}.md (과목 서브디렉터리) 또는 평탄 {d}/{d}.md.
        # 충돌 구분된 산출물(과목1/법)은 동일 상대경로를 먼저 시도한다.
        old_p = os.path.join(gold_dir, *d.split('/'), stem + '.md')
        if not os.path.exists(old_p):
            hits = glob.glob(os.path.join(gold_dir, '*', stem, stem + '.md'))
            if hits:
                old_p = hits[0]
        with open(new_p, encoding='utf-8') as f:
            new_text = f.read()
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
        with open(old_p, encoding='utf-8') as f:
            old_text = f.read()
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


def _pool_init(segment, profile_path):
    """ProcessPool 워커 초기화 — 부모의 프로파일/세그먼트 설정을 복제한다."""
    PROFILE['segment'] = segment
    if profile_path:
        load_profile(profile_path)


def _convert_one(job, use_images):
    """워커용 단일 문서 변환 (top-level이어야 ProcessPool이 피클 가능)."""
    images = job['images'] if use_images else None
    return convert(job['pdf'], images, job['img_prefix'])


# ── CLI ───────────────────────────────────────────────────────────────────
def main():
    # 진단 로그는 stderr, 리포트·verify 표는 stdout(print) 계약 유지
    logging.basicConfig(level=logging.INFO, format='%(message)s')
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
    ap.add_argument('--cli', action='store_true',
                    help='CLI 모드로 실행 (기본은 GUI)')
    ap.add_argument('--verbose', '-v', action='store_true',
                    help='진단 로그를 DEBUG 수준까지 출력')
    ap.add_argument('--quiet', '-q', action='store_true',
                    help='경고 이상의 로그만 출력')
    ap.add_argument('--jobs', '-j', type=int, default=1, metavar='N',
                    help='병렬 변환 워커 수 (기본 1=직렬). 프로세스 풀 사용')
    # ── 모드 분기: 기본은 GUI, --cli 명시 시에만 CLI 경로 ──────────────
    argv = sys.argv[1:]
    if '--cli' not in argv:
        if argv and argv not in (['--gui'], ['-h'], ['--help']):
            logger.error('CLI 사용에는 --cli 플래그가 필요합니다 '
                         '(예: pdf2md.py --cli %s)', ' '.join(argv))
            sys.exit(2)
        if argv in (['-h'], ['--help']):
            ap.print_help()
            return
        run_gui()
        return
    argv = [a for a in argv if a != '--cli']
    args = ap.parse_args(argv)
    logger.setLevel(logging.DEBUG if args.verbose
                    else logging.ERROR if args.quiet
                    else logging.INFO)

    if args.profile:
        load_profile(args.profile)
    if args.no_segment:
        PROFILE['segment'] = False

    out_dir = args.out or os.path.join(args.pdf_root, 'ref_md_v2')
    gold_dir = args.gold or os.path.join(args.pdf_root, 'ref_md')

    if args.verify:
        sys.exit(1 if verify(out_dir, gold_dir, args.inputs or None) else 0)

    pdfs = collect_pdfs(args.inputs, args.pdf_root)
    if not pdfs:
        logger.error('변환할 PDF가 없습니다. 경로나 필터를 확인하세요.')
        sys.exit(1)

    report, flagged = [], 0
    jobs = plan_doc_jobs(pdfs, out_dir, flat=args.flat)
    if any(j['collided'] for j in jobs):
        logger.warning('동일 파일명 PDF 감지 — subdir로 출력을 구분합니다')

    # 변환 본문 생성 — --jobs>1이면 프로세스 풀로 병렬 처리
    bodies: dict[int, object] = {}
    if args.jobs > 1 and len(jobs) > 1:
        with ProcessPoolExecutor(
                max_workers=args.jobs,
                initializer=_pool_init,
                initargs=(PROFILE['segment'], args.profile)) as pool:
            fut_map = {
                pool.submit(_convert_one, j, not args.no_images): i
                for i, j in enumerate(jobs)
            }
            for fut in as_completed(fut_map):
                i = fut_map[fut]
                try:
                    bodies[i] = fut.result()
                except Exception as e:
                    bodies[i] = e
    else:
        for i, job in enumerate(jobs):
            try:
                bodies[i] = _convert_one(job, not args.no_images)
            except Exception as e:
                bodies[i] = e

    # 결과는 원래 순서대로 기록·출력
    for i, job in enumerate(jobs):
        res = bodies[i]
        if isinstance(res, Exception):
            logger.error('FAIL %s: %s', job['doc'], res)
            report.append({'doc': job['doc'], 'error': str(res)})
            continue
        body = res
        os.makedirs(job['dir'], exist_ok=True)
        md = f'# {job["basename"]}\n\n{body}\n'
        with open(job['md'], 'w', encoding='utf-8') as f:
            f.write(md)
        n_tables = md.count('|---') + md.count('| ---')
        report.append({
            'doc': job['doc'], 'src': job['src'],
            'chars': len(body), 'lines': body.count('\n') + 1,
            'ws': round(whitespace_ratio(body), 1), 'tables': n_tables,
        })
        logger.info('OK %s: %s자, 공백 %s%%, 표 %d',
                    job['doc'], f'{len(body):,}', report[-1]['ws'], n_tables)
        if args.doctor:
            flagged += doctor_report(job['doc'], md)

    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, '_report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    fails = [r for r in report if 'error' in r]
    logger.info('총 %d개 → %s%s', len(report), out_dir,
                f'  ⚠ 실패 {len(fails)}건' if fails else '')
    if args.doctor:
        if flagged:
            logger.info('표 점검 필요 문항: %d건', flagged)
        else:
            logger.info('표 점검: 이상 없음')


# ── GUI (PySide6 — 선택 의존. --gui 실행 시에만 import한다) ──────────────
def run_gui():
    """변환 엔진의 PySide6 프런트엔드 (구 pdf2md_gui.py).

    변환은 QThread 워커에서 수행해 UI가 멈추지 않으며, 문서별 진행률·표
    건강 경고·결과를 실시간으로 표시한다.
    """
    try:
        from PySide6.QtCore import Qt, QThread, QObject, Signal, QUrl
        from PySide6.QtGui import QFont, QDesktopServices
        from PySide6.QtWidgets import (
            QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
            QGridLayout, QLabel, QLineEdit, QPushButton, QCheckBox,
            QListWidget, QPlainTextEdit, QProgressBar, QFileDialog,
            QGroupBox, QTableWidget, QTableWidgetItem, QAbstractItemView,
            QHeaderView, QMessageBox, QSplitter, QStatusBar,
        )
    except ImportError as e:
        logger.error('GUI 실행에는 PySide6가 필요합니다: pip install PySide6\n'
                     '    (%s: %s)', type(e).__name__, e)
        sys.exit(1)

    ENGINE_ERR = (None if pdfplumber is not None
                  else 'pdfplumber 미설치 — pip install pdfplumber')

    class ConvertWorker(QObject):
        progress = Signal(int, int)       # (완료 수, 전체 수)
        doc_done = Signal(dict)           # 문서 1건 결과
        log = Signal(str)                 # 로그 한 줄
        finished = Signal(int, int, int)  # (성공, 실패, 표경고)
        fatal = Signal(str)               # 치명 오류(스택)

        def __init__(self, inputs, out_dir, opts):
            super().__init__()
            self.inputs = inputs
            self.out_dir = out_dir
            self.opts = opts
            self._cancel = False

        def cancel(self):
            self._cancel = True

        def run(self):
            try:
                self._run()
            except Exception:
                self.fatal.emit(traceback.format_exc())

        def _run(self):
            o = self.opts
            # 프로파일/옵션은 엔진의 전역 상태에 반영 (단일 실행이라 안전)
            if o.get('profile'):
                load_profile(o['profile'])
            PROFILE['segment'] = o['segment']

            root = o.get('pdf_root') or DEFAULT_PDF_ROOT
            pdfs = collect_pdfs(self.inputs, root)
            if not pdfs:
                self.fatal.emit('변환할 PDF가 없습니다. 입력 경로/필터를 확인하세요.')
                return

            total = len(pdfs)
            ok = fail = flagged = 0
            report = []
            self.progress.emit(0, total)

            jobs = plan_doc_jobs(pdfs, self.out_dir, flat=o['flat'])
            for i, job in enumerate(jobs, 1):
                if self._cancel:
                    self.log.emit('⏹ 사용자 취소 — 남은 문서 중단')
                    break
                base = job['basename']
                doc_name = job['doc']
                images_dir = None if o['no_images'] else job['images']
                try:
                    os.makedirs(job['dir'], exist_ok=True)
                    body = convert(job['pdf'], images_dir, job['img_prefix'])
                except Exception as e:
                    fail += 1
                    self.log.emit(f'✗ FAIL  {doc_name}: {e}')
                    self.doc_done.emit({'doc': doc_name, 'status': 'FAIL', 'error': str(e)})
                    report.append({'doc': doc_name, 'error': str(e)})
                    self.progress.emit(i, total)
                    continue

                md = f'# {base}\n\n{body}\n'
                with open(job['md'], 'w', encoding='utf-8') as f:
                    f.write(md)
                n_tables = md.count('|---') + md.count('| ---')
                flags = self._doctor(md) if o['doctor'] else []
                flagged += len(flags)
                ws = round(whitespace_ratio(body), 1)
                ok += 1

                self.doc_done.emit({
                    'doc': doc_name, 'status': 'OK', 'chars': len(body),
                    'lines': body.count('\n') + 1, 'ws': ws, 'tables': n_tables,
                    'flags': len(flags), 'path': job['md'],
                })
                self.log.emit(
                    f'✓ {doc_name}: {len(body):,}자 · 표 {n_tables}'
                    + (f' · ⚠ 표 {len(flags)}건' if flags else ''))
                for fl in flags:
                    self.log.emit('      ' + fl)
                report.append({
                    'doc': doc_name, 'src': job['src'], 'chars': len(body),
                    'lines': body.count('\n') + 1, 'ws': ws, 'tables': n_tables,
                })
                self.progress.emit(i, total)

            try:
                os.makedirs(self.out_dir, exist_ok=True)
                with open(os.path.join(self.out_dir, '_report.json'), 'w',
                          encoding='utf-8') as f:
                    json.dump(report, f, ensure_ascii=False, indent=2)
            except Exception as e:
                self.log.emit(f'(리포트 저장 실패: {e})')

            self.finished.emit(ok, fail, flagged)

        @staticmethod
        def _doctor(md):
            """표 건강 점검 — 공용 규칙으로 경고 문자열 리스트 반환"""
            return table_flag_strings(md)

    class MainWindow(QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle('pdf2md — 참조 PDF → Markdown 변환기')
            self.resize(920, 680)
            self.thread = None
            self.worker = None
            self._build_ui()
            self._apply_style()
            if ENGINE_ERR:
                self._disable_for_import_error()

        # --- UI 구성 ---
        def _build_ui(self):
            central = QWidget()
            root = QVBoxLayout(central)
            root.setContentsMargins(14, 14, 14, 14)
            root.setSpacing(10)

            # 입력 그룹
            in_group = QGroupBox('입력 PDF (파일 또는 폴더)')
            in_lay = QHBoxLayout(in_group)
            self.input_list = QListWidget()
            self.input_list.setSelectionMode(QAbstractItemView.ExtendedSelection)
            self.input_list.setMinimumHeight(96)
            in_lay.addWidget(self.input_list, 1)
            btn_col = QVBoxLayout()
            for label, slot in (('파일 추가', self.add_files),
                                ('폴더 추가', self.add_folder),
                                ('선택 제거', self.remove_selected),
                                ('비우기', self.clear_inputs)):
                b = QPushButton(label)
                b.clicked.connect(slot)
                btn_col.addWidget(b)
            btn_col.addStretch(1)
            in_lay.addLayout(btn_col)
            root.addWidget(in_group)

            # 출력 + 프로파일
            io_group = QGroupBox('출력')
            grid = QGridLayout(io_group)
            grid.addWidget(QLabel('출력 폴더'), 0, 0)
            self.out_edit = QLineEdit()
            self.out_edit.setText(os.path.join(DEFAULT_PDF_ROOT, 'ref_md_v2'))
            grid.addWidget(self.out_edit, 0, 1)
            b_out = QPushButton('찾아보기')
            b_out.clicked.connect(self.pick_out)
            grid.addWidget(b_out, 0, 2)
            grid.addWidget(QLabel('프로파일(JSON, 선택)'), 1, 0)
            self.prof_edit = QLineEdit()
            self.prof_edit.setPlaceholderText('잡행/워터마크/마커 패턴 오버라이드 — 비우면 기본값')
            grid.addWidget(self.prof_edit, 1, 1)
            b_prof = QPushButton('찾아보기')
            b_prof.clicked.connect(self.pick_profile)
            grid.addWidget(b_prof, 1, 2)
            grid.setColumnStretch(1, 1)
            root.addWidget(io_group)

            # 옵션
            opt_group = QGroupBox('옵션')
            opt_lay = QHBoxLayout(opt_group)
            self.cb_segment = QCheckBox('문장 단위 병합')
            self.cb_segment.setChecked(True)
            self.cb_segment.setToolTip(
                '시각적 wrap 줄을 구조 마커/문장 종결 기준으로 한 단위로 접음.\n'
                '주의: 줄 번호가 바뀌므로 #L#### 인용이 있는 산출물은 끄고 변환.')
            self.cb_flat = QCheckBox('평면 출력(--flat)')
            self.cb_flat.setToolTip('{out}/{name}.md 로 저장 (기본: {out}/{name}/{name}.md)')
            self.cb_images = QCheckBox('이미지 추출')
            self.cb_images.setChecked(True)
            self.cb_doctor = QCheckBox('표 건강 점검')
            self.cb_doctor.setChecked(True)
            for cb in (self.cb_segment, self.cb_flat, self.cb_images, self.cb_doctor):
                opt_lay.addWidget(cb)
            opt_lay.addStretch(1)
            root.addWidget(opt_group)

            # 실행 바
            run_bar = QHBoxLayout()
            self.run_btn = QPushButton('변환 시작')
            self.run_btn.setObjectName('runBtn')
            self.run_btn.clicked.connect(self.start)
            self.cancel_btn = QPushButton('취소')
            self.cancel_btn.setEnabled(False)
            self.cancel_btn.clicked.connect(self.cancel)
            self.open_out_btn = QPushButton('출력 폴더 열기')
            self.open_out_btn.clicked.connect(self.open_out_dir)
            self.progress = QProgressBar()
            self.progress.setTextVisible(True)
            run_bar.addWidget(self.run_btn)
            run_bar.addWidget(self.cancel_btn)
            run_bar.addWidget(self.open_out_btn)
            run_bar.addWidget(self.progress, 1)
            root.addLayout(run_bar)

            # 결과 테이블 + 로그 (스플리터)
            split = QSplitter(Qt.Vertical)
            self.table = QTableWidget(0, 6)
            self.table.setHorizontalHeaderLabels(
                ['문서', '글자수', '표', '공백%', '표경고', '상태'])
            self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
            self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
            self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
            for c in range(1, 6):
                self.table.horizontalHeader().setSectionResizeMode(
                    c, QHeaderView.ResizeToContents)
            self.table.doubleClicked.connect(self.open_selected_md)
            split.addWidget(self.table)

            self.log = QPlainTextEdit()
            self.log.setReadOnly(True)
            self.log.setFont(QFont('monospace', 10))
            self.log.setPlaceholderText('변환 로그 · 표 경고가 여기에 표시됩니다.')
            split.addWidget(self.log)
            split.setSizes([340, 200])
            root.addWidget(split, 1)

            self.setCentralWidget(central)
            self.setStatusBar(QStatusBar())
            self.statusBar().showMessage('준비됨')

            # 결과행 → md 경로 매핑
            self._row_path = {}

        def _apply_style(self):
            self.setStyleSheet("""
                QWidget { font-size: 13px; }
                QGroupBox {
                    border: 1px solid #d0d3d8; border-radius: 8px;
                    margin-top: 8px; padding: 8px; font-weight: 600;
                }
                QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; }
                QPushButton {
                    padding: 6px 12px; border: 1px solid #c3c7cd;
                    border-radius: 6px; background: #f5f6f8;
                }
                QPushButton:hover { background: #eceef1; }
                QPushButton:disabled { color: #9aa0a6; background: #f0f0f0; }
                QPushButton#runBtn {
                    background: #2f6feb; color: white; border: none; font-weight: 600;
                }
                QPushButton#runBtn:hover { background: #285fce; }
                QPushButton#runBtn:disabled { background: #a9c0f5; }
                QLineEdit { padding: 5px; border: 1px solid #c3c7cd; border-radius: 6px; }
                QProgressBar {
                    border: 1px solid #c3c7cd; border-radius: 6px; text-align: center;
                    height: 22px;
                }
                QProgressBar::chunk { background: #2f6feb; border-radius: 5px; }
                QPlainTextEdit, QListWidget, QTableWidget {
                    border: 1px solid #d0d3d8; border-radius: 6px;
                }
            """)

        def _disable_for_import_error(self):
            self.run_btn.setEnabled(False)
            self.log.setPlainText(
                'pdf2md 엔진을 불러오지 못했습니다:\n'
                f'    {ENGINE_ERR}\n\n'
                '· 필수 의존성:  pip install pdfplumber\n'
                '· 이미지 추출까지 필요하면:  pip install pymupdf')
            self.statusBar().showMessage('엔진 로드 실패 — 로그 참조')

        # --- 입력 조작 ---
        def add_files(self):
            files, _ = QFileDialog.getOpenFileNames(
                self, 'PDF 선택', '', 'PDF 파일 (*.pdf)')
            self._add_paths(files)

        def add_folder(self):
            d = QFileDialog.getExistingDirectory(self, '폴더 선택')
            if d:
                self._add_paths([d])

        def _add_paths(self, paths):
            existing = {self.input_list.item(i).text()
                        for i in range(self.input_list.count())}
            for p in paths:
                if p and p not in existing:
                    self.input_list.addItem(p)

        def remove_selected(self):
            for it in self.input_list.selectedItems():
                self.input_list.takeItem(self.input_list.row(it))

        def clear_inputs(self):
            self.input_list.clear()

        def pick_out(self):
            d = QFileDialog.getExistingDirectory(self, '출력 폴더')
            if d:
                self.out_edit.setText(d)

        def pick_profile(self):
            f, _ = QFileDialog.getOpenFileName(
                self, '프로파일 JSON', '', 'JSON (*.json)')
            if f:
                self.prof_edit.setText(f)

        # --- 실행/취소 ---
        def start(self):
            if self.thread is not None:
                return
            inputs = [self.input_list.item(i).text()
                      for i in range(self.input_list.count())]
            if not inputs:
                QMessageBox.warning(self, '입력 없음', '변환할 PDF나 폴더를 추가하세요.')
                return
            out_dir = self.out_edit.text().strip()
            if not out_dir:
                QMessageBox.warning(self, '출력 없음', '출력 폴더를 지정하세요.')
                return
            prof = self.prof_edit.text().strip()
            if prof and not os.path.isfile(prof):
                QMessageBox.warning(self, '프로파일 오류', '프로파일 JSON 경로가 올바르지 않습니다.')
                return

            opts = {
                'segment': self.cb_segment.isChecked(),
                'flat': self.cb_flat.isChecked(),
                'no_images': not self.cb_images.isChecked(),
                'doctor': self.cb_doctor.isChecked(),
                'profile': prof or None,
            }
            self.table.setRowCount(0)
            self._row_path.clear()
            self.log.clear()
            self.progress.setRange(0, 0)  # busy until first progress
            self.statusBar().showMessage('변환 중…')

            self.thread = QThread(self)
            self.worker = ConvertWorker(inputs, out_dir, opts)
            self.worker.moveToThread(self.thread)
            self.thread.started.connect(self.worker.run)
            self.worker.progress.connect(self.on_progress)
            self.worker.doc_done.connect(self.on_doc)
            self.worker.log.connect(self.on_log)
            self.worker.finished.connect(self.on_finished)
            self.worker.fatal.connect(self.on_fatal)
            self.worker.finished.connect(self.thread.quit)
            self.worker.fatal.connect(self.thread.quit)
            self.thread.finished.connect(self._cleanup_thread)

            self.run_btn.setEnabled(False)
            self.cancel_btn.setEnabled(True)
            self.thread.start()

        def cancel(self):
            if self.worker:
                self.worker.cancel()
                self.cancel_btn.setEnabled(False)
                self.statusBar().showMessage('취소 요청 — 현재 문서 완료 후 중단')

        def _cleanup_thread(self):
            if self.thread:
                self.thread.deleteLater()
            self.thread = None
            self.worker = None

        # --- 워커 시그널 핸들러 ---
        def on_progress(self, done, total):
            if self.progress.maximum() == 0 and total:
                self.progress.setRange(0, total)
            self.progress.setValue(done)

        def on_doc(self, r):
            row = self.table.rowCount()
            self.table.insertRow(row)

            def cell(text, align=Qt.AlignLeft):
                it = QTableWidgetItem(str(text))
                it.setTextAlignment(align | Qt.AlignVCenter)
                return it

            self.table.setItem(row, 0, cell(r['doc']))
            if r['status'] == 'OK':
                self.table.setItem(row, 1, cell(f"{r['chars']:,}", Qt.AlignRight))
                self.table.setItem(row, 2, cell(r['tables'], Qt.AlignRight))
                self.table.setItem(row, 3, cell(r['ws'], Qt.AlignRight))
                self.table.setItem(row, 4, cell(r['flags'] or '', Qt.AlignRight))
                self.table.setItem(row, 5, cell('OK', Qt.AlignCenter))
                self._row_path[row] = r.get('path')
            else:
                for c in range(1, 5):
                    self.table.setItem(row, c, cell('—', Qt.AlignCenter))
                self.table.setItem(row, 5, cell('FAIL', Qt.AlignCenter))

        def on_log(self, line):
            self.log.appendPlainText(line)

        def on_finished(self, ok, fail, flagged):
            self.run_btn.setEnabled(True)
            self.cancel_btn.setEnabled(False)
            if self.progress.maximum() == 0:
                self.progress.setRange(0, 1)
                self.progress.setValue(1)
            msg = f'완료 — 성공 {ok} · 실패 {fail}'
            if flagged:
                msg += f' · 표 경고 {flagged}건'
            self.statusBar().showMessage(msg)
            self.log.appendPlainText('\n── ' + msg + ' ──')

        def on_fatal(self, tb):
            self.run_btn.setEnabled(True)
            self.cancel_btn.setEnabled(False)
            self.statusBar().showMessage('오류로 중단됨')
            self.log.appendPlainText('\n[치명 오류]\n' + tb)

        # --- 편의 ---
        def open_selected_md(self):
            rows = {i.row() for i in self.table.selectedIndexes()}
            for row in rows:
                path = self._row_path.get(row)
                if path and os.path.exists(path):
                    QDesktopServices.openUrl(QUrl.fromLocalFile(path))

        def open_out_dir(self):
            d = self.out_edit.text().strip()
            if d and os.path.isdir(d):
                QDesktopServices.openUrl(QUrl.fromLocalFile(d))
            else:
                QMessageBox.information(self, '폴더 없음', '출력 폴더가 아직 없습니다.')

        def closeEvent(self, event):
            if self.thread is not None and self.thread.isRunning():
                if self.worker:
                    self.worker.cancel()
                self.thread.quit()
                self.thread.wait(3000)
            super().closeEvent(event)

    app = QApplication(sys.argv)
    app.setApplicationName('pdf2md')
    win = MainWindow()
    win.show()
    sys.exit(app.exec())


if __name__ == '__main__':
    main()
