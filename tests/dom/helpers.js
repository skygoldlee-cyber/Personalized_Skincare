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
import { state, loadProgress, safeSetItem, safeGetItem } from '../../src/state.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

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

/* =======================================================
   학습 영역 픽스처 (§3.1 — window.STUDY_DATA / state / 진도)
   ======================================================= */

/**
 * window.STUDY_DATA에 과목 스텁을 주입한다.
 * 과목별 카운트는 카드/퀴즈 ID 접두사(`<subj>_card_N`·`<subj>_quiz_N`, [a-z]+)로
 * 집계되므로 과목 키는 소문자 영문 형태를 권장한다 (예: 'subj1').
 */
export function seedStudyData(subjId, { name, cards = [], quizzes = [] } = {}) {
    window.STUDY_DATA = window.STUDY_DATA || {};
    window.STUDY_DATA[subjId] = { name: name || subjId, cards, quizzes };
}

/**
 * 학습 모듈의 모듈 레벨 상태를 초기화한다 — beforeEach에서 호출.
 * state는 싱글턴이므로 테스트 간 Set/객체가 새어 나가지 않게 재할당한다.
 */
export function resetStudyState() {
    state.memorizedCards = new Set();
    state.weakCards = new Set();
    state.quizResults = {};
    state.reviewFilter = 'all';
    state.flashcards.subject = null;
    state.flashcards.currentIndex = 0;
    state.flashcards.keyOnly = false;
    state.flashcards.shuffle = false;
    state.flashcards.difficultyFilter = 'all';
    state.flashcards.sortBy = 'importance';
    state.flashcards.data = [];
    state.quiz.subject = null;
    state.quiz.data = [];
    state.quiz.currentIndex = 0;
    state.quiz.correctCount = 0;
    state.quiz.solvedList = [];
    state._prevMemCount = 0;
    state._prevQuizCount = 0;
    delete window.STUDY_DATA;
    delete window.EXAM_DATA;
}

/**
 * localStorage에 진도를 쓰고 loadProgress()로 state에 복원한다 —
 * 재진입 복원(P) 경로를 실제로 통과시킨다.
 */
export function seedProgress({ memorized = [], weak = [], quizResults = {} } = {}) {
    safeSetItem(STORAGE_KEYS.FC_MEMORIZED, JSON.stringify(memorized));
    safeSetItem(STORAGE_KEYS.FC_WEAK, JSON.stringify(weak));
    safeSetItem(STORAGE_KEYS.QUIZ_RESULTS, JSON.stringify(quizResults));
    loadProgress();
}

/** localStorage에 실제로 저장된 진도 값을 읽는다 (영속 검증용 — 시험 네임스페이스 자동 적용) */
export function storedJson(key) {
    const raw = safeGetItem(key);
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return raw; }
}
