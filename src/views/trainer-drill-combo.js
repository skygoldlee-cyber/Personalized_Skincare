// src/views/trainer-drill-combo.js - 복수정답형(combo) 드릴
// @spec DR-02
import { state } from '../state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';
import { vibrate, showToast, HAPTIC } from '../ui-utils.js';
import { gradeAnswer } from '../questions.js';
import { recordStatementJudgments, getWeakStatements } from '../statement-tracker.js';
import { recordStudyActivity } from '../study-tracker.js';
import { proFeatureNotice } from '../pro-upgrade.js';
import { OPTION_INDICATORS, openDrillSetup, startDrill, nextDrill, renderDrillResult } from './trainer-drills.js';

/* =======================================================
   ㄱㄴㄷㄹ 복수정답형(combo) 드릴
   ======================================================= */

/** 패널 열기 (과목 선택 화면) */
export function openComboDrillSetup() {
  proFeatureNotice('combo_drill', 'ㄱㄴㄷ 조합 훈련');
  openDrillSetup('combo');
}

/**
 * 과목별 복수정답형 드릴 시작 — 취약 진술(sid) 포함 문항 우선 편성
 * @param {string|number} subjectNum 과목 order 번호
 */
export function startComboDrill(subjectNum) { startDrill('combo', subjectNum); }

export function renderComboQuestion() {
    const st = state.trainer.combo;
    const q = st.data[st.currentIndex];
    if (!q) return;
    st.judgments = {}; // 진술별 O/X 판정 (2단계 응시) 초기화

    const bar = document.getElementById('combo-progress-bar');
    const ind = document.getElementById('combo-progress-indicator');
    const catEl = document.getElementById('combo-q-category');
    const citEl = document.getElementById('combo-citation');
    const stemEl = document.getElementById('combo-stem');
    const stmtsEl = document.getElementById('combo-statements');
    const optsEl = document.getElementById('combo-options-container');
    const feedback = document.getElementById('combo-feedback-panel');
    const nextBtn = document.getElementById('next-combo-btn');

    if (bar) bar.style.width = `${Math.round((st.currentIndex / st.data.length) * 100)}%`;
    if (ind) ind.textContent = `문제 ${st.currentIndex + 1} / ${st.data.length}`;
    if (catEl) catEl.textContent = `과목${q.subject} · ㄱㄴㄷ 조합형`;
    // 복수정답형 규칙: 출처·인용은 문제 서두에 명기 (stem 앞 표시)
    if (citEl) citEl.textContent = q.citation || '';
    if (stemEl) stemEl.innerHTML = safeTextWithBreaks(q.stem || '');
    if (feedback) feedback.classList.add('is-hidden');
    if (nextBtn) nextBtn.classList.add('is-hidden');

    if (stmtsEl) {
        stmtsEl.innerHTML = q.statements.map(s =>
            `<div class="combo-stmt" data-stmt-id="${esc(s.id)}">
                <span class="combo-stmt-id">${esc(s.id)}</span>
                <span class="combo-stmt-text">${safeTextWithBreaks(s.text)}</span>
                <span class="combo-judge-btns" role="group" aria-label="진술 ${esc(s.id)} 판정">
                    <button type="button" class="combo-judge-btn" data-v="true" aria-pressed="false" title="이 진술이 맞다">O</button>
                    <button type="button" class="combo-judge-btn" data-v="false" aria-pressed="false" title="이 진술이 틀리다">X</button>
                </span>
            </div>`).join('');
        stmtsEl.querySelectorAll('.combo-judge-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleComboJudgment(btn));
        });
        updateComboJudgeHint(q);
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

/** 진술 O/X 토글 — 같은 버튼 재클릭 시 해제 */
function toggleComboJudgment(btn) {
    const st = state.trainer.combo;
    const q = st.data[st.currentIndex];
    if (!q) return;
    const row = btn.closest('.combo-stmt');
    const stmtId = row && row.dataset.stmtId;
    if (!stmtId) return;
    const val = btn.dataset.v === 'true';
    if (st.judgments[stmtId] === val) delete st.judgments[stmtId];
    else st.judgments[stmtId] = val;
    row.querySelectorAll('.combo-judge-btn').forEach(b => {
        const on = st.judgments[stmtId] === (b.dataset.v === 'true');
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
    });
    updateComboJudgeHint(q);
}

/** members 집합과 정확히 일치하는 옵션 탐색 */
function findComboOption(q, idSet) {
    return (q.options || []).find(o =>
        (o.members || []).length === idSet.size && o.members.every(m => idSet.has(m)));
}

/** 판정 진행 힌트 + 제출 버튼 활성화 갱신 + 판정과 모순되는 선지 소거 표시 (전략 ⑦) */
function updateComboJudgeHint(q) {
    const st = state.trainer.combo;
    const hint = document.getElementById('combo-judge-hint');
    const submitBtn = document.getElementById('combo-judge-submit');
    const total = q.statements.length;
    const judged = Object.keys(st.judgments).length;

    // 확실한 진술로 소거: 판정과 모순되는 선지를 흐리게 — "ㄴ이 거짓이면 ㄴ 포함 선지 소거" 전술 훈련
    const optsEl = document.getElementById('combo-options-container');
    let eliminated = 0;
    if (optsEl && judged > 0) {
        optsEl.querySelectorAll('.limits-opt-btn').forEach((btn, idx) => {
            const opt = q.options[idx];
            const elim = opt && Object.entries(st.judgments).some(([sid, val]) =>
                val ? !(opt.members || []).includes(sid) : (opt.members || []).includes(sid));
            btn.classList.toggle('eliminated', !!elim);
            if (elim) eliminated++;
        });
    }

    if (hint) {
        if (judged === 0) {
            hint.textContent = '각 진술을 O/X로 판정한 뒤 제출하거나, 아래에서 조합을 바로 고르세요.';
        } else if (judged < total) {
            hint.textContent = `진술 판정 중… ${judged}/${total}${eliminated ? ` · 선지 ${eliminated}개 소거` : ''}`;
        } else {
            const trueSet = new Set(q.statements.filter(s => st.judgments[s.id]).map(s => s.id));
            const opt = findComboOption(q, trueSet);
            const label = [...trueSet].join(',') || '(없음)';
            hint.textContent = opt
                ? `판정 조합 ${label} — 선지 ${OPTION_INDICATORS[q.options.indexOf(opt)]}와 일치합니다.`
                : `판정 조합 ${label} — 일치하는 선지가 없습니다.`;
        }
    }
    if (submitBtn) /** @type {HTMLButtonElement} */ (submitBtn).disabled = judged < total;
}

/** 2단계 응시: 전 진술 판정 후 제출 — 판정 집합과 일치하는 선지로 응답 (없으면 판정만 제출) */
export function submitComboJudgments() {
    const st = state.trainer.combo;
    const q = st.data[st.currentIndex];
    if (!q) return;
    if (q.statements.some(s => !(s.id in st.judgments))) {
        showToast('모든 진술을 O/X로 판정해 주세요.', 'warning');
        return;
    }
    const trueSet = new Set(q.statements.filter(s => st.judgments[s.id]).map(s => s.id));
    const opt = findComboOption(q, trueSet);
    submitComboAnswer(null, opt ? opt.id : null, opt ? q.options.indexOf(opt) : -1);
}

function submitComboAnswer(selectedBtn, optId, optIdx) {
    const st = state.trainer.combo;
    const q = st.data[st.currentIndex];
    if (!q) return;

    const judgments = Object.keys(st.judgments || {}).length ? st.judgments : undefined;
    const res = gradeAnswer(q, { optionId: optId, judgments });
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
            btn.classList.remove('eliminated');
            if (idx === correctIdx) btn.classList.add('correct');
        });
    }
    if (!isCorrect && selectedBtn) selectedBtn.classList.add('incorrect');
    else st.correctCount++;

    // 진술 판정 버튼 잠금 (제출 후 변경 불가)
    const stmtsArea = document.getElementById('combo-statements');
    if (stmtsArea) stmtsArea.querySelectorAll('.combo-judge-btn').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
    const judgeSubmit = /** @type {HTMLButtonElement|null} */ (document.getElementById('combo-judge-submit'));
    if (judgeSubmit) judgeSubmit.disabled = true;

    // 판정 모드(선지 미일치)일 때는 판정 조합 자체를 선택 라벨로 표시
    const judgedSet = judgments
        ? q.statements.filter(s => judgments[s.id]).map(s => s.id).join(',')
        : null;
    const selectedLabel = optIdx >= 0
        ? (OPTION_INDICATORS[optIdx] || optId)
        : (judgedSet !== null ? `판정(${judgedSet || '없음'})` : '—');
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

