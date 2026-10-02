// tests/unit/test-first.test.js — 테스트 선행 게이트(tools/check/check_test_first.js) 분류 로직 검증
// @spec none (게이트 도구 — 정적 검증)
import test from 'node:test';
import assert from 'node:assert/strict';
import checker from '../../tools/check/check_test_first.js';

const { isTrigger, isTest, analyze, parseStatusLine } = checker;

test('실행 로직 경로는 테스트 동반 트리거다', () => {
    for (const f of [
        'src/app.js', 'src/views/quiz.js', 'src/router.js',
        'ref-pipeline/pdf2md.py', 'ref-pipeline/convert.py',
    ]) {
        assert.ok(isTrigger(f), f);
    }
});

test('테스트·마크업·설정·문서·도구는 트리거가 아니다', () => {
    for (const f of [
        'tests/unit/x.test.js', 'tests/dom/y.dom.test.js',
        'ref-pipeline/tests/test_pdf2md.py',
        'css/base.css', 'html/views/x.html', 'index.html',
        'tools/check/check_docs_paths.js',   // tools/ 체커 — docsync가 감시
        'package.json', 'vercel.json', '.github/workflows/ci.yml',
        'sw.js', 'data/version.js', 'content/exams/x.md',
        'docs/dev/CHANGES.md', 'AGENTS.md', 'ref-pipeline/README.md',
    ]) {
        assert.ok(!isTrigger(f), f);
    }
});

test('테스트 경로는 인정된다', () => {
    for (const f of [
        'tests/unit/x.test.js', 'tests/e2e/y.spec.js',
        'ref-pipeline/tests/test_md2doc.py',
    ]) {
        assert.ok(isTest(f), f);
    }
    assert.ok(!isTest('src/state.js'));
});

test('analyze: 로직만 변경 → 위반', () => {
    const r = analyze(['src/app.js', 'docs/dev/CHANGES.md']);
    assert.equal(r.violated, true);
    assert.deepEqual(r.triggers, ['src/app.js']);
    assert.deepEqual(r.tests, []);
});

test('analyze: 로직 + 테스트 동반 → 통과', () => {
    assert.equal(analyze(['src/app.js', 'tests/dom/app.dom.test.js']).violated, false);
    assert.equal(analyze(['ref-pipeline/pdf2md.py', 'ref-pipeline/tests/test_pdf2md.py']).violated, false);
});

test('analyze: 문서만 변경 → 트리거 없음', () => {
    const r = analyze(['AGENTS.md', 'docs/dev/SPEC.md']);
    assert.equal(r.triggers.length, 0);
    assert.equal(r.violated, false);
});

test('parseStatusLine: porcelain 상태 열 처리', () => {
    assert.equal(parseStatusLine(' M src/app.js'), 'src/app.js');
    assert.equal(parseStatusLine('?? tools/check/new.js'), 'tools/check/new.js');
    assert.equal(parseStatusLine('R  old.py -> ref-pipeline/new.py'), 'ref-pipeline/new.py');
});
