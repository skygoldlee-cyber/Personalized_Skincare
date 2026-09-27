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

    it('switchView — scrollTop 옵션은 저장된 스크롤 대신 맨 위에서 연다', async () => {
        // 대시보드 "맞춤 리포트 보기"처럼 문서형 뷰 딥링크용 — 이전 방문 스크롤 무시
        const main = document.querySelector('.main-content');
        const target = document.createElement('section');
        target.id = 'synthetic-view-2';
        target.className = 'view-section';
        document.body.appendChild(target);

        // 기본 동작: 이전 방문의 스크롤 위치 복원
        main.scrollTop = 400;
        saveScrollPosition('synthetic-view-2');
        main.scrollTop = 77;
        switchView('synthetic-view-2');
        await flushAsync(50);
        expect(main.scrollTop).toBe(400);

        // scrollTop 옵션: 복원 무시하고 맨 위로
        main.scrollTop = 400;
        saveScrollPosition('synthetic-view-2');
        main.scrollTop = 77;
        switchView('synthetic-view-2', { scrollTop: true });
        await flushAsync(50);
        expect(main.scrollTop).toBe(0);

        target.remove();
    });
});

describe('사이드바 ↔ 모바일 탭 바 메뉴 일치', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        loadIndexHtml();
    });

    it('사이드바 .nav-item과 모바일 .mobile-tab-item의 data-target 집합·순서가 동일하다', () => {
        const sidebarTargets = [...document.querySelectorAll('.nav-item[data-target]')]
            .map(n => n.getAttribute('data-target'));
        const mobileTargets = [...document.querySelectorAll('.mobile-tab-item[data-target]')]
            .map(n => n.getAttribute('data-target'));
        expect(sidebarTargets).toEqual(mobileTargets);
    });

    it('각 data-target은 대응하는 .view-section을 갖는다', () => {
        const targets = new Set();
        document.querySelectorAll('.nav-item[data-target], .mobile-tab-item[data-target]')
            .forEach(n => targets.add(n.getAttribute('data-target')));
        targets.forEach(t => {
            const section = document.getElementById(t);
            expect(section, `${t} 뷰 섹션 누락`).toBeTruthy();
            expect(section.classList.contains('view-section'), `${t}은 view-section이 아님`).toBe(true);
        });
    });

    it('사이드바와 모바일 탭의 PRO 배지(data-pro-feature)가 뷰별로 일치한다', () => {
        // 뷰별 → 배지 기능 키 집합 매핑 (한쪽에만 배지를 달면 실패)
        const badgeMap = selector => {
            const map = {};
            document.querySelectorAll(`${selector}[data-target]`).forEach(item => {
                map[item.getAttribute('data-target')] =
                    [...item.querySelectorAll('[data-pro-feature]')]
                        .map(b => b.getAttribute('data-pro-feature'))
                        .sort();
            });
            return map;
        };
        const sidebar = badgeMap('.nav-item');
        const mobile = badgeMap('.mobile-tab-item');
        Object.keys(sidebar).forEach(target => {
            expect(mobile[target],
                `${target} — 모바일 탭의 PRO 배지가 사이드바와 다름`)
                .toEqual(sidebar[target]);
        });
    });
});
