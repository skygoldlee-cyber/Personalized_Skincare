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
  SIM_RESULTS_HISTORY: 'sim_results_history',
  SIM_DRAFT_SESSION: 'sim_draft_session',

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

  // 트레이너
  CALC_HISTORY: 'calc_history',

  // 교재 리더
  READER_LAST_POSITION: 'readerLastPosition',
  READER_FONT_SCALE: 'readerFontScale',
  READER_LINE_HEIGHT: 'readerLineHeight',
  READER_BOOKMARKS: 'readerBookmarks',

  // 설정
  APP_THEME: 'appTheme',
  PREFERRED_ORIENTATION: 'preferredOrientation',

  // 세션 (sessionStorage)
  INAPP_GUIDE_SHOWN: '__inappGuideShown',
};

// 백업/복원 대상 정적 키 목록 (동적 키는 DAILY_COMPLETED_PREFIX로 별도 처리)
export const BACKUP_KEYS = [
  STORAGE_KEYS.FC_MEMORIZED,
  STORAGE_KEYS.FC_WEAK,
  STORAGE_KEYS.QUIZ_RESULTS,
  STORAGE_KEYS.SIM_RESULTS_HISTORY,
  STORAGE_KEYS.SIM_DRAFT_SESSION,
  STORAGE_KEYS.POMO_TOTAL_TIME,
  STORAGE_KEYS.POMO_TOTAL_TIME_DATE,
  STORAGE_KEYS.STUDY_STREAK,
  STORAGE_KEYS.STUDY_STREAK_LAST_DATE,
  STORAGE_KEYS.STUDY_CALENDAR,
  STORAGE_KEYS.STUDY_GOALS,
  STORAGE_KEYS.CALC_HISTORY,
  STORAGE_KEYS.FC_MIGRATED_V2,
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
