// src/types.js — 중앙 JSDoc 타입 정의 모듈 (개선안 1-3: 타입 안정성)
//
// 이 파일은 "런타임 코드가 없는" 순수 타입 선언 모듈입니다.
// 전역 상태(state)와 데이터 레지스트리(DATA_REGISTRY) 등 앱 전반에서
// 반복 사용되는 구조를 @typedef 로 정의하여, 다른 모듈에서
//     /** @type {import('./types.js').State} */
//     /** @param {import('./types.js').SubjectMeta} meta */
// 형태로 참조할 수 있게 합니다.
//
// - 런타임 부작용이 전혀 없으므로(선언만 존재) 어디에서 import 해도 안전합니다.
// - 실제 타입 검사/자동완성은 루트의 jsconfig.json(checkJs)이 담당합니다.
// - 속성 추가/변경 시 이 파일의 typedef 만 갱신하면 편집기 진단이 즉시 반영됩니다.

/* =======================================================
   📦 전역 상태(State) 관련 타입
   ======================================================= */

/**
 * 플래시카드 세션 상태.
 * @typedef {Object} FlashcardsState
 * @property {string}   subject      현재 과목 키 (예: 'law')
 * @property {number}   currentIndex 현재 카드 인덱스
 * @property {boolean}  keyOnly      키워드(암기면)만 표시 여부
 * @property {Card[]}   data         현재 필터링된 카드 목록
 */

/**
 * 퀴즈 세션 상태.
 * @typedef {Object} QuizSessionState
 * @property {string}   subject      현재 과목 키
 * @property {Quiz[]}   data         출제된 퀴즈 목록(보통 10문제)
 * @property {number}   currentIndex 현재 문제 인덱스
 * @property {number}   correctCount 맞힌 개수
 * @property {Array<{quizId: string, selected: (number|string), correct: boolean}>} solvedList 이번 세션 제출 기록
 */

/**
 * 한도 암기 트레이너 하위 상태.
 * @typedef {Object} TrainerLimitsState
 * @property {number}   currentIndex 현재 문항 인덱스
 * @property {Array<*>} shuffledData 셔플된 문항 데이터
 * @property {number}   correctCount 맞힌 개수
 */

/**
 * 계산 연습 트레이너 하위 상태.
 * @typedef {Object} TrainerCalcState
 * @property {?CalcQuestion} currentQuestion 현재 계산 문제(없으면 null)
 * @property {number}        correctCount    맞힌 개수
 * @property {number}        totalSolved     총 풀이 개수
 */

/**
 * 성분 챌린지 트레이너 하위 상태.
 * @typedef {Object} TrainerIngredientsState
 * @property {number}   currentIndex      현재 문항 인덱스
 * @property {Array<*>} shuffledQuestions 셔플된 문항 목록
 * @property {number}   correctCount      맞힌 개수
 */

/**
 * 뽀모도로 타이머 상태.
 * @typedef {Object} PomodoroState
 * @property {?number} timerId       setInterval 핸들(없으면 null)
 * @property {number}  timeLeft      남은 시간(초)
 * @property {'idle'|'work'|'break'} status 타이머 상태
 * @property {number}  totalTimeToday 오늘 누적 집중 시간(초)
 */

/**
 * 스마트 훈련소 세션 상태.
 * @typedef {Object} TrainerState
 * @property {'menu'|'limits'|'calc'|'ingredients'|string} activeSubView 활성 하위 뷰
 * @property {TrainerLimitsState}      limits
 * @property {TrainerCalcState}        calc
 * @property {TrainerIngredientsState} ingredients
 * @property {PomodoroState}           pomodoro
 */

/**
 * 앱 전역 상태 객체(state.js의 `state`).
 * @typedef {Object} State
 * @property {string}                 currentView    현재 활성 뷰 id (예: 'dashboard-view')
 * @property {Set<string>}            memorizedCards 외운 카드 ID 집합
 * @property {Set<string>}            weakCards      헷갈린(오답) 카드 ID 집합
 * @property {Object.<string, QuizResult>} quizResults 퀴즈 결과 맵 { quizId: QuizResult }
 * @property {string}                 reviewFilter   오답노트 필터('all' | 과목 키)
 * @property {FlashcardsState}        flashcards
 * @property {QuizSessionState}       quiz
 * @property {TrainerState}           trainer
 * @property {boolean} [_storageUnavailable] localStorage 사용 불가 감지 플래그
 */

