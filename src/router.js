// src/router.js - 뷰 라우터: 타이틀 맵 및 뷰 렌더링 디스패치 (app.js에서 분리)
import { state } from './state.js';
import { saveScrollPosition, restoreScrollPosition } from './views/navigation.js';

/**
 * 레지스트리 기반 뷰 타이틀 맵 생성
 * @param {object} registry - DATA_REGISTRY
 * @returns {Record<string, {title: string, subtitle: string}>}
 */
export function getViewTitles(registry) {
    const uiText = (registry && registry.uiText) || {};
    return {
        'dashboard-view': uiText.dashboard || { title: '학습 대시보드', subtitle: '시험 합격을 위한 분석 및 스마트 툴' },
        'flashcard-view': uiText.flashcard || { title: '개념 플래시카드', subtitle: '과목별 핵심 개념을 카드로 뒤집으며 암기' },
        'quiz-view': uiText.quiz || { title: '기출 및 핵심 퀴즈', subtitle: '빈칸 채우기형 퀴즈로 실전 완벽 대비' },
        'review-view': uiText.review || { title: '오답 및 중요 복습', subtitle: '헷갈리거나 어려운 약점 카드 집중 복습' },
        'trainer-view': uiText.trainer || { title: '스마트 훈련소', subtitle: '법령 수치 암기 및 배합 계산 트레이닝 센터' },
        'exam-view': uiText.exam || { title: '실전 모의고사', subtitle: '문제은행으로 과목별 모의고사 및 학습안내서 열람' },
        'textbook-view': uiText.textbook || { title: '교재 본문 검색', subtitle: '교재의 모든 본문 내용을 실시간 키워드로 검색' },
        'textbook-reader-view': uiText['textbook-reader'] || { title: '교재 본문 읽기', subtitle: '과목과 단원을 선택하여 교재 본문을 읽기' },
        'dictionary-view': uiText.dictionary || { title: '성분 검색 사전', subtitle: '화장품 성분별 배합한도 및 고시 기준 통합 검색기' }
    };
}

/**
 * 타겟 뷰로 전환하고 해당 뷰를 렌더링한다.
 * @param {string} target - 타겟 뷰 ID
 * @param {object} ctx - 렌더링 컨텍스트 (app.js에서 전달)
 * @param {object} ctx.titlesMap - getViewTitles() 결과
 * @param {object} ctx.handlers - 뷰별 렌더 핸들러 함수들
 * @param {function} [ctx.handlers.onExitReader] - 리더 뷰 벗어날 때 (focus mode 해제 등)
 * @param {function} [ctx.handlers.stopReaderAudio] - 오디오 정지
 */
export function navigateToView(target, ctx) {
    const { titlesMap, handlers } = ctx;
    const sections = document.querySelectorAll('.view-section');

    // 현재 뷰 스크롤 위치 저장
    saveScrollPosition(state.currentView);

    // 네비게이션 활성화 클래스 변경 (사이드바 + 모바일 탭 바 모두 동기화)
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-target="${target}"]`);
    if (navItem) navItem.classList.add('active');

    // 모바일 탭 바 활성화 상태 동기화
    document.querySelectorAll('.mobile-tab-item').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-target') === target) {
            tab.classList.add('active');
        }
    });

    // 교재 읽기 집중 모드 해제 (다른 뷰로 이동 시)
    if (target !== 'textbook-reader-view' && document.body.classList.contains('reader-focus-mode')) {
        document.body.classList.remove('reader-focus-mode');
        const focusBtn = document.getElementById('reader-focus-toggle');
        if (focusBtn) {
            focusBtn.classList.remove('active');
            focusBtn.innerHTML = '<i class="fa-solid fa-expand"></i> <span>집중 모드</span>';
        }
    }

    // 리더 화면을 벗어나면 재생 중인 오디오 정지
    if (target !== 'textbook-reader-view' && typeof handlers.stopReaderAudio === 'function') {
        handlers.stopReaderAudio();
    }

    // 섹션 토글
    sections.forEach(sec => sec.classList.remove('active'));
    const targetEl = document.getElementById(target);
    if (targetEl) targetEl.classList.add('active');

    // 헤더 텍스트 변경
    const viewTitle = document.getElementById('view-title');
    const viewSubtitle = document.getElementById('view-subtitle');
    if (titlesMap[target]) {
        if (viewTitle) viewTitle.textContent = titlesMap[target].title;
        if (viewSubtitle) viewSubtitle.textContent = titlesMap[target].subtitle;
    }

    state.currentView = target;

    // 각 뷰 진입 시 렌더링 갱신 — 핸들러 맵에서 디스패치
    const renderFn = handlers.viewRenderers[target];
    if (typeof renderFn === 'function') {
        renderFn();
    }

    // 새 뷰 스크롤 위치 복원
    restoreScrollPosition(target);
}
