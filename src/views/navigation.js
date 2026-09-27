// src/views/navigation.js - 뷰 전환 유틸리티 (순환 import 해결용)
// @spec UX-NAV-07,R-04
// app.js ↔ quiz.js/dashboard.js 순환 의존성을 끊기 위해 별도 모듈로 추출.
import { state } from '../state.js';

const scrollPositions = {};
// 맨 위로 열어야 할 뷰 — restoreScrollPosition이 1회 소비한다
// (navigateToView의 saveScrollPosition이 scrollPositions를 덮어써도 유지되도록 별도 플래그)
const pendingTop = new Set();

export function saveScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        scrollPositions[viewId] = mainContent.scrollTop;
    }
}

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
 * (예: 대시보드 "맞춤 리포트 보기"처럼 문서형 화면으로의 딥링크).
 */
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
        navItem.click();
    } else {
        // nav-item이 없는 뷰(예: exam-simulator 내부 뷰)는 직접 처리
        saveScrollPosition(state.currentView);
        const target = document.getElementById(targetView);
        if (target) {
            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            target.classList.add('active');
        }
        state.currentView = targetView;
        restoreScrollPosition(targetView);
    }
}
