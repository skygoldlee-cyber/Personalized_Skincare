// src/globals.d.ts — 앰비언트(전역) 타입 선언 (개선안 1-3: 타입 안정성)
// @spec none (타입 선언)
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
    /** 앱 초기화 완료 플래그 — app.js 가 설정, app-fallback.js 가 폴링 */
    __APP_INITIALIZED?: boolean;
    /** vendor mermaid UMD 번들 (지연 로드 — mermaid-render.js) */
    mermaid?: any;
    /** theme-toggle.js 가 노출하는 전역 테마 API */
    AppTheme?: { isLight: () => boolean; apply: (light: boolean) => void; toggle: () => void };
    /** exam-viewer.js 가 바인딩하는 전역 뷰어 (formula-compliance 법령 링크 등) */
    ExamViewer?: any;
    /** PWA 설치 이벤트 캡처 (pwa-install-capture.js — beforeinstallprompt 지연 저장) */
    __deferredPrompt?: any;
    __pwaInstallReady?: boolean;
    __swRegistered?: boolean;
    /** SW 업데이트가 진행 중(설치/대기/활성화 예정) — whats-new 자동 모달 억제용 (pwa-install-capture.js 설정) */
    __SW_UPDATE_INBOUND?: boolean;
    /** 이번 세션에서 새로운 소식 모달이 표시됐는지 — SW 리로드 시 1회 스킵 판정용 (whats-new.js 설정) */
    __WHATS_NEW_SHOWN?: boolean;
    /** window.APP_VERSION — data/version.js 배포 스탬프 */
    APP_VERSION?: string;
    /** window.RELEASE_NOTES — data/release-notes.js 번들 */
    RELEASE_NOTES?: any;
    /** 시험 목록 번들 (data/exams.js) */
    EXAMS_LIST?: { exams?: import('./types.js').ExamDef[] };
    /** html-viewer.js 가 바인딩하는 전역 뷰어 API */
    HtmlViewer?: any;
    /** build_doc_bundles.js 산출 문서 원문 맵 (data/docs_md/*.js) */
    __DOC_MD__?: Record<string, string>;
    /** 구형 Safari prefix AudioContext */
    webkitAudioContext?: typeof AudioContext;
    /** app.js 가 노출하는 과목 바로가기 (command-palette 등) */
    startSubjectStudy?: (subject: string) => void;
    startSubjectQuiz?: (subject: string) => void;
    /** exam-history.js 가 노출하는 모의고사 성적 기록 함수 */
    saveExamResultToHistory?: (examId: string, score: number, total: number, subjectRates: any) => void;
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
    /** vendor/supabase UMD 번들 (지연 로드 — supabase-client.js) */
    supabase?: any;
    /** reader-audio.js 가 노출하는 재생 정지 함수 */
    stopReaderAudio?: () => void;
  }

  /** data/id_migration.js 가 정의하는 전역(클래식 스크립트). state.js 가 typeof 가드로 참조. */
  const ID_MIGRATION_MAP: Record<string, string> | undefined;

  /** app.js 가 정의하는 전역 통계 갱신 함수. state.js 가 저장 후 호출. */
  function updateGlobalStats(): void;

  /** trainer.js 가 정의·app.js 가 window 바인딩하는 단답형 채점 함수. */
  function checkShortAnswer(userInput: string, correctAnswer: any): boolean;

  /** iOS Safari 의 standalone 감지 속성 (PWA 설치 여부) + 관련 앱 설치 확인 (Android). */
  interface Navigator { standalone?: boolean; getInstalledRelatedApps?: () => Promise<any[]> }

  /** src/data-loader.js 모듈의 DataLoader — 일부 뷰가 window 전역으로 참조. */
  var DataLoader: { registry?: any } | undefined;

  /** Event Timing API 의 durationThreshold 옵션 (INP 측정). */
  interface PerformanceObserverInit { durationThreshold?: number }

  /** Layout Shift 엔트리 확장 필드 (hadRecentInput·value). */
  interface PerformanceEntry { hadRecentInput?: boolean; value?: number }

  /**
   * Node 환경 전용 전역 — 브라우저에는 없으므로 `typeof process !== 'undefined'`
   * 가드 후에만 접근한다 (tools/* 의 Node 빌드 스크립트가 같은 모듈을 재사용할 때 사용).
   */
  var process: { env: Record<string, string | undefined> } | undefined;
}
