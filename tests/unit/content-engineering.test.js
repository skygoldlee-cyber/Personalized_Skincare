// tests/unit/content-engineering.test.js — 교재 콘텐츠 공학 요구사항
// @spec CE-01,CE-02,CE-03,CE-04,CE-05,TR-16a
// 표준형 교재 4과목이 학습 가이드·한 줄 요약·비교표·확인문제·용어 정리
// 구조를 갖추는지 검증하고, 모바일 툴바 자동 숨김 구현을 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEXTBOOK_DIR = join(ROOT, 'content', 'exams', 'cosmetic', '교재');

const standardFiles = [];
for (const dir of readdirSync(TEXTBOOK_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  for (const f of readdirSync(join(TEXTBOOK_DIR, dir.name))) {
    if (f.endsWith('_표준형.md')) {
      standardFiles.push({ file: `${dir.name}/${f}`, text: readFileSync(join(TEXTBOOK_DIR, dir.name, f), 'utf-8') });
    }
  }
}
assert.equal(standardFiles.length, 4, '표준형 교재 4과목');

// ---------- CE-01: 학습 가이드 (출제 빈도 ★ + 소요 시간 + 핵심 키워드) ----------

test('CE-01: 챕터 시작에 학습 가이드(출제 빈도★·소요 시간·핵심 키워드)가 있다', () => {
  for (const { file, text } of standardFiles) {
    const guides = text.match(/학습 가이드/g) || [];
    assert.ok(guides.length >= 1, `${file}: 학습 가이드 없음`);
    assert.ok(/출제 빈도[:：]?\s*★/.test(text), `${file}: 출제 빈도(★) 없음`);
    assert.ok(/예상 소요 시간/.test(text), `${file}: 예상 소요 시간 없음`);
    assert.ok(/핵심 키워드/.test(text), `${file}: 핵심 키워드 없음`);
  }
});

// ---------- CE-02: 한 줄 요약 blockquote ----------

test('CE-02: 섹션 하단에 "> **한 줄 요약**" blockquote가 있다', () => {
  for (const { file, text } of standardFiles) {
    const summaries = text.match(/>\s*\*\*한 줄 요약\*\*/g) || [];
    assert.ok(summaries.length >= 5, `${file}: 한 줄 요약 ${summaries.length}개 (<5)`);
    // blockquote 형식 — 섹션 본문과 분리된 인용 블록
    for (const m of text.matchAll(/>\s*\*\*한 줄 요약\*\*/g)) {
      const line = text.slice(m.index, text.indexOf('\n', m.index));
      assert.ok(line.length > 30, `${file}: 빈 한 줄 요약`);
    }
  }
});

// ---------- CE-03: 비교표 ----------

test('CE-03: 개념·수치·기준 비교 마크다운 표가 있다', () => {
  for (const { file, text } of standardFiles) {
    // 표 구분행(|---|---|)이 있는 진짜 마크다운 표
    const tables = text.match(/^\|[^\n]*\|\s*\n\|[-:| ]+\|/gm) || [];
    assert.ok(tables.length >= 1, `${file}: 비교표 없음`);
  }
});

// ---------- CE-04: 확인문제 (4지선다 또는 빈칸 + 정답/해설) ----------

test('CE-04: 챕터 말미에 확인문제가 있다', () => {
  for (const { file, text } of standardFiles) {
    const problems = text.match(/확인문제/g) || [];
    assert.ok(problems.length >= 3, `${file}: 확인문제 ${problems.length}개 (<3)`);
    // 객관식 번호(①②③④) 또는 빈칸형(____) 중 하나 이상 존재
    assert.ok(/①|②|③|④|____/.test(text), `${file}: 문항 형식(①~④/빈칸) 없음`);
  }
});

// ---------- CE-05: 용어 정리 표 (챕터 말미) ----------

test('CE-05: 챕터별 용어 정리 섹션 + 용어|정의 표가 있다', () => {
  for (const { file, text } of standardFiles) {
    // 제목 표기는 과목마다 다름 — "용어 정리"·"관련 용어"·"「법」 용어" 등
    assert.ok(/#{2,5}[^\n]*용어/.test(text), `${file}: 용어 섹션 제목 없음`);
    assert.ok(/\|\s*용어\s*\|\s*(정의|설명|핵심 포인트)\s*\|/.test(text), `${file}: 용어 정리 표 없음`);
  }
});

// ---------- TR-16a: 모바일 툴바 자동 숨김 ----------

test('TR-16a: 아래 스크롤 시 크롬 숨김·위 스크롤 시 복귀가 구현된다', () => {
  const reader = readFileSync(join(ROOT, 'src', 'views', 'textbook-reader.js'), 'utf-8')
    + readFileSync(join(ROOT, 'src', 'views', 'reader-toolbar.js'), 'utf-8');
  assert.ok(reader.includes('reader-toolbar'), '툴바 요소 참조');
  // TR-22/23: 툴바 개별이 아니라 크롬 전체(컨트롤+툴바+오디오) 오버레이 숨김
  assert.ok(reader.includes('reader-chrome-hidden'), '크롬 자동 숨김 클래스');
  // 아래로(>6px·140px 임계) 숨김, 위로(<-6px) 또는 상단 복귀 시 표시
  assert.ok(/curY > lastScrollY \+ 6 && curY > 140/.test(reader), '하향 숨김 임계');
  assert.ok(/curY < lastScrollY - 6 \|\| curY <= 140/.test(reader), '상향 복귀 조건');
  const css = readdirSync(join(ROOT, 'css')).map(f => readFileSync(join(ROOT, 'css', f), 'utf-8')).join('\n');
  assert.ok(/\.reader-chrome-hidden/.test(css), 'reader-chrome-hidden CSS 규칙');
});
