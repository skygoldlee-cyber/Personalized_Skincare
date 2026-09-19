// views/exam-simulator.js - 실전 모의고사 시뮬레이터 (Exam Simulator)
import { state, saveProgress, safeGetItem, safeSetItem, safeRemoveItem } from '../state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';
import { checkShortAnswer } from './trainer.js';
// [모바일 PWA 견고성] 레지스트리는 window 전역(가드)에서 읽는다(정적 import 하드 의존 지양).
import { DataLoader } from '../data-loader.js';
import { showGlobalLoading, hideGlobalLoading, showToast, vibrate, HAPTIC } from '../ui-utils.js';
import { shuffle } from '../utils.js';
import { STORAGE_KEYS } from '../storage-keys.js';
import { TIMING } from '../config/timing.js';
import { simState } from './exam-sim-state.js';
import { recordStatementJudgments } from '../statement-tracker.js';

// --- 5. 실전 모의고사 시뮬레이터 구현 ---
export { simState };

export function startSimSession(examData) {
    // 시뮬레이터 상태 초기화
    simState.examId = examData.id || 'dynamic';
    simState.data = examData;
    simState.currentIndex = 0;
    simState.userAnswers = {};
    // 문항당 1분 기산, 실전 형식(통합 모의고사)은 명시된 제한시간 우선 (실제 시험: 100문/120분)
    simState.timeLeft = examData.timeLimitSec || examData.questions.length * TIMING.EXAM_TIME_PER_QUESTION_SEC;
    simState.wrongQuestions = [];

    // UI 전환
    const examListPanel = document.getElementById('exam-list-panel');
    const simResultPanel = document.getElementById('sim-result-panel');
    const simReviewPanel = document.getElementById('sim-review-panel');
    const simArenaPanel = document.getElementById('sim-arena-panel');
    if (examListPanel) examListPanel.classList.add('is-hidden');
    if (simResultPanel) simResultPanel.classList.add('is-hidden');
    if (simReviewPanel) simReviewPanel.classList.add('is-hidden');
    if (simArenaPanel) simArenaPanel.classList.remove('is-hidden');

    // 타이머 및 OMR 렌더링
    const simExamTitle = document.getElementById('sim-exam-title');
    if (simExamTitle) simExamTitle.textContent = examData.title;
    renderOMRSheet();
    renderSimQuestion();

    // 기존 타이머 중지 후 신규 시작
    startSimTimer();
}

export function startMockExamSim(examId) {
    showGlobalLoading('모의고사 데이터를 불러오는 중입니다...');
    DataLoader.loadExam(examId).then((examData) => {
        hideGlobalLoading();
        startSimSession(examData);
    }).catch(err => {
        hideGlobalLoading();
        console.error(err);
        showToast("모의고사 데이터를 로드하지 못했습니다.", "error");
    });
}

/* =======================================================
   ㄱㄴㄷ 합답형 모의고사 — combo 드릴 번들을 시뮬레이터 형식으로 변환
   ======================================================= */
const SIM_OPTION_INDICATORS = ['①', '②', '③', '④', '⑤'];

/**
 * combo 문항 → 시뮬레이터 문항 평탄화
 * (citation·진술 목록을 question 본문에 편입해 아레나·리뷰 양쪽에서 표시,
 *  options.members를 문자열 배열로, 정답을 지시자 기호로 변환)
 */
function comboToSimQuestion(q, subjKey) {
    const stmtLines = (q.statements || []).map(s => `${s.id}. ${s.text}`);
    const ansIdx = (q.options || []).findIndex(o => o.id === q.answer);
    return {
        ...q,
        subject: subjKey,
        type: 'combo',
        question: [q.citation, q.stem, stmtLines.join('\n')].filter(Boolean).join('\n\n'),
        comboOptions: q.options || [], // 원본 members 구조 보존 — 채점 시 진술 판정 도출·리뷰 정오표용
        options: (q.options || []).map(o => (o.members || []).join(', ')),
        answer: SIM_OPTION_INDICATORS[ansIdx] || q.answer,
        explanation: q.explain || ''
    };
}

/**
 * 시뮬 합답형 응답 → 진술별 판정 도출 (선택 선지의 members = "참으로 판정한 집합")
 * @returns {Array<{sid, judgedCorrect, text, truth, conceptId}>|null}
 */
