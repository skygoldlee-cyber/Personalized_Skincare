// tests/unit/property-based.test.js
// @spec DR-07,F-07~09,Q-08
// 속성 기반 테스트 (fast-check) — 예제 기반 테스트가 놓치는 입력 공간의 불변식 검증.
// 대상: 순수 로직 (questions.js 조합 도출, weak-items.js ID 문법, SM-2 스케줄러).
// 새 불변식을 추가할 때는 임의 생성기(arb)와 "항상 성립해야 할 성질"을 짝지어 작성한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { deriveComboAnswer, generateComboOptions } from '../../src/questions.js';
import {
  weakItemKey, parseWeakSimId, subjectKeyFromItemId, WEAK_QUIZ_PREFIX,
} from '../../src/weak-items.js';

// ── 공용 생성기 ─────────────────────────────────────────────

// 진술 라벨 — 실제 관례인 ㄱㄴㄷㄹ 계열 유니코드 + 일반 문자열 혼합
const stmtIdArb = fc.constantFrom('ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'a', 'b', 'c');
const stmtIdsArb = fc.uniqueArray(stmtIdArb, { minLength: 2, maxLength: 5 });

/** statements + truth 부분집합 생성 */
const comboArb = stmtIdsArb.chain(ids =>
  fc.record({
    ids: fc.constant(ids),
    truthIds: fc.constant(ids).chain(all =>
      fc.uniqueArray(fc.constantFrom(...all), { minLength: 0, maxLength: all.length })),
  }));

/** members가 truth 집합과 동일한지 */
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// ── deriveComboAnswer ───────────────────────────────────────

test('PBT deriveComboAnswer: truth 일치 옵션이 정확히 1개면 그 id 반환', () => {
  fc.assert(fc.property(comboArb, fc.nat({ max: 4 }), ({ ids, truthIds }, extraCount) => {
    // 정답 옵션 + truth와 다른 오지 options 구성
    const seen = new Set([truthIds.join(',')]);
    const options = [{ id: 'correct', members: [...truthIds] }];
    // 모든 부분집합 중 truth와 다른 것으로 오지 생성
    for (let mask = 0; mask < (1 << ids.length) && options.length < extraCount + 1; mask++) {
      const mem = ids.filter((_, i) => mask & (1 << i));
      const key = mem.join(',');
      if (seen.has(key) || sameSet(mem, truthIds)) continue;
      seen.add(key);
      options.push({ id: `o${options.length}`, members: mem });
    }
    const q = { statements: ids.map(id => ({ id, truth: truthIds.includes(id) })), options };
    const derived = deriveComboAnswer(q);
    assert.equal(derived, 'correct',
      `ids=${ids} truth=${truthIds} opts=${options.length} → ${derived}`);
  }), { numRuns: 300 });
});

test('PBT deriveComboAnswer: 일치 옵션 2개 이상이면 null (유일성 위반)', () => {
  fc.assert(fc.property(comboArb, ({ ids, truthIds }) => {
    const q = {
      statements: ids.map(id => ({ id, truth: truthIds.includes(id) })),
      options: [
        { id: 'a', members: [...truthIds] },
        { id: 'b', members: [...truthIds].reverse() }, // 같은 집합 다른 순서
      ],
    };
    assert.equal(deriveComboAnswer(q), null);
  }), { numRuns: 200 });
});

test('PBT deriveComboAnswer: 진술 순서 셔플 불변 — 결과 동일', () => {
  fc.assert(fc.property(comboArb, fc.nat(), ({ ids, truthIds }, seed) => {
    const mk = (stmtIds) => ({
      statements: stmtIds.map(id => ({ id, truth: truthIds.includes(id) })),
      options: [
        { id: 'a', members: [...truthIds] },
        { id: 'b', members: [...ids].filter(x => !truthIds.includes(x)) },
      ],
    });
    const shuffled = [...ids].sort(() => (seed % 3) - 1); // 결정적 셔플
    assert.equal(deriveComboAnswer(mk(ids)), deriveComboAnswer(mk(shuffled)));
  }), { numRuns: 200 });
});

// ── generateComboOptions ────────────────────────────────────

test('PBT generateComboOptions: 멤버 ⊆ 전체, 정답 유일, id 연속, 결정성(같은 rng)', () => {
  const seeded = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  fc.assert(fc.property(comboArb, fc.integer({ min: 0, max: 1e9 }), ({ ids, truthIds }, seed) => {
    const opts = generateComboOptions(ids, truthIds, { count: 5, rng: seeded(seed) });
    // 정답 옵션은 정확히 1개
    const matches = opts.filter(o => sameSet(o.members, truthIds));
    assert.equal(matches.length, 1, `정답 옵션 ${matches.length}개`);
    // 멤버 ⊆ allIds, 멤버 중복 없음, 옵션 멤버 집합 중복 없음
    const memberKeys = new Set();
    for (const o of opts) {
      for (const m of o.members) assert.ok(ids.includes(m), `비진술 참조 ${m}`);
      assert.equal(new Set(o.members).size, o.members.length, '멤버 중복');
      const key = [...o.members].sort().join(',');
      assert.ok(!memberKeys.has(key), `옵션 멤버셋 중복 ${key}`);
      memberKeys.add(key);
    }
    // id는 1..N 연속 문자열
    assert.deepEqual(opts.map(o => o.id), opts.map((_, i) => String(i + 1)));
    // 같은 시드 → 같은 결과 (재현성 — 감사 시그니처 안정성)
    const again = generateComboOptions(ids, truthIds, { count: 5, rng: seeded(seed) });
    assert.deepEqual(again.map(o => o.members), opts.map(o => o.members));
  }), { numRuns: 200 });
});

// ── weak-items ID 문법 ──────────────────────────────────────

const examIdArb = fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/);
const qNumArb = fc.integer({ min: 1, max: 999 });

