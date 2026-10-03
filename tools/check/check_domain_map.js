#!/usr/bin/env node
// @spec DA-11
/* ============================================================
 * tools/check/check_domain_map.js
 * ------------------------------------------------------------
 * 저장소 파일의 "플랫폼 공통 / 피처 게이트 / 시험 도메인" 분류 강제.
 *
 * 왜 필요한가?
 *   멀티 시험 구조에서 도메인 결합(시험별 문구·데이터가 플랫폼 코드에
 *   내장)을 막으려면 각 파일이 어느 계층에 속하는지가 선언되어 있어야
 *   한다. domain-map.json에 분류가 명시되지 않은 신규 파일은 여기서
 *   실패하므로, 파일 추가 시점에 계층 결정이 강제된다.
 *
 * 규칙:
 *   - watchedDirs 내 모든 파일은 정확히 하나의 규칙에 매칭
 *   - catchAll 규칙은 일반 규칙 미매칭 파일만 흡수
 *   - feature 규칙의 flag는 content/exams.json 의 features 에 존재해야 함
 *   - domain:<id> 의 id는 exams.json 에 등록된 시험이어야 함
 *   - 매칭 결과가 없는(=삭제·이동된 파일의) 스테일 패턴은 오류
 *   - platform 계층 src 하위 .js 에 시험 식별 리터럴 금지 (id·name·appName·shortName·title)
 *     (불가피한 폴백은 map.examLiteralAllow에 사유를 명시해 면제)
 *
 * 자동 도메인 규칙:
 *   exams.json에 등록된 각 시험의 contentRoot/dataRoot는 자동으로
 *   domain:<id> 규칙으로 주입된다 — 새 시험 추가 시 맵 편집 불필요.
 *   같은 경로를 수동 규칙으로 선언하면 중복 매칭 오류가 난다.
 *   content/exams/·data/exams/ 아래에 미등록 id 디렉터리가 있으면 오류.
 *
 * 사용:
 *   node tools/check/check_domain_map.js
 *   npm run check:domainmap
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MAP_PATH = path.join(__dirname, 'domain-map.json');
const EXAMS_PATH = path.join(ROOT, 'content', 'exams.json');
const PKG_PATH = path.join(ROOT, 'package.json');

// --- glob → RegExp ---
// ** : 경로 구분자 포함 임의 문자열 / * : 구분자 제외 / ? : 단일 문자
function globToRegExp(glob) {
    let re = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*') {
            if (glob[i + 1] === '*') {
                re += '.*';
                i++;
                if (glob[i + 1] === '/') i++; // **/ → 디렉토리 생략 가능
            } else {
                re += '[^/]*';
            }
        } else if (c === '?') {
            re += '[^/]';
        } else {
            re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp('^' + re + '$');
}

function collectFiles(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectFiles(full, out);
        } else {
            out.push(path.relative(ROOT, full).split(path.sep).join('/'));
        }
    }
    return out;
}

