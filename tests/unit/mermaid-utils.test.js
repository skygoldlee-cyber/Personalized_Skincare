import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMermaidType, getMermaidClassName, getMermaidInitOptions } from '../../src/mermaid-utils.js';

test('detectMermaidType: 각 다이어그램 키워드 감지', () => {
    assert.equal(detectMermaidType('mindmap\n  root'), 'mindmap');
    assert.equal(detectMermaidType('flowchart LR\n  A-->B'), 'flowchart');
    assert.equal(detectMermaidType('graph TD\n  A-->B'), 'flowchart');
    assert.equal(detectMermaidType('sequenceDiagram\n  A->>B: hi'), 'sequence');
    assert.equal(detectMermaidType('classDiagram\n  A <|-- B'), 'class');
    assert.equal(detectMermaidType('stateDiagram-v2\n  [*] --> A'), 'state');
    assert.equal(detectMermaidType('gantt\n  title T'), 'gantt');
    assert.equal(detectMermaidType('pie showData\n  "a": 1'), 'pie');
    assert.equal(detectMermaidType('gitGraph\n  commit'), 'gitGraph');
    assert.equal(detectMermaidType('timeline\n  2020: 사건'), 'timeline');
    assert.equal(detectMermaidType('quadrantChart\n  title T'), 'quadrant');
    assert.equal(detectMermaidType('sankey-beta\n  a,b,1'), 'sankey');
    assert.equal(detectMermaidType('erDiagram\n  A ||--|| B : has'), 'er');
});

test('detectMermaidType: 선행 공백·개행은 무시', () => {
    assert.equal(detectMermaidType('   \n\n  flowchart TD\n  A-->B'), 'flowchart');
});

test('detectMermaidType: 알 수 없는·빈 입력 → unknown', () => {
    assert.equal(detectMermaidType('xychart-beta\n  x-axis'), 'unknown'); // 지원 목록 외
    assert.equal(detectMermaidType('일반 텍스트'), 'unknown');
    assert.equal(detectMermaidType(''), 'unknown');
});

test('getMermaidClassName: mindmap/flowchart만 전용 클래스', () => {
    assert.equal(getMermaidClassName('mindmap'), 'mermaid-mindmap');
    assert.equal(getMermaidClassName('flowchart'), 'mermaid-flowchart');
    assert.equal(getMermaidClassName('sequence'), 'mermaid-other');
    assert.equal(getMermaidClassName('unknown'), 'mermaid-other');
});

test('getMermaidInitOptions: 공통 옵션 — startOnLoad off, strict, 테마', () => {
    assert.deepEqual(
        { startOnLoad: false, securityLevel: 'strict', theme: 'default' },
        Object.fromEntries(Object.entries(getMermaidInitOptions('flowchart', true)).filter(([k]) => k !== 'themeVariables'))
    );
    assert.equal(getMermaidInitOptions('sequence', false).theme, 'dark');
});

test('getMermaidInitOptions: flowchart는 themeVariables 포함, 라이트/다크 분기', () => {
    const light = getMermaidInitOptions('flowchart', true);
    const dark = getMermaidInitOptions('flowchart', false);
    assert.equal(light.theme, 'default');
    assert.equal(dark.theme, 'dark');
    assert.equal(light.themeVariables.primaryTextColor, '#0d47a1');
    assert.equal(dark.themeVariables.primaryTextColor, '#ffffff');
    assert.equal(light.themeVariables.lineWidth, 1);
});

test('getMermaidInitOptions: mindmap은 다크모드에서도 default 테마 (대비 유지)', () => {
    const opts = getMermaidInitOptions('mindmap', false);
    assert.equal(opts.theme, 'default');
    assert.equal(opts.themeVariables, undefined);
});

test('getMermaidInitOptions: 기타 타입은 시퀀스용 보정 변수 포함', () => {
    const opts = getMermaidInitOptions('sequence', true);
    assert.equal(opts.themeVariables.actorBkg, '#c5cae9');
    assert.equal(opts.themeVariables.sequenceNumberColor, '#1a1a2e');
});
