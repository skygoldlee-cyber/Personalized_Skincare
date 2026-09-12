// views/textbook-reader.js - 교재 본문 읽기 및 오디오북 플레이어 (Textbook Reader + Audio)
import { esc } from '../sanitize.js';
import { formatSectionContentForReader } from '../reader-format.js';
import { parseTextbookContent } from '../textbook-parser.js';
import { renderStudyAids, bindStudyAidToggles, renderExamFilterToggle, applyExamFilter } from '../study-aids.js';
import { detectMermaidType, getMermaidClassName, getMermaidInitOptions } from '../mermaid-utils.js';
import { openHtmlViewer } from '../html-viewer.js';
import {
    SUBJECT_DIR_MAP, REFERENCE_FILES, REFERENCE_COMMON, REFERENCE_INGREDIENTS,
    REFERENCE_LAW, mapSourceToRef, resolveRefPath
} from '../pdf-registry.js';
import { collectGlossaryItems, renderGlossaryTable, appendGlossaryTocItem, scrollToGlossary } from './glossary-renderer.js';
import {
    readerAudioState,
    showAudioToast,
    persistCurrentAudioPos,
    stopReaderAudio,
    toggleReaderAudio,
    toggleReaderPlayPause,
    cycleReaderAudioRate,
    seekReaderAudio,
    toggleReaderAutoScroll,
    getAudioPathForChapter
} from './reader-audio.js';

export {
    stopReaderAudio,
    toggleReaderAudio,
    toggleReaderPlayPause,
    cycleReaderAudioRate,
    seekReaderAudio,
    toggleReaderAutoScroll
};
// [모바일 PWA 견고성] 오디오 매니페스트는 window 전역(가드)에서 읽는다(정적 import 하드 의존 지양).
import { DataLoader } from '../data-loader.js';
import { trapFocus } from '../ui-utils.js';
import { STORAGE_KEYS } from '../storage-keys.js';
import { TIMING } from '../config/timing.js';
import { PATHS } from '../paths.js';
import { CACHE } from '../config/cache.js';

// --- 교재 본문 읽기 (Textbook Reader) ---
let textbookReaderState = {
    selectedSubject: '',
    selectedChapter: '',
    storyMode: false
};

// 1. 교재 읽기 이어하기 — localStorage 영속화
const READER_POSITION_KEY = STORAGE_KEYS.READER_LAST_POSITION;
let _scrollSaveTimer = null;

function saveReaderPosition() {
    try {
        const container = document.getElementById('textbook-reader-container');
        const scrollTop = container ? Math.round(container.scrollTop) : 0;
        const pos = {
            subject: textbookReaderState.selectedSubject || '',
            chapter: textbookReaderState.selectedChapter || '',
            scrollTop: scrollTop,
            storyMode: textbookReaderState.storyMode || false,
            ts: Date.now()
        };
        localStorage.setItem(READER_POSITION_KEY, JSON.stringify(pos));
    } catch (e) { /* noop */ }
}

function loadReaderPosition() {
    try {
        const raw = localStorage.getItem(READER_POSITION_KEY);
        if (!raw) return null;
        const pos = JSON.parse(raw);
        // 30일 이상 지난 위치는 무시
        if (pos.ts && (Date.now() - pos.ts > 30 * 24 * 60 * 60 * 1000)) return null;
        return pos;
    } catch (e) { return null; }
}

function clearReaderPosition() {
    try { localStorage.removeItem(READER_POSITION_KEY); } catch (e) { /* noop */ }
}

// 스크롤 위치 저장 (디바운스: 1초 후 저장)
function scheduleSaveReaderPosition() {
    if (_scrollSaveTimer) clearTimeout(_scrollSaveTimer);
    _scrollSaveTimer = setTimeout(saveReaderPosition, 1000);
}

// --- 이야기형 MD 캐시: { "subjId:chapterIdx": { chapterTitle, sections, filePath } } ---
// LRU 캐시: 최대 항목 수를 초과하면 가장 오래된 항목 제거 (메모리 누수 방지)
const _storyChapterCache = {};
const _STORY_CACHE_MAX_ENTRIES = CACHE.STORY_CACHE_MAX_ENTRIES;
let _storyCacheKeyOrder = [];

function _touchStoryCacheKey(key) {
    const idx = _storyCacheKeyOrder.indexOf(key);
    if (idx >= 0) _storyCacheKeyOrder.splice(idx, 1);
    _storyCacheKeyOrder.push(key);
}

function _evictStoryCacheIfNeeded() {
    while (_storyCacheKeyOrder.length > _STORY_CACHE_MAX_ENTRIES) {
        const oldest = _storyCacheKeyOrder.shift();
        delete _storyChapterCache[oldest];
    }
}

export { textbookReaderState };

