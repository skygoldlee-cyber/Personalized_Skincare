#!/usr/bin/env node
/**
 * check_reflayout.js — 참조자료 4계층 정합성 검증
 *
 * 계층:
 *   ① 물리 PDF 폴더    content/참조자료/{법령고시,공통,과목N,_archive}/*.pdf
 *   ② ref_md 변환본    content/참조자료/ref_md/과목N/{문서}/{문서}.md
 *   ③ UI 매니페스트    content/references.json (refDirs/referenceFiles/referenceCommon/referenceLaw)
 *   ④ 생성 규칙        tools/build/ref-statements.js DOC_SUBJECT_RULES → docSubject()
 *
 * 검사:
 *   - refDirs에 등록된 PDF → ref_md/과목N/{base}/{base}.md 존재 + N == docSubject(base)
 *   - refDirs 폴더의 물리 PDF ↔ refDirs 목록 양방향 일치
 *   - ref_md/과목N/{doc} → 출처 PDF 존재(고아 감지) + 폴더 과목 == docSubject(doc)
 *   - _archive PDF → ref_md 요구 없음 / _구 ref_md는 허용(교재 참조용, 생성 제외)
 *   - referenceFiles/referenceCommon/referenceLaw 항목 → dir·file 실존
 *   - content/** 의 ref_md/ 링크 → 실제 파일 해석
 *
 * 사용: node tools/check_reflayout.js   (불일치 시 exit 1)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { getDefaultExamRoots } = require('./build/exam-targets.js');
const CONTENT = path.join(ROOT, getDefaultExamRoots(ROOT).contentRoot);
const REF_BASE = path.join(CONTENT, '참조자료');
const REF_MD = path.join(REF_BASE, 'ref_md');
const { docSubject } = require('./build/ref-statements.js');

const refs = JSON.parse(fs.readFileSync(path.join(CONTENT, 'references.json'), 'utf8'));
const subjectDirMap = refs.subjectDirMap || {};

const errors = [];
const warnings = [];
const err = m => errors.push(m);
const warn = m => warnings.push(m);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
const dec = s => { try { return decodeURIComponent(s); } catch { return s; } };

// ---------- ① 물리 PDF 수집 ----------
const physicalPdfs = {}; // basename → dir
const allPdfDirs = fs.readdirSync(REF_BASE, { withFileTypes: true })
  .filter(e => e.isDirectory() && !/^ref_md/.test(e.name))
  .map(e => e.name);
for (const d of allPdfDirs) {
  for (const f of fs.readdirSync(path.join(REF_BASE, d))) {
    if (!f.endsWith('.pdf')) continue;
    const base = f.replace(/\.pdf$/, '');
    if (physicalPdfs[base]) err(`중복 PDF: ${base} (${physicalPdfs[base]}/ 와 ${d}/)`);
    physicalPdfs[base] = d;
  }
}

// ---------- ② ref_md 문서 수집 ----------
const refMdDocs = {}; // doc → {subject, mdPath}
for (const e of fs.readdirSync(REF_MD, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const sm = e.name.match(/^과목(\d)$/);
  if (!sm) continue; // index.html 등 비과목 항목 무시
  const subj = +sm[1];
  for (const d of fs.readdirSync(path.join(REF_MD, e.name), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const mdPath = path.join(REF_MD, e.name, d.name, d.name + '.md');
    refMdDocs[d.name] = { subject: subj, mdPath };
    if (!fs.existsSync(mdPath)) err(`ref_md/${e.name}/${d.name}/ 에 ${d.name}.md 없음`);
  }
}

// ---------- ③-1 refDirs: 목록↔물리 양방향 ----------
const listed = new Set();
for (const [dir, files] of Object.entries(refs.refDirs || {})) {
  if (!allPdfDirs.includes(dir)) { err(`refDirs 폴더 '${dir}'가 참조자료/에 없음`); continue; }
  for (const f of files) {
    listed.add(f);
    if (!fs.existsSync(path.join(REF_BASE, dir, f))) err(`refDirs[${dir}] 미존재 파일: ${f}`);
  }
}
for (const [base, dir] of Object.entries(physicalPdfs)) {
  if (dir === '_archive') continue;
  if (!listed.has(base + '.pdf')) err(`물리 PDF가 refDirs 미등록: ${dir}/${base}.pdf`);
}

// ---------- ③-2 PDF → ref_md (귀속 정합) ----------
for (const [dir, files] of Object.entries(refs.refDirs || {})) {
  if (dir === '_archive') continue;
  for (const f of files) {
    const base = f.replace(/\.pdf$/, '');
    const doc = refMdDocs[base];
    if (!doc) { err(`ref_md 변환본 없음: ${dir}/${f}`); continue; }
    const ruleSubj = docSubject(base);
    if (ruleSubj && doc.subject !== ruleSubj)
      err(`과목 불일치: ${base} — ref_md/과목${doc.subject} vs 규칙=과목${ruleSubj}`);
  }
}

// ---------- ③-3 ref_md → 출처 PDF (고아 감지) + 폴더 과목 정합 ----------
for (const [doc, info] of Object.entries(refMdDocs)) {
  const src = physicalPdfs[doc];
  if (!src) { err(`출처 PDF 없는 ref_md: 과목${info.subject}/${doc}`); continue; }
  if (/_구$/.test(doc)) {
    if (src !== '_archive') warn(`_구 문서 PDF가 _archive 밖에 있음: ${src}/${doc}.pdf`);
    continue;
  }
  if (src === '_archive') { err(`서비스 ref_md의 출처가 _archive: ${doc}`); continue; }
  const ruleSubj = docSubject(doc);
  if (ruleSubj && info.subject !== ruleSubj)
    err(`ref_md 폴더 과목 불일치: ${doc} — 폴더=과목${info.subject}, 규칙=과목${ruleSubj}`);
}

// ---------- ③-4 UI 항목 실존 ----------
function checkEntry(e, where) {
  if (!e.file) return;
  const dir = e.dir || (where && subjectDirMap[where]) || null;
  if (!dir) { warn(`dir 없음 — 위치 검증 불가: ${where} '${e.name}'`); return; }
  const p = path.join(REF_BASE, dir, e.file);
  if (!fs.existsSync(p)) err(`UI 항목 파일 없음: ${where} '${e.name}' → ${dir}/${e.file}`);
}
for (const [subj, arr] of Object.entries(refs.referenceFiles || {}))
  for (const e of arr) checkEntry(e, subj);
for (const e of refs.referenceCommon || []) checkEntry(e, '공통');
for (const e of refs.referenceLaw || []) checkEntry(e, '법령고시');

// ---------- ④ ref_md 링크 해석 ----------
let linkOk = 0, linkBad = 0;
for (const f of walk(CONTENT)) {
  if (!/\.(md|html)$/i.test(f)) continue;
  if (f.includes(`${path.sep}ref_md${path.sep}`)) continue; // ref_md 내부 문서는 제외
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/ref_md\/([^<>\n]*?\.md)/g)) {
    const rel = dec(m[1]);
    if (fs.existsSync(path.join(REF_MD, rel))) linkOk++;
    else { linkBad++; if (linkBad <= 8) err(`깨진 링크: ${path.relative(CONTENT, f)} → ref_md/${rel.slice(0, 80)}`); }
  }
}

// ---------- 리포트 ----------
console.log('='.repeat(70));
console.log('참조자료 레이아웃 정합성 검증');
console.log('='.repeat(70));
console.log(`PDF: 물리 ${Object.keys(physicalPdfs).length}개 / refDirs 등록 ${listed.size}개`);
console.log(`ref_md 문서: ${Object.keys(refMdDocs).length}개 / 링크: 정상 ${linkOk}, 깨짐 ${linkBad}`);
if (warnings.length) {
  console.log('\n■ 경고');
  warnings.forEach(w => console.log('  ' + w));
}
if (errors.length) {
  console.log(`\n■ 오류 ${errors.length}건`);
  errors.forEach(e => console.log('  ' + e));
  process.exit(1);
}
console.log('\n✅ 정합성 검증 통과');
