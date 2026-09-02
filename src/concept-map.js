// src/concept-map.js — 순수 SVG 인터랙티브 개념 맵 생성기 (CSP-safe, 의존성 없음)
// 교재 리더 상단에 섹션 구조를 시각화한 마인드맵을 렌더링합니다.
// 대분류/중분류/소분류 테이블이 있으면 계층적 트리로 렌더링, 없으면 평면 섹션 나열.
import { resolveRefPath } from './pdf-registry.js';
import { getGlossaryEntry } from './glossary-query.js';
import { scrollToGlossary } from './views/glossary-renderer.js';

/**
 * 챕터 섹션 데이터를 받아 SVG 마인드맵을 생성합니다.
 * @param {object} chapter - { chapterTitle, sections: [{ title, content }] }
 * @param {object} opts - { isLightTheme: boolean, isKeySection: function }
 * @returns {string} SVG HTML 문자열
 */
export function generateConceptMap(chapter, opts = {}) {
    const { isLightTheme = false, isKeySection = null, mobile = false, refPath = '' } = opts;
    const sections = chapter.sections || [];
    if (sections.length === 0) return '';

    const svgNS = 'http://www.w3.org/2000/svg';

    // 색상 테마
    const colors = isLightTheme ? {
        rootFill: '#1a73e8', rootText: '#fff',
        nodeFill: '#f8f9fa', nodeStroke: '#dadce0', nodeText: '#202124',
        keyFill: '#fef7e0', keyStroke: '#f9ab00',
        line: '#9aa0a6', lineKey: '#f9ab00',
        lv1Fill: '#e8f0fe', lv1Stroke: '#1a73e8',
        lv2Fill: '#f8f9fa', lv2Stroke: '#dadce0',
        lv3Fill: '#fff8e1', lv3Stroke: '#f9ab00'
    } : {
        rootFill: '#1f6feb', rootText: '#fff',
        nodeFill: '#161b22', nodeStroke: '#30363d', nodeText: '#c9d1d9',
        keyFill: '#221a00', keyStroke: '#d29922',
        line: '#30363d', lineKey: '#d29922',
        lv1Fill: '#0d1117', lv1Stroke: '#1f6feb',
        lv2Fill: '#161b22', lv2Stroke: '#30363d',
        lv3Fill: '#221a00', lv3Stroke: '#d29922'
    };

    // 대분류/중분류/소분류 테이블 파싱 시도
    const tree = parseMindmapTree(chapter);
    if (tree && tree.children.length > 0) {
        return generateTreeLayout(chapter, tree, colors, svgNS, mobile, refPath);
    }

    // Fallback: 평면 섹션 레이아웃
    if (mobile) {
        return generateMobileLayout(chapter, sections, colors, svgNS, isKeySection, refPath);
    }
    return generateDesktopLayout(chapter, sections, colors, svgNS, isKeySection, refPath);
}

// --- 섹션별 계층 트리 파싱 ---
// Root(챕터) → Section(##) → 대분류 → 중분류 → 소분류
const META_SECTION_PATTERNS = [
    /^학습 아이콘/, /^최우선 암기/, /^숫자 암기/, /^목차/, /^학습 안내/,
    /^과목 시각화/, /^확인문제/, /^핵심 용어/, /^오답/, /^학습 안내서/,
    /^시험 직전/, /^키워드$/
];

function isMetaSection(title) {
    const clean = title.replace(/^[🎯📖🧭🔢✅📊🧠⚠️🔄📝⚖️🗺️\s]+/, '').trim();
    return META_SECTION_PATTERNS.some(p => p.test(clean));
}

