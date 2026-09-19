// src/views/trainer-drills.js — O/X 판정 드릴 + 합답형(combo) 드릴
//
// 데이터: DataLoader.loadOxDrills(N) → OX_DRILLS_subjectN (build_ox_drills.js 생성)
//         DataLoader.loadComboDrills() → COMBO_PILOT (수작업 저작)
// 채점: src/questions.js gradeAnswer — ox는 truth 비교, combo는 members ⊆ 도출 정답 비교
// 추적: recordStatementJudgments — sid 단위 SM-2 스케줄 + 오판 통계 (statement-tracker.js)
//       O/X 드릴은 출제 시 오판 이력(sid)이 있는 문항을 우선 편성한다.

import { state } from '../state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';
import { shuffle } from '../utils.js';
import { vibrate, showToast, HAPTIC } from '../ui-utils.js';
import { DataLoader } from '../data-loader.js';
import { gradeAnswer } from '../questions.js';
import { recordStatementJudgments, getWeakStatements } from '../statement-tracker.js';
import { recordStudyActivity } from '../study-tracker.js';

const DRILL_COUNT = 10;
const OPTION_INDICATORS = ['①', '②', '③', '④', '⑤'];

/* =======================================================
   ⭕❌ O/X 판정 드릴
   ======================================================= */

/** 패널 열기 (과목 선택 화면) */
export function openOxDrillSetup() {
    state.trainer.activeSubView = 'oxdrill';
    const menu = document.getElementById('trainer-menu-panel');
    const panel = document.getElementById('trainer-oxdrill-panel');
    const setup = document.getElementById('oxdrill-setup');
    const arena = document.getElementById('oxdrill-arena');
    const result = document.getElementById('oxdrill-result');
    if (menu) menu.classList.add('is-hidden');
    if (panel) panel.classList.remove('is-hidden');
    if (setup) setup.classList.remove('is-hidden');
    if (arena) arena.classList.add('is-hidden');
    if (result) result.classList.add('is-hidden');
}

/**
 * 과목별 O/X 드릴 시작 — 취약 진술(sid) 우선 편성
 * @param {string|number} subjectNum 1~4
 */
export function startOxDrill(subjectNum) {
    const num = parseInt(subjectNum, 10);
    if (isNaN(num) || num < 1 || num > 4) return;
    DataLoader.loadOxDrills(num).then(items => {
        const st = state.trainer.oxdrill;
        st.subject = num;
        st.data = pickDrillItems(items, DRILL_COUNT);
        st.currentIndex = 0;
        st.correctCount = 0;
        st.solvedList = [];

        if (st.data.length === 0) {
            showToast('이 과목에는 출제 가능한 O/X 문항이 없습니다.', 'warning');
            return;
        }

        const setup = document.getElementById('oxdrill-setup');
        const arena = document.getElementById('oxdrill-arena');
        const result = document.getElementById('oxdrill-result');
        if (setup) setup.classList.add('is-hidden');
        if (result) result.classList.add('is-hidden');
        if (arena) arena.classList.remove('is-hidden');
        renderOxDrillQuestion();
    }).catch(err => {
        console.error(err);
        showToast('O/X 드릴 데이터를 불러오지 못했습니다.', 'error');
    });
}

/** 취약 진술 문항을 최대 절반까지 우선 편성하고 나머지는 무작위로 채움 */
function pickDrillItems(items, count) {
    const weakSids = new Set(getWeakStatements().map(w => w.sid));
    const weakPool = items.filter(i => i.sid && weakSids.has(i.sid));
    const restPool = items.filter(i => !i.sid || !weakSids.has(i.sid));
    const weakPick = shuffle(weakPool).slice(0, Math.ceil(count / 2));
    const restPick = shuffle(restPool).slice(0, count - weakPick.length);
    return shuffle([...weakPick, ...restPick]);
}

