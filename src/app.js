// app.js - 맞춤형화장품 조제관리사 학습 플랫폼 애플리케이션 로직
import { state, loadProgress, saveProgress, cleanOrphansForSubject } from './state.js';
import { escapeHTML, safeTextWithBreaks, esc } from './sanitize.js';
import { getChosung } from './utils.js';
import { formatSectionContentForReader } from './reader-format.js';
import { buildCalcQuestion } from './trainer-calc.js';
import { renderPerformanceChart, aggregateSubjectRates, renderPassFailDiagnosis, renderRadarChart } from './charts.js';
import { initScratchpadCanvas, clearScratchpad, toggleCalcScratchpad, toggleScratchpadEraser } from './scratchpad.js';
import { DataLoader } from './data-loader.js';
import { ExamViewer } from './exam-viewer.js';
import { ManualViewer } from './manual-viewer.js';

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
    startWeakFocusQuiz,
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
} from './views/quiz.js';
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
    togglePomodoro,
    tickPomodoro,
    resetPomodoro,
    updatePomodoroUI,
    renderCalcHistory,
    addCalcHistoryItem
} from './views/trainer.js';
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
    importData
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
    showLoading,
    hideLoading,
    showGlobalLoading,
    hideGlobalLoading
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
    showSimAnswerReview,
    showSimResultsSummary,
    startWeakExam
} from './views/exam-simulator.js';