/**
 * 단일 퀴즈 결과.
 * @typedef {Object} QuizResult
 * @property {boolean} solved  풀이 여부
 * @property {boolean} correct 정답 여부
 */

/* =======================================================
   📇 학습 콘텐츠(카드/퀴즈/성분) 타입
   ======================================================= */

/**
 * 플래시카드 한 장.
 * @typedef {Object} Card
 * @property {string}  id       안정적 카드 ID
 * @property {string}  question 앞면(질문/키워드)
 * @property {string}  answer   뒷면(정답/설명)
 * @property {string} [chapter] 소속 단원명
 * @property {string} [subject] 소속 과목 키
 */

/**
 * 퀴즈 한 문제.
 * @typedef {Object} Quiz
 * @property {string}       id           안정적 퀴즈 ID
 * @property {string}       question     문제 지문
 * @property {string[]}     [options]    객관식 보기(있으면 객관식)
 * @property {(number|string)} answer    정답(보기 인덱스 또는 단답 문자열)
 * @property {string}       [explanation] 해설
 * @property {string}       [chapter]    소속 단원명
 */

/**
 * 계산 연습 문제(trainer-calc.js buildCalcQuestion 산출물).
 * @typedef {Object} CalcQuestion
 * @property {string} question   문제 지문
 * @property {number} answer     정답 수치
 * @property {string} [unit]     단위
 * @property {string} [solution] 풀이 과정(HTML 허용)
 */

/**
 * 원료(성분) 사전 항목.
 * @typedef {Object} Ingredient
 * @property {string}  name        국문 성분명
 * @property {string} [engName]    영문명
 * @property {string} [category]   분류/카테고리
 * @property {'approved'|'restricted'|'banned'|string} [type] 사용 구분
 * @property {string} [description] 설명/특성
 * @property {string} [limit]      배합 한도
 * @property {string} [tip]        학습 팁
 */

/* =======================================================
   🗂️ 데이터 레지스트리(DATA_REGISTRY) 타입
   ======================================================= */

/**
 * 번들 통계(과목/문제집/성분에 따라 존재하는 키가 다름).
 * @typedef {Object} BundleStats
 * @property {number} [cards]
 * @property {number} [quizzes]
 * @property {number} [chapters]
 * @property {number} [questions]
 * @property {number} [count]
 */

/**
 * 과목(교재) 메타데이터.
 * @typedef {Object} SubjectMeta
 * @property {string}      key         과목 키(예: 'law')
 * @property {number}      order       정렬 순서
 * @property {string}      name        표시 이름
 * @property {string}      bundle      번들 경로(상대)
 * @property {string}      global      전역 변수명(예: 'STUDY_DATA_law')
 * @property {string}      contentHash 콘텐츠 해시(캐시 무효화용)
 * @property {BundleStats} stats
 */

/**
 * 모의고사(문제집) 메타데이터.
 * @typedef {Object} ExamMeta
 * @property {string}      key
 * @property {string}      subject     소속 과목
 * @property {number}      [part]      파트 번호
 * @property {string}      title
 * @property {string}      bundle
 * @property {string}      global      전역 변수명(예: 'EXAM_DATA_subject4_p3')
 * @property {string}      contentHash
 * @property {BundleStats} stats
 */

/**
 * 성분 데이터베이스 메타데이터.
 * @typedef {Object} IngredientsMeta
 * @property {string}      bundle
 * @property {string}      global      전역 변수명('INGREDIENTS_DATA')
 * @property {string}      contentHash
 * @property {BundleStats} stats
 */

/**
 * 전체 데이터 레지스트리(data/registry.js의 DATA_REGISTRY).
 * @typedef {Object} DataRegistry
 * @property {number}          schemaVersion
 * @property {string}          contentYear
 * @property {string}          generatedAt
 * @property {SubjectMeta[]}   subjects
 * @property {ExamMeta[]}      exams
 * @property {IngredientsMeta} ingredients
 */

/* =======================================================
   🎧 오디오 매니페스트 타입
   ======================================================= */

/**
 * 오디오 매니페스트: 과목 키 → { 단원인덱스: 로컬 mp3 경로 }.
 * @typedef {Object.<string, Object.<string, string>>} AudioManifest
 */

// 런타임 export는 없습니다. (타입 전용 모듈)
export {};
