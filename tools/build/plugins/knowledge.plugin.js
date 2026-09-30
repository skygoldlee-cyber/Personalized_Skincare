// tools/build/plugins/knowledge.plugin.js — 범용 지식DB(엔티티 사전) 소스 로딩
// @spec BP-01,DI-01
// ============================================================
// manifest.knowledge.source.type 으로 소스 형식을 선택한다:
//   "json" (기본) : {contentRoot}/knowledge/<registryKey>.json
//                   { "meta": { "version", "updatedAt", "notice" }, "items": [...] }
//   "ingredients-md" : source.dir 아래 원료 MD 표(참조자료 뷰어 겸용 원본)를
//                   ingredients.plugin 파서로 해석. source.metaFile(기본
//                   db_version.json)에서 version/updatedAt/notice/history 메타를 읽는다.
// 출력 계약(emit은 tools/build/index.js): {dataRoot}/<key>_data.<hash>.js
//   — var <schema.global> = [...items], registry[<key>] = { bundle, global, ... }
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
 * 데이터셋 JSON → 번들 페이로드.
 * @returns {{items: Array, meta: Object}}
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
    return { items, meta: (doc && doc.meta) || {} };
}

/**
 * manifest.knowledge 스키마 기준으로 지식DB 아이템과 메타를 로드한다.
 * 소스가 없으면 null을 반환한다 (schema만 registry에 기록하는 경우).
 * @param {Object} kSchema manifest.knowledge
 * @param {Object} ctx 빌드 컨텍스트 (workspaceDir/contentRoot 포함)
 * @returns {{items: Array, meta: Object}|null}
 */
function loadItems(kSchema, ctx) {
    const source = (kSchema && kSchema.source) || {};
    const contentAbs = path.join(ctx.workspaceDir, ctx.contentRoot || 'content');

    if (source.type === 'ingredients-md') {
        const dir = source.dir || '참조자료/원료';
        const items = require('./ingredients.plugin').build(null, ctx, dir);
        const metaPath = path.join(contentAbs, ...dir.split('/'), source.metaFile || 'db_version.json');
        let meta = {};
        try {
            if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch (e) {
            console.warn(`- Warning: ${source.metaFile || 'db_version.json'} 파싱 실패:`, e.message);
        }
        return { items, meta };
    }

    const srcFile = resolveDatasetPath(contentAbs, kSchema && kSchema.registryKey);
    if (!srcFile) return null;
    return loadDataset(srcFile, kSchema.registryKey);
}

module.exports = { resolveDatasetPath, loadDataset, loadItems };
