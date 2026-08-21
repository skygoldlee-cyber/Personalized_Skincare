// app.js - 맞춤형화장품 조제관리사 학습 플랫폼 애플리케이션 로직
//
// [모듈화] 전역 상태 객체(state) 및 영속성 로직(loadProgress/saveProgress)은
// src/state.js로 분리되었습니다. 이 파일은 src/state.js 이후에 로드되어야 합니다.

// --- 초기화 및 로컬스토리지 로드 ---
function initApp() {
    loadProgress();
    setupNavigation();
    setupEventListeners();
    
    // 초기 뷰 렌더링
    renderDashboard();
    updateGlobalStats();
    checkExamDraft();
}

// --- 가로/세로 보기 ---
// 실제 기기 회전 + 반응형 CSS가 가로/세로를 직접 처리하므로
// 별도 토글 버튼은 사용하지 않는다. 과거에 저장된 landscape-mode 잔존 상태만 정리한다.
function setupOrientationToggle() {
    document.body.classList.remove('landscape-mode');
    try { localStorage.removeItem('preferredOrientation'); } catch (e) {}
}

// 방향 전환 알림 표시
function showOrientationToast(isLandscape) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.orientation-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'orientation-toast';
    toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 1rem 1.5rem;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: orientationToastIn 0.3s ease;
    `;
    
    const icon = document.createElement('i');
    icon.className = isLandscape ? 'fa-solid fa-mobile-screen' : 'fa-solid fa-mobile-screen-button';
    icon.style.cssText = 'font-size: 1.5rem; color: var(--color-primary);';
    
    const text = document.createElement('span');
    text.textContent = isLandscape ? '가로 보기 모드' : '세로 보기 모드';
    text.style.cssText = 'font-weight: 600; color: var(--color-text-main);';
    
    toast.appendChild(icon);
    toast.appendChild(text);
    document.body.appendChild(toast);
    
    // 2초 후 자동 제거
    setTimeout(() => {
        toast.style.animation = 'orientationToastOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// --- 네비게이션 제어 (SPA) ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');
    const viewTitle = document.getElementById('view-title');
    const viewSubtitle = document.getElementById('view-subtitle');
    
    const titlesMap = {
        'dashboard-view': { title: '학습 대시보드', subtitle: '2026 시험 합격을 위한 분석 및 스마트 툴' },
        'flashcard-view': { title: '개념 플래시카드', subtitle: 'Active Recall 학습법으로 효율적인 암기' },
        'quiz-view': { title: '기출 및 핵심 퀴즈', subtitle: '빈칸 채우기형 퀴즈로 실전 완벽 대비' },
        'review-view': { title: '오답 및 중요 복습', subtitle: '헷갈리거나 어려운 약점 카드 집중 복습' },
        'trainer-view': { title: '스마트 훈련소', subtitle: '법령 수치 암기 및 배합 계산 트레이닝 센터' },
        'exam-view': { title: '실전 예상문제집', subtitle: '과목별 100제 & 300제 예상 문제 및 해설 열람' },
        'textbook-view': { title: '교재 본문 검색', subtitle: '교재의 모든 본문 내용을 실시간 키워드로 검색' },
        'textbook-reader-view': { title: '교재 본문 읽기', subtitle: '과목과 단원을 선택하여 교재 본문을 읽기' },
        'dictionary-view': { title: '성분 검색 사전', subtitle: '화장품 성분별 배합한도 및 고시 기준 통합 검색기' }
    };
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            
            // 현재 뷰 스크롤 위치 저장
            saveScrollPosition(state.currentView);
            
            // 네비게이션 활성화 클래스 변경 (사이드바 + 모바일 탭 바 모두 동기화)
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // 모바일 탭 바 활성화 상태 동기화
            const mobileTabItems = document.querySelectorAll('.mobile-tab-item');
            mobileTabItems.forEach(tab => {
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
            if (target !== 'textbook-reader-view' && typeof stopReaderAudio === 'function') {
                stopReaderAudio();
            }
            
            // 섹션 토글
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            
            // 헤더 텍스트 변경
            if (titlesMap[target]) {
                viewTitle.textContent = titlesMap[target].title;
                viewSubtitle.textContent = titlesMap[target].subtitle;
            }
            
            state.currentView = target;
            
            // 각 뷰 진입 시 렌더링 갱신
            if (target === 'dashboard-view') {
                renderDashboard();
                checkExamDraft();
            } else if (target === 'flashcard-view') {
                loadFlashcards();
            } else if (target === 'review-view') {
                renderReviewList();
            } else if (target === 'trainer-view') {
                initTrainer();
            } else if (target === 'textbook-view') {
                renderTextbookSearch();
            } else if (target === 'textbook-reader-view') {
                renderTextbookReader();
            } else if (target === 'dictionary-view') {
                renderDictionary();
            }
            
            // 새 뷰 스크롤 위치 복원
            restoreScrollPosition(target);
        });
    });

    // 모바일 하단 탭 바 클릭 이벤트 설정
    const mobileTabItems = document.querySelectorAll('.mobile-tab-item');
    mobileTabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-target');
            if (!target) return; // 외부 링크(매뉴얼)는 제외
            
            // 현재 뷰 스크롤 위치 저장
            saveScrollPosition(state.currentView);
            
            // 모바일 탭 바 활성화 상태 변경
            mobileTabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 사이드바 네비게이션 활성화 상태 동기화 (클릭 이벤트는 발생시키지 않음)
            navItems.forEach(nav => {
                nav.classList.remove('active');
                if (nav.getAttribute('data-target') === target) {
                    nav.classList.add('active');
                }
            });

            // 교재 읽기 집중 모드 해제
            if (target !== 'textbook-reader-view' && document.body.classList.contains('reader-focus-mode')) {
                document.body.classList.remove('reader-focus-mode');
                const focusBtn = document.getElementById('reader-focus-toggle');
                if (focusBtn) {
                    focusBtn.classList.remove('active');
                    focusBtn.innerHTML = '<i class="fa-solid fa-expand"></i> <span>집중 모드</span>';
                }
            }

            // 리더 화면을 벗어나면 재생 중인 오디오 정지
            if (target !== 'textbook-reader-view' && typeof stopReaderAudio === 'function') {
                stopReaderAudio();
            }
            
            // 섹션 토글
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(target).classList.add('active');
            
            // 헤더 텍스트 변경
            if (titlesMap[target]) {
                viewTitle.textContent = titlesMap[target].title;
                viewSubtitle.textContent = titlesMap[target].subtitle;
            }
            
            state.currentView = target;
            
            // 각 뷰 진입 시 렌더링 갱신
            if (target === 'dashboard-view') {
                renderDashboard();
                checkExamDraft();
            } else if (target === 'flashcard-view') {
                loadFlashcards();
            } else if (target === 'review-view') {
                renderReviewList();
            } else if (target === 'trainer-view') {
                initTrainer();
            } else if (target === 'textbook-view') {
                renderTextbookSearch();
            } else if (target === 'textbook-reader-view') {
                renderTextbookReader();
            } else if (target === 'dictionary-view') {
                renderDictionary();
            }
            
            // 새 뷰 스크롤 위치 복원
            restoreScrollPosition(target);
        });
    });
}

// 외부에서 특정 뷰로 전환하는 유틸리티
function switchView(targetView) {
    // 리더 화면을 벗어나면 재생 중인 오디오 정지
    if (targetView !== 'textbook-reader-view' && typeof stopReaderAudio === 'function') {
        stopReaderAudio();
    }
    
    // 현재 뷰 스크롤 위치 저장
    saveScrollPosition(state.currentView);
    
    const navItem = document.querySelector(`.nav-item[data-target="${targetView}"]`);
    if (navItem) {
        navItem.click();
    }
    
    // 새 뷰 스크롤 위치 복원
    restoreScrollPosition(targetView);
}

// ============================================================
// 모바일 UX 개선: 스크롤 위치 저장/복원
// ============================================================
const scrollPositions = {};

function saveScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        scrollPositions[viewId] = mainContent.scrollTop;
    }
}

function restoreScrollPosition(viewId) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent && scrollPositions[viewId] !== undefined) {
        // DOM 렌더링 완료 후 복원
        requestAnimationFrame(() => {
            mainContent.scrollTop = scrollPositions[viewId];
        });
    }
}

// ============================================================
// 모바일 UX 개선: 오프라인 감지 및 배너 표시
// ============================================================
function setupOfflineDetection() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    let probeInFlight = false;

    function showBanner() {
        banner.classList.add('show');
    }

    function hideBanner() {
        banner.classList.remove('show');
    }

    /**
     * 실제 인터넷 접속 여부를 확인합니다.
     * navigator.onLine은 OS 네트워크 어댑터 상태만 반영하므로
     * 실제 연결 확인을 위해 가벼운 리소스를 no-cors로 요청합니다.
     */
    async function probeConnectivity() {
        // OS가 오프라인이라고 보고하면 바로 배너 표시
        if (!navigator.onLine) {
            showBanner();
            return;
        }
        if (probeInFlight) return;
        probeInFlight = true;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            await fetch('https://www.gstatic.com/generate_204', {
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            hideBanner();
        } catch (e) {
            showBanner();
        } finally {
            probeInFlight = false;
        }
    }

    window.addEventListener('online', probeConnectivity);
    window.addEventListener('offline', showBanner);

    // 초기 상태: navigator.onLine이 true면 배너를 숨기고 시작
    // (잘못된 오프라인 오표시 방지). 이후 주기적으로 실제 연결 확인.
    if (navigator.onLine) {
        hideBanner();
    } else {
        showBanner();
    }

    // 주기적 연결 확인 (30초 간격)
    setInterval(probeConnectivity, 30000);
}

// ============================================================
// 모바일 UX 개선: 모달 뒤로가기 버튼 대응
// ============================================================
let modalOpenState = false;

function setupModalBackHandler() {
    // 모달이 열릴 때 history 상태 추가
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.classList.contains('modal') ||
                    target.classList.contains('modal-content') ||
                    target.id === 'reader-table-modal') {
                    const isVisible = target.style.display !== 'none' &&
                                     target.style.display !== '' ||
                                     getComputedStyle(target).display !== 'none';
                    
                    if (isVisible && !modalOpenState) {
                        modalOpenState = true;
                        history.pushState({ modalOpen: true }, '');
                    } else if (!isVisible && modalOpenState) {
                        modalOpenState = false;
                    }
                }
            }
        });
    });

    // 주요 모달 요소들 관찰
    document.querySelectorAll('.modal, .modal-content, [id$="-modal"]').forEach(el => {
        observer.observe(el, { attributes: true });
    });

    // 뒤로가기 버튼 처리
    window.addEventListener('popstate', (e) => {
        if (modalOpenState) {
            // 열린 모달 찾아서 닫기
            const openModals = document.querySelectorAll('.modal, .modal-content, [id$="-modal"]');
            openModals.forEach(modal => {
                if (modal.style.display !== 'none' && modal.style.display !== '') {
                    modal.style.display = 'none';
                }
            });
            modalOpenState = false;
        }
    });
}

// ============================================================
// 모바일 UX 개선: 로딩 상태 표시
// ============================================================
function showLoading(containerId, message = '로딩 중...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--color-text-muted);">
            <div class="spinner" style="width: 40px; height: 40px; border: 3px solid var(--border-color); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
            <p>${message}</p>
        </div>
    `;
}

function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const loading = container.querySelector('.loading-state');
    if (loading) {
        loading.remove();
    }
}

// 스피너 애니메이션을 위한 CSS 추가
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(spinnerStyle);

// ============================================================
// 초기화 확장
// ============================================================
const originalInitApp = initApp;
initApp = function() {
    originalInitApp();
    setupOfflineDetection();
    setupModalBackHandler();
};

// --- 글로벌 학습 통계 업데이트 ---
function updateGlobalStats() {
    // 1. 전체 카드 통계
    let totalCards = 0;
    Object.keys(STUDY_DATA).forEach(subj => {
        totalCards += STUDY_DATA[subj].cards.length;
    });
    
    document.getElementById('total-cards-count').textContent = totalCards;
    document.getElementById('memorized-cards-count').textContent = state.memorizedCards.size;
    document.getElementById('weak-cards-count').textContent = state.weakCards.size;
    document.getElementById('review-card-count').textContent = state.weakCards.size;
    
    // 전체 진척도 퍼센트 계산
    const totalProgress = totalCards > 0 ? Math.round((state.memorizedCards.size / totalCards) * 100) : 0;
    document.getElementById('total-progress-val').textContent = `${totalProgress}%`;
    document.getElementById('total-progress-bar').style.width = `${totalProgress}%`;
    
    // 2. 퀴즈 통계
    const quizKeys = Object.keys(state.quizResults);
    const solvedCount = quizKeys.length;
    const correctCount = quizKeys.filter(k => state.quizResults[k].correct).length;
    const successRate = solvedCount > 0 ? Math.round((correctCount / solvedCount) * 100) : 0;
    
    document.getElementById('solved-quizzes-count').textContent = solvedCount;
    document.getElementById('quiz-success-rate').textContent = `${successRate}%`;
}

