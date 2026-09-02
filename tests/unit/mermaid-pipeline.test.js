import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSectionContentForReader } from '../../src/reader-format.js';

// 헬퍼: <pre class="mermaid">...</pre> 내부 콘텐츠 추출
function extractMermaidContent(html) {
    const m = html.match(/<pre class="mermaid">([\s\S]*?)<\/pre>/);
    return m ? m[1] : null;
}

test('mermaid 출력에 HTML 태그가 없어야 함 (textContent만 있어야 함)', () => {
    const rawContent = [
        '## 테스트',
        '',
        '```mermaid',
        'flowchart TD',
        ' A["화장품<br/>제조업"] --> B["책임판매업"]',
        ' C -.->|"제외"| D',
        '```'
    ].join('\n');

    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해.md');
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    
    // mermaid pre 블록 내부에 실제 HTML 태그가 있으면 안 됨
    // (HTML 엔티티 like &lt; &gt; &quot;는 괜찮음 — 브라우저가 textContent에서 디코딩)
    const htmlTagPattern = /<(?!\/pre>)[a-zA-Z][^>]*>/g;
    const tags = content.match(htmlTagPattern);
    assert.equal(tags, null, `mermaid 내부에 HTML 태그가 있으면 안 됨: ${tags}`);
});

test('mermaid 출력에 <br> 실제 태그가 없어야 함', () => {
    const rawContent = [
        '```mermaid',
        'mindmap',
        ' root((화장품법<br/>법령체계))',
        '```'
    ].join('\n');

    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해.md');
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(!content.includes('<br>'), '실제 <br> 태그가 있으면 안 됨 (엔티티여야 함)');
    assert.ok(!content.includes('<br/>'), '실제 <br/> 태그가 있으면 안 됨 (엔티티여야 함)');
    assert.ok(content.includes('&lt;br/&gt;'), '&lt;br/&gt; 엔티티여야 함');
});

test('mermaid 출력에 <strong>, <em>, <a> 태그가 없어야 함', () => {
    const rawContent = [
        '```mermaid',
        'flowchart TD',
        ' A["**굵게** 텍스트"] --> B["*기울임* 텍스트"]',
        ' C["[링크](url) 텍스트"]',
        '```'
    ].join('\n');

    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해.md');
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(!content.includes('<strong>'), '<strong> 태그 없어야 함');
    assert.ok(!content.includes('<em>'), '<em> 태그 없어야 함');
    assert.ok(!content.includes('<a '), '<a> 태그 없어야 함');
});

test('실제 교재 전체 섹션 파이프라인 — mermaid + 텍스트 + 테이블 혼합', () => {
    const rawContent = [
        '# 1과목 화장품법의 이해',
        '',
        '## 1절 화장품법의 목적',
        '',
        '본문 p.22를 참고하세요.',
        '',
        '```mermaid',
        'mindmap',
        ' root((화장품법<br/>법령체계))',
        ' 법률',
        ' 화장품법',
        ' 시행령',
        '```',
        '',
        '화장품법은 중요합니다.',
        '',
        '📌**출처**: 화장품법(법률)(제20901호)(20260402).pdf',
        '',
        '| 용어 | 설명 |',
        '| --- | --- |',
        '| 시행령 | 대통령령 |',
        '| 시행규칙 | 총리령 |',
    ].join('\n');

    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해.md');
    
    // mermaid 블록 확인
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    
    // HTML 태그 없음
    const htmlTagPattern = /<(?!\/pre>)[a-zA-Z][^>]*>/g;
    const tags = content.match(htmlTagPattern);
    assert.equal(tags, null, `mermaid 내부에 HTML 태그 없어야 함: ${tags}`);
    
    // 텍스트 디코딩 시 올바른 mermaid 문법
    const decoded = content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
    assert.ok(decoded.includes('root((화장품법<br/>법령체계))'), 'root 노드 보존');
    assert.ok(decoded.includes('화장품법'), '자식 노드 보존');
    
    // 페이지 참조는 제거됨
    assert.ok(!html.includes('본문 p.22'), '본문 p.22 제거되어야 함');
    
    // 테이블은 보존됨
    assert.ok(html.includes('reader-table'), '테이블 보존되어야 함');
});
