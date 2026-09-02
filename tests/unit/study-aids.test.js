// tests/unit/study-aids.test.js
// 학습 보조 모듈의 순수 함수들을 합성 데이터로 검증.
// 교재 콘텐츠가 바뀌어도 로직 자체는 동일해야 함.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    extractExamHighlights,
    extractNumberDrills,
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

// ==================== extractNumberDrills ====================

test('extractNumberDrills: 숫자+단위 패턴 추출', () => {
    const chapter = {
        sections: [{
            title: '기준',
            content: '안전기준: 0.5g 이하\n유지기간: 12ppm\n부피: 25ml',
        }],
    };
    const result = extractNumberDrills(chapter);
    assert.ok(result.length > 0, '최소 1개 섹션');
    const entries = result[0].entries;
    const nums = entries.map(e => e.number + e.unit);
    assert.ok(nums.some(n => n.includes('0.5g')), '0.5g 추출');
    assert.ok(nums.some(n => n.includes('12ppm')), '12ppm 추출');
    assert.ok(nums.some(n => n.includes('25ml')), '25ml 추출');
});

test('extractNumberDrills: 중복 제거 (같은 섹션 내)', () => {
    const chapter = {
        sections: [{
            title: '테스트',
            content: '농도 10g 입니다\n비율 10g 입니다',
        }],
    };
    const result = extractNumberDrills(chapter);
    const tens = result[0].entries.filter(e => e.number === '10' && e.unit === 'g');
    assert.equal(tens.length, 1, '동일 숫자+단위는 1개만');
});

test('extractNumberDrills: 빈칸(▓▓) 치환 확인', () => {
    const chapter = {
        sections: [{
            title: '테스트',
            content: '농도는 30g 이하',
        }],
    };
    const result = extractNumberDrills(chapter);
    assert.ok(result[0].entries[0].context.includes('▓▓'), '숫자 부분이 빈칸으로 치환됨');
});

test('extractNumberDrills: isKey 플래그 (🔖기출/📌중요 라인)', () => {
    const chapter = {
        sections: [{
            title: '테스트',
            content: '🔖기출 제한 농도 5g\n일반 농도 3g',
        }],
    };
    const result = extractNumberDrills(chapter);
    const fiveG = result[0].entries.find(e => e.number === '5');
    const threeG = result[0].entries.find(e => e.number === '3');
    assert.equal(fiveG.isKey, true, '기출 라인의 숫자는 isKey=true');
    assert.equal(threeG.isKey, false, '일반 라인은 isKey=false');
});

test('extractNumberDrills: 빈 챕터', () => {
    assert.deepEqual(extractNumberDrills({ sections: [] }), []);
    assert.deepEqual(extractNumberDrills({}), []);
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
