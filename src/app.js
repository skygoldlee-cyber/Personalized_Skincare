// app.js - 맞춤형화장품 조제관리사 학습 플랫폼 애플리케이션 로직
import { state, loadProgress, saveProgress } from './state.js';
import { esc } from './sanitize.js';
import { shuffle } from './utils.js';
import { clearScratchpad, toggleCalcScratchpad, toggleScratchpadEraser } from './scratchpad.js';
import { DataLoader } from './data-loader.js';
import { ExamViewer } from './exam-viewer.js';
import { ManualViewer } from './manual-viewer.js';
import { initWebVitals } from './web-vitals.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { setupPWAInstall } from './pwa-install.js';
import { setupThemeToggle } from './theme-toggle.js';

// --- 뷰 컨트롤러 모듈 임포트 ---
import {
    updateGlobalStats,
    refreshDashboardStatsInBackground,
    renderDashboard,
    startSubjectStudy,
    startSubjectQuiz
} from './views/dashboard.js';
import {
    loadFlashcards,
    renderFlashcard
} from './views/flashcard.js';
import {
    startQuiz,
    renderQuizQuestion,
    submitQuizAnswer,
    nextQuizQuestion,
    renderQuizResult,
    getWeakCardsList,
    renderReviewList,
    removeWeakCard,
    setReviewFilter,
    startWeakFocusQuiz
} from './views/quiz.js';
import {
    updateStreakAndDailyUI,
    startDailyChallenge,
    closeDailyModal,
    renderDailyStep,
    submitDailyCardAnswer,
    submitDailyChoiceAnswer,
    submitDailyShortAnswer,
    showDailyFeedback,
    nextDailyStep,
    finishDailyChallenge
} from './views/daily-challenge.js';
import {
    initTrainer,
    exitTrainerSubView,
    startLimitsTrainer,
    renderLimitsQuestion,
    submitLimitsAnswer,
    nextLimitsQuestion,
    startCalcPractice,
    generateCalcQuestion,
    submitCalcAnswer,
    toggleSolutionAccordion,
    checkShortAnswer,
    startIngredientsChallenge,
    generateIngredientsQuestions,
    renderIngQuestion,
    submitIngChoiceAnswer,
    submitIngAnswer,
    showIngFeedback,
    nextIngQuestion,
    renderCalcHistory,
    addCalcHistoryItem
} from './views/trainer.js';
import {
    togglePomodoro,
    tickPomodoro,
    resetPomodoro,
    updatePomodoroUI
} from './views/pomodoro.js';
import {
    dictState,
    renderDictionary,
    filterDictionary,
    setDictFilter,
    clearDictSearch
} from './views/dictionary.js';
import {
    getBackupKeys,
    exportData,
    triggerImport,
    importData,
    setupImportListener
} from './views/backup.js';
import {
    renderTextbookSearch,
    setTextbookFilter,
    clearTextbookSearch,
    toggleTextbookCard
} from './views/textbook-search.js';
import {
    textbookReaderState,
    renderTextbookReader,
    stopReaderAudio,
    toggleReaderAudio,
    toggleReaderPlayPause,
    seekReaderAudio,
    cycleReaderAudioRate,
    toggleReaderAutoScroll
} from './views/textbook-reader.js';
import {
    showGlobalLoading,
    hideGlobalLoading,
    showToast,
    showConfirm
} from './ui-utils.js';
import {
    simState,
    startSimSession,
    startMockExamSim,
    startIntegratedMockExam,
    saveSimDraft,
    clearSimDraft,
    checkExamDraft,
    resumeSimDraft,
    exitSimArena,
    startSimTimer,
    tickSimTimer,
    renderOMRSheet,
    updateOMRProgress,
    jumpToSimQuestion,
    renderSimQuestion,
    saveSimAnswer,
    submitExam,
    examIdToSubjectId,
    startWeakExam
} from './views/exam-simulator.js';
import {
    showSimAnswerReview,
    showSimResultsSummary
} from './views/exam-sim-review.js';
import { switchView } from './views/navigation.js';
import { setupOfflineDetection } from './views/offline-detection.js';
import { setupEventListeners } from './views/event-listeners.js';
import { getViewTitles, navigateToView } from './router.js';

