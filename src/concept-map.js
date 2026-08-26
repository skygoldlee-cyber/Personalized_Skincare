// src/concept-map.js — 순수 SVG 인터랙티브 개념 맵 생성기 (CSP-safe, 의존성 없음)
// 교재 리더 상단에 섹션 구조를 시각화한 마인드맵을 렌더링합니다.

/**
 * 챕터 섹션 데이터를 받아 SVG 마인드맵을 생성합니다.
 * @param {object} chapter - { chapterTitle, sections: [{ title, content }] }
 * @param {object} opts - { isLightTheme: boolean, isKeySection: function }
 * @returns {string} SVG HTML 문자열
 */
export function generateConceptMap(chapter, opts = {}) {
    const { isLightTheme = false, isKeySection = null } = opts;
    const sections = chapter.sections || [];
    if (sections.length === 0) return '';

    // 레이아웃 파라미터
    const nodeW = 180;
    const nodeH = 44;
    const gapX = 40;
    const gapY = 20;
    const rootR = 32;
    const svgNS = 'http://www.w3.org/2000/svg';

    // 노드 위치 계산 — 루트를 중심으로 좌/우 양쪽으로 배치
    const totalNodes = sections.length;
    const half = Math.ceil(totalNodes / 2);
    const leftNodes = sections.slice(0, half);
    const rightNodes = sections.slice(half);

    const colHeight = (count) => count * (nodeH + gapY) - gapY;
    const maxColHeight = Math.max(colHeight(leftNodes.length), colHeight(rightNodes.length), 100);
    const svgHeight = maxColHeight + rootR * 2 + 40;
    const svgWidth = 760;

    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;

    // 노드 좌표 생성
    const nodes = [];
    const placeColumn = (arr, side) => {
        const colH = colHeight(arr.length);
        const startY = centerY - colH / 2;
        const x = side === 'left' ? centerX - 240 : centerX + 240;
        arr.forEach((sec, i) => {
            nodes.push({
                id: `cmap-node-${i + (side === 'left' ? 0 : leftNodes.length)}`,
                title: sec.title,
                sectionIdx: i + (side === 'left' ? 0 : leftNodes.length),
                x: x - nodeW / 2,
                y: startY + i * (nodeH + gapY),
                cx: x,
                cy: startY + i * (nodeH + gapY) + nodeH / 2,
                side,
                isKey: isKeySection ? isKeySection(sec) : false
            });
        });
    };

    placeColumn(leftNodes, 'left');
    placeColumn(rightNodes, 'right');

    // 색상 테마
    const colors = isLightTheme ? {
        rootFill: '#1a73e8', rootText: '#fff',
        nodeFill: '#f8f9fa', nodeStroke: '#dadce0', nodeText: '#202124',
        keyFill: '#fef7e0', keyStroke: '#f9ab00',
        line: '#9aa0a6', lineKey: '#f9ab00'
    } : {
        rootFill: '#1f6feb', rootText: '#fff',
        nodeFill: '#161b22', nodeStroke: '#30363d', nodeText: '#c9d1d9',
        keyFill: '#221a00', keyStroke: '#d29922',
        line: '#30363d', lineKey: '#d29922'
    };

    // SVG 문자열 조립
    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="concept-map-svg" xmlns="${svgNS}" role="img" aria-label="${escapeAttr(chapter.chapterTitle)} 개념 맵">`;

    // 엣지 (루트 → 노드 연결선)
    nodes.forEach(n => {
        const isKey = n.isKey;
        const stroke = isKey ? colors.lineKey : colors.line;
        const dash = isKey ? 'stroke-dasharray="6,3"' : '';
        // 베지어 곡선으로 자연스러운 연결
        const cp1x = centerX + (n.side === 'left' ? -60 : 60);
        const cp2x = n.cx + (n.side === 'left' ? 60 : -60);
        svg += `<path d="M ${centerX} ${centerY} C ${cp1x} ${centerY}, ${cp2x} ${n.cy}, ${n.cx} ${n.cy}" fill="none" stroke="${stroke}" stroke-width="1.5" ${dash} opacity="0.7"/>`;
    });

    // 루트 노드 (챕터 제목)
    const rootLabel = truncate(chapter.chapterTitle, 12);
    svg += `<circle cx="${centerX}" cy="${centerY}" r="${rootR}" fill="${colors.rootFill}" class="concept-map-root"/>`;
    svg += `<text x="${centerX}" y="${centerY + 4}" text-anchor="middle" fill="${colors.rootText}" font-size="11" font-weight="700" class="concept-map-root-text">${escapeText(rootLabel)}</text>`;

    // 섹션 노드
    nodes.forEach(n => {
        const fill = n.isKey ? colors.keyFill : colors.nodeFill;
        const stroke = n.isKey ? colors.keyStroke : colors.nodeStroke;
        const label = truncate(n.title, 16);
        svg += `<g class="concept-map-node" data-section-idx="${n.sectionIdx}" tabindex="0" role="button" aria-label="섹션: ${escapeAttr(n.title)}">`;
        svg += `<rect x="${n.x}" y="${n.y}" width="${nodeW}" height="${nodeH}" rx="8" ry="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5" class="concept-map-rect"/>`;
        if (n.isKey) {
            svg += `<circle cx="${n.x + 12}" cy="${n.y + nodeH / 2}" r="4" fill="${colors.keyStroke}"/>`;
        }
        svg += `<text x="${n.x + nodeW / 2 + (n.isKey ? 6 : 0)}" y="${n.y + nodeH / 2 + 4}" text-anchor="middle" fill="${colors.nodeText}" font-size="12" class="concept-map-node-text">${escapeText(label)}</text>`;
        svg += `</g>`;
    });

    svg += `</svg>`;
    return svg;
}

/**
 * 개념 맵 SVG를 컨테이너에 렌더링하고 클릭 이벤트를 바인딩합니다.
 * @param {HTMLElement} container - 렌더링할 DOM 컨테이너
 * @param {object} chapter - 챕터 데이터
 * @param {object} opts - { isLightTheme, isKeySection, onNodeClick }
 */
export function renderConceptMap(container, chapter, opts = {}) {
    if (!container) return;
    const { onNodeClick } = opts;

    const svgHtml = generateConceptMap(chapter, opts);
    if (!svgHtml) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.innerHTML = svgHtml;
    container.style.display = 'block';

    // 노드 클릭 → 해당 섹션으로 스크롤
    if (onNodeClick) {
        container.querySelectorAll('.concept-map-node').forEach(node => {
            const handler = (e) => {
                e.preventDefault();
                const idx = parseInt(node.dataset.sectionIdx);
                if (!isNaN(idx)) onNodeClick(idx);
            };
            node.addEventListener('click', handler);
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler(e);
                }
            });
        });
    }
}

// --- 유틸리티 ---

function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;
}

function escapeText(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