// --- 1. 대시보드 뷰 구현 ---
function renderDashboard() {
    const container = document.getElementById('subject-cards-container');
    container.innerHTML = '';
    
    Object.keys(STUDY_DATA).forEach(subjId => {
        const subj = STUDY_DATA[subjId];
        const totalSubjCards = subj.cards.length;
        const totalSubjQuizzes = subj.quizzes.length;
        
        // 과목별 완료된 카드 수
        const memorizedSubjCards = subj.cards.filter(c => state.memorizedCards.has(c.id)).length;
        const progressPercent = totalSubjCards > 0 ? Math.round((memorizedSubjCards / totalSubjCards) * 100) : 0;
        
        // 과목별 퀴즈 정답률
        const subjQuizIds = new Set(subj.quizzes.map(q => q.id));
        const solvedSubjQuizzes = Object.keys(state.quizResults).filter(id => subjQuizIds.has(id));
        const correctSubjQuizzes = solvedSubjQuizzes.filter(id => state.quizResults[id].correct);
        const quizRate = solvedSubjQuizzes.length > 0 ? Math.round((correctSubjQuizzes.length / solvedSubjQuizzes.length) * 100) : 0;
        
        const cardHTML = `
            <div class="subject-card">
                <div class="subj-header">
                    <h4>${esc(subj.name)}</h4>
                    <span>카드 ${totalSubjCards}개 / 퀴즈 ${totalSubjQuizzes}개</span>
                </div>
                <div class="subj-stats-summary">
                    <div class="subj-stat-item">
                        <span>암기 카드</span>
                        <strong>${memorizedSubjCards} / ${totalSubjCards}</strong>
                    </div>
                    <div class="subj-stat-item">
                        <span>퀴즈 정답률</span>
                        <strong>${solvedSubjQuizzes.length > 0 ? quizRate + '%' : '-'}</strong>
                    </div>
                </div>
                <div class="subj-progress-group">
                    <div class="subj-progress-label">
                        <span>학습 진도율</span>
                        <span>${progressPercent}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
                <div class="subj-actions">
                    <button class="btn btn-secondary" onclick="startSubjectStudy('${subjId}')">
                        <i class="fa-solid fa-layer-group"></i> 카드 학습
                    </button>
                    <button class="btn btn-primary" onclick="startSubjectQuiz('${subjId}')">
                        <i class="fa-solid fa-play"></i> 퀴즈 풀기
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
    
    // 신규 추가: 모의고사 성적 차트 및 합격 진단 렌더링
    renderPerformanceChart();
    renderPassFailDiagnosis();
    renderRadarChart();
    updateStreakAndDailyUI();
    updatePomodoroUI();
}

function startSubjectStudy(subjId) {
    state.flashcards.subject = subjId;
    state.flashcards.currentIndex = 0;
    const select = document.getElementById('fc-subject-select');
    if (select) select.value = subjId;
    switchView('flashcard-view');
}

function startSubjectQuiz(subjId) {
    state.quiz.subject = subjId;
    const select = document.getElementById('quiz-subject-select');
    if (select) select.value = subjId;
    switchView('quiz-view');
    document.getElementById('start-quiz-btn').click();
}

// --- 2. 플래시카드 뷰 구현 ---
function loadFlashcards() {
    const fcConfig = state.flashcards;
    const subjData = STUDY_DATA[fcConfig.subject];
    if (!subjData) return;
    
    // 카드 필터링
    let cards = subjData.cards;
    if (fcConfig.keyOnly) {
        cards = cards.filter(c => c.isKey);
    }
    
    fcConfig.data = cards;
    
    // 인덱스 범위 초과 방지
    if (fcConfig.currentIndex >= cards.length) {
        fcConfig.currentIndex = Math.max(0, cards.length - 1);
    }
    
    renderFlashcard();
}

function renderFlashcard() {
    const fcConfig = state.flashcards;
    const cardEl = document.getElementById('flashcard-item');
    
    // 카드 뒤집힌 상태 원복
    cardEl.classList.remove('flipped');
    
    if (fcConfig.data.length === 0) {
        document.getElementById('card-front-term').textContent = "조건에 맞는 카드가 없습니다.";
        document.getElementById('card-back-definition').textContent = "과목을 바꾸거나 '기출/중요 개념만 보기'를 해제해 보세요.";
        document.getElementById('card-front-category').textContent = "공백";
        document.getElementById('card-back-category').textContent = "공백";
        document.getElementById('card-front-star').classList.remove('active');
        document.getElementById('fc-current-index').textContent = '0';
        document.getElementById('fc-total-count').textContent = '0';
        return;
    }
    
    const card = fcConfig.data[fcConfig.currentIndex];
    
    // 마크업 데이터 주입
    document.getElementById('card-front-term').textContent = card.term;
    document.getElementById('card-back-definition').innerHTML = safeTextWithBreaks(card.definition);
    document.getElementById('card-front-category').textContent = card.category;
    document.getElementById('card-back-category').textContent = card.category;
    
    // 기출 표시 제어
    const starEl = document.getElementById('card-front-star');
    if (card.isKey) {
        starEl.classList.add('active');
        starEl.style.display = 'block';
    } else {
        starEl.classList.remove('active');
        starEl.style.display = 'none';
    }
    
    // 인덱스 상태 갱신
    document.getElementById('fc-current-index').textContent = fcConfig.currentIndex + 1;
    document.getElementById('fc-total-count').textContent = fcConfig.data.length;
    
    // 진도 버튼들 스타일 동적 제어
    const easyBtn = document.getElementById('fc-easy-btn');
    const hardBtn = document.getElementById('fc-hard-btn');
    
    if (state.memorizedCards.has(card.id)) {
        easyBtn.style.opacity = '1';
        easyBtn.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
    } else {
        easyBtn.style.opacity = '0.7';
        easyBtn.style.boxShadow = 'none';
    }
    
    if (state.weakCards.has(card.id)) {
        hardBtn.style.opacity = '1';
        hardBtn.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.4)';
    } else {
        hardBtn.style.opacity = '0.7';
        hardBtn.style.boxShadow = 'none';
    }
}

// --- 3. 퀴즈 뷰 구현 ---
function startQuiz() {
    const subjId = state.quiz.subject;
    const subjData = STUDY_DATA[subjId];
    if (!subjData || subjData.quizzes.length === 0) {
        alert("이 과목에는 출제 가능한 퀴즈가 없습니다.");
        return;
    }
    
    // 퀴즈 문제 목록 섞기 (Fisher-Yates Shuffle)
    const shuffled = [...subjData.quizzes].sort(() => 0.5 - Math.random());
    
    // 최대 10문제만 출제
    state.quiz.data = shuffled.slice(0, 10);
    state.quiz.currentIndex = 0;
    state.quiz.correctCount = 0;
    state.quiz.solvedList = [];
    
    // UI 세팅
    document.getElementById('quiz-empty-state').style.display = 'none';
    document.getElementById('quiz-result-panel').style.display = 'none';
    document.getElementById('quiz-arena-panel').style.display = 'block';
    document.querySelector('.quiz-progress-header').style.display = 'flex';
    
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const quizState = state.quiz;
    const currentQuiz = quizState.data[quizState.currentIndex];
    
    // 진도 바
    const progressPercent = Math.round((quizState.currentIndex / quizState.data.length) * 100);
    document.getElementById('quiz-run-progress').style.width = `${progressPercent}%`;
    document.getElementById('quiz-curr-idx').textContent = quizState.currentIndex + 1;
    document.getElementById('quiz-total-idx').textContent = quizState.data.length;
    document.getElementById('quiz-correct-count').textContent = quizState.correctCount;
    
    // 카드 정보 바인딩
    document.getElementById('quiz-category').textContent = currentQuiz.category;
    document.getElementById('quiz-context-title').textContent = currentQuiz.context;
    
    // 질문 빈칸 파싱
    // [ 빈칸 ] 부분을 <strong>[ 빈칸 ]</strong> 등으로 이쁘게 변환
    let qText = currentQuiz.question;
    // 먼저 이스케이프한 뒤, 개행은 <br>로, [빈칸] 마커는 <strong>으로 안전하게 변환
    qText = safeTextWithBreaks(qText).replace(/\[\s*빈칸\s*\]/g, '<strong>[ 빈칸 ]</strong>');
    document.getElementById('quiz-question').innerHTML = qText;
    
    // 입력폼 및 피드백 초기화
    const input = document.getElementById('quiz-answer-input');
    input.value = '';
    input.disabled = false;
    input.focus();
    
    document.getElementById('submit-quiz-btn').style.display = 'block';
    document.getElementById('next-quiz-btn').style.display = 'none';
    document.getElementById('quiz-feedback-panel').style.display = 'none';
}

// 띄어쓰기/대소문자 무시하고 매칭하는 도우미 함수
const cleanForCompare = (str) => {
    if (!str) return '';
    // 괄호 마크 (A), (B), (1) 및 원문자 ①, ② 등 제거하여 순수 텍스트 비교 가능케 함
    const stripped = str
        .replace(/\([a-zA-Z0-9]\)/g, '')
        .replace(/\[[a-zA-Z0-9]\]/g, '')
        .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')
        .trim();
    return stripped.replace(/\s+/g, '').replace(/[\*`'"\[\]\(\)]/g, '').toLowerCase();
};

function submitQuizAnswer() {
    const quizState = state.quiz;
    const currentQuiz = quizState.data[quizState.currentIndex];
    const input = document.getElementById('quiz-answer-input');
    const userAnswer = input.value.trim();
    
    if (!userAnswer) {
        alert("답변을 입력해 주세요!");
        return;
    }
    
    input.disabled = true;
    document.getElementById('submit-quiz-btn').style.display = 'none';
    
    // 정답 체크 (주관식 유사어 매칭 엔진 적용)
    const isCorrect = checkShortAnswer(userAnswer, currentQuiz.answer);
    
    // 점수 및 상태 누적
    if (isCorrect) {
        quizState.correctCount++;
    }
    
    // 퀴즈 결과 글로벌 상태에 저장
    state.quizResults[currentQuiz.id] = {
        solved: true,
        correct: isCorrect
    };
    
    // UI 피드백 렌더링
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    const feedbackTitle = document.getElementById('feedback-result-title');
    const feedbackAnswer = document.getElementById('feedback-correct-answer');
    
    feedbackPanel.style.display = 'flex';
    feedbackAnswer.textContent = currentQuiz.answer;
    
    if (isCorrect) {
        feedbackPanel.classList.remove('incorrect');
        feedbackTitle.textContent = "정답입니다!";
    } else {
        feedbackPanel.classList.add('incorrect');
        feedbackTitle.textContent = `틀렸습니다! (내가 쓴 답: ${userAnswer})`;
    }
    
    // 진행 완료 시 저장
    saveProgress();
    
    // 다음 버튼 활성화
    document.getElementById('next-quiz-btn').style.display = 'block';
}

function nextQuizQuestion() {
    const quizState = state.quiz;
    quizState.currentIndex++;
    
    if (quizState.currentIndex >= quizState.data.length) {
        // 퀴즈 완전히 종료됨
        renderQuizResult();
    } else {
        renderQuizQuestion();
    }
}

function renderQuizResult() {
    const quizState = state.quiz;
    
    // UI 전환
    document.getElementById('quiz-arena-panel').style.display = 'none';
    document.querySelector('.quiz-progress-header').style.display = 'none';
    document.getElementById('quiz-result-panel').style.display = 'block';
    
    // 점수 채우기
    document.getElementById('result-correct-num').textContent = quizState.correctCount;
    document.getElementById('result-total-num').textContent = quizState.data.length;
    
    const rate = Math.round((quizState.correctCount / quizState.data.length) * 100);
    document.getElementById('result-percent').textContent = `${rate}%`;
}

// --- 4. 오답 및 복습 노트 구현 ---
function getWeakCardsList() {
    const list = [];
    
    // 1. 일반 카드 복구
    Object.keys(STUDY_DATA).forEach(subjId => {
        STUDY_DATA[subjId].cards.forEach(card => {
            if (state.weakCards.has(card.id)) {
                list.push({ ...card, subjectId: subjId, subjectName: STUDY_DATA[subjId].name });
            }
        });
    });
    
    // 2. 모의고사 오답 카드 복구
    state.weakCards.forEach(cardId => {
        if (cardId.startsWith('weak_sim_')) {
            const parts = cardId.replace('weak_sim_', '').split('_q');
            if (parts.length === 2) {
                const examId = parts[0];
                const qNum = parseInt(parts[1]);
                if (typeof EXAM_DATA !== 'undefined' && EXAM_DATA[examId]) {
                    const exam = EXAM_DATA[examId];
                    const q = exam.questions.find(quest => quest.num === qNum);
                    if (q) {
                        const targetSubject = examIdToSubjectId(examId);
                        const subjectName = STUDY_DATA[targetSubject] ? STUDY_DATA[targetSubject].name : '모의고사';
                        list.push({
                            id: cardId,
                            subjectId: targetSubject,
                            category: exam.title.split('(')[0].trim() || '모의고사 오답',
                            term: `[모의고사 오답] ${q.question.substring(0, 30)}...`,
                            definition: `문제: ${q.question}\n정답: ${q.answer}\n해설: ${q.explanation}`,
                            subjectName: subjectName
                        });
                    }
                }
            }
        }
    });
    
    return list;
}

function renderReviewList() {
    const container = document.getElementById('review-cards-list-container');
    container.innerHTML = '';
    
    const printBtn = document.getElementById('print-review-btn');
    const examBtn = document.getElementById('start-weak-exam-btn');
    
    if (state.weakCards.size === 0) {
        document.getElementById('review-empty-state').style.display = 'flex';
        document.getElementById('start-weak-quiz-btn').style.display = 'none';
        if (examBtn) examBtn.style.display = 'none';
        if (printBtn) printBtn.style.display = 'none';
        return;
    }
    
    let allCards = getWeakCardsList();
    
    // 필터링 적용 (신규 Feature 3)
    if (state.reviewFilter && state.reviewFilter !== 'all') {
        allCards = allCards.filter(c => c.subjectId === state.reviewFilter);
    }
    
    if (allCards.length === 0) {
        // 필터링된 결과가 없을 때의 Empty State 처리
        document.getElementById('review-empty-state').style.display = 'flex';
        document.getElementById('review-empty-state').querySelector('h3').textContent = '이 과목에 해당하는 복습 카드가 없습니다!';
        document.getElementById('review-empty-state').querySelector('p').textContent = '다른 과목 필터를 선택하거나 전체 보기를 누르세요.';
        document.getElementById('start-weak-quiz-btn').style.display = 'none';
        if (examBtn) examBtn.style.display = 'none';
        if (printBtn) printBtn.style.display = 'none';
        return;
    }
    
    document.getElementById('review-empty-state').style.display = 'none';
    document.getElementById('review-empty-state').querySelector('h3').textContent = '복습할 카드가 없습니다!';
    document.getElementById('review-empty-state').querySelector('p').textContent = '플래시카드 학습 중에 "아직 헷갈림"으로 분류한 카드가 여기에 수집됩니다.';
    
    document.getElementById('start-weak-quiz-btn').style.display = 'inline-flex';
    if (examBtn) examBtn.style.display = 'inline-flex';
    if (printBtn) printBtn.style.display = 'inline-flex';
    
    allCards.forEach(card => {
        const itemHTML = `
            <div class="review-card-item" id="rev-${card.id}">
                <div class="review-card-item-header">
                    <span class="card-badge">${esc(card.subjectName)}</span>
                    <button class="review-remove-btn" onclick="removeWeakCard('${esc(card.id)}')">
                        <i class="fa-solid fa-trash-can"></i> 제외
                    </button>
                </div>
                <h5>${esc(card.term)}</h5>
                <p>${safeTextWithBreaks(card.definition)}</p>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

function removeWeakCard(cardId) {
    state.weakCards.delete(cardId);
    saveProgress();
    
    // DOM에서 즉시 애니메이션 후 제거
    const cardEl = document.getElementById(`rev-${cardId}`);
    if (cardEl) {
        cardEl.style.transform = 'scale(0.9)';
        cardEl.style.opacity = '0';
        setTimeout(() => {
            renderReviewList();
            updateGlobalStats();
        }, 200);
    }
}

function setReviewFilter(filterType) {
    state.reviewFilter = filterType;
    
    // UI 활성화 클래스 조절
    const buttons = document.querySelectorAll('#review-filter-group .filter-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('data-filter') === filterType) {
            btn.classList.add('active');
            btn.style.background = 'var(--color-primary)';
            btn.style.borderColor = 'var(--color-primary)';
            btn.style.color = '#fff';
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }
    });
    
    renderReviewList();
}

// 헷갈린 카드들로 즉시 기출 퀴즈를 출제하는 번개 퀴즈 모드
function startWeakFocusQuiz() {
    let weakCards = getWeakCardsList();
    if (weakCards.length === 0) return;
    
    // 필터링 적용 (신규 Feature 3)
    if (state.reviewFilter && state.reviewFilter !== 'all') {
        weakCards = weakCards.filter(c => c.subjectId === state.reviewFilter);
    }
    
    if (weakCards.length === 0) return;
    
    const weakList = weakCards.map(card => {
        if (card.id.startsWith('weak_sim_')) {
            const parts = card.id.replace('weak_sim_', '').split('_q');
            const examId = parts[0];
            const qNum = parseInt(parts[1]);
            const q = EXAM_DATA[examId].questions.find(quest => quest.num === qNum);
            
            // Options append logic
            let qText = q.question;
            if (q.options && q.options.length) {
                const optionIndicators = ['①', '②', '③', '④', '⑤'];
                qText += '\n' + q.options.map((o, idx) => optionIndicators[idx] + ' ' + o).join('\n');
            }
            
            return {
                id: card.id,
                category: card.category,
                context: `[모의고사 오답 퀴즈]`,
                question: qText,
                answer: q.answer,
                type: q.type
            };
        } else {
            return {
                id: card.id,
                category: card.category,
                context: `[오답 집중 학습] 정의에 해당하는 용어를 입력하세요.`,
                question: card.definition,
                answer: card.term,
                type: 'term'
            };
        }
    });
    
    // 퀴즈 뷰로 이동 및 설정
    state.quiz.data = weakList.sort(() => 0.5 - Math.random()).slice(0, 10);
    state.quiz.currentIndex = 0;
    state.quiz.correctCount = 0;
    state.quiz.solvedList = [];
    
    switchView('quiz-view');
    
    document.getElementById('quiz-empty-state').style.display = 'none';
    document.getElementById('quiz-result-panel').style.display = 'none';
    document.getElementById('quiz-arena-panel').style.display = 'block';
    document.querySelector('.quiz-progress-header').style.display = 'flex';
    
    renderQuizQuestion();
}

// --- 이벤트 리스너 정의 ---
function setupEventListeners() {
    // 1. 진도 초기화 버튼
    document.getElementById('reset-progress-btn').addEventListener('click', () => {
        if (confirm("정말 모든 학습 진도를 초기화하시겠습니까?\n외운 카드, 오답 정보, 모의고사 성적 이력, 연속 학습일, 계산 기록이 모두 지워집니다.")) {
            // 인메모리 상태 초기화
            state.memorizedCards.clear();
            state.weakCards.clear();
            state.quizResults = {};
            state.trainer.pomodoro.totalTimeToday = 0;
            
            // 로컬스토리지에 남아있는 모든 학습 데이터 키 제거
            const keysToRemove = [
                'fc_memorized',
                'fc_weak',
                'quiz_results',
                'sim_results_history',
                'sim_draft_session',
                'pomo_total_time',
                'pomo_total_time_date',
                'study_streak',
                'study_streak_last_date',
                'calc_history'
            ];
            keysToRemove.forEach(k => localStorage.removeItem(k));
            
            // 날짜 기반 동적 키(daily_completed_*) 일괄 제거
            const dynamicKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('daily_completed_')) {
                    dynamicKeys.push(key);
                }
            }
            dynamicKeys.forEach(k => localStorage.removeItem(k));
            
            saveProgress();
            
            // 현재 활성화 뷰 새로고침
            if (state.currentView === 'dashboard-view') renderDashboard();
            else if (state.currentView === 'flashcard-view') loadFlashcards();
            else if (state.currentView === 'review-view') renderReviewList();
            
            alert("학습 진도가 모두 초기화되었습니다.");
        }
    });
    
    // 2. 플래시카드 이벤트
    const cardEl = document.getElementById('flashcard-item');
    cardEl.addEventListener('click', () => {
        cardEl.classList.toggle('flipped');
    });
    
    document.getElementById('fc-subject-select').addEventListener('change', (e) => {
        state.flashcards.subject = e.target.value;
        state.flashcards.currentIndex = 0;
        loadFlashcards();
    });
    
    document.getElementById('fc-key-only').addEventListener('change', (e) => {
        state.flashcards.keyOnly = e.target.checked;
        state.flashcards.currentIndex = 0;
        loadFlashcards();
    });
    
    document.getElementById('fc-prev-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.flashcards.data.length === 0) return;
        state.flashcards.currentIndex--;
        if (state.flashcards.currentIndex < 0) {
            state.flashcards.currentIndex = state.flashcards.data.length - 1;
        }
        renderFlashcard();
    });
    
    document.getElementById('fc-next-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.flashcards.data.length === 0) return;
        state.flashcards.currentIndex++;
        if (state.flashcards.currentIndex >= state.flashcards.data.length) {
            state.flashcards.currentIndex = 0;
        }
        renderFlashcard();
    });
    
    document.getElementById('fc-easy-btn').addEventListener('click', () => {
        const fc = state.flashcards;
        if (fc.data.length === 0) return;
        const currentCard = fc.data[fc.currentIndex];
        
        state.memorizedCards.add(currentCard.id);
        state.weakCards.delete(currentCard.id);
        saveProgress();
        
        // 시각 효과 피드백 후 다음 카드로
        document.getElementById('fc-easy-btn').style.transform = 'scale(1.05)';
        setTimeout(() => {
            document.getElementById('fc-easy-btn').style.transform = 'scale(1)';
            document.getElementById('fc-next-btn').click();
        }, 150);
    });
    
    document.getElementById('fc-hard-btn').addEventListener('click', () => {
        const fc = state.flashcards;
        if (fc.data.length === 0) return;
        const currentCard = fc.data[fc.currentIndex];
        
        state.weakCards.add(currentCard.id);
        state.memorizedCards.delete(currentCard.id);
        saveProgress();
        
        // 시각 효과 피드백 후 다음 카드로
        document.getElementById('fc-hard-btn').style.transform = 'scale(1.05)';
        setTimeout(() => {
            document.getElementById('fc-hard-btn').style.transform = 'scale(1)';
            document.getElementById('fc-next-btn').click();
        }, 150);
    });
    
    // 3. 퀴즈 이벤트
    document.getElementById('quiz-subject-select').addEventListener('change', (e) => {
        state.quiz.subject = e.target.value;
    });
    
    document.getElementById('start-quiz-btn').addEventListener('click', () => {
        startQuiz();
    });
    
    document.getElementById('submit-quiz-btn').addEventListener('click', () => {
        submitQuizAnswer();
    });
    
    // 엔터키 정답 제출 대응
    document.getElementById('quiz-answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const submitBtn = document.getElementById('submit-quiz-btn');
            const nextBtn = document.getElementById('next-quiz-btn');
            
            if (submitBtn.style.display !== 'none') {
                submitQuizAnswer();
            } else if (nextBtn.style.display !== 'none') {
                nextQuizQuestion();
            }
        }
    });
    
    document.getElementById('next-quiz-btn').addEventListener('click', () => {
        nextQuizQuestion();
    });
    
    document.getElementById('retry-quiz-btn').addEventListener('click', () => {
        startQuiz();
    });
    
    document.getElementById('back-to-dashboard-btn').addEventListener('click', () => {
        switchView('dashboard-view');
    });
    
    // 4. 오답 퀴즈 이벤트 바인딩
    document.getElementById('start-weak-quiz-btn').addEventListener('click', () => {
        startWeakFocusQuiz();
    });

    // 5. 모의고사 시뮬레이터 이벤트 바인딩
    document.getElementById('sim-prev-btn').addEventListener('click', () => {
        if (simState.currentIndex > 0) {
            simState.currentIndex--;
            renderSimQuestion();
        }
    });
    
    document.getElementById('sim-next-btn').addEventListener('click', () => {
        if (simState.currentIndex < simState.data.questions.length - 1) {
            simState.currentIndex++;
            renderSimQuestion();
        }
    });
    
    document.getElementById('sim-submit-exam-btn').addEventListener('click', () => {
        if (confirm("정말로 답안지를 제출하고 시험을 종료하시겠습니까?")) {
            submitExam();
        }
    });
    
    // 6. 성분 검색 사전 실시간 검색 이벤트 디바운스 바인딩
    const dictSearchInput = document.getElementById('dict-search-input');
    if (dictSearchInput) {
        dictSearchInput.addEventListener('input', debounce(filterDictionary, 150));
    }
}

// --- 5. 실전 모의고사 시뮬레이터 구현 ---
let simState = {
    examId: '',
    data: null,
    currentIndex: 0,
    userAnswers: {},
    timeLeft: 7200,
    timerInterval: null,
    wrongQuestions: []
};

function startSimSession(examData) {
    // 시뮬레이터 상태 초기화
    simState.examId = examData.id || 'dynamic';
    simState.data = examData;
    simState.currentIndex = 0;
    simState.userAnswers = {};
    simState.timeLeft = examData.questions.length * 60; // 문항당 1분 기산
    simState.wrongQuestions = [];

    // UI 전환
    document.getElementById('exam-list-panel').style.display = 'none';
    document.getElementById('sim-result-panel').style.display = 'none';
    document.getElementById('sim-review-panel').style.display = 'none';
    document.getElementById('sim-arena-panel').style.display = 'block';

    // 타이머 및 OMR 렌더링
    document.getElementById('sim-exam-title').textContent = examData.title;
    renderOMRSheet();
    renderSimQuestion();

    // 기존 타이머 중지 후 신규 시작
    startSimTimer();
}

function startMockExamSim(examId) {
    if (typeof EXAM_DATA === 'undefined' || !EXAM_DATA[examId]) {
        alert("모의고사 데이터를 로드하지 못했습니다.");
        return;
    }
    startSimSession(EXAM_DATA[examId]);
}

function startIntegratedMockExam() {
    if (typeof EXAM_DATA === 'undefined') {
        alert("모의고사 데이터를 로드하지 못했습니다.");
        return;
    }

    // 과목별 문제들 동적 수집 ( subject1, subject2_p1, subject4_p3 등 접두사 기준 자동 분류 )
    const s1Questions = [];
    const s2Questions = [];
    const s3Questions = [];
    const s4Questions = [];

    Object.keys(EXAM_DATA).forEach(examId => {
        const questions = EXAM_DATA[examId].questions || [];
        if (examId.startsWith('subject1')) {
            s1Questions.push(...questions);
        } else if (examId.startsWith('subject2')) {
            s2Questions.push(...questions);
        } else if (examId.startsWith('subject3')) {
            s3Questions.push(...questions);
        } else if (examId.startsWith('subject4')) {
            s4Questions.push(...questions);
        }
    });

    if (s1Questions.length === 0 || s2Questions.length === 0 || s3Questions.length === 0 || s4Questions.length === 0) {
        alert("모의고사 데이터가 불완전합니다. 모든 과목의 모의고사가 정상 로드되었는지 확인하세요.");
        return;
    }

    // 과목별 무작위 선택 함수
    const getRandomSample = (arr, count, subjectId) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).map(q => ({
            ...q,
            subject: subjectId // 과목 정보 태깅
        }));
    };

    const s1Selected = getRandomSample(s1Questions, 10, 'subject1');
    const s2Selected = getRandomSample(s2Questions, 25, 'subject2');
    const s3Selected = getRandomSample(s3Questions, 25, 'subject3');
    const s4Selected = getRandomSample(s4Questions, 40, 'subject4');

    // 100문항 결합
    const combinedQuestions = [
        ...s1Selected,
        ...s2Selected,
        ...s3Selected,
        ...s4Selected
    ];

    // 문항 번호를 1부터 100까지 순차적으로 재지정
    combinedQuestions.forEach((q, index) => {
        q.num = index + 1;
        q.id = `integrated_q${index + 1}`; 
    });

    const integratedExam = {
        id: 'integrated',
        title: '1~4과목 통합 실전 모의고사 (100제)',
        questions: combinedQuestions
    };

    // UI 전환
    state.currentView = 'exam-view';
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('review-view').classList.remove('active');
    document.getElementById('exam-view').classList.add('active');

    // OMR Sheet, Timer 활성화
    startSimSession(integratedExam);
}

function saveSimDraft() {
    if (!simState.data || !simState.data.questions) return;
    const draft = {
        examId: simState.examId,
        examTitle: simState.data.title,
        timeLeft: simState.timeLeft,
        userAnswers: simState.userAnswers,
        currentIndex: simState.currentIndex,
        questions: simState.data.questions
    };
    localStorage.setItem('sim_draft_session', JSON.stringify(draft));
}

function clearSimDraft() {
    localStorage.removeItem('sim_draft_session');
    const banner = document.getElementById('draft-resume-banner');
    if (banner) banner.style.display = 'none';
}

function checkExamDraft() {
    const banner = document.getElementById('draft-resume-banner');
    if (!banner) return;
    
    const saved = localStorage.getItem('sim_draft_session');
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            const minutes = Math.floor(draft.timeLeft / 60);
            const seconds = draft.timeLeft % 60;
            
            const titleEl = document.getElementById('draft-banner-title');
            const descEl = document.getElementById('draft-banner-desc');
            
            if (titleEl) titleEl.textContent = `📝 진행 중인 모의고사: ${draft.examTitle}`;
            if (descEl) descEl.textContent = `이전 진행 상태 복구 가능 (남은 시간: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}, 풀이한 문항: ${Object.keys(draft.userAnswers).length}/${draft.questions.length})`;
            
            banner.style.display = 'flex';
        } catch(e) {
            banner.style.display = 'none';
        }
    } else {
        banner.style.display = 'none';
    }
}

function resumeSimDraft() {
    const saved = localStorage.getItem('sim_draft_session');
    if (!saved) return;
    
    try {
        const draft = JSON.parse(saved);
        
        simState.examId = draft.examId;
        simState.data = {
            id: draft.examId,
            title: draft.examTitle,
            questions: draft.questions
        };
        simState.currentIndex = draft.currentIndex;
        simState.userAnswers = draft.userAnswers;
        simState.timeLeft = draft.timeLeft;
        simState.wrongQuestions = [];
        
        document.getElementById('exam-list-panel').style.display = 'none';
        document.getElementById('sim-result-panel').style.display = 'none';
        document.getElementById('sim-review-panel').style.display = 'none';
        document.getElementById('sim-arena-panel').style.display = 'block';

        document.getElementById('sim-exam-title').textContent = draft.examTitle;
        renderOMRSheet();
        renderSimQuestion();

        startSimTimer();
        
        // 메인 뷰 전환 강제 처리
        state.currentView = 'exam-view';
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(nav => {
            if (nav.getAttribute('data-target') === 'exam-view') {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });
        const sections = document.querySelectorAll('.view-section');
        sections.forEach(sec => {
            if (sec.id === 'exam-view') {
                sec.classList.add('active');
            } else {
                sec.classList.remove('active');
            }
        });
        
        const banner = document.getElementById('draft-resume-banner');
        if (banner) banner.style.display = 'none';
        
    } catch(e) {
        console.error("Failed to resume draft: ", e);
        alert("저장된 모의고사 세션을 불러오지 못했습니다.");
    }
}

function exitSimArena() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    
    // UI 전환
    document.getElementById('sim-arena-panel').style.display = 'none';
    document.getElementById('sim-result-panel').style.display = 'none';
    document.getElementById('sim-review-panel').style.display = 'none';
    document.getElementById('exam-list-panel').style.display = 'block';
    
    // 대시보드 갱신하여 배너 확인
    checkExamDraft();
}

/* =======================================================
    ⏱️ 시험 타이머 (백그라운드 탭 스로틀링 방지)
    * 단순 setInterval 초 차감 대신, 시작 시각의 절대 타임스탬프 차이(Date.now())
    * 기반으로 남은 시간을 계산하여, 백그라운드 탭 전환 시에도 실제 경과 시간이
    * 정확히 반영되도록 합니다. (뽀모도로 타이머와 동일한 방식)
    ======================================================= */
function startSimTimer() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    // 현재 남은 시간을 기준으로 종료 시각을 고정
    simState.endTime = Date.now() + (simState.timeLeft * 1000);
    simState.timerInterval = setInterval(tickSimTimer, 500); // 500ms 간격 갱신
    tickSimTimer();
}

function tickSimTimer() {
    // 절대 시각 기반 남은 시간 계산 (백그라운드 스로틀링 극복 핵심)
    const remaining = Math.max(0, Math.round((simState.endTime - Date.now()) / 1000));
    simState.timeLeft = remaining;
    
    if (simState.timeLeft <= 0) {
        clearInterval(simState.timerInterval);
        const timeEl = document.getElementById('sim-time-left');
        if (timeEl) timeEl.textContent = '00:00';
        alert("제한 시간이 만료되었습니다. 답안지가 자동 제출됩니다.");
        submitExam();
        return;
    }
    
    const minutes = Math.floor(simState.timeLeft / 60);
    const seconds = simState.timeLeft % 60;
    document.getElementById('sim-time-left').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
    // 매 5초마다 타이머 임시 저장
    if (simState.timeLeft % 5 === 0) {
        saveSimDraft();
    }
}

function renderOMRSheet() {
    const omrGrid = document.getElementById('omr-grid');
    omrGrid.innerHTML = '';
    
    const total = simState.data.questions.length;
    document.getElementById('omr-total-count').textContent = total;
    
    for (let i = 0; i < total; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'omr-bubble';
        bubble.id = `omr-b-${i}`;
        bubble.textContent = i + 1;
        bubble.addEventListener('click', () => {
            jumpToSimQuestion(i);
        });
        omrGrid.appendChild(bubble);
    }
    updateOMRProgress();
}

function updateOMRProgress() {
    let solvedCount = 0;
    const total = simState.data.questions.length;
    
    for (let i = 0; i < total; i++) {
        const qId = simState.data.questions[i].id;
        const bubble = document.getElementById(`omr-b-${i}`);
        
        if (bubble) {
            // 풀었는지 여부 확인
            if (simState.userAnswers[qId] && String(simState.userAnswers[qId]).trim() !== '') {
                bubble.classList.add('solved');
                solvedCount++;
            } else {
                bubble.classList.remove('solved');
            }
            
            // 현재 문제 활성화
            if (i === simState.currentIndex) {
                bubble.classList.add('active');
            } else {
                bubble.classList.remove('active');
            }
        }
    }
    
    document.getElementById('omr-solved-count').textContent = solvedCount;
}

function jumpToSimQuestion(index) {
    simState.currentIndex = index;
    renderSimQuestion();
}

function renderSimQuestion() {
    const q = simState.data.questions[simState.currentIndex];
    
    // 문제 정보 주입
    document.getElementById('sim-q-num').textContent = `Q ${simState.currentIndex + 1} / ${simState.data.questions.length}`;
    
    let typeName = '단답형';
    if (q.type === 'choice') typeName = '객관식 5지선다';
    else if (q.type === 'ox') typeName = '진위형 OX';
    document.getElementById('sim-q-type').textContent = typeName;
    
    // 개행 문자를 BR 태그로 치환해 질문 가독성 보장
    document.getElementById('sim-q-text').innerHTML = safeTextWithBreaks(q.question);
    
    // 옵션 컨테이너 채우기
    const container = document.getElementById('sim-options-container');
    container.innerHTML = '';
    
    const savedAns = simState.userAnswers[q.id] || '';
    
    if (q.type === 'choice') {
        const optionIndicators = ['①', '②', '③', '④', '⑤'];
        q.options.forEach((optText, idx) => {
            const ind = optionIndicators[idx] || String(idx + 1);
            const isSelected = (savedAns === ind);
            
            const btn = document.createElement('div');
            btn.className = `sim-option-item ${isSelected ? 'active' : ''}`;
            btn.innerHTML = `<span class="opt-num">${esc(ind)}</span> <span class="opt-text">${esc(optText)}</span>`;
            btn.addEventListener('click', () => {
                saveSimAnswer(q.id, ind);
            });
            container.appendChild(btn);
        });
    } else if (q.type === 'ox') {
        q.options.forEach(optVal => {
            const isSelected = (savedAns === optVal);
            const btn = document.createElement('div');
            btn.className = `sim-option-item ${isSelected ? 'active' : ''}`;
            btn.innerHTML = `<span class="opt-num"><i class="fa-solid ${optVal === 'O' ? 'fa-circle' : 'fa-xmark'}"></i></span> <span class="opt-text">${optVal} 퀴즈</span>`;
            btn.addEventListener('click', () => {
                saveSimAnswer(q.id, optVal);
            });
            container.appendChild(btn);
        });
    } else {
        // 단답형 빈칸 주관식
        const inputDiv = document.createElement('div');
        inputDiv.className = 'sim-input-wrapper';
        inputDiv.innerHTML = `
            <input type="text" id="sim-text-input" class="form-input" placeholder="정답을 입력하세요 (예: (A) 5, (B) 10)" value="${esc(savedAns)}" autocomplete="off">
        `;
        container.appendChild(inputDiv);
        
        const textInput = document.getElementById('sim-text-input');
        textInput.focus();
        
        // 입력 변경 감지
        textInput.addEventListener('input', (e) => {
            saveSimAnswer(q.id, e.target.value, false);
        });
        
        // 엔터키 누르면 다음 문제
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('sim-next-btn').click();
            }
        });
    }
    
    // 이전/다음 버튼 보이기 여부 및 제어
    const prevBtn = document.getElementById('sim-prev-btn');
    const nextBtn = document.getElementById('sim-next-btn');
    const submitBtn = document.getElementById('sim-submit-exam-btn');
    
    if (simState.currentIndex === 0) {
        prevBtn.style.visibility = 'hidden';
    } else {
        prevBtn.style.visibility = 'visible';
    }
    
    if (simState.currentIndex === simState.data.questions.length - 1) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-flex';
    } else {
        nextBtn.style.display = 'inline-flex';
        submitBtn.style.display = 'none';
    }
    
    updateOMRProgress();
}

function saveSimAnswer(qId, value, triggerRender = true) {
    simState.userAnswers[qId] = value;
    if (triggerRender) {
        renderSimQuestion();
    } else {
        updateOMRProgress();
    }
    saveSimDraft();
}

function submitExam() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    
    // 점수 채점 및 틀린 문항 수집
    let score = 0;
    const total = simState.data.questions.length;
    simState.wrongQuestions = [];
    
    // 과목별 정답 및 총 문제수 집계용
    const subjectScores = {
        'subject1': { score: 0, total: 0 },
        'subject2': { score: 0, total: 0 },
        'subject3': { score: 0, total: 0 },
        'subject4': { score: 0, total: 0 }
    };
    
    for (let i = 0; i < total; i++) {
        const q = simState.data.questions[i];
        const userAns = simState.userAnswers[q.id] || '';
        
        const isCorrect = checkShortAnswer(userAns, q.answer);
        
        if (isCorrect) {
            score++;
        } else {
            simState.wrongQuestions.push({
                ...q,
                userAnswer: userAns
            });
            
            // 틀린 문제는 복습용 오답 카드로 자동으로 등록! (중요 기능 요구사항 구현)
            const fakeCardId = `weak_sim_${q.id}`;
            state.weakCards.add(fakeCardId);
        }
        
        // 과목 판별 및 집계
        let subj = q.subject;
        if (!subj) {
            if (q.id.startsWith('subject1') || q.id.includes('subject1')) subj = 'subject1';
            else if (q.id.startsWith('subject2') || q.id.includes('subject2')) subj = 'subject2';
            else if (q.id.startsWith('subject3') || q.id.includes('subject3')) subj = 'subject3';
            else if (q.id.startsWith('subject4') || q.id.includes('subject4')) subj = 'subject4';
        }
        
        if (subj && subjectScores[subj]) {
            subjectScores[subj].total++;
            if (isCorrect) {
                subjectScores[subj].score++;
            }
        }
    }
    
    saveProgress();
    clearSimDraft(); // 제출 시 임시 세션 제거
    
    // 과목별 정답률 계산
    const subjectRates = {};
    let hasSubjectData = false;
    Object.keys(subjectScores).forEach(subj => {
        if (subjectScores[subj].total > 0) {
            subjectRates[subj] = Math.round((subjectScores[subj].score / subjectScores[subj].total) * 100);
            hasSubjectData = true;
        } else {
            subjectRates[subj] = null;
        }
    });
    
    // 모의고사 결과 성적 이력 저장 및 성적 분석 연동
    saveExamResultToHistory(simState.data.id, score, total, hasSubjectData ? subjectRates : null);
    
    // 결과 패널 세팅
    document.getElementById('sim-arena-panel').style.display = 'none';
    document.getElementById('sim-result-panel').style.display = 'block';
    
    document.getElementById('sim-result-score').textContent = `${score} / ${total} 개`;
    const rate = Math.round((score / total) * 100);
    document.getElementById('sim-result-rate').textContent = `${rate}%`;

    // 과목별 상세 보고서 생성 (신규 Feature 2)
    const breakdownContainer = document.getElementById('sim-result-breakdown');
    if (breakdownContainer) {
        breakdownContainer.innerHTML = '';
        
        let breakdownHTML = `<h4 style="margin-top: 0; margin-bottom: 1rem; color: #fff; font-size: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;"><i class="fa-solid fa-chart-pie color-primary" style="color: var(--color-primary);"></i> 과목별 성적 상세 분석</h4>`;
        breakdownHTML += `<div style="display: flex; flex-direction: column; gap: 0.75rem;">`;
        
        const subjNames = {
            'subject1': '1과목: 화장품법의 이해',
            'subject2': '2과목: 화장품 제조 및 품질관리',
            'subject3': '3과목: 유통화장품 안전관리',
            'subject4': '4과목: 맞춤형화장품의 이해'
        };
        
        let failedSubjects = [];
        
        Object.keys(subjectScores).forEach(subj => {
            const data = subjectScores[subj];
            if (data.total > 0) {
                const subRate = Math.round((data.score / data.total) * 100);
                const isFail = subRate < 40;
                if (isFail) {
                    failedSubjects.push({ id: subj, name: subjNames[subj], rate: subRate });
                }
                
                const progressColor = isFail ? '#ef4444' : (subRate >= 60 ? '#10b981' : '#f59e0b');
                
                breakdownHTML += `
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                            <span style="font-weight: 600; color: #e5e7eb;">${esc(subjNames[subj])}</span>
                            <span style="color: ${progressColor}; font-weight: 700;">
                                ${data.score} / ${data.total} (${subRate}%)
                                ${isFail ? ' <span style="background:#ef4444; color:#fff; font-size:0.7rem; padding:1px 4px; border-radius:3px; margin-left:3px;">과락</span>' : ''}
                            </span>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow: hidden; width: 100%;">
                            <div style="background: ${progressColor}; width: ${subRate}%; height: 100%;"></div>
                        </div>
                    </div>
                `;
            }
        });
        
        breakdownHTML += `</div>`;
        
        // 과락 분석 및 추천 피드백
        if (failedSubjects.length > 0) {
            breakdownHTML += `
                <div style="margin-top: 1.25rem; padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px;">
                    <h5 style="margin: 0 0 0.5rem 0; color: #ef4444; font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> 과락 주의 경고!</h5>
                    <p style="margin: 0; font-size: 0.8rem; color: #fca5a5; line-height: 1.5;">
                        실제 시험 기준 한 과목이라도 40% 미만 득점 시 전체 평균이 60%를 넘어도 불합격 처리됩니다. 아래 추천 학습으로 약점을 빠르게 보완해 보세요.
                    </p>
                    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            `;
            
            failedSubjects.forEach(f => {
                const subKey = f.id === 'subject1' ? 'law' : (f.id === 'subject2' ? 'manufacturing' : (f.id === 'subject3' ? 'safety' : 'understanding'));
                breakdownHTML += `
                    <button class="btn" onclick="startFocusSubjectStudy('${subKey}')" style="padding: 3px 8px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;">
                        <i class="fa-solid fa-bolt"></i> ${esc(f.name.split(':')[0])} 퀴즈 풀기
                    </button>
                `;
            });
            
            breakdownHTML += `
                    </div>
                </div>
            `;
        } else {
            // 합격 요건 확인
            const overallRate = Math.round((score / total) * 100);
            if (overallRate >= 60) {
                breakdownHTML += `
                    <div style="margin-top: 1.25rem; padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px;">
                        <h5 style="margin: 0 0 0.25rem 0; color: #10b981; font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-circle-check"></i> 합격 예측: 합격 안정권</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: #a7f3d0; line-height: 1.5;">
                            전체 정답률 60% 이상 및 모든 과목 과락 패스 요건을 완벽히 충족하셨습니다! 이 컨디션을 실제 시험장까지 유지해 보세요.
                        </p>
                    </div>
                `;
            } else {
                breakdownHTML += `
                    <div style="margin-top: 1.25rem; padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 6px;">
                        <h5 style="margin: 0 0 0.25rem 0; color: #f59e0b; font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-circle-exclamation"></i> 합격 예측: 전체 평균 미달</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: #fde68a; line-height: 1.5;">
                            과락은 면했으나 합격 커트라인인 전체 평균 60%에 도달하지 못했습니다. 오답 해설 풀이를 통해 부족한 이론을 보완해 보세요.
                        </p>
                    </div>
                `;
            }
        }
        
        breakdownContainer.innerHTML = breakdownHTML;
        breakdownContainer.style.display = 'block';
    }
}

function examIdToSubjectId(examId) {
    if (examId.startsWith('subject1')) return 'law';
    if (examId.startsWith('subject2')) return 'manufacturing';
    if (examId.startsWith('subject3')) return 'safety';
    if (examId.startsWith('subject4')) return 'understanding';
    return 'law';
}

function showSimAnswerReview() {
    document.getElementById('sim-result-panel').style.display = 'none';
    document.getElementById('sim-review-panel').style.display = 'block';
    
    const container = document.getElementById('sim-review-list-container');
    container.innerHTML = '';
    
    if (simState.wrongQuestions.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--color-success);"><i class="fa-solid fa-circle-check"></i> 만점입니다! 틀린 문제가 하나도 없습니다.</p>';
        return;
    }
    
    simState.wrongQuestions.forEach((q, idx) => {
        let optionsHTML = '';
        if (q.options && q.options.length > 0) {
            optionsHTML = `<ul class="review-q-options">
                ${q.options.map(opt => `<li>${esc(opt)}</li>`).join('')}
            </ul>`;
        }
        
        const itemHTML = `
            <div class="sim-review-item">
                <div class="review-item-header">
                    <span class="badge badge-quiz-cat">Q ${q.num}</span>
                    <span class="badge badge-quiz-type">${q.type === 'choice' ? '객관식' : q.type === 'ox' ? '진위형' : '단답형'}</span>
                </div>
                <p class="review-item-q-text">${safeTextWithBreaks(q.question)}</p>
                ${optionsHTML}
                <div class="review-answer-panel">
                    <p>❌ 내가 쓴 답: <strong class="color-danger">${esc(q.userAnswer || '(공란)')}</strong></p>
                    <p>✅ 올바른 정답: <strong class="color-success">${esc(q.answer)}</strong></p>
                </div>
                <div class="review-explanation-panel">
                    <h5>정답 해설 및 분석</h5>
                    <p>${safeTextWithBreaks(q.explanation)}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

function showSimResultsSummary() {
    document.getElementById('sim-review-panel').style.display = 'none';
    document.getElementById('sim-result-panel').style.display = 'block';
}

// --- 6. 스마트 훈련소 (수치/계산) 구현 ---
const LIMITS_DB = [
    { category: '보존제 사용한도', key: '페녹시에탄올', value: '1.0', unit: '%', condition: '최대 한도', explanation: '페녹시에탄올의 사용 한도는 최종 화장품 제품에서 1.0% 이하입니다.' },
    { category: '보존제 사용한도', key: '벤조익애씨드 및 그 염류', value: '0.5', unit: '%', condition: '씻어내지 않는 제품 기준', explanation: '벤조익애씨드 및 그 염류의 사용 한도는 씻어내지 않는 제품 기준 0.5% 이하입니다. (씻어내는 제품은 2.5% 이하)' },
    { category: '보존제 사용한도', key: '살리실릭애씨드(살리실산)', value: '0.5', unit: '%', condition: '기본 화장품 기준', explanation: '살리실릭애씨드 및 그 염류의 기본 사용 한도는 0.5% 이하이며, 영유아용 및 만 13세 이하 어린이 제품에는 사용이 제한됩니다. (샴푸 등 씻어내는 제품은 제외)' },
    { category: '자외선차단제 사용한도', key: '티타늄디옥사이드', value: '25.0', unit: '%', condition: '배합 한도', explanation: '자외선 차단 성분인 티타늄디옥사이드의 최종 제품 내 사용 한도는 25.0% 이하입니다.' },
    { category: '자외선차단제 사용한도', key: '징크옥사이드', value: '25.0', unit: '%', condition: '배합 한도', explanation: '자외선 차단 성분인 징크옥사이드의 최종 제품 내 사용 한도는 25.0% 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '납(일반 제품)', value: '20', unit: '㎍/g', condition: '허용 한도', explanation: '유통화장품 안전관리 기준에서 일반 화장품의 납 검출 한도는 20 ㎍/g 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '납(점토 원료 분말 제품)', value: '50', unit: '㎍/g', condition: '허용 한도', explanation: '점토(Clay)를 원료로 사용한 분말 제품의 경우 납 검출 허용 한도는 50 ㎍/g 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '비소', value: '10', unit: '㎍/g', condition: '허용 한도', explanation: '유통화장품 안전관리 기준에서 비소의 검출 허용 한도는 10 ㎍/g 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '수은', value: '1', unit: '㎍/g', condition: '허용 한도', explanation: '유통화장품 안전관리 기준에서 수은의 검출 허용 한도는 1 ㎍/g 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '안티몬', value: '10', unit: '㎍/g', condition: '허용 한도', explanation: '유통화장품 안전관리 기준에서 안티몬의 검출 허용 한도는 10 ㎍/g 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '카드뮴', value: '5', unit: '㎍/g', condition: '허용 한도', explanation: '유통화장품 안전관리 기준에서 카드뮴의 검출 허용 한도는 5 ㎍/g 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '디옥산', value: '100', unit: '㎍/g', condition: '허용 한도', explanation: '유통화장품 안전관리 기준에서 제조 공정상 생성되는 디옥산의 허용 한도는 100 ㎍/g 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '메탄올(일반 제품)', value: '0.2', unit: '%', condition: 'v/v 기준', explanation: '일반 유통화장품의 메탄올 허용 한도는 0.2% (v/v) 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '메탄올(물휴지)', value: '0.002', unit: '%', condition: 'v/v 기준', explanation: '물휴지의 메탄올 허용 한도는 0.002% (v/v) 이하로 훨씬 엄격합니다.' },
    { category: '유통화장품 안전성 기준', key: '포름알데히드(일반 제품)', value: '2000', unit: '㎍/g', condition: '허용 한도', explanation: '유통화장품 안전관리 기준에서 포름알데히드의 검출 허용 한도는 2,000 ㎍/g 이하입니다.' },
    { category: '유통화장품 안전성 기준', key: '프탈레이트류(합계)', value: '100', unit: '㎍/g', condition: '허용 한도', explanation: '디부틸프탈레이트(DBP), 디에틸헥실프탈레이트(DEHP) 등 프탈레이트류 합계의 허용 한도는 100 ㎍/g 이하입니다.' },
    { category: '미생물 한도 기준', key: '총호기성생균수(일반 제품)', value: '1000', unit: '개/g(mL)', condition: '허용 한도', explanation: '일반 화장품에서 세균 및 진균수의 합(총호기성생균수)은 1,000개/g(mL) 이하이어야 합니다.' },
    { category: '미생물 한도 기준', key: '총호기성생균수(영유아 및 눈화장용)', value: '500', unit: '개/g(mL)', condition: '허용 한도', explanation: '영유아용 및 눈화장용 제품류의 총호기성생균수 기준은 500개/g(mL) 이하로 엄격합니다.' },
    { category: '천연 및 유기농 기준', key: '천연화장품 천연 유래 원료 함량', value: '95', unit: '%', condition: '중량 기준', explanation: '천연화장품은 전체 중량 기준 천연 및 천연 유래 원료 함량이 95% 이상이어야 합니다.' },
    { category: '천연 및 유기농 기준', key: '유기농화장품 유기농 원료 함량', value: '10', unit: '%', condition: '중량 기준', explanation: '유기농화장품은 천연/천연유래 원료 95% 이상 조건과 더불어 유기농 원료가 전체 중량 기준 10% 이상 포함되어야 합니다.' },
    { category: '기능성화장품 고시 기준', key: '나이아신아마이드(미백)', value: '2.0 ~ 5.0', unit: '%', condition: '고시 함량', explanation: '식약처 미백 고시 성분인 나이아신아마이드의 사용 함량 기준은 2.0% ~ 5.0% 입니다.' },
    { category: '기능성화장품 고시 기준', key: '알부틴(미백)', value: '2.0 ~ 5.0', unit: '%', condition: '고시 함량', explanation: '식약처 미백 고시 성분인 알부틴의 사용 함량 기준은 2.0% ~ 5.0% 입니다.' },
    { category: '기능성화장품 고시 기준', key: '아데노신(주름개선)', value: '0.04', unit: '%', condition: '고시 함량', explanation: '식약처 주름개선 고시 성분인 아데노신의 사용 함량 기준은 0.04% 입니다.' }
];

function initTrainer() {
    state.trainer.activeSubView = 'menu';
    document.getElementById('trainer-menu-panel').style.display = 'block';
    document.getElementById('trainer-limits-panel').style.display = 'none';
    document.getElementById('trainer-calc-panel').style.display = 'none';
    document.getElementById('trainer-ingredients-panel').style.display = 'none';
}

function exitTrainerSubView() {
    initTrainer();
}

/* 수치 암기 마스터 로직 */
function startLimitsTrainer() {
    state.trainer.activeSubView = 'limits';
    state.trainer.limits.currentIndex = 0;
    state.trainer.limits.correctCount = 0;
    state.trainer.limits.shuffledData = [...LIMITS_DB].sort(() => 0.5 - Math.random());
    
    document.getElementById('trainer-menu-panel').style.display = 'none';
    document.getElementById('trainer-limits-panel').style.display = 'block';
    
    renderLimitsQuestion();
}

function renderLimitsQuestion() {
    const limitsState = state.trainer.limits;
    const currentQ = limitsState.shuffledData[limitsState.currentIndex];
    
    document.getElementById('limits-progress-indicator').textContent = `문제 ${limitsState.currentIndex + 1} / ${limitsState.shuffledData.length}`;
    document.getElementById('limits-q-category').textContent = currentQ.category;
    
    const qText = `다음 중 <strong>${esc(currentQ.category)}</strong> 성분인 <strong>"${esc(currentQ.key)}"</strong>의 기준 수치(<strong>${esc(currentQ.condition)}</strong>)로 올바른 것은?`;
    document.getElementById('limits-question-text').innerHTML = qText;
    
    const options = generateLimitsOptions(currentQ);
    const container = document.getElementById('limits-options-container');
    container.innerHTML = '';
    
    const optionIndicators = ['A', 'B', 'C', 'D'];
    options.forEach((optValue, idx) => {
        const btn = document.createElement('button');
        btn.className = 'limits-opt-btn';
        
        let displayStr = `${optValue} ${currentQ.unit} 이하`;
        if (currentQ.unit === '%') {
            displayStr = `${optValue}${currentQ.unit} 이하`;
        }
        
        if (currentQ.category.includes('천연 및 유기농') || currentQ.category.includes('고시 기준')) {
            const isRange = optValue.includes('~');
            displayStr = `${optValue}${currentQ.unit}${isRange ? '' : ' 이상'}`;
        }
        
        btn.innerHTML = `<span class="limits-opt-num">${esc(optionIndicators[idx])}</span> <span class="limits-opt-text">${esc(displayStr)}</span>`;
        btn.addEventListener('click', () => {
            submitLimitsAnswer(btn, optValue, currentQ.value);
        });
        container.appendChild(btn);
    });
    
    document.getElementById('limits-feedback-panel').style.display = 'none';
    document.getElementById('next-limits-btn').style.display = 'none';
}

function generateLimitsOptions(question) {
    const correctValue = question.value;
    const optionsSet = new Set([correctValue]);
    
    let attempts = 0;
    while (optionsSet.size < 4 && attempts < 100) {
        attempts++;
        let distractor = '';
        if (correctValue.includes('~')) {
            const dists = ['1.0 ~ 3.0', '2.0 ~ 4.0', '3.0 ~ 5.0', '1.0 ~ 5.0', '3.0 ~ 10.0', '0.5 ~ 2.0'];
            distractor = dists[Math.floor(Math.random() * dists.length)];
        } else {
            const valNum = parseFloat(correctValue);
            if (valNum <= 0.1) {
                const shift = valNum === 0.04 ? [0.01, 0.02, 0.05, 0.1, 0.08] : [0.001, 0.005, 0.01, 0.02];
                distractor = String(shift[Math.floor(Math.random() * shift.length)]);
            } else if (valNum <= 1.0) {
                const shift = [0.1, 0.2, 0.3, 0.5, 1.0, 1.5, 2.0];
                distractor = String(shift[Math.floor(Math.random() * shift.length)]);
            } else if (valNum <= 50) {
                const shift = [5, 10, 15, 20, 25, 30, 40, 50, 60, 100];
                distractor = String(shift[Math.floor(Math.random() * shift.length)]);
            } else {
                const shift = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000];
                distractor = String(shift[Math.floor(Math.random() * shift.length)]);
            }
        }
        if (distractor !== correctValue && distractor !== '') {
            optionsSet.add(distractor);
        }
    }
    
    while (optionsSet.size < 4) {
        optionsSet.add(String((parseFloat(correctValue) || 1) * (optionsSet.size + 1)));
    }
    
    return [...optionsSet].sort(() => 0.5 - Math.random());
}

function submitLimitsAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
    const container = document.getElementById('limits-options-container');
    const buttons = container.querySelectorAll('.limits-opt-btn');
    
    buttons.forEach(btn => {
        btn.disabled = true;
        const textSpan = btn.querySelector('.limits-opt-text');
        if (textSpan.textContent.includes(correctValue)) {
            btn.classList.add('correct');
        }
    });
    
    if (!isCorrect) {
        selectedBtn.classList.add('incorrect');
    } else {
        state.trainer.limits.correctCount++;
    }
    
    const currentQ = state.trainer.limits.shuffledData[state.trainer.limits.currentIndex];
    const feedbackPanel = document.getElementById('limits-feedback-panel');
    const feedbackTitle = document.getElementById('limits-feedback-title');
    const feedbackDesc = document.getElementById('limits-feedback-desc');
    
    feedbackPanel.style.display = 'flex';
    if (isCorrect) {
        feedbackPanel.classList.remove('incorrect');
        feedbackTitle.textContent = '정답입니다!';
    } else {
        feedbackPanel.classList.add('incorrect');
        feedbackTitle.textContent = `오답입니다! (정답: ${correctValue}${currentQ.unit})`;
    }
    feedbackDesc.textContent = currentQ.explanation;
    
    document.getElementById('next-limits-btn').style.display = 'inline-flex';
}

function nextLimitsQuestion() {
    const limitsState = state.trainer.limits;
    limitsState.currentIndex++;
    
    if (limitsState.currentIndex >= limitsState.shuffledData.length) {
        alert(`수치 암기 훈련 세션이 종료되었습니다!\n맞춘 문제: ${limitsState.correctCount} / ${limitsState.shuffledData.length} 개`);
        initTrainer();
    } else {
        renderLimitsQuestion();
    }
}

/* 원료 배합 계산 연습기 로직 */
function startCalcPractice() {
    state.trainer.activeSubView = 'calc';
    state.trainer.calc.correctCount = 0;
    state.trainer.calc.totalSolved = 0;
    
    document.getElementById('trainer-menu-panel').style.display = 'none';
    document.getElementById('trainer-calc-panel').style.display = 'block';
    
    // 연습장 초기 상태: 닫힘
    const scratchpadContainer = document.getElementById('calc-scratchpad-container');
    const toggleBtn = document.getElementById('calc-scratchpad-toggle');
    if (scratchpadContainer) scratchpadContainer.style.display = 'none';
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-pencil"></i> ✏️ 계산 연습장 열기';
    
    renderCalcHistory(); // 풀이 이력 렌더링
    generateCalcQuestion();
}

function generateCalcQuestion() {
    const qData = buildCalcQuestion();
    state.trainer.calc.currentQuestion = qData;
    
    document.getElementById('calc-type-badge').textContent = qData.type;
    // ì ë¢°ë HTML: buildCalcQuestion()ê° ì«ì+<strong>ë¡ ì¡°ë¦½(raw ì¬ì©ì ë°ì´í° ìì). ì¸ë¶ ë°ì´í° ì°ê²° ì esc() íì.
    document.getElementById('calc-question-text').innerHTML = qData.question;
    document.getElementById('calc-unit-text').textContent = qData.unit;
    
    const input = document.getElementById('calc-answer-input');
    input.value = '';
    input.disabled = false;
    input.focus();
    
    document.getElementById('submit-calc-btn').disabled = false;
    document.getElementById('calc-feedback-panel').style.display = 'none';
    document.getElementById('calc-solution-panel').style.display = 'none';
    document.getElementById('next-calc-btn').style.display = 'none';
    
    const header = document.querySelector('.solution-header');
    if (header) {
        header.classList.remove('active');
        document.getElementById('calc-solution-body').style.display = 'none';
    }
    
    if (typeof clearScratchpad === 'function') {
        clearScratchpad();
    }
}

function submitCalcAnswer() {
    const calcState = state.trainer.calc;
    const currentQ = calcState.currentQuestion;
    const input = document.getElementById('calc-answer-input');
    const userVal = parseFloat(input.value);
    
    if (isNaN(userVal)) {
        alert("올바른 숫자를 입력해 주세요!");
        return;
    }
    
    input.disabled = true;
    document.getElementById('submit-calc-btn').disabled = true;
    
    calcState.totalSolved++;
    
    const correctVal = parseFloat(currentQ.answer);
    const isCorrect = Math.abs(userVal - correctVal) <= 0.02;
    
    if (isCorrect) {
        calcState.correctCount++;
    }
    
    if (typeof addCalcHistoryItem === 'function') {
        addCalcHistoryItem(currentQ.question, currentQ.type, userVal, currentQ.answer, isCorrect, currentQ.unit);
    }
    
    const feedbackPanel = document.getElementById('calc-feedback-panel');
    const feedbackTitle = document.getElementById('calc-feedback-title');
    const feedbackDesc = document.getElementById('calc-feedback-desc');
    
    feedbackPanel.style.display = 'flex';
    if (isCorrect) {
        feedbackPanel.classList.remove('incorrect');
        feedbackTitle.textContent = '정답입니다!';
        feedbackDesc.textContent = `훌륭합니다! 올바른 배합 계산 결과입니다.`;
    } else {
        feedbackPanel.classList.add('incorrect');
        feedbackTitle.textContent = `오답입니다! (내가 쓴 답: ${userVal}${currentQ.unit})`;
        feedbackDesc.textContent = `정답은 약 ${currentQ.answer}${currentQ.unit} 입니다. 아래의 공식을 활용하여 풀이법을 다시 체크해 보세요.`;
    }
    
    // ì ë¢°ë HTML: íì´ë ì½ëê° <br>/<strong>+ì«ìë¡ ì¡°ë¦½. raw ì¬ì©ì ë°ì´í° ì£¼ì ê¸ì§.
    document.getElementById('calc-solution-body').innerHTML = currentQ.solution;
    document.getElementById('calc-solution-panel').style.display = 'block';
    document.getElementById('next-calc-btn').style.display = 'inline-flex';
}

function toggleSolutionAccordion() {
    const header = document.querySelector('.solution-header');
    const body = document.getElementById('calc-solution-body');
    const isVisible = (body.style.display === 'block');
    
    if (isVisible) {
        header.classList.remove('active');
        body.style.display = 'none';
    } else {
        header.classList.add('active');
        body.style.display = 'block';
    }
}

/* =======================================================
   🧠 주관식 유사어 채점 엔진 (Smart Synonym Matcher)
   ======================================================= */
const SYNONYMS_DICTIONARY = {
    '식품의약품안전처장': ['식약처장', '식품의약품안전처', '식약처'],
    '식약처장': ['식품의약품안전처장', '식품의약품안전처', '식약처'],
    '우수화장품제조및품질관리기준': ['cgmp', '씨지에이치피', '씨지엠피', '우수화장품제조기준'],
    'cgmp': ['우수화장품제조및품질관리기준', '우수화장품제조기준', '씨지에이치피', '씨지엠피'],
    '피부장벽': ['장벽', '피부 장벽'],
    '천연원료': ['천연 원료'],
    '유기농원료': ['유기농 원료'],
    '자외선차단제': ['자차', '자외선차단'],
    '기능성화장품': ['기능성'],
    '맞춤형화장품': ['맞춤형']
};

function checkShortAnswer(userInput, correctAnswer) {
    if (!userInput || !correctAnswer) return false;
    
    const cleanUser = cleanForCompare(userInput);
    const cleanCorrect = cleanForCompare(correctAnswer);
    
    if (cleanUser === cleanCorrect) return true;
    
    // 한글 조사 제거 헬퍼 함수
    const removeJosa = (str) => {
        if (str.length > 2) {
            const lastChar = str.slice(-1);
            if (['이', '가', '을', '를', '은', '는'].includes(lastChar)) {
                return str.slice(0, -1);
            }
        }
        return str;
    };
    
    if (removeJosa(cleanUser) === removeJosa(cleanCorrect)) return true;
    
    // 여러 정답 대조 (쉼표, 슬래시 분기)
    // 단, (A)와 (B) 또는 ①과 ②처럼 멀티 파트가 결합된 정답 식별 시에는 분할하지 않음
    const hasMultipleParts = (
        (correctAnswer.includes('(A)') && correctAnswer.includes('(B)')) ||
        (correctAnswer.includes('[A]') && correctAnswer.includes('[B]')) ||
        (correctAnswer.includes('①') && correctAnswer.includes('②'))
    );
    
    let splitCorrects = [];
    if (!hasMultipleParts) {
        splitCorrects = correctAnswer.split(/[,/]/).map(val => cleanForCompare(val));
        if (splitCorrects.some(val => val === cleanUser)) return true;
        if (splitCorrects.some(val => removeJosa(cleanUser) === removeJosa(val))) return true;
    }
    
    // 유사어 사전 대조
    for (const [key, synonyms] of Object.entries(SYNONYMS_DICTIONARY)) {
        const cleanKey = cleanForCompare(key);
        if (cleanCorrect === cleanKey || splitCorrects.includes(cleanKey)) {
            if (synonyms.map(s => cleanForCompare(s)).includes(cleanUser)) {
                return true;
            }
        }
    }
    
    return false;
}

/* =======================================================
   🧪 화장품 원료 안전성 챌린지 훈련 로직 (Ingredients Safety Trainer)
   ======================================================= */

function startIngredientsChallenge() {
    state.trainer.activeSubView = 'ingredients';
    state.trainer.ingredients.currentIndex = 0;
    state.trainer.ingredients.correctCount = 0;
    state.trainer.ingredients.shuffledQuestions = generateIngredientsQuestions();
    
    document.getElementById('trainer-menu-panel').style.display = 'none';
    document.getElementById('trainer-ingredients-panel').style.display = 'block';
    
    renderIngQuestion();
}

function generateIngredientsQuestions() {
    const list = [];
    const db = typeof INGREDIENTS_DATA !== 'undefined' ? INGREDIENTS_DATA : [];
    if (db.length === 0) return [];
    
    const shuffledDb = [...db].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < Math.min(10, shuffledDb.length); i++) {
        const ing = shuffledDb[i];
        
        let qType = 0; // 0: 안전성 구분, 1: 배합 한도 주관식, 2: 조제 적합성, 3: 알레르기 유발 물질
        
        if (ing.type === 'restricted' && ing.limit && Math.random() > 0.5) {
            qType = 1;
        } else if ((ing.category && (ing.category.includes('알레르기') || ing.category.includes('향료'))) && Math.random() > 0.5) {
            qType = 3;
        } else if (Math.random() > 0.6) {
            qType = 2;
        }
        
        if (qType === 0) {
            let correctText = '';
            if (ing.type === 'approved') correctText = '🟢 사용 가능 원료';
            else if (ing.type === 'restricted') correctText = '🟡 사용상의 제한이 필요한 원료 (보존제/자외선차단제 등)';
            else correctText = '🔴 사용할 수 없는 원료 (배합 금지)';
            
            list.push({
                type: 'choice',
                qTypeLabel: '안전성 판별',
                question: `화장품 안전 기준 고시상, 성분명 <strong>"${esc(ing.name)}"</strong> (${esc(ing.engName || '영문명 없음')}) 은(는) 어디에 해당합니까?`,
                correct: correctText,
                options: [
                    '🟢 사용 가능 원료',
                    '🟡 사용상의 제한이 필요한 원료 (보존제/자외선차단제 등)',
                    '🔴 사용할 수 없는 원료 (배합 금지)'
                ],
                explanation: `성분명 <strong>"${esc(ing.name)}"</strong>은(는) <strong>${correctText}</strong>에 해당합니다.<br>• 카테고리: ${esc(ing.category)}<br>• 특징: ${esc(ing.description || '법적 허용 기준 준수 대상')}<br>• 고득점 TIP: ${esc(ing.tip || '안전 기준 규격을 반드시 암기하세요.')}`
            });
        } else if (qType === 1) {
            list.push({
                type: 'short',
                qTypeLabel: '배합 한도 주관식',
                question: `사용상의 제한이 필요한 보존제/자외선 차단 성분인 <strong>"${esc(ing.name)}"</strong>의 법정 최대 배합 한도(%)는 얼마입니까?<br>(※ 성분 데이터에 명시된 수치와 % 기호 및 세부 조건을 정확히 입력하세요. 예: 1.0%, 0.5% 등)`,
                correct: ing.limit,
                explanation: `성분명 <strong>"${esc(ing.name)}"</strong>의 법정 사용 한도는 <strong>"${esc(ing.limit)}"</strong> 입니다.<br>• 특징: ${esc(ing.description || '')}<br>• 비고/TIP: ${esc(ing.tip || '')}`
            });
        } else if (qType === 2) {
            let questionText = '';
            let correctText = '';
            let options = [];
            
            if (ing.type === 'restricted') {
                questionText = `맞춤형화장품 조제관리사가 매장에서 혼합/소분 조제 시, 보존제/자외선차단 원료인 <strong>"${esc(ing.name)}"</strong>을(를) 직접 저울에 계량하여 배합할 수 있습니까?`;
                correctText = '🔴 직접 배합 불가 (벌크 내용물에 이미 포함된 형태만 허용)';
                options = [
                    '🟢 직접 배합 가능 (법적 배합 한도 내라면 직접 혼합 가능)',
                    '🔴 직접 배합 불가 (벌크 내용물에 이미 포함된 형태만 허용)'
                ];
            } else if (ing.type === 'banned') {
                questionText = `맞춤형화장품 조제관리사가 매장에서 조제 시, 배합 금지 원료인 <strong>"${esc(ing.name)}"</strong>을(를) 혼합하여 조제할 수 있습니까?`;
                correctText = '🔴 절대 배합 불가';
                options = [
                    '🟢 배합 가능',
                    '🔴 절대 배합 불가'
                ];
            } else {
                questionText = `맞춤형화장품 조제관리사가 매장에서 조제 시, 사용 가능 원료인 <strong>"${esc(ing.name)}"</strong>을(를) 직접 계량하여 배합할 수 있습니까?`;
                correctText = '🟢 직접 배합 가능';
                options = [
                    '🟢 직접 배합 가능',
                    '🔴 직접 배합 불가'
                ];
            }
            
            list.push({
                type: 'choice',
                qTypeLabel: '조제 적합성 판정',
                question: questionText,
                correct: correctText,
                options: options,
                explanation: ing.type === 'restricted' 
                    ? `별표 2 사용상의 제한이 필요한 원료는 <strong>조제관리사가 직접 매장에서 계량하여 배합하는 것이 법적으로 전면 금지</strong>됩니다. 책임판매업자가 공급한 벌크(내용물)에 이미 배합된 형태로만 유통이 가능합니다.` 
                    : (ing.type === 'banned' ? `<strong>"${esc(ing.name)}"</strong>은(는) 사용할 수 없는 원료(별표 1)에 해당하므로 화장품 제조 및 조제에 절대 사용이 불가합니다.` : `일반 사용 가능 원료(approved)인 <strong>"${esc(ing.name)}"</strong>은(는) 조제관리사가 매장에서 직접 계량하여 혼합(조제)할 수 있는 성분입니다.`)
            });
        } else {
            const isRinseOff = Math.random() > 0.5;
            const productType = isRinseOff ? '사용 후 씻어내는 제품' : '사용 후 씻어내지 않는 제품';
            
            let conc = 0;
            if (isRinseOff) {
                conc = Math.random() > 0.5 
                    ? parseFloat((0.01 + Math.random() * 0.02).toFixed(4))
                    : parseFloat((0.001 + Math.random() * 0.008).toFixed(4));
            } else {
                conc = Math.random() > 0.5 
                    ? parseFloat((0.001 + Math.random() * 0.005).toFixed(4))
                    : parseFloat((0.0001 + Math.random() * 0.0008).toFixed(4));
            }
            
            const limitVal = isRinseOff ? 0.01 : 0.001;
            const isRequired = conc > limitVal;
            const correctText = isRequired ? '🟢 의무 고지 대상' : '🔴 고지 의무 없음';
            
            list.push({
                type: 'choice',
                qTypeLabel: '알레르기 성분 표시 의무',
                question: `알레르기 유발 향료 성분인 <strong>"${esc(ing.name)}"</strong>을(를) <strong>[${esc(productType)}]</strong>에 <strong>${conc}%</strong> 배합했습니다. 화장품 포장 용기 전성분 표에 이 성분명을 별도로 기재(고지)해야 합니까?`,
                correct: correctText,
                options: [
                    '🟢 의무 고지 대상',
                    '🔴 고지 의무 없음'
                ],
                explanation: `알레르기 유발 성분 25종 기재 기준:<br>• 씻어내는 제품: <strong>0.01% 초과</strong> 시 기재 의무<br>• 씻어내지 않는 제품: <strong>0.001% 초과</strong> 시 기재 의무<br>현재 배합량 ${conc}%는 기준치 ${limitVal}%에 대해 <strong>${isRequired ? '초과' : '이하'}</strong>이므로, <strong>${correctText}</strong>이(가) 맞습니다.`
            });
        }
    }
    
    return list;
}

function renderIngQuestion() {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    
    document.getElementById('ing-progress-indicator').textContent = `문제 ${ingState.currentIndex + 1} / ${ingState.shuffledQuestions.length}`;
    document.getElementById('ing-q-type-label').textContent = currentQ.qTypeLabel;
    // ì ë¢°ë HTML: ë¬¸ì  ìì± ì ëì  ë¶ë¶ì ì´ë¯¸ esc(ing.name) ì²ë¦¬ë¨. raw ì¬ì©ì ë°ì´í° ì£¼ì ê¸ì§.
    document.getElementById('ing-question-text').innerHTML = currentQ.question;
    
    const optionsContainer = document.getElementById('ing-options-container');
    const inputContainer = document.getElementById('ing-input-container');
    const answerInput = document.getElementById('ing-answer-input');
    
    optionsContainer.innerHTML = '';
    answerInput.value = '';
    
    if (currentQ.type === 'choice') {
        optionsContainer.style.display = 'grid';
        inputContainer.style.display = 'none';
        
        const optionIndicators = ['A', 'B', 'C', 'D'];
        currentQ.options.forEach((optValue, idx) => {
            const btn = document.createElement('button');
            btn.className = 'limits-opt-btn';
            btn.innerHTML = `<span class="limits-opt-num">${optionIndicators[idx]}</span> <span class="limits-opt-text">${esc(optValue)}</span>`;
            btn.addEventListener('click', () => {
                submitIngChoiceAnswer(btn, optValue, currentQ.correct);
            });
            optionsContainer.appendChild(btn);
        });
    } else {
        optionsContainer.style.display = 'none';
        inputContainer.style.display = 'flex';
    }
    
    document.getElementById('ing-feedback-panel').style.display = 'none';
    document.getElementById('next-ing-btn').style.display = 'none';
}

function submitIngChoiceAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
    const container = document.getElementById('ing-options-container');
    const buttons = container.querySelectorAll('.limits-opt-btn');
    
    buttons.forEach(btn => {
        btn.disabled = true;
        const textSpan = btn.querySelector('.limits-opt-text');
        if (textSpan.textContent === correctValue) {
            btn.classList.add('correct');
        }
    });
    
    if (!isCorrect) {
        selectedBtn.classList.add('incorrect');
    } else {
        state.trainer.ingredients.correctCount++;
    }
    
    showIngFeedback(isCorrect, correctValue);
}

function submitIngAnswer() {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    const userInput = document.getElementById('ing-answer-input').value.trim();
    
    if (!userInput) {
        alert('정답을 입력하세요!');
        return;
    }
    
    const isCorrect = checkShortAnswer(userInput, currentQ.correct);
    if (isCorrect) {
        ingState.correctCount++;
    }
    
    showIngFeedback(isCorrect, currentQ.correct);
}

function showIngFeedback(isCorrect, correctValue) {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    
    const feedbackPanel = document.getElementById('ing-feedback-panel');
    const feedbackTitle = document.getElementById('ing-feedback-title');
    const feedbackDesc = document.getElementById('ing-feedback-desc');
    
    feedbackPanel.style.display = 'flex';
    if (isCorrect) {
        feedbackPanel.classList.remove('incorrect');
        feedbackTitle.innerHTML = '🟢 정답입니다!';
    } else {
        feedbackPanel.classList.add('incorrect');
        feedbackTitle.innerHTML = `🔴 오답입니다! (정답: <strong>${esc(correctValue)}</strong>)`;
    }
    feedbackDesc.innerHTML = safeTextWithBreaks(currentQ.explanation);
    
    document.getElementById('next-ing-btn').style.display = 'inline-flex';
    
    // Hide text input submit button to prevent duplicate submissions
    const submitBtn = document.getElementById('submit-ing-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    const answerInput = document.getElementById('ing-answer-input');
    if (answerInput) {
        answerInput.disabled = true;
    }
}

function nextIngQuestion() {
    // Re-enable text input fields
    const submitBtn = document.getElementById('submit-ing-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
    }
    const answerInput = document.getElementById('ing-answer-input');
    if (answerInput) {
        answerInput.disabled = false;
    }

    const ingState = state.trainer.ingredients;
    ingState.currentIndex++;
    
    if (ingState.currentIndex >= ingState.shuffledQuestions.length) {
        alert(`원료 안전성 챌린지가 종료되었습니다!\n맞춘 문제: ${ingState.correctCount} / ${ingState.shuffledQuestions.length} 개`);
        initTrainer();
    } else {
        renderIngQuestion();
    }
}

/* =======================================================
   ⏱️ 집중 뽀모도로 타이머 (Pomodoro Study Timer)
   * 백그라운드 탭 차단(Timer Throttling)에 의한 오차를 방지하기 위해,
   * 단순 setInterval 초 차감이 아닌 시작 시간과의 절대 타임스탬프 차이(Date.now() - startTime)를
   * 사용하여 백그라운드 환경에서도 정확한 시간이 흐르도록 계산합니다.
   ======================================================= */
function togglePomodoro() {
    const pomoState = state.trainer.pomodoro;
    const startBtn = document.getElementById('pomo-start-btn');
    const statusLabel = document.getElementById('pomo-status');
    
    if (!pomoState.isRunning) {
        // 타이머 시작 및 재개
        pomoState.isRunning = true;
        
        if (pomoState.status === 'idle') {
            pomoState.status = 'work';
            pomoState.timeLeft = 25 * 60; // 25분
        }
        
        // 일시 정지 후 재개 및 시작 시 시점 기록
        pomoState.duration = pomoState.timeLeft;
        pomoState.startTime = Date.now();
        
        if (pomoState.status === 'work') {
            statusLabel.textContent = '집중 중';
            statusLabel.className = 'pomodoro-status work';
            startBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 일시 정지';
            document.getElementById('pomo-time').classList.remove('break-active');
        } else if (pomoState.status === 'break') {
            statusLabel.textContent = '휴식 중';
            statusLabel.className = 'pomodoro-status break';
            startBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 일시 정지';
            document.getElementById('pomo-time').classList.add('break-active');
        }
        
        if (pomoState.timerId) clearInterval(pomoState.timerId);
        pomoState.timerId = setInterval(tickPomodoro, 200); // 200ms 간격 정밀 갱신
    } else {
        // 일시 정지
        pomoState.isRunning = false;
        clearInterval(pomoState.timerId);
        
        if (pomoState.status === 'work') {
            statusLabel.textContent = '집중 일시정지';
            statusLabel.className = 'pomodoro-status work';
        } else if (pomoState.status === 'break') {
            statusLabel.textContent = '휴식 일시정지';
            statusLabel.className = 'pomodoro-status break';
        }
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 계속 하기';
    }
    
    updatePomodoroUI();
}

function tickPomodoro() {
    const pomoState = state.trainer.pomodoro;
    if (!pomoState.isRunning) return;
    
    // 시작 시각으로부터 경과된 실시간(seconds) 계산 (백그라운드 스로틀링 극복 핵심)
    const elapsedSeconds = Math.floor((Date.now() - pomoState.startTime) / 1000);
    pomoState.timeLeft = Math.max(0, pomoState.duration - elapsedSeconds);
    
    if (pomoState.timeLeft <= 0) {
        clearInterval(pomoState.timerId);
        pomoState.isRunning = false;
        triggerPomodoroBeep(); // Chime 효과음 재생
        
        if (pomoState.status === 'work') {
            // 집중 성공 -> 휴식 대기 모드 전환 (날짜 기록과 함께 누적 시간 저장)
            pomoState.totalTimeToday += 25;
            localStorage.setItem('pomo_total_time', pomoState.totalTimeToday);
            localStorage.setItem('pomo_total_time_date', new Date().toISOString().split('T')[0]);
            
            alert("집중 25분이 끝났습니다! 5분간 휴식하세요.");
            
            pomoState.status = 'break';
            pomoState.timeLeft = 5 * 60; // 5분 휴식
            document.getElementById('pomo-status').textContent = '휴식 대기';
            document.getElementById('pomo-status').className = 'pomodoro-status break';
            document.getElementById('pomo-start-btn').innerHTML = '<i class="fa-solid fa-play"></i> 휴식 시작';
            document.getElementById('pomo-time').classList.add('break-active');
        } else {
            // 휴식 성공 -> 다시 집중 준비 대기
            alert("휴식이 끝났습니다! 다시 힘내볼까요?");
            pomoState.status = 'idle';
            pomoState.timeLeft = 25 * 60;
            document.getElementById('pomo-status').textContent = '대기 중';
            document.getElementById('pomo-status').className = 'pomodoro-status';
            document.getElementById('pomo-start-btn').innerHTML = '<i class="fa-solid fa-play"></i> 집중 시작';
            document.getElementById('pomo-time').classList.remove('break-active');
        }
    }
    
    updatePomodoroUI();
}

function resetPomodoro() {
    const pomoState = state.trainer.pomodoro;
    if (pomoState.timerId) clearInterval(pomoState.timerId);
    
    pomoState.isRunning = false;
    pomoState.status = 'idle';
    pomoState.timeLeft = 25 * 60;
    
    document.getElementById('pomo-status').textContent = '대기 중';
    document.getElementById('pomo-status').className = 'pomodoro-status';
    document.getElementById('pomo-start-btn').innerHTML = '<i class="fa-solid fa-play"></i> 집중 시작';
    document.getElementById('pomo-time').classList.remove('break-active');
    
    updatePomodoroUI();
}

function updatePomodoroUI() {
    const pomoState = state.trainer.pomodoro;
    const min = Math.floor(pomoState.timeLeft / 60);
    const sec = pomoState.timeLeft % 60;
    
    document.getElementById('pomo-time').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    document.getElementById('pomo-total-time').textContent = `${pomoState.totalTimeToday}분`;
}

function triggerPomodoroBeep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const playBeep = (startTime, frequency, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);
            
            gain.gain.setValueAtTime(0.1, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        
        const now = ctx.currentTime;
        playBeep(now, 523.25, 0.25); // C5
        playBeep(now + 0.35, 659.25, 0.25); // E5
        playBeep(now + 0.7, 783.99, 0.4); // G5
    } catch (e) {
        console.error("Audio Context failed: ", e);
    }
}

/* =======================================================
   🎯 모의고사 성적 차트 및 합격 진단 (Performance Chart)
   ======================================================= */
function saveExamResultToHistory(examId, score, total, subjectRates = null) {
    const dateStr = new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    const rate = Math.round((score / total) * 100);
    
    const newResult = {
        examId: examId,
        date: dateStr,
        score: score,
        total: total,
        rate: rate
    };
    
    if (subjectRates) {
        newResult.subjectRates = subjectRates;
    }
    
    let history = [];
    const saved = localStorage.getItem('sim_results_history');
    if (saved) {
        try {
            history = JSON.parse(saved);
        } catch(e) {}
    }
    history.push(newResult);
    localStorage.setItem('sim_results_history', JSON.stringify(history));
    
    // 그래프 즉시 업데이트
    if (state.currentView === 'dashboard-view') {
        renderPerformanceChart();
        renderPassFailDiagnosis();
    }
}



/* =======================================================
   🔍 화장품 성분 검색 사전 (Ingredient Dictionary)
   ======================================================= */
const dictState = {
    query: '',
    filter: 'all'
};

function renderDictionary() {
    const container = document.getElementById('dict-results-container');
    if (!container) return;
    
    container.innerHTML = '';
    const db = typeof INGREDIENTS_DATA !== 'undefined' ? INGREDIENTS_DATA : [];
    if (db.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-text-muted);">원료 데이터베이스가 비어있습니다. 빌드 스크립트를 실행해 주세요.</div>';
        return;
    }
    
    const query = dictState.query.toLowerCase().trim();
    const filter = dictState.filter;
    
    const filtered = db.filter(ing => {
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
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--color-text-muted);"><i class="fa-solid fa-face-sad-tear" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i> 검색 결과가 없습니다. 다른 검색어를 입력해보세요.</div>';
        return;
    }
    
    filtered.forEach(ing => {
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
        
        container.appendChild(card);
    });
}

