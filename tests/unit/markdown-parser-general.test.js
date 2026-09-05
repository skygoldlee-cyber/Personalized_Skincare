// tests/unit/markdown-parser-general.test.js
// markdown-parser.js의 일반 MD→HTML 변환 로직을 합성 데이터로 검증.
// 교재 콘텐츠와 무관하게 파싱 로직 자체가 정확해야 함.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../../src/markdown-parser.js';

// ==================== 헤더 ====================

test('헤더: # → <h1>', () => {
    const html = parseMarkdown('# 제목');
    assert.ok(html.includes('<h1>제목</h1>'), 'h1 변환');
});

test('헤더: ## → <h2>', () => {
    const html = parseMarkdown('## 소제목');
    assert.ok(html.includes('<h2>소제목</h2>'), 'h2 변환');
});

test('헤더: ### → <h3>', () => {
    const html = parseMarkdown('### 소소제목');
    assert.ok(html.includes('<h3>소소제목</h3>'), 'h3 변환');
});

test('헤더: useReaderStyles 시 ### → <h3 class="md-h3">', () => {
    const html = parseMarkdown('### 제목', { useReaderStyles: true });
    assert.ok(html.includes('<h3 class="md-h3">'), 'reader 스타일 h3 변환');
});

test('헤더: useReaderStyles 시 #### → <h4 class="md-h4">', () => {
    const html = parseMarkdown('#### 제목', { useReaderStyles: true });
    assert.ok(html.includes('<h4 class="md-h4">'), 'reader 스타일 h4 변환');
});

// ==================== 표 ====================

test('표: 기본 테이블 변환', () => {
    const md = '| 이름 | 값 |\n| --- | --- |\n| A | 1 |\n| B | 2 |';
    const html = parseMarkdown(md);
    assert.ok(html.includes('<table'), 'table 태그');
    assert.ok(html.includes('<th>이름</th>'), '헤더 셀');
    assert.ok(html.includes('<td>A</td>'), '데이터 셀');
    assert.ok(html.includes('<td>1</td>'), '데이터 셀 2');
});

test('표: 구분선 행은 데이터에서 제외', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const html = parseMarkdown(md);
    assert.ok(!html.includes('<td>---</td>'), '구분선 제외');
    assert.ok(!html.includes('<th>---</th>'), '구분선 제외');
});

test('표: 빈 셀 보존', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 |  |';
    const html = parseMarkdown(md);
    assert.ok(html.includes('<td>1</td>'), '첫 셀');
    assert.ok(html.includes('<td class="cell-empty"></td>'), '빈 셀 보존');
});

test('표: reader-table-wrapper 클래스', () => {
    const md = '| A |\n| --- |\n| 1 |';
    const html = parseMarkdown(md);
    assert.ok(html.includes('reader-table-wrapper'), 'wrapper 클래스');
    assert.ok(html.includes('reader-table'), 'table 클래스');
});

// ==================== 리스트 ====================

test('리스트: ul (- 기호)', () => {
    const html = parseMarkdown('- 항목1\n- 항목2');
    assert.ok(html.includes('<ul>'), 'ul 태그');
    assert.ok(html.includes('<li>항목1</li>'), '첫 항목');
    assert.ok(html.includes('<li>항목2</li>'), '둘 항목');
});

test('리스트: ol (번호)', () => {
    const html = parseMarkdown('1. 첫째\n2. 둘째');
    assert.ok(html.includes('<ol>'), 'ol 태그');
    assert.ok(html.includes('<li>첫째</li>'), '첫 항목');
});

test('리스트: useCustomListDiv 시 div 렌더링', () => {
    const html = parseMarkdown('- 항목', { useCustomListDiv: true });
    assert.ok(html.includes('md-list-item'), 'md-list-item 클래스');
    assert.ok(html.includes('md-bullet'), 'md-bullet 클래스');
    assert.ok(!html.includes('<ul>'), 'ul 태그 없음');
});

// ==================== 인라인 서식 ====================

test('인라인: **볼드** → <strong>', () => {
    const html = parseMarkdown('이것은 **볼드** 입니다');
    assert.ok(html.includes('<strong>볼드</strong>'), 'strong 변환');
});

test('인라인: *이탤릭* → <em>', () => {
    const html = parseMarkdown('이것은 *이탤릭* 입니다');
    assert.ok(html.includes('<em>이탤릭</em>'), 'em 변환');
});

test('인라인: allowItalics=false 시 * 보존', () => {
    const html = parseMarkdown('이것은 *별표* 입니다', { allowItalics: false });
    assert.ok(!html.includes('<em>'), 'em 태그 없음');
    assert.ok(html.includes('*별표*'), '별표 보존');
});

test('인라인: `코드` → <code>', () => {
    const html = parseMarkdown('`인라인코드` 테스트');
    assert.ok(html.includes('<code>인라인코드</code>'), 'code 변환');
});

