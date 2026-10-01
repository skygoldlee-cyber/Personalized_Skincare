// src/app-dashboard.js — 대시보드 셀렉트·시험 카드·리소스 카드·스토리지 경고 (app.js에서 분리)
// @spec D-02,D-04,D-05,D-06,ES-01
import { esc } from "./sanitize.js";
import { DataLoader } from "./data-loader.js";
import { contentPath } from "./exam-context.js";
import { refreshProBadges } from "./pro-upgrade.js";
import { state } from "./state.js";

// --- 초기화 및 로컬스토리지 로드 ---
export function populateSubjectSelects() {
    const subjects = (typeof DataLoader !== 'undefined' && DataLoader.registry)
        ? DataLoader.getSubjectList()
        : [];

    // 1. Flashcard subject select
    const fcSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('fc-subject-select'));
    if (fcSelect) {
        const prevVal = fcSelect.value || state.flashcards.subject;
        fcSelect.innerHTML = '';
        subjects.forEach(subj => {
            const option = document.createElement('option');
            option.value = subj.key;
            option.textContent = subj.name;
            fcSelect.appendChild(option);
        });
        if (prevVal && fcSelect.querySelector(`option[value="${prevVal}"]`)) {
            fcSelect.value = prevVal;
            state.flashcards.subject = prevVal;
        } else if (subjects.length > 0) {
            fcSelect.value = subjects[0].key;
            state.flashcards.subject = subjects[0].key;
        }
    }

    // 2. Quiz subject select
    const quizSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('quiz-subject-select'));
    if (quizSelect) {
        const prevVal = quizSelect.value || state.quiz.subject;
        quizSelect.innerHTML = '';
        subjects.forEach(subj => {
            const option = document.createElement('option');
            option.value = subj.key;
            option.textContent = subj.name;
            quizSelect.appendChild(option);
        });
        if (prevVal && quizSelect.querySelector(`option[value="${prevVal}"]`)) {
            quizSelect.value = prevVal;
            state.quiz.subject = prevVal;
        } else if (subjects.length > 0) {
            quizSelect.value = subjects[0].key;
            state.quiz.subject = subjects[0].key;
        }
    }

    // 3. Review view filter buttons
    const reviewFilterGroup = document.getElementById('review-filter-group');
    if (reviewFilterGroup) {
        reviewFilterGroup.innerHTML = `
            <button class="btn btn-secondary filter-btn active" data-filter="all" data-click="setReviewFilter" data-arg="all" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border-radius: 4px; background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-brand);">전체</button>
        `;
        subjects.forEach((subj, idx) => {
            const shortName = subj.shortName || subj.name;
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary filter-btn';
            btn.setAttribute('data-filter', subj.key);
            btn.setAttribute('data-click', 'setReviewFilter');
            btn.setAttribute('data-arg', subj.key);
            btn.textContent = `${idx + 1}과목 (${shortName})`;
            reviewFilterGroup.appendChild(btn);
        });
    }

    // 4. Textbook filter buttons
    const tbFilterGroup = document.getElementById('textbook-filter-buttons');
    if (tbFilterGroup) {
        tbFilterGroup.innerHTML = `
            <button class="btn btn-secondary active-filter" data-filter="all" data-click="setTextbookFilter" data-arg="all">전체 과목</button>
        `;
        subjects.forEach((subj, idx) => {
            const shortName = subj.shortName || subj.name;
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.setAttribute('data-filter', subj.key);
            btn.setAttribute('data-click', 'setTextbookFilter');
            btn.setAttribute('data-arg', subj.key);
            btn.textContent = `${idx + 1}과목 (${shortName})`;
            tbFilterGroup.appendChild(btn);
        });
    }
}

const EXAM_BADGE_COLORS = ['badge-cyan', 'badge-violet', 'badge-emerald', 'badge-amber', 'badge-rose', 'badge-indigo'];

