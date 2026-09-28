# -*- coding: utf-8 -*-
"""고시 전문(ref_md)의 별표1·별표2 원료 목록과 원료 DB 파일 전수 대조.

용도:
    python ref-pipeline/compare_ingredients_official.py

출력: 누락(고시에만 있음)·초과(DB에만 있음)·한도 불일치 리포트.
PDF→MD 변환 아티팩트(공백 삽입·행 분할)는 정규화로 완화하지만,
fragment 행은 수동 검토 대상으로 별도 표시한다.
"""
import re
import sys
import io
from difflib import SequenceMatcher
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
OFFICIAL_MD = ROOT / 'content/exams/cosmetic/참조자료/ref_md/과목2' / \
    '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318)' / \
    '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).md'
DB_DIR = ROOT / 'content/exams/cosmetic/참조자료/원료'
BANNED_MD = DB_DIR / 'banned_ingredients.md'
RESTRICTED_MD = DB_DIR / 'restricted_ingredients.md'

FOOTNOTE_RE = re.compile(r'\d+\)\s*$')          # 끝에 붙는 각주 표기 "1)" "2)" 등


def has_footnote(s: str) -> bool:
    """진짜 각주인지 판정 — "염류1)"는 각주이지만 "(비타민 K1)"·"케톤-1)"은
    이름의 일부. 후보를 떼어냈을 때 괄호가 균형이면 각주로 간주."""
    m = FOOTNOTE_RE.search(s)
    if not m:
        return False
    rest = s[:m.start()]
    return rest.count('(') == rest.count(')') and rest.count('[') == rest.count(']')
PCT_RE = re.compile(r'(\d+(?:\.\d+)?)\s*%')

# 위·아래첨자·그리스 문자 → 평문 통일 (비타민 L₁↔L1, ο-페닐렌↔o-페닐렌)
SUBSUP = str.maketrans('₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹', '01234567890123456789')
GREEK = str.maketrans('οΟ', 'oO')


def norm(name: str) -> str:
    """원료명 정규화 — 공백·볼드·각주 제거, 괄호 통일."""
    s = name.strip()
    s = s.replace('**', '').replace('*', '')
    if has_footnote(s):
        s = FOOTNOTE_RE.sub('', s)
    s = re.sub(r'\s+', '', s)
    s = s.translate(SUBSUP).translate(GREEK)
    s = s.replace('（', '(').replace('）', ')')
    s = s.replace('ㆍ', '·').replace('․', '·')
    return s


def is_table_row(line: str) -> bool:
    t = line.strip()
    return t.startswith('|') and t.endswith('|')


def cells(line: str):
    return [c.strip() for c in line.strip().strip('|').split('|')]


def is_separator(line: str) -> bool:
    return bool(re.match(r'^\|[\s\-|]+\|$', line.strip()))


def looks_like_header(name: str) -> bool:
    n = norm(name)
    return (not n) or n in ('원료명', '원료명.') or '원 료 명' in name or '---' in n


def looks_like_fragment(name: str) -> bool:
    """행 분할 파편 추정 — '-'·')'·'·' 시작이거나 괄호·대괄호 불균형."""
    n = norm(name)
    if not n:
        return True
    if n[0] in '-·)':
        return True
    if n.count('(') != n.count(')') or n.count('[') != n.count(']'):
        return True
    return False


def strip_parens(s: str) -> str:
    """괄호 그룹 전부 제거한 핵심명 (별칭·예시 괄호 무시 매칭용)."""
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r'\([^()]*\)', '', s)
        s = re.sub(r'\[[^\[\]]*\]', '', s)
    return s


def match_status(name: str, other_names) -> str:
    """other_names 집합 대비 매칭 등급: exact > core > contains > none."""
    if name in other_names:
        return 'exact'
    core = strip_parens(name)
    if len(core) >= 4:
        for o in other_names:
            if strip_parens(o) == core:
                return 'core'
    for o in other_names:
        if len(name) >= 6 and len(o) >= 6 and (name in o or o in name):
            return 'contains'
    return 'none'


