#!/usr/bin/env node
/**
 * check_ref_lines.js — 교재/문제은행 본문의 (LNN) 참조 라인 검증
 *
 * 표 셀의 (LNN|file.pdf) / (LNN) 마커는 ref_md 문서의 라인 번호를 가리킨다.
 * ref_md 재변환으로 라인이 밀려도 sync_citation_lines의 대상이 아니므로
 * (문제은행의 #L#### 링크만 갱신) 여기서 별도 검증한다.
 *
 * 검사:
 *   - (LNN) 계열: 참조 ref_md 파일 존재, 라인 범위, 같은 셀의 키워드가
 *     해당 라인(±1)에 실제 존재 — 불일치 시 파일 전체 검색으로 실제 라인 제안
 *   - 출처 조문 계열: `📌 **출처**: … 제N조` + 같은 줄의 참조 링크(.md)가
 *     가리키는 문서에 해당 조문이 실제 존재하는지 (ref_md 재변환·법 개정 감지)
 *   - (L?) 미해결 마커는 건수만 집계 (경고)
 *
 * 사용: node tools/check_ref_lines.js   (불일치 시 exit 1)
 */
const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./build/exam-targets.js');
const { docSubject } = require('./build/ref-statements.js');

const ROOT = path.resolve(__dirname, '..');

// (LNN|file.pdf) / (LNN) / (L?) 패턴 — build_keyword_index.js와 동일 규칙
const LINK_FILE_RE = /\(L(\d+)\\?\|(.+?\.pdf)\)/g;
const LINK_SAME_RE = /\(L(\d+)\)(?!\|)/g;
const UNRESOLVED_RE = /\(L\?(?:\\?\|.+?\.pdf)?\)/g;
// 현재 참조 문서 컨텍스트 (📌 **출처**: X.pdf / 참조 PDF: `X.pdf`)
const SRC_RE = /📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n|$)/;
const SRC2_RE = /참조\s*PDF[:：]\s*`?([^`\n|]+\.pdf)/;

