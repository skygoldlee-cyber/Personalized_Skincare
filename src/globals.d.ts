// src/globals.d.ts — 앰비언트(전역) 타입 선언 (개선안 1-3: 타입 안정성)
//
// 런타임 산출물이 아닌 "편집기 전용" 선언 파일입니다.
// 클래식 <script> 로 로드되어 전역/window 에 바인딩되는 자산(레지스트리·오디오
// 매니페스트·온디맨드 번들·마이그레이션 맵)과, 모듈 경계를 넘어 전역으로 참조되는
// 함수들을 선언해 checkJs 진단의 오탐(존재하지 않는 속성/식별자)을 제거합니다.
//
// 주의: 여기 선언은 "그런 전역이 존재할 수 있다"는 타입 정보일 뿐,
//       모듈 코드에서는 개선안 1-2에 따라 정적 import 사용을 우선합니다.

export {};

declare global {
  interface Window {
    /** data/registry.js 가 바인딩하는 전역 레지스트리(클래식 스크립트 호환용) */
    DATA_REGISTRY?: import('./types.js').DataRegistry;
    /** data/audio_manifest.js 바인딩 */
    /** 시험 id → 시험별 오디오 매니페스트 */
    AUDIO_MANIFEST?: Record<string, import('./types.js').AudioManifest>;
    AUDIO_BASE_URL?: string | null;
    getAudioManifest?: (examId?: string) => import('./types.js').AudioManifest | Record<string, import('./types.js').AudioManifest> | undefined;
    getAudioUrl?: (localPath: string | null) => string | null;
    /** data-loader 가 채우는 온디맨드 데이터 캐시 */
    STUDY_DATA?: Record<string, any>;
    EXAM_DATA?: Record<string, any>;
    INGREDIENTS_DATA?: import('./types.js').Ingredient[];
    /** file:// 폴백 교재 번들 (build_study_md_bundle.js) */
    __STUDY_MD__?: { manifest?: any; files?: Record<string, string> };
    /** file:// 폴백 매니페스트 (data/study_md/manifest.js) */
    __STUDY_MD_MANIFEST__?: any;
    /** file:// 폴백 과목별 MD 원문 맵 (data/study_md/<key>.js) */
    __STUDY_MD_FILES__?: Record<string, Record<string, string>>;
    /** 시험 목록 번들 (data/exams.js) */
    EXAMS_LIST?: { exams?: import('./types.js').ExamDef[] };
    /** 복수정답형 파일럿 번들 (data/drills/combo_pilot.js) */
    COMBO_PILOT?: { questions?: Array<{ subject?: number; [k: string]: any }> };
    /** 복수정답형 문항 수 인덱스 (data/drills/combo_index.js) */
    COMBO_INDEX?: Record<string, number>;
    /** 문항→단원 매핑 인덱스 (data/question_chapters.js) */
    QUESTION_CHAPTERS?: Record<string, string>;
    CHAPTER_RANGES?: Record<string, any>;
    /** 문제집 file:// 폴백 번들 (build_exam_bundles.js) */
    __EXAM_MD__?: Record<string, string>;
    /** 안정 ID 마이그레이션 맵 (data/id_migration.js) */
    ID_MIGRATION_MAP?: Record<string, string>;
  }

  /** data/id_migration.js 가 정의하는 전역(클래식 스크립트). state.js 가 typeof 가드로 참조. */
  const ID_MIGRATION_MAP: Record<string, string> | undefined;

  /** app.js 가 정의하는 전역 통계 갱신 함수. state.js 가 저장 후 호출. */
  function updateGlobalStats(): void;

  /**
   * Node 환경 전용 전역 — 브라우저에는 없으므로 `typeof process !== 'undefined'`
   * 가드 후에만 접근한다 (tools/* 의 Node 빌드 스크립트가 같은 모듈을 재사용할 때 사용).
   */
  var process: { env: Record<string, string | undefined> } | undefined;
}
