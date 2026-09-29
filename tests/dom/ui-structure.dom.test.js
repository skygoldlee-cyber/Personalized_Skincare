// tests/dom/ui-structure.dom.test.js — UI/UX 전체 구조 불변식 테스트
// @spec UX-NAV-01,UX-NAV-08,UM-04
// 라우팅·네비게이션·오버레이·포커스 등 "앱 구조" 계약을 한 파일에서 검증한다.
// 개별 기능 테스트가 아니라 구조 일관성(모든 뷰가 라우트에 등록됐는가,
// 네비 표면이 일치하는가, 모달 뒤로가기가 살아 있는가)을 감시하는 회귀망.
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { loadIndexHtml, el } from './helpers.js';

// ---------------------------------------------------------------------------
// 공용 목 — state는 각 describe에서 필요한 형태로 주입한다
// ---------------------------------------------------------------------------
vi.mock('../../src/state.js', () => ({
    state: {
        currentView: 'dashboard-view',
        flashcards: { subject: 'law' },
        trainer: { activeSubView: 'menu' }
    },
    safeGetItem: vi.fn(() => null),
    safeSetItem: vi.fn(),
    safeRemoveItem: vi.fn(),
    loadProgress: vi.fn(),
    saveProgress: vi.fn(),
    cleanOrphansForSubject: vi.fn(),
    getSimResultsHistory: vi.fn(() => []),
    setDataWriteHook: vi.fn()
}));
vi.mock('../../src/usage-stats.js', () => ({
    trackView: vi.fn(), trackAction: vi.fn(),
    showUsageStats: vi.fn(), getActionCount: vi.fn(() => 0)
}));
// 트레이너 하위 모듈은 무거운 의존성을 가지므로 최소 형태로 대체
vi.mock('../../src/views/trainer-drills.js', () => ({ updateDueBadges: vi.fn() }));
vi.mock('../../src/views/trainer-calc-practice.js', () => ({
    startCalcPractice: vi.fn(), generateCalcQuestion: vi.fn(),
    submitCalcAnswer: vi.fn(), toggleSolutionAccordion: vi.fn()
}));
vi.mock('../../src/views/trainer-ingredients.js', () => ({
    startIngredientsChallenge: vi.fn(), submitIngAnswer: vi.fn(), nextIngQuestion: vi.fn()
}));

const { state } = await import('../../src/state.js');
const {
    getViewTitles, navigateToView, initViewHashRouting, VIEW_HASH_SLUGS
} = await import('../../src/router.js');
const { switchView } = await import('../../src/views/navigation.js');
const { setupModalBackHandler, resetModalBackState } = await import('../../src/modal-back.js');

const ctx = () => ({
    titlesMap: getViewTitles(null),
    handlers: { viewRenderers: {}, stopReaderAudio: vi.fn() }
});

/** MutationObserver 마이크로태스크 플러시 */
const flush = () => new Promise(r => setTimeout(r, 0));

