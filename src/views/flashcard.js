// src/views/flashcard.js - 플래시카드 뷰 로직
import { state } from '../state.js';
import { safeTextWithBreaks } from '../sanitize.js';

const CARD_TYPE_LABELS = {
    penalty: '처벌',
    prohibition: '금지',
    exception: '예외',
    number: '숫자',
    requirement: '요건',
    comparison: '비교',
    procedure: '절차',
    definition: '개념'
};

/**
 * 플래시카드 데이터를 로드하고 필터링 상태를 설정합니다.
 */
export function loadFlashcards() {
    const fcConfig = state.flashcards;
    const subjData = (window.STUDY_DATA && window.STUDY_DATA[fcConfig.subject]);
    if (!subjData) return;
    
    // 카드 필터링
    let cards = subjData.cards;
    if (fcConfig.keyOnly) {
        cards = cards.filter(c => c.isKey);
    }
    if (fcConfig.difficultyFilter && fcConfig.difficultyFilter !== 'all') {
        cards = cards.filter(c => c.difficulty === fcConfig.difficultyFilter);
    }
    
    // 중요도 내림차순 정렬 (기본) 또는 랜덤 셔플
    if (fcConfig.shuffle) {
        cards = [...cards].sort(() => 0.5 - Math.random());
    } else if (fcConfig.sortBy === 'importance') {
        cards = [...cards].sort((a, b) => (b.importance || 0) - (a.importance || 0));
    }
    
    fcConfig.data = cards;
    
    // 인덱스 범위 초과 방지
    if (fcConfig.currentIndex >= cards.length) {
        fcConfig.currentIndex = Math.max(0, cards.length - 1);
    }
    
    renderFlashcard();
}

/**
 * 현재 플래시카드를 화면에 렌더링하고 상태를 업데이트합니다.
 */
export function renderFlashcard() {
    const fcConfig = state.flashcards;
    const cardEl = document.getElementById('flashcard-item');
    if (!cardEl) return;
    
    // 카드 뒤집힌 상태 원복
    cardEl.classList.remove('flipped');
    
    const termEl = document.getElementById('card-front-term');
    const defEl = document.getElementById('card-back-definition');
    const frontCatEl = document.getElementById('card-front-category');
    const backCatEl = document.getElementById('card-back-category');
    const frontTypeEl = document.getElementById('card-front-type');
    const backTypeEl = document.getElementById('card-back-type');
    const starEl = document.getElementById('card-front-star');
    const curIdxEl = document.getElementById('fc-current-index');
    const totalEl = document.getElementById('fc-total-count');
    
    if (fcConfig.data.length === 0) {
        if (termEl) termEl.textContent = "조건에 맞는 카드가 없습니다.";
        if (defEl) defEl.textContent = "과목을 바꾸거나 필터를 조정해 보세요.";
        if (frontCatEl) frontCatEl.textContent = "공백";
        if (backCatEl) backCatEl.textContent = "공백";
        if (frontTypeEl) frontTypeEl.textContent = '';
        if (backTypeEl) backTypeEl.textContent = '';
        if (starEl) starEl.classList.remove('active');
        if (curIdxEl) curIdxEl.textContent = '0';
        if (totalEl) totalEl.textContent = '0';
        return;
    }
    
    const card = fcConfig.data[fcConfig.currentIndex];
    
    // 마크업 데이터 주입
    if (termEl) termEl.textContent = card.term;
    if (defEl) defEl.innerHTML = safeTextWithBreaks(card.definition);
    if (frontCatEl) frontCatEl.textContent = card.category;
    if (backCatEl) backCatEl.textContent = card.category;
    
    // 카드 타입 배지 표시
    const typeLabel = card.cardType ? (CARD_TYPE_LABELS[card.cardType] || card.cardType) : '';
    if (frontTypeEl) {
        frontTypeEl.textContent = typeLabel;
        frontTypeEl.setAttribute('data-type', card.cardType || 'definition');
        frontTypeEl.style.display = typeLabel ? 'inline-block' : 'none';
    }
    if (backTypeEl) {
        backTypeEl.textContent = typeLabel;
        backTypeEl.setAttribute('data-type', card.cardType || 'definition');
        backTypeEl.style.display = typeLabel ? 'inline-block' : 'none';
    }
    
    // 기출 표시 제어
    if (starEl) {
        if (card.isKey) {
            starEl.classList.add('active');
            starEl.style.display = 'block';
        } else {
            starEl.classList.remove('active');
            starEl.style.display = 'none';
        }
    }
    
    // 인덱스 상태 갱신
    if (curIdxEl) curIdxEl.textContent = fcConfig.currentIndex + 1;
    if (totalEl) totalEl.textContent = fcConfig.data.length;
    
    // 외움/헷갈림 카드 카운트 표시 (현재 필터된 카드 기준)
    const memorizedCount = fcConfig.data.filter(c => state.memorizedCards.has(c.id)).length;
    const weakCount = fcConfig.data.filter(c => state.weakCards.has(c.id)).length;
    const memBadge = document.getElementById('fc-memorized-badge');
    const memCountEl = document.getElementById('fc-memorized-count');
    const weakBadge = document.getElementById('fc-weak-badge');
    const weakCountEl = document.getElementById('fc-weak-count');
    if (memBadge) { memBadge.style.display = memorizedCount > 0 ? 'inline' : 'none'; }
    if (memCountEl) memCountEl.textContent = memorizedCount;
    if (weakBadge) { weakBadge.style.display = weakCount > 0 ? 'inline' : 'none'; }
    if (weakCountEl) weakCountEl.textContent = weakCount;
    
    // 진도 버튼들 스타일 동적 제어
    const easyBtn = document.getElementById('fc-easy-btn');
    const hardBtn = document.getElementById('fc-hard-btn');
    
    if (easyBtn) {
        if (state.memorizedCards.has(card.id)) {
            easyBtn.style.opacity = '1';
            easyBtn.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
        } else {
            easyBtn.style.opacity = '0.7';
            easyBtn.style.boxShadow = 'none';
        }
    }
    
    if (hardBtn) {
        if (state.weakCards.has(card.id)) {
            hardBtn.style.opacity = '1';
            hardBtn.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.4)';
        } else {
            hardBtn.style.opacity = '0.7';
            hardBtn.style.boxShadow = 'none';
        }
    }
}
