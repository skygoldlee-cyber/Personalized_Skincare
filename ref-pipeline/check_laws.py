#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# @spec CS-03
"""
check_laws.py (v2) — 시험 대상 8개 법령의 현행 호수·시행일 확인

■ v1의 근본 문제(반드시 고친 점)
  v1은 law.go.kr / mfds 조회가 전부 실패했는데도 결과표의 '확인' 칸을
  구체적 호수·시행일로 채워, 존재하지도 않는 개정본(예: 화장품법 제21709호)을
  '업데이트 필요'로 표시했다. 이 v2의 제1원칙:
      ▶▶ 조회에 성공하지 못하면 어떤 값도 지어내지 않는다.
         실패 시 status='확인실패', 값은 빈칸으로 남긴다.

■ 데이터 출처: 국가법령정보센터 OPEN API (https://www.law.go.kr/DRF/lawSearch.do)
  - 법률·총리령: target=law
  - 식약처 고시 : target=admrul (행정규칙)
  * 무료 인증키(OC) 필요: https://open.law.go.kr → 'OPEN API 활용신청'
    OC 값은 보통 law.go.kr 로그인 이메일의 @ 앞부분.
  * HTML 검색페이지 스크래핑(v1 방식)은 봇 차단이 잦아 폐기하고 공식 API로 교체.

■ 사용법
    export LAW_OC=your_oc_id
    python ref-pipeline/check_laws.py                 # 콘솔 출력 + report/법령최신확인결과.md 생성
    python ref-pipeline/check_laws.py your_oc_id      # OC를 인자로 전달해도 됨
    python ref-pipeline/check_laws.py --exam <id>     # 다른 시험 대상 (기본: env/기본 시험)

  감시 대상 법령 목록은 하드코딩하지 않고 시험의 references.json `referenceLaw`
  파일명('{문서명}({발령기관})({제N호})({시행일})')에서 자동 유도한다.
  수동 검증값은 {시험 루트}/law_verified.json에 {"문서명": ["번호","시행일","판정"]}
  형식으로 두면 조회 실패 시 대신 표시된다.

  출력 경로: {시험 루트}/report/ (기본: content/exams/<기본 시험>/report/)
"""
import os, sys, re, json, datetime, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _exam_root import exam_root, load_refs_cfg, parse_ref_filename, utf8_stdio  # noqa: E402


def _parse_args(argv):
    """--exam <id|경로> + 첫 번째 위치 인자를 OC로 취급."""
    exam, oc = None, ""
    rest = list(argv)
    for i, a in enumerate(list(rest)):
        if a == '--exam' and i + 1 < len(rest):
            exam = rest[i + 1]
            del rest[i:i + 2]
            break
        if a.startswith('--exam='):
            exam = a.split('=', 1)[1]
            del rest[i]
            break
    if rest:
        oc = rest[0]
    return exam, oc


_exam_arg, _oc_arg = _parse_args(sys.argv[1:])
EXAM_ROOT = exam_root(_exam_arg)

OC = os.environ.get("LAW_OC") or _oc_arg
API = "https://www.law.go.kr/DRF/lawSearch.do"
TODAY = datetime.date.today().isoformat()


def load_laws(exam_dir):
    """references.json referenceLaw → (표시명, target, 검색어, 교재 번호, 교재 시행일).

    검색어는 문서명 그대로 쓰되, 긴 명칭은 앞 25자 접두어로 자른다 —
    latest()가 '검색어 ⊂ API 반환명' 부분문자열 판정이므로 접두어도 매칭되고,
    파일명과 공식 명칭의 말미 표현 차이에 대한 안전장치가 된다."""
    laws = []
    for f in load_refs_cfg(exam_dir).get('referenceLaw', []):
        d = parse_ref_filename(f.get('file', ''))
        if d:
            query = d['name'][:25] if len(d['name']) > 30 else d['name']
            laws.append((d['name'], d['target'], query,
                         d.get('baselineNotice') or '',
                         (d.get('baselineDate') or '').replace('-', '.')))
    return laws


def load_verified(exam_dir):
    """{시험 루트}/law_verified.json — 수동 검증값 {"문서명": ["번호","시행일","판정"]}."""
    f = Path(exam_dir) / 'law_verified.json'
    if not f.exists():
        return {}
    try:
        return {k: tuple(v) for k, v in json.loads(f.read_text(encoding='utf-8')).items()
                if not k.startswith('_')}
    except Exception:
        return {}


LAWS = load_laws(EXAM_ROOT)
VERIFIED = load_verified(EXAM_ROOT)

def norm_num(s):
    """'제2026-19호','2026-19','02109' 등을 비교용 코어로 정규화 (그룹별 선행 0 제거)."""
    if not s: return ""
    s = s.replace("제", "").replace("호", "").strip()
    m = re.search(r"\d{4}-\d+|\d+", s)
    core = m.group(0) if m else s
    return '-'.join(str(int(p)) for p in core.split('-'))

def to_int_date(s):
    d = re.sub(r"\D", "", s or "")
    return int(d) if len(d) == 8 else -1

