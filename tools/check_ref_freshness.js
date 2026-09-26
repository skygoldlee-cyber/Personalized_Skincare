#!/usr/bin/env node
/**
 * check_ref_freshness.js — 참조자료 PDF ↔ ref_md 변환본 신선도 검증
 *
 * {contentRoot}/참조자료/pdf_hashes.json에 서비스 PDF의 SHA-256을 기록해두고,
 * 파일 내용이 바뀌면(법령 개정·별표 교체 등) ref_md 재변환이 필요하다고 보고한다.
 *
 * 검사:
 *   - 변경됨   매니페스트 해시 ≠ 현재 해시 → ref_md 재변환 필요
 *   - 미등록   매니페스트에 없는 PDF → 변환 후 --update로 등록
 *   - 잔여     매니페스트에는 있으나 PDF 없음 → 매니페스트 정리 필요
 *   (ref_md* 산출물 폴더와 _archive/ 는 해시 대상이 아니다)
 *
 * 사용:
 *   node tools/check_ref_freshness.js            # 검증 (불일치 시 exit 1)
 *   node tools/check_ref_freshness.js --update   # 현재 PDF 해시로 매니페스트 갱신
 *
 * PDF 교체 워크플로:
 *   ① PDF 교체 ② npm run convert:refs (ref_md_v2 스테이징)
 *   ③ npm run verify:refs (골든 비교) ④ ref_md/과목N/ 승격
 *   ⑤ npm run check:reffresh -- --update (해시 스탬프)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getExamTargets } = require('./build/exam_targets.js');

const ROOT = path.resolve(__dirname, '..');
const UPDATE = process.argv.includes('--update');

const SKIP_DIR = /^ref_md|^_archive$/;

const sha256 = f =>
  crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** 참조자료 아래 서비스 PDF 수집 → {'<dir>/<file>.pdf': absPath} (루트 파일은 '<file>.pdf') */
function collectPdfs(refBase) {
  const out = {};
  for (const e of fs.readdirSync(refBase, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIR.test(e.name)) continue;
      const dir = path.join(refBase, e.name);
      for (const f of fs.readdirSync(dir)) {
        if (f.toLowerCase().endsWith('.pdf')) {
          out[`${e.name}/${f}`] = path.join(dir, f);
        }
      }
    } else if (e.name.toLowerCase().endsWith('.pdf')) {
      out[e.name] = path.join(refBase, e.name);
    }
  }
  return out;
}

console.log('='.repeat(70));
console.log('참조자료 PDF ↔ ref_md 신선도 검증' + (UPDATE ? ' (--update)' : ''));
console.log('='.repeat(70));

let failed = 0;
let scanned = 0;

for (const t of getExamTargets(ROOT)) {
  const refBase = path.join(ROOT, t.contentRoot, '참조자료');
  if (!fs.existsSync(refBase)) continue;
  scanned++;

  const manifestPath = path.join(refBase, 'pdf_hashes.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};
  const pdfs = collectPdfs(refBase);

  if (UPDATE) {
    const next = {};
    for (const [rel, p] of Object.entries(pdfs)) next[rel] = sha256(p);
    fs.writeFileSync(manifestPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
    console.log(`[${t.id}] ${Object.keys(next).length}개 PDF 해시 갱신 → ${path.relative(ROOT, manifestPath)}`);
    continue;
  }

  const changed = [], added = [], removed = [];
  for (const [rel, p] of Object.entries(pdfs)) {
    if (!(rel in manifest)) added.push(rel);
    else if (manifest[rel] !== sha256(p)) changed.push(rel);
  }
  for (const rel of Object.keys(manifest)) {
    if (!(rel in pdfs)) removed.push(rel);
  }

  if (added.length || changed.length || removed.length) {
    failed++;
    console.log(`\n[${t.id}] ⚠ 신선도 불일치`);
    changed.forEach(r => console.log(`  변경됨 — ref_md 재변환 필요: ${r}`));
    added.forEach(r => console.log(`  미등록 PDF — 변환 후 --update로 등록: ${r}`));
    removed.forEach(r => console.log(`  매니페스트 잔여(PDF 없음): ${r}`));
  } else {
    console.log(`[${t.id}] ✅ PDF ${Object.keys(pdfs).length}개 해시 일치`);
  }
}

if (!scanned) console.log('참조자료 디렉터리를 가진 시험이 없습니다.');

if (failed && !UPDATE) {
  console.log('\n⚠ PDF가 변경/추가됐습니다 — ref_md 재변환 후 '
    + '`npm run check:reffresh -- --update`로 해시를 스탬프하세요.');
  process.exit(1);
}
if (!UPDATE) console.log('\n✅ 모든 참조자료 PDF가 등록 해시와 일치합니다.');