function deriveComboJudgments(q, userAns) {
    if (!userAns || !Array.isArray(q.statements) || !Array.isArray(q.comboOptions)) return null;
    const idx = SIM_OPTION_INDICATORS.indexOf(userAns);
    const opt = idx >= 0 ? q.comboOptions[idx] : null;
    if (!opt) return null;
    const chosen = new Set(opt.members || []);
    return q.statements.map(s => ({
        sid: s.sid,
        judgedCorrect: chosen.has(s.id) === !!s.truth,
        text: s.text,
        truth: s.truth,
        conceptId: s.conceptId
    }));
}

// 합답형 번들 과목 번호 조회 (combo 오답 복습 시 과목 번들 로드용) — registry.subjects의 order 기반
function comboSubjOrder(subjKey) {
    const subjects = (window.DATA_REGISTRY && window.DATA_REGISTRY.subjects) || [];
    const s = subjects.find(x => x.key === subjKey);
    return s ? s.order : null;
}

/**
 * 과목별 합답형 모의고사 시작 — data/drills/combo_subjectN.js 로드
 * @param {string} arg 'N' 또는 'N:count' (count = 출제 수, 생략 시 전체)
 */
export function startComboMockExam(arg) {
    const [numStr, countStr] = String(arg).split(':');
    const num = parseInt(numStr, 10);
    const orders = DataLoader.getSubjectOrders();
    if (isNaN(num) || !orders.includes(num)) return;
    const want = countStr ? parseInt(countStr, 10) : NaN;
    showGlobalLoading('합답형 모의고사 데이터를 불러오는 중입니다...');
    DataLoader.loadComboDrills(num).then(questions => {
        hideGlobalLoading();
        const subjects = (window.DATA_REGISTRY && window.DATA_REGISTRY.subjects) || [];
        const subjMeta = subjects.find(s => s.order === num);
        const subjKey = subjMeta ? subjMeta.key : `subject${num}`;
        const subjName = subjMeta ? (subjMeta.shortName || subjMeta.name) : `${num}과목`;
        const picked = (!isNaN(want) && want > 0 && want < questions.length)
            ? shuffle(questions).slice(0, want)
            : questions;
        const simQuestions = picked.map(q => comboToSimQuestion(q, subjKey));
        if (simQuestions.length === 0) {
            showToast('이 과목의 합답형 문항이 없습니다.', 'warning');
            return;
        }
        startSimSession({
            id: `combo_subject${num}`,
            title: `${subjName} 합답형 모의고사 (${simQuestions.length}제)`,
            questions: simQuestions
        });
    }).catch(err => {
        hideGlobalLoading();
        console.error(err);
        showToast('합답형 데이터를 불러오지 못했습니다.', 'error');
    });
}

export function startIntegratedMockExam() {
    // 합답형 혼합 옵션 체크 시 combo 번들도 함께 로드
    const mixCombo = !!(document.getElementById('integrated-mix-combo') && document.getElementById('integrated-mix-combo').checked);
    showGlobalLoading('통합 모의고사 데이터를 불러오는 중입니다...');
    const loaderPromises = DataLoader.registry.exams.map(e => DataLoader.loadExam(e.key));
    if (mixCombo) DataLoader.getSubjectOrders().forEach(n => loaderPromises.push(DataLoader.loadComboDrills(n)));
    Promise.all(loaderPromises).then(() => {
        hideGlobalLoading();
        _startIntegratedMockExamImpl(mixCombo);
    }).catch(err => {
        hideGlobalLoading();
        console.error(err);
        showToast("모의고사 데이터를 로드하지 못했습니다.", "error");
    });
}

