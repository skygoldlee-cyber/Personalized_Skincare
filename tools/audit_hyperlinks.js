// 교재 내 출처·참조자료 하이퍼링크 전수조사 스크립트 (v2)
// ../참조자료/ 경로는 앱 렌더러에서 content/참조자료/로 재작성됨을 반영
// 사용법: node tools/audit_hyperlinks.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEXTBOOK_DIR = path.join(ROOT, 'content', '교재');
const REF_BASE = path.join(ROOT, 'content', '참조자료');

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

// 마크다운 링크 추출 정규식: [text](url)
const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

const results = {
  totalLinks: 0,
  refLinks: 0,
  validLinks: 0,
  brokenLinks: [],
  bySubdir: {},
  byFile: {},
  byFormat: { pinned: 0, simple: 0, tableCell: 0 },
  uniqueRefDocs: new Set(),
  brokenDetails: [],
  encodingIssues: [], // URL 인코딩 불일치
};

// 앱 렌더러와 동일한 경로 재작성 로직
function rewriteRefPath(linkUrl) {
  // ../참조자료/... → content/참조자료/...
  let decoded = decodeURIComponent(linkUrl);
  let rewritten = decoded.replace(/^\.\.\/참조자료\//, 'content/참조자료/');
  return rewritten;
}

function checkFileExists(rewrittenPath) {
  const fullPath = path.join(ROOT, rewrittenPath);
  return { exists: fs.existsSync(fullPath), fullPath };
}

// URL 인코딩 일관성 검사
function checkEncoding(linkUrl) {
  const issues = [];
  // 괄호가 %28/%29로 인코딩된 경우
  if (linkUrl.includes('%28') || linkUrl.includes('%29')) {
    // 스페이스가 %20이 아닌 리터럴 스페이스인 경우 혼용
    if (linkUrl.includes(' ') && linkUrl.includes('%20')) {
      issues.push('space: mixed (literal + %20)');
    }
  }
  // 스페이스가 리터럴로 사용된 경우 (일부만 %20으로 인코딩)
  if (linkUrl.includes(' ') && !linkUrl.includes('%20')) {
    issues.push('space: literal (not encoded)');
  }
  return issues;
}

for (const mdFile of textbookFiles) {
  const relFile = path.relative(ROOT, mdFile).replace(/\\/g, '/');
  const content = fs.readFileSync(mdFile, 'utf8');
  const lines = content.split('\n');

  results.byFile[relFile] = { total: 0, ref: 0, broken: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    linkRegex.lastIndex = 0;
    while ((match = linkRegex.exec(line)) !== null) {
      const linkText = match[1];
      const linkUrl = match[2];

      results.totalLinks++;
      results.byFile[relFile].total++;

      if (linkUrl.includes('참조자료')) {
        results.refLinks++;
        results.byFile[relFile].ref++;

        // 하위 디렉토리 분류
        const subdirMatch = linkUrl.match(/참조자료\/([^/]+)/);
        if (subdirMatch) {
          const subdir = subdirMatch[1];
          results.bySubdir[subdir] = (results.bySubdir[subdir] || 0) + 1;
        }

        results.uniqueRefDocs.add(linkUrl);

        // URL 인코딩 검사
        const encIssues = checkEncoding(linkUrl);
        if (encIssues.length > 0) {
          results.encodingIssues.push({
            file: relFile, line: i + 1, url: linkUrl, issues: encIssues,
          });
        }

        // 앱 렌더러 재작성 로직으로 경로 변환 후 파일 존재 확인
        const rewritten = rewriteRefPath(linkUrl);
        const check = checkFileExists(rewritten);
        if (check.exists) {
          results.validLinks++;
        } else {
          results.brokenLinks.push({
            file: relFile, line: i + 1, url: linkUrl, text: linkText,
            rewritten, fullPath: check.fullPath,
          });
          results.byFile[relFile].broken++;
        }
      }

      // 출처 형식 분류
      if (line.includes('📌 **출처**') && (line.includes('참조 자료') || line.includes('참조자료'))) {
        results.byFormat.pinned++;
      } else if (/^>\s*출처:/.test(line)) {
        results.byFormat.simple++;
      } else if (line.includes('|') && linkUrl.includes('참조자료') && !line.includes('출처')) {
        results.byFormat.tableCell++;
      }
    }
  }
}

// 결과 출력
console.log('='.repeat(80));
console.log('교재 내 출처·참조자료 하이퍼링크 전수조사 결과 (v2 — 렌더러 재작성 반영)');
console.log('='.repeat(80));
console.log();

console.log('■ 전체 통계');
console.log(`  총 링크 수: ${results.totalLinks}`);
console.log(`  참조자료 링크: ${results.refLinks}`);
console.log(`  유효 링크(재작성 후 파일 존재): ${results.validLinks}`);
console.log(`  끊어진 링크(재작성 후에도 파일 없음): ${results.brokenLinks.length}`);
console.log(`  고유 참조문서 수: ${results.uniqueRefDocs.size}`);
console.log();

console.log('■ 하위 디렉토리별 링크 수');
for (const [subdir, count] of Object.entries(results.bySubdir).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${subdir}: ${count}개`);
}
console.log();

console.log('■ 파일별 링크 수');
for (const [file, info] of Object.entries(results.byFile).sort()) {
  const brokenMark = info.broken > 0 ? ` ⚠️끊어진링크 ${info.broken}개` : ' ✓';
  console.log(`  ${file}: 총 ${info.total}개 (참조자료 ${info.ref}개)${brokenMark}`);
}
console.log();

console.log('■ 출처 형식별 집계');
console.log(`  📌 pinned 형식 (📌 **출처**: ...| **참조 자료**: ...): ${results.byFormat.pinned}개`);
console.log(`  단순 형식 (> 출처: [name](path)): ${results.byFormat.simple}개`);
console.log(`  표 셀 형식 (| [name](path) |): ${results.byFormat.tableCell}개`);
console.log();

// 끊어진 링크 요약 (중복 제거하여 고유 경로만)
if (results.brokenLinks.length > 0) {
  const uniqueBroken = new Map();
  for (const bl of results.brokenLinks) {
    if (!uniqueBroken.has(bl.rewritten)) {
      uniqueBroken.set(bl.rewritten, { ...bl, count: 0 });
    }
    uniqueBroken.get(bl.rewritten).count++;
  }

  console.log('■ 끊어진 링크 (고유 경로별, 재작성 후 파일 없음)');
  console.log('-'.repeat(80));
  console.log(`  총 ${results.brokenLinks.length}개 링크 / ${uniqueBroken.size}개 고유 경로`);
  console.log();
  for (const [rewritten, info] of uniqueBroken) {
    console.log(`  [${info.count}회] ${rewritten}`);
    console.log(`    실제경로: ${info.fullPath}`);
  }
  console.log();
} else {
  console.log('■ 끊어진 링크: 없음 ✓');
  console.log();
}

// URL 인코딩 불일치
if (results.encodingIssues.length > 0) {
  const uniqueEnc = new Map();
  for (const ei of results.encodingIssues) {
    const key = ei.url;
    if (!uniqueEnc.has(key)) uniqueEnc.set(key, { ...ei, count: 0 });
    uniqueEnc.get(key).count++;
  }
  console.log('■ URL 인코딩 불일치');
  console.log('-'.repeat(80));
  console.log(`  총 ${results.encodingIssues.length}개 링크 / ${uniqueEnc.size}개 고유 URL`);
  for (const [url, info] of uniqueEnc) {
    console.log(`  [${info.count}회] ${info.issues.join(', ')}`);
    console.log(`    URL: ${url.substring(0, 120)}${url.length > 120 ? '...' : ''}`);
  }
  console.log();
}

// 고유 참조문서 목록
console.log('■ 고유 참조문서 목록 (' + results.uniqueRefDocs.size + '개)');
console.log('-'.repeat(80));
const sortedDocs = [...results.uniqueRefDocs].sort();
for (const doc of sortedDocs) {
  const rewritten = rewriteRefPath(doc);
  const exists = checkFileExists(rewritten);
  const mark = exists.exists ? '✓' : '✗';
  console.log(`  ${mark} ${doc}`);
}
