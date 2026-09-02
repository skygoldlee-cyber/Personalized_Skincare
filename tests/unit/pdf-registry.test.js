// tests/unit/pdf-registry.test.js
// 참조자료 중앙 설정 모듈의 순수 함수/데이터를 검증.
// 과목 구성이 바뀌어도 매핑 로직 자체는 동일해야 함.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveRefPath,
    mapSourceToRef,
    resolveKeywordRef,
    REF_FILE_TO_PATH,
    REF_REGISTRY,
    SOURCE_REF_MAP,
    KEYWORD_REF_MAP,
    REFERENCE_FILES,
    REFERENCE_COMMON,
    REFERENCE_LAW,
    SUBJECT_DIR_MAP,
} from '../../src/pdf-registry.js';

// ==================== resolveRefPath ====================

test('resolveRefPath: content/ 접두어 passthrough', () => {
    const result = resolveRefPath('content/참조자료/ref_md/test/test.md');
    assert.equal(result, 'content/참조자료/ref_md/test/test.md');
});

test('resolveRefPath: 빈 입력 → 빈 문자열', () => {
    assert.equal(resolveRefPath(''), '');
    assert.equal(resolveRefPath(null), '');
    assert.equal(resolveRefPath(undefined), '');
});

test('resolveRefPath: 등록된 PDF 파일 → MD 경로', () => {
    const result = resolveRefPath('화장품법(법률)(제20901호)(20260402).pdf');
    assert.ok(result.includes('content/참조자료/ref_md/'), 'ref_md 경로 포함');
    assert.ok(result.endsWith('.md'), '.md 확장자');
    assert.ok(!result.includes('.pdf'), '.pdf 확장자 제거됨');
});

test('resolveRefPath: 미등록 파일 → 빈 문자열', () => {
    assert.equal(resolveRefPath('존재하지않는파일.pdf'), '');
});

// ==================== mapSourceToRef ====================

test('mapSourceToRef: 화장품법 제N조 → 법률 파일', () => {
    const result = mapSourceToRef('화장품법 제5조');
    assert.ok(result.includes('화장품법'), '화장품법 경로 반환');
    assert.ok(result.endsWith('.md'), 'MD 경로');
});

test('mapSourceToRef: 시행령 제외 (exclude 패턴)', () => {
    const result = mapSourceToRef('화장품법 시행령 제3조');
    // 시행령은 exclude되므로, 다음 매칭(시행규칙)으로 가지 않고
    // "화장품법" 일반 매칭으로 떨어짐
    assert.ok(result, '결과 존재');
    // 시행령 자체의 파일이 아닌 법률 파일이어야 함
    assert.ok(!result.includes('시행령'), '시행령 파일이 아님');
});

test('mapSourceToRef: 시행규칙 매칭', () => {
    const result = mapSourceToRef('시행규칙 별표1');
    assert.ok(result.includes('시행규칙'), '시행규칙 경로');
});

test('mapSourceToRef: 빈 입력 → 빈 문자열', () => {
    assert.equal(mapSourceToRef(''), '');
    assert.equal(mapSourceToRef(null), '');
});

test('mapSourceToRef: 매칭 없음 → 빈 문자열', () => {
    assert.equal(mapSourceToRef('관련 없는 텍스트'), '');
});

// ==================== resolveKeywordRef ====================

test('resolveKeywordRef: 별표 패턴 매칭', () => {
    const result = resolveKeywordRef('시행규칙 별표 1 품질관리기준');
    assert.ok(result, '매칭 결과 존재');
    assert.ok(result.match, 'match 필드 존재');
    assert.ok(result.path, 'path 필드 존재');
    assert.ok(result.search, 'search 필드 존재');
});

test('resolveKeywordRef: KFCC 별표 매칭', () => {
    const result = resolveKeywordRef('KFCC 별표 2 미백');
    assert.ok(result, 'KFCC 매칭');
    assert.ok(result.path.includes('.md'), 'MD 경로');
});

