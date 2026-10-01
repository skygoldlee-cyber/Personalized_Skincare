#!/usr/bin/env node
// @spec DA-12
/* ============================================================
 * tools/check/check_uitext.js
 * ------------------------------------------------------------
 * 시험별 UI 텍스트 치환(data-uitext) 체계의 커버리지·잔존 결합 감사.
 *
 * 멀티시험 플랫폼에서 정적 마크업의 도메인 라벨은 두 경로로 중립화된다:
 *   1) data-uitext="key" — manifest.uiText[key]가 있으면 런타임 덮어씀
 *   2) data-feature="flag" — 시험이 기능을 보유하지 않으면 요소 자체를 숨김
 *
 * 이 스크립트는 두 축을 점검한다:
 *   (a) 템플릿의 data-uitext 키 ↔ 각 시험 manifest.uiText 키 양방향 감사
 *       - 템플릿 키가 모든 시험에 없음 → dead attribute 경고
 *       - manifest 키가 템플릿에 미사용 → dead config 경고
 *       - uiText 엔트리에 title/subtitle 둘 다 없음 → 형식 오류
 *   (b) platform 분류 HTML에 시험명 계열 용어 잔존 → 오류
 *       (feature:*·domain:* 분류 파일은 도메인 전용이므로 제외)
 *
 * 사용: node tools/check/check_uitext.js
 *       npm run check:uitext
 *
 * 의존성 없음 (Node 내장 모듈만 사용).
 * ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EXAMS_PATH = path.join(ROOT, 'content', 'exams.json');
const MAP_PATH = path.join(ROOT, 'tools', 'check', 'domain-map.json');

// --- glob → RegExp (check_domain_map.js와 동일 규약) ---
function globToRegExp(glob) {
    let re = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*') {
            if (glob[i + 1] === '*') {
                re += '.*';
                i++;
                if (glob[i + 1] === '/') i++;
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

function collectHtml(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) collectHtml(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
}

function main() {
    const errors = [];
    const warnings = [];

    const examsData = JSON.parse(fs.readFileSync(EXAMS_PATH, 'utf8'));
    const exams = examsData.exams || [];

    // --- HTML 대상 수집 ---
    const htmlFiles = [
        path.join(ROOT, 'index.template.html'),
        ...collectHtml(path.join(ROOT, 'html', 'views'), []),
    ];

    // --- (a) data-uitext ↔ uiText 양방향 감사 ---
    const templateKeys = new Map(); // key → [file:line]
    const attrRe = /data-uitext="([^"]+)"/g;
    for (const f of htmlFiles) {
        const rel = path.relative(ROOT, f).split(path.sep).join('/');
        fs.readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
            let m;
            while ((m = attrRe.exec(ln))) {
                if (!templateKeys.has(m[1])) templateKeys.set(m[1], []);
                templateKeys.get(m[1]).push(`${rel}:${i + 1}`);
            }
        });
    }

    const manifestKeys = new Map(); // key → [examId]
    for (const e of exams) {
        const mp = path.join(ROOT, e.contentRoot || `content/exams/${e.id}`, 'manifest.json');
        if (!fs.existsSync(mp)) continue;
        const uiText = (JSON.parse(fs.readFileSync(mp, 'utf8')).uiText) || {};
        for (const [k, v] of Object.entries(uiText)) {
            if (!manifestKeys.has(k)) manifestKeys.set(k, []);
            manifestKeys.get(k).push(e.id);
            if (!v || typeof v !== 'object' || (!v.title && !v.subtitle)) {
                errors.push(`${e.id} uiText.${k}: title/subtitle 둘 다 없음 — 형식 오류`);
            }
        }
    }

    // uiText 소비처: 템플릿 data-uitext + 소스의 uiText.<key>/uiText['<key>'] 참조
    const usedKeys = new Set(templateKeys.keys());
    const srcFiles = [];
    (function collectJs(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) collectJs(p);
            else if (e.name.endsWith('.js')) srcFiles.push(p);
        }
    })(path.join(ROOT, 'src'));
    const jsRe = /uiText(?:\.|(\s*\[\s*['"]))([a-zA-Z][\w-]*)/g;
    for (const f of srcFiles) {
        const txt = fs.readFileSync(f, 'utf8');
        let m;
        while ((m = jsRe.exec(txt))) usedKeys.add(m[2]);
    }

    for (const [k, locs] of templateKeys) {
        if (!manifestKeys.has(k)) {
            warnings.push(`data-uitext="${k}" (${locs.join(', ')}): 어떤 시험의 uiText에도 없는 키 — 항상 정적 라벨로 렌더됨`);
        }
    }
    for (const [k, ids] of manifestKeys) {
        if (!usedKeys.has(k)) {
            warnings.push(`uiText.${k} (${ids.join(', ')}): 템플릿·소스에서 미사용 키 — dead config`);
        }
    }

    // --- (b) platform 분류 HTML의 시험명 용어 잔존 ---
    // 도메인 용어 후보: 각 시험의 name·shortName (공백 단위 분절 포함)
    const termSet = new Set();
    for (const e of exams) {
        for (const v of [e.name, e.shortName]) {
            if (!v) continue;
            termSet.add(v);
            v.split(/\s+/).forEach((p) => p.length >= 2 && termSet.add(p));
        }
    }
    const terms = [...termSet].sort((a, b) => b.length - a.length)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const termRe = terms.length ? new RegExp(terms.join('|')) : null;

    // domain-map.json 기준으로 platform 분류 판정
    const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
    const compiled = (map.rules || []).map((r) => ({
        layer: r.layer,
        catchAll: !!r.catchAll,
        regexes: (r.patterns || []).map(globToRegExp),
    }));
    const classify = (rel) => {
        const hit = compiled.find((c) => !c.catchAll && c.regexes.some((re) => re.test(rel)));
        if (hit) return hit.layer;
        const ca = compiled.find((c) => c.catchAll && c.regexes.some((re) => re.test(rel)));
        return ca ? ca.layer : 'platform';
    };

    if (termRe) {
        for (const f of htmlFiles) {
            const rel = path.relative(ROOT, f).split(path.sep).join('/');
            const layer = classify(rel);
            if (layer !== 'platform') continue; // feature:*/domain:* 파일은 도메인 전용 — 제외
            fs.readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
                // 주석·data-uitext 속성 라인 자체는 라벨이 아니므로 제외
                const code = ln.replace(/<!--[\s\S]*?-->/g, '');
                const m = code.match(termRe);
                if (m) {
                    errors.push(`${rel}:${i + 1}: platform 분류 마크업에 시험 용어 "${m[0]}" 잔존 — data-uitext/동적 치환/중립 문구로 교체 필요`);
                }
            });
        }
    }

    // --- 출력 ---
    console.log('[check:uitext] UI 텍스트 커버리지 감사');
    console.log(`  data-uitext 키 ${templateKeys.size}개 · manifest uiText 키 ${manifestKeys.size}개 · platform HTML ${htmlFiles.filter((f) => classify(path.relative(ROOT, f).split(path.sep).join('/')) === 'platform').length}개 스캔`);
    if (warnings.length) {
        console.warn('\n⚠️  경고:');
        warnings.forEach((w) => console.warn('  ' + w));
    }
    if (errors.length) {
        console.error('\n❌ 오류:');
        errors.forEach((e2) => console.error('  ' + e2));
        process.exit(1);
    }
    console.log('\n✅ uiText 커버리지 정합 — platform 마크업에 시험 용어 잔존 없음');
}

main();
