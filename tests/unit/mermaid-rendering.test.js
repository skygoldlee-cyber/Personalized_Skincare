import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseMarkdown } from '../../src/markdown-parser.js';
import { formatSectionContentForReader } from '../../src/reader-format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../../content/교재');

const READER_OPTS = {
    allowMermaid: true,
    useReaderStyles: true,
    allowItalics: false,
    allowInlineCode: false,
    useCustomListDiv: true,
    customSpacing: true
};

// 헬퍼: 모든 <pre class="mermaid">...</pre> 블록 추출
function extractAllMermaidBlocks(html) {
    const blocks = [];
    const re = /<pre class="mermaid">([\s\S]*?)<\/pre>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        blocks.push(m[1]);
    }
    return blocks;
}

// 헬퍼: HTML 엔티티 디코딩 (브라우저 textContent 시뮬레이션)
function decodeEntities(text) {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

// 헬퍼: mermaid 블록에서 다이어그램 타입 감지 (textbook-reader.js 로직과 동일)
function detectDiagramType(textContent) {
    const trimmed = textContent.trim();
    if (trimmed.startsWith('mindmap')) return 'mindmap';
    return 'flowchart';
}

// 헬퍼: mindmap 들여쓰기 계층 구조 검증
// root는 1 space, 각 레벨은 최소 1 space 증가해야 함
function validateMindmapIndentation(textContent) {
    const lines = textContent.trim().split('\n');
    const issues = [];

    // 첫 줄은 'mindmap'이어야 함
    if (lines[0].trim() !== 'mindmap') {
        issues.push('첫 줄이 mindmap이어야 함');
        return issues;
    }

    // root 노드 찾기
    let rootIndent = -1;
    let prevIndent = -1;
    const nodeLines = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') continue;
        const indent = line.length - line.trimStart().length;
        const text = line.trim();

        if (text.startsWith('root((')) {
            rootIndent = indent;
        }
        nodeLines.push({ lineNum: i + 1, indent, text });
        prevIndent = indent;
    }

    if (rootIndent < 0) {
        issues.push('root 노드가 없음');
        return issues;
    }

    // 모든 노드가 root와 동일한 들여쓰기면 문제
    const allSameIndent = nodeLines.every(n => n.indent === rootIndent);
    if (allSameIndent && nodeLines.length > 1) {
        issues.push('모든 노드가 동일한 들여쓰기 — 계층 구조 없음 (There can be only one root 에러)');
    }

    // root보다 들여쓰기가 작거나 같은 노드가 있으면 안 됨 (root 자체 제외)
    for (const n of nodeLines) {
        if (!n.text.startsWith('root((') && n.indent <= rootIndent) {
            issues.push(`라인 ${n.lineNum}: "${n.text}" — root보다 들여쓰기가 작거나 같음 (indent=${n.indent}, root=${rootIndent})`);
        }
    }

    return issues;
}

// 헬퍼: 실제 마크다운 파일에서 모든 mermaid 블록 추출
function extractMermaidFromMarkdown(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const blocks = [];
    let inBlock = false;
    let currentBlock = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('```mermaid')) {
            inBlock = true;
            currentBlock = [];
            continue;
        }
        if (inBlock && trimmed.startsWith('```')) {
            inBlock = false;
            blocks.push(currentBlock.join('\n'));
            continue;
        }
        if (inBlock) {
            currentBlock.push(line);
        }
    }
    return blocks;
}

// === 테스트: 다이어그램 타입 감지 ===

test('다이어그램 타입 감지: mindmap', () => {
    const textContent = 'mindmap\n root((테스트))\n  자식1\n  자식2';
    assert.equal(detectDiagramType(textContent), 'mindmap');
});

test('다이어그램 타입 감지: flowchart TD', () => {
    const textContent = 'flowchart TD\n A --> B';
    assert.equal(detectDiagramType(textContent), 'flowchart');
});

test('다이어그램 타입 감지: flowchart LR', () => {
    const textContent = 'flowchart LR\n A --> B';
    assert.equal(detectDiagramType(textContent), 'flowchart');
});

test('다이어그램 타입 감지: 앞뒤 공백이 있어도 올바르게 감지', () => {
    const textContent = '\n  mindmap\n root((테스트))\n';
    assert.equal(detectDiagramType(textContent.trim()), 'mindmap');
});

// === 테스트: 마인드맵 들여쓰기 계층 구조 ===

test('마인드맵 들여쓰기: 올바른 계층 구조는 검증 통과', () => {
    const textContent = [
        'mindmap',
        ' root((화장품법<br/>법령체계))',
        '  법률',
        '   화장품법',
        '   국민보건 향상',
        '  대통령령',
        '   시행령',
    ].join('\n');
    const issues = validateMindmapIndentation(textContent);
    assert.equal(issues.length, 0, `들여쓰기 문제가 없어야 함: ${issues.join('; ')}`);
});

