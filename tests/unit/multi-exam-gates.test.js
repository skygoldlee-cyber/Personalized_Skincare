// tests/unit/multi-exam-gates.test.js — 멀티시험 게이트 스크립트 검증
// @spec DA-11,DA-12,BP-09
// 목적: 파일 계층 분류(check:domainmap)·UI 텍스트 커버리지(check:uitext)·
//       문서 번들 불변식(build_doc_bundles --check) 게이트가 저장소 현 상태에서
//       정상 종료하는지 검증 + 핵심 계약 단위 검증.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (script, args = []) =>
    execFileSync(process.execPath, [join(ROOT, script), ...args],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const examsData = JSON.parse(readFileSync(join(ROOT, 'content', 'exams.json'), 'utf8'));

describe('멀티시험 게이트 — check:domainmap', () => {
    it('저장소 전 파일 분류 검증이 통과한다', () => {
        const out = run('tools/check/check_domain_map.js');
        assert.match(out, /도메인 맵 검증 통과/);
    });

    it('content/exams|data/exams 아래 디렉터리는 모두 등록 시험이다', () => {
        const ids = new Set(examsData.exams.map((e) => e.id));
        for (const base of ['content/exams', 'data/exams']) {
            const abs = join(ROOT, base);
            if (!existsSync(abs)) continue;
            for (const d of readdirSync(abs, { withFileTypes: true })) {
                if (d.isDirectory()) {
                    assert.ok(ids.has(d.name), `미등록 시험 디렉터리: ${base}/${d.name}`);
                }
            }
        }
    });
});

describe('멀티시험 게이트 — check:uitext', () => {
    it('data-uitext ↔ manifest.uiText 감사가 통과한다', () => {
        const out = run('tools/check/check_uitext.js');
        assert.match(out, /uiText 커버리지 정합/);
    });
});

describe('멀티시험 게이트 — 문서 번들 불변식', () => {
    // build_doc_bundles.js의 FEATURE_DOCS와 동일 계약
    const FEATURE_DOCS = {
        studyGuide: '학습안내서.md', appendixDocs: '두음법_암기_총정리.md',
        userManual: 'user_manual.md', formula: 'formula_manual.md',
    };

    it('features 플래그 활성 시험은 대응 문서를 반드시 보유한다', () => {
        for (const e of examsData.exams) {
            const docsDir = join(ROOT, e.contentRoot, 'docs');
            const files = existsSync(docsDir)
                ? readdirSync(docsDir).filter((f) => f.endsWith('.md')) : [];
            for (const [flag, doc] of Object.entries(FEATURE_DOCS)) {
                if (e.features && e.features[flag]) {
                    assert.ok(files.includes(doc),
                        `${e.id}: features.${flag} 활성이나 docs/${doc} 없음`);
                }
            }
        }
    });

    it('check:docbundles --check가 통과한다', () => {
        const out = run('tools/build/build_doc_bundles.js', ['--check']);
        assert.match(out, /원본과 일치/);
    });
});
