// tests/unit/perf-invariants.test.js — 성능 요구사항 (PF-01~16)
// @spec PF-01~16
// 런타임 파싱·온디맨드 로딩·캐싱·지연 로딩 등 성능 최적화 구조를 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf-8');
const srcFiles = ['src', 'src/views', 'src/config']
  .flatMap(d => readdirSync(join(ROOT, d)).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`));

// ---------- PF-01: 런타임 MD 파싱 ----------

test('PF-01: DataLoader가 content/*.md를 런타임 fetch+파싱한다', () => {
  const dl = read('src/data-loader.js');
  assert.ok(dl.includes('fetch'), 'fetch 사용');
  assert.ok(/\.md/.test(dl), 'MD 대상');
  const tp = read('src/textbook-parser.js');
  assert.ok(/parse|build/.test(tp), '런타임 파서 존재');
});

// ---------- PF-02: 온디맨드 과목 로딩 ----------

test('PF-02: 과목 데이터가 전체 일괄이 아닌 과목 단위로 로드된다', () => {
  const dl = read('src/data-loader.js');
  assert.ok(/async loadSubject\(key\)/.test(dl), '과목 단위 로딩 API');
  assert.ok(/this\._loaded\[key\]/.test(dl), '과목별 로드 캐시');
  // file:// 경로도 과목별 분할 번들을 개별 주입
  assert.ok(/STUDY_MD_SUBJECT_BUNDLE\(subjectKey\)/.test(dl), '과목별 폴백 번들 로드');
});

// ---------- PF-03: file:// 폴백 분할 ----------

test('PF-03: file:// 폴백이 과목별 분할 번들이다 (data-architecture 테스트와 동일 불변식)', () => {
  const dir = join(ROOT, 'data', 'exams', 'cosmetic', 'study_md');
  const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'manifest.js');
  assert.ok(files.length >= 4, '과목별 분할 유지');
});

// ---------- PF-04: 참조자료 sessionStorage 캐싱 ----------

test('PF-04: html-viewer가 sessionStorage 24h TTL 캐시를 사용한다', () => {
  const hv = read('src/html-viewer.js');
  assert.ok(/makeSessionCache/.test(hv), 'sessionStorage 캐시 (doc-overlay 공용)');
  const cacheCfg = read('src/config/cache.js');
  const m = cacheCfg.match(/FETCH_CACHE_TTL_MS\s*:\s*([^,]+)/);
  assert.ok(m, 'TTL 상수 정의');
  const hours = eval(m[1]) / 3600000;
  assert.equal(hours, 24, 'TTL은 24시간');
});

// ---------- PF-05: 검색 조기 종료 + 지연 하이라이트 ----------

test('PF-05: html-viewer가 requestIdleCallback 지연 하이라이트를 사용한다', () => {
  const hv = read('src/html-viewer.js');
  assert.ok(/requestIdleCallback/.test(hv), 'requestIdleCallback');
  assert.ok(/endIdx|highlightRest/.test(hv), '분할 하이라이트');
});

// ---------- PF-06: span 일괄 제거 ----------

test('PF-06: span 제거가 수집 후 일괄 처리 + 부모당 normalize 1회다', () => {
  const hv = read('src/html-viewer.js');
  assert.ok(/querySelectorAll\('span'\)/.test(hv), 'span 일괄 수집');
  assert.ok(/normalize\(\)/.test(hv), 'normalize 호출');
  // 개별 replaceWith/innerHTML 반복이 아닌 insertBefore/removeChild 일괄 처리
  assert.ok(/insertBefore\(span\.firstChild/.test(hv), '일괄 이동 처리');
});

// ---------- PF-07: 대시보드 통계 O(1) ----------

test('PF-07: 대시보드가 과목 카운트 맵을 캐시해 과목당 O(1) 조회한다', () => {
  const d = read('src/views/dashboard.js');
  assert.ok(/_subjCountCache/.test(d), '카운트 맵 캐시');
  assert.ok(/_subjCountCacheKey/.test(d), '캐시 키 무효화');
  // 과목 루프 내 재계산이 아닌 캐시 맵 조회
  assert.ok(/const subjCounts = _getSubjCounts\(\)/.test(d), '캐시된 맵 조회');
});

// ---------- PF-08: 검색 인덱스 사전 구축 ----------

test('PF-08: 교재 검색이 인덱스를 사전 구축하고 키 변경 시에만 재구축한다', () => {
  const ts = read('src/views/textbook-search.js');
  assert.ok(/_searchIndex/.test(ts), '검색 인덱스 캐시');
  assert.ok(/_searchIndexKeys/.test(ts), '인덱스 키 비교로 재구축 방지');
  assert.ok(/_invertedIndex/.test(ts), '역색인 인덱스');
});

// ---------- PF-09: 디바운스 ----------

test('PF-09: 검색 디바운스가 250ms 상수로 관리된다', () => {
  const timing = read('src/config/timing.js');
  const m = timing.match(/SEARCH_DEBOUNCE_MS\s*:\s*(\d+)/);
  assert.ok(m, '디바운스 상수');
  assert.equal(Number(m[1]), 250);
  assert.ok(/debounce\(/.test(read('src/views/textbook-search.js')), '디바운스 적용 (utils.debounce — 내부 clearTimeout)');
});

// ---------- PF-10: console.log → console.debug ----------

test('PF-10: src에 console.log가 없다 (debug/warn/error만 사용)', () => {
  for (const f of srcFiles) {
    const src = read(f);
    const hits = src.match(/console\.log\s*\(/g) || [];
    assert.deepEqual(hits, [], `${f}: console.log ${hits.length}건`);
  }
});

// ---------- PF-11: ref_md MD 변환 산출물 ----------

test('PF-11: 참조자료가 ref_md(MD 변환본)로 배포된다 (content-structure 테스트와 동일 불변식)', () => {
  const refRoot = join(ROOT, 'content', 'exams', 'cosmetic', '참조자료', 'ref_md');
  assert.ok(existsSync(refRoot), 'ref_md 디렉터리');
  let mdCount = 0;
  for (const sd of readdirSync(refRoot).filter(d => /^과목\d$/.test(d))) {
    mdCount += readdirSync(join(refRoot, sd))
      .filter(doc => existsSync(join(refRoot, sd, doc, `${doc}.md`))).length;
  }
  assert.ok(mdCount >= 30, `MD 변환본 ${mdCount}종`);
});

// ---------- PF-12: 용어집 인덱스 경로 단축 ----------

test('PF-12: 용어집 인덱스가 문서 전체 경로 대신 단축 refDoc명을 저장한다', () => {
  const ki = read('src/keyword-index.js');
  const refDocs = [...ki.matchAll(/"refDoc":"([^"]+)"/g)].map(m => m[1]);
  assert.ok(refDocs.length > 0, 'refDoc 엔트리');
  const withPath = refDocs.filter(d => /\//.test(d));
  assert.deepEqual(withPath.slice(0, 3), [], `경로 포함 refDoc: ${withPath.slice(0, 3)}`);
});

// ---------- PF-13: Mermaid 온디맨드 ----------

test('PF-13: Mermaid.js가 노드 존재 시에만 지연 로드된다', () => {
  const mr = read('src/mermaid-render.js');
  assert.ok(/_mermaidLoadPromise/.test(mr), '로드 프로미스 싱글턴');
  assert.ok(/script\.src\s*=\s*PATHS\.VENDOR_MERMAID/.test(mr), '동적 스크립트 로드');
  // 노드 없으면 ensureMermaid 호출 전에 조기 반환
  const fn = mr.match(/export function renderMermaidIn[\s\S]{0,200}/);
  assert.ok(fn && /nodes\.length === 0\) return/.test(fn[0]), '노드 없음 조기 반환');
});

// ---------- PF-14: 전역 테이블 가로 스크롤 ----------

test('PF-14: 테이블 래퍼에 전역 가로 스크롤 규칙이 있다', () => {
  const allCss = readdirSync(join(ROOT, 'css')).filter(f => f.endsWith('.css'))
    .map(f => read(`css/${f}`)).join('\n');
  assert.ok(/table-wrapper[^}]*overflow-x:\s*auto/.test(allCss), '테이블 래퍼 overflow-x');
});

// ---------- PF-15: 법령원문 중복 제거 ----------

test('PF-15: 화장품법 법령원문이 단일 정본으로 참조된다', () => {
  const pr = read('src/pdf-registry.js');
  const lawRefs = [...pr.matchAll(/화장품법\(법률\)\(제20901호\)/g)];
  assert.ok(lawRefs.length > 0, '법률 정본 참조');
  // 구버전 '공통' 폴더 분리본이 없어야 함
  const refRoot = join(ROOT, 'content', 'exams', 'cosmetic', '참조자료', 'ref_md');
  const subjects = readdirSync(refRoot).filter(d => /^과목\d$/.test(d));
  const lawDocs = [];
  for (const sd of subjects) {
    for (const doc of readdirSync(join(refRoot, sd))) {
      if (/화장품법\(법률\)/.test(doc)) lawDocs.push(`${sd}/${doc}`);
    }
  }
  assert.equal(lawDocs.length, 1, `법령원문 중복: ${lawDocs.join(', ')}`);
});

// ---------- PF-16: mermaid-utils 공용화 ----------

test('PF-16: 다이어그램 타입 감지가 mermaid-utils로 공용화됐다', () => {
  assert.ok(existsSync(join(ROOT, 'src', 'mermaid-utils.js')), '공용 유틸 존재');
  const mu = read('src/mermaid-utils.js');
  assert.ok(/export function detectMermaidType/.test(mu), 'detectMermaidType');
  // 3개 소비 모듈 중 임포트 확인 (render + 최소 1개 이상의 뷰)
  const consumers = srcFiles.filter(f => /from ['"][^'"]*mermaid-utils/.test(read(f)));
  assert.ok(consumers.length >= 1, `소비 모듈: ${consumers.join(', ')}`);
});
