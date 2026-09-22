// tests/dom/common-scratchpad.dom.test.js — 계산 스크래치패드 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.3 (Phase 5)
// 검증: 토글→컨테이너·버튼 라벨(H) · 캔버스 초기화·그리기 스트로크(H)
//       · 지우기→clearRect(H) · 지우개 토글→strokeStyle/굵기(B)
// 참고: 모듈 레벨 `scratchpadCanvasInitialized` 잔존 방지를 위해 매 테스트 모듈 리셋

import { describe, it, beforeEach, expect, vi } from 'vitest';

import { loadIndexHtml, el } from './helpers.js';

function stubCanvasCtx() {
    const ctx = {
        lineWidth: 0, lineCap: '', strokeStyle: '',
        beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
        stroke: vi.fn(), clearRect: vi.fn(), arc: vi.fn(),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx);
    return ctx;
}

describe('스크래치패드 — 캔버스 토글·그리기·지우기', () => {
    let ctx, mod;
    beforeEach(async () => {
        localStorage.clear();
        vi.resetModules();
        mod = await import('../../src/scratchpad.js');
        loadIndexHtml();
        ctx = stubCanvasCtx();
        vi.clearAllMocks();
    });

    it('토글 → 컨테이너 표시 + 캔버스 초기화(1회만) + 버튼 라벨', () => {
        const container = el('calc-scratchpad-container');
        const btn = el('calc-scratchpad-toggle');
        expect(container.classList.contains('is-hidden')).toBe(true);

        mod.toggleCalcScratchpad();
        expect(container.classList.contains('is-hidden')).toBe(false);
        expect(btn.textContent).toContain('닫기');
        expect(ctx.lineWidth).toBe(3);
        expect(ctx.lineCap).toBe('round');

        // 닫기 → 다시 열기: 재초기화 안 함 (리스너 중복 방지)
        mod.toggleCalcScratchpad();
        mod.toggleCalcScratchpad();
        expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(1);
    });

    it('mousedown→mousemove → 스트로크 그리기', () => {
        mod.toggleCalcScratchpad();
        const canvas = el('scratchpad-canvas');
        // jsdom rect은 0 → 좌표 정규화를 위해 rect 스텁
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 200 });

        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50, bubbles: true }));

        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.moveTo).toHaveBeenCalledWith(10, 10);
        expect(ctx.lineTo).toHaveBeenCalledWith(50, 50);
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('지우기 → clearRect 전체 영역', () => {
        mod.toggleCalcScratchpad();
        mod.clearScratchpad();
        expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 480, 200);
    });

    it('지우개 토글 → 굵은 지우개 / 재토글 → 연필 복귀', () => {
        mod.toggleCalcScratchpad();
        const btn = el('scratchpad-eraser-btn');

        mod.toggleScratchpadEraser();
        expect(ctx.lineWidth).toBe(12);
        expect(btn.textContent).toBe('연필 모드');

        mod.toggleScratchpadEraser();
        expect(ctx.lineWidth).toBe(3);
        expect(btn.textContent).toBe('지우개');
    });
});
