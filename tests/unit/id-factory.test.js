import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

// id-factory.js는 CommonJS(require)이므로 createRequire로 로드
const require = createRequire(import.meta.url);
const { stableId, shortHash, CONTENT_HASH_LEN, ID_HASH_LEN } = require('../../tools/build/id-factory.js');

function nodeSha256(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

test('stableId: 형식 = subjectKey_type_hash6', () => {
    const id = stableId('law', 'ch1', 'card', '화장품법');
    assert.match(id, /^law_card_[0-9a-f]{6}$/);
});

test('stableId: 동일 입력 → 동일 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('law', 'ch1', 'card', '화장품법');
    assert.equal(id1, id2);
});

test('stableId: 다른 subjectKey → 다른 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('safety', 'ch1', 'card', '화장품법');
    assert.notEqual(id1, id2);
});

test('stableId: 다른 chapterKey → 다른 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('law', 'ch2', 'card', '화장품법');
    assert.notEqual(id1, id2);
});

test('stableId: 다른 type → 다른 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('law', 'ch1', 'quiz', '화장품법');
    assert.notEqual(id1, id2);
});

test('stableId: 다른 term → 다른 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('law', 'ch1', 'card', '안전관리');
    assert.notEqual(id1, id2);
});

test('stableId: Node crypto와 직접 검증', () => {
    const raw = 'law|ch1|화장품법';
    const expectedHash = nodeSha256(raw).substring(0, ID_HASH_LEN);
    const expected = `law_card_${expectedHash}`;
    assert.equal(stableId('law', 'ch1', 'card', '화장품법'), expected);
});

test('shortHash: 기본 길이는 ID_HASH_LEN (6)', () => {
    const hash = shortHash('test');
    assert.equal(hash.length, ID_HASH_LEN);
    assert.equal(ID_HASH_LEN, 6);
});

test('shortHash: CONTENT_HASH_LEN은 8', () => {
    assert.equal(CONTENT_HASH_LEN, 8);
});

test('shortHash: 지정 길이로 자름', () => {
    const hash = shortHash('test', CONTENT_HASH_LEN);
    assert.equal(hash.length, CONTENT_HASH_LEN);
});

test('shortHash: Node crypto와 동일', () => {
    assert.equal(shortHash('화장품'), nodeSha256('화장품').substring(0, ID_HASH_LEN));
});

test('shortHash: 동일 입력 → 동일 출력', () => {
    assert.equal(shortHash('abc'), shortHash('abc'));
});

test('shortHash: 다른 입력 → 다른 출력', () => {
    assert.notEqual(shortHash('abc'), shortHash('xyz'));
});