// --- 런타임 에러 안전망 (런타임 ReferenceError 등을 사용자에게 알림) ---
window.addEventListener('error', function (event) {
    // 모듈 로드 실패는 app-fallback.js가 처리 — 여기서는 런타임 에러만
    if (event.error && (event.error instanceof ReferenceError || event.error instanceof TypeError)) {
        console.error('[runtime]', event.error);
        showToast('예상치 못한 오류가 발생했습니다. 페이지를 새로고침해주세요.', 'error');
    }
});
window.addEventListener('unhandledrejection', function (event) {
    if (event.reason && (event.reason instanceof ReferenceError || event.reason instanceof TypeError)) {
        console.error('[runtime] unhandledrejection:', event.reason);
        showToast('처리 중 오류가 발생했습니다.', 'error');
    }
});

// --- 초기화 및 로컬스토리지 로드 ---
function populateSubjectSelects() {
    const subjects = (typeof DataLoader !== 'undefined' && DataLoader.registry)
        ? DataLoader.getSubjectList()
        : [];
    
    // 1. Flashcard subject select
    const fcSelect = document.getElementById('fc-subject-select');
    if (fcSelect) {
        const prevVal = fcSelect.value || state.flashcards.subject;
        fcSelect.innerHTML = '';
        subjects.forEach(subj => {
            const option = document.createElement('option');
            option.value = subj.key;
            option.textContent = subj.name;
            fcSelect.appendChild(option);
        });
        if (prevVal && fcSelect.querySelector(`option[value="${prevVal}"]`)) {
            fcSelect.value = prevVal;
            state.flashcards.subject = prevVal;
        } else if (subjects.length > 0) {
            fcSelect.value = subjects[0].key;
            state.flashcards.subject = subjects[0].key;
        }
    }
    
    // 2. Quiz subject select
    const quizSelect = document.getElementById('quiz-subject-select');
    if (quizSelect) {
        const prevVal = quizSelect.value || state.quiz.subject;
        quizSelect.innerHTML = '';
        subjects.forEach(subj => {
            const option = document.createElement('option');
            option.value = subj.key;
            option.textContent = subj.name;
            quizSelect.appendChild(option);
        });
        if (prevVal && quizSelect.querySelector(`option[value="${prevVal}"]`)) {
            quizSelect.value = prevVal;
            state.quiz.subject = prevVal;
        } else if (subjects.length > 0) {
            quizSelect.value = subjects[0].key;
            state.quiz.subject = subjects[0].key;
        }
    }

    // 3. Review view filter buttons
    const reviewFilterGroup = document.getElementById('review-filter-group');
    if (reviewFilterGroup) {
        reviewFilterGroup.innerHTML = `
            <button class="btn btn-secondary filter-btn active" data-filter="all" data-click="setReviewFilter" data-arg="all" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border-radius: 4px; background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-brand);">전체</button>
        `;
        subjects.forEach((subj, idx) => {
            const shortName = subj.shortName || subj.name;
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary filter-btn';
            btn.setAttribute('data-filter', subj.key);
            btn.setAttribute('data-click', 'setReviewFilter');
            btn.setAttribute('data-arg', subj.key);
            btn.textContent = `${idx + 1}과목 (${shortName})`;
            reviewFilterGroup.appendChild(btn);
        });
    }

    // 4. Textbook filter buttons
    const tbFilterGroup = document.getElementById('textbook-filter-buttons');
    if (tbFilterGroup) {
        tbFilterGroup.innerHTML = `
            <button class="btn btn-secondary active-filter" data-filter="all" data-click="setTextbookFilter" data-arg="all">전체 과목</button>
        `;
        subjects.forEach((subj, idx) => {
            const shortName = subj.shortName || subj.name;
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.setAttribute('data-filter', subj.key);
            btn.setAttribute('data-click', 'setTextbookFilter');
            btn.setAttribute('data-arg', subj.key);
            btn.textContent = `${idx + 1}과목 (${shortName})`;
            tbFilterGroup.appendChild(btn);
        });
    }
}

