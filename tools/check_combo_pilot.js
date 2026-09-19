/**
 * combo_pilot.js 검증 — 스키마 검증 + 정답 유일성 + perStatement 채점 경로 확인
 * 실행: node tools/check_combo_pilot.js
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, '..');
const { validateQuestion, deriveComboAnswer, gradeAnswer } = await import(
  pathToFileURL(path.join(src, 'src', 'questions.js')).href
);

const code = await readFile(path.join(src, 'data', 'drills', 'combo_pilot.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const bundle = sandbox.window.COMBO_PILOT;

if (!bundle || !Array.isArray(bundle.questions)) {
  console.error('COMBO_PILOT 번들을 읽지 못했습니다');
  process.exit(1);
}

let errors = 0;
for (const q of bundle.questions) {
  const errs = validateQuestion(q);
  // 합답형 저작 규칙: 문제 서두에 출처·인용 명기 필수
  if (!q.citation || typeof q.citation !== 'string' || !q.citation.trim()) {
    errs.push('citation 필드 없음 — 합답형은 문제 서두에 출처·인용 명기 필수');
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
process.exit(errors ? 1 : 0);
