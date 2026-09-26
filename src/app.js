// app.js - Passmula (맞춤형화장품 조제관리사) 애플리케이션 로직
import { state, loadProgress, saveProgress, safeGetItem, safeSetItem, safeRemoveItem } from './state.js';
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
import { maybeShowWhatsNew } from './whats-new.js';
import { captureEntrySource, flushPendingFeedback, initFeedbackHint } from './feedback.js';

// --- 뷰 컨트롤러 모듈 임포트 ---
import {
    updateGlobalStats,
    refreshDashboardStatsInBackground,
    renderDashboard,
    startSubjectStudy,
    startSubjectQuiz,
    startSubjectReader,
    saveActualExamResult,
    editActualExamResult
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
    tagWrongCause,
    tagWrongCauseAt,
    wrongActionCard,
    wrongActionTextbook,
    wrongActionSimilar,
    startDiagnosticQuiz
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
    openOxDrillSetup,
    startOxDrill,
    nextOxDrill,
    openComboDrillSetup,
    startComboDrill,
    nextComboDrill,
    submitComboJudgments,
    openWeakReview,
    setWeakFilter,
    setDrillCount
} from './views/trainer-drills.js';
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
    showConfirm,
    showAlert
} from './ui-utils.js';
import {
    simState,
    startSimSession,
    startMockExamSim,
    startComboMockExam,
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
import { contentPath, getActiveExam, getCurrentExamId, getExamList, purgeLegacyStorage, hasFeature, examIdToSubjectId } from './exam-context.js';
import { renderExamSelect, showExamSelect, selectExamAction } from './views/exam-select.js';
import { initUiMode, toggleUiMode, toggleStudyTools } from './ui-mode.js';
import { initAuthView, openAuthModal, closeAuthModal, authSignIn, authSignUp, authEmailLogin, authMagicLink, authSignOut, authSetPassword, authSendOtp, authVerifyOtp, authForgotPassword } from './auth-view.js';
import { initSync, syncNow } from './sync.js';
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
                                    <button data-click="ExamViewer.openExam" data-arg="${contentPath(`문제은행/${exam.file}`)}" class="exam-btn-link"><i class="fa-solid fa-file-pdf"></i> ${pdfLabel}</button>
                                    <button class="exam-btn-sim${btnClass}" data-click="startMockExamSim" data-arg="${exam.key}"><i class="fa-solid fa-circle-play"></i> ${simLabel}</button>
                                    <small class="exam-btn-caption">선다형 + 단답형 혼합 · 수작업 원본</small>
                                </div>`;
        }).join('\n');

        // ㄱㄴㄷ 복수정답형: 문제집 MD 열람 + 복수정답형 모의고사 (버튼 클릭 시 문항 수 선택 행 펼침)
        // comboFile이 manifest에 선언되면 우선 사용, 없으면 과목{order}_복수정답형.md 규약
        const comboFile = (subjExams.find(e => e.comboFile) || {}).comboFile || `과목${subj.order}_복수정답형.md`;
        // 프리셋은 실제 풀보다 작을 때만 표시, "전체"는 실제 문항 수 표기
        const comboTotal = DataLoader.getComboCount(subj.order);
        const comboChips = [20, 40, 60]
            .filter(n => !comboTotal || n < comboTotal)
            .map(n => `<button class="exam-btn-sim combo-count-chip" data-click="startComboMockExam" data-arg="${idx + 1}:${n}">${n}문</button>`)
            .concat(`<button class="exam-btn-sim combo-count-chip" data-click="startComboMockExam" data-arg="${idx + 1}">${comboTotal ? `전체 ${comboTotal}문` : '전체'}</button>`)
            .join('\n                                            ');
        const comboPair = `                                <div class="exam-btn-pair">
                                    <button data-click="ExamViewer.openExam" data-arg="${contentPath(`문제은행/${comboFile}`)}" class="exam-btn-link"><i class="fa-solid fa-file-lines"></i> 복수정답형 문제집</button>
                                    <button class="exam-btn-sim" data-click="toggleComboPicker" data-arg="combo-picker-${idx + 1}"><i class="fa-solid fa-circle-play"></i> 복수정답형 모의고사</button>
                                    <small class="exam-btn-caption">ㄱㄴㄷㄹ 조합형 · 원본 문항 자동 변환</small>
                                    <div class="combo-count-row is-hidden" id="combo-picker-${idx + 1}">
                                            ${comboChips}
                                    </div>
                                </div>`;
        const allBtnsHtml = `${btnsHtml}\n${comboPair}`;

        const btnsClass = subjExams.length > 2 ? 'grid-btns-3' : subjExams.length > 1 ? 'grid-btns-2' : 'flex-btns';

        const cardHtml = `                        <div class="exam-card-item">
                            <div class="exam-card-badge ${badgeColor}">${idx + 1}과목</div>
                            <h4 class="exam-card-title">${subj.name} ${totalQuestions}제</h4>
                            <div class="exam-card-btns ${btnsClass}">
${allBtnsHtml}
                            </div>
                        </div>`;

        container.insertAdjacentHTML('beforeend', cardHtml);
    });

    // 정적 텍스트 동적 치환 (manifest 기반)
    const totalAllQuestions = exams.reduce((sum, e) => sum + (e.stats && e.stats.questions || 0), 0);
    const subjCounts = subjects.map((s, i) => {
        const subjExams = exams.filter(e => e.subject === s.key);
        const count = subjExams.reduce((sum, e) => sum + (e.stats && e.stats.questions || 0), 0);
        return count;
    });
    const subtitleEl = document.getElementById('exam-view-subtitle');
    if (subtitleEl && totalAllQuestions > 0) {
        const countStr = subjCounts.join('·');
        subtitleEl.textContent = `교재 인용 기반 ${totalAllQuestions}제 문제은행(과목별 ${countStr}제)으로 과목별 모의고사를 보고, 학습안내서로 핵심을 요약할 수 있습니다.`;
    }

    // 통합 모의고사 제목/버튼 동적 치환
    const integratedConfig = registry.integratedExam ? registry.integratedExam.questionsPerSubject : null;
    if (integratedConfig) {
        const integratedTotal = Object.values(integratedConfig).reduce((a, b) => a + b, 0);
        const examTimeMin = (registry.integratedExam && registry.integratedExam.examTimeMin) || integratedTotal;
        const titleEl = document.getElementById('integrated-exam-title');
        if (titleEl) titleEl.textContent = `통합 실전 모의고사 (${integratedTotal}제)`;
        const btnEl = document.getElementById('integrated-exam-btn');
        if (btnEl) btnEl.innerHTML = `<i class="fa-solid fa-clock" aria-hidden="true"></i> 통합 모의고사 시작 (${examTimeMin}분)`;
    }
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

// 설치형 PWA 콜드 스타트에서 dvh가 실제 화면보다 크게 측정되는 경우가 있어
// (스플래시 직후 시스템 바 확정 전) — visualViewport 기준으로 재측정해 자정시킨다.
// 과대 측정 시 .main-content 끝이 화면 밖으로 나가 스크롤 끝 콘텐츠가 탭 바에 가려짐.
function initViewportHeight() {
    const sync = () => {
        const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${h}px`);
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.visualViewport?.addEventListener('resize', sync);
}

