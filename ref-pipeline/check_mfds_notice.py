# -*- coding: utf-8 -*-
# @spec FO-24
"""참조 법령·고시 전체의 최신 고시 감지기 (다문서).

references.json의 referenceLaw에서 감시 대상을 자동 유도한다 —
파일명이 곧 공식 문서명+(발령기관)(제N호)(시행일)이므로
별도 감시 목록을 유지할 필요가 없다.

- 법령(법률·대통령령·총리령) → lawSearch.do?target=law (검색 응답에 공포번호 포함)
- 행정규칙(식약처 고시 등) → lawSearch.do?target=admrul + lawService.do 상세(공포번호)

notice_status.json 스키마:
    baseline / latest / newerFound  — 안전기준 규정 전용(기존 JS 호환)
    docs[]                          — 감시 문서 전체 {name,target,baseline*,latest*,url,newer}

사용:
    LAW_OC_KEY=<발급키> python ref-pipeline/check_mfds_notice.py [--update]

- --update 없이: 조회 결과만 출력 (종료코드 0=전부 최신, 2=신규 고시 발견)
- --update: content/exams/cosmetic/notice_status.json 갱신
- 종료코드 2는 GitHub Actions가 이슈를 여는 신호로 사용
"""
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
STATUS_FILE = ROOT / 'content/exams/cosmetic/notice_status.json'
REFS_FILE = ROOT / 'content/exams/cosmetic/references.json'

# 레거시 top-level baseline/latest의 기준 문서 — 원료 DB 대조의 기준
RULE_NAME = '화장품 안전기준 등에 관한 규정'


def load_oc_key():
    """OC 키 해석 — ① LAW_OC_KEY 환경변수 → ② ref-pipeline/.env.local.json (gitignore됨)."""
    oc = os.environ.get('LAW_OC_KEY', '').strip()
    if oc:
        return oc
    f = Path(__file__).resolve().parent / '.env.local.json'
    if f.exists():
        try:
            return str(json.loads(f.read_text(encoding='utf-8')).get('LAW_OC_KEY', '')).strip()
        except ValueError:
            return ''
    return ''


def api_get(path, params, target='admrul'):
    oc = load_oc_key()
    if not oc:
        print('!! LAW_OC_KEY가 없습니다. 둘 중 하나로 설정하세요:')
        print('   ① 환경변수   PowerShell: $env:LAW_OC_KEY = "<키>"')
        print('   ② 로컬 파일  ref-pipeline/.env.local.json → {"LAW_OC_KEY": "<키>"} (gitignore됨, 커밋 불가)')
        sys.exit(1)
    q = urllib.parse.urlencode({'OC': oc, 'target': target, 'type': 'JSON', **params})
    last_err = None
    for scheme in ('https', 'http'):  # DRF 엔드포인트는 환경에 따라 http만 받기도 함
        url = f'{scheme}://www.law.go.kr/DRF/{path}?{q}'
        body = None
        for attempt in range(3):  # law.go.kr 응답 지연 빈도가 높아 재시도
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'PersonalizedSkincare/notice-check'})
                with urllib.request.urlopen(req, timeout=30) as r:
                    body = r.read().decode('utf-8', errors='replace')
                break
            except urllib.error.HTTPError as e:
                snippet = e.read().decode('utf-8', errors='replace')[:200]
                print(f'!! HTTP {e.code} ({scheme}) — {snippet}')
                last_err = e
                break
            except (TimeoutError, urllib.error.URLError) as e:
                reason = getattr(e, 'reason', e) or e
                if attempt < 2:
                    print(f'.. 응답 지연 — 재시도 {attempt + 1}/3 ({scheme})')
                    time.sleep(2)
                    continue
                print(f'!! 연결 실패 ({scheme}) — {reason}')
                last_err = e
        if body is None:
            continue  # 다음 scheme
        try:
            return json.loads(body)
        except ValueError:
            print(f'!! JSON 파싱 실패 — 응답 앞부분: {body[:200]}')
            last_err = ValueError('non-JSON response')
            continue
    raise SystemExit(f'law.go.kr 호출 실패: {last_err}')


