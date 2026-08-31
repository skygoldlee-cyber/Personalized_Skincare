// src/reader-format.js - 교재 리더 본문 포맷터 (순수 함수, ESM)
import { parseMarkdown } from './markdown-parser.js';
import { escapeHTML } from './sanitize.js';

// PDF 파일명 → 전체 경로 매핑 (textbook-reader.js의 _PDF_REGISTRY와 동일)
const _PDF_DIR_MAP = {
    '법령원문': [
        '화장품법(법률)(제20901호)(20260402).pdf',
        '화장품법 시행규칙(총리령)(제02109호)(20260402).pdf',
        '화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf',
        '우수화장품 제조 및 품질관리기준(식품의약품안전처고시)(제2024-46호)(20240822).pdf',
        '기능성화장품 기준 및 시험방법(식품의약품안전처고시)(제2025-89호)(20251216).pdf',
        '기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf',
        '화장품 사용할 때의 주의사항 및 알레르기 유발성분 표시에 관한 규정(식품의약품안전처고시)(제2026-56호)(20260805).pdf',
        '화장품의 색소 종류 및 기준(식품의약품안전처고시)(제2023-61호)(20230921).pdf'
    ],
    '공통': [
        '화장품법(법률)(제20901호)(20260402).pdf', '색소종류및기준_전체.pdf',
        '시행규칙_별표3_사용시주의사항.pdf', '시행규칙_별표4_포장표시기준및방법.pdf',
        '시행규칙_별표5_표시광고범위및준수사항.pdf', '시행규칙_별표6_위해화장품공표문.pdf',
        '시행규칙_별표7_행정처분기준.pdf', '시행규칙_별표9_수수료.pdf',
        '안전기준_별표1_사용불가원료.pdf', '안전기준_별표2_사용제한원료.pdf',
        '안전기준_별표3_인체세포조직배양액안전기준.pdf', '안전기준_별표4_유통안전관리시험방법.pdf',
        '주의사항_별표1_유형별주의사항표시문구.pdf', '주의사항_별표2_알레르기유발성분25종.pdf',
        'CGMP_별표1_공정별분류.pdf', 'CGMP_별표2_실시상황평가표.pdf', 'CGMP_별표3_적합업소로고.pdf'
    ],
    '과목1': ['시행규칙_별표1_품질관리기준.pdf', '시행규칙_별표2_책임판매안전관리기준.pdf'],
    '과목2': [
        'KFCC_별표1_통칙.pdf', 'KFCC_별표2_미백_나이아신아마이드.pdf', 'KFCC_별표3_주름개선_레티놀.pdf',
        'KFCC_별표4_자외선보호.pdf', 'KFCC_별표5_미백주름복합.pdf', 'KFCC_별표6_모발색상변화.pdf',
        'KFCC_별표7_체모제거_치오글리콜산.pdf', 'KFCC_별표8_여드름완화_살리실릭애씨드.pdf',
        'KFCC_별표9_탈모완화_덱스판테놀.pdf', 'KFCC_별표10_일반시험법.pdf', '안전기준_별표1_색소_구.pdf'
    ]
};

const _PDF_FILE_TO_PATH = {};
for (const dir of ['과목2', '과목1', '공통', '법령원문']) {
    for (const f of _PDF_DIR_MAP[dir] || []) {
        if (!_PDF_FILE_TO_PATH[f]) _PDF_FILE_TO_PATH[f] = `content/참조자료/${dir}/${f}`;
    }
}

function _resolvePdfPath(fileName) {
    if (!fileName) return '';
    // 이미 전체 경로인 경우
    if (fileName.startsWith('content/')) return fileName;
    return _PDF_FILE_TO_PATH[fileName] || '';
}

