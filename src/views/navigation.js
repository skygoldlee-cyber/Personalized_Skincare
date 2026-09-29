// src/views/navigation.js - 뷰 전환 유틸리티 (순환 import 해결용)
// @spec UX-NAV-07,R-04
// app.js ↔ quiz.js/dashboard.js 순환 의존성을 끊기 위해 별도 모듈로 추출.
import { state } from '../state.js';
import { trackView } from '../usage-stats.js';

const scrollPositions = {};
// 맨 위로 열어야 할 뷰 — restoreScrollPosition이 1회 소비한다
// (navigateToView의 saveScrollPosition이 scrollPositions를 덮어써도 유지되도록 별도 플래그)
const pendingTop = new Set();

// router.js가 initViewHashRouting에서 navigateToView(ctx 바인딩)를 주입한다 —
// nav-item이 없는 뷰(exam-select-view 등)도 제목·해시·렌더 디스패치를
// 동일하게 받을 수 있도록 switchView 폴백을 정식 라우터 경로로 보낸다.
// 순환 import를 피하기 위해 router → navigation 방향의 등록 패턴을 사용.
let _navigateToView = null;
/** @param {function(string): void} fn - navigateToView를 ctx와 바인딩한 함수 */
export function registerViewNavigator(fn) {
    _navigateToView = fn;
}

export function saveScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        scrollPositions[viewId] = mainContent.scrollTop;
    }
}

// @spec UX-NAV-07
// pendingTop은 saveScrollPosition 덮어쓰기를 무시하는 1회 플래그
export function restoreScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    if (pendingTop.delete(viewId)) {
        scrollPositions[viewId] = 0;
        requestAnimationFrame(() => { mainContent.scrollTop = 0; });
        return;
    }
    if (scrollPositions[viewId] !== undefined) {
        requestAnimationFrame(() => {
            mainContent.scrollTop = scrollPositions[viewId];
        });
    }
}

/**
 * 뷰 전환. opts.scrollTop=true이면 타겟 뷰를 저장된 스크롤이 아닌 맨 위에서 연다
 * (예: 대시보드 "맞춤학습 보기"처럼 문서형 화면으로의 딥링크).
 */
// @spec UX-NAV-07
// opts.scrollTop 딥링크 시 저장된 위치 대신 맨 위 오픈
export function switchView(targetView, opts = {}) {
    // 리더 화면을 벗어나면 재생 중인 오디오 정지
    if (targetView !== 'textbook-reader-view' && typeof window.stopReaderAudio === 'function') {
        window.stopReaderAudio();
    }

    if (opts.scrollTop) pendingTop.add(targetView);

    const navItem = document.querySelector(`.nav-item[data-target="${targetView}"]`);
    if (navItem) {
        // click() 핸들러가 saveScrollPosition/restoreScrollPosition을 포함하므로
        // 여기서는 중복 호출하지 않고 click만 트리거
        /** @type {HTMLElement} */ (navItem).click();
    } else if (_navigateToView) {
        // nav-item이 없는 뷰(exam-select-view) — 라우터 경로로 위임해
        // 제목·해시·렌더 디스패치·aria 동기화를 navigateToView와 동일하게 적용
        _navigateToView(targetView);
    } else {
        // 라우터 미초기화 환경(단위 테스트 등) — 최소 토글만 수행
        saveScrollPosition(state.currentView);
        const target = document.getElementById(targetView);
        if (target) {
            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            target.classList.add('active');
        }
        state.currentView = targetView;
        restoreScrollPosition(targetView);
    }
    trackView(targetView);
}
