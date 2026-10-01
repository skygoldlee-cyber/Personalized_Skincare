#!/usr/bin/env node
/**
 * check_manifest.js — manifest 선언 ↔ 실제 파일/자산 정합성 검증
 *
 * 교재 교체·과목 추가 시 빌드 전에 깨진 선언을 표면화한다:
 *   - manifest가 선언한 교재/문제은행 파일의 실제 존재
 *   - 역방향: 디스크에 있지만 manifest에 미등록된 교재/문제은행 .md (경고)
 *   - subjects[].key/order 유일성, exams[].subject → subjects 해석
 *   - 과목별 파생 자산 (glossary·number-drills·ref_md 폴더) 존재
 *   - 교재 파서 계약 (챕터 헤딩 · 기출/중요 마커)
 *
 * 사용: node tools/check/check_manifest.js   (npm run check:manifest / check:content 첫 단계)
 * 종료코드: ERROR 1건 이상이면 1
 */

// @spec BP-03
const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('../build/exam_targets.js');
const { RESERVED_REGISTRY_KEYS } = require('../build/plugins/knowledge.plugin.js');

const ROOT = path.resolve(__dirname, '..', '..');

// 교재 챕터 경계 헤딩 — build_question_chapters.js와 동일 규칙
const CHAPTER_HEADING_RE = /^##\s+(?:📚\s*)?((?:Chapter\s+)?\d+\..+?)\s*$/m;
// 카드/퀴즈 생성 마커 — textbook.plugin.js와 동일 규칙
const MARKER_RE = /🔖기출|📌중요|🎯\s*기출|🎯\s*중요|★\s*필수/;

const errors = [];
const warns = [];

const err = (scope, msg) => errors.push(`[${scope}] ${msg}`);
const warn = (scope, msg) => warns.push(`[${scope}] ${msg}`);

const LAWDB_PATH = path.join(ROOT, 'content', 'lawdb.json');
let _lawdb = undefined;
function loadLawDb() {
  if (_lawdb === undefined) {
    _lawdb = fs.existsSync(LAWDB_PATH) ? JSON.parse(fs.readFileSync(LAWDB_PATH, 'utf-8')) : null;
  }
  return _lawdb;
}

/**
 * 지식DB 아이템의 lawRef는 사전 "근거" 표시용 문자열이지만,
 * 표기가 이 시험이 참조하는 법령(lawRefs의 matchKeys)과 어긋나면
 * 존재하지 않는 근거를 가리키게 되므로 매칭 여부를 경고한다.
 */
