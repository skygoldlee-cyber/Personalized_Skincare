// src/study-aids.js — 교재 학습 보조 모듈 (기출 필터, 숫자 암기표, 절차 플로우, 비교 시각화)
// @spec SA-01~05
// 순수 함수 기반, CSP-safe, 외부 의존성 없음

import { escapeHTML as esc } from './sanitize.js';  // escapeHTML을 esc로 alias하여 사용
import { PATHS } from './paths.js';

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

            if (trimmed.includes('🔖기출') || trimmed.includes('📌중요') || /★\s*필수/.test(trimmed)) {
                // 마커 제거하고 의미있는 텍스트만 추출
                let clean = trimmed
                    .replace(/🔖기출/g, '')
                    .replace(/📌중요/g, '')
                    .replace(/★\s*필수/g, '')
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
function renderExamHighlightCard(chapter) {
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

// --- ③ 중요 숫자 암기표 (JSON 기반) ---

const NUMBER_DRILL_CACHE = {};

/**
 * 과목별 JSON 파일에서 숫자 암기표 데이터를 로드합니다.
 * @param {string} subjId - 과목 키 (manifest.subjects[].key — 시험마다 상이)
 * @returns {Promise<{ numbers: {number: string, unit: string}[], context: string, isKey: boolean, category?: string }[]>}
 */
export async function loadNumberDrills(subjId) {
    if (NUMBER_DRILL_CACHE[subjId]) return NUMBER_DRILL_CACHE[subjId];
    try {
        const resp = await fetch(PATHS.NUMBER_DRILLS(subjId));
        if (!resp.ok) return [];
        const data = await resp.json();
        if (!Array.isArray(data)) return [];
        NUMBER_DRILL_CACHE[subjId] = data;
        return data;
    } catch (e) {
        return [];
    }
}

/**
 * 중요 숫자 암기표 HTML을 생성합니다.
 * 단위별 카테고리 분류 + 기출/중요 우선 표시.
 */
const UNIT_CATEGORIES = [
    { label: '📅 기한·기간', units: ['일', '개월', '년', '주', '시간', '분', '초'] },
    { label: '💧 농도·함량', units: ['%', 'ppm', '㎍/g', 'IU/g'] },
    { label: '🧪 시험·측정', units: ['개/g', '회/hr', '℃', 'mmAq', '㎛', '로트', '개소', 'cm', 'mm', 'pH', '층', '배', '가닥', '회', '포인트', 'SPF', 'PA', '종', '요소', '단계', 'm²', 'kg', '비율', 'L/일', 'g/일', 'Å', 'nm', '개'] },
    { label: '🧬 제조·원료', units: ['HLB'] },
    { label: '💰 금액', units: ['원'] },
];

function categorizeEntry(unit) {
    for (const cat of UNIT_CATEGORIES) {
        if (cat.units.includes(unit)) return cat.label;
    }
    return '기타';
}

async function renderNumberDrillCard(subjId) {
    const entries = await loadNumberDrills(subjId);
    if (entries.length === 0) return '';

    // 카테고리 분류 (JSON category 필드 우선, 없으면 첫 번째 숫자 단위 기준)
    const allEntries = entries.map(e => ({
        ...e,
        category: e.category || categorizeEntry(e.numbers[0].unit)
    }));

    const keyEntries = allEntries.filter(e => e.isKey);
    const normalEntries = allEntries.filter(e => !e.isKey);
    const totalEntries = allEntries.length;
    const keyCount = keyEntries.length;

    let html = `
        <div class="study-aid-card number-drill-card" id="number-drill-card">
            <div class="study-aid-header">
                <i class="fa-solid fa-hashtag"></i>
                <span>중요 숫자 암기표 — ${totalEntries}개${keyCount > 0 ? ` (기출 ${keyCount}개 우선)` : ''}</span>
                <button class="study-aid-toggle" id="number-drill-toggle" title="펼치기/접기">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div class="study-aid-body expanded" id="number-drill-body">
    `;

    // 항목 렌더링 헬퍼: 여러 숫자를 하나의 카드에 표시
    const renderItem = (e, isKey) => {
        let h = `<div class="number-drill-item${isKey ? ' is-key' : ''}" title="${esc(e.context)}">`;
        h += `<div class="number-drill-values">`;
        e.numbers.forEach(n => {
            h += `<span class="number-drill-value">${esc(n.number)}<small>${esc(n.unit)}</small></span>`;
        });
        h += `</div>`;
        h += `<span class="number-drill-context">${esc(e.context)}</span>`;
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
        html += `<div class="number-drill-normal-grid is-hidden" id="number-drill-normal-grid">`;

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
        const rows = [];

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
    return text.includes('🔖기출') || text.includes('📌중요') || /🎯\s*기출/.test(text) || /★\s*필수/.test(text);
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
export async function renderStudyAids(chapter, subjId) {
    let html = '';

    // 기출 핵심 요약
    const highlightCard = renderExamHighlightCard(chapter);
    if (highlightCard) html += highlightCard;

    // 중요 숫자 암기표 (JSON 기반)
    if (subjId) {
        const numberCard = await renderNumberDrillCard(subjId);
        if (numberCard) html += numberCard;
    }

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

    // 중요 숫자 암기표: 일반 항목 토글
    const normalToggle = /** @type {HTMLElement|null} */ (container.querySelector('#number-drill-normal-toggle'));
    if (normalToggle && !normalToggle.dataset.bound) {
        normalToggle.dataset.bound = 'true';
        normalToggle.style.cursor = 'pointer';
        normalToggle.addEventListener('click', () => {
            const grid = container.querySelector('#number-drill-normal-grid');
            if (!grid) return;
            const isHidden = grid.classList.contains('is-hidden');
            grid.classList.toggle('is-hidden');
            const icon = normalToggle.querySelector('i');
            if (icon) icon.style.transform = isHidden ? 'rotate(180deg)' : '';
        });
    }
}
