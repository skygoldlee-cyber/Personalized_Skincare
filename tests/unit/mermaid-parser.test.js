import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../../src/markdown-parser.js';

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

// 교재 리더 옵션 (실제 사용 환경과 동일)
const READER_OPTS = {
    allowMermaid: true,
    useReaderStyles: true,
    allowItalics: false,
    allowInlineCode: false,
    useCustomListDiv: true,
    customSpacing: true
};

test('parseMarkdown: mermaid 코드블록이 <pre class="mermaid">로 출력됨', () => {
    const md = '```mermaid\nmindmap\n root((테스트))\n```';
    const html = parseMarkdown(md, { allowMermaid: true });
    assert.ok(html.includes('<pre class="mermaid">'), 'pre.mermaid 클래스 포함해야 함');
});

test('parseMarkdown: mermaid 화살표(--)가 HTML 엔티티로 보존됨', () => {
    const md = '```mermaid\nflowchart TD\n A --> B\n```';
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(content.includes('--&gt;'), 'HTML 소스에 --&gt; 포함해야 함');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('-->'), '디코딩 후 --> 포함해야 함');
});

test('parseMarkdown: mermaid 따옴표(")가 HTML 엔티티로 보존됨', () => {
    const md = '```mermaid\nflowchart TD\n A["텍스트"] --> B["더 텍스트"]\n```';
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(content.includes('&quot;'), 'HTML 소스에 &quot; 포함해야 함');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('"텍스트"'), '따옴표가 보존되어야 함');
});

test('parseMarkdown: mermaid 꺾쇠괄호(<>)가 HTML 엔티티로 보존됨', () => {
    const md = '```mermaid\nflowchart LR\n A -->|"라벨"| B\n```';
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('-->|"라벨"|'), '꺾쇠괄호와 라벨이 보존되어야 함');
});

test('parseMarkdown: mermaid <br/> 태그가 텍스트로 보존됨 (HTML 엔티티)', () => {
    const md = '```mermaid\nflowchart TD\n A["화장품<br/>제조업"]\n```';
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(content.includes('&lt;br/&gt;'), '<br/> 가 &lt;br/&gt; 로 보존되어야 함');
    assert.ok(!content.includes('<br>'), '실제 <br> HTML 태그가 있으면 안 됨');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('<br/>'), '디코딩 후 <br/> 텍스트가 있어야 함');
});

test('parseMarkdown: mermaid 대괄호[]와 소괄호()가 링크로 변환되지 않음', () => {
    const md = '```mermaid\nflowchart TD\n A["텍스트"] --> B(라벨)\n```';
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(!content.includes('<a href='), 'mermaid 내부에 <a> 태그가 있으면 안 됨');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('["텍스트"]'), '대괄호가 보존되어야 함');
    assert.ok(decoded.includes('(라벨)'), '소괄호가 보존되어야 함');
});

test('parseMarkdown: mermaid 별표(*)가 강조로 변환되지 않음', () => {
    const md = '```mermaid\nflowchart TD\n A -->|경미*| B\n```';
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(!content.includes('<em>'), 'mermaid 내부에 <em> 태그가 있으면 안 됨');
    assert.ok(!content.includes('<strong>'), 'mermaid 내부에 <strong> 태그가 있으면 안 됨');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('*'), '별표가 보존되어야 함');
});

test('parseMarkdown: 실제 교재 mindmap 패턴 렌더링 검증', () => {
    const md = [
        '```mermaid',
        'mindmap',
        ' root((화장품법<br/>법령체계))',
        ' 법률',
        ' 화장품법',
        ' 대통령령',
        ' 시행령',
        '```'
    ].join('\n');
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('root((화장품법<br/>법령체계))'), 'root 노드 텍스트가 보존되어야 함');
    assert.ok(decoded.includes('화장품법'), '자식 노드 텍스트가 보존되어야 함');
});

test('parseMarkdown: 실제 교재 flowchart 패턴 렌더링 검증', () => {
    const md = [
        '```mermaid',
        'flowchart TD',
        ' A["화장품 영업 종류"] --> B["화장품 제조업<br/>등록"]',
        ' A --> C["화장품 책임판매업<br/>등록"]',
        ' D -.->|"고형비누 단순소분 제외"| D3["제외"]',
        '```'
    ].join('\n');
    const html = parseMarkdown(md, READER_OPTS);
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

test('parseMarkdown: 일반 텍스트의 링크는 여전히 변환됨 (mermaid 외부)', () => {
    const md = [
        '일반 텍스트 [링크](기출문제/과목1_test) 입니다.',
        '',
        '```mermaid',
        'flowchart TD',
        ' A --> B',
        '```'
    ].join('\n');
    const html = parseMarkdown(md, { allowMermaid: true });
    assert.ok(html.includes('<a href="기출문제/과목1_test">링크</a>'), '일반 링크는 변환되어야 함');
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(!content.includes('<a href='), 'mermaid 내부에는 <a> 태그가 없어야 함');
});

test('parseMarkdown: mermaid subgraph 키워드 보존', () => {
    const md = [
        '```mermaid',
        'flowchart LR',
        '    subgraph 등록제["등록제 (허가성)"]',
        '        A["화장품제조업<br/>식약처장에게 등록"]',
        '    end',
        '```'
    ].join('\n');
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    const decoded = decodeEntities(content);
    assert.ok(decoded.includes('subgraph'), 'subgraph 키워드 보존');
    assert.ok(decoded.includes('end'), 'end 키워드 보존');
    assert.ok(decoded.includes('["등록제 (허가성)"]'), 'subgraph 라벨 보존');
});
