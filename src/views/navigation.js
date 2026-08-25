// src/views/navigation.js - 뷰 전환 유틸리티 (순환 import 해결용)
// app.js ↔ quiz.js/dashboard.js 순환 의존성을 끊기 위해 별도 모듈로 추출.
import { state } from '../state.js';

const scrollPositions = {};

export function saveScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        scrollPositions[viewId] = mainContent.scrollTop;
    }
}

export function restoreScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent && scrollPositions[viewId] !== undefined) {
        requestAnimationFrame(() => {
            mainContent.scrollTop = scrollPositions[viewId];
        });
    }
}

export function switchView(targetView) {
    // 리더 화면을 벗어나면 재생 중인 오디오 정지
    if (targetView !== 'textbook-reader-view' && typeof window.stopReaderAudio === 'function') {
        window.stopReaderAudio();
    }

    saveScrollPosition(state.currentView);

    const navItem = document.querySelector(`.nav-item[data-target="${targetView}"]`);
    if (navItem) {
        navItem.click();
    }

    restoreScrollPosition(targetView);
}
