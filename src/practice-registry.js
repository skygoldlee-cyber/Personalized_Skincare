// src/practice-registry.js — 실무작업실 피처 레지스트리
// @spec UM-01~05
//
// 실무 피처 = 시험 features 키 → 실무작업실 뷰 정의의 선언적 매핑.
// 신규 실무 피처(예: 다른 시험의 제조·검사 도구)는 여기에 엔트리를
// 추가하고 exams.json에 features 키를 선언하면 된다 — ui-mode 랜딩,
// 뷰 타이틀·해시 슬러그, 지연 로더·핸들러 등록이 전부 이 표에서 유도된다.
//
// 시험별 자산 격리: 피처 뷰 모듈은 SHELL_ASSETS 프리캐시에 두지 않고
// (활성 시험만 쓰는 자산이므로) 뷰 마크업도 셸에 빈 스텁만 둔 채
// markup 필드의 파셜을 진입/예열 시 주입한다. warmPracticeFeatures()가
// 유휴 시점에 유효 피처의 모듈·마크업을 미리 요청해 SW 캐시(cacheFirst/
// SWR 경유)에 적재 — 오프라인 진입과 첫 진입 지연을 함께 확보한다.
//
// 의존성 규칙: 이 모듈의 정적 import는 exam-context 하나로 제한한다.
// 피처 뷰 모듈·DataLoader·ui-utils·도메인 훅은 전부 enter() 내부의
// 지연 import()로 참조해, import 시점의 모듈 그래프 팽창·순환을 막는다.
import { hasFeature, getActiveExamId } from './exam-context.js';

const _lazyImport = (load) => { let p = null; return () => (p ??= load()); };

// 도메인 경로 규약 — 실무 피처 자산은 활성 시험 id 아래 시험 무관 동일 상대
// 경로에 둔다: 모듈 src/exams/<시험id>/<rel>, 마크업 html/exams/<시험id>/<rel>.
// 로더 호출 시점의 활성 시험으로 경로를 해석하므로 플랫폼 코드에 시험 id
// 리터럴이 남지 않고, 신규 시험은 같은 구조로 파일만 배치하면 된다.
// .rel은 규약 선언 자체 — 유닛 테스트가 "features 키 보유 시험 → 파일 실존"을 검증한다.
/**
 * @param {string} rel - src/exams/<시험id>/ 아래 상대 모듈 경로
 * @returns {(() => Promise<any>) & { rel: string }}
 */
const _domainImport = (rel) => Object.assign(
    _lazyImport(() => import(`./exams/${getActiveExamId()}/${rel}`)),
    { rel }
);
const _domainMarkup = (rel) => `./html/exams/${getActiveExamId()}/${rel}`;