// Re-export for quiz.js import compatibility
export { examIdToSubjectId };

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
            <button class="btn btn-secondary filter-btn active" data-filter="all" data-click="setReviewFilter" data-arg="all" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border-radius: 4px; background: var(--color-primary); border-color: var(--color-primary); color: #fff;">전체</button>
        `;
        subjects.forEach((subj, idx) => {
            const shortName = subj.name.replace('의 이해', '').replace(' 및 품질관리', '').replace('유통화장품 ', '');
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary filter-btn';
            btn.setAttribute('data-filter', subj.key);
            btn.setAttribute('data-click', 'setReviewFilter');
            btn.setAttribute('data-arg', subj.key);
            btn.style.cssText = 'padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border-radius: 4px;';
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
            const shortName = subj.name.replace('의 이해', '').replace(' 및 품질관리', '').replace('유통화장품 ', '');
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

function initApp() {
    // 한 단계가 실패해도 나머지 버튼 연결/렌더가 죽지 않도록 각 단계를 격리한다.
    // (배포 간 캐시 스큐로 특정 요소/바인딩이 어긋나도 앱이 통째로 벽돌이 되는 것 방지)
    const step = (label, fn) => { try { fn(); } catch (e) { console.error('[init] ' + label + ' 실패:', e); } };
    step('loadProgress', loadProgress);
    step('populateSubjectSelects', populateSubjectSelects);
    step('setupNavigation', setupNavigation);
    step('setupEventListeners', setupEventListeners);
    step('setupPWAInstall', setupPWAInstall);
    step('setupThemeToggle', setupThemeToggle);
    // 초기 뷰 렌더링
    step('renderDashboard', renderDashboard);
    step('updateGlobalStats', updateGlobalStats);
    step('refreshDashboardStatsInBackground', refreshDashboardStatsInBackground);
    step('checkExamDraft', checkExamDraft);
    // app-fallback.js가 정상 초기화를 감지할 수 있도록 마커 설정
    window.__APP_INITIALIZED = true;
}

// --- 가로/세로 보기 ---
// 실제 기기 회전 + 반응형 CSS가 가로/세로를 직접 처리하므로
// 별도 토글 버튼은 사용하지 않는다. 과거에 저장된 landscape-mode 잔존 상태만 정리한다.
function setupOrientationToggle() {
    document.body.classList.remove('landscape-mode');
    try { localStorage.removeItem('preferredOrientation'); } catch (e) {}
}

// 방향 전환 알림 표시
function showOrientationToast(isLandscape) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.orientation-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'orientation-toast';
    toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 1rem 1.5rem;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: orientationToastIn 0.3s ease;
    `;
    
    const icon = document.createElement('i');
    icon.className = isLandscape ? 'fa-solid fa-mobile-screen' : 'fa-solid fa-mobile-screen-button';
    icon.style.cssText = 'font-size: 1.5rem; color: var(--color-primary);';
    
    const text = document.createElement('span');
    text.textContent = isLandscape ? '가로 보기 모드' : '세로 보기 모드';
    text.style.cssText = 'font-weight: 600; color: var(--color-text-main);';
    
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
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');
    const viewTitle = document.getElementById('view-title');
    const viewSubtitle = document.getElementById('view-subtitle');
    
    const titlesMap = {
        'dashboard-view': { title: '학습 대시보드', subtitle: '2026 시험 합격을 위한 분석 및 스마트 툴' },
        'flashcard-view': { title: '개념 플래시카드', subtitle: 'Active Recall 학습법으로 효율적인 암기' },
        'quiz-view': { title: '기출 및 핵심 퀴즈', subtitle: '빈칸 채우기형 퀴즈로 실전 완벽 대비' },
        'review-view': { title: '오답 및 중요 복습', subtitle: '헷갈리거나 어려운 약점 카드 집중 복습' },
        'trainer-view': { title: '스마트 훈련소', subtitle: '법령 수치 암기 및 배합 계산 트레이닝 센터' },
        'exam-view': { title: '실전 예상문제집', subtitle: '과목별 100제 & 300제 예상 문제 및 해설 열람' },
        'textbook-view': { title: '교재 본문 검색', subtitle: '교재의 모든 본문 내용을 실시간 키워드로 검색' },
        'textbook-reader-view': { title: '교재 본문 읽기', subtitle: '과목과 단원을 선택하여 교재 본문을 읽기' },
        'dictionary-view': { title: '성분 검색 사전', subtitle: '화장품 성분별 배합한도 및 고시 기준 통합 검색기' }
    };
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            
            // 현재 뷰 스크롤 위치 저장
            saveScrollPosition(state.currentView);
            
            // 네비게이션 활성화 클래스 변경 (사이드바 + 모바일 탭 바 모두 동기화)
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // 모바일 탭 바 활성화 상태 동기화
            const mobileTabItems = document.querySelectorAll('.mobile-tab-item');
            mobileTabItems.forEach(tab => {
                tab.classList.remove('active');
                if (tab.getAttribute('data-target') === target) {
                    tab.classList.add('active');
                }
            });

            // 교재 읽기 집중 모드 해제 (다른 뷰로 이동 시)
            if (target !== 'textbook-reader-view' && document.body.classList.contains('reader-focus-mode')) {
                document.body.classList.remove('reader-focus-mode');
                const focusBtn = document.getElementById('reader-focus-toggle');
                if (focusBtn) {
                    focusBtn.classList.remove('active');
                    focusBtn.innerHTML = '<i class="fa-solid fa-expand"></i> <span>집중 모드</span>';
                }
            }

            // 리더 화면을 벗어나면 재생 중인 오디오 정지
            if (target !== 'textbook-reader-view' && typeof stopReaderAudio === 'function') {
                stopReaderAudio();
            }
            
            // 섹션 토글
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            
            // 헤더 텍스트 변경
            if (titlesMap[target]) {
                viewTitle.textContent = titlesMap[target].title;
                viewSubtitle.textContent = titlesMap[target].subtitle;
            }
            
            state.currentView = target;
            
            // 각 뷰 진입 시 렌더링 갱신
            if (target === 'dashboard-view') {
                renderDashboard();
                refreshDashboardStatsInBackground();
                checkExamDraft();
            } else if (target === 'flashcard-view') {
                showGlobalLoading('플래시카드를 불러오는 중입니다...');
                DataLoader.loadSubject(state.flashcards.subject).then(() => {
                    hideGlobalLoading();
                    loadFlashcards();
                }).catch(() => {
                    hideGlobalLoading();
                    loadFlashcards();
                });
            } else if (target === 'review-view') {
                showGlobalLoading('오답 및 중요 카드를 불러오는 중입니다...');
                const loaderPromises = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key));
                Promise.all(loaderPromises).then(() => {
                    hideGlobalLoading();
                    renderReviewList();
                }).catch(() => {
                    hideGlobalLoading();
                    renderReviewList();
                });
            } else if (target === 'trainer-view') {
                initTrainer();
            } else if (target === 'textbook-view') {
                showGlobalLoading('교재 검색용 데이터를 불러오는 중입니다...');
                const loaderPromises = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key));
                Promise.all(loaderPromises).then(() => {
                    hideGlobalLoading();
                    renderTextbookSearch();
                }).catch(() => {
                    hideGlobalLoading();
                    renderTextbookSearch();
                });
            } else if (target === 'textbook-reader-view') {
                if (textbookReaderState.selectedSubject) {
                    showGlobalLoading('교재 본문을 불러오는 중입니다...');
                    DataLoader.loadSubject(textbookReaderState.selectedSubject).then(() => {
                        hideGlobalLoading();
                        renderTextbookReader();
                    }).catch(() => {
                        hideGlobalLoading();
                        renderTextbookReader();
                    });
                } else {
                    renderTextbookReader();
                }
            } else if (target === 'dictionary-view') {
                showGlobalLoading('성분 사전을 불러오는 중입니다...');
                DataLoader.loadIngredients().then(() => {
                    hideGlobalLoading();
                    renderDictionary();
                }).catch(() => {
                    hideGlobalLoading();
                    renderDictionary();
                });
            }
            
            // 새 뷰 스크롤 위치 복원
            restoreScrollPosition(target);
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

