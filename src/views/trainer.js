// src/views/trainer.js - 스마트 훈련소, 계산 연습기, 배합한도 수치 훈련 로직 (뽀모도로는 pomodoro.js로 분리)
import { state, saveProgress, safeGetItem, safeSetItem } from '../state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';
import { initScratchpadCanvas, clearScratchpad, toggleCalcScratchpad, toggleScratchpadEraser } from '../scratchpad.js';
import { shuffle } from '../utils.js';
import { togglePomodoro, tickPomodoro, resetPomodoro, updatePomodoroUI } from './pomodoro.js';
import { showToast, vibrate, HAPTIC } from '../ui-utils.js';
import { STORAGE_KEYS } from '../storage-keys.js';
import {
    startCalcPractice,
    generateCalcQuestion,
    submitCalcAnswer,
    toggleSolutionAccordion,
    renderCalcHistory,
    addCalcHistoryItem
} from './trainer-calc-practice.js';
import {
    startIngredientsChallenge,
    generateIngredientsQuestions,
    renderIngQuestion,
    submitIngChoiceAnswer,
    submitIngAnswer,
    showIngFeedback,
    nextIngQuestion
} from './trainer-ingredients.js';

// 추출된 모듈의 함수 재수출 (app.js 호환성 유지)
export {
    startCalcPractice,
    generateCalcQuestion,
    submitCalcAnswer,
    toggleSolutionAccordion,
    renderCalcHistory,
    addCalcHistoryItem,
    startIngredientsChallenge,
    generateIngredientsQuestions,
    renderIngQuestion,
    submitIngChoiceAnswer,
    submitIngAnswer,
    showIngFeedback,
    nextIngQuestion
};

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