function filterDictionary() {
    const input = document.getElementById('dict-search-input');
    if (input) {
        dictState.query = input.value;
        renderDictionary();
    }
}

function setDictFilter(filterType) {
    dictState.filter = filterType;
    
    // 버튼 active 클래스 갱신
    const buttons = document.querySelectorAll('.dict-filter-buttons button');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${filterType}'`)) {
            btn.classList.add('active-filter');
        } else {
            btn.classList.remove('active-filter');
        }
    });
    
    renderDictionary();
}

function clearDictSearch() {
    const input = document.getElementById('dict-search-input');
    if (input) {
        input.value = '';
        dictState.query = '';
        renderDictionary();
    }
}



/* =======================================================
   📋 "틀린 문제만 모아 풀기" 오답 모의고사 (Weakness Exam)
   ======================================================= */
function startWeakExam() {
    // 헷갈린 카드나 오답 데이터 로딩
    let weakCards = Array.from(state.weakCards);
    let solvedQuizzes = Object.keys(state.quizResults).filter(id => !state.quizResults[id].correct);
    
    // 필터링 적용 (신규 Feature 3)
    if (state.reviewFilter && state.reviewFilter !== 'all') {
        weakCards = weakCards.filter(cardId => {
            if (cardId.startsWith('weak_sim_')) {
                const parts = cardId.replace('weak_sim_', '').split('_q');
                if (parts.length === 2) {
                    const targetSub = examIdToSubjectId(parts[0]);
                    return targetSub === state.reviewFilter;
                }
            } else {
                for (const subjId of Object.keys(STUDY_DATA)) {
                    if (STUDY_DATA[subjId].cards.some(c => c.id === cardId)) {
                        return subjId === state.reviewFilter;
                    }
                }
            }
            return false;
        });
        
        solvedQuizzes = solvedQuizzes.filter(quizId => {
            for (const subjId of Object.keys(STUDY_DATA)) {
                if (STUDY_DATA[subjId].quizzes.some(q => q.id === quizId)) {
                    return subjId === state.reviewFilter;
                }
            }
            return false;
        });
    }
    
    if (weakCards.length === 0 && solvedQuizzes.length === 0) {
        const filterNames = {
            'law': '1과목 (법령)',
            'manufacturing': '2과목 (품질)',
            'safety': '3과목 (안전)',
            'understanding': '4과목 (이해)'
        };
        const filterName = filterNames[state.reviewFilter] || '선택한 과목';
        alert(`복습할 헷갈린 카드나 오답 퀴즈가 없습니다! (${filterName})\n플래시카드나 기출 퀴즈를 학습하여 약점 데이터를 모아보세요.`);
        return;
    }
    
    // 모의고사 구조로 질문 조립 (최대 20개 추출)
    const questions = [];
    
    // 1. 헷갈린 카드로부터 질문 생성
    weakCards.forEach(cardId => {
        // Find card in STUDY_DATA
        let cardObj = null;
        let subject = '';
        for (const subjId of Object.keys(STUDY_DATA)) {
            const found = STUDY_DATA[subjId].cards.find(c => c.id === cardId);
            if (found) {
                cardObj = found;
                subject = subjId;
                break;
            }
        }
        
        if (cardObj) {
            questions.push({
                id: `weak_card_${cardObj.id}`,
                subject: subject,
                type: 'blank',
                question: `[용어 정의] 다음 설명이 뜻하는 개념은 무엇입니까?<br><strong>설명:</strong> ${cardObj.definition}`,
                answer: cardObj.term,
                explanation: `정의: ${cardObj.definition}<br>용어: ${cardObj.term}`
            });
        }
    });
    
    // 2. 오답 기출 퀴즈로부터 질문 생성
    solvedQuizzes.forEach(quizId => {
        let quizObj = null;
        let subject = '';
        for (const subjId of Object.keys(STUDY_DATA)) {
            const found = STUDY_DATA[subjId].quizzes.find(q => q.id === quizId);
            if (found) {
                quizObj = found;
                subject = subjId;
                break;
            }
        }
        
        if (quizObj) {
            questions.push({
                id: `weak_quiz_${quizObj.id}`,
                subject: subject,
                type: quizObj.type,
                question: quizObj.question,
                answer: quizObj.answer,
                options: quizObj.options || null,
                explanation: `기존 문제에 포함된 오답 기출 연동 퀴즈입니다.`
            });
        }
    });
    
    // 무작위로 섞어서 20문항으로 자르기
    const shuffled = questions.sort(() => 0.5 - Math.random()).slice(0, 20);
    
    // 모의고사 세션 구동
    const mockExam = {
        title: '헷갈린 문제 집중 오답 모의고사 (20제)',
        questions: shuffled
    };
    
    // OMR 및 타이머 제어용 데이터 이식
    state.currentView = 'exam-view';
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('review-view').classList.remove('active');
    document.getElementById('exam-view').classList.add('active');
    
    // OMR Sheet, Timer 활성화
    startSimSession(mockExam);
}

