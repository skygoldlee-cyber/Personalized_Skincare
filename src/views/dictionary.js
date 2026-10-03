// src/views/dictionary.js - 지식DB(엔티티) 검색 사전 뷰 로직 및 그리드 스페이서 가상 스크롤 구현
// @spec DI-01~08,DI-10,PF-09
// 스키마 드리븐 — manifest.knowledge → registry.knowledge가 엔티티 필드·필터·CSV를 선언한다.
// registry.knowledge 미선언 시험은 사전 뷰가 "데이터셋 미설정" 안내로 처리된다 (화장품 폴백 없음).
// 자가 등록: schema.customKey(STORAGE_KEYS 멤버명) 선언 시 로컬 등록 항목을 병합한다 —
// 저장소 키 계약 레지스트리 경유라 platform → domain import 없이 격리가 유지된다.
import { state } from '../state.js';
import { esc } from '../sanitize.js';
import { getChosung, todayKey, normalizeEntityName } from '../utils.js';
import { hasFeature } from '../exam-context.js';
import { toCsv, downloadCsv } from '../csv-utils.js';
import { showToast } from '../ui-utils.js';
import { DataLoader } from '../data-loader.js';
import { STORAGE_KEYS } from '../storage-keys.js';
import { getJSON } from '../storage.js';

/**
 * 지식DB 엔티티 스키마 기본값 — 화장품 원료 사전과 동일한 동작.
 * 다른 시험은 manifest.knowledge로 필드 매핑·필터·CSV를 재선언한다.
 */
const DEFAULT_KNOWLEDGE = {
    registryKey: 'ingredients',
    global: 'INGREDIENTS_DATA',
    entityUnit: '원료',
    filterField: 'type',
    fields: {
        title: 'name',
        subtitle: 'engName',
        subtitleEmpty: '영문명 없음',
        search: ['name', 'engName', 'category'],
        chosungField: 'name'
    },
    badge: {
        field: 'type',
        defaultLabel: '사용 가능',
        labels: { approved: '사용 가능', restricted: '사용 제한', banned: '사용 금지' }
    },
    filters: [
        { key: 'all', label: '전체 성분' },
        { key: 'approved', label: '사용 가능 원료', icon: 'fa-circle-check', color: 'var(--color-success)' },
        { key: 'restricted', label: '사용 제한 원료', icon: 'fa-triangle-exclamation', color: 'var(--color-warning)' },
        { key: 'banned', label: '사용 금지 원료', icon: 'fa-ban', color: 'var(--color-danger)' }
    ],
    details: [
        { key: 'category', label: '카테고리', empty: '기타' },
        { key: 'description', label: '설명/특성', empty: '-', wide: true },
        { key: 'limit', label: '배합 한도', empty: '제한 없음', wide: true },
        { key: 'tip', tip: true }
    ],
    action: {
        feature: 'formula',
        click: 'formulaAddIngredient',
        arg: 'name',
        label: '포뮬러에 추가',
        title: '배합 계산기 처방에 이 원료 추가',
        icon: 'fa-plus'
    },
    csv: {
        filename: 'ingredients',
        headers: ['원료명', '영문명', '유형', '유형코드', '카테고리', '배합한도', '설명', 'TIP'],
        fields: ['name', 'engName', { badgeLabel: 'type' }, 'type', 'category', 'limit', 'description', 'tip']
    }
};

/**
 * 활성 시험의 지식DB 스키마 — registry.knowledge 선언에 DEFAULT_KNOWLEDGE 기본값 병합.
 * knowledge 미선언 시험은 null 반환 → 사전 뷰가 "데이터셋 미설정" 안내로 처리한다.
 * @returns {Object|null}
 */
function dictSchema() {
    const reg = /** @type {any} */ (DataLoader.registry) || {};
    const k = reg.knowledge;
    return (k && typeof k === 'object') ? { ...DEFAULT_KNOWLEDGE, ...k } : null;
}

