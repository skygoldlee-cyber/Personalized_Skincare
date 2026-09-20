/**
 * 복수정답형(combo) 번들 검증 — 스키마 검증 + 정답 유일성 + perStatement 채점 경로 확인
 * 대상: data/drills/combo_pilot.js (수작업) + data/drills/combo_subject*.js (자동 생성)
 * 실행: node tools/check_combo_pilot.js
 */
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, '..');
const { validateQuestion, deriveComboAnswer, gradeAnswer } = await import(
  pathToFileURL(path.join(src, 'src', 'questions.js')).href
);

const DRILLS_DIR = path.join(src, 'data', 'drills');

function loadBundle(file, globalName) {
  return readFile(file, 'utf8').then(code => {
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window[globalName] ?? sandbox[globalName];
  });
}

/** 문항 1개 검증 — 오류 문자열 배열 반환 */
function checkQuestion(q) {
  const errs = validateQuestion(q);
  // 복수정답형 저작 규칙: 문제 서두에 출처·인용 명기 필수
  if (!q.citation || typeof q.citation !== 'string' || !q.citation.trim()) {
    errs.push('citation 필드 없음 — 복수정답형은 문제 서두에 출처·인용 명기 필수');
  }
  const answer = deriveComboAnswer(q);
  const optIds = new Set(q.options.map(o => o.id));
  if (!optIds.has(answer)) {
    errs.push(`도출 정답 '${answer}'가 options에 없음`);
  }
  // 정답 외 옵션이 같은 truth 집합인지(중복 정답) 확인
  const truthSet = q.statements.filter(s => s.truth).map(s => s.id).sort().join(',');
  for (const o of q.options) {
    const m = [...o.members].sort().join(',');
    if (m === truthSet && o.id !== answer) {
      errs.push(`옵션 ${o.id}도 정답 조합과 동일 — 중복 정답`);
    }
  }
  // 채점 경로 스모크: 정답 선택 시 perStatement 전원 judgedCorrect
  const res = gradeAnswer(q, { optionId: answer });
  if (!res || !res.correct) errs.push(`정답 옵션 '${answer}' 채점 실패`);
  if (res && res.perStatement && res.perStatement.some(s => !s.judgedCorrect)) {
    errs.push('정답 선택인데 오판 진술 존재');
  }
  return errs;
}

let errors = 0;

// ── 수작업 파일럿 ─────────────────────────────────────────────
const bundle = await loadBundle(path.join(DRILLS_DIR, 'combo_pilot.js'), 'COMBO_PILOT');
if (!bundle || !Array.isArray(bundle.questions)) {
  console.error('COMBO_PILOT 번들을 읽지 못했습니다');
  process.exit(1);
}
for (const q of bundle.questions) {
  const errs = checkQuestion(q);
  if (errs.length) {
    errors += errs.length;
    console.error(`[${q.id}] ${errs.join(' / ')}`);
  }
}
console.log(`[combo-pilot] ${bundle.questions.length}문항 검증 — ${errors ? errors + '건 오류' : '오류 없음'}`);
for (const q of bundle.questions) {
  const truth = q.statements.filter(s => s.truth).map(s => s.id).join('');
  const nTrue = q.statements.filter(s => s.truth).length;
  console.log(`  ${q.id} ${q.subject} | 진술 ${q.statements.length}(참 ${nTrue}) | 정답 ${deriveComboAnswer(q)}번 [${truth}] | ${q.derivedFrom}`);
}

// ── 자동 생성 번들 (존재하면) ─────────────────────────────────
const files = (await readdir(DRILLS_DIR).catch(() => []))
  .filter(f => /^combo_subject\d+\.js$/.test(f));
for (const f of files) {
  const varName = `COMBO_DRILLS_${f.replace(/^combo_|\.js$/g, '')}`; // COMBO_DRILLS_subjectN
  const qs = await loadBundle(path.join(DRILLS_DIR, f), varName);
  if (!Array.isArray(qs)) {
    console.error(`[${f}] ${varName} 번들을 읽지 못했습니다`);
    errors++;
    continue;
  }
  let fErr = 0;
  const dist = {}; // 정답 위치 분포 (seed 편향 감지)
  for (const q of qs) {
    const errs = checkQuestion(q);
    if (errs.length) {
      fErr += errs.length;
      if (fErr <= 8) console.error(`  [${q.id}] ${errs.join(' / ')}`);
    }
    const idx = (q.options || []).findIndex(o => o.id === q.answer);
    if (idx >= 0) dist[idx] = (dist[idx] || 0) + 1;
  }
  // 정답 위치 분포 검증 — 특정 위치 과밀(>50%) 또는 공백 위치가 있으면 출제 편향으로 오류 처리
  if (qs.length >= 50) {
    const shares = [0, 1, 2, 3, 4].map(i => (dist[i] || 0) / qs.length);
    const distStr = shares.map(s => `${Math.round(s * 100)}%`).join('/');
    if (shares.some(s => s === 0) || shares.some(s => s > 0.5)) {
      fErr++;
      console.error(`  [${f}] 정답 위치 분포 편향: ${distStr} (공백 또는 50% 초과 위치 존재)`);
    } else {
      console.log(`  정답 분포 ①~⑤: ${distStr}`);
    }
  }
  errors += fErr;
  console.log(`[${f}] ${qs.length}문항 검증 — ${fErr ? fErr + '건 오류' : '오류 없음'}`);
}

process.exit(errors ? 1 : 0);
