// tests/dom/study-simulator.dom.test.js — 실전 모의고사 시뮬레이터 시나리오
// 설계: docs/dev/design/DOM_TEST_DESIGN.md §5.2 (Phase 4)
// 검증: 세션 시작→아레나·OMR 렌더(H) · 답안 선택·문항 이동(H) · 제출→채점·
//       오답 카드 등록(P) · 미응답 오답 처리(B) · 임시저장→배너→이어하기(R/P)
//       · 제한시간 만료 자동 제출(B — fake timers)

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { showToast } from '../../src/ui-utils.js';
import {
    loadIndexHtml, el, isVisible, resetStudyState, storedJson,
    stubRegistry, flushAsync,
} from './helpers.js';
import { state } from '../../src/state.js';
import { simState } from '../../src/views/exam-sim-state.js';
import {
    startSimSession, saveSimAnswer, jumpToSimQuestion, renderSimQuestion,
    submitExam, exitSimArena, checkExamDraft, resumeSimDraft, clearSimDraft,
    startWeakExam,
} from '../../src/views/exam-simulator.js';
import { DataLoader } from '../../src/data-loader.js';
import { showSimAnswerReview } from '../../src/views/exam-sim-review.js';
import { setupEventListeners } from '../../src/views/event-listeners.js';
import { STORAGE_KEYS } from '../../src/storage-keys.js';

const EXAM = {
    id: 'simt1',
    title: '테스트 모의고사',
    questions: [
        { id: 'simt1_q1', num: 1, type: 'choice', question: '문제1 질문', options: ['보기1', '보기2', '보기3', '보기4', '보기5'], answer: '②', explanation: '해설1' },
        { id: 'simt1_q2', num: 2, type: 'ox', question: '문제2 진위', options: ['O', 'X'], answer: 'O', explanation: '해설2' },
        { id: 'simt1_q3', num: 3, type: 'short', question: '문제3 단답', answer: '정답3', explanation: '해설3' },
    ],
};

function resetSim() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    simState.examId = '';
    simState.data = null;
    simState.currentIndex = 0;
    simState.userAnswers = {};
    simState.timeLeft = 0;
    simState.timerInterval = null;
    simState.wrongQuestions = [];
}

