// 교재 내 PDF 직접 링크 → MD 변환본(ref_md/) 링크로 일괄 변환
// 변환 규칙: ../참조자료/{dir}/{basename}.pdf → ../참조자료/ref_md/{basename}/{basename}.md
// 단, MD 변환본이 존재하는 36개 파일만 변환 (5개 "_구" 파일 + 4개 "_삭제" 파일은 제외)
//
// 사용법: node tools/convert_pdf_links_to_md.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEXTBOOK_DIR = path.join(ROOT, 'content', '교재');
const REF_BASE = path.join(ROOT, 'content', '참조자료');
const REF_MD_DIR = path.join(REF_BASE, 'ref_md');

const DRY_RUN = process.argv.includes('--dry-run');

// ref_md/ 하위에 MD 변환본이 존재하는 basename 목록 (36개)
const refMdDirs = fs.readdirSync(REF_MD_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name);

const convertibleBasenames = new Set();
for (const dir of refMdDirs) {
  const fullDir = path.join(REF_MD_DIR, dir);
  const mdFile = `${dir}.md`;
  if (fs.existsSync(path.join(fullDir, mdFile))) {
    convertibleBasenames.add(dir);
  }
}

// 변환 대상 디렉토리 (법령원문, 공통, 과목1, 과목2)
const targetDirs = ['법령원문', '공통', '과목1', '과목2'];

// 교재 파일 목록
const textbookFiles = [];
function collectMd(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectMd(full);
    else if (entry.name.endsWith('.md')) textbookFiles.push(full);
  }
}
collectMd(TEXTBOOK_DIR);

// 마크다운 링크 추출 정규식
const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

// PDF 링크를 MD 링크로 변환
// 패턴: ../참조자료/{dir}/{encoded_basename}.pdf
// 변환: ../참조자료/ref_md/{encoded_basename}/{encoded_basename}.md
function convertPdfLink(linkUrl) {
  // ../참조자료/{dir}/{basename}.pdf 패턴 매칭
  for (const dir of targetDirs) {
    const prefix = `../참조자료/${dir}/`;
    if (linkUrl.startsWith(prefix) && linkUrl.endsWith('.pdf')) {
      // {encoded_basename}.pdf 추출
      const encodedBasenameWithExt = linkUrl.slice(prefix.length);
      const encodedBasename = encodedBasenameWithExt.slice(0, -4); // .pdf 제거

      // 디코딩하여 실제 basename 확인
      let actualBasename;
      try {
        actualBasename = decodeURIComponent(encodedBasename);
      } catch (e) {
        return null; // 디코딩 실패
      }

      // MD 변환본이 존재하는지 확인
      if (convertibleBasenames.has(actualBasename)) {
        // 변환: ../참조자료/ref_md/{encoded_basename}/{encoded_basename}.md
        const newUrl = `../참조자료/ref_md/${encodedBasename}/${encodedBasename}.md`;
        return newUrl;
      }
      return null; // MD 변환본 없음
    }
  }
  return null; // 대상 아님
}

// 통계
const stats = {
  totalLinks: 0,
  converted: 0,
  skipped: 0,
  byFile: {},
  convertedDetails: [],
};

for (const mdFile of textbookFiles) {
  const relFile = path.relative(ROOT, mdFile).replace(/\\/g, '/');
  const content = fs.readFileSync(mdFile, 'utf8');
  const lines = content.split('\n');

  stats.byFile[relFile] = { total: 0, converted: 0, skipped: 0 };

  let modified = false;
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let match;
    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(line)) !== null) {
      const fullMatch = match[0];
      const linkText = match[1];
      const linkUrl = match[2];

      // PDF 링크인지 확인
      if (linkUrl.includes('참조자료') && linkUrl.endsWith('.pdf')) {
        stats.totalLinks++;
        stats.byFile[relFile].total++;

        const newUrl = convertPdfLink(linkUrl);
        if (newUrl) {
          // 링크 텍스트도 .pdf → .md로 변경
          const newText = linkText.replace(/\.pdf$/, '.md');
          const newLink = `[${newText}](${newUrl})`;

          line = line.replace(fullMatch, newLink);
          modified = true;

          stats.converted++;
          stats.byFile[relFile].converted++;
          stats.convertedDetails.push({
            file: relFile,
            line: i + 1,
            old: fullMatch,
            new: newLink,
          });
        } else {
          stats.skipped++;
          stats.byFile[relFile].skipped++;
        }
      }
    }

    newLines.push(line);
  }

  if (modified && !DRY_RUN) {
    fs.writeFileSync(mdFile, newLines.join('\n'), 'utf8');
  }
}

// 결과 출력
console.log('='.repeat(80));
console.log(`PDF → MD 링크 변환 ${DRY_RUN ? '(DRY RUN — 실제 변경 없음)' : '(실행 완료)'}`);
console.log('='.repeat(80));
console.log();

console.log('■ 전체 통계');
console.log(`  PDF 링크 총합: ${stats.totalLinks}개`);
console.log(`  변환됨: ${stats.converted}개`);
console.log(`  변환 안 함 (MD 변환본 없음): ${stats.skipped}개`);
console.log();

console.log('■ 파일별 변환 현황');
for (const [file, info] of Object.entries(stats.byFile).sort()) {
  if (info.total === 0) continue;
  console.log(`  ${file}: PDF ${info.total}개 → 변환 ${info.converted}개, 유지 ${info.skipped}개`);
}
console.log();

if (stats.convertedDetails.length > 0 && stats.convertedDetails.length <= 50) {
  console.log('■ 변환 상세 (최대 50개)');
  console.log('-'.repeat(80));
  for (const d of stats.convertedDetails) {
    console.log(`  [${d.file}:${d.line}]`);
    console.log(`    OLD: ${d.old.substring(0, 150)}${d.old.length > 150 ? '...' : ''}`);
    console.log(`    NEW: ${d.new.substring(0, 150)}${d.new.length > 150 ? '...' : ''}`);
  }
} else if (stats.convertedDetails.length > 50) {
  console.log(`■ 변환 상세 (${stats.convertedDetails.length}개 — 첫 50개만 표시)`);
  console.log('-'.repeat(80));
  for (const d of stats.convertedDetails.slice(0, 50)) {
    console.log(`  [${d.file}:${d.line}]`);
    console.log(`    OLD: ${d.old.substring(0, 150)}${d.old.length > 150 ? '...' : ''}`);
    console.log(`    NEW: ${d.new.substring(0, 150)}${d.new.length > 150 ? '...' : ''}`);
  }
}