function renderOxDrillQuestion() {
    const st = state.trainer.oxdrill;
    const q = st.data[st.currentIndex];
    if (!q) return;

    const bar = document.getElementById('oxdrill-progress-bar');
    const ind = document.getElementById('oxdrill-progress-indicator');
    const ctxEl = document.getElementById('oxdrill-context');
    const stemEl = document.getElementById('oxdrill-stem');
    const stmtEl = document.getElementById('oxdrill-statement');
    const oxBox = document.getElementById('oxdrill-ox-container');
    const feedback = document.getElementById('oxdrill-feedback-panel');
    const nextBtn = document.getElementById('next-oxdrill-btn');

    if (bar) bar.style.width = `${Math.round((st.currentIndex / st.data.length) * 100)}%`;
    if (ind) ind.textContent = `문제 ${st.currentIndex + 1} / ${st.data.length}`;
    if (ctxEl) ctxEl.textContent = q.context || q.source || '';
    if (stemEl) stemEl.textContent = q.stem || '다음 진술이 옳은가? (O/X)';
    if (stmtEl) stmtEl.innerHTML = safeTextWithBreaks(q.statement || '');
    if (feedback) feedback.classList.add('is-hidden');
    if (nextBtn) nextBtn.classList.add('is-hidden');

    if (oxBox) {
        oxBox.innerHTML = '';
        [['O', '맞다 (O)', 'correct'], ['X', '틀리다 (X)', 'incorrect']].forEach(([val, label, cls]) => {
            const btn = document.createElement('button');
            btn.className = 'limits-opt-btn oxdrill-ox-btn';
            btn.dataset.ox = val;
            btn.innerHTML = `<span class="limits-opt-num">${val === 'O' ? '⭕' : '❌'}</span> <span class="limits-opt-text">${esc(label)}</span>`;
            btn.addEventListener('click', () => submitOxDrillAnswer(btn, val));
            oxBox.appendChild(btn);
        });
    }
}

function submitOxDrillAnswer(selectedBtn, val) {
    const st = state.trainer.oxdrill;
    const q = st.data[st.currentIndex];
    if (!q) return;

    const res = gradeAnswer(q, val);
    const isCorrect = res.correct;
    vibrate(isCorrect ? HAPTIC.correct : HAPTIC.wrong);

    // 진술 단위 추적 — ox 문항 자체가 1진술이므로 sid에 판정 결과를 기록
    recordStatementJudgments([{ sid: q.sid, judgedCorrect: isCorrect }]);
    recordStudyActivity({ quizzes: 1, correct: isCorrect ? 1 : 0 });

    const oxBox = document.getElementById('oxdrill-ox-container');
    if (oxBox) {
        oxBox.querySelectorAll('button').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.ox === res.correctAnswer) btn.classList.add('correct');
        });
    }
    if (!isCorrect) selectedBtn.classList.add('incorrect');
    else st.correctCount++;

    st.solvedList.push({
        question: `[${q.context || ''}] ${q.statement}`,
        selected: val,
        correctAnswer: res.correctAnswer,
        correct: isCorrect
    });

    const feedback = document.getElementById('oxdrill-feedback-panel');
    const title = document.getElementById('oxdrill-feedback-title');
    const desc = document.getElementById('oxdrill-feedback-desc');
    if (feedback) feedback.classList.remove('is-hidden');
    if (isCorrect) {
        if (feedback) feedback.classList.remove('incorrect');
        if (title) title.textContent = '정답입니다!';
    } else {
        if (feedback) feedback.classList.add('incorrect');
        if (title) title.textContent = `오답입니다! (정답: ${res.correctAnswer})`;
    }
    if (desc) desc.innerHTML = safeTextWithBreaks(q.explain || '');

    const nextBtn = document.getElementById('next-oxdrill-btn');
    if (nextBtn) nextBtn.classList.remove('is-hidden');
}

export function nextOxDrill() {
    const st = state.trainer.oxdrill;
    st.currentIndex++;
    if (st.currentIndex >= st.data.length) renderOxDrillResult();
    else renderOxDrillQuestion();
}

function renderOxDrillResult() {
    const st = state.trainer.oxdrill;
    const arena = document.getElementById('oxdrill-arena');
    const result = document.getElementById('oxdrill-result');
    if (arena) arena.classList.add('is-hidden');
    if (!result) return;
    result.classList.remove('is-hidden');

    const total = st.data.length;
    const rate = total > 0 ? Math.round((st.correctCount / total) * 100) : 0;
    const wrong = st.solvedList.filter(s => !s.correct);
    const weakCount = getWeakStatements().length;

    result.innerHTML = `
        <div class="trainer-arena" style="text-align:center;">
            <i class="fa-solid fa-trophy trophy-icon"></i>
            <h2>O/X 드릴 완료!</h2>
            <p class="result-score-summary">정답수: <strong>${st.correctCount}</strong> / ${total} (${rate}%)</p>
            <p style="color:var(--color-text-muted); font-size:0.85rem;">누적 취약 진술: ${weakCount}개 (오판 진술은 다음 세션에 우선 출제됩니다)</p>
            <div style="text-align:left; margin:1.5rem 0; max-width:600px; margin-left:auto; margin-right:auto;">
                ${wrong.length === 0
                    ? '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 문제를 맞혔습니다!</p>'
                    : `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오답 리뷰 (${wrong.length}문제)</h3>` +
                      wrong.map((s, i) => `
                        <div style="padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
                            <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:0.3rem;">Q${i + 1}</div>
                            <p style="font-size:0.9rem; margin-bottom:0.4rem;">${safeTextWithBreaks(s.question)}</p>
                            <p style="font-size:0.85rem; color:var(--color-danger);">내 답: ${esc(s.selected)}</p>
                            <p style="font-size:0.85rem; color:var(--color-success);">정답: <strong>${esc(s.correctAnswer)}</strong></p>
                        </div>`).join('')}
            </div>
            <div class="result-actions" style="display:flex; gap:1rem; justify-content:center;">
                <button class="btn btn-primary" data-click="startOxDrill" data-arg="${st.subject}"><i class="fa-solid fa-rotate-left"></i> 다시 풀기</button>
                <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-house"></i> 메뉴로</button>
            </div>
        </div>`;
}

