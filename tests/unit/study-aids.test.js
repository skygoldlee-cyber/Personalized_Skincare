// tests/unit/study-aids.test.js
// 학습 보조 모듈의 순수 함수들을 합성 데이터로 검증.
// 교재 콘텐츠가 바뀌어도 로직 자체는 동일해야 함.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    extractExamHighlights,
    loadNumberDrills,
    detectProcedureFlow,
    detectAdminPenalty,
    isKeySection,
} from '../../src/study-aids.js';

// --- 합성 챕터 데이터 ---

const SAMPLE_CHAPTER = {
    sections: [
        {
            title: '개요',
            content: [
                '이것은 일반 텍스트입니다.',
                '🔖기출 화장품법 제5조는 **안전기준**을 규정한다.',
                '📌중요 시행규칙 별표1 품질관리기준',
                '| 용어 | 설명 |',
                '| --- | --- |',
                '| 표행 | 🔖기출 표 내부는 제외 |',
            ].join('\n'),
        },
        {
            title: '제조 관리',
            content: [
                '1. 원료 검수 (3일 이내)',
                '2. 제조 공정 (24시간)',
                '3. 품질 검사 (즉시)',
                '🔖기출 4. 출하 (48시간 이내)',
            ].join('\n'),
        },
    ],
};

// ==================== extractExamHighlights ====================

test('extractExamHighlights: 🔖기출/📌중요 마커 라인 추출', () => {
    const result = extractExamHighlights(SAMPLE_CHAPTER);
    assert.ok(result.length > 0, '최소 1개 섹션 반환');
    const section1 = result.find(r => r.sectionTitle === '개요');
    assert.ok(section1, '개요 섹션 존재');
    assert.ok(section1.items.length >= 2, '최소 2개 아이템');
});

test('extractExamHighlights: 마커 제거 후 텍스트 정제', () => {
    const result = extractExamHighlights(SAMPLE_CHAPTER);
    const section1 = result.find(r => r.sectionTitle === '개요');
    const item = section1.items.find(i => i.includes('화장품법'));
    assert.ok(item, '화장품법 아이템 존재');
    assert.ok(!item.includes('🔖기출'), '마커 제거됨');
    assert.ok(!item.includes('**'), '볼드 마커 제거됨');
});

test('extractExamHighlights: 표 행은 제외', () => {
    const chapter = {
        sections: [{
            title: '테스트',
            content: '| 용어 | 🔖기출 설명 |\n| --- | --- |\n| 항목 | 내용 |',
        }],
    };
    const result = extractExamHighlights(chapter);
    assert.equal(result.length, 0, '표 행만 있는 섹션은 결과 없음');
});

test('extractExamHighlights: 빈 챕터', () => {
    assert.deepEqual(extractExamHighlights({ sections: [] }), []);
    assert.deepEqual(extractExamHighlights({}), []);
});

test('extractExamHighlights: 120자 초과 시 자름', () => {
    const longText = '🔖기출 ' + 'A'.repeat(200);
    const chapter = { sections: [{ title: '긴 텍스트', content: longText }] };
    const result = extractExamHighlights(chapter);
    assert.equal(result[0].items[0].length, 120, '120자로 잘림');
});

test('extractExamHighlights: 2자 이하 결과 제외', () => {
    const chapter = {
        sections: [{
            title: '짧은',
            content: '🔖기출 A\n📌중요 BC',
        }],
    };
    const result = extractExamHighlights(chapter);
    // 'A' (1자, 제거), 'BC' (2자, 경계) — 마커 제거 후 길이 검사
    // 'A'는 length <= 2이므로 제외, 'BC'도 length <= 2이므로 제외
    assert.equal(result.length, 0, '2자 이하는 제외');
});

// ==================== loadNumberDrills ====================

test('loadNumberDrills: JSON 파일 로드 (fetch mock)', async () => {
    const mockData = [
        { numbers: [{ number: '15', unit: '일' }], context: '신속보고 15일 이내', isKey: true },
        { numbers: [{ number: '5', unit: '일' }], context: '회수계획서 5일 이내', isKey: true },
    ];
    globalThis.fetch = async (url) => ({
        ok: true,
        json: async () => mockData,
    });
    const result = await loadNumberDrills('test');
    assert.ok(Array.isArray(result), '배열 반환');
    assert.equal(result.length, 2, '2개 항목');
    assert.ok(result[0].numbers[0].number === '15', '첫 번째 숫자 15');
    assert.ok(result[0].context.includes('15일'), '문맥에 15일 포함');
});

test('loadNumberDrills: fetch 실패 시 빈 배열', async () => {
    globalThis.fetch = async () => ({ ok: false });
    const result = await loadNumberDrills('nonexistent');
    assert.deepEqual(result, [], 'fetch 실패 시 빈 배열');
});

test('loadNumberDrills: 캐시 동작', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
        callCount++;
        return { ok: true, json: async () => [{ numbers: [{ number: '1', unit: '일' }], context: 'test', isKey: false }] };
    };
    await loadNumberDrills('cache-test');
    await loadNumberDrills('cache-test');
    assert.equal(callCount, 1, '두 번째 호출은 캐시에서 로드');
});