function initApp() {
    // 한 단계가 실패해도 나머지 버튼 연결/렌더가 죽지 않도록 각 단계를 격리한다.
    // (배포 간 캐시 스큐로 특정 요소/바인딩이 어긋나도 앱이 통째로 벽돌이 되는 것 방지)
    const step = (label, fn) => { try { fn(); console.debug('[init] ' + label + ' OK'); return true; } catch (e) { console.error('[init] ' + label + ' 실패:', e); return false; } };
    step('initViewportHeight', initViewportHeight);
    step('loadProgress', loadProgress);
    step('checkStorageWarning', checkStorageWarning);
    step('populateSubjectSelects', populateSubjectSelects);
    step('populateExamCards', populateExamCards);
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

    // 사이드바·설정 메뉴 버전 표시 (data/version.js의 APP_VERSION — 배포 스탬프와 동일 값)
    if (window.APP_VERSION) {
        ['sidebar-version', 'settings-version']
            .map(id => document.getElementById(id)).filter(Boolean)
            .forEach(el => { el.textContent = window.APP_VERSION; });
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

// --- 가로/세로 보기 ---
// 실제 기기 회전 + 반응형 CSS가 가로/세로를 직접 처리하므로
// 가로/세로 보기 토글 — landscape-mode 클래스를 토글하고 상태를 저장
function setupOrientationToggle() {
    const btn = document.getElementById('orientation-toggle-btn');
    if (!btn) return;

    // 초기 상태 복원
    if (safeGetItem(STORAGE_KEYS.PREFERRED_ORIENTATION) === 'landscape') {
        document.body.classList.add('landscape-mode');
        btn.querySelector('i').className = 'fa-solid fa-mobile-screen';
    }

    btn.addEventListener('click', () => {
        const isLandscape = document.body.classList.toggle('landscape-mode');
        if (isLandscape) {
            safeSetItem(STORAGE_KEYS.PREFERRED_ORIENTATION, 'landscape');
        } else {
            safeRemoveItem(STORAGE_KEYS.PREFERRED_ORIENTATION);
        }
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

/** 활성 시험의 브랜딩을 DOM에 반영 (문서 제목 + 사이드바 로고) */
function applyExamBranding() {
    const exam = getActiveExam();
    if (!exam) return;
    if (exam.title) document.title = exam.title;
    const logoMain = document.querySelector('.logo-text h1');
    const logoSub = document.querySelector('.logo-text span');
    if (logoMain && exam.logoMain) logoMain.textContent = exam.logoMain;
    if (logoSub && exam.logoSub) logoSub.textContent = exam.logoSub;
}

/**
 * 원료 DB 갱신 감지 — 레지스트리의 ingredients.contentHash를 마지막 확인 값과 비교해
 * 정정/개정 배포로 바뀐 경우 1회 알림을 띄운다. 최초 방문(저장값 없음)은 조용히 기록만 한다.
 * contentHash는 원료 파일 내용의 해시라 배포 시점이 아니라 실제 데이터 변경 때만 발화한다.
 */
// 기존 사용자 식별용 — 실제 사용으로만 생성되는 진행 데이터 키들 (알림 기능 도입 전 사용자 구분)
const RETURNING_USER_KEYS = [
    STORAGE_KEYS.QUIZ_RESULTS, STORAGE_KEYS.STUDY_CALENDAR, STORAGE_KEYS.STUDY_STREAK,
    STORAGE_KEYS.FC_MEMORIZED, STORAGE_KEYS.FC_SPACED_REPETITION,
    STORAGE_KEYS.SIM_RESULTS_HISTORY, STORAGE_KEYS.FORMULA_ITEMS, STORAGE_KEYS.READER_LAST_POSITION
];

function checkIngredientsUpdate() {
    const meta = (DataLoader.registry && DataLoader.registry.ingredients) || null;
    const hash = meta && meta.contentHash;
    if (!hash) return;
    try {
        const prev = safeGetItem(STORAGE_KEYS.INGREDIENTS_HASH);
        // 알림 키는 '버전:해시' — 데이터 해시가 같아도 db_version 범프(표시 전용 개정)는 발화한다.
        const notifyKey = `${meta.version || 'data'}:${hash}`;
        const notifiedHash = safeGetItem(STORAGE_KEYS.INGREDIENTS_DB_NOTIFIED);
        // 진행 데이터 존재 = 알림 기능 도입 전부터 쓰던 기존 사용자 → 이 버전 알림을 아직 못 봤다면 1회 고지
        const isReturningUser = RETURNING_USER_KEYS.some(k => safeGetItem(k) !== null);
        const hashChanged = prev !== null && prev !== hash;
        const missedNotice = isReturningUser && notifiedHash !== notifyKey;
        if (hashChanged || missedNotice) {
            const version = meta.version ? ` v${meta.version}` : '';
            const notice = meta.notice ? `\n\n갱신 내역: ${meta.notice}` : '';
            const count = meta.stats && meta.stats.count ? `\n수록 원료 ${meta.stats.count}종 · 성분 사전과 Formula OS 규정 검증이 최신 기준으로 적용됩니다.` : '';
            const history = Array.isArray(meta.history) ? meta.history : [];
            const prevNote = history.length
                ? `\n\n이전 개정:\n${history.slice(0, 3).map(h => `· v${h.version} (${h.updatedAt || '—'}) ${h.notice || ''}`).join('\n')}`
                : '';
            // 확인 플래그는 사용자가 모달을 실제로 닫은 뒤에만 기록한다.
            // (SW 업데이트 리로드 등으로 모달이 조기 소실되면 다음 방문에 다시 고지)
            showAlert(`원료 데이터베이스가${version}로 갱신되었습니다.${notice}${count}${prevNote}`, '원료 DB 갱신')
                .then(() => {
                    safeSetItem(STORAGE_KEYS.INGREDIENTS_DB_NOTIFIED, notifyKey);
                    safeSetItem(STORAGE_KEYS.INGREDIENTS_HASH, hash);
                })
                .catch(() => {});
        } else if (prev === null) {
            // 신규 사용자: 현재 버전을 '이미 확인한 것'으로 기록해 향후 오발화 방지
            safeSetItem(STORAGE_KEYS.INGREDIENTS_DB_NOTIFIED, notifyKey);
        } else if (prev !== hash) {
            safeSetItem(STORAGE_KEYS.INGREDIENTS_HASH, hash);
        }
    } catch (e) { /* 알림 실패가 초기화를 막지 않도록 무시 */ }
}

/** 성분 사전 버전 배지 탭 → 원료 DB 버전 이력 모달 (현재 버전 + 누적 개정 내역) */
function showIngredientsChangelog() {
    const meta = (DataLoader.registry && DataLoader.registry.ingredients) || null;
    if (!meta || !meta.version) { showToast('원료 DB 버전 정보가 없습니다.', 'info'); return; }
    const lines = [`현재: v${meta.version} (${meta.updatedAt || '—'})`];
    if (meta.notice) lines.push(`  ${meta.notice}`);
    const history = Array.isArray(meta.history) ? meta.history : [];
    if (history.length) {
        lines.push('', '이전 개정:');
        history.forEach(h => lines.push(`· v${h.version} (${h.updatedAt || '—'}) ${h.notice || ''}`));
    }
    if (meta.stats && meta.stats.count) lines.push('', `수록 원료 ${meta.stats.count}종`);
    showAlert(lines.join('\n'), '원료 DB 버전 이력');
}

/** 활성 시험의 features 플래그에 따라 도메인 특화 UI 숨김 (data-feature 속성 기반) */
function applyFeatureFlags() {
    const multiExam = getExamList().length > 1;
    document.querySelectorAll('[data-feature]').forEach(el => {
        // 시험 전환 버튼은 플래그가 아닌 실제 시험 수로 결정 — 1개면 무의미
        const on = el.dataset.feature === 'examSwitch'
            ? multiExam
            : hasFeature(el.dataset.feature);
        if (!on) el.classList.add('is-hidden');
    });
}

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