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
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
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
        const starMatch = clause.match(/^\*\s+as\s+(\w+)$/);

        if (starMatch) {
            names.push('*');
        } else {
            // default import: 식별자가 { 앞에 오는 경우만
            const defaultPart = clause.replace(/\{[\s\S]*\}/, '').trim();
            if (defaultPart && !defaultPart.startsWith('*')) {
                names.push('default');
            }
            // named imports (multiline-safe)
            const braceContent = clause.match(/\{([\s\S]+?)\}/);
            if (braceContent) {
                for (let part of braceContent[1].split(',')) {
                    part = part.trim();
                    if (!part) continue;
                    // "A as B" → imported name is "A" (the original export)
                    const asMatch = part.match(/^(\w+)\s+as\s+(?:\w+)$/);
                    names.push(asMatch ? asMatch[1] : part);
                }
            }
        }
        imports.push({ modulePath, names, isSideEffect: false });
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
    let m;

    // named exports: export { A, B as C }
    while ((m = EXPORT_NAMED_RE.exec(clean)) !== null) {
        const names = m[1];
        const reExportFrom = m[2];
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
                }
            } else {
                exports.add(part);
            }
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

    return { exports, starReExports };
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

// --- 메인 검증 ---
function main() {
    const files = collectJsFiles(SRC_DIR);
    const errors = [];
    const warnings = [];

    // 각 파일의 exports를 미리 수집
    const moduleExports = new Map(); // filepath → Set of export names
    const moduleStarReExports = new Map(); // filepath → array of star re-export targets

    for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        const { exports, starReExports } = parseExports(src);
        moduleExports.set(file, exports);
        moduleStarReExports.set(file, starReExports);
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
                if (name !== 'default') {
                    const refRe = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
                    if (!refRe.test(bodySrc)) {
                        warnings.push(
                            `${relFile}: '${name}'을(를) import하지만 사용하지 않음 (unused import)`
                        );
                    }
                }
            }
        }
    }

    // --- unused export 검출 ---
    // 각 export가 다른 파일에서 import되는지 추적
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
                // 테스트 파일에서 import하는지 확인
                const testDir = path.join(ROOT, 'tests');
                if (fs.existsSync(testDir)) {
                    let testUses = false;
                    for (const tf of collectJsFiles(testDir)) {
                        const tsrc = fs.readFileSync(tf, 'utf8');
                        const timports = parseImports(tsrc);
                        const tdir = path.dirname(tf);
                        for (const timp of timports) {
                            const tresolved = resolveModule(tdir, timp.modulePath);
                            if (tresolved === file && timp.names.includes(name)) {
                                testUses = true;
                                break;
                            }
                        }
                        if (testUses) break;
                    }
                    if (testUses) continue;
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
