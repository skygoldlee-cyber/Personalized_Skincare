// src/glossary-query.js — 용어집 데이터 접근 추상화 계층
// GLOSSARY_INDEX 데이터 구조를 캡슐화하고, 뷰 모듈에 쿼리 API를 제공합니다.
// 데이터 구조가 변경되어도 이 파일만 수정하면 됩니다.
import { GLOSSARY_INDEX } from './keyword-index.js';

/**
 * 특정 참조문서 파일명에 해당하는 용어집 항목들을 반환합니다.
 * @param {string} refFileName - 참조문서 파일명 (예: "화장품법(법률)(제20901호)(20260402).md")
 * @param {Set<string>} [seenKeys] - 중복 방지용 Set (선택)
 * @returns {Array<{idxKey:string, keyword:string, explanation:string, refDoc:string, curated?:boolean}>}
 */
export function getGlossaryByRefFile(refFileName, seenKeys) {
    const results = [];
    const prefix = refFileName + '|';
    for (const [idxKey, entry] of Object.entries(GLOSSARY_INDEX)) {
        if (idxKey.startsWith(prefix) && (!seenKeys || !seenKeys.has(idxKey))) {
            results.push({ idxKey, ...entry });
            if (seenKeys) seenKeys.add(idxKey);
        }
    }
    return results;
}

/**
 * 여러 참조문서 파일명에 대해 용어집 항목들을 수집합니다.
 * @param {string[]} refFileNames - 참조문서 파일명 배열
 * @returns {Array<{idxKey:string, keyword:string, explanation:string, refDoc:string, curated?:boolean}>}
 */
export function getGlossaryByRefFiles(refFileNames) {
    const seenKeys = new Set();
    const results = [];
    for (const fn of refFileNames) {
        if (!fn) continue;
        results.push(...getGlossaryByRefFile(fn, seenKeys));
    }
    return results;
}

/**
 * idxKey로 단일 용어집 항목을 조회합니다.
 * @param {string} idxKey - "파일명.md|L라인번호" 형식의 키
 * @returns {{keyword:string, explanation:string, refDoc:string, curated?:boolean}|null}
 */
export function getGlossaryEntry(idxKey) {
    const entry = GLOSSARY_INDEX[idxKey];
    return entry ? { ...entry } : null;
}

/**
 * 전체 용어집 키워드 목록을 반환합니다 (본문 자동 링크용).
 * @returns {Array<{keyword:string, idxKey:string}>}
 */
export function getAllGlossaryKeywords() {
    return Object.entries(GLOSSARY_INDEX)
        .map(([idxKey, entry]) => ({ keyword: entry.keyword, idxKey }));
}
