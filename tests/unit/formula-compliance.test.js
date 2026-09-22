// 법규 준수 체크리스트 정합성 — 항목 id 고유성, 참조 키 유효성,
// LAW_DOCS 경로가 실제 content 파일과 일치하는지 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT_ROOT = join(ROOT, 'content', 'exams', 'cosmetic');
const { COMPLIANCE_SECTIONS, LAW_DOCS } = await import(
    pathToFileURL(join(ROOT, 'src/views/formula-compliance.js')).href);

test('모든 체크 항목 id가 고유하고 비어 있지 않다', () => {
    const ids = [];
    for (const sec of COMPLIANCE_SECTIONS) {
        assert.ok(sec.id && sec.title, '섹션에 id/title 필요');
        assert.ok(Array.isArray(sec.items) && sec.items.length > 0, `${sec.id} 항목 없음`);
        for (const it of sec.items) {
            assert.ok(it.id && it.text, `${sec.id}에 id/text 없는 항목`);
            ids.push(it.id);
        }
    }
    assert.equal(new Set(ids).size, ids.length, '중복 항목 id 발견');
});

test('모든 항목의 refs/app 참조가 유효하다', () => {
    for (const sec of COMPLIANCE_SECTIONS) {
        for (const it of sec.items) {
            for (const key of it.refs || []) {
                assert.ok(LAW_DOCS[key], `${it.id}의 ref '${key}'가 LAW_DOCS에 없음`);
            }
            if (it.app) {
                assert.ok(it.app.label && it.app.click, `${it.id}의 app 링크에 label/click 필요`);
            }
        }
    }
});

test('LAW_DOCS의 모든 문서 경로가 content 파일로 존재한다', () => {
    for (const [key, doc] of Object.entries(LAW_DOCS)) {
        assert.ok(doc.label && doc.desc && doc.path, `${key}에 label/desc/path 필요`);
        const full = join(CONTENT_ROOT, ...doc.path.split('/'));
        assert.ok(existsSync(full), `참조 문서 없음: ${doc.path}`);
    }
});

test('핵심 법정 의무 영역이 모두 커버된다', () => {
    const secIds = COMPLIANCE_SECTIONS.map(s => s.id);
    for (const req of ['license', 'facility', 'mixing', 'records', 'labeling', 'safety']) {
        assert.ok(secIds.includes(req), `필수 섹션 '${req}' 누락`);
    }
});