describe('모의고사 시뮬레이터 — 세션·답안·제출·이어하기', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        resetSim();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (simState.timerInterval) clearInterval(simState.timerInterval);
    });

    it('세션 시작 → 아레나 표시·타이틀·OMR 버블·첫 문항 렌더', () => {
        startSimSession(EXAM);

        expect(isVisible('sim-arena-panel')).toBe(true);
        expect(el('exam-list-panel').classList.contains('is-hidden')).toBe(true);
        expect(el('sim-exam-title').textContent).toBe('테스트 모의고사');
        expect(el('omr-total-count').textContent).toBe('3');
        expect(el('omr-grid').querySelectorAll('.omr-bubble').length).toBe(3);
        expect(el('sim-q-num').textContent).toBe('Q 1 / 3');
        expect(el('sim-q-type').textContent).toBe('객관식 5지선다');
        expect(el('sim-options-container').querySelectorAll('.sim-option-item').length).toBe(5);
        expect(el('sim-time-left').textContent).toMatch(/\d{2}:\d{2}/);
        expect(el('sim-prev-btn').classList.contains('is-hidden')).toBe(true);
    });

    it('선지 클릭 → 답안 저장 + OMR 버블 solved + 진행 카운트', () => {
        startSimSession(EXAM);

        const opts = el('sim-options-container').querySelectorAll('.sim-option-item');
        opts[1].click(); // ② 선택

        expect(simState.userAnswers['simt1_q1']).toBe('②');
        expect(el('omr-b-0').classList.contains('solved')).toBe(true);
        expect(el('omr-solved-count').textContent).toBe('1');
        // 재렌더 후 선택 상태 유지
        expect(el('sim-options-container').querySelectorAll('.sim-option-item')[1].classList.contains('active')).toBe(true);
    });

    it('다음 버튼·OMR 점프 → 문항 이동, 마지막 문항에서 제출 버튼', () => {
        setupEventListeners(() => {}); // sim-next/prev 버튼은 이벤트 리스너 경유
        startSimSession(EXAM);

        el('sim-next-btn').click();
        expect(el('sim-q-num').textContent).toBe('Q 2 / 3');
        expect(el('sim-q-type').textContent).toBe('진위형 OX');
        expect(isVisible('sim-prev-btn')).toBe(true);

        el('omr-b-2').click(); // OMR 버블로 3번 점프
        expect(el('sim-q-num').textContent).toBe('Q 3 / 3');
        expect(el('sim-q-type').textContent).toBe('단답형');
        expect(el('sim-next-btn').classList.contains('is-hidden')).toBe(true);
        expect(isVisible('sim-submit-exam-btn')).toBe(true);
        // 단답형 입력란
        expect(el('sim-text-input')).not.toBeNull();
    });

    it('제출 → 채점·결과 패널·오답 카드 자동 등록·드래프트 제거', () => {
        startSimSession(EXAM);

        // 1번 정답(②), 2번 오답(X), 3번 미응답
        saveSimAnswer('simt1_q1', '②');
        saveSimAnswer('simt1_q2', 'X', false);
        submitExam();

        expect(el('sim-arena-panel').classList.contains('is-hidden')).toBe(true);
        expect(isVisible('sim-result-panel')).toBe(true);
        expect(el('sim-result-score').textContent).toBe('1 / 3 개');
        expect(el('sim-result-rate').textContent).toBe('33%');
        // 오답 2개(2번 오답 + 3번 미응답) → 약점 카드 등록·영속
        expect(state.weakCards.has('weak_sim_simt1_q2')).toBe(true);
        expect(state.weakCards.has('weak_sim_simt1_q3')).toBe(true);
        expect(storedJson(STORAGE_KEYS.FC_WEAK)).toContain('weak_sim_simt1_q2');
        // 제출 시 임시 세션 제거
        expect(storedJson(STORAGE_KEYS.SIM_DRAFT_SESSION)).toBeNull();
    });

    it('결과 리뷰 → 오답 문항 목록·내 답·정답 표시', () => {
        startSimSession(EXAM);
        saveSimAnswer('simt1_q1', '①'); // 오답
        submitExam();
        showSimAnswerReview();

        expect(isVisible('sim-review-panel')).toBe(true);
        const list = el('sim-review-list-container');
        expect(list.querySelectorAll('.sim-review-item').length).toBe(3); // 1번 오답 + 2·3번 미응답
        expect(list.textContent).toContain('(공란)');
        expect(list.textContent).toContain('해설1');
    });

    it('답안 입력 → 임시 세션 저장, 배너→이어하기로 복원', () => {
        startSimSession(EXAM);
        jumpToSimQuestion(1);            // 드래프트는 답안 저장 시점의 인덱스를 기록
        saveSimAnswer('simt1_q2', 'O', false);
        exitSimArena();

        // 임시 세션이 저장되어 배너 표시
        expect(storedJson(STORAGE_KEYS.SIM_DRAFT_SESSION)).not.toBeNull();
        checkExamDraft();
        expect(isVisible('draft-resume-banner')).toBe(true);
        expect(el('draft-banner-title').textContent).toContain('테스트 모의고사');
        expect(el('draft-banner-desc').textContent).toContain('풀이한 문항: 1/3');

        // 이어하기 → 답안·인덱스 복원
        resumeSimDraft();
        expect(simState.userAnswers['simt1_q2']).toBe('O');
        expect(simState.currentIndex).toBe(1);
        expect(isVisible('sim-arena-panel')).toBe(true);
        expect(el('draft-resume-banner').classList.contains('is-hidden')).toBe(true);
    });

    it('드래프트 없음 → 배너 숨김 유지', () => {
        checkExamDraft();
        expect(el('draft-resume-banner').classList.contains('is-hidden')).toBe(true);
    });

    it('제한시간 만료 → 자동 제출 + 결과 패널 (fake timers)', () => {
        vi.useFakeTimers();
        try {
            startSimSession(EXAM);
            saveSimAnswer('simt1_q1', '②', false);
            // 남은 시간 전부 경과
            vi.advanceTimersByTime(simState.timeLeft * 1000 + 1000);

            expect(showToast).toHaveBeenCalledWith(expect.stringContaining('제한 시간이 만료'), 'warning', 4000);
            expect(isVisible('sim-result-panel')).toBe(true);
            expect(el('sim-result-score').textContent).toContain('1 / 3');
        } finally {
            vi.useRealTimers();
        }
    });
});

