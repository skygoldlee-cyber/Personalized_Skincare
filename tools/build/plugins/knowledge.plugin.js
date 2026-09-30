// tools/build/plugins/knowledge.plugin.js — 범용 지식DB(엔티티 사전) 번들 빌드
// @spec BP-01,DI-01
// ============================================================
// 입력 : {contentRoot}/knowledge/<registryKey>.json
//        { "meta": { "version", "updatedAt", "notice" }, "items": [...] }
// 출력 : {dataRoot}/<registryKey>_data.<hash>.js  — var <schema.global> = [...items]
//        registry[<registryKey>] = { bundle, global, contentHash, version?, stats }
//
// 화장품 원료 사전(ingredients)은 전용 파서(ingredients.plugin)가 담당하므로
// registryKey === 'ingredients' 는 여기서 처리하지 않는다.
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

module.exports = { resolveDatasetPath, loadDataset };