/**
 * 자가 등록 항목 — schema.customKey(STORAGE_KEYS 멤버명) 선언 시에만 로드.
 * 공식 동명(정규화) 항목에는 _superseded를 부여한다 — '공식 등록됨' 배지 (DI-08).
 */
function customItems(schema, official) {
    if (!schema || !schema.customKey) return [];
    const key = STORAGE_KEYS[schema.customKey];
    const items = key ? getJSON(key) : [];
    if (!Array.isArray(items) || !items.length) return [];
    const titleField = schema.fields && schema.fields.title || 'name';
    const officialNorm = new Set(official.map(i => normalizeEntityName(i[titleField])));
    return items
        .filter(i => i && i.name)
        .map(i => ({ ...i, custom: true, _superseded: officialNorm.has(normalizeEntityName(i.name)) }));
}

/** 엔티티 배열 — 스키마의 global 해석 + 자가 등록 병합 (customKey 선언 시험만). */
function dictDb(schema) {
    if (!schema) return [];
    const official = DataLoader.getKnowledgeItems();
    const custom = customItems(schema, official);
    return custom.length ? [...official, ...custom] : official;
}

/** 배지 필드값 → 표시 라벨 */
function badgeLabel(schema, value) {
    const b = schema.badge || {};
    return (b.labels && b.labels[value]) || b.defaultLabel || String(value || '');
}

export const dictState = {
    query: '',
    filter: 'all'
};

// 가상 스크롤 관련 상태
let isScrollBound = false;
let currentFilteredList = [];

/** 검색어·필터를 적용한 엔티티 목록 — 렌더와 CSV보내기가 공유 */
function filterItems(db, query, filter, schema) {
    const q = (query || '').toLowerCase().trim();
    const f = schema.fields || {};
    const searchFields = f.search || ['name'];
    const chosungField = f.chosungField || searchFields[0];
    const filterField = schema.filterField;
    return db.filter(item => {
        if (filter !== 'all' && filterField && item[filterField] !== filter) return false;
        if (!q) return true;
        if (searchFields.some(key => String(item[key] || '').toLowerCase().includes(q))) return true;
        const base = String(item[chosungField] || '').toLowerCase();
        return getChosung(base).includes(getChosung(q));
    });
}

/** 필터 버튼을 스키마에서 렌더 — dictState.filter에 맞춰 활성 클래스 부여 */
function renderFilterButtons(schema) {
    const wrap = document.querySelector('.dict-filter-buttons');
    if (!wrap || !Array.isArray(schema.filters) || !schema.filters.length) return;
    wrap.innerHTML = schema.filters.map(f => {
        const active = dictState.filter === f.key ? ' active-filter' : '';
        const icon = f.icon
            ? `<i class="fa-solid ${f.icon}"${f.color ? ` style="color:${f.color}"` : ''} aria-hidden="true"></i> `
            : '';
        return `<button class="btn btn-secondary${active}" data-filter="${esc(f.key)}" data-click="setDictFilter" data-arg="${esc(f.key)}">${icon}${esc(f.label)}</button>`;
    }).join('');
}

/** 자가 등록 진입 버튼 — schema.customKey 선언 시험에만 노출 (DI-06) */
function renderCustomAddButton(schema) {
    const row = document.querySelector('#dictionary-view .dictionary-control-panel .flex-center');
    if (!row) return;
    let btn = document.getElementById('dict-custom-add');
    if (!schema.customKey) { if (btn) btn.remove(); return; }
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'dict-custom-add';
        /** @type {HTMLButtonElement} */ (btn).type = 'button';
        btn.className = 'btn btn-secondary flex-center gap-2';
        btn.setAttribute('data-click', 'customIngAdd');
        btn.setAttribute('title', '공식 DB에 없는 항목을 자가 등록 — 사전·배합 검증에 반영');
        btn.innerHTML = `<i class="fa-solid fa-user-pen" aria-hidden="true"></i> ${esc(schema.customLabel || '항목 추가')}`;
        row.appendChild(btn);
    }
}