export function renderTextbookReader() {
    const subjectSelect = document.getElementById('reader-subject-select');
    const container = document.getElementById('textbook-reader-container');
    
    if (!subjectSelect || !container) return;

    // Initialize reader convenience toolbar (font size, theme, focus mode, etc.)
    initReaderToolbar();
    
    // Always repopulate subject select to ensure fresh state
    const previousValue = subjectSelect.value || textbookReaderState.selectedSubject;
    subjectSelect.innerHTML = '<option value="">과목을 선택하세요</option>';
    
    // DataLoader를 사용하여 레지스트리 기반으로 과목 목록 구성
    const subjects = (typeof DataLoader !== 'undefined' && DataLoader.registry)
        ? DataLoader.getSubjectList()
        : [];
    
    subjects.forEach(subj => {
        const option = document.createElement('option');
        option.value = subj.key;
        option.textContent = subj.name;
        subjectSelect.appendChild(option);
    });
    
    // Restore subject selection
    if (previousValue && subjectSelect.querySelector(`option[value="${previousValue}"]`)) {
        subjectSelect.value = previousValue;
        textbookReaderState.selectedSubject = previousValue;
    }
    
    // 1. 교재 읽기 이어하기 — 저장된 위치 복원
    const savedPos = (!previousValue && !textbookReaderState.selectedSubject) ? loadReaderPosition() : null;
    
    // Restore previous selections
    if (savedPos && savedPos.subject) {
        textbookReaderState.selectedSubject = savedPos.subject;
        textbookReaderState.selectedChapter = savedPos.chapter || '0';
        textbookReaderState.storyMode = savedPos.storyMode || false;
    }
    
    if (textbookReaderState.selectedSubject) {
        subjectSelect.value = textbookReaderState.selectedSubject;
        // 단원 선택 UI 제거: 과목 선택 시 자동으로 chapter 0(전체) 로드
        textbookReaderState.selectedChapter = '0';
        DataLoader.loadSubject(textbookReaderState.selectedSubject).then(() => {
            renderChapterContent(textbookReaderState.selectedSubject, 0).then(() => {
                // 스크롤 위치 복원 (콘텐츠 렌더링 후)
                if (savedPos && savedPos.scrollTop > 0) {
                    const cont = document.getElementById('textbook-reader-container');
                    if (cont) {
                        requestAnimationFrame(() => {
                            cont.scrollTop = savedPos.scrollTop;
                        });
                    }
                }
            }).catch(err => console.error('renderChapterContent failed:', err));
        }).catch(err => console.error('loadSubject failed:', err));
    }
    
    // Bind events only once
    if (!subjectSelect.dataset.bound) {
        subjectSelect.dataset.bound = 'true';
        
        subjectSelect.addEventListener('change', (e) => {
            const subjId = e.target.value;
            textbookReaderState.selectedSubject = subjId;
            const hadAudio = !!readerAudioState.audio;
            stopReaderAudio();
            if (hadAudio) showAudioToast('과목이 변경되어 오디오 재생이 중지되었습니다.');
            
            if (subjId) {
                // 단원 선택 UI 제거: 과목 선택 시 자동으로 chapter 0(전체) 로드
                textbookReaderState.selectedChapter = '0';
                saveReaderPosition(); // 1. 교재 읽기 이어하기
                DataLoader.loadSubject(subjId).then(() => {
                    renderChapterContent(subjId, 0);
                }).catch(err => console.error('loadSubject failed:', err));
            } else {
                textbookReaderState.selectedChapter = '';
                saveReaderPosition();
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                        <h3>읽을 교재를 선택하세요</h3>
                        <p>위에서 과목을 선택하면 해당 교재의 본문 내용이 표시됩니다.</p>
                    </div>
                `;
            }
        });
    }

    // Story mode checkbox binding (bind once)
    const storyToggle = document.getElementById('reader-story-mode-toggle');
    if (storyToggle && !storyToggle.dataset.bound) {
        storyToggle.dataset.bound = 'true';
        storyToggle.checked = textbookReaderState.storyMode;
        storyToggle.addEventListener('change', (e) => {
            textbookReaderState.storyMode = e.target.checked;
            // Re-render current chapter if one is selected
            if (textbookReaderState.selectedSubject && textbookReaderState.selectedChapter) {
                renderChapterContent(textbookReaderState.selectedSubject, parseInt(textbookReaderState.selectedChapter));
            }
        });
    }
}

function renderChapterContent(subjId, chapterIdx) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return Promise.resolve();

    chapterIdx = parseInt(chapterIdx);
    const STUDY_DATA = (typeof window !== 'undefined' && window.STUDY_DATA) ? window.STUDY_DATA : {};
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters || isNaN(chapterIdx) || !subj.chapters[chapterIdx]) return Promise.resolve();

    const originalChapter = subj.chapters[chapterIdx];

    // 다른 단원으로 이동하면 이전 오디오 정지
    if (readerAudioState.audio &&
        (readerChapterContext.subjId !== subjId || readerChapterContext.chapterIdx !== chapterIdx)) {
        stopReaderAudio();
        showAudioToast('단원이 변경되어 오디오 재생이 중지되었습니다.');
    }

    readerChapterContext.subjId = subjId;
    readerChapterContext.chapterIdx = chapterIdx;

    const isStory = textbookReaderState.storyMode;
    if (isStory) {
        return _loadStoryChapter(subjId, chapterIdx, originalChapter).then(chapter => {
            _renderChapterContentInternal(subjId, chapterIdx, subj, chapter, true);
        }).catch(err => {
            console.warn('[Story Mode] 이야기형 MD 로드 실패, 기본 모드로 전환:', err);
            showAudioToast('이야기형 파일을 불러올 수 없어 기본 모드로 표시합니다.');
            const filteredChapter = _filterMetaSections(originalChapter);
            _renderChapterContentInternal(subjId, chapterIdx, subj, filteredChapter, false);
        });
    } else {
        const filteredChapter = _filterMetaSections(originalChapter);
        _renderChapterContentInternal(subjId, chapterIdx, subj, filteredChapter, false);
        return Promise.resolve();
    }
}

async function _loadStoryChapter(subjId, chapterIdx, originalChapter) {
    const cacheKey = `${subjId}:${chapterIdx}`;
    if (_storyChapterCache[cacheKey]) {
        _touchStoryCacheKey(cacheKey); // LRU: 캐시 히트 시 최근 사용 위치로 이동
        return _storyChapterCache[cacheKey];
    }

    const manifest = await DataLoader._getManifest();
    const subjMeta = manifest.subjects.find(s => s.key === subjId);
    if (!subjMeta) throw new Error('과목 메타데이터 없음: ' + subjId);

    const chapterMeta = (subjMeta.chapters || []).find(c => c.key === originalChapter.chapterKey);
    const storyFile = (chapterMeta && chapterMeta.storyFile)
        ? chapterMeta.storyFile
        : originalChapter.fileName.replace(/_표준형\.md$/i, '_이야기형.md').replace(/\.md$/i, '_이야기형.md');

    const relPath = PATHS.TEXTBOOK_FILE(subjMeta.dir, storyFile);
    const md = await DataLoader._getMd(relPath, subjId);
    const subjectDir = PATHS.TEXTBOOK_DIR(subjMeta.dir);
    const parsed = parseTextbookContent(md, storyFile, subjectDir);

    const storyChapter = {
        chapterTitle: parsed.chapterTitle,
        sections: parsed.sections.filter(s => !_isStoryMetaSection(s.title)),
        filePath: PATHS.TEXTBOOK_FILE_REL(subjMeta.dir, storyFile),
        fileName: storyFile
    };

    _storyChapterCache[cacheKey] = storyChapter;
    _touchStoryCacheKey(cacheKey);
    _evictStoryCacheIfNeeded();
    return storyChapter;
}

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

function _isStoryMetaSection(title) {
    const t = (title || '').trim();
    return _STORY_META_PATTERNS.some(p => p.test(t));
}

function _filterMetaSections(chapter) {
    return {
        ...chapter,
        sections: (chapter.sections || []).filter(s => !_isStoryMetaSection(s.title))
    };
}

// --- TOC 계층 구조 헬퍼 (A: 들여쓰기, F: 하위 헤딩) ---

/** 섹션 제목의 번호 패턴에서 TOC 들여쓰기 레벨 감지 */
function _getTocLevel(title) {
    const t = (title || '').trim();
    if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(t)) return 3; // ①②③ ...
    if (/^\(\d+\)/.test(t)) return 2;       // (1), (2) ...
    if (/^\d+\./.test(t)) return 1;         // 1., 2. ...
    return 0;                               // Chapter, 📖, 📊, ✅, 출처, 제N조 등
}

/** 제목이 자체 번호를 가지고 있으면 toc-num 순번을 표시하지 않음 */
function _hasOwnNumber(title) {
    const t = (title || '').trim();
    return /^\d+\./.test(t) || /^\(\d+\)/.test(t) || /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(t) || /Chapter\s+\d+/i.test(t);
}

/** 참조문서 헤더 (01_화장품법 등) — 앞의 NN_ 접두사 제거 */
function _cleanRefTitle(title) {
    const t = (title || '').trim();
    return t.replace(/^\d+_/, '');
}

/** 섹션 본문에서 ### / #### 하위 헤딩 추출 */
function _extractSubHeadings(content) {
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

/** 하위 헤딩용 슬러그 ID 생성 */
let _headingIdCounter = 0;
function _makeHeadingId(sectionIdx, headingIdx) {
    return `reader-h-${sectionIdx}-${headingIdx}`;
}

async function _renderChapterContentInternal(subjId, chapterIdx, subj, chapter, isStoryMode) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return;

    container.classList.toggle('story-mode', !!isStoryMode);

    // Show reader auxiliary UI
    const toolbar = document.getElementById('reader-toolbar');
    const toc = document.getElementById('reader-toc');
    const progressBar = document.getElementById('reader-progress-bar');
    const stickyHeading = document.getElementById('reader-sticky-heading');
    if (toolbar) toolbar.classList.remove('is-hidden');
    if (toc) toc.classList.remove('is-hidden');
    if (progressBar) progressBar.classList.remove('is-hidden');
    if (stickyHeading) stickyHeading.classList.add('is-hidden'); // hidden until scroll

    const bookmarks = getReaderBookmarks();

    // Build TOC (A: 계층 들여쓰기, B: 접기/펼치기, D: 브레드크럼, F: 하위 헤딩)
    const tocList = document.getElementById('reader-toc-list');
    if (tocList) {
        let tocHtml = '';
        let inChapter = false;

        // 헬퍼: 섹션 아이템 + 하위 헤딩 HTML 생성 (하위 헤딩은 기본 접힘)
        const buildSectionItem = (section, idx, minLevel, displayTitle) => {
            const title = displayTitle || section.title;
            const level = Math.max(minLevel, _getTocLevel(section.title));
            const subHeadings = _extractSubHeadings(section.content);
            const hasChildren = subHeadings.length > 0;
            let html = `<div class="reader-toc-item toc-level-${level}${hasChildren ? ' has-children' : ''}" data-section-idx="${idx}" data-toc-title="${esc(title)}">`;
            if (hasChildren) {
                html += `<i class="fa-solid fa-chevron-right toc-toggle-icon"></i>`;
            }
            html += `<span class="toc-text">${esc(title)}</span>`;
            html += `</div>`;
            if (hasChildren) {
                html += `<div class="reader-toc-children collapsed" data-parent-idx="${idx}">`;
                subHeadings.forEach((sh, hIdx) => {
                    const subLevel = sh.level === 3 ? 0 : 1;
                    html += `<div class="reader-toc-sub-item toc-sub-level-${subLevel}" data-section-idx="${idx}" data-heading-idx="${hIdx}" data-toc-title="${esc(sh.title)}">`;
                    html += `<span class="toc-sub-text">${esc(sh.title)}</span>`;
                    html += `</div>`;
                });
                html += `</div>`;
            }
            return html;
        };

        let hasSeenNumbered = false;
        chapter.sections.forEach((section, idx) => {
            // 참조문서 헤더 (01_화장품법 등) — NN_ 접두사 제거
            const displayTitle = _cleanRefTitle(section.title);

            const isChapterHeader = /Chapter\s+\d+/i.test(section.title);
            const level = _getTocLevel(section.title);
            const isNumberedChild = level >= 1; // 1., (1), ①

            if (isChapterHeader) {
                if (inChapter) tocHtml += `</div>`; // close previous chapter children
                // Chapter parent item
                tocHtml += `<div class="reader-toc-item toc-chapter" data-section-idx="${idx}" data-toc-title="${esc(section.title)}">`;
                tocHtml += `<i class="fa-solid fa-chevron-down toc-toggle-icon"></i>`;
                tocHtml += `<span class="toc-text">${esc(section.title)}</span>`;
                tocHtml += `</div>`;
                // Start chapter children container (기본 펼침)
                tocHtml += `<div class="reader-toc-children toc-chapter-children" data-parent-idx="${idx}">`;
                inChapter = true;
                hasSeenNumbered = false;
            } else if (inChapter) {
                if (isNumberedChild) {
                    // 번호 있는 섹션 → Chapter 자식
                    hasSeenNumbered = true;
                    tocHtml += buildSectionItem(section, idx, 1, displayTitle);
                } else if (hasSeenNumbered) {
                    // 번호 섹션 이후 비번호 섹션 → Chapter 종료, 최상위 레벨
                    tocHtml += `</div>`;
                    inChapter = false;
                    tocHtml += buildSectionItem(section, idx, 0, displayTitle);
                }
                // else: Chapter 헤더 직후 비번호 섹션 (intro) → TOC에서 생략
            } else {
                // Chapter 밖 — 최상위 레벨
                tocHtml += buildSectionItem(section, idx, 0, displayTitle);
            }
        });
        if (inChapter) tocHtml += `</div>`; // close last chapter children

        tocList.innerHTML = tocHtml;

        // Bind TOC item clicks — section scroll + toggle (B)
        tocList.querySelectorAll('.reader-toc-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const toggleIcon = e.target.closest('.toc-toggle-icon');
                const idx = parseInt(item.dataset.sectionIdx);
                if (toggleIcon) {
                    // 토글: 바로 다음 형제 children 컨테이너 찾기
                    let next = item.nextElementSibling;
                    while (next && !next.classList.contains('reader-toc-children')) {
                        next = next.nextElementSibling;
                    }
                    if (next && next.dataset.parentIdx == idx) {
                        const collapsed = next.classList.toggle('collapsed');
                        toggleIcon.classList.toggle('fa-chevron-down', !collapsed);
                        toggleIcon.classList.toggle('fa-chevron-right', collapsed);
                    }
                    return;
                }
                // 섹션으로 스크롤
                const target = document.getElementById(`reader-section-${idx}`);
                if (target) {
                    if (target.classList.contains('collapsed')) {
                        target.classList.remove('collapsed');
                    }
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Bind sub-item clicks — heading scroll (F)
        tocList.querySelectorAll('.reader-toc-sub-item').forEach(sub => {
            sub.addEventListener('click', () => {
                const secIdx = parseInt(sub.dataset.sectionIdx);
                const hIdx = parseInt(sub.dataset.headingIdx);
                const sectionEl = document.getElementById(`reader-section-${secIdx}`);
                if (!sectionEl) return;
                if (sectionEl.classList.contains('collapsed')) {
                    sectionEl.classList.remove('collapsed');
                }
                const headings = sectionEl.querySelectorAll('h3.md-h3, h4.md-h4');
                if (headings[hIdx]) {
                    headings[hIdx].scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // TOC 툴팁 (JavaScript 기반 — 컨테이너 overflow로 인한 잘림 방지)
        let tocTooltip = document.getElementById('toc-tooltip');
        if (!tocTooltip) {
            tocTooltip = document.createElement('div');
            tocTooltip.id = 'toc-tooltip';
            tocTooltip.setAttribute('role', 'tooltip');
            document.body.appendChild(tocTooltip);
        }
        const showTocTooltip = (el) => {
            const title = el.dataset.tocTitle;
            if (!title) return;
            tocTooltip.textContent = title;
            const rect = el.getBoundingClientRect();
            tocTooltip.style.left = (rect.right + 6) + 'px';
            tocTooltip.style.top = rect.top + 'px';
            // 화면 오른쪽을 넘어가면 왼쪽에 표시
            const tipRect = tocTooltip.getBoundingClientRect();
            if (tipRect.right > window.innerWidth - 8) {
                tocTooltip.style.left = (rect.left - tipRect.width - 6) + 'px';
            }
            tocTooltip.classList.add('is-visible');
        };
        const hideTocTooltip = () => {
            tocTooltip.classList.remove('is-visible');
        };
        tocList.querySelectorAll('.reader-toc-item, .reader-toc-sub-item').forEach(el => {
            el.addEventListener('mouseenter', () => showTocTooltip(el));
            el.addEventListener('mouseleave', hideTocTooltip);
            el.addEventListener('focus', () => showTocTooltip(el));
            el.addEventListener('blur', hideTocTooltip);
        });
    }

    // Estimate reading time (Korean ~500 chars/min)
    const totalChars = chapter.sections.reduce((acc, s) => acc + (s.content ? s.content.length : 0), 0);
    const readMinutes = Math.max(1, Math.round(totalChars / 500));

    const audioPath = getAudioPathForChapter(subjId, chapter);
    const hasAudio = !!audioPath;

    // 챕터 전체에서 출처 텍스트 추출 (컨텍스트 사이드바 + L-line PDF 링크용)
    let chapterSourceText = '';
    for (const s of chapter.sections) {
        const m = (s.content || '').match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n)/);
        if (m) { chapterSourceText = m[1]; break; }
    }
    const chapterRefPath = mapSourceToRef(chapterSourceText);

    // --- 용어집 항목 사전 계산 (glossary-renderer 모듈 위임) ---
    const glossaryItems = collectGlossaryItems(chapter.sections, chapterRefPath, mapSourceToRef, subjId);
    const hasGlossary = glossaryItems.length > 0;

    // TOC에 용어집 항목 추가
    if (hasGlossary && tocList) {
        appendGlossaryTocItem(tocList);
    }

    let html = `
        <div class="reader-readable-width">
        <div class="reader-chapter-header-card">
            <span class="badge badge-cyan">${esc(subj.name)}</span>
            ${isStoryMode ? '<span class="badge badge-story"><i class="fa-solid fa-book-open-reader"></i> 이야기형</span>' : ''}
            <h3>${esc(chapter.chapterTitle)}</h3>
            <div class="reader-chapter-meta">
                <span><i class="fa-solid fa-layer-group"></i> 섹션 ${chapter.sections.length}개</span>
                <span><i class="fa-regular fa-clock"></i> 예상 읽기 시간 약 ${readMinutes}분</span>
                ${isStoryMode ? '' : renderExamFilterToggle()}
                <a href="${esc(chapter.filePath)}" target="_blank" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 원본 MD
                </a>
                <details id="reader-ref-dropdown" class="reader-ref-dropdown" style="display: inline-block; position: relative;">
                    <summary class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem; cursor: pointer; list-style: none;">
                        <i class="fa-solid fa-book-bookmark"></i> 참조자료
                    </summary>
                    <div class="reader-ref-panel" style="position: absolute; top: 100%; left: 0; z-index: 100; margin-top: 0.4rem; min-width: 320px; max-height: 400px; overflow-y: auto; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); padding: 0.6rem;">
                        ${buildReferenceLinks(subjId, chapterRefPath)}
                    </div>
                </details>
                ${hasAudio ? `
                <button id="reader-audio-toggle-btn" class="btn btn-secondary" data-click="toggleReaderAudio" data-args='["${subjId}", ${chapterIdx}]' style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fa-solid fa-headphones"></i> 오디오 듣기
                </button>` : ''}
            </div>
            ${hasAudio ? `
            <div id="reader-audio-player-area" style="display: none; margin-top: 0.75rem; padding: 0.75rem 0.9rem; background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 8px; font-size: 0.85rem; color: var(--color-text-muted);">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.55rem;">
                    <i class="fa-solid fa-circle-play" style="color: var(--color-primary);"></i>
                    <span id="reader-audio-now-playing" style="color: var(--color-text-main); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                    <span id="reader-audio-status" style="margin-left: auto; font-size: 0.78rem; color: var(--warning); display: none;"></span>
                </div>
                <div id="reader-audio-controls" style="display: flex; align-items: center; gap: 0.6rem;">
                    <button id="reader-audio-playpause-btn" class="btn btn-secondary" data-click="toggleReaderPlayPause" title="재생" style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; padding: 0; border-radius: 50%; flex-shrink: 0;">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <span id="reader-audio-current" style="font-variant-numeric: tabular-nums; flex-shrink: 0;">0:00</span>
                    <input type="range" id="reader-audio-seek" min="0" max="100" value="0" step="0.1" disabled data-input="seekReaderAudio" style="flex: 1; accent-color: var(--color-primary); cursor: pointer; height: 4px;">
                    <span id="reader-audio-duration" style="font-variant-numeric: tabular-nums; flex-shrink: 0;">0:00</span>
                    <button id="reader-audio-rate-btn" class="btn btn-secondary" data-click="cycleReaderAudioRate" title="재생 속도" style="font-size: 0.78rem; padding: 0.25rem 0.5rem; flex-shrink: 0; min-width: 3rem;">1x</button>
                    <button id="reader-audio-scroll-btn" class="btn btn-secondary" data-click="toggleReaderAutoScroll" title="오디오 위치에 맞춰 자동으로 스크롤" style="font-size: 0.78rem; padding: 0.25rem 0.5rem; flex-shrink: 0; white-space: nowrap;">
                        <i class="fa-solid fa-arrows-up-down"></i> 스크롤 따라가기
                    </button>
                </div>
            </div>` : ''}
        </div>
    `;

    try {
        html += await renderStudyAids(chapter, subjId);
    } catch (err) {
        console.warn('[Reader] 학습 보조 렌더링 실패:', err);
    }

    // D: 브레드크럼
    html += `<div class="reader-breadcrumb" id="reader-breadcrumb">
        <span class="breadcrumb-subject">${esc(subj.name)}</span>
        <i class="fa-solid fa-chevron-right breadcrumb-sep"></i>
        <span class="breadcrumb-chapter">${esc(chapter.chapterTitle)}</span>
        <i class="fa-solid fa-chevron-right breadcrumb-sep"></i>
        <span class="breadcrumb-section" id="breadcrumb-current-section">-</span>
    </div>`;

    const subjRefFiles = REFERENCE_FILES[subjId] || [];
    const subjDirName = SUBJECT_DIR_MAP[subjId] || '';

    chapter.sections.forEach((section, idx) => {
        const bookmarkKey = `${subjId}_${chapterIdx}_${idx}`;
        const isBookmarked = bookmarks.includes(bookmarkKey);
        const allContent = [section.content || '', ...((section.subsections || []).map(s => s.content || ''))].join('\n');
        const secSrcMatch = allContent.match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n)/);
        const secRefPath = secSrcMatch ? mapSourceToRef(secSrcMatch[1]) : null;
        const refPath = secRefPath || chapterRefPath;
        let sectionHtml = formatSectionContentForReader(section.content, chapter.filePath, refPath, subjRefFiles, subjDirName, glossaryItems, section.title);
        if (section.subsections && section.subsections.length > 0) {
            for (const sub of section.subsections) {
                sectionHtml += `<h5 class="reader-subsection-title">${esc(sub.title)}</h5>`;
                sectionHtml += `<div class="reader-subsection-content">${formatSectionContentForReader(sub.content, chapter.filePath, refPath, subjRefFiles, subjDirName, glossaryItems, sub.title)}</div>`;
            }
        }
        html += `
            <div class="reader-section-card" id="reader-section-${idx}" data-section-idx="${idx}">
                <div class="reader-section-header" data-section-idx="${idx}">
                    <i class="fa-solid fa-chevron-down reader-section-toggle"></i>
                    ${_hasOwnNumber(section.title) ? `<span class="reader-section-num">${idx + 1}</span>` : ''}
                    <h4 class="reader-section-title">${esc(section.title)}</h4>
                    <button class="reader-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-bookmark-key="${esc(bookmarkKey)}" title="북마크 ${isBookmarked ? '제거' : '추가'}">
                        <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark"></i>
                    </button>
                </div>
                <div class="reader-section-body">
                    <div class="textbook-reader-section-content">
                        ${sectionHtml}
                    </div>
                </div>
            </div>
        `;
    });

    // --- 과목별 용어집 테이블 (glossary-renderer 모듈 위임) ---
    if (hasGlossary) {
        html += renderGlossaryTable(glossaryItems);
    }

    // Prev / Next chapter navigation
    const prevChapter = chapterIdx > 0 ? subj.chapters[chapterIdx - 1] : null;
    const nextChapter = chapterIdx < subj.chapters.length - 1 ? subj.chapters[chapterIdx + 1] : null;
    html += `
        <div class="reader-chapter-end-marker" role="separator" aria-label="단원 끝">— 단원 끝 —</div>
        <div class="reader-chapter-nav">
            <button class="reader-nav-btn prev" ${prevChapter ? '' : 'disabled'} data-nav-idx="${chapterIdx - 1}">
                <span class="nav-dir"><i class="fa-solid fa-arrow-left"></i> 이전 단원</span>
                <span class="nav-title">${prevChapter ? esc(prevChapter.chapterTitle) : '이전 단원 없음'}</span>
            </button>
            <button class="reader-nav-btn next" ${nextChapter ? '' : 'disabled'} data-nav-idx="${chapterIdx + 1}">
                <span class="nav-dir">다음 단원 <i class="fa-solid fa-arrow-right"></i></span>
                <span class="nav-title">${nextChapter ? esc(nextChapter.chapterTitle) : '다음 단원 없음'}</span>
            </button>
        </div>
        </div><!-- /reader-readable-width -->
    `;

    container.innerHTML = html;

    // Study aid toggles (기출 핵심, 숫자 암기표)
    bindStudyAidToggles(container);

    // Exam filter button — 기출/중요 마커가 있는 섹션만 강조
    const examFilterBtn = container.querySelector('#exam-filter-btn');
    if (examFilterBtn) {
        let filterActive = false;
        examFilterBtn.addEventListener('click', () => {
            filterActive = !filterActive;
            examFilterBtn.classList.toggle('active', filterActive);
            const btnText = examFilterBtn.querySelector('span');
            if (btnText) btnText.textContent = filterActive ? '기출만 보기 ON' : '기출만 보기';
            applyExamFilter(container, chapter, filterActive);
        });
    }

    // Section collapse toggles
    container.querySelectorAll('.reader-section-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.reader-bookmark-btn')) return;
            const card = header.closest('.reader-section-card');
            if (card) card.classList.toggle('collapsed');
        });
    });

    // 본문 목차 하이퍼링크 → 대응 섹션으로 스크롤
    container.querySelectorAll('a[data-toc-jump]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const jumpText = (link.dataset.tocJump || '').trim();
            if (!jumpText) return;
            // 이모지 제거한 정규화 텍스트 (매칭용)
            const normalize = (s) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '').replace(/\s+/g, ' ').trim();
            const jumpNorm = normalize(jumpText);
            // 목차 항목 텍스트가 포함된 섹션 찾기
            const sectionCards = container.querySelectorAll('.reader-section-card');
            let found = null;
            // 1순위: 정확 매칭 (이모지 포함)
            sectionCards.forEach(card => {
                const titleEl = card.querySelector('.reader-section-title');
                if (!titleEl) return;
                const title = titleEl.textContent.trim();
                if (title.includes(jumpText) || jumpText.includes(title)) {
                    found = card;
                }
            });
            // 2순위: 이모지 무시 매칭
            if (!found && jumpNorm) {
                sectionCards.forEach(card => {
                    const titleEl = card.querySelector('.reader-section-title');
                    if (!titleEl) return;
                    const titleNorm = normalize(titleEl.textContent.trim());
                    if (titleNorm && (titleNorm.includes(jumpNorm) || jumpNorm.includes(titleNorm))) {
                        found = card;
                    }
                });
            }
            // 3순위: Chapter NN 매칭 (목차 "Chapter 01." → 섹션 "📚 Chapter 01. xxx")
            if (!found && /Chapter\s+\d+/i.test(jumpText)) {
                const chMatch = jumpText.match(/Chapter\s+(\d+)/i);
                if (chMatch) {
                    const chNum = chMatch[1];
                    sectionCards.forEach(card => {
                        const titleEl = card.querySelector('.reader-section-title');
                        if (!titleEl) return;
                        const title = titleEl.textContent.trim();
                        if (new RegExp('Chapter\\s+' + chNum + '\\b', 'i').test(title)) {
                            found = card;
                        }
                    });
                }
            }
            // 4순위: 키워드 기반 매칭 (핵심 명사 추출)
            if (!found && jumpNorm) {
                // 핵심 키워드 추출 (2자 이상 한글/영어 단어)
                const keywords = jumpNorm.match(/[\uac00-\ud7a3]{2,}|[A-Za-z]{2,}/g) || [];
                if (keywords.length > 0) {
                    let bestMatch = null;
                    let bestScore = 0;
                    sectionCards.forEach(card => {
                        const titleEl = card.querySelector('.reader-section-title');
                        if (!titleEl) return;
                        const titleNorm = normalize(titleEl.textContent.trim());
                        if (!titleNorm) return;
                        let score = 0;
                        keywords.forEach(kw => {
                            if (titleNorm.includes(kw)) score += kw.length;
                        });
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = card;
                        }
                    });
                    // 키워드의 50% 이상 매칭 시 채택
                    if (bestMatch && bestScore >= keywords.join('').length * 0.5) {
                        found = bestMatch;
                    }
                }
            }
            if (found) {
                if (found.classList.contains('collapsed')) {
                    found.classList.remove('collapsed');
                }
                found.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Bookmark buttons
    container.querySelectorAll('.reader-bookmark-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReaderBookmark(btn.dataset.bookmarkKey, btn);
        });
    });

    // Prev/Next nav buttons
    container.querySelectorAll('.reader-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const navIdx = parseInt(btn.dataset.navIdx);
            textbookReaderState.selectedChapter = String(navIdx);
            saveReaderPosition(); // 1. 교재 읽기 이어하기
            renderChapterContent(subjId, navIdx);
            container.scrollTop = 0;
        });
    });

    // Table expand buttons
    container.querySelectorAll('.reader-table-wrapper').forEach(wrapper => {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'reader-table-expand-btn';
        expandBtn.title = '표 전체 화면으로 보기';
        expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        expandBtn.addEventListener('click', () => openTableModal(wrapper));
        wrapper.appendChild(expandBtn);
    });

    // Scroll position reset + scroll spy binding
    container.scrollTop = 0;
    bindReaderScrollEvents();
    applyReaderFontScale();
    applyReaderLineHeight();
    applyReaderThemeClass();

    // Mermaid 다이어그램 렌더링 (pre.mermaid 노드가 있을 때만 온디맨드 로드)
    _renderReaderMermaid(container);

    // 참조자료 링크 이벤트 바인딩
    bindReferenceLinks();
}

// --- Mermaid 온디맨드 로드 (manual-viewer.js 패턴과 동일) ---
let _mermaidLoadPromise = null;
function _ensureMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (_mermaidLoadPromise) return _mermaidLoadPromise;
    _mermaidLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PATHS.VENDOR_MERMAID;
        script.async = true;
        const nonce = crypto.getRandomValues(new Uint8Array(16));
        script.nonce = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
        script.onload = () => {
            if (window.mermaid) resolve(window.mermaid);
            else reject(new Error('mermaid loaded but window.mermaid is undefined'));
        };
        script.onerror = (e) => { _mermaidLoadPromise = null; reject(e); };
        document.head.appendChild(script);
    });
    return _mermaidLoadPromise;
}

function _renderReaderMermaid(container) {
    const nodes = container ? container.querySelectorAll('pre.mermaid') : [];
    if (nodes.length === 0) return;
    _ensureMermaid()
        .then((mermaid) => {
            try {
                const isLight = document.documentElement.classList.contains('light-theme');
                const nodeArr = Array.from(nodes);
                // 각 노드의 diagram 타입 감지하여 클래스 추가
                const nodeTypes = [];
                nodeArr.forEach(node => {
                    const type = detectMermaidType(node.textContent);
                    nodeTypes.push(type);
                    node.classList.add(getMermaidClassName(type));
                });
                let rendered = 0;
                let failed = 0;
                const renderNext = (i) => {
                    if (i >= nodeArr.length) {
                        if (failed > 0) console.warn(`[reader] mermaid: ${rendered} rendered, ${failed} failed`);
                        return;
                    }
                    const node = nodeArr[i];
                    const type = nodeTypes[i];
                    mermaid.initialize(getMermaidInitOptions(type, isLight));
                    mermaid.run({ nodes: [node] })
                        .then(() => { rendered++; renderNext(i + 1); })
                        .catch((e) => {
                            failed++;
                            console.warn(`[reader] mermaid node ${i} failed:`, e?.message || e);
                            node.innerHTML = '<span style="color:var(--color-text-muted);font-size:0.8rem;">[다이어그램 렌더링 실패]</span>';
                            renderNext(i + 1);
                        });
                };
                renderNext(0);
            } catch (e) {
                console.warn('[reader] mermaid render failed:', e);
            }
        })
        .catch((e) => console.warn('[reader] mermaid load failed:', e));
}

// --- Reader convenience feature state & logic ---
let readerChapterContext = { subjId: '', chapterIdx: 0 };
let readerFontScale = (() => { try { return parseFloat(localStorage.getItem(STORAGE_KEYS.READER_FONT_SCALE)) || 1; } catch (e) { return 1; } })();
let readerLineHeight = (() => { try { return parseFloat(localStorage.getItem(STORAGE_KEYS.READER_LINE_HEIGHT)) || 2.05; } catch (e) { return 2.05; } })();
let readerScrollBound = false;

function getReaderBookmarks() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.READER_BOOKMARKS)) || [];
    } catch { return []; }
}

function toggleReaderBookmark(key, btn) {
    let bookmarks = getReaderBookmarks();
    const idx = bookmarks.indexOf(key);
    if (idx >= 0) {
        bookmarks.splice(idx, 1);
        btn.classList.remove('bookmarked');
        btn.querySelector('i').className = 'fa-regular fa-bookmark';
        btn.title = '북마크 추가';
    } else {
        bookmarks.push(key);
        btn.classList.add('bookmarked');
        btn.querySelector('i').className = 'fa-solid fa-bookmark';
        btn.title = '북마크 제거';
    }
    try { localStorage.setItem(STORAGE_KEYS.READER_BOOKMARKS, JSON.stringify(bookmarks)); } catch (e) { /* noop */ }
}

function applyReaderFontScale() {
    const container = document.getElementById('textbook-reader-container');
    const display = document.getElementById('reader-font-size-display');
    if (container) container.style.setProperty('--reader-font-scale', readerFontScale);
    if (display) display.textContent = Math.round(readerFontScale * 100) + '%';
    try { localStorage.setItem(STORAGE_KEYS.READER_FONT_SCALE, readerFontScale); } catch (e) { /* noop */ }
}

function applyReaderLineHeight() {
    const container = document.getElementById('textbook-reader-container');
    const display = document.getElementById('reader-line-height-display');
    if (container) container.style.setProperty('--reader-line-height', readerLineHeight);
    if (display) display.textContent = readerLineHeight.toFixed(2);
    try { localStorage.setItem(STORAGE_KEYS.READER_LINE_HEIGHT, readerLineHeight); } catch (e) { /* noop */ }
}

function applyReaderThemeClass() {
    // 리더 테마는 전역 테마(window.AppTheme / <html>.light-theme)를 그대로 따름
    const view = document.getElementById('textbook-reader-view');
    const isLight = window.AppTheme
        ? window.AppTheme.isLight()
        : document.documentElement.classList.contains('light-theme');
    if (view) view.classList.toggle('reader-light-theme', isLight);
}

function bindReaderScrollEvents() {
    const container = document.getElementById('textbook-reader-container');
    if (!container || readerScrollBound) return;
    readerScrollBound = true;

    // rAF 디바운스: 매 스크롤 프레임마다 querySelectorAll 호출을 방지
    // 연속 스크롤 중에는 1회만 처리하고, 다음 프레임에서 갱신
    let scrollRafId = null;
    let cachedCards = null; // 카드 목록 캐싱 (단원 전환 시 초기화됨)

    const handleScroll = () => {
        if (scrollRafId !== null) return;
        scrollRafId = requestAnimationFrame(() => {
            scrollRafId = null;
            // 카드 목록 캐싱: 단원 전환 시 초기화되므로 여기서 지연 캐싱
            if (!cachedCards || !cachedCards.length || !cachedCards[0].isConnected) {
                cachedCards = container.querySelectorAll('.reader-section-card');
            }
            // Progress bar
            const progressFill = document.getElementById('reader-progress-fill');
            if (progressFill) {
                const max = container.scrollHeight - container.clientHeight;
                const pct = max > 0 ? (container.scrollTop / max) * 100 : 0;
                progressFill.style.width = pct + '%';
            }
            // Back to top visibility
            const backBtn = document.getElementById('reader-back-to-top');
            if (backBtn) backBtn.classList.toggle('is-hidden', container.scrollTop <= 400);

            // 1. 교재 읽기 이어하기 — 스크롤 위치 저장 (디바운스)
            scheduleSaveReaderPosition();

            // Scroll spy — highlight current section in TOC + breadcrumb (D)
            const containerTop = container.getBoundingClientRect().top;
            let currentIdx = -1;
            cachedCards.forEach(card => {
                const rect = card.getBoundingClientRect();
                if (rect.top - containerTop < 120) {
                    currentIdx = parseInt(card.dataset.sectionIdx);
                }
                card.classList.toggle('current-section', parseInt(card.dataset.sectionIdx) === currentIdx);
            });
            document.querySelectorAll('.reader-toc-item').forEach(item => {
                item.classList.toggle('active', parseInt(item.dataset.sectionIdx) === currentIdx);
            });
            // D: 브레드크럼 현재 섹션 업데이트
            const breadcrumbEl = document.getElementById('breadcrumb-current-section');
            if (breadcrumbEl && currentIdx >= 0) {
                const card = container.querySelector(`.reader-section-card[data-section-idx="${currentIdx}"] .reader-section-title`);
                if (card) breadcrumbEl.textContent = card.textContent.trim();
            }
            // Section progress (e.g. "3/5 섹션")
            const sectionProgress = document.getElementById('reader-section-progress');
            if (sectionProgress && cachedCards.length) {
                const totalSections = cachedCards.length;
                const currentSection = currentIdx >= 0 ? currentIdx + 1 : 0;
                sectionProgress.textContent = `${currentSection}/${totalSections} 섹션`;
            }
            // Sticky heading: show current section title when scrolled past its header
            const stickyHeading = document.getElementById('reader-sticky-heading');
            const stickyText = document.getElementById('reader-sticky-heading-text');
            if (stickyHeading && stickyText) {
                if (currentIdx >= 0) {
                    const currentCard = container.querySelector(`.reader-section-card[data-section-idx="${currentIdx}"]`);
                    if (currentCard) {
                        const headerEl = currentCard.querySelector('.reader-section-header');
                        const titleEl = currentCard.querySelector('.reader-section-title');
                        if (headerEl && titleEl) {
                            const headerRect = headerEl.getBoundingClientRect();
                            const containerTop2 = container.getBoundingClientRect().top;
                            // Show sticky heading when the section header is scrolled above the container top
                            const showSticky = (headerRect.top - containerTop2) < 0 && container.scrollTop > 100;
                            stickyHeading.classList.toggle('is-hidden', !showSticky);
                            if (showSticky) stickyText.textContent = titleEl.textContent.trim();
                        }
                    }
                } else {
                    stickyHeading.classList.add('is-hidden');
                }
            }
        });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Back to top click
    const backBtn = document.getElementById('reader-back-to-top');
    if (backBtn && !backBtn.dataset.bound) {
        backBtn.dataset.bound = 'true';
        backBtn.addEventListener('click', () => {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function initReaderToolbar() {
    const decBtn = document.getElementById('reader-font-decrease');
    const incBtn = document.getElementById('reader-font-increase');
    const resetBtn = document.getElementById('reader-font-reset');
    const lhDecBtn = document.getElementById('reader-line-height-decrease');
    const lhIncBtn = document.getElementById('reader-line-height-increase');
    const lhResetBtn = document.getElementById('reader-line-height-reset');
    const focusBtn = document.getElementById('reader-focus-toggle');
    const expandAllBtn = document.getElementById('reader-expand-all');
    const collapseAllBtn = document.getElementById('reader-collapse-all');
    const modalClose = document.getElementById('reader-table-modal-close');
    const modal = document.getElementById('reader-table-modal');
    const tocMobileBtn = document.getElementById('reader-toc-mobile-btn');
    const tocBackdrop = document.getElementById('reader-toc-backdrop');
    const tocAside = document.getElementById('reader-toc');

    if (decBtn && !decBtn.dataset.bound) {
        decBtn.dataset.bound = 'true';
        decBtn.addEventListener('click', () => {
            readerFontScale = Math.max(0.85, +(readerFontScale - 0.05).toFixed(2));
            applyReaderFontScale();
        });
    }
    if (incBtn && !incBtn.dataset.bound) {
        incBtn.dataset.bound = 'true';
        incBtn.addEventListener('click', () => {
            readerFontScale = Math.min(1.4, +(readerFontScale + 0.05).toFixed(2));
            applyReaderFontScale();
        });
    }
    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', () => {
            readerFontScale = 1;
            applyReaderFontScale();
        });
    }
    if (lhDecBtn && !lhDecBtn.dataset.bound) {
        lhDecBtn.dataset.bound = 'true';
        lhDecBtn.addEventListener('click', () => {
            readerLineHeight = Math.max(1.4, +(readerLineHeight - 0.1).toFixed(2));
            applyReaderLineHeight();
        });
    }
    if (lhIncBtn && !lhIncBtn.dataset.bound) {
        lhIncBtn.dataset.bound = 'true';
        lhIncBtn.addEventListener('click', () => {
            readerLineHeight = Math.min(2.6, +(readerLineHeight + 0.1).toFixed(2));
            applyReaderLineHeight();
        });
    }
    if (lhResetBtn && !lhResetBtn.dataset.bound) {
        lhResetBtn.dataset.bound = 'true';
        lhResetBtn.addEventListener('click', () => {
            readerLineHeight = 2.05;
            applyReaderLineHeight();
        });
    }
    // 헤더 등 다른 곳에서 테마가 바뀌면 리더도 즉시 동기화
    if (!document.body.dataset.readerThemeSync) {
        document.body.dataset.readerThemeSync = 'true';
        document.addEventListener('themechange', applyReaderThemeClass);
    }
    if (focusBtn && !focusBtn.dataset.bound) {
        focusBtn.dataset.bound = 'true';
        focusBtn.addEventListener('click', () => {
            const focused = document.body.classList.toggle('reader-focus-mode');
            focusBtn.classList.toggle('active', focused);
            focusBtn.innerHTML = focused
                ? '<i class="fa-solid fa-compress"></i> <span>집중 해제</span>'
                : '<i class="fa-solid fa-expand"></i> <span>집중 모드</span>';
        });
    }
    // P2-7: 본문 내 검색 하이라이트
    const searchInput = document.getElementById('reader-in-content-search');
    const searchCount = document.getElementById('reader-search-count');
    const searchPrev = document.getElementById('reader-search-prev');
    const searchNext = document.getElementById('reader-search-next');
    const searchClear = document.getElementById('reader-search-clear');
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        let searchDebounce = null;
        let currentMatchIdx = 0;
        const scrollToMatch = (idx) => {
            const container = document.getElementById('textbook-reader-view');
            if (!container) return;
            const marks = container.querySelectorAll('.reader-search-highlight');
            if (!marks.length) return;
            currentMatchIdx = ((idx % marks.length) + marks.length) % marks.length;
            marks.forEach((m, i) => m.classList.toggle('current-match', i === currentMatchIdx));
            const target = marks[currentMatchIdx];
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (searchCount) searchCount.textContent = `${currentMatchIdx + 1}/${marks.length}`;
        };
        const performSearch = () => {
            const container = document.getElementById('textbook-reader-view');
            if (!container) return;
            const query = searchInput.value.trim();
            // Clear previous highlights
            container.querySelectorAll('.reader-search-highlight').forEach(el => {
                const parent = el.parentNode;
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            });
            if (!query || query.length < 2) {
                if (searchCount) searchCount.textContent = '';
                return;
            }
            // Expand all sections for search
            container.querySelectorAll('.reader-section-card.collapsed').forEach(c => c.classList.remove('collapsed'));
            // Highlight matches in text nodes
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                    const parent = node.parentNode;
                    if (parent.classList.contains('reader-search-highlight')) return NodeFilter.FILTER_REJECT;
                    if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA'].includes(parent.nodeName)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) textNodes.push(node);
            const lowerQuery = query.toLowerCase();
            let matchCount = 0;
            textNodes.forEach(textNode => {
                const text = textNode.textContent;
                const lowerText = text.toLowerCase();
                let idx = lowerText.indexOf(lowerQuery);
                if (idx === -1) return;
                const frag = document.createDocumentFragment();
                let lastIdx = 0;
                while (idx !== -1) {
                    if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
                    const mark = document.createElement('span');
                    mark.className = 'reader-search-highlight';
                    mark.textContent = text.slice(idx, idx + query.length);
                    frag.appendChild(mark);
                    matchCount++;
                    lastIdx = idx + query.length;
                    idx = lowerText.indexOf(lowerQuery, lastIdx);
                }
                if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
                textNode.parentNode.replaceChild(frag, textNode);
            });
            currentMatchIdx = 0;
            if (searchCount) searchCount.textContent = matchCount > 0 ? `1/${matchCount}` : '결과 없음';
            if (matchCount > 0) scrollToMatch(0);
        };
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(performSearch, 300);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); performSearch(); }
            if (e.key === 'Escape') { searchInput.value = ''; performSearch(); searchInput.blur(); }
        });
        if (searchPrev && !searchPrev.dataset.bound) {
            searchPrev.dataset.bound = 'true';
            searchPrev.addEventListener('click', () => {
                const container = document.getElementById('textbook-reader-view');
                const marks = container ? container.querySelectorAll('.reader-search-highlight') : [];
                if (marks.length) scrollToMatch(currentMatchIdx - 1);
            });
        }
        if (searchNext && !searchNext.dataset.bound) {
            searchNext.dataset.bound = 'true';
            searchNext.addEventListener('click', () => {
                const container = document.getElementById('textbook-reader-view');
                const marks = container ? container.querySelectorAll('.reader-search-highlight') : [];
                if (marks.length) scrollToMatch(currentMatchIdx + 1);
            });
        }
        if (searchClear && !searchClear.dataset.bound) {
            searchClear.dataset.bound = 'true';
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                performSearch();
                searchInput.focus();
            });
        }
    }
    // C: 모바일 TOC 드로어 토글
    if (tocMobileBtn && !tocMobileBtn.dataset.bound) {
        tocMobileBtn.dataset.bound = 'true';
        const closeMobileToc = () => {
            if (tocAside) tocAside.classList.remove('mobile-open');
            if (tocBackdrop) tocBackdrop.classList.add('is-hidden');
        };
        tocMobileBtn.addEventListener('click', () => {
            if (tocAside && tocBackdrop) {
                const isOpen = tocAside.classList.toggle('mobile-open');
                tocBackdrop.classList.toggle('is-hidden', !isOpen);
            }
        });
        if (tocBackdrop) tocBackdrop.addEventListener('click', closeMobileToc);
        // TOC 항목 클릭 시 즉시 드로어 닫기 (스크롤 애니메이션과 겹침 방지)
        if (tocAside) {
            tocAside.addEventListener('click', (e) => {
                if (e.target.closest('.reader-toc-item') || e.target.closest('.reader-toc-sub-item')) {
                    closeMobileToc();
                }
            });
        }
    }
    if (expandAllBtn && !expandAllBtn.dataset.bound) {
        expandAllBtn.dataset.bound = 'true';
        expandAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#textbook-reader-container .reader-section-card.collapsed')
                .forEach(c => c.classList.remove('collapsed'));
        });
    }
    if (collapseAllBtn && !collapseAllBtn.dataset.bound) {
        collapseAllBtn.dataset.bound = 'true';
        collapseAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#textbook-reader-container .reader-section-card')
                .forEach(c => c.classList.add('collapsed'));
        });
    }
    if (modalClose && !modalClose.dataset.bound) {
        modalClose.dataset.bound = 'true';
        modalClose.addEventListener('click', closeTableModal);
    }
    if (modal && !modal.dataset.bound) {
        modal.dataset.bound = 'true';
        modal.querySelector('.reader-table-modal-backdrop').addEventListener('click', closeTableModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('is-hidden')) closeTableModal();
        });
    }
}

function openTableModal(wrapper) {
    const modal = document.getElementById('reader-table-modal');
    const body = document.getElementById('reader-table-modal-body');
    if (!modal || !body) return;
    const table = wrapper.querySelector('table');
    if (!table) return;
    body.innerHTML = '';
    body.appendChild(table.cloneNode(true));
    modal.classList.remove('is-hidden');
    // 포커스 트랩 적용
    if (modal._untrapFocus) modal._untrapFocus();
    modal._untrapFocus = trapFocus(modal, wrapper);
}

function closeTableModal() {
    const modal = document.getElementById('reader-table-modal');
    if (modal) {
        modal.classList.add('is-hidden');
        if (modal._untrapFocus) {
            modal._untrapFocus();
            modal._untrapFocus = null;
        }
    }
}

// --- 참조자료 링크 기능 ---

function buildReferenceLinks(subjId, contextRefPath) {
    const dirName = SUBJECT_DIR_MAP[subjId];
    if (!dirName) return '';
    const subjectFiles = REFERENCE_FILES[subjId] || [];
    
    let links = '';

    // 컨텍스트 추천: 현재 단원의 출처와 관련된 참조자료를 상단에 표시
    if (contextRefPath) {
        const contextName = contextRefPath.split('/').pop().replace(/\.(html|md)$/, '');
        const allRefs = [
            ...subjectFiles.map(f => ({ ...f, path: f.type === 'md' ? PATHS.REFERENCE_FILE(dirName, f.file) : resolveRefPath(f.file) })),
            ...REFERENCE_COMMON.map(f => ({ ...f, path: resolveRefPath(f.file) })),
            ...REFERENCE_LAW.map(f => ({ ...f, path: resolveRefPath(f.file) })),
            ...REFERENCE_INGREDIENTS.map(f => ({ ...f, path: f.type === 'md' ? PATHS.REFERENCE_FILE(f.dir, f.file) : resolveRefPath(f.file) }))
        ];
        const matched = allRefs.filter(r => r.path === contextRefPath);
        const related = allRefs.filter(r => r.path !== contextRefPath && r.type !== 'md' && contextRefPath.endsWith(r.path?.split('/').pop() || ''));
        const contextRefs = [...matched, ...related].slice(0, 5);
        if (contextRefs.length > 0) {
            links += `<div class="ref-group-label" style="color: var(--color-primary, #1f6feb);"><i class="fa-solid fa-bookmark"></i> 이 단원의 참조자료 (${contextRefs.length})</div>`;
            contextRefs.forEach(f => {
                const icon = 'fa-file-lines';
                if (f.type === 'md') {
                    links += `<a class="ref-link-item" data-ref-md="${esc(f.path)}" style="background:rgba(31,111,235,0.08);"><i class="fa-solid ${icon}"></i> ${esc(f.name)}</a>`;
                } else {
                    links += `<a href="#" data-ref-html="${esc(f.path)}" class="ref-link-item" style="background:rgba(31,111,235,0.08);"><i class="fa-solid ${icon}"></i> ${esc(f.name)}</a>`;
                }
            });
            links += `<div style="border-top:1px solid var(--border-color,#30363d);margin:0.4rem 0;"></div>`;
        }
    }
    
    // 과목별 참조자료
    if (subjectFiles.length > 0) {
        links += `<div class="ref-group-label">과목별 참조자료</div>`;
        subjectFiles.forEach(f => {
            const icon = 'fa-file-lines';
            if (f.type === 'md') {
                const path = PATHS.REFERENCE_FILE(dirName, f.file);
                links += `<a class="ref-link-item" data-ref-md="${esc(path)}"><i class="fa-solid ${icon}"></i> ${esc(f.name)}</a>`;
            } else {
                const path = resolveRefPath(f.file);
                links += `<a href="#" data-ref-html="${esc(path)}" class="ref-link-item"><i class="fa-solid ${icon}"></i> ${esc(f.name)}</a>`;
            }
        });
    }
    
    // 원료 참조자료
    links += `<div class="ref-group-label">원료 참조자료</div>`;
    REFERENCE_INGREDIENTS.forEach(f => {
        if (f.type === 'md') {
            const path = PATHS.REFERENCE_FILE(f.dir, f.file);
            links += `<a class="ref-link-item" data-ref-md="${esc(path)}"><i class="fa-solid fa-file-lines"></i> ${esc(f.name)}</a>`;
        } else {
            const path = resolveRefPath(f.file);
            links += `<a href="#" data-ref-html="${esc(path)}" class="ref-link-item"><i class="fa-solid fa-file-lines"></i> ${esc(f.name)}</a>`;
        }
    });
    
    // 법령원문
    links += `<div class="ref-group-label">법령원문</div>`;
    REFERENCE_LAW.forEach(f => {
        const path = resolveRefPath(f.file);
        links += `<a href="#" data-ref-html="${esc(path)}" class="ref-link-item"><i class="fa-solid fa-file-lines"></i> ${esc(f.name)}</a>`;
    });
    
    // 공통 참조자료
    links += `<div class="ref-group-label">공통 참조자료</div>`;
    REFERENCE_COMMON.forEach(f => {
        const path = resolveRefPath(f.file);
        links += `<a href="#" data-ref-html="${esc(path)}" class="ref-link-item"><i class="fa-solid fa-file-lines"></i> ${esc(f.name)}</a>`;
    });
    
    return links;
}

// --- 참조자료 인라인 프리뷰 (툴팁) ---
const _previewCache = {};
let _previewEl = null;
let _previewTimer = null;
let _previewTouchTimer = null;

function _ensurePreviewEl() {
    if (_previewEl) return _previewEl;
    _previewEl = document.createElement('div');
    _previewEl.id = 'ref-preview-tooltip';
    _previewEl.setAttribute('role', 'tooltip');
    _previewEl.classList.add('is-hidden');
    document.body.appendChild(_previewEl);
    return _previewEl;
}

async function _showPreview(linkEl) {
    const path = linkEl.dataset.refHtml;
    const search = linkEl.dataset.refSearch || '';
    if (!path) return;

    const el = _ensurePreviewEl();
    el.innerHTML = '<div style="opacity:0.6;">로딩 중...</div>';
    el.classList.remove('is-hidden');

    try {
        if (!_previewCache[path]) {
            const fileUrl = new URL(path, window.location.href).href;
            const resp = await fetch(fileUrl);
            const rawText = await resp.text();
            const isMd = path.endsWith('.md');
            let text;
            if (isMd) {
                text = rawText.replace(/^#{1,6}\s.*$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\|/g, ' ').trim();
            } else {
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawText, 'text/html');
                text = doc.body.textContent.replace(/\s+/g, ' ').trim();
            }
            _previewCache[path] = text;
        }

        const fullText = _previewCache[path];
        let snippet;
        if (search && search.length >= 2) {
            const idx = fullText.toLowerCase().indexOf(search.toLowerCase());
            if (idx >= 0) {
                const start = Math.max(0, idx - 60);
                snippet = (start > 0 ? '...' : '') + fullText.slice(start, idx + search.length + 120) + '...';
            } else {
                snippet = fullText.slice(0, 200) + '...';
            }
        } else {
            snippet = fullText.slice(0, 200) + '...';
        }

        const fileName = decodeURIComponent(path.split('/').pop().replace(/\.(html|md)$/, ''));
        el.innerHTML = `<div style="font-weight:600;margin-bottom:4px;color:var(--color-primary,#1f6feb);"><i class="fa-solid fa-file-lines"></i> ${esc(fileName)}</div><div style="white-space:pre-wrap;word-break:break-word;">${esc(snippet)}</div>`;
    } catch (err) {
        el.innerHTML = '<div style="opacity:0.6;">미리보기를 불러올 수 없습니다.</div>';
    }

    // Position tooltip near the link
    const rect = linkEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;
    if (top + elRect.height > window.innerHeight - 10) {
        top = Math.max(10, rect.top - elRect.height - 6);
    }
    if (left + elRect.width > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - elRect.width - 10);
    }
    el.style.top = top + 'px';
    el.style.left = left + 'px';
}

function _hidePreview() {
    if (_previewEl) _previewEl.classList.add('is-hidden');
}

let _refLinksDelegationInitialized = false;
function _initRefLinkDelegation() {
    if (_refLinksDelegationInitialized) return;
    _refLinksDelegationInitialized = true;
    // click 이벤트 위임: document에서 단일 리스너로 처리
    document.addEventListener('click', (e) => {
        const a = e.target.closest('[data-exam-md], [data-ref-md], [data-ref-html], [data-ref-subject], [data-glossary]');
        if (!a) return;
        if (a.hasAttribute('data-exam-md')) {
            e.preventDefault();
            const mdPath = a.dataset.examMd;
            if (mdPath && window.ExamViewer && window.ExamViewer.openExam) {
                window.ExamViewer.openExam(mdPath);
            }
            return;
        }
        if (a.hasAttribute('data-ref-md')) {
            e.preventDefault();
            const mdPath = a.dataset.refMd;
            const lineNum = a.dataset.refLine ? parseInt(a.dataset.refLine) : null;
            if (window.ExamViewer && window.ExamViewer.openExam) {
                window.ExamViewer.openExam(mdPath, lineNum);
            }
            return;
        }
        if (a.hasAttribute('data-ref-html')) {
            e.preventDefault();
            clearTimeout(_previewTimer);
            clearTimeout(_previewTouchTimer);
            _hidePreview();
            const refHtmlPath = a.dataset.refHtml;
            const searchKeyword = a.dataset.refSearch || '';
            const anchorId = a.dataset.refAnchor || '';
            const lineNum = a.dataset.refLine || '';
            if (refHtmlPath) {
                openHtmlViewer(refHtmlPath, searchKeyword, anchorId, lineNum);
            }
            return;
        }
        if (a.hasAttribute('data-ref-subject')) {
            e.preventDefault();
            const targetSubject = a.dataset.refSubject;
            const targetChapter = a.dataset.refChapter || '';
            if (!targetSubject) return;
            // 과목 선택 드롭다운 업데이트
            const subjectSelect = document.getElementById('reader-subject-select');
            if (subjectSelect) {
                subjectSelect.value = targetSubject;
                // change 이벤트 트리거
                subjectSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            // 챕터 앵커가 있으면 해당 섹션으로 스크롤 (콘텐츠 로드 후)
            if (targetChapter) {
                // 콘텐츠 렌더링 대기 후 섹션 검색
                setTimeout(() => {
                    const container = document.getElementById('textbook-reader-container');
                    if (!container) return;
                    // 챕터 앵커: ch01 → "Chapter 01" 패턴 매칭
                    const chNum = targetChapter.replace(/^ch/, '');
                    const chNumPadded = chNum.padStart(2, '0');
                    // 섹션 카드 중 제목에 "Chapter 01" 또는 "Chapter 1" 포함한 것 찾기
                    const sectionCards = container.querySelectorAll('.reader-section-card');
                    let foundSection = null;
                    sectionCards.forEach(card => {
                        if (foundSection) return;
                        const titleEl = card.querySelector('.reader-section-title');
                        if (titleEl) {
                            const title = titleEl.textContent || '';
                            // "Chapter 01" 또는 "Chapter 1" 패턴 매칭
                            if (title.includes('Chapter ' + chNumPadded) || title.includes('Chapter ' + parseInt(chNum))) {
                                foundSection = card;
                            }
                        }
                    });
                    if (foundSection) {
                        // 섹션 펼치기 (접혀있을 수 있음)
                        if (foundSection.classList.contains('collapsed')) {
                            foundSection.classList.remove('collapsed');
                        }
                        // 섹션으로 스크롤
                        foundSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                        // 매칭 실패 시 상단으로
                        container.scrollTop = 0;
                    }
                }, 800); // 콘텐츠 로드 대기
            } else {
                // 챕터 앵커 없으면 상단으로
                const container = document.getElementById('textbook-reader-container');
                if (container) container.scrollTop = 0;
            }
            return;
        }
        if (a.hasAttribute('data-glossary')) {
            e.preventDefault();
            scrollToGlossary(a.dataset.glossary, a);
            return;
        }
    });
}

function bindReferenceLinks() {
    // click 이벤트 위임 초기화 (1회만 등록)
    _initRefLinkDelegation();

    // 용어집 앵커 바인딩은 click 위임으로 처리되므로 별도 호출 불필요

    // HTML 뷰어 호버/터치 프리뷰 (mouseenter/mouseleave/touch는 위임 불가 → 가드 사용)
    document.querySelectorAll('[data-ref-html]:not([data-ref-bound])').forEach(a => {
        a.setAttribute('data-ref-bound', 'true');
        // 호버 프리뷰 (데스크톱)
        a.addEventListener('mouseenter', () => {
            clearTimeout(_previewTimer);
            _previewTimer = setTimeout(() => _showPreview(a), TIMING.PREVIEW_HOVER_MS);
        });
        a.addEventListener('mouseleave', () => {
            clearTimeout(_previewTimer);
            _hidePreview();
        });
        // 롱프레스 프리뷰 (모바일) — 시각적 힌트: 600ms 동안 링크를 활성화 스타일로 표시
        a.addEventListener('touchstart', () => {
            clearTimeout(_previewTouchTimer);
            a.classList.add('ref-longpress-active');
            _previewTouchTimer = setTimeout(() => {
                a.classList.remove('ref-longpress-active');
                _showPreview(a);
            }, TIMING.PREVIEW_LONG_PRESS_MS);
        }, { passive: true });
        a.addEventListener('touchend', () => {
            clearTimeout(_previewTouchTimer);
            a.classList.remove('ref-longpress-active');
            setTimeout(_hidePreview, TIMING.PREVIEW_HIDE_MS);
        }, { passive: true });
        a.addEventListener('touchmove', () => {
            clearTimeout(_previewTouchTimer);
            a.classList.remove('ref-longpress-active');
            _hidePreview();
        }, { passive: true });
    });
}