const EXAM_BADGE_COLORS = ['badge-cyan', 'badge-violet', 'badge-emerald', 'badge-amber', 'badge-rose', 'badge-indigo'];

function populateExamCards() {
    const container = document.getElementById('exam-cards-dynamic');
    if (!container) return;
    const registry = (typeof DataLoader !== 'undefined' && DataLoader.registry) ? DataLoader.registry : null;
    if (!registry || !registry.subjects || !registry.exams) return;

    const subjects = registry.subjects;
    const exams = registry.exams;
    const badgeColors = {};
    subjects.forEach((sub, idx) => {
        badgeColors[sub.key] = EXAM_BADGE_COLORS[idx % EXAM_BADGE_COLORS.length];
    });

    container.innerHTML = '';
    subjects.forEach((subj, idx) => {
        const subjExams = exams.filter(e => e.subject === subj.key);
        if (subjExams.length === 0) return;

        const totalQuestions = subjExams.reduce((sum, e) => sum + (e.stats && e.stats.questions || 0), 0);
        const badgeColor = badgeColors[subj.key] || 'badge-gray';
        const shortName = subj.shortName || subj.name;

        const btnsHtml = subjExams.map((exam, partIdx) => {
            const partLabel = subjExams.length > 1 ? `${partIdx + 1}부` : '';
            const pdfLabel = subjExams.length > 1
                ? `${partLabel} PDF`
                : '문제집 열기';
            const simLabel = subjExams.length > 1
                ? `${partLabel} 풀기`
                : '시뮬레이터 시작';
            const btnClass = subjExams.length > 1 ? '' : ' btn-cyan';
            return `                                <div class="exam-btn-pair">
                                    <button data-click="ExamViewer.openExam" data-arg="content/문제은행/${exam.file}" class="exam-btn-link"><i class="fa-solid fa-file-pdf"></i> ${pdfLabel}</button>
                                    <button class="exam-btn-sim${btnClass}" data-click="startMockExamSim" data-arg="${exam.key}"><i class="fa-solid fa-circle-play"></i> ${simLabel}</button>
                                </div>`;
        }).join('\n');

        const btnsClass = subjExams.length > 2 ? 'grid-btns-3' : subjExams.length > 1 ? 'grid-btns-2' : 'flex-btns';

        const cardHtml = `                        <div class="exam-card-item">
                            <div class="exam-card-badge ${badgeColor}">${idx + 1}과목</div>
                            <h4 class="exam-card-title">${subj.name} ${totalQuestions}제</h4>
                            <div class="exam-card-btns ${btnsClass}">
${btnsHtml}
                            </div>
                        </div>`;

        container.insertAdjacentHTML('beforeend', cardHtml);
    });
}

function populateResourceCards() {
    const container = document.getElementById('resources-section');
    if (!container) return;
    const registry = (typeof DataLoader !== 'undefined' && DataLoader.registry) ? DataLoader.registry : null;
    if (!registry || !registry.resources) return;

    const res = registry.resources;
    const summaryCardsHtml = (res.summaries || []).map(s => `
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 1rem;">
                                <strong style="color: var(--color-text-main); display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">${s.icon} ${esc(s.name)}</strong>
                                <span style="color: var(--color-text-muted); line-height: 1.5; display: block;">${esc(s.desc)}</span>
                            </div>`).join('\n');

    const linkCardsHtml = (res.links || []).map(l => `
                        <div class="exam-card-item">
                            <div class="exam-card-badge ${l.badgeColor}"><i class="${l.badgeIcon}"></i> ${esc(l.badgeText)}</div>
                            <h4 class="exam-card-title">${esc(l.title)}</h4>
                            <p class="exam-card-desc">${esc(l.desc)}</p>
                            <div class="exam-card-btns">
                                <a href="${l.url}" target="_blank" class="exam-btn-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${esc(l.linkText)}</a>
                            </div>
                        </div>`).join('\n');

    container.innerHTML = `
                    <div class="section-title-area" style="margin-top: 3rem;">
                        <h3>${esc(res.sectionTitle)}</h3>
                        <p>${esc(res.sectionDesc)}</p>
                    </div>

                    <div style="background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.15); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                        <h4 style="color: var(--color-primary); font-size: 1.1rem; margin-bottom: 1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-graduation-cap"></i> ${esc(res.summaryTitle)}
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.85rem;">
${summaryCardsHtml}
                        </div>
                    </div>

                    <div class="exam-list-grid">
${linkCardsHtml}
                    </div>`;
    container.classList.remove('is-hidden');
}

