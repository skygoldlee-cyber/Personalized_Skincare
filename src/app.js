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
// [개선안 1-2] 빌드 산출물(레지스트리·오디오 매니페스트)을 window 전역 대신 정적 ESM import 로 참조.
import { DATA_REGISTRY } from '../data/registry.js';
import { AUDIO_MANIFEST, getAudioUrl } from '../data/audio_manifest.js';

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
// 모바일 UX 개선: 로딩 상태 표시
// ============================================================
function showLoading(containerId, message = '로딩 중...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--color-text-muted);">
            <div class="spinner" style="width: 40px; height: 40px; border: 3px solid var(--border-color); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
            <p>${message}</p>
        </div>
    `;
}

function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const loading = container.querySelector('.loading-state');
    if (loading) {
        loading.remove();
    }
}

// 글로벌 로딩 오버레이 제어 함수 (DOM 파괴 방지용)
function showGlobalLoading(message = '로딩 중...') {
    let overlay = document.getElementById('global-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(11, 15, 25, 0.7);
            backdrop-filter: blur(5px);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            transition: opacity 0.2s ease;
        `;
        overlay.innerHTML = `
            <div class="spinner" style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1.25rem;"></div>
            <p id="global-loading-message" style="font-weight: 600; font-size: 1.05rem; margin: 0;"></p>
        `;
        document.body.appendChild(overlay);
    }
    document.getElementById('global-loading-message').textContent = message;
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
}

function hideGlobalLoading() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 200);
    }
}

// 스피너 애니메이션을 위한 CSS 추가
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(spinnerStyle);

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

// --- 5. 실전 모의고사 시뮬레이터 구현 ---
let simState = {
    examId: '',
    data: null,
    currentIndex: 0,
    userAnswers: {},
    timeLeft: 7200,
    timerInterval: null,
    wrongQuestions: []
};

function startSimSession(examData) {
    // 시뮬레이터 상태 초기화
    simState.examId = examData.id || 'dynamic';
    simState.data = examData;
    simState.currentIndex = 0;
    simState.userAnswers = {};
    simState.timeLeft = examData.questions.length * 60; // 문항당 1분 기산
    simState.wrongQuestions = [];

    // UI 전환
    document.getElementById('exam-list-panel').style.display = 'none';
    document.getElementById('sim-result-panel').style.display = 'none';
    document.getElementById('sim-review-panel').style.display = 'none';
    document.getElementById('sim-arena-panel').style.display = 'block';

    // 타이머 및 OMR 렌더링
    document.getElementById('sim-exam-title').textContent = examData.title;
    renderOMRSheet();
    renderSimQuestion();

    // 기존 타이머 중지 후 신규 시작
    startSimTimer();
}

function startMockExamSim(examId) {
    showGlobalLoading('모의고사 데이터를 불러오는 중입니다...');
    DataLoader.loadExam(examId).then((examData) => {
        hideGlobalLoading();
        startSimSession(examData);
    }).catch(err => {
        hideGlobalLoading();
        console.error(err);
        alert("모의고사 데이터를 로드하지 못했습니다.");
    });
}

function startIntegratedMockExam() {
    showGlobalLoading('통합 모의고사 데이터를 불러오는 중입니다...');
    const loaderPromises = DataLoader.registry.exams.map(e => DataLoader.loadExam(e.key));
    Promise.all(loaderPromises).then(() => {
        hideGlobalLoading();
        _startIntegratedMockExamImpl();
    }).catch(err => {
        hideGlobalLoading();
        console.error(err);
        alert("모의고사 데이터를 로드하지 못했습니다.");
    });
}

function _startIntegratedMockExamImpl() {
    // 과목별 문제들 동적 수집 ( subject1, subject2_p1, subject4_p3 등 접두사 기준 자동 분류 )
    const s1Questions = [];
    const s2Questions = [];
    const s3Questions = [];
    const s4Questions = [];

    Object.keys(EXAM_DATA).forEach(examId => {
        const questions = EXAM_DATA[examId].questions || [];
        if (examId.startsWith('subject1')) {
            s1Questions.push(...questions);
        } else if (examId.startsWith('subject2')) {
            s2Questions.push(...questions);
        } else if (examId.startsWith('subject3')) {
            s3Questions.push(...questions);
        } else if (examId.startsWith('subject4')) {
            s4Questions.push(...questions);
        }
    });

    if (s1Questions.length === 0 || s2Questions.length === 0 || s3Questions.length === 0 || s4Questions.length === 0) {
        alert("모의고사 데이터가 불완전합니다. 모든 과목의 모의고사가 정상 로드되었는지 확인하세요.");
        return;
    }

    // 과목별 무작위 선택 함수
    const getRandomSample = (arr, count, subjectId) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).map(q => ({
            ...q,
            subject: subjectId // 과목 정보 태깅
        }));
    };

    const s1Selected = getRandomSample(s1Questions, 10, 'subject1');
    const s2Selected = getRandomSample(s2Questions, 25, 'subject2');
    const s3Selected = getRandomSample(s3Questions, 25, 'subject3');
    const s4Selected = getRandomSample(s4Questions, 40, 'subject4');

    // 100문항 결합
    const combinedQuestions = [
        ...s1Selected,
        ...s2Selected,
        ...s3Selected,
        ...s4Selected
    ];

    // 문항 번호를 1부터 100까지 순차적으로 재지정
    combinedQuestions.forEach((q, index) => {
        q.num = index + 1;
        q.id = `integrated_q${index + 1}`; 
    });

    const integratedExam = {
        id: 'integrated',
        title: '1~4과목 통합 실전 모의고사 (100제)',
        questions: combinedQuestions
    };

    // UI 전환
    state.currentView = 'exam-view';
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('review-view').classList.remove('active');
    document.getElementById('exam-view').classList.add('active');

    // OMR Sheet, Timer 활성화
    startSimSession(integratedExam);
}

function saveSimDraft() {
    if (!simState.data || !simState.data.questions) return;
    const draft = {
        examId: simState.examId,
        examTitle: simState.data.title,
        timeLeft: simState.timeLeft,
        userAnswers: simState.userAnswers,
        currentIndex: simState.currentIndex,
        questions: simState.data.questions
    };
    localStorage.setItem('sim_draft_session', JSON.stringify(draft));
}

function clearSimDraft() {
    localStorage.removeItem('sim_draft_session');
    const banner = document.getElementById('draft-resume-banner');
    if (banner) banner.style.display = 'none';
}

function checkExamDraft() {
    const banner = document.getElementById('draft-resume-banner');
    if (!banner) return;
    
    const saved = localStorage.getItem('sim_draft_session');
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            const minutes = Math.floor(draft.timeLeft / 60);
            const seconds = draft.timeLeft % 60;
            
            const titleEl = document.getElementById('draft-banner-title');
            const descEl = document.getElementById('draft-banner-desc');
            
            if (titleEl) titleEl.textContent = `📝 진행 중인 모의고사: ${draft.examTitle}`;
            if (descEl) descEl.textContent = `이전 진행 상태 복구 가능 (남은 시간: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}, 풀이한 문항: ${Object.keys(draft.userAnswers).length}/${draft.questions.length})`;
            
            banner.style.display = 'flex';
        } catch(e) {
            banner.style.display = 'none';
        }
    } else {
        banner.style.display = 'none';
    }
}

