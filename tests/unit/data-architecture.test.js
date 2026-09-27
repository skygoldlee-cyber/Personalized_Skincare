// tests/unit/data-architecture.test.js — 데이터 아키텍처 불변식
// @spec DA-01,DA-02,DA-04,DA-06,DA-08
// manifest SSOT, 해시드 번들, file:// 폴백 분할, 멀티시험 대칭 구조,
// 기능 플래그 게이팅을 고정한다.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const examsRegistry = JSON.parse(readFileSync(join(ROOT, 'content', 'exams.json'), 'utf-8'));
const CONTENT = join(ROOT, 'content', 'exams', 'cosmetic');
const manifest = JSON.parse(readFileSync(join(CONTENT, 'manifest.json'), 'utf-8'));
const list = p => (existsSync(p) ? readdirSync(p) : []);

// ---------- DA-01: manifest.json이 SSOT ----------

test('DA-01: manifest의 과목 선언이 생성된 registry 번들의 과목 목록과 일치한다', () => {
  const reg = readFileSync(join(ROOT, 'data', 'exams', 'cosmetic', 'registry.js'), 'utf-8');
  for (const subj of manifest.subjects) {
    assert.ok(reg.includes(`"${subj.key}"`), `registry에 과목 키 '${subj.key}' 없음`);
  }
});

test('DA-01: manifest의 exams 선언이 문제은행 해시 번들로 생성된다', () => {
  const examBundles = list(join(ROOT, 'data', 'exams', 'cosmetic', 'exams'));
  for (const ex of manifest.exams) {
    const found = examBundles.some(f => f.startsWith(`${ex.key}.`) && f.endsWith('.js'));
    assert.ok(found, `exam 번들 없음: ${ex.key}.*.js`);
  }
});

// ---------- DA-02: 해시드 JS 번들 ----------

test('DA-02: subjects/exams/ingredients 번들이 콘텐츠 해시 파일명을 사용한다', () => {
  const dataRoot = join(ROOT, 'data', 'exams', 'cosmetic');
  for (const f of list(join(dataRoot, 'subjects'))) {
    assert.match(f, /^subject\d+\.[0-9a-f]{8}\.js$/, `해시 번들명 아님: ${f}`);
  }
  for (const f of list(join(dataRoot, 'exams'))) {
    assert.match(f, /\.[0-9a-f]{8}\.js$/, `해시 번들명 아님: ${f}`);
  }
  const ing = list(dataRoot).find(f => f.startsWith('ingredients_data.'));
  assert.ok(ing && /\.[0-9a-f]{8}\.js$/.test(ing), 'ingredients 번들 해시명');
});

test('DA-02: registry.js가 해시 번들 파일명을 참조한다', () => {
  const reg = readFileSync(join(ROOT, 'data', 'exams', 'cosmetic', 'registry.js'), 'utf-8');
  assert.match(reg, /subject\d+\.[0-9a-f]{8}\.js/, 'registry가 해시 번들명을 참조');
});

// ---------- DA-04: file:// 폴백 분할 번들 ----------

test('DA-04: study_md 폴백이 과목별 분할 JS로 존재하고 전역을 채운다', () => {
  const dir = join(ROOT, 'data', 'exams', 'cosmetic', 'study_md');
  assert.ok(existsSync(join(dir, 'manifest.js')), '폴백 매니페스트 필수');
  const files = list(dir).filter(f => f.endsWith('.js') && f !== 'manifest.js');
  assert.ok(files.length >= 4, '과목별 폴백 번들');
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf-8');
    assert.ok(/window\./.test(src) || src.includes('STUDY_MD'), `${f}: 전역 노출 없음`);
  }
});

test('DA-04: 폴백 슬러그가 manifest 과목 dir과 일치한다', () => {
  const files = new Set(list(join(ROOT, 'data', 'exams', 'cosmetic', 'study_md')));
  for (const subj of manifest.subjects) {
    const slug = subj.dir.split('/').pop();
    assert.ok(files.has(`${slug}.js`), `폴백 없음: ${slug}.js`);
  }
});

// ---------- DA-06: 멀티시험 대칭 구조 ----------

test('DA-06: exams.json의 각 시험이 contentRoot/dataRoot 대칭 구조를 갖는다', () => {
  assert.ok(examsRegistry.exams.length >= 1);
  for (const ex of examsRegistry.exams) {
    const cRoot = join(ROOT, ex.contentRoot);
    const dRoot = join(ROOT, ex.dataRoot);
    assert.ok(existsSync(join(cRoot, 'manifest.json')), `${ex.id}: content manifest 없음`);
    assert.ok(existsSync(join(dRoot, 'registry.js')), `${ex.id}: data registry.js 없음`);
    assert.ok(existsSync(join(dRoot, 'subjects')), `${ex.id}: subjects 번들 디렉터리 없음`);
    assert.ok(existsSync(join(dRoot, 'exams')), `${ex.id}: exams 번들 디렉터리 없음`);
  }
});

test('DA-06: registry 엔트리의 manifestPath/registryBundle이 실제 존재한다', () => {
  for (const ex of examsRegistry.exams) {
    assert.ok(existsSync(join(ROOT, ex.manifestPath)), `${ex.id}.manifestPath`);
    assert.ok(existsSync(join(ROOT, ex.registryBundle)), `${ex.id}.registryBundle`);
  }
});

// ---------- DA-08: 기능 플래그 게이팅 ----------

let ctx;
let origWindow, origLocalStorage;

beforeEach(async () => {
  origWindow = global.window;
  origLocalStorage = global.localStorage;
  const store = {};
  Object.defineProperty(global, 'localStorage', {
    value: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    configurable: true, writable: true,
  });
  global.window = { EXAMS_LIST: { exams: JSON.parse(JSON.stringify(examsRegistry.exams)) } };
  ctx = await import(`../../src/exam-context.js?t=${Date.now()}-${Math.random()}`);
});

afterEach(() => {
  global.window = origWindow;
  Object.defineProperty(global, 'localStorage', { value: origLocalStorage, configurable: true, writable: true });
});

test('DA-08: hasFeature가 features 플래그에 따라 도메인 기능을 게이트한다', () => {
  assert.equal(ctx.hasFeature('dictionary'), true);
  assert.equal(ctx.hasFeature('formula'), true);
  assert.equal(ctx.hasFeature('nonexistent'), false, '미정의 플래그는 false');
});

test('DA-08: 플래그를 끄면 hasFeature가 즉시 반영한다', () => {
  global.window.EXAMS_LIST.exams[0].features.dictionary = false;
  assert.equal(ctx.hasFeature('dictionary'), false);
});

test('DA-08: features 미지정 시험은 모든 플래그가 false다', () => {
  delete global.window.EXAMS_LIST.exams[0].features;
  assert.equal(ctx.hasFeature('dictionary'), false);
});
