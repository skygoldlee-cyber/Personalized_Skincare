// app.js - Passmula (맞춤형화장품 조제관리사) 애플리케이션 로직
// @spec S-02,S-03,S-08,UX-NAV-01,UX-PWA-01,UX-PWA-05,PF-10
import { state, loadProgress } from './state.js';
import { shuffle } from './utils.js';
import { clearScratchpad, toggleCalcScratchpad, toggleScratchpadEraser } from './scratchpad.js';
import { DataLoader } from './data-loader.js';
import { ExamViewer } from './exam-viewer.js';
import { ManualViewer } from './manual-viewer.js';
import { initWebVitals } from './web-vitals.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { setupPWAInstall } from './pwa-install.js';
import { setupThemeToggle } from './theme-toggle.js';
import { maybeShowWhatsNew } from './whats-new.js';
import { appVersion, formatAppVersion } from './app-version.js';
import { captureEntrySource, flushPendingFeedback, initFeedbackHint } from './feedback.js';
import { loadFeaturePlan, proFeatureNotice, showPlanCompare } from './pro-upgrade.js';
import { showUsageStats, trackAction } from './usage-stats.js';

// --- 뷰 컨트롤러 모듈 임포트 ---
import {
    updateGlobalStats,
    refreshDashboardStatsInBackground,
    renderDashboard,
    renderAnalysisView,
    startSubjectStudy,
    startSubjectQuiz,
    startSubjectReader,
    saveActualExamResult,
    editActualExamResult
} from './views/dashboard.js';
import {
    loadFlashcards,
} from './views/flashcard.js';
import {
    renderQuizQuestion,
    renderReviewList,
    removeWeakCard,
    setReviewFilter,
    tagWrongCause,
    tagWrongCauseAt,
    wrongActionCard,
    wrongActionTextbook,
    wrongActionSimilar,
    startDiagnosticQuiz
} from './views/quiz.js';
import {
    startDailyChallenge,
    closeDailyModal,
    submitDailyCardAnswer,
    submitDailyShortAnswer,
    nextDailyStep,
} from './views/daily-challenge.js';
import {
    initTrainer,
    exitTrainerSubView,
    startLimitsTrainer,
    nextLimitsQuestion,
    startCalcPractice,
    generateCalcQuestion,
    submitCalcAnswer,
    toggleSolutionAccordion,
    startIngredientsChallenge,
    submitIngAnswer,
    nextIngQuestion,
} from './views/trainer.js';
import {
    openOxDrillSetup,
    startOxDrill,
    nextOxDrill,
    openComboDrillSetup,
    startComboDrill,
    nextComboDrill,
    submitComboJudgments,
    openWeakReview,
    gotoWeakReview,
    setWeakFilter,
    setDrillCount
} from './views/trainer-drills.js';
import {
    togglePomodoro,
    resetPomodoro,
} from './views/pomodoro.js';
import {
    renderDictionary,
    setDictFilter,
    clearDictSearch,
    dictExportCsv
} from './views/dictionary.js';
import {
    renderStudyCalendar,
    prevCalendarMonth,
    nextCalendarMonth,
    openGoalSettings,
    closeGoalSettings,
    saveGoalSettings
} from './views/study-calendar.js';
import {
    initFormulaView,
    exitFormulaSubView,
    openFormulaList,
    openFormulaCalc,
    openIngredientDict,
    formulaNew,
    formulaOpen,
    formulaDuplicate,
    formulaDelete,
    formulaCalcAddRow,
    formulaCalcRemoveRow,
    formulaCalcSave,
    formulaAddIngredient,
    formulaRecAdd,
    formulaRecAddBase,
    formulaLoadBase,
    formulaRuleAdd,
    formulaRuleRemove,
    formulaRuleReset,
    formulaRuleExport,
    formulaRuleImport,
    formulaSortPhase,
    formulaStepAdd,
    formulaStepRemove,
    formulaPrint,
    formulaExportJson,
    formulaCardExport,
    formulaImportJson,
    formulaAllergyAdd,
    formulaAllergyRemove,
    formulaCustLoad,
    formulaCustSaveAs
} from './views/formula.js';
import {
    openBatchPanel,
    batchNew,
    batchEdit,
    batchSave,
    batchOpen,
    batchDelete,
    batchFormulaChanged,
    batchCustChanged,
    batchPrintRecord,
    batchPrintLabel,
    batchPrintGuide,
    batchFilterReset,
    batchExportCsv,
} from './views/formula-batch.js';
import {
    openCustomerPanel,
    custNew,
    custEdit,
    custSave,
    custOpen,
    custDelete,
    custLogAdd,
    custAllergyAdd,
    custAllergyRemove,
    custImportCsv,
    custExportCsv,
    custCsvTemplate,
} from './views/formula-customer.js';
import {
    openMaterialPanel,
    matNew,
    matEdit,
    matSave,
    matDelete,
    matImportCsv,
    matExportCsv,
    matCsvTemplate,
} from './views/formula-material.js';
import {
    openCompliancePanel,
    compToggle,
    compReset,
    compOpenLaw,
} from './views/formula-compliance.js';
import { recordStudyActivity } from './study-tracker.js';
import {
    exportData,
    triggerImport,
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
    startMockExamSim,
    startComboMockExam,
    startIntegratedMockExam,
    clearSimDraft,
    checkExamDraft,
    resumeSimDraft,
    exitSimArena,
    startWeakExam,
    saveExamResultToHistory
} from './views/exam-simulator.js';
import {
    showSimAnswerReview,
    showSimResultsSummary
} from './views/exam-sim-review.js';
import { switchView } from './views/navigation.js';
import { setupOfflineDetection } from './views/offline-detection.js';
import { setupEventListeners } from './views/event-listeners.js';
import { getViewTitles, navigateToView } from './router.js';
import { getCurrentExamId, getExamList, purgeLegacyStorage } from './exam-context.js';
import { renderExamSelect, showExamSelect, selectExamAction } from './views/exam-select.js';
import { initUiMode, toggleUiMode, toggleStudyTools } from './ui-mode.js';
import { initAuthView, openAuthModal, closeAuthModal, authSignIn, authSignUp, authEmailLogin, authMagicLink, authSignOut, authSetPassword, authSendOtp, authVerifyOtp, authForgotPassword } from './auth-view.js';
import { initSync, syncNow } from './sync.js';
import {
    populateSubjectSelects, populateExamCards, populateResourceCards, checkStorageWarning
} from './app-dashboard.js';
import {
    initViewportHeight, setupOrientationToggle, enhanceDataClickAccessibility,
    applyExamBranding, checkIngredientsUpdate, showIngredientsChangelog, applyFeatureFlags
} from './app-shell.js';
import {
    initCommandPalette, openCommandPalette, closeCommandPalette,
    executePaletteResult
} from './command-palette.js';

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

