// PDF 링크 → MD 변환본 매핑 가능성 조사
// 모든 PDF 파일에 대해 ref_md/ 하위에 MD 변환본이 존재하는지 확인
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REF_BASE = path.join(ROOT, 'content', '참조자료');
const REF_MD_DIR = path.join(REF_BASE, 'ref_md');

// ref_md/과목N/{doc}/ 구조 — 문서 디렉터리는 과목 폴더 1단계 아래에 있다
const refMdDirs = [];
const refMdParent = {};
for (const top of fs.readdirSync(REF_MD_DIR, { withFileTypes: true })) {
  if (!top.isDirectory()) continue;
  if (/^과목\d+$/.test(top.name)) {
    for (const d of fs.readdirSync(path.join(REF_MD_DIR, top.name), { withFileTypes: true })) {
      if (d.isDirectory()) { refMdDirs.push(d.name); refMdParent[d.name] = `${top.name}/${d.name}`; }
    }
  } else {
    refMdDirs.push(top.name); refMdParent[top.name] = top.name;   // 평탄 잔존
  }
}

const refMdFiles = {};
for (const dir of refMdDirs) {
  const fullDir = path.join(REF_MD_DIR, refMdParent[dir]);
  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.md'));
  refMdFiles[dir] = files;
}

// 참조자료의 모든 PDF 디렉터리 (법령원문, 공통, 과목1~4)
const pdfDirs = fs.readdirSync(REF_BASE, { withFileTypes: true })
  .filter(e => e.isDirectory() && e.name !== 'ref_md' && e.name !== 'ref_md_v2')
  .map(e => e.name);
const pdfFiles = {};
for (const dir of pdfDirs) {
  const fullDir = path.join(REF_BASE, dir);
  if (fs.existsSync(fullDir)) {
    pdfFiles[dir] = fs.readdirSync(fullDir).filter(f => f.endsWith('.pdf'));
  }
}

console.log('='.repeat(80));
console.log('PDF → MD 변환본 매핑 가능성 조사');
console.log('='.repeat(80));
console.log();

// 매핑 규칙: {basename}.pdf → ref_md/{basename}/{basename}.md
console.log('■ PDF 파일별 MD 변환본 존재 여부');
console.log('-'.repeat(80));

let total = 0, mapped = 0, missing = 0;
const missingList = [];

for (const [dir, files] of Object.entries(pdfFiles)) {
  console.log(`\n[${dir}/] (${files.length}개 PDF)`);
  for (const pdf of files) {
    total++;
    const basename = pdf.replace(/\.pdf$/, '');
    const mdDirExists = refMdDirs.includes(basename);
    const mdFile = `${basename}.md`;
    const mdFileExists = mdDirExists && refMdFiles[basename].includes(mdFile);

    if (mdFileExists) {
      mapped++;
      console.log(`  ✓ ${pdf}`);
      console.log(`    → ref_md/${refMdParent[basename]}/${mdFile}`);
    } else {
      missing++;
      missingList.push({ dir, pdf, basename });
      console.log(`  ✗ ${pdf}`);
      if (mdDirExists) {
        console.log(`    → 디렉토리는 있으나 MD 파일 없음: ref_md/${refMdParent[basename]}/`);
        console.log(`      (실제 파일: ${refMdFiles[basename].join(', ') || '없음'})`);
      } else {
        console.log(`    → ref_md/${basename}/ 디렉토리 자체 없음`);
      }
    }
  }
}

console.log();
console.log('='.repeat(80));
console.log('요약');
console.log('='.repeat(80));
console.log(`  전체 PDF: ${total}개`);
console.log(`  MD 변환본 있음: ${mapped}개`);
console.log(`  MD 변환본 없음: ${missing}개`);
console.log();

if (missingList.length > 0) {
  console.log('■ MD 변환본이 없는 PDF 파일 목록');
  console.log('-'.repeat(80));
  for (const m of missingList) {
    console.log(`  ${m.dir}/${m.pdf}`);
  }
}
