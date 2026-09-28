// tests/unit/notice-check.test.js — 식약처 고시 감지 배너 판정 로직
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isNewerNotice } from '../../src/notice-check.js';

const base = { notice: '제2026-19호', effectiveDate: '2026-03-18' };
const status = (latest, baseline = base) => ({ baseline, latest });

describe('isNewerNotice', () => {
    it('latest 시행일이 baseline보다 크면 true', () => {
        assert.equal(isNewerNotice(status({ notice: '제2026-30호', effectiveDate: '2026-09-01' })), true);
    });
    it('같은 시행일이면 false', () => {
        assert.equal(isNewerNotice(status({ notice: '제2026-19호', effectiveDate: '2026-03-18' })), false);
    });
    it('latest가 더 오래됐으면 false', () => {
        assert.equal(isNewerNotice(status({ notice: '제2025-63호', effectiveDate: '2025-09-02' })), false);
    });
    it('시행일이 비어 있으면 고시번호로 비교', () => {
        const st = { baseline: { notice: '제2026-19호' }, latest: { notice: '제2026-25호' } };
        assert.equal(isNewerNotice(st), true);
        const st2 = { baseline: { notice: '제2026-19호' }, latest: { notice: '제2026-19호' } };
        assert.equal(isNewerNotice(st2), false);
    });
    it('latest/baseline 누락 시 false', () => {
        assert.equal(isNewerNotice({}), false);
        assert.equal(isNewerNotice(status(null)), false);
        assert.equal(isNewerNotice(null), false);
    });
    it('날짜·번호 모두 판정 불가면 false', () => {
        assert.equal(isNewerNotice(status({ notice: '알 수 없음' }, { notice: '없음' })), false);
    });
});