function _startIntegratedMockExamImpl(mixCombo = false) {
    // 과목별 문제들 동적 수집 (registry 기반 — 과목 키별 자동 분류)
    const registry = (typeof window !== 'undefined' && window.DATA_REGISTRY) ? window.DATA_REGISTRY : null;
    const integratedConfig = registry && registry.integratedExam ? registry.integratedExam.questionsPerSubject : null;
    const subjects = registry && registry.subjects ? registry.subjects : [];

    // 과목별 문제 버킷 (동적 생성)
    const subjectQuestions = {};
    const subjectCounts = {};
    for (const subj of subjects) {
        subjectQuestions[subj.key] = [];
        subjectCounts[subj.key] = integratedConfig ? (integratedConfig[subj.key] || 0) : 0;
    }

    const EXAM_DATA = (typeof window !== 'undefined' && window.EXAM_DATA) ? window.EXAM_DATA : {};

    // registry.exams에서 examId → subject 매핑 구축
    const examToSubject = {};
    if (registry && registry.exams) {
        for (const exam of registry.exams) {
            examToSubject[exam.key] = exam.subject;
        }
    }

    Object.keys(EXAM_DATA).forEach(examId => {
        const questions = EXAM_DATA[examId].questions || [];
        // registry 매핑 우선, 없으면 접두사 폴백 (subject1 → law 등)
        let subjKey = examToSubject[examId];
        if (!subjKey) {
            // 폴백: examId 접두사 → registry.subjects 순서 기반 매칭
            const prefixMatch = examId.match(/^(subject\d+)/);
            if (prefixMatch) {
                const idx = parseInt(prefixMatch[1].replace('subject', '')) - 1;
                if (subjects[idx]) subjKey = subjects[idx].key;
            }
        }
        if (subjKey && subjectQuestions[subjKey]) {
            subjectQuestions[subjKey].push(...questions);
        }
    });

    // 모든 과목에 문제가 있는지 확인
    const missingSubjects = subjects.filter(s => subjectQuestions[s.key].length === 0);
    if (missingSubjects.length > 0) {
        showToast("모의고사 데이터가 불완전합니다. 모든 과목의 모의고사가 정상 로드되었는지 확인하세요.", "error");
        return;
    }

    // 과목별 무작위 선택 함수
    const getRandomSample = (arr, count, subjectId) => {
        const shuffled = shuffle(arr);
        return shuffled.slice(0, count).map(q => ({
            ...q,
            subject: subjectId // 과목 정보 태깅
        }));
    };

    // 합답형 혼합: 과목별 배정의 약 20%를 combo 문항으로 교체 (선지 다양화, 실전 패턴 훈련)
    const comboPoolBySubject = {};
    if (mixCombo) {
        subjects.forEach((subj, idx) => {
            const bundle = (typeof window !== 'undefined') ? window[`COMBO_DRILLS_subject${idx + 1}`] : null;
            if (Array.isArray(bundle)) comboPoolBySubject[subj.key] = bundle;
        });
    }

    // 과목별 샘플링 (registry에서 동적 조회)
    const selectedBySubject = {};
    for (const subj of subjects) {
        const count = subjectCounts[subj.key];
        if (count > 0) {
            const pool = comboPoolBySubject[subj.key] || [];
            const comboCount = Math.min(Math.round(count * 0.2), pool.length);
            const picked = getRandomSample(subjectQuestions[subj.key], count - comboCount, subj.key);
            if (comboCount > 0) {
                shuffle(pool).slice(0, comboCount).forEach(q =>
                    picked.push(comboToSimQuestion(q, subj.key)));
            }
            selectedBySubject[subj.key] = shuffle(picked);
        }
    }
    const allSelected = subjects.flatMap(s => selectedBySubject[s.key] || []);

    // 문항 결합
    const combinedQuestions = allSelected;

    // 문항 번호를 1부터 순차적으로 재지정
    combinedQuestions.forEach((q, index) => {
        q.num = index + 1;
        q.id = `integrated_q${index + 1}`;
    });

    const totalQuestions = combinedQuestions.length;
    const subjectCount = subjects.length;
    const integratedExam = {
        id: 'integrated',
        title: subjects.length > 0
            ? `1~${subjectCount}과목 통합 실전 모의고사 (${totalQuestions}제)`
            : `통합 실전 모의고사 (${totalQuestions}제)`,
        questions: combinedQuestions,
        // 실제 시험 시간: manifest integratedExam.examTimeMin (100문/120분)
        timeLimitSec: ((registry && registry.integratedExam && registry.integratedExam.examTimeMin) || 120) * 60
    };

    // UI 전환
    state.currentView = 'exam-view';
    const dashboardView = document.getElementById('dashboard-view');
    const reviewView = document.getElementById('review-view');
    const examView = document.getElementById('exam-view');
    if (dashboardView) dashboardView.classList.remove('active');
    if (reviewView) reviewView.classList.remove('active');
    if (examView) examView.classList.add('active');

    // OMR Sheet, Timer 활성화
    startSimSession(integratedExam);
}

export function saveSimDraft() {
    if (!simState.data || !simState.data.questions) return;
    const draft = {
        examId: simState.examId,
        examTitle: simState.data.title,
        timeLeft: simState.timeLeft,
        userAnswers: simState.userAnswers,
        currentIndex: simState.currentIndex,
        questions: simState.data.questions
    };
    safeSetItem(STORAGE_KEYS.SIM_DRAFT_SESSION, JSON.stringify(draft));
}

