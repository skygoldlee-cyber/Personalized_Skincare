import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, loadProgress, saveProgress, cleanOrphansForSubject } from '../../src/state.js';

// --- localStorage 모킹 ---

function createMockStorage() {
    const store = {};
    return {
        getItem(key) { return key in store ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { for (const k of Object.keys(store)) delete store[k]; },
        _store: store
    };
}

let mockStorage;
let originalLocalStorage;

beforeEach(() => {
    mockStorage = createMockStorage();
    originalLocalStorage = global.localStorage;
    // localStorage 교체
    Object.defineProperty(global, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true
    });
    // state 초기화
    state.memorizedCards = new Set();
    state.weakCards = new Set();
    state.quizResults = {};
    state.trainer.pomodoro.totalTimeToday = 0;
});

afterEach(() => {
    if (originalLocalStorage !== undefined) {
        Object.defineProperty(global, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
            configurable: true
        });
    } else {
        delete global.localStorage;
    }
});

// --- loadProgress 테스트 ---

test('loadProgress: 빈 localStorage에서 정상 동작', () => {
    loadProgress();
    assert.equal(state.memorizedCards.size, 0);
    assert.equal(state.weakCards.size, 0);
    assert.equal(Object.keys(state.quizResults).length, 0);
});

test('loadProgress: 외운 카드 로드', () => {
    mockStorage.setItem('fc_memorized', JSON.stringify(['law_card_abc123', 'safety_card_def456']));
    loadProgress();
    assert.equal(state.memorizedCards.size, 2);
    assert.ok(state.memorizedCards.has('law_card_abc123'));
    assert.ok(state.memorizedCards.has('safety_card_def456'));
});

test('loadProgress: 약점 카드 로드', () => {
    mockStorage.setItem('fc_weak', JSON.stringify(['law_card_xyz789']));
    loadProgress();
    assert.equal(state.weakCards.size, 1);
    assert.ok(state.weakCards.has('law_card_xyz789'));
});

test('loadProgress: 퀴즈 결과 로드', () => {
    mockStorage.setItem('quiz_results', JSON.stringify({
        'law_quiz_001': { solved: true, correct: true },
        'safety_quiz_002': { solved: true, correct: false }
    }));
    loadProgress();
    assert.equal(Object.keys(state.quizResults).length, 2);
    assert.equal(state.quizResults['law_quiz_001'].correct, true);
    assert.equal(state.quizResults['safety_quiz_002'].correct, false);
});

test('loadProgress: 손상된 JSON은 무시', () => {
    mockStorage.setItem('fc_memorized', '{invalid json}');
    mockStorage.setItem('fc_weak', 'not json at all');
    mockStorage.setItem('quiz_results', '}}}broken');
    // 에러를 던지지 않고 정상 진행되어야 함
    loadProgress();
    assert.equal(state.memorizedCards.size, 0);
    assert.equal(state.weakCards.size, 0);
    assert.equal(Object.keys(state.quizResults).length, 0);
});

test('loadProgress: 뽀모도로 날짜 리셋 (날짜가 다르면 0)', () => {
    mockStorage.setItem('pomo_total_time_date', '2020-01-01');
    mockStorage.setItem('pomo_total_time', '3600');
    loadProgress();
    assert.equal(state.trainer.pomodoro.totalTimeToday, 0);
    // 오늘 날짜로 저장되어야 함
    const todayStr = new Date().toISOString().split('T')[0];
    assert.equal(mockStorage.getItem('pomo_total_time_date'), todayStr);
    assert.equal(mockStorage.getItem('pomo_total_time'), '0');
});

test('loadProgress: 뽀모도로 같은 날이면 누적 시간 유지', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    mockStorage.setItem('pomo_total_time_date', todayStr);
    mockStorage.setItem('pomo_total_time', '1800');
    loadProgress();
    assert.equal(state.trainer.pomodoro.totalTimeToday, 1800);
});

// --- saveProgress 테스트 ---

test('saveProgress: 외운 카드/약점 카드/퀴즈 결과 저장', () => {
    state.memorizedCards.add('law_card_abc');
    state.memorizedCards.add('safety_card_def');
    state.weakCards.add('law_card_xyz');
    state.quizResults['law_quiz_001'] = { solved: true, correct: true };

    saveProgress();

    const savedMem = JSON.parse(mockStorage.getItem('fc_memorized'));
    assert.equal(savedMem.length, 2);
    assert.ok(savedMem.includes('law_card_abc'));

    const savedWeak = JSON.parse(mockStorage.getItem('fc_weak'));
    assert.equal(savedWeak.length, 1);
    assert.equal(savedWeak[0], 'law_card_xyz');

    const savedQuiz = JSON.parse(mockStorage.getItem('quiz_results'));
    assert.equal(savedQuiz['law_quiz_001'].correct, true);
});