const formula = {
    viewId: 'formula-view',
    slug: 'formula',
    // 랜딩 우선순위 — 복수 실무 피처가 유효한 시험에서 작은 값이 랜딩된다 (미지정=0)
    priority: 0,
    title: 'Formula OS',
    subtitle: '원료 조회 · 배합 계산 · My 포뮬러 저장·검증',
    loadingText: 'Formula OS 데이터를 불러오는 중입니다...',
    loadErrorText: 'Formula OS를 불러오지 못했습니다.',
    // 뷰 마크업 파셜 — 셸(index.html)에는 빈 <section id> 스텁만 존재,
    // enter()/예열 시 fetch로 주입된다. 파셜은 자체 <section>을 포함하므로
    // 스텁을 outerHTML 교체한다. 상대 경로는 html/exams/<활성시험>/ 규약.
    markup: 'formula.html',
    // 도메인 뷰 모듈 — src/exams/<활성시험>/views/ 규약. 플랫폼 공용 모듈은
    // (notice-check) 시험 무관 단일 경로라 리터럴을 유지한다.
    loaders: {
        main: _domainImport('views/formula.js'),
        batch: _domainImport('views/formula-batch.js'),
        customer: _domainImport('views/formula-customer.js'),
        material: _domainImport('views/formula-material.js'),
        compliance: _domainImport('views/formula-compliance.js'),
        notice: _lazyImport(() => import('./notice-check.js')),
    },
    // [loaderKey, data-click 핸들러명 목록] — app.js 위임 디스패치에 브리지된다
    /** @type {Array<[string, string[]]>} */
    handlers: [
        ['main', [
            'exitFormulaSubView', 'openFormulaList', 'openFormulaCalc', 'openIngredientDict',
            'formulaNew', 'formulaOpen', 'formulaDuplicate', 'formulaDelete',
            'formulaCalcAddRow', 'formulaCalcRemoveRow', 'formulaCalcSave', 'formulaAddIngredient',
            'formulaRecAdd', 'formulaRecAddBase', 'formulaLoadBase',
            'formulaRuleAdd', 'formulaRuleRemove', 'formulaRuleReset',
            'formulaRuleExport', 'formulaRuleImport',
            'formulaSortPhase', 'formulaStepAdd', 'formulaStepRemove',
            'formulaPrint', 'formulaExportJson', 'formulaCardExport', 'formulaImportJson',
            'formulaAllergyAdd', 'formulaAllergyRemove', 'formulaCustLoad', 'formulaCustSaveAs',
        ]],
        ['batch', [
            'openBatchPanel', 'batchNew', 'batchEdit', 'batchSave', 'batchOpen', 'batchDelete',
            'batchFormulaChanged', 'batchCustChanged', 'batchPrintRecord', 'batchPrintLabel',
            'batchPrintGuide', 'batchFilterReset', 'batchExportCsv',
        ]],
        ['customer', [
            'openCustomerPanel', 'custNew', 'custEdit', 'custSave', 'custOpen', 'custDelete',
            'custLogAdd', 'custAllergyAdd', 'custAllergyRemove',
            'custImportCsv', 'custExportCsv', 'custCsvTemplate',
        ]],
        ['material', [
            'openMaterialPanel', 'matNew', 'matEdit', 'matSave', 'matDelete',
            'matImportCsv', 'matExportCsv', 'matCsvTemplate',
        ]],
        ['compliance', [
            'openCompliancePanel', 'compToggle', 'compReset', 'compOpenLaw',
        ]],
        ['notice', [
            'checkMfdsNoticeNow', 'dismissMfdsNotice', 'viewMfdsNoticeStatus',
        ]],
    ],
    // 뷰 진입 — 피처가 자체 로딩·데이터 선행·초기화·도메인 훅을 소유한다.
    // renderFn은 비동기 — navigateToView가 반환값을 기다리지 않으므로
    // 내부에서 모든 실패를 삼켜야 한다 (토스트로 보고).
    async enter() {
        const [{ DataLoader }, { checkMfdsNotice }, { showGlobalLoading, hideGlobalLoading, showToast }] =
            await Promise.all([
                import('./data-loader.js'),
                formula.loaders.notice(),
                import('./ui-utils.js'),
            ]);
        showGlobalLoading(formula.loadingText);
        try {
            // 배너·허브 버튼이 뷰 마크업에 의존하므로 주입을 선행한다
            await ensureViewMarkup(formula);
            checkMfdsNotice(); // 식약처 신규 고시 감지 배너 — 도메인 훅 (비차단, 실패 무시)
            const m = await formula.loaders.main();
            try {
                await DataLoader.loadIngredients();
            } catch (e) {
                showToast('원료 데이터를 불러오지 못했습니다.', 'error');
            }
            m.initFormulaView();
        } catch (e) {
            showToast(formula.loadErrorText, 'error');
        } finally {
            hideGlobalLoading();
        }
    },
};

/**
 * 뷰 마크업 지연 주입 — 셸의 빈 스텁 <section>(data-lazy-view 보유)을
 * 파셜 파일의 내용으로 통째 교체한다. 파셜 자체가 <section id>를 포함하므로
 * 주입 후 스텁은 사라지고 data-lazy-view 부재가 "주입 완료" 표식이 된다.
 * (DOM 테스트는 helpers가 동일 파셜을 미리 주입하므로 이 경로는
 *  실제 런타임 최초 진입에서만 실행된다)
 */
async function ensureViewMarkup(feat) {
    if (!feat.markup) return;
    const el = document.getElementById(feat.viewId);
    if (!el || !el.hasAttribute('data-lazy-view')) return;
    const url = _domainMarkup(feat.markup);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`view markup ${res.status}: ${url}`);
    el.outerHTML = await res.text();
}

