// src/views/trainer-drills.js — O/X 판정 드릴 + 복수정답형(combo) 드릴
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
import { recordStatementJudgments, getWeakStatements, getDueStatementSids, getAllStatementStats, getAnomalousStatements, WEAK_GRADUATE_STREAK } from '../statement-tracker.js';
import { recordStudyActivity } from '../study-tracker.js';
import { proFeatureNotice } from '../pro-upgrade.js';
import { switchView } from './navigation.js';

const DRILL_COUNT = 10;
const OPTION_INDICATORS = ['①', '②', '③', '④', '⑤'];

// 출제 수 설정 — 10/20/'all' (두 드릴 setup의 칩에서 공유)
let drillCountSetting = DRILL_COUNT;

/** 출제 수 칩 전환 — data-arg: '10' | '20' | 'all' */
export function setDrillCount(v) {
    drillCountSetting = v === 'all' ? 'all' : (parseInt(v, 10) || DRILL_COUNT);
    document.querySelectorAll('.drill-count-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.arg === String(v));
    });
}

function drillCountFor(items) {
    return drillCountSetting === 'all' ? items.length : drillCountSetting;
}

/**
 * 복습 대상 배지 갱신 — SM-2 기한 도래 진술 수를 트레이너 카드·드릴 setup에 표시
 * 트레이너 메뉴/드릴 setup을 열 때마다 호출해 "오늘 할 일"을 시각화한다.
 */
export function updateDueBadges() {
    const dueCount = getDueStatementSids().length;
    const weakCount = getWeakStatements().length;
    const label = dueCount > 0 ? `오늘 복습 대상 ${dueCount}개` : (weakCount > 0 ? `취약 ${weakCount}개` : '');
    ['oxdrill-due-badge', 'combo-due-badge', 'weak-due-badge'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = label;
        el.classList.toggle('is-hidden', !label);
    });
    ['oxdrill-due-count', 'combo-due-count'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = dueCount > 0
            ? `📅 복습 기한 도래 진술 ${dueCount}개 — 우선 출제됩니다`
            : '오늘 복습 기한 도래 진술이 없습니다';
    });
}

/* =======================================================
   ⭕❌ O/X 판정 드릴
   ======================================================= */

/** 과목 버튼 그리드 동적 생성 — registry.subjects 기반 (과목 수/이름은 시험별 manifest가 결정) */
function renderDrillSubjectButtons(gridId, clickAction) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const subjects = DataLoader.getSubjectList();
    grid.innerHTML = subjects.map(s =>
        `<button class="btn btn-secondary" data-click="${clickAction}" data-arg="${s.order}" style="padding:1rem;">${s.order}과목<br><small>${esc(s.shortName || s.name)}</small></button>`
    ).join('');
}

const NUM_FOCUS_TAGS = new Set(['수치', '한도', '기한', '구성비', '처분기준']);

/* =======================================================
   드릴 타입 공통 설정 — O/X · 복수정답형은 setup→arena→result 골격이 동일하고
   문항 렌더/제출만 다르므로 타입별 설정으로 파이프라인을 공유한다.
   ======================================================= */
