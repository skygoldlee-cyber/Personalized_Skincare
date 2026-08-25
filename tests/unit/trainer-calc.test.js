import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalcQuestion } from '../../src/trainer-calc.js';

// buildCalcQuestion은 Math.random 기반이므로, 여러 번 호출하여
// 반환 구조와 정답 계산 로직을 검증한다.

test('buildCalcQuestion: 반환 객체 필수 필드', () => {
    const q = buildCalcQuestion();
    assert.ok(q.type, 'type 필드가 있어야 함');
    assert.ok(q.question, 'question 필드가 있어야 함');
    assert.ok(q.answer, 'answer 필드가 있어야 함');
    assert.ok(q.unit, 'unit 필드가 있어야 함');
    assert.ok(q.solution, 'solution 필드가 있어야 함');
});

test('buildCalcQuestion: 4가지 타입이 모두 생성됨 (100회 샘플)', () => {
    const types = new Set();
    for (let i = 0; i < 100; i++) {
        types.add(buildCalcQuestion().type);
    }
    assert.ok(types.has('원료 배합량'), '원료 배합량 타입이 생성되어야 함');
    assert.ok(types.has('혼합 평균 농도'), '혼합 평균 농도 타입이 생성되어야 함');
    assert.ok(types.has('한도 내 최대 추가량'), '한도 내 최대 추가량 타입이 생성되어야 함');
    assert.ok(types.has('희석 농도'), '희석 농도 타입이 생성되어야 함');
});

test('buildCalcQuestion: 원료 배합량 — 정답 = (C2/C1) * W', () => {
    for (let i = 0; i < 50; i++) {
        const q = buildCalcQuestion();
        if (q.type !== '원료 배합량') continue;
        // question에서 숫자 추출: 농도 X% ... Wg ... 농도 Y%
        const concs = [...q.question.matchAll(/<strong>(\d+)%<\/strong>/g)].map(m => Number(m[1]));
        const weight = Number(q.question.match(/<strong>(\d+)g<\/strong>/)?.[1]);
        if (concs.length >= 2 && weight) {
            const C1 = concs[0];
            const C2 = concs[1];
            const expected = ((C2 / C1) * weight).toFixed(2);
            assert.equal(q.answer, expected, `원료 배합량: C1=${C1}, C2=${C2}, W=${weight}`);
        }
    }
});

test('buildCalcQuestion: 혼합 평균 농도 — 정답 = (C1*W1 + C2*W2) / (W1+W2)', () => {
    for (let i = 0; i < 50; i++) {
        const q = buildCalcQuestion();
        if (q.type !== '혼합 평균 농도') continue;
        const concs = [...q.question.matchAll(/<strong>(\d+)%<\/strong>/g)].map(m => Number(m[1]));
        const weights = [...q.question.matchAll(/<strong>(\d+)g<\/strong>/g)].map(m => Number(m[1]));
        if (concs.length >= 2 && weights.length >= 2) {
            const C1 = concs[0], C2 = concs[1];
            const W1 = weights[0], W2 = weights[1];
            const expected = ((C1 * W1 + C2 * W2) / (W1 + W2)).toFixed(2);
            assert.equal(q.answer, expected, `혼합 평균 농도: C1=${C1}, W1=${W1}, C2=${C2}, W2=${W2}`);
        }
    }
});

test('buildCalcQuestion: 한도 내 최대 추가량 — 정답 = (L*W) / (100-L)', () => {
    for (let i = 0; i < 50; i++) {
        const q = buildCalcQuestion();
        if (q.type !== '한도 내 최대 추가량') continue;
        const limit = Number(q.question.match(/한도 <strong>([\d.]+)%<\/strong>/)?.[1]);
        const weight = Number(q.question.match(/내용물 <strong>(\d+)g<\/strong>/)?.[1]);
        if (limit && weight) {
            const expected = ((limit * weight) / (100 - limit)).toFixed(2);
            assert.equal(q.answer, expected, `한도 내 최대 추가량: L=${limit}, W=${weight}`);
        }
    }
});

test('buildCalcQuestion: 희석 농도 — 정답 = (W2 / (W1+W2)) * 100', () => {
    for (let i = 0; i < 50; i++) {
        const q = buildCalcQuestion();
        if (q.type !== '희석 농도') continue;
        const weights = [...q.question.matchAll(/<strong>(\d+)g<\/strong>/g)].map(m => Number(m[1]));
        if (weights.length >= 2) {
            const W1 = weights[0], W2 = weights[1];
            const expected = ((W2 / (W1 + W2)) * 100).toFixed(2);
            assert.equal(q.answer, expected, `희석 농도: W1=${W1}, W2=${W2}`);
        }
    }
});

test('buildCalcQuestion: 정답은 항상 소수점 둘째 자리', () => {
    for (let i = 0; i < 100; i++) {
        const q = buildCalcQuestion();
        assert.match(q.answer, /^\d+\.\d{2}$/, `answer="${q.answer}"는 소수점 둘째 자리 형식이어야 함`);
    }
});

test('buildCalcQuestion: 단위 검증', () => {
    for (let i = 0; i < 100; i++) {
        const q = buildCalcQuestion();
        if (q.type === '혼합 평균 농도' || q.type === '희석 농도') {
            assert.equal(q.unit, '%');
        } else {
            assert.equal(q.unit, 'g');
        }
    }
});
