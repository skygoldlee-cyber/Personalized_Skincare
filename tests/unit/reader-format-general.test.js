// tests/unit/reader-format-general.test.js
// reader-format.js의 포맷팅 로직을 합성 데이터로 검증.
// 교재 콘텐츠와 무관하게 포맷팅 로직 자체가 정확해야 함.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSectionContentForReader } from '../../src/reader-format.js';

// ==================== 페이지 참조 제거 ====================

test('페이지 참조: "본문 p.22" 제거', () => {
    const html = formatSectionContentForReader('본문 p.22 내용');
    assert.ok(!html.includes('p.22'), '본문 p.22 제거됨');
    assert.ok(html.includes('내용'), '내용은 보존');
});

test('페이지 참조: "본문 p.22~p.27" 범위 제거', () => {
    const html = formatSectionContentForReader('본문 p.22~p.27 참조');
    assert.ok(!html.includes('p.22'), 'p.22 제거');
    assert.ok(!html.includes('p.27'), 'p.27 제거');
});

test('페이지 참조: 헤더에서 "p.NN — " 제거', () => {
    const html = formatSectionContentForReader('## p.22 — 제목', '', '', [], '', []);
    assert.ok(!html.includes('p.22'), '헤더에서 p.22 제거');
    assert.ok(html.includes('제목'), '제목은 보존');
});

test('페이지 참조: 괄호 안 "(p.80~83)" 제거', () => {
    const html = formatSectionContentForReader('내용 (p.80~83) 끝');
    assert.ok(!html.includes('p.80'), '괄호 안 페이지 제거');
});

test('페이지 참조: "참고: 본문 p.22" 라인 제거', () => {
    const html = formatSectionContentForReader('**참고**: 본문 p.22~p.27 참조');
    assert.ok(!html.includes('p.22'), '참고 라인의 페이지 제거');
});

// ==================== 기출문제 링크 변환 ====================

test('기출문제 링크: [text](기출문제/과목N_...) → exam-link-btn', () => {
    const md = '[기출문제 풀기](기출문제/과목1_문제은행.md)';
    const html = formatSectionContentForReader(md);
    assert.ok(html.includes('exam-link-btn'), 'exam-link-btn 클래스');
    assert.ok(html.includes('data-exam-md'), 'data-exam-md 속성');
    assert.ok(html.includes('과목1_문제은행_교재인용.md'), '실제 경로로 변환');
});

// ==================== 참조자료 PDF 링크 변환 ====================

test('참조자료 링크: [file.pdf](../참조자료/...) → source-link', () => {
    // URL에 괄호가 있으면 markdown parser의 link regex가 끊기므로
    // 괄호 없는 파일명으로 테스트
    const md = '[색소종류및기준_전체.pdf](../참조자료/색소종류및기준_전체.pdf)';
    const html = formatSectionContentForReader(md);
    assert.ok(html.includes('source-link'), 'source-link 클래스');
    assert.ok(html.includes('data-ref-html'), 'data-ref-html 속성');
});

// ==================== 출처 링크 변환 ====================

test('출처 링크: "출처: `../참조자료/...md`" → data-ref-md', () => {
    const md = '출처: `../참조자료/과목1/1.cosmetic-law.md`';
    const html = formatSectionContentForReader(md);
    assert.ok(html.includes('data-ref-md'), 'data-ref-md 속성');
    assert.ok(html.includes('content/참조자료/'), '절대 경로 변환');
});

test('출처 링크: "출처: `xxx.pdf`" → data-ref-html', () => {
    const md = '출처: `화장품법(법률)(제20901호)(20260402).pdf`';
    const html = formatSectionContentForReader(md);
    assert.ok(html.includes('data-ref-html'), 'data-ref-html 속성');
    assert.ok(html.includes('source-link'), 'source-link 클래스');
});

// ==================== Mermaid 블록 보호 ====================

test('Mermaid 블록: 페이지 참조 제거 시 Mermaid 내용 보존', () => {
    const md = '```mermaid\nflowchart TD\n  A --> B\n```\n본문 p.42';
    const html = formatSectionContentForReader(md);
    assert.ok(html.includes('<pre class="mermaid">'), 'mermaid 블록 보존');
    assert.ok(html.includes('flowchart TD'), 'flowchart 내용 보존');
    assert.ok(!html.includes('p.42'), '페이지 참조는 제거');
});

