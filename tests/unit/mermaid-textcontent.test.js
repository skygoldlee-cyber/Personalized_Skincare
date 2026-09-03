import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSectionContentForReader } from '../../src/reader-format.js';
import { parseMarkdown } from '../../src/markdown-parser.js';

// 헬퍼: <pre class="mermaid">...</pre> 전체 태그 추출
function extractMermaidFull(html) {
    const m = html.match(/<pre class="mermaid">[\s\S]*?<\/pre>/);
    return m ? m[0] : null;
}

// 헬퍼: <pre class="mermaid">...</pre> 내부 콘텐츠 추출
function extractMermaidContent(html) {
    const m = html.match(/<pre class="mermaid">([\s\S]*?)<\/pre>/);
    return m ? m[1] : null;
}

// 브라우저에서 DOM이 textContent로 읽는 값을 시뮬레이션
// 중요: &lt; &gt; &quot; &#39; 는 HTML 엔티티로, 브라우저가 text 노드의 문자로 디코딩함
// 즉 &lt;br/&gt; 는 textContent에서 <br/> (텍스트)가 되지, HTML 태그가 아님
function simulateTextContent(innerHtml) {
    // 1. 실제 HTML 태그를 임시 플레이스홀더로 보호 (엔티티가 아닌 리터럴 < 로 시작하는 것만)
    // 2. HTML 엔티티 디코딩
    // 3. 플레이스홀더에 있던 실제 태그 제거
    const phs = [];
    let text = innerHtml.replace(/<(?!lt;|gt;|quot;|#39;|#\d+;)[a-zA-Z/][^>]*>/g, (m) => {
        const i = phs.length;
        phs.push(m);
        return `\uE004T${i}\uE005`;
    });
    // 엔티티 디코딩 (브라우저 textContent 동작)
    text = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
    // 실제 HTML 태그 제거
    text = text.replace(/\uE004T\d+\uE005/g, '');
    return text;
}

const READER_OPTS = {
    allowMermaid: true,
    useReaderStyles: true,
    allowItalics: false,
    allowInlineCode: false,
    useCustomListDiv: true,
    customSpacing: true
};

test('실제 교재 mindmap — textContent 시뮬레이션이 유효한 mermaid 문법', () => {
    const md = [
        '```mermaid',
        'mindmap',
        ' root((화장품법<br/>법령체계))',
        ' 법률',
        ' 화장품법',
        ' 국민보건 향상',
        ' 화장품 산업 발전',
        ' 대통령령',
        ' 시행령',
        ' 위임사항 규정',
        ' 총리령',
        ' 시행규칙',
        ' 세부 시행절차',
        ' 고시·행정규칙',
        ' 기능성화장품 기준',
        ' CGMP 기준',
        ' 안전기준 등',
        '```'
    ].join('\n');

    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    
    const textContent = simulateTextContent(content);
    console.log('=== mindmap textContent ===');
    console.log(JSON.stringify(textContent));
    console.log('=== end ===');
    
    // 앞뒤 공백 제거 후 첫 줄이 'mindmap'이어야 함
    const trimmed = textContent.trim();
    assert.ok(trimmed.startsWith('mindmap'), '첫 줄이 mindmap이어야 함');
    assert.ok(trimmed.includes('root((화장품법<br/>법령체계))'), 'root 노드 포함해야 함');
});

test('실제 교재 flowchart — textContent 시뮬레이션이 유효한 mermaid 문법', () => {
    const md = [
        '```mermaid',
        'flowchart TD',
        ' A["화장품 영업 종류"] --> B["화장품 제조업<br/>등록"]',
        ' A --> C["화장품 책임판매업<br/>등록"]',
        ' A --> D["맞춤형화장품 판매업<br/>신고"]',
        ' B --> B1["직접 제조"]',
        ' B --> B2["위탁 제조"]',
        ' B --> B3["1차 포장"]',
        ' C --> C1["직접 제조 후 유통·판매"]',
        ' C --> C2["위탁 제조품 유통·판매"]',
        ' C --> C3["수입품 유통·판매"]',
        ' C --> C4["수입대행 알선·수여"]',
        ' D --> D1["내용물 + 원료 혼합"]',
        ' D --> D2["내용물 소분"]',
        ' D -.->|"고형비누 단순소분 제외"| D3["제외"]',
        '```'
    ].join('\n');

    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    
    const textContent = simulateTextContent(content);
    console.log('=== flowchart textContent ===');
    console.log(JSON.stringify(textContent));
    console.log('=== end ===');
    
    const trimmed = textContent.trim();
    assert.ok(trimmed.startsWith('flowchart TD'), '첫 줄이 flowchart TD여야 함');
    assert.ok(trimmed.includes('A["화장품 영업 종류"]'), '노드 A 포함해야 함');
    assert.ok(trimmed.includes('D -.->|"고형비누 단순소분 제외"| D3["제외"]'), '점선 화살표 포함해야 함');
});

test('pre.mermaid 태그에 불필요한 속성이 없어야 함', () => {
    const md = '```mermaid\nflowchart TD\n A --> B\n```';
    const html = parseMarkdown(md, READER_OPTS);
    const full = extractMermaidFull(html);
    assert.ok(full, 'mermaid 태그가 있어야 함');
    console.log('=== full pre tag ===');
    console.log(full);
    console.log('=== end ===');
    // pre.mermaid 태그에 data-* 속성이 없어야 함 (mermaid가 이미 처리했다고 착각하지 않도록)
    assert.ok(!full.includes('data-'), 'data-* 속성이 없어야 함');
    assert.ok(!full.includes('data-processed'), 'data-processed 속성이 없어야 함');
});

test('pre.mermaid 내부에 \\r\\n이 없어야 함 (LF만)', () => {
    const md = '```mermaid\nflowchart TD\n A --> B\n```';
    const html = parseMarkdown(md, READER_OPTS);
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    assert.ok(!content.includes('\r'), 'CR 문자가 없어야 함');
});

test('formatSectionContentForReader 전체 파이프라인 — textContent 시뮬레이션', () => {
    const rawContent = [
        '## 1절 화장품법의 목적',
        '',
        '```mermaid',
        'mindmap',
        ' root((화장품법<br/>법령체계))',
        ' 법률',
        ' 화장품법',
        '```',
        '',
        '본문 p.22를 참고.',
        '',
        '화장품법은 중요합니다.',
    ].join('\n');

    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해_표준형.md');
    const content = extractMermaidContent(html);
    assert.ok(content, 'mermaid 블록이 있어야 함');
    
    const textContent = simulateTextContent(content);
    console.log('=== pipeline textContent ===');
    console.log(JSON.stringify(textContent));
    console.log('=== end ===');
    
    const trimmed = textContent.trim();
    assert.ok(trimmed.startsWith('mindmap'), '첫 줄이 mindmap이어야 함');
    assert.ok(trimmed.includes('root((화장품법<br/>법령체계))'), 'root 노드 포함해야 함');
    assert.ok(!textContent.includes('본문 p.22'), '페이지 참조가 mermaid 내부에 없어야 함');
});
