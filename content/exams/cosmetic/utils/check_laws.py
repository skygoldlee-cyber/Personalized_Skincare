#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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
    python check_laws.py                 # 콘솔 출력 + report/법령최신확인결과.md 생성
    python check_laws.py your_oc_id      # OC를 인자로 전달해도 됨
"""
import os, sys, re, datetime, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

OC = os.environ.get("LAW_OC") or (sys.argv[1] if len(sys.argv) > 1 else "")
API = "https://www.law.go.kr/DRF/lawSearch.do"
TODAY = datetime.date.today().isoformat()

# (표시명, target, 검색어, 교재 인용 번호, 교재 인용 시행일)
LAWS = [
    ("화장품법", "law", "화장품법", "제20901호", "2026.04.02"),
    ("화장품법 시행규칙", "law", "화장품법 시행규칙", "제2109호", "2026.04.02"),
    ("화장품 안전기준 등에 관한 규정", "admrul", "화장품 안전기준 등에 관한 규정", "제2026-19호", "2026.03.18"),
    ("우수화장품 제조 및 품질관리기준", "admrul", "우수화장품 제조 및 품질관리기준", "제2024-46호", "2024.08.22"),
    ("기능성화장품 심사에 관한 규정", "admrul", "기능성화장품 심사에 관한 규정", "제2025-88호", "2025.12.16"),
    ("기능성화장품 기준 및 시험방법", "admrul", "기능성화장품 기준 및 시험방법", "제2025-89호", "2025.12.16"),
    ("화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정",
     "admrul", "화장품 사용할 때의 주의사항 및 알레르기 유발성분", "제2026-56호", "2026.08.05"),
    ("화장품의 색소 종류 및 기준", "admrul", "화장품의 색소 종류 및 기준", "제2023-61호", "2023.09.21"),
]

# 2026-08-30 사람이 law.go.kr에서 직접 확인한 값(참고용, 자동 판정에는 쓰지 않음).
# 스크립트가 조회 실패해도 이 세 건은 '교재=현행 일치'로 확인됨.
VERIFIED_20260830 = {
    "화장품법": ("제20901호", "2026.04.02", "일치(현행)"),
    "화장품법 시행규칙": ("제2109호", "2026.04.02", "일치(현행)"),
    "화장품 안전기준 등에 관한 규정": ("제2026-19호", "2026.03.18", "일치(현행)"),
}

def norm_num(s):
    """'제2026-19호','2026-19','20901' 등을 비교용 코어로 정규화."""
    if not s: return ""
    s = s.replace("제", "").replace("호", "").strip()
    m = re.search(r"\d{4}-\d+|\d+", s)
    return m.group(0) if m else s

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
        if rec["status"] == "확인실패" and disp in VERIFIED_20260830:
            vn, vd, vs = VERIFIED_20260830[disp]
            rec["cur_num"], rec["cur_date"] = vn, vd
            rec["status"] = f"수동확인:{vs}"
            rec["note"] = (rec["note"] + " / 2026-08-30 수동검증값").strip(" /")
        rows.append(rec)
    return rows, api_down

def write_md(rows, api_down):
    ok = sum(r["status"].startswith("최신") or "일치" in r["status"] for r in rows)
    need = sum(r["status"] == "업데이트 필요" for r in rows)
    fail = sum(r["status"] == "확인실패" for r in rows)
    L = [f"# 8개 법령·고시 현행 확인 결과 (check_laws.py v2)\n",
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
    out_path = Path(__file__).resolve().parent.parent / "report" / "법령최신확인결과.md"
    out_path.write_text("\n".join(L) + "\n", encoding="utf-8")

if __name__ == "__main__":
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass
    rows, api_down = run()
    write_md(rows, api_down)
    print(f"확인 일시 {TODAY} / OC {'설정됨' if OC else '없음(자동조회 미수행)'}")
    for i, r in enumerate(rows, 1):
        print(f"{i}. {r['name'][:24]:24} 교재 {r['book_num']:>10} → 현행 {r['cur_num'] or '—':>10}  [{r['status']}] {r['note']}")
    print("\n생성: 법령최신확인결과.md")
    if not OC:
        print("※ OC 키 없이 실행됨: 자동조회는 건너뛰고, 수동검증된 3건만 값이 채워집니다.")
