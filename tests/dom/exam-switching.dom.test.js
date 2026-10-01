// tests/dom/exam-switching.dom.test.js — 멀티시험 전환 통합 시나리오
// @spec ES-01~05
// 목적: 비기본 시험(food) 활성 시 기능 플래그 게이팅·브랜딩·스토리지
//       네임스페이스가 시험 컨텍스트를 정확히 따르는지 회귀 검증.
//       (cosmetic 전용 UI가 food에 새어 나오지 않아야 한다)

import { describe, it, beforeEach, expect, vi } from 'vitest';

import { loadIndexHtml } from './helpers.js';
import {
    getActiveExam, getActiveExamId, hasFeature, getExamAppName, scopedKey, unscopedKey,
} from '../../src/exam-context.js';
import { applyFeatureFlags, applyExamBranding } from '../../src/app-shell.js';

const EXAMS = {
    exams: [
        {
            id: 'cosmetic', name: '맞춤형화장품 조제관리사', appName: 'Passmula',
            title: 'Passmula — 맞춤형화장품 조제관리사',
            logoMain: 'Pass', logoSub: 'mula', icon: 'fa-solid fa-wand-magic-sparkles',
            year: '2027', default: true,
            features: { formula: true, dictionary: true, userManual: true, refDocs: true },
        },
        {
            id: 'food', name: '식품기사', appName: '식품기사', title: '식품기사',
            logoMain: '식품', logoSub: '기사', icon: 'fa-solid fa-bowl-food',
            year: '2027',
            features: { refDocs: true, dictionary: true },
        },
    ],
};

describe('멀티시험 전환 — 비기본 시험 활성화', () => {
    beforeEach(() => {
        localStorage.clear();
        loadIndexHtml();
        window.EXAMS_LIST = EXAMS;
        vi.clearAllMocks();
    });

    it('food 선택 시 활성 시험 해석·기능 플래그가 food를 따른다', () => {
        localStorage.setItem('current_exam', 'food');

        expect(getActiveExamId()).toBe('food');
        expect(getActiveExam().name).toBe('식품기사');
        // cosmetic 전용 기능 비활성
        expect(hasFeature('formula')).toBe(false);
        expect(hasFeature('userManual')).toBe(false);
        // food 보유 기능 활성
        expect(hasFeature('refDocs')).toBe(true);
        expect(hasFeature('dictionary')).toBe(true);
        expect(getExamAppName()).toBe('식품기사');
    });

    it('applyFeatureFlags — food에서 formula·userManual 게이트 요소 숨김, dictionary 유지', () => {
        localStorage.setItem('current_exam', 'food');
        applyFeatureFlags();

        const hidden = (sel) => {
            const nodes = document.querySelectorAll(`[data-feature="${sel}"]`);
            expect(nodes.length).toBeGreaterThan(0);
            return [...nodes].every((n) => n.classList.contains('is-hidden'));
        };
        expect(hidden('formula')).toBe(true);   // 실무 매뉴얼 링크 등
        expect(hidden('userManual')).toBe(true); // 학습 매뉴얼 링크
        expect(hidden('dictionary')).toBe(false); // food 보유 기능은 유지
        // 시험 전환 버튼은 시험 수(2개) 기반으로 노출
        expect(hidden('examSwitch')).toBe(false);
    });

    it('applyExamBranding — 타이틀·로고가 food 값으로 갱신', () => {
        localStorage.setItem('current_exam', 'food');
        applyExamBranding();

        expect(document.title).toBe('식품기사');
        const logoMain = document.querySelector('.logo-text h1');
        const logoSub = document.querySelector('.logo-text span');
        if (logoMain) expect(logoMain.textContent).toBe('식품');
        if (logoSub) expect(logoSub.textContent).toBe('기사');
    });

    it('scopedKey — 진도 키는 시험 접두사, 전역 키는 무시됨', () => {
        localStorage.setItem('current_exam', 'food');
        expect(scopedKey('fc_memorized')).toBe('food:fc_memorized');
        expect(unscopedKey('food:fc_memorized')).toBe('fc_memorized');
        // 다른 시험 소속 키는 unscope 불가
        expect(unscopedKey('cosmetic:fc_memorized')).toBe(null);
        // 전역 키는 접두 없음
        expect(scopedKey('appTheme')).toBe('appTheme');
    });

    it('선택 없으면 기본 시험(cosmetic)으로 해석', () => {
        expect(getActiveExamId()).toBe('cosmetic');
        expect(hasFeature('formula')).toBe(true);
        expect(scopedKey('fc_memorized')).toBe('cosmetic:fc_memorized');
    });
});
