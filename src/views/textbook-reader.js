// views/textbook-reader.js - 교재 본문 읽기 및 오디오북 플레이어 (Textbook Reader + Audio)
// @spec TR-01~19,SA-01~05,G-01~09,ST-01~07
//   (참조 링크 프리뷰/위임 → reader-ref-links.js, 툴바·스크롤스파이·표 모달 → reader-toolbar.js)
import { esc } from '../sanitize.js';
import { proFeatureNotice, refreshProBadges } from '../pro-upgrade.js';
import { trackAction } from '../usage-stats.js';
import { formatSectionContentForReader, markStoryNarrative } from '../reader-format.js';
import { parseTextbookContent } from '../textbook-parser.js';
import { renderStudyAids, bindStudyAidToggles, renderExamFilterToggle, applyExamFilter } from '../study-aids.js';
import { renderMermaidIn } from '../mermaid-render.js';
import { attachImageZoomIn } from '../image-zoom.js';
import {
    getRefTables, mapSourceToRef
} from '../pdf-registry.js';
import { collectGlossaryItems, renderGlossaryTable, appendGlossaryTocItem } from './glossary-renderer.js';
import {
    readerAudioState,
    showAudioToast,
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
import { hasFeature } from '../exam-context.js';
import { safeGetItem, safeSetItem } from '../state.js';
import { STORAGE_KEYS } from '../storage-keys.js';
import { PATHS } from '../paths.js';
import { CACHE } from '../config/cache.js';
import {
    readerChapterContext, getReaderBookmarks, toggleReaderBookmark,
    applyReaderFontScale, applyReaderLineHeight, applyReaderThemeClass,
    bindReaderScrollEvents, initReaderToolbar, openTableModal
} from './reader-toolbar.js';
import { buildReferenceLinks, bindReferenceLinks } from './reader-ref-links.js';

// --- 교재 본문 읽기 (Textbook Reader) ---
const textbookReaderState = {
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
        safeSetItem(READER_POSITION_KEY, JSON.stringify(pos));
    } catch (e) { /* noop */ }
}

function loadReaderPosition() {
    try {
        const raw = safeGetItem(READER_POSITION_KEY);
        if (!raw) return null;
        const pos = JSON.parse(raw);
        // 30일 이상 지난 위치는 무시
        if (pos.ts && (Date.now() - pos.ts > 30 * 24 * 60 * 60 * 1000)) return null;
        return pos;
    } catch (e) { return null; }
}

// 스크롤 위치 저장 (디바운스: 1초 후 저장)
export function scheduleSaveReaderPosition() {
    if (_scrollSaveTimer) clearTimeout(_scrollSaveTimer);
    _scrollSaveTimer = setTimeout(saveReaderPosition, 1000);
}

// --- 이야기형 MD 캐시: { "subjId:chapterIdx": { chapterTitle, sections, filePath } } ---
// LRU 캐시: 최대 항목 수를 초과하면 가장 오래된 항목 제거 (메모리 누수 방지)
const _storyChapterCache = {};
const _STORY_CACHE_MAX_ENTRIES = CACHE.STORY_CACHE_MAX_ENTRIES;
const _storyCacheKeyOrder = [];

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

/**
 * 교재 리더를 특정 과목·챕터로 이동시킨다.
 * (뷰 전환은 호출 측에서 수행 — 매뉴얼 뷰어의 subj: 링크, 교차 참조 링크 공용)
 * @param {string} subject - 과목 키 (law/manufacturing/safety/understanding)
 * @param {string} [chapterAnchor] - 'ch01' 형태 챕터 앵커 (선택)
 */
