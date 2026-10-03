// storage-keys.js — localStorage/sessionStorage 키 중앙 관리
// @spec S-06,DA-07
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
  ACTUAL_EXAM_RESULT: 'actual_exam_result', // { passed, score|null, expectedAtReport, reportedAt, examId } — 실제 시험 결과 자가 보고
  REC_SNAPSHOT: 'rec_snapshot',        // 추천 발행 시점 과목별 정답률 기준선 — 추천 효과 추적 (recommendations.js)

  // 뽀모도로
  POMO_TOTAL_TIME: 'pomo_total_time',
  POMO_TOTAL_TIME_DATE: 'pomo_total_time_date',
  POMO_SESSION_COUNT: 'pomo_session_count',
  POMO_SESSION_DATE: 'pomo_session_date',

  // 학습 스트릭 / 데일리 챌린지
  STUDY_STREAK: 'study_streak',
  STUDY_STREAK_LAST_DATE: 'study_streak_last_date',
  STREAK_FREEZES: 'streak_freezes',   // 스트릭 복구권 보유 수 (SC-04)
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

  /* ── domain:cosmetic 계약 키 ────────────────────────────────
   * 아래 키는 src/exams/<시험id>/ 도메인 모듈이 소유한다.
   * 이 파일에 두는 이유: BACKUP_KEYS/RESET_KEYS/SYNC_EXCLUDE가
   * 플랫폼 계층에서 이 키들을 참조해야 하므로, platform → domain
   * 정적 import를 피하기 위해 중앙 레지스트리에 유지한다.
   * 시험 스코프는 scopedKey()가 <examId>: 접두사로 처리한다. ── */

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

  // Formula OS — 계산기 작업 드래프트 자동 저장 (FO-30, 세션성 — 백업·동기화 제외)
  FORMULA_CALC_DRAFT: 'formula_calc_draft',

  // Formula OS — 고대비 모드 토글 상태 (FO-31, 기기 로컬 — 백업·동기화 제외)
  FORMULA_HIGH_CONTRAST: 'formula_high_contrast',

  // Formula OS — 사용자 등록 성분 사전 (custom-ingredient-store.js, DI-06~09)
  CUSTOM_INGREDIENTS: 'custom_ingredients',

  // Formula OS — 사업 유형 프로파일 (FO-33, 기기 로컬 설정 — 백업 제외)
  FORMULA_BIZ_TYPE: 'formula_biz_type',

  // Formula OS — 유형별 체크리스트 세트 체크 상태 (FO-34, 세트별 분리 키)
  COMPLIANCE_CHECKS_MFG: 'formula_compliance_mfg',
  COMPLIANCE_CHECKS_SALES: 'formula_compliance_sales',

  // Formula OS — 표시사항 검토 폼 드래프트 (FO-35)
  FORMULA_LABEL_DRAFT: 'formula_label_draft',
  /* ── domain:cosmetic 계약 키 끝 ── */

  // Pro 기능 안내 표시 이력 — 기능별 1회 안내 (pro-upgrade.js)
  PRO_NOTICE_SEEN: 'pro_notice_seen',

  // 기능 사용 카운터 (usage-stats.js — ROAD-L5 유료가치 측정, 로컬 전용·백업/동기화 제외, GLOBAL_KEYS — 익명 유저 단위)
  USAGE_STATS: 'usage_stats',

  // 원료 DB 갱신 감지 — 마지막으로 본 ingredients contentHash (기기 로컬 마커, 백업 제외)
  INGREDIENTS_HASH: 'ingredients_hash',
  // 원료 DB 갱신 알림 — 마지막으로 알림을 본 contentHash (해시별 1회 고지용)
  INGREDIENTS_DB_NOTIFIED: 'ingredients_db_notified',

  // 식약처 고시 감지 배너 (notice-check.js) — 로컬 전용, 백업 제외
  NOTICE_CHECKED_AT: 'notice_checked_at',        // 마지막 원격 조회 시각 (24h 스로틀)
  NOTICE_DISMISSED_DATE: 'notice_dismissed_date',// 닫은 고시의 시행일 — 그 고시는 억제

  // 교재 리더
  EXAM_VIEW_POS: 'exam_view_pos_v1',   // 문제집 뷰어 이어보기 — 문서별 마지막 스크롤 위치 (exam-viewer.js)
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
  PRO_ENTITLED: 'pro_entitled',    // Pro 이용 권한 플래그 (GLOBAL_KEYS — ROAD-P1 서버 검증 전 임시 시임)

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
  STORAGE_KEYS.STREAK_FREEZES,
  STORAGE_KEYS.STUDY_CALENDAR,
  STORAGE_KEYS.STUDY_GOALS,
  STORAGE_KEYS.EXAM_DATE,
  STORAGE_KEYS.CALC_HISTORY,
  STORAGE_KEYS.FC_MIGRATED_V2,
  STORAGE_KEYS.STATEMENT_STATS,
  STORAGE_KEYS.FC_SPACED_REPETITION,  // SM-2 카드별 스케줄 — 복원 누락 시 복습 일정 리셋
  STORAGE_KEYS.FORMULA_ITEMS,
  STORAGE_KEYS.FORMULA_RULES,
  STORAGE_KEYS.BATCH_ITEMS,
  STORAGE_KEYS.CUSTOMER_ITEMS,
  STORAGE_KEYS.MATERIAL_ITEMS,
  STORAGE_KEYS.COMPLIANCE_CHECKS,
  STORAGE_KEYS.COMPLIANCE_CHECKS_MFG,   // 유형별 체크리스트 세트 — 제조업 (FO-34)
  STORAGE_KEYS.COMPLIANCE_CHECKS_SALES, // 유형별 체크리스트 세트 — 책임판매업 (FO-34)
  STORAGE_KEYS.CUSTOM_INGREDIENTS,  // 자가 등록 성분 — 백업·동기 대상 (DI-06)
  STORAGE_KEYS.FORMULA_LABEL_DRAFT, // 표시사항 검토 폼 — 작업 데이터 (FO-35)
];

// 전체 초기화(Reset Progress) 시 제거할 키 목록
// (백업 키 + 초기화 필요 추가 키)
export const RESET_KEYS = [
  ...BACKUP_KEYS,
  STORAGE_KEYS.POMO_SESSION_COUNT,
  STORAGE_KEYS.POMO_SESSION_DATE,
  STORAGE_KEYS.FC_SPACED_REPETITION,
  STORAGE_KEYS.REC_SNAPSHOT,
  STORAGE_KEYS.READER_LAST_POSITION,
  STORAGE_KEYS.EXAM_VIEW_POS,
  STORAGE_KEYS.USAGE_STATS,
  STORAGE_KEYS.FORMULA_CALC_DRAFT,  // 전체 초기화 시 미저장 작업도 함께 제거
];

// 동적 키 생성 헬퍼: daily_completed_YYYY-MM-DD
export function dailyCompletedKey(dateStr) {
  return `${STORAGE_KEYS.DAILY_COMPLETED_PREFIX}${dateStr}`;
}

// 동적 키 판별: daily_completed_ 접두사 여부
export function isDailyCompletedKey(key) {
  return key.startsWith(STORAGE_KEYS.DAILY_COMPLETED_PREFIX);
}