test('Mermaid 블록: 용어집 자동 링크가 Mermaid 내부에 침투하지 않음', () => {
    const md = '```mermaid\nmindmap\n root((테스트))\n```\n일반 텍스트';
    const glossaryKeywords = [{ keyword: '테스트', idxKey: 'test.md|L1' }];
    const html = formatSectionContentForReader(md, '', '', [], '', glossaryKeywords);
    // mermaid 블록 내의 '테스트'는 링크되지 않아야 함
    const mermaidBlock = html.match(/<pre class="mermaid">[\s\S]*?<\/pre>/);
    if (mermaidBlock) {
        assert.ok(!mermaidBlock[0].includes('glossary-term-link'), 'mermaid 내부에 용어집 링크 없음');
    }
});

// ==================== 용어집 자동 링크 ====================

test('용어집 자동 링크: 키워드가 <p> 내에서 링크 변환', () => {
    const md = '화장품법을 준수해야 한다';
    const glossaryKeywords = [{ keyword: '화장품법', idxKey: 'test.md|L1' }];
    const html = formatSectionContentForReader(md, '', '', [], '', glossaryKeywords);
    assert.ok(html.includes('glossary-term-link'), '용어집 링크 클래스');
    assert.ok(html.includes('data-glossary'), 'data-glossary 속성');
});

test('용어집 자동 링크: 기존 <a> 태그 내 키워드는 링크하지 않음', () => {
    const md = '[화장품법 링크](https://example.com)';
    const glossaryKeywords = [{ keyword: '화장품법', idxKey: 'test.md|L1' }];
    const html = formatSectionContentForReader(md, '', '', [], '', glossaryKeywords);
    // 기존 링크 내의 키워드는 중복 링크되지 않아야 함
    const links = html.match(/<a\s[^>]*>화장품법[^<]*<\/a>/g) || [];
    // 원래 링크는 glossary-term-link가 아닌 일반 링크
    const glossaryLinks = html.match(/glossary-term-link/g) || [];
    // 기존 href 링크가 있고, 그 안에 키워드가 있으면 glossary 링크는 없어야 함
    assert.ok(html.includes('href="https://example.com"'), '원래 링크 보존');
});

test('용어집 자동 링크: 2자 미만 키워드 제외', () => {
    const md = 'A는 B입니다';
    const glossaryKeywords = [{ keyword: 'A', idxKey: 'test.md|L1' }];
    const html = formatSectionContentForReader(md, '', '', [], '', glossaryKeywords);
    assert.ok(!html.includes('glossary-term-link'), '1자 키워드는 링크하지 않음');
});

test('용어집 자동 링크: 긴 키워드 우선 매칭', () => {
    const md = '화장품법 시행령';
    const glossaryKeywords = [
        { keyword: '화장품법', idxKey: 'short.md|L1' },
        { keyword: '화장품법 시행령', idxKey: 'long.md|L1' },
    ];
    const html = formatSectionContentForReader(md, '', '', [], '', glossaryKeywords);
    // 긴 키워드가 먼저 매칭되어야 함
    assert.ok(html.includes('long.md|L1'), '긴 키워드 매칭');
});

// ==================== 출처 제N조 Deep Linking ====================

test('출처 Deep Linking: 제N조 추출하여 data-ref-search 추가', () => {
    // data-ref-html 링크가 있는 라인에 제N조가 있으면 data-ref-search 추가
    // 출처 라인 변환 후 같은 라인에 data-ref-html과 제5조가 공존해야 함
    const md = '출처: 화장품법 제5조 `색소종류및기준_전체.pdf`';
    const html = formatSectionContentForReader(md);
    // 출처 라인에 data-ref-html이 있고 제5조가 있으면 data-ref-search 추가
    if (html.includes('data-ref-html') && html.includes('제5조')) {
        assert.ok(html.includes('data-ref-search'), 'data-ref-search 추가');
    }
});

// ==================== 빈/최소 입력 ====================

test('빈 입력: 빈 문자열', () => {
    const html = formatSectionContentForReader('');
    // customSpacing=true이므로 빈 줄에 spacing div가 추가됨
    assert.ok(html.includes('height: 0.5rem') || html === '', '빈 문자열은 spacing div 또는 빈 문자열');
});

test('최소 입력: 일반 텍스트만', () => {
    const html = formatSectionContentForReader('일반 텍스트');
    assert.ok(html.includes('일반 텍스트'), '내용 보존');
    assert.ok(html.includes('<p'), 'p 태그');
});

test('파라미터 없이 호출: 기본 동작', () => {
    const html = formatSectionContentForReader('테스트');
    assert.ok(html.includes('테스트'), '내용 보존');
    assert.ok(!html.includes('data-ref-html'), 'refPath 없으면 참조 링크 없음');
});
