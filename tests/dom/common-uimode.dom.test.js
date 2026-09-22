// tests/dom/common-uimode.dom.test.js — 학습/실무 UI 모드 시나리오
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadIndexHtml, el, lastToast, injectCssFile } from './helpers.js';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showAlert: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: {},
}));

vi.mock('../../src/views/navigation.js', () => ({
    switchView: vi.fn(),
    saveScrollPosition: vi.fn(),
    restoreScrollPosition: vi.fn(),
}));

import { switchView } from '../../src/views/navigation.js';
import { state } from '../../src/state.js';
import {
    getUiMode, isPracticeMode, applyUiMode, initUiMode,
    toggleUiMode, toggleStudyTools,
} from '../../src/ui-mode.js';

const STUDY_ONLY = [
    'dashboard-view', 'flashcard-view', 'quiz-view',
    'trainer-view', 'review-view', 'exam-view',
    'textbook-reader-view', 'textbook-view', 'calendar-view',
];

// formula 피처 활성 시험 스텁 — hasFeature('formula')가 true여야 실무 랜딩이 발화
const EXAMS = {
    exams: [
        { id: 'cosmetic', name: '조제관리사', default: true, features: { formula: true } },
    ],
};

function visibleNavTargets() {
    return [...document.querySelectorAll('.nav-item')]
        .filter(b => getComputedStyle(b).display !== 'none')
        .map(b => b.dataset.target);
}

describe('UI 모드 — 학습/실무 전환', () => {
    beforeEach(() => {
        localStorage.clear();
        document.head.querySelectorAll('style').forEach(s => s.remove());
        injectCssFile('css/base.css');
        loadIndexHtml();
        window.EXAMS_LIST = EXAMS;
        document.body.classList.remove('ui-mode-practice', 'study-tools-open');
        state.currentView = 'dashboard-view';
        vi.clearAllMocks();
    });

    it('기본 상태 — 학습 모드: 학습 항목 표시·학습 도구 라벨 숨김 (H/E)', () => {
        applyUiMode();
        expect(getUiMode()).toBe('study');
        expect(document.body.classList.contains('ui-mode-practice')).toBe(false);
        STUDY_ONLY.forEach(v => expect(visibleNavTargets()).toContain(v));
        expect(getComputedStyle(document.querySelector('.nav-study-tools-label')).display).toBe('none');
        // 토글 2곳(푸터·설정) 라벨·aria 동기화
        document.querySelectorAll('.ui-mode-label').forEach(l => expect(l.textContent).toBe('학습 모드'));
        document.querySelectorAll('[data-click="toggleUiMode"]').forEach(b => expect(b.getAttribute('aria-pressed')).toBe('false'));
        // 학습 매뉴얼 표시·실무 전용 탭 숨김
        expect(getComputedStyle(document.querySelector('.manual-nav-link.nav-study-only')).display).not.toBe('none');
        expect(getComputedStyle(document.querySelector('.nav-practice-only')).display).toBe('none');
    });

    it('실무 모드 전환 — 학습 항목 실제 숨김·도구 라벨 표시·영속 (H/P)', () => {
        toggleUiMode();
        expect(isPracticeMode()).toBe(true);
        expect(localStorage.getItem('ui_mode')).toBe('practice');
        expect(document.body.classList.contains('ui-mode-practice')).toBe(true);
        // 실제 base.css 캐스케이드로 nav-item이 display:none인지 검증
        const targets = visibleNavTargets();
        STUDY_ONLY.forEach(v => expect(targets).not.toContain(v));
        // 실무에서도 필요한 항목만 표시 — 실무 작업실 + 성분 사전
        expect(targets).toContain('formula-view');
        expect(targets).toContain('dictionary-view');
        // 학습 도구 라벨은 실무 모드에서 표시
        expect(getComputedStyle(document.querySelector('.nav-study-tools-label')).display).not.toBe('none');
        // 학습 매뉴얼 숨김·실무 매뉴얼 탭은 표시 (모바일 실무매뉴얼 교체)
        expect(getComputedStyle(document.querySelector('.manual-nav-link.nav-study-only')).display).toBe('none');
        // 실무 전용 탭 2개(실무매뉴얼·학습도구) 모두 표시
        expect(document.querySelectorAll('.nav-practice-only')).toHaveLength(2);
        document.querySelectorAll('.nav-practice-only').forEach(t => {
            expect(getComputedStyle(t).display).not.toBe('none');
        });
        // 모바일 학습도구 탭 존재 — 사이드바 없는 환경의 학습 항목 펼침 경로
        const mobileToolsTab = document.querySelector('.mobile-tab-item[data-click="toggleStudyTools"]');
        expect(mobileToolsTab).not.toBeNull();
        expect(mobileToolsTab.getAttribute('aria-expanded')).toBe('false');
        document.querySelectorAll('.ui-mode-label').forEach(l => expect(l.textContent).toBe('실무 모드'));
        document.querySelectorAll('[data-click="toggleUiMode"]').forEach(b => expect(b.getAttribute('aria-pressed')).toBe('true'));
        expect(lastToast()[0]).toContain('실무 모드');
    });

    it('실무 모드 전환 — 학습 전용 뷰에 있으면 formula-view로 이동 (H)', () => {
        state.currentView = 'dashboard-view';
        toggleUiMode();
        expect(switchView).toHaveBeenCalledWith('formula-view');
    });

    it('실무 모드 전환 — 실무 뷰에 있으면 이동하지 않음 (B)', () => {
        state.currentView = 'formula-view';
        toggleUiMode();
        expect(switchView).not.toHaveBeenCalled();
    });

    it('학습 도구 펼침 — 숨겨진 항목 재표시 + aria-expanded·영속 (H/P)', () => {
        toggleUiMode(); // 실무 모드 진입
        toggleStudyTools();
        expect(document.body.classList.contains('study-tools-open')).toBe(true);
        expect(localStorage.getItem('ui_study_tools_open')).toBe('1');
        // 펼침 토글 2곳(사이드바 라벨·모바일 탭) aria 동기화
        document.querySelectorAll('[data-click="toggleStudyTools"]').forEach(b => {
            expect(b.getAttribute('aria-expanded')).toBe('true');
        });
        // 펼치면 학습 항목이 실제로 다시 표시됨
        STUDY_ONLY.forEach(v => expect(visibleNavTargets()).toContain(v));
        toggleStudyTools();
        expect(document.body.classList.contains('study-tools-open')).toBe(false);
        expect(localStorage.getItem('ui_study_tools_open')).toBe('0');
        STUDY_ONLY.forEach(v => expect(visibleNavTargets()).not.toContain(v));
    });

    it('저장된 실무 모드 복원 — initUiMode 시 formula-view 랜딩 (P/R)', () => {
        localStorage.setItem('ui_mode', 'practice');
        localStorage.setItem('ui_study_tools_open', '1');
        initUiMode();
        expect(document.body.classList.contains('ui-mode-practice')).toBe(true);
        expect(document.body.classList.contains('study-tools-open')).toBe(true);
        expect(switchView).toHaveBeenCalledWith('formula-view');
        expect(el('ui-mode-label').textContent).toBe('실무 모드');
    });

    it('학습 모드 복귀 — 클래스 해제·학습 항목 표시 (R)', () => {
        toggleUiMode(); // practice
        toggleUiMode(); // study
        expect(getUiMode()).toBe('study');
        expect(document.body.classList.contains('ui-mode-practice')).toBe(false);
        STUDY_ONLY.forEach(v => expect(visibleNavTargets()).toContain(v));
        expect(lastToast()[0]).toContain('학습 모드');
    });
});