/* =======================================================
   🧩 일일 5분 데일리 챌린지 (Daily 5-Min Challenge) & Streak
   ======================================================= */
const dailyState = {
    currentIndex: 0,
    correctCount: 0,
    questions: []
};

function updateStreakAndDailyUI() {
    const streakDaysEl = document.getElementById('streak-days');
    const challengeStatusEl = document.getElementById('daily-challenge-status');
    const startBtn = document.getElementById('start-daily-btn');
    
    if (!streakDaysEl) return;
    
    // Streak 계산
    let streak = parseInt(localStorage.getItem('study_streak')) || 0;
    const lastDate = localStorage.getItem('study_streak_last_date'); // YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (lastDate) {
        const last = new Date(lastDate);
        const today = new Date(todayStr);
        const diffTime = Math.abs(today - last);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
            // 하루 이상 건너뛰었으면 Streak 0으로 리셋
            streak = 0;
            localStorage.setItem('study_streak', 0);
        }
    } else {
        streak = 0;
    }
    
    streakDaysEl.textContent = streak;
    
    // 오늘 챌린지 완료 여부 검증
    const todayCompleted = localStorage.getItem(`daily_completed_${todayStr}`);
    if (todayCompleted) {
        challengeStatusEl.textContent = '🟢 오늘 미션 완료!';
        challengeStatusEl.style.color = 'var(--color-success)';
        if (startBtn) {
            startBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> 오늘 완료됨';
            startBtn.disabled = true;
        }
    } else {
        challengeStatusEl.textContent = '오늘 미션 미완료';
        challengeStatusEl.style.color = 'var(--color-text-muted)';
        if (startBtn) {
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 챌린지 시작';
            startBtn.disabled = false;
        }
    }
}

