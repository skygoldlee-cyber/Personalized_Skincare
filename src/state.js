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
/** @type {import('./types.js').State} */
export const state = {
    currentView: 'dashboard-view',

    // 로컬스토리지 연동 데이터
    memorizedCards: new Set(), // 외운 카드 ID 목록
    weakCards: new Set(),      // 헷갈린 카드 ID 목록
    quizResults: {},           // { quizId: { solved: true, correct: true } }
    reviewFilter: 'all',       // 오답노트 필터 상태 ('all' 또는 과목 key — 런타임에 registry에서 동적 생성)

    // 플래시카드 현재 세션 상태
    flashcards: {
        subject: null,           // 초기값 null — initApp()에서 registry 첫 번째 과목으로 설정
        currentIndex: 0,
        keyOnly: false,
        shuffle: false,          // 랜덤 셔플 모드
        difficultyFilter: 'all', // 'all', 'easy', 'medium', 'hard'
        sortBy: 'importance',    // 'importance' or 'default'
        data: [] // 현재 필터링된 카드 목록
    },

    // 퀴즈 현재 세션 상태
    quiz: {
        subject: null,           // 초기값 null — initApp()에서 registry 첫 번째 과목으로 설정
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
            correctCount: 0,
            solvedList: []
        },
        calc: {
            currentQuestion: null,
            correctCount: 0,
            totalSolved: 0
        },
        ingredients: {
            currentIndex: 0,
            shuffledQuestions: [],
            correctCount: 0,
            solvedList: []
        },
        pomodoro: {
            timerId: null,
            timeLeft: 25 * 60,
            status: 'idle', // 'idle', 'work', 'break'
            totalTimeToday: 0,
            sessionCount: 0
        }
    }
};

/* =======================================================
   💾 상태 영속성 (localStorage Load / Save)
   ======================================================= */

// 로컬스토리지 안전 접근 래퍼.
// Safari 프라이빗 모드/용량 초과(QuotaExceededError)/스토리지 비활성 환경에서
// localStorage 접근 자체가 예외를 던질 수 있으므로, 앱 흐름이 중단되지 않도록 감싼다.
// - 읽기 실패: null 반환(값 없음과 동일 취급)
// - 쓰기 실패: false 반환 + 1회 콘솔 경고(반복 스팸 방지)
export function safeGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

// 저장 실패 경고를 1회만 출력하기 위한 모듈 스코프 플래그(반복 스팸 방지).
let storageWarnEmitted = false;

export function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        if (!storageWarnEmitted) {
            storageWarnEmitted = true;
            console.warn('[Storage] 로컬 저장 실패 — 진행상황이 저장되지 않을 수 있습니다 ' +
                '(용량 초과/프라이빗 모드/스토리지 비활성).', e && e.name);
        }
        // 다른 모듈이 배너/토스트로 안내하고 싶을 때 쓸 수 있는 플래그
        try { state._storageUnavailable = true; } catch (_) {}
        return false;
    }
}

// 로컬스토리지에서 진도 가져오기
export function loadProgress() {
    const memorized = safeGetItem('fc_memorized');
    const weak = safeGetItem('fc_weak');
    const quizzes = safeGetItem('quiz_results');

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
    const pomoDate = safeGetItem('pomo_total_time_date');
    const todayStr = new Date().toISOString().split('T')[0];
    if (pomoDate !== todayStr) {
        state.trainer.pomodoro.totalTimeToday = 0;
        safeSetItem('pomo_total_time', '0');
        safeSetItem('pomo_total_time_date', todayStr);
    } else {
        const totalPomo = safeGetItem('pomo_total_time');
        if (totalPomo) {
            state.trainer.pomodoro.totalTimeToday = parseInt(totalPomo) || 0;
        }
    }
    
    // 뽀모도로 세션 카운트 로드 (오늘 기준)
    const pomoSessionDate = safeGetItem('pomo_session_date');
    if (pomoSessionDate !== todayStr) {
        state.trainer.pomodoro.sessionCount = 0;
        safeSetItem('pomo_session_count', '0');
        safeSetItem('pomo_session_date', todayStr);
    } else {
        const sessionCount = safeGetItem('pomo_session_count');
        if (sessionCount) {
            state.trainer.pomodoro.sessionCount = parseInt(sessionCount) || 0;
        }
    }
}

// 로컬스토리지에 진도 저장
export function saveProgress() {
    safeSetItem('fc_memorized', JSON.stringify([...state.memorizedCards]));
    safeSetItem('fc_weak', JSON.stringify([...state.weakCards]));
    safeSetItem('quiz_results', JSON.stringify(state.quizResults));

    // 대시보드 글로벌 통계 갱신 (app.js에 정의된 전역 함수; 로드 순서상 런타임에 사용 가능)
    if (typeof updateGlobalStats === 'function') {
        updateGlobalStats();
    }
    // 저장 실패 시 사용자 경고 배너 표시 (app.js에서 window.checkStorageWarning으로 노출)
    if (state._storageUnavailable && typeof window !== 'undefined' && typeof window['checkStorageWarning'] === 'function') {
        window['checkStorageWarning']();
    }
}

// 특정 과목 데이터가 동적 로드되었을 때 해당 과목의 고아 ID를 청소하는 함수 (지연 로딩 대응)
export function cleanOrphansForSubject(subjKey, subjData) {
    if (!subjData) return;
    
    const validCardIds = new Set();
    const validQuizIds = new Set();
    
    if (subjData.cards) subjData.cards.forEach(c => validCardIds.add(c.id));
    if (subjData.quizzes) subjData.quizzes.forEach(q => validQuizIds.add(q.id));
    
    // 외운 카드 및 틀린 카드 청소
    const cardsToClean = [...state.memorizedCards].filter(id => id.startsWith(subjKey + '_card_') && !validCardIds.has(id));
    const weakToClean = [...state.weakCards].filter(id => id.startsWith(subjKey + '_card_') && !validCardIds.has(id));
    
    cardsToClean.forEach(id => state.memorizedCards.delete(id));
    weakToClean.forEach(id => state.weakCards.delete(id));
    
    // 퀴즈 결과 청소
    let quizzesCleaned = false;
    Object.keys(state.quizResults).forEach(id => {
        if (id.startsWith(subjKey + '_quiz_') && !validQuizIds.has(id)) {
            delete state.quizResults[id];
            quizzesCleaned = true;
        }
    });
    
    if (cardsToClean.length > 0 || weakToClean.length > 0 || quizzesCleaned) {
        console.debug(`[Orphan Cleanup] Cleaned orphans for ${subjKey}:`, {
            memorized: cardsToClean.length,
            weak: weakToClean.length,
            quizzes: quizzesCleaned
        });
        saveProgress();
    }
}
