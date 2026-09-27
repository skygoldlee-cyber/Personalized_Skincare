// tests/unit/story-textbook.test.js — 이야기형 교재 서사 구조 검증
// @spec ST-01,ST-02,ST-03,ST-04,ST-05,ST-06,ST-07
// 프롤로그·읽는 방법·여정도·기억 태그·에필로그·자료 전환 블록·
// 통합 에필로그가 4개 과목 이야기형 교재에 구조적으로 존재하는지 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEXTBOOK = join(ROOT, 'content', 'exams', 'cosmetic', '교재');

const SUBJECT_DIRS = ['law', 'manufacturing', 'safety', 'understanding'];
const storyFiles = {};
for (const dir of SUBJECT_DIRS) {
  const f = readdirSync(join(TEXTBOOK, dir)).find(x => x.includes('이야기형') && x.endsWith('.md'));
  storyFiles[dir] = { path: join(TEXTBOOK, dir, f), content: readFileSync(join(TEXTBOOK, dir, f), 'utf-8') };
}

// ---------- ST-01: 프롤로그 ----------

test('ST-01: 각 과목 이야기형 교재에 주인공 프롤로그가 있다', () => {
  for (const dir of SUBJECT_DIRS) {
    const { content } = storyFiles[dir];
    assert.ok(/##\s*프롤로그/.test(content), `${dir}: 프롤로그 섹션 없음`);
    assert.ok(/실수|좌절|실패|모르|몰랐/.test(content), `${dir}: 주인공의 실수/시련 서사 없음`);
  }
});

test('ST-01: 등장인물 소개 블록이 있다', () => {
  for (const dir of SUBJECT_DIRS) {
    assert.ok(/등장인물/.test(storyFiles[dir].content), `${dir}: 등장인물 섹션 없음`);
  }
});

// ---------- ST-02: 읽는 방법 4단계 ----------

test('ST-02: 읽는 방법 4단계 가이드가 있다', () => {
  for (const dir of SUBJECT_DIRS) {
    const { content } = storyFiles[dir];
    assert.ok(/읽는 방법/.test(content), `${dir}: 읽는 방법 없음`);
    const guide = content.match(/읽는 방법[\s\S]{0,800}/);
    assert.ok(guide, `${dir}: 가이드 블록 없음`);
    const steps = guide[0].match(/>\s*\d+\./g) || guide[0].match(/\d+\.\s/g) || [];
    assert.ok(steps.length >= 4, `${dir}: 4단계 미만 (${steps.length})`);
  }
});

// ---------- ST-03: 여정도 ----------

test('ST-03: 여정도(흐름 시각화) 섹션이 있다', () => {
  for (const dir of SUBJECT_DIRS) {
    assert.ok(/여정도|여정/.test(storyFiles[dir].content), `${dir}: 여정도 없음`);
  }
});

// ---------- ST-04: 실수→교훈 (🔖 기억 태그) ----------

test('ST-04: 🔖 기억 태그가 복수로 존재한다', () => {
  for (const dir of SUBJECT_DIRS) {
    const tags = storyFiles[dir].content.match(/🔖\s*\*?\*?기억 태그/g) || [];
    assert.ok(tags.length >= 3, `${dir}: 기억 태그 ${tags.length}개`);
  }
});

// ---------- ST-05: 에필로그 + 다음 장 예고 ----------

test('ST-05: 각 장 끝에 💭 에필로그가 있다', () => {
  for (const dir of SUBJECT_DIRS) {
    const eps = storyFiles[dir].content.match(/💭\s*\*?\*?에필로그/g) || [];
    assert.ok(eps.length >= 2, `${dir}: 에필로그 ${eps.length}개`);
  }
});

test('ST-05: 장별 에필로그가 다음 장 흐름을 예고한다', () => {
  // 에필로그 본문에 다음 내용 전개 언급(예고)이 있는지 확인 — '다음'/'마지막은'/'이어' 계열
  for (const dir of SUBJECT_DIRS) {
    const { content } = storyFiles[dir];
    const epilogueBlocks = content.split(/(?=💭\s*\*?\*?에필로그)/).filter(b => b.startsWith('💭'));
    const withPreview = epilogueBlocks.filter(b => /다음|이어|마지막은|배운다|나아간다|다가온|앞으로/.test(b.slice(0, 600)));
    assert.ok(withPreview.length > 0, `${dir}: 다음 장 예고형 에필로그 없음`);
  }
});

// ---------- ST-06: "이야기에서 자료로" 전환 블록 ----------

test('ST-06: 별표/참조자료 인덱스 앞에 서사→자료 전환 안내가 있다', () => {
  for (const dir of SUBJECT_DIRS) {
    const { content } = storyFiles[dir];
    const idx = content.lastIndexOf('## 📚 참조 자료');
    assert.ok(idx > -1, `${dir}: 참조 자료 인덱스 없음`);
    const block = content.slice(idx, idx + 600);
    assert.ok(/학습 보조용|본문 학습 후|근거 자료|확인하세요/.test(block), `${dir}: 전환 안내 블록 없음`);
  }
});

// ---------- ST-07: 통합 에필로그 ----------

test('ST-07: 시리즈 설정 문서가 4막 주인공 통합 에필로그(조제대 재회)를 설계한다', () => {
  const doc = readdirSync(TEXTBOOK).find(f => f.includes('시리즈설정문서'));
  assert.ok(doc, '시리즈 설정 문서 없음');
  const content = readFileSync(join(TEXTBOOK, doc), 'utf-8');
  assert.ok(/4막/.test(content), '4막 구조 없음');
  assert.ok(/조제대/.test(content), '조제대 재회 장치 없음');
  assert.ok(/예린/.test(content), '통합 서사 인물(예린) 없음');
});

test('ST-07: 4과목 이야기형 교재가 마무리 에필로그로 닫힌다', () => {
  // 각 과목 최후 💭 에필로그가 기출문제/회상 섹션보다 앞서거나 병존 — 과목 서사의 마무리 존재
  for (const dir of SUBJECT_DIRS) {
    const { content } = storyFiles[dir];
    const lastEp = content.lastIndexOf('💭 **에필로그');
    assert.ok(lastEp > -1, `${dir}: 마무리 에필로그 없음`);
    assert.ok(/마치며|여정|끝|완성|시작/.test(content.slice(lastEp, lastEp + 800)), `${dir}: 마무리 서사 부족`);
  }
});