export function nextComboDrill() { nextDrill('combo'); }

export function renderComboResult() {
    const st = state.trainer.combo;
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

    const reviewHTML = misjudged.length === 0
        ? '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 진술을 정확히 판정했습니다!</p>'
        : `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오판 진술 리뷰 (${misjudged.length}개)</h3>` +
          misjudged.map(p => `
            <div style="padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
                <p style="font-size:0.85rem; margin-bottom:0.4rem;"><strong>${esc(p.id)}</strong> — 정답 ${p.truth ? 'O' : 'X'}, 내 판정 ${p.userJudged ? 'O' : 'X'}</p>
                ${p.text ? `<p style="font-size:0.9rem; margin-bottom:0.4rem;">${safeTextWithBreaks(p.text)}</p>` : ''}
                ${p.explain ? `<p style="font-size:0.85rem; color:var(--color-text-muted);">${safeTextWithBreaks(p.explain)}</p>` : ''}
                ${p.sid ? `<button class="btn btn-secondary weak-retry-btn" data-click="startOxDrill" data-arg="sid:${esc(p.sid)}"><i class="fa-solid fa-circle-half-stroke"></i> 이 진술 O/X로 재시도</button>` : ''}
            </div>`).join('');
    renderDrillResult('combo',
        `누적 취약 진술: ${weakCount}개 · 이번 세션 오판 진술: ${misjudged.length}개`,
        reviewHTML, misjudged.length > 0);
}