const DRILL_TYPES = {
    ox: {
        subView: 'oxdrill',
        label: 'O/X',
        title: 'O/X 드릴',
        ids: { panel: 'trainer-oxdrill-panel', grid: 'oxdrill-subject-grid', setup: 'oxdrill-setup', arena: 'oxdrill-arena', result: 'oxdrill-result' },
        otherPanels: ['trainer-menu-panel', 'trainer-weak-panel', 'trainer-combo-panel'],
        startAction: 'startOxDrill',
        stateOf: () => state.trainer.oxdrill,
        load: (n) => DataLoader.loadOxDrills(n),
        sidsOf: (i) => [i.sid],
        initState: (st) => {},
        renderQuestion: () => renderOxDrillQuestion(),
        renderResult: () => renderOxDrillResult(),
        // 특수 모드: 'weak'=취약·복습 진술만(전 과목), 'num'=수치 집중(전 과목),
        // 'concept:<cid>'=혼동쌍 집중, 'sid:<sid>'=단건 재시도
        isSpecial: (s) => s === 'weak' || s === 'num' || s.startsWith('concept:') || s.startsWith('sid:'),
        filterSpecial: (items, special) => {
            const conceptMatch = special.match(/^concept:(.+)$/);
            const sidMatch = special.match(/^sid:(.+)$/);
            if (special === 'weak') {
                const weakSids = new Set(getWeakStatements().map(w => w.sid));
                const dueSids = new Set(getDueStatementSids());
                return items.filter(i => i.sid && (weakSids.has(i.sid) || dueSids.has(i.sid)));
            }
            if (special === 'num') {
                return items.filter(i => (i.tags || []).some(t => NUM_FOCUS_TAGS.has(t)));
            }
            if (conceptMatch) {
                // 해당 conceptId의 취약(졸업 포함) 진술 sids로 O/X 문항 필터
                const cid = conceptMatch[1];
                const sids = new Set(getWeakStatements(undefined, true)
                    .filter(w => w.cid === cid).map(w => w.sid));
                return items.filter(i => i.sid && sids.has(i.sid));
            }
            if (sidMatch) {
                return items.filter(i => i.sid === sidMatch[1]);
            }
            return items;
        }
    },
    combo: {
        subView: 'combo',
        label: '복수정답형',
        title: '복수정답형 드릴',
        ids: { panel: 'trainer-combo-panel', grid: 'combo-subject-grid', setup: 'combo-setup', arena: 'combo-arena', result: 'combo-result' },
        otherPanels: ['trainer-menu-panel', 'trainer-weak-panel', 'trainer-oxdrill-panel'],
        startAction: 'startComboDrill',
        stateOf: () => state.trainer.combo,
        load: (n) => DataLoader.loadComboDrills(n),
        sidsOf: (q) => (q.statements || []).map(s => s.sid),
        initState: (st) => { st.judgments = {}; },
        renderQuestion: () => renderComboQuestion(),
        renderResult: () => renderComboResult(),
        isSpecial: (s) => s === 'weak' || s === 'num',
        filterSpecial: (items, special) => {
            if (special === 'weak') {
                const weakSids = new Set(getWeakStatements().map(w => w.sid));
                const dueSids = new Set(getDueStatementSids());
                return items.filter(q => (q.statements || []).some(s =>
                    s.sid && (weakSids.has(s.sid) || dueSids.has(s.sid))));
            }
            if (special === 'num') {
                return items.filter(q => (q.tags || []).some(t => NUM_FOCUS_TAGS.has(t)));
            }
            return items;
        }
    }
};

/** 패널 열기 (과목 선택 화면) — 두 드릴 공통 골격 */
function openDrillSetup(type) {
    const cfg = DRILL_TYPES[type];
    state.trainer.activeSubView = cfg.subView;
    renderDrillSubjectButtons(cfg.ids.grid, cfg.startAction);
    const menu = document.getElementById('trainer-menu-panel');
    const panel = document.getElementById(cfg.ids.panel);
    const setup = document.getElementById(cfg.ids.setup);
    const arena = document.getElementById(cfg.ids.arena);
    const result = document.getElementById(cfg.ids.result);
    if (menu) menu.classList.add('is-hidden');
    if (panel) panel.classList.remove('is-hidden');
    if (setup) setup.classList.remove('is-hidden');
    if (arena) arena.classList.add('is-hidden');
    if (result) result.classList.add('is-hidden');
    updateDueBadges();
}

/**
 * 드릴 시작 공통 골격 — 취약 진술 우선 편성 + 특수 모드 필터
 * @param {'ox'|'combo'} type
 * @param {string|number} subjectNum 과목 order 번호 또는 특수 모드 문자열
 */
function startDrill(type, subjectNum) {
    const cfg = DRILL_TYPES[type];
    const special = String(subjectNum);
    const isSpecial = cfg.isSpecial(special);
    const num = parseInt(subjectNum, 10);
    const subjectOrders = DataLoader.getSubjectOrders();
    if (!isSpecial && (isNaN(num) || !subjectOrders.includes(num))) return;
    // 취약 리뷰 등 다른 서브뷰에서 호출돼도 자기 패널을 표시한다
    cfg.otherPanels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('is-hidden');
    });
    const ownPanel = document.getElementById(cfg.ids.panel);
    if (ownPanel) ownPanel.classList.remove('is-hidden');
    state.trainer.activeSubView = cfg.subView;

    const load = isSpecial
        ? Promise.all(subjectOrders.map(n => cfg.load(n))).then(all => all.flat())
        : cfg.load(num);
    load.then(items => {
        const st = cfg.stateOf();
        st.subject = isSpecial ? 0 : num;
        st.mode = isSpecial ? special : '';
        items = cfg.filterSpecial(items, special);
        st.data = pickPrioritized(items, drillCountFor(items), cfg.sidsOf);
        st.currentIndex = 0;
        st.correctCount = 0;
        st.solvedList = [];
        cfg.initState(st);

        if (st.data.length === 0) {
            showToast(isSpecial ? '이 조건에 맞는 문항이 없습니다.' : `이 과목에는 출제 가능한 ${cfg.label} 문항이 없습니다.`, 'warning');
            return;
        }

        const setup = document.getElementById(cfg.ids.setup);
        const arena = document.getElementById(cfg.ids.arena);
        const result = document.getElementById(cfg.ids.result);
        if (setup) setup.classList.add('is-hidden');
        if (result) result.classList.add('is-hidden');
        if (arena) arena.classList.remove('is-hidden');
        cfg.renderQuestion();
    }).catch(err => {
        console.error(err);
        showToast(`${cfg.label} 드릴 데이터를 불러오지 못했습니다.`, 'error');
    });
}