/* =======================================================
   ㄱㄴㄷㄹ 합답형(combo) 드릴
   ======================================================= */

export function startComboDrill() {
    DataLoader.loadComboDrills().then(bundle => {
        const st = state.trainer.combo;
        st.data = shuffle(bundle.questions).slice(0, DRILL_COUNT);
        st.currentIndex = 0;
        st.correctCount = 0;
        st.solvedList = [];

        const menu = document.getElementById('trainer-menu-panel');
        const panel = document.getElementById('trainer-combo-panel');
        const arena = document.getElementById('combo-arena');
        const result = document.getElementById('combo-result');
        if (menu) menu.classList.add('is-hidden');
        if (panel) panel.classList.remove('is-hidden');
        if (arena) arena.classList.remove('is-hidden');
        if (result) result.classList.add('is-hidden');
        state.trainer.activeSubView = 'combo';
        renderComboQuestion();
    }).catch(err => {
        console.error(err);
        showToast('합답형 드릴 데이터를 불러오지 못했습니다.', 'error');
    });
}

function renderComboQuestion() {
    const st = state.trainer.combo;
    const q = st.data[st.currentIndex];
    if (!q) return;

    const bar = document.getElementById('combo-progress-bar');
    const ind = document.getElementById('combo-progress-indicator');
    const catEl = document.getElementById('combo-q-category');
    const stemEl = document.getElementById('combo-stem');
    const stmtsEl = document.getElementById('combo-statements');
    const optsEl = document.getElementById('combo-options-container');
    const feedback = document.getElementById('combo-feedback-panel');
    const nextBtn = document.getElementById('next-combo-btn');

    if (bar) bar.style.width = `${Math.round((st.currentIndex / st.data.length) * 100)}%`;
    if (ind) ind.textContent = `문제 ${st.currentIndex + 1} / ${st.data.length}`;
    if (catEl) catEl.textContent = `과목${q.subject} · 합답형`;
    if (stemEl) stemEl.innerHTML = safeTextWithBreaks(q.stem || '');
    if (feedback) feedback.classList.add('is-hidden');
    if (nextBtn) nextBtn.classList.add('is-hidden');

    if (stmtsEl) {
        stmtsEl.innerHTML = q.statements.map(s =>
            `<div class="combo-stmt" data-stmt-id="${esc(s.id)}">
                <span class="combo-stmt-id">${esc(s.id)}</span>
                <span class="combo-stmt-text">${safeTextWithBreaks(s.text)}</span>
            </div>`).join('');
    }

    if (optsEl) {
        optsEl.innerHTML = '';
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'limits-opt-btn';
            btn.style.width = '100%';
            btn.style.marginBottom = '0.75rem';
            btn.innerHTML = `<span class="limits-opt-num">${esc(OPTION_INDICATORS[idx] || String(idx + 1))}</span> <span class="limits-opt-text">${esc(opt.members.join(', '))}</span>`;
            btn.addEventListener('click', () => submitComboAnswer(btn, opt.id, idx));
            optsEl.appendChild(btn);
        });
    }
}

