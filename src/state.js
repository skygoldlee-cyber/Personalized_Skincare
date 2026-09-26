// src/state.js — 전역 상태(State) 및 로컬스토리지 영속성 레이어 모듈 (글로벌 스코프 실행)
//
// v2 리뷰 권고 #1 (거대한 단일 자바스크립트 파일 — 점진적 모듈화) 대응.
// app.js(3,300+ 라인 모놀리스)에서 전역 상태 객체와 그 영속성(로드/저장) 로직을
// 독립 모듈로 분리했습니다. 이 파일은 app.js보다 먼저 로드되어야 하며,
// ES Modules 전환 시 `export`만 추가하면 되도록 부수효과 없는 순수 선언으로 구성했습니다.
//
// 참고: saveProgress()는 대시보드 통계 갱신을 위해 app.js의 updateGlobalStats()를
// 호출합니다. 전역 함수 참조이므로 모듈 분리 후에도 동작은 동일합니다.

import { STORAGE_KEYS } from './storage-keys.js';
import { scopedKey, unscopedKey } from './exam-context.js';
import { WEAK_QUIZ_PREFIX } from './weak-items.js';

/* =======================================================
   📦 전역 학습 상태 객체 (Global Application State)
   ======================================================= */
/** @type {import('./types.js').State} */
export const state = {
    currentView: 'dashboard-view',

    // 로컬스토리지 연동 데이터
    memorizedCards: new Set(), // 외운 카드 ID 목록
    weakCards: new Set(),      // 헷갈린 카드 ID 목록 (weak_sim_/weak_quiz_ 접두사 포함)
    quizResults: {},           // { quizId: { solved: true, correct: true } }
    wrongCauses: {},           // { itemId: { cause: 'memorize'|'concept'|'calc', ts, subjectId } }
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
        solvedList: [],  // 이번 세션에 제출한 답 기록
        diagnostic: false // 진단 평가 모드 (전 과목 샘플링)
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
        oxdrill: {
            subject: null,      // 1~4 (특수 모드는 0)
            mode: '',           // '' | 'weak'(취약·복습) | 'num'(수치·기한)
            data: [],
            currentIndex: 0,
            correctCount: 0,
            solvedList: []
        },
        combo: {
            subject: null,      // 1~4 (특수 모드는 0)
            mode: '',           // '' | 'weak' | 'num'
            data: [],
            currentIndex: 0,
            correctCount: 0,
            solvedList: [],
            judgments: {}       // 진술별 O/X 판정 (2단계 응시)
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
        return localStorage.getItem(scopedKey(key));
    } catch (e) {
        return null;
    }
}

// 저장 실패 경고를 1회만 출력하기 위한 모듈 스코프 플래그(반복 스팸 방지).
let storageWarnEmitted = false;

// 동기화용 쓰기 훅 — sync.js가 setDataWriteHook으로 등록 (순환 import 방지용 콜백 패턴)
let _dataWriteHook = null;
export function setDataWriteHook(fn) { _dataWriteHook = fn; }

export function safeSetItem(key, value) {
    try {
        localStorage.setItem(scopedKey(key), value);
        if (_dataWriteHook) { try { _dataWriteHook(key); } catch (_) {} }
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

export function safeRemoveItem(key) {
    try {
        localStorage.removeItem(scopedKey(key));
    } catch (e) { /* noop */ }
}

/**
 * 현재 시험 네임스페이스에 속한 실제 저장 키 열거 (접두사 필터에 사용).
 * @param {(key: string) => boolean} matchUnscoped - 비접두사 키명을 받는 매처
 * @returns {string[]} 매칭된 실제(접두사 포함) 키 배열
 */
export function listScopedKeys(matchUnscoped) {
    const out = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const raw = localStorage.key(i);
            const unscoped = unscopedKey(raw);
            if (unscoped !== null && matchUnscoped(unscoped)) out.push(raw);
        }
    } catch (e) { /* noop */ }
    return out;
}

// 로컬스토리지에서 진도 가져오기
export function loadProgress() {
    const memorized = safeGetItem(STORAGE_KEYS.FC_MEMORIZED);
    const weak = safeGetItem(STORAGE_KEYS.FC_WEAK);
    const quizzes = safeGetItem(STORAGE_KEYS.QUIZ_RESULTS);

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

    const wrongCauses = safeGetItem(STORAGE_KEYS.QUIZ_WRONG_CAUSES);
    if (wrongCauses) {
        try {
            state.wrongCauses = JSON.parse(wrongCauses);
        } catch (e) { console.error(e); }
    }

    // 뽀모도로 누적 시간은 "오늘" 기준이므로, 날짜가 바뀌었으면 0으로 리셋
    const pomoDate = safeGetItem(STORAGE_KEYS.POMO_TOTAL_TIME_DATE);
    const todayStr = new Date().toISOString().split('T')[0];
    if (pomoDate !== todayStr) {
        state.trainer.pomodoro.totalTimeToday = 0;
        safeSetItem(STORAGE_KEYS.POMO_TOTAL_TIME, '0');
        safeSetItem(STORAGE_KEYS.POMO_TOTAL_TIME_DATE, todayStr);
    } else {
        const totalPomo = safeGetItem(STORAGE_KEYS.POMO_TOTAL_TIME);
        if (totalPomo) {
            state.trainer.pomodoro.totalTimeToday = parseInt(totalPomo) || 0;
        }
    }

    // 뽀모도로 세션 카운트 로드 (오늘 기준)
    const pomoSessionDate = safeGetItem(STORAGE_KEYS.POMO_SESSION_DATE);
    if (pomoSessionDate !== todayStr) {
        state.trainer.pomodoro.sessionCount = 0;
        safeSetItem(STORAGE_KEYS.POMO_SESSION_COUNT, '0');
        safeSetItem(STORAGE_KEYS.POMO_SESSION_DATE, todayStr);
    } else {
        const sessionCount = safeGetItem(STORAGE_KEYS.POMO_SESSION_COUNT);
        if (sessionCount) {
            state.trainer.pomodoro.sessionCount = parseInt(sessionCount) || 0;
        }
    }
}