function checkStorageWarning() {
    if (!state._storageUnavailable) return;
    const existing = document.getElementById('storage-warning-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'storage-warning-banner';
    banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 저장 공간이 부족하여 학습 진행상황이 저장되지 않습니다. 브라우저 데이터를 정리하거나 백업 후 진행 상황을 내보내세요.';
    document.body.appendChild(banner);
    banner.addEventListener('click', () => { banner.remove(); });
}

function initApp() {
    // 한 단계가 실패해도 나머지 버튼 연결/렌더가 죽지 않도록 각 단계를 격리한다.
    // (배포 간 캐시 스큐로 특정 요소/바인딩이 어긋나도 앱이 통째로 벽돌이 되는 것 방지)
    const step = (label, fn) => { try { fn(); console.debug('[init] ' + label + ' OK'); return true; } catch (e) { console.error('[init] ' + label + ' 실패:', e); return false; } };
    step('loadProgress', loadProgress);
    step('checkStorageWarning', checkStorageWarning);
    step('populateSubjectSelects', populateSubjectSelects);
    step('populateExamCards', populateExamCards);
    step('populateResourceCards', populateResourceCards);
    step('setupImportListener', setupImportListener);
    const navOk = step('setupNavigation', setupNavigation);
    step('setupEventListeners', () => setupEventListeners(enhanceDataClickAccessibility));
    step('setupPWAInstall', setupPWAInstall);
    step('setupThemeToggle', setupThemeToggle);
    // 초기 뷰 렌더링
    step('renderDashboard', renderDashboard);
    step('updateGlobalStats', updateGlobalStats);
    step('refreshDashboardStatsInBackground', refreshDashboardStatsInBackground);
    step('checkExamDraft', checkExamDraft);
    // app-fallback.js가 정상 초기화를 감지할 수 있도록 마커 설정
    // setupNavigation이 실패하면 마커를 설정하지 않아 폴백이 복구를 시도하게 함
    if (navOk) {
        window.__APP_INITIALIZED = true;
        console.debug('[init] 초기화 완료 — __APP_INITIALIZED = true');
    } else {
        console.error('[init] setupNavigation 실패 — __APP_INITIALIZED 미설정, 폴백 대기');
    }

    // 사이드바 버전 표시 동기화
    const versionEl = document.getElementById('sidebar-version');
    if (versionEl) {
        navigator.serviceWorker?.getRegistration?.().then(reg => {
            if (reg?.active?.scriptURL) {
                const match = reg.active.scriptURL.match(/v\d+-\d{8}-[\w-]+/);
                if (match) versionEl.textContent = match[0];
            }
        }).catch(() => {});
    }
}

// --- 가로/세로 보기 ---
// 실제 기기 회전 + 반응형 CSS가 가로/세로를 직접 처리하므로
// 가로/세로 보기 토글 — landscape-mode 클래스를 토글하고 상태를 저장
function setupOrientationToggle() {
    const btn = document.getElementById('orientation-toggle-btn');
    if (!btn) return;

    // 초기 상태 복원
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.PREFERRED_ORIENTATION);
        if (saved === 'landscape') {
            document.body.classList.add('landscape-mode');
            btn.querySelector('i').className = 'fa-solid fa-mobile-screen';
        }
    } catch (e) { /* 무시 */ }

    btn.addEventListener('click', () => {
        const isLandscape = document.body.classList.toggle('landscape-mode');
        try {
            if (isLandscape) {
                localStorage.setItem(STORAGE_KEYS.PREFERRED_ORIENTATION, 'landscape');
            } else {
                localStorage.removeItem(STORAGE_KEYS.PREFERRED_ORIENTATION);
            }
        } catch (e) { /* 무시 */ }
        // 아이콘 업데이트
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isLandscape ? 'fa-solid fa-mobile-screen' : 'fa-solid fa-mobile-screen-button';
        }
        showOrientationToast(isLandscape);
    });
}