/** 헤더 텍스트·검색 placeholder를 스키마에서 적용 (없으면 HTML 기본값 유지) */
function applyDictHeader(schema) {
    const h = schema.header;
    if (!h) return;
    const titleEl = document.getElementById('dict-title');
    const subEl = document.getElementById('dict-subtitle');
    const noteEl = document.getElementById('dict-note');
    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('dict-search-input'));
    if (titleEl && h.title) titleEl.textContent = h.title;
    if (subEl && h.subtitle) subEl.textContent = h.subtitle;
    if (noteEl) {
        if (h.note) {
            noteEl.innerHTML = h.note;   // 작성자 신뢰 설정 — <strong> 등 인라인 마크업 허용
            noteEl.classList.remove('is-hidden');
        } else {
            noteEl.classList.add('is-hidden');
        }
    }
    if (input && h.searchPlaceholder) input.placeholder = h.searchPlaceholder;
}

/**
 * 지식DB 사전을 렌더링하고 가상 스크롤을 초기화합니다.
 */
export function renderDictionary() {
    const container = document.getElementById('dict-results-container');
    if (!container) return;

    const schema = dictSchema();
    if (!schema) {
        const verEl = document.getElementById('dict-db-version');
        if (verEl) verEl.textContent = '';
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-text-muted);">이 시험에는 사전 데이터셋이 설정되어 있지 않습니다.</div>';
        return;
    }
    applyDictHeader(schema);
    renderFilterButtons(schema);
    renderCustomAddButton(schema);

    const reg = /** @type {any} */ (DataLoader.registry) || {};
    const meta = reg[(schema.registryKey)] || reg.ingredients || null;
    const verEl = document.getElementById('dict-db-version');
    if (verEl) {
        const cnt = meta && meta.stats && meta.stats.count;
        const customCnt = customItems(schema, DataLoader.getKnowledgeItems()).length;
        verEl.textContent = meta && meta.version
            ? `${schema.entityUnit || ''} DB v${meta.version}${cnt ? ` · ${Number(cnt).toLocaleString('ko-KR')}종` : ''}${customCnt ? ` +자가 ${customCnt}` : ''}`.trim()
            : '';
    }

    const db = dictDb(schema);
    if (db.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-text-muted);">${esc(schema.entityUnit || '')} 데이터베이스가 비어있습니다. 빌드 스크립트를 실행해 주세요.</div>`;
        return;
    }

    currentFilteredList = filterItems(db, dictState.query, dictState.filter, schema);

    if (currentFilteredList.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-text-muted);"><i class="fa-solid fa-face-sad-tear" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i> 검색 결과가 없습니다. 다른 검색어를 입력해보세요.</div>';
        return;
    }

    // 가상 스크롤 이벤트 바인딩
    setupDictionaryVirtualScroll();

    // 가상 스크롤을 이용한 드로잉 실행
    renderDictionaryVirtual();
}

/**
 * 그리드 스페이서 가상 스크롤 엔진
 */
