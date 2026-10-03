// src/views/listeners-delegation.js — data-click / data-input 위임 바인딩 (event-listeners.js §7에서 분리)
// @spec S-02,S-03
//
//    ⚠️ CSP(script-src에 'unsafe-inline' 없음)에서 인라인 onclick/oninput은 브라우저가
//       실행을 차단한다. 따라서 동적으로 생성되는 HTML도 반드시 이 위임 경로를 써야 하며,
//       핸들러는 window에 노출(브리지)되어 있어야 resolveDelegatedHandler가 찾을 수 있다.
//
//    인자 전달 규약:
//      - data-arg  : (레거시) 단일 문자열 인자 하나. 기존 사용처와 100% 호환.
//      - data-args : JSON 배열로 다중/타입 인자 전달.
//                    예) data-args='["law", 0]'  → handler("law", 0)
//                        data-args='[true]'       → handler(true)
//                        data-args가 있으면 data-arg는 무시된다.
//      - data-input: input 이벤트용. 현재 요소의 value를 인자로 전달.
//                    예) <input data-input="seekReaderAudio"> → seekReaderAudio(el.value)

// 전역 범위(window)에서 함수 찾기 (ManualViewer.openManual 등의 점 표기 네임스페이스 허용)
function resolveDelegatedHandler(name) {
    let handler = /** @type {any} */ (window);
    for (const part of name.split('.')) {
        if (handler) handler = handler[part];
    }
    return handler;
}

// data-args(JSON 배열) 우선, 없으면 data-arg(단일 문자열), 둘 다 없으면 인자 없음.
// 반환값이 null이면 파싱 실패이므로 호출을 건너뛴다.
function parseDelegatedArgs(el) {
    const rawArgs = el.getAttribute('data-args');
    if (rawArgs !== null) {
        try {
            const parsed = JSON.parse(rawArgs);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (err) {
            console.error(`[delegation] data-args JSON 파싱 실패: ${rawArgs}`, err);
            return null;
        }
    }
    const arg = el.getAttribute('data-arg');
    return arg !== null ? [arg] : [];
}

export function bindDelegation(enhanceDataClickAccessibility) {
    document.body.addEventListener('click', (e) => {
        // 일부 안드로이드 Chrome에서 e.target이 Text 노드가 될 수 있어
        // closest()가 없어 TypeError 발생 → 버튼 동작 안 함 (PC/최신 모바일은 정상)
        const targetEl = e.target instanceof Element ? e.target : (/** @type {Node|null} */ (e.target))?.parentElement;
        if (!targetEl) return;
        const el = /** @type {HTMLElement|null} */ (targetEl.closest('[data-click]'));
        if (!el) return;

        const handlerName = el.getAttribute('data-click');

        // A 태그나 href="#" 태그일 경우 기본 동작 차단
        if (el.tagName === 'A' || el.getAttribute('href') === '#') {
            e.preventDefault();
        }

        const handler = resolveDelegatedHandler(handlerName);
        if (typeof handler !== 'function') {
            console.error(`Handler not found: ${handlerName}`);
            return;
        }

        const args = parseDelegatedArgs(el);
        if (args === null) return; // data-args 파싱 실패 시 호출하지 않음
        handler(...args);
    });

    // 키보드 접근성: [data-click] 요소에서 Enter/Space 시 클릭 트리거
    document.body.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const targetEl = e.target instanceof Element ? e.target : (/** @type {Node|null} */ (e.target))?.parentElement;
        if (!targetEl) return;
        const el = /** @type {HTMLElement|null} */ (targetEl.closest('[data-click]'));
        if (!el) return;
        // 네이티브 버튼/링크/입력은 자체 키보드 처리가 있으므로 제외
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
        e.preventDefault();
        el.click();
    });

    // 입력 이벤트 위임 (range 슬라이더 등). 인라인 oninput 속성(CSP 차단) 대체.
    document.body.addEventListener('input', (e) => {
        const targetEl = e.target instanceof Element ? e.target : (/** @type {Node|null} */ (e.target))?.parentElement;
        if (!targetEl) return;
        const el = /** @type {HTMLInputElement|null} */ (targetEl.closest('[data-input]'));
        if (!el) return;

        const handlerName = el.getAttribute('data-input');
        const handler = resolveDelegatedHandler(handlerName);
        if (typeof handler !== 'function') {
            console.error(`Input handler not found: ${handlerName}`);
            return;
        }
        handler(el.value);
    });

    // 키보드 접근성: [data-click] div 요소에 tabindex/role 부여
    enhanceDataClickAccessibility();
}