function resumeSimDraft() {
    const saved = localStorage.getItem('sim_draft_session');
    if (!saved) return;
    
    try {
        const draft = JSON.parse(saved);
        
        simState.examId = draft.examId;
        simState.data = {
            id: draft.examId,
            title: draft.examTitle,
            questions: draft.questions
        };
        simState.currentIndex = draft.currentIndex;
        simState.userAnswers = draft.userAnswers;
        simState.timeLeft = draft.timeLeft;
        simState.wrongQuestions = [];
        
        document.getElementById('exam-list-panel').style.display = 'none';
        document.getElementById('sim-result-panel').style.display = 'none';
        document.getElementById('sim-review-panel').style.display = 'none';
        document.getElementById('sim-arena-panel').style.display = 'block';

        document.getElementById('sim-exam-title').textContent = draft.examTitle;
        renderOMRSheet();
        renderSimQuestion();

        startSimTimer();
        
        // 메인 뷰 전환 강제 처리
        state.currentView = 'exam-view';
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(nav => {
            if (nav.getAttribute('data-target') === 'exam-view') {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });
        const sections = document.querySelectorAll('.view-section');
        sections.forEach(sec => {
            if (sec.id === 'exam-view') {
                sec.classList.add('active');
            } else {
                sec.classList.remove('active');
            }
        });
        
        const banner = document.getElementById('draft-resume-banner');
        if (banner) banner.style.display = 'none';
        
    } catch(e) {
        console.error("Failed to resume draft: ", e);
        alert("저장된 모의고사 세션을 불러오지 못했습니다.");
    }
}

function exitSimArena() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    
    // UI 전환
    document.getElementById('sim-arena-panel').style.display = 'none';
    document.getElementById('sim-result-panel').style.display = 'none';
    document.getElementById('sim-review-panel').style.display = 'none';
    document.getElementById('exam-list-panel').style.display = 'block';
    
    // 대시보드 갱신하여 배너 확인
    checkExamDraft();
}

/* =======================================================
    ⏱️ 시험 타이머 (백그라운드 탭 스로틀링 방지)
    * 단순 setInterval 초 차감 대신, 시작 시각의 절대 타임스탬프 차이(Date.now())
    * 기반으로 남은 시간을 계산하여, 백그라운드 탭 전환 시에도 실제 경과 시간이
    * 정확히 반영되도록 합니다. (뽀모도로 타이머와 동일한 방식)
    ======================================================= */
function startSimTimer() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    // 현재 남은 시간을 기준으로 종료 시각을 고정
    simState.endTime = Date.now() + (simState.timeLeft * 1000);
    simState.timerInterval = setInterval(tickSimTimer, 500); // 500ms 간격 갱신
    tickSimTimer();
}

function tickSimTimer() {
    // 절대 시각 기반 남은 시간 계산 (백그라운드 스로틀링 극복 핵심)
    const remaining = Math.max(0, Math.round((simState.endTime - Date.now()) / 1000));
    simState.timeLeft = remaining;
    
    if (simState.timeLeft <= 0) {
        clearInterval(simState.timerInterval);
        const timeEl = document.getElementById('sim-time-left');
        if (timeEl) timeEl.textContent = '00:00';
        alert("제한 시간이 만료되었습니다. 답안지가 자동 제출됩니다.");
        submitExam();
        return;
    }
    
    const minutes = Math.floor(simState.timeLeft / 60);
    const seconds = simState.timeLeft % 60;
    document.getElementById('sim-time-left').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
    // 매 5초마다 타이머 임시 저장
    if (simState.timeLeft % 5 === 0) {
        saveSimDraft();
    }
}

function renderOMRSheet() {
    const omrGrid = document.getElementById('omr-grid');
    omrGrid.innerHTML = '';
    
    const total = simState.data.questions.length;
    document.getElementById('omr-total-count').textContent = total;
    
    for (let i = 0; i < total; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'omr-bubble';
        bubble.id = `omr-b-${i}`;
        bubble.textContent = i + 1;
        bubble.addEventListener('click', () => {
            jumpToSimQuestion(i);
        });
        omrGrid.appendChild(bubble);
    }
    updateOMRProgress();
}

function updateOMRProgress() {
    let solvedCount = 0;
    const total = simState.data.questions.length;
    
    for (let i = 0; i < total; i++) {
        const qId = simState.data.questions[i].id;
        const bubble = document.getElementById(`omr-b-${i}`);
        
        if (bubble) {
            // 풀었는지 여부 확인
            if (simState.userAnswers[qId] && String(simState.userAnswers[qId]).trim() !== '') {
                bubble.classList.add('solved');
                solvedCount++;
            } else {
                bubble.classList.remove('solved');
            }
            
            // 현재 문제 활성화
            if (i === simState.currentIndex) {
                bubble.classList.add('active');
            } else {
                bubble.classList.remove('active');
            }
        }
    }
    
    document.getElementById('omr-solved-count').textContent = solvedCount;
}

function jumpToSimQuestion(index) {
    simState.currentIndex = index;
    renderSimQuestion();
}

function renderSimQuestion() {
    const q = simState.data.questions[simState.currentIndex];
    
    // 문제 정보 주입
    document.getElementById('sim-q-num').textContent = `Q ${simState.currentIndex + 1} / ${simState.data.questions.length}`;
    
    let typeName = '단답형';
    if (q.type === 'choice') typeName = '객관식 5지선다';
    else if (q.type === 'ox') typeName = '진위형 OX';
    document.getElementById('sim-q-type').textContent = typeName;
    
    // 개행 문자를 BR 태그로 치환해 질문 가독성 보장
    document.getElementById('sim-q-text').innerHTML = safeTextWithBreaks(q.question);
    
    // 옵션 컨테이너 채우기
    const container = document.getElementById('sim-options-container');
    container.innerHTML = '';
    
    const savedAns = simState.userAnswers[q.id] || '';
    
    if (q.type === 'choice') {
        const optionIndicators = ['①', '②', '③', '④', '⑤'];
        q.options.forEach((optText, idx) => {
            const ind = optionIndicators[idx] || String(idx + 1);
            const isSelected = (savedAns === ind);
            
            const btn = document.createElement('div');
            btn.className = `sim-option-item ${isSelected ? 'active' : ''}`;
            btn.innerHTML = `<span class="opt-num">${esc(ind)}</span> <span class="opt-text">${esc(optText)}</span>`;
            btn.addEventListener('click', () => {
                saveSimAnswer(q.id, ind);
            });
            container.appendChild(btn);
        });
    } else if (q.type === 'ox') {
        q.options.forEach(optVal => {
            const isSelected = (savedAns === optVal);
            const btn = document.createElement('div');
            btn.className = `sim-option-item ${isSelected ? 'active' : ''}`;
            btn.innerHTML = `<span class="opt-num"><i class="fa-solid ${optVal === 'O' ? 'fa-circle' : 'fa-xmark'}"></i></span> <span class="opt-text">${optVal} 퀴즈</span>`;
            btn.addEventListener('click', () => {
                saveSimAnswer(q.id, optVal);
            });
            container.appendChild(btn);
        });
    } else {
        // 단답형 빈칸 주관식
        const inputDiv = document.createElement('div');
        inputDiv.className = 'sim-input-wrapper';
        inputDiv.innerHTML = `
            <input type="text" id="sim-text-input" class="form-input" placeholder="정답을 입력하세요 (예: (A) 5, (B) 10)" value="${esc(savedAns)}" autocomplete="off">
        `;
        container.appendChild(inputDiv);
        
        const textInput = document.getElementById('sim-text-input');
        textInput.focus();
        
        // 입력 변경 감지
        textInput.addEventListener('input', (e) => {
            saveSimAnswer(q.id, e.target.value, false);
        });
        
        // 엔터키 누르면 다음 문제
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('sim-next-btn').click();
            }
        });
    }
    
    // 이전/다음 버튼 보이기 여부 및 제어
    const prevBtn = document.getElementById('sim-prev-btn');
    const nextBtn = document.getElementById('sim-next-btn');
    const submitBtn = document.getElementById('sim-submit-exam-btn');
    
    if (simState.currentIndex === 0) {
        prevBtn.style.visibility = 'hidden';
    } else {
        prevBtn.style.visibility = 'visible';
    }
    
    if (simState.currentIndex === simState.data.questions.length - 1) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-flex';
    } else {
        nextBtn.style.display = 'inline-flex';
        submitBtn.style.display = 'none';
    }
    
    updateOMRProgress();
}

function saveSimAnswer(qId, value, triggerRender = true) {
    simState.userAnswers[qId] = value;
    if (triggerRender) {
        renderSimQuestion();
    } else {
        updateOMRProgress();
    }
    saveSimDraft();
}

