#!/usr/bin/env node
/* ============================================================
 * tools/check-imports.js
 * ------------------------------------------------------------
 * src/ 디렉토리 내 모든 ES 모듈의 import/export 교차 검증.
 *
 * 왜 필요한가?
 *   모듈 분리/리팩토링 후 누락된 export나 잘못된 import 경로가
 *   런타임 SyntaxError/ReferenceError로 발견되는 것을 배포 전에
 *   정적으로 차단한다.
 *
 * 사용:
 *   node tools/check-imports.js
 *   npm run check:imports
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */

// @spec BP-02
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');

// --- 파일 수집 ---
function collectJsFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectJsFiles(full));
        } else if (entry.name.endsWith('.js')) {
            results.push(full);
        }
    }
    return results;
}

// --- 라인 단위 코멘트 제거 ---
// 블록 코멘트 상태를 추적하며 각 라인에서 코멘트 부분만 제거.
// 문자열/정규식 내의 // /* */ 는 완벽히 구분하지 못하지만,
// import/export 문은 항상 줄 시작(들여쓰기 후)에 위치하므로
// 줄 단위 처리로 충분히 안전하다.
function stripComments(src) {
    const lines = src.split(/\r?\n/);
    const result = [];
    let inBlockComment = false;
    for (const line of lines) {
        let processed = '';
        let i = 0;
        while (i < line.length) {
            if (inBlockComment) {
                const end = line.indexOf('*/', i);
                if (end === -1) { i = line.length; break; }
                i = end + 2;
                inBlockComment = false;
            } else {
                const blockStart = line.indexOf('/*', i);
                const lineStart = line.indexOf('//', i);
                if (blockStart === -1 && lineStart === -1) {
                    processed += line.substring(i);
                    break;
                }
                if (lineStart !== -1 && (blockStart === -1 || lineStart < blockStart)) {
                    processed += line.substring(i, lineStart);
                    break;
                }
                // blockStart
                processed += line.substring(i, blockStart);
                i = blockStart + 2;
                const blockEnd = line.indexOf('*/', i);
                if (blockEnd === -1) {
                    inBlockComment = true;
                    break;
                }
                i = blockEnd + 2;
            }
        }
        result.push(processed);
    }
    return result.join('\n');
}

