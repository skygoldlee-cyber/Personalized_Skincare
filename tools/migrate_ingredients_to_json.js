// tools/migrate_ingredients_to_json.js — 원료 MD → knowledge/ingredients.json 일회성 이관
// @spec BP-01
// ============================================================
// 참조자료/원료/{approved,restricted,banned}_ingredients.md 의 원료 표를
// knowledge/ingredients.json(SSOT)으로 이관하고, 원본 MD의 표 영역을
// GENERATED-TABLE 마커로 감싼다 (서술·구조는 그대로 유지).
//
//   node tools/migrate_ingredients_to_json.js            # 변환 + 검증
//   node tools/migrate_ingredients_to_json.js --dry-run  # 검증만 (파일 미기록)
//
// 검증: bundleFields 투영 결과가 기존 ingredients_data.*.js 번들과
//       이름 기준으로 완전히 동일한지 비교한다.
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { renderTable } = require('./build/plugins/knowledge.plugin');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'content/exams/cosmetic/참조자료/원료');
const OUT_JSON = path.join(ROOT, 'content/exams/cosmetic/knowledge/ingredients.json');
const DRY_RUN = process.argv.includes('--dry-run');

// ---------- 파서 (구 ingredients.plugin 규칙 — 자체 보유) ----------

const cleanText = (text) => {
    if (!text) return '';
    return text.replace(/\*\*/g, '').replace(/<br\s*\/?>/gi, '\n').trim();
};

const pick = (cells, idx) => {
    if (idx === -1 || idx == null) return '';
    const v = cleanText(cells[idx]);
    return /^[-–—\s]*$/.test(v) ? '' : v;
};

// 표시 전용 컬럼용 — 마크업(**굵게**)을 보존하는 원시 추출
const pickRaw = (cells, idx) => {
    if (idx === -1 || idx == null) return '';
    const v = (cells[idx] || '').trim();
    return /^[-–—\s]*$/.test(v) ? '' : v;
};

// 번들 계약 필드(해석값 적용) 외 표시 전용 컬럼 — 원시값을 JSON에 보존해 표 재생성 시 재현
const DISPLAY_FIELDS = ['base', 'typicalRange', 'effect', 'frequency', 'note'];

const colIdx = (headers, ...names) =>
    headers.findIndex(h => names.some(n => n === h || h.includes(n)));

// 표 헤더 → 아이템 필드 매핑 (includes 매칭 — '증상'은 '증상 효과'에 매칭)
const FIELD_MAP = [
    { names: ['원료명', '성분명'], field: 'name' },
    { names: ['영문명'], field: 'engName' },
    { names: ['카테고리'], field: 'category' },
    { names: ['베이스'], field: 'base' },
    { names: ['특성 및 설명', '특성'], field: 'description' },
    { names: ['일반 함량 범위'], field: 'typicalRange' },
    { names: ['최대 함량', '사용한도', '농도상한'], field: 'limit' },
    { names: ['증상'], field: 'effect' },
    { names: ['시험 출제 빈도'], field: 'frequency' },
    { names: ['고득점 TIP', 'TIP'], field: 'tip' },
    { names: ['비고', '예외 조건'], field: 'note' },
];

// 파일별 해석 규칙 (구 ingredients.plugin SOURCES와 동일)
const FILES = [
    {
        file: 'approved_ingredients.md',
        type: 'approved',
        resolve: (raw, section) => ({
            category: raw.category || section,
            description: raw.description || raw.note,
            limit: raw.limit,
            tip: raw.tip,
        }),
    },
    {
        file: 'restricted_ingredients.md',
        type: 'restricted',
        resolve: (raw) => ({
            category: raw.category || '사용 제한 원료',
            description: raw.description || raw.note || '사용 제한 필요한 원료',
            limit: raw.limit,
            tip: raw.tip || raw.note,
        }),
    },
    {
        file: 'banned_ingredients.md',
        type: 'banned',
        resolve: (raw) => ({
            category: raw.category || '사용 금지 원료',
            description: raw.description || raw.note || '배합 금지 성분',
            limit: raw.limit || '사용 불가 (0%)',
            tip: raw.tip || raw.effect || '화장품 제조/조제에 사용이 금지되는 원료입니다.',
        }),
    },
];

const COLUMNS = [
    { field: 'name', label: '원료명', bold: true },
    { field: 'engName', label: '영문명' },
    { field: 'category', label: '카테고리' },
    { field: 'base', label: '베이스' },
    { field: 'description', label: '특성 및 설명' },
    { field: 'typicalRange', label: '일반 함량 범위' },
    { field: 'limit', label: '최대 함량' },
    { field: 'effect', label: '증상 효과' },
    { field: 'frequency', label: '시험 출제 빈도' },
    { field: 'tip', label: '고득점 TIP' },
    { field: 'note', label: '비고' },
];

