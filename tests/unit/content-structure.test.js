// tests/unit/content-structure.test.js — 콘텐츠 소스 레이아웃 검증
// @spec CS-01,CS-02,CS-03,CS-04,CS-05,CS-06,CS-07,CS-08,CS-09,CS-10
// manifest 선언 ↔ 실제 파일 구조 정합성, ref_md 귀속 계층,
// ASCII 슬러그 산출물, 큐레이션/원료/오디오 경로를 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT = join(ROOT, 'content', 'exams', 'cosmetic');
const manifest = JSON.parse(readFileSync(join(CONTENT, 'manifest.json'), 'utf-8'));
const references = JSON.parse(readFileSync(join(CONTENT, 'references.json'), 'utf-8'));

const isMd = f => f.toLowerCase().endsWith('.md');
const list = p => (existsSync(p) ? readdirSync(p) : []);

// ---------- CS-01: 교재 MD 구조 ----------

test('CS-01: manifest의 각 과목 디렉터리와 chapter 파일이 교재 폴더에 존재한다', () => {
  for (const subj of manifest.subjects) {
    const dir = join(CONTENT, subj.dir);
    assert.ok(existsSync(dir), `과목 디렉터리 없음: ${subj.dir}`);
    for (const ch of subj.chapters) {
      assert.ok(existsSync(join(dir, ch.file)), `교재 파일 없음: ${subj.dir}/${ch.file}`);
    }
  }
});

test('CS-01: 표준형과 이야기형 본문이 과목별로 공존한다', () => {
  for (const subj of manifest.subjects) {
    const files = list(join(CONTENT, subj.dir)).filter(isMd);
    const std = files.filter(f => f.includes('표준형'));
    const story = files.filter(f => f.includes('이야기형'));
    assert.ok(std.length > 0, `${subj.dir}: 표준형 없음`);
    assert.ok(story.length > 0, `${subj.dir}: 이야기형 없음`);
  }
});

// ---------- CS-02: 문제은행 ----------

test('CS-02: manifest의 exams 파일이 문제은행 폴더에 존재한다', () => {
  const bank = join(CONTENT, '문제은행');
  assert.ok(existsSync(bank));
  for (const ex of manifest.exams) {
    assert.ok(existsSync(join(bank, ex.file)), `문제은행 파일 없음: ${ex.file}`);
  }
});

test('CS-02: 과목별 단일정답형·복수정답형 파일이 4과목 모두 존재한다', () => {
  const bank = list(join(CONTENT, '문제은행'));
  for (const n of [1, 2, 3, 4]) {
    assert.ok(bank.includes(`과목${n}_단일정답형.md`), `과목${n}_단일정답형.md 없음`);
    assert.ok(bank.includes(`과목${n}_복수정답형.md`), `과목${n}_복수정답형.md 없음`);
  }
});

// ---------- CS-03: 참조자료 ref_md ----------

test('CS-03: ref_md가 과목N 폴더 계층으로 구성되고 문서별 {문서}/{문서}.md 형식을 따른다', () => {
  const refRoot = join(CONTENT, '참조자료', 'ref_md');
  const subjectDirs = list(refRoot).filter(d => /^과목\d$/.test(d));
  assert.ok(subjectDirs.length >= 4, 'ref_md/과목1~4 계층이 있어야 함');
  let docCount = 0;
  for (const sd of subjectDirs) {
    for (const doc of list(join(refRoot, sd))) {
      const mdPath = join(refRoot, sd, doc, `${doc}.md`);
      if (statSync(join(refRoot, sd, doc)).isDirectory()) {
        assert.ok(existsSync(mdPath), `ref_md/${sd}/${doc}/${doc}.md 없음`);
        docCount++;
      }
    }
  }
  assert.ok(docCount >= 30, `MD 변환본이 충분해야 함 (현재 ${docCount}종)`);
});

// ---------- CS-04: 성분 원본 ----------

test('CS-04: 원료 DB 원본 4종과 버전 메타가 존재한다', () => {
  const dir = join(CONTENT, '참조자료', '원료');
  for (const f of ['approved_ingredients.md', 'restricted_ingredients.md', 'banned_ingredients.md', 'colorants_ingredients.md']) {
    assert.ok(existsSync(join(dir, f)), `원료 원본 없음: ${f}`);
  }
  const meta = JSON.parse(readFileSync(join(dir, 'db_version.json'), 'utf-8'));
  assert.ok(meta.version, 'db_version.json에 version 필드가 있어야 함');
});

// ---------- CS-05: 학습안내서 ----------

