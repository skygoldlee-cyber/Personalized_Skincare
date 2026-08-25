import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sha256hex, stableId } from '../../src/sha256.js';

// Node crypto.createHash('sha256')와 순수 JS 구현이 동일한지 크로스 검증
function nodeSha256(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

test('sha256hex: 빈 문자열', () => {
    const expected = nodeSha256('');
    assert.equal(sha256hex(''), expected);
    assert.equal(sha256hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('sha256hex: ASCII 문자열', () => {
    const input = 'hello world';
    assert.equal(sha256hex(input), nodeSha256(input));
});

test('sha256hex: 유니코드/한글', () => {
    const input = '화장품 조제관리사';
    assert.equal(sha256hex(input), nodeSha256(input));
});

test('sha256hex: 특수문자 및 이모지', () => {
    const input = '🔒 test <script>alert(1)</script>';
    assert.equal(sha256hex(input), nodeSha256(input));
});

test('sha256hex: 긴 문자열 (1000자)', () => {
    const input = 'a'.repeat(1000);
    assert.equal(sha256hex(input), nodeSha256(input));
});

test('sha256hex: 64바이트 경계 (패딩 경계)', () => {
    // 55바이트: 패딩이 한 블록에 들어가는 경계
    assert.equal(sha256hex('a'.repeat(55)), nodeSha256('a'.repeat(55)));
    // 56바이트: 패딩이 다음 블록으로 넘어가는 경계
    assert.equal(sha256hex('a'.repeat(56)), nodeSha256('a'.repeat(56)));
    // 64바이트: 정확히 한 블록
    assert.equal(sha256hex('a'.repeat(64)), nodeSha256('a'.repeat(64)));
});

test('sha256hex: 출력은 64자 소문자 hex', () => {
    const result = sha256hex('test');
    assert.match(result, /^[0-9a-f]{64}$/);
});

test('stableId: 형식 검증', () => {
    const id = stableId('law', 'ch1', 'card', '화장품법');
    assert.match(id, /^law_card_[0-9a-f]{6}$/);
});

test('stableId: 동일 입력은 동일 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('law', 'ch1', 'card', '화장품법');
    assert.equal(id1, id2);
});

test('stableId: 다른 subjectKey는 다른 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('safety', 'ch1', 'card', '화장품법');
    assert.notEqual(id1, id2);
});

test('stableId: 다른 type은 다른 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('law', 'ch1', 'quiz', '화장품법');
    assert.notEqual(id1, id2);
});

test('stableId: 다른 term은 다른 ID', () => {
    const id1 = stableId('law', 'ch1', 'card', '화장품법');
    const id2 = stableId('law', 'ch1', 'card', '안전관리');
    assert.notEqual(id1, id2);
});

test('stableId: 빌드 id-factory와 동일 결과 (크로스 검증)', async () => {
    // tools/build/id-factory.js는 CommonJS → 동적 import
    const { stableId: buildStableId } = await import('../../tools/build/id-factory.js');
    const cases = [
        ['law', 'ch1', 'card', '화장품법'],
        ['safety', 'ch2', 'quiz', '작업장 위생관리'],
        ['manufacturing', 'ch3', 'card', '원료의 종류'],
        ['understanding', 'ch1', 'quiz', '피부 생리구조'],
    ];
    for (const [sk, ck, type, term] of cases) {
        assert.equal(stableId(sk, ck, type, term), buildStableId(sk, ck, type, term),
            `ID mismatch for ${sk}|${ck}|${type}|${term}`);
    }
});
