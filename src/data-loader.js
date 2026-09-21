// src/data-loader.js — 학습 데이터 로더
// [변경] 교재/카드/퀴즈(STUDY_DATA)는 더 이상 사전 빌드된 data/subjects/*.js 번들을 쓰지 않고,
//        content/*.md 를 런타임에 fetch → src/textbook-parser.js 로 파싱하여 조립한다.
//        - http(s): content/manifest.json + content/**/*.md 라이브 fetch (항상 최신, 재빌드 불필요)
//        - file://: fetch 차단되므로 data/study_md/ 분할 폴백 번들에서 원문/매니페스트 조회

import { TIMING } from './config/timing.js';
import { PATHS } from './paths.js';
//        exam/ingredients 는 기존 레지스트리 번들 방식을 그대로 유지한다.
import { cleanOrphansForSubject } from './state.js';
import { buildSubjectData } from './textbook-parser.js';
import { getActiveExam, contentPath, dataPath } from './exam-context.js';
// [모바일 PWA 견고성] 레지스트리는 window 전역(가드)에서 읽는다. 정적 import 로 하드 의존하면
// 레지스트리 로드 실패 시 app.js 모듈 그래프 전체가 죽어 흰 화면이 되므로 지양.

const IS_FILE = (typeof location !== 'undefined' && location.protocol === 'file:');