// 로컬스토리지에 진도 저장
export function saveProgress() {
    const prevMemCount = state._prevMemCount || 0;
    const prevQuizCount = state._prevQuizCount || 0;

    safeSetItem(STORAGE_KEYS.FC_MEMORIZED, JSON.stringify([...state.memorizedCards]));
    safeSetItem(STORAGE_KEYS.FC_WEAK, JSON.stringify([...state.weakCards]));
    safeSetItem(STORAGE_KEYS.QUIZ_RESULTS, JSON.stringify(state.quizResults));
    safeSetItem(STORAGE_KEYS.QUIZ_WRONG_CAUSES, JSON.stringify(state.wrongCauses));

    // 학습 활동 기록 (증분만)
    const memDelta = state.memorizedCards.size - prevMemCount;
    const quizDelta = Object.keys(state.quizResults).length - prevQuizCount;
    if (memDelta > 0 || quizDelta > 0) {
        try {
            // 동적 import로 순환 참조 방지
            import('./study-tracker.js').then(({ recordStudyActivity }) => {
                const correctDelta = quizDelta > 0
                    ? Object.values(state.quizResults).slice(-quizDelta).filter(r => r && r.correct).length
                    : 0;
                recordStudyActivity({ cards: Math.max(0, memDelta), quizzes: Math.max(0, quizDelta), correct: correctDelta });
            }).catch(() => {});
        } catch (e) { /* noop */ }
    }
    state._prevMemCount = state.memorizedCards.size;
    state._prevQuizCount = Object.keys(state.quizResults).length;

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

    // ID 마이그레이션: 콘텐츠 갱신으로 해시가 바뀐 카드/퀴즈의 진도를 신ID로 이관
    // (data/id_migration.js — build_id_migration.js가 스냅샷 비교로 생성)
    const mig = (typeof window !== 'undefined' && window.ID_MIGRATION_MAP) || {};
    let migrated = 0;
    const migrateId = (id, validSet, prefix) => {
        const nid = mig[id];
        return (nid && id.startsWith(prefix) && validSet.has(nid)) ? nid : null;
    };
    for (const set of [state.memorizedCards, state.weakCards]) {
        for (const id of [...set]) {
            const nid = migrateId(id, validCardIds, subjKey + '_card_');
            if (nid && !set.has(nid)) { set.delete(id); set.add(nid); migrated++; }
        }
    }
    Object.keys(state.quizResults).forEach(id => {
        const nid = migrateId(id, validQuizIds, subjKey + '_quiz_');
        if (nid && !(nid in state.quizResults)) {
            state.quizResults[nid] = state.quizResults[id];
            delete state.quizResults[id];
            migrated++;
        }
    });
    if (migrated > 0) {
        console.debug(`[ID Migration] ${subjKey}: ${migrated}건 이관`);
    }

    // 외운 카드 및 틀린 카드 청소
    const cardsToClean = [...state.memorizedCards].filter(id => id.startsWith(subjKey + '_card_') && !validCardIds.has(id));
    const weakToClean = [...state.weakCards].filter(id => id.startsWith(subjKey + '_card_') && !validCardIds.has(id));
    // 기출 퀴즈 오답(weak_quiz_<quizId>)도 해당 퀴즈가 사라졌으면 청소
    const weakQuizToClean = [...state.weakCards].filter(id => {
        if (!id.startsWith(WEAK_QUIZ_PREFIX)) return false;
        const orig = id.substring(WEAK_QUIZ_PREFIX.length);
        return orig.startsWith(subjKey + '_quiz_') && !validQuizIds.has(orig);
    });

    cardsToClean.forEach(id => state.memorizedCards.delete(id));
    weakToClean.forEach(id => state.weakCards.delete(id));
    weakQuizToClean.forEach(id => state.weakCards.delete(id));
    // 청소된 항목의 오답 원인 태그도 함께 정리
    weakQuizToClean.forEach(id => { delete state.wrongCauses[id]; });
    
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

/* =======================================================
   📊 모의고사 성적 이력 로더 (SIM_RESULTS_HISTORY 캐싱)
   charts.js 성적 집계와 recommendations.js 추천이 공용으로 사용 —
   동일 원문이면 JSON.parse를 건너뛰어 대시보드 재렌더 시 중복 파싱 방지
   ======================================================= */
let _simHistoryCacheRaw = null;
let _simHistoryCache = null;

/**
 * 모의고사 성적 이력 로드
 * @returns {Array<{date:string, examId:string, rate:number, subjectRates:Object|null}>}
 */
export function getSimResultsHistory() {
    const raw = safeGetItem(STORAGE_KEYS.SIM_RESULTS_HISTORY);
    if (raw === _simHistoryCacheRaw && _simHistoryCache !== null) return _simHistoryCache;
    _simHistoryCacheRaw = raw;
    try {
        const parsed = raw ? JSON.parse(raw) : [];
        _simHistoryCache = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        _simHistoryCache = [];
    }
    return _simHistoryCache;
}
