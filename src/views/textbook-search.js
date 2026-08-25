// views/textbook-search.js - 교재 검색 통합 로직 (Textbook Search Integration)
import { escapeHTML, esc } from '../sanitize.js';
import { DATA_REGISTRY } from '../../data/registry.js';

const textbookState = {
    filter: 'all',
    searchQuery: '',
    debounceTimer: null
};

export function renderTextbookSearch() {
    const searchInput = document.getElementById('textbook-search-input');
    
    // Bind search input events only once
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(textbookState.debounceTimer);
            textbookState.debounceTimer = setTimeout(() => {
                textbookState.searchQuery = e.target.value.trim();
                performTextbookSearch();
            }, 250); // 250ms debounce
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(textbookState.debounceTimer);
                textbookState.searchQuery = e.target.value.trim();
                performTextbookSearch();
            }
        });
    }
    
    performTextbookSearch();
}

export function setTextbookFilter(filterVal) {
    textbookState.filter = filterVal;
    
    // Update active filter class
    const buttons = document.querySelectorAll('.textbook-filter-buttons .btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('data-filter') === filterVal) {
            btn.classList.add('active-filter');
        } else {
            btn.classList.remove('active-filter');
        }
    });
    
    performTextbookSearch();
}

export function clearTextbookSearch() {
    const searchInput = document.getElementById('textbook-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    textbookState.searchQuery = '';
    performTextbookSearch();
}

function performTextbookSearch() {
    const container = document.getElementById('textbook-results-container');
    const summary = document.getElementById('textbook-search-summary');
    if (!container) return;
    
    const query = textbookState.searchQuery.toLowerCase().trim();
    if (!query) {
        // Show empty state
        summary.textContent = '키워드를 입력하면 검색 결과가 여기에 표시됩니다.';
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                <h3>검색어를 입력하세요</h3>
                <p>위 검색창에 궁금한 교재 키워드를 입력하고 검색 결과를 확인하세요.</p>
            </div>
        `;
        return;
    }
    
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    const results = [];
    
    // Search across STUDY_DATA
    const STUDY_DATA = (typeof window !== 'undefined' && window.STUDY_DATA) ? window.STUDY_DATA : {};
    Object.keys(STUDY_DATA).forEach(subjId => {
        // Filter by subject
        if (textbookState.filter !== 'all' && textbookState.filter !== subjId) {
            return;
        }
        
        const subj = STUDY_DATA[subjId];
        if (!subj.chapters) return;
        
        subj.chapters.forEach(chapter => {
            chapter.sections.forEach(section => {
                const titleMatch = section.title.toLowerCase();
                const contentMatch = section.content.toLowerCase();
                
                // AND search: all terms must match title or content
                const isMatch = terms.every(term => titleMatch.includes(term) || contentMatch.includes(term));
                
                if (isMatch) {
                    results.push({
                        subjId: subjId,
                        subjName: subj.name,
                        chapterTitle: chapter.chapterTitle,
                        filePath: chapter.filePath,
                        sectionTitle: section.title,
                        content: section.content
                    });
                }
            });
        });
    });
    
    // Update summary text
    summary.innerHTML = `총 <strong style="color: var(--color-primary);">${results.length}</strong>건의 관련 내용을 찾았습니다.`;
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--color-warning); margin-bottom: 1rem; display: block;"></i>
                <h3>일치하는 내용이 없습니다</h3>
                <p>다른 검색어로 검색해보거나 띄어쓰기를 확인해보세요.</p>
            </div>
        `;
        return;
    }
    
    // Render results
    container.innerHTML = '';
    results.forEach((item, idx) => {
        const colors = ['badge-cyan', 'badge-violet', 'badge-emerald', 'badge-amber', 'badge-rose', 'badge-indigo'];
        const badgeColors = {};
        const subjects = (DATA_REGISTRY && DATA_REGISTRY.subjects) || [];
        subjects.forEach((sub, idx) => {
            badgeColors[sub.key] = colors[idx % colors.length];
        });
        const badgeColor = badgeColors[item.subjId] || 'badge-gray';
        
        const isLong = item.content.length > 300;
        const bodyClass = isLong ? 'textbook-card-body collapsed' : 'textbook-card-body';
        const formattedContent = formatSectionContent(item.content, terms);
        
        const cardId = `textbook-card-${idx}`;
        const cardHTML = `
            <div class="textbook-result-card">
                <div class="textbook-card-header">
                    <span class="textbook-card-path">
                        <span class="badge ${badgeColor}">${esc(item.subjName)}</span>
                        <i class="fa-solid fa-chevron-right"></i>
                        <span>${esc(item.chapterTitle)}</span>
                    </span>
                    <a href="${esc(item.filePath)}" target="_blank" class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> 전체 단원 보기
                    </a>
                </div>
                <h4 class="textbook-card-title">${highlightTextInString(item.sectionTitle, terms)}</h4>
                <div class="${bodyClass}" id="${cardId}-body">
                    ${formattedContent}
                </div>
                ${isLong ? `
                <div class="textbook-card-actions">
                    <button class="btn btn-secondary" onclick="toggleTextbookCard('${cardId}')" id="${cardId}-toggle-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600;">
                        <i class="fa-solid fa-chevron-down"></i> 더 보기
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

export function toggleTextbookCard(cardId) {
    const body = document.getElementById(`${cardId}-body`);
    const btn = document.getElementById(`${cardId}-toggle-btn`);
    if (!body || !btn) return;
    
    if (body.classList.contains('collapsed')) {
        body.classList.remove('collapsed');
        body.style.maxHeight = 'none';
        btn.innerHTML = `<i class="fa-solid fa-chevron-up"></i> 접기`;
    } else {
        body.classList.add('collapsed');
        body.style.maxHeight = '';
        btn.innerHTML = `<i class="fa-solid fa-chevron-down"></i> 더 보기`;
        body.parentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function formatSectionContent(rawContent, searchTerms = []) {
    // 1. HTML 이스케이프
    let html = escapeHTML(rawContent);
    
    // 2. 마크다운 볼드 처리
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 3. 검색어 하이라이트
    if (searchTerms.length > 0) {
        searchTerms.forEach(term => {
            if (term.length > 0) {
                html = highlightTextOutsideTags(html, term);
            }
        });
    }
    
    // 4. 리스트 아이템 및 줄 바꿈
    const lines = html.split(/\r?\n/);
    const formattedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return `<div class="md-list-item"><span class="md-bullet">•</span> ${line.replace(/^[-*]\s+/, '')}</div>`;
        }
        if (trimmed.startsWith('|')) {
            return `<div class="md-table-row">${line}</div>`;
        }
        if (trimmed === '') {
            return '';
        }
        return `<p class="md-para">${line}</p>`;
    });
    
    return formattedLines.join('');
}

function highlightTextInString(text, searchTerms = []) {
    let html = escapeHTML(text);
    if (searchTerms.length > 0) {
        searchTerms.forEach(term => {
            if (term.length > 0) {
                const escapedTerm = escapeRegExp(term);
                const termRegex = new RegExp(`(${escapedTerm})`, 'gi');
                html = html.replace(termRegex, '<mark class="txt-highlight">$1</mark>');
            }
        });
    }
    return html;
}

function highlightTextOutsideTags(html, term) {
    const regex = new RegExp(`([^<]*)(<[^>]+>)?`, 'g');
    const escapedTerm = escapeRegExp(term);
    const termRegex = new RegExp(`(${escapedTerm})`, 'gi');
    
    return html.replace(regex, (match, text, tag) => {
        const highlightedText = text.replace(termRegex, '<mark class="txt-highlight">$1</mark>');
        return highlightedText + (tag || '');
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