// 방향 전환 알림 표시
function showOrientationToast(isLandscape) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.orientation-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'orientation-toast';

    const icon = document.createElement('i');
    icon.className = `${isLandscape ? 'fa-solid fa-mobile-screen' : 'fa-solid fa-mobile-screen-button'} orientation-toast-icon`;

    const text = document.createElement('span');
    text.className = 'orientation-toast-text';
    text.textContent = isLandscape ? '가로 보기 모드' : '세로 보기 모드';

    toast.appendChild(icon);
    toast.appendChild(text);
    document.body.appendChild(toast);

    // 2초 후 자동 제거
    setTimeout(() => {
        toast.style.animation = 'orientationToastOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// --- 네비게이션 제어 (SPA) ---
// 라우터 로직은 ./router.js로 분리, app.js는 이벤트 바인딩만 담당
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');
    console.debug('[nav] nav-item 개수:', navItems.length, '/ view-section 개수:', sections.length);

    const registry = (typeof window !== 'undefined' && window.DATA_REGISTRY) || null;
    const titlesMap = getViewTitles(registry);

    // 뷰별 렌더 핸들러 맵 (router.js의 navigateToView에서 디스패치)
    const viewRenderers = {
        'dashboard-view': () => {
            renderDashboard();
            refreshDashboardStatsInBackground();
            checkExamDraft();
        },
        'flashcard-view': () => {
            showGlobalLoading('플래시카드를 불러오는 중입니다...');
            DataLoader.loadSubject(state.flashcards.subject).then(() => {
                hideGlobalLoading();
                loadFlashcards();
            }).catch(() => {
                hideGlobalLoading();
                showToast('플래시카드 데이터를 불러오지 못했습니다.', 'error');
                loadFlashcards();
            });
        },
        'review-view': () => {
            showGlobalLoading('오답 및 중요 카드를 불러오는 중입니다...');
            const loaderPromises = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key));
            Promise.all(loaderPromises).then(() => {
                hideGlobalLoading();
                renderReviewList();
            }).catch(() => {
                hideGlobalLoading();
                showToast('복습 데이터를 불러오지 못했습니다.', 'error');
                renderReviewList();
            });
        },
        'trainer-view': () => {
            initTrainer();
        },
        'textbook-view': () => {
            showGlobalLoading('교재 검색용 데이터를 불러오는 중입니다...');
            const loaderPromises = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key));
            Promise.all(loaderPromises).then(() => {
                hideGlobalLoading();
                renderTextbookSearch();
            }).catch(() => {
                hideGlobalLoading();
                showToast('교재 검색 데이터를 불러오지 못했습니다.', 'error');
                renderTextbookSearch();
            });
        },
        'textbook-reader-view': () => {
            if (textbookReaderState.selectedSubject) {
                showGlobalLoading('교재 본문을 불러오는 중입니다...');
                DataLoader.loadSubject(textbookReaderState.selectedSubject).then(() => {
                    hideGlobalLoading();
                    renderTextbookReader();
                }).catch(() => {
                    hideGlobalLoading();
                    showToast('교재 본문 데이터를 불러오지 못했습니다.', 'error');
                    renderTextbookReader();
                });
            } else {
                renderTextbookReader();
            }
        },
        'dictionary-view': () => {
            showGlobalLoading('성분 사전을 불러오는 중입니다...');
            DataLoader.loadIngredients().then(() => {
                hideGlobalLoading();
                renderDictionary();
            }).catch(() => {
                hideGlobalLoading();
                showToast('성분 사전 데이터를 불러오지 못했습니다.', 'error');
                renderDictionary();
            });
        }
    };

    const routerCtx = {
        titlesMap,
        handlers: {
            viewRenderers,
            stopReaderAudio
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            navigateToView(target, routerCtx);
        });
    });

    // 모바일 하단 탭 바 클릭 이벤트 설정
    const mobileTabItems = document.querySelectorAll('.mobile-tab-item');
    mobileTabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-target');
            if (!target) return; // 외부 링크(매뉴얼)는 제외
            switchView(target);
        });
    });
}

