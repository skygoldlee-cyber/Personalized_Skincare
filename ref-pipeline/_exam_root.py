"""ref-pipeline 공용 시험 루트 해석 헬퍼.

각 스크립트에 흩어져 있던 환경변수 보일러플레이트를 이 파일로 단일화한다.
파이프라인 전체에서 이 모듈만 import하면 새 시험은 `EXAM_ID=xxx` 한 줄로
또는 CLI `--exam xxx` 인자로 전환할 수 있다.

해석 우선순위:
  1. CLI 인자(--exam, 시험 id 또는 절대/상대 경로)
  2. EXAM_CONTENT_ROOT env (디렉토리 직접 지정 — 테스트·임시 콘텐츠용)
  3. EXAM_ID env (시험 id → {저장소}/content/exams/{id})
  4. content/exams.json의 default 시험

윈도우 cp949 터미널 대응 utf8_stdio()와 참조자료 파일명
'{문서명}({발령기관})({제N호})({시행일})' 파서 parse_ref_filename()도 여기에 둔다.
"""
import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EXAMS_JSON = REPO_ROOT / 'content' / 'exams.json'
_FALLBACK_EXAM = 'cosmetic'


def repo_root() -> Path:
    return REPO_ROOT


def utf8_stdio() -> None:
    """cp949/cp1252 콘솔에서 한글·이모지 출력이 깨지지 않게 UTF-8로 재설정."""
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass


def exam_targets() -> list:
    """content/exams.json의 시험 목록. 없으면 빈 리스트."""
    if not EXAMS_JSON.exists():
        return []
    try:
        data = json.loads(EXAMS_JSON.read_text(encoding='utf-8'))
        return data.get('exams', [])
    except Exception:
        return []


def default_exam_id() -> str:
    for t in exam_targets():
        if t.get('default'):
            return t['id']
    ts = exam_targets()
    return ts[0]['id'] if ts else _FALLBACK_EXAM


def resolve_exam_id(cli: str = None) -> str:
    """시험 id 해석: CLI(--exam이 id일 때) > EXAM_ID env > default.

    EXAM_ID가 exams.json에 미등록이면 경고 후 기본 시험으로 폴백한다
    (기존 pdf2md._default_content_root와 같은 계약)."""
    if cli and not _looks_like_path(cli):
        return cli
    eid = os.environ.get('EXAM_ID')
    if eid:
        targets = exam_targets()
        if targets and not any(t.get('id') == eid for t in targets):
            print(f'!! EXAM_ID={eid} 미등록 — 기본 시험 사용', file=sys.stderr)
        else:
            return eid
    return default_exam_id()


def _looks_like_path(s: str) -> bool:
    return os.sep in s or '/' in s or ':' in s or s.endswith('.json') \
        or Path(s).exists()


def exam_root(cli: str = None) -> Path:
    """시험 콘텐츠 루트를 해석한다.

    cli가 디렉토리 경로로 보이면 그 경로를, id로 보이면
    exams.json 엔트리의 contentRoot(없으면 content/exams/{id})를 반환한다.
    """
    if cli:
        p = Path(cli)
        if p.is_dir() or _looks_like_path(cli):
            return p if p.is_absolute() else (REPO_ROOT / p).resolve()
        return _content_root_for(cli)
    env = os.environ.get('EXAM_CONTENT_ROOT')
    if env:
        p = Path(env)
        return p if p.is_absolute() else (REPO_ROOT / p).resolve()
    return _content_root_for(resolve_exam_id())


def _content_root_for(exam_id: str) -> Path:
    """exams.json 엔트리의 contentRoot 필드 우선, 없으면 content/exams/{id}."""
    for t in exam_targets():
        if t.get('id') == exam_id:
            return REPO_ROOT / t.get('contentRoot', f'content/exams/{exam_id}')
    return REPO_ROOT / 'content' / 'exams' / exam_id


def exam_data_root(exam_id: str = None) -> Path:
    """시험 데이터 루트(data/exams/{id}) — exams.json의 dataRoot 우선."""
    eid = exam_id or resolve_exam_id()
    for t in exam_targets():
        if t.get('id') == eid and t.get('dataRoot'):
            return REPO_ROOT / t['dataRoot']
    return REPO_ROOT / 'data' / 'exams' / eid


def load_refs_cfg(exam_dir: Path = None) -> dict:
    """시험 루트의 references.json을 읽는다. 없으면 빈 dict."""
    d = Path(exam_dir) if exam_dir else exam_root()
    f = d / 'references.json'
    if not f.exists():
        return {}
    try:
        return json.loads(f.read_text(encoding='utf-8'))
    except Exception:
        return {}


_LAW_AGENCY_RE = re.compile(r'\((법률|대통령령|총리령|부령)\)')
_NOTICE_RE = re.compile(r'\(제([\d]+(?:-\d+)?)호\)\s*\((\d{8})\)')


def fmt_date(d) -> str:
    """'20260402' → '2026-04-02'. 그 외 형식은 그대로."""
    d = str(d or '').strip()
    return f'{d[:4]}-{d[4:6]}-{d[6:8]}' if len(d) == 8 and d.isdigit() else d


def parse_ref_filename(file_name: str):
    """'화장품법(법률)(제20901호)(20260402).pdf' → 감시 대상 메타.

    파일명 규약: {문서명}({발령기관})({제N호})({시행일 YYYYMMDD})
    반환: {name, target, file, url, baselineNotice, baselineDate}
      target: 'law'(법률·대통령령·총리령·부령) | 'admrul'(고시 등 행정규칙)
    check_mfds_notice.py·check_laws.py가 공용으로 사용한다.
    """
    name = re.split(r'\(', file_name)[0].strip()
    m = _NOTICE_RE.search(file_name)
    target = 'law' if _LAW_AGENCY_RE.search(file_name) else 'admrul'
    url = 'https://www.law.go.kr/' + ('법령' if target == 'law' else '행정규칙') \
        + '/' + re.sub(r'\s+', '', name)
    return {
        'name': name,
        'target': target,
        'file': file_name,
        'url': url,
        'baselineNotice': f'제{m.group(1)}호' if m else None,
        'baselineDate': fmt_date(m.group(2)) if m else None,
    }