export function populateExamCards() {
    const container = document.getElementById('exam-cards-dynamic');
    if (!container) return;
    const registry = (typeof DataLoader !== 'undefined' && DataLoader.registry) ? DataLoader.registry : null;
    if (!registry || !registry.subjects || !registry.exams) return;

    const subjects = registry.subjects;
    const exams = registry.exams;
    const badgeColors = {};
    subjects.forEach((sub, idx) => {
        badgeColors[sub.key] = EXAM_BADGE_COLORS[idx % EXAM_BADGE_COLORS.length];
    });

    container.innerHTML = '';
    subjects.forEach((subj, idx) => {
        const subjExams = exams.filter(e => e.subject === subj.key);
        if (subjExams.length === 0) return;

        const totalQuestions = subjExams.reduce((sum, e) => sum + (e.stats && e.stats.questions || 0), 0);
        const badgeColor = badgeColors[subj.key] || 'badge-gray';

        const btnsHtml = subjExams.map((exam, partIdx) => {
            const partLabel = subjExams.length > 1 ? `${partIdx + 1}부` : '';
            const pdfLabel = subjExams.length > 1
                ? `${partLabel} PDF`
                : '문제집 열기';
            const simLabel = subjExams.length > 1
                ? `${partLabel} 풀기`
                : '시뮬레이터 시작';
            const btnClass = subjExams.length > 1 ? '' : ' btn-cyan';
            return `                                <div class="exam-btn-pair">
                                    <button data-click="ExamViewer.openExam" data-arg="${contentPath(`문제은행/${exam.file}`)}" class="exam-btn-link"><i class="fa-solid fa-file-pdf"></i> ${pdfLabel}</button>
                                    <button class="exam-btn-sim${btnClass}" data-click="startMockExamSim" data-arg="${exam.key}"><i class="fa-solid fa-circle-play"></i> ${simLabel} <span class="pro-badge" data-pro-feature="mock_exam">PRO</span></button>
                                    <small class="exam-btn-caption">선다형 + 단답형 혼합 · 수작업 원본</small>
                                </div>`;
        }).join('\n');

        // ㄱㄴㄷ 복수정답형: 문제집 열람(드릴 번들 런타임 렌더링) + 복수정답형 모의고사 (버튼 클릭 시 문항 수 선택 행 펼침)
        // 프리셋은 실제 풀보다 작을 때만 표시, "전체"는 실제 문항 수 표기
        const comboTotal = DataLoader.getComboCount(subj.order);
        const comboChips = [20, 40, 60]
            .filter(n => !comboTotal || n < comboTotal)
            .map(n => `<button class="exam-btn-sim combo-count-chip" data-click="startComboMockExam" data-arg="${idx + 1}:${n}">${n}문</button>`)
            .concat(`<button class="exam-btn-sim combo-count-chip" data-click="startComboMockExam" data-arg="${idx + 1}">${comboTotal ? `전체 ${comboTotal}문` : '전체'}</button>`)
            .join('\n                                            ');
        const comboPair = `                                <div class="exam-btn-pair">
                                    <button data-click="ExamViewer.openCombo" data-arg="${subj.order}" class="exam-btn-link"><i class="fa-solid fa-file-lines"></i> 복수정답형 문제집 <span class="pro-badge" data-pro-feature="combo_set">PRO</span></button>
                                    <button class="exam-btn-sim" data-click="toggleComboPicker" data-arg="combo-picker-${idx + 1}"><i class="fa-solid fa-circle-play"></i> 복수정답형 모의고사 <span class="pro-badge" data-pro-feature="combo_mock">PRO</span></button>
                                    <small class="exam-btn-caption">ㄱㄴㄷㄹ 조합형 · 원본 문항 자동 변환</small>
                                    <div class="combo-count-row is-hidden" id="combo-picker-${idx + 1}">
                                            ${comboChips}
                                    </div>
                                </div>`;
        const allBtnsHtml = `${btnsHtml}\n${comboPair}`;

        const btnsClass = subjExams.length > 2 ? 'grid-btns-3' : subjExams.length > 1 ? 'grid-btns-2' : 'flex-btns';

        const cardHtml = `                        <div class="exam-card-item">
                            <div class="exam-card-badge ${badgeColor}">${idx + 1}과목</div>
                            <h4 class="exam-card-title">${subj.name} ${totalQuestions}제</h4>
                            <div class="exam-card-btns ${btnsClass}">
${allBtnsHtml}
                            </div>
                        </div>`;

        container.insertAdjacentHTML('beforeend', cardHtml);
    });

    // 플랜이 이미 로드됐다면 새로 그린 배지에도 무료/Pro 표시 반영
    refreshProBadges(container);

    // 정적 텍스트 동적 치환 (manifest 기반)
    const totalAllQuestions = exams.reduce((sum, e) => sum + (e.stats && e.stats.questions || 0), 0);
    const subjCounts = subjects.map((s) => {
        const subjExams = exams.filter(e => e.subject === s.key);
        const count = subjExams.reduce((sum, e) => sum + (e.stats && e.stats.questions || 0), 0);
        return count;
    });
    const subtitleEl = document.getElementById('exam-view-subtitle');
    if (subtitleEl && totalAllQuestions > 0) {
        const countStr = subjCounts.join('·');
        subtitleEl.textContent = `교재 인용 기반 ${totalAllQuestions}제 문제은행(과목별 ${countStr}제)으로 과목별 모의고사를 보고, 학습안내서로 핵심을 요약할 수 있습니다.`;
    }

    // 통합 모의고사 제목/버튼 동적 치환
    const integratedConfig = registry.integratedExam ? registry.integratedExam.questionsPerSubject : null;
    if (integratedConfig) {
        const integratedTotal = Object.values(integratedConfig).reduce((a, b) => a + b, 0);
        const examTimeMin = (registry.integratedExam && registry.integratedExam.examTimeMin) || integratedTotal;
        const titleEl = document.getElementById('integrated-exam-title');
        if (titleEl) titleEl.textContent = `통합 실전 모의고사 (${integratedTotal}제)`;
        const btnEl = document.getElementById('integrated-exam-btn');
        if (btnEl) btnEl.innerHTML = `<i class="fa-solid fa-clock" aria-hidden="true"></i> 통합 모의고사 시작 (${examTimeMin}분)`;
    }
}

