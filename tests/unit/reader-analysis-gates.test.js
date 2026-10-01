// tests/unit/reader-analysis-gates.test.js — 리더 위치 보존·맞춤학습 온보딩·서사 커버리지 게이트 검증
// @spec TR-19,AN-04,BP-10
// 소스 구조 단언 + 패치 파일 실물 검증으로 세 게이트의 회귀를 감시한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const READER = readFileSync(join(ROOT, 'src/views/textbook-reader.js'), 'utf-8');
const DASHBOARD = readFileSync(join(ROOT, 'src/views/dashboard.js'), 'utf-8');
const APP = readFileSync(join(ROOT, 'src/app.js'), 'utf-8');
const BUILDER = readFileSync(join(ROOT, 'tools/build/build_story_textbooks.js'), 'utf-8');

// ---------- TR-19: 이야기형 모드 전환 위치 보존 ----------

test('TR-19: 모드 전환 전 현재 섹션 앵커를 getBoundingClientRect로 기억한다', () => {
    assert.ok(/\[id\^="reader-section-"\]/.test(READER), '섹션 앵커 셀렉터 없음');
    assert.ok(/reader-section-/.test(READER) && /getBoundingClientRect/.test(READER), '앵커/좌표 기반 측정 없음');
    assert.ok(/anchorOffset/.test(READER), '섹션 내 오프셋 기억 없음');
});

test('TR-19: 재렌더 후 같은 섹션으로 스크롤 복원한다', () => {
    assert.ok(/renderChapterContent\([^)]*\)\.then|Promise\.resolve\(renderChapterContent/.test(READER), '비동기 재렌더 완료 후 복원 경로 없음');
    assert.ok(/cont\.scrollTop|container\.scrollTop/.test(READER), 'scrollTop 복원 없음');
    // offsetTop 대신 getBoundingClientRect 사용 — offsetParent 미스매치 방지
    const modeBlock = READER.slice(READER.indexOf('anchorIdx'), READER.indexOf('anchorIdx') + 3000);
    assert.ok(!/\.offsetTop/.test(modeBlock), '복원 경로에 offsetTop 잔존');
});

// ---------- AN-04: 진단 준비 온보딩 + 취약 단원 딥링크 ----------

test('AN-04: 분석 뷰가 최소 표본 온보딩 카드를 렌더한다', () => {
    assert.ok(/_renderAnalysisOnboarding/.test(DASHBOARD), '온보딩 렌더러 없음');
    assert.ok(/analysis-onboarding-hint/.test(DASHBOARD), '온보딩 카드 ID 없음');
    assert.ok(/ANALYSIS_MIN_QUIZ\s*=\s*10/.test(DASHBOARD), '퀴즈 최소 표본(10문) 없음');
    assert.ok(/ANALYSIS_MIN_SIM\s*=\s*1/.test(DASHBOARD), '모의고사 최소 표본(1회) 없음');
    assert.ok(/renderAnalysisView[\s\S]{0,400}_renderAnalysisOnboarding/.test(DASHBOARD), '분석 뷰 최상단 미호출');
});

test('AN-04: 취약 단원 행이 openSubjectSection 교재 딥링크를 위임한다', () => {
    assert.ok(/data-click="openSubjectSection"/.test(DASHBOARD), '단원 행 data-click 없음');
    assert.ok(/import[^;]*openSubjectSection/.test(APP) && /\bopenSubjectSection\b,/.test(APP), 'app.js 핸들러 미등록');
    assert.ok(/export function openSubjectSection/.test(READER), '리더 딥링크 함수 없음');
});

// ---------- BP-10: 서사 커버리지 게이트 ----------

test('BP-10: 빌드가 챕터별 서사 블록 수를 리포트하고 0블록 패치를 오류로 처리한다', () => {
    assert.ok(/서사 커버리지/.test(BUILDER), '커버리지 리포트 없음');
    assert.ok(/storyBlocks\.length === 0/.test(BUILDER), '0블록 감지 없음');
    assert.ok(/패치에 story 플래그 블록 없음/.test(BUILDER), '0블록 오류 메시지 없음');
});

test('BP-10: 모든 서사 패치 파일이 story 플래그 insert를 1개 이상 포함한다', () => {
    const textbook = join(ROOT, 'content', 'exams', 'cosmetic', '교재');
    for (const dir of readdirSync(textbook)) {
        const storyDir = join(textbook, dir, 'story');
        let patches = [];
        try { patches = readdirSync(storyDir).filter(f => f.endsWith('_서사.md')); } catch { continue; }
        for (const p of patches) {
            const content = readFileSync(join(storyDir, p), 'utf-8');
            const storyInserts = content.match(/<!--\s*@insert[^>]*\bstory\b\s*-->/g) || [];
            assert.ok(storyInserts.length >= 1, `${dir}/${p}: story 플래그 insert 0개 — 빌드 게이트가 거부할 파일`);
        }
    }
});
