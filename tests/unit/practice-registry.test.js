// tests/unit/practice-registry.test.js
// @spec UM-01~05
// 실무작업실 피처 레지스트리 — 시험 features 키 ↔ 실무 뷰 정의 매핑,
// 진입 가능 판정·랜딩·타이틀·슬러그·지연 핸들러 유도를 검증.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    isPracticeCapable, getEnabledPracticeFeatures, getPracticeLanding,
    getPracticeViewTitles, getPracticeHashSlugs, getPracticeLazyHandlers,
    getPracticeViewRenderers, warmPracticeFeatures, getPracticeDomainSpec,
} from '../../src/practice-registry.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let originalWindow;

function setExams(exams) {
    Object.defineProperty(global, 'window', {
        value: { EXAMS_LIST: { exams } },
        writable: true, configurable: true,
    });
}

beforeEach(() => { originalWindow = global.window; });
afterEach(() => {
    Object.defineProperty(global, 'window', {
        value: originalWindow, writable: true, configurable: true,
    });
});

test('실무 피처 보유 시험 — isPracticeCapable true, 랜딩은 formula-view', () => {
    setExams([
        { id: 'cosmetic', default: true, features: { formula: true } },
    ]);
    assert.equal(isPracticeCapable(), true);
    assert.equal(getPracticeLanding(), 'formula-view');
    assert.equal(getEnabledPracticeFeatures().length, 1);
});

test('실무 피처 미보유 시험 — isPracticeCapable false, 랜딩 폴백 dashboard-view', () => {
    setExams([
        { id: 'food', default: true, features: { dictionary: true } },
    ]);
    assert.equal(isPracticeCapable(), false);
    assert.equal(getPracticeLanding(), 'dashboard-view');
    assert.deepEqual(getEnabledPracticeFeatures(), []);
});

test('시험 목록 없음 — 진입 불가 판정 (레지스트리 부재 안전)', () => {
    setExams([]);
    assert.equal(isPracticeCapable(), false);
    assert.equal(getPracticeLanding(), 'dashboard-view');
});

test('타이틀 맵 — 선언된 실무 뷰의 title/subtitle을 제공', () => {
    setExams([]);
    const titles = getPracticeViewTitles();
    assert.equal(titles['formula-view'].title, 'Formula OS');
    assert.ok(titles['formula-view'].subtitle.length > 0);
});

test('해시 슬러그 — formula-view → formula', () => {
    setExams([]);
    assert.deepEqual(getPracticeHashSlugs(), { 'formula-view': 'formula' });
});

test('지연 핸들러 — 로더 함수 + 이름 배열 쌍, 이름은 전체 유니크', () => {
    setExams([]);
    const handlers = getPracticeLazyHandlers();
    assert.equal(handlers.length, 6); // main·batch·customer·material·compliance·notice
    const names = [];
    for (const [load, list] of handlers) {
        assert.equal(typeof load, 'function');
        assert.ok(Array.isArray(list) && list.length > 0);
        names.push(...list);
    }
    assert.equal(new Set(names).size, names.length);
    // 대표 핸들러 표본 — 도메인 디스패치 계약 확인
    for (const sample of ['openFormulaList', 'openBatchPanel', 'openCustomerPanel', 'openMaterialPanel', 'openCompliancePanel', 'checkMfdsNoticeNow']) {
        assert.ok(names.includes(sample), `핸들러 누락: ${sample}`);
    }
});

test('뷰 렌더러 맵 — 등록된 실무 뷰 id 키의 함수', () => {
    setExams([]);
    const renderers = getPracticeViewRenderers();
    assert.equal(typeof renderers['formula-view'], 'function');
});

test('유휴 예열 — warmPracticeFeatures가 유효 피처만 예열한다', () => {
    setExams([{ id: 'x', features: {} }]);
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = (...a) => { calls.push(a[0]); return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); };
    try {
        warmPracticeFeatures(); // 피처 미보유 — 아무 요청도 없어야 함
        assert.equal(calls.length, 0);
    } finally { global.fetch = origFetch; }
    assert.equal(typeof warmPracticeFeatures, 'function');
});

test('도메인 경로 규약 — feature를 켠 시험마다 뷰 모듈·마크업이 src/html/exams/<id>/ 아래 존재', () => {
    // 레지스트리가 시험 id 리터럴 없이 규약 경로로 해석하므로, 피처 활성 시험은
    // 규약 위치에 파일을 배치해야 한다 — 신규 시험의 누락을 여기서 차단.
    const spec = getPracticeDomainSpec();
    assert.ok(Object.keys(spec).length > 0);
    const exams = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'content', 'exams.json'), 'utf8')
    ).exams;
    for (const exam of exams) {
        for (const [featKey, decl] of Object.entries(spec)) {
            if (!exam.features || !exam.features[featKey]) continue;
            for (const rel of decl.modules) {
                assert.ok(
                    fs.existsSync(path.join(ROOT, 'src', 'exams', exam.id, rel)),
                    `${exam.id}: src/exams/${exam.id}/${rel} 없음 (features.${featKey} 활성)`
                );
            }
            if (decl.markup) {
                assert.ok(
                    fs.existsSync(path.join(ROOT, 'html', 'exams', exam.id, decl.markup)),
                    `${exam.id}: html/exams/${exam.id}/${decl.markup} 없음 (features.${featKey} 활성)`
                );
            }
            if (decl.styles) {
                assert.ok(
                    fs.existsSync(path.join(ROOT, 'css', 'exams', exam.id, decl.styles)),
                    `${exam.id}: css/exams/${exam.id}/${decl.styles} 없음 (features.${featKey} 활성)`
                );
            }
        }
    }
});
