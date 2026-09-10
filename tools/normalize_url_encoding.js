// ref_md MD 링크의 URL 인코딩 정규화: 리터럴 스페이스 → %20
// 대상: ../참조자료/ref_md/...md 형식의 마크다운 링크 URL
// 표시 텍스트(링크 라벨)는 변경하지 않음
//
// 사용법: node tools/normalize_url_encoding.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEXTBOOK_DIR = path.join(ROOT, 'content', '교재');
const DRY_RUN = process.argv.includes('--dry-run');

// 교재 파일 수집
const textbookFiles = [];
function collectMd(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectMd(full);
    else if (entry.name.endsWith('.md')) textbookFiles.push(full);
  }
}
collectMd(TEXTBOOK_DIR);

// 마크다운 링크 정규식: [text](url)
const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

// URL 내 리터럴 스페이스를 %20으로 인코딩
// 단, ref_md 경로의 URL 부분만 처리
function normalizeUrl(url) {
  // ref_md 경로가 아니면 변경하지 않음
  if (!url.includes('ref_md/')) return null;
  // 이미 인코딩된 %20이 있고 리터럴 스페이스가 없으면 변경 불필요
  if (!url.includes(' ')) return null;
  // 리터럴 스페이스를 %20으로 변환
  return url.replace(/ /g, '%20');
}

const stats = {
  totalLinks: 0,
  normalized: 0,
  byFile: {},
  details: [],
};

for (const mdFile of textbookFiles) {
  const relFile = path.relative(ROOT, mdFile).replace(/\\/g, '/');
  const content = fs.readFileSync(mdFile, 'utf8');
  const lines = content.split('\n');

  stats.byFile[relFile] = { normalized: 0 };

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

      const normalized = normalizeUrl(linkUrl);
      if (normalized) {
        const newLink = `[${linkText}](${normalized})`;
        line = line.replace(fullMatch, newLink);
        modified = true;

        stats.normalized++;
        stats.byFile[relFile].normalized++;
        stats.details.push({
          file: relFile,
          line: i + 1,
          old: fullMatch.substring(0, 120),
          new: newLink.substring(0, 120),
        });
      }
    }

    newLines.push(line);
  }

  if (modified && !DRY_RUN) {
    fs.writeFileSync(mdFile, newLines.join('\n'), 'utf8');
  }
}

console.log('='.repeat(80));
console.log(`URL 인코딩 정규화 ${DRY_RUN ? '(DRY RUN)' : '(실행 완료)'}`);
console.log('='.repeat(80));
console.log();
console.log(`■ 정규화된 링크: ${stats.normalized}개`);

console.log();
console.log('■ 파일별 현황');
for (const [file, info] of Object.entries(stats.byFile).sort()) {
  if (info.normalized === 0) continue;
  console.log(`  ${file}: ${info.normalized}개 정규화`);
}

if (stats.details.length > 0 && stats.details.length <= 20) {
  console.log();
  console.log('■ 상세');
  console.log('-'.repeat(80));
  for (const d of stats.details) {
    console.log(`  [${d.file}:${d.line}]`);
    console.log(`    OLD: ${d.old}...`);
    console.log(`    NEW: ${d.new}...`);
  }
} else if (stats.details.length > 20) {
  console.log();
  console.log(`■ 상세 (${stats.details.length}개 — 첫 20개만 표시)`);
  console.log('-'.repeat(80));
  for (const d of stats.details.slice(0, 20)) {
    console.log(`  [${d.file}:${d.line}]`);
    console.log(`    OLD: ${d.old}...`);
    console.log(`    NEW: ${d.new}...`);
  }
}
