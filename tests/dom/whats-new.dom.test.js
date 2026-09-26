// tests/dom/whats-new.dom.test.js — 새 버전 알림 모달 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md — 함수 호출 → DOM 반영 검증

import { describe, it, beforeEach, expect } from 'vitest';
import { maybeShowWhatsNew, showReleaseNotesModal } from '../../src/whats-new.js';
import { safeGetItem } from '../../src/state.js';

const NOTES = [
    { version: 'v-test-new', date: '2026-01-02', notes: ['새 기능 추가됨'] },
    { version: 'v-test-old', date: '2026-01-01', notes: ['이전 변경'] },
];

describe('whats-new.js — 새 버전 알림', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        window.APP_VERSION = 'v-test-new';
        window.RELEASE_NOTES = NOTES;
    });

    it('최초 실행(last_seen 없음)은 모달 없이 버전만 기록', () => {
        maybeShowWhatsNew();
        expect(document.getElementById('app-confirm-overlay')).toBeNull();
        expect(safeGetItem('last_seen_version')).toBe('v-test-new');
    });

    it('버전이 바뀐 부팅이면 변경 이력 모달 표시', () => {
        localStorage.setItem('last_seen_version', 'v-test-old');
        maybeShowWhatsNew();
        const overlay = document.getElementById('app-confirm-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.textContent).toContain('새 기능 추가됨');
        // 이전 버전 노트는 미포함 (새 버전분만)
        expect(overlay.textContent).not.toContain('이전 변경');
    });

    it('같은 버전 재부팅이면 모달 없음', () => {
        localStorage.setItem('last_seen_version', 'v-test-new');
        maybeShowWhatsNew();
        expect(document.getElementById('app-confirm-overlay')).toBeNull();
    });

    it('확인 클릭 시 last_seen_version 갱신 → 다음 부팅은 무표시', () => {
        localStorage.setItem('last_seen_version', 'v-test-old');
        maybeShowWhatsNew();
        document.querySelector('#app-confirm-overlay .app-confirm-ok').click();
        expect(safeGetItem('last_seen_version')).toBe('v-test-new');
    });

    it('설정 메뉴 재열람: 전체 이력 표시', () => {
        showReleaseNotesModal(NOTES, '변경 이력');
        const overlay = document.getElementById('app-confirm-overlay');
        expect(overlay.textContent).toContain('새 기능 추가됨');
        expect(overlay.textContent).toContain('이전 변경');
    });

    it('APP_VERSION이 없으면 아무 동작도 안 함', () => {
        delete window.APP_VERSION;
        maybeShowWhatsNew();
        expect(document.getElementById('app-confirm-overlay')).toBeNull();
    });
});
