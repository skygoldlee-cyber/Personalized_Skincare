// @spec UX-NAV-01,UX-NAV-08,UM-04
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { getViewTitles, navigateToView, initViewHashRouting } from '../../src/router.js';
import { state } from '../../src/state.js';

// navigation.js의 DOM 의존성 모킹
vi.mock('../../src/state.js', () => ({
    state: { currentView: 'dashboard-view', flashcards: { subject: 'law' } }
}));

vi.mock('../../src/views/navigation.js', () => ({
    saveScrollPosition: vi.fn(),
    restoreScrollPosition: vi.fn(),
    registerViewNavigator: vi.fn()
}));

describe('router.js — DOM 테스트', () => {
    beforeEach(() => {
        state.currentView = 'dashboard-view';
        history.replaceState(null, '', location.pathname);
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
            expect(titles['textbook-reader-view'].title).toBe('교재리더');
            expect(titles['dictionary-view'].title).toBe('사전');
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

    describe('접근성 — aria-current + 활성 탭 가시성', () => {
        const ctx = () => ({
            titlesMap: getViewTitles(null),
            handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
        });

        it('활성 nav-item/mobile-tab-item에 aria-current="page" 부여, 나머지는 제거', () => {
            navigateToView('flashcard-view', ctx());

            const activeNav = document.querySelector('.nav-item[data-target="flashcard-view"]');
            expect(activeNav.getAttribute('aria-current')).toBe('page');
            const activeTab = document.querySelector('.mobile-tab-item[data-target="flashcard-view"]');
            expect(activeTab.getAttribute('aria-current')).toBe('page');
            document.querySelectorAll('.nav-item:not([data-target="flashcard-view"]), ' +
                '.mobile-tab-item:not([data-target="flashcard-view"])').forEach(el => {
                expect(el.hasAttribute('aria-current')).toBe(false);
            });
        });

        it('탭 바 안 활성 탭에 scrollIntoView(inline:center) 호출', () => {
            const bar = document.createElement('nav');
            bar.id = 'mobile-tab-bar';
            const tab = document.createElement('button');
            tab.className = 'mobile-tab-item';
            tab.setAttribute('data-target', 'quiz-view');
            tab.scrollIntoView = vi.fn();
            bar.appendChild(tab);
            document.body.appendChild(bar);

            navigateToView('quiz-view', ctx());

            expect(tab.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'center' });
        });

        it('더보기 시트 소속 뷰 활성 시 more-btn이 active + aria-current를 가짐', () => {
            const bar = document.createElement('nav');
            bar.id = 'mobile-tab-bar';
            const moreBtn = document.createElement('button');
            moreBtn.id = 'mobile-more-btn';
            moreBtn.className = 'mobile-tab-item';
            bar.appendChild(moreBtn);
            document.body.appendChild(bar);

            const sheet = document.createElement('div');
            sheet.id = 'mobile-more-sheet';
            const sheetTab = document.createElement('button');
            sheetTab.className = 'mobile-tab-item';
            sheetTab.setAttribute('data-target', 'exam-view');
            sheet.appendChild(sheetTab);
            document.body.appendChild(sheet);

            navigateToView('exam-view', ctx());

            expect(sheetTab.getAttribute('aria-current')).toBe('page');
            expect(moreBtn.classList.contains('active')).toBe(true);
            expect(moreBtn.getAttribute('aria-current')).toBe('page');
        });
    });

    describe('뷰 해시 라우팅', () => {
        const ctx = () => ({
            titlesMap: getViewTitles(null),
            handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
        });

        it('navigateToView 시 URL 해시가 #/slug로 동기화', () => {
            navigateToView('quiz-view', ctx());
            expect(location.hash).toBe('#/quiz');
            navigateToView('dashboard-view', ctx());
            expect(location.hash).toBe('#/dashboard');
        });

        it('initViewHashRouting — 초기 딥링크 해시로 뷰 전환', () => {
            history.replaceState(null, '', '#/quiz');
            initViewHashRouting(ctx());
            expect(state.currentView).toBe('quiz-view');
            expect(document.getElementById('quiz-view').classList.contains('active')).toBe(true);
        });

        it('hashchange 이벤트로 뷰 전환 (뒤로가기 경로)', () => {
            initViewHashRouting(ctx());
            history.pushState({ view: 'flashcard-view' }, '', '#/cards');
            window.dispatchEvent(new Event('hashchange'));
            expect(state.currentView).toBe('flashcard-view');
            expect(document.getElementById('flashcard-view').classList.contains('active')).toBe(true);
        });

        it('알 수 없는 해시는 무시', () => {
            initViewHashRouting(ctx());
            history.pushState(null, '', '#/nope');
            window.dispatchEvent(new Event('hashchange'));
            expect(state.currentView).toBe('dashboard-view');
        });
    });

    describe('뒤로가기 종료 가드', () => {
        const ctx = () => ({
            titlesMap: getViewTitles(null),
            handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
        });
        // 종료 가드는 모바일(터치 우선) 환경에서만 동작 — 테스트는 터치 장치로 시뮬레이션
        const setMobile = (on) => Object.defineProperty(
            navigator, 'maxTouchPoints', { value: on ? 5 : 0, configurable: true }
        );
        beforeEach(() => setMobile(true));
        afterEach(() => setMobile(false));

        it('모바일: 루트 뷰 뒤로가기 → 종료 안내 토스트 + 보초 엔트리 재삽입', () => {
            initViewHashRouting(ctx());
            // 루트에서의 뒤로가기 착륙 시뮬레이션 — 기저 뷰 엔트리로 상태 교체 후 popstate
            history.replaceState({ view: 'dashboard-view' }, '', '#/dashboard');
            window.dispatchEvent(new Event('popstate'));
            const toast = document.getElementById('app-toast');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('종료');
            // 보초가 재삽입되어 현재 엔트리가 sentinel 상태
            expect(history.state && history.state.exitGuard).toBe(true);
        });

        it('PC(비터치)에서는 종료 가드가 발동하지 않는다 — 토스트·보초 없음', () => {
            setMobile(false);
            initViewHashRouting(ctx());
            expect(history.state && history.state.exitGuard).not.toBe(true);
            history.replaceState({ view: 'dashboard-view' }, '', '#/dashboard');
            window.dispatchEvent(new Event('popstate'));
            expect(document.getElementById('app-toast')).toBeFalsy();
        });

        it('모달이 열려 있으면 종료 가드가 개입하지 않는다 (modal-back 우선)', () => {
            initViewHashRouting(ctx());
            document.body.insertAdjacentHTML('beforeend', '<div id="test-modal"></div>');
            history.replaceState({ view: 'dashboard-view' }, '', '#/dashboard');
            window.dispatchEvent(new Event('popstate'));
            expect(document.getElementById('app-toast')).toBeFalsy();
            document.getElementById('test-modal').remove();
        });

        it('모달 마커가 소비한 popstate는 종료 가드를 발동시키지 않는다 (이미지 확대 닫기 회귀)', async () => {
            const { setupModalBackHandler, resetModalBackState } = await import('../../src/modal-back.js');
            setupModalBackHandler();
            initViewHashRouting(ctx());
            // 모달 표시 → MutationObserver → modalBack 마커 push (속성 변경만 감시하므로 class 토글로 트리거)
            document.body.insertAdjacentHTML('beforeend', '<div id="test-zoom-modal" class="is-hidden"></div>');
            document.getElementById('test-zoom-modal').classList.remove('is-hidden');
            await new Promise(r => setTimeout(r, 0)); // observer 마이크로태스크 → 마커 삽입
            history.replaceState({ view: 'dashboard-view' }, '', '#/dashboard');
            window.dispatchEvent(new Event('popstate')); // 뒤로가기로 모달 닫기
            expect(document.getElementById('app-toast')).toBeFalsy();
            expect(document.getElementById('test-zoom-modal').classList.contains('is-hidden')).toBe(true);
            document.getElementById('test-zoom-modal').remove();
            resetModalBackState();
        });
    });
});
