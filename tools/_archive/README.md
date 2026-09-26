# tools/_archive — 일회성 마이그레이션/수동 수정 스크립트 보관

현행 파이프라인이 아닌 과거 작업용 스크립트를 보관한다. 실행 시 경로·정규식이
현재 구조와 맞지 않을 수 있으므로 참조용으로만 사용할 것.

현행 참조자료 파이프라인:
- 변환 엔진: `tools/pdf2md.py`
- 스테이징 변환/골든 비교: `tools/convert_ref_pdfs_v2.py` (`npm run convert:refs`, `npm run verify:refs`)
- 인용 라인 동기화: `tools/sync_citation_lines.js` (`npm run sync:citations` — build:data에 포함)
- 정합성 검증: `tools/check_reflayout.js`, `tools/check_ref_freshness.js`, `tools/check_ref_subjects.js`

2026-09-26 추가: `audit_citation_links.js`, `audit_hyperlinks.js`,
`check_pdf_to_md_mapping.js`, `convert_pdf_links_to_md.js`,
`normalize_url_encoding.js`, `migrate_ref_md_subjects.js` — 참조 0건 확인 후 보관.