/** 다음 문항으로 진행 — 두 드릴 공통 골격 */
function nextDrill(type) {
    const cfg = DRILL_TYPES[type];
    const st = cfg.stateOf();
    st.currentIndex++;
    if (st.currentIndex >= st.data.length) cfg.renderResult();
    else cfg.renderQuestion();
}

/**
 * 드릴 결과 화면 공통 골격 — 점수/통계 라인 + 리뷰 목록 + 액션 버튼.
 * @param {'ox'|'combo'} type
 * @param {string} statLine 취약 진술 통계 문구 (HTML)
 * @param {string} reviewInnerHTML 리뷰 항목 HTML
 * @param {boolean} hasReviewItems 취약 리뷰 버튼 표시 여부
 */
function renderDrillResult(type, statLine, reviewInnerHTML, hasReviewItems) {
    const cfg = DRILL_TYPES[type];
    const st = cfg.stateOf();
    const arena = document.getElementById(cfg.ids.arena);
    const result = document.getElementById(cfg.ids.result);
    if (arena) arena.classList.add('is-hidden');
    if (!result) return;
    result.classList.remove('is-hidden');

    const total = st.data.length;
    const rate = total > 0 ? Math.round((st.correctCount / total) * 100) : 0;

    result.innerHTML = `
        <div class="trainer-arena" style="text-align:center;">
            <i class="fa-solid fa-trophy trophy-icon"></i>
            <h2>${cfg.title} 완료!</h2>
            <p class="result-score-summary">정답수: <strong>${st.correctCount}</strong> / ${total} (${rate}%)</p>
            <p style="color:var(--color-text-muted); font-size:0.85rem;">${statLine}</p>
            <div style="text-align:left; margin:1.5rem 0; max-width:600px; margin-left:auto; margin-right:auto;">
                ${reviewInnerHTML}
            </div>
            <div class="result-actions" style="display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;">
                <button class="btn btn-primary" data-click="${cfg.startAction}" data-arg="${st.mode || st.subject}"><i class="fa-solid fa-rotate-left"></i> 다시 풀기</button>
                ${hasReviewItems ? '<button class="btn btn-warning" data-click="openWeakReview"><i class="fa-solid fa-crosshairs"></i> 취약 진술 리뷰</button>' : ''}
                <button class="btn btn-secondary" data-click="exitTrainerSubView"><i class="fa-solid fa-house"></i> 메뉴로</button>
            </div>
        </div>`;
}

/**
 * 기한 도래 진술(SM-2) → 오판 진술 순으로 최대 절반까지 우선 편성, 나머지는 무작위.
 * @param {Function} sidsOf 문항 → sid 배열 (ox는 [i.sid], combo는 진술 sids)
 */
function pickPrioritized(items, count, sidsOf) {
    const dueSids = new Set(getDueStatementSids());
    const weakSids = new Set(getWeakStatements().map(w => w.sid));
    const hit = (i, set) => sidsOf(i).some(s => s && set.has(s));
    const due = items.filter(i => hit(i, dueSids));
    const weak = items.filter(i => !hit(i, dueSids) && hit(i, weakSids));
    const rest = items.filter(i => !hit(i, dueSids) && !hit(i, weakSids));
    const picked = [...shuffle(due), ...shuffle(weak)].slice(0, Math.ceil(count / 2));
    return shuffle([...picked, ...shuffle(rest).slice(0, count - picked.length)]);
}

/** 패널 열기 (과목 선택 화면) */
export function openOxDrillSetup() { openDrillSetup('ox'); }