function submitExam() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    
    // 점수 채점 및 틀린 문항 수집
    let score = 0;
    const total = simState.data.questions.length;
    simState.wrongQuestions = [];
    
    // 과목별 정답 및 총 문제수 집계용 (레지스트리 기반 동적 초기화)
    const subjectScores = {};
    const subjects = (DATA_REGISTRY && DATA_REGISTRY.subjects) || [];
    subjects.forEach(sub => {
        subjectScores[sub.key] = { score: 0, total: 0 };
    });
    
    for (let i = 0; i < total; i++) {
        const q = simState.data.questions[i];
        const userAns = simState.userAnswers[q.id] || '';
        
        const isCorrect = checkShortAnswer(userAns, q.answer);
        
        if (isCorrect) {
            score++;
        } else {
            simState.wrongQuestions.push({
                ...q,
                userAnswer: userAns
            });
            
            // 틀린 문제는 복습용 오답 카드로 자동으로 등록! (중요 기능 요구사항 구현)
            const fakeCardId = `weak_sim_${q.id}`;
            state.weakCards.add(fakeCardId);
        }
        
        // 과목 판별 및 집계 (동적 변환 적용)
        let subj = q.subject;
        if (!subj) {
            const prefix = q.id.split('_')[0]; // 'subject1' 등
            subj = examIdToSubjectId(prefix);
        } else if (subj.startsWith('subject')) {
            subj = examIdToSubjectId(subj);
        }
        
        if (subj && subjectScores[subj]) {
            subjectScores[subj].total++;
            if (isCorrect) {
                subjectScores[subj].score++;
            }
        }
    }
    
    saveProgress();
    clearSimDraft(); // 제출 시 임시 세션 제거
    
    // 과목별 정답률 계산
    const subjectRates = {};
    let hasSubjectData = false;
    Object.keys(subjectScores).forEach(subj => {
        if (subjectScores[subj].total > 0) {
            subjectRates[subj] = Math.round((subjectScores[subj].score / subjectScores[subj].total) * 100);
            hasSubjectData = true;
        } else {
            subjectRates[subj] = null;
        }
    });
    
    // 모의고사 결과 성적 이력 저장 및 성적 분석 연동
    saveExamResultToHistory(simState.data.id, score, total, hasSubjectData ? subjectRates : null);
    
    // 결과 패널 세팅
    document.getElementById('sim-arena-panel').style.display = 'none';
    document.getElementById('sim-result-panel').style.display = 'block';
    
    document.getElementById('sim-result-score').textContent = `${score} / ${total} 개`;
    const rate = Math.round((score / total) * 100);
    document.getElementById('sim-result-rate').textContent = `${rate}%`;

    // 과목별 상세 보고서 생성 (신규 Feature 2)
    const breakdownContainer = document.getElementById('sim-result-breakdown');
    if (breakdownContainer) {
        breakdownContainer.innerHTML = '';
        
        let breakdownHTML = `<h4 style="margin-top: 0; margin-bottom: 1rem; color: #fff; font-size: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;"><i class="fa-solid fa-chart-pie color-primary" style="color: var(--color-primary);"></i> 과목별 성적 상세 분석</h4>`;
        breakdownHTML += `<div style="display: flex; flex-direction: column; gap: 0.75rem;">`;
        
        const subjNames = {};
        subjects.forEach((sub, idx) => {
            subjNames[sub.key] = `${idx + 1}과목: ${sub.name}`;
        });
        
        let failedSubjects = [];
        
        Object.keys(subjectScores).forEach(subj => {
            const data = subjectScores[subj];
            if (data.total > 0) {
                const subRate = Math.round((data.score / data.total) * 100);
                const isFail = subRate < 40;
                if (isFail) {
                    failedSubjects.push({ id: subj, name: subjNames[subj], rate: subRate });
                }
                
                const progressColor = isFail ? '#ef4444' : (subRate >= 60 ? '#10b981' : '#f59e0b');
                
                breakdownHTML += `
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                            <span style="font-weight: 600; color: #e5e7eb;">${esc(subjNames[subj])}</span>
                            <span style="color: ${progressColor}; font-weight: 700;">
                                ${data.score} / ${data.total} (${subRate}%)
                                ${isFail ? ' <span style="background:#ef4444; color:#fff; font-size:0.7rem; padding:1px 4px; border-radius:3px; margin-left:3px;">과락</span>' : ''}
                            </span>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow: hidden; width: 100%;">
                            <div style="background: ${progressColor}; width: ${subRate}%; height: 100%;"></div>
                        </div>
                    </div>
                `;
            }
        });
        
        breakdownHTML += `</div>`;
        
        // 과락 분석 및 추천 피드백
        if (failedSubjects.length > 0) {
            breakdownHTML += `
                <div style="margin-top: 1.25rem; padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px;">
                    <h5 style="margin: 0 0 0.5rem 0; color: #ef4444; font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> 과락 주의 경고!</h5>
                    <p style="margin: 0; font-size: 0.8rem; color: #fca5a5; line-height: 1.5;">
                        실제 시험 기준 한 과목이라도 40% 미만 득점 시 전체 평균이 60%를 넘어도 불합격 처리됩니다. 아래 추천 학습으로 약점을 빠르게 보완해 보세요.
                    </p>
                    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            `;
            
            failedSubjects.forEach(f => {
                const subKey = f.id;
                breakdownHTML += `
                    <button class="btn" onclick="startFocusSubjectStudy('${subKey}')" style="padding: 3px 8px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;">
                        <i class="fa-solid fa-bolt"></i> ${esc(f.name.split(':')[0])} 퀴즈 풀기
                    </button>
                `;
            });
            
            breakdownHTML += `
                    </div>
                </div>
            `;
        } else {
            // 합격 요건 확인
            const overallRate = Math.round((score / total) * 100);
            if (overallRate >= 60) {
                breakdownHTML += `
                    <div style="margin-top: 1.25rem; padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px;">
                        <h5 style="margin: 0 0 0.25rem 0; color: #10b981; font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-circle-check"></i> 합격 예측: 합격 안정권</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: #a7f3d0; line-height: 1.5;">
                            전체 정답률 60% 이상 및 모든 과목 과락 패스 요건을 완벽히 충족하셨습니다! 이 컨디션을 실제 시험장까지 유지해 보세요.
                        </p>
                    </div>
                `;
            } else {
                breakdownHTML += `
                    <div style="margin-top: 1.25rem; padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 6px;">
                        <h5 style="margin: 0 0 0.25rem 0; color: #f59e0b; font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-circle-exclamation"></i> 합격 예측: 전체 평균 미달</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: #fde68a; line-height: 1.5;">
                            과락은 면했으나 합격 커트라인인 전체 평균 60%에 도달하지 못했습니다. 오답 해설 풀이를 통해 부족한 이론을 보완해 보세요.
                        </p>
                    </div>
                `;
            }
        }
        
        breakdownContainer.innerHTML = breakdownHTML;
        breakdownContainer.style.display = 'block';
    }
}

export function examIdToSubjectId(examId) {
    const registry = DATA_REGISTRY;
    if (registry && registry.exams) {
        const exam = registry.exams.find(e => e.key === examId);
        if (exam) return exam.subject;
        // prefix 매칭 호환성 (예: subject2_p1 또는 subject2)
        const partialExam = registry.exams.find(e => examId.startsWith(e.key) || e.key.startsWith(examId));
        if (partialExam) return partialExam.subject;
    }
    // 구버전 호환성 하드코딩 폴백
    if (examId.startsWith('subject1')) return 'law';
    if (examId.startsWith('subject2')) return 'manufacturing';
    if (examId.startsWith('subject3')) return 'safety';
    if (examId.startsWith('subject4')) return 'understanding';
    
    if (registry && registry.subjects && registry.subjects.length > 0) {
        return registry.subjects[0].key;
    }
    return 'law';
}