function parseMindmapTree(chapter) {
    const sections = chapter.sections || [];
    const root = { title: chapter.chapterTitle || '', children: [] };
    let hasAnyTable = false;

    for (let si = 0; si < sections.length; si++) {
        const sec = sections[si];
        if (isMetaSection(sec.title)) continue;

        const secNode = {
            title: sec.title,
            level: 1,
            children: [],
            linkInfo: null,
            sectionIdx: si
        };

        // 섹션 콘텐츠에서 대분류/중분류/소분류 테이블 찾기
        const tableRows = parseTriTable(sec.content || '');
        if (tableRows.length > 0) {
            hasAnyTable = true;
            const daebunMap = {};
            const jungbunMap = {};

            for (const cells of tableRows) {
                const daebunCell = cells[0] || '';
                const jungbunCell = cells[1] || '';
                const sobunCell = cells[2] || '';

                const daebun = parseCellText(daebunCell);
                const jungbun = parseCellText(jungbunCell);
                const sobun = parseCellText(sobunCell);

                if (!daebun) continue;

                if (!daebunMap[daebun]) {
                    const linkInfo = parseCellLink(daebunCell);
                    const node = { title: daebun, level: 2, children: [], linkInfo };
                    daebunMap[daebun] = node;
                    secNode.children.push(node);
                }

                if (jungbun && jungbun !== '—') {
                    const key = `${daebun}|${jungbun}`;
                    if (!jungbunMap[key]) {
                        const linkInfo = parseCellLink(jungbunCell);
                        const node = { title: jungbun, level: 3, children: [], linkInfo };
                        jungbunMap[key] = node;
                        daebunMap[daebun].children.push(node);
                    }

                    if (sobun && sobun !== '—') {
                        const linkInfo = parseCellLink(sobunCell);
                        const node = { title: sobun, level: 4, children: [], linkInfo };
                        jungbunMap[key].children.push(node);
                    }
                }
            }
        }

        root.children.push(secNode);
    }

    // 테이블이 하나도 없으면 null 반환 → 평면 레이아웃 fallback
    if (!hasAnyTable) return null;
    return root;
}

function parseTriTable(content) {
    const lines = content.split('\n');
    let inTable = false;
    const rows = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim().startsWith('|')) {
            if (inTable && rows.length > 0) break;
            inTable = false;
            continue;
        }

        if (line.includes('대분류') && line.includes('중분류')) {
            inTable = true;
            rows.length = 0;
            continue;
        }

        if (/^\|[\s-]+\|/.test(line.trim())) continue;
        if (!inTable) continue;

        const safeLine = line.replace(/\\\|/g, '\x00');
        const rawCells = safeLine.split('|').slice(1, -1);
        const cells = rawCells.map(c => c.replace(/\x00/g, '|').trim());
        rows.push(cells);
    }

    return rows;
}

function parseCellText(cell) {
    return cell
        .replace(/\(L\d+\|.+?\.pdf\)/g, '')
        .replace(/\(L\d+\)/g, '')
        .replace(/\(L\?\)/g, '')
        .trim();
}

function parseCellLink(cell) {
    let m = cell.match(/\(L(\d+)\|(.+?\.pdf)\)/);
    if (m) return { lineNum: m[1], pdfFile: m[2] };
    m = cell.match(/\(L(\d+)\)(?![\\|])/);
    if (m) return { lineNum: m[1], pdfFile: '' };
    if (cell.includes('(L?)')) return { lineNum: '?', pdfFile: '' };
    return null;
}

// --- 계층적 트리 렌더링 (대분류/중분류/소분류) ---
function generateTreeLayout(chapter, tree, colors, svgNS, mobile, refPath) {
    const rootR = mobile ? 26 : 32;
    const rootLabel = truncate(chapter.chapterTitle, mobile ? 10 : 14);

    // 레벨별 노드 스타일 (Section=1, 대분류=2, 중분류=3, 소분류=4)
    const levelStyles = [
        { w: mobile ? 170 : 200, h: 36, fill: colors.lv1Fill, stroke: colors.lv1Stroke, font: 11 },
        { w: mobile ? 160 : 180, h: 32, fill: colors.lv2Fill, stroke: colors.lv2Stroke, font: 10 },
        { w: mobile ? 150 : 165, h: 28, fill: colors.lv3Fill, stroke: colors.lv3Stroke, font: 9 },
        { w: mobile ? 140 : 150, h: 24, fill: colors.nodeFill, stroke: colors.nodeStroke, font: 8 }
    ];

    // 트리 노드 평면화 + 위치 계산
    // 모바일: 세로 트리 (root → 대분류 → 중분류 → 소분류가 모두 아래로)
    // 데스크톱: 좌우 트리 (root 중심, 대분류가 좌우로 퍼짐)

    if (mobile) {
        return generateTreeMobile(chapter, tree, colors, svgNS, rootR, rootLabel, levelStyles, refPath);
    }
    return generateTreeDesktop(chapter, tree, colors, svgNS, rootR, rootLabel, levelStyles, refPath);
}

function buildRefLinkAttrs(linkInfo, refPath) {
    if (!linkInfo) return '';
    let html;
    if (linkInfo.pdfFile) {
        html = resolveRefPath(linkInfo.pdfFile) || '';
    } else {
        html = refPath;
    }
    if (!html) return '';
    const line = linkInfo.lineNum || '';
    // GLOSSARY_INDEX 키: "파일명.md|L123" (경로 단축版)
    const fileName = html.split('/').pop();
    const idxKey = `${fileName}|L${line}`;
    const entry = getGlossaryEntry(idxKey);
    if (!entry) return '';  // 키워드가 없으면 링크 속성 생성하지 않음
    return `data-glossary="${escapeAttr(idxKey)}"`;
}

