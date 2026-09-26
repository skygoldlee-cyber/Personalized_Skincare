// tests/unit/feedback.test.js — 의견 수신 모듈 (src/feedback.js) 검증
// 설계: docs/dev/design/USER_FEEDBACK_DESIGN.md
// node:test 환경 — window/document/localStorage를 스텁하고,
// 모듈 상태 클린업을 위해 케이스마다 쿼리스트링으로 신선한 인스턴스를 import한다.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let importSeq = 0;
async function freshModule() {
  return import(`../../src/feedback.js?case=${importSeq++}`);
}

function createMockStorage() {
  const store = {};
  return {
    getItem(k) { return k in store ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key(i) { return Object.keys(store)[i] ?? null; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
    _store: store,
  };
}

let mockStorage;

// Supabase 스텁 — supabase-client의 _client가 모듈 캐시에 유지되므로
// createClient를 테스트마다 교체할 수 없다. 대신 가변 상태를 읽는
// 단일 스텁을 두고 각 테스트에서 상태만 리셋한다.
let insertCalls;
let insertError;
let authSession;

beforeEach(() => {
  mockStorage = createMockStorage();
  global.localStorage = mockStorage;
  insertCalls = [];
  insertError = null;
  authSession = null;
  global.window = {
    APP_VERSION: 'v-test-1',
    supabase: {
      createClient: () => ({
        auth: { getSession: async () => ({ data: { session: authSession } }) },
        from: (table) => ({
          insert: async (rows) => {
            insertCalls.push({ table, rows });
            return { error: insertError };
          },
        }),
      }),
    },
  };
  Object.defineProperty(global, 'navigator', {
    value: { userAgent: 'test-agent' },
    configurable: true,
    writable: true,
  });
});

function stubLocation(url) {
  const u = new URL(url);
  global.window.location = { href: url };
  const replaces = [];
  global.window.history = {
    replaceState: (_s, _t, newUrl) => replaces.push(newUrl),
  };
  return { replaces };
}

// ---------------------------------------------------------------------------
// ?src= 유입 채널 캡처
// ---------------------------------------------------------------------------

test('captureEntrySource: 유효한 ?src=는 저장 후 주소창에서 제거', async () => {
  const { captureEntrySource, getEntrySource } = await freshModule();
  const { replaces } = stubLocation('https://app.example/?src=yt-main');

  captureEntrySource();
  assert.equal(getEntrySource(), 'yt-main');
  assert.equal(replaces.length, 1);
  assert.ok(!replaces[0].includes('src='));
});

test('captureEntrySource: 허용 패턴 외(src 대문자·특수문자·20자 초과)는 무시', async () => {
  const { captureEntrySource, getEntrySource } = await freshModule();
  for (const bad of ['YT-MAIN', 'yt_main', 'a'.repeat(21), '<script>']) {
    stubLocation(`https://app.example/?src=${encodeURIComponent(bad)}`);
    captureEntrySource();
    assert.equal(getEntrySource(), null, `src=${bad}`);
  }
});

test('captureEntrySource: 최초 유입 채널은 이후 방문으로 덮어쓰지 않음', async () => {
  const { captureEntrySource, getEntrySource } = await freshModule();
  stubLocation('https://app.example/?src=yt-main');
  captureEntrySource();
  stubLocation('https://app.example/?src=yt-shorts');
  captureEntrySource();
  assert.equal(getEntrySource(), 'yt-main');
});

// ---------------------------------------------------------------------------
// 페이로드 빌드·검증
// ---------------------------------------------------------------------------

test('buildFeedbackPayload: 본문 trim·kind 화이트리스트·rating 범위 검증', async () => {
  const { buildFeedbackPayload } = await freshModule();
  const p = buildFeedbackPayload({ kind: 'bogus', rating: 9, body: '  내용입니다  ', view: 'dashboard' });
  assert.equal(p.kind, 'improve');      // 미등록 kind → 기본값
  assert.equal(p.rating, null);         // 1~5 외 → null
  assert.equal(p.body, '내용입니다');   // trim
  assert.equal(p.view, 'dashboard');
  assert.equal(p.app_version, 'v-test-1');
});

test('buildFeedbackPayload: entry_src가 페이로드에 첨부됨', async () => {
  const { captureEntrySource, buildFeedbackPayload } = await freshModule();
  stubLocation('https://app.example/?src=yt-bumper');
  captureEntrySource();
  const p = buildFeedbackPayload({ kind: 'bug', body: '오류입니다' });
  assert.equal(p.entry_src, 'yt-bumper');
});

test('validateFeedback: 짧은 본문·허니팝·개인정보 패턴 거부', async () => {
  const { validateFeedback } = await freshModule();
  assert.equal(validateFeedback({ body: '짧음', meta: {} }), 'short');
  assert.equal(validateFeedback({ body: '충분히 긴 본문입니다', meta: { honeypot: true } }), 'spam');
  assert.equal(validateFeedback({ body: '제 메일은 a@b.com 입니다', meta: {} }), 'pii');
  assert.equal(validateFeedback({ body: '연락처는 010-1234-5678', meta: {} }), 'pii');
  assert.equal(validateFeedback({ body: '좋은 앱이네요 감사합니다', meta: {} }), null);
});

test('cooldownRemaining: 마지막 제출 후 60초 미만이면 잔여 반환', async () => {
  const { cooldownRemaining } = await freshModule();
  mockStorage._store['feedback_last_ts'] = '10000';
  assert.equal(cooldownRemaining(30000), 40000);  // 20초 경과 → 40초 남음
  assert.equal(cooldownRemaining(80000), 0);      // 60초 경과 → 해제
  assert.equal(cooldownRemaining(5000, 1000), 56000); // 명시적 lastTs
});

// ---------------------------------------------------------------------------
// 제출·큐·플러시
// ---------------------------------------------------------------------------

test('submitFeedback: Supabase 성공 시 sent + 큐 비움', async () => {
  const { submitFeedback } = await freshModule();
  const res = await submitFeedback({ kind: 'praise', body: '좋은 앱입니다', view: 'dashboard' });
  assert.equal(res.status, 'sent');
  assert.equal(insertCalls.length, 1);
  assert.equal(insertCalls[0].table, 'feedback');
  assert.equal(JSON.parse(mockStorage._store['pending_feedback']).length, 0);
});

test('submitFeedback: Supabase 실패 시 queued — 큐에 보존', async () => {
  const { submitFeedback } = await freshModule();
  insertError = new Error('network');
  const res = await submitFeedback({ kind: 'bug', body: '버그 신고합니다' });
  assert.equal(res.status, 'queued');
  const q = JSON.parse(mockStorage._store['pending_feedback']);
  assert.equal(q.length, 1);
  assert.equal(q[0].body, '버그 신고합니다');
});

test('submitFeedback: 쿨다운 중이면 cooldown 반환·전송 없음', async () => {
  const { submitFeedback } = await freshModule();
  await submitFeedback({ kind: 'praise', body: '첫 의견입니다' });
  const res = await submitFeedback({ kind: 'praise', body: '두 번째 의견입니다' });
  assert.equal(res.status, 'cooldown');
  assert.equal(insertCalls.length, 1); // 두 번째는 전송되지 않음
});

test('flushPendingFeedback: 큐 전송 성공 시 비우고 건수 반환', async () => {
  const { submitFeedback, flushPendingFeedback } = await freshModule();
  insertError = new Error('offline');
  await submitFeedback({ kind: 'bug', body: '오프라인 의견입니다' });

  insertError = null; // 이제 온라인
  const flushed = await flushPendingFeedback();
  assert.equal(flushed, 1);
  assert.equal(insertCalls[1].rows.length, 1);
  assert.equal(JSON.parse(mockStorage._store['pending_feedback']).length, 0);
});

test('flushPendingFeedback: 여전히 실패하면 큐 유지', async () => {
  const { submitFeedback, flushPendingFeedback } = await freshModule();
  insertError = new Error('x');
  await submitFeedback({ kind: 'bug', body: '보류 중인 의견입니다' });
  const flushed = await flushPendingFeedback();
  assert.equal(flushed, 0);
  assert.equal(JSON.parse(mockStorage._store['pending_feedback']).length, 1);
});

test('submitFeedback: 선행 큐와 함께 한 번에 전송', async () => {
  const { submitFeedback } = await freshModule();
  insertError = new Error('x');
  await submitFeedback({ kind: 'bug', body: '오프라인 중 의견' });

  insertError = null;
  mockStorage._store['feedback_last_ts'] = '0'; // 쿨다운 해제
  const res = await submitFeedback({ kind: 'idea', body: '온라인 후 의견' });
  assert.equal(res.status, 'sent');
  assert.equal(insertCalls[1].rows.length, 2); // 큐 1 + 신규 1
});