test('인라인: allowInlineCode=false 시 백틱 보존', () => {
    const html = parseMarkdown('`코드` 테스트', { allowInlineCode: false });
    assert.ok(!html.includes('<code>'), 'code 태그 없음');
});

test('인라인: 링크 [text](url) → <a>', () => {
    const html = parseMarkdown('[링크텍스트](https://example.com)');
    assert.ok(html.includes('<a href="https://example.com">링크텍스트</a>'), 'a 태그 변환');
});

// ==================== 코드블록 ====================

test('코드블록: 기본 <pre> 변환', () => {
    const md = '```\nconsole.log(1);\n```';
    const html = parseMarkdown(md);
    assert.ok(html.includes('<pre'), 'pre 태그');
    assert.ok(html.includes('console.log(1);'), '코드 내용 보존');
});

test('코드블록: 언어 지정 시 reader-code-block', () => {
    const md = '```js\nconst x = 1;\n```';
    const html = parseMarkdown(md);
    assert.ok(html.includes('<pre'), 'pre 태그');
    assert.ok(html.includes('const x = 1;'), '코드 내용 보존');
});

test('코드블록: 내부 볼드/이탤릭 미적용', () => {
    const md = '```\n**볼드가아님**\n```';
    const html = parseMarkdown(md);
    assert.ok(!html.includes('<strong>'), '코드블록 내 볼드 미적용');
    assert.ok(html.includes('**볼드가아님**'), '원문 보존');
});

test('코드블록: 내부 링크 미적용', () => {
    const md = '```\n[link](url)\n```';
    const html = parseMarkdown(md);
    assert.ok(!html.includes('<a href='), '코드블록 내 링크 미적용');
});

// ==================== 인용문 ====================

test('인용문: > 기호 → <blockquote>', () => {
    const html = parseMarkdown('> 인용문 입니다');
    assert.ok(html.includes('<blockquote>'), 'blockquote 태그');
    assert.ok(html.includes('인용문 입니다'), '내용 보존');
});

test('인용문: useReaderStyles 시 md-quote', () => {
    const html = parseMarkdown('> 인용', { useReaderStyles: true });
    assert.ok(html.includes('md-quote'), 'md-quote 클래스');
});

// ==================== 특수 토큰 ====================

test('특수: <br/> 보존', () => {
    const html = parseMarkdown('첫줄<br/>둘째줄');
    assert.ok(html.includes('<br>'), 'br 태그 보존');
});

test('특수: <sup> 태그 보존', () => {
    const html = parseMarkdown('H<sub>2</sub>O 및 x<sup>2</sup>');
    assert.ok(html.includes('<sup>'), 'sup 태그 보존');
    assert.ok(html.includes('</sup>'), 'sup 닫기 태그');
});

test('특수: &nbsp; 보존', () => {
    const html = parseMarkdown('A&nbsp;B');
    assert.ok(html.includes('&nbsp;'), 'nbsp 보존');
});

test('특수: HTML 이스케이프', () => {
    const html = parseMarkdown('<script>alert(1)</script>');
    assert.ok(!html.includes('<script>'), 'script 태그 이스케이프');
    assert.ok(html.includes('&lt;script&gt;'), '이스케이프됨');
});

// ==================== 빈 입력 ====================

test('빈 입력: 빈 문자열', () => {
    const html = parseMarkdown('');
    assert.equal(html, '', '빈 문자열 → 빈 문자열');
});

test('빈 입력: 공백만', () => {
    const html = parseMarkdown('   \n  \n');
    // 공백만 있으면 빈 줄로 처리되어 output에 추가되지 않음
    assert.equal(html, '', '공백만 → 빈 문자열');
});

// ==================== 구분선 ====================

test('구분선: --- → <hr>', () => {
    const html = parseMarkdown('---');
    assert.ok(html.includes('<hr>'), 'hr 태그');
});

test('구분선: useReaderStyles 시 reader-hr', () => {
    const html = parseMarkdown('---', { useReaderStyles: true });
    assert.ok(html.includes('reader-hr'), 'reader-hr 클래스');
});

// ==================== 일반 문단 ====================

test('일반 문단: <p> 태그', () => {
    const html = parseMarkdown('일반 텍스트');
    assert.ok(html.includes('<p>'), 'p 태그');
    assert.ok(html.includes('일반 텍스트'), '내용 보존');
});

test('일반 문단: useReaderStyles 시 md-para', () => {
    const html = parseMarkdown('텍스트', { useReaderStyles: true });
    assert.ok(html.includes('md-para'), 'md-para 클래스');
});

test('일반 문단: customSpacing 시 빈 줄에 div', () => {
    const html = parseMarkdown('A\n\nB', { customSpacing: true });
    assert.ok(html.includes('height: 0.5rem'), '빈 줄에 spacing div');
});
