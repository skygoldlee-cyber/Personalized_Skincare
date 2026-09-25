// storage-keys.js — localStorage/sessionStorage 키 중앙 관리
// 모든 저장소 키는 이 모듈에서 import하여 사용한다.
// 키 추가/변경 시 이 파일만 수정하면 된다.

export const STORAGE_KEYS = {
  // 플래시카드
  FC_MEMORIZED: 'fc_memorized',
  FC_WEAK: 'fc_weak',
  FC_SPACED_REPETITION: 'fc_spaced_repetition',
  FC_MIGRATED_V2: 'fc_migrated_v2',

  // 퀴즈 / 시험
  QUIZ_RESULTS: 'quiz_results',
  QUIZ_WRONG_CAUSES: 'quiz_wrong_causes',  // { itemId: { cause, ts, subjectId } } — 오답 원인 자가 태깅
  SIM_RESULTS_HISTORY: 'sim_results_history',
  SIM_DRAFT_SESSION: 'sim_draft_session',
  ACTUAL_EXAM_RESULT: 'actual_exam_result', // { passed, score|null, reportedAt, examId } — 실제 시험 결과 자가 보고

  // 뽀모도로
  POMO_TOTAL_TIME: 'pomo_total_time',
  POMO_TOTAL_TIME_DATE: 'pomo_total_time_date',
  POMO_SESSION_COUNT: 'pomo_session_count',
  POMO_SESSION_DATE: 'pomo_session_date',

  // 학습 스트릭 / 데일리 챌린지
  STUDY_STREAK: 'study_streak',
  STUDY_STREAK_LAST_DATE: 'study_streak_last_date',
  DAILY_COMPLETED_PREFIX: 'daily_completed_',

  // 학습 캘린더 (날짜별 학습 여부)
  STUDY_CALENDAR: 'study_calendar',  // { "2026-09-12": { cards: 5, quizzes: 3, correct: 2 } }

  // 학습 목표
  STUDY_GOALS: 'study_goals',  // { dailyCards: 50, dailyQuizzes: 10, weeklyStudyDays: 5 }
  EXAM_DATE: 'exam_date',      // 'YYYY-MM-DD' — 시험일 (D-day 역산)

  // 트레이너
  CALC_HISTORY: 'calc_history',

  // 복수정답형/OX 진술 단위 오판 통계 (statement-tracker.js)
  STATEMENT_STATS: 'statement_stats',

  // Formula OS — My Formula 저장소 (formula-store.js)
  FORMULA_ITEMS: 'formula_items',

  // Formula OS — 사용자 맞춤 추천 규칙 (formula-rules.js)
  FORMULA_RULES: 'formula_rules',

  // Formula OS — 조제 기록 배치 (batch-store.js)
  BATCH_ITEMS: 'batch_items',

  // Formula OS — 고객 카드·상담 이력 (customer-store.js)
  CUSTOMER_ITEMS: 'customer_items',

  // Formula OS — 원료 장부 (material-ledger.js)
  MATERIAL_ITEMS: 'material_items',

  // Formula OS — 법규 준수 체크리스트 체크 상태 (formula-compliance.js)
  COMPLIANCE_CHECKS: 'formula_compliance',

  // 원료 DB 갱신 감지 — 마지막으로 본 ingredients contentHash (기기 로컬 마커, 백업 제외)
  INGREDIENTS_HASH: 'ingredients_hash',
  // 원료 DB 갱신 알림 — 마지막으로 알림을 본 contentHash (해시별 1회 고지용)
  INGREDIENTS_DB_NOTIFIED: 'ingredients_db_notified',

  // 교재 리더
  READER_LAST_POSITION: 'readerLastPosition',
  READER_FONT_SCALE: 'readerFontScale',
  READER_LINE_HEIGHT: 'readerLineHeight',
  READER_BOOKMARKS: 'readerBookmarks',

  // 설정
  APP_THEME: 'appTheme',
  PREFERRED_ORIENTATION: 'preferredOrientation',
  UI_MODE: 'ui_mode',                      // 'study' | 'practice' (합격 후 실무 모드)
  UI_STUDY_TOOLS_OPEN: 'ui_study_tools_open',  // 실무 모드 내 학습 도구 펼침 상태

  // 클라우드 동기화 (sync.js — Phase 2)
  SYNC_DIRTY: 'sync_dirty',        // 미동기화 로컬 변경 존재 ('1'/'0')
  SYNC_LAST_TS: 'sync_last_ts',    // 마지막으로 반영/푸시한 원격 updated_at
  SYNC_CONFLICT_BACKUP: 'sync_conflict_backup', // 충돌 시 미선택 쪽 스냅샷 보존
  DEVICE_ID: 'device_id',          // 기기 식별 UUID (GLOBAL_KEYS — 시험 무관)

  // 세션 (sessionStorage)
  INAPP_GUIDE_SHOWN: '__inappGuideShown',
};

// 백업/복원 대상 정적 키 목록 (동적 키는 DAILY_COMPLETED_PREFIX로 별도 처리)
export const BACKUP_KEYS = [
  STORAGE_KEYS.FC_MEMORIZED,
  STORAGE_KEYS.FC_WEAK,
  STORAGE_KEYS.QUIZ_RESULTS,
  STORAGE_KEYS.QUIZ_WRONG_CAUSES,
  STORAGE_KEYS.SIM_RESULTS_HISTORY,
  STORAGE_KEYS.SIM_DRAFT_SESSION,
  STORAGE_KEYS.ACTUAL_EXAM_RESULT,
  STORAGE_KEYS.POMO_TOTAL_TIME,
  STORAGE_KEYS.POMO_TOTAL_TIME_DATE,
  STORAGE_KEYS.STUDY_STREAK,
  STORAGE_KEYS.STUDY_STREAK_LAST_DATE,
  STORAGE_KEYS.STUDY_CALENDAR,
  STORAGE_KEYS.STUDY_GOALS,
  STORAGE_KEYS.EXAM_DATE,
  STORAGE_KEYS.CALC_HISTORY,
  STORAGE_KEYS.FC_MIGRATED_V2,
  STORAGE_KEYS.STATEMENT_STATS,
  STORAGE_KEYS.FORMULA_ITEMS,
  STORAGE_KEYS.FORMULA_RULES,
  STORAGE_KEYS.BATCH_ITEMS,
  STORAGE_KEYS.CUSTOMER_ITEMS,
  STORAGE_KEYS.MATERIAL_ITEMS,
  STORAGE_KEYS.COMPLIANCE_CHECKS,
];

// 전체 초기화(Reset Progress) 시 제거할 키 목록
// (백업 키 + 초기화 필요 추가 키)
export const RESET_KEYS = [
  ...BACKUP_KEYS,
  STORAGE_KEYS.POMO_SESSION_COUNT,
  STORAGE_KEYS.POMO_SESSION_DATE,
  STORAGE_KEYS.FC_SPACED_REPETITION,
  STORAGE_KEYS.READER_LAST_POSITION,
];

// 동적 키 생성 헬퍼: daily_completed_YYYY-MM-DD
export function dailyCompletedKey(dateStr) {
  return `${STORAGE_KEYS.DAILY_COMPLETED_PREFIX}${dateStr}`;
}

// 동적 키 판별: daily_completed_ 접두사 여부
export function isDailyCompletedKey(key) {
  return key.startsWith(STORAGE_KEYS.DAILY_COMPLETED_PREFIX);
}
