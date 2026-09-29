// src/reader-format.js - 교재 리더 본문 포맷터 (순수 함수, ESM)
// @spec TR-01,RR-18
// 참고: 다수의 정규식이 HTML 문자열에 순차적으로 replace를 적용하여 O(n×k) 비용이 발생
// (n=HTML 길이, k=정규식 수). 단일 패스 파서 또는 DOM 기반 후처리로 통합하면 성능 개선
// 가능하나, 현재 측정된 병목이 아니므로 장기 개선으로 보류.
import { parseMarkdown } from './markdown-parser.js';
import { PATHS, normalizeRefPath } from './paths.js';
import { escapeHTML } from './sanitize.js';
import { resolveRefPath, getRefTables } from './pdf-registry.js';
import { getGlossaryEntry } from './glossary-query.js';
import { lawUrlFor } from './law-links.js';

// 참조자료 문서명 → law.go.kr 공식 원문(최신 통합본) 링크 조각 (매칭 없으면 빈 문자열)
// label/title은 호출부가 문맥에 맞게 지정 (원료 DB는 '근거 고시')
function lawExtLink(name, anchorCls = 'ref-law-ext', label = '원문', titleSuffix = '공식 최신 통합본') {
    const url = lawUrlFor(name);
    if (!url) return '';
    return ` <a href="${url}" target="_blank" rel="noopener" class="${anchorCls}" title="${escapeHTML(name)} — law.go.kr ${titleSuffix} (새 탭)" aria-label="${escapeHTML(label)} — law.go.kr (새 탭)"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>${escapeHTML(label)}</a>`;
}