// ==================== detectProcedureFlow ====================

test('detectProcedureFlow: 번호 리스트에서 절차 추출', () => {
    const chapter = {
        sections: [{
            title: '신고 절차',
            content: '1. 신청서 제출\n2. 심사 (30일)\n3. 승인 통지',
        }],
    };
    const result = detectProcedureFlow(chapter);
    assert.ok(result, '절차 감지됨');
    assert.ok(result.steps.length >= 2, '최소 2단계');
    assert.ok(result.title.includes('신고'), '제목에 신고 포함');
});

test('detectProcedureFlow: 원문자(①②③) 지원', () => {
    const chapter = {
        sections: [{
            title: '변경신고',
            content: '① 신청서 작성\n② 심사 진행\n③ 결과 통지',
        }],
    };
    const result = detectProcedureFlow(chapter);
    assert.ok(result, '원문자 리스트 감지');
    assert.equal(result.steps.length, 3, '3단계 추출');
});

test('detectProcedureFlow: 기한 추출', () => {
    const chapter = {
        sections: [{
            title: '교육 절차',
            content: '1. 접수\n2. 교육 이수 (16시간)\n3. 완료 즉시 발급',
        }],
    };
    const result = detectProcedureFlow(chapter);
    const stepWithDeadline = result.steps.find(s => s.detail);
    assert.ok(stepWithDeadline, '기한이 추출된 단계 존재');
});

test('detectProcedureFlow: 절차 키워드 없는 섹션 → null', () => {
    const chapter = {
        sections: [{
            title: '일반 정보',
            content: '1. 설명\n2. 참고사항',
        }],
    };
    assert.equal(detectProcedureFlow(chapter), null);
});

test('detectProcedureFlow: 단계 2개 미만 → null', () => {
    const chapter = {
        sections: [{
            title: '신고',
            content: '1. 신청서 제출',
        }],
    };
    assert.equal(detectProcedureFlow(chapter), null, '1단계만 있으면 null');
});

test('detectProcedureFlow: 빈 챕터', () => {
    assert.equal(detectProcedureFlow({ sections: [] }), null);
    assert.equal(detectProcedureFlow({}), null);
});

// ==================== detectAdminPenalty ====================

test('detectAdminPenalty: 행정처분 표 추출', () => {
    const chapter = {
        sections: [{
            title: '행정처분 기준',
            content: [
                '| 위반 내용 | 1차 | 2차 |',
                '| --- | --- | --- |',
                '| 허위 표시 | 시정명령 | 영업정지 |',
                '| 미신고 | 과징금 | 영업정지 |',
            ].join('\n'),
        }],
    };
    const result = detectAdminPenalty(chapter);
    assert.ok(result, '행정처분 표 감지');
    assert.ok(result.headers.length >= 2, '헤더 2개 이상');
    assert.ok(result.rows.length >= 2, '데이터 행 2개 이상');
    assert.ok(result.rows[0].label, '첫 행 라벨 존재');
    assert.ok(result.rows[0].penalties.length >= 1, '페널티 존재');
});

test('detectAdminPenalty: 행정처분 키워드 없는 섹션 → null', () => {
    const chapter = {
        sections: [{
            title: '일반',
            content: '| 항목 | 내용 |\n| --- | --- |\n| A | B |',
        }],
    };
    assert.equal(detectAdminPenalty(chapter), null);
});

test('detectAdminPenalty: 행 2개 미만 → null', () => {
    const chapter = {
        sections: [{
            title: '행정처분',
            content: '| 위반 | 1차 |\n| --- | --- |\n| 단일 | 행 |',
        }],
    };
    assert.equal(detectAdminPenalty(chapter), null, '행 1개면 null');
});

test('detectAdminPenalty: 빈 챕터', () => {
    assert.equal(detectAdminPenalty({ sections: [] }), null);
    assert.equal(detectAdminPenalty({}), null);
});

// ==================== isKeySection ====================

test('isKeySection: 🔖기출 마커 감지', () => {
    assert.equal(isKeySection({ title: '제1장', content: '🔖기출 내용' }), true);
});

test('isKeySection: 📌중요 마커 감지', () => {
    assert.equal(isKeySection({ title: '제1장', content: '📌중요 내용' }), true);
});

test('isKeySection: 🎯 기출 마커 감지', () => {
    assert.equal(isKeySection({ title: '제1장', content: '🎯 기출 내용' }), true);
});

test('isKeySection: 마커 없음 → false', () => {
    assert.equal(isKeySection({ title: '제1장', content: '일반 내용' }), false);
});

test('isKeySection: 제목에 마커가 있어도 감지', () => {
    assert.equal(isKeySection({ title: '🔖기출 제1장', content: '내용' }), true);
});

test('isKeySection: 빈 입력', () => {
    assert.equal(isKeySection({}), false);
    assert.equal(isKeySection({ title: '', content: '' }), false);
});