export function clearSimDraft() {
    safeRemoveItem(STORAGE_KEYS.SIM_DRAFT_SESSION);
    const banner = document.getElementById('draft-resume-banner');
    if (banner) banner.classList.add('is-hidden');
}

export function checkExamDraft() {
    const banner = document.getElementById('draft-resume-banner');
    if (!banner) return;
    
    const saved = safeGetItem(STORAGE_KEYS.SIM_DRAFT_SESSION);
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            const minutes = Math.floor(draft.timeLeft / 60);
            const seconds = draft.timeLeft % 60;
            
            const titleEl = document.getElementById('draft-banner-title');
            const descEl = document.getElementById('draft-banner-desc');
            
            if (titleEl) titleEl.textContent = `📝 진행 중인 모의고사: ${draft.examTitle}`;
            if (descEl) descEl.textContent = `이전 진행 상태 복구 가능 (남은 시간: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}, 풀이한 문항: ${Object.keys(draft.userAnswers).length}/${draft.questions.length})`;
            
            banner.classList.remove('is-hidden');
        } catch(e) {
            banner.classList.add('is-hidden');
        }
    } else {
        banner.classList.add('is-hidden');
    }
}

export function resumeSimDraft() {
    const saved = safeGetItem(STORAGE_KEYS.SIM_DRAFT_SESSION);
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
        
        const _examListPanel = document.getElementById('exam-list-panel');
        const _simResultPanel = document.getElementById('sim-result-panel');
        const _simReviewPanel = document.getElementById('sim-review-panel');
        const _simArenaPanel = document.getElementById('sim-arena-panel');
        if (_examListPanel) _examListPanel.classList.add('is-hidden');
        if (_simResultPanel) _simResultPanel.classList.add('is-hidden');
        if (_simReviewPanel) _simReviewPanel.classList.add('is-hidden');
        if (_simArenaPanel) _simArenaPanel.classList.remove('is-hidden');

        const _simExamTitle = document.getElementById('sim-exam-title');
        if (_simExamTitle) _simExamTitle.textContent = draft.examTitle;
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
        if (banner) banner.classList.add('is-hidden');
        
    } catch(e) {
        console.error("Failed to resume draft: ", e);
        showToast("저장된 모의고사 세션을 불러오지 못했습니다.", "error");
    }
}

export function exitSimArena() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    
    // UI 전환
    const _arena = document.getElementById('sim-arena-panel');
    const _result = document.getElementById('sim-result-panel');
    const _review = document.getElementById('sim-review-panel');
    const _list = document.getElementById('exam-list-panel');
    if (_arena) _arena.classList.add('is-hidden');
    if (_result) _result.classList.add('is-hidden');
    if (_review) _review.classList.add('is-hidden');
    if (_list) _list.classList.remove('is-hidden');
    
    // 대시보드 갱신하여 배너 확인
    checkExamDraft();
}

/* =======================================================
    ⏱️ 시험 타이머 (백그라운드 탭 스로틀링 방지)
    * 단순 setInterval 초 차감 대신, 시작 시각의 절대 타임스탬프 차이(Date.now())
    * 기반으로 남은 시간을 계산하여, 백그라운드 탭 전환 시에도 실제 경과 시간이
    * 정확히 반영되도록 합니다. (뽀모도로 타이머와 동일한 방식)
    ======================================================= */
export function startSimTimer() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    // 현재 남은 시간을 기준으로 종료 시각을 고정
    simState.endTime = Date.now() + (simState.timeLeft * 1000);
    simState.timerInterval = setInterval(tickSimTimer, TIMING.EXAM_TIMER_TICK_MS); // 500ms 간격 갱신
    tickSimTimer();
}

