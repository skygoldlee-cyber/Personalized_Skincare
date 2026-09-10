#!/usr/bin/env python3
"""PDF → MD 변환 가능성 검토: 5개 '_구' PDF의 텍스트 추출 및 내용 분석"""
import pypdfium2 as pdfium
import os
import sys

BASE = r"C:\Project\Personalized_Skincare\content\참조자료"

# 5개 '_구' PDF (MD 변환본 없음, 파일 존재)
old_pdfs = [
    ("공통", "안전기준_별표1_독성시험법_구.pdf"),
    ("공통", "안전기준_별표2_기준시험방법작성요령_구.pdf"),
    ("공통", "안전기준_별표3_자외선차단효과측정_구.pdf"),
    ("공통", "안전기준_별표4_자료제출생략기능성_구.pdf"),
    ("과목2", "안전기준_별표1_색소_구.pdf"),
]

for subdir, filename in old_pdfs:
    pdf_path = os.path.join(BASE, subdir, filename)
    print("=" * 80)
    print(f"파일: {subdir}/{filename}")
    print(f"경로: {pdf_path}")
    
    if not os.path.exists(pdf_path):
        print("  → 파일 없음")
        print()
        continue
    
    size = os.path.getsize(pdf_path)
    print(f"크기: {size:,} bytes")
    
    try:
        pdf = pdfium.PdfDocument(pdf_path)
        page_count = len(pdf)
        print(f"페이지 수: {page_count}")
        print("-" * 80)
        
        # 처음 2페이지의 텍스트만 미리보기
        for i in range(min(2, page_count)):
            page = pdf[i]
            textpage = page.get_textpage()
            text = textpage.get_text_range()
            textpage.close()
            page.close()
            
            # 텍스트 앞부분 500자만 표시
            preview = text[:500] if len(text) > 500 else text
            print(f"\n[페이지 {i+1}/{page_count}] (총 {len(text)}자)")
            print(preview)
            if len(text) > 500:
                print(f"... ({len(text) - 500}자 더 있음)")
        
        pdf.close()
    except Exception as e:
        print(f"  → 추출 실패: {e}")
    
    print()

# 4개 '_삭제' PDF (파일 자체 없음)
print("=" * 80)
print("4개 '_삭제' PDF (파일 자체 없음)")
print("=" * 80)
deleted_pdfs = [
    ("과목1", "시행규칙_별표5의2_삭제.pdf"),
    ("과목1", "시행규칙_별표5의3_삭제.pdf"),
    ("과목1", "시행규칙_별표5의4_삭제.pdf"),
    ("과목1", "시행규칙_별표8_삭제.pdf"),
]
for subdir, filename in deleted_pdfs:
    pdf_path = os.path.join(BASE, subdir, filename)
    exists = os.path.exists(pdf_path)
    print(f"  {subdir}/{filename}: {'존재' if exists else '파일 없음 (PDF 원본 미생성)'}")
