// views/reader-toolbar.js — 교재 리더 툴바·독서 설정·스크롤 이벤트 (textbook-reader.js에서 분리)
// @spec TR-15,TR-16,TR-16a,TR-18,TR-21~23,UX-SCR-01
// 역할: 북마크 토글, 폰트 스케일·줄간격·테마 클래스 적용, 스크롤 스파이(rAF 디바운스),
//       툴바 버튼 바인딩, 표 전체화면 모달. 렌더링 로직은 textbook-reader.js에 남음.
import { safeGetItem, safeSetItem } from '../state.js';
import { STORAGE_KEYS } from '../storage-keys.js';
import { trapFocus } from '../ui-utils.js';
import { scheduleSaveReaderPosition } from './textbook-reader.js';
export const readerChapterContext = { subjId: '', chapterIdx: 0 };
let readerFontScale = (() => { try { return parseFloat(safeGetItem(STORAGE_KEYS.READER_FONT_SCALE) || '') || 1; } catch (e) { return 1; } })();
let readerLineHeight = (() => { try { return parseFloat(safeGetItem(STORAGE_KEYS.READER_LINE_HEIGHT) || '') || 2.05; } catch (e) { return 2.05; } })();
let readerScrollBound = false;

export function getReaderBookmarks() {
    try {
        return JSON.parse(safeGetItem(STORAGE_KEYS.READER_BOOKMARKS) || '[]') || [];
    } catch { return []; }
}

export function toggleReaderBookmark(key, btn) {
    const bookmarks = getReaderBookmarks();
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
    safeSetItem(STORAGE_KEYS.READER_BOOKMARKS, JSON.stringify(bookmarks));
}

export function applyReaderFontScale() {
    const container = document.getElementById('textbook-reader-container');
    const display = document.getElementById('reader-font-size-display');
    if (container) container.style.setProperty('--reader-font-scale', String(readerFontScale));
    if (display) display.textContent = Math.round(readerFontScale * 100) + '%';
    safeSetItem(STORAGE_KEYS.READER_FONT_SCALE, readerFontScale);
}

export function applyReaderLineHeight() {
    const container = document.getElementById('textbook-reader-container');
    const display = document.getElementById('reader-line-height-display');
    if (container) container.style.setProperty('--reader-line-height', String(readerLineHeight));
    if (display) display.textContent = readerLineHeight.toFixed(2);
    safeSetItem(STORAGE_KEYS.READER_LINE_HEIGHT, readerLineHeight);
}

export function applyReaderThemeClass() {
    // 리더 테마는 전역 테마(window.AppTheme / <html>.light-theme)를 그대로 따름
    const view = document.getElementById('textbook-reader-view');
    const isLight = window.AppTheme
        ? window.AppTheme.isLight()
        : document.documentElement.classList.contains('light-theme');
    if (view) view.classList.toggle('reader-light-theme', isLight);
}

