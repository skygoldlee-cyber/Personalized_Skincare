// views/exam-sim-review.js — 시뮬레이터 결과 리뷰/요약 (exam-simulator.js에서 추출)
import { simState } from './exam-sim-state.js';
import { esc, safeTextWithBreaks } from '../sanitize.js';
import { DataLoader } from '../data-loader.js';

const OPTION_INDICATORS = ['①', '②', '③', '④', '⑤'];

/**
 * 합답형 진술 정오표 — 실제 O/X vs 내 선택 선지의 포함 여부로 오판 진술을 표시
 * (선택 선지의 members = 사용자가 "참"이라 판정한 집합으로 해석)
 */
function comboTruthTableHTML(q) {
    if (!Array.isArray(q.statements) || !Array.isArray(q.comboOptions)) return '';
    const idx = OPTION_INDICATORS.indexOf(q.userAnswer);
    const chosen = idx >= 0 ? new Set(q.comboOptions[idx].members || []) : null;
    const rows = q.statements.map(s => {
        const inChoice = chosen ? chosen.has(s.id) : null;
        const misjudged = inChoice !== null && inChoice !== !!s.truth;
        return `<div class="combo-truth-row${misjudged ? ' is-misjudged' : ''}">
            <span class="combo-truth-id">${esc(s.id)}</span>
            <span class="combo-truth-actual ${s.truth ? 'is-o' : 'is-x'}">실제 ${s.truth ? 'O' : 'X'}</span>
            <span class="combo-truth-mine">${inChoice === null ? '미응답' : (inChoice ? '참으로 판정' : '거짓으로 판정')}${misjudged ? ' ✗' : ''}</span>
            <span class="combo-truth-text">${safeTextWithBreaks(s.text)}</span>
        </div>`;
    }).join('');
    return `<div class="combo-truth-table"><div class="combo-truth-head">진술 판정 정오표</div>${rows}</div>`;
}

export function showSimAnswerReview() {
    document.getElementById('sim-result-panel').classList.add('is-hidden');
    document.getElementById('sim-review-panel').classList.remove('is-hidden');
    
    const container = document.getElementById('sim-review-list-container');
    container.innerHTML = '';
    
    if (simState.wrongQuestions.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--color-success);"><i class="fa-solid fa-circle-check"></i> 만점입니다! 틀린 문제가 하나도 없습니다.</p>';
        return;
    }
    
    simState.wrongQuestions.forEach((q, idx) => {
        let optionsHTML = '';
        if (q.options && q.options.length > 0) {
            optionsHTML = `<ul class="review-q-options">
                ${q.options.map(opt => `<li>${esc(opt)}</li>`).join('')}
            </ul>`;
        }
        if (q.type === 'combo') optionsHTML += comboTruthTableHTML(q);
        
        const itemHTML = `
            <div class="sim-review-item">
                <div class="review-item-header">
                    <span class="badge badge-quiz-cat">Q ${q.num}</span>
                    <span class="badge badge-quiz-type">${q.type === 'choice' ? '객관식' : q.type === 'ox' ? '진위형' : q.type === 'combo' ? '합답형' : '단답형'}</span>
                </div>
                <p class="review-item-q-text">${safeTextWithBreaks(q.question)}</p>
                ${optionsHTML}
                <div class="review-answer-panel">
                    <p>❌ 내가 쓴 답: <strong class="color-danger">${esc(q.userAnswer || '(공란)')}</strong></p>
                    <p>✅ 올바른 정답: <strong class="color-success">${esc(q.answer)}</strong></p>
                </div>
                <div class="review-explanation-panel">
                    <h5>정답 해설 및 분석</h5>
                    <p>${safeTextWithBreaks(q.explanation)}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

export function showSimResultsSummary() {
    document.getElementById('sim-review-panel').classList.add('is-hidden');
    document.getElementById('sim-result-panel').classList.remove('is-hidden');
}

/**
 * 문항 → 단원(챕터) 제목 매핑. 합답형은 원문항 출처 또는 인용 라인으로 역추적.
 * @param {Object} q
 * @param {string} subjKey
 * @param {{questions: Object, ranges: Object}} qc question_chapters 인덱스
 * @returns {string|null}
 */
export function chapterForQuestion(q, subjKey, qc) {
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

/**
 * 제출 후 결과 패널(점수 + 과목별/단원별 분석 + 과락·합격 피드백)을 렌더링한다.
 * @param {Object} opts
 * @param {number} opts.score
 * @param {number} opts.total
 * @param {Object<string,{score:number,total:number}>} opts.subjectScores
 * @param {Object<string,Object<string,{score:number,total:number}>>} opts.chapterStats
 * @param {Array} opts.subjects 레지스트리 과목 목록
 */
export function renderSimResultBreakdown({ score, total, subjectScores, chapterStats, subjects }) {
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
    if (!breakdownContainer) return;
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