test('마인드맵 들여쓰기: 모든 노드가 동일한 들여쓰기면 문제 감지', () => {
    const textContent = [
        'mindmap',
        ' root((테스트))',
        ' 자식1',
        ' 자식2',
        ' 자식3',
    ].join('\n');
    const issues = validateMindmapIndentation(textContent);
    assert.ok(issues.length > 0, '들여쓰기 문제가 감지되어야 함');
    assert.ok(issues.some(i => i.includes('동일한 들여쓰기')), '동일한 들여쓰기 문제가 보고되어야 함');
});

test('마인드맵 들여쓰기: root보다 들여쓰기가 작은 노드 감지', () => {
    const textContent = [
        'mindmap',
        '  root((테스트))',
        ' 자식1',
    ].join('\n');
    const issues = validateMindmapIndentation(textContent);
    assert.ok(issues.length > 0, '들여쓰기 문제가 감지되어야 함');
});

test('마인드맵 들여쓰기: root 노드가 없으면 문제 감지', () => {
    const textContent = [
        'mindmap',
        '  노드1',
        '  노드2',
    ].join('\n');
    const issues = validateMindmapIndentation(textContent);
    assert.ok(issues.length > 0, 'root 노드 없음이 감지되어야 함');
    assert.ok(issues.some(i => i.includes('root 노드가 없음')), 'root 노드 없음 보고되어야 함');
});

// === 테스트: 파서 출력에서 다이어그램 타입 감지 ===

test('파서 출력: mindmap 블록의 textContent가 mindmap으로 시작', () => {
    const md = [
        '```mermaid',
        'mindmap',
        ' root((테스트))',
        '  자식',
        '```',
    ].join('\n');
    const html = parseMarkdown(md, READER_OPTS);
    const blocks = extractAllMermaidBlocks(html);
    assert.equal(blocks.length, 1);
    const decoded = decodeEntities(blocks[0]);
    assert.equal(detectDiagramType(decoded), 'mindmap');
});

test('파서 출력: flowchart 블록의 textContent가 flowchart로 시작', () => {
    const md = [
        '```mermaid',
        'flowchart TD',
        ' A --> B',
        '```',
    ].join('\n');
    const html = parseMarkdown(md, READER_OPTS);
    const blocks = extractAllMermaidBlocks(html);
    assert.equal(blocks.length, 1);
    const decoded = decodeEntities(blocks[0]);
    assert.equal(detectDiagramType(decoded), 'flowchart');
});

test('파서 출력: 여러 mermaid 블록이 섞여 있어도 각각 타입 감지', () => {
    const md = [
        '```mermaid',
        'mindmap',
        ' root((테스트))',
        '  자식',
        '```',
        '',
        '일반 텍스트',
        '',
        '```mermaid',
        'flowchart TD',
        ' A --> B',
        '```',
    ].join('\n');
    const html = parseMarkdown(md, READER_OPTS);
    const blocks = extractAllMermaidBlocks(html);
    assert.equal(blocks.length, 2, '2개 mermaid 블록');
    assert.equal(detectDiagramType(decodeEntities(blocks[0])), 'mindmap');
    assert.equal(detectDiagramType(decodeEntities(blocks[1])), 'flowchart');
});

// === 테스트: 전체 파이프라인 (formatSectionContentForReader) ===

test('파이프라인: mindmap 들여쓰기가 post-processing 후에도 유지됨', () => {
    const rawContent = [
        '## 테스트',
        '',
        '```mermaid',
        'mindmap',
        ' root((화장품법<br/>법령체계))',
        '  법률',
        '   화장품법',
        '  대통령령',
        '   시행령',
        '```',
    ].join('\n');
    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해_표준형.md');
    const blocks = extractAllMermaidBlocks(html);
    assert.equal(blocks.length, 1);
    const decoded = decodeEntities(blocks[0]);
    const issues = validateMindmapIndentation(decoded);
    assert.equal(issues.length, 0, `들여쓰기 문제가 없어야 함: ${issues.join('; ')}`);
});

test('파이프라인: flowchart 문법이 post-processing 후에도 유지됨', () => {
    const rawContent = [
        '## 테스트',
        '',
        '```mermaid',
        'flowchart TD',
        ' A["화장품 영업 종류"] --> B["화장품 제조업<br/>등록"]',
        ' A --> C["책임판매업"]',
        ' D -.->|"제외"| E',
        '```',
    ].join('\n');
    const html = formatSectionContentForReader(rawContent, 'content/교재/law/1과목_화장품법의이해_표준형.md');
    const blocks = extractAllMermaidBlocks(html);
    assert.equal(blocks.length, 1);
    const decoded = decodeEntities(blocks[0]);
    assert.ok(decoded.startsWith('flowchart TD'), 'flowchart TD로 시작해야 함');
    assert.ok(decoded.includes('-->'), '화살표 보존');
    assert.ok(decoded.includes('-.->'), '점선 화살표 보존');
    assert.ok(decoded.includes('"제외"'), '라벨 보존');
});