export function bindReaderScrollEvents() {
    const container = document.getElementById('textbook-reader-container');
    if (!container || readerScrollBound) return;
    readerScrollBound = true;

    // rAF 디바운스: 매 스크롤 프레임마다 querySelectorAll 호출을 방지
    // 연속 스크롤 중에는 1회만 처리하고, 다음 프레임에서 갱신
    let scrollRafId = null;
    let cachedCards = null; // 카드 목록 캐싱 (단원 전환 시 초기화됨)
    let lastScrollY = 0; // 툴바 자동 숨김용 이전 스크롤 위치

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
            // Chrome auto-hide (TR-22/23): 아래로 스크롤 시 크롬 오버레이를 숨기고
            // 위로 올리면 복귀 — 크롬은 absolute 오버레이라 본문 높이 변동 없이
            // 공간 전체를 해방한다. 크롬에는 컨트롤·툴바·오디오가 모두 포함됨.
            const chromeEl = document.getElementById('reader-chrome');
            const curY = container.scrollTop;
            const hiding = curY > lastScrollY + 6 && curY > 140;
            const showing = curY < lastScrollY - 6 || curY <= 140;
            if (chromeEl) {
                if (hiding) chromeEl.classList.add('reader-chrome-hidden');
                else if (showing) chromeEl.classList.remove('reader-chrome-hidden');
            }
            lastScrollY = curY;
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
                card.classList.toggle('current-section', parseInt((/** @type {HTMLElement} */ (card)).dataset.sectionIdx || '') === currentIdx);
            });
            document.querySelectorAll('.reader-toc-item').forEach(item => {
                item.classList.toggle('active', parseInt((/** @type {HTMLElement} */ (item)).dataset.sectionIdx || '') === currentIdx);
            });
            // D: 브레드크럼 제거됨 — sticky heading으로 대체
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

    // 왼쪽 가장자리 스와이프 → 모바일 TOC 드로어 오픈/닫기 (모던 네비게이션 패턴)
    // - 화면 왼쪽 끝(24px 이내)에서 오른쪽으로 스와이프 → 드로어 오픈
    // - 드로어가 열린 상태에서 왼쪽으로 스와이프 → 드로어 닫기
    // - 세로 스크롤 의도(|dy|>|dx|)는 무시
    // ※ reader-toc는 container의 형제라 열린 드로어의 터치가 container에
    //   도달하지 않으므로 공통 부모 #reader-layout에 바인딩한다.
    const readerLayout = document.getElementById('reader-layout');
    const swipeHost = readerLayout || container;
    const SWIPE_EDGE = 24;   // 왼쪽 끝 인식 영역 (px)
    const SWIPE_MIN = 48;    // 스와이프 인식 최소 거리 (px)
    let swStartX = 0, swStartY = 0, swTracking = false, swWasOpen = false;
    const isMobileTocMode = () => {
        try { return window.matchMedia('(max-width: 900px)').matches; }
        catch (e) { return false; }
    };
    swipeHost.addEventListener('touchstart', (e) => {
        if (!isMobileTocMode() || !e.touches || e.touches.length !== 1) { swTracking = false; return; }
        const tocAside = document.getElementById('reader-toc');
        if (!tocAside || tocAside.classList.contains('is-hidden')) { swTracking = false; return; }
        const t = e.touches[0];
        const isOpen = tocAside.classList.contains('mobile-open');
        if ((!isOpen && t.clientX <= SWIPE_EDGE) || isOpen) {
            swTracking = true; swWasOpen = isOpen;
            swStartX = t.clientX; swStartY = t.clientY;
        } else {
            swTracking = false;
        }
    }, { passive: true });
    swipeHost.addEventListener('touchmove', (e) => {
        if (!swTracking) return;
        const tocAside = document.getElementById('reader-toc');
        const tocBackdrop = document.getElementById('reader-toc-backdrop');
        if (!tocAside) { swTracking = false; return; }
        const t = e.touches[0];
        const dx = t.clientX - swStartX;
        const dy = t.clientY - swStartY;
        if (Math.abs(dy) > Math.abs(dx)) { swTracking = false; return; }
        if (!swWasOpen && dx > SWIPE_MIN) {
            tocAside.classList.add('mobile-open');
            if (tocBackdrop) tocBackdrop.classList.remove('is-hidden');
            swTracking = false;
        } else if (swWasOpen && dx < -SWIPE_MIN) {
            tocAside.classList.remove('mobile-open');
            if (tocBackdrop) tocBackdrop.classList.add('is-hidden');
            const tip = document.getElementById('toc-tooltip');
            if (tip) tip.classList.remove('is-visible');
            swTracking = false;
        }
    }, { passive: true });
    const swipeEnd = () => { swTracking = false; };
    swipeHost.addEventListener('touchend', swipeEnd, { passive: true });
    swipeHost.addEventListener('touchcancel', swipeEnd, { passive: true });

    // 엣지 힌트 탭 클릭 → 드로어 오픈 (스와이프 대안)
    const edgeHint = document.getElementById('reader-toc-edge-hint');
    if (edgeHint && !edgeHint.dataset.bound) {
        edgeHint.dataset.bound = 'true';
        edgeHint.addEventListener('click', () => {
            const tocAside = document.getElementById('reader-toc');
            const tocBackdrop = document.getElementById('reader-toc-backdrop');
            if (tocAside && !tocAside.classList.contains('is-hidden')) {
                tocAside.classList.add('mobile-open');
                if (tocBackdrop) tocBackdrop.classList.remove('is-hidden');
            }
        });
        // 최초 1회 — 힌트 존재를 알리는 펄스 (표시된 후 애니메이션 종료 시 해제)
        if (safeGetItem('ui_toc_hint_seen') !== '1') {
            edgeHint.classList.add('is-attention');
            edgeHint.addEventListener('animationend', () => {
                edgeHint.classList.remove('is-attention');
                safeSetItem('ui_toc_hint_seen', '1');
            }, { once: true });
        }
    }
}

