// tools/build/plugins/knowledge.plugin.js — 범용 지식DB(엔티티 사전) 소스 로딩
// @spec BP-01,DI-01
// ============================================================
// 입력 : {contentRoot}/knowledge/<registryKey>.json
//        { "meta": { "version", "updatedAt", "notice", "history" },
//          "bundleFields": [...]?,            ← 번들에 포함할 필드만 선언(미선언=전체)
//          "emitMd": { dir, typeFile, columns, emptyCell }?,  ← 참조자료 표 재생성 설정
//          "items": [...] }
// 출력 : {dataRoot}/<registryKey>_data.<hash>.js — var <schema.global> = [...items]
//        registry[<registryKey>] = { bundle, global, contentHash, version?, stats }
//        emitMd 선언 시 {contentRoot}/<dir>/*.md 의 GENERATED-TABLE 마커 영역 재생성
//        (서술은 저작 유지, 데이터 행만 JSON에서 주입 — SSOT는 JSON)
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * knowledge 디렉터리의 데이터셋 파일 경로를 해석한다.
 * @param {string} contentRootAbs contentRoot 절대 경로
 * @param {string} registryKey 스키마의 registryKey (파일명과 일치해야 함)
 * @returns {string|null}
 */
function resolveDatasetPath(contentRootAbs, registryKey) {
    if (!registryKey) return null;
    const p = path.join(contentRootAbs, 'knowledge', `${registryKey}.json`);
    return fs.existsSync(p) ? p : null;
}

/**
 * 데이터셋 JSON → 번들 페이로드 + 참조자료 emit 설정.
 * @returns {{items: Array, meta: Object, bundleFields: Array|null, emitMd: Object|null}}
 */
function loadDataset(filePath, registryKey) {
    let doc;
    try {
        doc = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        throw new Error(`knowledge/${registryKey}.json 파싱 실패: ${e.message}`);
    }
    const items = doc && Array.isArray(doc.items) ? doc.items : null;
    if (!items || !items.length) {
        throw new Error(`knowledge/${registryKey}.json: items 배열이 비어 있습니다.`);
    }
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || typeof it !== 'object' || !it.name) {
            throw new Error(`knowledge/${registryKey}.json: items[${i}]에 name이 없습니다.`);
        }
    }
    return {
        items,
        meta: (doc && doc.meta) || {},
        bundleFields: Array.isArray(doc && doc.bundleFields) ? doc.bundleFields : null,
        emitMd: (doc && doc.emitMd) || null
    };
}

/**
 * 번들 페이로드용 필드 투영 — bundleFields 선언 시 해당 필드만 추출한다.
 * (참조자료 표 전용 컬럼 등 번들이 필요 없는 필드를 제외해 번들 크기를 유지)
 */
function projectItems(items, bundleFields) {
    if (!bundleFields || !bundleFields.length) return items;
    return items.map(it => {
        const o = {};
        bundleFields.forEach(f => { if (f in it) o[f] = it[f]; });
        return o;
    });
}

const TABLE_BEGIN = /<!--\s*GENERATED-TABLE:BEGIN\s+table="([^"]+)"\s*-->/;
const TABLE_END = /<!--\s*GENERATED-TABLE:END\s*-->/;

function fmtCell(value, col, emptyCell) {
    let v = value == null ? '' : String(value);
    if (!v.trim() || /^[-–—\s]*$/.test(v)) v = emptyCell;
    v = v.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
    return col.bold ? `**${v}**` : v;
}

/**
 * 아이템 목록 → 마크다운 표 문자열.
 * @param {Array} items 대상 아이템 (JSON 배열 순서 = 표 행 순서)
 * @param {Array} columns emitMd.columns [{field,label,bold?}]
 * @param {string} emptyCell 빈 셀 표기 (기본 '-')
 */
