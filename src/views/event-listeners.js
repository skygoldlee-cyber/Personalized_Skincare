// src/views/event-listeners.js — 이벤트 리스너 설정 진입점 (도메인별 바인딩 합성)
// @spec S-02,S-03
// 도메인 바인딩은 listeners-*.js에 분리됨 — 이 파일은 바인딩 호출 순서만 소유한다.
// (기존 단일 함수(601줄)를 도메인 단위로 분할 — 위임 바인딩 규약은
//  listeners-delegation.js 헤더 주석 참고)
import { bindAppListeners } from './listeners-app.js';
import { bindFlashcardListeners } from './listeners-flashcard.js';
import { bindQuizListeners } from './listeners-quiz.js';
import { bindSimulatorListeners } from './listeners-simulator.js';
import { bindDictListeners } from './listeners-dictionary.js';
import { bindDelegation } from './listeners-delegation.js';

export function setupEventListeners(enhanceDataClickAccessibility) {
    bindAppListeners();
    bindFlashcardListeners();
    bindQuizListeners();
    bindSimulatorListeners();
    bindDictListeners();
    bindDelegation(enhanceDataClickAccessibility);
}