def parse_official(lines, start_marker, end_marker, name_col=0, limit_col=None):
    """ref_md의 [별표 N] ~ [별표 N+1] 구간 표에서 원료명·한도 추출.

    마커는 독립 라행("[별표 1]"만 있는 줄)만 인정 — 목차 라인
    ("[별표 1] 사용할 수 없는 원료")과 구분하기 위해 정규식 사용.
    """
    start_re = re.compile(r'^' + re.escape(start_marker) + r'\s*$')
    end_re = re.compile(r'^' + re.escape(end_marker) + r'\s*$') if end_marker else None
    in_section = False
    items = {}   # norm_name -> {raw, limits:set, cas:set}
    for line in lines:
        t = line.strip()
        if start_re.match(t):
            in_section = True
            continue
        if end_re and end_re.match(t):
            break
        if not in_section or not is_table_row(line) or is_separator(line):
            continue
        c = cells(line)
        if len(c) <= name_col:
            continue
        raw = c[name_col]
        if looks_like_header(raw):
            continue
        n = norm(raw)
        if not n:
            continue
        entry = items.setdefault(n, {'raw': raw.strip(), 'limits': set(),
                                     'fragment': looks_like_fragment(raw),
                                     'footnote': has_footnote(raw.strip())})
        if limit_col is not None and len(c) > limit_col:
            lim = norm(c[limit_col])
            if lim:
                entry['limits'].add(lim)
        entry['fragment'] = entry['fragment'] and looks_like_fragment(raw)
    return items


def parse_db(md_path, sections=None):
    """DB md의 표 첫 컬럼(원료명)·최대함량 컬럼 추출.

    banned: 'Chapter 01' 이후 전체 목록만 사용 (앞쪽 요약표 중복 제외)
    restricted: (1)~(4) 섹션의 표 전체
    """
    lines = md_path.read_text(encoding='utf-8').splitlines()
    items = {}
    if sections is None:  # banned — Chapter 01부터
        active = False
        for line in lines:
            if 'Chapter 01' in line:
                active = True
                continue
            if not active or not is_table_row(line) or is_separator(line):
                continue
            c = cells(line)
            if not c or looks_like_header(c[0]):
                continue
            n = norm(c[0])
            if n:
                items.setdefault(n, {'raw': c[0].strip()})
        return items
    # restricted — 지정 섹션 범위만
    active = False
    for line in lines:
        h = re.match(r'^##\s*\((\d)\)', line.strip())
        if h:
            active = h.group(1) in sections
            continue
        if line.strip().startswith('## ') and not h:
            active = False
        if not active or not is_table_row(line) or is_separator(line):
            continue
        c = cells(line)
        if len(c) < 7 or looks_like_header(c[0]):
            continue
        n = norm(c[0])
        if not n:
            continue
        limit = norm(c[6]) if len(c) > 6 else ''
        items.setdefault(n, {'raw': c[0].strip(), 'limit': limit})
    return items


def pct_of(text: str):
    return {float(x) for x in PCT_RE.findall(text)}


def pair_unmatched(off_only, db_only):
    """불일치 양방향 목록을 유사도로 페어링 → 표기차이 후보 vs 실질 차이."""
    pairs = []
    used_db = set()
    for o in off_only:
        best, br = None, 0.0
        for d in db_only:
            if d in used_db:
                continue
            r = SequenceMatcher(None, o, d).ratio()
            if r > br:
                best, br = d, r
        if br >= 0.75:
            pairs.append((o, best, br))
            used_db.add(best)
    real_off = [o for o in off_only if all(p[0] != o for p in pairs)]
    real_db = [d for d in db_only if d not in used_db]
    return pairs, real_off, real_db


