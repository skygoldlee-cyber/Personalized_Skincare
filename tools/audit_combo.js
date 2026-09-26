#!/usr/bin/env node
/**
 * audit_combo.js — 복수정답형 생성 번들 품질 감사
 *
 * 대상: data/exams/<id>/drills/combo_subjectN.js (+ combo_pilot.js 있으면 함께)
 *
 * 오류 (exit 1):
 *   - validateQuestion 스키마/정답 유일성 재검증 실패
 *   - 동일 진술집합(sid 멀티셋)을 가진 문항 중복 생성
 *   - 옵션 수 ≠ 5
 *   - 참 진술 0 (전부 오답 — 정답 조합 불성립)
 *
 * 경고 (리포트만):
 *   - 참 진술 == 전체 ('모두' 퇴화 — banFull로 옵션은 걸러도 진술 자체가 단조)
 *   - 동일 텍스트·상반 truth 진술 쌍 (모순 의심)
 *   - 진술 절단 의심 (조사·연결어미 종결) / 장문(>170자)
 *   - '모두'(전집합) 옵션이 banFull 대상 문항에 존재
 *   - 정답 위치 편향 (과목당 최다 위치 점유율 >30%)
 *
 * 참고 카운트 (경고 아님):
 *   - 동일 truth 근접중복 쌍 — 수치 혼동쌍·법령 열거 멤버의 접두사 공유는 정상
 *
 * 회귀 가드:
 *   - combo_baseline.json(루트, 커밋됨)의 과목별 문항 수와 비교 —
 *     10% 이상 감소 시 경고, 30% 이상 감소 시 오류 (소스·규칙 변경의 조용한 품질 붕괴 감지)
 *
 * 검수 큐:
 *   - 검수 필요 문항(cluster·ref:note 경로 + 경고 대상)을 combo_review_queue.md로 출력
 *   - 사람이 불량 판정한 id는 <contentRoot>/combo_blocklist.json에 등록 → 빌드에서 제외
 *
 * 통계 리포트: 과목별 문항 수·단일참 비율·derivedFrom 경로별 분포·정답 위치 히스토그램
 *
 * 런타임 이상 반영:
 *   --anomalies <backup.json> — 앱 백업 파일의 statement_stats에서
 *   오판율 극단(j≥5·w/j≥0.8) 진술을 추출해 포함 문항을 검수 큐에 추가.
 *   (앱 내 '이상 의심' 배지와 동일 기준 — 콘텐츠 오류 후보의 검수 반영 경로)
 *
 * 사용: node tools/audit_combo.js                    (오류 시 exit 1)
 *       node tools/audit_combo.js --strict           (경고도 exit 1)
 *       node tools/audit_combo.js --update-baseline  (회귀 기준선 갱신)
 *       node tools/audit_combo.js --anomalies backup.json
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const { getExamTargets } = require('./build/exam_targets.js');
const STRICT = process.argv.includes('--strict');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const ANOM_IDX = process.argv.indexOf('--anomalies');
const ANOM_FILE = ANOM_IDX > -1 ? process.argv[ANOM_IDX + 1] : null;
// 런타임 이상 임계 — 앱 getAnomalousStatements와 동일 기준
const ANOM_MIN_J = 5, ANOM_RATIO = 0.8;
const BASELINE_PATH = path.join(ROOT, 'combo_baseline.json');
const REVIEW_Q_PATH = path.join(ROOT, 'combo_review_queue.md');

/** 사람 검수가 필요한 생성 경로 (cluster 재조합·note 편집본 — 생성 주석상 '검수 권장') */
const REVIEW_PATHS = new Set(['cluster', 'ref:note']);

const errors = [];
const warnings = [];
const warnCats = {};
const infoCats = {};   // 경고 아닌 참고 카운트 (혼동쌍·열거 멤버 접두사 공유 등)
const reviewQueue = []; // 검수 큐 — {exam, file, q, reasons[]}
const newBaseline = {}; // 이번 감사의 과목별 문항 수 (회귀 기준선용)
const err = m => errors.push(m);
const warn = (cat, m) => { warnings.push(m); warnCats[cat] = (warnCats[cat] || 0) + 1; };