test('PBT parseWeakSimId: weak_sim_<exam>_q<n> 왕복 + 비접두사 null', () => {
  fc.assert(fc.property(examIdArb, qNumArb, (examId, n) => {
    const id = `weak_sim_${examId}_q${n}`;
    assert.deepEqual(parseWeakSimId(id), { examId, qNum: n });
  }), { numRuns: 200 });

  fc.assert(fc.property(
    fc.string().filter(s => !s.startsWith('weak_sim_')),
    s => assert.equal(parseWeakSimId(s), null)
  ), { numRuns: 200 });
});

test('PBT weakItemKey: 멱등 — 적용 결과에 재적용해도 동일', () => {
  fc.assert(fc.property(
    fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
    s => assert.equal(weakItemKey(weakItemKey(s)), weakItemKey(s))
  ), { numRuns: 200 });
});

test('PBT subjectKeyFromItemId: <subj>_card_|_quiz_ 꼬리에서 과목 키 복원', () => {
  fc.assert(fc.property(examIdArb, qNumArb, (subj, n) => {
    for (const kind of ['card', 'quiz']) {
      assert.equal(subjectKeyFromItemId(`${subj}_${kind}_${n}`), subj);
      assert.equal(subjectKeyFromItemId(`${WEAK_QUIZ_PREFIX}${subj}_${kind}_${n}`), subj);
    }
  }), { numRuns: 200 });
});

// ── SM-2 스케줄러 (spaced-repetition.js) ────────────────────
// updateCardSchedule은 storage 경유 — localStorage를 인메모리로 스텁.

/** @param {Map<string,string>} store */
const localStorageStub = (store) => ({
  getItem: (k) => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
});

test('PBT SM-2: 연속 정답 시 repetition 단조 증가·interval≥1·nextReview>오늘', async () => {
  const store = new Map();
  const orig = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub(store), configurable: true });
  try {
    const { updateCardSchedule } = await import('../../src/spaced-repetition.js');
    const { todayKey } = await import('../../src/utils.js');
    fc.assert(fc.property(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
      fc.integer({ min: 1, max: 99 }),
      (answers, cardNum) => {
        store.clear(); // 케이스 간 스케줄 상태 격리 — 카드 이력이 다음 케이스로 새지 않게
        const cardId = `pbt_card_${cardNum}`;
        let prevRep = 0;
        const today = todayKey(); // 로컬 날짜 — updateCardSchedule과 같은 키(UTC는 KST 00~09시에 어긋남)
        for (const knew of answers) {
          const s = updateCardSchedule(cardId, knew);
          assert.ok(s.repetition >= 0, 'repetition 음수');
          assert.ok(s.easiness >= 1.3, 'easiness 하한 위반');
          if (knew) {
            assert.equal(s.repetition, prevRep + 1, `정답인데 rep ${prevRep}→${s.repetition}`);
          } else {
            assert.equal(s.repetition, 0, '오답인데 rep 리셋 안 됨');
          }
          assert.ok(s.nextReview > today, `nextReview(${s.nextReview}) ≤ 오늘`);
          assert.equal(s.lastReview, today);
          prevRep = s.repetition;
        }
      }
    ), { numRuns: 150 });
  } finally {
    if (orig === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { value: orig, configurable: true });
  }
});
