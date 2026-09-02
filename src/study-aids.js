// src/study-aids.js — 교재 학습 보조 모듈 (기출 필터, 숫자 암기표, 절차 플로우, 비교 시각화)
// 순수 함수 기반, CSP-safe, 외부 의존성 없음

import { escapeHTML as esc } from './sanitize.js';

// --- ② 기출 핵심 요약 ---

/**
 * 챕터에서 기출/중요 마커가 붙은 핵심 라인을 추출합니다.
 * @param {object} chapter - { sections: [{ title, content }] }
 * @returns {{ sectionTitle: string, items: string[] }[]}
 */
export function extractExamHighlights(chapter) {
    const sections = chapter.sections || [];
    const result = [];

    sections.forEach(sec => {
        const lines = (sec.content || '').split('\n');
        const items = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('|') || trimmed.startsWith('---')) return;

            if (trimmed.includes('🔖기출') || trimmed.includes('📌중요')) {
                // 마커 제거하고 의미있는 텍스트만 추출
                let clean = trimmed
                    .replace(/🔖기출/g, '')
                    .replace(/📌중요/g, '')
                    .replace(/^\*\*([^*]+)\*\*/, '$1')
                    .replace(/\*\*/g, '')
                    .replace(/^[-•]\s*/, '')
                    .trim();
                if (clean.length > 2) {
                    // 테이블 행이면 파이프 정리
                    if (clean.startsWith('|')) {
                        clean = clean.replace(/^\|/, '').replace(/\|/g, ' · ').trim();
                    }
                    items.push(clean.substring(0, 120));
                }
            }
        });

        if (items.length > 0) {
            result.push({ sectionTitle: sec.title, items });
        }
    });

    return result;
}

/**
 * 기출 핵심 요약 카드 HTML을 생성합니다.
 */
export function renderExamHighlightCard(chapter) {
    const highlights = extractExamHighlights(chapter);
    if (highlights.length === 0) return '';

    const totalItems = highlights.reduce((acc, h) => acc + h.items.length, 0);

    let html = `
        <div class="study-aid-card exam-highlight-card" id="exam-highlight-card">
            <div class="study-aid-header">
                <i class="fa-solid fa-fire"></i>
                <span>기출 핵심 — ${totalItems}개</span>
                <button class="study-aid-toggle" id="exam-highlight-toggle" title="펼치기/접기">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="study-aid-body expanded" id="exam-highlight-body">
    `;

    highlights.forEach(h => {
        html += `<div class="exam-highlight-section">`;
        html += `<div class="exam-highlight-section-title">${esc(h.sectionTitle)}</div>`;
        html += `<ul class="exam-highlight-list">`;
        h.items.forEach(item => {
            html += `<li>${esc(item)}</li>`;
        });
        html += `</ul>`;
        html += `</div>`;
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

// --- ③ 숫자·기한 자동 추출 ---

const NUMBER_REGEX = /\b(\d+(?:\.\d+)?)\s*(%|ppm|일|세 이하)(?=\s|$|[,.;:)]}'"!?])/g;

const EXCLUDE_PATTERNS = [
    /예상\s*소요\s*시간/,
    /예상\s*학습\s*시간/,
    /예상\s*학습\s*기간/,
    /권장\s*학습\s*시간/,
    /학습\s*소요\s*시간/,
    /예상\s*시간/,
    /페이지\s*수/,
    /글자\s*수/,
    /단어\s*수/,
    /포인트/,
    /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/,
    /사용기한/,
];

/**
 * 챕터에서 숫자+단위 패턴을 추출하여 암기표 데이터를 생성합니다.
 * @param {object} chapter
 * @returns {{ sectionTitle: string, entries: { number: string, unit: string, context: string }[] }[]}
 */
export function extractNumberDrills(chapter) {
    const sections = chapter.sections || [];
    const result = [];
    const globalSeenContext = new Set();

    sections.forEach(sec => {
        const lines = (sec.content || '').split('\n');
        const entries = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('|---')) return;

            // 표 행 제외 (성분별 농도 등 개별 데이터는 암기 대상이 아님)
            if (trimmed.startsWith('|')) return;

            // 비암기 라인 제외 (예상 소요 시간 등)
            if (EXCLUDE_PATTERNS.some(p => p.test(trimmed))) return;

            // 마커 라인 우선
            const isKey = trimmed.includes('🔖기출') || trimmed.includes('📌중요');

            // 라인에서 모든 숫자+단위 추출
            const numbers = [];
            let match;
            const localRegex = new RegExp(NUMBER_REGEX.source, 'g');
            while ((match = localRegex.exec(trimmed)) !== null) {
                numbers.push({ number: match[1], unit: match[2] });
            }
            if (numbers.length === 0) return;

            // 원본 문장 (섹션 제목 + 마커 제거, 숫자 유지)
            let fullContext = trimmed
                .replace(/🔖기출/g, '')
                .replace(/📌중요/g, '')
                .replace(/\*\*/g, '')
                .trim();
            if (sec.title && !fullContext.includes(sec.title)) {
                fullContext = `[${sec.title}] ${fullContext}`;
            }
            if (fullContext.length > 200) {
                fullContext = fullContext.substring(0, 200) + '...';
            }

            // 같은 설명(fullContext)이 이미 있으면 숫자만 추가
            if (globalSeenContext.has(fullContext)) {
                const existing = entries.find(e => e.fullContext === fullContext);
                if (existing) {
                    numbers.forEach(n => {
                        const dup = existing.numbers.some(en => en.number === n.number && en.unit === n.unit);
                        if (!dup) existing.numbers.push(n);
                    });
                }
                return;
            }
            globalSeenContext.add(fullContext);

            entries.push({ numbers, fullContext, isKey });
        });

        if (entries.length > 0) {
            result.push({ sectionTitle: sec.title, entries });
        }
    });

    return result;
}