function submitComboAnswer(selectedBtn, optId, optIdx) {
    const st = state.trainer.combo;
    const q = st.data[st.currentIndex];
    if (!q) return;

    const res = gradeAnswer(q, { optionId: optId });
    const isCorrect = res.correct;
    vibrate(isCorrect ? HAPTIC.correct : HAPTIC.wrong);

    // 진술별 판정 결과(members 유도)를 sid 단위 SM-2/오판 통계로 기록
    recordStatementJudgments(res.perStatement);
    recordStudyActivity({ quizzes: 1, correct: isCorrect ? 1 : 0 });

    const optsEl = document.getElementById('combo-options-container');
    const correctIdx = q.options.findIndex(o => o.id === res.correctAnswer);
    if (optsEl) {
        optsEl.querySelectorAll('button').forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === correctIdx) btn.classList.add('correct');
        });
    }
    if (!isCorrect) selectedBtn.classList.add('incorrect');
    else st.correctCount++;

    const selectedLabel = OPTION_INDICATORS[optIdx] || optId;
    const correctLabel = correctIdx >= 0 ? OPTION_INDICATORS[correctIdx] : res.correctAnswer;
    st.solvedList.push({
        question: q.stem,
        selected: selectedLabel,
        correctAnswer: correctLabel,
        correct: isCorrect,
        perStatement: res.perStatement
    });

    // 피드백: 정오답 + 진술별 판정 결과 (오판 진술은 강조 + 해설)
    const feedback = document.getElementById('combo-feedback-panel');
    const title = document.getElementById('combo-feedback-title');
    const stmtsFb = document.getElementById('combo-feedback-statements');
    const desc = document.getElementById('combo-feedback-desc');
    if (feedback) feedback.classList.remove('is-hidden');
    if (isCorrect) {
        if (feedback) feedback.classList.remove('incorrect');
        if (title) title.textContent = '정답입니다!';
    } else {
        if (feedback) feedback.classList.add('incorrect');
        if (title) title.textContent = `오답입니다! (정답: ${correctLabel})`;
    }

    if (stmtsFb && Array.isArray(res.perStatement)) {
        stmtsFb.innerHTML = res.perStatement.map(s => {
            const truthLabel = s.truth ? 'O' : 'X';
            const judgedLabel = s.userJudged === null ? '—' : (s.userJudged ? 'O' : 'X');
            const misjudged = s.judgedCorrect === false;
            return `<div class="combo-fb-stmt${misjudged ? ' misjudged' : ''}">
                <span class="combo-stmt-id">${esc(s.id)}</span>
                <span class="combo-fb-truth">정답 ${truthLabel}</span>
                <span class="combo-fb-judged">내 판정 ${judgedLabel}${misjudged ? ' ✗' : ''}</span>
                ${misjudged && s.explain ? `<p class="combo-fb-explain">${safeTextWithBreaks(s.explain)}</p>` : ''}
            </div>`;
        }).join('');
    }
    if (desc) desc.innerHTML = safeTextWithBreaks(q.explain || '');

    const nextBtn = document.getElementById('next-combo-btn');
    if (nextBtn) nextBtn.classList.remove('is-hidden');
}

export function nextComboDrill() {
    const st = state.trainer.combo;
    st.currentIndex++;
    if (st.currentIndex >= st.data.length) renderComboResult();
    else renderComboQuestion();
}

function renderComboResult() {
    const st = state.trainer.combo;
    const arena = document.getElementById('combo-arena');
    const result = document.getElementById('combo-result');
    if (arena) arena.classList.add('is-hidden');
    if (!result) return;
    result.classList.remove('is-hidden');

    const total = st.data.length;
    const rate = total > 0 ? Math.round((st.correctCount / total) * 100) : 0;
    const wrong = st.solvedList.filter(s => !s.correct);
    const weakCount = getWeakStatements().length;

    // 세션에서 오판한 진술 모음 (중복 sid 제거)
    const misjudged = [];
    const seen = new Set();
    st.solvedList.forEach(s => {
        (s.perStatement || []).forEach(p => {
            if (p.judgedCorrect === false && p.sid && !seen.has(p.sid)) {
                seen.add(p.sid);
                misjudged.push(p);
            }
        });
    });

    result.innerHTML = `
        <div class="trainer-arena" style="text-align:center;">
            <i class="fa-solid fa-trophy trophy-icon"></i>
            <h2>합답형 드릴 완료!</h2>
            <p class="result-score-summary">정답수: <strong>${st.correctCount}</strong> / ${total} (${rate}%)</p>
            <p style="color:var(--color-text-muted); font-size:0.85rem;">누적 취약 진술: ${weakCount}개 · 이번 세션 오판 진술: ${misjudged.length}개</p>
            <div style="text-align:left; margin:1.5rem 0; max-width:600px; margin-left:auto; margin-right:auto;">
                ${misjudged.length === 0
                    ? '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 진술을 정확히 판정했습니다!</p>'
                    : `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오판 진술 리뷰 (${misjudged.length}개)</h3>` +
                      misjudged.map(p => `
                        <div style="padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
                            <p style="font-size:0.85rem; margin-bottom:0.4rem;"><strong>${esc(p.id)}</strong> — 정답 ${p.truth ? 'O' : 'X'}, 내 판정 ${p.userJudged ? 'O' : 'X'}</p>
                            ${p.explain ? `<p style="font-size:0.85rem; color:var(--color-text-muted);">${safeTextWithBreaks(p.explain)}</p>` : ''}
                        </div>`).join('')}
            </div>
            <div class="result-actions" style="display:flex; gap:1rem; justify-content:center;">
                <button class="btn btn-primary" data-click="startComboDrill"><i class="fa-solid fa-rotate-left"></i> 다시 풀기</button>
                <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-house"></i> 메뉴로</button>
            </div>
        </div>`;
}
