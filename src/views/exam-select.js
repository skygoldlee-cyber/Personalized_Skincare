// src/views/exam-select.js — 시험 선택(피커) 뷰
// 멀티시험 플랫폼의 홈: 등록된 시험 목록을 카드로 표시하고 선택 시 시험을 전환한다.
import { getExamList, getActiveExamId, selectExam } from '../exam-context.js';
import { esc } from '../sanitize.js';
import { switchView } from './navigation.js';

/** 시험 선택 카드 목록 렌더링 */
export function renderExamSelect() {
    const container = document.getElementById('exam-select-list');
    if (!container) return;
    const exams = getExamList();
    const currentId = getActiveExamId(); // 저장값 없으면 기본 시험 폴백 — "현재 시험" 배지가 유효 시험을 반영

    if (!exams.length) {
        container.innerHTML = '<p style="color:var(--color-text-muted);">등록된 시험이 없습니다. content/exams.json을 확인하세요.</p>';
        return;
    }

    container.innerHTML = exams.map(e => {
        const isCurrent = e.id === currentId;
        return `
            <div class="exam-select-card${isCurrent ? ' current' : ''}" data-click="selectExamAction" data-arg="${esc(e.id)}" role="button" tabindex="0">
                <div class="exam-select-icon"><i class="${esc(e.icon || 'fa-solid fa-book')}" aria-hidden="true"></i></div>
                <h4>${esc(e.name)}</h4>
                <p>${esc(e.desc || '')}</p>
                <div class="exam-select-meta">
                    ${e.year ? `<span class="exam-select-year">${esc(e.year)}</span>` : ''}
                    ${isCurrent ? '<span class="exam-select-current">현재 시험</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

/** 시험 전환 버튼 → 피커 뷰 표시 */
export function showExamSelect() {
    renderExamSelect();
    switchView('exam-select-view');
}

/** 시험 카드 선택 — 다른 시험이면 selectExam이 리로드, 같으면 대시보드로 복귀 */
export function selectExamAction(id) {
    if (selectExam(id)) return; // 다른 시험: 페이지 리로드 발생
    switchView('dashboard-view');
}