function showSimAnswerReview() {
    document.getElementById('sim-result-panel').style.display = 'none';
    document.getElementById('sim-review-panel').style.display = 'block';
    
    const container = document.getElementById('sim-review-list-container');
    container.innerHTML = '';
    
    if (simState.wrongQuestions.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--color-success);"><i class="fa-solid fa-circle-check"></i> 만점입니다! 틀린 문제가 하나도 없습니다.</p>';
        return;
    }
    
    simState.wrongQuestions.forEach((q, idx) => {
        let optionsHTML = '';
        if (q.options && q.options.length > 0) {
            optionsHTML = `<ul class="review-q-options">
                ${q.options.map(opt => `<li>${esc(opt)}</li>`).join('')}
            </ul>`;
        }
        
        const itemHTML = `
            <div class="sim-review-item">
                <div class="review-item-header">
                    <span class="badge badge-quiz-cat">Q ${q.num}</span>
                    <span class="badge badge-quiz-type">${q.type === 'choice' ? '객관식' : q.type === 'ox' ? '진위형' : '단답형'}</span>
                </div>
                <p class="review-item-q-text">${safeTextWithBreaks(q.question)}</p>
                ${optionsHTML}
                <div class="review-answer-panel">
                    <p>❌ 내가 쓴 답: <strong class="color-danger">${esc(q.userAnswer || '(공란)')}</strong></p>
                    <p>✅ 올바른 정답: <strong class="color-success">${esc(q.answer)}</strong></p>
                </div>
                <div class="review-explanation-panel">
                    <h5>정답 해설 및 분석</h5>
                    <p>${safeTextWithBreaks(q.explanation)}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

function showSimResultsSummary() {
    document.getElementById('sim-review-panel').style.display = 'none';
    document.getElementById('sim-result-panel').style.display = 'block';
}




/* =======================================================
   📋 "틀린 문제만 모아 풀기" 오답 모의고사 (Weakness Exam)
   ======================================================= */
function startWeakExam() {
    const loaderPromises = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key));
    Promise.all(loaderPromises).then(() => {
        _startWeakExamImpl();
    }).catch(err => {
        console.error(err);
        alert("복습 데이터를 로드하지 못했습니다.");
    });
}

function _startWeakExamImpl() {
    // 헷갈린 카드나 오답 데이터 로딩
    let weakCards = Array.from(state.weakCards);
    let solvedQuizzes = Object.keys(state.quizResults).filter(id => !state.quizResults[id].correct);
    
    // 필터링 적용 (신규 Feature 3)
    if (state.reviewFilter && state.reviewFilter !== 'all') {
        weakCards = weakCards.filter(cardId => {
            if (cardId.startsWith('weak_sim_')) {
                const parts = cardId.replace('weak_sim_', '').split('_q');
                if (parts.length === 2) {
                    const targetSub = examIdToSubjectId(parts[0]);
                    return targetSub === state.reviewFilter;
                }
            } else {
                for (const subjId of Object.keys(STUDY_DATA)) {
                    if (STUDY_DATA[subjId].cards.some(c => c.id === cardId)) {
                        return subjId === state.reviewFilter;
                    }
                }
            }
            return false;
        });
        
        solvedQuizzes = solvedQuizzes.filter(quizId => {
            for (const subjId of Object.keys(STUDY_DATA)) {
                if (STUDY_DATA[subjId].quizzes.some(q => q.id === quizId)) {
                    return subjId === state.reviewFilter;
                }
            }
            return false;
        });
    }
    
    if (weakCards.length === 0 && solvedQuizzes.length === 0) {
        const filterNames = {};
        const subjects = (DATA_REGISTRY && DATA_REGISTRY.subjects) || [];
        subjects.forEach((sub, idx) => {
            const shortName = sub.name.replace('의 이해', '').replace(' 및 품질관리', '').replace('유통화장품 ', '');
            filterNames[sub.key] = `${idx + 1}과목 (${shortName})`;
        });
        const filterName = filterNames[state.reviewFilter] || '선택한 과목';
        alert(`복습할 헷갈린 카드나 오답 퀴즈가 없습니다! (${filterName})\n플래시카드나 기출 퀴즈를 학습하여 약점 데이터를 모아보세요.`);
        return;
    }
    
    // 모의고사 구조로 질문 조립 (최대 20개 추출)
    const questions = [];
    
    // 1. 헷갈린 카드로부터 질문 생성
    weakCards.forEach(cardId => {
        // Find card in STUDY_DATA
        let cardObj = null;
        let subject = '';
        for (const subjId of Object.keys(STUDY_DATA)) {
            const found = STUDY_DATA[subjId].cards.find(c => c.id === cardId);
            if (found) {
                cardObj = found;
                subject = subjId;
                break;
            }
        }
        
        if (cardObj) {
            questions.push({
                id: `weak_card_${cardObj.id}`,
                subject: subject,
                type: 'blank',
                question: `[용어 정의] 다음 설명이 뜻하는 개념은 무엇입니까?\n설명: ${cardObj.definition}`,
                answer: cardObj.term,
                explanation: `정의: ${cardObj.definition}\n용어: ${cardObj.term}`
            });
        }
    });
    
    // 2. 오답 기출 퀴즈로부터 질문 생성
    solvedQuizzes.forEach(quizId => {
        let quizObj = null;
        let subject = '';
        for (const subjId of Object.keys(STUDY_DATA)) {
            const found = STUDY_DATA[subjId].quizzes.find(q => q.id === quizId);
            if (found) {
                quizObj = found;
                subject = subjId;
                break;
            }
        }
        
        if (quizObj) {
            questions.push({
                id: `weak_quiz_${quizObj.id}`,
                subject: subject,
                type: quizObj.type,
                question: quizObj.question,
                answer: quizObj.answer,
                options: quizObj.options || null,
                explanation: `기존 문제에 포함된 오답 기출 연동 퀴즈입니다.`
            });
        }
    });
    
    // 무작위로 섞어서 20문항으로 자르기
    const shuffled = questions.sort(() => 0.5 - Math.random()).slice(0, 20);
    
    // 모의고사 세션 구동
    const mockExam = {
        title: '헷갈린 문제 집중 오답 모의고사 (20제)',
        questions: shuffled
    };
    
    // OMR 및 타이머 제어용 데이터 이식
    state.currentView = 'exam-view';
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('review-view').classList.remove('active');
    document.getElementById('exam-view').classList.add('active');
    
    // OMR Sheet, Timer 활성화
    startSimSession(mockExam);
}


/* =======================================================
   💾 로컬 데이터 백업 및 복원 (Data Backup & Restore)
   ======================================================= */
function getBackupKeys() {
    // 정적 키 목록 + 날짜 기반 동적 키(daily_completed_YYYY-MM-DD)를 모두 수집
    const staticKeys = [
        'fc_memorized',
        'fc_weak',
        'quiz_results',
        'sim_results_history',
        'sim_draft_session',
        'pomo_total_time',
        'pomo_total_time_date',
        'study_streak',
        'study_streak_last_date',
        'calc_history',
        'fc_migrated_v2'
    ];
    const dynamicKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('daily_completed_')) {
            dynamicKeys.push(key);
        }
    }
    return [...staticKeys, ...dynamicKeys];
}

function exportData() {
    const keys = getBackupKeys();
    const backupObj = {};
    
    keys.forEach(k => {
        backupObj[k] = localStorage.getItem(k);
    });
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cosmetic_pass_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    alert('학습 데이터 백업 파일 다운로드가 완료되었습니다!');
}

function triggerImport() {
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.click();
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const ALLOWED_KEYS = [
        'fc_memorized',
        'fc_weak',
        'quiz_results',
        'sim_results_history',
        'sim_draft_session',
        'pomo_total_time',
        'pomo_total_time_date',
        'study_streak',
        'study_streak_last_date',
        'calc_history',
        'fc_migrated_v2'
    ];
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // 데이터 검증 및 복원
            let restoredCount = 0;
            Object.keys(data).forEach(k => {
                // 화이트리스트 정적 키 또는 daily_completed_ 접두사 동적 키만 복원 허용
                const isAllowed = ALLOWED_KEYS.includes(k) || k.startsWith('daily_completed_');
                if (isAllowed && data[k] !== null && typeof data[k] === 'string') {
                    localStorage.setItem(k, data[k]);
                    restoredCount++;
                }
            });
            
            if (restoredCount > 0) {
                alert('학습 데이터 복원이 성공적으로 완료되었습니다! 페이지를 새로고침하여 적용합니다.');
                location.reload();
            } else {
                alert('가져올 유효한 학습 데이터 키가 존재하지 않습니다.');
            }
        } catch (err) {
            alert('유효하지 않은 백업 파일입니다. 백업 데이터 복원 실패.');
        }
    };
    reader.readAsText(file);
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

/* =======================================================
   📖 Textbook Search Integration Logic
   ======================================================= */
const textbookState = {
    filter: 'all',
    searchQuery: '',
    debounceTimer: null
};

function renderTextbookSearch() {
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

function setTextbookFilter(filterVal) {
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

function clearTextbookSearch() {
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

function toggleTextbookCard(cardId) {
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

// --- 교재 본문 읽기 (Textbook Reader) ---
let textbookReaderState = {
    selectedSubject: '',
    selectedChapter: ''
};

// --- 오디오북 플레이어 ---
let readerAudioState = {
    audio: null,          // 현재 Audio 객체
    currentSrc: '',       // 현재 로드된 오디오 경로
    subjId: '',           // 현재 재생 중인 과목 키
    chapterIdx: -1,       // 현재 재생 중인 단원 인덱스
    chapterTitle: '',     // 현재 재생 중인 단원 제목
    wasPlayingBeforeHidden: false, // 탭 전환 전 재생 상태 (모바일 자동정지 복원용)
    sectionBoundaries: [], // [{start, end}] 각 섹션의 추정 재생 구간(초)
    lastSectionIdx: -1,   // 마지막으로 스크롤된 섹션 인덱스
    autoScroll: true,     // 오디오 따라가기 자동 스크롤 여부
};

// 오디오 이어보기 위치 저장 키 접두사
const READER_AUDIO_POS_PREFIX = 'readerAudioPos_';
// 재생 속도 저장 키
const READER_AUDIO_RATE_KEY = 'readerAudioRate';
// 자동 스크롤 설정 저장 키
const READER_AUDIO_AUTOSCROLL_KEY = 'readerAudioAutoScroll';

/**
 * 단원의 오디오 파일 경로를 반환한다.
 * 우선 audio_manifest.js(AUDIO_MANIFEST)를 조회하고, 없으면
 * fileName 명명 규칙("1.맞춤형화장품 개요2026.md")으로부터 경로를 추론한다(폴백).
 * @returns {string|null} 오디오 경로 또는 null
 */
function getAudioPathForChapter(subjId, chapter) {
    let localPath = null;

    // 1) 매니페스트 우선 (단원 인덱스 기반)
    try {
        const chapters = (typeof STUDY_DATA !== 'undefined' && STUDY_DATA[subjId] && STUDY_DATA[subjId].chapters) || [];
        const idx = chapters.indexOf(chapter);
        if (AUDIO_MANIFEST &&
            AUDIO_MANIFEST[subjId] && idx >= 0 && AUDIO_MANIFEST[subjId][idx]) {
            localPath = AUDIO_MANIFEST[subjId][idx];
        }
    } catch (e) { /* 매니페스트 조회 실패 시 폘백 */ }

    // 2) 폘백: fileName 명명 규칙으로 추론
    if (!localPath) {
        if (!chapter || !chapter.fileName) return null;
        // "1.맞춤형화장품 개요2026.md" → "1_맞춤형화장품_개요2026"
        const base = chapter.fileName.replace(/\.md$/i, '');
        const m = base.match(/^(\d+)\.(.+)$/);
        if (!m) return null;
        const num = m[1];
        const title = m[2].trim().replace(/\s+/g, '_');
        const chNo = num.padStart(2, '0');
        localPath = `content/audiobook/mp3/${subjId}/ch${chNo}_${num}_${title}.mp3`;
    }

    // 3) 외부 CDN URL 변환 (audio_manifest.js 의 getAudioUrl — 정적 import)
    return getAudioUrl(localPath);
}

/** 화면 하단에 잠시 표시되는 토스트 알림 */
let _audioToastTimer = null;
function showAudioToast(msg) {
    let toast = document.getElementById('reader-audio-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'reader-audio-toast';
        toast.style.cssText = 'position:fixed;left:50%;bottom:2rem;transform:translateX(-50%);background:rgba(15,23,42,0.95);color:#fff;padding:0.6rem 1.1rem;border-radius:8px;font-size:0.85rem;z-index:9999;border:1px solid rgba(6,182,212,0.4);box-shadow:0 4px 16px rgba(0,0,0,0.4);opacity:0;transition:opacity 0.25s;pointer-events:none;max-width:90%;';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    if (_audioToastTimer) clearTimeout(_audioToastTimer);
    _audioToastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

/** 초를 "mm:ss" (1시간 이상이면 "h:mm:ss") 형식으로 변환 */
function formatAudioTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 이어보기 위치를 localStorage에서 읽기 */
function getSavedAudioPos(src) {
    try {
        const v = localStorage.getItem(READER_AUDIO_POS_PREFIX + src);
        const n = v ? parseFloat(v) : 0;
        return (isFinite(n) && n > 0) ? n : 0;
    } catch (e) { return 0; }
}

/** 이어보기 위치를 localStorage에 저장 (끝까지 들었으면 삭제) */
function saveAudioPos(src, pos, duration) {
    try {
        if (!src) return;
        // 끝에서 5초 이내 또는 95% 이상 들었으면 저장 위치 삭제(다음 재생은 처음부터)
        if (isFinite(duration) && duration > 0 && (pos >= duration - 5 || pos / duration >= 0.95)) {
            localStorage.removeItem(READER_AUDIO_POS_PREFIX + src);
        } else if (pos > 3) { // 3초 이하는 저장하지 않음(사실상 처음)
            localStorage.setItem(READER_AUDIO_POS_PREFIX + src, String(pos));
        }
    } catch (e) { /* noop */ }
}

/** 현재 오디오 재생 위치 저장 (단원 전환/화면 이동 전 호출) */
function persistCurrentAudioPos() {
    const a = readerAudioState.audio;
    if (a && readerAudioState.currentSrc) {
        saveAudioPos(readerAudioState.currentSrc, a.currentTime, a.duration);
    }
}

/** 플레이어 UI 요소 모음 */
function getAudioUI() {
    return {
        btn: document.getElementById('reader-audio-toggle-btn'),
        playerArea: document.getElementById('reader-audio-player-area'),
        label: document.getElementById('reader-audio-now-playing'),
        playPauseBtn: document.getElementById('reader-audio-playpause-btn'),
        seek: document.getElementById('reader-audio-seek'),
        curTime: document.getElementById('reader-audio-current'),
        durTime: document.getElementById('reader-audio-duration'),
        rateBtn: document.getElementById('reader-audio-rate-btn'),
        status: document.getElementById('reader-audio-status'),
        scrollBtn: document.getElementById('reader-audio-scroll-btn'),
    };
}

/**
 * 섹션별 예상 재생 구간을 계산한다.
 * 각 섹션의 텍스트 길이를 기준으로 전체 오디오 길이를 비례 배분한다.
 * @param {Array} sections - 섹션 배열
 * @param {number} duration - 오디오 전체 길이(초)
 * @returns {Array<{start:number,end:number}>} 섹션별 구간
 */
function computeSectionBoundaries(sections, duration) {
    if (!sections || !sections.length || !isFinite(duration) || duration <= 0) return [];
    const weights = sections.map(s => Math.max((s.content || '').length, 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = 0;
    return weights.map(w => {
        const len = (w / total) * duration;
        const start = cursor;
        cursor += len;
        return { start, end: cursor };
    });
}

/** 현재 재생 시간에 해당하는 섹션 인덱스를 반환한다. */
function getCurrentSectionIdx(currentTime) {
    const bounds = readerAudioState.sectionBoundaries;
    if (!bounds.length) return -1;
    for (let i = 0; i < bounds.length; i++) {
        if (currentTime >= bounds[i].start && currentTime < bounds[i].end) return i;
    }
    // 마지막 섹션 끝 이후면 마지막 인덱스 반환
    return bounds.length - 1;
}

/** 현재 섹션을 하이라이트하고 필요 시 스크롤한다. */
function highlightAndScrollToSection(idx) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return;

    // 하이라이트 갱신
    container.querySelectorAll('.reader-section-card').forEach(card => {
        card.classList.toggle('current-section', parseInt(card.dataset.sectionIdx) === idx);
    });

    // 자동 스크롤
    if (readerAudioState.autoScroll && idx !== readerAudioState.lastSectionIdx) {
        const target = document.getElementById(`reader-section-${idx}`);
        if (target) {
            // 접혀 있으면 펼치기
            if (target.classList.contains('collapsed')) {
                target.classList.remove('collapsed');
            }
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    readerAudioState.lastSectionIdx = idx;
}

/** timeupdate 이벤트에서 호출: 현재 섹션 동기화 */
function syncScrollWithAudio() {
    const a = readerAudioState.audio;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    const idx = getCurrentSectionIdx(a.currentTime);
    if (idx >= 0) highlightAndScrollToSection(idx);
}

/** 자동 스크롤 설정 저장/불러오기 */
function getSavedAutoScroll() {
    try {
        const v = localStorage.getItem(READER_AUDIO_AUTOSCROLL_KEY);
        return v === null ? true : v === '1';
    } catch (e) { return true; }
}
function saveAutoScroll(enabled) {
    try { localStorage.setItem(READER_AUDIO_AUTOSCROLL_KEY, enabled ? '1' : '0'); } catch (e) { /* noop */ }
}

/** 자동 스크롤 토글 버튼 UI 갱신 */
function updateAutoScrollBtn() {
    const ui = getAudioUI();
    if (!ui.scrollBtn) return;
    ui.scrollBtn.innerHTML = readerAudioState.autoScroll
        ? '<i class="fa-solid fa-arrows-up-down"></i> 스크롤 따라가기'
        : '<i class="fa-solid fa-arrows-up-down"></i> 스크롤 수동';
    ui.scrollBtn.classList.toggle('active', readerAudioState.autoScroll);
    ui.scrollBtn.title = readerAudioState.autoScroll
        ? '오디오 위치에 맞춰 자동으로 스크롤합니다'
        : '자동 스크롤이 꺼져 있습니다';
}

/** 자동 스크롤 토글 */
function toggleReaderAutoScroll() {
    readerAudioState.autoScroll = !readerAudioState.autoScroll;
    saveAutoScroll(readerAudioState.autoScroll);
    updateAutoScrollBtn();
    showAudioToast(readerAudioState.autoScroll ? '오디오 따라가기 켜짐' : '오디오 따라가기 꺼짐');
}

/** 재생/일시정지 아이콘 갱신 */
function updatePlayPauseIcon() {
    const ui = getAudioUI();
    const playing = readerAudioState.audio && !readerAudioState.audio.paused;
    if (ui.playPauseBtn) {
        ui.playPauseBtn.innerHTML = playing
            ? '<i class="fa-solid fa-pause"></i>'
            : '<i class="fa-solid fa-play"></i>';
        ui.playPauseBtn.title = playing ? '일시정지' : '재생';
    }
    if (ui.btn) {
        ui.btn.innerHTML = (readerAudioState.audio)
            ? '<i class="fa-solid fa-stop"></i> 정지'
            : '<i class="fa-solid fa-headphones"></i> 오디오 듣기';
    }
}

/** 재생 상태 메시지 표시 (로딩/버퍼링/오류) */
function setAudioStatus(msg) {
    const ui = getAudioUI();
    if (ui.status) {
        ui.status.textContent = msg || '';
        ui.status.style.display = msg ? 'inline' : 'none';
    }
}

/** 저장된 재생 속도 적용 */
function getSavedRate() {
    try {
        const v = parseFloat(localStorage.getItem(READER_AUDIO_RATE_KEY));
        return (isFinite(v) && v >= 0.5 && v <= 3) ? v : 1;
    } catch (e) { return 1; }
}

/** 재생 속도 순환 변경 (0.75 → 1 → 1.25 → 1.5 → 2 → 0.75) */
function cycleReaderAudioRate() {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const a = readerAudioState.audio;
    const current = a ? a.playbackRate : getSavedRate();
    let idx = rates.findIndex(r => Math.abs(r - current) < 0.01);
    idx = (idx + 1) % rates.length;
    const newRate = rates[idx];
    if (a) a.playbackRate = newRate;
    try { localStorage.setItem(READER_AUDIO_RATE_KEY, String(newRate)); } catch (e) { /* noop */ }
    const ui = getAudioUI();
    if (ui.rateBtn) ui.rateBtn.textContent = newRate + 'x';
}

/** 시크바 입력 → 오디오 위치 이동 */
function seekReaderAudio(value) {
    const a = readerAudioState.audio;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    a.currentTime = (parseFloat(value) / 100) * a.duration;
}

/**
 * 현재 재생 중인 오디오를 완전히 정지하고 상태를 초기화한다.
 * (단원 전환·과목 전환·다른 화면 이동 시 백그라운드 재생 방지)
 */
function stopReaderAudio() {
    persistCurrentAudioPos(); // 정지 전 위치 저장(이어보기)
    if (readerAudioState.audio) {
        try { readerAudioState.audio.pause(); } catch (e) { /* noop */ }
        readerAudioState.audio = null;
    }
    readerAudioState.currentSrc = '';
    readerAudioState.subjId = '';
    readerAudioState.chapterIdx = -1;
    readerAudioState.chapterTitle = '';
    readerAudioState.sectionBoundaries = [];
    readerAudioState.lastSectionIdx = -1;
    // 하이라이트 제거
    const container = document.getElementById('textbook-reader-container');
    if (container) {
        container.querySelectorAll('.reader-section-card.current-section').forEach(el => el.classList.remove('current-section'));
    }
    const ui = getAudioUI();
    if (ui.btn) ui.btn.innerHTML = '<i class="fa-solid fa-headphones"></i> 오디오 듣기';
    if (ui.playerArea) ui.playerArea.style.display = 'none';
    setAudioStatus('');
}

/** 재생/일시정지 토글 (플레이어 내 버튼) */
function toggleReaderPlayPause() {
    const a = readerAudioState.audio;
    if (!a) return;
    if (a.paused) {
        a.play().catch(err => {
            console.error('재개 실패:', err);
            setAudioStatus('재생 실패');
        });
    } else {
        a.pause();
    }
}

/**
 * 오디오 로드 및 재생 시작. 같은 단원이면 정지, 다른 단원이면 새로 로드.
 */
function toggleReaderAudio(subjId, chapterIdx) {
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters || !subj.chapters[chapterIdx]) return;
    const chapter = subj.chapters[chapterIdx];
    const audioPath = getAudioPathForChapter(subjId, chapter);
    if (!audioPath) {
        alert('이 단원은 오디오 파일이 없습니다.');
        return;
    }

    const ui = getAudioUI();

    // 같은 오디오를 다시 클릭 → 정지(플레이어 닫기)
    if (readerAudioState.audio && readerAudioState.currentSrc === audioPath) {
        stopReaderAudio();
        return;
    }

    // 다른 오디오 재생 중 → 정지 후 교체 (위치는 저장됨)
    if (readerAudioState.audio) {
        stopReaderAudio();
    }

    // 플레이어 영역 표시 + 로딩 표시
    if (ui.playerArea) ui.playerArea.style.display = 'block';
    if (ui.label) ui.label.textContent = chapter.chapterTitle;
    setAudioStatus('로딩 중…');
    if (ui.btn) ui.btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 로딩';
    if (ui.rateBtn) ui.rateBtn.textContent = getSavedRate() + 'x';

    // 새 오디오 생성
    const audio = new Audio();
    audio.preload = 'auto';
    readerAudioState.audio = audio;
    readerAudioState.currentSrc = audioPath;
    readerAudioState.subjId = subjId;
    readerAudioState.chapterIdx = chapterIdx;
    readerAudioState.chapterTitle = chapter.chapterTitle;
    readerAudioState.lastSectionIdx = -1;

    // 자동 스크롤 설정 복원
    readerAudioState.autoScroll = getSavedAutoScroll();
    updateAutoScrollBtn();

    // 이어보기: 메타데이터 로드 후 저장 위치로 이동
    audio.addEventListener('loadedmetadata', () => {
        const resume = getSavedAudioPos(audioPath);
        if (resume > 0 && resume < audio.duration - 5) {
            audio.currentTime = resume;
            setAudioStatus(formatAudioTime(resume) + '부터 이어듣기');
            setTimeout(() => setAudioStatus(''), 2500);
        } else {
            setAudioStatus('');
        }
        if (ui.durTime) ui.durTime.textContent = formatAudioTime(audio.duration);
        if (ui.seek) { ui.seek.disabled = false; }

        // 섹션별 예상 재생 구간 계산
        readerAudioState.sectionBoundaries = computeSectionBoundaries(chapter.sections, audio.duration);
        // 이어보기 위치에 맞는 섹션 즉시 하이라이트
        syncScrollWithAudio();
    });

    // 진행 시간/시크바 갱신 + 섹션 동기화
    audio.addEventListener('timeupdate', () => {
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        if (ui.seek && document.activeElement !== ui.seek) {
            ui.seek.value = String((audio.currentTime / audio.duration) * 100);
        }
        if (ui.curTime) ui.curTime.textContent = formatAudioTime(audio.currentTime);
        syncScrollWithAudio();
    });

    // 주기적 위치 저장 (5초마다)
    audio.addEventListener('timeupdate', () => {
        if (Math.floor(audio.currentTime) % 5 === 0) {
            saveAudioPos(audioPath, audio.currentTime, audio.duration);
        }
    });

    audio.addEventListener('play', () => { updatePlayPauseIcon(); setAudioStatus(''); });
    audio.addEventListener('pause', () => { updatePlayPauseIcon(); saveAudioPos(audioPath, audio.currentTime, audio.duration); });
    audio.addEventListener('waiting', () => setAudioStatus('버퍼링…'));
    audio.addEventListener('playing', () => setAudioStatus(''));
    audio.addEventListener('canplay', () => setAudioStatus(''));

    audio.addEventListener('ended', () => {
        saveAudioPos(audioPath, audio.duration, audio.duration); // 저장 위치 삭제
        updatePlayPauseIcon();
        setAudioStatus('재생 완료');
    });

    audio.addEventListener('error', () => {
        const code = audio.error ? audio.error.code : 0;
        const msgMap = {
            1: '오디오 로딩이 중단되었습니다.',
            2: '네트워크 오류로 오디오를 불러올 수 없습니다.',
            3: '오디오 디코딩에 실패했습니다.',
            4: '오디오 형식이 지원되지 않거나 파일을 찾을 수 없습니다.',
        };
        const msg = msgMap[code] || '오디오를 불러올 수 없습니다.';
        setAudioStatus(msg);
        alert(msg + '\n\n경로: ' + audioPath);
        stopReaderAudio();
    });

    // 저장된 재생 속도 적용
    audio.playbackRate = getSavedRate();

    // 소스 설정 후 재생
    audio.src = audioPath;
    const playPromise = audio.play();
    if (playPromise) {
        playPromise.then(() => {
            updatePlayPauseIcon();
        }).catch(err => {
            // 모바일 자동재생 정책 등으로 차단된 경우
            console.warn('자동재생 차단/재생 실패:', err);
            setAudioStatus('재생 버튼을 눌러 시작하세요');
            updatePlayPauseIcon();
        });
    }
}

// 모바일 브라우저: 탭 숨김 시 자동 일시정지, 복귀 시 상태 복원
document.addEventListener('visibilitychange', () => {
    const a = readerAudioState.audio;
    if (!a) return;
    if (document.hidden) {
        readerAudioState.wasPlayingBeforeHidden = !a.paused;
        if (!a.paused) { a.pause(); }
    }
    // 복귀 시 자동 재개는 하지 않음(사용자 제스처 필요 정책 회피). 아이콘만 갱신.
    if (!document.hidden) { updatePlayPauseIcon(); }
});

function renderTextbookReader() {
    const subjectSelect = document.getElementById('reader-subject-select');
    const chapterSelect = document.getElementById('reader-chapter-select');
    const container = document.getElementById('textbook-reader-container');
    
    if (!subjectSelect || !chapterSelect || !container) return;

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
    
    // Restore previous selections
    if (textbookReaderState.selectedSubject) {
        subjectSelect.value = textbookReaderState.selectedSubject;
        populateChapterSelect(textbookReaderState.selectedSubject);
        if (textbookReaderState.selectedChapter) {
            chapterSelect.value = textbookReaderState.selectedChapter;
            renderChapterContent(textbookReaderState.selectedSubject, textbookReaderState.selectedChapter);
        }
    }
    
    // Bind events only once
    if (!subjectSelect.dataset.bound) {
        subjectSelect.dataset.bound = 'true';
        
        subjectSelect.addEventListener('change', (e) => {
            const subjId = e.target.value;
            textbookReaderState.selectedSubject = subjId;
            textbookReaderState.selectedChapter = '';
            const hadAudio = !!readerAudioState.audio;
            stopReaderAudio();
            if (hadAudio) showAudioToast('과목이 변경되어 오디오 재생이 중지되었습니다.');
            
            if (subjId) {
                chapterSelect.disabled = false;
                DataLoader.loadSubject(subjId).then(() => {
                    populateChapterSelect(subjId);
                });
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                        <h3>단원을 선택하세요</h3>
                        <p>위에서 단원을 선택하면 해당 교재의 본문 내용이 표시됩니다.</p>
                    </div>
                `;
            } else {
                chapterSelect.disabled = true;
                chapterSelect.innerHTML = '<option value="">단원을 선택하세요</option>';
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                        <h3>읽을 교재를 선택하세요</h3>
                        <p>위에서 과목과 단원을 선택하면 해당 교재의 본문 내용이 표시됩니다.</p>
                    </div>
                `;
            }
        });
        
        chapterSelect.addEventListener('change', (e) => {
            const chapterIdx = e.target.value;
            textbookReaderState.selectedChapter = chapterIdx;
            
            if (chapterIdx && textbookReaderState.selectedSubject) {
                renderChapterContent(textbookReaderState.selectedSubject, parseInt(chapterIdx));
            }
        });
    }
}

function populateChapterSelect(subjId) {
    const chapterSelect = document.getElementById('reader-chapter-select');
    if (!chapterSelect) return;
    
    chapterSelect.innerHTML = '<option value="">단원을 선택하세요</option>';
    
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters) return;
    
    subj.chapters.forEach((chapter, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = chapter.chapterTitle;
        chapterSelect.appendChild(option);
    });
}

function renderChapterContent(subjId, chapterIdx) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return;

    chapterIdx = parseInt(chapterIdx);
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters || isNaN(chapterIdx) || !subj.chapters[chapterIdx]) return;

    const chapter = subj.chapters[chapterIdx];

    // 다른 단원으로 이동하면 이전 오디오 정지
    if (readerAudioState.audio &&
        (readerChapterContext.subjId !== subjId || readerChapterContext.chapterIdx !== chapterIdx)) {
        stopReaderAudio();
        showAudioToast('단원이 변경되어 오디오 재생이 중지되었습니다.');
    }

    readerChapterContext.subjId = subjId;
    readerChapterContext.chapterIdx = chapterIdx;

    // Show reader auxiliary UI
    const toolbar = document.getElementById('reader-toolbar');
    const toc = document.getElementById('reader-toc');
    const progressBar = document.getElementById('reader-progress-bar');
    if (toolbar) toolbar.style.display = 'flex';
    if (toc) toc.style.display = 'block';
    if (progressBar) progressBar.style.display = 'block';

    const bookmarks = getReaderBookmarks();

    // Build TOC
    const tocList = document.getElementById('reader-toc-list');
    if (tocList) {
        tocList.innerHTML = chapter.sections.map((section, idx) => `
            <div class="reader-toc-item" data-section-idx="${idx}">
                <span class="toc-num">${idx + 1}</span>
                <span>${esc(section.title)}</span>
            </div>
        `).join('');
        tocList.querySelectorAll('.reader-toc-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.sectionIdx);
                const target = document.getElementById(`reader-section-${idx}`);
                if (target) {
                    // Expand if collapsed
                    if (target.classList.contains('collapsed')) {
                        target.classList.remove('collapsed');
                    }
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // Estimate reading time (Korean ~500 chars/min)
    const totalChars = chapter.sections.reduce((acc, s) => acc + (s.content ? s.content.length : 0), 0);
    const readMinutes = Math.max(1, Math.round(totalChars / 500));

    const audioPath = getAudioPathForChapter(subjId, chapter);
    const hasAudio = !!audioPath;

    let html = `
        <div class="reader-readable-width">
        <div class="reader-chapter-header-card">
            <span class="badge badge-cyan">${esc(subj.name)}</span>
            <h3>${esc(chapter.chapterTitle)}</h3>
            <div class="reader-chapter-meta">
                <span><i class="fa-solid fa-layer-group"></i> 섹션 ${chapter.sections.length}개</span>
                <span><i class="fa-regular fa-clock"></i> 예상 읽기 시간 약 ${readMinutes}분</span>
                <a href="${esc(chapter.filePath)}" target="_blank" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 원본 MD
                </a>
                ${hasAudio ? `
                <button id="reader-audio-toggle-btn" class="btn btn-secondary" onclick="toggleReaderAudio('${subjId}', ${chapterIdx})" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fa-solid fa-headphones"></i> 오디오 듣기
                </button>` : ''}
            </div>
            ${hasAudio ? `
            <div id="reader-audio-player-area" style="display: none; margin-top: 0.75rem; padding: 0.75rem 0.9rem; background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 8px; font-size: 0.85rem; color: var(--color-text-muted);">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.55rem;">
                    <i class="fa-solid fa-circle-play" style="color: var(--color-primary);"></i>
                    <span id="reader-audio-now-playing" style="color: var(--color-text-main); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                    <span id="reader-audio-status" style="margin-left: auto; font-size: 0.78rem; color: var(--color-warning); display: none;"></span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <button id="reader-audio-playpause-btn" class="btn btn-secondary" onclick="toggleReaderPlayPause()" title="재생" style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; padding: 0; border-radius: 50%; flex-shrink: 0;">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <span id="reader-audio-current" style="font-variant-numeric: tabular-nums; flex-shrink: 0;">0:00</span>
                    <input type="range" id="reader-audio-seek" min="0" max="100" value="0" step="0.1" disabled oninput="seekReaderAudio(this.value)" style="flex: 1; accent-color: var(--color-primary); cursor: pointer; height: 4px;">
                    <span id="reader-audio-duration" style="font-variant-numeric: tabular-nums; flex-shrink: 0;">0:00</span>
                    <button id="reader-audio-rate-btn" class="btn btn-secondary" onclick="cycleReaderAudioRate()" title="재생 속도" style="font-size: 0.78rem; padding: 0.25rem 0.5rem; flex-shrink: 0; min-width: 3rem;">1x</button>
                    <button id="reader-audio-scroll-btn" class="btn btn-secondary" onclick="toggleReaderAutoScroll()" title="오디오 위치에 맞춰 자동으로 스크롤" style="font-size: 0.78rem; padding: 0.25rem 0.5rem; flex-shrink: 0; white-space: nowrap;">
                        <i class="fa-solid fa-arrows-up-down"></i> 스크롤 따라가기
                    </button>
                </div>
            </div>` : ''}
        </div>
    `;

    chapter.sections.forEach((section, idx) => {
        const bookmarkKey = `${subjId}_${chapterIdx}_${idx}`;
        const isBookmarked = bookmarks.includes(bookmarkKey);
        html += `
            <div class="reader-section-card" id="reader-section-${idx}" data-section-idx="${idx}">
                <div class="reader-section-header" data-section-idx="${idx}">
                    <i class="fa-solid fa-chevron-down reader-section-toggle"></i>
                    <span class="reader-section-num">${idx + 1}</span>
                    <h4 class="reader-section-title">${esc(section.title)}</h4>
                    <button class="reader-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-bookmark-key="${esc(bookmarkKey)}" title="북마크 ${isBookmarked ? '제거' : '추가'}">
                        <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark"></i>
                    </button>
                </div>
                <div class="reader-section-body">
                    <div class="textbook-reader-section-content">
                        ${formatSectionContentForReader(section.content)}
                    </div>
                </div>
            </div>
        `;
    });

    // Prev / Next chapter navigation
    const prevChapter = chapterIdx > 0 ? subj.chapters[chapterIdx - 1] : null;
    const nextChapter = chapterIdx < subj.chapters.length - 1 ? subj.chapters[chapterIdx + 1] : null;
    html += `
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

    // Section collapse toggles
    container.querySelectorAll('.reader-section-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.reader-bookmark-btn')) return;
            const card = header.closest('.reader-section-card');
            if (card) card.classList.toggle('collapsed');
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
            const chapterSelect = document.getElementById('reader-chapter-select');
            if (chapterSelect) chapterSelect.value = String(navIdx);
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
    applyReaderThemeClass();
}