/**
 * 유휴 시점 예열 — 유효 실무 피처의 뷰 모듈·마크업을 미리 요청한다.
 * 요청은 SW cacheFirst/SWR을 경유해 캐시에 적재되므로, 활성 시험의 실무
 * 피처만 프리캐시 없이도 오프라인 진입·첫 진입 즉시성을 확보한다.
 * 실패는 무시 — 예열은 최적화이며 실제 진입 시 다시 시도된다.
 */
export function warmPracticeFeatures() {
    for (const f of getEnabledPracticeFeatures()) {
        for (const load of Object.values(f.loaders)) load().catch(() => {});
        ensureViewMarkup(f).catch(() => {});
    }
}

/** 실무 피처 정의 — 키는 exams.json의 features 키와 1:1 대응한다 */
const PRACTICE_FEATURES = { formula };

/** 활성 시험이 실무 피처를 1개 이상 보유하는가 — 실무 모드 진입 가능 조건 */
export function isPracticeCapable() {
    return Object.keys(PRACTICE_FEATURES).some(k => hasFeature(k));
}

/** 활성 시험에서 유효한 실무 피처 엔트리 (레지스트리 선언 순서 유지) */
export function getEnabledPracticeFeatures() {
    return Object.keys(PRACTICE_FEATURES)
        .filter(k => hasFeature(k))
        .map(k => PRACTICE_FEATURES[k]);
}

/**
 * 실무 모드 랜딩 뷰 — 유효 피처 중 `priority`가 가장 작은 뷰.
 * priority 미지정은 0으로 간주하고, 동률은 레지스트리 선언 순서가 이긴다
 * (안정 정렬). 복수 실무 피처를 보유한 시험에서도 랜딩을 선언으로 제어할 수 있다.
 */
export function getPracticeLanding() {
    const enabled = getEnabledPracticeFeatures();
    if (!enabled.length) return 'dashboard-view';
    return [...enabled]
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))[0].viewId;
}

/** router 타이틀 맵용 — 선언된 모든 실무 뷰의 {title, subtitle} */
export function getPracticeViewTitles() {
    const out = {};
    for (const f of Object.values(PRACTICE_FEATURES)) {
        out[f.viewId] = { title: f.title, subtitle: f.subtitle };
    }
    return out;
}

/** router 해시 슬러그용 — {viewId: slug} */
export function getPracticeHashSlugs() {
    const out = {};
    for (const f of Object.values(PRACTICE_FEATURES)) {
        out[f.viewId] = f.slug;
    }
    return out;
}

/**
 * app.js LAZY_MODULE_HANDLERS용 — [[모듈로더, 핸들러명 배열]]
 * @returns {Array<[() => Promise<any>, string[]]>}
 */
export function getPracticeLazyHandlers() {
    /** @type {Array<[() => Promise<any>, string[]]>} */
    const out = [];
    for (const f of Object.values(PRACTICE_FEATURES)) {
        for (const [loaderKey, names] of f.handlers) {
            out.push([f.loaders[loaderKey], names]);
        }
    }
    return out;
}

/** app.js viewRenderers용 — {viewId: 렌더 함수} (비동기 enter를 발화만) */
export function getPracticeViewRenderers() {
    const out = {};
    for (const f of Object.values(PRACTICE_FEATURES)) {
        out[f.viewId] = () => { void f.enter(); };
    }
    return out;
}

/**
 * 도메인 경로 규약 검증용 — {featureKey: {markup, modules[]}}.
 * markup·modules는 시험 무관 상대 경로이며 실제 위치는
 * html/exams/<시험id>/ · src/exams/<시험id>/ 로 해석된다.
 * 유닛 테스트가 exams.json에서 해당 feature를 켠 시험마다 파일 실존을 확인한다.
 */
export function getPracticeDomainSpec() {
    const out = {};
    for (const [key, f] of Object.entries(PRACTICE_FEATURES)) {
        out[key] = {
            markup: f.markup || null,
            modules: Object.values(f.loaders)
                .map(l => /** @type {any} */ (l).rel)
                .filter(Boolean),
        };
    }
    return out;
}
