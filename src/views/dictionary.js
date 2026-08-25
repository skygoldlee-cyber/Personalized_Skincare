// src/views/dictionary.js - 화장품 성분 검색 사전 뷰 로직 및 그리드 스페이서 가상 스크롤 구현
import { state } from '../state.js';
import { esc } from '../sanitize.js';
import { getChosung } from '../utils.js';

export const dictState = {
    query: '',
    filter: 'all'
};

// 가상 스크롤 관련 상태
let isScrollBound = false;
let currentFilteredList = [];

/**
 * 성분 사전을 렌더링하고 가상 스크롤을 초기화합니다.
 */
export function renderDictionary() {
    const container = document.getElementById('dict-results-container');
    if (!container) return;
    
    const db = typeof window.INGREDIENTS_DATA !== 'undefined' ? window.INGREDIENTS_DATA : [];
    if (db.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-text-muted);">원료 데이터베이스가 비어있습니다. 빌드 스크립트를 실행해 주세요.</div>';
        return;
    }
    
    const query = dictState.query.toLowerCase().trim();
    const filter = dictState.filter;
    
    // 필터링 적용
    currentFilteredList = db.filter(ing => {
        // 1. 카테고리 필터
        if (filter !== 'all' && ing.type !== filter) return false;
        
        // 2. 검색어 필터
        if (!query) return true;
        
        const name = ing.name.toLowerCase();
        const eng = ing.engName ? ing.engName.toLowerCase() : '';
        const cat = ing.category ? ing.category.toLowerCase() : '';
        
        // 초성 검색 매칭
        const nameChosung = getChosung(name);
        const queryChosung = getChosung(query);
        
        return name.includes(query) || eng.includes(query) || cat.includes(query) || nameChosung.includes(queryChosung);
    });
    
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
export function renderDictionaryVirtual() {
    const container = document.getElementById('dict-results-container');
    const scrollEl = document.querySelector('.main-content');
    if (!container || !scrollEl) return;
    
    // 결과 수가 100개 미만이면 일반 렌더링
    if (currentFilteredList.length < 100) {
        container.innerHTML = '';
        currentFilteredList.forEach(ing => {
            container.appendChild(createIngredientCard(ing));
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
    
    // 2. 가시 범위 내 성분 카드 생성 및 삽입
    const visibleItems = currentFilteredList.slice(startIndex, endIndex);
    visibleItems.forEach(ing => {
        container.appendChild(createIngredientCard(ing));
    });
    
    // 3. 하단 그리드 스페이서
    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.cssText = `grid-column: 1 / -1; height: ${bottomHeight}px; margin: 0; padding: 0; border: none; background: transparent;`;
    container.appendChild(bottomSpacer);
}

/**
 * 개별 성분 카드 DOM 요소를 생성합니다.
 */
function createIngredientCard(ing) {
    const card = document.createElement('div');
    card.className = 'dict-card';
    
    let badgeText = '사용 가능';
    if (ing.type === 'restricted') badgeText = '사용 제한';
    else if (ing.type === 'banned') badgeText = '사용 금지';
    
    card.innerHTML = `
        <div class="dict-card-header">
            <div class="dict-card-title">${esc(ing.name)}</div>
            <span class="dict-badge ${ing.type}">${badgeText}</span>
        </div>
        <div class="dict-card-subtitle">${esc(ing.engName || '영문명 없음')}</div>
        <div class="dict-card-details" style="display: none;">
            <div class="dict-detail-item"><span class="dict-detail-label">카테고리</span><span class="dict-detail-value">${esc(ing.category || '기타')}</span></div>
            <div class="dict-detail-item"><span class="dict-detail-label">설명/특성</span><span class="dict-detail-value">${esc(ing.description || '-')}</span></div>
            <div class="dict-detail-item"><span class="dict-detail-label">배합 한도</span><span class="dict-detail-value">${esc(ing.limit || '제한 없음')}</span></div>
            ${ing.tip ? `<div class="dict-card-tip">💡 <strong>TIP:</strong> ${esc(ing.tip)}</div>` : ''}
        </div>
    `;
    
    card.addEventListener('click', () => {
        const details = card.querySelector('.dict-card-details');
        if (details.style.display === 'none') {
            details.style.display = 'flex';
        } else {
            details.style.display = 'none';
        }
    });
    
    return card;
}

/**
 * 스크롤바 이동 시 동작하는 리스너 등록
 */
export function setupDictionaryVirtualScroll() {
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
 * 성분 사전 검색 필터링
 */
export function filterDictionary() {
    const input = document.getElementById('dict-search-input');
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
 * 성분 검색어 초기화
 */
export function clearDictSearch() {
    const input = document.getElementById('dict-search-input');
    if (input) {
        input.value = '';
        dictState.query = '';
        renderDictionary();
    }
}
