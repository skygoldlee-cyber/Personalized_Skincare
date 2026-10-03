// src/reader-toc.js — 교재 리더 목차(TOC) 추출 순수 헬퍼
// @spec TR-06
// textbook-reader.js에서 분리 — 섹션 제목의 계층 판정·메타 섹션 필터·
// 하위 헤딩 추출·슬러그 ID 생성. DOM 비의존 순수 로직.

/** 이야기형 챕터에서 본문이 아닌 메타 섹션으로 간주할 제목 패턴 */
const _STORY_META_PATTERNS = [
    /^🧭\s*학습\s*아이콘/,
    /^🎯\s*최우선\s*암기\s*축/,
    /^🔢\s*숫자\s*암기\s*미리보기/,
    /^🚀\s*시험\s*직전/,
    /^📖\s*학습\s*안내/,
    /^📖\s*핵심\s*용어\s*정리/,
    /^📊.*비교표/,
    /^✅\s*확인문제/,
    /^목차\s*$/,
    /^🔍\s*키워드/,
    /^출처:\s/,
];

export function isStoryMetaSection(title) {
    const t = (title || '').trim();
    return _STORY_META_PATTERNS.some(p => p.test(t));
}

export function filterMetaSections(chapter) {
    return {
        ...chapter,
        sections: (chapter.sections || []).filter(s => !isStoryMetaSection(s.title))
    };
}

// --- TOC 계층 구조 헬퍼 (A: 들여쓰기, F: 하위 헤딩) ---

/** 섹션 제목의 번호 패턴에서 TOC 들여쓰기 레벨 감지 */
export function getTocLevel(title) {
    const t = (title || '').trim();
    if (/^\d+\.\d+\.\d+/.test(t)) return 3;   // 1.1.1 (3단계)
    if (/^\d+\.\d+/.test(t)) return 2;         // 1.1 (2단계)
    if (/^\d+\./.test(t)) return 1;           // 1. (1단계)
    return 0;                                  // Chapter, 📖, 📊, ✅, 출처, 제N조 등
}

/** 제목이 자체 번호를 가지고 있으면 toc-num 순번을 표시하지 않음 */
export function hasOwnNumber(title) {
    const t = (title || '').trim();
    return /^\d+\./.test(t) || /^\(\d+\)/.test(t) || /Chapter\s+\d+/i.test(t);
}

/** 참조문서 헤더 (01_화장품법 등) — 앞의 NN_ 접두사 제거 */
export function cleanRefTitle(title) {
    const t = (title || '').trim();
    return t.replace(/^\d+_/, '');
}

/** 섹션 본문에서 ### / #### 하위 헤딩 추출 */
export function extractSubHeadings(content) {
    if (!content) return [];
    const lines = content.split('\n');
    const headings = [];
    let inCodeBlock = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
        if (inCodeBlock) continue;
        if (trimmed.startsWith('### ') && !trimmed.startsWith('#### ')) {
            headings.push({ level: 3, title: trimmed.replace(/^###\s+/, '').trim() });
        } else if (trimmed.startsWith('#### ')) {
            headings.push({ level: 4, title: trimmed.replace(/^####\s+/, '').trim() });
        }
    }
    return headings;
}