export function populateResourceCards() {
    const container = document.getElementById('resources-section');
    if (!container) return;
    const registry = (typeof DataLoader !== 'undefined' && DataLoader.registry) ? DataLoader.registry : null;
    if (!registry || !registry.resources) return;

    const res = registry.resources;
    const summaryCardsHtml = (res.summaries || []).map(s => `
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 1rem;">
                                <strong style="color: var(--color-text-main); display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">${s.icon} ${esc(s.name)}</strong>
                                <span style="color: var(--color-text-muted); line-height: 1.5; display: block;">${esc(s.desc)}</span>
                            </div>`).join('\n');

    const linkCardsHtml = (res.links || []).map(l => `
                        <div class="exam-card-item">
                            <div class="exam-card-badge ${l.badgeColor}"><i class="${l.badgeIcon}"></i> ${esc(l.badgeText)}</div>
                            <h4 class="exam-card-title">${esc(l.title)}</h4>
                            <p class="exam-card-desc">${esc(l.desc)}</p>
                            <div class="exam-card-btns">
                                <a href="${l.url}" target="_blank" class="exam-btn-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${esc(l.linkText)}</a>
                            </div>
                        </div>`).join('\n');

    container.innerHTML = `
                    <div class="section-title-area" style="margin-top: 3rem;">
                        <h3>${esc(res.sectionTitle)}</h3>
                        <p>${esc(res.sectionDesc)}</p>
                    </div>

                    <div style="background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.15); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                        <h4 style="color: var(--color-primary); font-size: 1.1rem; margin-bottom: 1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-graduation-cap"></i> ${esc(res.summaryTitle)}
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.85rem;">
${summaryCardsHtml}
                        </div>
                    </div>

                    <div class="exam-list-grid">
${linkCardsHtml}
                    </div>`;
    container.classList.remove('is-hidden');
}

export function checkStorageWarning() {
    if (!state._storageUnavailable) return;
    const existing = document.getElementById('storage-warning-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'storage-warning-banner';
    banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 저장 공간이 부족하여 학습 진행상황이 저장되지 않습니다. 브라우저 데이터를 정리하거나 백업 후 진행 상황을 내보내세요.';
    document.body.appendChild(banner);
    banner.addEventListener('click', () => { banner.remove(); });
}