// 외부에서 특정 뷰로 전환하는 유틸리티
export function switchView(targetView) {
    // 리더 화면을 벗어나면 재생 중인 오디오 정지
    if (targetView !== 'textbook-reader-view' && typeof stopReaderAudio === 'function') {
        stopReaderAudio();
    }
    
    // 현재 뷰 스크롤 위치 저장
    saveScrollPosition(state.currentView);
    
    const navItem = document.querySelector(`.nav-item[data-target="${targetView}"]`);
    if (navItem) {
        navItem.click();
    }
    
    // 새 뷰 스크롤 위치 복원
    restoreScrollPosition(targetView);
}

// ============================================================
// 모바일 UX 개선: 스크롤 위치 저장/복원
// ============================================================
const scrollPositions = {};

function saveScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        scrollPositions[viewId] = mainContent.scrollTop;
    }
}

function restoreScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent && scrollPositions[viewId] !== undefined) {
        // DOM 렌더링 완료 후 복원
        requestAnimationFrame(() => {
            mainContent.scrollTop = scrollPositions[viewId];
        });
    }
}

// ============================================================
// 모바일 UX 개선: 오프라인 감지 및 배너 표시
// ============================================================
function setupOfflineDetection() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    // 설치형(standalone)에서는 온라인인데도 navigator.onLine이 false로
    // 보고되는 사례가 있어(특히 iOS) 판정을 더 보수적으로 한다.
    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    let probeInFlight = false;
    let failStreak = 0;
    const FAIL_THRESHOLD = isStandalone ? 4 : 3; // 오탐 억제: 임계치 상향
    const PROBE_TIMEOUT = 8000;
    const WAKE_GRACE_MS = 15000;                  // 콜드스타트/절전복귀 유예 확대
    let checkIntervalId = null;
    let isOfflineMode = false;
    let lastWakeTime = Date.now();

    function showBanner() {
        if (isOfflineMode) return;
        banner.classList.add('show');
        isOfflineMode = true;
        resetCheckInterval(5000);
    }
    function hideBanner() {
        banner.classList.remove('show');
        failStreak = 0;
        isOfflineMode = false;
        resetCheckInterval(30000);
    }

    /**
     * 실제 네트워크 도달 여부 확인.
     *  1) navigator.onLine === true  → 온라인으로 신뢰, 배너 억제 (설치본 onLine=false 오탐 방향만 무시)
     *  2) navigator.onLine === false → 곧바로 단정하지 않고 ping.txt 프로브로 최종 확인
     * (cache 옵션은 일부 웹뷰와 충돌하므로 쿼리스트링으로만 캐시 우회)
     */
    async function checkReachable() {
        if (location.protocol === 'file:') return true;
        if (navigator.onLine === true) return true;
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
            const res = await fetch(`./ping.txt?_probe=${Date.now()}`, { signal: controller.signal });
            clearTimeout(t);
            return !!(res && res.ok);
        } catch (e) {
            console.warn("Offline detection probe failed:", e);
            return false;
        }
    }

    async function probeConnectivity() {
        if (probeInFlight) return;
        probeInFlight = true;
        try {
            const ok = await checkReachable();
            if (ok) { hideBanner(); return; }

            // 콜드스타트/절전복귀 직후에는 통신칩/Wi-Fi 재연결 중일 수 있어
            // isOfflineMode 여부와 무관하게 유예 동안 실패를 누적하지 않고 재시도.
            const sinceWake = Date.now() - lastWakeTime;
            if (sinceWake < WAKE_GRACE_MS) {
                setTimeout(probeConnectivity, 3000);
                return;
            }
            failStreak++;
            if (failStreak >= FAIL_THRESHOLD) {
                showBanner();
            } else {
                setTimeout(probeConnectivity, 2500);
            }
        } finally {
            probeInFlight = false;
        }
    }

    function resetCheckInterval(ms) {
        if (checkIntervalId) clearInterval(checkIntervalId);
        checkIntervalId = setInterval(probeConnectivity, ms);
    }

    // online/offline 이벤트는 실제 프로브로 재확인
    window.addEventListener('online', () => { failStreak = 0; hideBanner(); });
    window.addEventListener('offline', () => { lastWakeTime = Date.now(); probeConnectivity(); });

    // 화면 활성화(슬립 복귀) 시 유예 리셋 후 즉시 프로브
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            lastWakeTime = Date.now();
            failStreak = 0;
            probeConnectivity();
        }
    });

    // 초기 상태
    hideBanner();
    setTimeout(probeConnectivity, 5000); // 콜드스타트 유예: 첫 확인을 넉넉히 지연
}

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
                    const isVisible = target.style.display !== 'none' &&
                                     target.style.display !== '' ||
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
                if (modal.style.display !== 'none' && modal.style.display !== '') {
                    modal.style.display = 'none';
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
    setupOfflineDetection();
    setupModalBackHandler();
};

