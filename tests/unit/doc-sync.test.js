// tests/unit/doc-sync.test.js — 문서 동기화 게이트(tools/check/check_doc_sync.js) 분류 로직 검증
// @spec none (게이트 도구 — 정적 검증)
import test from 'node:test';
import assert from 'node:assert/strict';
import checker from '../../tools/check/check_doc_sync.js';

const { isTrigger, isDoc, analyze, parseStatusLine } = checker;

test('소스 경로는 문서 갱신 트리거다', () => {
    for (const f of [
        'src/views/quiz.js', 'tools/build/index.js', 'tests/unit/x.test.js',
        'css/base.css', 'index.html', 'package.json', 'playwright.config.js',
        '.github/workflows/ci.yml', 'manifest.webmanifest', 'vercel.json',
    ]) {
        assert.ok(isTrigger(f), f);
    }
});

test('자동 스탬프·생성물·독립 파이프라인은 트리거에서 제외된다', () => {
    for (const f of [
        'sw.js',                          // deploy 스탬프 자동 커밋
        'data/version.js', 'data/exams.js',
        'content/exams/cosmetic/교재/x.md',
        'ref-pipeline/pdf2md.py', 'vendor/fonts/x.woff2',
        'docs/dev/CHANGES.md', 'AGENTS.md', 'README.md',
        '.gitignore',
    ]) {
        assert.ok(!isTrigger(f), f);
    }
});

test('문서 경로는 갱신으로 인정된다', () => {
    for (const f of ['docs/dev/TESTING.md', 'AGENTS.md', 'README.md', 'ref-pipeline/README.md']) {
        assert.ok(isDoc(f), f);
    }
    assert.ok(!isDoc('src/app.js'));
    assert.ok(!isDoc('index.html'));
});

test('analyze: 소스만 변경 → 위반', () => {
    const r = analyze(['src/app.js', 'tests/unit/x.test.js']);
    assert.equal(r.violated, true);
    assert.deepEqual(r.triggers, ['src/app.js', 'tests/unit/x.test.js']);
    assert.deepEqual(r.docs, []);
});

test('analyze: 소스 + 문서 동반 변경 → 통과', () => {
    const r = analyze(['src/app.js', 'docs/dev/CHANGES.md']);
    assert.equal(r.violated, false);
});

test('analyze: 면제 경로만 변경 → 트리거 없음', () => {
    const r = analyze(['sw.js', 'data/version.js', 'content/exams/cosmetic/교재/x.md']);
    assert.equal(r.triggers.length, 0);
    assert.equal(r.violated, false);
});

test('parseStatusLine: porcelain 상태 열(1~2글자) 제거 — trim된 첫 줄 포함', () => {
    assert.equal(parseStatusLine(' M docs/dev/CHANGES.md'), 'docs/dev/CHANGES.md');
    assert.equal(parseStatusLine('M docs/dev/CHANGES.md'), 'docs/dev/CHANGES.md'); // 출력 trim으로 선행 공백 제거된 첫 줄
    assert.equal(parseStatusLine('?? tools/new.js'), 'tools/new.js');
    assert.equal(parseStatusLine('A  index.html'), 'index.html');
    assert.equal(parseStatusLine('R  old.js -> src/new.js'), 'src/new.js');
    assert.equal(parseStatusLine('M  "docs/한글 파일.md"'), 'docs/한글 파일.md');
});
