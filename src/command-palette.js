// command-palette.js — 통합 검색 팔레트 (Ctrl+K)
// 뷰 이동·플래시카드·퀴즈·교재 섹션·성분 사전·문제집을 하나의 검색창에서 찾아 실행한다.
// 모든 데이터는 로컬(window.STUDY_DATA/INGREDIENTS_DATA/DataLoader.registry) — 오프라인 완전 동작.

import { esc } from './sanitize.js';
import { getChosung } from './utils.js';
import { contentPath } from './exam-context.js';
import { openSubjectSection } from './views/textbook-reader.js';
import { setTextbookSearchQuery } from './views/textbook-search.js';
import { dictState } from './views/dictionary.js';

const MAX_PER_GROUP = 5;
const MAX_TOTAL = 24;

let _open = false;
let _activeIdx = 0;
let _results = [];

/* ---------- 검색 소스 수집 ---------- */

/** 활성 시험에서 보이는 뷰 목록 — 사이드바 nav-item을 스캔해 feature 게이팅(is-hidden)을 그대로 반영한다 */
function getViewItems() {
    const seen = new Map();
    document.querySelectorAll('.nav-item[data-target]').forEach(el => {
        const target = el.dataset.target;
        if (!target || seen.has(target) || el.classList.contains('is-hidden')) return;
        seen.set(target, el.textContent.trim());
    });
    return [...seen.entries()].map(([target, label]) => ({ target, label }));
}

function _subjects() {
    const data = (typeof window !== 'undefined' && window.STUDY_DATA) || {};
    return Object.keys(data);
}

/** 검색어를 소문자 토큰 배열로 정규화 */
function _terms(query) {
    return (query || '').toLowerCase().split(/\s+/).filter(Boolean);
}

/** 모든 토큰이 대상 텍스트에 포함되면 점수 반환 (제목 접두 매칭 가산점) */
function _matchScore(text, title, terms) {
    const hay = (text || '').toLowerCase();
    if (!terms.every(t => hay.includes(t))) return -1;
    const t = (title || '').toLowerCase();
    return t.startsWith(terms[0]) ? 2 : t.includes(terms[0]) ? 1 : 0;
}

/**
 * 통합 검색 — 유형별 그룹 결과를 반환한다 (순수 함수, 테스트 가능).
 * @param {string} query
 * @param {Object} [sources] - 테스트 주입용 {views, studyData, ingredients, exams}
 * @returns {Array<{type:string,icon:string,title:string,sub:string,action:Object,score:number}>}
 */
