// tests/unit/questions.test.js
// src/questions.js — 문항 스키마·채점 유틸 검증
// (single/combo/short/ox 유형, truth 도출, 진술 단위 오판 피드백)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeText,
  deriveComboAnswer,
  generateComboOptions,
  validateQuestion,
  gradeAnswer,
  scoreExam,
  SAMPLE_QUESTIONS,
} from '../../src/questions.js';

const combo = {
  id: 'q-t-1', subject: 4, type: 'combo', points: 10,
  stem: '옳은 것을 모두 고른 것은?',
  statements: [
    { id: 'ㄱ', sid: 'st-1', truth: true },
    { id: 'ㄴ', sid: 'st-2', truth: false },
    { id: 'ㄷ', sid: 'st-3', truth: true },
    { id: 'ㄹ', sid: 'st-4', truth: false },
  ],
  options: [
    { id: '1', members: ['ㄱ', 'ㄴ'] },
    { id: '2', members: ['ㄱ', 'ㄷ'] },   // 도출 정답
    { id: '3', members: ['ㄴ', 'ㄷ', 'ㄹ'] },
    { id: '4', members: ['ㄱ', 'ㄷ', 'ㄹ'] },
    { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] },
  ],
  answer: '2',
};

// ── validateQuestion ────────────────────────────────────────

test('validateQuestion: 샘플 전 문항 무결성', () => {
  for (const q of SAMPLE_QUESTIONS) {
    assert.deepEqual(validateQuestion(q), [], `${q.id}: ${validateQuestion(q)}`);
  }
});

test('validateQuestion: combo 정답 조합 불일치 검출', () => {
  const bad = { ...combo, answer: '5' }; // 도출값은 '2'
  assert.ok(validateQuestion(bad).some(e => e.includes('도출값')));
});

test('validateQuestion: combo 정답 옵션 부재 검출', () => {
  const bad = {
    ...combo,
    options: combo.options.filter(o => o.id !== '2'),
  };
  assert.ok(validateQuestion(bad).some(e => e.includes('유일하지 않음')));
});

test('validateQuestion: ox 필수 필드 검사', () => {
  assert.ok(validateQuestion({ id: 'x', subject: 1, type: 'ox', points: 1 }).length > 0);
  assert.deepEqual(validateQuestion({
    id: 'x', subject: 1, type: 'ox', points: 1, statement: 's', truth: true,
  }), []);
});

// ── deriveComboAnswer / generateComboOptions ────────────────

test('deriveComboAnswer: truth 집합과 일치하는 유일 옵션 도출', () => {
  assert.equal(deriveComboAnswer(combo), '2');
});

test('generateComboOptions: 정답 유일 조합 포함 5지선다 생성', () => {
  const opts = generateComboOptions(['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'], ['ㄱ', 'ㄷ']);
  assert.equal(opts.length, 5);
  const derived = deriveComboAnswer({ statements: combo.statements, options: opts });
  assert.ok(derived, '생성된 옵션에서 정답 도출 실패');
  const hit = opts.find(o => o.id === derived);
  assert.deepEqual(hit.members.slice().sort(), ['ㄱ', 'ㄷ']);
});

// ── gradeAnswer: combo perStatement ─────────────────────────

test('combo 채점: 정답 선택 시 correct + 전 진술 judgedCorrect', () => {
  const r = gradeAnswer(combo, '2');
  assert.equal(r.correct, true);
  assert.equal(r.correctAnswer, '2');
  assert.ok(r.perStatement.every(s => s.judgedCorrect === true));
});

test('combo 채점: 선택 옵션 members로 진술별 오판 자동 유도', () => {
  // '1'번 = [ㄱ,ㄴ] 선택 → ㄴ을 참으로 오판, ㄷ을 거짓으로 오판
  const r = gradeAnswer(combo, '1');
  assert.equal(r.correct, false);
  const byId = Object.fromEntries(r.perStatement.map(s => [s.id, s]));
  assert.equal(byId['ㄱ'].judgedCorrect, true);
  assert.equal(byId['ㄴ'].judgedCorrect, false); // O로 착각
  assert.equal(byId['ㄷ'].judgedCorrect, false); // 참인데 미포함
  assert.equal(byId['ㄹ'].judgedCorrect, true);
  assert.equal(byId['ㄴ'].userJudged, true);
  assert.equal(byId['ㄷ'].userJudged, false);
});

test('combo 채점: 2단계 모드 judgments가 members 유도보다 우선', () => {
  const r = gradeAnswer(combo, {
    optionId: '2',
    judgments: { 'ㄱ': true, 'ㄴ': true, 'ㄷ': true, 'ㄹ': false },
  });
  assert.equal(r.correct, true);
  const n = r.perStatement.find(s => s.id === 'ㄴ');
  assert.equal(n.userJudged, true);
  assert.equal(n.judgedCorrect, false);
});

test('combo 채점: 미응답 시 userJudged/judgedCorrect는 null', () => {
  const r = gradeAnswer(combo, undefined);
  assert.equal(r.correct, false);
  assert.ok(r.perStatement.every(s => s.userJudged === null && s.judgedCorrect === null));
});

// ── gradeAnswer: ox / short / single ────────────────────────

test('ox 채점: O/X 문자열·boolean 응답 모두 지원', () => {
  const q = { id: 'x', subject: 1, type: 'ox', points: 2, statement: 's', truth: false };
  assert.equal(gradeAnswer(q, 'X').correct, true);
  assert.equal(gradeAnswer(q, 'O').correct, false);
  assert.equal(gradeAnswer(q, false).correct, true);
  assert.equal(gradeAnswer(q, 'x').correct, true); // 소문자 허용
  assert.equal(gradeAnswer(q, 'X').correctAnswer, 'X');
});

test('short 채점: normalizeText로 표기 흔들림 흡수', () => {
  const q = { id: 'x', subject: 4, type: 'short', points: 10, accept: ['아미노산', 'amino acid'] };
  assert.equal(gradeAnswer(q, ' Amino Acid ').correct, true);
  assert.equal(gradeAnswer(q, '아미노산').correct, true);
  assert.equal(gradeAnswer(q, '지질').correct, false);
});

test('single 채점: correct 옵션 id 비교', () => {
  const q = SAMPLE_QUESTIONS.find(x => x.type === 'single');
  assert.equal(gradeAnswer(q, q.answer).correct, true);
  assert.equal(gradeAnswer(q, '1').correct, q.answer === '1');
});

// ── scoreExam ───────────────────────────────────────────────

test('scoreExam: 과목별 집계 + 총점 60%/과목 40% 판정', () => {
  const qs = [
    { id: 'a', subject: 1, type: 'short', points: 100, accept: ['x'] },
    { id: 'b', subject: 2, type: 'short', points: 250, accept: ['x'] },
    { id: 'c', subject: 3, type: 'short', points: 250, accept: ['x'] },
    { id: 'd', subject: 4, type: 'short', points: 400, accept: ['x'] },
  ];
  const all = scoreExam(qs, { a: 'x', b: 'x', c: 'x', d: 'x' });
  assert.equal(all.passed, true);
  assert.equal(all.totalPct, 1);

  // 과목4 전부 오답 → 과목4 과락으로 불합격 (총점 60%는 넘어도)
  const failSubj = scoreExam(qs, { a: 'x', b: 'x', c: 'x', d: '오답' });
  assert.equal(failSubj.bySubject[4].pass, false);
  assert.equal(failSubj.subjectPass, false);
  assert.equal(failSubj.passed, false);
  assert.ok(failSubj.totalPct >= 0.6, '총점은 60% 이상인데 과락으로 불합격이어야 함');
});
