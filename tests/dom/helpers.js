// tests/dom/helpers.js — DOM 시나리오 테스트 공통 픽스처·유틸
// 설계: docs/dev/DOM_TEST_DESIGN.md
//
// 원칙: index.html의 실제 마크업을 jsdom에 주입해 컨트롤러 export 함수를
// 직접 호출한다. data-click 위임 자체는 delegation-guard 유닛 테스트가
// 정적으로 검증하므로 여기서는 "함수 호출 → DOM 반영"만 본다.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { vi } from 'vitest';
import { showToast } from '../../src/ui-utils.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * index.html의 <body> 내용을 jsdom document.body에 주입한다.
 * <script> 태그는 제거 — jsdom이 실행하지 않지만 파싱 부하 방지.
 * 실제 마크업을 쓰므로 id 오기재·버튼/file input 누락도 검출된다.
 */
export function loadIndexHtml() {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf-8');
    const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    document.body.innerHTML = (m ? m[1] : html)
        .replace(/<script[\s\S]*?<\/script>/gi, '');
}

export function el(id) {
    return document.getElementById(id);
}

/** is-hidden이 없으면 표시 중으로 간주 */
export function isVisible(id) {
    const node = el(id);
    return !!node && !node.classList.contains('is-hidden');
}

/**
 * file input에 File을 주입하고 change 이벤트를 디스패치한다.
 * input.files는 읽기 전용이므로 defineProperty로 주입.
 * @param {string|HTMLInputElement} inputOrId
 * @param {File} file
 */
export function selectFile(inputOrId, file) {
    const input = typeof inputOrId === 'string' ? el(inputOrId) : inputOrId;
    if (!input) throw new Error('file input not found: ' + inputOrId);
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** FileReader·arrayBuffer·showConfirm 등 비동기 체인 완료 대기 */
export async function flushAsync(ms = 10) {
    await new Promise(r => setTimeout(r, ms));
    await new Promise(r => setTimeout(r, 0));
}

/** 모킹된 showToast의 마지막 호출 인자 [message, type] */
export function lastToast() {
    const calls = vi.mocked(showToast).mock.calls;
    return calls.length ? calls[calls.length - 1] : null;
}

/**
 * document.createElement('a')의 click을 스파이해 다운로드 트리거를 검증한다.
 * @returns {() => {clicked:number, filename:string|null}} 사용 후 반환된 정리 함수 호출
 */
export function spyAnchorDownload() {
    const clicks = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation(tag => {
        const node = orig(tag);
        if (tag === 'a') {
            node.click = vi.fn(() => {
                clicks.push({ download: node.getAttribute('download') });
            });
        }
        return node;
    });
    return {
        clicks,
        restore() { spy.mockRestore(); },
    };
}