function main() {
    const errors = [];
    const warnings = [];

    const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
    const rules = map.rules || [];
    const watchedDirs = map.watchedDirs || [];

    // exams.json — 시험 id·피처 플래그 원본
    const examsData = JSON.parse(fs.readFileSync(EXAMS_PATH, 'utf8'));
    const examIds = new Set((examsData.exams || []).map((e) => e.id));
    const knownFlags = new Set();
    for (const e of examsData.exams || []) {
        for (const f of Object.keys(e.features || {})) knownFlags.add(f);
    }

    // package.json 스크립트 목록 (generatedBy 검증용)
    const pkgScripts = new Set(Object.keys(JSON.parse(fs.readFileSync(PKG_PATH, 'utf8')).scripts || {}));

    // --- 규칙 정합성 ---
    const compiled = rules.map((rule, idx) => {
        const label = `rules[${idx}] (${rule.layer || 'layer 누락'})`;
        if (!rule.layer || !/^(platform|feature:[\w-]+|domain:[\w-]+)$/.test(rule.layer)) {
            errors.push(`${label}: layer 형식 오류 — platform | feature:<name> | domain:<examId>`);
        }
        if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) {
            errors.push(`${label}: patterns 누락`);
        }
        if (rule.layer && rule.layer.startsWith('feature:')) {
            if (rule.flag) {
                if (!knownFlags.has(rule.flag)) {
                    errors.push(`${label}: flag "${rule.flag}" 이 content/exams.json의 어떤 시험 features에도 없음`);
                }
            } else if (!rule.gate) {
                errors.push(`${label}: feature 규칙에는 flag 또는 gate 설명이 필요`);
            }
        }
        if (rule.layer && rule.layer.startsWith('domain:')) {
            const id = rule.layer.slice('domain:'.length);
            if (!examIds.has(id)) {
                errors.push(`${label}: domain id "${id}" 가 content/exams.json에 미등록`);
            }
        }
        if (rule.generatedBy) {
            const g = rule.generatedBy;
            if (g.startsWith('npm run ')) {
                if (!pkgScripts.has(g.slice('npm run '.length))) {
                    errors.push(`${label}: generatedBy "${g}" — package.json에 스크립트 없음`);
                }
            } else if (g.startsWith('node ') || g.startsWith('tools/')) {
                const p = g.replace(/^node\s+/, '');
                if (!fs.existsSync(path.join(ROOT, p))) {
                    errors.push(`${label}: generatedBy 경로 "${p}" 파일 없음`);
                }
            }
        }
        return { rule, label, regexes: (rule.patterns || []).map(globToRegExp) };
    });

    // --- 시험별 도메인 규칙 자동 주입 ---
    // exams.json 등록 시험의 contentRoot/dataRoot를 domain:<id>로 자동 분류.
    // 파일이 아직 없는 신규 시험은 스테일 오류 대신 경고만 낸다.
    for (const e of examsData.exams || []) {
        for (const key of ['contentRoot', 'dataRoot']) {
            const root = (e[key] || '').replace(/\\/g, '/').replace(/\/$/, '');
            if (!root) continue;
            compiled.push({
                rule: { layer: `domain:${e.id}`, implicit: true, patterns: [`${root}/**`] },
                label: `implicit(domain:${e.id} ${key})`,
                regexes: [globToRegExp(`${root}/**`)],
            });
        }
    }

    // --- 미등록 시험 디렉터리 감지 ---
    // src/exams/<id> 도 포함 — 도메인 실행 모듈 디렉터리는 등록 시험 id와 1:1 대응.
    for (const base of ['content/exams', 'data/exams', 'src/exams']) {
        const abs = path.join(ROOT, base);
        if (!fs.existsSync(abs)) continue;
        for (const d of fs.readdirSync(abs, { withFileTypes: true })) {
            if (d.isDirectory() && !examIds.has(d.name)) {
                errors.push(`미등록 시험 디렉터리: ${base}/${d.name} — content/exams.json 등록 또는 삭제 필요`);
            }
        }
    }

    // --- 파일 수집 ---
    const files = [];
    for (const d of watchedDirs) {
        const abs = path.join(ROOT, d);
        if (!fs.existsSync(abs)) {
            errors.push(`watchedDir "${d}" 디렉토리 없음`);
            continue;
        }
        collectFiles(abs, files);
    }

    // --- 매칭 ---
    const matchRule = (file, list) =>
        list.filter((c) => c.regexes.some((re) => re.test(file)));

    const normalRules = compiled.filter((c) => !c.rule.catchAll);
    const catchAllRules = compiled.filter((c) => c.rule.catchAll);
    const matchedCount = new Map(compiled.map((c) => [c.label, 0]));
    const layerOf = new Map();

    for (const file of files) {
        let hits = matchRule(file, normalRules);
        if (hits.length === 0) hits = matchRule(file, catchAllRules);
        if (hits.length === 0) {
            errors.push(`미분류 파일: ${file} — domain-map.json에 규칙 추가 필요`);
            continue;
        }
        if (hits.length > 1) {
            errors.push(`중복 분류: ${file} → ${hits.map((h) => h.rule.layer).join(', ')}`);
            continue;
        }
        matchedCount.set(hits[0].label, matchedCount.get(hits[0].label) + 1);
        layerOf.set(file, hits[0].rule.layer);
    }

    // --- platform 계층 시험 id 리터럴 금지 ---
    // 시험 id는 exams.json(EXAMS_LIST)에서 해석해야 한다. platform으로 분류된
    // src 파일이 'cosmetic' 같은 id 리터럴을 내장하면 도메인 결합이 코드에
    // 재유입되므로 차단한다. examLiteralAllow는 마지막 보루 폴백 등
    // "레지스트리 자체가 부재한 저하 상태"에서만 쓰는 예외 명단이다.
    {
        const allow = new Set(Object.keys(map.examLiteralAllow || {}));
        // 시험 식별 리터럴 = id + name/appName/shortName/title — 플랫폼 코드에
        // '식품기사' 같은 브랜드 문자열이 박히는 것도 도메인 결합이다.
        const litSet = new Set(examIds);
        for (const e of examsData.exams || []) {
            for (const k of ['name', 'appName', 'shortName', 'title']) {
                if (typeof e[k] === 'string' && e[k].length >= 2) litSet.add(e[k]);
            }
        }
        const idAlt = [...litSet].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (idAlt.length > 0) {
            const idLiteralRe = new RegExp(`['"\`](?:${idAlt.join('|')})['"\`]`);
            for (const [file, layer] of layerOf) {
                if (layer !== 'platform') continue;
                if (!/^src\/.+\.js$/.test(file)) continue;
                if (allow.has(file)) continue;
                const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
                const m = src.match(idLiteralRe);
                if (m) {
                    errors.push(
                        `${file}: platform 계층에 시험 식별 리터럴 ${m[0]} — ` +
                        `EXAMS_LIST/getActiveExam() 해석으로 대체 (폴백 필요 시 domain-map.json examLiteralAllow에 사유 명시)`
                    );
                }
            }
        }
    }

    // --- 스테일 패턴 ---
    for (const c of compiled) {
        const n = matchedCount.get(c.label) || 0;
        if (n === 0) {
            // 자동 주입 규칙은 파일이 아직 없는 신규 시험에서 0건이 정상 — 경고만
            if (c.rule.implicit) {
                warnings.push(`${c.label}: 매칭 파일 없음 (신규 시험이면 정상)`);
            } else {
                errors.push(`${c.label}: 어떤 파일에도 매칭되지 않는 스테일 규칙`);
            }
        } else {
            c.rule.patterns.forEach((p, i) => {
                if (!files.some((f) => c.regexes[i].test(f))) {
                    warnings.push(`${c.label}: 스테일 패턴 "${p}" — 매칭 파일 없음`);
                }
            });
        }
    }

    // --- 요약 ---
    const summary = {};
    for (const layer of layerOf.values()) summary[layer] = (summary[layer] || 0) + 1;

    if (errors.length > 0) {
        console.error('\n❌ 도메인 맵 검증 실패:\n');
        errors.forEach((e) => console.error('  ' + e));
        console.error(`\n총 ${errors.length}개 오류`);
    }
    if (warnings.length > 0) {
        console.warn('\n⚠️  경고:\n');
        warnings.forEach((w) => console.warn('  ' + w));
    }

    if (errors.length > 0) process.exit(1);

    console.log(`✅ 도메인 맵 검증 통과 — ${files.length}개 파일 분류됨`);
    Object.keys(summary).sort().forEach((k) => console.log(`   ${k}: ${summary[k]}개`));
    if (warnings.length > 0) console.log(`   (스테일 패턴 경고 ${warnings.length}개)`);
}

main();