// --- Reader convenience feature state & logic ---
let readerChapterContext = { subjId: '', chapterIdx: 0 };
let readerFontScale = parseFloat(localStorage.getItem('readerFontScale')) || 1;
let readerScrollBound = false;

function getReaderBookmarks() {
    try {
        return JSON.parse(localStorage.getItem('readerBookmarks')) || [];
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
    localStorage.setItem('readerBookmarks', JSON.stringify(bookmarks));
}

function applyReaderFontScale() {
    const container = document.getElementById('textbook-reader-container');
    const display = document.getElementById('reader-font-size-display');
    if (container) container.style.setProperty('--reader-font-scale', readerFontScale);
    if (display) display.textContent = Math.round(readerFontScale * 100) + '%';
    localStorage.setItem('readerFontScale', readerFontScale);
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

    container.addEventListener('scroll', () => {
        // Progress bar
        const progressFill = document.getElementById('reader-progress-fill');
        if (progressFill) {
            const max = container.scrollHeight - container.clientHeight;
            const pct = max > 0 ? (container.scrollTop / max) * 100 : 0;
            progressFill.style.width = pct + '%';
        }
        // Back to top visibility
        const backBtn = document.getElementById('reader-back-to-top');
        if (backBtn) backBtn.style.display = container.scrollTop > 400 ? 'block' : 'none';

        // Scroll spy — highlight current section in TOC
        const cards = container.querySelectorAll('.reader-section-card');
        const containerTop = container.getBoundingClientRect().top;
        let currentIdx = -1;
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            if (rect.top - containerTop < 120) {
                currentIdx = parseInt(card.dataset.sectionIdx);
            }
            card.classList.toggle('current-section', parseInt(card.dataset.sectionIdx) === currentIdx);
        });
        document.querySelectorAll('.reader-toc-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.sectionIdx) === currentIdx);
        });
    });

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
    const focusBtn = document.getElementById('reader-focus-toggle');
    const expandAllBtn = document.getElementById('reader-expand-all');
    const collapseAllBtn = document.getElementById('reader-collapse-all');
    const modalClose = document.getElementById('reader-table-modal-close');
    const modal = document.getElementById('reader-table-modal');

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
            if (e.key === 'Escape' && modal.style.display !== 'none') closeTableModal();
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
    modal.style.display = 'flex';
}

