/**
 * trace_scan.js — SPEC ID 추적 스캔 공용 모듈 (단일 진실 소스)
 *
 * check_spec_refs.js·build_trace_matrix.js·impact_tests.js·trace.js가 공유하는
 * 스캔 원천 — ID 정규식·@spec 토큰 규격·스캔 범위·문서 헤더 파서는 이 파일에만 둔다.
 * 새 도구를 만들 때 이 모듈을 require할 것 (개별 파서 복제 = drift 재발).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SPEC_FILE = path.join(ROOT, 'docs', 'dev', 'SPEC.md');

// @spec 스캔 범위 (check_spec_refs.js와 동일)
const SCAN_DIRS = ['src', 'tests', 'tools', 'css', 'html', 'ref-pipeline'];
const SCAN_FILES = ['sw.js', 'index.html', 'serve.js'];
const SCAN_EXTS = new Set(['.js', '.css', '.html', '.ts', '.py']);
const EXCLUDE_DIRS = [path.join('tools', '_archive'), path.join('tools', '__pycache__'), 'node_modules'];
const EXCLUDE_FILES = [
  path.join('tools', 'check', 'check_spec_refs.js'),
  path.join('tools', 'build_trace_matrix.js'),
  path.join('tools', 'impact_tests.js'),
  path.join('tools', 'trace.js'),
  path.join('tools', 'lib', 'trace_scan.js'),
];

// 문서 스캔 범위 (check_doc_ids.js와 동일)
const DOC_DIRS = ['docs', 'ref-pipeline'];
const DOC_FILES = ['AGENTS.md', 'README.md'];
const REPORT_DIR = 'docs/report_archive';

// check_spec_refs.js와 동일 규격 — 문자 접미사(TR-16a)·로드맵(ROAD-P/L) 모두 지원
const ID_RE = /\b([A-Z]{1,4}(?:-[A-Z]{1,4})?-(?:\d{2}[a-z]?|[PL]\d))\b/g;
const SPEC_TAG_RE = /@spec\s+([^\n]*)/g;
const RANGE_RE = /^([A-Z]{1,4}(?:-[A-Z]{1,4})?-[PL]?)(\d{1,2})~[PL]?(\d{1,2})$/;
const WILDCARD_ID_RE = /^([A-Z]{1,4}(?:-[A-Z]{1,4})?)-\*$/;
const PURE_ID_RE = /^[A-Z]{1,4}(?:-[A-Z]{1,4})?-(?:\d{2}[a-z]?|[PL]\d)$/;
const DOC_ID_RE = /\*\*문서 ID\*\*:\s*(DOC-[A-Z]+-\d+)/;
const RELATED_RE = /^>\s*\*\*관련 SPEC ID\*\*:\s*(.+)$/m;

function* walk(dir, exts) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const rel = path.relative(ROOT, p);
      if (EXCLUDE_DIRS.some(x => rel === x || rel.startsWith(x + path.sep))) continue;
      yield* walk(p, exts);
    } else if (exts.has(path.extname(e.name))) {
      const rel = path.relative(ROOT, p);
      if (!EXCLUDE_FILES.some(x => rel === x)) yield p;
    }
  }
}

/** @spec·관련 SPEC ID 토큰 → ID 집합 (범위·나열·접두사 와일드카드). errors 배열을 넘기면 해석 불가 토큰을 수집 */
function expandIds(tagText, specIds = new Set(), errors = null, src = '') {
  const ids = new Set();
  if (/^(none\b|해당|전 영역)/.test(tagText.trim())) return ids;
  // 구분자: 쉼표·가운뎃점·슬래시 (FO-24/RR-19 형태의 연접 나열 허용 — 접두사 생략형 `FO-24/25`는 비지원, `25`가 파싱 오류로 잡혀 명시 강제)
  for (const raw of tagText.split(/[,·/]/)) {
    const token = raw.trim()
      .replace(/\*\/\s*$/, '')
      .replace(/-->\s*$/, '')
      .replace(/[)）(].*$/, '')
      .replace(/[가-힣\s].*$/, '')
      .replace(/[`'"]/g, '')
      .trim();
    if (!token) continue;
    if (/^none\b/i.test(token)) return ids;
    const range = token.match(RANGE_RE);
    if (range) {
      const [, prefix, from, to] = range;
      const pad = /[PL]$/.test(prefix) ? 1 : 2; // ROAD-P/L 계열은 단자리
      for (let i = +from; i <= +to; i++) ids.add(prefix + String(i).padStart(pad, '0'));
      continue;
    }
    const wild = token.match(WILDCARD_ID_RE);
    if (wild) {
      const keys = specIds instanceof Map ? specIds.keys() : specIds;
      for (const id of keys) if (id.startsWith(wild[1] + '-')) ids.add(id);
      continue;
    }
    if (PURE_ID_RE.test(token)) { ids.add(token); continue; }
    // 파일 경로·확장자 토큰(`../design/X.md` 등)은 ID 아님 — `/` 구분자로 쪼개진 조각 포함
    if (/\.[a-z0-9]{1,6}$/i.test(token)) continue;
    // 대문자 시작 토큰은 ID 의도로 간주 — 해석 불가를 오류로 수집 (무소음 드롭 방지)
    if (errors && /^[A-Z0-9]/.test(token)) errors.push(`${src} — ID 토큰 해석 불가: "${token}"`);
  }
  return ids;
}

/** SPEC.md → Map(id → 절 제목) — 선언 형태(표 첫 셀·굵은 글씨)를 우선, 일반 언급은 폴백 */
function extractSpec() {
  const lines = fs.readFileSync(SPEC_FILE, 'utf8').split('\n');
  const ids = new Map();
  const firstMention = new Map();
  let sec = '';
  for (const l of lines) {
    if (/^#{2,3} /.test(l)) sec = l.replace(/^#+\s*/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
    for (const m of l.matchAll(ID_RE)) {
      const id = m[1];
      if (id.startsWith('DOC-')) continue;
      if (!firstMention.has(id) || (!firstMention.get(id) && sec)) firstMention.set(id, sec);
      // 선언 형태 우선: 표 첫 셀(| ID |, 3열 이상 = 요구사항 표) 또는 굵은 선언(**ID**)
      // 부록·출처 절의 2열 매핑표(| ID | 출처 |)는 선언으로 오인하지 않는다
      const inDeclSection = !/부록|출처/.test(sec);
      const tableDecl = /^\s*\|/.test(l) && l.split('|').map(c => c.trim()).filter(Boolean).length >= 3;
      const declared = inDeclSection &&
        (new RegExp(`^\\s*\\|\\s*${id}\\s*\\|`).test(l) && tableDecl || new RegExp(`\\*\\*${id}\\*\\*`).test(l));
      if (declared && sec) ids.set(id, sec);
    }
  }
  for (const [id, s] of firstMention) if (!ids.has(id)) ids.set(id, s);
  return ids;
}

/** SPEC.md → Map(id → 구현 상태 문자열) — 표 행 `| ID | … | 상태 |`의 마지막 셀 */
function extractSpecStatus() {
  const map = new Map();
  const ROW_RE = /^\s*\|\s*([A-Z]{1,4}(?:-[A-Z]{1,4})?-(?:\d{2}[a-z]?|[PL]\d))\s*\|/;
  for (const l of fs.readFileSync(SPEC_FILE, 'utf8').split('\n')) {
    const m = l.match(ROW_RE);
    if (!m) continue;
    const cells = l.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 3) map.set(m[1], cells[cells.length - 1]);
  }
  return map;
}

/** SPEC.md "부록: 요구사항 출처" 표 → Map(id → 출처 문자열). ID 셀은 범위·나열 지원 */
function extractSpecSources(specIds = new Set()) {
  const map = new Map();
  let inSrc = false;
  for (const l of fs.readFileSync(SPEC_FILE, 'utf8').split('\n')) {
    if (/^#{2,3} /.test(l)) { inSrc = /출처/.test(l); continue; }
    if (!inSrc) continue;
    const cells = l.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length !== 2) continue;
    if (/^[-:]*$/.test(cells[0]) || cells[0] === 'ID') continue; // 헤더·구분선
    for (const id of expandIds(cells[0], specIds)) map.set(id, cells[1]);
  }
  return map;
}

/** 코드 @spec 스캔 → { src: Map(id→Set(file)), tst: Map(id→Set(file)) } */
function collectCodeRefs(specIds) {
  const src = new Map(), tst = new Map();
  const files = [...SCAN_FILES.map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f))];
  for (const d of SCAN_DIRS) files.push(...walk(path.join(ROOT, d), SCAN_EXTS));
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const isTest = rel.startsWith('tests/');
    fs.readFileSync(file, 'utf8').split('\n').forEach(text => {
      for (const m of text.matchAll(SPEC_TAG_RE)) {
        for (const id of expandIds(m[1], specIds)) {
          const map = isTest ? tst : src;
          if (!map.has(id)) map.set(id, new Set());
          map.get(id).add(rel);
        }
      }
    });
  }
  return { src, tst };
}

/** 문서 스캔 → { docs, reports: Map(specId→Set(docId)), meta: Map(docId→{file,title}), missingRef: [file], docErrors: [msg] } */
function collectDocRefs(specIds) {
  const docs = new Map(), reports = new Map();
  const meta = new Map();
  const missingRef = [];
  const docErrors = [];
  const files = DOC_FILES.map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f));
  for (const d of DOC_DIRS) files.push(...walk(path.join(ROOT, d), new Set(['.md'])));
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    const docId = (text.match(DOC_ID_RE) || [])[1] || rel;
    const title = (text.match(/^#\s+(.+)$/m) || [])[1] || rel;
    meta.set(docId, { file: rel, title });
    const m = text.match(RELATED_RE);
    if (!m) { missingRef.push(rel); continue; }
    const map = rel.startsWith(REPORT_DIR) ? reports : docs;
    for (const id of expandIds(m[1], specIds, docErrors, rel)) {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id).add(docId);
    }
  }
  return { docs, reports, meta, missingRef, docErrors };
}

/** 단일 파일의 관련 ID 직접 추출 (@spec 또는 문서 헤더) */
function idsInFile(absPath, specIds) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  const text = fs.readFileSync(absPath, 'utf8');
  const ids = new Set();
  if (rel.endsWith('.md')) {
    const m = text.match(RELATED_RE);
    if (m) for (const id of expandIds(m[1], specIds)) ids.add(id);
    return ids;
  }
  for (const m of text.matchAll(SPEC_TAG_RE)) {
    for (const id of expandIds(m[1], specIds)) ids.add(id);
  }
  return ids;
}

/** 전체 추적 데이터 한 번에 수집 (도구 공용 진입점) */
function scanAll() {
  const specIds = extractSpec();
  const { src, tst } = collectCodeRefs(specIds);
  const { docs, reports, meta, missingRef, docErrors } = collectDocRefs(specIds);
  return { specIds, src, tst, docs, reports, meta, missingRef, docErrors };
}

module.exports = {
  ROOT, SPEC_FILE, SCAN_DIRS, SCAN_FILES, SCAN_EXTS, EXCLUDE_DIRS, EXCLUDE_FILES,
  DOC_DIRS, DOC_FILES, REPORT_DIR,
  ID_RE, SPEC_TAG_RE, RANGE_RE, WILDCARD_ID_RE, PURE_ID_RE, DOC_ID_RE, RELATED_RE,
  walk, expandIds, extractSpec, extractSpecStatus, extractSpecSources,
  collectCodeRefs, collectDocRefs, idsInFile, scanAll,
};