// ===========================================================================
// 1. 실제 index.html 기준 구조 불변식
// ===========================================================================
describe('UI 구조 불변식 — index.html 실마크업', () => {
    beforeEach(() => {
        loadIndexHtml();
    });

    it('모든 id가 문서 내 유일하다', () => {
        const ids = [...document.querySelectorAll('[id]')].map(n => n.id);
        const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dup).toEqual([]);
    });

    it('모든 .view-section이 라우트 해시 슬러그를 갖는다', () => {
        const sections = [...document.querySelectorAll('.view-section')].map(s => s.id);
        expect(sections.length).toBeGreaterThan(0);
        sections.forEach(id => {
            expect(VIEW_HASH_SLUGS[id], `${id}에 해시 슬러그가 없다`).toBeTruthy();
        });
        // 반대 방향 — 슬러그가 가리키는 뷰도 실재해야 함
        Object.keys(VIEW_HASH_SLUGS).forEach(id => {
            expect(el(id), `${id} 섹션이 DOM에 없다`).toBeTruthy();
        });
    });

    it('모든 data-target이 실제 view-section을 가리킨다', () => {
        document.querySelectorAll('[data-target]').forEach(n => {
            const t = n.getAttribute('data-target');
            const sec = el(t);
            expect(sec, `${t} 섹션 없음`).toBeTruthy();
            expect(sec.classList.contains('view-section'), `${t}은 view-section이 아님`).toBe(true);
        });
    });

    it('라우트 타이틀 맵이 모든 view-section을 커버한다', () => {
        const titles = getViewTitles(null);
        document.querySelectorAll('.view-section').forEach(sec => {
            expect(titles[sec.id], `${sec.id} 타이틀 없음`).toBeTruthy();
            expect(titles[sec.id].title).toBeTruthy();
            expect(titles[sec.id].subtitle).toBeTruthy();
        });
    });

    it('모바일 탭 바는 5+N 패턴 — 탭 바 직접 항목이 과밀하지 않다', () => {
        const barTabs = document.querySelectorAll('#mobile-tab-bar .mobile-tab-item[data-target]');
        expect(barTabs.length).toBeLessThanOrEqual(5);
        // 더보기 시트에 나머지 뷰가 있어야 함
        const sheetTargets = new Set(
            [...document.querySelectorAll('#mobile-more-sheet .mobile-tab-item[data-target]')]
                .map(n => n.getAttribute('data-target'))
        );
        const barTargets = new Set([...barTabs].map(n => n.getAttribute('data-target')));
        const allViewTargets = new Set(
            [...document.querySelectorAll('.nav-item[data-target]')].map(n => n.getAttribute('data-target'))
        );
        allViewTargets.forEach(t => {
            expect(barTargets.has(t) || sheetTargets.has(t),
                `${t}가 모바일에서 도달 불가`).toBe(true);
        });
    });

    it('모바일 탭/시트 버튼은 라우팅·위임·직접 바인딩 중 하나의 동작 마커를 갖는다 (dead 버튼 없음)', () => {
        // data-target=라우트, data-click=위임, aria-haspopup=시트 토글, id=직접 바인딩(테마 등)
        document.querySelectorAll('#mobile-tab-bar .mobile-tab-item, #mobile-more-sheet .mobile-tab-item')
            .forEach(btn => {
                const bound = btn.hasAttribute('data-target') || btn.hasAttribute('data-click')
                    || btn.hasAttribute('aria-haspopup') || !!btn.id;
                expect(bound, `버튼 "${btn.textContent.trim()}"이 무동작`).toBe(true);
            });
    });

    it('모달/시트 오버레이는 dialog 시맨틱을 갖는다', () => {
        // is-hidden으로 시작하는 고정 오버레이 컨테이너들
        ['mobile-more-sheet', 'auth-modal', 'pwa-install-modal'].forEach(id => {
            const overlay = el(id);
            expect(overlay, `${id} 없음`).toBeTruthy();
            expect(overlay.getAttribute('role'), `${id} role`).toBe('dialog');
            expect(overlay.getAttribute('aria-modal'), `${id} aria-modal`).toBe('true');
        });
    });

    it('skip-link가 존재하는 main-content를 가리킨다', () => {
        const skip = document.querySelector('a.skip-link, [class*="skip"]');
        const main = el('main-content');
        expect(main).toBeTruthy();
        expect(main.getAttribute('tabindex')).toBe('-1');
        if (skip) {
            expect(skip.getAttribute('href')).toBe('#main-content');
        }
    });

    it('비활성 뷰는 active 클래스를 갖지 않고 하나만 활성이다', () => {
        const active = document.querySelectorAll('.view-section.active');
        expect(active.length).toBe(1);
        expect(active[0].id).toBe('dashboard-view');
    });
});

// ===========================================================================
// 2. 뷰 전환 계약 — 제목·해시·포커스 (P2/P3 회귀)
// ===========================================================================
describe('뷰 전환 계약', () => {
    beforeEach(() => {
        history.replaceState(null, '', location.pathname);
        state.currentView = 'dashboard-view';
        document.body.innerHTML = `
            <div id="view-title"></div>
            <div id="view-subtitle"></div>
            <main class="main-content" id="main-content" tabindex="-1">
                <section id="dashboard-view" class="view-section active"></section>
                <section id="exam-select-view" class="view-section"></section>
                <section id="quiz-view" class="view-section"></section>
            </main>`;
    });

    it('nav-item 없는 뷰(exam-select)도 switchView가 라우터 경로로 전환한다 (P2)', () => {
        // nav-item이 의도적으로 없음 — exam-select-view는 data-click 진입 전용
        initViewHashRouting(ctx());
        switchView('exam-select-view', { scrollTop: true });

        expect(state.currentView).toBe('exam-select-view');
        expect(el('exam-select-view').classList.contains('active')).toBe(true);
        // 폴백이 아니라 정식 라우트 — 제목·해시까지 동기화돼야 한다
        expect(el('view-title').textContent).toBe('시험 선택');
        expect(location.hash).toBe('#/exams');
    });

    it('nav-item 없는 뷰 전환 시 렌더러도 디스패치된다 (P2)', () => {
        const render = vi.fn();
        const c = ctx();
        c.handlers.viewRenderers = { 'exam-select-view': render };
        initViewHashRouting(c);
        switchView('exam-select-view');
        expect(render).toHaveBeenCalledTimes(1);
    });

    it('뷰 전환 후 포커스가 main-content로 이동한다 (P3)', () => {
        initViewHashRouting(ctx());
        navigateToView('quiz-view', ctx());
        expect(document.activeElement).toBe(document.querySelector('.main-content'));
    });
});

