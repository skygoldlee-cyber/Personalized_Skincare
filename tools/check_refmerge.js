#!/usr/bin/env node
// tools/check_refmerge.js — ref_md joinWraps 병합 품질 감사
//
// ref_md는 인용 라인번호 보존을 위해 시각적 줄 유지로 변환되고(segment=False),
// 표시 시 parseMarkdown(joinWraps)가 연속줄을 병합한다. 이 스크립트는 전체
// ref_md 문서에 병합을 적용해 의심 패턴을 리포트한다.
//
//   node tools/check_refmerge.js           전체 감사 (HIGH 0이면 종료코드 0)
//   node tools/check_refmerge.js --verbose 의심 항목 전체 출력
//
// 감사 항목:
//   HIGH  struct-merge   병합 연속줄(span)이 구조 마커(제N조·가.·① 등)로 시작
//   HIGH  date-in-li     날짜 꼬리("2018. 3. 13.>")가 <li>로 오분류
//   HIGH  header-merge   병합 연속줄이 문서 제목(러닝헤더)과 정확히 일치
//   MED   long-merge     병합 문단 원문이 비정상적으로 김 (900자 초과)
//   MED   sep-join       한글↔한글 무공백 결합 (띄어쓰기 소실 가능성 — 추정)
//   INFO  stats          문서 수, 병합 문단 수, <ol>/<ul> 블록 수

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const VERBOSE = process.argv.includes('--verbose');
const ROOT = path.resolve(__dirname, '..');
const REF_MD = path.join(ROOT, 'content/exams/cosmetic/참조자료/ref_md');

function* walk(dir) {
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) yield* walk(p);
        else if (name.endsWith('.md')) yield p;
    }
}

// 병합 span 직후 문자열이 구조 마커로 시작 = 연속줄 오병합
const SPAN_STRUCT = /<span data-md-line="\d+">(제\s*\d+\s*(?:조|장|편|절|관)|[①-⑳㉑-㉟]|[가-힣][.)]\s|\([가-힣\d]+\)|부칙|별[표지첨]|【|※)/g;
const DATE_IN_LI = /<li>\d{4}\.\s*\d/g;
// 한글 명사형 끝 + 한글 시작 무공백 결합 (띄어쓰기 소실 추정 — 오탐 다수 가능)
const SEP_JOIN = /[가-힣]<\/span><span data-md-line="\d+">[가-힣]/g;

async function main() {
    const { parseMarkdown } = await import(pathToFileURL(path.join(ROOT, 'src/markdown-parser.js')));

    let docs = 0, mergedParas = 0, listBlocks = 0;
    const findings = [];

    for (const file of walk(REF_MD)) {
        docs++;
        const md = fs.readFileSync(file, 'utf8');
        const html = parseMarkdown(md, { joinWraps: true, addLineNumbers: true });
        const rel = path.basename(file);

        // 문서 제목 (러닝헤더 판별용)
        const h1 = md.split(/\r?\n/).map(l => l.trim()).find(t => /^#\s/.test(t));
        const docTitle = h1 ? h1.replace(/^#\s+/, '').split(/[(<]/)[0].trim() : null;

        for (const m of html.matchAll(SPAN_STRUCT)) {
            findings.push({ sev: 'HIGH', kind: 'struct-merge', file: rel,
                text: '…' + html.slice(Math.max(0, m.index - 40), m.index + m[0].length + 20).replace(/<[^>]+>/g, '·') });
        }
        for (const m of html.matchAll(DATE_IN_LI)) {
            findings.push({ sev: 'HIGH', kind: 'date-in-li', file: rel, text: html.slice(m.index, m.index + 50) });
        }
        if (docTitle) {
            const hdr = new RegExp(`<span data-md-line="\\d+">${docTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`, 'g');
            for (const m of html.matchAll(hdr)) {
                findings.push({ sev: 'HIGH', kind: 'header-merge', file: rel, text: m[0] });
            }
        }
        for (const m of html.matchAll(SEP_JOIN)) {
            findings.push({ sev: 'MED', kind: 'sep-join', file: rel, text: m[0].replace(/<[^>]+>/g, '|') });
        }

        const paras = html.match(/<p[^>]*>.*?<\/p>/gs) || [];
        for (const p of paras) {
            if ((p.match(/data-md-line/g) || []).length > 1) {
                mergedParas++;
                const text = p.replace(/<[^>]+>/g, '');
                if (text.length > 900) {
                    findings.push({ sev: 'MED', kind: 'long-merge', file: rel, text: text.slice(0, 60) });
                }
            }
        }
        listBlocks += (html.match(/<[ou]l>/g) || []).length;
    }

    const high = findings.filter(f => f.sev === 'HIGH');
    const med = findings.filter(f => f.sev === 'MED');

    console.log(`ref_md joinWraps 감사: ${docs}개 문서`);
    console.log(`  병합 문단 ${mergedParas} · 목록 블록 ${listBlocks}`);
    console.log(`  HIGH ${high.length} · MED ${med.length}`);

    const show = VERBOSE ? findings : high.length ? high : med.slice(0, 20);
    for (const f of show.slice(0, 80)) {
        console.log(`  [${f.sev}] ${f.kind} ${f.file}: ${f.text.replace(/\s+/g, ' ')}`);
    }
    if (!VERBOSE && !high.length && med.length > 20) {
        console.log(`  … MED ${med.length - 20}건 생략 (--verbose)`);
    }

    if (high.length > 0) {
        console.log('❌ HIGH 의심 항목 존재 — 병합 규칙 검토 필요');
        process.exit(1);
    }
    console.log('✅ HIGH 의심 항목 없음');
}

main().catch(err => { console.error(err); process.exit(1); });
