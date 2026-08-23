// Declare legacy global structures so referencing them doesn't throw ReferenceErrors
var STUDY_DATA = {};
var EXAM_DATA = {};
var INGREDIENTS_DATA = [];

const DataLoader = {
    registry: null,
    _loaded: {},
    _loadedExams: {},
    _ingredients: null,

    /** Initialize from the global registry */
    init() {
        this.registry = typeof DATA_REGISTRY !== 'undefined' ? DATA_REGISTRY : window.DATA_REGISTRY;
        // Pre-initialize global namespaces for compatibility with legacy code
        if (typeof window.STUDY_DATA === 'undefined') {
            window.STUDY_DATA = {};
        }
        if (typeof window.EXAM_DATA === 'undefined') {
            window.EXAM_DATA = {};
        }
    },

    /** Dynamic script loading utility with load caching */
    _loadScript(url) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${url}"]`);
            if (existing) {
                if (existing.dataset.loaded === 'true') {
                    resolve();
                } else {
                    existing.addEventListener('load', () => resolve());
                    existing.addEventListener('error', (e) => reject(e));
                }
                return;
            }

            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.dataset.loaded = 'false';
            script.onload = () => {
                script.dataset.loaded = 'true';
                resolve();
            };
            script.onerror = (e) => {
                reject(e);
            };
            document.head.appendChild(script);
        });
    },

    /** Load a subject's content bundle on demand */
    async loadSubject(key) {
        if (this._loaded[key]) return this._loaded[key];
        const meta = this.registry.subjects.find(s => s.key === key);
        if (!meta) throw new Error(`Subject metadata not found for key: ${key}`);
        
        await this._loadScript(meta.bundle);
        const data = window[meta.global];
        this._loaded[key] = data;
        
        // Populate the legacy global STUDY_DATA for backward compatibility
        window.STUDY_DATA[key] = data;
        
        // Clean orphan IDs for this subject
        if (typeof cleanOrphansForSubject === 'function') {
            cleanOrphansForSubject(key, data);
        }
        
        return data;
    },

    /** Get the list of all subjects (metadata only, no bundle loading) */
    getSubjectList() {
        return this.registry.subjects;
    },

    /** Load an exam's bundle on demand */
    async loadExam(key) {
        if (this._loadedExams[key]) return this._loadedExams[key];
        const meta = this.registry.exams.find(e => e.key === key);
        if (!meta) throw new Error(`Exam metadata not found for key: ${key}`);
        
        await this._loadScript(meta.bundle);
        const data = window[meta.global];
        this._loadedExams[key] = data;
        
        // Populate the legacy global EXAM_DATA for backward compatibility
        window.EXAM_DATA[key] = data;
        return data;
    },

    /** Load the ingredients database bundle on demand */
    async loadIngredients() {
        if (this._ingredients) return this._ingredients;
        const meta = this.registry.ingredients;
        if (!meta) throw new Error(`Ingredients metadata not found`);
        
        await this._loadScript(meta.bundle);
        const data = window[meta.global];
        this._ingredients = data;
        window.INGREDIENTS_DATA = data;
        return data;
    }
};

// Auto-init if registry is loaded
if (typeof DATA_REGISTRY !== 'undefined' || window.DATA_REGISTRY) {
    DataLoader.init();
}
