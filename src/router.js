// src/router.js - 뷰 라우터: 타이틀 맵 및 뷰 렌더링 디스패치 (app.js에서 분리)
// @spec UX-NAV-01,UX-NAV-08,UM-04
import { state } from './state.js';
import { saveScrollPosition, restoreScrollPosition } from './views/navigation.js';

/**
 * 레지스트리 기반 뷰 타이틀 맵 생성
 * @param {object} registry - DATA_REGISTRY
 * @returns {Record<string, {title: string, subtitle: string}>}
 */
export function getViewTitles(registry) {
    const uiText = (registry && registry.uiText) || {};
    return {
        'dashboard-view': uiText.dashboard || { title: '학습 대시보드', subtitle: '시험 합격을 위한 분석 및 스마트 툴' },
        'analysis-view': uiText.analysis || { title: '맞춤학습', subtitle: '학습 기록을 바탕으로 약점을 분석하여 학습 우선순위를 진단합니다' },
        'flashcard-view': uiText.flashcard || { title: '개념 플래시카드', subtitle: '과목별 핵심 개념을 카드로 뒤집으며 암기' },
        'quiz-view': uiText.quiz || { title: '기출 및 핵심 퀴즈', subtitle: '빈칸 채우기형 퀴즈로 실전 완벽 대비' },
        'review-view': uiText.review || { title: '오답 및 중요 복습', subtitle: '헷갈리거나 어려운 약점 카드 집중 복습' },
        'trainer-view': uiText.trainer || { title: '스마트 훈련소', subtitle: '법령 수치 암기 및 배합 계산 트레이닝 센터' },
        'exam-view': uiText.exam || { title: '실전 모의고사', subtitle: '문제은행으로 과목별 모의고사 및 학습안내서 열람' },
        'textbook-view': uiText.textbook || { title: '교재검색', subtitle: '교재의 모든 본문 내용을 실시간 키워드로 검색' },
        'textbook-reader-view': uiText['textbook-reader'] || { title: '교재리더', subtitle: '과목을 선택하여 교재 본문을 읽기' },
        'dictionary-view': uiText.dictionary || { title: '성분검색', subtitle: '화장품 성분별 배합한도 및 고시 기준 통합 검색기' },
        'formula-view': { title: 'Formula OS', subtitle: '원료 조회 · 배합 계산 · My 포뮬러 저장·검증' },
        'calendar-view': { title: '학습 캘린더', subtitle: '날짜별 학습 기록 및 목표 달성률 추적' },
        'exam-select-view': { title: '시험 선택', subtitle: '학습할 시험을 선택하세요 — 진도는 시험별로 독립 관리됩니다' }
    };
}

/**
 * 타겟 뷰로 전환하고 해당 뷰를 렌더링한다.
 * @param {string} target - 타겟 뷰 ID
 * @param {object} ctx - 렌더링 컨텍스트 (app.js에서 전달)
 * @param {object} ctx.titlesMap - getViewTitles() 결과
 * @param {object} ctx.handlers - 뷰별 렌더 핸들러 함수들
 * @param {function} [ctx.handlers.onExitReader] - 리더 뷰 벗어날 때 (focus mode 해제 등)
 * @param {function} [ctx.handlers.stopReaderAudio] - 오디오 정지
 * @param {Object.<string, function>} [ctx.handlers.viewRenderers] - 뷰 ID → 렌더 함수 맵
 */