export function openSubjectChapter(subject, chapterAnchor = '') {
    if (!subject) return;
    // 과목 선택 드롭다운 업데이트
    const subjectSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('reader-subject-select'));
    if (subjectSelect) {
        subjectSelect.value = subject;
        // change 이벤트 트리거
        subjectSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // 챕터 앵커가 있으면 해당 섹션으로 스크롤 (콘텐츠 로드 후)
    if (chapterAnchor) {
        // 콘텐츠 렌더링 대기 후 섹션 검색
        setTimeout(() => {
            const container = document.getElementById('textbook-reader-container');
            if (!container) return;
            // 챕터 앵커: ch01 → "Chapter 01" 패턴 매칭
            const chNum = chapterAnchor.replace(/^ch/, '');
            const chNumPadded = chNum.padStart(2, '0');
            // 섹션 카드 중 제목에 "Chapter 01" 또는 "Chapter 1" 포함한 것 찾기
            const sectionCards = container.querySelectorAll('.reader-section-card');
            let foundSection = /** @type {Element|null} */ (null);
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
}

/**
 * 교재 리더를 특정 과목의 섹션 제목으로 이동시킨다.
 * chapter 앵커("Chapter N" 형식 종속) 대신 렌더된 섹션 제목 텍스트로 매칭하므로
 * 교재 형식이 바뀌어도 동작한다. (통합 검색 팔레트에서 사용)
 * @param {string} subject - 과목 키
 * @param {string} sectionTitle - 섹션 제목 (부분 매칭)
 */
export function openSubjectSection(subject, sectionTitle) {
    if (!subject) return;
    const subjectSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('reader-subject-select'));
    if (subjectSelect) {
        subjectSelect.value = subject;
        subjectSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!sectionTitle) return;
    setTimeout(() => {
        const container = document.getElementById('textbook-reader-container');
        if (!container) return;
        let foundSection = /** @type {Element|null} */ (null);
        container.querySelectorAll('.reader-section-card').forEach(card => {
            if (foundSection) return;
            const titleEl = card.querySelector('.reader-section-title');
            if (titleEl && (titleEl.textContent || '').includes(sectionTitle)) {
                foundSection = card;
            }
        });
        if (foundSection) {
            foundSection.classList.remove('collapsed');
            foundSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            container.scrollTop = 0;
        }
    }, 800); // 콘텐츠 로드 대기
}

export function renderTextbookReader() {
    const subjectSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('reader-subject-select'));
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
            const subjId = (/** @type {HTMLSelectElement|null} */ (e.target) || { value: '' }).value;
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
                // 챕터 액션 그룹 및 오디오 플레이어 초기화
                const ag = document.getElementById('reader-chapter-actions-group');
                if (ag) ag.innerHTML = '';
                const ap = document.getElementById('reader-audio-player-area');
                if (ap) { ap.classList.add('is-hidden'); ap.innerHTML = ''; }
            }
        });
    }

    // Story mode checkbox binding (bind once)
    const storyToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('reader-story-mode-toggle'));
    if (storyToggle && !storyToggle.dataset.bound) {
        storyToggle.dataset.bound = 'true';
        storyToggle.checked = textbookReaderState.storyMode;
        storyToggle.addEventListener('change', (e) => {
            if ((/** @type {HTMLInputElement} */ (e.target)).checked) {
                trackAction('story_textbook');
                proFeatureNotice('story_textbook', '이야기형 교재 본문 읽기');
            }
            // 표준형으로 돌아가면 오디오 버튼/플레이어가 숨겨지므로 재생 중인 오디오 정지
            if (!(/** @type {HTMLInputElement} */ (e.target)).checked && readerAudioState.audio) {
                stopReaderAudio();
                showAudioToast('표준형 모드로 전환되어 오디오 재생이 중지되었습니다.');
            }
            // 읽던 섹션 위치 보존 — 서사 블록이 본문 사이에 삽입돼 scrollTop 절대값이 어긋나므로
            // 현재 보이는 섹션 앵커(reader-section-N)를 기억하고 같은 섹션으로 복원한다.
            const container = document.getElementById('textbook-reader-container');
            let anchorIdx = -1, anchorOffset = 0;
            if (container) {
                const cTop = container.getBoundingClientRect().top;
                const secs = container.querySelectorAll('[id^="reader-section-"]');
                for (const s of secs) {
                    const relTop = s.getBoundingClientRect().top - cTop;
                    if (relTop <= 40) {
                        anchorIdx = parseInt(s.id.replace('reader-section-', ''), 10);
                        anchorOffset = -relTop; // 섹션 상단이 뷰포트 위로 얼마나 지났는지
                    } else break;
                }
            }
            textbookReaderState.storyMode = (/** @type {HTMLInputElement} */ (e.target)).checked;
            // Re-render current chapter if one is selected
            if (textbookReaderState.selectedSubject && textbookReaderState.selectedChapter) {
                Promise.resolve(renderChapterContent(textbookReaderState.selectedSubject, parseInt(textbookReaderState.selectedChapter))).then(() => {
                    const cont = document.getElementById('textbook-reader-container');
                    const target = anchorIdx >= 0 ? document.getElementById(`reader-section-${anchorIdx}`) : null;
                    if (cont && target) {
                        const absTop = target.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop;
                        cont.scrollTop = Math.max(0, absTop + anchorOffset);
                    }
                });
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
    if (/^\d+\.\d+\.\d+/.test(t)) return 3;   // 1.1.1 (3단계)
    if (/^\d+\.\d+/.test(t)) return 2;         // 1.1 (2단계)
    if (/^\d+\./.test(t)) return 1;           // 1. (1단계)
    return 0;                                  // Chapter, 📖, 📊, ✅, 출처, 제N조 등
}

/** 제목이 자체 번호를 가지고 있으면 toc-num 순번을 표시하지 않음 */
function _hasOwnNumber(title) {
    const t = (title || '').trim();
    return /^\d+\./.test(t) || /^\(\d+\)/.test(t) || /Chapter\s+\d+/i.test(t);
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
const _headingIdCounter = 0;
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
        tocList.querySelectorAll('.reader-toc-item').forEach(node => {
            const item = /** @type {HTMLElement} */ (node);
            item.addEventListener('click', (e) => {
                const toggleIcon = (/** @type {Element|null} */ (e.target))?.closest('.toc-toggle-icon');
                const idx = parseInt(item.dataset.sectionIdx || '');
                if (toggleIcon) {
                    // 토글: 바로 다음 형제 children 컨테이너 찾기
                    let next = item.nextElementSibling;
                    while (next && !next.classList.contains('reader-toc-children')) {
                        next = next.nextElementSibling;
                    }
                    if (next && Number((/** @type {HTMLElement} */ (next)).dataset.parentIdx) === idx) {
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
        tocList.querySelectorAll('.reader-toc-sub-item').forEach(node => {
            const sub = /** @type {HTMLElement} */ (node);
            sub.addEventListener('click', () => {
                const secIdx = parseInt(sub.dataset.sectionIdx || '');
                const hIdx = parseInt(sub.dataset.headingIdx || '');
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
        // TOC 툴팁은 hover 가능 기기(데스크톱)에서만 의미 있음 —
        // 모바일은 탭 즉시 네비게이션되어 툴팁이 잔류/깜빡임만 유발
        const hoverCapable = window.matchMedia && window.matchMedia('(hover: hover)').matches;
        if (hoverCapable) {
            tocList.querySelectorAll('.reader-toc-item, .reader-toc-sub-item').forEach(el => {
                el.addEventListener('mouseenter', () => showTocTooltip(el));
                el.addEventListener('mouseleave', hideTocTooltip);
                el.addEventListener('focus', () => showTocTooltip(el));
                el.addEventListener('blur', hideTocTooltip);
            });
        }
    }


    // [멀티시험] 오디오북·참조자료는 시험 features 플래그로 게이트
    // 오디오 MP3는 이야기형 교재 내레이션이므로 이야기형 모드(story_textbook Pro)에서만 표시.
    // 매니페스트 조회는 단원 인덱스 기반이므로 정규 챕터 객체로 해석한다 —
    // 이야기형 chapter 객체는 신규 객체라 indexOf 실패 + fileName 규칙 불일치로 경로를 못 찾는다.
    const audioChapter = (subj.chapters && subj.chapters[chapterIdx]) || chapter;
    const audioPath = (hasFeature('audiobook') && isStoryMode) ? getAudioPathForChapter(subjId, audioChapter) : null;
    const hasAudio = !!audioPath;
    const refsEnabled = hasFeature('refDocs');

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
    `;

    // --- 챕터 액션을 툴바에 동적 주입 ---
    const actionsGroup = document.getElementById('reader-chapter-actions-group');
    if (actionsGroup) {
        let actionsHtml = '';
        if (!isStoryMode) {
            actionsHtml += renderExamFilterToggle();
        }
        actionsHtml += `<a href="${esc(chapter.filePath)}" target="_blank" class="reader-tool-btn" title="원본 MD 열기" style="text-decoration:none;">
            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> 원본
        </a>`;
        if (refsEnabled) {
            actionsHtml += `<details id="reader-ref-dropdown" class="reader-ref-dropdown" style="display:inline-block;position:relative;">
                <summary class="reader-tool-btn" title="참조자료" style="cursor:pointer;list-style:none;">
                    <i class="fa-solid fa-book-bookmark" aria-hidden="true"></i> 참조자료
                </summary>
                <div class="reader-ref-panel" style="position:absolute;top:100%;right:0;z-index:100;margin-top:0.4rem;min-width:320px;max-height:400px;overflow-y:auto;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);padding:0.6rem;">
                    ${buildReferenceLinks(subjId, chapterRefPath)}
                </div>
            </details>`;
        }
        if (hasAudio) {
            actionsHtml += `<button id="reader-audio-toggle-btn" class="reader-tool-btn" data-click="toggleReaderAudio" data-args='["${subjId}", ${chapterIdx}]' title="오디오 듣기">
                <i class="fa-solid fa-headphones" aria-hidden="true"></i> 오디오 <span class="pro-badge" data-pro-feature="audiobook">PRO</span>
            </button>`;
        }
        actionsGroup.innerHTML = actionsHtml;
        refreshProBadges(actionsGroup);
    }

    // --- 오디오 플레이어 영역을 툴바 아래로 이동 ---
    const audioPlayerArea = document.getElementById('reader-audio-player-area');
    if (audioPlayerArea && hasAudio) {
        audioPlayerArea.classList.remove('is-hidden');
        audioPlayerArea.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.55rem;">
                <i class="fa-solid fa-circle-play" style="color: var(--color-primary);"></i>
                <span id="reader-audio-now-playing" style="color: var(--color-text-main); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                <span id="reader-audio-status" class="is-hidden" style="margin-left: auto; font-size: 0.78rem; color: var(--warning);"></span>
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
        `;
    } else if (audioPlayerArea) {
        audioPlayerArea.classList.add('is-hidden');
        audioPlayerArea.innerHTML = '';
    }

    try {
        html += await renderStudyAids(chapter, subjId);
    } catch (err) {
        console.warn('[Reader] 학습 보조 렌더링 실패:', err);
    }

    // D: 브레드크럼 — 제거됨 (TOC 하이라이트 + sticky heading으로 대체)

    const _rt = getRefTables();
    const subjRefFiles = (_rt.REFERENCE_FILES || {})[subjId] || [];
    const subjDirName = (_rt.SUBJECT_DIR_MAP || {})[subjId] || '';

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

    html += `
        <div class="reader-chapter-end-marker" role="separator" aria-label="단원 끝">— 단원 끝 —</div>
        </div><!-- /reader-readable-width -->
    `;

    container.innerHTML = html;

    // 이야기형: 📖 장면·💭 에필로그·프롤로그 범위에 서사 스타일 태깅 (명조체+색상 구분)
    if (isStoryMode) {
        container.querySelectorAll('.textbook-reader-section-content, .reader-subsection-content')
            .forEach(el => markStoryNarrative(el));
    }

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
            if ((/** @type {Element|null} */ (e.target))?.closest('.reader-bookmark-btn')) return;
            const card = header.closest('.reader-section-card');
            if (card) card.classList.toggle('collapsed');
        });
    });

    // 본문 목차 하이퍼링크 → 대응 섹션으로 스크롤
    container.querySelectorAll('a[data-toc-jump]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const jumpText = ((/** @type {HTMLElement} */ (link)).dataset.tocJump || '').trim();
            if (!jumpText) return;
            // 이모지 제거한 정규화 텍스트 (매칭용)
            const normalize = (s) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '').replace(/\s+/g, ' ').trim();
            const jumpNorm = normalize(jumpText);
            // 목차 항목 텍스트가 포함된 섹션 찾기
            const sectionCards = container.querySelectorAll('.reader-section-card');
            let found = /** @type {Element|null} */ (null);
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
            // 5순위: 섹션 본문 내용에서 텍스트 검색 (마인드맵 매핑 표 링크용)
            if (!found && jumpNorm) {
                sectionCards.forEach(card => {
                    const body = card.querySelector('.reader-section-body');
                    if (!body) return;
                    const bodyText = body.textContent || '';
                    if (bodyText.includes(jumpNorm)) {
                        found = card;
                    }
                });
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
            toggleReaderBookmark((/** @type {HTMLElement} */ (btn)).dataset.bookmarkKey, btn);
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
    renderMermaidIn(container, '[reader]');
    attachImageZoomIn(container);

    // 참조자료 링크 이벤트 바인딩
    bindReferenceLinks();
}