// --- 이벤트 리스너 정의 ---
function setupEventListeners() {
    // 1. 진도 초기화 버튼
    document.getElementById('reset-progress-btn').addEventListener('click', () => {
        if (confirm("정말 모든 학습 진도를 초기화하시겠습니까?\n외운 카드, 오답 정보, 모의고사 성적 이력, 연속 학습일, 계산 기록이 모두 지워집니다.")) {
            // 인메모리 상태 초기화
            state.memorizedCards.clear();
            state.weakCards.clear();
            state.quizResults = {};
            state.trainer.pomodoro.totalTimeToday = 0;
            
            // 로컬스토리지에 남아있는 모든 학습 데이터 키 제거
            const keysToRemove = [
                'fc_memorized',
                'fc_weak',
                'quiz_results',
                'sim_results_history',
                'sim_draft_session',
                'pomo_total_time',
                'pomo_total_time_date',
                'study_streak',
                'study_streak_last_date',
                'calc_history'
            ];
            keysToRemove.forEach(k => localStorage.removeItem(k));
            
            // 날짜 기반 동적 키(daily_completed_*) 일괄 제거
            const dynamicKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('daily_completed_')) {
                    dynamicKeys.push(key);
                }
            }
            dynamicKeys.forEach(k => localStorage.removeItem(k));
            
            saveProgress();
            
            // 현재 활성화 뷰 새로고침
            if (state.currentView === 'dashboard-view') renderDashboard();
            else if (state.currentView === 'flashcard-view') loadFlashcards();
            else if (state.currentView === 'review-view') renderReviewList();
            
            alert("학습 진도가 모두 초기화되었습니다.");
        }
    });
    
    // 2. 플래시카드 이벤트
    const cardEl = document.getElementById('flashcard-item');
    cardEl.addEventListener('click', () => {
        cardEl.classList.toggle('flipped');
    });
    
    document.getElementById('fc-subject-select').addEventListener('change', (e) => {
        state.flashcards.subject = e.target.value;
        state.flashcards.currentIndex = 0;
        DataLoader.loadSubject(e.target.value).then(() => {
            loadFlashcards();
        }).catch(() => loadFlashcards());
    });
    
    document.getElementById('fc-key-only').addEventListener('change', (e) => {
        state.flashcards.keyOnly = e.target.checked;
        state.flashcards.currentIndex = 0;
        loadFlashcards();
    });
    
    document.getElementById('fc-prev-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.flashcards.data.length === 0) return;
        state.flashcards.currentIndex--;
        if (state.flashcards.currentIndex < 0) {
            state.flashcards.currentIndex = state.flashcards.data.length - 1;
        }
        renderFlashcard();
    });
    
    document.getElementById('fc-next-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.flashcards.data.length === 0) return;
        state.flashcards.currentIndex++;
        if (state.flashcards.currentIndex >= state.flashcards.data.length) {
            state.flashcards.currentIndex = 0;
        }
        renderFlashcard();
    });
    
    document.getElementById('fc-easy-btn').addEventListener('click', () => {
        const fc = state.flashcards;
        if (fc.data.length === 0) return;
        const currentCard = fc.data[fc.currentIndex];
        
        state.memorizedCards.add(currentCard.id);
        state.weakCards.delete(currentCard.id);
        saveProgress();
        
        // 시각 효과 피드백 후 다음 카드로
        document.getElementById('fc-easy-btn').style.transform = 'scale(1.05)';
        setTimeout(() => {
            document.getElementById('fc-easy-btn').style.transform = 'scale(1)';
            document.getElementById('fc-next-btn').click();
        }, 150);
    });
    
    document.getElementById('fc-hard-btn').addEventListener('click', () => {
        const fc = state.flashcards;
        if (fc.data.length === 0) return;
        const currentCard = fc.data[fc.currentIndex];
        
        state.weakCards.add(currentCard.id);
        state.memorizedCards.delete(currentCard.id);
        saveProgress();
        
        // 시각 효과 피드백 후 다음 카드로
        document.getElementById('fc-hard-btn').style.transform = 'scale(1.05)';
        setTimeout(() => {
            document.getElementById('fc-hard-btn').style.transform = 'scale(1)';
            document.getElementById('fc-next-btn').click();
        }, 150);
    });
    
    // 3. 퀴즈 이벤트
    document.getElementById('quiz-subject-select').addEventListener('change', (e) => {
        state.quiz.subject = e.target.value;
    });
    
    document.getElementById('start-quiz-btn').addEventListener('click', () => {
        showGlobalLoading('퀴즈 데이터를 불러오는 중입니다...');
        DataLoader.loadSubject(state.quiz.subject).then(() => {
            hideGlobalLoading();
            startQuiz();
        }).catch(() => {
            hideGlobalLoading();
            startQuiz();
        });
    });
    
    document.getElementById('submit-quiz-btn').addEventListener('click', () => {
        submitQuizAnswer();
    });
    
    // 엔터키 정답 제출 대응
    document.getElementById('quiz-answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const submitBtn = document.getElementById('submit-quiz-btn');
            const nextBtn = document.getElementById('next-quiz-btn');
            
            if (submitBtn.style.display !== 'none') {
                submitQuizAnswer();
            } else if (nextBtn.style.display !== 'none') {
                nextQuizQuestion();
            }
        }
    });
    
    document.getElementById('next-quiz-btn').addEventListener('click', () => {
        nextQuizQuestion();
    });
    
    document.getElementById('retry-quiz-btn').addEventListener('click', () => {
        startQuiz();
    });
    
    document.getElementById('back-to-dashboard-btn').addEventListener('click', () => {
        switchView('dashboard-view');
    });
    
    // 4. 오답 퀴즈 이벤트 바인딩
    document.getElementById('start-weak-quiz-btn').addEventListener('click', () => {
        startWeakFocusQuiz();
    });

    // 5. 모의고사 시뮬레이터 이벤트 바인딩
    document.getElementById('sim-prev-btn').addEventListener('click', () => {
        if (simState.currentIndex > 0) {
            simState.currentIndex--;
            renderSimQuestion();
        }
    });
    
    document.getElementById('sim-next-btn').addEventListener('click', () => {
        if (simState.currentIndex < simState.data.questions.length - 1) {
            simState.currentIndex++;
            renderSimQuestion();
        }
    });
    
    document.getElementById('sim-submit-exam-btn').addEventListener('click', () => {
        if (confirm("정말로 답안지를 제출하고 시험을 종료하시겠습니까?")) {
            submitExam();
        }
    });
    
    // 6. 성분 검색 사전 실시간 검색 이벤트 디바운스 바인딩
    const dictSearchInput = document.getElementById('dict-search-input');
    if (dictSearchInput) {
        dictSearchInput.addEventListener('input', debounce(filterDictionary, 250));
    }

    // 7. HTML 내 인라인 onclick 제거 대응을 위한 data-click 위임 이벤트 바인딩
    document.body.addEventListener('click', (e) => {
        const el = e.target.closest('[data-click]');
        if (!el) return;

        const handlerName = el.getAttribute('data-click');
        const arg = el.getAttribute('data-arg');

        // A 태그나 href="#" 태그일 경우 기본 동작 차단
        if (el.tagName === 'A' || el.getAttribute('href') === '#') {
            e.preventDefault();
        }

        // 전역 범위(window)에서 함수 찾기 (ManualViewer.openManual 등의 네임스페이스 포함)
        let handler = window;
        const parts = handlerName.split('.');
        for (const part of parts) {
            if (handler) handler = handler[part];
        }

        if (typeof handler === 'function') {
            if (arg !== null) {
                handler(arg);
            } else {
                handler();
            }
        } else {
            console.error(`Handler not found: ${handlerName}`);
        }
    });
}


