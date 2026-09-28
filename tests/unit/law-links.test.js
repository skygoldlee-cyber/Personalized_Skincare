// tests/unit/law-links.test.js — 참조자료 → law.go.kr 원문 링크 매핑
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    it('표시명(공백 구분)도 매칭 — 파일명과 표시명 혼용', () => {
        assert.equal(lawUrlFor('시행규칙 별표7 행정처분기준'),
            'https://www.law.go.kr/법령/화장품법시행규칙');
        assert.equal(lawUrlFor('화장품 안전기준 등에 관한 규정'),
            'https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정');
    });
    it('내부 정리 문서·승인 원료 DB는 null (공식 원문 아님)', () => {
        assert.equal(lawUrlFor('1.cosmetic-law.md'), null);
        assert.equal(lawUrlFor('approved_ingredients.md'), null);
        assert.equal(lawUrlFor(null), null);
        assert.equal(lawUrlFor(''), null);
    });
    it('원료 DB → 근거 고시 (금지·제한 → 안전기준, 색소 → 색소 고시)', () => {
        assert.equal(lawUrlFor('banned_ingredients.md'),
            'https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정');
        assert.equal(lawUrlFor('restricted_ingredients.md'),
            'https://www.law.go.kr/행정규칙/화장품안전기준등에관한규정');
        assert.equal(lawUrlFor('colorants_ingredients.md'),
            'https://www.law.go.kr/행정규칙/화장품의색소종류및기준');
    });
    it('기능성화장품 심사 규정은 기준·시험방법보다 먼저 매칭', () => {
        assert.equal(lawUrlFor('기능성화장품 심사에 관한 규정(식품의약품안전처고시)(제2025-88호)(20251216).pdf'),
            'https://www.law.go.kr/행정규칙/기능성화장품심사에관한규정');
    });
    it('전수 검증 — references.json의 공식 문서 전부 매칭, 오매칭 없음', () => {
        const refs = JSON.parse(readFileSync('content/exams/cosmetic/references.json', 'utf8'));
        const pools = [
            ...(refs.referenceLaw || []),
            ...(refs.referenceCommon || []),
            ...Object.values(refs.referenceFiles || {}).flat(),
        ];
        const unmapped = [];
        for (const f of pools) {
            const url = lawUrlFor(f.file) || lawUrlFor(f.name);
            if (f.type === 'md') continue; // 내부 정리 문서 — 원문 매칭 선택사항
            if (!url) { unmapped.push(f.file || f.name); continue; }
            assert.ok(url.startsWith('https://www.law.go.kr/'), `${f.file}: 잘못된 도메인`);
            // 법령 문서는 /법령/, 고시·별표 문서는 /행정규칙/ — 도메인 유형 오매칭 방지
            if (/법률|대통령령|총리령|시행규칙|시행령/.test(f.file || '')) {
                assert.ok(url.includes('/법령/'), `${f.file}: 법령이 행정규칙으로 매칭됨`);
            }
        }
        assert.deepEqual(unmapped, [], `미매칭 공식 문서: ${unmapped.join(', ')}`);
    });
});