// switchView, saveScrollPosition, restoreScrollPosition는
// ./views/navigation.js로 추출됨 (app.js ↔ quiz.js/dashboard.js 순환 import 해결).

// ============================================================
// 모바일 UX 개선: 모달 뒤로가기 버튼 대응
// ============================================================
let modalOpenState = false;

function setupModalBackHandler() {
    // 모달이 열릴 때 history 상태 추가
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.classList.contains('modal') ||
                    target.classList.contains('modal-content') ||
                    target.id === 'reader-table-modal') {
                    const isVisible = !target.classList.contains('is-hidden') &&
                                     getComputedStyle(target).display !== 'none';
                    
                    if (isVisible && !modalOpenState) {
                        modalOpenState = true;
                        history.pushState({ modalOpen: true }, '');
                    } else if (!isVisible && modalOpenState) {
                        modalOpenState = false;
                    }
                }
            }
        });
    });

    // 주요 모달 요소들 관찰
    document.querySelectorAll('.modal, .modal-content, [id$="-modal"]').forEach(el => {
        observer.observe(el, { attributes: true });
    });

    // 뒤로가기 버튼 처리
    window.addEventListener('popstate', (e) => {
        if (modalOpenState) {
            // 열린 모달 찾아서 닫기
            const openModals = document.querySelectorAll('.modal, .modal-content, [id$="-modal"]');
            openModals.forEach(modal => {
                if (!modal.classList.contains('is-hidden') && getComputedStyle(modal).display !== 'none') {
                    modal.classList.add('is-hidden');
                }
            });
            modalOpenState = false;
        }
    });
}


// ============================================================
// 초기화 확장
// ============================================================
const originalInitApp = initApp;
initApp = function() {
    originalInitApp();
    setupOfflineDetection(state, togglePomodoro);
    setupModalBackHandler();
};


function enhanceDataClickAccessibility() {
    document.querySelectorAll('[data-click]').forEach(el => {
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    });
}

// 동적 콘텐츠에도 접근성 속성 자동 부여
const _dataClickObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.matches && node.matches('[data-click]')) {
                if (node.tagName !== 'BUTTON' && node.tagName !== 'A' && node.tagName !== 'INPUT' && node.tagName !== 'SELECT' && node.tagName !== 'TEXTAREA') {
                    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');
                    if (!node.hasAttribute('role')) node.setAttribute('role', 'button');
                }
            }
            if (node.querySelectorAll) {
                node.querySelectorAll('[data-click]').forEach(el => {
                    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
                    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
                    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
                });
            }
        }
    }
});
if (document.body) {
    _dataClickObserver.observe(document.body, { childList: true, subtree: true });
}


/* =======================================================
   🖨️ 오답노트 인쇄 (Print Handler)
   ======================================================= */
function startFocusSubjectStudy(subKey) {
    DataLoader.loadSubject(subKey).then(() => {
        if (typeof STUDY_DATA !== 'undefined' && STUDY_DATA[subKey]) {
            const subj = STUDY_DATA[subKey];
            state.quiz.data = shuffle(subj.quizzes).slice(0, 10);
            state.quiz.currentIndex = 0;
            state.quiz.correctCount = 0;
            state.quiz.solvedList = [];
            
            // 퀴즈 화면 초기화 및 활성화
            document.getElementById('quiz-setup-panel').classList.add('is-hidden');
            document.getElementById('quiz-result-panel').classList.add('is-hidden');
            document.getElementById('quiz-arena-panel').classList.remove('is-hidden');
            document.getElementById('quiz-q-category').textContent = subj.name;
            
            renderQuizQuestion();
            
            // 퀴즈 탭 활성화
            switchView('quiz-view');
        }
    }).catch(err => {
        console.error(err);
        showToast("퀴즈 데이터를 로드하지 못했습니다.", "error");
    });
}



function printReviewNotes() {
    window.print();
}

// --- Textbook Reader 모듈은 ./views/textbook-reader.js로 추출됨 ---

