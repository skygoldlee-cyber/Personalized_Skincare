// src/views/quiz-wrong-cause.js - 오답 원인 태깅·재학습 액션
// @spec AN-02
import { state, saveProgress } from '../state.js';
import { esc } from '../sanitize.js';
import { switchView } from './navigation.js';
import { getWrongCauseLabels, getWrongCauseAdvice } from '../recommendations.js';
import { weakItemKey, resolveWrongQuiz, subjectForWeakItem } from '../weak-items.js';
import { trackAction } from '../usage-stats.js';
import { startSubjectReader } from './dashboard.js';
import { shuffle } from '../utils.js';
import { showToast } from '../ui-utils.js';
import { _beginQuizRun, renderQuizResult } from './quiz.js';

/* =======================================================
   오답 원인 태깅 + 재학습 연결 (docs/report_archive/FEATURE_PROPOSALS.md §4.2)
   ======================================================= */

/**
 * 오답 원인 저장 + 원인별 즉시 재학습 사이드 이펙트.
 * memorize는 관련 플래시카드를 weakCards에 추가한다.
 */
function _storeCause(quizId, cause) {
    if (!(cause in getWrongCauseLabels())) return;
    const itemId = weakItemKey(quizId);
    state.wrongCauses[itemId] = {
        cause: cause,
        ts: Date.now(),
        subjectId: subjectForWeakItem(itemId, state.quiz.subject)
    };
    if (cause === 'memorize') _addRelatedCardToWeak(quizId);
    saveProgress();
}

/**
 * 퀴즈의 [용어: X] 컨텍스트에서 관련 카드를 찾아 weakCards에 추가한다.
 */
function _addRelatedCardToWeak(quizId) {
    const resolved = resolveWrongQuiz(quizId);
    if (!resolved || !window.STUDY_DATA) return;
    const termMatch = /\[용어:\s*(.+?)\s*\]/.exec(resolved.quiz.context || '');
    if (!termMatch) return;
    const card = (window.STUDY_DATA[resolved.subjectId].cards || []).find(c => c.term === termMatch[1]);
    if (card) state.weakCards.add(card.id);
}

/**
 * 원인별 재학습 추천 UI HTML.
 */
function _causeRecoHtml(cause, quizId) {
    const itemId = weakItemKey(quizId);
    const subjId = subjectForWeakItem(itemId, state.quiz.subject);
    switch (cause) {
        case 'memorize':
            return `<i class="fa-solid fa-lightbulb"></i> 관련 플래시카드를 복습 노트에 추가했습니다.
                <button type="button" class="wrong-relearn-btn" data-click="wrongActionCard" data-args='["${esc(itemId)}"]'>복습 노트 보기</button>`;
        case 'concept':
            return `<i class="fa-solid fa-book-open"></i> 개념을 교재에서 다시 확인해 보세요.
                <button type="button" class="wrong-relearn-btn" data-click="wrongActionTextbook" data-args='["${esc(subjId)}"]'>교재 보기</button>
                <button type="button" class="wrong-relearn-btn" data-click="wrongActionSimilar" data-args='["${esc(quizId)}"]'>유사 문제</button>`;
        case 'calc':
            return `<i class="fa-solid fa-calculator"></i> 같은 유형의 문제로 다시 연습해 보세요.
                <button type="button" class="wrong-relearn-btn" data-click="wrongActionSimilar" data-args='["${esc(quizId)}"]'>유사 문제 풀기</button>`;
        default: {
            // 시험별 확장 원인 (manifest analysis.wrongCauses) — 선언된 조언이 있으면 표시
            const advice = getWrongCauseAdvice(cause);
            if (!advice) return '';
            return `<i class="fa-solid fa-lightbulb"></i> ${esc(advice)}
                <button type="button" class="wrong-relearn-btn" data-click="wrongActionTextbook" data-args='["${esc(subjId)}"]'>교재 보기</button>
                <button type="button" class="wrong-relearn-btn" data-click="wrongActionSimilar" data-args='["${esc(quizId)}"]'>유사 문제</button>`;
        }
    }
}

/**
 * 피드백 패널에서 현재 문제의 오답 원인을 태깅한다. (data-click)
 */
export function tagWrongCause(cause) {
    const quizState = state.quiz;
    const currentQuiz = quizState.data[quizState.currentIndex];
    if (!currentQuiz) return;
    _storeCause(currentQuiz.id, cause);

    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    if (!feedbackPanel) return;
    const causeKeys = Object.keys(getWrongCauseLabels());
    feedbackPanel.querySelectorAll('.wrong-cause-btn').forEach((btn, i) => {
        btn.classList.toggle('active', causeKeys[i] === cause);
    });
    const reco = feedbackPanel.querySelector('.wrong-cause-reco');
    if (reco) {
        reco.classList.remove('is-hidden');
        reco.innerHTML = _causeRecoHtml(cause, currentQuiz.id);
    }
}

/**
 * 결과 화면 오답 아이템에서 원인을 태깅한다. (data-args: [quizId, cause])
 */
export function tagWrongCauseAt(quizId, cause) {
    _storeCause(quizId, cause);
    renderQuizResult();
}

/**
 * 오답 항목을 복습 노트로 연다. (data-args: [itemId])
 */
export function wrongActionCard(itemId) {
    trackAction('weak_to_card');
    state.weakCards.add(itemId);
    state.reviewFilter = 'all';
    saveProgress();
    switchView('review-view', { scrollTop: true });
}

/**
 * 오답 항목의 과목 교재로 이동한다. (data-args: [subjectId])
 */
export function wrongActionTextbook(subjId) {
    trackAction('weak_to_textbook');
    startSubjectReader(subjId);
}

/**
 * 오답 문제와 같은 단원의 유사 문제로 퀴즈를 시작한다. (data-args: [quizId])
 */
export function wrongActionSimilar(quizId) {
    trackAction('weak_to_similar');
    const resolved = resolveWrongQuiz(quizId);
    if (!resolved) {
        showToast('원본 문제를 찾지 못했습니다.', 'warning');
        return;
    }
    const { quiz, subjectId } = resolved;
    const pool = ((window.STUDY_DATA || {})[subjectId].quizzes || [])
        .filter(q => q.category === quiz.category && q.id !== quiz.id);
    if (pool.length === 0) {
        showToast('같은 단원에 유사 문제가 없습니다.', 'info');
        return;
    }
    state.quiz.subject = subjectId;
    state.quiz.data = shuffle(pool).slice(0, 10);
    state.quiz.diagnostic = false;
    switchView('quiz-view', { scrollTop: true });
    _beginQuizRun();
}

