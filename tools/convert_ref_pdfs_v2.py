#!/usr/bin/env python3
"""ref_md 재변환 — pdf2md 엔진 래퍼 (프로젝트 고정 경로 + 스테이징)

변환 엔진(공백 복원/표 구조화/무선 표 재구성/마진 잡행 제거)은
tools/pdf2md.py가 소유한다. 이 파일은 프로젝트 경로와 스테이징
워크플로만 고정한 래퍼다 — 엔진 로직을 여기서 수정하지 말 것.

사용:
  python tools/convert_ref_pdfs_v2.py            # 전체 PDF → ref_md_v2
  python tools/convert_ref_pdfs_v2.py 화장품법     # 파일명에 해당 문자열이 포함된 것만
  python tools/convert_ref_pdfs_v2.py --verify    # ref_md_v2 vs ref_md 골든 비교
                                                 # (변환 없이 비교만, 내용 누락 시 종료코드 1)

주의: `#L####` 인용이 라인 번호에 의존하므로 ref_md는 항상 시각적 줄
그대로(--no-segment 상당) 변환한다.
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdf2md

sys.stdout.reconfigure(encoding='utf-8')

# 프로젝트 고정 경로 — pdf2md의 contentRoot 해석을 공유한다
# (EXAM_CONTENT_ROOT/EXAM_ID env로 대상 시험 지정 가능)
REF_BASE = pdf2md.DEFAULT_PDF_ROOT
OUT_DIR = os.path.join(REF_BASE, 'ref_md_v2')
PROD_DIR = os.path.join(REF_BASE, 'ref_md')

# ref_md 산출물은 라인 인용 호환을 위해 문장 병합을 끈다
pdf2md.PROFILE['segment'] = False


def main():
    args = [a for a in sys.argv[1:] if a != '--verify']
    if '--verify' in sys.argv:
        only = args[0] if args else None
        sys.exit(1 if pdf2md.verify(OUT_DIR, PROD_DIR, only) else 0)
    only = args[0] if args else None
    pdfs = pdf2md._scan_dir(REF_BASE, apply_excludes=True)
    if only:
        pdfs = [(l, p) for l, p in pdfs if only in os.path.basename(p)]
    if not pdfs:
        print('변환할 PDF가 없습니다.')
        sys.exit(1)

    report = []
    for subdir, pdf_path in pdfs:
        basename = os.path.splitext(os.path.basename(pdf_path))[0]
        out_dir = os.path.join(OUT_DIR, basename)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, basename + '.md')
        try:
            body = pdf2md.convert(pdf_path, os.path.join(out_dir, 'images'))
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
            'ws': round(pdf2md.whitespace_ratio(body), 1),
            'tables': n_tables,
        })
        print(f'OK {basename}: {len(body):,}자, 공백 {report[-1]["ws"]}%, 표 {n_tables}')
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, '_report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    fails = [r for r in report if 'error' in r]
    print(f'\n총 {len(report)}개 → {OUT_DIR}'
          + (f'  ⚠ 실패 {len(fails)}건' if fails else ''))


if __name__ == '__main__':
    main()