function closeTableModal() {
    const modal = document.getElementById('reader-table-modal');
    if (modal) modal.style.display = 'none';
}


function setupPWAInstall() {
    let deferredPrompt = null;
    const installBtn = document.getElementById('pwa-install-btn');
    
    console.log('[PWA] 설치 버튼 초기화:', installBtn ? '발견됨' : '발견되지 않음');

    // 이미 설치된 경우 버튼 숨기기 (즉시 실행)
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        console.log('[PWA] 이미 설치된 상태입니다.');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
        return;
    }

    // beforeinstallprompt 이벤트 캡처
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('[PWA] beforeinstallprompt 이벤트 발생');
        // 기본 설치 프롬프트 방지
        e.preventDefault();
        // 이벤트 저장
        deferredPrompt = e;
        // 설치 버튼 표시
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
            installBtn.innerHTML = '<i class="fa-solid fa-download"></i> <span class="btn-text">앱 설치</span>';
            console.log('[PWA] 설치 버튼 표시됨');
        } else {
            console.warn('[PWA] 설치 버튼을 찾을 수 없습니다.');
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

    function openInstallModal() {
        if (!installModal) return;
        const platform = detectPlatform();
        console.log('[PWA] 설치 안내 모달 표시 - 플랫폼:', platform);
        if (guideAndroid) guideAndroid.style.display = platform === 'android' ? 'block' : 'none';
        if (guideIos) guideIos.style.display = platform === 'ios' ? 'block' : 'none';
        if (guideGeneric) guideGeneric.style.display = platform === 'generic' ? 'block' : 'none';
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
            if (!deferredPrompt) {
                console.log('[PWA] 설치 프롬프트가 아직 준비되지 않았습니다.');
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
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    });

    // 서비스 워커 등록
    if ('serviceWorker' in navigator) {
        // 새 SW가 제어를 넘겨받으면 1회 자동 새로고침 → 배포 직후 구/신 파일 혼재(캐시 스큐) 자가 치유
        let __swRefreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (__swRefreshing) return; __swRefreshing = true; window.location.reload();
        });
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] 서비스 워커 등록 성공:', reg.scope))
            .catch(err => console.error('[PWA] 서비스 워커 등록 실패:', err));
    }
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