export function searchAll(query, sources) {
    const terms = _terms(query);
    if (!terms.length) return [];
    const src = sources || {};
    const studyData = src.studyData || ((typeof window !== 'undefined' && window.STUDY_DATA) || {});
    const ingredients = src.ingredients || ((typeof window !== 'undefined' && window.INGREDIENTS_DATA) || []);
    const registry = src.registry || ((typeof DataLoader !== 'undefined' && DataLoader.registry) || {});
    const views = src.views || (typeof document !== 'undefined' ? getViewItems() : []);
    const groups = { view: [], card: [], quiz: [], section: [], ingredient: [], exam: [] };
    const push = (type, item) => { if (groups[type].length < MAX_PER_GROUP) groups[type].push(item); };

    // 1) 뷰 바로가기
    views.forEach(v => {
        const s = _matchScore(v.label, v.label, terms);
        if (s >= 0) push('view', {
            type: 'view', icon: 'fa-arrow-right', title: v.label, sub: '화면 이동',
            action: { kind: 'view', target: v.target }, score: s + 2
        });
    });

    // 2) 과목 콘텐츠 — 카드·퀴즈·교재 섹션
    Object.keys(studyData).forEach(subjId => {
        const subj = studyData[subjId];
        const subjName = subj.name || subjId;
        (subj.cards || []).forEach(card => {
            const s = _matchScore(`${card.term} ${card.definition || ''}`, card.term, terms);
            if (s >= 0) push('card', {
                type: 'card', icon: 'fa-layer-group', title: card.term,
                sub: `${subjName} · 플래시카드`,
                action: { kind: 'card', subject: subjId }, score: s
            });
        });
        (subj.quizzes || []).forEach(q => {
            const s = _matchScore(`${q.question} ${(q.options || []).join(' ')}`, q.question, terms);
            if (s >= 0) push('quiz', {
                type: 'quiz', icon: 'fa-circle-question',
                title: (q.question || '').slice(0, 60), sub: `${subjName} · 기출 퀴즈`,
                action: { kind: 'quiz', subject: subjId }, score: s
            });
        });
        (subj.chapters || []).forEach(ch => {
            (ch.sections || []).forEach(sec => {
                const s = _matchScore(`${sec.title} ${ch.chapterTitle}`, sec.title, terms);
                if (s >= 0) {
                    push('section', {
                        type: 'section', icon: 'fa-book-open', title: sec.title,
                        sub: `${subjName} · ${ch.chapterTitle || '교재'}`,
                        action: { kind: 'section', subject: subjId, title: sec.title },
                        score: s + 1
                    });
                }
            });
        });
    });

    // 3) 성분 사전 (초성 검색 지원 — 자모 쿼리는 getChosung 통과 후 substring 매칭)
    ingredients.forEach(ing => {
        const name = (ing.name || '').toLowerCase();
        const eng = (ing.engName || '').toLowerCase();
        const chosung = getChosung(ing.name || '');
        const hit = terms.every(t => name.includes(t) || eng.includes(t) || chosung.includes(getChosung(t)));
        if (hit) push('ingredient', {
            type: 'ingredient', icon: 'fa-flask', title: ing.name,
            sub: ing.category ? `성분 사전 · ${ing.category}` : '성분 사전',
            action: { kind: 'ingredient', name: ing.name }, score: name.startsWith(terms[0]) ? 2 : 1
        });
    });

    // 4) 문제집/기출 파일
    (registry.exams || []).forEach(exam => {
        const s = _matchScore(`${exam.title} ${exam.file}`, exam.title, terms);
        if (s >= 0) push('exam', {
            type: 'exam', icon: 'fa-file-lines', title: exam.title,
            sub: '문제집 열기',
            action: { kind: 'exam', path: `문제은행/${exam.file}` }, score: s
        });
    });

    // 그룹 내 점수 정렬 후 플랫화 — 뷰·섹션·카드·퀴즈·성분·문제집 순
    const order = ['view', 'section', 'card', 'quiz', 'ingredient', 'exam'];
    const flat = [];
    order.forEach(type => {
        groups[type].sort((a, b) => b.score - a.score);
        flat.push(...groups[type]);
    });
    const results = flat.slice(0, MAX_TOTAL);

    // 본문 전수검색 브리지 — 팔레트는 섹션 "제목"만 인덱스하므로, 본문에서 찾아야 하는
    // 쿼리는 항상 이 항목으로 교재 본문검색(역색인) 뷰에 넘긴다. 결과가 있어도 항상 맨 아래 표시.
    results.push({
        type: 'fulltext', icon: 'fa-magnifying-glass',
        title: `교재 본문에서 "${query}" 전체 검색`, sub: '본문 내용까지 전수 검색 (제목 매칭만으로는 못 찾는 내용)',
        action: { kind: 'fulltext', query: (query || '').trim() }, score: 0
    });
    return results;
}

/* ---------- 팔레트 UI ---------- */

const TYPE_LABELS = {
    view: '화면', section: '교재', card: '플래시카드',
    quiz: '기출 퀴즈', ingredient: '성분 사전', exam: '문제집',
    fulltext: '본문 검색'
};