export function initReaderToolbar() {
    // M: 모바일(≤768px·가로모드 저높이)에서는 펼친 툴바가 수백 px를 차지해
    // 본문 영역을 잠식 — 기본 접힘으로 시작. 세션 내 사용자 토글은 유지.
    const toolbarEl0 = document.getElementById('reader-toolbar');
    if (toolbarEl0 && !toolbarEl0.dataset.mobileInit
        && window.matchMedia
        && window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 500px)').matches) {
        toolbarEl0.classList.add('collapsed');
        document.getElementById('reader-toolbar-toggle')?.setAttribute('aria-expanded', 'false');
    }
    if (toolbarEl0) toolbarEl0.dataset.mobileInit = '1';

    // TR-23: 크롬 오버레이 높이 실측 → --reader-chrome-h. 본문 padding-top·
    // scroll-margin·섹션 표시줄 top이 이 변수를 참조하므로 툴바 펼침·래핑·
    // 폰트 스케일 등 어떤 변동에도 자동 동기화된다.
    const viewEl = document.getElementById('textbook-reader-view');
    const chromeEl = document.getElementById('reader-chrome');
    if (viewEl && chromeEl && !chromeEl.dataset.roBound && typeof ResizeObserver !== 'undefined') {
        chromeEl.dataset.roBound = '1';
        const syncChromeH = () => viewEl.style.setProperty('--reader-chrome-h', chromeEl.offsetHeight + 'px');
        new ResizeObserver(syncChromeH).observe(chromeEl);
        syncChromeH();
    }

    const decBtn = document.getElementById('reader-font-decrease');
    const incBtn = document.getElementById('reader-font-increase');
    const resetBtn = document.getElementById('reader-font-reset');
    const lhDecBtn = document.getElementById('reader-line-height-decrease');
    const lhIncBtn = document.getElementById('reader-line-height-increase');
    const lhResetBtn = document.getElementById('reader-line-height-reset');
    const toolbarToggleBtn = document.getElementById('reader-toolbar-toggle');
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
    if (toolbarToggleBtn && !toolbarToggleBtn.dataset.bound) {
        toolbarToggleBtn.dataset.bound = 'true';
        toolbarToggleBtn.addEventListener('click', () => {
            const toolbar = document.getElementById('reader-toolbar');
            if (!toolbar) return;
            const collapsed = toolbar.classList.toggle('collapsed');
            toolbarToggleBtn.setAttribute('aria-expanded', String(!collapsed));
        });
    }
    // 헤더 등 다른 곳에서 테마가 바뀌면 리더도 즉시 동기화
    if (!document.body.dataset.readerThemeSync) {
        document.body.dataset.readerThemeSync = 'true';
        document.addEventListener('themechange', applyReaderThemeClass);
    }
    // P2-7: 본문 내 검색 하이라이트
    const searchInput = /** @type {HTMLInputElement|null} */ (document.getElementById('reader-in-content-search'));
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
                if (!parent) return;
                parent.replaceChild(document.createTextNode(el.textContent || ''), el);
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
                    if (!(node.textContent || '').trim()) return NodeFilter.FILTER_REJECT;
                    const parent = /** @type {Element|null} */ (node.parentNode);
                    if (!parent) return NodeFilter.FILTER_REJECT;
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
                const text = textNode.textContent || '';
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
                if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
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
            const tip = document.getElementById('toc-tooltip');
            if (tip) tip.classList.remove('is-visible');
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
                const t = /** @type {Element|null} */ (e.target);
                if (t && (t.closest('.reader-toc-item') || t.closest('.reader-toc-sub-item'))) {
                    closeMobileToc();
                }
            });
        }
    }
    if (modalClose && !modalClose.dataset.bound) {
        modalClose.dataset.bound = 'true';
        modalClose.addEventListener('click', closeTableModal);
    }
    if (modal && !modal.dataset.bound) {
        modal.dataset.bound = 'true';
        modal.querySelector('.reader-table-modal-backdrop')?.addEventListener('click', closeTableModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('is-hidden')) closeTableModal();
        });
    }
}

export function openTableModal(wrapper) {
    const modal = /** @type {HTMLElement & {_untrapFocus?: (() => void) | null} | null} */ (document.getElementById('reader-table-modal'));
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
    const modal = /** @type {HTMLElement & {_untrapFocus?: (() => void) | null} | null} */ (document.getElementById('reader-table-modal'));
    if (modal) {
        modal.classList.add('is-hidden');
        if (modal._untrapFocus) {
            modal._untrapFocus();
            modal._untrapFocus = null;
        }
    }
}

// --- 참조자료 링크 기능 ---

