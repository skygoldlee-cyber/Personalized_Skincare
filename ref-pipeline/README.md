# ref-pipeline — 콘텐츠 변환 도구함 (PDF→MD, MD→HTML)

> **독립 실행 단위**: 앱 빌드와 분리된 콘텐츠 제작 도구. 변환 엔진·래퍼·GUI·의존성을 한 폴더에 모아, 저장소 구조와 무관하게 독립 실행된다.

## 구성

| 파일 | 역할 |
|---|---|
| `pdf2md.py` | PDF→MD 변환 엔진 (공백 복원·표 구조화·무선 표 재구성·마진 잡행 제거) — ~980줄, 도메인 프로파일 내장 |
| `convert.py` | 스테이징 워크플로 래퍼 — `pdf_root → ref_md_v2(스테이징) → ref_md(프로덕션)` |
| `pdf2md_gui.py` | pdf2md의 PySide6 GUI 프런트엔드 (엔진 재사용) |
| `MD_to_HTML.py` | MD→독립 HTML 변환기 (~4,700줄) — 모바일 file:// 대응·Mermaid 프리렌더·콜아웃 규칙, `--gui` 지원 |
| `callout_rules.json` | MD_to_HTML 콜아웃 패턴 규칙 (스크립트 옆 파일로 자동 인식) |
| `requirements.txt` | Python 의존성 (pdfplumber·markdown 필수, PyMuPDF·PySide6 선택) |

## 설치

```powershell
pip install -r ref-pipeline/requirements.txt
# GUI 사용 시: pip install PySide6
```

## 사용 (저장소 내부 — 기존 워크플로)

```powershell
npm.cmd run convert:refs            # 참조자료 PDF 전체 → ref_md_v2 스테이징
npm.cmd run convert:refs -- 화장품법  # 파일명 필터
npm.cmd run verify:refs             # ref_md_v2 vs ref_md 골든 비교
```

입출력 기본값은 활성 시험(`EXAM_CONTENT_ROOT`/`EXAM_ID` env → `content/exams.json` default)의 `참조자료/` 폴더다.

## 사용 (독립 실행 — 저장소와 무관)

```powershell
python ref-pipeline/convert.py --pdf-root "D:\PDFs" --staging "D:\out\ref_md_v2"
python ref-pipeline/convert.py --verify --staging "D:\out\ref_md_v2" --prod "D:\out\ref_md"
```

단일 PDF 직접 변환은 엔진 자체 CLI 사용:

```powershell
python ref-pipeline/pdf2md.py "file.pdf" -o out.md --doctor
python ref-pipeline/pdf2md.py --pdf-root "D:\PDFs" -o out_dir --flat
```

MD→독립 HTML 변환 (공유·인쇄용, 모바일 file:// 대응):

```powershell
python ref-pipeline/MD_to_HTML.py --in doc.md --out doc.html
python ref-pipeline/MD_to_HTML.py --gui        # GUI 모드 (PySide6 필요)
```

## 프로덕션 승격 절차 (저장소 워크플로)

```
PDF 교체/추가
  → npm.cmd run convert:refs          # ref_md_v2 스테이징 생성
  → npm.cmd run verify:refs           # 골든 비교 (누락 시 exit 1)
  → ref_md_v2/{문서}/ → ref_md/과목N/{문서}/ 수동 승격
  → npm.cmd run check:reffresh -- --update   # PDF 해시 스탬프
  → npm.cmd run check:content          # 인용·귀속·레이아웃 정합성 검증
```

⚠️ **`#L####` 라인 인용이 라인 번호에 의존** — ref_md는 항상 시각적 줄 그대로(`segment=False`) 변환한다. 엔진의 `--no-segment` 상당이 래퍼에 고정되어 있다.

## 저장소와의 경계

- **이 폴더 소유**: PDF→MD 변환 로직 전부
- **저장소 소유 (`tools/check_ref_*.js`)**: 교재 `(L###)`·📌출처·과목 귀속·`pdf_hashes.json` 신선도 검증 — 교재·문제은행↔ref_md 교차 참조라 저장소에서만 의미 있음
- 이 폴더는 별도 저장소로 승격해도 무방한 설계 (입출력이 CLI 인자로 명시적)
