// src/modal-back.js — 열린 모달·오버레이를 OS/브라우저 뒤로가기로 닫는다.
// @spec UX-NAV-08
// 동작 원리: 모달이 열릴 때마다 동일 URL의 pushState 마커를 쌓아 뒤로가기가
// 뷰 이탈이 아니라 마커 소비(=모달 닫기)가 되게 한다. 마커 URL이 동일하므로
// hashchange가 발생하지 않아 해시 라우터와 충돌하지 않는다.
// is-hidden 클래스 토글·동적 생성 모달(머메이드 확대 등)을 모두 감지하려고
// body 서브트리의 class/style/hidden 속성 변경을 감시한다.
// 매뉴얼·문제집 뷰어처럼 자체 pushState를 관리하는 오버레이는
// history.state의 자체 마커가 찍혀 있으므로 여기서는 건드리지 않는다.

// 모달 후보 셀렉터 — 넓게 잡고 "표시 중" 판정으로 걸러낸다.
// 설정 패널(드롭다운) 등 비모달은 셀렉터에 포함하지 않는다.
const MODAL_SELECTOR = '[id$="-modal"], [id$="-overlay"], [id$="-sheet"], [role="dialog"], .cmdk-overlay';

// 자체 히스토리를 관리하는 오버레이가 pushState에 남기는 마커 키
// (manual-viewer {manualOverlay}, exam-viewer {examOverlay})
const SELF_MANAGED_MARKERS = ['manualOverlay', 'examOverlay'];

let _depth = 0;          // 현재 쌓아둔 우리 마커 수 (표시 중인 모달 수와 동기화)
let _consuming = 0;      // 우리가 스스로 소비한 back()의 popstate 구분 카운터
let _observer = null;
let _popstateBound = false;

function _isOpen(el) {
    if (el.classList.contains('is-hidden') || el.hasAttribute('hidden')) return false;
    return getComputedStyle(el).display !== 'none';
}

/** 표시 중인 모달 요소 목록. 자체 히스토리 관리 오버레이는 제외. */
function _openModals() {
    const out = [];
    for (const el of document.querySelectorAll(MODAL_SELECTOR)) {
        if (_isOpen(el)) out.push(el);
    }
    return out;
}

/** 열림 개수 변화에 맞춰 히스토리 마커를 쌓거나 소비한다. */
function _syncState() {
    const selfManaged = SELF_MANAGED_MARKERS.some(k => history.state && history.state[k]);
    const n = _openModals().filter(el =>
        !(selfManaged && (el.id === 'manual-overlay' || el.id === 'exam-overlay'))
    ).length;

    while (_depth < n) {
        try {
            history.pushState({ modalBack: true }, '');
            _depth++;
        } catch (_) { _depth = n; break; /* pushState 제한 환경 */ }
    }
    while (_depth > n) {
        _depth--;
        // UI 버튼으로 닫힌 경우 우리 마커가 사장 엔트리로 남는다 —
        // 현재 엔트리가 우리 마커면 안전하게 소비해 "죽은 뒤로가기"를 방지.
        // 한 번에 하나만 소비: 연속 back()은 중간의 뷰 엔트리까지 팝할 위험이 있다.
        if (history.state && history.state.modalBack) {
            _consuming++;
            try { history.back(); } catch (_) { _consuming--; }
            break;
        }
    }
}

/** 가장 위에 있는 열린 모달을 닫는다 — 각 모듈의 정리 로직을 거치는 순서로 시도. */
function _closeTopModal() {
    const open = _openModals();
    const top = open[open.length - 1];
    if (!top) return;

    // 1. Escape 처리를 지원하는 모달은 키 이벤트로 정상 종료 (트랩 해제 포함)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (!_isOpen(top)) return;

    // 2. 모달 내부의 닫기 버튼 클릭 — 모듈의 닫기 핸들러 경유
    const closeBtn = top.querySelector(
        'button[aria-label="닫기"], [id$="-close"], .modal-close, .pwa-modal-close, .more-sheet-close, .mermaid-zoom-close'
    );
    if (closeBtn) {
        /** @type {HTMLElement} */ (closeBtn).click();
        if (!_isOpen(top)) return;
    }

    // 3. 최후 수단 — 클래스 토글로라도 화면에서 제거
    top.classList.add('is-hidden');
    top.classList.remove('open');
}

/** 앱 초기화 시 1회 호출 — 속성 감시 + popstate 구독을 설치한다. */
export function setupModalBackHandler() {
    if (!_observer) {
        _observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                const t = /** @type {HTMLElement} */ (m.target);
                if (t.nodeType === 1 && t.matches && t.matches(MODAL_SELECTOR)) {
                    _syncState();
                    return;
                }
            }
        });
        // 동적 생성 모달도 잡으려고 서브트리 전체의 class/style/hidden 변경을 감시
        _observer.observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden']
        });
    }

    if (!_popstateBound) {
        _popstateBound = true;
        window.addEventListener('popstate', () => {
            if (_consuming > 0) { _consuming--; return; }
            if (_depth > 0) {
                _depth--;
                _closeTopModal();
            }
        });
    }
}

/** 테스트 격리용 — 모듈 상태 초기화 (리스너·옵저버는 유지). */
export function resetModalBackState() {
    _depth = 0;
    _consuming = 0;
}