const cleanForCompare = (str) => {
    if (!str) return '';
    const stripped = str
        .replace(/\([a-zA-Z0-9]\)/g, '')
        .replace(/\[[a-zA-Z0-9]\]/g, '')
        .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')
        .trim();
    return stripped.replace(/\s+/g, '').replace(/[\*`'"\[\]\(\)]/g, '').toLowerCase();
};

export function checkShortAnswer(userInput, correctAnswer) {
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
   ⚖️ 화장품 법령 수치 훈련소 (Limits Trainer)
   ======================================================= */
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

export function startLimitsTrainer() {
    state.trainer.activeSubView = 'limits';
    state.trainer.limits.currentIndex = 0;
    state.trainer.limits.correctCount = 0;
    state.trainer.limits.solvedList = [];
    state.trainer.limits.shuffledData = shuffle(LIMITS_DB);
    
    document.getElementById('trainer-menu-panel').classList.add('is-hidden');
    document.getElementById('trainer-limits-panel').classList.remove('is-hidden');
    
    renderLimitsQuestion();
}

export function renderLimitsQuestion() {
    const limitsState = state.trainer.limits;
    const currentQ = limitsState.shuffledData[limitsState.currentIndex];
    
    const progressEl = document.getElementById('limits-progress-indicator');
    const catEl = document.getElementById('limits-q-category');
    const questionTextEl = document.getElementById('limits-question-text');

    if (progressEl) progressEl.textContent = `문제 ${limitsState.currentIndex + 1} / ${limitsState.shuffledData.length}`;
    if (catEl) catEl.textContent = currentQ.category;
    
    // 진행률 바
    const progressBar = document.getElementById('limits-progress-bar');
    if (progressBar) {
        const pct = Math.round(((limitsState.currentIndex) / limitsState.shuffledData.length) * 100);
        progressBar.style.width = `${pct}%`;
    }
    
    const qText = `다음 중 <strong>${esc(currentQ.category)}</strong> 성분인 <strong>"${esc(currentQ.key)}"</strong>의 기준 수치(<strong>${esc(currentQ.condition)}</strong>)로 올바른 것은?`;
    if (questionTextEl) questionTextEl.innerHTML = qText;
    
    const options = generateLimitsOptions(currentQ);
    const container = document.getElementById('limits-options-container');
    if (!container) return;
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
    
    const feedbackPanel = document.getElementById('limits-feedback-panel');
    const nextBtn = document.getElementById('next-limits-btn');
    if (feedbackPanel) feedbackPanel.classList.add('is-hidden');
    if (nextBtn) nextBtn.classList.add('is-hidden');
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
        const fallback = String((parseFloat(correctValue) || 1) * (optionsSet.size + 2));
        if (fallback !== correctValue) {
            optionsSet.add(fallback);
        } else {
            optionsSet.add(String((parseFloat(correctValue) || 1) * (optionsSet.size + 3)));
        }
    }
    
    return shuffle([...optionsSet]);
}

export function submitLimitsAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
    vibrate(isCorrect ? HAPTIC.correct : HAPTIC.wrong);
    const container = document.getElementById('limits-options-container');
    if (!container) return;
    const buttons = container.querySelectorAll('.limits-opt-btn');
    
    buttons.forEach(btn => {
        btn.disabled = true;
        const textSpan = btn.querySelector('.limits-opt-text');
        if (textSpan && textSpan.textContent.includes(correctValue)) {
            btn.classList.add('correct');
        }
    });
    
    if (!isCorrect) {
        selectedBtn.classList.add('incorrect');
    } else {
        state.trainer.limits.correctCount++;
    }
    
    const currentQ = state.trainer.limits.shuffledData[state.trainer.limits.currentIndex];
    
    // solvedList에 기록
    state.trainer.limits.solvedList.push({
        question: `${currentQ.category} - ${currentQ.key} (${currentQ.condition})`,
        selected: `${selectedValue} ${currentQ.unit}`,
        correctAnswer: `${correctValue} ${currentQ.unit}`,
        correct: isCorrect
    });
    
    const feedbackPanel = document.getElementById('limits-feedback-panel');
    const feedbackTitle = document.getElementById('limits-feedback-title');
    const feedbackDesc = document.getElementById('limits-feedback-desc');
    
    if (feedbackPanel) feedbackPanel.classList.remove('is-hidden');
    if (isCorrect) {
        if (feedbackPanel) feedbackPanel.classList.remove('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = '정답입니다!';
    } else {
        if (feedbackPanel) feedbackPanel.classList.add('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = `오답입니다! (정답: ${correctValue}${currentQ.unit})`;
    }
    if (feedbackDesc) feedbackDesc.textContent = currentQ.explanation;
    
    const nextBtn = document.getElementById('next-limits-btn');
    if (nextBtn) nextBtn.classList.remove('is-hidden');
}

export function nextLimitsQuestion() {
    const limitsState = state.trainer.limits;
    limitsState.currentIndex++;
    
    if (limitsState.currentIndex >= limitsState.shuffledData.length) {
        renderLimitsResult();
    } else {
        renderLimitsQuestion();
    }
}

function renderLimitsResult() {
    const limitsState = state.trainer.limits;
    const panel = document.getElementById('trainer-limits-panel');
    if (!panel) return;

    const total = limitsState.shuffledData.length;
    const correct = limitsState.correctCount;
    const rate = Math.round((correct / total) * 100);
    const wrongAnswers = limitsState.solvedList.filter(s => !s.correct);

    let reviewHTML = '';
    if (wrongAnswers.length === 0) {
        reviewHTML = '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 문제를 맞혔습니다!</p>';
    } else {
        reviewHTML = `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오답 리뷰 (${wrongAnswers.length}문제)</h3>`;
        wrongAnswers.forEach((s, idx) => {
            reviewHTML += `
                <div style="padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
                    <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:0.3rem;">Q${idx + 1}</div>
                    <p style="font-size:0.9rem; margin-bottom:0.4rem;">${esc(s.question)}</p>
                    <p style="font-size:0.85rem; color:var(--color-danger);">내 답: ${esc(s.selected)}</p>
                    <p style="font-size:0.85rem; color:var(--color-success);">정답: <strong>${esc(s.correctAnswer)}</strong></p>
                </div>`;
        });
    }

    panel.innerHTML = `
        <div class="sim-arena-header" style="margin-bottom: 2rem;">
            <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
            <div class="sim-title-group">
                <h4>핵심 수치 암기 마스터 결과</h4>
                <span class="badge badge-quiz-cat">수치 암기 훈련</span>
            </div>
        </div>
        <div class="trainer-arena" style="text-align:center;">
            <i class="fa-solid fa-trophy trophy-icon"></i>
            <h2>훈련 완료!</h2>
            <p class="result-score-summary">정답수: <strong>${correct}</strong> / ${total} (${rate}%)</p>
            <div style="text-align:left; margin:1.5rem 0; max-width:600px; margin-left:auto; margin-right:auto;">${reviewHTML}</div>
            <div class="result-actions" style="display:flex; gap:1rem; justify-content:center;">
                <button class="btn btn-primary" data-click="startLimitsTrainer"><i class="fa-solid fa-rotate-left"></i> 다시 풀기</button>
                <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-house"></i> 메뉴로</button>
            </div>
        </div>`;
}


/* =======================================================
   🏛️ 스마트 훈련소 상태 관리 (Trainer View Controller)
   ======================================================= */
export function initTrainer() {
    state.trainer.activeSubView = 'menu';
    const menuPanel = document.getElementById('trainer-menu-panel');
    const limitsPanel = document.getElementById('trainer-limits-panel');
    const calcPanel = document.getElementById('trainer-calc-panel');
    const ingPanel = document.getElementById('trainer-ingredients-panel');

    if (menuPanel) menuPanel.classList.remove('is-hidden');
    if (limitsPanel) limitsPanel.classList.add('is-hidden');
    if (calcPanel) calcPanel.classList.add('is-hidden');
    if (ingPanel) ingPanel.classList.add('is-hidden');
}

export function exitTrainerSubView() {
    initTrainer();
}
