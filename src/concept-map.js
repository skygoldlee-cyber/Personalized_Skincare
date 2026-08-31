// src/concept-map.js — 순수 SVG 인터랙티브 개념 맵 생성기 (CSP-safe, 의존성 없음)
// 교재 리더 상단에 섹션 구조를 시각화한 마인드맵을 렌더링합니다.

/**
 * 챕터 섹션 데이터를 받아 SVG 마인드맵을 생성합니다.
 * @param {object} chapter - { chapterTitle, sections: [{ title, content }] }
 * @param {object} opts - { isLightTheme: boolean, isKeySection: function }
 * @returns {string} SVG HTML 문자열
 */
export function generateConceptMap(chapter, opts = {}) {
    const { isLightTheme = false, isKeySection = null, mobile = false, pdfPath = '' } = opts;
    const sections = chapter.sections || [];
    if (sections.length === 0) return '';

    const svgNS = 'http://www.w3.org/2000/svg';

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

    if (mobile) {
        return generateMobileLayout(chapter, sections, colors, svgNS, isKeySection, pdfPath);
    }
    return generateDesktopLayout(chapter, sections, colors, svgNS, isKeySection, pdfPath);
}

// --- 세로 트리 레이아웃 (모바일) ---
function generateMobileLayout(chapter, sections, colors, svgNS, isKeySection, pdfPath) {
    const nodeW = 200;
    const nodeH = 40;
    const gapY = 14;
    const rootR = 28;
    const rootGap = 24;
    const svgWidth = 280;

    const centerX = svgWidth / 2;
    const rootY = rootR + 10;

    const nodes = sections.map((sec, i) => {
        const y = rootY + rootR + rootGap + i * (nodeH + gapY);
        return {
            sectionIdx: i,
            title: sec.title,
            x: centerX - nodeW / 2,
            y,
            cx: centerX,
            cy: y + nodeH / 2,
            isKey: isKeySection ? isKeySection(sec) : false
        };
    });

    const svgHeight = rootY + rootR + rootGap + nodes.length * (nodeH + gapY) - gapY + 10;

    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="concept-map-svg concept-map-mobile" xmlns="${svgNS}" role="img" aria-label="${escapeAttr(chapter.chapterTitle)} 개념 맵">`;

    // 엣지 — 루트에서 수직선, 각 노드 상단으로 연결
    nodes.forEach(n => {
        const isKey = n.isKey;
        const stroke = isKey ? colors.lineKey : colors.line;
        const dash = isKey ? 'stroke-dasharray="5,3"' : '';
        svg += `<path d="M ${centerX} ${rootY + rootR} L ${centerX} ${n.y}" fill="none" stroke="${stroke}" stroke-width="1.5" ${dash} opacity="0.7"/>`;
    });

    // 루트 노드
    const rootLabel = truncate(chapter.chapterTitle, 10);
    svg += `<circle cx="${centerX}" cy="${rootY}" r="${rootR}" fill="${colors.rootFill}" class="concept-map-root"/>`;
    svg += `<text x="${centerX}" y="${rootY + 4}" text-anchor="middle" fill="${colors.rootText}" font-size="10" font-weight="700" class="concept-map-root-text">${escapeText(rootLabel)}</text>`;

    // 루트 노드 아래 PDF 참조 배지
    if (pdfPath) {
        const badgeY = rootY + rootR + 6;
        const fileName = pdfPath.split('/').pop().replace(/\.pdf$/, '');
        const shortName = truncate(fileName, 16);
        svg += `<a href="${escapeAttr(pdfPath)}" target="_blank" class="concept-map-pdf-link">`;
        svg += `<rect x="${centerX - 90}" y="${badgeY}" width="180" height="22" rx="11" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1" opacity="0.9"/>`;
        svg += `<text x="${centerX}" y="${badgeY + 15}" text-anchor="middle" fill="${colors.nodeText}" font-size="9" class="concept-map-pdf-text">📄 ${escapeText(shortName)}</text>`;
        svg += `</a>`;
    }

    // 섹션 노드
    nodes.forEach(n => {
        const fill = n.isKey ? colors.keyFill : colors.nodeFill;
        const stroke = n.isKey ? colors.keyStroke : colors.nodeStroke;
        const label = truncate(n.title, 18);
        svg += `<g class="concept-map-node" data-section-idx="${n.sectionIdx}" tabindex="0" role="button" aria-label="섹션: ${escapeAttr(n.title)}">`;
        svg += `<rect x="${n.x}" y="${n.y}" width="${nodeW}" height="${nodeH}" rx="8" ry="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5" class="concept-map-rect"/>`;
        if (n.isKey) {
            svg += `<circle cx="${n.x + 12}" cy="${n.y + nodeH / 2}" r="4" fill="${colors.keyStroke}"/>`;
        }
        svg += `<text x="${n.x + nodeW / 2 + (n.isKey ? 6 : 0)}" y="${n.y + nodeH / 2 + 4}" text-anchor="middle" fill="${colors.nodeText}" font-size="11" class="concept-map-node-text">${escapeText(label)}</text>`;
        svg += `</g>`;
    });

    svg += `</svg>`;
    return svg;
}

