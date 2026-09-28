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


def api_get(path, params):
    oc = load_oc_key()
    if not oc:
        print('!! LAW_OC_KEY가 없습니다. 둘 중 하나로 설정하세요:')
        print('   ① 환경변수   PowerShell: $env:LAW_OC_KEY = "<키>"')
        print('   ② 로컬 파일  ref-pipeline/.env.local.json → {"LAW_OC_KEY": "<키>"} (gitignore됨, 커밋 불가)')
        sys.exit(1)
    q = urllib.parse.urlencode({'OC': oc, 'target': 'admrul', 'type': 'JSON', **params})
    last_err = None
    for scheme in ('https', 'http'):  # DRF 엔드포인트는 환경에 따라 http만 받기도 함
        url = f'{scheme}://www.law.go.kr/DRF/{path}?{q}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'PersonalizedSkincare/notice-check'})
            with urllib.request.urlopen(req, timeout=15) as r:
                body = r.read().decode('utf-8', errors='replace')
        except urllib.error.HTTPError as e:
            snippet = e.read().decode('utf-8', errors='replace')[:200]
            print(f'!! HTTP {e.code} ({scheme}) — {snippet}')
            last_err = e
            continue
        except urllib.error.URLError as e:
            print(f'!! 연결 실패 ({scheme}) — {e.reason}')
            last_err = e
            continue
        try:
            return json.loads(body)
        except ValueError:
            # XML/텍스트 오류 응답 — 내용 앞부분 출력
            print(f'!! JSON 파싱 실패 — 응답 앞부분: {body[:200]}')
            last_err = ValueError('non-JSON response')
            continue
    raise SystemExit(f'law.go.kr 호출 실패: {last_err}')


def search_rule():
    """행정규칙 검색 → 대상 규정의 최신 시행 항목 반환."""
    res = api_get('lawSearch.do', {'query': RULE_NAME, 'display': 50, 'sort': 'efdes'})
    # OC 무효 등 API 레벨 오류 — 응답 구조 전체를 찍어 진단 가능하게
    body = res.get('AdmRulSearch', {})
    if isinstance(body, dict) and ('error' in body or 'message' in body):
        print('!! API 오류 응답:', json.dumps(body, ensure_ascii=False)[:300])
        sys.exit(1)
    items = body.get('admrul', [])
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


def normalize_notice(s):
    """'제2026-19호' / '2026-19' 등 → '제2026-19호' 정규화."""
    m = re.fullmatch(r'제?\s*(20\d{2})\s*-?\s*(\d+)\s*호?', str(s).strip())
    return f'제{m.group(1)}-{m.group(2)}호' if m else None


def fetch_notice_number(serial_no):
    """행정규칙 상세(admrulService)의 발령/개정고시 공포번호에서 최신 고시번호 추출."""
    try:
        detail = api_get('lawService.do', {'ID': serial_no})
    except (urllib.error.URLError, ValueError):
        return None
    # ① 공포번호 필드 우선 (발령고시·개정고시 구조에 있음)
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
    # ② 폴백 — 본문 텍스트의 '제YYYY-N호' 패턴
    if not candidates:
        candidates = [n for n in (normalize_notice(m) for m in
                                  re.findall(r'제\s*20\d{2}\s*-\s*\d+\s*호',
                                             json.dumps(detail, ensure_ascii=False)))
                      if n]
    if not candidates:
        return None
    # (제개정)이력에 여러 번호가 나올 수 있음 → 연도·번호가 가장 큰 것
    def key(s):
        m = re.search(r'20(\d{2})\s*-\s*(\d+)', s)
        return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
    return max(set(candidates), key=key)


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
