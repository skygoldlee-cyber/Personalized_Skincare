// views/exam-sim-state.js — 실전 모의고사 시뮬레이터 상태 (exam-simulator.js에서 추출)
export const simState = {
    examId: '',
    data: null,
    currentIndex: 0,
    userAnswers: {},
    timeLeft: 7200,
    timerInterval: null,
    wrongQuestions: []
};