// ===========================================================================
// 3. 모달 뒤로가기 — is-hidden 토글 감지 + popstate 닫기 (P1 회귀)
// ===========================================================================
describe('모달 뒤로가기 (modal-back)', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-modal" class="is-hidden" role="dialog" aria-modal="true">
                <button id="test-modal-close" aria-label="닫기">×</button>
            </div>`;
        history.replaceState(null, '', '#/dashboard');
        resetModalBackState();
        setupModalBackHandler();
    });

    it('is-hidden 해제로 모달이 열리면 pushState 마커가 쌓인다', async () => {
        el('test-modal').classList.remove('is-hidden');
        await flush();
        expect(history.state && history.state.modalBack).toBe(true);
    });

    it('popstate 시 열린 모달이 닫힌다 — 뷰 이탈 대신 모달 닫기', async () => {
        el('test-modal').classList.remove('is-hidden');
        await flush();
        expect(history.state && history.state.modalBack).toBe(true);

        window.dispatchEvent(new Event('popstate'));
        await flush();
        expect(el('test-modal').classList.contains('is-hidden')).toBe(true);
    });

    it('동적 생성 모달도 감지한다 (머메이드 확대 모달 회귀)', async () => {
        const modal = document.createElement('div');
        modal.id = 'dynamic-modal';
        modal.setAttribute('role', 'dialog');
        modal.classList.add('is-hidden');
        document.body.appendChild(modal);

        modal.classList.remove('is-hidden');
        await flush();
        expect(history.state && history.state.modalBack).toBe(true);
    });

    it('모달 없는 popstate는 무시한다 — 해시 라우팅과 공존', async () => {
        // 모달을 열지 않은 상태에서 popstate — 아무 동작 없어야 함
        window.dispatchEvent(new Event('popstate'));
        await flush();
        expect(el('test-modal').classList.contains('is-hidden')).toBe(true);
    });
});

// ===========================================================================
// 4. 트레이너 서브뷰 해시 라우팅 (P4 회귀)
// ===========================================================================
describe('트레이너 서브뷰 해시 (P4)', () => {
    beforeEach(async () => {
        history.replaceState(null, '', '#/trainer');
        state.currentView = 'trainer-view';
        document.body.innerHTML = `
            <section id="trainer-view" class="view-section active">
                <div id="trainer-menu-panel"></div>
                <div id="trainer-limits-panel" class="is-hidden"></div>
                <div id="trainer-oxdrill-panel" class="is-hidden"></div>
            </section>`;
        const { initTrainer } = await import('../../src/views/trainer.js');
        initTrainer(); // 옵저버·리스너 설치 + 메뉴 초기화
        await flush();
    });

    it('서브패널이 열리면 #/trainer/<slug>로 push된다', async () => {
        el('trainer-limits-panel').classList.remove('is-hidden');
        await flush();
        expect(location.hash).toBe('#/trainer/limits');
    });

    it('#/trainer 복귀 hashchange 시 열린 서브패널이 메뉴로 돌아간다', async () => {
        el('trainer-limits-panel').classList.remove('is-hidden');
        await flush();
        expect(location.hash).toBe('#/trainer/limits');

        history.pushState({ view: 'trainer-view' }, '', '#/trainer');
        window.dispatchEvent(new Event('hashchange'));
        await flush();
        expect(el('trainer-limits-panel').classList.contains('is-hidden')).toBe(true);
        expect(el('trainer-menu-panel').classList.contains('is-hidden')).toBe(false);
    });

    it('메뉴 복귀 시 사장된 서브 해시가 #/trainer로 정규화된다', async () => {
        el('trainer-oxdrill-panel').classList.remove('is-hidden');
        await flush();
        expect(location.hash).toBe('#/trainer/oxdrill');

        const { initTrainer } = await import('../../src/views/trainer.js');
        initTrainer();
        await flush();
        expect(location.hash).toBe('#/trainer');
    });
});
