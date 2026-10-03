// src/views/listeners-app.js — 앱 셸 공통 이벤트 바인딩 (event-listeners.js §1에서 분리)
// @spec UX-SET-05
// 진도 초기화·변경 이력·온보딩·피드백 버튼, 설정 메뉴, OMR·대시보드 접이식.
import { state, saveProgress, safeGetItem, safeSetItem, safeRemoveItem, listScopedKeys } from '../state.js';
import { removeItemRaw } from '../storage.js';
import { RESET_KEYS, isDailyCompletedKey } from '../storage-keys.js';
import { renderDashboard } from './dashboard.js';
import { loadFlashcards } from './flashcard.js';
import { renderReviewList } from './quiz.js';
import { showToast, showConfirm } from '../ui-utils.js';
import { showReleaseNotesModal, releaseNotes } from '../whats-new.js';
import { showOnboardingModal } from '../onboarding.js';
import { showFeedbackModal, dismissFeedbackHint, dismissFeedbackDot } from '../feedback.js';

export function bindAppListeners() {
    // 진도 초기화 버튼
    document.getElementById('reset-progress-btn')?.addEventListener('click', async () => {
        const ok = await showConfirm("정말 모든 학습 진도를 초기화하시겠습니까?\n외운 카드, 오답 정보, 모의고사 성적 이력, 연속 학습일, 계산 기록이 모두 지워집니다.", "학습 진도 초기화");
        if (!ok) return;
        // 인메모리 상태 초기화
        state.memorizedCards.clear();
        state.weakCards.clear();
        state.quizResults = {};
        state.trainer.pomodoro.totalTimeToday = 0;
        state.trainer.pomodoro.sessionCount = 0;

        // 로컬스토리지에 남아있는 현재 시험의 학습 데이터 키 제거 (시험별 네임스페이스)
        RESET_KEYS.forEach(k => safeRemoveItem(k));

        // 날짜 기반 동적 키(daily_completed_*) 일괄 제거
        listScopedKeys(isDailyCompletedKey).forEach(k => removeItemRaw(k));

        saveProgress();

        // 현재 활성화 뷰 새로고침
        if (state.currentView === 'dashboard-view') renderDashboard();
        else if (state.currentView === 'flashcard-view') loadFlashcards();
        else if (state.currentView === 'review-view') renderReviewList();

        showToast("학습 진도가 모두 초기화되었습니다.", "success");
    });

    // 변경 이력 버튼 — 누적된 전체 릴리스 노트 표시
    document.getElementById('whats-new-btn')?.addEventListener('click', () => {
        const entries = releaseNotes().filter(e => e && e.version);
        if (entries.length) showReleaseNotesModal(entries, '변경 이력');
        else showToast('표시할 변경 이력이 없습니다.', 'info');
    });

    // 시작 안내 버튼 — 첫 방문 온보딩 모달 재열람
    document.getElementById('onboarding-btn')?.addEventListener('click', () => {
        showOnboardingModal();
    });

    // 의견 보내기 버튼 — 피드백 모달 (현재 뷰 컨텍스트 첨부)
    document.getElementById('feedback-btn')?.addEventListener('click', () => {
        dismissFeedbackHint(); // NEW 배지 1회성 제거
        showFeedbackModal(state.currentView);
    });

    // 설정 메뉴 토글 — 외부 클릭/Escape/항목 선택 시 닫힘
    const settingsBtn = document.getElementById('settings-toggle-btn');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsBtn && settingsPanel) {
        const closeSettings = () => {
            settingsPanel.classList.add('is-hidden');
            settingsBtn.setAttribute('aria-expanded', 'false');
        };
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = settingsPanel.classList.contains('is-hidden');
            settingsPanel.classList.toggle('is-hidden');
            settingsBtn.setAttribute('aria-expanded', String(willOpen));
            if (willOpen) dismissFeedbackDot(); // 패널 첫 오픈 → 점 제거
        });
        settingsPanel.addEventListener('click', (e) => {
            if ((/** @type {Element|null} */ (e.target))?.closest('.settings-item')) closeSettings();
        });
        document.addEventListener('click', (e) => {
            if (!settingsPanel.classList.contains('is-hidden') && !(/** @type {Element|null} */ (e.target))?.closest('.settings-menu')) {
                closeSettings();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSettings();
        });
    }

    // OMR 답안지 접이식 — 모바일(≤900px)에서는 기본 접힘, 문제 영역 우선
    const omrToggle = document.getElementById('omr-toggle');
    const omrPanel = document.querySelector('.sim-omr-panel');
    if (omrToggle && omrPanel) {
        if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
            omrPanel.classList.add('omr-collapsed');
            omrToggle.setAttribute('aria-expanded', 'false');
        }
        omrToggle.addEventListener('click', () => {
            const collapsed = omrPanel.classList.toggle('omr-collapsed');
            omrToggle.setAttribute('aria-expanded', String(!collapsed));
        });
    }

    // 대시보드 분석 접이식 — 열림 상태를 세션 간 유지
    const analysisFold = /** @type {HTMLDetailsElement|null} */ (document.getElementById('dashboard-analysis-fold'));
    if (analysisFold) {
        if (safeGetItem('ui_analysis_open') === '1') analysisFold.open = true;
        analysisFold.addEventListener('toggle', () => {
            safeSetItem('ui_analysis_open', analysisFold.open ? '1' : '0');
        });
    }

    // 맞춤학습 인트로 접이식 — 첫 방문은 열림, 접으면 상태 기억
    const introFold = /** @type {HTMLDetailsElement|null} */ (document.getElementById('analysis-intro-fold'));
    if (introFold) {
        introFold.open = safeGetItem('ui_analysis_intro_open') !== '0';
        introFold.addEventListener('toggle', () => {
            safeSetItem('ui_analysis_intro_open', introFold.open ? '1' : '0');
        });
    }

    // 대시보드 보조 통계 접이식 — 열림 상태를 세션 간 유지
    const statsFold = /** @type {HTMLDetailsElement|null} */ (document.getElementById('dashboard-stats-fold'));
    if (statsFold) {
        if (safeGetItem('ui_stats_open') === '1') statsFold.open = true;
        statsFold.addEventListener('toggle', () => {
            safeSetItem('ui_stats_open', statsFold.open ? '1' : '0');
        });
    }
}
