// tests/unit/delegation-guard.test.js
//
// CSP 회귀 가드 (코드 리뷰 후속).
//
// 배포판 CSP는 script-src에 'unsafe-inline'을 두지 않으므로, 인라인
// on*="..." 이벤트 핸들러는 브라우저가 실행을 차단한다. 과거 동적 뷰
// HTML에 남아 있던 인라인 onclick/oninput 14~15곳이 로컬(serve.js, CSP
// 없음)에서는 동작하지만 Vercel 배포판에서만 조용히 죽는 버그가 있었다.
//
// 이 테스트는 두 가지를 강제한다:
//   1) shipped HTML(= src/**/*.js가 생성하는 마크업 + index.html)에 인라인
//      on*= 이벤트 핸들러 속성이 하나도 남지 않을 것.
//   2) data-click / data-input 으로 참조되는 모든 핸들러 이름의 최상위
//      식별자가 app.js에서 window에 노출(브리지)되어 있을 것.
//      (위임 핸들러는 window에서만 함수를 찾으므로, 브리지 누락은
//       클릭 시 "Handler not found" 로 이어진다.)
//
// 새 인라인 핸들러를 추가하거나, data-click 대상 함수를 window에 올리는 걸
// 잊으면 이 테스트가 즉시 실패한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');
const INDEX_HTML = path.join(ROOT, 'index.html');
const APP_JS = path.join(SRC_DIR, 'app.js');

/** src 아래 모든 .js 파일을 재귀 수집 */
function collectJsFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectJsFiles(full));
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

const SCAN_FILES = [...collectJsFiles(SRC_DIR), INDEX_HTML];

// 차단 대상 인라인 이벤트 핸들러 속성 목록 (필요 시 확장).
const INLINE_HANDLER_ATTRS = [
    'click', 'change', 'input', 'submit',
    'keydown', 'keyup', 'keypress',
    'mousedown', 'mouseup', 'mouseover', 'mouseout', 'mousemove',
    'focus', 'blur', 'load', 'error', 'scroll',
    'touchstart', 'touchend', 'touchmove',
    'dblclick', 'contextmenu', 'wheel'
];
const INLINE_HANDLER_RE = new RegExp(
    '\\bon(' + INLINE_HANDLER_ATTRS.join('|') + ')\\s*=\\s*["\']',
    'gi'
);

// data-click / data-input 정적 값 추출 (템플릿 보간 ${..} 이 섞인 값은 동적이라 제외)
const DELEGATED_ATTR_RE = /data-(?:click|input)=(?:"([^"${}]+)"|'([^'${}]+)')/g;

// app.js 의 window.<name> = 브리지 수집
const WINDOW_BRIDGE_RE = /window\.([A-Za-z_$][\w$]*)\s*=/g;

test('shipped HTML에 인라인 on*= 이벤트 핸들러가 없다 (CSP 차단 방지)', () => {
    const offenders = [];
    for (const file of SCAN_FILES) {
        const text = fs.readFileSync(file, 'utf8');
        const lines = text.split(/\r?\n/);
        lines.forEach((line, i) => {
            INLINE_HANDLER_RE.lastIndex = 0;
            let m;
            while ((m = INLINE_HANDLER_RE.exec(line))) {
                offenders.push(`${path.relative(ROOT, file)}:${i + 1}  →  on${m[1]}=`);
            }
        });
    }
    assert.deepEqual(
        offenders,
        [],
        '인라인 이벤트 핸들러 발견 (data-click/data-input 위임으로 옮기세요):\n' +
        offenders.join('\n')
    );
});

test('모든 data-click / data-input 핸들러는 window에 브리지되어 있다', () => {
    // 1) 참조된 핸들러 최상위 식별자 수집
    const referenced = new Map(); // topName -> Set(file)
    for (const file of SCAN_FILES) {
        const text = fs.readFileSync(file, 'utf8');
        let m;
        DELEGATED_ATTR_RE.lastIndex = 0;
        while ((m = DELEGATED_ATTR_RE.exec(text))) {
            const name = (m[1] || m[2]).trim();
            if (!name) continue;
            const top = name.split('.')[0]; // ManualViewer.openManual → ManualViewer
            if (!referenced.has(top)) referenced.set(top, new Set());
            referenced.get(top).add(path.relative(ROOT, file));
        }
    }

    // 2) app.js 의 window.* 브리지 수집
    const appText = fs.readFileSync(APP_JS, 'utf8');
    const bridged = new Set();
    let b;
    WINDOW_BRIDGE_RE.lastIndex = 0;
    while ((b = WINDOW_BRIDGE_RE.exec(appText))) bridged.add(b[1]);

    // 3) 교차 검증
    const missing = [];
    for (const [name, files] of referenced) {
        if (!bridged.has(name)) {
            missing.push(`${name}  (사용처: ${[...files].join(', ')})`);
        }
    }

    assert.ok(referenced.size > 0, 'data-click/data-input 참조를 하나도 찾지 못함 — 스캐너 정규식을 확인하세요.');
    assert.deepEqual(
        missing,
        [],
        'window 브리지 누락 (app.js에 window.<name> = <name>; 추가 필요):\n' + missing.join('\n')
    );
});
