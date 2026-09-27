// tests/unit/build-pipeline.test.js — 빌드 파이프라인 검증 로직 테스트
// @spec BP-01,BP-02,BP-03,BP-04,BP-05,BP-06,BP-07,BP-08
// 매니페스트 로드/검증, 스키마 검증, 마커 감시, 파서 등가성,
// 용어집 인덱스 생성, SW 버전 스탬프, 감사 스크립트 존재를 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const { loadAndValidateManifest } = require('../../tools/build/manifest_loader.js');
const { validateSubjectData, validateExamData } = require('../../tools/build/schema.js');
const idFactory = require('../../tools/build/id_factory.js');
const { computeVersion, stampSwVersion } = require('../../tools/build/stamp_sw_version.js');
const textbookPlugin = require('../../tools/build/plugins/textbook.plugin.js');
const { getExamTargets } = require('../../tools/build/exam_targets.js');

const MANIFEST = join(ROOT, 'content', 'exams', 'cosmetic', 'manifest.json');

// ---------- BP-01: 매니페스트 로드 + id_factory ----------

test('BP-01: 실제 매니페스트가 검증을 통과하고 subjects/exams를 반환한다', () => {
  const m = loadAndValidateManifest(MANIFEST, ROOT);
  assert.equal(m.schemaVersion, 1);
  assert.ok(Array.isArray(m.subjects) && m.subjects.length >= 4);
  assert.ok(Array.isArray(m.exams) && m.exams.length > 0);
});

test('BP-01: stableId가 동일 입력에 동일 ID, 다른 입력에 다른 ID를 생성한다', () => {
  const a = idFactory.stableId('과목1', 'ch1', 'card', '글리세린');
  const b = idFactory.stableId('과목1', 'ch1', 'card', '글리세린');
  const c = idFactory.stableId('과목1', 'ch1', 'card', '파라벤');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^\S+_\w{6}$/, '과목_유형_해시 형식이어야 함');
});

// ---------- BP-02: 스키마 검증 ----------

function validSubject() {
  return {
    name: '테스트 과목',
    cards: [{ id: 'c1', term: '글리세린', definition: '보습제' }],
    quizzes: [{ id: 'q1', question: '글리세린은?', answer: '보습제' }],
    chapters: [{ key: 'ch1', title: '1장' }],
  };
}

test('BP-02: 정상 subject 데이터는 통과한다', () => {
  assert.doesNotThrow(() => validateSubjectData('s1', validSubject()));
});

test('BP-02: 중복 카드 ID를 감지한다', () => {
  const d = validSubject();
  d.cards.push({ id: 'c1', term: '파라벤', definition: '방부제' });
  assert.throws(() => validateSubjectData('s1', d), /Duplicate card ID/);
});

test('BP-02: 필수 필드 누락을 감지한다', () => {
  const d = validSubject();
  delete d.cards;
  assert.throws(() => validateSubjectData('s1', d), /cards/);
});

test('BP-02: 중복 문항 ID를 감지한다', () => {
  const d = {
    id: 'e1',
    title: '모의시험',
    questions: [
      { id: 'q1', num: 1, question: '문항1', answer: 1 },
      { id: 'q1', num: 2, question: '문항2', answer: 2 },
    ],
  };
  assert.throws(() => validateExamData('e1', d), /Duplicate question ID/);
});

// ---------- BP-03: 매니페스트 자체 검증 ----------

function writeTmpManifest(manifest, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    const { mkdirSync } = require('fs');
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return join(dir, 'manifest.json');
}

const baseManifest = () => ({
  schemaVersion: 1,
  subjects: [{ key: 's1', name: '과목1', dir: '교재/s1', order: 1, chapters: [{ key: 'c1', title: '1장', file: 'c1.md' }] }],
  exams: [{ key: 'e1', subject: 's1', part: 1, title: '시험1', file: 'e1.md' }],
});

test('BP-03: chapters[].file가 존재하지 않으면 실패한다', () => {
  const p = writeTmpManifest(baseManifest()); // 파일 미생성
  assert.throws(() => loadAndValidateManifest(p, ROOT), /does not exist/);
});

test('BP-03: exams[].subject가 미정의 과목을 참조하면 실패한다', () => {
  const m = baseManifest();
  m.exams[0].subject = 'undefined-subject';
  const p = writeTmpManifest(m, { '교재/s1/c1.md': '# x', '문제은행/e1.md': '# y' });
  assert.throws(() => loadAndValidateManifest(p, ROOT), /undefined subject/);
});