/**
 * 숫자·기한 암기표 HTML을 생성합니다.
 * 단위별 카테고리 분류 + 기출/중요 우선 표시.
 */
const UNIT_CATEGORIES = [
    { label: '📅 기한 (일)', units: ['일'] },
    { label: '💧 농도·함량', units: ['%', 'ppm'] },
    { label: '👶 연령 기준', units: ['세 이하'] },
];

function categorizeEntry(unit) {
    for (const cat of UNIT_CATEGORIES) {
        if (cat.units.includes(unit)) return cat.label;
    }
    return '기타';
}

export function renderNumberDrillCard(chapter) {
    const drills = extractNumberDrills(chapter);
    if (drills.length === 0) return '';

    // 모든 항목을 평탄화 + 카테고리 분류 (첫 번째 숫자의 단위 기준)
    const allEntries = [];
    drills.forEach(d => {
        d.entries.forEach(e => {
            const category = categorizeEntry(e.numbers[0].unit);
            allEntries.push({ ...e, sectionTitle: d.sectionTitle, category });
        });
    });

    const keyEntries = allEntries.filter(e => e.isKey);
    const normalEntries = allEntries.filter(e => !e.isKey);
    const totalEntries = allEntries.length;
    const keyCount = keyEntries.length;

    let html = `
        <div class="study-aid-card number-drill-card" id="number-drill-card">
            <div class="study-aid-header">
                <i class="fa-solid fa-hashtag"></i>
                <span>숫자·기한 암기표 — ${totalEntries}개${keyCount > 0 ? ` (기출 ${keyCount}개 우선)` : ''}</span>
                <button class="study-aid-toggle" id="number-drill-toggle" title="펼치기/접기">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="study-aid-body expanded" id="number-drill-body">
    `;

    // 항목 렌더링 헬퍼: 여러 숫자를 하나의 카드에 표시
    const renderItem = (e, isKey) => {
        let h = `<div class="number-drill-item${isKey ? ' is-key' : ''}" title="${esc(e.fullContext)}">`;
        h += `<div class="number-drill-values">`;
        e.numbers.forEach(n => {
            h += `<span class="number-drill-value">${esc(n.number)}<small>${esc(n.unit)}</small></span>`;
        });
        h += `</div>`;
        h += `<span class="number-drill-context">${esc(e.fullContext)}</span>`;
        h += `</div>`;
        return h;
    };

    // 1) 기출/중요 항목 — 카테고리별 분류, 항상 펼침
    if (keyEntries.length > 0) {
        html += `<div class="number-drill-section number-drill-key-section">`;
        html += `<div class="number-drill-section-title">📌 기출·중요 숫자 (${keyCount}개)</div>`;

        const keyByCat = {};
        keyEntries.forEach(e => {
            if (!keyByCat[e.category]) keyByCat[e.category] = [];
            keyByCat[e.category].push(e);
        });

        UNIT_CATEGORIES.forEach(cat => {
            const items = keyByCat[cat.label];
            if (!items || items.length === 0) return;
            html += `<div class="number-drill-subsection">`;
            html += `<div class="number-drill-subsection-title">${cat.label} <small>(${items.length})</small></div>`;
            html += `<div class="number-drill-grid">`;
            items.forEach(e => { html += renderItem(e, true); });
            html += `</div></div>`;
        });

        html += `</div>`;
    }

    // 2) 일반 항목 — 카테고리별 분류, 기본 접힘
    if (normalEntries.length > 0) {
        html += `<div class="number-drill-section">`;
        html += `<div class="number-drill-section-title number-drill-normal-toggle" id="number-drill-normal-toggle">`;
        html += `전체 숫자 (${normalEntries.length}개) <i class="fa-solid fa-chevron-down" style="font-size:0.7rem;margin-left:0.3rem;"></i>`;
        html += `</div>`;
        html += `<div class="number-drill-normal-grid" id="number-drill-normal-grid" style="display:none;">`;

        const normalByCat = {};
        normalEntries.forEach(e => {
            if (!normalByCat[e.category]) normalByCat[e.category] = [];
            normalByCat[e.category].push(e);
        });

        UNIT_CATEGORIES.forEach(cat => {
            const items = normalByCat[cat.label];
            if (!items || items.length === 0) return;
            html += `<div class="number-drill-subsection">`;
            html += `<div class="number-drill-subsection-title">${cat.label} <small>(${items.length})</small></div>`;
            html += `<div class="number-drill-grid">`;
            items.forEach(e => { html += renderItem(e, false); });
            html += `</div></div>`;
        });

        html += `</div>`;
        html += `</div>`;
    }

    html += `
            </div>
        </div>
    `;

    return html;
}