// data-click 기반 이벤트 위임을 위한 전역 API 노출
window.ManualViewer = ManualViewer;
window.ExamViewer = ExamViewer;
window.DataLoader = DataLoader;
window.clearScratchpad = clearScratchpad;
window.toggleCalcScratchpad = toggleCalcScratchpad;
window.toggleScratchpadEraser = toggleScratchpadEraser;

window.clearDictSearch = clearDictSearch;
window.clearSimDraft = clearSimDraft;
window.clearTextbookSearch = clearTextbookSearch;
window.setTextbookFilter = setTextbookFilter;
window.toggleTextbookCard = toggleTextbookCard;
window.toggleReaderAudio = toggleReaderAudio;
window.stopReaderAudio = stopReaderAudio;
window.toggleReaderPlayPause = toggleReaderPlayPause;
window.seekReaderAudio = seekReaderAudio;
window.cycleReaderAudioRate = cycleReaderAudioRate;
window.toggleReaderAutoScroll = toggleReaderAutoScroll;
window.exitSimArena = exitSimArena;
window.exitTrainerSubView = exitTrainerSubView;
window.exportData = exportData;
window.generateCalcQuestion = generateCalcQuestion;
window.nextIngQuestion = nextIngQuestion;
window.nextLimitsQuestion = nextLimitsQuestion;
window.printReviewNotes = printReviewNotes;
window.resetPomodoro = resetPomodoro;
window.resumeSimDraft = resumeSimDraft;
window.setDictFilter = setDictFilter;
window.setReviewFilter = setReviewFilter;
window.startFocusSubjectStudy = startFocusSubjectStudy;
window.setTextbookFilter = setTextbookFilter;
window.showSimAnswerReview = showSimAnswerReview;
window.showSimResultsSummary = showSimResultsSummary;
window.startCalcPractice = startCalcPractice;
window.startDailyChallenge = startDailyChallenge;
window.startIngredientsChallenge = startIngredientsChallenge;
window.startIntegratedMockExam = startIntegratedMockExam;
window.startLimitsTrainer = startLimitsTrainer;
window.startMockExamSim = startMockExamSim;
window.startWeakExam = startWeakExam;
window.submitCalcAnswer = submitCalcAnswer;
window.submitIngAnswer = submitIngAnswer;
window.togglePomodoro = togglePomodoro;
window.toggleSolutionAccordion = toggleSolutionAccordion;
window.triggerImport = triggerImport;
// state.js의 saveProgress()가 `typeof updateGlobalStats === 'function'`로 참조하므로 노출 필요
// (모듈-대-모듈이라 window에 걸어야 bare typeof가 해석됨)
window.updateGlobalStats = updateGlobalStats;
window.checkStorageWarning = checkStorageWarning;

// data-click 위임에서 참조되지만 그동안 window에 노출되지 않아 배포판(CSP)에서 죽어 있던 핸들러들.
// (대시보드 과목 바로가기 · 오답노트 카드 제외 · 데일리 챌린지 전체)
window.startSubjectStudy = startSubjectStudy;
window.startSubjectQuiz = startSubjectQuiz;
window.removeWeakCard = removeWeakCard;
window.closeDailyModal = closeDailyModal;
window.nextDailyStep = nextDailyStep;
window.submitDailyCardAnswer = submitDailyCardAnswer;
window.submitDailyShortAnswer = submitDailyShortAnswer;


// 윈도우 로드 시 구동 (DOMContentLoaded 이미 완료 시 즉시 실행 대응)
function startAppInit() {
    initWebVitals();
    initApp();
    // DOM이 완전히 로드된 후 토글 버튼 설정
    setTimeout(() => {
        setupOrientationToggle();
    }, 100);
    // 진단: __APP_INITIALIZED가 설정되지 않았으면 화면에 표시
    setTimeout(() => {
        if (!window.__APP_INITIALIZED) {
            var d = document.createElement('div');
            d.className = 'nav-init-fail-banner';
            d.textContent = '네비게이션 초기화 실패 — 캐시 정리 후 새로고침 중... (15초 대기)';
            document.body.appendChild(d);
        }
    }, 2000);
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startAppInit);
} else {
    startAppInit();
}