/**
 * 과목별 O/X 드릴 시작 — 취약 진술(sid) 우선 편성
 * @param {string|number} subjectNum 1~4
 */
export function startOxDrill(subjectNum) { startDrill('ox', subjectNum); }

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
    // text/truth도 함께 저장해 취약 진술 리뷰에서 원문을 표시한다
    recordStatementJudgments([{ sid: q.sid, judgedCorrect: isCorrect, text: q.statement, truth: q.truth }]);
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

export function nextOxDrill() { nextDrill('ox'); }

function renderOxDrillResult() {
    const st = state.trainer.oxdrill;
    const wrong = st.solvedList.filter(s => !s.correct);
    const weakCount = getWeakStatements().length;
    const reviewHTML = wrong.length === 0
        ? '<p style="text-align:center; color:var(--color-success); font-weight:600;"><i class="fa-solid fa-circle-check"></i> 모든 문제를 맞혔습니다!</p>'
        : `<h3 style="margin-bottom:0.75rem; font-size:1.1rem;"><i class="fa-solid fa-triangle-exclamation"></i> 오답 리뷰 (${wrong.length}문제)</h3>` +
          wrong.map((s, i) => `
            <div style="padding:0.75rem; margin-bottom:0.5rem; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card);">
                <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:0.3rem;">Q${i + 1}</div>
                <p style="font-size:0.9rem; margin-bottom:0.4rem;">${safeTextWithBreaks(s.question)}</p>
                <p style="font-size:0.85rem; color:var(--color-danger);">내 답: ${esc(s.selected)}</p>
                <p style="font-size:0.85rem; color:var(--color-success);">정답: <strong>${esc(s.correctAnswer)}</strong></p>
            </div>`).join('');
    renderDrillResult('ox',
        `누적 취약 진술: ${weakCount}개 (오판 진술은 다음 세션에 우선 출제됩니다)`,
        reviewHTML, wrong.length > 0);
}

/* =======================================================
   ㄱㄴㄷㄹ 복수정답형(combo) 드릴
   ======================================================= */

/** 패널 열기 (과목 선택 화면) */
export function openComboDrillSetup() {
  proFeatureNotice('combo_drill', '복수정답형 훈련');
  openDrillSetup('combo');
}

/**
 * 과목별 복수정답형 드릴 시작 — 취약 진술(sid) 포함 문항 우선 편성
 * @param {string|number} subjectNum 과목 order 번호
 */
export function startComboDrill(subjectNum) { startDrill('combo', subjectNum); }

