#!/usr/bin/env python3
"""PDF → MD 변환 가능성 검토: 5개 '_구' PDF의 텍스트를 UTF-8 파일로 추출"""
import pypdfium2 as pdfium
import os

BASE = r"C:\Project\Personalized_Skincare\content\참조자료"
OUT = r"C:\Project\Personalized_Skincare\tools\pdf_preview"
os.makedirs(OUT, exist_ok=True)

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
        continue
    
    pdf = pdfium.PdfDocument(pdf_path)
    page_count = len(pdf)
    
    all_text = []
    for i in range(page_count):
        page = pdf[i]
        textpage = page.get_textpage()
        text = textpage.get_text_range()
        textpage.close()
        page.close()
        all_text.append(f"--- 페이지 {i+1}/{page_count} ---\n{text}")
    
    pdf.close()
    
    out_path = os.path.join(OUT, basename + ".txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# {filename}\n# 페이지 수: {page_count}\n\n" + "\n\n".join(all_text))
    
    print(f"{filename}: {page_count}페이지, {sum(len(t) for t in all_text):,}자 → {out_path}")

print("\n완료")