def normalize_notice(s):
    """'제2026-19호' / '2026-19' → '제2026-19호', 법령 공포번호 '20901' → '제20901호'."""
    s = str(s).strip()
    m = re.fullmatch(r'제?\s*(20\d{2})\s*-\s*(\d+)\s*호?', s)  # 하이픈 있는 고시번호만 연도-번호 해석
    if m:
        return f'제{m.group(1)}-{m.group(2)}호'
    m = re.fullmatch(r'제?\s*(\d+)\s*호?', s)  # 하이픈 없는 번호(법령 공포번호)는 그대로
    return f'제{m.group(1)}호' if m else None


def fmt_date(d):
    d = str(d or '').strip()
    return f'{d[:4]}-{d[4:6]}-{d[6:8]}' if len(d) == 8 and d.isdigit() else d


def parse_ref_filename(file_name):
    """'화장품법(법률)(제20901호)(20260402).pdf' → 감시 대상 메타."""
    name = re.split(r'\(', file_name)[0].strip()
    m = re.search(r'\(제([\d]+(?:-\d+)?)호\)\s*\((\d{8})\)', file_name)
    target = 'law' if re.search(r'\((법률|대통령령|총리령|부령)\)', file_name) else 'admrul'
    url = 'https://www.law.go.kr/' + ('법령' if target == 'law' else '행정규칙') + '/' + re.sub(r'\s+', '', name)
    return {
        'name': name,
        'target': target,
        'file': file_name,
        'url': url,
        'baselineNotice': f'제{m.group(1)}호' if m else None,
        'baselineDate': fmt_date(m.group(2)) if m else None,
    }


def watch_docs():
    """references.json referenceLaw → 감시 대상 목록 (파일 추가 시 자동 반영)."""
    refs = json.loads(REFS_FILE.read_text(encoding='utf-8'))
    return [parse_ref_filename(f['file']) for f in refs.get('referenceLaw', []) if f.get('file')]


def search_law(name):
    """법령 검색 → 정확 일치 항목. 공포번호가 검색 응답에 포함됨.

    반환: latest=시행일자 최신(미래 개정본 포함) / current=시행일자≤오늘 최신(현행본).
    한글주소는 시행 예정 개정본으로도 연결되므로 현행본 일련번호를 별도로 기록한다."""
    res = api_get('lawSearch.do', {'query': name, 'display': 50, 'sort': 'efdes'}, target='law')
    body = res.get('LawSearch', {})
    items = body.get('law', [])
    if isinstance(items, dict):
        items = [items]
    exact = [i for i in items if i.get('법령명한글', '').strip() == name]
    if not exact:
        print(f'!! 법령 "{name}" 정확 일치 없음 — {len(items)}건')
        return None
    exact.sort(key=lambda i: str(i.get('시행일자', '')), reverse=True)
    today = datetime.now(timezone.utc).strftime('%Y%m%d')
    current = next((i for i in exact if str(i.get('시행일자', '99999999')) <= today), None)
    def meta(i):
        return {'notice': normalize_notice(i.get('공포번호')) if i else None,
                'effectiveDate': fmt_date(i.get('시행일자')) if i else None,
                'serial': str(i.get('법령일련번호', '')) if i else ''}
    return {'latest': meta(exact[0]), 'current': meta(current)}


def fetch_notice_number(serial_no):
    """행정규칙 상세(lawService)의 발령/개정고시 공포번호에서 최신 고시번호 추출."""
    try:
        detail = api_get('lawService.do', {'ID': serial_no})
    except (urllib.error.URLError, ValueError):
        return None
    candidates = []
    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if '공포번호' in k or '고시번호' in k:
                    n = normalize_notice(v)
                    if n:
                        candidates.append(n)
                else:
                    walk(v)
        elif isinstance(node, list):
            for i in node:
                walk(i)
    walk(detail)
    if not candidates:
        candidates = [n for n in (normalize_notice(m) for m in
                                  re.findall(r'제\s*20\d{2}\s*-\s*\d+\s*호',
                                             json.dumps(detail, ensure_ascii=False)))
                      if n]
    if not candidates:
        return None
    def key(s):
        m = re.search(r'20(\d{2})\s*-\s*(\d+)', s)
        return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
    return max(set(candidates), key=key)