function renderDictionaryVirtual() {
    const container = document.getElementById('dict-results-container');
    const scrollEl = document.querySelector('.main-content');
    if (!container || !scrollEl) return;

    const schema = dictSchema();
    if (!schema) return;

    // 결과 수가 100개 미만이면 일반 렌더링
    if (currentFilteredList.length < 100) {
        container.innerHTML = '';
        currentFilteredList.forEach(item => {
            container.appendChild(createEntityCard(item, schema));
        });
        return;
    }

    const containerWidth = container.clientWidth;
    const gap = 24; // 1.5rem = 24px
    const itemHeight = 110; // 예상 카드 높이
    const rowHeight = itemHeight + gap;
    const colWidthMin = 280;
    const colCount = Math.max(1, Math.floor((containerWidth + gap) / (colWidthMin + gap)));

    // 스크롤 상단 위치 계산
    const rect = container.getBoundingClientRect();
    const scrollRect = scrollEl.getBoundingClientRect();
    const containerOffsetTop = rect.top - scrollRect.top + scrollEl.scrollTop;

    const containerScrollTop = Math.max(0, scrollEl.scrollTop - containerOffsetTop);

    // 노출 범위 계산
    const startRow = Math.max(0, Math.floor(containerScrollTop / rowHeight) - 1);
    const visibleRows = Math.ceil(scrollEl.clientHeight / rowHeight) + 2;
    const endRow = Math.min(Math.ceil(currentFilteredList.length / colCount), startRow + visibleRows);

    const startIndex = startRow * colCount;
    const endIndex = Math.min(currentFilteredList.length, endRow * colCount);

    const topHeight = startRow * rowHeight;
    const bottomHeight = Math.max(0, Math.ceil(currentFilteredList.length / colCount) - endRow) * rowHeight;

    // DOM 갱신
    container.innerHTML = '';

    // 1. 상단 그리드 스페이서
    const topSpacer = document.createElement('div');
    topSpacer.style.cssText = `grid-column: 1 / -1; height: ${topHeight}px; margin: 0; padding: 0; border: none; background: transparent;`;
    container.appendChild(topSpacer);

    // 2. 가시 범위 내 엔티티 카드 생성 및 삽입
    const visibleItems = currentFilteredList.slice(startIndex, endIndex);
    visibleItems.forEach(item => {
        container.appendChild(createEntityCard(item, schema));
    });

    // 3. 하단 그리드 스페이서
    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.cssText = `grid-column: 1 / -1; height: ${bottomHeight}px; margin: 0; padding: 0; border: none; background: transparent;`;
    container.appendChild(bottomSpacer);
}

/**
 * 개별 엔티티 카드 DOM 요소를 생성합니다 (스키마 드리븐).
 */
function createEntityCard(item, schema) {
    const card = document.createElement('div');
    card.className = 'dict-card';

    const f = schema.fields || {};
    const badgeField = schema.badge && schema.badge.field;
    const badgeVal = badgeField ? item[badgeField] : null;
    // _superseded: 고시 개정으로 공식 등록된 자가 항목 — 공식 우선 표기 (DI-08)
    const badgeText = item._superseded ? '공식 등록됨' : (badgeField ? badgeLabel(schema, badgeVal) : '');
    const badgeCls = item._superseded ? 'superseded' : (badgeVal == null ? '' : String(badgeVal));

    const detailRows = (schema.details || []).map(d => {
        const val = item[d.key];
        if (d.tip) {
            return val ? `<div class="dict-card-tip"><strong>${esc(d.label || 'TIP')}:</strong> ${esc(val)}</div>` : '';
        }
        const wide = d.wide ? ' dict-detail-item--col' : '';
        return `<div class="dict-detail-item${wide}"><span class="dict-detail-label">${esc(d.label || d.key)}</span><span class="dict-detail-value">${esc(val || d.empty || '-')}</span></div>`;
    }).join('');

    const a = schema.action;
    const actionBtn = (a && (!a.feature || hasFeature(a.feature)))
        ? `<button class="btn btn-primary btn-sm dict-add-btn" data-click="${esc(a.click)}" data-arg="${esc(String(item[a.arg] ?? ''))}" title="${esc(a.title || a.label)}"><i class="fa-solid ${esc(a.icon || 'fa-plus')}" aria-hidden="true"></i> ${esc(a.label)}</button>`
        : '';
    // 자가 등록 항목은 수정 액션 제공 — 삭제는 수정 모달 안 (DI-06)
    const customBtn = item.custom
        ? `<button class="btn btn-secondary btn-sm" data-click="customIngEdit" data-arg="${esc(item.id)}" title="자가 등록 항목 수정"><i class="fa-solid fa-pen" aria-hidden="true"></i> 수정</button>`
        : '';

    card.innerHTML = `
        <div class="dict-card-header">
            <div class="dict-card-title">${esc(item[f.title] ?? '')}</div>
            ${badgeField ? `<span class="dict-badge ${esc(badgeCls)}">${badgeText}</span>` : ''}
        </div>
        <div class="dict-card-subtitle">${esc(item[f.subtitle] || f.subtitleEmpty || '')}</div>
        <div class="dict-card-details is-hidden">
            ${detailRows}
            ${actionBtn}
            ${customBtn}
        </div>
    `;

    card.addEventListener('click', (e) => {
        // 카드 내부의 위임 버튼(포뮬러 추가 등) 클릭은 상세 토글과 무관
        if (!(e.target instanceof Element) || e.target.closest('[data-click]')) return;
        const details = card.querySelector('.dict-card-details');
        if (!details) return;
        if (details.classList.contains('is-hidden')) {
            details.classList.remove('is-hidden');
        } else {
            details.classList.add('is-hidden');
        }
    });

    return card;
}