export function formatSectionContentForReader(rawContent, filePath, pdfPath, refFiles, refDir) {
    let html = parseMarkdown(rawContent, {
        useCustomListDiv: true,
        useReaderStyles: true,
        customSpacing: true,
        allowItalics: false,
        allowInlineCode: false,
        allowMermaid: true
    });

    // 출처 파일 경로를 하이퍼링크로 변환
    // 패턴1: "출처: `../참조자료/...md`" (기본모드)
    // 패턴2: "출처: `1과목_참조자료/...md`" (이야기모드 — ../ 없음)
    // → 사이트 루트 기준 절대경로로 변환
    html = html.replace(
        /출처:\s*`?(\.{1,2}\/[^\s`<]+\.md|[^\s`<.]+_참조자료\/[^\s`<]+\.md)`?/g,
        (match, path) => {
            const absPath = path.replace(/^\.\.\/참조자료\//, './content/참조자료/')
                                .replace(/^(\d+)과목_참조자료\//, './content/참조자료/과목$1/')
                                .replace(/^\.\//, './');
            return `출처: <a href="${escapeHTML(absPath)}" target="_blank" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(path)}</a>`;
        }
    );

    // 출처: `xxx.pdf` 패턴 → PDF.js 뷰어 링크로 변환
    // allowInlineCode=false이므로 백틱이 그대로 남음
    html = html.replace(
        /출처:\s*`([^`<]+\.pdf)`/g,
        (match, pdfFile) => {
            const resolved = _resolvePdfPath(pdfFile);
            if (resolved) {
                return `출처: <a href="#" data-pdf-path="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-pdf"></i> ${escapeHTML(pdfFile)}</a>`;
            }
            return match;
        }
    );

    // **참조 PDF**: `xxx.pdf` 패턴 → PDF.js 뷰어 링크로 변환
    // 마크다운 파서 거친 후: <strong>참조 PDF</strong>: `xxx.pdf` (백틱 그대로)
    html = html.replace(
        /<strong>참조 PDF<\/strong>:\s*`([^`<]+\.pdf)`/g,
        (match, pdfFile) => {
            const resolved = _resolvePdfPath(pdfFile);
            if (resolved) {
                return `<a href="#" data-pdf-path="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-pdf"></i> ${escapeHTML(pdfFile)}</a>`;
            }
            return match;
        }
    );

    // 페이지 참조 제거: "본문 p.22", "본문 p.26~p.27" 등
    html = html.replace(/\*?\*?참고[^:]*:\s*본문\s*p\.\d+[^\n<]*/gi, '');
    html = html.replace(/본문\s*p\.\d+(?:\s*[~-]\s*p?\.\d+)?/gi, '');

    // 출처/참고 라인에 PDF 하이퍼링크 추가 (앱 내 PDF.js 뷰어 사용)
    // 단, 이미 참조 PDF 링크가 있는 경우 중복 추가하지 않음
    if (pdfPath) {
        const pdfFileName = pdfPath.split('/').pop();
        const pdfIcon = `<a href="#" data-pdf-path="${escapeHTML(pdfPath)}" class="source-link" style="margin-left:0.5em;"><i class="fa-solid fa-file-pdf"></i> ${escapeHTML(pdfFileName)}</a>`;
        // blockquote 내 출처 라인 끝에 PDF 링크 추가 (data-pdf-path가 없는 경우만)
        html = html.replace(/(📌\s*\*\*출처\*\*(?:(?!data-pdf-path)[^<])*?)(<br>|<\/p>|\n)/g, `$1 ${pdfIcon}$2`);
    }

    // 과목별 참조자료 파일 목록을 출처 라인 아래에 표시
    if (refFiles && refFiles.length > 0 && refDir) {
        const refLinks = refFiles.map(f => {
            const path = `content/참조자료/${refDir}/${f.file}`;
            const icon = f.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-lines';
            if (f.type === 'md') {
                return `<a class="ref-link-item" data-ref-md="${escapeHTML(path)}" style="display:inline-block;margin-right:0.8em;font-size:0.85em;"><i class="fa-solid ${icon}"></i> ${escapeHTML(f.name)}</a>`;
            }
            return `<a href="#" data-pdf-path="${escapeHTML(path)}" class="ref-link-item" style="display:inline-block;margin-right:0.8em;font-size:0.85em;"><i class="fa-solid ${icon}"></i> ${escapeHTML(f.name)}</a>`;
        }).join('');
        const refBlock = `<div class="reader-ref-inline" style="margin:0.4em 0;padding:0.4em 0.6em;border:1px solid var(--border-color,#30363d);border-radius:6px;font-size:0.82em;"><span style="opacity:0.7;">📚 과목별 참조자료:</span> ${refLinks}</div>`;
        // 첫 번째 blockquote 종료 후 참조자료 블록 삽입
        html = html.replace(/(<\/blockquote>)/, `$1${refBlock}`);
    }

    // 마인드맵 노드 상세 매핑: (LNN) → PDF.js 뷰어에서 키워드 검색
    // 같은 td 셀 내의 텍스트를 키워드로 추출하여 PDF 검색에 사용
    if (pdfPath) {
        // HTML에서 <td>...</td> 내부의 (LNN) 패턴을 처리
        html = html.replace(/<td>([^<]*?)\(L(\d+)\)([^<]*?)<\/td>/g,
            (match, before, lineNum, after) => {
                // 셀 내 텍스트에서 키워드 추출 (LNN) 자체는 제외
                const cellText = (before + after).replace(/\(L\d+\)/g, '').trim();
                // 의미 있는 키워드 추출 (첫 번째 공백 단어 또는 전체)
                let keyword = cellText.split(/\s+/)[0] || cellText;
                if (keyword.length < 2) keyword = cellText;
                return `<td>${before}(<a href="#" data-pdf-path="${escapeHTML(pdfPath)}" data-pdf-search="${escapeHTML(keyword)}" class="source-link">L${lineNum}</a>)${after}</td>`;
            }
        );
        // td 외부에 남은 (LNN) 패턴도 처리 (fallback)
        html = html.replace(/\(L(\d+)\)/g, (match, lineNum) => {
            return `(<a href="#" data-pdf-path="${escapeHTML(pdfPath)}" data-pdf-search="" class="source-link">L${lineNum}</a>)`;
        });
    }

    return html;
}
