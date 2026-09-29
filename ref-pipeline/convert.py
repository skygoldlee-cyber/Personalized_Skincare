#!/usr/bin/env python3
# @spec CS-03,CS-09,CS-10,PF-11,PF-15
"""convert.py — 참조자료 PDF → ref_md 스테이징 변환 래퍼 (독립 실행)

변환 엔진(공백 복원/표 구조화/무선 표 재구성/마진 잡행 제거)은
ref-pipeline/pdf2md.py가 소유한다. 이 파일은 스테이징 워크플로와
입출력 경로 해석만 담당한다 — 엔진 로직을 여기서 수정하지 말 것.

사용:
  python ref-pipeline/convert.py                          # 전체 PDF → ref_md_v2 (저장소 기본 경로)
  python ref-pipeline/convert.py 화장품법                  # 파일명 필터
  python ref-pipeline/convert.py --verify                  # ref_md_v2 vs ref_md 골든 비교

  # 저장소와 무관한 독립 실행 — 입출력을 전부 명시:
  python ref-pipeline/convert.py --pdf-root "PDF폴더" --staging "out/ref_md_v2"
  python ref-pipeline/convert.py --verify --staging "out/ref_md_v2" --prod "out/ref_md"

경로 해석 우선순위 (미지정 인자만 fallback 적용):
  --pdf-root/--staging/--prod 명시 > EXAM_CONTENT_ROOT env > EXAM_ID env
  > 저장소 content/exams.json의 default 시험 > {저장소}/content/참조자료

주의: `#L####` 인용이 라인 번호에 의존하므로 ref_md는 항상 시각적 줄
그대로(segment=False) 변환한다.
"""
import os
import sys
import json
import logging
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdf2md

logger = logging.getLogger('pdf2md')

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# ref_md 산출물은 라인 인용 호환을 위해 문장 병합을 끈다
pdf2md.PROFILE['segment'] = False


def resolve_paths(args):
    """CLI 명시 > 저장소 기본값 순으로 입출력 경로를 해석한다."""
    ref_base = args.pdf_root or pdf2md.DEFAULT_PDF_ROOT
    return {
        'pdf_root': ref_base,
        'staging': args.staging or os.path.join(ref_base, 'ref_md_v2'),
        'prod': args.prod or os.path.join(ref_base, 'ref_md'),
    }


def main():
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    ap = argparse.ArgumentParser(description='참조자료 PDF → ref_md 스테이징 변환')
    ap.add_argument('only', nargs='?', help='파일명 필터 (부분 문자열)')
    ap.add_argument('--verify', action='store_true',
                    help='스테이징 vs 프로덕션 골든 비교 (변환 없이 비교만)')
    ap.add_argument('--pdf-root', default=None,
                    help='PDF 원문 루트 (기본: 활성 시험의 참조자료 폴더)')
    ap.add_argument('--staging', default=None,
                    help='스테이징 출력 루트 (기본: {pdf_root}/ref_md_v2)')
    ap.add_argument('--prod', default=None,
                    help='프로덕션 ref_md 루트 (기본: {pdf_root}/ref_md)')
    args = ap.parse_args()
    paths = resolve_paths(args)

    if args.verify:
        # verify는 누락 문서 수(int)를 반환 — 0=통과
        sys.exit(1 if pdf2md.verify(paths['staging'], paths['prod'], args.only) else 0)

    pdfs = pdf2md._scan_dir(paths['pdf_root'], apply_excludes=True)
    if args.only:
        pdfs = [(l, p) for l, p in pdfs if args.only in os.path.basename(p)]
    if not pdfs:
        logger.error('변환할 PDF가 없습니다.')
        sys.exit(1)

    report = []
    jobs = pdf2md.plan_doc_jobs(pdfs, paths['staging'])
    for job in jobs:
        os.makedirs(job['dir'], exist_ok=True)
        try:
            body = pdf2md.convert(job['pdf'], job['images'])
        except Exception as e:
            logger.error('FAIL %s: %s', job['doc'], e)
            report.append({'doc': job['doc'], 'error': str(e)})
            continue
        md = f'# {job["basename"]}\n\n{body}\n'
        with open(job['md'], 'w', encoding='utf-8') as f:
            f.write(md)
        n_tables = md.count('|---') + md.count('| ---')
        report.append({
            'doc': job['doc'], 'src': job['src'],
            'chars': len(body), 'lines': body.count('\n') + 1,
            'ws': round(pdf2md.whitespace_ratio(body), 1),
            'tables': n_tables,
        })
        logger.info('OK %s: %s자, 공백 %s%%, 표 %d',
                    job['doc'], f'{len(body):,}', report[-1]['ws'], n_tables)
    os.makedirs(paths['staging'], exist_ok=True)
    with open(os.path.join(paths['staging'], '_report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    fails = [r for r in report if 'error' in r]
    logger.info('총 %d개 → %s%s', len(report), paths['staging'],
                f'  ⚠ 실패 {len(fails)}건' if fails else '')


if __name__ == '__main__':
    main()
