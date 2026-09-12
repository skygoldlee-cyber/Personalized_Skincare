// config/cache.js — 캐시 TTL/최대 항목 수 중앙 관리

export const CACHE = {
  // MD/HTML 뷰어 fetch 캐시
  FETCH_CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24시간
  FETCH_CACHE_MAX_ENTRIES: 8,

  // 매뉴얼/예상문제집 MD 캐시
  MANUAL_CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24시간
  EXAM_CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24시간

  // 교재 이야기형 캐시
  STORY_CACHE_MAX_ENTRIES: 10,
};