export function navigateToView(target, ctx) {
    const { titlesMap, handlers } = ctx;
    const sections = document.querySelectorAll('.view-section');

    // 현재 뷰 스크롤 위치 저장
    saveScrollPosition(state.currentView);

    // 네비게이션 활성화 클래스 변경 (사이드바 + 모바일 탭 바 모두 동기화)
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        nav.removeAttribute('aria-current');
    });
    const navItem = document.querySelector(`.nav-item[data-target="${target}"]`);
    if (navItem) {
        navItem.classList.add('active');
        navItem.setAttribute('aria-current', 'page');
    }

    // 모바일 탭 바·더보기 시트 활성화 상태 동기화
    let tabBarHit = false;
    document.querySelectorAll('.mobile-tab-item').forEach(tab => {
        tab.classList.remove('active');
        tab.removeAttribute('aria-current');
        if (tab.getAttribute('data-target') === target) {
            tab.classList.add('active');
            tab.setAttribute('aria-current', 'page');
            if (tab.closest('#mobile-tab-bar')) {
                tabBarHit = true;
                // 활성 탭이 탭 바 화면 밖에 있으면 중앙으로 스크롤
                if (typeof tab.scrollIntoView === 'function') {
                    tab.scrollIntoView({ block: 'nearest', inline: 'center' });
                }
            }
        }
    });
    // 활성 뷰가 '더보기' 시트에만 있으면 더보기 탭을 활성 표시
    const moreBtn = document.getElementById('mobile-more-btn');
    if (moreBtn) {
        const inSheet = !tabBarHit
            && !!document.querySelector(`#mobile-more-sheet .mobile-tab-item[data-target="${target}"]`);
        moreBtn.classList.toggle('active', inSheet);
        if (inSheet) moreBtn.setAttribute('aria-current', 'page');
        else moreBtn.removeAttribute('aria-current');
    }

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
    if (target !== 'textbook-reader-view' && typeof handlers.stopReaderAudio === 'function') {
        handlers.stopReaderAudio();
    }

    // 섹션 토글
    sections.forEach(sec => sec.classList.remove('active'));
    const targetEl = document.getElementById(target);
    if (targetEl) targetEl.classList.add('active');

    // 헤더 텍스트 변경
    const viewTitle = document.getElementById('view-title');
    const viewSubtitle = document.getElementById('view-subtitle');
    if (titlesMap[target]) {
        if (viewTitle) viewTitle.textContent = titlesMap[target].title;
        if (viewSubtitle) viewSubtitle.textContent = titlesMap[target].subtitle;
    }

    state.currentView = target;

    // 각 뷰 진입 시 렌더링 갱신 — 핸들러 맵에서 디스패치
    const renderFn = handlers.viewRenderers && handlers.viewRenderers[target];
    if (typeof renderFn === 'function') {
        renderFn();
    }

    // 새 뷰 스크롤 위치 복원
    restoreScrollPosition(target);

    // URL 해시 동기화 — OS/브라우저 뒤로가기로 이전 뷰 복귀 + 딥링크 공유
    syncViewHash(target);
}

/* =========================================================
   뷰 해시 라우팅 — 현재 뷰를 #/슬러그로 URL에 반영해
   뒤로가기 복귀·딥링크 공유를 지원한다 (UX-NAV 확장)
   ========================================================= */
const VIEW_HASH_SLUGS = {
    'dashboard-view': 'dashboard',
    'analysis-view': 'analysis',
    'flashcard-view': 'cards',
    'quiz-view': 'quiz',
    'review-view': 'review',
    'trainer-view': 'trainer',
    'exam-view': 'exam',
    'textbook-view': 'textbook',
    'textbook-reader-view': 'reader',
    'dictionary-view': 'ingredients',
    'formula-view': 'formula',
    'calendar-view': 'calendar',
    'exam-select-view': 'exams',
};
const HASH_SLUG_VIEWS = Object.fromEntries(
    Object.entries(VIEW_HASH_SLUGS).map(([view, slug]) => [slug, view])
);
// hashchange → navigateToView 재진입 시 pushState를 건너뛰기 위한 플래그
let _hashNavigating = false;

function _viewFromLocation() {
    const slug = String(location.hash || '').replace(/^#\/?/, '').split('/')[0];
    return HASH_SLUG_VIEWS[slug] || null;
}

function syncViewHash(target) {
    if (_hashNavigating) return;
    const slug = VIEW_HASH_SLUGS[target];
    if (!slug || location.hash === '#/' + slug) return;
    try {
        history.pushState({ view: target }, '', '#/' + slug);
    } catch (_) {
        // file:// 등 pushState 제한 환경 — 해시 직접 할당으로 폴백
        location.hash = '/' + slug;
    }
}

/**
 * 해시 라우팅 초기화 — 초기 딥링크 적용 + 뒤로가기/해시 변경 감지.
 * setupNavigation의 routerCtx를 그대로 받아 navigateToView로 디스패치한다.
 * @param {object} ctx - navigateToView와 동일한 렌더링 컨텍스트
 */
export function initViewHashRouting(ctx) {
    // 딥링크: #/quiz 등 해시로 진입 시 해당 뷰로 바로 이동
    const initial = _viewFromLocation();
    if (initial && initial !== state.currentView) {
        _hashNavigating = true;
        navigateToView(initial, ctx);
        _hashNavigating = false;
    }
    // 뒤로가기 기저 지점 — 현재 뷰를 히스토리 첫 엔트리로 기록
    const slug = VIEW_HASH_SLUGS[state.currentView];
    if (slug && !location.hash) {
        try { history.replaceState({ view: state.currentView }, '', '#/' + slug); }
        catch (_) { /* 제한 환경 무시 */ }
    }
    window.addEventListener('hashchange', () => {
        const view = _viewFromLocation();
        if (!view || view === state.currentView) return;
        _hashNavigating = true;
        navigateToView(view, ctx);
        _hashNavigating = false;
    });
}
