// src/exam-context.js — 멀티시험 컨텍스트 (활성 시험 해석 + 경로/기능 해결)
//
// 시험 목록: data/exams.js 클래식 번들이 window.EXAMS_LIST를 채운다
// (file:// 호환 — fetch 불가 환경에서도 스크립트 태그로 로드).
// 시험 전환은 location.reload()로 모든 모듈 상태를 리셋한다.
// 의존성 없는 리프 모듈 — 다른 모듈이 import해도 순환 참조가 생기지 않는다.

const CURRENT_EXAM_KEY = 'current_exam';
const DEFAULT_EXAM_ID = 'cosmetic';

/** 시험 목록 (exams.json → data/exams.js 번들) */
export function getExamList() {
    const list = (typeof window !== 'undefined' && window.EXAMS_LIST && window.EXAMS_LIST.exams) || [];
    return Array.isArray(list) ? list : [];
}

/** 사용자가 선택한 시험 id (미선택 시 null) */
export function getCurrentExamId() {
    try {
        return localStorage.getItem(CURRENT_EXAM_KEY) || null;
    } catch (e) {
        return null;
    }
}

/**
 * 활성 시험 엔트리 해석.
 * 우선순위: 선택된 시험 → default 플래그 → 목록 첫 항목 → null(레지스트리 없음).
 */
export function getActiveExam() {
    const exams = getExamList();
    if (!exams.length) return null;
    const id = getCurrentExamId();
    return exams.find(e => e.id === id)
        || exams.find(e => e.default)
        || exams[0];
}

/** 활성 시험 id (목록 부재 시 기본값). Node 도구에서는 EXAM_ID 환경변수로 지정 가능. */
export function getActiveExamId() {
    const exam = getActiveExam();
    if (exam) return exam.id;
    if (typeof process !== 'undefined' && process.env && process.env.EXAM_ID) {
        return process.env.EXAM_ID;
    }
    return DEFAULT_EXAM_ID;
}

/**
 * 시험 선택 — 다른 시험이면 선택 저장 후 리로드(모듈/전역 상태 리셋),
 * 같은 시험이면 false 반환(호출자가 뷰 전환만 처리).
 * @returns {boolean} 리로드가 발생하면 true
 */
export function selectExam(id) {
    const exams = getExamList();
    const exam = exams.find(e => e.id === id);
    if (!exam) return false;
    if (getActiveExamId() === id) return false; // 미선택 상태에서도 기본 시험 선택 시 불필요 리로드 방지
    try {
        localStorage.setItem(CURRENT_EXAM_KEY, id);
    } catch (e) { /* noop */ }
    try { location.reload(); } catch (e) { /* noop */ }
    return true;
}

/** 시험 기능 플래그 (exams.json의 features — 미지정 시 false) */
export function hasFeature(name) {
    const exam = getActiveExam();
    return !!(exam && exam.features && exam.features[name]);
}

/** 시험 콘텐츠 루트 기준 상대 경로 (예: contentPath('교재/law/a.md')) */
export function contentPath(rel) {
    const exam = getActiveExam();
    const root = (exam && exam.contentRoot)
        || (typeof process !== 'undefined' && process.env && process.env.EXAM_CONTENT_ROOT)
        || `content/exams/${DEFAULT_EXAM_ID}`;
    return `${root}/${rel}`;
}

/** 시험 데이터 루트 기준 상대 경로 (예: dataPath('drills/ox_subject1.js')) */
export function dataPath(rel) {
    const exam = getActiveExam();
    const root = (exam && exam.dataRoot)
        || (typeof process !== 'undefined' && process.env && process.env.EXAM_DATA_ROOT)
        || `data/exams/${DEFAULT_EXAM_ID}`;
    return `${root}/${rel}`;
}

/* =======================================================
   localStorage 네임스페이스 (시험별 진도 격리)
   ======================================================= */

// 앱 전역(기기/세션 수준)으로 유지할 키 — 시험과 무관하게 공유
const GLOBAL_KEYS = new Set([
    CURRENT_EXAM_KEY,
    'ns_migrated_v2',
    'appTheme',
    'preferredOrientation',
    '__inappGuideShown',
    'readerFontScale',
    'readerLineHeight',
    'readerAudioRate',
    'readerAudioAutoScroll',
    'ui_analysis_open',
    'ui_toc_hint_seen',
    'ui_mode',
    'ui_study_tools_open',
    'device_id',                   // 동기화 기기 식별 — 시험 무관
    'passmula_auth_mail_cooldown_until', // 로그인 메일 재발송 쿨다운 — 시험 무관
    'last_seen_version'        // 새 버전 알림 마지막 확인 버전 — 시험 무관
]);

