// tests/unit/law-links.test.js — 참조자료 → law.go.kr 원문 링크 매핑
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lawUrlFor } from '../../src/law-links.js';

describe('lawUrlFor', () => {
    it('법률·시행규칙 본문 → 법령 한글주소', () => {
        assert.equal(lawUrlFor('화장품법(법률)(제20901호)(20260402).pdf'),
            'https://www.law.go.kr/법령/화장품법');
        assert.equal(lawUrlFor('화장품법 시행규칙(총리령)(제02109호)(20260402).pdf'),
            'https://www.law.go.kr/법령/화장품법시행규칙');
    });
    it('시행규칙 별표 파편 → 모법(시행규칙)', () => {
        assert.equal(lawUrlFor('시행규칙_별표7_행정처분기준.pdf'),
            'https://www.law.go.kr/법령/화장품법시행규칙');
    });
    it('고시 본문·별표 → 행정규칙 한글주소', () => {
        assert.equal(lawUrlFor('화장품 안전기준 등에 관한 규정(식품의약품안전처고시)(제2026-19호)(20260318).pdf'),
            'https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정');
        assert.equal(lawUrlFor('안전기준_별표1_사용불가원료.pdf'),
            'https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정');
        assert.equal(lawUrlFor('CGMP_별표2_실시상황평가표.pdf'),
            'https://www.law.go.kr/행정규칙/우수화장품제조및품질관리기준');
        assert.equal(lawUrlFor('KFCC_별표4_자외선보호.pdf'),
            'https://www.law.go.kr/행정규칙/기능성화장품기준및시험방법');
        assert.equal(lawUrlFor('주의사항_별표2_알레르기유발성분25종.pdf'),
            'https://www.law.go.kr/행정규칙/화장품사용할때의주의사항및알레르기유발성분표시에관한규정');
        assert.equal(lawUrlFor('색소종류및기준_전체.pdf'),
            'https://www.law.go.kr/행정규칙/화장품의색소종류및기준');
    });
    it('내부 정리 문서·원료 DB는 null (원문 아님)', () => {
        assert.equal(lawUrlFor('1.cosmetic-law.md'), null);
        assert.equal(lawUrlFor('banned_ingredients.md'), null);
        assert.equal(lawUrlFor(null), null);
        assert.equal(lawUrlFor(''), null);
    });
    it('기능성화장품 심사 규정은 기준·시험방법보다 먼저 매칭', () => {
        assert.equal(lawUrlFor('기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf'),
            'https://www.law.go.kr/행정규칙/기능성화장품심사에관한규정');
    });
});