// 파일명 → 읽기용 표시명: 확장자·(발령기관)(제N호)(시행일) 꼬리 제거, 언더스코어→공백
// 예: '화장품법(법률)(제20901호)(20260402).md' → '화장품법'
function prettyRefName(fileName) {
    const pretty = decodeURIComponent(String(fileName || ''))
        .replace(/\.(md|pdf|html?)$/i, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return pretty || String(fileName || '');
}

// 파일명의 (제N호)(YYYYMMDD) 꼬리 → 내부 스냅샷 버전 배지 (없으면 빈 문자열)
// law.go.kr 링크는 항상 최신 통합본이므로 버전 차이를 명시한다
function refSnapshotBadge(fileName) {
    const m = String(fileName || '').match(/\(제?([\d-]+호)\)\s*\((\d{4})(\d{2})(\d{2})\)/);
    if (!m) return '';
    const ver = `제${m[1]} · ${m[2]}-${m[3]}-${m[4]}`;
    return ` <span class="ref-snapshot" title="앱 내 문서는 이 고시 기준으로 변환된 스냅샷입니다">스냅샷 ${escapeHTML(ver)}</span>`;
}

// '📚 참조 자료' 섹션 내 동일 링크 라인 중복 제거 (원본 MD의 중복 항목을 렌더링 단계에서 정리)
function dedupeRefListSection(mdText) {
    return String(mdText).replace(/(##[^\n]*참조\s*자료[^\n]*\n[\s\S]*?)(?=\n##|\n---\s*\n+##|$)/g, (section) => {
        const seen = new Set();
        return section.split('\n').filter(line => {
            const t = line.trim();
            if (!/^[-•*]?\s*\[/.test(t)) return true;
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
        }).join('\n');
    });
}

export function formatSectionContentForReader(rawContent, filePath, refPath, refFiles, refDir, glossaryKeywords, sectionTitle) {
    rawContent = dedupeRefListSection(rawContent);
    let html = parseMarkdown(rawContent, {
        useCustomListDiv: true,
        useReaderStyles: true,
        customSpacing: true,
        allowItalics: false,
        allowInlineCode: false,
        allowMermaid: true
    });

    // 본문 목차(## 📋 목차) 섹션의 리스트 항목 → 대응 섹션으로 스크롤되는 하이퍼링크 변환
    // 마크다운 파서가 - **Chapter 01.** xxx를 <div class="md-list-item">...<span>...</span></div>로 변환
    // 사이드바 TOC와 동일하게 data-toc-jump 속성을 부여하여 textbook-reader.js에서 위임 처리
    if (sectionTitle && /^📋\s*목차/.test(sectionTitle)) {
        html = html.replace(/<div class="md-list-item"[^>]*>([\s\S]*?)<\/div>/gi, (match, inner) => {
            // 내부 텍스트 추출 (HTML 태그 제거, 불릿/앞뒤 공백 정제)
            const fullText = inner.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/^[•·]\s*/, '').trim();
            if (!fullText) return match;
            // span 내부를 링크로 감쌈
            const linkedInner = inner.replace(/<span>([\s\S]*?)<\/span>/, (m, spanContent) => {
                return `<span><a href="#" data-toc-jump="${escapeHTML(fullText)}" class="toc-jump-link" style="color:var(--color-primary,#1f6feb);text-decoration:underline dotted;cursor:pointer;">${spanContent}</a></span>`;
            });
            return `<div class="md-list-item" style="padding-left: 0.5rem;">${linkedInner}</div>`;
        });
    }

    // 기출문제 링크 → 앱 내 HTML 문제집 뷰어(ExamViewer)로 열기
    // 마크다운 파서가 [text](기출문제/과목N_...)를 <a href="기출문제/과목N_...">text</a>로 변환한 후 처리
    // 실제 파일 경로는 DATA_REGISTRY.exams에서 동적 조회 (하드코딩 제거)
    const _examFileMap = {};
    if (typeof window !== 'undefined' && window.DATA_REGISTRY && Array.isArray(window.DATA_REGISTRY.exams)) {
        window.DATA_REGISTRY.exams.forEach(e => {
            if (e.key && e.file) _examFileMap[e.key] = e.file;
        });
    }
    html = html.replace(
        /<a href="기출문제\/과목(\d+)[^"]*">([^<]+)<\/a>/g,
        (match, subjNum, linkText) => {
            const examKey = `subject${subjNum}`;
            const fileName = _examFileMap[examKey] || `과목${subjNum}_단일정답형.md`;
            const mdPath = PATHS.EXAM_BANK(fileName);
            return `<a href="#" data-exam-md="${escapeHTML(mdPath)}" class="exam-link-btn" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:var(--color-primary,#1f6feb);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9rem;"><i class="fa-solid fa-pen-to-square"></i> ${escapeHTML(linkText)}</a>`;
        }
    );

    // 과목간 교차 참조 링크 → 교재 리더 내 과목 이동 + 챕터 섹션 스크롤
    // 마크다운 파서가 [text](subj:law#ch01)를 <a href="subj:law#ch01">text</a>로 변환한 후 처리
    // 패턴 1: subj:key#chNN (챕터 앵커 포함)
    html = html.replace(
        /<a href="subj:([a-z]+)#(ch\d+)">([^<]+)<\/a>/g,
        (match, subjKey, chapterAnchor, linkText) => {
            return `<a href="#" data-ref-subject="${escapeHTML(subjKey)}" data-ref-chapter="${escapeHTML(chapterAnchor)}" class="cross-subject-link" style="color:var(--color-primary,#1f6feb);text-decoration:underline dotted;font-weight:600;">${escapeHTML(linkText)}</a>`;
        }
    );
    // 패턴 2: subj:key (챕터 앵커 없음 - 레거시 호환)
    html = html.replace(
        /<a href="subj:([a-z]+)">([^<]+)<\/a>/g,
        (match, subjKey, linkText) => {
            return `<a href="#" data-ref-subject="${escapeHTML(subjKey)}" class="cross-subject-link" style="color:var(--color-primary,#1f6feb);text-decoration:underline dotted;font-weight:600;">${escapeHTML(linkText)}</a>`;
        }
    );

    // 참조자료 PDF 링크 → 앱 내 HTML 뷰어로 열기 (레거시 fallback)
    // 2026-09 교재 전수조사 이후 모든 PDF 링크가 ref_md MD 링크로 변환됨.
    // 마크다운 파서가 [file.pdf](../참조자료/...)를 <a href="../참조자료/...">file.pdf</a>로 변환한 후 처리
    html = html.replace(
        /<a href="((?:\.\.\/)?(?:참조자료|공통참조자료|\d과목_참조자료)\/[^"]+\.pdf)">([^<]+)<\/a>/g,
        (match, rawPath, linkText) => {
            const pdfFile = decodeURIComponent(rawPath.split('/').pop());
            const resolved = resolveRefPath(pdfFile);
            if (resolved) {
                const displayName = linkText.replace(/\.pdf$/, '');
                return `<a href="#" data-ref-html="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(displayName)}</a>`;
            }
            return match;
        }
    );

    // ref_md MD 파일 링크 → 앱 내 HTML 뷰어로 열기
    // 마크다운 파서가 [text](../참조자료/ref_md/.../....md)를 <a href="../참조자료/ref_md/.../....md">text</a>로 변환한 후 처리
    html = html.replace(
        /<a href="((?:\.\.\/)?참조자료\/ref_md\/[^"]+\.md)">([^<]+)<\/a>/g,
        (match, rawPath, linkText) => {
            const absPath = normalizeRefPath(rawPath);
            const fileName = decodeURIComponent(rawPath.split('/').pop() || '');
            const displayName = prettyRefName(fileName || linkText);
            const lawUrl = lawUrlFor(fileName);
            // 스냅샷 배지는 📚 참조 자료 섹션에서만 병기 (본문 📌출처 인라인은 노이즈 방지로 생략)
            return `<span class="ref-md-row"${lawUrl ? ` data-law-url="${lawUrl}"` : ''}><a href="#" data-ref-html="${escapeHTML(absPath)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(displayName)}</a>${lawExtLink(fileName)}</span>`;
        }
    );

    // 📚 참조 자료 섹션의 ref_md 링크에만 스냅샷 버전 배지 삽입 — 인라인 인용은 제외
    // 리더 모드에서 ## 는 <p class="md-para">로 렌더되므로 두 형태 모두 커버
    html = html.replace(
        /(<(?:h[1-6]|p)[^>]*>\s*(?:#+\s*)?[^<]*참조\s*자료[\s\S]*?)(?=<h[1-6]|<p[^>]*>\s*#|$)/g,
        (section) => section.replace(
            /(<a href="#" data-ref-html="([^"]+)" class="source-link">[\s\S]*?<\/a>)/g,
            (m, a, p) => a + refSnapshotBadge(decodeURIComponent(p.split('/').pop() || '')),
        ),
    );

    // 원료 DB MD 파일 링크 → 앱 내 HTML 뷰어로 열기
    // 마크다운 파서가 [text](../참조자료/원료/....md)를 <a href="../참조자료/원료/....md">text</a>로 변환한 후 처리
    html = html.replace(
        /<a href="((?:\.\.\/)?참조자료\/원료\/[^"]+\.md)">([^<]+)<\/a>/g,
        (match, rawPath, linkText) => {
            const absPath = normalizeRefPath(rawPath);
            const fileName = decodeURIComponent(rawPath.split('/').pop() || '');
            return `<a href="#" data-ref-html="${escapeHTML(absPath)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(linkText)}</a>${lawExtLink(fileName, 'ref-law-ext', '근거 고시', '근거 고시 원문')}`;
        }
    );

    // 출처 파일 경로를 하이퍼링크로 변환
    // 패턴1: "출처: `../참조자료/...md`" (기본모드)
    // 패턴2: "출처: `1과목_참조자료/...md`" (이야기모드 — ../ 없음)
    // → 앱 내 MD 뷰어(data-ref-md)로 열기
    html = html.replace(
        /출처:\s*`?(\.{1,2}\/[^\s`<]+\.md|[^\s`<.]+_참조자료\/[^\s`<]+\.md)`?/g,
        (match, path) => {
            const refBase = PATHS.REFERENCE_BASE + '/';
            const absPath = path.replace(/^\.\.\/참조자료\//, refBase)
                                .replace(/^(\d+)과목_참조자료\//, `${refBase}과목$1/`);
            const displayName = path.split('/').pop().replace(/\.md$/, '');
            return `출처: <a href="#" data-ref-md="${escapeHTML(absPath)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(displayName)}</a>`;
        }
    );

    // 출처: `xxx.pdf` 패턴 → HTML 뷰어 링크로 변환 (표시 텍스트에서 .pdf 확장자 제거)
    // 2026-09 교재 전수조사 이후 모든 PDF 출처 링크가 ref_md MD 링크로 변환됨.
    // allowInlineCode=false이므로 백틱이 그대로 남음 — 레거시 fallback으로 유지
    html = html.replace(
        /출처:\s*`([^`<]+\.pdf)`/g,
        (match, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            if (resolved) {
                const displayName = pdfFile.replace(/\.pdf$/, '');
                return `출처: <a href="#" data-ref-html="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(displayName)}</a>`;
            }
            return match;
        }
    );

    // **참조 PDF**: `xxx.pdf` 패턴 → HTML 뷰어 링크로 변환 (라벨을 '참조 자료'로 변경, .pdf 확장자 제거)
    // 2026-09 교재 전수조사 이후 모든 PDF 참조 링크가 ref_md MD 링크로 변환됨.
    // 마크다운 파서 거친 후: <strong>참조 PDF</strong>: `xxx.pdf` (백틱 그대로) — 레거시 fallback으로 유지
    html = html.replace(
        /<strong>참조 PDF<\/strong>:\s*`([^`<]+\.pdf)`/g,
        (match, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            if (resolved) {
                const displayName = pdfFile.replace(/\.pdf$/, '');
                return `<strong>참조 자료</strong>: <a href="#" data-ref-html="${escapeHTML(resolved)}" class="source-link"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(displayName)}</a>`;
            }
            return match;
        }
    );

    // 페이지 참조 제거: 다양한 p.NN 패턴 정리
    // mermaid 블록을 플레이스홀더로 보호 (내부 p.NN 패턴이 손상되는 것 방지)
    const _mermaidPhs = [];
    html = html.replace(/<pre class="mermaid">[\s\S]*?<\/pre>/g, (m) => {
        const i = _mermaidPhs.length;
        _mermaidPhs.push(m);
        return `\uE002M${i}\uE003`;
    });
    // 1. "참고: 본문 p.22~p.27" 등 참고 라인 전체 제거
    html = html.replace(/\*?\*?참고[^:]*:\s*본문\s*p\.\d+[^\n<]*/gi, '');
    // 2. "본문 p.22", "본문 p.26~p.27" 등 본문 페이지 참조 제거
    html = html.replace(/본문\s*p\.\d+(?:\s*[~-]\s*p?\.\d+)?/gi, '');
    // 3. 섹션 헤더에서 "p.NN — " 제거: <h2>p.22 — 제목</h2> → <h2>제목</h2>
    html = html.replace(/(<h[234]>)p\.\d+\s*[—\-–]\s*/gi, '$1');
    // 4. 괄호 안 페이지 범위 제거: "(p.80~83)", "(p.86~98)", "(p.139~144)" 등
    html = html.replace(/\(\s*p\.\d+(?:\s*[~-]\s*p?\.\d+)?\s*\)/gi, '');
    // 5. "법령노트 p.NN" 패턴에서 페이지 번호 제거
    html = html.replace(/법령노트\s*p\.\d+/gi, '법령노트');
    // 6. 출처 라인 끝의 "(p.NN~NN)" 제거 (이미 괄호 패턴에서 처리되지만, 남은 경우)
    html = html.replace(/,?\s*p\.\d+(?:\s*[~-]\s*p?\.\d+)?\s*\)/gi, ')');
    // 7. 독립적인 "p.NN" 텍스트 제거 (문맥상 페이지 번호만 남은 경우)
    html = html.replace(/(?<![a-zA-Z])p\.\d+(?:\s*[~-]\s*p?\.\d+)?(?![a-zA])/gi, '');
    // mermaid 블록 복원
    html = html.replace(/\uE002M(\d+)\uE003/g, (m, i) => _mermaidPhs[parseInt(i)]);

    // 출처/참고 라인에 참조자료 하이퍼링크 추가 (앱 내 HTML 뷰어 사용)
    // 단, 이미 참조 링크가 있는 경우 중복 추가하지 않음
    if (refPath) {
        const refFileName = refPath.split('/').pop().replace(/\.(html|md)$/, '');
        const refIcon = `<a href="#" data-ref-html="${escapeHTML(refPath)}" class="source-link" style="margin-left:0.5em;"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(refFileName)}</a>`;
        // blockquote 내 출처 라인 끝에 참조 링크 추가 (data-ref-html이 없는 경우만)
        html = html.replace(/(📌\s*\*\*출처\*\*(?:(?!data-ref-html)[^<])*?)(<br>|<\/p>|\n)/g, `$1 ${refIcon}$2`);
    }

    // 과목별 참조자료 파일 목록을 출처 라인 아래에 표시
    if (refFiles && refFiles.length > 0 && refDir) {
        const refLinks = refFiles.map(f => {
            const icon = 'fa-file-lines';
            if (f.type === 'md') {
                const path = PATHS.REFERENCE_FILE(refDir, f.file);
                return `<a class="ref-link-item" data-ref-md="${escapeHTML(path)}" style="display:inline-block;margin-right:0.8em;font-size:0.85em;"><i class="fa-solid ${icon}"></i> ${escapeHTML(f.name)}</a>`;
            }
            // PDF 타입 → resolveRefPath로 HTML 경로 변환
            const path = resolveRefPath(f.file);
            return `<a href="#" data-ref-html="${escapeHTML(path)}" class="ref-link-item" style="display:inline-block;margin-right:0.8em;font-size:0.85em;"><i class="fa-solid ${icon}"></i> ${escapeHTML(f.name)}</a>`;
        }).join('');
        const refBlock = `<div class="reader-ref-inline" style="margin:0.4em 0;padding:0.4em 0.6em;border:1px solid var(--border-color,#30363d);border-radius:6px;font-size:0.82em;"><span style="opacity:0.7;">📚 과목별 참조자료:</span> ${refLinks}</div>`;
        // 첫 번째 blockquote 종료 후 참조자료 블록 삽입 (단, 이미 reader-ref-inline이 있는 경우 중복 방지)
        if (!html.includes('reader-ref-inline')) {
            html = html.replace(/(<\/blockquote>)/, `$1${refBlock}`);
        }
    }

    // 본문 키워드 자동 하이퍼링크: 법령명/별표명을 클릭 가능한 링크로 변환
    // <p>와 <li> 내 텍스트 노드만 처리 (기존 <a> 태그, <td>, 출처 라인 제외)
    html = html.replace(/<(p|li)>([^<]*)<\/\1>/g, (match, tag, text) => {
        let result = text;
        for (const entry of (getRefTables().KEYWORD_REF_MAP || [])) {
            const re = new RegExp(entry.pattern.source, entry.pattern.flags.replace(/g$/, ''));
            if (re.test(result) && !result.includes('data-ref-html')) {
                const path = resolveRefPath(entry.file);
                if (path) {
                    const search = entry.search || '';
                    result = result.replace(re, (kw) =>
                        `<a href="#" data-ref-html="${escapeHTML(path)}" data-ref-search="${escapeHTML(search)}" class="keyword-ref-link" style="color:var(--color-primary,#1f6feb);text-decoration:underline dotted;">${escapeHTML(kw)}</a>`
                    );
                }
            }
        }
        return `<${tag}>${result}</${tag}>`;
    });

    // 마인드맵 노드 상세 매핑: (LNN) → 같은 페이지 하단 용어집 테이블로 스크롤
    // 같은 td 셀 내의 텍스트를 키워드로 추출하여 용어집 앵커로 사용
    // 지원 형식: (L42) 동일 참조자료, (L42|file.pdf) 타 참조자료, (L?) 미발견
    if (refPath) {
        // (L?) 패턴 → 링크 없이 일반 텍스트로 렌더
        html = html.replace(/<td>([^<]*?)\(L\?\)([^<]*?)<\/td>/g,
            (match, before, after) => `<td>${before}(L?)${after}</td>`
        );
        // (LNN|file.pdf) 패턴 → 용어집 앵커 링크 (GLOSSARY_INDEX에 키워드가 있는 경우만)
        html = html.replace(/<td>([^<]*?)\(L(\d+)\|(.+?\.pdf)\)([^<]*?)<\/td>/g,
            (match, before, lineNum, pdfFile, after) => {
                const resolved = resolveRefPath(pdfFile);
                const usePath = resolved || refPath;
                const idxKey = `${usePath.split('/').pop()}|L${lineNum}`;
                const entry = getGlossaryEntry(idxKey);
                if (!entry) return `<td>${before}(L?)${after}</td>`;
                return `<td>${before}(<a href="#glossary-${escapeHTML(idxKey)}" data-glossary="${escapeHTML(idxKey)}" class="glossary-link">L${lineNum}</a>)${after}</td>`;
            }
        );
        // (LNN) 패턴 → 용어집 앵커 링크 (GLOSSARY_INDEX에 키워드가 있는 경우만)
        html = html.replace(/<td>([^<]*?)\(L(\d+)\)([^<]*?)<\/td>/g,
            (match, before, lineNum, after) => {
                const idxKey = `${refPath.split('/').pop()}|L${lineNum}`;
                const entry = getGlossaryEntry(idxKey);
                if (!entry) return `<td>${before}(L?)${after}</td>`;
                return `<td>${before}(<a href="#glossary-${escapeHTML(idxKey)}" data-glossary="${escapeHTML(idxKey)}" class="glossary-link">L${lineNum}</a>)${after}</td>`;
            }
        );
        // td 외부에 남은 (LNN|file.pdf) 패턴도 처리
        html = html.replace(/\(L(\d+)\|(.+?\.pdf)\)/g, (match, lineNum, pdfFile) => {
            const resolved = resolveRefPath(pdfFile);
            const usePath = resolved || refPath;
            const idxKey = `${usePath.split('/').pop()}|L${lineNum}`;
            const entry = getGlossaryEntry(idxKey);
            if (!entry) return '(L?)';
            return `(<a href="#glossary-${escapeHTML(idxKey)}" data-glossary="${escapeHTML(idxKey)}" class="glossary-link">L${lineNum}</a>)`;
        });
        // td 외부에 남은 (LNN) 패턴도 처리
        html = html.replace(/\(L(\d+)\)/g, (match, lineNum) => {
            const idxKey = `${refPath.split('/').pop()}|L${lineNum}`;
            const entry = getGlossaryEntry(idxKey);
            if (!entry) return '(L?)';
            return `(<a href="#glossary-${escapeHTML(idxKey)}" data-glossary="${escapeHTML(idxKey)}" class="glossary-link">L${lineNum}</a>)`;
        });
    }

    // 출처 라인의 제N조를 추출하여 참조 링크에 data-ref-search + data-ref-anchor 자동 추가
    // 클릭 시 HTML 뷰어에서 해당 조문을 자동 검색 및 앵커 스크롤 (Deep Linking)
    html = html.split('\n').map(line => {
        if (!line.includes('data-ref-html')) return line;
        if (!line.includes('출처') && !line.includes('참고')) return line;

        // 제N조의M 패턴 추출 (첫 번째 매칭 사용)
        const articleMatch = line.match(/제(\d+)조(?:의(\d+))?/);
        if (!articleMatch) return line;

        const search = `제${articleMatch[1]}조${articleMatch[2] ? '의' + articleMatch[2] : ''}`;

        // 첫 번째 data-ref-html 링크에 data-ref-search + data-ref-anchor 추가
        return line.replace(
            /(data-ref-html="[^"]*")(?!\s*data-ref-search)/,
            `$1 data-ref-search="${escapeHTML(search)}" data-ref-anchor="${escapeHTML(search)}"`
        );
    }).join('\n');

    // --- 본문 중 용어집 키워드 자동 링크 ---
    // 용어집에 등록된 키워드가 본문에 나오면 해당 용어집 앵커로 링크
    if (glossaryKeywords && glossaryKeywords.length > 0) {
        // 키워드 길이 내림차순 정렬 (긴 키워드 먼저 매칭하여 부분 매칭 방지)
        const sorted = [...glossaryKeywords]
            .filter(k => k.keyword && k.keyword.length >= 2)
            .sort((a, b) => b.keyword.length - a.keyword.length);
        if (sorted.length > 0) {
            // HTML 태그와 기존 <a> 링크, <pre> 블록 전체를 안전한 플레이스홀더로 보호
            const phs = [];
            let processed = html.replace(/<pre class="mermaid">[\s\S]*?<\/pre>|<a\s[^>]*>[\s\S]*?<\/a>|<[^>]+>/g, (m) => {
                const i = phs.length;
                phs.push(m);
                return `\uE000P${i}\uE001`;
            });
            // 단일 패스 교대 정규식으로 모든 키워드 동시 매칭
            // 한국어 단어 경계: 키워드 앞뒤 모두 한글 음절이 있으면(=더 긴 단어의 일부) 매칭하지 않음
            // 조사(을, 를, 이, 가 등)가 뒤에 오는 경우는 매칭 허용
            const pattern = sorted.map(k => k.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            const re = new RegExp(`(${pattern})`, 'g');
            processed = processed.replace(re, (match, _g1, offset, str) => {
                const item = sorted.find(k => k.keyword === match);
                if (!item) return match;
                // 앞뒤가 모두 한글 음절이면 더 긴 단어의 일부로 간주하여 스킵
                const before = offset > 0 ? str[offset - 1] : '';
                const afterIdx = offset + match.length;
                const after = afterIdx < str.length ? str[afterIdx] : '';
                const isKorean = (ch) => /[가-힣]/.test(ch);
                if (isKorean(before) && isKorean(after)) return match;
                return `<a href="#glossary-${escapeHTML(item.idxKey)}" data-glossary="${escapeHTML(item.idxKey)}" class="glossary-term-link">${escapeHTML(match)}</a>`;
            });
            // 플레이스홀더 복원
            html = processed.replace(/\uE000P(\d+)\uE001/g, (m, i) => phs[parseInt(i)]);
        }
    }

    // --- 마인드맵 노드 상세 매핑 표: 중분류 셀을 섹션 점프 링크로 자동 변환 ---
    // "🗺️ 마인드맵 노드 상세 매핑" 다음에 오는 표의 2번째 열(중분류)을
    // data-toc-jump 링크로 변환하여 해당 섹션으로 바로 이동 가능하게 함.
    // 단, 대분류(1열)가 "Ch"로 시작하는 전체 마인드맵 매핑 표만 변환.
    // 챕터별 매핑 표(대분류가 마인드맵 노드명)는 섹션 내 세부 내용이므로 링크화 제외.
    html = html.replace(
        /(<div class="md-quote"><strong>🗺️ 마인드맵 노드 상세 매핑<\/strong><\/div>[\s\S]*?<div class="reader-table-wrapper">[\s\S]*?<tbody>)([\s\S]*?)(<\/tbody>)/g,
        (match, before, tbody, after) => {
            // 첫 번째 데이터 행의 대분류가 "Ch"로 시작하는지 확인
            const firstRowMatch = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
            if (!firstRowMatch) return match;
            const firstTdMatch = firstRowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/);
            if (!firstTdMatch) return match;
            const firstCat = firstTdMatch[1].replace(/<[^>]+>/g, '').trim();
            // 대분류가 "Ch"로 시작하지 않으면 링크화하지 않음 (챕터별 매핑 표)
            if (!/^Ch\d/i.test(firstCat)) return match;
            // tbody 내의 각 <tr>에서 2번째 <td>를 링크로 변환
            const linked = tbody.replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/g, (m, trAttr, trContent) => {
                // <td>들을 분리
                const tds = [];
                const tdRe = /<td([^>]*)>([\s\S]*?)<\/td>/g;
                let tdMatch;
                while ((tdMatch = tdRe.exec(trContent)) !== null) {
                    tds.push({ full: tdMatch[0], attr: tdMatch[1], content: tdMatch[2] });
                }
                if (tds.length < 2) return m;
                // 2번째 td (중분류)의 텍스트 추출
                const midText = tds[1].content.replace(/<[^>]+>/g, '').trim();
                if (!midText) return m;
                // 링크로 변환
                tds[1].full = `<td${tds[1].attr}><a href="#" data-toc-jump="${escapeHTML(midText)}" class="mindmap-jump-link" style="color:var(--color-primary,#1f6feb);text-decoration:underline dotted;cursor:pointer;">${tds[1].content}</a></td>`;
                return `<tr${trAttr}>${tds.map(t => t.full).join('')}</tr>`;
            });
            return before + linked + after;
        }
    );

    return html;
}

/* =======================================================
   이야기형 서사 범위 태깅 (markStoryNarrative)
   - 📖 장면 헤딩 ~ 다음 헤딩 전까지 (장면은 리프 블록 — 레벨 무관하게 종료)
   - 💭 에필로그 인용구 ~ 다음 헤딩 전까지
   - '프롤로그'/'등장인물' 섹션 카드 전체
   표·코드·머메이드·콜아웃 인용(🔖/📋/📌 등)은 서사 범위에서 제외한다.
   ======================================================= */

const _STORY_SCENE_MARK = '📖';
const _STORY_CARD_TITLE_RE = /프롤로그|등장인물/;
const _STORY_EPILOGUE_RE = /에필로그/;
const _STORY_HEADING_SEL = '.md-h3, .md-h4, .md-h5';
// 명시적 서사 경계 마커 — 원문 '─' 대신 '┈'(U+2508) 사용. HTML 주석
// <!-- story:start/end -->는 파서가 제거하므로 이 눈에 보이는 마커를 기준으로 한다.
const _STORY_BOUNDARY_START_RE = /^📖\s*┈+/;
const _STORY_BOUNDARY_END_RE = /📘\s*$/;

/** 인용구가 대사/서사인지 판별 — 따옴표로 시작하거나 에필로그 본문이면 서사 */
function _isNarrativeQuote(el) {
    const t = (el.textContent || '').trim();
    return /^["“‘']/.test(t) || _STORY_EPILOGUE_RE.test(t);
}

/**
 * 섹션 콘텐츠의 서사 블록 요소에 .story-narrative 클래스를 부여한다.
 * @param {Element} contentEl .textbook-reader-section-content (또는 .reader-subsection-content)
 */
export function markStoryNarrative(contentEl) {
    if (!contentEl || !contentEl.children) return;
    const children = Array.from(contentEl.children);
    // 경계는 리프 문단만 인정 — .reader-subsection-content 같은 컨테이너가
    // textContent로 오인되면 내부 전체가 중앙정렬되는 문제 방지
    const isBoundaryStart = (el) => el.tagName === 'P' && _STORY_BOUNDARY_START_RE.test((el.textContent || '').trim());
    const isBoundaryEnd = (el) => el.tagName === 'P' && _STORY_BOUNDARY_END_RE.test((el.textContent || '').trim()) && /┈/.test(el.textContent || '');
    const hasMarkers = children.some(isBoundaryStart);

    // 명시 마커 모드 — '📖 ┈ 이야기 ┈' ~ '┈ 본문 ┈ 📘' 사이를 전부 서사로 태깅.
    // 마커 문단 자체는 story-boundary로 태깅해 경계 표시 스타일을 준다.
    if (hasMarkers) {
        let inScene = false;
        for (const el of children) {
            if (isBoundaryStart(el)) {
                el.classList.add('story-boundary', 'story-boundary-start');
                inScene = true;
                continue;
            }
            if (isBoundaryEnd(el)) {
                el.classList.add('story-boundary', 'story-boundary-end');
                inScene = false;
                continue;
            }
            if (inScene) el.classList.add('story-narrative');
        }
        return;
    }

    // 폴백(마커 없는 문서): 📖 헤딩 리프 블록 + 💭 에필로그 + 프롤로그/등장인물 카드
    const card = contentEl.closest('.reader-section-card');
    const cardTitleEl = card ? card.querySelector('.reader-section-title') : null;
    // 프롤로그/등장인물 카드는 전체가 서사 — 헤딩이 와도 범위가 끊기지 않는다
    const wholeCard = _STORY_CARD_TITLE_RE.test(cardTitleEl ? cardTitleEl.textContent : '');

    let inScene = wholeCard;

    for (const el of contentEl.children) {
        const isHeading = el.matches && el.matches(_STORY_HEADING_SEL);
        const isSubTitle = el.classList && el.classList.contains('reader-subsection-title');

        if (isHeading || isSubTitle) {
            if (isHeading && (el.textContent || '').includes(_STORY_SCENE_MARK)) {
                inScene = true;
                el.classList.add('story-narrative');
                continue;
            }
            // 장면은 리프 블록 — 📖 아닌 헤딩이 오면 무조건 종료 (하위 레벨 헤딩도 본문)
            if (!wholeCard) inScene = false;
            if (!inScene) continue;
        } else if (!inScene && el.classList && el.classList.contains('md-quote')
            && _STORY_EPILOGUE_RE.test(el.textContent || '')) {
            // 에필로그 인용구 — 다음 헤딩 전까지 서사
            inScene = true;
        }

        if (!inScene) continue;
        // 서사 범위 안의 콜아웃 인용(🔖 기억 태그, 📋 가이드, 📌 출처 등)은 본문 스타일 유지
        if (el.classList.contains('md-quote') && !_isNarrativeQuote(el)) continue;
        el.classList.add('story-narrative');
    }
}
