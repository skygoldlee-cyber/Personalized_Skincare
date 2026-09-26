// tools/check_ref_subjects.js — ref_md 문서의 실제 인용 과목 vs DOC_SUBJECT_RULES 귀속 교차 검증
//
// 신호: 문제은행·교재·참조노트 본문의 ref_md 링크를 과목별로 집계(인용 득표).
// 파일명 규칙(DOC_SUBJECT_RULES)은 문서 내용을 보지 않으므로, 실제 사용 과목과
// 어긋나는 문서를 탐지한다. 득표가 희소한 문서(0~2표)는 정보 부족으로 표시만 한다.
//
// 판정:
//   불일치  — 다수 득표 과목 ≠ 규칙 과목, 다수 득표 ≥3표이고 규칙 과목 득표의 2배+
//   다과목  — 둘째 과목이 최다 득표의 ≥40% (단일 귀속의 근사 오차, 참고 정보)
//   무인용  — 인용 0 (파일명 규칙 외 검증 수단 없음)
//
// 사용: node tools/check_ref_subjects.js [--strict]
//   --strict: '불일치' 문서가 있으면 종료코드 1 (CI 연동용)
const fs = require('fs');
const path = require('path');
const { docSubject } = require('./build/ref_statements.js');
const { getExamTargets, getDefaultExamRoots } = require('./build/exam_targets.js');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, getDefaultExamRoots(ROOT).contentRoot);
const REF_MD = path.join(CONTENT, '참조자료', 'ref_md');

// 다수 과목 공동 인용 문서 — references.json의 multiSubjectDocs에 등록되면
// '불일치'가 아닌 '다과목'으로 판정한다 (귀속 진실은 물리 폴더, 규칙은 폴백 기준선).
function loadMultiSubjectDocs() {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(CONTENT, 'references.json'), 'utf-8'));
    return new Set(doc.multiSubjectDocs || []);
  } catch { return new Set(); }
}

/** dir 안의 모든 .md 파일 재귀 수집 */
function mdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...mdFiles(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** 텍스트에서 ref_md/{doc}/ 링크 추출 → {doc: 횟수} (URL 인코딩 디코딩) */
function countCitations(text) {
  const counts = {};
  // ref_md/과목N/{doc}/ 구조 — 과목 세그먼트는 건너뛰고 문서 디렉터리만 집계
  const re = /ref_md\/(?:과목\d\/)?([^/)#\s]+)\//g;
  let m;
  while ((m = re.exec(text))) {
    let doc = m[1];
    try { doc = decodeURIComponent(doc); } catch { /* 인코딩 깨진 링크는 원형 유지 */ }
    counts[doc] = (counts[doc] || 0) + 1;
  }
  return counts;
}

function main() {
  const strict = process.argv.includes('--strict');
  // ref_md/과목N/{doc}/ 구조 — 과목 폴더 1단계 아래가 문서 디렉터리
  const refDocs = [];
  for (const e of fs.readdirSync(REF_MD, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (/^과목\d+$/.test(e.name)) {
      for (const d of fs.readdirSync(path.join(REF_MD, e.name), { withFileTypes: true })) {
        if (d.isDirectory()) refDocs.push(d.name);
      }
    } else {
      refDocs.push(e.name);   // 평탄 잔존
    }
  }
  refDocs.sort();

  // 과목별 인용 득표 수집
  const votes = {}; // doc → {subject: n}
  const addVotes = (subject, text) => {
    for (const [doc, n] of Object.entries(countCitations(text))) {
      (votes[doc] = votes[doc] || {})[subject] = (votes[doc][subject] || 0) + n;
    }
  };

  // [멀티시험] 과목키/dir↔order 매핑은 각 시험 manifest에서 파생 (하드코딩 테이블 제거)
  for (const target of getExamTargets(ROOT)) {
    if (!target.manifest) continue;
    const troot = path.join(ROOT, target.contentRoot);
    const subjOrder = {}; // subjectKey → order
    for (const s of target.manifest.subjects || []) subjOrder[s.key] = s.order;
    const fileOrder = {}; // 문제은행 파일명 → order
    for (const e of target.manifest.exams || []) fileOrder[e.file] = subjOrder[e.subject];

    // 문제은행 — manifest 등록 파일은 선언 과목으로, 나머지는 파일명 과목N으로 귀속
    const bankDir = path.join(troot, '문제은행');
    for (const f of fs.existsSync(bankDir) ? fs.readdirSync(bankDir) : []) {
      if (!f.endsWith('.md')) continue;
      const m = f.match(/^과목(\d)/);
      const s = fileOrder[f] || (m ? +m[1] : null);
      if (s) addVotes(s, fs.readFileSync(path.join(bankDir, f), 'utf8'));
    }
    // 교재 — manifest 선언 dir의 모든 .md를 subject.order로 귀속
    for (const s of target.manifest.subjects || []) {
      for (const f of mdFiles(path.join(troot, s.dir))) {
        addVotes(s.order, fs.readFileSync(f, 'utf8'));
      }
    }
  }

  // 집계·판정
  const multiDocs = loadMultiSubjectDocs();
  const mismatches = [], multi = [], uncited = [], weak = [];
  const rows = [];
  for (const doc of refDocs) {
    const rule = docSubject(doc);
    const v = votes[doc] || {};
    const total = Object.values(v).reduce((a, b) => a + b, 0);
    const ranked = Object.entries(v).map(([s, n]) => [+s, n]).sort((a, b) => b[1] - a[1]);
    const [top, second] = [ranked[0], ranked[1]];

    if (!total) { uncited.push(doc); continue; }
    if (total < 3) { weak.push({ doc, rule, v, total }); continue; }

    const [topSubj, topN] = top;
    if (topSubj !== rule && topN >= 3 && topN >= (v[rule] || 0) * 2 && !multiDocs.has(doc)) {
      mismatches.push({ doc, rule, topSubj, topN, ruleN: v[rule] || 0 });
    } else if (second && second[1] >= top[1] * 0.4 && second[0] !== rule) {
      multi.push({ doc, rule, v });
    }
    rows.push({ doc, rule, v, total });
  }

  // 출력
  console.log(`ref_md 문서 ${refDocs.length}개 — 인용 득표 집계 완료\n`);
  if (mismatches.length) {
    console.log(`⚠ 불일치 ${mismatches.length}건 (다수 인용 과목 ≠ 규칙 과목):`);
    for (const m of mismatches) {
      console.log(`  ${m.doc}`);
      console.log(`    규칙=과목${m.rule} vs 인용=과목${m.topSubj} ${m.topN}표 (규칙 과목 ${m.ruleN}표)`);
    }
    console.log('');
  }
  if (multi.length) {
    console.log(`ℹ 다과목 문서 ${multi.length}건 (단일 귀속 근사 오차):`);
    for (const m of multi) {
      console.log(`  ${m.doc} — 규칙=과목${m.rule}, 인용=${JSON.stringify(m.v)}`);
    }
    console.log('');
  }
  console.log(`무인용 문서 ${uncited.length}건 / 약신호(<3표) ${weak.length}건`);
  if (weak.length) {
    for (const w of weak) {
      const [t] = Object.entries(w.v).sort((a, b) => b[1] - a[1])[0];
      if (+t !== w.rule) {
        console.log(`  (약) ${w.doc} — 규칙=과목${w.rule}, 소수 인용=${JSON.stringify(w.v)}`);
      }
    }
  }
  if (!mismatches.length) console.log('✅ 규칙과 인용 과목이 일치합니다.');
  if (strict && mismatches.length) process.exit(1);
}

main();
