// tests/unit/supabase-client.test.js — Supabase 클라이언트 lazy 초기화 검증
// node:test 환경(DOM 없음)이므로 window/document를 스텁한다.
// 모듈 상태(_client·_vendorPromise) 리셋을 위해 테스트마다 쿼리스트링으로 신선한 인스턴스 import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

let importSeq = 0;
async function freshModule() {
  return import(`../../src/supabase-client.js?case=${importSeq++}`);
}

// loadVendor가 만드는 <script> 스텁 — appendChild 시점에 캡처해 onload/onerror를 수동 발화
function stubDom() {
  const scripts = [];
  global.window = {};
  global.document = {
    createElement(tag) {
      assert.equal(tag, 'script');
      return { src: '', onload: null, onerror: null };
    },
    head: {
      appendChild(el) { scripts.push(el); },
    },
  };
  return scripts;
}

function teardown() {
  delete global.window;
  delete global.document;
}

test('getSupabase: window.supabase 존재 시 스크립트 로드 없이 클라이언트 생성', async () => {
  const { getSupabase } = await freshModule();
  const scripts = stubDom();
  const client = { auth: {} };
  global.window.supabase = { createClient: () => client };

  const sb = await getSupabase();
  assert.equal(sb, client);
  assert.equal(scripts.length, 0); // vendor 로드 생략
  teardown();
});

test('getSupabase: vendor 미로드 시 스크립트 생성 후 로드 완료까지 대기', async () => {
  const { getSupabase } = await freshModule();
  const scripts = stubDom();
  let createArgs = null;
  const client = { auth: {} };

  const promise = getSupabase();
  // appendChild가 동기적으로 호출된 뒤 onload를 발화한다
  assert.equal(scripts.length, 1);
  assert.match(scripts[0].src, /vendor\/supabase\/supabase\.js$/);
  global.window.supabase = { createClient: (...args) => { createArgs = args; return client; } };
  scripts[0].onload();

  const sb = await promise;
  assert.equal(sb, client);
  // createClient 인자: URL, publishable key, auth 옵션 (flowType 명시 고정)
  assert.match(createArgs[0], /^https:\/\/.*\.supabase\.co$/);
  assert.ok(createArgs[1].length > 0);
  assert.equal(createArgs[2].auth.flowType, 'implicit');
  assert.equal(createArgs[2].auth.persistSession, true);
  assert.equal(createArgs[2].auth.detectSessionInUrl, true);
  teardown();
});

test('getSupabase: 클라이언트는 1회만 생성 (캐시)', async () => {
  const { getSupabase } = await freshModule();
  stubDom();
  let createCount = 0;
  global.window.supabase = { createClient: () => { createCount++; return { auth: {} }; } };

  const a = await getSupabase();
  const b = await getSupabase();
  assert.equal(a, b);
  assert.equal(createCount, 1);
  teardown();
});

test('getSupabase: vendor 로드 실패 시 한글 오류로 reject + 재시도 가능', async () => {
  const { getSupabase } = await freshModule();
  const scripts = stubDom();

  const p1 = getSupabase();
  scripts[scripts.length - 1].onerror();
  await assert.rejects(p1, /불러오지 못했습니다/);

  // _vendorPromise가 리셋됐으므로 재시도는 새 스크립트를 만든다
  const p2 = getSupabase();
  assert.equal(scripts.length, 2);
  global.window.supabase = { createClient: () => ({ auth: {} }) };
  scripts[scripts.length - 1].onload();
  await assert.doesNotReject(p2);
  teardown();
});

test('getAuthSession: 세션 유무에 따라 session/null 반환', async () => {
  const { getAuthSession } = await freshModule();
  stubDom();
  let session = { user: { email: 'a@b.c' } };
  global.window.supabase = {
    createClient: () => ({ auth: { getSession: async () => ({ data: { session } }) } }),
  };

  assert.deepEqual(await getAuthSession(), { user: { email: 'a@b.c' } });
  session = null;
  assert.equal(await getAuthSession(), null);
  teardown();
});

test('onAuthChange: 이벤트명과 세션을 콜백 (session, event) 순으로 전달', async () => {
  const { onAuthChange } = await freshModule();
  stubDom();
  let registered = null;
  global.window.supabase = {
    createClient: () => ({
      auth: { onAuthStateChange: (cb) => { registered = cb; } },
    }),
  };

  const calls = [];
  await onAuthChange((session, event) => calls.push([event, session]));
  registered('SIGNED_IN', { user: { email: 'x@y.z' } });
  registered('SIGNED_OUT', null);

  assert.deepEqual(calls[0], ['SIGNED_IN', { user: { email: 'x@y.z' } }]);
  assert.deepEqual(calls[1], ['SIGNED_OUT', null]);
  teardown();
});
