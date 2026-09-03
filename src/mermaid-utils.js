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

    // mindmap, sequence, class, state, gantt, pie, etc. — 기본 테마 + 대비 보정
    return {
        ...base,
        themeVariables: isLight ? {
            // 라이트: 배경은 밝게, 텍스트는 어둡게
            primaryColor: '#f5f5f5',
            primaryTextColor: '#1a1a2e',
            primaryBorderColor: '#666',
            lineColor: '#555',
            secondaryColor: '#eaeaea',
            tertiaryColor: '#e0e0e0',
            background: '#ffffff',
            mainBkg: '#f5f5f5',
            nodeTextColor: '#1a1a2e',
            fontSize: '14px',
            // sequenceDiagram 전용
            actorBkg: '#e8eaf6',
            actorBorder: '#5c6bc0',
            actorTextColor: '#1a1a2e',
            actorLineColor: '#999',
            signalColor: '#555',
            signalTextColor: '#1a1a2e',
            labelBoxBkgColor: '#e8eaf6',
            labelTextColor: '#1a1a2e',
            noteBkgColor: '#fff9c4',
            noteTextColor: '#1a1a2e',
            noteBorderColor: '#fbc02d',
            activationBkgColor: '#c5cae9',
            sequenceNumberColor: '#1a1a2e'
        } : {
            // 다크: 배경은 중간 톤, 텍스트는 밝게
            primaryColor: '#3a3a5c',
            primaryTextColor: '#e8e8e8',
            primaryBorderColor: '#8a8aab',
            lineColor: '#8a8aab',
            secondaryColor: '#2a2a3e',
            tertiaryColor: '#33334a',
            background: '#1a1a2e',
            mainBkg: '#3a3a5c',
            nodeTextColor: '#e8e8e8',
            fontSize: '14px',
            // sequenceDiagram 전용
            actorBkg: '#3a3a5c',
            actorBorder: '#9fa8da',
            actorTextColor: '#e8e8e8',
            actorLineColor: '#666688',
            signalColor: '#b0b0cc',
            signalTextColor: '#e8e8e8',
            labelBoxBkgColor: '#3a3a5c',
            labelTextColor: '#e8e8e8',
            noteBkgColor: '#4a4a2e',
            noteTextColor: '#fff9c4',
            noteBorderColor: '#fbc02d',
            activationBkgColor: '#5c5c8a',
            sequenceNumberColor: '#e8e8e8'
        }
    };
}