// --- 좌/우 수평 레이아웃 (데스크톱) ---
function generateDesktopLayout(chapter, sections, colors, svgNS, isKeySection, pdfPath) {
    const nodeW = 180;
    const nodeH = 44;
    const gapY = 20;
    const rootR = 32;

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

    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="concept-map-svg concept-map-desktop" xmlns="${svgNS}" role="img" aria-label="${escapeAttr(chapter.chapterTitle)} 개념 맵">`;

    // 엣지 (루트 → 노드 연결선)
    nodes.forEach(n => {
        const isKey = n.isKey;
        const stroke = isKey ? colors.lineKey : colors.line;
        const dash = isKey ? 'stroke-dasharray="6,3"' : '';
        const cp1x = centerX + (n.side === 'left' ? -60 : 60);
        const cp2x = n.cx + (n.side === 'left' ? 60 : -60);
        svg += `<path d="M ${centerX} ${centerY} C ${cp1x} ${centerY}, ${cp2x} ${n.cy}, ${n.cx} ${n.cy}" fill="none" stroke="${stroke}" stroke-width="1.5" ${dash} opacity="0.7"/>`;
    });

    // 루트 노드 (챕터 제목)
    const rootLabel = truncate(chapter.chapterTitle, 12);
    svg += `<circle cx="${centerX}" cy="${centerY}" r="${rootR}" fill="${colors.rootFill}" class="concept-map-root"/>`;
    svg += `<text x="${centerX}" y="${centerY + 4}" text-anchor="middle" fill="${colors.rootText}" font-size="11" font-weight="700" class="concept-map-root-text">${escapeText(rootLabel)}</text>`;

    // 루트 노드 아래 PDF 참조 배지
    if (pdfPath) {
        const badgeY = centerY + rootR + 6;
        const fileName = pdfPath.split('/').pop().replace(/\.pdf$/, '');
        const shortName = truncate(fileName, 20);
        svg += `<a href="${escapeAttr(pdfPath)}" target="_blank" class="concept-map-pdf-link">`;
        svg += `<rect x="${centerX - 100}" y="${badgeY}" width="200" height="24" rx="12" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1" opacity="0.9"/>`;
        svg += `<text x="${centerX}" y="${badgeY + 16}" text-anchor="middle" fill="${colors.nodeText}" font-size="10" class="concept-map-pdf-text">📄 ${escapeText(shortName)}</text>`;
        svg += `</a>`;
    }

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

    // 모바일 감지: 컨테이너 폭이 480px 미만이면 세로 레이아웃
    const detectMobile = () => {
        const w = container.clientWidth || window.innerWidth;
        return w < 480;
    };

    const updateScrollIndicator = () => {
        const wrapper = container.closest('.concept-map-container') || container.parentElement;
        if (!wrapper) return;
        const hasScroll = container.scrollHeight > container.clientHeight + 2;
        wrapper.classList.toggle('has-scroll', hasScroll);
    };

    const render = () => {
        const mobile = detectMobile();
        const svgHtml = generateConceptMap(chapter, { ...opts, mobile });
        if (!svgHtml) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        container.innerHTML = svgHtml;
        container.style.display = 'block';
        bindNodes(onNodeClick);
        // 스크롤 indicator 갱신 (DOM 렌더 후)
        requestAnimationFrame(updateScrollIndicator);
    };

    const bindNodes = (clickHandler) => {
        if (!clickHandler) return;
        container.querySelectorAll('.concept-map-node').forEach(node => {
            const handler = (e) => {
                e.preventDefault();
                const idx = parseInt(node.dataset.sectionIdx);
                if (!isNaN(idx)) clickHandler(idx);
            };
            node.addEventListener('click', handler);
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler(e);
                }
            });
        });
    };

    render();

    // 스크롤 시 indicator 갱신
    container.addEventListener('scroll', updateScrollIndicator, { passive: true });

    // 화면 회전/리사이즈 시 재렌더링 (디바운스)
    if (!container._cmapResizeBound) {
        container._cmapResizeBound = true;
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const isMobile = detectMobile();
                const svg = container.querySelector('.concept-map-svg');
                const wasMobile = svg && svg.classList.contains('concept-map-mobile');
                if (isMobile !== wasMobile) {
                    render();
                } else {
                    updateScrollIndicator();
                }
            }, 200);
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
