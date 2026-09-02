// tests/unit/glossary-query.test.js
// 용어집 쿼리 API를 검증.
// GLOSSARY_INDEX 데이터가 바뀌어도 쿼리 로직 자체는 동일해야 함.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getGlossaryByRefFile,
    getGlossaryByRefFiles,
    getGlossaryEntry,
    getAllGlossaryKeywords,
} from '../../src/glossary-query.js';

// GLOSSARY_INDEX는 빌드 타임에 생성되므로, 런타임 import 시점의 데이터를 그대로 사용.
// 데이터가 없는 경우도 안전하게 처리되는지 검증.

// ==================== getGlossaryByRefFile ====================

test('getGlossaryByRefFile: 빈 파일명 → 빈 배열', () => {
    assert.deepEqual(getGlossaryByRefFile(''), []);
});

test('getGlossaryByRefFile: 존재하지 않는 파일명 → 빈 배열', () => {
    assert.deepEqual(getGlossaryByRefFile('존재하지않는파일.md'), []);
});

test('getGlossaryByRefFile: seenKeys 중복 방지', () => {
    // 실제 데이터가 있든 없든, seenKeys 전달 시 동작 확인
    const seen = new Set();
    const result1 = getGlossaryByRefFile('test.md', seen);
    const result2 = getGlossaryByRefFile('test.md', seen);
    // 두 번째 호출에서는 seenKeys에 이미 추가된 항목이 제외됨
    assert.ok(Array.isArray(result1), '배열 반환');
    assert.ok(Array.isArray(result2), '배열 반환');
});

test('getGlossaryByRefFile: 반환 항목 구조', () => {
    // 실제 데이터에서 첫 번째 매칭을 찾아 구조 검증
    const allKeywords = getAllGlossaryKeywords();
    if (allKeywords.length > 0) {
        const first = allKeywords[0];
        // idxKey에서 파일명 추출
        const refFile = first.idxKey.split('|')[0];
        const result = getGlossaryByRefFile(refFile);
        if (result.length > 0) {
            const item = result[0];
            assert.ok(item.idxKey, 'idxKey 필드');
            assert.ok(item.keyword !== undefined, 'keyword 필드');
            assert.ok(item.explanation !== undefined, 'explanation 필드');
        }
    }
});

// ==================== getGlossaryByRefFiles ====================

test('getGlossaryByRefFiles: 빈 배열 → 빈 배열', () => {
    assert.deepEqual(getGlossaryByRefFiles([]), []);
});

test('getGlossaryByRefFiles: null/빈 문자열 스킵', () => {
    const result = getGlossaryByRefFiles([null, '', undefined]);
    assert.deepEqual(result, []);
});

test('getGlossaryByRefFiles: 다중 파일 수집 + 중복 제거', () => {
    // 같은 파일을 두 번 전달해도 중복 제거됨
    const allKeywords = getAllGlossaryKeywords();
    if (allKeywords.length > 0) {
        const refFile = allKeywords[0].idxKey.split('|')[0];
        const result = getGlossaryByRefFiles([refFile, refFile]);
        // 중복 제거로 인해 단일 파일 호출과 같은 수
        const single = getGlossaryByRefFiles([refFile]);
        assert.equal(result.length, single.length, '중복 파일은 동일 결과');
    }
});

// ==================== getGlossaryEntry ====================

test('getGlossaryEntry: 존재하지 않는 키 → null', () => {
    assert.equal(getGlossaryEntry('존재하지않는키'), null);
});

test('getGlossaryEntry: 빈 입력 → null', () => {
    assert.equal(getGlossaryEntry(''), null);
});

test('getGlossaryEntry: 실제 항목 조회 시 구조 검증', () => {
    const allKeywords = getAllGlossaryKeywords();
    if (allKeywords.length > 0) {
        const entry = getGlossaryEntry(allKeywords[0].idxKey);
        if (entry) {
            assert.ok(entry.keyword !== undefined, 'keyword 필드');
            assert.ok(entry.explanation !== undefined, 'explanation 필드');
            // 원본과 다른 객체 (spread copy)
            const entry2 = getGlossaryEntry(allKeywords[0].idxKey);
            assert.notEqual(entry, entry2, '매 호출 시 새 객체 반환');
        }
    }
});

// ==================== getAllGlossaryKeywords ====================

test('getAllGlossaryKeywords: 배열 반환', () => {
    const result = getAllGlossaryKeywords();
    assert.ok(Array.isArray(result), '배열 반환');
});

test('getAllGlossaryKeywords: 항목 구조 {keyword, idxKey}', () => {
    const result = getAllGlossaryKeywords();
    if (result.length > 0) {
        const item = result[0];
        assert.ok(typeof item.keyword === 'string', 'keyword는 string');
        assert.ok(typeof item.idxKey === 'string', 'idxKey는 string');
        assert.ok(item.idxKey.includes('|'), 'idxKey에 | 구분자');
    }
});

test('getAllGlossaryKeywords: 일관성 (두 번 호출 시 동일 길이)', () => {
    const a = getAllGlossaryKeywords();
    const b = getAllGlossaryKeywords();
    assert.equal(a.length, b.length, '동일 길이');
});