def search_admrul(name):
    """행정규칙 검색 → 최신 시행 항목 + 상세에서 공포번호.

    반환: latest=시행일자 최신 / current=시행일자≤오늘 최신(현행본).
    한글주소는 시행 예정 개정본으로도 연결되므로 현행본 일련번호를 별도로 기록한다."""
    res = api_get('lawSearch.do', {'query': name, 'display': 50, 'sort': 'efdes'})
    body = res.get('AdmRulSearch', {})
    if isinstance(body, dict) and ('error' in body or 'message' in body):
        print('!! API 오류 응답:', json.dumps(body, ensure_ascii=False)[:300])
        sys.exit(1)
    items = body.get('admrul', [])
    if isinstance(items, dict):
        items = [items]
    exact = [i for i in items if i.get('행정규칙명', '').strip() == name]
    if not exact:
        print(f'!! 행정규칙 "{name}" 정확 일치 없음 — {len(items)}건')
        return None
    exact.sort(key=lambda i: str(i.get('시행일자', '')), reverse=True)
    today = datetime.now(timezone.utc).strftime('%Y%m%d')
    cur_item = next((i for i in exact if str(i.get('시행일자', '99999999')) <= today), exact[0])
    latest = {'notice': fetch_notice_number(str(exact[0].get('행정규칙일련번호', ''))),
              'effectiveDate': fmt_date(exact[0].get('시행일자')),
              'serial': str(exact[0].get('행정규칙일련번호', ''))}
    current = {'notice': None, 'effectiveDate': fmt_date(cur_item.get('시행일자')),
               'serial': str(cur_item.get('행정규칙일련번호', ''))}
    return {'latest': latest, 'current': current}


def check_doc(doc):
    """문서 1종의 최신 고시 조회 → docs[] 항목."""
    res = search_law(doc['name']) if doc['target'] == 'law' else search_admrul(doc['name'])
    if res is None:
        return {**doc, 'error': 'not-found', 'newer': False}
    latest, current = res['latest'], res['current'] or res['latest']
    base = doc.get('baselineDate') or ''
    newer = bool(latest['effectiveDate']) and latest['effectiveDate'] > base
    serial_url = current_url(doc['target'], current['serial'], current['effectiveDate'])
    return {**doc,
            'latestNotice': latest['notice'],
            'latestDate': latest['effectiveDate'],
            'serial': latest['serial'],
            'currentSerial': current['serial'],
            'currentDate': current['effectiveDate'],
            'currentUrl': serial_url,
            'pending': bool(current['serial'] and current['serial'] != latest['serial']),
            'newer': newer}


def current_url(target, serial, effective_date):
    """현행본 직결 URL — 한글주소가 시행 예정본으로 연결될 때의 대체 경로."""
    if not serial:
        return ''
    if target == 'law':
        efyd = (effective_date or '').replace('-', '')
        return f'https://www.law.go.kr/lsInfoP.do?lsiSeq={serial}&efYd={efyd or "99991231"}'
    return f'https://www.law.go.kr/admRulInfoP.do?admRulSeq={serial}'


def main():
    update = '--update' in sys.argv
    status = {}
    if STATUS_FILE.exists():
        status = json.loads(STATUS_FILE.read_text(encoding='utf-8'))

    docs = watch_docs()
    if not docs:
        print('!! 감시 대상이 없습니다 — referenceLaw 확인')
        sys.exit(1)
    print(f'감시 문서 {len(docs)}종 — law.go.kr 조회 중…')

    results = [check_doc(d) for d in docs]
    any_newer = False
    for r in results:
        if r.get('error'):
            print(f'  ✗ {r["name"]} — 조회 실패')
            continue
        mark = '⚠ 신규' if r['newer'] else '  최신'
        print(f'  {mark} {r["name"]}: 기준 {r.get("baselineNotice")}({r.get("baselineDate")}) '
              f'→ 최신 {r.get("latestNotice")}({r.get("latestDate")})')
        any_newer = any_newer or r['newer']

    if update:
        # 레거시 필드 — 안전기준 규정 문서로 유지 (기존 JS/테스트 호환)
        core = next((r for r in results if r['name'] == RULE_NAME), None)
        status = {
            'baseline': status.get('baseline', {}),
            'latest': {
                'notice': (core or {}).get('latestNotice'),
                'ruleName': RULE_NAME,
                'effectiveDate': (core or {}).get('latestDate'),
                'serialNo': (core or {}).get('serial'),
            },
            'docs': results,
            'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'newerFound': bool(core and core['newer']),
        }
        STATUS_FILE.write_text(json.dumps(status, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('갱신:', STATUS_FILE.relative_to(ROOT))

    sys.exit(2 if any_newer else 0)


if __name__ == '__main__':
    main()
