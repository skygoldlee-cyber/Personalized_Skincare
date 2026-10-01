// src/views/trainer.js - 스마트 훈련소, 계산 연습기, 배합한도 수치 훈련 로직 (뽀모도로는 pomodoro.js로 분리)
// @spec T-01~05,ND-01,RV-01
import { state } from '../state.js';
import { esc } from '../sanitize.js';
import { shuffle } from '../utils.js';
import { vibrate, HAPTIC, showToast } from '../ui-utils.js';
import { PATHS } from '../paths.js';
import { DataLoader } from '../data-loader.js';
import { updateDueBadges } from './trainer-drills.js';

/* =======================================================
   🧠 주관식 유사어 채점 엔진 (Smart Synonym Matcher)
   유사어 사전은 시험별 도메인 용어라 manifest.synonyms → registry.synonyms로
   주입된다 (미선언 시험은 빈 사전 — 정확 일치·조사 제거만 적용).
   ======================================================= */
function _getSynonyms() {
    const reg = DataLoader.registry;
    return (reg && reg.synonyms && typeof reg.synonyms === 'object') ? reg.synonyms : {};
}

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
    
    // 유사어 사전 대조 (registry.synonyms — 시험별 manifest 선언)
    for (const [key, synonyms] of Object.entries(_getSynonyms())) {
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
   ⚖️ 핵심 수치 훈련소 (Limits Trainer)
   데이터: {contentRoot}/limits-trainer.json — 시험별 콘텐츠, features.limitsTrainer 플래그로 게이트
   ======================================================= */
let _limitsDbCache = null;

/**
 * 수치 훈련 데이터 로드 — 활성 시험의 limits-trainer.json.
 * 시험별 콘텐츠 (features.limitsTrainer). 파일이 없으면 빈 배열.
 * @returns {Promise<Array<{category:string,key:string,value:string,unit:string,condition:string,explanation:string}>>}
 */
async function loadLimitsDb() {
    if (_limitsDbCache) return _limitsDbCache;
    try {
        const resp = await fetch(PATHS.LIMITS_TRAINER());
        const data = resp.ok ? await resp.json() : [];
        _limitsDbCache = Array.isArray(data) ? data : [];
    } catch (e) {
        _limitsDbCache = [];
    }
    return _limitsDbCache;
}

export async function startLimitsTrainer() {
    const db = await loadLimitsDb();
    if (db.length === 0) {
        showToast('이 시험에는 수치 훈련 데이터가 없습니다.', 'info');
        return;
    }
    state.trainer.activeSubView = 'limits';
    state.trainer.limits.currentIndex = 0;
    state.trainer.limits.correctCount = 0;
    state.trainer.limits.solvedList = [];
    state.trainer.limits.shuffledData = shuffle(db);
    
    document.getElementById('trainer-menu-panel')?.classList.add('is-hidden');
    document.getElementById('trainer-limits-panel')?.classList.remove('is-hidden');
    
    renderLimitsQuestion();
}

function renderLimitsQuestion() {
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
        
        btn.dataset.value = optValue;
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
    
    let _safety = 0;
    while (optionsSet.size < 4 && _safety < 100) {
        _safety++;
        const fallback = String((parseFloat(correctValue) || 1) * (optionsSet.size + 2));
        if (fallback !== correctValue) {
            optionsSet.add(fallback);
        } else {
            optionsSet.add(String((parseFloat(correctValue) || 1) * (optionsSet.size + 3)));
        }
    }
    
    return shuffle([...optionsSet]);
}

function submitLimitsAnswer(selectedBtn, selectedValue, correctValue) {
    const isCorrect = (selectedValue === correctValue);
    vibrate(isCorrect ? HAPTIC.correct : HAPTIC.wrong);
    const container = document.getElementById('limits-options-container');
    if (!container) return;
    const buttons = container.querySelectorAll('.limits-opt-btn');
    
    buttons.forEach(el => {
        const btn = /** @type {HTMLButtonElement} */ (el);
        btn.disabled = true;
        // 표시 텍스트 부분문자열이 아닌 데이터값으로 정답 버튼 판정
        // ('5'가 '50'·'0.5' 오답지에도 매칭되던 문제)
        if (btn.dataset.value === correctValue) {
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
            <button class="btn btn-secondary" data-click="exitTrainerSubView" title="훈련소 메뉴로 돌아가기"><i class="fa-solid fa-arrow-left"></i> 나가기</button>
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

// 서브패널 ↔ 해시 슬러그 — 열리면 #/trainer/<slug> push,
// 뒤로가기(#/trainer 복귀) 시 메뉴로 돌린다 (UX-NAV 확장)
const TRAINER_SUB_SLUGS = {
    'trainer-limits-panel': 'limits',
    'trainer-oxdrill-panel': 'oxdrill',
    'trainer-combo-panel': 'combo',
    'trainer-weak-panel': 'weak',
    'trainer-calc-panel': 'calc',
    'trainer-ingredients-panel': 'ingredients',
};
let _subnavReady = false;
let _observedView = null;
let _subObserver = null;
let _openSubPanel = null;

function _currentOpenSubPanel() {
    for (const id of Object.keys(TRAINER_SUB_SLUGS)) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('is-hidden')) return id;
    }
    return null;
}

/** 훈련소 서브패널 해시 동기화 — 1회 설치 (옵저버 + hashchange 구독). */
function initTrainerSubnav() {
    const view = document.getElementById('trainer-view');
    if (!view) return;

    // 서브패널이 열리면 깊이 해시를 push — 뒤로가기가 뷰 이탈 대신 메뉴 복귀가 되게
    if (view !== _observedView) {
        if (_subObserver) _subObserver.disconnect();
        _observedView = view;
        _openSubPanel = _currentOpenSubPanel();
        _subObserver = new MutationObserver(() => {
            const open = _currentOpenSubPanel();
            if (open === _openSubPanel) return;
            _openSubPanel = open;
            if (open && state.currentView === 'trainer-view' && location.hash === '#/trainer') {
                try {
                    history.pushState({ view: 'trainer-view' }, '', '#/trainer/' + TRAINER_SUB_SLUGS[open]);
                } catch (_) { /* 제한 환경 무시 */ }
            }
        });
        _subObserver.observe(view, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    if (_subnavReady) return;
    _subnavReady = true;

    // 뒤로가기로 #/trainer에 도달했는데 서브패널이 열려 있으면 메뉴로 복귀
    window.addEventListener('hashchange', () => {
        if (state.currentView === 'trainer-view'
            && location.hash === '#/trainer'
            && _currentOpenSubPanel()) {
            initTrainer();
        }
    });
}

export function initTrainer() {
    initTrainerSubnav();
    state.trainer.activeSubView = 'menu';
    const menuPanel = document.getElementById('trainer-menu-panel');
    const limitsPanel = document.getElementById('trainer-limits-panel');
    const calcPanel = document.getElementById('trainer-calc-panel');
    const ingPanel = document.getElementById('trainer-ingredients-panel');
    const oxPanel = document.getElementById('trainer-oxdrill-panel');
    const comboPanel = document.getElementById('trainer-combo-panel');
    const weakPanel = document.getElementById('trainer-weak-panel');

    if (menuPanel) menuPanel.classList.remove('is-hidden');
    if (limitsPanel) limitsPanel.classList.add('is-hidden');
    if (calcPanel) calcPanel.classList.add('is-hidden');
    if (ingPanel) ingPanel.classList.add('is-hidden');
    if (oxPanel) oxPanel.classList.add('is-hidden');
    if (comboPanel) comboPanel.classList.add('is-hidden');
    if (weakPanel) weakPanel.classList.add('is-hidden');

    // 사장된 서브패널 해시 정규화 — 나가기 버튼·딥링크 잔여 해시를 #/trainer로 복원.
    // 뒤로가기 경유(hashchange → initTrainer)는 이미 #/trainer라 이 분기를 타지 않는다.
    if (location.hash.startsWith('#/trainer/')) {
        try { history.replaceState({ view: 'trainer-view' }, '', '#/trainer'); }
        catch (_) { /* 제한 환경 무시 */ }
    }
    updateDueBadges(); // 트레이너 카드의 "오늘 복습 대상" 배지 갱신
}

export function exitTrainerSubView() {
    initTrainer();
}