// 디바운스 유틸리티 함수
function debounce(func, delay = 150) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

/* =======================================================
   🖨️ 오답노트 인쇄 (Print Handler)
   ======================================================= */
function startFocusSubjectStudy(subKey) {
    DataLoader.loadSubject(subKey).then(() => {
        if (typeof STUDY_DATA !== 'undefined' && STUDY_DATA[subKey]) {
            const subj = STUDY_DATA[subKey];
            state.quiz.data = [...subj.quizzes].sort(() => 0.5 - Math.random()).slice(0, 10);
            state.quiz.currentIndex = 0;
            state.quiz.correctCount = 0;
            state.quiz.solvedList = [];
            
            // 퀴즈 화면 초기화 및 활성화
            document.getElementById('quiz-setup-panel').style.display = 'none';
            document.getElementById('quiz-result-panel').style.display = 'none';
            document.getElementById('quiz-arena-panel').style.display = 'block';
            document.getElementById('quiz-q-category').textContent = subj.name;
            
            renderQuizQuestion();
            
            // 퀴즈 탭 활성화
            switchView('quiz-view');
        }
    }).catch(err => {
        console.error(err);
        alert("퀴즈 데이터를 로드하지 못했습니다.");
    });
}



function printReviewNotes() {
    window.print();
}

