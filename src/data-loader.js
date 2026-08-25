// src/data-loader.js — 학습 데이터 로더
// [변경] 교재/카드/퀴즈(STUDY_DATA)는 더 이상 사전 빌드된 data/subjects/*.js 번들을 쓰지 않고,
//        content/*.md 를 런타임에 fetch → src/textbook-parser.js 로 파싱하여 조립한다.
//        - http(s): content/manifest.json + content/**/*.md 라이브 fetch (항상 최신, 재빌드 불필요)
//        - file://: fetch 차단되므로 data/study_md.js(__STUDY_MD__) 폴백 번들에서 원문/매니페스트 조회
//        exam/ingredients 는 기존 레지스트리 번들 방식을 그대로 유지한다.
import { cleanOrphansForSubject } from './state.js';
import { buildSubjectData } from './textbook-parser.js';
// [개선안 1-2] 레지스트리를 정적 ESM import 로 참조(window 전역 의존 제거).
import { DATA_REGISTRY } from '../data/registry.js';

var STUDY_DATA = {};
var EXAM_DATA = {};
var INGREDIENTS_DATA = [];

const IS_FILE = (typeof location !== 'undefined' && location.protocol === 'file:');
const STUDY_MD_BUNDLE = './data/study_md.js';      // file:// 폴백 (window.__STUDY_MD__)
const MANIFEST_URL = './content/manifest.json';

export const DataLoader = {
    registry: null,
    _loaded: {},
    _loadedExams: {},
    _ingredients: null,
    _manifest: null,
    _fallbackInjected: false,

    /**
     * Initialize from the ESM-imported registry.
     * @returns {void}
     */
    init() {
        this.registry = DATA_REGISTRY;
        if (typeof window.STUDY_DATA === 'undefined') window.STUDY_DATA = {};
        if (typeof window.EXAM_DATA === 'undefined') window.EXAM_DATA = {};
    },

    /** Dynamic script loading utility with load caching and retry */
    _loadScript(url, retries = 2) {
        return new Promise((resolve, reject) => {
            const attemptLoad = (remaining) => {
                const existing = document.querySelector(`script[src="${url}"]`);
                if (existing) {
                    if (existing.dataset.loaded === 'true') {
                        resolve();
                    } else if (existing.dataset.loaded === 'error') {
                        existing.remove();
                        if (remaining > 0) setTimeout(() => attemptLoad(remaining - 1), 100);
                        else reject(new Error(`Script load failed after retries: ${url}`));
                    } else {
                        existing.addEventListener('load', () => resolve());
                        existing.addEventListener('error', (e) => {
                            existing.dataset.loaded = 'error';
                            if (remaining > 0) { existing.remove(); setTimeout(() => attemptLoad(remaining - 1), 100); }
                            else reject(e);
                        });
                    }
                    return;
                }
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.dataset.loaded = 'false';
                script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
                script.onerror = (e) => {
                    script.dataset.loaded = 'error';
                    if (remaining > 0) { script.remove(); setTimeout(() => attemptLoad(remaining - 1), 100); }
                    else reject(e);
                };
                document.head.appendChild(script);
            };
            attemptLoad(retries);
        });
    },

    /** file:// 폴백 번들(__STUDY_MD__)을 한 번만 주입 */
    async _ensureFallbackBundle() {
        if (this._fallbackInjected && window.__STUDY_MD__) return window.__STUDY_MD__;
        if (!window.__STUDY_MD__) {
            await this._loadScript(STUDY_MD_BUNDLE);
            await new Promise(r => setTimeout(r, 0));
        }
        this._fallbackInjected = true;
        if (!window.__STUDY_MD__) {
            throw new Error('교재 MD 폴백 번들을 찾을 수 없습니다. `node tools/build_study_md_bundle.js` 로 data/study_md.js 를 생성하세요.');
        }
        return window.__STUDY_MD__;
    },

    /** content/manifest.json 확보 (http: fetch, file://: 폴백 번들) */
    async _getManifest() {
        if (this._manifest) return this._manifest;
        if (!IS_FILE) {
            try {
                const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
                if (res.ok) { this._manifest = await res.json(); return this._manifest; }
            } catch (e) { /* 폴백으로 진행 */ }
        }
        const bundle = await this._ensureFallbackBundle();
        if (!bundle.manifest) throw new Error('폴백 번들에 manifest가 없습니다.');
        this._manifest = bundle.manifest;
        return this._manifest;
    },

    /** 단일 MD 원문 확보 (http: fetch, 실패/file://: 폴백 번들) */
    async _getMd(relPath) {
        if (!IS_FILE) {
            try {
                const res = await fetch('./' + relPath, { cache: 'no-cache' });
                if (res.ok) return await res.text();
            } catch (e) { /* 폴백으로 진행 */ }
        }
        const bundle = await this._ensureFallbackBundle();
        const md = bundle.files && bundle.files[relPath];
        if (typeof md !== 'string') throw new Error(`MD 원문을 찾을 수 없습니다: ${relPath}`);
        return md;
    },

    /** 과목 학습 데이터를 content/*.md 에서 런타임 파싱하여 로드 */
    async loadSubject(key) {
        if (this._loaded[key]) return this._loaded[key];

        const manifest = await this._getManifest();
        const subjMeta = manifest.subjects.find(s => s.key === key);
        if (!subjMeta) throw new Error(`Subject metadata not found for key: ${key}`);

        const mdByFile = {};
        for (const ch of subjMeta.chapters) {
            mdByFile[ch.file] = await this._getMd(`content/${subjMeta.dir}/${ch.file}`);
        }

        const data = buildSubjectData(subjMeta, mdByFile, { filePathMode: 'md' });
        this._loaded[key] = data;
        window.STUDY_DATA[key] = data;
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
        return this.registry.subjects;
    },

    /** Load an exam's bundle on demand (기존 유지) */
    async loadExam(key) {
        if (this._loadedExams[key]) return this._loadedExams[key];
        const meta = this.registry.exams.find(e => e.key === key);
        if (!meta) throw new Error(`Exam metadata not found for key: ${key}`);
        await this._loadScript(meta.bundle);
        await new Promise(r => setTimeout(r, 0));
        const data = window[meta.global];
        if (!data) throw new Error(`Exam data is empty or invalid: ${meta.global}`);
        this._loadedExams[key] = data;
        window.EXAM_DATA[key] = data;
        return data;
    },

    /**
     * Load the ingredients database bundle on demand.
     * (온디맨드 번들은 file:// 호환을 위해 클래식 <script> 주입 방식을 유지한다.)
     * @returns {Promise<import('./types.js').Ingredient[]>}
     */
    async loadIngredients() {
        if (this._ingredients) return this._ingredients;
        const meta = this.registry.ingredients;
        if (!meta) throw new Error(`Ingredients metadata not found`);
        await this._loadScript(meta.bundle);
        await new Promise(r => setTimeout(r, 0));
        const data = window[meta.global];
        if (!data || (Array.isArray(data) && data.length === 0)) {
            throw new Error(`Ingredients data is empty or invalid: ${meta.global}`);
        }
        this._ingredients = data;
        window.INGREDIENTS_DATA = data;
        return data;
    }
};

// Auto-init: 레지스트리는 정적 import 로 이미 로드되어 있으므로 즉시 초기화.
if (DATA_REGISTRY) {
    DataLoader.init();
}