const BUNDLE_FIELDS = ['name', 'engName', 'type', 'category', 'description', 'limit', 'tip'];

// ---------- 파일 순회: 표 식별 + 행 수집 + 마커 삽입 ----------

function processFile(spec) {
    const filePath = path.join(SRC_DIR, spec.file);
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    const out = [];
    const rows = [];        // {tableId, section, raw, rowOrder}
    const tables = [];      // {tableId, section}
    let section = '';
    const seenIds = new Map();

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (/^#{1,6}\s/.test(line.trim())) {
            section = line.trim().replace(/^#{1,6}\s+/, '').trim();
            out.push(line);
            i++;
            continue;
        }
        if (!line.trim().startsWith('|')) {
            out.push(line);
            i++;
            continue;
        }
        // 표 블록 수집 (원본 라인은 구분선 포함 전부 보존)
        const rawLines = [];
        const block = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
            const t = lines[i].trim();
            rawLines.push(lines[i]);
            if (!/^\|[\s\-|:]+\|$/.test(t)) block.push(t);
            i++;
        }
        const headerCells = block[0].split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const headers = headerCells.map(cleanText);
        const nameIdx = colIdx(headers, '원료명', '성분명');
        if (nameIdx === -1 || block.length < 2) {
            // 원료 표가 아님 — 원본 그대로 통과
            rawLines.forEach(l => out.push(l));
            continue;
        }
        // 원료 표 — 마커로 감싸기
        let tableId = section || '본문';
        if (seenIds.has(tableId)) {
            const n = seenIds.get(tableId) + 1;
            seenIds.set(tableId, n);
            tableId = `${tableId}#${n}`;
        } else {
            seenIds.set(tableId, 1);
        }
        tables.push({ tableId, section });

        block.slice(1).forEach(rowLine => {
            const cells = rowLine.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            const raw = {};   // 해석용 정제값
            const disp = {};  // 표시용 원시값 (표시 전용 컬럼만)
            FIELD_MAP.forEach(({ names, field }) => {
                const idx = colIdx(headers, ...names);
                raw[field] = pick(cells, idx);
                if (DISPLAY_FIELDS.includes(field)) disp[field] = pickRaw(cells, idx);
            });
            if (!raw.name || raw.name === '원료명' || raw.name === '성분명') return;
                rows.push({ tableId, raw, disp, rowOrder: rows.length });
        });

        // 표 내용은 아이템 병합 후 2차 패스에서 렌더링 — 여기선 자리표시
        out.push(`<!-- GENERATED-TABLE:BEGIN table="${tableId}" -->`);
        out.push('__TABLE__');
        out.push('<!-- GENERATED-TABLE:END -->');
    }

    return { out, rows, tables, spec };
}

// ---------- 메인 ----------