def main():
    off_lines = OFFICIAL_MD.read_text(encoding='utf-8').splitlines()

    off_banned = parse_official(off_lines, '[별표 1]', '[별표 2]')
    off_restr = parse_official(off_lines, '[별표 2]', '[별표 3]', limit_col=1)
    db_banned = parse_db(BANNED_MD)
    db_restr = parse_db(RESTRICTED_MD, sections={'1', '2', '3', '4'})

    # fragment(행 분할 파편)는 비교에서 제외
    off_b = {k for k, v in off_banned.items() if not v['fragment']}
    off_b_frag = {k for k, v in off_banned.items() if v['fragment']}
    off_r = {k for k, v in off_restr.items() if not v['fragment']}
    off_r_frag = {k for k, v in off_restr.items() if v['fragment']}

    def report(title, off_items, off_set, db_map):
        print('=' * 70)
        print(f' {title}')
        print('=' * 70)
        print(f'고시 원료명 수: {len(off_set)}')
        print(f'DB 원료명 수:  {len(db_map)}')
        buckets = {'exact': 0, 'core': [], 'contains': [], 'none': []}
        for n in sorted(off_set):
            st = match_status(n, set(db_map))
            if st in ('exact',):
                buckets['exact'] += 1
            else:
                buckets[st].append(n)
        print(f'매칭: 정확 {buckets["exact"]} · 핵심명 {len(buckets["core"])} · 포함관계 {len(buckets["contains"])} · 불일치 {len(buckets["none"])}')
        rev = [n for n in sorted(db_map) if match_status(n, off_set) == 'none']
        pairs, real_off, real_db = pair_unmatched(buckets['none'], rev)
        print(f'매칭: 정확 {buckets["exact"]} · 핵심명 {len(buckets["core"])} · 포함관계 {len(buckets["contains"])} · 불일치 {len(buckets["none"])}/{len(rev)}')
        print(f'\n■ [표기차이 후보] 고시↔DB 유사명 페어 (유사도≥0.75): {len(pairs)}건')
        for o, d, r in pairs:
            print(f'  ~ 고시: {off_items[o]["raw"]}\n    DB : {db_map[d]["raw"]}  ({r:.2f})')
        print(f'\n■ [실질 차이 후보] 고시에 있고 DB에 없음: {len(real_off)}건')
        for n in real_off:
            print(f'  + {off_items[n]["raw"]}')
        print(f'\n■ [실질 차이 후보] DB에 있고 고시에 없음: {len(real_db)}건')
        for n in real_db:
            print(f'  - {db_map[n]["raw"]}')
        print(f'\n■ [검토] 핵심명 일치(괄호·예시만 상이): {len(buckets["core"])}건')
        for n in buckets['core']:
            print(f'  ~ {off_items[n]["raw"]}')
        return rev

    report('별표1 사용 불가 원료 (고시 제2026-19호 ↔ banned_ingredients.md)', off_banned, off_b, db_banned)
    print()
    report('별표2 사용상 제한 원료 (고시 제2026-19호 ↔ restricted_ingredients.md)', off_restr, off_r, db_restr)

    # 별표1 각주 1) 항목 — "염모제 기준 적합 시 제외" → restricted DB와 대조
    fn_items = {k for k, v in off_banned.items() if v['footnote'] and not v['fragment']}
    print('=' * 70)
    print(f' 별표1 각주1) 항목 — 염모제 예외 ↔ restricted_ingredients.md: {len(fn_items)}건')
    print('=' * 70)
    fn_missing = [n for n in sorted(fn_items) if match_status(n, set(db_restr)) == 'none']
    print(f'restricted DB에 없는 각주1) 항목: {len(fn_missing)}건')
    for n in fn_missing:
        print(f'  + {off_banned[n]["raw"]}')

    # 이름 일치하는 항목의 한도(%) 비교
    print(f'\n■ 별표2 한도(%) 불일치 (이름 정확·핵심명 일치 항목):')
    diffs = 0
    for n in sorted(off_r):
        st = match_status(n, set(db_restr))
        if st not in ('exact', 'core'):
            continue
        o_pct = set()
        for l in off_restr[n]['limits']:
            o_pct |= pct_of(l)
        # 매칭된 DB 항목 찾기
        db_key = n if n in db_restr else next(
            (k for k in db_restr if strip_parens(k) == strip_parens(n)), None)
        if not db_key:
            continue
        d_pct = pct_of(db_restr[db_key]['limit'])
        if o_pct and d_pct and o_pct != d_pct:
            diffs += 1
            print(f'  ! {db_restr[db_key]["raw"]}: 고시={sorted(o_pct)} DB={sorted(d_pct)} ({db_restr[db_key]["limit"]})')
    if not diffs:
        print('  없음')

    print(f'\n■ 파편 추정 행 (수동 검토): 별표1 {len(off_b_frag)}건, 별표2 {len(off_r_frag)}건')
    for n in sorted(off_r_frag)[:20]:
        print(f'  별표2: {off_restr[n]["raw"]}')


if __name__ == '__main__':
    main()