/** 진도 키에 시험 접두사 부여 (`fc_memorized` → `cosmetic:fc_memorized`) */
export function scopedKey(key) {
    if (GLOBAL_KEYS.has(key)) return key;
    return `${getActiveExamId()}:${key}`;
}

/** 네임스페이스된 실제 저장키에서 원래 키를 복원 (현재 시험 소속이 아니면 null) */
export function unscopedKey(raw) {
    const prefix = `${getActiveExamId()}:`;
    return (raw && raw.startsWith(prefix)) ? raw.slice(prefix.length) : null;
}

/**
 * 레거시(비네임스페이스) 진도 키 일괄 삭제 — 1회 실행.
 * 멀티시험 전환으로 기존 진도는 초기화 정책(사용자 승인). 앱 전역 키(GLOBAL_KEYS)는 보존.
 * @param {string[]} knownKeys - 제거할 레거시 정적 키 목록
 * @param {string[]} knownPrefixes - 제거할 레거시 동적 키 접두사 목록
 */
export function purgeLegacyStorage(knownKeys, knownPrefixes) {
    const FLAG = 'ns_migrated_v2';
    try {
        if (localStorage.getItem(FLAG)) return;
        const known = new Set(knownKeys);
        const doomed = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || GLOBAL_KEYS.has(key)) continue; // 앱 전역 키(테마·리더 설정 등)는 보존
            if (key.indexOf(':') !== -1) continue; // 이미 네임스페이스됨
            if (known.has(key) || knownPrefixes.some(p => key.startsWith(p))) doomed.push(key);
        }
        doomed.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* noop */ } });
        localStorage.setItem(FLAG, '1');
    } catch (e) { /* noop */ }
}

/**
 * 활성 시험의 합격/과락 규칙 — manifest `integratedExam` 필드에서 읽는다.
 * 교재/시험 교체 시 매니페스트만 바꾸면 판정 로직이 그대로 유효하다.
 * @returns {{passAverage:number, subjectFailBelow:number}}
 *   passAverage: 평균 합격선(기본 60) / subjectFailBelow: 과목 과락선(기본 40)
 */
export function getExamRules() {
    const ie = (typeof window !== 'undefined' && window.DATA_REGISTRY && window.DATA_REGISTRY.integratedExam) || {};
    return {
        passAverage: typeof ie.passAverage === 'number' ? ie.passAverage : 60,
        subjectFailBelow: typeof ie.subjectFailBelow === 'number' ? ie.subjectFailBelow : 40
    };
}

/**
 * 구버전 'subjectN' 형식 ID → 현재 레지스트리의 과목 키로 매핑.
 * 모의고사 이력의 구형 키를 현재 과목으로 환산하는 공용 규칙
 * (charts.js 성적 집계와 recommendations.js 과락 추천이 같은 규칙을 쓴다).
 * @param {string} subj
 * @returns {string} 매핑된 과목 키 (매핑 실패 시 입력 그대로)
 */
export function resolveLegacySubjectKey(subj) {
    const exams = (typeof window !== 'undefined' && window.DATA_REGISTRY && window.DATA_REGISTRY.exams) || [];
    const exam = exams.find(e => e.key === subj || e.key.startsWith(subj));
    return exam ? exam.subject : subj;
}

/**
 * 문제집(exam) 키 → 과목 키 매핑.
 * 정확 일치 → 접두 매칭(subject2_p1 ↔ subject2 호환) → 첫 과목 폴백 순.
 */
export function examIdToSubjectId(examId) {
    const registry = (typeof window !== 'undefined' && window.DATA_REGISTRY) || null;
    if (registry && registry.exams) {
        const exam = registry.exams.find(e => e.key === examId);
        if (exam) return exam.subject;
        // prefix 매칭 호환성 (예: subject2_p1 또는 subject2)
        const partialExam = registry.exams.find(e => examId.startsWith(e.key) || e.key.startsWith(examId));
        if (partialExam) return partialExam.subject;
    }
    if (registry && registry.subjects && registry.subjects.length > 0) {
        return registry.subjects[0].key;
    }
    return null;
}