function startDailyChallenge() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCompleted = localStorage.getItem(`daily_completed_${todayStr}`);
    if (todayCompleted) {
        alert('오늘의 데일리 챌린지를 이미 달성하셨습니다! 내일 다시 도전해 주세요.');
        return;
    }
    
    // 8문제 챌린지 팩 조립
    const qPack = [];
    
    // 1. 플래시카드 복습 3개
    let allCards = [];
    Object.keys(STUDY_DATA).forEach(subjId => {
        allCards = allCards.concat(STUDY_DATA[subjId].cards.map(c => ({...c, subject: subjId})));
    });
    const selectedCards = allCards.sort(() => 0.5 - Math.random()).slice(0, 3);
    selectedCards.forEach(c => {
        qPack.push({
            type: 'card',
            cardObj: c,
            question: `다음 개념의 정답을 아십니까?<br><br><strong>[설명]</strong><br>${c.definition}`,
            correct: c.term
        });
    });
    
    // 2. 퀴즈 풀이 3개
    let allQuizzes = [];
    Object.keys(STUDY_DATA).forEach(subjId => {
        allQuizzes = allQuizzes.concat(STUDY_DATA[subjId].quizzes.map(q => ({...q, subject: subjId})));
    });
    const selectedQuizzes = allQuizzes.sort(() => 0.5 - Math.random()).slice(0, 3);
    selectedQuizzes.forEach(q => {
        qPack.push({
            type: q.type === 'choice' ? 'choice' : 'short',
            question: `[기출 퀴즈] ${q.question}`,
            correct: q.answer,
            options: q.options || null,
            explanation: `과목: ${q.subject}`
        });
    });
    
    // 3. 배합 계산 문제 1개
    const w = [100, 200, 300][Math.floor(Math.random() * 3)];
    const cVal = [1, 2, 3, 5][Math.floor(Math.random() * 4)];
    const formulaWeight = (w * cVal) / 100;
    qPack.push({
        type: 'short',
        question: `[실전 계산] 베이스 오일 <strong>${w}g</strong>에 보존 성분 <strong>${cVal}%</strong>를 배합하여 제품을 조제하려고 합니다. 첨가해야 할 성분의 중량은 몇 g인가요? (소수점 둘째자리까지 정답 인정)`,
        correct: String(formulaWeight.toFixed(2)),
        explanation: `계산 공식: 중량 = (전체 중량 * 배합 %) / 100 = (${w} * ${cVal}) / 100 = ${formulaWeight}g`
    });
    
    // 4. 원료 안전성 판별 1개
    const db = typeof INGREDIENTS_DATA !== 'undefined' ? INGREDIENTS_DATA : [];
    if (db.length > 0) {
        const ing = db[Math.floor(Math.random() * db.length)];
        let correctText = '';
        if (ing.type === 'approved') correctText = '🟢 사용 가능 원료';
        else if (ing.type === 'restricted') correctText = '🟡 사용상의 제한이 필요한 원료 (보존제/자외선차단제 등)';
        else correctText = '🔴 사용할 수 없는 원료 (배합 금지)';
        
        qPack.push({
            type: 'choice',
            question: `[원료 안전성] 다음 성분명 <strong>"${ing.name}"</strong>은(는) 화장품 원료 고시 기준상 어느 그룹에 속하나요?`,
            correct: correctText,
            options: [
                '🟢 사용 가능 원료',
                '🟡 사용상의 제한이 필요한 원료 (보존제/자외선차단제 등)',
                '🔴 사용할 수 없는 원료 (배합 금지)'
            ],
            explanation: `성분 "${ing.name}"은(는) ${correctText} 입니다. 한도: ${ing.limit || '제한 없음'}`
        });
    }
    
    dailyState.currentIndex = 0;
    dailyState.correctCount = 0;
    dailyState.questions = qPack;
    
    // 모달 DOM 생성
    showDailyModal();
}