/* =======================================================
   오답 모의고사 (startWeakExam → _startWeakExamImpl)
   ======================================================= */

// 실제 레지스트리 형태: 과목 키는 알파벳, 시험 키는 subjectN ↔ subject 매핑
const WEAK_REGISTRY = {
    subjects: [
        { key: 'law', name: '화장품법', shortName: '법규', order: 1 },
        { key: 'manufacturing', name: '제조·품질', shortName: '제조', order: 2 },
    ],
    exams: [
        { key: 'subject1', subject: 'law' },
        { key: 'subject2', subject: 'manufacturing' },
    ],
};

function seedWeakRegistry() {
    // stubRegistry: DataLoader.getSubjectList + loadSubject(_loaded 프리셋)
    stubRegistry([
        { key: 'law', name: '화장품법' },
        { key: 'manufacturing', name: '제조·품질' },
    ]);
    // examIdToSubjectId·comboSubjOrder·필터명 조회는 window.DATA_REGISTRY 사용
    window.DATA_REGISTRY = WEAK_REGISTRY;
}

describe('오답 모의고사 — 헷갈린 카드·오답 퀴즈 재조립', () => {
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        resetSim();
        loadIndexHtml();
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (simState.timerInterval) clearInterval(simState.timerInterval);
    });

    it('약점 데이터 없음 → info 토스트, 세션 미시작', async () => {
        seedWeakRegistry();
        startWeakExam();
        await flushAsync();

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('복습할 헷갈린 카드나 오답 퀴즈가 없습니다'), 'info', 4000);
        expect(el('sim-arena-panel').classList.contains('is-hidden')).toBe(true);
    });

    it('모의고사 오답 카드(weak_sim_) → EXAM_DATA에서 원문 조회 후 세션 시작', async () => {
        seedWeakRegistry();
        window.EXAM_DATA = {
            subject1: { questions: [
                { id: 'subject1_q7', type: 'choice', question: '화장품 정의는?', options: ['a', 'b', 'c', 'd', 'e'], answer: '①', explanation: '법 제2조' },
            ] },
        };
        state.weakCards = new Set(['weak_sim_subject1_q7']);

        startWeakExam();
        await flushAsync();

        expect(isVisible('sim-arena-panel')).toBe(true);
        expect(el('sim-exam-title').textContent).toContain('오답 모의고사');
        expect(simState.data.questions.length).toBe(1);
        const q = simState.data.questions[0];
        expect(q.id).toBe('weak_exam_subject1_q7');
        expect(q.subject).toBe('law');               // examId→subject 매핑
        expect(q.type).toBe('choice');
        expect(q.explanation).toBe('법 제2조');
        // 카드형 카드 → blank(단답) 문항
    });

    it('플래시카드·오답 퀴즈 혼합 → STUDY_DATA 기반 문항 조립', async () => {
        seedWeakRegistry();
        window.STUDY_DATA = {
            law: {
                name: '화장품법',
                cards: [{ id: 'law_card_1', term: '화장품', definition: '피부를 청결·미화하는 물품' }],
                quizzes: [],
            },
            manufacturing: {
                name: '제조·품질',
                cards: [],
                quizzes: [{ id: 'mfg_quiz_1', type: 'ox', question: '품질관리기록은 3년 보관이다', options: ['O', 'X'], answer: 'O' }],
            },
        };
        state.weakCards = new Set(['law_card_1']);
        state.quizResults = { mfg_quiz_1: { correct: false }, mfg_quiz_2: { correct: true } };

        startWeakExam();
        await flushAsync();

        const qs = simState.data.questions;
        expect(qs.length).toBe(2); // 정답 맞힌 퀴즈는 제외
        const card = qs.find(q => q.id === 'weak_card_law_card_1');
        const quiz = qs.find(q => q.id === 'weak_quiz_mfg_quiz_1');
        expect(card.type).toBe('blank');
        expect(card.answer).toBe('화장품');
        expect(card.subject).toBe('law');
        expect(quiz.type).toBe('ox');
        expect(quiz.subject).toBe('manufacturing');
    });

    it('복수정답형 오답 카드 → combo 번들 로드·평탄화 후 출제', async () => {
        seedWeakRegistry();
        // comboSubjOrder('law') → order 1 → loadComboDrills(1) → combo_subject1 키 프리셋
        const comboQ = {
            id: 'law_combo_abc',
            citation: '화장품법 제3조',
            stem: '다음 중 옳은 것은?',
            statements: [
                { id: 'ㄱ', sid: 's1', text: '진술ㄱ', truth: true },
                { id: 'ㄴ', sid: 's2', text: '진술ㄴ', truth: false },
            ],
            options: [{ id: 'A', members: ['ㄱ'] }, { id: 'B', members: ['ㄴ'] }],
            answer: 'A',
            explain: '해설',
        };
        DataLoader._loadedDrills['combo_subject1'] = [comboQ];
        window.COMBO_DRILLS_subject1 = [comboQ];
        state.weakCards = new Set(['weak_sim_law_combo_abc']);

        startWeakExam();
        await flushAsync();

        expect(isVisible('sim-arena-panel')).toBe(true);
        const q = simState.data.questions[0];
        expect(q.id).toBe('weak_exam_law_combo_abc');
        expect(q.type).toBe('combo');
        expect(q.subject).toBe('law');
        expect(q.answer).toBe('①');             // options 인덱스 → 지시자 기호
        expect(q.comboOptions).toEqual(comboQ.options); // 원본 members 구조 보존
        expect(q.question).toContain('ㄱ. 진술ㄱ');
    });

    it('과목 필터(reviewFilter) 적용 → 다른 과목 오답 제외', async () => {
        seedWeakRegistry();
        window.EXAM_DATA = {
            subject1: { questions: [
                { id: 'subject1_q1', type: 'choice', question: '법규 문항', options: ['a', 'b'], answer: '①' },
            ] },
            subject2: { questions: [
                { id: 'subject2_q1', type: 'choice', question: '제조 문항', options: ['a', 'b'], answer: '①' },
            ] },
        };
        state.weakCards = new Set(['weak_sim_subject1_q1', 'weak_sim_subject2_q1']);
        state.reviewFilter = 'law';

        startWeakExam();
        await flushAsync();

        expect(simState.data.questions.length).toBe(1);
        expect(simState.data.questions[0].subject).toBe('law');
    });

    it('필터 결과 0건 → 필터명 포함 안내 토스트', async () => {
        seedWeakRegistry();
        state.weakCards = new Set(['weak_sim_subject2_q1']);
        state.reviewFilter = 'law';

        startWeakExam();
        await flushAsync();

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('1과목 (법규)'), 'info', 4000);
        expect(el('sim-arena-panel').classList.contains('is-hidden')).toBe(true);
    });
});
