// tools/build/story_merge.js — 표준형 교재 + 서사 패치 → 이야기형 교재 병합 엔진
// @spec none (콘텐츠 빌드 도구)
//
// 개념:
//   - *_표준형.md 가 본문의 유일한 원본(canonical)
//   - story/<base>_서사.md 패치 파일이 서사·전면 섹션·제목 부제만 정의
//   - 이 엔진이 둘을 병합해 *_이야기형.md 를 생성한다 (생성물 — 직접 편집 금지)
//
// 패치 파일 문법 (HTML 주석 지시어):
//   <!-- @insert before="정확한 한 줄" -->      해당 줄 앞에 삽입
//   <!-- @insert before="..." story -->          위와 동일, story:start/end로 감쌈
//   <!-- @insert after="..." -->                 해당 줄 뒤에 삽입
//   <!-- @insert at="start" --> / at="end"       문서 처음/끝에 삽입
//   <!-- @suffix line="정확한 한 줄" -->          해당 줄 끝에 텍스트 부착 (제목 부제 등)
//   <!-- @replace line="정확한 한 줄" -->         해당 줄을 블록 내용으로 교체
//   각 블록은 <!-- /@ --> 로 닫는다.
//   앵커 줄이 표준형에 여러 번 나오면 n="2" 등으로 몇 번째인지 지정한다.
'use strict';

const STORY_START = '<!-- story:start -->';
const STORY_END = '<!-- story:end -->';

// 생성된 이야기형 파일 최상단에 붙는 배너 — 수동 편집 방지
const GEN_BANNER = '<!-- ⚠️ 자동 생성 파일 — 직접 편집 금지. 본문은 *_표준형.md, 서사는 story/*_서사.md 패치를 편집하고 npm run build:story로 재생성하세요. -->';

// 표준형에 삽입되는 슬롯 마커 — 텍스트 앵커 대신 안정 ID로 서사 삽입 지점을 고정한다
const SLOT_RE = /^<!-- story:slot:([\w-]+) -->$/;

function norm(s) { return s.replace(/\r\n/g, '\n'); }

/** 라인 기반 LCS diff — ops: {t:'eq'|'del'|'ins', ai?, bi?} (a=표준, b=비교본) */
function diffLines(a, b) {
    const n = a.length, m = b.length;
    const dp = new Uint32Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            const k = i * (m + 1) + j;
            dp[k] = a[i] === b[j]
                ? dp[k + m + 2] + 1
                : Math.max(dp[k + m + 1], dp[k + 1]);
        }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) { ops.push({ t: 'eq', ai: i, bi: j }); i++; j++; }
        else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) { ops.push({ t: 'del', ai: i }); i++; }
        else { ops.push({ t: 'ins', bi: j }); j++; }
    }
    while (i < n) ops.push({ t: 'del', ai: i++ });
    while (j < m) ops.push({ t: 'ins', bi: j++ });
    return ops;
}

/** 이야기형 텍스트를 본문(story 블록 제거)과 서사 블록 목록으로 분해 */
function splitStoryBlocks(text) {
    const lines = norm(text).split('\n');
    const body = [];
    const blocks = [];
    let cur = null;
    for (const l of lines) {
        if (l.trim() === STORY_START) { cur = []; continue; }
        if (l.trim() === STORY_END) {
            if (cur) blocks.push({ lines: cur, bodyIdx: body.length });
            cur = null; continue;
        }
        if (cur) cur.push(l); else body.push(l);
    }
    if (cur) throw new Error('story:start/end 마커 불일치 — 닫히지 않은 story 블록');
    return { body, blocks };
}

/** 연속된 비일치 구간을 헝크로 묶는다. 다음 eq 쌍까지 포함. */
function groupHunks(ops) {
    const hunks = [];
    let cur = null;
    for (const op of ops) {
        if (op.t === 'eq') {
            if (cur) { cur.nextEq = op; hunks.push(cur); cur = null; }
        } else {
            if (!cur) cur = { dels: [], inss: [], nextEq: null };
            (op.t === 'del' ? cur.dels : cur.inss).push(op);
        }
    }
    if (cur) hunks.push(cur);
    return hunks;
}

