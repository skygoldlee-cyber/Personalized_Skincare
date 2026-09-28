// tests/unit/notice-check.test.js — 식약처 고시 감지 배너 판정 로직
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isNewerNotice, normalizeNotice, findNoticeNumber } from '../../src/notice-check.js';

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

describe('normalizeNotice', () => {
    it('다양한 표기를 제YYYY-N호로 정규화', () => {
        assert.equal(normalizeNotice('제2026-19호'), '제2026-19호');
        assert.equal(normalizeNotice('2026-19'), '제2026-19호');
        assert.equal(normalizeNotice('제 2026 - 19 호'), '제2026-19호');
        assert.equal(normalizeNotice('제2025-1호'), '제2025-1호');
    });
    it('고시번호 형태가 아니면 null', () => {
        assert.equal(normalizeNotice('2100000276068'), null);
        assert.equal(normalizeNotice(''), null);
        assert.equal(normalizeNotice(null), null);
    });
});

describe('findNoticeNumber', () => {
    it('공포번호 필드에서 최신 고시번호 추출', () => {
        const detail = {
            AdmRulService: {
                행정규칙: {
                    기본정보: { 행정규칙명: '화장품 안전기준 등에 관한 규정' },
                    발령고시: { 공포번호: '제2025-63호', 공포일자: '20250902' },
                    개정고시: [{ 공포번호: '제2026-19호', 공포일자: '20260318' }],
                },
            },
        };
        assert.equal(findNoticeNumber(detail), '제2026-19호');
    });
    it('필드가 없으면 본문 텍스트의 제YYYY-N호 패턴으로 폴백', () => {
        assert.equal(findNoticeNumber({ 본문: '… 식약처고시 제2026-19호(2026.3.18) …' }), '제2026-19호');
    });
    it('고시번호를 찾지 못하면 null', () => {
        assert.equal(findNoticeNumber({ 행정규칙일련번호: '2100000276068' }), null);
    });
});