function main() {
    // 1. 3개 파일 파싱 + 마커 삽입 초안
    const parsed = FILES.map(processFile);

    // 2. 이름 기준 병합 (마지막 발생이 정본 — 구 파서의 last-wins + 카테고리 보존 규칙 재현)
    const byName = new Map();
    parsed.forEach(({ rows, spec }, fileOrder) => {
        rows.forEach(({ tableId, raw, disp, rowOrder }) => {
            const resolved = spec.resolve(raw, tableId.replace(/#\d+$/, ''));
            const item = {
                name: raw.name,
                engName: raw.engName,
                type: spec.type,
                category: resolved.category,
                description: resolved.description,
                limit: resolved.limit,
                tip: resolved.tip,
                // 표시 전용 컬럼은 원시값 보존 (번들 미포함)
                base: disp.base,
                typicalRange: disp.typicalRange,
                effect: disp.effect,
                frequency: disp.frequency,
                note: disp.note,
                table: tableId,              // 정본 표 (정본 파일 내 마커 id)
                _fileOrder: fileOrder,       // 정본 파일 순서 (정렬용, 번들 제외)
                _rowOrder: rowOrder,
                _occs: [],                   // 모든 출현 표의 "파일#표id"
            };
            const ex = byName.get(raw.name);
            if (ex) {
                // 구 파서 규칙: banned 기본 카테고리가 이전 구체 카테고리를 덮지 않음
                if (item.category === '사용 금지 원료' && ex.category !== '사용 금지 원료') {
                    item.category = ex.category;
                }
                item._occs = ex._occs;
                // 정렬 키는 최초 출현 유지 — 구 번들의 Map 삽입 순서와 동일하게
                item._fileOrder = ex._fileOrder;
                item._rowOrder = ex._rowOrder;
            }
            item._occs.push(`${spec.file}#${tableId}`);
            byName.set(raw.name, item);
        });
    });

    // tables: 정본 외 출현 표 (중복 제거). 정본 = 마지막 발생 파일#표
    const TYPE_FILE = { approved: 'approved_ingredients.md', restricted: 'restricted_ingredients.md', banned: 'banned_ingredients.md' };
    const items = [...byName.values()];
    items.sort((a, b) => (a._fileOrder - b._fileOrder) || (a._rowOrder - b._rowOrder));
    items.forEach(it => {
        const canon = `${TYPE_FILE[it.type]}#${it.table}`;
        const extras = it._occs.filter(m => m !== canon);
        if (extras.length) it.tables = [...new Set(extras)];
        delete it._occs; delete it._fileOrder; delete it._rowOrder;
    });

    // 4. meta 흡수 (db_version.json)
    const metaPath = path.join(SRC_DIR, 'db_version.json');
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};

    const doc = {
        _comment: '원료 지식DB SSOT — items 행이 데이터, 참조자료/원료/*.md 표는 빌드가 재생성(GENERATED-TABLE 마커). meta는 구 db_version.json 계승.',
        meta,
        bundleFields: BUNDLE_FIELDS,
        emitMd: {
            dir: '참조자료/원료',
            typeFile: {
                approved: 'approved_ingredients.md',
                restricted: 'restricted_ingredients.md',
                banned: 'banned_ingredients.md',
            },
            columns: COLUMNS,
            emptyCell: '-',
        },
        items,
    };

    // 5. 검증 — 투영 결과가 기존 번들과 이름 기준 동일한지
    const bundleFile = fs.readdirSync(path.join(ROOT, 'data/exams/cosmetic'))
        .find(f => /^ingredients_data\.[0-9a-f]{8}\.js$/.test(f));
    const bundleSrc = fs.readFileSync(path.join(ROOT, 'data/exams/cosmetic', bundleFile), 'utf-8');
    const current = JSON.parse(bundleSrc.match(/var INGREDIENTS_DATA = ([\s\S]*?);\s*$/)[1]);
    const curByName = new Map(current.map(x => [x.name, x]));
    let mismatch = 0;
    for (const it of items) {
        const proj = {};
        BUNDLE_FIELDS.forEach(f => { if (f in it) proj[f] = it[f]; });
        const cur = curByName.get(it.name);
        if (!cur) { console.warn(`  신규 항목 (번들에 없음): ${it.name}`); mismatch++; continue; }
        if (JSON.stringify(proj) !== JSON.stringify(cur)) {
            if (mismatch < 10) console.warn(`  불일치: ${it.name}\n    번들: ${JSON.stringify(cur)}\n    이관: ${JSON.stringify(proj)}`);
            mismatch++;
        }
    }
    const extra = current.filter(x => !byName.has(x.name));
    extra.forEach(x => console.warn(`  이관 누락 (번들에만 있음): ${x.name}`));
    console.log(`\n검증: 아이템 ${items.length}건 (번들 ${current.length}건) — 불일치 ${mismatch}건, 누락 ${extra.length}건`);
    if (mismatch || extra.length) {
        console.error('❌ 번들 동등성 검증 실패 — 위 내용을 확인하세요.');
        process.exit(1);
    }

    if (DRY_RUN) { console.log('\n[dry-run] 파일 기록 생략'); return; }

    // 6. JSON 기록
    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
    console.log(`\n생성: ${path.relative(ROOT, OUT_JSON)} (${items.length}건)`);

    // 7. MD 재작성 — 마커 영역을 생성 표로 채움
    parsed.forEach(({ out, spec }) => {
        const filePath = path.join(SRC_DIR, spec.file);
        const result = [];
        for (let i = 0; i < out.length; i++) {
            const m = out[i].match(/GENERATED-TABLE:BEGIN table="([^"]+)"/);
            result.push(out[i]);
            if (!m) continue;
            const tableId = m[1];
            const rows = items.filter(it =>
                (TYPE_FILE[it.type] === spec.file && it.table === tableId) ||
                (it.tables || []).includes(`${spec.file}#${tableId}`)
            );
            renderTable(rows, COLUMNS, '-').split('\n').forEach(l => result.push(l));
            i++; // __TABLE__ 자리표시 + END 마커
            result.push(out[i + 1]);
            i++;
        }
        fs.writeFileSync(filePath, result.join('\n'), 'utf-8');
        console.log(`갱신: ${path.relative(ROOT, filePath)}`);
    });
    console.log('\n다음 단계: manifest.knowledge.source를 {"type":"json","validate":"ingredients"}로 전환 후 build:data');
}

main();