/* ---------- 진술 유틸 (build_combo_drills.js와 동일 규칙) ---------- */
const normKey = s => String(s).toLowerCase().replace(/[\s()[\]{}]/g, '');
function nearDup(a, b) {
  const x = normKey(a), y = normKey(b);
  if (x.includes(y) || y.includes(x)) return true;
  const min = Math.min(x.length, y.length);
  let i = 0;
  while (i < min && x[i] === y[i]) i++;
  return i >= Math.max(8, Math.floor(min * 0.6));
}

/** combo 번들 로드 — var COMBO_DRILLS_<KEY> = [...] */
function loadComboFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const m = src.match(/var\s+COMBO_DRILLS_(\w+)\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!m) return null;
  return { key: m[1], items: JSON.parse(m[2]) };
}

/** combo_pilot.js 로드 — window.COMBO_PILOT.questions */
function loadPilotFile(filePath) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), sandbox);
  return (sandbox.window.COMBO_PILOT && sandbox.window.COMBO_PILOT.questions) || [];
}

/** 모순 탐지 보조 — 수치 슬롯(숫자만 다른 동일 문장)·극성 반쌍 */
const stripNum = s => normKey(s).replace(/\d+/g, '#');
const numVals = s => (String(s).match(/\d+/g) || []).join(',');
// 참조 번호(제N호/항/조) 차이는 목록 멤버 구분이라 모순이 아님
const isArticleRef = s => /제\s*\d+\s*(조|항|호|목|의\d+)/.test(s);
const NEG_PAIRS = [
  ['있다', '없다'], ['가능하다', '불가능하다'], ['해야한다', '하지않아도된다'],
  ['포함한다', '포함하지않는다'], ['필요하다', '불필요하다'],
  ['허용된다', '금지된다'], ['해당한다', '해당하지않는다'],
];
const antonymEqual = (a, b) => {
  const x = normKey(a), y = normKey(b);
  return NEG_PAIRS.some(([p, n]) => x.replaceAll(n, p) === y || y.replaceAll(n, p) === x);
};

/** derivedFrom → 생성 경로 분류 */
function pathOf(q) {
  const d = String(q.derivedFrom || '');
  if (d.startsWith('cluster:')) return 'cluster';
  if (d.startsWith('ref:note|')) return 'ref:note';
  if (d.startsWith('ref:def|')) return 'ref:def';
  if (d.startsWith('ref:')) return 'ref:enum';
  if (d) return 'bank';
  return 'pilot';
}