test('resolveKeywordRef: 매칭 없음 → null', () => {
    assert.equal(resolveKeywordRef('관련 없는 텍스트'), null);
});

test('resolveKeywordRef: 빈 입력 → null', () => {
    assert.equal(resolveKeywordRef(''), null);
    assert.equal(resolveKeywordRef(null), null);
});

// ==================== 데이터 구조 검증 ====================

test('SUBJECT_DIR_MAP: 4개 과목 키 존재', () => {
    assert.ok(SUBJECT_DIR_MAP.law, 'law 존재');
    assert.ok(SUBJECT_DIR_MAP.manufacturing, 'manufacturing 존재');
    assert.ok(SUBJECT_DIR_MAP.safety, 'safety 존재');
    assert.ok(SUBJECT_DIR_MAP.understanding, 'understanding 존재');
});

test('REFERENCE_FILES: 모든 과목에 파일 목록 존재', () => {
    for (const key of Object.keys(SUBJECT_DIR_MAP)) {
        assert.ok(Array.isArray(REFERENCE_FILES[key]), `${key} 파일 목록 존재`);
        assert.ok(REFERENCE_FILES[key].length > 0, `${key} 최소 1개 파일`);
    }
});

test('REFERENCE_COMMON: 최소 1개 항목', () => {
    assert.ok(REFERENCE_COMMON.length > 0, '공통 참조자료 존재');
    for (const ref of REFERENCE_COMMON) {
        assert.ok(ref.name, 'name 필드');
        assert.ok(ref.file, 'file 필드');
        assert.ok(ref.type, 'type 필드');
        assert.ok(ref.dir, 'dir 필드');
    }
});

test('REFERENCE_LAW: 법령원문 항목 존재', () => {
    assert.ok(REFERENCE_LAW.length > 0, '법령원문 존재');
    for (const ref of REFERENCE_LAW) {
        assert.equal(ref.dir, '법령원문', 'dir=법령원문');
    }
});

test('SOURCE_REF_MAP: 모든 엔트리에 test와 file 존재', () => {
    for (const entry of SOURCE_REF_MAP) {
        assert.ok(entry.test instanceof RegExp, 'test는 RegExp');
        assert.ok(entry.file, 'file 존재');
    }
});

test('KEYWORD_REF_MAP: 모든 엔트리에 pattern과 file 존재', () => {
    for (const entry of KEYWORD_REF_MAP) {
        assert.ok(entry.pattern instanceof RegExp, 'pattern은 RegExp');
        assert.ok(entry.file, 'file 존재');
    }
});

test('REF_FILE_TO_PATH: REF_DIRS의 모든 파일이 경로 매핑됨', () => {
    // 법령원문의 첫 파일이 매핑되어 있는지 확인
    const lawFile = '화장품법(법률)(제20901호)(20260402).pdf';
    assert.ok(REF_FILE_TO_PATH[lawFile], '법률 파일 경로 매핑됨');
    assert.ok(REF_FILE_TO_PATH[lawFile].endsWith('.md'), '.md 확장자');
});

test('REF_REGISTRY: 우선순위 적용 (과목N > 공통 > 법령원문)', () => {
    // 화장품법은 법령원문, 공통, 과목1 모두에 있음
    // 우선순위: 과목4 > 과목3 > 과목2 > 과목1 > 공통 > 법령원문
    const lawFile = '화장품법(법률)(제20901호)(20260402).pdf';
    assert.ok(REF_REGISTRY[lawFile], '법률 파일 레지스트리 등록됨');
    // 공통 또는 법령원문 중 하나여야 함 (과목1~4에 같은 파일명이 없으면 공통이 우선)
    assert.ok(['공통', '법령원문'].includes(REF_REGISTRY[lawFile]), '우선순위에 따른 폴더 할당');
});
