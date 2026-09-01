// src/views/trainer.js - 스마트 훈련소, 계산 연습기, 배합한도 수치 훈련 및 뽀모도로 타이머 로직
import { state, saveProgress, safeGetItem, safeSetItem } from '../state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';
import { DataLoader } from '../data-loader.js';
import { buildCalcQuestion } from '../trainer-calc.js';
import { initScratchpadCanvas, clearScratchpad, toggleCalcScratchpad, toggleScratchpadEraser } from '../scratchpad.js';

/* =======================================================
   ⏱️ 집중 뽀모도로 타이머 (Pomodoro Study Timer)
   ======================================================= */
export function togglePomodoro() {
    const pomoState = state.trainer.pomodoro;
    const startBtn = document.getElementById('pomo-start-btn');
    const statusLabel = document.getElementById('pomo-status');
    if (!startBtn || !statusLabel) return;
    
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
            const pomoTime = document.getElementById('pomo-time');
            if (pomoTime) pomoTime.classList.remove('break-active');
        } else if (pomoState.status === 'break') {
            statusLabel.textContent = '휴식 중';
            statusLabel.className = 'pomodoro-status break';
            startBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 일시 정지';
            const pomoTime = document.getElementById('pomo-time');
            if (pomoTime) pomoTime.classList.add('break-active');
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

export function tickPomodoro() {
    const pomoState = state.trainer.pomodoro;
    if (!pomoState.isRunning) return;
    
    // 시작 시각으로부터 경과된 실시간(seconds) 계산 (백그라운드 스로틀링 극복 핵심)
    const elapsedSeconds = Math.floor((Date.now() - pomoState.startTime) / 1000);
    pomoState.timeLeft = Math.max(0, pomoState.duration - elapsedSeconds);
    
    if (pomoState.timeLeft <= 0) {
        clearInterval(pomoState.timerId);
        pomoState.isRunning = false;
        triggerPomodoroBeep(); // Chime 효과음 재생
        
        const statusLabel = document.getElementById('pomo-status');
        const startBtn = document.getElementById('pomo-start-btn');
        const pomoTime = document.getElementById('pomo-time');

        if (pomoState.status === 'work') {
            pomoState.totalTimeToday += 25;
            pomoState.sessionCount++;
            safeSetItem('pomo_total_time', pomoState.totalTimeToday);
            safeSetItem('pomo_total_time_date', new Date().toISOString().split('T')[0]);
            safeSetItem('pomo_session_count', pomoState.sessionCount);
            
            alert("집중 25분이 끝났습니다! 5분간 휴식하세요.");
            
            pomoState.status = 'break';
            pomoState.timeLeft = 5 * 60; // 5분 휴식
            if (statusLabel) {
                statusLabel.textContent = '휴식 대기';
                statusLabel.className = 'pomodoro-status break';
            }
            if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 휴식 시작';
            if (pomoTime) pomoTime.classList.add('break-active');
        } else {
            alert("휴식이 끝났습니다! 다시 힘내볼까요?");
            pomoState.status = 'idle';
            pomoState.timeLeft = 25 * 60;
            if (statusLabel) {
                statusLabel.textContent = '대기 중';
                statusLabel.className = 'pomodoro-status';
            }
            if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 집중 시작';
            if (pomoTime) pomoTime.classList.remove('break-active');
        }
    }
    
    updatePomodoroUI();
}

export function resetPomodoro() {
    const pomoState = state.trainer.pomodoro;
    if (pomoState.timerId) clearInterval(pomoState.timerId);
    
    pomoState.isRunning = false;
    pomoState.status = 'idle';
    pomoState.timeLeft = 25 * 60;
    
    const statusLabel = document.getElementById('pomo-status');
    const startBtn = document.getElementById('pomo-start-btn');
    const pomoTime = document.getElementById('pomo-time');

    if (statusLabel) {
        statusLabel.textContent = '대기 중';
        statusLabel.className = 'pomodoro-status';
    }
    if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 집중 시작';
    if (pomoTime) pomoTime.classList.remove('break-active');
    
    updatePomodoroUI();
}

export function updatePomodoroUI() {
    const pomoState = state.trainer.pomodoro;
    const min = Math.floor(pomoState.timeLeft / 60);
    const sec = pomoState.timeLeft % 60;
    
    const pomoTimeEl = document.getElementById('pomo-time');
    const pomoTotalEl = document.getElementById('pomo-total-time');
    const pomoSessionEl = document.getElementById('pomo-session-count');

    if (pomoTimeEl) pomoTimeEl.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    if (pomoTotalEl) pomoTotalEl.textContent = `${pomoState.totalTimeToday}분`;
    if (pomoSessionEl) pomoSessionEl.textContent = pomoState.sessionCount;
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
    state.trainer.limits.shuffledData = [...LIMITS_DB].sort(() => 0.5 - Math.random());
    
    document.getElementById('trainer-menu-panel').style.display = 'none';
    document.getElementById('trainer-limits-panel').style.display = 'block';
    
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
    if (feedbackPanel) feedbackPanel.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
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
    
    return [...optionsSet].sort(() => 0.5 - Math.random());
}

export function submitLimitsAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
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
    
    if (feedbackPanel) feedbackPanel.style.display = 'flex';
    if (isCorrect) {
        if (feedbackPanel) feedbackPanel.classList.remove('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = '정답입니다!';
    } else {
        if (feedbackPanel) feedbackPanel.classList.add('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = `오답입니다! (정답: ${correctValue}${currentQ.unit})`;
    }
    if (feedbackDesc) feedbackDesc.textContent = currentQ.explanation;
    
    const nextBtn = document.getElementById('next-limits-btn');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
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
   🧪 원료 배합 계산 연습기 (Calculation Trainer)
   ======================================================= */
export function startCalcPractice() {
    state.trainer.activeSubView = 'calc';
    state.trainer.calc.correctCount = 0;
    state.trainer.calc.totalSolved = 0;
    
    const menuPanel = document.getElementById('trainer-menu-panel');
    const calcPanel = document.getElementById('trainer-calc-panel');
    if (menuPanel) menuPanel.style.display = 'none';
    if (calcPanel) calcPanel.style.display = 'block';
    
    const scratchpadContainer = document.getElementById('calc-scratchpad-container');
    const toggleBtn = document.getElementById('calc-scratchpad-toggle');
    if (scratchpadContainer) scratchpadContainer.style.display = 'none';
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-pencil"></i> ✏️ 계산 연습장 열기';
    
    renderCalcHistory();
    generateCalcQuestion();
}

export function generateCalcQuestion() {
    const qData = buildCalcQuestion();
    state.trainer.calc.currentQuestion = qData;
    
    const typeBadge = document.getElementById('calc-type-badge');
    const questionText = document.getElementById('calc-question-text');
    const unitText = document.getElementById('calc-unit-text');
    const input = document.getElementById('calc-answer-input');
    const submitBtn = document.getElementById('submit-calc-btn');
    const feedbackPanel = document.getElementById('calc-feedback-panel');
    const solutionPanel = document.getElementById('calc-solution-panel');
    const nextBtn = document.getElementById('next-calc-btn');

    if (typeBadge) typeBadge.textContent = qData.type;
    if (questionText) questionText.innerHTML = qData.question;
    if (unitText) unitText.textContent = qData.unit;
    
    if (input) {
        input.value = '';
        input.disabled = false;
        input.focus();
    }
    
    if (submitBtn) submitBtn.disabled = false;
    if (feedbackPanel) feedbackPanel.style.display = 'none';
    if (solutionPanel) solutionPanel.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    
    const header = document.querySelector('.solution-header');
    if (header) {
        header.classList.remove('active');
        const body = document.getElementById('calc-solution-body');
        if (body) body.style.display = 'none';
    }
    
    if (typeof clearScratchpad === 'function') {
        clearScratchpad();
    }
}

export function submitCalcAnswer() {
    const calcState = state.trainer.calc;
    const currentQ = calcState.currentQuestion;
    const input = document.getElementById('calc-answer-input');
    if (!input) return;
    const userVal = parseFloat(input.value);
    
    if (isNaN(userVal)) {
        alert("올바른 숫자를 입력해 주세요!");
        return;
    }
    
    input.disabled = true;
    const submitBtn = document.getElementById('submit-calc-btn');
    if (submitBtn) submitBtn.disabled = true;
    
    calcState.totalSolved++;
    
    const correctVal = parseFloat(currentQ.answer);
    const isCorrect = Math.abs(userVal - correctVal) <= 0.02;
    
    if (isCorrect) {
        calcState.correctCount++;
    }
    
    addCalcHistoryItem(currentQ.question, currentQ.type, userVal, currentQ.answer, isCorrect, currentQ.unit);
    
    const feedbackPanel = document.getElementById('calc-feedback-panel');
    const feedbackTitle = document.getElementById('calc-feedback-title');
    const feedbackDesc = document.getElementById('calc-feedback-desc');
    const solutionBody = document.getElementById('calc-solution-body');
    const solutionPanel = document.getElementById('calc-solution-panel');
    const nextBtn = document.getElementById('next-calc-btn');

    if (feedbackPanel) feedbackPanel.style.display = 'flex';
    if (isCorrect) {
        if (feedbackPanel) feedbackPanel.classList.remove('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = '정답입니다!';
        if (feedbackDesc) feedbackDesc.textContent = `훌륭합니다! 올바른 배합 계산 결과입니다.`;
    } else {
        if (feedbackPanel) feedbackPanel.classList.add('incorrect');
        if (feedbackTitle) feedbackTitle.textContent = `오답입니다! (내가 쓴 답: ${userVal}${currentQ.unit})`;
        if (feedbackDesc) feedbackDesc.textContent = `정답은 약 ${currentQ.answer}${currentQ.unit} 입니다. 아래의 공식을 활용하여 풀이법을 다시 체크해 보세요.`;
    }
    
    if (solutionBody) solutionBody.innerHTML = currentQ.solution;
    if (solutionPanel) solutionPanel.style.display = 'block';
    if (nextBtn) nextBtn.style.display = 'inline-flex';
}

export function toggleSolutionAccordion() {
    const header = document.querySelector('.solution-header');
    const body = document.getElementById('calc-solution-body');
    if (!body) return;
    const isVisible = (body.style.display === 'block');
    
    if (isVisible) {
        if (header) header.classList.remove('active');
        body.style.display = 'none';
    } else {
        if (header) header.classList.add('active');
        body.style.display = 'block';
    }
}

export function renderCalcHistory() {
    const listContainer = document.getElementById('calc-history-list');
    if (!listContainer) return;
    
    const historyJSON = safeGetItem('calc_history');
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

export function addCalcHistoryItem(questionText, type, userVal, correctAns, isCorrect, unit) {
    const historyJSON = safeGetItem('calc_history');
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
    
    safeSetItem('calc_history', JSON.stringify(history));
    renderCalcHistory();
}

/* =======================================================
   🧪 화장품 원료 안전성 챌린지 훈련 로직 (Ingredients Safety Trainer)
   ======================================================= */
export function startIngredientsChallenge() {
    state.trainer.activeSubView = 'ingredients';
    state.trainer.ingredients.currentIndex = 0;
    state.trainer.ingredients.correctCount = 0;
    state.trainer.ingredients.solvedList = [];
    state.trainer.ingredients.shuffledQuestions = generateIngredientsQuestions();
    
    const menuPanel = document.getElementById('trainer-menu-panel');
    const ingPanel = document.getElementById('trainer-ingredients-panel');
    if (menuPanel) menuPanel.style.display = 'none';
    if (ingPanel) ingPanel.style.display = 'block';
    
    renderIngQuestion();
}

export function generateIngredientsQuestions() {
    const list = [];
    const db = typeof window.INGREDIENTS_DATA !== 'undefined' ? window.INGREDIENTS_DATA : [];
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
                explanation: `성분명 "${ing.name}"은(는) ${correctText}에 해당합니다.\n• 카테고리: ${ing.category}\n• 특징: ${ing.description || '법적 허용 기준 준수 대상'}\n• 고득점 TIP: ${ing.tip || '안전 기준 규격을 반드시 암기하세요.'}`
            });
        } else if (qType === 1) {
            list.push({
                type: 'short',
                qTypeLabel: '배합 한도 주관식',
                question: `사용상의 제한이 필요한 보존제/자외선 차단 성분인 <strong>"${esc(ing.name)}"</strong>의 법정 최대 배합 한도(%)는 얼마입니까?<br>(※ 성분 데이터에 명시된 수치와 % 기호 및 세부 조건을 정확히 입력하세요. 예: 1.0%, 0.5% 등)`,
                correct: ing.limit,
                explanation: `성분명 "${ing.name}"의 법정 사용 한도는 "${ing.limit}" 입니다.\n• 특징: ${ing.description || ''}\n• 비고/TIP: ${ing.tip || ''}`
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
                explanation: `알레르기 유발 성분 25종 기재 기준:\n• 씻어내는 제품: 0.01% 초과 시 기재 의무\n• 씻어내지 않는 제품: 0.001% 초과 시 기재 의무\n현재 배합량 ${conc}%는 기준치 ${limitVal}%에 대해 ${isRequired ? '초과' : '이하'}이므로, ${correctText}이(가) 맞습니다.`
            });
        }
    }
    
    return list;
}

export function renderIngQuestion() {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    
    const progressEl = document.getElementById('ing-progress-indicator');
    const labelEl = document.getElementById('ing-q-type-label');
    const textEl = document.getElementById('ing-question-text');

    if (progressEl) progressEl.textContent = `문제 ${ingState.currentIndex + 1} / ${ingState.shuffledQuestions.length}`;
    if (labelEl) labelEl.textContent = currentQ.qTypeLabel;
    if (textEl) textEl.innerHTML = currentQ.question;
    
    // 진행률 바
    const ingProgressBar = document.getElementById('ing-progress-bar');
    if (ingProgressBar) {
        const pct = Math.round(((ingState.currentIndex) / ingState.shuffledQuestions.length) * 100);
        ingProgressBar.style.width = `${pct}%`;
    }
    
    const optionsContainer = document.getElementById('ing-options-container');
    const inputContainer = document.getElementById('ing-input-container');
    const answerInput = document.getElementById('ing-answer-input');
    
    if (optionsContainer) optionsContainer.innerHTML = '';
    if (answerInput) answerInput.value = '';
    
    if (currentQ.type === 'choice') {
        if (optionsContainer) optionsContainer.style.display = 'grid';
        if (inputContainer) inputContainer.style.display = 'none';
        
        const optionIndicators = ['A', 'B', 'C', 'D'];
        currentQ.options.forEach((optValue, idx) => {
            const btn = document.createElement('button');
            btn.className = 'limits-opt-btn';
            btn.innerHTML = `<span class="limits-opt-num">${optionIndicators[idx]}</span> <span class="limits-opt-text">${esc(optValue)}</span>`;
            btn.addEventListener('click', () => {
                submitIngChoiceAnswer(btn, optValue, currentQ.correct);
            });
            if (optionsContainer) optionsContainer.appendChild(btn);
        });
    } else {
        if (optionsContainer) optionsContainer.style.display = 'none';
        if (inputContainer) inputContainer.style.display = 'flex';
    }
    
    const feedbackPanel = document.getElementById('ing-feedback-panel');
    const nextBtn = document.getElementById('next-ing-btn');
    if (feedbackPanel) feedbackPanel.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
}

export function submitIngChoiceAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
    const container = document.getElementById('ing-options-container');
    if (!container) return;
    const buttons = container.querySelectorAll('.limits-opt-btn');
    
    buttons.forEach(btn => {
        btn.disabled = true;
        const textSpan = btn.querySelector('.limits-opt-text');
        if (textSpan && textSpan.textContent === correctValue) {
            btn.classList.add('correct');
        }
    });
    
    if (!isCorrect) {
        selectedBtn.classList.add('incorrect');
    } else {
        state.trainer.ingredients.correctCount++;
    }
    
    // solvedList에 기록
    const currentQ = state.trainer.ingredients.shuffledQuestions[state.trainer.ingredients.currentIndex];
    state.trainer.ingredients.solvedList.push({
        question: currentQ.question.replace(/<[^>]*>/g, ''),
        selected: selectedValue,
        correctAnswer: correctValue,
        correct: isCorrect
    });
    
    showIngFeedback(isCorrect, correctValue);
}

