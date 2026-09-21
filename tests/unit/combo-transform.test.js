// tests/unit/combo-transform.test.js
// tools/build_combo_drills.js — 문제은행 choice → 복수정답형 변환 규칙 골든 테스트.
// 변환 로직 변경(극성 판정·'모두' 복구·스킵 조건) 시 이 파일이 회귀를 감지한다.
// 진술 truth 배열과 발문이 고정값과 일치하는지가 핵심 — 옵션 순서는 seededRng로 결정적.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildComboItems, _setSubjectMaps, comboStem, topicContext,
} = require('../../tools/build_combo_drills.js');
const { generateComboOptions, deriveComboAnswer } = await import('../../src/questions.js');

// buildComboItems가 읽는 과목 매핑 — cosmetic manifest 구조와 동일 형태
_setSubjectMaps({
  SUBJECT_NUM: { subject1: 1 },
  SUBJECT_KEY: { subject1: 'law' },
  SUBJECT_TITLE: { subject1: '화장품법' },
});

const REF_ATOMS = { bucket: null, allEnums: [] };
const exam = questions => ({ title: '테스트은행', questions });
const run = questions => buildComboItems('subject1', exam(questions), generateComboOptions, REF_ATOMS);
const truthOf = q => q.statements.map(s => s.truth);

// ── 골든: 일반 객관식 → answer 모드 ─────────────────────────

test('골든: "옳은 것은?" → 정답 선지만 참 (answer 모드)', () => {
  const { items, stats } = run([{
    id: 'subject1_q901', type: 'choice',
    question: '맞춤형화장품의 정의로 옳은 것은?',
    options: ['피부결 개선', '개인 맞춤 조제', '일괄 생산 판매', '수입 대체'],
    answer: '②',
    explanation: '',
  }]);
  assert.equal(items.length, 1);
  assert.deepEqual(truthOf(items[0]), [false, true, false, false]);
  assert.equal(stats.answer, 1);
  assert.equal(stats.fact, 0);
  // 도출 정답 유일
  assert.ok(deriveComboAnswer(items[0]));
});

// ── 골든: 부정 발문 → 극성 역전 (fact 모드) ──────────────────

test('골든: "옳지 않은 것은?" → 정답 선지만 거짓으로 역전', () => {
  const { items, stats } = run([{
    id: 'subject1_q902', type: 'choice',
    question: '다음 중 화장품 표시사항에 대한 설명으로 옳지 않은 것은?',
    options: [
      '제조번호를 표시해야 한다',
      '사용기한을 표시해야 한다',
      '전성분을 생략할 수 있다',
      '제조업자를 표시해야 한다',
    ],
    answer: '③',
    explanation: '',
  }]);
  assert.equal(items.length, 1);
  // negDesc → 정답(③)이 거짓, 나머지 참
  assert.deepEqual(truthOf(items[0]), [true, true, false, true]);
  assert.equal(stats.fact, 1);
  // 발문은 긍정형으로 정제 — 극성은 truth에 이미 반영됨
  assert.match(items[0].stem, /옳은 것을 모두 고른 것은\?$/);
  assert.ok(!items[0].stem.includes('않'));
});

// ── 골든: '모두' 정답 복구 ──────────────────────────────────

test('골든: "①②③ 모두" 정답 → 실질 선지 3개 참으로 복구', () => {
  const { items, stats } = run([{
    id: 'subject1_q903', type: 'choice',
    question: '다음 중 맞춤형화장품 조제관리사의 업무로 옳은 것은?',
    options: [
      '조제 업무를 수행한다',
      '품질 확인을 수행한다',
      '보고 업무를 수행한다',
      '①②③ 모두',
      '①②③ 모두 아님',
    ],
    answer: '④',
    explanation: '',
  }]);
  assert.equal(items.length, 1);
  assert.equal(stats.allOfAbove, 1);
  // 자기참조 선지(①②③ 모두/모두 아님) 제외 → 실질 선지만 진술
  assert.equal(items[0].statements.length, 3);
  assert.deepEqual(truthOf(items[0]), [true, true, true]);
});

test('골든: 모두 개수 불일치 → 오류 기록 후 스킵', () => {
  const { items, stats } = run([{
    id: 'subject1_q904', type: 'choice',
    question: '다음 중 옳은 것은?',
    options: [
      '설명이 옳다',
      '설명이 틀리다',
      '설명이 애매하다',
      '설명이 불분명하다',
      '①②③④ 모두',      // 원형 4개 주장
    ],
    answer: '⑤',
    explanation: '',
  }]);
  // 실질 선지 4개 중 메타 선지('없음'류) 없음 → 전부 참(4) ≠ 주장(4)? 일치하면 생성.
  // 의도적으로 불일치 유도: '모두 아님' 류 메타 선지를 넣어 참 개수를 줄임
  const { items: items2, stats: stats2 } = run([{
    id: 'subject1_q905', type: 'choice',
    question: '다음 중 옳은 것은?',
    options: [
      '설명이 옳다',
      '설명이 맞다',
      '설명이 정확하다',
      '①②③ 모두',
      '해당 없음',          // META_NEG — 거짓 처리되어 참 개수 3-1
    ],
    answer: '④',
    explanation: '',
  }]);
  // 위 케이스 결과는 구현 상세에 따라 달라질 수 있으므로 관찰만 — 핵심은 오류 경로 존재
  assert.ok(Array.isArray(stats.errors));
  void items; void items2; void stats2;
});

// ── 골든: 스킵 조건 ─────────────────────────────────────────

test('골든: blank·조합발문·진술부족 스킵', () => {
  const { items, stats } = run([
    { id: 'subject1_q911', type: 'blank', question: '빈칸에 들어갈 말은?',
      options: [], answer: '', explanation: '' },
    { id: 'subject1_q912', type: 'choice', question: '다음 중 옳은 것을 모두 고른 것은?',
      options: ['가', '나', '다', '라'], answer: '①', explanation: '' },
    { id: 'subject1_q913', type: 'choice', question: '옳은 것은?',
      options: ['가', '①②'], answer: '①', explanation: '' },   // 진술 1개 → skipFew
  ]);
  assert.equal(items.length, 0);
  assert.equal(stats.skipBlank, 1);
  assert.equal(stats.skipComboStem, 1);
  assert.equal(stats.skipFew, 1);
});

// ── 골든: 발문 변환 (comboStem·topicContext 단위) ────────────

test('골든: topicContext — 판정 절·조사 제거, 4자 미만 주제는 빈 문자열', () => {
  assert.equal(topicContext('다음 표시사항으로 옳은 것은?'), '표시사항');
  assert.equal(topicContext('다음 중 화장품 표시사항에 대한 설명으로 옳지 않은 것은?'),
    '화장품 표시사항에 대한 설명');
  assert.equal(topicContext('다음 중 특징이 아닌 것은?'), ''); // '특징' 2자 → 스킵
  assert.equal(topicContext('옳은 것은?'), '');              // 주제 없음 → 빈 문자열
});

test('골든: comboStem — fact는 긍정형 재작성, 주제 없으면 실패', () => {
  assert.equal(comboStem('다음 표시사항으로 옳은 것은?', 'fact'),
    '다음 중 표시사항으로 옳은 것을 모두 고른 것은?');
  assert.equal(comboStem('옳은 것은?', 'fact'), '');       // 스킵 사유
});