def fetch(target, query):
    params = {"OC": OC, "target": target, "type": "XML", "query": query, "display": "50"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace")

def first_text(el, tags):
    for t in tags:
        e = el.find(t)
        if e is not None and e.text and e.text.strip():
            return e.text.strip()
    return ""

def latest(xml_text, target, want):
    """검색 결과에서 이름이 일치하는 항목 중 시행일자 최신을 반환. 없으면 None."""
    root = ET.fromstring(xml_text)
    nodes = root.findall(".//law") if target == "law" else root.findall(".//admrul")
    best = None
    for it in nodes:
        name = first_text(it, ["법령명한글", "행정규칙명", "법령명"])
        if want.replace(" ", "") not in name.replace(" ", ""):
            continue
        enf = first_text(it, ["시행일자"])
        num = first_text(it, ["공포번호", "발령번호"])
        di = to_int_date(enf)
        if di < 0:
            continue
        if best is None or di > best[0]:
            best = (di, num, enf, name)
    return best

def run():
    rows = []
    api_down = (not OC)
    for disp, target, query, book_num, book_date in LAWS:
        rec = {"name": disp, "target": target, "book_num": book_num, "book_date": book_date,
               "cur_num": "", "cur_date": "", "status": "확인실패", "note": ""}
        if not OC:
            rec["note"] = "OC 인증키 없음 — 조회 미수행"
        else:
            try:
                b = latest(fetch(target, query), target, query)
                if not b:
                    rec["note"] = "검색 결과에서 해당 법령을 찾지 못함"
                else:
                    _, num, enf, _ = b
                    rec["cur_num"] = ("제%s호" % num) if num else ""
                    rec["cur_date"] = f"{enf[:4]}.{enf[4:6]}.{enf[6:8]}" if len(enf) == 8 else enf
                    same = (norm_num(num) == norm_num(book_num))
                    newer = to_int_date(enf) > to_int_date(book_date.replace(".", ""))
                    rec["status"] = "최신(일치)" if same else ("업데이트 필요" if newer else "차이(확인)")
            except Exception as e:
                rec["note"] = f"조회 오류: {type(e).__name__}"
        # 자동 확인이 안 됐고, 사람이 검증해 둔 값이 있으면 표시(판정은 '수동확인'으로)
        if rec["status"] == "확인실패" and disp in VERIFIED:
            vn, vd, vs = VERIFIED[disp]
            rec["cur_num"], rec["cur_date"] = vn, vd
            rec["status"] = f"수동확인:{vs}"
            rec["note"] = (rec["note"] + " / law_verified.json 수동검증값").strip(" /")
        rows.append(rec)
    return rows, api_down

def write_md(rows, api_down):
    ok = sum(r["status"].startswith("최신") or "일치" in r["status"] for r in rows)
    need = sum(r["status"] == "업데이트 필요" for r in rows)
    fail = sum(r["status"] == "확인실패" for r in rows)
    L = [f"# {len(rows)}개 법령·고시 현행 확인 결과 (check_laws.py v2)\n",
         f"> 확인 일시: {TODAY}",
         f"> 방식: 국가법령정보센터 OPEN API" + ("" if OC else "  ⚠️ OC 키 미설정 → 자동조회 미수행"),
         "> 원칙: 조회 실패 시 값을 생성하지 않음(빈칸/확인실패로 표기)\n",
         "| # | 법령명 | 교재 번호 | 교재 시행일 | 현행 번호 | 현행 시행일 | 상태 | 비고 |",
         "|:-:|--------|:--------:|:----------:|:--------:|:----------:|:----:|------|"]
    for i, r in enumerate(rows, 1):
        L.append(f"| {i} | {r['name']} | {r['book_num']} | {r['book_date']} | "
                 f"{r['cur_num'] or '—'} | {r['cur_date'] or '—'} | {r['status']} | {r['note']} |")
    L.append(f"\n**요약**: 일치/최신 {ok} · 업데이트 필요 {need} · 확인실패 {fail}\n")
    if api_down:
        L += ["> ⚠️ OC 키가 없어 자동 조회를 수행하지 못했습니다. "
              "`export LAW_OC=<키>` 후 다시 실행하세요. 아래에서 수동 확인도 가능합니다.\n"]
    L += ["## 수동 확인처",
          "- 국가법령정보센터 https://law.go.kr (법률·총리령)",
          "- 식약처 법령정보 https://law.mfds.go.kr (식약처 고시)\n",
          "> 값을 지어내지 않는 것이 이 스크립트의 핵심입니다. "
          "'확인실패'는 정보가 없다는 뜻이지, 개정이 있었다는 뜻이 아닙니다."]
    out_path = EXAM_ROOT / "report" / "법령최신확인결과.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(L) + "\n", encoding="utf-8")

if __name__ == "__main__":
    utf8_stdio()
    rows, api_down = run()
    write_md(rows, api_down)
    print(f"확인 일시 {TODAY} / OC {'설정됨' if OC else '없음(자동조회 미수행)'}")
    for i, r in enumerate(rows, 1):
        print(f"{i}. {r['name'][:24]:24} 교재 {r['book_num']:>10} → 현행 {r['cur_num'] or '—':>10}  [{r['status']}] {r['note']}")
    print("\n생성: 법령최신확인결과.md")
    if not OC:
        print("※ OC 키 없이 실행됨: 자동조회는 건너뛰고, law_verified.json 수동검증값만 채워집니다.")