function renderComboQuestion() {
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
    if (catEl) catEl.textContent = `과목${q.subject} · 복수정답형`;
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
    if (submitBtn) submitBtn.disabled = judged < total;
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

    const judgments = Object.keys(st.judgments || {}).length ? st.judgments : null;
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
    if (stmtsArea) stmtsArea.querySelectorAll('.combo-judge-btn').forEach(b => { b.disabled = true; });
    const judgeSubmit = document.getElementById('combo-judge-submit');
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

function renderComboResult() {
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

/* =======================================================
   🎯 취약 진술 리뷰 — 누적 오판 진술 열람 + 개념 그룹핑
   ======================================================= */

/** sid → 과목 번호 (생성형 과목키 prefix 또는 파일럿 st-0N- 형식) */
function sidSubject(sid) {
    const s = String(sid || '');
    const p = s.match(/^st-0(\d)-/);
    if (p) return parseInt(p[1], 10);
    // sid 접두사(과목키)를 활성 시험 레지스트리의 subjects[].key로 해석
    const m = s.match(/^([a-z][a-z0-9]*)_/);
    if (m) {
        const subjects = (DataLoader.registry && DataLoader.registry.subjects) || [];
        const hit = subjects.find(sub => sub.key === m[1]);
        if (hit) return hit.order;
    }
    return null;
}

/** 취약 진술 패널 열기 */
/** 맞춤 학습 리포트 뷰 → 취약 진술 리뷰 딥링크 (훈련소 뷰 전환 후 패널 오픈) */
export function gotoWeakReview() {
    switchView('trainer-view');
    openWeakReview();
}

export function openWeakReview() {
    state.trainer.activeSubView = 'weak';
    const menu = document.getElementById('trainer-menu-panel');
    const panel = document.getElementById('trainer-weak-panel');
    if (menu) menu.classList.add('is-hidden');
    if (panel) panel.classList.remove('is-hidden');
    renderWeakReview();
}

let weakFilter = 'all'; // 'all' | 'due' — 취약 리뷰 필터

/** 취약 리뷰 필터 전환 */
export function setWeakFilter(filter) {
    weakFilter = filter === 'due' ? 'due' : 'all';
    renderWeakReview();
}

/** 취약 진술 행 렌더 — O/X 배지·과목·복습 대상·오판 통계·최근 판정 */
function weakRow(w, due, anomalies) {
    const sub = sidSubject(w.sid);
    const dueBadge = due.has(w.sid) ? '<span class="weak-due-badge">복습 대상</span>' : '';
    // 이상 의심: 판정 누적 후에도 오판율 극단 — 진술 표현/진위 자체 검수 후보
    const anomalyBadge = anomalies && anomalies.has(w.sid)
        ? '<span class="weak-anomaly" title="오판율이 극단적으로 높아 문항 자체 검수가 필요할 수 있습니다">이상 의심</span>' : '';
    const lastBadge = w.last === true ? '<span class="weak-last is-ok">최근 정답</span>'
        : w.last === false ? '<span class="weak-last is-bad">최근 오판</span>' : '';
    return `<div class="weak-row">
        <div class="weak-row-head">
            <span class="weak-truth ${w.truth ? 'is-o' : 'is-x'}">${w.truth === true ? 'O' : w.truth === false ? 'X' : '?'}</span>
            ${sub ? `<span class="weak-subject">과목${sub}</span>` : ''}
            ${dueBadge}${lastBadge}${anomalyBadge}
            <span class="weak-stat">오판 ${w.w}회 / 판정 ${w.j}회${w.lw ? ` · 최근 ${w.lw}` : ''}</span>
            <button class="btn btn-secondary weak-retry-btn" data-click="startOxDrill" data-arg="sid:${esc(w.sid)}" aria-label="이 진술 O/X로 재시도"><i class="fa-solid fa-rotate"></i> 재시도</button>
        </div>
        <p class="weak-text">${safeTextWithBreaks(w.t || `(${w.sid})`)}</p>
    </div>`;
}

function renderWeakReview() {
    const listEl = document.getElementById('weak-list');
    const summaryEl = document.getElementById('weak-summary');
    if (!listEl) return;

    const weak = getWeakStatements(); // 졸업(연속 정답) 제외, w 내림차순
    const graduated = getWeakStatements(undefined, true).length - weak.length;
    const due = new Set(getDueStatementSids());
    const anomalyList = getAnomalousStatements();
    const anomalies = new Set(anomalyList.map(a => a.sid));
    const dueCount = weak.filter(w => due.has(w.sid)).length;
    const shown = weakFilter === 'due' ? weak.filter(w => due.has(w.sid)) : weak;

    // 과목별 진술 마스터 진행도 — 판정/취약/졸업 집계 (전략 ③ 목표 시각화)
    const masteryEl = document.getElementById('weak-mastery');
    if (masteryEl) {
        const perSub = {};
        Object.entries(getAllStatementStats()).forEach(([sid, v]) => {
            const sub = sidSubject(sid);
            if (!sub || !v.j) return;
            const m = perSub[sub] || (perSub[sub] = { j: 0, w: 0, g: 0 });
            m.j++;
            if (v.w > 0) {
                if ((v.streak || 0) >= WEAK_GRADUATE_STREAK) m.g++;
                else m.w++;
            }
        });
        masteryEl.innerHTML = `<div class="weak-mastery-grid">` +
            Object.keys(perSub).sort((a, b) => a - b).map(n => {
                const m = perSub[n];
                if (!m.j) return '';
                return `<div class="weak-mastery-cell"><strong>과목${n}</strong><span>판정 ${m.j} · 취약 ${m.w} · 졸업 ${m.g}</span></div>`;
            }).join('') + `</div>`;
    }

    if (summaryEl) {
        summaryEl.innerHTML = weak.length === 0
            ? (graduated > 0 ? '모든 취약 진술을 졸업했습니다.' : '아직 오판 이력이 없습니다. O/X·복수정답형 드릴을 풀면 진술 단위로 추적됩니다.')
            : `취약 진술 ${weak.length}개 · 오늘 복습 대상 ${dueCount}개${graduated ? ` · 졸업 ${graduated}개` : ''}${anomalyList.length ? ` · <span class="weak-anomaly">이상 의심 ${anomalyList.length}개</span>` : ''}
               <span class="weak-toolbar">
                   <button class="btn btn-primary weak-drill-btn" data-click="startOxDrill" data-arg="weak"><i class="fa-solid fa-crosshairs"></i> 취약·복습 드릴</button>
                   <button class="btn btn-secondary weak-filter-btn${weakFilter === 'all' ? ' active' : ''}" data-click="setWeakFilter" data-arg="all">전체</button>
                   <button class="btn btn-secondary weak-filter-btn${weakFilter === 'due' ? ' active' : ''}" data-click="setWeakFilter" data-arg="due">복습 대상만</button>
               </span>`;
    }

    if (shown.length === 0) {
        listEl.innerHTML = `<p style="text-align:center; color:var(--color-text-muted); padding:2rem 0;">${weak.length === 0 ? '기록된 취약 진술이 없습니다.' : '복습 대상 진술이 없습니다.'}</p>`;
        return;
    }

    // conceptId 클러스터링 — 같은 교재 구간(L####)의 진술을 개념 그룹으로 묶음
    const groups = new Map();
    for (const w of shown) {
        const key = w.cid || `solo:${w.sid}`;
        if (!groups.has(key)) groups.set(key, { cid: w.cid, items: [] });
        groups.get(key).items.push(w);
    }
    // 그룹 정렬: 최대 오판 횟수 내림차순
    const sorted = [...groups.values()].sort(
        (a, b) => Math.max(...b.items.map(i => i.w)) - Math.max(...a.items.map(i => i.w)));

    listEl.innerHTML = sorted.map(g => {
        const header = g.cid && g.items.length > 1
            ? `<div class="weak-group-header"><i class="fa-solid fa-link"></i> 개념 ${esc(g.cid)} — 취약 진술 ${g.items.length}개 (혼동쌍 후보)
                <button class="btn btn-secondary weak-retry-btn" data-click="startOxDrill" data-arg="concept:${esc(g.cid)}"><i class="fa-solid fa-bullseye"></i> 이 개념만 드릴</button></div>`
            : '';
        // 혼동쌍 대조: 참·거짓 진술이 섞인 그룹은 2단으로 나란히 배치 (전략 ⑤)
        const oItems = g.items.filter(i => i.truth === true);
        const xItems = g.items.filter(i => i.truth !== true);
        const rows = (oItems.length > 0 && xItems.length > 0)
            ? `<div class="weak-pair">
                <div class="weak-col is-o"><div class="weak-col-head">참 진술</div>${oItems.map(w => weakRow(w, due, anomalies)).join('')}</div>
                <div class="weak-col is-x"><div class="weak-col-head">거짓(함정) 진술</div>${xItems.map(w => weakRow(w, due, anomalies)).join('')}</div>
               </div>`
            : g.items.map(w => weakRow(w, due, anomalies)).join('');
        return `<div class="weak-group">${header}${rows}</div>`;
    }).join('');
}

/* =======================================================
   ⌨️ 드릴 키보드 단축키
   O/X 드릴: O·X 키로 판정 / 복수정답형: 1~5 키로 선지 선택 / Enter: 다음 문제
   ======================================================= */
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
        if (!e || !e.key) return;
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const view = state.trainer && state.trainer.activeSubView;
        const oxArena = document.getElementById('oxdrill-arena');
        const comboArena = document.getElementById('combo-arena');
        const oxActive = view === 'oxdrill' && oxArena && !oxArena.classList.contains('is-hidden');
        const comboActive = view === 'combo' && comboArena && !comboArena.classList.contains('is-hidden');
        if (!oxActive && !comboActive) return;

        if (e.key === 'Enter') {
            const nextBtn = document.getElementById(oxActive ? 'next-oxdrill-btn' : 'next-combo-btn');
            if (nextBtn && !nextBtn.classList.contains('is-hidden')) {
                e.preventDefault();
                nextBtn.click();
            }
            return;
        }
        if (oxActive) {
            const key = e.key.toLowerCase();
            if (key === 'o' || key === 'x') {
                const btn = oxArena.querySelector(`.oxdrill-ox-btn[data-ox="${key.toUpperCase()}"]:not([disabled])`);
                if (btn) { e.preventDefault(); btn.click(); }
            }
        } else if (comboActive) {
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < 5) {
                const btns = comboArena.querySelectorAll('#combo-options-container .limits-opt-btn:not([disabled])');
                if (btns[idx]) { e.preventDefault(); btns[idx].click(); }
            }
        }
    });
}