export function submitIngAnswer() {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    const input = document.getElementById('ing-answer-input');
    if (!input) return;
    const userInput = input.value.trim();
    
    if (!userInput) {
        alert('정답을 입력하세요!');
        return;
    }
    
    const isCorrect = checkShortAnswer(userInput, currentQ.correct);
    if (isCorrect) {
        ingState.correctCount++;
    }
    
    // solvedList에 기록
    ingState.solvedList.push({
        question: currentQ.question.replace(/<[^>]*>/g, ''),
        selected: userInput,
        correctAnswer: currentQ.correct,
        correct: isCorrect
    });
    
    showIngFeedback(isCorrect, currentQ.correct);
}

export function showIngFeedback(isCorrect, correctValue) {
    const ingState = state.trainer.ingredients;
    const currentQ = ingState.shuffledQuestions[ingState.currentIndex];
    
    const feedbackPanel = document.getElementById('ing-feedback-panel');
    const feedbackTitle = document.getElementById('ing-feedback-title');
    const feedbackDesc = document.getElementById('ing-feedback-desc');
    
    if (feedbackPanel) feedbackPanel.style.display = 'flex';
    if (feedbackTitle) {
        if (isCorrect) {
            feedbackPanel.classList.remove('incorrect');
            feedbackTitle.innerHTML = '🟢 정답입니다!';
        } else {
            feedbackPanel.classList.add('incorrect');
            feedbackTitle.innerHTML = `🔴 오답입니다! (정답: <strong>${esc(correctValue)}</strong>)`;
        }
    }
    if (feedbackDesc) feedbackDesc.innerHTML = safeTextWithBreaks(currentQ.explanation);
    
    const nextBtn = document.getElementById('next-ing-btn');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
    
    const submitBtn = document.getElementById('submit-ing-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    const answerInput = document.getElementById('ing-answer-input');
    if (answerInput) {
        answerInput.disabled = true;
    }
}

export function nextIngQuestion() {
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
        renderIngredientsResult();
    } else {
        renderIngQuestion();
    }
}

