import { describe, it, beforeEach, expect, vi } from 'vitest';
import { getViewTitles, navigateToView } from '../../src/router.js';

// navigation.js의 DOM 의존성 모킹
vi.mock('../../src/state.js', () => ({
    state: { currentView: 'dashboard-view', flashcards: { subject: 'law' } }
}));

vi.mock('../../src/views/navigation.js', () => ({
    saveScrollPosition: vi.fn(),
    restoreScrollPosition: vi.fn()
}));

describe('router.js — DOM 테스트', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="view-title"></div>
            <div id="view-subtitle"></div>
            <div class="main-content">
                <section id="dashboard-view" class="view-section active"></section>
                <section id="flashcard-view" class="view-section"></section>
                <section id="quiz-view" class="view-section"></section>
                <section id="trainer-view" class="view-section"></section>
                <section id="textbook-reader-view" class="view-section"></section>
            </div>
            <nav>
                <button class="nav-item active" data-target="dashboard-view">대시보드</button>
                <button class="nav-item" data-target="flashcard-view">카드</button>
                <button class="nav-item" data-target="quiz-view">퀴즈</button>
                <button class="nav-item" data-target="trainer-view">훈련소</button>
                <button class="nav-item" data-target="textbook-reader-view">교재</button>
            </nav>
            <nav>
                <button class="mobile-tab-item active" data-target="dashboard-view">대시보드</button>
                <button class="mobile-tab-item" data-target="flashcard-view">카드</button>
            </nav>
        `;
    });

    describe('getViewTitles', () => {
        it('기본 타이틀 맵을 반환 (registry 없음)', () => {
            const titles = getViewTitles(null);
            expect(titles['dashboard-view'].title).toBe('학습 대시보드');
            expect(titles['flashcard-view'].title).toBe('개념 플래시카드');
            expect(titles['quiz-view'].title).toBe('기출 및 핵심 퀴즈');
            expect(titles['trainer-view'].title).toBe('스마트 훈련소');
            expect(titles['textbook-reader-view'].title).toBe('교재 본문 읽기');
            expect(titles['dictionary-view'].title).toBe('성분 검색 사전');
        });

        it('registry uiText로 커스텀 타이틀 적용', () => {
            const registry = {
                uiText: {
                    dashboard: { title: '커스텀 대시보드', subtitle: '커스텀 부제' }
                }
            };
            const titles = getViewTitles(registry);
            expect(titles['dashboard-view'].title).toBe('커스텀 대시보드');
            expect(titles['dashboard-view'].subtitle).toBe('커스텀 부제');
            // 미정의 뷰는 기본값
            expect(titles['flashcard-view'].title).toBe('개념 플래시카드');
        });

        it('모든 뷰 ID에 대해 타이틀 존재', () => {
            const titles = getViewTitles(null);
            const expectedViews = [
                'dashboard-view', 'flashcard-view', 'quiz-view', 'review-view',
                'trainer-view', 'exam-view', 'textbook-view', 'textbook-reader-view',
                'dictionary-view'
            ];
            expectedViews.forEach(viewId => {
                expect(titles[viewId]).toBeDefined();
                expect(titles[viewId].title).toBeTruthy();
                expect(titles[viewId].subtitle).toBeTruthy();
            });
        });
    });

    describe('navigateToView', () => {
        it('타겟 뷰를 active로 설정하고 다른 뷰는 비활성화', () => {
            const ctx = {
                titlesMap: getViewTitles(null),
                handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
            };
            navigateToView('flashcard-view', ctx);

            expect(document.getElementById('flashcard-view').classList.contains('active')).toBe(true);
            expect(document.getElementById('dashboard-view').classList.contains('active')).toBe(false);
        });

        it('헤더 타이틀/서브타이틀 업데이트', () => {
            const ctx = {
                titlesMap: getViewTitles(null),
                handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
            };
            navigateToView('quiz-view', ctx);

            expect(document.getElementById('view-title').textContent).toBe('기출 및 핵심 퀴즈');
            expect(document.getElementById('view-subtitle').textContent).toBe('빈칸 채우기형 퀴즈로 실전 완벽 대비');
        });

        it('nav-item 활성화 클래스 동기화', () => {
            const ctx = {
                titlesMap: getViewTitles(null),
                handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
            };
            navigateToView('trainer-view', ctx);

            const activeNav = document.querySelector('.nav-item.active');
            expect(activeNav.getAttribute('data-target')).toBe('trainer-view');
        });

        it('mobile-tab-item 활성화 클래스 동기화', () => {
            const ctx = {
                titlesMap: getViewTitles(null),
                handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
            };
            navigateToView('flashcard-view', ctx);

            const activeTab = document.querySelector('.mobile-tab-item.active');
            expect(activeTab.getAttribute('data-target')).toBe('flashcard-view');
        });

        it('뷰 렌더러 함수 호출', () => {
            const renderFn = vi.fn();
            const ctx = {
                titlesMap: getViewTitles(null),
                handlers: {
                    viewRenderers: { 'quiz-view': renderFn },
                    stopReaderAudio: vi.fn()
                }
            };
            navigateToView('quiz-view', ctx);
            expect(renderFn).toHaveBeenCalledTimes(1);
        });

        it('textbook-reader-view가 아닐 때 stopReaderAudio 호출', () => {
            const stopAudio = vi.fn();
            const ctx = {
                titlesMap: getViewTitles(null),
                handlers: { viewRenderers: {}, stopReaderAudio: stopAudio }
            };
            navigateToView('dashboard-view', ctx);
            expect(stopAudio).toHaveBeenCalledTimes(1);
        });

        it('textbook-reader-view로 이동 시 stopReaderAudio 미호출', () => {
            const stopAudio = vi.fn();
            const ctx = {
                titlesMap: getViewTitles(null),
                handlers: { viewRenderers: {}, stopReaderAudio: stopAudio }
            };
            navigateToView('textbook-reader-view', ctx);
            expect(stopAudio).not.toHaveBeenCalled();
        });

        it('reader-focus-mode 해제 (textbook-reader-view가 아닌 경우)', () => {
            document.body.classList.add('reader-focus-mode');
            const focusBtn = document.createElement('button');
            focusBtn.id = 'reader-focus-toggle';
            focusBtn.classList.add('active');
            focusBtn.innerHTML = '<i></i> <span>집중 모드</span>';
            document.body.appendChild(focusBtn);

            const ctx = {
                titlesMap: getViewTitles(null),
                handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
            };
            navigateToView('dashboard-view', ctx);

            expect(document.body.classList.contains('reader-focus-mode')).toBe(false);
            expect(focusBtn.classList.contains('active')).toBe(false);
        });
    });
});