function renderTable(items, columns, emptyCell) {
    const empty = emptyCell || '-';
    const lines = [
        `| ${columns.map(c => c.label).join(' | ')} |`,
        `|${columns.map(() => '--------').join('|')}|`
    ];
    items.forEach(it => {
        lines.push(`| ${columns.map(c => fmtCell(it[c.field], c, empty)).join(' | ')} |`);
    });
    return lines.join('\n');
}

/**
 * emitMd 설정 기준으로 참조자료 MD의 GENERATED-TABLE 마커 영역을 재생성한다.
 * - 아이템의 정본 표: typeFile[item.type] 파일의 item.table 이름 마커
 * - 추가 소속: item.tables 배열의 "파일#표이름" 항목
 * @returns {string[]} 갱신된 파일의 절대 경로 목록
 */
function emitRefDocs(doc, items, contentAbs) {
    const cfg = doc.emitMd;
    if (!cfg || !cfg.dir || !Array.isArray(cfg.columns) || !cfg.columns.length) return [];
    const dirAbs = path.join(contentAbs, ...cfg.dir.split('/'));
    const typeFile = cfg.typeFile || {};

    const targetFiles = new Set(Object.values(typeFile));
    items.forEach(it => (it.tables || []).forEach(t => targetFiles.add(String(t).split('#')[0])));

    const written = [];
    const usedTables = new Set();
    targetFiles.forEach(file => {
        const filePath = path.join(dirAbs, file);
        if (!fs.existsSync(filePath)) return;
        const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
        const out = [];
        let changed = false;
        for (let i = 0; i < lines.length; i++) {
            out.push(lines[i]);
            const m = lines[i].match(TABLE_BEGIN);
            if (!m) continue;
            const tableId = m[1];
            const rows = items.filter(it =>
                (typeFile[it.type] === file && it.table === tableId) ||
                (it.tables || []).includes(`${file}#${tableId}`)
            );
            const generated = renderTable(rows, cfg.columns, cfg.emptyCell).split('\n');
            let j = i + 1;
            while (j < lines.length && !TABLE_END.test(lines[j])) j++;
            if (j >= lines.length) throw new Error(`${file}: GENERATED-TABLE END 마커 없음 (table="${tableId}")`);
            generated.forEach(l => out.push(l));
            out.push(lines[j]);
            i = j;
            changed = true;
            usedTables.add(`${file}#${tableId}`);
            if (!rows.length) console.warn(`- Warning: ${file} 표 "${tableId}"에 해당하는 아이템이 없습니다.`);
        }
        if (changed) {
            fs.writeFileSync(filePath, out.join('\n'), 'utf-8');
            written.push(filePath);
        }
    });

    // 정본 표가 문서에 없는 아이템 경고 (section/table 탈락 감지)
    items.forEach(it => {
        const canon = typeFile[it.type] && it.table ? `${typeFile[it.type]}#${it.table}` : null;
        if (canon && !usedTables.has(canon) && !(it.tables || []).length) {
            console.warn(`- Warning: 지식DB 아이템 "${it.name}"의 정본 표(${canon})가 문서에 없습니다.`);
        }
    });
    return written;
}

/**
 * manifest.knowledge 스키마 기준으로 지식DB 아이템과 메타를 로드한다.
 * 소스가 없으면 null을 반환한다 (schema만 registry에 기록하는 경우).
 * @param {Object} kSchema manifest.knowledge
 * @param {Object} ctx 빌드 컨텍스트 (workspaceDir/contentRoot 포함)
 * @returns {{items: Array, meta: Object, bundleFields: Array|null, emitMd: Object|null}|null}
 */
function loadItems(kSchema, ctx) {
    const contentAbs = path.join(ctx.workspaceDir, ctx.contentRoot || 'content');
    const srcFile = resolveDatasetPath(contentAbs, kSchema && kSchema.registryKey);
    if (!srcFile) return null;
    return loadDataset(srcFile, kSchema.registryKey);
}

module.exports = { resolveDatasetPath, loadDataset, loadItems, projectItems, renderTable, emitRefDocs };