function renderIngredientsResult() {
    const ingState = state.trainer.ingredients;
    const panel = document.getElementById('trainer-ingredients-panel');
    if (!panel) return;

    const total = ingState.shuffledQuestions.length;
    const correct = ingState.correctCount;
    const rate = Math.round((correct / total) * 100);
    const wrongAnswers = ingState.solvedList.filter(s => !s.correct);

    let reviewHTML = '';
    if (wrongAnswers.length === 0) {
        reviewHTML = '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 문제를 맞혔습니다!</p>';
    } else {
        reviewHTML = `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오답 리뷰 (${wrongAnswers.length}문제)</h3>`;
        wrongAnswers.forEach((s, idx) => {
            reviewHTML += `
                <div style="padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
                    <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:0.3rem;">Q${idx + 1}</div>
                    <p style="font-size:0.9rem; margin-bottom:0.4rem;">${safeTextWithBreaks(s.question)}</p>
                    <p style="font-size:0.85rem; color:var(--color-danger);">내 답: ${esc(s.selected)}</p>
                    <p style="font-size:0.85rem; color:var(--color-success);">정답: <strong>${esc(s.correctAnswer)}</strong></p>
                </div>`;
        });
    }

    panel.innerHTML = `
        <div class="sim-arena-header" style="margin-bottom: 2rem;">
            <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
            <div class="sim-title-group">
                <h4>원료 안전성 챌린지 결과</h4>
                <span class="badge badge-quiz-cat">원료 규격 & 안전성</span>
            </div>
        </div>
        <div class="trainer-arena" style="text-align:center;">
            <i class="fa-solid fa-trophy trophy-icon"></i>
            <h2>챌린지 완료!</h2>
            <p class="result-score-summary">정답수: <strong>${correct}</strong> / ${total} (${rate}%)</p>
            <div style="text-align:left; margin:1.5rem 0; max-width:600px; margin-left:auto; margin-right:auto;">${reviewHTML}</div>
            <div class="result-actions" style="display:flex; gap:1rem; justify-content:center;">
                <button class="btn btn-primary" data-click="startIngredientsChallenge"><i class="fa-solid fa-rotate-left"></i> 다시 도전</button>
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

    if (menuPanel) menuPanel.style.display = 'block';
    if (limitsPanel) limitsPanel.style.display = 'none';
    if (calcPanel) calcPanel.style.display = 'none';
    if (ingPanel) ingPanel.style.display = 'none';
}

export function exitTrainerSubView() {
    initTrainer();
}