const norm = t => String(t || '').replace(/[\s*_`#>|「」()\[\]〈〉-]+/g, '');

/** 셀 텍스트에서 키워드 추출 — build_keyword_index.extractKeywordFromCell과 동일 규칙 */
function extractKeywordFromCell(cellText) {
  let c = cellText;
  c = c.replace(/\(L\d+\\?\|.+?\.pdf\)/g, '');
  c = c.replace(/\(L\d+\)/g, '');
  c = c.replace(/\(L\?\\?\|.+?\.pdf\)/g, '');
  c = c.replace(/\(L\?\)/g, '');
  c = c.replace(/\*\*/g, '').replace(/\*/g, '');
  c = c.replace(/<br\s*\/?>/gi, ' ');
  c = c.replace(/\s+/g, ' ').trim();
  const firstPart = c.split(/[,.·—–]/)[0].trim();
  return firstPart || c;
}

/** references.json의 refDirs → { 'X.pdf': '<contentRoot>/참조자료/ref_md/과목N/X/X.md' } */
function buildFileToPath(contentRoot, refs) {
  const refDirs = refs.refDirs || {};
  const dirPriority = Object.keys(refDirs).sort((a, b) => {
    const na = a.match(/^과목(\d+)$/), nb = b.match(/^과목(\d+)$/);
    if (na && nb) return +nb[1] - +na[1];
    if (na) return -1;
    if (nb) return 1;
    return 0;
  });
  const map = {};
  for (const dir of dirPriority) {
    for (const f of refDirs[dir] || []) {
      const base = f.replace(/\.pdf$/i, '');
      if (!map[f]) {
        const sub = docSubject(base, path.join(ROOT, contentRoot));
        map[f] = `${contentRoot}/참조자료/ref_md/${sub ? `과목${sub}/` : ''}${base}/${base}.md`;
      }
    }
  }
  return map;
}

function* mdFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* mdFiles(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

/** 셀 분할 — \| 이스케이프 보존 (build_keyword_index와 동일) */
function splitCells(line) {
  const safe = line.replace(/\\\|/g, '\x00');
  return safe.split('|').slice(1, -1).map(c => c.replace(/\x00/g, '|').trim());
}

const errors = [];
const warnings = [];
let totalLinks = 0;
let articleChecks = 0;
let unresolved = 0;

const lineCache = {};
function getLines(absPath) {
  if (!lineCache[absPath]) {
    lineCache[absPath] = fs.readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
  }
  return lineCache[absPath];
}

console.log('='.repeat(70));
console.log('교재 (LNN) 참조 라인 검증');
console.log('='.repeat(70));

for (const t of getExamTargets(ROOT)) {
  const refsPath = path.join(ROOT, t.contentRoot, 'references.json');
  if (!fs.existsSync(refsPath)) continue;
  const refs = JSON.parse(fs.readFileSync(refsPath, 'utf8'));
  const fileToPath = buildFileToPath(t.contentRoot, refs);
  const resolveRef = f => fileToPath[f] || (f.startsWith(`${t.contentRoot}/`) ? f : '');

  // 검사 대상: 교재 + 문제은행의 .md (ref_md 산출물 자체는 제외)
  const scanDirs = ['교재', '문제은행']
    .map(d => path.join(ROOT, t.contentRoot, d));

  for (const dir of scanDirs) {
    for (const file of mdFiles(dir)) {
      const rel = path.relative(ROOT, file);
      const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
      let currentRefPath = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const s1 = line.match(SRC_RE);
        if (s1) currentRefPath = resolveRef(s1[1].trim()) || '';
        const s2 = line.match(SRC2_RE);
        if (s2) currentRefPath = resolveRef(s2[1].trim()) || '';

        const um = line.match(UNRESOLVED_RE);
        if (um) unresolved += um.length;

        // 출처 조문 검증: `📌 **출처**: … 제N조(의M)` + 같은 줄 .md 링크
        if (s1) {
          const linkM = line.match(/\]\((?:<)?([^>\s)]+\.md)(?:>)?\)/);
          const articles = [...s1[1].matchAll(/제(\d+)조(?:의(\d+))?/g)]
            .map(a => `제${a[1]}조${a[2] ? `의${a[2]}` : ''}`);
          articleChecks += articles.length;
          if (linkM && articles.length) {
            const dec = p => { try { return decodeURIComponent(p); } catch { return p; } };
            // '../참조자료/…' 링크는 런타임이 {contentRoot}/참조자료/ 로 재작성하는
            // 규약이므로 파일시스템 상대경로가 아니라 그 규약대로 해석한다
            const linkPath = dec(linkM[1]);
            const abs = linkPath.includes('참조자료/')
              ? path.join(ROOT, t.contentRoot, '참조자료', linkPath.split('참조자료/')[1])
              : path.resolve(path.dirname(file), linkPath);
            if (!fs.existsSync(abs)) {
              errors.push(`${rel}:${i + 1} — 출처 링크 파일 없음: ${linkM[1].slice(-60)}`);
            } else {
              const refLines = getLines(abs);
              const refAll = norm(refLines.join('\n'));
              const missing = articles.filter(a => !refAll.includes(norm(a)));
              // 출처가 'A법 제N조 + B고시'처럼 복수 소스면 참조 링크는 대표 문서
              // 하나만 가리키는 규약 — 미발견 조문이 다른 문서 소속일 수 있어 경고 처리
              const multiSource = s1[1].includes('+');
              if (missing.length === articles.length && !multiSource) {
                errors.push(`${rel}:${i + 1} — 출처 "${s1[1].trim().slice(0, 40)}"의 조문이 링크 문서에 없음: ${missing.join(', ')} → ${path.basename(abs)}`);
              } else if (missing.length) {
                warnings.push(`${rel}:${i + 1} — 조문 미발견${multiSource ? '(복수 출처)' : ''}: ${missing.join(', ')} → ${path.basename(abs)}`);
              }
            }
          }
        }

        if (!line.trim().startsWith('|')) continue;
        if (/^\|[-\s|]+\|/.test(line.trim())) continue;
        const cells = splitCells(line);

        /** link 처리 공통: (lineNum, pdfFile|null, rawMatch) */
        const check = (lineNum, pdfFile, raw) => {
          const refPath = pdfFile ? resolveRef(pdfFile) : currentRefPath;
          totalLinks++;
          if (!refPath) {
            errors.push(`${rel}:${i + 1} — ${raw}: 참조 파일 해석 불가 (${pdfFile || '컨텍스트 없음'})`);
            return;
          }
          const abs = path.join(ROOT, refPath);
          if (!fs.existsSync(abs)) {
            errors.push(`${rel}:${i + 1} — ${raw}: ref_md 파일 없음 → ${refPath}`);
            return;
          }
          const refLines = getLines(abs);
          const ln = parseInt(lineNum, 10);
          if (ln < 1 || ln > refLines.length) {
            errors.push(`${rel}:${i + 1} — ${raw}: 범위초과 (${path.basename(refPath)} 총 ${refLines.length}줄)`);
            return;
          }
          // 링크가 든 셀의 키워드
          const cell = cells.find(c => c.includes(raw.replace(/\\\|/g, '|')) || c.includes(raw));
          const keyword = cell ? extractKeywordFromCell(cell) : '';
          const kw = norm(keyword);
          if (kw.length < 2) return; // 키워드 추출 불가 → 라인 존재만 확인
          // 해당 라인 ±1 에 키워드 존재?
          const near = [ln, ln - 1, ln + 1].some(x =>
            x >= 1 && x <= refLines.length && norm(refLines[x - 1]).includes(kw));
          if (near) return;
          // 파일 전체에서 실제 위치 탐색
          const found = [];
          for (let k = 0; k < refLines.length; k++) {
            if (norm(refLines[k]).includes(kw)) found.push(k + 1);
            if (found.length > 3) break;
          }
          if (found.length) {
            errors.push(`${rel}:${i + 1} — ${raw}: 라인 불일치 (${path.basename(refPath)} 실제 L${found.join('/L')})`);
          } else {
            errors.push(`${rel}:${i + 1} — ${raw}: 키워드 "${keyword.slice(0, 30)}" 미발견 (${path.basename(refPath)})`);
          }
        };

        // (LNN|file.pdf) 먼저 처리 후 잔여 (LNN) 처리
        LINK_FILE_RE.lastIndex = 0;
        let m;
        while ((m = LINK_FILE_RE.exec(line)) !== null) check(m[1], m[2], m[0]);
        const rest = line.replace(LINK_FILE_RE, '');
        LINK_SAME_RE.lastIndex = 0;
        while ((m = LINK_SAME_RE.exec(rest)) !== null) check(m[1], null, m[0]);
      }
    }
  }
}

console.log(`검사: (LNN) 링크 ${totalLinks}개 / 출처 조문 ${articleChecks}건 / 미해결 (L?): ${unresolved}개`);
if (unresolved) warnings.push(`(L?) 미해결 마커 ${unresolved}개 — 키워드가 참조문서에서 검색되지 않아 등록 보류됨`);
if (warnings.length) {
  console.log('\n■ 경고');
  warnings.forEach(w => console.log('  ' + w));
}
if (errors.length) {
  console.log(`\n■ 오류 ${errors.length}건`);
  errors.slice(0, 30).forEach(e => console.log('  ' + e));
  if (errors.length > 30) console.log(`  … 외 ${errors.length - 30}건`);
  process.exit(1);
}
console.log('\n✅ (LNN) 참조 라인이 실제 ref_md 내용과 일치합니다.');