/** std[ai] 줄이 std 내에서 몇 번째 등장인지 (1-based) */
function occurrence(lines, idx) {
    let k = 0;
    for (let i = 0; i <= idx; i++) if (lines[i] === lines[idx]) k++;
    return k;
}

function anchorNeedsN(lines, line) {
    let c = 0;
    for (const l of lines) if (l === line) c++;
    return c > 1;
}

/**
 * 기존 이야기형 텍스트에서 패치 ops를 추출한다.
 * 반환: { ops:[...], drift:[{ai,delLines,insLines}] }
 *   - ins 전용 헝크 → insert-extra
 *   - del+ins 혼합: 인접 페어가 suffix 패턴이면 suffix op, 단일 헤딩 교체는 replace op,
 *     그 외는 drift (정규화 시 표준형으로 복원됨)
 *   - story 블록 → story insert (앵커 = 표준형의 다음 공통 줄 또는 rename 대상 줄)
 */
function extractPatch(storyText, stdText) {
    const std = norm(stdText).split('\n');
    const { body, blocks } = splitStoryBlocks(storyText);
    const ops = diffLines(std, body);
    const hunks = groupHunks(ops);

    const patchOps = [];   // {sortAi, order, op}
    const drift = [];
    const renamedByBi = new Map(); // stripped bi → std ai (rename 페어)
    let order = 0;

    for (const h of hunks) {
        const nextAi = h.nextEq ? h.nextEq.ai : -1;
        const anchorLine = nextAi >= 0 ? std[nextAi] : null;
        if (!h.dels.length) {
            // 순수 추가 → insert-extra
            patchOps.push({
                sortAi: nextAi >= 0 ? nextAi : Infinity, order: order++,
                op: { kind: 'insert', where: nextAi >= 0 ? 'before' : 'end', anchor: anchorLine, anchorAi: nextAi, story: false, lines: h.inss.map(x => body[x.bi]) },
            });
        } else if (!h.inss.length) {
            drift.push({ ai: h.dels[0].ai, delLines: h.dels.map(x => std[x.ai]), insLines: [] });
        } else if (h.dels.length === h.inss.length &&
                   h.dels.every((d, k) => body[h.inss[k].bi].startsWith(std[d.ai]) && body[h.inss[k].bi].length > std[d.ai].length)) {
            // suffix 페어 (제목 부제 등)
            h.dels.forEach((d, k) => {
                renamedByBi.set(h.inss[k].bi, d.ai);
                patchOps.push({
                    sortAi: d.ai, order: order++,
                    op: { kind: 'suffix', anchor: std[d.ai], anchorAi: d.ai, text: body[h.inss[k].bi].slice(std[d.ai].length) },
                });
            });
        } else if (h.dels.length === 1 && h.inss.length === 1 &&
                   /^#{1,6} /.test(std[h.dels[0].ai]) && /^#{1,6} /.test(body[h.inss[0].bi])) {
            // 헤딩 단일 교체
            renamedByBi.set(h.inss[0].bi, h.dels[0].ai);
            patchOps.push({
                sortAi: h.dels[0].ai, order: order++,
                op: { kind: 'replace', anchor: std[h.dels[0].ai], anchorAi: h.dels[0].ai, lines: [body[h.inss[0].bi]] },
            });
        } else {
            drift.push({
                ai: h.dels[0].ai,
                delLines: h.dels.map(x => std[x.ai]),
                insLines: h.inss.map(x => body[x.bi]),
            });
        }
    }

    // story 블록 → insert-story. 앵커 = bodyIdx 이후 첫 eq std 줄 또는 rename 페어의 std 줄
    // bi → ai 매핑 준비
    const eqByBi = new Map();
    for (const op of ops) if (op.t === 'eq') eqByBi.set(op.bi, op.ai);
    for (const blk of blocks) {
        let ai = -1;
        for (let bi = blk.bodyIdx; bi < body.length; bi++) {
            if (eqByBi.has(bi)) { ai = eqByBi.get(bi); break; }
            if (renamedByBi.has(bi)) { ai = renamedByBi.get(bi); break; }
        }
        patchOps.push({
            sortAi: ai >= 0 ? ai : Infinity, order: order++,
            op: { kind: 'insert', where: ai >= 0 ? 'before' : 'end', anchor: ai >= 0 ? std[ai] : null, anchorAi: ai, story: true, lines: blk.lines },
        });
    }

    patchOps.sort((x, y) => x.sortAi - y.sortAi || x.order - y.order);
    return { ops: patchOps.map(x => x.op), drift, std };
}