// --- import 문 파싱 ---
// 줄 시작(들여쓰기 후)에 import가 오는 경우만 매칭.
const IMPORT_RE = /^\s*import\s+(?:([^'"]+?)\s+from\s+)?['"]([^'"]+)['"]/gm;

function parseImports(src) {
    const clean = stripComments(src);
    const imports = [];
    let m;
    while ((m = IMPORT_RE.exec(clean)) !== null) {
        const clause = m[1]; // import clause (may be null for side-effect)
        const modulePath = m[2];
        if (!clause) {
            imports.push({ modulePath, names: [], isSideEffect: true });
            continue;
        }
        const names = [];
        const localNames = []; // 이 파일에 바인딩되는 로컬 식별자 (typeof 오용 검출용)
        const aliases = new Map(); // imported name → local alias (for unused detection)
        const starMatch = clause.match(/^\*\s+as\s+(\w+)$/);

        if (starMatch) {
            names.push('*');
            localNames.push(starMatch[1]);
        } else {
            // default import: 식별자가 { 앞에 오는 경우만
            const defaultPart = clause.replace(/\{[\s\S]*\}/, '').replace(/,\s*$/, '').trim();
            if (defaultPart && !defaultPart.startsWith('*')) {
                names.push('default');
                localNames.push(defaultPart);
            }
            // named imports (multiline-safe)
            const braceContent = clause.match(/\{([\s\S]+?)\}/);
            if (braceContent) {
                for (let part of braceContent[1].split(',')) {
                    part = part.trim();
                    if (!part) continue;
                    // "A as B" → imported name is "A" (the original export), local is "B"
                    const asMatch = part.match(/^(\w+)\s+as\s+(\w+)$/);
                    if (asMatch) {
                        names.push(asMatch[1]);
                        localNames.push(asMatch[2]);
                        aliases.set(asMatch[1], asMatch[2]);
                    } else {
                        names.push(part);
                        localNames.push(part);
                    }
                }
            }
        }
        imports.push({ modulePath, names, localNames, aliases, isSideEffect: false });
    }
    return imports;
}

// --- export 문 파싱 ---
// 줄 시작(들여쓰기 후)에 export가 오는 경우만 매칭.
const EXPORT_NAMED_RE = /^\s*export\s*\{([^}]+)\}\s*(?:from\s+['"]([^'"]+)['"])?/gm;
const EXPORT_DECL_RE = /^\s*export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/gm;
const EXPORT_DEFAULT_RE = /^\s*export\s+default\b/gm;
const EXPORT_STAR_RE = /^\s*export\s*\*\s*(?:as\s+(\w+)\s+)?from\s+['"]([^'"]+)['"]/gm;

function parseExports(src) {
    const clean = stripComments(src);
    const exports = new Set();
    const namedReExports = []; // export { A } from './x' — './x'에서 A를 소비
    let m;

    // named exports: export { A, B as C }
    while ((m = EXPORT_NAMED_RE.exec(clean)) !== null) {
        const names = m[1];
        const reExportFrom = m[2];
        const reExported = [];
        for (let part of names.split(',')) {
            part = part.trim();
            if (!part) continue;
            // "A as B" → exported name is "B" (the public name)
            const asMatch = part.match(/^(\w+)\s+as\s+(\w+)$/);
            if (asMatch) {
                exports.add(asMatch[2]);
                // if re-export, also track the original for validation
                if (reExportFrom) {
                    exports.add(asMatch[1]); // original name for re-export validation
                    reExported.push(asMatch[1]);
                }
            } else {
                exports.add(part);
                if (reExportFrom) reExported.push(part);
            }
        }
        if (reExportFrom && reExported.length > 0) {
            namedReExports.push({ modulePath: reExportFrom, names: reExported });
        }
    }

    // declaration exports: export function/const/let/var/class X
    while ((m = EXPORT_DECL_RE.exec(clean)) !== null) {
        exports.add(m[1]);
    }

    // default export
    if (EXPORT_DEFAULT_RE.test(clean)) {
        exports.add('default');
    }

    // export * from './path' — wildcard re-export (all named exports of target)
    const starReExports = [];
    while ((m = EXPORT_STAR_RE.exec(clean)) !== null) {
        if (m[1]) {
            exports.add(m[1]); // export * as NS from './path'
        }
        starReExports.push(m[2]);
    }

    return { exports, starReExports, namedReExports };
}

// --- 모듈 경로 해결 ---
function resolveModule(importerDir, modulePath) {
    // 상대 경로만 처리 (bare specifier는 외부 패키지)
    if (!modulePath.startsWith('.') && !modulePath.startsWith('/')) {
        return null; // 외부 패키지 — 검증 제외
    }
    const resolved = path.resolve(importerDir, modulePath);
    // .js 확장자 추가 (생략된 경우)
    if (!resolved.endsWith('.js')) {
        if (fs.existsSync(resolved + '.js')) return resolved + '.js';
        if (fs.existsSync(path.join(resolved, 'index.js'))) return path.join(resolved, 'index.js');
        return null;
    }
    return fs.existsSync(resolved) ? resolved : null;
}

// 템플릿 경로 확장 — `./exams/${getActiveExamId()}/views/x.js` 같은 규약
// 경로는 src/exams/ 아래 실재하는 시험 디렉터리 각각으로 치환해 해석한다.
// (활성 시험 id로 런타임 해석되는 도메인 경로 규약 — practice-registry/app.js 참조)
function resolveModuleMulti(importerDir, modulePath) {
    const cleaned = modulePath.split('?')[0];
    if (!cleaned.includes('${')) {
        const r = resolveModule(importerDir, cleaned);
        return r ? [r] : [];
    }
    const examsDir = path.join(SRC_DIR, 'exams');
    const examDirs = fs.existsSync(examsDir)
        ? fs.readdirSync(examsDir, { withFileTypes: true })
            .filter(e => e.isDirectory()).map(e => e.name)
        : [];
    const results = [];
    for (const id of examDirs) {
        const expanded = cleaned.replace(/\$\{[^}]*\}/g, id);
        const r = resolveModule(importerDir, expanded);
        if (r) results.push(r);
    }
    return results;
}

