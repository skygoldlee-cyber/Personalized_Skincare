// src/mermaid-utils.js — Mermaid 다이어그램 타입 감지 공용 유틸리티
// 모든 렌더링 컨텍스트 (textbook-reader, textbook-search, manual-viewer)에서 공유.

/**
 * Mermaid 다이어그램 타입을 감지한다.
 * 첫 번째 비어있지 않은 라인의 첫 단어를 기준으로 판별.
 *
 * @param {string} text - pre.mermaid 노드의 textContent
 * @returns {string} 다이어그램 타입 ('mindmap' | 'flowchart' | 'sequence' | 'class' | 'state' | 'gantt' | 'pie' | 'gitGraph' | 'timeline' | 'quadrant' | 'sankey' | 'er' | 'unknown')
 */
export function detectMermaidType(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('mindmap')) return 'mindmap';

    // flowchart / graph 모두 flowchart로 간주
    if (trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) return 'flowchart';

    if (trimmed.startsWith('sequenceDiagram')) return 'sequence';
    if (trimmed.startsWith('classDiagram')) return 'class';
    if (trimmed.startsWith('stateDiagram')) return 'state';
    if (trimmed.startsWith('gantt')) return 'gantt';
    if (trimmed.startsWith('pie')) return 'pie';
    if (trimmed.startsWith('gitGraph')) return 'gitGraph';
    if (trimmed.startsWith('timeline')) return 'timeline';
    if (trimmed.startsWith('quadrantChart')) return 'quadrant';
    if (trimmed.startsWith('sankey')) return 'sankey';
    if (trimmed.startsWith('erDiagram')) return 'er';

    return 'unknown';
}

/**
 * 다이어그램 타입에 따른 CSS 클래스 반환.
 * mindmap과 flowchart는 기존 스타일을 유지하고,
 * 나머지 타입은 'mermaid-other' 클래스로 기본 Mermaid 스타일을 따르도록 함.
 *
 * @param {string} type - detectMermaidType() 반환값
 * @returns {string} CSS 클래스명 ('mermaid-mindmap' | 'mermaid-flowchart' | 'mermaid-other')
 */
export function getMermaidClassName(type) {
    if (type === 'mindmap') return 'mermaid-mindmap';
    if (type === 'flowchart') return 'mermaid-flowchart';
    return 'mermaid-other';
}

/**
 * 다이어그램 타입에 따라 Mermaid initialize 옵션을 반환.
 * flowchart에만 lineWidth 등 세부 themeVariables를 적용하고,
 * 나머지는 기본 테마만 적용.
 *
 * @param {string} type - detectMermaidType() 반환값
 * @param {boolean} isLight - 라이트 테마 여부
 * @returns {object} mermaid.initialize() 옵션 객체
 */
export function getMermaidInitOptions(type, isLight) {
    const base = {
        startOnLoad: false,
        securityLevel: 'strict',
        theme: isLight ? 'default' : 'dark'
    };

    if (type === 'flowchart') {
        return {
            ...base,
            themeVariables: isLight ? {
                primaryColor: '#f0f4ff',
                primaryTextColor: '#1a1a2e',
                primaryBorderColor: '#4a6fa5',
                lineColor: '#4a6fa5',
                secondaryColor: '#f5f5f5',
                tertiaryColor: '#e8eaf6',
                background: '#ffffff',
                mainBkg: '#f0f4ff',
                nodeTextColor: '#1a1a2e',
                fontSize: '14px',
                lineWidth: 1
            } : {
                primaryColor: '#2d2d44',
                primaryTextColor: '#e0e0e0',
                primaryBorderColor: '#7b8faf',
                lineColor: '#7b8faf',
                secondaryColor: '#1e1e2e',
                tertiaryColor: '#2a2a3e',
                background: '#1a1a2e',
                mainBkg: '#2d2d44',
                nodeTextColor: '#e0e0e0',
                fontSize: '14px',
                lineWidth: 1
            }
        };
    }

    // mindmap, sequence, class, state, gantt, pie, etc. — 기본 테마만
    return base;
}