test('saveProgress: 빈 상태 저장', () => {
    saveProgress();
    assert.equal(JSON.parse(mockStorage.getItem('fc_memorized')).length, 0);
    assert.equal(JSON.parse(mockStorage.getItem('fc_weak')).length, 0);
    assert.equal(Object.keys(JSON.parse(mockStorage.getItem('quiz_results'))).length, 0);
});

test('saveProgress: updateGlobalStats 없어도 정상 동작', () => {
    state.memorizedCards.add('test_card');
    // updateGlobalStats는 전역 함수이므로 정의되지 않아도 에러 없이 진행
    saveProgress();
    assert.ok(mockStorage.getItem('fc_memorized') !== null);
});

// --- cleanOrphansForSubject 테스트 ---

test('cleanOrphansForSubject: 유효 ID는 유지, 고아 ID는 제거', () => {
    state.memorizedCards.add('law_card_valid1');
    state.memorizedCards.add('law_card_orphan');
    state.weakCards.add('law_card_orphan2');
    state.quizResults['law_quiz_orphan'] = { solved: true, correct: false };

    const subjData = {
        cards: [{ id: 'law_card_valid1' }],
        quizzes: [{ id: 'law_quiz_valid1' }]
    };

    cleanOrphansForSubject('law', subjData);

    assert.ok(state.memorizedCards.has('law_card_valid1'), '유효 카드는 유지');
    assert.ok(!state.memorizedCards.has('law_card_orphan'), '고아 카드는 제거');
    assert.ok(!state.weakCards.has('law_card_orphan2'), '고아 약점 카드는 제거');
    assert.ok(!state.quizResults['law_quiz_orphan'], '고아 퀴즈 결과는 제거');
});

test('cleanOrphansForSubject: 다른 과목 ID는 영향 없음', () => {
    state.memorizedCards.add('safety_card_keep');
    state.memorizedCards.add('law_card_remove');

    const subjData = {
        cards: [{ id: 'law_card_valid' }],
        quizzes: []
    };

    cleanOrphansForSubject('law', subjData);

    assert.ok(state.memorizedCards.has('safety_card_keep'), '다른 과목은 영향 없음');
    assert.ok(!state.memorizedCards.has('law_card_remove'), '해당 과목 고아는 제거');
});

test('cleanOrphansForSubject: 빈 데이터면 아무것도 하지 않음', () => {
    state.memorizedCards.add('law_card_test');
    cleanOrphansForSubject('law', null);
    assert.ok(state.memorizedCards.has('law_card_test'), 'null 데이터면 유지');
});

test('cleanOrphansForSubject: 모든 ID가 유효하면 제거 없음', () => {
    state.memorizedCards.add('law_card_valid');
    state.quizResults['law_quiz_valid'] = { solved: true, correct: true };

    const subjData = {
        cards: [{ id: 'law_card_valid' }],
        quizzes: [{ id: 'law_quiz_valid' }]
    };

    cleanOrphansForSubject('law', subjData);

    assert.ok(state.memorizedCards.has('law_card_valid'), '유효 ID는 유지');
    assert.ok(state.quizResults['law_quiz_valid'], '유효 퀴즈는 유지');
});

// --- localStorage 안전성 테스트 ---

test('localStorage: setItem 실패 시에도 에러를 던지지 않음', () => {
    // setItem이 항상 예외를 던지는 스토리지
    const failingStorage = {
        getItem() { return null; },
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem() {},
        clear() {}
    };
    Object.defineProperty(global, 'localStorage', {
        value: failingStorage,
        writable: true,
        configurable: true
    });

    state.memorizedCards.add('test_card');
    // 에러를 던지지 않고 정상 진행되어야 함
    assert.doesNotThrow(() => saveProgress());
});

test('localStorage: getItem 실패 시에도 에러를 던지지 않음', () => {
    const failingStorage = {
        getItem() { throw new Error('SecurityError'); },
        setItem() {},
        removeItem() {},
        clear() {}
    };
    Object.defineProperty(global, 'localStorage', {
        value: failingStorage,
        writable: true,
        configurable: true
    });

    assert.doesNotThrow(() => loadProgress());
    assert.equal(state.memorizedCards.size, 0);
});
