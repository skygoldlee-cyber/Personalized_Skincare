// sw.js pruneStaleDataBundles — 한글(비ASCII) 번들 경로 프루닝 회귀 테스트
// 함정: req.url의 pathname은 퍼센트 인코딩 상태인데 레지스트리 참조는 원시 문자열.
// 디코딩 없이 endsWith 비교하면 참조 중인 한글 번들을 고아로 오인해 삭제한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SW_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'sw.js');

/** sw.js를 vm 샌드박스에서 실행해 내부 함수를 꺼낸다 */
function loadSw({ cacheEntries = [], registryText = '', fetchOk = true } = {}) {
  const deleted = [];
  const dataCache = {
    keys: async () => cacheEntries.map((url) => ({ url })),
    delete: async (req) => { deleted.push(req.url); return true; },
  };
  const sandbox = {
    self: {
      addEventListener: () => {},
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => dataCache,
      keys: async () => [],
      delete: async () => true,
      match: async () => undefined,
    },
    fetch: async () => fetchOk
      ? { ok: true, text: async () => registryText }
      : { ok: false },
    Request: class {},
    Response: class {},
    URL,
    URLSearchParams,
    location: { origin: 'https://example.test' },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(SW_PATH, 'utf8'), sandbox, { filename: 'sw.js' });
  return { sandbox, deleted };
}

const KOREAN_BUNDLE = './data/docs_md/두음법_암기_총정리.js';
const KOREAN_URL = `https://example.test/data/docs_md/${encodeURIComponent('두음법_암기_총정리')}.js`;

test('prune: 레지스트리가 참조하는 한글 번들은 삭제하지 않는다', async () => {
  const { sandbox, deleted } = loadSw({
    registryText: `window.X={"files":{"a":"${KOREAN_BUNDLE}"}}`,
    cacheEntries: [
      KOREAN_URL,
      'https://example.test/data/stale_bundle.abc123.js', // 미참조 → 삭제 대상
    ],
  });
  await sandbox.pruneStaleDataBundles();
  assert.ok(!deleted.includes(KOREAN_URL), '참조 중인 한글 번들이 삭제됨');
  assert.ok(deleted.includes('https://example.test/data/stale_bundle.abc123.js'));
});

test('prune: 참조 추출 정규식이 비ASCII 파일명을 인식한다', async () => {
  const { sandbox, deleted } = loadSw({
    registryText: `window.X={"files":{"a":"${KOREAN_BUNDLE}"}}`,
    cacheEntries: [KOREAN_URL],
  });
  await sandbox.pruneStaleDataBundles();
  assert.deepEqual(deleted, []);
});

test('prune: 경로 끝 일치 — 서브디렉터리 배포에서도 참조 번들을 보존한다', async () => {
  const { sandbox, deleted } = loadSw({
    registryText: `window.X={"a":"./data/subject1.abc123.js"}`,
    cacheEntries: ['https://example.test/sub/data/subject1.abc123.js'],
  });
  await sandbox.pruneStaleDataBundles();
  assert.deepEqual(deleted, []);
});

test('prune: drills/supplements/exams 경로는 항상 보존한다', async () => {
  const { sandbox, deleted } = loadSw({
    registryText: 'window.X={}',
    cacheEntries: [
      'https://example.test/data/drills/ch1.js',
      'https://example.test/data/supplements/safety.js',
      'https://example.test/data/exams/cosmetic/exams_md/과목1_단일정답형.js'.replace('과목1_단일정답형', encodeURIComponent('과목1_단일정답형')),
    ],
  });
  await sandbox.pruneStaleDataBundles();
  assert.deepEqual(deleted, []);
});

test('prune: registry fetch 실패 시 아무것도 삭제하지 않는다 (best-effort)', async () => {
  const { sandbox, deleted } = loadSw({
    fetchOk: false,
    cacheEntries: ['https://example.test/data/stale.abc123.js'],
  });
  await sandbox.pruneStaleDataBundles();
  assert.deepEqual(deleted, []);
});
