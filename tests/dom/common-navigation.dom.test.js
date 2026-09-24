// tests/dom/common-navigation.dom.test.js — 뷰 전환·스크롤 복원
// 커버리지 갭 보강: src/views/navigation.js (save/restoreScrollPosition, switchView)

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import {
    loadIndexHtml, el, resetStudyState, flushAsync,
} from './helpers.js';
import { state } from '../../src/state.js';
import {
    saveScrollPosition, restoreScrollPosition, switchView,
} from '../../src/views/navigation.js';

describe('navigation — 뷰 전환 + 스크롤 복원', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
        vi.clearAllMocks();
        delete window.stopReaderAudio;
    });

    it('saveScrollPosition → restoreScrollPosition이 저장된 scrollTop을 복원한다', async () => {
        const main = document.querySelector('.main-content');
        expect(main).toBeTruthy();
        main.scrollTop = 123;
        saveScrollPosition('dashboard-view');

        main.scrollTop = 0;
        restoreScrollPosition('dashboard-view');
        await flushAsync(50); // restore는 requestAnimationFrame 내부에서 실행
        expect(main.scrollTop).toBe(123);
    });

    it('저장된 위치가 없는 뷰는 복원하지 않는다', async () => {
        const main = document.querySelector('.main-content');
        main.scrollTop = 55;
        restoreScrollPosition('quiz-view'); // 저장한 적 없음
        await flushAsync(50);
        expect(main.scrollTop).toBe(55);
    });

    it('switchView — nav-item 없는 뷰는 직접 active 전환', () => {
        // index.html의 모든 .view-section은 nav-item이 있으므로
        // nav-item 없는 합성 뷰로 직접 전환 경로를 검증한다
        const target = document.createElement('section');
        target.id = 'synthetic-view';
        target.className = 'view-section';
        document.body.appendChild(target);

        switchView('synthetic-view');
        expect(target.classList.contains('active')).toBe(true);
        expect(state.currentView).toBe('synthetic-view');
        // 다른 섹션은 active 해제
        document.querySelectorAll('.view-section').forEach(sec => {
            if (sec !== target) expect(sec.classList.contains('active')).toBe(false);
        });
        target.remove();
    });

    it('switchView — 리더 뷰를 벗어나면 stopReaderAudio 호출', () => {
        window.stopReaderAudio = vi.fn();
        const target = document.querySelector('.view-section');
        switchView(target.id);
        expect(window.stopReaderAudio).toHaveBeenCalled();
    });
});
