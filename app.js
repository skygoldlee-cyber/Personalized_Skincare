// app.js - 맞춤형화장품 조제관리사 학습 플랫폼 애플리케이션 로직

// --- 상태 관리 객체 (State) ---
const state = {
    currentView: 'dashboard-view',
    
    // 로컬스토리지 연동 데이터
    memorizedCards: new Set(), // 외운 카드 ID 목록
    weakCards: new Set(),      // 헷갈린 카드 ID 목록
    quizResults: {},           // { quizId: { solved: true, correct: true } }
    
    // 플래시카드 현재 세션 상태
    flashcards: {
        subject: 'law',
        currentIndex: 0,
        keyOnly: false,
        data: [] // 현재 필터링된 카드 목록
    },
    
    // 퀴즈 현재 세션 상태
    quiz: {
        subject: 'law',
        data: [],        // 출제된 퀴즈 목록 (보통 10문제)
        currentIndex: 0,
        correctCount: 0,
        solvedList: []   // 이번 세션에 제출한 답 기록
    }
};

// --- 초기화 및 로컬스토리지 로드 ---
function initApp() {
    loadProgress();
    setupNavigation();
    setupEventListeners();
    
    // 초기 뷰 렌더링
    renderDashboard();
    updateGlobalStats();
}

// 로컬스토리지에서 진도 가져오기
function loadProgress() {
    const memorized = localStorage.getItem('fc_memorized');
    const weak = localStorage.getItem('fc_weak');
    const quizzes = localStorage.getItem('quiz_results');
    
    if (memorized) {
        try {
            JSON.parse(memorized).forEach(id => state.memorizedCards.add(id));
        } catch(e) { console.error(e); }
    }
    
    if (weak) {
        try {
            JSON.parse(weak).forEach(id => state.weakCards.add(id));
        } catch(e) { console.error(e); }
    }
    
    if (quizzes) {
        try {
            state.quizResults = JSON.parse(quizzes);
        } catch(e) { console.error(e); }
    }
}

// 로컬스토리지에 진도 저장
function saveProgress() {
    localStorage.setItem('fc_memorized', JSON.stringify([...state.memorizedCards]));
    localStorage.setItem('fc_weak', JSON.stringify([...state.weakCards]));
    localStorage.setItem('quiz_results', JSON.stringify(state.quizResults));
    
    updateGlobalStats();
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
        'review-view': { title: '오답 및 중요 복습', subtitle: '헷갈리거나 어려운 약점 카드 집중 복습' }
    };
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            
            // 네비게이션 활성화 클래스 변경
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
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
            } else if (target === 'flashcard-view') {
                loadFlashcards();
            } else if (target === 'review-view') {
                renderReviewList();
            }
        });
    });
}

// 외부에서 특정 뷰로 전환하는 유틸리티
function switchView(targetView) {
    const navItem = document.querySelector(`.nav-item[data-target="${targetView}"]`);
    if (navItem) {
        navItem.click();
    }
}

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
                    <h4>${subj.name}</h4>
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
    document.getElementById('card-back-definition').innerHTML = card.definition.replace(/\n/g, '<br>');
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
    qText = qText.replace(/\[\s*빈칸\s*\]/g, '<strong>[ 빈칸 ]</strong>');
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
    return str.replace(/\s+/g, '').replace(/[\*`'"\[\]\(\)]/g, '').toLowerCase();
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
    
    // 정답 체크 (유연한 매칭)
    const cleanedUser = cleanForCompare(userAnswer);
    const cleanedCorrect = cleanForCompare(currentQuiz.answer);
    
    const isCorrect = (cleanedUser === cleanedCorrect);
    
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
function renderReviewList() {
    const container = document.getElementById('review-cards-list-container');
    container.innerHTML = '';
    
    if (state.weakCards.size === 0) {
        document.getElementById('review-empty-state').style.display = 'flex';
        document.getElementById('start-weak-quiz-btn').style.display = 'none';
        return;
    }
    
    document.getElementById('review-empty-state').style.display = 'none';
    document.getElementById('start-weak-quiz-btn').style.display = 'inline-flex';
    
    // 모든 과목 데이터에서 헷갈린 카드 수집
    const allCards = [];
    Object.keys(STUDY_DATA).forEach(subjId => {
        STUDY_DATA[subjId].cards.forEach(card => {
            if (state.weakCards.has(card.id)) {
                allCards.push({ ...card, subjectName: STUDY_DATA[subjId].name });
            }
        });
    });
    
    allCards.forEach(card => {
        const itemHTML = `
            <div class="review-card-item" id="rev-${card.id}">
                <div class="review-card-item-header">
                    <span class="card-badge">${card.subjectName}</span>
                    <button class="review-remove-btn" onclick="removeWeakCard('${card.id}')">
                        <i class="fa-solid fa-trash-can"></i> 제외
                    </button>
                </div>
                <h5>${card.term}</h5>
                <p>${card.definition}</p>
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

// 헷갈린 카드들로 즉시 기출 퀴즈를 출제하는 번개 퀴즈 모드
function startWeakFocusQuiz() {
    const weakList = [];
    Object.keys(STUDY_DATA).forEach(subjId => {
        // 해당 과목 내 퀴즈 중, 헷갈린 카드의 term이나 definition과 매칭되는 퀴즈가 있거나
        // 혹은 직접 오답 카드들에 대한 OX / 주관식 용어 퀴즈 생성
        STUDY_DATA[subjId].cards.forEach(card => {
            if (state.weakCards.has(card.id)) {
                weakList.push({
                    id: card.id,
                    category: card.category,
                    context: `[오답 집중 학습] 정의에 해당하는 용어를 입력하세요.`,
                    question: card.definition,
                    answer: card.term,
                    type: 'term'
                });
            }
        });
    });
    
    if (weakList.length === 0) return;
    
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
        if (confirm("정말 모든 학습 진도를 초기화하시겠습니까? 외운 카드 및 오답 정보가 지워집니다.")) {
            state.memorizedCards.clear();
            state.weakCards.clear();
            state.quizResults = {};
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
}

// 윈도우 로드 시 구동
window.addEventListener('DOMContentLoaded', initApp);