function showDailyModal() {
    // 기존 모달 제거
    const oldModal = document.getElementById('daily-challenge-modal');
    if (oldModal) oldModal.remove();
    
    const modalHTML = `
        <div id="daily-challenge-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(11, 15, 25, 0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
            <div class="glass-card" style="width: 90%; max-width: 600px; padding: 2.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); position: relative; box-shadow: var(--shadow-lg);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="font-weight: 700; color: var(--color-primary); margin: 0; font-size: 1.4rem;"><i class="fa-solid fa-fire"></i> 데일리 챌린지</h3>
                    <span id="daily-modal-progress" style="font-size: 0.9rem; color: var(--color-text-muted);">진행: 1 / 8</span>
                </div>
                
                <!-- Progress Bar -->
                <div class="progress-bar-container" style="height: 6px; margin-bottom: 2rem;">
                    <div id="daily-modal-bar" class="progress-bar" style="width: 12.5%; background: var(--color-primary);"></div>
                </div>
                
                <!-- Question Body -->
                <div id="daily-modal-q-body" style="min-height: 200px; margin-bottom: 2rem;">
                    질문 로딩 중...
                </div>
                
                <!-- Input or Choice Area -->
                <div id="daily-modal-answer-area" style="margin-bottom: 2rem;">
                    <!-- Controls -->
                </div>
                
                <!-- Feedback panel -->
                <div class="quiz-feedback" id="daily-modal-feedback" style="display: none; margin-bottom: 2rem; padding: 1.25rem;">
                    <div class="feedback-icon" id="daily-modal-feedback-icon"><i class="fa-solid fa-check"></i></div>
                    <div class="feedback-content">
                        <h4 id="daily-modal-feedback-title">정답입니다!</h4>
                        <p id="daily-modal-feedback-desc" style="font-size: 0.9rem;">설명</p>
                    </div>
                </div>
                
                <!-- Footer buttons -->
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="btn btn-secondary" onclick="closeDailyModal()"><i class="fa-solid fa-xmark"></i> 나가기</button>
                    <button id="daily-modal-next-btn" class="btn btn-success" style="display: none;" onclick="nextDailyStep()">다음 단계 <i class="fa-solid fa-arrow-right"></i></button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    renderDailyStep();
}

function closeDailyModal() {
    if (confirm('도중에 나가시면 데일리 미션 진도가 저장되지 않습니다. 정말 나가시겠습니까?')) {
        const modal = document.getElementById('daily-challenge-modal');
        if (modal) modal.remove();
    }
}

function renderDailyStep() {
    const q = dailyState.questions[dailyState.currentIndex];
    
    document.getElementById('daily-modal-progress').textContent = `진행: ${dailyState.currentIndex + 1} / ${dailyState.questions.length}`;
    document.getElementById('daily-modal-bar').style.width = `${((dailyState.currentIndex + 1) / dailyState.questions.length) * 100}%`;
    document.getElementById('daily-modal-feedback').style.display = 'none';
    document.getElementById('daily-modal-next-btn').style.display = 'none';
    
    const qBody = document.getElementById('daily-modal-q-body');
    qBody.innerHTML = `<h4 style="font-size: 1.15rem; line-height: 1.8; font-weight: 500;">${safeTextWithBreaks(q.question)}</h4>`;
    
    const answerArea = document.getElementById('daily-modal-answer-area');
    answerArea.innerHTML = '';
    
    if (q.type === 'card') {
        qBody.innerHTML = `
            <div id="daily-card-container" style="perspective: 1000px; margin: 1rem 0; width: 100%; height: 180px; cursor: pointer;">
                <div id="daily-card-inner" style="width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform 0.6s;">
                    <!-- Front -->
                    <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(31, 41, 55, 0.95);">
                        <p style="text-align: center; font-size: 1rem; line-height: 1.6;">${safeTextWithBreaks(q.cardObj.definition)}</p>
                        <span style="color: var(--color-primary); font-size: 0.8rem; margin-top: 1rem;"><i class="fa-solid fa-rotate"></i> 카드를 클릭해 뒤집기</span>
                    </div>
                    <!-- Back -->
                    <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(17, 24, 39, 0.95); transform: rotateY(180deg);">
                        <h2 style="font-size: 1.6rem; color: var(--color-primary); font-weight: 800;">${esc(q.cardObj.term)}</h2>
                    </div>
                </div>
            </div>
        `;
        
        const cardContainer = document.getElementById('daily-card-container');
        cardContainer.addEventListener('click', () => {
            const inner = document.getElementById('daily-card-inner');
            inner.style.transform = inner.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
        });
        
        // Buttons: 외움 / 헷갈림
        answerArea.innerHTML = `
            <div style="display: flex; gap: 1rem; width: 100%;">
                <button class="btn btn-warning" onclick="submitDailyCardAnswer(false)" style="flex: 1; justify-content: center;"><i class="fa-solid fa-question"></i> 아직 헷갈림</button>
                <button class="btn btn-success" onclick="submitDailyCardAnswer(true)" style="flex: 1; justify-content: center;"><i class="fa-solid fa-check"></i> 완벽히 외움</button>
            </div>
        `;
    } else if (q.type === 'choice') {
        const optionIndicators = ['A', 'B', 'C', 'D'];
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'limits-opt-btn';
            btn.style.width = '100%';
            btn.style.marginBottom = '0.75rem';
            btn.innerHTML = `<span class="limits-opt-num">${esc(optionIndicators[idx])}</span> <span class="limits-opt-text">${esc(opt)}</span>`;
            btn.addEventListener('click', () => {
                submitDailyChoiceAnswer(btn, opt, q.correct);
            });
            answerArea.appendChild(btn);
        });
    } else {
        // Short Answer
        answerArea.innerHTML = `
            <div style="display: flex; gap: 1rem; align-items: center; width: 100%;">
                <input type="text" id="daily-answer-input" class="form-input" placeholder="정답을 기재하세요" style="flex: 1; height: 50px;" autocomplete="off">
                <button class="btn btn-primary" onclick="submitDailyShortAnswer()" style="height: 50px;"><i class="fa-solid fa-circle-check"></i> 제출</button>
            </div>
        `;
    }
}

function submitDailyCardAnswer(isMemorized) {
    if (isMemorized) {
        dailyState.correctCount++;
    }
    
    // 카드 상태 피드백
    const feedback = document.getElementById('daily-modal-feedback');
    const title = document.getElementById('daily-modal-feedback-title');
    const desc = document.getElementById('daily-modal-feedback-desc');
    
    feedback.style.display = 'flex';
    feedback.classList.remove('incorrect');
    title.textContent = isMemorized ? '완벽히 외운 카드로 분류했습니다.' : '헷갈린 복습 카드로 분류했습니다.';
    desc.textContent = `용어: ${dailyState.questions[dailyState.currentIndex].correct}`;
    
    // 진도 데이터 반영
    const q = dailyState.questions[dailyState.currentIndex];
    if (isMemorized) {
        state.memorizedCards.add(q.cardObj.id);
        state.weakCards.delete(q.cardObj.id);
    } else {
        state.weakCards.add(q.cardObj.id);
    }
    saveProgress();
    
    document.getElementById('daily-modal-next-btn').style.display = 'inline-flex';
}

function submitDailyChoiceAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
    const answerArea = document.getElementById('daily-modal-answer-area');
    const buttons = answerArea.querySelectorAll('.limits-opt-btn');
    
    buttons.forEach(btn => {
        btn.disabled = true;
        const textSpan = btn.querySelector('.limits-opt-text');
        if (textSpan.textContent === correctValue) {
            btn.classList.add('correct');
        }
    });
    
    if (!isCorrect) {
        selectedBtn.classList.add('incorrect');
    } else {
        dailyState.correctCount++;
    }
    
    showDailyFeedback(isCorrect, correctValue);
}

function submitDailyShortAnswer() {
    const userInput = document.getElementById('daily-answer-input').value.trim();
    if (!userInput) {
        alert('정답을 입력하세요!');
        return;
    }
    
    const q = dailyState.questions[dailyState.currentIndex];
    const isCorrect = checkShortAnswer(userInput, q.correct);
    
    if (isCorrect) {
        dailyState.correctCount++;
    }
    
    // Disable inputs
    document.getElementById('daily-answer-input').disabled = true;
    const btn = document.querySelector('#daily-modal-answer-area button');
    if (btn) btn.disabled = true;
    
    showDailyFeedback(isCorrect, q.correct);
}

function showDailyFeedback(isCorrect, correctValue) {
    const q = dailyState.questions[dailyState.currentIndex];
    const feedback = document.getElementById('daily-modal-feedback');
    const title = document.getElementById('daily-modal-feedback-title');
    const desc = document.getElementById('daily-modal-feedback-desc');
    
    feedback.style.display = 'flex';
    if (isCorrect) {
        feedback.classList.remove('incorrect');
        title.innerHTML = '🟢 정답입니다!';
    } else {
        feedback.classList.add('incorrect');
        title.innerHTML = `🔴 오답입니다! (정답: <strong>${esc(correctValue)}</strong>)`;
    }
    desc.innerHTML = safeTextWithBreaks(q.explanation || '안전 기준 고시 해설을 확인하세요.');
    
    document.getElementById('daily-modal-next-btn').style.display = 'inline-flex';
}

function nextDailyStep() {
    dailyState.currentIndex++;
    if (dailyState.currentIndex >= dailyState.questions.length) {
        finishDailyChallenge();
    } else {
        renderDailyStep();
    }
}

function finishDailyChallenge() {
    const modal = document.getElementById('daily-challenge-modal');
    if (modal) modal.remove();
    
    alert(`🎉 일일 데일리 챌린지를 완수하셨습니다!\n획득 점수: ${dailyState.correctCount} / ${dailyState.questions.length} 개`);
    
    // Streak 날짜 업데이트
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem(`daily_completed_${todayStr}`, "true");
    
    let streak = parseInt(localStorage.getItem('study_streak')) || 0;
    const lastDate = localStorage.getItem('study_streak_last_date');
    
    if (lastDate !== todayStr) {
        streak++;
        localStorage.setItem('study_streak', streak);
        localStorage.setItem('study_streak_last_date', todayStr);
    }
    
    updateStreakAndDailyUI();
}

/* =======================================================
   💾 로컬 데이터 백업 및 복원 (Data Backup & Restore)
   ======================================================= */
function getBackupKeys() {
    // 정적 키 목록 + 날짜 기반 동적 키(daily_completed_YYYY-MM-DD)를 모두 수집
    const staticKeys = [
        'fc_memorized',
        'fc_weak',
        'quiz_results',
        'sim_results_history',
        'sim_draft_session',
        'pomo_total_time',
        'pomo_total_time_date',
        'study_streak',
        'study_streak_last_date',
        'calc_history'
    ];
    const dynamicKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('daily_completed_')) {
            dynamicKeys.push(key);
        }
    }
    return [...staticKeys, ...dynamicKeys];
}

function exportData() {
    const keys = getBackupKeys();
    const backupObj = {};
    
    keys.forEach(k => {
        backupObj[k] = localStorage.getItem(k);
    });
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cosmetic_pass_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    alert('학습 데이터 백업 파일 다운로드가 완료되었습니다!');
}

function triggerImport() {
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.click();
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const ALLOWED_KEYS = [
        'fc_memorized',
        'fc_weak',
        'quiz_results',
        'sim_results_history',
        'sim_draft_session',
        'pomo_total_time',
        'pomo_total_time_date',
        'study_streak',
        'study_streak_last_date',
        'calc_history'
    ];
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // 데이터 검증 및 복원
            let restoredCount = 0;
            Object.keys(data).forEach(k => {
                // 화이트리스트 정적 키 또는 daily_completed_ 접두사 동적 키만 복원 허용
                const isAllowed = ALLOWED_KEYS.includes(k) || k.startsWith('daily_completed_');
                if (isAllowed && data[k] !== null && typeof data[k] === 'string') {
                    localStorage.setItem(k, data[k]);
                    restoredCount++;
                }
            });
            
            if (restoredCount > 0) {
                alert('학습 데이터 복원이 성공적으로 완료되었습니다! 페이지를 새로고침하여 적용합니다.');
                location.reload();
            } else {
                alert('가져올 유효한 학습 데이터 키가 존재하지 않습니다.');
            }
        } catch (err) {
            alert('유효하지 않은 백업 파일입니다. 백업 데이터 복원 실패.');
        }
    };
    reader.readAsText(file);
}

// 디바운스 유틸리티 함수
function debounce(func, delay = 150) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

/* =======================================================
   🖨️ 오답노트 인쇄 (Print Handler)
   ======================================================= */
function startFocusSubjectStudy(subKey) {
    if (typeof STUDY_DATA !== 'undefined' && STUDY_DATA[subKey]) {
        const subj = STUDY_DATA[subKey];
        state.quiz.data = [...subj.quizzes].sort(() => 0.5 - Math.random()).slice(0, 10);
        state.quiz.currentIndex = 0;
        state.quiz.correctCount = 0;
        state.quiz.solvedList = [];
        
        // 퀴즈 화면 초기화 및 활성화
        document.getElementById('quiz-setup-panel').style.display = 'none';
        document.getElementById('quiz-result-panel').style.display = 'none';
        document.getElementById('quiz-arena-panel').style.display = 'block';
        document.getElementById('quiz-q-category').textContent = subj.name;
        
        renderQuizQuestion();
        
        // 퀴즈 탭 활성화
        switchView('quiz-view');
    }
}



function renderCalcHistory() {
    const listContainer = document.getElementById('calc-history-list');
    if (!listContainer) return;
    
    const historyJSON = localStorage.getItem('calc_history');
    let history = [];
    if (historyJSON) {
        try {
            history = JSON.parse(historyJSON);
        } catch(e) {
            console.error(e);
        }
    }
    
    if (history.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--color-text-muted); font-size: 0.8rem; padding: 1rem;">이전 풀이 기록이 없습니다.</div>`;
        return;
    }
    
    listContainer.innerHTML = '';
    history.forEach(item => {
        const badgeColor = item.isCorrect ? 'var(--color-success)' : 'var(--color-danger)';
        const badgeBg = item.isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        const dateStr = item.date ? item.date.substring(5, 16).replace('T', ' ') : '';
        
        const cardHTML = `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.8rem; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-weight: bold; background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">
                        ${item.isCorrect ? '🟢 정답' : '🔴 오답'} [${item.type}]
                    </span>
                    <span style="color: var(--color-text-muted); font-size: 0.75rem;">${dateStr}</span>
                </div>
                <div style="color: var(--color-text-muted); line-height: 1.4; margin-bottom: 0.25rem;">${safeTextWithBreaks(item.question)}</div>
                <div style="display: flex; gap: 1rem; margin-top: 0.25rem; font-size: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 0.25rem;">
                    <span style="color: #9ca3af;">내가 입력한 값: <strong style="color: #fff;">${esc(item.userVal)}${esc(item.unit)}</strong></span>
                    <span style="color: #9ca3af;">실제 정답: <strong style="color: var(--color-success);">${esc(item.correctAns)}${esc(item.unit)}</strong></span>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function addCalcHistoryItem(questionText, type, userVal, correctAns, isCorrect, unit) {
    const historyJSON = localStorage.getItem('calc_history');
    let history = [];
    if (historyJSON) {
        try {
            history = JSON.parse(historyJSON);
        } catch(e) {
            console.error(e);
        }
    }
    
    const newItem = {
        date: new Date().toISOString(),
        question: questionText.replace(/<[^>]*>/g, '').substring(0, 80) + (questionText.length > 80 ? '...' : ''),
        type: type,
        userVal: userVal,
        correctAns: correctAns,
        isCorrect: isCorrect,
        unit: unit
    };
    
    history.unshift(newItem);
    
    if (history.length > 5) {
        history = history.slice(0, 5);
    }
    
    localStorage.setItem('calc_history', JSON.stringify(history));
    renderCalcHistory();
}

function printReviewNotes() {
    window.print();
}

/* =======================================================
   📖 Textbook Search Integration Logic
   ======================================================= */
const textbookState = {
    filter: 'all',
    searchQuery: '',
    debounceTimer: null
};

function renderTextbookSearch() {
    const searchInput = document.getElementById('textbook-search-input');
    
    // Bind search input events only once
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(textbookState.debounceTimer);
            textbookState.debounceTimer = setTimeout(() => {
                textbookState.searchQuery = e.target.value.trim();
                performTextbookSearch();
            }, 250); // 250ms debounce
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(textbookState.debounceTimer);
                textbookState.searchQuery = e.target.value.trim();
                performTextbookSearch();
            }
        });
    }
    
    performTextbookSearch();
}

function setTextbookFilter(filterVal) {
    textbookState.filter = filterVal;
    
    // Update active filter class
    const buttons = document.querySelectorAll('.textbook-filter-buttons .btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('data-filter') === filterVal) {
            btn.classList.add('active-filter');
        } else {
            btn.classList.remove('active-filter');
        }
    });
    
    performTextbookSearch();
}

function clearTextbookSearch() {
    const searchInput = document.getElementById('textbook-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    textbookState.searchQuery = '';
    performTextbookSearch();
}

function performTextbookSearch() {
    const container = document.getElementById('textbook-results-container');
    const summary = document.getElementById('textbook-search-summary');
    if (!container) return;
    
    const query = textbookState.searchQuery.toLowerCase().trim();
    if (!query) {
        // Show empty state
        summary.textContent = '키워드를 입력하면 검색 결과가 여기에 표시됩니다.';
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                <h3>검색어를 입력하세요</h3>
                <p>위 검색창에 궁금한 교재 키워드를 입력하고 검색 결과를 확인하세요.</p>
            </div>
        `;
        return;
    }
    
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    const results = [];
    
    // Search across STUDY_DATA
    Object.keys(STUDY_DATA).forEach(subjId => {
        // Filter by subject
        if (textbookState.filter !== 'all' && textbookState.filter !== subjId) {
            return;
        }
        
        const subj = STUDY_DATA[subjId];
        if (!subj.chapters) return;
        
        subj.chapters.forEach(chapter => {
            chapter.sections.forEach(section => {
                const titleMatch = section.title.toLowerCase();
                const contentMatch = section.content.toLowerCase();
                
                // AND search: all terms must match title or content
                const isMatch = terms.every(term => titleMatch.includes(term) || contentMatch.includes(term));
                
                if (isMatch) {
                    results.push({
                        subjId: subjId,
                        subjName: subj.name,
                        chapterTitle: chapter.chapterTitle,
                        filePath: chapter.filePath,
                        sectionTitle: section.title,
                        content: section.content
                    });
                }
            });
        });
    });
    
    // Update summary text
    summary.innerHTML = `총 <strong style="color: var(--color-primary);">${results.length}</strong>건의 관련 내용을 찾았습니다.`;
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--color-warning); margin-bottom: 1rem; display: block;"></i>
                <h3>일치하는 내용이 없습니다</h3>
                <p>다른 검색어로 검색해보거나 띄어쓰기를 확인해보세요.</p>
            </div>
        `;
        return;
    }
    
    // Render results
    container.innerHTML = '';
    results.forEach((item, idx) => {
        const badgeColors = {
            law: 'badge-cyan',
            manufacturing: 'badge-violet',
            safety: 'badge-emerald',
            understanding: 'badge-amber'
        };
        const badgeColor = badgeColors[item.subjId] || 'badge-gray';
        
        const isLong = item.content.length > 300;
        const bodyClass = isLong ? 'textbook-card-body collapsed' : 'textbook-card-body';
        const formattedContent = formatSectionContent(item.content, terms);
        
        const cardId = `textbook-card-${idx}`;
        const cardHTML = `
            <div class="textbook-result-card">
                <div class="textbook-card-header">
                    <span class="textbook-card-path">
                        <span class="badge ${badgeColor}">${esc(item.subjName)}</span>
                        <i class="fa-solid fa-chevron-right"></i>
                        <span>${esc(item.chapterTitle)}</span>
                    </span>
                    <a href="${esc(item.filePath)}" target="_blank" class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> 전체 단원 보기
                    </a>
                </div>
                <h4 class="textbook-card-title">${highlightTextInString(item.sectionTitle, terms)}</h4>
                <div class="${bodyClass}" id="${cardId}-body">
                    ${formattedContent}
                </div>
                ${isLong ? `
                <div class="textbook-card-actions">
                    <button class="btn btn-secondary" onclick="toggleTextbookCard('${cardId}')" id="${cardId}-toggle-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600;">
                        <i class="fa-solid fa-chevron-down"></i> 더 보기
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function toggleTextbookCard(cardId) {
    const body = document.getElementById(`${cardId}-body`);
    const btn = document.getElementById(`${cardId}-toggle-btn`);
    if (!body || !btn) return;
    
    if (body.classList.contains('collapsed')) {
        body.classList.remove('collapsed');
        body.style.maxHeight = 'none';
        btn.innerHTML = `<i class="fa-solid fa-chevron-up"></i> 접기`;
    } else {
        body.classList.add('collapsed');
        body.style.maxHeight = '';
        btn.innerHTML = `<i class="fa-solid fa-chevron-down"></i> 더 보기`;
        body.parentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function formatSectionContent(rawContent, searchTerms = []) {
    // 1. HTML 이스케이프
    let html = escapeHTML(rawContent);
    
    // 2. 마크다운 볼드 처리
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 3. 검색어 하이라이트
    if (searchTerms.length > 0) {
        searchTerms.forEach(term => {
            if (term.length > 0) {
                html = highlightTextOutsideTags(html, term);
            }
        });
    }
    
    // 4. 리스트 아이템 및 줄 바꿈
    const lines = html.split(/\r?\n/);
    const formattedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return `<div class="md-list-item"><span class="md-bullet">•</span> ${line.replace(/^[-*]\s+/, '')}</div>`;
        }
        if (trimmed.startsWith('|')) {
            return `<div class="md-table-row">${line}</div>`;
        }
        if (trimmed === '') {
            return '';
        }
        return `<p class="md-para">${line}</p>`;
    });
    
    return formattedLines.join('');
}

function highlightTextInString(text, searchTerms = []) {
    let html = escapeHTML(text);
    if (searchTerms.length > 0) {
        searchTerms.forEach(term => {
            if (term.length > 0) {
                const escapedTerm = escapeRegExp(term);
                const termRegex = new RegExp(`(${escapedTerm})`, 'gi');
                html = html.replace(termRegex, '<mark class="txt-highlight">$1</mark>');
            }
        });
    }
    return html;
}

function highlightTextOutsideTags(html, term) {
    const regex = new RegExp(`([^<]*)(<[^>]+>)?`, 'g');
    const escapedTerm = escapeRegExp(term);
    const termRegex = new RegExp(`(${escapedTerm})`, 'gi');
    
    return html.replace(regex, (match, text, tag) => {
        const highlightedText = text.replace(termRegex, '<mark class="txt-highlight">$1</mark>');
        return highlightedText + (tag || '');
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- 교재 본문 읽기 (Textbook Reader) ---
let textbookReaderState = {
    selectedSubject: '',
    selectedChapter: ''
};

// --- 오디오북 플레이어 ---
let readerAudioState = {
    audio: null,          // 현재 Audio 객체
    currentSrc: '',       // 현재 로드된 오디오 경로
    subjId: '',           // 현재 재생 중인 과목 키
    chapterIdx: -1,       // 현재 재생 중인 단원 인덱스
    chapterTitle: '',     // 현재 재생 중인 단원 제목
    wasPlayingBeforeHidden: false, // 탭 전환 전 재생 상태 (모바일 자동정지 복원용)
    sectionBoundaries: [], // [{start, end}] 각 섹션의 추정 재생 구간(초)
    lastSectionIdx: -1,   // 마지막으로 스크롤된 섹션 인덱스
    autoScroll: true,     // 오디오 따라가기 자동 스크롤 여부
};

// 오디오 이어보기 위치 저장 키 접두사
const READER_AUDIO_POS_PREFIX = 'readerAudioPos_';
// 재생 속도 저장 키
const READER_AUDIO_RATE_KEY = 'readerAudioRate';
// 자동 스크롤 설정 저장 키
const READER_AUDIO_AUTOSCROLL_KEY = 'readerAudioAutoScroll';

/**
 * 단원의 오디오 파일 경로를 반환한다.
 * 우선 audio_manifest.js(AUDIO_MANIFEST)를 조회하고, 없으면
 * fileName 명명 규칙("1.맞춤형화장품 개요2026.md")으로부터 경로를 추론한다(폴백).
 * @returns {string|null} 오디오 경로 또는 null
 */
function getAudioPathForChapter(subjId, chapter) {
    let localPath = null;

    // 1) 매니페스트 우선 (단원 인덱스 기반)
    try {
        const chapters = (typeof STUDY_DATA !== 'undefined' && STUDY_DATA[subjId] && STUDY_DATA[subjId].chapters) || [];
        const idx = chapters.indexOf(chapter);
        if (typeof AUDIO_MANIFEST !== 'undefined' && AUDIO_MANIFEST &&
            AUDIO_MANIFEST[subjId] && idx >= 0 && AUDIO_MANIFEST[subjId][idx]) {
            localPath = AUDIO_MANIFEST[subjId][idx];
        }
    } catch (e) { /* 매니페스트 조회 실패 시 폘백 */ }

    // 2) 폘백: fileName 명명 규칙으로 추론
    if (!localPath) {
        if (!chapter || !chapter.fileName) return null;
        // "1.맞춤형화장품 개요2026.md" → "1_맞춤형화장품_개요2026"
        const base = chapter.fileName.replace(/\.md$/i, '');
        const m = base.match(/^(\d+)\.(.+)$/);
        if (!m) return null;
        const num = m[1];
        const title = m[2].trim().replace(/\s+/g, '_');
        const chNo = num.padStart(2, '0');
        localPath = `audiobook/mp3/${subjId}/ch${chNo}_${num}_${title}.mp3`;
    }

    // 3) 외부 CDN URL 변환 (audio_manifest.js의 getAudioUrl 사용)
    if (typeof getAudioUrl === 'function') {
        return getAudioUrl(localPath);
    }
    return localPath;
}

/** 화면 하단에 잠시 표시되는 토스트 알림 */
let _audioToastTimer = null;
function showAudioToast(msg) {
    let toast = document.getElementById('reader-audio-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'reader-audio-toast';
        toast.style.cssText = 'position:fixed;left:50%;bottom:2rem;transform:translateX(-50%);background:rgba(15,23,42,0.95);color:#fff;padding:0.6rem 1.1rem;border-radius:8px;font-size:0.85rem;z-index:9999;border:1px solid rgba(6,182,212,0.4);box-shadow:0 4px 16px rgba(0,0,0,0.4);opacity:0;transition:opacity 0.25s;pointer-events:none;max-width:90%;';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    if (_audioToastTimer) clearTimeout(_audioToastTimer);
    _audioToastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

/** 초를 "mm:ss" (1시간 이상이면 "h:mm:ss") 형식으로 변환 */
function formatAudioTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 이어보기 위치를 localStorage에서 읽기 */
function getSavedAudioPos(src) {
    try {
        const v = localStorage.getItem(READER_AUDIO_POS_PREFIX + src);
        const n = v ? parseFloat(v) : 0;
        return (isFinite(n) && n > 0) ? n : 0;
    } catch (e) { return 0; }
}

/** 이어보기 위치를 localStorage에 저장 (끝까지 들었으면 삭제) */
function saveAudioPos(src, pos, duration) {
    try {
        if (!src) return;
        // 끝에서 5초 이내 또는 95% 이상 들었으면 저장 위치 삭제(다음 재생은 처음부터)
        if (isFinite(duration) && duration > 0 && (pos >= duration - 5 || pos / duration >= 0.95)) {
            localStorage.removeItem(READER_AUDIO_POS_PREFIX + src);
        } else if (pos > 3) { // 3초 이하는 저장하지 않음(사실상 처음)
            localStorage.setItem(READER_AUDIO_POS_PREFIX + src, String(pos));
        }
    } catch (e) { /* noop */ }
}

/** 현재 오디오 재생 위치 저장 (단원 전환/화면 이동 전 호출) */
function persistCurrentAudioPos() {
    const a = readerAudioState.audio;
    if (a && readerAudioState.currentSrc) {
        saveAudioPos(readerAudioState.currentSrc, a.currentTime, a.duration);
    }
}

/** 플레이어 UI 요소 모음 */
function getAudioUI() {
    return {
        btn: document.getElementById('reader-audio-toggle-btn'),
        playerArea: document.getElementById('reader-audio-player-area'),
        label: document.getElementById('reader-audio-now-playing'),
        playPauseBtn: document.getElementById('reader-audio-playpause-btn'),
        seek: document.getElementById('reader-audio-seek'),
        curTime: document.getElementById('reader-audio-current'),
        durTime: document.getElementById('reader-audio-duration'),
        rateBtn: document.getElementById('reader-audio-rate-btn'),
        status: document.getElementById('reader-audio-status'),
        scrollBtn: document.getElementById('reader-audio-scroll-btn'),
    };
}

/**
 * 섹션별 예상 재생 구간을 계산한다.
 * 각 섹션의 텍스트 길이를 기준으로 전체 오디오 길이를 비례 배분한다.
 * @param {Array} sections - 섹션 배열
 * @param {number} duration - 오디오 전체 길이(초)
 * @returns {Array<{start:number,end:number}>} 섹션별 구간
 */
function computeSectionBoundaries(sections, duration) {
    if (!sections || !sections.length || !isFinite(duration) || duration <= 0) return [];
    const weights = sections.map(s => Math.max((s.content || '').length, 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = 0;
    return weights.map(w => {
        const len = (w / total) * duration;
        const start = cursor;
        cursor += len;
        return { start, end: cursor };
    });
}

/** 현재 재생 시간에 해당하는 섹션 인덱스를 반환한다. */
function getCurrentSectionIdx(currentTime) {
    const bounds = readerAudioState.sectionBoundaries;
    if (!bounds.length) return -1;
    for (let i = 0; i < bounds.length; i++) {
        if (currentTime >= bounds[i].start && currentTime < bounds[i].end) return i;
    }
    // 마지막 섹션 끝 이후면 마지막 인덱스 반환
    return bounds.length - 1;
}

/** 현재 섹션을 하이라이트하고 필요 시 스크롤한다. */
function highlightAndScrollToSection(idx) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return;

    // 하이라이트 갱신
    container.querySelectorAll('.reader-section-card').forEach(card => {
        card.classList.toggle('current-section', parseInt(card.dataset.sectionIdx) === idx);
    });

    // 자동 스크롤
    if (readerAudioState.autoScroll && idx !== readerAudioState.lastSectionIdx) {
        const target = document.getElementById(`reader-section-${idx}`);
        if (target) {
            // 접혀 있으면 펼치기
            if (target.classList.contains('collapsed')) {
                target.classList.remove('collapsed');
            }
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    readerAudioState.lastSectionIdx = idx;
}

/** timeupdate 이벤트에서 호출: 현재 섹션 동기화 */
function syncScrollWithAudio() {
    const a = readerAudioState.audio;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    const idx = getCurrentSectionIdx(a.currentTime);
    if (idx >= 0) highlightAndScrollToSection(idx);
}

/** 자동 스크롤 설정 저장/불러오기 */
function getSavedAutoScroll() {
    try {
        const v = localStorage.getItem(READER_AUDIO_AUTOSCROLL_KEY);
        return v === null ? true : v === '1';
    } catch (e) { return true; }
}
function saveAutoScroll(enabled) {
    try { localStorage.setItem(READER_AUDIO_AUTOSCROLL_KEY, enabled ? '1' : '0'); } catch (e) { /* noop */ }
}

/** 자동 스크롤 토글 버튼 UI 갱신 */
function updateAutoScrollBtn() {
    const ui = getAudioUI();
    if (!ui.scrollBtn) return;
    ui.scrollBtn.innerHTML = readerAudioState.autoScroll
        ? '<i class="fa-solid fa-arrows-up-down"></i> 스크롤 따라가기'
        : '<i class="fa-solid fa-arrows-up-down"></i> 스크롤 수동';
    ui.scrollBtn.classList.toggle('active', readerAudioState.autoScroll);
    ui.scrollBtn.title = readerAudioState.autoScroll
        ? '오디오 위치에 맞춰 자동으로 스크롤합니다'
        : '자동 스크롤이 꺼져 있습니다';
}

/** 자동 스크롤 토글 */
function toggleReaderAutoScroll() {
    readerAudioState.autoScroll = !readerAudioState.autoScroll;
    saveAutoScroll(readerAudioState.autoScroll);
    updateAutoScrollBtn();
    showAudioToast(readerAudioState.autoScroll ? '오디오 따라가기 켜짐' : '오디오 따라가기 꺼짐');
}

/** 재생/일시정지 아이콘 갱신 */
function updatePlayPauseIcon() {
    const ui = getAudioUI();
    const playing = readerAudioState.audio && !readerAudioState.audio.paused;
    if (ui.playPauseBtn) {
        ui.playPauseBtn.innerHTML = playing
            ? '<i class="fa-solid fa-pause"></i>'
            : '<i class="fa-solid fa-play"></i>';
        ui.playPauseBtn.title = playing ? '일시정지' : '재생';
    }
    if (ui.btn) {
        ui.btn.innerHTML = (readerAudioState.audio)
            ? '<i class="fa-solid fa-stop"></i> 정지'
            : '<i class="fa-solid fa-headphones"></i> 오디오 듣기';
    }
}

/** 재생 상태 메시지 표시 (로딩/버퍼링/오류) */
function setAudioStatus(msg) {
    const ui = getAudioUI();
    if (ui.status) {
        ui.status.textContent = msg || '';
        ui.status.style.display = msg ? 'inline' : 'none';
    }
}

/** 저장된 재생 속도 적용 */
function getSavedRate() {
    try {
        const v = parseFloat(localStorage.getItem(READER_AUDIO_RATE_KEY));
        return (isFinite(v) && v >= 0.5 && v <= 3) ? v : 1;
    } catch (e) { return 1; }
}

/** 재생 속도 순환 변경 (0.75 → 1 → 1.25 → 1.5 → 2 → 0.75) */
function cycleReaderAudioRate() {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const a = readerAudioState.audio;
    const current = a ? a.playbackRate : getSavedRate();
    let idx = rates.findIndex(r => Math.abs(r - current) < 0.01);
    idx = (idx + 1) % rates.length;
    const newRate = rates[idx];
    if (a) a.playbackRate = newRate;
    try { localStorage.setItem(READER_AUDIO_RATE_KEY, String(newRate)); } catch (e) { /* noop */ }
    const ui = getAudioUI();
    if (ui.rateBtn) ui.rateBtn.textContent = newRate + 'x';
}

/** 시크바 입력 → 오디오 위치 이동 */
function seekReaderAudio(value) {
    const a = readerAudioState.audio;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    a.currentTime = (parseFloat(value) / 100) * a.duration;
}

/**
 * 현재 재생 중인 오디오를 완전히 정지하고 상태를 초기화한다.
 * (단원 전환·과목 전환·다른 화면 이동 시 백그라운드 재생 방지)
 */
function stopReaderAudio() {
    persistCurrentAudioPos(); // 정지 전 위치 저장(이어보기)
    if (readerAudioState.audio) {
        try { readerAudioState.audio.pause(); } catch (e) { /* noop */ }
        readerAudioState.audio = null;
    }
    readerAudioState.currentSrc = '';
    readerAudioState.subjId = '';
    readerAudioState.chapterIdx = -1;
    readerAudioState.chapterTitle = '';
    readerAudioState.sectionBoundaries = [];
    readerAudioState.lastSectionIdx = -1;
    // 하이라이트 제거
    const container = document.getElementById('textbook-reader-container');
    if (container) {
        container.querySelectorAll('.reader-section-card.current-section').forEach(el => el.classList.remove('current-section'));
    }
    const ui = getAudioUI();
    if (ui.btn) ui.btn.innerHTML = '<i class="fa-solid fa-headphones"></i> 오디오 듣기';
    if (ui.playerArea) ui.playerArea.style.display = 'none';
    setAudioStatus('');
}

/** 재생/일시정지 토글 (플레이어 내 버튼) */
function toggleReaderPlayPause() {
    const a = readerAudioState.audio;
    if (!a) return;
    if (a.paused) {
        a.play().catch(err => {
            console.error('재개 실패:', err);
            setAudioStatus('재생 실패');
        });
    } else {
        a.pause();
    }
}

/**
 * 오디오 로드 및 재생 시작. 같은 단원이면 정지, 다른 단원이면 새로 로드.
 */
function toggleReaderAudio(subjId, chapterIdx) {
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters || !subj.chapters[chapterIdx]) return;
    const chapter = subj.chapters[chapterIdx];
    const audioPath = getAudioPathForChapter(subjId, chapter);
    if (!audioPath) {
        alert('이 단원은 오디오 파일이 없습니다.');
        return;
    }

    const ui = getAudioUI();

    // 같은 오디오를 다시 클릭 → 정지(플레이어 닫기)
    if (readerAudioState.audio && readerAudioState.currentSrc === audioPath) {
        stopReaderAudio();
        return;
    }

    // 다른 오디오 재생 중 → 정지 후 교체 (위치는 저장됨)
    if (readerAudioState.audio) {
        stopReaderAudio();
    }

    // 플레이어 영역 표시 + 로딩 표시
    if (ui.playerArea) ui.playerArea.style.display = 'block';
    if (ui.label) ui.label.textContent = chapter.chapterTitle;
    setAudioStatus('로딩 중…');
    if (ui.btn) ui.btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 로딩';
    if (ui.rateBtn) ui.rateBtn.textContent = getSavedRate() + 'x';

    // 새 오디오 생성
    const audio = new Audio();
    audio.preload = 'auto';
    readerAudioState.audio = audio;
    readerAudioState.currentSrc = audioPath;
    readerAudioState.subjId = subjId;
    readerAudioState.chapterIdx = chapterIdx;
    readerAudioState.chapterTitle = chapter.chapterTitle;
    readerAudioState.lastSectionIdx = -1;

    // 자동 스크롤 설정 복원
    readerAudioState.autoScroll = getSavedAutoScroll();
    updateAutoScrollBtn();

    // 이어보기: 메타데이터 로드 후 저장 위치로 이동
    audio.addEventListener('loadedmetadata', () => {
        const resume = getSavedAudioPos(audioPath);
        if (resume > 0 && resume < audio.duration - 5) {
            audio.currentTime = resume;
            setAudioStatus(formatAudioTime(resume) + '부터 이어듣기');
            setTimeout(() => setAudioStatus(''), 2500);
        } else {
            setAudioStatus('');
        }
        if (ui.durTime) ui.durTime.textContent = formatAudioTime(audio.duration);
        if (ui.seek) { ui.seek.disabled = false; }

        // 섹션별 예상 재생 구간 계산
        readerAudioState.sectionBoundaries = computeSectionBoundaries(chapter.sections, audio.duration);
        // 이어보기 위치에 맞는 섹션 즉시 하이라이트
        syncScrollWithAudio();
    });

    // 진행 시간/시크바 갱신 + 섹션 동기화
    audio.addEventListener('timeupdate', () => {
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        if (ui.seek && document.activeElement !== ui.seek) {
            ui.seek.value = String((audio.currentTime / audio.duration) * 100);
        }
        if (ui.curTime) ui.curTime.textContent = formatAudioTime(audio.currentTime);
        syncScrollWithAudio();
    });

    // 주기적 위치 저장 (5초마다)
    audio.addEventListener('timeupdate', () => {
        if (Math.floor(audio.currentTime) % 5 === 0) {
            saveAudioPos(audioPath, audio.currentTime, audio.duration);
        }
    });

    audio.addEventListener('play', () => { updatePlayPauseIcon(); setAudioStatus(''); });
    audio.addEventListener('pause', () => { updatePlayPauseIcon(); saveAudioPos(audioPath, audio.currentTime, audio.duration); });
    audio.addEventListener('waiting', () => setAudioStatus('버퍼링…'));
    audio.addEventListener('playing', () => setAudioStatus(''));
    audio.addEventListener('canplay', () => setAudioStatus(''));

    audio.addEventListener('ended', () => {
        saveAudioPos(audioPath, audio.duration, audio.duration); // 저장 위치 삭제
        updatePlayPauseIcon();
        setAudioStatus('재생 완료');
    });

    audio.addEventListener('error', () => {
        const code = audio.error ? audio.error.code : 0;
        const msgMap = {
            1: '오디오 로딩이 중단되었습니다.',
            2: '네트워크 오류로 오디오를 불러올 수 없습니다.',
            3: '오디오 디코딩에 실패했습니다.',
            4: '오디오 형식이 지원되지 않거나 파일을 찾을 수 없습니다.',
        };
        const msg = msgMap[code] || '오디오를 불러올 수 없습니다.';
        setAudioStatus(msg);
        alert(msg + '\n\n경로: ' + audioPath);
        stopReaderAudio();
    });

    // 저장된 재생 속도 적용
    audio.playbackRate = getSavedRate();

    // 소스 설정 후 재생
    audio.src = audioPath;
    const playPromise = audio.play();
    if (playPromise) {
        playPromise.then(() => {
            updatePlayPauseIcon();
        }).catch(err => {
            // 모바일 자동재생 정책 등으로 차단된 경우
            console.warn('자동재생 차단/재생 실패:', err);
            setAudioStatus('재생 버튼을 눌러 시작하세요');
            updatePlayPauseIcon();
        });
    }
}

// 모바일 브라우저: 탭 숨김 시 자동 일시정지, 복귀 시 상태 복원
document.addEventListener('visibilitychange', () => {
    const a = readerAudioState.audio;
    if (!a) return;
    if (document.hidden) {
        readerAudioState.wasPlayingBeforeHidden = !a.paused;
        if (!a.paused) { a.pause(); }
    }
    // 복귀 시 자동 재개는 하지 않음(사용자 제스처 필요 정책 회피). 아이콘만 갱신.
    if (!document.hidden) { updatePlayPauseIcon(); }
});

function renderTextbookReader() {
    const subjectSelect = document.getElementById('reader-subject-select');
    const chapterSelect = document.getElementById('reader-chapter-select');
    const container = document.getElementById('textbook-reader-container');
    
    if (!subjectSelect || !chapterSelect || !container) return;

    // Initialize reader convenience toolbar (font size, theme, focus mode, etc.)
    initReaderToolbar();
    
    // STUDY_DATA 로드 대기 (defer 로딩으로 인한 타이밍 이슈 방지)
    if (typeof STUDY_DATA === 'undefined' || !STUDY_DATA) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--color-primary); margin-bottom: 1rem; display: block;"></i>
                <h3>교재 데이터를 불러오는 중...</h3>
                <p>잠시만 기다려 주세요.</p>
            </div>
        `;
        setTimeout(renderTextbookReader, 200);
        return;
    }
    
    // Always repopulate subject select to ensure fresh state
    const previousValue = subjectSelect.value || textbookReaderState.selectedSubject;
    subjectSelect.innerHTML = '<option value="">과목을 선택하세요</option>';
    
    // 과목 번호 순서대로 정렬 (1과목 → 4과목)
    const subjectOrder = ['law', 'manufacturing', 'safety', 'understanding'];
    const sortedSubjIds = Object.keys(STUDY_DATA).sort((a, b) => {
        const idxA = subjectOrder.indexOf(a);
        const idxB = subjectOrder.indexOf(b);
        // 목록에 없는 키는 뒤로
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
    
    sortedSubjIds.forEach(subjId => {
        const subj = STUDY_DATA[subjId];
        // Skip if no name or chapters
        if (!subj || !subj.name || !subj.chapters || subj.chapters.length === 0) return;
        const option = document.createElement('option');
        option.value = subjId;
        option.textContent = subj.name;
        subjectSelect.appendChild(option);
    });
    
    // Restore subject selection
    if (previousValue && subjectSelect.querySelector(`option[value="${previousValue}"]`)) {
        subjectSelect.value = previousValue;
        textbookReaderState.selectedSubject = previousValue;
    }
    
    // Restore previous selections
    if (textbookReaderState.selectedSubject) {
        subjectSelect.value = textbookReaderState.selectedSubject;
        populateChapterSelect(textbookReaderState.selectedSubject);
        if (textbookReaderState.selectedChapter) {
            chapterSelect.value = textbookReaderState.selectedChapter;
            renderChapterContent(textbookReaderState.selectedSubject, textbookReaderState.selectedChapter);
        }
    }
    
    // Bind events only once
    if (!subjectSelect.dataset.bound) {
        subjectSelect.dataset.bound = 'true';
        
        subjectSelect.addEventListener('change', (e) => {
            const subjId = e.target.value;
            textbookReaderState.selectedSubject = subjId;
            textbookReaderState.selectedChapter = '';
            const hadAudio = !!readerAudioState.audio;
            stopReaderAudio();
            if (hadAudio) showAudioToast('과목이 변경되어 오디오 재생이 중지되었습니다.');
            
            if (subjId) {
                chapterSelect.disabled = false;
                populateChapterSelect(subjId);
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                        <h3>단원을 선택하세요</h3>
                        <p>위에서 단원을 선택하면 해당 교재의 본문 내용이 표시됩니다.</p>
                    </div>
                `;
            } else {
                chapterSelect.disabled = true;
                chapterSelect.innerHTML = '<option value="">단원을 선택하세요</option>';
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                        <h3>읽을 교재를 선택하세요</h3>
                        <p>위에서 과목과 단원을 선택하면 해당 교재의 본문 내용이 표시됩니다.</p>
                    </div>
                `;
            }
        });
        
        chapterSelect.addEventListener('change', (e) => {
            const chapterIdx = e.target.value;
            textbookReaderState.selectedChapter = chapterIdx;
            
            if (chapterIdx && textbookReaderState.selectedSubject) {
                renderChapterContent(textbookReaderState.selectedSubject, parseInt(chapterIdx));
            }
        });
    }
}

function populateChapterSelect(subjId) {
    const chapterSelect = document.getElementById('reader-chapter-select');
    if (!chapterSelect) return;
    
    chapterSelect.innerHTML = '<option value="">단원을 선택하세요</option>';
    
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters) return;
    
    subj.chapters.forEach((chapter, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = chapter.chapterTitle;
        chapterSelect.appendChild(option);
    });
}