/** ops → 패치 파일 텍스트 */
function formatPatch(ops, stdLines, headerLines) {
    const q = s => s.replace(/"/g, '\\"');
    const out = [...headerLines, ''];
    for (const op of ops) {
        let dir;
        if (op.kind === 'insert') {
            const loc = op.where === 'end' ? 'at="end"' :
                op.where === 'start' ? 'at="start"' :
                `${op.where}="${q(op.anchor)}"${anchorNeedsN(stdLines, op.anchor) ? ` n="${occurrence(stdLines, op.anchorAi)}"` : ''}`;
            dir = `@insert ${loc}${op.story ? ' story' : ''}`;
        } else if (op.kind === 'suffix' || op.kind === 'replace') {
            const n = anchorNeedsN(stdLines, op.anchor) ? ` n="${occurrence(stdLines, op.anchorAi)}"` : '';
            dir = `@${op.kind} line="${q(op.anchor)}"${n}`;
        }
        out.push(`<!-- ${dir} -->`);
        out.push(...(op.kind === 'suffix' ? [op.text] : op.lines));
        out.push('<!-- /@ -->', '');
    }
    return out.join('\n');
}

const DIR_RE = /^\s*<!--\s*@(\w+)\s*(.*?)\s*-->\s*$/;
const END_RE = /^\s*<!--\s*\/@\s*-->\s*$/;
const ATTR_RE = /(\w+)="((?:[^"\\]|\\.)*)"/g;

function parseAttrs(s) {
    const attrs = { flags: new Set() };
    for (const m of s.matchAll(ATTR_RE)) attrs[m[1]] = m[2].replace(/\\"/g, '"');
    for (const w of s.replace(ATTR_RE, '').split(/\s+/)) if (w) attrs.flags.add(w);
    return attrs;
}

/** 패치 파일 텍스트 → ops[] */
function parsePatch(text) {
    const lines = norm(text).split('\n');
    const ops = [];
    let cur = null;
    for (const l of lines) {
        const dm = l.match(DIR_RE);
        if (dm && !cur) {
            const a = parseAttrs(dm[2]);
            cur = { kind: dm[1], attrs: a, lines: [] };
            continue;
        }
        if (END_RE.test(l)) {
            if (!cur) throw new Error('지시어 없이 /@ 블록 종료');
            ops.push(finalizeOp(cur));
            cur = null; continue;
        }
        if (cur) cur.lines.push(l);
    }
    if (cur) throw new Error(`닫히지 않은 패치 블록: ${cur.kind}`);
    return ops;
}

function finalizeOp(b) {
    const a = b.attrs;
    if (b.kind === 'insert') {
        const story = a.flags.has('story');
        if (a.at) return { kind: 'insert', where: a.at, story, lines: b.lines };
        if (a.slot != null) return { kind: 'insert', where: 'slot', slot: a.slot, story, lines: b.lines };
        const where = a.before != null ? 'before' : a.after != null ? 'after' : null;
        if (!where) throw new Error('@insert에 before/after/at/slot 지정 필요');
        return { kind: 'insert', where, anchor: where === 'before' ? a.before : a.after, n: a.n ? +a.n : 1, story, lines: b.lines };
    }
    if (b.kind === 'suffix' || b.kind === 'replace') {
        if (a.line == null) throw new Error(`@${b.kind}에 line= 지정 필요`);
        return { kind: b.kind, anchor: a.line, n: a.n ? +a.n : 1, text: b.lines.join('\n'), lines: b.lines };
    }
    throw new Error(`알 수 없는 지시어: @${b.kind}`);
}

/** n번째 등장하는 정확히 일치하는 줄의 인덱스 (없으면 -1) */
function findAnchor(lines, line, n = 1) {
    let c = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === line && ++c === n) return i;
    }
    return -1;
}

