// src/views/glossary-renderer.js — 용어집(중요 용어 해설) 렌더링 모듈
// textbook-reader.js에서 용어집 수집·렌더링·이벤트 바인딩을 분리한 모듈.
// 데이터 접근은 glossary-query.js를 통해 추상화됩니다.
import { esc } from '../sanitize.js';
import { resolveRefPath } from '../pdf-registry.js';
import { getGlossaryByRefFile } from '../glossary-query.js';

/**
 * 챕터의 섹션들을 순회하며 용어집 항목을 수집합니다.
 * @param {Array} sections - 챕터 섹션 배열
 * @param {string|null} chapterRefPath - 챕터 대표 참조문서 경로
 * @param {function} mapSourceToRefFn - 출처 텍스트 → 참조문서 경로 매핑 함수
 * @returns {Array<{idxKey:string, keyword:string, explanation:string, refDoc:string, curated?:boolean}>}
 */
export function collectGlossaryItems(sections, chapterRefPath, mapSourceToRefFn) {
    const seenKeys = new Set();
    const glossaryItems = [];

    for (const s of sections) {
        const secSrcM = (s.content || '').match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n)/);
        const secRefP = secSrcM ? mapSourceToRefFn(secSrcM[1]) : null;
        const secRefPath = secRefP || chapterRefPath;
        if (secRefPath) {
            const refFileName = secRefPath.split('/').pop();
            const items = getGlossaryByRefFile(refFileName, seenKeys);
            glossaryItems.push(...items);
        }
    }

    return glossaryItems;
}

/**
 * 용어집 테이블 HTML을 생성합니다.
 * @param {Array} glossaryItems - collectGlossaryItems() 반환값
 * @returns {string} HTML 문자열
 */
export function renderGlossaryTable(glossaryItems) {
    if (!glossaryItems || glossaryItems.length === 0) return '';

    const rows = glossaryItems.map(item => {
        const explanation = item.explanation || '(설명 없음)';
        const refPath = resolveRefPath(item.refDoc + '.pdf');
        const refLink = refPath
            ? `<a href="#" data-ref-html="${esc(refPath)}" class="glossary-ref-link"><i class="fa-solid fa-file-lines"></i> ${esc(item.refDoc || '')}</a>`
            : esc(item.refDoc || '');
        return `<tr id="glossary-${esc(item.idxKey)}"><td class="glossary-term">${esc(item.keyword)}</td><td class="glossary-explanation">${esc(explanation)}</td><td class="glossary-ref">${refLink}</td></tr>`;
    }).join('\n');

    return `
    <div class="reader-glossary" id="reader-glossary">
    <h4 class="glossary-title">📖 중요 용어 해설</h4>
    <div class="reader-table-wrapper">
    <table class="reader-table glossary-table">
    <thead><tr><th>용어</th><th>설명</th><th>출처</th></tr></thead>
    <tbody>
    ${rows}
    </tbody>
    </table>
    </div>
    </div>`;
}

/**
 * TOC에 용어집 항목을 추가합니다.
 * @param {HTMLElement} tocList - TOC 컨테이너 요소
 */
export function appendGlossaryTocItem(tocList) {
    if (!tocList) return;
    const glossaryTocItem = document.createElement('div');
    glossaryTocItem.className = 'reader-toc-item';
    glossaryTocItem.dataset.glossaryScroll = '1';
    glossaryTocItem.style.cssText = 'margin-top:0.4rem;border-top:1px solid var(--border-color,#30363d);padding-top:0.4rem;';
    glossaryTocItem.innerHTML = '<span class="toc-num"><i class="fa-solid fa-book-bookmark"></i></span><span>중요 용어 해설</span>';
    glossaryTocItem.addEventListener('click', () => {
        const target = document.getElementById('reader-glossary');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    tocList.appendChild(glossaryTocItem);
}

let _glossaryBackBtn = null;
let _glossarySavedScroll = null;
let _glossarySavedLink = null;

function _ensureBackBtn() {
    if (_glossaryBackBtn) return _glossaryBackBtn;
    const btn = document.createElement('button');
    btn.className = 'glossary-back-btn';
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i> 원래 위치로';
    btn.style.display = 'none';
    btn.addEventListener('click', () => {
        if (_glossarySavedScroll !== null) {
            window.scrollTo({ top: _glossarySavedScroll, behavior: 'smooth' });
        } else if (_glossarySavedLink) {
            _glossarySavedLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        btn.style.display = 'none';
    });
    document.body.appendChild(btn);
    _glossaryBackBtn = btn;
    return btn;
}

export function scrollToGlossary(idxKey, sourceLink) {
    if (!idxKey) return;
    const target = document.getElementById(`glossary-${idxKey}`);
    if (!target) return;
    _glossarySavedScroll = window.scrollY;
    _glossarySavedLink = sourceLink || null;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.transition = 'background 0.5s ease';
    const origBg = target.style.background;
    target.style.background = 'rgba(250,204,21,0.25)';
    setTimeout(() => { target.style.background = origBg; }, 2000);
    const btn = _ensureBackBtn();
    btn.style.display = 'inline-flex';
}

/**
 * 용어집 관련 이벤트를 바인딩합니다 (본문 내 자동 링크 클릭 → 용어집 스크롤).
 * @param {HTMLElement} container - 렌더링 컨테이너
 */
export function bindGlossaryEvents(container) {
    container.querySelectorAll('[data-glossary]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToGlossary(a.dataset.glossary, a);
        });
    });
}