// --- ④ 절차 플로우 ---

const PROCEDURE_KEYWORDS = ['신고', '변경신고', '교육', '보수교육', '폐업신고', '승인', '신청', '등록', '갱신', '이전신고'];

/**
 * 챕터에서 절차성 섹션을 감지하고 플로우 데이터를 추출합니다.
 * @param {object} chapter
 * @returns {{ title: string, steps: { label: string, detail: string }[] } | null}
 */
export function detectProcedureFlow(chapter) {
    const sections = chapter.sections || [];

    for (const sec of sections) {
        const content = sec.content || '';
        const titleLower = sec.title.toLowerCase();

        // 절차 키워드가 제목에 있거나 본문에 충분히 많으면
        const titleMatch = PROCEDURE_KEYWORDS.some(kw => sec.title.includes(kw));
        const contentMatchCount = PROCEDURE_KEYWORDS.reduce((acc, kw) => acc + (content.includes(kw) ? 1 : 0), 0);

        if (!titleMatch && contentMatchCount < 2) continue;

        const steps = [];
        const lines = content.split('\n');

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('|---')) return;

            // 번호가 있는 리스트 항목 (1. 2. 3. 또는 ① ② ③)
            const numMatch = trimmed.match(/^(?:\d+[.)]|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)\s*(.+)/);
            if (numMatch) {
                const label = numMatch[1]
                    .replace(/🔖기출/g, '')
                    .replace(/📌중요/g, '')
                    .replace(/\*\*/g, '')
                    .trim();
                if (label.length > 3) {
                    // 기한 추출
                    const deadlineMatch = label.match(/(\d+일|\d+개월|\d+년|즉시|지체 없이)/);
                    const detail = deadlineMatch ? deadlineMatch[0] : '';
                    steps.push({ label: label.substring(0, 80), detail });
                }
            }
        });

        if (steps.length >= 2) {
            return { title: sec.title, steps };
        }
    }

    return null;
}

/**
 * 절차 플로우를 순수 SVG로 렌더링합니다.
 */
