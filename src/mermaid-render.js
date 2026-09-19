/**
 * mermaid-render.js — Mermaid 지연 로딩 + 컨테이너 렌더링 공용 모듈.
 * textbook-reader.js와 textbook-search.js의 중복 구현을 통합한 것.
 */
import { detectMermaidType, getMermaidClassName, getMermaidInitOptions } from './mermaid-utils.js';
import { PATHS } from './paths.js';

let _mermaidLoadPromise = null;

/**
 * vendor/mermaid.min.js를 지연 로딩해 window.mermaid를 반환한다.
 * @returns {Promise<Object>}
 */
function ensureMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (_mermaidLoadPromise) return _mermaidLoadPromise;
    _mermaidLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PATHS.VENDOR_MERMAID;
        script.async = true;
        const nonce = crypto.getRandomValues(new Uint8Array(16));
        script.nonce = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
        script.onload = () => {
            if (window.mermaid) resolve(window.mermaid);
            else reject(new Error('mermaid loaded but window.mermaid is undefined'));
        };
        script.onerror = (e) => { _mermaidLoadPromise = null; reject(e); };
        document.head.appendChild(script);
    });
    return _mermaidLoadPromise;
}

/**
 * 컨테이너 내 pre.mermaid 노드를 순차 렌더링한다.
 * @param {HTMLElement|null} container
 * @param {string} logPrefix 로그 접두사 ('[reader]', '[search]' 등)
 */
export function renderMermaidIn(container, logPrefix = '[mermaid]') {
    const nodes = container ? container.querySelectorAll('pre.mermaid') : [];
    if (nodes.length === 0) return;
    ensureMermaid()
        .then((mermaid) => {
            try {
                const isLight = document.documentElement.classList.contains('light-theme');
                const nodeArr = Array.from(nodes);
                // 각 노드의 diagram 타입 감지하여 클래스 추가
                const nodeTypes = [];
                nodeArr.forEach(node => {
                    const type = detectMermaidType(node.textContent);
                    nodeTypes.push(type);
                    node.classList.add(getMermaidClassName(type));
                });
                let rendered = 0;
                let failed = 0;
                const renderNext = (i) => {
                    if (i >= nodeArr.length) {
                        if (failed > 0) console.warn(`${logPrefix} mermaid: ${rendered} rendered, ${failed} failed`);
                        return;
                    }
                    const node = nodeArr[i];
                    const type = nodeTypes[i];
                    mermaid.initialize(getMermaidInitOptions(type, isLight));
                    mermaid.run({ nodes: [node] })
                        .then(() => { rendered++; renderNext(i + 1); })
                        .catch((e) => {
                            failed++;
                            console.warn(`${logPrefix} mermaid node ${i} failed:`, e?.message || e);
                            node.innerHTML = '<span style="color:var(--color-text-muted);font-size:0.8rem;">[다이어그램 렌더링 실패]</span>';
                            renderNext(i + 1);
                        });
                };
                renderNext(0);
            } catch (e) {
                console.warn(`${logPrefix} mermaid render failed:`, e);
            }
        })
        .catch((e) => console.warn(`${logPrefix} mermaid load failed:`, e));
}
