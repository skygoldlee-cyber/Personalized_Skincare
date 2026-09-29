// @spec TR-06
// mermaid-render.js 다이어그램 확대 모달 DOM 테스트
import { describe, it, beforeEach, expect } from 'vitest';
import { attachMermaidZoom, openMermaidZoom, closeMermaidZoom } from '../../src/mermaid-render.js';

const MERMAID_PRE = `
    <pre class="mermaid mermaid-flowchart"><svg viewBox="0 0 800 400" width="100%" style="max-width: 800px;"><rect width="10" height="10"></rect></svg></pre>
`;

describe('mermaid-render.js — 다이어그램 확대 모달', () => {
    beforeEach(() => {
        document.body.innerHTML = MERMAID_PRE;
        document.getElementById('mermaid-zoom-modal')?.remove();
    });

    it('attachMermaidZoom이 확대 버튼을 pre에 추가', () => {
        const pre = document.querySelector('pre.mermaid');
        attachMermaidZoom(pre);
        const btn = pre.querySelector('.mermaid-expand-btn');
        expect(btn).toBeTruthy();
        expect(btn.getAttribute('aria-label')).toBe('다이어그램 확대');
    });

    it('중복 바인딩 방지 — 버튼이 하나만 생성됨', () => {
        const pre = document.querySelector('pre.mermaid');
        attachMermaidZoom(pre);
        attachMermaidZoom(pre);
        expect(pre.querySelectorAll('.mermaid-expand-btn').length).toBe(1);
    });

    it('확대 버튼 클릭 → 모달이 열리고 svg가 복제됨', () => {
        const pre = document.querySelector('pre.mermaid');
        attachMermaidZoom(pre);
        pre.querySelector('.mermaid-expand-btn').click();
        const modal = document.getElementById('mermaid-zoom-modal');
        expect(modal).toBeTruthy();
        expect(modal.classList.contains('is-hidden')).toBe(false);
        expect(modal.getAttribute('role')).toBe('dialog');
        const body = modal.querySelector('#mermaid-zoom-body');
        expect(body.querySelector('svg')).toBeTruthy();
        // 테마 CSS 유지를 위해 mermaid 클래스가 복제본에 남아야 함
        expect(body.querySelector('pre').classList.contains('mermaid-flowchart')).toBe(true);
    });

    it('모달 내 svg는 인라인 max-width 대신 확대 배율 width로 설정됨', () => {
        const pre = document.querySelector('pre.mermaid');
        openMermaidZoom(pre);
        const clone = document.querySelector('#mermaid-zoom-body svg');
        expect(clone.style.maxWidth).toBe('none');
        expect(clone.style.width).toMatch(/px$/);
    });

    it('확대/축소/맞춤 버튼이 배율을 변경함', () => {
        const pre = document.querySelector('pre.mermaid');
        openMermaidZoom(pre);
        const level = document.getElementById('mermaid-zoom-level');
        const clone = document.querySelector('#mermaid-zoom-body svg');
        // jsdom clientWidth=0 → avail 200 → fit = 200/800 = 25%
        expect(level.textContent).toBe('25%');
        document.getElementById('mermaid-zoom-in').click();
        expect(level.textContent).toBe('50%');
        expect(clone.style.width).toBe('400px');
        document.getElementById('mermaid-zoom-out').click();
        expect(level.textContent).toBe('25%');
        document.getElementById('mermaid-zoom-in').click();
        document.getElementById('mermaid-zoom-fit').click();
        expect(level.textContent).toBe('25%');
    });

    it('svg 클릭(드래그 아닌 탭)으로도 모달이 열림', () => {
        const pre = document.querySelector('pre.mermaid');
        attachMermaidZoom(pre);
        pre.querySelector('svg').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
        expect(document.getElementById('mermaid-zoom-modal').classList.contains('is-hidden')).toBe(false);
    });

    it('Escape/닫기 버튼/배경 클릭으로 모달이 닫힘', () => {
        const pre = document.querySelector('pre.mermaid');
        openMermaidZoom(pre);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        const modal = document.getElementById('mermaid-zoom-modal');
        expect(modal.classList.contains('is-hidden')).toBe(true);

        openMermaidZoom(pre);
        document.getElementById('mermaid-zoom-close').click();
        expect(modal.classList.contains('is-hidden')).toBe(true);

        openMermaidZoom(pre);
        modal.querySelector('.reader-table-modal-backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(modal.classList.contains('is-hidden')).toBe(true);
    });

    it('닫으면 확대 버튼으로 포커스가 복귀', () => {
        const pre = document.querySelector('pre.mermaid');
        attachMermaidZoom(pre);
        const btn = pre.querySelector('.mermaid-expand-btn');
        btn.click();
        closeMermaidZoom();
        expect(document.activeElement).toBe(btn);
    });
});
