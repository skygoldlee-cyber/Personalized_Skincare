// src/views/listeners-dictionary.js — 성분 사전 검색 바인딩 (event-listeners.js §6에서 분리)
// @spec DI-02
import { filterDictionary } from './dictionary.js';
import { debounce } from '../utils.js';

export function bindDictListeners() {
    // 성분 검색 사전 실시간 검색 이벤트 디바운스 바인딩
    const dictSearchInput = document.getElementById('dict-search-input');
    if (dictSearchInput) {
        dictSearchInput.addEventListener('input', debounce(filterDictionary, 250));
    }
}
