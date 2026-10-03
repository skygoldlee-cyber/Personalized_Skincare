// src/router.js - 뷰 라우터: 타이틀 맵 및 뷰 렌더링 디스패치 (app.js에서 분리)
// @spec UX-NAV-01,UX-NAV-08,UM-04
import { state } from './state.js';
import { saveScrollPosition, restoreScrollPosition, registerViewNavigator } from './views/navigation.js';
import { showToast } from './ui-utils.js';
import { isAnyModalOpen, consumedModalPop } from './modal-back.js';
import { getPracticeViewTitles, getPracticeHashSlugs } from './practice-registry.js';

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
        'dictionary-view': uiText.dictionary || { title: '사전', subtitle: '지식DB 항목 검색' },
        'calendar-view': { title: '학습 캘린더', subtitle: '날짜별 학습 기록 및 목표 달성률 추적' },
        'exam-select-view': { title: '시험 선택', subtitle: '학습할 시험을 선택하세요 — 진도는 시험별로 독립 관리됩니다' },
        // 실무 피처 뷰 타이틀 — practice-registry 선언에서 유도
        ...getPracticeViewTitles()
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

    // 리더 화면을 벗어나면 재생 중인 오디오 정지
    if (target !== 'textbook-reader-view' && typeof handlers.stopReaderAudio === 'function') {
        handlers.stopReaderAudio();
    }

    // 섹션 토글
    sections.forEach(sec => sec.classList.remove('active'));
    const targetEl = document.getElementById(target);
    if (targetEl) targetEl.classList.add('active');

    // SPA 뷰 전환 = 페이지 전환 — 키보드·스크린리더 포커스를 본문 영역으로 이동.
    // main-content는 tabindex="-1" 보유. preventScroll로 스크롤 복원과 충돌 방지.
    const mainContent = /** @type {HTMLElement|null} */ (document.querySelector('.main-content'));
    if (mainContent) {
        mainContent.focus({ preventScroll: true });
    }

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
export const VIEW_HASH_SLUGS = {
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
    'calendar-view': 'calendar',
    'exam-select-view': 'exams',
    // 실무 피처 뷰 슬러그 — practice-registry 선언에서 유도
    ...getPracticeHashSlugs(),
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

/* =========================================================
   뒤로가기 종료 가드 — 루트 뷰에서의 뒤로가기가 PWA/탭을 즉시
   종료시키지 않도록 동일 URL의 보초 엔트리를 쌓는다.
   보초 소비(= 루트에서의 뒤로가기) 시 종료 안내 토스트를 띄우고
   보초를 다시 쌓으며, 짧은 창 안에 반복되면 실제 종료를 허용한다.
   모달이 열려 있거나 방금 모달 마커가 popstate를 소비했으면 건드리지 않는다.
   데스크톱/PC에서는 동작하지 않는다 — 뒤로가기 종료 경고는
   OS 제스처로 앱이 바로 닫히는 모바일 PWA에서만 의미가 있다.
   ========================================================= */
const EXIT_GUARD_WINDOW_MS = 2500;
let _exitGuardArmedAt = 0;
let _exitGuardBound = false;
// 마지막 hashchange 기록 — 뷰 간 뒤로가기는 popstate와 hashchange를 동반한다.
// 두 이벤트의 도착 순서는 브라우저마다 다르므로(특히 모바일 WebView), 착륙
// 시점의 state.currentView 비교만으로는 "루트 종료"와 "뷰 전환"을 구분할 수 없다.
// seq는 popstate 이후 도착한 hashchange를, at은 직전에 도착한 hashchange를 잡는다.
let _hashNavSeq = 0;
let _lastHashNavAt = 0;

// 종료 가드는 터치 우선(모바일) 환경에서만 활성 — PC 뒤로가기는
// 앱 종료가 아니라 일반 탐색이므로 경고 토스트가 소음이 된다.
function _isMobileLike() {
    return !!((window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        || navigator.maxTouchPoints > 1);
}

function _pushExitGuard() {
    try { history.pushState({ exitGuard: true }, ''); } catch (_) { /* 제한 환경 */ }
}

/** popstate 핸들러 — 히스토리 기저(초기 뷰 엔트리 또는 보초) 착륙 감지. */
function _handleExitGuardPopstate() {
    // 모달이 떠 있거나, 직전 popstate를 모달 마커가 소비한 경우는
    // 사용자가 루트를 벗어나려 한 게 아니므로 가드를 발동하지 않는다.
    if (!_isMobileLike() || isAnyModalOpen() || consumedModalPop()) return;
    const s = history.state;
    // 기저 엔트리 판정 — 뷰 스탬프·보초 마커·(딥링크 직접 진입의) 무스탬프 모두 커버
    const isBase = s ? (s.view === state.currentView || s.exitGuard === true) : true;
    if (!isBase) return;
    // 해시가 바뀐 착륙(뷰 간 이동)은 hashchange가 처리한다. 그런데 popstate와
    // hashchange의 도착 순서는 브라우저마다 다르다 — hashchange가 먼저 오는
    // 환경에서는 여기 도달할 때 currentView가 이미 전환된 상태라 위의 뷰 비교가
    // 무의미해진다. 그래서 판정을 태스크 경계 뒤로 미뤄, 같은 탐색에서
    // hashchange가 발생했다면 뷰 전환으로 보고 종료 가드를 건너뛴다.
    const seqAtPop = _hashNavSeq;
    const poppedAt = Date.now();
    setTimeout(() => {
        if (isAnyModalOpen() || consumedModalPop()) return;
        // 이번 탐색이 해시 변경을 동반했다 = 뷰 전환 (종료 제스처 아님).
        // popstate 이후 도착(seq 증가)이거나 직전 같은 탐색으로 도착한 hashchange.
        if (_hashNavSeq !== seqAtPop || _lastHashNavAt >= poppedAt - 50) return;
        // 판정 시점의 엔트리·뷰로 기저 조건을 재검증 (역직렬화 객체 동일성 비교는
        // 브라우저마다 다르게 동작하므로 판정을 그대로 재실행한다)
        const cur = history.state;
        const stillBase = cur ? (cur.view === state.currentView || cur.exitGuard === true) : true;
        if (!stillBase || _viewFromLocation() !== state.currentView) return;
        const now = Date.now();
        if (now - _exitGuardArmedAt <= EXIT_GUARD_WINDOW_MS) {
            _exitGuardArmedAt = 0;
            try { history.go(-2); } catch (_) { /* 제한 환경 무시 */ }
            return;
        }
        _exitGuardArmedAt = now;
        _pushExitGuard();
        showToast('뒤로가기를 한 번 더 누르면 종료됩니다', 'info', EXIT_GUARD_WINDOW_MS);
    }, 0);
}

/**
 * 해시 라우팅 초기화 — 초기 딥링크 적용 + 뒤로가기/해시 변경 감지.
 * setupNavigation의 routerCtx를 그대로 받아 navigateToView로 디스패치한다.
 * @param {object} ctx - navigateToView와 동일한 렌더링 컨텍스트
 */
export function initViewHashRouting(ctx) {
    // switchView(nav-item 없는 뷰 폴백 포함)가 항상 정식 라우터 경로를
    // 타도록 navigateToView를 ctx와 바인딩해 등록
    registerViewNavigator((target) => navigateToView(target, ctx));

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
    if (_isMobileLike()) _pushExitGuard(); // PC에서는 보초 자체를 쌓지 않음
    if (!_exitGuardBound) {
        _exitGuardBound = true;
        window.addEventListener('popstate', _handleExitGuardPopstate);
    }
    window.addEventListener('hashchange', () => {
        _hashNavSeq++;
        _lastHashNavAt = Date.now();
        const view = _viewFromLocation();
        if (!view || view === state.currentView) return;
        _hashNavigating = true;
        navigateToView(view, ctx);
        _hashNavigating = false;
    });
}

/** 테스트 격리용 — 종료 가드·해시 네비게이션 상태 초기화 (리스너는 유지). */
export function resetExitGuardState() {
    _exitGuardArmedAt = 0;
    _hashNavSeq = 0;
    _lastHashNavAt = 0;
}