// --- Textbook Reader 모듈은 ./views/textbook-reader.js로 추출됨 ---


function setupPWAInstall() {
    let deferredPrompt = window.__deferredPrompt || null;
    const installBtn = document.getElementById('pwa-install-btn');
    
    console.log('[PWA] 설치 버튼 초기화:', installBtn ? '발견됨' : '발견되지 않음');
    console.log('[PWA] 조기 캡처된 deferredPrompt:', deferredPrompt ? '있음' : '없음');

    // 이미 설치된 경우 버튼 숨기기 (즉시 실행)
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        console.log('[PWA] 이미 설치된 상태입니다.');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
        return;
    }

    // 이미 조기 캡처된 이벤트가 있으면 버튼 즉시 표시
    if (deferredPrompt && installBtn) {
        installBtn.style.display = 'inline-flex';
    }

    // beforeinstallprompt 이벤트 추가 캡처 (조기 캡처가 놓친 경우 대비)
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('[PWA] beforeinstallprompt 이벤트 발생');
        e.preventDefault();
        deferredPrompt = e;
        window.__deferredPrompt = e;
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
            installBtn.innerHTML = '<i class="fa-solid fa-download"></i> <span class="btn-text">앱 설치</span>';
            console.log('[PWA] 설치 버튼 표시됨');
        }
    });

    // 조기 캡처 이벤트가 나중에 도착하는 경우 대비
    window.addEventListener('pwa-install-available', () => {
        deferredPrompt = window.__deferredPrompt;
        if (installBtn && deferredPrompt) {
            installBtn.style.display = 'inline-flex';
            console.log('[PWA] 조기 캡처 이벤트 감지 — 설치 버튼 표시');
        }
    });

    // 설치 안내 모달 제어 (iOS/Android 분기)
    const installModal = document.getElementById('pwa-install-modal');
    const guideAndroid = document.getElementById('pwa-guide-android');
    const guideIos = document.getElementById('pwa-guide-ios');
    const guideGeneric = document.getElementById('pwa-guide-generic');
    const modalCloseBtn = document.getElementById('pwa-modal-close');
    const modalBackdrop = document.getElementById('pwa-modal-backdrop');

    function detectPlatform() {
        const ua = navigator.userAgent || '';
        if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
            return 'ios';
        }
        if (/android/i.test(ua)) {
            return 'android';
        }
        return 'generic';
    }

    async function openInstallModal() {
        if (!installModal) return;
        const platform = detectPlatform();
        console.log('[PWA] 설치 안내 모달 표시 - 플랫폼:', platform);
        if (guideAndroid) guideAndroid.style.display = platform === 'android' ? 'block' : 'none';
        if (guideIos) guideIos.style.display = platform === 'ios' ? 'block' : 'none';
        if (guideGeneric) guideGeneric.style.display = platform === 'generic' ? 'block' : 'none';

        // 진단 정보 수집 및 표시
        const diagEl = document.getElementById('pwa-diagnostics');
        const diagContent = document.getElementById('pwa-diag-content');
        if (diagEl && diagContent) {
            const lines = [];
            lines.push('• beforeinstallprompt 캡처: ' + (window.__deferredPrompt ? '성공' : '실패'));
            lines.push('• SW 조기 등록: ' + (window.__swRegistered ? '성공' : '미확인'));
            lines.push('• display-mode standalone: ' + window.matchMedia('(display-mode: standalone)').matches);
            lines.push('• navigator.standalone: ' + window.navigator.standalone);
            lines.push('• UA: ' + (navigator.userAgent || '').substring(0, 80));

            // SW 활성 상태 확인
            if ('serviceWorker' in navigator) {
                try {
                    const reg = await navigator.serviceWorker.getRegistration();
                    lines.push('• SW 등록: ' + (reg ? '있음' : '없음'));
                    if (reg) {
                        lines.push('• SW 상태: ' + (reg.active ? reg.active.state : '비활성'));
                    }
                } catch (e) {
                    lines.push('• SW 조회 실패: ' + e.message);
                }
            } else {
                lines.push('• ServiceWorker API: 미지원');
            }

            // getInstalledRelatedApps 확인 (지원하는 경우)
            if (navigator.getInstalledRelatedApps) {
                try {
                    const apps = await navigator.getInstalledRelatedApps();
                    lines.push('• 설치된 관련 앱: ' + (apps.length > 0 ? apps.map(a => a.id).join(', ') : '없음'));
                } catch (e) {
                    lines.push('• getInstalledRelatedApps 실패: ' + e.message);
                }
            }

            // manifest 링크 검증
            const manifestLink = document.querySelector('link[rel="manifest"]');
            if (manifestLink) {
                lines.push('• manifest href: ' + manifestLink.getAttribute('href'));
                try {
                    const resp = await fetch(manifestLink.getAttribute('href'), { cache: 'no-cache' });
                    lines.push('• manifest fetch: ' + resp.status + ' ' + resp.statusText);
                    lines.push('• manifest Content-Type: ' + resp.headers.get('Content-Type'));
                    if (resp.ok) {
                        const json = await resp.json();
                        lines.push('• manifest name: ' + (json.name || '없음'));
                        lines.push('• manifest icons: ' + (json.icons ? json.icons.length + '개' : '없음'));
                        lines.push('• manifest display: ' + (json.display || '없음'));
                        lines.push('• manifest start_url: ' + (json.start_url || '없음'));
                    }
                } catch (e) {
                    lines.push('• manifest fetch 실패: ' + e.message);
                }
            } else {
                lines.push('• manifest link: 없음');
            }

            diagContent.textContent = lines.join('\n');
            diagEl.style.display = 'block';
        }

        installModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeInstallModal() {
        if (!installModal) return;
        installModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeInstallModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeInstallModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && installModal && installModal.style.display === 'flex') {
            closeInstallModal();
        }
    });

    // 설치 버튼 클릭 핸들러
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            console.log('[PWA] 설치 버튼 클릭됨');
            // window.__deferredPrompt에서 최신 값 동기화
            if (!deferredPrompt && window.__deferredPrompt) {
                deferredPrompt = window.__deferredPrompt;
                console.log('[PWA] window.__deferredPrompt에서 복구');
            }
            if (!deferredPrompt) {
                // 진단 정보 출력
                console.log('[PWA] beforeinstallprompt 미발생 — 진단:');
                console.log('[PWA]   SW 등록:', window.__swRegistered ? '성공' : '실패/미등록');
                console.log('[PWA]   display-mode standalone:', window.matchMedia('(display-mode: standalone)').matches);
                console.log('[PWA]   navigator.standalone:', window.navigator.standalone);
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistration().then(reg => {
                        console.log('[PWA]   SW 활성 상태:', reg ? reg.active?.state : '등록 없음');
                    }).catch(e => console.log('[PWA]   SW 조회 실패:', e));
                }
                // 플랫폼별 설치 안내 모달 표시
                openInstallModal();
                return;
            }
            // 설치 프롬프트 표시
            deferredPrompt.prompt();
            // 사용자 선택 대기
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[PWA] 설치 프롬프트 결과:', outcome);
            // 프롬프트 사용 후 초기화
            deferredPrompt = null;
            // 버튼 숨기기
            installBtn.style.display = 'none';
        });
    }

    // 앱 설치 완료 감지
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] 앱이 설치되었습니다.');
        deferredPrompt = null;
        window.__deferredPrompt = null;
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    });

    // 서비스 워커 등록은 pwa-install-capture.js(<head>)에서 조기 실행됨.
    // 여기서 중복 등록하지 않음 (navigator.serviceWorker.register는 동일 scope면 재등록 무해하지만 불필요).
}

