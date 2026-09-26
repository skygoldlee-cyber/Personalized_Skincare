#!/usr/bin/env node
/**
 * check_manifest.js — manifest 선언 ↔ 실제 파일/자산 정합성 검증
 *
 * 교재 교체·과목 추가 시 빌드 전에 깨진 선언을 표면화한다:
 *   - manifest가 선언한 교재/문제은행 파일의 실제 존재
 *   - subjects[].key/order 유일성, exams[].subject → subjects 해석
 *   - 과목별 파생 자산 (glossary·number-drills·ref_md 폴더) 존재
 *   - 교재 파서 계약 (챕터 헤딩 · 기출/중요 마커)
 *
 * 사용: node tools/check_manifest.js   (npm run check:manifest / check:content 첫 단계)
 * 종료코드: ERROR 1건 이상이면 1
 */
const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./build/exam_targets.js');

const ROOT = path.resolve(__dirname, '..');

// 교재 챕터 경계 헤딩 — build_question_chapters.js와 동일 규칙
const CHAPTER_HEADING_RE = /^##\s+(?:📚\s*)?((?:Chapter\s+)?\d+\..+?)\s*$/m;
// 카드/퀴즈 생성 마커 — textbook.plugin.js와 동일 규칙
const MARKER_RE = /🔖기출|📌중요|🎯\s*기출|🎯\s*중요|★\s*필수/;

const errors = [];
const warns = [];

const err = (scope, msg) => errors.push(`[${scope}] ${msg}`);
const warn = (scope, msg) => warns.push(`[${scope}] ${msg}`);

function fileExists(root, ...segs) {
  return fs.existsSync(path.join(root, ...segs));
}

function checkSubject(target, subject) {
  const scope = `${target.id}:${subject.key || '?'}`;
  const sroot = path.join(ROOT, target.contentRoot);

  if (!subject.key) return err(target.id, 'subjects[] 항목에 key 없음');
  if (!Number.isFinite(subject.order)) err(scope, `order가 유효한 숫자가 아님: ${subject.order}`);
  if (!subject.dir) err(scope, 'dir 없음');
  else if (!fileExists(sroot, subject.dir)) {
    err(scope, `교재 디렉터리 없음: ${subject.dir}`);
    return; // 디렉터리 없으면 하위 검사 불가
  }

  // 선언된 교재 파일 존재 + 파서 계약
  for (const ch of subject.chapters || []) {
    for (const [kind, file] of [['표준형', ch.file], ['이야기형', ch.storyFile]]) {
      if (!file) continue;
      const rel = path.join(subject.dir, file);
      if (!fileExists(sroot, subject.dir, file)) {
        err(scope, `선언된 ${kind} 교재 파일 없음: ${rel}`);
        continue;
      }
      if (kind === '표준형') {
        const md = fs.readFileSync(path.join(sroot, rel), 'utf-8');
        if (!CHAPTER_HEADING_RE.test(md)) {
          err(scope, `챕터 헤딩("## N." 또는 "## 📚 Chapter N.") 없음 — 문항→챕터 매핑 불가: ${rel}`);
        }
        if (!MARKER_RE.test(md)) {
          warn(scope, `기출/중요 마커(🔖기출·📌중요 등) 0건 — 퀴즈가 생성되지 않을 수 있음: ${rel}`);
        }
      }
    }
  }
  if (!(subject.chapters || []).length) warn(scope, 'chapters[] 비어 있음');

  // 과목별 파생 자산 (order 번호 / key 기준 — 없으면 경고)
  const n = subject.order;
  if (Number.isFinite(n)) {
    if (!fileExists(sroot, '교재', 'glossary', `subject${n}.json`)) {
      warn(scope, `용어집 없음: 교재/glossary/subject${n}.json`);
    }
    if (!fileExists(sroot, '참조자료', 'ref_md', `과목${n}`)) {
      warn(scope, `ref_md 과목 폴더 없음: 참조자료/ref_md/과목${n}`);
    }
  }
  if (!fileExists(sroot, 'number-drills', `${subject.key}.json`)) {
    warn(scope, `숫자 연습 데이터 없음: number-drills/${subject.key}.json`);
  }
}

function checkExam(target, exam, subjectKeys) {
  const scope = `${target.id}:exam:${exam.key || '?'}`;
  if (!exam.key) return err(target.id, 'exams[] 항목에 key 없음');
  if (!exam.subject) err(scope, 'subject 없음');
  else if (!subjectKeys.has(exam.subject)) {
    err(scope, `exams[].subject "${exam.subject}"이 subjects에 없음`);
  }
  if (!exam.file) err(scope, 'file 없음');
  else if (!fileExists(path.join(ROOT, target.contentRoot), '문제은행', exam.file)) {
    err(scope, `선언된 문제은행 파일 없음: 문제은행/${exam.file}`);
  }
}

function checkTarget(target) {
  const scope = target.id;
  if (!target.manifest) {
    err(scope, `manifest 없음: ${target.manifestPath}`);
    return;
  }
  const m = target.manifest;
  const subjects = m.subjects || [];
  const exams = m.exams || [];

  // key/order 유일성
  const seenKey = new Set(), seenOrder = new Set();
  for (const s of subjects) {
    if (seenKey.has(s.key)) err(scope, `subjects[].key 중복: ${s.key}`);
    seenKey.add(s.key);
    if (seenOrder.has(s.order)) err(scope, `subjects[].order 중복: ${s.order}`);
    seenOrder.add(s.order);
  }
  const seenExamKey = new Set();
  for (const e of exams) {
    if (seenExamKey.has(e.key)) err(scope, `exams[].key 중복: ${e.key}`);
    seenExamKey.add(e.key);
  }

  const subjectKeys = new Set(subjects.map(s => s.key));
  for (const s of subjects) checkSubject(target, s);
  for (const e of exams) checkExam(target, e, subjectKeys);

  // 통합 모의고사 출제 비중 키 정합
  const qps = (m.integratedExam || {}).questionsPerSubject || {};
  for (const k of Object.keys(qps)) {
    if (!subjectKeys.has(k)) err(scope, `integratedExam.questionsPerSubject의 "${k}"이 subjects에 없음`);
  }
}

function main() {
  const targets = getExamTargets(ROOT);
  for (const t of targets) checkTarget(t);

  console.log(`manifest 정합성 검사 — 시험 ${targets.length}개\n`);
  for (const w of warns) console.log(`  ⚠ ${w}`);
  for (const e of errors) console.log(`  ❌ ${e}`);
  console.log(`\n결과: 오류 ${errors.length}건 · 경고 ${warns.length}건`);
  if (errors.length) {
    console.log('❌ 선언↔파일 불일치 — 위 항목을 수정하세요.');
    process.exit(1);
  }
  console.log(warns.length ? '✅ 정합 (경고는 선택적 자산 부재)' : '✅ 모든 선언이 파일과 일치합니다.');
}

main();
