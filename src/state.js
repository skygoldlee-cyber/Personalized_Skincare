// src/state.js — 전역 상태(State) 및 로컬스토리지 영속성 레이어 모듈 (글로벌 스코프 실행)
//
// v2 리뷰 권고 #1 (거대한 단일 자바스크립트 파일 — 점진적 모듈화) 대응.
// app.js(3,300+ 라인 모놀리스)에서 전역 상태 객체와 그 영속성(로드/저장) 로직을
// 독립 모듈로 분리했습니다. 이 파일은 app.js보다 먼저 로드되어야 하며,
// ES Modules 전환 시 `export`만 추가하면 되도록 부수효과 없는 순수 선언으로 구성했습니다.
//
// 참고: saveProgress()는 대시보드 통계 갱신을 위해 app.js의 updateGlobalStats()를
// 호출합니다. 전역 함수 참조이므로 모듈 분리 후에도 동작은 동일합니다.

/* =======================================================
   📦 전역 학습 상태 객체 (Global Application State)
   ======================================================= */
const state = {
    currentView: 'dashboard-view',

    // 로컬스토리지 연동 데이터
    memorizedCards: new Set(), // 외운 카드 ID 목록
    weakCards: new Set(),      // 헷갈린 카드 ID 목록
    quizResults: {},           // { quizId: { solved: true, correct: true } }
    reviewFilter: 'all',       // 오답노트 필터 상태 ('all', 'law', 'manufacturing', 'safety', 'understanding')

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
    },

    // 스마트 훈련소 세션 상태
    trainer: {
        activeSubView: 'menu',
        limits: {
            currentIndex: 0,
            shuffledData: [],
            correctCount: 0
        },
        calc: {
            currentQuestion: null,
            correctCount: 0,
            totalSolved: 0
        },
        ingredients: {
            currentIndex: 0,
            shuffledQuestions: [],
            correctCount: 0
        },
        pomodoro: {
            timerId: null,
            timeLeft: 25 * 60,
            status: 'idle', // 'idle', 'work', 'break'
            totalTimeToday: 0
        }
    }
};

/* =======================================================
   💾 상태 영속성 (localStorage Load / Save)
   ======================================================= */

// 로컬스토리지에서 진도 가져오기
function loadProgress() {
    const memorized = localStorage.getItem('fc_memorized');
    const weak = localStorage.getItem('fc_weak');
    const quizzes = localStorage.getItem('quiz_results');

    if (memorized) {
        try {
            JSON.parse(memorized).forEach(id => state.memorizedCards.add(id));
        } catch (e) { console.error(e); }
    }

    if (weak) {
        try {
            JSON.parse(weak).forEach(id => state.weakCards.add(id));
        } catch (e) { console.error(e); }
    }

    if (quizzes) {
        try {
            state.quizResults = JSON.parse(quizzes);
        } catch (e) { console.error(e); }
    }

    // 뽀모도로 누적 시간은 "오늘" 기준이므로, 날짜가 바뀌었으면 0으로 리셋
    const pomoDate = localStorage.getItem('pomo_total_time_date');
    const todayStr = new Date().toISOString().split('T')[0];
    if (pomoDate !== todayStr) {
        state.trainer.pomodoro.totalTimeToday = 0;
        localStorage.setItem('pomo_total_time', '0');
        localStorage.setItem('pomo_total_time_date', todayStr);
    } else {
        const totalPomo = localStorage.getItem('pomo_total_time');
        if (totalPomo) {
            state.trainer.pomodoro.totalTimeToday = parseInt(totalPomo) || 0;
        }
    }
}

// 로컬스토리지에 진도 저장
function saveProgress() {
    localStorage.setItem('fc_memorized', JSON.stringify([...state.memorizedCards]));
    localStorage.setItem('fc_weak', JSON.stringify([...state.weakCards]));
    localStorage.setItem('quiz_results', JSON.stringify(state.quizResults));

    // 대시보드 글로벌 통계 갱신 (app.js에 정의된 전역 함수; 로드 순서상 런타임에 사용 가능)
    if (typeof updateGlobalStats === 'function') {
        updateGlobalStats();
    }
}
