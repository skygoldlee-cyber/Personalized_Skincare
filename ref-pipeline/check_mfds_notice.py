# -*- coding: utf-8 -*-
"""식약처 「화장품 안전기준 등에 관한 규정」 최신 고시 감지기.

law.go.kr 오픈API(행정규칙 검색)로 최신 고시를 조회해 원료 DB가 반영한
기준 고시(baseline)와 비교하고, notice_status.json을 갱신한다.

사용:
    LAW_OC_KEY=<발급키> python ref-pipeline/check_mfds_notice.py [--update]

- --update 없이: 조회 결과만 출력 (종료코드 0=최신 일치, 2=신규 고시 발견)
- --update: content/exams/cosmetic/notice_status.json 갱신
- 종료코드 2는 GitHub Actions가 이슈를 여는 신호로 사용
"""
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
STATUS_FILE = ROOT / 'content/exams/cosmetic/notice_status.json'

# 행정규칙(고시) 검색 대상 — 「화장품 안전기준 등에 관한 규정」
RULE_NAME = '화장품 안전기준 등에 관한 규정'
API_BASE = 'https://www.law.go.kr/DRF'


def api_get(path, params):
    oc = os.environ.get('LAW_OC_KEY', '').strip()
    if not oc:
        print('!! LAW_OC_KEY 환경변수가 없습니다. law.go.kr 오픈API 운영자 코드를 설정하세요.')
        sys.exit(1)
    q = urllib.parse.urlencode({'OC': oc, 'target': 'admrul', 'type': 'JSON', **params})
    req = urllib.request.Request(f'{API_BASE}/{path}?{q}', headers={'User-Agent': 'PersonalizedSkincare/notice-check'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode('utf-8'))


def search_rule():
    """행정규칙 검색 → 대상 규정의 최신 시행 항목 반환."""
    res = api_get('lawSearch.do', {'query': RULE_NAME, 'display': 50, 'sort': 'efdes'})
    items = res.get('AdmRulSearch', {}).get('admrul', [])
    if isinstance(items, dict):
        items = [items]
    exact = [i for i in items if i.get('행정규칙명', '').strip() == RULE_NAME]
    if not exact:
        print(f'!! "{RULE_NAME}" 정확 일치 항목 없음 — 검색 결과 {len(items)}건')
        for i in items[:5]:
            print('   ·', i.get('행정규칙명'), i.get('시행일자'))
        return None
    exact.sort(key=lambda i: str(i.get('시행일자', '')), reverse=True)
    return exact[0]


def fetch_notice_number(serial_no):
    """행정규칙 상세에서 발령 고시번호(제YYYY-N호) 추출."""
    try:
        detail = api_get('lawService.do', {'MST': serial_no})
    except (urllib.error.URLError, ValueError):
        return None
    text = json.dumps(detail, ensure_ascii=False)
    # 고시번호 패턴 — 제2026-19호 형태. 발령일자 순으로 최신 것 사용
    found = re.findall(r'제\s*20\d{2}\s*-\s*\d+\s*호', text)
    if not found:
        return None
    # (제개정)이력에 여러 번호가 나올 수 있음 → 연도·번호가 가장 큰 것
    def key(s):
        m = re.search(r'20(\d{2})\s*-\s*(\d+)', s)
        return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
    return re.sub(r'\s+', '', max(found, key=key))


def fmt_date(d):
    d = str(d or '').strip()
    return f'{d[:4]}-{d[4:6]}-{d[6:8]}' if len(d) == 8 and d.isdigit() else d


def main():
    update = '--update' in sys.argv
    status = {}
    if STATUS_FILE.exists():
        status = json.loads(STATUS_FILE.read_text(encoding='utf-8'))
    baseline = status.get('baseline', {})

    print(f'기준(번들) 고시: {baseline.get("notice")} · 시행 {baseline.get("effectiveDate")}')

    latest = search_rule()
    if latest is None:
        sys.exit(1)
    eff = fmt_date(latest.get('시행일자'))
    serial = str(latest.get('행정규칙일련번호', ''))
    notice_no = fetch_notice_number(serial)
    print(f'law.go.kr 최신: {notice_no or "(고시번호 미확인)"} · 시행 {eff} · 일련번호 {serial}')

    base_eff = str(baseline.get('effectiveDate', ''))
    newer = bool(eff) and eff > base_eff
    print('신규 고시 여부:', 'YES — 기준 고시보다 최신' if newer else '아니오')

    if update:
        status = {
            'baseline': baseline,
            'latest': {
                'notice': notice_no,
                'ruleName': RULE_NAME,
                'effectiveDate': eff,
                'serialNo': serial,
            },
            'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'newerFound': newer,
        }
        STATUS_FILE.write_text(json.dumps(status, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('갱신:', STATUS_FILE.relative_to(ROOT))

    sys.exit(2 if newer else 0)


if __name__ == '__main__':
    main()