test('CS-05: 학습안내서 MD가 docs 폴더에 존재한다', () => {
  assert.ok(existsSync(join(CONTENT, 'docs', '학습안내서.md')));
});

// ---------- CS-06: 용어집 큐레이션 ----------

test('CS-06: glossary 큐레이션 JSON이 subject1~4에 존재하고 엔트리 구조를 갖는다', () => {
  for (const n of [1, 2, 3, 4]) {
    const p = join(CONTENT, '교재', 'glossary', `subject${n}.json`);
    assert.ok(existsSync(p), `subject${n}.json 없음`);
    const doc = JSON.parse(readFileSync(p, 'utf-8'));
    const entries = Array.isArray(doc) ? doc : Object.values(doc);
    assert.ok(entries.length > 0, `subject${n}.json이 비어 있음`);
    const e = entries[0];
    assert.ok(e.keyword && (e.explanation !== undefined || e.definition !== undefined), '큐레이션 엔트리는 keyword/explanation(또는 definition)을 가져야 함');
  }
});

// ---------- CS-07: 오디오북 ----------

test('CS-07: 오디오북 산출물(mp3)이 과목 디렉터리별로 존재한다', () => {
  const dir = join(CONTENT, 'audiobook', 'mp3');
  assert.ok(existsSync(dir));
  const subjectDirs = list(dir).filter(d => statSync(join(dir, d)).isDirectory());
  assert.ok(subjectDirs.length >= 4, '과목별 mp3 디렉터리가 있어야 함');
  let mp3Count = 0;
  const walk = d => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.mp3')) mp3Count++;
    }
  };
  walk(dir);
  assert.ok(mp3Count > 0, '오디오북 MP3가 없음');
});

// ---------- CS-08: ASCII 슬러그 산출물 ----------

test('CS-08: study_md 번들 파일명이 ASCII 슬러그(과목 dir 키)를 사용한다', () => {
  const bundleDir = join(ROOT, 'data', 'exams', 'cosmetic', 'study_md');
  const files = list(bundleDir).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 4);
  for (const f of files) {
    assert.ok(/^[\x20-\x7E]+$/.test(f), `비ASCII 번들 파일명: ${f}`);
  }
  // 과목 dir 키(law/manufacturing/safety/understanding)가 슬러그로 사용됨
  for (const subj of manifest.subjects) {
    const slug = subj.dir.split('/').pop();
    assert.ok(files.includes(`${slug}.js`), `슬러그 번들 없음: ${slug}.js`);
  }
});

// ---------- CS-09: 귀속 = 폴더가 진실 ----------

test('CS-09: ref_md 문서가 정확히 하나의 과목 폴더에만 귀속된다', () => {
  const refRoot = join(CONTENT, '참조자료', 'ref_md');
  const seen = new Map();
  for (const sd of list(refRoot).filter(d => /^과목\d$/.test(d))) {
    for (const doc of list(join(refRoot, sd))) {
      assert.ok(!seen.has(doc), `문서 '${doc}'가 ${seen.get(doc)}와 ${sd}에 중복 귀속`);
      seen.set(doc, sd);
    }
  }
});

test('CS-09: references.json의 subjectDirMap이 실제 교재 dir과 일치한다', () => {
  const map = references.subjectDirMap || {};
  for (const subj of manifest.subjects) {
    const slug = subj.dir.split('/').pop();
    assert.ok(map[slug], `subjectDirMap에 '${slug}' 키 없음`);
    assert.match(map[slug], /^과목\d$/);
  }
});

// ---------- CS-10: 문서 이미지 상대 참조 ----------

test('CS-10: ref_md 문서의 이미지 참조가 images/ 상대 경로이고 파일이 존재한다', () => {
  const refRoot = join(CONTENT, '참조자료', 'ref_md');
  let imgRefs = 0;
  for (const sd of list(refRoot).filter(d => /^과목\d$/.test(d))) {
    for (const doc of list(join(refRoot, sd))) {
      const mdPath = join(refRoot, sd, doc, `${doc}.md`);
      if (!existsSync(mdPath)) continue;
      const md = readFileSync(mdPath, 'utf-8');
      for (const m of md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
        const src = m[1].trim();
        imgRefs++;
        assert.ok(!/^https?:/i.test(src), `외부 이미지 URL: ${src} (${doc})`);
        assert.ok(src.startsWith('images/'), `비상대경로 이미지: ${src} (${doc})`);
        assert.ok(existsSync(join(refRoot, sd, doc, src)), `이미지 파일 없음: ${doc}/${src}`);
      }
    }
  }
  assert.ok(imgRefs > 0, '검증 대상 이미지 참조가 없음');
});