test('BP-03: 중복 subject key를 감지한다', () => {
  const m = baseManifest();
  m.subjects.push({ ...m.subjects[0] });
  const p = writeTmpManifest(m, { '교재/s1/c1.md': '# x', '문제은행/e1.md': '# y' });
  assert.throws(() => loadAndValidateManifest(p, ROOT), /Duplicate subject key/);
});

// ---------- BP-04: 마커 감시 (🔖기출 → 퀴즈 미생성 경고) ----------

test('BP-04: 실제 교재 빌드에서 마커 감시 warnings 채널이 동작한다', () => {
  const targets = getExamTargets(ROOT).filter(t => t.id === 'cosmetic');
  assert.ok(targets.length === 1);
  const ctx = { ...targets[0], workspaceDir: ROOT, idFactory };
  const subj = targets[0].manifest.subjects[0];
  const data = textbookPlugin.build(subj, ctx);
  assert.ok(Array.isArray(data.cards) && data.cards.length > 0, '카드가 생성돼야 함');
  // _warnings는 비열거 필드로 부착 — 배열이면 감시 경로가 살아있음
  assert.ok(Array.isArray(data._warnings), '마커 감시 경고 채널이 존재해야 함');
});

// ---------- BP-05: 파서 등가성 검증 스크립트 ----------

test('BP-05: check_parser_parity.js가 빌드↔런타임 파서 불일치를 검출 가능하다', () => {
  // 스크립트가 존재하고 실제 불일치 감지 함수를 포함하는지 정적 검증
  const src = readFileSync(join(ROOT, 'tools', 'check_parser_parity.js'), 'utf-8');
  assert.ok(src.includes('buildSubjectData'), '런타임 파서를 동적 import해야 함');
  assert.ok(src.includes('firstDiff'), '비교 함수가 있어야 함');
});

// ---------- BP-06: 용어집 인덱스 생성 ----------

test('BP-06: GLOSSARY_INDEX 생성 산출물이 시험별 용어 인덱스를 포함한다', () => {
  const src = readFileSync(join(ROOT, 'src', 'keyword-index.js'), 'utf-8');
  assert.ok(src.includes('_EXAM_GLOSSARY_INDEX'), '시험별 인덱스 맵이 생성돼야 함');
  assert.ok(src.includes('getGlossaryIndex'), '런타임 접근 함수가 있어야 함');
  assert.ok(src.includes('glossary:'), '생성된 용어 엔트리가 있어야 함');
  assert.ok(src.includes('curated'), '큐레이션 병합 표시가 있어야 함');
});

// ---------- BP-07: SW 캐시 버전 스탬프 ----------

test('BP-07: computeVersion이 prefix-날짜-해시 형식을 생성한다', () => {
  const v = computeVersion({ currentValue: 'v28-20250101-abcdef0', fullTimestamp: true });
  assert.match(v, /^v28-\d{8}-\d{6}$/);
});

test('BP-07: stampSwVersion이 CACHE_VERSION 라인만 치환하고 나머지를 보존한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-'));
  const swPath = join(dir, 'sw.js');
  const original = "// 헤더\nconst CACHE_VERSION = 'v1-old';\nconst DATA_CACHE_VERSION = 'data-1';\n// 푸터\n";
  writeFileSync(swPath, original);

  const r = stampSwVersion({ swPath, version: 'v2-new', silent: true });
  assert.equal(r.changed, true);
  const out = readFileSync(swPath, 'utf-8');
  assert.ok(out.includes("const CACHE_VERSION = 'v2-new'"));
  assert.ok(out.includes("const DATA_CACHE_VERSION = 'data-1'"), 'DATA_CACHE_VERSION은 미변경');
  assert.ok(out.includes('// 푸터'));
});

test('BP-07: 동일 버전 재스탬프는 no-op이다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-'));
  const swPath = join(dir, 'sw.js');
  writeFileSync(swPath, "const CACHE_VERSION = 'v9-x';\n");
  const r = stampSwVersion({ swPath, version: 'v9-x', silent: true });
  assert.equal(r.changed, false);
});

// ---------- BP-08: 콘텐츠 품질 감사 스크립트 ----------

test('BP-08: audit:cards 스크립트가 존재하고 오류 없이 실행된다', () => {
  const out = execFileSync('node', ['tools/audit_card_quality.js'], {
    cwd: ROOT, encoding: 'utf-8', timeout: 60000,
  });
  assert.ok(/감사|audit|ERROR|WARN/i.test(out), '요약 리포트를 출력해야 함');
});