function checkKnowledgeLawRefs(target, registryKey) {
  const scope = `${target.id}:knowledge`;
  const kPath = path.join(ROOT, target.contentRoot, 'knowledge', `${registryKey}.json`);
  const refsPath = path.join(ROOT, target.contentRoot, 'references.json');
  const lawdb = loadLawDb();
  if (!fs.existsSync(kPath) || !fs.existsSync(refsPath) || !lawdb) return;

  const refs = JSON.parse(fs.readFileSync(refsPath, 'utf-8'));
  const laws = lawdb.laws || [];
  const refIds = new Set(('lawRefs' in refs) ? (refs.lawRefs || []) : laws.map(l => l.id));
  const keys = [];
  for (const l of laws) {
    if (refIds.has(l.id)) for (const k of l.matchKeys || []) keys.push(k);
  }
  const norm = s => String(s).replace(/[\s()_]/g, '');
  const items = ((JSON.parse(fs.readFileSync(kPath, 'utf-8')) || {}).items) || [];
  const seen = new Set();
  for (const it of items) {
    if (!it || !it.lawRef || seen.has(it.lawRef)) continue;
    seen.add(it.lawRef);
    const n = norm(it.lawRef);
    if (!keys.some(k => n.includes(norm(k)))) {
      warn(scope, `지식DB lawRef "${it.lawRef}"가 이 시험 lawRefs 범위의 matchKeys와 매칭되지 않음 — 근거 표기 또는 lawRefs 확인 (${registryKey}.json)`);
    }
  }
}

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

  // 이야기형 패치 정합성 — storyFile ↔ story/<base>_서사.md
  const baseOf = f => (f || '').replace(/(_표준형)?\.md$/i, '');
  for (const ch of subject.chapters || []) {
    if (!ch.storyFile) continue;
    const patchRel = path.join(subject.dir, 'story', `${baseOf(ch.file)}_서사.md`);
    if (!fileExists(sroot, patchRel)) {
      warn(scope, `storyFile 선언됐지만 서사 패치 없음 — build:story가 건너뜀: ${patchRel}`);
    }
  }
  const storyDir = path.join(sroot, subject.dir, 'story');
  if (fs.existsSync(storyDir)) {
    const declaredPatches = new Set((subject.chapters || [])
      .filter(c => c.storyFile)
      .map(c => `${baseOf(c.file)}_서사.md`));
    for (const f of fs.readdirSync(storyDir)) {
      if (!f.endsWith('_서사.md')) continue;
      if (!declaredPatches.has(f)) {
        warn(scope, `서사 패치 있지만 storyFile 미선언 — 이야기형이 생성되지 않음: ${subject.dir}/story/${f}`);
      }
    }
  }

  // 사전 녹음 오디오북이 있으면 본문 정규화 후 음성↔표시 텍스트 불일치 가능 — 존재할 때만 경고
  const audioDir = path.join(sroot, 'audiobook', 'mp3');
  if ((subject.chapters || []).some(c => c.storyFile) && fs.existsSync(audioDir)
    && fs.readdirSync(audioDir).some(f => f.endsWith('.mp3') && f.includes(subject.key))) {
    warn(scope, `사전 녹음 오디오(mp3) 존재 — 이야기형 본문 변경 시 음성 재녹음 필요 여부 확인: audiobook/mp3/*${subject.key}*`);
  }

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

  // 지식DB registryKey가 registry 최상위 키와 충돌하면 메타가 registry를 덮어씀
  const kKey = (m.knowledge || {}).registryKey;
  if (kKey && RESERVED_REGISTRY_KEYS.includes(kKey)) {
    err(scope, `knowledge.registryKey "${kKey}"는 registry 예약 키(${RESERVED_REGISTRY_KEYS.join(', ')})와 충돌`);
  }
  if (kKey) checkKnowledgeLawRefs(target, kKey);

  // 역방향: 디스크에는 있지만 manifest에 선언되지 않은 .md (빌드에서 조용히 제외됨)
  // 자동 생성 파일(복수정답형 등)은 빌드 산출물이므로 제외
  const sroot = path.join(ROOT, target.contentRoot);
  const isAutogen = (abs) => {
    try { return /자동 생성/.test(fs.readFileSync(abs, 'utf-8').slice(0, 600)); }
    catch { return false; }
  };
  const declaredTextbooks = new Set();
  for (const s of subjects) {
    for (const ch of s.chapters || []) {
      if (ch.file) declaredTextbooks.add(path.join(s.dir || '', ch.file));
      if (ch.storyFile) declaredTextbooks.add(path.join(s.dir || '', ch.storyFile));
    }
  }
  for (const s of subjects) {
    if (!s.dir) continue;
    const dirAbs = path.join(sroot, s.dir);
    if (!fs.existsSync(dirAbs)) continue;
    for (const f of fs.readdirSync(dirAbs)) {
      if (!f.endsWith('.md')) continue;
      if (!declaredTextbooks.has(path.join(s.dir, f)) && !isAutogen(path.join(dirAbs, f))) {
        warn(scope, `manifest 미등록 교재 파일 — 빌드에서 제외됨: ${s.dir}/${f}`);
      }
    }
  }
  const declaredExams = new Set(exams.map(e => e.file).filter(Boolean));
  const bankDir = path.join(sroot, '문제은행');
  if (fs.existsSync(bankDir)) {
    for (const f of fs.readdirSync(bankDir)) {
      if (!f.endsWith('.md')) continue;
      if (!declaredExams.has(f) && !isAutogen(path.join(bankDir, f))) {
        warn(scope, `manifest 미등록 문제은행 파일 — 빌드에서 제외됨: 문제은행/${f}`);
      }
    }
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