/** 표준형 + 패치 ops → 이야기형 텍스트 */
function applyPatch(stdText, ops) {
    const lines = norm(stdText).split('\n');
    const before = new Map(), after = new Map(), atStart = [], atEnd = [];
    const lineEdits = new Map();
    const errors = [];

    const slotIdx = new Map();
    lines.forEach((l, i) => {
        const m = l.match(SLOT_RE);
        if (!m) return;
        if (slotIdx.has(m[1])) errors.push(`슬롯 마커 중복: story:slot:${m[1]} — 슬롯 ID는 표준형 내 유일해야 함`);
        else slotIdx.set(m[1], i);
    });

    for (const op of ops) {
        if (op.kind === 'insert') {
            if (op.where === 'start') { atStart.push(op); continue; }
            if (op.where === 'end') { atEnd.push(op); continue; }
            if (op.where === 'slot') {
                const idx = slotIdx.get(op.slot);
                if (idx == null) { errors.push(`슬롯 없음: slot="${op.slot}" (표준형에 <!-- story:slot:${op.slot} --> 필요)`); continue; }
                if (!after.has(idx)) after.set(idx, []);
                after.get(idx).push(op);
                continue;
            }
            const idx = findAnchor(lines, op.anchor, op.n || 1);
            if (idx < 0) { errors.push(`앵커 없음: ${op.where}="${op.anchor}"`); continue; }
            const map = op.where === 'before' ? before : after;
            if (!map.has(idx)) map.set(idx, []);
            map.get(idx).push(op);
        } else {
            const idx = findAnchor(lines, op.anchor, op.n || 1);
            if (idx < 0) { errors.push(`앵커 없음: line="${op.anchor}"`); continue; }
            if (lineEdits.has(idx)) { errors.push(`동일 줄 중복 편집: "${op.anchor}"`); continue; }
            lineEdits.set(idx, op);
        }
    }
    if (errors.length) return { text: null, errors };

    const emit = (out, op) => {
        if (op.story) {
            out.push('', STORY_START, ...op.lines, STORY_END, '');
        } else {
            out.push(...op.lines);
        }
    };

    const out = [];
    atStart.forEach(op => emit(out, op));
    lines.forEach((l, i) => {
        (before.get(i) || []).forEach(op => emit(out, op));
        const ed = lineEdits.get(i);
        if (ed) {
            if (ed.kind === 'suffix') out.push(l + ed.text);
            else out.push(...ed.lines);
        } else out.push(l);
        (after.get(i) || []).forEach(op => emit(out, op));
    });
    atEnd.forEach(op => emit(out, op));
    const text = out.join('\n')
        .replace(/\n{3,}(<!-- story:start -->)/g, '\n\n$1')
        .replace(/(<!-- story:end -->)\n{3,}/g, '$1\n\n');
    return { text, errors: [] };
}

module.exports = {
    STORY_START, STORY_END, GEN_BANNER, SLOT_RE,
    norm, diffLines, splitStoryBlocks, extractPatch, formatPatch, parsePatch, applyPatch,
};
