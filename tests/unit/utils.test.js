// tests/unit/utils.test.js — 공용 유틸 검증 (날짜 키·시간 포맷·정규식·디바운스)
// @spec SC-03,T-03
// todayKey/localDateKey는 로컬 시간대 기준이어야 한다 — UTC slice는
// KST 00~09시에 하루 전으로 버킷되는 회귀를 재발시키므로 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { todayKey, localDateKey, escapeRegExp, debounce, fmtMMSS, fmtClock } = require(join(ROOT, 'src/utils.js'));

test('localDateKey — 로컬 성분으로 YYYY-MM-DD 조립', () => {
    const d = new Date(2026, 0, 5, 9, 30); // 2026-01-05 09:30 로컬
    assert.equal(localDateKey(d), '2026-01-05');
    assert.match(localDateKey(d), /^\d{4}-\d{2}-\d{2}$/);
});

test('localDateKey — 임의 시각에서 로컬 성분 조립과 일치 (UTC slice 아님)', () => {
    for (const ms of [0, Date.UTC(2026, 0, 5, 23, 0), Date.UTC(2026, 6, 1, 12, 0)]) {
        const d = new Date(ms);
        const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        assert.equal(localDateKey(d), localStr);
    }
});

test('todayKey — 인자 없으면 오늘, 인자 있으면 해당 일자', () => {
    assert.equal(todayKey(new Date(2030, 11, 25)), '2030-12-25');
    assert.equal(todayKey(), localDateKey(new Date()));
});

test('fmtMMSS — mm:ss 고정폭, 60분 초과도 누적', () => {
    assert.equal(fmtMMSS(0), '00:00');
    assert.equal(fmtMMSS(65), '01:05');
    assert.equal(fmtMMSS(6000), '100:00');
    assert.equal(fmtMMSS(-3), '00:00');
    assert.equal(fmtMMSS(NaN), '00:00');
});

test('fmtClock — m:ss, 1시간 이상 h:mm:ss', () => {
    assert.equal(fmtClock(0), '0:00');
    assert.equal(fmtClock(185), '3:05');
    assert.equal(fmtClock(3661), '1:01:01');
    assert.equal(fmtClock(-1), '0:00');
});

test('escapeRegExp — 정규식 특수문자 이스케이프', () => {
    assert.equal(escapeRegExp('a.b*c'), 'a\\.b\\*c');
    assert.equal(escapeRegExp('(괄호)[대괄호]'), '\\(괄호\\)\\[대괄호\\]');
    // 이스케이프 결과가 실제 RegExp로 리터럴 매칭됨
    assert.ok(new RegExp(`^${escapeRegExp('10% + 5%')}$`).test('10% + 5%'));
});

test('debounce — 마지막 호출만 실행, cancel로 대기 취소', async () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 20);
    fn(); fn(); fn();
    await new Promise(r => setTimeout(r, 40));
    assert.equal(calls, 1);

    fn();
    fn.cancel();
    await new Promise(r => setTimeout(r, 40));
    assert.equal(calls, 1);
});