function generateTreeMobile(chapter, tree, colors, svgNS, rootR, rootLabel, levelStyles, refPath) {
    const svgWidth = 320;
    const centerX = svgWidth / 2;
    const rootY = rootR + 10;
    const indentStep = 24;
    const gapY = 10;
    const nodeGap = 6;

    // 노드 평면화 (DFS 순서)
    const flatNodes = [];
    let cursorY = rootY + rootR + 16;

    function flatten(node, depth, parentNode) {
        const style = levelStyles[Math.min(depth - 1, levelStyles.length - 1)];
        const x = centerX - style.w / 2 + (depth - 1) * indentStep - indentStep;
        const node2 = {
            title: node.title,
            level: depth,
            x: x,
            y: cursorY,
            w: style.w,
            h: style.h,
            fill: style.fill,
            stroke: style.stroke,
            font: style.font,
            linkInfo: node.linkInfo || null,
            sectionIdx: node.sectionIdx,
            parentY: parentNode ? parentNode.y + parentNode.h : rootY
        };
        flatNodes.push(node2);
        cursorY += style.h + gapY;
        for (const child of node.children) {
            flatten(child, depth + 1, node2);
        }
    }

    for (const child of tree.children) {
        flatten(child, 1, null);
    }

    const svgHeight = cursorY + 10;

    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="concept-map-svg concept-map-tree concept-map-mobile" xmlns="${svgNS}" role="img" aria-label="${escapeAttr(chapter.chapterTitle)} 개념 맵">`;

    // 엣지 (부모 → 자식 연결선)
    for (let i = 0; i < flatNodes.length; i++) {
        const n = flatNodes[i];
        const strokeIdx = Math.min(n.level - 1, 3);
        const strokes = [colors.lv1Stroke, colors.lv2Stroke, colors.lv3Stroke, colors.nodeStroke];
        const stroke = strokes[strokeIdx];
        svg += `<path d="M ${n.x + n.w / 2} ${n.parentY} L ${n.x + n.w / 2} ${n.y}" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="0.5"/>`;
    }

    // 루트 노드
    svg += `<circle cx="${centerX}" cy="${rootY}" r="${rootR}" fill="${colors.rootFill}" class="concept-map-root"/>`;
    svg += `<text x="${centerX}" y="${rootY + 4}" text-anchor="middle" fill="${colors.rootText}" font-size="10" font-weight="700" class="concept-map-root-text">${escapeText(rootLabel)}</text>`;

    // 트리 노드
    for (const n of flatNodes) {
        const maxLen = n.level === 1 ? 16 : (n.level === 2 ? 14 : (n.level === 3 ? 16 : 18));
        const label = truncate(n.title, maxLen);
        const linkAttrs = buildRefLinkAttrs(n.linkInfo, refPath);
        const hasSection = n.sectionIdx !== undefined;
        const cls = `concept-map-tree-node${linkAttrs ? ' concept-map-tree-link' : ''}${hasSection ? ' concept-map-node' : ''}`;
        const dataAttrs = hasSection ? `data-section-idx="${n.sectionIdx}"` : '';
        svg += `<g class="${cls}" ${linkAttrs} ${dataAttrs} ${linkAttrs || hasSection ? 'role="button" tabindex="0"' : ''}>`;
        svg += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" ry="6" fill="${n.fill}" stroke="${n.stroke}" stroke-width="1.5"/>`;
        svg += `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4}" text-anchor="middle" fill="${colors.nodeText}" font-size="${n.font}" class="concept-map-node-text">${escapeText(label)}</text>`;
        svg += `</g>`;
    }

    svg += `</svg>`;
    return svg;
}

