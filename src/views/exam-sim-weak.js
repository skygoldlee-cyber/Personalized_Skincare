// src/views/exam-sim-weak.js - 오답 모의고사
// @spec E-04
import { state } from '../state.js';
import { DataLoader } from '../data-loader.js';
import { shuffle } from '../utils.js';
import { WEAK_SIM_PREFIX, parseWeakSimId, resolveCard, cardSubjectOf } from '../weak-items.js';
import { examIdToSubjectId } from '../exam-context.js';
import { proFeatureNotice } from '../pro-upgrade.js';
import { showToast } from '../ui-utils.js';
import { startSimSession, comboToSimQuestion, comboSubjOrder } from './exam-simulator.js';

/* =======================================================
   📋 "틀린 문제만 모아 풀기" 오답 모의고사 (Weakness Exam)
   ======================================================= */
export function startWeakExam() {
    proFeatureNotice('mock_exam', '헷갈린 문제 집중 모의고사');
    const loaderPromises = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key));
    // 복수정답형 모의고사 오답이 있으면 해당 과목의 combo 번들도 함께 로드
    const comboSubsNeeded = new Set();
    (state.weakCards || new Set()).forEach(cardId => {
        const m = cardId.match(new RegExp('^' + WEAK_SIM_PREFIX + '([a-z]+)_combo_'));
        if (m) {
            const order = comboSubjOrder(m[1]);
            if (order) comboSubsNeeded.add(order);
        }
    });
    comboSubsNeeded.forEach(n => loaderPromises.push(DataLoader.loadComboDrills(n)));
    Promise.all(loaderPromises).then(() => {
        _startWeakExamImpl();
    }).catch(err => {
        console.error(err);
        showToast("복습 데이터를 로드하지 못했습니다.", "error");
    });
}

function _startWeakExamImpl() {
    const STUDY_DATA = (typeof window !== 'undefined' && window.STUDY_DATA) ? window.STUDY_DATA : {};
    // 헷갈린 카드나 오답 데이터 로딩
    let weakCards = Array.from(state.weakCards);
    let solvedQuizzes = Object.keys(state.quizResults).filter(id => !state.quizResults[id].correct);
    
    // 필터링 적용 (신규 Feature 3)
    if (state.reviewFilter && state.reviewFilter !== 'all') {
        weakCards = weakCards.filter(cardId => {
            const simId = parseWeakSimId(cardId);
            if (simId) {
                const targetSub = examIdToSubjectId(simId.examId);
                return targetSub === state.reviewFilter;
            } else {
                const cardSubj = cardSubjectOf(cardId);
                return cardSubj === state.reviewFilter;
            }
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
        const filterNames = {};
        const subjects = (window.DATA_REGISTRY && window.DATA_REGISTRY.subjects) || [];
        subjects.forEach((sub, idx) => {
            const shortName = sub.shortName || sub.name;
            filterNames[sub.key] = `${idx + 1}과목 (${shortName})`;
        });
        const filterName = filterNames[state.reviewFilter] || '선택한 과목';
        showToast(`복습할 헷갈린 카드나 오답 퀴즈가 없습니다! (${filterName})\n플래시카드나 기출 퀴즈를 학습하여 약점 데이터를 모아보세요.`, "info", 4000);
        return;
    }
    
    // 모의고사 구조로 질문 조립 (최대 20개 추출)
    const questions = [];
    
    // 1. 헷갈린 카드로부터 질문 생성
    weakCards.forEach(cardId => {
        // 1-a) 일반 플래시카드: 인덱스 캐시로 검색 (weak-items.js)
        const rc = resolveCard(cardId);
        const cardObj = rc && rc.card;
        const subject = rc ? rc.subjectId : '';

        if (cardObj) {
            questions.push({
                id: `weak_card_${cardObj.id}`,
                subject: subject,
                type: 'blank',
                question: `[용어 정의] 다음 설명이 뜻하는 개념은 무엇입니까?\n설명: ${cardObj.definition}`,
                answer: cardObj.term,
                explanation: `정의: ${cardObj.definition}\n용어: ${cardObj.term}`
            });
            return; // forEach 콜백에서 continue 대신
        }

        // 1-b) 모의고사 오답: weak_sim_<examId>_q<num> 형태의 ID
        // STUDY_DATA에 없으므로 window.EXAM_DATA에서 원본 문제를 찾아 복습 문제로 조립
        if (cardId.startsWith(WEAK_SIM_PREFIX)) {
            const origQId = cardId.substring(WEAK_SIM_PREFIX.length);
            const EXAM_DATA = (typeof window !== 'undefined' && window.EXAM_DATA) ? window.EXAM_DATA : {};
            let foundQ = null;
            /** @type {string|null} */
            let foundSubj = '';
            for (const examId of Object.keys(EXAM_DATA)) {
                const qs = EXAM_DATA[examId].questions || [];
                const q = qs.find(qq => qq.id === origQId);
                if (q) {
                    foundQ = q;
                    foundSubj = examIdToSubjectId(examId);
                    break;
                }
            }
            // 복수정답형 오답: COMBO_DRILLS_subjectN 번들에서 검색 (id 형식: <subjKey>_combo_<hash>)
            if (!foundQ) {
                const subjects = (window.DATA_REGISTRY && window.DATA_REGISTRY.subjects) || [];
                for (const s of subjects) {
                    if (foundQ) break;
                    const bundle = (typeof window !== 'undefined') ? window[`COMBO_DRILLS_subject${s.order}`] : null;
                    if (!Array.isArray(bundle)) continue;
                    const q = bundle.find(qq => qq.id === origQId);
                    if (q) {
                        foundQ = comboToSimQuestion(q, s.key);
                        foundSubj = s.key;
                    }
                }
            }
            if (foundQ) {
                questions.push({
                    id: `weak_exam_${origQId}`,
                    subject: foundSubj,
                    type: foundQ.type || 'blank',
                    question: foundQ.question,
                    answer: foundQ.answer,
                    options: foundQ.options || null,
                    // combo 문항은 members·진술 구조를 유지해야 채점(deriveComboJudgments)·리뷰가 동작
                    comboOptions: foundQ.comboOptions || null,
                    statements: foundQ.statements || null,
                    explanation: foundQ.explanation || '모의고사 오답 복습 문제입니다.'
                });
            }
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
    const shuffled = shuffle(questions).slice(0, 20);
    
    // 모의고사 세션 구동
    const mockExam = {
        title: '헷갈린 문제 집중 오답 모의고사 (20제)',
        questions: shuffled
    };
    
    // OMR 및 타이머 제어용 데이터 이식
    state.currentView = 'exam-view';
    const _dashView = document.getElementById('dashboard-view');
    const _revView = document.getElementById('review-view');
    const _examView = document.getElementById('exam-view');
    if (_dashView) _dashView.classList.remove('active');
    if (_revView) _revView.classList.remove('active');
    if (_examView) _examView.classList.add('active');
    
    // OMR Sheet, Timer 활성화
    startSimSession(mockExam);
}