export function renderProcedureFlowCard(chapter) {
    const flow = detectProcedureFlow(chapter);
    if (!flow) return '';

    const steps = flow.steps;
    const stepH = 50;
    const stepGap = 20;
    const arrowH = 24;
    const svgWidth = 320;
    const svgHeight = steps.length * (stepH + arrowH) - arrowH + 20;
    const centerX = svgWidth / 2;
    const boxW = 260;
    const boxX = centerX - boxW / 2;

    let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="procedure-flow-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(flow.title)} 절차 플로우">`;

    steps.forEach((step, i) => {
        const y = 10 + i * (stepH + arrowH);
        const isKey = step.detail !== '';

        // 박스
        svg += `<rect x="${boxX}" y="${y}" width="${boxW}" height="${stepH}" rx="8" ry="8" fill="var(--bg-card)" stroke="${isKey ? 'var(--warning)' : 'var(--border-color)'}" stroke-width="1.5" class="procedure-step-rect"/>`;

        // 스텝 번호 원
        svg += `<circle cx="${boxX + 20}" cy="${y + stepH / 2}" r="14" fill="var(--color-primary)" class="procedure-step-circle"/>`;
        svg += `<text x="${boxX + 20}" y="${y + stepH / 2 + 4}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">${i + 1}</text>`;

        // 라벨
        const label = step.label.length > 28 ? step.label.substring(0, 27) + '…' : step.label;
        svg += `<text x="${boxX + 42}" y="${y + stepH / 2 + 4}" fill="var(--color-text-main)" font-size="11" class="procedure-step-text">${esc(label)}</text>`;

        // 기한 배지
        if (step.detail) {
            const badgeX = boxX + boxW - 50;
            svg += `<rect x="${badgeX}" y="${y + 8}" width="42" height="18" rx="9" fill="var(--warning)" opacity="0.15"/>`;
            svg += `<text x="${badgeX + 21}" y="${y + 20}" text-anchor="middle" fill="var(--warning)" font-size="9" font-weight="600">${esc(step.detail)}</text>`;
        }

        // 화살표 (다음 스텝이 있으면)
        if (i < steps.length - 1) {
            const arrowY = y + stepH + 4;
            svg += `<path d="M ${centerX} ${arrowY} L ${centerX} ${arrowY + arrowH - 8}" stroke="var(--border-color)" stroke-width="2" fill="none"/>`;
            svg += `<path d="M ${centerX - 5} ${arrowY + arrowH - 10} L ${centerX} ${arrowY + arrowH - 4} L ${centerX + 5} ${arrowY + arrowH - 10}" stroke="var(--border-color)" stroke-width="2" fill="none"/>`;
        }
    });

    svg += `</svg>`;

    return `
        <div class="study-aid-card procedure-flow-card" id="procedure-flow-card">
            <div class="study-aid-header">
                <i class="fa-solid fa-route"></i>
                <span>절차 플로우 — ${esc(flow.title)}</span>
                <button class="study-aid-toggle" id="procedure-flow-toggle" title="펼치기/접기">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="study-aid-body expanded" id="procedure-flow-body">
                ${svg}
            </div>
        </div>
    `;
}

// --- ⑤ 비교·대조 시각화 ---

/**
 * 행정처분 표를 감지하고 계단형 데이터로 추출합니다.
 * @param {object} chapter
 * @returns {{ title: string, headers: string[], rows: { label: string, penalties: string[] }[] } | null}
 */
export function detectAdminPenalty(chapter) {
    const sections = chapter.sections || [];

    for (const sec of sections) {
        const content = sec.content || '';
        if (!content.includes('행정처분') && !sec.title.includes('행정처분')) continue;

        const lines = content.split('\n');
        let inTable = false;
        let headers = [];
        let rows = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('|') && !trimmed.startsWith('|---')) {
                const cells = trimmed.split('|').filter(c => c.trim()).map(c => c.trim().replace(/\*\*/g, ''));

                if (!inTable) {
                    // 헤더 행 감지: 1차, 2차 등을 포함
                    if (cells.some(c => c.includes('차') || c.includes('위반') || c.includes('처분'))) {
                        headers = cells;
                        inTable = true;
                    }
                } else {
                    // 데이터 행
                    if (cells.length >= 2) {
                        const label = cells[0];
                        const penalties = cells.slice(1);
                        if (label && !label.includes('---')) {
                            rows.push({ label, penalties });
                        }
                    }
                }
            } else if (inTable && !trimmed.startsWith('|')) {
                inTable = false;
            }
        });

        // 헤더에 차수가 있거나 행이 2개 이상이면
        if (rows.length >= 2 && headers.length >= 2) {
            return { title: sec.title, headers, rows };
        }
    }

    return null;
}

/**
 * 행정처분 계단형 시각화 HTML을 생성합니다.
 */
export function renderAdminPenaltyCard(chapter) {
    const penalty = detectAdminPenalty(chapter);
    if (!penalty) return '';

    const { headers, rows } = penalty;
    const maxPenalties = Math.max(...rows.map(r => r.penalties.length));

    let html = `
        <div class="study-aid-card admin-penalty-card" id="admin-penalty-card">
            <div class="study-aid-header">
                <i class="fa-solid fa-stairs"></i>
                <span>행정처분 계단 — ${esc(penalty.title)}</span>
                <button class="study-aid-toggle" id="admin-penalty-toggle" title="펼치기/접기">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="study-aid-body expanded" id="admin-penalty-body">
                <div class="admin-penalty-table-wrapper">
                    <table class="admin-penalty-table">
                        <thead>
                            <tr>
                                <th class="sticky-col">${esc(headers[0] || '위반내용')}</th>
                                ${headers.slice(1).map(h => `<th>${esc(h)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
    `;

    rows.forEach((row, i) => {
        const isKey = row.label.includes('🔖기출') || row.label.includes('📌중요');
        const cleanLabel = row.label.replace(/🔖기출/g, '').replace(/📌중요/g, '').trim();
        html += `<tr class="${isKey ? 'is-key' : ''} ${i % 2 === 0 ? 'zebra' : ''}">`;
        html += `<td class="sticky-col">${esc(cleanLabel)}</td>`;
        row.penalties.forEach(p => {
            const cleanP = p.replace(/🔖기출/g, '').replace(/📌중요/g, '').trim();
            html += `<td>${esc(cleanP)}</td>`;
        });
        html += `</tr>`;
    });

    html += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    return html;
}

// --- ② 기출 필터 토글 ---

/**
 * 기출 필터 토글 버튼 HTML을 생성합니다.
 */
export function renderExamFilterToggle() {
    return `
        <button class="exam-filter-btn" id="exam-filter-btn" title="기출·중요 마커가 있는 섹션만 강조">
            <i class="fa-solid fa-filter"></i>
            <span>기출만 보기</span>
        </button>
    `;
}

/**
 * 섹션이 기출/중요 마커를 포함하는지 확인합니다.
 */
export function isKeySection(sec) {
    const c = sec.content || '';
    const t = sec.title || '';
    const text = c + '\n' + t;
    return text.includes('🔖기출') || text.includes('📌중요') || /🎯\s*기출/.test(text);
}

/**
 * 기출 필터를 토글합니다. 비기출 섹션에 dim 클래스를 추가/제거합니다.
 * @param {HTMLElement} container - 교재 리더 컨테이너
 * @param {object} chapter
 * @param {boolean} active - 필터 활성화 여부
 */
export function applyExamFilter(container, chapter, active) {
    if (!container) return;
    const sections = chapter.sections || [];

    sections.forEach((sec, idx) => {
        const sectionEl = container.querySelector(`#reader-section-${idx}`);
        if (!sectionEl) return;

        if (active && !isKeySection(sec)) {
            sectionEl.classList.add('exam-filter-dimmed');
        } else {
            sectionEl.classList.remove('exam-filter-dimmed');
        }
    });
}

// --- 통합 렌더링 ---

/**
 * 모든 학습 보조 카드를 통합하여 HTML을 생성합니다.
 * 개념 맵 아래, 섹션 카드 위에 삽입됩니다.
 */
export function renderStudyAids(chapter) {
    let html = '';

    // 기출 핵심 요약
    const highlightCard = renderExamHighlightCard(chapter);
    if (highlightCard) html += highlightCard;

    // 숫자·기한 암기표
    const numberCard = renderNumberDrillCard(chapter);
    if (numberCard) html += numberCard;

    return html;
}

/**
 * 학습 보조 카드들의 토글 이벤트를 바인딩합니다.
 * @param {HTMLElement} container
 */
export function bindStudyAidToggles(container) {
    if (!container) return;

    // 모든 study-aid-toggle 버튼에 공통 바인딩
    container.querySelectorAll('.study-aid-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.study-aid-card');
            if (!card) return;
            const body = card.querySelector('.study-aid-body');
            if (!body) return;
            const isCollapsed = body.classList.toggle('collapsed');
            body.classList.toggle('expanded', !isCollapsed);
            btn.classList.toggle('collapsed', isCollapsed);
        });
    });

    // 숫자·기한 암기표: 일반 항목 토글
    const normalToggle = container.querySelector('#number-drill-normal-toggle');
    if (normalToggle && !normalToggle.dataset.bound) {
        normalToggle.dataset.bound = 'true';
        normalToggle.style.cursor = 'pointer';
        normalToggle.addEventListener('click', () => {
            const grid = container.querySelector('#number-drill-normal-grid');
            if (!grid) return;
            const isHidden = grid.style.display === 'none';
            grid.style.display = isHidden ? 'grid' : 'none';
            const icon = normalToggle.querySelector('i');
            if (icon) icon.style.transform = isHidden ? 'rotate(180deg)' : '';
        });
    }
}