export const DataLoader = {
    /** @type {import('./types.js').DataRegistry|null} */
    registry: null,
    /** @type {import('./types.js').ExamDef|null} */
    exam: null,
    /** @type {Object.<string, any>} */
    _loaded: {},
    /** @type {Object.<string, any>} */
    _loadedExams: {},
    /** @type {Object.<string, any>} */
    _loadedDrills: {},
    /** @type {import('./types.js').Ingredient[]|null} */
    _ingredients: null,
    /** @type {any} */
    _manifest: null,
    /** @type {Object.<string, number>|null} */
    _comboIndex: null,
    /** @type {{questions: Object.<string, string>, ranges: Object.<string, any>}|null} */
    _questionChapters: null,
    /** @type {string|null} */
    _registryExamId: null,
    _fallbackManifestInjected: false,
    /** @type {Object.<string, boolean>} */
    _fallbackSubjectInjected: {},

    /**
     * Initialize from the global registry (index.html의 module 태그가 채운 window 전역).
     * 멀티시험: 기본 시험은 index.html의 정적 <script>가 DATA_REGISTRY를 채우고,
     * 다른 시험은 ensureRegistry()가 dataRoot의 레지스트리 번들을 동적 로드한다.
     * @returns {void}
     */
    init() {
        this.exam = getActiveExam();
        this.registry = window.DATA_REGISTRY || null;
        if (typeof window.STUDY_DATA === 'undefined') window.STUDY_DATA = {};
        if (typeof window.EXAM_DATA === 'undefined') window.EXAM_DATA = {};
    },

    /**
     * 활성 시험의 레지스트리 확보 (비기본 시험은 번들을 동적 로드).
     * 기본 시험은 index.html의 정적 <script src="data/exams/cosmetic/registry.js">가 이미 제공한다.
     */
    async ensureRegistry() {
        const exam = this.exam || getActiveExam();
        if (!exam) return;
        const globalName = exam.registryGlobal || 'DATA_REGISTRY';
        // 기본 시험: 정적 로드된 전역이 있으면 그대로 사용
        if (exam.default && window.DATA_REGISTRY) {
            this.registry = window.DATA_REGISTRY;
            return;
        }
        const dynGlobal = () => /** @type {any} */ (window)[globalName];
        if (dynGlobal() && this._registryExamId === exam.id) {
            this.registry = dynGlobal();
            return;
        }
        if (exam.registryBundle) {
            await this._loadScript('./' + exam.registryBundle.replace(/^\.\//, ''));
            if (dynGlobal()) {
                this.registry = dynGlobal();
                this._registryExamId = exam.id;
            }
        }
        // 비기본 시험 레지스트리 확보 실패 시 기본 시험 레지스트리가 남아
        // 엉뚱한 콘텐츠가 조용히 표시되는 것을 방지 — 명시적으로 비운다.
        if (!exam.default && this._registryExamId !== exam.id && this.registry === window.DATA_REGISTRY) {
            console.warn(`[DataLoader] ${exam.id} 레지스트리를 찾지 못했습니다 — 기본 레지스트리를 비웁니다.`);
            this.registry = null;
        }
    },

    /** 활성 시험의 기능 플래그 */
    getFeatures() {
        return (this.exam && this.exam.features) || {};
    },

    /** 과목 번호 목록 (드릴/시뮬레이터의 subjectN 번호 = manifest order) */
    getSubjectOrders() {
        const subjects = (this.registry && this.registry.subjects) || [];
        return subjects.map(s => s.order).filter(Number.isFinite);
    },

    /**
     * Dynamic script loading utility with load caching and retry.
     * resolve는 매크로태스크 한 틱 뒤에 이뤄져, 클래식 스크립트가 설정한
     * window 전역이 호출부에서 반드시 보이는 것을 보장한다 (호출부의 개별
     * setTimeout(0) 대기를 이곳에 일원화).
     */
    _loadScript(url, retries = 2) {
        return new Promise((resolve, reject) => {
            const done = () => setTimeout(() => resolve(undefined), 0);
            const attemptLoad = (remaining) => {
                const existing = /** @type {HTMLScriptElement|null} */ (document.querySelector(`script[src="${url}"]`));
                if (existing) {
                    if (existing.dataset.loaded === 'true') {
                        done();
                    } else if (existing.dataset.loaded === 'error') {
                        existing.remove();
                        if (remaining > 0) setTimeout(() => attemptLoad(remaining - 1), TIMING.SCRIPT_RETRY_DELAY_MS);
                        else reject(new Error(`Script load failed after retries: ${url}`));
                    } else {
                        const onError = (e) => {
                            existing.dataset.loaded = 'error';
                            if (remaining > 0) { existing.remove(); setTimeout(() => attemptLoad(remaining - 1), TIMING.SCRIPT_RETRY_DELAY_MS); }
                            else reject(e);
                        };
                        existing.addEventListener('load', done);
                        existing.addEventListener('error', onError);
                        // querySelector → 리스너 부착 사이에 settle됐을 수 있는 경합 방어
                        if (existing.dataset.loaded === 'true') done();
                        else if (existing.dataset.loaded === 'error') onError(new Error(`Script load failed: ${url}`));
                    }
                    return;
                }
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.dataset.loaded = 'false';
                script.onload = () => { script.dataset.loaded = 'true'; done(); };
                script.onerror = (e) => {
                    script.dataset.loaded = 'error';
                    if (remaining > 0) { script.remove(); setTimeout(() => attemptLoad(remaining - 1), TIMING.SCRIPT_RETRY_DELAY_MS); }
                    else reject(e);
                };
                document.head.appendChild(script);
            };
            attemptLoad(retries);
        });
    },

    /** file:// 폴백 manifest를 한 번만 주입 */
    async _ensureFallbackManifest() {
        if (this._fallbackManifestInjected && window.__STUDY_MD_MANIFEST__) return window.__STUDY_MD_MANIFEST__;
        if (!window.__STUDY_MD_MANIFEST__) {
            await this._loadScript(PATHS.STUDY_MD_MANIFEST_BUNDLE);
        }
        this._fallbackManifestInjected = true;
        if (!window.__STUDY_MD_MANIFEST__) {
            throw new Error('폴백 manifest를 찾을 수 없습니다. `node tools/build_study_md_bundle.js` 로 data/exams/<id>/study_md/ 를 생성하세요.');
        }
        return window.__STUDY_MD_MANIFEST__;
    },

    /** file:// 폴백 과목별 MD 파일 번들을 온디맨드 주입 */
    async _ensureFallbackSubjectFiles(subjectKey) {
        if (this._fallbackSubjectInjected[subjectKey]) {
            const files = window.__STUDY_MD_FILES__ && window.__STUDY_MD_FILES__[subjectKey];
            if (files) return files;
        }
        if (!window.__STUDY_MD_FILES__) window.__STUDY_MD_FILES__ = {};
        if (!window.__STUDY_MD_FILES__[subjectKey]) {
            await this._loadScript(PATHS.STUDY_MD_SUBJECT_BUNDLE(subjectKey));
        }
        this._fallbackSubjectInjected[subjectKey] = true;
        const files = window.__STUDY_MD_FILES__ && window.__STUDY_MD_FILES__[subjectKey];
        if (!files) {
            throw new Error(`폴백 과목 번들을 찾을 수 없습니다: ${subjectKey}`);
        }
        return files;
    },

    /** content/manifest.json 확보 (http: fetch, file://: 폴백 manifest) */
    async _getManifest() {
        if (this._manifest) return this._manifest;
        if (!IS_FILE) {
            try {
                const res = await fetch(PATHS.MANIFEST_URL, { cache: 'no-cache' });
                if (res.ok) { this._manifest = await res.json(); return this._manifest; }
            } catch (e) { /* 폴백으로 진행 */ }
        }
        const manifest = await this._ensureFallbackManifest();
        this._manifest = manifest;
        return this._manifest;
    },

    /** 단일 MD 원문 확보 (http: fetch, 실패/file://: 폴백 과목별 번들) */
    async _getMd(relPath, subjectKey) {
        // './' 접두사 정규화 — 번들 키('content/...')와의 일치를 보장
        relPath = relPath.replace(/^\.\//, '');
        if (!IS_FILE) {
            try {
                const res = await fetch('./' + relPath, { cache: 'no-cache' });
                if (res.ok) return await res.text();
            } catch (e) { /* 폴백으로 진행 */ }
        }
        if (!subjectKey) {
            // relPath에서 subjectKey 추출: {contentRoot}/{dir}/{file} → manifest에서 dir 접두사 매칭
            // manifest의 dir은 contentRoot 상대 경로이므로 먼저 루트 접두사를 제거한다.
            const manifest = await this._getManifest();
            const rootPrefix = contentPath(''); // 'content/' 또는 'content/exams/<id>/'
            let rel = relPath.replace(/^\.\//, '');
            if (rel.startsWith(rootPrefix)) rel = rel.slice(rootPrefix.length);
            const manifestSubjects = (manifest && Array.isArray(manifest.subjects)) ? manifest.subjects : [];
            const subj = manifestSubjects.find(s => rel === s.dir || rel.startsWith(s.dir + '/'));
            subjectKey = subj ? subj.key : null;
        }
        if (!subjectKey) throw new Error(`과목을 식별할 수 없습니다: ${relPath}`);
        const files = await this._ensureFallbackSubjectFiles(subjectKey);
        const md = files[relPath];
        if (typeof md !== 'string') throw new Error(`MD 원문을 찾을 수 없습니다: ${relPath}`);
        return md;
    },

    /** 과목 학습 데이터를 content/*.md 에서 런타임 파싱하여 로드 */
    async loadSubject(key) {
        if (this._loaded[key]) return this._loaded[key];

        const manifest = await this._getManifest();
        const manifestSubjects = (manifest && Array.isArray(manifest.subjects)) ? manifest.subjects : [];
        const subjMeta = manifestSubjects.find(s => s.key === key);
        if (!subjMeta) throw new Error(`Subject metadata not found for key: ${key}`);

        /** @type {Object.<string, string>} */
        const mdByFile = {};
        for (const ch of subjMeta.chapters) {
            mdByFile[ch.file] = await this._getMd(contentPath(`${subjMeta.dir}/${ch.file}`), key);
        }

        const data = buildSubjectData(subjMeta, mdByFile, { filePathMode: 'md' });

        // 문제은행 보충 카드/퀴즈 병합 (레지스트리가 제공하는 경우 — 출제 비중 보정용)
        const regSubj = (this.registry && Array.isArray(this.registry.subjects))
            ? this.registry.subjects.find(s => s.key === key)
            : null;
        if (regSubj && regSubj.supplement) {
            try {
                await this._loadScript(regSubj.supplement);
                const supp = /** @type {any} */ (window)[regSubj.supplementGlobal || `STUDY_SUPPLEMENT_${key}`];
                if (supp) {
                    if (Array.isArray(supp.cards)) data.cards.push(...supp.cards);
                    if (Array.isArray(supp.quizzes)) data.quizzes.push(...supp.quizzes);
                }
            } catch (e) {
                console.warn(`[DataLoader] 보충 데이터 로드 실패 (${key}):`, e);
            }
        }

        this._loaded[key] = data;
        /** @type {Object.<string, any>} */ (window.STUDY_DATA)[key] = data;
        this._updateRegistryStats(key, data);

        if (typeof cleanOrphansForSubject === 'function') {
            cleanOrphansForSubject(key, data);
        }
        return data;
    },

    /** 로드된 실제 개수로 레지스트리 stats를 갱신 (대시보드/전역 통계가 정적 stats 대신 실제값 사용) */
    _updateRegistryStats(key, data) {
        if (!this.registry || !Array.isArray(this.registry.subjects)) return;
        const meta = this.registry.subjects.find(s => s.key === key);
        if (!meta) return;
        meta.stats = Object.assign({}, meta.stats, {
            cards: data.cards.length,
            quizzes: data.quizzes.length,
            chapters: data.chapters.length
        });
    },

    /**
     * 과목 목록 (레지스트리 메타: key/order/name/stats).
     * @returns {import('./types.js').SubjectMeta[]}
     */
    getSubjectList() {
        return (this.registry && this.registry.subjects) || [];
    },

    /** Load an exam's bundle on demand (기존 유지) */
    async loadExam(key) {
        if (this._loadedExams[key]) return this._loadedExams[key];
        if (!this.registry || !this.registry.exams) throw new Error('Registry not loaded');
        const meta = this.registry.exams.find(e => e.key === key);
        if (!meta) throw new Error(`Exam metadata not found for key: ${key}`);
        await this._loadScript(meta.bundle);
        const data = /** @type {any} */ (window)[meta.global];
        if (!data) throw new Error(`Exam data is empty or invalid: ${meta.global}`);
        this._loadedExams[key] = data;
        /** @type {Object.<string, any>} */ (window.EXAM_DATA)[key] = data;
        return data;
    },

    /**
     * 과목 order → 시험(exam) 번들 키 해석.
     * registry.exams[].subject ↔ registry.subjects[].key 연결로 파생한다.
     * (기존 'subjectN' 명명 규칙과의 하위 호환 폴백 유지)
     * @param {number|string} subjectNum 과목 order
     * @returns {string} exam key (예: 'subject1')
     */
    _examKeyForOrder(subjectNum) {
        const num = parseInt(String(subjectNum), 10);
        const subjects = (this.registry && this.registry.subjects) || [];
        const exams = (this.registry && this.registry.exams) || [];
        const subj = subjects.find(s => s.order === num);
        if (subj) {
            const exam = exams.find(e => e.subject === subj.key);
            if (exam) return exam.key;
        }
        return `subject${num}`;
    },

    /**
     * 과목별 O/X 드릴 번들 로드 ({dataRoot}/drills/ox_<examKey>.js → window.OX_DRILLS_<examKey>)
     * @param {number|string} subjectNum 과목 order (1~N)
     * @returns {Promise<Array>} ox 문항 배열
     */
    async loadOxDrills(subjectNum) {
        const key = this._examKeyForOrder(subjectNum);
        if (this._loadedDrills[key]) return this._loadedDrills[key];
        await this._loadScript(`./${dataPath(`drills/ox_${key}.js`)}`);
        const data = /** @type {any} */ (window)[`OX_DRILLS_${key}`];
        if (!Array.isArray(data)) throw new Error(`O/X 드릴 데이터를 찾을 수 없습니다: ${key}`);
        this._loadedDrills[key] = data;
        return data;
    },

    /**
     * 과목별 복수정답형(combo) 드릴 번들 로드 — 자동 변환 번들 + 수작업 파일럿 병합
     * ({dataRoot}/drills/combo_subjectN.js → window.COMBO_DRILLS_subjectN,
     *  {dataRoot}/drills/combo_pilot.js → window.COMBO_PILOT 중 해당 과목분)
     * @param {number|string} subjectNum 과목 order (1~N)
     * @returns {Promise<Array>} combo 문항 배열
     */
    async loadComboDrills(subjectNum) {
        const num = parseInt(String(subjectNum), 10);
        const examKey = this._examKeyForOrder(num);
        const key = `combo_${examKey}`;
        if (this._loadedDrills[key]) return this._loadedDrills[key];

        await this._loadScript(`./${dataPath(`drills/combo_${examKey}.js`)}`);
        const auto = /** @type {any} */ (window)[`COMBO_DRILLS_${examKey}`] || [];

        // 파일럿(수작업)은 과목1·4에만 존재 — 없어도 자동 번들로 동작
        if (!this._loadedDrills.comboPilot) {
            try {
                await this._loadScript(`./${dataPath('drills/combo_pilot.js')}`);
                } catch (e) {
                console.warn('[DataLoader] combo_pilot.js 로드 실패 — 자동 번들만 사용', e);
            }
            this._loadedDrills.comboPilot = (window.COMBO_PILOT && window.COMBO_PILOT.questions) || [];
        }
        const pilot = this._loadedDrills.comboPilot.filter(q => q.subject === num);

        const questions = [...pilot, ...auto];
        if (!questions.length) throw new Error(`복수정답형 드릴 데이터를 찾을 수 없습니다: ${key}`);
        this._loadedDrills[key] = questions;
        return questions;
    },

    /**
     * 과목별 복수정답형 문항 수 인덱스 로드 — {dataRoot}/drills/combo_index.js → window.COMBO_INDEX
     * 모의고사 카드의 "전체 N문" 라벨에 사용. 없어도 앱 동작에는 영향 없음.
     * @returns {Promise<Object>} { <examKey>: count }
     */
    async loadComboIndex() {
        if (this._comboIndex) return this._comboIndex;
        try {
            await this._loadScript(`./${dataPath('drills/combo_index.js')}`);
        } catch (e) {
            console.warn('[DataLoader] combo_index.js 로드 실패 — 복수정답형 문항 수 표시 생략', e);
        }
        this._comboIndex = window.COMBO_INDEX || {};
        return this._comboIndex;
    },

    /**
     * 과목의 복수정답형 총 문항 수 조회 (인덱스 미로드/없으면 0)
     * @param {number|string} subjectNum 과목 order
     * @returns {number}
     */
    getComboCount(subjectNum) {
        const key = this._examKeyForOrder(parseInt(String(subjectNum), 10));
        const idx = this._comboIndex || window.COMBO_INDEX || {};
        return idx[key] || 0;
    },

    /**
     * 문항→교재 챕터 매핑 인덱스 로드 — {dataRoot}/question_chapters.js
     * → window.QUESTION_CHAPTERS (문항id→단원명), window.CHAPTER_RANGES (과목→라인 경계)
     * 모의고사 결과의 "단원별 취약 분석"에 사용. 없어도 앱 동작에는 영향 없음.
     */
    async loadQuestionChapters() {
        if (this._questionChapters) return this._questionChapters;
        try {
            await this._loadScript(`./${dataPath('question_chapters.js')}`);
        } catch (e) {
            console.warn('[DataLoader] question_chapters.js 로드 실패 — 단원별 분석 생략', e);
        }
        this._questionChapters = {
            questions: window.QUESTION_CHAPTERS || {},
            ranges: window.CHAPTER_RANGES || {}
        };
        return this._questionChapters;
    },

    /**
     * Load the ingredients database bundle on demand.
     * (온디맨드 번들은 file:// 호환을 위해 클래식 <script> 주입 방식을 유지한다.)
     * @returns {Promise<import('./types.js').Ingredient[]>}
     */
    async loadIngredients() {
        if (this._ingredients) return this._ingredients;
        const meta = this.registry && this.registry.ingredients;
        if (!meta) throw new Error(`Ingredients metadata not found`);
        await this._loadScript(meta.bundle);
        const data = /** @type {import('./types.js').Ingredient[]|undefined} */ (/** @type {any} */ (window)[meta.global]);
        if (!data || (Array.isArray(data) && data.length === 0)) {
            throw new Error(`Ingredients data is empty or invalid: ${meta.global}`);
        }
        this._ingredients = data;
        window.INGREDIENTS_DATA = data;
        return data;
    }
};

// Auto-init: 레지스트리 전역이 준비되어 있으면 즉시 초기화(없으면 이후 init 재호출 대비).
if (typeof window !== 'undefined' && window.DATA_REGISTRY) {
    DataLoader.init();
}