async function auditExam(target, validateQuestion, deriveComboAnswer) {
  // 검수 승인 목록 — 사람이 "양호" 판정한 id는 큐에서 제외 (소진형 검수 워크플로)
  const blPath = path.join(ROOT, target.contentRoot, 'combo_blocklist.json');
  let approvedIds = new Set();
  if (fs.existsSync(blPath)) {
    try { approvedIds = new Set(JSON.parse(fs.readFileSync(blPath, 'utf8')).approved || []); }
    catch { /* blocklist 파싱 오류는 빌드 측에서 보고 */ }
  }

  const drillsDir = path.join(ROOT, target.dataRoot, 'drills');
  if (!fs.existsSync(drillsDir)) {
    console.log(`[check:combo] ${target.id}: drills 없음 — 건너뜀`);
    return;
  }

  const bundles = [];
  for (const f of fs.readdirSync(drillsDir).filter(f => /^combo_subject\d+\.js$/.test(f)).sort()) {
    const b = loadComboFile(path.join(drillsDir, f));
    if (b) bundles.push({ key: b.key, items: b.items, file: f });
    else err(`${target.id}/${f}: 번들 파싱 실패`);
  }
  const pilotPath = path.join(drillsDir, 'combo_pilot.js');
  const pilotItems = fs.existsSync(pilotPath) ? loadPilotFile(pilotPath) : [];

  let total = 0;
  const rows = [];
  const sidMap = new Map();   // 진술 sid → {q, file} — 런타임 이상 진술의 문항 역매핑용

  for (const { key, items, file } of bundles) {
    const sidSets = new Map();       // 진술집합 → 문항 id[]
    const answerPos = {};            // 정답 옵션 id → 개수
    const paths = {};                // 생성 경로 → 개수
    let singleTruth = 0, allTrue = 0;

    for (const q of items) {
      total++;
      const qPath = pathOf(q);
      paths[qPath] = (paths[qPath] || 0) + 1;
      const qFlags = new Set();   // 이 문항에 붙은 경고 카테고리

      // ① 스키마·정답 유일성 재검증
      const problems = validateQuestion(q);
      if (problems.length) err(`${file} ${q.id}: ${problems.join(', ')}`);

      const stmts = q.statements || [];
      const trues = stmts.filter(s => s.truth);
      for (const s of stmts) {
        if (s.sid && !sidMap.has(s.sid)) sidMap.set(s.sid, { q, file });
      }

      // ② 옵션 수·참 진술 극단
      if ((q.options || []).length !== 5)
        err(`${file} ${q.id}: 옵션 ${(q.options || []).length}개 (5여야 함)`);
      if (!trues.length) err(`${file} ${q.id}: 참 진술 0 — 정답 조합 불성립`);
      if (trues.length === stmts.length && stmts.length > 0) {
        warn('allTrue', `${file} ${q.id}: 전원 참 (${stmts.length}개) — '모두' 퇴화`);
        qFlags.add('allTrue');
      }
      if (trues.length === 1) singleTruth++;
      if (trues.length === stmts.length) allTrue++;

      // ③ 중복 진술집합
      const setKey = stmts.map(s => s.sid || normKey(s.text)).sort().join('|');
      (sidSets.get(setKey) || sidSets.set(setKey, []).get(setKey)).push(q.id);

      // ④ 문항 내 근접중복 진술 쌍 (bank 경로는 생성 시 미검사)
      // 상반 truth 근접쌍은 혼동쌍 대조라 교육상 유효 — 동일 truth 근접쌍만
      // 중복(중복 출제)으로, 동일 텍스트+상반 truth만 모순 의심으로 분리한다.
      for (let i = 0; i < stmts.length; i++) {
        for (let j = i + 1; j < stmts.length; j++) {
          const a = stmts[i], b = stmts[j];
          if (normKey(a.text) === normKey(b.text) && a.truth !== b.truth) {
            warn('contradict', `${file} ${q.id}: 동일 텍스트·상반 truth — "${a.text.slice(0, 40)}…" (${a.id}=${a.truth}, ${b.id}=${b.truth}) 모순 의심`);
            qFlags.add('contradict');
          } else if (a.truth === b.truth) {
            // 극성 반쌍(있다/없다·가능/불가능 등)을 같은 진위로 표기 — 모순 의심.
            // (nearDup에 먼저 걸리는 불가능하다⊃가능하다 포함 — 같은 진위면 먼저 검사)
            if (antonymEqual(a.text, b.text)) {
              warn('negConflict', `${file} ${q.id}: 극성 반쌍 동일 truth(${a.truth}) — "${a.text.slice(0, 30)}…" vs "${b.text.slice(0, 30)}…" 모순 의심`);
              qFlags.add('negConflict');
            } else if (nearDup(a.text, b.text)) {
              // 수치 구분 혼동쌍(7일/30일)·법령 열거 멤버(상호/소재지 변경)는 접두사
              // 공유가 정상 — 경고가 아니라 참고 카운트로만 집계한다.
              infoCats.nearDupSameTruth = (infoCats.nearDupSameTruth || 0) + 1;

              // 같은 술어에 다른 수치를 '둘 다 참'으로 표기하면 실제 모순
              // (둘 다 거짓은 복수 오답값이라 정상). 제N호 참조 차이는 제외.
              if (a.truth && stripNum(a.text) === stripNum(b.text) &&
                  numVals(a.text) !== numVals(b.text) &&
                  !(isArticleRef(a.text) && isArticleRef(b.text))) {
                warn('numConflict', `${file} ${q.id}: 수치 모순 의심 — "${a.text.slice(0, 30)}…" vs "${b.text.slice(0, 30)}…" 둘 다 참`);
                qFlags.add('numConflict');
              }
            }
          }
        }
        const t = String(stmts[i].text || '').trim();
        // 절단 의심: 명사 어미와 충돌하지 않는 조사·연결어미 종결만 — 이/가/의/로/도/만/와/과는
        // 보고서·빈도·효과 같은 정상 명사 어미라 제외한다.
        if (/을$|를$|은$|는$|에서$|에게$|부터$|까지$|및$|하고$|하여$|하며$|이며$|이고$|거나$|든지$/.test(t)) {
          warn('truncated', `${file} ${q.id}: 진술 ${stmts[i].id} 절단 의심 — "…${t.slice(-30)}"`);
          qFlags.add('truncated');
        }
        if (t.length > 170) warn('longStmt', `${file} ${q.id}: 진술 ${stmts[i].id} 장문(${t.length}자)`);
      }

      // ⑤ '모두' 옵션 — 전원 참이 아닌데 전집합 옵션이면 banFull 실패
      const allIds = new Set(stmts.map(s => s.id));
      for (const o of q.options || []) {
        if ((o.members || []).length === allIds.size &&
            (o.members || []).every(m => allIds.has(m)) &&
            trues.length !== stmts.length) {
          warn('allOfAboveOpt', `${file} ${q.id}: '모두' 옵션 ${o.id} 존재 — banFull 대상인데 생성됨`);
          qFlags.add('allOfAboveOpt');
        }
      }

      // ⑥ 정답 위치 집계
      const ans = deriveComboAnswer(q);
      if (ans) answerPos[ans] = (answerPos[ans] || 0) + 1;

      // ⑦ 검수 큐 적립 — 검수 경로(cluster·ref:note) 또는 경고가 붙은 문항.
      // blocklist.approved에 등록된 id는 검수 완료(양호)라 큐에서 제외한다.
      const reasons = [...qFlags];
      if (REVIEW_PATHS.has(qPath)) reasons.unshift(`검수경로:${qPath}`);
      if (reasons.length && !approvedIds.has(q.id))
        reviewQueue.push({ exam: target.id, file, q, reasons });
    }

    // 중복 집합 리포트
    for (const ids of sidSets.values()) {
      if (ids.length > 1) err(`${file}: 동일 진술집합 문항 ${ids.length}개 — ${ids.slice(0, 4).join(', ')}`);
    }

    // 정답 위치 편향
    const posTotal = Object.values(answerPos).reduce((a, b) => a + b, 0);
    const maxPos = Math.max(...Object.values(answerPos));
    if (posTotal && maxPos / posTotal > 0.3)
      warn('posBias',`${file}: 정답 위치 편향 — 최다 위치 ${(maxPos / posTotal * 100).toFixed(0)}%`);

    rows.push({ key, file, n: items.length, singleTruth, allTrue, paths, answerPos });
    (newBaseline[target.id] = newBaseline[target.id] || {})[key] = items.length;
  }

  // 수제 파일럿 문항도 동일 검증
  for (const q of pilotItems) {
    const problems = validateQuestion(q);
    if (problems.length) err(`combo_pilot.js ${q.id}: ${problems.join(', ')}`);
  }

  // 런타임 이상 진술 → 문항 역매핑 → 검수 큐 추가 (--anomalies backup.json)
  if (ANOM_FILE && fs.existsSync(ANOM_FILE)) {
    try {
      const backup = JSON.parse(fs.readFileSync(ANOM_FILE, 'utf8'));
      const raw = backup.statement_stats ?? backup[`${target.id}:statement_stats`] ?? {};
      const stats = typeof raw === 'string' ? JSON.parse(raw) : raw;
      let mapped = 0;
      for (const [sid, v] of Object.entries(stats)) {
        if (!v.j || v.j < ANOM_MIN_J || (v.w || 0) / v.j < ANOM_RATIO) continue;
        const hit = sidMap.get(sid);
        if (!hit || approvedIds.has(hit.q.id)) continue;
        if (!reviewQueue.some(r => r.q.id === hit.q.id)) {
          reviewQueue.push({ exam: target.id, file: hit.file, q: hit.q,
            reasons: [`런타임이상(오판 ${v.w}/${v.j})`] });
        }
        mapped++;
      }
      if (mapped) console.log(`  런타임 이상 진술 ${mapped}개 → 포함 문항 검수 큐 추가`);
    } catch (e) {
      warn('anomaly', `--anomalies 백업 파싱 실패: ${e.message}`);
    }
  }

  console.log(`\n[check:combo] ${target.id}: 번들 ${bundles.length}개, 자동생성 ${total}문 + 수제 ${pilotItems.length}문`);
  for (const r of rows) {
    const pathStr = Object.entries(r.paths).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`).join(' ');
    const posStr = Object.entries(r.answerPos).sort().map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`  ${r.file}: ${r.n}문 | 단일참 ${r.singleTruth}(${(r.singleTruth / r.n * 100).toFixed(0)}%) 전원참 ${r.allTrue} | ${pathStr}`);
    console.log(`    정답위치: ${posStr}`);
  }
}

async function main() {
  const { validateQuestion, deriveComboAnswer } =
    await import(pathToFileURL(path.join(ROOT, 'src', 'questions.js')).href);

  for (const target of getExamTargets(ROOT)) {
    await auditExam(target, validateQuestion, deriveComboAnswer);
  }

  // ── 회귀 가드: 기준선 대비 문항 수 감소 감지 ──
  if (UPDATE_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(newBaseline, null, 2) + '\n');
    console.log(`\n기준선 갱신 → combo_baseline.json (${Object.values(newBaseline)
      .map(m => Object.values(m).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0)}문)`);
  } else if (fs.existsSync(BASELINE_PATH)) {
    const base = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    for (const [examId, subs] of Object.entries(newBaseline)) {
      for (const [key, n] of Object.entries(subs)) {
        const prev = base[examId] && base[examId][key];
        if (prev == null) continue;
        const drop = (prev - n) / prev;
        if (drop >= 0.3) err(`${examId}/${key}: 문항 수 급감 ${prev}→${n} (-${(drop * 100).toFixed(0)}%)`);
        else if (drop >= 0.1) warn('regression', `${examId}/${key}: 문항 수 감소 ${prev}→${n} (-${(drop * 100).toFixed(0)}%)`);
      }
    }
  } else {
    console.log('\n(기준선 없음 — --update-baseline으로 combo_baseline.json 생성 가능)');
  }

  // ── 검수 큐 출력 ──
  const rq = ['# 복수정답형 검수 큐', '',
    `> audit:combo 자동 생성 (${new Date().toISOString().slice(0, 10)}) — ` +
    `검수 필요 문항 ${reviewQueue.length}건`,
    '> 불량 문항은 id를 combo_blocklist.json 의 `ids`에, 검수 완료(양호)는 `approved`에 추가하세요.',
    ''];
  for (const { exam, file, q, reasons } of reviewQueue) {
    rq.push(`## ${q.id}`, '',
      `- 시험/번들: ${exam} / ${file}`,
      `- 사유: ${reasons.join(', ')}`,
      `- 출처: ${q.derivedFrom || '—'} · ${q.citation || '—'}`,
      `- 발문: ${q.stem}`, '',
      ...(q.statements || []).map(s => `- ${s.truth ? '⭕' : '❌'} ${s.id}. ${s.text}`),
      '', '---', '');
  }
  fs.writeFileSync(REVIEW_Q_PATH, rq.join('\n'));
  console.log(`\n검수 큐: ${reviewQueue.length}문항 → combo_review_queue.md`);

  console.log(`\n결과: 오류 ${errors.length}건 / 경고 ${warnings.length}건`);
  if (Object.keys(warnCats).length) {
    console.log('  경고 분포:', Object.entries(warnCats).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`).join(' '));
  }
  if (Object.keys(infoCats).length) {
    console.log('  참고:', Object.entries(infoCats).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`).join(' '));
  }
  errors.slice(0, 15).forEach(e => console.log('  ✗', e));
  if (errors.length > 15) console.log(`  … 외 ${errors.length - 15}건`);
  // 오탐 많은 카테고리(shortStmt·nearDup)는 개수만, 신뢰도 직결 카테고리는 전량 표시
  const SIGNAL = /모순 의심|'모두' 옵션|전원 참|편향/;
  const shown = warnings.filter(w => SIGNAL.test(w));
  shown.slice(0, 20).forEach(w => console.log('  ⚠', w));
  if (shown.length > 20) console.log(`  … 외 ${shown.length - 20}건`);
  if (warnings.length > shown.length)
    console.log(`  (기타 ${warnings.length - shown.length}건은 요약만 — 전량은 combo_audit_report.json)`);
  fs.writeFileSync(path.join(ROOT, 'combo_audit_report.json'),
    JSON.stringify({ errors, warnings, warnCats, infoCats }, null, 2));

  if (errors.length || (STRICT && warnings.length)) process.exitCode = 1;
  else console.log('✅ 콤보 품질 감사 통과');
}

main().catch(e => { console.error(e); process.exit(1); });
