import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChosung } from '../../src/utils.js';

test('getChosung: 한글 초성 추출', () => {
    assert.equal(getChosung('화장품'), 'ㅎㅈㅍ');
    assert.equal(getChosung('안전관리'), 'ㅇㅈㄱㄹ');
    assert.equal(getChosung('조제'), 'ㅈㅈ');
});

test('getChosung: 단일 글자', () => {
    assert.equal(getChosung('가'), 'ㄱ');
    assert.equal(getChosung('힣'), 'ㅎ');
});

test('getChosung: 빈 문자열', () => {
    assert.equal(getChosung(''), '');
});

test('getChosung: 비한글 문자는 그대로 반환', () => {
    assert.equal(getChosung('ABC'), 'ABC');
    assert.equal(getChosung('123'), '123');
    assert.equal(getChosung('!@#'), '!@#');
});

test('getChosung: 한글과 비한글 혼재', () => {
    assert.equal(getChosung('화장품 ABC'), 'ㅎㅈㅍ ABC');
    assert.equal(getChosung('A안전1'), 'Aㅇㅈ1');
});

test('getChosung: 초성만 있는 경우 (ㄱ~ㅎ 범위 밖)', () => {
    // 초성 자체는 완성형 한글이 아니므로 그대로 반환
    assert.equal(getChosung('ㄱㄴㄷ'), 'ㄱㄴㄷ');
});

test('getChosung: 공백 문자 유지', () => {
    assert.equal(getChosung('화 장 품'), 'ㅎ ㅈ ㅍ');
});
