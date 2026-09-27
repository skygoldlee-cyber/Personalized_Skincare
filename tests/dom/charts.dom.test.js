// tests/dom/charts.dom.test.js — 분석 차트 시나리오
// @spec C-01,C-02,C-03,C-04,C-05
// 성적 추이 라인차트, 합격/과락 진단, 레이더 차트, 과목별 점수행, 툴팁을 고정한다.

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    trapFocus: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { resetStudyState } from './helpers.js';
import {
    renderPerformanceChart, renderPassFailDiagnosis, renderRadarChart,
} from '../../src/charts.js';
import { safeSetItem } from '../../src/state.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

function mountDom() {
    document.body.innerHTML = `
        <div id="analytics-chart-wrapper"></div>
        <div id="empty-chart-msg" class="is-hidden"></div>
        <div id="radar-chart-wrapper"></div>
        <div id="empty-radar-msg" class="is-hidden"></div>
        <div id="prediction-result-area"></div>`;
}

function seedRegistry() {
    window.DATA_REGISTRY = {
        subjects: [
            { key: 'subja', name: '과목A' },
            { key: 'subjb', name: '과목B' },
            { key: 'subjc', name: '과목C' },
            { key: 'subjd', name: '과목D' },
        ],
        exams: [],
        integratedExam: { passAverage: 60, subjectFailBelow: 40 },
    };
}

function seedHistory(rates, subjectRates) {
    const history = rates.map(rate => ({ rate, subjectRates: subjectRates || {} }));
    // 저장소 계층이 scopedKey(시험 네임스페이스)를 적용하므로 safeSetItem 경유
    safeSetItem(STORAGE_KEYS.SIM_RESULTS_HISTORY, JSON.stringify(history));
}

const PASS_RATES = [70, 65, 72, 68, 75];
const PASS_SUBJ = { subja: 70, subjb: 65, subjc: 72, subjd: 68 };

describe('분석 차트 (C-01~05)', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        mountDom();
        seedRegistry();
    });

    it('C-01: 이력 없으면 빈 상태 메시지, 이력 있으면 SVG 라인차트', () => {
        renderPerformanceChart();
        const wrapper = document.getElementById('analytics-chart-wrapper');
        const empty = document.getElementById('empty-chart-msg');
        expect(wrapper.querySelector('svg')).toBeNull();
        expect(empty.classList.contains('is-hidden')).toBe(false);

        seedHistory(PASS_RATES, PASS_SUBJ);
        renderPerformanceChart();
        const svg = wrapper.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg.querySelector('polyline, path')).not.toBeNull();
        expect(empty.classList.contains('is-hidden')).toBe(true);
    });

    it('C-02: 합격 진단 — 평균 충족 + 과락 없음이면 합격 예측', () => {
        seedHistory(PASS_RATES, PASS_SUBJ);
        renderPassFailDiagnosis();
        const html = document.getElementById('prediction-result-area').innerHTML;
        expect(html).toContain('합격');
        expect(html).not.toContain('과락 경계');
    });

    it('C-02/C-04: 평균 충족 + 특정 과목 40 미만이면 과락 경계 + 해당 과목 행 표시', () => {
        seedHistory(PASS_RATES, { subja: 70, subjb: 35, subjc: 72, subjd: 68 });
        renderPassFailDiagnosis();
        const area = document.getElementById('prediction-result-area');
        expect(area.innerHTML).toContain('과락 경계');
        expect(area.querySelector('.pred-subject-row.danger')).not.toBeNull();
    });

    it('C-03: 레이더 차트 — 4과목 N축 폴리곤과 축 라벨', () => {
        seedHistory(PASS_RATES, PASS_SUBJ);
        renderRadarChart();
        const svg = document.getElementById('radar-chart-wrapper').querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg.querySelectorAll('polygon').length).toBeGreaterThan(0);
        expect(svg.textContent).toContain('과목A');
    });

    it('C-03: 과목 3개 미만이면 레이더 대신 안내 메시지', () => {
        window.DATA_REGISTRY.subjects = window.DATA_REGISTRY.subjects.slice(0, 2);
        seedHistory(PASS_RATES, PASS_SUBJ);
        renderRadarChart();
        const empty = document.getElementById('empty-radar-msg');
        expect(empty.classList.contains('is-hidden')).toBe(false);
        expect(empty.textContent).toContain('3개 과목');
    });

    it('C-04: 과목별 점수행이 레지스트리 순서로 렌더된다', () => {
        seedHistory(PASS_RATES, PASS_SUBJ);
        renderPassFailDiagnosis();
        const rows = document.querySelectorAll('.pred-subject-row');
        expect(rows.length).toBe(4);
        expect(rows[0].textContent).toContain('1과목');
    });

    it('C-05: 차트 데이터 포인트에 툴팁이 바인딩된다', () => {
        seedHistory(PASS_RATES, PASS_SUBJ);
        renderPerformanceChart();
        const svg = document.getElementById('analytics-chart-wrapper').querySelector('svg');
        const tooltipTargets = svg.querySelectorAll('[data-tooltip], circle');
        expect(tooltipTargets.length).toBeGreaterThan(0);
    });
});