function generateTreeDesktop(chapter, tree, colors, svgNS, rootR, rootLabel, levelStyles, refPath) {
    const svgWidth = 820;
    const centerX = svgWidth / 2;
    const centerY = 120;

    // 섹션을 좌/우로 분할
    const sectionNodes = tree.children;
    const half = Math.ceil(sectionNodes.length / 2);
    const leftSec = sectionNodes.slice(0, half);
    const rightSec = sectionNodes.slice(half);

    // 좌/우 컬럼 노드 배치
    const allNodes = [];

    function placeColumn(secList, side) {
        const dir = side === 'left' ? -1 : 1;
        const baseX = centerX + dir * (rootR + 30);
        let cursorY = centerY;

        for (const sec of secList) {
            const style = levelStyles[0];
            const dx = side === 'left' ? -style.w : 0;
            const secNode = {
                title: sec.title, level: 1,
                x: baseX + dx, y: cursorY, w: style.w, h: style.h,
                fill: style.fill, stroke: style.stroke, font: style.font,
                linkInfo: sec.linkInfo || null,
                sectionIdx: sec.sectionIdx,
                parentX: centerX, parentY: centerY
            };
            allNodes.push(secNode);
            cursorY += style.h + 8;

            for (const daebun of sec.children) {
                const dstyle = levelStyles[1];
                const ddx = side === 'left' ? -dstyle.w + 20 : -20;
                const daebunNode = {
                    title: daebun.title, level: 2,
                    x: baseX + ddx, y: cursorY, w: dstyle.w, h: dstyle.h,
                    fill: dstyle.fill, stroke: dstyle.stroke, font: dstyle.font,
                    linkInfo: daebun.linkInfo || null,
                    parentX: secNode.x + secNode.w / 2, parentY: secNode.y + secNode.h
                };
                allNodes.push(daebunNode);
                cursorY += dstyle.h + 6;

                for (const jungbun of daebun.children) {
                    const jstyle = levelStyles[2];
                    const jdx = side === 'left' ? -jstyle.w + 40 : -40;
                    const jungbunNode = {
                        title: jungbun.title, level: 3,
                        x: baseX + jdx, y: cursorY, w: jstyle.w, h: jstyle.h,
                        fill: jstyle.fill, stroke: jstyle.stroke, font: jstyle.font,
                        linkInfo: jungbun.linkInfo || null,
                        parentX: daebunNode.x + daebunNode.w / 2, parentY: daebunNode.y + daebunNode.h
                    };
                    allNodes.push(jungbunNode);
                    cursorY += jstyle.h + 5;

                    for (const sobun of jungbun.children) {
                        const sstyle = levelStyles[3];
                        const sdx = side === 'left' ? -sstyle.w + 60 : -60;
                        const sobunNode = {
                            title: sobun.title, level: 4,
                            x: baseX + sdx, y: cursorY, w: sstyle.w, h: sstyle.h,
                            fill: sstyle.fill, stroke: sstyle.stroke, font: sstyle.font,
                            linkInfo: sobun.linkInfo || null,
                            parentX: jungbunNode.x + jungbunNode.w / 2, parentY: jungbunNode.y + jungbunNode.h
                        };
                        allNodes.push(sobunNode);
                        cursorY += sstyle.h + 4;
                    }
                }
            }
        }
    }

    placeColumn(leftSec, 'left');
    placeColumn(rightSec, 'right');

    // SVG 높이 계산
    let maxY = centerY;
    for (const n of allNodes) {
        if (n.y + n.h > maxY) maxY = n.y + n.h;
    }
    const svgHeight = maxY + 20;

    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="concept-map-svg concept-map-tree concept-map-desktop" xmlns="${svgNS}" role="img" aria-label="${escapeAttr(chapter.chapterTitle)} 개념 맵">`;

    // 엣지
    const strokes = [colors.lv1Stroke, colors.lv2Stroke, colors.lv3Stroke, colors.nodeStroke];
    for (const n of allNodes) {
        const stroke = strokes[Math.min(n.level - 1, 3)];
        const nx = n.x + n.w / 2;
        const ny = n.y;
        svg += `<path d="M ${n.parentX} ${n.parentY} L ${nx} ${ny}" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="0.5"/>`;
    }

    // 루트 → 섹션 연결선
    for (const n of allNodes.filter(n => n.level === 1)) {
        svg += `<path d="M ${centerX} ${centerY} L ${n.x + n.w / 2} ${n.y}" fill="none" stroke="${colors.lv1Stroke}" stroke-width="1.5" opacity="0.6"/>`;
    }

    // 루트 노드
    svg += `<circle cx="${centerX}" cy="${centerY}" r="${rootR}" fill="${colors.rootFill}" class="concept-map-root"/>`;
    svg += `<text x="${centerX}" y="${centerY + 4}" text-anchor="middle" fill="${colors.rootText}" font-size="11" font-weight="700" class="concept-map-root-text">${escapeText(rootLabel)}</text>`;

    // 트리 노드
    for (const n of allNodes) {
        const maxLen = n.level === 1 ? 14 : (n.level === 2 ? 12 : (n.level === 3 ? 14 : 16));
        const label = truncate(n.title, maxLen);
        const linkAttrs = buildRefLinkAttrs(n.linkInfo, refPath);
        const hasSection = n.sectionIdx !== undefined;
        const cls = `concept-map-tree-node${linkAttrs ? ' concept-map-tree-link' : ''}${hasSection ? ' concept-map-node' : ''}`;
        const dataAttrs = hasSection ? `data-section-idx="${n.sectionIdx}"` : '';
        svg += `<g class="${cls}" ${linkAttrs} ${dataAttrs} ${linkAttrs || hasSection ? 'role="button" tabindex="0"' : ''}>`;
        svg += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" ry="6" fill="${n.fill}" stroke="${n.stroke}" stroke-width="1.5"/>`;
        svg += `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 3}" text-anchor="middle" fill="${colors.nodeText}" font-size="${n.font}" class="concept-map-node-text">${escapeText(label)}</text>`;
        svg += `</g>`;
    }

    svg += `</svg>`;
    return svg;
}

