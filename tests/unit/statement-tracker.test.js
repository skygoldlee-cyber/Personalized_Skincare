import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    recordStatementJudgments, getStatementStat, getWeakStatements, getDueStatementSids
} from '../../src/statement-tracker.js';
import { gradeAnswer } from '../../src/questions.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

// --- localStorage 모킹 (state.test.js와 동일 패턴) ---

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
    Object.defineProperty(global, 'localStorage', {
        value: mockStorage, writable: true, configurable: true
    });
});

afterEach(() => {
    if (originalLocalStorage !== undefined) {
        Object.defineProperty(global, 'localStorage', {
            value: originalLocalStorage, writable: true, configurable: true
        });
    } else {
        delete global.localStorage;
    }
});

const comboQ = {
    id: 'cb-t1', subject: 4, type: 'combo', points: 5,
    stem: '옳은 것을 모두 고른 것은?',
    statements: [
        { id: 'ㄱ', sid: 'st-t-1', text: '참1', truth: true },
        { id: 'ㄴ', sid: 'st-t-2', text: '참2', truth: true },
        { id: 'ㄷ', sid: 'st-t-3', text: '거짓', truth: false }
    ],
    options: [
        { id: '1', members: ['ㄱ', 'ㄴ'] },
        { id: '2', members: ['ㄱ', 'ㄴ', 'ㄷ'] }
    ]
};

test('recordStatementJudgments: 오판 진술만 오판 통계 누적', () => {
    // ㄷ(거짓 진술)을 참으로 오판 → '2' 선택 (오답)
    const res = gradeAnswer(comboQ, { optionId: '2' });
    const n = recordStatementJudgments(res.perStatement);
    assert.equal(n, 3);
    assert.deepEqual(getStatementStat('st-t-1'), { j: 1, w: 0, lw: null });
    assert.equal(getStatementStat('st-t-3').w, 1);
    assert.ok(getStatementStat('st-t-3').lw);
});

test('recordStatementJudgments: sid 없는 진술은 미기록', () => {
    const n = recordStatementJudgments([{ id: 'ㄱ', judgedCorrect: false }]);
    assert.equal(n, 0);
});

test('recordStatementJudgments: 잘못된 입력 안전 처리', () => {
    assert.equal(recordStatementJudgments(null), 0);
    assert.equal(recordStatementJudgments('x'), 0);
    assert.equal(recordStatementJudgments([]), 0);
});

test('getWeakStatements: 오판 많은 순 정렬', () => {
    recordStatementJudgments([
        { sid: 'a', judgedCorrect: false }, { sid: 'b', judgedCorrect: true }
    ]);
    recordStatementJudgments([
        { sid: 'a', judgedCorrect: false }, { sid: 'b', judgedCorrect: false }
    ]);
    const weak = getWeakStatements();
    assert.equal(weak[0].sid, 'a');
    assert.equal(weak[0].w, 2);
    assert.equal(weak.length, 2);
    assert.equal(getWeakStatements(1).length, 1);
});

test('getDueStatementSids: 오판 진술은 내일 복습 대기 아님(당일 기록 시 오늘 due)', () => {
    recordStatementJudgments([{ sid: 'a', judgedCorrect: false }]);
    const due = getDueStatementSids();
    // SM-2 오답 → interval 1일 → nextReview는 내일 → 오늘 due 목록엔 없음
    assert.equal(due.includes('a'), false);
});

test('getDueStatementSids: 과거 nextReview는 due로 검출', () => {
    recordStatementJudgments([{ sid: 'a', judgedCorrect: true }]);
    // 스케줄을 과거로 조작
    const raw = mockStorage.getItem(STORAGE_KEYS.FC_SPACED_REPETITION);
    const sch = JSON.parse(raw);
    sch['a'].nextReview = '2000-01-01';
    mockStorage.setItem(STORAGE_KEYS.FC_SPACED_REPETITION, JSON.stringify(sch));
    assert.deepEqual(getDueStatementSids(), ['a']);
});

test('recordStatementJudgments: 정답 선택은 오판 누적 없이 SM-2만 갱신', () => {
    const res = gradeAnswer(comboQ, { optionId: '1' }); // 정답
    recordStatementJudgments(res.perStatement);
    assert.equal(getWeakStatements().length, 0);
    // 스케줄은 3개 sid 모두 생성됨
    const sch = JSON.parse(mockStorage.getItem(STORAGE_KEYS.FC_SPACED_REPETITION));
    assert.equal(Object.keys(sch).length, 3);
    assert.equal(sch['st-t-1'].repetition, 1);
});