// === 테스트: 실제 교재 파일 검증 ===

const TEXTBOOK_FILES = [
    { name: '1과목_화장품법의이해', path: path.join(CONTENT_DIR, 'law/1과목_화장품법의이해_표준형.md') },
    { name: '2과목_제조및품질관리', path: path.join(CONTENT_DIR, 'manufacturing/2과목_제조및품질관리_표준형.md') },
    { name: '3과목_유통화장품안전관리', path: path.join(CONTENT_DIR, 'safety/3과목_유통화장품안전관리_표준형.md') },
    { name: '4과목_맞춤형화장품의이해', path: path.join(CONTENT_DIR, 'understanding/4과목_맞춤형화장품의이해_표준형.md') },
];

for (const file of TEXTBOOK_FILES) {
    test(`실제 교재 검증: ${file.name} — 모든 mindmap 블록이 올바른 들여쓰기`, () => {
        const blocks = extractMermaidFromMarkdown(file.path);
        const mindmapBlocks = blocks.filter(b => b.trim().startsWith('mindmap'));
        assert.ok(mindmapBlocks.length > 0, `${file.name}에 mindmap 블록이 있어야 함`);

        for (let i = 0; i < mindmapBlocks.length; i++) {
            const issues = validateMindmapIndentation(mindmapBlocks[i]);
            assert.equal(issues.length, 0,
                `${file.name} mindmap #${i + 1}: 들여쓰기 문제 — ${issues.join('; ')}`);
        }
    });

    test(`실제 교재 검증: ${file.name} — 모든 flowchart 블록이 올바른 문법`, () => {
        const blocks = extractMermaidFromMarkdown(file.path);
        const flowchartBlocks = blocks.filter(b => b.trim().startsWith('flowchart'));
        assert.ok(flowchartBlocks.length > 0, `${file.name}에 flowchart 블록이 있어야 함`);

        for (let i = 0; i < flowchartBlocks.length; i++) {
            const trimmed = flowchartBlocks[i].trim();
            assert.ok(trimmed.startsWith('flowchart'),
                `${file.name} flowchart #${i + 1}: flowchart로 시작해야 함`);
            // 최소 하나의 노드(대괄호/소괄호)가 있어야 함
            assert.ok(trimmed.includes('[') || trimmed.includes('('),
                `${file.name} flowchart #${i + 1}: 최소 하나의 노드가 있어야 함`);
        }
    });
}

// === 테스트: CSS 클래스 분리 로직 ===

test('CSS 클래스 분리: mindmap은 mermaid-mindmap 클래스, flowchart는 mermaid-flowchart 클래스', () => {
    // textbook-reader.js의 로직 시뮬레이션
    const mindmapText = 'mindmap\n root((테스트))\n  자식';
    const flowchartText = 'flowchart TD\n A --> B';

    const mindmapType = detectDiagramType(mindmapText);
    const flowchartType = detectDiagramType(flowchartText);

    assert.equal(mindmapType, 'mindmap');
    assert.equal(flowchartType, 'flowchart');

    // 실제 클래스 할당 시뮬레이션
    const mindmapClass = mindmapType === 'mindmap' ? 'mermaid-mindmap' : 'mermaid-flowchart';
    const flowchartClass = flowchartType === 'mindmap' ? 'mermaid-mindmap' : 'mermaid-flowchart';

    assert.equal(mindmapClass, 'mermaid-mindmap');
    assert.equal(flowchartClass, 'mermaid-flowchart');
});

// === 테스트: <br/> 태그 보존 (두 타입 모두) ===

test('mindmap과 flowchart 모두 <br/> 태그가 엔티티로 보존됨', () => {
    const md = [
        '```mermaid',
        'mindmap',
        ' root((테스트<br/>서브))',
        '  자식',
        '```',
        '',
        '```mermaid',
        'flowchart TD',
        ' A["노드<br/>두줄"] --> B',
        '```',
    ].join('\n');
    const html = parseMarkdown(md, READER_OPTS);
    const blocks = extractAllMermaidBlocks(html);
    assert.equal(blocks.length, 2);

    // mindmap 블록
    assert.ok(blocks[0].includes('&lt;br/&gt;'), 'mindmap: <br/>가 엔티티로 보존');
    assert.ok(!blocks[0].includes('<br/>'), 'mindmap: 실제 <br/> 태그 없음');

    // flowchart 블록
    assert.ok(blocks[1].includes('&lt;br/&gt;'), 'flowchart: <br/>가 엔티티로 보존');
    assert.ok(!blocks[1].includes('<br/>'), 'flowchart: 실제 <br/> 태그 없음');
});