function setupThemeToggle() {
    var root = document.documentElement;
    var meta = document.querySelector('meta[name="theme-color"]');
    function isLight() { return root.classList.contains('light-theme'); }
    function apply(light) {
        root.classList.toggle('light-theme', light);
        if (meta) meta.setAttribute('content', light ? '#f5f7fa' : '#0b0f19');
        try { localStorage.setItem('appTheme', light ? 'light' : 'dark'); } catch (e) {}
        // 리더 등 다른 모듈이 동일한 테마 상태를 공유하도록 이벤트 브로드캐스트
        document.dispatchEvent(new CustomEvent('themechange', { detail: { light: light } }));
    }
    function toggle() { apply(!isLight()); }
    // 전역 테마 API 노출 (단일 소스 오브 트루스)
    window.AppTheme = { isLight: isLight, apply: apply, toggle: toggle };

    var btn = document.getElementById('theme-toggle-btn');
    function syncHeaderBtn() {
        if (!btn) return;
        var i = btn.querySelector('i');
        if (i) i.className = isLight() ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        btn.title = isLight() ? '다크 모드로 전환' : '라이트 모드로 전환';
    }
    syncHeaderBtn();
    document.addEventListener('themechange', syncHeaderBtn);
    if (btn) btn.addEventListener('click', toggle);

    // 모바일 하단 탭 바의 테마 토글
    var mBtn = document.getElementById('mobile-theme-toggle');
    function syncMobileBtn() {
        if (!mBtn) return;
        var i = mBtn.querySelector('i');
        if (i) i.className = isLight() ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    syncMobileBtn();
    document.addEventListener('themechange', syncMobileBtn);
    if (mBtn) mBtn.addEventListener('click', toggle);

    // 사용자가 수동 선택하지 않았을 때만 시스템 테마 변경을 따라감
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: light)');
        var onChange = function (e) {
            if (localStorage.getItem('appTheme')) return;
            apply(e.matches);
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }
}


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
// index.html의 인라인 onchange="importData(event)"가 전역 스코프에서 평가되므로 노출 필요
// (app.js가 ES 모듈이라 함수 선언이 더 이상 전역이 아님)
window.importData = importData;
// state.js의 saveProgress()가 `typeof updateGlobalStats === 'function'`로 참조하므로 노출 필요
// (모듈-대-모듈이라 window에 걸어야 bare typeof가 해석됨)
window.updateGlobalStats = updateGlobalStats;


// 윈도우 로드 시 구동 (DOMContentLoaded 이미 완료 시 즉시 실행 대응)
function startAppInit() {
    initApp();
    // DOM이 완전히 로드된 후 토글 버튼 설정
    setTimeout(() => {
        setupOrientationToggle();
    }, 100);
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startAppInit);
} else {
    startAppInit();
}