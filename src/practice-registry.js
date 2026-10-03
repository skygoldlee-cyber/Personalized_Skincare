// src/practice-registry.js — 실무작업실 피처 레지스트리
// @spec UM-01~05
//
// 실무 피처 = 시험 features 키 → 실무작업실 뷰 정의의 선언적 매핑.
// 신규 실무 피처(예: 다른 시험의 제조·검사 도구)는 여기에 엔트리를
// 추가하고 exams.json에 features 키를 선언하면 된다 — ui-mode 랜딩,
// 뷰 타이틀·해시 슬러그, 지연 로더·핸들러 등록이 전부 이 표에서 유도된다.
//
// 의존성 규칙: 이 모듈의 정적 import는 exam-context 하나로 제한한다.
// 피처 뷰 모듈·DataLoader·ui-utils·도메인 훅은 전부 enter() 내부의
// 지연 import()로 참조해, import 시점의 모듈 그래프 팽창·순환을 막는다.
import { hasFeature } from './exam-context.js';

const _lazyImport = (load) => { let p = null; return () => (p ??= load()); };

const formula = {
    viewId: 'formula-view',
    slug: 'formula',
    title: 'Formula OS',
    subtitle: '원료 조회 · 배합 계산 · My 포뮬러 저장·검증',
    loadingText: 'Formula OS 데이터를 불러오는 중입니다...',
    loadErrorText: 'Formula OS를 불러오지 못했습니다.',
    loaders: {
        main: _lazyImport(() => import('./views/formula.js')),
        batch: _lazyImport(() => import('./views/formula-batch.js')),
        customer: _lazyImport(() => import('./views/formula-customer.js')),
        material: _lazyImport(() => import('./views/formula-material.js')),
        compliance: _lazyImport(() => import('./views/formula-compliance.js')),
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
    ],
    // 뷰 진입 — 피처가 자체 로딩·데이터 선행·초기화·도메인 훅을 소유한다.
    // renderFn은 비동기 — navigateToView가 반환값을 기다리지 않으므로
    // 내부에서 모든 실패를 삼켜야 한다 (토스트로 보고).
    async enter() {
        const [{ DataLoader }, { checkMfdsNotice }, { showGlobalLoading, hideGlobalLoading, showToast }] =
            await Promise.all([
                import('./data-loader.js'),
                import('./notice-check.js'),
                import('./ui-utils.js'),
            ]);
        checkMfdsNotice(); // 식약처 신규 고시 감지 배너 — 도메인 훅 (비차단, 실패 무시)
        showGlobalLoading(formula.loadingText);
        try {
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
 * 실무 모드 랜딩 뷰 — 첫 번째 유효 피처의 뷰.
 * 복수 실무 피처가 활성인 시험은 레지스트리 선언 순서가 랜딩 우선순위다.
 */
export function getPracticeLanding() {
    const enabled = getEnabledPracticeFeatures();
    return enabled.length ? enabled[0].viewId : 'dashboard-view';
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