function initApp() {
    // 한 단계가 실패해도 나머지 버튼 연결/렌더가 죽지 않도록 각 단계를 격리한다.
    // (배포 간 캐시 스큐로 특정 요소/바인딩이 어긋나도 앱이 통째로 벽돌이 되는 것 방지)
    const step = (label, fn) => { try { fn(); console.debug('[init] ' + label + ' OK'); return true; } catch (e) { console.error('[init] ' + label + ' 실패:', e); return false; } };
    step('initViewportHeight', initViewportHeight);
    step('loadProgress', loadProgress);
    step('checkStorageWarning', checkStorageWarning);
    step('populateSubjectSelects', populateSubjectSelects);
    step('populateExamCards', populateExamCards);
    // feature-plan.json 로드 — 완료 시 PRO 배지 표시/숨김 갱신 (비동기·실패 시 기본값 유지)
    step('loadFeaturePlan', () => { loadFeaturePlan(); });
    step('populateResourceCards', populateResourceCards);
    step('setupImportListener', setupImportListener);
    const navOk = step('setupNavigation', setupNavigation);
    // 학습/실무 모드 반영 — setupNavigation 이후에 실행해야 switchView가 라우터로 디스패치됨
    step('initUiMode', initUiMode);
    step('setupEventListeners', () => setupEventListeners(enhanceDataClickAccessibility));
    step('setupPWAInstall', setupPWAInstall);
    // 앱 종료 버튼은 설치형 PWA(standalone)에서만 노출 — 브라우저 탭에서는 무의미
    step('setupAppQuit', () => {
        const quitBtn = document.getElementById('app-quit-btn');
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (quitBtn && isStandalone) quitBtn.classList.remove('is-hidden');
    });
    // 계정 세션 복원/구독 — 비동기, 내부에서 오류를 삼켜 앱 초기화를 막지 않음
    step('initAuthView', () => { initAuthView(); });
    // 클라우드 동기화 — 쓰기 훅 등록 + 로그인 상태면 시작 pull (비동기·실패 무시)
    step('initSync', () => { initSync(); });
    step('setupThemeToggle', setupThemeToggle);
    // 통합 검색 팔레트 (Ctrl+K)
    step('initCommandPalette', initCommandPalette);
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

    // 사이드바·설정 메뉴 버전 표시 (APP_VERSION 기계 ID → formatAppVersion 표시용 변환)
    const dispVer = formatAppVersion(appVersion());
    if (dispVer) {
        ['sidebar-version', 'settings-version']
            .map(id => document.getElementById(id)).filter(Boolean)
            .forEach(node => { /** @type {HTMLElement} */ (node).textContent = dispVer; });
    }

    // 유입 채널(?src=) 캡처 — 피드백의 entry_src로 첨부 (최초 1회 보존)
    step('captureEntrySource', captureEntrySource);

    // "의견 보내기" 신기능 힌트 — 설정 ⚙️ 점 + NEW 배지 (각 1회)
    step('initFeedbackHint', initFeedbackHint);

    // 새 버전 적용 후 첫 부팅이면 변경 이력 모달 (최초 설치는 기록만)
    step('maybeShowWhatsNew', maybeShowWhatsNew);

    // 오프라인 큐에 쌓인 의견은 온라인 복귀 시 플러시
    window.addEventListener('online', () => { flushPendingFeedback(); });
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
        'analysis-view': () => {
            trackAction('personal_analysis');
            proFeatureNotice('personal_analysis', '맞춤학습');
            renderAnalysisView();
            refreshDashboardStatsInBackground();
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
        },
        'formula-view': () => {
            showGlobalLoading('Formula OS 데이터를 불러오는 중입니다...');
            DataLoader.loadIngredients().then(() => {
                hideGlobalLoading();
                initFormulaView();
            }).catch(() => {
                hideGlobalLoading();
                showToast('원료 데이터를 불러오지 못했습니다.', 'error');
                initFormulaView();
            });
        },
        'calendar-view': () => {
            renderStudyCalendar();
        },
        'exam-select-view': () => {
            renderExamSelect();
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
            if (target) navigateToView(target, routerCtx);
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
                const target = /** @type {HTMLElement} */ (mutation.target);
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
    window.addEventListener('popstate', () => {
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
// @ts-ignore — 함수 선언 재할당 패턴: 모듈 스코프 함수 바인딩은 런타임에서 재할당 가능
initApp = function() {
    originalInitApp();
    setupOfflineDetection(state, togglePomodoro);
    setupModalBackHandler();
};


/* =======================================================
   🖨️ 오답노트 인쇄 (Print Handler)
   ======================================================= */
function startFocusSubjectStudy(subKey) {
    DataLoader.loadSubject(subKey).then(() => {
        if (typeof window.STUDY_DATA !== 'undefined' && window.STUDY_DATA[subKey]) {
            const subj = window.STUDY_DATA[subKey];
            state.quiz.data = shuffle(subj.quizzes).slice(0, 10);
            state.quiz.currentIndex = 0;
            state.quiz.correctCount = 0;
            state.quiz.solvedList = [];
            
            // 퀴즈 화면 초기화 및 활성화
            document.getElementById('quiz-setup-panel')?.classList.add('is-hidden');
            document.getElementById('quiz-result-panel')?.classList.add('is-hidden');
            document.getElementById('quiz-arena-panel')?.classList.remove('is-hidden');
            const qCat = document.getElementById('quiz-q-category');
            if (qCat) qCat.textContent = subj.name;
            
            renderQuizQuestion();
            
            // 퀴즈 탭 활성화
            switchView('quiz-view', { scrollTop: true });
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

// data-click 기반 이벤트 위임을 위한 전역 API 노출.
// 위임 디스패처(resolveDelegatedHandler)는 window에서만 핸들러를 조회하므로
// 여기 등록이 누락되면 클릭이 조용히 죽는다 — tests/unit/delegation-guard.test.js가
// 모든 data-click/data-input 참조와 이 맵의 교차 일치를 강제 검증한다.
const DELEGATED_HANDLERS = {
    // 뷰어/로더 객체
    ManualViewer, ExamViewer, DataLoader,
    // 스크래치패드
    clearScratchpad, toggleCalcScratchpad, toggleScratchpadEraser,
    // 교재 검색/리더/오디오
    clearTextbookSearch, setTextbookFilter, toggleTextbookCard,
    toggleReaderAudio, stopReaderAudio, toggleReaderPlayPause,
    seekReaderAudio, cycleReaderAudioRate, toggleReaderAutoScroll,
    // 학습 캘린더/목표
    renderStudyCalendar, prevCalendarMonth, nextCalendarMonth,
    openGoalSettings, closeGoalSettings, saveGoalSettings, recordStudyActivity,
    // 모의고사/시뮬레이터
    exitSimArena, clearSimDraft, resumeSimDraft, showSimAnswerReview,
    showSimResultsSummary, startMockExamSim, startComboMockExam,
    startIntegratedMockExam, startWeakExam, startFocusSubjectStudy,
    saveExamResultToHistory,
    // 훈련소 드릴 (O/X·복수정답형·약점)
    openOxDrillSetup, startOxDrill, nextOxDrill,
    openComboDrillSetup, startComboDrill, nextComboDrill, submitComboJudgments,
    openWeakReview, setWeakFilter, setDrillCount,
    // 뷰 전환 (data-click="switchView" data-arg="<view-id>") — 딥링크 공용
    switchView, gotoWeakReview,
    // 훈련소 (제한값·계산·원료·뽀모도로)
    exitTrainerSubView, startLimitsTrainer, nextLimitsQuestion,
    startCalcPractice, generateCalcQuestion, submitCalcAnswer,
    startIngredientsChallenge, nextIngQuestion, submitIngAnswer,
    toggleSolutionAccordion, togglePomodoro, resetPomodoro,
    // 대시보드/리뷰/백업 (과거 브리지 누락으로 배포판에서 죽어 있던 핸들러 포함)
    startSubjectStudy, startSubjectQuiz, startSubjectReader,
    removeWeakCard, setReviewFilter, printReviewNotes,
    tagWrongCause, tagWrongCauseAt, wrongActionCard, wrongActionTextbook, wrongActionSimilar,
    startDiagnosticQuiz,
    // 실제 시험 결과 자가 보고 (C1)
    saveActualExamResult, editActualExamResult,
    // 통합 검색 팔레트
    openCommandPalette, closeCommandPalette, executePaletteResult,
    exportData, triggerImport, checkStorageWarning,
    // 데일리 챌린지
    startDailyChallenge, closeDailyModal, nextDailyStep,
    submitDailyCardAnswer, submitDailyShortAnswer,
    // 사전/시험 전환
    clearDictSearch, setDictFilter, dictExportCsv, showExamSelect, selectExamAction,
    // Formula OS (배합 계산·My 포뮬러)
    openFormulaList, openFormulaCalc, openIngredientDict, exitFormulaSubView,
    formulaNew, formulaOpen, formulaDuplicate, formulaDelete,
    formulaCalcAddRow, formulaCalcRemoveRow, formulaCalcSave, formulaAddIngredient,
    formulaRecAdd, formulaRecAddBase, formulaLoadBase,
    formulaRuleAdd, formulaRuleRemove, formulaRuleReset,
    formulaRuleExport, formulaRuleImport,
    formulaSortPhase, formulaStepAdd, formulaStepRemove,
    formulaPrint, formulaExportJson, formulaCardExport, formulaImportJson,
    formulaAllergyAdd, formulaAllergyRemove, formulaCustLoad, formulaCustSaveAs,
    // Formula OS — 조제 기록(배치)
    openBatchPanel, batchNew, batchEdit, batchSave, batchOpen, batchDelete,
    batchFormulaChanged, batchCustChanged, batchPrintRecord, batchPrintLabel, batchPrintGuide,
    batchFilterReset, batchExportCsv,
    // Formula OS — 고객 관리
    openCustomerPanel, custNew, custEdit, custSave, custOpen, custDelete,
    custLogAdd, custAllergyAdd, custAllergyRemove,
    custImportCsv, custExportCsv, custCsvTemplate,
    // Formula OS — 원료 장부
    openMaterialPanel, matNew, matEdit, matSave, matDelete,
    matImportCsv, matExportCsv, matCsvTemplate,
    // Formula OS — 법규 준수 체크리스트
    openCompliancePanel, compToggle, compReset, compOpenLaw,
    showIngredientsChangelog,
    // 학습/실무 UI 모드
    toggleUiMode, toggleStudyTools,
    /** 앱 종료 (설치형 PWA) — 확인 후 종료 시도. 모바일 OS가 자체 종료를 막으면 종료 안내 화면으로 전환 */
    quitApp() {
        // 모바일 OS 종료 안내는 터치 환경에서만 — 데스크톱 PWA는 window.close()가 동작하므로 불필요
        const isTouch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
        const msg = isTouch
            ? '앱을 종료할까요?\n종료되지 않으면 최근 앱 목록에서 이 화면을 위로 밀어 닫아주세요.'
            : '앱을 종료할까요?';
        showConfirm(msg, '앱 종료').then((ok) => {
            if (!ok) return;
            // 데스크톱 설치 PWA는 여기서 창이 닫힘
            window.close();
            // Android PWA: 루트에서 뒤로가기는 앱을 홈으로 내리는 동작과 유사
            try { window.history.back(); } catch (_) { /* 무시 */ }
            // 모두 차단되면 종료 안내 화면으로 대체 — 사용자가 제스처로 마무리
            setTimeout(() => {
                const exitScreen = document.createElement('div');
                exitScreen.className = 'app-exit-screen';
                const guide = isTouch
                    ? '완전히 닫으려면 최근 앱 목록에서 이 화면을 위로 밀어주세요.'
                    : '이 창을 직접 닫아주세요.';
                exitScreen.innerHTML = `<i class="fa-solid fa-power-off" aria-hidden="true"></i><p>앱을 종료했습니다.<br>${guide}</p>`;
                document.body.appendChild(exitScreen);
            }, 600);
        });
    },
    // 계정/로그인 (Supabase Auth)
    openAuthModal, closeAuthModal, authSignIn, authSignUp, authEmailLogin, authMagicLink, authSignOut, authSetPassword, authSendOtp, authVerifyOtp, authForgotPassword,
    showPlanCompare,
    showUsageStats,
    syncNow,
    /** 복수정답형 모의고사 문항 수 선택 행 토글 — 다른 과목의 열린 행은 닫는다 */
    toggleComboPicker(rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;
        const willOpen = row.classList.contains('is-hidden');
        document.querySelectorAll('.combo-count-row').forEach(r => r.classList.add('is-hidden'));
        if (willOpen) row.classList.remove('is-hidden');
    },
    // state.js의 saveProgress()가 `typeof updateGlobalStats === 'function'`로 참조하므로 노출 필요
    // (모듈-대-모듈이라 window에 걸어야 bare typeof가 해석됨)
    updateGlobalStats,
};
Object.assign(window, DELEGATED_HANDLERS);


// =======================================================
// 멀티시험 컨텍스트 초기화
// =======================================================

/**
 * 시험 컨텍스트 초기화 — initApp보다 먼저 실행된다.
 * 1) 활성 시험 해석 + 레지스트리 확보(비기본 시험은 번들 동적 로드)
 * 2) 브랜딩/기능 플래그 적용
 * 3) 레거시(비네임스페이스) 진도 키 1회 정리 — 시험별 격리 정책
 */
async function initExamContext() {
    DataLoader.init();
    await DataLoader.ensureRegistry();
    checkIngredientsUpdate();
    await DataLoader.loadComboIndex();
    await DataLoader.loadQuestionChapters();
    applyExamBranding();
    applyFeatureFlags();
    purgeLegacyStorage(
        Object.values(STORAGE_KEYS),
        [STORAGE_KEYS.DAILY_COMPLETED_PREFIX, 'readerAudioPos_']
    );
}

// 윈도우 로드 시 구동 (DOMContentLoaded 이미 완료 시 즉시 실행 대응)
async function startAppInit() {
    initWebVitals();
    try {
        await initExamContext();
    } catch (e) {
        console.error('[init] 시험 컨텍스트 초기화 실패 — 기본 시험으로 계속:', e);
    }
    initApp();
    // 시험 미선택 상태이고 선택지가 2개 이상일 때만 시험 선택 화면을 홈으로 표시
    // (시험이 1개뿐이면 선택 의미가 없으므로 기본 시험으로 바로 진입)
    if (!getCurrentExamId() && getExamList().length > 1) {
        try { showExamSelect(); } catch (e) { console.error('[init] 시험 선택 뷰 실패:', e); }
    }
    // DOM이 완전히 로드된 후 토글 버튼 설정
    setTimeout(() => {
        setupOrientationToggle();
    }, 100);
    // 진단: __APP_INITIALIZED가 설정되지 않았으면 화면에 표시
    setTimeout(() => {
        if (!window.__APP_INITIALIZED) {
            const d = document.createElement('div');
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