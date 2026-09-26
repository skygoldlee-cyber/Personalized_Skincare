// tools/migrate_ref_md_subjects.js — ref_md/{doc}/ → ref_md/과목{N}/{doc}/ 재배치
//
// 1) ref_md 하위 문서 디렉터리를 docSubject() 규칙으로 ref_md/과목N/ 아래로 이동
// 2) content/ 내 모든 ref_md/{doc}/ 링크에 과목N/ 세그먼트 삽입 (raw·URL인코딩 모두)
//
// 사용: node tools/migrate_ref_md_subjects.js          # 실행
//       node tools/migrate_ref_md_subjects.js --check   # 검증만 (이동·미변환 링크 보고)
const fs = require('fs');
const path = require('path');
const { docSubject } = require('./build/ref-statements.js');

const ROOT = path.resolve(__dirname, '..');
const { getDefaultExamRoots } = require('./build/exam-targets.js');
const CONTENT = path.join(ROOT, getDefaultExamRoots(ROOT).contentRoot);
const REF_MD = path.join(CONTENT, '참조자료', 'ref_md');
const check = process.argv.includes('--check');

/** 디렉터리 재귀 파일 수집 */
function walk(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, exts));
    else if (exts.includes(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

/** doc 디렉터리명 → 과목 폴더명 (규칙 미매칭 시 null) */
function subjectDir(docName) {
  const s = docSubject(docName);
  return s ? `과목${s}` : null;
}

/* ---------- 1) 디렉터리 이동 ---------- */
function moveDocs() {
  const moved = [];
  for (const e of fs.readdirSync(REF_MD, { withFileTypes: true })) {
    if (!e.isDirectory() || /^과목\d+$/.test(e.name)) continue;
    const subj = subjectDir(e.name);
    if (!subj) { console.log(`  ⚠ 과목 규칙 없음 — 이동 스킵: ${e.name}`); continue; }
    const dst = path.join(REF_MD, subj, e.name);
    if (fs.existsSync(dst)) { console.log(`  ⚠ 이미 존재 — 스킵: ${dst}`); continue; }
    if (!check) {
      fs.mkdirSync(path.join(REF_MD, subj), { recursive: true });
      fs.renameSync(path.join(REF_MD, e.name), dst);
    }
    moved.push(`${e.name} → ${subj}/`);
  }
  return moved;
}

/* ---------- 2) 링크 갱신 ---------- */
// ref_md/{seg}/ 에서 seg를 디코딩해 과목을 조회 후 삽입.
// 이미 과목N 세그먼트가 있으면 건너뜀.
// 세그먼트에 공백·괄호가 포함된 원시 경로(<...> 형태)도 처리 — / 와 > 만 제외
const LINK_RE = /ref_md\/(?!과목\d\/)([^/>\n]+?)\//g;

function fixLinks() {
  const stats = { files: 0, links: 0, unmappable: [] };
  const files = walk(CONTENT, ['.md', '.html']);
  for (const f of files) {
    let text = fs.readFileSync(f, 'utf8');
    let changed = 0;
    const out = text.replace(LINK_RE, (m, seg) => {
      let doc = seg;
      try { doc = decodeURIComponent(seg); } catch { /* 원형 유지 */ }
      const subj = subjectDir(doc);
      if (!subj) { stats.unmappable.push(`${path.basename(f)}: ${seg}`); return m; }
      changed++;
      return `ref_md/${subj}/${seg}/`;
    });
    if (changed) {
      stats.files++; stats.links += changed;
      if (!check) fs.writeFileSync(f, out, 'utf8');
    }
  }
  return stats;
}

function main() {
  const moved = moveDocs();
  console.log(`${check ? '[check] ' : ''}디렉터리 ${moved.length}개 ${check ? '이동 예정' : '이동'}:`);
  for (const m of moved) console.log(`  ${m}`);
  const st = fixLinks();
  console.log(`\n링크: ${st.files}개 파일 ${st.links}건 ${check ? '갱신 예정' : '갱신'}`);
  if (st.unmappable.length) {
    console.log(`⚠ 규칙 미매칭 링크 ${st.unmappable.length}건:`);
    for (const u of [...new Set(st.unmappable)].slice(0, 10)) console.log(`  ${u}`);
  }
  // 이동 후 잔여 평탄 링크 검사
  if (!check) {
    const left = fixLinks();
    console.log(`잔여 미변환 링크: ${left.links}건`);
    if (left.unmappable.length) {
      for (const u of [...new Set(left.unmappable)].slice(0, 10)) console.log(`  ⚠ ${u}`);
    }
  }
}

main();