/**
 * 스크롤바 이동 시 동작하는 리스너 등록
 */
function setupDictionaryVirtualScroll() {
    if (isScrollBound) return;
    const scrollEl = document.querySelector('.main-content');
    if (!scrollEl) return;

    scrollEl.addEventListener('scroll', () => {
        if (state.currentView === 'dictionary-view') {
            renderDictionaryVirtual();
        }
    });

    window.addEventListener('resize', () => {
        if (state.currentView === 'dictionary-view') {
            renderDictionary();
        }
    });

    isScrollBound = true;
}

/**
 * 지식DB 사전 검색 필터링
 */
export function filterDictionary() {
    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('dict-search-input'));
    if (input) {
        dictState.query = input.value;
        renderDictionary();
    }
}

/**
 * 카테고리 필터 변경
 */
export function setDictFilter(filterType) {
    dictState.filter = filterType;

    const buttons = document.querySelectorAll('.dict-filter-buttons button');
    buttons.forEach(btn => {
        const dataFilter = btn.getAttribute('data-filter');
        if (dataFilter === filterType) {
            btn.classList.add('active-filter');
        } else {
            btn.classList.remove('active-filter');
        }
    });

    renderDictionary();
}

/**
 * 검색어 초기화
 */
export function clearDictSearch() {
    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('dict-search-input'));
    if (input) {
        input.value = '';
        dictState.query = '';
        renderDictionary();
    }
}

/**
 * 지식DB CSV보내기 — 현재 검색어·필터가 적용된 목록을 저장한다.
 * scope === 'all'이면 검색어·필터 무관하게 전체 DB를 저장한다 (DI-10).
 * csv.fields 항목이 {"badgeLabel": "<field>"}이면 배지 라벨로 치환된다.
 * @param {string} [scope] 'all'이면 전체 DB
 */
export function dictExportCsv(scope) {
    const schema = dictSchema();
    if (!schema) { showToast('사전 데이터가 없습니다.', 'warning'); return; }
    const db = dictDb(schema);
    // 렌더된 목록 대신 현재 검색어·필터로 재계산 — 렌더 순서와 무관하게 정확
    const all = scope === 'all';
    const rows = all ? db : filterItems(db, dictState.query, dictState.filter, schema);
    const unit = schema.entityUnit || '항목';
    if (!rows.length) { showToast(`보낼 ${unit} 데이터가 없습니다.`, 'warning'); return; }
    const reg = /** @type {any} */ (DataLoader.registry) || {};
    const meta = reg[schema.registryKey] || reg.ingredients || null;
    const ver = meta && meta.version ? `_v${meta.version}` : '';
    const csv = schema.csv || {};
    const fields = csv.fields || [];
    downloadCsv(
        toCsv([...(csv.headers || [])], rows, item => fields.map(spec =>
            typeof spec === 'string'
                ? (item[spec] || '')
                : (spec && spec.badgeLabel ? badgeLabel(schema, item[spec.badgeLabel]) : ''))),
        `${csv.filename || 'knowledge'}${ver}${all ? '_all' : ''}_${todayKey()}.csv`
    );
    showToast(`${unit} ${all ? '전체 ' : ''}${rows.length}종을 CSV로 저장했습니다.`, 'success');
}
