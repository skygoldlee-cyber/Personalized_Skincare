// src/ui-mode.js — 학습/실무 UI 모드 전환
// 합격 후 실무 중심 사용자를 위해 학습 전용 네비게이션을 접고 실무 작업실을 랜딩으로 둔다.
// 모드는 시험과 무관한 기기 설정(GLOBAL_KEYS) — 'ui_mode': 'study' | 'practice'.
import { state, safeGetItem, safeSetItem } from './state.js';
import { STORAGE_KEYS } from './storage-keys.js';
import { hasFeature } from './exam-context.js';
import { switchView } from './views/navigation.js';
import { showToast } from './ui-utils.js';

// 실무 모드에서 기본으로 숨기는 학습 전용 뷰 — 전환 시 현재 뷰가 여기 속하면 랜딩으로 이동
const STUDY_ONLY_VIEWS = new Set([
    'dashboard-view',
    'flashcard-view',
    'quiz-view',
    'trainer-view',
    'review-view',
    'exam-view',
    'textbook-reader-view',
    'textbook-view',
    'calendar-view',
]);

const PRACTICE_LANDING = 'formula-view';

export function getUiMode() {
    return safeGetItem(STORAGE_KEYS.UI_MODE) === 'practice' ? 'practice' : 'study';
}

export function isPracticeMode() {
    return getUiMode() === 'practice';
}

/** body 클래스·토글 라벨·aria 상태를 저장된 모드와 동기화한다. */
export function applyUiMode() {
    const practice = isPracticeMode();
    const open = safeGetItem(STORAGE_KEYS.UI_STUDY_TOOLS_OPEN) === '1';
    document.body.classList.toggle('ui-mode-practice', practice);
    document.body.classList.toggle('study-tools-open', open);
    // 토글이 두 곳(사이드바 푸터·설정 패널)에 있으므로 라벨/aria를 일괄 동기화
    document.querySelectorAll('.ui-mode-label').forEach(el => {
        el.textContent = practice ? '실무 모드' : '학습 모드';
    });
    document.querySelectorAll('[data-click="toggleUiMode"]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(practice));
    });
    // 펼침 토글도 두 곳(사이드바 라벨·모바일 탭) — aria 일괄 동기화
    document.querySelectorAll('[data-click="toggleStudyTools"]').forEach(btn => {
        btn.setAttribute('aria-expanded', String(open));
    });
}

/** 앱 초기화 시 호출 — 모드 반영 후 실무 모드면 실무 작업실로 랜딩한다. */
export function initUiMode() {
    applyUiMode();
    if (isPracticeMode() && hasFeature('formula')) {
        switchView(PRACTICE_LANDING);
    }
}

export function toggleUiMode() {
    const next = isPracticeMode() ? 'study' : 'practice';
    safeSetItem(STORAGE_KEYS.UI_MODE, next);
    applyUiMode();
    if (next === 'practice'
        && STUDY_ONLY_VIEWS.has(state.currentView)
        && hasFeature('formula')) {
        switchView(PRACTICE_LANDING);
    }
    showToast(next === 'practice'
        ? '실무 모드로 전환했습니다. 학습 기능은 "학습 도구"에서 열 수 있습니다.'
        : '학습 모드로 전환했습니다.');
}

/** 실무 모드에서 숨겨진 학습 항목을 펼치거나 접는다. */
export function toggleStudyTools() {
    const open = !document.body.classList.contains('study-tools-open');
    document.body.classList.toggle('study-tools-open', open);
    safeSetItem(STORAGE_KEYS.UI_STUDY_TOOLS_OPEN, open ? '1' : '0');
    document.querySelectorAll('[data-click="toggleStudyTools"]').forEach(btn => {
        btn.setAttribute('aria-expanded', String(open));
    });
}