export function tickSimTimer() {
    // 절대 시각 기반 남은 시간 계산 (백그라운드 스로틀링 극복 핵심)
    const remaining = Math.max(0, Math.round((simState.endTime - Date.now()) / 1000));
    simState.timeLeft = remaining;
    
    if (simState.timeLeft <= 0) {
        clearInterval(simState.timerInterval);
        const timeEl = document.getElementById('sim-time-left');
        if (timeEl) timeEl.textContent = '00:00';
        showToast("제한 시간이 만료되었습니다. 답안지가 자동 제출됩니다.", "warning", 4000);
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

export function renderOMRSheet() {
    const omrGrid = document.getElementById('omr-grid');
    omrGrid.innerHTML = '';
    
    const total = simState.data.questions.length;
    document.getElementById('omr-total-count').textContent = total;
    
    for (let i = 0; i < total; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'omr-bubble';
        bubble.id = `omr-b-${i}`;
        bubble.textContent = i + 1;
        bubble.setAttribute('role', 'button');
        bubble.setAttribute('tabindex', '0');
        bubble.setAttribute('aria-label', `문제 ${i + 1}번으로 이동`);
        bubble.addEventListener('click', () => {
            jumpToSimQuestion(i);
        });
        bubble.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                jumpToSimQuestion(i);
            }
        });
        omrGrid.appendChild(bubble);
    }
    updateOMRProgress();
}

export function updateOMRProgress() {
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

export function jumpToSimQuestion(index) {
    simState.currentIndex = index;
    renderSimQuestion();
}

export function renderSimQuestion() {
    const q = simState.data.questions[simState.currentIndex];
    if (!q) return;
    
    // 문제 정보 주입
    const qNumEl = document.getElementById('sim-q-num');
    if (qNumEl) qNumEl.textContent = `Q ${simState.currentIndex + 1} / ${simState.data.questions.length}`;
    
    let typeName = '단답형';
    if (q.type === 'choice') typeName = '객관식 5지선다';
    else if (q.type === 'ox') typeName = '진위형 OX';
    else if (q.type === 'combo') typeName = '합답형 ㄱㄴㄷ';
    const qTypeEl = document.getElementById('sim-q-type');
    if (qTypeEl) qTypeEl.textContent = typeName;
    
    // 개행 문자를 BR 태그로 치환해 질문 가독성 보장
    const qTextEl = document.getElementById('sim-q-text');
    if (qTextEl) qTextEl.innerHTML = safeTextWithBreaks(q.question);
    
    // 옵션 컨테이너 채우기
    const container = document.getElementById('sim-options-container');
    container.innerHTML = '';
    
    const savedAns = simState.userAnswers[q.id] || '';
    
    if (q.type === 'choice' || q.type === 'combo') {
        const optionIndicators = ['①', '②', '③', '④', '⑤'];
        q.options.forEach((optText, idx) => {
            const ind = optionIndicators[idx] || String(idx + 1);
            const isSelected = (savedAns === ind);
            
            const btn = document.createElement('div');
            btn.className = `sim-option-item ${isSelected ? 'active' : ''}`;
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('aria-label', `선택지 ${idx + 1}: ${optText}`);
            btn.innerHTML = `<span class="opt-num">${esc(ind)}</span> <span class="opt-text">${esc(optText)}</span>`;
            btn.addEventListener('click', () => {
                saveSimAnswer(q.id, ind);
            });
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    saveSimAnswer(q.id, ind);
                }
            });
            container.appendChild(btn);
        });
    } else if (q.type === 'ox') {
        q.options.forEach(optVal => {
            const isSelected = (savedAns === optVal);
            const btn = document.createElement('div');
            btn.className = `sim-option-item ${isSelected ? 'active' : ''}`;
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('aria-label', `선택지 ${optVal}`);
            btn.innerHTML = `<span class="opt-num"><i class="fa-solid ${optVal === 'O' ? 'fa-circle' : 'fa-xmark'}"></i></span> <span class="opt-text">${optVal} 퀴즈</span>`;
            btn.addEventListener('click', () => {
                saveSimAnswer(q.id, optVal);
            });
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    saveSimAnswer(q.id, optVal);
                }
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
        prevBtn.classList.add('is-hidden');
    } else {
        prevBtn.classList.remove('is-hidden');
    }
    
    if (simState.currentIndex === simState.data.questions.length - 1) {
        nextBtn.classList.add('is-hidden');
        submitBtn.classList.remove('is-hidden');
    } else {
        nextBtn.classList.remove('is-hidden');
        submitBtn.classList.add('is-hidden');
    }
    
    updateOMRProgress();
}

export function saveSimAnswer(qId, value, triggerRender = true) {
    simState.userAnswers[qId] = value;
    if (triggerRender) {
        renderSimQuestion();
    } else {
        updateOMRProgress();
    }
    saveSimDraft();
}

/**
 * 문항의 교재 단원(챕터) 해석 — QUESTION_CHAPTERS(문항id→단원) 우선,
 * combo는 "출처: 과목N 문제은행 Qn"으로 원문항을 거슬러 매핑, 실패 시 citation L번호→라인 경계
 */
