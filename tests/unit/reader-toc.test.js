// tests/unit/reader-toc.test.js — 리더 목차 추출 헬퍼 검증
// @spec TR-06
// textbook-reader.js에서 reader-toc.js로 분리된 순수 함수군의 계약 고정:
// 메타 섹션 판정·번호 기반 계층·참조 접두사 제거·코드블록 제외 하위 헤딩.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const {
    isStoryMetaSection, filterMetaSections, getTocLevel,
    hasOwnNumber, cleanRefTitle, extractSubHeadings,
} = require(join(ROOT, 'src/reader-toc.js'));

test('isStoryMetaSection — 메타 섹션 제목 판정', () => {
    assert.ok(isStoryMetaSection('🧭 학습 아이콘'));
    assert.ok(isStoryMetaSection('✅ 확인문제'));
    assert.ok(isStoryMetaSection('출처: 화장품법'));
    assert.ok(!isStoryMetaSection('1. 화장품의 정의'));
    assert.ok(!isStoryMetaSection(''));
});

test('filterMetaSections — 메타 섹션만 제거하고 나머지 보존', () => {
    const chapter = {
        sections: [
            { title: '1. 개요' },
            { title: '✅ 확인문제' },
            { title: '2. 세부' },
        ],
    };
    const out = filterMetaSections(chapter);
    assert.equal(out.sections.length, 2);
    assert.equal(out.sections[0].title, '1. 개요');
    assert.equal(out.sections[1].title, '2. 세부');
});

test('getTocLevel — 번호 패턴 계층', () => {
    assert.equal(getTocLevel('1.1.1 세부'), 3);
    assert.equal(getTocLevel('1.1 세부'), 2);
    assert.equal(getTocLevel('1. 세부'), 1);
    assert.equal(getTocLevel('제3조 정의'), 0);
});

test('hasOwnNumber — 자체 번호 보유 제목', () => {
    assert.ok(hasOwnNumber('1. 개요'));
    assert.ok(hasOwnNumber('(3) 항목'));
    assert.ok(hasOwnNumber('Chapter 02 제조시설'));
    assert.ok(!hasOwnNumber('세부 내용'));
});

test('cleanRefTitle — NN_ 접두사 제거', () => {
    assert.equal(cleanRefTitle('01_화장품법'), '화장품법');
    assert.equal(cleanRefTitle('화장품법'), '화장품법');
});

test('extractSubHeadings — ### / #### 추출, 코드블록 제외', () => {
    const content = [
        '본문',
        '### 소제목',
        '#### 세부제목',
        '```',
        '### 코드 안의 헤딩 아님',
        '```',
        '### 다음 제목',
    ].join('\n');
    const out = extractSubHeadings(content);
    assert.deepEqual(out, [
        { level: 3, title: '소제목' },
        { level: 4, title: '세부제목' },
        { level: 3, title: '다음 제목' },
    ]);
    assert.deepEqual(extractSubHeadings(''), []);
    assert.deepEqual(extractSubHeadings(null), []);
});