// --- 세로 트리 레이아웃 (모바일) ---
function generateMobileLayout(chapter, sections, colors, svgNS, isKeySection, refPath) {
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

    // 루트 노드 아래 참조자료 배지
    if (refPath) {
        const badgeY = rootY + rootR + 6;
        const fileName = refPath.split('/').pop().replace(/\.(html|md)$/, '');
        const shortName = truncate(fileName, 16);
        svg += `<g class="concept-map-ref-link" data-ref-html="${escapeAttr(refPath)}" style="cursor:pointer">`;
        svg += `<rect x="${centerX - 90}" y="${badgeY}" width="180" height="22" rx="11" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1" opacity="0.9"/>`;
        svg += `<text x="${centerX}" y="${badgeY + 15}" text-anchor="middle" fill="${colors.nodeText}" font-size="9" class="concept-map-ref-text">📄 ${escapeText(shortName)}</text>`;
        svg += `</g>`;
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
function generateDesktopLayout(chapter, sections, colors, svgNS, isKeySection, refPath) {
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

    // 루트 노드 아래 참조자료 배지
    if (refPath) {
        const badgeY = centerY + rootR + 6;
        const fileName = refPath.split('/').pop().replace(/\.(html|md)$/, '');
        const shortName = truncate(fileName, 20);
        svg += `<g class="concept-map-ref-link" data-ref-html="${escapeAttr(refPath)}" style="cursor:pointer">`;
        svg += `<rect x="${centerX - 100}" y="${badgeY}" width="200" height="24" rx="12" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1" opacity="0.9"/>`;
        svg += `<text x="${centerX}" y="${badgeY + 16}" text-anchor="middle" fill="${colors.nodeText}" font-size="10" class="concept-map-ref-text">📄 ${escapeText(shortName)}</text>`;
        svg += `</g>`;
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
        let svgHtml;
        try {
            svgHtml = generateConceptMap(chapter, { ...opts, mobile });
        } catch (e) {
            console.warn('[concept-map] generateConceptMap failed:', e);
            svgHtml = '';
        }
        if (!svgHtml) {
            container.innerHTML = '';
            container.style.display = 'none';
            const toggle = container.closest('.concept-map-container')?.querySelector('#concept-map-toggle');
            if (toggle) toggle.style.display = 'none';
            return;
        }
        container.innerHTML = svgHtml;
        container.style.display = 'block';
        bindNodes(onNodeClick);
        // 스크롤 indicator 갱신 (DOM 렌더 후)
        requestAnimationFrame(updateScrollIndicator);
    };

    const bindNodes = (clickHandler) => {
        // 참조자료 배지 클릭 바인딩
        container.querySelectorAll('.concept-map-ref-link[data-ref-html]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const refHtmlPath = link.getAttribute('data-ref-html');
                if (refHtmlPath && window.HtmlViewer) {
                    const anchor = link.getAttribute('data-ref-anchor') || '';
                    const line = link.getAttribute('data-ref-line') || '';
                    window.HtmlViewer.openHtmlViewer(refHtmlPath, '', anchor, line);
                }
            });
        });
        // 트리 노드(대분류/중분류/소분류) 용어집 링크 바인딩
        container.querySelectorAll('.concept-map-tree-link[data-glossary]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idxKey = link.getAttribute('data-glossary');
                scrollToGlossary(idxKey, link);
            });
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    link.click();
                }
            });
        });
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