function _chapterForQuestion(q, subjKey, qc) {
    if (q.type === 'combo') {
        const src = (q.citation || '').match(/출처:\s*과목(\d+) 문제은행 Q(\d+)/);
        if (src) {
            const srcKey = DataLoader._examKeyForOrder(parseInt(src[1], 10));
            const title = qc.questions[`${srcKey}_q${src[2]}`];
            if (title) return title;
        }
        const m = (q.citation || '').match(/L(\d+)/);
        const ranges = qc.ranges[subjKey];
        if (!m || !ranges) return null;
        const line = parseInt(m[1], 10);
        let cur = null;
        for (const [ln, t] of ranges) { if (line >= ln) cur = t; else break; }
        return cur;
    }
    return qc.questions[q.id] || null;
}

export function submitExam() {
    if (simState.timerInterval) clearInterval(simState.timerInterval);
    
    // 점수 채점 및 틀린 문항 수집
    let score = 0;
    const total = simState.data.questions.length;
    simState.wrongQuestions = [];
    
    // 과목별 정답 및 총 문제수 집계용 (레지스트리 기반 동적 초기화)
    const subjectScores = {};
    const subjects = (window.DATA_REGISTRY && window.DATA_REGISTRY.subjects) || [];
    subjects.forEach(sub => {
        subjectScores[sub.key] = { score: 0, total: 0 };
    });
    
    // 단원(챕터)별 집계용 — question_chapters.js 인덱스 (미로드 시 빈 객체)
    const qc = (DataLoader._questionChapters) || {
        questions: window.QUESTION_CHAPTERS || {},
        ranges: window.CHAPTER_RANGES || {}
    };
    const chapterStats = {};
    
    for (let i = 0; i < total; i++) {
        const q = simState.data.questions[i];
        const userAns = simState.userAnswers[q.id] || '';
        
        // 객관식/OX는 선택지 기호(①~⑤, O/X)를 직접 비교, 단답형만 텍스트 정규화 채점
        const isCorrect = (q.type === 'choice' || q.type === 'ox' || q.type === 'combo')
            ? (userAns === q.answer)
            : checkShortAnswer(userAns, q.answer);
        vibrate(isCorrect ? HAPTIC.correct : HAPTIC.wrong);

        // 합답형: 선택 선지의 members로 진술별 판정을 도출해 취약 추적·SM-2에 기록
        if (q.type === 'combo') {
            const perStatement = deriveComboJudgments(q, userAns);
            if (perStatement) recordStatementJudgments(perStatement);
        }
        
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
        
        // 과목 판별 및 집계 (동적 변환 적용)
        let subj = q.subject;
        if (!subj) {
            const prefix = q.id.split('_')[0]; // 'subject1' 등
            subj = examIdToSubjectId(prefix);
        } else if (subj.startsWith('subject')) {
            subj = examIdToSubjectId(subj);
        }
        
        if (subj && subjectScores[subj]) {
            subjectScores[subj].total++;
            if (isCorrect) {
                subjectScores[subj].score++;
            }
            // 단원별 집계 — 교재 인용이 없는 문항은 '기타(참조자료)'로 묶음
            const chTitle = _chapterForQuestion(q, subj, qc) || '기타 (법령·참조자료)';
            const cBucket = chapterStats[subj] || (chapterStats[subj] = {});
            const c = cBucket[chTitle] || (cBucket[chTitle] = { score: 0, total: 0 });
            c.total++;
            if (isCorrect) c.score++;
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
    if (typeof window !== 'undefined' && typeof window.saveExamResultToHistory === 'function') {
        window.saveExamResultToHistory(simState.data.id, score, total, hasSubjectData ? subjectRates : null);
    }
    
    // 결과 패널 세팅
    const _arenaPanel = document.getElementById('sim-arena-panel');
    const _resultPanel = document.getElementById('sim-result-panel');
    if (_arenaPanel) _arenaPanel.classList.add('is-hidden');
    if (_resultPanel) _resultPanel.classList.remove('is-hidden');
    
    const _scoreEl = document.getElementById('sim-result-score');
    if (_scoreEl) _scoreEl.textContent = `${score} / ${total} 개`;
    const rate = Math.round((score / total) * 100);
    const _rateEl = document.getElementById('sim-result-rate');
    if (_rateEl) _rateEl.textContent = `${rate}%`;

    // 과목별 상세 보고서 생성 (신규 Feature 2)
    const breakdownContainer = document.getElementById('sim-result-breakdown');
    if (breakdownContainer) {
        breakdownContainer.innerHTML = '';
        
        let breakdownHTML = `<h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--color-on-brand); font-size: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;"><i class="fa-solid fa-chart-pie color-primary" style="color: var(--color-primary);"></i> 과목별 성적 상세 분석</h4>`;
        breakdownHTML += `<div style="display: flex; flex-direction: column; gap: 0.75rem;">`;
        
        const subjNames = {};
        subjects.forEach((sub, idx) => {
            subjNames[sub.key] = `${idx + 1}과목: ${sub.name}`;
        });
        
        let failedSubjects = [];
        
        Object.keys(subjectScores).forEach(subj => {
            const data = subjectScores[subj];
            if (data.total > 0) {
                const subRate = Math.round((data.score / data.total) * 100);
                const isFail = subRate < 40;
                if (isFail) {
                    failedSubjects.push({ id: subj, name: subjNames[subj], rate: subRate });
                }
                
                const progressColor = isFail ? 'var(--color-danger)' : (subRate >= 60 ? 'var(--color-success)' : 'var(--color-warning)');
                const hasWrongs = data.score < data.total;
                
                breakdownHTML += `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; margin-bottom: 0.25rem;">
                            <span style="font-weight: 600; color: var(--color-text-muted);">${esc(subjNames[subj])}</span>
                            <span style="color: ${progressColor}; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
                                ${data.score} / ${data.total} (${subRate}%)
                                ${isFail ? ' <span style="background:var(--color-danger); color:var(--color-on-brand); font-size:0.7rem; padding:1px 4px; border-radius:3px;">과락</span>' : ''}
                                ${hasWrongs ? `<button class="btn" data-click="startFocusSubjectStudy" data-arg="${subj}" title="이 과목 집중 퀴즈" style="padding: 1px 7px; font-size: 0.72rem; border: 1px solid ${progressColor}; color: ${progressColor}; background: transparent; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-bolt"></i> 복습</button>` : ''}
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
        
        // 단원별 취약 분석 — 오답이 있는 단원을 정답률 낮은 순으로 표시
        const chapterRows = [];
        Object.keys(chapterStats).forEach(subj => {
            Object.keys(chapterStats[subj]).forEach(title => {
                const c = chapterStats[subj][title];
                if (c.score >= c.total) return; // 전부 정답인 단원은 생략
                chapterRows.push({
                    subj,
                    label: `${subjNames[subj] ? subjNames[subj].split(':')[0] : subj} · ${title}`,
                    score: c.score,
                    total: c.total,
                    rate: Math.round((c.score / c.total) * 100)
                });
            });
        });
        chapterRows.sort((a, b) => (a.rate - b.rate) || (b.total - a.total));
        
        if (chapterRows.length) {
            breakdownHTML += `<h5 style="margin: 1.25rem 0 0.75rem 0; color: var(--color-on-brand); font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.9rem;"><i class="fa-solid fa-layer-group" style="color: var(--color-warning);"></i> 단원별 취약 분석 <span style="font-weight: 400; font-size: 0.75rem; color: var(--color-text-muted);">(오답 포함 단원, 정답률 낮은 순)</span></h5>`;
            breakdownHTML += `<div style="display: flex; flex-direction: column; gap: 0.5rem;">`;
            chapterRows.slice(0, 10).forEach(r => {
                const rColor = r.rate < 40 ? 'var(--color-danger)' : (r.rate >= 80 ? 'var(--color-success)' : 'var(--color-warning)');
                breakdownHTML += `
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 0.15rem;">
                            <span style="color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(r.label)}</span>
                            <span style="color: ${rColor}; font-weight: 700; flex-shrink: 0; margin-left: 0.5rem;">${r.score} / ${r.total} (${r.rate}%)</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); height: 4px; border-radius: 2px; overflow: hidden; width: 100%;">
                            <div style="background: ${rColor}; width: ${r.rate}%; height: 100%;"></div>
                        </div>
                    </div>
                `;
            });
            if (chapterRows.length > 10) {
                breakdownHTML += `<p style="margin: 0.25rem 0 0; font-size: 0.72rem; color: var(--color-text-muted);">… 외 ${chapterRows.length - 10}개 단원</p>`;
            }
            breakdownHTML += `</div>`;
        }
        
        // 과락 분석 및 추천 피드백
        if (failedSubjects.length > 0) {
            breakdownHTML += `
                <div style="margin-top: 1.25rem; padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px;">
                    <h5 style="margin: 0 0 0.5rem 0; color: var(--color-danger); font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> 과락 주의 경고!</h5>
                    <p style="margin: 0; font-size: 0.8rem; color: var(--color-danger-tint, #fca5a5); line-height: 1.5;">
                        실제 시험 기준 한 과목이라도 40점 미만(100점 환산) 득점 시 전체 평균이 60점을 넘어도 불합격 처리됩니다. 아래 추천 학습으로 약점을 빠르게 보완해 보세요.
                    </p>
                    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            `;
            
            failedSubjects.forEach(f => {
                const subKey = f.id;
                breakdownHTML += `
                    <button class="btn" data-click="startFocusSubjectStudy" data-arg="${subKey}" style="padding: 3px 8px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.2); border: 1px solid var(--color-danger); color: var(--color-danger-tint, #fca5a5); cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem;">
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
                        <h5 style="margin: 0 0 0.25rem 0; color: var(--color-success); font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-circle-check"></i> 합격 예측: 합격 안정권</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--color-success-tint, #a7f3d0); line-height: 1.5;">
                            전체 정답률 60% 이상 및 모든 과목 과락 패스 요건을 완벽히 충족하셨습니다! 이 컨디션을 실제 시험장까지 유지해 보세요.
                        </p>
                    </div>
                `;
            } else {
                breakdownHTML += `
                    <div style="margin-top: 1.25rem; padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 6px;">
                        <h5 style="margin: 0 0 0.25rem 0; color: var(--color-warning); font-size: 0.9rem; font-weight: bold;"><i class="fa-solid fa-circle-exclamation"></i> 합격 예측: 전체 평균 미달</h5>
                        <p style="margin: 0; font-size: 0.8rem; color: var(--color-warning-tint, #fde68a); line-height: 1.5;">
                            과락은 면했으나 합격 커트라인인 전체 평균 60%에 도달하지 못했습니다. 오답 해설 풀이를 통해 부족한 이론을 보완해 보세요.
                        </p>
                    </div>
                `;
            }
        }
        
        breakdownContainer.innerHTML = breakdownHTML;
        breakdownContainer.classList.remove('is-hidden');
    }
}

export function examIdToSubjectId(examId) {
    const registry = window.DATA_REGISTRY;
    if (registry && registry.exams) {
        const exam = registry.exams.find(e => e.key === examId);
        if (exam) return exam.subject;
        // prefix 매칭 호환성 (예: subject2_p1 또는 subject2)
        const partialExam = registry.exams.find(e => examId.startsWith(e.key) || e.key.startsWith(examId));
        if (partialExam) return partialExam.subject;
    }
    if (registry && registry.subjects && registry.subjects.length > 0) {
        return registry.subjects[0].key;
    }
    return null;
}

/* =======================================================
   📋 "틀린 문제만 모아 풀기" 오답 모의고사 (Weakness Exam)
   ======================================================= */
export function startWeakExam() {
    const loaderPromises = DataLoader.getSubjectList().map(s => DataLoader.loadSubject(s.key));
    // 합답형 모의고사 오답이 있으면 해당 과목의 combo 번들도 함께 로드
    const comboSubsNeeded = new Set();
    (state.weakCards || new Set()).forEach(cardId => {
        const m = cardId.match(/^weak_sim_([a-z]+)_combo_/);
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
        // 1-a) 일반 플래시카드: STUDY_DATA에서 카드 검색
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
                question: `[용어 정의] 다음 설명이 뜻하는 개념은 무엇입니까?\n설명: ${cardObj.definition}`,
                answer: cardObj.term,
                explanation: `정의: ${cardObj.definition}\n용어: ${cardObj.term}`
            });
            return; // forEach 콜백에서 continue 대신
        }

        // 1-b) 모의고사 오답: weak_sim_<examId>_q<num> 형태의 ID
        // STUDY_DATA에 없으므로 window.EXAM_DATA에서 원본 문제를 찾아 복습 문제로 조립
        if (cardId.startsWith('weak_sim_')) {
            const origQId = cardId.replace('weak_sim_', '');
            const EXAM_DATA = (typeof window !== 'undefined' && window.EXAM_DATA) ? window.EXAM_DATA : {};
            let foundQ = null;
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
            // 합답형 오답: COMBO_DRILLS_subjectN 번들에서 검색 (id 형식: <subjKey>_combo_<hash>)
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