function _buildDom() {
    if (typeof document === 'undefined' || document.getElementById('cmdk-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'cmdk-overlay';
    overlay.className = 'cmdk-overlay is-hidden';
    overlay.innerHTML = `
        <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="통합 검색">
            <div class="cmdk-input-row">
                <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input id="cmdk-input" type="text" autocomplete="off" spellcheck="false"
                    placeholder="검색: 화면·교재·카드·퀴즈·성분·문제집" aria-label="통합 검색어">
                <kbd>ESC</kbd>
            </div>
            <div id="cmdk-results" class="cmdk-results" role="listbox"></div>
            <div class="cmdk-footer">
                <span><kbd>↑</kbd><kbd>↓</kbd> 이동</span>
                <span><kbd>Enter</kbd> 선택</span>
                <span><kbd>Ctrl+K</kbd> 열기/닫기</span>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) closeCommandPalette(); });

    const input = overlay.querySelector('#cmdk-input');
    input.addEventListener('input', () => _renderResults(input.value));
    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); _moveActive(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); _moveActive(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); executePaletteResult(_activeIdx); }
        else if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); }
    });
}

function _renderResults(query) {
    const box = document.getElementById('cmdk-results');
    if (!box) return;
    _activeIdx = 0;

    if (!(query || '').trim()) {
        _results = [];
        box.innerHTML = `<div class="cmdk-hint">검색어를 입력하면 화면·교재·카드·퀴즈·성분·문제집을 한 번에 찾습니다.</div>`;
        return;
    }

    _results = searchAll(query);
    if (!_results.length) {
        box.innerHTML = `<div class="cmdk-hint">"${esc(query)}"에 대한 결과가 없습니다.</div>`;
        return;
    }

    let lastType = '';
    box.innerHTML = _results.map((r, i) => {
        const header = r.type !== lastType
            ? `<div class="cmdk-group-label">${TYPE_LABELS[r.type] || r.type}</div>` : '';
        lastType = r.type;
        return `${header}
            <button type="button" class="cmdk-item${i === 0 ? ' is-active' : ''}" role="option"
                data-click="executePaletteResult" data-arg="${i}" data-idx="${i}">
                <i class="fa-solid ${r.icon}" aria-hidden="true"></i>
                <span class="cmdk-item-text">
                    <span class="cmdk-item-title">${esc(r.title)}</span>
                    <span class="cmdk-item-sub">${esc(r.sub)}</span>
                </span>
            </button>`;
    }).join('');
}

function _moveActive(delta) {
    if (!_results.length) return;
    _activeIdx = (_activeIdx + delta + _results.length) % _results.length;
    const items = document.querySelectorAll('#cmdk-results .cmdk-item');
    items.forEach(el => el.classList.toggle('is-active', +el.dataset.idx === _activeIdx));
    const active = document.querySelector(`#cmdk-results .cmdk-item[data-idx="${_activeIdx}"]`);
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
}

export function openCommandPalette() {
    _buildDom();
    const overlay = document.getElementById('cmdk-overlay');
    if (!overlay) return;
    _open = true;
    overlay.classList.remove('is-hidden');
    const input = document.getElementById('cmdk-input');
    input.value = '';
    _renderResults('');
    input.focus();
}

export function closeCommandPalette() {
    _open = false;
    const overlay = document.getElementById('cmdk-overlay');
    if (overlay) overlay.classList.add('is-hidden');
}

export function toggleCommandPalette() {
    if (_open) closeCommandPalette(); else openCommandPalette();
}

/** 검색 결과 실행 — 유형별로 기존 앱 진입 경로를 재사용한다 */
export function executePaletteResult(idx) {
    const r = _results[idx];
    if (!r) return;
    closeCommandPalette();
    const a = r.action;
    const clickNav = target => {
        const btn = document.querySelector(`.nav-item[data-target="${target}"]`)
            || document.querySelector(`.mobile-tab-item[data-target="${target}"]`);
        if (btn) btn.click();
    };
    switch (a.kind) {
        case 'view':
            clickNav(a.target);
            break;
        case 'card':
            if (typeof window.startSubjectStudy === 'function') window.startSubjectStudy(a.subject);
            break;
        case 'quiz':
            if (typeof window.startSubjectQuiz === 'function') window.startSubjectQuiz(a.subject);
            break;
        case 'section':
            clickNav('textbook-reader-view');
            openSubjectSection(a.subject, a.title);
            break;
        case 'ingredient':
            dictState.query = a.name;
            dictState.filter = 'all';
            clickNav('dictionary-view');
            break;
        case 'exam':
            if (window.ExamViewer && window.ExamViewer.openExam) {
                window.ExamViewer.openExam(contentPath(a.path));
            }
            break;
        case 'fulltext':
            setTextbookSearchQuery(a.query);
            clickNav('textbook-view');
            break;
    }
}

/** 전역 키 바인딩 — Ctrl/Cmd+K로 열기·닫기 (입력 필드에서도 동작) */
export function initCommandPalette() {
    if (typeof document === 'undefined') return;
    _buildDom();
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        }
    });
}
