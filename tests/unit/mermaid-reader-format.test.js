import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSectionContentForReader } from '../../src/reader-format.js';

// 헬퍼: <pre class="mermaid">...</pre> 내부 콘텐츠 추출
function extractMermaidContent(html) {
    const m = html.match(/<pre class="mermaid">([\s\S]*?)<\/pre>/);
    return m ? m[1] : null;
}

// 헬퍼: HTML 엔티티를 디코딩하여 브라우저 textContent 시뮬레이션
function decodeEntities(text) {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

test('formatSectionContentForReader: mermaid 블록이 post-processing 후에도 보존됨', () => {
    const rawContent = [
        '## 1절 화장품법의 목적',
        '',
        '```mermaid',
        'mindmap',
        ' root((화장품법<br/>법령체계))',
        ' 법률',
        ' 화장품법',
        ' 대통령령',
        ' 시행령',
        '```'
    ].join('\n');

    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해.md');
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('root((화장품법<br/>법령체계))'), 'root 노드 텍스트가 보존되어야 함');
    assert.ok(decoded.includes('화장품법'), '자식 노드 텍스트가 보존되어야 함');
});

test('formatSectionContentForReader: mermaid flowchart가 post-processing 후에도 보존됨', () => {
    const rawContent = [
        '## 화장품 영업 종류',
        '',
        '```mermaid',
        'flowchart TD',
        ' A["화장품 영업 종류"] --> B["화장품 제조업<br/>등록"]',
        ' A --> C["화장품 책임판매업<br/>등록"]',
        ' D -.->|"고형비누 단순소분 제외"| D3["제외"]',
        '```'
    ].join('\n');

    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해.md');
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('A["화장품 영업 종류"]'), '노드 A 텍스트 보존');
    assert.ok(decoded.includes('B["화장품 제조업<br/>등록"]'), '노드 B 텍스트와 <br/> 보존');
    assert.ok(decoded.includes('-.->|"고형비누 단순소분 제외"|'), '점선 화살표와 라벨 보존');
    assert.ok(!content.includes('<a href='), '<a> 태그 없음');
    assert.ok(!content.includes('<strong>'), '<strong> 태그 없음');
    assert.ok(!content.includes('<em>'), '<em> 태그 없음');
});

test('formatSectionContentForReader: 페이지 참조 제거가 mermaid 블록에 영향 주지 않음', () => {
    const rawContent = [
        '본문 p.22를 참고하세요.',
        '',
        '```mermaid',
        'flowchart TD',
        ' A["제조업 등록 p.22"] --> B["책임판매업 p.27"]',
        '```',
        '',
        '본문 p.26~p.27도 참고.',
    ].join('\n');

    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해.md');
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    const decoded = decodeEntities(content);
    // mermaid 블록 내부의 p.22, p.27는 보존되어야 함 (페이지 참조 제거 regex가 mermaid 내부까지 매칭하면 안 됨)
    assert.ok(decoded.includes('p.22'), 'mermaid 내부 p.22 보존되어야 함');
    assert.ok(decoded.includes('p.27'), 'mermaid 내부 p.27 보존되어야 함');
});

test('formatSectionContentForReader: glossary 키워드 링크가 mermaid 블록에 영향 주지 않음', () => {
    const rawContent = [
        '```mermaid',
        'flowchart TD',
        ' A["화장품법"] --> B["시행령"]',
        '```',
        '',
        '화장품법은 중요합니다.',
    ].join('\n');

    const glossaryKeywords = [
        { keyword: '화장품법', idxKey: 'test|L1' },
        { keyword: '시행령', idxKey: 'test|L2' },
    ];

    const html = formatSectionContentForReader(
        rawContent,
        'content/교재/law/1과목_화장품법의이해.md',
        null, null, null,
        glossaryKeywords
    );
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(!content.includes('<a'), 'mermaid 내부에 <a> 태그 없어야 함');
    assert.ok(!content.includes('glossary'), 'mermaid 내부에 glossary 링크 없어야 함');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('화장품법'), 'mermaid 내부 키워드 텍스트 보존');
    assert.ok(decoded.includes('시행령'), 'mermaid 내부 키워드 텍스트 보존');
});