// --- 메인 검증 ---
function main() {
    const files = collectJsFiles(SRC_DIR);
    const errors = [];
    const warnings = [];

    // 각 파일의 exports를 미리 수집
    const moduleExports = new Map(); // filepath → Set of export names
    const moduleStarReExports = new Map(); // filepath → array of star re-export targets
    const moduleNamedReExports = new Map(); // filepath → export { A } from './x' 소비 목록

    for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        const { exports, starReExports, namedReExports } = parseExports(src);
        moduleExports.set(file, exports);
        moduleStarReExports.set(file, starReExports);
        moduleNamedReExports.set(file, namedReExports);
    }

    // 각 파일의 imports를 검증
    for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        const imports = parseImports(src);
        const importerDir = path.dirname(file);
        const relFile = path.relative(ROOT, file).replace(/\\/g, '/');

        // unused import 검출용: import 라인 제거한 본문
        const bodySrc = src.replace(/^\s*import\s.*$/gm, '');

        for (const imp of imports) {
            const resolved = resolveModule(importerDir, imp.modulePath);
            if (!resolved) {
                // 외부 패키지이거나 파일이 존재하지 않음
                if (imp.modulePath.startsWith('.')) {
                    errors.push(`${relFile}: 모듈을 찾을 수 없음 — '${imp.modulePath}'`);
                }
                continue;
            }

            const relResolved = path.relative(ROOT, resolved).replace(/\\/g, '/');

            // side-effect import는 이름 검증 제외
            if (imp.isSideEffect || imp.names.length === 0) continue;

            const targetExports = moduleExports.get(resolved);
            if (!targetExports) {
                // 대상 파일이 수집 대상이 아님 (src/ 외부)
                continue;
            }

            // star re-export가 있으면 모든 이름 허용
            const starTargets = moduleStarReExports.get(resolved) || [];
            const hasStarReExport = starTargets.length > 0;

            for (const name of imp.names) {
                if (name === '*') continue; // namespace import — 항상 허용

                if (hasStarReExport) {
                    // export * from './path'가 있으면 정확한 검증이 어려우므로 스킵
                    // (대상 모듈의 존재는 이미 확인됨)
                    continue;
                }

                if (!targetExports.has(name)) {
                    errors.push(
                        `${relFile}: '${name}'을(를) import하지만 ` +
                        `${relResolved}에서 export하지 않음`
                    );
                }

                // unused import 검출: 본문에서 참조되지 않는 import
                // 단, window.X = X 패턴은 참조로 간주
                // alias가 있는 경우 local alias를 본문에서 검색
                if (name !== 'default') {
                    const localName = (imp.aliases && imp.aliases.get(name)) || name;
                    const refRe = new RegExp('\\b' + localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
                    if (!refRe.test(bodySrc)) {
                        warnings.push(
                            `${relFile}: '${name}'을(를) import하지만 사용하지 않음 (unused import)`
                        );
                    }
                }
            }
        }
    }

    // --- import 없는 `typeof <모듈>` 가드 검출 ---
    // `typeof DataLoader !== 'undefined'`처럼 src 모듈의 export 이름을 대상으로
    // import 없이 "있으면 쓰고 없으면 무시" 가드를 쓰면, ES 모듈 바인딩은 전역이
    // 아니므로 프로덕션에서 항상 undefined → 기능이 조용히 죽는다
    // (테스트가 window.X 스텁을 주입해 가려지는 경우가 많다).
    // 식별자가 ① 어느 src 모듈의 export 이름이고 ② 이 파일에 바인딩이 없으며
    // ③ 환경 전역(window/process 등)이 아니고 ④ window에 발행되지 않으면 오류.
    // ④의 정당한 예: app.js가 DELEGATED_HANDLERS를 window에 assign해
    //    `typeof updateGlobalStats === 'function'` 같은 콜백 조회를 지원.

    // window/globalThis에 발행된 이름 수집
    const windowPublished = new Set();
    const braceMatch = (src, openIdx) => {
        let depth = 0, inStr = null, esc = false, inLine = false, inBlock = false;
        for (let i = openIdx; i < src.length; i++) {
            const c = src[i], n = src[i + 1];
            if (inLine) { if (c === '\n') inLine = false; continue; }
            if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
            if (inStr) {
                if (esc) esc = false;
                else if (c === '\\') esc = true;
                else if (c === inStr) inStr = null;
                continue;
            }
            if (c === '/' && n === '/') { inLine = true; continue; }
            if (c === '/' && n === '*') { inBlock = true; continue; }
            if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
            if (c === '{') depth++;
            else if (c === '}') { depth--; if (depth === 0) return i; }
        }
        return -1;
    };
    const collectKeys = (literal) => {
        // 1레벨 키 추출: 'key:', "key":, key:, key,(shorthand), key((메서드)
        for (const km of literal.matchAll(/(?:async\s+|get\s+|set\s+)*["']?([A-Za-z_$][\w$]*)["']?\s*[(:,]/g)) {
            windowPublished.add(km[1]);
        }
    };
    for (const file of files) {
        const clean = stripComments(fs.readFileSync(file, 'utf8'));
        for (const m of clean.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g)) {
            windowPublished.add(m[1]);
        }
        for (const m of clean.matchAll(/Object\.assign\(\s*(?:window|globalThis)\s*,\s*([A-Za-z_$][\w$]*|\{)/g)) {
            const arg = m[1];
            let openIdx = -1;
            if (arg === '{') {
                openIdx = m.index + m[0].length - 1;
            } else {
                const dm = new RegExp(`(?:const|let|var)\\s+${arg}\\s*=\\s*\\{`).exec(clean);
                if (dm) openIdx = dm.index + dm[0].length - 1;
            }
            if (openIdx === -1) continue;
            const closeIdx = braceMatch(clean, openIdx);
            if (closeIdx !== -1) collectKeys(clean.slice(openIdx + 1, closeIdx));
        }
    }

    const ENV_GLOBALS = new Set([
        'window', 'document', 'navigator', 'location', 'process', 'globalThis',
        'self', 'isSecureContext', 'indexedDB', 'caches', 'localStorage',
        'sessionStorage', 'customElements', 'module', 'require', 'exports',
        'global', 'Buffer', 'fetch', 'crypto', 'performance', 'console',
        'Worker', 'importScripts', 'queueMicrotask', 'requestAnimationFrame',
        'cancelAnimationFrame', 'setTimeout', 'setInterval', 'clearTimeout',
        'clearInterval', 'btoa', 'atob', 'structuredClone', 'Node',
        'HTMLElement', 'Element', 'MutationObserver', 'IntersectionObserver',
        'ResizeObserver', 'DOMParser', 'FileReader', 'AudioContext',
        'XMLHttpRequest', 'FormData', 'URL', 'URLSearchParams', 'matchMedia',
        'getComputedStyle', 'Event', 'CustomEvent', 'AbortController',
        'CSS', 'undefined',
    ]);
    const allExportNames = new Set();
    for (const exps of moduleExports.values()) {
        for (const n of exps) { if (n !== 'default') allExportNames.add(n); }
    }
    const TYPEOF_RE = /\btypeof\s+([A-Za-z_$][\w$]*)/g;
    const LOCAL_DECL_RE = /\b(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
    for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        const clean = stripComments(src);
        const bound = new Set();
        for (const imp of parseImports(src)) {
            for (const ln of imp.localNames || []) bound.add(ln);
        }
        let dm;
        LOCAL_DECL_RE.lastIndex = 0;
        while ((dm = LOCAL_DECL_RE.exec(clean)) !== null) bound.add(dm[1]);
        const relFile = path.relative(ROOT, file).replace(/\\/g, '/');
        TYPEOF_RE.lastIndex = 0;
        let tm;
        const seen = new Set();
        while ((tm = TYPEOF_RE.exec(clean)) !== null) {
            const ident = tm[1];
            if (seen.has(ident)) continue;
            seen.add(ident);
            if (ENV_GLOBALS.has(ident) || bound.has(ident) || windowPublished.has(ident)) continue;
            if (!allExportNames.has(ident)) continue;
            errors.push(
                `${relFile}: 'typeof ${ident}' — ${ident}은(는) src 모듈 export이지만 ` +
                `이 파일에 import/선언이 없어 런타임에 항상 undefined입니다. import로 교체하세요`
            );
        }
    }

    // --- unused export 검출 ---
    // 각 export가 다른 파일에서 import되는지 추적
    // 테스트는 await import() 동적 import를 쓰므로 별도 수집한다.
    // 백틱 템플릿(캐시버스터 쿼리 포함)도 허용 — `?case=${n}` 등은 해석 전에 제거
    const DYN_IMPORT_RE = /import\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    const cleanDynPath = p => p.split('?')[0].replace(/\$\{[^}]*\}/g, '');
    const allImports = new Set(); // "filepath::name" 형태
    for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        const imports = parseImports(src);
        const importerDir = path.dirname(file);
        for (const imp of imports) {
            const resolved = resolveModule(importerDir, imp.modulePath);
            if (!resolved) continue;
            for (const name of imp.names) {
                if (name === '*' || name === 'default') continue;
                allImports.add(resolved + '::' + name);
            }
        }
        // export { A } from './x' 재수출도 './x'의 A를 소비한 것으로 집계
        for (const rex of moduleNamedReExports.get(file) || []) {
            const resolved = resolveModule(importerDir, rex.modulePath);
            if (!resolved) continue;
            for (const name of rex.names) {
                allImports.add(resolved + '::' + name);
            }
        }
        // LAZY_MODULE_HANDLERS 지연 로딩 테이블 — const loadX = _lazyImport(() => import('경로'))
        // 로더를 찾아 테이블 [로더, ['이름'...]] 쌍의 이름을 해당 모듈의 사용으로 집계.
        // 백틱 템플릿(`./exams/${id}/...`)은 resolveModuleMulti로 시험 디렉터리 확장 해석.
        const lazyLoaders = new Map();
        const LAZY_LOADER_RE = /const\s+([A-Za-z_$][\w$]*)\s*=\s*_lazyImport\(\(\)\s*=>\s*import\(\s*(['"`])([^'"`]+)\2\s*\)\)/g;
        let lm;
        while ((lm = LAZY_LOADER_RE.exec(src)) !== null) {
            for (const resolved of resolveModuleMulti(importerDir, lm[3])) {
                const cur = lazyLoaders.get(lm[1]) || [];
                cur.push(resolved);
                lazyLoaders.set(lm[1], cur);
            }
        }
        if (lazyLoaders.size > 0) {
            const lazyMatch = /LAZY_MODULE_HANDLERS\s*=\s*\[([\s\S]*?)\];/.exec(src);
            if (lazyMatch) {
                const PAIR_RE = /([A-Za-z_$][\w$]*),\s*\[([^\]]*)\]/g;
                const NAME_RE = /'([A-Za-z_$][\w$]*)'/g;
                let pm;
                while ((pm = PAIR_RE.exec(lazyMatch[1])) !== null) {
                    const lazyResolved = lazyLoaders.get(pm[1]);
                    if (!lazyResolved) continue;
                    let nm;
                    NAME_RE.lastIndex = 0;
                    while ((nm = NAME_RE.exec(pm[2])) !== null) {
                        for (const r of lazyResolved) allImports.add(r + '::' + nm[1]);
                    }
                }
            }
        }
        // 동적 import + 이름 본문 등장 — data-click 위임 디스패치처럼 문자열로
        // 참조되는 네임드 export를 사용으로 간주 (testFileUses와 동일 규칙.
        // practice-registry.js의 loaders/handlers 선언이 이 형태다)
        DYN_IMPORT_RE.lastIndex = 0;
        let dtm;
        // 도메인 규약 로더 — _domainImport('views/x.js')는 런타임에
        // `./exams/<활성시험>/views/x.js`로 해석된다 (practice-registry.js).
        // 정적 검증은 src/exams/ 아래 각 시험 디렉터리로 확장해 수행한다.
        const DOMAIN_LOADER_RE = /_domainImport\(\s*'([^']+)'\s*\)/g;
        let dl;
        while ((dl = DOMAIN_LOADER_RE.exec(src)) !== null) {
            for (const resolved of resolveModuleMulti(importerDir, `./exams/\${e}/${dl[1]}`)) {
                for (const name of (moduleExports.get(resolved) || [])) {
                    if (name === 'default' || allImports.has(resolved + '::' + name)) continue;
                    const nameRe = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
                    if (nameRe.test(src)) allImports.add(resolved + '::' + name);
                }
            }
        }
        while ((dtm = DYN_IMPORT_RE.exec(src)) !== null) {
            // ${} 보존 — resolveModuleMulti가 시험 디렉터리 확장 후 쿼리스트링 제거
            for (const resolved of resolveModuleMulti(importerDir, dtm[1].split('?')[0])) {
                for (const name of (moduleExports.get(resolved) || [])) {
                    if (name === 'default' || allImports.has(resolved + '::' + name)) continue;
                    const nameRe = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
                    if (nameRe.test(src)) allImports.add(resolved + '::' + name);
                }
            }
        }
    }

    // 의도된 공개 API 억제: 선언부 바로 위 주석에 'keep-export' 가 있으면 경고 제외
    function isKeptExport(src, name) {
        const lines = src.split('\n');
        const declRe = new RegExp(
            '^\\s*export\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+' + name + '\\b'
        );
        for (let i = 0; i < lines.length; i++) {
            if (declRe.test(lines[i])) {
                return lines.slice(Math.max(0, i - 3), i + 1).some(l => l.includes('keep-export'));
            }
        }
        return false;
    }

    // 테스트 파일이 해당 모듈 export를 사용하는지 (정적 + 동적 import)
    function testFileUses(tf, file, name) {
        const tsrc = fs.readFileSync(tf, 'utf8');
        const tdir = path.dirname(tf);
        for (const timp of parseImports(tsrc)) {
            const tresolved = resolveModule(tdir, timp.modulePath);
            if (tresolved === file && timp.names.includes(name)) return true;
        }
        // 동적 import: 모듈을 await import()하고 이름이 본문에 등장하면 사용으로 간주
        const nameRe = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        let dm;
        DYN_IMPORT_RE.lastIndex = 0;
        while ((dm = DYN_IMPORT_RE.exec(tsrc)) !== null) {
            if (resolveModule(tdir, cleanDynPath(dm[1])) === file && nameRe.test(tsrc)) {
                return true;
            }
        }
        // 계산 경로 폴백: import(pathToFileURL(join(ROOT,'src/x.js')).href) 등
        // 모듈 파일명을 직접 언급하고 이름이 본문에 있으면 사용으로 간주
        const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
        const baseName = path.basename(file);
        if ((tsrc.includes(relPath) || tsrc.includes(baseName)) && nameRe.test(tsrc)) {
            return true;
        }
        return false;
    }

    for (const file of files) {
        const exports = moduleExports.get(file) || new Set();
        const relFile = path.relative(ROOT, file).replace(/\\/g, '/');
        for (const name of exports) {
            if (name === 'default') continue;
            // star re-export가 있는 모듈은 정확한 검출이 어려우므로 스킵
            const starTargets = moduleStarReExports.get(file) || [];
            if (starTargets.length > 0) continue;
            if (!allImports.has(file + '::' + name)) {
                // 의도된 공개 API (keep-export 주석) 억제
                if (isKeptExport(fs.readFileSync(file, 'utf8'), name)) continue;
                // 테스트 파일에서 import하는지 확인 (정적 + await import())
                const testDir = path.join(ROOT, 'tests');
                if (fs.existsSync(testDir) && collectJsFiles(testDir).some(tf => testFileUses(tf, file, name))) {
                    continue;
                }
                warnings.push(
                    `${relFile}: '${name}'을(를) export하지만 아무 모듈에서 import하지 않음 (unused export)`
                );
            }
        }
    }

    // --- 결과 출력 ---
    if (errors.length > 0) {
        console.error('\n❌ Import/Export 검증 실패:\n');
        for (const e of errors) {
            console.error('  ' + e);
        }
        console.error(`\n총 ${errors.length}개 오류`);
    }

    if (warnings.length > 0) {
        console.warn('\n⚠️  Unused Import/Export 경고:\n');
        for (const w of warnings) {
            console.warn('  ' + w);
        }
        console.warn(`\n총 ${warnings.length}개 경고`);
    }

    if (errors.length > 0) {
        process.exit(1);
    }

    if (warnings.length > 0) {
        console.log(`\n✅ Import/Export 검증 통과 — ${files.length}개 파일, ${errors.length}개 오류, ${warnings.length}개 경고`);
    } else {
        console.log(`✅ Import/Export 검증 통과 — ${files.length}개 파일, 오류 없음`);
    }
}

main();
