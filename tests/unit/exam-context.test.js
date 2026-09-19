// tests/unit/exam-context.test.js
// 멀티시험 컨텍스트 — 활성 시험 해석, 진도 키 네임스페이스, 경로 해석을 검증.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    getExamList, getActiveExam, getActiveExamId, getCurrentExamId,
    contentPath, dataPath, hasFeature, scopedKey, unscopedKey,
    purgeLegacyStorage,
} from '../../src/exam-context.js';

const EXAMS = {
    exams: [
        { id: 'alpha', name: '알파시험', contentRoot: 'content/exams/alpha', dataRoot: 'data/exams/alpha', features: { refDocs: true } },
        { id: 'cosmetic', name: '조제관리사', contentRoot: 'content', dataRoot: 'data', default: true, features: { dictionary: true } },
    ]
};

function createMockStorage() {
    const store = {};
    return {
        getItem(k) { return k in store ? store[k] : null; },
        setItem(k, v) { store[k] = String(v); },
        removeItem(k) { delete store[k]; },
        clear() { for (const k of Object.keys(store)) delete store[k]; },
        key(i) { return Object.keys(store)[i] ?? null; },
        get length() { return Object.keys(store).length; },
        _store: store
    };
}

let mockStorage;
let originalLocalStorage;
let originalWindow;

beforeEach(() => {
    mockStorage = createMockStorage();
    originalLocalStorage = global.localStorage;
    originalWindow = global.window;
    Object.defineProperty(global, 'localStorage', { value: mockStorage, writable: true, configurable: true });
    Object.defineProperty(global, 'window', { value: { EXAMS_LIST: EXAMS }, writable: true, configurable: true });
});

afterEach(() => {
    if (originalLocalStorage !== undefined) {
        Object.defineProperty(global, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true });
    } else {
        delete global.localStorage;
    }
    if (originalWindow !== undefined) {
        Object.defineProperty(global, 'window', { value: originalWindow, writable: true, configurable: true });
    } else {
        delete global.window;
    }
});

// ==================== 활성 시험 해석 ====================

test('getActiveExam: 미선택 시 default 플래그 시험', () => {
    assert.equal(getActiveExam().id, 'cosmetic');
});

test('getActiveExam: 선택된 시험 우선', () => {
    mockStorage.setItem('current_exam', 'alpha');
    assert.equal(getActiveExam().id, 'alpha');
});

test('getActiveExam: 잘못된 선택 id는 default로 폴백', () => {
    mockStorage.setItem('current_exam', 'nonexistent');
    assert.equal(getActiveExam().id, 'cosmetic');
});

test('getActiveExam: EXAMS_LIST 없으면 null', () => {
    window.EXAMS_LIST = null;
    assert.equal(getActiveExam(), null);
    assert.equal(getActiveExamId(), 'cosmetic'); // DEFAULT_EXAM_ID 폴백
});

test('getExamList: malformed 데이터도 배열로 정규화', () => {
    window.EXAMS_LIST = { exams: 'not-an-array' };
    assert.deepEqual(getExamList(), []);
});

// ==================== 경로 해석 ====================

test('contentPath/dataPath: 활성 시험 루트 기준', () => {
    assert.equal(contentPath('교재/a.md'), 'content/교재/a.md');
    assert.equal(dataPath('drills/x.js'), 'data/drills/x.js');
    mockStorage.setItem('current_exam', 'alpha');
    assert.equal(contentPath('교재/a.md'), 'content/exams/alpha/교재/a.md');
    assert.equal(dataPath('drills/x.js'), 'data/exams/alpha/drills/x.js');
});

test('hasFeature: 시험별 플래그 게이트', () => {
    assert.equal(hasFeature('dictionary'), true);   // cosmetic
    assert.equal(hasFeature('refDocs'), false);
    mockStorage.setItem('current_exam', 'alpha');
    assert.equal(hasFeature('refDocs'), true);
    assert.equal(hasFeature('dictionary'), false);
});

// ==================== 진도 키 네임스페이스 ====================

test('scopedKey: 진도 키에 시험 접두사 부여', () => {
    assert.equal(scopedKey('fc_memorized'), 'cosmetic:fc_memorized');
    mockStorage.setItem('current_exam', 'alpha');
    assert.equal(scopedKey('fc_memorized'), 'alpha:fc_memorized');
});

test('scopedKey: GLOBAL_KEYS는 접두사 없이 유지', () => {
    for (const k of ['current_exam', 'appTheme', 'preferredOrientation', 'readerFontScale']) {
        assert.equal(scopedKey(k), k, `${k}는 전역 키`);
    }
    mockStorage.setItem('current_exam', 'alpha');
    assert.equal(scopedKey('appTheme'), 'appTheme', '시험 전환 후에도 전역 키 유지');
});

test('unscopedKey: 현재 시험 접두사만 제거, 타 시험 키는 null', () => {
    assert.equal(unscopedKey('cosmetic:fc_memorized'), 'fc_memorized');
    assert.equal(unscopedKey('alpha:fc_memorized'), null);
    assert.equal(unscopedKey('appTheme'), null);
    assert.equal(unscopedKey(null), null);
});

// ==================== 레거시 키 정리 ====================

test('purgeLegacyStorage: 1회 실행 — 레거시 진도 키만 제거하고 전역 키 보존', () => {
    mockStorage.setItem('fc_memorized', '[1,2]');
    mockStorage.setItem('quiz_results_x', '{}');
    mockStorage.setItem('appTheme', 'dark');
    mockStorage.setItem('cosmetic:fc_memorized', '[3]'); // 이미 네임스페이스된 키는 유지
    purgeLegacyStorage(['fc_memorized'], ['quiz_results_']);
    assert.equal(mockStorage.getItem('fc_memorized'), null);
    assert.equal(mockStorage.getItem('quiz_results_x'), null);
    assert.equal(mockStorage.getItem('appTheme'), 'dark');
    assert.equal(mockStorage.getItem('cosmetic:fc_memorized'), '[3]');
    assert.equal(mockStorage.getItem('ns_migrated_v2'), '1');
});

test('purgeLegacyStorage: 플래그가 있으면 재실행 안 함', () => {
    mockStorage.setItem('ns_migrated_v2', '1');
    mockStorage.setItem('fc_memorized', '[1]');
    purgeLegacyStorage(['fc_memorized'], []);
    assert.equal(mockStorage.getItem('fc_memorized'), '[1]');
});