function renderChapterContent(subjId, chapterIdx) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return;

    chapterIdx = parseInt(chapterIdx);
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters || isNaN(chapterIdx) || !subj.chapters[chapterIdx]) return;

    const chapter = subj.chapters[chapterIdx];

    // 다른 단원으로 이동하면 이전 오디오 정지
    if (readerAudioState.audio &&
        (readerChapterContext.subjId !== subjId || readerChapterContext.chapterIdx !== chapterIdx)) {
        stopReaderAudio();
        showAudioToast('단원이 변경되어 오디오 재생이 중지되었습니다.');
    }

    readerChapterContext.subjId = subjId;
    readerChapterContext.chapterIdx = chapterIdx;

    // Show reader auxiliary UI
    const toolbar = document.getElementById('reader-toolbar');
    const toc = document.getElementById('reader-toc');
    const progressBar = document.getElementById('reader-progress-bar');
    if (toolbar) toolbar.style.display = 'flex';
    if (toc) toc.style.display = 'block';
    if (progressBar) progressBar.style.display = 'block';

    const bookmarks = getReaderBookmarks();

    // Build TOC
    const tocList = document.getElementById('reader-toc-list');
    if (tocList) {
        tocList.innerHTML = chapter.sections.map((section, idx) => `
            <div class="reader-toc-item" data-section-idx="${idx}">
                <span class="toc-num">${idx + 1}</span>
                <span>${esc(section.title)}</span>
            </div>
        `).join('');
        tocList.querySelectorAll('.reader-toc-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.sectionIdx);
                const target = document.getElementById(`reader-section-${idx}`);
                if (target) {
                    // Expand if collapsed
                    if (target.classList.contains('collapsed')) {
                        target.classList.remove('collapsed');
                    }
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // Estimate reading time (Korean ~500 chars/min)
    const totalChars = chapter.sections.reduce((acc, s) => acc + (s.content ? s.content.length : 0), 0);
    const readMinutes = Math.max(1, Math.round(totalChars / 500));

    const audioPath = getAudioPathForChapter(subjId, chapter);
    const hasAudio = !!audioPath;

    let html = `
        <div class="reader-readable-width">
        <div class="reader-chapter-header-card">
            <span class="badge badge-cyan">${esc(subj.name)}</span>
            <h3>${esc(chapter.chapterTitle)}</h3>
            <div class="reader-chapter-meta">
                <span><i class="fa-solid fa-layer-group"></i> 섹션 ${chapter.sections.length}개</span>
                <span><i class="fa-regular fa-clock"></i> 예상 읽기 시간 약 ${readMinutes}분</span>
                <a href="${esc(chapter.filePath)}" target="_blank" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 원본 HTML
                </a>
                ${hasAudio ? `
                <button id="reader-audio-toggle-btn" class="btn btn-secondary" onclick="toggleReaderAudio('${subjId}', ${chapterIdx})" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fa-solid fa-headphones"></i> 오디오 듣기
                </button>` : ''}
            </div>
            ${hasAudio ? `
            <div id="reader-audio-player-area" style="display: none; margin-top: 0.75rem; padding: 0.75rem 0.9rem; background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 8px; font-size: 0.85rem; color: var(--color-text-muted);">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.55rem;">
                    <i class="fa-solid fa-circle-play" style="color: var(--color-primary);"></i>
                    <span id="reader-audio-now-playing" style="color: var(--color-text-main); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                    <span id="reader-audio-status" style="margin-left: auto; font-size: 0.78rem; color: var(--color-warning); display: none;"></span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <button id="reader-audio-playpause-btn" class="btn btn-secondary" onclick="toggleReaderPlayPause()" title="재생" style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; padding: 0; border-radius: 50%; flex-shrink: 0;">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <span id="reader-audio-current" style="font-variant-numeric: tabular-nums; flex-shrink: 0;">0:00</span>
                    <input type="range" id="reader-audio-seek" min="0" max="100" value="0" step="0.1" disabled oninput="seekReaderAudio(this.value)" style="flex: 1; accent-color: var(--color-primary); cursor: pointer; height: 4px;">
                    <span id="reader-audio-duration" style="font-variant-numeric: tabular-nums; flex-shrink: 0;">0:00</span>
                    <button id="reader-audio-rate-btn" class="btn btn-secondary" onclick="cycleReaderAudioRate()" title="재생 속도" style="font-size: 0.78rem; padding: 0.25rem 0.5rem; flex-shrink: 0; min-width: 3rem;">1x</button>
                    <button id="reader-audio-scroll-btn" class="btn btn-secondary" onclick="toggleReaderAutoScroll()" title="오디오 위치에 맞춰 자동으로 스크롤" style="font-size: 0.78rem; padding: 0.25rem 0.5rem; flex-shrink: 0; white-space: nowrap;">
                        <i class="fa-solid fa-arrows-up-down"></i> 스크롤 따라가기
                    </button>
                </div>
            </div>` : ''}
        </div>
    `;

    chapter.sections.forEach((section, idx) => {
        const bookmarkKey = `${subjId}_${chapterIdx}_${idx}`;
        const isBookmarked = bookmarks.includes(bookmarkKey);
        html += `
            <div class="reader-section-card" id="reader-section-${idx}" data-section-idx="${idx}">
                <div class="reader-section-header" data-section-idx="${idx}">
                    <i class="fa-solid fa-chevron-down reader-section-toggle"></i>
                    <span class="reader-section-num">${idx + 1}</span>
                    <h4 class="reader-section-title">${esc(section.title)}</h4>
                    <button class="reader-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-bookmark-key="${esc(bookmarkKey)}" title="북마크 ${isBookmarked ? '제거' : '추가'}">
                        <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark"></i>
                    </button>
                </div>
                <div class="reader-section-body">
                    <div class="textbook-reader-section-content">
                        ${formatSectionContentForReader(section.content)}
                    </div>
                </div>
            </div>
        `;
    });

    // Prev / Next chapter navigation
    const prevChapter = chapterIdx > 0 ? subj.chapters[chapterIdx - 1] : null;
    const nextChapter = chapterIdx < subj.chapters.length - 1 ? subj.chapters[chapterIdx + 1] : null;
    html += `
        <div class="reader-chapter-nav">
            <button class="reader-nav-btn prev" ${prevChapter ? '' : 'disabled'} data-nav-idx="${chapterIdx - 1}">
                <span class="nav-dir"><i class="fa-solid fa-arrow-left"></i> 이전 단원</span>
                <span class="nav-title">${prevChapter ? esc(prevChapter.chapterTitle) : '이전 단원 없음'}</span>
            </button>
            <button class="reader-nav-btn next" ${nextChapter ? '' : 'disabled'} data-nav-idx="${chapterIdx + 1}">
                <span class="nav-dir">다음 단원 <i class="fa-solid fa-arrow-right"></i></span>
                <span class="nav-title">${nextChapter ? esc(nextChapter.chapterTitle) : '다음 단원 없음'}</span>
            </button>
        </div>
        </div><!-- /reader-readable-width -->
    `;

    container.innerHTML = html;

    // Section collapse toggles
    container.querySelectorAll('.reader-section-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.reader-bookmark-btn')) return;
            const card = header.closest('.reader-section-card');
            if (card) card.classList.toggle('collapsed');
        });
    });

    // Bookmark buttons
    container.querySelectorAll('.reader-bookmark-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReaderBookmark(btn.dataset.bookmarkKey, btn);
        });
    });

    // Prev/Next nav buttons
    container.querySelectorAll('.reader-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const navIdx = parseInt(btn.dataset.navIdx);
            textbookReaderState.selectedChapter = String(navIdx);
            const chapterSelect = document.getElementById('reader-chapter-select');
            if (chapterSelect) chapterSelect.value = String(navIdx);
            renderChapterContent(subjId, navIdx);
            container.scrollTop = 0;
        });
    });

    // Table expand buttons
    container.querySelectorAll('.reader-table-wrapper').forEach(wrapper => {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'reader-table-expand-btn';
        expandBtn.title = '표 전체 화면으로 보기';
        expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        expandBtn.addEventListener('click', () => openTableModal(wrapper));
        wrapper.appendChild(expandBtn);
    });

    // Scroll position reset + scroll spy binding
    container.scrollTop = 0;
    bindReaderScrollEvents();
    applyReaderFontScale();
    applyReaderThemeClass();
}

