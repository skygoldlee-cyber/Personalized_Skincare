#!/usr/bin/env python3
"""5개 '_구' 폐지 별표 PDF → MD 변환하여 ref_md/에 생성
기존 ref_md MD 파일 형식과 동일: # {basename}\n\n{extracted text}
"""
import pypdfium2 as pdfium
import os

BASE = r"C:\Project\Personalized_Skincare\content\참조자료"
REF_MD = os.path.join(BASE, "ref_md")

old_pdfs = [
    ("공통", "안전기준_별표1_독성시험법_구.pdf"),
    ("공통", "안전기준_별표2_기준시험방법작성요령_구.pdf"),
    ("공통", "안전기준_별표3_자외선차단효과측정_구.pdf"),
    ("공통", "안전기준_별표4_자료제출생략기능성_구.pdf"),
    ("과목2", "안전기준_별표1_색소_구.pdf"),
]

for subdir, filename in old_pdfs:
    pdf_path = os.path.join(BASE, subdir, filename)
    basename = filename.replace(".pdf", "")
    
    if not os.path.exists(pdf_path):
        print(f"SKIP (파일 없음): {subdir}/{filename}")
        continue
    
    # PDF 텍스트 추출
    pdf = pdfium.PdfDocument(pdf_path)
    page_count = len(pdf)
    
    all_text = []
    for i in range(page_count):
        page = pdf[i]
        textpage = page.get_textpage()
        text = textpage.get_text_range()
        textpage.close()
        page.close()
        all_text.append(text)
    
    pdf.close()
    
    # MD 파일 생성 (기존 ref_md 형식과 동일)
    md_dir = os.path.join(REF_MD, basename)
    os.makedirs(md_dir, exist_ok=True)
    md_path = os.path.join(md_dir, basename + ".md")
    
    md_content = f"# {basename}\n\n" + "\n\n".join(all_text)
    
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    
    print(f"OK: {subdir}/{filename} → ref_md/{basename}/{basename}.md ({page_count}페이지, {len(md_content):,}자)")

print("\n변환 완료")