// --- Reader convenience feature state & logic ---
let readerChapterContext = { subjId: '', chapterIdx: 0 };
let readerFontScale = parseFloat(localStorage.getItem('readerFontScale')) || 1;
let readerLightTheme = localStorage.getItem('readerLightTheme') === 'true';
let readerScrollBound = false;

function getReaderBookmarks() {
    try {
        return JSON.parse(localStorage.getItem('readerBookmarks')) || [];
    } catch { return []; }
}

function toggleReaderBookmark(key, btn) {
    let bookmarks = getReaderBookmarks();
    const idx = bookmarks.indexOf(key);
    if (idx >= 0) {
        bookmarks.splice(idx, 1);
        btn.classList.remove('bookmarked');
        btn.querySelector('i').className = 'fa-regular fa-bookmark';
        btn.title = '북마크 추가';
    } else {
        bookmarks.push(key);
        btn.classList.add('bookmarked');
        btn.querySelector('i').className = 'fa-solid fa-bookmark';
        btn.title = '북마크 제거';
    }
    localStorage.setItem('readerBookmarks', JSON.stringify(bookmarks));
}

function applyReaderFontScale() {
    const container = document.getElementById('textbook-reader-container');
    const display = document.getElementById('reader-font-size-display');
    if (container) container.style.setProperty('--reader-font-scale', readerFontScale);
    if (display) display.textContent = Math.round(readerFontScale * 100) + '%';
    localStorage.setItem('readerFontScale', readerFontScale);
}

function applyReaderThemeClass() {
    const view = document.getElementById('textbook-reader-view');
    const toggleBtn = document.getElementById('reader-theme-toggle');
    if (view) view.classList.toggle('reader-light-theme', readerLightTheme);
    if (toggleBtn) {
        toggleBtn.innerHTML = readerLightTheme
            ? '<i class="fa-solid fa-moon"></i> <span>다크</span>'
            : '<i class="fa-solid fa-sun"></i> <span>라이트</span>';
    }
    localStorage.setItem('readerLightTheme', readerLightTheme);
}

function bindReaderScrollEvents() {
    const container = document.getElementById('textbook-reader-container');
    if (!container || readerScrollBound) return;
    readerScrollBound = true;

    container.addEventListener('scroll', () => {
        // Progress bar
        const progressFill = document.getElementById('reader-progress-fill');
        if (progressFill) {
            const max = container.scrollHeight - container.clientHeight;
            const pct = max > 0 ? (container.scrollTop / max) * 100 : 0;
            progressFill.style.width = pct + '%';
        }
        // Back to top visibility
        const backBtn = document.getElementById('reader-back-to-top');
        if (backBtn) backBtn.style.display = container.scrollTop > 400 ? 'block' : 'none';

        // Scroll spy — highlight current section in TOC
        const cards = container.querySelectorAll('.reader-section-card');
        const containerTop = container.getBoundingClientRect().top;
        let currentIdx = -1;
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            if (rect.top - containerTop < 120) {
                currentIdx = parseInt(card.dataset.sectionIdx);
            }
            card.classList.toggle('current-section', parseInt(card.dataset.sectionIdx) === currentIdx);
        });
        document.querySelectorAll('.reader-toc-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.sectionIdx) === currentIdx);
        });
    });

    // Back to top click
    const backBtn = document.getElementById('reader-back-to-top');
    if (backBtn && !backBtn.dataset.bound) {
        backBtn.dataset.bound = 'true';
        backBtn.addEventListener('click', () => {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function initReaderToolbar() {
    const decBtn = document.getElementById('reader-font-decrease');
    const incBtn = document.getElementById('reader-font-increase');
    const resetBtn = document.getElementById('reader-font-reset');
    const themeBtn = document.getElementById('reader-theme-toggle');
    const focusBtn = document.getElementById('reader-focus-toggle');
    const expandAllBtn = document.getElementById('reader-expand-all');
    const collapseAllBtn = document.getElementById('reader-collapse-all');
    const modalClose = document.getElementById('reader-table-modal-close');
    const modal = document.getElementById('reader-table-modal');

    if (decBtn && !decBtn.dataset.bound) {
        decBtn.dataset.bound = 'true';
        decBtn.addEventListener('click', () => {
            readerFontScale = Math.max(0.85, +(readerFontScale - 0.05).toFixed(2));
            applyReaderFontScale();
        });
    }
    if (incBtn && !incBtn.dataset.bound) {
        incBtn.dataset.bound = 'true';
        incBtn.addEventListener('click', () => {
            readerFontScale = Math.min(1.4, +(readerFontScale + 0.05).toFixed(2));
            applyReaderFontScale();
        });
    }
    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', () => {
            readerFontScale = 1;
            applyReaderFontScale();
        });
    }
    if (themeBtn && !themeBtn.dataset.bound) {
        themeBtn.dataset.bound = 'true';
        themeBtn.addEventListener('click', () => {
            readerLightTheme = !readerLightTheme;
            applyReaderThemeClass();
        });
    }
    if (focusBtn && !focusBtn.dataset.bound) {
        focusBtn.dataset.bound = 'true';
        focusBtn.addEventListener('click', () => {
            const focused = document.body.classList.toggle('reader-focus-mode');
            focusBtn.classList.toggle('active', focused);
            focusBtn.innerHTML = focused
                ? '<i class="fa-solid fa-compress"></i> <span>집중 해제</span>'
                : '<i class="fa-solid fa-expand"></i> <span>집중 모드</span>';
        });
    }
    if (expandAllBtn && !expandAllBtn.dataset.bound) {
        expandAllBtn.dataset.bound = 'true';
        expandAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#textbook-reader-container .reader-section-card.collapsed')
                .forEach(c => c.classList.remove('collapsed'));
        });
    }
    if (collapseAllBtn && !collapseAllBtn.dataset.bound) {
        collapseAllBtn.dataset.bound = 'true';
        collapseAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#textbook-reader-container .reader-section-card')
                .forEach(c => c.classList.add('collapsed'));
        });
    }
    if (modalClose && !modalClose.dataset.bound) {
        modalClose.dataset.bound = 'true';
        modalClose.addEventListener('click', closeTableModal);
    }
    if (modal && !modal.dataset.bound) {
        modal.dataset.bound = 'true';
        modal.querySelector('.reader-table-modal-backdrop').addEventListener('click', closeTableModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') closeTableModal();
        });
    }
}

function openTableModal(wrapper) {
    const modal = document.getElementById('reader-table-modal');
    const body = document.getElementById('reader-table-modal-body');
    if (!modal || !body) return;
    const table = wrapper.querySelector('table');
    if (!table) return;
    body.innerHTML = '';
    body.appendChild(table.cloneNode(true));
    modal.style.display = 'flex';
}

function closeTableModal() {
    const modal = document.getElementById('reader-table-modal');
    if (modal) modal.style.display = 'none';
}

function formatSectionContentForReader(rawContent) {
    // 1. 안전한 인라인 태그를 플레이스홀더 토큰으로 치환 (이스케이프 전에 처리)
    //    이렇게 하면 escapeHTML이 태그를 엔티티로 변환하는 것을 방지할 수 있음
    let html = String(rawContent);
    html = html.replace(/<br\s*\/?>/gi, 'BR_TOKEN');
    html = html.replace(/<sup>/gi, 'SUP_O');
    html = html.replace(/<\/sup>/gi, 'SUP_C');
    html = html.replace(/&nbsp;/gi, 'NBSP_TOKEN');

    // 2. HTML 이스케이프 (나머지 위험 문자만 엔티티로 변환)
    html = escapeHTML(html);

    // 3. 토큰을 실제 안전한 태그로 복원
    html = html.replace(/BR_TOKEN/gi, '<br>');
    html = html.replace(/SUP_O/gi, '<sup>');
    html = html.replace(/SUP_C/gi, '</sup>');
    html = html.replace(/NBSP_TOKEN/gi, '&nbsp;');
    
    // 3. 마크다운 볼드 처리
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 4. 줄 단위 처리 (마크다운 테이블을 실제 HTML 테이블로 변환)
    const lines = html.split(/\r?\n/);
    const output = [];
    let tableRows = [];
    let quoteLines = [];
    let codeLines = [];
    let inCodeBlock = false;
    
    const flushTable = () => {
        if (tableRows.length === 0) return;
        
        // 구분 행(|---|)을 제외한 데이터 행만 추출
        const dataRows = tableRows.filter(row => {
            const cells = row.split('|').map(c => c.trim()).filter(c => c !== '');
            return !cells.every(c => /^:?-+:?$/.test(c));
        });
        
        if (dataRows.length === 0) {
            tableRows = [];
            return;
        }
        
        let tableHTML = '<div class="reader-table-wrapper"><table class="reader-table">';
        dataRows.forEach((row, idx) => {
            const cells = row.split('|').map(c => c.trim()).filter(c => c !== '');
            const tag = idx === 0 ? 'th' : 'td';
            tableHTML += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
        });
        tableHTML += '</table></div>';
        output.push(tableHTML);
        tableRows = [];
    };
    
    const flushQuote = () => {
        if (quoteLines.length === 0) return;
        output.push(`<div class="md-quote">${quoteLines.join('<br>')}</div>`);
        quoteLines = [];
    };
    
    const flushCode = () => {
        if (codeLines.length === 0) return;
        output.push(`<pre class="reader-code-block">${codeLines.join('\n')}</pre>`);
        codeLines = [];
    };
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // 코드블록(```) 처리 - 테이블/인용구 처리보다 우선
        if (trimmed.startsWith('```')) {
            if (inCodeBlock) {
                flushCode();
                inCodeBlock = false;
            } else {
                flushTable();
                flushQuote();
                inCodeBlock = true;
            }
            return;
        }
        if (inCodeBlock) {
            codeLines.push(line);
            return;
        }
        
        // 테이블 행 (| 로 시작)
        if (trimmed.startsWith('|')) {
            flushQuote();
            tableRows.push(line);
            return;
        } else {
            flushTable();
        }
        
        // 인용구 (> 로 시작)
        if (trimmed.startsWith('>')) {
            quoteLines.push(line.replace(/^>\s*/, ''));
            return;
        } else {
            flushQuote();
        }
        
        // 빈 줄
        if (trimmed === '') {
            output.push('<div style="height: 0.5rem;"></div>');
            return;
        }
        
        // 헤더 (#### 를 ### 보다 먼저 체크)
        if (trimmed.startsWith('#### ')) {
            output.push(`<h6 class="md-h4">${line.replace(/^####\s+/, '')}</h6>`);
            return;
        }
        if (trimmed.startsWith('### ')) {
            output.push(`<h5 class="md-h3">${line.replace(/^###\s+/, '')}</h5>`);
            return;
        }
        
        // 구분선
        if (trimmed === '---') {
            output.push('<hr class="reader-hr">');
            return;
        }
        
        // 리스트 항목 (들여쓰기 레벨 반영)
        const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
        if (listMatch) {
            const indentLevel = Math.floor(listMatch[1].length / 2);
            output.push(`<div class="md-list-item" style="padding-left: ${0.5 + indentLevel * 1.25}rem;"><span class="md-bullet">•</span> <span>${listMatch[2]}</span></div>`);
            return;
        }
        
        // 번호 리스트 (①② 등 유지, 일반 문단으로)
        // 일반 문단
        output.push(`<p class="md-para">${line}</p>`);
    });
    
    // 남은 블록 플러시
    flushTable();
    flushQuote();
    flushCode();
    
    return output.join('');
}

// 윈도우 로드 시 구동
window.addEventListener('DOMContentLoaded', () => {
    initApp();
    // DOM이 완전히 로드된 후 토글 버튼 설정
    setTimeout(() => {
        setupOrientationToggle();
    }, 100);
});
